const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI
const scoreVal = document.getElementById('score-val');
const livesVal = document.getElementById('lives-val');
const overlayStart = document.getElementById('overlay-start');
const overlayGameOver = document.getElementById('overlay-gameover');
const gameoverTitle = document.getElementById('gameover-title');
const finalScoreEl = document.getElementById('final-score');
const playerNickInput = document.getElementById('player-nick');
const saveScoreBtn = document.getElementById('save-score-btn');
const leaderboardList = document.getElementById('leaderboard-list');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');

// Estado de Execução
let gameActive = false;
let score = 0;
let lives = 3;
let lastTime = 0;
let shotTimer = 0;

// Delta Time (Normalizador de FPS)
let dt = 0;

// Controles
const keys = { left: false, right: false, up: false, down: false };
let isTouching = false;
let targetTouchX = null;
let targetTouchY = null;

// Fundo Estrelado
const stars = Array.from({ length: 60 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    size: Math.random() * 2 + 0.5,
    speed: Math.random() * 120 + 40
}));

// Jogador
const player = {
    x: canvas.width / 2 - 16,
    y: canvas.height - 90,
    width: 32,
    height: 38,
    speed: 320,
    weaponLevel: 1, // 1 a 4
    hasShield: false
};

// Entidades
let bullets = [];
let enemyBullets = [];
let enemies = [];
let particles = [];
let powerUps = [];
let boss = null;

// Listeners
window.addEventListener('keydown', e => handleKey(e, true));
window.addEventListener('keyup', e => handleKey(e, false));

function handleKey(e, isPressed) {
    if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = isPressed;
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = isPressed;
    if (e.key === 'ArrowUp' || e.key === 'w') keys.up = isPressed;
    if (e.key === 'ArrowDown' || e.key === 's') keys.down = isPressed;
}

canvas.addEventListener('touchstart', handleTouchMove, { passive: false });
canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
canvas.addEventListener('touchend', () => { isTouching = false; });

function handleTouchMove(e) {
    e.preventDefault();
    if (!gameActive) return;

    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];

    // Converte as coordenadas do toque para a escala do Canvas
    const touchX = (touch.clientX - rect.left) * (canvas.width / rect.width);
    const touchY = (touch.clientY - rect.top) * (canvas.height / rect.height);

    // Alvo X: Centralizado horizontalmente no dedo
    targetTouchX = touchX - player.width / 2;

    // Alvo Y: 45 pixels ACIMA da ponta do dedo para a nave não ficar escondida
    const FINGER_OFFSET_Y = 45; 
    targetTouchY = touchY - player.height / 2 - FINGER_OFFSET_Y;

    isTouching = true;
}

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
saveScoreBtn.addEventListener('click', saveRankingScore);

function startGame() {
    score = 0;
    lives = 3;
    bullets = [];
    enemyBullets = [];
    enemies = [];
    particles = [];
    powerUps = [];
    boss = null;
    
    player.x = canvas.width / 2 - 16;
    player.y = canvas.height - 90;
    player.weaponLevel = 1;
    player.hasShield = false;

    scoreVal.textContent = score;
    livesVal.textContent = lives;

    overlayStart.style.display = 'none';
    overlayGameOver.style.display = 'none';
    gameActive = true;
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

function gameOver(won = false) {
    gameActive = false;
    gameoverTitle.textContent = won ? "VITÓRIA!" : "GAME OVER";
    gameoverTitle.style.color = won ? "#10b981" : "#ef4444";
    finalScoreEl.textContent = score;

    overlayGameOver.style.display = 'flex';
    document.getElementById('nick-form').style.display = 'flex';
    renderLeaderboard();
}

// LocalStorage Ranking
function getLeaderboard() {
    return JSON.parse(localStorage.getItem('megahit_aerofighters_ranks') || '[]');
}

function saveRankingScore() {
    const nick = playerNickInput.value.trim() || 'Piloto';
    const ranks = getLeaderboard();
    ranks.push({ nick, score });
    ranks.sort((a, b) => b.score - a.score);
    localStorage.setItem('megahit_aerofighters_ranks', JSON.stringify(ranks.slice(0, 10)));
    document.getElementById('nick-form').style.display = 'none';
    renderLeaderboard();
}

function renderLeaderboard() {
    const ranks = getLeaderboard();
    leaderboardList.innerHTML = ranks.length === 0 ? '<li>Sem registros.</li>' : '';
    ranks.forEach(item => {
        const li = document.createElement('li');
        li.innerHTML = `<strong>${item.nick}</strong>: ${item.score} pts`;
        leaderboardList.appendChild(li);
    });
}

// LOOP PRINCIPAL (Com Delta Time)
function gameLoop(now) {
    if (!gameActive) return;

    dt = (now - lastTime) / 1000; // Converte para segundos
    if (dt > 0.1) dt = 0.1; // Trava para evitar grandes saltos de lag
    lastTime = now;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    updateBackground();
    updatePlayer();
    updateBullets();
    spawnEnemies();
    updateEnemies();
    updateBoss();
    updatePowerUps();
    updateParticles();
    checkCollisions();

    drawBackground();
    drawPlayer();
    drawBullets();
    drawEnemies();
    drawBoss();
    drawPowerUps();
    drawParticles();

    requestAnimationFrame(gameLoop);
}

// ATUALIZAÇÕES COM FÍSICA INDEPENDENTE DE FPS
function updateBackground() {
    stars.forEach(s => {
        s.y += s.speed * dt;
        if (s.y > canvas.height) s.y = 0;
    });
}

function updatePlayer() {
    if (isTouching && targetTouchX !== null && targetTouchY !== null) {
        player.x += (targetTouchX - player.x) * (15 * dt);
        player.y += (targetTouchY - player.y) * (15 * dt);
    }

    if (keys.left) player.x -= player.speed * dt;
    if (keys.right) player.x += player.speed * dt;
    if (keys.up) player.y -= player.speed * dt;
    if (keys.down) player.y += player.speed * dt;

    player.x = Math.max(0, Math.min(canvas.width - player.width, player.x));
    player.y = Math.max(0, Math.min(canvas.height - player.height, player.y));

    // Tiro Automático Adaptativo por Nível de Upgrade
    shotTimer += dt;
    const fireInterval = player.weaponLevel === 4 ? 0.09 : 0.13;

    if (shotTimer >= fireInterval) {
        fireWeapon();
        shotTimer = 0;
    }
}

function fireWeapon() {
    const pX = player.x + player.width / 2;
    const pY = player.y;

    if (player.weaponLevel === 1) {
        bullets.push({ x: pX - 8, y: pY, vx: 0, vy: -600, w: 4, h: 12, color: '#38bdf8' });
        bullets.push({ x: pX + 4, y: pY, vx: 0, vy: -600, w: 4, h: 12, color: '#38bdf8' });
    } else if (player.weaponLevel === 2) {
        bullets.push({ x: pX - 10, y: pY, vx: -80, vy: -580, w: 4, h: 12, color: '#38bdf8' });
        bullets.push({ x: pX - 2, y: pY, vx: 0, vy: -600, w: 4, h: 12, color: '#38bdf8' });
        bullets.push({ x: pX + 6, y: pY, vx: 80, vy: -580, w: 4, h: 12, color: '#38bdf8' });
    } else if (player.weaponLevel === 3) {
        bullets.push({ x: pX - 12, y: pY, vx: -120, vy: -560, w: 5, h: 14, color: '#f59e0b' });
        bullets.push({ x: pX - 4, y: pY, vx: -40, vy: -600, w: 5, h: 14, color: '#f59e0b' });
        bullets.push({ x: pX + 4, y: pY, vx: 40, vy: -600, w: 5, h: 14, color: '#f59e0b' });
        bullets.push({ x: pX + 12, y: pY, vx: 120, vy: -560, w: 5, h: 14, color: '#f59e0b' });
    } else { // Nível 4 (Plasma)
        bullets.push({ x: pX - 16, y: pY, vx: -160, vy: -620, w: 6, h: 16, color: '#a855f7' });
        bullets.push({ x: pX - 6, y: pY, vx: 0, vy: -650, w: 8, h: 18, color: '#ec4899' });
        bullets.push({ x: pX + 2, y: pY, vx: 0, vy: -650, w: 8, h: 18, color: '#ec4899' });
        bullets.push({ x: pX + 10, y: pY, vx: 160, vy: -620, w: 6, h: 16, color: '#a855f7' });
    }
}

function updateBullets() {
    bullets.forEach((b, i) => {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.y < -20 || b.x < -20 || b.x > canvas.width + 20) bullets.splice(i, 1);
    });

    enemyBullets.forEach((eb, i) => {
        eb.x += eb.vx * dt;
        eb.y += eb.vy * dt;
        if (eb.y > canvas.height + 20 || eb.x < -20 || eb.x > canvas.width + 20) enemyBullets.splice(i, 1);
    });
}

function spawnEnemies() {
    if (!boss && Math.random() < 0.03) {
        enemies.push({
            x: Math.random() * (canvas.width - 32),
            y: -40,
            width: 32,
            height: 32,
            speed: Math.random() * 80 + 100,
            hp: 3
        });
    }

    if (score >= 1200 && !boss) {
        boss = {
            x: canvas.width / 2 - 60,
            y: -100,
            width: 120,
            height: 70,
            hp: 120,
            maxHp: 120,
            dx: 120
        };
    }
}

function updateEnemies() {
    enemies.forEach((e, i) => {
        e.y += e.speed * dt;
        if (Math.random() < 0.01) {
            enemyBullets.push({ x: e.x + e.width / 2, y: e.y + e.height, vx: 0, vy: 220 });
        }
        if (e.y > canvas.height + 40) enemies.splice(i, 1);
    });
}

function updateBoss() {
    if (!boss) return;

    if (boss.y < 45) boss.y += 40 * dt;
    else {
        boss.x += boss.dx * dt;
        if (boss.x <= 0 || boss.x >= canvas.width - boss.width) boss.dx *= -1;

        if (Math.random() < 0.04) {
            for (let angle = -0.6; angle <= 0.6; angle += 0.3) {
                enemyBullets.push({
                    x: boss.x + boss.width / 2,
                    y: boss.y + boss.height,
                    vx: angle * 180,
                    vy: 200
                });
            }
        }
    }
}

// Power-Ups (Upgrades em Queda)
function spawnPowerUp(x, y) {
    if (Math.random() < 0.25) { // 25% de chance
        const types = ['P', 'P', 'S', 'B']; // P maior probabilidade
        const type = types[Math.floor(Math.random() * types.length)];
        powerUps.push({ x, y, type, speed: 90 });
    }
}

function updatePowerUps() {
    powerUps.forEach((p, i) => {
        p.y += p.speed * dt;

        // Coleta do Power-Up
        if (p.x < player.x + player.width && p.x + 20 > player.x &&
            p.y < player.y + player.height && p.y + 20 > player.y) {
            
            if (p.type === 'P' && player.weaponLevel < 4) player.weaponLevel++;
            if (p.type === 'S') player.hasShield = true;
            if (p.type === 'B') { // Bomb: Limpa a tela
                enemies.forEach(e => createExplosion(e.x + e.width / 2, e.y + e.height / 2, '#10b981'));
                enemies = [];
                enemyBullets = [];
                score += 150;
                scoreVal.textContent = score;
            }

            createExplosion(p.x, p.y, '#3b82f6');
            powerUps.splice(i, 1);
        } else if (p.y > canvas.height + 20) {
            powerUps.splice(i, 1);
        }
    });
}

function createExplosion(x, y, color = '#f59e0b') {
    for (let i = 0; i < 16; i++) {
        particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 300,
            vy: (Math.random() - 0.5) * 300,
            size: Math.random() * 4 + 2,
            color,
            life: 0.35
        });
    }
}

function updateParticles() {
    particles.forEach((p, i) => {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
    });
}

function checkCollisions() {
    bullets.forEach((b, bi) => {
        enemies.forEach((e, ei) => {
            if (b.x < e.x + e.width && b.x + b.w > e.x && b.y < e.y + e.height && b.y + b.h > e.y) {
                e.hp--;
                bullets.splice(bi, 1);
                if (e.hp <= 0) {
                    createExplosion(e.x + e.width / 2, e.y + e.height / 2, '#10b981');
                    spawnPowerUp(e.x + e.width / 2, e.y + e.height / 2);
                    enemies.splice(ei, 1);
                    score += 50;
                    scoreVal.textContent = score;
                }
            }
        });

        if (boss && b.x < boss.x + boss.width && b.x + b.w > boss.x && b.y < boss.y + boss.height && b.y + b.h > boss.y) {
            boss.hp--;
            bullets.splice(bi, 1);
            createExplosion(b.x, b.y, '#3b82f6');
            if (boss.hp <= 0) {
                createExplosion(boss.x + boss.width / 2, boss.y + boss.height / 2, '#ef4444');
                score += 500;
                scoreVal.textContent = score;
                boss = null;
                setTimeout(() => gameOver(true), 800);
            }
        }
    });

    enemyBullets.forEach((eb, ebi) => {
        if (eb.x > player.x && eb.x < player.x + player.width && eb.y > player.y && eb.y < player.y + player.height) {
            enemyBullets.splice(ebi, 1);
            hitPlayer();
        }
    });

    enemies.forEach((e, ei) => {
        if (player.x < e.x + e.width && player.x + player.width > e.x && player.y < e.y + e.height && player.y + player.height > e.y) {
            enemies.splice(ei, 1);
            hitPlayer();
        }
    });
}

function hitPlayer() {
    if (player.hasShield) {
        player.hasShield = false;
        createExplosion(player.x + player.width / 2, player.y + player.height / 2, '#38bdf8');
        return;
    }

    lives--;
    livesVal.textContent = lives;
    if (player.weaponLevel > 1) player.weaponLevel--; // Reduz nível de arma ao tomar dano
    createExplosion(player.x + player.width / 2, player.y + player.height / 2, '#ef4444');
    
    if (lives <= 0) gameOver(false);
}

// RENDERIZAÇÃO
function drawBackground() {
    ctx.fillStyle = '#ffffff';
    stars.forEach(s => ctx.fillRect(s.x, s.y, s.size, s.size));
}

function drawPlayer() {
    // Escudo Energético (Se Ativo)
    if (player.hasShield) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(player.x + player.width / 2, player.y + player.height / 2, 26, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Nave Delta
    ctx.fillStyle = '#2563eb';
    ctx.beginPath();
    ctx.moveTo(player.x + player.width / 2, player.y);
    ctx.lineTo(player.x + player.width, player.y + player.height);
    ctx.lineTo(player.x + player.width / 2, player.y + player.height - 8);
    ctx.lineTo(player.x, player.y + player.height);
    ctx.closePath();
    ctx.fill();

    // Cockpit
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(player.x + player.width / 2 - 3, player.y + 10, 6, 12);

    // Propulsor
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(player.x + player.width / 2 - 4, player.y + player.height - 2, 8, 8 + Math.random() * 4);
}

function drawBullets() {
    bullets.forEach(b => {
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x, b.y, b.w, b.h);
    });

    ctx.fillStyle = '#ef4444';
    enemyBullets.forEach(eb => ctx.fillRect(eb.x - 2, eb.y, 5, 5));
}

function drawEnemies() {
    ctx.fillStyle = '#10b981';
    enemies.forEach(e => {
        ctx.beginPath();
        ctx.moveTo(e.x + e.width / 2, e.y + e.height);
        ctx.lineTo(e.x + e.width, e.y);
        ctx.lineTo(e.x, e.y);
        ctx.closePath();
        ctx.fill();
    });
}

function drawBoss() {
    if (!boss) return;
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(boss.x, boss.y, boss.width, boss.height);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(boss.x, boss.y - 14, boss.width, 8);
    ctx.fillStyle = '#10b981';
    ctx.fillRect(boss.x, boss.y - 14, (boss.hp / boss.maxHp) * boss.width, 8);
}

function drawPowerUps() {
    powerUps.forEach(p => {
        ctx.fillStyle = p.type === 'P' ? '#3b82f6' : (p.type === 'S' ? '#38bdf8' : '#ef4444');
        ctx.fillRect(p.x - 10, p.y - 10, 20, 20);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.type, p.x, p.y);
    });
}

function drawParticles() {
    particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
    });
}
