/* ═════════ survival: felling and chopping, breaking rock, digging for coal and buried treasure, fishing, eating, loot boxes, beds and the use button ═════════ */
const HARV = { name: '', frac: 0, t: 0 };
const REGROW_TREE = 1800, REGROW_ROCK = 1500, REGROW_BUSH = 600, REGROW_LOOT = 1500, REGROW_CROP = 900;
const vegDirty = () => { vegT = 0; vegLX = 1e9; };
const rocksDirty = () => { rockT = 0; rockLX = 1e9; };
const tierMul = () => { const it = ITEMS[player.toolItem]; return ((it && TIER_MUL[it.tier]) || 1) * (typeof upMul === 'function' ? upMul('harvest') : 1); };
const isItem = (pre) => typeof player.toolItem === 'string' && player.toolItem.startsWith(pre);

/* ── sparks for stone and steel ── */
const SPARKS = [], SP_MAX = 64;
const spMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.018, 0.018, 0.08), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 3, 1.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), SP_MAX);
spMesh.frustumCulled = false; spMesh.count = 0; scene.add(spMesh);
function spawnSparks(x, y, z, n = 7) { for (let i = 0; i < n && SPARKS.length < SP_MAX; i++) { const a = rr(0, TAU); SPARKS.push({ x, y, z, vx: Math.cos(a) * rr(1.5, 4.5), vy: rr(1, 4.5), vz: Math.sin(a) * rr(1.5, 4.5), t: 0, life: rr(0.16, 0.38) }); } }
const _jm = new THREE.Matrix4(), _jq = new THREE.Quaternion(), _jp = new THREE.Vector3(), _js = new THREE.Vector3(), _jd = new THREE.Vector3(), _jz = new THREE.Vector3(0, 0, 1), _hc = new THREE.Color();
function updateSparks(dt) {
  let n = 0;
  for (let i = SPARKS.length - 1; i >= 0; i--) {
    const s = SPARKS[i]; s.t += dt; if (s.t > s.life) { SPARKS.splice(i, 1); continue; }
    s.vy -= 14 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
    _jd.set(s.vx, s.vy, s.vz).normalize(); _jq.setFromUnitVectors(_jz, _jd); const k = 1 - s.t / s.life;
    spMesh.setMatrixAt(n++, _jm.compose(_jp.set(s.x, s.y, s.z), _jq, _js.set(k, k, k * 1.5)));
  }
  spMesh.count = n; spMesh.instanceMatrix.needsUpdate = true;
}

/* ── what is in front of the swing ── */
const LOGS = [];
function harvestTarget(reach) {
  const p = player.pos, fx = Math.sin(player.yaw), fz = Math.cos(player.yaw);
  let best = null, bd = 1e9;
  const consider = (kind, o, d, dx, dz, dy) => {
    if (d > reach || d >= bd || Math.abs(dy) > 2.4) return;
    const l = Math.hypot(dx, dz) || 1;
    if ((dx * fx + dz * fz) / l < 0.25 && d > 0.45) return;
    best = { kind, o }; bd = d;
  };
  treesNear(p.x, p.z, reach + 2.5, (t) => {
    if (t.fx) return;
    const va = VEG.species[t.id].variants[t.v], g = t.grow === undefined ? 1 : t.grow, r = t.bush ? 0.55 * t.s : Math.max(0.12, va.trunkR * t.s * g);
    const dx = t.x - p.x, dz = t.z - p.z; consider(t.bush ? 'bush' : 'tree', t, Math.hypot(dx, dz) - r, dx, dz, t.y - p.y);
  });
  rocksNear(p.x, p.z, reach + 2, (r) => {
    const dx = r.x - p.x, dz = r.z - p.z;
    if (r.kind === 'cliff') { consider('cliff', r, Math.hypot(dx, dz) - r.r * 0.72, dx, dz, 0); return; }
    const rad = r.r * (r.hp !== undefined && r.maxHp ? 0.55 + 0.45 * r.hp / r.maxHp : 1) * 0.8;
    consider(r.kind === 'stump' ? 'stump' : 'rock', r, Math.hypot(dx, dz) - rad, dx, dz, r.y + Math.min(r.h, 2) * 0.4 - p.y - 0.5);
  });
  for (const L of LOGS) {
    if (L.state !== 'down' || L.hp <= 0) continue;
    const len = L.H * L.frac * Math.sin(L.th) * 0.88, ex = L.F.x * len, ez = L.F.z * len, px = p.x - L.t.x, pz = p.z - L.t.z;
    const u = clamp((px * ex + pz * ez) / (len * len || 1), 0, 1), qx = L.t.x + ex * u, qz = L.t.z + ez * u, dx = qx - p.x, dz = qz - p.z;
    consider('log', L, Math.hypot(dx, dz) - L.R, dx, dz, L.t.y - p.y);
  }
  return best;
}
const WOOD_DMG = { axe: 1, sword: 0.45, knife: 0.3, spear: 0.3, pickaxe: 0.4, hammer: 0.3, shovel: 0.3, hoe: 0.3, hand: 0.25, torch: 0.2, rod: 0.1, bow: 0.1 };
const ROCK_DMG = { pickaxe: 1, hammer: 0.5, shovel: 0.35, axe: 0.25, sword: 0.15 };
const TREE_EXTRA = { pine: ['resin', 0.25], spruce: ['resin', 0.25], cypress: ['resin', 0.15], acacia: ['resin', 0.12], olive: ['olive', 0.3], palm: ['dates', 0.22], willow: ['fiber', 0.25], oak: ['mushroom', 0.05], oak_m: ['mushroom', 0.05], birch: ['resin', 0.06], ash: ['resin', 0.06], dead: ['resin', 0.03] };
function gain(id, n) { if (n > 0) { const k = invAdd(id, n); if (k > 0 && (id === 'wood' || id === 'stone')) track(id, k); } }
function harvestHit(tool) {
  if (tool === 'hammer' && typeof hammerPick === 'function' && hammerPick()) return;
  const m = MELEE[tool] || MELEE.hand, tg = harvestTarget(m.reach + 0.45);
  if (!tg) { groundWork(tool); return; }
  const p = player.pos, mul = tierMul();
  if (tg.kind === 'tree' || tg.kind === 'bush') {
    const t = tg.o, info = SP_INFO[t.id], dx = t.x - p.x, dz = t.z - p.z, l = Math.hypot(dx, dz) || 1, va = VEG.species[t.id].variants[t.v];
    const r = t.bush ? 0.4 * t.s : Math.max(0.12, va.trunkR * t.s), hx = t.x - dx / l * r, hz = t.z - dz / l * r, hy = t.y + (t.bush ? 0.5 : 0.9);
    const dmg = t.bush ? 1 : (WOOD_DMG[tool] || 0.25) * (tool === 'axe' ? mul : 1);
    t.hp -= dmg;
    spawnPuff(hx, hy, hz, t.bush ? 0x5a7a3a : 0xd2ad7c, 6, 2.6, 0.05, -9, 0.7); if (!t.bush) spawnPuff(hx, hy, hz, 0x4e3a2a, 3, 2, 0.04, -9, 0.6);
    AUDIO.chop(tool === 'axe' || tool === 'sword' ? 1 : 0.55); cam.shake = Math.min(0.18, cam.shake + 0.05);
    if (t.bush) {
      gain('fiber', 1 + Math.floor(rand() * 2));
      const b = biomeAt(t.x, t.z);
      if (rand() < (b === 3 || b === 11 || b === 4 ? 0.35 : 0.15)) gain('berries', 1 + Math.floor(rand() * 2));
      if (rand() < 0.15) gain('herbs', 1);
      HARV.name = info.ar; HARV.frac = Math.max(0, t.hp / info.hp); HARV.t = 1.6;
      if (t.hp <= 0) { FELLED.set(t.key, T_GAME + REGROW_BUSH); HOOK.felled(t.key, REGROW_BUSH); vegDirty(); spawnPuff(t.x, t.y + 0.5, t.z, 0x55692f, 12, 2.6, 0.06, -3, 1.2); grassDirtyArea(t.x, t.z, 2); }
      return;
    }
    const wood = tool === 'axe' ? Math.max(1, Math.round(info.wood * 0.5 * mul)) : rand() < 0.5 ? 1 : 0;
    if (t.id === 'cactus') gain('cactus_pulp', 1); else gain('wood', wood);
    const ex = TREE_EXTRA[t.id]; if (ex && rand() < ex[1]) gain(ex[0], 1);
    HARV.name = info.ar; HARV.frac = Math.max(0, t.hp / info.hp); HARV.t = 1.8;
    notchTree(t, p.x, p.z, 1 - HARV.frac);
    if (t.hp <= 0.001) fellTree(t, p.x, p.z);
    else if (tool === 'hand' && rand() < 0.3) toast('الفأس أسرع بكثير', 'اختره من الشريط في الأسفل');
  } else if (tg.kind === 'rock' || tg.kind === 'cliff') {
    const r = tg.o, dx = r.x - p.x, dz = r.z - p.z, l = Math.hypot(dx, dz) || 1, rad = tg.kind === 'cliff' ? r.r * 0.7 : r.r * 0.7;
    const hx = r.x - dx / l * rad, hz = r.z - dz / l * rad, hy = Math.max(p.y + 0.8, tg.kind === 'cliff' ? p.y + 1 : r.y + Math.min(r.h, 1.6) * 0.5);
    if (tool === 'hand') { AUDIO.punch(); HARV.name = 'صخرة'; HARV.frac = r.hp !== undefined ? r.hp / r.maxHp : 1; HARV.t = 1.4; toast('تحتاج المعول لتكسير الصخر', 'اختر المعول من الشريط في الأسفل'); damagePlayer(2, null, 'punch'); return; }
    const k = (ROCK_DMG[tool] || 0.2) * (tool === 'pickaxe' ? mul : 1);
    spawnSparks(hx, hy, hz, tool === 'pickaxe' ? 8 : 5); spawnPuff(hx, hy, hz, 0x9a9184, 5, 2.4, 0.06, -9, 0.6);
    AUDIO.mine(tool === 'pickaxe' ? 1 : 0.6); cam.shake = Math.min(0.2, cam.shake + 0.06);
    const pick = tool === 'pickaxe', high = terrainAt(r.x, r.z) > 160 || biomeAt(r.x, r.z) === 5;
    gain('stone', pick ? Math.max(1, Math.round(1.4 * mul)) : rand() < 0.5 ? 1 : 0);
    if (pick && rand() < 0.1) gain('flint', 1);
    if (pick && rand() < (high ? 0.14 : 0.04)) gain('coal', 1);
    if (pick && r.ore && rand() < 0.55) gain(r.ore, 1);
    if (pick && tg.kind === 'cliff') { if (rand() < 0.06) gain('iron_ore', 1); if (rand() < 0.04) gain('copper_ore', 1); if (rand() < 0.012) gain('gold_ore', 1); if (rand() < 0.006) gain(pick4(), 1); }
    if (tg.kind === 'cliff') { HARV.name = 'جرف صخري'; HARV.frac = 1; HARV.t = 1.2; if (!pick) toast('المعول يقتطع من الجرف', ''); return; }
    r.hp -= k; HARV.name = r.ore ? ITEMS[r.ore].name + ' في الصخر' : 'صخرة'; HARV.frac = Math.max(0, r.hp / r.maxHp); HARV.t = 1.8;
    if (r.hp <= 0.001) {
      RBROKEN.set(r.key, T_GAME + REGROW_ROCK); HOOK.rock(r.key, REGROW_ROCK); if (r.col) r.col.off = true; track('rocks');
      spawnPuff(r.x, r.y + r.h * 0.4, r.z, 0x8d8174, 16, 3.4, Math.min(0.5, r.r * 0.14), -10, 1.1); spawnPuff(r.x, r.y + 0.2, r.z, 0xb3a89a, 8, 1.6, 0.3, -1, 1.6);
      AUDIO.rockBreak(); gain('stone', Math.max(1, Math.round(r.r * 2.4)));
      if (r.ore) gain(r.ore, 1 + Math.floor(rand() * 2));
      if (rand() < 0.04) gain(pick4(), 1);
    }
    rocksDirty();
  } else if (tg.kind === 'stump') {
    const r = tg.o; if (r.maxHp === undefined) { r.maxHp = 4; r.hp = 4; }
    const dmg = (WOOD_DMG[tool] || 0.25) * (tool === 'axe' ? mul : 1); r.hp -= dmg;
    spawnPuff(r.x, r.y + 0.4, r.z, 0xd2ad7c, 6, 2.4, 0.05, -9, 0.7); AUDIO.chop(tool === 'axe' ? 1 : 0.5);
    gain('wood', tool === 'axe' ? 1 + Math.floor(rand() * 2) : rand() < 0.4 ? 1 : 0); if (rand() < 0.15) gain('resin', 1); if (rand() < 0.1) gain('mushroom', 1);
    HARV.name = 'جذع قديم'; HARV.frac = Math.max(0, r.hp / r.maxHp); HARV.t = 1.6;
    if (r.hp <= 0) { RBROKEN.set(r.key, T_GAME + REGROW_ROCK); HOOK.rock(r.key, REGROW_ROCK); if (r.col) r.col.off = true; AUDIO.logBreak(); rocksDirty(); }
  } else {
    const L = tg.o, dmg = (tool === 'axe' ? 1 : tool === 'sword' ? 0.5 : 0.4) * (tool === 'axe' ? mul : 1);
    L.hp -= dmg; AUDIO.chop(tool === 'axe' ? 1 : 0.6); cam.shake = Math.min(0.15, cam.shake + 0.04);
    const len = L.H * L.frac * 0.6, cx = L.t.x + L.F.x * len, cz = L.t.z + L.F.z * len;
    spawnPuff(cx, terrainAt(cx, cz) + 0.4, cz, 0xd2ad7c, 7, 2.6, 0.05, -9, 0.7);
    gain('wood', tool === 'axe' ? L.wood : 1);
    HARV.name = 'جذع مقطوع'; HARV.frac = Math.max(0, L.hp / L.maxHp); HARV.t = 1.8;
    L.frac = 0.25 + 0.75 * Math.max(0, L.hp / L.maxHp); L.holder.scale.y = L.s * L.frac;
    for (const c of L.cols) c.off = c.s > L.H * L.frac * 0.9;
    if (L.hp <= 0.001) removeLog(L, true);
  }
}
const pick4 = () => ['ruby', 'emerald', 'sapphire', 'amethyst'][Math.floor(rand() * 4)];

/* ── a notch grows where you chop, then the tree tips away from you, crashes down and lies as a log ── */
const NOTCH_MAT = new THREE.MeshStandardMaterial({ color: C(0xd6b183), roughness: 0.9, metalness: 0 });
const RINGS_TEX = canvasTex(128, 128, (g) => {
  const r = g.createRadialGradient(64, 64, 2, 64, 64, 64);
  r.addColorStop(0, '#b98a55'); r.addColorStop(0.8, '#d8b07c'); r.addColorStop(0.88, '#7a5a3c'); r.addColorStop(1, '#4a3826');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  for (let k = 3; k < 54; k += 2.5 + Math.random() * 3) { g.strokeStyle = `rgba(110,74,40,${0.25 + Math.random() * 0.3})`; g.lineWidth = 0.6 + Math.random() * 1.2; g.beginPath(); g.arc(64 + (Math.random() - 0.5) * 2, 64 + (Math.random() - 0.5) * 2, k, 0, TAU); g.stroke(); }
});
const CUT_MAT = new THREE.MeshStandardMaterial({ map: RINGS_TEX, roughness: 0.92, metalness: 0 });
ENV_MATS.push(CUT_MAT, NOTCH_MAT);
const NOTCH_GEO = new THREE.SphereGeometry(1, 10, 6), NOTCHES = new Map();
function notchTree(t, fromX, fromZ, frac) {
  let n = NOTCHES.get(t);
  if (!n) { n = new THREE.Mesh(NOTCH_GEO, NOTCH_MAT); n.receiveShadow = true; n.userData.a = Math.atan2(fromX - t.x, fromZ - t.z); scene.add(n); NOTCHES.set(t, n); }
  const va = VEG.species[t.id].variants[t.v], a = n.userData.a, r = Math.max(0.12, va.trunkR * t.s), k = 0.4 + frac * 0.8;
  n.position.set(t.x + Math.sin(a) * r * 0.74, t.y + 0.55, t.z + Math.cos(a) * r * 0.74); n.rotation.set(0, a, 0);
  n.scale.set(r * 0.95 * k, 0.07 + 0.11 * frac, r * 0.42 * k);
}
function dropNotch(t) { const n = NOTCHES.get(t); if (n) { scene.remove(n); NOTCHES.delete(t); } }
const STUMP_GEO = (() => { const b = new Builder(); b.add(new THREE.CylinderGeometry(0.92, 1, 1, 12, 1, true), M(0, 0.5, 0), 0x5a4532, MATID.wood); return b.geometry(); })();
const STUMP_TOP = new THREE.CircleGeometry(0.92, 14); STUMP_TOP.rotateX(-Math.PI / 2);
const STUMPS = new Map();
function stumpFor(t) {
  const va = VEG.species[t.id].variants[t.v], r = Math.max(0.12, va.trunkR * t.s) * 1.08, h = 0.45 + r * 0.6;
  const g = new THREE.Group(), side = new THREE.Mesh(STUMP_GEO, UBER), top = new THREE.Mesh(STUMP_TOP, CUT_MAT);
  side.castShadow = QUALITY.shadows; side.receiveShadow = top.receiveShadow = true; top.position.y = 1.0;
  g.add(side, top); g.position.set(t.x, t.y - 0.05, t.z); g.scale.set(r, h, r); g.rotation.y = t.rot; scene.add(g); return g;
}
let stumpT = 0;
function updateStumps(dt) {
  stumpT -= dt; if (stumpT > 0) return; stumpT = 1;
  const p = player.pos;
  for (const [key, g] of STUMPS) { const t = g.userData.t; if (!FELLED.has(key) || Math.hypot(t.x - p.x, t.z - p.z) > 110) { scene.remove(g); STUMPS.delete(key); } }
  for (const [key, until] of FELLED) {
    if (STUMPS.has(key) || until <= T_GAME) continue;
    const [ci, cj, k] = key.split(',').map(Number), c = VCELLS.get(vkey(ci, cj)); if (!c) continue;
    const t = c.trees[k]; if (!t || t.bush || t.id === 'cactus' || Math.hypot(t.x - p.x, t.z - p.z) > 90) continue;
    const g = stumpFor(t); g.userData.t = t; STUMPS.set(key, g);
  }
}
const _fellM = new THREE.Matrix4();
function treeMeshes(t) {
  const sp = VEG.species[t.id], va = sp.variants[t.v], L = va.lod0, out = [];
  const mk = (geo, mat, leaf) => {
    const m = new THREE.InstancedMesh(geo, mat, 1); m.setMatrixAt(0, _fellM.identity());
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(3), 3);
    m.castShadow = QUALITY.shadows; m.receiveShadow = true; m.frustumCulled = false; if (leaf && LEAF_DEPTH) m.customDepthMaterial = LEAF_DEPTH; return m;
  };
  if (L.single) { const m = mk(L.single, UBER, false); m.setColorAt(0, _hc.setRGB(1, 1, 1)); out.push(m); }
  else {
    const tr = mk(L.trunk, vmat('bark', BARK_LAYERS.indexOf(sp.bark)), false); tr.setColorAt(0, _hc.setRGB(0.9 + t.tint * 0.2, 0.9 + t.tint * 0.15, 0.9 + t.tint * 0.1)); out.push(tr);
    if (L.leaves) { const lv = mk(L.leaves, vmat('leaf', LEAF_LAYERS.indexOf(sp.leaf)), true); lv.setColorAt(0, tintOf(t, _hc)); lv.userData.leaf = true; out.push(lv); }
    if (L.twigs) { const tw = mk(L.twigs, vmat('leaf', LEAF_LAYERS.indexOf(sp.twig)), true); tw.setColorAt(0, tintOf(t, _hc)); tw.userData.leaf = true; out.push(tw); }
  }
  return out;
}
function fellTree(t, fromX, fromZ) {
  const va = VEG.species[t.id].variants[t.v], g0 = t.grow === undefined ? 1 : t.grow, s = t.s * g0;
  t.fx = true; FELLED.set(t.key, T_GAME + REGROW_TREE); HOOK.felled(t.key, REGROW_TREE); if (t.col) t.col.off = true; dropNotch(t); vegDirty();
  STATS.felled = (STATS.felled || 0) + 1; track('felled');
  if (t.id === 'cactus') { t.fx = false; spawnPuff(t.x, t.y + 1, t.z, 0x6a9a4a, 14, 2.8, 0.08, -6, 1); AUDIO.logBreak(); gain('cactus_pulp', 2); return; }
  const H = va.height * s, R = Math.max(0.15, va.trunkR * s);
  const g = new THREE.Group(), body = new THREE.Group(), holder = new THREE.Group();
  g.position.set(t.x, t.y, t.z); g.add(body); body.add(holder); holder.rotation.y = t.rot; holder.scale.setScalar(s);
  const parts = treeMeshes(t); for (const m of parts) holder.add(m);
  scene.add(g);
  const away = Math.atan2(t.x - fromX, t.z - fromZ);
  let fy = away + rr(-0.3, 0.3);
  for (const off of [0, 0.45, -0.45, 0.9, -0.9, 1.4, -1.4, 2.0, -2.0, 2.6, -2.6]) {      // fall where there is room: not into a house or up a cliff
    const a = away + off; let ok = true;
    for (let d = 1.2; d < H * 0.95 && ok; d += 1.1) {
      const px = t.x + Math.sin(a) * d, pz = t.z + Math.cos(a) * d;
      if (terrainAt(px, pz) - t.y > d * 0.9 + 0.5) ok = false;
      else CGRID.each(px - 0.5, pz - 0.5, px + 0.5, pz + 0.5, (c) => { if (!c.off && c.t === 'b' && Math.abs(c.x - px) < c.hx + 0.3 && Math.abs(c.z - pz) < c.hz + 0.3 && (c.y1 === undefined || c.y1 > t.y + 0.5)) { ok = false; return false; } });
    }
    if (ok) { fy = a + rr(-0.12, 0.12); break; }
  }
  const F = new THREE.Vector3(Math.sin(fy), 0, Math.cos(fy)), dh = terrainAt(t.x + F.x * H * 0.6, t.z + F.z * H * 0.6) - t.y;
  const info = SP_INFO[t.id];
  const L = { t, g, body, holder, parts, F, axis: new THREE.Vector3(F.z, 0, -F.x), H, s, R, lead: R * 1.15 + 0.08, th: 0.025, om: 0.12,
    thEnd: Math.acos(clamp((dh + 0.3 - R) / (H * 0.6), -0.85, 0.6)), state: 'fall', time: 0, downT: 0, hp: 4, maxHp: 4, wood: Math.max(2, info.wood), frac: 1, cols: [] };
  LOGS.push(L);
  HARV.name = info.ar + ' تسقط'; HARV.frac = 0; HARV.t = 2;
  AUDIO.treeCrack(Math.hypot(t.x - player.pos.x, t.z - player.pos.z));
}
function removeLog(L, chopped) {
  const i = LOGS.indexOf(L); if (i >= 0) LOGS.splice(i, 1);
  for (const c of L.cols) removeCollider(c);
  if (chopped) { for (let k = 0; k < 4; k++) { const d = L.H * L.frac * (k + 0.5) / 4.5, x = L.t.x + L.F.x * d, z = L.t.z + L.F.z * d; spawnPuff(x, terrainAt(x, z) + 0.3, z, 0xc79e6c, 5, 2.4, 0.07, -8, 0.8); } AUDIO.logBreak(); }
  scene.remove(L.g); L.t.fx = false; vegDirty();
}
function updateLogs(dt) {
  for (let i = LOGS.length - 1; i >= 0; i--) {
    const L = LOGS[i]; L.time += dt;
    if (L.state === 'fall' || L.state === 'settle') {
      L.om += (1.5 * 9.8 / Math.max(2.5, L.H) * Math.sin(L.th) + 0.3) * dt; L.th += L.om * dt;
      if (L.th >= L.thEnd) {
        L.th = L.thEnd;
        if (L.state === 'fall') {
          L.om = -L.om * 0.16; L.state = 'settle';
          const d = Math.hypot(L.t.x - player.pos.x, L.t.z - player.pos.z);
          AUDIO.treeFall(d); if (d < 26) cam.shake = Math.min(0.55, cam.shake + 0.3 * (1 - d / 26));
          for (let k = 1; k <= 6; k++) { const sd = L.H * k / 6.5 * Math.sin(L.th), x = L.t.x + L.F.x * sd, z = L.t.z + L.F.z * sd; spawnPuff(x, terrainAt(x, z) + 0.25, z, 0xb3a184, 4, 2.6, 0.24, -1.2, 1.6); }
          const cd = L.H * 0.7, cx = L.t.x + L.F.x * cd, cz = L.t.z + L.F.z * cd;
          spawnPuff(cx, terrainAt(cx, cz) + 1, cz, 0x55692f, 16, 3.8, 0.07, -2.5, 1.8);
          for (const Lst of TARGET_LISTS) for (const z of Lst()) if (z.active && z.state !== 'dead') {
            const px = z.x - L.t.x, pz = z.z - L.t.z, u = px * L.F.x + pz * L.F.z, w = Math.abs(px * L.F.z - pz * L.F.x);
            if (u > 0.5 && u < L.H && w < 1.2) hurtTarget(z, 300, false, L.F, 'tree');
          }
          { const px = player.pos.x - L.t.x, pz = player.pos.z - L.t.z, u = px * L.F.x + pz * L.F.z, w = Math.abs(px * L.F.z - pz * L.F.x); if (!player.vehicle && u > 0.8 && u < L.H * 0.9 && w < 0.9) damagePlayer(35, null, 'tree'); }
          grassDirtyArea(L.t.x + L.F.x * L.H * 0.5, L.t.z + L.F.z * L.H * 0.5, L.H * 0.5);
        } else {
          L.om = 0; L.state = 'down';
          for (let sd = 1.0; sd < L.H * 0.85; sd += 1.3) { const x = L.t.x + L.F.x * sd * Math.sin(L.th), z = L.t.z + L.F.z * sd * Math.sin(L.th); const c = addCollider({ t: 'c', x, z, r: L.R * 1.15, y1: terrainAt(x, z) + 0.75 }); c.s = sd; L.cols.push(c); }
        }
      }
      L.body.quaternion.setFromAxisAngle(L.axis, L.th);
      const sn = Math.sin(L.th); L.g.position.set(L.t.x + L.F.x * L.lead * sn, L.t.y + L.R * sn, L.t.z + L.F.z * L.lead * sn);
    } else {
      L.downT += dt;
      if (L.downT > 1.4 && L.downT < 3) {        // the crown breaks up: leaves shrink away and the bare log stays
        const k = 1 - (L.downT - 1.4) / 1.3;
        for (const m of L.parts) if (m.userData.leaf) { if (k <= 0) { if (m.visible) { m.visible = false; const cd = L.H * 0.7, cx = L.t.x + L.F.x * cd, cz = L.t.z + L.F.z * cd; spawnPuff(cx, terrainAt(cx, cz) + 0.6, cz, 0x4f6230, 10, 1.6, 0.06, -2, 1.4); } } else m.scale.setScalar(Math.max(0.01, k)); }
      }
      if (L.time > 600 || !FELLED.has(L.t.key)) removeLog(L, false);
    }
  }
}

/* ── digging: a shovel, a pickaxe or a sickle opens the ground; coal and ore, clay and sand, and here and there a buried chest ── */
const TREASURES = [], FOUND = new Set();
let MAPMARK = null;
function initTreasures() {
  const r = RNG(20261019), W = WORLD.data;
  const ok = (x, z) => inPlay(x, z) && terrainAt(x, z) > waterAt(x, z) + 0.6 && terrainAt(x, z) > 1 && classAt(x, z) !== 7 && classAt(x, z) !== 2 && roadDist(x, z) > 4 && slopeAt(x, z) < 0.5;
  let id = 0;
  for (const p of W.poi || []) {
    if (!['castle', 'ruins', 'camp', 'cabin', 'loggers', 'radio', 'windfarm', 'lighthouse', 'secret', 'lab'].includes(p.kind)) continue;
    const n = p.kind === 'secret' ? 5 : p.kind === 'castle' || p.kind === 'ruins' || p.kind === 'lab' ? 3 : 1;
    for (let k = 0; k < n; k++) for (let tries = 0; tries < 20; tries++) { const a = r() * TAU, d = 12 + r() * 60, x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d; if (ok(x, z)) { TREASURES.push({ id: id++, x, z, depth: 0.7 + r() * 0.5, rich: p.kind === 'castle' || p.kind === 'ruins' ? 1.6 : 1 }); break; } }
  }
  const wantN = Math.round(Math.min(700, 110 * Math.max(0.3, (PLAY / 4000) ** 2)));      // as many per square kilometre on every map
  for (let tries = 0; TREASURES.length < wantN && tries < wantN * 60; tries++) {
    const x = (r() * 2 - 1) * (PLAY - 100), z = (r() * 2 - 1) * (PLAY - 100); if (!ok(x, z)) continue;
    const b = biomeAt(x, z), want = b === 7 ? 0.5 : b === 1 || b === 10 ? 0.6 : b === 9 ? 0.5 : b === 5 ? 0.35 : 0.12;
    if (r() > want) continue;
    TREASURES.push({ id: id++, x, z, depth: 0.6 + r() * 0.8, rich: b === 7 ? 1.3 : 1 });
  }
}
function nearestTreasure(x, z, maxD) { let best = null, bd = maxD; for (const t of TREASURES) { if (FOUND.has(t.id)) continue; const d = Math.hypot(t.x - x, t.z - z); if (d < bd) { bd = d; best = t; } } return best ? [best, bd] : null; }
function digWhy(x, z) {
  const h = terrainAt(x, z), wl = waterAt(x, z);
  if (h < wl - 0.3) return 'لا يمكن الحفر تحت الماء';
  if (roadDist(x, z) < 1.2 || classAt(x, z) === 2) return 'الأرض هنا مرصوفة';
  if (onPlatform(x, z, player.pos.y + 0.5)) return 'لا تحفر في الأرضية';
  if (buildingAt(x, z, h + 1)) return 'لا تحفر داخل المباني';
  if (-digOffset(x, z) > 40) return 'وصلت إلى الصخر الصلب';
  return '';
}
function groundWork(tool) {
  const p = player.pos, fx = Math.sin(player.yaw), fz = Math.cos(player.yaw), x = p.x + fx * 1.25, z = p.z + fz * 1.25;
  const field = classAt(x, z) === 1 && cropAt(x, z) && CROP_ITEM[cropAt(x, z)];
  // fields: the sickle and the hoe reap, the hand pulls
  if (field && (tool === 'hoe' || tool === 'hand' || tool === 'knife' || tool === 'sword')) { reapField(x, z, tool); return; }
  if (typeof plotAt === 'function') { const pl = plotAt(x, z, 1.6); if (pl) { plotWork(pl, tool); return; } }
  if (player.toolItem === 'watering_can') { waterHere(x, z); return; }
  const digger = tool === 'shovel' || tool === 'pickaxe' || (tool === 'hoe' && isItem('sickle'));
  if (tool === 'hoe' && !isItem('sickle') && typeof tillPlot === 'function') { tillPlot(x, z); return; }
  if (!digger) { AUDIO.punch(); return; }
  if (player.stamina < 6) { toast('أنت متعب', 'استرح لحظة'); return; }
  const why = digWhy(x, z); if (why) { toast(why, ''); AUDIO.dry(); return; }
  const r = tool === 'shovel' ? 1.0 : tool === 'pickaxe' ? 0.8 : 0.7, d = (tool === 'shovel' ? 0.42 : tool === 'pickaxe' ? 0.36 : 0.26) * Math.min(1.4, tierMul());
  const hole = addCrater(x, z, r, d); grassDirtyArea(hole.x, hole.z, hole.r + 1.5); HOOK.dug(x, z, r, d);
  for (let i = Math.floor((hole.x - hole.r) / 8); i <= Math.floor((hole.x + hole.r) / 8); i++) for (let j = Math.floor((hole.z - hole.r) / 8); j <= Math.floor((hole.z + hole.r) / 8); j++) GBLOCK.add(i * 100000 + j);
  player.stamina = Math.max(0, player.stamina - 5); player.staminaWait = 0.8;
  const depth = -digOffset(x, z), b = biomeAt(x, z);
  spawnPuff(x, terrainAt(x, z) + 0.2, z, b === 7 || b === 1 ? 0xd8c49a : 0x6a5238, 10, 2.6, 0.07, -9, 0.8);
  spawnPuff(x, terrainAt(x, z) + 0.4, z, b === 7 || b === 1 ? 0xe0d0a8 : 0x8a7458, 3, 1.4, 0.25, -1, 1.2);
  AUDIO.dig(tool === 'pickaxe' ? 1 : 0.8); cam.shake = Math.min(0.15, cam.shake + 0.04);
  STATS.dug = (STATS.dug || 0) + 1; track('dug');
  const got = digLoot(x, z, depth);
  for (const [id, n] of got.slice(0, 3)) gain(id, n);
  HARV.name = 'حفرة بعمق ' + toAr(Math.round(depth * 10) / 10) + ' م'; HARV.frac = clamp(1 - depth / 3, 0, 1); HARV.t = 1.6;
  const tr = nearestTreasure(x, z, 2.4);
  if (tr && depth >= tr[0].depth) openTreasure(tr[0]);
  else if (tr && rand() < 0.6) toast('تسمع صوتاً معدنياً', 'احفر أعمق قليلاً');
}
function openTreasure(t) {
  FOUND.add(t.id); if (MAPMARK && MAPMARK.id === t.id) MAPMARK = null;
  const g = terrainAt(t.x, t.z), items = rollLoot('chest', t.rich);
  if (rand() < 0.25) items.push(['treasure_map', 1]);
  dropItems(t.x, g + 0.05, t.z, items, { life: 900 });
  spawnPuff(t.x, g + 0.5, t.z, 0xffd27a, 18, 3, 0.05, -4, 1.2);
  AUDIO.treasure(); STATS.treasure = (STATS.treasure || 0) + 1; track('treasure'); addGold(15);
  toast('وجدت صندوق كنز مدفوناً!', 'ذهب وجواهر وأشياء قديمة · بِعها في المصرف بالمدينة');
  if (typeof saveSoon === 'function') saveSoon();
}
const CROP_ITEM = { 1: 'wheat', 2: 'corn', 3: 'sunflower', 4: 'cotton', 5: 'potato', 6: 'tomato', 8: 'wheat', 9: 'corn', 10: 'pumpkin', 11: 'carrot', 12: 'barley' };
const CROPCUT = [];          // reaped patches of the big fields: crops grow back
function reapField(x, z, tool) {
  const id = CROP_ITEM[cropAt(x, z)];
  if (CROPCUT.some((c) => Math.hypot(c.x - x, c.z - z) < c.r * 0.8 && c.until > T_GAME)) { toast('حصدت هذا المكان', 'المحصول ينمو من جديد بعد قليل'); return; }
  const sick = isItem('sickle'), r = sick ? 2.2 : tool === 'hoe' ? 1.6 : 1.1;
  CROPCUT.push({ x: +x.toFixed(1), z: +z.toFixed(1), r, until: T_GAME + REGROW_CROP });
  for (let i = Math.floor((x - r) / 8); i <= Math.floor((x + r) / 8); i++) for (let j = Math.floor((z - r) / 8); j <= Math.floor((z + r) / 8); j++) GBLOCK.add(i * 100000 + j);
  grassDirtyArea(x, z, r + 1);
  const n = Math.round((sick ? 3 : 2) * tierMul() + rand() * 2);
  gain(id, n); if (rand() < 0.45) gain('seed_' + id, 1 + Math.floor(rand() * 2)); if (rand() < 0.2) gain('fiber', 1);
  spawnPuff(x, terrainAt(x, z) + 0.6, z, 0xd8c070, 10, 2, 0.05, -5, 0.8); AUDIO.reap();
}
/* grass and crops stay away from craters, reaped patches, plots and floors */
function grassBlocked(x, z, crop) {
  if (DIG.list.length && digOffset(x, z) < -0.15) return true;
  if (GP.n && gpBare(x, z)) return true;           // painted stone, sand, earth… (painted grass keeps its grass)
  if (crop) for (const c of CROPCUT) if (c.until > T_GAME && (x - c.x) ** 2 + (z - c.z) ** 2 < c.r * c.r) return true;
  if (typeof builtBlocksGrass === 'function' && builtBlocksGrass(x, z)) return true;
  if (typeof edBlocksGrass === 'function' && edBlocksGrass(x, z)) return true;     // floors, paving and cleared ground of the world editor
  return false;
}

/* ── fishing: cast toward water, wait for the float to dip, strike ── */
const FISHING = { state: '', t: 0, x: 0, z: 0, y: 0, water: 'sea', line: null, bob: null };
{
  const bob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshStandardMaterial({ color: C(0xd8402a), roughness: 0.5 }));
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
  const line = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0xe8e8e0, transparent: true, opacity: 0.7 }));
  bob.visible = line.visible = false; line.frustumCulled = false; scene.add(bob, line); FISHING.bob = bob; FISHING.line = line;
}
function castLine() {
  const F = FISHING;
  if (F.state === 'bite') { catchFish(); return; }
  if (F.state === 'wait') { stopFishing('سحبت الخيط'); return; }
  const p = player.pos, fx = Math.sin(cam.yaw + Math.PI), fz = Math.cos(cam.yaw + Math.PI);
  let spot = null;
  for (let d = 4; d <= 13; d += 0.5) { const x = p.x + fx * d, z = p.z + fz * d, wl = waterAt(x, z); if (wl > terrainAt(x, z) + 0.5 && wl > -50) { spot = [x, z, wl]; if (d > 6) break; } }
  if (!spot) { toast('وجّه الصنّارة نحو الماء', 'قف على الشاطئ أو الرصيف أو حافة البحيرة'); return; }
  const [x, z, wl] = spot, b = biomeAt(x, z);
  F.water = wl === 0 && b !== 12 && b !== 13 ? 'sea' : b === 13 ? 'river' : 'lake';
  F.state = 'wait'; F.x = x; F.z = z; F.y = wl; F.t = rr(3, 9) * (WEATHER.rain > 0.3 ? 0.6 : 1) * (ENV.dusk > 0.3 ? 0.7 : 1) / Math.min(1.6, tierMul());
  F.bob.visible = F.line.visible = true; AUDIO.cast(); player.swingT = 0.5; player.swingDur = 0.5; player.swingHit = true;
  HARV.name = 'تنتظر سمكة…'; HARV.frac = 1; HARV.t = 1.5;
}
function stopFishing(msg) { FISHING.state = ''; FISHING.bob.visible = FISHING.line.visible = false; if (msg) HARV.t = 0; }
function catchFish() {
  const F = FISHING, list = FISH.filter((f) => f[2] === F.water || (F.water === 'river' && f[2] === 'lake'));
  const r = rand();
  if (r < 0.04) { gain('scrap', 1); toast('اصطدت خردة معدنية!', ''); }
  else if (r < 0.06 && F.water === 'sea') { gain('t_pearl', 1); toast('لؤلؤة في صدفة!', 'تُباع غالية في المصرف'); }
  else if (r < 0.1 && F.water === 'sea') gain('seashell', 1);
  else { const f = pick(list); gain('fish_' + f[0], 1); STATS.fish = (STATS.fish || 0) + 1; track('fish'); toast('اصطدت ' + f[1], STATS.fish === 1 ? 'اشوِها على نار المخيّم' : ''); }
  AUDIO.splash(0.6); spawnPuff(F.x, F.y + 0.1, F.z, 0xe6f0f0, 8, 2.4, 0.08, -6, 0.6);
  stopFishing();
}
const _rodTip = new THREE.Vector3();
function updateFishing(dt, t) {
  const F = FISHING; if (!F.state) return;
  if (player.tool !== 'rod' || player.vehicle || !player.alive || Math.hypot(F.x - player.pos.x, F.z - player.pos.z) > 16) { stopFishing(); return; }
  F.t -= dt;
  const sea = F.water === 'sea' ? waveY(F.x, F.z, t) : 0;
  let dip = 0;
  if (F.state === 'wait' && F.t <= 0) { F.state = 'bite'; F.t = 1.3; AUDIO.bite(); HARV.name = 'سمكة! اضرب الآن'; HARV.frac = 1; HARV.t = 1.3; }
  else if (F.state === 'bite') { dip = 0.08 + Math.sin(t * 30) * 0.04; if (F.t <= 0) { F.state = 'wait'; F.t = rr(4, 10); toast('أفلتت السمكة', 'اضرب حين يغطس العوّام'); } }
  F.bob.position.set(F.x, F.y + sea + 0.03 - dip, F.z);
  if (RIG.ok) { RIG.bones.RightHand.getWorldPosition(_rodTip); _rodTip.y += 1.25; _rodTip.x += Math.sin(player.yaw) * 1.0; _rodTip.z += Math.cos(player.yaw) * 1.0; } else _rodTip.set(player.pos.x, player.pos.y + 2.2, player.pos.z);
  const a = F.line.geometry.attributes.position; a.setXYZ(0, _rodTip.x, _rodTip.y, _rodTip.z); a.setXYZ(1, F.bob.position.x, F.bob.position.y, F.bob.position.z); a.needsUpdate = true;
}

/* ── eating, healing and the other things you can use from the bag ── */
function useItem(id) {
  const it = ITEMS[id]; if (!it || invCount(id) <= 0) return false;
  if (it.drink) {
    if (player.water >= 99 && !it.food) { toast('لست عطشاناً الآن', ''); return false; }
    invTake(id, 1); feed(it.food ? it.food * 1.6 : 0, it.drink); player.stamina = Math.min(100, player.stamina + (it.energy || 20)); if (it.heal) player.health = Math.min(100, player.health + it.heal);
    if (it.bottle) invAdd('bottle_empty', 1, true);
    AUDIO.drink(); track('drink'); toast('شربت ' + it.name, '+' + toAr(Math.round(it.drink)) + ' ماء'); return true;
  }
  if (it.food) {
    if (player.food >= 99 && player.health >= 100) { toast('لست جائعاً الآن', ''); return false; }
    invTake(id, 1); feed(it.food * 2.2, it.juicy || 0); player.health = Math.min(100, player.health + it.food * 0.3); player.stamina = Math.min(100, player.stamina + it.food); AUDIO.eat(); track('eat');
    if (it.sick && rand() < it.sick) { setTimeout(() => { damagePlayer(6, null, 'sick'); toast('معدتك تؤلمك', 'اطبخ اللحم والسمك على النار'); }, 2500); }
    toast('أكلت ' + it.name, '+' + toAr(Math.round(it.food * 2.2)) + ' شبع'); hudDirty = true; return true;
  }
  if (it.heal) { if (player.health >= 100) { toast('صحتك كاملة', ''); return false; } invTake(id, 1); player.health = Math.min(100, player.health + it.heal); if (id === 'energy_drink' || id === 'stim') player.stamina = 100; AUDIO.heal(); toast('استعملت ' + it.name, '+' + toAr(it.heal) + ' صحة'); hudDirty = true; return true; }
  if (id === 'honey') { invTake(id, 1); feed(12, 4); player.stamina = Math.min(100, player.stamina + 35); player.health = Math.min(100, player.health + 3); AUDIO.eat(); toast('أكلت ' + it.name, ''); return true; }
  if (it.mapItem) {
    const pickT = TREASURES.filter((t) => !FOUND.has(t.id)); if (!pickT.length) { toast('لا كنوز باقية', ''); return false; }
    invTake(id, 1); const t = pick(pickT); MAPMARK = { id: t.id, x: t.x, z: t.z };
    toast('علامة × على خريطتك', 'كنز مدفون · افتح الخريطة واتبع العلامة في البوصلة'); AUDIO.pickup(true); return true;
  }
  if (it.seed && typeof plantSeed === 'function') return plantSeed(id);
  if ((it.build || it.place || it.sapling || it.vehicle) && typeof startPlace === 'function') return startPlace(id);
  if (it.wear && typeof wearItem === 'function') return wearItem(id);
  if (it.tool || it.gun) { const free = INV.slots.indexOf(id) >= 0 ? INV.slots.indexOf(id) : INV.slots.findIndex((s, i) => i > 0 && !ownsTool(s)); if (free > 0 && INV.slots[free] !== id) assignSlot(free, id); equip(id); return true; }
  return false;
}

/* ── loot boxes in houses, barracks and clinics: open, take, they fill again later ── */
const LOOTED = new Map();
const lootKey = (s) => Math.round(s.x * 2) + ',' + Math.round(s.z * 2);
const lootReady = (s) => { const u = LOOTED.get(lootKey(s)); if (u === undefined) return true; if (u <= T_GAME) { LOOTED.delete(lootKey(s)); return true; } return false; };
const LOOT_GEO = new THREE.BoxGeometry(0.62, 0.42, 0.44), LOOT_MAT = new THREE.MeshStandardMaterial({ color: C(0x8a6a45), roughness: 0.8 });
const LOOT_MESH = new THREE.InstancedMesh(LOOT_GEO, LOOT_MAT, 64); LOOT_MESH.count = 0; LOOT_MESH.frustumCulled = false; LOOT_MESH.castShadow = true; LOOT_MESH.receiveShadow = true; scene.add(LOOT_MESH);
ENV_MATS.push(LOOT_MAT);
const LOOT_COL = { home: 0x8a6a45, military: 0x4a5a3a, armory: 0x3a4a32, med: 0xe8e4dc, farm: 0x9a7448 };
let lootDrawT = 0;
function drawLootBoxes(dt) {
  lootDrawT -= dt; if (lootDrawT > 0) return; lootDrawT = 0.5;
  let n = 0; const p = player.pos;
  for (const s of LOOT_SPOTS) {
    if (n >= 64 || Math.abs(s.x - p.x) > 45 || Math.abs(s.z - p.z) > 45 || !lootReady(s)) continue;
    _jq.setFromAxisAngle(UP, (s.x * 7 + s.z * 3) % TAU);
    LOOT_MESH.setMatrixAt(n, _jm.compose(_jp.set(s.x, s.y + 0.21, s.z), _jq, _js.set(1, 1, 1))); LOOT_MESH.setColorAt(n, _hc.set(LOOT_COL[s.kind] || 0x8a6a45)); n++;
  }
  LOOT_MESH.count = n; LOOT_MESH.instanceMatrix.needsUpdate = true; if (LOOT_MESH.instanceColor) LOOT_MESH.instanceColor.needsUpdate = true;
}
function openLoot(s) {
  const items = rollLoot(s.kind || 'home');
  LOOTED.set(lootKey(s), T_GAME + REGROW_LOOT); lootDrawT = 0;
  if (!items.length) { toast('الصندوق فارغ', 'جرّب صناديق أخرى'); AUDIO.door(); return; }
  const got = [];
  for (const [id, n] of items) { const k = invAdd(id, n, true); if (k > 0) got.push(toAr(k) + ' ' + ITEMS[id].name); if (k < n) dropItems(s.x, s.y, s.z, [[id, n - k]], { life: 300 }); }
  toast('وجدت: ' + got.slice(0, 4).join('، ') + (got.length > 4 ? '…' : ''), s.kind === 'military' || s.kind === 'armory' ? 'صندوق عسكري' : ''); AUDIO.pickup(true);
  if (typeof saveSoon === 'function') saveSoon();
}

/* ── sleeping through the night ── */
let sleepFade = 0;
function sleepIn() {
  // any bed you lie on becomes the place you rise after a fall
  const b = USE.target; if (b && b.x !== undefined) { const fresh = !HOME || Math.hypot(HOME[0] - b.x, HOME[2] - b.z) > 2; HOME = [+b.x.toFixed(2), +(b.y || player.pos.y).toFixed(2), +b.z.toFixed(2)]; saveSoon(); if (fresh) toast('صار هذا سريرك', 'إن سقطت تنهض هنا'); }
  if (ENV.night < 0.25 && ENV.hour > 6 && ENV.hour < 19) { if (!b) toast('لست نعساناً', 'النوم في الليل يقرّب الصباح'); return; }
  let near = false; for (const z of ZOMBIES) if (z.active && z.state !== 'dead' && Math.hypot(z.x - player.pos.x, z.z - player.pos.z) < 30) { near = true; break; }
  if (near) { toast('لا يمكنك النوم والزومبي قريبون', ''); return; }
  sleepFade = 2.2; AUDIO.sleep();
  setTimeout(() => { ENV.hour = 6.4; player.health = Math.min(100, player.health + 35); player.stamina = 100; hudDirty = true; toast('صباح الخير', 'نمت حتى الفجر'); if (typeof saveSoon === 'function') saveSoon(); }, 900);
}

/* ── the use button: the nearest thing you can do something with ── */
const USE = { kind: '', label: '', target: null };
let useScanT = 0;
function scanUse(dt) {
  useScanT -= dt; if (useScanT > 0) return; useScanT = 0.12;
  const p = player.pos; USE.kind = ''; USE.target = null; USE.label = '';
  if (!player.alive) return;
  if (player.vehicle) { USE.kind = 'out'; USE.label = player.vehicle.spec.horse ? 'انزل عن الحصان' : 'انزل'; return; }
  if (nearVeh) { USE.kind = nearVeh.spec.water ? 'boat' : 'in'; USE.label = nearVeh.horse ? 'اركب الحصان' : nearVeh.spec.water ? 'اركب القارب' : nearVeh.spec.rail ? 'قُد القطار' : 'اركب'; USE.target = nearVeh; return; }
  let bd = 1e9;
  const cand = (kind, label, target, d) => { if (d < bd) { bd = d; USE.kind = kind; USE.label = label; USE.target = target; } };
  if (typeof builtUseNear === 'function') builtUseNear(p, cand);
  for (const s of SHOP_SPOTS) { const d = Math.hypot(s.x - p.x, s.z - p.z); if (d < 3.2 && Math.abs((s.y || p.y) - p.y) < 2.5) cand('shop', 'تسوّق: ' + (s.name || 'المتجر'), s, d - 0.5); }
  for (const s of LOOT_SPOTS) { const d = Math.hypot(s.x - p.x, s.z - p.z); if (d < 1.8 && Math.abs(s.y - p.y) < 1.6 && lootReady(s)) cand('loot', 'افتح الصندوق', s, d); }
  for (const b of BEDS) { const d = Math.hypot(b.x - p.x, b.z - p.z); if (d < 1.9 && Math.abs(b.y - p.y) < 1.6) cand('bed', 'نم', b, d + 0.3); }
  if (typeof npcUseNear === 'function') npcUseNear(p, cand);
  if (typeof crateUseNear === 'function') crateUseNear(p, cand);
  if (typeof edUseNear === 'function') edUseNear(p, cand);         // the world editor's gates, weapons on stands
  // fresh water at your feet or an arm's length ahead (a lake, a river, a pond): drink and fill your empty bottles; the sea is salt
  if (!USE.kind && (player.water < 97 || invCount('bottle_empty') > 0) && !player.swimming) {
    for (const k of [0, 1.1]) {
      const x = p.x + Math.sin(player.yaw) * k, z = p.z + Math.cos(player.yaw) * k, wl = waterAt(x, z);
      if (wl > -1e8 && wl !== 0 && wl > terrainAt(x, z) + 0.04 && Math.abs(wl - p.y) < 1.3) { cand('drink', invCount('bottle_empty') > 0 && player.water >= 97 ? 'املأ القناني' : 'اشرب', { x, z }, 2); break; }
    }
  }
}
function drinkWater() {
  const n = invCount('bottle_empty');
  if (player.water < 97) { feed(0, 30); player.stamina = Math.min(100, player.stamina + 10); AUDIO.drink(); track('drink'); spawnPuff(USE.target ? USE.target.x : player.pos.x, player.pos.y + 0.05, USE.target ? USE.target.z : player.pos.z, 0x9ac8e0, 5, 1.2, 0.05, -6, 0.5); }
  if (n > 0) { invTake('bottle_empty', n); invAdd('bottle_water', n, true); }
  toast(player.water < 97 ? 'شربت من الماء' : 'ارتويت', n > 0 ? 'ملأت ' + toAr(n) + ' قنينة ماء' : 'اشرب مرة أخرى حتى يمتلئ شريط العطش');
}
function interact() {
  if (!started || paused || !player.alive) return;
  scanUse(1);
  const k = USE.kind, t = USE.target;
  if (k === 'out') exitVehicle(false);
  else if (k === 'in' || k === 'boat') enterVehicle(t);
  else if (k === 'shop') { if (typeof openShop === 'function') openShop(t); }
  else if (k === 'loot') openLoot(t);
  else if (k === 'bed') sleepIn();
  else if (k === 'drink') drinkWater();
  else if (k === 'crate') { if (typeof openCrate === 'function') openCrate(t); }
  else if (k === 'talk') { if (typeof npcTalk === 'function') npcTalk(t); }
  else if (k === 'ed') { if (typeof edUse === 'function') edUse(t); }
  else if (k && typeof builtUse === 'function') builtUse(k, t);
}

/* ── per frame ── */
let detectT = 0;
function updateSurvival(dt, t) {
  updateLogs(dt); updateSparks(dt); updateStumps(dt); updateFishing(dt, t); drawLootBoxes(dt); scanUse(dt);
  HARV.t = Math.max(0, HARV.t - dt);
  sleepFade = Math.max(0, sleepFade - dt);
  // the metal detector beeps faster as you near something buried
  if (player.toolItem === 'metal_detector' && !player.vehicle && player.alive) {
    const tr = nearestTreasure(player.pos.x, player.pos.z, 50);
    detectT -= dt;
    if (tr) {
      const d = tr[1]; HARV.name = d < 3 ? 'إشارة قوية جداً: احفر هنا!' : d < 12 ? 'إشارة قوية' : d < 30 ? 'إشارة' : 'إشارة ضعيفة'; HARV.frac = clamp(1 - d / 50, 0.03, 1); HARV.t = 0.3;
      if (detectT <= 0) { detectT = clamp(d / 22, 0.08, 1.6); AUDIO.beep(1 - d / 50); }
    } else if (detectT <= 0) { detectT = 2; HARV.name = 'لا إشارة'; HARV.frac = 0.02; HARV.t = 0.5; }
  }
  for (let i = CROPCUT.length - 1; i >= 0; i--) if (CROPCUT[i].until <= T_GAME) { const c = CROPCUT[i]; CROPCUT.splice(i, 1); grassDirtyArea(c.x, c.z, c.r + 1); }
}
