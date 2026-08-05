const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI
const scoreVal = document.getElementById('score-val');
const bestVal = document.getElementById('best-val');
const overlayStart = document.getElementById('overlay-start');
const overlayGameOver = document.getElementById('overlay-gameover');
const finalScoreEl = document.getElementById('final-score');
const playerNickInput = document.getElementById('player-nick');
const saveScoreBtn = document.getElementById('save-score-btn');
const leaderboardList = document.getElementById('leaderboard-list');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');

// Credenciais JSONBin.io (Substitua com suas chaves)
const JSONBIN_BIN_ID = "SEU_BIN_ID_NEONFLAP";
const JSONBIN_API_KEY = "SUA_MASTER_KEY_AQUI";
const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;

// Estado do Jogo
let gameActive = false;
let score = 0;
let bestScore = localStorage.getItem('megahit_neonflap_best') || 0;
bestVal.textContent = bestScore;

let lastTime = 0;
let dt = 0;

// Física da Nave Neon
const bird = {
    x: 80,
    y: canvas.height / 2,
    radius: 14,
    velocity: 0,
    gravity: 1200,   // Força da gravidade por segundo
    jumpForce: -380, // Impulso do pulo
    rotation: 0
};

let obstacles = [];
let particles = [];
let spawnTimer = 0;
const spawnInterval = 1.6; // Segundos entre cada obstáculo
const gapSize = 140;        // Abertura entre os tubos neon

// Controles
window.addEventListener('keydown', e => {
    if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        jump();
    }
});

canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    jump();
}, { passive: false });

canvas.addEventListener('mousedown', () => {
    if (gameActive) jump();
});

function jump() {
    if (!gameActive) return;
    bird.velocity = bird.jumpForce;

    // Partículas de impulso
    for (let i = 0; i < 8; i++) {
        particles.push({
            x: bird.x - 10,
            y: bird.y,
            vx: (Math.random() - 0.5) * 80 - 100,
            vy: (Math.random() - 0.5) * 80,
            size: Math.random() * 4 + 2,
            color: '#38bdf8',
            life: 0.3
        });
    }
}

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
saveScoreBtn.addEventListener('click', saveRankingScore);

function startGame() {
    score = 0;
    scoreVal.textContent = score;

    bird.y = canvas.height / 2;
    bird.velocity = 0;
    bird.rotation = 0;

    obstacles = [];
    particles = [];
    spawnTimer = 0;

    overlayStart.style.display = 'none';
    overlayGameOver.style.display = 'none';
    gameActive = true;
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

function gameOver() {
    gameActive = false;
    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('megahit_neonflap_best', bestScore);
        bestVal.textContent = bestScore;
    }

    finalScoreEl.textContent = score;
    overlayGameOver.style.display = 'flex';
    document.getElementById('nick-form').style.display = 'flex';
    renderLeaderboard();
}

// Loop Principal
function gameLoop(now) {
    if (!gameActive) return;

    dt = (now - lastTime) / 1000;
    if (dt > 0.1) dt = 0.1;
    lastTime = now;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    updateBird();
    updateObstacles();
    updateParticles();
    checkCollisions();

    drawBackground();
    drawObstacles();
    drawParticles();
    drawBird();

    requestAnimationFrame(gameLoop);
}

function updateBird() {
    bird.velocity += bird.gravity * dt;
    bird.y += bird.velocity * dt;

    // Rotação suave da nave baseada na velocidade vertical
    bird.rotation = Math.min(Math.PI / 4, Math.max(-Math.PI / 4, bird.velocity * 0.002));
}

function updateObstacles() {
    spawnTimer += dt;
    if (spawnTimer >= spawnInterval) {
        const minHeight = 60;
        const maxHeight = canvas.height - gapSize - minHeight;
        const topHeight = Math.floor(Math.random() * (maxHeight - minHeight + 1)) + minHeight;

        obstacles.push({
            x: canvas.width,
            topHeight: topHeight,
            bottomY: topHeight + gapSize,
            width: 52,
            passed: false,
            color: Math.random() < 0.5 ? '#ec4899' : '#a855f7'
        });

        spawnTimer = 0;
    }

    obstacles.forEach((obs, i) => {
        obs.x -= 160 * dt; // Velocidade de rolamento da tela

        // Incrementa ponto ao passar o obstáculo
        if (!obs.passed && obs.x + obs.width < bird.x) {
            obs.passed = true;
            score++;
            scoreVal.textContent = score;
        }

        if (obs.x + obs.width < -10) obstacles.splice(i, 1);
    });
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
    // Colisão com teto ou chão
    if (bird.y - bird.radius < 0 || bird.y + bird.radius > canvas.height) {
        gameOver();
        return;
    }

    // Colisão com tubos
    obstacles.forEach(obs => {
        if (bird.x + bird.radius > obs.x && bird.x - bird.radius < obs.x + obs.width) {
            if (bird.y - bird.radius < obs.topHeight || bird.y + bird.radius > obs.bottomY) {
                gameOver();
            }
        }
    });
}

// Renderização
function drawBackground() {
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Linhas de Grade Cyberpunk no Fundo
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
}

function drawBird() {
    ctx.save();
    ctx.translate(bird.x, bird.y);
    ctx.rotate(bird.rotation);

    // Brilho Neon Rosa
    ctx.shadowColor = '#ec4899';
    ctx.shadowBlur = 12;

    // Corpo da Nave Triangular
    ctx.fillStyle = '#ec4899';
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-12, -10);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-12, 10);
    ctx.closePath();
    ctx.fill();

    // Núcleo Ciano
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function drawObstacles() {
    obstacles.forEach(obs => {
        ctx.save();
        ctx.shadowColor = obs.color;
        ctx.shadowBlur = 10;
        ctx.fillStyle = obs.color;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;

        // Obstáculo Superior
        ctx.fillRect(obs.x, 0, obs.width, obs.topHeight);
        ctx.strokeRect(obs.x, 0, obs.width, obs.topHeight);

        // Obstáculo Inferior
        const bottomHeight = canvas.height - obs.bottomY;
        ctx.fillRect(obs.x, obs.bottomY, obs.width, bottomHeight);
        ctx.strokeRect(obs.x, obs.bottomY, obs.width, bottomHeight);

        ctx.restore();
    });
}

function drawParticles() {
    particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
    });
}

// Ranking API (JSONBin)
async function renderLeaderboard() {
    leaderboardList.innerHTML = '<li>Carregando...</li>';
    try {
        const res = await fetch(`${JSONBIN_URL}/latest`, { headers: { 'X-Master-Key': JSONBIN_API_KEY } });
        if (!res.ok) throw new Error();
        const data = await res.json();
        const ranks = data.record || [];

        leaderboardList.innerHTML = ranks.length === 0 ? '<li>Sem registros.</li>' : '';
        ranks.forEach((item, index) => {
            const li = document.createElement('li');
            li.innerHTML = `<strong>#${index + 1} ${item.nick}</strong>: ${item.score} pts`;
            leaderboardList.appendChild(li);
        });
    } catch {
        leaderboardList.innerHTML = '<li>Ranking local ativo.</li>';
    }
}

async function saveRankingScore() {
    const nick = playerNickInput.value.trim() || 'Piloto Neon';
    saveScoreBtn.disabled = true;

    try {
        const res = await fetch(`${JSONBIN_URL}/latest`, { headers: { 'X-Master-Key': JSONBIN_API_KEY } });
        const data = await res.json();
        let ranks = data.record || [];

        ranks.push({ nick, score });
        ranks.sort((a, b) => b.score - a.score);
        ranks = ranks.slice(0, 10);

        await fetch(JSONBIN_URL, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'X-Master-Key': JSONBIN_API_KEY },
            body: JSON.stringify(ranks)
        });

        document.getElementById('nick-form').style.display = 'none';
        renderLeaderboard();
    } catch {
        alert("Pontuação registrada localmente!");
    } finally {
        saveScoreBtn.disabled = false;
    }
}
