const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Elementos da UI
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

// Estado do Jogo
let gameActive = false;
let score = 0;
let lives = 3;
let frameCount = 0;

// Estado dos Controles Teclado (Desktop)
const keys = { left: false, right: false, up: false, down: false };

// Estado de Controle Touch (Arraste)
let isTouching = false;
let targetTouchX = null;
let targetTouchY = null;

// Fundo Estrelado
const stars = Array.from({ length: 60 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    size: Math.random() * 2 + 0.5,
    speed: Math.random() * 3 + 1
}));

// Nave do Jogador
const player = {
    x: canvas.width / 2 - 16,
    y: canvas.height - 90,
    width: 32,
    height: 38,
    speed: 5,
    lastShot: 0
};

let bullets = [];
let enemyBullets = [];
let enemies = [];
let particles = [];
let boss = null;

// Eventos de Teclado (Desktop)
window.addEventListener('keydown', e => handleKey(e, true));
window.addEventListener('keyup', e => handleKey(e, false));

function handleKey(e, isPressed) {
    if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = isPressed;
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = isPressed;
    if (e.key === 'ArrowUp' || e.key === 'w') keys.up = isPressed;
    if (e.key === 'ArrowDown' || e.key === 's') keys.down = isPressed;
}

// EVENTOS TOUCH DE ARRASTE (Mobile)
canvas.addEventListener('touchstart', handleTouchMove, { passive: false });
canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
canvas.addEventListener('touchend', () => { isTouching = false; });

function handleTouchMove(e) {
    e.preventDefault();
    if (!gameActive) return;

    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];

    // Calcula a posição do toque relativa ao tamanho do Canvas
    targetTouchX = (touch.clientX - rect.left) * (canvas.width / rect.width) - player.width / 2;
    targetTouchY = (touch.clientY - rect.top) * (canvas.height / rect.height) - player.height / 2;
    isTouching = true;
}

// Início / Restart / Ranking
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
    boss = null;
    player.x = canvas.width / 2 - 16;
    player.y = canvas.height - 90;

    scoreVal.textContent = score;
    livesVal.textContent = lives;

    overlayStart.style.display = 'none';
    overlayGameOver.style.display = 'none';
    gameActive = true;
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

// Sistema de Ranking (LocalStorage)
function getLeaderboard() {
    return JSON.parse(localStorage.getItem('megahit_aerofighters_ranks') || '[]');
}

function saveRankingScore() {
    const nick = playerNickInput.value.trim() || 'Piloto Anônimo';
    const ranks = getLeaderboard();

    ranks.push({ nick, score });
    ranks.sort((a, b) => b.score - a.score);
    const top10 = ranks.slice(0, 10);

    localStorage.setItem('megahit_aerofighters_ranks', JSON.stringify(top10));
    document.getElementById('nick-form').style.display = 'none';
    renderLeaderboard();
}

function renderLeaderboard() {
    const ranks = getLeaderboard();
    leaderboardList.innerHTML = '';

    if (ranks.length === 0) {
        leaderboardList.innerHTML = '<li>Nenhum registro ainda.</li>';
        return;
    }

    ranks.forEach(item => {
        const li = document.createElement('li');
        li.innerHTML = `<strong>${item.nick}</strong>: ${item.score} pts`;
        leaderboardList.appendChild(li);
    });
}

// Loop Principal
function gameLoop() {
    if (!gameActive) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    updateBackground();
    updatePlayer();
    updateBullets();
    spawnEnemies();
    updateEnemies();
    updateBoss();
    updateParticles();
    checkCollisions();

    drawBackground();
    drawPlayer();
    drawBullets();
    drawEnemies();
    drawBoss();
    drawParticles();

    frameCount++;
    requestAnimationFrame(gameLoop);
}

// Lógica de Movimentação do Jogador
function updatePlayer() {
    // 1. Movimentação via Touch (Arraste)
    if (isTouching && targetTouchX !== null && targetTouchY !== null) {
        // Interpolação (Lerp) para a nave seguir o dedo de forma suave
        player.x += (targetTouchX - player.x) * 0.2;
        player.y += (targetTouchY - player.y) * 0.2;
    }

    // 2. Movimentação via Teclado (Desktop)
    if (keys.left && player.x > 0) player.x -= player.speed;
    if (keys.right && player.x < canvas.width - player.width) player.x += player.speed;
    if (keys.up && player.y > 0) player.y -= player.speed;
    if (keys.down && player.y < canvas.height - player.height) player.y += player.speed;

    // Trava de limites da tela
    player.x = Math.max(0, Math.min(canvas.width - player.width, player.x));
    player.y = Math.max(0, Math.min(canvas.height - player.height, player.y));

    // TIRO AUTOMÁTICO
    if (frameCount - player.lastShot > 8) {
        bullets.push({ x: player.x + 6, y: player.y, speed: 10 });
        bullets.push({ x: player.x + player.width - 10, y: player.y, speed: 10 });
        player.lastShot = frameCount;
    }
}

function updateBackground() {
    stars.forEach(s => {
        s.y += s.speed;
        if (s.y > canvas.height) s.y = 0;
    });
}

function updateBullets() {
    bullets.forEach((b, i) => {
        b.y -= b.speed;
        if (b.y < 0) bullets.splice(i, 1);
    });

    enemyBullets.forEach((eb, i) => {
        eb.x += eb.vx || 0;
        eb.y += eb.vy || 4;
        if (eb.y > canvas.height || eb.x < 0 || eb.x > canvas.width) enemyBullets.splice(i, 1);
    });
}

function spawnEnemies() {
    if (!boss && frameCount % 45 === 0) {
        enemies.push({
            x: Math.random() * (canvas.width - 32),
            y: -35,
            width: 32,
            height: 32,
            speed: Math.random() * 2 + 2,
            hp: 3
        });
    }

    if (score >= 1000 && !boss) {
        boss = {
            x: canvas.width / 2 - 60,
            y: -100,
            width: 120,
            height: 70,
            hp: 100,
            maxHp: 100,
            dx: 2.5
        };
    }
}

function updateEnemies() {
    enemies.forEach((e, i) => {
        e.y += e.speed;
        if (Math.random() < 0.015) {
            enemyBullets.push({ x: e.x + e.width / 2, y: e.y + e.height });
        }
        if (e.y > canvas.height) enemies.splice(i, 1);
    });
}

function updateBoss() {
    if (!boss) return;

    if (boss.y < 45) boss.y += 1.5;
    else {
        boss.x += boss.dx;
        if (boss.x <= 0 || boss.x >= canvas.width - boss.width) boss.dx *= -1;

        if (frameCount % 35 === 0) {
            for (let angle = -0.6; angle <= 0.6; angle += 0.3) {
                enemyBullets.push({
                    x: boss.x + boss.width / 2,
                    y: boss.y + boss.height,
                    vx: angle * 3,
                    vy: 4
                });
            }
        }
    }
}

function createExplosion(x, y, color = '#f59e0b') {
    for (let i = 0; i < 18; i++) {
        particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 7,
            vy: (Math.random() - 0.5) * 7,
            size: Math.random() * 4 + 2,
            color,
            life: 22
        });
    }
}

function updateParticles() {
    particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        if (p.life <= 0) particles.splice(i, 1);
    });
}

function checkCollisions() {
    bullets.forEach((b, bi) => {
        enemies.forEach((e, ei) => {
            if (b.x < e.x + e.width && b.x + 4 > e.x && b.y < e.y + e.height && b.y + 10 > e.y) {
                e.hp--;
                bullets.splice(bi, 1);
                if (e.hp <= 0) {
                    createExplosion(e.x + e.width / 2, e.y + e.height / 2, '#10b981');
                    enemies.splice(ei, 1);
                    score += 50;
                    scoreVal.textContent = score;
                }
            }
        });

        if (boss && b.x < boss.x + boss.width && b.x + 4 > boss.x && b.y < boss.y + boss.height && b.y + 10 > boss.y) {
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
    lives--;
    livesVal.textContent = lives;
    createExplosion(player.x + player.width / 2, player.y + player.height / 2, '#3b82f6');
    if (lives <= 0) {
        gameOver(false);
    }
}

// Renderização
function drawBackground() {
    ctx.fillStyle = '#ffffff';
    stars.forEach(s => ctx.fillRect(s.x, s.y, s.size, s.size));
}

function drawPlayer() {
    ctx.fillStyle = '#2563eb';
    ctx.beginPath();
    ctx.moveTo(player.x + player.width / 2, player.y);
    ctx.lineTo(player.x + player.width, player.y + player.height);
    ctx.lineTo(player.x + player.width / 2, player.y + player.height - 8);
    ctx.lineTo(player.x, player.y + player.height);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(player.x + player.width / 2 - 3, player.y + 10, 6, 12);

    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(player.x + player.width / 2 - 4, player.y + player.height - 2, 8, 8 + Math.random() * 4);
}

function drawBullets() {
    ctx.fillStyle = '#38bdf8';
    bullets.forEach(b => ctx.fillRect(b.x, b.y, 4, 12));

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

function drawParticles() {
    particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
    });
}
