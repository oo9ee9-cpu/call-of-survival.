(() => {
  // the scanned landforms in place: a peak from afar and from its foot, terraced fields from the air and underfoot
  const look = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
  const freeCam = (px, py, pz, lx, ly, lz, fov = 55) => {
    $('lobby').style.display = 'none'; hud.classList.remove('on'); player.root.visible = false;
    camera.fov = fov; camera.updateProjectionMatrix(); camera.position.set(px, py, pz); camera.lookAt(lx, ly, lz); camera.updateMatrixWorld();
    TERRAIN.update(0.016, px, py, pz, true); TERRAIN.update(0.016, px, py + 0.01, pz, true); updateSettlements(0.016, lx, lz, true); updateVegetation(0.016, px, pz, true); updateGrass(0.016, px, pz, true); updateRocks(0.016, px, pz, true); updateRoadLod(0, true);
    LAND.lastX = 1e9; updateLandforms();
    placeSun(lx, ly, lz); ENVMAP.update(0, true); sky.position.copy(camera.position); sky.scale.setScalar(camera.far * 0.9); stars.position.copy(camera.position); stars.scale.setScalar(camera.far * 0.85);
    paused = true;
  };
  const env = (hour, w) => { ENV.hour = hour; setWeather(w, true); WEATHER.dust = W_STATES[w].dust || 0; updateEnvironment(0, false); };
  const back = () => { paused = false; hud.classList.add('on'); player.root.visible = true; camera.fov = 60; camera.updateProjectionMatrix(); };
  const of = (k) => LAND.list.filter((L) => L.kind === k);
  const v = [];
  v.push(() => { const L = of('crag')[0]; if (!L) return ['no crag', LAND.list.length, LAND.ready];
    env(10.5, 'clear'); const a = 0.7, d = L.R * 3.2, x = L.x + Math.cos(a) * d, z = L.z + Math.sin(a) * d;
    freeCam(x, terrainAt(x, z) + 25, z, L.x, L.y + L.def.size[1] * L.s * 0.45, L.z, 55); return ['crag far', Math.round(L.x), Math.round(L.z), +L.s.toFixed(2), Math.round(L.y), LAND.list.length]; });
  v.push(() => { back(); const L = of('crag')[0]; if (!L) return ['no crag'];
    const a = 2.2, d = L.R * 1.05, x = L.x + Math.cos(a) * d, z = L.z + Math.sin(a) * d;
    const r = __go(x, z, { hour: 15.5, w: 'clear', yaw: look(x, z, L.x, L.z), pitch: -0.15, dist: 5 }); return ['crag foot', r, Math.round(landTop(x, z))]; });
  v.push(() => { const L = of('terraces')[0]; if (!L) return ['no terraces'];
    env(9.5, 'clear'); const a = 2.6, d = L.R * 1.25, x = L.x + Math.cos(a) * d, z = L.z + Math.sin(a) * d;
    freeCam(x, terrainAt(x, z) + 90, z, L.x, L.y + 10, L.z, 55); return ['terraces air', Math.round(L.x), Math.round(L.z), +L.s.toFixed(2)]; });
  v.push(() => { back(); const L = of('terraces')[0]; if (!L) return ['no terraces'];
    const r = __go(L.x + 10, L.z - 8, { hour: 16.8, w: 'clear', yaw: 1.4, pitch: 0.05, dist: 5 }); return ['on terraces', r, Math.round(landTop(L.x + 10, L.z - 8)), Math.round(player.pos.y)]; });
  window.__views = v; window.__vi = 0;
  return v.length;
})()
