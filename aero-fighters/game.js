import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push, set, get, query, orderByChild, limitToLast } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// Credenciais Reais do Firebase - MegaHit Games
const firebaseConfig = {
  apiKey: "AIzaSyCvhEL3kMRMYhPK55tcICbLsWFHd45WgB8",
  authDomain: "megahit-games.firebaseapp.com",
  databaseURL: "https://megahit-games-default-rtdb.firebaseio.com",
  projectId: "megahit-games",
  storageBucket: "megahit-games.firebasestorage.app",
  messagingSenderId: "595034446210",
  appId: "1:595034446210:web:01f430b992d529988cd79b"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// UI Elements
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

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

// Estado Geral
let gameActive = false;
let score = 0;
let lives = 3;
let currentStage = 1;
const TOTAL_STAGES = 10;
let stageKills = 0;
let killsToBoss = 12;
let bossSpawned = false;
let stageBannerTimer = 0;

let lastTime = 0;
let shotTimer = 0;
let dt = 0;

// Controles
const keys = { left: false, right: false, up: false, down: false };
let isTouching = false;
let targetTouchX = null;
let targetTouchY = null;

// Temas Visuais por Fase
const STAGE_THEMES = [
    { bg: '#020617', star: '#ffffff' },
    { bg: '#0f172a', star: '#38bdf8' },
    { bg: '#1e1b4b', star: '#a855f7' },
    { bg: '#31121f', star: '#f43f5e' },
    { bg: '#064e3b', star: '#34d399' },
    { bg: '#172554', star: '#60a5fa' },
    { bg: '#451a03', star: '#fbbf24' },
    { bg: '#2e1065', star: '#c084fc' },
    { bg: '#111827', star: '#9ca3af' },
    { bg: '#4c0519', star: '#fda4af' }
];

const stars = Array.from({ length: 70 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    size: Math.random() * 2 + 0.5,
    speed: Math.random() * 120 + 40
}));

const player = {
    x: canvas.width / 2 - 16,
    y: canvas.height - 90,
    width: 32,
    height: 38,
    speed: 340,
    weaponLevel: 1,
    hasShield: false
};

let bullets = [];
let enemyBullets = [];
let enemies = [];
let particles = [];
let powerUps = [];
let boss = null;

// Eventos de Teclado e Touch
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

    const touchX = (touch.clientX - rect.left) * (canvas.width / rect.width);
    const touchY = (touch.clientY - rect.top) * (canvas.height / rect.height);

    targetTouchX = touchX - player.width / 2;
    const FINGER_OFFSET_Y = 90;
    targetTouchY = touchY - player.height / 2 - FINGER_OFFSET_Y;

    isTouching = true;
}

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
saveScoreBtn.addEventListener('click', saveRankingScore);

function startGame() {
    score = 0;
    lives = 3;
    currentStage = 1;
    resetStageState();

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

function resetStageState() {
    stageKills = 0;
    killsToBoss = 10 + currentStage * 4;
    bossSpawned = false;
    boss = null;
    enemies = [];
    enemyBullets = [];
    bullets = [];
    powerUps = [];
    stageBannerTimer = 3.0;
}

function nextStage() {
    if (currentStage >= TOTAL_STAGES) {
        gameOver(true);
        return;
    }

    currentStage++;
    resetStageState();
}

function gameOver(won = false) {
    gameActive = false;
    gameoverTitle.textContent = won ? "ZEROU O JOGO!" : "GAME OVER";
    gameoverTitle.style.color = won ? "#10b981" : "#ef4444";
    finalScoreEl.textContent = score;

    overlayGameOver.style.display = 'flex';
    document.getElementById('nick-form').style.display = 'flex';
    saveScoreBtn.disabled = false;
    saveScoreBtn.textContent = 'SALVAR NO RANKING';

    renderLeaderboard();
}

// Loop Principal
function gameLoop(now) {
    if (!gameActive) return;

    dt = (now - lastTime) / 1000;
    if (dt > 0.1) dt = 0.1;
    lastTime = now;

    if (stageBannerTimer > 0) stageBannerTimer -= dt;

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
    drawHUDOverlay();

    requestAnimationFrame(gameLoop);
}

function updateBackground() {
    stars.forEach(s => {
        s.y += (s.speed + currentStage * 10) * dt;
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

    shotTimer += dt;
    const fireInterval = player.weaponLevel === 4 ? 0.08 : 0.12;

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
    } else {
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
    if (stageBannerTimer > 0) return;

    if (!bossSpawned && stageKills < killsToBoss && Math.random() < 0.02 + currentStage * 0.005) {
        enemies.push({
            x: Math.random() * (canvas.width - 32),
            y: -40,
            width: 32,
            height: 32,
            speed: Math.random() * 60 + (80 + currentStage * 15),
            hp: 2 + Math.floor(currentStage / 2)
        });
    }

    if (stageKills >= killsToBoss && !bossSpawned) {
        bossSpawned = true;
        boss = {
            x: canvas.width / 2 - 60,
            y: -100,
            width: 120 + currentStage * 4,
            height: 70 + currentStage * 2,
            hp: 80 + currentStage * 40,
            maxHp: 80 + currentStage * 40,
            dx: 100 + currentStage * 15
        };
    }
}

function updateEnemies() {
    enemies.forEach((e, i) => {
        e.y += e.speed * dt;
        if (Math.random() < 0.008 + currentStage * 0.003) {
            enemyBullets.push({ x: e.x + e.width / 2, y: e.y + e.height, vx: 0, vy: 200 + currentStage * 20 });
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

        if (Math.random() < 0.03 + currentStage * 0.005) {
            const spread = 0.3 + currentStage * 0.05;
            for (let angle = -spread; angle <= spread; angle += 0.2) {
                enemyBullets.push({
                    x: boss.x + boss.width / 2,
                    y: boss.y + boss.height,
                    vx: angle * 180,
                    vy: 190 + currentStage * 15
                });
            }
        }
    }
}

function spawnPowerUp(x, y) {
    if (Math.random() < 0.3) {
        const types = ['P', 'P', 'S', 'B', 'H'];
        const type = types[Math.floor(Math.random() * types.length)];
        powerUps.push({ x, y, type, speed: 90 });
    }
}

function updatePowerUps() {
    powerUps.forEach((p, i) => {
        p.y += p.speed * dt;

        if (p.x < player.x + player.width && p.x + 20 > player.x &&
            p.y < player.y + player.height && p.y + 20 > player.y) {

            if (p.type === 'P' && player.weaponLevel < 4) player.weaponLevel++;
            if (p.type === 'S') player.hasShield = true;
            if (p.type === 'H') {
                if (lives < 5) {
                    lives++;
                    livesVal.textContent = lives;
                }
            }
            if (p.type === 'B') {
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
                    stageKills++;
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
                score += 500 * currentStage;
                scoreVal.textContent = score;
                boss = null;
                setTimeout(() => nextStage(), 800);
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
    if (player.weaponLevel > 1) player.weaponLevel--;
    createExplosion(player.x + player.width / 2, player.y + player.height / 2, '#ef4444');

    if (lives <= 0) gameOver(false);
}

// Renderização
function drawBackground() {
    const theme = STAGE_THEMES[(currentStage - 1) % STAGE_THEMES.length];
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = theme.star;
    stars.forEach(s => ctx.fillRect(s.x, s.y, s.size, s.size));
}

function drawPlayer() {
    ctx.save();

    if (player.hasShield) {
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 15;
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(player.x + player.width / 2, player.y + player.height / 2, 28, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    const px = player.x;
    const py = player.y;
    const pw = player.width;
    const ph = player.height;

    const flameHeight = 10 + Math.random() * 6;
    const flameGrad = ctx.createLinearGradient(0, py + ph - 4, 0, py + ph + flameHeight);
    flameGrad.addColorStop(0, '#f59e0b');
    flameGrad.addColorStop(0.5, '#ef4444');
    flameGrad.addColorStop(1, 'transparent');
    
    ctx.fillStyle = flameGrad;
    ctx.fillRect(px + pw / 2 - 5, py + ph - 4, 4, flameHeight);
    ctx.fillRect(px + pw / 2 + 1, py + ph - 4, 4, flameHeight);

    const bodyGrad = ctx.createLinearGradient(px, py, px + pw, py + ph);
    bodyGrad.addColorStop(0, '#3b82f6');
    bodyGrad.addColorStop(0.5, '#1d4ed8');
    bodyGrad.addColorStop(1, '#1e40af');

    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.moveTo(px + pw / 2, py);
    ctx.lineTo(px + pw + 6, py + ph - 8);
    ctx.lineTo(px + pw - 2, py + ph);
    ctx.lineTo(px + pw / 2, py + ph - 6);
    ctx.lineTo(px + 2, py + ph);
    ctx.lineTo(px - 6, py + ph - 8);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#60a5fa';
    ctx.fillRect(px - 4, py + ph - 12, 6, 2);
    ctx.fillRect(px + pw - 2, py + ph - 12, 6, 2);

    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 8;
    const glassGrad = ctx.createLinearGradient(px, py + 8, px, py + 22);
    glassGrad.addColorStop(0, '#e0f2fe');
    glassGrad.addColorStop(1, '#0284c7');
    
    ctx.fillStyle = glassGrad;
    ctx.beginPath();
    ctx.ellipse(px + pw / 2, py + 16, 4, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    const weaponColor = player.weaponLevel === 4 ? '#a855f7' : (player.weaponLevel >= 3 ? '#f59e0b' : '#38bdf8');
    ctx.fillStyle = weaponColor;
    ctx.fillRect(px - 2, py + 12, 3, 10);
    ctx.fillRect(px + pw - 1, py + 12, 3, 10);

    ctx.restore();
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
    enemies.forEach(e => {
        ctx.save();
        const ex = e.x;
        const ey = e.y;
        const ew = e.width;
        const eh = e.height;

        const enemyGrad = ctx.createLinearGradient(ex, ey, ex + ew, ey + eh);
        enemyGrad.addColorStop(0, '#334155');
        enemyGrad.addColorStop(0.5, '#0f172a');
        enemyGrad.addColorStop(1, '#020617');

        ctx.fillStyle = enemyGrad;
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        ctx.moveTo(ex + ew / 2, ey + eh);
        ctx.lineTo(ex + ew + 4, ey + 4);
        ctx.lineTo(ex + ew / 2, ey);
        ctx.lineTo(ex - 4, ey + 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.shadowColor = '#10b981';
        ctx.shadowBlur = 6;
        ctx.fillStyle = '#34d399';
        ctx.beginPath();
        ctx.arc(ex + ew / 2, ey + eh / 2, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    });
}

function drawBoss() {
    if (!boss) return;

    ctx.save();
    const bx = boss.x;
    const by = boss.y;
    const bw = boss.width;
    const bh = boss.height;

    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 12;

    const bossGrad = ctx.createLinearGradient(bx, by, bx, by + bh);
    bossGrad.addColorStop(0, '#450a0a');
    bossGrad.addColorStop(0.5, '#7f1d1d');
    bossGrad.addColorStop(1, '#18181b');

    ctx.fillStyle = bossGrad;
    ctx.strokeStyle = '#f87171';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(bx + bw / 2, by + bh);
    ctx.lineTo(bx + bw + 15, by + bh - 20);
    ctx.lineTo(bx + bw, by);
    ctx.lineTo(bx + bw / 2, by + 10);
    ctx.lineTo(bx, by);
    ctx.lineTo(bx - 15, by + bh - 20);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#dc2626';
    ctx.fillRect(bx + 10, by + bh - 5, 8, 12);
    ctx.fillRect(bx + bw - 18, by + bh - 5, 8, 12);

    ctx.shadowColor = '#f43f5e';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#fb7185';
    ctx.beginPath();
    ctx.arc(bx + bw / 2, by + bh / 2 - 5, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    const barWidth = bw + 20;
    const barX = bx - 10;
    const barY = by - 18;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
    ctx.fillRect(barX, barY, barWidth, 10);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, 10);

    const hpRatio = Math.max(0, boss.hp / boss.maxHp);
    const hpGrad = ctx.createLinearGradient(barX, 0, barX + barWidth, 0);
    hpGrad.addColorStop(0, '#ef4444');
    hpGrad.addColorStop(1, '#f59e0b');

    ctx.fillStyle = hpGrad;
    ctx.fillRect(barX + 1, barY + 1, (barWidth - 2) * hpRatio, 8);

    ctx.restore();
}

function drawPowerUps() {
    powerUps.forEach(p => {
        ctx.fillStyle = p.type === 'P' ? '#3b82f6' : (p.type === 'S' ? '#38bdf8' : (p.type === 'H' ? '#10b981' : '#ef4444'));
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

function drawHUDOverlay() {
    if (stageBannerTimer > 0) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(0, canvas.height / 2 - 45, canvas.width, 90);

        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 22px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`FASE ${currentStage} DE ${TOTAL_STAGES}`, canvas.width / 2, canvas.height / 2 - 5);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '14px sans-serif';
        ctx.fillText(`Destrua ${killsToBoss} naves inimigas para invocar o Boss`, canvas.width / 2, canvas.height / 2 + 22);
    }
}

// ==========================================
// RANKING GLOBAL & LOCAL FALLBACK
// ==========================================

function getLocalLeaderboard() {
    return JSON.parse(localStorage.getItem('megahit_aerofighters_ranks') || '[]');
}

function saveLocalLeaderboard(nick, score) {
    let ranks = getLocalLeaderboard();
    ranks.push({ nick, score });
    ranks.sort((a, b) => b.score - a.score);
    ranks = ranks.slice(0, 10);
    localStorage.setItem('megahit_aerofighters_ranks', JSON.stringify(ranks));
    return ranks;
}

function renderListUI(ranks) {
    leaderboardList.innerHTML = '';
    if (!ranks || ranks.length === 0) {
        leaderboardList.innerHTML = '<li>Seja o primeiro a pontuar!</li>';
        return;
    }
    ranks.forEach((item, index) => {
        const li = document.createElement('li');
        li.innerHTML = `<strong>#${index + 1} ${item.nick}</strong>: ${item.score} pts`;
        leaderboardList.appendChild(li);
    });
}

async function renderLeaderboard() {
    leaderboardList.innerHTML = '<li>Carregando ranking...</li>';

    try {
        const scoresRef = ref(db, 'rankings/aerofighters');
        const topScoresQuery = query(scoresRef, orderByChild('score'), limitToLast(10));
        const snapshot = await get(topScoresQuery);

        if (snapshot.exists()) {
            const data = snapshot.val();
            const list = Object.values(data).sort((a, b) => b.score - a.score);
            renderListUI(list);
        } else {
            renderListUI([]);
        }
    } catch (err) {
        console.warn("Firebase offline/bloqueado. Carregando ranking local:", err);
        renderListUI(getLocalLeaderboard());
    }
}

async function saveRankingScore() {
    const nick = playerNickInput.value.trim() || 'Piloto';
    saveScoreBtn.disabled = true;
    saveScoreBtn.textContent = 'SALVANDO...';

    try {
        const scoresRef = ref(db, 'rankings/aerofighters');
        const newScoreRef = push(scoresRef);

        await set(newScoreRef, {
            nick: nick,
            score: score,
            timestamp: Date.now()
        });

        saveLocalLeaderboard(nick, score);
        document.getElementById('nick-form').style.display = 'none';
        renderLeaderboard();
    } catch (err) {
        console.warn("Erro ao salvar no Firebase. Salvando localmente:", err);
        const localRanks = saveLocalLeaderboard(nick, score);
        document.getElementById('nick-form').style.display = 'none';
        renderListUI(localRanks);
    }
}
