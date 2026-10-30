(() => {
  // after the fixes: the clothes shop with the scanned keeper (was a black frame), the hunter in daylight, the terraces' grass rim
  const v = [];
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
  const visit = (s, hour, dist) => {
    const fx = Math.sin(s.ry), fz = Math.cos(s.ry), x = s.kx + fx * 2.6, z = s.kz + fz * 2.6;
    const r = __go(x, z, { hour, w: 'clear', yaw: look(x, z, s.kx, s.kz), pitch: 0.04, dist });
    player.pos.y = s.y; player.root.position.copy(player.pos); keeperT = 0; updateKeepers(0.016); updateKeepers(0.5);
    const k = KEEPERS.find((q) => q.spot === s); return [s.kind, k ? k.body.kind : 'none', r];
  };
  v.push(() => {
    const town = SETTLEMENTS.find((S) => S.kind === 'city') || SETTLEMENTS[0];
    __go(town.src.x, town.src.z, { hour: 11, w: 'clear' }); for (const k of KEEPERS) { k.spot = null; k.body.root.visible = false; }
    const s = SHOP_SPOTS.map((q) => [q, Math.hypot(q.kx - town.src.x, q.kz - town.src.z)]).sort((a, b) => a[1] - b[1])[0][0];
    return visit(s, 11, 1.2);
  });
  v.push(() => { const k = KEEPERS.find((q) => q.body.kind === 'casual' && q.spot); return k ? visit(k.spot, 12, 0.6) : 'no casual'; });
  v.push(() => {
    const z = ZOMBIES.find((q) => q.body.kind === 'hunter'); if (!z) return ['no hunter'];
    const s = WORLD.data.spawn, p = __find((x, zz) => classAt(x, zz) === 0 && slopeAt(x, zz) < 0.05 && forestAt(x, zz) < 0.1 && terrainAt(x, zz) > waterAt(x, zz) + 2, 32, [s.x + 300, s.z]);
    __go(p[0], p[1], { hour: 10.5, w: 'clear', yaw: 0, pitch: 0.02, dist: 3.0 });
    const x = p[0] + 1.2, zz = p[1] + 6.5;
    Object.assign(z, { active: true, state: 'chase', x, y: groundAt(x, zz, terrainAt(x, zz) + 1), z: zz, type: 'brute', hp: 260, scale: 1.16, flash: 0, deadT: 0, cd: 0, wT: 0, stuck: 0, sx: x, sz: zz, side: 0, sideT: 0, yaw: Math.PI, lunge: 0 });
    z.root.visible = true; z.root.rotation.set(0, z.yaw, 0); z.body.inner.scale.setScalar(CHARS.hunter.scale * z.scale);
    for (const a of Object.values(z.acts)) { a.stop(); a.enabled = true; }
    z.main = z.acts.Walk; z.main.play(); z.main.setEffectiveWeight(1); z.main.timeScale = 0.48;
    player.health = 1e9; return ['hunter day', z.x | 0, z.z | 0];
  });
  v.push(() => {
    const L = LAND.list.filter((q) => q.kind === 'terraces')[0]; if (!L) return ['no terraces'];
    env(9.5, 'clear'); const a = 2.6, d = L.R * 1.25, x = L.x + Math.cos(a) * d, z = L.z + Math.sin(a) * d;
    freeCam(x, terrainAt(x, z) + 90, z, L.x, L.y + 10, L.z, 55); return ['terraces air', Math.round(L.x), Math.round(L.z)];
  });
  v.push(() => {
    const L = LAND.list.filter((q) => q.kind === 'terraces')[0]; if (!L) return ['no terraces'];
    env(15.5, 'clear'); const b = L.def.F.box, ex = (b[2] - 10) * L.s, ez = 0, wx = L.x + ex * L.c + ez * L.sn, wz = L.z - ex * L.sn + ez * L.c;
    const ox = wx + (wx - L.x) / Math.hypot(wx - L.x, wz - L.z) * 45, oz = wz + (wz - L.z) / Math.hypot(wx - L.x, wz - L.z) * 45;
    freeCam(ox, terrainAt(ox, oz) + 14, oz, wx, terrainAt(wx, wz), wz, 55); return ['terraces rim', Math.round(wx), Math.round(wz)];
  });
  v.push(() => { back(); const L = LAND.list.filter((q) => q.kind === 'terraces')[1]; if (!L) return ['no 2nd terraces'];
    env(10, 'clear'); const a = 0.9, d = L.R * 1.2, x = L.x + Math.cos(a) * d, z = L.z + Math.sin(a) * d;
    freeCam(x, terrainAt(x, z) + 60, z, L.x, L.y + 10, L.z, 55); return ['terraces 2', Math.round(L.x), Math.round(L.z)]; });
  window.__views = v; window.__vi = 0;
  return v.length;
})()
