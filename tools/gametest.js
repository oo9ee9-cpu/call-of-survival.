(() => {
  // test driver: teleport, set time/weather, aim the camera; views run one per screenshot
  window.__find = (pred, step = 48, near = [0, 0]) => {
    let best = null, bd = 1e12;
    for (let z = -PLAY + 100; z < PLAY - 100; z += step) for (let x = -PLAY + 100; x < PLAY - 100; x += step) { if (!pred(x, z)) continue; const d = (x - near[0]) ** 2 + (z - near[1]) ** 2; if (d < bd) { bd = d; best = [x, z]; } }
    return best;
  };
  window.__go = (x, z, o = {}) => {
    if (!started) begin(true);
    { const lb = $('lobby'); if (lb) lb.style.display = 'none'; }
    if (player.vehicle) exitVehicle(true);
    const y = groundAt(x, z, terrainAt(x, z) + 3);
    player.pos.set(x, y, z); player.vel.set(0, 0, 0); player.yaw = o.yaw || 0; player.root.position.copy(player.pos);
    cam.yaw = cam.tyaw = (o.yaw || 0) + Math.PI + (o.camYaw || 0); cam.pitch = cam.tpitch = o.pitch !== undefined ? o.pitch : 0.12; cam.user = o.dist || 3;
    if (o.fpp) camMode = 'fpp'; else camMode = 'tpp';
    if (o.hour !== undefined) ENV.hour = o.hour;
    if (o.w) { const wet = W_STATES[o.w].rain > 0; ENV.weatherMode = wet ? 'rain' : 'clear'; setWeather(o.w, true); WEATHER.wet = o.wet !== undefined ? o.wet : (wet ? 1 : 0); WEATHER.rain = W_STATES[o.w].rain; if (!wet) { WEATHER.state = o.w; WEATHER.target = W_STATES[o.w]; Object.assign(WEATHER, W_STATES[o.w]); } }
    player.health = 100; player.bornAt = T;
    cam.focus.set(x, y + 1.6, z); updateCamera(0.016, true); introT = 1;
    updateEnvironment(0, false); placeSun(x, y, z);
    TERRAIN.update(0.016, cam.pos.x, cam.pos.y, cam.pos.z, true);
    updateSettlements(0.016, x, z, true); updateVegetation(0.016, x, z, true); updateGrass(0.016, x, z, true); updateRocks(0.016, x, z, true); updateRoadLod(0, true);
    ENVMAP.update(0, true);
    for (const zb of ZOMBIES) { zb.active = false; zb.root.visible = false; }
    return [x | 0, y | 0, z | 0, biomeAt(x, z)];
  };
  window.__views = []; window.__vi = 0;
  window.__next = () => { const v = window.__views[window.__vi++]; if (!v) return 'end'; try { return v(); } catch (e) { return 'ERR ' + e.message; } };
  return 'ok';
})()
