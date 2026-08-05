// Configuração Firebase
const firebaseConfig = {
    apiKey: "SUA_API_KEY",
    authDomain: "seu-projeto.firebaseapp.com",
    databaseURL: "https://seu-projeto-default-rtdb.firebaseio.com",
    projectId: "seu-projeto",
    storageBucket: "seu-projeto.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcde12345"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

// Inicialização do Canvas
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Estado do Jogo e Nave
const game = {
    wave: 1,
    gold: 0,
    gameOver: false,
    asteroidsInWave: 10,
    asteroidsSpawned: 0,
    asteroidsDefeated: 0,
    lastShot: 0
};

const ship = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 18,
    attackRange: 160,
    hp: 100,
    maxHp: 100,
    hpRegen: 0,
    damage: 5,
    atkSpeed: 1, // tiros por segundo
    goldPerWave: 20,
    goldPerKill: 2
};

// Tabelas de Nível e Custos de Melhoria
const upgrades = {
    atkSpeed: { lvl: 1, cost: 15, scaleCost: 1.5 },
    damage:   { lvl: 1, cost: 10, scaleCost: 1.4 },
    hp:       { lvl: 1, cost: 20, scaleCost: 1.3 },
    hpRegen:  { lvl: 0, cost: 25, scaleCost: 1.6 },
    goldWave: { lvl: 1, cost: 30, scaleCost: 1.5 },
    goldKill: { lvl: 1, cost: 40, scaleCost: 1.5 }
};

let bullets = [];
let asteroids = [];

// Entidade Asteroide
class Asteroid {
    constructor(type = 'small') {
        const angle = Math.random() * Math.PI * 2;
        const spawnDistance = Math.max(canvas.width, canvas.height) / 2 + 50;
        
        this.x = canvas.width / 2 + Math.cos(angle) * spawnDistance;
        this.y = canvas.height / 2 + Math.sin(angle) * spawnDistance;
        this.type = type;

        // Configurações por tipo
        if (type === 'boss') {
            this.radius = 35;
            this.hp = 150 * (1 + game.wave * 0.5);
            this.speed = 0.6;
            this.damagePerSec = 15;
            this.goldValue = ship.goldPerKill * 10;
        } else if (type === 'medium') {
            this.radius = 20;
            this.hp = 25 * (1 + game.wave * 0.2);
            this.speed = 1.0;
            this.damagePerSec = 5;
            this.goldValue = ship.goldPerKill * 2;
        } else { // small
            this.radius = 12;
            this.hp = 8 * (1 + game.wave * 0.15);
            this.speed = 1.5;
            this.damagePerSec = 2;
            this.goldValue = ship.goldPerKill;
        }
        
        this.maxHp = this.hp;
    }

    update(deltaTime) {
        // Mover em direção à nave centro
        const dx = (canvas.width / 2) - this.x;
        const dy = (canvas.height / 2) - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist > ship.radius) {
            this.x += (dx / dist) * this.speed;
            this.y += (dy / dist) * this.speed;
        } else {
            // Colisão contínua com a nave
            ship.hp -= this.damagePerSec * deltaTime;
            if (ship.hp <= 0) {
                ship.hp = 0;
                endGame();
            }
        }
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.type === 'boss' ? '#e74c3c' : (this.type === 'medium' ? '#e67e22' : '#95a5a6');
        ctx.fill();
        ctx.closePath();
    }
}

// Entidade Projétil
class Bullet {
    constructor(target) {
        this.x = canvas.width / 2;
        this.y = canvas.height / 2;
        this.speed = 7;
        this.damage = ship.damage;
        this.target = target;
        
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const dist = Math.hypot(dx, dy);
        this.vx = (dx / dist) * this.speed;
        this.vy = (dy / dist) * this.speed;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#00e676';
        ctx.fill();
        ctx.closePath();
    }
}

// Sistema de Disparo Automático
function autoShoot(now) {
    if (now - game.lastShot < 1000 / ship.atkSpeed) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Encontrar asteroide mais próximo dentro do Alcance de Ataque
    let nearest = null;
    let minDist = ship.attackRange;

    for (let ast of asteroids) {
        const dist = Math.hypot(ast.x - centerX, ast.y - centerY);
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

// Loop Principal do Jogo
let lastTime = performance.now();
function gameLoop(now) {
    if (game.gameOver) return;

    const deltaTime = (now - lastTime) / 1000;
    lastTime = now;

    // Recentralizar nave com base na janela
    ship.x = canvas.width / 2;
    ship.y = canvas.height / 2;

    // Regeneração de HP
    if (ship.hp < ship.maxHp) {
        ship.hp = Math.min(ship.maxHp, ship.hp + ship.hpRegen * deltaTime);
    }

    // Gerenciar Aparição (Spawn) de Ondas
    handleSpawning();

    // Atualizar e Desenhar Tela
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Desenhar Circulo de Alcance
    ctx.beginPath();
    ctx.arc(ship.x, ship.y, ship.attackRange, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 180, 216, 0.2)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Desenhar Nave Principal
    ctx.beginPath();
    ctx.arc(ship.x, ship.y, ship.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#00b4d8';
    ctx.fill();

    // Barra de Vida da Nave
    ctx.fillStyle = '#ff0055';
    ctx.fillRect(ship.x - 25, ship.y + 25, 50, 6);
    ctx.fillStyle = '#00e676';
    ctx.fillRect(ship.x - 25, ship.y + 25, (ship.hp / ship.maxHp) * 50, 6);

    // Disparar
    autoShoot(now);

    // Atualizar Projéteis
    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i];
        b.update();
        b.draw();

        // Checar colisão com Asteroides
        for (let j = asteroids.length - 1; j >= 0; j--) {
            let ast = asteroids[j];
            if (Math.hypot(b.x - ast.x, b.y - ast.y) < ast.radius) {
                ast.hp -= b.damage;
                bullets.splice(i, 1);

                if (ast.hp <= 0) {
                    game.gold += ast.goldValue;
                    asteroids.splice(j, 1);
                    game.asteroidsDefeated++;
                    checkWaveProgress();
                }
                break;
            }
        }

        // Remover projéteis fora de tela
        if (b && (b.x < 0 || b.x > canvas.width || b.y < 0 || b.y > canvas.height)) {
            bullets.splice(i, 1);
        }
    }

    // Atualizar Asteroides
    for (let ast of asteroids) {
        ast.update(deltaTime);
        ast.draw();
    }

    updateHUD();
    requestAnimationFrame(gameLoop);
}

// Controle de Ondas
function handleSpawning() {
    if (game.asteroidsSpawned < game.asteroidsInWave && Math.random() < 0.02) {
        if (game.wave % 10 === 0) {
            // Onda BOSS
            if (game.asteroidsSpawned === 0) {
                asteroids.push(new Asteroid('boss'));
                game.asteroidsSpawned = game.asteroidsInWave; // Apenas Boss na onda
            }
        } else {
            // Ondas normais (mistura pequenos e médios)
            const type = Math.random() < 0.25 ? 'medium' : 'small';
            asteroids.push(new Asteroid(type));
            game.asteroidsSpawned++;
        }
    }
}

function checkWaveProgress() {
    if (game.asteroidsDefeated >= game.asteroidsInWave && asteroids.length === 0) {
        // Onda Finalizada
        game.wave++;
        game.gold += ship.goldPerWave;
        game.asteroidsSpawned = 0;
        game.asteroidsDefeated = 0;
        game.asteroidsInWave = game.wave % 10 === 0 ? 1 : 8 + game.wave * 2;
    }
}

// Atualizar HUD e Botões
function updateHUD() {
    document.getElementById('wave-num').innerText = game.wave;
    document.getElementById('gold-display').innerText = Math.floor(game.gold);
    
    // Status do Inimigo Básico da Onda
    document.getElementById('ast-hp').innerText = Math.floor(10 * (1 + game.wave * 0.15));
    document.getElementById('ast-dmg').innerText = `${Math.floor(2 * (1 + game.wave * 0.1))}/s`;

    // Atualizar estado de botões da loja
    for (let key in upgrades) {
        const u = upgrades[key];
        const btn = document.querySelector(`[onclick="buyUpgrade('${key}')"]`);
        if (btn) btn.disabled = game.gold < u.cost;
    }
}

// Compra de Melhorias
function buyUpgrade(type) {
    const u = upgrades[type];
    if (game.gold >= u.cost) {
        game.gold -= u.cost;
        u.lvl++;

        // Aplicar Efeito
        switch(type) {
            case 'atkSpeed': ship.atkSpeed += 0.2; break;
            case 'damage': ship.damage += 3; break;
            case 'hp': 
                ship.maxHp += 25; 
                ship.hp += 25; 
                break;
            case 'hpRegen': ship.hpRegen += 0.5; break;
            case 'goldWave': ship.goldPerWave += 10; break;
            case 'goldKill': ship.goldPerKill += 1; break;
        }

        // Recalcular Custo Próximo Nível
        u.cost = Math.floor(u.cost * u.scaleCost);

        // Atualizar textos da Interface
        document.getElementById(`lvl-${type}`).innerText = u.lvl;
        document.getElementById(`cost-${type}`).innerText = u.cost;
    }
}

// Fim de Jogo e Firebase Ranking
function endGame() {
    game.gameOver = true;
    const name = prompt("Fim de Jogo! Digite seu nome para o Ranking:") || "Anônimo";
    
    saveScore(name, game.wave);
    document.getElementById('btn-restart').style.display = 'inline-block';
    document.getElementById('ranking-modal').style.display = 'flex';
}

function saveScore(name, waveReached) {
    const scoresRef = db.ref('ranking_space_defense');
    scoresRef.push({
        name: name,
        wave: waveReached,
        date: new Date().toISOString()
    });
    loadRanking();
}

function loadRanking() {
    const scoresRef = db.ref('ranking_space_defense').orderByChild('wave').limitToLast(10);
    scoresRef.once('value', (snapshot) => {
        const listEl = document.getElementById('ranking-list');
        listEl.innerHTML = '';
        
        let scores = [];
        snapshot.forEach(child => {
            scores.push(child.val());
        });
        
        // Ordenar decrescente
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

// Iniciar Loop
requestAnimationFrame(gameLoop);
