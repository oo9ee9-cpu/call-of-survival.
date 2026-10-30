/* ═════════ gun models: every weapon drawn from its real layout — receiver, barrel, handguard, stock, magazine, sights — at
   real size; scopes, muzzles, grips, magazines and stocks appear on the gun when fitted. The grip sits where the right hand
   holds (0, -0.1, -0.1), the barrel points along +z. ═════════ */
const _GUNGEO = new Map();
function buildWeaponModel(wid, at = {}) {
  const w = WEAPONS[wid]; if (!w) return null;
  const P = w.prop && propMesh(w.prop);
  if (P) {
    // the artist's gun: its own textures; fitted parts change the numbers, not the look
    const g = new THREE.Group(), m = new THREE.Mesh(P.mesh.geometry, P.mesh.material); m.castShadow = true; m.receiveShadow = true; g.add(m);
    g.userData.muzzle = P.muzzle.clone(); g.userData.gun = true; g.userData.wid = wid; g.userData.prop = w.prop;
    return g;
  }
  const key = wid + '|' + ['sight', 'muzzle', 'grip', 'mag', 'stock'].map((s) => at[s] || '').join(',');
  let cached = _GUNGEO.get(key);
  if (!cached) { cached = gunGeometry(w, at); _GUNGEO.set(key, cached); }
  const g = new THREE.Group(), m = new THREE.Mesh(cached.geo, UBER_OBJ); m.castShadow = true; m.receiveShadow = true; g.add(m);
  g.userData.muzzle = cached.muzzle.clone(); g.userData.gun = true; g.userData.wid = wid;
  return g;
}
function gunGeometry(w, at) {
  const md = w.model, b = new Builder(), Q = MATID;
  const col = md.col, blk = 0x161718, steel = 0x3a3e42, wood = md.wood || 0x6e4428, poly = 0x242628;
  const box = (x, y, z, sx, sy, sz, c = col, k = Q.metal, rx = 0, ry = 0, rz = 0) => b.add(G.box, M(x, y, z, ry, sx, sy, sz, rx, rz), c, k);
  const tubeZ = (x, y, z, r, len, c = blk, k = Q.metal, geo = G.cyl8) => b.add(geo, M(x, y, z, 0, r, len, r, Math.PI / 2), c, k);
  const tubeY = (x, y, z, r, len, c = blk, k = Q.metal, rx = 0) => b.add(G.cyl8, M(x, y, z, 0, r, len, r, rx), c, k);
  const tubeX = (x, y, z, r, len, c = blk, k = Q.metal) => b.add(G.cyl8, M(x, y, z, 0, r, len, r, 0, Math.PI / 2), c, k);
  const grip = (z = -0.1, c = poly, rake = -0.32, len = 0.11) => box(0, -0.075, z, 0.03, len, 0.042, c, c === wood ? Q.wood : Q.plain, rake);
  const trigger = (z = -0.06) => { box(0, -0.048, z, 0.008, 0.03, 0.006, blk); b.add(G.torus, M(0, -0.055, z, Math.PI / 2, 0.022, 0.022, 0.03, 0), blk, Q.metal); };
  const rail = (z0, z1, y) => { box(0, y, (z0 + z1) / 2, 0.022, 0.012, z1 - z0, blk); for (let z = z0 + 0.01; z < z1; z += 0.022) box(0, y + 0.008, z, 0.024, 0.006, 0.01, blk); };
  const ironRear = (z, y) => { box(0, y + 0.018, z, 0.022, 0.024, 0.02, blk); };
  const ironFront = (z, y) => { box(0, y + 0.03, z, 0.016, 0.05, 0.016, blk); box(0, y + 0.058, z, 0.004, 0.018, 0.004, blk); };
  let muzzleZ = 0.5, muzzleY = 0.02, sightY = 0.065, sightZ = 0.02, railTop = true, magPos = null, gripPos = null, stockKind = md.stock;
  const L = md.len;
  const barrel = (z0, len, r = 0.011, y = 0.02) => { tubeZ(0, y, z0 + len / 2, r, len, blk); muzzleZ = z0 + len; muzzleY = y; };
  const mag = (kind, x, y, z, rx = 0, ext = 1) => {
    if (kind === 'stanag') { box(x, y - 0.06 * ext, z, 0.026, 0.13 * ext, 0.06, blk, Q.metal, rx); box(x, y - 0.125 * ext, z + 0.004, 0.03, 0.014, 0.066, poly, Q.plain, rx); }
    else if (kind === 'curved') { for (let k = 0; k < 4; k++) { const t = k / 3; box(x, y - 0.03 - t * 0.12 * ext, z + t * t * 0.07 * ext, 0.027, 0.05 * ext, 0.062, k % 2 ? 0x2a1d14 : blk, Q.metal, rx - 0.15 - t * 0.5); } }
    else if (kind === 'box') { box(x, y - 0.04 * ext, z, 0.026, 0.08 * ext, 0.07, blk, Q.metal, rx); }
    else if (kind === 'stick') { box(x, y - 0.075 * ext, z, 0.022, 0.15 * ext, 0.04, blk, Q.metal, rx); }
    else if (kind === 'drum') { b.add(G.cyl14, M(x, y - 0.07, z, 0, 0.075 * ext, 0.05, 0.075 * ext, 0, Math.PI / 2), blk, Q.metal); tubeX(x, y - 0.07, z, 0.02, 0.06, steel); }
    else if (kind === 'pan') { b.add(G.cyl14, M(x, y + 0.03, z, 0, 0.13, 0.03, 0.13), blk, Q.metal); b.add(G.cyl14, M(x, y + 0.05, z, 0, 0.04, 0.02, 0.04), steel, Q.metal); }
    else if (kind === 'boxbelt') { box(x, y - 0.07, z, 0.08, 0.12, 0.11, 0x3a4030, Q.fabric); box(x + 0.035, y - 0.01, z + 0.02, 0.01, 0.03, 0.05, 0xb8903a, Q.metal); }
    else if (kind === 'grip') { box(x, y - 0.13 * ext, z, 0.026, 0.06, 0.036, blk, Q.metal, rx); }
    else if (kind === 'tube') { /* under the barrel, drawn by the body */ }
  };
  const extMag = at.mag === 'att_extmag' || at.mag === 'att_extquick' ? 1.35 : 1;
  /* ── bodies ── */
  if (md.body === 'ar' || md.body === 'scar' || md.body === 'ak') {
    const ak = md.body === 'ak', scar = md.body === 'scar';
    // lower and upper receiver
    box(0, -0.012, 0.0, 0.04, 0.05, 0.25, col);
    box(0, 0.032, 0.02, scar ? 0.05 : 0.038, scar ? 0.05 : 0.04, scar ? 0.34 : 0.28, col);
    if (ak) { box(0, 0.045, 0.0, 0.04, 0.02, 0.26, col); box(0.022, 0.03, 0.04, 0.008, 0.012, 0.03, steel); }      // dust cover, charging handle
    else { box(0.023, 0.04, -0.07, 0.008, 0.012, 0.03, blk); box(-0.022, 0.0, 0.04, 0.004, 0.02, 0.04, blk); }         // charging, mag release
    grip(-0.1, ak && md.wood ? wood : poly); trigger(-0.055);
    // handguard
    const hgL = ak ? 0.2 : scar ? 0.18 : 0.24, hgZ = (scar ? 0.19 : 0.14) + hgL / 2;
    if (ak) { box(0, 0.005, hgZ, 0.046, 0.05, hgL, md.wood ? wood : poly, md.wood ? Q.wood : Q.plain); tubeZ(0, 0.05, hgZ - 0.02, 0.012, hgL + 0.06, col); }
    else { box(0, 0.025, hgZ, scar ? 0.048 : 0.05, 0.055, hgL, md.body === 'ar' && md.handle ? poly : col, Q.metal); for (const s of [-1, 1]) box(s * 0.026, 0.025, hgZ, 0.004, 0.012, hgL * 0.9, blk); }
    const bl = Math.max(0.12, L - 0.42 - (hgZ + hgL / 2)); barrel(hgZ + hgL / 2 - 0.02, bl + 0.02, 0.0105, ak ? 0.005 : 0.025);
    if (ak) { ironFront(hgZ + hgL / 2 + bl * 0.75, 0.0); box(0, 0.025, hgZ + hgL / 2 + bl * 0.75, 0.02, 0.03, 0.03, blk); }
    else if (!md.handle) ironFront(hgZ + hgL / 2 - 0.02, 0.05);
    else { box(0, 0.06, hgZ + hgL / 2 + 0.01, 0.016, 0.06, 0.016, blk); }
    if (md.handle) { box(0, 0.085, 0.0, 0.016, 0.014, 0.16, col); box(0, 0.068, -0.07, 0.016, 0.03, 0.016, col); box(0, 0.068, 0.07, 0.016, 0.03, 0.016, col); sightY = 0.11; railTop = false; }
    else rail(-0.1, 0.16, 0.058);
    sightZ = 0.02; magPos = [0, -0.035, 0.06, ak ? 0.05 : 0.08]; gripPos = [hgZ, -0.01];
    stockKind = stockKind || 'fixed';
    if (stockKind === 'tactical') { tubeZ(0, 0.025, -0.2, 0.014, 0.2, blk); box(0, 0.0, -0.3, 0.04, 0.09, 0.11, poly, Q.plain); box(0, -0.035, -0.355, 0.042, 0.06, 0.02, blk, Q.plain); }
    else if (stockKind === 'fixed') { box(0, 0.005, -0.27, 0.04, 0.07, 0.24, poly, Q.plain, 0.08); box(0, -0.02, -0.39, 0.042, 0.11, 0.025, blk, Q.plain); }
    else if (stockKind === 'wood') { box(0, -0.005, -0.27, 0.04, 0.075, 0.26, wood, Q.wood, 0.12); box(0, -0.035, -0.4, 0.042, 0.115, 0.02, 0x2a1d14, Q.wood); }
    else if (stockKind === 'folding') { box(0, 0.02, -0.2, 0.012, 0.03, 0.18, blk); box(0, 0.0, -0.3, 0.036, 0.1, 0.03, poly, Q.plain); box(0, 0.045, -0.24, 0.012, 0.012, 0.12, blk); }
    mag(md.mag, magPos[0], magPos[1], magPos[2], 0.05, extMag);
  } else if (md.body === 'bullpup' || md.body === 'aug') {
    const aug = md.body === 'aug';
    // the action sits behind the grip: a long body from the cheek to the handguard
    box(0, 0.005, -0.12, aug ? 0.06 : 0.05, aug ? 0.09 : 0.08, 0.36, col, aug ? Q.plain : Q.metal);
    box(0, 0.04, 0.12, 0.044, 0.05, 0.22, col, aug ? Q.plain : Q.metal);
    grip(0.02, aug ? col : poly, -0.25); trigger(0.06);
    if (aug) { box(0, -0.06, 0.18, 0.03, 0.1, 0.035, col, Q.plain, 0.15); box(0, -0.02, 0.08, 0.05, 0.03, 0.2, col, Q.plain); }  // its own fore-grip and trigger guard
    box(0, -0.03, -0.29, 0.05, 0.12, 0.025, blk, Q.plain);
    barrel(0.2, Math.max(0.14, L - 0.5), 0.011, 0.04);
    if (md.handle) { box(0, 0.105, -0.02, 0.016, 0.014, 0.22, col); box(0, 0.08, -0.11, 0.018, 0.04, 0.018, col); box(0, 0.08, 0.08, 0.018, 0.04, 0.018, col); sightY = 0.125; railTop = false; }
    else rail(-0.14, 0.12, 0.06);
    if (md.wood) box(0, 0.0, 0.12, 0.05, 0.035, 0.12, wood, Q.wood);
    sightZ = -0.02; magPos = [0, -0.035, -0.08]; gripPos = [0.2, 0.0];
    mag(md.mag, 0, -0.04, -0.07, 0.05, extMag);
  } else if (md.body === 'classic' || md.body === 'vss') {
    const vss = md.body === 'vss';
    box(0, 0.02, -0.02, 0.04, 0.05, 0.26, col);
    box(0, -0.005, 0.12, 0.05, 0.05, 0.34, md.wood || md.stock === 'wood' ? wood : poly, md.wood ? Q.wood : Q.plain);      // wooden fore-end
    grip(-0.1, md.wood ? wood : poly, -0.5, 0.09); trigger(-0.05);
    if (vss) { tubeZ(0, 0.02, 0.36, 0.024, 0.34, 0x2a2826); muzzleZ = 0.53; muzzleY = 0.02; }
    else { barrel(0.28, Math.max(0.16, L - 0.72), 0.011, 0.02); tubeZ(0, 0.045, 0.2, 0.008, 0.2, col); ironFront(muzzleZ - 0.03, 0.0); }
    rail(-0.1, 0.1, 0.055);
    if (md.stock === 'wood') { box(0, -0.01, -0.27, 0.042, 0.075, 0.28, wood, Q.wood, 0.14); box(0, -0.04, -0.41, 0.044, 0.12, 0.02, 0x2a1d14, Q.wood); }
    else if (md.stock === 'skeleton') { box(0, 0.0, -0.22, 0.03, 0.02, 0.2, wood, Q.wood, 0.1); box(0, -0.06, -0.24, 0.03, 0.02, 0.24, wood, Q.wood, -0.05); box(0, -0.035, -0.35, 0.034, 0.1, 0.03, wood, Q.wood); }
    else { box(0, 0.0, -0.27, 0.04, 0.07, 0.26, poly, Q.plain, 0.1); box(0, -0.03, -0.4, 0.042, 0.11, 0.02, blk, Q.plain); }
    sightZ = -0.02; magPos = [0, -0.03, 0.03];
    if (vss) { b.add(G.cyl8, M(0, 0.1, -0.01, 0, 0.018, 0.16, 0.018, Math.PI / 2), blk, Q.metal); box(0, 0.07, -0.01, 0.016, 0.02, 0.04, blk); }   // its own four-power scope
    mag(md.mag, 0, -0.03, 0.03, 0, extMag);
  } else if (md.body === 'bolt' || md.body === 'lever') {
    const awm = w.id === 'awm', kar = w.id === 'kar98', lever = md.body === 'lever';
    box(0, 0.025, 0.0, 0.036, 0.042, 0.24, col);
    tubeX(0.035, 0.03, -0.06, 0.006, 0.05, steel); b.add(G.sph, M(0.06, 0.03, -0.06, 0, 0.012, 0.012, 0.012), steel, Q.metal);     // the bolt handle
    if (lever) { b.add(G.torus, M(0, -0.07, -0.05, Math.PI / 2, 0.035, 0.035, 0.05), blk, Q.metal); tubeZ(0, -0.005, 0.28, 0.009, 0.42, blk); }
    if (awm) {
      box(0, -0.005, 0.18, 0.05, 0.05, 0.32, col, Q.plain); box(0, -0.06, -0.12, 0.034, 0.1, 0.04, col, Q.plain, -0.35);
      box(0, 0.0, -0.3, 0.046, 0.08, 0.24, col, Q.plain); box(0, 0.05, -0.28, 0.03, 0.02, 0.14, col, Q.plain); box(0, -0.06, -0.33, 0.046, 0.04, 0.12, col, Q.plain); box(0, -0.03, -0.43, 0.048, 0.12, 0.02, blk, Q.plain);
      tubeZ(0, 0.03, 0.62, 0.013, 0.56, blk); tubeZ(0, 0.03, 0.93, 0.02, 0.07, blk); muzzleZ = 0.97; muzzleY = 0.03;
      for (const s of [-1, 1]) box(s * 0.03, -0.1, 0.3, 0.008, 0.16, 0.008, blk, Q.metal, 0.3);       // folded bipod
    } else {
      const reach = kar ? 0.58 : lever ? 0.3 : 0.42;
      box(0, -0.005, 0.03 + reach / 2, 0.046, 0.05, reach + 0.12, wood === 0x6e4428 && !md.wood ? poly : wood, md.wood ? Q.wood : Q.plain);
      grip(-0.1, md.wood ? wood : poly, -0.6, 0.085); trigger(-0.05);
      box(0, -0.005, -0.27, 0.042, 0.08, 0.3, md.wood ? wood : poly, md.wood ? Q.wood : Q.plain, 0.12); box(0, -0.04, -0.42, 0.044, 0.12, 0.02, 0x2a1d14, Q.wood);
      barrel(0.1, Math.max(0.3, L - 0.52), 0.0105, 0.035);
      ironFront(muzzleZ - 0.02, 0.01); ironRear(0.16, 0.06);
      if (kar) { box(0, 0.02, 0.62, 0.012, 0.012, 0.06, steel); box(0, -0.012, 0.42, 0.05, 0.015, 0.015, steel); }    // bayonet lug and band
    }
    sightY = 0.09; sightZ = 0.0; magPos = md.mag === 'box' ? [0, -0.03, 0.02] : null;
    if (md.mag === 'box') mag('box', 0, -0.02, 0.03, 0, extMag);
    railTop = !lever && !kar;
    if (railTop) rail(-0.08, 0.1, 0.05);
  } else if (md.body === 'uzi' || md.body === 'smg' || md.body === 'vector' || md.body === 'tommy') {
    if (md.body === 'uzi') {
      box(0, 0.02, 0.03, 0.04, 0.06, 0.24, col); box(0, -0.075, -0.04, 0.032, 0.13, 0.045, poly, Q.plain, -0.08); trigger(0.0);
      barrel(0.15, 0.05, 0.009, 0.02); mag('grip', 0, -0.05, -0.04, -0.08, extMag);
      box(0, 0.05, 0.12, 0.012, 0.025, 0.012, blk); box(0, 0.05, -0.06, 0.016, 0.02, 0.012, blk);
      box(0, 0.0, -0.18, 0.006, 0.02, 0.2, steel); box(0, -0.04, -0.27, 0.03, 0.07, 0.01, steel);
      sightY = 0.07; magPos = null; railTop = false;
    } else if (md.body === 'smg') {
      box(0, 0.025, 0.05, 0.045, 0.075, 0.3, col, Q.plain); grip(-0.06, poly, -0.25); trigger(-0.02);
      barrel(0.2, 0.08, 0.01, 0.025); rail(-0.06, 0.16, 0.068);
      if (stockKind === 'folding') { box(0, 0.02, -0.17, 0.034, 0.07, 0.035, poly, Q.plain); box(0, 0.04, -0.24, 0.012, 0.012, 0.14, blk); box(0, 0.0, -0.31, 0.036, 0.09, 0.025, poly, Q.plain); }
      magPos = [0, -0.015, 0.06]; mag('stick', 0, -0.015, 0.06, 0.12, extMag);
    } else if (md.body === 'vector') {
      box(0, 0.03, 0.04, 0.045, 0.07, 0.28, col, Q.plain); box(0, -0.03, 0.07, 0.04, 0.06, 0.12, col, Q.plain, -0.5);   // the angled lower
      grip(-0.06, poly, -0.15); trigger(-0.02); barrel(0.18, 0.08, 0.01, 0.03); rail(-0.08, 0.16, 0.07);
      tubeZ(0, 0.04, -0.17, 0.012, 0.16, blk); box(0, 0.01, -0.27, 0.036, 0.09, 0.08, poly, Q.plain);
      magPos = [0, -0.06, 0.1]; mag('stick', 0, -0.06, 0.1, 0, extMag);
    } else {
      // the Tommy gun: wooden stock and grips, a finned barrel and the drum
      box(0, 0.025, 0.03, 0.042, 0.06, 0.28, col); grip(-0.08, wood, -0.3); trigger(-0.03);
      tubeZ(0, 0.025, 0.3, 0.017, 0.24, blk, Q.metal, G.cyl14); for (let z = 0.2; z < 0.4; z += 0.02) tubeZ(0, 0.025, z, 0.021, 0.006, steel);
      muzzleZ = 0.43; muzzleY = 0.025; box(0, -0.06, 0.24, 0.03, 0.08, 0.04, wood, Q.wood, 0.25);
      box(0, 0.005, -0.27, 0.04, 0.075, 0.28, wood, Q.wood, 0.12); box(0, -0.03, -0.41, 0.042, 0.11, 0.02, 0x2a1d14, Q.wood);
      ironFront(0.41, 0.01); ironRear(-0.06, 0.05); railTop = false; sightY = 0.08;
      magPos = [0, -0.03, 0.12]; mag('drum', 0, -0.03, 0.12, 0, 1);
    }
    gripPos = [0.17, -0.01];
  } else if (md.body === 'lmg' || md.body === 'dp') {
    const dp = md.body === 'dp';
    box(0, 0.025, 0.0, 0.05, 0.075, 0.3, col); grip(-0.1, dp ? wood : poly, -0.35); trigger(-0.05);
    if (dp) { tubeZ(0, 0.02, 0.35, 0.024, 0.4, blk, Q.metal, G.cyl14); for (let z = 0.18; z < 0.52; z += 0.035) tubeZ(0, 0.02, z, 0.027, 0.012, steel); barrel(0.55, 0.12, 0.011, 0.02);
      box(0, -0.0, -0.28, 0.042, 0.08, 0.28, wood, Q.wood, 0.12); box(0, -0.03, -0.42, 0.044, 0.12, 0.02, 0x2a1d14, Q.wood); mag('pan', 0, 0.06, 0.02); sightY = 0.1; railTop = false; }
    else { box(0, 0.02, 0.22, 0.055, 0.06, 0.16, poly, Q.plain); barrel(0.3, 0.3, 0.013, 0.025); box(0, 0.075, 0.05, 0.016, 0.03, 0.1, blk);   // carry handle
      tubeZ(0, 0.0, -0.18, 0.014, 0.12, blk); box(0, -0.01, -0.3, 0.04, 0.09, 0.14, poly, Q.plain); mag('boxbelt', 0.0, -0.02, 0.05); rail(-0.1, 0.05, 0.068); }
    for (const s of [-1, 1]) box(s * 0.025, -0.06, muzzleZ - 0.12, 0.008, 0.14, 0.008, blk, Q.metal, 0.25);         // bipod legs
    magPos = null;
  } else if (md.body === 'pump' || md.body === 'double' || md.body === 'sawed') {
    const sawed = md.body === 'sawed';
    if (md.body === 'pump') {
      box(0, 0.015, 0.0, 0.044, 0.07, 0.22, col); barrel(0.11, Math.max(0.3, L - 0.53), 0.011, 0.035);
      tubeZ(0, 0.005, 0.32, 0.01, 0.42, blk); box(0, 0.002, 0.3, 0.05, 0.045, 0.16, wood, Q.wood);    // tube magazine and the pump
      box(0, 0.005, -0.25, 0.04, 0.075, 0.26, wood, Q.wood, 0.14); box(0, -0.03, -0.38, 0.042, 0.11, 0.02, 0x2a1d14, Q.wood);
      grip(-0.1, wood, -0.6, 0.08); trigger(-0.05); b.add(G.sph, M(0, 0.05, muzzleZ - 0.02, 0, 0.005, 0.005, 0.005), 0xe8e2d0, Q.metal);
    } else {
      box(0, 0.015, 0.0, 0.044, 0.06, 0.16, steel); const bl = sawed ? 0.2 : Math.max(0.36, L - 0.5);
      for (const s of [-1, 1]) tubeZ(0, 0.02 + s * 0.012, 0.08 + bl / 2, 0.012, bl, blk);
      box(0, 0.0, 0.08 + bl * 0.3, 0.04, 0.03, bl * 0.4, wood, Q.wood); muzzleZ = 0.08 + bl; muzzleY = 0.02;
      if (sawed) { box(0, -0.07, -0.1, 0.034, 0.11, 0.05, wood, Q.wood, -0.5); }
      else { grip(-0.1, wood, -0.6, 0.08); box(0, 0.0, -0.25, 0.042, 0.08, 0.28, wood, Q.wood, 0.14); box(0, -0.03, -0.39, 0.044, 0.12, 0.02, 0x2a1d14, Q.wood); }
      trigger(-0.04);
    }
    railTop = false; sightY = 0.06; magPos = null;
  } else if (md.body === 'pistol' || md.body === 'revolver' || md.body === 'flare') {
    const y0 = -0.035, z0 = -0.06;
    if (md.body === 'pistol') {
      box(0, y0 + 0.03, z0 + 0.06, 0.028, 0.032, 0.19, col); box(0, y0 + 0.008, z0 + 0.07, 0.026, 0.022, 0.15, blk);     // slide and frame
      for (let k = 0; k < 5; k++) box(0, y0 + 0.032, z0 - 0.015 + k * 0.008, 0.03, 0.022, 0.003, blk);                   // slide serrations
      box(0, y0 - 0.045, z0 - 0.03, 0.026, 0.1, 0.04, poly, Q.plain, -0.22); trigger(z0 + 0.01);
      muzzleZ = z0 + 0.16; muzzleY = y0 + 0.03; box(0, y0 + 0.05, z0 + 0.14, 0.004, 0.008, 0.006, blk); box(0, y0 + 0.05, z0 - 0.02, 0.014, 0.008, 0.006, blk);
      magPos = [0, y0 - 0.09, z0 - 0.035];
      if (extMag > 1) box(0, y0 - 0.1, z0 - 0.045, 0.024, 0.04, 0.035, blk, Q.metal, -0.22);
    } else if (md.body === 'revolver') {
      box(0, y0 + 0.012, z0 + 0.02, 0.028, 0.04, 0.08, col); b.add(G.cyl6, M(0, y0 + 0.015, z0 + 0.04, 0, 0.022, 0.045, 0.022, Math.PI / 2), col, Q.metal);
      tubeZ(0, y0 + 0.03, z0 + 0.12, 0.009, L - 0.12, col); box(0, y0 + 0.02, z0 + 0.12, 0.012, 0.015, L - 0.12, col);
      box(0, y0 - 0.045, z0 - 0.04, 0.028, 0.09, 0.038, md.wood || 0x3a2a1e, Q.wood, -0.35); trigger(z0 + 0.0);
      muzzleZ = z0 + 0.06 + L - 0.07; muzzleY = y0 + 0.03; box(0, y0 + 0.045, muzzleZ - 0.01, 0.004, 0.012, 0.008, blk);
    } else {
      box(0, y0 + 0.01, z0 + 0.02, 0.03, 0.05, 0.09, col, Q.plain); tubeZ(0, y0 + 0.025, z0 + 0.12, 0.022, 0.14, col, Q.plain, G.cyl14);
      tubeZ(0, y0 + 0.025, z0 + 0.19, 0.016, 0.01, blk); box(0, y0 - 0.04, z0 - 0.03, 0.028, 0.09, 0.04, col, Q.plain, -0.3); trigger(z0 + 0.0);
      muzzleZ = z0 + 0.19; muzzleY = y0 + 0.025;
    }
    railTop = false; sightY = y0 + 0.06; sightZ = z0 + 0.05;
  } else if (md.body === 'crossbow') {
    box(0, 0.0, 0.05, 0.04, 0.05, 0.5, wood, Q.wood); grip(-0.1, wood, -0.4); trigger(-0.05);
    box(0, 0.0, -0.27, 0.04, 0.08, 0.2, wood, Q.wood, 0.1);
    for (const s of [-1, 1]) box(s * 0.16, 0.02, 0.28 - 0.03, 0.3, 0.02, 0.025, blk, Q.metal, 0, s * 0.25);            // the limbs
    for (const s of [-1, 1]) box(s * 0.15, 0.03, 0.13, 0.003, 0.003, 0.3, 0xe8e2d0, Q.fabric, 0, s * 0.55);           // the string
    tubeZ(0, 0.035, 0.18, 0.004, 0.36, 0x8a8f94); b.add(G.cone, M(0, 0.035, 0.37, 0, 0.008, 0.03, 0.008, Math.PI / 2), 0x8a8f94, Q.metal);
    muzzleZ = 0.36; muzzleY = 0.035; railTop = true; rail(-0.08, 0.06, 0.035); sightY = 0.05;
  }
  /* ── attachments ── */
  const A = at;
  if (A.sight) {
    const s = A.sight, y = sightY, z = sightZ;
    if (railTop === false && w.cls !== 'pistol') box(0, y - 0.01, z, 0.022, 0.014, 0.08, blk);                      // a side mount where there is no rail
    if (s === 'att_reddot') { box(0, y + 0.012, z, 0.022, 0.022, 0.035, blk); tubeZ(0, y + 0.03, z, 0.016, 0.03, blk); box(0, y + 0.03, z + 0.016, 0.026, 0.026, 0.002, 0x5a2a2a, Q.glass); }
    else if (s === 'att_holo') { box(0, y + 0.01, z, 0.03, 0.016, 0.06, blk); for (const sx of [-1, 1]) box(sx * 0.016, y + 0.035, z + 0.01, 0.004, 0.04, 0.03, blk); box(0, y + 0.055, z + 0.01, 0.036, 0.004, 0.03, blk); }
    else {
      const zoom = ATTACH_DEF[s].zoom, len = 0.1 + zoom * 0.022, r = zoom >= 6 ? 0.02 : 0.016;
      box(0, y + 0.01, z, 0.02, 0.018, 0.04, blk); tubeZ(0, y + 0.035, z, r * 0.8, len, blk, Q.metal, G.cyl14);
      tubeZ(0, y + 0.035, z + len / 2 - 0.015, r * (zoom >= 6 ? 1.35 : 1.15), 0.04, blk, Q.metal, G.cyl14); tubeZ(0, y + 0.035, z - len / 2 + 0.015, r * 1.05, 0.035, blk, Q.metal, G.cyl14);
      if (zoom >= 4) { tubeY(0, y + 0.058, z, 0.009, 0.014, blk); tubeX(0.024, y + 0.035, z, 0.008, 0.014, blk); }
      b.add(G.cyl14, M(0, y + 0.035, z + len / 2 + 0.002, 0, r * 1.05, 0.002, r * 1.05, Math.PI / 2), 0x2a4a5a, Q.glass);
    }
  }
  if (A.muzzle && muzzleZ) {
    const z = muzzleZ, y = muzzleY;
    if (A.muzzle === 'att_supp') { tubeZ(0, y, z + 0.08, 0.019, 0.17, 0x1a1a1c, Q.metal, G.cyl14); muzzleZ += 0.17; }
    else if (A.muzzle === 'att_comp') { tubeZ(0, y, z + 0.03, 0.015, 0.06, blk); for (const s of [-1, 1]) box(s * 0.012, y + 0.008, z + 0.035, 0.006, 0.01, 0.03, 0x0e0e0f); muzzleZ += 0.06; }
    else if (A.muzzle === 'att_flash') { tubeZ(0, y, z + 0.03, 0.013, 0.06, blk); for (let k = 0; k < 4; k++) box(Math.cos(k * 1.57) * 0.012, y + Math.sin(k * 1.57) * 0.012, z + 0.045, 0.004, 0.004, 0.03, 0x0e0e0f); muzzleZ += 0.06; }
    else if (A.muzzle === 'att_choke') { tubeZ(0, y, z + 0.025, 0.015, 0.05, steel); muzzleZ += 0.05; }
  } else if (muzzleZ && w.cls !== 'pistol' && md.body !== 'crossbow' && w.cls !== 'sg' && md.body !== 'vss') {
    tubeZ(0, muzzleY, muzzleZ + 0.022, 0.0135, 0.045, blk); muzzleZ += 0.045;          // the bare flash hider every rifle comes with
  }
  if (A.grip && gripPos) {
    const [z, y] = gripPos;
    if (A.grip === 'att_vgrip') box(0, y - 0.06, z, 0.026, 0.09, 0.03, poly, Q.plain);
    else if (A.grip === 'att_agrip') box(0, y - 0.035, z, 0.03, 0.045, 0.07, poly, Q.plain, 0.55);
    else box(0, y - 0.045, z, 0.024, 0.06, 0.026, poly, Q.plain, 0.2);
  }
  if (A.stock === 'att_stock' && (stockKind === 'none' || md.body === 'uzi')) { box(0, 0.0, -0.22, 0.034, 0.08, 0.12, poly, Q.plain); }
  if (A.stock === 'att_cheek') box(0, 0.045, -0.24, 0.036, 0.025, 0.12, 0x3a3f2e, Q.fabric);
  return { geo: b.geometry(), muzzle: new THREE.Vector3(0, muzzleY, muzzleZ + 0.01) };
}
/* a modelled gun or blade just arrived: whatever is in your hand is rebuilt with it */
PROP_WAIT.push(() => {
  if (!RIG.tools) return;
  for (const k of Object.keys(RIG.tools)) if (k.startsWith('gun:') || k.endsWith(':wait')) { const t = RIG.tools[k]; if (t && t.parent) t.parent.remove(t); delete RIG.tools[k]; }
  if (typeof _gunShot !== 'undefined') _gunShot.clear();
  showTool(true);
});
/* a gun's look changes when something is fitted: rebuild the one in your hand */
function refreshGunModel(gid) {
  if (!RIG.tools) return;
  const key = 'gun:' + gid, old = RIG.tools[key]; if (!old) return;
  const vis = old.visible; if (old.parent) old.parent.remove(old); delete RIG.tools[key];
  if (vis && player.toolItem === gid) showTool(true);
}
