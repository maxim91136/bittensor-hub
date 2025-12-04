// Minimal WebAudio SoundManager (no external deps)
// Exposes `window.sound` with: init(), play(name), toggleMute(), isMuted(), setVolume(v)
(function(){
  const ctx = { audioCtx: null, masterGain: null, muted: false, volume: 0.18 };

  function ensureAudioContext() {
    if (!ctx.audioCtx) {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        ctx.audioCtx = new AudioContext();
        ctx.masterGain = ctx.audioCtx.createGain();
        ctx.masterGain.gain.value = ctx.volume;
        ctx.masterGain.connect(ctx.audioCtx.destination);
        if (ctx.muted) ctx.masterGain.gain.value = 0;
      } catch(e) {
        console.warn('WebAudio unavailable', e);
      }
    }
  }

  function resumeIfNeeded() {
    if (ctx.audioCtx && ctx.audioCtx.state === 'suspended') {
      ctx.audioCtx.resume().catch(()=>{});
    }
  }

  function envelopeGain(duration, attack=0.002, release=0.06) {
    const g = ctx.audioCtx.createGain();
    const now = ctx.audioCtx.currentTime;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(1, now + attack);
    g.gain.linearRampToValueAtTime(0, now + duration - release);
    g.gain.linearRampToValueAtTime(0, now + duration + 0.02);
    return g;
  }

  // tiny drip: short high-ish sine
  function playDrip() {
    ensureAudioContext(); if (!ctx.audioCtx) return;
    const o = ctx.audioCtx.createOscillator();
    const g = envelopeGain(0.18, 0.001, 0.05);
    o.type = 'sine';
    o.frequency.value = 720 + Math.random()*200;
    o.connect(g);
    g.connect(ctx.masterGain);
    o.start(); o.stop(ctx.audioCtx.currentTime + 0.18);
  }

  // whoosh: short noise filtered sweep
  function playWhoosh() {
    ensureAudioContext(); if (!ctx.audioCtx) return;
    const bufferSize = 2 * ctx.audioCtx.sampleRate;
    const noiseBuf = ctx.audioCtx.createBuffer(1, bufferSize, ctx.audioCtx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i=0;i<bufferSize;i++) data[i] = (Math.random()*2-1) * (1 - i/bufferSize);
    const src = ctx.audioCtx.createBufferSource();
    src.buffer = noiseBuf;
    const band = ctx.audioCtx.createBiquadFilter();
    band.type = 'bandpass'; band.frequency.value = 1200; band.Q.value = 0.8;
    const g = envelopeGain(0.38, 0.004, 0.12);
    // sweep down
    band.frequency.setValueAtTime(1800, ctx.audioCtx.currentTime);
    band.frequency.exponentialRampToValueAtTime(800, ctx.audioCtx.currentTime + 0.36);
    src.connect(band); band.connect(g); g.connect(ctx.masterGain);
    src.start(); src.stop(ctx.audioCtx.currentTime + 0.42);
  }

  // beep-boop: two simple beeps (nice and soft)
  function playBlockTick() {
    ensureAudioContext(); if (!ctx.audioCtx) return;
    const now = ctx.audioCtx.currentTime;
    // first tone
    const o1 = ctx.audioCtx.createOscillator(); o1.type='triangle'; o1.frequency.value = 540;
    const g1 = ctx.audioCtx.createGain(); g1.gain.setValueAtTime(0, now);
    g1.gain.linearRampToValueAtTime(1, now+0.002);
    g1.gain.exponentialRampToValueAtTime(0.001, now+0.18);
    o1.connect(g1); g1.connect(ctx.masterGain);
    o1.start(now); o1.stop(now+0.18);
    // second tone, a bit softer/higher
    const o2 = ctx.audioCtx.createOscillator(); o2.type='sine'; o2.frequency.value = 720;
    const start2 = now + 0.20;
    const g2 = ctx.audioCtx.createGain(); g2.gain.setValueAtTime(0, start2);
    g2.gain.linearRampToValueAtTime(0.9, start2+0.002);
    g2.gain.exponentialRampToValueAtTime(0.001, start2+0.26);
    o2.connect(g2); g2.connect(ctx.masterGain);
    o2.start(start2); o2.stop(start2+0.26);
  }

  function init() {
    ensureAudioContext();
    // try to resume at start if user already interacted
    document.addEventListener('click', resumeIfNeeded, {once:true});
    document.addEventListener('keydown', resumeIfNeeded, {once:true});
    return ctx;
  }

  function play(name) {
    try { resumeIfNeeded(); } catch(e){}
    if (ctx.muted) return;
    switch(name) {
      case 'drip': playDrip(); break;
      case 'whoosh': playWhoosh(); break;
      case 'blockTick': playBlockTick(); break;
      default: break;
    }
  }

  function toggleMute(setTo) {
    ensureAudioContext();
    if (typeof setTo === 'boolean') ctx.muted = !(!setTo);
    else ctx.muted = !ctx.muted;
    if (ctx.masterGain) ctx.masterGain.gain.value = ctx.muted ? 0 : ctx.volume;
    try { localStorage.setItem('soundMuted', ctx.muted ? '1' : '0'); } catch(e){}
    return ctx.muted;
  }

  function isMuted(){ return !!ctx.muted; }
  function setVolume(v){ ctx.volume = Math.max(0, Math.min(1, v)); if (ctx.masterGain && !ctx.muted) ctx.masterGain.gain.value = ctx.volume; }

  // initialize default muted from localStorage (default ON = unmuted)
  try { const m = localStorage.getItem('soundMuted'); if (m === '1') ctx.muted = true; else ctx.muted = false; } catch(e){}

  window.sound = { init, play, toggleMute, isMuted, setVolume };
})();
