/* Solmar vehicles: box-built cars, lane traffic, and arcade driving. */
(function () {
  var SOL = window.SOL;
  var THREE = window.THREE;

  var SEDAN_COLORS = [0xc23b2e, 0x2e5ec2, 0x3a8a4d, 0xd8d3c8, 0x6b4a8a, 0x222831];
  var STREETS = null;

  function wheel() {
    var w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10),
      new THREE.MeshLambertMaterial({ color: 0x14161a }));
    w.rotation.z = Math.PI / 2;
    w.castShadow = true;
    return w;
  }

  function makeCarMesh(type) {
    var g = new THREE.Group();
    var bodyColor = type === 'taxi' ? 0xffc21c : type === 'police' ? 0xe8e8e8 :
      type === 'sports' ? 0xd21f2b : type === 'truck' ? 0x7a5a3a :
      SEDAN_COLORS[Math.floor(Math.random() * SEDAN_COLORS.length)];
    var bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
    var glassMat = new THREE.MeshLambertMaterial({ color: 0x1c2733 });
    var body, cabin;
    if (type === 'truck') {
      body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 5.6), bodyMat);
      body.position.y = 1.0;
      cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.3, 1.6), bodyMat);
      cabin.position.set(0, 1.9, 1.6);
      var cargo = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.8, 3.2),
        new THREE.MeshLambertMaterial({ color: 0xb8b0a0 }));
      cargo.position.set(0, 2.1, -1.0);
      g.add(cargo);
    } else if (type === 'sports') {
      body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.75, 4.6), bodyMat);
      body.position.y = 0.75;
      cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 2.0), glassMat);
      cabin.position.set(0, 1.35, -0.2);
      var spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 0.5),
        new THREE.MeshLambertMaterial({ color: 0x14161a }));
      spoiler.position.set(0, 1.25, -2.2);
      g.add(spoiler);
    } else {
      body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.0, 4.4), bodyMat);
      body.position.y = 0.9;
      cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 2.2), glassMat);
      cabin.position.set(0, 1.75, -0.2);
    }
    body.castShadow = true; cabin.castShadow = true;
    g.add(body); g.add(cabin);
    if (type === 'taxi') {
      var sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.5),
        new THREE.MeshLambertMaterial({ color: 0xffd23c, emissive: 0x554400 }));
      sign.position.set(0, 2.3, -0.2);
      g.add(sign);
    }
    if (type === 'police') {
      var bar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.25, 0.6),
        new THREE.MeshLambertMaterial({ color: 0x222222 }));
      bar.position.set(0, 2.25, -0.2);
      g.add(bar);
      var red = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.6),
        new THREE.MeshBasicMaterial({ color: 0xff2222 }));
      red.position.set(-0.35, 2.45, -0.2);
      g.add(red);
      var blue = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.6),
        new THREE.MeshBasicMaterial({ color: 0x2266ff }));
      blue.position.set(0.35, 2.45, -0.2);
      g.add(blue);
      g.userData.lightRed = red; g.userData.lightBlue = blue;
      var doors = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.5, 1.6),
        new THREE.MeshLambertMaterial({ color: 0x1c2733 }));
      doors.position.set(0, 0.9, 0.2);
      g.add(doors);
    }
    // Wheels
    var wheels = [];
    var wz = type === 'truck' ? [-1.9, 1.9] : [-1.5, 1.5];
    wz.forEach(function (z) {
      [-0.95, 0.95].forEach(function (x) {
        var w = wheel();
        w.position.set(x, 0.42, z);
        g.add(w); wheels.push(w);
      });
    });
    g.userData.wheels = wheels;
    return g;
  }

  function lanePoint(ix, iz, heading) {
    // Intersection (ix, iz) as street indices, offset to the right lane of travel.
    var fx = Math.sin(heading), fz = Math.cos(heading);
    var rx = -fz, rz = fx; // right vector
    return { x: STREETS[ix] + rx * 3, z: STREETS[iz] + rz * 3 };
  }

  function spawnTrafficCar(game, type) {
    var ix = Math.floor(Math.random() * STREETS.length);
    var iz = Math.floor(Math.random() * STREETS.length);
    var heading = [0, Math.PI / 2, Math.PI, -Math.PI / 2][Math.floor(Math.random() * 4)];
    var pt = lanePoint(ix, iz, heading);
    var mesh = makeCarMesh(type || 'sedan');
    mesh.position.set(pt.x, 0, pt.z);
    mesh.rotation.y = heading;
    game.scene.add(mesh);
    var car = {
      mesh: mesh, pos: mesh.position, heading: heading,
      speed: 0, targetSpeed: 8 + Math.random() * 5,
      type: type || 'sedan', isTraffic: true, isPolice: false,
      ix: ix, iz: iz, wp: null, stopped: false,
      name: type === 'taxi' ? 'Taxi' : type === 'truck' ? 'Truck' : type === 'sports' ? 'Sports Car' : 'Sedan'
    };
    car.wp = nextWaypoint(car);
    game.cars.push(car);
    return car;
  }

  function nextWaypoint(car) {
    // From the current intersection, go straight, left or right (no U-turn).
    var dirs = [0, Math.PI / 2, -Math.PI / 2]; // straight, right, left (relative)
    var rel = dirs[Math.floor(Math.random() * dirs.length)];
    var heading = car.heading + rel;
    // Normalise to a cardinal heading
    heading = Math.round(heading / (Math.PI / 2)) * (Math.PI / 2);
    var dx = Math.round(Math.sin(heading)), dz = Math.round(Math.cos(heading));
    var nix = car.ix + dx, niz = car.iz + dz;
    if (nix < 0 || nix >= STREETS.length || niz < 0 || niz >= STREETS.length) {
      // Would leave the city: turn around instead.
      heading = car.heading + Math.PI;
      dx = Math.round(Math.sin(heading)); dz = Math.round(Math.cos(heading));
      nix = car.ix + dx; niz = car.iz + dz;
    }
    car.heading = heading;
    car.ix = nix; car.iz = niz;
    return lanePoint(nix, niz, heading);
  }

  function carAhead(game, car, dist) {
    var fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    for (var i = 0; i < game.cars.length; i++) {
      var o = game.cars[i];
      if (o === car) continue;
      var dx = o.pos.x - car.pos.x, dz = o.pos.z - car.pos.z;
      var along = dx * fx + dz * fz;
      var side = Math.abs(dx * fz - dz * fx);
      if (along > 0 && along < dist && side < 2.5) return true;
    }
    return false;
  }

  SOL.Vehicles = {
    init: function (game) {
      STREETS = SOL.City.STREETS;
      game.cars = [];
      // Parked cars along the streets
      var parkedTypes = ['sedan', 'sedan', 'taxi', 'sports', 'truck', 'sedan'];
      for (var i = 0; i < 14; i++) {
        var rp = SOL.City.randomRoadPoint();
        var type = parkedTypes[i % parkedTypes.length];
        var mesh = makeCarMesh(type);
        var heading = rp.axis === 'z' ? 0 : Math.PI / 2;
        if (Math.random() < 0.5) heading += Math.PI;
        mesh.position.set(rp.x + (rp.axis === 'z' ? 4.5 : 0), 0, rp.z + (rp.axis === 'x' ? 4.5 : 0));
        mesh.rotation.y = heading;
        game.scene.add(mesh);
        game.cars.push({
          mesh: mesh, pos: mesh.position, heading: heading,
          speed: 0, targetSpeed: 0, type: type, isTraffic: false, isPolice: false,
          ix: 0, iz: 0, wp: null, stopped: false,
          name: type === 'taxi' ? 'Taxi' : type === 'truck' ? 'Truck' : type === 'sports' ? 'Sports Car' : 'Sedan'
        });
      }
      // Moving traffic
      for (var t = 0; t < 12; t++) spawnTrafficCar(game, t % 4 === 0 ? 'taxi' : 'sedan');
      spawnTrafficCar(game, 'truck');
      // The red sports car in the plaza square: the prize of the final job.
      var prize = makeCarMesh('sports');
      prize.position.set(6, 0, -40);
      prize.rotation.y = Math.PI / 2;
      game.scene.add(prize);
      game.cars.push({
        mesh: prize, pos: prize.position, heading: Math.PI / 2,
        speed: 0, targetSpeed: 0, type: 'sports', isTraffic: false, isPolice: false,
        ix: 0, iz: 0, wp: null, stopped: false, name: 'Sports Car'
      });
    },
    makePoliceCar: function (game, x, z) {
      var mesh = makeCarMesh('police');
      mesh.position.set(x, 0, z);
      game.scene.add(mesh);
      var car = {
        mesh: mesh, pos: mesh.position, heading: 0,
        speed: 0, targetSpeed: 0, type: 'police', isTraffic: false, isPolice: true,
        ix: 0, iz: 0, wp: null, stopped: false, flash: 0,
        name: 'Police Cruiser'
      };
      game.cars.push(car);
      return car;
    },
    nearestCar: function (game, x, z, maxDist) {
      var best = null, bestD = maxDist;
      for (var i = 0; i < game.cars.length; i++) {
        var c = game.cars[i];
        var d = Math.hypot(c.pos.x - x, c.pos.z - z);
        if (d < bestD) { bestD = d; best = c; }
      }
      return best;
    },
    enterCar: function (game, car) {
      var p = game.player;
      if (car.isTraffic) {
        // Stealing a moving car: the driver bails and runs.
        car.isTraffic = false;
        car.targetSpeed = 0;
        SOL.Pedestrians.spawnFleeing(game, car.pos.x + 2, car.pos.z + 2);
        SOL.Police.addWanted(game, 1);
        SOL.HUD.toast(game, 'You stole a car! +1 star');
      } else if (car.isPolice) {
        SOL.HUD.toast(game, 'That is a police car — too hot to steal');
        return;
      }
      game.driving = car;
      p.mesh.visible = false;
      SOL.Audio.setEngine(0, true);
      SOL.HUD.showCar(game, car);
    },
    exitCar: function (game) {
      var car = game.driving;
      if (!car) return;
      var p = game.player;
      var rx = -Math.cos(car.heading), rz = Math.sin(car.heading);
      p.pos.set(car.pos.x + rx * 2.5, 0, car.pos.z + rz * 2.5);
      p.mesh.visible = true;
      p.vel.set(0, 0, 0);
      game.driving = null;
      SOL.Audio.setEngine(0, false);
      SOL.HUD.hideCar(game);
    },
    updateTraffic: function (game, dt) {
      for (var i = 0; i < game.cars.length; i++) {
        var car = game.cars[i];
        if (!car.isTraffic) continue;
        if (carAhead(game, car, 11)) {
          car.speed = Math.max(0, car.speed - 20 * dt);
        } else {
          car.speed += (car.targetSpeed - car.speed) * Math.min(1, dt * 1.5);
        }
        var dx = car.wp.x - car.pos.x, dz = car.wp.z - car.pos.z;
        var dist = Math.hypot(dx, dz);
        if (dist < 2.5) { car.wp = nextWaypoint(car); continue; }
        var wantHeading = Math.atan2(dx, dz);
        // Turn smoothly toward the waypoint
        var diff = wantHeading - car.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        car.heading += Math.max(-2.2 * dt, Math.min(2.2 * dt, diff));
        car.pos.x += Math.sin(car.heading) * car.speed * dt;
        car.pos.z += Math.cos(car.heading) * car.speed * dt;
        car.mesh.rotation.y = car.heading;
        spinWheels(car, dt);
      }
    },
    updateDriving: function (game, dt) {
      var car = game.driving;
      if (!car) return;
      var keys = game.keys;
      var accel = keys['KeyW'] ? 16 : keys['KeyS'] ? -22 : 0;
      if (keys['Space']) accel = car.speed > 0 ? -30 : -8; // handbrake
      car.speed += accel * dt;
      // Drag and limits
      car.speed -= car.speed * 0.55 * dt;
      if (car.speed > 30) car.speed = 30;
      if (car.speed < -10) car.speed = -10;
      if (!keys['KeyW'] && !keys['KeyS'] && Math.abs(car.speed) < 0.4) car.speed = 0;
      var steer = 0;
      if (keys['KeyA']) steer = 1;
      if (keys['KeyD']) steer = -1;
      var steerAmount = steer * (keys['Space'] ? 2.4 : 1.5) * Math.min(1, Math.abs(car.speed) / 8);
      car.heading += steerAmount * dt * (car.speed >= 0 ? 1 : -1);
      car.pos.x += Math.sin(car.heading) * car.speed * dt;
      car.pos.z += Math.cos(car.heading) * car.speed * dt;
      // Building collision: slide along walls, lose speed on a hard hit
      var before = { x: car.pos.x, z: car.pos.z };
      SOL.Player.collide(game, car.pos, 2.3);
      var hitHard = Math.hypot(car.pos.x - before.x, car.pos.z - before.z) > 0.01 && Math.abs(car.speed) > 12;
      if (hitHard) { SOL.Audio.crash(); car.speed *= 0.4; }
      // Bump other cars
      for (var i = 0; i < game.cars.length; i++) {
        var o = game.cars[i];
        if (o === car) continue;
        var dx = car.pos.x - o.pos.x, dz = car.pos.z - o.pos.z;
        var d = Math.hypot(dx, dz);
        if (d < 4.4 && d > 0.01) {
          car.pos.x = o.pos.x + dx / d * 4.4;
          car.pos.z = o.pos.z + dz / d * 4.4;
          car.speed *= 0.6;
          if (Math.abs(car.speed) > 8) SOL.Audio.crash();
        }
      }
      // Run over pedestrians
      SOL.Pedestrians.checkRunOver(game, car);
      car.mesh.rotation.y = car.heading;
      spinWheels(car, dt);
      // Player rides along
      game.player.pos.set(car.pos.x, 0, car.pos.z);
      game.player.yaw = car.heading;
      SOL.Audio.setEngine(Math.abs(car.speed) / 30, true);
    },
    updatePoliceLights: function (game, dt) {
      for (var i = 0; i < game.cars.length; i++) {
        var car = game.cars[i];
        if (!car.isPolice || !car.mesh.userData.lightRed) continue;
        car.flash += dt;
        var on = Math.floor(car.flash * 6) % 2 === 0;
        car.mesh.userData.lightRed.visible = on;
        car.mesh.userData.lightBlue.visible = !on;
      }
    }
  };

  function spinWheels(car, dt) {
    var wheels = car.mesh.userData.wheels;
    if (!wheels) return;
    for (var i = 0; i < wheels.length; i++) {
      wheels[i].rotation.x += car.speed * dt / 0.42;
    }
  }
})();
