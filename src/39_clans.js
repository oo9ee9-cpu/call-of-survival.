/* ═════════ clans: with a clan card you found one (a name, a short tag, a motto, a colour and an emblem); everyone sees the list
   of clans and who is in each, and joins with one tap. Your clan shows on your profile. Shared in the game's db: each clan is the
   founder's own document, each membership the member's own; the three first clans (القوية، الاشتباك، المحاربون) come with the game. ═════════ */
const CLAN_SEED = [
  { id: 'seed_strong', name: 'القوية', tag: 'قوة', motto: 'نصمد معاً ونقاتل معاً', col: '#c8302a', em: 0 },
  { id: 'seed_clash', name: 'الاشتباك', tag: 'اشتباك', motto: 'أول من يدخل وآخر من يخرج', col: '#f0a020', em: 1 },
  { id: 'seed_warriors', name: 'المحاربون', tag: 'محارب', motto: 'شرف · ولاء · نصر', col: '#3d8ee8', em: 2 },
];
const CLAN_EMBLEMS = ['M12 2 3 7v6c0 5 4 8.6 9 10 5-1.4 9-5 9-10V7z', 'M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.2l7.1-.6z', 'M4 20 20 4M4 4l16 16M12 2v4M12 18v4', 'M12 3c4 3 6 6 6 9a6 6 0 0 1-12 0c0-3 2-6 6-9z', 'M3 12h18M12 3l3 9-3 9-3-9z'];
const CLAN_MAX = 60;
const CLANS = { list: new Map(), members: new Map(), sub: null, mineSub: null, loaded: false, mine: null };
item('clan_card', 'بطاقة العشيرة', 'treasure', { color: 0xd8b04a, w: 0, price: 0, icon: 'flag', rare: true, shopOnly: true });
const clanTag = () => { const c = ACCOUNT.clan && (CLANS.list.get(ACCOUNT.clan) || CLAN_SEED.find((q) => q.id === ACCOUNT.clan)); return c ? '⟨' + c.name + '⟩' : ''; };
const emblemSvg = (c, size = 24) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path d="${CLAN_EMBLEMS[(c.em | 0) % CLAN_EMBLEMS.length]}" fill="${/^#[0-9a-f]{6}$/i.test(c.col || '') ? c.col : '#c8a040'}" stroke="rgba(0,0,0,.4)" stroke-width="1"/></svg>`;
/* the db: live lists while the clan page is open */
function clansWatch() {
  if (!NET.ok || !NET.db || CLANS.sub) return;
  for (const c of CLAN_SEED) if (!CLANS.list.has(c.id)) CLANS.list.set(c.id, Object.assign({ seed: true }, c));
  try {
    CLANS.sub = NET.db.collection('clans').limit(200).onSnapshot((s) => {
      for (const d of s.docs) { const v = d.data(); if (v && typeof v.name === 'string') CLANS.list.set(d.id, Object.assign({ id: d.id }, clanClean(v))); }
      for (const ch of s.docChanges()) if (ch.type === 'removed' && !CLAN_SEED.some((q) => q.id === ch.doc.id)) CLANS.list.delete(ch.doc.id);
      CLANS.loaded = true; if (LOBBY.sheet === 'clan') renderSheet();
    }, () => {});
    CLANS.msub = NET.db.collection('clanmembers').limit(1000).onSnapshot((s) => {
      CLANS.members.clear();
      for (const d of s.docs) { const v = d.data(); if (v && typeof v.clan === 'string') CLANS.members.set(d.id, { clan: v.clan.slice(0, 40), name: cleanName(v.name) || 'لاعب', lv: v.lv | 0, t: v.t || 0 }); }
      const me = NET.uid && CLANS.members.get(NET.uid); if (me && me.clan !== ACCOUNT.clan) { ACCOUNT.clan = me.clan; accSoon(true); lobbyRefresh(true); }
      if (LOBBY.sheet === 'clan') renderSheet();
    }, () => {});
  } catch (e) { console.warn('clans', e); }
}
const clanClean = (v) => ({ name: cleanName(v.name).slice(0, 18) || 'عشيرة', tag: cleanName(v.tag).slice(0, 8), motto: cleanName(v.motto).slice(0, 60), col: /^#[0-9a-f]{6}$/i.test(v.col || '') ? v.col : '#c8a040', em: (v.em | 0) % CLAN_EMBLEMS.length, owner: typeof v.owner === 'string' ? v.owner : '', ownerName: cleanName(v.ownerName), t: v.t || 0 });
const membersOf = (id) => [...CLANS.members.entries()].filter(([, m]) => m.clan === id);
async function joinClan(id) {
  const c = CLANS.list.get(id) || CLAN_SEED.find((q) => q.id === id); if (!c) return;
  if (NET.ok && membersOf(id).length >= CLAN_MAX) { lbToast('العشيرة ممتلئة', 'جرّب عشيرة أخرى'); return; }
  ACCOUNT.clan = id; accSoon(true); AUDIO.treasure();
  if (NET.ok) { try { await NET.db.doc('clanmembers/' + NET.uid).set({ clan: id, name: ACCOUNT.name, lv: ACCOUNT.level, t: Date.now() }); } catch (e) { lbToast('تعذّر الحفظ', 'تحتاج صلاحية «مساهم» في هذه اللعبة'); } }
  lbToast('انضممت إلى ' + c.name, 'تظهر عشيرتك في ملفك'); renderSheet(); lobbyRefresh(true);
}
async function leaveClan() {
  const was = ACCOUNT.clan; ACCOUNT.clan = ''; accSoon(true);
  if (NET.ok) { try { await NET.db.doc('clanmembers/' + NET.uid).delete(); } catch (_) {} }
  lbToast('غادرت العشيرة', ''); renderSheet(); lobbyRefresh(true);
  return was;
}
async function foundClan(name, tag, motto, col, em) {
  if ((ACCOUNT.clanCards || 0) < 1) { lbToast('تحتاج بطاقة عشيرة', 'من المتجر أو عند المستوى ١٠'); return false; }
  name = cleanName(name).slice(0, 18); tag = cleanName(tag).slice(0, 8);
  if (name.length < 2) { lbToast('اسم العشيرة حرفان على الأقل', ''); return false; }
  if ([...CLANS.list.values()].some((c) => c.name === name)) { lbToast('الاسم مأخوذ', 'اختر اسماً آخر'); return false; }
  const id = NET.ok ? NET.uid : 'local_' + ACCOUNT.id;
  const doc = { name, tag: tag || name.slice(0, 6), motto: cleanName(motto).slice(0, 60), col, em, owner: NET.uid || ACCOUNT.id, ownerName: ACCOUNT.name, t: Date.now() };
  if (NET.ok) { try { await NET.db.doc('clans/' + id).set(doc); } catch (e) { lbToast('تعذّر إنشاء العشيرة', 'تحتاج صلاحية «مساهم» في هذه اللعبة'); return false; } }
  CLANS.list.set(id, Object.assign({ id }, clanClean(doc)));
  ACCOUNT.clanCards = (ACCOUNT.clanCards || 0) - 1; ACCOUNT.clanOwn = id; await joinClan(id); return true;
}
/* the page */
function renderClan(body) {
  clansWatch();
  for (const c of CLAN_SEED) if (!CLANS.list.has(c.id)) CLANS.list.set(c.id, Object.assign({ seed: true }, c));
  const mine = ACCOUNT.clan && CLANS.list.get(ACCOUNT.clan);
  $('lbSheetSub').textContent = NET.ok ? toAr(CLANS.list.size) + ' عشيرة' : 'بلا اتصال: تظهر العشائر الأولى فقط';
  if (mine) {
    const card = el('div', 'clan-card'); card.style.setProperty('--cc', mine.col);
    card.innerHTML = `<span class="em">${emblemSvg(mine, 54)}</span><div><b></b><span class="tag"></span><p></p></div>`;
    card.querySelector('b').textContent = mine.name; card.querySelector('.tag').textContent = '⟨' + (mine.tag || mine.name) + '⟩'; card.querySelector('p').textContent = mine.motto || '';
    body.append(card);
    const mem = membersOf(mine.id);
    body.append(el('div', 'shead', 'الأعضاء · ' + toAr(Math.max(mem.length, 1)) + ' / ' + toAr(CLAN_MAX)));
    const list = mem.length ? mem : [[NET.uid || 'me', { name: ACCOUNT.name, lv: ACCOUNT.level }]];
    for (const [uid, m] of list.sort((a, b) => b[1].lv - a[1].lv)) {
      const r = el('div', 'lb-row slim'); const lead = mine.owner && uid === mine.owner;
      r.innerHTML = `<span class="ri">${svg(lead ? 'medal' : 'person', '', lead ? '#ffcf6a' : '#cfd8dc')}</span><span class="rb"><b></b><span>المستوى ${toAr(m.lv || 1)}${lead ? ' · المؤسس' : ''}${uid === NET.uid ? ' · أنت' : ''}</span></span>`;
      r.querySelector('b').textContent = m.name; body.append(r);
    }
    body.append(btn2('غادر العشيرة', () => leaveClan(), 'lbtn alt'));
    return;
  }
  // not in a clan: found one, or join from the list
  const head = el('div', 'lb-row ready');
  head.innerHTML = `<span class="ri">${svg('clan', '', '#ffcf6a')}</span><span class="rb"><b>أسّس عشيرتك</b><span>تحتاج بطاقة عشيرة · معك ${toAr(ACCOUNT.clanCards || 0)} · تحصل على واحدة عند المستوى ١٠ أو من المتجر</span></span>`;
  head.append(btn2('أسّس', () => clanFoundModal(), 'lbtn', (ACCOUNT.clanCards || 0) < 1));
  if ((ACCOUNT.clanCards || 0) < 1) head.append(btn2(svg('gem') + ' ٤٠', () => { if (!spendGems(40)) { lbToast('لا تكفي جواهرك', ''); AUDIO.dry(); return; } ACCOUNT.clanCards = (ACCOUNT.clanCards || 0) + 1; accSoon(true); AUDIO.coins(); renderSheet(); lobbyRefresh(true); }, 'lbtn gem'));
  body.append(head);
  body.append(el('div', 'shead', 'العشائر'));
  const all = [...CLANS.list.values()].map((c) => [c, membersOf(c.id).length]).sort((a, b) => (b[0].seed - a[0].seed) || b[1] - a[1]);
  for (const [c, n] of all) {
    const r = el('div', 'lb-row clan-row'); r.style.setProperty('--cc', c.col);
    r.innerHTML = `<span class="ri">${emblemSvg(c, 30)}</span><span class="rb"><b></b><span></span></span>`;
    r.querySelector('b').textContent = c.name + (c.tag ? ' ⟨' + c.tag + '⟩' : ''); r.querySelector('.rb span').textContent = (c.motto ? c.motto + ' · ' : '') + toAr(n) + ' عضو' + (c.ownerName ? ' · المؤسس ' + c.ownerName : '');
    r.append(btn2('انضم', () => joinClan(c.id), 'lbtn', NET.ok && n >= CLAN_MAX));
    body.append(r);
  }
}
function clanFoundModal() {
  const card = $('lbMCard'); card.innerHTML = ''; $('lbModal').hidden = false;
  modalHead(card, 'عشيرة جديدة');
  let col = '#c8a040', em = 0;
  const f = el('div', 'clan-form');
  f.innerHTML = `<label><span>الاسم</span><input id="cfName" maxlength="18"></label><label><span>الشعار القصير</span><input id="cfTag" maxlength="8"></label><label><span>العبارة</span><input id="cfMotto" maxlength="60"></label><div class="cf-cols" id="cfCols"></div><div class="cf-ems" id="cfEms"></div>`;
  card.append(f);
  for (const inp of f.querySelectorAll('input')) inp.addEventListener('keydown', (e) => e.stopPropagation());
  const draw = () => {
    const cs = $('cfCols'), es = $('cfEms'); cs.innerHTML = ''; es.innerHTML = '';
    for (const c of ['#c8302a', '#f0a020', '#3d8ee8', '#3a9a5a', '#9b5ae8', '#c8a040', '#1e1e20', '#e8e6e0']) { const b = el('button', 'cf-col' + (c === col ? ' on' : '')); b.type = 'button'; b.style.background = c; b.addEventListener('click', () => { col = c; draw(); }); cs.append(b); }
    CLAN_EMBLEMS.forEach((_, i) => { const b = el('button', 'cf-em' + (i === em ? ' on' : '')); b.type = 'button'; b.innerHTML = emblemSvg({ col, em: i }, 30); b.addEventListener('click', () => { em = i; draw(); }); es.append(b); });
  };
  draw();
  card.append(btn2('أسّس العشيرة (بطاقة واحدة)', async () => { if (await foundClan($('cfName').value, $('cfTag').value, $('cfMotto').value, col, em)) closeModal(); }, 'lbtn'));
}
/* the card comes at level ten */
ACC.listeners.push(() => { if (ACC.loaded && ACCOUNT.level >= 10 && !ACCOUNT.seen.clanCard) { ACCOUNT.seen.clanCard = 1; ACCOUNT.clanCards = (ACCOUNT.clanCards || 0) + 1; accSoon(true); } });
