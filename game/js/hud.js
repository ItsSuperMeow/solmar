// Solmar HUD — health, money, wanted stars, mission text, the minimap,
// speedometer and ammo. Plain DOM plus a 2D canvas minimap drawn top-down:
// roads, beach and sea, the player arrow, police blips and the mission
// marker. All updates go through these functions so the game code never
// touches the DOM directly.

function el(id) { return document.getElementById(id); }

function showHud(G) { el('hud').classList.remove('hidden'); }

function updateHealthHud(G) {
  el('health-fill').style.width = Math.max(0, G.player.health) + '%';
}

function updateMoneyHud(G) { el('money').textContent = G.player.money.toLocaleString('en-US'); }

function updateWantedHud(G) {
  let stars = '';
  for (let i = 0; i < 5; i++) {
    stars += '<span class="star' + (i < G.wanted ? ' lit' : '') + '">★</span>';
  }
  el('wanted').innerHTML = stars;
}

function setObjective(G, text) { el('objective').textContent = text; }
function setMissionName(G, text) { el('mission-name').textContent = text; }

function updateAmmoHud(G) {
  el('ammo').textContent = G.combat ? G.combat.ammo : 12;
  el('ammo-row').classList.toggle('hidden', !!G.player.car);
  el('crosshair').classList.toggle('hidden', !!G.player.car);
}

function updateSpeedHud(G) {
  const driving = !!G.player.car;
  el('speed-row').classList.toggle('hidden', !driving);
  if (driving) el('speed').textContent = Math.round(Math.abs(G.player.car.speed) * 3.2);
}

function showPrompt(G, text) {
  const p = el('prompt');
  if (text) { p.textContent = text; p.classList.remove('hidden'); }
  else p.classList.add('hidden');
}

let bannerTimer = null;
function showBanner(G, title, sub) {
  const b = el('banner');
  b.innerHTML = title + (sub ? '<small>' + sub + '</small>' : '');
  b.classList.remove('hidden');
  if (bannerTimer) clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => b.classList.add('hidden'), 3800);
}

function showTimer(G, on) { el('timer-row').classList.toggle('hidden', !on); }
function showTimerValue(G, seconds) { el('timer').textContent = seconds; }

function flashDamage(G) {
  const f = el('damage-flash');
  f.style.opacity = '1';
  setTimeout(() => { f.style.opacity = '0'; }, 180);
}

// The minimap: a top-down view of the city, drawn every frame.
function drawMinimap(G) {
  const canvas = el('minimap');
  const ctx = canvas.getContext('2d');
  const S = canvas.width; // 180
  const world = (v) => ((v + 210) / 440) * S; // world -210..230 -> 0..180
  // Sea and sand on the east edge.
  ctx.fillStyle = '#2b7ea6';
  ctx.fillRect(world(232), 0, S - world(232), S);
  ctx.fillStyle = '#e6cf9e';
  ctx.fillRect(world(194), 0, world(232) - world(194), S);
  // City ground and roads — bright enough to read at a glance.
  ctx.fillStyle = '#6e675c';
  ctx.fillRect(0, 0, world(194), S);
  ctx.fillStyle = '#a39a86';
  for (const r of G.roads.xs) {
    ctx.fillRect(world(r - 6), 0, world(r + 6) - world(r - 6), S);
    ctx.fillRect(0, world(r - 6), world(194), world(r + 6) - world(r - 6));
  }
  // Plaza fountain.
  ctx.fillStyle = '#3fa7c9';
  ctx.beginPath();
  ctx.arc(world(0), world(0), 5, 0, Math.PI * 2);
  ctx.fill();
  // Mission marker — clamped inside the minimap so a target on the pier
  // (east of the drawn city) still shows at the map's edge.
  if (G.missions.active && G.missions.target) {
    const t = G.missions.target;
    const mx = Math.max(8, Math.min(S - 8, world(t.x)));
    const mz = Math.max(8, Math.min(S - 8, world(t.z)));
    ctx.fillStyle = '#ffd23c';
    ctx.save();
    ctx.translate(mx, mz);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-5, -5, 10, 10);
    ctx.restore();
  }
  // Traffic and parked cars as grey dots.
  ctx.fillStyle = '#bbbbbb';
  for (const car of G.cars) {
    if (car === G.player.car) continue;
    ctx.fillRect(world(car.mesh.position.x) - 1.5, world(car.mesh.position.z) - 1.5, 3, 3);
  }
  // Police as red blips.
  ctx.fillStyle = '#ff2a2a';
  for (const car of G.policeCars) {
    ctx.beginPath();
    ctx.arc(world(car.mesh.position.x), world(car.mesh.position.z), 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const cop of G.cops) {
    ctx.fillRect(world(cop.pos.x) - 2, world(cop.pos.z) - 2, 4, 4);
  }
  // The player: a white arrow pointing where he faces. The arrow is drawn
  // pointing up (0,-1); rotating by (PI - yaw) maps it onto the world
  // facing (sin yaw, cos yaw) in canvas coordinates (x right, z down).
  const yaw = G.player.car ? G.player.car.yaw : G.player.yaw;
  ctx.save();
  ctx.translate(world(G.player.pos.x), world(G.player.pos.z));
  ctx.rotate(Math.PI - yaw);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -7);
  ctx.lineTo(5, 6);
  ctx.lineTo(0, 3);
  ctx.lineTo(-5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
