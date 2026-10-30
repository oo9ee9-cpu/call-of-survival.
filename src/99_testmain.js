/* temporary test bootstrap: world, terrain, water, sky, vegetation */
(async () => {
  const P = new URLSearchParams(location.search);
  document.getElementById('intro').classList.add('gone');
  const t0 = performance.now();
  await loadWorld();
  await loadTerrainTextures();
  makeSeabedTexture(); buildInlandWater();
  loadImage('assets/tex/waternormals.jpg').then((im) => { const t = new THREE.Texture(im); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.needsUpdate = true; for (const m of [oceanMat, lakeMat]) { m.uniforms.uNormals.value = t; m.uniforms.uHasN.value = 1; } });
  const x = +(P.get('x') || -700), z = +(P.get('z') || -3000), yaw = +(P.get('yaw') || 0), pitch = +(P.get('pitch') || -0.12), up = +(P.get('up') || 2);
  ENV.hour = +(P.get('hour') || 10); if (P.get('w')) setWeather(P.get('w'), true);
  const gy = terrainAt(x, z); camera.position.set(x, Math.max(gy, waterAt(x, z)) + up, z);
  camera.rotation.set(pitch, yaw, 0, 'YXZ'); camera.updateMatrixWorld();
  updateWeather(0.016, 0, 0); updateEnvironment(0, false);
  TERRAIN.update(0.016, x, camera.position.y, z, true);
  placeSun(x, gy, z); ENVMAP.update(0, true);
  WET_U.value = WEATHER.wet = +(P.get('wet') || 0); TERR_U.uRain.value = WEATHER.rain;
  if (typeof initRoads === 'function') { const tr = performance.now(); initRoads(); window.__roadt = Math.round(performance.now() - tr); }
  if (typeof initSettlements === 'function') { const ts = performance.now(); initSettlements(); updateSettlements(0.016, x, z, true); window.__townt = Math.round(performance.now() - ts); }
  const tv = performance.now();
  if (P.get('veg') !== '0' && typeof loadVegetation === 'function') {
    await loadVegetation();
    const tb = performance.now();
    vegFrame(0.016, 0);
    if (P.get('lineup')) {
      // every species in a row in front of the camera, through the game's own instanced draws
      const ids = P.get('lineup') === '1' ? Object.keys(VEG.species) : P.get('lineup').split(','), lod = +(P.get('lod') || 0);
      const fx = Math.sin(yaw + Math.PI), fz = Math.cos(yaw + Math.PI), rx = Math.cos(yaw), rz = -Math.sin(yaw), dist = +(P.get('d') || 40);
      ids.forEach((id, k) => {
        const off = (k - (ids.length - 1) / 2) * +(P.get('gap') || 11), px = x + fx * dist + rx * off, pz = z + fz * dist + rz * off;
        const dr = drawFor(id, 0, lod, true);
        const m = new THREE.Matrix4().compose(new THREE.Vector3(px, terrainAt(px, pz), pz), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
        dr.trunk.setMatrixAt(dr.n, m); dr.trunk.setColorAt(dr.n, new THREE.Color(1, 1, 1)); if (dr.leaves) { dr.leaves.setMatrixAt(dr.n, m); dr.leaves.setColorAt(dr.n, new THREE.Color(1, 1, 1)); }
        dr.n++; for (const mm of [dr.trunk, dr.leaves]) if (mm) { mm.count = dr.n; mm.visible = true; mm.instanceMatrix.needsUpdate = true; mm.instanceColor.needsUpdate = true; }
      });
      VEG.ready = false;   // freeze: no streaming
      window.__lineup = ids;
    } else { updateVegetation(0.016, x, z, true); updateGrass(0.016, x, z, true); }
    window.__vegt = { load: Math.round(tb - tv), place: Math.round(performance.now() - tb) };
    if (typeof loadScans === 'function') { await loadScans(); updateRocks(0.016, x, z, true);
      if (P.get('scanlineup')) {
        const names = Object.keys(SCAN.obj), fx = Math.sin(yaw + Math.PI), fz = Math.cos(yaw + Math.PI), rx = Math.cos(yaw), rz = -Math.sin(yaw), dist = +(P.get('d') || 14);
        names.forEach((nm, k) => {
          const o = SCAN.obj[nm], size = nm.startsWith('cliff') || nm === 'flat' ? 4 : 1.6, s = size / Math.max(o.size[0], o.size[2]);
          const off = (k - (names.length - 1) / 2) * +(P.get('gap') || 3), px = x + fx * dist + rx * off, pz = z + fz * dist + rz * off;
          const m = new THREE.Mesh(o.lod0, o.mat); m.position.set(px, terrainAt(px, pz), pz); m.scale.setScalar(s); m.castShadow = true; scene.add(m);
        });
      }
    }
  }
  window.__stats = { load: Math.round(performance.now() - t0), chunks: TERRAIN.count, lakes: LAKES.group.children.length, veg: VEG.stats, grass: GRASS.count, vegt: window.__vegt, roadt: window.__roadt, townt: window.__townt, built: typeof SETTLEMENTS !== 'undefined' ? SETTLEMENTS.filter((q) => q.state === 'near').map((q) => q.id) : null, cols: typeof CGRID !== 'undefined' ? CGRID.map.size : 0 };
  let frames = 0;
  const loop = () => {
    if (frames < 4 || P.get('live')) requestAnimationFrame(loop); frames++;
    T_ENV += 0.016; updateEnvironment(0.016, false); updateWater(0.016, T_ENV); TERRAIN.update(0.016, camera.position.x, camera.position.y, camera.position.z);
    sky.position.copy(camera.position); sky.scale.setScalar(camera.far * 0.9); stars.position.copy(camera.position); stars.scale.setScalar(camera.far * 0.85);
    TERR_U.uTime.value = T_ENV;
    if (typeof updateSettlements === 'function') updateSettlements(0.016, camera.position.x, camera.position.z);
    if (typeof updateRocks === 'function') updateRocks(0.016, camera.position.x, camera.position.z);
    if (VEG.ready) { vegFrame(0.016, T_ENV); updateVegetation(0.016, camera.position.x, camera.position.z); updateGrass(0.016, camera.position.x, camera.position.z); }
    const r0 = performance.now(); renderer.render(scene, camera); window.__rt = Math.round(performance.now() - r0);
    window.__info = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
    if (frames === 3) window.__done = true;
  };
  loop();
})().catch((e) => { console.error(e); window.__err = String(e && e.stack || e); });
