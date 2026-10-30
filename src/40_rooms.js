/* ═════════ the lobby's rooms: two real interiors scanned by their keepers and sent in by the game's owner — the King's Hall of
   Skokloster Castle (CC-BY 4.0) and Hintze Hall of the Natural History Museum in London with its blue whale (CC-BY-NC 4.0),
   both cut down by tools/um_scan5.py. Your survivor stands in one while you dress, shop and choose; the island is not drawn
   behind the menus then, so the phone stays cool. «الجزيرة» keeps the old forest clearing. ═════════ */
const ROOMS = {
  // spot: where the survivor stands (the room's own metres), phi: where the camera stands from there; light: key light direction
  hall: { name: 'القاعة الملكية', file: 'kingshall', spot: [0, 1.6], phi: 0, fov: 40, maxDist: 4.9, tint: 1.06, key: [-1.6, 3.2, 2.6], rim: [1.4, 2.6, -3.2], warm: 0xfff0dc, camY: 1.25, lookY: 1.0 },
  museum: { name: 'قاعة الحوت', file: 'hintze', spot: [-9, 0], phi: -Math.PI / 2, fov: 50, tint: 1.08, key: [-2.5, 3.5, 1.5], rim: [2.5, 3, -1], warm: 0xf4f0ea, camY: 0.75, lookY: 1.6, dist: 1.1, maxDist: 6.5 },
};
const LOBBY_BG = ['hall', 'museum', 'island'];
const LOBBY_BG_AR = { hall: 'القاعة الملكية', museum: 'قاعة الحوت', island: 'الجزيرة' };
const ROOM = { scene: null, active: null, data: {}, loading: {}, spot: null, saved: null, fov: 34, lights: null, blob: null };
function roomScene() {
  if (ROOM.scene) return ROOM.scene;
  const s = new THREE.Scene(); s.background = new THREE.Color(0x1a1714);
  const hemi = new THREE.HemisphereLight(0xfff1e0, 0x4a3e34, 1.05), key = new THREE.DirectionalLight(0xfff3e2, 2.7), rim = new THREE.DirectionalLight(0xdfe8ff, 1.7);
  s.add(hemi, key, key.target, rim, rim.target);
  // a soft shade on the floor under the survivor (the room's light is baked into the scan; nothing else casts here)
  const g = document.createElement('canvas'); g.width = g.height = 64; const cx = g.getContext('2d'), gr = cx.createRadialGradient(32, 32, 2, 32, 32, 31);
  gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.2)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); cx.fillStyle = gr; cx.fillRect(0, 0, 64, 64);
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(g), transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.renderOrder = 2; s.add(blob);
  ROOM.scene = s; ROOM.lights = { hemi, key, rim }; ROOM.blob = blob;
  return s;
}
/* fetch a room: its mesh (the scan's near level) and its texture (the sharp one on strong devices) */
function loadRoom(id) {
  if (ROOM.data[id]) return Promise.resolve(ROOM.data[id]);
  if (ROOM.loading[id]) return ROOM.loading[id];
  const R = ROOMS[id];
  ROOM.loading[id] = fetchJSON('assets/rooms/' + R.file + '.json').then(async (d) => {
    const L = d.lods[0], url = 'assets/rooms/' + (QUALITY.tier >= 2 && L.texHi ? L.texHi : L.tex);
    const im = await loadImage(url);
    const tex = new THREE.Texture(im); tex.flipY = false; tex.encoding = THREE.sRGBEncoding; tex.anisotropy = MAX_ANISO; tex.needsUpdate = true;
    const mat = new THREE.MeshBasicMaterial({ map: tex }); mat.color.setScalar(R.tint || 1);
    const mesh = new THREE.Mesh(landGeo(L), mat); mesh.matrixAutoUpdate = false; mesh.updateMatrix();
    // the floor under the spot: straight down from chest height (a chair or a table top would be hit from higher up)
    const ray = new THREE.Raycaster(new THREE.Vector3(R.spot[0], 1.6, R.spot[1]), new THREE.Vector3(0, -1, 0), 0, 4);
    const hit = ray.intersectObject(mesh, false)[0];
    ROOM.data[id] = { mesh, floor: hit ? hit.point.y : 0 };
    return ROOM.data[id];
  }).catch((e) => { console.warn('room', id, e); ROOM.loading[id] = null; throw e; });
  return ROOM.loading[id];
}
/* step into a room (or back out to the island) while in the lobby */
function roomOn(id) {
  const D = ROOM.data[id], R = ROOMS[id]; if (!D || !LOBBY.on) return;
  const s = roomScene();
  if (ROOM.active && ROOM.active !== id) s.remove(ROOM.data[ROOM.active].mesh);
  s.add(D.mesh); s.environment = scene.environment;
  if (!ROOM.active) { ROOM.saved = LOBBY.spot; ROOM.fov = camera.fov; }
  ROOM.active = id; ROOM.spot = { x: R.spot[0], y: D.floor, z: R.spot[1], phi: R.phi, camY: R.camY, lookY: R.lookY, dist: R.dist, maxDist: R.maxDist };
  LOBBY.spot = ROOM.spot; VIEW.scene = s;
  if (LOBBY.body) s.add(LOBBY.body.root);
  const S = ROOM.spot, Lt = ROOM.lights;
  Lt.key.position.set(S.x + R.key[0], S.y + R.key[1], S.z + R.key[2]); Lt.key.target.position.set(S.x, S.y + 1, S.z); Lt.key.color.set(R.warm);
  Lt.rim.position.set(S.x + R.rim[0], S.y + R.rim[1], S.z + R.rim[2]); Lt.rim.target.position.set(S.x, S.y + 1, S.z);
  ROOM.blob.position.set(S.x, S.y + 0.012, S.z);
  camera.fov = R.fov; camera.updateProjectionMatrix();
  lobbyPose(T, aPos, aLook); camera.position.copy(aPos); camera.lookAt(aLook);
  LOBBY.avaWant = true; LOBBY.avaAt = T + 0.6;
}
function roomOff() {
  if (!ROOM.active) return;
  ROOM.scene.remove(ROOM.data[ROOM.active].mesh); ROOM.active = null; VIEW.scene = null;
  if (ROOM.saved) LOBBY.spot = ROOM.saved;
  if (LOBBY.body) scene.add(LOBBY.body.root);
  camera.fov = ROOM.fov || 34; camera.updateProjectionMatrix();
}
/* the lobby asks for its backdrop: the room from the settings, fetched once, faded in when it arrives */
function lobbyBackdrop(instant) {
  const want = SET.lobbyBg;
  if (!ROOMS[want]) { if (ROOM.active) { roomOff(); if (LOBBY.on) { lobbyPose(T, aPos, aLook); camera.position.copy(aPos); camera.lookAt(aLook); prepareAround(LOBBY.spot.x, LOBBY.spot.y, LOBBY.spot.z); } } return; }
  if (ROOM.active === want) return;
  loadRoom(want).then(async () => {
    if (!LOBBY.on || SET.lobbyBg !== want) return;
    if (!instant) await fadeTo(true);
    roomOn(want);
    if (!instant) await fadeTo(false);
  }).catch(() => {});
}
function cycleLobbyBg() {
  const i = LOBBY_BG.indexOf(SET.lobbyBg), next = LOBBY_BG[(i + 1) % LOBBY_BG.length];
  SET.lobbyBg = next; saveSettings(); AUDIO.ui();
  lbToast(LOBBY_BG_AR[next], next === 'island' ? 'الغابة على الجزيرة نفسها' : 'جارٍ تحميل القاعة…');
  lobbyBackdrop(false);
}
/* the room follows the survivor's look: a rebuilt body goes back into the room */
function roomAdopt(body) { if (ROOM.active && body && ROOM.scene) ROOM.scene.add(body.root); }
Object.assign(ICON, { scene: '<rect x="3" y="4.5" width="18" height="15" rx="2.4"/><path d="M3.4 16.8l5.2-5.4 4 4 2.6-2.6 5.4 5.4" stroke-linejoin="round"/><circle cx="15.8" cy="9" r="1.7" fill="currentColor" stroke="none"/>' });
$('lbBg').innerHTML = lbIcon('scene');
$('lbBg').addEventListener('click', cycleLobbyBg);
