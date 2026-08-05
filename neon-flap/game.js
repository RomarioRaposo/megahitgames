// Configuração do Firebase mantida integralmente do repositório
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "megahitgames.firebaseapp.com",
  projectId: "megahitgames",
  storageBucket: "megahitgames.appspot.com",
  messagingSenderId: "123456789",
  appId: "YOUR_APP_ID"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const scoreVal = document.getElementById('score-val');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const finalScore = document.getElementById('final-score');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const flapBtn = document.getElementById('flap-btn');
const leaderboardList = document.getElementById('leaderboard-list');

let animationFrameId;
let gameRunning = false;
let score = 0;

// Ajuste DPI Canvas para telas de alta resolução sem alterar lógica
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * window.devicePixelRatio;
  canvas.height = rect.height * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Lógica e Física do Pássaro mantidas
const bird = {
  x: 60,
  y: 200,
  radius: 12,
  velocity: 0,
  gravity: 0.35,
  jump: -6.5,
  particles: []
};

let pipes = [];
const pipeWidth = 50;
const pipeGap = 130;
let pipeTimer = 0;

function createPipe() {
  const h = canvas.height / window.devicePixelRatio;
  const minHeight = 50;
  const maxHeight = h - pipeGap - minHeight;
  const topHeight = Math.floor(Math.random() * (maxHeight - minHeight + 1)) + minHeight;

  pipes.push({
    x: canvas.width / window.devicePixelRatio,
    top: topHeight,
    bottom: h - topHeight - pipeGap,
    passed: false
  });
}

function flap() {
  if (!gameRunning) return;
  bird.velocity = bird.jump;

  // Efeito Visual de Rastro Neon
  for (let i = 0; i < 4; i++) {
    bird.particles.push({
      x: bird.x,
      y: bird.y,
      vx: (Math.random() - 0.5) * 2,
      vy: Math.random() * 2 + 1,
      alpha: 1,
      color: '#00f0ff'
    });
  }
}

function update() {
  if (!gameRunning) return;

  const h = canvas.height / window.devicePixelRatio;

  bird.velocity += bird.gravity;
  bird.y += bird.velocity;

  if (bird.y + bird.radius >= h || bird.y - bird.radius <= 0) {
    endGame();
  }

  bird.particles.forEach((p, i) => {
    p.x += p.vx;
    p.y += p.vy;
    p.alpha -= 0.04;
    if (p.alpha <= 0) bird.particles.splice(i, 1);
  });

  pipeTimer++;
  if (pipeTimer % 110 === 0) createPipe();

  pipes.forEach((pipe, index) => {
    pipe.x -= 2.2;

    if (!pipe.passed && pipe.x < bird.x) {
      pipe.passed = true;
      score++;
      scoreVal.textContent = score;
    }

    if (
      bird.x + bird.radius > pipe.x &&
      bird.x - bird.radius < pipe.x + pipeWidth &&
      (bird.y - bird.radius < pipe.top || bird.y + bird.radius > h - pipe.bottom)
    ) {
      endGame();
    }

    if (pipe.x + pipeWidth < 0) pipes.splice(index, 1);
  });
}

function draw() {
  const w = canvas.width / window.devicePixelRatio;
  const h = canvas.height / window.devicePixelRatio;

  ctx.clearRect(0, 0, w, h);

  // Renderização Visual Aprimorada: Partículas
  bird.particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.shadowBlur = 8;
    ctx.shadowColor = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // Renderização Visual Aprimorada: Canos Neon
  ctx.save();
  ctx.fillStyle = '#ff007f';
  ctx.shadowBlur = 12;
  ctx.shadowColor = '#ff007f';
  pipes.forEach(pipe => {
    ctx.fillRect(pipe.x, 0, pipeWidth, pipe.top);
    ctx.fillRect(pipe.x, h - pipe.bottom, pipeWidth, pipe.bottom);
  });
  ctx.restore();

  // Renderização Visual Aprimorada: Pássaro
  ctx.save();
  ctx.translate(bird.x, bird.y);
  ctx.rotate(Math.min(Math.PI / 4, Math.max(-Math.PI / 4, bird.velocity * 0.1)));
  ctx.fillStyle = '#00f0ff';
  ctx.shadowBlur = 15;
  ctx.shadowColor = '#00f0ff';
  ctx.beginPath();
  ctx.arc(0, 0, bird.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function gameLoop() {
  update();
  draw();
  if (gameRunning) animationFrameId = requestAnimationFrame(gameLoop);
}

// Conexão com Firebase para envio de placar
function saveScore(score) {
  if (score <= 0) return;
  db.collection("scores_neon_flap").add({
    score: score,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => {
    loadLeaderboard();
  }).catch(err => console.error("Erro ao salvar pontuação: ", err));
}

// Carregamento de Melhores Pontuações no Firebase
function loadLeaderboard() {
  leaderboardList.innerHTML = "Carregando...";
  db.collection("scores_neon_flap")
    .orderBy("score", "desc")
    .limit(5)
    .get()
    .then(querySnapshot => {
      leaderboardList.innerHTML = "";
      querySnapshot.forEach(doc => {
        const data = doc.data();
        const li = document.createElement("li");
        li.innerHTML = `<span>Jogador</span> <strong>${data.score} pts</strong>`;
        leaderboardList.appendChild(li);
      });
    });
}

function startGame() {
  resizeCanvas();
  bird.y = 200;
  bird.velocity = 0;
  bird.particles = [];
  pipes = [];
  score = 0;
  scoreVal.textContent = score;
  pipeTimer = 0;
  gameRunning = true;
  startScreen.classList.add('hidden');
  gameOverScreen.classList.add('hidden');
  gameLoop();
}

function endGame() {
  gameRunning = false;
  cancelAnimationFrame(animationFrameId);
  finalScore.textContent = score;
  saveScore(score);
  gameOverScreen.classList.remove('hidden');
}

window.addEventListener('keydown', e => { if (e.code === 'Space') flap(); });
flapBtn.addEventListener('click', flap);
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); flap(); });
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
