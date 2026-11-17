/* Solmar combat: pistol shooting with raycast, muzzle flash and ammo. */
(function () {
  var SOL = window.SOL;
  var THREE = window.THREE;

  var raycaster = null;
  var flashLight = null;
  var flashTimer = 0;
  var tracer = null;

  SOL.Combat = {
    init: function (game) {
      raycaster = new THREE.Raycaster();
      raycaster.far = 80;
      flashLight = new THREE.PointLight(0xffc46b, 0, 18);
      game.scene.add(flashLight);
      // Tracer line shown briefly after each shot
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      tracer = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0 }));
      game.scene.add(tracer);
      game.ammo = 12;
      game.ammoReserve = 48;
      game.reloadTimer = 0;
    },
    shoot: function (game) {
      if (game.state !== 'playing' || game.driving || game.reloadTimer > 0) return;
      if (game.ammo <= 0) { this.reload(game); return; }
      game.ammo -= 1;
      SOL.Audio.gunshot();
      SOL.Police.addWanted(game, 0); // shooting itself is a crime, handled below
      game.wanted = Math.min(5, game.wanted + 1);
      game.lastCrimeAt = game.time;
      SOL.Audio.setSiren(game.wanted);
      SOL.Pedestrians.scareNearby(game, game.player.pos.x, game.player.pos.z, 40);
      // Raycast from the camera through the screen centre
      var dir = new THREE.Vector3();
      game.camera.getWorldDirection(dir);
      raycaster.set(game.camera.position, dir);
      var targets = [];
      for (var i = 0; i < game.peds.length; i++) if (!game.peds[i].down) targets.push(game.peds[i].mesh);
      for (var j = 0; j < game.cops.length; j++) if (!game.cops[j].down) targets.push(game.cops[j].mesh);
      var hits = raycaster.intersectObjects(targets, true);
      var endPoint = game.camera.position.clone().add(dir.clone().multiplyScalar(60));
      if (hits.length > 0) {
        var hitObj = hits[0].object;
        endPoint = hits[0].point.clone();
        // Find whose mesh was hit
        var all = game.peds.concat(game.cops);
        for (var k = 0; k < all.length; k++) {
          var t = all[k];
          if (t.down) continue;
          var found = false;
          t.mesh.traverse(function (child) { if (child === hitObj) found = true; });
          if (found) {
            t.down = true;
            t.downTimer = 8;
            t.mesh.rotation.x = -Math.PI / 2;
            t.mesh.position.y = 0.4;
            if (t.isCop) {
              SOL.Police.addWanted(game, 2);
              SOL.HUD.toast(game, 'You shot a cop! +2 stars');
            } else {
              SOL.Police.addWanted(game, 1);
              SOL.HUD.toast(game, 'You hit a pedestrian! +1 star');
            }
            break;
          }
        }
      }
      // Muzzle flash at the player's hand, tracer to the hit point
      var p = game.player.pos;
      var start = new THREE.Vector3(p.x, 1.6, p.z);
      flashLight.position.copy(start);
      flashLight.intensity = 3;
      flashTimer = 0.06;
      var posAttr = tracer.geometry.getAttribute('position');
      posAttr.setXYZ(0, start.x, start.y, start.z);
      posAttr.setXYZ(1, endPoint.x, endPoint.y, endPoint.z);
      posAttr.needsUpdate = true;
      tracer.material.opacity = 0.9;
      // Recoil kick on the camera
      game.camPitch += 0.02;
    },
    reload: function (game) {
      if (game.reloadTimer > 0 || game.ammo === 12 || game.ammoReserve <= 0) return;
      game.reloadTimer = 1.1;
      SOL.HUD.setHint(game, 'Reloading…');
    },
    update: function (game, dt) {
      if (flashTimer > 0) {
        flashTimer -= dt;
        if (flashTimer <= 0) flashLight.intensity = 0;
      }
      if (tracer && tracer.material.opacity > 0) {
        tracer.material.opacity = Math.max(0, tracer.material.opacity - dt * 8);
      }
      if (game.reloadTimer > 0) {
        game.reloadTimer -= dt;
        if (game.reloadTimer <= 0) {
          var need = 12 - game.ammo;
          var take = Math.min(need, game.ammoReserve);
          game.ammo += take;
          game.ammoReserve -= take;
          SOL.HUD.setHint(game, '');
        }
      }
    }
  };
})();
