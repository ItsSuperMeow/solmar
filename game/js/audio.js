/* Solmar audio: every sound is synthesized with WebAudio. No audio files. */
(function () {
  var SOL = window.SOL;
  var ctx = null;
  var master = null;
  var engineOsc = null;
  var engineGain = null;
  var sirenOsc = null;
  var sirenGain = null;
  var sirenLfo = null;

  function ensureContext() {
    if (ctx) return true;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      return true;
    } catch (e) { return false; }
  }

  function noiseBuffer(seconds) {
    var len = Math.floor(ctx.sampleRate * seconds);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function tone(freq, dur, type, vol, when, slideTo) {
    if (!ctx) return;
    var t = when || ctx.currentTime;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(master);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  function burst(dur, vol, filterFreq) {
    if (!ctx) return;
    var src = ctx.createBufferSource();
    src.buffer = noiseBuffer(dur);
    var filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    var g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.4, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    src.connect(filter); filter.connect(g); g.connect(master);
    src.start();
  }

  SOL.Audio = {
    // Call on the first user gesture (the Start button). Browsers block audio before that.
    unlock: function () {
      if (!ensureContext()) return;
      if (ctx.state === 'suspended') ctx.resume();
      this.startEngine();
      this.startSiren();
    },
    startEngine: function () {
      if (!ctx || engineOsc) return;
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      var filter = ctx.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0.0;
      engineOsc.connect(filter); filter.connect(engineGain); engineGain.connect(master);
      engineOsc.start();
    },
    // speed 0..1 while driving; silent on foot.
    setEngine: function (speed, on) {
      if (!ctx || !engineGain) return;
      var target = on ? 0.03 + speed * 0.09 : 0.0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(55 + speed * 130, ctx.currentTime, 0.1);
    },
    startSiren: function () {
      if (!ctx || sirenOsc) return;
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 700;
      sirenLfo = ctx.createOscillator();
      sirenLfo.type = 'square';
      sirenLfo.frequency.value = 0.55;
      var lfoGain = ctx.createGain();
      lfoGain.gain.value = 280;
      sirenLfo.connect(lfoGain); lfoGain.connect(sirenOsc.frequency);
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0.0;
      sirenOsc.connect(sirenGain); sirenGain.connect(master);
      sirenOsc.start(); sirenLfo.start();
    },
    // wanted 0..5: siren fades in as the heat rises.
    setSiren: function (wanted) {
      if (!ctx || !sirenGain) return;
      var target = wanted > 0 ? 0.012 + wanted * 0.008 : 0.0;
      sirenGain.gain.setTargetAtTime(target, ctx.currentTime, 0.3);
    },
    gunshot: function () { if (ctx) burst(0.16, 0.5, 2600); },
    punch: function () { if (ctx) { burst(0.1, 0.3, 500); tone(90, 0.12, 'sine', 0.3, 0, 45); } },
    crash: function () { if (ctx) { burst(0.3, 0.45, 700); tone(70, 0.25, 'sine', 0.3, 0, 35); } },
    pickup: function () { if (ctx) { tone(660, 0.12, 'sine', 0.25); tone(990, 0.22, 'sine', 0.25, ctx.currentTime + 0.1); } },
    cash: function () { if (ctx) { tone(880, 0.1, 'triangle', 0.22); tone(1174, 0.14, 'triangle', 0.22, ctx.currentTime + 0.09); tone(1568, 0.25, 'triangle', 0.22, ctx.currentTime + 0.18); } },
    missionDone: function () { if (ctx) { var t = ctx.currentTime; tone(523, 0.14, 'triangle', 0.25, t); tone(659, 0.14, 'triangle', 0.25, t + 0.12); tone(784, 0.3, 'triangle', 0.28, t + 0.24); } },
    busted: function () { if (ctx) { tone(220, 0.5, 'sawtooth', 0.2, 0, 110); } },
    click: function () { if (ctx) tone(1200, 0.05, 'square', 0.12); }
  };
})();
