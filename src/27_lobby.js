/* ═════════ the lobby: your survivor stands in a misty forest clearing of the island (the real world, not a picture),
   wearing what you chose. Profile, gold and gems, friends, training, the store, the wardrobe, the workshop and the missions
   are all here; «كمل رحلتك» takes you back to where you left your journey ═════════ */
const LOBBY = { on: false, spot: null, body: null, kind: '', rot: 0, rotV: 0, drag: null, shift: 0, shiftT: 0, hour: 8.4, saved: null, preview: null,
  sheet: null, sub: null, more: 0, avaWant: true, avaAt: 0, uiT: 0, busy: false, map: MAP_ID, mode: 'solo', hinted: false, introFrom: false };
const LOBBY_W = { cloud: 0.34, rain: 0, fog: 0.3, wind: 0.16, storm: 0 };
Object.assign(ICON, {
  friends: '<circle cx="9" cy="8" r="3.2" fill="currentColor" stroke="none"/><path d="M2.6 20c0-3.9 2.9-7 6.4-7s6.4 3.1 6.4 7z" fill="currentColor" stroke="none"/><circle cx="17" cy="9" r="2.6"/><path d="M16.2 13.3c3.1.3 5.3 3 5.3 6.7h-3.4"/>',
  training: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.8"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4"/>',
  store: '<path d="M4.6 8.2h14.8l-1.3 12.3H5.9z" fill="currentColor" stroke="none"/><path d="M8.6 10.4V7a3.4 3.4 0 0 1 6.8 0v3.4"/>',
  wardrobe: '<path d="M12 7.2a2.2 2.2 0 1 1 2.2-2.2"/><path d="M12 7.2v1.6l-8.6 6.6c-.9.7-.4 2.1.7 2.1h15.8c1.1 0 1.6-1.4.7-2.1L12 8.8"/>',
  workshop: '<path d="M14.6 3.6a5 5 0 0 0-4.8 6.6l-6.4 6.4a2 2 0 0 0 2.8 2.8l6.4-6.4a5 5 0 0 0 6.6-4.8l-3 3-2.7-.7-.7-2.7 3-3a5 5 0 0 0-1.2-.2z" fill="currentColor" stroke="none"/>',
  missions: '<rect x="4.8" y="3.4" width="14.4" height="17.4" rx="2.6"/><path d="M8.3 9l1.7 1.7 3-3M8.3 15l1.7 1.7 3-3M15 9.6h1.6M15 15.6h1.6"/>',
  gear: '<circle cx="12" cy="12" r="3.1"/><path d="M12 2.6v2.6M12 18.8v2.6M21.4 12h-2.6M5.2 12H2.6M18.6 5.4l-1.8 1.8M7.2 16.8l-1.8 1.8M18.6 18.6l-1.8-1.8M7.2 7.2 5.4 5.4"/><circle cx="12" cy="12" r="6.6"/>',
  skull: '<path d="M12 2C6.9 2 3 5.6 3 10.3c0 2.6 1.2 4.6 3 5.9V20c0 1.1.9 2 2 2h1.5v-2.5h1.5V22h2v-2.5h1.5V22H16c1.1 0 2-.9 2-2v-3.8c1.8-1.3 3-3.3 3-5.9C21 5.6 17.1 2 12 2zM8.5 14a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4zm7 0a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4z" fill="currentColor" stroke="none"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10.5" rx="2.2" fill="currentColor" stroke="none"/><path d="M8.2 10.5V7.8a3.8 3.8 0 0 1 7.6 0v2.7"/>',
  bolt: '<path d="M13 2 4 14h6l-1 8 9-12h-6z" fill="currentColor" stroke="none"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2.2"/><path d="M16 8V5.6A1.6 1.6 0 0 0 14.4 4H5.6A1.6 1.6 0 0 0 4 5.6v8.8A1.6 1.6 0 0 0 5.6 16H8"/>',
  edit: '<path d="M4 20l1.1-4.2L16.2 4.7l3.1 3.1L8.2 18.9z"/><path d="M14 7l3 3"/>',
  clock: '<circle cx="12" cy="12" r="8.6"/><path d="M12 7v5.2l3.4 2"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/>',
  crate: '<path d="M3.5 8.2 12 4l8.5 4.2v8.6L12 21l-8.5-4.2z" fill="currentColor" stroke="none" opacity=".9"/><path d="M3.5 8.2 12 12.4l8.5-4.2M12 12.4V21M7.8 6.1l8.5 4.2" stroke="rgba(0,0,0,.45)" stroke-width="1.2"/>',
  upgun: '<path d="M2 12.4h10.8l1.9-1.9h6v2.5h-2l-1 1.5h-3l-1.5 3.1h-2.6l1-3.1H5.8l-1.5 2H2z" fill="currentColor" stroke="none"/><path d="M17.5 3v4.5M15.3 5.3l2.2-2.3 2.2 2.3" stroke-width="1.8"/>',
  clan: '<path d="M12 2.6 4.5 5.4v5.8c0 4.8 3.2 8.6 7.5 10.2 4.3-1.6 7.5-5.4 7.5-10.2V5.4z" fill="currentColor" stroke="none"/><path d="M8.4 11.6 11 14l4.6-5" stroke="rgba(0,0,0,.55)" stroke-width="1.9"/>',
  medal: '<circle cx="12" cy="14.5" r="5.6" fill="currentColor" stroke="none"/><path d="M8.4 9.7 6 2.8h4l2 5M15.6 9.7 18 2.8h-4l-2 5"/><path d="M12 11.7l.9 1.8 2 .3-1.4 1.4.3 2-1.8-.9-1.8.9.3-2-1.4-1.4 2-.3z" fill="rgba(0,0,0,.45)" stroke="none"/>',
  shard: '<path d="M12 2.5 18.5 9 12 21.5 5.5 9z" fill="currentColor" stroke="none"/><path d="M5.5 9h13M12 2.5 9.5 9 12 21.5 14.5 9z" stroke="rgba(0,0,0,.35)" stroke-width="1"/>',
});
const lbIcon = (k, color) => svg(k, '', color);

/* ── where the lobby stands: a flat, bright clearing in the forest near the harbour, the forest behind,
   the sun from the side, nothing between the survivor and the camera ── */
function lobbySunAz() { const a = (LOBBY.hour - 6) / 12 * Math.PI, sx = Math.cos(a), sz = 0.32 + 0.18 * Math.sin(a); return Math.atan2(sx, sz); }
// where each map stands its survivor: the kinds of land, and how much wood there must be behind them
const LOBBY_CFG = {
  island: { bio: [3, 11, 6, 2], back: 9, forest: 0.28, warm: true }, mega: { bio: [3, 11, 6, 2], back: 9, forest: 0.28, warm: true },
  forest: { bio: [3, 4, 11, 8], back: 9, forest: 0.3 }, snow: { bio: [4, 3, 5, 11], back: 7, forest: 0.2 },
  desert: { bio: [9, 11, 7], back: 3, forest: 0.05 }, water: { bio: [9, 10, 2, 1, 11], back: 2, forest: 0.02 },
};
function findLobbySpot() {
  const cfg = LOBBY_CFG[MAP_ID] || LOBBY_CFG.island;
  return findLobbySpotWith(cfg, false) || findLobbySpotWith(cfg, true) || lobbyFallback();
}
function lobbyFallback() { const s = WORLD.data.spawn; return lobbyClear({ x: s.x, z: s.z, y: terrainAt(s.x, s.z), phi: lobbySunAz() + 0.85 }); }
function findLobbySpotWith(cfg, relaxed) {
  const s = WORLD.data.spawn, R0 = RNG(90210), sunAz = lobbySunAz(), far = Math.min(1500, PLAY * 0.7);
  let best = null, bs = -1e9;
  const rockCells = new Map(), rocksAround = (x, z, r) => {
    const out = []; if (!SCAN.ready) return out;
    for (let i = Math.floor((x - r) / VCELL); i <= Math.floor((x + r) / VCELL); i++) for (let j = Math.floor((z - r) / VCELL); j <= Math.floor((z + r) / VCELL); j++) {
      const k = vkey(i, j); let c = rockCells.get(k); if (!c) { try { c = RCELLS.get(k) || genRockCell(i, j); } catch (_) { c = { rocks: [] }; } rockCells.set(k, c); }
      for (const q of c.rocks || []) if (Math.hypot(q.x - x, q.z - z) < r + (q.r || 1)) out.push(q);
    }
    return out;
  };
  for (let k = 0; k < 1400; k++) {
    const a = R0() * TAU, d = 120 + R0() * far, x = s.x + Math.cos(a) * d, z = s.z + Math.sin(a) * d;
    if (!inPlay(x, z)) continue;
    const b = biomeAt(x, z); if (relaxed ? (b === 0 || b === 12 || b === 13) : !cfg.bio.includes(b)) continue;
    const h = terrainAt(x, z); if (h < waterAt(x, z) + 2 || h > 170) continue;
    if (slopeAt(x, z) > (relaxed ? 0.16 : 0.1) || (!relaxed && forestAt(x, z) < cfg.forest) || (cfg.warm && tempAt(x, z) < 0.4) || classAt(x, z) === 8) continue;
    if (roadDist(x, z) < 28 || nearSettlement(x, z, 1.5) || buildingAt(x, z, h + 1)) continue;
    const trees = [];
    for (let i = Math.floor((x - 40) / VCELL); i <= Math.floor((x + 40) / VCELL); i++) for (let j = Math.floor((z - 40) / VCELL); j <= Math.floor((z + 40) / VCELL); j++)
      for (const t of cellAt(i, j).trees) { const dd = Math.hypot(t.x - x, t.z - z); if (dd < 40) trees.push([t, dd]); }
    if (trees.some(([t, dd]) => dd < (t.bush ? 2.6 : 3.4))) continue;
    // nothing tall between the survivor and the sun (a bright face, not a shadow)
    if (trees.some(([t, dd]) => !t.bush && dd < 22 && Math.abs(angDiff(Math.atan2(t.x - x, t.z - z), sunAz)) < 0.3)) continue;
    const rocks = rocksAround(x, z, 8);
    for (const side of [-1, 1]) {
      const phi = sunAz + side * 0.85, cx = Math.sin(phi), cz = Math.cos(phi);
      let blocked = false, back = 0, near = 0, flank = 0;
      for (const [t, dd] of trees) {
        const rx = t.x - x, rz = t.z - z, along = rx * cx + rz * cz, lat = Math.abs(rx * cz - rz * cx);
        if (along > 0.2 && along < 7.5 && lat < (t.bush ? 1.7 : 1.5) + along * 0.2) { blocked = true; break; }
        if (along < -3 && dd < 34) { back++; if (dd < 16) near++; }
        if (Math.abs(along) < 6 && lat > 3 && lat < 14) flank++;
      }
      if (blocked || back < (relaxed ? 0 : cfg.back)) continue;
      for (const q of rocks) { const rx = q.x - x, rz = q.z - z, along = rx * cx + rz * cz, lat = Math.abs(rx * cz - rz * cx); if ((Math.hypot(rx, rz) < 2.2 + (q.r || 1)) || (along > 0 && along < 7 && lat < 1.5 + (q.r || 1))) { blocked = true; break; } }
      if (blocked) continue;
      let high = false; for (let q = 1; q <= 6; q++) if (terrainAt(x + cx * q, z + cz * q) > h + 0.85) high = true; if (high) continue;
      const score = back + near * 1.6 + Math.min(flank, 8) * 0.8 + forestAt(x, z) * 12 - d * 0.003 - slopeAt(x, z) * 40;
      if (score > bs) { bs = score; best = { x, z, y: h, phi }; }
    }
  }
  return best ? lobbyClear(best) : null;
}
function lobbyClear(best) {
  best.y = groundAt(best.x, best.z, best.y + 1);
  // a trodden camp: short grass round the survivor and along the view
  CLEARINGS.push({ x: best.x, z: best.z, r: 3.4 });
  for (const q of [1.6, 3.0, 4.4]) CLEARINGS.push({ x: best.x + Math.sin(best.phi) * q, z: best.z + Math.cos(best.phi) * q, r: 2.0 + q * 0.12 });
  grassDirtyArea(best.x, best.z, 12);
  return best;
}

/* ── the survivor in the lobby: its own body, dressed from the wardrobe (and from what you are trying on in the store) ── */
function lobbyLook() {
  const W = Object.assign({}, ACCOUNT.look), P = LOBBY.preview;
  if (P) { const it = ITEMS[P]; if (it) { const sl = it.wear.slot; if (sl === 'body' && P === 'outfit_soldier') delete W.body; else W[sl] = P; if (SUIT_PARTS.includes(sl)) delete W.suit; } }
  return outfitFromWearing(W);
}
function lobbyBuildBody() {
  const o = lobbyLook(), kind = CHARS[o.body] ? o.body : 'soldier';
  if (LOBBY.body && LOBBY.kind === kind) { dressBody(LOBBY.body, o); return; }
  if (LOBBY.body) { if (LOBBY.body.root.parent) LOBBY.body.root.parent.remove(LOBBY.body.root); LOBBY.body = null; }
  const body = makeBody(kind, { outfit: o }); if (!body) return;
  body.root.updateMatrixWorld(true);
  const hand = boneLocal(body, 'RightHand'), axe = buildTool('axe', 'iron');
  attachAt(body.root, body.bones.RightHand, axe, hand.x, hand.y - 0.03, hand.z + 0.02, Math.PI / 2, 0, 0);
  (VIEW.scene || scene).add(body.root); LOBBY.body = body; LOBBY.kind = kind;
  body.root.visible = LOBBY.on;
}
function lobbyDress() { if (!LOBBY.body) return; lobbyBuildBody(); LOBBY.avaWant = true; LOBBY.avaAt = T + 0.5; }
function onLookChanged() { if (LOBBY.on) { lobbyDress(); if (LOBBY.sheet) renderSheet(); } }

/* ── the camera: a portrait of the survivor; it slides aside when a panel opens ── */
const _lf = new THREE.Vector3();
function lobbyPose(t, outPos, outLook) {
  const S = LOBBY.spot, phi = S.phi, fx = Math.sin(phi), fz = Math.cos(phi), rx = fz, rz = -fx;
  const asp = Math.max(0.5, camera.aspect), vf = THREE.MathUtils.degToRad(camera.fov), hf = Math.atan(Math.tan(vf / 2) * asp);
  // a room may set its own portrait: a lower camera looking up shows a high ceiling (the whale in Hintze Hall)
  const dist = Math.min(S.maxDist || 99, 4.15 * (S.dist || 1) * (asp < 1.25 ? 1.45 : 1) * (LOBBY.zoom || 1)), off = LOBBY.shift * 0.5 * dist * Math.tan(hf);
  const sway = SET.motion ? 0 : Math.sin(t * 0.21) * 0.05;
  outPos.set(S.x + fx * dist + rx * (off + sway), S.y + (S.camY || 1.2) + (SET.motion ? 0 : Math.sin(t * 0.17) * 0.03), S.z + fz * dist + rz * (off + sway));
  outLook.set(S.x + rx * off, S.y + (S.lookY || 0.97), S.z + rz * off);
}
function lobbyFrame(dt) {
  const S = LOBBY.spot, b = LOBBY.body;
  ENV.hour = LOBBY.hour;
  LOBBY.shift = damp(LOBBY.shift, LOBBY.shiftT, 6, dt);
  if (!LOBBY.drag) { LOBBY.rot += LOBBY.rotV * dt; LOBBY.rotV *= Math.exp(-dt * 3.2); }
  if (b) {
    b.root.position.set(S.x, S.y, S.z); b.root.rotation.set(0, S.phi + LOBBY.rot, 0);
    b.mixer.update(dt);
    b.root.updateMatrixWorld(true);
    if (!SET.motion) boneTurn(b.bones.Neck, UP, Math.sin(T * 0.37) * 0.12 + Math.sin(T * 0.11) * 0.08);
  }
  camera.position.copy(aPos); camera.lookAt(aLook);
  if (VIEW.scene) { AUDIO.musicUpdate(); if ((LOBBY.uiT -= dt) <= 0) { LOBBY.uiT = 1; lobbyRefresh(false); } return; }      // in a scanned room: its own lights
  placeSun(S.x, S.y, S.z); updateLightPool(dt);
  // a soft fill light in front of the face (borrowed from the lamp pool)
  const L = POOL[POOL.length - 1];
  L.position.set(S.x + Math.sin(S.phi + 0.6) * 2.2, S.y + 2.0, S.z + Math.cos(S.phi + 0.6) * 2.2); L.color.setRGB(1, 0.9, 0.78); L.distance = 8; L.intensity = 2.2;
  AUDIO.musicUpdate(); AUDIO.lobbyAmb(dt);
  if ((LOBBY.uiT -= dt) <= 0) { LOBBY.uiT = 1; lobbyRefresh(false); }
}
/* the profile picture: a close-up of the face rendered through the full pipeline, cut square from the frame */
const _avaHead = new THREE.Vector3(), _avaP = new THREE.Vector3(), _avaQ = new THREE.Quaternion();
function lobbyAvatar() {
  if (!LOBBY.on || !LOBBY.avaWant || !LOBBY.body || T < LOBBY.avaAt) return;
  LOBBY.avaWant = false;
  try {
    const b = LOBBY.body, yaw = LOBBY.spot.phi + LOBBY.rot; b.bones.Head.getWorldPosition(_avaHead);
    _avaP.copy(camera.position); _avaQ.copy(camera.quaternion); const fov = camera.fov;
    camera.position.set(_avaHead.x + Math.sin(yaw + 0.25) * 0.9, _avaHead.y + 0.05, _avaHead.z + Math.cos(yaw + 0.25) * 0.9);
    camera.lookAt(_avaHead.x, _avaHead.y + 0.02, _avaHead.z); camera.fov = 26; camera.updateProjectionMatrix();
    POST.render(0);
    const c = renderer.domElement, sz = Math.min(c.width, c.height) * 0.92, g = $('lbAva').getContext('2d');
    g.drawImage(c, (c.width - sz) / 2, (c.height - sz) / 2, sz, sz, 0, 0, 128, 128);
    camera.position.copy(_avaP); camera.quaternion.copy(_avaQ); camera.fov = fov; camera.updateProjectionMatrix();
    try { LOBBY.avaURL = $('lbAva').toDataURL('image/jpeg', 0.82); } catch (_) {}
    HOOK.ava();
  } catch (e) { console.warn('avatar', e); }
}
function avatarPlaceholder() {
  const g = $('lbAva').getContext('2d'); if (!g) return;
  const gr = g.createLinearGradient(0, 0, 128, 128); gr.addColorStop(0, '#2b4a5a'); gr.addColorStop(1, '#14222c'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#f2f6f1'; g.font = "700 64px 'Readex Pro',sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText((ACCOUNT.name || '؟').slice(0, 1), 64, 70);
}

/* ── entering and leaving ── */
function weatherSnap() { const W = WEATHER; return { state: W.state, target: W.target, t: W.t, cloud: W.cloud, rain: W.rain, fog: W.fog, wind: W.wind, wet: W.wet, storm: W.storm, snow: W.snow }; }
function prepareAround(x, y, z) {
  TERRAIN.update(0.016, x, y + 2, z, true);
  updateSettlements(0.016, x, z, true); updateVegetation(0.016, x, z, true); updateGrass(0.016, x, z, true); updateRocks(0.016, x, z, true);
  updateRoadLod(0, true); ENVMAP.update(0, true);
}
function enterLobby(instant) {
  if (LOBBY.on || !BOOT.ready) return;
  if (!LOBBY.spot) LOBBY.spot = findLobbySpot();
  LOBBY.on = true; LOBBY.saved = { hour: ENV.hour, W: weatherSnap() };
  ENV.hour = LOBBY.hour;
  Object.assign(WEATHER, LOBBY_W, { wet: 0, snow: 0 }); WEATHER.target = LOBBY_W; WEATHER.state = 'lobby'; WEATHER.lock = true;
  lobbyBuildBody(); if (LOBBY.body) LOBBY.body.root.visible = true;
  const S = LOBBY.spot; LOBBY.rot = 0; LOBBY.rotV = 0; LOBBY.shift = LOBBY.shiftT = 0;
  camera.fov = 34; camera.updateProjectionMatrix();
  updateEnvironment(0, false); lobbyPose(T, aPos, aLook); camera.position.copy(aPos); camera.lookAt(aLook);
  prepareAround(S.x, S.y, S.z);
  $('lobby').classList.remove('gone'); $('intro').classList.add('gone'); hud.classList.remove('on');
  setTimeout(() => { if ($('intro').classList.contains('gone')) BOOTFILM.stop(); }, 900);
  applyOrientation();
  AUDIO.music(true);
  rollMissions(); lobbyRefresh(true); renderBanners();
  LOBBY.avaWant = true; LOBBY.avaAt = T + (instant ? 1.2 : 0.6);
  setTimeout(() => { if (LOBBY.on && ACC.loaded && !ACCOUNT.named) firstRun(); }, 700);
  lobbyBackdrop(true);
}
function leaveLobbyScene() {
  if (!LOBBY.on) return;
  roomOff();
  LOBBY.on = false; closeSheet(); closeModal();
  if (LOBBY.body) LOBBY.body.root.visible = false;
  if (LOBBY.saved) { ENV.hour = LOBBY.saved.hour; const w = LOBBY.saved.W; Object.assign(WEATHER, w); }
  WEATHER.lock = false; if (WEATHER.state === 'lobby') setWeather('fair');
  $('lobby').classList.add('gone'); AUDIO.music(false);
  POOL[POOL.length - 1].intensity = 0;
}
const fadeTo = (on) => new Promise((res) => { $('fader').classList.toggle('on', on); setTimeout(res, SET.motion ? 120 : 380); });
async function playFromLobby(force) {
  if (LOBBY.busy || !BOOT.ready || !LOBBY.on) return;
  if (!force && HOOK.play()) return;
  LOBBY.busy = true; firstGesture(); AUDIO.ui(2);
  await fadeTo(true);
  try {
    leaveLobbyScene();
    // every journey starts aboard the cargo plane: jump where you want (or land at your saved spot)
    if (SET.planeDrop !== false && !player.vehicle) {
      boardPlane(); const p = player.pos; prepareAround(p.x, p.y, p.z);
      aPos.copy(p); aLook.copy(p); begin(true);
    } else {
      const p = player.pos; prepareAround(p.x, p.y, p.z);
      const fx = Math.sin(player.yaw), fz = Math.cos(player.yaw);
      aPos.set(p.x - fx * 9, p.y + 4.6, p.z - fz * 9); aLook.set(p.x, p.y + 1.3, p.z);
      begin(SET.motion);
    }
  } catch (e) { console.error(e); }
  await fadeTo(false);
  LOBBY.busy = false;
}
async function toLobby() {
  if (LOBBY.on || LOBBY.busy) return;
  LOBBY.busy = true;
  if (started) { saveNow(); accFlush(); }
  await fadeTo(true);
  try {
    if (started) {
      started = false; paused = false; $('pause').classList.add('gone'); closeCraft(); if (chartOpen) toggleChart(false); if (BUILD.ghost) cancelBuild();
      input.act = false; input.aim = false; if (document.exitPointerLock && locked) document.exitPointerLock(); AUDIO.engine(false);
      hud.classList.remove('on');
    }
    enterLobby(); HOOK.lobby();
  } catch (e) { console.error(e); }
  await fadeTo(false);
  LOBBY.busy = false;
}
async function exitToTitle() {
  closeModal(); accFlush();
  await fadeTo(true);
  leaveLobbyScene();
  $('intro').classList.remove('gone'); $('intro').classList.add('ready', 'menu'); BOOTFILM.play();
  $('startBtn').hidden = false; $('startBtn').disabled = false; $('startBtn').textContent = 'ادخل';
  $('loadNote').textContent = 'رحلتك وحسابك محفوظان. ادخل متى شئت.';
  AUDIO.music(true);
  await fadeTo(false);
}
let gestured = false;
function firstGesture() {
  if (gestured) return; gestured = true;
  if (SET.vMaster > 0 && !AUDIO.on) { AUDIO.setOn(true); AUDIO.music(LOBBY.on || !started); }
  $('soundBtn').setAttribute('aria-pressed', String(AUDIO.on)); $('bootSound').setAttribute('aria-pressed', String(AUDIO.on));
  if (TOUCH) goLandscape();
}
$('lobby').addEventListener('pointerdown', firstGesture, true);
// on the boot screen any tap brings the music in; the speaker turns it off and on again
$('intro').addEventListener('pointerdown', (e) => { if (e.target.closest && e.target.closest('#bootSound')) return; firstGesture(); }, true);
$('bootSound').addEventListener('click', () => {
  if (!gestured) { firstGesture(); return; }
  const on = !AUDIO.on; AUDIO.setOn(on); if (on) AUDIO.music(LOBBY.on || !started);
  $('bootSound').setAttribute('aria-pressed', String(AUDIO.on)); $('soundBtn').setAttribute('aria-pressed', String(AUDIO.on));
});

/* drag the survivor round */
canvas.addEventListener('pointerdown', (e) => {
  if (!LOBBY.on) return; firstGesture();
  LOBBY.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() }; LOBBY.rotV = 0;
  try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
});
canvas.addEventListener('pointermove', (e) => {
  const d = LOBBY.drag; if (!d || d.id !== e.pointerId || !LOBBY.on) return;
  const [dx] = toLocal(e.clientX - d.x, e.clientY - d.y), now = performance.now(), k = 0.012;
  LOBBY.rot += dx * k; LOBBY.rotV = lerp(LOBBY.rotV, dx * k / Math.max(0.008, (now - d.t) / 1000), 0.4);
  d.x = e.clientX; d.y = e.clientY; d.t = now;
  if (!LOBBY.hinted && Math.abs(LOBBY.rot) > 0.5) { LOBBY.hinted = true; $('lbHint').style.opacity = '0'; }
});
const lbDragEnd = (e) => { const d = LOBBY.drag; if (d && d.id === e.pointerId) { LOBBY.rotV = performance.now() - d.t > 90 ? 0 : clamp(LOBBY.rotV, -6, 6); LOBBY.drag = null; } };
canvas.addEventListener('pointerup', lbDragEnd); canvas.addEventListener('pointercancel', lbDragEnd);

/* ── the screen ── */
const fmtN = (n) => toAr(Math.floor(n).toLocaleString('en-US'));
function lbToast(title, sub) {
  let el = $('lbToast'); if (!el) { el = document.createElement('div'); el.id = 'lbToast'; el.className = 'glass'; el.style.cssText = 'position:absolute;left:50%;top:18%;transform:translateX(-50%);z-index:9;padding:10px 18px;border-radius:14px;font-weight:700;font-size:14px;text-align:center;pointer-events:none;transition:opacity .3s;max-width:80vw;'; $('lobby').append(el); }
  el.innerHTML = ''; el.append(title); if (sub) { const s = document.createElement('small'); s.style.cssText = 'display:block;font-weight:400;font-size:12px;color:var(--sand);margin-top:2px;'; s.textContent = sub; el.append(s); }
  el.style.opacity = '1'; clearTimeout(el._t); el._t = setTimeout(() => { el.style.opacity = '0'; }, 2600);
}
let _lbSig = '';
function lobbyRefresh(force) {
  if (!ACC.loaded) return;
  const A = ACCOUNT, need = xpNeed(A.level), cl = claimable();
  const sig = [A.name, A.id, A.level, Math.floor(A.xp), A.gold, A.gems, A.shards, A.title, (A.titles || []).length, A.life.kills | 0, cl.missions, cl.training, JSON.stringify(A.crates)].join('|');
  if (!force && sig === _lbSig) return; _lbSig = sig;
  $('lbName').textContent = A.name; $('lbId').textContent = A.id; $('lbLv').textContent = toAr(A.level);
  $('lbXp').style.transform = `scaleX(${clamp(A.xp / need, 0, 1)})`; $('lbXpT').textContent = 'المستوى ' + toAr(A.level) + ' · ' + fmtN(A.xp) + ' / ' + fmtN(need) + ' خبرة';
  document.querySelector('.lb-ava').style.setProperty('--lvp', Math.round(clamp(A.xp / need, 0, 1) * 100) + '%');
  $('lbKills').textContent = fmtN(A.life.kills || 0); $('lbGold').textContent = fmtN(A.gold); $('lbGems').textContent = fmtN(A.gems); if ((A.shards || 0) >= 10 && typeof combineShards === 'function') { let n = 0; while (combineShards()) n++; if (n) lbToast('عشر قطع = صندوق', 'صار عندك ' + toAr(n) + ' صندوق كلاسيكي جديد في «صناديقي»'); }
  $('lbShards').textContent = toAr(A.shards || 0) + '/١٠';
  $('lbTitle').textContent = A.title ? '«' + titleName(A.title) + '»' + (A.clan && typeof clanTag === 'function' ? ' · ' + clanTag() : '') : (A.clan && typeof clanTag === 'function' ? clanTag() : '');
  const owned = Object.values(A.crates || {}).reduce((a, b) => a + b, 0) + ((A.shards || 0) >= 10 ? 1 : 0), dc = $('dotCrates'); dc.hidden = !owned; dc.textContent = toAr(owned);
  const newT = (A.titles || []).length - (A.seen.titles || 0), dtt = $('dotTitles'); dtt.hidden = newT <= 0; dtt.textContent = toAr(Math.max(0, newT));
  const dm = $('dotMissions'); dm.hidden = !cl.missions; dm.textContent = toAr(cl.missions);
  const dt2 = $('dotTraining'); dt2.hidden = !cl.training; dt2.textContent = toAr(cl.training);
  const m = MAPS.find((q) => q.id === LOBBY.map) || MAPS[0];
  $('lbModeName').textContent = m.name; $('lbModeSub').textContent = (LOBBY.mode === 'solo' ? 'فردي' : 'مع الأصدقاء') + ' · ' + m.size + ' ▾';
  if (!LOBBY.avaURL) avatarPlaceholder();
}
ACC.listeners.push(() => { if (LOBBY.on) lobbyRefresh(false); });
$('lbKillI').innerHTML = lbIcon('skull'); $('lbGoldI').innerHTML = lbIcon('coin'); $('lbGemI').innerHTML = lbIcon('gem'); $('lbShardI').innerHTML = lbIcon('shard');
$('lbSet').innerHTML = lbIcon('gear'); $('lbExit').innerHTML = lbIcon('exit'); $('lbSheetX').innerHTML = svg('close');
for (const el of document.querySelectorAll('#lobby .si')) el.innerHTML = lbIcon(el.dataset.i);
for (const b of document.querySelectorAll('#lobby [data-sheet]')) b.addEventListener('click', () => { AUDIO.ui(); if (LOBBY.sheet === b.dataset.sheet) closeSheet(); else openSheet(b.dataset.sheet); });
$('lbPlay').addEventListener('click', () => playFromLobby());
$('lbSet').addEventListener('click', () => { AUDIO.ui(); openSettings(); });
$('lbExit').addEventListener('click', () => { AUDIO.ui(); openModal('exit'); });
$('lbGoldAdd').addEventListener('click', () => { AUDIO.ui(); openModal('gold'); });
$('lbGemAdd').addEventListener('click', () => { AUDIO.ui(); openModal('topup'); });
$('lbProfile').addEventListener('click', () => { AUDIO.ui(); openModal('profile'); });
$('lbMode').addEventListener('click', () => { AUDIO.ui(); openModal('map'); });
$('lbCredits').addEventListener('click', () => { AUDIO.ui(); openModal('credits'); });
$('lbSheetX').addEventListener('click', () => closeSheet());
$('lbModal').addEventListener('click', (e) => { if (e.target.id === 'lbModal') closeModal(); });
addEventListener('keydown', (e) => {
  if (!LOBBY.on || settingsOpen || (e.target && e.target.tagName === 'INPUT')) return;
  if (e.code === 'Escape') { if (!$('lbModal').hidden) closeModal(); else if (LOBBY.sheet) closeSheet(); }
  if (e.code === 'Enter' && $('lbModal').hidden && !LOBBY.sheet && (document.activeElement === document.body || document.activeElement === canvas)) playFromLobby();
});

/* banners on the right: pictures from the island and what is coming */
const BANNERS = [
  { img: 'assets/ui/ban_lands.webp', t: 'معالم حقيقية على الخرائط', s: 'قلعة الصخرة · الكاتدرائية البيضاء · شارع ما بعد المطر · المستودع المهجور', tag: 'جديد', go: () => lbToast('افتح الخريطة في اللعبة', 'قائمة «المعالم» بجانب الخريطة تريك مكان كل معلم، واضغط «انتقال» لتصل إليه') },
  { img: 'assets/ui/ban_maps.webp', t: 'خمس خرائط جديدة', s: 'الثلج · الغابات · الصحراء · عالم الماء · القارة الكبرى', tag: 'جديد', go: () => openModal('map') },
  { img: 'assets/ui/ban_suit.webp', t: 'بدلة النخبة الذهبية', s: 'في المتجر الآن · ١٠ بدلات كاملة', tag: 'جديد', go: () => openSheet('store', 'featured') },
  { img: 'assets/ui/ban_missions.webp', t: 'مهام اليوم', s: 'ذهب وخبرة كل يوم وكل أسبوع', go: () => openSheet('missions', 'daily') },
];
function renderBanners() {
  const box = $('lbBanners'); if (box.childElementCount) return;
  for (const B of BANNERS) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'lb-ban';
    b.style.backgroundImage = `url("${B.img}"), linear-gradient(135deg,#2b5a4a,#1a2630)`;
    b.innerHTML = (B.tag ? `<i></i>` : '') + '<span><b></b><small></small></span>';
    if (B.tag) b.querySelector('i').textContent = B.tag; b.querySelector('b').textContent = B.t; b.querySelector('small').textContent = B.s;
    b.addEventListener('click', () => { AUDIO.ui(); B.go(); }); box.append(b);
  }
}

/* ── side panels ── */
const SHEETS = {
  wardrobe: { t: 'المخزن', rail: true, sub: () => toAr(ACCOUNT.wardrobe.length) + ' قطعة · المس لتلبس أو تنزع', chips: [['suit', 'البدلات'], ['top', 'القمصان'], ['pants', 'السراويل'], ['shoes', 'الأحذية'], ['hat', 'القبعات والخوذ'], ['glasses', 'النظارات'], ['hands', 'القفازات'], ['chute', 'المظلات'], ['body', 'الشخصية']] },
  store: { t: 'المتجر', rail: true, sub: () => 'بالذهب والجواهر التي تكسبها في اللعب', chips: [['deals', 'عروض اليوم'], ['featured', 'بدلات'], ['top', 'قمصان'], ['pants', 'سراويل'], ['shoes', 'أحذية'], ['hat', 'قبعات'], ['glasses', 'نظارات'], ['hands', 'قفازات'], ['mat', 'المواد']] },
  crates: { t: 'الصناديق', rail: true, sub: () => '', chips: [['premium', 'المميز'], ['classic', 'الكلاسيكي'], ['soldier', 'الجندي'], ['arms', 'الأسلحة'], ['mine', 'صناديقي']] },
  upgrade: { t: 'تطوير السلاح', rail: true, sub: () => toAr(ACCOUNT.mat || 0) + ' مادة تطوير', get chips() { return Object.keys(WSKINS).map((k) => [k, WEAPONS[WSKINS[k].gun].name]); } },
  workshop: { t: 'المعمل', sub: () => 'ترقيات دائمة تبقى بعد السقوط' },
  missions: { t: 'المهام', rail: true, sub: () => '', chips: [['daily', 'اليومية'], ['weekly', 'الأسبوعية'], ['ach', 'الإنجازات']] },
  titles: { t: 'الألقاب', rail: true, sub: () => toAr((ACCOUNT.titles || []).length) + ' من ' + toAr(TITLES.length), chips: [['all', 'الكل'], ['easy', 'سهلة'], ['medium', 'متوسطة'], ['hard', 'صعبة'], ['legend', 'صعبة جداً']] },
  clan: { t: 'العشيرة', sub: () => '' },
  training: { t: 'التدريب', sub: () => 'خطوات النجاة الأولى · لكل خطوة جائزة' },
  friends: { t: 'الأصدقاء', sub: () => 'آيديك: ' + ACCOUNT.id },
};
function openSheet(name, sub) {
  const S = SHEETS[name]; if (!S) return;
  closeModal();
  LOBBY.sheet = name; LOBBY.sub = sub || (S.chips ? S.chips[0][0] : null); LOBBY.more = 0;
  $('lbSheet').classList.toggle('rail', !!S.rail);
  if (name === 'titles') { ACCOUNT.seen.titles = (ACCOUNT.titles || []).length; accSoon(); }
  if (name !== 'store' && LOBBY.preview) { LOBBY.preview = null; lobbyDress(); }
  $('lbSheet').hidden = false; LOBBY.shiftT = 1; $('lbBanners').style.visibility = 'hidden'; $('lbHint').style.opacity = '0';
  for (const b of document.querySelectorAll('#lobby [data-sheet]')) b.setAttribute('aria-pressed', String(b.dataset.sheet === name));
  renderSheet();
}
function closeSheet() {
  if (!LOBBY.sheet) return;
  const hadPreview = !!LOBBY.preview; LOBBY.sheet = null; LOBBY.preview = null; $('lbSheet').hidden = true; LOBBY.shiftT = 0; $('lbBanners').style.visibility = '';
  for (const b of document.querySelectorAll('#lobby [data-sheet]')) b.setAttribute('aria-pressed', 'false');
  if (hadPreview) lobbyDress();
}
function chipRow(chips, cur, onPick, dots) {
  const nav = $('lbChips'); nav.innerHTML = ''; nav.hidden = !chips;
  if (!chips) return;
  for (const [k, label] of chips) { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.setAttribute('aria-pressed', String(k === cur)); if (dots && dots[k]) { const d = document.createElement('i'); d.className = 'dot'; d.style.cssText = 'top:-5px;right:-4px;'; d.textContent = toAr(dots[k]); b.append(d); } b.addEventListener('click', () => { AUDIO.ui(); onPick(k); }); nav.append(b); }
}
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
function btn2(label, fn, cls = 'lbtn', disabled) { const b = el('button', cls); b.type = 'button'; b.innerHTML = label; b.disabled = !!disabled; b.addEventListener('click', (e) => { e.stopPropagation(); fn(); }); return b; }
const priceHTML = (it) => it.gemPrice ? `<span class="price m">${svg('gem')}${toAr(it.gemPrice)}</span>` : `<span class="price g">${svg('coin')}${fmtN(goldPrice(it))}</span>`;
const SLOT_AR = { suit: 'بدلة كاملة', top: 'قميص', pants: 'بنطال', shoes: 'حذاء', hands: 'قفازات', hat: 'غطاء رأس', glasses: 'نظارة', body: 'هيئة' };
function renderSheet() {
  const name = LOBBY.sheet; if (!name) return;
  const S = SHEETS[name], body = $('lbBody');
  $('lbSheetT').textContent = S.t; $('lbSheetSub').textContent = S.sub();
  body.innerHTML = ''; body.scrollTop = 0;
  if (name === 'wardrobe') renderWardrobe(body);
  else if (name === 'store') renderStore(body);
  else if (name === 'workshop') { chipRow(null); renderWorkshop(body); }
  else if (name === 'missions') renderMissions(body);
  else if (name === 'training') { chipRow(null); renderTraining(body); }
  else if (name === 'friends') { chipRow(null); (SHEET_EXTRA.friends || renderFriends)(body); }
  else if (name === 'crates') renderCrates(body);
  else if (name === 'upgrade') renderUpgrade(body);
  else if (name === 'titles') renderTitles(body);
  else if (name === 'clan') { chipRow(null); renderClan(body); }
}
function itemCard(it, opts = {}) {
  const c = el('div', 'lb-item' + (opts.on ? ' on' : '') + (opts.try ? ' try' : ''));
  c.innerHTML = `<span class="sw">${itemIcon(it)}</span><b></b><small></small>`;
  c.querySelector('b').textContent = it.name; c.querySelector('small').textContent = opts.small || SLOT_AR[it.wear.slot] || '';
  if (opts.own) c.append(el('span', 'own', '✓ لديك'));
  if (it.gemPrice) c.append(el('span', 'tagp', 'مميز'));
  if (opts.price) { const p = el('div'); p.innerHTML = priceHTML(it); c.append(p.firstChild); }
  if (opts.btn) c.append(opts.btn);
  if (opts.onTap) { c.style.cursor = 'pointer'; c.addEventListener('click', opts.onTap); }
  return c;
}
function rarCard(it, opts = {}) {
  const rar = rarOf(it), R0 = RARITY[rar], c = el('div', 'lb-rcard' + (opts.on ? ' on' : '') + (opts.try ? ' try' : ''));
  c.style.setProperty('--rbg', R0.bg); c.style.setProperty('--rc', R0.col);
  c.innerHTML = `<span class="rr">${R0.ar}</span><span class="sw">${itemIcon(it)}</span><b></b>`;
  c.querySelector('b').textContent = it.name;
  if (opts.on) c.append(el('span', 'wearing', 'ملبوس'));
  if (opts.price) { const p = el('div', 'rp'); p.innerHTML = priceHTML(it); c.append(p); }
  if (opts.own && opts.price === undefined) c.append(el('span', 'own2', '✓'));
  if (opts.onTap) { c.style.cursor = 'pointer'; c.addEventListener('click', opts.onTap); }
  return c;
}
function renderWardrobe(body) {
  chipRow(SHEETS.wardrobe.chips, LOBBY.sub, (k) => { LOBBY.sub = k; renderSheet(); });
  const slot = LOBBY.sub, look = ACCOUNT.look;
  const top = el('div', 'lb-row slim');
  const worn = COS_SLOTS.filter((s) => look[s] && ITEMS[look[s]]).map((s) => ITEMS[look[s]].name);
  top.innerHTML = `<span class="rb"><b>ما تلبسه</b><span></span></span>`; top.querySelector('.rb span').textContent = worn.length ? worn.join(' · ') : 'ملابس شخصيتك الأصلية';
  top.append(btn2('انزع الكل', () => { for (const s of COS_SLOTS) if (s !== 'body') delete ACCOUNT.look[s]; syncLookToRun(); accSoon(); applyOutfit(); AUDIO.equip(); renderSheet(); }, 'lbtn alt', !worn.length));
  body.append(top);
  if (look.suit && SUIT_PARTS.includes(slot)) body.append(el('p', 'lb-note', 'تلبس بدلة كاملة الآن؛ اختيار قطعة هنا يخلعها.'));
  const grid = el('div', 'lb-rgrid');
  const owned = [...new Set(ACCOUNT.wardrobe.concat(slot === 'body' ? ['outfit_casual', 'outfit_blonde', 'outfit_soldier'].filter((id) => CHARS[ITEMS[id].wear.body]) : []))].map((id) => ITEMS[id]).filter((it) => it && it.wear && it.wear.slot === slot);
  if (slot !== 'body') {
    const none = el('div', 'lb-rcard none' + (!look[slot] ? ' on' : '')); none.innerHTML = `<span class="sw">${svg('close', '', '#8a9aa4')}</span><b>بدون</b>`;
    none.style.cursor = 'pointer'; none.addEventListener('click', () => { takeOff(slot); renderSheet(); }); grid.append(none);
  }
  for (const it of owned.sort((a, b) => RAR_ORDER.indexOf(rarOf(b)) - RAR_ORDER.indexOf(rarOf(a)) || a.name.localeCompare(b.name, 'ar'))) {
    const on = slot === 'body' ? (look.body || 'outfit_soldier') === it.id : look[slot] === it.id;
    grid.append(rarCard(it, { on, onTap: () => { if (on && slot !== 'body') takeOff(slot); else wearItem(it.id, true); AUDIO.equip(); renderSheet(); } }));
  }
  body.append(grid);
  if (owned.length < 2 && slot !== 'body') { body.append(el('p', 'lb-note', 'افتح الصناديق أو اشترِ من المتجر: كل ما تحصل عليه يبقى في مخزنك للأبد.')); body.append(btn2('الصناديق', () => openSheet('crates'), 'lbtn')); }
}
function storeList(cat) {
  return ITEM_LIST.filter((it) => isCosmetic(it) && it.id !== 'outfit_soldier' && (cat === 'featured' ? (it.wear.slot === 'suit' || it.wear.slot === 'body') : it.wear.slot === cat))
    .sort((a, b) => (ownsWear(a.id) - ownsWear(b.id)) || ((b.gemPrice || 0) - (a.gemPrice || 0)) || (goldPrice(b) - goldPrice(a)));
}
function renderStore(body) {
  chipRow(SHEETS.store.chips, LOBBY.sub, (k) => { LOBBY.sub = k; LOBBY.more = 0; renderSheet(); });
  if (LOBBY.sub === 'mat') { renderMatShop(body); return; }
  if (LOBBY.sub === 'deals') { renderDeals(body); return; }
  const P = LOBBY.preview && ITEMS[LOBBY.preview];
  if (P) {
    const r = el('div', 'lb-row'); r.innerHTML = `<span class="ri">${itemIcon(P)}</span><span class="rb"><b></b><span>تجرّبها الآن على شخصيتك</span></span>`; r.querySelector('b').textContent = P.name;
    if (!ownsWear(P.id)) r.append(btn2('اشترِ ' + (P.gemPrice ? toAr(P.gemPrice) + ' جوهرة' : fmtN(goldPrice(P)) + ' ذهب'), () => storeBuy(P.id), P.gemPrice ? 'lbtn gem' : 'lbtn'));
    r.append(btn2('إلغاء', () => { LOBBY.preview = null; lobbyDress(); renderSheet(); }, 'lbtn alt'));
    body.append(r);
  }
  const list = storeList(LOBBY.sub), grid = el('div', 'lb-grid'), N = 48 + LOBBY.more;
  for (const it of list.slice(0, N)) {
    const own = ownsWear(it.id), worn = Object.values(ACCOUNT.look).includes(it.id);
    const b = own ? btn2(worn ? 'ملبوس' : 'البس', () => { LOBBY.preview = null; wearItem(it.id, true); renderSheet(); }, 'lbtn alt', worn)
      : btn2('اشترِ', () => storeBuy(it.id), it.gemPrice ? 'lbtn gem' : 'lbtn');
    grid.append(itemCard(it, { own, price: !own, try: LOBBY.preview === it.id, btn: b, onTap: () => { LOBBY.preview = LOBBY.preview === it.id ? null : it.id; lobbyDress(); renderSheet(); } }));
  }
  body.append(grid);
  if (list.length > N) body.append(btn2('عرض المزيد (' + toAr(list.length - N) + ')', () => { LOBBY.more += 48; renderSheet(); }, 'lbtn alt'));
}
function storeBuy(id) {
  const r = buyWear(id), it = ITEMS[id];
  if (r === 'ok') { wearItem(id, true); LOBBY.preview = null; lbToast('اشتريت ' + it.name + '!', 'في خزانتك للأبد · ولبستها الآن'); }
  else if (r === 'gold') { lbToast('لا يكفي ذهبك', 'تحتاج ' + fmtN(goldPrice(it)) + ' ذهب · العب وأنجز المهام لتكسب أكثر'); AUDIO.dry(); }
  else if (r === 'gems') { lbToast('لا تكفي جواهرك', 'تحتاج ' + toAr(it.gemPrice) + ' جوهرة'); AUDIO.dry(); openModal('topup'); return; }
  renderSheet(); lobbyRefresh(true);
}
function renderWorkshop(body) {
  body.append(el('p', 'lb-note', 'كل ترقية تبقى معك للأبد، في كل حياة جديدة. تفتح خطواتها الأعلى كلما ارتفع مستواك.'));
  for (const u of UPGRADES) {
    const l = upgLevel(u.id), max = l >= u.max, c = max ? 0 : upgCost(u, l), req = max ? 0 : UPG_REQ[l], lockLv = !max && ACCOUNT.level < req;
    const r = el('div', 'lb-row' + (max ? ' done' : ''));
    const eff = (v) => u.fmt === 'add' ? '+' + toAr(Math.round(v)) + ' حمولة' : '+' + toAr(Math.round(v * 100)) + '٪';
    r.innerHTML = `<span class="ri">${svg(u.icon)}</span><span class="rb"><b></b><span></span><span class="lvdots">${Array.from({ length: u.max }, (_, i) => `<i class="${i < l ? 'on' : ''}"></i>`).join('')}</span></span>`;
    r.querySelector('b').textContent = u.name + (l ? ' · ' + eff(l * u.per) : '');
    r.querySelector('.rb span').textContent = u.desc + (max ? ' · اكتملت' : ' · التالي: ' + eff((l + 1) * u.per));
    r.append(btn2(max ? 'مكتملة' : lockLv ? svg('lock') + ' مستوى ' + toAr(req) : svg('coin') + ' ' + fmtN(c), () => {
      const res = buyUpgrade(u.id);
      if (res === 'ok') lbToast('طوّرت ' + u.name, 'المستوى ' + toAr(upgLevel(u.id)) + ' من ' + toAr(u.max));
      else if (res === 'gold') { lbToast('لا يكفي ذهبك', 'تحتاج ' + fmtN(c) + ' ذهب'); AUDIO.dry(); }
      else if (res === 'level') lbToast('تحتاج المستوى ' + toAr(req), 'العب لترفع مستواك');
      renderSheet(); lobbyRefresh(true);
    }, 'lbtn', max || lockLv || ACCOUNT.gold < c));
    body.append(r);
  }
}
const STAT_ICON = { kills: 'skull', wood: 'wood', stone: 'stone', felled: 'axe', crafted: 'hammer', built: 'wall', sec: 'clock', km: 'car', fish: 'fish', dug: 'shovel', rocks: 'pickaxe', eat: 'food', treasure: 'gem', hunted: 'bow', survBest: 'clock', level: 'bolt', wardrobe: 'shirt' };
const fmtStat = (stat, v) => stat === 'sec' || stat === 'survBest' ? (v >= 3600 ? toAr((v / 3600).toFixed(1)) + ' س' : toAr(Math.floor(v / 60)) + ' د') : stat === 'km' ? toAr((Math.floor(v * 10) / 10).toString()) : fmtN(v);
function rewardHTML(gold, xp, gems) { return `<span class="rw">${gold ? `<em class="g">${svg('coin')}${fmtN(gold)}</em>` : ''}${xp ? `<em class="x">${svg('bolt')}${fmtN(xp)} خبرة</em>` : ''}${gems ? `<em class="m">${svg('gem')}${toAr(gems)}</em>` : ''}</span>`; }
function missionRow(icon, text, have, need, stat, gold, xp, gems, state, onClaim) {
  const r = el('div', 'lb-row' + (state === 'ready' ? ' ready' : state === 'done' ? ' done' : ''));
  const f = clamp(have / need, 0, 1);
  r.innerHTML = `<span class="ri">${svg(icon)}</span><span class="rb"><b></b><span class="pbar"><i style="transform:scaleX(${f})"></i></span><span></span>${rewardHTML(gold, xp, gems)}</span>`;
  r.querySelector('b').textContent = text; r.querySelectorAll('.rb > span')[1].textContent = fmtStat(stat, Math.min(have, need)) + ' / ' + fmtStat(stat, need);
  r.append(btn2(state === 'done' ? 'استلمت' : 'استلم', onClaim, 'lbtn', state !== 'ready'));
  return r;
}
function untilText(ms) { const h = Math.floor(ms / 3600000), m = Math.floor(ms % 3600000 / 60000); return h >= 24 ? toAr(Math.floor(h / 24)) + ' يوم و' + toAr(h % 24) + ' ساعة' : toAr(h) + ' ساعة و' + toAr(m) + ' دقيقة'; }
function renderMissions(body) {
  rollMissions();
  const cnt = (kind) => { const P = ACCOUNT[kind]; return P.ids.filter((id) => { const d = missionDef(kind, id); return d && !P.done.includes(id) && missionProgress(kind, d) >= d.n; }).length; };
  const achN = ACHIEVEMENTS.filter((a) => achTier(a) < a.tiers.length && lifeOf(a.stat) >= a.tiers[achTier(a)]).length;
  chipRow(SHEETS.missions.chips, LOBBY.sub, (k) => { LOBBY.sub = k; renderSheet(); }, { daily: cnt('daily'), weekly: cnt('weekly'), ach: achN });
  const now = new Date();
  if (LOBBY.sub === 'daily' || LOBBY.sub === 'weekly') {
    const kind = LOBBY.sub, P = ACCOUNT[kind];
    let end; if (kind === 'daily') end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1); else { end = new Date(now.getFullYear(), now.getMonth(), now.getDate()); end.setDate(end.getDate() + ((6 - end.getDay() + 7) % 7 || 7)); }
    $('lbSheetSub').textContent = 'مهام جديدة بعد ' + untilText(end - now);
    if (kind === 'daily') {
      // the activity bar: points from finished missions open five chests
      const pts = activityPts(), bar = el('div', 'lb-activity'); P.chests = P.chests || [];
      bar.innerHTML = `<div class="ab-top"><b>النشاط اليومي</b><span>${toAr(pts)} / ١٠٠</span></div><div class="ab-track"><i style="width:${Math.min(100, pts)}%"></i></div><div class="ab-chests"></div>`;
      const box = bar.querySelector('.ab-chests');
      ACTIVITY_CHESTS.forEach(([need, rw], i) => {
        const got = P.chests.includes(i), ready = !got && pts >= need, b = el('button', 'ab-chest' + (got ? ' got' : ready ? ' ready' : ''));
        b.type = 'button'; b.style.insetInlineStart = need + '%'; b.innerHTML = svg('crate') + `<small>${toAr(need)}</small>`; b.title = rewardText(rw);
        b.addEventListener('click', () => { if (ready) { const r = claimChest(i); if (r) lbToast('فتحت صندوق النشاط', rewardText(r)); renderSheet(); lobbyRefresh(true); } else lbToast(got ? 'استلمته' : 'تحتاج ' + toAr(need) + ' نشاط', rewardText(rw)); });
        box.append(b);
      });
      body.append(bar);
    }
    const ids = P.ids.slice().sort((a, b) => { const st = (id) => { const d = missionDef(kind, id); return P.done.includes(id) ? 2 : d && missionProgress(kind, d) >= d.n ? 0 : 1; }; return st(a) - st(b); });
    for (const id of ids) {
      const d = missionDef(kind, id); if (!d) continue;
      const have = missionProgress(kind, d), done = P.done.includes(id), st = done ? 'done' : have >= d.n ? 'ready' : '';
      const r = missionRow(STAT_ICON[d.stat] || 'missions', d.text, have, d.n, d.stat, d.gold, d.xp, d.gems || 0, st, () => { if (claimMission(kind, id)) lbToast('استلمت الجائزة', rewardText(d) + (d.pts ? ' · +' + toAr(d.pts) + ' نشاط' : '')); renderSheet(); lobbyRefresh(true); });
      const rw = r.querySelector('.rw'); if (rw) { if (d.shards) rw.insertAdjacentHTML('beforeend', `<em class="s">${svg('shard')}${toAr(d.shards)}</em>`); if (d.mat) rw.insertAdjacentHTML('beforeend', `<em class="t">${svg('upgun')}${toAr(d.mat)}</em>`); if (d.pts) rw.insertAdjacentHTML('beforeend', `<em class="a">+${toAr(d.pts)} نشاط</em>`); }
      body.append(r);
    }
    body.append(el('p', 'lb-note', 'تكتمل المهام وأنت تلعب؛ ارجع هنا لتستلم الجائزة. قطع الصناديق: كل عشر قطع تصير صندوقاً تفتحه من «الصناديق».'));
  } else {
    $('lbSheetSub').textContent = 'جوائز دائمة';
    for (const a of ACHIEVEMENTS) {
      const k = achTier(a), maxed = k >= a.tiers.length, need = a.tiers[Math.min(k, a.tiers.length - 1)], have = lifeOf(a.stat);
      const st = maxed ? 'done' : have >= need ? 'ready' : '';
      const gems = maxed ? 0 : a.gems[k] || 0;
      body.append(missionRow(STAT_ICON[a.stat] || 'medal', a.text(need) + (a.tiers.length > 1 ? ' · ' + toAr(Math.min(k + 1, a.tiers.length)) + '/' + toAr(a.tiers.length) : ''), have, need, a.stat, maxed ? 0 : a.gold[k], 0, gems, st, () => { if (claimAch(a.id)) lbToast('إنجاز! +' + toAr(a.gold[k]) + ' ذهب' + (gems ? ' و' + toAr(gems) + ' جوهرة' : ''), a.text(need)); renderSheet(); lobbyRefresh(true); }));
    }
  }
}
function renderTraining(body) {
  const r0 = el('div', 'lb-row ready'); r0.innerHTML = `<span class="ri">${svg('training')}</span><span class="rb"><b>ميدان التدريب</b><span>ادخل الجزيرة وأنجز هذه الخطوات بالترتيب؛ كل خطوة تعطيك ذهباً وخبرة.</span></span>`;
  r0.append(btn2(svg('play') + ' ابدأ', () => { ACCOUNT.seen.training = 1; playFromLobby().then(() => setTimeout(() => { const t = TRAINING.find((q) => !ACCOUNT.tut[q.id] && lifeOf(q.stat) < q.n); if (t) toast('التدريب: ' + t.text, t.hint); }, 1500)); }, 'lbtn'));
  body.append(r0);
  for (const t of TRAINING) {
    const have = lifeOf(t.stat), done = !!ACCOUNT.tut[t.id], st = done ? 'done' : have >= t.n ? 'ready' : '';
    const r = missionRow(STAT_ICON[t.stat] || 'deco', t.text, have, t.n, t.stat, t.gold, t.xp, 0, st, () => { if (claimTraining(t.id)) lbToast('أحسنت! +' + toAr(t.gold) + ' ذهب', t.text); renderSheet(); lobbyRefresh(true); });
    r.querySelectorAll('.rb > span')[1].textContent = done ? 'تمّت' : t.hint; body.append(r);
  }
}
function renderFriends(body) {
  const me = el('div', 'lb-row'); me.innerHTML = `<span class="ri">${svg('person')}</span><span class="rb"><b></b><span>شارك آيديك مع أصدقائك ليضيفوك</span></span>`;
  me.querySelector('b').textContent = ACCOUNT.name + ' · ID ' + ACCOUNT.id;
  me.append(btn2(svg('copy') + ' انسخ', () => copyText(ACCOUNT.id), 'lbtn alt')); body.append(me);
  const f = el('div', 'lb-field'), inp = el('input'); inp.type = 'search'; inp.placeholder = 'ابحث بالآيدي أو الاسم'; inp.setAttribute('aria-label', 'ابحث عن صديق'); inp.maxLength = 24;
  f.append(inp, btn2('ابحث', () => lbToast('البحث عن الأصدقاء يعمل في التحديث القادم', 'اللعب الجماعي: تدعو صديقك فيدخل عالمك'), 'lbtn')); body.append(f);
  body.append(el('div', 'shead', 'طلبات الصداقة'), el('p', 'lb-note', 'لا طلبات بعد.'));
  body.append(el('div', 'shead', 'أصدقاؤك'), el('p', 'lb-note', 'لا أصدقاء بعد. حين يقبل صديق طلبك يظهر هنا، وتستطيع دعوته إلى اللوبي ثم يدخل معك إلى عالمك وأنت القائد ⭐.'));
}
function copyText(t) { try { navigator.clipboard.writeText(t).then(() => lbToast('نُسخ الآيدي', t), () => lbToast('الآيدي: ' + t, '')); } catch (_) { lbToast('الآيدي: ' + t, ''); } }

/* ── modals ── */
const MAPS = [
  { id: 'island', name: 'جزيرة الصخرة', size: '٨×٨ كم', sub: 'مدن وقرى وغابات وجبال وصحراء', img: 'assets/ui/map_island.webp' },
  { id: 'snow', name: 'أرض الثلج', size: '٦×٦ كم', sub: 'ثلج فقط وعواصف ثلجية', img: 'assets/ui/map_snow.webp' },
  { id: 'forest', name: 'الغابات المجنونة', size: '٧×٧ كم', sub: 'غابات كثيفة بلا نهاية', img: 'assets/ui/map_forest.webp' },
  { id: 'desert', name: 'الصحراء القاحلة', size: '٤×٤ كم', sub: 'كثبان وعواصف رملية', img: 'assets/ui/map_desert.webp' },
  { id: 'water', name: 'عالم الماء', size: '٣×٣ كم', sub: 'منصات خشب وبيوت على الماء وسفن حربية', img: 'assets/ui/map_water.webp' },
  { id: 'mega', name: 'القارة الكبرى', size: '٣٠×٣٠ كم', sub: 'بركان وأنفاق ومختبرات وقطارات', img: 'assets/ui/map_mega.webp' },
];
for (const m of MAPS) m.on = MAPS_READY.includes(m.id);
/* another map: everything is saved, the choice is kept on this device, and the page loads again into the new world */
async function switchMap(id) {
  if (LOBBY.busy || !MAPS_DEF[id]) return;
  if (typeof NET !== 'undefined' && (NET.party || NET.hosting)) { lbToast('أنت في فريق الآن', 'غادر الفريق أولاً، فالفريق يلعب في خريطة القائد'); return; }
  LOBBY.busy = true; closeModal(); AUDIO.ui(2);
  accSoon(true); accFlush();
  try { localStorage.setItem(MAP_KEY, id); } catch (_) {}
  $('fader').dataset.note = 'جارٍ تحميل ' + mapTitle(id) + '…';
  await fadeTo(true);
  const u = new URL(location.href); u.searchParams.delete('map');
  setTimeout(() => { try { location.replace(u.toString()); } catch (_) { location.reload(); } }, 250);
}
function closeModal() { $('lbModal').hidden = true; $('lbMCard').innerHTML = ''; }
function modalHead(card, title) { const h = el('h3'); h.append(title); const x = btn2(svg('close'), closeModal, 'lb-x'); x.setAttribute('aria-label', 'إغلاق'); h.append(x); card.append(h); }
function openModal(kind) {
  const card = $('lbMCard'); card.innerHTML = ''; $('lbModal').hidden = false;
  if (kind === 'topup') {
    modalHead(card, 'شحن الجواهر');
    const d = el('div', 'dev'); d.innerHTML = `${svg('gem')}<div><b>صفحة الشحن قيد التطوير</b><p>الشراء بالمال الحقيقي غير متاح الآن. حين يُفتح ستظهر هنا الباقات وطرق الدفع.</p></div>`; card.append(d);
    card.append(el('p', null, 'رصيدك: ' + toAr(ACCOUNT.gems) + ' جوهرة · الجواهر المجانية: ' + toAr(ACCOUNT.gemsFree) + ' من ' + toAr(GEM_FREE_CAP) + ' (من المستويات والإنجازات). الجواهر تشتري البدلات المميزة في المتجر.'));
    const packs = el('div', 'packs');
    for (const n of [60, 300, 980, 1980, 3280, 6480]) { const p = el('div', 'pack'); p.innerHTML = `${svg('gem')}<b>${toAr(n)}</b><small>قريباً</small>`; packs.append(p); }
    card.append(packs);
  } else if (kind === 'gold') {
    modalHead(card, 'الذهب');
    card.append(el('p', null, 'الذهب عملتك الدائمة: لا يضيع إذا سقطت. تكسبه وأنت تلعب، وتصرفه في المتجر على الملابس، وفي المعمل على الترقيات.'));
    const kv = el('div', 'kv');
    for (const [v, k] of [['+٢', 'كل زومبي (العملاق +٦)'], ['+١', 'كل دقيقتين وأنت حي'], ['+١٥', 'كل كنز تجده'], ['+٤', 'كل قاطع طريق'], ['٢٥–٤٠٠', 'المهام اليومية والأسبوعية'], ['+٣٠ وأكثر', 'كل مستوى جديد']]) { const d = el('div'); d.append(el('b', null, v), el('span', null, k)); kv.append(d); }
    card.append(kv, btn2('افتح المهام', () => { closeModal(); openSheet('missions'); }, 'lbtn'));
  } else if (kind === 'profile') {
    modalHead(card, 'ملفك');
    const f = el('div', 'lb-field'), inp = el('input'); inp.value = ACCOUNT.name; inp.maxLength = 16; inp.setAttribute('aria-label', 'اسمك في اللعبة');
    const save = () => { const v = cleanName(inp.value); if (v.length < 2) { lbToast('الاسم قصير جداً', 'حرفان على الأقل'); return; } ACCOUNT.name = v; accSoon(true); accFlush(); lobbyRefresh(true); lbToast('اسمك الآن: ' + v, ''); };
    inp.addEventListener('keydown', (e) => { if (e.code === 'Enter') save(); });
    f.append(inp, btn2(svg('edit') + ' احفظ', save, 'lbtn')); card.append(f);
    const idr = el('div', 'lb-row'); idr.innerHTML = `<span class="ri">${svg('person')}</span><span class="rb"><b></b><span>رقمك الفريد: يبحث عنك أصدقاؤك به</span></span>`; idr.querySelector('b').textContent = 'ID ' + ACCOUNT.id;
    idr.append(btn2(svg('copy') + ' انسخ', () => copyText(ACCOUNT.id), 'lbtn alt')); card.append(idr);
    const L = ACCOUNT.life, kv = el('div', 'kv');
    for (const [v, k] of [[toAr(ACCOUNT.level), 'المستوى'], [fmtN(L.kills || 0), 'زومبي قتلتهم'], [fmtStat('survBest', ACCOUNT.best.surv || 0), 'أطول نجاة'], [fmtStat('sec', L.sec || 0), 'وقت اللعب'], [fmtN(L.felled || 0), 'أشجار قطعتها'], [fmtN(L.rocks || 0), 'صخور حطّمتها'], [fmtStat('km', L.km || 0) + ' كم', 'قدت'], [fmtN(L.crafted || 0), 'صنعت'], [fmtN(L.built || 0), 'بنيت'], [toAr(ACCOUNT.wardrobe.length), 'قطع ملابس']]) { const d = el('div'); d.append(el('b', null, v), el('span', null, k)); kv.append(d); }
    card.append(kv);
  } else if (kind === 'map') {
    modalHead(card, 'الخريطة والوضع');
    const modes = el('div', 'seg'); modes.style.justifyContent = 'flex-start';
    // with friends: invite them from the friends list; they come into your world, on your map
    const inParty = typeof NET !== 'undefined' && (NET.party || NET.hosting);
    for (const [k, label] of [['solo', 'فردي'], ['friends', 'مع الأصدقاء']]) {
      const b = btn2(label, () => {
        LOBBY.mode = k; lobbyRefresh(true);
        if (k === 'friends') { closeModal(); openSheet('friends'); lbToast('ادعُ أصدقاءك', 'حين يقبلون يدخلون عالمك في ' + mapTitle(MAP_ID) + ' وأنت القائد'); } else openModal('map');
      }, '');
      b.setAttribute('aria-pressed', String((inParty ? 'friends' : LOBBY.mode) === k)); modes.append(b);
    }
    card.append(modes);
    const g = el('div', 'maps');
    for (const m of MAPS) {
      const b = el('button', 'mapc' + (m.id === LOBBY.map ? ' on' : '') + (m.on ? '' : ' soon')); b.type = 'button';
      b.style.backgroundImage = `url("${m.img}"), linear-gradient(135deg,#2b4a5a,#14222c)`;
      b.innerHTML = '<i></i><span><b></b><small></small></span>'; b.querySelector('i').textContent = m.id === LOBBY.map ? 'مختارة' : m.on ? 'متاحة' : 'قريباً';
      b.querySelector('b').textContent = m.name + ' · ' + m.size; b.querySelector('small').textContent = m.sub;
      b.addEventListener('click', () => { if (!m.on) { lbToast(m.name + ' قريباً', m.sub); return; } if (m.id === MAP_ID) { closeModal(); return; } switchMap(m.id); });
      g.append(b);
    }
    card.append(g);
  } else if (kind === 'exit') {
    modalHead(card, 'الخروج؟');
    card.append(el('p', null, 'رحلتك في الجزيرة وحسابك (المستوى والذهب والملابس) محفوظان. تعود متى شئت.'));
    const row = el('div', 'row'); row.style.justifyContent = 'flex-start'; row.append(btn2('اخرج', exitToTitle, 'lbtn'), btn2('ابقَ', closeModal, 'lbtn alt')); card.append(row);
  } else if (MODAL_EXTRA[kind]) MODAL_EXTRA[kind](card);
  else if (kind === 'credits') {
    modalHead(card, 'الحقوق والمصادر');
    card.append(el('p', null, '© 2026 Call of Survival — جميع الحقوق محفوظة. الإصدار ٦٫٠.'), el('p', null, 'فيلم البداية والموسيقى صُنعا للعبة وهما ملكها.'), el('p', null, CREDITS));
  }
}
