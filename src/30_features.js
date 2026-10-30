/* ═════════ what only some maps have: the volcano's smoke and heat, the fog over the chart that lifts as you explore (and from
   the watchtowers), trains on the railway and carts in the mine, and weather that follows the land you stand on ═════════ */

/* ── the volcano: a column of smoke, a red glow at night, a rumble, and lava that burns ── */
const VOLCANO = (() => {
  const V = { on: false, x: 0, z: 0, top: 0, puffs: [], light: null, rumbleT: 8, burnT: 0, warned: false };
  function smokeTex() {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); if (!g) return null;
    for (let k = 0; k < 26; k++) {
      const x = 64 + (Math.random() - 0.5) * 50, y = 64 + (Math.random() - 0.5) * 50, r = 18 + Math.random() * 30, gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    }
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
  }
  V.init = () => {
    const v = WORLD.data.extras && WORLD.data.extras.volcano; if (!v) return;
    V.on = true; V.x = v.x; V.z = v.z; V.r = v.r || 500; V.top = terrainAt(v.x, v.z);
    const tex = smokeTex();
    for (let i = 0; i < 24; i++) {
      // the scene's fog is packed for the custom shaders (near = density): a stock sprite would drown in it, so the haze is mixed in by hand
      const m = new THREE.SpriteMaterial({ map: tex, color: 0x4a4644, transparent: true, depthWrite: false, opacity: 0, fog: false });
      const sp = new THREE.Sprite(m); sp.visible = false; scene.add(sp);
      V.puffs.push({ sp, t: i / 24, a: Math.random() * TAU, s: 0.7 + Math.random() * 0.6 });
    }
    V.light = new THREE.PointLight(C(0xff5a1a), 0, 2600, 1.6); V.light.position.set(v.x, V.top + 60, v.z); scene.add(V.light);
  };
  V.update = (dt) => {
    if (!V.on) return;
    const cp = camera.position, d = Math.hypot(cp.x - V.x, cp.z - V.z), seen = d < camera.far + 7000;
    const wx = Math.cos(T * 0.02) * 0.6 + 1, wz = Math.sin(T * 0.017) * 0.4 + 0.3;
    for (const p of V.puffs) {
      p.t += dt / 140 * p.s; if (p.t > 1) { p.t -= 1; p.a = Math.random() * TAU; }
      const t = p.t, h = t * 1300, spread = 60 + t * 420;
      p.sp.visible = seen;
      if (!seen) continue;
      // a column seen from beyond the far plane is drawn nearer and smaller: same place on screen, same size to the eye
      const px = V.x + Math.cos(p.a) * spread * 0.3 + wx * h * 0.55 - cp.x, py = V.top + 30 + h - cp.y, pz = V.z + Math.sin(p.a) * spread * 0.3 + wz * h * 0.55 - cp.z;
      const dd = Math.hypot(px, py, pz), k = Math.min(1, camera.far * 0.9 / dd), size = (220 + t * 1150) * k;
      p.sp.position.set(cp.x + px * k, cp.y + py * k, cp.z + pz * k); p.sp.scale.set(size, size, 1);
      const glow = ENV.night * smooth(0.35, 0, t);
      const haze = Math.min(0.8, 1 - Math.exp(-FOG.density * dd * 0.35));
      p.sp.material.color.setRGB(0.24 + glow * 0.5, 0.22 + glow * 0.12, 0.21 + glow * 0.02).lerp(scene.fog.color, haze);
      p.sp.material.opacity = smooth(0, 0.08, t) * (1 - smooth(0.6, 1, t)) * 0.85;
    }
    V.light.intensity = seen ? (0.5 + ENV.night * 3.5) * (0.8 + 0.2 * Math.sin(T * 1.7)) : 0;
    // the mountain rumbles when you are near
    if (started && d < 4000 && (V.rumbleT -= dt) <= 0) { V.rumbleT = 18 + Math.random() * 30; AUDIO.thunder(); cam.shake = Math.min(0.4, cam.shake + 0.12 * (1 - d / 4000)); }
  };
  return V;
})();
/* lava burns whoever stands in it; the heat warns you first */
function updateLava(dt) {
  if (!VOLCANO.on || !started || !player.alive || player.vehicle) return;
  const p = player.pos, onLava = classAt(p.x, p.z) === 9 && p.y - terrainAt(p.x, p.z) < 0.6;
  if (onLava) {
    VOLCANO.burnT += dt; damagePlayer(dt * 34, null, 'lava'); if (Math.random() < dt * 8) spawnPuff(p.x, p.y + 0.3, p.z, 0xff7a2a, 3, 2, 0.06, 3, 0.4);
    if (!VOLCANO.warned) { VOLCANO.warned = true; toast('حمم!', 'اخرج فوراً… الحمم تحرق'); }
  } else if (VOLCANO.burnT > 0) { VOLCANO.burnT = 0; VOLCANO.warned = false; }
}

/* ── fog over the chart: the continent is unknown until you have seen it; a watchtower shows you kilometres around ── */
const FOW = (() => {
  const F = { on: false, N: 256, mask: null, cv: null, g: null, dirty: false, towers: [], seen: new Set(), t: 0 };
  F.init = () => {
    F.on = !!(WORLD.data.extras && WORLD.data.extras.fog); if (!F.on) return;
    F.mask = new Uint8Array(F.N * F.N);
    F.cv = document.createElement('canvas'); F.cv.width = F.cv.height = F.N; F.g = F.cv.getContext('2d');
    F.towers = ((WORLD.data.extras && WORLD.data.extras.towers) || []).filter((t) => Array.isArray(t) && t.length === 2).map(([x, z], i) => ({ i, x, z, top: terrainAt(x, z) + 8.1 }));
    F.dirty = true;
  };
  const cell = () => MAP_W / F.N;
  F.reveal = (x, z, r) => {
    if (!F.on) return 0;
    const c = cell(), ci = (x + MAP_W / 2) / c, cj = (z + MAP_W / 2) / c, R = r / c; let n = 0;
    for (let j = Math.max(0, Math.floor(cj - R)); j <= Math.min(F.N - 1, Math.ceil(cj + R)); j++) for (let i = Math.max(0, Math.floor(ci - R)); i <= Math.min(F.N - 1, Math.ceil(ci + R)); i++) {
      const d = Math.hypot(i + 0.5 - ci, j + 0.5 - cj); if (d > R) continue;
      const v = d > R - 1 ? 160 : 255, k = j * F.N + i; if (F.mask[k] < v) { F.mask[k] = v; n++; }
    }
    if (n) F.dirty = true; return n;
  };
  F.canvas = () => {
    if (!F.on) return null;
    if (F.dirty) {
      F.dirty = false; const im = F.g.createImageData(F.N, F.N), d = im.data;
      for (let k = 0; k < F.N * F.N; k++) { d[k * 4] = 12; d[k * 4 + 1] = 18; d[k * 4 + 2] = 24; d[k * 4 + 3] = 235 - F.mask[k] * 0.92; }
      F.g.putImageData(im, 0, 0);
    }
    return F.cv;
  };
  // drawn over a chart whose world → screen mapping is given
  F.overlay = (ctx, P, k) => {
    const cv = F.canvas(); if (!cv) return;
    const [x0, y0] = P(-MAP_W / 2, -MAP_W / 2); ctx.save(); ctx.imageSmoothingEnabled = true; ctx.drawImage(cv, x0, y0, MAP_W * k, MAP_W * k); ctx.restore();
  };
  F.hidden = (x, z) => { if (!F.on) return false; const c = cell(), i = Math.floor((x + MAP_W / 2) / c), j = Math.floor((z + MAP_W / 2) / c); return i >= 0 && j >= 0 && i < F.N && j < F.N && F.mask[j * F.N + i] < 100; };
  F.update = (dt) => {
    if (!F.on || !started || !player.alive) return;
    if ((F.t -= dt) > 0) return; F.t = 0.5;
    const p = player.pos;
    if (F.reveal(p.x, p.z, player.vehicle ? 420 : 330)) { hudDirty = true; saveSoon(); }
    for (const t of F.towers) {
      if (F.seen.has(t.i) || Math.hypot(p.x - t.x, p.z - t.z) > 2.4 || p.y < t.top - 0.6) continue;
      F.seen.add(t.i); F.reveal(t.x, t.z, 3600); hudDirty = true; saveSoon(); AUDIO.treasure();
      toast('برج المراقبة', 'انكشفت الخريطة حولك لمسافة ثلاثة كيلومترات ونصف'); track('towers');
    }
  };
  // a compact record for the save: the mask as runs of seen/unseen cells
  F.pack = () => {
    if (!F.on) return null; const out = []; let cur = F.mask[0] > 100 ? 1 : 0, n = 0;
    for (let k = 0; k < F.mask.length; k++) { const v = F.mask[k] > 100 ? 1 : 0; if (v === cur) n++; else { out.push(n); cur = v; n = 1; } }
    out.push(n); return { s: F.mask[0] > 100 ? 1 : 0, r: out, t: [...F.seen] };
  };
  F.unpack = (o) => {
    if (!F.on || !o || !Array.isArray(o.r)) return; let k = 0, v = o.s ? 1 : 0;
    for (const n of o.r) { for (let q = 0; q < n && k < F.mask.length; q++) F.mask[k++] = v ? 255 : 0; v ^= 1; }
    for (const t of o.t || []) F.seen.add(t); F.dirty = true;
  };
  F.reset = () => { if (!F.on) return; F.mask.fill(0); F.seen.clear(); F.dirty = true; };
  return F;
})();

/* ── trains: a locomotive and its wagons run the line from end to end; a cart in the mine ── */
const TRAINS = [];
function trainCar(kind) {
  const b = new Builder();
  if (kind === 'loco') {
    b.box(0, 1.55, 0, 2.9, 2.3, 9.5, 0x2a4a6a, 0, K.metal); b.box(0, 3.0, -2.6, 2.9, 1.2, 3.8, 0x2a4a6a, 0, K.metal);
    b.box(0, 3.15, -2.6, 2.95, 0.55, 3.6, 0x1a1f24, 0, K.glass); b.box(0, 0.45, 0, 2.6, 0.5, 9.3, 0x1e1e20, 0, K.metal);
    b.box(0, 2.0, 4.8, 2.9, 1.0, 0.2, 0xd8b030, 0, K.metal); b.add(G.cyl8, M(0, 3.4, 2.4, 0, 0.35, 1.2, 0.35), 0x2a2a2a, K.metal);
    for (const z of [-3.4, -1.2, 1.2, 3.4]) for (const s of [-1, 1]) b.add(G.cyl14, M(s * 1.15, 0.5, z, 0, 0.45, 0.2, 0.45, 0, Math.PI / 2), 0x3a3a3a, K.metal);
  } else if (kind === 'cart') {
    b.box(0, 0.75, 0, 1.3, 0.8, 2.0, 0x6a5a45, 0, K.metal); b.box(0, 1.0, 0, 1.1, 0.4, 1.8, 0x3a3634, 0, K.stone);
    for (const z of [-0.6, 0.6]) for (const s of [-1, 1]) b.add(G.cyl14, M(s * 0.68, 0.3, z, 0, 0.26, 0.12, 0.26, 0, Math.PI / 2), 0x3a3a3a, K.metal);
  } else {
    const col = kind === 'tank' ? 0x8a8f94 : 0x7a3a2a;
    if (kind === 'tank') b.add(G.cyl14, M(0, 2.0, 0, 0, 1.3, 8.4, 1.3, Math.PI / 2), col, K.metal); else b.box(0, 2.0, 0, 2.9, 2.6, 9.2, col, 0, K.metal);
    b.box(0, 0.5, 0, 2.6, 0.5, 9.3, 0x1e1e20, 0, K.metal);
    for (const z of [-3.4, 3.4]) for (const s of [-1, 1]) b.add(G.cyl14, M(s * 1.15, 0.5, z, 0, 0.45, 0.2, 0.45, 0, Math.PI / 2), 0x3a3a3a, K.metal);
  }
  const m = b.mesh(UBER, QUALITY.shadows); m.matrixAutoUpdate = true; scene.add(m); return m;
}
function initTrains() {
  for (const r of WORLD.data.roads || []) {
    if (!r.train && !r.cart) continue;
    const R = ROADS.find((q) => q.name === r.name); if (!R || R.total < 40) continue;
    const kinds = r.train ? ['loco', 'box', 'tank', 'box'] : ['cart', 'cart'];
    // each car is a row of round colliders along its length (a box would not turn with the line)
    const cars = kinds.map((k) => {
      const len = k === 'cart' ? 2.4 : 10.2, offs = k === 'cart' ? [0] : [-3.4, 0, 3.4], r0 = k === 'cart' ? 0.85 : 1.5;
      return { k, m: trainCar(k), len, offs, cols: offs.map(() => addCollider({ t: 'c', x: 0, z: 0, r: r0 })) };
    });
    const tr = { R, cars, s: 20 + cars.reduce((a, c) => a + c.len + 0.4, 0), dir: 1, v: 0, vmax: r.train ? 17 : 3.5, wait: 10, cart: !!r.cart, veh: null, sv: 0 };
    TRAINS.push(tr);
    // the locomotive can be driven: stand by its cab and climb in
    if (!r.cart && typeof VSPEC !== 'undefined' && VSPEC.train) {
      const m = cars[0].m;
      tr.veh = { kind: 'train', spec: VSPEC.train, root: m, wheels: [], fork: null, lamp: null, tail: null, siren: null, pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, speed: 0, steer: 0, vy: 0, pitch: 0, roll: 0,
        air: false, rpm: 0, gear: 1, rec: null, cols: [], lastYaw: 0, fxT: 0, brake: false, hp: 100, ai: null, sirenOn: false, settled: false, train: tr };
      VEHICLES.push(tr.veh);
    }
  }
}
/* the driver's hand on the throttle: W pulls along the line, S backs the train, the jump key brakes; the ends of the line stop it */
function railVehicle(v, dt, driven) {
  const tr = v.train, m = tr.cars[0].m;
  if (driven) {
    const thr = player.alive ? input.mz : 0, brake = player.alive && input.jump;
    if (tr.wait > 0 || tr.ai !== false) { tr.sv = tr.dir * tr.v; tr.wait = 0; tr.ai = false; }
    if (Math.abs(tr.sv) < 0.3 && Math.abs(thr) > 0.3 && T - (tr.hornT || -99) > 12) { tr.hornT = T; AUDIO.trainHorn(0); }
    if (brake) tr.sv -= Math.sign(tr.sv) * Math.min(Math.abs(tr.sv), 6 * dt);
    else if (Math.abs(thr) > 0.05) tr.sv = clamp(tr.sv + thr * (Math.sign(thr) === Math.sign(tr.sv) || Math.abs(tr.sv) < 0.3 ? 2.0 : 4.5) * dt, -9, 26 * upMul('engine'));
    else tr.sv -= Math.sign(tr.sv) * Math.min(Math.abs(tr.sv), 0.25 * dt);
    v.brake = brake;
    v.rpm = damp(v.rpm, 0.2 + Math.abs(tr.sv) / 26 * 0.7 + Math.max(0, Math.abs(thr)) * 0.1, 3, dt);
    AUDIO.engine(true, v.rpm, Math.abs(thr), 'car');
  }
  v.pos.copy(m.position); v.yaw = m.rotation.y; v.speed = tr.ai === false ? tr.sv : tr.dir * tr.v; v.gear = v.speed < -0.1 ? -1 : 1;
  v.vel.set(Math.sin(v.yaw) * v.speed, 0, Math.cos(v.yaw) * v.speed);
}
const _tp = new THREE.Vector3();
function railAt(R, s, out) {
  const L = R.len, n = L.length; s = clamp(s, 0, R.total);
  let lo = 0, hi = n - 1; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (L[mid] <= s) lo = mid; else hi = mid; }
  const a = R.pts[lo], b = R.pts[hi], t = (s - L[lo]) / ((L[hi] - L[lo]) || 1), x = lerp(a[0], b[0], t), z = lerp(a[1], b[1], t);
  const deck = R.bridge[lo] && R.bridge[hi];
  out.set(x, deck ? lerp(a[2], b[2], t) + 0.35 : terrainAt(x, z) + 0.12, z);
  return Math.atan2(b[0] - a[0], b[1] - a[1]);
}
function updateTrains(dt) {
  for (const tr of TRAINS) {
    const R = tr.R, gap = 0.4, total = tr.cars.reduce((a, c) => a + c.len + gap, 0), lo = 8 + total, hi = R.total - 8;
    const driven = tr.veh && player.vehicle === tr.veh;
    if (driven) {
      // the player drives: the speed is theirs; the buffers at the ends of the line stop the train
      tr.s += tr.sv * dt;
      if (tr.s > hi || tr.s < lo) { if (Math.abs(tr.sv) > 4) { AUDIO.crash(Math.abs(tr.sv), 0); cam.shake = Math.min(0.5, cam.shake + 0.25); } tr.s = clamp(tr.s, lo, hi); tr.sv = 0; }
    } else if (tr.ai === false) {
      // the driver got off: the train rolls to a stop, waits, and goes back to its timetable
      tr.sv -= Math.sign(tr.sv) * Math.min(Math.abs(tr.sv), 1.5 * dt); tr.s = clamp(tr.s + tr.sv * dt, lo, hi);
      if (Math.abs(tr.sv) < 0.05) { tr.ai = true; tr.v = 0; tr.dir = tr.s > (lo + hi) / 2 ? -1 : 1; tr.wait = 20; }
    } else if (tr.wait > 0) { tr.wait -= dt; tr.v = 0; if (tr.wait <= 0 && !tr.cart) AUDIO.trainHorn(Math.hypot(player.pos.x - tr.cars[0].m.position.x, player.pos.z - tr.cars[0].m.position.z)); }
    else {
      const end = tr.dir > 0 ? hi : lo, left = Math.abs(end - tr.s);
      tr.v = Math.min(tr.vmax, Math.max(1.2, Math.sqrt(2 * 0.6 * left)), tr.v + dt * 0.8);
      tr.s += tr.dir * tr.v * dt;
      if ((tr.dir > 0 && tr.s >= end) || (tr.dir < 0 && tr.s <= end)) { tr.s = end; tr.dir = -tr.dir; tr.wait = tr.cart ? 8 : 25; }
    }
    const spd = tr.ai === false ? Math.abs(tr.sv) : tr.v;
    // the cars follow one another along the line: the engine is always at the far end and pushes when it backs
    let s = tr.s; const near = Math.hypot(player.pos.x - tr.cars[0].m.position.x, player.pos.z - tr.cars[0].m.position.z) < 1600;
    for (const c of tr.cars) {
      const sc = s - c.len / 2, ry = railAt(R, sc, _tp);
      c.m.visible = near; c.m.position.copy(_tp); c.m.rotation.set(0, ry, 0);
      const fx = Math.sin(ry), fz = Math.cos(ry);
      c.offs.forEach((o, k) => { const col = c.cols[k]; col.off = !near || (driven && c === tr.cars[0]); moveCollider(col, _tp.x + fx * o, _tp.z + fz * o); col.y0 = _tp.y - 1; col.y1 = _tp.y + 3.4; });
      // a moving train is not something to stand in front of
      if (spd > 2 && started && player.alive && !player.vehicle && Math.abs(player.pos.y - _tp.y) < 2.5) {
        const dx = player.pos.x - _tp.x, dz = player.pos.z - _tp.z;
        if (Math.abs(dx * fx + dz * fz) < c.len / 2 + 0.5 && Math.abs(dx * fz - dz * fx) < (c.k === 'cart' ? 1.1 : 1.85)) damagePlayer(spd * 4, null, 'train');
      }
      s -= c.len + gap;
    }
  }
}

/* ── weather that follows the land: sandstorms over the desert, blizzards in the north, mist in the woods ── */
let climT = 0;
function updateRegionalClimate(dt) {
  const c = WORLD.data && WORLD.data.climate; if (!c || !c.regional) return;
  if ((climT -= dt) > 0) return; climT = 4;
  const p = started ? player.pos : LOBBY.on && LOBBY.spot ? LOBBY.spot : camera.position, b = biomeAt(p.x, p.z), t = tempAt(p.x, p.z);
  const want = t < 0.36 ? 'snow' : b === 7 ? 'desert' : b === 8 || b === 3 || b === 4 ? 'forest' : b === 0 ? 'water' : '';
  if (want === WEATHER.climate) return;
  WEATHER.climate = want;
  if ((WEATHER.state === 'sand' && want !== 'desert') || (WEATHER.state === 'blizzard' && want !== 'snow')) setWeather('fair');
}

function initFeatures() { try { VOLCANO.init(); } catch (e) { console.warn('volcano', e); } try { FOW.init(); } catch (e) { console.warn('fog', e); } try { initTrains(); } catch (e) { console.warn('trains', e); } }
function updateFeatures(dt) { updateLandforms(); VOLCANO.update(dt); updateLava(dt); FOW.update(dt); updateTrains(dt); updateRegionalClimate(dt); }
