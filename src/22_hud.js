/* ═════════ controls and HUD: the same screen as before — vitals, compass, minimap, hotbar, action buttons —
   with the bag now holding crafting, inventory, the shop and the wardrobe; the 8 km chart pans and zooms ═════════ */
let started = false, paused = false, introT = 0, T = 0, last = 0, forced = false, chartOpen = false, craftOpen = false;
const app = $('app'), hud = $('hud'), hudIn = hud.querySelector('.hud-in');
const TOUCH = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;
const toLocal = (dx, dy) => (forced ? [dy, -dx] : [dx, dy]);
const toLocalPt = (sx, sy) => (forced ? [sy, innerWidth - sx] : [sx, sy]);
function applyOrientation() {
  forced = (started || (typeof LOBBY !== 'undefined' && LOBBY.on)) && TOUCH && innerHeight > innerWidth;
  app.classList.toggle('force-land', forced);
  const w = forced ? innerHeight : innerWidth, h = forced ? innerWidth : innerHeight;
  renderer.setPixelRatio(renderRatio()); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); POST.resize();
}
addEventListener('resize', applyOrientation);
addEventListener('orientationchange', () => setTimeout(applyOrientation, 200));
function goLandscape() {
  try {
    const el = document.documentElement, req = el.requestFullscreen || el.webkitRequestFullscreen;
    const lock = () => { try { const p = screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'); if (p && p.catch) p.catch(() => {}); } catch (_) {} };
    if (req && TOUCH) { const p = req.call(el); if (p && p.then) p.then(lock).catch(() => {}); else lock(); } else lock();
  } catch (_) {}
  setTimeout(applyOrientation, 350);
}

/* ── icons ── */
const ICON = {
  hand: '<path d="M8 11V6.8a1.4 1.4 0 0 1 2.8 0V10m0-3.8V5.6a1.4 1.4 0 0 1 2.8 0V10m0-3.4a1.4 1.4 0 0 1 2.8 0V11m0-2.6a1.4 1.4 0 0 1 2.8 0V14a7 7 0 0 1-7 7h-.6A6.4 6.4 0 0 1 5.2 14.6V13a2 2 0 0 1 2-2h2.2"/>',
  axe: '<path d="M4.5 20.5 15 10" stroke-width="2.3"/><path d="M12.3 6.6 15 3.9c2.4.6 4.5 2.7 5.1 5.1l-2.7 2.7c-.9-2.2-2.8-4.2-5.1-5.1z" fill="currentColor" stroke="none"/>',
  pickaxe: '<path d="M5 20 15 10" stroke-width="2.3"/><path d="M5.2 7C8.8 3.8 14.8 3 19.2 4.8c1.8 4.4 1 10.4-2.2 14" stroke-width="2.4"/>',
  shovel: '<path d="M5 19 14.5 9.5" stroke-width="2.3"/><path d="M13.2 8.2l3.6-3.6c1.5-.4 3 .2 3.5 1.2.4 1-.2 2.4-1.2 3.4l-2.5 2.5z" fill="currentColor" stroke="none"/><path d="M3.5 20.5l2-2"/>',
  hoe: '<path d="M5 20 16.5 8.5" stroke-width="2.3"/><path d="M14.6 6.6l3.6-3 2.4 2.4-2.6 4.6z" fill="currentColor" stroke="none"/>',
  sword: '<path d="M20.5 3.5 19 8.2 9.2 18l-3.2-3.2 9.8-9.8z" fill="currentColor" stroke="none"/><path d="M4.8 12.8l6.4 6.4M3.4 20.6l3-3" stroke-width="2.1"/>',
  knife: '<path d="M19.5 4.5c-3 1-7.6 5.4-9.8 8.4l1.4 1.4c3-2.2 7.4-6.8 8.4-9.8z" fill="currentColor" stroke="none"/><path d="M10.4 13.6 5 19" stroke-width="2.6"/>',
  spear: '<path d="M4 20 17 7" stroke-width="2"/><path d="M15.6 5.2 20.5 3.5l-1.7 4.9-2.1.4z" fill="currentColor" stroke="none"/>',
  mace: '<path d="M5 19.5 13 11.5" stroke-width="2.4"/><circle cx="15.5" cy="8.5" r="3.6" fill="currentColor" stroke="none"/>',
  hammer: '<path d="M4.6 20.4 13.8 11.2" stroke-width="2.5"/><path d="M10.6 4.6l4.2-1.6 6.2 6.2-1.6 4.2-2.6-2.6-2 2-4.2-4.2 2-2z" fill="currentColor" stroke="none"/>',
  rifle: '<path d="M1.8 12.6h11.4l2-2h6.2v2.6h-2.1l-1 1.6h-3.1l-1.6 3.2H11l1-3.2H6.2l-1.6 2.1H1.8z" fill="currentColor" stroke="none"/><path d="M15.4 10.6V9h3.2"/>',
  pistol: '<path d="M4 8h15v3.4h-7.2l-1.4 1.8.8 5.8H7.4L6.6 13H4z" fill="currentColor" stroke="none"/>',
  shotgun: '<path d="M1.5 11.8h15l1.5-1.5h4.5v2.2h-4l-1 1.5h-3.5l-2 3.5H8.6l1.2-3.5H5.5L4 16H1.5z" fill="currentColor" stroke="none"/>',
  sniper: '<path d="M1.5 12.8h12l2-2h7v2.4h-2.5l-1 1.5h-3l-1.6 3.1H10.6l1-3.1H6l-1.6 2H1.5z" fill="currentColor" stroke="none"/><rect x="8" y="8.2" width="6" height="2.2" rx="1" fill="currentColor" stroke="none"/>',
  bow: '<path d="M7 3.5c7 3 7 14 0 17" stroke-width="2.2"/><path d="M7 3.5v17" stroke-width="1"/><path d="M5 12h13M15.5 9.5 18 12l-2.5 2.5"/>',
  rod: '<path d="M4 20 19 4" stroke-width="1.8"/><path d="M19 4c1 6 0 10-3 13" stroke-width="1"/><circle cx="7" cy="17" r="1.6"/>',
  torch: '<path d="M9 21 13 11" stroke-width="2.6"/><path d="M14.5 3c1 2.6 3.6 3.8 3 7a3.6 3.6 0 0 1-7 0c0-1.6 1-2.6 1.8-3.4.2 1.3.8 2 1.6 2.2C13.6 7 14 5 14.5 3z" fill="currentColor" stroke="none"/>',
  bag: '<path d="M8.5 6.2V5a3.5 3.5 0 0 1 7 0v1.2"/><rect x="5" y="6.2" width="14" height="15" rx="3.6"/><path d="M8.8 14.2h6.4v4H8.8zM5 11h14"/>',
  wood: '<g fill="currentColor" stroke="none"><circle cx="7" cy="16.5" r="3.3"/><circle cx="15.5" cy="16.5" r="3.3"/><circle cx="11.2" cy="9.6" r="3.3"/></g><g stroke="rgba(0,0,0,.45)" stroke-width="1"><circle cx="7" cy="16.5" r="1.4"/><circle cx="15.5" cy="16.5" r="1.4"/><circle cx="11.2" cy="9.6" r="1.4"/></g>',
  stone: '<path d="M3.6 17.4 6.2 10l5.2-3.2 6.2 2.1 2.8 6.4-3.6 3.1H7.2z" fill="currentColor" stroke="none"/><path d="M6.2 10l4 3.4 7.4-4.5M10.2 13.4l-1 5.1" stroke="rgba(0,0,0,.4)" stroke-width="1"/>',
  gem: '<path d="M6 4h12l3.5 5L12 21 2.5 9z" fill="currentColor" stroke="none"/><path d="M2.5 9h19M9 4l-1.5 5L12 21l4.5-12L15 4" stroke="rgba(0,0,0,.35)" stroke-width="1"/>',
  crop: '<path d="M12 21V6" stroke-width="1.8"/><g fill="currentColor" stroke="none"><ellipse cx="9.6" cy="8" rx="1.6" ry="2.6" transform="rotate(-25 9.6 8)"/><ellipse cx="14.4" cy="8" rx="1.6" ry="2.6" transform="rotate(25 14.4 8)"/><ellipse cx="9.6" cy="12.5" rx="1.6" ry="2.6" transform="rotate(-25 9.6 12.5)"/><ellipse cx="14.4" cy="12.5" rx="1.6" ry="2.6" transform="rotate(25 14.4 12.5)"/><ellipse cx="12" cy="4.2" rx="1.4" ry="2.4"/></g>',
  seed: '<g fill="currentColor" stroke="none"><ellipse cx="8" cy="10" rx="2" ry="3" transform="rotate(-30 8 10)"/><ellipse cx="15" cy="8.5" rx="2" ry="3" transform="rotate(20 15 8.5)"/><ellipse cx="11.5" cy="16" rx="2" ry="3" transform="rotate(70 11.5 16)"/></g>',
  meat: '<path d="M14.5 4.5c3.5 0 6 2.6 5 6.2-.9 3-4.5 5.5-7.6 5.6l-3.4 3.4a1.8 1.8 0 1 1-2.5-2.5l3.4-3.4c.1-3.4 1.6-9.3 5.1-9.3z" fill="currentColor" stroke="none"/>',
  fish: '<path d="M3 12c3-4.5 9-6 13-2.5L21 6v12l-5-3.5C12 18 6 16.5 3 12z" fill="currentColor" stroke="none"/><circle cx="7.5" cy="11" r="1" fill="#111" stroke="none"/>',
  ingot: '<path d="M3 17l3-7h12l3 7z" fill="currentColor" stroke="none"/><path d="M6 10l1.5-3.5h9L18 10" stroke-width="1.2"/>',
  dye: '<path d="M12 3c3.5 4.5 6 7.6 6 11a6 6 0 0 1-12 0c0-3.4 2.5-6.5 6-11z" fill="currentColor" stroke="none"/>',
  detector: '<path d="M6 20 15 7" stroke-width="2"/><ellipse cx="17" cy="5.5" rx="3.6" ry="1.8" transform="rotate(-35 17 5.5)" fill="currentColor" stroke="none"/><rect x="5" y="15" width="3" height="4" rx="1" fill="currentColor" stroke="none"/>',
  can: '<path d="M6 9h9v10H6z" fill="currentColor" stroke="none"/><path d="M15 11l5-4M8 9a2.5 2.5 0 0 1 5 0"/>',
  map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" fill="currentColor" stroke="none" opacity=".85"/><path d="M14 9l3 3m0-3-3 3" stroke="#a22" stroke-width="1.6"/>',
  shirt: '<path d="M8 3.5 3.5 6.5l2 4L7.5 9.5V20h9V9.5l2 1 2-4L16 3.5c-.6 1.5-2.1 2.4-4 2.4S8.6 5 8 3.5z" fill="currentColor" stroke="none"/>',
  pants: '<path d="M7 3h10l1.5 18h-4.2L12 10l-2.3 11H5.5z" fill="currentColor" stroke="none"/>',
  shoe: '<path d="M3 16.5V11l4 1 3-5 3 1-1.5 4 7.5 2.5c1.4.5 2 1.4 2 2.6V18H3z" fill="currentColor" stroke="none"/>',
  glove: '<path d="M7 20V9.5a1.4 1.4 0 0 1 2.8 0V8a1.4 1.4 0 0 1 2.8 0v.5a1.4 1.4 0 0 1 2.8 0V10a1.4 1.4 0 0 1 2.8 0v5c0 3-2 5-5 5z" fill="currentColor" stroke="none"/>',
  hat: '<path d="M6 15c0-5 2.6-9 6-9s6 4 6 9z" fill="currentColor" stroke="none"/><path d="M3 15.5h18" stroke-width="2.4"/>',
  helmet: '<path d="M4 15c0-5.5 3.6-9.5 8-9.5s8 4 8 9.5z" fill="currentColor" stroke="none"/><path d="M3 15.5h18M8 15.5v3" stroke-width="1.8"/>',
  vest: '<path d="M7 3.5l2.5 2h5l2.5-2 2 3V20H5V6.5z" fill="currentColor" stroke="none"/><path d="M12 6v14M8 12h2.5M13.5 12H16" stroke="rgba(0,0,0,.4)" stroke-width="1"/>',
  glasses: '<circle cx="7" cy="13" r="3.4" fill="currentColor" stroke="none"/><circle cx="17" cy="13" r="3.4" fill="currentColor" stroke="none"/><path d="M10.4 12.5h3.2M3.6 12 2 8.5M20.4 12 22 8.5"/>',
  person: '<circle cx="12" cy="6.5" r="3.4" fill="currentColor" stroke="none"/><path d="M5 21c0-4.4 3.1-8 7-8s7 3.6 7 8z" fill="currentColor" stroke="none"/>',
  food: '<path d="M3 11h18a9 9 0 0 1-18 0z" fill="currentColor" stroke="none"/><path d="M9 7.5c0-1.5 1.4-1.5 1.4-3M13.4 7.5c0-1.5 1.4-1.5 1.4-3"/>',
  med: '<rect x="3" y="6" width="18" height="13" rx="2.5" fill="currentColor" stroke="none"/><path d="M12 9v7M8.5 12.5h7" stroke="#fff" stroke-width="2.4"/>',
  wall: '<path d="M3 20V8h18v12z" fill="currentColor" stroke="none" opacity=".8"/><path d="M3 12h18M3 16h18M8 8v4M15 8v4M11 12v4M6 16v4M17 16v4" stroke="rgba(0,0,0,.45)" stroke-width="1"/>',
  station: '<path d="M3 9h14l3 3H8z" fill="currentColor" stroke="none"/><path d="M9 12v4h-3l-1 4h12l-1-4h-3v-4"/>',
  furn: '<path d="M6 3v9h11v9M6 12v9M6 15h11" stroke-width="2.2"/>',
  lamp: '<path d="M9 5h6l1 3H8z" fill="currentColor" stroke="none"/><rect x="8.5" y="8" width="7" height="9" rx="1.5" fill="currentColor" stroke="none" opacity=".75"/><path d="M12 2v3M9 20h6M12 17v3"/>',
  flower: '<path d="M12 21V12" stroke-width="1.8"/><g fill="currentColor" stroke="none"><circle cx="12" cy="6" r="2.4"/><circle cx="8.5" cy="8.5" r="2.4"/><circle cx="15.5" cy="8.5" r="2.4"/><circle cx="10" cy="11.5" r="2.4"/><circle cx="14" cy="11.5" r="2.4"/></g><circle cx="12" cy="9" r="1.6" fill="#ffd76a" stroke="none"/>',
  rug: '<rect x="3" y="6" width="18" height="12" rx="1.5" fill="currentColor" stroke="none"/><rect x="6.5" y="9" width="11" height="6" rx="1" stroke="rgba(255,255,255,.6)"/>',
  flag: '<path d="M5 21V3" stroke-width="2"/><path d="M5 4h13l-3 4 3 4H5z" fill="currentColor" stroke="none"/>',
  deco: '<path d="M12 3l2.6 6 6.4.6-4.8 4.2 1.5 6.3L12 16.8 6.3 20.1l1.5-6.3L3 9.6l6.4-.6z" fill="currentColor" stroke="none"/>',
  ammo: '<g fill="currentColor" stroke="none"><path d="M5 9c0-3 1-5 2-5s2 2 2 5v11H5z"/><path d="M10.5 9c0-3 1-5 2-5s2 2 2 5v11h-4z"/><path d="M16 9c0-3 1-5 2-5s2 2 2 5v11h-4z"/></g>',
  arrow: '<path d="M4 20 18 6" stroke-width="1.8"/><path d="M15 5h4v4" stroke-width="2"/><path d="M4 20l1-4M4 20l4-1"/>',
  item: '<path d="M4 8l8-4 8 4v9l-8 4-8-4z" fill="currentColor" stroke="none" opacity=".85"/><path d="M4 8l8 4 8-4M12 12v9" stroke="rgba(0,0,0,.35)" stroke-width="1"/>',
  coin: '<circle cx="12" cy="12" r="8.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="5.6" stroke="rgba(0,0,0,.35)" stroke-width="1.2"/>',
  campfire: '<path d="M12 3c1 3 4.2 4.6 4.2 8.6a4.2 4.2 0 0 1-8.4 0c0-2 1-3.2 2.1-4.2 0 1.6.8 2.5 1.8 2.7C11 8 11.5 5.4 12 3z" fill="currentColor" stroke="none"/><path d="M4.5 20.5 19.5 17M4.5 17l15 3.5" stroke-width="2"/>',
  boat: '<path d="M2.6 14h18.8l-3.2 5.6H5.8z" fill="currentColor" stroke="none"/><path d="M12 14V3.6l6.4 8.4H12"/>',
  car: '<path d="M4 15.2 5.6 10a2 2 0 0 1 1.9-1.4h9a2 2 0 0 1 1.9 1.4l1.6 5.2v3.2h-2.4M6.4 18.4H4v-3.2"/><circle cx="7.6" cy="17.8" r="1.9"/><circle cx="16.4" cy="17.8" r="1.9"/><path d="M5 13.4h14"/>',
  horse: '<path d="M6 20v-6l-2-3 3-5 4 1 3-3 2 3-1 3 4 3v7h-2v-4h-7v4z" fill="currentColor" stroke="none"/>',
  place: '<path d="M5 12.6l4.6 4.6L19.2 7.6" stroke-width="2.7"/>',
  rotate: '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/>',
  close: '<path d="M6 6l12 12M18 6 6 18" stroke-width="2.4"/>',
  exit: '<path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14"/><path d="M10 8l-4 4 4 4M6 12h9.5"/>',
  shop: '<path d="M4 9l1.5-5h13L20 9v1.5a2.7 2.7 0 0 1-5.3 0 2.7 2.7 0 0 1-5.4 0 2.7 2.7 0 0 1-5.3 0z" fill="currentColor" stroke="none"/><path d="M5 12v8h14v-8M10 20v-5h4v5"/>',
  talk: '<path d="M4 5h16v10H9l-5 4z" fill="currentColor" stroke="none"/>',
  sleep: '<path d="M3 18V8M3 14h18v4M7 11h6a3 3 0 0 1 3 3" stroke-width="2"/>',
  open: '<path d="M4 9h16v10H4z" fill="currentColor" stroke="none"/><path d="M4 9l2-4h12l2 4M10 13h4"/>',
};
const svg = (k, cls = '', color) => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${color ? ` style="color:${color}"` : ''}>${ICON[k] || ICON.item}</svg>`;
const hexCss = (h) => '#' + (h >>> 0).toString(16).padStart(6, '0');
const iconCol = (h) => { const c = C(h || 0xd8c9a6).clone(), l = c.r * 0.3 + c.g * 0.59 + c.b * 0.11; if (l < 0.3) c.lerp(new THREE.Color(1, 1, 1), 0.45 - l); return '#' + c.getHexString(); };
const itemIcon = (it) => svg(ICON[it.icon] ? it.icon : it.tool && ICON[it.tool] ? it.tool : 'item', '', it.cat === 'tool' || it.cat === 'weapon' ? null : iconCol(it.color));
const ESSENTIAL = ['plank', 'rope', 'f_campfire', 'f_workbench', 'torch', 'axe_stone', 'pickaxe_stone', 'shovel_stone', 'hammer_stone', 'sword_wood', 'spear_wood', 'bandage', 'b_foundation_wood', 'b_wall_wood', 'b_wall_door_wood', 'b_door_wood', 'b_floor_wood', 'b_roof_wood', 'f_chest_small_oak', 'f_bed_oak', 'f_furnace', 'charcoal', 'iron', 'f_anvil', 'axe_iron', 'pickaxe_iron', 'cooked_beef', 'bread', 'leather', 'cloth', 'f_tailor', 'f_loom', 'v_raft', 'rod_wood'];
const ESS_RANK = new Map(ESSENTIAL.map((id, i) => [id, i]));

/* ── hotbar (bottom centre): six slots you fill from the bag, then the backpack ── */
const hotbarEl = $('hotbar'), slots = [];
for (let i = 0; i < 6; i++) {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'slot';
  tap(b, () => pickSlot(i)); hotbarEl.insertBefore(b, $('bagBtn')); slots.push(b);
}
let slotSig = '';
function renderSlots() {
  const sig = INV.slots.join('|') + player.toolItem + INV.slots.map((s) => ownsTool(s) ? 1 : 0).join('');
  if (sig === slotSig) return; slotSig = sig;
  slots.forEach((b, i) => {
    const id = INV.slots[i], it = id && id !== 'hand' ? ITEMS[id] : null;
    b.dataset.tool = it ? it.tool || 'hand' : 'hand';
    b.setAttribute('aria-label', it ? it.name : 'اليد');
    b.innerHTML = (it ? svg(ICON[it.tool] ? it.tool : it.icon, '', it.tier ? hexCss(TIER_METAL[it.tier] || 0xd8d8d8) : null) : svg('hand')) + `<i>${toAr(i + 1)}</i><b class="lock" aria-hidden="true"></b>`;
    b.classList.toggle('sel', player.toolItem === id); b.classList.toggle('locked', !!id && !ownsTool(id));
  });
}
function pickSlot(i) {
  if (player.vehicle) return;
  const id = INV.slots[i]; if (!id) return;
  if (BUILD.ghost) cancelBuild();
  selectSlot(i); slotSig = '';
}
$('bagBtn').innerHTML = svg('bag') + '<span id="bagFill"></span>';
tap($('bagBtn'), () => (craftOpen ? closeCraft() : openCraft()));
$('resWoodI').innerHTML = svg('wood'); $('resStoneI').innerHTML = svg('stone');

/* ── the bag: crafting, inventory (with a stash when one is open), the shop, the wardrobe ── */
const BAG = { tab: 'craft', cat: 'all', q: '', more: 0, stash: null };
const listEl = $('craftList'), catsEl = $('bagCats'), noteEl = $('bagNote'), searchEl = $('bagSearch');
$('craftWoodI').innerHTML = svg('wood'); $('craftStoneI').innerHTML = svg('stone'); $('craftCoinI').innerHTML = svg('coin'); $('craftClose').innerHTML = svg('close');
for (const t of document.querySelectorAll('#bagTabs [data-tab]')) t.addEventListener('click', () => { BAG.tab = t.dataset.tab; BAG.cat = BAG.tab === 'shop' ? (SHOP.mode || 'buy') : 'all'; BAG.more = 0; renderBag(true); });
searchEl.addEventListener('input', () => { BAG.q = searchEl.value.trim(); BAG.more = 0; renderBag(true); });
searchEl.addEventListener('keydown', (e) => e.stopPropagation());
const STATION_OF = (r) => r.station ? (nearStation(r.station) ? '' : 'تحتاج ' + STATION_AR[r.station]) : '';
const NEED_TXT = ([id, n]) => toAr(n) + ' ' + (ITEMS[id] ? ITEMS[id].name : id);
function chips(arr, cur) { catsEl.innerHTML = ''; for (const [k, label] of arr) { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.setAttribute('aria-pressed', String(k === cur)); b.addEventListener('click', () => { BAG.cat = k; BAG.more = 0; if (BAG.tab === 'shop') SHOP.mode = k; renderBag(true); }); catsEl.append(b); } }
function card(it, body, buttons, cls = '') {
  const el = document.createElement('div'); el.className = 'rcard ' + cls;
  el.innerHTML = `<div class="ricon">${itemIcon(it)}</div><div class="rbody">${body}</div><div class="rb2"></div>`;
  const box = el.querySelector('.rb2');
  for (const [label, fn, opts = {}] of buttons) { const b = document.createElement('button'); b.type = 'button'; b.className = 'rbtn' + (opts.alt ? ' alt' : ''); b.textContent = label; b.disabled = !!opts.disabled; if (opts.title) b.title = opts.title; b.addEventListener('click', (e) => { e.stopPropagation(); fn(); renderBag(true); }); box.append(b); }
  return el;
}
const match = (it) => (!BAG.q || it.name.includes(BAG.q) || it.id.includes(BAG.q));
const PAGE = 60;
function moreButton(n) { if (n <= 0) return; const b = document.createElement('button'); b.type = 'button'; b.className = 'ghost'; b.textContent = 'عرض المزيد (' + toAr(n) + ')'; b.addEventListener('click', () => { BAG.more += PAGE; renderBag(true); }); listEl.append(b); }
function useLabel(it) {
  if (it.food) return 'كُل'; if (it.heal) return 'عالج'; if (['water', 'milk', 'honey'].includes(it.id)) return 'اشرب'; if (it.mapItem) return 'افتح';
  if (it.seed || it.sapling) return 'ازرع'; if (it.build || it.place || it.vehicle) return 'ضع'; if (it.wear) return Object.values(INV.wearing).includes(it.id) ? 'ملبوس' : 'البس';
  if (it.attach) return 'ركّب';
  if (it.tool || it.gun) return player.toolItem === it.id ? 'في يدك' : 'امسك'; return '';
}
/* fit an attachment: to the gun in your hand if it takes it, else to the first gun you carry that does */
function fitAttachment(aid) {
  const guns = [player.toolItem, ...INV.items.keys()].filter((id) => ITEMS[id] && ITEMS[id].gun);
  for (const g of guns) if (canAttach(gunOf(ITEMS[g]), aid)) return attachTo(g, aid);
  toast('لا سلاح معك يركب عليه ' + ITEMS[aid].name, ''); return false;
}
/* a gun's card: what it is, and its five places for attachments */
function gunCard(it, n) {
  const w = gunOf(it), at = attOf(it.id), sp = gunSpecOf(it.id);
  const stats = `${GUN_CLASS[w.cls].name} · ${AMMO_AR[w.ammo] || ''} · ضرر ${toAr(w.dmg)}${w.pellets > 1 ? '×' + toAr(w.pellets) : ''} · مخزن ${toAr(sp.mag)}`;
  const el = card(it, `<b>${it.name}${n > 1 ? ' <span class="cnt">×' + toAr(n) + '</span>' : ''}</b><span>${stats}</span>`, []);
  const box = document.createElement('div'); box.className = 'att-slots';
  for (const slot of gunSlots(w)) {
    const cur = at[slot], chip = document.createElement('button'); chip.type = 'button'; chip.className = 'att-chip' + (cur ? ' on' : '');
    const fits = [...INV.items.keys()].filter((id) => ITEMS[id] && ITEMS[id].attach === slot && canAttach(w, id));
    chip.innerHTML = `<small>${GSLOT_AR[slot]}</small><b>${cur ? ITEMS[cur].name : fits.length ? '+ ' + toAr(fits.length) : '—'}</b>`;
    chip.disabled = !cur && !fits.length;
    chip.addEventListener('click', (e) => { e.stopPropagation(); if (cur) detachFrom(it.id, slot); else if (fits.length) attachTo(it.id, fits.sort((a, b) => (ATTACH_DEF[b].zoom || 0) - (ATTACH_DEF[a].zoom || 0))[0]); renderBag(true); });
    box.append(chip);
  }
  el.querySelector('.rbody').append(box);
  return el;
}
let slotRot = 0;
function toHotbar(id) {
  if (INV.slots.includes(id)) { toast('في الشريط بالفعل', 'الخانة ' + toAr(INV.slots.indexOf(id) + 1)); return; }
  let i = INV.slots.findIndex((s, k) => k > 0 && (!s || !ownsTool(s)));
  if (i < 0) { i = 1 + (slotRot++ % 5); }
  assignSlot(i, id); slotSig = ''; toast('وضعت ' + ITEMS[id].name + ' في الخانة ' + toAr(i + 1), 'اضغط ' + toAr(i + 1) + ' لتمسكه');
}
function renderBag(force) {
  if (!craftOpen) return;
  $('craftWood').textContent = toAr(invCount('wood')); $('craftStone').textContent = toAr(invCount('stone')); $('craftCoin').textContent = toAr(INV.coins);
  const load = bagLoad(), cap = bagCap();
  $('craftLoad').textContent = toAr(load) + ' / ' + toAr(cap); $('craftLoadBar').style.transform = `scaleX(${Math.min(1, load / cap)})`;
  for (const t of document.querySelectorAll('#bagTabs [data-tab]')) t.setAttribute('aria-selected', String(t.dataset.tab === BAG.tab));
  if (!force) return;
  listEl.innerHTML = ''; noteEl.textContent = '';
  if (BAG.tab === 'craft') {
    chips(CATS.filter(([k]) => k !== 'treasure'), BAG.cat);
    const rs = RECIPES.filter((r) => { const it = ITEMS[r.id]; return it && (BAG.cat === 'all' || it.cat === BAG.cat) && match(it); });
    const scored = rs.map((r) => [r, canCraft(r) ? 0 : missingFor(r).length ? 2 : 1, ESS_RANK.has(r.id) ? ESS_RANK.get(r.id) : 999]).sort((a, b) => a[1] - b[1] || a[2] - b[2]);
    noteEl.textContent = scored.filter((s) => s[1] === 0).length ? 'تستطيع صنع ' + toAr(scored.filter((s) => s[1] === 0).length) + ' شيئاً الآن' : 'اجمع الخشب والحجر والألياف لتبدأ · بعض الوصفات تحتاج طاولة عمل أو فرناً أو ناراً قريبة';
    for (const [r] of scored.slice(0, PAGE + BAG.more)) {
      const it = ITEMS[r.id], miss = new Map(missingFor(r)), st = STATION_OF(r), have = isCosmetic(it) && ownsWear(it.id), can = !miss.size && !st && !have;
      const cost = r.needs.map((nd) => `<em class="${miss.has(nd[0]) ? 'short' : 'ci'}">${NEED_TXT(nd)}</em>`).join('') + (r.station ? `<em class="${st ? 'short' : 'cn'}">${STATION_AR[r.station]}</em>` : '');
      listEl.append(card(it, `<b>${it.name}${r.out > 1 ? ' <span class="cnt">×' + toAr(r.out) + '</span>' : ''}</b><span>${(CATS.find((c) => c[0] === it.cat) || ['', ''])[1]}${invCount(r.id) ? ' · معك ' + toAr(invCount(r.id)) : ''}</span><div class="cost">${cost}</div>`,
        [[have ? 'في خزانتك' : 'اصنع', () => craftItem(r.id), { disabled: !can, title: have ? 'لديك هذه القطعة' : st || (miss.size ? 'ينقصك مواد' : '') }], ...(can && !it.wear && r.needs.every(([id, n]) => invCount(id) >= n * 5) ? [['×٥', () => { for (let k = 0; k < 5; k++) if (!craftItem(r.id)) break; }, { alt: true }]] : [])], can ? 'can' : ''));
    }
    moreButton(scored.length - PAGE - BAG.more);
  } else if (BAG.tab === 'inv') {
    chips(CATS, BAG.cat);
    const st = BAG.stash && Math.hypot(BAG.stash.x - player.pos.x, BAG.stash.z - player.pos.z) < 3 ? BAG.stash : null; if (!st) BAG.stash = null;
    if (st) {
      const cap = STORE_CAP[placeKind(ITEMS[st.id])] || 60, used = Object.entries(st.items).reduce((s, [id, n]) => s + (ITEMS[id] ? ITEMS[id].w * n : 0), 0);
      noteEl.textContent = ITEMS[st.id].name + ': ' + toAr(Math.round(used)) + ' / ' + toAr(cap) + ' · خزّن ما لا تحتاجه وخذه متى شئت';
      for (const [id, n] of Object.entries(st.items)) { const it = ITEMS[id]; if (!it || n <= 0) continue; listEl.append(card(it, `<b>${it.name} <span class="cnt">×${toAr(n)}</span></b><span>في الصندوق</span>`, [['خذ', () => { const k = invAdd(id, n, true); st.items[id] -= k; if (st.items[id] <= 0) delete st.items[id]; if (typeof saveSoon === 'function') saveSoon(); }]], 'sel')); }
    } else noteEl.textContent = 'المال: ' + toAr(INV.coins) + ' دينار · الحمولة ' + toAr(load) + ' من ' + toAr(cap);
    const own = [...INV.items.entries()].map(([id, n]) => [ITEMS[id], n]).filter(([it]) => it && (BAG.cat === 'all' || it.cat === BAG.cat) && match(it)).sort((a, b) => CATS.findIndex((c) => c[0] === a[0].cat) - CATS.findIndex((c) => c[0] === b[0].cat) || a[0].name.localeCompare(b[0].name, 'ar'));
    if (!own.length) listEl.append(Object.assign(document.createElement('p'), { className: 'credits', textContent: 'لا شيء هنا بعد. اقطع الشجر واكسر الصخر واحفر، وافتح الصناديق في البيوت.' }));
    for (const [it, n] of own.slice(0, PAGE + BAG.more)) {
      const btns = [], ul = useLabel(it);
      if (ul) btns.push([ul, () => { if (it.attach) fitAttachment(it.id); else if (it.tool || it.gun) { if (!INV.slots.includes(it.id)) toHotbar(it.id); equip(it.id); } else useItem(it.id); }, { disabled: ul === 'ملبوس' || ul === 'في يدك' }]);
      if (it.tool || it.gun) btns.push(['للشريط', () => toHotbar(it.id), { alt: true }]);
      if (st) btns.push(['خزّن', () => { const k = Math.min(n, 999); invTake(it.id, k); st.items[it.id] = (st.items[it.id] || 0) + k; if (Object.values(INV.wearing).includes(it.id)) { for (const [s, w] of Object.entries(INV.wearing)) if (w === it.id) delete INV.wearing[s]; applyOutfit(); } if (player.toolItem === it.id) equip('hand'); if (typeof saveSoon === 'function') saveSoon(); }, { alt: true }]);
      else btns.push(['ارمِ', () => { if (it.gun && invCount(it.id) === 1) for (const sl of Object.keys(GSLOT_AR)) detachFrom(it.id, sl); invTake(it.id, 1); dropItems(player.pos.x + Math.sin(player.yaw) * 1.2, player.pos.y, player.pos.z + Math.cos(player.yaw) * 1.2, [[it.id, 1]], { life: 600 }); if (player.toolItem === it.id && !invCount(it.id)) equip('hand'); }, { alt: true }]);
      if (it.gun && it.gunId) { const c = gunCard(it, n), b2 = c.querySelector('.rb2'); for (const [label, fn, opts = {}] of btns) { const b = document.createElement('button'); b.type = 'button'; b.className = 'rbtn' + (opts.alt ? ' alt' : ''); b.textContent = label; b.disabled = !!opts.disabled; b.addEventListener('click', (e) => { e.stopPropagation(); fn(); renderBag(true); }); b2.append(b); } listEl.append(c); continue; }
      listEl.append(card(it, `<b>${it.name} <span class="cnt">×${toAr(n)}</span></b><span>${(CATS.find((c) => c[0] === it.cat) || ['', ''])[1]} · ${toAr(Math.round(it.w * n * 10) / 10)} حمولة${it.drink ? ' · +' + toAr(it.drink) + ' ماء' : it.food ? ' · +' + toAr(Math.round(it.food * 2.2)) + ' شبع' : it.heal ? ' · +' + toAr(it.heal) + ' صحة' : ''}${it.attach ? ' · ' + GSLOT_AR[it.attach] : ''}</span>`, btns));
    }
    moreButton(own.length - PAGE - BAG.more);
  } else if (BAG.tab === 'shop') {
    if (!shopValid()) {
      catsEl.innerHTML = ''; noteEl.textContent = 'ادخل متجراً واقترب من البائع لتشتري وتبيع. المتاجر القريبة:';
      const known = SETTLEMENTS.flatMap((S) => (S.src.buildings || []).filter((o) => o.shop).map((o) => [o, Math.hypot(o.x - player.pos.x, o.z - player.pos.z), S])).sort((a, b) => a[1] - b[1]).slice(0, 12);
      for (const [o, d, S] of known) { const el = document.createElement('div'); el.className = 'rcard'; el.innerHTML = `<div class="ricon">${svg('shop', '', '#ffd76a')}</div><div class="rbody"><b>${o.name || SHOP_NAME[o.shop] || 'متجر'}</b><span>${S.name} · ${d < 1000 ? toAr(Math.round(d)) + ' م' : toAr(Math.round(d / 100) / 10) + ' كم'}</span></div>`; listEl.append(el); }
      return;
    }
    const kind = SHOP.spot.kind, sname = SHOP.spot.name || SHOP_NAME[kind];
    chips(kind === 'cars' ? [['buy', 'شراء']] : [['buy', 'شراء'], ['sell', 'بيع']], SHOP.mode);
    noteEl.textContent = sname + ' · معك ' + toAr(INV.coins) + ' دينار';
    if (kind === 'cars') {
      for (const [k, price] of CAR_PRICES) { const s = VSPEC[k]; const fake = { icon: s.water ? 'boat' : 'car', color: 0x9fe0ff, name: s.name, cat: 'vehicle' }; listEl.append(card(fake, `<b>${s.name}</b><span>أقصى سرعة ${toAr(Math.round(s.max * 3.6))} كم/س</span><div class="cost"><em class="${INV.coins < price ? 'short' : 'cc'}">${svg('coin')}${toAr(price)}</em></div>`, [['اشترِ', () => buyCar(k, price), { disabled: INV.coins < price }]], INV.coins >= price ? 'can' : '')); }
      return;
    }
    if (SHOP.mode === 'sell') {
      const own = [...INV.items.entries()].filter(([id]) => shopBuys(kind, id) && match(ITEMS[id]));
      if (!own.length) noteEl.textContent = 'هذا المتجر لا يشتري شيئاً مما معك';
      for (const [id, n] of own.slice(0, PAGE + BAG.more)) { const it = ITEMS[id], p = sellPrice(it, kind); listEl.append(card(it, `<b>${it.name} <span class="cnt">×${toAr(n)}</span></b><div class="cost"><em class="cc">${svg('coin')}${toAr(p)}</em></div>`, [['بِع', () => sellItem(id, 1)], ...(n > 1 ? [['الكل', () => sellItem(id, n), { alt: true }]] : [])])); }
      moreButton(own.length - PAGE - BAG.more);
    } else {
      const cat = shopCatalog(kind).map((id) => ITEMS[id]).filter(match);
      for (const it of cat.slice(0, PAGE + BAG.more)) {
        const p = buyPrice(it), have = isCosmetic(it) && ownsWear(it.id), can = INV.coins >= p && !have;
        listEl.append(card(it, `<b>${it.name}${it.wear && it.wear.c !== undefined ? ` <i class="sw" style="background:${hexCss(it.wear.c)}"></i>` : ''}</b><span>${(CATS.find((c) => c[0] === it.cat) || ['', ''])[1]}${have ? ' · في خزانتك' : invCount(it.id) ? ' · معك ' + toAr(invCount(it.id)) : ''}</span><div class="cost"><em class="${can || have ? 'cc' : 'short'}">${svg('coin')}${toAr(p)}</em></div>`,
          [[have ? 'لديك' : 'اشترِ', () => buyItem(it.id, 1), { disabled: !can }], ...((it.food || it.heal || it.cat === 'ammo' || it.seed) && INV.coins >= p * 5 ? [['×٥', () => buyItem(it.id, 5), { alt: true }]] : [])], can ? 'can' : ''));
      }
      moreButton(cat.length - PAGE - BAG.more);
    }
  } else if (BAG.tab === 'wear') {
    catsEl.innerHTML = '';
    noteEl.textContent = 'الحماية: ' + toAr(Math.round((1 - ARMOR()) * 100)) + '٪ · الحقيبة تتسع ' + toAr(bagCap()) + ' · ملابسك في خزانتك للأبد، والخوذ والسترات والحقائب لهذه الحياة';
    const grid = document.createElement('div'); grid.className = 'wear-slots';
    for (const [slot, label] of WEAR_SLOTS) {
      const id = INV.wearing[slot], it = id && ITEMS[id];
      const el = document.createElement('div'); el.className = 'rcard' + (it ? ' sel' : '');
      el.innerHTML = `<div class="ricon">${it ? itemIcon(it) : svg(slot === 'body' ? 'person' : 'item', '', '#666')}</div><div class="rbody"><b>${label}</b><span>${it ? it.name : slot === 'body' ? 'هيئة الجندي' : 'لا شيء'}</span></div>`;
      if (it) { const b = document.createElement('button'); b.type = 'button'; b.className = 'rbtn alt'; b.textContent = 'انزع'; b.addEventListener('click', () => { takeOff(slot); renderBag(true); }); el.append(b); }
      grid.append(el);
    }
    listEl.append(grid);
    const own = [...new Set([...ACCOUNT.wardrobe, ...INV.items.keys()])].map((id) => ITEMS[id]).filter((it) => it && it.wear && match(it) && it.id !== 'outfit_soldier');
    for (const it of own) { const worn = Object.values(INV.wearing).includes(it.id); listEl.append(card(it, `<b>${it.name}${it.wear.c !== undefined ? ` <i class="sw" style="background:${hexCss(it.wear.c)}"></i>` : ''}</b><span>${(WEAR_SLOTS.find((s) => s[0] === it.wear.slot) || ['', ''])[1]}${it.wear.armor ? ' · حماية ' + toAr(Math.round((1 - it.wear.armor) * 100)) + '٪' : ''}${it.wear.cap ? ' · +' + toAr(it.wear.cap) + ' حمولة' : ''}</span>`, [[worn ? 'ملبوس' : 'البس', () => wearItem(it.id), { disabled: worn }]], worn ? 'sel' : '')); }
    if (!own.length) listEl.append(Object.assign(document.createElement('p'), { className: 'credits', textContent: 'لا ملابس معك بعد. اشترِ من متجر اللوبي بالذهب أو من متجر الأزياء في المدينة، أو اخِط بنفسك على طاولة الخياطة.' }));
  }
}
function openCraft(tab, stash) {
  if (!started || player.vehicle || !player.alive) return;
  craftOpen = true; $('craft').classList.remove('gone');
  if (tab) { BAG.tab = tab; BAG.cat = tab === 'shop' ? SHOP.mode || 'buy' : 'all'; BAG.more = 0; }
  BAG.stash = stash || null; if (BAG.tab !== 'shop' && !stash) SHOP.spot = shopValid() ? SHOP.spot : null;
  renderBag(true); input.act = false; if (locked && document.exitPointerLock) document.exitPointerLock();
}
function closeCraft() { craftOpen = false; $('craft').classList.add('gone'); BAG.stash = null; searchEl.blur(); }
$('craftClose').addEventListener('click', closeCraft);
$('craft').addEventListener('click', (e) => { if (e.target.id === 'craft') closeCraft(); });

/* ── floating move stick (left side) ── */
const stick = $('stick'), knob = $('knob'), joy = { x: 0, y: 0, run: false };
let stickId = null, sx0 = 0, sy0 = 0;
const SR = 52;
function stickMove(e) {
  const [lx, ly] = toLocalPt(e.clientX, e.clientY);
  let dx = lx - sx0, dy = ly - sy0; const d = Math.hypot(dx, dy);
  joy.run = d > SR * 1.3;
  if (d > SR) { dx *= SR / d; dy *= SR / d; }
  knob.style.transform = `translate(${dx}px, ${dy}px)`;
  joy.x = dx / SR; joy.y = -dy / SR; stick.classList.toggle('run', joy.run && !player.vehicle);
}
$('moveZone').addEventListener('pointerdown', (e) => {
  e.preventDefault(); if (stickId !== null) return; stickId = e.pointerId;
  try { e.target.setPointerCapture(e.pointerId); } catch (_) {}
  [sx0, sy0] = toLocalPt(e.clientX, e.clientY);
  stick.style.left = (sx0 - hudIn.offsetLeft) + 'px'; stick.style.top = (sy0 - hudIn.offsetTop) + 'px';
  stick.classList.add('live'); stickMove(e);
});
$('moveZone').addEventListener('pointermove', (e) => { if (e.pointerId === stickId) stickMove(e); });
function stickEnd(e) {
  if (e.pointerId !== stickId) return;
  stickId = null; joy.x = joy.y = 0; joy.run = false; knob.style.transform = ''; stick.classList.remove('live', 'run');
  stick.style.left = ''; stick.style.top = '';
}
$('moveZone').addEventListener('pointerup', stickEnd); $('moveZone').addEventListener('pointercancel', stickEnd);

/* ── look: drag on the world (and on the action button), flick inertia, pinch zoom, pointer lock ── */
const looks = new Map(); let pinchD = 0;
const SENS = 0.0052;
const lookK = () => SET.sens * (SCOPE.on ? 0.62 * SET.aimSens / Math.pow(Math.max(1, gunSpec().zoom), 0.75) : input.aim || aiming() ? 0.55 * SET.aimSens : 1) * (camMode === 'fpp' ? 0.8 : 1) * (cam.zoom || 1);
function lookDelta(dxs, dys, dt) {
  const [dx, d0] = toLocal(dxs, dys), dy = SET.invertY ? -d0 : d0, k = lookK();
  cam.tyaw -= dx * SENS * k; cam.tpitch += dy * SENS * 0.8 * k;
  if (dt > 0) { cam.vyaw = lerp(cam.vyaw, -dx * SENS * k / dt, 0.35); cam.vpitch = lerp(cam.vpitch, dy * SENS * 0.8 * k / dt, 0.35); }
}
function lookStart(e, el) { looks.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() }); try { el.setPointerCapture(e.pointerId); } catch (_) {} cam.dragging = true; cam.vyaw = cam.vpitch = 0; }
function lookMove(e) {
  const l = looks.get(e.pointerId); if (!l) return;
  if (looks.size === 2 && e.pointerType === 'touch' && !started) {
    l.x = e.clientX; l.y = e.clientY; const [a, b] = [...looks.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinchD > 0 && camMode === 'tpp') cam.user = clamp(cam.user * pinchD / d, 1.6, 7); pinchD = d; return;
  }
  const now = performance.now(); lookDelta(e.clientX - l.x, e.clientY - l.y, (now - l.t) / 1000);
  l.x = e.clientX; l.y = e.clientY; l.t = now;
}
function lookEnd(e) { looks.delete(e.pointerId); pinchD = 0; if (!looks.size) cam.dragging = false; }
let locked = false;
canvas.addEventListener('pointerdown', (e) => {
  if (!started || paused || ED.on) return;
  if (e.pointerType === 'mouse') {
    if (!locked && canvas.requestPointerLock && !TOUCH) { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (_) {} }
    if (e.button === 0) input.act = true; if (e.button === 2) { input.aim = true; setScope(true); }
  }
  if (!locked) lookStart(e, canvas);
});
canvas.addEventListener('pointermove', (e) => { if (!locked) lookMove(e); });
canvas.addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse') { if (e.button === 0) input.act = false; if (e.button === 2) { input.aim = false; setScope(false); } } lookEnd(e); });
canvas.addEventListener('pointercancel', lookEnd);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('wheel', (e) => { e.preventDefault(); if (ED.on) return; if (camMode === 'tpp') cam.user = clamp(cam.user * (1 + e.deltaY * 0.001), 1.6, 7); }, { passive: false });
document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === canvas; if (!locked) { input.act = false; input.aim = false; } });
document.addEventListener('mousemove', (e) => { if (locked && !paused) { const k = lookK(); cam.tyaw -= e.movementX * 0.0024 * k; cam.tpitch += e.movementY * 0.002 * k * (SET.invertY ? -1 : 1); } });
document.addEventListener('mousedown', (e) => { if (locked) { if (e.button === 0) input.act = true; if (e.button === 2) { input.aim = true; setScope(true); } } });
document.addEventListener('mouseup', (e) => { if (locked) { if (e.button === 0) input.act = false; if (e.button === 2) { input.aim = false; setScope(false); } } });

// many fingers at once (the stick, the look, fire, aim, crouch, lean…): the page itself never zooms or scrolls under them
document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', (e) => { if (started && e.touches.length > 1) e.preventDefault(); }, { passive: false });
/* ── buttons ── */
const btn = (id) => $(id);
/* in-game buttons answer the touch itself: a click never arrives while another finger is down (the stick, the look),
   so every button below works with any number of fingers on the screen */
function tap(el, fn) {
  el.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse' && e.button !== 0) return; e.preventDefault(); e.stopPropagation(); el.classList.add('down'); fn(e); });
  const up = () => el.classList.remove('down');
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('pointerleave', up);
  el.addEventListener('click', (e) => { if (e.detail === 0) fn(e); });       // the keyboard (Enter / Space on a focused button)
}
function holdButton(el, down, up) {
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.classList.add('down'); down(e); });
  const end = (e) => { el.classList.remove('down'); up && up(e); };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('lostpointercapture', end);
}
holdButton(btn('btnAct'), (e) => { input.act = true; lookStart(e, btn('btnAct')); }, (e) => { input.act = false; lookEnd(e); });
btn('btnAct').addEventListener('pointermove', lookMove);
btn('btnAct').innerHTML = ['hand', 'axe', 'pickaxe', 'sword', 'hammer', 'place', 'shovel', 'hoe', 'knife', 'spear', 'rod', 'torch', 'bow'].map((k) => svg(k, 'ic-' + k)).join('') + '<svg class="ic-rifle ic-pistol ic-shotgun ic-sniper" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>';
holdButton(btn('btnJump'), () => { input.jumpPressed = true; input.jumpHeld = true; }, () => { input.jumpHeld = false; });
let sprintToggle = false, flashMode = 'auto';
tap(btn('btnSprint'), () => { sprintToggle = !sprintToggle; if (sprintToggle && player.stance === 'crouch') setStance('stand'); btn('btnSprint').setAttribute('aria-pressed', String(sprintToggle)); });
tap(btn('btnReload'), () => { if (BUILD.ghost) rotateBuild(); else { setScope(false); input.reloadPressed = true; } });
tap(btn('btnLight'), () => { flashMode = flashOn() ? 'off' : 'on'; });
tap(btn('btnUse'), interact);
tap(btn('btnCrouch'), () => setStance('crouch'));
tap(btn('btnProne'), () => setStance('prone'));
tap(btn('btnAim'), () => setScope(!SCOPE.on));
tap(btn('btnPeekL'), () => setLean(-1));
tap(btn('btnPeekR'), () => setLean(1));
tap(btn('btnMode'), () => nextFireMode());
$('useIcon').innerHTML = svg('car', 'ic-in') + svg('exit', 'ic-out') + svg('open', 'ic-act');
$('buildRotate').innerHTML = svg('rotate'); $('buildCancel').innerHTML = svg('close'); $('buildPlace').innerHTML = svg('place');
tap($('buildRotate'), rotateBuild); tap($('buildCancel'), cancelBuild); tap($('buildPlace'), placeBuild);
tap($('camBtn'), toggleCam);
tap($('soundBtn'), () => { AUDIO.setOn(!AUDIO.on); $('soundBtn').setAttribute('aria-pressed', String(AUDIO.on)); });
tap($('pauseBtn'), () => setPaused(true));
$('resumeBtn').addEventListener('click', () => setPaused(false));
$('respawnBtn').addEventListener('click', () => { respawn(); $('death').classList.add('gone'); });
$('dLobbyBtn').addEventListener('click', () => { respawn(); $('death').classList.add('gone'); toLobby(); });
$('pSetBtn').addEventListener('click', () => openSettings());
$('pLobbyBtn').addEventListener('click', () => { setPaused(false); toLobby(); });
/* quality, night and weather: set from the settings */
function setQuality(q) { if (q === QUALITY.level) return; saveNow(); accFlush(); try { localStorage.setItem('rock-island-q4', q); } catch (_) {} location.reload(); }
function setNightMode(m) { ENV.nightMode = m; try { localStorage.setItem('rock-island-night', m); } catch (_) {} if (m === 'off' && (ENV.hour > 19 || ENV.hour < 6) && started) ENV.hour = 7; }
function setWeatherMode(m) { ENV.weatherMode = m; try { localStorage.setItem('rock-island-weather', m === 'rain' ? 'auto' : m); } catch (_) {} if (WEATHER.lock) return; if (m === 'rain') setWeather('rain'); if (m === 'clear') setWeather('clear'); }
let resetArm = 0;
$('resetBtn').addEventListener('click', () => {
  if (performance.now() - resetArm > 3000) { resetArm = performance.now(); $('resetBtn').textContent = 'اضغط مرة ثانية لمسح رحلة الجزيرة'; setTimeout(() => { $('resetBtn').textContent = 'بداية جديدة'; }, 3000); return; }
  wipeSave(); accFlush(); location.reload();
});
function toggleCam() { camMode = camMode === 'fpp' ? 'tpp' : 'fpp'; $('camBtn').setAttribute('aria-pressed', String(camMode === 'fpp')); hudDirty = true; if (camMode === 'fpp') toast('كاميرا الجسد', 'عدسة على صدر الناجي · اضغط مرة أخرى للعودة'); }
function setPaused(v) {
  if (!started) return; paused = v; $('pause').classList.toggle('gone', !v);
  if (v && document.exitPointerLock && locked) document.exitPointerLock();
  input.act = false; if (v) { AUDIO.engine(false); saveNow(); }
}
document.addEventListener('visibilitychange', () => { if (document.hidden && started && player.alive) setPaused(true); });

/* ── keyboard ── */
const keys = new Set();
addEventListener('keydown', (e) => {
  if (e.target === searchEl || (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA'))) return;
  if (settingsOpen) return;               // the settings take the keys (and Escape closes them)
  if (ED.on && !paused) return;            // the world editor has keys of its own (41_editor)
  const a = actionOf(e.code);
  if (e.repeat && (a === 'jump' || a === 'use' || a === 'cam' || a === 'bag' || a === 'crouch' || a === 'prone' || a === 'leanL' || a === 'leanR' || a === 'mode')) { if (a === 'bag') e.preventDefault(); return; }
  keys.add(e.code);
  if (a === 'jump') { input.jumpPressed = true; input.jumpHeld = true; e.preventDefault(); }
  if (!started) return;
  if (a === 'reload') { if (BUILD.ghost) rotateBuild(); else input.reloadPressed = true; }
  if (a === 'light') flashMode = flashOn() ? 'off' : 'on';
  if (a === 'map') toggleChart();
  if (a === 'use') interact();
  if (a === 'cam') toggleCam();
  if (a === 'eat') quickUse();
  if (a === 'crouch') setStance('crouch');
  if (a === 'prone') setStance('prone');
  if (a === 'leanL') setLean(-1);
  if (a === 'leanR') setLean(1);
  if (a === 'mode') nextFireMode();
  if (a === 'bag' || e.code === 'KeyB' || e.code === 'KeyI') { e.preventDefault(); craftOpen ? closeCraft() : openCraft(); }
  const n = /^Digit([1-6])$/.exec(e.code); if (n) pickSlot(+n[1] - 1);
  if (e.code === 'Escape') { if (craftOpen) closeCraft(); else if (chartOpen) toggleChart(false); else if (BUILD.ghost) cancelBuild(); else if (!locked) setPaused(!paused); }
});
addEventListener('keyup', (e) => { keys.delete(e.code); if (actionOf(e.code) === 'jump') input.jumpHeld = false; });
addEventListener('blur', () => { keys.clear(); input.act = false; input.jumpHeld = false; });
const kd = (...c) => (c.some((k) => keys.has(k)) ? 1 : 0);
function quickUse() {
  // bandage up when hurt, otherwise whichever you need more: a drink or a meal
  const own = [...INV.items.keys()].map((id) => ITEMS[id]).filter(Boolean);
  const med = player.health < 60 ? own.filter((it) => it.heal && !it.drink).sort((a, b) => b.heal - a.heal)[0] : null;
  const food = own.filter((it) => it.food && !it.drink && !it.sick).sort((a, b) => b.food - a.food)[0] || own.filter((it) => it.food && !it.drink)[0];
  const drink = own.filter((it) => it.drink).sort((a, b) => b.drink - a.drink)[0];
  const thirsty = player.water < 95 && (player.water <= player.food || !food);
  if (med) useItem(med.id);
  else if (thirsty && drink) useItem(drink.id);
  else if (food && player.food < 98) useItem(food.id);
  else if (drink && player.water < 98) useItem(drink.id);
  else if (!food && !drink) toast('لا طعام ولا شراب معك', 'اشترِ من البقالة، اصطد أو احصد، واشرب من بحيرة أو نهر');
  else toast('أنت شبعان وريّان', '');
}
function gatherInput(dt) {
  const kx = kd(keyOf('right'), 'ArrowRight') - kd(keyOf('left'), 'ArrowLeft'), kz = kd(keyOf('fwd'), 'ArrowUp') - kd(keyOf('back'), 'ArrowDown');
  let jx = joy.x, jz = joy.y; if (Math.hypot(jx, jz) < 0.12) jx = jz = 0;
  input.mx = clamp(kx + jx, -1, 1); input.mz = clamp(kz + jz, -1, 1);
  if (craftOpen || chartOpen) { input.mx = input.mz = 0; input.act = false; }
  input.sprint = sprintToggle || joy.run || kd(keyOf('sprint'), 'ShiftRight') === 1;
  if (!cam.dragging && !locked && !isGunTool(player.tool) && !player.vehicle && camMode === 'tpp' && input.mz > 0.35) cam.tyaw = angLerp(cam.tyaw, player.yaw + Math.PI, 1 - Math.exp(-dt * 0.8 * input.mz));
}

/* ── lights: the chest flashlight (or headlights) and the nearest lamps and fires ── */
const flashOn = () => flashMode === 'on' || (flashMode === 'auto' && (ENV.night > 0.35 || (player.inside && ENV.lamps > 0.5)));
const _fw = new THREE.Vector3(), _fp = new THREE.Vector3();
function updateFlashlight() {
  const v = player.vehicle;
  if (v && !v.spec.horse) {
    const lit = player.alive && (ENV.lamps > 0.25 || flashMode === 'on');
    flash.intensity = lit ? 3.4 : 0; btn('btnLight').setAttribute('aria-pressed', String(lit));
    if (!lit) return;
    const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), d = v.spec.wb / 2 + 0.6;
    flash.distance = 75; flash.angle = 0.62;
    flash.position.set(v.pos.x + fx * d, v.pos.y + 1.05, v.pos.z + fz * d);
    flashTarget.position.set(flash.position.x + fx * 24, v.pos.y - 1.4, flash.position.z + fz * 24);
    return;
  }
  const on = flashOn() && player.alive;
  btn('btnLight').setAttribute('aria-pressed', String(on));
  flash.intensity = on ? 2.4 : 0; flash.distance = 48; flash.angle = 0.5;
  if (!on) return;
  const aimNow = camMode === 'fpp' || aiming(), yaw = aimNow ? cam.yaw + Math.PI : player.yaw;
  _fw.set(Math.sin(yaw), 0, Math.cos(yaw));
  if (RIG.ok) RIG.bones.Spine2.getWorldPosition(_fp); else _fp.set(player.pos.x, player.pos.y + 1.4, player.pos.z);
  flash.position.set(_fp.x + _fw.x * 0.32, _fp.y + 0.04, _fp.z + _fw.z * 0.32);
  const drop = aimNow ? Math.sin(cam.pitch) * 12 : 2.6;
  flashTarget.position.set(flash.position.x + _fw.x * 12, flash.position.y - drop - 0.3, flash.position.z + _fw.z * 12);
}
let poolT = 0, poolPick = [];
function updateLightPool(dt) {
  poolT -= dt;
  const c = ED.on ? ED.focus : started ? player.pos : cam.focus;
  if (poolT <= 0) {
    poolT = 0.25;
    poolPick = LIGHT_ANCHORS.filter((a) => a.kind === 'fire' || a.kind === 'interior' || ENV.lamps > 0.05)
      .map((a) => [a, (a.x - c.x) ** 2 + (a.z - c.z) ** 2]).filter(([, d]) => d < 4900).sort((a, b) => a[1] - b[1]).slice(0, POOL.length).map(([a]) => a);
  }
  POOL.forEach((l, i) => {
    const a = poolPick[i];
    if (!a) { l.intensity = 0; return; }
    l.position.set(a.x, a.y, a.z); l.color.setHex(a.color).convertSRGBToLinear(); l.distance = a.range;
    l.intensity = a.kind === 'fire' ? 1.7 * (0.85 + 0.15 * Math.sin(T * 13 + i) * Math.sin(T * 7.3)) * (0.4 + 0.6 * Math.max(ENV.lamps, 0.3)) : a.kind === 'interior' ? 1.1 * Math.max(ENV.lamps, 0.35) : 1.3 * ENV.lamps;
  });
}

/* ── HUD ── */
const H = {
  hp: $('hpFill'), hpN: $('hpNum'), st: $('stFill'), fd: $('fdFill'), fdN: $('fdNum'), wt: $('wtFill'), wtN: $('wtNum'), kills: $('kills'), clock: $('clock'), phase: $('phase'), bearing: $('bearing'), alt: $('alt'),
  ammo: $('ammo'), mag: $('ammoMag'), res: $('ammoRes'), cross: $('crosshair'), hit: $('hit'), hitPath: $('hitPath'), toast: $('toast'),
  zone: $('zone'), zName: $('zoneName'), zSub: $('zoneSub'), hurt: $('hurt'), vig: $('vignette'), arc: $('reloadArc'),
  act: $('btnAct'), reload: $('btnReload'), use: $('btnUse'), useLabel: $('useLabel'), gain: $('gain'), harv: $('harv'), harvName: $('harvName'), harvFill: $('harvFill'),
  resW: $('resWood'), resS: $('resStone'), spd: $('spdNum'), gear: $('spdGear'), spdBar: $('spdBar'), rec: $('recTime'),
  bName: $('buildName'), bWhy: $('buildWhy'), bPlace: $('buildPlace'),
};
if (POST.on) H.vig.style.display = 'none';
let toastTimer = 0, hitT = 0;
function toast(title, sub) { H.toast.innerHTML = ''; H.toast.append(title); if (sub) { const s = document.createElement('small'); s.textContent = sub; H.toast.append(s); } H.toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => H.toast.classList.remove('show'), 2900); }
function hitMarker(head) { hitT = 0.18; H.hitPath.setAttribute('stroke', head ? '#ff5a4a' : '#ffffff'); }
function showGain(text, kind) { const g = H.gain; g.textContent = text; g.dataset.kind = kind || ''; g.classList.remove('pop'); void g.offsetWidth; g.classList.add('pop'); }
const PHASES = [[4.5, 'الليل'], [6, 'الفجر'], [8, 'الشروق'], [11.5, 'الصباح'], [14, 'الظهيرة'], [17, 'العصر'], [19, 'الغروب'], [21.5, 'المساء'], [24, 'الليل']];
const pad2 = (n) => toAr(String(n).padStart(2, '0'));
const SECT = ['شمال', 'شمال شرقي', 'شرق', 'جنوب شرقي', 'جنوب', 'جنوب غربي', 'غرب', 'شمال غربي'];
let zoneNow = '', zoneCand = '', zoneSince = 0, zoneTimer = 0, hudTick = 0;
function showZone(name, sub) { H.zName.textContent = name; H.zSub.textContent = sub; H.zone.classList.add('show'); clearTimeout(zoneTimer); zoneTimer = setTimeout(() => H.zone.classList.remove('show'), 3400); }

/* compass tape with marks: the nearest town, your treasure mark, your car */
const tape = $('compassTape'), tctx = tape.getContext('2d');
const bearingOf = (dx, dz) => ((Math.atan2(dx, -dz) * 180 / Math.PI) + 360) % 360;
const CARD = { 0: 'ش', 90: 'ق', 180: 'ج', 270: 'غ' };
function glyph(ctx, kind, x, y, s, color) {
  ctx.fillStyle = color; ctx.strokeStyle = color; ctx.beginPath();
  if (kind === 'town') { ctx.moveTo(x - s, y + s * 0.8); ctx.lineTo(x - s, y - s * 0.1); ctx.lineTo(x, y - s); ctx.lineTo(x + s, y - s * 0.1); ctx.lineTo(x + s, y + s * 0.8); ctx.closePath(); ctx.fill(); }
  else if (kind === 'light') { ctx.moveTo(x - s * 0.45, y + s); ctx.lineTo(x - s * 0.28, y - s * 0.6); ctx.lineTo(x + s * 0.28, y - s * 0.6); ctx.lineTo(x + s * 0.45, y + s); ctx.closePath(); ctx.fill(); ctx.fillRect(x - s * 0.4, y - s, s * 0.8, s * 0.32); }
  else if (kind === 'car') { ctx.fillRect(x - s, y - s * 0.35, s * 2, s * 0.8); ctx.beginPath(); ctx.arc(x - s * 0.55, y + s * 0.5, s * 0.32, 0, TAU); ctx.arc(x + s * 0.55, y + s * 0.5, s * 0.32, 0, TAU); ctx.fill(); }
  else if (kind === 'x') { ctx.lineWidth = s * 0.45; ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s); ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s); ctx.stroke(); }
  else if (kind === 'land') { ctx.fillRect(x - s * 0.7, y - s * 0.35, s * 1.4, s * 1.2); for (const m of [-0.7, -0.15, 0.4]) ctx.fillRect(x + m * s, y - s * 0.85, s * 0.3, s * 0.55); }
  else if (kind === 'shop') { ctx.fillRect(x - s * 0.8, y - s * 0.2, s * 1.6, s); ctx.beginPath(); ctx.moveTo(x - s, y - s * 0.2); ctx.lineTo(x, y - s); ctx.lineTo(x + s, y - s * 0.2); ctx.fill(); }
  else { ctx.lineWidth = s * 0.3; ctx.arc(x, y, s * 0.75, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, s * 0.2, 0, TAU); ctx.fill(); }
}
/* the owner's scanned landmarks on this map: the cathedral, the fortress, the street, the warehouses */
function landmarks() {
  const out = [];
  for (const L of LAND.list) {
    if (!LAND_NAMES[L.kind]) continue;
    const same = LAND.list.filter((q) => q.kind === L.kind);
    out.push({ L, kind: L.kind, name: LAND_NAMES[L.kind] + (same.length > 1 ? ' ' + toAr(same.indexOf(L) + 1) : ''), x: L.x, z: L.z });
  }
  return out;
}
function compassMarks() {
  const p = player.pos, marks = [];
  if (!SET.marks) return marks;
  let best = null, bd = 1e9; for (const S of SETTLEMENTS) { const d = Math.hypot(S.x - p.x, S.z - p.z); if (d > S.r + 30 && d < bd) { bd = d; best = S; } }
  if (best) marks.push([best.kind === 'poi' ? 'ring' : 'town', best.x, best.z, '#ffb53d']);
  if (MAPMARK) marks.push(['x', MAPMARK.x, MAPMARK.z, '#ff5a3a']);
  let cv = null, cd = 1e9; for (const v of VEHICLES) if (v.owned && v !== player.vehicle) { const d = Math.hypot(v.pos.x - p.x, v.pos.z - p.z); if (d < cd && d > 12) { cd = d; cv = v; } }
  if (cv) marks.push(['car', cv.pos.x, cv.pos.z, '#9fe0ff']);
  let lm = null, ld = 2500; for (const M of landmarks()) { const d = Math.hypot(M.x - p.x, M.z - p.z); if (d < ld && d > M.L.R * 0.5) { ld = d; lm = M; } }
  if (lm) marks.push(['land', lm.x, lm.z, '#d6b4ff']);
  // your own crate where you fell, and the supply crate that just came down
  const mine = CRATES.filter((c) => c.own).pop(); if (mine && Math.hypot(mine.x - p.x, mine.z - p.z) > 6) marks.push(['x', mine.x, mine.z, '#ffd76a']);
  if (SUPPLY_MARK && T - SUPPLY_MARK.t < 600) marks.push(['x', SUPPLY_MARK.x, SUPPLY_MARK.z, '#5aa8ff']);
  return marks;
}
function drawCompass(b) {
  const W = tape.width, Hh = tape.height, ppd = W / 140;
  tctx.clearRect(0, 0, W, Hh); tctx.textAlign = 'center'; tctx.textBaseline = 'middle';
  for (let d = Math.ceil((b - 75) / 5) * 5; d <= b + 75; d += 5) {
    const x = W / 2 + (d - b) * ppd, dd = ((d % 360) + 360) % 360;
    if (CARD[dd] !== undefined) { tctx.font = `700 ${Hh * 0.42}px 'Readex Pro',sans-serif`; tctx.fillStyle = dd === 0 ? '#ffb53d' : '#f2f6f1'; tctx.fillText(CARD[dd], x, Hh * 0.52); }
    else if (dd % 30 === 0) { tctx.font = `500 ${Hh * 0.26}px 'Readex Pro',sans-serif`; tctx.fillStyle = 'rgba(230,211,163,.9)'; tctx.fillText(toAr(dd), x, Hh * 0.52); }
    else { tctx.fillStyle = dd % 15 === 0 ? 'rgba(242,246,241,.7)' : 'rgba(242,246,241,.36)'; const h = dd % 15 === 0 ? Hh * 0.26 : Hh * 0.16; tctx.fillRect(x - 1.5, Hh * 0.52 - h / 2, 3, h); }
  }
  const p = player.pos;
  for (const [kind, x, z, col] of compassMarks()) {
    let rel = ((bearingOf(x - p.x, z - p.z) - b + 540) % 360) - 180; const edge = Math.abs(rel) > 66; rel = clamp(rel, -66, 66);
    const gx = W / 2 + rel * ppd;
    if (edge) { tctx.fillStyle = col; tctx.beginPath(); const s = rel > 0 ? 1 : -1; tctx.moveTo(gx + s * 9, Hh * 0.2); tctx.lineTo(gx - s * 5, Hh * 0.08); tctx.lineTo(gx - s * 5, Hh * 0.32); tctx.fill(); }
    else glyph(tctx, kind, gx, Hh * 0.18, Hh * 0.11, col);
  }
  tctx.fillStyle = '#ffb53d'; tctx.fillRect(W / 2 - 2, Hh * 0.8, 4, Hh * 0.2);
  tctx.globalCompositeOperation = 'destination-in';
  const gr = tctx.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.14, '#000'); gr.addColorStop(0.86, '#000'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  tctx.fillStyle = gr; tctx.fillRect(0, 0, W, Hh); tctx.globalCompositeOperation = 'source-over';
}

/* the chart: the pre-drawn 8 km map, a minimap around you, a big chart you can pan and zoom */
const MAPIMG = { img: null, ok: false };
const MAP_W = WHALF * 2;
const toMap = (x, z, S) => [(x + MAP_W / 2) / MAP_W * S, (z + MAP_W / 2) / MAP_W * S];
function drawArrow(ctx, x, y, s, yaw) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI - yaw);
  ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.7, s * 0.75); ctx.lineTo(0, s * 0.35); ctx.lineTo(-s * 0.7, s * 0.75); ctx.closePath();
  ctx.fillStyle = '#ffb53d'; ctx.fill(); ctx.lineWidth = s * 0.18; ctx.strokeStyle = '#0e2a32'; ctx.stroke(); ctx.restore();
}
const mm = $('miniMap'), mctx = mm.getContext('2d');
function drawMini() {
  if (!mctx) return;
  const S = mm.width, VIEW = player.vehicle ? Math.min(900, 300 + Math.abs(player.vehicle.speed) * 12) : 260, p = player.pos, s = S / VIEW;
  mctx.fillStyle = '#1d5f73'; mctx.fillRect(0, 0, S, S);
  if (MAPIMG.ok) { const I = MAPIMG.img, k = I.width / MAP_W, [cx, cz] = toMap(p.x, p.z, I.width); mctx.imageSmoothingEnabled = true; mctx.drawImage(I, cx - VIEW * k / 2, cz - VIEW * k / 2, VIEW * k, VIEW * k, 0, 0, S, S); }
  if (FOW.on) FOW.overlay(mctx, (x, z) => [S / 2 + (x - p.x) * s, S / 2 + (z - p.z) * s], s);
  const dot = (x, z, r, col) => { const dx = x - p.x, dz = z - p.z; if (Math.abs(dx) > VIEW / 2 || Math.abs(dz) > VIEW / 2) return; mctx.fillStyle = col; mctx.beginPath(); mctx.arc(S / 2 + dx * s, S / 2 + dz * s, r, 0, TAU); mctx.fill(); };
  for (const r of BUILT) if (r.kind === 'piece') { const [x, z] = recXZ(r), dx = x - p.x, dz = z - p.z; if (Math.abs(dx) < VIEW / 2 && Math.abs(dz) < VIEW / 2) { mctx.fillStyle = '#c9934e'; const w = ITEMS[r.id].build.piece === 'foundation' ? 3 : 1.2; mctx.fillRect(S / 2 + dx * s - w * s / 2, S / 2 + dz * s - w * s / 2, Math.max(2, w * s), Math.max(2, w * s)); } }
  for (const v of VEHICLES) { if (v === player.vehicle) continue; const dx = v.pos.x - p.x, dz = v.pos.z - p.z; if (Math.hypot(dx, dz) < VIEW * 0.45) glyph(mctx, 'car', S / 2 + dx * s, S / 2 + dz * s, S * 0.02, v.owned ? '#9fe0ff' : 'rgba(220,230,240,.55)'); }
  for (const sp of SHOP_SPOTS) { const dx = sp.x - p.x, dz = sp.z - p.z; if (Math.hypot(dx, dz) < VIEW * 0.45) glyph(mctx, 'shop', S / 2 + dx * s, S / 2 + dz * s, S * 0.025, '#ffd76a'); }
  for (const M of landmarks()) { const dx = M.x - p.x, dz = M.z - p.z; if (Math.hypot(dx, dz) < VIEW * 0.45) glyph(mctx, 'land', S / 2 + dx * s, S / 2 + dz * s, S * 0.035, '#d6b4ff'); }
  if (MAPMARK) { const dx = MAPMARK.x - p.x, dz = MAPMARK.z - p.z, d = Math.hypot(dx, dz), r = S * 0.42; if (d < VIEW * 0.45) glyph(mctx, 'x', S / 2 + dx * s, S / 2 + dz * s, S * 0.03, '#ff5a3a'); else glyph(mctx, 'x', S / 2 + dx / d * r, S / 2 + dz / d * r, S * 0.03, '#ff5a3a'); }
  for (const z of ZOMBIES) if (z.active && z.state !== 'dead' && (z.state !== 'wander' || Math.hypot(z.x - p.x, z.z - p.z) < 40)) dot(z.x, z.z, S * 0.016, '#e5493c');
  for (const b of BOTS) if (b.active && b.state !== 'dead' && Math.hypot(b.x - p.x, b.z - p.z) < 90) dot(b.x, b.z, S * 0.016, b.angry ? '#ff8a3a' : '#f2f6f1');
  drawArrow(mctx, S / 2, S / 2, S * 0.06, player.vehicle ? player.vehicle.yaw : player.yaw);
  mctx.font = `700 ${S * 0.09}px 'Readex Pro',sans-serif`; mctx.textAlign = 'center'; mctx.textBaseline = 'middle';
  mctx.lineWidth = 4; mctx.strokeStyle = 'rgba(14,42,50,.85)'; mctx.strokeText('ش', S / 2, S * 0.09); mctx.fillStyle = '#ffb53d'; mctx.fillText('ش', S / 2, S * 0.09);
}
const big = $('chartCanvas'), bctx = big.getContext('2d');
const CHART = { cx: 0, cz: 0, span: MAP_W, drag: null, pts: new Map(), pinch: 0 };
function drawBigChart() {
  if (!bctx) return;
  const S = big.width, C0 = CHART, k = S / C0.span, P = (x, z) => [(x - C0.cx) * k + S / 2, (z - C0.cz) * k + S / 2];
  bctx.fillStyle = '#1d5f73'; bctx.fillRect(0, 0, S, S);
  if (MAPIMG.ok) { const I = MAPIMG.img, ik = I.width / MAP_W, [ix, iz] = toMap(C0.cx, C0.cz, I.width); bctx.drawImage(I, ix - C0.span * ik / 2, iz - C0.span * ik / 2, C0.span * ik, C0.span * ik, 0, 0, S, S); }
  if (FOW.on) FOW.overlay(bctx, P, k);
  bctx.textAlign = 'center'; bctx.textBaseline = 'middle';
  const label = (txt, x, z, size, dy = 0) => { const [u, v] = P(x, z); if (u < -50 || v < -50 || u > S + 50 || v > S + 50) return; bctx.font = `700 ${size}px 'Aref Ruqaa','Amiri',serif`; bctx.lineWidth = size * 0.22; bctx.strokeStyle = 'rgba(242,246,241,.85)'; bctx.strokeText(txt, u, v + dy); bctx.fillStyle = '#0e2a32'; bctx.fillText(txt, u, v + dy); };
  const zoomK = MAP_W / C0.span;
  for (const S2 of SETTLEMENTS) { if (FOW.hidden(S2.x, S2.z)) continue; const [u, v] = P(S2.x, S2.z); glyph(bctx, S2.kind === 'poi' ? 'ring' : 'town', u, v, S * 0.008 * Math.min(2, zoomK), '#8a2a1a'); label(S2.name, S2.x, S2.z, S * (S2.kind === 'city' ? 0.03 : 0.02) * Math.min(1.6, Math.sqrt(zoomK)), -S * 0.022); }
  for (const M of landmarks()) { const [u, v] = P(M.x, M.z); glyph(bctx, 'land', u, v, S * 0.012 * Math.min(1.6, Math.sqrt(zoomK)), '#5b2a86'); label(M.name, M.x, M.z, S * 0.024 * Math.min(1.5, Math.sqrt(zoomK)), -S * 0.03); }
  if (zoomK > 3) for (const sp of SHOP_SPOTS) { const [u, v] = P(sp.x, sp.z); glyph(bctx, 'shop', u, v, S * 0.008, '#c98a1a'); }
  for (const r of BUILT) if (r.kind === 'piece' && ITEMS[r.id].build.piece === 'foundation') { const [u, v] = P(cellC(r.i), cellC(r.j)); bctx.fillStyle = '#c9934e'; const w = Math.max(2, 3 * k); bctx.fillRect(u - w / 2, v - w / 2, w, w); }
  for (const v2 of VEHICLES) if (v2.owned || v2 === player.vehicle) { const [u, w] = P(v2.pos.x, v2.pos.z); glyph(bctx, 'car', u, w, S * 0.008, '#3a8ac8'); }
  if (MAPMARK) { const [u, v] = P(MAPMARK.x, MAPMARK.z); glyph(bctx, 'x', u, v, S * 0.014, '#d8302a'); }
  for (const c of CRATES) if (c.own || c.drop) { const [u, v] = P(c.x, c.z); glyph(bctx, 'x', u, v, S * 0.011, c.own ? '#ffd76a' : '#5aa8ff'); }
  // the plane's line while you are aboard
  if (DROP.state === 'plane' && DROP.path) { const D0 = DROP.path, [a1, b1] = P(D0.x0, D0.z0), [a2, b2] = P(D0.x1, D0.z1); bctx.strokeStyle = 'rgba(255,255,255,.85)'; bctx.setLineDash([S * 0.012, S * 0.01]); bctx.lineWidth = S * 0.004; bctx.beginPath(); bctx.moveTo(a1, b1); bctx.lineTo(a2, b2); bctx.stroke(); bctx.setLineDash([]); }
  if (CHART.pick) { const [u, v] = P(CHART.pick.x, CHART.pick.z); bctx.fillStyle = '#ff5a3a'; bctx.beginPath(); bctx.arc(u, v - S * 0.022, S * 0.014, 0, TAU); bctx.fill(); bctx.beginPath(); bctx.moveTo(u - S * 0.01, v - S * 0.016); bctx.lineTo(u + S * 0.01, v - S * 0.016); bctx.lineTo(u, v); bctx.fill(); bctx.fillStyle = '#fff'; bctx.beginPath(); bctx.arc(u, v - S * 0.022, S * 0.005, 0, TAU); bctx.fill(); }
  // scale bar
  const m = C0.span > 16000 ? 5000 : C0.span > 8000 ? 2000 : C0.span > 4000 ? 1000 : C0.span > 1500 ? 500 : C0.span > 600 ? 200 : 100, bar = m * k, bx = S * 0.06, by = S * 0.95;
  bctx.strokeStyle = '#f2f6f1'; bctx.lineWidth = S * 0.004; bctx.beginPath(); bctx.moveTo(bx, by - 8); bctx.lineTo(bx, by); bctx.lineTo(bx + bar, by); bctx.lineTo(bx + bar, by - 8); bctx.stroke();
  bctx.font = `500 ${S * 0.02}px 'Readex Pro',sans-serif`; bctx.fillStyle = '#f2f6f1'; bctx.fillText(m >= 1000 ? toAr(m / 1000) + ' كم' : toAr(m) + ' م', bx + bar / 2, by - S * 0.02);
  const nx = S * 0.93, ny = S * 0.92; bctx.fillStyle = '#ffb53d'; bctx.beginPath(); bctx.moveTo(nx, ny - S * 0.04); bctx.lineTo(nx + S * 0.016, ny + S * 0.01); bctx.lineTo(nx - S * 0.016, ny + S * 0.01); bctx.fill();
  bctx.font = `700 ${S * 0.026}px 'Readex Pro',sans-serif`; bctx.fillStyle = '#f2f6f1'; bctx.fillText('ش', nx, ny + S * 0.035);
  const [u, v] = P(player.pos.x, player.pos.z); drawArrow(bctx, u, v, S * 0.02, player.vehicle ? player.vehicle.yaw : player.yaw);
}
function chartLandList() {
  const box = $('chartLands'); if (!box) return;
  const list = landmarks(); box.innerHTML = ''; box.hidden = !list.length; if (!list.length) return;
  const h = document.createElement('b'); h.textContent = 'المعالم'; box.append(h);
  for (const M of list) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'ghost';
    const d = Math.hypot(M.x - player.pos.x, M.z - player.pos.z);
    b.textContent = M.name + ' · ' + (d >= 1000 ? toAr(+(d / 1000).toFixed(1)).replace('.', '٫') + ' كم' : toAr(Math.round(d)) + ' م');
    b.addEventListener('click', () => {
      // a spot just outside it, on your side, looking at it
      const a = Math.atan2(player.pos.x - M.x, player.pos.z - M.z), r = M.L.R * 0.85, m = (MAP_W - CHART.span) / 2;
      CHART.cx = clamp(M.x, -m, m); CHART.cz = clamp(M.z, -m, m);
      CHART.pick = { x: clamp(M.x + Math.sin(a) * r, -PLAY, PLAY), z: clamp(M.z + Math.cos(a) * r, -PLAY, PLAY), face: [M.x, M.z] };
      drawBigChart(); chartPickUI(); AUDIO.ui();
    });
    box.append(b);
  }
}
function toggleChart(force) {
  chartOpen = force === undefined ? !chartOpen : force;
  if (chartOpen) chartLandList();
  if (chartOpen) { CHART.span = Math.min(MAP_W, Math.max(3200, MAP_W * 0.18)); const m = (MAP_W - CHART.span) / 2; CHART.cx = clamp(player.pos.x, -m, m); CHART.cz = clamp(player.pos.z, -m, m); drawBigChart(); closeCraft(); }
  $('chart').hidden = !chartOpen;
  if (chartOpen) $('chartClose').focus();
}
tap($('mapBtn'), () => toggleChart(true));
$('chartClose').addEventListener('click', () => toggleChart(false));
$('chart').addEventListener('click', (e) => { if (e.target.id === 'chart') toggleChart(false); });
const chartPan = (dx, dy) => { const r = big.getBoundingClientRect(), k = CHART.span / r.width; CHART.cx = clamp(CHART.cx - dx * k, -MAP_W / 2 + CHART.span / 2, MAP_W / 2 - CHART.span / 2); CHART.cz = clamp(CHART.cz - dy * k, -MAP_W / 2 + CHART.span / 2, MAP_W / 2 - CHART.span / 2); };
const chartZoom = (f) => { CHART.span = clamp(CHART.span * f, 300, MAP_W); chartPan(0, 0); drawBigChart(); };
big.addEventListener('pointerdown', (e) => { CHART.pts.set(e.pointerId, [e.clientX, e.clientY]); CHART.tap = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 }; try { big.setPointerCapture(e.pointerId); } catch (_) {} });
big.addEventListener('pointermove', (e) => {
  const q = CHART.pts.get(e.pointerId); if (!q) return;
  if (CHART.pts.size === 2) { CHART.pts.set(e.pointerId, [e.clientX, e.clientY]); const [a, b] = [...CHART.pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (CHART.pinch) chartZoom(CHART.pinch / d); CHART.pinch = d; return; }
  let [dx, dy] = toLocal(e.clientX - q[0], e.clientY - q[1]); chartPan(dx, dy); CHART.pts.set(e.pointerId, [e.clientX, e.clientY]); drawBigChart();
  if (CHART.tap && CHART.tap.id === e.pointerId) CHART.tap.moved = Math.max(CHART.tap.moved, Math.hypot(e.clientX - CHART.tap.x, e.clientY - CHART.tap.y));
});
const chartUp = (e) => {
  CHART.pts.delete(e.pointerId); CHART.pinch = 0;
  // a tap (not a drag) picks a place: a pin, then «انتقال» takes you there
  const tp = CHART.tap; CHART.tap = null;
  if (e.type === 'pointerup' && tp && tp.id === e.pointerId && tp.moved < 9 && performance.now() - tp.t < 500) {
    // offsetX/Y are in the canvas's own (untransformed) frame, so this holds when the whole screen is turned for landscape too
    const lx = e.offsetX / (big.clientWidth || 1), ly = e.offsetY / (big.clientHeight || 1);
    const x = CHART.cx + (lx - 0.5) * CHART.span, z = CHART.cz + (ly - 0.5) * CHART.span;
    CHART.pick = { x: clamp(x, -PLAY, PLAY), z: clamp(z, -PLAY, PLAY) }; drawBigChart(); chartPickUI();
  }
};
/* TEMPORARY (for testing, the owner removes it when the game is finished): jump anywhere on the map, car and all */
function chartPickUI() {
  let el = $('chartPick');
  if (!el) {
    el = document.createElement('div'); el.id = 'chartPick';
    el.innerHTML = '<span id="cpWhere"></span><button id="cpGo" type="button" class="cta">انتقال</button><button id="cpMark" type="button" class="ghost">علامة</button>';
    document.querySelector('#chart .chart-card').append(el);
    tap($('cpGo'), () => { const p = CHART.pick; if (p) teleportTo(p.x, p.z, p.face); });
    tap($('cpMark'), () => { const p = CHART.pick; if (p) { MAPMARK = { id: 'pin', x: p.x, z: p.z }; toast('وضعت علامة', 'تتبعها على البوصلة'); saveSoon(); drawBigChart(); } });
  }
  const p = CHART.pick; el.hidden = !p; $('cpGo').hidden = !SET.devTeleport; if (!p) return;
  const z = zoneAt(p.x, p.z, terrainAt(p.x, p.z));
  $('cpWhere').textContent = (z && z.name ? z.name + ' · ' : '') + toAr(Math.round(Math.hypot(p.x - player.pos.x, p.z - player.pos.z))) + ' م';
}
function teleportTo(x, z, face) {
  if (!started || !player.alive) return;
  const v = player.vehicle;
  if (DROP.state) { if (DROP.state === 'plane') { DROP.plane.visible = false; AUDIO.engine(false); } DROP.state = ''; if (DROP.chute) DROP.chute.visible = false; hud.classList.remove('aboard'); $('dropUI').classList.add('gone'); player.root.visible = true; if (RIG.body) RIG.body.root.visible = true; showTool(true); }
  let y = groundAt(x, z, terrainAt(x, z) + 60);
  const wl = waterAt(x, z);
  if (v) {
    if (v.spec.water && !(wl > terrainAt(x, z) + 1)) { toast('القارب يحتاج ماء', 'اختر مكاناً على البحر أو بحيرة'); return; }
    v.pos.set(x, (v.spec.water ? wl : y) + 0.4, z); if (v.vel) v.vel.set(0, 0, 0); v.speed = 0; if (v.root) v.root.position.copy(v.pos);
    player.pos.copy(v.pos);
  } else { player.pos.set(x, y + 0.05, z); player.vel.set(0, 0, 0); player.onGround = true; }
  if (face && !v) { player.yaw = Math.atan2(face[0] - x, face[1] - z); cam.yaw = cam.tyaw = player.yaw + Math.PI; cam.pitch = cam.tpitch = 0.12; player.root.rotation.y = player.yaw; }
  prepareAround(x, y, z); updateCamera(0.016, true);
  toggleChart(false); CHART.pick = null; chartPickUI();
  toast('انتقلت', zoneAt(x, z, y).name || ''); saveSoon();
}
big.addEventListener('pointerup', chartUp); big.addEventListener('pointercancel', chartUp);
big.addEventListener('wheel', (e) => { e.preventDefault(); chartZoom(1 + e.deltaY * 0.0012); }, { passive: false });

const pad2L = (n) => String(n).padStart(2, '0');
const TODAY = (() => { const d = new Date(); return d.getFullYear() + '-' + pad2L(d.getMonth() + 1) + '-' + pad2L(d.getDate()); })();
let useState = '', lastTool = '', lastMode = '', whoSig = '';
/* the sight picture: a red dot or holographic ring over a clear view, magnified scopes inside a black ring with their reticle */
const SCOPE_RET = {
  dot: '<circle r="1.1" fill="#ff3b30"/><circle r="3.2" fill="none" stroke="rgba(255,59,48,.25)" stroke-width="1"/>',
  holo: '<circle r="9" fill="none" stroke="#ff4a3a" stroke-width="0.8"/><circle r="0.9" fill="#ff4a3a"/><path d="M0 -9v-3M0 9v3M-9 0h-3M9 0h3" stroke="#ff4a3a" stroke-width="0.8"/>',
  cross: '<path d="M-50 0h46M4 0h46M0 4v46M0 -50v46" stroke="#111" stroke-width="0.6"/><circle r="0.7" fill="#c00"/>',
  chevron: '<path d="M-4 4L0 0l4 4" fill="none" stroke="#e8302a" stroke-width="0.9"/><path d="M-50 0h40M10 0h40M0 12v38" stroke="#111" stroke-width="0.7"/><path d="M-2 9h4M-1.5 15h3M-1 21h2" stroke="#111" stroke-width="0.5"/>',
  acog: '<path d="M-5 4.5L0 0l5 4.5" fill="none" stroke="#ff8a1a" stroke-width="1"/><path d="M-50 0h42M8 0h42M0 6v44" stroke="#111" stroke-width="0.7"/><path d="M-3 12h6M-2.4 18h4.8M-1.8 24h3.6M-1.2 30h2.4" stroke="#111" stroke-width="0.6"/>',
  mil: '<path d="M-50 0h50M0 0h50M0 -50v100" stroke="#111" stroke-width="0.35"/><g fill="#111">' + [-36, -27, -18, -9, 9, 18, 27, 36].map((d) => `<circle cx="${d}" r="0.8"/><circle cy="${d}" r="0.8"/>`).join('') + '</g><circle r="0.5" fill="#c00"/>',
  iron: '<circle r="0.9" fill="#ffe08a"/>',
};
let scopeShown = '';
function drawScope() {
  const on = SCOPE.k > 0.55 && player.armed && !player.vehicle, g = on ? gunSpec() : null, kind = on ? (g.ret || 'iron') : '';
  if (kind === scopeShown) return; scopeShown = kind;
  const ov = $('scopeOv'); ov.classList.toggle('on', !!kind); hud.classList.toggle('scoped', !!kind);
  ov.className = kind ? 'on ' + kind : ''; if (kind) $('scopeRet').innerHTML = SCOPE_RET[kind] || SCOPE_RET.iron;
}
let compassSig = '';
function updateHud(dt) {
  drawScope();
  const b = ((-cam.yaw * 180 / Math.PI) % 360 + 360) % 360;
  // the compass tape is redrawn when it would look different: half a degree of turn, a few metres, or twice a second for its marks
  const cSig = Math.round(b * 2) + ':' + Math.round(player.pos.x / 4) + ':' + Math.round(player.pos.z / 4) + ':' + Math.floor(T * 2);
  if (cSig !== compassSig) { compassSig = cSig; drawCompass(b); }
  hitT = Math.max(0, hitT - dt); H.hit.style.opacity = hitT > 0 ? String(hitT / 0.18) : '0';
  H.hurt.style.opacity = String(Math.min(1, hurtFlash * 0.9 + (player.health < 30 && player.alive ? 0.25 + 0.15 * Math.sin(T * 6) : 0)));
  const gun = isGunTool(player.tool) && player.armed && !player.vehicle;
  const moving = Math.hypot(player.vel.x, player.vel.z), spread = 6 + Math.min(14, moving * 1.4) + (player.onGround ? 0 : 10) + cam.kick * 300 - (input.aim ? 4 : 0);
  if (gun) { const s = spread.toFixed(1); H.cross.children[1].style.top = -(+s + 9) + 'px'; H.cross.children[2].style.top = s + 'px'; H.cross.children[3].style.left = -(+s + 9) + 'px'; H.cross.children[4].style.left = s + 'px'; }
  H.arc.setAttribute('stroke-dashoffset', String(player.reloadT > 0 ? 182 * (player.reloadT / (player.reloadMax || 1.8)) : 182));
  H.reload.classList.toggle('busy', player.reloadT > 0);
  const useNow = USE.kind ? (USE.kind === 'out' ? 'out' : USE.kind === 'in' || USE.kind === 'boat' ? 'in' : 'act') + '|' + USE.label : '';
  if (useNow !== useState) { useState = useNow; H.use.hidden = !useNow; H.use.dataset.mode = USE.kind === 'out' ? 'out' : USE.kind === 'in' || USE.kind === 'boat' ? (USE.kind === 'boat' ? 'boat' : 'in') : 'act'; H.useLabel.textContent = USE.label; }
  H.harv.classList.toggle('show', HARV.t > 0 && !player.vehicle);
  if (HARV.t > 0) { H.harvName.textContent = HARV.name; H.harvFill.style.transform = `scaleX(${HARV.frac})`; }
  if (player.vehicle) { const v = player.vehicle, kmh = Math.round(Math.abs(v.speed) * 3.6); H.spd.textContent = toAr(kmh); H.gear.textContent = v.spec.water ? (v.speed < -0.1 ? 'خلف' : 'أمام') : v.spec.horse ? (Math.abs(v.speed) > 9 ? 'عدو' : Math.abs(v.speed) > 3 ? 'خبب' : 'مشي') : v.gear < 0 ? 'R' : v.gear === 0 ? 'N' : String(v.gear); H.spdBar.style.transform = `scaleX(${Math.min(1, kmh / (v.spec.max * 3.6))})`; }
  if (camMode === 'fpp') { const hh = Math.floor(ENV.hour), mn = Math.floor((ENV.hour - hh) * 60), sc = Math.floor(((ENV.hour - hh) * 60 - mn) * 60); H.rec.textContent = `${TODAY}  ${pad2L(hh)}:${pad2L(mn)}:${pad2L(sc)}`; }
  if (BUILD.ghost) { H.bName.textContent = BUILD.it.name + (invCount(BUILD.it.id) > 1 ? ' ×' + toAr(invCount(BUILD.it.id)) : ''); H.bWhy.textContent = BUILD.ok ? 'المكان مناسب' : BUILD.why; H.bWhy.classList.toggle('bad', !BUILD.ok); H.bPlace.disabled = !BUILD.ok; }
  const mode = (player.vehicle ? 'drive' : BUILD.ghost ? 'build' : 'walk') + camMode;
  const toolNow = BUILD.ghost ? 'place' : player.tool;
  if (toolNow !== lastTool || mode !== lastMode) {
    lastTool = toolNow; lastMode = mode; hud.dataset.tool = toolNow;
    hud.classList.toggle('driving', !!player.vehicle); hud.classList.toggle('building', !!BUILD.ghost); hud.classList.toggle('fpp', camMode === 'fpp');
    const it = ITEMS[player.toolItem];
    H.act.setAttribute('aria-label', BUILD.ghost ? 'ضع هنا' : gun ? 'إطلاق النار' : 'اضرب بـ' + (it ? it.name : 'اليد'));
  }
  renderSlots();
  hudTick += dt; if (hudTick < 0.1 && !hudDirty) return; hudTick = 0;
  drawMini();
  // blood, energy, hunger and thirst: written only when a number changes (style writes cost a layout on phones)
  const vs = Math.ceil(player.health) + '|' + Math.round(player.stamina) + '|' + Math.ceil(player.food) + '|' + Math.ceil(player.water) + '|' + KILLS;
  if (vs !== whoSig) {
    whoSig = vs;
    H.hp.style.width = `calc(${player.health}% - 4px)`; H.hpN.textContent = toAr(Math.ceil(player.health));
    H.st.style.width = `calc(${player.stamina}% - 4px)`;
    H.fd.style.width = `calc(${player.food}% - 4px)`; H.fdN.textContent = toAr(Math.ceil(player.food));
    H.wt.style.width = `calc(${player.water}% - 4px)`; H.wtN.textContent = toAr(Math.ceil(player.water));
    H.hp.parentNode.parentNode.classList.toggle('low', player.health < 25); H.fd.parentNode.parentNode.classList.toggle('low', player.food < 15); H.wt.parentNode.parentNode.classList.toggle('low', player.water < 15);
    H.kills.textContent = toAr(KILLS);
  }
  const hh = Math.floor(ENV.hour), mn = Math.floor((ENV.hour - hh) * 60);
  H.clock.textContent = pad2(hh) + ':' + pad2(mn); H.phase.textContent = PHASES.find(([h]) => ENV.hour < h)[1];
  H.bearing.textContent = toAr(Math.round(b) % 360) + '° ' + SECT[Math.round(b / 45) % 8];
  const p = player.pos, g = terrainAt(p.x, p.z), wl = waterAt(p.x, p.z);
  H.alt.textContent = player.vehicle && player.vehicle.spec.water ? (wl === 0 ? 'في البحر' : 'على الماء') : g < wl - 0.15 && !onPlatform(p.x, p.z, p.y) ? 'في الماء' : toAr(Math.max(0, Math.round(p.y))) + ' م فوق البحر';
  H.reload.hidden = !gun && !BUILD.ghost; H.ammo.hidden = !gun; H.cross.classList.toggle('on', gun); H.cross.classList.toggle('dot', !gun && !player.vehicle && !BUILD.ghost);
  $('btnAim').hidden = !gun; $('btnMode').hidden = !gun;
  if (gun) {
    const g2 = gunSpec(), fm = fireMode(player.toolItem); H.mag.textContent = toAr(player.mag); H.res.textContent = '/ ' + toAr(invCount(g2.ammo)); H.ammo.classList.toggle('low', player.mag <= Math.max(2, g2.mag * 0.2));
    $('btnMode').textContent = { a: 'تلقائي', b: 'رشقة', s: 'فردي' }[fm] + (g2.modes.length > 1 ? ' ⇄' : '');
  } else if (SCOPE.on) setScope(false);
  H.resW.textContent = toAr(invCount('wood')); H.resS.textContent = toAr(invCount('stone'));
  const bf = $('bagFill'); if (bf) bf.style.transform = `scaleY(${Math.min(1, bagLoad() / bagCap())})`;
  H.vig.style.opacity = String(0.4 + ENV.night * 0.45);
  let name, sub;
  if (player.inside) { name = player.inside.name || (player.inside.shop ? SHOP_NAME[player.inside.shop] : 'بيت'); sub = player.inside.settlement ? player.inside.settlement.name : 'داخل المبنى'; }
  else if (player.vehicle) { name = player.vehicle.spec.name; sub = zoneAt(p.x, p.z, p.y).name; }
  else { const z = zoneAt(p.x, p.z, p.y); name = z.name; sub = z.sub; }
  if (name !== zoneCand) { zoneCand = name; zoneSince = T; }
  if (zoneCand !== zoneNow && T - zoneSince > 0.7) { zoneNow = zoneCand; showZone(name, sub); }
  if (craftOpen) renderBag(false);
  hudDirty = false;
}
