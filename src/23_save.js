/* ═════════ the journey is saved: your bag, money, clothes, what you built, dug and planted, your cars — kept in your own
   private record for this game (and on this device as a fallback). Fall, and it all starts again from the beginning. ═════════ */
// every map keeps its own journey (the island keeps the original names, so older saves still load)
const MAP_SUFFIX = MAP_ID === 'island' ? '' : '-' + MAP_ID;
const SAVE = { v: 4, key: 'rock-island-save-v4' + MAP_SUFFIX, dirty: false, busy: false, last: 0, doc: null, wdoc: null, lastCore: '', lastWorld: '', dead: false, source: 'none', guest: false };
function saveSoon() { SAVE.dirty = true; }
const START_SLOTS = ['hand', 'axe_stone', 'pickaxe_stone', 'shovel_stone', 'sword_wood', 'pistol'];
function startKit() {
  INV.items.clear();
  for (const [id, n] of [['axe_stone', 1], ['pickaxe_stone', 1], ['shovel_stone', 1], ['water', 2], ['bread', 2], ['bandage', 2], ['torch', 1], ['rope', 2], ['seed_tomato', 3], ['seed_wheat', 4]]) INV.items.set(id, n);
  INV.coins = 60; INV.slots = START_SLOTS.slice(); INV.wearing = {};
  if (ACC.loaded) syncLookToRun();         // your own clothes, from the wardrobe
}
const stripRec = (k, v) => (k[0] === '_' ? undefined : v);
function snapshotCore() {
  const p = player.pos;
  for (const v of VEHICLES) if (v.owned && v.rec && v !== player.vehicle) { v.rec.x = +v.pos.x.toFixed(2); v.rec.z = +v.pos.z.toFixed(2); v.rec.ry = +v.yaw.toFixed(3); }
  return {
    v: SAVE.v, t: Date.now(), pos: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)], yaw: +player.yaw.toFixed(3), hour: +ENV.hour.toFixed(3), hp: Math.round(player.health), fd: Math.round(player.food), wt: Math.round(player.water), st: Math.round(player.stamina),
    kills: KILLS, surv: Math.round(SURVIVE_T), play: Math.round(T_GAME), coins: INV.coins, items: [...INV.items], slots: INV.slots, wearing: INV.wearing, tool: player.toolItem, mags: MAGS, stats: STATS,
    owned: OWNED_V, found: [...FOUND], mark: MAPMARK, home: HOME, looted: [...LOOTED].filter(([, u]) => u > T_GAME), cm: camMode, fow: FOW.pack(),
  };
}
function snapshotWorld() {
  return {
    v: SAVE.v, t: Date.now(), uid: builtUid,
    built: BUILT.slice(-2400),
    dig: DIG.list.slice(-1600).map((c) => [c.x, c.z, c.r, +c.d.toFixed(2)]),
    felled: [...FELLED].filter(([, u]) => u > T_GAME).slice(-1500),
    rocks: [...RBROKEN].filter(([, u]) => u > T_GAME).slice(-900),
    cut: CROPCUT.filter((c) => c.until > T_GAME).map((c) => [c.x, c.z, c.r, Math.round(c.until)]),
    crates: crateRecs(),
  };
}
/* the record of the world is packed (deflate + base64) before it goes to the private record: a db document holds at most 256 KiB,
   and packing lets a builder's town grow several times larger before anything has to be left out */
const utf8Len = (s) => new Blob([s]).size;
async function packStr(s) {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    const buf = await new Response(new Blob([s]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer(), u = new Uint8Array(buf);
    let bin = ''; for (let i = 0; i < u.length; i += 0x8000) bin += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    return btoa(bin);
  } catch (_) { return null; }
}
async function unpackStr(b64) {
  const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('deflate'))).text();
}
/* a world body for a db document: packed when it can be, plain when it fits, or null when it is simply too big */
async function worldBody(json) {
  const z = await packStr(json);
  if (z && z.length < 250000) return { z };
  if (utf8Len(JSON.stringify({ json })) < 255000) return { json };
  return null;
}
async function worldFromBody(d) {
  if (!d) return null;
  if (typeof d.z === 'string' && typeof DecompressionStream !== 'undefined') return await unpackStr(d.z);
  return typeof d.json === 'string' ? d.json : null;
}
const DEAD_CODES = ['not_granted', 'revoked', 'capability_disabled', 'capability_removed'];
function saveNow() { flushSave(true); }
async function flushSave(force) {
  if (SAVE.dead || !started) return;
  let core, world;
  try { core = JSON.stringify(snapshotCore()); world = SAVE.guest ? null : JSON.stringify(snapshotWorld(), stripRec); } catch (e) { console.warn('save', e); return; }
  // visiting a friend's world: your bag and level are kept, your own island's record is left alone
  try { localStorage.setItem(SAVE.key, core); if (world) localStorage.setItem(SAVE.key + '-w', world); } catch (_) {}
  // the device copy is always fresh; the private record waits while an earlier write (or a wipe) is still on its way
  if (SAVE.busy) { SAVE.dirty = true; return; }
  SAVE.dirty = false; SAVE.last = T;
  if (!SAVE.doc) return;
  SAVE.busy = true;
  try {
    if (core !== SAVE.lastCore) { await SAVE.doc.set({ json: core }); SAVE.lastCore = core; }
  } catch (e) {
    const code = e && e.code;
    if (DEAD_CODES.includes(code) || code === 'invalid_argument') { SAVE.doc = SAVE.wdoc = null; SAVE.busy = false; return; }
    SAVE.dirty = true;       // transient: try again with the next change
  }
  if (world && world !== SAVE.lastWorld && SAVE.wdoc) {
    try {
      const body = await worldBody(world);
      if (!body) { console.warn('world save too large', world.length); SAVE.lastWorld = world; }
      else { await SAVE.wdoc.set(body); SAVE.lastWorld = world; }
    } catch (e) {
      const code = e && e.code;
      if (DEAD_CODES.includes(code)) SAVE.doc = SAVE.wdoc = null;
      else if (code === 'invalid_argument') SAVE.lastWorld = world;   // this one will not fit: the bag and the rest still save
      else SAVE.dirty = true;
    }
  }
  SAVE.busy = false;
}
function updateSave(dt) { if (SAVE.dirty && !SAVE.busy && T - SAVE.last > 12) flushSave(false); }
addEventListener('pagehide', () => { if (started && !SAVE.dead) { try { localStorage.setItem(SAVE.key, JSON.stringify(snapshotCore())); if (!SAVE.guest) localStorage.setItem(SAVE.key + '-w', JSON.stringify(snapshotWorld(), stripRec)); } catch (_) {} } });
document.addEventListener('visibilitychange', () => { if (document.hidden && started) flushSave(true); });

/* ── reading it back ── */
const withTimeout = (p, ms) => Promise.race([p, new Promise((res) => setTimeout(() => res(null), ms))]);
async function loadSaveData() {
  let core = null, world = null, dbT = 0, accJson = null;
  try {
    if (window.claude && typeof window.claude.use === 'function') {
      const [db, user] = await withTimeout(Promise.all([window.claude.use('db'), window.claude.use('user')]), 6000) || [null, null];
      const uid = user ? await withTimeout(user.id(), 3000) : null;
      if (db && uid) {
        SAVE.doc = db.doc('data/users/' + uid + '/save' + MAP_SUFFIX); SAVE.wdoc = db.doc('data/users/' + uid + '/world' + MAP_SUFFIX); ACC.doc = db.doc('data/users/' + uid + '/account');
        const res = await withTimeout(Promise.all([SAVE.doc.get(), SAVE.wdoc.get(), ACC.doc.get()]), 6000);
        if (res) {
          const [a, b, c] = res;
          if (c && c.exists && c.data().json) accJson = c.data().json;
          if (a.exists && a.data().json) { core = JSON.parse(a.data().json); SAVE.lastCore = a.data().json; dbT = core.t || 0; }
          if (b && b.exists) { try { const wj = await worldFromBody(b.data()); if (wj) { world = JSON.parse(wj); SAVE.lastWorld = wj; } } catch (e) { console.warn('world read', e); } }
          SAVE.source = 'db';
        }
      }
    }
  } catch (e) { console.warn('save read', e); }
  try {
    const lc = JSON.parse(localStorage.getItem(SAVE.key) || 'null');
    if (lc && lc.v === SAVE.v && (!core || (lc.t || 0) > dbT + 2000)) { core = lc; world = JSON.parse(localStorage.getItem(SAVE.key + '-w') || 'null'); if (SAVE.source !== 'db') SAVE.source = 'local'; }
  } catch (_) {}
  if (core && core.v !== SAVE.v) core = null;
  accLoadFrom(accJson);
  return { core, world };
}
function applySave(core, world) {
  if (world) {
    builtUid = Math.max(builtUid, world.uid || 1);
    for (const [x, z, r, d] of world.dig || []) addCrater(x, z, r, d, true);
    if ((world.dig || []).length) { for (const [x, z, r] of world.dig) { TERRAIN.dirtyArea(x, z, r + 2); GBLOCK.add(Math.floor(x / 8) * 100000 + Math.floor(z / 8)); } }
    for (const [k, u] of world.felled || []) FELLED.set(k, u);
    for (const [k, u] of world.rocks || []) RBROKEN.set(k, u);
    for (const [x, z, r, u] of world.cut || []) { CROPCUT.push({ x, z, r, until: u }); GBLOCK.add(Math.floor(x / 8) * 100000 + Math.floor(z / 8)); }
    try { loadCrates(world.crates); } catch (e) { console.warn('crates', e); }
    for (const rec of world.built || []) { try { if (rec.kind === 'piece' && !ITEMS[rec.id]) continue; if (rec.kind === 'place' && !ITEMS[rec.id]) continue; addRec(rec, true); } catch (e) { console.warn('skip saved build', e); } }
  }
  if (!core) return false;
  INV.items.clear(); for (const [id, n] of core.items || []) if (ITEMS[id] && n > 0) INV.items.set(id, n);
  INV.coins = Math.max(0, core.coins | 0); INV.slots = Array.isArray(core.slots) && core.slots.length === 6 ? core.slots : START_SLOTS.slice(); INV.wearing = core.wearing || {};
  for (const [k, v] of Object.entries(core.mags || {})) MAGS[k] = v;
  for (const [k, v] of Object.entries(core.stats || {})) STATS[k] = v;
  KILLS = core.kills | 0; SURVIVE_T = core.surv || 0; T_GAME = core.play || 0;
  for (const id of core.found || []) FOUND.add(id);
  MAPMARK = core.mark || null;
  HOME = Array.isArray(core.home) && core.home.length === 3 ? core.home : null;
  for (const [k, u] of core.looted || []) LOOTED.set(k, u);
  for (const rec of core.owned || []) { if (!VSPEC[rec.kind]) continue; OWNED_V.push(rec); const v = spawnVehicle(rec.kind, rec.x, rec.z, rec.ry || 0, rec.paint, rec); v.owned = true; }
  if (Array.isArray(core.pos)) { player.pos.set(core.pos[0], core.pos[1], core.pos[2]); player.yaw = core.yaw || 0; }
  if (typeof core.hour === 'number') ENV.hour = core.hour;
  player.health = clamp(core.hp || 100, 25, 100); player.stamina = core.st || 100;
  player.food = clamp(core.fd === undefined ? 100 : core.fd, 20, 100); player.water = clamp(core.wt === undefined ? 100 : core.wt, 20, 100);
  if (core.cm === 'fpp') camMode = 'fpp';
  if (core.fow) FOW.unpack(core.fow);
  applyOutfit();
  if (core.tool && (core.tool === 'hand' || invCount(core.tool) > 0)) equip(core.tool);
  return true;
}

/* ── a fall: everything you carried drops into a crate where you fell; you rise again at your bed (or at the start of the map)
   with a few basics, and the world you built stays. «بداية جديدة» in the settings still wipes the whole journey ── */
let HOME = null;            // [x, y, z] of the bed you last slept in or claimed
function onPlayerDeath(kind) {
  if (SURVIVE_T > (ACCOUNT.best.surv || 0)) ACCOUNT.best.surv = Math.floor(SURVIVE_T);
  if (kind !== 'reset') { ACCOUNT.life.deaths = (ACCOUNT.life.deaths || 0) + 1; accSoon(true); accFlush(); }
  try { BEST = Math.max(BEST, KILLS); localStorage.setItem('rock-island-best', String(BEST)); } catch (_) {}
  if (kind === 'reset') { wipeRecord(); return; }
  const items = [...INV.items].filter(([id, n]) => n > 0 && ITEMS[id] && !isCosmetic(ITEMS[id]));
  const coins = Math.floor(INV.coins * 0.5);
  const p = player.vehicle ? player.vehicle.pos : player.pos;
  if (items.length || coins) makeCrate(p.x + 0.6, p.z + 0.4, items, { own: true, coins, name: 'صندوقك' });
  INV.items.clear(); INV.coins -= coins;
  for (const [s2, id] of Object.entries(INV.wearing)) if (!isCosmetic(ITEMS[id])) delete INV.wearing[s2];
  for (const k of Object.keys(MAGS)) delete MAGS[k];
  saveSoon();
}
function wipeRecord() {
  SAVE.dead = true;
  try { localStorage.removeItem(SAVE.key); localStorage.removeItem(SAVE.key + '-w'); } catch (_) {}
  // wipe the private record; a new life's first save waits until the wipe is done, so it can never be wiped by mistake
  if (SAVE.doc) { const a = SAVE.doc, b = SAVE.wdoc; SAVE.busy = true; (async () => { try { await withTimeout(a.delete(), 8000); await withTimeout(b.delete(), 8000); } catch (_) {} SAVE.lastCore = SAVE.lastWorld = ''; SAVE.busy = false; if (!SAVE.dead) { SAVE.dirty = true; SAVE.last = -99; } })(); }
}
/* back on your feet: at your bed if you have one, otherwise where the map begins; the crate with your things is marked on the map */
function respawnPoint() {
  if (HOME) { const [x, y, z] = HOME; if (BEDS.some((b) => Math.hypot(b.x - x, b.z - z) < 2.5) || BUILT.some((r) => r.kind === 'place' && /bed/.test(r.id || '') && Math.hypot((r.x || 0) - x, (r.z || 0) - z) < 2.5)) return { x, y, z, bed: true }; }
  const s = edSpawn() || WORLD.data.spawn; return { x: s.x, y: null, z: s.z, bed: false };     // (the world editor can set where everyone starts)
}
function respawn() {
  const sp = respawnPoint(), x = sp.x, z = sp.z;
  player.pos.set(x, sp.y !== null ? sp.y + 0.1 : groundAt(x, z, terrainAt(x, z) + 2), z); player.vel.set(0, 0, 0); player.yaw = Math.PI;
  player.health = 100; player.stamina = 100; player.food = 100; player.water = 100; player.alive = true; player.bornAt = T; player.deadT = 0; player.swimming = false;
  player.root.rotation.set(0, player.yaw, 0); player.root.position.copy(player.pos);
  // a few basics to start again with
  for (const [id, n] of [['axe_stone', 1], ['pickaxe_stone', 1], ['bottle_water', 2], ['bread', 2], ['bandage', 3], ['torch', 1]]) if (invCount(id) < n) INV.items.set(id, n);
  INV.coins = Math.max(INV.coins, 20);
  if (ACC.loaded) syncLookToRun();
  KILLS = 0; SURVIVE_T = 0; hudDirty = true; slotSig = '';
  for (const zb of ZOMBIES) if (Math.hypot(zb.x - x, zb.z - z) < 60) { zb.active = false; zb.root.visible = false; }
  equip('hand');
  cam.yaw = cam.tyaw = player.yaw + Math.PI; cam.focus.set(player.pos.x, player.pos.y + 1.6, player.pos.z); updateCamera(0.016, true);
  SAVE.dead = false; saveSoon(); flushSave(true);
  applyOutfit(); ACC.lifeXP0 = xpTotal(); ACC.lifeGold0 = ACCOUNT.life.goldEarned || 0;
  const mine = CRATES.filter((c) => c.own).pop();
  toast(sp.bed ? 'نهضت في سريرك' : 'عدت إلى نقطة البداية', mine ? 'صندوق أغراضك ينتظرك حيث سقطت · تجده على الخريطة والبوصلة' : 'مستواك وذهبك وملابسك معك');
}
function wipeSave() { onPlayerDeath('reset'); }
function resetProgress() {
  for (const r of [...BUILT]) removeRec(r);
  for (const v of [...VEHICLES]) if (v.owned) removeVehicle(v);
  OWNED_V.length = 0;
  if (DIG.list.length) { const old = DIG.list.slice(); DIG.list.length = 0; DIG.grid.clear(); DIG.version++; for (const c of old) { TERRAIN.dirtyArea(c.x, c.z, c.r + 2); grassDirtyArea(c.x, c.z, c.r + 2); } }
  FELLED.clear(); RBROKEN.clear(); vegDirty(); rocksDirty(); CROPCUT.length = 0; LOOTED.clear(); FOUND.clear(); MAPMARK = null;
  for (const L of [...LOGS]) removeLog(L, false);
  for (const d of DROPS) scene.remove(d.g); DROPS.length = 0;
  for (const c of CRATES.slice()) removeCrate(c); HOME = null;
  GBLOCK.clear(); GRASS.tiles.clear(); GRASS.dirty = true;
  for (const k of Object.keys(MAGS)) delete MAGS[k];
  for (const k of Object.keys(STATS)) STATS[k] = 0;
  startKit(); applyOutfit();
  stopFishing(); FOW.reset();
}
function newLife() {
  resetProgress();
  const s = WORLD.data.spawn, x = s.x, z = s.z;
  player.pos.set(x, groundAt(x, z, terrainAt(x, z) + 2), z); player.vel.set(0, 0, 0); player.yaw = Math.PI;
  player.health = 100; player.stamina = 100; player.food = 100; player.water = 100; player.alive = true; player.bornAt = T; player.deadT = 0; player.swimming = false;
  player.root.rotation.set(0, player.yaw, 0); player.root.position.copy(player.pos);
  KILLS = 0; SURVIVE_T = 0; hudDirty = true; slotSig = '';
  for (const zb of ZOMBIES) { zb.active = false; zb.root.visible = false; }
  ENV.hour = 8; equip('hand');
  cam.yaw = cam.tyaw = player.yaw + Math.PI; cam.focus.set(player.pos.x, player.pos.y + 1.6, player.pos.z); updateCamera(0.016, true);
  SAVE.dead = false; SAVE.lastCore = SAVE.lastWorld = ''; saveSoon(); flushSave(true);
  applyOutfit(); ACC.lifeXP0 = xpTotal(); ACC.lifeGold0 = ACCOUNT.life.goldEarned || 0;
  toast('حياة جديدة', 'عدت إلى بداية الرحلة عند الميناء · مستواك وذهبك وملابسك معك');
}
