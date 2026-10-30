(() => {
  // fourth pass: the volcano's smoke (updated after the camera moves), a lab from its door, the dead city's wrecks, the lava in daylight
  const W0 = WORLD.data, Vx = W0.extras.volcano;
  const freeCam = (px, py, pz, lx, ly, lz, fov = 55) => {
    $('lobby').style.display = 'none'; hud.classList.remove('on'); player.root.visible = false;
    camera.fov = fov; camera.updateProjectionMatrix(); camera.position.set(px, py, pz); camera.lookAt(lx, ly, lz); camera.updateMatrixWorld();
    TERRAIN.update(0.016, px, py, pz, true); TERRAIN.update(0.016, px, py + 0.01, pz, true); updateSettlements(0.016, lx, lz, true); updateVegetation(0.016, px, pz, true); updateGrass(0.016, px, pz, true); updateRocks(0.016, px, pz, true); updateRoadLod(0, true);
    placeSun(lx, ly, lz); ENVMAP.update(0, true); sky.position.copy(camera.position); sky.scale.setScalar(camera.far * 0.9); stars.position.copy(camera.position); stars.scale.setScalar(camera.far * 0.85);
    for (let k = 0; k < 40; k++) VOLCANO.update(3);
    paused = true;
  };
  const env = (hour, w) => { ENV.hour = hour; setWeather(w, true); WEATHER.dust = W_STATES[w].dust || 0; updateEnvironment(0, false); };
  const back = () => { paused = false; hud.classList.add('on'); player.root.visible = true; camera.fov = 60; camera.updateProjectionMatrix(); };
  const v = [];
  v.push(() => { env(16.4, 'clear'); const x = Vx.x - 2600, z = Vx.z + 2300; freeCam(x, terrainAt(x, z) + 140, z, Vx.x, terrainAt(Vx.x, Vx.z) + 260, Vx.z, 55); return ['volcano smoke', camera.far | 0]; });
  v.push(() => {
    paused = false; env(15.6, 'clear');
    let rim = 0; for (let a = 0; a < TAU; a += 0.2) rim = Math.max(rim, terrainAt(Vx.x + Math.cos(a) * Vx.r, Vx.z + Math.sin(a) * Vx.r));
    const x = Vx.x + Vx.r * 0.75, z = Vx.z + Vx.r * 0.75; freeCam(x, rim + 170, z, Vx.x - Vx.r * 0.2, terrainAt(Vx.x, Vx.z), Vx.z - Vx.r * 0.2, 62);
    return ['crater', Math.round(rim)];
  });
  v.push(() => { paused = false; env(21.5, 'clear'); const x = Vx.x - 2600, z = Vx.z + 2300; freeCam(x, terrainAt(x, z) + 140, z, Vx.x, terrainAt(Vx.x, Vx.z) + 260, Vx.z, 55); return ['volcano night']; });
  window.__views = v; window.__vi = 0;
  return v.length;
})()
