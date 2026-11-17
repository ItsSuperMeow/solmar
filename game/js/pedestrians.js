/* Solmar pedestrians: sidewalk walkers who flee from danger. */
(function () {
  var SOL = window.SOL;
  var THREE = window.THREE;

  var SHIRTS = [0xd8d3c8, 0x3a8a4d, 0xc23b2e, 0xe0b183, 0x6b4a8a, 0x2e6f9e, 0xffd23c];
  var SKINS = [0xc98d5f, 0x8a5a3a, 0xe8b98a, 0x6b4423];

  function buildPedMesh() {
    var g = new THREE.Group();
    var shirt = new THREE.MeshLambertMaterial({ color: SHIRTS[Math.floor(Math.random() * SHIRTS.length)] });
    var skin = new THREE.MeshLambertMaterial({ color: SKINS[Math.floor(Math.random() * SKINS.length)] });
    var pants = new THREE.MeshLambertMaterial({ color: 0x2c2f36 });
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.05, 0.45), shirt);
    body.position.y = 1.2; body.castShadow = true;
    g.add(body);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), skin);
    head.position.y = 2.0; g.add(head);
    var legL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.75, 0.34), pants);
    legL.position.set(-0.2, 0.38, 0); g.add(legL);
    var legR = legL.clone(); legR.position.x = 0.2; g.add(legR);
    var armL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.85, 0.28), shirt);
    armL.position.set(-0.56, 1.25, 0); g.add(armL);
    var armR = armL.clone(); armR.position.x = 0.56; g.add(armR);
    g.userData.legL = legL; g.userData.legR = legR;
    g.userData.armL = armL; g.userData.armR = armR;
    return g;
  }

  function randomSidewalkPoint() {
    // A point on a sidewalk: just off a street, between intersections.
    var c = SOL.City.STREETS[Math.floor(Math.random() * SOL.City.STREETS.length)];
    var d = (Math.random() * 2 - 1) * 200;
    if (Math.random() < 0.5) return { x: c + 8.5, z: d };
    return { x: d, z: c + 8.5 };
  }

  function makePed(game, x, z) {
    var mesh = buildPedMesh();
    mesh.position.set(x, 0, z);
    game.scene.add(mesh);
    var ped = {
      mesh: mesh, pos: mesh.position,
      heading: Math.random() * Math.PI * 2,
      speed: 1.2 + Math.random() * 0.9,
      walkPhase: Math.random() * 6,
      scared: false, scaredTimer: 0,
      down: false, downTimer: 0,
      target: randomSidewalkPoint()
    };
    game.peds.push(ped);
    return ped;
  }

  SOL.Pedestrians = {
    init: function (game) {
      game.peds = [];
      for (var i = 0; i < 26; i++) {
        var pt = randomSidewalkPoint();
        makePed(game, pt.x, pt.z);
      }
    },
    spawnFleeing: function (game, x, z) {
      var ped = makePed(game, x, z);
      ped.scared = true;
      ped.scaredTimer = 5;
      return ped;
    },
    // A gunshot or a crash nearby scares everyone in earshot.
    scareNearby: function (game, x, z, radius) {
      for (var i = 0; i < game.peds.length; i++) {
        var p = game.peds[i];
        if (p.down) continue;
        var d = Math.hypot(p.pos.x - x, p.pos.z - z);
        if (d < radius) {
          p.scared = true;
          p.scaredTimer = 4 + Math.random() * 3;
        }
      }
    },
    // The player's car running someone over.
    checkRunOver: function (game, car) {
      if (Math.abs(car.speed) < 3) return;
      for (var i = 0; i < game.peds.length; i++) {
        var p = game.peds[i];
        if (p.down) continue;
        var d = Math.hypot(p.pos.x - car.pos.x, p.pos.z - car.pos.z);
        if (d < 2.4) {
          p.down = true;
          p.downTimer = 8;
          p.mesh.rotation.x = -Math.PI / 2;
          p.mesh.position.y = 0.4;
          SOL.Audio.crash();
          SOL.Police.addWanted(game, 1);
          SOL.HUD.toast(game, 'You hit a pedestrian! +1 star');
          this.scareNearby(game, car.pos.x, car.pos.z, 25);
        }
      }
    },
    update: function (game, dt) {
      for (var i = 0; i < game.peds.length; i++) {
        var p = game.peds[i];
        if (p.down) {
          p.downTimer -= dt;
          if (p.downTimer <= 0) {
            // Get up and run away from the scene.
            p.down = false;
            p.mesh.rotation.x = 0;
            p.mesh.position.y = 0;
            p.scared = true;
            p.scaredTimer = 5;
          }
          continue;
        }
        var speed = p.speed;
        var tx, tz;
        if (p.scared) {
          p.scaredTimer -= dt;
          if (p.scaredTimer <= 0) p.scared = false;
          speed = 5.5;
          // Run away from the player.
          var dx = p.pos.x - game.player.pos.x, dz = p.pos.z - game.player.pos.z;
          var d = Math.hypot(dx, dz) || 1;
          tx = p.pos.x + dx / d * 10;
          tz = p.pos.z + dz / d * 10;
        } else {
          tx = p.target.x; tz = p.target.z;
          if (Math.hypot(tx - p.pos.x, tz - p.pos.z) < 1.5) p.target = randomSidewalkPoint();
        }
        var mx = tx - p.pos.x, mz = tz - p.pos.z;
        var len = Math.hypot(mx, mz);
        if (len > 0.01) {
          mx /= len; mz /= len;
          p.pos.x += mx * speed * dt;
          p.pos.z += mz * speed * dt;
          p.heading = Math.atan2(mx, mz);
          p.walkPhase += dt * (p.scared ? 16 : 8);
        }
        SOL.Player.collide(game, p.pos, 0.6);
        p.mesh.rotation.y = p.heading;
        var swing = Math.sin(p.walkPhase) * 0.5;
        p.mesh.userData.legL.rotation.x = swing;
        p.mesh.userData.legR.rotation.x = -swing;
        p.mesh.userData.armL.rotation.x = -swing * 0.6;
        p.mesh.userData.armR.rotation.x = swing * 0.6;
      }
    }
  };
})();
