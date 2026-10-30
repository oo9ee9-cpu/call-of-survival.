/* ═════════ the lobby's new pages: crates (and opening them), weapon skins and their seven levels, titles, the day's deals and
   materials in the store, and the first visit, where you name yourself and choose who you are ═════════ */

/* ── crates ── */
function crateArt(type, big) {
  const C = CRATE_TYPES[type] || { col: '#7a8a9a' };
  return `<span class="cr-art${big ? ' big' : ''}" style="--cc:${C.col}"><i class="lid"></i><i class="body"></i><i class="band"></i><i class="glow"></i></span>`;
}
function renderCrates(body) {
  const own = ACCOUNT.crates || {};
  chipRow(SHEETS.crates.chips, LOBBY.sub, (k) => { LOBBY.sub = k; renderSheet(); }, Object.fromEntries(Object.entries(own).filter(([, v]) => v > 0).concat([['mine', Object.values(own).reduce((a, b) => a + b, 0)]])));
  if (LOBBY.sub === 'mine') { renderMyCrates(body); return; }
  const type = LOBBY.sub, C = CRATE_TYPES[type]; if (!C) return;
  $('lbSheetSub').textContent = 'تملك ' + toAr(own[type] || 0) + ' من هذا الصندوق';
  const hero = el('div', 'cr-hero');
  hero.innerHTML = crateArt(type, true) + `<div class="cr-info"><b></b><span></span><div class="cr-odds"></div></div>`;
  hero.querySelector('.cr-info b').textContent = C.name; hero.querySelector('.cr-info span').textContent = C.desc;
  const odds = hero.querySelector('.cr-odds'), tot = Object.values(C.odds).reduce((a, b) => a + b, 0);
  for (const [k, v] of Object.entries(C.odds)) { const R0 = RARITY[k], o = el('em'); o.style.color = R0 ? R0.col : '#9fe0ff'; o.textContent = (R0 ? R0.ar : 'مواد') + ' ' + toAr(+(v / tot * 100).toFixed(1)) + '٪'; odds.append(o); }
  body.append(hero);
  const price = (n) => { const stock = Math.min(own[type] || 0, n), rest = n - stock; if (!rest) return 'مجاناً من صناديقك'; const c = rest === 10 ? C.ten : (C.gold || C.gems) * rest; return (C.gold ? svg('coin') + fmtN(c) : svg('gem') + toAr(c)); };
  const btns = el('div', 'cr-btns');
  btns.append(btn2('افتح ١<small>' + price(1) + '</small>', () => crateOpenUI(type, 1), 'lbtn cr1'), btn2('افتح ١٠<small>' + price(10) + '</small>', () => crateOpenUI(type, 10), 'lbtn cr10'));
  body.append(btns);
  if (C.ten) body.append(el('p', 'lb-note', 'عشرة صناديق بسعر تسعة · بعد ٤٠ فتحة دون قطعة أسطورية تأتيك واحدة مضمونة · المكرّر يتحول قطع صناديق أو مواد تطوير.'));
  // what is inside, best first
  const head = el('div', 'shead', 'في الصندوق'); body.append(head);
  const grid = el('div', 'lb-rgrid'), pool = C.pool().slice().sort((a, b) => RAR_ORDER.indexOf(b.rarity || rarOf(b)) - RAR_ORDER.indexOf(a.rarity || rarOf(a)));
  for (const it of pool.slice(0, 18)) {
    if (String(it.id).startsWith('wskin:')) { const sid = it.id.slice(6), S = WSKINS[sid]; grid.append(skinCard(sid, { small: true })); continue; }
    grid.append(rarCard(it, { own: ACCOUNT.wardrobe.includes(it.id), onTap: () => { LOBBY.preview = it.id; lobbyDress(); } }));
  }
  body.append(grid);
}
function renderMyCrates(body) {
  const own = ACCOUNT.crates || {}, sh = ACCOUNT.shards || 0;
  $('lbSheetSub').textContent = 'صناديقك تفتحها مجاناً';
  const r = el('div', 'lb-row' + (sh >= 10 ? ' ready' : ''));
  r.innerHTML = `<span class="ri">${svg('shard', '', '#7fd8ff')}</span><span class="rb"><b>قطع الصناديق: ${toAr(sh)} / ١٠</b><span class="pbar"><i style="transform:scaleX(${Math.min(1, sh / 10)})"></i></span><span>من المهام وصناديق النشاط والمكرّر · كل عشر قطع صندوق كلاسيكي</span></span>`;
  r.append(btn2('ادمج', () => { if (combineShards()) { lbToast('صار عندك صندوق كلاسيكي', 'افتحه من هنا'); renderSheet(); lobbyRefresh(true); } }, 'lbtn', sh < 10));
  body.append(r);
  let any = false;
  for (const [type, C] of Object.entries(CRATE_TYPES)) {
    const n = own[type] || 0; if (!n) continue; any = true;
    const row = el('div', 'lb-row'); row.innerHTML = `<span class="ri">${crateArt(type)}</span><span class="rb"><b></b><span>تملك ${toAr(n)}</span></span>`; row.querySelector('b').textContent = C.name;
    row.append(btn2('افتح', () => crateOpenUI(type, 1), 'lbtn'));
    if (n >= 10) row.append(btn2('افتح ١٠', () => crateOpenUI(type, 10), 'lbtn alt'));
    body.append(row);
  }
  if (!any) body.append(el('p', 'lb-note', 'لا صناديق عندك الآن. تكسبها من صناديق النشاط اليومي والمهام، أو تدمج عشر قطع صندوق.'));
}
/* the opening: the crate shakes, bursts in the colour of the best thing inside, and the cards turn over */
function crateOpenUI(type, n) {
  const res = openCrates(type, n);
  if (res === 'gold') { lbToast('لا يكفي ذهبك', 'العب وأنجز المهام لتكسب أكثر'); AUDIO.dry(); return; }
  if (res === 'gems') { lbToast('لا تكفي جواهرك', 'الجواهر من المهام الأسبوعية والإنجازات وكل خمسة مستويات'); AUDIO.dry(); return; }
  if (!res) return;
  const best = res.reduce((b, r) => RAR_ORDER.indexOf(r.rarity) > RAR_ORDER.indexOf(b) ? r.rarity : b, 'common');
  let ov = $('crateOpen'); if (!ov) { ov = el('div'); ov.id = 'crateOpen'; $('lobby').append(ov); }
  ov.className = 'co-' + best; ov.hidden = false; ov.style.setProperty('--bc', RARITY[best].col);
  ov.innerHTML = `<div class="co-stage">${crateArt(type, true)}<div class="co-rays"></div></div><div class="co-cards"></div><button class="lbtn co-done" type="button" hidden>تم</button>`;
  AUDIO.ui(2);
  const stage = ov.querySelector('.co-stage'), cards = ov.querySelector('.co-cards'), done = ov.querySelector('.co-done');
  setTimeout(() => { stage.classList.add('shake'); }, 60);
  setTimeout(() => { stage.classList.add('burst'); AUDIO.treasure(); }, 1200);
  setTimeout(() => {
    stage.classList.add('gone');
    res.forEach((r, i) => {
      const c = el('div', 'co-card r-' + r.rarity); c.style.setProperty('--rc', RARITY[r.rarity].col); c.style.setProperty('--rbg', RARITY[r.rarity].bg); c.style.animationDelay = (i * 0.12) + 's';
      const it = r.id && ITEMS[r.id];
      c.innerHTML = `<span class="rr">${RARITY[r.rarity].ar}</span><span class="sw">${it ? itemIcon(it) : r.kind === 'wskin' ? svg('upgun', '', '#fff') : r.kind === 'mat' ? svg('upgun', '', '#ffd27a') : svg('shard', '', '#7fd8ff')}</span><b></b>${r.dupe ? '<small>مكرّر</small>' : ''}`;
      c.querySelector('b').textContent = r.name; cards.append(c);
      if (r.rarity === 'legendary' || r.rarity === 'mythic') setTimeout(() => AUDIO.treasure(), i * 120 + 80);
    });
    done.hidden = false;
  }, 1750);
  const close = () => { ov.hidden = true; ov.innerHTML = ''; renderSheet(); lobbyRefresh(true); lobbyDress(); };
  done.addEventListener('click', close);
  ov.addEventListener('click', (e) => { if (e.target === ov && !done.hidden) close(); });
}

/* ── weapon skins: the upgrade bench ── */
function skinCard(sid, opts = {}) {
  const S = WSKINS[sid], lv = skinLevel(sid), R0 = RARITY[S.rarity], c = el('div', 'lb-rcard skin' + (opts.on ? ' on' : ''));
  c.style.setProperty('--rbg', `linear-gradient(135deg,${hexCss(S.c1)},${hexCss(S.c2)})`); c.style.setProperty('--rc', R0.col);
  c.innerHTML = `<span class="rr">${R0.ar}</span><span class="sw">${svg('upgun', '', '#fff')}</span><b></b><small>${lv ? 'المستوى ' + toAr(lv) : 'مقفل'}</small>`;
  c.querySelector('b').textContent = WEAPONS[S.gun].name + ' · ' + S.name;
  return c;
}
const _gunShot = new Map();
/* a picture of the gun in its colours, drawn once with the game's own renderer */
function gunPicture(sid) {
  const key = sid + ':' + skinLevel(sid); if (_gunShot.has(key)) return _gunShot.get(key);
  let url = '';
  try {
    const S = WSKINS[sid], g = buildWeaponModel(S.gun, {}), scn = new THREE.Scene();
    const was = ACCOUNT.wskinOn[S.gun], wl = ACCOUNT.wskins[sid]; ACCOUNT.wskinOn[S.gun] = sid; ACCOUNT.wskins[sid] = wl || 1;
    skinPaint(g, 'gun_' + S.gun); ACCOUNT.wskinOn[S.gun] = was; if (wl) ACCOUNT.wskins[sid] = wl; else delete ACCOUNT.wskins[sid];
    scn.add(g); scn.add(new THREE.HemisphereLight(0xdfe8ff, 0x3a3428, 1.3)); const dl = new THREE.DirectionalLight(0xffffff, 2.2); dl.position.set(1, 2, 1.5); scn.add(dl);
    g.rotation.set(0, -Math.PI / 2, 0.05); g.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(g), cen = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
    const cam = new THREE.PerspectiveCamera(24, 2, 0.05, 20); cam.position.set(cen.x, cen.y + sz.y * 0.4, cen.z + Math.max(sz.x, sz.z) * 2.3); cam.lookAt(cen);
    const W = 512, H = 256, rt = new THREE.WebGLRenderTarget(W, H, { depthBuffer: true }); rt.texture.encoding = THREE.sRGBEncoding;
    const prev = renderer.getRenderTarget(), cc = new THREE.Color(), ca = renderer.getClearAlpha(); renderer.getClearColor(cc);
    renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scn, cam); renderer.setRenderTarget(prev); renderer.setClearColor(cc, ca);
    const px = new Uint8Array(W * H * 4); renderer.readRenderTargetPixels(rt, 0, 0, W, H, px); rt.dispose();
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const cx = cv.getContext('2d'), im = cx.createImageData(W, H);
    for (let y = 0; y < H; y++) im.data.set(px.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
    cx.putImageData(im, 0, 0); url = cv.toDataURL('image/png');
  } catch (e) { console.warn('gun picture', e); }
  _gunShot.set(key, url); return url;
}
function renderUpgrade(body) {
  chipRow(SHEETS.upgrade.chips, LOBBY.sub, (k) => { LOBBY.sub = k; renderSheet(); });
  const sid = LOBBY.sub, S = WSKINS[sid]; if (!S) return;
  const lv = skinLevel(sid), R0 = RARITY[S.rarity], on = skinFor(S.gun) === sid;
  $('lbSheetSub').textContent = toAr(ACCOUNT.mat || 0) + ' مادة تطوير';
  const hero = el('div', 'up-hero'); hero.style.setProperty('--c1', hexCss(S.c1)); hero.style.setProperty('--c2', hexCss(S.c2)); hero.style.setProperty('--rc', R0.col);
  hero.innerHTML = `<div class="up-pic"><img alt=""></div><div class="up-info"><span class="rr">${R0.ar}</span><b></b><span>${lv ? 'المستوى ' + toAr(lv) + ' من ٧' : 'مقفل: تجده في صندوق الأسلحة'}</span></div>`;
  hero.querySelector('b').textContent = WEAPONS[S.gun].name + ' · ' + S.name;
  const img = hero.querySelector('img'); const pic = gunPicture(sid); if (pic) img.src = pic; else img.remove();
  body.append(hero);
  // the seven steps
  const path = el('div', 'up-path');
  WSKIN_LV.forEach(([t, d], i) => {
    const st = el('div', 'up-step' + (i < lv ? ' got' : i === lv ? ' next' : ''));
    st.innerHTML = `<i>${toAr(i + 1)}</i><b></b><span></span>${i > 0 ? `<em>${svg('upgun')}${toAr(WSKIN_COST[i])}</em>` : ''}`;
    st.querySelector('b').textContent = t; st.querySelector('span').textContent = d; path.append(st);
  });
  body.append(path);
  const row = el('div', 'up-btns');
  if (lv) {
    row.append(btn2(lv >= 7 ? 'اكتمل' : 'طوّر إلى ' + toAr(lv + 1) + ' · ' + toAr(WSKIN_COST[lv]) + ' مادة', () => {
      const r = upgradeSkin(sid);
      if (r === 'ok') { lbToast('طوّرت ' + S.name, 'المستوى ' + toAr(skinLevel(sid)) + ' · ' + WSKIN_LV[skinLevel(sid) - 1][0]); AUDIO.treasure(); }
      else if (r === 'mat') { lbToast('لا تكفي موادك', 'من صندوق الأسلحة والمهام وصناديق النشاط، أو اشترِها من المتجر'); AUDIO.dry(); }
      renderSheet(); lobbyRefresh(true);
    }, 'lbtn', lv >= 7 || (ACCOUNT.mat || 0) < WSKIN_COST[lv]));
    row.append(btn2(on ? 'مستعمل في اللعب' : 'استعمله', () => { ACCOUNT.wskinOn[S.gun] = on ? '' : sid; accSoon(true); renderSheet(); }, 'lbtn alt'));
  } else row.append(btn2('صندوق الأسلحة', () => openSheet('crates', 'arms'), 'lbtn'));
  body.append(row);
  body.append(el('p', 'lb-note', 'الأشكال للمظهر فقط: السلاح يقاتل كما هو. يظهر الشكل على كل ' + WEAPONS[S.gun].name + ' تمسكه في الجزيرة.'));
}

/* ── titles ── */
function renderTitles(body) {
  chipRow(SHEETS.titles.chips, LOBBY.sub, (k) => { LOBBY.sub = k; renderSheet(); });
  checkTitles(true);
  const mine = ACCOUNT.titles || [], tier = LOBBY.sub;
  const cur = el('div', 'lb-row slim'); cur.innerHTML = `<span class="rb"><b>لقبك الآن: ${ACCOUNT.title ? '«' + titleName(ACCOUNT.title) + '»' : 'بلا لقب'}</b><span>يظهر تحت اسمك في اللوبي وفوق رأسك للأصدقاء</span></span>`;
  if (ACCOUNT.title) cur.append(btn2('أزل', () => { ACCOUNT.title = ''; accSoon(true); renderSheet(); lobbyRefresh(true); }, 'lbtn alt'));
  body.append(cur);
  const list = TITLES.filter((t) => tier === 'all' || t[2] === tier).sort((a, b) => (mine.includes(b[0]) - mine.includes(a[0])) || (Object.keys(TITLE_TIERS).indexOf(a[2]) - Object.keys(TITLE_TIERS).indexOf(b[2])));
  for (const [id, name, tr, stat, n, how] of list) {
    const have = mine.includes(id), v = Math.min(n, titleStat(stat)), [tn, tc] = TITLE_TIERS[tr];
    const r = el('div', 'lb-row title-row' + (have ? ' ready' : '')); r.style.setProperty('--tc', tc);
    r.innerHTML = `<span class="ri">${svg('medal', '', tc)}</span><span class="rb"><b></b><span class="pbar"><i style="transform:scaleX(${v / n})"></i></span><span></span></span><em class="tier">${tn}</em>`;
    r.querySelector('b').textContent = '«' + name + '»'; r.querySelectorAll('.rb > span')[1].textContent = how + ' · ' + fmtStat(stat, v) + ' / ' + fmtStat(stat, n);
    if (have) r.append(btn2(ACCOUNT.title === id ? 'لقبك' : 'اختر', () => { ACCOUNT.title = id; accSoon(true); lbToast('لقبك الآن «' + name + '»', ''); renderSheet(); lobbyRefresh(true); }, 'lbtn', ACCOUNT.title === id));
    body.append(r);
  }
}

/* ── the store: deals that change every day, and materials ── */
function renderDeals(body) {
  const dk = dayKey(); let h = 7; for (const ch of dk + ACCOUNT.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const r = RNG(h), pool = ITEM_LIST.filter((it) => it.crate && it.wear.slot !== 'chute' && rarOf(it) !== 'mythic'), picks = [];
  while (picks.length < 6 && pool.length) picks.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  $('lbSheetSub').textContent = 'تتغير بعد ' + untilText(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 1) - new Date());
  const grid = el('div', 'lb-rgrid');
  for (const it of picks) {
    const base = { common: 300, rare: 700, epic: 1600, legendary: 3800 }[rarOf(it)] || 500, price = Math.round(base * 0.7 / 10) * 10, own = ACCOUNT.wardrobe.includes(it.id);
    const c = rarCard(it, { own, onTap: () => { LOBBY.preview = it.id; lobbyDress(); } });
    const b = btn2(own ? 'لديك' : svg('coin') + ' ' + fmtN(price) + ' <s>' + fmtN(base) + '</s>', () => { if (own) return; if (!spendGold(price)) { lbToast('لا يكفي ذهبك', ''); AUDIO.dry(); return; } wardrobeAdd(it.id, true); track('bought'); AUDIO.coins(); lbToast('اشتريت ' + it.name, 'في مخزنك'); renderSheet(); lobbyRefresh(true); }, 'lbtn deal', own);
    c.append(b); grid.append(c);
  }
  body.append(grid);
}
function renderMatShop(body) {
  $('lbSheetSub').textContent = toAr(ACCOUNT.mat || 0) + ' مادة · ' + toAr(ACCOUNT.shards || 0) + ' قطعة صندوق';
  const offers = [[10, 'gold', 450], [30, 'gold', 1250], [60, 'gems', 30], [150, 'gems', 70]];
  for (const [n, cur, price] of offers) {
    const r = el('div', 'lb-row'); r.innerHTML = `<span class="ri">${svg('upgun', '', '#ffd27a')}</span><span class="rb"><b>${toAr(n)} مادة تطوير</b><span>لتطوير أشكال الأسلحة</span></span>`;
    r.append(btn2((cur === 'gold' ? svg('coin') + fmtN(price) : svg('gem') + toAr(price)), () => {
      const ok = cur === 'gold' ? spendGold(price) : spendGems(price);
      if (!ok) { lbToast(cur === 'gold' ? 'لا يكفي ذهبك' : 'لا تكفي جواهرك', ''); AUDIO.dry(); return; }
      ACCOUNT.mat = (ACCOUNT.mat || 0) + n; accSoon(true); AUDIO.coins(); renderSheet(); lobbyRefresh(true);
    }, cur === 'gems' ? 'lbtn gem' : 'lbtn'));
    body.append(r);
  }
  const r2 = el('div', 'lb-row'); r2.innerHTML = `<span class="ri">${svg('shard', '', '#7fd8ff')}</span><span class="rb"><b>قطعة صندوق</b><span>عشر قطع تصير صندوقاً كلاسيكياً</span></span>`;
  r2.append(btn2(svg('coin') + fmtN(120), () => { if (!spendGold(120)) { lbToast('لا يكفي ذهبك', ''); AUDIO.dry(); return; } ACCOUNT.shards = (ACCOUNT.shards || 0) + 1; accSoon(true); AUDIO.coins(); renderSheet(); lobbyRefresh(true); }, 'lbtn'));
  body.append(r2);
}

/* ── the first visit: a name and who you are ── */
const FIRST_CHARS = [['outfit_casual', 'ليلى', 'قميص وجينز · سريعة الحركة'], ['outfit_blonde', 'سارة', 'أنيقة وواثقة'], ['outfit_soldier', 'الجندي', 'الهيئة الكلاسيكية']];
function firstRun() {
  if (ACCOUNT.named || $('firstRun')) return false;
  const ov = el('div'); ov.id = 'firstRun'; ov.setAttribute('dir', 'rtl');
  ov.innerHTML = `<div class="fr-card lbg"><h3>أنشئ شخصيتك</h3><p>اختر اسماً يراه الجميع، ومن تكون في الجزيرة.</p>
    <label class="fr-name"><span>الاسم</span><input id="frName" maxlength="16" autocomplete="off" spellcheck="false"></label>
    <div class="fr-chars" id="frChars"></div><p class="fr-err" id="frErr"></p><button id="frGo" class="lb-play" type="button">إنشاء</button></div>`;
  $('lobby').append(ov);
  const inp = $('frName'); inp.value = ACCOUNT.name; inp.addEventListener('keydown', (e) => e.stopPropagation());
  let pickId = CHARS.casual ? 'outfit_casual' : 'outfit_soldier';
  const draw = () => {
    const box = $('frChars'); box.innerHTML = '';
    for (const [id, name, sub] of FIRST_CHARS) {
      const it = ITEMS[id], ok = it && CHARS[it.wear.body];
      const b = el('button', 'fr-char' + (pickId === id ? ' on' : '')); b.type = 'button'; b.disabled = !ok;
      b.innerHTML = `<span class="sw">${svg('person', '', pickId === id ? '#ffb53d' : '#cfd8dc')}</span><b></b><small></small>`; b.querySelector('b').textContent = name; b.querySelector('small').textContent = ok ? sub : 'لم تُحمَّل · أعد فتح الصفحة';
      b.addEventListener('click', () => { pickId = id; ACCOUNT.look.body = id; if (!ACCOUNT.wardrobe.includes(id)) ACCOUNT.wardrobe.push(id); syncLookToRun(); applyOutfit(); lobbyDress(); AUDIO.ui(); draw(); });
      box.append(b);
    }
  };
  draw();
  if (pickId !== 'outfit_soldier') { ACCOUNT.look.body = pickId; if (!ACCOUNT.wardrobe.includes(pickId)) ACCOUNT.wardrobe.push(pickId); syncLookToRun(); applyOutfit(); lobbyDress(); }
  $('frGo').addEventListener('click', () => {
    const nm = cleanName(inp.value);
    if (nm.length < 2) { $('frErr').textContent = 'الاسم حرفان على الأقل'; AUDIO.dry(); return; }
    ACCOUNT.name = nm; ACCOUNT.named = true; ACCOUNT.char = ITEMS[pickId].wear.body; ACCOUNT.look.body = pickId;
    if (!ACCOUNT.wardrobe.includes(pickId)) ACCOUNT.wardrobe.push(pickId);
    syncLookToRun(); applyOutfit(); accSoon(true); accFlush(); AUDIO.treasure();
    ov.remove(); lobbyRefresh(true); lbToast('أهلاً ' + nm + '!', 'ابدأ رحلتك من الطائرة · مهامك وصناديقك في الأسفل');
  });
  return true;
}
