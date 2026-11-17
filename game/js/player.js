/* Solmar player: Rio, on foot. WASD move, Shift run, Space jump, F punch. */
(function () {
  var SOL = window.SOL;
  var THREE = window.THREE;

  function buildPlayerMesh() {
    var g = new THREE.Group();
    var skin = new THREE.MeshLambertMaterial({ color: 0xc98d5f });
    var shirt = new THREE.MeshLambertMaterial({ color: 0x2e6f9e });
    var pants = new THREE.MeshLambertMaterial({ color: 0x2c2f36 });
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.5), shirt);
    body.position.y = 1.25; body.castShadow = true;
    g.add(body);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), skin);
    head.position.y = 2.1; head.castShadow = true;
    g.add(head);
    var cap = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.38, 0.16, 12),
      new THREE.MeshLambertMaterial({ color: 0xffd23c }));
    cap.position.y = 2.34;
    g.add(cap);
    var legL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.8, 0.36), pants);
    legL.position.set(-0.22, 0.4, 0); g.add(legL);
    var legR = legL.clone(); legR.position.x = 0.22; g.add(legR);
    var armL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.9, 0.3), shirt);
    armL.position.set(-0.6, 1.3, 0); g.add(armL);
    var armR = armL.clone(); armR.position.x = 0.6; g.add(armR);
    g.userData.legL = legL; g.userData.legR = legR;
    g.userData.armL = armL; g.userData.armR = armR;
    return g;
  }

  SOL.Player = {
    create: function (game, x, z) {
      var mesh = buildPlayerMesh();
      mesh.position.set(x, 0, z);
      game.scene.add(mesh);
      return {
        mesh: mesh,
        pos: mesh.position,
        vel: new THREE.Vector3(),
        yaw: Math.PI,           // facing direction
        onGround: true,
        health: 100,
        walkPhase: 0,
        speed: 0,
        punchCooldown: 0,
        punchAnim: 0
      };
    },
    // Circle vs building AABBs: push the player out of any overlap.
    collide: function (game, pos, radius) {
      var cols = SOL.City.colliders;
      for (var i = 0; i < cols.length; i++) {
        var c = cols[i];
        var nx = Math.max(c.x0, Math.min(pos.x, c.x1));
        var nz = Math.max(c.z0, Math.min(pos.z, c.z1));
        var dx = pos.x - nx, dz = pos.z - nz;
        var d2 = dx * dx + dz * dz;
        if (d2 < radius * radius) {
          if (d2 < 0.0001) { pos.x = c.x1 + radius; continue; }
          var d = Math.sqrt(d2);
          pos.x = nx + dx / d * radius;
          pos.z = nz + dz / d * radius;
        }
      }
      // Stay inside the city (and out of the deep sea).
      pos.x = Math.max(-214, Math.min(256, pos.x));
      pos.z = Math.max(-214, Math.min(214, pos.z));
    },
    update: function (game, dt) {
      var p = game.player;
      if (!p || game.driving) return;
      var keys = game.keys;
      var camYaw = game.camYaw;
      var fwd = { x: -Math.sin(camYaw), z: -Math.cos(camYaw) };
      var right = { x: -fwd.z, z: fwd.x };
      var mx = 0, mz = 0;
      if (keys['KeyW']) { mx += fwd.x; mz += fwd.z; }
      if (keys['KeyS']) { mx -= fwd.x; mz -= fwd.z; }
      if (keys['KeyD']) { mx += right.x; mz += right.z; }
      if (keys['KeyA']) { mx -= right.x; mz -= right.z; }
      var moving = (mx !== 0 || mz !== 0);
      var run = keys['ShiftLeft'] || keys['ShiftRight'];
      var speed = run ? 11 : 6;
      if (moving) {
        var len = Math.hypot(mx, mz);
        mx /= len; mz /= len;
        p.vel.x = mx * speed; p.vel.z = mz * speed;
        p.yaw = Math.atan2(mx, mz);
        p.walkPhase += dt * (run ? 14 : 9);
        p.speed = speed;
      } else {
        p.vel.x *= Math.max(0, 1 - dt * 10);
        p.vel.z *= Math.max(0, 1 - dt * 10);
        p.speed = 0;
      }
      // Gravity and jumping
      p.vel.y -= 30 * dt;
      if (keys['Space'] && p.onGround) { p.vel.y = 10; p.onGround = false; }
      p.pos.x += p.vel.x * dt;
      p.pos.z += p.vel.z * dt;
      p.pos.y += p.vel.y * dt;
      if (p.pos.y <= 0) { p.pos.y = 0; p.vel.y = 0; p.onGround = true; }
      this.collide(game, p.pos, 0.7);
      // Animate: legs swing, arms swing, punch swings the right arm.
      var mesh = p.mesh;
      mesh.rotation.y = p.yaw;
      var swing = moving ? Math.sin(p.walkPhase) * 0.55 : 0;
      mesh.userData.legL.rotation.x = swing;
      mesh.userData.legR.rotation.x = -swing;
      mesh.userData.armL.rotation.x = -swing * 0.7;
      if (p.punchAnim > 0) {
        p.punchAnim -= dt;
        mesh.userData.armR.rotation.x = -1.8 * Math.max(0, p.punchAnim / 0.25);
      } else {
        mesh.userData.armR.rotation.x = swing * 0.7;
      }
      if (p.punchCooldown > 0) p.punchCooldown -= dt;
    },
    // Punch: hits the nearest pedestrian or cop in front within 1.8 units.
    punch: function (game) {
      var p = game.player;
      if (!p || p.punchCooldown > 0 || game.driving) return;
      p.punchCooldown = 0.45;
      p.punchAnim = 0.25;
      SOL.Audio.punch();
      var fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
      var hit = null;
      var targets = game.peds.concat(game.cops);
      for (var i = 0; i < targets.length; i++) {
        var t = targets[i];
        if (t.down) continue;
        var dx = t.pos.x - p.pos.x, dz = t.pos.z - p.pos.z;
        var d = Math.hypot(dx, dz);
        if (d < 2.0 && (dx * fx + dz * fz) / Math.max(d, 0.001) > 0.3) { hit = t; break; }
      }
      if (hit) {
        hit.down = true;
        hit.downTimer = 6;
        hit.mesh.rotation.x = -Math.PI / 2;
        hit.mesh.position.y = 0.4;
        if (hit.isCop) {
          SOL.Police.addWanted(game, 2);
          SOL.HUD.toast(game, 'You knocked out a cop! +2 stars');
        } else {
          SOL.Police.addWanted(game, 1);
          SOL.HUD.toast(game, 'You hit a pedestrian! +1 star');
        }
      }
    },
    damage: function (game, amount) {
      var p = game.player;
      if (!p || game.state !== 'playing') return;
      p.health -= amount;
      game.health = p.health;
      SOL.HUD.flashDamage(game);
      if (p.health <= 0) {
        p.health = 0;
        game.health = 0;
        SOL.Main.wasted(game);
      }
    },
    heal: function (game, amount) {
      var p = game.player;
      if (!p) return;
      p.health = Math.min(100, p.health + amount);
      game.health = p.health;
    }
  };
})();
