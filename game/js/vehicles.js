// Solmar vehicles — box-built cars, lane traffic, stealing and driving.
// Cars are built from boxes: body, cabin, wheels, lights. Traffic cars
// drive the road graph from intersection to intersection, keeping right and
// slowing for the car ahead. Steal any car with E and drive it with WASD.

const CAR_COLORS = {
  sedan: [0xc23b2e, 0x2e6fc2, 0xe8e8e8, 0x3a9e5f, 0xe07b2a, 0x7a4a9e, 0x222831],
  taxi: [0xffd23c],
  police: [0xf0f0f0],
  sports: [0xd41e2a, 0x111111, 0xff8c00],
  truck: [0x5a7a9e, 0x9e5a3a],
};

function makeCarMesh(G, type) {
  const group = new THREE.Group();
  const color = CAR_COLORS[type][Math.floor(Math.random() * CAR_COLORS[type].length)];
  const paint = new THREE.MeshLambertMaterial({ color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x18242e });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const isTruck = type === 'truck';
  const bodyLen = isTruck ? 5.6 : 4.4;
  const bodyH = type === 'sports' ? 0.55 : 0.75;
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, bodyH, bodyLen), paint);
  body.position.y = 0.55;
  group.add(body);
  if (isTruck) {
    const cargo = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.7, 3.2), new THREE.MeshLambertMaterial({ color: 0xcfd6dd }));
    cargo.position.set(0, 1.5, -1);
    group.add(cargo);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2, 1.1, 1.4), paint);
    cab.position.set(0, 1.35, 1.9);
    group.add(cab);
  } else {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 2.2), glass);
    cabin.position.set(0, 1.15, type === 'sports' ? -0.2 : -0.1);
    group.add(cabin);
  }
  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheels = [];
  for (const [wx, wz] of [[-1, 1.45], [1, 1.45], [-1, -1.45], [1, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.38, wz);
    group.add(wheel);
    wheels.push(wheel);
  }
  // Headlights and taillights.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const hx of [-0.65, 0.65]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.08), headMat);
    head.position.set(hx, 0.55, bodyLen / 2 + 0.01);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.08), tailMat);
    tail.position.set(hx, 0.55, -bodyLen / 2 - 0.01);
    group.add(tail);
  }
  let lightBar = null;
  if (type === 'police') {
    lightBar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.22, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    red.position.x = -0.35;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.22, 0.4), new THREE.MeshBasicMaterial({ color: 0x2050ff }));
    blue.position.x = 0.35;
    lightBar.add(red, blue);
    lightBar.position.set(0, 1.55, -0.1);
    lightBar.userData = { red, blue };
    group.add(lightBar);
    // Black doors: two dark panels on the sides.
    for (const sx of [-1.01, 1.01]) {
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 1.6), dark);
      door.position.set(sx, 0.6, 0);
      group.add(door);
    }
  }
  if (type === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.28, 0.5), new THREE.MeshBasicMaterial({ color: 0xffe14d }));
    sign.position.set(0, 1.6, -0.1);
    group.add(sign);
  }
  group.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return { group, wheels, lightBar, type, topSpeed: type === 'sports' ? 36 : type === 'truck' ? 22 : 28 };
}

function spawnParkedCars(G) {
  const types = ['sedan', 'sedan', 'sedan', 'taxi', 'sports', 'truck', 'sedan', 'taxi'];
  const roads = G.roads.xs;
  for (let i = 0; i < types.length; i++) {
    const car = makeCarMesh(G, types[i]);
    const alongZ = i % 2 === 0;
    const road = roads[2 + (i % 5)];
    const along = -150 + i * 38;
    if (alongZ) {
      car.group.position.set(road + 4.6, 0, along);
      car.group.rotation.y = 0;
    } else {
      car.group.position.set(along, 0, road + 4.6);
      car.group.rotation.y = Math.PI / 2;
    }
    G.scene.add(car.group);
    G.cars.push({ mesh: car.group, wheels: car.wheels, type: types[i], topSpeed: car.topSpeed, speed: 0, steer: 0, yaw: car.group.rotation.y, parked: true, traffic: false, police: false });
  }
  // One sedan parked right by the plaza, so the first steal is easy.
  const near = makeCarMesh(G, 'sedan');
  near.group.position.set(14, 0, 26);
  near.group.rotation.y = Math.PI / 2;
  G.scene.add(near.group);
  G.cars.push({ mesh: near.group, wheels: near.wheels, type: 'sedan', topSpeed: near.topSpeed, speed: 0, steer: 0, yaw: Math.PI / 2, parked: true, traffic: false, police: false });
}

function spawnTraffic(G, count) {
  const types = ['sedan', 'sedan', 'sedan', 'taxi', 'sedan', 'truck', 'sports', 'sedan', 'taxi', 'sedan'];
  for (let i = 0; i < count; i++) {
    const type = types[i % types.length];
    const car = makeCarMesh(G, type);
    const alongZ = Math.random() < 0.5;
    const road = G.roads.xs[Math.floor(Math.random() * G.roads.xs.length)];
    const along = -170 + Math.random() * 340;
    const dir = Math.random() < 0.5 ? 1 : -1;
    const entry = {
      mesh: car.group, wheels: car.wheels, type, topSpeed: car.topSpeed,
      speed: 8 + Math.random() * 4, steer: 0, yaw: 0,
      parked: false, traffic: true, police: false,
      axis: alongZ ? 'z' : 'x', dir, cruise: 8 + Math.random() * 5,
      target: null,
    };
    if (alongZ) {
      entry.mesh.position.set(road + (dir > 0 ? -2.8 : 2.8), 0, along);
    } else {
      entry.mesh.position.set(along, 0, road + (dir > 0 ? 2.8 : -2.8));
    }
    pickNextIntersection(G, entry);
    entry.yaw = Math.atan2(entry.target.x - entry.mesh.position.x, entry.target.z - entry.mesh.position.z);
    entry.mesh.rotation.y = entry.yaw;
    G.scene.add(entry.mesh);
    G.cars.push(entry);
  }
}

// Choose the next intersection for a traffic car: one step on the grid.
function pickNextIntersection(G, car) {
  const roads = G.roads.xs;
  const p = car.mesh.position;
  const nearest = (v) => roads.reduce((a, b) => Math.abs(b - v) < Math.abs(a - v) ? b : a);
  const cx = nearest(p.x), cz = nearest(p.z);
  const ix = roads.indexOf(cx), iz = roads.indexOf(cz);
  const options = [];
  if (ix > 0) options.push({ x: roads[ix - 1], z: cz });
  if (ix < roads.length - 1) options.push({ x: roads[ix + 1], z: cz });
  if (iz > 0) options.push({ x: cx, z: roads[iz - 1] });
  if (iz < roads.length - 1) options.push({ x: cx, z: roads[iz + 1] });
  const next = options[Math.floor(Math.random() * options.length)];
  // Keep right: offset the target half a lane to the right of travel.
  const dx = next.x - p.x, dz = next.z - p.z;
  const len = Math.hypot(dx, dz) || 1;
  const rx = -dz / len, rz = dx / len; // right-hand side of the direction of travel
  car.target = { x: next.x + rx * 2.8, z: next.z + rz * 2.8 };
}

function updateTraffic(G, dt) {
  for (const car of G.cars) {
    if (!car.traffic || car === G.player.car) continue;
    const p = car.mesh.position;
    const dx = car.target.x - p.x, dz = car.target.z - p.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 4) { pickNextIntersection(G, car); continue; }
    const wantYaw = Math.atan2(dx, dz);
    let dyaw = wantYaw - car.yaw;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    car.yaw += Math.max(-1.6 * dt, Math.min(1.6 * dt, dyaw));
    // Slow for the car ahead on the same stretch.
    let targetSpeed = car.cruise;
    if (dist < 18) targetSpeed = Math.min(targetSpeed, 5);
    for (const other of G.cars) {
      if (other === car) continue;
      const ox = other.mesh.position.x - p.x, oz = other.mesh.position.z - p.z;
      const od = Math.hypot(ox, oz);
      if (od < 9 && od > 0.1) {
        const ahead = (ox * Math.sin(car.yaw) + oz * Math.cos(car.yaw)) / od;
        if (ahead > 0.6) { targetSpeed = Math.min(targetSpeed, 2.5); break; }
      }
    }
    car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.5);
    p.x += Math.sin(car.yaw) * car.speed * dt;
    p.z += Math.cos(car.yaw) * car.speed * dt;
    car.mesh.rotation.y = car.yaw;
    const spin = car.speed * dt / 0.38;
    for (const w of car.wheels) w.rotation.x += spin;
  }
}

// The nearest car Rio can steal, if any.
function nearestCar(G, maxDist) {
  let best = null, bestD = maxDist;
  for (const car of G.cars) {
    if (car === G.player.car) continue;
    const d = Math.hypot(car.mesh.position.x - G.player.pos.x, car.mesh.position.z - G.player.pos.z);
    if (d < bestD) { best = car; bestD = d; }
  }
  return best;
}

function enterCar(G, car) {
  if (car.traffic) {
    car.traffic = false; // its driver flees; the car is yours now
    car.parked = false;
  }
  car.parked = false;
  car.speed = 0;
  G.player.car = car;
  G.player.mesh.visible = false;
  G.player.pos.y = 0;
  addWanted(G, 1, 'car stolen');
  showPrompt(G, '');
  playChime(G);
}

function exitCar(G) {
  const car = G.player.car;
  if (!car) return;
  car.speed = 0;
  const side = { x: car.mesh.position.x + Math.cos(car.yaw) * 2.4, z: car.mesh.position.z - Math.sin(car.yaw) * 2.4 };
  G.player.pos.set(side.x, 0, side.z);
  G.player.mesh.visible = true;
  G.player.mesh.position.copy(G.player.pos);
  G.player.car = null;
}

function updateDriving(G, dt) {
  const car = G.player.car;
  if (!car) return;
  const keys = G.keys;
  const accel = keys['KeyW'] ? 14 : 0;
  const braking = keys['KeyS'] ? 1 : 0;
  const handbrake = keys['Space'] ? 1 : 0;
  if (accel) car.speed += accel * dt;
  else car.speed -= car.speed * 0.6 * dt;
  if (braking) car.speed -= 20 * dt;
  if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 26 * dt);
  if (car.speed > car.topSpeed) car.speed = car.topSpeed;
  if (car.speed < -9) car.speed = -9;
  if (Math.abs(car.speed) < 0.2 && !accel) car.speed = 0;
  // Steering: sharper at low speed, and reversed when reversing.
  const steerTarget = (keys['KeyA'] ? 1 : 0) - (keys['KeyD'] ? 1 : 0);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  const steerMax = 0.55 / (1 + Math.abs(car.speed) * 0.045);
  car.yaw += car.steer * steerMax * car.speed * dt * 0.11;
  const p = car.mesh.position;
  const nx = p.x + Math.sin(car.yaw) * car.speed * dt;
  const nz = p.z + Math.cos(car.yaw) * car.speed * dt;
  const hit = collideCircle(G, nx, nz, 2.3);
  const clamped = clampToWorld(G, hit.x, hit.z, 2.3);
  if ((clamped.x !== nx || clamped.z !== nz) && Math.abs(car.speed) > 6) {
    playCrash(G);
    car.speed *= 0.45;
  }
  p.x = clamped.x; p.z = clamped.z;
  car.mesh.rotation.y = car.yaw;
  // Body roll and wheel spin sell the drive.
  car.mesh.rotation.z = -car.steer * Math.min(0.06, Math.abs(car.speed) * 0.002);
  const spin = car.speed * dt / 0.38;
  for (const w of car.wheels) w.rotation.x += spin;
  // Running over a pedestrian is a crime, and it hurts.
  for (const ped of G.peds) {
    if (ped.fallen) continue;
    const d = Math.hypot(ped.pos.x - p.x, ped.pos.z - p.z);
    if (d < 2.4 && Math.abs(car.speed) > 4) {
      knockPedDown(G, ped, false);
      car.speed *= 0.7;
    }
  }
  G.player.pos.set(p.x, 0, p.z);
  updateEngineSound(G, Math.abs(car.speed) / car.topSpeed);
}
