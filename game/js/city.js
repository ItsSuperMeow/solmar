// Solmar city — a procedural sun-soaked coastal city, built once at load.
// An 8x8-block street grid, buildings with painted window textures, a beach
// and sea on the east edge (roads never cross the sand), a pier, a central
// plaza with a fountain, palms and streetlights. Warm sunset light and fog.
// All randomness comes from a seeded generator, so the city is identical
// on every load — screenshots are reproducible.

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A painted facade: base colour with a grid of windows, some lit.
function facadeTexture(base, litRatio, rng) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = base;
  x.fillRect(0, 0, 128, 256);
  const cols = 4, rows = 10;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const lit = rng() < litRatio;
      x.fillStyle = lit ? '#ffd98a' : '#2e3a4a';
      x.fillRect(10 + col * 30, 12 + r * 24, 18, 14);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

// A dashed centre line for one road, as a transparent strip.
function laneTexture() {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 64;
  const x = c.getContext('2d');
  x.clearRect(0, 0, 16, 64);
  x.fillStyle = '#ffd23c';
  x.fillRect(6, 4, 4, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function buildCity(G) {
  const rng = mulberry32(G.seed || 7);
  const scene = G.scene;
  const PITCH = 52, BLOCK = 40;
  const ROADS = [-182, -130, -78, -26, 26, 78, 130, 182];
  const BLOCKS = [-156, -104, -52, 0, 52, 104, 156];
  G.roads = { xs: ROADS.slice(), zs: ROADS.slice(), pitch: PITCH, half: 188 };
  G.colliders = [];
  G.citySeed = G.seed || 7;

  // --- sky, fog, light -------------------------------------------------
  scene.background = new THREE.Color(0xffa85e);
  scene.fog = new THREE.Fog(0xffa85e, 220, 720);
  const hemi = new THREE.HemisphereLight(0xffd9a0, 0x7a5f4a, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffc98a, 1.35);
  sun.position.set(-160, 90, 60);
  scene.add(sun);
  // The sun itself, low in the west.
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(26, 32),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0, fog: false })
  );
  sunDisc.position.set(-420, 110, -80);
  sunDisc.lookAt(0, 40, 0);
  scene.add(sunDisc);
  // A few clouds drifting high up.
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xfff4e0, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 9; i++) {
    const cloud = new THREE.Mesh(new THREE.SphereGeometry(14 + rng() * 16, 10, 8), cloudMat);
    cloud.scale.y = 0.32;
    cloud.position.set(-320 + rng() * 640, 120 + rng() * 50, -260 + rng() * 520);
    scene.add(cloud);
  }

  // --- ground: asphalt everywhere, blocks raised as sidewalks ----------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(420, 420),
    new THREE.MeshLambertMaterial({ color: 0x3d3a38 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(-6, 0, 0);
  scene.add(ground);

  const sidewalkMat = new THREE.MeshLambertMaterial({ color: 0xb5aa97 });
  const blockGeo = new THREE.BoxGeometry(BLOCK, 0.5, BLOCK);
  for (const bx of BLOCKS) {
    for (const bz of BLOCKS) {
      const block = new THREE.Mesh(blockGeo, sidewalkMat);
      block.position.set(bx, 0.25, bz);
      scene.add(block);
    }
  }

  // --- dashed centre lines on every road --------------------------------
  const laneTex = laneTexture();
  const laneMat = new THREE.MeshBasicMaterial({ map: laneTex, transparent: true, depthWrite: false });
  for (const r of ROADS) {
    // North-south road (runs along z).
    const ns = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 384), laneMat.clone());
    ns.material.map = laneTex.clone();
    ns.material.map.repeat.set(1, 24);
    ns.material.map.needsUpdate = true;
    ns.rotation.x = -Math.PI / 2;
    ns.position.set(r, 0.06, 0);
    scene.add(ns);
    // East-west road (runs along x). Stops at the beach: never crosses sand.
    const ew = new THREE.Mesh(new THREE.PlaneGeometry(384, 1.6), laneMat.clone());
    ew.material.map = laneTex.clone();
    ew.material.map.repeat.set(24, 1);
    ew.material.map.needsUpdate = true;
    ew.rotation.x = -Math.PI / 2;
    ew.position.set(-3, 0.06, r);
    scene.add(ew);
  }

  // --- buildings ---------------------------------------------------------
  const bases = ['#f2e3c6', '#d98a63', '#e8e4da', '#f0c9a0', '#d9c49a', '#c9b8a3'];
  const wallMats = bases.map((b) => {
    const tex = facadeTexture(b, 0.28, rng);
    return new THREE.MeshLambertMaterial({ map: tex });
  });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x6b5d4f });
  const acMat = new THREE.MeshLambertMaterial({ color: 0x8a8f94 });
  const roofGeo = new THREE.BoxGeometry(1, 0.5, 1);
  const acGeo = new THREE.BoxGeometry(2.4, 1.2, 2.4);
  let buildingCount = 0;
  for (const bx of BLOCKS) {
    for (const bz of BLOCKS) {
      if (bx === 0 && bz === 0) continue; // the central plaza stays open
      const n = rng() < 0.45 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const w = 15 + rng() * 13, d = 15 + rng() * 13, h = 9 + rng() * rng() * 34;
        const ox = n === 2 ? (k === 0 ? -9 : 9) : 0;
        const oz = n === 2 ? (rng() - 0.5) * 8 : (rng() - 0.5) * 6;
        const x = bx + ox, z = bz + oz;
        const wall = wallMats[Math.floor(rng() * wallMats.length)];
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [wall, wall, roofMat, roofMat, wall, wall]);
        b.position.set(x, h / 2 + 0.5, z);
        scene.add(b);
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.scale.set(w + 0.6, 1, d + 0.6);
        roof.position.set(x, h + 0.75, z);
        scene.add(roof);
        const ac = new THREE.Mesh(acGeo, acMat);
        ac.position.set(x + (rng() - 0.5) * w * 0.4, h + 1.5, z + (rng() - 0.5) * d * 0.4);
        scene.add(ac);
        G.colliders.push({ minX: x - w / 2 - 0.4, maxX: x + w / 2 + 0.4, minZ: z - d / 2 - 0.4, maxZ: z + d / 2 + 0.4 });
        buildingCount++;
      }
    }
  }
  G.cityStats = { buildings: buildingCount };

  // --- central plaza: fountain and benches -------------------------------
  const fountainBase = new THREE.Mesh(
    new THREE.CylinderGeometry(8, 8.6, 1.1, 24),
    new THREE.MeshLambertMaterial({ color: 0xd8cfc0 })
  );
  fountainBase.position.set(0, 1.05, 0);
  scene.add(fountainBase);
  const fountainWater = new THREE.Mesh(
    new THREE.CylinderGeometry(7.2, 7.2, 0.3, 24),
    new THREE.MeshLambertMaterial({ color: 0x3fa7c9 })
  );
  fountainWater.position.set(0, 1.5, 0);
  scene.add(fountainWater);
  const fountainColumn = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 1.2, 3.4, 12),
    new THREE.MeshLambertMaterial({ color: 0xe8e0d0 })
  );
  fountainColumn.position.set(0, 3, 0);
  scene.add(fountainColumn);
  const benchMat = new THREE.MeshLambertMaterial({ color: 0x7a5230 });
  for (const [bx, bz, ry] of [[-14, 0, 0], [14, 0, 0], [0, -14, Math.PI / 2], [0, 14, Math.PI / 2]]) {
    const bench = new THREE.Mesh(new THREE.BoxGeometry(4, 0.5, 1.2), benchMat);
    bench.position.set(bx, 0.9, bz);
    bench.rotation.y = ry;
    scene.add(bench);
  }

  // --- beach and sea, east edge ------------------------------------------
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 420),
    new THREE.MeshLambertMaterial({ color: 0xe6cf9e })
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(213, 0.04, 0);
  scene.add(sand);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(460, 520),
    new THREE.MeshLambertMaterial({ color: 0x2b7ea6 })
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(463, 0.02, 0);
  scene.add(sea);
  // Foam lines where the water meets the sand.
  const foamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 });
  for (let i = 0; i < 3; i++) {
    const foam = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 400), foamMat);
    foam.rotation.x = -Math.PI / 2;
    foam.position.set(233 + i * 3, 0.05, 0);
    scene.add(foam);
  }

  // --- pier ---------------------------------------------------------------
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(95, 0.8, 9), pierMat);
  pier.position.set(240, 0.9, 0);
  scene.add(pier);
  const postGeo = new THREE.CylinderGeometry(0.35, 0.35, 2.4, 8);
  for (let px = 200; px <= 282; px += 12) {
    for (const pz of [-4, 4]) {
      const post = new THREE.Mesh(postGeo, pierMat);
      post.position.set(px, 0.4, pz);
      scene.add(post);
    }
  }
  // A small hut at the end of the pier.
  const hut = new THREE.Mesh(new THREE.BoxGeometry(8, 5, 7), new THREE.MeshLambertMaterial({ color: 0xf0e0c0 }));
  hut.position.set(280, 3.6, 0);
  scene.add(hut);
  const hutRoof = new THREE.Mesh(new THREE.ConeGeometry(6.4, 3.2, 4), new THREE.MeshLambertMaterial({ color: 0xb8542e }));
  hutRoof.position.set(280, 7.6, 0);
  hutRoof.rotation.y = Math.PI / 4;
  scene.add(hutRoof);

  // --- palms ---------------------------------------------------------------
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f8f3a });
  const trunkGeo = new THREE.CylinderGeometry(0.28, 0.45, 6.5, 7);
  const crownGeo = new THREE.SphereGeometry(2.6, 8, 6);
  function palm(x, z) {
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 3.6, z);
    trunk.rotation.z = (rng() - 0.5) * 0.14;
    scene.add(trunk);
    const crown = new THREE.Mesh(crownGeo, leafMat);
    crown.scale.y = 0.4;
    crown.position.set(x + trunk.rotation.z * -6, 7, z);
    scene.add(crown);
    // Fronds: flattened cones reaching out from the crown.
    for (let i = 0; i < 4; i++) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.7, 4.4, 4), leafMat);
      const a = (i / 4) * Math.PI * 2 + rng();
      frond.position.set(x + Math.cos(a) * 1.8, 6.6, z + Math.sin(a) * 1.8);
      frond.rotation.z = Math.cos(a) * 1.1;
      frond.rotation.x = -Math.sin(a) * 1.1;
      scene.add(frond);
    }
  }
  // Palms line the beach and dot the plaza corners.
  for (let z = -180; z <= 180; z += 30) palm(201 + rng() * 4, z + (rng() - 0.5) * 10);
  for (const [px, pz] of [[-16, -16], [16, -16], [-16, 16], [16, 16], [-60, 40], [80, -70]]) palm(px, pz);

  // --- streetlights at every other intersection ---------------------------
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f45 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const poleGeo = new THREE.CylinderGeometry(0.14, 0.18, 7, 6);
  const lampGeo = new THREE.SphereGeometry(0.45, 8, 6);
  let lightCount = 0;
  for (let i = 0; i < ROADS.length; i++) {
    for (let j = 0; j < ROADS.length; j++) {
      if ((i + j) % 2 !== 0) continue;
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(ROADS[i] + 5.4, 3.5, ROADS[j] + 5.4);
      scene.add(pole);
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(ROADS[i] + 5.4, 7.1, ROADS[j] + 5.4);
      scene.add(lamp);
      lightCount++;
    }
  }
  G.cityStats.streetlights = lightCount;
}
