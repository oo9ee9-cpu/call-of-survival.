(() => {
  // v13 check: driving the field jeep (seat, wheels), an army base's olive jeeps, the terraced fields and a crag
  const look = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
  const freeCam = (px, py, pz, lx, ly, lz, fov = 55) => {
    $('lobby').style.display = 'none'; hud.classList.remove('on');
    camera.fov = fov; camera.updateProjectionMatrix(); camera.position.set(px, py, pz); camera.lookAt(lx, ly, lz); camera.updateMatrixWorld();
    TERRAIN.update(0.016, px, py, pz, true); TERRAIN.update(0.016, px, py + 0.01, pz, true); updateSettlements(0.016, lx, lz, true); updateVegetation(0.016, px, pz, true); updateGrass(0.016, px, pz, true); updateRocks(0.016, px, pz, true); updateRoadLod(0, true);
    LAND.lastX = 1e9; updateLandforms();
    placeSun(lx, ly, lz); ENVMAP.update(0, true); sky.position.copy(camera.position); sky.scale.setScalar(camera.far * 0.9); stars.position.copy(camera.position); stars.scale.setScalar(camera.far * 0.85);
    paused = true;
  };
  const env = (hour, w) => { ENV.hour = hour; setWeather(w, true); WEATHER.dust = W_STATES[w].dust || 0; updateEnvironment(0, false); };
  const back = () => { paused = false; hud.classList.add('on'); player.root.visible = true; camera.fov = 60; camera.updateProjectionMatrix(); };
  const v = [];
  let J = null;
  v.push(() => {
    const s = WORLD.data.spawn, p = __find((x, z) => classAt(x, z) === 0 && slopeAt(x, z) < 0.04 && forestAt(x, z) < 0.08 && terrainAt(x, z) > waterAt(x, z) + 3 && roadDist(x, z) > 25, 24, [s.x - 200, s.z + 150]);
    __go(p[0] - 3, p[1], { hour: 10, w: 'clear' }); J = spawnVehicle('jeep', p[0], p[1], 0.3, 0x2f6a4a); nearVeh = J; enterVehicle(J); joy.y = 0.35;
    return ['drive', player.vehicle === J];
  });
  v.push(() => {
    joy.y = 0; const j = J, sx = Math.cos(j.yaw), sz = -Math.sin(j.yaw);
    freeCam(j.pos.x + sx * 4.2 + Math.sin(j.yaw) * 0.6, j.pos.y + 1.5, j.pos.z + sz * 4.2 + Math.cos(j.yaw) * 0.6, j.pos.x, j.pos.y + 1.0, j.pos.z, 50);
    return ['driver side', Math.round(j.speed * 3.6)];
  });
  v.push(() => {
    back(); if (player.vehicle) exitVehicle(true);
    const S = SETTLEMENTS.find((q) => q.kind === 'military'); if (!S) return ['no base'];
    updateSettlements(0.016, S.src.x, S.src.z, true);
    const jeeps = VEHICLES.filter((w) => w.kind === 'jeep' && w.town === S.id);
    const j = jeeps[0] || VEHICLES.find((w) => w.town === S.id); if (!j) return ['no base cars', S.id];
    const x = j.pos.x + Math.sin(j.yaw + 0.9) * 7, z = j.pos.z + Math.cos(j.yaw + 0.9) * 7;
    const r = __go(x, z, { hour: 14, w: 'clear', yaw: look(x, z, j.pos.x, j.pos.z), pitch: 0.12, dist: 3.2 });
    return ['base', S.id, jeeps.length, r];
  });
  v.push(() => {
    const L = LAND.list.filter((q) => q.kind === 'terraces')[0]; if (!L) return ['no terraces'];
    env(9.5, 'clear'); const a = 2.6, d = L.R * 1.25, x = L.x + Math.cos(a) * d, z = L.z + Math.sin(a) * d;
    freeCam(x, terrainAt(x, z) + 90, z, L.x, L.y + 10, L.z, 55); return ['terraces air', Math.round(L.x), Math.round(L.z), +L.s.toFixed(2)];
  });
  v.push(() => {
    back(); const L = LAND.list.filter((q) => q.kind === 'terraces')[0]; if (!L) return ['no terraces'];
    const r = __go(L.x + 10, L.z - 8, { hour: 16.8, w: 'clear', yaw: 1.4, pitch: 0.05, dist: 5 }); return ['on terraces', r];
  });
  v.push(() => {
    const L = LAND.list.filter((q) => q.kind === 'crag')[1] || LAND.list.filter((q) => q.kind === 'crag')[0]; if (!L) return ['no crag'];
    env(11, 'clear'); const a = 0.4, d = L.R * 3.0, x = L.x + Math.cos(a) * d, z = L.z + Math.sin(a) * d;
    freeCam(x, terrainAt(x, z) + 20, z, L.x, L.y + L.def.size[1] * L.s * 0.45, L.z, 55); return ['crag', Math.round(L.x), Math.round(L.z)];
  });
  window.__views = v; window.__vi = 0;
  return v.length;
})()
