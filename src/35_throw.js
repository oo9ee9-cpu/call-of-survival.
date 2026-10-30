/* ═════════ things you throw — the hand grenade bounces and goes off in four seconds, C4 sticks where it lands and goes off in
   five — and the flare gun, whose red star calls a supply plane that drops a crate of rare gear by parachute ═════════ */
const THROWN = [];
const THROW = { aim: false, arc: null };
const _thv = new THREE.Vector3(), _thp = new THREE.Vector3();
const THROW_GEO = { frag: new THREE.SphereGeometry(0.045, 10, 8), c4: new THREE.BoxGeometry(0.14, 0.05, 0.09) };
const THROW_MAT = { frag: new THREE.MeshStandardMaterial({ color: 0x3e4a32, roughness: 0.6, metalness: 0.3 }), c4: new THREE.MeshStandardMaterial({ color: 0x8a8a6a, roughness: 0.8 }) };
ENV_MATS.push(THROW_MAT.frag, THROW_MAT.c4);
// the dotted arc while you hold the throw
const ARC_N = 28;
THROW.arc = (() => {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ARC_N * 3), 3));
  const m = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffd76a, size: 5, sizeAttenuation: false, transparent: true, opacity: 0.85, depthWrite: false, fog: false }));
  m.frustumCulled = false; m.visible = false; m.renderOrder = 7; scene.add(m); return m;
})();
function throwStart(_v) {
  RIG.bones.RightHand.getWorldPosition(_thp); _thp.y += 0.25;
  camera.getWorldDirection(_v); _v.y += 0.28; _v.normalize().multiplyScalar(15);
  return _thp;
}
function updateThrow(dt) {
  const id = player.toolItem, it = ITEMS[id];
  if (!it || it.tool !== 'throw' || invCount(id) <= 0) { THROW.arc.visible = false; THROW.aim = false; return; }
  if (input.act) {
    THROW.aim = true;
    // the arc it will fly: gravity, a bounce ignored
    const p0 = throwStart(_thv), a = THROW.arc.geometry.attributes.position;
    let x = p0.x, y = p0.y, z = p0.z, vx = _thv.x, vy = _thv.y, vz = _thv.z;
    for (let i = 0; i < ARC_N; i++) { a.setXYZ(i, x, y, z); const st = 0.07; vy -= 9.8 * st; x += vx * st; y += vy * st; z += vz * st; if (y < groundAt(x, z, y + 1)) { for (let k = i + 1; k < ARC_N; k++) a.setXYZ(k, x, groundAt(x, z, y + 1) + 0.05, z); break; } }
    a.needsUpdate = true; THROW.arc.visible = true;
  } else if (THROW.aim) {
    THROW.aim = false; THROW.arc.visible = false;
    if (player.swingT > 0) return;
    const kind = it.throwKind, p0 = throwStart(_thv).clone();
    invTake(id, 1); hudDirty = true; player.swingT = 0.45; player.swingDur = 0.45; AUDIO.swing();
    const m = new THREE.Mesh(THROW_GEO[kind], THROW_MAT[kind]); m.castShadow = true; m.position.copy(p0); scene.add(m);
    THROWN.push({ kind, m, p: p0, v: _thv.clone(), t: 0, fuse: kind === 'frag' ? 4 : 5, stuck: false, armed: kind === 'frag' });
    if (invCount(id) <= 0) equip('hand');
  }
}
function updateThrown(dt) {
  for (let i = THROWN.length - 1; i >= 0; i--) {
    const q = THROWN[i]; q.t += dt;
    if (!q.stuck) {
      q.v.y -= 9.8 * dt; q.p.addScaledVector(q.v, dt);
      const g = groundAt(q.p.x, q.p.z, q.p.y + 0.3);
      if (q.p.y < g + 0.04) {
        q.p.y = g + 0.04;
        if (q.kind === 'c4') { q.stuck = true; q.armed = true; q.t = 0; AUDIO.beep(0.6); }
        else { q.v.y = Math.abs(q.v.y) * 0.32; q.v.x *= 0.5; q.v.z *= 0.5; if (Math.abs(q.v.y) < 0.6) { q.v.y = 0; } }
      }
      q.m.position.copy(q.p); q.m.rotation.x += dt * 8; q.m.rotation.y += dt * 5;
    } else if (q.kind === 'c4' && Math.floor(q.t * 2) !== Math.floor((q.t - dt) * 2)) AUDIO.beep(0.4 + q.t / q.fuse * 0.6);
    if (q.armed && q.t >= q.fuse) { explode(q.p.x, q.p.y, q.p.z, q.kind === 'c4' ? 11 : 7.5, q.kind === 'c4' ? 260 : 150, q.kind === 'c4'); scene.remove(q.m); THROWN.splice(i, 1); }
  }
  updateFlares(dt);
}
/* a blast: everything inside the radius is hurt by distance, the ground shakes, C4 leaves a crater */
function explode(x, y, z, R, dmg, crater) {
  spawnPuff(x, y + 0.3, z, 0x2a2622, 22, 7, 0.32, -1, 1.6); spawnPuff(x, y + 0.2, z, 0xff9a3a, 10, 9, 0.18, -3, 0.35); spawnPuff(x, y, z, 0x5a4a3a, 18, 8, 0.07, -12, 1.0);
  muzzleLight.position.set(x, y + 1.2, z); muzzleLight.intensity = 40; muzzleLight.distance = R * 3; flashT = 0.12;
  setTimeout(() => { muzzleLight.distance = 16; }, 160);
  const d0 = Math.hypot(player.pos.x - x, player.pos.z - z);
  cam.shake = Math.min(0.9, cam.shake + clamp(1.2 - d0 / 40, 0, 1) * 0.7);
  AUDIO.explosion(d0);
  for (const L of TARGET_LISTS) for (const t of L()) {
    if (!t.active || t.state === 'dead') continue;
    const d = Math.hypot(t.x - x, (t.y || 0) - y, t.z - z); if (d > R) continue;
    const dir = new THREE.Vector3(t.x - x, 0, t.z - z).normalize(); hurtTarget(t, dmg * (1 - d / R) ** 1.3, false, dir, 'player');
  }
  if (player.alive && d0 < R && Math.abs(player.pos.y - y) < R) damagePlayer(dmg * 0.8 * (1 - d0 / R) ** 1.3 * (ARMOR ? ARMOR() : 1), { x, z }, 'blast');
  for (const v of VEHICLES) { const d = Math.hypot(v.pos.x - x, v.pos.z - z); if (d < R) { v.vel && v.vel.addScaledVector(new THREE.Vector3(v.pos.x - x, 0, v.pos.z - z).normalize(), (1 - d / R) * 9); } }
  NOISE.x = x; NOISE.z = z; NOISE.t = T; NOISE.r = 220;
  if (crater && Math.abs(groundAt(x, z, y + 0.5) - terrainAt(x, z)) < 0.2 && classAt(x, z) !== 7) { addCrater(x, z, 2.2, 0.8); grassDirtyArea(x, z, 3.5); GBLOCK.add(Math.floor(x / 8) * 100000 + Math.floor(z / 8)); HOOK.dug(x, z, 2.2, 0.8); }
}
/* ── the flare gun: a red star climbs, the supply plane comes and drops its crate where the flare went up ── */
const FLARES = [];
const FLARE_TEX = canvasTex(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 1, 32, 32, 31); r.addColorStop(0, 'rgba(255,255,240,1)'); r.addColorStop(0.25, 'rgba(255,90,60,.95)'); r.addColorStop(1, 'rgba(255,40,20,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });
function fireFlare(mz) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: FLARE_TEX, color: new THREE.Color(3, 1.2, 0.8), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  sp.scale.setScalar(2.4); sp.position.copy(mz); scene.add(sp);
  camera.getWorldDirection(_thv); _thv.y = Math.max(0.85, _thv.y + 0.6); _thv.normalize();
  FLARES.push({ sp, p: mz.clone(), v: _thv.clone().multiplyScalar(38), t: 0 });
  toast('أطلقت إشارة الإمداد', 'طائرة الإمداد في الطريق · راقب السماء'); track('flares');
  const x = mz.x + _thv.x * 30, z = mz.z + _thv.z * 30;
  setTimeout(() => { if (typeof callAirdrop === 'function') callAirdrop(x, z, true); }, 6000);
}
function updateFlares(dt) {
  for (let i = FLARES.length - 1; i >= 0; i--) {
    const f = FLARES[i]; f.t += dt; f.v.y -= (f.t > 2.2 ? 2 : 6) * dt; f.v.multiplyScalar(Math.exp(-dt * 0.25)); f.p.addScaledVector(f.v, dt); f.sp.position.copy(f.p);
    f.sp.material.opacity = clamp(1 - (f.t - 14) / 4, 0, 1) * (0.8 + 0.2 * Math.sin(f.t * 40));
    if (f.t > 1 && f.t % 0.15 < dt) spawnPuff(f.p.x, f.p.y, f.p.z, 0xd8c8c0, 1, 0.3, 0.2, 0.2, 2.5);
    if (f.t > 18) { scene.remove(f.sp); f.sp.material.dispose(); FLARES.splice(i, 1); }
  }
}
