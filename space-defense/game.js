import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push, set, get, query, orderByChild, limitToLast } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// Firebase Config
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

if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Multiplicador de Velocidade
let gameSpeed = 1;
const speeds = [1, 2, 3, 4];
function toggleSpeed() {
    let idx = speeds.indexOf(gameSpeed);
    gameSpeed = speeds[(idx + 1) % speeds.length];
    document.getElementById('btn-speed').innerText = `⚡ ${gameSpeed}x`;
}

// Estado do Jogo
const game = {
    wave: 1,
    gold: 0,
    gameOver: false,
    asteroidsInWave: 8,
    asteroidsSpawned: 0,
    asteroidsDefeated: 0,
    lastShot: 0,
    shipAngle: 0
};

const ship = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 18,
    attackRange: 170,
    hp: 100,
    maxHp: 100,
    hpRegen: 0,
    damage: 6,
    atkSpeed: 1.2,
    goldPerWave: 20,
    goldPerKill: 2
};

const upgrades = {
    atkSpeed: { lvl: 1, cost: 15, scale: 1.4 },
    damage:   { lvl: 1, cost: 10, scale: 1.3 },
    hp:       { lvl: 1, cost: 20, scale: 1.3 },
    hpRegen:  { lvl: 0, cost: 25, scale: 1.5 },
    goldWave: { lvl: 1, cost: 30, scale: 1.4 },
    goldKill: { lvl: 1, cost: 40, scale: 1.4 }
};

let bullets = [];
let asteroids = [];

// Classe Asteroide com Visual Rochoso
class Asteroid {
    constructor(type = 'small') {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.max(canvas.width, canvas.height) / 2 + 60;
        
        this.x = canvas.width / 2 + Math.cos(angle) * dist;
        this.y = canvas.height / 2 + Math.sin(angle) * dist;
        this.type = type;

        if (type === 'boss') {
            this.radius = 32;
            this.hp = 160 * (1 + game.wave * 0.4);
            this.speed = 0.6;
            this.damagePerSec = 15;
            this.color = '#e74c3c';
        } else if (type === 'medium') {
            this.radius = 20;
            this.hp = 28 * (1 + game.wave * 0.2);
            this.speed = 1.0;
            this.damagePerSec = 5;
            this.color = '#e67e22';
        } else {
            this.radius = 12;
            this.hp = 10 * (1 + game.wave * 0.15);
            this.speed = 1.5;
            this.damagePerSec = 2;
            this.color = '#95a5a6';
        }
        
        this.maxHp = this.hp;

        // Gerar formato irregular com vértices aleatórios
        this.vertices = [];
        const numVerts = 8;
        for (let i = 0; i < numVerts; i++) {
            const a = (i / numVerts) * Math.PI * 2;
            const r = this.radius * (0.8 + Math.random() * 0.4);
            this.vertices.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
        }
    }

    update(dt) {
        const dx = (canvas.width / 2) - this.x;
        const dy = (canvas.height / 2) - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist > ship.radius + 5) {
            this.x += (dx / dist) * this.speed * gameSpeed;
            this.y += (dy / dist) * this.speed * gameSpeed;
        } else {
            ship.hp -= this.damagePerSec * dt * gameSpeed;
            if (ship.hp <= 0) {
                ship.hp = 0;
                endGame();
            }
        }
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Desenhar corpo irregular do asteroide
        ctx.beginPath();
        ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
        for (let i = 1; i < this.vertices.length; i++) {
            ctx.lineTo(this.vertices[i].x, this.vertices[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Barra de Vida
        if (this.hp < this.maxHp) {
            ctx.fillStyle = 'rgba(255,0,0,0.7)';
            ctx.fillRect(-this.radius, -this.radius - 8, this.radius * 2, 4);
            ctx.fillStyle = '#00e676';
            ctx.fillRect(-this.radius, -this.radius - 8, (this.hp / this.maxHp) * (this.radius * 2), 4);
        }

        ctx.restore();
    }
}

// Projéteis
class Bullet {
    constructor(target) {
        this.x = canvas.width / 2;
        this.y = canvas.height / 2;
        this.speed = 8;
        this.damage = ship.damage;
        
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const dist = Math.hypot(dx, dy);
        this.vx = (dx / dist) * this.speed;
        this.vy = (dy / dist) * this.speed;

        game.shipAngle = Math.atan2(dy, dx);
    }

    update() {
        this.x += this.vx * gameSpeed;
        this.y += this.vy * gameSpeed;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#00f0ff';
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#00f0ff';
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

// Visual Detalhado da Nave Futurista
function drawShip() {
    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(game.shipAngle);

    // Propulsor / Fogo
    ctx.beginPath();
    ctx.moveTo(-15, -5);
    ctx.lineTo(-22 - Math.random() * 5, 0);
    ctx.lineTo(-15, 5);
    ctx.fillStyle = '#ff5500';
    ctx.fill();

    // Asas
    ctx.beginPath();
    ctx.moveTo(-10, -16);
    ctx.lineTo(15, 0);
    ctx.lineTo(-10, 16);
    ctx.lineTo(-5, 0);
    ctx.fillStyle = '#00b4d8';
    ctx.fill();

    // Cabine
    ctx.beginPath();
    ctx.arc(2, 0, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.restore();
}

// Disparo Automático
function autoShoot(now) {
    if (now - game.lastShot < 1000 / (ship.atkSpeed * gameSpeed)) return;

    let nearest = null;
    let minDist = ship.attackRange;

    for (let ast of asteroids) {
        const dist = Math.hypot(ast.x - ship.x, ast.y - ship.y);
        if (dist <= minDist) {
            minDist = dist;
            nearest = ast;
        }
    }

    if (nearest) {
        bullets.push(new Bullet(nearest));
        game.lastShot = now;
    }
}

// Loop de Animação
let lastTime = performance.now();
function gameLoop(now) {
    if (game.gameOver) return;

    const dt = (now - lastTime) / 1000;
    lastTime = now;

    ship.x = canvas.width / 2;
    ship.y = canvas.height / 2;

    // Regen de HP
    if (ship.hp < ship.maxHp) {
        ship.hp = Math.min(ship.maxHp, ship.hp + ship.hpRegen * dt * gameSpeed);
    }

    handleSpawning();

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Círculo de Alcance
    ctx.beginPath();
    ctx.arc(ship.x, ship.y, ship.attackRange, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 180, 216, 0.15)';
    ctx.setLineDash([6, 6]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Desenhar Nave
    drawShip();

    // Barra de Vida
    ctx.fillStyle = '#ff0055';
    ctx.fillRect(ship.x - 20, ship.y + 24, 40, 5);
    ctx.fillStyle = '#00e676';
    ctx.fillRect(ship.x - 20, ship.y + 24, (ship.hp / ship.maxHp) * 40, 5);

    autoShoot(now);

    // Atualizar Tiros
    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i];
        b.update();
        b.draw();

        for (let j = asteroids.length - 1; j >= 0; j--) {
            let ast = asteroids[j];
            if (Math.hypot(b.x - ast.x, b.y - ast.y) < ast.radius) {
                ast.hp -= b.damage;
                bullets.splice(i, 1);

                if (ast.hp <= 0) {
                    game.gold += ship.goldPerKill;
                    asteroids.splice(j, 1);
                    game.asteroidsDefeated++;
                    checkWave();
                }
                break;
            }
        }

        if (b && (b.x < 0 || b.x > canvas.width || b.y < 0 || b.y > canvas.height)) {
            bullets.splice(i, 1);
        }
    }

    // Atualizar Asteroides
    for (let ast of asteroids) {
        ast.update(dt);
        ast.draw();
    }

    updateHUD();
    requestAnimationFrame(gameLoop);
}

function handleSpawning() {
    if (game.asteroidsSpawned < game.asteroidsInWave && Math.random() < 0.03 * gameSpeed) {
        if (game.wave % 10 === 0) {
            if (game.asteroidsSpawned === 0) {
                asteroids.push(new Asteroid('boss'));
                game.asteroidsSpawned = game.asteroidsInWave;
            }
        } else {
            const type = Math.random() < 0.25 ? 'medium' : 'small';
            asteroids.push(new Asteroid(type));
            game.asteroidsSpawned++;
        }
    }
}

function checkWave() {
    if (game.asteroidsDefeated >= game.asteroidsInWave && asteroids.length === 0) {
        game.wave++;
        game.gold += ship.goldPerWave;
        game.asteroidsSpawned = 0;
        game.asteroidsDefeated = 0;
        game.asteroidsInWave = game.wave % 10 === 0 ? 1 : 8 + game.wave * 2;
    }
}

function updateHUD() {
    document.getElementById('wave-num').innerText = game.wave;
    document.getElementById('gold-display').innerText = Math.floor(game.gold);
    document.getElementById('ast-hp').innerText = Math.floor(10 * (1 + game.wave * 0.15));
    document.getElementById('ast-dmg').innerText = Math.floor(2 * (1 + game.wave * 0.1));

    for (let key in upgrades) {
        const u = upgrades[key];
        const btn = document.querySelector(`[onclick="buyUpgrade('${key}')"]`);
        if (btn) btn.disabled = game.gold < u.cost;
    }
}

function buyUpgrade(type) {
    const u = upgrades[type];
    if (game.gold >= u.cost) {
        game.gold -= u.cost;
        u.lvl++;

        switch(type) {
            case 'atkSpeed': ship.atkSpeed += 0.25; break;
            case 'damage': ship.damage += 3; break;
            case 'hp': ship.maxHp += 20; ship.hp += 20; break;
            case 'hpRegen': ship.hpRegen += 0.5; break;
            case 'goldWave': ship.goldPerWave += 10; break;
            case 'goldKill': ship.goldPerKill += 1; break;
        }

        u.cost = Math.floor(u.cost * u.scale);
        document.getElementById(`lvl-${type}`).innerText = u.lvl;
        document.getElementById(`cost-${type}`).innerText = u.cost;
    }
}

function endGame() {
    game.gameOver = true;
    document.getElementById('ranking-modal').style.display = 'flex';
    
    if (typeof firebase !== 'undefined' && firebase.apps.length) {
        const name = prompt("Fim de Jogo! Digite seu nome:") || "Anônimo";
        firebase.database().ref('ranking_space_defense').push({
            name: name,
            wave: game.wave,
            date: new Date().toISOString()
        });
        loadRanking();
    }
}

function loadRanking() {
    if (typeof firebase === 'undefined' || !firebase.apps.length) return;
    firebase.database().ref('ranking_space_defense').orderByChild('wave').limitToLast(10)
    .once('value', snapshot => {
        const listEl = document.getElementById('ranking-list');
        listEl.innerHTML = '';
        let scores = [];
        snapshot.forEach(c => scores.push(c.val()));
        scores.reverse().forEach(data => {
            const li = document.createElement('li');
            li.innerText = `${data.name} - Onda ${data.wave}`;
            listEl.appendChild(li);
        });
    });
}

function resetGame() {
    location.reload();
}

requestAnimationFrame(gameLoop);
