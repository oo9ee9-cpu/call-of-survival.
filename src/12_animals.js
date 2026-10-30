/* ═════════ animals: horses you can ride, cows, deer and foxes, sheep, goats, boars, chickens and rabbits in herds, birds over the water ═════════ */
const ANIMALS = [];
TARGET_LISTS.push(() => ANIMALS);
const ASPEC = {
  horse: { ar: 'حصان', model: 'horse', hp: 120, speed: 2.2, run: 12, scale: 0.0106, len: 2.4, h: 1.7, r: 0.9, meat: ['raw_beef', 3], hide: 2, biomes: [11, 6, 3, 2], herd: [2, 5], flee: 14, ride: true },
  cow: { ar: 'بقرة', model: 'horse', hp: 160, speed: 1.0, run: 5, scale: 0.0102, sx: 1.3, sy: 0.88, len: 2.3, h: 1.5, r: 1.0, meat: ['raw_beef', 5], hide: 3, biomes: [6, 11], herd: [3, 7], flee: 6, tint: 0xf2eee6, spots: true, milk: true },
  deer: { ar: 'غزال', model: 'horse', hp: 70, speed: 1.6, run: 13, scale: 0.0072, sx: 0.78, len: 1.6, h: 1.2, r: 0.6, meat: ['raw_venison', 3], hide: 2, biomes: [3, 4, 11, 5], herd: [2, 5], flee: 30, tint: 0xb07850 },
  camel: { ar: 'جمل', model: 'horse', hp: 180, speed: 1.2, run: 8, scale: 0.0118, sx: 0.95, sy: 1.12, len: 2.6, h: 2.0, r: 1.0, meat: ['raw_camel', 5], hide: 3, biomes: [7], herd: [2, 4], flee: 10, tint: 0xd8b07a },
  fox: { ar: 'ثعلب', model: 'fox', hp: 40, speed: 1.4, run: 9, scale: 0.0085, len: 1.0, h: 0.55, r: 0.35, meat: ['raw_rabbit', 1], hide: 1, biomes: [3, 4, 11, 2], herd: [1, 1], flee: 25 },
  sheep: { ar: 'خروف', proc: 'sheep', hp: 50, speed: 0.8, run: 5, len: 1.2, h: 0.9, r: 0.5, meat: ['raw_mutton', 2], hide: 1, wool: 2, biomes: [11, 6, 2, 5], herd: [5, 12], flee: 9 },
  goat: { ar: 'ماعز', proc: 'goat', hp: 45, speed: 0.9, run: 6, len: 1.1, h: 0.85, r: 0.45, meat: ['raw_goat', 2], hide: 1, biomes: [2, 5, 7, 10], herd: [3, 8], flee: 10 },
  boar: { ar: 'خنزير بري', proc: 'boar', hp: 90, speed: 1.0, run: 7.5, len: 1.4, h: 0.85, r: 0.55, meat: ['raw_boar', 3], hide: 2, biomes: [3, 4, 8], herd: [1, 4], flee: 0, angry: true, dmg: 14 },
  chicken: { ar: 'دجاجة', proc: 'chicken', hp: 12, speed: 0.6, run: 3.5, len: 0.4, h: 0.4, r: 0.2, meat: ['raw_chicken', 1], feather: 2, biomes: [6], herd: [4, 9], flee: 5, village: true, egg: true },
  rabbit: { ar: 'أرنب', proc: 'rabbit', hp: 10, speed: 0.9, run: 8, len: 0.4, h: 0.3, r: 0.18, meat: ['raw_rabbit', 1], hide: 1, biomes: [11, 3, 6, 2, 4], herd: [1, 3], flee: 18, hop: true },
};
/* ── procedural herd animals: one instanced mesh per kind, legs and head swing in the vertex shader ── */
function procAnimalGeo(kind) {
  const b = new Builder(), P = [], L = [];       // per-vertex pivot and part id, filled as we add
  const add = (geo, m, color, part, pivot, kindMat = K.fabric) => { const before = b.pos.length / 3; b.add(geo, m, color, kindMat); for (let i = before; i < b.pos.length / 3; i++) { P.push(pivot[0], pivot[1], pivot[2]); L.push(part); } };
  const leg = (x, z, len, r, color, part) => add(G.cyl8, M(x, len / 2, z, 0, r, len, r), color, part, [x, len, z]);
  if (kind === 'sheep' || kind === 'goat') {
    const wool = kind === 'sheep' ? 0xe8e2d4 : 0x8a7058, skin = kind === 'sheep' ? 0x2a2420 : 0x6a5040, H = 0.5;
    add(G.sph, M(0, H + 0.2, 0, 0, 0.32, 0.26, 0.5), wool, 0, [0, 0, 0]);
    add(G.sph, M(0, H + 0.42, 0.52, 0, 0.11, 0.13, 0.17, -0.5), skin, 5, [0, H + 0.35, 0.38]);
    for (const s of [-1, 1]) add(G.box, M(s * 0.1, H + 0.5, 0.5, 0, 0.12, 0.04, 0.05, 0, s * 0.6), skin, 5, [0, H + 0.35, 0.38]);
    if (kind === 'goat') for (const s of [-1, 1]) add(G.cone, M(s * 0.05, H + 0.62, 0.45, 0, 0.025, 0.18, 0.025, -0.6), 0x5a5048, 5, [0, H + 0.35, 0.38]);
    leg(-0.14, 0.3, H, 0.045, skin, 1); leg(0.14, 0.3, H, 0.045, skin, 2); leg(-0.14, -0.3, H, 0.045, skin, 3); leg(0.14, -0.3, H, 0.045, skin, 4);
    add(G.sph, M(0, H + 0.28, -0.5, 0, 0.07, 0.07, 0.08), wool, 6, [0, H + 0.3, -0.48]);
  } else if (kind === 'boar') {
    const fur = 0x3a2e26, H = 0.42;
    add(G.sph, M(0, H + 0.24, 0, 0, 0.3, 0.32, 0.62), fur, 0, [0, 0, 0]);
    add(G.cone, M(0, H + 0.22, 0.72, 0, 0.17, 0.42, 0.17, Math.PI / 2 + 0.15), fur, 5, [0, H + 0.25, 0.5]);
    for (const s of [-1, 1]) add(G.cone, M(s * 0.08, H + 0.12, 0.84, 0, 0.018, 0.12, 0.018, -0.9), 0xe8e0c8, 5, [0, H + 0.25, 0.5]);
    for (const s of [-1, 1]) add(G.cone, M(s * 0.1, H + 0.42, 0.55, 0, 0.04, 0.12, 0.03), fur, 5, [0, H + 0.25, 0.5]);
    add(G.box, M(0, H + 0.5, -0.1, 0, 0.06, 0.08, 0.6), 0x1e1814, 0, [0, 0, 0]);
    leg(-0.15, 0.36, H, 0.05, 0x2a221c, 1); leg(0.15, 0.36, H, 0.05, 0x2a221c, 2); leg(-0.15, -0.36, H, 0.05, 0x2a221c, 3); leg(0.15, -0.36, H, 0.05, 0x2a221c, 4);
    add(G.cyl8, M(0, H + 0.3, -0.64, 0, 0.015, 0.2, 0.015, 0.8), fur, 6, [0, H + 0.35, -0.6]);
  } else if (kind === 'chicken') {
    const c = 0xe8e0d0, H = 0.16;
    add(G.sph, M(0, H + 0.14, 0, 0, 0.11, 0.12, 0.15), c, 0, [0, 0, 0]);
    add(G.sph, M(0, H + 0.3, 0.1, 0, 0.06, 0.07, 0.06), c, 5, [0, H + 0.22, 0.08]);
    add(G.cone, M(0, H + 0.3, 0.17, 0, 0.015, 0.05, 0.015, Math.PI / 2), 0xe8a030, 5, [0, H + 0.22, 0.08]);
    add(G.box, M(0, H + 0.37, 0.1, 0, 0.015, 0.05, 0.05), 0xc8202a, 5, [0, H + 0.22, 0.08]);
    add(G.box, M(0, H + 0.2, -0.16, 0, 0.12, 0.14, 0.06, 0.5), c, 6, [0, H + 0.18, -0.12]);
    leg(-0.04, 0, H, 0.012, 0xe8a030, 1); leg(0.04, 0, H, 0.012, 0xe8a030, 4);
  } else if (kind === 'rabbit') {
    const c = 0x9a8268, H = 0.08;
    add(G.sph, M(0, H + 0.12, 0, 0, 0.1, 0.11, 0.17), c, 0, [0, 0, 0]);
    add(G.sph, M(0, H + 0.2, 0.15, 0, 0.065, 0.07, 0.08), c, 5, [0, H + 0.15, 0.1]);
    for (const s of [-1, 1]) add(G.box, M(s * 0.03, H + 0.33, 0.12, 0, 0.025, 0.14, 0.04, -0.2), c, 5, [0, H + 0.15, 0.1]);
    add(G.sph, M(0, H + 0.14, -0.17, 0, 0.04, 0.04, 0.04), 0xf0ece4, 6, [0, H + 0.14, -0.15]);
    leg(-0.05, 0.08, H, 0.02, c, 1); leg(0.05, 0.08, H, 0.02, c, 2); leg(-0.06, -0.08, H + 0.02, 0.03, c, 3); leg(0.06, -0.08, H + 0.02, 0.03, c, 4);
  }
  const g = b.geometry();
  g.setAttribute('aPivot', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aPart', new THREE.Float32BufferAttribute(L, 1));
  return g;
}
const PROC_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
PROC_MAT.customProgramCacheKey = () => 'procanimal';
PROC_MAT.onBeforeCompile = (sh) => {
  sh.uniforms.uWet = WET_U;
  sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
    attribute vec3 aPivot; attribute float aPart; attribute vec4 iAnim;
    vec3 rotX(vec3 p, vec3 c, float a){ p -= c; float s = sin(a), k = cos(a); return vec3(p.x, p.y * k - p.z * s, p.y * s + p.z * k) + c; }`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>
      float ph = iAnim.x, amp = iAnim.y, graze = iAnim.z, hop = iAnim.w;
      if (aPart > 0.5 && aPart < 4.5) { float off = (aPart < 1.5 || aPart > 3.5) ? 0.0 : 3.14159; transformed = rotX(transformed, aPivot, sin(ph + off + (hop > 0.5 ? (aPart > 2.5 ? 3.14159 : 0.0) : 0.0)) * amp * 0.7); }
      else if (aPart > 4.5 && aPart < 5.5) transformed = rotX(transformed, aPivot, graze * 0.9 + sin(ph * 0.5) * 0.06 * amp);
      else if (aPart > 5.5) transformed = rotX(transformed, aPivot, sin(ph * 2.0) * 0.3);
      transformed.y += abs(sin(ph)) * amp * (hop > 0.5 ? 0.12 : 0.025);`);
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uWet;').replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= 1.0 - uWet * 0.3;');
};
ENV_MATS.push(PROC_MAT);
const PROC = {};       // kind → { mesh, n, cap }
function procMesh(kind) {
  let p = PROC[kind]; if (p) return p;
  const g = procAnimalGeo(kind), cap = 60;
  g.setAttribute('iAnim', new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage));
  const m = new THREE.InstancedMesh(g, PROC_MAT, cap); m.count = 0; m.frustumCulled = false; m.castShadow = QUALITY.shadows; m.receiveShadow = true;
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m);
  p = PROC[kind] = { mesh: m, n: 0, cap }; return p;
}
/* ── model animals: each one its own clone and mixer ── */
const SPOT_MAT_CACHE = new Map();
function modelAnimal(kind) {
  const S = ASPEC[kind], src = ANIMAL_MODELS[S.model]; if (!src) return null;
  const obj = THREE.SkeletonUtils ? THREE.SkeletonUtils.clone(src.scene) : src.scene.clone();
  obj.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false; o.castShadow = QUALITY.shadows; o.receiveShadow = true;
    if (S.tint || S.spots) {
      let m = SPOT_MAT_CACHE.get(kind);
      if (!m) {
        m = o.material.clone(); m.color = C(S.tint || 0xffffff);
        if (S.spots) { m.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position;');
          sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
              varying vec3 vOP; float sh3(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
              float vn3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
                return mix(mix(mix(sh3(i), sh3(i + vec3(1, 0, 0)), f.x), mix(sh3(i + vec3(0, 1, 0)), sh3(i + vec3(1, 1, 0)), f.x), f.y),
                           mix(mix(sh3(i + vec3(0, 0, 1)), sh3(i + vec3(1, 0, 1)), f.x), mix(sh3(i + vec3(0, 1, 1)), sh3(i + vec3(1, 1, 1)), f.x), f.y), f.z); }`)
            .replace('#include <color_fragment>', `#include <color_fragment>
              { // a Holstein coat: the model's own shading kept as brightness, white hide with soft black patches
                float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
                vec3 q = vOP * 0.016; float n = vn3(q) * 0.65 + vn3(q * 2.3 + 3.1) * 0.35;
                vec3 coat = mix(vec3(0.84, 0.82, 0.78), vec3(0.035, 0.03, 0.028), smoothstep(0.5, 0.56, n));
                diffuseColor.rgb = coat * (0.42 + lum * 1.7); }`); };
          m.customProgramCacheKey = () => 'cowspots2'; }
        ENV_MATS.push(m); SPOT_MAT_CACHE.set(kind, m);
      }
      o.material = m;
    }
  });
  const inner = new THREE.Group(); inner.add(obj);
  inner.scale.set(S.scale * (S.sx || 1), S.scale * (S.sy || 1), S.scale);
  if (S.model === 'horse') inner.rotation.y = Math.PI;     // the horse model faces -z
  const root = new THREE.Group(); root.add(inner); scene.add(root);
  const mixer = new THREE.AnimationMixer(obj), acts = {};
  for (const c of src.clips) { const a = mixer.clipAction(c); acts[c.name] = a; }
  return { root, inner, obj, mixer, acts };
}
/* ── herds near you ── */
const HERDS = [];
let animalT = 0;
function animalBiomeOk(S, x, z) {
  const b = biomeAt(x, z), h = terrainAt(x, z);
  if (h < waterAt(x, z) + 0.3 || slopeAt(x, z) > 0.55 || !inPlay(x, z)) return false;
  if (S.village) return Math.min(...SETTLEMENTS.filter((s) => s.kind === 'village').map((s) => Math.hypot(s.x - x, s.z - z) - s.r)) < 60;
  return S.biomes.includes(b) && classAt(x, z) !== 2 && classAt(x, z) !== 7;
}
function spawnHerd(cx, cz) {
  const kinds = Object.keys(ASPEC);
  for (let tries = 0; tries < 12; tries++) {
    const a = rr(0, TAU), d = rr(90, 260), x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    const kind = pick(kinds), S = ASPEC[kind];
    if (S.model && !ANIMAL_MODELS[S.model]) continue;
    if (!animalBiomeOk(S, x, z)) continue;
    const n = S.herd[0] + Math.floor(rand() * (S.herd[1] - S.herd[0] + 1));
    if (ANIMALS.filter((q) => q.active).length + n > QUALITY.animals) return;
    const herd = { kind, x, z, members: [], t: 0 };
    for (let i = 0; i < n; i++) {
      const ax = x + rr(-8, 8), az = z + rr(-8, 8); if (!animalBiomeOk(S, ax, az) && !S.village) continue;
      const an = makeAnimal(kind, ax, az); if (an) { an.herd = herd; herd.members.push(an); }
    }
    if (herd.members.length) HERDS.push(herd);
    return;
  }
}
function makeAnimal(kind, x, z) {
  const S = ASPEC[kind];
  let an = ANIMALS.find((q) => !q.active && q.kind === kind);
  if (!an) {
    an = { kind, S, active: false, hits: [[new THREE.Vector3(), S.r * 0.9, false], [new THREE.Vector3(), S.r * 0.6, true]], scale: 1, radius: S.r * 0.5, blood: 0x6a1a14 };
    if (S.model) { const m = modelAnimal(kind); if (!m) return null; Object.assign(an, m); }
    an.hurt = (dmg, head, dir, from) => hurtAnimal(an, dmg, head, dir, from);
    ANIMALS.push(an);
  }
  Object.assign(an, { active: true, state: 'graze', x, z, y: terrainAt(x, z), yaw: rr(0, TAU), hp: S.hp, t: rr(0, 6), ph: rr(0, 6), speed: 0, tx: x, tz: z, wT: rr(1, 6), deadT: 0, scare: 0, rider: false, cd: 0 });
  if (an.root) { an.root.visible = true; const main = an.acts[Object.keys(an.acts)[0]]; for (const a of Object.values(an.acts)) a.stop(); an.main = main; if (main) { main.play(); main.timeScale = 0; } if (an.acts.Walk) { an.acts.Survey.play(); } }
  return an;
}
function hurtAnimal(an, dmg, head, dir, from) {
  if (an.state === 'dead') return;
  an.hp -= dmg * (head ? 1.8 : 1); an.scare = 8; an.state = an.S.angry ? 'charge' : 'flee';
  if (an.herd) for (const o of an.herd.members) if (o !== an && o.state !== 'dead') { o.scare = 6; o.state = o.S.angry ? 'charge' : 'flee'; }
  AUDIO.animal(an.kind, Math.hypot(an.x - player.pos.x, an.z - player.pos.z));
  if (an.hp <= 0) {
    an.state = 'dead'; an.deadT = 0; an.fall = Math.atan2(dir.x, dir.z);
    const S = an.S, items = [[S.meat[0], S.meat[1]]];
    if (S.hide) items.push(['hide', S.hide]); if (S.wool) items.push(['wool', S.wool]); if (S.feather) items.push(['feather', S.feather]); if (rand() < 0.5) items.push(['bone', 1 + Math.floor(rand() * 2)]);
    dropItems(an.x, groundAt(an.x, an.z, an.y + 1) + 0.02, an.z, items, { life: 240 });
    if (from === 'player') { STATS.hunted = (STATS.hunted || 0) + 1; track('hunted'); }
  }
}
const _am = new THREE.Matrix4(), _aq = new THREE.Quaternion(), _ae = new THREE.Euler(), _ap = new THREE.Vector3(), _as = new THREE.Vector3();
function updateAnimals(dt, t) {
  const p = player.pos;
  animalT -= dt;
  if (animalT <= 0) {
    animalT = 2.5;
    // retire far herds, spawn new ones around you
    for (const an of ANIMALS) if (an.active && !an.rider && Math.hypot(an.x - p.x, an.z - p.z) > 380) { an.active = false; if (an.root) an.root.visible = false; }
    for (let i = HERDS.length - 1; i >= 0; i--) if (!HERDS[i].members.some((m) => m.active)) HERDS.splice(i, 1);
    if (ANIMALS.filter((q) => q.active).length < QUALITY.animals * 0.7) spawnHerd(p.x, p.z);
  }
  for (const k in PROC) PROC[k].n = 0;
  for (const an of ANIMALS) {
    if (!an.active) continue;
    const S = an.S;
    if (an.rider) continue;            // a ridden horse is moved by the vehicle code
    if (an.state === 'dead') {
      an.deadT += dt;
      if (an.deadT > 40) { an.active = false; if (an.root) an.root.visible = false; continue; }
      drawAnimal(an, dt, 0, smooth(0, 0.6, an.deadT));
      continue;
    }
    const dx = an.x - p.x, dz = an.z - p.z, d = Math.hypot(dx, dz);
    // senses: a running player, a gunshot, a car
    const noisy = player.sprinting || (player.vehicle && Math.abs(player.vehicle.speed) > 5) || T - NOISE.t < 1.2;
    if (S.flee && player.alive && d < (noisy ? S.flee * 1.8 : S.flee) && an.state !== 'flee' && !(player.vehicle && player.vehicle.horse === an)) { an.state = S.angry ? 'charge' : 'flee'; an.scare = 6; }
    if (S.angry && d < 8 && player.alive && an.state !== 'charge' && rand() < dt * 0.5) { an.state = 'charge'; an.scare = 8; }
    an.scare -= dt;
    let gx = 0, gz = 0, spd = 0;
    if (an.state === 'flee') { gx = dx; gz = dz; spd = S.run; if (an.scare <= 0 && d > S.flee * 2) an.state = 'graze'; }
    else if (an.state === 'charge') {
      gx = -dx; gz = -dz; spd = S.run * 0.9;
      if (d < S.r + 0.9 && player.alive && !player.vehicle) { an.cd -= dt; if (an.cd <= 0) { an.cd = 1.2; damagePlayer(S.dmg || 10, an, 'bite'); } spd = 0; }
      if (an.scare <= 0 || d > 40) an.state = 'graze';
    } else {
      an.wT -= dt;
      if (an.wT <= 0) {
        an.wT = rr(3, 10);
        if (rand() < 0.45) { an.state = 'walk'; const hx = an.herd ? an.herd.x : an.x, hz = an.herd ? an.herd.z : an.z; an.tx = hx + rr(-14, 14); an.tz = hz + rr(-14, 14); }
        else an.state = 'graze';
        if (an.herd && rand() < 0.2) { an.herd.x += rr(-10, 10); an.herd.z += rr(-10, 10); }
      }
      if (an.state === 'walk') { gx = an.tx - an.x; gz = an.tz - an.z; spd = Math.hypot(gx, gz) > 1 ? S.speed : 0; if (!spd) an.state = 'graze'; }
    }
    if (spd > 0) {
      const gl = Math.hypot(gx, gz) || 1, nx = an.x + gx / gl * spd * dt, nz = an.z + gz / gl * spd * dt, h = terrainAt(nx, nz);
      if (h > waterAt(nx, nz) - 0.2 && slopeAt(nx, nz) < 0.75 && inPlay(nx, nz)) { an.x = nx; an.z = nz; } else { an.state = 'graze'; an.wT = 0.5; }
      resolveCollision(an, S.r * 0.6);
      an.yaw = angLerp(an.yaw, Math.atan2(gx, gz), 1 - Math.exp(-dt * 6));
    }
    an.speed = damp(an.speed, spd, 5, dt);
    an.y = damp(an.y, groundAt(an.x, an.z, an.y + 0.5), 10, dt);
    if (d < 160) drawAnimal(an, dt, an.speed, 0);
    else if (an.root) an.root.visible = false;
    an.hits[0][0].set(an.x, an.y + S.h * 0.55, an.z); an.hits[1][0].set(an.x + Math.sin(an.yaw) * S.len * 0.45, an.y + S.h * 0.8, an.z + Math.cos(an.yaw) * S.len * 0.45);
  }
  for (const k in PROC) { const P2 = PROC[k]; P2.mesh.count = P2.n; P2.mesh.instanceMatrix.needsUpdate = true; P2.mesh.geometry.attributes.iAnim.needsUpdate = true; }
}
function drawAnimal(an, dt, spd, dead) {
  const S = an.S;
  an.ph += dt * (1.5 + spd * (S.hop ? 3.2 : 2.6));
  if (S.proc) {
    const P2 = procMesh(S.proc); if (P2.n >= P2.cap) return;
    _ae.set(0, an.yaw, dead * 1.45, 'YXZ'); _aq.setFromEuler(_ae);
    _am.compose(_ap.set(an.x, an.y + dead * S.h * 0.3, an.z), _aq, _as.setScalar(1));
    P2.mesh.setMatrixAt(P2.n, _am);
    const A = P2.mesh.geometry.attributes.iAnim.array, k = P2.n * 4;
    A[k] = an.ph; A[k + 1] = dead ? 0 : clamp(spd / Math.max(1, S.run) * 1.6, 0, 1); A[k + 2] = an.state === 'graze' && !dead ? 0.8 : 0; A[k + 3] = S.hop ? 1 : 0;
    P2.n++;
    return;
  }
  an.root.visible = true;
  an.root.position.set(an.x, an.y + (S.model === 'fox' ? 0 : 0), an.z); an.root.rotation.set(0, an.yaw, dead * 1.5, 'YXZ');
  if (S.model === 'fox') {
    const w = clamp(spd / S.speed, 0, 1), r = clamp((spd - S.speed) / (S.run - S.speed), 0, 1);
    if (an.acts.Survey) an.acts.Survey.setEffectiveWeight(1 - w);
    if (an.acts.Walk) { an.acts.Walk.play(); an.acts.Walk.setEffectiveWeight(w * (1 - r)); }
    if (an.acts.Run) { an.acts.Run.play(); an.acts.Run.setEffectiveWeight(r); }
    an.mixer.update(dead ? 0 : dt);
  } else if (an.main) {
    an.main.timeScale = dead ? 0 : spd > 0.2 ? clamp(spd / 6, 0.25, 1.6) : 0;
    if (spd <= 0.2 && !dead) an.main.time = 0.12;     // a standing pose from the gallop
    an.mixer.update(dt);
  }
}
/* ── birds: flamingos over the lakes and the swamp, storks over the farms, parrots on the palm island, gulls on the coast ── */
const BIRDS = [];
function initBirds() {
  const spots = [];
  for (const L of WORLD.data.lakes) spots.push(['flamingo', L.x, L.z, Math.min(L.rx, 150), L.level + 25]);
  for (const s of WORLD.data.settlements) {
    if (s.kind === 'village' && (s.id === 'farm' || s.id === 'resort')) spots.push(['stork', s.x, s.z, 160, terrainAt(s.x, s.z) + 40]);
    if (s.id === 'tropic') spots.push(['parrot', s.x, s.z, 120, terrainAt(s.x, s.z) + 18]);
    if (s.id === 'city' || s.id === 'fisher') spots.push(['stork', s.x, s.z - 80, 200, 35]);
  }
  if (MAP_ID === 'island') spots.push(['flamingo', 350, 2300, 220, 30]);
  for (const b of (WORLD.data.extras && WORLD.data.extras.birds) || []) if (Array.isArray(b) && b.length === 5) spots.push(b);
  for (const [kind, x, z, r, y] of spots) {
    const src = ANIMAL_MODELS[kind]; if (!src) continue;
    for (let i = 0; i < (kind === 'flamingo' ? 4 : 3); i++) {
      const obj = src.scene.clone(); obj.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
      const root = new THREE.Group(), inner = new THREE.Group(); inner.add(obj); inner.scale.setScalar(kind === 'parrot' ? 0.012 : 0.02); inner.rotation.y = Math.PI; root.add(inner); root.visible = false; scene.add(root);
      const mixer = new THREE.AnimationMixer(obj); const a = mixer.clipAction(src.clips[0]); a.play(); a.time = rand() * 2; a.timeScale = rr(0.8, 1.2);
      BIRDS.push({ kind, root, mixer, cx: x, cz: z, r: r * rr(0.4, 1), y: y + rr(-5, 10), a: rr(0, TAU), w: rr(0.06, 0.12) * (rand() < 0.5 ? 1 : -1), bob: rr(0, 6) });
    }
  }
}
function updateBirds(dt, t) {
  const p = camera.position;
  for (const b of BIRDS) {
    const d = Math.hypot(b.cx - p.x, b.cz - p.z);
    if (d > 900) { b.root.visible = false; continue; }
    b.a += b.w * dt * (60 / b.r);
    const x = b.cx + Math.cos(b.a) * b.r, z = b.cz + Math.sin(b.a) * b.r, y = b.y + Math.sin(t * 0.3 + b.bob) * 3;
    b.root.visible = true; b.root.position.set(x, y, z);
    b.root.rotation.set(0, Math.atan2(-Math.sin(b.a) * Math.sign(b.w), Math.cos(b.a) * Math.sign(b.w)), -Math.sign(b.w) * 0.25);
    if (d < 400) b.mixer.update(dt);
  }
}
