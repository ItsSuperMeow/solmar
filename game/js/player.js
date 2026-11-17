// Solmar player — Rio on foot. WASD moves relative to the camera, Shift
// runs, Space jumps, F punches. A simple box-built character whose limbs
// swing while he walks. Collides with buildings as a circle against their
// axis-aligned boxes, and stays inside the city and the beach.

function createPlayer(G) {
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98d5f });
  const shirt = new THREE.MeshLambertMaterial({ color: 0x1f8a70 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2e3a4a });
  const cap = new THREE.MeshLambertMaterial({ color: 0xffd23c });
  const group = new THREE.Group();
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.8, 0.34), pants);
  legL.position.set(-0.22, 0.4, 0);
  const legR = legL.clone();
  legR.position.x = 0.22;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.85, 0.5), shirt);
  torso.position.y = 1.25;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.75, 0.28), shirt);
  armL.position.set(-0.62, 1.25, 0);
  const armR = armL.clone();
  armR.position.x = 0.62;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skin);
  head.position.y = 1.95;
  const hat = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.16, 0.56), cap);
  hat.position.y = 2.24;
  // A small pistol in his right hand, visible whenever he is armed.
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.42), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  gun.position.set(0.62, 0.85, 0.25);
  group.add(legL, legR, torso, armL, armR, head, hat, gun);
  group.position.copy(G.player.pos);
  G.scene.add(group);
  G.player.mesh = group;
  G.player.parts = { legL, legR, armL, armR, gun };
  G.player.yaw = Math.PI;
  G.player.vy = 0;
  G.player.onGround = true;
  G.player.punchTimer = 0;
  G.player.walkPhase = 0;
}

// Push a circle (x, z, radius) out of every building box it overlaps.
function collideCircle(G, x, z, radius) {
  for (const b of G.colliders) {
    const cx = Math.max(b.minX, Math.min(x, b.maxX));
    const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
    const dx = x - cx, dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * radius;
        z = cz + (dz / d) * radius;
      } else {
        // Dead centre: push out along the smallest penetration axis.
        const pushL = x - b.minX, pushR = b.maxX - x, pushB = z - b.minZ, pushT = b.maxZ - z;
        const m = Math.min(pushL, pushR, pushB, pushT);
        if (m === pushL) x = b.minX - radius;
        else if (m === pushR) x = b.maxX + radius;
        else if (m === pushB) z = b.minZ - radius;
        else z = b.maxZ + radius;
      }
    }
  }
  return { x, z };
}

function clampToWorld(G, x, z, radius) {
  // City streets run x -194..194; the beach runs to the sea at x 232.
  x = Math.max(-194 + radius, Math.min(230 - radius, x));
  z = Math.max(-194 + radius, Math.min(194 - radius, z));
  return { x, z };
}

function updatePlayer(G, dt) {
  const p = G.player;
  if (p.car) return; // driving is handled by vehicles.js
  const keys = G.keys;
  const run = keys['ShiftLeft'] || keys['ShiftRight'];
  const speed = run ? 10 : 6;
  // Input axes: iz is forward (W +1, S -1), ix is right (D +1, A -1).
  const iz = (keys['KeyW'] ? 1 : 0) - (keys['KeyS'] ? 1 : 0);
  const ix = (keys['KeyD'] ? 1 : 0) - (keys['KeyA'] ? 1 : 0);
  const moving = ix !== 0 || iz !== 0;
  if (moving) {
    // Forward is (sin yaw, cos yaw), right is (-cos yaw, sin yaw).
    const cy = G.cameraYaw;
    const sin = Math.sin(cy), cos = Math.cos(cy);
    let mx = sin * iz - cos * ix;
    let mz = cos * iz + sin * ix;
    const len = Math.hypot(mx, mz);
    mx /= len; mz /= len;
    p.pos.x += mx * speed * dt;
    p.pos.z += mz * speed * dt;
    // Face where he walks.
    p.yaw = Math.atan2(mx, mz);
    p.walkPhase += dt * (run ? 13 : 9);
  }
  // Jump and gravity.
  if (keys['Space'] && p.onGround) {
    p.vy = 7.5;
    p.onGround = false;
  }
  if (!p.onGround) {
    p.vy -= 22 * dt;
    p.pos.y += p.vy * dt;
    if (p.pos.y <= 0) { p.pos.y = 0; p.vy = 0; p.onGround = true; }
  }
  // Building and world collision.
  let r = collideCircle(G, p.pos.x, p.pos.z, 0.7);
  r = clampToWorld(G, r.x, r.z, 0.7);
  p.pos.x = r.x; p.pos.z = r.z;
  // Pose the character.
  const m = p.mesh;
  m.position.set(p.pos.x, p.pos.y, p.pos.z);
  m.rotation.y = p.yaw;
  const swing = moving && p.onGround ? Math.sin(p.walkPhase) * 0.55 : 0;
  p.parts.legL.rotation.x = swing;
  p.parts.legR.rotation.x = -swing;
  p.parts.armL.rotation.x = -swing * 0.8;
  p.parts.armR.rotation.x = swing * 0.8;
  if (p.punchTimer > 0) {
    p.punchTimer -= dt;
    p.parts.armR.rotation.x = -1.6 * Math.max(0, p.punchTimer / 0.25);
  }
}

// A punch: a short swing that hurts the nearest pedestrian or officer.
function playerPunch(G) {
  const p = G.player;
  if (p.car || p.punchTimer > 0) return;
  p.punchTimer = 0.25;
  playPunch(G);
  const reach = 2.2;
  const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
  let best = null, bestD = reach;
  for (const ped of G.peds) {
    if (ped.fallen) continue;
    const dx = ped.pos.x - p.pos.x, dz = ped.pos.z - p.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < bestD && dx * fx + dz * fz > 0) { best = ped; bestD = d; }
  }
  if (best) {
    knockPedDown(G, best, true);
    return;
  }
  for (const cop of G.cops) {
    if (cop.down) continue;
    const dx = cop.pos.x - p.pos.x, dz = cop.pos.z - p.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < bestD && dx * fx + dz * fz > 0) { best = cop; bestD = d; }
  }
  if (best) {
    copDown(G, best, true);
  }
}
