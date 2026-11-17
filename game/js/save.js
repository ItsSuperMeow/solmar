// Solmar saves — money, mission progress and position in localStorage.
// One key, one JSON object, versioned so an old save never breaks the game.

const SAVE_KEY = 'solmar-save-v1';

function saveGame(G) {
  try {
    const data = {
      version: 1,
      money: G.player.money,
      missionsDone: G.missions.done,
      missionIndex: G.missions.index,
      pos: { x: G.player.pos.x, z: G.player.pos.z },
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) {
    // Storage full or blocked (private mode): the game plays on unsaved.
  }
}

function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch (e) {
    return null;
  }
}

function hasSave() { return loadSave() !== null; }

// Apply a loaded save to the game state (money, missions, position).
function applySave(G, data) {
  if (!data) return;
  G.player.money = data.money || 0;
  G.missions.done = data.missionsDone || 0;
  G.missions.index = Math.min(data.missionIndex || 0, 4);
  if (data.pos) {
    G.player.pos.x = data.pos.x;
    G.player.pos.z = data.pos.z;
  }
}
