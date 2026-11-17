/* Solmar save system: money, missions and position in localStorage. */
(function () {
  var SOL = window.SOL;
  var KEY = 'solmar-save-v1';

  SOL.Save = {
    load: function () {
      try {
        var raw = window.localStorage.getItem(KEY);
        if (!raw) return null;
        var data = JSON.parse(raw);
        if (typeof data.money !== 'number' || !Array.isArray(data.missionsDone)) return null;
        return data;
      } catch (e) { return null; }
    },
    store: function (game) {
      try {
        var data = {
          money: Math.round(game.money),
          missionsDone: game.missionsDone.slice(),
          pos: game.player ? [game.player.pos.x, game.player.pos.z] : [0, 0],
          health: Math.round(game.health),
          savedAt: Date.now()
        };
        window.localStorage.setItem(KEY, JSON.stringify(data));
      } catch (e) { /* storage unavailable: play without saving */ }
    },
    clear: function () {
      try { window.localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    }
  };
})();
