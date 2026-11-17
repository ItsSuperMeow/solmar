/* Solmar HUD: health, money, wanted stars, minimap, objectives, toasts. */
(function () {
  var SOL = window.SOL;

  var toastTimer = null;
  var minimapCtx = null;

  SOL.HUD = {
    init: function (game) {
      var mm = document.getElementById('minimap');
      minimapCtx = mm.getContext('2d');
    },
    show: function () {
      document.getElementById('hud').classList.remove('hidden');
    },
    hide: function () {
      document.getElementById('hud').classList.add('hidden');
    },
    toast: function (game, text) {
      var el = document.getElementById('toast');
      el.textContent = text;
      el.style.opacity = '1';
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { el.style.opacity = '0'; }, 3200);
    },
    setObjective: function (game, title, text) {
      var box = document.getElementById('objective');
      if (!text) { box.classList.add('hidden'); return; }
      box.classList.remove('hidden');
      document.getElementById('objective-title').textContent = title || 'JOB';
      document.getElementById('objective-text').textContent = text;
    },
    setHint: function (game, text) {
      document.getElementById('hint').textContent = text || '';
    },
    showCar: function (game, car) {
      document.getElementById('speedo').classList.remove('hidden');
      document.getElementById('car-name').textContent = car.name.toUpperCase();
      document.getElementById('ammo').classList.add('hidden');
      document.getElementById('crosshair').classList.add('hidden');
    },
    hideCar: function (game) {
      document.getElementById('speedo').classList.add('hidden');
      document.getElementById('ammo').classList.remove('hidden');
      document.getElementById('crosshair').classList.remove('hidden');
    },
    flashDamage: function (game) {
      var el = document.getElementById('damage');
      el.style.opacity = '1';
      setTimeout(function () { el.style.opacity = '0'; }, 180);
    },
    update: function (game) {
      // Health
      var hp = Math.max(0, Math.round(game.health));
      document.getElementById('health-bar').style.width = hp + '%';
      document.getElementById('health-text').textContent = hp;
      // Money
      document.getElementById('money-text').textContent = Math.round(game.money).toLocaleString('en-US');
      // Wanted stars
      var stars = '';
      for (var i = 0; i < 5; i++) stars += i < game.wanted ? '★' : '<span class="dim">☆</span>';
      document.getElementById('stars').innerHTML = stars;
      // Ammo / speed
      if (game.driving) {
        document.getElementById('speed-text').textContent = Math.round(Math.abs(game.driving.speed) * 3.6);
      } else {
        document.getElementById('ammo-text').textContent = game.ammo + ' / ' + game.ammoReserve;
      }
      this.drawMinimap(game);
    },
    drawMinimap: function (game) {
      if (!minimapCtx) return;
      var ctx = minimapCtx;
      var S = 200, C = S / 2;
      var scale = S / 480; // world -240..240 maps to the disc
      function mx(x) { return C + x * scale; }
      function mz(z) { return C + z * scale; }
      ctx.clearRect(0, 0, S, S);
      // Sea and beach on the east
      ctx.fillStyle = '#123a5c'; ctx.fillRect(mx(214), 0, S - mx(214), S);
      ctx.fillStyle = '#e8d39a'; ctx.fillRect(mx(200), 0, mx(214) - mx(200), S);
      // Ground
      ctx.fillStyle = '#2a2f26'; ctx.fillRect(0, 0, mx(200), S);
      // Roads
      ctx.strokeStyle = '#5a5f66'; ctx.lineWidth = 5;
      SOL.City.STREETS.forEach(function (c) {
        ctx.beginPath(); ctx.moveTo(mx(c), 0); ctx.lineTo(mx(c), S); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, mz(c)); ctx.lineTo(S, mz(c)); ctx.stroke();
      });
      // Plaza
      ctx.fillStyle = '#c9b18a';
      ctx.beginPath(); ctx.arc(C, C, 8, 0, Math.PI * 2); ctx.fill();
      // Mission marker
      if (game.missionTarget && game.missionTarget.type === 'reach') {
        var pulse = 5 + Math.sin(game.time * 4) * 2;
        ctx.fillStyle = '#ffd23c';
        ctx.beginPath(); ctx.arc(mx(game.missionTarget.x), mz(game.missionTarget.z), pulse, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
      } else if (game.missionTarget && game.missionTarget.type === 'timed') {
        var step = game.missionTarget;
        var pt = step.points[step.pointIndex || 0];
        if (pt) {
          ctx.fillStyle = '#ffd23c';
          ctx.beginPath(); ctx.arc(mx(pt[0]), mz(pt[1]), 6, 0, Math.PI * 2); ctx.fill();
        }
      }
      // Cars (white dots)
      ctx.fillStyle = '#fff';
      for (var i = 0; i < game.cars.length; i++) {
        var car = game.cars[i];
        ctx.fillRect(mx(car.pos.x) - 1.5, mz(car.pos.z) - 1.5, 3, 3);
      }
      // Police (red blips, bigger)
      ctx.fillStyle = '#ff3344';
      for (var j = 0; j < game.cops.length; j++) {
        var cop = game.cops[j];
        ctx.beginPath(); ctx.arc(mx(cop.pos.x), mz(cop.pos.z), 3.5, 0, Math.PI * 2); ctx.fill();
      }
      for (var k = 0; k < game.policeCars.length; k++) {
        var pc = game.policeCars[k];
        ctx.beginPath(); ctx.arc(mx(pc.pos.x), mz(pc.pos.z), 4, 0, Math.PI * 2); ctx.fill();
      }
      // Player arrow (rotated by facing)
      var p = game.player.pos;
      var yaw = game.driving ? game.driving.heading : game.player.yaw;
      ctx.save();
      ctx.translate(mx(p.x), mz(p.z));
      ctx.rotate(Math.atan2(Math.sin(yaw), Math.cos(yaw)));
      ctx.fillStyle = '#7dff8a';
      ctx.beginPath();
      ctx.moveTo(0, -8); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  };
})();
