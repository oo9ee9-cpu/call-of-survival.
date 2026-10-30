/* ═════════ items: more than 800 things to gather, craft, wear, eat, build and sell — generated from families, every one with a recipe ═════════ */
const ITEMS = {}, RECIPES = [], ITEM_LIST = [];
const CATS = [
  ['all', 'الكل'], ['res', 'موارد'], ['mat', 'مواد'], ['tool', 'أدوات'], ['weapon', 'أسلحة'], ['ammo', 'ذخيرة'], ['wear', 'ملابس ودروع'],
  ['food', 'طعام'], ['med', 'علاج'], ['build', 'بناء'], ['furn', 'أثاث'], ['light', 'إضاءة'], ['farm', 'زراعة'], ['deco', 'زينة'], ['vehicle', 'مركبات'], ['treasure', 'كنوز'],
];
const STATION_AR = { workbench: 'طاولة العمل', furnace: 'الفرن', anvil: 'السندان', campfire: 'نار أو موقد', loom: 'النول', tailor: 'طاولة الخياطة' };
function item(id, name, cat, o = {}) {
  const it = Object.assign({ id, name, cat, icon: o.icon || cat, color: 0xd8c9a6, w: 1, price: 2 }, o);
  ITEMS[id] = it; ITEM_LIST.push(it);
  if (o.recipe) RECIPES.push({ id, out: o.out || 1, needs: o.recipe, station: o.station || null });
  return it;
}
const R = (...pairs) => { const out = []; for (let i = 0; i < pairs.length; i += 2) out.push([pairs[i], pairs[i + 1]]); return out; };

/* ── raw resources ── */
const RES = [
  ['wood', 'خشب', 0x8a6a45, 0.5, 1], ['stone', 'حجر', 0x8d8478, 0.8, 1], ['fiber', 'ألياف نباتية', 0x9aa060, 0.1, 1], ['resin', 'راتنج', 0xc89a3a, 0.2, 3],
  ['clay', 'طين', 0xa86a4a, 0.8, 2], ['sand', 'رمل', 0xd8c49a, 0.8, 1], ['coal', 'فحم', 0x2a2a2c, 0.6, 4], ['iron_ore', 'خام الحديد', 0x8a6a5a, 1, 6],
  ['copper_ore', 'خام النحاس', 0x5a8a6a, 1, 5], ['gold_ore', 'خام الذهب', 0xd8b04a, 1, 18], ['silver_ore', 'خام الفضة', 0xb8bcc0, 1, 12], ['sulfur', 'كبريت', 0xd8d04a, 0.4, 4],
  ['saltpeter', 'ملح البارود', 0xe8e6e0, 0.4, 4], ['salt', 'ملح', 0xf0f0f0, 0.2, 2], ['ruby', 'ياقوت أحمر', 0xc8203a, 0.1, 90], ['emerald', 'زمرد', 0x20a85a, 0.1, 90],
  ['sapphire', 'ياقوت أزرق', 0x2050c8, 0.1, 95], ['diamond', 'ألماس', 0xb8f0f8, 0.1, 160], ['amethyst', 'جمشت', 0x8a4ac8, 0.1, 60], ['bone', 'عظم', 0xe8e0c8, 0.3, 2],
  ['hide', 'جلد خام', 0x8a6a4a, 0.6, 5], ['feather', 'ريش', 0xf0ece0, 0.05, 1], ['wool', 'صوف', 0xf0ece0, 0.2, 3], ['scrap', 'خردة معدنية', 0x7a7f84, 1, 3],
  ['oil', 'نفط خام', 0x1a1a1a, 1, 6], ['honey', 'عسل', 0xd8a030, 0.3, 8], ['egg', 'بيض', 0xf0e8d8, 0.1, 2], ['milk', 'حليب', 0xf4f4f0, 0.5, 3],
  ['water', 'ماء', 0x6ab0d8, 0.5, 1], ['herbs', 'أعشاب طبية', 0x5a9a4a, 0.05, 4], ['mushroom', 'فطر', 0xb89a7a, 0.1, 3], ['berries', 'توت بري', 0x8a2a5a, 0.1, 2],
  ['flint', 'صوّان', 0x5a5a5e, 0.3, 2], ['ice', 'جليد', 0xd8f0f8, 0.6, 1], ['cactus_pulp', 'لبّ الصبّار', 0x6a9a4a, 0.3, 2], ['seashell', 'صدفة بحرية', 0xf0d8c8, 0.1, 3],
];
for (const [id, name, color, w, price] of RES) item(id, name, 'res', { color, w, price, icon: id === 'wood' ? 'wood' : id === 'stone' ? 'stone' : 'gem' });
/* crops and foraged food */
const CROPS = [['wheat', 'قمح', 0xd8b048], ['corn', 'ذرة', 0xe8c040], ['potato', 'بطاطا', 0xb8905a], ['tomato', 'طماطم', 0xd83a2a], ['carrot', 'جزر', 0xe8782a], ['pumpkin', 'يقطين', 0xe8882a],
  ['cotton', 'قطن', 0xf4f2ee], ['sunflower', 'دوّار الشمس', 0x3a3020], ['barley', 'شعير', 0xc8a858], ['olive', 'زيتون', 0x5a6a2a], ['dates', 'تمر', 0x8a4a1a], ['apple', 'تفاح', 0xc83030],
  ['orange', 'برتقال', 0xe8902a], ['lemon', 'ليمون', 0xe8d84a], ['cucumber', 'خيار', 0x4a8a3a], ['onion', 'بصل', 0xd8b8a8], ['garlic', 'ثوم', 0xf0e8e0], ['pepper', 'فلفل', 0x3a9a3a], ['eggplant', 'باذنجان', 0x4a2a5a], ['watermelon', 'بطيخ', 0x3a7a3a]];
for (const [id, name, color] of CROPS) {
  item(id, name, 'food', { color, w: 0.2, price: 3, food: 6, icon: 'crop' });
  item('seed_' + id, 'بذور ' + name, 'farm', { color, w: 0.02, price: 2, seed: id, icon: 'seed', recipe: R(id, 1), out: 3 });
}
/* meat and fish, raw and cooked */
const MEAT = [['beef', 'لحم بقر'], ['mutton', 'لحم غنم'], ['venison', 'لحم غزال'], ['boar', 'لحم خنزير بري'], ['chicken', 'لحم دجاج'], ['rabbit', 'لحم أرنب'], ['goat', 'لحم ماعز'], ['camel', 'لحم جمل']];
for (const [id, name] of MEAT) {
  item('raw_' + id, name + ' نيء', 'food', { color: 0xc8504a, w: 0.5, price: 4, food: 3, sick: 0.3, icon: 'meat' });
  item('cooked_' + id, name + ' مشوي', 'food', { color: 0x8a4a2a, w: 0.4, price: 9, food: 22, icon: 'meat', recipe: R('raw_' + id, 1), station: 'campfire' });
}
const FISH = [['sardine', 'سردين', 'sea'], ['bream', 'سمك الدنيس', 'sea'], ['tuna', 'تونة', 'sea'], ['mackerel', 'إسقمري', 'sea'], ['grouper', 'هامور', 'sea'], ['crab', 'سلطعون', 'sea'],
  ['trout', 'سلمون مرقّط', 'lake'], ['carp', 'شبّوط', 'lake'], ['catfish', 'سمك القرموط', 'lake'], ['perch', 'فرخ', 'lake'], ['eel', 'أنقليس', 'river'], ['pike', 'كراكي', 'river']];
for (const [id, name, water] of FISH) {
  item('fish_' + id, name, 'food', { color: 0x8aa0b0, w: 0.4, price: 6, food: 3, sick: 0.25, icon: 'fish', water });
  item('grilled_' + id, name + ' مشوي', 'food', { color: 0xa8784a, w: 0.3, price: 12, food: 20, icon: 'fish', recipe: R('fish_' + id, 1), station: 'campfire' });
}

/* ── processed materials ── */
const MATS = [
  ['plank', 'ألواح خشب', 0xb08a5a, R('wood', 2), null, 2], ['beam', 'عارضة خشب', 0x8a6a45, R('wood', 4), null, 4], ['charcoal', 'فحم نباتي', 0x2a2420, R('wood', 3), 'furnace', 3],
  ['rope', 'حبل', 0xb8a070, R('fiber', 4), null, 3], ['cloth', 'قماش', 0xe8e0d0, R('cotton', 3), 'loom', 5], ['thread', 'خيط', 0xf0ece0, R('cotton', 1), null, 1],
  ['leather', 'جلد مدبوغ', 0x7a4a2a, R('hide', 2, 'salt', 1), null, 10], ['wool_cloth', 'قماش صوف', 0xd8d0c0, R('wool', 3), 'loom', 7],
  ['iron', 'سبيكة حديد', 0x9aa1a8, R('iron_ore', 2, 'coal', 1), 'furnace', 14], ['copper', 'سبيكة نحاس', 0xb8733a, R('copper_ore', 2, 'coal', 1), 'furnace', 12],
  ['gold', 'سبيكة ذهب', 0xd8b04a, R('gold_ore', 2, 'coal', 1), 'furnace', 45], ['silver', 'سبيكة فضة', 0xc8ccd0, R('silver_ore', 2, 'coal', 1), 'furnace', 30],
  ['steel', 'سبيكة فولاذ', 0xc8cdd2, R('iron', 2, 'coal', 2), 'furnace', 35], ['bronze', 'سبيكة برونز', 0xa87a3a, R('copper', 2, 'scrap', 1), 'furnace', 26],
  ['glass', 'زجاج', 0xb8d8e0, R('sand', 3, 'coal', 1), 'furnace', 6], ['brick', 'طوب', 0xa85a3a, R('clay', 2, 'coal', 1), 'furnace', 4], ['cement', 'إسمنت', 0xb8b4ac, R('stone', 2, 'sand', 1, 'clay', 1), 'furnace', 5],
  ['concrete', 'خرسانة', 0x9a9690, R('cement', 1, 'stone', 2, 'water', 1), null, 7], ['nails', 'مسامير', 0x8a8f94, R('iron', 1), 'anvil', 2], ['gear', 'تروس', 0x9aa1a8, R('iron', 2), 'anvil', 10],
  ['spring', 'نابض', 0x9aa1a8, R('steel', 1), 'anvil', 12], ['pipe', 'أنبوب معدني', 0x8a8f94, R('iron', 2), 'anvil', 9], ['wire', 'سلك', 0xb8733a, R('copper', 1), 'anvil', 5],
  ['gunpowder', 'بارود', 0x3a3a3a, R('charcoal', 1, 'sulfur', 1, 'saltpeter', 2), null, 8], ['flour', 'طحين', 0xf4f0e8, R('wheat', 3), null, 3], ['sugar', 'سكر', 0xf8f8f8, R('dates', 4), null, 3],
  ['glue', 'غراء', 0xd8c890, R('resin', 2, 'bone', 1), 'campfire', 4], ['fuel', 'وقود', 0x6a5a2a, R('oil', 2), 'furnace', 12], ['battery', 'بطارية', 0x3a3a3a, R('copper', 1, 'scrap', 2, 'sulfur', 1), 'anvil', 20],
  ['circuit', 'دارة كهربائية', 0x2a6a3a, R('wire', 2, 'glass', 1, 'gold', 1), 'anvil', 40], ['lens', 'عدسة', 0xd8f0f8, R('glass', 2), 'anvil', 15], ['dye_base', 'صبغة أساسية', 0xd8d0c0, R('berries', 2, 'water', 1), null, 2],
  ['arrowhead', 'رؤوس سهام', 0x8a8f94, R('flint', 1), null, 1], ['bandage_cloth', 'شاش', 0xf4f4f0, R('cloth', 1), null, 3], ['paper', 'ورق', 0xf0ece0, R('wood', 1, 'water', 1), null, 1],
];
for (const [id, name, color, recipe, station, price] of MATS) item(id, name, 'mat', { color, recipe, station, price, w: 0.4, icon: 'ingot' });
const COLORS = [['black', 'أسود', 0x1e1e20], ['white', 'أبيض', 0xe8e6e0], ['gray', 'رمادي', 0x7a7a7a], ['red', 'أحمر', 0xa8302a], ['blue', 'أزرق', 0x2f4a8a], ['navy', 'كحلي', 0x1f2a44],
  ['green', 'أخضر', 0x3f6a3a], ['olive', 'زيتي', 0x56603f], ['brown', 'بني', 0x6b4a2f], ['beige', 'بيج', 0xc8b48a], ['yellow', 'أصفر', 0xd8b030], ['orange', 'برتقالي', 0xd8702a],
  ['pink', 'وردي', 0xd88aa0], ['purple', 'بنفسجي', 0x6a3a8a], ['sky', 'سماوي', 0x5aa8d8], ['wine', 'خمري', 0x6a1a2a]];
for (const [cid, cname, c] of COLORS) {
  item('dye_' + cid, 'صبغة ' + cname, 'mat', { color: c, w: 0.1, price: 3, icon: 'dye', recipe: R('dye_base', 1, cid === 'black' ? 'charcoal' : cid === 'white' ? 'bone' : 'berries', 1) });
  item('paint_' + cid, 'دهان ' + cname, 'mat', { color: c, w: 0.5, price: 6, icon: 'dye', recipe: R('dye_' + cid, 1, 'oil', 1) });
}

/* ── tools: every kind in every tier ── */
const TIERS = [['wood', 'خشبي', 'plank', 0.7], ['stone', 'حجري', 'stone', 0.85], ['copper', 'نحاسي', 'copper', 1.0], ['iron', 'حديدي', 'iron', 1.2], ['steel', 'فولاذي', 'steel', 1.45], ['gold', 'ذهبي', 'gold', 1.3], ['diamond', 'ماسي', 'diamond', 1.8]];
const TOOL_KINDS = [['axe', 'فأس', 'axe', 3], ['pickaxe', 'معول', 'pickaxe', 3], ['shovel', 'مجرفة', 'shovel', 2], ['hoe', 'معزقة', 'hoe', 2], ['hammer', 'مطرقة', 'hammer', 2], ['knife', 'سكين', 'knife', 1], ['sickle', 'منجل', 'hoe', 2], ['saw', 'منشار', 'knife', 2]];
for (const [tid, tname, mat, mul] of TIERS) for (const [kid, kname, tool, n] of TOOL_KINDS) {
  const station = tid === 'wood' || tid === 'stone' ? null : tid === 'diamond' ? 'anvil' : 'anvil';
  const recipe = tid === 'diamond' ? R('diamond', n, 'steel', 1, 'plank', 1) : tid === 'wood' ? R('plank', n + 1) : R(mat, n, 'plank', 1);
  if (tid === 'stone') recipe.push(['rope', 1]);
  item(kid + '_' + tid, kname + ' ' + tname, 'tool', { tool, tier: tid, dmgMul: mul, color: TIER_METAL[tid], recipe, station, w: 1.5, price: Math.round(8 * mul * mul * (tid === 'diamond' ? 6 : tid === 'gold' ? 3 : 1)), icon: tool, durable: true });
}
for (const [tid, tname, mat, mul] of TIERS) {
  item('rod_' + tid, 'صنّارة ' + tname, 'tool', { tool: 'rod', tier: tid, dmgMul: mul, color: TIER_METAL[tid], recipe: tid === 'wood' ? R('plank', 2, 'thread', 2) : R(mat, 1, 'plank', 2, 'thread', 2), station: tid === 'wood' || tid === 'stone' ? null : 'anvil', w: 1, price: Math.round(10 * mul), icon: 'rod' });
}
item('torch', 'شعلة', 'light', { tool: 'torch', color: 0xd8702a, recipe: R('wood', 1, 'resin', 1), w: 0.5, price: 3, icon: 'torch', light: true });
item('metal_detector', 'كاشف معادن', 'tool', { tool: 'hand', color: 0x9aa1a8, recipe: R('circuit', 1, 'battery', 1, 'pipe', 1), station: 'anvil', w: 2, price: 220, icon: 'detector', detector: true });
item('binoculars', 'منظار', 'tool', { tool: 'hand', color: 0x2a2a2a, recipe: R('lens', 2, 'iron', 1), station: 'anvil', w: 0.6, price: 60, icon: 'detector' });
item('compass_item', 'بوصلة يد', 'tool', { tool: 'hand', color: 0xb8733a, recipe: R('copper', 1, 'glass', 1, 'iron', 1), station: 'anvil', w: 0.2, price: 30, icon: 'detector' });
item('watering_can', 'مرشّة ماء', 'farm', { tool: 'hand', color: 0x5a8a9a, recipe: R('iron', 2), station: 'anvil', w: 1, price: 18, icon: 'can' });
item('treasure_map', 'خريطة كنز', 'treasure', { color: 0xc8a870, w: 0.05, price: 120, icon: 'map', rare: true, mapItem: true });

/* ── weapons ── */
const WEAPON_KINDS = [['sword', 'سيف', 'sword', 4], ['spear', 'رمح', 'spear', 2], ['mace', 'صولجان', 'hammer', 4], ['dagger', 'خنجر', 'knife', 2], ['waraxe', 'فأس حرب', 'axe', 5]];
for (const [tid, tname, mat, mul] of TIERS) for (const [kid, kname, tool, n] of WEAPON_KINDS) {
  const recipe = tid === 'diamond' ? R('diamond', n, 'steel', 2, 'leather', 1) : tid === 'wood' ? R('plank', n + 2) : R(mat, n, 'leather', 1);
  item(kid + '_' + tid, kname + ' ' + tname, 'weapon', { tool, tier: tid, dmgMul: mul * 1.15, color: TIER_METAL[tid], recipe, station: tid === 'wood' || tid === 'stone' ? 'workbench' : 'anvil', w: 2, price: Math.round(14 * mul * mul * (tid === 'diamond' ? 6 : tid === 'gold' ? 3 : 1)), icon: tool === 'hammer' ? 'mace' : tool });
}
const GUN_ITEMS = [
  ['pistol', 'مسدس', 'pistol', 1, 160, R('steel', 3, 'spring', 1, 'gear', 1)], ['revolver', 'مسدس دوّار', 'pistol', 1.3, 220, R('steel', 4, 'spring', 1, 'gear', 2)],
  ['smg', 'رشاش صغير', 'rifle', 0.75, 420, R('steel', 6, 'spring', 2, 'gear', 2)], ['rifle', 'بندقية هجومية', 'rifle', 1, 600, R('steel', 8, 'spring', 2, 'gear', 3, 'plank', 2)],
  ['shotgun', 'بندقية خرطوش', 'shotgun', 1, 380, R('steel', 6, 'spring', 1, 'plank', 3)], ['hunting', 'بندقية صيد', 'sniper', 0.8, 450, R('steel', 6, 'lens', 1, 'plank', 3)],
  ['sniper', 'بندقية قنص', 'sniper', 1.2, 900, R('steel', 10, 'lens', 2, 'spring', 2, 'gear', 3)],
];
for (const [id, name, tool, mul, price, recipe] of GUN_ITEMS) item(id, name, 'weapon', { tool, gun: true, dmgMul: mul, color: 0x2b2f33, recipe, station: 'anvil', w: tool === 'pistol' ? 1 : 3.5, price, icon: tool });
for (const [id, name, tool, mul] of [['bow_short', 'قوس قصير', 'bow', 0.8], ['bow_long', 'قوس طويل', 'bow', 1.1], ['crossbow', 'نشّاب', 'bow', 1.4]]) item(id, name, 'weapon', { tool, dmgMul: mul, color: 0x8a6a45, recipe: id === 'crossbow' ? R('plank', 3, 'iron', 2, 'rope', 2, 'spring', 1) : R('wood', id === 'bow_long' ? 4 : 3, 'rope', 2), station: 'workbench', w: 1, price: Math.round(40 * mul), icon: 'bow' });
const AMMO = [['ammo9', 'طلقات ٩ ملم', R('copper', 1, 'gunpowder', 1), 20, 2], ['ammo556', 'طلقات ٥٫٥٦ ملم', R('copper', 1, 'gunpowder', 1), 15, 3], ['ammo762', 'طلقات ٧٫٦٢ ملم', R('copper', 1, 'gunpowder', 2), 10, 5], ['shells', 'خرطوش', R('copper', 1, 'gunpowder', 1, 'scrap', 1), 8, 4]];
for (const [id, name, recipe, out, price] of AMMO) item(id, name, 'ammo', { color: 0xc9a24a, recipe, out, station: 'anvil', w: 0.02, price, icon: 'ammo' });
for (const [tid, tname, head] of [['wood', 'خشبية', 'wood'], ['flint', 'صوّانية', 'arrowhead'], ['iron', 'حديدية', 'iron'], ['steel', 'فولاذية', 'steel'], ['fire', 'نارية', 'resin']]) item('arrow_' + tid, 'سهام ' + tname, 'ammo', { color: 0x8a6a45, recipe: R('wood', 1, head, 1, 'feather', 1), out: 6, w: 0.02, price: 1, icon: 'arrow' });

/* ── wearables: clothes in every colour, hats, glasses, armour, backpacks ── */
const TOPS = [['tshirt', 'تيشيرت', 0.9, R('cloth', 2)], ['shirt', 'قميص', 0.85, R('cloth', 3, 'thread', 1)], ['jacket', 'جاكيت', 0.85, R('cloth', 3, 'leather', 1)], ['hoodie', 'هودي', 0.9, R('cloth', 4)],
  ['coat', 'معطف', 0.85, R('wool_cloth', 4, 'thread', 2)], ['sweater', 'كنزة صوف', 0.9, R('wool_cloth', 3)], ['thobe', 'ثوب', 0.9, R('cloth', 6, 'thread', 2)]];
const PANTS = [['jeans', 'جينز', 0.85, R('cloth', 3)], ['cargo', 'بنطال كارغو', 0.85, R('cloth', 3, 'thread', 1)], ['shorts', 'شورت', 0.85, R('cloth', 2)], ['track', 'بنطال رياضي', 0.9, R('cloth', 2)]];
const SHOES = [['sneakers', 'حذاء رياضي', R('leather', 1, 'cloth', 1)], ['boots', 'جزمة', R('leather', 2)], ['sandals', 'صندل', R('leather', 1)]];
for (const [cid, cname, c] of COLORS) {
  for (const [kid, kname, a, rec] of TOPS) item('top_' + kid + '_' + cid, kname + ' ' + cname, 'wear', { color: c, wear: { slot: 'top', c, a, p: 'solid', both: kid === 'thobe' }, recipe: rec.concat([['dye_' + cid, 1]]), station: 'tailor', w: 0.5, price: 25 + rec.length * 10, icon: 'shirt' });
  if (COLORS.indexOf(COLORS.find((q) => q[0] === cid)) % 2 === 0 || ['blue', 'navy', 'black', 'gray', 'beige', 'brown', 'olive'].includes(cid)) for (const [kid, kname, a, rec] of PANTS) item('pants_' + kid + '_' + cid, kname + ' ' + cname, 'wear', { color: c, wear: { slot: 'pants', c, a, p: 'solid' }, recipe: rec.concat([['dye_' + cid, 1]]), station: 'tailor', w: 0.5, price: 30, icon: 'pants' });
  if (['black', 'white', 'brown', 'gray', 'red', 'blue', 'beige'].includes(cid)) for (const [kid, kname, rec] of SHOES) item('shoes_' + kid + '_' + cid, kname + ' ' + cname, 'wear', { color: c, wear: { slot: 'shoes', c, a: 0.85 }, recipe: rec.concat([['dye_' + cid, 1]]), station: 'tailor', w: 0.6, price: 35, icon: 'shoe' });
  item('gloves_' + cid, 'قفّازات ' + cname, 'wear', { color: c, wear: { slot: 'hands', c, a: 0.85 }, recipe: R('leather', 1, 'dye_' + cid, 1), station: 'tailor', w: 0.1, price: 15, icon: 'glove' });
  item('cap_' + cid, 'قبعة ' + cname, 'wear', { color: c, wear: { slot: 'hat', acc: 'cap', c }, recipe: R('cloth', 1, 'dye_' + cid, 1), station: 'tailor', w: 0.1, price: 18, icon: 'hat' });
  if (['black', 'gray', 'red', 'navy', 'green', 'orange', 'wine'].includes(cid)) item('beanie_' + cid, 'طاقية صوف ' + cname, 'wear', { color: c, wear: { slot: 'hat', acc: 'beanie', c }, recipe: R('wool_cloth', 1, 'dye_' + cid, 1), station: 'tailor', w: 0.1, price: 16, icon: 'hat' });
  if (['red', 'black', 'blue', 'olive', 'white'].includes(cid)) item('bandana_' + cid, 'عصابة رأس ' + cname, 'wear', { color: c, wear: { slot: 'hat', acc: 'bandana', c }, recipe: R('cloth', 1, 'dye_' + cid, 1), station: 'tailor', w: 0.05, price: 10, icon: 'hat' });
  if (['black', 'olive', 'navy', 'brown', 'red', 'blue'].includes(cid)) {
    item('pack_' + cid, 'حقيبة ظهر ' + cname, 'wear', { color: c, wear: { slot: 'pack', acc: 'pack', c, cap: 120 }, recipe: R('cloth', 4, 'leather', 1, 'dye_' + cid, 1), station: 'tailor', w: 0.8, price: 60, icon: 'bag' });
    item('bigpack_' + cid, 'حقيبة رحلات كبيرة ' + cname, 'wear', { color: c, wear: { slot: 'pack', acc: 'bigpack', c, cap: 260 }, recipe: R('cloth', 8, 'leather', 2, 'rope', 2, 'dye_' + cid, 1), station: 'tailor', w: 1.2, price: 140, icon: 'bag' });
  }
}
for (const [pid, pname, c, pat] of [['woodland', 'مموّه غابات', 0x56603f, 'camo'], ['desert', 'مموّه صحراوي', 0xc8b080, 'desert'], ['urban', 'مموّه مدني', 0x7a7a7a, 'urban'], ['snow', 'مموّه ثلجي', 0xd8dde0, 'urban'], ['plaid', 'مربّعات', 0x8a2a2a, 'checks'], ['stripes', 'مخطّط', 0x2f4a8a, 'stripes']]) {
  item('top_military_' + pid, 'سترة ' + pname, 'wear', { color: c, wear: { slot: 'top', c, a: 0.9, p: pat }, recipe: R('cloth', 4, 'thread', 2, 'dye_olive', 1), station: 'tailor', w: 0.6, price: 70, icon: 'shirt' });
  item('pants_military_' + pid, 'بنطال ' + pname, 'wear', { color: c, wear: { slot: 'pants', c, a: 0.9, p: pat }, recipe: R('cloth', 3, 'thread', 2, 'dye_olive', 1), station: 'tailor', w: 0.6, price: 55, icon: 'pants' });
}
for (const [id, name, c, acc] of [['shemagh_red', 'شماغ أحمر', 0xd8d0c4, 'shemagh'], ['shemagh_white', 'غترة بيضاء', 0xf4f2ee, 'shemagh'], ['shemagh_black', 'شماغ أسود', 0x2a2a2a, 'shemagh'], ['cowboy_brown', 'قبعة رعاة البقر بنية', 0x6b4a2f, 'cowboy'], ['cowboy_black', 'قبعة رعاة البقر سوداء', 0x1e1e20, 'cowboy'], ['cowboy_beige', 'قبعة رعاة البقر فاتحة', 0xc8b48a, 'cowboy']])
  item(id, name, 'wear', { color: c, wear: { slot: 'hat', acc, c }, recipe: R(acc === 'shemagh' ? 'cloth' : 'leather', 2, 'thread', 1), station: 'tailor', w: 0.2, price: 45, icon: 'hat' });
for (const [tid, tname, mat, armor] of [['cloth', 'قماشية', 'cloth', 0.9], ['leather', 'جلدية', 'leather', 0.8], ['kevlar', 'كيفلار', 'steel', 0.6], ['steel', 'فولاذية', 'steel', 0.5]]) {
  item('helmet_' + tid, 'خوذة ' + tname, 'wear', { color: tid === 'steel' ? 0x7a7f84 : 0x4a5038, wear: { slot: 'hat', acc: 'helmet', c: tid === 'steel' ? 0x7a7f84 : 0x4a5038, armor: armor + 0.05 }, recipe: R(mat, 3), station: tid === 'cloth' ? 'tailor' : 'anvil', w: 1, price: Math.round(60 / armor), icon: 'helmet' });
  item('vest_' + tid, 'سترة واقية ' + tname, 'wear', { color: 0x4a5038, wear: { slot: 'vest', acc: 'vest', c: tid === 'steel' ? 0x5a5f64 : 0x4a5038, armor }, recipe: R(mat, 5, 'leather', 1), station: tid === 'cloth' ? 'tailor' : 'anvil', w: 3, price: Math.round(120 / armor), icon: 'vest' });
}
for (const [id, name, acc, c] of [['sunglasses_black', 'نظارة شمسية سوداء', 'sunglasses', 0x111214], ['sunglasses_gold', 'نظارة شمسية ذهبية', 'sunglasses', 0xb8902a], ['sunglasses_blue', 'نظارة شمسية زرقاء', 'sunglasses', 0x2a4a8a], ['goggles_ski', 'نظارة تزلّج', 'goggles', 0x2a2a2a], ['goggles_desert', 'نظارة صحراء', 'goggles', 0x8a6a45]])
  item(id, name, 'wear', { color: c, wear: { slot: 'glasses', acc, c }, recipe: R('glass', 1, 'iron', 1), station: 'anvil', w: 0.05, price: 40, icon: 'glasses' });
item('outfit_michelle', 'هيئة نسائية (ميشيل)', 'wear', { color: 0xc89a7a, wear: { slot: 'body', body: 'michelle' }, price: 200, w: 0, icon: 'person', shopOnly: true });
// the owner's own characters: chosen when the account is made, and in the wardrobe after that
item('outfit_casual', 'ليلى', 'wear', { color: 0xd8c8b0, wear: { slot: 'body', body: 'casual' }, price: 0, w: 0, icon: 'person', shopOnly: true, rarity: 'legendary' });
item('outfit_blonde', 'سارة', 'wear', { color: 0xe8d090, wear: { slot: 'body', body: 'blonde' }, price: 0, w: 0, icon: 'person', shopOnly: true, rarity: 'legendary' });
item('outfit_soldier', 'هيئة الجندي', 'wear', { color: 0x56603f, wear: { slot: 'body', body: 'soldier' }, price: 0, w: 0, icon: 'person', shopOnly: true });

/* ── food and medicine ── */
const DISHES = [['bread', 'خبز', R('flour', 2, 'water', 1), 25], ['corn_bread', 'خبز ذرة', R('corn', 3, 'water', 1), 22], ['flatbread', 'خبز صاج', R('flour', 1, 'water', 1), 14], ['falafel', 'فلافل', R('flour', 1, 'onion', 1, 'garlic', 1), 20],
  ['hummus', 'حمص بطحينة', R('sunflower', 2, 'garlic', 1, 'lemon', 1), 18], ['salad', 'سلطة', R('tomato', 1, 'cucumber', 1, 'onion', 1), 14], ['fattoush', 'فتّوش', R('flatbread', 1, 'tomato', 1, 'cucumber', 1), 24],
  ['soup_veg', 'شوربة خضار', R('potato', 1, 'carrot', 1, 'onion', 1, 'water', 1), 26], ['soup_lentil', 'شوربة عدس', R('barley', 2, 'onion', 1, 'water', 1), 26], ['soup_fish', 'شوربة سمك', R('fish_sardine', 1, 'potato', 1, 'water', 1), 30],
  ['stew_beef', 'يخنة لحم', R('raw_beef', 1, 'potato', 1, 'carrot', 1, 'water', 1), 40], ['stew_lamb', 'يخنة غنم', R('raw_mutton', 1, 'onion', 1, 'tomato', 1, 'water', 1), 40], ['kabsa', 'كبسة دجاج', R('raw_chicken', 1, 'barley', 2, 'onion', 1, 'pepper', 1), 45],
  ['mansaf', 'منسف', R('raw_mutton', 1, 'barley', 2, 'milk', 1), 50], ['shawarma', 'شاورما', R('raw_chicken', 1, 'flatbread', 1, 'garlic', 1), 38], ['kebab', 'كباب', R('raw_mutton', 1, 'onion', 1), 32],
  ['pie_apple', 'فطيرة تفاح', R('flour', 2, 'apple', 2, 'sugar', 1), 30], ['pie_pumpkin', 'فطيرة يقطين', R('flour', 2, 'pumpkin', 1, 'sugar', 1), 30], ['pie_meat', 'فطيرة لحم', R('flour', 2, 'raw_beef', 1), 34],
  ['omelette', 'عجة بيض', R('egg', 2, 'onion', 1), 22], ['fries', 'بطاطا مقلية', R('potato', 2, 'salt', 1), 18], ['popcorn', 'فشار', R('corn', 2, 'salt', 1), 10], ['baked_potato', 'بطاطا مشوية', R('potato', 1), 12],
  ['roast_corn', 'ذرة مشوية', R('corn', 1), 10], ['date_cookies', 'معمول بالتمر', R('flour', 1, 'dates', 2), 20], ['halva', 'حلاوة', R('sunflower', 2, 'sugar', 1), 18], ['jam', 'مربى توت', R('berries', 3, 'sugar', 1), 14],
  ['juice_orange', 'عصير برتقال', R('orange', 3, 'water', 1), 12], ['juice_lemon', 'عصير ليمون بالنعناع', R('lemon', 2, 'herbs', 1, 'water', 1), 12], ['juice_watermelon', 'عصير بطيخ', R('watermelon', 1), 14],
  ['tea', 'شاي', R('herbs', 1, 'water', 1, 'sugar', 1), 8], ['coffee', 'قهوة عربية', R('herbs', 1, 'water', 1), 8], ['milk_warm', 'حليب دافئ', R('milk', 1, 'honey', 1), 12], ['mushroom_soup', 'شوربة فطر', R('mushroom', 3, 'water', 1), 24]];
for (const [id, name, recipe, food] of DISHES) item(id, name, 'food', { color: 0xc8904a, recipe, station: 'campfire', food, w: 0.3, price: Math.round(food * 0.6), icon: 'food' });
const MEDS = [['bandage', 'ضماد', R('bandage_cloth', 1), 18, null], ['medkit', 'حقيبة إسعاف', R('bandage_cloth', 2, 'herbs', 2, 'cloth', 1), 60, 'workbench'], ['splint', 'جبيرة', R('plank', 1, 'bandage_cloth', 1), 25, null],
  ['painkiller', 'مسكّن ألم', R('herbs', 2, 'water', 1), 22, 'campfire'], ['antibiotic', 'مضاد حيوي', R('herbs', 3, 'mushroom', 1, 'water', 1), 35, 'campfire'], ['herbal_tea', 'منقوع أعشاب', R('herbs', 2, 'water', 1), 15, 'campfire'],
  ['honey_salve', 'مرهم العسل', R('honey', 1, 'herbs', 1), 28, null], ['aloe_gel', 'هلام الصبّار', R('cactus_pulp', 2), 20, null], ['energy_drink', 'مشروب طاقة', R('sugar', 1, 'water', 1, 'herbs', 1), 10, null], ['stim', 'حقنة منشّطة', R('herbs', 3, 'glass', 1, 'sugar', 1), 45, 'workbench']];
for (const [id, name, recipe, heal, station] of MEDS) item(id, name, 'med', { color: 0xd84a5a, recipe, station, heal, w: 0.1, price: Math.round(heal * 0.8), icon: 'med' });
/* drinks fill the thirst bar: bottles come back empty to be filled again at a lake or a river; fruit and soup quench a little */
item('bottle_empty', 'قنينة فارغة', 'mat', { color: 0xb8d8e0, recipe: R('glass', 1), station: 'furnace', w: 0.2, price: 2, icon: 'can' });
item('bottle_water', 'قنينة ماء', 'food', { color: 0x6ab0d8, drink: 50, bottle: true, recipe: R('bottle_empty', 1, 'water', 1), w: 0.6, price: 4, icon: 'can' });
item('soda', 'مشروب غازي', 'food', { color: 0xc8302a, drink: 30, energy: 40, w: 0.35, price: 5, icon: 'can' });
item('juice_box', 'علبة عصير', 'food', { color: 0xe8902a, drink: 34, food: 3, w: 0.3, price: 4, icon: 'can' });
item('canned_beans', 'فاصولياء معلّبة', 'food', { color: 0x9a5a3a, food: 26, w: 0.4, price: 6, icon: 'can' });
item('canned_meat', 'لحم معلّب', 'food', { color: 0xb8443a, food: 32, w: 0.4, price: 8, icon: 'can' });
item('mre', 'وجبة جاهزة عسكرية', 'food', { color: 0x56603f, food: 42, juicy: 10, w: 0.6, price: 14, icon: 'food' });
Object.assign(ITEMS.water, { drink: 35, icon: 'can' });
Object.assign(ITEMS.milk, { drink: 24 });
Object.assign(ITEMS.energy_drink, { drink: 30, energy: 100 });
Object.assign(ITEMS.herbal_tea, { drink: 22 });
for (const id of ['juice_orange', 'juice_lemon', 'juice_watermelon']) Object.assign(ITEMS[id], { drink: 42, icon: 'can' });
for (const id of ['tea', 'coffee', 'milk_warm']) Object.assign(ITEMS[id], { drink: 26, icon: 'can' });
for (const [id, j] of [['soup_veg', 14], ['soup_lentil', 14], ['soup_fish', 14], ['mushroom_soup', 14], ['stew_beef', 8], ['stew_lamb', 8], ['salad', 8], ['fattoush', 6], ['apple', 6], ['orange', 10], ['lemon', 4], ['watermelon', 18], ['cucumber', 9], ['tomato', 6]]) ITEMS[id].juicy = j;

/* ── building pieces and furniture: placed in the world ── */
const BMATS = [['wood', 'خشبي', 'plank', 0x9a7650, 3], ['log', 'من جذوع', 'wood', 0x7a5a3a, 5], ['stone', 'حجري', 'stone', 0x8d8478, 6], ['brick', 'من الطوب', 'brick', 0xa85a3a, 5], ['adobe', 'طيني', 'clay', 0xc8a070, 5], ['metal', 'معدني', 'iron', 0x7a7f84, 3], ['concrete', 'خرساني', 'concrete', 0x9a9690, 4]];
const PIECES = [['foundation', 'أساس', 2.0], ['floor', 'أرضية', 1.0], ['wall', 'جدار', 1.4], ['wall_door', 'جدار بباب', 1.2], ['wall_window', 'جدار بنافذة', 1.2], ['half_wall', 'نصف جدار', 0.7],
  ['roof', 'سقف', 1.2], ['roof_slope', 'سقف مائل', 1.4], ['stairs', 'درج', 1.4], ['pillar', 'عمود', 0.5], ['fence', 'سور', 0.6], ['gate', 'بوّابة', 1.0], ['door', 'باب', 0.6], ['window', 'نافذة', 0.5]];
for (const [mid, mname, mat, color, n] of BMATS) for (const [pid, pname, k] of PIECES) {
  if (pid === 'window' && mid !== 'wood' && mid !== 'metal') continue;
  const recipe = R(mat, Math.max(1, Math.round(n * k)));
  if (pid === 'door' || pid === 'gate') recipe.push(['nails', 1]);
  if (pid === 'window' || pid === 'wall_window') recipe.push(['glass', 1]);
  item('b_' + pid + '_' + mid, pname + ' ' + mname, 'build', { color, recipe, w: 2 * k, price: Math.round(n * k * 3), icon: 'wall', build: { piece: pid, mat: mid, color } });
}
const FURN = [['workbench', 'طاولة عمل', R('plank', 6, 'nails', 2), 'station'], ['furnace', 'فرن صهر', R('stone', 12, 'clay', 4), 'station'], ['anvil', 'سندان', R('iron', 6), 'station'], ['loom', 'نول نسيج', R('plank', 6, 'rope', 3), 'station'], ['tailor', 'طاولة خياطة', R('plank', 4, 'iron', 1, 'thread', 4), 'station'],
  ['campfire', 'نار مخيّم', R('wood', 6, 'stone', 4), 'station'], ['stove', 'موقد طبخ', R('iron', 4, 'brick', 4), 'station'], ['bed', 'سرير', R('plank', 6, 'cloth', 3), 'bed'], ['sleeping_bag', 'كيس نوم', R('cloth', 4, 'wool', 2), 'bed'],
  ['chair', 'كرسي', R('plank', 3), null], ['stool', 'مقعد صغير', R('plank', 2), null], ['bench', 'مقعد طويل', R('plank', 5), null], ['table', 'طاولة', R('plank', 5), null], ['desk', 'مكتب', R('plank', 6, 'nails', 1), null],
  ['sofa', 'أريكة', R('plank', 4, 'cloth', 4), null], ['wardrobe', 'خزانة ملابس', R('plank', 8, 'nails', 2), null], ['shelf', 'رفوف', R('plank', 4), null], ['chest_small', 'صندوق تخزين صغير', R('plank', 5, 'nails', 1), 'storage'],
  ['chest_big', 'صندوق تخزين كبير', R('plank', 10, 'iron', 2), 'storage'], ['barrel', 'برميل', R('plank', 6, 'iron', 1), 'storage'], ['crate', 'صندوق خشبي', R('plank', 4), 'storage'], ['cabinet', 'خزانة مطبخ', R('plank', 6, 'nails', 2), 'storage'],
  ['rug_small', 'سجادة صغيرة', R('cloth', 2), null], ['mirror', 'مرآة', R('glass', 2, 'plank', 1), null], ['clock', 'ساعة حائط', R('gear', 2, 'plank', 1, 'glass', 1), null], ['bookcase', 'مكتبة كتب', R('plank', 6, 'paper', 6), null]];
for (const [wid, wname, color] of [['oak', 'بلّوط', 0x7a5232], ['pine', 'صنوبر', 0xb89a6a], ['walnut', 'جوز', 0x4a3220]]) for (const [fid, fname, recipe, kind] of FURN) {
  if (kind === 'station' && wid !== 'oak') continue;
  const id = 'f_' + fid + (kind === 'station' ? '' : '_' + wid);
  item(id, fname + (kind === 'station' ? '' : ' ' + wname), kind === 'station' ? 'build' : 'furn', { color: kind === 'station' ? 0x8a6a45 : color, recipe: recipe.map((r) => r.slice()), station: kind === 'station' ? null : 'workbench', w: 3, price: 20 + recipe.reduce((s, r) => s + r[1] * 2, 0), icon: kind === 'station' ? 'station' : 'furn', place: { kind: fid, color, station: kind === 'station' ? fid : null, bed: kind === 'bed', storage: kind === 'storage' } });
}
const LIGHTS = [['lantern', 'فانوس', R('iron', 1, 'glass', 1, 'oil', 1), 0xffc070], ['candle', 'شمعة', R('resin', 1, 'thread', 1), 0xffd090], ['oil_lamp', 'سراج زيت', R('clay', 1, 'oil', 1), 0xffb060], ['street_lamp', 'عمود إنارة', R('iron', 4, 'glass', 1, 'battery', 1), 0xffe0b0],
  ['fireplace', 'مدفأة حجرية', R('stone', 14, 'brick', 4), 0xff8a40], ['torch_wall', 'شعلة حائط', R('wood', 1, 'resin', 1, 'iron', 1), 0xff9a50]];
for (const [lid, lname, recipe, lc] of LIGHTS) for (const [cid, cname, c] of [['warm', 'دافئ', lc], ['white', 'أبيض', 0xf0f4ff], ['green', 'أخضر', 0x9fe0a0], ['blue', 'أزرق', 0x8ab0ff], ['red', 'أحمر', 0xff7a6a]]) {
  if ((lid === 'fireplace' || lid === 'torch_wall' || lid === 'candle') && cid !== 'warm') continue;
  item('l_' + lid + '_' + cid, lname + (cid === 'warm' ? '' : ' ' + cname), 'light', { color: c, recipe: recipe.concat(cid === 'warm' ? [] : [['dye_' + (cid === 'white' ? 'white' : cid), 1]]), station: 'workbench', w: 1, price: 15 + recipe.length * 5, icon: 'lamp', place: { kind: lid, light: c } });
}
/* farming */
for (const [tid, tname, color] of [['oak', 'بلّوط', 0x4a6a3a], ['pine', 'صنوبر', 0x3a5a3a], ['birch', 'بتولا', 0x6a8a4a], ['olive', 'زيتون', 0x6a7a4a], ['palm', 'نخيل', 0x5a7a3a], ['apple', 'تفاح', 0x5a8a3a], ['orange', 'برتقال', 0x4a7a2a], ['lemon', 'ليمون', 0x5a8a3a]])
  item('sapling_' + tid, 'شتلة ' + tname, 'farm', { color, recipe: R('wood', 1, 'water', 1, 'fiber', 2), w: 0.5, price: 12, icon: 'seed', sapling: tid });
for (const [id, name, recipe, kind] of [['fertilizer', 'سماد', R('bone', 2, 'water', 1), null], ['scarecrow', 'فزّاعة', R('wood', 3, 'cloth', 2, 'fiber', 4), 'scarecrow'], ['planter', 'حوض زراعة', R('plank', 4, 'clay', 2), 'planter'],
  ['beehive', 'خلية نحل', R('plank', 6, 'resin', 2), 'beehive'], ['coop', 'قنّ دجاج', R('plank', 8, 'nails', 2, 'fiber', 4), 'coop'], ['well', 'بئر ماء', R('stone', 20, 'rope', 3, 'plank', 4), 'well'], ['compost', 'حاوية سماد', R('plank', 5), 'compost'],
  ['trough', 'معلف حيوانات', R('plank', 5, 'nails', 1), 'trough'], ['fence_farm', 'سياج مزرعة', R('wood', 4, 'rope', 1), 'fence']])
  item(id, name, 'farm', { color: 0x8a6a45, recipe, station: kind ? 'workbench' : null, w: 2, price: 15 + recipe.length * 5, icon: kind ? 'furn' : 'seed', place: kind ? { kind } : null });
/* decoration */
const FLOWERS = [['rose', 'ورد جوري', 0xc8203a], ['tulip', 'توليب', 0xe85a8a], ['jasmine', 'ياسمين', 0xf4f4f0], ['lavender', 'خزامى', 0x8a6ac8], ['sunflower_d', 'دوّار الشمس', 0xe8c030], ['cactus_d', 'صبّار زينة', 0x4a8a3a], ['fern_d', 'سرخس', 0x3a7a3a], ['orchid', 'أوركيد', 0xd88ad8]];
for (const [fid, fname, c] of FLOWERS) for (const [pid, pname, pc] of [['clay', 'فخاري', 0xa85a3a], ['white', 'أبيض', 0xe8e6e0], ['blue', 'أزرق', 0x2f6a9a]]) item('pot_' + fid + '_' + pid, fname + ' في أصيص ' + pname, 'deco', { color: c, recipe: R('clay', 1, 'fiber', 1, 'dye_' + (pid === 'clay' ? 'brown' : pid), 1), w: 0.5, price: 12, icon: 'flower', place: { kind: 'pot', color: c, pot: pc } });
for (const [cid, cname, c] of COLORS) {
  item('rug_' + cid, 'سجادة ' + cname, 'deco', { color: c, recipe: R('wool_cloth', 2, 'dye_' + cid, 1), station: 'loom', w: 1, price: 25, icon: 'rug', place: { kind: 'rug', color: c } });
  item('banner_' + cid, 'راية ' + cname, 'deco', { color: c, recipe: R('cloth', 2, 'wood', 1, 'dye_' + cid, 1), w: 0.5, price: 14, icon: 'flag', place: { kind: 'banner', color: c } });
  item('curtain_' + cid, 'ستارة ' + cname, 'deco', { color: c, recipe: R('cloth', 2, 'dye_' + cid, 1), station: 'loom', w: 0.4, price: 12, icon: 'rug', place: { kind: 'curtain', color: c } });
  item('cushion_' + cid, 'وسادة ' + cname, 'deco', { color: c, recipe: R('cloth', 1, 'wool', 1, 'dye_' + cid, 1), w: 0.2, price: 8, icon: 'rug', place: { kind: 'cushion', color: c } });
}
for (const [id, name, recipe] of [['painting_sea', 'لوحة البحر', R('cloth', 1, 'plank', 1, 'dye_blue', 1)], ['painting_desert', 'لوحة الصحراء', R('cloth', 1, 'plank', 1, 'dye_yellow', 1)], ['painting_forest', 'لوحة الغابة', R('cloth', 1, 'plank', 1, 'dye_green', 1)],
  ['painting_city', 'لوحة المدينة', R('cloth', 1, 'plank', 1, 'dye_gray', 1)], ['statue_lion', 'تمثال أسد', R('stone', 12)], ['statue_horse', 'تمثال حصان', R('stone', 12)], ['statue_eagle', 'تمثال نسر', R('stone', 10)], ['fountain', 'نافورة', R('stone', 20, 'pipe', 2)],
  ['vase', 'مزهرية', R('clay', 2)], ['amphora', 'جرّة فخار', R('clay', 3)], ['globe', 'كرة أرضية', R('paper', 2, 'wood', 1, 'dye_blue', 1)], ['chandelier', 'ثريا', R('gold', 1, 'glass', 4, 'wire', 2)], ['wind_chime', 'جرس الريح', R('copper', 1, 'thread', 1)],
  ['flag_pole', 'سارية علم', R('iron', 3, 'cloth', 2)], ['snowman', 'رجل ثلج', R('ice', 6, 'wood', 1)], ['sandcastle', 'قلعة رمل', R('sand', 10, 'seashell', 2)]])
  item('d_' + id, name, 'deco', { color: 0xc8b48a, recipe, station: 'workbench', w: 2, price: 30, icon: 'deco', place: { kind: id } });
/* vehicles you can make */
for (const [id, name, recipe, kind] of [['raft', 'طوف', R('wood', 16, 'rope', 4), 'raft'], ['boat', 'قارب خشبي', R('plank', 30, 'nails', 6, 'cloth', 3), 'craftboat'], ['canoe', 'زورق', R('wood', 12, 'resin', 4), 'raft'],
  ['cart', 'عربة يد', R('plank', 8, 'iron', 2), null], ['bicycle', 'درّاجة هوائية', R('steel', 4, 'gear', 2, 'rope', 2), 'bicycle'], ['motorbike', 'درّاجة نارية', R('steel', 12, 'gear', 6, 'fuel', 2, 'battery', 1), 'bike'],
  ['buggy', 'سيارة رمال', R('steel', 20, 'gear', 8, 'fuel', 4, 'battery', 2, 'glass', 2), 'buggy']])
  item('v_' + id, name, 'vehicle', { color: 0x8a6a45, recipe, station: kind && kind !== 'raft' ? 'workbench' : null, w: 0, price: 50 + recipe.reduce((s, r) => s + r[1] * 3, 0), icon: kind === 'raft' || kind === 'craftboat' ? 'boat' : 'car', vehicle: kind || 'cart' });
/* treasure: found by digging, in ruins and chests; the bank and the gold trader buy it */
for (const [id, name, price] of [['gold_coin', 'قطعة نقد ذهبية قديمة', 40], ['silver_coin', 'قطعة نقد فضية قديمة', 18], ['ancient_cup', 'كأس ذهبية قديمة', 260], ['crown', 'تاج مرصّع', 900], ['ring', 'خاتم مرصّع', 180], ['necklace', 'قلادة لؤلؤ', 220],
  ['idol', 'تمثال صغير أثري', 320], ['pottery', 'فخار أثري', 90], ['scroll', 'مخطوطة قديمة', 150], ['dagger_old', 'خنجر أثري', 260], ['pearl', 'لؤلؤة', 120], ['fossil', 'متحجّرة', 70], ['meteorite', 'حجر نيزكي', 400],
  ['chest_key', 'مفتاح صندوق قديم', 60], ['gold_bar', 'سبيكة ذهب خالص', 600]])
  item('t_' + id, name, 'treasure', { color: 0xd8b04a, w: 0.2, price, icon: 'gem', rare: true });

/* ───────── inventory ───────── */
const INV = { items: new Map(), coins: 50, cap: 300, slots: ['hand', 'axe_stone', 'pickaxe_stone', 'sword_wood', 'hammer_stone', 'rifle'], wearing: {} };
const invCount = (id) => INV.items.get(id) || 0;
const bagLoad = () => { let s = 0; for (const [id, n] of INV.items) { const it = ITEMS[id]; if (it) s += (it.w || 0) * n; } return Math.round(s); };
const bagCap = () => INV.cap + (INV.wearing.pack && ITEMS[INV.wearing.pack] ? ITEMS[INV.wearing.pack].wear.cap || 0 : 0) + (typeof upAdd === 'function' ? upAdd('bag') : 0);
function invAdd(id, n, quiet) {
  const it = ITEMS[id]; if (!it || n <= 0) return 0;
  // clothes go straight to the wardrobe: they are yours for good, and weigh nothing in the bag
  if (typeof isCosmetic === 'function' && isCosmetic(it)) { wardrobeAdd(id, quiet); return n; }
  const room = it.w > 0 ? Math.floor((bagCap() - bagLoad()) / it.w) : n, k = Math.max(0, Math.min(n, room));
  if (k > 0) { INV.items.set(id, invCount(id) + k); hudDirty = true; if (typeof saveSoon === 'function') saveSoon(); if (!quiet) showGain('+' + toAr(k) + ' ' + it.name, id === 'wood' ? 'wood' : id === 'stone' ? 'stone' : 'item'); }
  if (k < n && !quiet) toast('الحقيبة ممتلئة', 'بِع أو اصنع شيئاً لتفرغ مكاناً، أو اشترِ حقيبة أكبر');
  return k;
}
function invTake(id, n) { const c = invCount(id); if (c < n) return false; if (c === n) INV.items.delete(id); else INV.items.set(id, c - n); hudDirty = true; if (typeof saveSoon === 'function') saveSoon(); return true; }
function addCoins(n, quiet) { INV.coins = Math.max(0, INV.coins + n); hudDirty = true; if (!quiet && n > 0) showGain('+' + toAr(n) + ' دينار', 'coin'); if (typeof saveSoon === 'function') saveSoon(); }
const BAG_SLOW = () => { const f = bagLoad() / Math.max(1, bagCap()); return f > 0.9 ? 0.82 : 1; };
const ARMOR = () => { let a = 1; for (const s of ['hat', 'vest']) { const id = INV.wearing[s], it = id && ITEMS[id]; if (it && it.wear.armor) a *= it.wear.armor; } return a; };
/* tools in the hand: the six hotbar slots hold any tool or weapon you own */
function ownsTool(id) { return id === 'hand' || invCount(id) > 0; }
function selectSlot(i) {
  const id = INV.slots[i]; if (!id) return false;
  if (!ownsTool(id)) { const it = ITEMS[id]; toast((it ? it.name : 'الأداة') + ' ليست معك', it && it.recipe ? 'اصنعها من الحقيبة أو اشترِها' : 'اشترِها من المتجر'); return false; }
  return equip(id);
}
function equip(id) {
  if (player.vehicle || !player.alive) return false;
  const it = id === 'hand' ? null : ITEMS[id];
  const tool = it ? it.tool || 'hand' : 'hand';
  if (player.toolItem !== id) {
    if (isGunTool(player.tool)) MAGS[player.toolItem] = player.mag;
    player.toolItem = id; player.tool = tool; player.swingT = 0; player.swingHit = true; player.reloadT = 0;
    player.armed = !!(it && it.gun);
    player.mag = player.armed ? (MAGS[id] || 0) : 0;
    if (typeof setScope === 'function') setScope(false); if (typeof FIRE !== 'undefined') FIRE.burstLeft = 0;
    showTool(); AUDIO.equip();
  }
  hudDirty = true; return true;
}
function assignSlot(i, id) { INV.slots[i] = id; hudDirty = true; if (typeof saveSoon === 'function') saveSoon(); }
/* recipes */
const nearStation = (st) => !st || (typeof stationNear === 'function' && stationNear(st, player.pos.x, player.pos.z, 7));
function missingFor(r) {
  const miss = [];
  for (const [id, n] of r.needs) { const have = invCount(id); if (have < n) miss.push([id, n - have]); }
  return miss;
}
function canCraft(r) { return missingFor(r).length === 0 && nearStation(r.station); }
function craftItem(id, times = 1) {
  const r = RECIPES.find((q) => q.id === id); if (!r) return false;
  const miss = missingFor(r);
  if (miss.length) { toast('ينقصك ' + miss.slice(0, 3).map(([m, n]) => toAr(n) + ' ' + ITEMS[m].name).join(' و'), 'اجمعها أو اشترِها'); AUDIO.dry(); return false; }
  if (!nearStation(r.station)) { toast('تحتاج ' + STATION_AR[r.station] + ' قريبة', 'اصنعها من قسم البناء وضعها على الأرض'); AUDIO.dry(); return false; }
  for (const [m, n] of r.needs) invTake(m, n);
  const got = invAdd(id, r.out, true);
  if (got < r.out) { for (const [m, n] of r.needs) invAdd(m, n, true); toast('الحقيبة ممتلئة', ''); return false; }
  STATS.crafted = (STATS.crafted || 0) + 1; track('crafted');
  if (r.station === 'campfire' && ITEMS[id].cat === 'food') track('cooked'); if (ITEMS[id].gun) { track('gunsCrafted'); if (typeof assignFreeSlot === 'function') assignFreeSlot(id); }
  AUDIO.craft(); toast('صنعت ' + (r.out > 1 ? toAr(r.out) + ' × ' : '') + ITEMS[id].name, isCosmetic(ITEMS[id]) ? 'في خزانتك للأبد · البسه من تبويب الملابس' : ITEMS[id].place || ITEMS[id].build ? 'ضعه من تبويب المخزون' : ITEMS[id].tool ? 'ضعه في الشريط من تبويب المخزون' : '');
  return true;
}
const STATS = { crafted: 0, dug: 0, fish: 0, felled: 0 };
/* loot tables */
const LOOT = {
  home: [['bread', 0.3, 1, 2], ['water', 0.5, 1, 3], ['bandage', 0.35, 1, 2], ['cloth', 0.3, 1, 3], ['rope', 0.2, 1, 2], ['nails', 0.2, 2, 6], ['ammo9', 0.15, 5, 15], ['knife_iron', 0.06, 1, 1], ['tomato', 0.2, 1, 3], ['torch', 0.2, 1, 1], ['t_silver_coin', 0.05, 1, 2], ['coins', 0.5, 5, 30]],
  military: [['ammo556', 0.6, 10, 40], ['ammo9', 0.5, 10, 30], ['shells', 0.3, 4, 12], ['medkit', 0.25, 1, 1], ['bandage', 0.5, 1, 3], ['helmet_kevlar', 0.08, 1, 1], ['vest_kevlar', 0.06, 1, 1], ['pistol', 0.08, 1, 1], ['rifle', 0.04, 1, 1], ['coins', 0.4, 10, 50], ['gunpowder', 0.3, 1, 4]],
  armory: [['rifle', 0.5, 1, 1], ['ammo556', 1, 30, 90], ['shotgun', 0.3, 1, 1], ['shells', 0.6, 8, 20], ['sniper', 0.1, 1, 1], ['ammo762', 0.4, 5, 15], ['vest_kevlar', 0.3, 1, 1], ['helmet_steel', 0.2, 1, 1]],
  med: [['bandage', 0.8, 1, 4], ['medkit', 0.5, 1, 2], ['painkiller', 0.5, 1, 3], ['antibiotic', 0.3, 1, 2], ['stim', 0.1, 1, 1], ['herbs', 0.4, 1, 4]],
  farm: [['seed_wheat', 0.5, 2, 6], ['seed_corn', 0.5, 2, 6], ['seed_tomato', 0.4, 2, 5], ['seed_potato', 0.4, 2, 5], ['egg', 0.4, 1, 6], ['milk', 0.3, 1, 2], ['rope', 0.4, 1, 3], ['hoe_iron', 0.08, 1, 1], ['fertilizer', 0.3, 1, 3], ['coins', 0.4, 5, 20]],
  zombie: [['coins', 0.5, 2, 12], ['ammo9', 0.2, 3, 10], ['ammo556', 0.15, 5, 15], ['bandage', 0.12, 1, 1], ['cloth', 0.2, 1, 2], ['scrap', 0.2, 1, 3]],
  zombieBig: [['coins', 1, 15, 40], ['ammo556', 0.5, 10, 30], ['medkit', 0.3, 1, 1], ['t_gold_coin', 0.1, 1, 1], ['steel', 0.2, 1, 2]],
  chest: [['t_gold_coin', 0.8, 2, 8], ['t_silver_coin', 0.7, 3, 12], ['t_ring', 0.2, 1, 1], ['t_necklace', 0.15, 1, 1], ['t_ancient_cup', 0.12, 1, 1], ['t_crown', 0.04, 1, 1], ['t_pearl', 0.3, 1, 3], ['ruby', 0.25, 1, 2], ['emerald', 0.25, 1, 2], ['diamond', 0.1, 1, 1], ['t_gold_bar', 0.06, 1, 1], ['coins', 1, 40, 160]],
};
function rollLoot(table, luck = 1) {
  const T0 = LOOT[table]; if (!T0) return [];
  if (typeof upMul === 'function') luck *= upMul('luck');
  const out = [];
  for (const [id, p, a, b] of T0) if (rand() < p * luck) { const n = a + Math.floor(rand() * (b - a + 1)); if (id === 'coins') addCoins(n); else out.push([id, n]); }
  if (typeof lootExtras === 'function') lootExtras(table, out);
  return out;
}
/* what the ground gives when you dig: by biome and depth */
function digLoot(x, z, depth) {
  const b = biomeAt(x, z), h = terrainAt(x, z), wet = waterAt(x, z) > h - 2, out = [];
  const p = (id, prob, a = 1, b2 = 1) => { if (rand() < prob) out.push([id, a + Math.floor(rand() * (b2 - a + 1))]); };
  const mountain = h > 160 || b === 5, desert = b === 7, beach = b === 1 || classAt(x, z) === 3, forest = b === 3 || b === 4;
  const nearMine = Math.hypot(x - MINE.x, z - MINE.z) < 400, deep = depth > 1.0;
  p(beach || desert ? 'sand' : 'clay', wet ? 0.7 : 0.35, 1, 3);
  p('stone', 0.5, 1, 3); p('flint', 0.25); p('bone', 0.08);
  p('coal', (mountain ? 0.35 : forest ? 0.18 : 0.1) + (deep ? 0.15 : 0) + (nearMine ? 0.2 : 0), 1, 3);
  p('iron_ore', (mountain ? 0.22 : 0.06) + (nearMine ? 0.2 : 0) + (deep ? 0.08 : 0), 1, 2);
  p('copper_ore', (mountain ? 0.15 : 0.05) + (nearMine ? 0.12 : 0), 1, 2);
  p('silver_ore', (mountain ? 0.06 : 0.02) + (nearMine ? 0.06 : 0));
  p('gold_ore', (desert || mountain ? 0.04 : 0.012) + (nearMine ? 0.05 : 0) + (deep ? 0.02 : 0));
  p('sulfur', mountain ? 0.08 : 0.02); p('saltpeter', desert ? 0.12 : 0.03); p('salt', beach ? 0.2 : 0.02);
  p(['ruby', 'emerald', 'sapphire', 'amethyst'][Math.floor(rand() * 4)], (mountain ? 0.03 : 0.008) + (deep ? 0.015 : 0));
  p('diamond', mountain && deep ? 0.008 : 0.001);
  p('t_fossil', desert || beach ? 0.03 : 0.008); p('t_pottery', 0.01); p('seashell', beach ? 0.3 : 0);
  return out;
}
