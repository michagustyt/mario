// ============================================================
//  SUPER MARIO BROS — HTML5 Canvas Recreation (Plus)
// ============================================================
const c = document.getElementById('c');
const ctx = c.getContext('2d');
const W = c.width = 640;
const H = c.height = 416;
const TILE = 32;

// ---- AUDIO ENGINE ----
let audioCtx = null;
function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}
function beep(freq, dur, type='square', vol=0.12, startFreq=null) {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.connect(g); g.connect(audioCtx.destination);
  o.type = type;
  if (startFreq) {
    o.frequency.setValueAtTime(startFreq, audioCtx.currentTime);
    o.frequency.exponentialRampToValueAtTime(freq, audioCtx.currentTime + dur * 0.8);
  } else {
    o.frequency.value = freq;
  }
  g.gain.setValueAtTime(vol, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
  o.start(); o.stop(audioCtx.currentTime + dur);
}
function sfxJump()    { beep(820, 0.14, 'square', 0.13, 380); }
function sfxCoin()    { beep(987, 0.07); setTimeout(()=>beep(1319,0.12),75); }
function sfxStomp()   { beep(160, 0.08, 'sawtooth', 0.18); }
function sfxDeath()   { [440,400,360,320,280,240,200].forEach((f,i)=>setTimeout(()=>beep(f,0.08,'square',0.12),i*80)); }
function sfxBlockHit(){ beep(120, 0.07, 'square', 0.1); }
function sfxFanfare() {
  const notes=[523,659,784,1047,784,1047];
  notes.forEach((f,i)=>setTimeout(()=>beep(f,0.12,'square',0.1),i*120));
}
function sfxPowerup() {
  [330,392,494,523,659,784,988].forEach((f,i)=>setTimeout(()=>beep(f,0.07,'square',0.1),i*60));
}

// ---- INPUT ----
const keys = {};
const vKeys = {}; // virtual (touch) keys
document.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code)) e.preventDefault();
  if ((e.code==='Space'||e.code==='Enter') && (state==='title'||state==='gameover'||state==='win')) {
    initAudio(); handleStart();
  }
});
document.addEventListener('keyup', e => { keys[e.code] = false; });

// Touch controls
function setupTouch(id, keyCode) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('touchstart', e=>{ e.preventDefault(); vKeys[keyCode]=true; initAudio(); }, {passive:false});
  el.addEventListener('touchend',   e=>{ e.preventDefault(); vKeys[keyCode]=false; }, {passive:false});
  el.addEventListener('mousedown',  e=>{ vKeys[keyCode]=true; initAudio(); });
  el.addEventListener('mouseup',    e=>{ vKeys[keyCode]=false; });
}
setupTouch('btn-left',  'ArrowLeft');
setupTouch('btn-right', 'ArrowRight');
setupTouch('btn-jump',  'Space');
function isKey(code) { return keys[code] || vKeys[code]; }

// ---- GAME STATE ----
let state = 'title'; // title | playing | dead | gameover | win
let score = 0, coinCount = 0, lives = 3;
let levelTimer = 300, timerTick = 0;
let camX = 0;
let animTick = 0;
let platforms = [], enemies = [], coinsArr = [], particles = [], items = [];
let marioWalking = false;
let currentLevelIndex = 0;

// ---- MARIO ----
const MARIO_W = 28, MARIO_H = 32, MARIO_BIG_H = 48;
const mario = {
  x:64, y:0, w:MARIO_W, h:MARIO_H,
  vx:0, vy:0, onGround:false,
  facing:1,
  frame:0, frameTimer:0,
  dead:false, deadTimer:0,
  invincible:0,
  big:false,
};

// ---- LEVEL CONSTANTS ----
const GROUND_Y = 12 * TILE; // y=384 top of ground
const WORLD_W  = 210 * TILE;

// ============================================================
//  LEVEL BUILDER
// ============================================================
function resetWorld() {
  platforms = []; enemies = []; coinsArr = []; particles = []; items = [];
}

function buildLevel(levelIndex) {
  resetWorld();
  levelTimer = levels[levelIndex].time || 300;
  levels[levelIndex].build();
}

function addGround(x) {
  platforms.push({x, y:GROUND_Y, w:TILE, h:TILE*3, type:'ground', solid:true});
}
function addBlock(x, y, type, content='coin') {
  platforms.push({x, y, w:TILE, h:TILE, type, solid:true, content, used:false, hitAnim:0});
}
function addPipe(x, y, h) {
  platforms.push({x:x-2, y, w:TILE+4, h:h*TILE, type:'pipe', solid:true});
}
function addCoin(x, y) {
  coinsArr.push({x:x*TILE+8, y:y*TILE, w:16, h:20, collected:false, anim:0});
}
function addEnemy(x) {
  enemies.push({
    x:x*TILE, y:GROUND_Y-30,
    w:28, h:28, vx:-1.5, vy:0,
    dead:false, deadTimer:0, squish:false,
    onGround:false, frame:0, frameTimer:0,
    active:false,
  });
}

function buildLevel1() {
  // --- GROUND (with 2 gaps) ---
  for (let i=0;i<68;i++)  addGround(i*TILE);
  // gap 68-70
  for (let i=70;i<120;i++) addGround(i*TILE);
  // gap 120-122
  for (let i=122;i<168;i++) addGround(i*TILE);
  for (let i=169;i<210;i++) addGround(i*TILE);

  // --- FLOATING BLOCKS: early zone ---
  addBlock(16*TILE, 8*TILE, 'question', 'mushroom');
  addBlock(21*TILE, 8*TILE, 'brick', 'coin');
  addBlock(22*TILE, 8*TILE, 'question', 'coin');
  addBlock(23*TILE, 8*TILE, 'brick', 'coin');
  addBlock(24*TILE, 8*TILE, 'question', 'coin');
  addBlock(25*TILE, 8*TILE, 'brick', 'coin');
  addBlock(22*TILE, 5*TILE, 'question', 'mushroom'); // high secret

  addBlock(38*TILE, 8*TILE, 'brick', 'coin');
  addBlock(39*TILE, 8*TILE, 'brick', 'coin');
  addBlock(40*TILE, 8*TILE, 'brick', 'coin');

  // --- PIPES ---
  addPipe(28*TILE, GROUND_Y - 2*TILE, 2);
  addPipe(37*TILE, GROUND_Y - 3*TILE, 3);
  addPipe(46*TILE, GROUND_Y - 4*TILE, 4);
  addPipe(57*TILE, GROUND_Y - 4*TILE, 4);

  // --- MID ZONE BLOCKS ---
  addBlock(77*TILE, 8*TILE, 'brick', 'coin');
  addBlock(78*TILE, 8*TILE, 'brick', 'coin');
  addBlock(79*TILE, 8*TILE, 'question', 'coin');
  addBlock(80*TILE, 8*TILE, 'brick', 'coin');

  addBlock(91*TILE, 8*TILE, 'brick', 'coin');
  addBlock(92*TILE, 8*TILE, 'question', 'mushroom');
  addBlock(93*TILE, 8*TILE, 'question', 'coin');
  addBlock(94*TILE, 8*TILE, 'brick', 'coin');

  addPipe(96*TILE,  GROUND_Y - 2*TILE, 2);
  addPipe(100*TILE, GROUND_Y - 2*TILE, 2);

  // Elevated platform (over gap area)
  for (let i=0;i<5;i++) addBlock((113+i)*TILE, 8*TILE, 'brick', 'coin');

  // --- STAIRCASE 1 ---
  for (let s=0;s<5;s++)
    for (let r=0;r<=s;r++)
      addBlock((130+s)*TILE, (11-r)*TILE, 'stair', 'coin');

  // Bridge over gap section
  for (let i=0;i<6;i++) addBlock((137+i)*TILE, 9*TILE, 'brick', 'coin');

  // --- EXTRA BLOCKS mid-late ---
  addBlock(148*TILE, 7*TILE, 'question', 'coin');
  addBlock(149*TILE, 7*TILE, 'question', 'coin');
  addBlock(150*TILE, 7*TILE, 'question', 'mushroom');
  addBlock(151*TILE, 7*TILE, 'brick', 'coin');
  addBlock(149*TILE, 4*TILE, 'question', 'coin'); // sky block

  addPipe(158*TILE, GROUND_Y-3*TILE, 3);
  addPipe(162*TILE, GROUND_Y-4*TILE, 4);

  // --- STAIRCASE 2 (before flag) ---
  for (let s=0;s<8;s++)
    for (let r=0;r<=s;r++)
      addBlock((173+s)*TILE, (11-r)*TILE, 'stair', 'coin');

  // --- FLAG POLE at 192*TILE ---
  const poleX = 192*TILE;
  platforms.push({x:poleX+10, y:3*TILE, w:5, h:GROUND_Y-3*TILE, type:'flagpole', solid:false, flagY:0});

  // --- CASTLE BLOCKS ---
  for (let cx=0;cx<6;cx++) {
    for (let cy=0;cy<5;cy++) {
      if (cy===0 && cx%2===0) continue; // battlement gap
      addBlock((194+cx)*TILE, (7+cy)*TILE, 'castle', 'coin');
    }
  }
  // Castle base
  for (let i=0;i<8;i++) addBlock((193+i)*TILE, 12*TILE, 'castle', 'coin');

  // --- COINS scattered ---
  const cpos = [
    [5,9],[6,9],[7,9],[10,9],[11,9],
    [72,9],[73,9],[74,9],
    [100,9],[101,9],[102,9],
    [140,9],[141,9],
  ];
  for (const [cx,cy] of cpos) addCoin(cx, cy);

  // --- ENEMIES ---
  const epos = [
    22,24, 37, 50,51, 62,63,
    75,80,81, 88,90,
    103,105,
    124,126,
    145,147,149,
    165,166,
  ];
  for (const ex of epos) addEnemy(ex);
}

function buildLevel2() {
  // Más plataformas, más pipes y un final diferente
  for (let i=0;i<40;i++) addGround(i*TILE);
  // primer gap
  for (let i=42;i<92;i++) addGround(i*TILE);
  // segundo gap
  for (let i=94;i<140;i++) addGround(i*TILE);
  // tercer gap
  for (let i=143;i<210;i++) addGround(i*TILE);

  // Bloques iniciales
  addBlock(12*TILE, 8*TILE, 'question', 'mushroom');
  addBlock(13*TILE, 8*TILE, 'brick', 'coin');
  addBlock(14*TILE, 8*TILE, 'question', 'coin');

  // Colina de ladrillos
  for (let i=0;i<6;i++) addBlock((26+i)*TILE, (9-i)*TILE, 'brick', 'coin');

  // Pipes
  addPipe(36*TILE, GROUND_Y - 2*TILE, 2);
  addPipe(45*TILE, GROUND_Y - 3*TILE, 3);
  addPipe(54*TILE, GROUND_Y - 4*TILE, 4);

  // Plataforma alta
  for (let i=0;i<7;i++) addBlock((68+i)*TILE, 6*TILE, 'brick', 'coin');
  addBlock(71*TILE, 4*TILE, 'question', 'mushroom');

  // Escalera doble
  for (let s=0;s<6;s++)
    for (let r=0;r<=s;r++)
      addBlock((90+s)*TILE, (11-r)*TILE, 'stair', 'coin');

  for (let s=0;s<6;s++)
    for (let r=0;r<=s;r++)
      addBlock((102+s)*TILE, (11-r)*TILE, 'stair', 'coin');

  // Bloques en el aire
  addBlock(118*TILE, 7*TILE, 'question', 'coin');
  addBlock(119*TILE, 7*TILE, 'question', 'coin');
  addBlock(120*TILE, 7*TILE, 'question', 'mushroom');
  addBlock(121*TILE, 7*TILE, 'brick', 'coin');

  // Últimos pipes
  addPipe(136*TILE, GROUND_Y - 2*TILE, 2);
  addPipe(148*TILE, GROUND_Y - 4*TILE, 4);

  // Flag
  const poleX = 186*TILE;
  platforms.push({x:poleX+10, y:3*TILE, w:5, h:GROUND_Y-3*TILE, type:'flagpole', solid:false, flagY:0});

  // Castle blocks
  for (let cx=0;cx<6;cx++) {
    for (let cy=0;cy<5;cy++) {
      if (cy===0 && cx%2===0) continue;
      addBlock((188+cx)*TILE, (7+cy)*TILE, 'castle', 'coin');
    }
  }
  for (let i=0;i<8;i++) addBlock((187+i)*TILE, 12*TILE, 'castle', 'coin');

  // Coins scattered
  const cpos = [
    [4,9],[5,9],[6,9],[7,9],
    [48,9],[49,9],[50,9],
    [72,6],[73,6],[74,6],
    [98,9],[99,9],
    [130,9],[131,9],[132,9],
  ];
  for (const [cx,cy] of cpos) addCoin(cx, cy);

  // Enemies
  const epos = [10,11, 22,24, 33,34, 44,46, 60,61, 70,72, 85,87, 112,114, 126,128, 150,152, 170,171];
  for (const ex of epos) addEnemy(ex);
}

const levels = [
  { name: '1-1', time: 300, build: buildLevel1 },
  { name: '1-2', time: 320, build: buildLevel2 },
];

// ============================================================
//  GAME LOGIC
// ============================================================
function handleStart() {
  if (state==='title') { startGame(); }
  else if (state==='gameover') { score=0; coinCount=0; lives=3; state='title'; }
  else if (state==='win') { state='title'; }
}

function startGame() {
  buildLevel(currentLevelIndex);
  mario.x=64; mario.y=GROUND_Y-MARIO_H;
  mario.vx=0; mario.vy=0; mario.dead=false; mario.invincible=0;
  mario.onGround=false; mario.frame=0; mario.facing=1;
  mario.big=false; mario.h=MARIO_H;
  camX=0; timerTick=0;
  state='playing';
}

function respawn() {
  mario.x=64; mario.y=GROUND_Y-(mario.big?MARIO_BIG_H:MARIO_H);
  mario.vx=0; mario.vy=0; mario.dead=false; mario.invincible=90;
  mario.onGround=false; mario.facing=1; camX=0; timerTick=0;
  buildLevel(currentLevelIndex);
  state='playing';
}

function aabb(a,b) {
  return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
}

function setMarioBig(isBig) {
  if (isBig === mario.big) return;
  const oldH = mario.h;
  mario.big = isBig;
  mario.h = isBig ? MARIO_BIG_H : MARIO_H;
  // Ajuste de altura para no atravesar el suelo
  mario.y -= (mario.h - oldH);
}

// ---- MARIO UPDATE ----
function updateMario() {
  if (mario.dead) {
    mario.deadTimer++;
    mario.vy += 0.45;
    mario.y  += mario.vy;
    if (mario.deadTimer > 140) {
      lives--;
      if (lives<=0) { state='gameover'; return; }
      respawn();
    }
    return;
  }
  if (mario.invincible>0) mario.invincible--;

  const sprint = isKey('ShiftLeft')||isKey('ShiftRight');
  const spd = sprint ? 5.5 : 3.8;

  if (isKey('ArrowLeft')||isKey('KeyA')) {
    mario.vx = Math.max(mario.vx-0.9, -spd);
    mario.facing=-1;
  } else if (isKey('ArrowRight')||isKey('KeyD')) {
    mario.vx = Math.min(mario.vx+0.9, spd);
    mario.facing=1;
  } else {
    mario.vx *= 0.78;
    if (Math.abs(mario.vx)<0.15) mario.vx=0;
  }

  if ((isKey('Space')||isKey('ArrowUp')||isKey('KeyW')) && mario.onGround) {
    mario.vy = mario.big ? -14.5 : -13.5;
    mario.onGround = false;
    sfxJump();
  }

  mario.vy += 0.58;
  if (mario.vy>16) mario.vy=16;

  // Horizontal move + resolve
  mario.x += mario.vx;
  if (mario.x < 0) { mario.x=0; mario.vx=0; }
  if (mario.x > WORLD_W - mario.w) { mario.x=WORLD_W-mario.w; mario.vx=0; }
  resolveX();

  // Vertical move + resolve
  mario.onGround = false;
  mario.y += mario.vy;
  resolveY();

  // Pit death
  if (mario.y > H+100) killMario();

  // Coins
  for (const coin of coinsArr) {
    if (!coin.collected && aabb(mario,coin)) {
      coin.collected=true; coinCount++; score+=200; sfxCoin();
      spawnText(coin.x, coin.y, '+200', '#FFD700');
    }
  }

  // Items
  for (const it of items) {
    if (!it.collected && aabb(mario, it)) {
      it.collected = true;
      if (it.type==='mushroom') {
        score += 1000;
        if (!mario.big) {
          setMarioBig(true);
        }
        sfxPowerup();
        spawnText(it.x, it.y-10, '+1000', '#A0FF80');
      }
    }
  }

  // Flag pole check
  const pole = platforms.find(p=>p.type==='flagpole');
  if (pole && mario.x+mario.w > pole.x && mario.x < pole.x+20) {
    score += Math.floor(levelTimer)*50;
    sfxFanfare();
    state='win';
    return;
  }

  // Animation
  mario.frameTimer++;
  if (!mario.onGround) {
    mario.frame=2;
  } else if (Math.abs(mario.vx)>0.3) {
    if (mario.frameTimer>=7) { mario.frame=(mario.frame+1)%3; mario.frameTimer=0; }
    if (mario.frame===2) mario.frame=0;
  } else {
    mario.frame=0; mario.frameTimer=0;
  }
}

function resolveX() {
  const mr = {x:mario.x, y:mario.y, w:mario.w, h:mario.h};
  for (const p of platforms) {
    if (!p.solid || !aabb(mr,p)) continue;
    if (mario.x+mario.w/2 < p.x+p.w/2) {
      mario.x = p.x - mario.w; mario.vx=0;
    } else {
      mario.x = p.x+p.w; mario.vx=0;
    }
    mr.x = mario.x;
  }
}

function resolveY() {
  const mr = {x:mario.x, y:mario.y, w:mario.w, h:mario.h};
  for (const p of platforms) {
    if (!p.solid || !aabb(mr,p)) continue;
    if (mario.vy>=0) {
      mario.y = p.y - mario.h;
      mario.vy=0; mario.onGround=true;
    } else {
      mario.y = p.y + p.h;
      mario.vy=0;
      triggerBlock(p);
    }
    mr.y = mario.y;
  }
}

function triggerBlock(p) {
  if ((p.type==='question'||p.type==='brick') && !p.used) {
    p.used=true; p.hitAnim=10;
    if (p.content === 'coin' || p.type==='question') {
      score+=200; coinCount++;
      sfxCoin();
      particles.push({x:p.x+TILE/2, y:p.y-8, vx:0, vy:-5, type:'coinpop', life:40});
      spawnText(p.x+4, p.y-20, '+200', '#FFD700');
    }
    if (p.content === 'mushroom') {
      spawnMushroom(p.x, p.y-4);
      sfxPowerup();
    }
  } else if (!p.used) {
    sfxBlockHit();
  }
}

function spawnMushroom(x, y) {
  items.push({x:x+6, y:y-10, w:20, h:20, vx:1.2, vy:0, type:'mushroom', collected:false});
}

function killMario() {
  if (mario.dead) return;
  mario.dead=true; mario.vy=-12; mario.vx=0; mario.deadTimer=0;
  sfxDeath();
}

// ---- ENEMIES UPDATE ----
function updateEnemies() {
  for (const e of enemies) {
    if (!e.active && Math.abs(e.x - mario.x) < W*1.5) e.active=true;
    if (!e.active) continue;

    if (e.dead) {
      e.deadTimer++;
      if (!e.squish) {
        e.vy+=0.55; e.y+=e.vy;
      }
      if (e.y > H+100 || (e.squish && e.deadTimer>35)) { e.active=false; }
      e.frameTimer++;
      if (e.frameTimer>8) { e.frame=(e.frame+1)%2; e.frameTimer=0; }
      continue;
    }

    // Horizontal
    e.x += e.vx;
    for (const p of platforms) {
      if (!p.solid) continue;
      const er = {x:e.x, y:e.y+2, w:e.w, h:e.h-2};
      if (!aabb(er,p)) continue;
      e.vx *= -1; e.x += e.vx*2;
    }

    // Gravity
    e.vy += 0.55; if (e.vy>15) e.vy=15;
    e.y  += e.vy;
    e.onGround=false;
    for (const p of platforms) {
      if (!p.solid) continue;
      if (!aabb(e,p)) continue;
      if (e.vy>=0) {
        e.y=p.y-e.h; e.vy=0; e.onGround=true;
      } else {
        e.y=p.y+p.h; e.vy=0;
      }
    }

    if (e.y > H+100) { e.dead=true; continue; }

    // World bounds
    if (e.x < 0) { e.x=0; e.vx=Math.abs(e.vx); }

    // Frame
    e.frameTimer++;
    if (e.frameTimer>=10) { e.frame=(e.frame+1)%2; e.frameTimer=0; }

    // Collision with mario
    if (!mario.dead && mario.invincible===0 && aabb(mario,e)) {
      const mBot = mario.y+mario.h;
      const eTop = e.y+4;
      if (mario.vy>0 && mBot < eTop+18) {
        e.dead=true; e.squish=true; e.deadTimer=0;
        mario.vy=-9; score+=100;
        sfxStomp();
        spawnText(e.x+4, e.y-12, '+100', '#FFFFFF');
      } else {
        if (mario.big) {
          setMarioBig(false);
          mario.invincible = 90;
        } else {
          killMario();
        }
      }
    }
  }
}

// ---- ITEMS UPDATE ----
function updateItems() {
  for (const it of items) {
    if (it.collected) continue;
    it.x += it.vx;
    it.vy += 0.5; if (it.vy>10) it.vy=10;
    it.y += it.vy;

    // Collide with platforms
    for (const p of platforms) {
      if (!p.solid) continue;
      if (!aabb(it,p)) continue;
      // From sides
      if (it.x+it.w/2 < p.x+p.w/2) {
        it.x = p.x - it.w; it.vx *= -1;
      } else if (it.x+it.w/2 > p.x+p.w/2 && it.y < p.y) {
        it.x = p.x + p.w; it.vx *= -1;
      }
      // From top
      if (it.vy>0 && it.y+it.h > p.y && it.y < p.y) {
        it.y = p.y - it.h; it.vy = 0;
      }
    }

    if (it.y > H+100) it.collected = true;
  }
}

// ---- PARTICLES / FLOATING TEXT ----
function spawnText(x, y, text, color) {
  particles.push({x, y, type:'text', text, color, vy:-1.5, life:55});
}
function updateParticles() {
  particles = particles.filter(p=>p.life>0);
  for (const p of particles) {
    p.y += p.vy||0;
    if (p.vy!==undefined) p.vy+=0.12;
    p.life--;
  }
}

// ---- COIN ANIMATION ----
function updateCoins() {
  for (const c of coinsArr) {
    if (!c.collected) {
      c.anim = (c.anim+1)%40;
    }
  }
}

// ---- CAMERA ----
function updateCamera() {
  const target = mario.x - W*0.35;
  camX = Math.max(0, Math.min(target, WORLD_W-W));
}

// ---- TIMER ----
function updateTimer() {
  timerTick++;
  if (timerTick>=40) { timerTick=0; levelTimer=Math.max(0,levelTimer-1); }
  if (levelTimer===0) killMario();
}

// ============================================================
//  DRAWING
// ============================================================
function wx(worldX) { return worldX - camX; }

// ---- BACKGROUND ----
function drawBackground() {
  // Sky gradient
  const g = ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#5C8FFF');
  g.addColorStop(1,'#7CB8FF');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);

  // Clouds
  ctx.fillStyle='#FFFFFF';
  const clouds = [180,520,900,1420,2000,2800,3600,4400,5200];
  for (const cx of clouds) {
    const sx = ((cx - camX*0.35) % (W+220)) - 60;
    drawCloud(sx, 55);
    drawCloud(sx+320, 80);
  }

  // Hills
  const hills = [80,460,1100,1900,2700,3500,4400];
  for (const hx of hills) {
    const sx = ((hx - camX*0.6) % (W+300)) - 80;
    drawHill(sx, GROUND_Y-10, 110, 80, '#28A028', '#40B840');
    drawHill(sx+200, GROUND_Y-10, 70, 50, '#22982A', '#3AAA38');
  }
}

function drawCloud(x,y) {
  ctx.beginPath();
  ctx.arc(x+30,y+22,18,0,Math.PI*2);
  ctx.arc(x+52,y+12,26,0,Math.PI*2);
  ctx.arc(x+80,y+22,18,0,Math.PI*2);
  ctx.fill();
}
function drawHill(x,y,w,h,c1,c2) {
  ctx.fillStyle=c1;
  ctx.beginPath(); ctx.arc(x+w/2,y,w/2,Math.PI,0); ctx.fill();
  ctx.fillStyle=c2;
  ctx.beginPath(); ctx.arc(x+w/2,y-h*0.3,w*0.35,Math.PI,0); ctx.fill();
}

// ---- TILES ----
function drawPlatforms() {
  for (const p of platforms) {
    const sx = wx(p.x);
    if (sx > W+64 || sx+p.w < -64) continue;

    const ho = p.hitAnim>0 ? -p.hitAnim : 0;
    if (p.hitAnim>0) p.hitAnim--;
    const py = p.y + ho;

    ctx.save();
    switch(p.type) {
      case 'ground':
        ctx.fillStyle='#E86820'; ctx.fillRect(sx,py,p.w,p.h);
        ctx.fillStyle='#F89040'; ctx.fillRect(sx+1,py+1,p.w-2,7);
        ctx.fillStyle='#A04808'; ctx.fillRect(sx,py+10,p.w,p.h-10);
        ctx.fillStyle='#803000';
        ctx.fillRect(sx+TILE/2,py+10,2,p.h-10);
        ctx.fillRect(sx,py+TILE/2,p.w,2);
        ctx.fillStyle='rgba(255,255,255,0.1)'; ctx.fillRect(sx+1,py+1,4,8);
        break;

      case 'brick':
        if (!p.used) {
          ctx.fillStyle='#CC4410'; ctx.fillRect(sx,py,p.w,p.h);
          ctx.fillStyle='#AA3000'; ctx.fillRect(sx,py,p.w,2); ctx.fillRect(sx,py,2,p.h);
          ctx.fillStyle='#E86030';
          ctx.fillRect(sx+3,py+3, p.w/2-5, p.h/2-5);
          ctx.fillRect(sx+TILE/2+2,py+p.h/2+2, p.w/2-5, p.h/2-5);
          ctx.fillStyle='#AA3000';
          ctx.fillRect(sx,py+p.h/2,p.w,2); ctx.fillRect(sx+p.w/2,py,2,p.w/2);
          ctx.fillRect(sx,py+p.h/2+1,p.w/2,2); ctx.fillRect(sx+p.w/2,py+p.h/2,2,p.w/2);
        } else {
          ctx.fillStyle='#A05025'; ctx.fillRect(sx,py,p.w,p.h);
          ctx.fillStyle='#804020'; ctx.fillRect(sx,py,p.w,2);
        }
        break;

      case 'question':
        if (!p.used) {
          const qb = Math.floor(animTick/8)%2===0;
          ctx.fillStyle = qb ? '#FFC000' : '#FFD840';
          ctx.fillRect(sx,py,p.w,p.h);
          ctx.fillStyle='#C08000'; ctx.fillRect(sx,py,p.w,3); ctx.fillRect(sx,py,3,p.h);
          ctx.fillRect(sx+p.w-3,py,3,p.h); ctx.fillRect(sx,py+p.h-3,p.w,3);
          ctx.fillStyle='#804000';
          ctx.font='bold 20px monospace'; ctx.fillText('?',sx+10,py+23);
          ctx.fillStyle='rgba(255,255,200,0.5)'; ctx.fillRect(sx+3,py+3,8,5);
        } else {
          ctx.fillStyle='#707070'; ctx.fillRect(sx,py,p.w,p.h);
          ctx.fillStyle='#505050'; ctx.fillRect(sx,py,p.w,3); ctx.fillRect(sx,py,3,p.h);
          ctx.fillRect(sx+p.w-3,py,3,p.h); ctx.fillRect(sx,py+p.h-3,p.w,3);
        }
        break;

      case 'pipe': {
        const pw=p.w, ph=p.h;
        ctx.fillStyle='#00A020'; ctx.fillRect(sx+6,py+30,pw-12,ph-30);
        ctx.fillStyle='#009818'; ctx.fillRect(sx+6,py+30,pw-12,ph-30);
        ctx.fillStyle='#00C828'; ctx.fillRect(sx+8,py+32,6,ph-34);
        ctx.fillStyle='#00B828'; ctx.fillRect(sx,py,pw,28);
        ctx.fillStyle='#00D840'; ctx.fillRect(sx+4,py+2,8,24);
        ctx.fillStyle='#008018'; ctx.fillRect(sx,py,pw,3);
        ctx.fillStyle='#006810'; ctx.fillRect(sx+pw-12,py+30,6,ph-30);
        break;
      }

      case 'stair':
      case 'castle':
        ctx.fillStyle = p.type==='stair' ? '#CC4410' : '#909090';
        ctx.fillRect(sx,py,p.w,p.h);
        ctx.fillStyle = p.type==='stair' ? '#AA3000' : '#707070';
        ctx.fillRect(sx,py,p.w,3); ctx.fillRect(sx,py,3,p.h);
        if (p.type==='stair') {
          ctx.fillStyle='#E07030'; ctx.fillRect(sx+3,py+3,p.w-6,7);
        } else {
          ctx.fillStyle='#808080'; ctx.fillRect(sx+3,py+3,p.w-6,p.h-6);
        }
        break;

      case 'flagpole': {
        const psx = wx(p.x);
        ctx.fillStyle='#C0C0C0'; ctx.fillRect(psx,p.y,5,p.h);
        ctx.fillStyle='#E0E0E0'; ctx.fillRect(psx+1,p.y,2,p.h);
        ctx.fillStyle='#FFD700';
        ctx.beginPath(); ctx.arc(psx+2,p.y+5,7,0,Math.PI*2); ctx.fill();
        const flagOffset = Math.min(animTick*0.3, p.h-30);
        ctx.fillStyle='#00BB00';
        ctx.fillRect(psx+5, p.y+flagOffset, 26, 20);
        ctx.fillStyle='#00DD00'; ctx.fillRect(psx+6,p.y+flagOffset+1,10,8);
        break;
      }
    }
    ctx.restore();
  }
}

// ---- COINS ----
function drawCoins() {
  for (const coin of coinsArr) {
    if (coin.collected) continue;
    const sx = wx(coin.x);
    if (sx<-20||sx>W+20) continue;
    const shimmer = coin.anim < 20;
    const floatY = Math.sin(coin.anim/40*Math.PI*2)*2;
    const cy = coin.y + floatY;
    ctx.fillStyle = shimmer ? '#FFE040' : '#FFB800';
    ctx.fillRect(sx+2,cy,12,18);
    ctx.fillRect(sx,cy+3,16,12);
    ctx.fillStyle='#FFFF80';
    ctx.fillRect(sx+4,cy+1,4,14);
    ctx.fillStyle='rgba(255,255,255,0.5)'; ctx.fillRect(sx+4,cy+2,3,4);
  }
}

// ---- ITEMS ----
function drawItems() {
  for (const it of items) {
    if (it.collected) continue;
    const sx = wx(it.x);
    if (sx<-20||sx>W+20) continue;
    if (it.type==='mushroom') {
      ctx.fillStyle='#E83018'; ctx.fillRect(sx, it.y, it.w, it.h-6);
      ctx.fillStyle='#F8D030'; ctx.fillRect(sx, it.y+it.h-6, it.w, 6);
      ctx.fillStyle='#FFFFFF'; ctx.fillRect(sx+4, it.y+4, 4, 4); ctx.fillRect(sx+12, it.y+4, 4, 4);
    }
  }
}

// ---- PARTICLES ----
function drawParticles() {
  for (const p of particles) {
    const sx = wx(p.x);
    if (p.type==='coinpop') {
      ctx.fillStyle=`rgba(255,215,0,${p.life/40})`;
      ctx.fillRect(sx-6,p.y,12,18);
      ctx.fillRect(sx-8,p.y+3,16,12);
    } else if (p.type==='text') {
      ctx.globalAlpha = Math.min(1, p.life/20);
      ctx.fillStyle = p.color||'#FFFFFF';
      ctx.font='bold 11px "Press Start 2P",monospace';
      ctx.fillText(p.text, sx, p.y);
      ctx.globalAlpha=1;
    }
  }
}

// ---- MARIO SPRITE ----
function drawMario() {
  if (!mario.dead && mario.invincible>0 && Math.floor(mario.invincible/5)%2===0) return;
  const sx = wx(mario.x), sy = mario.y;

  ctx.save();
  if (mario.facing===-1) {
    ctx.translate(sx+mario.w, sy);
    ctx.scale(-1,1);
    drawMarioPixels(0,0, mario.dead?3:mario.frame, mario.big);
  } else {
    drawMarioPixels(sx, sy, mario.dead?3:mario.frame, mario.big);
  }
  ctx.restore();
}

function drawMarioPixels(x,y,frame,isBig=false) {
  const R='#E83018', B='#0028F8', S='#F8B040', Br='#C07030', Dk='#401808';
  const yOffset = isBig ? -16 : 0;
  const y0 = y + yOffset;

  // Hat
  ctx.fillStyle=R;  ctx.fillRect(x+4,y0,   20,6);
                    ctx.fillRect(x+0,y0+6,  27,6);
  // Hair sides
  ctx.fillStyle=Br; ctx.fillRect(x+0,y0+12,4,4); ctx.fillRect(x+22,y0+12,5,4);
  // Face
  ctx.fillStyle=S;  ctx.fillRect(x+4,y0+12,20,10);
  // Eyes
  ctx.fillStyle=Dk; ctx.fillRect(x+8,y0+14,4,4);
  // Mustache
  ctx.fillStyle=Br; ctx.fillRect(x+2,y0+20,8,4); ctx.fillRect(x+14,y0+20,10,4);
  // Nose
  ctx.fillStyle=S;  ctx.fillRect(x+10,y0+18,8,4);
  // Body / overalls
  ctx.fillStyle=B;  ctx.fillRect(x+2,y0+22,24,8);
  // Buttons
  ctx.fillStyle='#F0D000'; ctx.fillRect(x+7,y0+24,4,4); ctx.fillRect(x+17,y0+24,4,4);
  // Arms (red)
  ctx.fillStyle=R;
  if (frame===2) {
    ctx.fillRect(x-2,y0+16,6,10); ctx.fillRect(x+24,y0+16,6,10);
  } else {
    ctx.fillRect(x-2,y0+22,6,8); ctx.fillRect(x+24,y0+22,6,8);
  }
  // Hands
  ctx.fillStyle=S;
  if (frame===2) { ctx.fillRect(x-2,y0+26,6,4); ctx.fillRect(x+24,y0+26,6,4); }
  else           { ctx.fillRect(x-2,y0+28,6,4); ctx.fillRect(x+24,y0+28,6,4); }

  // Big body segment
  if (isBig) {
    ctx.fillStyle=R; ctx.fillRect(x+2,y0+30,24,6);
    ctx.fillStyle=B; ctx.fillRect(x+4,y0+36,20,6);
  }

  // Legs / shoes
  const legY = isBig ? y0+38 : y0+30;
  if (frame===0 || frame===3) {
    ctx.fillStyle=B;  ctx.fillRect(x+2,legY,10,6); ctx.fillRect(x+16,legY,10,6);
    ctx.fillStyle=Dk; ctx.fillRect(x+0,legY+6,14,4); ctx.fillRect(x+14,legY+6,14,4);
  } else if (frame===1) {
    ctx.fillStyle=B;  ctx.fillRect(x+0,legY,12,8); ctx.fillRect(x+16,legY-2,10,6);
    ctx.fillStyle=Dk; ctx.fillRect(x+0,legY+8,12,4); ctx.fillRect(x+18,legY+4,8,4);
  } else if (frame===2) {
    ctx.fillStyle=B;  ctx.fillRect(x+0,legY-2,10,6); ctx.fillRect(x+18,legY,10,6);
    ctx.fillStyle=Dk; ctx.fillRect(x-2,legY+4,12,4); ctx.fillRect(x+20,legY+6,10,4);
  }
}

// ---- GOOMBA SPRITE ----
function drawEnemies() {
  for (const e of enemies) {
    if (!e.active) continue;
    const sx=wx(e.x), sy=e.y;
    if (sx>W+32||sx+e.w<-32) continue;

    if (e.squish && e.dead) {
      ctx.fillStyle='#B05800'; ctx.fillRect(sx,sy+e.h-8,e.w,8);
      ctx.fillStyle='#803800'; ctx.fillRect(sx+3,sy+e.h-6,e.w-6,4);
      ctx.fillStyle='#F0F0F0'; ctx.fillRect(sx+2,sy+e.h-10,7,5); ctx.fillRect(sx+e.w-9,sy+e.h-10,7,5);
      ctx.fillStyle='#000'; ctx.fillRect(sx+4,sy+e.h-9,3,3); ctx.fillRect(sx+e.w-7,sy+e.h-9,3,3);
      continue;
    }

    const f=e.frame;
    ctx.fillStyle='#B05810'; ctx.fillRect(sx,sy+6,e.w,e.h-10);
    ctx.fillStyle='#D07830'; ctx.fillRect(sx-2,sy,e.w+4,e.h*0.55);
    ctx.fillStyle='#F8F8F8';
    ctx.fillRect(sx+2,sy+5,9,9); ctx.fillRect(sx+e.w-11,sy+5,9,9);
    ctx.fillStyle='#000';
    const ex = f===0?1:3;
    ctx.fillRect(sx+3+ex,sy+7,5,5); ctx.fillRect(sx+e.w-12+ex,sy+7,5,5);
    ctx.fillStyle='#401800';
    ctx.save();
    ctx.translate(sx+6,sy+4); ctx.rotate(-0.3); ctx.fillRect(0,0,9,3); ctx.restore();
    ctx.save();
    ctx.translate(sx+e.w-15,sy+4); ctx.rotate(0.3); ctx.fillRect(0,0,9,3); ctx.restore();
    ctx.fillStyle='#803000';
    if (f===0) {
      ctx.fillRect(sx,sy+e.h-10,10,10); ctx.fillRect(sx+e.w-10,sy+e.h-10,10,10);
    } else {
      ctx.fillRect(sx+4,sy+e.h-10,10,10); ctx.fillRect(sx+e.w-14,sy+e.h-10,10,10);
    }
    ctx.fillStyle='rgba(255,200,100,0.2)'; ctx.fillRect(sx+2,sy+3,8,5);
  }
}

// ---- HUD ----
function drawHUD() {
  ctx.fillStyle='rgba(0,0,0,0.65)'; ctx.fillRect(0,0,W,40);
  ctx.fillStyle='#F8F8F8';
  ctx.font='13px "Press Start 2P",monospace';

  ctx.fillText('MARIO', 14, 17);
  ctx.fillStyle='#F8F8F8';
  ctx.fillText(String(score).padStart(6,'0'), 14, 34);

  ctx.fillStyle='#FFD700';
  ctx.fillRect(190, 10, 10, 16); ctx.fillRect(188, 13, 14, 10);
  ctx.fillStyle='#F8F8F8';
  ctx.fillText(`×${String(coinCount).padStart(2,'0')}`, 205, 26);

  ctx.fillText('WORLD', 278, 17);
  ctx.fillText(levels[currentLevelIndex].name,   294, 34);

  ctx.fillStyle = levelTimer<100 ? '#FF3030' : '#F8F8F8';
  ctx.fillText('TIME', 400, 17);
  ctx.fillText(String(Math.floor(levelTimer)).padStart(3,'0'), 402, 34);

  ctx.fillStyle='#F8F8F8';
  ctx.fillText(`♥ ×${lives}`, 510, 26);
}

// ---- SCREENS ----
function drawTitle() {
  const g=ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#2255CC'); g.addColorStop(1,'#4488FF');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);

  ctx.fillStyle='rgba(255,255,255,0.8)';
  const stars=[[80,40],[160,90],[300,30],[450,70],[550,45],[620,100],[30,130]];
  for (const [sx,sy] of stars) ctx.fillRect(sx,sy,3,3);

  ctx.fillStyle='#000088';
  ctx.fillRect(50,50,W-100,90);
  ctx.strokeStyle='#FFD700'; ctx.lineWidth=4;
  ctx.strokeRect(50,50,W-100,90);

  ctx.textAlign='center';
  ctx.fillStyle='#FFD700';
  ctx.font='28px "Press Start 2P",monospace';
  ctx.fillText('SUPER MARIO', W/2, 95);
  ctx.fillStyle='#FF4444';
  ctx.font='36px "Press Start 2P",monospace';
  ctx.fillText('BROS', W/2, 130);

  if (Math.floor(animTick/25)%2===0) {
    ctx.fillStyle='#FFFFFF';
    ctx.font='13px "Press Start 2P",monospace';
    ctx.fillText('PRESS ENTER / SPACE', W/2, 195);
  }

  ctx.fillStyle='#AAAAFF';
  ctx.font='9px "Press Start 2P",monospace';
  ctx.fillText('← → MOVER    SPACE SALTAR    SHIFT CORRER', W/2, 230);

  ctx.fillStyle='#FFFFFF';
  ctx.font='10px "Press Start 2P",monospace';
  ctx.fillText('SELECCIONA NIVEL (↑/↓)', W/2, 260);

  levels.forEach((lvl, i) => {
    ctx.fillStyle = i===currentLevelIndex ? '#FFD700' : '#FFFFFF';
    ctx.fillText(`> ${lvl.name}`, W/2, 285 + i*18);
  });

  const mx = W/2 - 14 + Math.sin(animTick*0.05)*3;
  const mf = Math.floor(animTick/10)%3;
  drawMarioPixels(mx, 320, mf, false);

  ctx.fillStyle='#E86820';
  ctx.fillRect(0,340,W,4);
  ctx.fillRect(0,344,W,80);

  ctx.fillStyle='#808090'; ctx.font='9px "Press Start 2P",monospace';
  ctx.fillText('Recreación educativa — © Inspirado en Nintendo 1985', W/2, 402);
  ctx.textAlign='left';
}

function drawGameOver() {
  ctx.fillStyle='rgba(0,0,0,0.75)'; ctx.fillRect(0,0,W,H);
  ctx.textAlign='center';
  ctx.fillStyle='#FF2020';
  ctx.font='30px "Press Start 2P",monospace';
  ctx.fillText('GAME OVER', W/2, H/2-30);
  ctx.fillStyle='#FFFFFF';
  ctx.font='12px "Press Start 2P",monospace';
  ctx.fillText(`SCORE: ${score}`, W/2, H/2+10);
  if (Math.floor(animTick/25)%2===0) {
    ctx.fillText('ENTER para reiniciar', W/2, H/2+45);
  }
  ctx.textAlign='left';
}

function drawWin() {
  ctx.fillStyle='rgba(0,0,80,0.78)'; ctx.fillRect(0,0,W,H);
  ctx.textAlign='center';
  ctx.fillStyle='#FFD700';
  ctx.font='22px "Press Start 2P",monospace';
  ctx.fillText('¡NIVEL COMPLETADO!', W/2, H/2-60);
  ctx.fillStyle='#FFFFFF';
  ctx.font='14px "Press Start 2P",monospace';
  ctx.fillText(`SCORE: ${String(score).padStart(6,'0')}`, W/2, H/2-20);
  ctx.fillText(`MONEDAS: ×${coinCount}`, W/2, H/2+10);
  ctx.fillStyle='#AAFFAA';
  ctx.font='10px "Press Start 2P",monospace';
  ctx.fillText(`TIEMPO RESTANTE: ${Math.floor(levelTimer)}`, W/2, H/2+40);
  if (Math.floor(animTick/25)%2===0) {
    ctx.fillStyle='#FFFFFF';
    ctx.fillText('ENTER para continuar', W/2, H/2+75);
  }
  ctx.textAlign='left';
}

// ============================================================
//  MAIN LOOP
// ============================================================
function loop() {
  animTick++;
  ctx.clearRect(0,0,W,H);

  if (state==='title') {
    if (isKey('ArrowUp')) { currentLevelIndex = (currentLevelIndex-1+levels.length)%levels.length; keys['ArrowUp']=false; }
    if (isKey('ArrowDown')) { currentLevelIndex = (currentLevelIndex+1)%levels.length; keys['ArrowDown']=false; }
    drawTitle();
    requestAnimationFrame(loop);
    return;
  }

  if (state==='playing') {
    updateTimer();
    updateMario();
    updateEnemies();
    updateItems();
    updateCoins();
    updateCamera();
    updateParticles();
  }

  if (state==='playing'||state==='dead'||state==='win') {
    drawBackground();
    drawPlatforms();
    drawCoins();
    drawItems();
    drawEnemies();
    drawMario();
    drawParticles();
    drawHUD();
  }

  if (state==='gameover') {
    drawBackground(); drawHUD(); drawGameOver();
  }
  if (state==='win') {
    updateCamera();
    drawWin();
  }

  requestAnimationFrame(loop);
}

loop();
