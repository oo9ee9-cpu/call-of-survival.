(() => {
  // second pass on the continent: into the crater from above, the volcano's smoke from afar, a lab inside, driving the train, the fog over the chart
  const W0 = WORLD.data, s = W0.spawn, Vx = W0.extras.volcano;
  const freeCam = (px, py, pz, lx, ly, lz, fov = 55) => {
    $('lobby').style.display = 'none'; hud.classList.remove('on'); player.root.visible = false;
    camera.fov = fov; camera.updateProjectionMatrix(); camera.position.set(px, py, pz); camera.lookAt(lx, ly, lz); camera.updateMatrixWorld();
    TERRAIN.update(0.016, px, py, pz, true); TERRAIN.update(0.016, px, py + 0.01, pz, true); updateSettlements(0.016, lx, lz, true); updateVegetation(0.016, px, pz, true); updateGrass(0.016, px, pz, true); updateRocks(0.016, px, pz, true); updateRoadLod(0, true);
    placeSun(lx, ly, lz); ENVMAP.update(0, true); sky.position.copy(camera.position); sky.scale.setScalar(camera.far * 0.9); stars.position.copy(camera.position); stars.scale.setScalar(camera.far * 0.85);
    paused = true;
  };
  const env = (hour, w) => { ENV.hour = hour; setWeather(w, true); WEATHER.dust = W_STATES[w].dust || 0; updateEnvironment(0, false); };
  const back = () => { paused = false; hud.classList.add('on'); player.root.visible = true; camera.fov = 60; camera.updateProjectionMatrix(); };
  const v = [];
  v.push(() => {
    env(15.6, 'clear'); for (let k = 0; k < 40; k++) VOLCANO.update(3);
    let rim = 0; for (let a = 0; a < TAU; a += 0.2) rim = Math.max(rim, terrainAt(Vx.x + Math.cos(a) * Vx.r, Vx.z + Math.sin(a) * Vx.r));
    const x = Vx.x + Vx.r * 0.75, z = Vx.z + Vx.r * 0.75; freeCam(x, rim + 170, z, Vx.x - Vx.r * 0.2, terrainAt(Vx.x, Vx.z), Vx.z - Vx.r * 0.2, 62);
    return ['crater', Math.round(rim), Math.round(terrainAt(Vx.x, Vx.z))];
  });
  v.push(() => { paused = false; env(16.9, 'clear'); for (let k = 0; k < 40; k++) VOLCANO.update(3); const x = Vx.x - 2600, z = Vx.z + 2300; freeCam(x, terrainAt(x, z) + 140, z, Vx.x, terrainAt(Vx.x, Vx.z) + 260, Vx.z, 55); return ['volcano']; });
  v.push(() => {
    back(); const S = SETTLEMENTS.find((q) => q.src.buildings && q.src.buildings.some((b) => b.lab)); if (!S) return ['no lab'];
    const b = S.src.buildings.find((q) => q.lab); const r = __go(b.x, b.z, { hour: 13, w: 'clear', yaw: 0, pitch: 0.02, dist: 3, fpp: true });
    return ['lab', S.name, r, b.door, LOOT_SPOTS.filter((l) => l.bid === b.id).length];
  });
  v.push(() => {
    back(); camMode = 'tpp'; const tr = TRAINS.find((q) => q.veh); if (!tr) return ['no train', TRAINS.length];
    tr.ai = true; tr.wait = 60; tr.v = 0; updateTrains(0.016);
    const m = tr.cars[0].m.position, ry = tr.cars[0].m.rotation.y, x = m.x + Math.cos(ry) * 3.2, z = m.z - Math.sin(ry) * 3.2;
    __go(x, z, { hour: 10.5, w: 'clear' }); railVehicle(tr.veh, 0.016, false); nearVeh = tr.veh;
    enterVehicle(tr.veh); joy.y = 1;
    return ['train in', player.vehicle === tr.veh, Math.round(tr.s), Math.round(tr.R.total)];
  });
  v.push(() => { const tr = TRAINS.find((q) => q.veh); const r = ['train run', Math.round(tr.s), Math.round(tr.sv * 3.6) + ' km/h', player.vehicle === tr.veh]; return r; });
  v.push(() => { joy.y = 0; const tr = TRAINS.find((q) => q.veh); const ok = exitVehicle(true); return ['train out', ok, !player.vehicle, Math.round(player.pos.x), Math.round(player.pos.z), tr.ai, player.alive]; });
  v.push(() => { __go(s.x, s.z, { hour: 12, w: 'clear' }); FOW.reveal(s.x, s.z, 900); const t = FOW.towers[0]; if (t) FOW.reveal(t.x, t.z, 3600); toggleChart(true); return ['chart', FOW.on, FOW.towers.length]; });
  window.__views = v; window.__vi = 0;
  return v.length;
})()
