/* ═════════ the survivor: a real human model in clothes from the shop, tools in hand, momentum movement, swimming, cameras ═════════ */
const PHYS = { walk: 2.2, jog: 4.6, run: 6.9, swim: 1.6, swimFast: 2.8, accG: 26, decG: 22, accAir: 6, grav: 24, fallMul: 1.5, jumpV: 7.4, coyote: 0.12, buffer: 0.14, cut: 0.55, R: 0.36 };
const input = { mx: 0, mz: 0, sprint: false, jumpPressed: false, jumpHeld: false, act: false, aim: false, reloadPressed: false };
const player = {
  root: new THREE.Group(), pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: Math.PI,
  onGround: true, airT: 0, jumpBuf: 0, stamina: 100, staminaWait: 0, sprinting: false, swimming: false, wade: 0,
  health: 100, food: 100, water: 100, alive: true, hurtT: 9, armed: false, mag: 0, reserve: 0, reloadT: 0, fireCD: 0, lastShot: -9,
  inside: null, bornAt: 0, tool: 'hand', toolItem: 'hand', swingT: 0, swingDur: 0.62, swingHit: false, vehicle: null, speed: 0, stepPhase: 0, squash: 0,
  body: null, outfit: null, stance: 'stand', lean: 0, leanT: 0,
};
scene.add(player.root);
const RIG = { ok: false, body: null, mixer: null, act: {}, bones: {}, tools: {}, visor: null };
/* tool models: one merged mesh each, object-space detail; tinted by tier */
function gearMesh(b, g) { const m = b.mesh(UBER_OBJ, true); g.add(m); return g; }
const TIER_METAL = { wood: 0x8a6a45, stone: 0x8d8478, copper: 0xb8733a, iron: 0x9aa1a8, steel: 0xc8cdd2, gold: 0xd8b04a, diamond: 0x9fe0e8 };
function buildTool(kind, tier = 'iron') {
  const g = new THREE.Group(), b = new Builder(), Q = MATID, wood = 0x6e4a2c, steel = TIER_METAL[tier] || 0x9aa1a8, edge = C(steel).clone().lerp(C(0xffffff), 0.3), dark = 0x55595e;
  const handle = (len, r = 0.021) => { b.add(G.cyl8, M(0, len / 2 - 0.08, 0, 0, r, len, r + 0.003), wood, Q.wood); b.add(G.cyl8, M(0, -0.06, 0, 0, r + 0.005, 0.08, r + 0.007), 0x2a1d14, Q.wood); };
  if (kind === 'axe') { handle(0.78); b.add(G.box, M(0, 0.62, 0.065, 0, 0.032, 0.11, 0.17, 0.08), steel, tier === 'stone' ? Q.stone : Q.metal); b.add(G.box, M(0, 0.62, 0.17, 0, 0.012, 0.17, 0.05, 0.08), edge, Q.metal); b.box(0, 0.62, -0.035, 0.04, 0.06, 0.05, dark, 0, Q.metal); }
  else if (kind === 'pickaxe') { handle(0.82); for (const s2 of [-1, 1]) b.add(G.cone, M(0, 0.68, s2 * 0.17, 0, 0.022, 0.32, 0.03, s2 * (Math.PI / 2 - 0.22)), steel, tier === 'stone' ? Q.stone : Q.metal); b.box(0, 0.68, 0, 0.05, 0.07, 0.07, dark, 0, Q.metal); }
  else if (kind === 'shovel') { handle(0.9); b.add(G.box, M(0, 0.95, 0, 0, 0.2, 0.26, 0.02), steel, Q.metal); b.box(0, 0.8, 0, 0.04, 0.08, 0.04, dark, 0, Q.metal); }
  else if (kind === 'hoe') { handle(0.95); b.add(G.box, M(0, 0.86, 0.07, 0, 0.16, 0.04, 0.12, 0.3), steel, Q.metal); }
  else if (kind === 'sword') {
    b.add(G.cyl8, M(0, 0.02, 0, 0, 0.02, 0.18, 0.022), 0x2a1d14, Q.wood); b.box(0, 0.12, 0, 0.2, 0.025, 0.04, 0x8a7650, 0, Q.metal);
    b.box(0, 0.53, 0, 0.05, 0.78, 0.008, steel, 0, Q.metal); b.add(G.cone, M(0, 0.97, 0, 0, 0.025, 0.1, 0.004), steel, Q.metal); b.add(G.sph, M(0, -0.08, 0, 0, 0.03, 0.03, 0.03), 0x8a7650, Q.metal);
  } else if (kind === 'knife') { b.add(G.cyl8, M(0, 0.02, 0, 0, 0.018, 0.12, 0.02), 0x2a1d14, Q.wood); b.box(0, 0.16, 0, 0.03, 0.18, 0.006, steel, 0, Q.metal); }
  else if (kind === 'spear') { handle(1.6, 0.017); b.add(G.cone, M(0, 1.6, 0, 0, 0.03, 0.22, 0.012), steel, Q.metal); }
  else if (kind === 'hammer') { handle(0.42, 0.02); b.box(0, 0.38, 0.02, 0.05, 0.05, 0.16, dark, 0, Q.metal); b.add(G.cone, M(0, 0.38, -0.09, 0, 0.022, 0.08, 0.022, -Math.PI / 2), dark, Q.metal); }
  else if (kind === 'rod') { b.add(G.cyl8, M(0, 0.9, 0, 0, 0.008, 1.9, 0.014), 0x2a2e33, Q.metal); b.add(G.cyl14, M(0.03, 0.15, 0, 0, 0.035, 0.03, 0.035, 0, Math.PI / 2), 0x8a8f94, Q.metal); b.add(G.cyl8, M(0, 0.05, 0, 0, 0.02, 0.2, 0.02), 0x2a1d14, Q.fabric); }
  else if (kind === 'torch') { handle(0.5, 0.025); b.add(G.cyl8, M(0, 0.48, 0, 0, 0.04, 0.12, 0.04), 0x3a2a1e, Q.fabric); }
  else if (kind === 'bow') { for (const s of [-1, 1]) b.add(G.box, M(0, s * 0.35 + 0.35, 0.05, 0, 0.02, 0.72, 0.03, s * 0.25), wood, Q.wood); b.box(0, 0.35, -0.08, 0.004, 1.3, 0.004, 0xe8e2d0, 0, Q.fabric); }
  return gearMesh(b, g);
}
function buildGun(g, kind = 'rifle') {
  const b = new Builder(), Q = MATID, metal = 0x2b2f33, poly = 0x3b3f36, wood = 0x6b4a2f;
  if (kind === 'pistol') {
    b.box(0, 0.02, 0.06, 0.035, 0.05, 0.2, metal, 0, Q.metal); b.add(G.box, M(0, -0.06, -0.01, 0, 0.032, 0.12, 0.05, 0.25), poly, Q.plain);
    return gearMesh(b, g);
  }
  if (kind === 'shotgun') {
    b.box(0, 0, 0.05, 0.06, 0.09, 0.4, metal, 0, Q.metal); b.add(G.cyl8, M(0, 0.02, 0.6, 0, 0.022, 0.62, 0.022, Math.PI / 2), metal, Q.metal);
    b.add(G.cyl8, M(0, -0.02, 0.5, 0, 0.024, 0.32, 0.024, Math.PI / 2), wood, Q.wood); b.box(0, -0.03, -0.3, 0.056, 0.12, 0.32, wood, 0, Q.wood);
    return gearMesh(b, g);
  }
  b.box(0, 0, 0.05, 0.06, 0.1, 0.5, metal, 0, Q.metal);
  b.box(0, -0.015, 0.38, 0.056, 0.08, 0.26, wood, 0, Q.wood);
  b.add(G.cyl8, M(0, 0.02, 0.7, 0, 0.016, 0.4, 0.016, Math.PI / 2), metal, Q.metal);
  b.add(G.cyl8, M(0, 0.02, 0.92, 0, 0.026, 0.07, 0.026, Math.PI / 2), metal, Q.metal);
  b.add(G.box, M(0, -0.14, 0.1, 0, 0.045, 0.2, 0.08, 0.3), metal, Q.metal);
  b.add(G.box, M(0, -0.1, -0.1, 0, 0.045, 0.13, 0.06, -0.35), poly, Q.plain);
  b.box(0, -0.03, -0.32, 0.056, 0.12, 0.28, wood, 0, Q.wood); b.box(0, -0.03, -0.465, 0.06, 0.13, 0.02, 0x1d1f20, 0, Q.plain);
  b.box(0, 0.075, -0.02, 0.025, 0.04, 0.1, metal, 0, Q.metal); b.box(0, 0.065, 0.82, 0.014, 0.05, 0.014, metal, 0, Q.metal);
  if (kind === 'sniper') { b.add(G.cyl8, M(0, 0.12, 0.05, 0, 0.03, 0.34, 0.03, Math.PI / 2), 0x111214, Q.metal); b.add(G.cyl8, M(0, 0.02, 1.05, 0, 0.014, 0.3, 0.014, Math.PI / 2), metal, Q.metal); }
  b.add(G.cyl8, M(0, 0.05, 0.36, 0, 0.012, 0.22, 0.012, Math.PI / 2), metal, Q.metal);
  return gearMesh(b, g);
}
const MUZZLE_LOCAL = new THREE.Vector3(0, 0.02, 0.97);
// a survivor in a dark field jacket, jeans and boots: the armour plates of the base body take the cloth colours
const DEFAULT_OUTFIT = { top: { c: 0x3e4636, p: 'solid', a: 0.9 }, pants: { c: 0x2f3b4e, a: 0.9 }, shoes: { c: 0x3b2b1f, a: 0.88 }, head: { c: 0x2e3236, a: 0.88 }, hands: { c: 0x2a2724, a: 0.88 }, pack: 'pack', packC: 0x56603f };
function buildPlayerRig() {
  const kind = (player.outfit && player.outfit.body) || 'soldier';
  const body = makeBody(kind, { outfit: player.outfit || DEFAULT_OUTFIT });
  if (!body) { const fb = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 1.75, 12), new THREE.MeshStandardMaterial({ color: C(0x4d5a3c) })); fb.position.y = 0.875; fb.castShadow = true; player.root.add(fb); return; }
  if (RIG.body) player.root.remove(RIG.body.root);
  for (const t of Object.values(RIG.tools)) if (t && t.parent) t.parent.remove(t);
  RIG.tools = {};
  player.root.add(body.root); RIG.body = body; player.body = body;
  RIG.bones = body.bones; RIG.mixer = body.mixer; RIG.act = body.act;
  body.model.traverse((o) => { if (o.isMesh && /visor/i.test(o.name)) RIG.visor = o; });
  player.root.updateMatrixWorld(true);
  const toRoot = (n) => boneLocal(body, n);
  const chest = toRoot('Spine2'), hand = toRoot('RightHand');
  RIG.hand = hand; RIG.chest = chest;
  RIG.ok = true;
  showTool(true);
}
/* the tool in your hand is built when you pick it (category + tier) */
const _toolCache = new Map();
function toolObject(cat, tier, id) {
  const it = id && ITEMS[id], gunItem = it && it.gun, prop = !gunItem && it && it.prop ? propMesh(it.prop) : null;
  const key = gunItem ? 'gun:' + id : it && it.prop ? 'prop:' + it.prop + (prop ? '' : ':wait') : cat + ':' + tier; let t = RIG.tools[key];
  if (t) return t;
  if (prop) {
    // a blade or an axe modelled by an artist: the grip at its origin, the blade up its +y like the drawn tools
    const m = new THREE.Mesh(prop.mesh.geometry, prop.mesh.material); m.castShadow = true; m.visible = false;
    t = attachAt(player.root, RIG.bones.RightHand, m, RIG.hand.x, RIG.hand.y - 0.03, RIG.hand.z + 0.02, Math.PI / 2, 0, 0);
    RIG.tools[key] = t; return t;
  }
  const isGun = cat === 'rifle' || cat === 'pistol' || cat === 'shotgun' || cat === 'sniper';
  if (gunItem) { t = buildWeaponModel(gunOf(it).id, ATTACH[id] || {}); if (typeof skinPaint === 'function') skinPaint(t, id); t.visible = false; player.root.add(t); }
  else if (isGun) { t = buildGun(new THREE.Group(), cat); t.visible = false; player.root.add(t); t.userData.gun = true; }
  else { const m = buildTool(cat, tier); m.visible = false; t = attachAt(player.root, RIG.bones.RightHand, m, RIG.hand.x, RIG.hand.y - 0.03, RIG.hand.z + 0.02, Math.PI / 2, 0, 0); }
  RIG.tools[key] = t; return t;
}
function showTool(force) {
  if (!RIG.ok) return;
  for (const t of Object.values(RIG.tools)) t.visible = false;
  if (player.vehicle) return;
  const it = typeof ITEMS !== 'undefined' ? ITEMS[player.toolItem] : null, cat = player.tool;
  if (cat === 'hand') return;
  const t = toolObject(cat, it && it.tier || 'iron', player.toolItem); t.visible = !SCOPE.on || SCOPE.k < 0.5; RIG.current = t;
}
const isGunTool = (k) => k === 'rifle' || k === 'pistol' || k === 'shotgun' || k === 'sniper';

/* ── movement ── */
function canStep(x0, z0, x1, z1, y) {
  const g1 = groundAt(x1, z1, y);
  if (g1 - y > STEP_UP + 0.02) return false;
  if (LAND_ON) {
    const r1 = landTop(x1, z1, y);
    if (r1 - y > STEP_UP + 0.02) return false;
    if (r1 > -Infinity && player.onGround && (r1 - Math.max(landTop(x0, z0, y), terrainAt(x0, z0))) / (Math.hypot(x1 - x0, z1 - z0) || 1e-6) > 1.25) return false;
  }
  if (!player.onGround || g1 > terrainAt(x1, z1) + 0.05 || groundAt(x0, z0, y) > terrainAt(x0, z0) + 0.05) return true;
  return (terrainAt(x1, z1) - terrainAt(x0, z0)) / (Math.hypot(x1 - x0, z1 - z0) || 1e-6) < 1.3;
}
function moveBody(p, ox, oz, R, onBlockX, onBlockZ) {
  if (canStep(p.x, p.z, p.x + ox, p.z + oz, p.y)) { p.x += ox; p.z += oz; }
  else if (canStep(p.x, p.z, p.x + ox, p.z, p.y)) { p.x += ox; onBlockZ && onBlockZ(); }
  else if (canStep(p.x, p.z, p.x, p.z + oz, p.y)) { p.z += oz; onBlockX && onBlockX(); }
  else { onBlockX && onBlockX(); onBlockZ && onBlockZ(); }
  resolveCollision(p, R);
  worldEdge(p);
}
function surfaceAt(x, z, y) {
  if (groundAt(x, z, y) > terrainAt(x, z) + 0.05) return 'wood';
  const h = terrainAt(x, z), wl = waterAt(x, z);
  if (h < wl - 0.05) return 'water';
  if (roadDist(x, z) < 0.5 || classAt(x, z) === 2) return 'stone';
  const b = biomeAt(x, z);
  if (b === 1 || b === 7 || classAt(x, z) === 3) return 'sand';
  if (h > 300 + tempAt(x, z) * 260) return 'snow';
  return 'grass';
}
const aiming = () => player.armed && isGunTool(player.tool) && (SCOPE.on || input.aim || input.act || T - player.lastShot < 0.8);
/* stance: stand, crouch (slower, steadier, harder to see) or lie down (crawl, steadiest aim); lean left and right around cover */
function setStance(s) {
  if (player.vehicle || player.swimming || !player.alive) s = 'stand';
  if (s === player.stance) s = 'stand';
  if (s === 'prone' && player.wade > 0.3) { toast('لا يمكنك الانبطاح في الماء', ''); return; }
  player.stance = s; hudDirty = true;
  const bc = document.getElementById('btnCrouch'), bp = document.getElementById('btnProne');
  if (bc) bc.setAttribute('aria-pressed', String(s === 'crouch')); if (bp) bp.setAttribute('aria-pressed', String(s === 'prone'));
  if (s !== 'stand' && player.sprinting) player.sprinting = false;
}
function setLean(d) {
  player.leanT = player.leanT === d ? 0 : d;
  const l = document.getElementById('btnPeekL'), r = document.getElementById('btnPeekR');
  if (l) l.setAttribute('aria-pressed', String(player.leanT === -1)); if (r) r.setAttribute('aria-pressed', String(player.leanT === 1));
}
/* the scope: through the sight in first person, zoomed by what is fitted (iron sights a little) */
function setScope(on) {
  const ok = on && player.armed && isGunTool(player.tool) && !player.vehicle && player.alive && player.reloadT <= 0;
  if (SCOPE.on === ok) return;
  SCOPE.on = ok; const b = document.getElementById('btnAim'); if (b) b.setAttribute('aria-pressed', String(ok));
  if (ok) AUDIO.ui();
}
function updatePlayer(dt, t) {
  const p = player.pos, v = player.vel;
  if (player.vehicle) return;
  if (!player.alive) {
    player.deadT = (player.deadT || 0) + dt; const k = smooth(0, 0.85, player.deadT);
    animateRig(dt, t, 0); player.root.rotation.set(-k * 1.42, player.yaw, 0, 'YXZ'); player.root.position.set(p.x, p.y + Math.sin(k * Math.PI) * 0.15 + k * 0.12, p.z);
    return;
  }
  player.deadT = 0;
  const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
  let dx = fx * input.mz + rx * input.mx, dz = fz * input.mz + rz * input.mx, mag = Math.hypot(dx, dz);
  if (mag > 1) { dx /= mag; dz /= mag; mag = 1; }
  // water: wading slows you, deep water makes you swim
  const g0 = terrainAt(p.x, p.z), wl = waterAt(p.x, p.z), onPlat = groundAt(p.x, p.z, p.y) > g0 + 0.05;
  const depth = onPlat ? 0 : wl - g0;
  player.wade = clamp(depth / 1.0, 0, 1);
  const swim = depth > 1.25 && p.y < wl - 0.6;
  if (swim !== player.swimming) { player.swimming = swim; if (swim && typeof AUDIO !== 'undefined') AUDIO.splash(0.8); }
  const wantSprint = input.sprint && mag > 0.5 && !aiming() && player.wade < 0.6 && !SCOPE.on;
  if (swim && player.stance !== 'stand') setStance('stand');
  if (wantSprint && player.stance !== 'stand' && player.stance !== 'prone') setStance('stand');
  const fit = upMul('stamina');
  if (wantSprint && player.stance === 'stand' && player.stamina > (player.sprinting ? 0 : 12)) { player.sprinting = true; player.stamina = Math.max(0, player.stamina - (swim ? 18 : 15) / fit * dt); player.staminaWait = 0.9; }
  else { player.sprinting = false; player.staminaWait -= dt; if (player.staminaWait <= 0) player.stamina = Math.min(100, player.stamina + (swim ? 4 : 13) * fit * dt); }
  let top;
  if (swim) top = (player.sprinting ? PHYS.swimFast : PHYS.swim) * mag;
  else {
    const base = mag < 0.6 ? lerp(0, PHYS.walk, mag / 0.6) : lerp(PHYS.walk, PHYS.jog, (mag - 0.6) / 0.4);
    top = (player.sprinting ? PHYS.run : base) * (1 - player.wade * 0.5) * (aiming() ? (SCOPE.on ? 0.45 : 0.6) : 1) * (player.reloadT > 0 ? 0.75 : 1) * (typeof BAG_SLOW === 'function' ? BAG_SLOW() : 1)
      * (player.stance === 'crouch' ? 0.6 : player.stance === 'prone' ? 0.27 : 1);
  }
  const acc = swim ? 5 : player.onGround ? (mag > 0.05 ? PHYS.accG : PHYS.decG) : PHYS.accAir;
  const tvx = mag > 0.02 ? dx / mag * top : 0, tvz = mag > 0.02 ? dz / mag * top : 0;
  const ddx = tvx - v.x, ddz = tvz - v.z, dl = Math.hypot(ddx, ddz), stepA = acc * dt;
  if (dl <= stepA) { v.x = tvx; v.z = tvz; } else { v.x += ddx / dl * stepA; v.z += ddz / dl * stepA; }
  const hs = Math.hypot(v.x, v.z); player.speed = hs;
  const faceCam = camMode === 'fpp' || aiming() || player.swingT > 0;
  if (faceCam) player.yaw = angLerp(player.yaw, cam.yaw + Math.PI, 1 - Math.exp(-dt * 18));
  else if (hs > 0.3) player.yaw = angLerp(player.yaw, Math.atan2(v.x, v.z), 1 - Math.exp(-dt * (player.onGround || swim ? 10 : 3)));
  if (hs > 1e-4) moveBody(p, v.x * dt, v.z * dt, PHYS.R, () => { v.x *= 0.2; }, () => { v.z *= 0.2; });
  // auto-climb: walking into a low ledge, a crate or a low wall hops you up onto it
  if (SET.autoJump && player.onGround && !swim && mag > 0.6 && hs < top * 0.6 && player.wade < 0.5 && player.stamina > 10) {
    const ax = p.x + dx / mag * 0.62, az = p.z + dz / mag * 0.62;
    let rise = groundAt(ax, az, p.y + 1.15) - p.y;
    CGRID.each(ax - 0.15, az - 0.15, ax + 0.15, az + 0.15, (c) => {
      if (c.off || c.y1 === undefined) return;
      const inside = c.t === 'c' ? Math.hypot(ax - c.x, az - c.z) < c.r : c.t === 'b' ? Math.abs(ax - c.x) < c.hx && Math.abs(az - c.z) < c.hz : false;
      if (inside && c.y1 - p.y < 1.15) rise = Math.max(rise, c.y1 - p.y);
    });
    if (rise > STEP_UP + 0.04 && rise < 1.12) input.jumpPressed = true;
  }
  if (input.jumpPressed) { player.jumpBuf = PHYS.buffer; input.jumpPressed = false; }
  player.jumpBuf -= dt; player.airT = player.onGround ? 0 : player.airT + dt;
  if (swim) {
    // float with your chest at the surface, bob with the waves
    const sea = wl === 0 ? waveY(p.x, p.z, t) : 0, ty = wl + sea - 1.25;
    p.y = damp(p.y, ty, 4, dt); v.y = 0; player.onGround = false; player.airT = 0;
    if (player.stamina <= 0 && T % 2 < dt) damagePlayer(3, null, 'drown');
  } else {
    if (player.jumpBuf > 0 && player.stance !== 'stand') { setStance('stand'); player.jumpBuf = 0; }
    if (player.jumpBuf > 0 && (player.onGround || player.airT < PHYS.coyote) && player.stamina > 4 && player.wade < 0.7) {
      v.y = PHYS.jumpV * (player.sprinting ? 1.06 : 1); player.onGround = false; player.airT = PHYS.coyote; player.jumpBuf = 0;
      player.stamina -= 8; player.staminaWait = 0.6; AUDIO.jump();
    }
    const g = groundAt(p.x, p.z, p.y);
    if (!player.onGround) {
      if (!input.jumpHeld && v.y > 0) v.y *= Math.pow(PHYS.cut, dt * 12);
      v.y = Math.max(v.y - PHYS.grav * (v.y < 0 ? PHYS.fallMul : 1) * dt, -40); p.y += v.y * dt;
      if (p.y <= g) {
        const impact = -v.y; p.y = g; v.y = 0; player.onGround = true; player.squash = clamp(impact / 22, 0.05, 0.35);
        if (impact > 5) { AUDIO.land(impact); spawnPuff(p.x, p.y + 0.1, p.z, 0xa8957a, impact > 11 ? 10 : 5); cam.shake = Math.min(0.3, cam.shake + impact * 0.012); }
        if (impact > 16 && player.wade < 0.5) damagePlayer((impact - 16) * 5, null, 'fall');
      }
    } else if (p.y - g > 0.55) { player.onGround = false; v.y = 0; } else p.y = damp(p.y, g, 30, dt);
  }
  player.inside = buildingAt(p.x, p.z, p.y);
  const before = Math.floor(player.stepPhase);
  player.stepPhase += dt * hs / (player.sprinting ? 1.9 : 1.45);
  if (player.onGround && hs > 0.8 && Math.floor(player.stepPhase) !== before) AUDIO.step(surfaceAt(p.x, p.z, p.y), hs);
  if (swim && hs > 0.5 && Math.floor(player.stepPhase) !== before && rand() < 0.5) AUDIO.splash(0.25);
  if (player.swingT > 0) player.swingT = Math.max(0, player.swingT - dt);
  player.lean = damp(player.lean, player.stance === 'prone' || player.sprinting ? 0 : player.leanT, 9, dt);
  animateRig(dt, t, swim ? Math.min(hs, 1.2) : hs);
  const pr = POSE.prone, fx2 = Math.sin(player.yaw), fz2 = Math.cos(player.yaw);
  player.root.position.set(p.x - fx2 * pr * 0.82, p.y + pr * 0.13, p.z - fz2 * pr * 0.82);
  player.root.rotation.set(swim ? 0.5 : pr * 1.5, player.yaw, 0, 'YXZ');
}

/* ── animation: mixer blend + world-space pose overrides ── */
const _rootQ = new THREE.Quaternion(), _RIGHT = new THREE.Vector3();
const POSE = { aim: 0, swing: 0, sit: 0, air: 0, swim: 0, crouch: 0, prone: 0 };
const _yawQ = new THREE.Quaternion(), _hipW = new THREE.Vector3(), _fwdW = new THREE.Vector3();
/* crouching bends the knees and drops the hips; lying down (the whole body turned flat by updatePlayer) crawls on elbows and knees */
function stancePose(dt, t, hs, Bn) {
  const c = POSE.crouch, pr = POSE.prone, walk = Math.min(1, hs / 1.2), ph = player.stepPhase * Math.PI;
  // bodies whose clips turn bones but never move the hips (the scanned characters wear the soldier's clips): what we moved
  // last frame is still there, so put the hips back at rest before sinking them again (else they would sink every frame)
  const hu = Bn.Hips.userData; if (!hu.rest) hu.rest = Bn.Hips.position.clone();
  if (hu.wrote && Bn.Hips.position.equals(hu.wrote)) { Bn.Hips.position.copy(hu.rest); Bn.Hips.updateMatrixWorld(true); }
  hu.wrote = null;
  if (c > 0.01) {
    // the hips sink: move the root bone down in world space after the clip has placed it
    Bn.Hips.getWorldPosition(_hipW); _hipW.y -= 0.4 * c; Bn.Hips.parent.worldToLocal(_hipW); Bn.Hips.position.copy(_hipW); Bn.Hips.updateMatrixWorld(true);
    hu.wrote = Bn.Hips.position.clone();
    const sw = Math.sin(ph) * 0.35 * walk;
    aimLimb(Bn.LeftUpLeg, Bn.LeftLeg, 0.1, -0.42, 0.9 + sw, c, _rootQ); aimLimb(Bn.RightUpLeg, Bn.RightLeg, -0.1, -0.42, 0.9 - sw, c, _rootQ);
    aimLimb(Bn.LeftLeg, Bn.LeftFoot, 0.02, -1, -0.32 - sw * 0.4, c, _rootQ); aimLimb(Bn.RightLeg, Bn.RightFoot, -0.02, -1, -0.32 + sw * 0.4, c, _rootQ);
    _RIGHT.set(-1, 0, 0).applyQuaternion(_rootQ); boneTurn(Bn.Spine, _RIGHT, -0.32 * c);
  }
  if (pr > 0.01) {
    // the body is flat; the head looks up and forward, the legs lie straight with a crawl, the arms reach ahead
    _yawQ.setFromAxisAngle(UP, player.yaw);
    _RIGHT.set(-1, 0, 0).applyQuaternion(_yawQ);
    boneTurn(Bn.Neck, _RIGHT, 0.75 * pr); boneTurn(Bn.Head, _RIGHT, 0.35 * pr);
    const cr = Math.sin(ph * 0.8) * 0.3 * walk;
    _fwdW.set(Math.sin(player.yaw), 0, Math.cos(player.yaw));
    aimLimb(Bn.LeftUpLeg, Bn.LeftLeg, 0.12 + cr * 0.4, -1, 0.0, pr, _rootQ); aimLimb(Bn.RightUpLeg, Bn.RightLeg, -0.12 - cr * 0.4, -1, 0.0, pr, _rootQ);
    aimLimb(Bn.LeftLeg, Bn.LeftFoot, 0.1, -1, -0.15 - Math.max(0, cr), pr, _rootQ); aimLimb(Bn.RightLeg, Bn.RightFoot, -0.1, -1, -0.15 - Math.max(0, -cr), pr, _rootQ);
    if (!(player.armed && isGunTool(player.tool))) {
      aimLimb(Bn.LeftArm, Bn.LeftForeArm, 0.45, 0.0 + cr * 0.3, 0.75, pr, _yawQ); aimLimb(Bn.RightArm, Bn.RightForeArm, -0.45, 0.0 - cr * 0.3, 0.75, pr, _yawQ);
      aimLimb(Bn.LeftForeArm, Bn.LeftHand, -0.3, -0.35, 0.8, pr, _yawQ); aimLimb(Bn.RightForeArm, Bn.RightHand, 0.3, -0.35, 0.8, pr, _yawQ);
    }
  }
  const ln = player.lean;
  if (Math.abs(ln) > 0.01) { _fwdW.set(Math.sin(player.yaw), 0, Math.cos(player.yaw)); boneTurn(Bn.Spine1, _fwdW, -ln * 0.22); boneTurn(Bn.Spine2, _fwdW, -ln * 0.2); }
}
const _gq = new THREE.Quaternion(), _gm = new THREE.Matrix4(), _gx = new THREE.Vector3(), _gy = new THREE.Vector3(), _gz = new THREE.Vector3(), _gp = new THREE.Vector3(), _gv = new THREE.Vector3(), _gr = new THREE.Quaternion();
const GRIP = new THREE.Vector3(0, -0.1, -0.1);
/* the gun is placed every frame: the grip sits in the right hand and the barrel points where the bullets go */
function placeGun() {
  const r = RIG.current; if (!r || !r.visible || !r.userData.gun) return;
  RIG.bones.RightHand.getWorldPosition(_gp);
  if (aiming() || camMode === 'fpp') { camera.getWorldDirection(_gv); _gz.copy(camera.position).addScaledVector(_gv, 40).sub(_gp).normalize(); }
  else _gz.set(Math.sin(player.yaw) * 0.86, -0.5, Math.cos(player.yaw) * 0.86).normalize();
  _gx.crossVectors(UP, _gz).normalize(); _gy.crossVectors(_gz, _gx).normalize();
  _gm.makeBasis(_gx, _gy, _gz); _gq.setFromRotationMatrix(_gm);
  _gp.sub(_gv.copy(GRIP).applyQuaternion(_gq));
  player.root.updateMatrixWorld(true); r.position.copy(player.root.worldToLocal(_gp));
  player.root.getWorldQuaternion(_gr).invert(); r.quaternion.copy(_gr.multiply(_gq));
}
function animateRig(dt, t, hs) { if (!RIG.ok) return; _animateRig(dt, t, hs); placeGun(); }
function _animateRig(dt, t, hs) {
  const A = RIG.act, idleW = smooth(0.6, 0.1, hs), runW = smooth(2.6, 4.0, hs), walkW = Math.max(0, 1 - idleW - runW);
  const sitting = !!player.vehicle && !player.vehicle.spec.stand;
  if (A.Idle) A.Idle.setEffectiveWeight(sitting ? 1 : idleW);
  if (A.Walk) { A.Walk.setEffectiveWeight(sitting ? 0 : walkW); A.Walk.timeScale = clamp(hs / 1.45, 0.5, 1.8); }
  if (A.Run) { A.Run.setEffectiveWeight(sitting ? 0 : runW); A.Run.timeScale = clamp(hs / 4.9, 0.7, 1.45); }
  RIG.mixer.update(player.alive ? dt : 0);
  const lowReady = player.armed && isGunTool(player.tool) && !player.vehicle && player.alive;
  POSE.aim = damp(POSE.aim, aiming() || player.reloadT > 0 ? 1 : lowReady ? 0.55 : 0, 12, dt);
  POSE.sit = damp(POSE.sit, sitting ? 1 : 0, 10, dt);
  POSE.air = damp(POSE.air, !player.onGround && !sitting && !player.swimming ? 1 : 0, 8, dt);
  POSE.swim = damp(POSE.swim, player.swimming ? 1 : 0, 6, dt);
  POSE.crouch = damp(POSE.crouch, player.stance === 'crouch' && !sitting ? 1 : 0, 9, dt);
  POSE.prone = damp(POSE.prone, player.stance === 'prone' && !sitting ? 1 : 0, 5, dt);
  player.root.updateMatrixWorld(true);
  player.root.getWorldQuaternion(_rootQ);
  const Bn = RIG.bones;
  if (POSE.crouch > 0.01 || POSE.prone > 0.01 || Math.abs(player.lean) > 0.01) stancePose(dt, t, hs, Bn);
  if (POSE.sit > 0.01) {
    const ride = player.vehicle && player.vehicle.spec.ride;      // astride a horse or a bike: knees apart
    aimLimb(Bn.LeftUpLeg, Bn.LeftLeg, ride ? 0.6 : 0.1, -0.15, 1, POSE.sit, _rootQ); aimLimb(Bn.RightUpLeg, Bn.RightLeg, ride ? -0.6 : -0.1, -0.15, 1, POSE.sit, _rootQ);
    aimLimb(Bn.LeftLeg, Bn.LeftFoot, 0.05, -1, ride ? -0.1 : 0.2, POSE.sit, _rootQ); aimLimb(Bn.RightLeg, Bn.RightFoot, -0.05, -1, ride ? -0.1 : 0.2, POSE.sit, _rootQ);
    aimLimb(Bn.LeftArm, Bn.LeftForeArm, 0.2, -0.55, 0.8, POSE.sit, _rootQ); aimLimb(Bn.RightArm, Bn.RightForeArm, -0.2, -0.55, 0.8, POSE.sit, _rootQ);
    aimLimb(Bn.LeftForeArm, Bn.LeftHand, -0.25, 0.05, 1, POSE.sit, _rootQ); aimLimb(Bn.RightForeArm, Bn.RightHand, 0.25, 0.05, 1, POSE.sit, _rootQ);
    return;
  }
  if (POSE.swim > 0.01) {
    const s = Math.sin(t * 4.2), c = Math.cos(t * 4.2);
    aimLimb(Bn.LeftArm, Bn.LeftForeArm, 0.7 + s * 0.3, 0.1, 0.6 + c * 0.4, POSE.swim, _rootQ); aimLimb(Bn.RightArm, Bn.RightForeArm, -0.7 - s * 0.3, 0.1, 0.6 - c * 0.4, POSE.swim, _rootQ);
    aimLimb(Bn.LeftUpLeg, Bn.LeftLeg, 0.08, -1, -0.3 + s * 0.4, POSE.swim * 0.8, _rootQ); aimLimb(Bn.RightUpLeg, Bn.RightLeg, -0.08, -1, -0.3 - s * 0.4, POSE.swim * 0.8, _rootQ);
    return;
  }
  if (POSE.air > 0.01) {
    aimLimb(Bn.LeftUpLeg, Bn.LeftLeg, 0.05, -0.7, 0.7, POSE.air * 0.8, _rootQ); aimLimb(Bn.LeftLeg, Bn.LeftFoot, 0, -1, -0.5, POSE.air * 0.8, _rootQ);
    aimLimb(Bn.RightUpLeg, Bn.RightLeg, -0.05, -0.9, 0.2, POSE.air * 0.7, _rootQ); aimLimb(Bn.RightLeg, Bn.RightFoot, 0, -1, -0.6, POSE.air * 0.7, _rootQ);
  }
  const look = clamp(cam.pitch, -0.9, 0.9);
  if (POSE.prone > 0.5) { _yawQ.setFromAxisAngle(UP, player.yaw); _rootQ.copy(_yawQ); }
  if (POSE.aim > 0.01) {
    _RIGHT.set(-1, 0, 0).applyQuaternion(_rootQ);
    boneTurn(Bn.Spine2, _RIGHT, -look * 0.55 * POSE.aim);
    const rl = player.reloadT > 0 ? 0.6 : 0, pistol = player.tool === 'pistol';
    aimLimb(Bn.RightArm, Bn.RightForeArm, -0.3, -0.72 + (pistol ? 0.6 : 0), 0.42 + (pistol ? 0.4 : 0), POSE.aim, _rootQ);
    aimLimb(Bn.RightForeArm, Bn.RightHand, 0.3, 0.05 - rl * 0.4, 0.95, POSE.aim, _rootQ);
    aimLimb(Bn.LeftArm, Bn.LeftForeArm, 0.35, -0.5 - rl * 0.3, 0.7, POSE.aim, _rootQ);
    aimLimb(Bn.LeftForeArm, Bn.LeftHand, -0.42, 0.05 - rl * 0.5, 0.9, POSE.aim, _rootQ);
  }
  if (player.swingT > 0) {
    const s = 1 - player.swingT / player.swingDur, two = player.tool === 'axe' || player.tool === 'pickaxe' || player.tool === 'shovel' || player.tool === 'hoe';
    const wind = smooth(0, 0.42, s) * (1 - smooth(0.42, 0.62, s)), strike = smooth(0.42, 0.62, s) * (1 - smooth(0.75, 1, s));
    const w = Math.max(wind, strike);
    if (player.tool === 'hand') {
      aimLimb(Bn.RightArm, Bn.RightForeArm, -0.15, -0.1 + wind * -0.4, 0.9, strike, _rootQ); aimLimb(Bn.RightForeArm, Bn.RightHand, 0, 0.05, 1, strike, _rootQ);
    } else if (player.tool === 'rod') {
      aimLimb(Bn.RightArm, Bn.RightForeArm, -0.2, lerp(0.9, 0.1, strike / Math.max(w, 1e-3)), 0.5, w, _rootQ);
    } else {
      const ux = -0.25, uy = lerp(0.85, -0.55, strike / Math.max(w, 1e-3)), uz = lerp(-0.25, 0.75, strike / Math.max(w, 1e-3));
      aimLimb(Bn.RightArm, Bn.RightForeArm, ux, uy, uz, w, _rootQ); aimLimb(Bn.RightForeArm, Bn.RightHand, 0.15, uy * 0.6 + 0.2, uz + 0.3, w, _rootQ);
      if (two) { aimLimb(Bn.LeftArm, Bn.LeftForeArm, 0.15, uy * 0.8, uz, w * 0.9, _rootQ); aimLimb(Bn.LeftForeArm, Bn.LeftHand, -0.3, uy * 0.5 + 0.2, uz + 0.3, w * 0.9, _rootQ); }
      _RIGHT.set(-1, 0, 0).applyQuaternion(_rootQ); boneTurn(Bn.Spine1, _RIGHT, (strike * 0.35 - wind * 0.2));
    }
  }
}

/* ── cameras: close over-the-shoulder, or chest-mounted bodycam ── */
let camMode = 'tpp';
const cam = { yaw: 0, pitch: 0.18, tyaw: 0, tpitch: 0.18, vyaw: 0, vpitch: 0, dist: 3.0, user: 3.0, frac: 1, lift: 0, kick: 0, shake: 0, fov: 62, roll: 0,
  focus: new THREE.Vector3(), pos: new THREE.Vector3(), look: new THREE.Vector3(), dragging: false };
const _tgt = new THREE.Vector3(), _want = new THREE.Vector3(), _pt = new THREE.Vector3(), _rgt = new THREE.Vector3(), _chest = new THREE.Vector3();
function camBlocked(v) {
  if (terrainAt(v.x, v.z) + 0.12 > v.y) return true;
  let hit = false;
  OGRID.each(v.x - 0.3, v.z - 0.3, v.x + 0.3, v.z + 0.3, (o) => {
    if (v.y > o.top || (o.bot !== undefined && v.y < o.bot)) return;
    if (o.t === 'c' ? Math.hypot(v.x - o.x, v.z - o.z) < o.r + 0.2 : (Math.abs(v.x - o.x) < o.hx + 0.2 && Math.abs(v.z - o.z) < o.hz + 0.2)) { hit = true; return false; }
  });
  if (hit) return true;
  // parked and passing cars too: the camera never ends up inside a body
  for (const ve of VEHICLES) {
    if (ve === player.vehicle || !ve.cols) continue;
    for (const c of ve.cols) if (!c.off && v.y < c.y1 - 0.1 && v.y > c.y0 && Math.hypot(v.x - c.x, v.z - c.z) < c.r + 0.25) return true;
  }
  return false;
}
function updateCamera(dt, snap) {
  // the drop has no sights: a scope still up when the plane takes you closes (and the body under it shows again)
  if (DROP.state) { if (SCOPE.on || SCOPE.k) { SCOPE.on = false; SCOPE.k = 0; if (RIG.body) RIG.body.root.visible = true; } dropCamera(dt); return; }
  if (!cam.dragging) { cam.tyaw += cam.vyaw * dt; cam.tpitch += cam.vpitch * dt; cam.vyaw *= Math.exp(-dt * 7); cam.vpitch *= Math.exp(-dt * 7); }
  cam.tpitch = clamp(cam.tpitch, camMode === 'fpp' ? -1.2 : -0.55, camMode === 'fpp' ? 1.3 : 1.15);
  const kA = snap ? 1 : 1 - Math.exp(-dt * (camMode === 'fpp' ? 30 : 18));
  cam.yaw = angLerp(cam.yaw, cam.tyaw, kA); cam.pitch = lerp(cam.pitch, cam.tpitch, kA);
  const veh = player.vehicle, p = veh ? veh.pos : player.pos;
  const pitch = cam.pitch - cam.kick, cp = Math.cos(pitch), sp = Math.sin(pitch);
  _rgt.set(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw));
  SCOPE.k = damp(SCOPE.k, SCOPE.on ? 1 : 0, 16, dt);
  const scoped = SCOPE.k > 0.5 && RIG.ok && player.alive && !veh;
  if (RIG.body) RIG.body.root.visible = !scoped;
  if (scoped) {
    // through the sight: the eye, a hand's width ahead of the head, leaning with you; a scope sways a little with your breath
    const fwdX = -Math.sin(cam.yaw), fwdZ = -Math.cos(cam.yaw), g = gunSpec();
    RIG.bones.Head.getWorldPosition(_chest);
    const sway = g.zoom >= 3 ? (player.stance === 'prone' ? 0.15 : player.stance === 'crouch' ? 0.5 : 1) * g.sway * 0.0016 * g.zoom : 0;
    cam.pos.set(_chest.x + fwdX * 0.14 + _rgt.x * player.lean * 0.12, _chest.y + 0.05, _chest.z + fwdZ * 0.14 + _rgt.z * player.lean * 0.12);
    const sp2 = Math.sin(pitch + Math.sin(T * 1.3) * sway), cp2 = Math.cos(pitch), yw = cam.yaw + Math.sin(T * 0.9) * sway * 0.8;
    cam.look.set(cam.pos.x - Math.sin(yw) * cp2 * 10, cam.pos.y - sp2 * 10, cam.pos.z - Math.cos(yw) * cp2 * 10);
    cam.roll = damp(cam.roll, -player.lean * 0.1, 8, dt);
  } else if (camMode === 'fpp' && RIG.ok && player.alive) {
    const fwdX = -Math.sin(cam.yaw), fwdZ = -Math.cos(cam.yaw);
    if (veh) { RIG.bones.Head.getWorldPosition(_chest); cam.pos.set(_chest.x + fwdX * 0.1, _chest.y + 0.08, _chest.z + fwdZ * 0.1); }
    else { RIG.bones.Spine2.getWorldPosition(_chest); cam.pos.set(_chest.x + fwdX * 0.22 + _rgt.x * player.lean * 0.25, _chest.y + 0.1, _chest.z + fwdZ * 0.22 + _rgt.z * player.lean * 0.25); }
    cam.look.set(cam.pos.x - Math.sin(cam.yaw) * cp * 10, cam.pos.y - sp * 10, cam.pos.z - Math.cos(cam.yaw) * cp * 10);
    cam.roll = SET.motion ? -player.lean * 0.12 : damp(cam.roll, Math.sin(player.stepPhase * Math.PI) * 0.018 * Math.min(1, player.speed / 3) + (input.mx * -0.02) - player.lean * 0.12, 8, dt);
    if (RIG.visor) RIG.visor.visible = false;
    for (const k of ['hat', 'glasses']) if (RIG.body && RIG.body.acc[k]) RIG.body.acc[k].visible = false;
  } else {
    if (RIG.visor) RIG.visor.visible = true;
    for (const k of ['hat', 'glasses']) if (RIG.body && RIG.body.acc[k]) RIG.body.acc[k].visible = true;
    cam.roll = damp(cam.roll, 0, 8, dt);
    const k = snap ? 1 : 1 - Math.exp(-dt * 20), ky = snap ? 1 : 1 - Math.exp(-dt * 10);
    const fh = veh ? veh.spec.fh : player.swimming ? 0.9 : lerp(lerp(1.62, 1.12, POSE.crouch), 0.55, POSE.prone);
    cam.focus.x = lerp(cam.focus.x, p.x, k); cam.focus.z = lerp(cam.focus.z, p.z, k); cam.focus.y = lerp(cam.focus.y, p.y + fh, ky);
    const want = veh ? veh.spec.cam + Math.min(1.6, Math.abs(veh.speed) * 0.05) : aiming() ? 1.55 : player.armed && isGunTool(player.tool) ? 2.2 : cam.user;
    cam.dist = damp(cam.dist, want, 7, dt);
    const sh = veh ? 0 : (aiming() ? 0.55 : 0.46) + player.lean * 0.42;
    _tgt.copy(cam.focus).addScaledVector(_rgt, sh); _tgt.y -= Math.abs(player.lean) * 0.08;
    _want.set(_tgt.x + Math.sin(cam.yaw) * cp * cam.dist, _tgt.y + sp * cam.dist + (veh ? 0 : 0.16), _tgt.z + Math.cos(cam.yaw) * cp * cam.dist);
    const lift = Math.max(0, groundAt(_want.x, _want.z, _want.y + 0.5) + 0.55 - _want.y);
    cam.lift = snap ? lift : lift > cam.lift ? damp(cam.lift, lift, 14, dt) : damp(cam.lift, lift, 3, dt);
    _want.y += cam.lift;
    let free = 1;
    for (let s = 0.12; s <= 1.0001; s += 0.08) { _pt.lerpVectors(_tgt, _want, s); if (camBlocked(_pt)) { free = Math.max(0.1, s - 0.1); break; } }
    cam.frac = free < cam.frac ? free : damp(cam.frac, free, 3.5, dt);
    cam.pos.lerpVectors(_tgt, _want, cam.frac);
    const gmin = groundAt(cam.pos.x, cam.pos.z, cam.pos.y) + 0.35; if (cam.pos.y < gmin) cam.pos.y = gmin;
    cam.look.set(_tgt.x - Math.sin(cam.yaw) * cp * 20, _tgt.y - sp * 20 + 0.3, _tgt.z - Math.cos(cam.yaw) * cp * 20);
  }
  if (cam.shake > 0.001) { const sk = cam.shake * 0.5 * SET.shake * (SET.motion ? 0.3 : 1); cam.pos.x += (Math.random() - 0.5) * sk; cam.pos.y += (Math.random() - 0.5) * sk; cam.shake *= Math.exp(-dt * 9); }
  cam.kick = damp(cam.kick, 0, 9, dt);
  const fb = SET.fov - 62, zoomFov = scoped ? 66 / Math.max(1.25, gunSpec().zoom) : 0;
  const fovT = scoped ? zoomFov : camMode === 'fpp' ? (aiming() ? 70 : (veh ? 84 : 92) + fb * 0.8) : aiming() ? 48 : (veh ? 62 + Math.min(16, Math.abs(veh.speed) * 0.45) : player.sprinting && !SET.motion ? 68 : 62) + fb;
  cam.fov = scoped ? damp(cam.fov, fovT, 18, dt) : damp(cam.fov, fovT, 6, dt);
  if (Math.abs(camera.fov - cam.fov) > 0.05) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }
}
function attractCameraPose(t, outPos, outLook) {
  const s = WORLD.data ? WORLD.data.spawn : { x: 0, z: 0 }, a = t * 0.03 + 0.6;
  outPos.set(s.x + Math.sin(a) * 420, 190, s.z - Math.cos(a) * 420); outLook.set(s.x, 20, s.z);
}
