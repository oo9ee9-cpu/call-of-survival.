/* ═════════ places between the towns: the old castle, the desert temple, the radio mast, filling stations, hunters' cabins,
   the abandoned camp, the wind farm and the loggers' camp — streamed in like the towns ═════════ */
const ROTORS = [];
function initPlaces() {
  const W = WORLD.data;
  (W.poi || []).forEach((p, n) => {
    if (['city', 'village', 'military', 'lighthouse'].includes(p.kind)) return;
    const id = 'poi' + n, R0 = RNG(n * 131 + 7), blds = [], props = [];
    const g = (x, z) => terrainAt(x, z);
    const cabin = (x, z, door, style, hx = 4, hz = 3.5, name, extra = {}) => blds.push(Object.assign({ kind: 'house', x, z, hx, hz, door, style, floors: 1, seed: Math.floor(R0() * 1e9), enter: true, name }, extra));
    if (p.kind === 'cabin') { cabin(p.x, p.z, 's', 'chalet', 4.2, 3.6, 'كوخ الصياد', { lootKind: 'home' }); props.push({ kind: 'crates', x: p.x + 7, z: p.z + 2 }); }
    if (p.kind === 'radio') { cabin(p.x + 14, p.z + 6, 'w', 'military', 4, 3.2, 'غرفة الإرسال', { lootKind: 'military' }); props.push({ kind: 'crates', x: p.x + 10, z: p.z - 8 }); }
    if (p.kind === 'gas') blds.push({ kind: 'shop', x: p.x + 12, z: p.z - 10, hx: 6, hz: 4.5, door: 'w', style: 'city', floors: 1, seed: n * 977, enter: true, shop: 'gas', name: 'متجر المحطة', sign: 'محطة وقود' });
    if (p.kind === 'camp') { for (let k = 0; k < 7; k++) props.push({ kind: 'tent', x: p.x + Math.cos(k * 0.9) * (14 + k * 2), z: p.z + Math.sin(k * 0.9) * (14 + k * 2), ry: k * 0.9 }); props.push({ kind: 'watchtower', x: p.x - 22, z: p.z + 18 }, { kind: 'crates', x: p.x + 4, z: p.z - 6 }, { kind: 'crates', x: p.x - 8, z: p.z + 3 }); }
    if (p.kind === 'loggers') { cabin(p.x + 18, p.z - 12, 'w', 'chalet', 5, 4, 'بيت الحطّابين', { lootKind: 'home' }); props.push({ kind: 'crates', x: p.x + 10, z: p.z + 12 }); }
    if (p.kind === 'castle') props.push({ kind: 'crates', x: p.x + 4, z: p.z + 3 });
    const src = { id, name: p.name, kind: 'poi', x: p.x, z: p.z, r: p.r || 60, buildings: blds, props, streets: [], poi: p };
    const S = { id, name: p.name, kind: 'poi', x: p.x, z: p.z, r: 50, src, buildings: blds, state: 'far', ctx: null, job: null, far: null, poi: p };
    blds.forEach((o, i) => {
      o.id = id + ':' + i; o.st = STYLES[o.style] || STYLES.city; if (!o.wall) o.wall = o.st.walls[(o.seed || i) % o.st.walls.length]; if (!o.trim) o.trim = TRIMS[(o.seed || i) % TRIMS.length];
      if (!o.roofC) o.roofC = (o.st.roofC || [0x8a3a2a])[((o.seed || i) >> 3) % (o.st.roofC || [0]).length];
      BUILDINGS.push(o); BGRID.insert(o, o.x - o.hx, o.z - o.hz, o.x + o.hx, o.z + o.hz); o.settlement = S;
    });
    SETTLEMENTS.push(S);
  });
}
/* the hand-made parts of each place */
function poiBuild(ctx, p) {
  const R = RNG(Math.round(p.x * 3 + p.z)), b = ctx.at(p.x, p.z), g0 = terrainAt(p.x, p.z), ST = 0x9a9080, ST2 = 0x857a6a;
  const solidBox = (x, z, hx, hz, y0, y1) => ctx.col({ t: 'b', x, z, hx, hz, y0, y1 });
  if (p.kind === 'castle') {
    // a square curtain wall with broken stretches, four round towers, a keep in the middle
    const H = 9, hs = 26, cx = p.x, cz = p.z;
    for (const [nx, nz] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const along = nz !== 0;
      for (let t = -hs + 2; t < hs - 2; t += 4) {
        const gap = (nz === 1 && Math.abs(t + 2) < 4) || R() < 0.12;   // the gate on the south side, and breaches
        const px = cx + nx * hs + (along ? t + 2 : 0), pz = cz + nz * hs + (along ? 0 : t + 2), g = terrainAt(px, pz), h = gap ? R() * 2 : H * (0.7 + R() * 0.35);
        if (h < 0.4) { b.add(G.dodec, M(px, g + 0.4, pz, R() * 6, 1.2, 0.6, 1.0), ST2, K.stone); continue; }
        b.box(px, g + h / 2 - 1, pz, along ? 4.05 : 2.2, h + 2, along ? 2.2 : 4.05, R() < 0.5 ? ST : ST2, 0, K.stone);
        if (h > H * 0.8) for (const s of [-1, 1]) b.box(px + (along ? s * 1.1 : 0), g + h + 0.5, pz + (along ? 0 : s * 1.1), along ? 1.1 : 2.3, 1.0, along ? 2.3 : 1.1, ST, 0, K.stone);
        solidBox(px, pz, along ? 2.05 : 1.1, along ? 1.1 : 2.05, g - 3, g + h);
        ctx.occ({ t: 'b', x: px, z: pz, hx: along ? 2 : 1.1, hz: along ? 1.1 : 2, bot: g - 2, top: g + h });
      }
    }
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const tx = cx + sx * hs, tz = cz + sz * hs, g = terrainAt(tx, tz), th = 11 + R() * 6, broken = R() < 0.4;
      b.add(G.cyl14, M(tx, g + th / 2 - 1, tz, 0, 4.2, th + 2, 4.2), ST2, K.stone);
      if (!broken) { for (let k = 0; k < 10; k++) { const a = k / 10 * TAU; b.box(tx + Math.cos(a) * 3.9, g + th + 0.6, tz + Math.sin(a) * 3.9, 1.1, 1.2, 1.1, ST, a, K.stone); } b.add(G.cone, M(tx, g + th + 3, tz, 0, 4.6, 4.2, 4.6), 0x6a3a2a, K.stone); }
      ctx.col({ t: 'c', x: tx, z: tz, r: 4.3, y1: g + th }); ctx.occ({ t: 'c', x: tx, z: tz, r: 4.2, top: g + th });
    }
    // the keep: a hollow tower with a stair of platforms to the battlements
    const kx = cx, kz = cz - 4, kg = terrainAt(kx, kz), KH = 16;
    for (const [nx, nz] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const along = nz !== 0, px = kx + nx * 5, pz = kz + nz * 5;
      if (nz === 1) { for (const s of [-1, 1]) { b.box(px + s * 3.2, kg + KH / 2, pz, 3.6, KH, 1.4, ST, 0, K.stone); solidBox(px + s * 3.2, pz, 1.8, 0.7, kg - 1, kg + KH); } b.box(px, kg + KH - 2.5, pz, 2.8, 5, 1.4, ST, 0, K.stone); }
      else { b.box(px, kg + KH / 2, pz, along ? 11.4 : 1.4, KH, along ? 1.4 : 11.4, ST, 0, K.stone); solidBox(px, pz, along ? 5.7 : 0.7, along ? 0.7 : 5.7, kg - 1, kg + KH); }
      for (let k = -2; k <= 2; k++) b.box(px + (along ? k * 2.2 : 0), kg + KH + 0.6, pz + (along ? 0 : k * 2.2), along ? 1.1 : 1.6, 1.2, along ? 1.6 : 1.1, ST2, 0, K.stone);
      ctx.occ({ t: 'b', x: px, z: pz, hx: along ? 5.7 : 0.7, hz: along ? 0.7 : 5.7, bot: kg - 1, top: kg + KH });
    }
    // a spiral of landings up the inside
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 2, lx = kx + Math.cos(a) * 2.2, lz = kz + Math.sin(a) * 2.2, y = kg + 2 + k * 1.75;
      b.box(lx, y - 0.15, lz, 2.6, 0.3, 2.6, ST2, 0, K.stone); ctx.plat({ t: 'rect', x0: lx - 1.3, x1: lx + 1.3, z0: lz - 1.3, z1: lz + 1.3, y });
    }
    b.box(kx, kg + KH - 0.15, kz, 9, 0.3, 9, ST2, 0, K.stone); ctx.plat({ t: 'rect', x0: kx - 4.3, x1: kx + 4.3, z0: kz - 4.3, z1: kz + 4.3, y: kg + KH });
    ctx.light({ x: kx, y: kg + 1.5, z: kz, color: 0xff9a50, range: 10, kind: 'fire' });
    for (let k = 0; k < 18; k++) { const a = R() * TAU, d = 8 + R() * 30, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d; b.add(G.dodec, M(x, terrainAt(x, z) + 0.3, z, R() * 6, 0.5 + R() * 1.1, 0.3 + R() * 0.5, 0.5 + R()), ST2, K.stone); }
    LOOT_SPOTS.push({ x: kx + 1, y: kg, z: kz, kind: 'military', owner: ctx.S.id }, { x: kx - 2, y: kg + KH, z: kz + 2, kind: 'home', owner: ctx.S.id });
  } else if (p.kind === 'ruins') {
    // a sand-buried temple: a stepped platform, rows of broken columns, a doorway to nowhere, ruined houses around it
    const cx = p.x, cz = p.z, g = terrainAt(cx, cz), SC = 0xd8c09a, SC2 = 0xc8ab80;
    for (let k = 0; k < 3; k++) { b.box(cx, g + 0.4 + k * 0.8, cz, 34 - k * 6, 0.8, 22 - k * 4, k % 2 ? SC2 : SC, 0, K.stone); }
    ctx.plat({ t: 'rect', x0: cx - 11, x1: cx + 11, z0: cz - 7, z1: cz + 7, y: g + 2.4 });
    ctx.col({ t: 'b', x: cx, z: cz, hx: 17, hz: 11, y1: g + 1.1 });
    for (const sz of [-1, 1]) for (let k = 0; k < 8; k++) {
      const px = cx - 9.8 + k * 2.8, pz = cz + sz * 5.5, h = R() < 0.3 ? 1 + R() * 2 : 5 + R() * 3;
      b.add(G.cyl14, M(px, g + 2.4 + h / 2, pz, 0, 0.55, h, 0.55), SC, K.stone); b.box(px, g + 2.4 + 0.15, pz, 1.4, 0.3, 1.4, SC2, 0, K.stone);
      if (h > 5) b.box(px, g + 2.4 + h + 0.2, pz, 1.4, 0.4, 1.4, SC2, 0, K.stone);
      ctx.col({ t: 'c', x: px, z: pz, r: 0.6, y1: g + 2.4 + h });
      if (h < 3) { const a = R() * TAU; b.add(G.cyl14, M(px + Math.cos(a) * 2.5, g + 2.9, pz + Math.sin(a) * 2.5, a, 0.5, 4, 0.5, Math.PI / 2), SC2, K.stone); }
    }
    b.box(cx + 8, g + 5, cz, 1, 5, 1, SC, 0, K.stone); b.box(cx + 8, g + 5, cz + 3, 1, 5, 1, SC, 0, K.stone); b.box(cx + 8, g + 7.8, cz + 1.5, 1.2, 0.8, 4.4, SC2, 0, K.stone);
    for (let k = 0; k < 6; k++) {          // ruined adobe houses: walls without roofs
      const a = k / 6 * TAU + 0.3, d = 34 + R() * 14, hx0 = cx + Math.cos(a) * d, hz0 = cz + Math.sin(a) * d, hg = terrainAt(hx0, hz0), w = 4 + R() * 3, dd = 3.5 + R() * 2;
      for (const [nx, nz] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        if (R() < 0.25) continue; const along = nz !== 0, h = 1 + R() * 2.6, px = hx0 + nx * w, pz = hz0 + nz * dd;
        b.box(px, hg + h / 2 - 0.4, pz, along ? w * 2 * (0.5 + R() * 0.5) : 0.45, h + 0.8, along ? 0.45 : dd * 2 * (0.5 + R() * 0.5), 0xcfae7c, 0, K.plaster);
        solidBox(px, pz, along ? w * 0.9 : 0.25, along ? 0.25 : dd * 0.9, hg - 1, hg + h);
      }
      if (R() < 0.5) LOOT_SPOTS.push({ x: hx0, y: hg, z: hz0, kind: 'home', owner: ctx.S.id });
    }
    LOOT_SPOTS.push({ x: cx, y: g + 2.4, z: cz, kind: 'military', owner: ctx.S.id });
  } else if (p.kind === 'radio') {
    // a lattice mast with blinking red lights, guy wires, a fenced yard
    const cx = p.x, cz = p.z, g = terrainAt(cx, cz), H = 64, MT = 0xb8b2a4;
    for (let k = 0; k < 16; k++) {
      const y0 = g + k * H / 16, w0 = 2.4 * (1 - k / 20), w1 = 2.4 * (1 - (k + 1) / 20);
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) b.add(G.cyl6, M(cx + sx * (w0 + w1) / 2, y0 + H / 32, cz + sz * (w0 + w1) / 2, 0, 0.09, H / 16, 0.09), k % 2 ? 0xc84a3a : MT, K.metal);
      for (const [nx, nz] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) b.add(G.box, M(cx + nx * w0, y0 + H / 32, cz + nz * w0, nz !== 0 ? 0 : Math.PI / 2, w0 * 2, 0.06, 0.06, 0, 0.9), MT, K.metal);
    }
    ctx.col({ t: 'b', x: cx, z: cz, hx: 2.6, hz: 2.6, y1: g + H });
    ctx.bulbs.box(cx, g + H + 0.4, cz, 0.5, 0.5, 0.5, 0xffffff);
    ctx.light({ x: cx, y: g + H + 1, z: cz, color: 0xff3a2a, range: 30, kind: 'lamp' });
    for (const [nx, nz] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) for (let t = -18; t < 18; t += 3) { const along = nz !== 0, px = cx + nx * 18 + (along ? t + 1.5 : 0), pz = cz + nz * 18 + (along ? 0 : t + 1.5), gg = terrainAt(px, pz); if (nz === 1 && Math.abs(t + 1.5) < 4) continue; b.box(px, gg + 1.1, pz, along ? 3 : 0.04, 2.2, along ? 0.04 : 3, 0x8a8f94, 0, K.metal); ctx.col({ t: 'b', x: px, z: pz, hx: along ? 1.5 : 0.1, hz: along ? 0.1 : 1.5, y1: gg + 2.2 }); }
  } else if (p.kind === 'gas') {
    // a canopy on four columns over two islands of pumps
    const cx = p.x - 2, cz = p.z, g = terrainAt(cx, cz);
    b.box(cx, g + 0.06, cz, 22, 0.12, 16, 0x4a4d50, 0, K.stone);
    b.box(cx, g + 5.4, cz, 16, 0.7, 10, 0xe8e6e0, 0, K.metal); b.box(cx, g + 5.4, cz + 5.01, 16, 0.5, 0.02, 0xc8302a, 0, K.plain); b.box(cx, g + 5.4, cz - 5.01, 16, 0.5, 0.02, 0xc8302a, 0, K.plain);
    for (const [sx, sz] of [[-6, -3], [6, -3], [-6, 3], [6, 3]]) { b.box(cx + sx, g + 2.7, cz + sz, 0.5, 5.4, 0.5, 0xd8d8d0, 0, K.metal); ctx.col({ t: 'c', x: cx + sx, z: cz + sz, r: 0.35, y1: g + 5 }); }
    for (const sx of [-3, 3]) { b.box(cx + sx, g + 0.2, cz, 1.2, 0.4, 5, 0x8a8f94, 0, K.stone); for (const sz of [-1.5, 1.5]) { b.box(cx + sx, g + 1.1, cz + sz, 0.7, 1.6, 0.5, 0xc8302a, 0, K.metal); b.box(cx + sx, g + 1.5, cz + sz + 0.26, 0.5, 0.35, 0.02, 0x1a1a1a, 0, K.glass); } ctx.col({ t: 'b', x: cx + sx, z: cz, hx: 0.6, hz: 2.6, y1: g + 2 }); }
    for (let k = 0; k < 6; k++) ctx.bulbs.box(cx - 5 + k * 2, g + 5.03, cz, 0.8, 0.05, 0.3, 0xffffff);
    ctx.light({ x: cx, y: g + 4.8, z: cz, color: 0xf0f4ff, range: 22, kind: 'lamp' });
    b.add(G.cyl8, M(p.x - 14, g + 4, p.z + 9, 0, 0.15, 8, 0.15), 0x55595e, K.metal); b.box(p.x - 14, g + 8.4, p.z + 9, 2.4, 2.6, 0.3, 0xc8302a, 0, K.metal); b.box(p.x - 14, g + 8.2, p.z + 9.16, 2.0, 1.4, 0.02, 0xf0f0e8, 0, K.plain);
    ctx.col({ t: 'c', x: p.x - 14, z: p.z + 9, r: 0.3, y1: g + 8 });
  } else if (p.kind === 'cabin') {
    // a woodpile, a chopping block, an outhouse, a fire ring
    const g = terrainAt(p.x + 6, p.z - 1);
    for (let k = 0; k < 12; k++) b.add(LOG_CYL, M(p.x + 6, g + 0.15 + Math.floor(k / 4) * 0.28, p.z - 2.2 + (k % 4) * 0.3 + (Math.floor(k / 4) % 2) * 0.15, 0, 0.14, 1.4, 0.14, 0, Math.PI / 2), 0x7a5a3a, K.wood);
    b.add(G.cyl8, M(p.x + 4.5, g + 0.3, p.z + 2, 0, 0.35, 0.6, 0.35), 0x6a4a2a, K.wood); ctx.col({ t: 'c', x: p.x + 6, z: p.z - 1.5, r: 0.9, y1: g + 1 });
    const fx = p.x, fz = p.z + 8, fg = terrainAt(fx, fz);
    for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; b.add(G.ico, M(fx + Math.cos(a) * 0.7, fg + 0.1, fz + Math.sin(a) * 0.7, a, 0.18, 0.13, 0.15), 0x8d8478, K.stone); }
    ctx.light({ x: fx, y: fg + 0.6, z: fz, color: 0xff9a50, range: 12, kind: 'fire' });
    const ox = p.x - 8, oz = p.z + 5, og = terrainAt(ox, oz); b.box(ox, og + 1.1, oz, 1.3, 2.2, 1.3, 0x7a5a3a, 0, K.wood); b.box(ox, og + 2.3, oz, 1.6, 0.12, 1.6, 0x4a3a2e, 0, K.wood); ctx.col({ t: 'b', x: ox, z: oz, hx: 0.7, hz: 0.7, y1: og + 2.2 });
  } else if (p.kind === 'camp') {
    // sandbags, a burnt-out truck, a campfire
    const g = terrainAt(p.x, p.z);
    for (let k = 0; k < 24; k++) { const a = k / 24 * TAU, x = p.x + Math.cos(a) * 30, z = p.z + Math.sin(a) * 30; if (k % 6 === 0) continue; b.add(G.box, M(x, terrainAt(x, z) + 0.3, z, a + Math.PI / 2, 2.6, 0.6, 0.7), 0xa89878, K.fabric); ctx.col({ t: 'c', x, z, r: 1.1, y1: terrainAt(x, z) + 0.6 }); }
    const tx = p.x + 10, tz = p.z + 8, tg = terrainAt(tx, tz);
    b.box(tx, tg + 1.0, tz, 2.3, 1.4, 5.5, 0x2a2622, 0.4, K.metal); b.box(tx, tg + 2.1, tz - 1.8, 2.2, 1.0, 1.8, 0x1e1a18, 0.4, K.metal); ctx.col({ t: 'c', x: tx, z: tz, r: 2.2, y1: tg + 2.5 });
    ctx.light({ x: p.x, y: g + 0.6, z: p.z, color: 0xff9a50, range: 14, kind: 'fire' });
    for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; b.add(G.ico, M(p.x + Math.cos(a) * 0.8, g + 0.1, p.z + Math.sin(a) * 0.8, a, 0.2, 0.14, 0.16), 0x5a5550, K.stone); }
  } else if (p.kind === 'windfarm') {
    // tall turbines along the ridge; their blades turn with the wind
    for (let k = 0; k < 7; k++) {
      const a = k * 0.9, x = p.x + Math.cos(a) * (k * 55 + 30), z = p.z + Math.sin(a) * (k * 40 + 20), g = terrainAt(x, z); if (g < waterAt(x, z) + 1) continue;
      const H = 46 + R() * 8;
      b.add(new THREE.CylinderGeometry(1.0, 1.9, 1, 16), M(x, g + H / 2, z, 0, 1, H, 1), 0xeef0f0, K.metal);
      b.box(x, g + H + 0.8, z + 1.2, 2.2, 2.2, 5, 0xe8ecec, 0, K.metal);
      ctx.col({ t: 'c', x, z, r: 2.0, y1: g + H });
      const rb = new Builder(); rb.add(G.sph, M(0, 0, 0, 0, 0.9, 0.9, 1.3), 0xeef0f0, K.metal);
      for (let q = 0; q < 3; q++) { const qa = q / 3 * TAU; rb.add(G.box, M(Math.cos(qa) * 11, Math.sin(qa) * 11, 0, 0, 1.0, 22, 0.25, 0, qa - Math.PI / 2), 0xf4f6f6, K.metal); }
      const rotor = rb.mesh(UBER, QUALITY.shadows); rotor.position.set(x, g + H + 0.8, z + 3.9); scene.add(rotor); ctx.meshes.push(rotor);
      ROTORS.push({ m: rotor, sp: 0.6 + R() * 0.4, owner: ctx.S.id });
      ctx.bulbs.box(x, g + H + 2.0, z + 1.2, 0.3, 0.3, 0.3, 0xffffff);
    }
  } else if (p.kind === 'loggers') {
    // log piles, a sawmill shed, stumps everywhere
    const g = terrainAt(p.x, p.z);
    for (let pile = 0; pile < 4; pile++) {
      const px = p.x - 10 + pile * 7, pz = p.z + 6, pg = terrainAt(px, pz);
      for (let k = 0; k < 10; k++) { const row = k < 4 ? 0 : k < 7 ? 1 : k < 9 ? 2 : 3, inRow = k - [0, 4, 7, 9][row]; b.add(LOG_CYL, M(px + (inRow - (3 - row) / 2) * 0.62 + row * 0.0, pg + 0.3 + row * 0.52, pz, 0, 0.3, 6, 0.3, Math.PI / 2, 0), 0x7a5a3a, K.wood); }
      ctx.col({ t: 'b', x: px, z: pz, hx: 1.4, hz: 3, y1: pg + 2 });
    }
    const sx = p.x + 2, sz = p.z - 8, sg = terrainAt(sx, sz);
    for (const [dx, dz] of [[-5, -3], [5, -3], [-5, 3], [5, 3]]) { b.add(G.cyl8, M(sx + dx, sg + 2, sz + dz, 0, 0.15, 4, 0.15), 0x5a4430, K.wood); ctx.col({ t: 'c', x: sx + dx, z: sz + dz, r: 0.2, y1: sg + 4 }); }
    b.box(sx, sg + 4.2, sz, 11.5, 0.2, 7.5, 0x5a5550, 0, K.metal); b.box(sx, sg + 0.9, sz, 6, 0.3, 1.2, 0x6a6a6a, 0, K.metal); b.add(G.cyl14, M(sx, sg + 1.2, sz, 0, 0.7, 0.04, 0.7, Math.PI / 2), 0xc8ccd0, K.metal);
    ctx.col({ t: 'b', x: sx, z: sz, hx: 3, hz: 0.6, y1: sg + 1.2 });
    for (let k = 0; k < 16; k++) { const a = R() * TAU, d = 20 + R() * 50, x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d; b.add(G.cyl8, M(x, terrainAt(x, z) + 0.25, z, R(), 0.3 + R() * 0.2, 0.5, 0.3 + R() * 0.2), 0x6a4a2a, K.wood); }
    ctx.light({ x: sx, y: sg + 3.8, z: sz, color: 0xffc98a, range: 14, kind: 'lamp' }); ctx.bulbs.box(sx, sg + 4.05, sz, 0.4, 0.1, 0.4, 0xffffff);
    void g;
  }
}
UPDATERS.push((t, dt) => {
  for (let i = ROTORS.length - 1; i >= 0; i--) { const r = ROTORS[i]; if (!r.m.parent) { ROTORS.splice(i, 1); continue; } r.m.rotation.z -= dt * r.sp * (0.4 + WEATHER.wind * 1.4); }
});

/* ── where am I: the nearest town or place, else the land itself ── */
function nearSettlement(x, z, k = 1) { for (const S of SETTLEMENTS) if (Math.hypot(S.x - x, S.z - z) < (S.r + 40) * k) return S; return null; }
const BIOME_SUB = { 0: 'البحر المفتوح', 1: 'شاطئ رملي', 2: 'ساحل الزيتون', 3: 'غابة البلّوط والصنوبر', 4: 'غابة التايغا الباردة', 5: 'قمم الجبال والثلج', 6: 'سهول المزارع', 7: 'صحراء الكثبان', 8: 'المستنقع', 9: 'غابة النخيل الاستوائية', 10: 'الجزر الصخرية', 11: 'مروج الأزهار', 12: 'بحيرة', 13: 'نهر' };
function zoneAt(x, z, y) {
  if (LAND_ON) { const k = landKindAt(x, z); if (k && LAND_NAMES[k]) return { name: LAND_NAMES[k], sub: 'معلم' }; }
  const S = nearSettlement(x, z, 1.1);
  if (S) return { name: S.name, sub: S.kind === 'poi' ? 'معلم' : S.kind === 'city' ? 'المدينة' : S.kind === 'military' ? 'منطقة عسكرية' : 'قرية' };
  const b = biomeAt(x, z), h = terrainAt(x, z);
  if (h < waterAt(x, z) - 0.3) return { name: b === 12 ? 'البحيرة' : b === 13 ? 'النهر' : 'البحر', sub: 'في الماء' };
  { const ri = roadInfo(x, z); if (ri && ri.d < 3 && ri.s.r.name) return { name: ri.s.r.name, sub: BIOME_SUB[b] || '' }; }
  return { name: BIOME_SUB[b] || 'البرّية', sub: toAr(Math.round(Math.max(0, y))) + ' م فوق البحر' };
}
