// Solmar combat — the pistol. Click to shoot: a raycast from the camera
// through the crosshair, a muzzle flash, a tracer line, ammo and reload.
// Hitting a pedestrian or an officer is a crime, and it scares everyone
// nearby. The pistol only fires on foot; you cannot shoot while driving.

function initCombat(G) {
  G.combat = { ammo: 12, magSize: 12, reloading: false, reloadTimer: 0, cooldown: 0, flashTimer: 0 };
  // Muzzle flash: a small point light that lives one frame.
  const flash = new THREE.PointLight(0xffc860, 0, 14);
  G.scene.add(flash);
  G.combat.flashLight = flash;
  // Tracer: a thin line from the muzzle to the hit point, shown briefly.
  const tracerGeo = new THREE.BufferGeometry();
  tracerGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const tracer = new THREE.Line(tracerGeo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }));
  tracer.visible = false;
  G.scene.add(tracer);
  G.combat.tracer = tracer;
  G.combat.tracerTimer = 0;
  G.combat.raycaster = new THREE.Raycaster();
}

function shootPistol(G) {
  const c = G.combat;
  if (G.state !== 'playing' || G.player.car) return;
  if (c.reloading || c.cooldown > 0 || c.ammo <= 0) {
    if (c.ammo <= 0 && !c.reloading) startReload(G);
    return;
  }
  c.cooldown = 0.28;
  c.ammo -= 1;
  c.flashTimer = 0.06;
  playGunshot(G);
  addWanted(G, 1, 'shots fired');
  scarePeds(G, G.player.pos.x, G.player.pos.z, 30);
  // Raycast from the camera through the centre of the screen.
  const ray = c.raycaster;
  ray.setFromCamera({ x: 0, y: 0 }, G.camera);
  ray.far = 70;
  const targets = [];
  for (const ped of G.peds) if (!ped.fallen) targets.push(ped.mesh);
  for (const cop of G.cops) if (!cop.down) targets.push(cop.mesh);
  const hits = ray.intersectObjects(targets, true);
  // Muzzle position: the tip of Rio's gun, in world space.
  const muzzle = new THREE.Vector3();
  G.player.parts.gun.getWorldPosition(muzzle);
  let end;
  if (hits.length > 0) {
    end = hits[0].point.clone();
    let hit = hits[0].object;
    while (hit.parent && hit.parent !== G.scene) hit = hit.parent;
    const ped = G.peds.find((p) => p.mesh === hit);
    if (ped) { knockPedDown(G, ped, false); addWanted(G, 1, 'pedestrian shot'); }
    const cop = G.cops.find((o) => o.mesh === hit);
    if (cop) { copDown(G, cop, false); }
  } else {
    end = ray.ray.at(60, new THREE.Vector3());
  }
  // Show the tracer from muzzle to hit point.
  const pos = c.tracer.geometry.attributes.position;
  pos.setXYZ(0, muzzle.x, muzzle.y, muzzle.z);
  pos.setXYZ(1, end.x, end.y, end.z);
  pos.needsUpdate = true;
  c.tracer.visible = true;
  c.tracerTimer = 0.07;
  c.flashLight.position.copy(muzzle);
  c.flashLight.intensity = 2.5;
  updateAmmoHud(G);
}

function startReload(G) {
  const c = G.combat;
  if (c.reloading || c.ammo === c.magSize) return;
  c.reloading = true;
  c.reloadTimer = 1.1;
  showPrompt(G, 'Reloading…');
}

function updateCombat(G, dt) {
  const c = G.combat;
  if (!c) return;
  c.cooldown = Math.max(0, c.cooldown - dt);
  if (c.reloading) {
    c.reloadTimer -= dt;
    if (c.reloadTimer <= 0) {
      c.reloading = false;
      c.ammo = c.magSize;
      updateAmmoHud(G);
      showPrompt(G, '');
    }
  }
  if (c.flashTimer > 0) {
    c.flashTimer -= dt;
    if (c.flashTimer <= 0) c.flashLight.intensity = 0;
  }
  if (c.tracerTimer > 0) {
    c.tracerTimer -= dt;
    if (c.tracerTimer <= 0) c.tracer.visible = false;
  }
}
