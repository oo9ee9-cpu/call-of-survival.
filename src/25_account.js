/* ═════════ the account: you across lives — a name and an 8-digit ID, a level that grows with everything you do, gold that stays
   when you fall, gems (eight free at most; the paid top-up is not open yet), a wardrobe of clothes, workshop upgrades,
   daily and weekly missions and achievements. Kept in your private record and on this device; a fall never wipes it. ═════════ */
const ACC_KEY = 'rock-island-account-v1', GEM_FREE_CAP = 8;
/* what changes the shared world tells these (the online module fills them in when friends play together) */
const HOOK = { built() {}, unbuilt() {}, dug() {}, felled() {}, rock() {}, shot() {}, start() {}, frame() {}, lobby() {}, init() {}, ava() {}, play() { return false; } };
const SHEET_EXTRA = {}, MODAL_EXTRA = {};
const ACC = { doc: null, dirty: false, busy: false, last: -99, lastJson: '', loaded: false, secAcc: 0, mAcc: 0, mDirty: true, listeners: [] };
const HANDLES = ['صقر', 'ذيب', 'نمر', 'شاهين', 'فارس', 'رعد', 'سيف', 'برق', 'ليث', 'نسر', 'عاصفة', 'قنّاص', 'بركان', 'ظلّ', 'جبل', 'سهم'];
const STARTER_WARDROBE = ['outfit_soldier', 'top_hoodie_gray', 'top_tshirt_white', 'pants_jeans_navy', 'shoes_boots_brown', 'cap_olive'];
const COS_SLOTS = ['top', 'pants', 'shoes', 'hands', 'hat', 'glasses', 'body', 'suit'];
const SUIT_PARTS = ['top', 'pants', 'shoes', 'hands', 'hat', 'glasses'];

/* ── full suits: one tap dresses the whole body (some only for gems) ── */
const SUITS = [
  ['ranger', 'بدلة حارس الغابة', 0x56603f, { top: { c: 0x56603f, a: 0.92, p: 'camo' }, pants: { c: 0x56603f, a: 0.92, p: 'camo' }, shoes: { c: 0x3b2b1f, a: 0.9 }, hands: { c: 0x3a3f2e, a: 0.9 }, hat: 'cap', hatC: 0x4a5038 }, { gold: 650 }],
  ['desert', 'بدلة الصحراء الملكية', 0xc8b080, { top: { c: 0xc8b080, a: 0.92, p: 'desert' }, pants: { c: 0xc8b080, a: 0.92, p: 'desert' }, shoes: { c: 0x8a6a45, a: 0.9 }, hands: { c: 0x8a6a45, a: 0.9 }, hat: 'shemagh', hatC: 0xf4f2ee, glasses: 'goggles', glassesC: 0x8a6a45 }, { gems: 3 }],
  ['polar', 'بدلة القطب الشمالي', 0xd8dde0, { top: { c: 0xd8dde0, a: 0.92, p: 'urban' }, pants: { c: 0xd8dde0, a: 0.92, p: 'urban' }, shoes: { c: 0xe8e6e0, a: 0.9 }, hands: { c: 0x7a7a7a, a: 0.9 }, hat: 'beanie', hatC: 0xe8e6e0, glasses: 'goggles', glassesC: 0x2a2a2a }, { gold: 900 }],
  ['shadow', 'بدلة الظلّ', 0x1e1e20, { top: { c: 0x1e1e20, a: 0.95, p: 'urban' }, pants: { c: 0x18181a, a: 0.95 }, shoes: { c: 0x111111, a: 0.92 }, hands: { c: 0x111111, a: 0.92 }, hat: 'beanie', hatC: 0x1e1e20, glasses: 'sunglasses', glassesC: 0x111214 }, { gems: 4 }],
  ['medic', 'زيّ المسعف', 0xf4f4f0, { top: { c: 0xf4f4f0, a: 0.95 }, pants: { c: 0xe8e6e0, a: 0.92 }, shoes: { c: 0xe8e6e0, a: 0.9 }, hands: { c: 0x5aa8d8, a: 0.9 }, hat: 'bandana', hatC: 0xa8302a }, { gold: 500 }],
  ['cowboy', 'زيّ راعي البقر', 0x8a2a2a, { top: { c: 0x8a2a2a, a: 0.9, p: 'checks' }, pants: { c: 0x2f4a8a, a: 0.88 }, shoes: { c: 0x6b4a2f, a: 0.9 }, hands: { c: 0x6b4a2f, a: 0.9 }, hat: 'cowboy', hatC: 0x6b4a2f }, { gold: 700 }],
  ['sheikh', 'الثوب والغترة', 0xf4f2ee, { top: { c: 0xf4f2ee, a: 0.95 }, pants: { c: 0xf4f2ee, a: 0.95 }, shoes: { c: 0x6b4a2f, a: 0.9 }, hat: 'shemagh', hatC: 0xd8d0c4 }, { gold: 600 }],
  ['gold', 'بدلة النخبة الذهبية', 0xd8b04a, { top: { c: 0xd8b04a, a: 0.95 }, pants: { c: 0x1e1e20, a: 0.95 }, shoes: { c: 0x1e1e20, a: 0.92 }, hands: { c: 0xd8b04a, a: 0.92 }, hat: 'cap', hatC: 0x1e1e20, glasses: 'sunglasses', glassesC: 0xb8902a }, { gems: 6 }],
  ['hunter', 'زيّ الصيّاد', 0x6b4a2f, { top: { c: 0x6b4a2f, a: 0.9, p: 'camo' }, pants: { c: 0x4a4030, a: 0.9 }, shoes: { c: 0x3b2b1f, a: 0.9 }, hands: { c: 0x3b2b1f, a: 0.9 }, hat: 'cowboy', hatC: 0x3b2b1f }, { gold: 750 }],
  ['sailor', 'زيّ البحّار', 0x2f4a8a, { top: { c: 0x2f4a8a, a: 0.92, p: 'stripes' }, pants: { c: 0x1f2a44, a: 0.92 }, shoes: { c: 0xe8e6e0, a: 0.9 }, hat: 'beanie', hatC: 0x1f2a44 }, { gold: 550 }],
];
for (const [sid, name, c, parts, cost] of SUITS) item('suit_' + sid, name, 'wear', { color: c, wear: { slot: 'suit', suit: parts }, price: 0, w: 0, icon: 'person', shopOnly: true, lobby: true, goldPrice: cost.gold, gemPrice: cost.gems });
ITEMS.outfit_michelle.goldPrice = 280;

const isCosmetic = (it) => !!(it && it.wear && !it.wear.armor && !it.wear.cap && it.wear.slot !== 'vest' && it.wear.slot !== 'pack');
const goldPrice = (it) => it.goldPrice || Math.max(20, Math.round(it.price * 1.4 / 5) * 5);
const ownsWear = (id) => { const it = ITEMS[id]; if (!it || !it.wear) return false; if (id === 'outfit_soldier') return true; return isCosmetic(it) ? ACCOUNT.wardrobe.includes(id) : invCount(id) > 0; };

function rid8() { try { const a = new Uint32Array(1); crypto.getRandomValues(a); return String(10000000 + (a[0] % 90000000)); } catch (_) { return String(10000000 + Math.floor(Math.random() * 90000000)); } }
function newAccount() {
  return { v: 1, id: rid8(), name: HANDLES[Math.floor(Math.random() * HANDLES.length)] + toAr(10 + Math.floor(Math.random() * 90)), created: Date.now(), t: 0,
    level: 1, xp: 0, gold: 120, gems: 3, gemsFree: 3, wardrobe: STARTER_WARDROBE.slice(), look: {}, upg: {}, life: {}, best: { surv: 0 }, daily: null, weekly: null, ach: {}, tut: {}, seen: {},
    shards: 0, mat: 0, crates: { classic: 1 }, wskins: {}, wskinOn: {}, titles: [], title: '', pity: {}, char: '', named: false, clan: '', clanCards: 0, clanOwn: '' };
}
const ACCOUNT = newAccount();
function accApply(o) {
  if (!o || typeof o !== 'object' || !o.id) return false;
  const base = newAccount();
  for (const k of Object.keys(base)) if (o[k] !== undefined && o[k] !== null && typeof o[k] === typeof base[k]) ACCOUNT[k] = o[k];
  ACCOUNT.daily = o.daily && typeof o.daily === 'object' ? o.daily : null; ACCOUNT.weekly = o.weekly && typeof o.weekly === 'object' ? o.weekly : null;
  ACCOUNT.id = String(o.id).replace(/\D/g, '').slice(0, 8); if (ACCOUNT.id.length !== 8) ACCOUNT.id = base.id;
  ACCOUNT.name = cleanName(ACCOUNT.name) || base.name;
  ACCOUNT.level = clamp(ACCOUNT.level | 0, 1, 999); ACCOUNT.xp = Math.max(0, +ACCOUNT.xp || 0);
  ACCOUNT.gold = Math.max(0, ACCOUNT.gold | 0); ACCOUNT.gemsFree = Math.max(0, ACCOUNT.gemsFree | 0); ACCOUNT.gems = Math.max(0, ACCOUNT.gems | 0);
  ACCOUNT.shards = Math.max(0, ACCOUNT.shards | 0); ACCOUNT.mat = Math.max(0, ACCOUNT.mat | 0);
  for (const k of ['crates', 'wskins', 'wskinOn', 'pity']) if (!ACCOUNT[k] || typeof ACCOUNT[k] !== 'object' || Array.isArray(ACCOUNT[k])) ACCOUNT[k] = {};
  if (!Array.isArray(ACCOUNT.titles)) ACCOUNT.titles = [];
  ACCOUNT.wardrobe = [...new Set((Array.isArray(o.wardrobe) ? o.wardrobe : []).filter((id) => isCosmetic(ITEMS[id])).concat(['outfit_soldier']))];
  const look = {}; for (const s of COS_SLOTS) { const id = ACCOUNT.look && ACCOUNT.look[s]; if (id && ITEMS[id] && isCosmetic(ITEMS[id]) && ITEMS[id].wear.slot === s && ACCOUNT.wardrobe.includes(id)) look[s] = id; } ACCOUNT.look = look;
  for (const u of UPGRADES) ACCOUNT.upg[u.id] = clamp(ACCOUNT.upg[u.id] | 0, 0, u.max);
  return true;
}
function cleanName(s) { return String(s || '').replace(/[<>&"'`\\\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16); }

/* ── keeping it: on this device at once, in the private record every so often ── */
function accSoon(now) { ACC.dirty = true; ACC.mDirty = true; if (now) ACC.last = -99; for (const f of ACC.listeners) try { f(); } catch (_) {} }
async function accFlush() {
  if (!ACC.loaded) return;
  ACCOUNT.t = Date.now();
  let js; try { js = JSON.stringify(ACCOUNT); } catch (e) { return; }
  try { localStorage.setItem(ACC_KEY, js); } catch (_) {}
  ACC.dirty = false; ACC.last = T;
  if (!ACC.doc || ACC.busy) { if (ACC.busy) ACC.dirty = true; return; }
  ACC.busy = true;
  try { await ACC.doc.set({ json: js }); ACC.lastJson = js; }
  catch (e) { const c = e && e.code; if (c === 'not_granted' || c === 'revoked' || c === 'capability_disabled' || c === 'capability_removed' || c === 'invalid_argument') ACC.doc = null; else ACC.dirty = true; }
  ACC.busy = false;
}
function accLoadFrom(dbJson) {
  let a = null, b = null;
  try { a = dbJson ? JSON.parse(dbJson) : null; } catch (_) {}
  try { b = JSON.parse(localStorage.getItem(ACC_KEY) || 'null'); } catch (_) {}
  const pickA = a && (!b || (a.t || 0) >= (b.t || 0) - 2000);
  const src = pickA ? a : b;
  const ok = src ? accApply(src) : false;
  if (dbJson && pickA) ACC.lastJson = dbJson;
  ACC.loaded = true; rollMissions();
  if (!ok) accSoon(true);
  return ok;
}
addEventListener('pagehide', () => { if (ACC.loaded) { try { ACCOUNT.t = Date.now(); localStorage.setItem(ACC_KEY, JSON.stringify(ACCOUNT)); } catch (_) {} } });
document.addEventListener('visibilitychange', () => { if (document.hidden && ACC.loaded) accFlush(); });

/* ── level and experience: the next level needs level × 100 ── */
const xpNeed = (l) => l * 100;
const xpTotal = () => 50 * ACCOUNT.level * (ACCOUNT.level - 1) + ACCOUNT.xp;
const XP_RULE = { kills: 10, brutes: 20, bots: 15, felled: 6, rocks: 4, crafted: 3, built: 2, fish: 8, hunted: 10, dug: 2, treasure: 40, km: 6, sec: 2 / 60, harvest: 3, eat: 1, bought: 1 };
function addXP(n) {
  if (!(n > 0)) return;
  ACCOUNT.xp += n; let ups = 0;
  while (ACCOUNT.xp >= xpNeed(ACCOUNT.level)) { ACCOUNT.xp -= xpNeed(ACCOUNT.level); ACCOUNT.level++; ups++; levelReward(ACCOUNT.level); }
  if (ups) { accSoon(true); if (started) { toast('ارتفع مستواك إلى ' + toAr(ACCOUNT.level) + '!', '+' + toAr(levelGold(ACCOUNT.level)) + ' ذهب' + (ACCOUNT.level % 5 === 0 && ACCOUNT.gemsFree < GEM_FREE_CAP ? ' و جوهرة' : '') + ' · لاعبون أكثر في الجزيرة'); AUDIO.treasure(); } }
}
const levelGold = (l) => 25 + l * 5;
function levelReward(l) { ACCOUNT.gold += levelGold(l); ACCOUNT.life.goldEarned = (ACCOUNT.life.goldEarned || 0) + levelGold(l); if (l % 5 === 0) grantGems(1); }
function grantGems(n) { const k = Math.max(0, n | 0); ACCOUNT.gemsFree += k; ACCOUNT.gems += k; return k; }
function addGold(n) { if (n > 0) { n = Math.round(n); ACCOUNT.gold += n; ACCOUNT.life.goldEarned = (ACCOUNT.life.goldEarned || 0) + n; accSoon(); } }
function spendGold(n) { if (ACCOUNT.gold < n) return false; ACCOUNT.gold -= n; accSoon(true); return true; }
function spendGems(n) { if (ACCOUNT.gems < n) return false; ACCOUNT.gems -= n; accSoon(true); return true; }
/* everything you do counts: lifetime counters feed experience, missions and achievements */
function track(stat, n = 1) {
  if (!(n > 0) || !ACC.loaded) return;
  const L = ACCOUNT.life; L[stat] = (L[stat] || 0) + n;
  const x = XP_RULE[stat]; if (x) addXP(x * n);
  ACC.mDirty = true;
  if (stat !== 'sec') { ACC.dirty = true; checkMissionPops(); }     // play time alone rides along with the next real change
}
const lifeOf = (stat) => stat === 'level' ? ACCOUNT.level : stat === 'wardrobe' ? ACCOUNT.wardrobe.length : stat === 'survBest' ? ACCOUNT.best.surv || 0 : ACCOUNT.life[stat] || 0;
function updateAccount(dt) {
  if (!ACC.loaded) return;
  if (started && player.alive && !paused) {
    ACC.secAcc += dt;
    if (ACC.secAcc >= 1) {
      const s = Math.floor(ACC.secAcc); ACC.secAcc -= s; track('sec', s);
      if (SURVIVE_T > (ACCOUNT.best.surv || 0)) ACCOUNT.best.surv = Math.floor(SURVIVE_T);
      if ((ACCOUNT.life.sec | 0) % 120 < s) addGold(1);        // a gold coin for every two minutes alive
      if ((ACCOUNT.life.sec | 0) % 30 < s) checkMissionPops();
    }
  }
  if (ACC.dirty && T - ACC.last > 15) accFlush();
}
function trackDrive(meters) { ACC.mAcc += meters; if (ACC.mAcc >= 100) { const k = Math.floor(ACC.mAcc / 100); ACC.mAcc -= k * 100; track('km', k / 10); } }

/* ── the wardrobe: clothes are yours for good ── */
function wardrobeAdd(id, quiet) {
  const it = ITEMS[id]; if (!isCosmetic(it)) return false;
  if (ACCOUNT.wardrobe.includes(id)) { if (!quiet && started) toast('لديك ' + it.name + ' بالفعل', 'في خزانة ملابسك'); return false; }
  ACCOUNT.wardrobe.push(id); accSoon(true);
  if (!quiet && started) toast('أُضيف إلى خزانتك: ' + it.name, 'البسه من الحقيبة أو من اللوبي · ملابسك تبقى معك دائماً');
  return true;
}
/* the run's worn clothes follow the account's look (gear like helmets and vests stays with the run) */
function syncLookToRun() {
  const W = INV.wearing;
  for (const s of COS_SLOTS) {
    if (s === 'hat' && W.hat && ITEMS[W.hat] && !isCosmetic(ITEMS[W.hat]) && invCount(W.hat) > 0) continue;
    if (ACCOUNT.look[s]) W[s] = ACCOUNT.look[s]; else delete W[s];
  }
}
/* the first time an older journey is opened: its clothes move into the wardrobe */
function accAbsorbRun() {
  if (ACCOUNT.seen.absorbed) return;
  ACCOUNT.seen.absorbed = 1;
  for (const [id] of [...INV.items]) { const it = ITEMS[id]; if (isCosmetic(it)) { if (!ACCOUNT.wardrobe.includes(id)) ACCOUNT.wardrobe.push(id); INV.items.delete(id); } }
  for (const [s, id] of Object.entries(INV.wearing || {})) { const it = ITEMS[id]; if (isCosmetic(it) && COS_SLOTS.includes(s)) { if (!ACCOUNT.wardrobe.includes(id)) ACCOUNT.wardrobe.push(id); if (!ACCOUNT.look[s]) ACCOUNT.look[s] = id; } }
  accSoon(true);
}
function buyWear(id) {
  const it = ITEMS[id]; if (!isCosmetic(it) || ownsWear(id)) return 'owned';
  if (it.gemPrice) { if (!spendGems(it.gemPrice)) return 'gems'; }
  else if (!spendGold(goldPrice(it))) return 'gold';
  wardrobeAdd(id, true); track('bought'); AUDIO.coins(); return 'ok';
}

/* ── the workshop: permanent upgrades bought with gold, unlocked by level ── */
const UPGRADES = [
  { id: 'harvest', name: 'حدّة الأدوات', desc: 'تقطع الشجر وتكسر الصخر أسرع وتجمع أكثر', per: 0.1, max: 5, base: 120, icon: 'axe', fmt: 'pct' },
  { id: 'melee', name: 'قوة الضربة', desc: 'ضرر أكبر بالسيف والرمح والفأس واليد', per: 0.1, max: 5, base: 140, icon: 'sword', fmt: 'pct' },
  { id: 'gun', name: 'إتقان السلاح', desc: 'ضرر أكبر لكل رصاصة', per: 0.08, max: 5, base: 160, icon: 'rifle', fmt: 'pct' },
  { id: 'armor', name: 'جلد صلب', desc: 'ضرر أقل من العضّ والرصاص والسقوط', per: 0.05, max: 5, base: 150, icon: 'vest', fmt: 'pct' },
  { id: 'stamina', name: 'اللياقة', desc: 'ركض أطول وطاقة تعود أسرع', per: 0.1, max: 5, base: 110, icon: 'person', fmt: 'pct' },
  { id: 'bag', name: 'حقيبة أوسع', desc: 'حمولة إضافية لكل مستوى', per: 40, max: 5, base: 100, icon: 'bag', fmt: 'add' },
  { id: 'engine', name: 'المحرّك', desc: 'سرعة قصوى أعلى لكل المركبات', per: 0.05, max: 5, base: 180, icon: 'car', fmt: 'pct' },
  { id: 'luck', name: 'الحظ', desc: 'غنائم أكثر من الصناديق والزومبي والحفر', per: 0.1, max: 5, base: 200, icon: 'gem', fmt: 'pct' },
];
const UPG = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));
const upgLevel = (id) => ACCOUNT.upg[id] || 0;
const upgCost = (u, l) => Math.round(u.base * Math.pow(l + 1, 1.7) / 10) * 10;
const UPG_REQ = [1, 3, 6, 10, 15];        // player level needed for the 1st..5th step
const upMul = (id) => 1 + upgLevel(id) * UPG[id].per;
const upAdd = (id) => upgLevel(id) * UPG[id].per;
function buyUpgrade(id) {
  const u = UPG[id]; if (!u) return 'none';
  const l = upgLevel(id); if (l >= u.max) return 'max';
  if (ACCOUNT.level < UPG_REQ[l]) return 'level';
  const c = upgCost(u, l); if (!spendGold(c)) return 'gold';
  ACCOUNT.upg[id] = l + 1; accSoon(true); AUDIO.craft(); hudDirty = true; return 'ok';
}

/* ── missions: three a day and three a week, from what you would do anyway ── */
const MISSIONS = {
  daily: [
    { id: 'd_kill', stat: 'kills', n: 15, text: 'اقتل ١٥ زومبي', gold: 40, xp: 120 }, { id: 'd_wood', stat: 'wood', n: 150, text: 'اجمع ١٥٠ خشبة', gold: 35, xp: 100 },
    { id: 'd_stone', stat: 'stone', n: 100, text: 'اجمع ١٠٠ حجر', gold: 35, xp: 100 }, { id: 'd_fell', stat: 'felled', n: 8, text: 'اقطع ٨ أشجار', gold: 30, xp: 90 },
    { id: 'd_craft', stat: 'crafted', n: 6, text: 'اصنع ٦ أشياء', gold: 30, xp: 90 }, { id: 'd_build', stat: 'built', n: 6, text: 'ابنِ ٦ قطع', gold: 35, xp: 100 },
    { id: 'd_surv', stat: 'sec', n: 900, text: 'ابقَ حياً ١٥ دقيقة', gold: 40, xp: 120 }, { id: 'd_drive', stat: 'km', n: 3, text: 'قُد ٣ كيلومترات', gold: 30, xp: 90 },
    { id: 'd_fish', stat: 'fish', n: 3, text: 'اصطد ٣ سمكات', gold: 35, xp: 100 }, { id: 'd_dig', stat: 'dug', n: 8, text: 'احفر ٨ حفر', gold: 30, xp: 90 },
    { id: 'd_rocks', stat: 'rocks', n: 6, text: 'حطّم ٦ صخور', gold: 30, xp: 90 }, { id: 'd_eat', stat: 'eat', n: 3, text: 'تناول ٣ وجبات', gold: 25, xp: 70 },
  ],
  weekly: [
    { id: 'w_kill', stat: 'kills', n: 150, text: 'اقتل ١٥٠ زومبي', gold: 320, xp: 900 }, { id: 'w_wood', stat: 'wood', n: 1000, text: 'اجمع ١٠٠٠ خشبة', gold: 300, xp: 850 },
    { id: 'w_surv', stat: 'sec', n: 10800, text: 'ابقَ حياً ٣ ساعات', gold: 350, xp: 1000 }, { id: 'w_drive', stat: 'km', n: 30, text: 'قُد ٣٠ كيلومتراً', gold: 260, xp: 750 },
    { id: 'w_craft', stat: 'crafted', n: 60, text: 'اصنع ٦٠ شيئاً', gold: 260, xp: 750 }, { id: 'w_build', stat: 'built', n: 60, text: 'ابنِ ٦٠ قطعة', gold: 280, xp: 800 },
    { id: 'w_treasure', stat: 'treasure', n: 3, text: 'اعثر على ٣ كنوز', gold: 300, xp: 850 }, { id: 'w_rocks', stat: 'rocks', n: 60, text: 'حطّم ٦٠ صخرة', gold: 240, xp: 700 },
  ],
};
const ACHIEVEMENTS = [
  { id: 'a_kill', stat: 'kills', tiers: [50, 250, 1000], text: (n) => 'اقتل ' + toAr(n) + ' زومبي', gold: [120, 350, 900], gems: [0, 1, 1] },
  { id: 'a_wood', stat: 'wood', tiers: [1000, 5000, 20000], text: (n) => 'اجمع ' + toAr(n) + ' خشبة', gold: [120, 350, 900], gems: [0, 0, 1] },
  { id: 'a_surv', stat: 'survBest', tiers: [3600, 3 * 3600, 10 * 3600], text: (n) => 'انجُ ' + (n === 3600 ? 'ساعة كاملة' : toAr(n / 3600) + ' ساعات') + ' في حياة واحدة', gold: [200, 500, 1200], gems: [1, 0, 1] },
  { id: 'a_fell', stat: 'felled', tiers: [100, 500, 2000], text: (n) => 'اقطع ' + toAr(n) + ' شجرة', gold: [100, 300, 800], gems: [0, 0, 0] },
  { id: 'a_rocks', stat: 'rocks', tiers: [100, 500, 2000], text: (n) => 'حطّم ' + toAr(n) + ' صخرة', gold: [100, 300, 800], gems: [0, 0, 0] },
  { id: 'a_craft', stat: 'crafted', tiers: [50, 250, 1000], text: (n) => 'اصنع ' + toAr(n) + ' شيئاً', gold: [100, 300, 800], gems: [0, 0, 0] },
  { id: 'a_build', stat: 'built', tiers: [50, 300, 1500], text: (n) => 'ابنِ ' + toAr(n) + ' قطعة', gold: [100, 300, 800], gems: [0, 0, 0] },
  { id: 'a_drive', stat: 'km', tiers: [25, 150, 600], text: (n) => 'قُد ' + toAr(n) + ' كم', gold: [100, 300, 800], gems: [0, 0, 0] },
  { id: 'a_treasure', stat: 'treasure', tiers: [3, 15, 50], text: (n) => 'اعثر على ' + toAr(n) + ' كنوز', gold: [150, 400, 1000], gems: [0, 1, 0] },
  { id: 'a_fish', stat: 'fish', tiers: [10, 50, 200], text: (n) => 'اصطد ' + toAr(n) + ' سمكة', gold: [100, 300, 800], gems: [0, 0, 0] },
  { id: 'a_hunt', stat: 'hunted', tiers: [10, 50, 200], text: (n) => 'اصطد ' + toAr(n) + ' حيواناً', gold: [100, 300, 800], gems: [0, 0, 0] },
  { id: 'a_level', stat: 'level', tiers: [5, 15, 30], text: (n) => 'بلغ المستوى ' + toAr(n), gold: [150, 450, 1200], gems: [0, 0, 0] },
  { id: 'a_ward', stat: 'wardrobe', tiers: [12, 30, 80], text: (n) => 'اجمع ' + toAr(n) + ' قطعة ملابس', gold: [100, 300, 800], gems: [0, 0, 0] },
];
/* training: the first steps, each paid once */
const TRAINING = [
  { id: 't_fell', stat: 'felled', n: 1, text: 'اقطع شجرة بالفأس', hint: 'اختر الفأس من الشريط واضرب الجذع', gold: 20, xp: 60 },
  { id: 't_rock', stat: 'rocks', n: 1, text: 'حطّم صخرة بالمعول', hint: 'المعول يكسر الصخور الملوّنة وفيها خامات', gold: 20, xp: 60 },
  { id: 't_craft', stat: 'crafted', n: 1, text: 'اصنع ألواح خشب من الحقيبة', hint: 'تبويب الصناعة ← ألواح خشب', gold: 20, xp: 60 },
  { id: 't_build', stat: 'built', n: 1, text: 'ابنِ أول قطعة', hint: 'اصنع أساساً وضعه من المخزون', gold: 25, xp: 80 },
  { id: 't_kill', stat: 'kills', n: 1, text: 'اقتل أول زومبي', hint: 'المسدس في الخانة السادسة', gold: 25, xp: 80 },
  { id: 't_dig', stat: 'dug', n: 1, text: 'احفر بالمجرفة', hint: 'في الأرض فحم وخامات وكنوز', gold: 20, xp: 60 },
  { id: 't_eat', stat: 'eat', n: 1, text: 'كُل شيئاً', hint: 'زر Q يأكل أفضل ما معك', gold: 15, xp: 40 },
  { id: 't_drive', stat: 'km', n: 0.3, text: 'قُد سيارة ٣٠٠ متر', hint: 'اقترب من سيارة واضغط «اركب»', gold: 25, xp: 80 },
];
const dayKey = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
function weekKey(d = new Date()) { const t = new Date(d.getFullYear(), d.getMonth(), d.getDate()); const day = (t.getDay() + 1) % 7; t.setDate(t.getDate() - day); return 'w' + dayKey(t); }   // weeks start on Saturday
function seededPick(list, n, seedStr) {
  let h = 2166136261; for (const ch of seedStr + ACCOUNT.id) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const r = RNG(h), a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n).map((m) => m.id);
}
const lifeSnap = () => JSON.parse(JSON.stringify(ACCOUNT.life));
function rollMissions() {
  const dk = dayKey(), wk = weekKey();
  if (!ACCOUNT.daily || ACCOUNT.daily.key !== dk) { ACCOUNT.daily = { key: dk, base: lifeSnap(), ids: seededPick(MISSIONS.daily, MISSION_COUNT.daily, dk), done: [], popped: [], chests: [] }; ACC.dirty = true; }
  if (!ACCOUNT.weekly || ACCOUNT.weekly.key !== wk) { ACCOUNT.weekly = { key: wk, base: lifeSnap(), ids: seededPick(MISSIONS.weekly, MISSION_COUNT.weekly, wk), done: [], popped: [] }; ACC.dirty = true; }
}
const MISSION_COUNT = { daily: 3, weekly: 3 };
const missionDef = (kind, id) => MISSIONS[kind].find((m) => m.id === id);
function missionProgress(kind, m) { const P = ACCOUNT[kind]; return Math.max(0, (ACCOUNT.life[m.stat] || 0) - ((P.base && P.base[m.stat]) || 0)); }
function claimMission(kind, id) {
  rollMissions();
  const P = ACCOUNT[kind], m = missionDef(kind, id); if (!m || !P.ids.includes(id) || P.done.includes(id)) return false;
  if (missionProgress(kind, m) < m.n) return false;
  P.done.push(id); ACCOUNT.gold += m.gold; addXP(m.xp);
  if (m.shards) ACCOUNT.shards = (ACCOUNT.shards || 0) + m.shards; if (m.mat) ACCOUNT.mat = (ACCOUNT.mat || 0) + m.mat; if (m.gems) grantGems(m.gems);
  accSoon(true); AUDIO.treasure(); return true;
}
function achTier(a) { return ACCOUNT.ach[a.id] | 0; }                       // tiers already claimed
function claimAch(id) {
  const a = ACHIEVEMENTS.find((q) => q.id === id); if (!a) return false;
  const k = achTier(a); if (k >= a.tiers.length || lifeOf(a.stat) < a.tiers[k]) return false;
  ACCOUNT.ach[id] = k + 1; ACCOUNT.gold += a.gold[k]; if (a.gems[k]) grantGems(a.gems[k]); accSoon(true); AUDIO.treasure(); return true;
}
function claimTraining(id) {
  const t = TRAINING.find((q) => q.id === id); if (!t || ACCOUNT.tut[id] || lifeOf(t.stat) < t.n) return false;
  ACCOUNT.tut[id] = 1; ACCOUNT.gold += t.gold; addXP(t.xp); accSoon(true); AUDIO.treasure(); return true;
}
/* how many rewards wait to be collected (the red dots in the lobby) */
function claimable() {
  rollMissions();
  let m = 0;
  for (const kind of ['daily', 'weekly']) { const P = ACCOUNT[kind]; for (const id of P.ids) { const d = missionDef(kind, id); if (d && !P.done.includes(id) && missionProgress(kind, d) >= d.n) m++; } }
  let a = 0; for (const q of ACHIEVEMENTS) { const k = achTier(q); if (k < q.tiers.length && lifeOf(q.stat) >= q.tiers[k]) a++; }
  let t = 0; for (const q of TRAINING) if (!ACCOUNT.tut[q.id] && lifeOf(q.stat) >= q.n) t++;
  return { missions: m + a, training: t };
}
/* a mission finished while you play: say so once */
let popT = 0;
function checkMissionPops() {
  if (!started || T - popT < 1) return; popT = T;
  rollMissions();
  for (const kind of ['daily', 'weekly']) {
    const P = ACCOUNT[kind]; P.popped = P.popped || [];
    for (const id of P.ids) { const d = missionDef(kind, id); if (d && !P.popped.includes(id) && !P.done.includes(id) && missionProgress(kind, d) >= d.n) { P.popped.push(id); toast('أنجزت مهمة: ' + d.text, 'استلم الجائزة من «المهام» في اللوبي'); AUDIO.pickup(true); return; } }
  }
}
