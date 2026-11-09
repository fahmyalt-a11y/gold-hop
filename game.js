const TILE = 16;
const VIEW_W = 480;
const VIEW_H = 270;
const GRAV = 0.34;
const JUMP_V = -6.85;
const MOVE = 1.75;
const MAX_FALL = 7.2;

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
const stage = document.getElementById("stage");
const pad = document.getElementById("pad");
const panels = ["menu", "device", "system", "how", "over", "hack", "credits"].map((id) =>
  document.getElementById(id)
);

ctx.imageSmoothingEnabled = false;

const world = createWorld();
const monsterSpawns = [];
let checkpoint = null;
const playerStart = { x: 40, y: 40 };
extractMarkers();

const player = {
  x: playerStart.x,
  y: playerStart.y,
  w: 12,
  h: 14,
  vx: 0,
  vy: 0,
  face: 1,
  prevBottom: 0,
  landedVy: 0,
};
let enemies = [];
let spawn = { x: playerStart.x, y: playerStart.y };
let lives = 3;
let stomps = 0;
let passedCheckpoint = false;
let state = "menu";
let onGround = true;
let coyote = 12;
let jumpBuffer = 0;
let jumpQueued = false;
let iframe = 0;
let hintTime = 0;
let camX = 0;
let attract = 0;
let shake = 0;
let clearTimer = 0;
let particles = [];
let anim = 0;
let hackT0 = 0;
let hackDone = false;
let creditTimer = 0;
let audioCtx = null;
const rig = { device: "pc", system: "mac" };

const goldSpan = findGoldSpan();
const keys = new Set();
const clouds = Array.from({ length: 7 }, (_, i) => ({
  x: 30 + i * 250,
  y: 18 + (i % 3) * 26,
  w: 36 + (i % 3) * 14,
}));

const PACKS = {
  ios: [
    ["Photos", "IMG_1842.HEIC", 3.4],
    ["Photos", "IMG_1843.HEIC", 2.8],
    ["Files", "Notes.txt", 0.02],
    ["Downloads", "scan.pdf", 0.7],
    ["Photos", "IMG_1900.HEIC", 3.6],
    ["Voice Memos", "Recording.m4a", 1.2],
    ["Files", "Receipt.pdf", 0.4],
    ["Photos", "IMG_2201.JPG", 4.9],
  ],
  android: [
    ["DCIM/Camera", "IMG_1842.jpg", 3.4],
    ["DCIM/Camera", "IMG_1843.jpg", 2.8],
    ["Download", "scan.pdf", 0.7],
    ["Documents", "Notes.txt", 0.02],
    ["Movies", "clip.mp4", 36],
    ["Music", "recording.m4a", 1.2],
    ["Download", "export.zip", 22],
    ["DCIM/Camera", "IMG_1900.jpg", 3.6],
  ],
  win: [
    ["Pictures", "IMG_1842.jpg", 3.4],
    ["Pictures", "IMG_1843.jpg", 2.8],
    ["Desktop", "Screenshot.png", 1.6],
    ["Documents", "Notes.txt", 0.02],
    ["Downloads", "scan.pdf", 0.7],
    ["Videos", "clip.mp4", 36],
    ["Music", "recording.m4a", 1.2],
    ["Documents", "Receipt.pdf", 0.4],
  ],
  mac: [
    ["~/Pictures", "IMG_1842.HEIC", 3.4],
    ["~/Pictures", "IMG_1843.HEIC", 2.8],
    ["~/Desktop", "Screen Shot.png", 1.6],
    ["~/Documents", "Notes.txt", 0.02],
    ["~/Downloads", "IMG_2201.JPG", 4.9],
    ["~/Movies", "clip.mov", 36],
    ["~/Music", "Voice Memo.m4a", 1.2],
    ["~/Documents", "Receipt.pdf", 0.4],
  ],
};

resetLevel();
showOnly("menu");
requestAnimationFrame(loop);
bindPad();

document.getElementById("play").addEventListener("click", () => {
  unlockAudio();
  state = "device";
  showOnly("device");
});
document.getElementById("pick-mobile").addEventListener("click", () => chooseDevice("mobile"));
document.getElementById("pick-pc").addEventListener("click", () => chooseDevice("pc"));
document.getElementById("sys-a").addEventListener("click", () => chooseSystem(document.getElementById("sys-a").dataset.system));
document.getElementById("sys-b").addEventListener("click", () => chooseSystem(document.getElementById("sys-b").dataset.system));
document.getElementById("start").addEventListener("click", () => {
  unlockAudio();
  begin();
});
document.getElementById("retry").addEventListener("click", () => {
  unlockAudio();
  resetLevel();
  begin();
});
document.getElementById("again").addEventListener("click", () => {
  document.title = "Gold Hop";
  document.body.classList.remove("use-pad");
  pad.hidden = true;
  resetLevel();
  state = "menu";
  showOnly("menu");
});

window.addEventListener("keydown", (e) => {
  const code = e.code;
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "Space", "KeyA", "KeyD", "KeyW"].includes(code)) e.preventDefault();
  if (state === "how" && (code === "Enter" || code === "Space")) {
    e.preventDefault();
    begin();
    return;
  }
  if (state === "menu" && code === "Enter") {
    state = "device";
    showOnly("device");
    return;
  }
  if (state !== "play") return;
  if (e.repeat && (code === "Space" || code === "ArrowUp" || code === "KeyW")) return;
  keys.add(code);
  if (!e.repeat && (code === "Space" || code === "ArrowUp" || code === "KeyW")) jumpQueued = true;
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("blur", () => keys.clear());

function bindPad() {
  hold(document.getElementById("btn-left"), "ArrowLeft", false);
  hold(document.getElementById("btn-right"), "ArrowRight", false);
  hold(document.getElementById("btn-jump"), "Space", true);
}

function hold(el, code, isJump) {
  const press = (e) => {
    e.preventDefault();
    if (state !== "play") return;
    el.setPointerCapture(e.pointerId);
    keys.add(code);
    if (isJump) jumpQueued = true;
  };
  const release = (e) => {
    e.preventDefault();
    keys.delete(code);
  };
  el.addEventListener("pointerdown", press);
  el.addEventListener("pointerup", release);
  el.addEventListener("pointercancel", release);
}

function chooseDevice(device) {
  rig.device = device;
  const title = document.getElementById("system-title");
  const a = document.getElementById("sys-a");
  const b = document.getElementById("sys-b");
  if (device === "mobile") {
    title.textContent = "WHICH PHONE?";
    a.textContent = "iOS";
    b.textContent = "ANDROID";
    a.dataset.system = "ios";
    b.dataset.system = "android";
  } else {
    title.textContent = "WHICH COMPUTER?";
    a.textContent = "WINDOWS";
    b.textContent = "macOS";
    a.dataset.system = "win";
    b.dataset.system = "mac";
  }
  state = "system";
  showOnly("system");
}

function chooseSystem(system) {
  rig.system = system;
  const mobile = rig.device === "mobile";
  document.getElementById("how-pc").classList.toggle("hidden", mobile);
  document.getElementById("how-mobile").classList.toggle("hidden", !mobile);
  document.body.classList.toggle("use-pad", mobile);
  state = "how";
  showOnly("how");
}

function createWorld() {
  const W = 100;
  const H = 18;
  const map = Array.from({ length: H }, () => Array(W).fill("."));
  const put = (x, y, w, h, ch) => {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        if (yy >= 0 && yy < H && xx >= 0 && xx < W) map[yy][xx] = ch;
      }
    }
  };
  put(0, 13, W, 5, "#");
  put(22, 13, 3, 5, ".");
  put(40, 13, 3, 5, ".");
  put(60, 13, 3, 5, ".");
  put(80, 13, 2, 5, ".");
  put(93, 13, 7, 5, ".");
  put(33, 12, 2, 1, "#");
  put(54, 12, 2, 1, "^");
  put(20, 10, 6, 1, "=");
  put(38, 9, 7, 1, "=");
  put(58, 10, 7, 1, "=");
  put(84, 12, 8, 1, "G");
  map[12][4] = "P";
  map[12][12] = "M";
  map[12][47] = "M";
  map[12][70] = "M";
  map[12][44] = "C";
  return { map, w: W, h: H };
}

function extractMarkers() {
  for (let y = 0; y < world.h; y++) {
    for (let x = 0; x < world.w; x++) {
      const t = world.map[y][x];
      if (t !== "P" && t !== "M" && t !== "C") continue;
      if (t === "P") {
        playerStart.x = x * TILE + 2;
        playerStart.y = (y + 1) * TILE - 14;
      } else if (t === "M") {
        monsterSpawns.push({ x: x * TILE + 1, y: (y + 1) * TILE - 12 });
      } else {
        checkpoint = { x: x * TILE + 2, y: (y + 1) * TILE - 14 };
      }
      world.map[y][x] = ".";
    }
  }
}

function findGoldSpan() {
  let min = Infinity;
  let max = -1;
  let row = 0;
  for (let y = 0; y < world.h; y++) {
    for (let x = 0; x < world.w; x++) {
      if (world.map[y][x] !== "G") continue;
      if (x < min) min = x;
      if (x > max) {
        max = x;
        row = y;
      }
    }
  }
  return { min, max, row };
}

function resetLevel() {
  enemies = monsterSpawns.map((s) => ({
    x: s.x,
    y: s.y,
    w: 14,
    h: 12,
    vx: 0.4,
    alive: true,
    squish: 0,
    minX: s.x - 8,
    maxX: s.x + 72,
  }));
  player.x = playerStart.x;
  player.y = playerStart.y;
  player.vx = 0;
  player.vy = 0;
  player.face = 1;
  player.landedVy = 0;
  player.prevBottom = player.y + player.h;
  spawn = { x: playerStart.x, y: playerStart.y };
  lives = 3;
  stomps = 0;
  passedCheckpoint = false;
  onGround = true;
  coyote = 12;
  jumpBuffer = 0;
  jumpQueued = false;
  iframe = 0;
  hintTime = 0;
  particles = [];
  shake = 0;
  hackDone = false;
  creditTimer = 0;
  keys.clear();
  snapCamera();
}

function begin() {
  if (state === "play") return;
  state = "play";
  hintTime = 280;
  showNone();
  pad.hidden = rig.device !== "mobile";
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
}

function showOnly(id) {
  for (const panel of panels) panel.classList.toggle("hidden", panel.id !== id);
}

function showNone() {
  for (const panel of panels) panel.classList.add("hidden");
}

function loop(now) {
  if (!loop.last) loop.last = now;
  loop.bank = (loop.bank || 0) + Math.min(80, now - loop.last);
  loop.last = now;
  while (loop.bank >= 1000 / 60) {
    updateSim();
    loop.bank -= 1000 / 60;
  }
  if (state === "hack") updateHack(now);
  draw(now);
  requestAnimationFrame(loop);
}

function updateSim() {
  if (state === "menu" || state === "device" || state === "system" || state === "how") {
    if (state === "menu") {
      attract += 1;
      moveEnemies();
      const max = Math.max(0, world.w * TILE - VIEW_W);
      camX = (Math.sin(attract * 0.008) * 0.5 + 0.5) * max;
    }
    return;
  }
  if (state === "clear") {
    clearTimer -= 1;
    updateParticles();
    followCamera();
    if (clearTimer <= 0) startHack();
    return;
  }
  if (state !== "play") return;

  anim += Math.abs(player.vx) > 0 ? 0.18 : 0;
  if (iframe > 0) iframe -= 1;
  if (hintTime > 0) hintTime -= 1;

  let dir = 0;
  if (keys.has("ArrowRight") || keys.has("KeyD")) dir += 1;
  if (keys.has("ArrowLeft") || keys.has("KeyA")) dir -= 1;
  player.vx = dir * MOVE;
  if (dir !== 0) player.face = dir;

  if (jumpQueued) {
    jumpBuffer = 12;
    jumpQueued = false;
  }
  if (onGround) coyote = 10;
  else if (coyote > 0) coyote -= 1;

  if (jumpBuffer > 0 && coyote > 0) {
    player.vy = JUMP_V;
    coyote = 0;
    jumpBuffer = 0;
    onGround = false;
    beep(620, 0.07, "square", 0.04);
  } else if (jumpBuffer > 0) jumpBuffer -= 1;

  player.landedVy = 0;
  player.prevBottom = player.y + player.h;
  player.x += player.vx;
  resolveX();
  player.vy = Math.min(MAX_FALL, player.vy + GRAV);
  player.y += player.vy;
  const hitGold = resolveY();

  if (checkpoint && !passedCheckpoint && player.x > checkpoint.x) {
    passedCheckpoint = true;
    spawn = { x: checkpoint.x, y: checkpoint.y };
  }
  if (hitGold) {
    triggerWin();
    return;
  }
  moveEnemies();
  collideEnemies();
  if (state !== "play") return;
  if (feetTouchSpike()) loseLife(false);
  if (player.y > world.h * TILE) loseLife(true);
  updateParticles();
  followCamera();
  if (shake > 0) shake *= 0.86;
}

function resolveX() {
  for (let n = 0; n < 4; n++) {
    const hit = overlappingWall();
    if (!hit) break;
    if (player.x + player.w / 2 < (hit.tx + 0.5) * TILE) player.x = hit.tx * TILE - player.w;
    else player.x = (hit.tx + 1) * TILE;
    player.vx = 0;
  }
  if (player.x < 0) {
    player.x = 0;
    player.vx = 0;
  }
}

function overlappingWall() {
  let found = null;
  eachTile(player, (tx, ty, t) => {
    if (found) return;
    if (t !== "#" && t !== "G") return;
    if (player.prevBottom <= ty * TILE + 4) return;
    found = { tx, ty, t };
  });
  return found;
}

function resolveY() {
  let gold = false;
  onGround = false;
  for (let n = 0; n < 6; n++) {
    const falling = player.vy > 0;
    const hit = overlappingSolid(falling);
    if (!hit) break;
    if (player.vy > 0) {
      player.landedVy = player.vy;
      player.y = hit.ty * TILE - player.h;
      player.vy = 0;
      onGround = true;
      if (hit.t === "G") gold = true;
    } else if (player.vy < 0) {
      player.y = (hit.ty + 1) * TILE;
      player.vy = 0;
    } else {
      player.y = hit.ty * TILE - player.h;
      onGround = true;
      if (hit.t === "G") gold = true;
      break;
    }
  }
  return gold;
}

function overlappingSolid(falling) {
  let found = null;
  eachTile(player, (tx, ty, t) => {
    if (found) return;
    if (t === "#" || t === "G") found = { tx, ty, t };
    else if (t === "=" && falling && player.prevBottom <= ty * TILE + 3) found = { tx, ty, t };
  });
  return found;
}

function eachTile(box, fn) {
  const x0 = Math.floor(box.x / TILE);
  const y0 = Math.floor(box.y / TILE);
  const x1 = Math.floor((box.x + box.w - 0.01) / TILE);
  const y1 = Math.floor((box.y + box.h - 0.01) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) fn(tx, ty, tileAt(tx, ty));
  }
}

function tileAt(tx, ty) {
  if (ty < 0) return ".";
  if (tx < 0) return "#";
  if (tx >= world.w || ty >= world.h) return ".";
  return world.map[ty][tx];
}

function moveEnemies() {
  for (const e of enemies) {
    if (!e.alive) {
      if (e.squish > 0) e.squish -= 1;
      continue;
    }
    const dir = e.vx >= 0 ? 1 : -1;
    const aheadX = dir > 0 ? e.x + e.w + 1 : e.x - 1;
    const footX = dir > 0 ? e.x + e.w - 2 : e.x + 2;
    const footY = e.y + e.h + 2;
    if (e.x <= e.minX) e.vx = 0.4;
    else if (e.x >= e.maxX) e.vx = -0.4;
    else if (blocksMonster(aheadX, e.y + 4) || !floorAt(footX, footY)) e.vx = -dir * 0.4;
    e.x += e.vx;
  }
}

function blocksMonster(px, py) {
  const t = tileAt(Math.floor(px / TILE), Math.floor(py / TILE));
  return t === "#" || t === "G" || t === "^";
}

function floorAt(px, py) {
  const t = tileAt(Math.floor(px / TILE), Math.floor(py / TILE));
  return t === "#" || t === "G" || t === "=";
}

function collideEnemies() {
  for (const e of enemies) {
    if (!e.alive || !overlap(player, e)) continue;
    const fromAbove = player.prevBottom <= e.y + 8 && (player.vy > 0.1 || player.landedVy > 0.1);
    if (fromAbove) {
      e.alive = false;
      e.squish = 18;
      stomps += 1;
      player.vy = -4.4;
      player.y = e.y - player.h;
      player.landedVy = 0;
      shake = Math.max(shake, 4);
      puff(e.x + e.w / 2, e.y + 4, "#c7b0ff");
      beep(520, 0.08, "square", 0.05);
    } else if (iframe <= 0) {
      loseLife(false);
      break;
    }
  }
}

function feetTouchSpike() {
  if (iframe > 0) return false;
  const feet = { x: player.x + 2, y: player.y + player.h - 7, w: player.w - 4, h: 7 };
  let hit = false;
  eachTile(feet, (tx, ty, t) => {
    if (t === "^") hit = true;
  });
  return hit;
}

function loseLife(respawn) {
  if (state !== "play") return;
  if (!respawn && iframe > 0) return;
  lives -= 1;
  shake = 9;
  beep(150, 0.16, "square", 0.05);
  if (lives <= 0) {
    state = "over";
    pad.hidden = true;
    showOnly("over");
    keys.clear();
    return;
  }
  if (respawn) {
    player.x = spawn.x;
    player.y = spawn.y;
    player.vx = 0;
    player.vy = 0;
    iframe = 90;
  } else {
    iframe = 110;
    player.vy = -3.6;
    player.vx = -player.face * 2.4;
  }
}

function triggerWin() {
  if (state !== "play") return;
  state = "clear";
  clearTimer = 12;
  player.vx = 0;
  player.vy = 0;
  keys.clear();
  pad.hidden = true;
}

function followCamera() {
  const max = Math.max(0, world.w * TILE - VIEW_W);
  camX += (clamp(player.x + player.w / 2 - VIEW_W * 0.36, 0, max) - camX) * 0.16;
}

function snapCamera() {
  const max = Math.max(0, world.w * TILE - VIEW_W);
  camX = clamp(player.x - 60, 0, max);
}

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function puff(x, y, color) {
  for (let i = 0; i < 8; i++) {
    particles.push({
      x,
      y,
      vx: (Math.random() * 2 - 1) * 1.6,
      vy: -Math.random() * 2 - 0.4,
      life: 16 + Math.random() * 8,
      color,
    });
  }
}

function updateParticles() {
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.12;
    p.life -= 1;
  }
  particles = particles.filter((p) => p.life > 0);
}

function draw(now) {
  const dx = shake > 0.4 ? (Math.random() * 2 - 1) * shake : 0;
  const dy = shake > 0.4 ? (Math.random() * 2 - 1) * shake : 0;
  const cam = Math.round(camX + dx);
  const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  sky.addColorStop(0, "#6eb6ff");
  sky.addColorStop(1, "#d8f4ff");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawSun();
  drawHills(cam, "#8dce78", 0.35, 150, 16);
  drawHills(cam, "#63b85a", 0.55, 176, 12);
  drawClouds(cam);

  const x0 = Math.floor(cam / TILE) - 1;
  const x1 = Math.ceil((cam + VIEW_W) / TILE) + 1;
  for (let ty = 0; ty < world.h; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const t = tileAt(tx, ty);
      const x = tx * TILE - cam;
      const y = ty * TILE - dy;
      if (t === "." && ty >= 13) {
        ctx.fillStyle = "#241833";
        ctx.fillRect(x, y, TILE, TILE);
      } else if (t === "#") drawBrick(x, y, tileAt(tx, ty - 1));
      else if (t === "=") drawPlank(x, y);
      else if (t === "G") drawGold(x, y, now / 16 + tx);
      else if (t === "^") drawSpike(x, y);
    }
  }
  if (checkpoint) drawSign(checkpoint.x - cam, checkpoint.y - dy);
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / 20);
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x - cam), Math.round(p.y - dy), 3, 3);
  }
  ctx.globalAlpha = 1;
  for (const e of enemies) {
    if (!e.alive && e.squish <= 0) continue;
    drawSlime(e, cam, dy);
  }
  const showPlayer = iframe <= 0 || Math.floor(iframe / 4) % 2 === 0;
  if (showPlayer && state !== "hack" && state !== "credits") {
    drawHero(player.x - cam, player.y - dy, player.face, Math.floor(anim) % 2 === 0);
  }
  if (goldSpan.max >= 0) {
    const gx = ((goldSpan.min + goldSpan.max + 1) / 2) * TILE - cam;
    ctx.fillStyle = "#3a2500";
    ctx.font = "bold 12px Courier New";
    ctx.textAlign = "center";
    ctx.fillText("FINISH", Math.round(gx), goldSpan.row * TILE - 8 - dy);
  }
  drawHud();
}

function drawSun() {
  const x = 400;
  const y = 14;
  ctx.fillStyle = "#ffe38a";
  ctx.fillRect(x + 10, y, 4, 6);
  ctx.fillRect(x + 10, y + 32, 4, 6);
  ctx.fillRect(x - 8, y + 16, 6, 4);
  ctx.fillRect(x + 28, y + 16, 6, 4);
  ctx.fillStyle = "#ffd23a";
  ctx.fillRect(x + 4, y + 10, 20, 20);
  ctx.fillStyle = "#fff6c4";
  ctx.fillRect(x + 10, y + 16, 8, 8);
}

function drawHills(cam, color, parallax, base, amp) {
  ctx.fillStyle = color;
  for (let x = 0; x <= VIEW_W; x += 8) {
    const wx = cam * parallax + x;
    const y = base + Math.sin(wx * 0.02) * amp;
    ctx.fillRect(x, y, 8, VIEW_H - y);
  }
}

function drawClouds(cam) {
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  const span = 900;
  for (const c of clouds) {
    const drawX = ((c.x - cam * 0.22) % span + span) % span - 60;
    ctx.fillRect(drawX, c.y, c.w, 10);
    ctx.fillRect(drawX + 8, c.y - 6, Math.max(10, c.w - 18), 8);
  }
}

function drawBrick(x, y, above) {
  const surface = above !== "#" && above !== "G";
  ctx.fillStyle = "#8d4a28";
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = "#c46a3c";
  ctx.fillRect(x + 1, y + 1, 6, 5);
  ctx.fillRect(x + 9, y + 8, 6, 5);
  if (surface) {
    ctx.fillStyle = "#3fa843";
    ctx.fillRect(x, y, TILE, 4);
    ctx.fillStyle = "#8fe07a";
    ctx.fillRect(x + 2, y + 1, 4, 2);
  }
}

function drawPlank(x, y) {
  ctx.fillStyle = "#8a5528";
  ctx.fillRect(x, y, TILE, 6);
  ctx.fillStyle = "#e0a86a";
  ctx.fillRect(x, y, TILE, 2);
}

function drawGold(x, y, t) {
  const blink = Math.floor(t / 10) % 2 === 0;
  ctx.fillStyle = "#a86a00";
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = blink ? "#ffe56a" : "#ffc83d";
  ctx.fillRect(x + 1, y + 1, 14, 14);
  ctx.fillStyle = "#a35c00";
  ctx.fillRect(x + 7, y + 4, 2, 2);
  ctx.fillRect(x + 5, y + 6, 6, 2);
  ctx.fillRect(x + 7, y + 8, 2, 3);
}

function drawSpike(x, y) {
  ctx.fillStyle = "#e7ebf2";
  ctx.fillRect(x + 7, y + 2, 2, 3);
  ctx.fillRect(x + 5, y + 5, 6, 3);
  ctx.fillRect(x + 3, y + 8, 10, 3);
  ctx.fillRect(x + 2, y + 11, 12, 5);
}

function drawSign(x, y) {
  const sx = Math.round(x);
  const sy = Math.round(y + 14);
  ctx.fillStyle = "#6b3f1f";
  ctx.fillRect(sx + 4, sy - 22, 3, 22);
  ctx.fillStyle = passedCheckpoint ? "#ffd23a" : "#f4f4f4";
  ctx.fillRect(sx + 7, sy - 22, 14, 9);
}

function drawSlime(e, cam, dy) {
  const flat = !e.alive;
  const bob = flat ? 0 : Math.floor(e.x / 8) % 2 === 0 ? 0 : 2;
  const h = flat ? 4 : e.h;
  const x = Math.round(e.x - cam);
  const y = Math.round(e.y - dy + (flat ? e.h - 4 : bob));
  ctx.fillStyle = flat ? "#6a4cb8" : "#6d42e0";
  ctx.fillRect(x + 1, y + 4, e.w - 2, Math.max(2, h - 3));
  ctx.fillRect(x + 3, y + 2, e.w - 6, 4);
  if (!flat) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(x + 3, y + 6, 3, 3);
    ctx.fillRect(x + 8, y + 6, 3, 3);
    ctx.fillStyle = "#1a1a1a";
    const look = e.vx >= 0 ? 1 : 0;
    ctx.fillRect(x + 4 + look, y + 7, 1, 2);
    ctx.fillRect(x + 9 + look, y + 7, 1, 2);
  }
}

function drawHero(px, py, face, step) {
  const x = Math.round(px);
  const y = Math.round(py);
  const dir = face >= 0 ? 1 : -1;
  ctx.fillStyle = "#2a3358";
  ctx.fillRect(x + 2, y + 9, 3, step ? 4 : 5);
  ctx.fillRect(x + 7, y + 9, 3, step ? 5 : 4);
  ctx.fillStyle = "#f2c14a";
  ctx.fillRect(x + 2, y + 12, 3, 2);
  ctx.fillRect(x + 7, y + 12, 3, 2);
  ctx.fillStyle = "#2f6fed";
  ctx.fillRect(x + 2, y + 5, 8, 5);
  ctx.fillStyle = "#ffcc99";
  ctx.fillRect(x + (dir > 0 ? 8 : 1), y + 6, 3, 3);
  ctx.fillRect(x + 3, y, 6, 6);
  ctx.fillStyle = "#5a3318";
  ctx.fillRect(x + 3, y - 2, 6, 3);
  ctx.fillStyle = "#1b1b1b";
  ctx.fillRect(x + (dir > 0 ? 7 : 4), y + 2, 1, 2);
}

function drawHud() {
  if (state !== "play" && state !== "clear") return;
  for (let i = 0; i < 3; i++) drawHeart(10 + i * 16, 10, i < lives);
  if (state === "play" && hintTime > 0) {
    const alpha = hintTime < 45 ? hintTime / 45 : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(12, 8, 20, 0.78)";
    ctx.fillRect(68, 8, 300, 18);
    ctx.fillStyle = "#fff6d8";
    ctx.font = "12px Courier New";
    ctx.textAlign = "center";
    const hint = rig.device === "mobile" ? "BUTTONS move and jump    stomp" : "ARROWS move   SPACE jump   stomp";
    ctx.fillText(hint, 218, 21);
    ctx.restore();
  }
}

function drawHeart(x, y, filled) {
  ctx.fillStyle = filled ? "#ff4d6a" : "#5c3140";
  ctx.fillRect(x + 1, y, 4, 2);
  ctx.fillRect(x + 7, y, 4, 2);
  ctx.fillRect(x, y + 2, 12, 4);
  ctx.fillRect(x + 2, y + 6, 8, 2);
  ctx.fillRect(x + 4, y + 8, 4, 2);
  ctx.fillRect(x + 5, y + 10, 2, 2);
}

function formatMB(n) {
  if (n < 0.1) return Math.max(1, Math.round(n * 1024)) + " KB";
  if (n >= 10) return Math.round(n) + " MB";
  return n.toFixed(1) + " MB";
}

function clockText() {
  const d = new Date();
  let h = d.getHours();
  const min = String(d.getMinutes()).padStart(2, "0");
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return h + ":" + min + (rig.system === "mac" ? " " + ap : "");
}

function startHack() {
  hackT0 = performance.now();
  hackDone = false;
  creditTimer = 0;
  document.title = "Copy";
  const hack = document.getElementById("hack");
  hack.className = "overlay os-" + rig.system;
  for (const id of ["ios", "android", "win", "mac"]) {
    document.getElementById("skin-" + id).classList.toggle("hidden", id !== rig.system);
  }
  paintCopy(0);
  showOnly("hack");
  state = "hack";
  pad.hidden = true;
}

function paintCopy(shown) {
  const files = PACKS[rig.system];
  const total = files.reduce((sum, file) => sum + file[2], 0);
  const copied = files.slice(0, shown).reduce((sum, file) => sum + file[2], 0);
  const pct = shown === 0 ? 6 : Math.min(100, Math.round((copied / total) * 100));
  const current = shown === 0 ? null : files[Math.min(shown, files.length) - 1];
  const prefix = rig.system === "win" ? "win" : rig.system === "mac" ? "mac" : rig.system === "ios" ? "ios" : "and";
  const fileEl = document.getElementById(prefix + "-file");
  const fromEl = document.getElementById(prefix + "-from");
  const barEl = document.getElementById(prefix + "-bar");
  const metaEl = document.getElementById(prefix + "-meta");
  if (!current) {
    fileEl.textContent = rig.system === "mac" ? "Preparing to copy…" : "Preparing…";
    fromEl.textContent = rig.system === "android" ? "Internal storage" : rig.system === "win" ? "This PC" : rig.system === "mac" ? "Macintosh HD" : "iPhone";
    metaEl.textContent = "Calculating…";
  } else if (shown >= files.length) {
    fileEl.textContent = rig.system === "ios" || rig.system === "mac" ? "Copying \u201C" + current[1] + "\u201D" : current[1];
    fromEl.textContent = placeLine(current[0]);
    metaEl.textContent = formatMB(total) + " of " + formatMB(total);
  } else {
    fileEl.textContent = rig.system === "ios" || rig.system === "mac" ? "Copying \u201C" + current[1] + "\u201D" : current[1];
    fromEl.textContent = placeLine(current[0]);
    const left = Math.max(1, files.length - shown);
    metaEl.textContent = formatMB(copied) + " of " + formatMB(total) + " \u2014 " + left + " left";
  }
  barEl.style.width = (shown >= files.length ? 100 : pct) + "%";
  document.querySelectorAll(".tick").forEach((el) => {
    el.textContent = clockText();
  });
}

function placeLine(folder) {
  if (rig.system === "ios") return "From " + folder;
  if (rig.system === "android") return "/storage/emulated/0/" + folder;
  if (rig.system === "win") return "This PC  \\  " + folder;
  return "to " + folder;
}

function updateHack(now) {
  const files = PACKS[rig.system];
  const step = 650;
  const shown = Math.max(0, Math.min(files.length, Math.floor((now - hackT0) / step)));
  if (!hackDone) paintCopy(shown);
  if (!hackDone && shown >= files.length && now - hackT0 > files.length * step + 900) {
    hackDone = true;
    paintCopy(files.length);
    creditTimer = now;
  }
  if (hackDone && now - creditTimer > 1400) showCredits();
}

function showCredits() {
  if (state === "credits") return;
  state = "credits";
  document.title = "Gold Hop";
  const names = {
    ios: "iPhone",
    android: "Android",
    win: "Windows",
    mac: "Mac",
  };
  const reel = document.getElementById("reel");
  reel.innerHTML = [
    "<h2>GOLD HOP</h2>",
    line("Monsters squished", String(stomps)),
    line("Lives remaining", String(Math.max(0, lives))),
    line("Played on", names[rig.system]),
    "<p class='role'>DIRECTED BY</p><p class='name'>FAHMY FARUG</p>",
    "<p class='role'>CO-DIRECTOR</p><p class='name'>CURSOR AI</p>",
  ].join("");
  reel.style.transition = "none";
  reel.style.transform = "translateY(0)";
  document.getElementById("again").classList.add("hidden");
  showOnly("credits");
  requestAnimationFrame(() => {
    reel.style.transition = "transform 12s linear";
    reel.style.transform = "translateY(calc(-100% - 6vh))";
  });
  setTimeout(() => {
    if (state !== "credits") return;
    document.getElementById("again").classList.remove("hidden");
  }, 12000);
}

function line(role, value) {
  return "<p class='role'>" + role.toUpperCase() + "</p><p class='stat'>" + value + "</p>";
}

function unlockAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  if (!audioCtx) audioCtx = new Ctx();
  if (audioCtx.state === "suspended") audioCtx.resume();
}

function beep(freq, dur, type, vol) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = vol;
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + dur);
}
