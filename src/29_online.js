/* ═════════ friends and playing together: every player has a public card (game name, 8-digit ID, level, look, picture),
   friend requests both ways make a friendship, the host (⭐) invites friends into a party, and when the host plays,
   the party enters the host's own world: everyone sees everyone, and what anyone builds, digs or fells is shared.
   Shared state lives in the artifact's db (each player writes only their own documents); live movement rides the room. ═════════ */
const NET = { ok: false, why: 'connecting', db: null, user: null, room: null, uid: null, profiles: new Map(), out: [], inSet: new Set(), lobbyPeers: [],
  invites: new Map(), inviteTo: new Set(), party: null, hosting: false, world: null, worldName: '', inHost: false, remotes: new Map(),
  sendT: 0, profSig: '', worldSig: '', worldT: 0, unsub: [], seenInvite: new Set(), busy: false };
const sanitizeGid = (s) => String(s || '').replace(/\D/g, '').slice(0, 8);
const netName = (p) => cleanName(p && p.name) || 'لاعب';
const isFriend = (uid) => NET.out.includes(uid) && NET.inSet.has(uid);
const friendUids = () => NET.out.filter((u) => NET.inSet.has(u));
const incomingUids = () => [...NET.inSet].filter((u) => !NET.out.includes(u) && !(ACCOUNT.seen.ign || []).includes(u));
const onlineIn = (uid) => NET.lobbyPeers.find((p) => p.by === uid && !p.isMe) || (NET.world ? NET.world.peers().find((p) => p.by === uid && !p.isMe) : null);

async function netInit() {
  try {
    if (!window.claude || typeof window.claude.use !== 'function') { NET.why = 'standalone'; return; }
    const [db, user, room] = await Promise.all(['db', 'user', 'room'].map((c) => window.claude.use(c).catch(() => null)));
    NET.db = db; NET.user = user; NET.room = room;
    NET.uid = user ? await user.id() : null;
    if (!db || !NET.uid) { NET.why = 'nodb'; return; }
    // the 8-digit ID must be unique among the players of this game
    try { const q = await db.collection('profiles').where('gid', '==', ACCOUNT.id).limit(5).get(); if (q.docs.some((d) => d.id !== NET.uid)) { ACCOUNT.id = rid8(); accSoon(true); } } catch (_) {}
    NET.ok = true; NET.why = '';
    NET.unsub.push(db.collection('profiles').limit(500).onSnapshot((s) => { for (const d of s.docs) NET.profiles.set(d.id, d.data()); for (const c of s.docChanges()) if (c.type === 'removed') NET.profiles.delete(c.doc.id); netUI(); }, () => {}));
    NET.unsub.push(db.doc('links/' + NET.uid).onSnapshot((s) => { const o = s.exists ? s.data() : null; NET.out = Array.isArray(o && o.out) ? o.out.filter((u) => typeof u === 'string').slice(0, 200) : []; netUI(); }, () => {}));
    NET.unsub.push(db.collection('links').where('out', 'array-contains', NET.uid).onSnapshot((s) => { NET.inSet = new Set(s.docs.map((d) => d.id)); netUI(); }, () => {}));
    NET.unsub.push(db.collection('invites').where('to', 'array-contains', NET.uid).onSnapshot((s) => {
      for (const d of s.docs) { const v = d.data(); if (!v || Date.now() - (v.t || 0) > 20 * 60000) continue; gotInvite(d.id, v); }
    }, () => {}));
    if (room) {
      NET.unsub.push(room.onPeers((ch) => { NET.lobbyPeers = ch.peers.slice(); netUI(); }, () => {}));
      NET.unsub.push(room.on('invite', (m) => { if (m.isMe || !m.by || !m.data || m.data.to !== NET.uid) return; gotInvite(m.by, m.data); }, () => {}));
      room.presence({ gid: ACCOUNT.id, where: 'lobby' }).catch(() => {});
    }
    publishProfile(true);
    ACC.listeners.push(() => publishProfile(false));
    try {
      const j = JSON.parse(sessionStorage.getItem('rock-island-join') || 'null'); sessionStorage.removeItem('rock-island-join');
      if (j && j.from && j.map === MAP_ID && Date.now() - (j.at || 0) < 120000) { NET.invites.set(j.from, j); setTimeout(() => acceptInvite(j.from), 800); }
    } catch (_) {}
    netUI();
  } catch (e) { console.warn('net', e); NET.why = 'error'; }
}

/* ── my public card: written only when it really changes ── */
let profT = 0;
function publishProfile(force) {
  if (!NET.ok) return;
  const look = {}; for (const [k, v] of Object.entries(ACCOUNT.look)) look[k] = v;
  const sig = [ACCOUNT.id, ACCOUNT.name, ACCOUNT.level, JSON.stringify(look), LOBBY.avaURL ? LOBBY.avaURL.length : 0].join('|');
  if (!force && sig === NET.profSig) return;
  clearTimeout(profT); profT = setTimeout(async () => {
    if (sig === NET.profSig) return; NET.profSig = sig;
    const body = { gid: ACCOUNT.id, name: ACCOUNT.name, lv: ACCOUNT.level, look, ava: smallAvatar(), t: Date.now() };
    try { await NET.db.doc('profiles/' + NET.uid).set(body); } catch (e) { NET.profSig = ''; if (e && e.code === 'invalid_argument') { NET.ok = false; NET.why = 'readonly'; netUI(); } }
  }, force ? 50 : 2500);
}
function smallAvatar() {
  try { const c = document.createElement('canvas'); c.width = c.height = 64; c.getContext('2d').drawImage($('lbAva'), 0, 0, 64, 64); return c.toDataURL('image/jpeg', 0.7); } catch (_) { return ''; }
}

/* ── friends ── */
async function setLinks(out) {
  NET.out = [...new Set(out)].slice(0, 200);
  try { await NET.db.doc('links/' + NET.uid).set({ out: NET.out, t: Date.now() }); } catch (e) { lbToast('تعذّر الحفظ', 'تحتاج صلاحية «مساهم» في هذه اللعبة'); }
  netUI();
}
function addFriend(uid) { if (!NET.ok || uid === NET.uid) return; const ign = ACCOUNT.seen.ign || []; if (ign.includes(uid)) { ACCOUNT.seen.ign = ign.filter((u) => u !== uid); accSoon(); } setLinks([...NET.out, uid]); AUDIO.ui(1); lbToast(NET.inSet.has(uid) ? 'أصبحتما صديقين!' : 'أُرسل طلب الصداقة', netName(NET.profiles.get(uid))); }
function removeFriend(uid) { setLinks(NET.out.filter((u) => u !== uid)); }
function ignoreRequest(uid) { ACCOUNT.seen.ign = [...new Set([...(ACCOUNT.seen.ign || []), uid])].slice(-200); accSoon(); netUI(); }
function searchPlayers(q) {
  q = String(q || '').trim(); if (!q) return [];
  const gid = sanitizeGid(q), out = [];
  for (const [uid, p] of NET.profiles) {
    if (uid === NET.uid || !p) continue;
    if ((gid.length >= 4 && String(p.gid || '').startsWith(gid)) || (!/^\d+$/.test(q) && netName(p).includes(q))) out.push(uid);
  }
  return out.slice(0, 20);
}

/* ── the party: the host invites, friends accept and wait in their lobby; when the host plays, they all go in ── */
async function joinWorldRoom(gid) {
  if (!NET.room) return null;
  const name = 'w-' + sanitizeGid(gid);
  if (NET.world && NET.worldName === name) return NET.world;
  if (NET.world) { try { await NET.world.leave(); } catch (_) {} clearRemotes(); }
  try { NET.world = await NET.room.join(name); } catch (e) { lbToast('تعذّر الاتصال بعالم الصديق', ''); NET.world = null; return null; }
  NET.worldName = name;
  NET.world.on('act', onAct, () => {});
  NET.world.onPeers((ch) => {
    netUI();
    if (NET.party && !NET.inHost && hostPeer() && hostPeer().presence.where === 'game') enterHostWorld();
    if (NET.party && ch.left.some((p) => p.by === NET.party.hostUid) && started) toast('غادر القائد ⭐ اللعبة', 'تبقى في عالمه وحدك · «غادر الفريق» من الأصدقاء يعيدك إلى جزيرتك');
    for (const p of ch.joined) if (!p.isMe && p.by && started && (NET.hosting || NET.inHost)) toast('انضم ' + netName(NET.profiles.get(p.by)) + ' إلى العالم', '');
  }, () => {});
  sendPresence(true);
  return NET.world;
}
const hostPeer = () => NET.world && NET.party ? NET.world.peers().find((p) => p.by === NET.party.hostUid && !p.isMe) : null;
async function inviteFriend(uid) {
  if (!NET.ok) return;
  if (NET.party) { lbToast('أنت في فريق صديقك الآن', 'غادر الفريق لتصبح قائداً'); return; }
  NET.hosting = true; await joinWorldRoom(ACCOUNT.id);
  NET.inviteTo.add(uid);
  const inv = { to: [...NET.inviteTo], room: NET.worldName, gid: ACCOUNT.id, name: ACCOUNT.name, map: MAP_ID, t: Date.now() };
  try { await NET.db.doc('invites/' + NET.uid).set(inv); } catch (_) {}
  if (NET.room) NET.room.emit('invite', { to: uid, room: NET.worldName, gid: ACCOUNT.id, name: ACCOUNT.name, map: MAP_ID, t: inv.t }).catch(() => {});
  if (started) shareWorld(true);
  AUDIO.ui(2); lbToast('أُرسلت الدعوة إلى ' + netName(NET.profiles.get(uid)), 'حين يقبل يدخل عالمك معك وأنت القائد ⭐');
  netUI();
}
function gotInvite(fromUid, v) {
  if (!v || typeof v.room !== 'string' || !/^w-\d{8}$/.test(v.room) || fromUid === NET.uid) return;
  if (NET.party && NET.party.hostUid === fromUid) return;
  const key = fromUid + ':' + (v.t || 0); if (NET.seenInvite.has(key)) return; NET.seenInvite.add(key);
  NET.invites.set(fromUid, { from: fromUid, room: v.room, gid: sanitizeGid(v.gid), name: cleanName(v.name) || netName(NET.profiles.get(fromUid)), map: MAPS_DEF[v.map] ? v.map : 'island', t: v.t || Date.now() });
  AUDIO.pickup(true);
  if (LOBBY.on) openModal('invite'); else if (started) toast('دعوة من ' + NET.invites.get(fromUid).name + ' ⭐', 'ارجع إلى اللوبي لتنضم إلى عالمه');
  netUI();
}
async function acceptInvite(fromUid) {
  const inv = NET.invites.get(fromUid); if (!inv) return;
  if (inv.map && inv.map !== MAP_ID) {
    if (!MAPS_READY.includes(inv.map)) { lbToast('خريطة القائد غير متاحة لك بعد', mapTitle(inv.map)); return; }
    try { sessionStorage.setItem('rock-island-join', JSON.stringify(Object.assign({}, inv, { at: Date.now() }))); localStorage.setItem(MAP_KEY, inv.map); } catch (_) {}
    accSoon(true); accFlush(); lbToast('تنتقل إلى ' + mapTitle(inv.map), 'خريطة القائد ⭐'); setTimeout(() => location.reload(), 600); return;
  }
  NET.invites.delete(fromUid); closeModal();
  if (NET.hosting) { NET.hosting = false; NET.inviteTo.clear(); }
  NET.party = { hostUid: fromUid, gid: inv.gid, name: inv.name, room: inv.room };
  await joinWorldRoom(inv.gid);
  lbToast('انضممت إلى فريق ' + inv.name + ' ⭐', 'تدخلون عالمه حين يبدأ اللعب');
  const hp = hostPeer(); if (hp && hp.presence && hp.presence.where === 'game') enterHostWorld();
  netUI();
}
async function leaveParty() {
  const wasIn = NET.inHost;
  NET.party = null; NET.hosting = false; NET.inviteTo.clear();
  if (NET.world) { try { await NET.world.leave(); } catch (_) {} NET.world = null; NET.worldName = ''; }
  clearRemotes();
  try { if (NET.db) await NET.db.doc('invites/' + NET.uid).delete(); } catch (_) {}
  if (wasIn) { // back to your own island: your own world is reloaded from its record
    SAVE.guest = false; accFlush(); if (started) { try { localStorage.setItem(SAVE.key, JSON.stringify(snapshotCore())); } catch (_) {} }
    location.reload(); return;
  }
  netUI();
}

/* ── the host's world, as the guests receive it ── */
let shareT = 0;
function shareWorld(now) {
  if (!NET.ok || !NET.hosting || NET.party) return;
  clearTimeout(shareT); shareT = setTimeout(async () => {
    let js; try { for (const r of BUILT) if (!r.nk) r.nk = ACCOUNT.id + '-' + r.uid; js = JSON.stringify(snapshotWorld(), stripRec); } catch (_) { return; }
    const p = player.pos, sig = js.length + ':' + js.slice(-64);
    if (sig === NET.worldSig && !now) return; NET.worldSig = sig;
    const body = await worldBody(js); if (!body) { console.warn('shared world too large', js.length); return; }
    Object.assign(body, { pos: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)], hour: +ENV.hour.toFixed(2), t: Date.now() });
    try { await NET.db.doc('worlds/' + NET.uid).set(body); } catch (e) { NET.worldSig = ''; console.warn('share world', e); }
  }, now ? 30 : 15000);
}
function clearWorldState() {
  for (const r of [...BUILT]) removeRec(r);
  if (DIG.list.length) { const old = DIG.list.slice(); DIG.list.length = 0; DIG.grid.clear(); DIG.version++; for (const c of old) { TERRAIN.dirtyArea(c.x, c.z, c.r + 2); grassDirtyArea(c.x, c.z, c.r + 2); } }
  FELLED.clear(); RBROKEN.clear(); CROPCUT.length = 0; vegDirty(); rocksDirty(); GBLOCK.clear(); GRASS.tiles.clear(); GRASS.dirty = true;
  for (const L of [...LOGS]) removeLog(L, false);
}
async function enterHostWorld() {
  if (NET.inHost || NET.busy || !NET.party || !NET.db) return;
  NET.busy = true;
  try {
    const s = await NET.db.doc('worlds/' + NET.party.hostUid).get();
    if (!s.exists) { lbToast('عالم القائد يُجهَّز…', 'حاول بعد لحظات'); return; }
    const d = s.data(); let W = null; try { W = JSON.parse(await worldFromBody(d)); } catch (_) {}
    if (!W) return;
    if (started) saveNow();
    SAVE.guest = true; NET.inHost = true;
    clearWorldState(); applySave(null, W); rebuildChunks();
    if (typeof d.hour === 'number') LOBBY.saved ? (LOBBY.saved.hour = d.hour) : (ENV.hour = d.hour);
    const hp = hostPeer(), pr = hp && hp.presence, at = pr && typeof pr.x === 'number' ? [pr.x, pr.z] : Array.isArray(d.pos) ? [d.pos[0], d.pos[2]] : null;
    if (at && player.alive) { const x = at[0] + 2.5, z = at[1] + 2.5; player.pos.set(x, groundAt(x, z, terrainAt(x, z) + 3), z); player.vel.set(0, 0, 0); }
    if (player.vehicle) exitVehicle(true);
    toast('دخلت عالم ' + NET.party.name + ' ⭐', 'ما تبنيه هنا يبقى في عالمه');
    if (LOBBY.on) { NET.busy = false; await playFromLobby(true); }
    else { prepareAround(player.pos.x, player.pos.y, player.pos.z); cam.focus.set(player.pos.x, player.pos.y + 1.6, player.pos.z); updateCamera(0.016, true); }
    sendPresence(true);
  } catch (e) { console.warn('enter host world', e); } finally { NET.busy = false; }
}

/* ── live: presence carries where everyone is; 'act' carries what changes the world ── */
const lookIds = () => { const o = {}; for (const s of COS_SLOTS) if (INV.wearing[s] && ITEMS[INV.wearing[s]]) o[s] = INV.wearing[s]; return o; };
function sendPresence(force) {
  if (!NET.world) { if (NET.room && force) NET.room.presence({ gid: ACCOUNT.id, where: started ? 'game' : 'lobby' }).catch(() => {}); return; }
  const p = player.pos, v = player.vehicle;
  const pr = { gid: ACCOUNT.id, name: ACCOUNT.name, lv: ACCOUNT.level, look: lookIds(), where: started ? 'game' : 'lobby', host: NET.hosting,
    x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), yaw: +(v ? v.yaw : player.yaw).toFixed(3), spd: +(v ? Math.abs(v.speed) : player.speed).toFixed(2), veh: v ? v.kind : null, alive: player.alive, tool: player.tool };
  NET.world.presence(pr).catch(() => {});
  if (NET.room && force) NET.room.presence({ gid: ACCOUNT.id, where: pr.where }).catch(() => {});
}
function netAct(data) { if (NET.world && (NET.inHost || NET.hosting)) NET.world.emit('act', data).catch(() => {}); }
const finite = (...a) => a.every((v) => typeof v === 'number' && isFinite(v) && Math.abs(v) < 5000);
function cleanRec(r) {
  if (!r || typeof r !== 'object' || typeof r.nk !== 'string' || r.nk.length > 40) return null;
  const k = r.kind;
  if (k === 'piece' && ITEMS[r.id] && ITEMS[r.id].build && Number.isInteger(r.i) && Number.isInteger(r.j) && finite(r.y)) return { kind: k, id: r.id, i: r.i, j: r.j, L: r.L | 0, e: typeof r.e === 'string' ? r.e.slice(0, 2) : undefined, y: r.y, bot: finite(r.bot) ? r.bot : undefined, ry: finite(r.ry) ? r.ry : 0, px: finite(r.px) ? r.px : undefined, pz: finite(r.pz) ? r.pz : undefined, nk: r.nk };
  if (k === 'place' && ITEMS[r.id] && finite(r.x, r.y, r.z)) return { kind: k, id: r.id, x: r.x, y: r.y, z: r.z, ry: finite(r.ry) ? r.ry : 0, nk: r.nk };
  if (k === 'plot' && finite(r.x, r.z, r.y)) return { kind: k, x: r.x, z: r.z, y: r.y, crop: typeof r.crop === 'string' && ITEMS[r.crop] ? r.crop : 'wheat', grow: 0, water: 0, nk: r.nk };
  if (k === 'tree' && typeof r.sp === 'string' && VEG.species[r.sp] && finite(r.x, r.z, r.y)) return { kind: k, sp: r.sp, x: r.x, z: r.z, y: r.y, t0: T_GAME, nk: r.nk };
  return null;
}
function onAct(m) {
  if (m.isMe || !m.data || typeof m.data !== 'object') return;
  const a = m.data;
  if (a.k === 'go') { if (NET.party && m.by === NET.party.hostUid) enterHostWorld(); return; }
  if (!started || !(NET.inHost || NET.hosting)) return;
  if (a.k === 'b+') { const r = cleanRec(a.rec); if (r && !BUILT.some((q) => q.nk === r.nk)) { addRec(r); if (NET.hosting) { saveSoon(); shareWorld(false); } } }
  else if (a.k === 'b-' && typeof a.nk === 'string') { const r = BUILT.find((q) => q.nk === a.nk); if (r) { removeRec(r); if (NET.hosting) { saveSoon(); shareWorld(false); } } }
  else if (a.k === 'dig' && finite(a.x, a.z, a.r, a.d) && a.r < 4 && a.d < 4) { addCrater(a.x, a.z, a.r, a.d); TERRAIN.dirtyArea(a.x, a.z, a.r + 2); grassDirtyArea(a.x, a.z, a.r + 2); if (NET.hosting) { saveSoon(); shareWorld(false); } }
  else if (a.k === 'fell' && typeof a.key === 'string' && a.key.length < 40 && finite(a.dur)) { FELLED.set(a.key, T_GAME + Math.min(3600, a.dur)); vegDirty(); }
  else if (a.k === 'rock' && typeof a.key === 'string' && a.key.length < 40 && finite(a.dur)) { RBROKEN.set(a.key, T_GAME + Math.min(3600, a.dur)); rocksDirty(); }
  else if (a.k === 'shot' && finite(a.x, a.y, a.z, a.tx, a.ty, a.tz)) { tracer(_nv1.set(a.x, a.y, a.z), _nv2.set(a.tx, a.ty, a.tz)); AUDIO.shot(typeof a.g === 'string' ? a.g : 'rifle', Math.hypot(a.x - player.pos.x, a.z - player.pos.z)); }
}
const _nv1 = new THREE.Vector3(), _nv2 = new THREE.Vector3();
/* the hooks the game calls when you change the shared world */
function netBuilt(r) { if (!NET.world || !(NET.inHost || NET.hosting)) return; r.nk = r.nk || ACCOUNT.id + '-' + r.uid + '-' + Math.floor(Math.random() * 1e6); netAct({ k: 'b+', rec: JSON.parse(JSON.stringify(r, stripRec)) }); if (NET.hosting) shareWorld(false); }
function netUnbuilt(r) { if (r && r.nk) netAct({ k: 'b-', nk: r.nk }); if (NET.hosting) shareWorld(false); }
function netDug(x, z, r, d) { netAct({ k: 'dig', x: +x.toFixed(2), z: +z.toFixed(2), r: +r.toFixed(2), d: +d.toFixed(2) }); if (NET.hosting) shareWorld(false); }
function netFelled(key, dur) { netAct({ k: 'fell', key, dur: Math.round(dur) }); }
function netRock(key, dur) { netAct({ k: 'rock', key, dur: Math.round(dur) }); }
function netShot(a, b, g) { if (NET.world && (NET.inHost || NET.hosting) && NET.world.peers().length > 1) netAct({ k: 'shot', x: +a.x.toFixed(1), y: +a.y.toFixed(1), z: +a.z.toFixed(1), tx: +b.x.toFixed(1), ty: +b.y.toFixed(1), tz: +b.z.toFixed(1), g }); }
function netHostStarts() { if (NET.hosting && NET.world) { shareWorld(true); setTimeout(() => NET.world && NET.world.emit('act', { k: 'go' }).catch(() => {}), 1200); } }

/* ── the others, drawn in your world ── */
function clearRemotes() { for (const R of NET.remotes.values()) { scene.remove(R.body.root); scene.remove(R.tag.sp); } NET.remotes.clear(); }
function paintPlayerTag(R) {
  const g = R.tag.c.getContext('2d'); if (!g) return;
  g.clearRect(0, 0, 320, 84);
  g.fillStyle = 'rgba(8,14,20,.66)'; g.beginPath(); if (g.roundRect) g.roundRect(4, 10, 312, 64, 18); else g.rect(4, 10, 312, 64); g.fill();
  g.fillStyle = R.host ? '#ffd76a' : '#5fe08c'; g.beginPath(); g.arc(46, 42, 24, 0, TAU); g.fill();
  g.fillStyle = '#0e2a32'; g.font = "700 22px 'Readex Pro',sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(R.host ? '★' : String(R.lv), 46, 44);
  g.fillStyle = '#ffffff'; g.textAlign = 'right'; g.direction = 'rtl'; let fs = 27; g.font = `700 ${fs}px 'Readex Pro',sans-serif`;
  while (g.measureText(R.name).width > 236 && fs > 16) { fs -= 2; g.font = `700 ${fs}px 'Readex Pro',sans-serif`; }
  g.fillText(R.name, 300, 42); R.tag.tex.needsUpdate = true;
}
function sanitizeLook(l) { const o = {}; if (l && typeof l === 'object') for (const s of COS_SLOTS) { const id = l[s]; if (typeof id === 'string' && ITEMS[id] && isCosmetic(ITEMS[id]) && ITEMS[id].wear.slot === s) o[s] = id; } return o; }
function updateRemotes(dt) {
  if (!NET.world) { if (NET.remotes.size) clearRemotes(); return; }
  const peers = NET.world.peers(), seen = new Set();
  for (const p of peers) {
    if (p.isMe || p.kind !== 'viewer') continue;
    const pr = p.presence; if (!pr || pr.where !== 'game' || !finite(pr.x, pr.y, pr.z) || !started) continue;
    seen.add(p.peer);
    let R = NET.remotes.get(p.peer);
    const lk = JSON.stringify(pr.look || {});
    if (!R || R.lk !== lk) {
      const o = outfitFromWearing(sanitizeLook(pr.look)), kind = CHARS[o.body] ? o.body : 'soldier';
      if (R && R.kind === kind) { dressBody(R.body, o); R.lk = lk; }
      else {
        if (R) { scene.remove(R.body.root); scene.remove(R.tag.sp); }
        const body = makeBody(kind, { outfit: o, shadow: QUALITY.tier >= 2 }); if (!body) continue;
        scene.add(body.root); const tag = makeTag(); scene.add(tag.sp);
        R = { body, tag, kind, lk, x: pr.x, y: pr.y, z: pr.z, yaw: pr.yaw || 0, name: '', lv: 0, host: null };
        NET.remotes.set(p.peer, R);
      }
    }
    const name = cleanName(pr.name) || 'لاعب', lv = clamp(pr.lv | 0, 1, 999), host = !!pr.host;
    if (name !== R.name || lv !== R.lv || host !== R.host) { R.name = name; R.lv = lv; R.host = host; paintPlayerTag(R); }
    const k = 1 - Math.exp(-dt * 10), far = Math.hypot(pr.x - R.x, pr.z - R.z) > 30;
    R.x = far ? pr.x : lerp(R.x, pr.x, k); R.y = far ? pr.y : lerp(R.y, pr.y, k); R.z = far ? pr.z : lerp(R.z, pr.z, k); R.yaw = angLerp(R.yaw, pr.yaw || 0, k);
    const b = R.body, spd = Math.max(0, +pr.spd || 0), dP = Math.hypot(R.x - player.pos.x, R.z - player.pos.z);
    b.root.visible = dP < 400 && pr.alive !== false; b.root.position.set(R.x, R.y + (pr.veh ? 0.45 : 0), R.z); b.root.rotation.set(pr.alive === false ? -1.4 : 0, R.yaw, 0, 'YXZ');
    const A = b.act, idleW = smooth(0.6, 0.1, spd), runW = smooth(2.6, 4.0, spd);
    if (A.Idle) A.Idle.setEffectiveWeight(pr.veh ? 1 : idleW); if (A.Walk) { A.Walk.setEffectiveWeight(pr.veh ? 0 : Math.max(0, 1 - idleW - runW)); A.Walk.timeScale = clamp(spd / 1.45, 0.5, 1.8); } if (A.Run) { A.Run.setEffectiveWeight(pr.veh ? 0 : runW); A.Run.timeScale = clamp(spd / 4.9, 0.7, 1.45); }
    if (dP < 160) b.mixer.update(dt);
    R.tag.sp.visible = b.root.visible && dP < 120; if (R.tag.sp.visible) { R.tag.sp.position.set(R.x, R.y + 2.15 + (pr.veh ? 0.45 : 0), R.z); R.tag.sp.material.opacity = smooth(120, 80, dP); }
  }
  for (const [peer, R] of NET.remotes) if (!seen.has(peer)) { scene.remove(R.body.root); scene.remove(R.tag.sp); NET.remotes.delete(peer); }
}
function updateNet(dt) {
  if (!NET.ok) return;
  if (NET.world && started) { NET.sendT -= dt; if (NET.sendT <= 0) { NET.sendT = 0.1; sendPresence(false); } }
  updateRemotes(dt);
}

/* ── the friends panel in the lobby ── */
let netUIT = 0;
function netUI() { clearTimeout(netUIT); netUIT = setTimeout(() => { if (LOBBY.on && LOBBY.sheet === 'friends') renderSheet(); if (LOBBY.on) lobbyRefresh(true); partyBar(); }, 120); }
function profRow(uid, buttons, sub) {
  const p = NET.profiles.get(uid) || {}, on = onlineIn(uid);
  const r = el('div', 'lb-row');
  const av = el('span', 'ri'); if (p.ava && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(p.ava)) { const im = el('img'); im.src = p.ava; im.alt = ''; im.style.cssText = 'width:100%;height:100%;border-radius:12px;object-fit:cover;'; av.append(im); } else av.innerHTML = svg('person');
  if (on) { const d = el('i'); d.style.cssText = 'position:absolute;width:11px;height:11px;border-radius:50%;background:#5fe08c;box-shadow:0 0 0 2px #0b1218;margin:30px 0 0 30px;'; av.style.position = 'relative'; av.append(d); }
  const rb = el('span', 'rb'), b = el('b'), s = el('span');
  b.textContent = netName(p) + (p.lv ? ' · المستوى ' + toAr(p.lv | 0) : ''); s.textContent = 'ID ' + (sanitizeGid(p.gid) || '—') + ' · ' + (on ? (on.presence && on.presence.where === 'game' ? 'يلعب الآن' : 'في اللوبي') : 'غير متصل') + (sub ? ' · ' + sub : '');
  rb.append(b, s); r.append(av, rb); for (const x of buttons) r.append(x);
  return r;
}
function renderFriendsNet(body) {
  const me = el('div', 'lb-row'); me.innerHTML = `<span class="ri">${svg('person')}</span><span class="rb"><b></b><span>شارك آيديك مع أصدقائك ليضيفوك</span></span>`;
  me.querySelector('b').textContent = ACCOUNT.name + ' · ID ' + ACCOUNT.id;
  me.append(btn2(svg('copy') + ' انسخ', () => copyText(ACCOUNT.id), 'lbtn alt')); body.append(me);
  if (!NET.ok) {
    body.append(el('p', 'lb-note', NET.why === 'connecting' ? 'جارٍ الاتصال…' : NET.why === 'readonly' ? 'صلاحيتك في هذه اللعبة «مشاهدة» فقط. اطلب من صاحب الرابط أن يجعلك «مساهماً» لتضيف أصدقاء وتلعب معهم.' : 'الأصدقاء واللعب الجماعي يعملان حين تُفتح اللعبة من رابطها في Claude وأنت مسجّل الدخول، بصلاحية «مساهم» أو أعلى.'));
    return;
  }
  if (NET.party || NET.hosting) {
    const h = el('div', 'shead', NET.party ? 'فريق ' + NET.party.name + ' ⭐' : 'فريقك (أنت القائد ⭐)'); body.append(h);
    const mem = NET.world ? NET.world.peers().filter((p) => !p.isMe && p.kind === 'viewer').map((p) => p.by).filter(Boolean) : [];
    for (const uid of [...new Set(mem)]) body.append(profRow(uid, [], uid === (NET.party && NET.party.hostUid) ? 'القائد ⭐' : 'في الفريق'));
    if (!mem.length) body.append(el('p', 'lb-note', NET.party ? 'بانتظار القائد…' : 'لم ينضم أحد بعد. ادعُ صديقاً متصلاً.'));
    body.append(btn2('غادر الفريق', () => leaveParty(), 'lbtn alt'));
  }
  const f = el('div', 'lb-field'), inp = el('input'); inp.type = 'search'; inp.placeholder = 'ابحث بالآيدي أو الاسم'; inp.setAttribute('aria-label', 'ابحث عن لاعب'); inp.maxLength = 24; inp.value = LOBBY.q || '';
  const res = el('div'); res.style.cssText = 'display:flex;flex-direction:column;gap:8px;';
  const run = () => {
    LOBBY.q = inp.value; res.innerHTML = '';
    if (!inp.value.trim()) return;
    const hits = searchPlayers(inp.value);
    if (!hits.length) { res.append(el('p', 'lb-note', 'لا لاعب بهذا الآيدي أو الاسم بعد. يظهر اللاعبون هنا بعد أن يفتحوا اللعبة مرة واحدة.')); return; }
    for (const uid of hits) res.append(profRow(uid, [isFriend(uid) ? btn2('صديق', () => {}, 'lbtn alt', true) : NET.out.includes(uid) ? btn2('أُرسل', () => {}, 'lbtn alt', true) : btn2(NET.inSet.has(uid) ? 'اقبل' : 'أضف', () => addFriend(uid), 'lbtn')]));
  };
  inp.addEventListener('input', run); f.append(inp, btn2('ابحث', run, 'lbtn')); body.append(f, res); run();
  const inc = incomingUids();
  body.append(el('div', 'shead', 'طلبات الصداقة' + (inc.length ? ' (' + toAr(inc.length) + ')' : '')));
  if (!inc.length) body.append(el('p', 'lb-note', 'لا طلبات جديدة.'));
  for (const uid of inc) body.append(profRow(uid, [btn2('اقبل', () => addFriend(uid), 'lbtn'), btn2('تجاهل', () => ignoreRequest(uid), 'lbtn alt')]));
  const fr = friendUids(), pend = NET.out.filter((u) => !NET.inSet.has(u));
  body.append(el('div', 'shead', 'أصدقاؤك' + (fr.length ? ' (' + toAr(fr.length) + ')' : '')));
  if (!fr.length) body.append(el('p', 'lb-note', 'لا أصدقاء بعد. ابحث عن صديقك بآيديه وأرسل طلباً؛ حين يقبل يظهر هنا وتدعوه إلى عالمك.'));
  for (const uid of fr.sort((a, b) => !!onlineIn(b) - !!onlineIn(a))) {
    const on = onlineIn(uid), inv = NET.invites.get(uid);
    body.append(profRow(uid, [inv ? btn2('انضم ⭐', () => acceptInvite(uid), 'lbtn') : btn2('ادعُ', () => inviteFriend(uid), 'lbtn', !on || !!NET.party), btn2(svg('close'), () => removeFriend(uid), 'lbtn alt')]));
  }
  if (pend.length) { body.append(el('div', 'shead', 'طلبات أرسلتها')); for (const uid of pend) body.append(profRow(uid, [btn2('إلغاء', () => removeFriend(uid), 'lbtn alt')])); }
}
/* the party bar above the play button */
function partyBar() {
  let el2 = $('lbParty');
  if (!el2) { el2 = document.createElement('div'); el2.id = 'lbParty'; el2.className = 'lb-mode lbg'; el2.style.cssText = 'cursor:default;'; const br = document.querySelector('.lb-start'); if (br) br.append(el2); }
  const mem = NET.world ? NET.world.peers().filter((p) => !p.isMe && p.kind === 'viewer') : [];
  if (!NET.party && !NET.hosting) { el2.hidden = true; $('lbPlay').textContent = 'ابدأ'; return; }
  el2.hidden = false; $('lbModeSub').textContent = 'مع الأصدقاء ▾';
  el2.textContent = NET.party ? 'فريق ' + NET.party.name + ' ⭐ · ' + (hostPeer() && hostPeer().presence.where === 'game' ? 'القائد يلعب: ادخل' : 'بانتظار القائد') : 'فريقك ⭐ · ' + toAr(mem.length) + ' معك';
  $('lbPlay').textContent = NET.party ? (hostPeer() && hostPeer().presence.where === 'game' ? 'ادخل عالم القائد' : 'بانتظار القائد…') : 'ابدأ';
}

/* the invitation, in the lobby */
MODAL_EXTRA.invite = (card) => {
  const inv = [...NET.invites.values()].sort((a, b) => b.t - a.t)[0];
  if (!inv) { closeModal(); return; }
  modalHead(card, 'دعوة للعب ⭐');
  const r = profRow(inv.from, [], 'القائد');
  card.append(r, el('p', null, inv.name + ' يدعوك إلى فريقه في ' + mapTitle(inv.map || 'island') + '. حين يبدأ اللعب تدخلون عالمه معاً: ترون بعضكم، وما تبنونه وتحفرونه يبقى في عالمه. حقيبتك ومستواك وملابسك تبقى لك.'));
  const row = el('div', 'row'); row.style.justifyContent = 'flex-start';
  row.append(btn2('انضم', () => acceptInvite(inv.from), 'lbtn'), btn2('لاحقاً', () => { closeModal(); }, 'lbtn alt'));
  card.append(row);
};
SHEET_EXTRA.friends = renderFriendsNet;
Object.assign(HOOK, {
  init: () => { netInit(); },
  ava: () => publishProfile(false),
  built: netBuilt, unbuilt: netUnbuilt, dug: netDug, felled: netFelled, rock: netRock, shot: netShot, frame: updateNet,
  start: () => { netHostStarts(); sendPresence(true); },
  lobby: () => { sendPresence(true); if (NET.invites.size && !NET.party) setTimeout(() => { if (LOBBY.on && $('lbModal').hidden) openModal('invite'); }, 900); },
  play: () => {
    if (!NET.party) return false;
    const hp = hostPeer();
    if (hp && hp.presence && hp.presence.where === 'game') { enterHostWorld(); return true; }
    lbToast('بانتظار القائد ⭐', 'تدخلون عالمه معاً حين يبدأ اللعب'); return true;
  },
});
