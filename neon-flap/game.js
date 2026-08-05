const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const scoreVal = document.getElementById('score-val');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const finalScore = document.getElementById('final-score');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const flapBtn = document.getElementById('flap-btn');

let animationFrameId;
let gameRunning = false;
let score = 0;

// Ajuste DPI Canvas
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * window.devicePixelRatio;
  canvas.height = rect.height * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

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
  
  // Emitir Partículas Neon
  for (let i = 0; i < 5; i++) {
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

  // Atualizar Pássaro
  bird.velocity += bird.gravity;
  bird.y += bird.velocity;

  // Limite da Tela
  if (bird.y + bird.radius >= h || bird.y - bird.radius <= 0) {
    endGame();
  }

  // Atualizar Partículas
  bird.particles.forEach((p, i) => {
    p.x += p.vx;
    p.y += p.vy;
    p.alpha -= 0.03;
    if (p.alpha <= 0) bird.particles.splice(i, 1);
  });

  // Atualizar Canos
  pipeTimer++;
  if (pipeTimer % 110 === 0) createPipe();

  pipes.forEach((pipe, index) => {
    pipe.x -= 2.2;

    // Checar Pontuação
    if (!pipe.passed && pipe.x < bird.x) {
      pipe.passed = true;
      score++;
      scoreVal.textContent = score;
    }

    // Colisão
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

  // Desenhar Partículas
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

  // Desenhar Canos com Glow
  ctx.save();
  ctx.fillStyle = '#ff007f';
  ctx.shadowBlur = 12;
  ctx.shadowColor = '#ff007f';
  pipes.forEach(pipe => {
    ctx.fillRect(pipe.x, 0, pipeWidth, pipe.top);
    ctx.fillRect(pipe.x, h - pipe.bottom, pipeWidth, pipe.bottom);
  });
  ctx.restore();

  // Desenhar Pássaro
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
  gameOverScreen.classList.remove('hidden');
}

// Event Listeners
window.addEventListener('keydown', e => { if (e.code === 'Space') flap(); });
flapBtn.addEventListener('click', flap);
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); flap(); });
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
