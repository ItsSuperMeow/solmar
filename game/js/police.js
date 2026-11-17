/* Solmar police: the wanted level, foot officers and pursuit cars. */
(function () {
  var SOL = window.SOL;
  var THREE = window.THREE;

  function buildCopMesh() {
    var g = new THREE.Group();
    var navy = new THREE.MeshLambertMaterial({ color: 0x1d2f4d });
    var skin = new THREE.MeshLambertMaterial({ color: 0xc98d5f });
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.5), navy);
    body.position.y = 1.25; body.castShadow = true;
    g.add(body);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), skin);
    head.position.y = 2.1; g.add(head);
    var hat = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.38, 0.14, 12),
      new THREE.MeshLambertMaterial({ color: 0x101c30 }));
    hat.position.y = 2.36;
    g.add(hat);
    var legL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.8, 0.36), navy);
    legL.position.set(-0.22, 0.4, 0); g.add(legL);
    var legR = legL.clone(); legR.position.x = 0.22; g.add(legR);
    var armL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.9, 0.3), navy);
    armL.position.set(-0.6, 1.3, 0); g.add(armL);
    var armR = armL.clone(); armR.position.x = 0.6; g.add(armR);
    g.userData.legL = legL; g.userData.legR = legR;
    g.userData.armL = armL; g.userData.armR = armR;
    return g;
  }

  function spawnCop(game) {
    var p = game.player.pos;
    var a = Math.random() * Math.PI * 2;
    var x = p.x + Math.cos(a) * 45, z = p.z + Math.sin(a) * 45;
    x = Math.max(-210, Math.min(210, x));
    z = Math.max(-210, Math.min(210, z));
    var mesh = buildCopMesh();
    mesh.position.set(x, 0, z);
    game.scene.add(mesh);
    var cop = {
      mesh: mesh, pos: mesh.position,
      heading: 0, speed: 0, walkPhase: Math.random() * 6,
      down: false, downTimer: 0, isCop: true,
      bustTimer: 0
    };
    game.cops.push(cop);
    return cop;
  }

  function wantedTarget(game) {
    // How many officers and pursuit cars each wanted level calls for.
    var table = [
      { cops: 0, cars: 0 },
      { cops: 1, cars: 0 },
      { cops: 2, cars: 1 },
      { cops: 3, cars: 2 },
      { cops: 4, cars: 3 },
      { cops: 5, cars: 4 }
    ];
    return table[Math.max(0, Math.min(5, game.wanted))];
  }

  SOL.Police = {
    init: function (game) {
      game.cops = [];
      game.policeCars = [];
      game.wanted = 0;
      game.lastCrimeAt = -1000;
      game.time = 0;
    },
    addWanted: function (game, stars) {
      game.wanted = Math.min(5, game.wanted + stars);
      game.lastCrimeAt = game.time;
      SOL.Audio.setSiren(game.wanted);
    },
    update: function (game, dt) {
      // Wanted decays after 30 seconds with no new crime.
      if (game.wanted > 0 && game.time - game.lastCrimeAt > 30) {
        game.wanted = 0;
        SOL.Audio.setSiren(0);
        SOL.HUD.toast(game, 'You lost the heat. The streets are calm again.');
      }
      var target = wantedTarget(game);
      // Spawn officers up to the wanted level's call.
      while (game.cops.length < target.cops) spawnCop(game);
      while (game.policeCars.length < target.cars) {
        var p = game.player.pos;
        var car = SOL.Vehicles.makePoliceCar(game,
          p.x + (Math.random() < 0.5 ? -60 : 60), p.z + (Math.random() < 0.5 ? -60 : 60));
        game.policeCars.push(car);
      }
      // Stand down extra police when the heat drops.
      while (game.cops.length > target.cops) {
        var cop = game.cops.pop();
        game.scene.remove(cop.mesh);
      }
      while (game.policeCars.length > target.cars) {
        var pc = game.policeCars.pop();
        var idx = game.cars.indexOf(pc);
        if (idx >= 0) game.cars.splice(idx, 1);
        game.scene.remove(pc.mesh);
      }
      this.updateCops(game, dt);
      this.updatePursuit(game, dt);
    },
    updateCops: function (game, dt) {
      var pp = game.player.pos;
      for (var i = 0; i < game.cops.length; i++) {
        var cop = game.cops[i];
        if (cop.down) {
          cop.downTimer -= dt;
          if (cop.downTimer <= 0) {
            cop.down = false;
            cop.mesh.rotation.x = 0;
            cop.mesh.position.y = 0;
          }
          continue;
        }
        var dx = pp.x - cop.pos.x, dz = pp.z - cop.pos.z;
        var d = Math.hypot(dx, dz);
        var speed = game.driving ? 7.5 : 6.5;
        if (d > 1.6) {
          cop.pos.x += dx / d * speed * dt;
          cop.pos.z += dz / d * speed * dt;
          cop.heading = Math.atan2(dx, dz);
          cop.walkPhase += dt * 11;
        }
        SOL.Player.collide(game, cop.pos, 0.6);
        cop.mesh.rotation.y = cop.heading;
        var swing = Math.sin(cop.walkPhase) * 0.55;
        cop.mesh.userData.legL.rotation.x = swing;
        cop.mesh.userData.legR.rotation.x = -swing;
        cop.mesh.userData.armL.rotation.x = -swing * 0.6;
        cop.mesh.userData.armR.rotation.x = swing * 0.6;
        // Busted: a cop stays on you for 2.5 seconds on foot.
        if (!game.driving && d < 1.8) {
          cop.bustTimer += dt;
          if (cop.bustTimer > 2.5) {
            cop.bustTimer = 0;
            SOL.Main.busted(game);
            return;
          }
        } else {
          cop.bustTimer = 0;
        }
        // A cop next to the player's car drags Rio out and busts him.
        if (game.driving && d < 2.6) {
          cop.bustTimer += dt;
          if (cop.bustTimer > 1.5) {
            cop.bustTimer = 0;
            SOL.Main.busted(game);
            return;
          }
        } else if (game.driving) {
          cop.bustTimer = 0;
        }
      }
    },
    updatePursuit: function (game, dt) {
      var pp = game.player.pos;
      for (var i = 0; i < game.policeCars.length; i++) {
        var car = game.policeCars[i];
        var dx = pp.x - car.pos.x, dz = pp.z - car.pos.z;
        var d = Math.hypot(dx, dz);
        var wantHeading = Math.atan2(dx, dz);
        var diff = wantHeading - car.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        var topSpeed = 20 + game.wanted * 2;
        car.speed += (topSpeed - car.speed) * Math.min(1, dt * 0.8);
        car.heading += Math.max(-2.6 * dt, Math.min(2.6 * dt, diff));
        car.pos.x += Math.sin(car.heading) * car.speed * dt;
        car.pos.z += Math.cos(car.heading) * car.speed * dt;
        SOL.Player.collide(game, car.pos, 2.3);
        car.mesh.rotation.y = car.heading;
        var wheels = car.mesh.userData.wheels;
        if (wheels) for (var w = 0; w < wheels.length; w++) wheels[w].rotation.x += car.speed * dt / 0.42;
        // Ram the player: a hard hit hurts and slows the chase car.
        if (d < 4.6) {
          if (game.driving) {
            game.driving.speed *= 0.55;
            SOL.Audio.crash();
            SOL.Player.damage(game, 6);
          } else {
            SOL.Player.damage(game, 10);
            // Shove the player away from the car
            game.player.pos.x += dx / Math.max(d, 0.1) * -3;
            game.player.pos.z += dz / Math.max(d, 0.1) * -3;
          }
          car.speed *= 0.5;
        }
      }
    }
  };
})();
