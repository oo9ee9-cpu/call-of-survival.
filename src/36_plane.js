/* ═════════ the drop: every journey from the lobby starts in the cargo plane crossing the map. Jump when you like; fall free
   (push forward to dive, back to glide), open the parachute yourself after a few seconds or it opens on its own near the ground,
   steer it down and land. The same plane brings the supply crate the flare gun calls. ═════════ */
const PLANE_GEO = (() => {
  const b = new Builder(), body = 0x8a9188, dark = 0x4a4f4a, glass = 0x1a2a34, K2 = MATID;
  // fuselage along +z (nose), a high wing, four engines, the tail fin and stabilisers, the cargo ramp
  b.add(G.cyl14, M(0, 0, 0, 0, 2.1, 26, 2.1, Math.PI / 2), body, K2.metal);
  b.add(G.sph, M(0, -0.2, 13, 0, 2.1, 1.9, 3.2), body, K2.metal); b.add(G.box, M(0, 0.7, 14.2, 0, 1.6, 0.6, 1.2, -0.3), glass, K2.glass);
  b.add(G.cone, M(0, 0.9, -15.5, 0, 1.6, 7, 1.8, -Math.PI / 2 - 0.12), body, K2.metal);
  b.add(G.box, M(0, 2.3, 1.2, 0, 40, 0.42, 4.2), body, K2.metal);
  for (const x of [-13, -6.5, 6.5, 13]) { b.add(G.cyl14, M(x, 1.7, 2.8, 0, 0.75, 4.2, 0.75, Math.PI / 2), dark, K2.metal); b.add(G.cone, M(x, 1.7, 5.1, 0, 0.5, 0.9, 0.5, Math.PI / 2), dark, K2.metal); }
  b.add(G.box, M(0, 5.6, -16.5, 0, 0.35, 7.5, 5.2, 0.32), body, K2.metal);
  b.add(G.box, M(0, 2.6, -17.6, 0, 15, 0.3, 3.4), body, K2.metal);
  for (let k = 0; k < 6; k++) b.add(G.box, M(2.12, 0.9, 9 - k * 3.6, 0, 0.05, 0.42, 0.42), glass, K2.glass);
  b.add(G.box, M(0, -1.85, 0, 0, 2.6, 0.5, 18), dark, K2.metal);
  return b.geometry();
})();
const PROP_GEO = (() => { const b = new Builder(); for (let k = 0; k < 4; k++) b.add(G.box, M(0, 0, 0, 0, 0.32, 3.6, 0.08, 0, k * Math.PI / 4), 0x2a2c2e, MATID.metal); return b.geometry(); })();
function makePlane() {
  const g = new THREE.Group(), m = new THREE.Mesh(PLANE_GEO, UBER_OBJ); m.castShadow = true; g.add(m);
  const props = [];
  for (const x of [-13, -6.5, 6.5, 13]) { const p = new THREE.Mesh(PROP_GEO, UBER_OBJ); p.position.set(x, 1.7, 5.6); g.add(p); props.push(p); }
  g.userData.props = props; g.visible = false; scene.add(g); return g;
}
/* the canopy: a domed parachute with its lines, opened over you or over a crate */
const CHUTE_GEO = (() => {
  const b = new Builder(), c1 = 0x3a6aa8, c2 = 0xe8e2d0;
  for (let k = 0; k < 10; k++) { const a = k / 10 * TAU; b.add(G.box, M(Math.cos(a) * 2.6, 0.2, Math.sin(a) * 2.6, -a, 0.12, 0.06, 1.7, 0, 0), k % 2 ? c1 : c2, MATID.fabric); }
  b.add(G.dome, M(0, 0, 0, 0, 3.2, 1.6, 3.2), c1, MATID.fabric);
  for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; b.add(G.box, M(Math.cos(a) * 1.5, -1.9, Math.sin(a) * 1.5, -a, 0.012, 4.2, 0.012, 0, Math.cos(a) * 0.35), 0x2a2a2a, MATID.fabric); }
  return b.geometry();
})();
const _chuteGeos = new Map();
function chuteGeo(c1, c2) {
  const k = c1 + ':' + c2; let g = _chuteGeos.get(k); if (g) return g;
  const b = new Builder();
  for (let q = 0; q < 10; q++) { const a = q / 10 * TAU; b.add(G.box, M(Math.cos(a) * 2.6, 0.2, Math.sin(a) * 2.6, -a, 0.12, 0.06, 1.7), q % 2 ? c1 : c2, MATID.fabric); }
  b.add(G.dome, M(0, 0, 0, 0, 3.2, 1.6, 3.2), c1, MATID.fabric); b.add(G.dome, M(0, 0.05, 0, 0, 1.4, 1.45, 1.4), c2, MATID.fabric);
  for (let q = 0; q < 8; q++) { const a = q / 8 * TAU; b.add(G.box, M(Math.cos(a) * 1.5, -1.9, Math.sin(a) * 1.5, -a, 0.012, 4.2, 0.012, 0, Math.cos(a) * 0.35), 0x2a2a2a, MATID.fabric); }
  g = b.geometry(); _chuteGeos.set(k, g); return g;
}
const DROP = { state: '', t: 0, vel: new THREE.Vector3(), chute: null, chuteK: 0, plane: null, path: null, autoH: 130, saved: null, hint: 0 };
const SUPPLY = [];
/* a flight across the map: a straight line through a point near the middle, high above every hill on the way */
function flightPath(cx, cz, angle) {
  const H = WHALF * 0.92, a = angle !== undefined ? angle : rand() * TAU, dx = Math.cos(a), dz = Math.sin(a);
  const ox = clamp(cx, -WHALF * 0.6, WHALF * 0.6), oz = clamp(cz, -WHALF * 0.6, WHALF * 0.6);
  const x0 = clamp(ox - dx * H * 1.2, -H, H), z0 = clamp(oz - dz * H * 1.2, -H, H), x1 = clamp(ox + dx * H * 1.2, -H, H), z1 = clamp(oz + dz * H * 1.2, -H, H);
  let top = 0; for (let t = 0; t <= 1; t += 0.02) top = Math.max(top, terrainAt(lerp(x0, x1, t), lerp(z0, z1, t)));
  const len = Math.hypot(x1 - x0, z1 - z0);
  return { x0, z0, x1, z1, y: Math.max(420, top + 320), len, speed: clamp(len / 70, 70, 115), dx: (x1 - x0) / len, dz: (z1 - z0) / len };
}
function planeAt(P, s, out) { const t = s / P.len; return out.set(lerp(P.x0, P.x1, t), P.y, lerp(P.z0, P.z1, t)); }
/* ── start of a journey: aboard ── */
function boardPlane() {
  if (!DROP.plane) DROP.plane = makePlane();
  const fp = (player.pos.x || player.pos.z) ? [player.pos.x, player.pos.z] : [0, 0];
  DROP.path = flightPath(fp[0] * 0.5, fp[1] * 0.5); DROP.s = 0; DROP.state = 'plane'; DROP.t = 0;
  DROP.saved = BOOT.loaded ? player.pos.clone() : null;
  planeAt(DROP.path, 0, player.pos); player.vel.set(0, 0, 0); player.yaw = Math.atan2(DROP.path.dx, DROP.path.dz);
  DROP.plane.visible = true; DROP.plane.position.copy(player.pos); DROP.plane.rotation.set(0, player.yaw, 0);
  if (RIG.body) RIG.body.root.visible = false; player.root.visible = false;
  cam.yaw = cam.tyaw = player.yaw + Math.PI * 0.75; cam.pitch = cam.tpitch = 0.35;
  hud.classList.add('aboard'); $('dropUI').classList.remove('gone'); renderDropUI();
  AUDIO.engine(true, 0.32, 0.2, 'plane');
}
function skydiving() { return !!DROP.state; }
function jumpOut() {
  if (DROP.state !== 'plane') return;
  const P = DROP.path; DROP.state = 'free'; DROP.t = 0;
  player.pos.set(DROP.plane.position.x - P.dx * 12, DROP.plane.position.y - 3, DROP.plane.position.z - P.dz * 12);
  DROP.vel.set(P.dx * P.speed * 0.4, -4, P.dz * P.speed * 0.4);
  player.root.visible = true; if (RIG.body) RIG.body.root.visible = true; showTool(true);
  cam.yaw = cam.tyaw = player.yaw + Math.PI; cam.pitch = cam.tpitch = 0.55;
  renderDropUI(); AUDIO.swing(); AUDIO.engine(false); track('jumps'); toast('قفزت!', 'ادفع للأمام لتغوص أسرع، وللخلف لتطير أبعد · المظلة بعد لحظات');
}
function openChute(force) {
  if (DROP.state !== 'free' || (DROP.t < 3 && !force)) return;
  DROP.state = 'chute'; DROP.chuteK = 0; DROP.t = 0;
  const skin = ACCOUNT.look && ACCOUNT.look.chute && ITEMS[ACCOUNT.look.chute], key = skin ? skin.id : 'chute_blue';
  if (!DROP.chute || DROP.chute.userData.key !== key) {
    if (DROP.chute) scene.remove(DROP.chute);
    DROP.chute = new THREE.Mesh(skin ? chuteGeo(skin.wear.c1, skin.wear.c2) : CHUTE_GEO, UBER_OBJ); DROP.chute.castShadow = true; DROP.chute.userData.key = key; scene.add(DROP.chute);
  }
  DROP.chute.visible = true; AUDIO.land(14); renderDropUI();
}
function landDrop(water) {
  DROP.state = ''; if (DROP.chute) DROP.chute.visible = false;
  hud.classList.remove('aboard'); $('dropUI').classList.add('gone');
  player.vel.set(0, 0, 0); player.onGround = !water; player.root.rotation.set(0, player.yaw, 0);
  if (!water) { AUDIO.land(8); spawnPuff(player.pos.x, player.pos.y + 0.1, player.pos.z, 0xa8957a, 8); }
  toast('هبطت', zoneAt(player.pos.x, player.pos.z, player.pos.y).name || ''); player.bornAt = T; saveSoon();
}
/* landing right where the saved journey left off, without the drop */
function skipToSaved() {
  if (DROP.state !== 'plane' || !DROP.saved) return;
  const p = DROP.saved; player.pos.copy(p); player.pos.y = groundAt(p.x, p.z, p.y + 1.5);
  DROP.plane.visible = false; DROP.state = ''; player.root.visible = true; if (RIG.body) RIG.body.root.visible = true; showTool(true);
  hud.classList.remove('aboard'); $('dropUI').classList.add('gone'); AUDIO.engine(false);
  cam.yaw = cam.tyaw = player.yaw + Math.PI; prepareAround(p.x, p.y, p.z); updateCamera(0.016, true);
}
const _pv = new THREE.Vector3();
function updatePlaneFlight(dt) {
  const P = DROP.path, pl = DROP.plane; if (!P || !pl) return;
  DROP.s += P.speed * dt; planeAt(P, Math.min(DROP.s, P.len + 3000), _pv); pl.position.copy(_pv); pl.rotation.set(0, Math.atan2(P.dx, P.dz), Math.sin(T * 0.4) * 0.02);
  for (const pr of pl.userData.props) pr.rotation.z += dt * 40;
  if (DROP.state === 'plane') {
    player.pos.copy(_pv);
    if (DROP.s > P.len) { toast('أنزلك الطيار عند حافة الخريطة', ''); jumpOut(); }
  } else if (DROP.s > P.len + 2500) pl.visible = false;
}
/* free fall and the parachute */
function updateSkydive(dt) {
  DROP.t += dt; const p = player.pos, v = DROP.vel;
  const gH = groundAt(p.x, p.z, p.y), wl = waterAt(p.x, p.z), floor = Math.max(gH, wl > -1e8 ? wl : -1e9), hAbove = p.y - floor;
  const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
  const ix = fx * input.mz + rx * input.mx, iz = fz * input.mz + rz * input.mx;
  if (DROP.state === 'free') {
    // diving forward falls faster and covers ground; holding back glides flatter but slower
    const dive = clamp(input.mz, -1, 1), term = lerp(48, 66, Math.max(0, dive)) * (dive < 0 ? 0.8 : 1);
    v.y = damp(v.y, -term, 0.9, dt);
    const hs = lerp(14, 28, Math.max(0, dive)) + (dive < 0 ? 8 : 0);
    v.x = damp(v.x, ix * hs, 1.2, dt); v.z = damp(v.z, iz * hs, 1.2, dt);
    if (Math.hypot(input.mx, input.mz) > 0.2) player.yaw = angLerp(player.yaw, Math.atan2(ix, iz), 1 - Math.exp(-dt * 3));
    // the canopy opens on its own near the ground (even in the first seconds of a low jump)
    if (hAbove < DROP.autoH && DROP.t > 0.5) openChute(DROP.t >= 3 || hAbove < 60);
  } else {
    DROP.chuteK = Math.min(1, DROP.chuteK + dt * 1.6);
    const pull = clamp(input.mz, -1, 1);
    v.y = damp(v.y, -lerp(5.5, 9, Math.max(0, pull)), 2.2, dt);
    const hs = lerp(9, 17, Math.max(0, pull)) * (pull < 0 ? 0.6 : 1);
    if (Math.hypot(input.mx, input.mz) > 0.15) player.yaw = angLerp(player.yaw, Math.atan2(ix, iz), 1 - Math.exp(-dt * 1.6));
    v.x = damp(v.x, Math.sin(player.yaw) * hs, 1.1, dt); v.z = damp(v.z, Math.cos(player.yaw) * hs, 1.1, dt);
    DROP.chute.position.set(p.x, p.y + 4.3, p.z); DROP.chute.rotation.set(Math.sin(T * 1.1) * 0.05 * DROP.chuteK - 0.15, player.yaw, Math.sin(T * 0.8) * 0.05);
    DROP.chute.scale.setScalar(0.2 + 0.8 * DROP.chuteK);
  }
  p.addScaledVector(v, dt);
  worldEdge(p);
  const g2 = groundAt(p.x, p.z, p.y + 2), wl2 = waterAt(p.x, p.z), fl2 = Math.max(g2, wl2 > -1e8 ? wl2 - 1.2 : -1e9);
  if (p.y <= fl2) { p.y = Math.max(g2, p.y); landDrop(wl2 > g2 + 1.3); }
  // the pose: spread out in free fall, hanging under the canopy
  player.speed = Math.hypot(v.x, v.z);
  if (RIG.ok) { RIG.mixer.update(dt); skyPose(dt); }
  player.root.position.copy(p);
  const fall = DROP.state === 'free' ? 1.15 + clamp(input.mz, 0, 1) * 0.3 : 0;
  player.root.rotation.set(fall, player.yaw, 0, 'YXZ');
}
function skyPose(dt) {
  const Bn = RIG.bones; player.root.updateMatrixWorld(true); player.root.getWorldQuaternion(_rootQ);
  if (DROP.state === 'free') {
    const fl = Math.sin(T * 7) * 0.08;
    aimLimb(Bn.LeftArm, Bn.LeftForeArm, 0.9, 0.35 + fl, 0.2, 1, _rootQ); aimLimb(Bn.RightArm, Bn.RightForeArm, -0.9, 0.35 - fl, 0.2, 1, _rootQ);
    aimLimb(Bn.LeftForeArm, Bn.LeftHand, 0.5, 0.8, 0.1, 1, _rootQ); aimLimb(Bn.RightForeArm, Bn.RightHand, -0.5, 0.8, 0.1, 1, _rootQ);
    aimLimb(Bn.LeftUpLeg, Bn.LeftLeg, 0.35, -1, -0.2, 1, _rootQ); aimLimb(Bn.RightUpLeg, Bn.RightLeg, -0.35, -1, -0.2, 1, _rootQ);
    aimLimb(Bn.LeftLeg, Bn.LeftFoot, 0.2, -0.6, -0.8, 1, _rootQ); aimLimb(Bn.RightLeg, Bn.RightFoot, -0.2, -0.6, -0.8, 1, _rootQ);
  } else {
    aimLimb(Bn.LeftArm, Bn.LeftForeArm, 0.35, 0.9, 0.0, 1, _rootQ); aimLimb(Bn.RightArm, Bn.RightForeArm, -0.35, 0.9, 0.0, 1, _rootQ);
    aimLimb(Bn.LeftForeArm, Bn.LeftHand, 0.1, 1, 0, 1, _rootQ); aimLimb(Bn.RightForeArm, Bn.RightHand, -0.1, 1, 0, 1, _rootQ);
    const sw = Math.sin(T * 1.6) * 0.12;
    aimLimb(Bn.LeftUpLeg, Bn.LeftLeg, 0.06, -1, 0.15 + sw, 1, _rootQ); aimLimb(Bn.RightUpLeg, Bn.RightLeg, -0.06, -1, 0.15 - sw, 1, _rootQ);
  }
}
function dropCamera(dt) {
  // aboard: circle the plane; falling: behind and above you
  if (!cam.dragging) { cam.tyaw += cam.vyaw * dt; cam.tpitch += cam.vpitch * dt; cam.vyaw *= Math.exp(-dt * 7); cam.vpitch *= Math.exp(-dt * 7); }
  cam.tpitch = clamp(cam.tpitch, -0.3, 1.3); cam.yaw = angLerp(cam.yaw, cam.tyaw, 1 - Math.exp(-dt * 14)); cam.pitch = lerp(cam.pitch, cam.tpitch, 1 - Math.exp(-dt * 14));
  // under the canopy the camera backs off and looks a little higher, so the canopy and you both fit (it eases there, no jump)
  const onPlane = DROP.state === 'plane', chute = DROP.state === 'chute', c = onPlane ? DROP.plane.position : player.pos;
  const want = onPlane ? 46 : chute ? 13 : 7; DROP.camD = onPlane || !DROP.camD ? want : damp(DROP.camD, want, 2.5, dt);
  DROP.camUp = damp(DROP.camUp || 0, chute ? 1.8 : 0, 2.5, dt);
  const dist = DROP.camD, cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  cam.focus.set(c.x, c.y + (onPlane ? 2 : 1.2 + DROP.camUp), c.z);
  cam.pos.set(c.x + Math.sin(cam.yaw) * cp * dist, c.y + sp * dist + (onPlane ? 3 : 1), c.z + Math.cos(cam.yaw) * cp * dist);
  cam.look.copy(cam.focus); cam.roll = 0;
  const fovT = 64 + (DROP.state === 'free' ? Math.min(14, -DROP.vel.y * 0.2) : 0); cam.fov = damp(cam.fov, fovT, 4, dt);
  if (Math.abs(camera.fov - cam.fov) > 0.05) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }
}
/* the drop panel: jump, open the parachute, your height */
(() => {
  const el = document.createElement('div'); el.id = 'dropUI'; el.className = 'gone'; el.setAttribute('dir', 'rtl');
  el.innerHTML = '<div id="dropInfo" class="glass"><b id="dropTitle"></b><span id="dropAlt"></span></div><button id="dropJump" type="button" class="cta">اقفز</button><button id="dropChute" type="button" class="cta">افتح المظلة</button><button id="dropSaved" type="button" class="ghost">انزل في مكانك المحفوظ</button>';
  hudIn.append(el);
  tap($('dropJump'), jumpOut); tap($('dropChute'), openChute); tap($('dropSaved'), skipToSaved);
})();
let dropSig = '';
function renderDropUI() {
  const s = DROP.state, sig = s + (DROP.saved ? 1 : 0) + (s === 'free' && DROP.t >= 3 ? 'c' : '');
  if (sig === dropSig) return; dropSig = sig;
  $('dropJump').hidden = s !== 'plane'; $('dropSaved').hidden = s !== 'plane' || !DROP.saved;
  $('dropChute').hidden = !(s === 'free' && DROP.t >= 3);
  $('dropTitle').textContent = s === 'plane' ? 'على متن طائرة الشحن' : s === 'free' ? 'سقوط حرّ' : 'بالمظلة';
}
function updateDrop(dt) {
  updatePlaneFlight(dt); updateSupply(dt);
  if (!DROP.state) return;
  renderDropUI();
  const p = player.pos, h = Math.max(0, Math.round(p.y - Math.max(groundAt(p.x, p.z, p.y), waterAt(p.x, p.z) > -1e8 ? waterAt(p.x, p.z) : -1e9)));
  $('dropAlt').textContent = DROP.state === 'plane' ? 'الارتفاع ' + toAr(h) + ' م · اختر مكانك على الخريطة واقفز فوقه' : toAr(h) + ' م' + (DROP.state === 'free' ? ' · ' + toAr(Math.round(-DROP.vel.y * 3.6)) + ' كم/س' : '');
  if (input.jumpPressed) { input.jumpPressed = false; if (DROP.state === 'plane') jumpOut(); else if (DROP.state === 'free') openChute(); }
}
/* ── the supply plane: it flies over the flare and lets a crate down on a parachute ── */
function callAirdrop(x, z, flare) {
  const ang = rand() * TAU, P = flightPath(x, z, ang), pl = makePlane(); pl.visible = true;
  // the plane passes right over the target
  const dx = Math.cos(ang), dz = Math.sin(ang); P.x0 = x - dx * 2500; P.z0 = z - dz * 2500; P.x1 = x + dx * 2500; P.z1 = z + dz * 2500; P.len = 5000; P.dx = dx; P.dz = dz; P.speed = 95;
  P.y = Math.max(260, terrainAt(x, z) + 220);
  SUPPLY.push({ P, pl, s: 0, drop: null, tx: x, tz: z, flare });
  if (!flare) toast('طائرة إمداد في السماء', 'ستسقط صندوقاً قريباً · راقب المظلة الحمراء');
}
function updateSupply(dt) {
  for (let i = SUPPLY.length - 1; i >= 0; i--) {
    const q = SUPPLY[i]; q.s += q.P.speed * dt; planeAt(q.P, q.s, _pv); q.pl.position.copy(_pv); q.pl.rotation.set(0, Math.atan2(q.P.dx, q.P.dz), 0);
    for (const pr of q.pl.userData.props) pr.rotation.z += dt * 40;
    if (!q.drop && q.s >= 2500) {
      const ch = new THREE.Mesh(CHUTE_GEO, UBER_OBJ), box = new THREE.Mesh(DROPBOX_GEO, UBER_OBJ); ch.scale.setScalar(1.3);
      box.castShadow = ch.castShadow = true; scene.add(ch, box);
      q.drop = { ch, box, p: _pv.clone(), vy: -6 };
    }
    if (q.drop && q.drop.box) {
      const d = q.drop; d.p.y += d.vy * dt; d.p.x += Math.sin(T * 0.3) * dt; d.box.position.copy(d.p); d.box.rotation.y += dt * 0.2; d.ch.position.set(d.p.x, d.p.y + 5.2, d.p.z);
      const g = groundAt(d.p.x, d.p.z, d.p.y + 2);
      if (d.p.y <= g) {
        scene.remove(d.box, d.ch);
        const items = []; for (let k = 0; k < 3; k++) lootExtras('armory', items);
        items.push(['gun_' + pick(['awm', 'groza', 'aug', 'm249', 'mk47']), 1], [pick(['att_8x', 'att_6x', 'att_supp', 'att_extquick']), 1], [pick(['vest_l3', 'helmet_l3', 'pack_l3']), 1], ['medkit', 2], ['energy_drink', 2]);
        for (const [id] of items.slice()) { const w = ITEMS[id] && ITEMS[id].gunId && WEAPONS[ITEMS[id].gunId]; if (w) items.push([w.ammo, w.mag * 2]); }
        makeCrate(d.p.x, d.p.z, items, { y: g, drop: true, name: 'صندوق الإمداد', life: 1500 });
        spawnPuff(d.p.x, g + 0.3, d.p.z, 0xa8957a, 14, 3); AUDIO.land(12);
        if (Math.hypot(d.p.x - player.pos.x, d.p.z - player.pos.z) < 600) toast('هبط صندوق الإمداد', 'على بعد ' + toAr(Math.round(Math.hypot(d.p.x - player.pos.x, d.p.z - player.pos.z))) + ' م · تجده بعلامة على البوصلة');
        SUPPLY_MARK = { x: d.p.x, z: d.p.z, t: T };
        d.box = null;
      }
    }
    if (q.s > q.P.len) { scene.remove(q.pl); if (q.drop && q.drop.box) scene.remove(q.drop.box, q.drop.ch); SUPPLY.splice(i, 1); }
  }
}
let SUPPLY_MARK = null;
