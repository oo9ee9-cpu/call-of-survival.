/* ═════════ the meta game: crates of outfits by rarity (common to mythic) opened one or ten at a time, crate shards (ten make a
   crate), upgradable weapon skins with seven levels, more than sixty titles from easy to legendary, daily and weekly missions with
   activity chests. Everything is earned by playing: gold, gems, shards and upgrade materials all come from the island. ═════════ */
const RARITY = {
  common: { ar: 'عادي', col: '#9aa4ac', bg: 'linear-gradient(160deg,#5a646c,#2e3439)' },
  rare: { ar: 'نادر', col: '#3d8ee8', bg: 'linear-gradient(160deg,#2f6fc0,#16294a)' },
  epic: { ar: 'ملحمي', col: '#a35ce8', bg: 'linear-gradient(160deg,#7a3fc8,#2a1846)' },
  legendary: { ar: 'أسطوري', col: '#f0a020', bg: 'linear-gradient(160deg,#d88a14,#4a2a08)' },
  mythic: { ar: 'ميثيك', col: '#ff3048', bg: 'linear-gradient(160deg,#e02840,#4a0a14)' },
};
const RAR_ORDER = ['common', 'rare', 'epic', 'legendary', 'mythic'];
Object.assign(PATTERN, { tiger: 6, flame: 7, digital: 8, carbon: 9, galaxy: 10, gold: 11 });
const rarOf = (it) => (it && it.rarity) || (it && it.gemPrice ? 'epic' : it && it.wear && it.wear.slot === 'suit' ? 'rare' : 'common');

/* ── outfits from the crates: full sets and single pieces, some glowing ── */
const CRATE_SUITS = [
  // id, name, rarity, parts { top, pants, shoes, hands: {c, p, a, glow} , hat, hatC, glasses, glassesC }
  ['phoenix', 'بدلة العنقاء', 'mythic', { top: { c: 0xd8401a, p: 'flame', a: 0.95, glow: 0.9 }, pants: { c: 0x2a1410, p: 'flame', a: 0.95, glow: 0.5 }, shoes: { c: 0x1a1210, a: 0.92 }, hands: { c: 0xd8401a, a: 0.92, glow: 0.4 }, glasses: 'sunglasses', glassesC: 0xb8902a }],
  ['fire_tiger', 'بدلة النمر الناري', 'mythic', { top: { c: 0xe8801a, p: 'tiger', a: 0.95, glow: 0.6 }, pants: { c: 0xe8801a, p: 'tiger', a: 0.95, glow: 0.3 }, shoes: { c: 0x111111, a: 0.92 }, hands: { c: 0x111111, a: 0.92 }, hat: 'bandana', hatC: 0xe8801a }],
  ['galaxy', 'بدلة المجرّة', 'mythic', { top: { c: 0x2a1a5a, p: 'galaxy', a: 0.96, glow: 0.8 }, pants: { c: 0x1a1240, p: 'galaxy', a: 0.96, glow: 0.6 }, shoes: { c: 0xe8e6f0, a: 0.9 }, hands: { c: 0x2a1a5a, a: 0.9 }, glasses: 'goggles', glassesC: 0x5a3aa8 }],
  ['pharaoh', 'بدلة الفرعون الذهبية', 'mythic', { top: { c: 0xd8b04a, p: 'gold', a: 0.96, glow: 0.35 }, pants: { c: 0x101418, a: 0.95 }, shoes: { c: 0xd8b04a, p: 'gold', a: 0.92 }, hands: { c: 0xd8b04a, p: 'gold', a: 0.92 }, hat: 'shemagh', hatC: 0x2a4a8a }],
  ['desert_falcon', 'صقر الصحراء', 'legendary', { top: { c: 0xc8b080, p: 'desert', a: 0.94 }, pants: { c: 0xb09868, p: 'desert', a: 0.94 }, shoes: { c: 0x6b4a2f, a: 0.9 }, hands: { c: 0x8a6a45, a: 0.9 }, hat: 'shemagh', hatC: 0xe8e0d0, glasses: 'goggles', glassesC: 0x6b4a2f }],
  ['night_ninja', 'نينجا الليل', 'legendary', { top: { c: 0x18181c, p: 'carbon', a: 0.96, glow: 0.15 }, pants: { c: 0x141418, p: 'carbon', a: 0.96 }, shoes: { c: 0x0c0c0e, a: 0.94 }, hands: { c: 0x0c0c0e, a: 0.94 }, hat: 'bandana', hatC: 0x8a1a1a }],
  ['ice_queen', 'ملكة الجليد', 'legendary', { top: { c: 0xbfe8f4, p: 'digital', a: 0.94, glow: 0.25 }, pants: { c: 0x9ad0e8, p: 'digital', a: 0.94 }, shoes: { c: 0xf0f4f8, a: 0.9 }, hands: { c: 0xd8f0f8, a: 0.9 }, hat: 'beanie', hatC: 0xf0f4f8, glasses: 'goggles', glassesC: 0x3a7a9a }],
  ['golden_knight', 'الفارس الذهبي', 'legendary', { top: { c: 0xc8a040, p: 'gold', a: 0.95 }, pants: { c: 0x1e1e20, a: 0.95 }, shoes: { c: 0xc8a040, a: 0.92 }, hands: { c: 0xc8a040, a: 0.92 }, hat: 'helmet', hatC: 0xc8a040 }],
  ['storm_trooper', 'جندي العاصفة', 'legendary', { top: { c: 0x4a5a6a, p: 'digital', a: 0.94 }, pants: { c: 0x3a4a5a, p: 'digital', a: 0.94 }, shoes: { c: 0x1e2226, a: 0.92 }, hands: { c: 0x1e2226, a: 0.92 }, hat: 'helmet', hatC: 0x3a4a5a, glasses: 'goggles', glassesC: 0x1e2226 }],
  ['urban_ops', 'العمليات المدنية', 'epic', { top: { c: 0x6a6e72, p: 'urban', a: 0.92 }, pants: { c: 0x3a3e42, p: 'urban', a: 0.92 }, shoes: { c: 0x1e1e20, a: 0.9 }, hands: { c: 0x1e1e20, a: 0.9 }, hat: 'cap', hatC: 0x2a2e32 }],
  ['forest_ghost', 'شبح الغابة', 'epic', { top: { c: 0x4a5a3a, p: 'camo', a: 0.94 }, pants: { c: 0x3e4a32, p: 'camo', a: 0.94 }, shoes: { c: 0x3b2b1f, a: 0.9 }, hands: { c: 0x3a3f2e, a: 0.9 }, hat: 'beanie', hatC: 0x3e4a32 }],
  ['racer', 'المتسابق', 'epic', { top: { c: 0xc8302a, p: 'stripes', a: 0.94 }, pants: { c: 0x1e1e20, a: 0.92 }, shoes: { c: 0xf0f0f0, a: 0.9 }, hands: { c: 0xc8302a, a: 0.9 }, hat: 'cap', hatC: 0xc8302a, glasses: 'sunglasses', glassesC: 0x111214 }],
  ['tiger_jungle', 'نمر الأدغال', 'epic', { top: { c: 0xc89a3a, p: 'tiger', a: 0.94 }, pants: { c: 0x4a4030, a: 0.92 }, shoes: { c: 0x3b2b1f, a: 0.9 }, hat: 'cowboy', hatC: 0x6b4a2f }],
  ['sea_captain', 'قبطان البحر', 'rare', { top: { c: 0x1f2a44, a: 0.92 }, pants: { c: 0xe8e6e0, a: 0.9 }, shoes: { c: 0x1e1e20, a: 0.9 }, hat: 'cap', hatC: 0xe8e6e0 }],
  ['mechanic', 'الميكانيكي', 'rare', { top: { c: 0x2f4a8a, a: 0.9 }, pants: { c: 0x2f4a8a, a: 0.9 }, shoes: { c: 0x3b2b1f, a: 0.9 }, hands: { c: 0x3a3a3a, a: 0.9 }, hat: 'cap', hatC: 0x2f4a8a }],
  ['farmer', 'المزارع', 'rare', { top: { c: 0x8a2a2a, p: 'checks', a: 0.9 }, pants: { c: 0x2f4a8a, a: 0.88 }, shoes: { c: 0x6b4a2f, a: 0.9 }, hat: 'cowboy', hatC: 0xc8b48a }],
  ['runner', 'العدّاء', 'rare', { top: { c: 0xe8e6e0, p: 'stripes', a: 0.9 }, pants: { c: 0x1f2a44, a: 0.9 }, shoes: { c: 0xd8702a, a: 0.9 } }],
];
for (const [sid, name, rarity, parts] of CRATE_SUITS) item('suit_' + sid, name, 'wear', { color: (parts.top && parts.top.c) || 0x888888, wear: { slot: 'suit', suit: parts }, price: 0, w: 0, icon: 'person', shopOnly: true, lobby: true, rarity, crate: true });
// single pieces with the new patterns
const PIECE_PATTERNS = [['tiger', 'نمري', 'epic'], ['flame', 'لهب', 'legendary'], ['digital', 'رقمي', 'rare'], ['carbon', 'كربوني', 'rare'], ['galaxy', 'مجرّي', 'legendary'], ['gold', 'ذهبي', 'epic']];
const PIECE_COLS = [[0xe8801a, 'برتقالي'], [0x2f6fc0, 'أزرق'], [0xc8302a, 'أحمر'], [0x3a6a3a, 'أخضر'], [0x6a3a8a, 'بنفسجي'], [0x1e1e20, 'أسود']];
PIECE_PATTERNS.forEach(([pid, pname, rarity], i) => {
  for (const [c, cname] of PIECE_COLS.slice(i % 3, i % 3 + 3)) {
    const glow = rarity === 'legendary' ? 0.4 : 0;
    item(`top_${pid}_${c.toString(16)}`, 'قميص ' + pname + ' ' + cname, 'wear', { color: c, wear: { slot: 'top', c, a: 0.94, p: pid, glow }, price: 0, w: 0.5, icon: 'shirt', shopOnly: true, rarity, crate: true });
    item(`pants_${pid}_${c.toString(16)}`, 'بنطال ' + pname + ' ' + cname, 'wear', { color: c, wear: { slot: 'pants', c, a: 0.94, p: pid, glow: glow * 0.6 }, price: 0, w: 0.5, icon: 'pants', shopOnly: true, rarity, crate: true });
  }
});
for (const [c, cname, rarity] of [[0xd8b04a, 'ذهبي', 'legendary'], [0xe8e6e0, 'أبيض فاخر', 'rare'], [0xc8302a, 'أحمر ناري', 'epic'], [0x2f6fc0, 'أزرق ملكي', 'epic']]) {
  item('shoes_lux_' + c.toString(16), 'حذاء ' + cname, 'wear', { color: c, wear: { slot: 'shoes', c, a: 0.92, p: rarity === 'legendary' ? 'gold' : 'solid' }, price: 0, w: 0.5, icon: 'shoe', shopOnly: true, rarity, crate: true });
  item('helm_lux_' + c.toString(16), 'خوذة ' + cname, 'wear', { color: c, wear: { slot: 'hat', acc: 'helmet', c }, price: 0, w: 0.3, icon: 'helmet', shopOnly: true, rarity, crate: true });
}
// parachutes: the canopy you open over the island
const CHUTE_SKINS = [['chute_blue', 'مظلة زرقاء', 'common', 0x3a6aa8, 0xe8e2d0], ['chute_red', 'مظلة حمراء', 'rare', 0xc8302a, 0xf0e8d8], ['chute_camo', 'مظلة مموّهة', 'rare', 0x4a5a3a, 0x8a7a5a], ['chute_tiger', 'مظلة النمر', 'epic', 0xe8801a, 0x111111], ['chute_gold', 'مظلة ذهبية', 'legendary', 0xd8b04a, 0x1e1e20], ['chute_galaxy', 'مظلة المجرّة', 'mythic', 0x3a1a7a, 0xe0c8ff]];
for (const [id, name, rarity, c1, c2] of CHUTE_SKINS) item(id, name, 'wear', { color: c1, wear: { slot: 'chute', c1, c2 }, price: 0, w: 0, icon: 'flag', shopOnly: true, rarity, crate: true });
COS_SLOTS.push('chute');
for (const id of ['suit_ranger', 'suit_polar', 'suit_medic', 'suit_cowboy', 'suit_sheikh', 'suit_hunter', 'suit_sailor']) if (ITEMS[id]) ITEMS[id].rarity = 'rare';
for (const id of ['suit_desert', 'suit_shadow']) if (ITEMS[id]) ITEMS[id].rarity = 'epic';
if (ITEMS.suit_gold) ITEMS.suit_gold.rarity = 'legendary';

/* ── upgradable weapon skins: seven levels each, upgraded with materials ── */
const WSKINS = {
  m416_tiger: { gun: 'm416', name: 'النمر الناري', rarity: 'mythic', c1: 0xe8801a, c2: 0x161616, c3: 0xffc040, stripes: true, fx: 0xff8a1a },
  akm_dragon: { gun: 'akm', name: 'التنين الأحمر', rarity: 'legendary', c1: 0x8a1a1a, c2: 0x1a1414, c3: 0xffb030, stripes: false, fx: 0xff4020 },
  kar98_wolf: { gun: 'kar98', name: 'ذئب الشتاء', rarity: 'legendary', c1: 0xd8e4ec, c2: 0x3a4a5a, c3: 0x8ad8ff, stripes: true, fx: 0x8ad8ff },
  groza_gold: { gun: 'groza', name: 'الذهب الأسود', rarity: 'mythic', c1: 0x1a1a1c, c2: 0xc8a040, c3: 0xffe08a, stripes: false, fx: 0xffd060 },
  uzi_neon: { gun: 'uzi', name: 'نيون الليل', rarity: 'epic', c1: 0x1e1030, c2: 0x40e0ff, c3: 0xff40c0, stripes: true, fx: 0x40e0ff },
  scar_jungle: { gun: 'scarl', name: 'أدغال الزمرد', rarity: 'epic', c1: 0x2a6a3a, c2: 0x1a2a1a, c3: 0x60ff90, stripes: true, fx: 0x60ff90 },
};
const WSKIN_LV = [
  ['الشكل الأساسي', 'ألوان الشكل على السلاح'], ['إعلان القتل', 'اسم الشكل يظهر حين تقتل'], ['صندوق الضحية', 'من تقتله يترك صندوقاً بلون الشكل'],
  ['شرارة الإصابة', 'أثر إصابة بلون الشكل'], ['خطوط مضيئة', 'خطوط تتوهج على السلاح'], ['بثّ القتل', 'إعلان مميز في الجزيرة كلها'], ['الشكل الأخير', 'توهّج حيّ ولهب فوهة بلون الشكل'],
];
const WSKIN_COST = [0, 20, 40, 60, 90, 120, 160];
const skinFor = (gunId) => { const id = ACCOUNT.wskinOn && ACCOUNT.wskinOn[gunId]; return id && WSKINS[id] && ACCOUNT.wskins[id] ? id : null; };
const skinLevel = (id) => (ACCOUNT.wskins && ACCOUNT.wskins[id]) || 0;
function skinMul() { return 1; }        // skins are looks only: the same gun fights the same
function skinPaint(group, itemId) {
  const it = ITEMS[itemId], w = it && gunOf(it), sid = w && skinFor(w.id); if (!sid) return;
  const S = WSKINS[sid], lv = skinLevel(sid), mesh = group.children[0]; if (!mesh) return;
  if (group.userData.prop || !mesh.geometry.attributes.color) {
    // a textured gun (the modelled AK): its own paint tinted in the skin's colour
    const mt = mesh.material.clone(); mt.color = new THREE.Color(S.c1).lerp(new THREE.Color(0xffffff), 0.42); mesh.material = mt;
  } else {
    // recolour a copy of the gun: dark metal takes the main colour, polymer the second, and stripes over the top at level one
    const g = mesh.geometry.clone(), col = g.attributes.color, c1 = new THREE.Color(S.c1), c2 = new THREE.Color(S.c2), tmp = new THREE.Color();
    for (let i = 0; i < col.count; i++) {
      tmp.setRGB(col.getX(i), col.getY(i), col.getZ(i)); const l = tmp.r * 0.3 + tmp.g * 0.59 + tmp.b * 0.11;
      const p = g.attributes.position, stripe = S.stripes && Math.sin(p.getZ(i) * 55 + p.getY(i) * 30) > 0.55;
      const t = stripe ? c2 : l < 0.09 ? c2 : c1; col.setXYZ(i, t.r * (0.7 + l * 1.4), t.g * (0.7 + l * 1.4), t.b * (0.7 + l * 1.4));
    }
    col.needsUpdate = true; mesh.geometry = g;
  }
  if (lv >= 5) {
    // glowing lines along the receiver and the barrel
    const b = new Builder(), mz = group.userData.muzzle.z, gl = new THREE.Color(S.c3).multiplyScalar(lv >= 7 ? 2.4 : 1.6);
    for (const s of [-1, 1]) b.box(s * 0.024, 0.03, mz * 0.35, 0.003, 0.004, mz * 0.6, gl, 0, MATID.plain);
    b.box(0, 0.06, 0.0, 0.004, 0.003, 0.2, gl, 0, MATID.plain);
    const glow = new THREE.Mesh(b.geometry(), GLOW_MAT); group.add(glow); group.userData.glow = glow;
  }
  group.userData.skin = sid;
}
/* ── crates ── */
const CRATE_TYPES = {
  premium: { name: 'الصندوق المميز', desc: 'بدلات كاملة نادرة وأسطورية · فرصة للميثيك', gems: 60, ten: 540, col: '#f0a020', pool: () => ITEM_LIST.filter((it) => it.crate && (it.wear.slot === 'suit' || it.wear.slot === 'chute') && it.rarity !== 'common'), odds: { rare: 50, epic: 32, legendary: 14, mythic: 4 } },
  classic: { name: 'الصندوق الكلاسيكي', desc: 'قمصان وبناطيل وأحذية وقبعات بكل الألوان', gold: 900, ten: 8100, col: '#3d8ee8', pool: () => ITEM_LIST.filter((it) => isCosmetic(it) && it.wear.slot !== 'body' && it.wear.slot !== 'suit' && it.id !== 'outfit_soldier' && !it.gemPrice), odds: { common: 62, rare: 26, epic: 9, legendary: 2.6, mythic: 0.4 } },
  soldier: { name: 'صندوق الجندي', desc: 'أزياء عسكرية وخوذ ومظلات', gold: 1400, ten: 12600, col: '#7a9a4a', pool: () => ITEM_LIST.filter((it) => isCosmetic(it) && (/military|camo|helm_lux|chute/.test(it.id) || (it.wear.suit && /forest|urban|storm|desert|ranger/.test(it.id)))), odds: { common: 40, rare: 35, epic: 18, legendary: 6, mythic: 1 } },
  arms: { name: 'صندوق الأسلحة', desc: 'أشكال أسلحة قابلة للتطوير ومواد التطوير', gems: 50, ten: 450, col: '#e0402a', pool: () => Object.keys(WSKINS).map((id) => ({ id: 'wskin:' + id, rarity: WSKINS[id].rarity })), odds: { mat: 70, epic: 18, legendary: 9, mythic: 3 } },
};
function crateRoll(type) {
  const C = CRATE_TYPES[type], pool = C.pool(), odds = C.odds;
  ACCOUNT.pity = ACCOUNT.pity || {}; const pity = (ACCOUNT.pity[type] = (ACCOUNT.pity[type] || 0) + 1);
  let tot = 0; for (const v of Object.values(odds)) tot += v;
  let r = Math.random() * tot, rar = 'common';
  for (const [k, v] of Object.entries(odds)) { r -= v; if (r <= 0) { rar = k; break; } }
  if (pity >= 40 && (odds.legendary || odds.mythic)) { rar = odds.mythic && pity >= 80 ? 'mythic' : 'legendary'; }          // the promise: a legendary within forty pulls
  if (rar === 'legendary' || rar === 'mythic') ACCOUNT.pity[type] = 0;
  if (rar === 'mat') { const n = pick([5, 5, 8, 8, 10, 15, 20]); return { kind: 'mat', n, rarity: n >= 15 ? 'epic' : n >= 10 ? 'rare' : 'common', name: toAr(n) + ' مادة تطوير' }; }
  let cand = pool.filter((it) => (it.rarity || rarOf(it)) === rar);
  if (!cand.length) cand = pool;
  const it = cand[Math.floor(Math.random() * cand.length)];
  if (String(it.id).startsWith('wskin:')) {
    const sid = it.id.slice(6), have = skinLevel(sid) > 0;
    if (have) return { kind: 'mat', n: 30, rarity: WSKINS[sid].rarity, name: 'مكرّر: ٣٠ مادة تطوير', dupe: true, sid };
    return { kind: 'wskin', sid, rarity: WSKINS[sid].rarity, name: WSKINS[it.id.slice(6)].name + ' · ' + WEAPONS[WSKINS[sid].gun].name };
  }
  if (ACCOUNT.wardrobe.includes(it.id)) { const sh = { common: 1, rare: 2, epic: 4, legendary: 8, mythic: 12 }[rarOf(it)] || 1; return { kind: 'shard', n: sh, rarity: rarOf(it), name: it.name + ' (مكرّر) → ' + toAr(sh) + ' قطعة صندوق', dupe: true, id: it.id }; }
  return { kind: 'wear', id: it.id, rarity: rarOf(it), name: it.name };
}
function crateGrant(res) {
  if (res.kind === 'wear') wardrobeAdd(res.id, true);
  else if (res.kind === 'mat') ACCOUNT.mat = (ACCOUNT.mat || 0) + res.n;
  else if (res.kind === 'shard') ACCOUNT.shards = (ACCOUNT.shards || 0) + res.n;
  else if (res.kind === 'wskin') { ACCOUNT.wskins[res.sid] = 1; ACCOUNT.wskinOn[WSKINS[res.sid].gun] = res.sid; }
}
/* open crates: from your own stock first, else paid with gold or gems; ten at once costs nine */
function openCrates(type, n) {
  const C = CRATE_TYPES[type]; if (!C) return null;
  ACCOUNT.crates = ACCOUNT.crates || {};
  const own = ACCOUNT.crates[type] || 0, fromStock = Math.min(own, n), rest = n - fromStock;
  if (rest > 0) {
    const cost = rest === 10 ? (C.ten) : (C.gold || C.gems) * rest;
    if (C.gold) { if (!spendGold(cost)) return 'gold'; } else if (!spendGems(cost)) return 'gems';
  }
  ACCOUNT.crates[type] = own - fromStock;
  const out = []; for (let i = 0; i < n; i++) { const r = crateRoll(type); crateGrant(r); out.push(r); }
  track('cratesOpened', n); accSoon(true);
  return out;
}
/* ten shards make a crate (the classic one) */
function combineShards() { if ((ACCOUNT.shards || 0) < 10) return false; ACCOUNT.shards -= 10; ACCOUNT.crates = ACCOUNT.crates || {}; ACCOUNT.crates.classic = (ACCOUNT.crates.classic || 0) + 1; accSoon(true); return true; }
function upgradeSkin(sid) {
  const lv = skinLevel(sid); if (!lv) return 'none'; if (lv >= 7) return 'max';
  const c = WSKIN_COST[lv]; if ((ACCOUNT.mat || 0) < c) return 'mat';
  ACCOUNT.mat -= c; ACCOUNT.wskins[sid] = lv + 1; accSoon(true); track('skinUps');
  if (typeof refreshGunModel === 'function') for (const id of INV.items.keys()) if (ITEMS[id] && ITEMS[id].gunId === WSKINS[sid].gun) refreshGunModel(id);
  return 'ok';
}
/* a kill with a skinned gun announces itself; level three dresses the victim's crate, level four colours the hit */
function onKill(target, head, how) {
  if (how === 'player') { if (head) track('headshots'); const it = ITEMS[player.toolItem]; if (it && it.gunId) { track('gunKills'); const cls = WEAPONS[it.gunId].cls; track(cls + 'Kills'); } else track('meleeKills'); }
  const it = ITEMS[player.toolItem], w = it && it.gunId && WEAPONS[it.gunId], sid = w && skinFor(w.id); if (!sid) return;
  const S = WSKINS[sid], lv = skinLevel(sid);
  if (lv >= 2) showGain('☠ ' + S.name + (head ? ' · رأس' : ''), 'kill');
  if (lv >= 6) toast('🔥 ' + ACCOUNT.name + ' أسقط ' + (target.name || 'زومبي') + ' بـ' + S.name, '');
}
const hitColor = () => { const it = ITEMS[player.toolItem], w = it && it.gunId && WEAPONS[it.gunId], sid = w && skinFor(w.id); return sid && skinLevel(sid) >= 4 ? WSKINS[sid].fx : null; };

/* ── titles: more than sixty, from the first steps to the legends ── */
const TITLE_TIERS = { easy: ['سهل', '#7fd88a'], medium: ['متوسط', '#3d8ee8'], hard: ['صعب', '#a35ce8'], legend: ['صعب جداً', '#ff8a1a'] };
const TITLES = [
  // id, name, tier, stat, n, how to earn
  ['newcomer', 'الوافد الجديد', 'easy', 'sec', 600, 'العب عشر دقائق'], ['woodcutter', 'الحطّاب', 'easy', 'felled', 20, 'اقطع ٢٠ شجرة'], ['miner', 'المنقّب', 'easy', 'rocks', 20, 'حطّم ٢٠ صخرة'],
  ['angler', 'الصيّاد الصبور', 'easy', 'fish', 5, 'اصطد ٥ سمكات'], ['builder', 'البنّاء', 'easy', 'built', 25, 'ابنِ ٢٥ قطعة'], ['crafter', 'الصانع', 'easy', 'crafted', 30, 'اصنع ٣٠ شيئاً'],
  ['driver', 'السائق', 'easy', 'km', 10, 'قُد ١٠ كم'], ['digger', 'الحفّار', 'easy', 'dug', 20, 'احفر ٢٠ حفرة'], ['hungry', 'الأكول', 'easy', 'eat', 20, 'كُل ٢٠ وجبة'],
  ['thirsty', 'الشارب', 'easy', 'drink', 20, 'اشرب ٢٠ مرة'], ['first_blood', 'الدم الأول', 'easy', 'kills', 10, 'اقتل ١٠ زومبي'], ['skydiver', 'المظلّي', 'easy', 'jumps', 3, 'اقفز من الطائرة ٣ مرات'],
  ['peaceful', 'المسالم', 'easy', 'peaceSec', 1800, 'انجُ نصف ساعة دون أن تقتل أحداً'], ['shopper', 'المتسوّق', 'easy', 'bought', 20, 'اشترِ ٢٠ شيئاً'], ['hunter_t', 'القنّاص الصغير', 'easy', 'hunted', 5, 'اصطد ٥ حيوانات'],
  ['looter', 'جامع الغنائم', 'easy', 'cratesLooted', 10, 'افتح ١٠ صناديق موتى'],
  ['strong', 'القوي', 'medium', 'kills', 250, 'اقتل ٢٥٠ زومبي'], ['brute_slayer', 'قاهر العمالقة', 'medium', 'brutes', 25, 'اقتل ٢٥ عملاقاً'], ['sharpshooter', 'الرامي الماهر', 'medium', 'headshots', 50, '٥٠ طلقة في الرأس'],
  ['sniper_t', 'القنّاص', 'medium', 'srKills', 30, '٣٠ قتيلاً ببنادق القنص'], ['rifleman', 'حامل البندقية', 'medium', 'arKills', 150, '١٥٠ قتيلاً بالبنادق الهجومية'], ['close_quarters', 'سيد المسافات القريبة', 'medium', 'sgKills', 50, '٥٠ قتيلاً بالخرطوش'],
  ['smg_ace', 'إعصار الرشاش', 'medium', 'smgKills', 80, '٨٠ قتيلاً بالرشاشات الصغيرة'], ['pistolero', 'المسدّس', 'medium', 'pistolKills', 40, '٤٠ قتيلاً بالمسدسات'], ['brawler', 'المصارع', 'medium', 'meleeKills', 50, '٥٠ قتيلاً بالسلاح الأبيض'],
  ['survivor', 'الناجي', 'medium', 'survBest', 7200, 'انجُ ساعتين في حياة واحدة'], ['lumberjack', 'سيد الغابة', 'medium', 'felled', 300, 'اقطع ٣٠٠ شجرة'], ['architect', 'المهندس', 'medium', 'built', 400, 'ابنِ ٤٠٠ قطعة'],
  ['traveler', 'الرحّالة', 'medium', 'km', 100, 'قُد ١٠٠ كم'], ['fisher_king', 'ملك البحيرة', 'medium', 'fish', 60, 'اصطد ٦٠ سمكة'], ['treasure_hunter', 'صائد الكنوز', 'medium', 'treasure', 10, 'اعثر على ١٠ كنوز'],
  ['crate_master', 'فاتح الصناديق', 'medium', 'cratesOpened', 50, 'افتح ٥٠ صندوقاً من المتجر'], ['bot_hunter', 'صائد اللصوص', 'medium', 'bots', 30, 'اهزم ٣٠ ناجياً معادياً'], ['airborne', 'فرقة المظلات', 'medium', 'jumps', 25, 'اقفز ٢٥ مرة'],
  ['flare_caller', 'نداء الإمداد', 'medium', 'flares', 3, 'أطلق ٣ إشارات إمداد'], ['collector', 'الأنيق', 'medium', 'wardrobe', 60, 'اجمع ٦٠ قطعة ملابس'], ['chef', 'الطاهي', 'medium', 'cooked', 40, 'اطبخ ٤٠ طبقاً'],
  ['clever', 'البارع', 'hard', 'headshots', 300, '٣٠٠ طلقة في الرأس'], ['warrior', 'المحارب', 'hard', 'kills', 1500, 'اقتل ١٥٠٠ زومبي'], ['titan_bane', 'آفة الجبابرة', 'hard', 'brutes', 150, 'اقتل ١٥٠ عملاقاً'],
  ['eagle_eye', 'عين الصقر', 'hard', 'srKills', 200, '٢٠٠ قتيل ببنادق القنص'], ['iron_will', 'الإرادة الحديدية', 'hard', 'survBest', 5 * 3600, 'انجُ ٥ ساعات في حياة واحدة'], ['tycoon', 'الثري', 'hard', 'goldEarned', 20000, 'اكسب ٢٠٠٠٠ ذهب'],
  ['master_builder', 'البنّاء الأعظم', 'hard', 'built', 2000, 'ابنِ ٢٠٠٠ قطعة'], ['explorer', 'المستكشف', 'hard', 'km', 600, 'قُد ٦٠٠ كم'], ['weapon_smith', 'صانع السلاح', 'hard', 'gunsCrafted', 20, 'اصنع ٢٠ سلاحاً'],
  ['upgrader', 'المطوِّر', 'hard', 'skinUps', 12, 'طوّر أشكال الأسلحة ١٢ مرة'], ['veteran', 'المحارب القديم', 'hard', 'level', 40, 'بلغ المستوى ٤٠'], ['death_dealer', 'موزّع الموت', 'hard', 'gunKills', 2500, '٢٥٠٠ قتيل بالأسلحة النارية'],
  ['legendary', 'الأسطوري', 'legend', 'level', 80, 'بلغ المستوى ٨٠'], ['immortal', 'الخالد', 'legend', 'survBest', 10 * 3600, 'انجُ ١٠ ساعات في حياة واحدة'], ['zombie_king', 'ملك الزومبي', 'legend', 'kills', 6000, 'اقتل ٦٠٠٠ زومبي'],
  ['ghost', 'الشبح', 'legend', 'headshots', 1500, '١٥٠٠ طلقة في الرأس'], ['island_lord', 'سيد الجزيرة', 'legend', 'goldEarned', 120000, 'اكسب ١٢٠٠٠٠ ذهب'], ['mythic_one', 'صاحب الميثيك', 'legend', 'mythics', 3, 'احصل على ٣ قطع ميثيك'],
  ['unstoppable', 'الذي لا يُقهر', 'legend', 'gunKills', 12000, '١٢٠٠٠ قتيل بالأسلحة النارية'], ['grand_architect', 'مهندس الممالك', 'legend', 'built', 8000, 'ابنِ ٨٠٠٠ قطعة'], ['pathfinder', 'رائد الطرق', 'legend', 'km', 2500, 'قُد ٢٥٠٠ كم'],
  ['perfectionist', 'الكامل', 'legend', 'titles', 50, 'اجمع ٥٠ لقباً'], ['peace_master', 'حكيم السلام', 'legend', 'peaceSec', 6 * 3600, 'انجُ ٦ ساعات دون أن تقتل'], ['fortune', 'المحظوظ', 'legend', 'cratesOpened', 500, 'افتح ٥٠٠ صندوق'],
  ['tiger_lord', 'سيد النمر الناري', 'legend', 'tigerMax', 1, 'طوّر النمر الناري إلى المستوى ٧'], ['airdrop_king', 'ملك الإمدادات', 'legend', 'airdrops', 30, 'افتح ٣٠ صندوق إمداد'],
];
const titleStat = (stat) => stat === 'mythics' ? ACCOUNT.wardrobe.filter((id) => rarOf(ITEMS[id]) === 'mythic').length + Object.keys(ACCOUNT.wskins || {}).filter((s) => WSKINS[s] && WSKINS[s].rarity === 'mythic').length
  : stat === 'titles' ? (ACCOUNT.titles || []).length : stat === 'tigerMax' ? (skinLevel('m416_tiger') >= 7 ? 1 : 0) : lifeOf(stat);
let titleT = 0;
function checkTitles(force) {
  if (!ACC.loaded || (!force && T - titleT < 3)) return; titleT = T;
  ACCOUNT.titles = ACCOUNT.titles || [];
  for (const [id, name, tier, stat, n] of TITLES) {
    if (ACCOUNT.titles.includes(id) || titleStat(stat) < n) continue;
    ACCOUNT.titles.push(id); accSoon(true);
    if (started) toast('لقب جديد: «' + name + '»', 'اختره من ملفك في اللوبي ليظهر تحت اسمك'); AUDIO.treasure();
    if (!ACCOUNT.title) ACCOUNT.title = id;
  }
}
const titleName = (id) => { const t = TITLES.find((q) => q[0] === id); return t ? t[1] : ''; };

/* ── missions, PUBG-style: six a day and six a week from a larger pool, each with activity points; activity fills five chests ── */
MISSIONS.daily = [
  { id: 'd_kill', stat: 'kills', n: 20, text: 'اقتل ٢٠ زومبي', gold: 60, xp: 140, pts: 20, shards: 1 }, { id: 'd_head', stat: 'headshots', n: 5, text: '٥ طلقات في الرأس', gold: 50, xp: 120, pts: 20, mat: 2 },
  { id: 'd_wood', stat: 'wood', n: 150, text: 'اجمع ١٥٠ خشبة', gold: 40, xp: 100, pts: 10 }, { id: 'd_stone', stat: 'stone', n: 100, text: 'اجمع ١٠٠ حجر', gold: 40, xp: 100, pts: 10 },
  { id: 'd_fell', stat: 'felled', n: 8, text: 'اقطع ٨ أشجار', gold: 35, xp: 90, pts: 10 }, { id: 'd_craft', stat: 'crafted', n: 6, text: 'اصنع ٦ أشياء', gold: 35, xp: 90, pts: 10 },
  { id: 'd_build', stat: 'built', n: 6, text: 'ابنِ ٦ قطع', gold: 40, xp: 100, pts: 10 }, { id: 'd_surv', stat: 'sec', n: 900, text: 'ابقَ حياً ١٥ دقيقة', gold: 50, xp: 120, pts: 20, shards: 1 },
  { id: 'd_drive', stat: 'km', n: 3, text: 'قُد ٣ كيلومترات', gold: 35, xp: 90, pts: 10 }, { id: 'd_fish', stat: 'fish', n: 3, text: 'اصطد ٣ سمكات', gold: 40, xp: 100, pts: 10 },
  { id: 'd_dig', stat: 'dug', n: 8, text: 'احفر ٨ حفر', gold: 35, xp: 90, pts: 10 }, { id: 'd_rocks', stat: 'rocks', n: 6, text: 'حطّم ٦ صخور', gold: 35, xp: 90, pts: 10 },
  { id: 'd_eat', stat: 'eat', n: 3, text: 'تناول ٣ وجبات', gold: 30, xp: 70, pts: 10 }, { id: 'd_drink', stat: 'drink', n: 4, text: 'اشرب ٤ مرات', gold: 30, xp: 70, pts: 10 },
  { id: 'd_jump', stat: 'jumps', n: 1, text: 'اقفز من الطائرة', gold: 40, xp: 100, pts: 20 }, { id: 'd_loot', stat: 'cratesLooted', n: 3, text: 'افتح ٣ صناديق موتى', gold: 45, xp: 110, pts: 20, mat: 2 },
  { id: 'd_gun', stat: 'gunKills', n: 15, text: '١٥ قتيلاً بالأسلحة النارية', gold: 55, xp: 130, pts: 20 }, { id: 'd_melee', stat: 'meleeKills', n: 5, text: '٥ قتلى بالسلاح الأبيض', gold: 45, xp: 110, pts: 20 },
  { id: 'd_bots', stat: 'bots', n: 2, text: 'اهزم ناجيَين معاديين', gold: 60, xp: 140, pts: 20, shards: 1 }, { id: 'd_cook', stat: 'cooked', n: 2, text: 'اطبخ طبقين', gold: 35, xp: 90, pts: 10 },
];
MISSIONS.weekly = [
  { id: 'w_kill', stat: 'kills', n: 200, text: 'اقتل ٢٠٠ زومبي', gold: 400, xp: 1000, pts: 0, shards: 4, mat: 10 }, { id: 'w_wood', stat: 'wood', n: 1000, text: 'اجمع ١٠٠٠ خشبة', gold: 300, xp: 850, shards: 2 },
  { id: 'w_surv', stat: 'sec', n: 10800, text: 'ابقَ حياً ٣ ساعات', gold: 400, xp: 1000, shards: 3, gems: 5 }, { id: 'w_drive', stat: 'km', n: 30, text: 'قُد ٣٠ كيلومتراً', gold: 280, xp: 750, shards: 2 },
  { id: 'w_craft', stat: 'crafted', n: 60, text: 'اصنع ٦٠ شيئاً', gold: 280, xp: 750, mat: 8 }, { id: 'w_build', stat: 'built', n: 60, text: 'ابنِ ٦٠ قطعة', gold: 300, xp: 800, shards: 2 },
  { id: 'w_treasure', stat: 'treasure', n: 3, text: 'اعثر على ٣ كنوز', gold: 350, xp: 850, gems: 5 }, { id: 'w_head', stat: 'headshots', n: 60, text: '٦٠ طلقة في الرأس', gold: 400, xp: 1000, mat: 15 },
  { id: 'w_jumps', stat: 'jumps', n: 7, text: 'اقفز من الطائرة ٧ مرات', gold: 300, xp: 800, shards: 3 }, { id: 'w_loot', stat: 'cratesLooted', n: 25, text: 'افتح ٢٥ صندوق موتى', gold: 350, xp: 900, mat: 10 },
  { id: 'w_bots', stat: 'bots', n: 15, text: 'اهزم ١٥ ناجياً معادياً', gold: 450, xp: 1100, gems: 8 }, { id: 'w_air', stat: 'airdrops', n: 1, text: 'افتح صندوق إمداد', gold: 300, xp: 800, shards: 4 },
];
MISSION_COUNT.daily = 6; MISSION_COUNT.weekly = 6;
const ACTIVITY_CHESTS = [[20, { gold: 80, shards: 1 }], [40, { gold: 120, mat: 5 }], [60, { gold: 160, shards: 2 }], [80, { gems: 5, mat: 8 }], [100, { gems: 10, shards: 3, crate: 'classic' }]];
function activityPts() { const P = ACCOUNT.daily; if (!P) return 0; return P.done.reduce((s, id) => { const d = missionDef('daily', id); return s + (d ? d.pts || 0 : 0); }, 0); }
function claimChest(i) {
  const P = ACCOUNT.daily; P.chests = P.chests || [];
  const [need, rw] = ACTIVITY_CHESTS[i]; if (P.chests.includes(i) || activityPts() < need) return false;
  P.chests.push(i); grantReward(rw); accSoon(true); AUDIO.treasure(); return rw;
}
function grantReward(r) {
  if (r.gold) addGold(r.gold); if (r.gems) ACCOUNT.gems += r.gems; if (r.shards) ACCOUNT.shards = (ACCOUNT.shards || 0) + r.shards;
  if (r.mat) ACCOUNT.mat = (ACCOUNT.mat || 0) + r.mat; if (r.crate) { ACCOUNT.crates = ACCOUNT.crates || {}; ACCOUNT.crates[r.crate] = (ACCOUNT.crates[r.crate] || 0) + 1; }
  if (r.xp) addXP(r.xp);
}
const rewardText = (r) => [r.gold && toAr(r.gold) + ' ذهب', r.gems && toAr(r.gems) + ' جوهرة', r.shards && toAr(r.shards) + ' قطعة صندوق', r.mat && toAr(r.mat) + ' مادة تطوير', r.crate && CRATE_TYPES[r.crate].name, r.xp && toAr(r.xp) + ' خبرة'].filter(Boolean).join(' · ');
/* in play: peaceful time, titles every few seconds */
let peaceK = 0;
function updateMeta(dt) {
  if (!ACC.loaded || !started || !player.alive || paused) return;
  peaceK += dt; if (KILLS > 0) peaceK = 0;
  if (peaceK >= 1 && KILLS === 0) { const s = Math.floor(peaceK); peaceK -= s; ACCOUNT.life.peaceSec = Math.max(ACCOUNT.life.peaceSec || 0, Math.floor(SURVIVE_T)); }
  checkTitles(false);
}
