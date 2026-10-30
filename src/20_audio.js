/* ═════════ sound: every effect is synthesised — gunfire by calibre, tools, falling trees, engines and hooves, animals,
   zombies, footsteps, and a living ambience: sea, wind, rain on the land (muffled under a roof), birds by day, crickets by night ═════════ */
const AUDIO = (() => {
  let ctx = null, master = null, white = null, brown = null, pink = null, on = false, amb = null, tick = 0, gullT = 8, birdT = 4, heartT = 0, lastGroan = 0, eng = null, hoofT = 0;
  let sfx = null, ambBus = null, musicBus = null, voice = null, mus = null, musWant = false;
  const ok = () => ctx && on;
  function mkNoise(kind, secs) {
    const len = Math.floor(ctx.sampleRate * secs), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    let l = 0, b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') { l = (l + 0.02 * w) / 1.02; d[i] = l * 3.5; }
      else if (kind === 'pink') { b0 = 0.997 * b0 + w * 0.029591; b1 = 0.985 * b1 + w * 0.032534; b2 = 0.95 * b2 + w * 0.048056; d[i] = (b0 + b1 + b2 + w * 0.05) * 2.2; }
      else d[i] = w;
    }
    return b;
  }
  function panNode(p) { if (ctx.createStereoPanner) { const n = ctx.createStereoPanner(); n.pan.value = SET.spatial ? clamp(p, -1, 1) : 0; return n; } return ctx.createGain(); }
  function burst({ buf = white, type = 'bandpass', f = 1000, q = 0.8, dur = 0.1, gain = 0.5, attack = 0.002, pan = 0, delay = 0, rate = 1, bus = null }) {
    if (!ok() || gain < 0.002) return;
    const t0 = ctx.currentTime + delay, s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(), pn = panNode(pan);
    s.buffer = buf; s.playbackRate.value = rate; fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + dur);
    s.connect(fl); fl.connect(g); g.connect(pn); pn.connect(bus || sfx);
    s.start(t0, Math.random() * 1.5); s.stop(t0 + attack + dur + 0.05);
  }
  function tone({ type = 'sine', f0 = 440, f1 = null, dur = 0.2, gain = 0.3, attack = 0.005, pan = 0, delay = 0, filter = null, bus = null }) {
    if (!ok() || gain < 0.002) return;
    const t0 = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain(), pn = panNode(pan);
    o.type = type; o.frequency.setValueAtTime(f0, t0); if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + dur);
    let src = o;
    if (filter) { const fl = ctx.createBiquadFilter(); fl.type = filter[0]; fl.frequency.value = filter[1]; fl.Q.value = filter[2] || 1; o.connect(fl); src = fl; }
    src.connect(g); g.connect(pn); pn.connect(bus || sfx); o.start(t0); o.stop(t0 + attack + dur + 0.05);
  }
  function sweep({ f0 = 400, f1 = 1800, q = 1.4, dur = 0.3, gain = 0.15, delay = 0 }) {
    if (!ok()) return;
    const t0 = ctx.currentTime + delay, s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = white; fl.type = 'bandpass'; fl.Q.value = q; fl.frequency.setValueAtTime(f0, t0); fl.frequency.exponentialRampToValueAtTime(f1, t0 + dur * 0.8);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + dur * 0.55); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(fl); fl.connect(g); g.connect(sfx); s.start(t0, Math.random()); s.stop(t0 + dur + 0.05);
  }
  function loop(buf, type, f, q) {
    const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = buf; s.loop = true; fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.value = 0;
    s.connect(fl); fl.connect(g); g.connect(ambBus); s.start(); return { g, fl, s };
  }
  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    try { ctx = new AC(); } catch (_) { ctx = null; return false; }
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5;
    master = ctx.createGain(); master.gain.value = 0; master.connect(comp); comp.connect(ctx.destination);
    sfx = ctx.createGain(); ambBus = ctx.createGain(); musicBus = ctx.createGain(); voice = ctx.createGain();
    for (const b of [sfx, ambBus, musicBus, voice]) b.connect(master);
    setVolumes();
    white = mkNoise('white', 2); brown = mkNoise('brown', 3); pink = mkNoise('pink', 3);
    amb = { ocean: loop(brown, 'lowpass', 520, 0.7), wind: loop(white, 'bandpass', 650, 0.5), rain: loop(pink, 'highpass', 900, 0.4), rainLow: loop(brown, 'lowpass', 380, 0.6), stream: loop(pink, 'bandpass', 2200, 0.6) };
    const swell = ctx.createOscillator(), sg = ctx.createGain(); swell.frequency.value = 0.11; sg.gain.value = 0.06; swell.connect(sg); sg.connect(amb.ocean.g.gain); swell.start();
    const gust = ctx.createOscillator(), gg = ctx.createGain(); gust.frequency.value = 0.07; gg.gain.value = 260; gust.connect(gg); gg.connect(amb.wind.fl.frequency); gust.start();
    const cr = ctx.createOscillator(), am = ctx.createOscillator(), amg = ctx.createGain(), cg = ctx.createGain();
    cr.frequency.value = 4400; am.type = 'square'; am.frequency.value = 17; amg.gain.value = 0.5; cg.gain.value = 0;
    const crG = ctx.createGain(); crG.gain.value = 0.5; am.connect(amg); amg.connect(crG.gain); cr.connect(crG); crG.connect(cg); cg.connect(ambBus);
    cr.start(); am.start(); amb.crickets = { g: cg };
    return true;
  }
  function engineNode(kind) {
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), n = ctx.createBufferSource(), nf = ctx.createBiquadFilter(), ng = ctx.createGain();
    o1.type = 'sawtooth'; o2.type = kind === 'bike' ? 'sawtooth' : 'square'; f.type = 'lowpass'; f.frequency.value = 600; f.Q.value = 2.2;
    n.buffer = brown; n.loop = true; nf.type = 'bandpass'; nf.frequency.value = 300; nf.Q.value = 0.8; ng.gain.value = kind === 'boat' ? 0.5 : 0.25;
    o1.connect(f); o2.connect(f); n.connect(nf); nf.connect(ng); ng.connect(f); f.connect(g); g.connect(sfx); g.gain.value = 0;
    o1.start(); o2.start(); n.start();
    return { o1, o2, f, g, n, nf, kind };
  }
  const D = (d) => 1 / (1 + (d || 0) / 14);
  const panOf = (x, z) => { const rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw), dx = x - player.pos.x, dz = z - player.pos.z, dl = Math.hypot(dx, dz) || 1; return (dx * rx + dz * rz) / dl; };
  function chirp(pan, k = 1) {
    // a songbird: a few quick whistles
    const base = rr(2600, 4200), n = 2 + Math.floor(rand() * 4);
    for (let i = 0; i < n; i++) tone({ type: 'sine', f0: base * rr(0.9, 1.15), f1: base * rr(1.2, 1.6), dur: rr(0.05, 0.11), gain: 0.03 * k, delay: i * rr(0.09, 0.16), pan });
  }
  function setVolumes() {
    if (!ctx) return; const t = ctx.currentTime;
    master.gain.setTargetAtTime(on ? SET.vMaster : 0, t, 0.2); sfx.gain.setTargetAtTime(SET.vSfx, t, 0.1); ambBus.gain.setTargetAtTime(SET.vAmb, t, 0.1);
    musicBus.gain.setTargetAtTime(SET.vMusic, t, 0.2); voice.gain.setTargetAtTime(SET.vVoice, t, 0.1);
  }
  const caption = (txt, pan) => { if (SET.subs && typeof subtitle === 'function') subtitle(txt, pan); };
  /* the synthesised pad (until the theme is ready, or if it cannot load): D minor with a Hijaz melody, a drone, a long room */
  const HIJAZ = [0, 1, 4, 5, 7, 8, 10, 12, 13, 16];
  const CHORDS = [[0, 3, 7, 12], [-4, 0, 3, 8], [-7, -4, 0, 5], [-5, -1, 2, 7]];
  const nf = (semi) => 146.83 * Math.pow(2, semi / 12);
  function impulse(sec) {
    const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6); }
    return b;
  }
  /* the theme of Call of Survival (tools/space_music.py, composed for the game): a minute of space music that loops with no
     seam, and the sting played once when the title appears. Fetched a little after the page opens (or at the first tap),
     decoded once sound is allowed; until it is ready the synthesised pad below plays and then hands over to it */
  const THEME = { asked: false, bytes: null, sbytes: null, buf: null, sting: null, dec: false, sdec: false, stung: false };
  function themeFetch() {
    if (THEME.asked) return; THEME.asked = true;
    let ext = '.mp4'; try { if (!document.createElement('audio').canPlayType('audio/mp4; codecs="mp4a.40.2"')) ext = '.ogg'; } catch (_) {}   // AAC in mp4, else Opus
    const get = (n, k) => fetch('assets/audio/' + n + ext).then((r) => (r.ok ? r.arrayBuffer() : null)).then((b) => { THEME[k] = b; themeDecode(); }).catch(() => {});
    get('theme', 'bytes'); get('sting', 'sbytes');
  }
  setTimeout(themeFetch, 4000);
  function themeDecode() {
    if (!ctx) return;
    if (THEME.bytes && !THEME.dec) { THEME.dec = true; ctx.decodeAudioData(THEME.bytes.slice(0), (b) => { THEME.buf = b; if (mus && !mus.theme) musicSwap(); }, () => {}); }
    if (THEME.sbytes && !THEME.sdec) { THEME.sdec = true; ctx.decodeAudioData(THEME.sbytes.slice(0), (b) => { THEME.sting = b; if (mus && ctx.currentTime - mus.t0 < 5) playSting(); }, () => {}); }
  }
  function playSting() {
    if (!THEME.sting || THEME.stung || !ok()) return; THEME.stung = true;
    const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = THEME.sting; g.gain.value = 0.9; s.connect(g); g.connect(musicBus); s.start();
  }
  // the theme takes over from the pad: it fades in over a few seconds while the pad fades out
  function musicSwap() {
    if (!mus || mus.theme || !THEME.buf) return;
    const src = ctx.createBufferSource(), g = ctx.createGain(), t = ctx.currentTime;
    src.buffer = THEME.buf; src.loop = true; src.loopStart = 0; src.loopEnd = THEME.buf.duration;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.85, t + (mus.bar ? 3.5 : 1.2));
    src.connect(g); g.connect(musicBus); src.start(t);
    mus.theme = { src, g }; mus.out.gain.setTargetAtTime(0, t, 0.8);
    for (const n of mus.nodes) try { n.stop(t + 4); } catch (_) {}
  }
  function musicStart() {
    if (mus) return;
    themeFetch(); themeDecode();
    const out = ctx.createGain(), dry = ctx.createGain(), wet = ctx.createGain(), rev = ctx.createConvolver();
    out.gain.value = 0; rev.buffer = impulse(3.2); dry.gain.value = 0.7; wet.gain.value = 0.55;
    out.connect(dry); dry.connect(musicBus); out.connect(rev); rev.connect(wet); wet.connect(musicBus);
    const dr = ctx.createOscillator(), dg = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    dr.type = 'sine'; dr.frequency.value = nf(-12); dg.gain.value = 0.05; lfo.frequency.value = 0.07; lg.gain.value = 0.025;
    lfo.connect(lg); lg.connect(dg.gain); dr.connect(dg); dg.connect(out); dr.start(); lfo.start();
    mus = { out, nodes: [dr, lfo], next: ctx.currentTime + 0.3, bar: 0, t0: ctx.currentTime, theme: null };
    out.gain.setTargetAtTime(0.55, ctx.currentTime, 1.2);
    if (THEME.buf) musicSwap();
    playSting();
  }
  function musicStop() {
    if (!mus) return; const m = mus; mus = null;
    m.out.gain.setTargetAtTime(0, ctx.currentTime, 0.6);
    if (m.theme) { m.theme.g.gain.setTargetAtTime(0, ctx.currentTime, 0.6); try { m.theme.src.stop(ctx.currentTime + 3.4); } catch (_) {} }
    setTimeout(() => { for (const n of m.nodes) try { n.stop(); } catch (_) {} try { m.out.disconnect(); } catch (_) {} }, 3500);
  }
  function padNote(f, t0, dur, g) {
    for (const det of [-7, 0, 6]) {
      const o = ctx.createOscillator(), fl = ctx.createBiquadFilter(), gn = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; fl.type = 'lowpass'; fl.Q.value = 0.6;
      fl.frequency.setValueAtTime(420, t0); fl.frequency.linearRampToValueAtTime(980, t0 + dur * 0.5); fl.frequency.linearRampToValueAtTime(420, t0 + dur);
      gn.gain.setValueAtTime(0.0001, t0); gn.gain.linearRampToValueAtTime(g, t0 + 2.4); gn.gain.setValueAtTime(g, t0 + dur - 2.6); gn.gain.linearRampToValueAtTime(0.0001, t0 + dur);
      o.connect(fl); fl.connect(gn); gn.connect(mus.out); o.start(t0); o.stop(t0 + dur + 0.1);
    }
  }
  function pluck(f, t0, g) {
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), gn = ctx.createGain(), fl = ctx.createBiquadFilter();
    o.type = 'triangle'; o.frequency.value = f; o2.type = 'sine'; o2.frequency.value = f * 2; fl.type = 'lowpass'; fl.frequency.value = 2600;
    gn.gain.setValueAtTime(0.0001, t0); gn.gain.exponentialRampToValueAtTime(g, t0 + 0.012); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.6);
    o.connect(fl); o2.connect(fl); fl.connect(gn); gn.connect(mus.out); o.start(t0); o2.start(t0); o.stop(t0 + 1.7); o2.stop(t0 + 1.7);
  }
  function musicTick() {
    if (!mus || mus.theme || ctx.currentTime < mus.next - 0.6) return;
    const t0 = mus.next, BAR = 6.4, ch = CHORDS[mus.bar % CHORDS.length];
    for (const n of ch) padNote(nf(n), t0, BAR + 2.2, 0.018);
    if (mus.bar >= 1) {
      let k = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < 8; i++) if (Math.random() < (i % 2 ? 0.28 : 0.55) && k-- > 0) pluck(nf(12 + HIJAZ[Math.floor(Math.random() * HIJAZ.length)]), t0 + i * BAR / 8 + Math.random() * 0.04, 0.045);
    }
    mus.bar++; mus.next = t0 + BAR;
  }
  return {
    get on() { return on; },
    get ctx() { return ctx; },
    setOn(v) {
      on = v;
      if (v && init()) { try { ctx.resume(); } catch (_) {} setVolumes(); themeFetch(); themeDecode(); if (musWant) musicStart(); }
      else if (ctx) master.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
    },
    setVolumes() { setVolumes(); },
    music(v) { musWant = v; if (!ctx || !on) return; if (v) musicStart(); else musicStop(); },
    musicUpdate() { if (ctx && on && mus) musicTick(); },
    get theme() { return { fetched: !!THEME.bytes, decoded: !!THEME.buf, sting: !!THEME.sting, stung: THEME.stung, playing: !!(mus && mus.theme) }; },
    lobbyAmb(dt) {
      // the lobby's own morning: a breath of wind in the leaves, birds now and then, no rain or engines
      if (!ctx || !amb) return; tick += dt; if (tick < 0.4) return; const step = tick; tick = 0; const t = ctx.currentTime;
      amb.ocean.g.gain.setTargetAtTime(0.02, t, 1); amb.wind.g.gain.setTargetAtTime(0.035, t, 1); amb.rain.g.gain.setTargetAtTime(0, t, 0.5); amb.rainLow.g.gain.setTargetAtTime(0, t, 0.5);
      amb.stream.g.gain.setTargetAtTime(0, t, 1); amb.crickets.g.gain.setTargetAtTime(0, t, 1);
      birdT -= step; if (birdT <= 0) { birdT = rr(2.5, 7); chirp(rr(-0.8, 0.8), 0.7); }
    },
    update(dt) {
      if (!ctx || !amb) return;
      tick += dt; if (tick < 0.25) return; const step = tick; tick = 0;
      const p = player.pos, y = p.y, t = ctx.currentTime, vs = player.vehicle ? Math.abs(player.vehicle.speed) : 0;
      const seaNear = (() => { let k = 0; for (const [dx, dz] of [[0, 0], [60, 0], [-60, 0], [0, 60], [0, -60]]) { const x = p.x + dx, z = p.z + dz; if (waterAt(x, z) === 0 && terrainAt(x, z) < -0.5) k += 0.2; } return k; })();
      const sea = seaNear * (1 - smooth(10, 60, y)), high = smooth(60, 260, y), inside = player.inside ? 1 : 0;
      amb.ocean.g.gain.setTargetAtTime(0.03 + 0.3 * sea, t, 0.6);
      amb.wind.g.gain.setTargetAtTime((0.02 + 0.1 * high + WEATHER.wind * 0.08 + ENV.night * 0.02 + Math.min(0.16, vs * 0.004)) * (1 - inside * 0.7), t, 0.5);
      const rain = WEATHER.rain * (1 - WEATHER.snow);
      amb.rain.g.gain.setTargetAtTime(rain * (inside ? 0.05 : 0.22), t, 0.8); amb.rain.fl.frequency.setTargetAtTime(inside ? 400 : 900, t, 0.5);
      amb.rainLow.g.gain.setTargetAtTime(rain * (inside ? 0.25 : 0.12), t, 0.8);
      const b = biomeAt(p.x, p.z), river = b === 13 || (waterAt(p.x, p.z) > 0 && waterAt(p.x, p.z) > terrainAt(p.x, p.z) - 3 && b !== 12);
      amb.stream.g.gain.setTargetAtTime(river ? 0.04 : 0, t, 1.0);
      amb.crickets.g.gain.setTargetAtTime(ENV.night * 0.03 * (1 - sea * 0.6) * (1 - inside * 0.7) * (1 - rain), t, 1.0);
      gullT -= step;
      if (gullT <= 0) { gullT = rr(7, 18); if (ENV.day > 0.5 && sea > 0.3 && rain < 0.3) for (let k = 0; k < 2; k++) tone({ type: 'sine', f0: 1500, f1: 2300, dur: 0.18, gain: 0.05, delay: k * 0.24, pan: rr(-0.8, 0.8) }); }
      birdT -= step;
      if (birdT <= 0) { const fd = forestAt(p.x, p.z); birdT = rr(1.5, 6) / (0.3 + fd); if (ENV.day > 0.4 && rain < 0.25 && !inside && fd > 0.15) chirp(rr(-0.9, 0.9), 0.5 + fd); }
      if (player.alive && player.health < 30) { heartT -= step; if (heartT <= 0) { heartT = 0.85; tone({ f0: 62, f1: 48, dur: 0.12, gain: 0.45 }); tone({ f0: 56, f1: 44, dur: 0.12, gain: 0.32, delay: 0.2 }); } }
      if (!player.vehicle && eng) this.engine(false);
      if (player.vehicle && player.vehicle.spec.horse && Math.abs(player.vehicle.speed) > 0.6) { hoofT -= step; if (hoofT <= 0) { const sp = Math.abs(player.vehicle.speed); hoofT = clamp(1.6 / sp, 0.12, 0.6); for (let k = 0; k < (sp > 7 ? 3 : 2); k++) burst({ buf: brown, type: 'lowpass', f: 420, dur: 0.06, gain: 0.25, delay: k * 0.07 }); } }
    },
    shot(kind, d = 0, quiet = false) {
      const v = D(d * 0.4), big = kind === 'sniper' || kind === 'shotgun', small = kind === 'pistol';
      if (quiet) {      // through a suppressor (or the crossbow): a dull thump and the action cycling
        burst({ buf: brown, type: 'lowpass', f: 900, q: 0.7, dur: 0.09, gain: 0.32 * v });
        tone({ type: 'square', f0: 900, f1: 600, dur: 0.02, gain: 0.05 * v, filter: ['bandpass', 1200, 2] });
        return;
      }
      if (d > 3) caption('إطلاق نار', 0);
      burst({ type: 'bandpass', f: small ? 2100 : 1700, q: 0.6, dur: small ? 0.06 : 0.08, gain: 0.85 * v, rate: rr(0.9, 1.1), pan: d ? 0 : 0 });
      burst({ buf: brown, type: 'lowpass', f: big ? 500 : 700, q: 0.5, dur: big ? 0.6 : 0.38, gain: (big ? 0.45 : 0.32) * v });
      tone({ f0: big ? 110 : 130, f1: 38, dur: big ? 0.2 : 0.12, gain: 0.7 * v });
      if (!d) tone({ type: 'square', f0: 2600, f1: 1300, dur: 0.018, gain: 0.05, filter: ['highpass', 1800] });
      burst({ type: 'highpass', f: 3000, dur: 0.5, gain: 0.05 * v, delay: 0.12 + d / 340 });
    },
    dry() { tone({ type: 'square', f0: 1100, f1: 900, dur: 0.025, gain: 0.1, filter: ['highpass', 800] }); },
    reload() { [0, 0.75, 1.35].forEach((d, i) => { burst({ type: 'highpass', f: 2600, dur: 0.035, gain: 0.3, delay: d }); tone({ type: 'square', f0: i === 2 ? 420 : 260, dur: 0.03, gain: 0.08, delay: d + 0.01, filter: ['bandpass', 900, 2] }); }); },
    groan(z, d) {
      if (!ok() || ctx.currentTime - lastGroan < 0.35) return; lastGroan = ctx.currentTime;
      const t0 = ctx.currentTime, base = z.type === 'brute' ? 68 : z.type === 'runner' ? 128 : 96, vol = 0.5 / (1 + d / 7);
      const o = ctx.createOscillator(), vib = ctx.createOscillator(), vg = ctx.createGain(), f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter(), g = ctx.createGain(), pn = panNode(panOf(z.x, z.z));
      o.type = 'sawtooth'; o.frequency.setValueAtTime(base * rr(0.9, 1.15), t0); o.frequency.linearRampToValueAtTime(base * rr(0.7, 0.9), t0 + 1.0);
      vib.frequency.value = rr(4, 7); vg.gain.value = base * 0.07; vib.connect(vg); vg.connect(o.frequency);
      f1.type = 'bandpass'; f1.frequency.value = rr(450, 700); f1.Q.value = 3; f2.type = 'lowpass'; f2.frequency.value = 1400;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.18); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.15);
      o.connect(f1); f1.connect(f2); f2.connect(g); g.connect(pn); pn.connect(sfx);
      if (d < 30) caption('زومبي قريب', panOf(z.x, z.z));
      o.start(t0); vib.start(t0); o.stop(t0 + 1.2); vib.stop(t0 + 1.2);
    },
    zhit(d) { burst({ buf: brown, type: 'lowpass', f: 420, dur: 0.08, gain: 0.45 / (1 + d / 12) }); burst({ type: 'bandpass', f: 700, q: 1.5, dur: 0.05, gain: 0.25 / (1 + d / 12) }); },
    zdie(d) { tone({ type: 'sawtooth', f0: 115, f1: 38, dur: 0.95, gain: 0.32 / (1 + d / 12), filter: ['lowpass', 520] }); },
    hurt() { burst({ type: 'bandpass', f: 520, q: 1.2, dur: 0.16, gain: 0.45 }); tone({ f0: 170, f1: 90, dur: 0.2, gain: 0.35 }); },
    die() { tone({ f0: 210, f1: 38, dur: 1.6, gain: 0.5 }); burst({ buf: brown, type: 'lowpass', f: 300, dur: 0.6, gain: 0.4 }); },
    step(s, speed) {
      const g = 0.06 + Math.min(speed, 9) * 0.012, wet = WEATHER.wet;
      if (s === 'sand') burst({ buf: brown, type: 'lowpass', f: 520, dur: 0.08, gain: g * 1.3 });
      else if (s === 'snow') { burst({ buf: brown, type: 'bandpass', f: 900, q: 0.7, dur: 0.12, gain: g * 1.4 }); burst({ type: 'highpass', f: 3000, dur: 0.06, gain: g * 0.3 }); }
      else if (s === 'stone') burst({ type: 'bandpass', f: 1900, q: 1.2, dur: 0.035, gain: g });
      else if (s === 'wood') { burst({ type: 'bandpass', f: 620, q: 1.5, dur: 0.06, gain: g * 1.5 }); tone({ f0: 150, dur: 0.04, gain: g * 0.8 }); }
      else if (s === 'water') burst({ type: 'highpass', f: 1300, dur: 0.14, gain: g * 1.4 });
      else burst({ type: 'lowpass', f: 950, dur: 0.05, gain: g });
      if (wet > 0.3 && s !== 'water') burst({ type: 'highpass', f: 2200, dur: 0.07, gain: g * wet * 0.8, delay: 0.01 });
      burst({ type: 'highpass', f: 4200, dur: 0.03, gain: g * 0.25, delay: 0.02 });
    },
    land(impact) { burst({ buf: brown, type: 'lowpass', f: 320, dur: 0.15, gain: Math.min(0.6, impact / 28) }); },
    jump() { burst({ buf: brown, type: 'lowpass', f: 700, dur: 0.05, gain: 0.09 }); },
    pickup(big) { (big ? [523, 784, 1046] : [660, 990]).forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.16, gain: 0.16, delay: i * 0.09 })); },
    coins() { for (let k = 0; k < 5; k++) tone({ type: 'triangle', f0: rr(2400, 3600), dur: 0.05, gain: 0.08, delay: k * rr(0.03, 0.06) }); },
    treasure() { [523, 659, 784, 1046, 1318].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.3, gain: 0.16, delay: i * 0.11 })); },
    swing() { sweep({ f0: 320, f1: 1700, dur: 0.34, gain: 0.13, delay: 0.08 }); },
    equip() { burst({ type: 'bandpass', f: 2400, q: 2, dur: 0.03, gain: 0.16 }); tone({ type: 'triangle', f0: 520, dur: 0.04, gain: 0.05 }); },
    chop(k = 1) { tone({ f0: 190, f1: 90, dur: 0.07, gain: 0.5 * k }); burst({ type: 'bandpass', f: 1150, q: 1.3, dur: 0.05, gain: 0.55 * k }); burst({ buf: brown, type: 'lowpass', f: 520, dur: 0.12, gain: 0.32 * k }); burst({ type: 'highpass', f: 3000, dur: 0.12, gain: 0.05 * k, delay: 0.03 }); },
    punch() { burst({ buf: brown, type: 'lowpass', f: 380, dur: 0.06, gain: 0.35 }); },
    mine(k = 1) { tone({ type: 'triangle', f0: 2300, f1: 1850, dur: 0.14, gain: 0.12 * k }); tone({ type: 'sine', f0: 3500, dur: 0.07, gain: 0.05 * k, delay: 0.004 }); burst({ type: 'bandpass', f: 2700, q: 0.9, dur: 0.05, gain: 0.5 * k }); burst({ buf: brown, type: 'lowpass', f: 900, dur: 0.13, gain: 0.3 * k }); },
    dig(k = 1) { burst({ buf: brown, type: 'lowpass', f: 600, dur: 0.18, gain: 0.5 * k }); burst({ type: 'bandpass', f: 1400, q: 0.8, dur: 0.12, gain: 0.25 * k, delay: 0.02 }); burst({ buf: pink, type: 'bandpass', f: 3000, q: 0.6, dur: 0.2, gain: 0.08 * k, delay: 0.12 }); },
    rockBreak() { burst({ buf: brown, type: 'lowpass', f: 700, dur: 0.55, gain: 0.65 }); for (let k = 0; k < 5; k++) burst({ type: 'bandpass', f: rr(700, 2200), q: 1, dur: 0.05, gain: 0.22, delay: 0.05 + k * 0.07 }); },
    treeCrack(d) { const v = D(d); tone({ type: 'sawtooth', f0: 78, f1: 50, dur: 1.4, gain: 0.16 * v, filter: ['bandpass', 420, 4] }); for (let k = 0; k < 7; k++) burst({ type: 'highpass', f: 1400, dur: 0.03, gain: 0.26 * v, delay: k * rr(0.1, 0.24) }); burst({ type: 'bandpass', f: 900, q: 2, dur: 0.12, gain: 0.35 * v }); },
    treeFall(d) { const v = D(d); burst({ buf: brown, type: 'lowpass', f: 260, dur: 1.0, gain: 0.9 * v }); tone({ f0: 70, f1: 30, dur: 0.7, gain: 0.7 * v }); burst({ type: 'bandpass', f: 900, q: 0.6, dur: 0.5, gain: 0.32 * v, delay: 0.03 }); burst({ type: 'highpass', f: 3500, dur: 0.9, gain: 0.14 * v, delay: 0.05 }); },
    logBreak() { burst({ type: 'bandpass', f: 800, dur: 0.12, gain: 0.4 }); tone({ f0: 140, f1: 70, dur: 0.15, gain: 0.3 }); },
    reap() { for (let k = 0; k < 3; k++) burst({ type: 'highpass', f: 2600, dur: 0.06, gain: 0.18, delay: k * 0.06 }); burst({ buf: pink, type: 'bandpass', f: 1500, dur: 0.2, gain: 0.12 }); },
    plant() { burst({ buf: brown, type: 'lowpass', f: 500, dur: 0.12, gain: 0.25 }); tone({ type: 'triangle', f0: 660, f1: 880, dur: 0.12, gain: 0.06, delay: 0.1 }); },
    cast() { sweep({ f0: 800, f1: 3000, dur: 0.4, gain: 0.08 }); burst({ type: 'highpass', f: 1600, dur: 0.12, gain: 0.15, delay: 0.55 }); },
    bite() { burst({ type: 'highpass', f: 1200, dur: 0.1, gain: 0.25 }); tone({ type: 'triangle', f0: 880, dur: 0.06, gain: 0.08 }); },
    eat() { for (let k = 0; k < 3; k++) burst({ buf: brown, type: 'bandpass', f: 900, q: 1.2, dur: 0.06, gain: 0.25, delay: k * 0.18 }); },
    drink() { for (let k = 0; k < 4; k++) tone({ type: 'sine', f0: rr(300, 420), f1: rr(500, 700), dur: 0.07, gain: 0.08, delay: k * 0.2 }); },
    heal() { tone({ type: 'triangle', f0: 523, f1: 784, dur: 0.25, gain: 0.1 }); burst({ type: 'highpass', f: 2000, dur: 0.1, gain: 0.1 }); },
    sleep() { [392, 330, 262].forEach((f, i) => tone({ type: 'sine', f0: f, dur: 0.5, gain: 0.08, delay: i * 0.3 })); },
    beep(k) { tone({ type: 'square', f0: 900 + k * 900, dur: 0.05, gain: 0.05, filter: ['bandpass', 1500, 2] }); },
    talk() { if (!ctx) return; for (let k = 0; k < 4; k++) tone({ type: 'sawtooth', f0: rr(150, 230), f1: rr(120, 200), dur: rr(0.08, 0.14), gain: 0.05, delay: k * 0.13, filter: ['bandpass', 900, 2], bus: voice }); },
    ui(k = 0) { tone({ type: 'triangle', f0: 880 + k * 220, f1: 1100 + k * 260, dur: 0.06, gain: 0.05 }); },
    animal(kind, d) {
      const v = D(d) * 0.8;
      if (kind === 'horse') { tone({ type: 'sawtooth', f0: 520, f1: 260, dur: 0.6, gain: 0.1 * v, filter: ['bandpass', 1100, 3] }); tone({ type: 'sawtooth', f0: 380, f1: 300, dur: 0.4, gain: 0.08 * v, delay: 0.5, filter: ['bandpass', 900, 3] }); }
      else if (kind === 'cow') tone({ type: 'sawtooth', f0: 130, f1: 110, dur: 1.1, gain: 0.18 * v, filter: ['lowpass', 600] });
      else if (kind === 'sheep' || kind === 'goat') for (let k = 0; k < 4; k++) tone({ type: 'sawtooth', f0: kind === 'goat' ? 330 : 280, f1: 260, dur: 0.08, gain: 0.08 * v, delay: k * 0.09, filter: ['bandpass', 1200, 2] });
      else if (kind === 'chicken') for (let k = 0; k < 3; k++) tone({ type: 'square', f0: rr(700, 1000), f1: 600, dur: 0.06, gain: 0.05 * v, delay: k * 0.11, filter: ['bandpass', 1500, 3] });
      else if (kind === 'boar') burst({ buf: brown, type: 'bandpass', f: 300, q: 2, dur: 0.4, gain: 0.3 * v });
      else if (kind === 'deer' || kind === 'fox') tone({ type: 'sawtooth', f0: 700, f1: 400, dur: 0.25, gain: 0.08 * v, filter: ['bandpass', 1400, 3] });
      else if (kind === 'camel') tone({ type: 'sawtooth', f0: 160, f1: 90, dur: 0.8, gain: 0.14 * v, filter: ['lowpass', 500] });
      else burst({ type: 'bandpass', f: 1200, dur: 0.1, gain: 0.1 * v });
    },
    craft() { [0, 0.14, 0.28].forEach((d) => { burst({ type: 'bandpass', f: 1500, q: 2, dur: 0.04, gain: 0.35, delay: d }); tone({ type: 'triangle', f0: 600, dur: 0.05, gain: 0.08, delay: d }); }); tone({ type: 'triangle', f0: 880, f1: 1320, dur: 0.2, gain: 0.1, delay: 0.45 }); },
    build() { for (let k = 0; k < 4; k++) { burst({ buf: brown, type: 'lowpass', f: 700, dur: 0.07, gain: 0.5, delay: k * 0.11 }); burst({ type: 'bandpass', f: 1300, q: 1.5, dur: 0.04, gain: 0.3, delay: k * 0.11 }); } },
    door() { burst({ type: 'bandpass', f: 900, q: 1.2, dur: 0.06, gain: 0.3 }); tone({ type: 'square', f0: 220, dur: 0.04, gain: 0.05, filter: ['lowpass', 600] }); },
    engineStart() { tone({ type: 'sawtooth', f0: 30, f1: 64, dur: 0.6, gain: 0.16, filter: ['lowpass', 500] }); burst({ buf: brown, type: 'lowpass', f: 400, dur: 0.5, gain: 0.2 }); },
    engine(onE, rpm = 0, thr = 0, kind = 'car') {
      if (!ok()) return;
      if (!onE || kind === 'raft' || kind === 'horse') { if (eng) { const e = eng; eng = null; e.g.gain.setTargetAtTime(0, ctx.currentTime, 0.12); setTimeout(() => { try { e.o1.stop(); e.o2.stop(); e.n.stop(); } catch (_) {} }, 900); } return; }
      if (!eng || eng.kind !== kind) { if (eng) this.engine(false); eng = engineNode(kind); }
      const t = ctx.currentTime, base = kind === 'bike' ? 52 : kind === 'boat' ? 62 : 36, top = kind === 'bike' ? 230 : 150, f0 = base + (top - base) * rpm;
      eng.o1.frequency.setTargetAtTime(f0, t, 0.05); eng.o2.frequency.setTargetAtTime(f0 * 0.5, t, 0.05);
      eng.f.frequency.setTargetAtTime(380 + rpm * 1500 + Math.max(0, thr) * 400, t, 0.08); eng.nf.frequency.setTargetAtTime(200 + rpm * 700, t, 0.1);
      eng.g.gain.setTargetAtTime(0.07 + rpm * 0.1 + Math.max(0, thr) * 0.05, t, 0.08);
    },
    trainHorn(d) { const v = 1 / (1 + (d || 0) / 160); if (v < 0.03) return; caption('صافرة القطار', 0); for (const f of [233, 294, 349]) tone({ type: 'sawtooth', f0: f, dur: 1.5, gain: 0.045 * v, attack: 0.06, filter: ['lowpass', 1100] }); },
    horn(d) { const v = D(d * 0.5); if (d > 3) caption('بوق سيارة', 0); tone({ type: 'square', f0: 392, dur: 0.35, gain: 0.08 * v, filter: ['lowpass', 1400] }); tone({ type: 'square', f0: 494, dur: 0.35, gain: 0.07 * v, filter: ['lowpass', 1400] }); },
    crash(imp, d) { const v = Math.min(1, imp / 20) * D(d); burst({ buf: brown, type: 'lowpass', f: 420, dur: 0.5, gain: 0.9 * v }); burst({ type: 'bandpass', f: 1800, q: 0.7, dur: 0.25, gain: 0.5 * v }); for (let k = 0; k < 3; k++) tone({ type: 'square', f0: rr(300, 900), f1: rr(150, 400), dur: 0.15, gain: 0.06 * v, delay: k * 0.05, filter: ['bandpass', 1200, 3] }); },
    thud() { burst({ buf: brown, type: 'lowpass', f: 300, dur: 0.18, gain: 0.6 }); tone({ f0: 90, f1: 45, dur: 0.15, gain: 0.5 }); },
    splash(k = 1) { burst({ type: 'highpass', f: 900, dur: 0.25, gain: 0.3 * k }); burst({ buf: brown, type: 'lowpass', f: 600, dur: 0.3, gain: 0.22 * k }); },
    explosion(d = 0) { if (!ok()) return; const v = D(d * 0.25); caption('انفجار', 0); burst({ buf: brown, type: 'lowpass', f: 160, dur: 2.2, gain: 1.0 * v, attack: 0.005 }); burst({ type: 'lowpass', f: 1200, dur: 0.35, gain: 0.8 * v }); tone({ f0: 70, f1: 28, dur: 0.5, gain: 0.9 * v }); burst({ type: 'highpass', f: 2500, dur: 0.9, gain: 0.08 * v, delay: 0.25 + d / 340 }); },
    thunder() { if (!ok()) return; const v = 0.4 + rand() * 0.5; caption('رعد', 0); burst({ buf: brown, type: 'lowpass', f: 120, dur: 3.5, gain: 0.9 * v, attack: 0.08 }); burst({ buf: brown, type: 'lowpass', f: 400, dur: 1.2, gain: 0.5 * v, delay: 0.05 }); for (let k = 0; k < 4; k++) burst({ buf: brown, type: 'lowpass', f: 200, dur: 0.8, gain: 0.4 * v, delay: 0.4 + k * rr(0.3, 0.6) }); },
  };
})();
