/* ═════════ وضع التطوير (3/3): keeping what the editor made. «حفظ» packs it (deflate + base64) into the game's shared record,
   which everyone who opens the game reads at the start (the owner writes it; anyone else's saves stay on their own device),
   with a copy on this device; unsaved work is kept as a draft you are offered back next time ═════════ */
const ED_LS = 'cos-dev-' + MAP_ID, ED_DRAFT = 'cos-dev-draft-' + MAP_ID, ED_PART = 240000;
const EDIO = { db: null, owner: false, savedT: 0, busy: false, draftT: 0 };
function edB64(u) { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
// the land the brush moved: 2 cm steps, only the 128 m squares that were touched
function edTerrPack() {
  const out = {};
  for (const [k, a] of EDT.ch) {
    const q = new Int16Array(4096); let any = false;
    for (let i = 0; i < 4096; i++) { q[i] = clamp(Math.round(a[i] / 0.02), -32767, 32767); if (q[i]) any = true; }
    if (any) out[k] = edB64(new Uint8Array(q.buffer));
  }
  return out;
}
function edTerrUnpack(obj) {
  for (const [ks, b] of Object.entries(obj || {})) {
    const k = +ks, u = b64Bytes(b), q = new Int16Array(u.length >> 1); new Uint8Array(q.buffer).set(u.subarray(0, q.length * 2));
    const ci = Math.floor(k / 8192) - 4096, cj = (k % 8192) - 4096, a = edtChunk(ci * 64, cj * 64, true);
    for (let i = 0; i < 4096 && i < q.length; i++) a[i] = q[i] * 0.02;
    edTouch(ci * 128 + 64, cj * 128 + 64, 92, true, 7);
  }
  EDT.ver++;
}
function edSerialize() {
  return { v: 1, t: Date.now(), map: MAP_ID, nid: ED.nid, objs: ED.objs.map(edSnap).concat(ED.orphans || []), er: ED.er.map((z) => [r2(z.x), r2(z.z), r2(z.r), z.m]), ter: edTerrPack() };
}
async function edPack(D) { const json = JSON.stringify(D), z = await packStr(json); return z ? { t: D.t, z } : { t: D.t, json }; }
async function edUnpack(body) {
  if (!body) return null;
  const json = typeof body.z === 'string' && body.z ? await unpackStr(body.z) : typeof body.json === 'string' ? body.json : null;
  return json ? JSON.parse(json) : null;
}
function edClearAll() {
  for (const o of ED.objs.slice()) edRemove(o);
  ED.orphans = [];
  for (const zn of ED.er) { zoneDel(zn); edTouch(zn.x, zn.z, zn.r, false, zn.m); } ED.er.length = 0;
  for (const k of [...EDT.ch.keys()]) edTerrSet(k, null);
  ED.undo.length = 0; ED.redo.length = 0;
}
// a saved world put back: the land first (brush, shapes, lakes, plots and buildings), then what stands on it
function edApplyData(D) {
  if (!D || D.v !== 1) return false;
  edTerrUnpack(D.ter);
  for (const [x, z, r, m] of D.er || []) { const zn = zoneAdd({ t: 'c', x, z, r, m }); ED.er.push(zn); edTouch(x, z, r, false, m); }
  const pri = (s) => { const d = EDK[s.k], t = d.type; return t === 'shape' ? 0 : t === 'lake' ? 1 : t === 'land' || t === 'house' || t === 'villa' || d.pre === 'plot' ? 2 : t === 'mesh' ? 3 : 4; };
  const recs = (D.objs || []).filter((s) => s && EDK[s.k]).sort((a, b) => pri(a) - pri(b));
  // things whose model could not be read now (an uploaded one, offline): kept as they are, saved again with the rest
  ED.orphans = (D.objs || []).filter((s) => s && s.k && !EDK[s.k]);
  for (const s of recs) { try { edAdd(edLoadRec(s)); } catch (e) { console.warn('editor: load', s.k, e); } }
  ED.nid = Math.max(ED.nid, D.nid || 1);
  edFlush(true);
  return true;
}
/* read at the start: the shared record (and its parts), or this device's copy when that is newer */
async function edFetch() {
  let db = null, user = null;
  try {
    if (window.claude && typeof window.claude.use === 'function') {
      const r = await withTimeout(Promise.all([window.claude.use('db'), window.claude.use('user')]), 6000);
      if (r) [db, user] = r;
    }
  } catch (_) {}
  EDIO.db = db;
  if (user) { try { EDIO.owner = !!(await withTimeout(user.isOwner(), 3000)); } catch (_) {} }
  try { await withTimeout(upInit(), 12000); } catch (e) { console.warn('models', e); }      // the uploaded models, before the world that uses them
  let shared = null;
  if (db) {
    try {
      const main = await withTimeout(db.doc('devworld/' + MAP_ID).get(), 6000);
      if (main && main.exists) {
        const m = main.data(), parts = [m.z || ''];
        for (let i = 1; i < (m.n || 1); i++) { const p = await withTimeout(db.doc('devworld/' + MAP_ID + '-' + i).get(), 6000); parts.push(p && p.exists ? p.data().z || '' : ''); }
        shared = m.json ? { t: m.t || 0, json: m.json } : { t: m.t || 0, z: parts.join('') };
      }
    } catch (e) { console.warn('dev world read', e); }
  }
  let local = null; try { local = JSON.parse(localStorage.getItem(ED_LS) || 'null'); } catch (_) {}
  const pick = local && (!shared || (local.t || 0) > (shared.t || 0)) ? local : shared;
  if (!pick) return null;
  try { const D = await edUnpack(pick); if (D) { D.src = pick === local ? 'local' : 'db'; D.t = pick.t || D.t; } return D; } catch (e) { console.warn('dev world unpack', e); return null; }
}
async function edBoot(D) {
  ED.loaded = true;
  if (!D) return;
  edApplyData(D); ED.savedVer = ED.ver; EDIO.savedT = D.t || 0; ED.src = D.src || '';
  // a new journey starts where the editor put the start (a saved one keeps its place)
  const sp = edSpawn(); if (sp && !BOOT.loaded) { player.pos.set(sp.x, groundAt(sp.x, sp.z, terrainAt(sp.x, sp.z) + 2), sp.z); player.yaw = sp.ry; }
  console.log('dev world', D.src, ED.objs.length, 'things,', EDT.n, 'land squares,', ED.er.length, 'cleared');
}
/* «حفظ» */
async function edSave() {
  if (EDIO.busy) return; EDIO.busy = true; $('edSave').classList.add('busy');
  try {
    const D = edSerialize(), body = await edPack(D);
    let local = false; try { localStorage.setItem(ED_LS, JSON.stringify(body)); local = true; } catch (_) {}
    try { localStorage.removeItem(ED_DRAFT); } catch (_) {}
    let shared = false, why = '';
    if (EDIO.db && body.z !== undefined) {
      try {
        const z = body.z, parts = [];
        for (let i = 0; i < z.length; i += ED_PART) parts.push(z.slice(i, i + ED_PART));
        if (!parts.length) parts.push('');
        for (let i = parts.length - 1; i >= 1; i--) await EDIO.db.doc('devworld/' + MAP_ID + '-' + i).set({ z: parts[i] });
        await EDIO.db.doc('devworld/' + MAP_ID).set({ t: D.t, n: parts.length, z: parts[0] });
        shared = true;
      } catch (e) { why = (e && e.code) || ''; console.warn('dev world save', e); }
    }
    ED.savedVer = ED.ver; EDIO.savedT = D.t; edStatus(); AUDIO.pickup(true);
    if (shared) edToast('تم الحفظ', EDIO.owner ? 'كل من يفتح لعبتك سيرى العالم هكذا' : 'حُفظت التعديلات');
    else if (local) edToast('حُفظ على هذا الجهاز', EDIO.db && !EDIO.owner ? 'صاحب اللعبة وحده يحفظ للجميع' : why ? 'تعذّر الحفظ للجميع الآن، جرّب مرة أخرى' : '');
    else edToast('تعذّر الحفظ', 'لا مساحة على الجهاز');
  } catch (e) { console.warn('dev world save', e); edToast('تعذّر الحفظ', String((e && e.message) || e).slice(0, 80)); }
  finally { EDIO.busy = false; $('edSave').classList.remove('busy'); }
}
/* the draft: unsaved work, kept on this device a moment after each change */
function edDraftSoon() {
  clearTimeout(EDIO.draftT);
  EDIO.draftT = setTimeout(async () => { if (ED.ver === ED.savedVer) return; try { localStorage.setItem(ED_DRAFT, JSON.stringify(await edPack(edSerialize()))); } catch (_) {} }, 2500);
}
addEventListener('pagehide', () => { if (ED.ver !== ED.savedVer) { try { const D = edSerialize(); localStorage.setItem(ED_DRAFT, JSON.stringify({ t: D.t, json: JSON.stringify(D) })); } catch (_) {} } });
function edDraftOffer() {
  const el = $('edMsg'); el.hidden = true;
  if (ED.ver !== ED.savedVer) return;           // this session already holds the newest work
  let body = null; try { body = JSON.parse(localStorage.getItem(ED_DRAFT) || 'null'); } catch (_) {}
  if (!body || (body.t || 0) <= EDIO.savedT) return;
  el.innerHTML = '<span>لديك تعديلات لم تُحفظ من مرة سابقة</span><button type="button" class="edb save dirty" data-m="yes">استعادتها</button><button type="button" class="edb" data-m="no">تجاهل</button>';
  el.hidden = false;
  el.onpointerdown = async (e) => {
    const b = e.target.closest('[data-m]'); if (!b) return; e.preventDefault();
    el.hidden = true;
    if (b.dataset.m === 'no') { try { localStorage.removeItem(ED_DRAFT); } catch (_) {} return; }
    try { const D = await edUnpack(body); if (D) { edSelect(null); edClearAll(); edApplyData(D); ED.ver++; edStatus(); edToast('استعدت تعديلاتك', 'اضغط «حفظ» لتثبيتها'); } } catch (err) { console.warn('draft', err); edToast('تعذّرت الاستعادة', ''); }
  };
}
