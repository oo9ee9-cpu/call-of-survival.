(() => {
  // one clean picture per map for the lobby's map cards: no HUD, no lobby, a scenic camera
  const W0 = WORLD.data, s = W0.spawn;
  const freeCam = (px, py, pz, lx, ly, lz, fov = 55) => {
    $('lobby').style.display = 'none'; $('intro').classList.add('gone'); $('pause').classList.add('gone'); hud.classList.remove('on');
    player.root.visible = false; if (LOBBY.body) LOBBY.body.root.visible = false;
    camera.fov = fov; camera.updateProjectionMatrix(); camera.position.set(px, py, pz); camera.lookAt(lx, ly, lz); camera.updateMatrixWorld();
    TERRAIN.update(0.016, px, py, pz, true); TERRAIN.update(0.016, px, py + 0.01, pz, true);
    updateSettlements(0.016, lx, lz, true); updateVegetation(0.016, px, pz, true); updateGrass(0.016, px, pz, true); updateRocks(0.016, px, pz, true); updateRoadLod(0, true);
    placeSun(lx, ly, lz); ENVMAP.update(0, true);
    sky.position.copy(camera.position); sky.scale.setScalar(camera.far * 0.9); stars.position.copy(camera.position); stars.scale.setScalar(camera.far * 0.85);
    paused = true;
  };
  const env = (hour, w) => { ENV.hour = hour; WEATHER.lock = false; setWeather(w, true); WEATHER.dust = (W_STATES[w].dust || 0); updateEnvironment(0, false); };
  const S = (id) => SETTLEMENTS.find((q) => q.id === id) || SETTLEMENTS[0];
  const V = {
    desert: () => { env(17.1, 'clear'); const t = S('oasis'); const L = W0.lakes[0]; freeCam(L.x - 260, terrainAt(L.x - 260, L.z + 320) + 40, L.z + 320, L.x + 40, 8, L.z - 60, 50); return 'desert'; },
    snow: () => { env(10.4, 'clear'); const t = S('village'); freeCam(t.x + 330, terrainAt(t.x + 330, t.z + 260) + 55, t.z + 260, t.x, terrainAt(t.x, t.z) + 5, t.z, 52); return 'snow'; },
    forest: () => { env(9.3, 'clear'); const L = W0.lakes[0]; freeCam(L.x - 430, terrainAt(L.x - 430, L.z + 380) + 34, L.z + 380, L.x, L.level + 4, L.z, 55); return 'forest'; },
    water: () => { env(16.8, 'clear'); const t = S('stilts'); freeCam(t.x + 70, 22, t.z + 95, t.x, 2, t.z, 50); return 'water'; },
    mega: () => { env(16.9, 'clear'); const v = W0.extras.volcano, x = v.x - 2300, z = v.z + 2000; freeCam(x, terrainAt(x, z) + 160, z, v.x, terrainAt(v.x, v.z) + 220, v.z, 55); paused = false; for (let k = 0; k < 40; k++) VOLCANO.update(3); paused = true; return 'mega'; },
    island: () => { env(9.6, 'clear'); freeCam(-150, 420, -2150, -760, 0, -3260, 55); return 'island'; },
  };
  window.__card = () => (V[MAP_ID] || V.island)();
  return MAP_ID;
})()
