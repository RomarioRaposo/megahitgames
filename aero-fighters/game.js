const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const scoreVal = document.getElementById('score-val');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const finalScore = document.getElementById('final-score');

let gameRunning = false;
let score = 0;
let animationFrameId;

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * window.devicePixelRatio;
  canvas.height = rect.height * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

const player = {
  x: 0,
  y: 0,
  width: 32,
  height: 32,
  speed: 5,
  dx: 0
};

let bullets = [];
let enemies = [];
let particles = [];
let enemyTimer = 0;

function createExplosion(x, y, color) {
  for (let i = 0; i < 12; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 6,
      vy: (Math.random() - 0.5) * 6,
      alpha: 1,
      color
    });
  }
}

function update() {
  if (!gameRunning) return;

  const w = canvas.width / window.devicePixelRatio;
  const h = canvas.height / window.devicePixelRatio;

  // Atualizar Jogador
  player.x += player.dx;
  if (player.x < 0) player.x = 0;
  if (player.x + player.width > w) player.x = w - player.width;

  // Atualizar Bullets
  bullets.forEach((b, index) => {
    b.y -= 7;
    if (b.y < 0) bullets.splice(index, 1);
  });

  // Gerar Inimigos
  enemyTimer++;
  if (enemyTimer % 45 === 0) {
    enemies.push({
      x: Math.random() * (w - 30),
      y: -30,
      width: 28,
      height: 28,
      speed: 2 + Math.random() * 2
    });
  }

  // Atualizar Inimigos
  enemies.forEach((enemy, eIdx) => {
    enemy.y += enemy.speed;

    // Colisão com Tiro
    bullets.forEach((bullet, bIdx) => {
      if (
        bullet.x > enemy.x &&
        bullet.x < enemy.x + enemy.width &&
        bullet.y > enemy.y &&
        bullet.y < enemy.y + enemy.height
      ) {
        createExplosion(enemy.x + 14, enemy.y + 14, '#ff2a6d');
        enemies.splice(eIdx, 1);
        bullets.splice(bIdx, 1);
        score += 10;
        scoreVal.textContent = score;
      }
    });

    // Colisão com o Player ou passar do limite
    if (
      player.x < enemy.x + enemy.width &&
      player.x + player.width > enemy.x &&
      player.y < enemy.y + enemy.height &&
      player.y + player.height > enemy.y
    ) {
      endGame();
    }

    if (enemy.y > h) enemies.splice(eIdx, 1);
  });

  // Atualizar Partículas
  particles.forEach((p, i) => {
    p.x += p.vx;
    p.y += p.vy;
    p.alpha -= 0.04;
    if (p.alpha <= 0) particles.splice(i, 1);
  });
}

function draw() {
  const w = canvas.width / window.devicePixelRatio;
  const h = canvas.height / window.devicePixelRatio;

  ctx.clearRect(0, 0, w, h);

  // Desenhar Partículas
  particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 4, 4);
    ctx.restore();
  });

  // Desenhar Tiros
  ctx.save();
  ctx.fillStyle = '#ffe600';
  ctx.shadowBlur = 8;
  ctx.shadowColor = '#ffe600';
  bullets.forEach(b => ctx.fillRect(b.x, b.y, 4, 10));
  ctx.restore();

  // Desenhar Inimigos
  ctx.save();
  ctx.fillStyle = '#ff2a6d';
  ctx.shadowBlur = 10;
  ctx.shadowColor = '#ff2a6d';
  enemies.forEach(e => {
    ctx.beginPath();
    ctx.moveTo(e.x + e.width / 2, e.y + e.height);
    ctx.lineTo(e.x, e.y);
    ctx.lineTo(e.x + e.width, e.y);
    ctx.closePath();
    ctx.fill();
  });
  ctx.restore();

  // Desenhar Player
  ctx.save();
  ctx.fillStyle = '#00f0ff';
  ctx.shadowBlur = 12;
  ctx.shadowColor = '#00f0ff';
  ctx.beginPath();
  ctx.moveTo(player.x + player.width / 2, player.y);
  ctx.lineTo(player.x, player.y + player.height);
  ctx.lineTo(player.x + player.width, player.y + player.height);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function shoot() {
  if (!gameRunning) return;
  bullets.push({ x: player.x + player.width / 2 - 2, y: player.y });
}

function gameLoop() {
  update();
  draw();
  if (gameRunning) animationFrameId = requestAnimationFrame(gameLoop);
}

function startGame() {
  resizeCanvas();
  const w = canvas.width / window.devicePixelRatio;
  const h = canvas.height / window.devicePixelRatio;

  player.x = w / 2 - 16;
  player.y = h - 60;
  bullets = [];
  enemies = [];
  particles = [];
  score = 0;
  scoreVal.textContent = score;

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

// Eventos de Controle
window.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft') player.dx = -player.speed;
  if (e.key === 'ArrowRight') player.dx = player.speed;
  if (e.code === 'Space') shoot();
});

window.addEventListener('keyup', e => {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') player.dx = 0;
});

// Touch Controls
const btnLeft = document.getElementById('btn-left');
const btnRight = document.getElementById('btn-right');
const btnFire = document.getElementById('btn-fire');

btnLeft.addEventListener('touchstart', (e) => { e.preventDefault(); player.dx = -player.speed; });
btnLeft.addEventListener('touchend', () => player.dx = 0);
btnRight.addEventListener('touchstart', (e) => { e.preventDefault(); player.dx = player.speed; });
btnRight.addEventListener('touchend', () => player.dx = 0);
btnFire.addEventListener('touchstart', (e) => { e.preventDefault(); shoot(); });

document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', startGame);
