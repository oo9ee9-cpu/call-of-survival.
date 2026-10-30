/* ═════════ the loop and the boot: load the island, then run it ═════════ */
const aPos = new THREE.Vector3(), aLook = new THREE.Vector3(), cLook = new THREE.Vector3();
let deathShown = false, snowCover = 0, lastDraw = 0, FRAME_CAP = 60;
function onSettlementReady(S) { try { onSettlementReadyCars(S); } catch (e) { console.warn('town cars', S.id, e); } }
function onSettlementUnload(S) { onSettlementUnloadCars(S); }
// on phones the sun's shadow map is redrawn every other frame: half the shadow cost, a lag nobody sees
const SHADOW_EVERY = QUALITY.tier <= 1 ? 2 : 1; let frameNo = 0;
renderer.shadowMap.autoUpdate = false;
function frame(now) {
  requestAnimationFrame(frame);
  // the frame-rate limit from the settings; menus that hold still need less (the lobby runs at 30 unless you turn the avatar),
  // a paused game only redraws a few times a second: the phone stays cool while nothing moves
  let cap = SET.fps;
  if (paused) cap = 8;
  else if (!started && !LOBBY.drag) cap = cap > 0 ? Math.min(cap, 30) : 30;
  FRAME_CAP = cap;
  if (cap > 0 && now - lastDraw < 1000 / cap - 2.5) return;
  lastDraw = now;
  renderer.shadowMap.needsUpdate = (++frameNo % Math.max(SHADOW_EVERY, STRAIN.shadowEvery)) === 0;
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
  if (paused) { POST.render(0); return; }
  simulate(dt);
  if (LOBBY.on) lobbyAvatar();
  POST.render(dt);
  updateDynRes(dt);
}
function simulate(dt) {
  T += dt; T_ENV = T; if (started && player.alive) T_GAME += dt;
  const fc = started ? (ED.on ? ED.focus : player.pos) : LOBBY.on ? LOBBY.spot : aLook;
  const cold = clamp(1 - tempAt(fc.x, fc.z) + smooth(250, 420, terrainAt(fc.x, fc.z)) * 0.4, 0, 1), dry = biomeAt(fc.x, fc.z) === 7 ? 1 : 0;
  updateWeather(dt, dry, cold);
  updateEnvironment(dt, started && player.alive && !ED.on);       // (the clock stands still while you edit the world)
  WET_U.value = WEATHER.wet; TERR_U.uRain.value = WEATHER.rain; TERR_U.uTime.value = T;
  snowCover = clamp(snowCover + (WEATHER.snow > 0.3 ? dt / 90 : -dt / 400), 0, 1); TERR_U.uSnow.value = snowCover; SNOWC_U.value = snowCover;
  for (const u of UPDATERS) u(T, dt);
  updateFeatures(dt);
  if (LOBBY.on) lobbyPose(T, aPos, aLook); else if (!started) attractCameraPose(T, aPos, aLook);
  updateAccount(dt); updateMeta(dt); HOOK.frame(dt);
  if (started && ED.on) edFrame(dt);                        // the world editor flies its own camera (42_edui)
  else if (started) {
    gatherInput(dt);
    updateVehicles(dt, T); updateTraffic(dt);
    updateDrop(dt);
    if (skydiving()) { if (DROP.state !== 'plane') updateSkydive(dt); } else updatePlayer(dt, T);
    if (!DROP.state) updateWeapon(dt, T); updateDrops(dt, T); updateCrates(dt); updateThrown(dt); updateZombies(dt, T); updateBots(dt, T); updateAnimals(dt, T); updateHealth(dt);
    updateSurvival(dt, T); updateBuild(); updateBuilt(dt); updateSave(dt);
    updateCamera(dt, false);
    introT = Math.min(1, introT + dt / 2.2);
    const e = smooth(0, 1, introT);
    camera.position.lerpVectors(aPos, cam.pos, e); cLook.lerpVectors(aLook, cam.look, e); camera.lookAt(cLook); if (cam.roll) camera.rotateZ(cam.roll);
    placeSun(player.pos.x, player.pos.y, player.pos.z);
    updateFlashlight(); updateLightPool(dt); updateHud(dt); AUDIO.update(dt);
    if (!player.alive) {
      deathT += dt;
      if (deathT > 1.4 && !deathShown) {
        deathShown = true; $('dKills').textContent = toAr(KILLS); $('dBest').textContent = toAr(BEST);
        $('dXp').textContent = '+' + toAr(Math.max(0, Math.round(xpTotal() - (ACC.lifeXP0 || 0)))) + ' خبرة و+' + toAr(Math.max(0, (ACCOUNT.life.goldEarned || 0) - (ACC.lifeGold0 || 0))) + ' ذهب في هذه الحياة · المستوى ' + toAr(ACCOUNT.level);
        const s = Math.floor(SURVIVE_T); $('dTime').textContent = toAr(Math.floor(s / 60)) + ':' + pad2(s % 60);
        $('death').classList.remove('gone'); input.act = false; closeCraft(); if (document.exitPointerLock && locked) document.exitPointerLock();
      }
    } else deathShown = false;
  } else if (LOBBY.on) lobbyFrame(dt);
  else {
    camera.position.copy(aPos); camera.lookAt(aLook); placeSun(aLook.x, aLook.y, aLook.z); updateLightPool(dt);
  }
  if (VIEW.scene) { ENVMAP.update(dt); return; }        // the lobby stands in a scanned room: the island waits, nothing streams
  updateBirds(dt, T);
  // high in the plane or the free fall, the towns and grass below wait: nothing is built for a place you are only flying over
  const high = started && DROP.state && player.pos.y - terrainAt(player.pos.x, player.pos.z) > 220;
  if (!high) updateSettlements(dt, fc.x, fc.z);
  TERRAIN.update(dt, camera.position.x, camera.position.y, camera.position.z);
  updateRoadLod(dt);
  vegFrame(dt, T); updateVegetation(dt, camera.position.x, camera.position.z);
  if (GRASS.mesh) GRASS.mesh.visible = !high;
  if (!high) { updateGrass(dt, fc.x, fc.z); updateRocks(dt, fc.x, fc.z); }
  updateWater(dt, T); ENVMAP.update(dt);
  updateParticles(dt); updateEffects(dt); BLOBS.update(); RAIN.update(dt, T); SPLASH.update(dt, T); BEAMS.update(dt, T);
  sky.position.copy(camera.position); sky.scale.setScalar(camera.far * 0.9); stars.position.copy(camera.position); stars.scale.setScalar(camera.far * 0.85);
}
function begin(instant) {
  if (started || !BOOT.ready) return;
  if (LOBBY.on) leaveLobbyScene();
  started = true; introT = instant ? 1 : 0;
  ACC.lifeXP0 = xpTotal(); ACC.lifeGold0 = ACCOUNT.life.goldEarned || 0; HOOK.start();
  $('soundBtn').setAttribute('aria-pressed', String(AUDIO.on));
  $('intro').classList.add('gone'); hud.classList.add('on'); BOOTFILM.stop();
  if (!instant) cam.yaw = cam.tyaw = player.yaw + Math.PI;
  cam.focus.set(player.pos.x, player.pos.y + 1.6, player.pos.z); updateCamera(0.016, true);
  player.bornAt = T;
  applyOrientation(); hudDirty = true; slotSig = '';
  $('camBtn').setAttribute('aria-pressed', String(camMode === 'fpp'));
  if (!BOOT.loaded) {
    setTimeout(() => toast('اجمع لتنجو', 'الفأس للشجر والمعول للصخر والمجرفة للحفر · الحقيبة للصناعة والمتجر والملابس'), 2600);
    setTimeout(() => toast('المدينة أمامك', 'في متجر الأزياء ملابس، وفي معرض السيارات فيراري · اجمع المال من الكنوز والزومبي'), 9000);
  } else setTimeout(() => toast('أهلاً بعودتك', 'رحلتك محفوظة كما تركتها'), 1500);
}
$('startBtn').addEventListener('click', () => { firstGesture(); enterLobby(); });
const BOOT = { ready: false, loaded: false };
const CREDITS = 'نماذج وأنسجة مفتوحة الترخيص: صخور وجذوع ممسوحة ضوئياً من Poly Haven (CC0) عبر Babylon.js Assets (CC-BY 4.0) · أشجار مولّدة بأداة ez-tree لـ Daniel Greenheck (MIT) · أنسجة اللحاء والأرض من ambientCG (CC0) وBabylon.js (CC-BY 4.0) · الجندي وميشيل من Mixamo عبر أمثلة three.js · الحصان والفلامنغو والببغاء واللقلق من mirada / ro.me · الثعلب من Khronos glTF Samples (CC0 / CC-BY 4.0) · العشب الداكن من OpenGameArt (CC-BY 3.0) · المحرّك three.js (MIT).';
// models from Sketchfab sent in by the game's owner, CC-BY 4.0: credited by title, author and source; all were cut down, re-textured or re-rigged for phones
const CREDITS_SF = [
  ['Tree Animate', 'RandyGF', 'https://sketchfab.com/3d-models/tree-animate-f0f9eb5e6c104bbb8e1f41c97019e6f2', 'شجرة الدُّلب'],
  ['Realtime Grass', 'mfhscoobydoo', 'https://sketchfab.com/3d-models/realtime-grass-07d38555cae844f7abdeace9d19c4777', 'العشب'],
  ['[3ds Max] Meadow Game Environment Test', 'Nico Maier', 'https://sketchfab.com/3d-models/3ds-max-meadow-game-environment-test-03d6e4b33b6a4e8bac37155c750cac7a', 'أعشاب المرج وأرضه'],
  ['Peak, cliff, mountain, rock', 'Metazeon', 'https://sketchfab.com/3d-models/peak-cliff-mountain-rock-77809d638bc74232b10c564b178a0570', 'القمم الصخرية'],
  ['Terraced fields, farmland', 'Metazeon', 'https://sketchfab.com/3d-models/terraced-fields-farmland-79e4df2e011b4d1b9ae7f48c4acbddcb', 'المدرّجات الزراعية'],
  ['UAZ 469 1973 (Classic)', 'zhe_kan', 'https://sketchfab.com/3d-models/uaz-469-1973-classic-027fa204ce25452fac61a93ccfb8f1f8', 'الجيب الميداني'],
  ['Casual Look Dog- Print T-Shirt And Jeans', 'restore50', 'https://sketchfab.com/3d-models/casual-look-dog-print-t-shirt-and-jeans-4f4216cb771b4ce5b98dda88632d14d1', 'صاحبة المتجر'],
  ['Blonde Confidence', 'Grauwolf', 'https://sketchfab.com/3d-models/blonde-confidence-ceff618b423244368bc5a86487236db9', 'بائعة المتجر'],
  ['Low Poly Midnight shadow Hunter 3d model free', 'iRahulRajput', 'https://sketchfab.com/3d-models/low-poly-midnight-shadow-hunter-3d-model-free-46b1ec26f89a47d5a29905518762fe85', 'صيّاد الليل'],
  ['RAINIER AK - 3D', 'skartemka', 'https://sketchfab.com/3d-models/rainier-ak-3d-57aef8cdf42046a39f1ad9b428756213', 'بندقية AKM (CC-BY-NC 4.0)'],
  ['9 mm', 'Slava Zemlyanik', 'https://sketchfab.com/3d-models/9-mm-5124e7fe60fb4d3ab62460609d23f365', 'مسدس P92 (رخصة Sketchfab)'],
  ['Axe', 'jacobbc2003', 'https://sketchfab.com/3d-models/axe-17134e53c69b4cf4a48344e63e7c3540', 'فأس الرونات'],
  ['Faca Negra - Hardsurface - 3D Avançado 2020/1', 'iagolucchese', 'https://sketchfab.com/3d-models/faca-negra-hardsurface-3d-avancado-20201-a002802ac72d4f1db1b20007447bbf32', 'السكين السوداء'],
  ['Jian', 'Simor', 'https://sketchfab.com/3d-models/jian-970ca670b6284369bd90f195f252c86c', 'سيف جيان'],
  ['The Ornate Sword', 'dung.nguyenanh.tbc', 'https://sketchfab.com/3d-models/the-ornate-sword-60331595f10c4a3fbae048228bbc3583', 'السيف المزخرف (رخصة Sketchfab)'],
  ['Weapon series_ the battle axe part one_', 'marjuarane', 'https://sketchfab.com/3d-models/weapon-series--the-battle-axe-part-one-4fe8708156d942d6a316569f50721c7c', 'فأس المعركة'],
  ['Source', 'mohamedhussien', 'https://sketchfab.com/3d-models/source-4d77452b4c824bf2b8df830b9506154a', 'البلطة الطويلة (رخصة Sketchfab)'],
  ['Ghazanchetsots Cathedral - Shushi, Artsakh', 'Azad Balabanian', 'https://sketchfab.com/3d-models/ghazanchetsots-cathedral-shushi-artsakh-7b4acfb6127b4574b2cef96bb745e2d9', 'الكاتدرائية البيضاء'],
  ['Khertvisi Fortress - Raw Scan', 'Nik', 'https://sketchfab.com/3d-models/khertvisi-fortress-raw-scan-217a7a52415b4c6295578c63aa8329e5', 'القلعة على الصخرة'],
  ['The King´s Hall', 'Skokloster Castle (Skoklosters slott)', 'https://sketchfab.com/3d-models/the-king-s-hall-d18155613363445b9b68c0c67196d98d', 'القاعة الملكية في الردهة'],
  ['Hintze Hall, NHM London [surface model]', 'Thomas Flynn', 'https://sketchfab.com/3d-models/hintze-hall-nhm-london-surface-model-b2f3e84112d04bf1844e7ac2c4423566', 'قاعة الحوت في الردهة (CC-BY-NC 4.0)'],
  ['Abandoned Warehouse - Interior Scene', 'Aurélien Martel', 'https://sketchfab.com/3d-models/abandoned-warehouse-interior-scene-1d5285f2e0fd4211a27c8042496d5959', 'المستودع المهجور'],
  ['After the rain... - VR & Sound', 'Aurélien Martel', 'https://sketchfab.com/3d-models/after-the-rain-vr-sound-a1177381d3464f75b10cb8f462f0b9a5', 'شارع ما بعد المطر (CC-BY-NC 4.0)'],
];
async function boot(hot) {
  hot = hot || {};
  // the thin line under the game's name; what is loading is only told to screen readers (the boot screen shows no words)
  const bar = (f, note) => { const k = clamp(f, 0.04, 1); $('loadBar').style.transform = `scaleX(${k})`; $('loadTrack').setAttribute('aria-valuenow', String(Math.round(k * 100))); if (note) $('loadNote').textContent = note; };
  const tick = () => new Promise((r) => setTimeout(r, 0));
  try {
    bar(0.05, 'جارٍ تشكيل ' + mapTitle() + ': الارتفاعات والأنهار والأقاليم…');
    await loadWorld(); bar(0.18);
    const devP = edFetch().catch((e) => { console.warn('dev world', e); return null; });     // what the world editor made, read meanwhile
    WEATHER.climate = (WORLD.data.climate && WORLD.data.climate.weather) || (MAP_ID === 'island' ? '' : MAP_ID);
    const s = WORLD.data.spawn; player.pos.set(s.x, terrainAt(s.x, s.z) + 1, s.z);
    updateWeather(0.016, 0, 0); updateEnvironment(0, false);
    attractCameraPose(0, aPos, aLook); camera.position.copy(aPos); camera.lookAt(aLook);
    POST.init();
    requestAnimationFrame((n) => { last = n; requestAnimationFrame(frame); });
    bar(0.2, 'جارٍ تحميل الصخور والرمال والثلوج الحقيقية…');
    const texP = loadTerrainTextures();
    makeSeabedTexture(); buildInlandWater();
    loadImage('assets/tex/waternormals.jpg').then((im) => { const t = new THREE.Texture(im); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.needsUpdate = true; for (const m of [oceanMat, lakeMat]) { m.uniforms.uNormals.value = t; m.uniforms.uHasN.value = 1; } }).catch(() => {});
    await texP; bar(0.32, 'جارٍ مدّ الطرق والجسور وبناء المدن والقرى…'); await tick();
    initRoads(); initSettlements(); initPlaces(); initTreasures(); await tick();
    try { await loadLandforms(); } catch (e) { console.warn('landforms', e); }
    bar(0.42, 'جارٍ إنبات الغابات: بلّوط وصنوبر وبتولا ونخيل…');
    const vegP = loadVegetation(), scanP = loadScans().catch((e) => console.warn('scans', e));
    const charP = Promise.all([loadCharacter('soldier'), loadCharacter('michelle')]).catch((e) => console.warn('chars', e));
    // the scanned shopkeepers and the night hunter borrow the soldier's clips: start them once he is in
    const scanCharP = charP.then(() => Promise.all(['casual', 'blonde', 'hunter'].map((k) => loadCharacter(k).catch((e) => console.warn('char', k, e)))));
    const modelP = Promise.all([loadAnimalModels(), loadCarModels()]).catch((e) => console.warn('models', e));
    await vegP; bar(0.62, 'جارٍ تحميل الشخصية والملابس…');
    await charP; await scanCharP; bar(0.74, 'جارٍ تحميل الحيوانات والسيارات…');
    await scanP;
    await modelP;
    bar(0.82, 'جارٍ قراءة رحلتك المحفوظة…');
    try { buildPlayerRig(); } catch (e) { console.warn('rig', e); }
    try { initZombies(); } catch (e) { console.warn('zombies', e); }
    try { initBots(); } catch (e) { console.warn('bots', e); }
    try { initBirds(); } catch (e) { console.warn('birds', e); }
    initFeatures();
    startKit();
    const saved = await loadSaveData();
    // an update of the page while you play hands over your exact state
    const core = hot.core && hot.core.v === SAVE.v ? hot.core : saved.core, world = hot.core && hot.world ? hot.world : saved.world;
    try { BOOT.loaded = applySave(core, world); } catch (e) { console.warn('apply save', e); BOOT.loaded = false; }
    try { await edBoot(await withTimeout(devP, 9000)); } catch (e) { console.warn('dev world', e); }
    try { accAbsorbRun(); syncLookToRun(); } catch (e) { console.warn('account', e); }
    applyOutfit(); if (!BOOT.loaded) equip('hand');
    applyAllSettings();
    HOOK.init();
    player.pos.y = groundAt(player.pos.x, player.pos.z, player.pos.y + 1.5);
    player.root.position.copy(player.pos); player.root.rotation.y = player.yaw;
    bar(0.9, 'جارٍ تجهيز اللوبي…'); await tick();
    try { initWelcomeSigns(); } catch (e) { console.warn('signs', e); }
    try { LOBBY.spot = findLobbySpot(); } catch (e) { console.warn('lobby spot', e); }
    const fp = hot.started ? player.pos : LOBBY.spot || player.pos;
    updateSettlements(0.016, fp.x, fp.z, true);
    updateVegetation(0.016, fp.x, fp.z, true); updateGrass(0.016, fp.x, fp.z, true); updateRocks(0.016, fp.x, fp.z, true);
    ENVMAP.update(0, true);
    loadImage(MAPDEF.dir + '/map.jpg').then((im) => { MAPIMG.img = im; MAPIMG.ok = true; hudDirty = true; }).catch(() => loadImage(MAPDEF.dir + '/map_s.jpg').then((im) => { MAPIMG.img = im; MAPIMG.ok = true; }).catch(() => {}));
    BOOT.ready = true; bar(1);
    $('startBtn').disabled = false; $('startBtn').textContent = 'ادخل';
    const nb = BUILDINGS.length, savedNote = BOOT.loaded ? ' رحلتك المحفوظة جاهزة.' : '';
    $('loadNote').textContent = mapTitle() + (MAP_ID === 'water' ? ' جاهز: ' : ' جاهزة: ') + toAr(SETTLEMENTS.length) + ' مدينة وقرية ومعلم، و' + toAr(nb) + ' مبنى تدخل أغلبها، و' + toAr(ITEM_LIST.length) + ' شيئاً تصنعه وتشتريه.' + savedNote;
    if (hot.started && BOOT.loaded) { begin(true); if (typeof hot.cy === 'number') { cam.yaw = cam.tyaw = hot.cy; cam.pitch = cam.tpitch = hot.cp || 0.18; } }
    else {
      // the boot screen stays at least until the game's name has come in, then the lobby opens
      $('intro').classList.add('ready');
      const go = () => { if (!started && !LOBBY.on) enterLobby(true); };
      const wait = () => (BOOTFILM.shown() ? setTimeout(go, 350) : setTimeout(wait, 150));
      wait();
    }
  } catch (e) {
    console.error(e); window.__err = String(e && e.stack || e);
    $('loadNote').textContent = 'تعذّر تحميل جزء من الجزيرة. أعد تحميل الصفحة.'; $('loadNote').classList.add('err');
  }
}
try { window.claude?.hot?.snapshot?.(() => (started && !SAVE.dead && player.alive ? { started: true, core: snapshotCore(), world: JSON.parse(JSON.stringify(snapshotWorld(), stripRec)), cy: cam.yaw, cp: cam.pitch } : { started: false })); } catch (_) {}
window.claude?.hot?.ready ? window.claude.hot.ready(boot) : boot(window.claude?.hot?.data ?? {});
