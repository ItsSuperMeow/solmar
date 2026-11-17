/* Solmar missions: five jobs for the crew, unlocked in order, with a story. */
(function () {
  var SOL = window.SOL;
  var THREE = window.THREE;

  var beacon = null;
  var beaconLight = null;
  var markerMesh = null;

  var MISSIONS = [
    {
      id: 0, name: 'Hot Wheels', reward: 300,
      intro: 'Mara: "First job, Rio. The crew needs wheels. Steal any car and bring it to the plaza — fast, before the heat finds you."',
      objective: 'Steal a car and drive it to the plaza marker',
      steps: [
        { type: 'stealCar', text: 'Steal a car (press E near one)' },
        { type: 'reach', x: 0, z: -40, radius: 10, text: 'Drive to the plaza marker' }
      ]
    },
    {
      id: 1, name: 'The Package', reward: 500,
      intro: 'Mara: "A package is waiting at the end of the pier. Pick it up on foot, then bring it to the crew house on Coral Row."',
      objective: 'Pick up the package at the pier, deliver it to the crew house',
      steps: [
        { type: 'reach', x: 300, z: 0, radius: 8, text: 'Pick up the package at the pier' },
        { type: 'reach', x: -182, z: 130, radius: 10, text: 'Deliver it to the crew house' }
      ]
    },
    {
      id: 2, name: 'Heat', reward: 700,
      intro: 'Mara: "The cops are onto us. Get their attention — three stars — then lose them. If you get busted, the job is blown."',
      objective: 'Reach 3 wanted stars, then lose the heat',
      steps: [
        { type: 'wanted', stars: 3, text: 'Raise your wanted level to 3 stars' },
        { type: 'loseHeat', text: 'Lose the heat — stay clean for 30 seconds' }
      ]
    },
    {
      id: 3, name: 'Midnight Run', reward: 900,
      intro: 'Mara: "A buyer is waiting across town and the clock is ticking. Three drops, ninety seconds. Do not stop for anything."',
      objective: 'Make 3 deliveries in 90 seconds',
      steps: [
        { type: 'timed', time: 90, points: [[130, -130], [-130, -130], [130, 130]], radius: 10,
          text: 'Deliver to the checkpoints before time runs out' }
      ]
    },
    {
      id: 4, name: 'The Big One', reward: 1500,
      intro: 'Mara: "Last job. The red sports car in the plaza square belongs to the mayor\'s nephew. Take it, outrun the whole city, and bring it to the safehouse. Then we are done — and rich."',
      objective: 'Steal the red sports car and escape to the safehouse',
      steps: [
        { type: 'reach', x: 0, z: -40, radius: 8, text: 'Find the red sports car at the plaza' },
        { type: 'reach', x: -208, z: -208, radius: 12, text: 'Escape the police and reach the safehouse' }
      ]
    }
  ];

  function makeBeacon(game) {
    if (beacon) return;
    beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(4, 4, 40, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
    beacon.position.y = 20;
    game.scene.add(beacon);
    beaconLight = new THREE.PointLight(0xffd23c, 1.2, 40);
    beaconLight.position.y = 6;
    game.scene.add(beaconLight);
    markerMesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.6),
      new THREE.MeshBasicMaterial({ color: 0xffd23c }));
    markerMesh.position.y = 5;
    game.scene.add(markerMesh);
  }

  function placeBeacon(game, x, z) {
    makeBeacon(game);
    beacon.position.x = x; beacon.position.z = z;
    beaconLight.position.x = x; beaconLight.position.z = z;
    markerMesh.position.x = x; markerMesh.position.z = z;
    beacon.visible = true; beaconLight.visible = true; markerMesh.visible = true;
  }

  function hideBeacon() {
    if (!beacon) return;
    beacon.visible = false; beaconLight.visible = false; markerMesh.visible = false;
  }

  SOL.Missions = {
    defs: MISSIONS,
    init: function (game) {
      game.missionIndex = 0;
      game.missionStep = 0;
      game.missionActive = false;
      game.missionTimer = 0;
      game.missionTarget = null;
      game.missionsDone = game.missionsDone || [];
      makeBeacon(game);
      hideBeacon();
    },
    // The next job the player has not finished.
    current: function (game) {
      if (game.missionIndex >= MISSIONS.length) return null;
      return MISSIONS[game.missionIndex];
    },
    start: function (game) {
      var m = this.current(game);
      if (!m) return;
      game.missionActive = true;
      game.missionStep = 0;
      game.missionTimer = 0;
      SOL.HUD.toast(game, m.name + ' — $' + m.reward);
      SOL.HUD.setObjective(game, m.name, m.intro);
      SOL.Audio.pickup();
      this.applyStep(game);
    },
    applyStep: function (game) {
      var m = this.current(game);
      if (!m) return;
      var step = m.steps[game.missionStep];
      if (!step) return;
      game.missionTarget = step;
      if (step.type === 'reach') {
        placeBeacon(game, step.x, step.z);
        SOL.HUD.setObjective(game, m.name, step.text);
      } else if (step.type === 'timed') {
        var pt = step.points[step.pointIndex || 0];
        placeBeacon(game, pt[0], pt[1]);
        game.missionTimer = step.time;
        SOL.HUD.setObjective(game, m.name, step.text + ' — ' + Math.ceil(game.missionTimer) + 's left');
      } else {
        hideBeacon();
        SOL.HUD.setObjective(game, m.name, step.text);
      }
    },
    nextStep: function (game) {
      var m = this.current(game);
      game.missionStep += 1;
      if (game.missionStep >= m.steps.length) {
        this.complete(game);
      } else {
        SOL.Audio.pickup();
        this.applyStep(game);
      }
    },
    complete: function (game) {
      var m = this.current(game);
      game.money += m.reward;
      game.missionsDone.push(m.id);
      game.missionActive = false;
      game.missionIndex += 1;
      hideBeacon();
      SOL.Audio.missionDone();
      SOL.HUD.toast(game, m.name + ' complete! +$' + m.reward);
      SOL.HUD.setObjective(game, '', '');
      SOL.Save.store(game);
      if (game.missionIndex >= MISSIONS.length) {
        SOL.HUD.toast(game, 'All five jobs done. Solmar is yours, Rio.');
      } else {
        setTimeout(function () {
          if (game.state === 'playing') SOL.Missions.start(game);
        }, 2500);
      }
    },
    fail: function (game, reason) {
      game.missionActive = false;
      game.missionStep = 0;
      hideBeacon();
      SOL.HUD.toast(game, reason + ' — job failed. Talk to Mara to retry.');
      SOL.HUD.setObjective(game, '', '');
      setTimeout(function () {
        if (game.state === 'playing') SOL.Missions.start(game);
      }, 3000);
    },
    update: function (game, dt) {
      if (!game.missionActive) return;
      var m = this.current(game);
      if (!m) return;
      var step = m.steps[game.missionStep];
      if (!step) return;
      var p = game.player.pos;
      if (step.type === 'stealCar') {
        if (game.driving) this.nextStep(game);
      } else if (step.type === 'reach') {
        if (Math.hypot(p.x - step.x, p.z - step.z) < step.radius) {
          SOL.Audio.pickup();
          this.nextStep(game);
        }
      } else if (step.type === 'wanted') {
        if (game.wanted >= step.stars) this.nextStep(game);
      } else if (step.type === 'loseHeat') {
        if (game.wanted === 0) this.nextStep(game);
      } else if (step.type === 'timed') {
        game.missionTimer -= dt;
        var pt = step.points[step.pointIndex || 0];
        if (Math.hypot(p.x - pt[0], p.z - pt[1]) < step.radius) {
          step.pointIndex = (step.pointIndex || 0) + 1;
          SOL.Audio.pickup();
          if (step.pointIndex >= step.points.length) {
            this.nextStep(game);
            return;
          }
          var npt = step.points[step.pointIndex];
          placeBeacon(game, npt[0], npt[1]);
        }
        SOL.HUD.setObjective(game, m.name, step.text + ' — ' + Math.max(0, Math.ceil(game.missionTimer)) + 's left');
        if (game.missionTimer <= 0) this.fail(game, 'Out of time');
      }
      // Beacon pulse
      if (beacon && beacon.visible) {
        var t = game.time * 2;
        markerMesh.position.y = 5 + Math.sin(t) * 0.8;
        markerMesh.rotation.y += dt * 2;
        beacon.material.opacity = 0.22 + Math.sin(t) * 0.08;
      }
    }
  };
})();
