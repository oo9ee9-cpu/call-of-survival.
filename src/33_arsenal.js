/* ═════════ the arsenal: thirty-odd firearms in nine families (assault rifles, marksman rifles, sniper rifles, submachine guns,
   light machine guns, shotguns, pistols, the crossbow, the flare gun) plus C4 — each with its own feel: damage, rate of fire,
   magazine, reload, reach, recoil and fire modes. Found in houses, bases and air drops, or made at the gun bench. Scopes, muzzles,
   grips, magazines and stocks fit the guns that take them. ═════════ */
const GUN_CLASS = {
  ar: { name: 'بندقية هجومية', anim: 'rifle', head: 2.3, spread: 0.0055, hipK: 2.6, slots: ['sight', 'muzzle', 'grip', 'mag', 'stock'] },
  dmr: { name: 'بندقية رامي', anim: 'rifle', head: 2.35, spread: 0.002, hipK: 3.4, slots: ['sight', 'muzzle', 'mag', 'stock'] },
  sr: { name: 'بندقية قنص', anim: 'sniper', head: 2.5, spread: 0.0007, hipK: 6, slots: ['sight', 'muzzle', 'mag', 'stock'] },
  smg: { name: 'رشاش صغير', anim: 'rifle', head: 1.8, spread: 0.008, hipK: 1.6, slots: ['sight', 'muzzle', 'grip', 'mag', 'stock'] },
  lmg: { name: 'رشاش خفيف', anim: 'rifle', head: 2.3, spread: 0.008, hipK: 2.8, slots: ['sight', 'mag'] },
  sg: { name: 'بندقية خرطوش', anim: 'shotgun', head: 1.5, spread: 0.055, hipK: 1, slots: ['muzzle'] },
  pistol: { name: 'مسدس', anim: 'pistol', head: 2.0, spread: 0.009, hipK: 1.5, slots: ['sight', 'muzzle', 'mag'] },
  special: { name: 'سلاح خاص', anim: 'rifle', head: 2.4, spread: 0.002, hipK: 2, slots: ['sight'] },
};
/* stats: dmg per bullet (per pellet for shotguns), rate = seconds between shots, mag, reload (s), range (m), kick = recoil per shot,
   modes: a (auto) b (burst) s (single); rare = how often loot finds it (0 = air drops only) */
const WEAPONS = {
  m416: { name: 'M416', cls: 'ar', ammo: 'ammo556', dmg: 41, rate: 0.086, mag: 30, reload: 2.1, range: 170, kick: 0.010, modes: 'as', rare: 0.9, price: 900, model: { body: 'ar', stock: 'tactical', mag: 'stanag', len: 0.84, col: 0x1f2224 } },
  akm: { name: 'AKM', cls: 'ar', ammo: 'ammo762', dmg: 47, rate: 0.1, mag: 30, reload: 2.4, range: 160, kick: 0.016, modes: 'as', rare: 1, price: 850, model: { body: 'ak', stock: 'wood', mag: 'curved', len: 0.88, col: 0x2a2826, wood: 0x7a4626 } },
  scarl: { name: 'SCAR-L', cls: 'ar', ammo: 'ammo556', dmg: 41, rate: 0.096, mag: 30, reload: 2.2, range: 170, kick: 0.009, modes: 'as', rare: 0.9, price: 900, model: { body: 'scar', stock: 'folding', mag: 'stanag', len: 0.86, col: 0xb39a72 } },
  m16a4: { name: 'M16A4', cls: 'ar', ammo: 'ammo556', dmg: 41, rate: 0.075, mag: 30, reload: 2.1, range: 190, kick: 0.009, modes: 'bs', burst: 3, rare: 0.9, price: 820, model: { body: 'ar', stock: 'fixed', mag: 'stanag', len: 1.0, col: 0x1e2022, handle: true } },
  qbz: { name: 'QBZ95', cls: 'ar', ammo: 'ammo556', dmg: 41, rate: 0.092, mag: 30, reload: 2.6, range: 160, kick: 0.0095, modes: 'as', rare: 0.7, price: 880, model: { body: 'bullpup', mag: 'stanag', len: 0.76, col: 0x2c2f2a, handle: true } },
  mk47: { name: 'Mk47 Mutant', cls: 'ar', ammo: 'ammo762', dmg: 49, rate: 0.1, mag: 20, reload: 2.4, range: 190, kick: 0.013, modes: 'bs', burst: 2, rare: 0.6, price: 950, model: { body: 'ar', stock: 'tactical', mag: 'curved', len: 0.9, col: 0x2b2e30 } },
  m762: { name: 'M762', cls: 'ar', ammo: 'ammo762', dmg: 47, rate: 0.086, mag: 30, reload: 2.6, range: 160, kick: 0.017, modes: 'abs', burst: 3, rare: 0.7, price: 950, model: { body: 'ak', stock: 'folding', mag: 'curved', len: 0.9, col: 0x262624 } },
  groza: { name: 'Groza', cls: 'ar', ammo: 'ammo762', dmg: 47, rate: 0.08, mag: 30, reload: 2.8, range: 150, kick: 0.014, modes: 'as', rare: 0, price: 1600, model: { body: 'bullpup', mag: 'curved', len: 0.72, col: 0x1d1f20, wood: 0x6a3e22 } },
  aug: { name: 'AUG A3', cls: 'ar', ammo: 'ammo556', dmg: 41, rate: 0.085, mag: 30, reload: 2.4, range: 180, kick: 0.008, modes: 'as', rare: 0.25, price: 1300, model: { body: 'aug', mag: 'stanag', len: 0.8, col: 0x4a5a3c } },
  mini14: { name: 'Mini 14', cls: 'dmr', ammo: 'ammo556', dmg: 48, rate: 0.13, mag: 20, reload: 2.5, range: 280, kick: 0.012, modes: 's', rare: 0.6, price: 1000, model: { body: 'classic', stock: 'wood', mag: 'stanag', len: 0.95, col: 0x2a2a2c, wood: 0x6e4428 } },
  sks: { name: 'SKS', cls: 'dmr', ammo: 'ammo762', dmg: 55, rate: 0.14, mag: 10, reload: 2.8, range: 280, kick: 0.02, modes: 's', rare: 0.5, price: 1050, model: { body: 'classic', stock: 'wood', mag: 'box', len: 1.02, col: 0x2a2826, wood: 0x7a4a2a } },
  slr: { name: 'SLR', cls: 'dmr', ammo: 'ammo762', dmg: 58, rate: 0.14, mag: 10, reload: 2.6, range: 290, kick: 0.022, modes: 's', rare: 0.4, price: 1150, model: { body: 'classic', stock: 'fixed', mag: 'box', len: 1.08, col: 0x252728 } },
  vss: { name: 'VSS', cls: 'dmr', ammo: 'ammo9', dmg: 40, rate: 0.086, mag: 10, reload: 2.6, range: 170, kick: 0.007, modes: 'as', rare: 0.35, price: 1100, quiet: true, scope: 4, model: { body: 'vss', stock: 'skeleton', mag: 'box', len: 0.9, col: 0x2a2826, wood: 0x6a3e22 } },
  awm: { name: 'AWM', cls: 'sr', ammo: 'ammo300', dmg: 120, rate: 1.85, mag: 5, reload: 4.0, range: 700, kick: 0.05, modes: 's', bolt: true, rare: 0, price: 2400, model: { body: 'bolt', stock: 'fixed', mag: 'box', len: 1.2, col: 0x3c4a32 } },
  m24: { name: 'M24', cls: 'sr', ammo: 'ammo762', dmg: 79, rate: 1.8, mag: 5, reload: 4.2, range: 550, kick: 0.04, modes: 's', bolt: true, rare: 0.35, price: 1500, model: { body: 'bolt', stock: 'fixed', mag: 'none', len: 1.1, col: 0x2a2c2e } },
  kar98: { name: 'Kar98k', cls: 'sr', ammo: 'ammo762', dmg: 79, rate: 1.9, mag: 5, reload: 4.0, range: 520, kick: 0.045, modes: 's', bolt: true, rare: 0.5, price: 1300, model: { body: 'bolt', stock: 'wood', mag: 'none', len: 1.12, col: 0x262626, wood: 0x6a3c20 } },
  win94: { name: 'Winchester', cls: 'sr', ammo: 'ammo45', dmg: 66, rate: 0.6, mag: 8, reload: 4.0, range: 220, kick: 0.03, modes: 's', bolt: true, rare: 0.6, price: 700, model: { body: 'lever', stock: 'wood', mag: 'tube', len: 0.98, col: 0x2a2826, wood: 0x8a5228 } },
  uzi: { name: 'Micro UZI', cls: 'smg', ammo: 'ammo9', dmg: 26, rate: 0.048, mag: 25, reload: 1.9, range: 70, kick: 0.007, modes: 'as', rare: 1, price: 520, model: { body: 'uzi', stock: 'skeleton', mag: 'grip', len: 0.48, col: 0x1e2022 } },
  ump: { name: 'UMP9', cls: 'smg', ammo: 'ammo9', dmg: 35, rate: 0.092, mag: 25, reload: 2.0, range: 90, kick: 0.0065, modes: 'abs', burst: 2, rare: 1, price: 560, model: { body: 'smg', stock: 'folding', mag: 'stick', len: 0.66, col: 0x232526 } },
  vector: { name: 'Vector', cls: 'smg', ammo: 'ammo9', dmg: 31, rate: 0.055, mag: 13, reload: 1.8, range: 80, kick: 0.006, modes: 'abs', burst: 2, rare: 0.8, price: 640, model: { body: 'vector', stock: 'tactical', mag: 'stick', len: 0.62, col: 0x1c1d1e } },
  tommy: { name: 'Tommy Gun', cls: 'smg', ammo: 'ammo45', dmg: 40, rate: 0.086, mag: 30, reload: 2.4, range: 85, kick: 0.009, modes: 'as', rare: 0.8, price: 600, model: { body: 'tommy', stock: 'wood', mag: 'drum', len: 0.86, col: 0x2a2826, wood: 0x7a4626 } },
  m249: { name: 'M249', cls: 'lmg', ammo: 'ammo556', dmg: 45, rate: 0.075, mag: 100, reload: 6.5, range: 170, kick: 0.012, modes: 'a', rare: 0.15, price: 1900, model: { body: 'lmg', stock: 'fixed', mag: 'boxbelt', len: 1.04, col: 0x2a2c2e } },
  dp28: { name: 'DP-28', cls: 'lmg', ammo: 'ammo762', dmg: 51, rate: 0.109, mag: 47, reload: 4.5, range: 170, kick: 0.012, modes: 'a', rare: 0.45, price: 1200, model: { body: 'dp', stock: 'wood', mag: 'pan', len: 1.1, col: 0x2a2826, wood: 0x6a3c20 } },
  s1897: { name: 'S1897', cls: 'sg', ammo: 'shells', dmg: 26, pellets: 9, rate: 0.75, mag: 5, reload: 4.0, range: 45, kick: 0.035, modes: 's', pump: true, rare: 1, price: 420, model: { body: 'pump', stock: 'wood', mag: 'tube', len: 1.0, col: 0x2a2826, wood: 0x7a4626 } },
  s686: { name: 'S686', cls: 'sg', ammo: 'shells', dmg: 26, pellets: 9, rate: 0.2, mag: 2, reload: 2.5, range: 45, kick: 0.04, modes: 's', rare: 1, price: 380, model: { body: 'double', stock: 'wood', mag: 'none', len: 1.02, col: 0x3a3632, wood: 0x6a3c20 } },
  s12k: { name: 'S12K', cls: 'sg', ammo: 'shells', dmg: 24, pellets: 9, rate: 0.25, mag: 5, reload: 3.0, range: 40, kick: 0.035, modes: 's', rare: 0.8, price: 560, model: { body: 'ak', stock: 'fixed', mag: 'box', len: 0.95, col: 0x232425 } },
  sawed: { name: 'Sawed-off', cls: 'sg', ammo: 'shells', dmg: 22, pellets: 9, rate: 0.25, mag: 2, reload: 2.0, range: 25, kick: 0.04, modes: 's', rare: 0.9, price: 260, model: { body: 'sawed', stock: 'none', mag: 'none', len: 0.5, col: 0x3a3632, wood: 0x6a3c20 } },
  p18c: { name: 'P18C', cls: 'pistol', ammo: 'ammo9', dmg: 23, rate: 0.06, mag: 17, reload: 1.7, range: 50, kick: 0.007, modes: 'as', rare: 1, price: 220, model: { body: 'pistol', len: 0.2, col: 0x1d1f20 } },
  p92: { name: 'P92', cls: 'pistol', ammo: 'ammo9', dmg: 35, rate: 0.135, mag: 15, reload: 1.7, range: 60, kick: 0.008, modes: 's', rare: 1, price: 200, model: { body: 'pistol', len: 0.22, col: 0x232526 } },
  p1911: { name: 'P1911', cls: 'pistol', ammo: 'ammo45', dmg: 41, rate: 0.11, mag: 7, reload: 1.7, range: 60, kick: 0.012, modes: 's', rare: 1, price: 220, model: { body: 'pistol', len: 0.22, col: 0x8a8f94 } },
  r45: { name: 'R45', cls: 'pistol', ammo: 'ammo45', dmg: 55, rate: 0.4, mag: 6, reload: 2.0, range: 60, kick: 0.02, modes: 's', rare: 0.6, price: 300, model: { body: 'revolver', len: 0.26, col: 0x2a2c2e } },
  r1895: { name: 'R1895', cls: 'pistol', ammo: 'ammo762', dmg: 62, rate: 0.4, mag: 7, reload: 2.5, range: 60, kick: 0.022, modes: 's', rare: 0.6, price: 320, model: { body: 'revolver', len: 0.3, col: 0x3a3632, wood: 0x6a3c20 } },
  crossbow: { name: 'النشّاب', cls: 'special', ammo: 'bolts', dmg: 105, rate: 1.4, mag: 1, reload: 3.5, range: 140, kick: 0.02, modes: 's', quiet: true, rare: 0.4, price: 420, model: { body: 'crossbow', len: 0.8, col: 0x2a2c2e, wood: 0x6a4428 } },
  flare: { name: 'مسدس الإشارة', cls: 'special', ammo: 'flare', dmg: 0, rate: 1, mag: 1, reload: 2.0, range: 0, kick: 0.02, modes: 's', rare: 0.12, price: 1500, flare: true, model: { body: 'flare', len: 0.28, col: 0xe0702a } },
};
/* the guns of the first version still work: each became one of the new ones */
// two guns wear the models the game's owner sent: the Rainier AK (skartemka, CC-BY-NC 4.0) and the 9 mm (Slava Zemlyanik)
WEAPONS.akm.prop = 'w_ak'; WEAPONS.p92.prop = 'w_9mm';
const GUN_ALIAS = { pistol: 'p92', revolver: 'r1895', smg: 'ump', rifle: 'akm', shotgun: 's1897', hunting: 'win94', sniper: 'kar98' };
const AMMO_NEW = [['ammo45', 'طلقات ‎.45‎', R('copper', 1, 'gunpowder', 1), 15, 3], ['ammo300', 'طلقات ماغنوم ‎.300‎', R('brass', 1, 'gunpowder', 2), 5, 14], ['bolts', 'سهام النشّاب', R('iron', 1, 'wood', 1, 'feather', 1), 5, 3], ['flare', 'طلقة إشارة', R('gunpowder', 2, 'sulfur', 1, 'dye_red', 1), 1, 120]];
item('brass', 'نحاس أصفر', 'mat', { color: 0xc9a24a, recipe: R('copper', 2, 'scrap', 1), station: 'furnace', price: 10, w: 0.3, icon: 'ingot' });
for (const [id, name, recipe, out, price] of AMMO_NEW) item(id, name, 'ammo', { color: id === 'flare' ? 0xe0702a : 0xc9a24a, recipe, out, station: 'gunbench', w: id === 'flare' ? 0.2 : 0.02, price, icon: id === 'bolts' ? 'arrow' : 'ammo', rare: id === 'flare' });
for (const id of ['ammo9', 'ammo556', 'ammo762', 'shells']) { const r = RECIPES.find((q) => q.id === id); if (r) r.station = 'gunbench'; ITEMS[id].station = 'gunbench'; }
ITEMS.ammo556.name = 'طلقات ٥٫٥٦'; ITEMS.ammo762.name = 'طلقات ٧٫٦٢'; ITEMS.ammo9.name = 'طلقات ٩ ملم'; ITEMS.shells.name = 'خرطوش عيار ١٢';
const AMMO_AR = { ammo556: '٥٫٥٦', ammo762: '٧٫٦٢', ammo9: '٩ ملم', ammo45: '‎.45‎', ammo300: '‎.300‎ ماغنوم', shells: 'عيار ١٢', bolts: 'سهام', flare: 'إشارة' };
// the bench that makes guns, scopes and ammunition
{
  const fid = 'gunbench', recipe = R('steel', 6, 'plank', 6, 'gear', 2, 'nails', 4);
  item('f_' + fid, 'طاولة الأسلحة', 'build', { color: 0x5a5e62, recipe, station: 'workbench', w: 4, price: 260, icon: 'station', place: { kind: fid, color: 0x5a5e62, station: fid } });
}
STATION_AR.gunbench = 'طاولة الأسلحة'; STATION_AR.stove = 'موقد الطبخ';
/* every weapon is an item: its recipe grows with its class */
const GUN_RECIPE = {
  ar: () => R('steel', 10, 'spring', 3, 'gear', 3, 'pipe', 2), dmr: () => R('steel', 11, 'spring', 2, 'gear', 3, 'pipe', 2, 'lens', 1), sr: () => R('steel', 12, 'spring', 2, 'gear', 4, 'pipe', 2, 'lens', 2),
  smg: () => R('steel', 7, 'spring', 2, 'gear', 2, 'pipe', 1), lmg: () => R('steel', 16, 'spring', 4, 'gear', 5, 'pipe', 3), sg: () => R('steel', 6, 'spring', 1, 'pipe', 2, 'plank', 2),
  pistol: () => R('steel', 3, 'spring', 1, 'gear', 1), special: () => R('steel', 4, 'spring', 2, 'plank', 3, 'rope', 2),
};
for (const [wid, w] of Object.entries(WEAPONS)) {
  const C0 = GUN_CLASS[w.cls];
  w.id = wid; w.head = w.head || C0.head; w.spread = w.spread || C0.spread; w.pellets = w.pellets || 1; w.anim = w.bolt && w.cls === 'sr' ? 'sniper' : C0.anim;
  if (wid === 'crossbow' || wid === 'flare') w.anim = wid === 'flare' ? 'pistol' : 'rifle';
  const recipe = wid === 'awm' || wid === 'groza' ? null : wid === 'flare' ? R('steel', 2, 'plastic_part', 2, 'spring', 1) : GUN_RECIPE[w.cls]();
  item('gun_' + wid, w.name, 'weapon', { tool: w.anim, gun: true, gunId: wid, dmgMul: 1, color: w.model.col, recipe, station: recipe ? 'gunbench' : null, w: w.cls === 'pistol' ? 1 : w.cls === 'lmg' ? 6 : w.cls === 'smg' ? 2.5 : 3.6, price: w.price, icon: w.cls === 'pistol' || wid === 'flare' ? 'pistol' : w.cls === 'sg' ? 'shotgun' : w.cls === 'sr' || w.cls === 'dmr' ? 'sniper' : 'rifle', rare: w.rare <= 0.3, tierRank: w.rare === 0 ? 4 : w.rare < 0.5 ? 3 : 1 });
}
item('plastic_part', 'قطع بلاستيكية', 'mat', { color: 0x2a2c2e, recipe: R('oil', 1), station: 'furnace', price: 4, w: 0.1, icon: 'ingot' });
for (const [old, nw] of Object.entries(GUN_ALIAS)) { const it = ITEMS[old]; if (it) { it.gunId = nw; it.tool = WEAPONS[nw].anim; it.name = it.name + ' (' + WEAPONS[nw].name + ')'; } }
/* attachments: what they do and which guns take them */
const ATTACH_DEF = {
  att_reddot: { name: 'منظار النقطة الحمراء', slot: 'sight', zoom: 1.15, ret: 'dot', recipe: R('lens', 1, 'steel', 1, 'battery', 1), price: 120 },
  att_holo: { name: 'منظار هولوغرافي', slot: 'sight', zoom: 1.15, ret: 'holo', recipe: R('lens', 1, 'steel', 1, 'battery', 1), price: 130 },
  att_2x: { name: 'منظار ٢×', slot: 'sight', zoom: 2, ret: 'cross', recipe: R('lens', 2, 'steel', 1), price: 180 },
  att_3x: { name: 'منظار ٣×', slot: 'sight', zoom: 3, ret: 'chevron', recipe: R('lens', 2, 'steel', 2), price: 240 },
  att_4x: { name: 'منظار ٤×', slot: 'sight', zoom: 4, ret: 'acog', recipe: R('lens', 3, 'steel', 2), price: 320 },
  att_6x: { name: 'منظار ٦×', slot: 'sight', zoom: 6, ret: 'mil', recipe: R('lens', 3, 'steel', 3, 'gear', 1), price: 420 },
  att_8x: { name: 'منظار ٨×', slot: 'sight', zoom: 8, ret: 'mil', recipe: R('lens', 4, 'steel', 3, 'gear', 1, 'circuit', 1), price: 560, rare: true },
  att_comp: { name: 'معوّض الارتداد', slot: 'muzzle', kickV: 0.75, kickH: 0.75, recipe: R('steel', 2), price: 120 },
  att_flash: { name: 'مخفي اللهب', slot: 'muzzle', kickV: 0.9, kickH: 0.9, noflash: true, recipe: R('steel', 2), price: 100 },
  att_supp: { name: 'كاتم الصوت', slot: 'muzzle', quiet: true, noflash: true, recipe: R('steel', 3, 'cloth', 2, 'pipe', 1), price: 260 },
  att_choke: { name: 'مضيّق الخرطوش', slot: 'muzzle', spreadK: 0.7, recipe: R('steel', 2), price: 90, only: ['sg'] },
  att_vgrip: { name: 'قبضة عمودية', slot: 'grip', kickV: 0.8, recipe: R('plastic_part', 2, 'steel', 1), price: 110 },
  att_agrip: { name: 'قبضة مائلة', slot: 'grip', kickH: 0.75, adsK: 1.3, recipe: R('plastic_part', 2, 'steel', 1), price: 110 },
  att_lgrip: { name: 'قبضة خفيفة', slot: 'grip', recover: 1.35, kickV: 0.9, recipe: R('plastic_part', 2), price: 90 },
  att_extmag: { name: 'مخزن موسّع', slot: 'mag', magK: 1.4, recipe: R('steel', 2, 'spring', 1), price: 150 },
  att_quickmag: { name: 'مخزن سريع التعبئة', slot: 'mag', reloadK: 0.72, recipe: R('steel', 2, 'spring', 1), price: 140 },
  att_extquick: { name: 'مخزن موسّع سريع', slot: 'mag', magK: 1.4, reloadK: 0.75, recipe: R('steel', 3, 'spring', 2), price: 260, rare: true },
  att_stock: { name: 'أخمص تكتيكي', slot: 'stock', kickV: 0.9, sway: 0.7, recipe: R('plastic_part', 2, 'steel', 1), price: 120, only: ['ar', 'smg'] },
  att_cheek: { name: 'وسادة الخد', slot: 'stock', kickV: 0.85, sway: 0.6, recipe: R('cloth', 2, 'plastic_part', 1), price: 120, only: ['sr', 'dmr'] },
};
const GSLOT_AR = { sight: 'المنظار', muzzle: 'الفوهة', grip: 'القبضة', mag: 'المخزن', stock: 'الأخمص' };
for (const [id, a] of Object.entries(ATTACH_DEF)) item(id, a.name, 'weapon', { attach: a.slot, color: 0x3a3e42, recipe: a.recipe, station: 'gunbench', w: 0.3, price: a.price, icon: a.slot === 'sight' ? 'detector' : 'item', rare: !!a.rare });
CATS.splice(5, 0, ['attach', 'ملحقات']);
for (const id of Object.keys(ATTACH_DEF)) ITEMS[id].cat = 'attach';
/* C4: thrown, it sticks where it lands and goes off five seconds later */
item('c4', 'متفجّر C4', 'weapon', { tool: 'throw', throwKind: 'c4', color: 0x8a8a6a, recipe: R('gunpowder', 6, 'wire', 2, 'battery', 1, 'clay', 2), station: 'gunbench', w: 1, price: 380, icon: 'item', rare: true });
item('frag', 'قنبلة يدوية', 'weapon', { tool: 'throw', throwKind: 'frag', color: 0x4a5a3a, recipe: R('gunpowder', 3, 'iron', 2, 'spring', 1), station: 'gunbench', w: 0.5, price: 120, icon: 'item' });
// a bigger backpack, helmets and vests in three levels, PUBG-style
for (const [lv, name, armor, c] of [[1, 'المستوى ١', 0.8, 0x6a6e5a], [2, 'المستوى ٢', 0.65, 0x4a5a3a], [3, 'المستوى ٣', 0.5, 0x2a2e2a]]) {
  item('helmet_l' + lv, 'خوذة ' + name, 'wear', { color: c, wear: { slot: 'hat', acc: 'helmet', c, armor }, recipe: R('steel', 2 + lv * 2, 'leather', 1), station: 'gunbench', w: 1 + lv * 0.4, price: 60 * lv * lv, icon: 'helmet', tierRank: lv, rare: lv === 3 });
  item('vest_l' + lv, 'سترة واقية ' + name, 'wear', { color: c, wear: { slot: 'vest', c, armor }, recipe: R('steel', 3 + lv * 3, 'cloth', 3), station: 'gunbench', w: 2 + lv, price: 80 * lv * lv, icon: 'vest', tierRank: lv, rare: lv === 3 });
  item('pack_l' + lv, 'حقيبة ظهر ' + name, 'wear', { color: c, wear: { slot: 'pack', acc: lv === 3 ? 'bigpack' : 'pack', c, cap: 100 + lv * 90 }, recipe: R('cloth', 4 + lv * 2, 'leather', lv, 'rope', 2), station: 'tailor', w: 0.8 + lv * 0.3, price: 50 * lv * lv, icon: 'bag', tierRank: lv });
}

/* ── which gun is in your hand, with its attachments ── */
const ATTACH = {};          // per gun item: { sight, muzzle, grip, mag, stock } → attachment item ids
const gunOf = (it) => (it && WEAPONS[it.gunId]) || (it && GUN_ALIAS[it.id] && WEAPONS[GUN_ALIAS[it.id]]) || WEAPONS.akm;
function gunSlots(w) { return GUN_CLASS[w.cls].slots.filter((s) => !(s === 'stock' && w.cls === 'ar' && !['m416', 'mk47'].includes(w.id)) && !(s === 'grip' && w.cls === 'smg' && w.id === 'tommy') && !(w.id === 'vss' && (s === 'sight' || s === 'muzzle'))); }
function canAttach(w, aid) { const a = ATTACH_DEF[aid]; if (!a) return false; if (!gunSlots(w).includes(a.slot)) return false; if (a.only && !a.only.includes(w.cls)) return false; if (a.slot === 'muzzle' && w.cls === 'sg' && aid !== 'att_choke') return false; if (aid === 'att_choke' && w.cls !== 'sg') return false; if (a.slot === 'sight' && a.zoom > 4 && (w.cls === 'pistol' || w.cls === 'smg' || w.cls === 'sg')) return false; return true; }
const attOf = (id) => ATTACH[id] || (ATTACH[id] = {});
/* the numbers the trigger uses: the gun, changed by what is fitted to it */
const _spec = {};
function gunSpecOf(id) {
  const it = ITEMS[id], w = gunOf(it), at = attOf(id), s = _spec;
  Object.assign(s, w); s.kickV = w.kick; s.kickH = w.kick * 0.45; s.zoom = w.scope || 1; s.ret = w.scope ? 'acog' : null; s.flashOn = !w.quiet; s.loud = !w.quiet; s.recover = 1; s.adsK = 1; s.sway = 1; s.spreadK = 1;
  for (const slot of Object.keys(GSLOT_AR)) {
    const a = at[slot] && ATTACH_DEF[at[slot]]; if (!a) continue;
    if (a.zoom) { s.zoom = a.zoom; s.ret = a.ret; }
    if (a.kickV) s.kickV *= a.kickV; if (a.kickH) s.kickH *= a.kickH;
    if (a.quiet) s.loud = false; if (a.noflash) s.flashOn = false;
    if (a.magK) s.mag = Math.round(w.mag * a.magK + (w.cls === 'pistol' ? 2 : 0)); if (a.reloadK) s.reload = w.reload * a.reloadK;
    if (a.recover) s.recover = a.recover; if (a.adsK) s.adsK = a.adsK; if (a.sway) s.sway = a.sway; if (a.spreadK) s.spreadK = a.spreadK;
  }
  s.item = id; return s;
}
function attachTo(gid, aid) {
  const it = ITEMS[gid]; if (!it || !it.gun) return false;
  const w = gunOf(it); if (!canAttach(w, aid)) { toast(ITEMS[aid].name + ' لا يركب على ' + w.name, ''); return false; }
  if (invCount(aid) <= 0) return false;
  const at = attOf(gid), slot = ATTACH_DEF[aid].slot;
  if (at[slot]) invAdd(at[slot], 1, true);
  invTake(aid, 1); at[slot] = aid; AUDIO.craft(); saveSoon(); refreshGunModel(gid);
  if (slot === 'mag' && MAGS[gid] > gunSpecOf(gid).mag) MAGS[gid] = gunSpecOf(gid).mag;
  toast('ركّبت ' + ITEMS[aid].name, 'على ' + w.name); return true;
}
function detachFrom(gid, slot) {
  const at = attOf(gid), aid = at[slot]; if (!aid) return false;
  if (invAdd(aid, 1, true) < 1) { toast('الحقيبة ممتلئة', ''); return false; }
  delete at[slot]; saveSoon(); refreshGunModel(gid);
  const m = gunSpecOf(gid).mag; if (MAGS[gid] > m) { invAdd(gunSpecOf(gid).ammo, MAGS[gid] - m, true); MAGS[gid] = m; }
  return true;
}
/* when a gun leaves you (a crate, a sale), what is fitted to it goes too */
function stripGun(gid, into) { const at = ATTACH[gid]; if (!at) return; for (const s of Object.keys(at)) { if (at[s]) into.push([at[s], 1]); } delete ATTACH[gid]; }
/* the fire mode switch */
const FIRE = { mode: {}, burstLeft: 0, held: false, latch: false };
function fireMode(id) { const w = gunOf(ITEMS[id]); const m = FIRE.mode[id]; return m && w.modes.includes(m) ? m : w.modes[0]; }
function nextFireMode() {
  const id = player.toolItem, it = ITEMS[id]; if (!it || !it.gun) return;
  const w = gunOf(it); if (w.modes.length < 2) { toast(w.name + ': طلقة واحدة فقط', ''); return; }
  const cur = fireMode(id), i = w.modes.indexOf(cur), nx = w.modes[(i + 1) % w.modes.length]; FIRE.mode[id] = nx;
  toast({ a: 'رشّ تلقائي', b: 'رشقة ' + toAr(w.burst || 3), s: 'طلقة طلقة' }[nx], w.name); AUDIO.ui(); hudDirty = true;
}

/* ── what the world holds: guns by place ── */
const GUN_IDS = Object.keys(WEAPONS);
function gunLoot(kind, luck = 1) {
  const pool = GUN_IDS.filter((id) => WEAPONS[id].rare > 0 && id !== 'flare' && (kind === 'home' ? ['pistol', 'sg', 'smg'].includes(WEAPONS[id].cls) || (WEAPONS[id].cls === 'ar' && rand() < 0.3) : kind === 'military' ? WEAPONS[id].cls !== 'pistol' || rand() < 0.3 : true));
  let tot = 0; for (const id of pool) tot += WEAPONS[id].rare; let r = rand() * tot;
  for (const id of pool) { r -= WEAPONS[id].rare; if (r <= 0) return id; }
  return pool[0];
}
const ATT_COMMON = ['att_reddot', 'att_holo', 'att_2x', 'att_3x', 'att_comp', 'att_flash', 'att_vgrip', 'att_agrip', 'att_lgrip', 'att_extmag', 'att_quickmag', 'att_stock', 'att_choke'];
const ATT_RARE = ['att_4x', 'att_6x', 'att_supp', 'att_extquick', 'att_cheek'];
function lootExtras(kind, out) {
  // a gun with a magazine or two for it, attachments, armour and drinks
  const gunP = { home: 0.22, military: 0.7, armory: 1, med: 0.04, farm: 0.08, zombie: 0.03, zombieBig: 0.2, chest: 0.05 }[kind] || 0;
  if (rand() < gunP) { const g = gunLoot(kind); out.push(['gun_' + g, 1]); out.push([WEAPONS[g].ammo, Math.round(WEAPONS[g].mag * (1 + rand() * 1.5))]); }
  const attP = { home: 0.1, military: 0.45, armory: 0.7, zombieBig: 0.1 }[kind] || 0;
  if (rand() < attP) out.push([rand() < (kind === 'armory' ? 0.35 : 0.15) ? pick(ATT_RARE) : pick(ATT_COMMON), 1]);
  const armP = { home: 0.08, military: 0.35, armory: 0.6 }[kind] || 0;
  if (rand() < armP) { const lv = rand() < (kind === 'armory' ? 0.3 : 0.08) ? 3 : rand() < 0.45 ? 2 : 1; out.push([pick(['helmet_l', 'vest_l', 'pack_l']) + lv, 1]); }
  const drinkP = { home: 0.4, military: 0.3, armory: 0.15, farm: 0.3 }[kind] || 0;
  if (rand() < drinkP) out.push([pick(['bottle_water', 'soda', 'juice_box', 'canned_beans', 'canned_meat', 'mre']), 1 + Math.floor(rand() * 2)]);
  if (kind === 'military' && rand() < 0.12) out.push([rand() < 0.5 ? 'frag' : 'c4', 1]);
  if ((kind === 'armory' || kind === 'military') && rand() < 0.04) out.push(['flare', 1], ['gun_flare', 1]);
  const bladeP = { home: 0.025, military: 0.05, armory: 0.08, chest: 0.12, zombieBig: 0.04 }[kind] || 0;
  if (rand() < bladeP) out.push([bladeLoot(), 1]);
}
/* one-of-a-kind blades and axes modelled by artists (Sketchfab, credited in the game's credits): rare finds in houses, barracks
   and treasure chests, or forged on the anvil. hit = how hard, swing = seconds per blow, reach = metres */
const PROP_MELEE = [
  ['mw_knife', 'السكين السوداء', 'knife', 1.7, 0.3, 1.7, 'm_knife', R('steel', 3, 'leather', 1), 260, 5],
  ['mw_axe', 'فأس الرونات', 'axe', 1.6, 0.62, 2.2, 'm_axe', R('steel', 4, 'plank', 2, 'leather', 1), 340, 4],
  ['mw_jian', 'سيف جيان', 'sword', 1.75, 0.46, 2.4, 'm_jian', R('steel', 6, 'leather', 2), 520, 3],
  ['mw_bardiche', 'البلطة الطويلة', 'spear', 1.9, 0.72, 3.0, 'm_bardiche', R('steel', 6, 'plank', 4, 'leather', 1), 640, 2],
  ['mw_battleaxe', 'فأس المعركة', 'axe', 2.4, 0.85, 2.4, 'm_battleaxe', R('steel', 8, 'gold', 2, 'leather', 2), 980, 1.2],
  ['mw_ornate', 'السيف المزخرف', 'sword', 2.2, 0.48, 2.5, 'm_ornate', R('steel', 6, 'gold', 3, 'diamond', 1), 1400, 0.8],
];
for (const [id, name, tool, hit, swing, reach, prop, recipe, price] of PROP_MELEE)
  item(id, name, 'weapon', { tool, tier: 'steel', hit, swing, reach, prop, dmgMul: hit, color: 0x9aa1a8, recipe, station: 'anvil', w: tool === 'knife' ? 0.6 : 2.5, price, icon: tool, rare: true });
function bladeLoot() {
  let tot = 0; for (const r of PROP_MELEE) tot += r[9]; let x = rand() * tot;
  for (const r of PROP_MELEE) { x -= r[9]; if (x <= 0) return r[0]; }
  return PROP_MELEE[0][0];
}
/* the bots' kit: a gun of their kind and its ammunition */
function botKit(b) {
  const g = b.gunKind === 'pistol' ? pick(['p92', 'p1911', 'p18c', 'r45']) : b.gunKind === 'shotgun' ? pick(['s1897', 's686', 's12k']) : b.type === 'bandit' ? gunLoot('military') : gunLoot('home');
  const out = [['gun_' + g, 1], [WEAPONS[g].ammo, Math.round(WEAPONS[g].mag * (0.5 + rand()))]];
  if (rand() < 0.5) out.push([pick(['bandage', 'bandage', 'medkit', 'painkiller', 'energy_drink']), 1 + Math.floor(rand() * 2)]);
  if (rand() < 0.35) out.push([pick(['bottle_water', 'soda', 'canned_meat', 'bread']), 1]);
  if (b.type === 'bandit' && rand() < 0.4) out.push([pick(['helmet_l1', 'vest_l1', 'helmet_l2', 'vest_l2', 'att_reddot', 'att_2x', 'att_extmag']), 1]);
  return out;
}
/* the old armoury tables now carry the new guns */
for (const t of Object.values(LOOT)) for (const row of t) if (GUN_ALIAS[row[0]]) row[0] = 'gun_' + GUN_ALIAS[row[0]];
/* a gun you pick up goes into a free hotbar slot */
function assignFreeSlot(id) {
  if (INV.slots.includes(id)) return;
  const i = INV.slots.findIndex((s, k) => k > 0 && (!s || !ownsTool(s)));
  if (i > 0) assignSlot(i, id);
}
