// Solmar main — entry point, game loop, camera, input, start screen.
// The shared game state G lives here; every other file is functions that
// take G. The loop uses real delta time from the clock, never a fixed step,
// so the game runs at the same speed on any display.

const G = {
  seed: 7,
  state: 'menu', // 'menu' | 'playing'
  time: 0,
  scene: null, camera: null, renderer: null,
  keys: {},
  cameraYaw: Math.PI, cameraPitch: 0.32,
  cameraPos: null, // smoothed camera position
  player: {
    pos: null, mesh: null, parts: null, yaw: Math.PI,
    health: 100, money: 0, car: null, vy: 0, onGround: true,
    punchTimer: 0, walkPhase: 0, invulnTimer: 0,
  },
  cars: [], policeCars: [], cops: [], peds: [],
  wanted: 0, lastCrimeAt: -100, wantedDecayTimer: 0,
  missions: null, combat: null,
  colliders: [], roads: null, cityStats: {},
  audio: { ctx: null },
  shot: null, saveTimer: 0,
};

function init() {
  const params = new URLSearchParams(window.location.search);
  G.shot = params.get('shot');
  const seedParam = parseInt(params.get('seed') || '', 10);
  if (Number.isFinite(seedParam)) G.seed = seedParam;
  G.player.pos = new THREE.Vector3(10, 0, 26);

  // Renderer and scene.
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  document.getElementById('game-container').appendChild(renderer.domElement);
  G.renderer = renderer;
  G.scene = new THREE.Scene();
  G.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
  G.cameraPos = new THREE.Vector3(0, 60, 140);

  buildCity(G);
  createPlayer(G);
  spawnParkedCars(G);
  spawnTraffic(G, 10);
  spawnPedestrians(G, 18);
  initCombat(G);
  initMissions(G);

  // Restore a save, if one exists: the Continue button offers it.
  const save = loadSave();
  if (save) {
    document.getElementById('continue-btn').classList.remove('hidden');
    document.getElementById('continue-info').textContent =
      '$' + (save.money || 0) + ' · ' + (save.missionsDone || 0) + '/5 jobs done';
  }
  document.getElementById('start-btn').addEventListener('click', (e) => { e.target.blur(); startGame(G, false); });
  document.getElementById('continue-btn').addEventListener('click', (e) => { e.target.blur(); startGame(G, true); });

  // Input: keyboard, mouse drag to look, click to shoot.
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') e.preventDefault();
    if (e.repeat) return;
    G.keys[e.code] = true;
    if (G.state !== 'playing') return;
    if (e.code === 'KeyE') onInteractKey(G);
    if (e.code === 'KeyF') playerPunch(G);
    if (e.code === 'KeyR') startReload(G);
    if (e.code === 'KeyM') toggleMute(G);
  });
  window.addEventListener('keyup', (e) => { G.keys[e.code] = false; });
  let dragging = false, lastX = 0, lastY = 0, downX = 0, downY = 0, downAt = 0;
  const canvas = renderer.domElement;
  canvas.addEventListener('mousedown', (e) => {
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    downX = e.clientX; downY = e.clientY; downAt = performance.now();
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    G.cameraYaw -= (e.clientX - lastX) * 0.005;
    G.cameraPitch = Math.max(0.06, Math.min(1.15, G.cameraPitch + (e.clientY - lastY) * 0.004));
    lastX = e.clientX; lastY = e.clientY;
  });
  window.addEventListener('mouseup', (e) => {
    if (!dragging) return;
    dragging = false;
    // A short click that barely moved is a shot, not a look.
    if (G.state === 'playing' && Math.hypot(e.clientX - downX, e.clientY - downY) < 6 && performance.now() - downAt < 350) {
      shootPistol(G);
    }
  });
  window.addEventListener('resize', () => {
    G.camera.aspect = window.innerWidth / window.innerHeight;
    G.camera.updateProjectionMatrix();
    G.renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // A staged screenshot (?shot=...) starts itself: no menu, scene set up.
  if (G.shot) {
    startGame(G, false, true);
    stageShot(G, G.shot);
  }

  // The game loop, on real delta time.
  const clock = new THREE.Clock();
  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    tick(G, dt);
    G.renderer.render(G.scene, G.camera);
  }
  loop();

  // For play-testing and screenshots: the whole state, inspectable.
  window.Solmar = G;
}

function startGame(G, useSave, staged) {
  initAudio(G);
  if (useSave) applySave(G, loadSave());
  document.getElementById('menu').classList.add('hidden');
  showHud(G);
  G.state = 'playing';
  G.lastCrimeAt = G.time;
  updateHealthHud(G);
  updateMoneyHud(G);
  updateWantedHud(G);
  updateAmmoHud(G);
  if (!staged) {
    startMission(G, G.missions.index);
    showBanner(G, 'WELCOME TO SOLMAR', 'Mara has work for you. Check the job in the top left.');
  }
}

// E: steal or exit a car, or work a mission marker.
function onInteractKey(G) {
  if (G.player.car) { exitCar(G); updateAmmoHud(G); return; }
  if (onMissionInteract(G)) return;
  const car = nearestCar(G, 5);
  if (car) { enterCar(G, car); updateAmmoHud(G); }
}

// The contextual "Press E" prompt, refreshed every frame.
function updatePrompt(G) {
  if (G.player.car) { showPrompt(G, 'E — get out   ·   Space — handbrake'); return; }
  const m = G.missions;
  if (m.active && m.target) {
    const d = Math.hypot(G.player.pos.x - m.target.x, G.player.pos.z - m.target.z);
    if (d < m.target.radius && (m.defs[m.index].id === 'the-package' || m.defs[m.index].id === 'the-final-heist')) {
      showPrompt(G, 'Press E'); return;
    }
  }
  const car = nearestCar(G, 5);
  if (car) { showPrompt(G, 'Press E to steal the ' + car.type); return; }
  showPrompt(G, '');
}

// Stage a scene for a screenshot: ?shot=street|drive|chase|mission.
function stageShot(G, shot) {
  G.state = 'playing';
  startMission(G, 0);
  const p = G.player;
  if (shot === 'street') {
    p.pos.set(10, 0, 26);
    p.yaw = Math.PI * 0.82;
    G.cameraYaw = p.yaw;
    G.cameraPitch = 0.3;
  } else if (shot === 'drive') {
    const sports = G.cars.find((c) => c.type === 'sports' && c.parked) || G.cars[0];
    sports.mesh.position.set(-26, 0, 60);
    sports.yaw = Math.PI;
    sports.mesh.rotation.y = Math.PI;
    sports.speed = 16;
    p.car = sports;
    sports.parked = false;
    p.mesh.visible = false;
    p.pos.set(-26, 0, 60);
    G.cameraYaw = Math.PI;
    setObjective(G, 'Cruise the coast road — Solmar is yours.');
  } else if (shot === 'chase') {
    const sedan = G.cars.find((c) => c.type === 'sedan' && c.parked) || G.cars[0];
    sedan.mesh.position.set(-78, 0, 26);
    sedan.yaw = Math.PI / 2;
    sedan.mesh.rotation.y = Math.PI / 2;
    sedan.speed = 20;
    p.car = sedan;
    sedan.parked = false;
    p.mesh.visible = false;
    p.pos.set(-78, 0, 26);
    G.cameraYaw = Math.PI / 2;
    G.wanted = 3;
    G.lastCrimeAt = G.time;
    updateWantedHud(G);
    // Two pursuit cars right behind, on the same road.
    for (let i = 0; i < 2; i++) {
      spawnPoliceCar(G);
      const pc = G.policeCars[G.policeCars.length - 1];
      pc.mesh.position.set(-78 - (14 + i * 12), 0, 26 + (i === 0 ? -3 : 3));
      pc.yaw = Math.PI / 2;
      pc.mesh.rotation.y = Math.PI / 2;
      pc.speed = 22;
    }
    setObjective(G, 'Lose the heat — three stars and closing in!');
    setMissionName(G, '3. LOSE THE HEAT');
  } else if (shot === 'mission') {
    // Rio on the coast road, facing east: the car to steal ahead of him and
    // the pier beacon straight ahead, so the mission reads in one frame.
    const sedan = G.cars.find((c) => c.type === 'sedan' && c.parked);
    if (sedan) {
      sedan.mesh.position.set(66, 0, 30);
      sedan.yaw = Math.PI / 2;
      sedan.mesh.rotation.y = Math.PI / 2;
    }
    p.pos.set(54, 0, 30);
    p.yaw = Math.PI / 2;
    G.cameraYaw = Math.PI / 2;
    G.cameraPitch = 0.3;
    setObjective(G, 'Steal a car and drive it to the pier');
  }
  updateAmmoHud(G);
}

function updateCamera(G, dt) {
  const cam = G.camera;
  if (G.state === 'menu') {
    // Slow orbit over the plaza behind the start screen.
    const a = G.time * 0.05;
    const target = new THREE.Vector3(0, 12, 0);
    const desired = new THREE.Vector3(Math.sin(a) * 130, 55, Math.cos(a) * 130);
    G.cameraPos.lerp(desired, Math.min(1, dt * 1.2));
    cam.position.copy(G.cameraPos);
    cam.lookAt(target);
    return;
  }
  const car = G.player.car;
  let target, dist, height, yaw;
  if (car) {
    target = new THREE.Vector3(car.mesh.position.x, 2, car.mesh.position.z);
    dist = 10.5; height = 4.2; yaw = car.yaw;
  } else {
    target = new THREE.Vector3(G.player.pos.x, G.player.pos.y + 2, G.player.pos.z);
    dist = 7.5; height = 2.2; yaw = G.cameraYaw;
  }
  const pitch = car ? 0.3 : G.cameraPitch;
  const desired = new THREE.Vector3(
    target.x - Math.sin(yaw) * Math.cos(pitch) * dist,
    target.y + Math.sin(pitch) * dist + (car ? height - 2 : height - 2),
    target.z - Math.cos(yaw) * Math.cos(pitch) * dist
  );
  desired.y = Math.max(desired.y, target.y + 1.2);
  const k = car ? 1 - Math.exp(-6 * dt) : 1 - Math.exp(-14 * dt);
  G.cameraPos.lerp(desired, Math.min(1, k));
  cam.position.copy(G.cameraPos);
  cam.lookAt(target);
}

function tick(G, dt) {
  G.time += dt;
  if (G.state !== 'playing') {
    updateCamera(G, dt);
    return;
  }
  G.player.invulnTimer = Math.max(0, G.player.invulnTimer - dt);
  if (G.player.car) updateDriving(G, dt);
  else updatePlayer(G, dt);
  updateTraffic(G, dt);
  updatePedestrians(G, dt);
  updateWanted(G, dt);
  updatePolice(G, dt);
  updateMissions(G, dt);
  updateCombat(G, dt);
  updateSirenSound(G);
  updatePrompt(G);
  updateSpeedHud(G);
  drawMinimap(G);
  // Autosave every ten seconds.
  G.saveTimer += dt;
  if (G.saveTimer > 10) { G.saveTimer = 0; saveGame(G); }
  updateCamera(G, dt);
}

init();
