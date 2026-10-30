/* ═════════ other people: survivors who travel between the towns and shoot the dead, bandits who wait in the hills,
   and the shopkeepers behind their counters ═════════ */
const BOTS = [];
TARGET_LISTS.push(() => BOTS);
const TIPS = [
  'في معبد الرمال جنوب الصحراء كنوز مدفونة… احمل مجرفة.', 'المعول يكسر الصخور الملوّنة: فيها حديد ونحاس وذهب.', 'متجر الأزياء في المدينة يبيع كل الألوان.',
  'الليل قصير، لكن الزومبي فيه أكثر وأسرع.', 'اشوِ اللحم والسمك على النار قبل أن تأكله.', 'المصرف يشتري الذهب القديم والجواهر بأفضل سعر.',
  'في القاعدة العسكرية صناديق ذخيرة… والحراسة شديدة.', 'الخيل في السهول، اقترب منها بهدوء واركب.', 'قطّاع الطرق يكمنون في التلال بعيداً عن القرى.',
  'كاشف المعادن يصفّر أسرع كلما اقتربت من كنز.', 'ازرع البذور في حوض واسقه، أو انتظر المطر.', 'معرض السيارات في المدينة يبيع سيارة فيراري!',
  'في بلدة المنجم تاجر يشتري الخامات.', 'من برج الإرسال ترى الجزيرة كلها.', 'القلعة القديمة لها برج تصعد إلى قمته.',
];
const BOT_OUTFITS = {
  survivor: () => ({ top: { c: pick([0x6b4a2f, 0x2f4a6a, 0x56603f, 0x8a3a2e, 0x4a4a4a, 0xc8b48a]), a: 0.85, p: pick(['solid', 'solid', 'checks', 'stripes']) }, pants: { c: pick([0x2f3f5a, 0x3a3a40, 0x4a4030, 0x56603f]), a: 0.85 }, shoes: { c: 0x2a2420, a: 0.7 }, hat: pick([null, 'cap', 'beanie', 'cowboy', 'bandana', 'shemagh']), hatC: pick([0x2f4a6a, 0x8a2a2a, 0x6b4a2f, 0xd8d0c4]), pack: pick(['pack', 'bigpack', null]), packC: pick([0x56603f, 0x3a3a40, 0x6b4a2f]), glasses: rand() < 0.2 ? 'sunglasses' : null }),
  bandit: () => ({ top: { c: pick([0x1e1e20, 0x3a3a3a, 0x4a3a2a]), a: 0.9, p: pick(['solid', 'urban', 'camo']) }, pants: { c: 0x1e1e20, a: 0.9 }, shoes: { c: 0x1a1a1a, a: 0.8 }, head: { c: 0x2a2a2a, a: 0.5 }, hat: pick(['bandana', 'beanie', 'shemagh']), hatC: pick([0x1e1e20, 0x8a2a2a, 0x2a2a2a]), vest: rand() < 0.5 ? 'vest' : null, vestC: 0x2a2a2a }),
};
const KEEPER_OUTFIT = {
  clothes: { top: { c: 0xe8e6e0, a: 0.9 }, pants: { c: 0x1f2a44, a: 0.9 }, glasses: 'sunglasses' }, grocery: { top: { c: 0x3f6a3a, a: 0.9 }, pants: { c: 0x4a4030, a: 0.8 }, hat: 'cap', hatC: 0x3f6a3a },
  pharmacy: { top: { c: 0xf4f4f0, a: 0.95 }, pants: { c: 0x7a7a7a, a: 0.8 } }, tools: { top: { c: 0xd8702a, a: 0.85 }, pants: { c: 0x2f3f5a, a: 0.8 }, hat: 'cap', hatC: 0xd8702a },
  guns: { top: { c: 0x56603f, a: 0.9, p: 'camo' }, pants: { c: 0x4a4438, a: 0.8 }, hat: 'cowboy', hatC: 0x6b4a2f }, cars: { top: { c: 0x1e1e20, a: 0.9 }, pants: { c: 0x1e1e20, a: 0.9 } },
  cafe: { top: { c: 0x6b4a2f, a: 0.85 }, pants: { c: 0x2a2a2a, a: 0.8 } }, bakery: { top: { c: 0xf0ece0, a: 0.9 }, pants: { c: 0x6b4a2f, a: 0.8 }, hat: 'beanie', hatC: 0xf0ece0 },
  bank: { top: { c: 0x1f2a44, a: 0.9 }, pants: { c: 0x1f2a44, a: 0.9 }, glasses: 'sunglasses', glassesC: 0xb8902a }, ores: { top: { c: 0x8a6a45, a: 0.8, p: 'checks' }, pants: { c: 0x3a3a40, a: 0.8 }, hat: 'helmet', hatC: 0xd8b030 },
  gas: { top: { c: 0xc8302a, a: 0.9 }, pants: { c: 0x2f3f5a, a: 0.8 }, hat: 'cap', hatC: 0xc8302a },
};
function botGun(kind) { const g = buildGun(new THREE.Group(), kind); return g; }
/* the others look like players: a gamer name, an 8-digit ID and a level near yours, on a tag over the head
   (when the game goes online, real players take their places) */
const TAGS = ['ذيب_الصحراء', 'صقر٧٧', 'أبو_فهد', 'ليث_الجبل', 'نمر_الليل', 'سيف٩٠', 'فارس_الغابة', 'برق', 'شبح_المدينة', 'ملك_الجزيرة', 'قنّاص_الشمال', 'رعد١٢', 'نجم_البحر', 'عاصفة', 'دبّ_القطب', 'سهم_الفجر', 'بركان٥٥', 'ليلى_الحرّة', 'نور٢٣', 'رنا_القنّاصة',
  'Shadow_77', 'NightWolf', 'AbuSaif', 'Raptor99', 'DesertFox', 'Zed_Hunter', 'Falcon_X', 'IronLeo', 'Storm_21', 'Nomad', 'Ghost_K', 'Viper_7', 'Mira_X', 'SandStorm', 'Oasis_Kid'];
function makeTag() {
  const c = document.createElement('canvas'); c.width = 320; c.height = 84;
  const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
  sp.scale.set(1.55, 0.41, 1); sp.renderOrder = 4; sp.visible = false;
  return { sp, c, tex };
}
function paintTag(b) {
  const T0 = b.tag, g = T0.c.getContext('2d'); if (!g) return;
  g.clearRect(0, 0, 320, 84);
  const hostile = b.type === 'bandit' || b.angry;
  g.fillStyle = 'rgba(8,14,20,.62)'; g.beginPath(); if (g.roundRect) g.roundRect(4, 10, 312, 64, 18); else g.rect(4, 10, 312, 64); g.fill();
  g.fillStyle = hostile ? '#e5493c' : '#ffb53d'; g.beginPath(); g.arc(46, 42, 24, 0, TAU); g.fill();
  g.fillStyle = '#0e2a32'; g.font = "700 22px 'Readex Pro',sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(b.lv), 46, 44);
  g.fillStyle = hostile ? '#ffb0a6' : '#f2f6f1'; g.font = "700 27px 'Readex Pro',sans-serif"; g.textAlign = 'right'; g.direction = 'rtl';
  let fs = 27; while (g.measureText(b.name).width > 236 && fs > 16) { fs -= 2; g.font = `700 ${fs}px 'Readex Pro',sans-serif`; }
  g.fillText(b.name, 300, 42);
  T0.tex.needsUpdate = true; b.tagHostile = hostile;
}
function makeBot() {
  const kind = rand() < 0.35 && CHARS.michelle ? 'michelle' : 'soldier';
  const body = makeBody(kind, { outfit: BOT_OUTFITS.survivor(), shadow: QUALITY.tier >= 2 }); if (!body) return null;
  const root = body.root; root.visible = false; scene.add(root); root.updateMatrixWorld(true);
  const gun = botGun('rifle'); root.add(gun); gun.position.set(0.14, 1.3, 0.3); gun.visible = false;
  const tag = makeTag(); scene.add(tag.sp);
  const b = { body, root, mixer: body.mixer, acts: body.act, bones: body.bones, gun, tag, lv: 1, pid: '', active: false, state: 'dead', x: 0, y: 0, z: 0, yaw: 0, hp: 0, type: 'survivor', scale: 1, flash: 0, deadT: 0, cd: 0, tx: 0, tz: 0, wT: 0, angry: false, name: '', target: null, sx: 0, sz: 0, stuck: 0, side: 0, sideT: 0, gifted: false, blood: 0x4a1210,
    hits: [[new THREE.Vector3(), 0.2, true], [new THREE.Vector3(), 0.34, false], [new THREE.Vector3(), 0.3, false], [new THREE.Vector3(), 0.18, false], [new THREE.Vector3(), 0.18, false]] };
  b.hurt = (dmg, head, dir, from) => hurtBot(b, dmg, head, dir, from);
  BOTS.push(b); return b;
}
/* what the survivors tell you on other maps: the same advice, with this map's own places */
function refreshTips() {
  if (MAP_ID === 'island' || !WORLD.data) return;
  const P = WORLD.data.poi || [], S = WORLD.data.settlements || [], byKind = (k) => P.find((p) => p.kind === k);
  const city = S.find((q) => q.kind === 'city'), oreTown = S.find((q) => (q.buildings || []).some((b) => b.shop === 'ores')), base = S.find((q) => q.kind === 'military');
  const out = [
    'المعول يكسر الصخور الملوّنة: فيها حديد ونحاس وذهب.', 'الليل قصير، لكن الزومبي فيه أكثر وأسرع.', 'اشوِ اللحم والسمك على النار قبل أن تأكله.',
    'كاشف المعادن يصفّر أسرع كلما اقتربت من كنز.', 'ازرع البذور في حوض واسقه، أو انتظر المطر.', 'قطّاع الطرق يكمنون بعيداً عن القرى.',
  ];
  const ru = byKind('ruins'), ra = byKind('radio'), ca = byKind('castle');
  if (ru) out.push('في ' + ru.name + ' كنوز مدفونة… احمل مجرفة.');
  if (ra) out.push('من ' + ra.name + ' ترى ' + mapTitle() + (MAP_ID === 'water' ? ' كله.' : ' كلها.'));
  if (ca) out.push(ca.name + ' لها برج تصعد إلى قمته.');
  if (city) out.push('في ' + city.name + ' متجر ملابس ومعرض سيارات ومصرف.');
  if (oreTown) out.push('في ' + oreTown.name + ' تاجر يشتري الخامات.');
  if (base) out.push('في ' + base.name + ' صناديق ذخيرة… والحراسة شديدة.');
  if (MAP_ID === 'desert') out.push('حين تهبّ العاصفة الرملية احتمِ ببيت أو اركب سيارتك.', 'في الواحة ماء ونخيل… وحيوانات تأتي لتشرب.');
  if (MAP_ID === 'snow') out.push('البحيرات متجمّدة: تمشي فوقها… لكن البرد هناك قاسٍ.', 'في العاصفة الثلجية لا ترى أبعد من خطوات.');
  if (MAP_ID === 'water') out.push('القوارب هي الطرق هنا: خذ واحداً من أي رصيف.', 'على السفن الحربية قراصنة لا ينامون.');
  if (MAP_ID === 'forest') out.push('الغابة كثيفة لا ترى فيها بعيداً: اتبع الطريق أو النهر.', 'في الغابات المجنونة يكثر الحطب… والخنازير البرية الغاضبة.');
  if (MAP_ID === 'mega') out.push('اصعد برج مراقبة: ينكشف الضباب عن الخريطة حولك كيلومترات.', 'الحمم تحرق: ابقَ على الصخر الأسود عند البركان.', 'المختبرات تحت الأرض يحرسها مسلّحون… وفي داخلها سلاح.', 'القطار يمرّ على السكة كل حين: لا تقف أمامه.', 'في البحيرة الكبرى جزيرة سرّية فيها كنوز.');
  TIPS.splice(0, TIPS.length, ...out);
}
function initBots() { refreshTips(); if (!CHARS.soldier) return; for (let i = 0; i < QUALITY.bots + 6; i++) makeBot(); for (let i = 0; i < 4; i++) makeKeeper(); initGuards(); }
/* more people on the island as your level rises */
const botTarget = () => Math.min(BOTS.length, QUALITY.bots + Math.floor((ACC.loaded ? ACCOUNT.level : 1) / 3));
function pickDest(b) {
  const near = SETTLEMENTS.filter((S) => Math.hypot(S.x - b.x, S.z - b.z) < 1600 && Math.hypot(S.x - b.x, S.z - b.z) > 60);
  if (near.length && rand() < 0.7) { const S = pick(near); b.tx = S.x + rr(-20, 20); b.tz = S.z + rr(-20, 20); }
  else { b.tx = b.x + rr(-200, 200); b.tz = b.z + rr(-200, 200); }
  b.wT = rr(60, 140);
}
let botSpawnT = 3;
function spawnBot() {
  const b = BOTS.find((q) => !q.active); if (!b) return;
  for (let tries = 0; tries < 14; tries++) {
    const a = rr(0, TAU), d = rr(90, 230), x = player.pos.x + Math.cos(a) * d, z = player.pos.z + Math.sin(a) * d, h = terrainAt(x, z);
    if (!inPlay(x, z) || h < waterAt(x, z) + 0.3 || slopeAt(x, z) > 0.6 || buildingAt(x, z, h + 1)) continue;
    const town = nearSettlement(x, z, 1.5), bandit = !town && rand() < 0.3 + ENV.night * 0.3 && Math.hypot(x - WORLD.data.spawn.x, z - WORLD.data.spawn.z) > 400;
    Object.assign(b, { active: true, state: bandit ? 'ambush' : 'travel', type: bandit ? 'bandit' : 'survivor', x, z, y: groundAt(x, z, h + 1), hp: bandit ? 120 : 100, maxHp: bandit ? 120 : 100, yaw: rr(0, TAU), angry: bandit, flash: 0, deadT: 0, cd: 1, target: null, gifted: false, stuck: 0, sx: x, sz: z, sideT: 0, guard: null, post: null });
    armBot(b, bandit);
    pickDest(b);
    return;
  }
}
function armBot(b, bandit) {
  b.name = TAGS[Math.floor(Math.random() * TAGS.length)]; b.pid = String(10000000 + Math.floor(Math.random() * 90000000));
  b.lv = Math.max(1, (ACC.loaded ? ACCOUNT.level : 1) + Math.floor(Math.random() * 11) - 4) + (bandit ? 2 : 0);
  paintTag(b);
  dressBody(b.body, BOT_OUTFITS[b.type]());
  const gk = bandit ? pick(['rifle', 'shotgun', 'pistol']) : pick(['rifle', 'pistol', 'rifle']);
  if (b.gunKind !== gk) { const old = b.gun; if (old.parent) old.parent.remove(old); b.gun = botGun(gk); b.root.add(b.gun); b.gun.position.set(0.14, gk === 'pistol' ? 1.38 : 1.3, gk === 'pistol' ? 0.42 : 0.3); b.gunKind = gk; }
  b.root.visible = true;
  for (const a2 of Object.values(b.acts)) { a2.stop(); a2.enabled = true; }
  b.walk = b.acts.Walk; b.run = b.acts.Run || b.acts.Walk; b.idle = b.acts.Idle;
  for (const a2 of [b.walk, b.run, b.idle]) if (a2) { a2.play(); a2.setEffectiveWeight(0); }
  if (b.idle) b.idle.setEffectiveWeight(1);
}
/* guards a map posts on ships, platforms and towers: always hostile, they hold their ground, and others take their place a while
   after they fall — on the water world the fighting never really stops */
const GUARD_SPOTS = [];
function initGuards() {
  for (const g of (WORLD.data.extras && WORLD.data.extras.guards) || []) if (Array.isArray(g) && g.length >= 3 && g.every((v) => typeof v === 'number')) GUARD_SPOTS.push({ x: g[0], y: g[1], z: g[2], r: g[3] || 4, bot: null, cd: 0 });
  // armed men keep the sunken labs: three posts around each, on the slope down to the door
  for (const p of WORLD.data.poi || []) {
    if (p.kind !== 'lab') continue;
    for (let k = 0; k < 3; k++) {
      const a = k * TAU / 3 + 0.4, x = p.x + Math.cos(a) * 17, z = p.z + Math.sin(a) * 17;
      if (terrainAt(x, z) > waterAt(x, z) + 0.3) GUARD_SPOTS.push({ x, y: terrainAt(x, z), z, r: 6, bot: null, cd: 0 });
    }
  }
  for (let i = 0; i < Math.min(8, GUARD_SPOTS.length); i++) makeBot();
}
function spawnGuard(s) {
  const b = BOTS.find((q) => !q.active); if (!b) return false;
  const x = s.x + rr(-1, 1), z = s.z + rr(-1, 1);
  Object.assign(b, { active: true, state: 'guard', type: 'bandit', x, z, y: groundAt(x, z, s.y + 1.5), hp: 130, maxHp: 130, yaw: rr(0, TAU), angry: true, flash: 0, deadT: 0, cd: 1.5, target: null, gifted: false, stuck: 0, sx: x, sz: z, sideT: 0, guard: s, post: s, tx: x, tz: z, wT: 99 });
  armBot(b, true); s.bot = b; return true;
}
function updateGuards(dt) {
  if (!GUARD_SPOTS.length || !started) return;
  const p = player.pos;
  for (const s of GUARD_SPOTS) {
    if (s.bot) { if (s.bot.guard === s && s.bot.active) continue; s.cd = s.bot.state === 'dead' ? rr(90, 150) : 0; s.bot = null; }
    if ((s.cd -= dt) > 0) continue;
    const d = Math.hypot(s.x - p.x, s.z - p.z); if (d > 230 || d < 30) continue;
    spawnGuard(s);
  }
}
function hurtBot(b, dmg, head, dir, from) {
  if (b.state === 'dead') return;
  b.hp -= dmg; b.flash = 0.12;
  if (from === 'player') { if (!b.angry && b.type === 'survivor') toast(b.name + ' غاضب منك!', 'لقد هاجمته'); b.angry = true; b.target = 'player'; b.state = 'fight'; if (!b.tagHostile) paintTag(b); }
  AUDIO.zhit(Math.hypot(b.x - player.pos.x, b.z - player.pos.z));
  if (b.hp <= 0) {
    b.state = 'dead'; b.deadT = 0; b.fallDir = Math.atan2(dir.x, dir.z); b.gun.visible = false; b.tag.sp.visible = false;
    if (from === 'player') { onKill(b, head, 'player'); STATS.bots = (STATS.bots || 0) + 1; track('bots'); addGold(4); if (b.type === 'bandit') addCoins(30 + Math.floor(rand() * 40)); }
    const items = rollLoot(b.type === 'bandit' ? 'military' : 'home'); const g = groundAt(b.x, b.z, b.y + 1);
    if (rand() < 0.5) items.push([b.gunKind === 'pistol' ? 'ammo9' : b.gunKind === 'shotgun' ? 'shells' : 'ammo556', 6 + Math.floor(rand() * 18)]);
    if (b.type === 'bandit' && rand() < 0.2) items.push([b.gunKind === 'pistol' ? 'pistol' : b.gunKind, 1]);
    // what they carried falls into a crate with their name on it
    items.push(...botKit(b));
    if (items.length) makeCrate(b.x, b.z, items, { y: g + 0.02, name: 'صندوق ' + (b.name || 'ناجٍ'), life: 600 });
    AUDIO.zdie(Math.hypot(b.x - player.pos.x, b.z - player.pos.z));
  }
}
const _nq = new THREE.Quaternion(), _nm = new THREE.Vector3(), _nt = new THREE.Vector3(), _nr = new THREE.Vector3();
function botShoot(b, tx, ty, tz, tgt) {
  const d = Math.hypot(tx - b.x, tz - b.z), kind = b.gunKind || 'rifle';
  b.cd = kind === 'shotgun' ? rr(1.2, 1.8) : kind === 'pistol' ? rr(0.6, 1.0) : rr(0.35, 0.8);
  b.bones.RightHand.getWorldPosition(_nm); _nm.x += Math.sin(b.yaw) * 0.6; _nm.z += Math.cos(b.yaw) * 0.6;
  const acc = clamp(0.62 - d / 110, 0.06, 0.55) * (tgt === 'player' ? (player.vehicle ? 0.5 : 1) * (player.speed > 4 ? 0.6 : 1) : 1.2) * (b.type === 'bandit' ? 1 : 1.2);
  const hit = rand() < acc;
  _nt.set(tx + (hit ? 0 : rr(-1.5, 1.5)), ty + (hit ? 0 : rr(-0.5, 1.2)), tz + (hit ? 0 : rr(-1.5, 1.5)));
  tracer(_nm, _nt); spawnPuff(_nm.x, _nm.y, _nm.z, 0xffd27a, 2, 3, 0.04, -6, 0.1);
  AUDIO.shot(kind, Math.hypot(b.x - player.pos.x, b.z - player.pos.z));
  NOISE.x = b.x; NOISE.z = b.z; NOISE.t = T; NOISE.r = 70;
  if (!hit) { if (rand() < 0.4) spawnPuff(_nt.x, groundAt(_nt.x, _nt.z, _nt.y) + 0.05, _nt.z, 0x9a8a6a, 4, 1.6, 0.06, -6, 0.5); return; }
  const dmg = kind === 'shotgun' ? 26 : kind === 'pistol' ? 12 : 15;
  if (tgt === 'player') damagePlayer(dmg * ARMOR() * (d > 40 ? 0.7 : 1), b, 'shot');
  else if (tgt) { _nr.set(tgt.x - b.x, 0, tgt.z - b.z).normalize(); hurtTarget(tgt, dmg * 2.2, false, _nr, 'bot'); }
}
function setBotAnim(b, mode, speed) {
  const w = { idle: mode === 'idle' ? 1 : 0, walk: mode === 'walk' ? 1 : 0, run: mode === 'run' ? 1 : 0 };
  if (b.idle) b.idle.setEffectiveWeight(damp(b.idle.getEffectiveWeight(), w.idle, 8, 0.05));
  if (b.walk) { b.walk.setEffectiveWeight(damp(b.walk.getEffectiveWeight(), w.walk, 8, 0.05)); b.walk.timeScale = clamp(speed / 1.4, 0.5, 1.5); }
  if (b.run && b.run !== b.walk) { b.run.setEffectiveWeight(damp(b.run.getEffectiveWeight(), w.run, 8, 0.05)); b.run.timeScale = clamp(speed / 4, 0.6, 1.3); }
}
function updateBots(dt, t) {
  if (!BOTS.length) return;
  updateGuards(dt);
  const p = player.pos;
  let active = 0; for (const b of BOTS) if (b.active) active++;
  botSpawnT -= dt;
  if (botSpawnT <= 0 && active < botTarget() && t - player.bornAt > 20) { spawnBot(); botSpawnT = 6; }
  for (const b of BOTS) {
    if (!b.active) continue;
    const dx = p.x - b.x, dz = p.z - b.z, dP = Math.hypot(dx, dz);
    if (b.state === 'dead') {
      b.deadT += dt; const fall = smooth(0, 0.7, b.deadT), sink = smooth(20, 26, b.deadT) * 0.8;
      b.root.rotation.set(-fall * 1.5, b.fallDir + Math.PI, 0, 'YXZ'); b.root.position.set(b.x, b.y - sink, b.z);
      if (b.deadT < 1) b.mixer.update(dt);
      if (b.deadT > 27 || dP > 300) { b.active = false; b.root.visible = false; }
      continue;
    }
    if (dP > (b.guard ? 300 : 420)) { b.active = false; b.root.visible = false; b.tag.sp.visible = false; continue; }
    // choose what to do
    let tgt = null, td = 1e9;
    if (b.angry && player.alive && dP < (b.guard ? 75 : b.type === 'bandit' ? 48 : 60) && !player.inside) { tgt = 'player'; td = dP; }
    if (!tgt || td > 25) for (const z of ZOMBIES) { if (!z.active || z.state === 'dead') continue; const d = Math.hypot(z.x - b.x, z.z - b.z); if (d < 30 && d < td) { tgt = z; td = d; } }
    if (tgt && b.state !== 'flee') b.state = 'fight';
    else if (b.state === 'fight') b.state = b.guard ? 'guard' : b.type === 'bandit' ? 'ambush' : 'travel';
    if (b.hp < b.maxHp * 0.3 && b.state === 'fight' && tgt === 'player' && !b.guard) { b.state = 'flee'; b.fleeT = 8; }
    let gx = 0, gz = 0, spd = 0, mode = 'idle';
    if (b.state === 'travel') {
      b.wT -= dt; const ddx = b.tx - b.x, ddz = b.tz - b.z, dd = Math.hypot(ddx, ddz);
      if (dd < 6 || b.wT <= 0) { b.state = 'rest'; b.restT = rr(15, 40); }
      else { gx = ddx / dd; gz = ddz / dd; spd = 1.45; mode = 'walk'; }
    } else if (b.state === 'rest') { b.restT -= dt; if (b.restT <= 0) { pickDest(b); b.state = 'travel'; } if (dP < 6 && player.alive && !b.angry) b.yaw = angLerp(b.yaw, Math.atan2(dx, dz), 1 - Math.exp(-dt * 3)); }
    else if (b.state === 'ambush') { if (dP < 6) b.yaw = angLerp(b.yaw, Math.atan2(dx, dz), 1 - Math.exp(-dt * 3)); }
    else if (b.state === 'guard') { b.wT -= dt; if (b.wT <= 0) { b.wT = rr(3, 7); b.yaw += rr(-1.2, 1.2); } }
    else if (b.state === 'flee') { b.fleeT -= dt; gx = -dx / (dP || 1); gz = -dz / (dP || 1); spd = 3.8; mode = 'run'; if (b.fleeT <= 0) b.state = b.type === 'bandit' ? 'ambush' : 'travel'; }
    else if (b.state === 'fight' && tgt) {
      const tx = tgt === 'player' ? p.x : tgt.x, tz = tgt === 'player' ? p.z : tgt.z, ty = tgt === 'player' ? p.y + 1.2 : tgt.y + 1.1;
      const ddx = tx - b.x, ddz = tz - b.z, dd = Math.hypot(ddx, ddz) || 1;
      b.yaw = angLerp(b.yaw, Math.atan2(ddx, ddz), 1 - Math.exp(-dt * 8));
      const want = b.guard ? 1e9 : tgt === 'player' ? 16 : 9;
      if (dd > want + 6) { gx = ddx / dd; gz = ddz / dd; spd = 3.4; mode = 'run'; }
      else if (dd < want - 5) { gx = -ddx / dd; gz = -ddz / dd; spd = 1.4; mode = 'walk'; }
      b.cd -= dt;
      if (b.cd <= 0 && dd < 70) botShoot(b, tx, ty, tz, tgt);
    }
    // move like everyone else: along the ground, out of the water, round obstacles
    if (spd > 0) {
      if (b.sideT > 0) { b.sideT -= dt; const c = Math.cos(b.side), s = Math.sin(b.side), nx = gx * c - gz * s, nz = gx * s + gz * c; gx = nx; gz = nz; }
      const ox = gx * spd * dt, oz = gz * spd * dt, nx = b.x + ox, nz = b.z + oz, gN = groundAt(nx, nz, b.y);
      if (b.post && Math.hypot(nx - b.post.x, nz - b.post.z) > b.post.r) { b.sideT = 0; } else
      if (gN > waterAt(nx, nz) - 0.5 && gN - b.y < STEP_UP + 0.05) { b.x = nx; b.z = nz; } else { b.sideT = 1.2; b.side = rand() < 0.5 ? 1.4 : -1.4; }
      resolveCollision(b, 0.34);
      if (b.state !== 'fight') b.yaw = angLerp(b.yaw, Math.atan2(gx, gz), 1 - Math.exp(-dt * 5));
      b.stuck += dt; if (b.stuck > 1.2) { if (Math.hypot(b.x - b.sx, b.z - b.sz) < 0.3 * spd) { b.side = rand() < 0.5 ? 1.4 : -1.4; b.sideT = 1.2; if (b.state === 'travel' && rand() < 0.3) pickDest(b); } b.stuck = 0; b.sx = b.x; b.sz = b.z; }
    }
    // the bandit springs the ambush
    if (b.type === 'bandit' && b.state === 'ambush' && player.alive && dP < 45 && !player.inside) { b.state = 'fight'; if (dP < 60) toast('قطّاع طرق!', 'احتمِ وردّ النار'); }
    if (b.state === 'guard' && player.alive && dP < 75 && !player.inside) { b.state = 'fight'; if (T - (updateBots.warnT || -99) > 40) { updateBots.warnT = T; toast(MAP_ID === 'water' ? 'قراصنة!' : 'حرّاس مسلّحون!', 'يطلقون النار من مواقعهم · احتمِ وردّ النار'); } }
    b.y = damp(b.y, groundAt(b.x, b.z, b.y + 0.3), 12, dt);
    b.flash = Math.max(0, b.flash - dt);
    setBotAnim(b, mode, spd);
    b.root.position.set(b.x + (b.flash > 0 ? (Math.random() - 0.5) * 0.05 : 0), b.y, b.z); b.root.rotation.set(0, b.yaw, 0);
    const vis = dP < 160;
    b.root.visible = vis;
    b.tag.sp.visible = vis && dP < 48;
    if (b.tag.sp.visible) { b.tag.sp.position.set(b.x, b.y + 2.12, b.z); b.tag.sp.material.opacity = smooth(48, 30, dP); }
    if (vis) {
      b.mixer.update(dt);
      b.root.updateMatrixWorld(true); b.root.getWorldQuaternion(_nq);
      const armed = b.state === 'fight';
      b.gun.visible = armed;
      if (armed) { aimLimb(b.bones.RightArm, b.bones.RightForeArm, -0.05, 0.1, 1, 0.9, _nq); aimLimb(b.bones.LeftArm, b.bones.LeftForeArm, 0.25, 0.1, 1, 0.85, _nq); aimLimb(b.bones.RightForeArm, b.bones.RightHand, 0, 0.05, 1, 0.8, _nq); }
    }
    b.bones.Head.getWorldPosition(b.hits[0][0]); b.bones.Spine2.getWorldPosition(b.hits[1][0]); b.bones.Hips.getWorldPosition(b.hits[2][0]); b.bones.LeftLeg.getWorldPosition(b.hits[3][0]); b.bones.RightLeg.getWorldPosition(b.hits[4][0]);
  }
  updateKeepers(dt);
}
function npcUseNear(p, cand) {
  for (const b of BOTS) { if (!b.active || b.state === 'dead' || b.angry) continue; const d = Math.hypot(b.x - p.x, b.z - p.z); if (d < 2.6) cand('talk', 'تحدّث مع ' + b.name, b, d + 0.2); }
}
function npcTalk(b) {
  b.state = 'rest'; b.restT = 12; b.yaw = Math.atan2(player.pos.x - b.x, player.pos.z - b.z);
  AUDIO.talk();
  if (!b.gifted && rand() < 0.35) { b.gifted = true; const g = pick([['bandage', 1], ['water', 2], ['bread', 1], ['ammo9', 10], ['seed_tomato', 3], ['torch', 1], ['treasure_map', 1]]); invAdd(g[0], g[1], true); toast(b.name + ': خذ هذا، قد ينفعك', toAr(g[1]) + ' ' + ITEMS[g[0]].name); return; }
  toast(b.name + ' · المستوى ' + toAr(b.lv) + ':', pick(TIPS));
}

/* ── shopkeepers stand behind the counters of the shops near you ── */
const KEEPERS = [];
function makeKeeper() {
  // the two scanned women keep the nearest shops when they loaded; the rigged bodies fill in
  const want = ['casual', 'soldier', 'blonde', 'michelle'][KEEPERS.length % 4];
  const kind = CHARS[want] ? want : KEEPERS.length % 2 && CHARS.michelle ? 'michelle' : 'soldier';
  const body = makeBody(kind, { outfit: KEEPER_OUTFIT.grocery, shadow: QUALITY.tier >= 2 }); if (!body) return;
  body.root.visible = false; scene.add(body.root);
  for (const a of Object.values(body.act)) { a.stop(); a.enabled = true; }
  if (body.act.Idle) { body.act.Idle.play(); body.act.Idle.setEffectiveWeight(1); body.act.Idle.time = rand() * 3; }
  KEEPERS.push({ body, spot: null });
}
let keeperT = 0;
function updateKeepers(dt) {
  keeperT -= dt;
  const p = player.pos;
  if (keeperT <= 0) {
    keeperT = 1;
    const want = SHOP_SPOTS.map((s) => [s, Math.hypot(s.x - p.x, s.z - p.z)]).filter(([, d]) => d < 70).sort((a, b) => a[1] - b[1]).slice(0, KEEPERS.length).map(([s]) => s);
    for (const k of KEEPERS) if (k.spot && !want.includes(k.spot)) { k.spot = null; k.body.root.visible = false; }
    for (const s of want) {
      if (KEEPERS.some((k) => k.spot === s)) continue;
      const k = KEEPERS.find((q) => !q.spot); if (!k) break;
      k.spot = s; dressBody(k.body, KEEPER_OUTFIT[s.kind] || KEEPER_OUTFIT.grocery);
      k.body.root.position.set(s.kx, s.y, s.kz); k.body.root.rotation.set(0, s.ry, 0); k.body.root.visible = true;
    }
  }
  for (const k of KEEPERS) {
    if (!k.spot) continue;
    const s = k.spot, d = Math.hypot(p.x - s.kx, p.z - s.kz);
    if (d < 9) { const want = Math.atan2(p.x - s.kx, p.z - s.kz); k.body.root.rotation.y = angLerp(k.body.root.rotation.y, want, 1 - Math.exp(-dt * 3)); }
    if (d < 40) k.body.mixer.update(dt);
  }
}
