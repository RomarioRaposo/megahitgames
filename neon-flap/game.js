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

// Elementos UI
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

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

// Estado
let gameActive = false;
let score = 0;
let bestScore = localStorage.getItem('megahit_neonflap_best') || 0;
bestVal.textContent = bestScore;

let lastTime = 0;
let dt = 0;

// Nave Neon
const bird = {
    x: 80,
    y: canvas.height / 2,
    radius: 14,
    velocity: 0,
    gravity: 1200,
    jumpForce: -380,
    rotation: 0
};

let obstacles = [];
let particles = [];
let spawnTimer = 0;
const spawnInterval = 1.6;
const gapSize = 140;

// Controles (Desktop / Touch)
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
    saveScoreBtn.disabled = false;
    saveScoreBtn.textContent = 'SALVAR NO RANKING';

    renderLeaderboard();
}

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
        obs.x -= 160 * dt;

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
    if (bird.y - bird.radius < 0 || bird.y + bird.radius > canvas.height) {
        gameOver();
        return;
    }

    obstacles.forEach(obs => {
        if (bird.x + bird.radius > obs.x && bird.x - bird.radius < obs.x + obs.width) {
            if (bird.y - bird.radius < obs.topHeight || bird.y + bird.radius > obs.bottomY) {
                gameOver();
            }
        }
    });
}

function drawBackground() {
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

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

    ctx.shadowColor = '#ec4899';
    ctx.shadowBlur = 12;

    ctx.fillStyle = '#ec4899';
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-12, -10);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-12, 10);
    ctx.closePath();
    ctx.fill();

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

        ctx.fillRect(obs.x, 0, obs.width, obs.topHeight);
        ctx.strokeRect(obs.x, 0, obs.width, obs.topHeight);

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

// ==========================================
// RANKING GLOBAL - FIREBASE REALTIME DATABASE
// ==========================================

async function renderLeaderboard() {
    leaderboardList.innerHTML = '<li>Carregando ranking...</li>';

    try {
        const scoresRef = ref(db, 'rankings/neonflap');
        const topScoresQuery = query(scoresRef, orderByChild('score'), limitToLast(10));
        const snapshot = await get(topScoresQuery);

        if (snapshot.exists()) {
            const data = snapshot.val();
            const list = Object.values(data).sort((a, b) => b.score - a.score);

            leaderboardList.innerHTML = '';
            list.forEach((item, index) => {
                const li = document.createElement('li');
                li.innerHTML = `<strong>#${index + 1} ${item.nick}</strong>: ${item.score} pts`;
                leaderboardList.appendChild(li);
            });
        } else {
            leaderboardList.innerHTML = '<li>Seja o primeiro a pontuar!</li>';
        }
    } catch (err) {
        console.error("Erro ao carregar ranking:", err);
        leaderboardList.innerHTML = '<li>Erro ao carregar ranking.</li>';
    }
}

async function saveRankingScore() {
    const nick = playerNickInput.value.trim() || 'Piloto Neon';
    saveScoreBtn.disabled = true;
    saveScoreBtn.textContent = 'SALVANDO...';

    try {
        const scoresRef = ref(db, 'rankings/neonflap');
        const newScoreRef = push(scoresRef);

        await set(newScoreRef, {
            nick: nick,
            score: score,
            timestamp: Date.now()
        });

        document.getElementById('nick-form').style.display = 'none';
        renderLeaderboard();
    } catch (err) {
        console.error("Erro ao salvar:", err);
        alert("Não foi possível salvar a pontuação online.");
        saveScoreBtn.disabled = false;
        saveScoreBtn.textContent = 'TENTAR NOVAMENTE';
    }
}
