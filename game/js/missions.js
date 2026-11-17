// Solmar missions — five story jobs for Rio, in order, from Mara the crew
// boss. Each mission has a briefing, a 3D beacon and a minimap marker, and
// pays cash on completion. Progress saves to localStorage.

function initMissions(G) {
  // The beacon: a column of light and a floating diamond over the target.
  // Wide and bright on purpose — it has to read from across the city,
  // against a bright sunset sky.
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffc800, transparent: true, opacity: 0.5, depthWrite: false });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 60, 16, 1, true), beaconMat);
  beacon.visible = false;
  G.scene.add(beacon);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.8),
    new THREE.MeshBasicMaterial({ color: 0xffc800 })
  );
  diamond.visible = false;
  G.scene.add(diamond);
  G.missions = {
    index: 0, done: 0, stage: 0, timer: 0,
    beacon, diamond, target: null, active: false,
    defs: [
      {
        id: 'hot-wheels', title: '1. HOT WHEELS', reward: 500,
        briefing: 'Mara: "First job, Rio. Steal a car and bring it to the pier. Any car — just make it fast."',
        hint: 'Press E near a car to steal it, then drive to the yellow beacon at the pier.',
        start(G) {
          G.missions.target = { x: 240, z: 0, radius: 8 };
          setObjective(G, 'Steal a car and drive it to the pier');
        },
        check(G) {
          const t = G.missions.target;
          return G.player.car && Math.hypot(G.player.pos.x - t.x, G.player.pos.z - t.z) < t.radius;
        },
      },
      {
        id: 'the-package', title: '2. THE PACKAGE', reward: 800,
        briefing: 'Mara: "A package is waiting at the plaza fountain. Pick it up, then drop it at the beach bar by the pier."',
        hint: 'Walk to the fountain and press E, then carry the package to the beach bar.',
        start(G) {
          G.missions.stage = 0;
          G.missions.target = { x: 0, z: 0, radius: 6 };
          setObjective(G, 'Pick up the package at the plaza fountain (press E)');
        },
        check(G) { return false; }, // driven by the E key and stages below
      },
      {
        id: 'lose-the-heat', title: '3. LOSE THE HEAT', reward: 1000,
        briefing: 'Mara: "The crew needs a driver who can vanish. Get the cops on you — three stars — then lose them. No arrests, no hospital."',
        hint: 'Raise your wanted level to 3 stars, then stay clean until it fades to zero.',
        start(G) {
          G.missions.stage = 0;
          G.missions.target = null;
          setObjective(G, 'Get to 3 stars, then lose the heat');
        },
        check(G) { return false; },
      },
      {
        id: 'sunset-delivery', title: '4. SUNSET DELIVERY', reward: 1200,
        briefing: 'Mara: "A client at the north gate paid double for speed. Ninety seconds, Rio. The sun is going down."',
        hint: 'Drive to the north gate before the timer runs out.',
        start(G) {
          G.missions.timer = 90;
          G.missions.target = { x: 0, z: -188, radius: 9 };
          setObjective(G, 'Deliver to the north gate — 90 seconds!');
          showTimer(G, true);
        },
        check(G) {
          const t = G.missions.target;
          return Math.hypot(G.player.pos.x - t.x, G.player.pos.z - t.z) < t.radius;
        },
      },
      {
        id: 'the-final-heist', title: '5. THE FINAL HEIST', reward: 2500,
        briefing: 'Mara: "This is the big one. Hit the Solmar bank, grab the cash, and bring it to the safe house on the south side. The whole city will be on you."',
        hint: 'Go to the bank, press E to grab the cash, then escape to the safe house.',
        start(G) {
          G.missions.stage = 0;
          G.missions.target = { x: -52, z: -52, radius: 7 };
          setObjective(G, 'Go to the bank and grab the cash (press E)');
        },
        check(G) { return false; },
      },
    ],
  };
}

// The glowing marker over the current mission target.
function updateBeacon(G, dt) {
  const m = G.missions;
  if (!m.active || !m.target) { m.beacon.visible = false; m.diamond.visible = false; return; }
  m.beacon.visible = true;
  m.diamond.visible = true;
  m.beacon.position.set(m.target.x, 30, m.target.z);
  m.diamond.position.set(m.target.x, 10 + Math.sin(G.time * 2) * 0.8, m.target.z);
  m.diamond.rotation.y += dt * 1.5;
}

function startMission(G, index) {
  const m = G.missions;
  const def = m.defs[index];
  if (!def) { m.active = false; setObjective(G, 'All jobs done — Solmar is yours, Rio.'); return; }
  m.index = index;
  m.stage = 0;
  m.active = true;
  setMissionName(G, def.title);
  showBanner(G, def.title, def.briefing);
  def.start(G);
  updateBeacon(G, 0);
}

function completeMission(G) {
  const m = G.missions;
  const def = m.defs[m.index];
  if (!def) return;
  m.active = false;
  m.done += 1;
  G.player.money += def.reward;
  showTimer(G, false);
  updateMoneyHud(G);
  playMissionComplete(G);
  showBanner(G, 'JOB DONE — ' + def.title, '+$' + def.reward + ' — Mara is pleased.');
  saveGame(G);
  setTimeout(() => { if (G.state === 'playing') startMission(G, m.index + 1); }, 3500);
}

function failMission(G, reason) {
  const m = G.missions;
  if (!m.active) return;
  m.active = false;
  showTimer(G, false);
  showBanner(G, 'JOB FAILED', reason + ' — Mara gives you another shot.');
  setTimeout(() => { if (G.state === 'playing') startMission(G, m.index); }, 3500);
}

// Mission 2 and 5 use the E key at a marker; mission 3 watches the stars.
function onMissionInteract(G) {
  const m = G.missions;
  if (!m.active) return false;
  const def = m.defs[m.index];
  const t = m.target;
  if (!t) return false;
  const d = Math.hypot(G.player.pos.x - t.x, G.player.pos.z - t.z);
  if (d > t.radius) return false;
  if (def.id === 'the-package' && m.stage === 0) {
    m.stage = 1;
    m.target = { x: 205, z: 26, radius: 7 };
    setObjective(G, 'Deliver the package to the beach bar by the pier');
    playChime(G);
    return true;
  }
  if (def.id === 'the-package' && m.stage === 1) {
    completeMission(G);
    return true;
  }
  if (def.id === 'the-final-heist' && m.stage === 0) {
    m.stage = 1;
    m.target = { x: 130, z: 182, radius: 9 };
    setObjective(G, 'Escape to the safe house on the south side — the heat is on!');
    addWanted(G, 4, 'bank heist');
    playChime(G);
    return true;
  }
  return false;
}

function updateMissions(G, dt) {
  const m = G.missions;
  updateBeacon(G, dt);
  if (!m.active) return;
  const def = m.defs[m.index];
  if (!def) return;
  // Mission 3: reach 3 stars, then lose them all.
  if (def.id === 'lose-the-heat') {
    if (m.stage === 0) {
      setObjective(G, 'Get to 3 stars — steal a car, or worse (' + G.wanted + '/3)');
      if (G.wanted >= 3) {
        m.stage = 1;
        setObjective(G, 'Now lose the heat — stay clean until the stars fade');
      }
    } else if (G.wanted === 0) {
      completeMission(G);
    }
    return;
  }
  // Mission 4: the clock runs out.
  if (def.id === 'sunset-delivery') {
    m.timer -= dt;
    showTimerValue(G, Math.max(0, Math.ceil(m.timer)));
    if (m.timer <= 0) { failMission(G, 'Out of time'); return; }
  }
  if (def.check(G)) completeMission(G);
}
