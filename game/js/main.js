/* Solmar main: init, game loop, camera, input, states, screenshot staging. */
(function () {
  var SOL = window.SOL;
  var THREE = window.THREE;

  var game = null;
  var renderer = null;
  var frameCount = 0;
  var lastSaveAt = 0;
  var lastMouseMoveAt = 0;
  var clock = new THREE.Clock();

  function buildRenderer() {
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    document.getElementById('game').appendChild(renderer.domElement);
    return renderer;
  }

  function buildLights(scene) {
    var hemi = new THREE.HemisphereLight(0xffd9a0, 0x5a4a3a, 0.75);
    scene.add(hemi);
    var sun = new THREE.DirectionalLight(0xffd9a0, 1.15);
    sun.position.set(-180, 220, -120);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -260; sun.shadow.camera.right = 260;
    sun.shadow.camera.top = 260; sun.shadow.camera.bottom = -260;
    sun.shadow.camera.near = 10; sun.shadow.camera.far = 700;
    sun.shadow.bias = -0.0006;
    scene.add(sun);
    var amb = new THREE.AmbientLight(0x604a5a, 0.35);
    scene.add(amb);
  }

  function newGameState() {
    return {
      state: 'menu',
      scene: null, camera: null,
      keys: {},
      money: 0, health: 100, wanted: 0,
      time: 0, lastCrimeAt: -1000,
      player: null, driving: null,
      cars: [], peds: [], cops: [], policeCars: [],
      camYaw: Math.PI, camPitch: 0.32,
      ammo: 12, ammoReserve: 48, reloadTimer: 0,
      missionIndex: 0, missionStep: 0, missionActive: false,
      missionTimer: 0, missionTarget: null, missionsDone: [],
      shotMode: null
    };
  }

  function updateCamera(dt) {
    var target = game.driving ? game.driving.pos : game.player.pos;
    // While driving with no recent mouse input, ease the camera behind the car.
    if (game.driving && performance.now() - lastMouseMoveAt > 1500) {
      var want = game.driving.heading + Math.PI;
      var diff = want - game.camYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      game.camYaw += diff * Math.min(1, dt * 1.2);
    }
    // Arrow keys steer the camera when pointer lock is off.
    if (game.keys['ArrowLeft']) game.camYaw += 2.2 * dt;
    if (game.keys['ArrowRight']) game.camYaw -= 2.2 * dt;
    if (game.keys['ArrowUp']) game.camPitch = Math.max(0.05, game.camPitch - 1.4 * dt);
    if (game.keys['ArrowDown']) game.camPitch = Math.min(1.2, game.camPitch + 1.4 * dt);
    var dist = game.driving ? 12 : 8;
    var cp = Math.cos(game.camPitch), sp = Math.sin(game.camPitch);
    var cx = target.x + Math.sin(game.camYaw) * cp * dist;
    var cy = 2 + sp * dist;
    var cz = target.z + Math.cos(game.camYaw) * cp * dist;
    game.camera.position.set(cx, cy, cz);
    game.camera.lookAt(target.x, target.y + 2, target.z);
  }

  function bindInput() {
    window.addEventListener('keydown', function (e) {
      if (e.code === 'Space' || e.code.indexOf('Arrow') === 0) e.preventDefault();
      if (e.repeat) return;
      game.keys[e.code] = true;
      if (game.state !== 'playing') return;
      if (e.code === 'KeyE') {
        if (game.driving) {
          SOL.Vehicles.exitCar(game);
        } else {
          var car = SOL.Vehicles.nearestCar(game, game.player.pos.x, game.player.pos.z, 4);
          if (car) SOL.Vehicles.enterCar(game, car);
        }
      }
      if (e.code === 'KeyF') SOL.Player.punch(game);
      if (e.code === 'KeyR') SOL.Combat.reload(game);
      if (e.code === 'KeyP') togglePause();
    });
    window.addEventListener('keyup', function (e) { game.keys[e.code] = false; });
    document.addEventListener('mousemove', function (e) {
      if (document.pointerLockElement !== renderer.domElement) return;
      game.camYaw -= e.movementX * 0.0025;
      game.camPitch = Math.max(0.05, Math.min(1.2, game.camPitch + e.movementY * 0.0025));
      lastMouseMoveAt = performance.now();
    });
    document.addEventListener('mousedown', function (e) {
      if (game.state !== 'playing' || e.button !== 0) return;
      if (document.pointerLockElement !== renderer.domElement) {
        try { renderer.domElement.requestPointerLock(); } catch (err) { /* headless: arrows steer */ }
        return;
      }
      SOL.Combat.shoot(game);
    });
    window.addEventListener('resize', function () {
      game.camera.aspect = window.innerWidth / window.innerHeight;
      game.camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  function togglePause() {
    if (game.state === 'playing') {
      game.state = 'paused';
      document.getElementById('paused').classList.remove('hidden');
      if (document.pointerLockElement) document.exitPointerLock();
    } else if (game.state === 'paused') {
      game.state = 'playing';
      document.getElementById('paused').classList.add('hidden');
    }
  }

  function startPlaying() {
    document.getElementById('menu').classList.add('hidden');
    document.getElementById('busted').classList.add('hidden');
    document.getElementById('wasted').classList.add('hidden');
    SOL.HUD.show();
    game.state = 'playing';
    SOL.Audio.unlock();
    try { renderer.domElement.requestPointerLock(); } catch (err) { /* headless */ }
    if (game.missionIndex < SOL.Missions.defs.length && !game.missionActive) {
      SOL.Missions.start(game);
    }
  }

  function respawn(game) {
    game.player.pos.set(14, 0, -30);
    game.player.vel.set(0, 0, 0);
    game.player.health = 100;
    game.health = 100;
    game.wanted = 0;
    SOL.Audio.setSiren(0);
    if (game.driving) SOL.Vehicles.exitCar(game);
    game.player.mesh.visible = true;
    // Clear police presence
    for (var i = 0; i < game.cops.length; i++) game.scene.remove(game.cops[i].mesh);
    game.cops = [];
    for (var j = 0; j < game.policeCars.length; j++) {
      var idx = game.cars.indexOf(game.policeCars[j]);
      if (idx >= 0) game.cars.splice(idx, 1);
      game.scene.remove(game.policeCars[j].mesh);
    }
    game.policeCars = [];
    game.camYaw = Math.PI;
    game.camPitch = 0.32;
  }

  SOL.Main = {
    busted: function (g) {
      g.state = 'busted';
      SOL.Audio.busted();
      g.money = Math.max(0, g.money - 200);
      SOL.HUD.toast(g, 'Busted! Mara paid $200 bail.');
      SOL.Save.store(g);
      if (g.missionActive) SOL.Missions.fail(g, 'Busted by the police');
      document.getElementById('busted').classList.remove('hidden');
      if (document.pointerLockElement) document.exitPointerLock();
    },
    wasted: function (g) {
      g.state = 'wasted';
      g.money = Math.max(0, g.money - 100);
      SOL.Save.store(g);
      if (g.missionActive) SOL.Missions.fail(g, 'Wasted on the street');
      document.getElementById('wasted').classList.remove('hidden');
      if (document.pointerLockElement) document.exitPointerLock();
    },
    init: function () {
      game = newGameState();
      window.SOL.game = game;
      var scene = new THREE.Scene();
      scene.background = new THREE.Color(0xffa06a);
      scene.fog = new THREE.Fog(0xffb37a, 130, 460);
      game.scene = scene;
      var camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
      game.camera = camera;
      buildRenderer();
      buildLights(scene);
      SOL.City.init(game);
      game.player = SOL.Player.create(game, 14, -30);
      SOL.Vehicles.init(game);
      SOL.Pedestrians.init(game);
      SOL.Police.init(game);
      SOL.Combat.init(game);
      SOL.Missions.init(game);
      SOL.HUD.init(game);
      bindInput();
      // Menu buttons
      var save = SOL.Save.load();
      if (save) {
        document.getElementById('continue-btn').classList.remove('hidden');
        document.getElementById('continue-money').textContent = Math.round(save.money).toLocaleString('en-US');
        document.getElementById('continue-missions').textContent = save.missionsDone.length;
        document.getElementById('continue-btn').addEventListener('click', function () {
          game.money = save.money;
          game.missionsDone = save.missionsDone.slice();
          game.missionIndex = save.missionsDone.length;
          game.health = save.health || 100;
          game.player.health = game.health;
          if (save.pos) game.player.pos.set(save.pos[0], 0, save.pos[1]);
          startPlaying();
        });
      }
      document.getElementById('start-btn').addEventListener('click', function () {
        SOL.Save.clear();
        startPlaying();
      });
      document.getElementById('busted-btn').addEventListener('click', function () {
        respawn(game);
        startPlaying();
      });
      document.getElementById('wasted-btn').addEventListener('click', function () {
        respawn(game);
        startPlaying();
      });
      // Screenshot staging: ?shot=street|drive|chase|mission
      var params = new URLSearchParams(window.location.search);
      var shot = params.get('shot');
      if (shot) {
        game.shotMode = shot;
        this.stageShot(shot);
      }
      this.loop(0);
    },
    stageShot: function (shot) {
      document.getElementById('menu').classList.add('hidden');
      SOL.HUD.show();
      game.state = 'playing';
      game.money = 1250;
      if (shot === 'street') {
        game.player.pos.set(8, 0, -52);
        game.player.yaw = Math.PI / 2;
        game.camYaw = -Math.PI / 2;
        game.camPitch = 0.28;
        SOL.Missions.start(game);
      } else if (shot === 'drive') {
        var car = SOL.Vehicles.nearestCar(game, 0, 0, 500);
        // Prefer a sports car for the shot
        for (var i = 0; i < game.cars.length; i++) {
          if (game.cars[i].type === 'sports') { car = game.cars[i]; break; }
        }
        car.pos.set(-150, 0, 3);
        car.heading = Math.PI / 2;
        car.mesh.rotation.y = car.heading;
        SOL.Vehicles.enterCar(game, car);
        car.speed = 18;
        game.camYaw = Math.PI / 2 + Math.PI;
        game.camPitch = 0.3;
        SOL.Missions.start(game);
      } else if (shot === 'chase') {
        var sedan = null;
        for (var j = 0; j < game.cars.length; j++) {
          if (game.cars[j].type === 'sedan' && !game.cars[j].isTraffic) { sedan = game.cars[j]; break; }
        }
        // Stage the chase on a proper road, not the plaza grass.
        sedan.pos.set(-100, 0, -3);
        sedan.heading = Math.PI / 2;
        sedan.mesh.rotation.y = Math.PI / 2;
        SOL.Vehicles.enterCar(game, sedan);
        sedan.speed = 20;
        game.camYaw = Math.PI / 2 + Math.PI;
        game.camPitch = 0.3;
        game.missionIndex = 2;
        SOL.Police.addWanted(game, 3);
        SOL.Missions.start(game);
      } else if (shot === 'mission') {
        game.player.pos.set(238, 0, 0);
        game.player.yaw = Math.PI / 2;
        game.camYaw = -Math.PI / 2;
        game.camPitch = 0.3;
        game.missionIndex = 1;
        SOL.Missions.start(game);
      }
    },
    loop: function () {
      requestAnimationFrame(SOL.Main.loop);
      // Real elapsed time, clamped: the game runs at true speed on any frame rate.
      var dt = Math.min(clock.getDelta(), 0.05);
      if (game.state === 'playing') {
        game.time += dt;
        SOL.Player.update(game, dt);
        SOL.Vehicles.updateTraffic(game, dt);
        SOL.Vehicles.updateDriving(game, dt);
        SOL.Vehicles.updatePoliceLights(game, dt);
        SOL.Pedestrians.update(game, dt);
        SOL.Police.update(game, dt);
        SOL.Combat.update(game, dt);
        SOL.Missions.update(game, dt);
        updateCamera(dt);
        SOL.HUD.update(game);
        if (game.time - lastSaveAt > 15) {
          lastSaveAt = game.time;
          SOL.Save.store(game);
        }
      }
      frameCount++;
      renderer.render(game.scene, game.camera);
      // Screenshot mode: signal readiness once the scene has settled.
      if (game.shotMode && !window.__solmarReady && game.time > 1.5 && frameCount > 8) {
        window.__solmarReady = true;
      }
    }
  };

  // Boot once the page (and three.js) has loaded.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { SOL.Main.init(); });
  } else {
    SOL.Main.init();
  }
})();
