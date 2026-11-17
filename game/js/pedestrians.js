// Solmar pedestrians — sidewalk walkers who mind their own business until
// something scares them: a gunshot, a speeding car, or the police. Then they
// run. A pedestrian knocked down stays down for a while, then gets up and
// walks away.

const PED_SHIRTS = [0xd94f4f, 0x4f7ad9, 0x4fd97a, 0xd9c24f, 0x9e4fd9, 0xeeeeee, 0x3a3a3a, 0xe07b2a];
const PED_PANTS = [0x2e3a4a, 0x4a3a2e, 0x3a4a3a, 0x222222, 0x5a5a6a];

function makePedMesh(G) {
  const shirt = new THREE.MeshLambertMaterial({ color: PED_SHIRTS[Math.floor(Math.random() * PED_SHIRTS.length)] });
  const pants = new THREE.MeshLambertMaterial({ color: PED_PANTS[Math.floor(Math.random() * PED_PANTS.length)] });
  const skin = new THREE.MeshLambertMaterial({ color: [0xc98d5f, 0x8a5a3a, 0xe8b88a, 0x6b4226][Math.floor(Math.random() * 4)] });
  const group = new THREE.Group();
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.75, 0.3), pants);
  legL.position.set(-0.2, 0.38, 0);
  const legR = legL.clone();
  legR.position.x = 0.2;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.8, 0.45), shirt);
  torso.position.y = 1.15;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.7, 0.24), shirt);
  armL.position.set(-0.56, 1.15, 0);
  const armR = armL.clone();
  armR.position.x = 0.56;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.46), skin);
  head.position.y = 1.8;
  group.add(legL, legR, torso, armL, armR, head);
  return { group, legL, legR, armL, armR };
}

function spawnPedestrians(G, count) {
  for (let i = 0; i < count; i++) {
    const m = makePedMesh(G);
    // Start on a sidewalk: just off a road, inside a block edge.
    const road = G.roads.xs[Math.floor(Math.random() * G.roads.xs.length)];
    const along = -180 + Math.random() * 360;
    const onXRoad = Math.random() < 0.5;
    const pos = onXRoad
      ? new THREE.Vector3(road + 8.5, 0, along)
      : new THREE.Vector3(along, 0, road + 8.5);
    m.group.position.copy(pos);
    G.scene.add(m.group);
    G.peds.push({
      mesh: m.group, parts: m, pos,
      yaw: Math.random() * Math.PI * 2,
      speed: 1.2 + Math.random() * 0.9,
      walkPhase: Math.random() * 6,
      fleeTimer: 0, downTimer: 0, fallen: false,
      target: null,
    });
    pickPedTarget(G, G.peds[G.peds.length - 1]);
  }
}

// A pedestrian's next stroll target: a nearby sidewalk corner.
function pickPedTarget(G, ped) {
  const roads = G.roads.xs;
  const nearest = (v) => roads.reduce((a, b) => Math.abs(b - v) < Math.abs(a - v) ? b : a);
  const cx = nearest(ped.pos.x), cz = nearest(ped.pos.z);
  const ix = roads.indexOf(cx), iz = roads.indexOf(cz);
  const nx = roads[Math.max(0, Math.min(roads.length - 1, ix + (Math.random() < 0.5 ? -1 : 1)))];
  const nz = roads[Math.max(0, Math.min(roads.length - 1, iz + (Math.random() < 0.5 ? -1 : 1)))];
  ped.target = Math.random() < 0.5
    ? { x: nx + 8.5, z: ped.pos.z }
    : { x: ped.pos.x, z: nz + 8.5 };
}

function scarePeds(G, x, z, radius) {
  for (const ped of G.peds) {
    if (ped.fallen) continue;
    const d = Math.hypot(ped.pos.x - x, ped.pos.z - z);
    if (d < radius) ped.fleeTimer = 3 + Math.random() * 2;
  }
}

function knockPedDown(G, ped, byPunch) {
  if (ped.fallen) return;
  ped.fallen = true;
  ped.downTimer = 6;
  ped.mesh.rotation.x = -Math.PI / 2;
  ped.mesh.position.y = 0.4;
  playHit(G);
  scarePeds(G, ped.pos.x, ped.pos.z, 18);
  if (!byPunch) addWanted(G, 1, 'pedestrian hit');
}

function updatePedestrians(G, dt) {
  for (const ped of G.peds) {
    if (ped.fallen) {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) {
        ped.fallen = false;
        ped.mesh.rotation.x = 0;
        ped.mesh.position.y = 0;
        ped.fleeTimer = 2;
      }
      continue;
    }
    // Flee: run away from the player when scared.
    let speed = ped.speed;
    let tx, tz;
    if (ped.fleeTimer > 0) {
      ped.fleeTimer -= dt;
      speed = 5.5;
      const dx = ped.pos.x - G.player.pos.x, dz = ped.pos.z - G.player.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      tx = ped.pos.x + (dx / d) * 20;
      tz = ped.pos.z + (dz / d) * 20;
    } else {
      tx = ped.target.x; tz = ped.target.z;
      if (Math.hypot(tx - ped.pos.x, tz - ped.pos.z) < 2) { pickPedTarget(G, ped); continue; }
    }
    const dx = tx - ped.pos.x, dz = tz - ped.pos.z;
    const wantYaw = Math.atan2(dx, dz);
    let dyaw = wantYaw - ped.yaw;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    ped.yaw += Math.max(-3 * dt, Math.min(3 * dt, dyaw));
    ped.pos.x += Math.sin(ped.yaw) * speed * dt;
    ped.pos.z += Math.cos(ped.yaw) * speed * dt;
    // Stay on the sidewalks and inside the city, not in the sea.
    ped.pos.x = Math.max(-193, Math.min(200, ped.pos.x));
    ped.pos.z = Math.max(-193, Math.min(193, ped.pos.z));
    ped.walkPhase += dt * speed * 3.2;
    ped.mesh.position.set(ped.pos.x, 0, ped.pos.z);
    ped.mesh.rotation.y = ped.yaw;
    const swing = Math.sin(ped.walkPhase) * 0.5;
    ped.parts.legL.rotation.x = swing;
    ped.parts.legR.rotation.x = -swing;
    ped.parts.armL.rotation.x = -swing * 0.7;
    ped.parts.armR.rotation.x = swing * 0.7;
  }
}
