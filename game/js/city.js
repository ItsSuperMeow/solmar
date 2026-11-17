/* Solmar city: a procedural 8x8-block coastal grid with a beach, pier and plaza. */
(function () {
  var SOL = window.SOL;
  var THREE = window.THREE;

  var BLOCK = 40;      // block size
  var STREET = 12;     // street width
  var PITCH = BLOCK + STREET; // 52
  var STREETS = [];    // street centre lines, both axes
  for (var i = 0; i < 9; i++) STREETS.push((i - 4) * PITCH);

  var colliders = [];  // {x0, z0, x1, z1} building footprints
  var palms = [];
  var streetLights = [];

  function rand(a, b) { return a + Math.random() * (b - a); }
  function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // ---- Ground texture: roads, sidewalks, beach, water, plaza, parks ----
  function groundTexture() {
    var SIZE = 2048, WORLD = 720, HALF = WORLD / 2;
    var cv = document.createElement('canvas');
    cv.width = SIZE; cv.height = SIZE;
    var g = cv.getContext('2d');
    var s = SIZE / WORLD; // px per world unit
    function X(x) { return (x + HALF) * s; }
    function Z(z) { return (z + HALF) * s; }
    function rect(x0, z0, x1, z1, color) {
      g.fillStyle = color;
      g.fillRect(X(x0), Z(z0), (x1 - x0) * s, (z1 - z0) * s);
    }
    // Base: dry warm ground
    g.fillStyle = '#b39a68'; g.fillRect(0, 0, SIZE, SIZE);
    // Beach on the east edge, then the sea
    rect(214, -HALF, 258, HALF, '#e8d39a');
    var grad = g.createLinearGradient(X(258), 0, X(HALF), 0);
    grad.addColorStop(0, '#3a8ab5'); grad.addColorStop(1, '#1d4e7a');
    g.fillStyle = grad; g.fillRect(X(258), 0, SIZE - X(258), SIZE);
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 3;
    for (var w = 0; w < 8; w++) {
      g.beginPath();
      var wx = X(268 + w * 12);
      g.moveTo(wx, 0); g.bezierCurveTo(wx + 14, SIZE * 0.3, wx - 14, SIZE * 0.6, wx + 8, SIZE);
      g.stroke();
    }
    // Parks: the four blocks around the centre become the plaza park
    rect(-52, -52, 52, 52, '#5d7d46');
    // Sidewalks and roads stop at the city edge: the beach and sea stay clear.
    var CITY = 214;
    STREETS.forEach(function (c) {
      rect(c - 10, -CITY, c + 10, CITY, '#9a938a'); // sidewalk, vertical
      rect(-CITY, c - 10, CITY, c + 10, '#9a938a'); // sidewalk, horizontal
      rect(c - 6, -CITY, c + 6, CITY, '#3a3a42');   // road, vertical
      rect(-CITY, c - 6, CITY, c + 6, '#3a3a42');   // road, horizontal
    });
    // Lane dashes
    g.fillStyle = '#e8c33c';
    STREETS.forEach(function (c) {
      for (var d = -CITY + 8; d < CITY - 8; d += 16) {
        g.fillRect(X(c) - 1.5, Z(d), 3, 8 * s);
        g.fillRect(X(d), Z(c) - 1.5, 8 * s, 3);
      }
    });
    // Central plaza: roundabout with rings
    g.beginPath(); g.arc(X(0), Z(0), 30 * s, 0, Math.PI * 2); g.fillStyle = '#c9b18a'; g.fill();
    g.beginPath(); g.arc(X(0), Z(0), 22 * s, 0, Math.PI * 2); g.fillStyle = '#b39a68'; g.fill();
    g.beginPath(); g.arc(X(0), Z(0), 8 * s, 0, Math.PI * 2); g.fillStyle = '#4d8ab5'; g.fill();
    var tex = new THREE.CanvasTexture(cv);
    tex.anisotropy = 4;
    return tex;
  }

  // ---- Building face texture: lit and dark windows ----
  function buildingTexture(base, lit) {
    var cv = document.createElement('canvas');
    cv.width = 128; cv.height = 256;
    var g = cv.getContext('2d');
    g.fillStyle = base; g.fillRect(0, 0, 128, 256);
    for (var y = 12; y < 244; y += 22) {
      for (var x = 10; x < 118; x += 20) {
        var on = Math.random() < lit;
        g.fillStyle = on ? '#ffd98a' : '#20242e';
        g.fillRect(x, y, 12, 14);
      }
    }
    var tex = new THREE.CanvasTexture(cv);
    return tex;
  }

  var PALETTE = ['#d9a066', '#c98d5f', '#b5764f', '#e0b183', '#a87e5f', '#d8c49a', '#8fa3b5', '#c97e6d'];

  function addBuilding(game, cx, cz, w, d, h, faceTex) {
    var geo = new THREE.BoxGeometry(w, h, d);
    var side = new THREE.MeshLambertMaterial({ map: faceTex });
    var roof = new THREE.MeshLambertMaterial({ color: 0x6b5a4a });
    var mesh = new THREE.Mesh(geo, [side, side, roof, roof, side, side]);
    mesh.position.set(cx, h / 2, cz);
    mesh.castShadow = true; mesh.receiveShadow = true;
    game.scene.add(mesh);
    colliders.push({ x0: cx - w / 2, z0: cz - d / 2, x1: cx + w / 2, z1: cz + d / 2 });
    // Rooftop details: AC boxes and a water tank
    if (Math.random() < 0.7) {
      var ac = new THREE.Mesh(new THREE.BoxGeometry(3, 1.6, 2.4),
        new THREE.MeshLambertMaterial({ color: 0x8a8f96 }));
      ac.position.set(cx + rand(-w / 4, w / 4), h + 0.8, cz + rand(-d / 4, d / 4));
      game.scene.add(ac);
    }
    if (Math.random() < 0.35) {
      var tank = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 3, 10),
        new THREE.MeshLambertMaterial({ color: 0x7a6a58 }));
      tank.position.set(cx + rand(-w / 4, w / 4), h + 1.5, cz + rand(-d / 4, d / 4));
      game.scene.add(tank);
    }
    return mesh;
  }

  function addPalm(game, x, z, scale) {
    scale = scale || 1;
    var group = new THREE.Group();
    var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35 * scale, 0.55 * scale, 7 * scale, 7),
      new THREE.MeshLambertMaterial({ color: 0x8a6a48 }));
    trunk.position.y = 3.5 * scale;
    trunk.rotation.z = rand(-0.08, 0.08);
    group.add(trunk);
    var crown = new THREE.Mesh(new THREE.IcosahedronGeometry(2.6 * scale, 0),
      new THREE.MeshLambertMaterial({ color: 0x3f7d33, flatShading: true }));
    crown.scale.set(1.5, 0.45, 1.5);
    crown.position.y = 7.2 * scale;
    group.add(crown);
    group.position.set(x, 0, z);
    game.scene.add(group);
    palms.push(group);
    return group;
  }

  function addStreetLight(game, x, z) {
    var group = new THREE.Group();
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 6, 6),
      new THREE.MeshLambertMaterial({ color: 0x2c2f36 }));
    pole.position.y = 3;
    group.add(pole);
    var lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffd98a }));
    lamp.position.set(0, 6.1, 0);
    group.add(lamp);
    group.position.set(x, 0, z);
    game.scene.add(group);
    streetLights.push(group);
    return group;
  }

  function addPier(game) {
    var wood = new THREE.MeshLambertMaterial({ color: 0x9a7a52 });
    for (var x = 258; x <= 306; x += 4) {
      var plank = new THREE.Mesh(new THREE.BoxGeometry(4, 0.5, 10), wood);
      plank.position.set(x, 1.2, 0);
      plank.castShadow = true;
      game.scene.add(plank);
    }
    for (var px = 262; px <= 302; px += 10) {
      [-4, 4].forEach(function (dz) {
        var post = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 3, 6), wood);
        post.position.set(px, 0, dz);
        game.scene.add(post);
      });
    }
    // Little hut at the end of the pier
    var hut = new THREE.Mesh(new THREE.BoxGeometry(7, 4, 6),
      new THREE.MeshLambertMaterial({ color: 0xd9a066 }));
    hut.position.set(308, 3.2, 0);
    hut.castShadow = true;
    game.scene.add(hut);
    var hutRoof = new THREE.Mesh(new THREE.ConeGeometry(5.4, 2.6, 4),
      new THREE.MeshLambertMaterial({ color: 0x8a4d3a }));
    hutRoof.position.set(308, 6.4, 0);
    hutRoof.rotation.y = Math.PI / 4;
    game.scene.add(hutRoof);
    colliders.push({ x0: 304.5, z0: -3, x1: 311.5, z1: 3 });
  }

  SOL.City = {
    BLOCK: BLOCK, STREET: STREET, PITCH: PITCH, STREETS: STREETS,
    colliders: colliders,
    // Is the point on a road (within the asphalt)?
    isOnRoad: function (x, z) {
      for (var i = 0; i < STREETS.length; i++) {
        if (Math.abs(x - STREETS[i]) <= 6 || Math.abs(z - STREETS[i]) <= 6) return true;
      }
      return false;
    },
    // Nearest street centreline coordinate on one axis.
    nearestStreet: function (v) {
      var best = STREETS[0];
      for (var i = 0; i < STREETS.length; i++) {
        if (Math.abs(STREETS[i] - v) < Math.abs(best - v)) best = STREETS[i];
      }
      return best;
    },
    // A random point on a road lane (for traffic and parked cars).
    randomRoadPoint: function () {
      var c = pick(STREETS);
      var d = rand(-208, 208);
      if (Math.random() < 0.5) return { x: c + (Math.random() < 0.5 ? 3 : -3), z: d, axis: 'z' };
      return { x: d, z: c + (Math.random() < 0.5 ? 3 : -3), axis: 'x' };
    },
    init: function (game) {
      colliders.length = 0;
      // Ground
      var ground = new THREE.Mesh(
        new THREE.PlaneGeometry(720, 720),
        new THREE.MeshLambertMaterial({ map: groundTexture() }));
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      game.scene.add(ground);
      // Buildings: one block is 40 wide; leave a 4-unit sidewalk gap inside.
      var faceTexs = [
        buildingTexture('#c98d5f', 0.45),
        buildingTexture('#b5764f', 0.35),
        buildingTexture('#8fa3b5', 0.5),
        buildingTexture('#d9a066', 0.4)
      ];
      for (var bx = 0; bx < 8; bx++) {
        for (var bz = 0; bz < 8; bz++) {
          var cx = (bx - 3.5) * PITCH;
          var cz = (bz - 3.5) * PITCH;
          // The four central blocks are the plaza park: no buildings.
          if (Math.abs(cx) < 52 && Math.abs(cz) < 52) continue;
          var dist = Math.hypot(cx, cz);
          var hMax = dist < 110 ? 55 : dist < 170 ? 38 : 26;
          var n = Math.random() < 0.45 ? 1 : Math.random() < 0.6 ? 2 : 4;
          if (n === 1) {
            addBuilding(game, cx, cz, rand(24, 30), rand(24, 30), rand(14, hMax), pick(faceTexs));
          } else if (n === 2) {
            addBuilding(game, cx - 9, cz, 16, rand(22, 28), rand(10, hMax * 0.8), pick(faceTexs));
            addBuilding(game, cx + 9, cz, 16, rand(22, 28), rand(10, hMax), pick(faceTexs));
          } else {
            [-9, 9].forEach(function (dx) {
              [-9, 9].forEach(function (dz) {
                addBuilding(game, cx + dx, cz + dz, 15, 15, rand(8, hMax * 0.7), pick(faceTexs));
              });
            });
          }
        }
      }
      // Plaza park: fountain, palms, benches
      var fountain = new THREE.Mesh(new THREE.CylinderGeometry(7, 8, 1.2, 16),
        new THREE.MeshLambertMaterial({ color: 0xd8c49a }));
      fountain.position.set(0, 0.6, 0);
      game.scene.add(fountain);
      var water = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 0.5, 16),
        new THREE.MeshLambertMaterial({ color: 0x4d8ab5 }));
      water.position.set(0, 1.1, 0);
      game.scene.add(water);
      colliders.push({ x0: -8, z0: -8, x1: 8, z1: 8 });
      for (var p = 0; p < 14; p++) {
        var a = (p / 14) * Math.PI * 2;
        addPalm(game, Math.cos(a) * rand(34, 46), Math.sin(a) * rand(34, 46), rand(0.9, 1.3));
      }
      // Palms along the beach and scattered on sidewalks
      for (var b = 0; b < 22; b++) addPalm(game, rand(218, 250), rand(-200, 200), rand(0.9, 1.4));
      for (var s = 0; s < 30; s++) {
        var sp = this.randomRoadPoint();
        addPalm(game, sp.x + (sp.axis === 'z' ? 9 : 0), sp.z + (sp.axis === 'x' ? 9 : 0), rand(0.8, 1.1));
      }
      // Streetlights at every other intersection
      for (var ix = 0; ix < STREETS.length; ix += 2) {
        for (var iz = 0; iz < STREETS.length; iz += 2) {
          addStreetLight(game, STREETS[ix] + 8, STREETS[iz] + 8);
        }
      }
      addPier(game);
      // Clouds: flat white blobs drifting high above the city
      var cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
      for (var c = 0; c < 10; c++) {
        var cloud = new THREE.Group();
        for (var k = 0; k < 3; k++) {
          var puff = new THREE.Mesh(new THREE.SphereGeometry(rand(8, 16), 8, 6), cloudMat);
          puff.scale.y = 0.35;
          puff.position.set(k * rand(8, 14) - 12, rand(-1, 1), rand(-4, 4));
          cloud.add(puff);
        }
        cloud.position.set(rand(-260, 260), rand(90, 130), rand(-260, 260));
        game.scene.add(cloud);
      }
      // Warm sunset sun
      var sun = new THREE.Mesh(new THREE.SphereGeometry(18, 16, 12),
        new THREE.MeshBasicMaterial({ color: 0xffc46b, fog: false }));
      sun.position.set(-260, 120, -220);
      game.scene.add(sun);
    }
  };
})();
