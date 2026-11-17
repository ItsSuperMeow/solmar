// Solmar audio — procedural WebAudio sounds only, no audio files.
// Every function takes the shared game state G and reads G.audio, which
// initAudio creates on the first user gesture (browsers need one).
// Callers never touch the AudioContext directly.

function initAudio(G) {
  if (G.audio.ctx) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    // Engine hum: a sawtooth whose pitch follows the car's speed.
    const engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 50;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 400;
    const engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
    // Siren: two alternating tones while the police are after you.
    const sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.value = 700;
    const sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(master);
    sirenOsc.start();
    G.audio = { ctx, master, engineOsc, engineGain, sirenOsc, sirenGain, muted: false, sirenOn: false };
  } catch (e) {
    G.audio = { ctx: null };
  }
}

function audioMuted(G) { return !G.audio.ctx || G.audio.muted; }

function toggleMute(G) {
  if (!G.audio.ctx) return;
  G.audio.muted = !G.audio.muted;
  G.audio.master.gain.value = G.audio.muted ? 0 : 0.5;
}

function updateEngineSound(G, speed01) {
  if (!G.audio.ctx || G.audio.muted) return;
  const driving = !!G.player.car;
  G.audio.engineGain.gain.value = driving ? 0.05 + speed01 * 0.09 : 0;
  G.audio.engineOsc.frequency.value = 50 + speed01 * 140;
}

function updateSirenSound(G) {
  if (!G.audio.ctx || G.audio.muted) return;
  const wanted = G.wanted > 0 && G.state === 'playing';
  if (wanted && !G.audio.sirenOn) { G.audio.sirenOn = true; G.audio.sirenGain.gain.value = 0.045; }
  if (!wanted && G.audio.sirenOn) { G.audio.sirenOn = false; G.audio.sirenGain.gain.value = 0; }
  if (G.audio.sirenOn) {
    // Wail: sweep the tone up and down with the game clock.
    G.audio.sirenOsc.frequency.value = 700 + 260 * Math.sin(G.time * 2.4);
  }
}

// A short burst of filtered noise — gunshots, thuds, crashes.
function noiseBurst(G, duration, volume, filterFreq) {
  if (!G.audio.ctx || G.audio.muted) return;
  const ctx = G.audio.ctx;
  const len = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = filterFreq;
  const gain = ctx.createGain();
  gain.gain.value = volume;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(G.audio.master);
  src.start();
}

function playGunshot(G) { noiseBurst(G, 0.14, 0.5, 1800); }
function playPunch(G) { noiseBurst(G, 0.1, 0.35, 500); }
function playCrash(G) { noiseBurst(G, 0.25, 0.5, 350); }
function playHit(G) { noiseBurst(G, 0.08, 0.3, 900); }

// A two-note pickup chime for mission cash and mission complete.
function playChime(G) {
  if (!G.audio.ctx || G.audio.muted) return;
  const ctx = G.audio.ctx;
  [660, 990].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    const t = ctx.currentTime + i * 0.12;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    osc.connect(gain);
    gain.connect(G.audio.master);
    osc.start(t);
    osc.stop(t + 0.55);
  });
}

// A low fanfare for finishing a mission.
function playMissionComplete(G) {
  if (!G.audio.ctx || G.audio.muted) return;
  const ctx = G.audio.ctx;
  [523, 659, 784, 1047].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    const t = ctx.currentTime + i * 0.13;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    osc.connect(gain);
    gain.connect(G.audio.master);
    osc.start(t);
    osc.stop(t + 0.65);
  });
}
