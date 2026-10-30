/* ═════════ shops: what each one sells and buys, the car dealer, and the wardrobe that dresses your survivor ═════════ */
const SHOP = { spot: null, mode: 'buy' };
const SHOP_NAME = { clothes: 'متجر الأزياء', grocery: 'البقالة', pharmacy: 'الصيدلية', tools: 'عدد وأدوات', guns: 'الصيد والسلاح', cars: 'معرض السيارات', cafe: 'المقهى', bakery: 'المخبز', bank: 'المصرف', ores: 'تاجر المعادن', gas: 'متجر المحطة' };
const CAR_PRICES = [['bicycle', 120], ['bike', 650], ['tractor', 800], ['sedan', 950], ['taxi', 900], ['pickup', 1100], ['van', 1200], ['jeep', 1300], ['buggy', 1400], ['suv', 1550], ['ambulance', 1700], ['truck', 1900], ['police', 2200], ['bus', 2600], ['boat', 1000], ['sports', 6500]];
const has = (it, ...cats) => cats.includes(it.cat);
const SELLS = {
  clothes: (it) => has(it, 'wear') && !it.lobby && !/^(helmet|vest)_(kevlar|steel)/.test(it.id),
  grocery: (it) => (has(it, 'food') && (CROPS.some((c) => c[0] === it.id) || ['bread', 'flatbread', 'omelette', 'jam', 'juice_orange', 'tea'].includes(it.id) || it.id.startsWith('raw_chicken') || it.id.startsWith('fish_sardine'))) || it.seed || ['flour', 'salt', 'sugar', 'water', 'milk', 'egg', 'honey', 'fertilizer'].includes(it.id),
  pharmacy: (it) => has(it, 'med') || ['herbs', 'water', 'honey'].includes(it.id),
  tools: (it) => (has(it, 'tool') && ['wood', 'stone', 'copper', 'iron', 'steel'].includes(it.tier || 'iron')) || ['torch', 'rope', 'nails', 'plank', 'beam', 'glass', 'watering_can', 'paint_white', 'paint_red', 'paint_blue', 'paint_green'].includes(it.id) || (it.place && it.place.station) || (it.build && ['wood', 'stone', 'brick'].includes(it.build.mat)) || has(it, 'light') || (it.place && it.place.storage) || it.sapling || ['f_scarecrow', 'scarecrow', 'planter', 'well', 'coop', 'beehive'].includes(it.id),
  guns: (it) => has(it, 'weapon', 'ammo') || /^(helmet|vest)_/.test(it.id) || ['binoculars', 'compass_item'].includes(it.id),
  cafe: (it) => ['coffee', 'tea', 'juice_orange', 'juice_lemon', 'juice_watermelon', 'milk_warm', 'shawarma', 'falafel', 'hummus', 'kebab', 'salad', 'fattoush', 'kabsa', 'mansaf', 'soup_lentil'].includes(it.id),
  bakery: (it) => ['bread', 'flatbread', 'corn_bread', 'pie_apple', 'pie_pumpkin', 'pie_meat', 'date_cookies', 'halva', 'flour', 'sugar'].includes(it.id),
  bank: (it) => it.id === 'treasure_map' || it.id === 'metal_detector',
  ores: (it) => (has(it, 'tool') && (it.tool === 'pickaxe' || it.tool === 'shovel')) || ['coal', 'charcoal', 'metal_detector', 'iron', 'copper', 'steel'].includes(it.id),
  gas: (it) => ['water', 'energy_drink', 'bread', 'fuel', 'battery', 'torch', 'rope', 'bandage', 'juice_orange', 'popcorn'].includes(it.id),
};
const BUYS = {
  clothes: (it) => has(it, 'wear') && !it.shopOnly, grocery: (it) => has(it, 'food') || it.seed || ['egg', 'milk', 'honey', 'wool', 'cotton'].includes(it.id), pharmacy: (it) => has(it, 'med') || ['herbs', 'mushroom', 'honey', 'cactus_pulp'].includes(it.id),
  tools: (it) => has(it, 'tool', 'mat', 'res', 'build', 'furn', 'light'), guns: (it) => has(it, 'weapon', 'ammo') || ['hide', 'leather', 'bone', 'feather'].includes(it.id) || it.id.startsWith('raw_'),
  cafe: (it) => ['herbs', 'milk', 'sugar', 'orange', 'lemon', 'watermelon'].includes(it.id), bakery: (it) => ['wheat', 'barley', 'corn', 'flour', 'dates', 'egg', 'sugar', 'apple', 'pumpkin'].includes(it.id),
  bank: (it) => has(it, 'treasure') || ['gold', 'silver', 'ruby', 'emerald', 'sapphire', 'diamond', 'amethyst', 'gold_ore', 'silver_ore'].includes(it.id),
  ores: (it) => ['iron_ore', 'copper_ore', 'gold_ore', 'silver_ore', 'coal', 'sulfur', 'saltpeter', 'iron', 'copper', 'gold', 'silver', 'steel', 'bronze', 'ruby', 'emerald', 'sapphire', 'diamond', 'amethyst', 'flint', 'scrap', 'stone', 'clay', 'sand', 't_meteorite', 't_fossil'].includes(it.id),
  gas: (it) => ['oil', 'fuel', 'scrap', 'battery'].includes(it.id),
};
const SELL_RATE = { bank: 1.0, ores: 0.85 };
const buyPrice = (it) => Math.max(1, Math.round(it.price * 1.15));
const sellPrice = (it, kind) => Math.max(1, Math.round(it.price * (SELL_RATE[kind] && (kind === 'bank' ? has(it, 'treasure') || ['ruby', 'emerald', 'sapphire', 'diamond', 'amethyst', 'gold', 'silver'].includes(it.id) : true) ? SELL_RATE[kind] : 0.5)));
const _catalog = new Map();
function shopCatalog(kind) {
  if (_catalog.has(kind)) return _catalog.get(kind);
  const f = SELLS[kind], out = f ? ITEM_LIST.filter((it) => f(it)).map((it) => it.id) : [];
  _catalog.set(kind, out); return out;
}
const shopBuys = (kind, id) => { const f = BUYS[kind], it = ITEMS[id]; return !!(f && it && f(it)); };
function openShop(spot) { SHOP.spot = spot; SHOP.mode = 'buy'; AUDIO.door(); if (typeof openCraft === 'function') openCraft('shop'); }
function shopValid() { return SHOP.spot && Math.hypot(SHOP.spot.x - player.pos.x, SHOP.spot.z - player.pos.z) < 6; }
function buyItem(id, n = 1) {
  const it = ITEMS[id]; if (!it || !shopValid()) return false;
  if (typeof isCosmetic === 'function' && isCosmetic(it)) { if (ownsWear(id)) { toast('هذه القطعة في خزانتك بالفعل', 'البسها من تبويب الملابس'); return false; } n = 1; }
  const cost = buyPrice(it) * n;
  if (INV.coins < cost) { toast('لا يكفي مالك', 'تحتاج ' + toAr(cost) + ' ديناراً'); AUDIO.dry(); return false; }
  const got = invAdd(id, n, true); if (got <= 0) return false;
  INV.coins -= buyPrice(it) * got; hudDirty = true; AUDIO.coins();
  toast('اشتريت ' + (got > 1 ? toAr(got) + ' × ' : '') + it.name, it.wear ? (isCosmetic(it) ? 'أُضيف إلى خزانتك للأبد · البسه من تبويب الملابس' : 'البسه من تبويب الملابس') : it.place || it.build ? 'ضعه من تبويب المخزون' : '');
  if (it.wear && it.wear.slot === 'body') wearItem(id);
  STATS.bought = (STATS.bought || 0) + 1; track('bought'); if (typeof saveSoon === 'function') saveSoon(); return true;
}
function sellItem(id, n = 1) {
  const it = ITEMS[id]; if (!it || !shopValid() || !shopBuys(SHOP.spot.kind, id)) return false;
  n = Math.min(n, invCount(id)); if (n <= 0) return false;
  if (Object.values(INV.wearing).includes(id) && invCount(id) - n < 1) { for (const [s, w] of Object.entries(INV.wearing)) if (w === id) delete INV.wearing[s]; applyOutfit(); }
  if (INV.slots.includes(id) && invCount(id) - n < 1 && player.toolItem === id) equip('hand');
  invTake(id, n); addCoins(sellPrice(it, SHOP.spot.kind) * n, true); AUDIO.coins();
  toast('بعت ' + (n > 1 ? toAr(n) + ' × ' : '') + it.name, '+' + toAr(sellPrice(it, SHOP.spot.kind) * n) + ' دينار');
  if (typeof saveSoon === 'function') saveSoon(); return true;
}
/* the car dealer parks what you buy outside */
function buyCar(kind, price) {
  if (!shopValid()) return false;
  if (INV.coins < price) { toast('لا يكفي مالك', 'السعر ' + toAr(price) + ' دينار'); AUDIO.dry(); return false; }
  const s = SHOP.spot, spec = VSPEC[kind]; let spot = null;
  for (let tries = 0; tries < 60 && !spot; tries++) {
    const a = rr(0, TAU), d = spec.water ? rr(10, 200) : rr(8, 30), x = s.x + Math.cos(a) * d, z = s.z + Math.sin(a) * d;
    if (spec.water) { if (waterAt(x, z) - terrainAt(x, z) > 1.5) spot = [x, z]; continue; }
    if (terrainAt(x, z) < waterAt(x, z) + 0.2 || slopeAt(x, z) > 0.25 || buildingAt(x, z, terrainAt(x, z) + 1)) continue;
    let ok = true; CGRID.each(x - 3, z - 3, x + 3, z + 3, (c) => { if (c.off) return; const ex = c.t === 'b' ? c.hx : c.r, ez = c.t === 'b' ? c.hz : c.r; if (Math.abs(c.x - x) < ex + 2.4 && Math.abs(c.z - z) < ez + 2.4) { ok = false; return false; } });
    for (const v of VEHICLES) if (Math.hypot(v.pos.x - x, v.pos.z - z) < 5) ok = false;
    if (ok) spot = [x, z];
  }
  if (!spot) { toast('لا مكان لركن المركبة', 'جرّب مرة أخرى'); return false; }
  INV.coins -= price; hudDirty = true; AUDIO.coins();
  const v = buyVehicle(kind, spot[0], spot[1], Math.atan2(spot[0] - s.x, spot[1] - s.z));
  toast('اشتريت ' + spec.name + '!', spec.water ? 'تنتظرك على الماء القريب' : 'مركونة أمام المعرض · اقترب واضغط «اركب»');
  STATS.cars = (STATS.cars || 0) + 1; track('cars'); if (typeof saveSoon === 'function') saveSoon(); void v;
  if (typeof closeCraft === 'function') closeCraft();
  return true;
}

/* ── the wardrobe: what you wear changes your survivor. Clothes belong to the account (they stay when you fall);
   helmets, vests and backpacks are gear that belongs to this life ── */
const WEAR_SLOTS = [['suit', 'البدلة الكاملة'], ['top', 'القميص'], ['pants', 'البنطال'], ['shoes', 'الحذاء'], ['hands', 'القفازات'], ['hat', 'غطاء الرأس'], ['glasses', 'النظارة'], ['vest', 'السترة الواقية'], ['pack', 'الحقيبة'], ['body', 'الهيئة']];
const clothPart = (w) => ({ c: w.c, a: w.a || 0.85, p: w.p || 'solid', glow: w.glow || 0 });
function outfitFromWearing(W = INV.wearing) {
  const o = JSON.parse(JSON.stringify(DEFAULT_OUTFIT)); delete o.pack; delete o.packC;
  for (const k of ['top', 'pants', 'shoes', 'head', 'hands']) if (o[k]) o[k].dflt = true;      // the soldier's defaults: a scanned body keeps its own clothes instead
  const suit = W.suit && ITEMS[W.suit] && ITEMS[W.suit].wear.suit;
  if (suit) {
    for (const s of ['top', 'pants', 'shoes', 'hands']) if (suit[s]) o[s] = { c: suit[s].c, a: suit[s].a || 0.85, p: suit[s].p || 'solid', glow: suit[s].glow || 0 };
    for (const s of ['hat', 'glasses']) if (suit[s]) { o[s] = suit[s]; o[s + 'C'] = suit[s + 'C']; }
  } else {
    for (const s of ['top', 'pants', 'shoes', 'hands']) { const it = W[s] && ITEMS[W[s]]; if (it) o[s] = clothPart(it.wear); }
    const top = W.top && ITEMS[W.top]; if (top && top.wear.both) o.pants = { c: top.wear.c, a: top.wear.a || 0.85 };
    for (const s of ['hat', 'glasses']) { const it = W[s] && ITEMS[W[s]]; if (it) { o[s] = it.wear.acc; o[s + 'C'] = it.wear.c; } }
  }
  // gear shows over anything: a helmet on the head, the vest and the backpack
  const helm = W.hat && ITEMS[W.hat]; if (helm && helm.wear.armor) { o.hat = helm.wear.acc; o.hatC = helm.wear.c; }
  for (const s of ['vest', 'pack']) { const it = W[s] && ITEMS[W[s]]; if (it) { o[s] = it.wear.acc; o[s + 'C'] = it.wear.c; } }
  const bd = W.body && ITEMS[W.body]; o.body = bd ? bd.wear.body : 'soldier';
  if (!CHARS[o.body]) o.body = 'soldier';                // a character still loading (or missing) falls back to the soldier
  if (o.body === 'michelle') { if (!W.top && !suit) o.top = { c: 0x8a3a5a, a: 0.0 }; if (!W.pants && !suit) o.pants = { c: 0x2f3f5a, a: 0.0 }; o.head = undefined; }
  return o;
}
function applyOutfit() {
  const o = outfitFromWearing(), prevBody = player.outfit && player.outfit.body;
  player.outfit = o;
  if (typeof onLookChanged === 'function') onLookChanged();
  if (!RIG.ok) return;
  if ((prevBody || 'soldier') !== o.body && CHARS[o.body]) { buildPlayerRig(); }
  else if (RIG.body) dressBody(RIG.body, o);
  hudDirty = true;
}
/* wear: from the wardrobe (clothes you own for good) or from the bag (gear) */
function wearItem(id, quiet) {
  const it = ITEMS[id]; if (!it || !it.wear || !ownsWear(id)) return false;
  const slot = it.wear.slot, cos = isCosmetic(it);
  if (slot === 'body' && it.id === 'outfit_soldier') { delete INV.wearing.body; delete ACCOUNT.look.body; }
  else { INV.wearing[slot] = id; if (cos) ACCOUNT.look[slot] = id; }
  if (cos && SUIT_PARTS.includes(slot)) { delete INV.wearing.suit; delete ACCOUNT.look.suit; }
  if (cos) accSoon();
  applyOutfit(); AUDIO.equip();
  if (!quiet) toast('لبست ' + it.name, it.wear.armor ? 'تحميك من العضّ والرصاص' : it.wear.cap ? 'حقيبة أوسع: ' + toAr(bagCap()) : slot === 'suit' ? 'بدلة كاملة من الرأس إلى القدم' : '');
  if (typeof saveSoon === 'function') saveSoon(); return true;
}
function takeOff(slot) {
  const was = INV.wearing[slot] && ITEMS[INV.wearing[slot]];
  delete INV.wearing[slot];
  if (COS_SLOTS.includes(slot) && (!was || isCosmetic(was))) { delete ACCOUNT.look[slot]; accSoon(); }
  else if (slot === 'hat' && ACCOUNT.look.hat) INV.wearing.hat = ACCOUNT.look.hat;     // the helmet comes off: your own hat is back
  applyOutfit(); AUDIO.equip(); if (typeof saveSoon === 'function') saveSoon();
}
