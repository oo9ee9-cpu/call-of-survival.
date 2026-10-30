/* ═════════ crates: whoever falls leaves a wooden crate with everything they carried. Walk up and open it, tap what you want
   (or take it all), or let auto-pickup grab ammo for your guns, meds and drinks by itself. Your own crate waits where you fell
   and is kept in your journey until you empty it. Air drops from the flare gun land the same way, with better things. ═════════ */
const CRATES = [];
const CRATE_KEEP = 6;             // your own crates kept in the journey (the oldest go first)
const CRATE_GEO = (() => {
  const b = new Builder(), wood = 0x6e5236, dark = 0x4a3826, metal = 0x2e3236;
  b.box(0, 0.3, 0, 0.92, 0.56, 0.62, wood, 0, MATID.wood);
  for (const y of [0.12, 0.3, 0.48]) for (const s of [-1, 1]) b.box(0, y, s * 0.315, 0.94, 0.12, 0.02, dark, 0, MATID.wood);      // planks
  for (const y of [0.12, 0.3, 0.48]) for (const s of [-1, 1]) b.box(s * 0.465, y, 0, 0.02, 0.12, 0.64, dark, 0, MATID.wood);
  b.box(0, 0.6, 0, 0.96, 0.06, 0.66, dark, 0, MATID.wood);                                                                   // the lid
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(sx * 0.45, 0.31, sz * 0.3, 0.07, 0.6, 0.07, metal, 0, MATID.metal);   // iron corners
  for (const sx of [-1, 1]) b.box(sx * 0.2, 0.31, 0, 0.05, 0.62, 0.68, metal, 0, MATID.metal);                               // straps
  return b.geometry();
})();
const DROPBOX_GEO = (() => {
  const b = new Builder(), blue = 0x2f5d8a, red = 0xb8302a, metal = 0x8a9096;
  b.box(0, 0.42, 0, 1.2, 0.84, 1.2, blue, 0, MATID.metal);
  for (const s of [-1, 1]) { b.box(s * 0.61, 0.42, 0, 0.03, 0.86, 1.22, metal, 0, MATID.metal); b.box(0, 0.42, s * 0.61, 1.22, 0.86, 0.03, metal, 0, MATID.metal); }
  b.box(0, 0.86, 0, 1.24, 0.06, 1.24, red, 0, MATID.metal);
  return b.geometry();
})();
const CRATE_MARK = (() => {
  // a soft column of light above every crate, so you find it in the grass from far away
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.3, 1, 10, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 0.95, 0.45), transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: true }));
  return m;
})();
function makeCrate(x, z, items, o = {}) {
  const list = items.filter(([id, n]) => n > 0 && ITEMS[id]);
  if (!list.length && !(o.coins > 0)) return null;
  const y = o.y !== undefined ? o.y : groundAt(x, z, terrainAt(x, z) + 1.5);
  const g = new THREE.Group(), mesh = new THREE.Mesh(o.drop ? DROPBOX_GEO : CRATE_GEO, UBER_OBJ);
  mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh);
  const beam = CRATE_MARK.clone(); beam.scale.set(1, o.drop ? 9 : 3.2, 1); beam.position.y = (o.drop ? 9 : 3.2) / 2 + 0.6; g.add(beam);
  g.position.set(x, y, z); g.rotation.y = o.ry !== undefined ? o.ry : rand() * TAU; scene.add(g);
  const c = { x, y, z, ry: g.rotation.y, items: list.map(([id, n]) => [id, n]), coins: o.coins | 0, name: o.name || 'صندوق', own: !!o.own, drop: !!o.drop, life: o.life || (o.own ? Infinity : 600), t: 0, g, auto: 0, opened: false, born: o.t || Date.now() };
  CRATES.push(c);
  if (c.own) { const mine = CRATES.filter((q) => q.own); while (mine.length > CRATE_KEEP) removeCrate(mine.shift()); if (typeof saveSoon === 'function') saveSoon(); }
  return c;
}
function removeCrate(c) {
  const i = CRATES.indexOf(c); if (i >= 0) CRATES.splice(i, 1);
  scene.remove(c.g); if (LOOTUI.crate === c) closeCrate();
  if (c.own && typeof saveSoon === 'function') saveSoon();
}
const crateEmpty = (c) => !c.items.some(([, n]) => n > 0) && !(c.coins > 0);
/* the use button: «افتح» next to a crate */
function crateUseNear(p, cand) {
  for (const c of CRATES) { const d = Math.hypot(c.x - p.x, c.z - p.z); if (d < 2.3 && Math.abs(c.y - p.y) < 2) cand('crate', 'افتح ' + c.name, c, d - 0.2); }
}
/* auto-pickup: what you clearly want goes straight into the bag (ammo for the guns you carry, meds, drinks, armour upgrades) */
function autoWanted(id, n) {
  const it = ITEMS[id]; if (!it) return 0;
  if (it.cat === 'ammo') { const use = [...INV.items.keys()].some((g) => { const gi = ITEMS[g]; return gi && gi.gun && (gunOf(gi).ammo === id); }); return use ? n : 0; }
  if (it.heal) return Math.max(0, Math.min(n, (it.heal >= 50 ? 3 : 8) - invCount(id)));
  if (it.drink) return Math.max(0, Math.min(n, 4 - invCount(id)));
  if (it.attach) return invCount(id) > 0 ? 0 : 1;
  if (it.wear && (it.wear.armor || it.wear.cap)) {
    const cur = INV.wearing[it.wear.slot], ci = cur && ITEMS[cur];
    const better = it.wear.armor ? !ci || !ci.wear.armor || it.wear.armor < ci.wear.armor : !ci || (ci.wear.cap || 0) < it.wear.cap;
    return better && invCount(id) === 0 ? 1 : 0;
  }
  return 0;
}
function crateAuto(c) {
  const got = [];
  for (const row of c.items) {
    const want = autoWanted(row[0], row[1]); if (!want) continue;
    const k = invAdd(row[0], want, true); if (k > 0) { row[1] -= k; got.push(toAr(k) + ' ' + ITEMS[row[0]].name);
      const it = ITEMS[row[0]]; if (it.wear && (it.wear.armor || it.wear.cap) && typeof wearItem === 'function') wearItem(row[0]); }
  }
  c.items = c.items.filter(([, n]) => n > 0);
  if (got.length) { toast('التقاط تلقائي: ' + got.slice(0, 3).join('، ') + (got.length > 3 ? '…' : ''), ''); AUDIO.pickup(false); }
  if (LOOTUI.crate === c) renderCrate();
}
function updateCrates(dt) {
  const p = player.pos;
  for (let i = CRATES.length - 1; i >= 0; i--) {
    const c = CRATES[i]; c.t += dt;
    if (c.t > c.life || (crateEmpty(c) && LOOTUI.crate !== c)) { removeCrate(c); continue; }
    const d = Math.hypot(p.x - c.x, p.z - c.z);
    c.g.children[1].visible = d > 3;
    if (SET.autoLoot && player.alive && !player.vehicle && d < 2.4 && Math.abs(p.y - c.y) < 2 && (c.auto -= dt) <= 0) { c.auto = 1.2; crateAuto(c); }
  }
  if (LOOTUI.crate) { const c = LOOTUI.crate; if (!player.alive || player.vehicle || Math.hypot(p.x - c.x, p.z - c.z) > 3.4) closeCrate(); }
}
/* ── the loot list ── */
const LOOTUI = { crate: null, el: null };
(() => {
  const el = document.createElement('div'); el.id = 'lootBox'; el.className = 'glass gone'; el.setAttribute('dir', 'rtl');
  el.innerHTML = '<div class="lbx-head"><b id="lxName"></b><button id="lxAll" type="button">خذ الكل</button><button id="lxX" type="button" aria-label="أغلق"></button></div><div id="lxList"></div><div class="lbx-foot"><span id="lxBag"></span><label class="lbx-auto"><input type="checkbox" id="lxAuto"> التقاط تلقائي</label></div>';
  hudIn.append(el); LOOTUI.el = el;
  $('lxX').innerHTML = svg('close');
  $('lxX').addEventListener('pointerdown', (e) => { e.preventDefault(); closeCrate(); });
  $('lxAll').addEventListener('pointerdown', (e) => { e.preventDefault(); takeAll(); });
  $('lxAuto').addEventListener('change', () => { SET.autoLoot = $('lxAuto').checked; saveSettings(); if (SET.autoLoot && LOOTUI.crate) crateAuto(LOOTUI.crate); });
})();
function openCrate(c) {
  if (!c || !player.alive) return;
  if (!c.opened && !c.own) track(c.drop ? 'airdrops' : 'cratesLooted');
  LOOTUI.crate = c; c.opened = true; LOOTUI.el.classList.remove('gone'); $('lxAuto').checked = !!SET.autoLoot;
  renderCrate(); AUDIO.pickup(false);
}
function closeCrate() { LOOTUI.crate = null; if (LOOTUI.el) LOOTUI.el.classList.add('gone'); }
function takeRow(c, row) {
  const it = ITEMS[row[0]]; if (!it) return;
  const k = invAdd(row[0], row[1], true);
  if (k > 0) { row[1] -= k; AUDIO.pickup(false); if (it.gun && typeof assignFreeSlot === 'function') assignFreeSlot(row[0]); }
  if (row[1] > 0) toast('الحقيبة ممتلئة', 'أخذت ' + toAr(k) + ' فقط · ارمِ شيئاً أو البس حقيبة أكبر');
  c.items = c.items.filter(([, n]) => n > 0);
  if (c.own) saveSoon();
  renderCrate();
}
function takeAll() {
  const c = LOOTUI.crate; if (!c) return;
  if (c.coins > 0) { addCoins(c.coins); c.coins = 0; }
  let full = false;
  for (const row of c.items.slice()) { const k = invAdd(row[0], row[1], true); row[1] -= k; if (row[1] > 0) full = true; else if (ITEMS[row[0]].gun && typeof assignFreeSlot === 'function') assignFreeSlot(row[0]); }
  c.items = c.items.filter(([, n]) => n > 0);
  if (full) toast('الحقيبة ممتلئة', 'بقيت أشياء في الصندوق'); AUDIO.pickup(true);
  if (c.own) saveSoon();
  if (crateEmpty(c)) { removeCrate(c); closeCrate(); } else renderCrate();
}
function renderCrate() {
  const c = LOOTUI.crate; if (!c) return;
  $('lxName').textContent = c.name;
  const L = $('lxList'); L.innerHTML = '';
  if (c.coins > 0) {
    const r = document.createElement('button'); r.type = 'button'; r.className = 'lbx-row';
    r.innerHTML = `<span class="lbx-ic">${svg('coin', '', '#ffd76a')}</span><span class="lbx-n">دنانير</span><b>${toAr(c.coins)}</b>`;
    r.addEventListener('pointerdown', (e) => { e.preventDefault(); addCoins(c.coins); c.coins = 0; if (c.own) saveSoon(); renderCrate(); });
    L.append(r);
  }
  const order = { weapon: 0, ammo: 1, wear: 2, med: 3, food: 4 };
  const rows = c.items.slice().sort((a, b) => (order[ITEMS[a[0]].cat] ?? 9) - (order[ITEMS[b[0]].cat] ?? 9));
  for (const row of rows) {
    const it = ITEMS[row[0]]; if (!it) continue;
    const r = document.createElement('button'); r.type = 'button'; r.className = 'lbx-row' + (it.rare || it.tierRank >= 3 ? ' rare' : '');
    r.innerHTML = `<span class="lbx-ic">${itemIcon(it)}</span><span class="lbx-n"></span><b>${row[1] > 1 ? '×' + toAr(row[1]) : ''}</b>`;
    r.querySelector('.lbx-n').textContent = it.name;
    r.addEventListener('pointerdown', (e) => { e.preventDefault(); takeRow(c, row); });
    L.append(r);
  }
  if (!L.children.length) L.innerHTML = '<p class="lbx-empty">الصندوق فارغ</p>';
  $('lxBag').textContent = 'الحقيبة ' + toAr(bagLoad()) + ' / ' + toAr(bagCap());
}
/* the journey keeps your own crates */
const crateRecs = () => CRATES.filter((c) => c.own && !crateEmpty(c)).map((c) => ({ x: +c.x.toFixed(2), y: +c.y.toFixed(2), z: +c.z.toFixed(2), ry: +c.ry.toFixed(2), items: c.items, coins: c.coins, name: c.name, t: c.born }));
function loadCrates(list) {
  for (const c of CRATES.filter((q) => q.own)) removeCrate(c);
  for (const r of list || []) { if (!r || !Array.isArray(r.items)) continue; makeCrate(r.x, r.z, r.items.filter(([id]) => ITEMS[id]), { y: r.y, ry: r.ry, coins: r.coins, name: r.name || 'صندوقك', own: true, t: r.t }); }
}
