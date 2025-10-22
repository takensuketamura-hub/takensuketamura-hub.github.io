<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>ヴァンサバ風 完全版（武器+パッシブ+ドロップ+難易度）</title>
<style>
  html,body{height:100%;margin:0;background:#0b0b12;color:#eee;font-family:system-ui}
  #game{display:block;background:#06060a;image-rendering:pixelated}
  #ui{position:fixed;left:12px;top:10px;font-size:14px;line-height:1.6}
  #tips{position:fixed;right:12px;top:10px;font-size:13px;color:#bbb}
  #menu, #levelup { position:fixed; left:50%; top:50%; transform:translate(-50%,-50%); background:#111; padding:18px; border-radius:10px; box-shadow:0 6px 30px rgba(0,0,0,0.7); }
  #menu button,#levelup button{ margin:8px;padding:10px 14px;font-size:15px; cursor:pointer; }
  .col{ display:inline-block; vertical-align:top; width:46%; margin:1%; text-align:center; }
  .rarity-common{ background:#2b2b2b; color:#fff; }
  .rarity-rare{ background:#26457a; color:#fff; }
  .rarity-epic{ background:#6a2b63; color:#fff; }
  .item { font-weight:bold; padding:6px 10px; border-radius:6px; cursor:pointer; display:inline-block; margin:6px; }
  #dropNotice { position:fixed; left:50%; bottom:16px; transform:translateX(-50%); color:#fff; background:rgba(0,0,0,0.5); padding:8px 12px; border-radius:8px; display:none; }
</style>
</head>
<body>
<canvas id="game" width="900" height="640"></canvas>

<div id="ui">
  HP: <span id="hp">100</span>/<span id="maxhp">100</span>
  &nbsp; LV: <span id="lv">1</span>
  &nbsp; XP: <span id="xp">0</span>/<span id="nxp">5</span>
  <div>Weapons: <span id="weapons">normal(Lv1)</span></div>
  <div>Passive: <span id="passives">—</span></div>
</div>

<div id="tips">操作: マウスで移動（WASD可） ・ スペースでスタート/リトライ</div>

<div id="menu">
  <h2 style="margin:4px 0 10px 0">難易度を選んでね</h2>
  <button id="btnNormal">Normal — 標準</button>
  <button id="btnHard">Hard — 強敵／高XP</button>
  <div style="margin-top:8px;color:#aaa;font-size:13px">敵が倒れると稀に回復や宝箱が落ちるよ</div>
</div>

<div id="levelup" style="display:none; width:760px; max-width:94%;">
  <h3 style="margin-top:0">レベルアップ！ 1つ選んでね</h3>
  <div style="font-size:13px;color:#bbb;margin-bottom:8px">左：武器候補 ／ 右：パッシブ候補</div>
  <div id="cols" style="display:flex; justify-content:space-between;"></div>
</div>

<div id="dropNotice">アイテムを取得しました</div>

<script>
// -------------------- 基本セットアップ --------------------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

// UI refs
const hpEl = document.getElementById('hp'), maxhpEl = document.getElementById('maxhp');
const xpEl = document.getElementById('xp'), lvEl = document.getElementById('lv'), nxpEl = document.getElementById('nxp');
const weaponsEl = document.getElementById('weapons'), passivesEl = document.getElementById('passives');
const menu = document.getElementById('menu'), levelupDiv = document.getElementById('levelup'), colsDiv = document.getElementById('cols');
const dropNotice = document.getElementById('dropNotice');

let difficulty = 'normal'; // 'normal' or 'hard'
document.getElementById('btnNormal').onclick = ()=>{ difficulty='normal'; startGame(); };
document.getElementById('btnHard').onclick = ()=>{ difficulty='hard'; startGame(); };

// input
const keys = {};
const mouse = { x: W/2, y: H/2 };
addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; if(e.key===' ' && !running){ startGame(); } });
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
canvas.addEventListener('mousemove', e => {
  const r = canvas.getBoundingClientRect();
  mouse.x = e.clientX - r.left;
  mouse.y = e.clientY - r.top;
});

// -------------------- ゲーム状態 --------------------
let running = false;
let time = 0;
let spawnTimer = 0, spawnInterval = 1.0;
let fireTimer = 0;
let last = performance.now()/1000;
let bossTimer = 60; // 次ボスまでの時間（秒）

// player
let player = {
  x: W/2, y: H/2, r: 14,
  hp: 100, maxhp: 100,
  speed: 200,
  damageReduce: 0, // 0..0.5
  fireRateMul: 1 // 値が小さいほど速く（multiplicative）
};

// progression
let xp = 0, level = 1, nextXp = 5;
let weapons = [ { type:'normal', level:1 } ]; // 所持武器（最大3つ）
let passives = []; // 獲得したパッシブ（文字列配列）

// entities
let bullets = [], enemies = [], particles = [], items = []; // items: heal / chest

// -------------------- ヘルパー --------------------
function rand(a,b){ return Math.random()*(b-a)+a; }
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
function dist(a,b){ const dx=(a.x-b.x), dy=(a.y-b.y); return Math.hypot(dx,dy); }
function nowSec(){ return performance.now()/1000; }

// rarity roll
function rollRarity(){
  const r = Math.random();
  if(r < 0.10) return 'epic';
  if(r < 0.40) return 'rare';
  return 'common';
}
function rarityMultiplier(r){ return r==='epic'?3 : r==='rare'?2 : 1; }

// -------------------- スタート／リセット --------------------
function startGame(){
  // reset
  running = true; time = 0; spawnTimer = 0; fireTimer = 0; last = nowSec();
  bossTimer = 60;
  player.x = W/2; player.y = H/2;
  player.maxhp = 100; player.hp = player.maxhp; player.speed = 200;
  player.damageReduce = 0; player.fireRateMul = 1;
  bullets = []; enemies = []; particles = []; items = [];
  weapons = [ {type:'normal', level:1} ];
  passives = [];
  xp = 0; level = 1; nextXp = 5;
  spawnInterval = 1.0;
  menu.style.display = 'none';
  levelupDiv.style.display = 'none';
  updateUI();
}

// -------------------- スポーン（敵・ボス） --------------------
function spawnEnemy(isBoss=false){
  const side = Math.floor(rand(0,4));
  let x,y;
  if(side===0){ x=-30; y=rand(0,H); }
  else if(side===1){ x=W+30; y=rand(0,H); }
  else if(side===2){ x=rand(0,W); y=-30; }
  else { x=rand(0,W); y=H+30; }

  let baseHp = 6 + Math.floor(level * 1.2);
  if(isBoss){
    baseHp = 300 + level * 60;
    if(difficulty === 'hard') baseHp *= 1.5;
    enemies.push({ x,y, r:40, hp:baseHp, hpMax:baseHp, spd:40 + level * 1.5, boss:true });
  } else {
    let hp = baseHp;
    if(difficulty === 'hard') hp *= 1.4;
    enemies.push({ x,y, r:10, hp:hp, hpMax:hp, spd: rand(40,70) + level*2, boss:false });
  }
}

// -------------------- 攻撃（武器） --------------------
function fireWeapons(){
  weapons.forEach(w=>{
    if(w.type === 'normal'){
      const count = 4 + w.level;
      const spd = 280 + w.level * 25;
      for(let i=0;i<count;i++){
        const ang = (Math.PI*2)*(i/count) + rand(-0.04,0.04);
        bullets.push({ x:player.x, y:player.y, vx:Math.cos(ang)*spd, vy:Math.sin(ang)*spd, r:3, life:1.2, dmg: 3 + w.level });
      }
    } else if(w.type === 'homing'){
      for(let i=0;i<Math.max(1, Math.floor(w.level/1)); i++){
        bullets.push({ x:player.x, y:player.y, vx:0, vy:0, r:4, life:3, type:'homing', target:null, dmg: 2 + Math.floor(w.level/2) });
      }
    } else if(w.type === 'pierce'){
      const count = 1 + Math.floor(w.level/2);
      const spd = 360 + w.level*40;
      for(let i=0;i<count;i++){
        const ang = rand(0,Math.PI*2);
        bullets.push({ x:player.x, y:player.y, vx:Math.cos(ang)*spd, vy:Math.sin(ang)*spd, r:3, life:2.4, pierce:true, dmg: 2 + w.level });
      }
    }
  });
}

// -------------------- アイテム処理 --------------------
function spawnItem(type, x, y){
  // type: 'heal' or 'chest'
  items.push({ type, x, y, r:10, life:10, t: nowSec() });
}

function pickupItem(it){
  if(it.type === 'heal'){
    const healAmount = Math.floor(player.maxhp * (rand(0.20, 0.4)));
    player.hp = Math.min(player.maxhp, player.hp + healAmount);
    showDropNotice(`回復 +${healAmount}`);
  } else if(it.type === 'chest'){
    // chest: ランダムでレアリティ付き強化を1つ即時付与（武器 or passive）
    const rare = rollRarity();
    const choice = Math.random();
    if(choice < 0.6){
      // weapon or weapon-up
      const all = ['normal','homing','pierce'];
      const missing = all.filter(a => !weapons.find(w => w.type===a));
      if(missing.length > 0 && Math.random() < 0.6){
        const pick = missing[Math.floor(rand(0,missing.length))];
        weapons.push({ type: pick, level: 1 * rarityMultiplier(rare) });
        showDropNotice(`宝箱: 新武器 ${pick} ( ${rare} )`);
      } else {
        // 強化
        const target = weapons[Math.floor(rand(0, weapons.length))];
        target.level += rarityMultiplier(rare);
        showDropNotice(`宝箱: ${target.type} を強化 ( ${rare} )`);
      }
    } else {
      // passive
      const passiveList = ['maxhp','speed','firerate','defense'];
      const p = passiveList[Math.floor(rand(0, passiveList.length))];
      applyPassiveImmediate(p, rare);
      showDropNotice(`宝箱: パッシブ ${p} を獲得 ( ${rare} )`);
    }
  }
}

// drop notice
let dropNoticeTimer = 0;
function showDropNotice(text){
  dropNotice.textContent = text;
  dropNotice.style.display = 'block';
  dropNoticeTimer = 2.0;
}

// -------------------- レベルアップ（武器 & パッシブ同時抽選） --------------------
function makeWeaponOption(){
  // either new weapon (if missing) or weapon up
  const all = ['normal','homing','pierce'];
  const missing = all.filter(a => !weapons.find(w => w.type===a));
  if(missing.length > 0 && Math.random() < 0.5){
    const pick = missing[Math.floor(rand(0,missing.length))];
    const rarity = rollRarity();
    return { kind:'newWeapon', text:`新武器 ${pick}`, weapon:pick, rarity };
  } else {
    const target = weapons[Math.floor(rand(0,weapons.length))];
    const rarity = rollRarity();
    return { kind:'upgradeWeapon', text:`${target.type} を強化 (Lv${target.level} → )`, targetType: target.type, rarity };
  }
}

function makePassiveOption(){
  const passivePool = [
    { type:'maxhp', name:'HP最大値UP' },
    { type:'speed', name:'移動速度UP' },
    { type:'firerate', name:'攻撃速度UP' },
    { type:'defense', name:'ダメージ軽減' }
  ];
  const p = passivePool[Math.floor(rand(0, passivePool.length))];
  const rarity = rollRarity();
  return { kind:'passive', text: p.name, passiveType: p.type, rarity };
}

function showLevelUpChoices(){
  running = false;
  levelupDiv.style.display = 'block';
  colsDiv.innerHTML = '';

  // generate left column weapon options (2 options)
  const left = document.createElement('div'); left.className='col';
  const right = document.createElement('div'); right.className='col';

  const wepChoices = [makeWeaponOption(), makeWeaponOption()];
  const pasChoices = [makePassiveOption(), makePassiveOption()];

  const makeBtn = (o) => {
    const btn = document.createElement('button');
    btn.className = 'rarity-' + o.rarity;
    btn.style.display = 'block';
    btn.style.width = '90%';
    btn.style.margin = '8px auto';
    btn.textContent = `[${o.rarity.toUpperCase()}] ${o.text}`;
    btn.onclick = () => {
      applyChoice(o);
      levelupDiv.style.display = 'none';
      running = true;
    };
    return btn;
  };

  const titleL = document.createElement('div'); titleL.style.marginBottom='8px'; titleL.textContent = '武器候補';
  const titleR = document.createElement('div'); titleR.style.marginBottom='8px'; titleR.textContent = 'パッシブ候補';
  left.appendChild(titleL); right.appendChild(titleR);

  wepChoices.forEach(o => left.appendChild(makeBtn(o)));
  pasChoices.forEach(o => right.appendChild(makeBtn(o)));

  colsDiv.appendChild(left);
  colsDiv.appendChild(right);
}

function applyChoice(opt){
  const mul = rarityMultiplier(opt.rarity);
  if(opt.kind === 'newWeapon'){
    if(weapons.length < 3){
      weapons.push({ type: opt.weapon, level: 1 * mul });
    } else {
      // if full, instead boost random weapon
      weapons[Math.floor(rand(0, weapons.length))].level += mul;
    }
  } else if(opt.kind === 'upgradeWeapon'){
    const target = weapons.find(w => w.type === opt.targetType) || weapons[Math.floor(rand(0, weapons.length))];
    target.level += mul;
  } else if(opt.kind === 'passive'){
    applyPassiveImmediate(opt.passiveType, opt.rarity);
    passives.push(`${opt.passiveType}(${opt.rarity})`);
  }
  updateUI();
}

function applyPassiveImmediate(type, rarity){
  const m = rarityMultiplier(rarity);
  if(type === 'maxhp'){
    const add = 20 * m;
    player.maxhp += add; player.hp += add;
  } else if(type === 'speed'){
    player.speed += 20 * m;
  } else if(type === 'firerate'){
    player.fireRateMul *= Math.max(0.5, 1 - 0.08 * m);
  } else if(type === 'defense'){
    player.damageReduce += 0.04 * m;
    player.damageReduce = clamp(player.damageReduce, 0, 0.7);
  }
}

// -------------------- 更新ループ --------------------
function update(dt){
  if(!running) return;
  time += dt;

  // spawn acceleration
  spawnInterval = Math.max(0.18, 1.0 - time * 0.01); // timeが増えると早くなる
  // difficulty effect: hard reduces interval slightly more
  const effectiveSpawnInterval = difficulty==='hard' ? spawnInterval * 0.85 : spawnInterval;

  // movement: mouse + WASD
  let dx = mouse.x - player.x, dy = mouse.y - player.y;
  const d = Math.hypot(dx,dy);
  if(d > 1){
    player.x += (dx/d) * player.speed * dt * 0.85;
    player.y += (dy/d) * player.speed * dt * 0.85;
  }
  if(keys['a']||keys['arrowleft']) player.x -= player.speed * dt;
  if(keys['d']||keys['arrowright']) player.x += player.speed * dt;
  if(keys['w']||keys['arrowup']) player.y -= player.speed * dt;
  if(keys['s']||keys['arrowdown']) player.y += player.speed * dt;
  player.x = clamp(player.x, 0, W);
  player.y = clamp(player.y, 0, H);

  // firing
  fireTimer -= dt;
  const baseRate = 0.6;
  const rate = Math.max(0.08, baseRate * player.fireRateMul - (level * 0.015));
  if(fireTimer <= 0){
    fireWeapons();
    fireTimer = rate;
  }

  // spawn enemies
  spawnTimer -= dt;
  if(spawnTimer <= 0){
    spawnEnemy(false);
    spawnTimer = effectiveSpawnInterval * (Math.random()*0.4 + 0.8);
  }

  // boss spawn timer
  bossTimer -= dt;
  if(bossTimer <= 0){
    spawnEnemy(true);
    bossTimer = 60; // 次のボスまで60秒
  }

  // bullets update
  for(let i = bullets.length - 1; i >= 0; i--){
    const b = bullets[i];
    if(b.type === 'homing'){
      if(!b.target || !enemies.includes(b.target)){
        // find new target
        let best = null, bestd = 9999;
        for(const e of enemies){
          const dd = Math.hypot(e.x - b.x, e.y - b.y);
          if(dd < bestd){ bestd = dd; best = e; }
        }
        b.target = best;
      }
      if(b.target){
        const ang = Math.atan2(b.target.y - b.y, b.target.x - b.x);
        const speed = 240 + (b.dmg||0) * 10;
        b.vx = Math.cos(ang) * speed;
        b.vy = Math.sin(ang) * speed;
      }
    }
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if(b.life <= 0 || b.x < -50 || b.x > W+50 || b.y < -50 || b.y > H+50) bullets.splice(i,1);
  }

  // enemies update
  for(let i = enemies.length - 1; i >= 0; i--){
    const e = enemies[i];
    const ang = Math.atan2(player.y - e.y, player.x - e.x);
    e.x += Math.cos(ang) * e.spd * dt;
    e.y += Math.sin(ang) * e.spd * dt;

    // contact with player
    if(dist(e, player) < e.r + player.r){
      const baseDmg = e.boss ? 40 : 20;
      const dmg = baseDmg * (1 - player.damageReduce) * dt;
      player.hp -= dmg;
      // light knockback
      const k = 6;
      const dx = e.x - player.x, dy = e.y - player.y; const l = Math.hypot(dx,dy) || 1;
      e.x += (dx/l) * k; e.y += (dy/l) * k;
    }

    // bullets hit
    for(let j = bullets.length - 1; j >= 0; j--){
      const b = bullets[j];
      if(dist(e, b) < e.r + b.r){
        // damage
        e.hp -= b.dmg || 3;
        if(!b.pierce) { bullets.splice(j,1); }
        // particle
        particles.push({ x:b.x, y:b.y, vx:rand(-40,40), vy:rand(-40,40), life:0.4, r:2 });
      }
    }

    // dead?
    if(e.hp <= 0){
      // drops XP
      const baseXp = e.boss ? 20 : 2;
      xp += baseXp * (difficulty === 'hard' ? 1.5 : 1);
      // spawn items with probability
      if(Math.random() < 0.10) spawnItem('heal', e.x, e.y);
      if(Math.random() < 0.05) spawnItem('chest', e.x, e.y);
      // particles
      for(let p=0;p<8;p++) particles.push({ x:e.x, y:e.y, vx:rand(-80,80), vy:rand(-80,80), life:rand(0.3,0.7), r:2+Math.random()*2 });
      enemies.splice(i,1);
    }
  }

  // items update & pickup
  for(let i = items.length - 1; i >= 0; i--){
    const it = items[i];
    it.life -= dt;
    if(dist(it, player) < it.r + player.r){
      // pickup
      pickupItem(it);
      items.splice(i,1);
      continue;
    }
    if(it.life <= 0) items.splice(i,1);
  }

  // particles
  for(let i = particles.length - 1; i >= 0; i--){
    const p = particles[i];
    p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    if(p.life <= 0) particles.splice(i,1);
  }

  // level up
  while(xp >= nextXp){
    xp -= nextXp;
    level += 1;
    nextXp = Math.floor(nextXp * 1.6);
    // small HP restore on level
    player.hp = Math.min(player.maxhp, player.hp + Math.floor(10 + level * 2));
    // show choice UI
    showLevelUpChoices();
  }

  // death
  if(player.hp <= 0){
    running = false;
    menu.style.display = 'block';
  }

  // UI updates
  updateUI();

  // drop notice timer
  if(dropNoticeTimer > 0){
    dropNoticeTimer -= dt;
    if(dropNoticeTimer <= 0) { dropNotice.style.display = 'none'; }
  }
}

function updateUI(){
  hpEl.textContent = Math.max(0, Math.floor(player.hp));
  maxhpEl.textContent = Math.floor(player.maxhp);
  xpEl.textContent = Math.floor(xp);
  lvEl.textContent = level;
  nxpEl.textContent = nextXp;
  weaponsEl.textContent = weapons.map(w => `${w.type}(Lv${w.level})`).join(', ');
  passivesEl.textContent = passives.join(', ') || '—';
}

// -------------------- 描画 --------------------
function draw(){
  // background
  ctx.fillStyle = '#06060a'; ctx.fillRect(0,0,W,H);

  // items
  items.forEach(it => {
    if(it.type === 'heal'){
      ctx.fillStyle = '#ff6b6b';
      ctx.beginPath(); ctx.arc(it.x, it.y, it.r, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font='12px sans-serif'; ctx.textAlign='center'; ctx.fillText('❤', it.x, it.y+4);
    } else if(it.type === 'chest'){
      ctx.fillStyle = '#ffd36b';
      ctx.beginPath(); ctx.rect(it.x-10, it.y-8, 20, 16); ctx.fill();
      ctx.fillStyle = '#6b3'; ctx.font='11px sans-serif'; ctx.textAlign='center'; ctx.fillText('★', it.x, it.y+4);
    }
  });

  // enemies
  enemies.forEach(e => {
    ctx.beginPath();
    ctx.fillStyle = e.boss ? '#ff4d4d' : '#c33';
    ctx.arc(e.x, e.y, e.r, 0, Math.PI*2); ctx.fill();
    // HP bar
    const w = e.r*2; ctx.fillStyle = '#222'; ctx.fillRect(e.x - e.r, e.y - e.r - 8, w, 5);
    ctx.fillStyle = '#e44'; ctx.fillRect(e.x - e.r, e.y - e.r - 8, w * (e.hp / e.hpMax), 5);
  });

  // bullets
  bullets.forEach(b => {
    ctx.beginPath();
    if(b.type === 'homing') ctx.fillStyle = '#6ff';
    else if(b.pierce) ctx.fillStyle = '#ffb86b';
    else ctx.fillStyle = '#fff';
    ctx.arc(b.x, b.y, b.r, 0, Math.PI*2); ctx.fill();
  });

  // player
  ctx.beginPath(); ctx.fillStyle = '#6cf'; ctx.arc(player.x, player.y, player.r, 0, Math.PI*2); ctx.fill();
  // player aura (small)
  ctx.beginPath(); ctx.strokeStyle = 'rgba(120,200,255,0.08)'; ctx.lineWidth=1; ctx.arc(player.x, player.y, player.r+8, 0, Math.PI*2); ctx.stroke();

  // particles
  particles.forEach(p => {
    ctx.globalAlpha = Math.max(0, p.life / 0.6);
    ctx.beginPath(); ctx.fillStyle = '#ffd'; ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
  });

  // overlay for pause
  if(!running && levelupDiv.style.display==='none'){
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0,0,W,H);
    ctx.fillStyle = '#fff'; ctx.font='28px sans-serif'; ctx.textAlign='center';
    ctx.fillText('Press SPACE or choose difficulty to Start / Retry', W/2, H/2);
  }
}

// -------------------- ループ --------------------
let lastTick = nowSec();
function loop(){
  const t = nowSec();
  let dt = t - lastTick;
  if(dt > 0.05) dt = 0.05;
  lastTick = t;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// -------------------- その他ユーティリティ --------------------
function pickupItem(it){
  pickupItemImmediate(it);
}
function pickupItemImmediate(it){
  if(it.type === 'heal'){ const heal = Math.floor(player.maxhp * rand(0.2, 0.4)); player.hp = Math.min(player.maxhp, player.hp + heal); showDropNotice(`回復 +${heal}`); dropNoticeTimer = 2; }
  else if(it.type === 'chest'){ // chest effects
    const rare = rollRarity();
    if(Math.random() < 0.6){
      // weapon related
      const all = ['normal','homing','pierce'];
      const missing = all.filter(a => !weapons.find(w => w.type===a));
      if(missing.length > 0 && Math.random() < 0.6){
        const pick = missing[Math.floor(rand(0,missing.length))];
        weapons.push({ type: pick, level: 1 * rarityMultiplier(rare) });
        showDropNotice(`宝箱: 新武器 ${pick} (${rare})`); dropNoticeTimer = 2;
      } else {
        const target = weapons[Math.floor(rand(0, weapons.length))];
        target.level += rarityMultiplier(rare);
        showDropNotice(`宝箱: ${target.type} を強化 (${rare})`); dropNoticeTimer = 2;
      }
    } else {
      const plist = ['maxhp','speed','firerate','defense'];
      const p = plist[Math.floor(rand(0, plist.length))];
      applyPassiveImmediate(p, rollRarity());
      showDropNotice(`宝箱: パッシブ ${p} を獲得`); dropNoticeTimer = 2;
    }
  }
}

// immediate passive application (also used by chest)
function applyPassiveImmediate(type, rarity){
  const m = rarityMultiplier(rarity);
  if(type === 'maxhp'){ player.maxhp += 20 * m; player.hp = player.maxhp; passives.push(`MaxHP+${20*m}(${rarity})`); }
  else if(type === 'speed'){ player.speed += 20 * m; passives.push(`Speed+${20*m}(${rarity})`); }
  else if(type === 'firerate'){ player.fireRateMul *= Math.max(0.45, 1 - 0.1 * m); passives.push(`FireRate(${rarity})`); }
  else if(type === 'defense'){ player.damageReduce += 0.04 * m; player.damageReduce = clamp(player.damageReduce, 0, 0.7); passives.push(`Def-${Math.round(4*m)}%(${rarity})`); }
  updateUI();
}

// show notice wrapper
function showDropNotice(msg){
  dropNotice.textContent = msg;
  dropNotice.style.display = 'block';
  dropNoticeTimer = 2.2;
}

// -------------------- スペースでリスタート（メニューが表示中の時） --------------------
addEventListener('keydown', e => {
  if(e.key === ' ' && !running && menu.style.display === 'none'){
    // restart with previous difficulty
    startGame();
  }
});

</script>
</body>
</html>
