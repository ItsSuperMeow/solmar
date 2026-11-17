// Solmar police — the wanted level and the response to it.
// Crimes raise the stars from 0 to 5; stay clean for 30 seconds and the
// heat fades one star at a time. Police cars chase and ram the player,
// foot officers chase on foot and swing at him. More stars, more police.

function addWanted(G, stars, reason) {
  if (G.state !== 'playing') return;
  const before = G.wanted;
  G.wanted = Math.min(5, G.wanted + stars);
  G.lastCrimeAt = G.time;
  if (G.wanted !== before) {
    updateWantedHud(G);
    scarePeds(G, G.player.pos.x, G.player.pos.z, 25);
  }
}

function updateWanted(G, dt) {
  // Decay: 30 seconds clean, then one star fades every 5 seconds.
  if (G.wanted > 0 && G.time - G.lastCrimeAt > 30) {
    G.wantedDecayTimer += dt;
    if (G.wantedDecayTimer >= 5) {
      G.wantedDecayTimer = 0;
      G.wanted = Math.max(0, G.wanted - 1);
      updateWantedHud(G);
    }
  } else {
    G.wantedDecayTimer = 0;
  }
  // How many police should be out there, for this wanted level.
  const wantCars = G.wanted === 0 ? 0 : Math.min(1 + Math.floor(G.wanted / 2), 4);
  const wantCops = Math.min(G.wanted * 2, 8);
  // Spawn pursuit cars near the player until the count is met.
  while (G.policeCars.length < wantCars) spawnPoliceCar(G);
  while (G.cops.length < wantCops) spawnOfficer(G);
  // Despawn the extras when the heat drops.
  while (G.policeCars.length > wantCars) {
    const car = G.policeCars.pop();
    G.scene.remove(car.mesh);
    const i = G.cars.indexOf(car);
    if (i >= 0) G.cars.splice(i, 1);
  }
  while (G.cops.length > wantCops) {
    const cop = G.cops.pop();
    G.scene.remove(cop.mesh);
  }
  // Flash the light bars.
  const phase = Math.floor(G.time * 6) % 2 === 0;
  for (const car of G.policeCars) {
    if (!car.lightBar) continue;
    car.lightBar.userData.red.material.color.setHex(phase ? 0xff2020 : 0x550000);
    car.lightBar.userData.blue.material.color.setHex(phase ? 0x101050 : 0x2050ff);
  }
}

function spawnPoliceCar(G) {
  const car = makeCarMesh(G, 'police');
  // Spawn at a nearby intersection, on a road.
  const roads = G.roads.xs;
  const px = G.player.pos.x, pz = G.player.pos.z;
  const rx = roads[Math.floor(Math.random() * roads.length)];
  const rz = roads[Math.floor(Math.random() * roads.length)];
  const sx = Math.abs(rx - px) > 30 ? rx : (px > 0 ? rx - 104 : rx + 104);
  const sz = Math.abs(rz - pz) > 30 ? rz : (pz > 0 ? rz - 104 : rz + 104);
  car.group.position.set(Math.max(-188, Math.min(188, sx)), 0, Math.max(-188, Math.min(188, sz)));
  G.scene.add(car.group);
  const entry = {
    mesh: car.group, wheels: car.wheels, lightBar: car.lightBar, type: 'police',
    topSpeed: 32, speed: 0, steer: 0, yaw: 0,
    parked: false, traffic: false, police: true,
  };
  entry.yaw = Math.atan2(px - entry.mesh.position.x, pz - entry.mesh.position.z);
  entry.mesh.rotation.y = entry.yaw;
  G.policeCars.push(entry);
  G.cars.push(entry);
}

function makeOfficerMesh(G) {
  const navy = new THREE.MeshLambertMaterial({ color: 0x1c2f55 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98d5f });
  const group = new THREE.Group();
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.75, 0.3), navy);
  legL.position.set(-0.2, 0.38, 0);
  const legR = legL.clone();
  legR.position.x = 0.2;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.85, 0.5), navy);
  torso.position.y = 1.2;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.7, 0.26), navy);
  armL.position.set(-0.6, 1.2, 0);
  const armR = armL.clone();
  armR.position.x = 0.6;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.48, 0.48), skin);
  head.position.y = 1.9;
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.14, 0.54), navy);
  cap.position.y = 2.16;
  group.add(legL, legR, torso, armL, armR, head, cap);
  return { group, legL, legR, armL, armR };
}

function spawnOfficer(G) {
  const m = makeOfficerMesh(G);
  const roads = G.roads.xs;
  const a = Math.random() * Math.PI * 2;
  const r = 30 + Math.random() * 25;
  const pos = new THREE.Vector3(
    Math.max(-188, Math.min(188, G.player.pos.x + Math.cos(a) * r)),
    0,
    Math.max(-188, Math.min(188, G.player.pos.z + Math.sin(a) * r))
  );
  m.group.position.copy(pos);
  G.scene.add(m.group);
  G.cops.push({
    mesh: m.group, parts: m, pos,
    yaw: 0, walkPhase: Math.random() * 6,
    down: false, downTimer: 0, swingTimer: 0, hitCooldown: 0,
  });
}

function copDown(G, cop, byPunch) {
  if (cop.down) return;
  cop.down = true;
  cop.downTimer = 8;
  cop.mesh.rotation.x = -Math.PI / 2;
  cop.mesh.position.y = 0.4;
  playHit(G);
  addWanted(G, 2, 'officer down');
}

function updatePolice(G, dt) {
  // Pursuit cars: steer toward the player and ram.
  for (const car of G.policeCars) {
    const p = car.mesh.position;
    const dx = G.player.pos.x - p.x, dz = G.player.pos.z - p.z;
    const dist = Math.hypot(dx, dz);
    const wantYaw = Math.atan2(dx, dz);
    let dyaw = wantYaw - car.yaw;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    car.yaw += Math.max(-2.2 * dt, Math.min(2.2 * dt, dyaw));
    const targetSpeed = dist > 10 ? 26 : 14;
    car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.2);
    const nx = p.x + Math.sin(car.yaw) * car.speed * dt;
    const nz = p.z + Math.cos(car.yaw) * car.speed * dt;
    const hit = collideCircle(G, nx, nz, 2.3);
    const clamped = clampToWorld(G, hit.x, hit.z, 2.3);
    if ((clamped.x !== nx || clamped.z !== nz) && Math.abs(car.speed) > 8) car.speed *= 0.5;
    p.x = clamped.x; p.z = clamped.z;
    car.mesh.rotation.y = car.yaw;
    const spin = car.speed * dt / 0.38;
    for (const w of car.wheels) w.rotation.x += spin;
    // Ram the player's car, or run him down on foot.
    if (dist < 3.4) {
      if (G.player.car) {
        G.player.car.speed *= 0.6;
        damagePlayer(G, 4);
        playCrash(G);
        car.speed *= 0.4;
      } else {
        damagePlayer(G, 8);
        playCrash(G);
        // Shove Rio out of the way so the car does not pin him.
        G.player.pos.x += Math.sin(car.yaw) * 3;
        G.player.pos.z += Math.cos(car.yaw) * 3;
      }
    }
  }
  // Foot officers: run at Rio and swing.
  for (const cop of G.cops) {
    if (cop.down) {
      cop.downTimer -= dt;
      if (cop.downTimer <= 0) {
        cop.down = false;
        cop.mesh.rotation.x = 0;
        cop.mesh.position.y = 0;
      }
      continue;
    }
    cop.hitCooldown -= dt;
    const dx = G.player.pos.x - cop.pos.x, dz = G.player.pos.z - cop.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 1.8) {
      const wantYaw = Math.atan2(dx, dz);
      let dyaw = wantYaw - cop.yaw;
      while (dyaw > Math.PI) dyaw -= Math.PI * 2;
      while (dyaw < -Math.PI) dyaw += Math.PI * 2;
      cop.yaw += Math.max(-3.5 * dt, Math.min(3.5 * dt, dyaw));
      const speed = G.player.car ? 7.5 : 5.2;
      cop.pos.x += Math.sin(cop.yaw) * speed * dt;
      cop.pos.z += Math.cos(cop.yaw) * speed * dt;
      cop.walkPhase += dt * speed * 3;
    } else if (cop.hitCooldown <= 0 && !G.player.car) {
      cop.hitCooldown = 1.1;
      cop.swingTimer = 0.3;
      damagePlayer(G, 6);
      playPunch(G);
    }
    cop.mesh.position.set(cop.pos.x, 0, cop.pos.z);
    cop.mesh.rotation.y = cop.yaw;
    const swing = Math.sin(cop.walkPhase) * 0.5;
    cop.parts.legL.rotation.x = swing;
    cop.parts.legR.rotation.x = -swing;
    if (cop.swingTimer > 0) {
      cop.swingTimer -= dt;
      cop.parts.armR.rotation.x = -1.6 * Math.max(0, cop.swingTimer / 0.3);
    } else {
      cop.parts.armR.rotation.x = -swing * 0.7;
    }
  }
}

// Damage Rio: health drops, the screen flashes, and at 0 he wakes up at the
// hospital plaza, lighter in the wallet, with the heat gone.
function damagePlayer(G, amount) {
  if (G.state !== 'playing' || G.player.invulnTimer > 0) return;
  G.player.health -= amount;
  G.player.invulnTimer = 0.4;
  flashDamage(G);
  if (G.player.health <= 0) {
    G.player.health = 100;
    G.player.money = Math.max(0, G.player.money - 200);
    G.wanted = 0;
    updateWantedHud(G);
    if (G.player.car) exitCar(G);
    G.player.pos.set(10, 0, 10);
    G.player.mesh.position.copy(G.player.pos);
    G.player.invulnTimer = 2;
    showBanner(G, 'BUSTED — YOU WOKE UP AT THE PLAZA', '-$200 hospital bill');
    updateMoneyHud(G);
  }
  updateHealthHud(G);
}
