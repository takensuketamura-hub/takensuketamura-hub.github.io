// ====== Canvasと変数初期化 ======
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let player, enemies = [], bullets = [], drops = [];
let mouseX = canvas.width / 2, mouseY = canvas.height / 2;
let score = 0;
let lastSpawn = 0;
let enemySpawnRate = 2000;
let animationId;
let currentMode = "normal";
let gameStarted = false;

// ====== クラス定義 ======
class Player {
  constructor() {
    this.x = canvas.width / 2;
    this.y = canvas.height / 2;
    this.size = 20;
    this.speed = 3;
    this.hp = 100;
    this.maxHP = 100;
  }
  update() {
    // マウスまたはタッチ方向に移動
    let dx = mouseX - this.x;
    let dy = mouseY - this.y;
    let dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 3) {
      this.x += (dx / dist) * this.speed;
      this.y += (dy / dist) * this.speed;
    }
  }
  draw() {
    // 本体
    ctx.fillStyle = "#0f0";
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();

    // HPバー
    ctx.fillStyle = "red";
    ctx.fillRect(this.x - 25, this.y - 35, 50, 5);
    ctx.fillStyle = "lime";
    ctx.fillRect(this.x - 25, this.y - 35, (this.hp / this.maxHP) * 50, 5);
  }
}

class Enemy {
  constructor() {
    // ランダムに出現
    const edge = Math.floor(Math.random() * 4);
    if (edge === 0) { this.x = 0; this.y = Math.random() * canvas.height; }
    if (edge === 1) { this.x = canvas.width; this.y = Math.random() * canvas.height; }
    if (edge === 2) { this.x = Math.random() * canvas.width; this.y = 0; }
    if (edge === 3) { this.x = Math.random() * canvas.width; this.y = canvas.height; }

    this.size = 15;
    this.speed = 1.2;
  }
  update() {
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    this.x += (dx / dist) * this.speed;
    this.y += (dy / dist) * this.speed;

    // プレイヤーとの接触
    if (dist < this.size + player.size) {
      player.hp -= 0.3;
    }
  }
  draw() {
    ctx.fillStyle = "crimson";
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

class Bullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    this.size = 5;
    this.speed = 6;
    this.vx = Math.cos(angle) * this.speed;
    this.vy = Math.sin(angle) * this.speed;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
  }
  draw() {
    ctx.fillStyle = "#ff0";
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ====== モード制御 ======
function startGame(mode) {
  currentMode = mode;
  gameStarted = true;
  enemies = [];
  bullets = [];
  drops = [];
  score = 0;
  lastSpawn = 0;
  cancelAnimationFrame(animationId);

  player = new Player();

  if (mode === "normal") {
    enemySpawnRate = 2000;
    player.maxHP = 100;
  } else if (mode === "hard") {
    enemySpawnRate = 1200;
    player.maxHP = 80;
  }
  player.hp = player.maxHP;

  gameLoop();
}

function resetGame() {
  gameStarted = false;
  cancelAnimationFrame(animationId);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff";
  ctx.font = "24px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("ゲームをリセットしました", canvas.width / 2, canvas.height / 2);
}

// ====== メインループ ======
function gameLoop(timestamp) {
  if (!gameStarted) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 敵スポーン
  if (timestamp - lastSpawn > enemySpawnRate) {
    enemies.push(new Enemy());
    lastSpawn = timestamp;
    enemySpawnRate = Math.max(500, enemySpawnRate * 0.98); // 段階的に早くなる
  }

  // 弾自動発射
  if (Math.random() < 0.05) {
    const angle = Math.random() * Math.PI * 2;
    bullets.push(new Bullet(player.x, player.y, angle));
  }

  // 更新
  player.update();
  enemies.forEach(e => e.update());
  bullets.forEach(b => b.update());

  // 当たり判定（弾→敵）
  enemies = enemies.filter(e => {
    let hit = false;
    bullets.forEach((b, bi) => {
      const dx = e.x - b.x;
      const dy = e.y - b.y;
      if (Math.sqrt(dx * dx + dy * dy) < e.size + b.size) {
        hit = true;
        bullets.splice(bi, 1);
        score += 10;
      }
    });
    return !hit;
  });

  // 描画
  player.draw();
  enemies.forEach(e => e.draw());
  bullets.forEach(b => b.draw());

  // スコア表示
  ctx.fillStyle = "#fff";
  ctx.font = "18px monospace";
  ctx.textAlign = "left";
  ctx.fillText("SCORE: " + score, 10, 20);
  ctx.fillText("HP: " + Math.floor(player.hp), 10, 40);

  if (player.hp <= 0) {
    gameOver();
    return;
  }

  animationId = requestAnimationFrame(gameLoop);
}

// ====== ゲームオーバー ======
function gameOver() {
  cancelAnimationFrame(animationId);
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff";
  ctx.font = "32px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2);
  ctx.font = "20px sans-serif";
  ctx.fillText("スコア: " + score, canvas.width / 2, canvas.height / 2 + 40);
}

// ====== 入力（マウス＋タッチ対応） ======
function updatePointerPosition(x, y) {
  const rect = canvas.getBoundingClientRect();
  mouseX = x - rect.left;
  mouseY = y - rect.top;
}

canvas.addEventListener("mousemove", e => {
  updatePointerPosition(e.clientX, e.clientY);
});

// タッチ操作（スマホ・トラックパッド対応）
canvas.addEventListener("touchmove", e => {
  e.preventDefault();
  const touch = e.touches[0];
  updatePointerPosition(touch.clientX, touch.clientY);
}, { passive: false });

// タップ時も移動
canvas.addEventListener("touchstart", e => {
  const touch = e.touches[0];
  updatePointerPosition(touch.clientX, touch.clientY);
});
