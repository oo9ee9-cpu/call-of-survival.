/* ═════════ combat: particles, tracers, guns and melee, loot on the ground, zombies, health ═════════ */
let KILLS = 0, BEST = 0, SURVIVE_T = 0, hudDirty = true;
try { BEST = parseInt(localStorage.getItem('rock-island-best') || '0', 10) || 0; } catch (_) {}
const GUNS = {
  pistol: { rate: 0.22, dmg: 30, head: 75, range: 90, spread: 0.008, mag: 12, ammo: 'ammo9', pellets: 1, reload: 1.3, kick: 0.009 },
  rifle: { rate: 0.105, dmg: 34, head: 100, range: 160, spread: 0.005, mag: 30, ammo: 'ammo556', pellets: 1, reload: 1.8, kick: 0.013 },
  shotgun: { rate: 0.75, dmg: 18, head: 30, range: 45, spread: 0.05, mag: 6, ammo: 'shells', pellets: 8, reload: 2.4, kick: 0.03 },
  sniper: { rate: 1.1, dmg: 110, head: 260, range: 400, spread: 0.0008, mag: 5, ammo: 'ammo762', pellets: 1, reload: 2.6, kick: 0.04 },
};
const MELEE = { hand: { dmg: 12, dur: 0.45, reach: 1.6 }, axe: { dmg: 45, dur: 0.7, reach: 2.1 }, pickaxe: { dmg: 38, dur: 0.75, reach: 2.1 }, sword: { dmg: 70, dur: 0.5, reach: 2.3 },
  hammer: { dmg: 25, dur: 0.6, reach: 1.9 }, knife: { dmg: 32, dur: 0.35, reach: 1.6 }, spear: { dmg: 55, dur: 0.6, reach: 2.8 }, shovel: { dmg: 30, dur: 0.7, reach: 2.1 }, hoe: { dmg: 18, dur: 0.6, reach: 2.0 }, rod: { dmg: 4, dur: 0.6, reach: 1.6 }, torch: { dmg: 14, dur: 0.5, reach: 1.7 }, bow: { dmg: 8, dur: 0.5, reach: 1.6 } };
const TIER_MUL = { wood: 0.7, stone: 0.85, copper: 1.0, iron: 1.2, steel: 1.45, gold: 1.3, diamond: 1.8 };

/* particles: small debris is solid (chips, blood, stone), bigger puffs are soft camera-facing dust */
const PMAX = 320, PART = [];
const _col = new THREE.Color();
const pMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), PMAX);
const PUFF_TEX = canvasTex(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 2, 32, 32, 31); r.addColorStop(0, 'rgba(255,255,255,0.85)'); r.addColorStop(0.45, 'rgba(255,255,255,0.4)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); }, false);
const sMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: PUFF_TEX, transparent: true, depthWrite: false, fog: true }), PMAX);
for (const m of [pMesh, sMesh]) { for (let i = 0; i < PMAX; i++) m.setColorAt(i, _col.setRGB(1, 1, 1)); m.frustumCulled = false; m.count = 0; scene.add(m); }
sMesh.renderOrder = 3;
const _m4 = new THREE.Matrix4(), _q4 = new THREE.Quaternion(), _v4 = new THREE.Vector3(), _s4 = new THREE.Vector3(), _e4 = new THREE.Euler(), _qz = new THREE.Quaternion(), _zAx = new THREE.Vector3(0, 0, 1), _pc = new THREE.Color();
function spawnPuff(x, y, z, color, n = 6, speed = 2.2, size = 0.12, grav = -6, life = 0.7) {
  const c = C(color), soft = size >= 0.15;
  for (let i = 0; i < n && PART.length < PMAX * 2 - 4; i++) {
    const a = rr(0, TAU), up = rr(0.3, 1);
    PART.push({ x, y, z, vx: Math.cos(a) * speed * rr(0.3, 1), vy: up * speed, vz: Math.sin(a) * speed * rr(0.3, 1), t: 0, life: life * rr(0.6, 1.2) * (soft ? 1.4 : 1), s: size * rr(0.6, 1.4) * (soft ? 2.2 : 1), c, g: soft ? Math.max(grav, -1) * 0.3 : grav, r: rr(0, 6), soft });
  }
}
function updateParticles(dt) {
  let n = 0, m = 0;
  const lk = 0.16 + 0.84 * Math.max(ENV.day, ENV.dusk * 0.6);
  for (let i = PART.length - 1; i >= 0; i--) {
    const p = PART[i]; p.t += dt;
    if (p.t > p.life) { PART[i] = PART[PART.length - 1]; PART.pop(); continue; }
    const k = p.t / p.life;
    if (p.soft) {
      const drag = Math.exp(-dt * 2.2); p.vx *= drag; p.vz *= drag; p.vy = p.vy * drag + p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (m >= PMAX) continue;
      const sc = p.s * (0.55 + 1.1 * k) * (k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1);
      _qz.setFromAxisAngle(_zAx, p.r + p.t * 0.6); _q4.copy(camera.quaternion).multiply(_qz);
      sMesh.setMatrixAt(m, _m4.compose(_v4.set(p.x, p.y, p.z), _q4, _s4.set(sc, sc, sc))); sMesh.setColorAt(m, _pc.copy(p.c).multiplyScalar(lk)); m++;
    } else {
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const gy = groundAt(p.x, p.z, p.y + 0.2); if (p.y < gy) { p.y = gy; p.vx *= 0.5; p.vz *= 0.5; p.vy = 0; }
      if (n >= PMAX) continue;
      const sc = p.s * (1 - k * 0.6);
      _e4.set(p.r + p.t * 3, p.r, 0); _q4.setFromEuler(_e4);
      pMesh.setMatrixAt(n, _m4.compose(_v4.set(p.x, p.y, p.z), _q4, _s4.set(sc, sc, sc))); pMesh.setColorAt(n, p.c); n++;
    }
  }
  pMesh.count = n; pMesh.instanceMatrix.needsUpdate = true; if (pMesh.instanceColor) pMesh.instanceColor.needsUpdate = true;
  sMesh.count = m; sMesh.instanceMatrix.needsUpdate = true; if (sMesh.instanceColor) sMesh.instanceColor.needsUpdate = true;
}
const TRACERS = [];
const tracerMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.4, 1.2), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
for (let i = 0; i < 12; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 1), tracerMat); m.visible = false; scene.add(m); TRACERS.push({ m, t: 0 }); }
let tracerIdx = 0;
function tracer(a, b) { const tr = TRACERS[tracerIdx++ % TRACERS.length], L = a.distanceTo(b); tr.m.position.lerpVectors(a, b, 0.5); tr.m.lookAt(b); tr.m.scale.set(1, 1, L); tr.m.visible = true; tr.t = 0.045; }
const flashTex = canvasTex(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 2, 32, 32, 32); r.addColorStop(0, 'rgba(255,250,220,1)'); r.addColorStop(0.3, 'rgba(255,190,90,.9)'); r.addColorStop(1, 'rgba(255,120,30,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });
const flashMat = new THREE.MeshBasicMaterial({ map: flashTex, color: new THREE.Color(3, 2.6, 2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const muzzleFlash = new THREE.Group();
for (let k = 0; k < 3; k++) { const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.45), flashMat); pl.rotation.set(k === 2 ? Math.PI / 2 : 0, k === 1 ? Math.PI / 2 : 0, 0); muzzleFlash.add(pl); }
muzzleFlash.visible = false;
let flashT = 0;
function updateEffects(dt) {
  for (const tr of TRACERS) if (tr.m.visible) { tr.t -= dt; if (tr.t <= 0) tr.m.visible = false; }
  if (flashT > 0) { flashT -= dt; if (flashT <= 0) { muzzleFlash.visible = false; muzzleLight.intensity = 0; } }
}

/* ── ray tests against the ground, walls, trees, rocks ── */
function rayWorld(o, d, tMin, tMax) {
  let best = tMax, kind = null, prev = tMin;
  for (let t = tMin; t <= tMax; t += 0.8) {
    const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
    if (y < terrainAt(x, z)) { let lo = prev, hi = t; for (let k = 0; k < 7; k++) { const m = (lo + hi) / 2; if (o.y + d.y * m < terrainAt(o.x + d.x * m, o.z + d.z * m)) hi = m; else lo = m; } best = hi; kind = 'ground'; break; }
    prev = t;
  }
  // walls and solid props along the ray
  const ex = o.x + d.x * best, ez = o.z + d.z * best;
  OGRID.each(Math.min(o.x, ex) - 1, Math.min(o.z, ez) - 1, Math.max(o.x, ex) + 1, Math.max(o.z, ez) + 1, (ob) => {
    let tHit = Infinity;
    if (ob.t === 'b') {
      let t0 = tMin, t1 = best;
      for (const [oa, da, lo, hi] of [[o.x, d.x, ob.x - ob.hx, ob.x + ob.hx], [o.y, d.y, ob.bot !== undefined ? ob.bot : -60, ob.top], [o.z, d.z, ob.z - ob.hz, ob.z + ob.hz]]) {
        if (Math.abs(da) < 1e-8) { if (oa < lo || oa > hi) { t0 = Infinity; break; } continue; }
        let a = (lo - oa) / da, b = (hi - oa) / da; if (a > b) [a, b] = [b, a];
        t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) { t0 = Infinity; break; }
      }
      tHit = t0;
    } else {
      const ox = o.x - ob.x, oz = o.z - ob.z, A = d.x * d.x + d.z * d.z, B = 2 * (ox * d.x + oz * d.z), Cc = ox * ox + oz * oz - ob.r * ob.r, D = B * B - 4 * A * Cc;
      if (D >= 0 && A > 1e-8) { const t = (-B - Math.sqrt(D)) / (2 * A); if (t > tMin && o.y + d.y * t < (ob.top || 1e9)) tHit = t; }
    }
    if (tHit < best) { best = tHit; kind = 'solid'; }
  });
  // tree trunks and boulders
  const steps = Math.ceil(best / 16);
  for (let s = 0; s <= steps; s++) {
    const cx = o.x + d.x * Math.min(best, s * 16), cz = o.z + d.z * Math.min(best, s * 16);
    treesNear(cx, cz, 10, (t) => {
      const va = VEG.species[t.id].variants[t.v], r = Math.max(0.15, va.trunkR * t.s), ox = o.x - t.x, oz = o.z - t.z, A = d.x * d.x + d.z * d.z, B = 2 * (ox * d.x + oz * d.z), Cc = ox * ox + oz * oz - r * r, D = B * B - 4 * A * Cc;
      if (t.bush || D < 0 || A < 1e-8) return;
      const th = (-B - Math.sqrt(D)) / (2 * A); if (th > tMin && th < best && o.y + d.y * th < t.y + va.height * t.s * 0.7) { best = th; kind = 'wood'; }
    });
    if (typeof rocksNear === 'function') rocksNear(cx, cz, 10, (r) => {
      const R = r.r * 0.8, ox = o.x - r.x, oy = o.y - (r.y + R * 0.3), oz = o.z - r.z, B = ox * d.x + oy * d.y + oz * d.z, Cc = ox * ox + oy * oy + oz * oz - R * R, D = B * B - Cc;
      if (D < 0) return; const th = -B - Math.sqrt(D); if (th > tMin && th < best) { best = th; kind = 'rock'; }
    });
  }
  return kind ? { t: best, kind } : null;
}
/* everything alive that a bullet can hit: zombies, bots, animals all expose hit spheres */
const TARGET_LISTS = [];
function rayTargets(o, d, tMin, tMax, skip) {
  let best = null;
  for (const L of TARGET_LISTS) for (const z of L()) {
    if (z === skip || !z.active || z.state === 'dead' || !z.hits) continue;
    if (Math.abs(z.x - o.x) > tMax + 3 && Math.abs(z.z - o.z) > tMax + 3) continue;
    for (const [pt, r0, head] of z.hits) {
      const r = r0 * (z.scale || 1), cx = pt.x - o.x, cy = pt.y - o.y, cz = pt.z - o.z, t = cx * d.x + cy * d.y + cz * d.z;
      if (t < tMin || t > tMax) continue;
      const d2 = cx * cx + cy * cy + cz * cz - t * t; if (d2 > r * r) continue;
      const th = t - Math.sqrt(r * r - d2); if (!best || th < best.t) best = { z, t: th, head };
    }
  }
  return best;
}
function hurtTarget(z, dmg, head, dir, from) { if (z.hurt) z.hurt(dmg, head, dir, from); }

/* ── guns: each has its own feel (33_arsenal), changed by what is fitted to it ── */
const _ro = new THREE.Vector3(), _rd = new THREE.Vector3(), _hp = new THREE.Vector3(), _mz = new THREE.Vector3();
const gunSpec = () => gunSpecOf(player.toolItem);
function startReload() {
  const g = gunSpec(); if (!player.armed || player.reloadT > 0 || player.mag >= g.mag) return;
  if (typeof invCount === 'function' && invCount(g.ammo) <= 0) { toast('لا ذخيرة لهذا السلاح', 'يحتاج ' + (ITEMS[g.ammo] ? ITEMS[g.ammo].name : 'ذخيرة') + ' · ابحث في البيوت والقواعد أو اصنعها على طاولة الأسلحة'); return; }
  // pump guns and bolt rifles load a round at a time: a short top-up is quicker than a full one
  const k = g.pump || g.bolt ? clamp((g.mag - player.mag) / g.mag, 0.3, 1) : 1;
  player.reloadT = g.reload * k * (player.speed > 4 ? 1.1 : 1); player.reloadMax = player.reloadT; AUDIO.reload(); hudDirty = true;
}
function fire(t) {
  if (!player.armed || !player.alive || player.reloadT > 0 || player.fireCD > 0) return false;
  const g = gunSpec(), it = ITEMS[player.toolItem], mul = (it && it.dmgMul || 1) * upMul('gun') * (typeof skinMul === 'function' ? skinMul(player.toolItem) : 1);
  if (player.mag <= 0) { if (invCount(g.ammo) > 0) startReload(); else { AUDIO.dry(); player.fireCD = 0.35; toast('نفدت الذخيرة', 'يحتاج ' + (ITEMS[g.ammo] ? ITEMS[g.ammo].name : 'ذخيرة')); } return false; }
  player.mag--; player.fireCD = g.rate; player.lastShot = t; hudDirty = true; if (player.toolItem) MAGS[player.toolItem] = player.mag;
  const gun = RIG.current; if (gun) gun.updateMatrixWorld(true);
  if (gun && gun.userData.muzzle) _mz.copy(gun.userData.muzzle); else _mz.set(0, 0.02, 0.97);
  const mz = gun ? gun.localToWorld(_mz) : player.pos.clone().setY(player.pos.y + 1.4);
  if (g.flare) { fireFlare(mz); AUDIO.shot('pistol'); cam.kick += g.kick; return true; }
  const assist = SET.aimAssist ? assistDir() : null, scope = SCOPE.on, cls = GUN_CLASS[g.cls];
  for (let k = 0; k < g.pellets; k++) {
    camera.getWorldDirection(_rd); if (assist) _rd.lerp(assist, 0.8).normalize();
    const moving = player.speed > 1, stance = player.stance === 'prone' ? 0.5 : player.stance === 'crouch' ? 0.75 : 1;
    const spr = g.spread * g.spreadK * (scope ? 0.35 : aiming() && input.aim ? 0.6 : cls.hipK * 0.55) * (moving ? 1.8 : 1) * (player.onGround ? 1 : 3) * stance * (g.pellets > 1 ? 1 : 1 + Math.min(1.5, RECOIL.heat * 0.5));
    _rd.x += (Math.random() - 0.5) * spr * 2; _rd.y += (Math.random() - 0.5) * spr * 2; _rd.z += (Math.random() - 0.5) * spr * 2; _rd.normalize();
    _ro.copy(camera.position);
    const tMin = camMode === 'fpp' || scope ? 0.3 : Math.max(0.5, (player.pos.x - _ro.x) * _rd.x + (player.pos.y + 1.4 - _ro.y) * _rd.y + (player.pos.z - _ro.z) * _rd.z - 0.3);
    const w = rayWorld(_ro, _rd, tMin, g.range), zh = rayTargets(_ro, _rd, tMin, w ? w.t : g.range, null);
    const tEnd = zh ? zh.t : w ? w.t : g.range;
    _hp.copy(_ro).addScaledVector(_rd, tEnd);
    if (k < 3 && g.ammo !== 'bolts') tracer(mz, _hp);
    if (k === 0) HOOK.shot(mz, _hp, player.tool);
    // damage falls off past the gun's reach (shotgun pellets much sooner)
    const fall = clamp(1 - Math.max(0, tEnd - g.range * 0.5) / (g.range * 0.9), 0.35, 1);
    if (zh) { hurtTarget(zh.z, g.dmg * (zh.head ? g.head : 1) * mul * fall, zh.head, _rd, 'player'); spawnPuff(_hp.x, _hp.y, _hp.z, zh.z.blood || 0x4a1210, zh.head ? 14 : 8, 2.6, 0.08, -9, 0.6); const hc = hitColor(); if (hc) spawnPuff(_hp.x, _hp.y, _hp.z, hc, 5, 4, 0.05, -10, 0.25); hitMarker(zh.head); }
    else if (w) { spawnPuff(_hp.x, _hp.y, _hp.z, w.kind === 'wood' ? 0x7a5a3a : w.kind === 'ground' ? 0x9a8a6a : 0xb8b0a0, g.pellets > 1 ? 3 : 7, 2.0, 0.09, -6, 0.7); if (k === 0) spawnPuff(_hp.x, _hp.y, _hp.z, 0xffd27a, 2, 5, 0.04, -12, 0.15); }
  }
  if (g.flashOn) {
    if (gun && muzzleFlash.parent !== gun) gun.add(muzzleFlash);
    muzzleFlash.position.copy(_mz).setZ(_mz.z + 0.08);
    muzzleFlash.visible = true; muzzleFlash.rotation.z = rr(0, TAU); muzzleFlash.scale.setScalar(rr(0.8, 1.25) * (g.cls === 'pistol' ? 0.55 : g.cls === 'smg' ? 0.75 : 1)); flashT = 0.05;
    muzzleLight.position.copy(mz); muzzleLight.intensity = 6;
  }
  // recoil: the barrel climbs a little more with every shot of a burst, a grip or a compensator tames it, crouching or lying even more
  const stanceK = player.stance === 'prone' ? 0.45 : player.stance === 'crouch' ? 0.75 : 1;
  RECOIL.heat = Math.min(4, RECOIL.heat + 1);
  const climb = g.kickV * stanceK * (0.75 + RECOIL.heat * 0.12) * (scope ? 1.1 : 1);
  cam.kick += climb * 0.9; cam.tpitch -= climb * 0.16 * (scope ? 1.5 : 1); cam.tyaw += (Math.random() - 0.5) * g.kickH * stanceK * 0.5;
  cam.shake = Math.min(0.14, cam.shake + (g.cls === 'sr' ? 0.08 : 0.035) * (scope ? 0.4 : 1));
  AUDIO.shot(g.cls === 'pistol' || g.cls === 'smg' ? 'pistol' : g.cls === 'sg' ? 'shotgun' : g.cls === 'sr' || g.cls === 'dmr' ? 'sniper' : 'rifle', 0, !g.loud);
  NOISE.x = player.pos.x; NOISE.z = player.pos.z; NOISE.t = T; NOISE.r = g.loud ? (g.cls === 'pistol' || g.cls === 'smg' ? 70 : 120) : 18;
  if (g.bolt) { RECOIL.boltT = Math.min(g.rate, 1.2); }
  return true;
}
const RECOIL = { heat: 0, boltT: 0 };
const SCOPE = { on: false, k: 0 };
const NOISE = { x: 0, z: 0, t: -99, r: 0 };     // gunshots carry: zombies and animals react
/* aim assist (a setting): the shot leans toward the nearest zombie or hostile within a few degrees of the crosshair */
const _ad = new THREE.Vector3(), _at = new THREE.Vector3(), _ab = new THREE.Vector3();
function assistDir() {
  camera.getWorldDirection(_ad); let ba = 0.075, found = false;
  const consider = (z) => {
    if (!z.active || z.state === 'dead' || !z.hits) return;
    _at.copy(z.hits[1][0]).sub(camera.position); const d = _at.length(); if (d > 95 || d < 1) return;
    _at.divideScalar(d); const a = Math.acos(clamp(_at.dot(_ad), -1, 1)); if (a < ba) { ba = a; _ab.copy(_at); found = true; }
  };
  for (const z of ZOMBIES) consider(z);
  if (typeof BOTS !== 'undefined') for (const b of BOTS) if (b.angry) consider(b);
  return found ? _ab : null;
}
/* ── melee and harvesting share one swing ── */
function startSwing() {
  if (player.swingT > 0 || !player.alive || player.vehicle) return;
  const m = MELEE[player.tool] || MELEE.hand, it = ITEMS[player.toolItem], dur = (it && it.swing) || m.dur;
  player.swingDur = dur; player.swingT = dur; player.swingHit = false; AUDIO.swing();
}
function swingImpact() {
  const m = MELEE[player.tool] || MELEE.hand, it = ITEMS[player.toolItem], mul = ((it && (it.hit || TIER_MUL[it.tier])) || 1) * upMul('melee'), p = player.pos, fx = Math.sin(player.yaw), fz = Math.cos(player.yaw);
  const reach = (it && it.reach) || m.reach;
  let best = null, bd = 1e9;
  for (const L of TARGET_LISTS) for (const z of L()) {
    if (!z.active || z.state === 'dead' || z === player) continue;
    const dx = z.x - p.x, dz = z.z - p.z, d = Math.hypot(dx, dz);
    if (d < reach + 0.4 * (z.scale || 1) + (z.radius || 0) && (dx * fx + dz * fz) / (d || 1) > 0.35 && Math.abs(z.y - p.y) < 1.8 && d < bd) { best = z; bd = d; }
  }
  if (best) {
    const dir = new THREE.Vector3(best.x - p.x, 0, best.z - p.z).normalize();
    hurtTarget(best, m.dmg * mul * rr(0.9, 1.1), false, dir, 'player'); if (!best.heavy) { best.x += dir.x * 0.6; best.z += dir.z * 0.6; }
    spawnPuff(best.x, best.y + 1.1 * (best.scale || 1), best.z, best.blood || 0x4a1210, 8, 2.2, 0.08, -9, 0.6); hitMarker(false); cam.shake = Math.min(0.25, cam.shake + 0.08);
    return;
  }
  if (typeof harvestHit === 'function') harvestHit(player.tool);
}
function updateWeapon(dt, t) {
  player.fireCD -= dt;
  if (player.reloadT > 0) {
    player.reloadT -= dt;
    if (player.reloadT <= 0) { const g = gunSpec(), take = Math.min(g.mag - player.mag, invCount(g.ammo)); player.mag += take; invTake(g.ammo, take); player.reloadT = 0; hudDirty = true; if (player.toolItem) MAGS[player.toolItem] = player.mag; FIRE.burstLeft = 0; }
  }
  if (input.reloadPressed) { input.reloadPressed = false; startReload(); }
  if (player.vehicle) return;
  if (typeof BUILD !== 'undefined' && BUILD.ghost) { if (input.act && !BUILD.latch) { BUILD.latch = true; placeBuild(); } if (!input.act) BUILD.latch = false; return; }
  RECOIL.heat = Math.max(0, RECOIL.heat - dt * (input.act ? 1.2 : 3.2)); RECOIL.boltT = Math.max(0, RECOIL.boltT - dt);
  if (player.tool === 'throw') { updateThrow(dt); return; }
  if (input.act) {
    if (isGunTool(player.tool) && player.armed) {
      // single shots need a fresh press, bursts fire their rounds on one press, automatic fire holds
      const mode = fireMode(player.toolItem), g = gunSpec();
      if (mode === 'a') fire(t);
      else if (mode === 'b') { if (!FIRE.latch) { FIRE.latch = true; FIRE.burstLeft = g.burst || 3; } }
      else if (!FIRE.latch) { if (fire(t)) FIRE.latch = true; else if (player.fireCD <= 0) FIRE.latch = true; }
    } else if (player.tool === 'rod') { if (!player.swingT && typeof castLine === 'function') { input.act = false; castLine(); } } else startSwing();
  } else FIRE.latch = false;
  if (FIRE.burstLeft > 0 && player.fireCD <= 0) { if (fire(t)) FIRE.burstLeft--; else FIRE.burstLeft = 0; }
  if (player.swingT > 0 && !player.swingHit && 1 - player.swingT / player.swingDur > 0.56) { player.swingHit = true; swingImpact(); }
}
const MAGS = {};          // rounds left in each gun's magazine

/* ── loot lying on the ground: anything from the item list ── */
const DROPS = [];
const DROP_GEO = new THREE.BoxGeometry(0.42, 0.28, 0.32), DROP_MAT = new THREE.MeshStandardMaterial({ color: C(0x8a6a45), roughness: 0.85 });
const shaftGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 12, 1, true);
ENV_MATS.push(DROP_MAT);
function shaft(color, h) { const m = new THREE.Mesh(shaftGeo, new THREE.MeshBasicMaterial({ color: C(color), transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.scale.set(1, h, 1); m.position.y = h / 2; return m; }
function dropItems(x, y, z, items, opts = {}) {
  // items: [[id, n], ...]
  const list = items.filter(([id, n]) => n > 0 && ITEMS[id]); if (!list.length) return null;
  const g = new THREE.Group(), inner = new THREE.Mesh(DROP_GEO, DROP_MAT); inner.castShadow = true; inner.position.y = 0.16; g.add(inner);
  const rare = list.some(([id]) => ITEMS[id].rare);
  g.add(shaft(rare ? 0xffd27a : 0x9be15d, rare ? 6 : 2.5));
  g.position.set(x, y, z); scene.add(g);
  const d = { x, y, z, g, inner, items: list, life: opts.life || 300, t: 0 };
  DROPS.push(d); return d;
}
function updateDrops(dt, t) {
  const pp = player.pos;
  for (let i = DROPS.length - 1; i >= 0; i--) {
    const d = DROPS[i]; d.t += dt;
    if (d.t > d.life) { scene.remove(d.g); DROPS.splice(i, 1); continue; }
    const dist = Math.hypot(pp.x - d.x, pp.z - d.z);
    if (dist < 80) { d.inner.rotation.y = t * 1.2 + i; d.inner.position.y = 0.16 + Math.sin(t * 2.4 + i) * 0.04; }
    if (player.alive && !player.vehicle && dist < 1.5 && Math.abs(pp.y - d.y) < 2.2) {
      const got = [];
      for (const it of d.items) { const k = invAdd(it[0], it[1], true); if (k > 0) { got.push(toAr(k) + ' ' + ITEMS[it[0]].name); it[1] -= k; } }
      d.items = d.items.filter((it) => it[1] > 0);
      if (got.length) { toast('التقطت ' + got.slice(0, 3).join('، ') + (got.length > 3 ? '…' : ''), ''); AUDIO.pickup(d.items.length === 0); }
      if (!d.items.length) { scene.remove(d.g); DROPS.splice(i, 1); }
      else if (!d.full) { d.full = true; toast('الحقيبة ممتلئة', 'اصنع أو بِع شيئاً لتفرغ مكاناً'); }
    }
  }
}

/* ── zombies: sick clones of the soldier with glowing eyes ── */
const ZOMBIES = [];
TARGET_LISTS.push(() => ZOMBIES);
const ZTYPES = { walker: { hp: 100, speed: 1.35, ts: 0.6, scale: 1, dmg: 12 }, runner: { hp: 70, speed: 4.4, ts: 0.95, scale: 0.97, dmg: 9 }, brute: { hp: 260, speed: 1.15, ts: 0.48, scale: 1.16, dmg: 20 } };
const EYE_MAT = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 0.9, 0.2) });
const ZOMBIE_OUTFITS = [
  { top: { c: 0x5a5448, a: 0.7 }, pants: { c: 0x3a3a40, a: 0.7 }, shoes: { c: 0x2a2420, a: 0.6 }, head: { c: 0x6a6a5a, a: 0.5 } },
  { top: { c: 0x6a3a30, a: 0.75 }, pants: { c: 0x2f3f5a, a: 0.7 }, head: { c: 0x5a4a3a, a: 0.6 } },
  { top: { c: 0x8a8a7a, a: 0.7, p: 'checks' }, pants: { c: 0x4a4030, a: 0.7 } },
];
function initZombies() {
  if (!CHARS.soldier || !THREE.SkeletonUtils) return;
  for (let i = 0; i < QUALITY.zombies; i++) {
    // one body in five is the night hunter (the long-coated creature the owner sent): it always walks as a brute
    const kind = i % 5 === 4 && CHARS.hunter ? 'hunter' : i % 3 === 2 && CHARS.michelle ? 'michelle' : 'soldier';
    const body = makeBody(kind, { outfit: ZOMBIE_OUTFITS[i % ZOMBIE_OUTFITS.length], shadow: QUALITY.tier >= 2 });
    for (const m of body.mats) m.userData.tint.uSick.value = kind === 'hunter' ? 0 : 1;
    const root = body.root; root.visible = false; scene.add(root);
    root.updateMatrixWorld(true);
    const hp = boneLocal(body, 'Head');
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), EYE_MAT); attachAt(root, body.bones.Head, e, s * 0.034, hp.y + 0.05, hp.z + 0.1); }
    const z = { body, root, mixer: body.mixer, acts: body.act, bones: body.bones, active: false, state: 'dead', x: 0, y: 0, z: 0, yaw: 0, hp: 0, type: 'walker', scale: 1, flash: 0, deadT: 0, cd: 0, tx: 0, tz: 0, wT: 0, groanT: rr(2, 6), stuck: 0, sx: 0, sz: 0, side: 0, sideT: 0, lunge: 0,
      hits: [[new THREE.Vector3(), 0.2, true], [new THREE.Vector3(), 0.34, false], [new THREE.Vector3(), 0.3, false], [new THREE.Vector3(), 0.18, false], [new THREE.Vector3(), 0.18, false]] };
    z.hurt = (dmg, head, dir, from) => damageZombie(z, dmg, head, dir, from);
    ZOMBIES.push(z);
  }
}
const _frustum = new THREE.Frustum(), _pm = new THREE.Matrix4();
let spawnT = 2;
function spawnZombie() {
  const r0 = rand(), want = r0 < 0.2 ? 'runner' : r0 < 0.3 ? 'brute' : 'walker';
  const z = (want === 'brute' && ZOMBIES.find((q) => !q.active && q.body.kind === 'hunter')) || ZOMBIES.find((q) => !q.active && q.body.kind !== 'hunter') || ZOMBIES.find((q) => !q.active); if (!z) return;
  _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); _frustum.setFromProjectionMatrix(_pm);
  for (let tries = 0; tries < 16; tries++) {
    const a = rr(0, TAU), d = rr(40, 85), x = player.pos.x + Math.cos(a) * d, zz = player.pos.z + Math.sin(a) * d, h = terrainAt(x, zz);
    if (!inPlay(x, zz) || h < waterAt(x, zz) + 0.2 || slopeAt(x, zz) > 0.7) continue;
    if (buildingAt(x, zz, h + 1)) continue;
    if (tries < 10 && _frustum.containsPoint(_v4.set(x, h + 1, zz))) continue;
    const type = z.body.kind === 'hunter' ? 'brute' : want, ty = ZTYPES[type];
    Object.assign(z, { active: true, state: 'wander', x, y: groundAt(x, zz, h + 1), z: zz, type, hp: ty.hp, scale: ty.scale * rr(0.95, 1.05), flash: 0, deadT: 0, cd: 0, wT: 0, stuck: 0, sx: x, sz: zz, side: 0, sideT: 0, yaw: rr(0, TAU), lunge: 0 });
    z.root.visible = true; z.root.rotation.set(0, z.yaw, 0); z.body.inner.scale.setScalar(CHARS[z.body.kind].scale * z.scale);
    for (const a2 of Object.values(z.acts)) { a2.stop(); a2.enabled = true; }
    const main = z.acts[type === 'runner' ? 'Run' : 'Walk'] || z.acts.Walk; if (main) { main.play(); main.setEffectiveWeight(1); main.time = rr(0, 1); main.timeScale = ty.ts; }
    z.main = main;
    return;
  }
}
function damageZombie(z, dmg, head, dir, from) {
  if (z.state === 'dead') return;
  z.hp -= dmg; z.flash = 0.12; z.state = 'chase';
  AUDIO.zhit(Math.hypot(z.x - player.pos.x, z.z - player.pos.z));
  if (z.hp <= 0) {
    z.state = 'dead'; z.deadT = 0; z.fallDir = Math.atan2(dir.x, dir.z);
    if (from === 'player') { onKill(z, head, 'player'); KILLS++; hudDirty = true; if (KILLS > BEST) { BEST = KILLS; try { localStorage.setItem('rock-island-best', String(BEST)); } catch (_) {} } if (typeof addCoins === 'function') addCoins(z.type === 'brute' ? 25 : 10, true); track('kills'); if (z.type === 'brute') track('brutes'); addGold(z.type === 'brute' ? 6 : 2); }
    AUDIO.zdie(Math.hypot(z.x - player.pos.x, z.z - player.pos.z));
    const g = groundAt(z.x, z.z, z.y + 1), r = rand();
    if (typeof rollLoot === 'function') { const items = rollLoot(z.type === 'brute' ? 'zombieBig' : 'zombie'); if (items.length) dropItems(z.x, g + 0.02, z.z, items, { life: 120 }); }
  }
}
const _zq = new THREE.Quaternion(), _zr = new THREE.Vector3();
function updateZombies(dt, t) {
  if (!ZOMBIES.length) return;
  const p = player.pos, night = ENV.night, inTown = player.inside || (typeof nearSettlement === 'function' && nearSettlement(p.x, p.z, 0.6));
  const target = Math.round(lerp(QUALITY.zombies * 0.3, QUALITY.zombies, night) * (inTown && night < 0.5 ? 0.4 : 1));
  let active = 0; for (const z of ZOMBIES) if (z.active) active++;
  spawnT -= dt;
  if (spawnT <= 0 && active < target && t - player.bornAt > 10 && !player.swimming) { spawnZombie(); spawnT = 1.6; }
  for (const z of ZOMBIES) {
    if (!z.active) continue;
    const dx = p.x - z.x, dz = p.z - z.z, d = Math.hypot(dx, dz), ty = ZTYPES[z.type];
    if (z.state === 'dead') {
      z.deadT += dt;
      const fall = smooth(0, 0.7, z.deadT), sink = smooth(3.5, 6.5, z.deadT) * 0.7;
      z.root.rotation.set(-fall * 1.5, z.fallDir + Math.PI, 0, 'YXZ'); z.root.position.set(z.x, z.y - sink, z.z);
      if (z.main) z.main.timeScale = Math.max(0, (1 - fall) * ty.ts);
      z.mixer.update(dt);
      if (z.deadT > 7) { z.active = false; z.root.visible = false; }
      continue;
    }
    if (d > 160) { z.active = false; z.root.visible = false; continue; }
    const heard = T - NOISE.t < 1 && Math.hypot(NOISE.x - z.x, NOISE.z - z.z) < NOISE.r;
    if (z.state === 'wander' && player.alive && (heard || d < lerp(22, 36, night) * (player.inside ? 0.6 : 1) * (player.vehicle ? 1.5 : 1))) { z.state = 'chase'; if (d < 45) AUDIO.groan(z, d); }
    if (z.state !== 'wander' && (d > 90 || !player.alive)) z.state = 'wander';
    let gx, gz, spd;
    if (z.state === 'wander') { z.wT -= dt; if (z.wT <= 0) { z.tx = z.x + rr(-18, 18); z.tz = z.z + rr(-18, 18); z.wT = rr(4, 9); } gx = z.tx - z.x; gz = z.tz - z.z; spd = Math.hypot(gx, gz) > 1 ? 0.6 : 0; }
    else { gx = dx; gz = dz; spd = ty.speed * (1 + night * 0.15); const ty2 = player.vehicle ? 3 : 1.7, reach = player.vehicle ? player.vehicle.spec.R + 0.9 : 1.5; if (d < reach && Math.abs(p.y - z.y) < ty2 && (!player.vehicle || Math.abs(player.vehicle.speed) < 3)) { spd = 0; z.state = 'attack'; } else if (z.state === 'attack') z.state = 'chase'; }
    if (z.state === 'attack') { z.cd -= dt; z.yaw = angLerp(z.yaw, Math.atan2(dx, dz), 1 - Math.exp(-dt * 10)); if (z.cd <= 0) { z.cd = 1.15; z.lunge = 0.4; damagePlayer(ty.dmg * rr(0.85, 1.15) * (typeof ARMOR === 'function' ? ARMOR() : 1), z, 'bite'); } }
    let gl = Math.hypot(gx, gz) || 1; gx /= gl; gz /= gl;
    if (z.sideT > 0) { z.sideT -= dt; const c = Math.cos(z.side), s = Math.sin(z.side), nx = gx * c - gz * s, nz = gx * s + gz * c; gx = nx; gz = nz; }
    for (const o of ZOMBIES) { if (o === z || !o.active || o.state === 'dead') continue; const ox = z.x - o.x, oz = z.z - o.z, od = Math.hypot(ox, oz); if (od < 1.0 && od > 1e-4) { gx += ox / od * 0.8; gz += oz / od * 0.8; } }
    gl = Math.hypot(gx, gz) || 1;
    if (spd > 0) {
      const ox = gx / gl * spd * dt, oz = gz / gl * spd * dt, nx = z.x + ox, nz = z.z + oz, gNew = groundAt(nx, nz, z.y);
      if (gNew > waterAt(nx, nz) - 0.6 && gNew - z.y < STEP_UP + 0.05 && ((terrainAt(nx, nz) - terrainAt(z.x, z.z)) / (Math.hypot(ox, oz) || 1e-6) < 1.5 || gNew > terrainAt(nx, nz) + 0.05)) { z.x = nx; z.z = nz; }
      resolveCollision(z, 0.34 * z.scale);
      z.yaw = angLerp(z.yaw, Math.atan2(gx, gz), 1 - Math.exp(-dt * 5));
      z.stuck += dt;
      if (z.stuck > 0.8) { if (Math.hypot(z.x - z.sx, z.z - z.sz) < 0.25 * spd && z.state !== 'wander') { z.side = rand() < 0.5 ? 1.4 : -1.4; z.sideT = 0.9; } z.stuck = 0; z.sx = z.x; z.sz = z.z; }
    }
    if (z.main) z.main.timeScale = spd > 0 ? ty.ts * clamp(spd / ty.speed, 0.4, 1.3) : 0.15;
    z.y = damp(z.y, groundAt(z.x, z.z, z.y + 0.3), 12, dt);
    z.groanT -= dt; if (z.groanT <= 0) { z.groanT = rr(3, 8); if (d < 45) AUDIO.groan(z, d); }
    z.flash = Math.max(0, z.flash - dt); z.lunge = Math.max(0, z.lunge - dt);
    z.root.position.set(z.x + (z.flash > 0 ? (Math.random() - 0.5) * 0.06 : 0), z.y, z.z); z.root.rotation.set(0, z.yaw, 0);
    if (d < 90) {
      z.mixer.update(dt);
      z.root.updateMatrixWorld(true); z.root.getWorldQuaternion(_zq);
      if (z.type !== 'runner') {
        const sway = Math.sin(t * 1.7 + z.sx) * 0.12, reach = z.lunge > 0 ? 0.35 : 0;
        aimLimb(z.bones.LeftArm, z.bones.LeftForeArm, 0.22 + sway, 0.05 + reach, 1, 0.85, _zq); aimLimb(z.bones.RightArm, z.bones.RightForeArm, -0.22 + sway, 0.0 + reach, 1, 0.85, _zq);
        aimLimb(z.bones.LeftForeArm, z.bones.LeftHand, 0.05, 0.12, 1, 0.7, _zq); aimLimb(z.bones.RightForeArm, z.bones.RightHand, -0.05, 0.1, 1, 0.7, _zq);
      }
      _zr.set(-1, 0, 0).applyQuaternion(_zq); boneTurn(z.bones.Neck, _zr, 0.35 + Math.sin(t * 2.3 + z.sz) * 0.08);
    }
    z.bones.Head.getWorldPosition(z.hits[0][0]); z.bones.Spine2.getWorldPosition(z.hits[1][0]); z.bones.Hips.getWorldPosition(z.hits[2][0]); z.bones.LeftLeg.getWorldPosition(z.hits[3][0]); z.bones.RightLeg.getWorldPosition(z.hits[4][0]);
  }
}

/* ── the survivor's health ── */
let hurtFlash = 0, deathT = 0;
function damagePlayer(amount, from, kind) {
  if (!player.alive || T - player.bornAt < 2) return;
  amount *= Math.max(0.5, 1 - upAdd('armor'));
  player.health = Math.max(0, player.health - amount); player.hurtT = 0; hudDirty = true;
  hurtFlash = Math.min(1, hurtFlash + amount / 26); cam.shake = Math.min(0.45, cam.shake + 0.25); AUDIO.hurt(); buzz(amount > 15 ? 70 : 35);
  if (from && kind === 'bite') { const dx = player.pos.x - from.x, dz = player.pos.z - from.z, d = Math.hypot(dx, dz) || 1; player.vel.x += dx / d * 3; player.vel.z += dz / d * 3; }
  if (player.health <= 0) {
    player.alive = false; deathT = 0; AUDIO.die(); if (player.vehicle) exitVehicle(true); if (typeof cancelBuild === 'function') cancelBuild();
    if (typeof onPlayerDeath === 'function') onPlayerDeath(kind);
  }
}
function updateHealth(dt) {
  player.hurtT += dt; hurtFlash = Math.max(0, hurtFlash - dt * 1.3);
  // wounds close on their own only when you have eaten and drunk: to 60 quickly, all the way when well fed
  if (player.alive && player.hurtT > 7 && player.food > 25 && player.water > 25) {
    if (player.health < 60) { player.health = Math.min(60, player.health + 2.2 * dt); hudDirty = true; }
    else if (player.health < 100 && player.food > 65 && player.water > 65) { player.health = Math.min(100, player.health + 0.25 * dt); hudDirty = true; }
  }
  if (player.alive) { SURVIVE_T += dt; updateNeeds(dt); }
}
/* hunger and thirst: the belly empties in about fifty minutes, the water in thirty-five; faster when you run, thirst faster in
   the heat and hunger in the cold. Empty, they take your blood slowly — eat, drink from a bottle, a lake or a river */
const NEEDS = { hurtT: 3, warn: { food: 100, water: 100 } };
function updateNeeds(dt) {
  if (player.vehicle && player.vehicle.spec.plane) return;
  const p = player.pos, temp = tempAt(p.x, p.z), hot = clamp((temp - 0.62) * 4, 0, 1) + (biomeAt(p.x, p.z) === 7 ? 0.6 : 0), cold = clamp((0.4 - temp) * 4, 0, 1);
  const work = player.sprinting ? 1.8 : player.swimming ? 1.5 : player.speed > 0.6 ? 1.15 : 0.85;
  player.food = Math.max(0, player.food - dt * (100 / 3000) * work * (1 + cold * 0.35));
  player.water = Math.max(0, player.water - dt * (100 / 2100) * work * (1 + hot * 0.7));
  for (const k of ['food', 'water']) {
    const v = player[k], w = NEEDS.warn;
    if (v < 25 && w[k] >= 25) toast(k === 'food' ? 'أنت جائع' : 'أنت عطشان', k === 'food' ? 'كُل شيئاً من الحقيبة (Q) قبل أن يفرغ شريط الجوع' : 'اشرب ماء من قنينة أو من بحيرة أو نهر (اقترب من الماء واضغط «اشرب»)');
    if (v <= 0 && w[k] > 0) toast(k === 'food' ? 'تتضوّر جوعاً' : 'يقتلك العطش', 'تفقد من دمك حتى ' + (k === 'food' ? 'تأكل' : 'تشرب'));
    w[k] = v;
  }
  if (player.food <= 0 || player.water <= 0) {
    NEEDS.hurtT -= dt;
    if (NEEDS.hurtT <= 0) {
      NEEDS.hurtT = 3; const amt = (player.water <= 0 ? 2 : 0) + (player.food <= 0 ? 1.5 : 0);
      player.health = Math.max(0, player.health - amt); hurtFlash = Math.min(1, hurtFlash + 0.12); hudDirty = true;
      if (player.health <= 0) { player.health = 1; damagePlayer(5, null, player.water <= 0 ? 'thirst' : 'hunger'); }
    }
  } else NEEDS.hurtT = 3;
}
function feed(food, water) { player.food = clamp(player.food + food, 0, 100); player.water = clamp(player.water + water, 0, 100); NEEDS.warn.food = player.food; NEEDS.warn.water = player.water; hudDirty = true; }
