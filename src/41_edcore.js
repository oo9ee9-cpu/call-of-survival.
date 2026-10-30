/* ═════════ وضع التطوير (1/3): the world editor's things. The owner's scanned buildings, props and people, houses and a villa
   on its own plot, fences and walls, trees and rocks, cars, animals, lakes and the shapes of the land: each one a small record
   that can be built, moved, turned, sized and taken away, solid where it should be. The editor's screen is 42_edui, saving 43 ═════════ */
const ED = {
  on: false, tool: 'sel', brush: 'raise', br: 14, bk: 0.55, erm: 7, vmode: 'tree', vsp: 'mix', paintN: 0,
  objs: [], byId: new Map(), nid: 1, sel: null,
  focus: new THREE.Vector3(),
  zones: [], zgrid: new Map(), er: [],           // ground the editor's things keep clear (of trees 1, rocks 2, grass 4); the eraser's discs
  treeCells: new Map(), rockCells: new Map(),    // the editor's own trees and rocks, by vegetation cell
  pend: null,                                    // land changed and not yet rebuilt around it
  undo: [], redo: [], ver: 0, savedVer: 0,
  back: null, testing: false, loaded: false, src: '',
};
const ED_MIX = new Set();          // the people standing about: their breathing runs in the editor and in the game
const r2 = (v) => Math.round(v * 100) / 100;

/* ── the catalogue: what each thing is (dims are [min, max, default, step]) ── */
const ED_CATS = [['mine', 'نماذجك'], ['upl', 'من جهازك'], ['nature', 'طبيعة'], ['land', 'تضاريس وماء'], ['build', 'بناء'], ['house', 'بيوت'], ['decor', 'أثاث وديكور'], ['veh', 'مركبات'], ['life', 'ناس وحيوانات'], ['items', 'أغراض']];
const EDK = {};
const edk = (key, def) => { EDK[key] = Object.assign({ key, s: 1, sc: [0.3, 3] }, def); };
// the owner's models (Sketchfab, credited in the settings), the same files the game uses
for (const [k, name, s, sc] of [['cathedral', 'الكاتدرائية البيضاء', 1, [0.5, 1.6]], ['fortress', 'قلعة الصخرة', 1, [0.5, 1.6]], ['street', 'شارع ما بعد المطر', 1, [0.6, 1.5]], ['warehouse', 'المستودع المهجور', 1, [0.6, 1.5]],
  ['kingshall', 'القاعة الملكية', 1, [0.6, 1.6]], ['hintze', 'قاعة الحوت', 1, [0.6, 1.4]], ['crag', 'القمة الصخرية', 0.4, [0.15, 1.2]], ['terraces', 'المدرّجات الزراعية', 0.65, [0.3, 1.2]]])
  edk('L_' + k, { cat: 'mine', name, type: 'land', land: k, s, sc, big: true });
edk('V_jeep', { cat: 'mine', name: 'الجيب الميداني UAZ', type: 'veh', veh: 'jeep', paint: [0x4a5a3a, 0x3d4a32, 0x6a6a5a, 0x2e3a2a, 0x8a7a5a] });
edk('T_plane', { cat: 'mine', name: 'شجرة الدُّلب', type: 'tree', sp: 'plane', s: 1, sc: [0.4, 2.2] });
for (const [k, name] of [['casual', 'صاحبة المتجر'], ['blonde', 'بائعة المتجر'], ['hunter', 'صيّاد الليل']]) edk('P_' + k, { cat: 'mine', name, type: 'body', body: k, sc: [0.8, 1.25] });
for (const [k, name, id, prop, ammo] of [['akm', 'بندقية AKM', 'akm', 'w_ak', ['ammo762', 60]], ['p92', 'مسدس P92', 'p92', 'w_9mm', ['ammo9', 45]], ['axe', 'فأس الرونات', 'mw_axe', 'm_axe'], ['knife', 'السكين السوداء', 'mw_knife', 'm_knife'],
  ['jian', 'سيف جيان', 'mw_jian', 'm_jian'], ['ornate', 'السيف المزخرف', 'mw_ornate', 'm_ornate'], ['battleaxe', 'فأس المعركة', 'mw_battleaxe', 'm_battleaxe'], ['bardiche', 'البلطة الطويلة', 'mw_bardiche', 'm_bardiche']])
  edk('W_' + k, { cat: 'mine', name, type: 'pickup', prop, give: ammo ? [[id, 1], ammo] : [[id, 1]], sc: [0.8, 1.6] });
// nature: every tree of the island (the variants are «شكل آخر»), bushes, the scanned rocks
for (const sp of ['oak', 'oak_m', 'ash', 'birch', 'pine', 'spruce', 'cypress', 'willow', 'olive', 'acacia', 'palm', 'dead', 'cactus', 'bush', 'bush2', 'bush3'])
  edk('T_' + sp, { cat: 'nature', name: { oak_m: 'شجرة بلّوط صغيرة', bush2: 'شجيرة مزهرة', bush3: 'شجيرة كثيفة' }[sp] || SP_INFO[sp].ar, type: 'tree', sp, sc: [0.35, 2.4] });
for (const [rk, name, size, sc] of [['boulder', 'صخرة كبيرة', 2.4, [0.3, 5]], ['mossy', 'صخرة مطحلبة', 1.8, [0.3, 4]], ['cliff', 'جرف صخري', 14, [0.3, 3]], ['flat', 'صخرة مسطّحة', 5, [0.3, 3]],
  ['stump', 'جذع قديم', 1.6, [0.5, 2.5]], ['branches', 'أغصان يابسة', 2, [0.5, 2.5]], ['quiver', 'شجرة الرعشة', 2.4, [0.5, 2.5]]])
  edk('R_' + rk, { cat: 'nature', name, type: 'rock', rk, size, sc });
// the land and water: shapes you can move and size, lakes that fill their own basin
for (const [t, name, w, d, h] of [['mount', 'جبل', [60, 1600, 260, 10], null, [8, 420, 110, 4]], ['range', 'سلسلة جبال', [120, 2400, 700, 20], [40, 900, 220, 10], [8, 420, 130, 4]],
  ['hill', 'تلّ', [20, 900, 120, 5], null, [2, 160, 22, 1]], ['mesa', 'هضبة', [30, 900, 160, 5], null, [4, 240, 40, 2]],
  ['crater', 'فوهة', [16, 600, 90, 4], null, [2, 120, 14, 1]], ['valley', 'وادٍ', [40, 1600, 320, 10], [10, 300, 60, 5], [2, 120, 16, 1]], ['bowl', 'حفرة', [6, 400, 30, 2], null, [1, 80, 6, 0.5]]])
  edk('S_' + t, { cat: 'land', name, type: 'shape', shape: t, w, d: d || w, round: !d, h, big: true, sc: null });
edk('Q_lake', { cat: 'land', name: 'بحيرة', type: 'lake', w: [16, 900, 70, 4], h: [1, 40, 5, 0.5], sc: null, big: true });
edk('Q_pond', { cat: 'land', name: 'بركة', type: 'lake', w: [4, 60, 14, 1], h: [0.5, 8, 2.2, 0.25], sc: null });
edk('Q_pool', { cat: 'land', name: 'مسبح دائري', type: 'lake', pool: true, w: [3, 30, 9, 0.5], h: [0.8, 5, 1.8, 0.1], sc: null });
edk('G_plot', { cat: 'land', name: 'قطعة أرض مستوية', type: 'mesh', pre: 'plot', w: [4, 200, 30, 1], d: [4, 200, 24, 1], vars: ['عشب', 'تراب', 'حصى', 'بلاط حجري', 'رمل'], sc: null, quarter: false });
for (const [k, name, w] of [['path_stone', 'ممر حجري', [2, 200, 16, 1]], ['path_dirt', 'طريق ترابي', [2, 400, 30, 2]], ['road', 'طريق إسفلت', [4, 600, 60, 2]]])
  edk('G_' + k, { cat: 'land', name, type: 'mesh', pre: k, world: true, w, d: k === 'road' ? [4, 16, 7, 0.5] : k === 'path_dirt' ? [1.5, 8, 3.2, 0.25] : [1, 6, 2, 0.25], sc: null, nocol: true });
// building: fences and walls along the ground, pens and plots, decks, stairs, towers, bridges…
for (const [k, name, w, h] of [['fence_wood', 'سياج خشبي', [2, 200, 12, 1], null], ['fence_picket', 'سياج أبيض', [2, 120, 10, 1], null], ['fence_metal', 'سياج شبكي', [2, 300, 16, 1], [1.2, 4, 2.2, 0.1]],
  ['wall_stone', 'سور حجري', [2, 300, 12, 1], [0.5, 6, 1.6, 0.1]], ['wall_castle', 'سور قلعة', [4, 400, 20, 1], [3, 14, 6, 0.5]], ['wall_brick', 'جدار مُلبّس', [2, 200, 10, 1], [1, 6, 2.6, 0.1]], ['hedge', 'سياج نباتي', [2, 200, 10, 1], [0.6, 4, 1.4, 0.1]]])
  edk('B_' + k, { cat: 'build', name, type: 'mesh', pre: k, world: true, w, h, sc: null });
edk('B_pen', { cat: 'build', name: 'حظيرة مسيّجة', type: 'mesh', pre: 'pen', world: true, w: [6, 120, 18, 1], d: [6, 120, 14, 1], sc: null });
edk('B_gate', { cat: 'build', name: 'بوابة', type: 'mesh', pre: 'gate', w: [2, 10, 4, 0.5], sc: null, use: 'gate', vars: ['خشب', 'حديد'] });
edk('B_deck', { cat: 'build', name: 'منصة خشبية', type: 'mesh', pre: 'deck', w: [2, 40, 6, 0.5], d: [2, 40, 5, 0.5], h: [0.2, 8, 0.6, 0.1], sc: null, vars: ['بلا سور', 'بسور'] });
edk('B_stairs', { cat: 'build', name: 'درج', type: 'mesh', pre: 'stairs', w: [0.8, 6, 1.4, 0.1], h: [0.4, 12, 2.4, 0.2], sc: null, vars: ['خشب', 'حجر'] });
edk('B_ramp', { cat: 'build', name: 'منحدر', type: 'mesh', pre: 'ramp', w: [2, 16, 4, 0.5], d: [3, 40, 9, 0.5], h: [0.4, 10, 1.8, 0.1], sc: null });
edk('B_bridge', { cat: 'build', name: 'جسر خشبي', type: 'mesh', pre: 'bridge', w: [4, 120, 18, 1], d: [2, 8, 3, 0.25], sc: null, dy: 0.4 });
edk('B_tower', { cat: 'build', name: 'برج مراقبة', type: 'mesh', pre: 'tower', h: [3, 20, 7, 0.5], sc: [0.7, 1.6] });
edk('B_ctower', { cat: 'build', name: 'برج قلعة', type: 'mesh', pre: 'ctower', w: [5, 24, 9, 0.5], h: [5, 40, 14, 0.5], sc: null });
edk('B_tent', { cat: 'build', name: 'خيمة', type: 'mesh', pre: 'tent', sc: [0.6, 2.5], vars: ['زيتية', 'بيضاء', 'حمراء'] });
edk('B_container', { cat: 'build', name: 'حاوية شحن', type: 'mesh', pre: 'container', sc: [0.6, 1.4], vars: ['أحمر', 'أزرق', 'أخضر', 'برتقالي'] });
edk('B_sandbags', { cat: 'build', name: 'أكياس رمل', type: 'mesh', pre: 'sandbags', w: [1, 40, 5, 0.5], sc: null });
edk('B_barrier', { cat: 'build', name: 'حاجز خرساني', type: 'mesh', pre: 'barrier', w: [1, 40, 6, 0.5], sc: null });
edk('B_colbox', { cat: 'build', name: 'صندوق تصادم', type: 'mesh', pre: 'colbox', w: [0.3, 80, 4, 0.1], d: [0.3, 80, 4, 0.1], h: [0.3, 40, 3, 0.1], sc: null, edOnly: true });
edk('B_spawn', { cat: 'build', name: 'نقطة انطلاق اللاعبين', type: 'mesh', pre: 'spawn', sc: null, nocol: true, edOnly: true, one: true });
// houses: the island's own house builder (rooms, stairs, furniture, loot), turned in quarter turns; a villa on its own plot
const ED_STYLES = [['farm', 'ريفي'], ['city', 'مدينة'], ['chalet', 'جبلي'], ['adobe', 'طيني'], ['fisher', 'ساحلي'], ['stilt', 'على أعمدة'], ['hut', 'قشّ'], ['mining', 'معدني'], ['military', 'عسكري'], ['ruin', 'مهجور']];
for (const [k, name, style, kind, w, d, f] of [['farm', 'بيت ريفي', 'farm', 'house', 9, 8, 1], ['city', 'بيت المدينة', 'city', 'house', 10, 9, 2], ['apart', 'عمارة سكنية', 'city', 'apartment', 14, 12, 4],
  ['chalet', 'كوخ جبلي', 'chalet', 'house', 9, 8, 2], ['adobe', 'بيت طيني', 'adobe', 'house', 9, 9, 1], ['fisher', 'بيت الصيّاد', 'fisher', 'house', 8, 7, 1], ['stilt', 'بيت على أعمدة', 'stilt', 'house', 8, 7, 1],
  ['hut', 'كوخ من القش', 'hut', 'house', 6, 6, 1], ['shop', 'متجر صغير', 'city', 'shopfront', 10, 9, 1], ['clinic', 'عيادة', 'city', 'clinic', 12, 10, 1], ['police', 'مركز شرطة', 'city', 'police', 14, 11, 2],
  ['barracks', 'ثكنة', 'military', 'barracks', 14, 8, 1], ['lodge', 'نُزُل', 'chalet', 'lodge', 14, 11, 2], ['barn', 'حظيرة كبيرة', 'farm', 'barn', 14, 10, 1], ['ware', 'مستودع', 'port', 'warehouse', 18, 12, 1],
  ['ruin', 'بيت مهجور', 'ruin', 'house', 10, 9, 2], ['mosque', 'مسجد', 'city', 'mosque', 14, 14, 1], ['clock', 'برج الساعة', 'city', 'clocktower', 6, 6, 1], ['silo', 'صومعة', 'farm', 'silo', 6, 6, 1],
  ['hangar', 'حظيرة طائرات', 'military', 'hangar', 22, 16, 1], ['khan', 'خان', 'adobe', 'caravanserai', 30, 30, 1]])
  edk('H_' + k, { cat: 'house', name, type: 'house', style, kind, w: [5, 40, w, 1], d: [5, 40, d, 1], f: [1, kind === 'apartment' ? 8 : 4, f, 1], sc: null, quarter: true,
    special: ['mosque', 'clocktower', 'silo', 'hangar', 'caravanserai'].includes(kind) });
edk('H_villa', { cat: 'house', name: 'دارة كبيرة مع أرض', type: 'villa', w: [30, 120, 46, 2], d: [26, 120, 36, 2], f: [1, 3, 2, 1], sc: null, quarter: true, vars: ['مع مسبح', 'بلا مسبح'] });
// vehicles, people, animals, things to pick up
for (const k of ['sports', 'sedan', 'taxi', 'police', 'suv', 'pickup', 'van', 'ambulance', 'truck', 'bus', 'tractor', 'buggy', 'bike', 'bicycle', 'boat', 'craftboat', 'raft'])
  edk('V_' + k, { cat: 'veh', name: VSPEC[k].name, type: 'veh', veh: k });
EDK.V_jeep.cat = 'mine';
for (const [k, name] of [['soldier', 'جندي'], ['michelle', 'ميشيل']]) edk('P_' + k, { cat: 'life', name, type: 'body', body: k, sc: [0.8, 1.25], outfits: true });
for (const k of Object.keys(ASPEC)) edk('A_' + k, { cat: 'life', name: ASPEC[k].ar, type: 'animal', an: k, n: [1, 12, ASPEC[k].herd[0] > 2 ? 3 : 1, 1], sc: null });
edk('I_crate', { cat: 'items', name: 'صندوق غنائم', type: 'crate', loot: 'military', sc: null, vars: ['عسكري', 'منزلي', 'طبي', 'مزرعة', 'كنز'] });
edk('I_ammo', { cat: 'items', name: 'صندوق ذخيرة', type: 'pickup', box: 0x3d4f2e, give: [['ammo556', 60], ['ammo9', 45], ['ammo762', 30]], sc: [0.6, 2] });
edk('I_med', { cat: 'items', name: 'حقيبة إسعاف', type: 'pickup', box: 0xc8302a, give: [['medkit', 1], ['bandage', 3]], sc: [0.6, 2] });
edk('I_food', { cat: 'items', name: 'سلّة طعام', type: 'pickup', box: 0xb88a4a, give: [['bread', 3], ['bottle_water', 2]], sc: [0.6, 2] });
// furniture, lights, decoration and farm things: every placeable thing of the game's own building system, in families
function edDecor() {
  const fam = (key, name, ids) => { ids = ids.filter((id) => ITEMS[id] && ITEMS[id].place); if (ids.length) edk('D_' + key, { cat: 'decor', name, type: 'mesh', pre: 'place', ids, vars: ids.length > 1 ? ids.map((id) => ITEMS[id].name) : null }); };
  for (const [fid, fname, , kind] of FURN) fam(fid, fname, kind === 'station' ? ['f_' + fid] : ['oak', 'pine', 'walnut'].map((w) => 'f_' + fid + '_' + w));
  if (ITEMS.f_gunbench) fam('gunbench', ITEMS.f_gunbench.name, ['f_gunbench']);
  for (const [lid, lname] of LIGHTS) fam(lid, lname, ['warm', 'white', 'green', 'blue', 'red'].map((c) => 'l_' + lid + '_' + c));
  for (const id of ['scarecrow', 'planter', 'beehive', 'coop', 'well', 'compost', 'trough', 'fence_farm']) fam(id, ITEMS[id] ? ITEMS[id].name : id, [id]);
  for (const id of Object.keys(ITEMS)) if (id.startsWith('d_') && ITEMS[id].place) fam(id.slice(2), ITEMS[id].name, [id]);
  for (const [pre, name] of [['rug_', 'سجادة'], ['banner_', 'راية'], ['curtain_', 'ستارة'], ['cushion_', 'وسادة']]) fam(pre.slice(0, -1), name, COLORS.map(([cid]) => pre + cid));
  fam('pots', 'أصيص زهور', Object.keys(ITEMS).filter((id) => id.startsWith('pot_')));
}
try { edDecor(); } catch (e) { console.warn('editor decor', e); }

/* ── zones: ground an editor thing keeps clear (1 trees, 2 rocks, 4 grass), in 32 m cells ── */
function zoneGrid(zn, add) {
  const e = zn.t === 'c' ? zn.r : Math.hypot(zn.hx, zn.hz);
  for (let i = Math.floor((zn.x - e) / 32); i <= Math.floor((zn.x + e) / 32); i++) for (let j = Math.floor((zn.z - e) / 32); j <= Math.floor((zn.z + e) / 32); j++) {
    const k = padKey(i, j); let a = ED.zgrid.get(k);
    if (add) { if (!a) ED.zgrid.set(k, a = []); a.push(zn); }
    else if (a) { const q = a.indexOf(zn); if (q >= 0) a.splice(q, 1); if (!a.length) ED.zgrid.delete(k); }
  }
}
function zoneAdd(zn) {
  if (zn.t === 'r') { zn.c = Math.cos(zn.ry || 0); zn.s = Math.sin(zn.ry || 0); }
  ED.zones.push(zn); zoneGrid(zn, true); if (zn.m & 24) ED.paintN++;
  if (zn.m & 4) { const e = zn.t === 'c' ? zn.r : Math.hypot(zn.hx, zn.hz); for (let i = Math.floor((zn.x - e) / 8); i <= Math.floor((zn.x + e) / 8); i++) for (let j = Math.floor((zn.z - e) / 8); j <= Math.floor((zn.z + e) / 8); j++) GBLOCK.add(i * 100000 + j); }
  return zn;
}
function zoneDel(zn) { const i = ED.zones.indexOf(zn); if (i >= 0) { ED.zones.splice(i, 1); if (zn.m & 24) ED.paintN--; } zoneGrid(zn, false); }
// painted grass (8) and flowers (16) where the planting brush went
ED_HOOK.grass = (x, z) => {
  if (!ED.paintN) return 0;
  const a = ED.zgrid.get(padKey(Math.floor(x / 32), Math.floor(z / 32))); if (!a) return 0;
  let m = 0; for (const zn of a) if (zn.m & 24 && (x - zn.x) ** 2 + (z - zn.z) ** 2 < zn.r * zn.r) m |= zn.m & 24;
  return m;
};
function edCleared(x, z, bit) {
  const a = ED.zgrid.get(padKey(Math.floor(x / 32), Math.floor(z / 32))); if (!a) return false;
  for (const zn of a) {
    if (!(zn.m & bit)) continue;
    if (zn.t === 'c') { if ((x - zn.x) ** 2 + (z - zn.z) ** 2 < zn.r * zn.r) return true; }
    else { const dx = x - zn.x, dz = z - zn.z; if (Math.abs(dx * zn.c - dz * zn.s) < zn.hx && Math.abs(dx * zn.s + dz * zn.c) < zn.hz) return true; }
  }
  return false;
}
function edBlocksGrass(x, z) { return ED.zones.length > 0 && edCleared(x, z, 4); }
/* the cells grow what the editor says: natural trees and rocks under its things are left out, its own are put in */
ED_HOOK.veg = (ci, cj, keep) => {
  let out = keep;
  if (ED.zones.length) out = keep.filter((t) => t.planted || !edCleared(t.x, t.z, 1));
  const mine = ED.treeCells.get(vkey(ci, cj)); if (mine) for (const t of mine) { t.col = null; out.push(t); }
  return out;
};
ED_HOOK.rocks = (ci, cj, rocks) => {
  let out = rocks;
  if (ED.zones.length) out = rocks.filter((t) => !edCleared(t.x, t.z, 2));
  const mine = ED.rockCells.get(vkey(ci, cj)); if (mine) for (const t of mine) { t.col = null; out.push(t); }
  return out;
};

/* ── the land changed somewhere: gather the area, rebuild the ground there (soon), and what grows on it (when the hand lifts) ── */
function edTouch(x, z, r, ter, m) {
  const P = ED.pend || (ED.pend = { x0: 1e9, z0: 1e9, x1: -1e9, z1: -1e9, sx0: 1e9, sz0: 1e9, sx1: -1e9, sz1: -1e9, ter: false, m: 0, t: 0 });
  P.x0 = Math.min(P.x0, x - r); P.z0 = Math.min(P.z0, z - r); P.x1 = Math.max(P.x1, x + r); P.z1 = Math.max(P.z1, z + r);
  // (the ground is rebuilt as you go, only where it changed since the last time)
  if (ter) { P.ter = true; P.sx0 = Math.min(P.sx0, x - r); P.sz0 = Math.min(P.sz0, z - r); P.sx1 = Math.max(P.sx1, x + r); P.sz1 = Math.max(P.sz1, z + r); }
  P.m |= m || 0; P.t = performance.now();
}
function edFlush(deep) {
  const P = ED.pend; if (!P) return;
  if (P.sx0 < 1e9) { TERRAIN.dirtyArea((P.sx0 + P.sx1) / 2, (P.sz0 + P.sz1) / 2, Math.max(P.sx1 - P.sx0, P.sz1 - P.sz0) / 2); P.sx0 = P.sz0 = 1e9; P.sx1 = P.sz1 = -1e9; }
  if (!deep) return;
  ED.pend = null;
  const cx = (P.x0 + P.x1) / 2, cz = (P.z0 + P.z1) / 2, r = Math.max(P.x1 - P.x0, P.z1 - P.z0) / 2;
  if (P.ter) edRoads(cx, cz, r);
  edRegen(cx, cz, r + 2, P.m | (P.ter ? 7 : 0));
  if (P.ter) edReground(P.x0, P.z0, P.x1, P.z1);
}
function edRegen(x, z, r, m) {
  const i0 = Math.floor((x - r) / VCELL), i1 = Math.floor((x + r) / VCELL), j0 = Math.floor((z - r) / VCELL), j1 = Math.floor((z + r) / VCELL);
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
    const k = vkey(i, j);
    if (m & 1) { const c = VCELLS.get(k); if (c) { if (c.colliders) for (const col of c.colliders) removeCollider(col); VCELLS.delete(k); } }
    if (m & 2) { const c = RCELLS.get(k); if (c) { if (c.colliders) for (const col of c.colliders) removeCollider(col); RCELLS.delete(k); } }
  }
  if (m & 1) vegDirty();
  if (m & 2) rocksDirty();
  if (m & 4) grassDirtyArea(x, z, r);
}
function edRoads(x, z, r) {
  for (const R of ROADS) for (const run of R.runs) if (run.built && Math.hypot(run.cx - x, run.cz - z) < run.rad + r) dropRun(run);
  roadLodT = 0;
}
// things standing on ground that moved under them stand on the new ground
function edReground(x0, z0, x1, z1) {
  for (const o of ED.objs) {
    if (o.x < x0 || o.x > x1 || o.z < z0 || o.z > z1 || !o.v) continue;
    const t = EDK[o.k].type; if (t === 'land' || t === 'shape' || t === 'lake' || t === 'house' || t === 'villa' || o.v.pads.length) continue;   // (a thing with its own pad is the ground)
    const g = edGround(o.x, o.z); if (Math.abs(g + o.dy - o.y) > 0.04 || EDK[o.k].world) edRebuild(o);
  }
}

/* ── where things stand: the land, a scanned landform's top, a floor or a deck below ── */
function edGround(x, z) {
  let h = terrainAt(x, z);
  if (LAND_ON) { const v = landTop(x, z); if (v > h) h = v; }
  const a = PGRID.at(x, z);
  if (a) for (let i = 0; i < a.length; i++) { const v = platY(a[i], x, z, 1e4); if (v > h) h = v; }
  return h;
}
const edW = (o, lx, lz) => { const c = Math.cos(o.ry), s = Math.sin(o.ry); return [o.x + lx * c + lz * s, o.z - lx * s + lz * c]; };

/* ── records ── */
function edNew(k, x, z, extra) {
  const d = EDK[k]; if (!d) return null;
  const o = { id: ED.nid++, k, x: r2(x), z: r2(z), y: 0, dy: d.dy || 0, ry: 0, s: d.s || 1, c: d.c0 || 0, col: d.nocol ? 0 : d.col0 || 1 };
  for (const p of ['w', 'd', 'h', 'f', 'n']) if (d[p]) o[p] = d[p][2];
  if (d.type === 'umodel') { o.pad = d.pad0 || 0; o.up = 0; }
  if (extra) Object.assign(o, extra);
  return o;
}
function edBuild(o) {
  const d = EDK[o.k]; if (!d) return;
  o.v = { cols: [], plats: [], pads: [], shapes: [], zones: [], anchors: [], meshes: [], tok: {}, sph: null, pick: null };
  try { ED_T[d.type].make(o, d); } catch (e) { console.warn('editor: make', o.k, e); }
  edTag(o);
}
function edFree(o) {
  const v = o.v; if (!v) return;
  const d = EDK[o.k];
  try { if (ED_T[d.type].free) ED_T[d.type].free(o, d); } catch (e) { console.warn('editor: free', o.k, e); }
  for (const c of v.cols) removeCollider(c);
  for (const p of v.plats) removePlatform(p);
  for (const p of v.pads) { removePad(p); edTouch(p.x, p.z, Math.hypot(p.hx, p.hz) + p.m, true, 7); }
  for (const s of v.shapes) { removeShape(s); edTouch(s.x, s.z, Math.max(s.w, s.d) / 2 + 3, true, 7); }
  for (const zn of v.zones) { zoneDel(zn); edTouch(zn.x, zn.z, zn.t === 'c' ? zn.r : Math.hypot(zn.hx, zn.hz), false, zn.m); }
  for (const a of v.anchors) { const i = LIGHT_ANCHORS.indexOf(a); if (i >= 0) LIGHT_ANCHORS.splice(i, 1); }
  for (const m of v.meshes) edDrop(m);
  if (v.root) edDrop(v.root);
  o.v = null;
}
function edDrop(m) {
  if (m.parent) m.parent.remove(m);
  m.traverse((q) => { if (q.isMesh && q.userData.own && q.geometry) q.geometry.dispose(); });
}
function edRebuild(o) { edFree(o); edBuild(o); }
function edAdd(o) { ED.objs.push(o); ED.byId.set(o.id, o); ED.nid = Math.max(ED.nid, o.id + 1); edBuild(o); return o; }
function edRemove(o) { edFree(o); const i = ED.objs.indexOf(o); if (i >= 0) ED.objs.splice(i, 1); ED.byId.delete(o.id); if (ED.sel === o) ED.sel = null; }
// the plain record (what is saved, undone, copied)
function edSnap(o) {
  const s = { id: o.id, k: o.k, x: r2(o.x), z: r2(o.z), y: r2(o.y), dy: r2(o.dy), ry: Math.round(o.ry * 1000) / 1000, s: +(+o.s).toPrecision(4), c: o.c, col: o.col };
  for (const p of ['w', 'd', 'h', 'f', 'n', 'st', 'open', 'pad', 'up']) if (o[p] !== undefined) s[p] = typeof o[p] === 'number' ? r2(o[p]) : o[p];
  return s;
}
function edLoadRec(s) { const o = Object.assign({}, s); o.v = null; return o; }

/* ── meshes from builders ── */
function edBuilders() { return { b: new Builder(), gb: new Builder(), lb: new Builder(), fb: new Builder(), ib: new Builder(), cols: [], plats: [], lights: [], zones: [], ghost: null }; }
function edMeshes(B, root, shadows = true) {
  const out = [];
  for (const [bb, mat, sh, ro] of [[B.b, UBER, shadows, 0], [B.ib, UBER_IN, shadows, 0], [B.gb, GLASS_MAT, false, 3], [B.lb, BULB_MAT, false, 0], [B.fb, FIRE_MAT, false, 4]]) {
    if (bb.empty) continue;
    const m = bb.mesh(mat, sh && QUALITY.shadows); m.userData.own = true; if (ro) m.renderOrder = ro; root.add(m); out.push(m);
  }
  if (B.ghost) { B.ghost.userData.ghost = true; root.add(B.ghost); }
  return out;
}
const ED_GHOST_MAT = new THREE.MeshBasicMaterial({ color: C(0xffb53d), transparent: true, opacity: 0.22, depthWrite: false });
const ED_GHOST_EDGE = new THREE.LineBasicMaterial({ color: C(0xffd76a), transparent: true, opacity: 0.9 });
const ED_WATER_MAT = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, fog: false, uniforms: lakeMat.uniforms,
  vertexShader: 'attribute float aDepth; varying vec3 vW; varying float vDepth; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vDepth = aDepth; gl_Position = projectionMatrix * viewMatrix * w; }',
  fragmentShader: `${WATER_COMMON} varying vec3 vW; varying float vDepth;
    void main(){
      float t = uTime; vec2 p = vW.xz; float depth = vDepth;
      if (depth < -0.03) discard;
      float dist = length(cameraPosition - vW); float fade = 1.0 - smoothstep(30.0, 300.0, dist);
      vec2 rip = ripples(p, t, fade, vec2(0.0)) * 0.7;
      vec3 n = normalize(vec3(rip.x, 1.0, rip.y));
      float foam = clamp((1.0 - smoothstep(0.0, 0.7, depth)) * 0.35, 0.0, 1.0);
      float a; vec3 col = shade(vW, n, max(depth, 0.0), foam, 0.62, a);
      gl_FragColor = vec4(col, a);
      #include <tonemapping_fragment>
      #include <encodings_fragment>
    }`,
});

/* ── the prefab shapes: built in their own frame (front +z) or, for runs along the ground, in the world ── */
const ED_PRE = {};
function edBox(b, x, y, z, sx, sy, sz, col, k, ry = 0, rx = 0, rz = 0) { b.add(G.box, M(x, y, z, ry, sx, sy, sz, rx, rz), col, k); }
// a straight run between two points of the thing's own frame, with posts that stand on the ground
function edRun(o, ax, az, bx, bz, step, fn) {
  const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / step)), pts = [];
  for (let k = 0; k <= n; k++) { const t = k / n, [x, z] = edW(o, lerp(ax, bx, t), lerp(az, bz, t)); pts.push([x, terrainAt(x, z), z, t]); }
  const dx = pts[n][0] - pts[0][0], dz = pts[n][2] - pts[0][2], yaw = Math.atan2(-dz, dx);
  for (let k = 0; k < n; k++) fn(pts[k], pts[k + 1], yaw, L / n, k, n);
  return pts;
}
// a box between two ground points, tilted with the slope
function edSpan(b, p, q, yaw, len, y0, sy, sz, col, k) {
  const tilt = Math.atan2(q[1] - p[1], len), cx = (p[0] + q[0]) / 2, cz = (p[2] + q[2]) / 2, cy = (p[1] + q[1]) / 2 + y0;
  b.add(G.box, M(cx, cy, cz, yaw, Math.hypot(len, q[1] - p[1]) + 0.02, sy, sz, 0, tilt), col, k);
}
function edRunCol(B, p, q, yaw, len, hz, h, y0 = -0.4) { B.cols.push({ x: (p[0] + q[0]) / 2, z: (p[2] + q[2]) / 2, hx: len / 2, hz, ry: yaw, y0: Math.min(p[1], q[1]) + y0, y1: Math.max(p[1], q[1]) + h }); }
ED_PRE.fence_wood = (o, B) => {
  edRun(o, -o.w / 2, 0, o.w / 2, 0, 2.4, (p, q, yaw, len, k) => {
    const post = 0x5a4430, rail = 0x8a6a45;
    for (const r of k === 0 ? [p, q] : [q]) B.b.add(G.box, M(r[0], r[1] + 0.55, r[2], yaw, 0.14, 1.3, 0.14), post, K.wood);
    for (const hy of [0.45, 0.95]) edSpan(B.b, p, q, yaw, len, hy, 0.1, 0.06, rail, K.wood);
    edRunCol(B, p, q, yaw, len, 0.1, 1.15);
  });
};
ED_PRE.fence_picket = (o, B) => {
  edRun(o, -o.w / 2, 0, o.w / 2, 0, 2, (p, q, yaw, len) => {
    const W = 0xeeeae2;
    for (const r of [p, q]) B.b.add(G.box, M(r[0], r[1] + 0.5, r[2], yaw, 0.1, 1.1, 0.1), W, K.wood);
    for (const hy of [0.32, 0.72]) edSpan(B.b, p, q, yaw, len, hy, 0.08, 0.04, W, K.wood);
    const n = Math.max(2, Math.round(len / 0.16)), dx = (q[0] - p[0]) / n, dz = (q[2] - p[2]) / n;
    for (let i = 0; i < n; i++) { const x = p[0] + dx * (i + 0.5), z = p[2] + dz * (i + 0.5), y = lerp(p[1], q[1], (i + 0.5) / n); B.b.add(G.box, M(x, y + 0.48, z, yaw, 0.08, 0.95, 0.025), W, K.wood); B.b.add(G.cone5, M(x, y + 1.0, z, yaw + Math.PI / 4, 0.06, 0.1, 0.03), W, K.wood); }
    edRunCol(B, p, q, yaw, len, 0.08, 1.05);
  });
};
ED_PRE.fence_metal = (o, B) => {
  const H = o.h || 2.2;
  edRun(o, -o.w / 2, 0, o.w / 2, 0, 3, (p, q, yaw, len, k) => {
    for (const r of k === 0 ? [p, q] : [q]) B.b.add(G.cyl8, M(r[0], r[1] + H / 2, r[2], 0, 0.05, H + 0.1, 0.05), 0x55595e, K.metal);
    edSpan(B.b, p, q, yaw, len, H / 2, H, 0.03, 0x8a8f94, K.metal);
    edSpan(B.b, p, q, yaw, len, H, 0.05, 0.05, 0x55595e, K.metal);
    edRunCol(B, p, q, yaw, len, 0.1, H);
  });
};
function edWallRun(o, B, H, T, col, k, top, walk) {
  edRun(o, -o.w / 2, 0, o.w / 2, 0, 2, (p, q, yaw, len, i) => {
    const lo = Math.min(p[1], q[1]) - 0.5, hi = Math.max(p[1], q[1]) + H, cx = (p[0] + q[0]) / 2, cz = (p[2] + q[2]) / 2;
    B.b.add(G.box, M(cx, (lo + hi) / 2, cz, yaw, len + 0.04, hi - lo, T), shadeC(col, 0.94 + hash(i * 3.1, o.id) * 0.12), k);
    if (top) top(cx, hi, cz, yaw, len, i);
    edRunCol(B, p, q, yaw, len, T / 2, walk ? H - 0.65 : H);
  });
}
ED_PRE.wall_stone = (o, B) => edWallRun(o, B, o.h, 0.6, 0x9a948a, K.stone, (x, y, z, yaw, len) => B.b.add(G.box, M(x, y + 0.06, z, yaw, len + 0.06, 0.12, 0.7), 0x8a847a, K.stone));
ED_PRE.wall_brick = (o, B) => edWallRun(o, B, o.h, 0.3, [0xe8dcc6, 0xd8c8b0, 0xc8b8a0, 0xa85a3e][o.c % 4], K.plaster, (x, y, z, yaw, len) => B.b.add(G.box, M(x, y + 0.05, z, yaw, len + 0.04, 0.1, 0.38), 0xb8b0a4, K.stone));
ED_PRE.wall_castle = (o, B) => edWallRun(o, B, o.h, 1.6, 0xa8a090, K.stone, (x, y, z, yaw, len, i) => {
  B.plats.push({ wx: x, wz: z, hx: len / 2 + 0.02, hz: 0.7, ry: yaw, wy: y });
  for (const s of [-1, 1]) for (const u of [-0.5, 0.5]) { const ox = Math.cos(yaw) * u * len / 2, oz = -Math.sin(yaw) * u * len / 2, nx = Math.sin(yaw) * 0.68 * s, nz = Math.cos(yaw) * 0.68 * s;
    if (((i + (u > 0 ? 1 : 0)) & 1) === 0) B.b.add(G.box, M(x + ox + nx, y + 0.45, z + oz + nz, yaw, len * 0.42, 0.9, 0.3), 0x9a9282, K.stone); }
}, true);
ED_PRE.hedge = (o, B) => edWallRun(o, B, o.h, 0.9, 0x3f6a32, K.fabric, (x, y, z, yaw, len, i) => B.b.add(G.ico1, M(x, y - 0.1, z, yaw + i, len * 0.62, 0.45, 0.62), 0x4a7a3a, K.fabric));
ED_PRE.pen = (o, B) => {
  const hw = o.w / 2, hd = o.d / 2, sides = [[-hw, hd, hw, hd, true], [hw, hd, hw, -hd], [hw, -hd, -hw, -hd], [-hw, -hd, -hw, hd]];
  for (const [ax, az, bx, bz, front] of sides) {
    const sub = Object.assign({}, o);
    const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 2.4));
    edRun(sub, ax, az, bx, bz, 2.4, (p, q, yaw, len, k) => {
      const mid = (k + 0.5) / n - 0.5;
      if (front && Math.abs(mid * L) < 1.7) return;            // the gate's opening, in the middle of the front
      for (const r of [p, q]) B.b.add(G.box, M(r[0], r[1] + 0.55, r[2], yaw, 0.14, 1.3, 0.14), 0x5a4430, K.wood);
      for (const hy of [0.45, 0.95]) edSpan(B.b, p, q, yaw, len, hy, 0.1, 0.06, 0x8a6a45, K.wood);
      edRunCol(B, p, q, yaw, len, 0.1, 1.15);
    });
  }
};
function edStrip(o, B, col, k, wide, y0 = 0.035, edge) {
  edRun(o, -o.w / 2, 0, o.w / 2, 0, 1.5, (p, q, yaw, len, i) => {
    edSpan(B.b, p, q, yaw, len, y0, 0.07, wide, shadeC(col, 0.95 + hash(i, o.id) * 0.1), k);
    if (edge) for (const s of [-1, 1]) { const nx = Math.sin(yaw) * (wide / 2 + 0.08) * s, nz = Math.cos(yaw) * (wide / 2 + 0.08) * s; edSpan(B.b, [p[0] + nx, p[1], p[2] + nz], [q[0] + nx, q[1], q[2] + nz], yaw, len, y0 + 0.04, 0.12, 0.16, edge, K.stone); }
  });
  const [x0, z0] = edW(o, -o.w / 2, 0), [x1, z1] = edW(o, o.w / 2, 0);
  B.zones.push({ t: 'r', x: (x0 + x1) / 2, z: (z0 + z1) / 2, hx: o.w / 2 + 0.5, hz: wide / 2 + 0.3, ry: o.ry, m: 7 });
}
ED_PRE.path_stone = (o, B) => edStrip(o, B, 0xb8b0a2, K.stone, o.d, 0.035, 0x8a847a);
ED_PRE.path_dirt = (o, B) => edStrip(o, B, 0x8a6e4e, K.plaster, o.d, 0.025);
ED_PRE.road = (o, B) => {
  edStrip(o, B, 0x3a3c3e, K.plain, o.d, 0.04, 0x9a968e);
  edRun(o, -o.w / 2, 0, o.w / 2, 0, 3, (p, q, yaw, len, i) => { if (i % 2 === 0) edSpan(B.b, p, q, yaw, len * 0.55, 0.085, 0.02, 0.16, 0xe8e0c8, K.plain); });
};
// the rest stand in their own frame (x across, z front to back, y up, metres); o.s scales them
ED_PRE.plot = (o, B) => {
  const surf = [null, [0x7a5e40, K.plaster], [0x9a948a, K.stone], [0xb8b0a2, K.stone], [0xd8c49a, K.plaster]][o.c % 5];
  if (surf) { B.b.add(G.box, M(0, 0.02, 0, 0, o.w, 0.06, o.d), surf[0], surf[1]); B.zones.push({ x: 0, z: 0, hx: o.w / 2, hz: o.d / 2, m: 7 }); } else B.zones.push({ x: 0, z: 0, hx: o.w / 2, hz: o.d / 2, m: 3 });
  for (const [x, z, sx, sz] of [[0, o.d / 2, o.w + 0.3, 0.3], [0, -o.d / 2, o.w + 0.3, 0.3], [o.w / 2, 0, 0.3, o.d], [-o.w / 2, 0, 0.3, o.d]]) B.b.add(G.box, M(x, 0.05, z, 0, sx, 0.14, sz), 0x8a847a, K.stone);
  B.pad = { hx: o.w / 2 + 0.4, hz: o.d / 2 + 0.4, m: 6 };
};
ED_PRE.gate = (o, B) => {
  const W = o.w, metal = o.c % 2 === 1, open = !!o.open, col = metal ? 0x2c3135 : 0x7a5a3a, k = metal ? K.metal : K.wood;
  for (const s of [-1, 1]) { B.b.add(G.box, M(s * (W / 2 + 0.3), 1.15, 0, 0, 0.55, 2.3, 0.55), 0x9a948a, K.stone); B.b.add(G.box, M(s * (W / 2 + 0.3), 2.36, 0, 0, 0.65, 0.12, 0.65), 0x8a847a, K.stone); B.cols.push({ x: s * (W / 2 + 0.3), z: 0, hx: 0.3, hz: 0.3, y0: -0.5, y1: 2.4 }); }
  // two leaves hinged at the pillars; open, they swing to the back
  for (const s of [-1, 1]) {
    const ph = open ? 1.4 : 0, dx = -s * Math.cos(ph), dz = -Math.sin(ph), yaw = Math.atan2(-dz, dx), hx = s * W / 2, L = W / 2 - 0.05;
    for (const hy of [0.25, 0.85, 1.5]) B.b.add(G.box, M(hx + dx * L / 2, hy, dz * L / 2, yaw, L, 0.1, 0.06), col, k);
    for (let q = 1; q <= 5; q++) { const u = q / 5 * L; B.b.add(G.box, M(hx + dx * u, 0.88, dz * u, yaw, 0.06, 1.36, 0.05), col, k); }
  }
  if (!open) B.cols.push({ x: 0, z: 0, hx: W / 2, hz: 0.12, y0: -0.5, y1: 1.8, gate: true });
};
ED_PRE.deck = (o, B) => {
  const { w, d, h } = o, top = h;
  for (let x = -w / 2 + 0.15; x <= w / 2 - 0.1; x += Math.max(1.6, (w - 0.3) / Math.max(1, Math.round((w - 0.3) / 2.4)))) for (let z = -d / 2 + 0.15; z <= d / 2 - 0.1; z += Math.max(1.6, (d - 0.3) / Math.max(1, Math.round((d - 0.3) / 2.4))))
    B.b.add(G.box, M(x, (top - 1.5) / 2, z, 0, 0.18, top + 1.5, 0.18), 0x5a4430, K.wood);
  const n = Math.max(2, Math.round(w / 0.3));
  for (let i = 0; i < n; i++) B.b.add(G.box, M(-w / 2 + (i + 0.5) * w / n, top - 0.06, 0, 0, w / n - 0.02, 0.1, d), shadeC(0x9a7650, 0.92 + hash(i, o.id) * 0.14), K.wood);
  B.plats.push({ x: 0, z: 0, hx: w / 2, hz: d / 2, y: top });
  if (o.c % 2 === 1) for (const [x, z, sx, sz, ax] of [[0, d / 2, w, 0.06, 1], [0, -d / 2, w, 0.06, 1], [w / 2, 0, 0.06, d, 0], [-w / 2, 0, 0.06, d, 0]]) {
    B.b.add(G.box, M(x, top + 0.95, z, 0, sx + 0.06, 0.08, sz + 0.06), 0x6b4a2f, K.wood);
    const L = ax ? sx : sz, m = Math.max(1, Math.round(L / 1.2));
    for (let i = 0; i <= m; i++) { const u = -L / 2 + i * L / m; B.b.add(G.box, M(ax ? u : x, top + 0.48, ax ? z : u, 0, 0.07, 0.95, 0.07), 0x6b4a2f, K.wood); }
    B.cols.push({ x, z, hx: sx / 2 + 0.03, hz: sz / 2 + 0.03, y0: top - 0.3, y1: top + 1.1 });
  }
  if (top > 0.5) B.cols.push({ x: 0, z: 0, hx: w / 2, hz: d / 2, y0: -2, y1: top - 0.62 });
  B.zones.push({ x: 0, z: 0, hx: w / 2, hz: d / 2, m: 4 });
};
ED_PRE.stairs = (o, B) => {
  const W = o.w, H = o.h, n = Math.max(2, Math.round(H / 0.2)), run = H / n * 1.35, L = run * n, stone = o.c % 2 === 1;
  const col = stone ? 0xb8b0a2 : 0x8a6a4a, k = stone ? K.stone : K.wood;
  // the bottom step at the front (+z), climbing towards the back
  for (let i = 0; i < n; i++) { const z = L / 2 - (i + 0.5) * run, top = (i + 1) * H / n; B.b.add(G.box, M(0, stone ? top / 2 : top - 0.05, z, 0, W, stone ? top : 0.1, run + 0.02), shadeC(col, i % 2 ? 1 : 0.92), k); }
  if (!stone) for (const s of [-1, 1]) B.b.add(G.box, M(s * (W / 2 + 0.04), H / 2, 0, 0, 0.08, 0.3, Math.hypot(L, H), Math.atan2(H, L), 0), 0x5a4430, K.wood);
  B.plats.push({ t: 'oramp', x: 0, z: 0, hx: W / 2, hz: L / 2, ya: H, yb: 0 });
  B.zones.push({ x: 0, z: 0, hx: W / 2, hz: L / 2, m: 4 });
};
ED_PRE.ramp = (o, B) => {
  const { w, d, h } = o, a = Math.atan2(h, d), len = Math.hypot(d, h);
  B.b.add(G.box, M(0, h / 2 - 0.15 * Math.cos(a), 0, 0, w, 0.3, len, a), 0x9a968e, K.stone);
  for (let i = 0; i < 6; i++) { const t = (i + 0.5) / 6, z = d / 2 - t * d, top = t * h; B.b.add(G.box, M(0, top / 2 - 0.1, z, 0, w - 0.1, top, d / 6), 0x8a8680, K.stone); }
  B.plats.push({ t: 'oramp', x: 0, z: 0, hx: w / 2, hz: d / 2, ya: h, yb: 0 });
  B.cols.push({ x: 0, z: -d / 2 + 0.2, hx: w / 2, hz: 0.25, y0: -1, y1: h - 0.62 });
};
ED_PRE.bridge = (o, B) => {
  const L = o.w, W = o.d, n = Math.max(2, Math.round(L / 0.35));
  for (let i = 0; i < n; i++) B.b.add(G.box, M(-L / 2 + (i + 0.5) * L / n, -0.06, 0, 0, L / n - 0.03, 0.12, W), shadeC(0x8a6a45, 0.9 + hash(i, o.id) * 0.16), K.wood);
  for (const s of [-1, 1]) { B.b.add(G.box, M(0, -0.22, s * (W / 2 - 0.2), 0, L, 0.2, 0.2), 0x5a4430, K.wood); B.b.add(G.box, M(0, 1.0, s * W / 2, 0, L, 0.08, 0.1), 0x6b4a2f, K.wood); }
  const m = Math.max(2, Math.round(L / 2));
  for (let i = 0; i <= m; i++) { const x = -L / 2 + i * L / m; for (const s of [-1, 1]) { B.b.add(G.box, M(x, 0.5, s * W / 2, 0, 0.1, 1.0, 0.1), 0x6b4a2f, K.wood); if (i % 2 === 0) B.b.add(G.box, M(x, -4.2, s * (W / 2 - 0.2), 0, 0.24, 8.2, 0.24), 0x4a3828, K.wood); } }
  B.plats.push({ x: 0, z: 0, hx: L / 2, hz: W / 2, y: 0 });
  for (const s of [-1, 1]) B.cols.push({ x: 0, z: s * W / 2, hx: L / 2, hz: 0.08, y0: -0.3, y1: 1.1 });
};
ED_PRE.tower = (o, B) => {
  const H = o.h, R = 1.7, P = 2.4;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    B.b.add(G.box, M(sx * R, H / 2 - 0.4, sz * R, 0, 0.3, H + 0.8, 0.3, sz * 0.03, -sx * 0.03), 0x5a4430, K.wood);
    B.cols.push({ x: sx * R, z: sz * R, hx: 0.2, hz: 0.2, y0: -1, y1: H });
  }
  for (let y = 1.6; y < H - 0.5; y += 2.2) for (const [x, z, sx, sz] of [[0, -R, 2 * R, 0.12], [0, R, 2 * R, 0.12], [-R, 0, 0.12, 2 * R], [R, 0, 0.12, 2 * R]]) B.b.add(G.box, M(x, y, z, 0, sx, 0.12, sz), 0x6b4a2f, K.wood);
  B.b.add(G.box, M(0, H - 0.06, 0, 0, P * 2, 0.14, P * 2), 0x8a6a45, K.wood); B.plats.push({ x: 0, z: 0, hx: P, hz: P, y: H });
  for (const [x, z, sx, sz] of [[0, -P, 2 * P, 0.08], [-P, 0, 0.08, 2 * P], [P, 0, 0.08, 2 * P], [-P * 0.6, P, P * 0.8, 0.08], [P * 0.6, P, P * 0.8, 0.08]]) { B.b.add(G.box, M(x, H + 1.0, z, 0, sx, 0.08, sz), 0x6b4a2f, K.wood); B.cols.push({ x, z, hx: sx / 2 + 0.04, hz: sz / 2 + 0.04, y0: H - 0.3, y1: H + 1.2 }); }
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.b.add(G.box, M(sx * P, H + 1.3, sz * P, 0, 0.12, 2.6, 0.12), 0x5a4430, K.wood);
  B.b.add(G.cone5, M(0, H + 3.1, 0, Math.PI / 4, P * 1.75, 1.4, P * 1.75), 0x6a4a32, K.wood);
  // a steep stair up the front to the gap in the rail
  const run = H * 0.8, sn = Math.max(4, Math.round(H / 0.25));
  for (let i = 0; i < sn; i++) { const t = (i + 0.5) / sn; B.b.add(G.box, M(0, H * (i + 1) / sn - 0.04, P + run - t * run, 0, 1.0, 0.08, run / sn + 0.03), 0x8a6a4a, K.wood); }
  for (const s of [-1, 1]) B.b.add(G.box, M(s * 0.55, H / 2, P + run / 2, 0, 0.08, 0.25, Math.hypot(run, H), Math.atan2(H, run), 0), 0x5a4430, K.wood);
  B.plats.push({ t: 'oramp', x: 0, z: P + run / 2, hx: 0.55, hz: run / 2, ya: H, yb: 0 });
  B.lights.push({ x: 0, y: H + 2.3, z: 0, color: 0xffc070, range: 12, kind: 'lamp' }); B.lb.add(G.box, M(0, H + 2.4, 0, 0, 0.22, 0.28, 0.22), 0xffffff, K.plain);
};
ED_PRE.ctower = (o, B) => {
  const R = o.w / 2, H = o.h, segs = 14;
  B.b.add(G.cyl14, M(0, H / 2 - 1, 0, 0, R, H + 2, R), 0xa8a090, K.stone);
  B.b.add(G.cyl14, M(0, H + 0.1, 0, 0, R + 0.35, 0.3, R + 0.35), 0x9a9282, K.stone);
  for (let i = 0; i < segs; i++) if (i % 2 === 0) { const a = i / segs * TAU; B.b.add(G.box, M(Math.sin(a) * (R + 0.1), H + 0.85, Math.cos(a) * (R + 0.1), a, R * TAU / segs * 0.9, 1.2, 0.5), 0x9a9282, K.stone); }
  for (let k = 0; k < Math.floor(H / 3.5); k++) { const a = k * 2.1; B.gb.add(G.box, M(Math.sin(a) * R, 2.5 + k * 3.5, Math.cos(a) * R, a, 0.35, 1.0, 0.1), 0x111418, K.glass); }
  B.cols.push({ x: 0, z: 0, hx: R * 0.86, hz: R * 0.86, y0: -2, y1: H - 0.62 });
  B.plats.push({ x: 0, z: 0, hx: R * 0.8, hz: R * 0.8, y: H + 0.25 });
};
ED_PRE.tent = (o, B) => {
  const col = [0x5a6a3e, 0xe8e2d4, 0xa83a2e][o.c % 3];
  B.b.add(G.cyl3, M(0, 0.6, 0, 0, 1.62, 3.2, 1.2, -Math.PI / 2, 0), col, K.fabric);              // a prism of canvas, its ridge along z
  B.b.add(G.cyl3, M(0, 0.45, 1.61, 0, 0.7, 0.02, 0.9, -Math.PI / 2, 0), shadeC(col, 0.35), K.fabric);   // the dark opening
  for (const z of [-1.62, 1.62]) B.b.add(G.cyl8, M(0, 0.9, z, 0, 0.03, 1.8, 0.03), 0x4a3828, K.wood);
  B.b.add(G.cyl8, M(0, 1.82, 0, 0, 0.03, 3.4, 0.03, Math.PI / 2), 0x4a3828, K.wood);
  for (const [x, z] of [[-1.5, 1.9], [1.5, 1.9], [-1.5, -1.9], [1.5, -1.9]]) B.b.add(G.cyl8, M(x, 0.1, z, 0, 0.03, 0.25, 0.03), 0x4a3828, K.wood);
  B.cols.push({ x: 0, z: 0, hx: 1.25, hz: 1.6, y0: -0.3, y1: 1.6 });
  B.zones.push({ x: 0, z: 0, hx: 1.3, hz: 1.8, m: 4 });
};
ED_PRE.container = (o, B) => {
  const col = [0xa8302a, 0x2f5d8a, 0x3f6a3a, 0xd8702a][o.c % 4], L = 6.1, W = 2.44, H = 2.6;
  B.b.add(G.box, M(0, H / 2, 0, 0, W, H, L), col, K.metal);
  for (let i = 0; i <= 20; i++) { const z = -L / 2 + i * L / 20; for (const s of [-1, 1]) B.b.add(G.box, M(s * (W / 2 + 0.02), H / 2, z, 0, 0.04, H - 0.2, 0.08), shadeC(col, 0.82), K.metal); }
  for (const s of [-1, 1]) for (const y of [0.06, H - 0.06]) B.b.add(G.box, M(0, y, s * (L / 2 + 0.02), 0, W + 0.04, 0.12, 0.06), shadeC(col, 0.7), K.metal);
  for (const s of [-0.5, 0.5]) for (const t of [-1, 1]) B.b.add(G.box, M(s * W * 0.9, H / 2, L / 2 + 0.03, 0, 0.05, H - 0.3, 0.05), 0x8a8a8a, K.metal);
  B.cols.push({ x: 0, z: 0, hx: W / 2, hz: L / 2, y0: -0.5, y1: H - 0.62 }); B.plats.push({ x: 0, z: 0, hx: W / 2, hz: L / 2, y: H });
  B.zones.push({ x: 0, z: 0, hx: W / 2, hz: L / 2, m: 4 });
};
ED_PRE.sandbags = (o, B) => {
  const L = o.w, n = Math.max(1, Math.round(L / 0.62));
  for (let r = 0; r < 3; r++) for (let i = 0; i < n - (r % 2); i++) { const x = -L / 2 + (i + 0.5 + (r % 2) * 0.5) * L / n; B.b.add(G.sph, M(x, 0.16 + r * 0.26, 0, hash(i, r) * 0.3, L / n * 0.55, 0.15, 0.27), shadeC(0xb8a47a, 0.9 + hash(i * 3, r) * 0.15), K.fabric); }
  B.cols.push({ x: 0, z: 0, hx: L / 2, hz: 0.3, y0: -0.4, y1: 0.8 });
};
ED_PRE.barrier = (o, B) => {
  const L = o.w, n = Math.max(1, Math.round(L / 2));
  for (let i = 0; i < n; i++) { const x = -L / 2 + (i + 0.5) * L / n; B.b.add(G.box, M(x, 0.25, 0, 0, L / n - 0.05, 0.5, 0.62), 0xb8b4ac, K.stone); B.b.add(G.box, M(x, 0.75, 0, 0, L / n - 0.05, 0.5, 0.26), 0xb8b4ac, K.stone); B.b.add(G.box, M(x, 0.6, 0.18, 0, L / n - 0.1, 0.16, 0.012), 0xd8a030, K.plain); }
  B.cols.push({ x: 0, z: 0, hx: L / 2, hz: 0.32, y0: -0.4, y1: 1.0 });
};
ED_PRE.colbox = (o, B) => {
  const g = new THREE.Mesh(G.box, ED_GHOST_MAT); g.scale.set(o.w, o.h, o.d); g.position.y = o.h / 2;
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(G.box), ED_GHOST_EDGE); e.userData.own = true; g.add(e);
  B.ghost = g;
  B.cols.push({ x: 0, z: 0, hx: o.w / 2, hz: o.d / 2, y0: -0.2, y1: o.h, always: true });
};
ED_PRE.spawn = (o, B) => {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.07, 6, 40), new THREE.MeshBasicMaterial({ color: C(0x5fe08c) })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.08; ring.userData.own = true; g.add(ring);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6, 6), new THREE.MeshBasicMaterial({ color: C(0xe8e6e0) })); pole.position.y = 1.3; pole.userData.own = true; g.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55), new THREE.MeshBasicMaterial({ color: C(0x5fe08c), side: THREE.DoubleSide })); flag.position.set(0.47, 2.3, 0); flag.userData.own = true; g.add(flag);
  B.ghost = g;
};
ED_PRE.place = (o, B, d) => {
  const id = d.ids[o.c % d.ids.length], it = ITEMS[id]; if (!it) return;
  const r = { id, x: 0, y: 0, z: 0, ry: 0, uid: o.id };
  drawPlace(r, B.b, B.gb, B.lb, B.fb);
  const kind = placeKind(it), f = FOOT[kind] || [0.5, 1];
  if (f[1] > 0.3 && !['rug', 'rug_small', 'curtain', 'cushion', 'sleeping_bag', 'candle', 'oil_lamp'].includes(kind)) B.cols.push({ x: 0, z: 0, hx: Math.min(f[0], 1.2) * 0.75, hz: Math.min(f[0], 1.2) * 0.6, y0: -0.3, y1: Math.min(f[1], 2.2) });
  const li = LIGHTING[kind]; if (li) B.lights.push({ x: 0, y: li[0], z: 0, color: it.place.light || (li[2] === 'fire' ? 0xff9a50 : 0xffc98a), range: li[1], kind: li[2] === 'lamp' ? 'street' : li[2] });
  if (kind === 'campfire' || kind === 'fireplace' || kind === 'well' || kind === 'fountain' || kind === 'coop' || kind === 'planter') B.zones.push({ x: 0, z: 0, hx: f[0], hz: f[0], m: 4 });
};

/* ── the kinds of things ── */
const ED_T = {};
ED_T.mesh = {
  make(o, d) {
    const v = o.v, B = edBuilders(), world = !!d.world;
    if (!world) { o.y = edGround(o.x, o.z) + o.dy; }
    else o.y = terrainAt(o.x, o.z);
    ED_PRE[d.pre](o, B, d);
    if (B.pad) {            // a plot flattens the ground under it, at the height of its middle
      const y = terrainBare(o.x, o.z) + o.dy, p = addPad({ x: o.x, z: o.z, hx: B.pad.hx, hz: B.pad.hz, ry: o.ry, y, m: B.pad.m });
      v.pads.push(p); o.y = y; edTouch(o.x, o.z, Math.hypot(p.hx, p.hz) + p.m, true, 7);
    }
    const root = new THREE.Group();
    if (!world) { root.position.set(o.x, o.y, o.z); root.rotation.y = o.ry; root.scale.setScalar(o.s); }
    v.meshesList = edMeshes(B, root); scene.add(root); v.root = root; v.pick = root;
    if (d.edOnly) root.visible = ED.on;
    const S = world ? 1 : o.s, c = Math.cos(o.ry), s = Math.sin(o.ry);
    const W = (q) => (q.wx !== undefined ? [q.wx, q.wz] : world ? [q.x, q.z] : [o.x + (q.x * c + q.z * s) * S, o.z + (-q.x * s + q.z * c) * S]);
    const Y = (y, q) => (q && q.wy !== undefined ? q.wy : world ? y : o.y + y * S);
    if (o.col || d.edOnly) for (const q of B.cols) {
      const [x, z] = W(q), col = addCollider({ t: 'o', x, z, hx: q.hx * S, hz: q.hz * S, ry: world ? q.ry || 0 : o.ry + (q.ry || 0), y0: Y(q.y0), y1: Y(q.y1) });
      if (q.gate) v.gateCol = col; v.cols.push(col);
    }
    for (const q of B.plats) {
      const [x, z] = W(q), ry = q.wx !== undefined || world ? q.ry || 0 : o.ry;
      v.plats.push(addPlatform(q.t === 'oramp' ? { t: 'oramp', x, z, hx: q.hx * S, hz: q.hz * S, ry, ya: Y(q.ya), yb: Y(q.yb) } : { t: 'orect', x, z, hx: q.hx * S, hz: q.hz * S, ry, y: Y(q.y, q) }));
    }
    for (const q of B.lights) { const [x, z] = W(q), a = { x, y: Y(q.y), z, color: q.color, range: q.range, kind: q.kind }; LIGHT_ANCHORS.push(a); v.anchors.push(a); }
    for (const q of B.zones) { const [x, z] = q.t === 'r' ? [q.x, q.z] : W(q); v.zones.push(zoneAdd(q.t === 'r' ? q : { t: 'r', x, z, hx: q.hx * S, hz: q.hz * S, ry: o.ry, m: q.m })); }
    for (const zn of v.zones) edTouch(zn.x, zn.z, Math.hypot(zn.hx, zn.hz), false, zn.m);
  },
};
ED_T.tree = {
  make(o, d) {
    const sp = VEG.species[d.sp]; if (!sp) return;
    o.y = edGround(o.x, o.z) + o.dy;
    const t = { id: d.sp, v: o.c % sp.variants.length, x: o.x, z: o.z, y: o.y - 0.05, s: o.s, rot: o.ry, tint: 0.5, bush: !!SP_INFO[d.sp].bush, key: 'e' + o.id, hp: SP_INFO[d.sp].hp, ed: o };
    const k = vkey(Math.floor(o.x / VCELL), Math.floor(o.z / VCELL)); o.v.t = t; o.v.cell = k;
    let L = ED.treeCells.get(k); if (!L) ED.treeCells.set(k, L = []); L.push(t);
    const c = VCELLS.get(k), va = sp.variants[t.v];
    if (c) { c.trees.push(t); if (c.colliders && !t.bush) { t.col = addCollider({ t: 'c', x: t.x, z: t.z, r: Math.max(0.12, va.trunkR * t.s * 0.85), y1: t.y + 8 }); t.col.tree = t; c.colliders.push(t.col); } }
    vegDirty();
    const H = (va.height || 8) * o.s; o.v.sph = { x: o.x, y: o.y + H * 0.45, z: o.z, r: Math.max(0.8, H * 0.3, (va.crownR || 2) * o.s * 0.45) }; o.v.H = H;
  },
  free(o) {
    const t = o.v.t; if (!t) return;
    const k = o.v.cell, L = ED.treeCells.get(k); if (L) { const i = L.indexOf(t); if (i >= 0) L.splice(i, 1); if (!L.length) ED.treeCells.delete(k); }
    const c = VCELLS.get(k);
    if (c) { const i = c.trees.indexOf(t); if (i >= 0) c.trees.splice(i, 1); if (t.col && c.colliders) { const q = c.colliders.indexOf(t.col); if (q >= 0) c.colliders.splice(q, 1); } }
    if (t.col) removeCollider(t.col);
    vegDirty();
  },
};
ED_T.rock = {
  make(o, d) {
    const names = ROCK_KINDS[d.rk], name = names[o.c % names.length], so = SCAN.obj[name]; if (!so) return;
    const size = d.size * o.s, s = size / Math.max(so.size[0], so.size[2]);
    o.y = edGround(o.x, o.z) + o.dy;
    const sink = d.rk === 'flat' ? 0.25 * s * so.size[1] : d.rk === 'cliff' ? 0.15 * s * so.size[1] : d.rk === 'stump' || d.rk === 'branches' ? 0.02 : 0.22 * s * so.size[1];
    const t = { name, kind: d.rk, x: o.x, z: o.z, y: o.y - sink, s, ry: o.ry, tilt: 0, r: size * 0.5, h: s * so.size[1], tint: 1, ore: null, key: 'e' + o.id, ed: o };
    if (d.rk === 'boulder' || d.rk === 'mossy') { t.hp = Math.max(2, Math.round(size * 3)); t.maxHp = t.hp; }
    const k = vkey(Math.floor(o.x / VCELL), Math.floor(o.z / VCELL)); o.v.t = t; o.v.cell = k;
    let L = ED.rockCells.get(k); if (!L) ED.rockCells.set(k, L = []); L.push(t);
    const c = RCELLS.get(k);
    if (c) { c.rocks.push(t); if (c.colliders && !(t.kind === 'branches' || (t.kind !== 'cliff' && t.r < 0.35))) { t.col = addCollider({ t: 'c', x: t.x, z: t.z, r: t.kind === 'flat' ? t.r * 0.7 : t.r * 0.8, y1: t.y + t.h * 0.9 }); c.colliders.push(t.col); } }
    rocksDirty();
    o.v.sph = { x: o.x, y: o.y + t.h * 0.35, z: o.z, r: Math.max(0.5, t.r * 0.9) }; o.v.H = t.h;
  },
  free(o) {
    const t = o.v.t; if (!t) return;
    const k = o.v.cell, L = ED.rockCells.get(k); if (L) { const i = L.indexOf(t); if (i >= 0) L.splice(i, 1); if (!L.length) ED.rockCells.delete(k); }
    const c = RCELLS.get(k);
    if (c) { const i = c.rocks.indexOf(t); if (i >= 0) c.rocks.splice(i, 1); if (t.col && c.colliders) { const q = c.colliders.indexOf(t.col); if (q >= 0) c.colliders.splice(q, 1); } }
    if (t.col) removeCollider(t.col);
    rocksDirty();
  },
};
function edLandSink(kind, D, s) { return kind === 'crag' ? D.size[1] * s * 0.03 : kind === 'fortress' ? D.size[1] * s * 0.02 : LAND_BYTOWN[kind] ? 0.12 : kind === 'kingshall' || kind === 'hintze' ? 0.05 : 0.6; }
ED_T.land = {
  make(o, d) {
    const v = o.v, tok = v.tok; v.loading = true;
    const put = (D) => {
      if (o.v !== v || v.tok !== tok) return;          // taken away (or rebuilt) while it loaded
      v.loading = false;
      const y = landFitY(D, o.x, o.z, o.ry, o.s) - edLandSink(d.land, D, o.s) + o.dy, L = v.L || { kind: d.land, def: D, ed: o };
      o.y = y; landSet(L, o.x, o.z, o.ry, o.s, y); v.L = L;
      edTouch(o.x, o.z, L.R, false, 7);
      if (ED.sel === o && typeof edOutline === 'function') edOutline();
    };
    const D = LAND.defs[d.land];
    if (D && D.meshP && D.mesh0) put(D);
    else landDef(d.land).then(put).catch((e) => { v.loading = false; console.warn('editor: landform', d.land, e); toast('تعذّر تحميل ' + d.name, 'تحقّق من الاتصال'); });
  },
  free(o) { const L = o.v.L; if (L) { landRemove(L); edTouch(L.x, L.z, L.R, false, 7); } },
};
// houses through the island's own builder: one little settlement each, its ground made flat by a pad
function edHouseRec(o, d, x, z, w, dd, q, style, kind, floors, seed) {
  const door = ['s', 'e', 'n', 'w'][q], swap = q & 1, hx = (swap ? dd : w) / 2, hz = (swap ? w : dd) / 2, st = STYLES[style] || STYLES.city;
  const b = { id: 'ed' + o.id + ':' + (seed & 255), x, z, hx, hz, door, style, st, seed, floors, kind, name: d.name };
  b.wall = st.walls[seed % st.walls.length]; b.trim = TRIMS[seed % TRIMS.length]; b.roofC = (st.roofC || [0x8a3a2a])[(seed >> 3) % (st.roofC || [0]).length];
  if (st.ruin) { b.wall = st.walls[seed % st.walls.length]; b.trim = [0x4a443c, 0x3a3631, 0x5a5048][(seed >> 2) % 3]; }
  return b;
}
function edSettle(o, b, r) {
  const S = { id: b.id, name: b.name, kind: 'ed', x: b.x, z: b.z, r, src: { buildings: [b], props: [], streets: [] }, buildings: [b], state: 'building', ctx: null, job: null, far: null };
  b.settlement = S;
  const job = buildJob(S); let n = 0; while (!job.next().done && n++ < 400);
  S.state = 'near';
  BUILDINGS.push(b); BGRID.insert(b, b.x - b.hx, b.z - b.hz, b.x + b.hx, b.z + b.hz);
  return S;
}
function edUnsettle(S) {
  if (!S) return;
  unloadSettlement(S);
  for (const b of S.buildings) { BGRID.remove(b); const i = BUILDINGS.indexOf(b); if (i >= 0) BUILDINGS.splice(i, 1); }
}
const edQuarter = (ry) => ((Math.round(ry / (Math.PI / 2)) % 4) + 4) % 4;
ED_T.house = {
  make(o, d) {
    const q = edQuarter(o.ry); o.ry = q * Math.PI / 2;
    const style = o.st || d.style, special = d.special, w = special && d.kind !== 'hangar' ? Math.max(o.w, o.d) : o.w, dd = special && d.kind !== 'hangar' ? Math.max(o.w, o.d) : o.d;
    const b = edHouseRec(o, d, o.x, o.z, w, dd, q, style, d.kind, o.f, o.c * 37 + 11);
    const y = terrainBare(o.x, o.z) + o.dy;
    o.v.pads.push(addPad({ x: o.x, z: o.z, hx: b.hx + 1.4, hz: b.hz + 1.4, ry: 0, y, m: 8 })); o.y = y;
    o.v.S = edSettle(o, b, Math.max(b.hx, b.hz) + 8); o.v.b = b;
    if (!o.col) for (const c of o.v.S.ctx.cols) c.off = true;
    o.v.zones.push(zoneAdd({ t: 'r', x: o.x, z: o.z, hx: b.hx + 1.2, hz: b.hz + 1.2, ry: 0, m: 7 }));
    edTouch(o.x, o.z, Math.hypot(b.hx, b.hz) + 10, true, 7);
    o.v.pickList = o.v.S.ctx.meshes;
  },
  free(o) { edUnsettle(o.v.S); },
};
// a villa: a big flat plot, a two-storey house at the back, a wall with railings and a gate, a paved path, lamps, trees and a pool
ED_T.villa = {
  make(o, d) {
    const q = edQuarter(o.ry); o.ry = q * Math.PI / 2;
    const W = o.w, D = o.d, y = terrainBare(o.x, o.z) + o.dy, v = o.v;
    v.pads.push(addPad({ x: o.x, z: o.z, hx: W / 2 + 1, hz: D / 2 + 1, ry: o.ry, y, m: 10 })); o.y = y;
    v.zones.push(zoneAdd({ t: 'r', x: o.x, z: o.z, hx: W / 2 + 0.5, hz: D / 2 + 0.5, ry: o.ry, m: 3 }));
    // the house: centred across, near the back, door to the front
    const hw = Math.min(16, W * 0.42), hd = Math.min(12, D * 0.34), [hxw, hzw] = edW(o, 0, -D / 2 + hd / 2 + 5);
    const b = edHouseRec(o, d, hxw, hzw, hw, hd, q, ['city', 'farm', 'chalet', 'adobe'][o.st || 0] || 'city', 'lodge', o.f, o.c * 41 + 5);
    v.S = edSettle(o, b, Math.max(W, D)); v.b = b;
    v.zones.push(zoneAdd({ t: 'r', x: hxw, z: hzw, hx: b.hx + 1, hz: b.hz + 1, ry: 0, m: 4 }));
    const B = edBuilders(), sub = Object.assign({}, o, { w: 0 });
    // the wall all round, the gate's opening in the middle of the front
    const hW = W / 2, hD = D / 2, gate = 2.8;
    for (const [ax, az, bx, bz] of [[-hW, hD, -gate, hD], [gate, hD, hW, hD], [hW, hD, hW, -hD], [hW, -hD, -hW, -hD], [-hW, -hD, -hW, hD]]) {
      edRun(sub, ax, az, bx, bz, 2.5, (p, r, yaw, len, k) => {
        edSpan(B.b, p, r, yaw, len, 0.45, 0.9, 0.4, 0xe8e0d0, K.plaster); edSpan(B.b, p, r, yaw, len, 0.95, 0.1, 0.5, 0xb8b0a4, K.stone);
        for (const pp of k === 0 ? [p, r] : [r]) { B.b.add(G.box, M(pp[0], pp[1] + 1.05, pp[2], yaw, 0.5, 2.1, 0.5), 0xe8e0d0, K.plaster); B.b.add(G.box, M(pp[0], pp[1] + 2.15, pp[2], yaw, 0.6, 0.1, 0.6), 0xb8b0a4, K.stone); }
        const n = Math.max(2, Math.round(len / 0.22)); for (let i = 1; i < n; i++) { const t = i / n; B.b.add(G.box, M(lerp(p[0], r[0], t), lerp(p[1], r[1], t) + 1.5, lerp(p[2], r[2], t), yaw, 0.04, 1.0, 0.04), 0x2c3135, K.metal); }
        edSpan(B.b, p, r, yaw, len, 2.0, 0.05, 0.05, 0x2c3135, K.metal);
        B.cols.push({ x: (p[0] + r[0]) / 2, z: (p[2] + r[2]) / 2, hx: len / 2, hz: 0.25, ry: yaw, y0: Math.min(p[1], r[1]) - 0.5, y1: Math.max(p[1], r[1]) + 2.1 });
      });
    }
    // the gate's lamps, the path to the door, flower beds along it
    for (const s of [-1, 1]) { const [lx, lz] = edW(o, s * (gate + 0.4), hD), g = y; B.b.add(G.cyl8, M(lx, g + 2.6, lz, 0, 0.06, 0.8, 0.06), 0x2c3135, K.metal); B.b.add(G.box, M(lx, g + 3.0, lz, 0, 0.3, 0.36, 0.3), 0x2c3135, K.metal); B.lb.add(G.box, M(lx, g + 2.98, lz, 0, 0.22, 0.26, 0.22), 0xffffff, K.plain); B.lights.push({ x: lx, y: g + 3.0, z: lz, color: 0xffc98a, range: 16, kind: 'lamp' }); }
    const pz0 = hD, pz1 = -D / 2 + hd + 5.2, [px, pz] = edW(o, 0, (pz0 + pz1) / 2), plen = Math.abs(pz0 - pz1);
    B.b.add(G.box, M(px, y + 0.03, pz, o.ry, 2.6, 0.06, plen), 0xc8c0b0, K.stone);
    for (const s of [-1, 1]) { const [fx, fz] = edW(o, s * 2.2, (pz0 + pz1) / 2); B.b.add(G.box, M(fx, y + 0.12, fz, o.ry, 1.0, 0.24, plen - 1), 0x6a4a32, K.stone); for (let i = 0; i < plen / 1.2 - 1; i++) { const [ex, ez] = edW(o, s * 2.2, pz0 - 1 - i * 1.2); B.b.add(G.ico1, M(ex, y + 0.42, ez, i, 0.38, 0.3, 0.38), [0xc8303a, 0xe8c030, 0xe85a8a, 0xf4f4f0][(i + (s > 0 ? 1 : 0)) % 4], K.fabric); } }
    v.zones.push(zoneAdd({ t: 'r', x: px, z: pz, hx: 2.8, hz: plen / 2, ry: o.ry, m: 4 }));
    // a round pool at one side of the garden, its rim in stone
    if (o.c % 2 === 0) {
      const R = Math.min(5, W * 0.11), [qx, qz] = edW(o, -W / 2 + R + 4, D / 2 - R - 5), level = y - 0.15;
      v.shapes.push(addShape({ t: 'pool', x: qx, z: qz, w: R * 2.04, d: R * 2.04, h: 1.9, ry: 0, seed: 1 }));
      const lk = { x: qx, z: qz, r: R, y: level }; EDW.list.push(lk); lakeGrid(lk, true); v.lake = lk;
      for (let i = 0; i < 28; i++) { const a = i / 28 * TAU; B.b.add(G.box, M(qx + Math.cos(a) * (R + 0.25), y + 0.06, qz + Math.sin(a) * (R + 0.25), -a, 0.55, 0.16, R * TAU / 28 + 0.06), 0xe8e4dc, K.stone); }
      v.pool = { x: qx, z: qz, r: R + 0.2, level };
      v.zones.push(zoneAdd({ t: 'c', x: qx, z: qz, r: R + 0.8, m: 7 }));
    }
    const root = new THREE.Group(); edMeshes(B, root); scene.add(root); v.root = root;
    for (const c of B.cols) v.cols.push(addCollider({ t: 'o', x: c.x, z: c.z, hx: c.hx, hz: c.hz, ry: c.ry, y0: c.y0, y1: c.y1 }));
    for (const a of B.lights) { LIGHT_ANCHORS.push(a); v.anchors.push(a); }
    if (v.pool) { const m = edWaterMesh(v.pool.x, v.pool.z, v.pool.r, v.pool.level); v.meshes.push(m); }
    // trees in the corners of the garden (the island's own trees, felled like any other)
    v.trees = [];
    for (const [lx, lz, sp] of [[-W / 2 + 3, -D / 2 + 3, 'cypress'], [W / 2 - 3, -D / 2 + 3, 'cypress'], [W / 2 - 4, D / 2 - 4, 'olive'], [W / 2 - 4, D / 2 - 10, 'palm'], [-W / 2 + 4, 0, 'plane']]) {
      if (!VEG.species[sp]) continue;
      const [tx, tz] = edW(o, lx, lz), t = { id: sp, v: (o.c + v.trees.length) % VEG.species[sp].variants.length, x: tx, z: tz, y: y - 0.05, s: 0.85, rot: lx + lz, tint: 0.5, bush: false, key: 'e' + o.id + 't' + v.trees.length, hp: SP_INFO[sp].hp };
      const k = vkey(Math.floor(tx / VCELL), Math.floor(tz / VCELL)); let L = ED.treeCells.get(k); if (!L) ED.treeCells.set(k, L = []); L.push(t); v.trees.push([k, t]);
    }
    edTouch(o.x, o.z, Math.hypot(W, D) / 2 + 12, true, 7);
    v.pickList = v.S.ctx.meshes.concat(v.root.children);
  },
  free(o) {
    const v = o.v; edUnsettle(v.S);
    if (v.lake) { lakeGrid(v.lake, false); const i = EDW.list.indexOf(v.lake); if (i >= 0) EDW.list.splice(i, 1); }
    for (const [k, t] of v.trees || []) { const L = ED.treeCells.get(k); if (L) { const i = L.indexOf(t); if (i >= 0) L.splice(i, 1); if (!L.length) ED.treeCells.delete(k); } }
    edTouch(o.x, o.z, Math.hypot(o.w, o.d) / 2 + 12, true, 7);
  },
};
// the surface of a lake: rings out to its basin's edge, each point knowing how deep the water is there (the shore is where it runs out)
function edWaterMesh(x, z, R, level) {
  const rings = Math.round(clamp(R / 1.6, 8, 46)), segs = Math.round(clamp(R * 1.2, 24, 96)), pos = [x, level + 0.02, z], dep = [level - terrainAt(x, z)], idx = [];
  for (let i = 1; i <= rings; i++) {
    const r = R * (i / rings) ** 0.85;
    for (let j = 0; j < segs; j++) { const a = j / segs * TAU, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; pos.push(px, level + 0.02, pz); dep.push(level - terrainAt(px, pz)); }
  }
  for (let j = 0; j < segs; j++) idx.push(0, 1 + (j + 1) % segs, 1 + j);
  for (let i = 1; i < rings; i++) for (let j = 0; j < segs; j++) { const a = 1 + (i - 1) * segs + j, b = 1 + (i - 1) * segs + (j + 1) % segs, c = a + segs, e = b + segs; idx.push(a, b, c, b, e, c); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aDepth', new THREE.Float32BufferAttribute(dep, 1)); g.setIndex(idx); g.computeBoundingSphere();
  const m = new THREE.Mesh(g, ED_WATER_MAT); m.renderOrder = 2; m.userData.own = true; scene.add(m);
  return m;
}
ED_T.lake = {
  make(o, d) {
    const R = o.w / 2, v = o.v;
    // the level: the lowest ground on its rim (before its own basin), a little under it; the basin is dug from there
    let lo = 1e9; for (let k = 0; k < 24; k++) { const a = k / 24 * TAU; lo = Math.min(lo, terrainBare(o.x + Math.cos(a) * R, o.z + Math.sin(a) * R)); }
    const level = (d.pool ? terrainBare(o.x, o.z) - 0.15 : lo - 0.3) + o.dy, hc = terrainBare(o.x, o.z), BW = o.w * (d.pool ? 1.02 : 1.32);
    v.shapes.push(addShape({ t: d.pool ? 'pool' : 'bowl', x: o.x, z: o.z, w: BW, d: BW, h: Math.max(0.3, hc - level) + o.h, ry: 0, seed: 1 }));
    const lk = { x: o.x, z: o.z, r: BW / 2, y: level }; EDW.list.push(lk); lakeGrid(lk, true); v.lake = lk; o.y = level;
    v.meshes.push(edWaterMesh(o.x, o.z, BW / 2, level));
    if (d.pool) { const B = edBuilders(), n = Math.max(16, Math.round(R * 6)); for (let i = 0; i < n; i++) { const a = i / n * TAU; B.b.add(G.box, M(o.x + Math.cos(a) * (R + 0.25), hc + 0.06, o.z + Math.sin(a) * (R + 0.25), -a, 0.55, 0.16, R * TAU / n + 0.06), 0xe8e4dc, K.stone); } const root = new THREE.Group(); edMeshes(B, root); scene.add(root); v.root = root; }
    v.zones.push(zoneAdd({ t: 'c', x: o.x, z: o.z, r: BW / 2 * (d.pool ? 1.1 : 0.9), m: d.pool ? 7 : 3 }));
    edTouch(o.x, o.z, BW / 2 + 4, true, 7);
  },
  free(o) { const lk = o.v.lake; if (lk) { lakeGrid(lk, false); const i = EDW.list.indexOf(lk); if (i >= 0) EDW.list.splice(i, 1); } },
};
ED_T.shape = {
  make(o, d) {
    if (d.round) o.d = o.w;
    o.v.shapes.push(addShape({ t: d.shape, x: o.x, z: o.z, w: o.w, d: o.d, h: o.h, ry: o.ry, seed: o.c + 1 }));
    o.y = terrainAt(o.x, o.z);
    edTouch(o.x, o.z, Math.max(o.w, o.d) / 2 + 4, true, 7);
  },
};
// a boat floats on whatever water is there (a lake has its own level), a car stands on the ground
function edVehY(kind, x, z) {
  if (!VSPEC[kind].water) return groundAt(x, z, terrainAt(x, z) + 1.5);
  const wl = waterAt(x, z); return (wl > terrainAt(x, z) && wl !== 0 ? wl : waveY(x, z, 0)) - 0.1;
}
ED_T.veh = {
  make(o, d) {
    const paint = d.paint ? d.paint[o.c % d.paint.length] : PAINTS[o.c % PAINTS.length];
    const v = spawnVehicle(d.veh, o.x, o.z, o.ry, paint); v.ed = o; o.v.veh = v;
    v.pos.y = edVehY(d.veh, o.x, o.z) + o.dy; v.root.position.copy(v.pos); placeVehicleCols(v);
    o.y = v.pos.y; o.v.pickList = [v.root];
    if (VSPEC[d.veh].water && !(waterAt(o.x, o.z) > terrainAt(o.x, o.z) + 0.3) && ED.on) toast('القوارب تطفو على الماء', 'ضعه في بحيرة أو في البحر');
  },
  free(o) { const v = o.v.veh; if (v) { if (player.vehicle === v) exitVehicle(true); removeVehicle(v); } },
};
const ED_OUTFITS = [null, { top: { c: 0x4a5a3a, p: 'camo', a: 0.9 }, pants: { c: 0x4a4a3a, p: 'camo', a: 0.9 }, shoes: { c: 0x2a2420, a: 0.9 }, head: { c: 0x3a4030, a: 0.88 }, hat: 'helmet', hatC: 0x4a5038 },
  { top: { c: 0xe8e2d6, a: 0.9 }, pants: { c: 0x2f3f5a, a: 0.9 }, shoes: { c: 0x3a2a20, a: 0.9 }, hat: 'cap', hatC: 0x2f4a6a }, { top: { c: 0x8a2a2a, a: 0.9 }, pants: { c: 0x2a2a2e, a: 0.9 }, shoes: { c: 0x1a1a1a, a: 0.9 }, glasses: 'sunglasses' },
  { top: { c: 0xd8b070, p: 'desert', a: 0.9 }, pants: { c: 0x8a7050, a: 0.9 }, shoes: { c: 0x5a4030, a: 0.9 }, hat: 'shemagh', hatC: 0xd8d0c4 }];
ED_T.body = {
  make(o, d) {
    const outfit = d.outfits ? ED_OUTFITS[o.c % ED_OUTFITS.length] || DEFAULT_OUTFIT : undefined;
    const body = makeBody(d.body, { shadow: QUALITY.tier >= 1, outfit }); if (!body) return;
    o.y = edGround(o.x, o.z) + o.dy;
    body.root.position.set(o.x, o.y, o.z); body.root.rotation.y = o.ry; body.root.scale.setScalar(o.s);
    // standing and breathing, like the shopkeepers (only the idle clip runs)
    for (const a of Object.values(body.act)) { a.stop(); a.enabled = true; }
    if (body.act.Idle) { body.act.Idle.play(); body.act.Idle.setEffectiveWeight(1); body.act.Idle.time = rand() * 3; }
    scene.add(body.root); body.mixer.update(0.01); o.v.body = body; ED_MIX.add(body);
    if (o.col) o.v.cols.push(addCollider({ t: 'c', x: o.x, z: o.z, r: 0.32 * o.s, y0: o.y - 0.3, y1: o.y + 1.8 * o.s }));
    o.v.sph = { x: o.x, y: o.y + 0.95 * o.s, z: o.z, r: 0.75 * o.s };
  },
  free(o) { const b = o.v.body; if (b) { scene.remove(b.root); ED_MIX.delete(b); } },
};
ED_T.animal = {
  make(o, d) {
    const S = ASPEC[d.an]; if (!S || (S.model && !ANIMAL_MODELS[S.model])) return;
    o.y = edGround(o.x, o.z);
    const herd = { kind: d.an, x: o.x, z: o.z, members: [], t: 0, ed: o };
    for (let i = 0; i < o.n; i++) {
      const a = i * 2.4 + o.c, rad = i ? 1.2 + Math.sqrt(i) * (S.len + 0.6) : 0, an = makeAnimal(d.an, o.x + Math.cos(a) * rad, o.z + Math.sin(a) * rad);
      if (!an) continue; an.herd = herd; an.ed = o; an.yaw = o.ry + (i ? Math.sin(i * 7.1) * 0.8 : 0); herd.members.push(an);
    }
    HERDS.push(herd); o.v.herd = herd; o.v.sph = { x: o.x, y: o.y + S.h * 0.6, z: o.z, r: Math.max(0.8, S.len * 0.5 + Math.sqrt(o.n) * 0.8) };
    ED.animDirty = true;
  },
  free(o) {
    const h = o.v.herd; if (!h) return;
    for (const an of h.members) { an.active = false; an.ed = null; if (an.root) an.root.visible = false; }
    const i = HERDS.indexOf(h); if (i >= 0) HERDS.splice(i, 1); ED.animDirty = true;
  },
};
// things to pick up: the owner's weapons on a stand, boxes of ammunition, first aid, food. Taken, they come back in ten minutes
ED_T.pickup = {
  make(o, d) {
    o.y = edGround(o.x, o.z) + o.dy;
    const B = edBuilders(), root = new THREE.Group(); root.position.set(o.x, o.y, o.z); root.rotation.y = o.ry; root.scale.setScalar(o.s);
    let top = 0;
    if (d.prop) {
      top = 0.78;
      B.b.add(G.box, M(0, top - 0.03, 0, 0, 1.25, 0.06, 0.55), 0x6b4a2f, K.wood);
      for (const [x, z] of [[-0.55, -0.22], [0.55, -0.22], [-0.55, 0.22], [0.55, 0.22]]) B.b.add(G.box, M(x, (top - 0.06) / 2, z, 0, 0.06, top - 0.06, 0.06), 0x4a3424, K.wood);
      B.cols.push({ x: 0, z: 0, hx: 0.62, hz: 0.28, y0: -0.3, y1: top });
    } else {
      const c = d.box; B.b.add(G.box, M(0, 0.22, 0, 0, 0.7, 0.44, 0.45), c, K.metal); B.b.add(G.box, M(0, 0.45, 0, 0, 0.72, 0.04, 0.47), shadeC(c, 0.7), K.metal);
      if (d.key === 'I_med') { B.b.add(G.box, M(0, 0.25, 0.226, 0, 0.22, 0.06, 0.01), 0xffffff, K.plain); B.b.add(G.box, M(0, 0.25, 0.226, 0, 0.06, 0.22, 0.01), 0xffffff, K.plain); }
      B.cols.push({ x: 0, z: 0, hx: 0.36, hz: 0.24, y0: -0.3, y1: 0.46 });
    }
    edMeshes(B, root); scene.add(root); o.v.root = root; o.v.pick = root; o.v.top = top;
    if (d.prop) edPropOn(o, d);
    const c = Math.cos(o.ry), s = Math.sin(o.ry);
    if (o.col) for (const q of B.cols) o.v.cols.push(addCollider({ t: 'o', x: o.x + q.x * c * o.s, z: o.z - q.x * s * o.s, hx: q.hx * o.s, hz: q.hz * o.s, ry: o.ry, y0: o.y + q.y0, y1: o.y + q.y1 * o.s }));
    if (o.v.taken === undefined) o.v.taken = 0;
  },
};
// the owner's prop laid on the stand: its longest side along the table, its flattest side down
function edPropOn(o, d) {
  const P = propMesh(d.prop), v = o.v;
  if (!P) { if (!v.waiting) { v.waiting = true; const f = (name) => { if (name === d.prop && o.v === v) { const i = PROP_WAIT.indexOf(f); if (i >= 0) PROP_WAIT.splice(i, 1); edPropOn(o, d); } }; PROP_WAIT.push(f); } return; }
  const m = P.mesh.clone(); m.castShadow = true; m.receiveShadow = true;
  const g = P.mesh.geometry; if (!g.boundingBox) g.computeBoundingBox();
  const bb = g.boundingBox, sz = [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z], ax = [0, 1, 2].sort((a, b) => sz[b] - sz[a]);
  const cols = [null, null, null]; cols[ax[0]] = new THREE.Vector3(1, 0, 0); cols[ax[2]] = new THREE.Vector3(0, 1, 0); cols[ax[1]] = new THREE.Vector3(0, 0, 1);
  const R = new THREE.Matrix4().makeBasis(cols[0], cols[1], cols[2]); if (R.determinant() < 0) { cols[ax[1]].z = -1; R.makeBasis(cols[0], cols[1], cols[2]); }
  m.quaternion.setFromRotationMatrix(R);
  const ctr = new THREE.Vector3().addVectors(bb.min, bb.max).multiplyScalar(0.5).applyQuaternion(m.quaternion);
  const k = Math.min(1, 1.1 / Math.max(0.01, sz[ax[0]]));
  m.scale.setScalar(k); m.position.set(-ctr.x * k, v.top + sz[ax[2]] * k / 2 - ctr.y * k, -ctr.z * k);
  m.userData.prop = true; v.root.add(m); v.prop = m;
}
ED_T.crate = {
  make(o, d) {
    o.y = edGround(o.x, o.z) + o.dy;
    const root = new THREE.Group(), m = new THREE.Mesh(CRATE_GEO, UBER_OBJ); m.castShadow = true; m.receiveShadow = true; root.add(m);
    root.position.set(o.x, o.y, o.z); root.rotation.y = o.ry; scene.add(root); o.v.root = root; o.v.pick = root;
    if (o.col) o.v.cols.push(addCollider({ t: 'o', x: o.x, z: o.z, hx: 0.48, hz: 0.33, ry: o.ry, y0: o.y - 0.3, y1: o.y + 0.62 }));
  },
  free(o) { if (o.v.crate) { removeCrate(o.v.crate); o.v.crate = null; } },
};

/* ── the editor's people breathe and its houses show their rooms when you come near; in the game its animals come back
   to their places, its crates fill, what was taken from a stand returns ── */
let edLiveT = 0;
function edLive(dt) {
  for (const b of ED_MIX) b.mixer.update(dt);
  // land changed a moment ago (a landform that just arrived, a stroke, a drop): rebuild around it once the hand is still
  if (ED.pend && performance.now() - ED.pend.t > 400 && !EDB.on && !EDE.on && EP.mode !== 'drag') edFlush(true);
  edLiveT -= dt; if (edLiveT > 0 || !ED.objs.length) return; edLiveT = 0.5;
  const p = ED.on ? ED.focus : started ? player.pos : camera.position;
  for (const o of ED.objs) {
    const v = o.v; if (!v) continue;
    const S = v.S;
    if (S && S.ctx) for (const m of S.ctx.inter) { const u = m.userData; m.visible = Math.abs(u.bx - p.x) < u.br && Math.abs(u.bz - p.z) < u.br; }
    if (ED.on || !started) continue;
    const t = EDK[o.k].type, d2 = (o.x - p.x) ** 2 + (o.z - p.z) ** 2;
    if (t === 'animal' && v.herd && d2 < 250 * 250) {
      const herd = v.herd;
      for (let i = 0; i < herd.members.length; i++) {
        const an = herd.members[i];
        if (an.active && an.herd === herd) continue;                       // still out there
        if (an.herd === herd && an.state === 'dead') { if (!an.backAt) an.backAt = T_GAME + 300; if (T_GAME < an.backAt) continue; }
        const a = i * 2.4, nb = makeAnimal(EDK[o.k].an, o.x + Math.cos(a) * 2, o.z + Math.sin(a) * 2);
        if (nb) { nb.herd = herd; nb.ed = o; nb.backAt = 0; herd.members[i] = nb; }
      }
    }
    if (t === 'pickup' && v.taken && T_GAME > v.taken) { v.taken = 0; if (v.prop) v.prop.visible = true; v.root.visible = true; }
    if (t === 'crate' && d2 < 60 * 60 && !v.crate && T_GAME > (v.again || 0)) {
      const kind = ['military', 'home', 'med', 'farm', 'chest'][o.c % 5], items = []; let coins = 0;
      for (const [id, pr, a, b] of LOOT[kind] || []) if (rand() < pr) { const n = a + Math.floor(rand() * (b - a + 1)); if (id === 'coins') coins += n; else items.push([id, n]); }
      if (typeof lootExtras === 'function') lootExtras(kind, items);
      v.root.visible = false;
      v.crate = makeCrate(o.x, o.z, items.length ? items : [['bandage', 1]], { coins, name: EDK[o.k].name, life: 3600, y: o.y, ry: o.ry });
      v.again = T_GAME + 900;
    }
    if (t === 'crate' && v.crate && !CRATES.includes(v.crate)) { v.crate = null; }
  }
}
UPDATERS.push((t, dt) => edLive(dt));
/* the use button near a gate or a stand */
function edUseNear(p, cand) {
  if (ED.on || !ED.objs.length) return;
  for (const o of ED.objs) {
    const v = o.v; if (!v) continue;
    const d = EDK[o.k], dist = Math.hypot(o.x - p.x, o.z - p.z);
    if (d.use === 'gate' && dist < Math.max(3, o.w * 0.6) && Math.abs(o.y - p.y) < 2.5) cand('ed', o.open ? 'أغلق البوابة' : 'افتح البوابة', o, dist);
    else if (d.type === 'pickup' && !v.taken && dist < 1.9 && Math.abs(o.y - p.y) < 2) cand('ed', 'خذ ' + d.name, o, dist - 0.3);
  }
}
function edUse(o) {
  const d = EDK[o.k], v = o.v; if (!v) return;
  if (d.use === 'gate') { o.open = !o.open; edRebuild(o); AUDIO.door(); return; }
  if (d.type === 'pickup' && !v.taken) {
    const got = [];
    for (const [id, n] of d.give) { if (!ITEMS[id]) continue; const k = invAdd(id, n, true); if (k > 0) got.push(toAr(k) + ' ' + ITEMS[id].name); if (k < n) dropItems(player.pos.x, player.pos.y, player.pos.z, [[id, n - k]], { life: 300 }); }
    v.taken = T_GAME + 600; if (v.prop) v.prop.visible = false; if (!d.prop) v.root.visible = false;
    toast('أخذت ' + got.slice(0, 3).join('، '), ''); AUDIO.pickup(true); hudDirty = true;
  }
}
/* where everyone starts, when the editor has set it */
function edSpawn() { for (const o of ED.objs) if (o.k === 'B_spawn') return { x: o.x, z: o.z, ry: o.ry }; return null; }
