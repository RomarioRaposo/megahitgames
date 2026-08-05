const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Elementos da UI
const scoreVal = document.getElementById('score-val');
const livesVal = document.getElementById('lives-val');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayMsg = document.getElementById('overlay-msg');
const startBtn = document.getElementById('start-btn');

// Configurações do Jogo
let gameActive = false;
let score = 0;
let lives = 3;
let frameCount = 0;

// Estado dos Controles
const keys = { left: false, right: false, up: false, down: false, fire: false };

// Fundo Estrelado
const stars = Array.from({ length: 50 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    size: Math.random() * 2 + 1,
    speed: Math.random() * 2 + 1
}));

// Jogador
const player = {
    x: canvas.width / 2 - 15,
    y: canvas.height - 80,
    width: 30,
    height: 35,
    speed: 5,
    powerLevel: 1,
    lastShot: 0
};

let bullets = [];
let enemyBullets = [];
let enemies = [];
let particles = [];
let boss = null;

// Listeners de Teclado (Desktop)
window.addEventListener('keydown', e => handleKey(e, true));
window.addEventListener('keyup', e => handleKey(e, false));

function handleKey(e, isPressed) {
    if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = isPressed;
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = isPressed;
    if (e.key === 'ArrowUp' || e.key === 'w') keys.up = isPressed;
    if (e.key === 'ArrowDown' || e.key === 's') keys.down = isPressed;
    if (e.key === ' ' || e.key === 'j') keys.fire = isPressed;
}

// Listeners Touch (Mobile)
function setupTouchBtn(id, keyName) {
    const btn = document.getElementById(id);
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); keys[keyName] = true; });
    btn.addEventListener('touchend', (e) => { e.preventDefault(); keys[keyName] = false; });
}

setupTouchBtn('btn-left', 'left');
setupTouchBtn('btn-right', 'right');
setupTouchBtn('btn-up', 'up');
setupTouchBtn('btn-down', 'down');
setupTouchBtn('btn-fire', 'fire');

startBtn.addEventListener('click', startGame);

function startGame() {
    score = 0;
    lives = 3;
    bullets = [];
    enemyBullets = [];
    enemies = [];
    particles = [];
    boss = null;
    player.x = canvas.width / 2 - 15;
    player.y = canvas.height - 80;
    
    scoreVal.textContent = score;
    livesVal.textContent = lives;
    
    overlay.style.display = 'none';
    gameActive = true;
    requestAnimationFrame(gameLoop);
}

function gameOver(won = false) {
    gameActive = false;
    overlayTitle.textContent = won ? "VITÓRIA!" : "GAME OVER";
    overlayTitle.style.color = won ? "#10b981" : "#ef4444";
    overlayMsg.textContent = won ? `Parabéns! Você salvou os céus com ${score} pontos!` : `Sua nave foi destruída. Pontuação: ${score}`;
    startBtn.textContent = "JOGAR NOVAMENTE";
    overlay.style.display = 'flex';
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

// Atualizações de Lógica
function updateBackground() {
    stars.forEach(s => {
        s.y += s.speed;
        if (s.y > canvas.height) s.y = 0;
    });
}

function updatePlayer() {
    if (keys.left && player.x > 0) player.x -= player.speed;
    if (keys.right && player.x < canvas.width - player.width) player.x += player.speed;
    if (keys.up && player.y > 0) player.y -= player.speed;
    if (keys.down && player.y < canvas.height - player.height) player.y += player.speed;

    // Tiro
    if (keys.fire && frameCount - player.lastShot > 10) {
        bullets.push({ x: player.x + 5, y: player.y, speed: 8 });
        bullets.push({ x: player.x + player.width - 9, y: player.y, speed: 8 });
        player.lastShot = frameCount;
    }
}

function updateBullets() {
    // Tiros do jogador
    bullets.forEach((b, i) => {
        b.y -= b.speed;
        if (b.y < 0) bullets.splice(i, 1);
    });

    // Tiros inimigos
    enemyBullets.forEach((eb, i) => {
        eb.x += eb.vx || 0;
        eb.y += eb.vy || 4;
        if (eb.y > canvas.height || eb.x < 0 || eb.x > canvas.width) enemyBullets.splice(i, 1);
    });
}

function spawnEnemies() {
    // Inimigos normais
    if (!boss && frameCount % 50 === 0) {
        enemies.push({
            x: Math.random() * (canvas.width - 30),
            y: -30,
            width: 30,
            height: 30,
            speed: Math.random() * 2 + 2,
            hp: 2
        });
    }

    // Boss surge aos 1000 pontos
    if (score >= 1000 && !boss) {
        boss = {
            x: canvas.width / 2 - 60,
            y: -100,
            width: 120,
            height: 80,
            hp: 80,
            maxHp: 80,
            dx: 2
        };
    }
}

function updateEnemies() {
    enemies.forEach((e, i) => {
        e.y += e.speed;

        // Inimigo atira aleatoriamente
        if (Math.random() < 0.01) {
            enemyBullets.push({ x: e.x + e.width / 2, y: e.y + e.height });
        }

        if (e.y > canvas.height) enemies.splice(i, 1);
    });
}

function updateBoss() {
    if (!boss) return;

    // Entrada do Boss
    if (boss.y < 40) boss.y += 1;
    else {
        boss.x += boss.dx;
        if (boss.x <= 0 || boss.x >= canvas.width - boss.width) boss.dx *= -1;

        // Ataque do Boss
        if (frameCount % 40 === 0) {
            for (let angle = -0.5; angle <= 0.5; angle += 0.5) {
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
    for (let i = 0; i < 15; i++) {
        particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6,
            size: Math.random() * 4 + 2,
            color,
            life: 20
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
    // Tiro acertando Inimigo
    bullets.forEach((b, bi) => {
        enemies.forEach((e, ei) => {
            if (b.x < e.x + e.width && b.x + 4 > e.x && b.y < e.y + e.height && b.y + 10 > e.y) {
                e.hp--;
                bullets.splice(bi, 1);
                if (e.hp <= 0) {
                    createExplosion(e.x + e.width / 2, e.y + e.height / 2);
                    enemies.splice(ei, 1);
                    score += 50;
                    scoreVal.textContent = score;
                }
            }
        });

        // Tiro acertando Boss
        if (boss && b.x < boss.x + boss.width && b.x + 4 > boss.x && b.y < boss.y + boss.height && b.y + 10 > boss.y) {
            boss.hp--;
            bullets.splice(bi, 1);
            createExplosion(b.x, b.y, '#ef4444');
            if (boss.hp <= 0) {
                createExplosion(boss.x + boss.width / 2, boss.y + boss.height / 2, '#3b82f6');
                score += 500;
                scoreVal.textContent = score;
                boss = null;
                setTimeout(() => gameOver(true), 1000);
            }
        }
    });

    // Colisão do Jogador com Inimigos ou Tiros
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

// Renderização (Desenho no Canvas)
function drawBackground() {
    ctx.fillStyle = '#ffffff';
    stars.forEach(s => ctx.fillRect(s.x, s.y, s.size, s.size));
}

function drawPlayer() {
    ctx.fillStyle = '#3b82f6'; // Corpo da Nave
    ctx.beginPath();
    ctx.moveTo(player.x + player.width / 2, player.y);
    ctx.lineTo(player.x + player.width, player.y + player.height);
    ctx.lineTo(player.x, player.y + player.height);
    ctx.closePath();
    ctx.fill();

    // Asas/Acentos
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(player.x - 4, player.y + 20, 8, 10);
    ctx.fillRect(player.x + player.width - 4, player.y + 20, 8, 10);
}

function drawBullets() {
    ctx.fillStyle = '#f59e0b';
    bullets.forEach(b => ctx.fillRect(b.x, b.y, 4, 10));

    ctx.fillStyle = '#ef4444';
    enemyBullets.forEach(eb => ctx.fillRect(eb.x - 2, eb.y, 5, 5));
}

function drawEnemies() {
    ctx.fillStyle = '#10b981';
    enemies.forEach(e => {
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.x + e.width, e.y);
        ctx.lineTo(e.x + e.width / 2, e.y + e.height);
        ctx.closePath();
        ctx.fill();
    });
}

function drawBoss() {
    if (!boss) return;

    // Desenho do Boss
    ctx.fillStyle = '#8b5cf6';
    ctx.fillRect(boss.x, boss.y, boss.width, boss.height);

    // Barra de Vida do Boss
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(boss.x, boss.y - 15, boss.width, 8);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(boss.x, boss.y - 15, (boss.hp / boss.maxHp) * boss.width, 8);
}

function drawParticles() {
    particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
    });
}
