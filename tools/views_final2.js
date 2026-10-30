(() => {
  // last look before publishing: jeeps near and far (the far level), the graded terraces from the air and at their rim
  const v = [];
  const freeCam = (px, py, pz, lx, ly, lz, fov = 55) => {
    $('lobby').style.display = 'none'; hud.classList.remove('on'); player.root.visible = false;
    camera.fov = fov; camera.updateProjectionMatrix(); camera.position.set(px, py, pz); camera.lookAt(lx, ly, lz); camera.updateMatrixWorld();
    TERRAIN.update(0.016, px, py, pz, true); TERRAIN.update(0.016, px, py + 0.01, pz, true); updateSettlements(0.016, lx, lz, true); updateVegetation(0.016, px, pz, true); updateGrass(0.016, px, pz, true); updateRocks(0.016, px, pz, true); updateRoadLod(0, true);
    LAND.lastX = 1e9; updateLandforms();
    placeSun(lx, ly, lz); ENVMAP.update(0, true); sky.position.copy(camera.position); sky.scale.setScalar(camera.far * 0.9); stars.position.copy(camera.position); stars.scale.setScalar(camera.far * 0.85);
    paused = true;
  };
  const env = (hour, w) => { ENV.hour = hour; setWeather(w, true); WEATHER.dust = W_STATES[w].dust || 0; updateEnvironment(0, false); };
  v.push(() => {
    const s = WORLD.data.spawn, p = __find((x, z) => classAt(x, z) === 0 && slopeAt(x, z) < 0.03 && forestAt(x, z) < 0.05 && terrainAt(x, z) > waterAt(x, z) + 3 && roadDist(x, z) > 40 && Math.abs(terrainAt(x + 120, z) - terrainAt(x, z)) < 6, 24, [s.x + 260, s.z + 140]);
    __go(p[0], p[1] - 8, { hour: 10, w: 'clear', yaw: 0, pitch: 0.04, dist: 3 });
    const P = [0xd8702a, MIL_OLIVE, 0x1e3a6a, 0xe8e6e0, 0x8a3a2e, 0x2f6a4a];
    const J = P.map((c, i) => spawnVehicle('jeep', p[0] + (i % 2 ? 4 : -4), p[1] + 8 + i * 18, 0.9 + i * 0.4, c));
    window.__J = J; const lod = J.map((j) => { const l = j.root.children[0]; return l.isLOD ? l.levels.map((q) => q.distance) : 'none'; });
    return ['jeep line', lod, !!CAR_MODELS.uaz_lo];
  });
  v.push(() => {
    const J = window.__J, j = J[5], c = J[0]; const vis = J.map((q) => { const l = q.root.children[0]; return l.isLOD ? l.levels.map((e) => e.object.visible ? 1 : 0).join('') : '-'; });
    freeCam(c.pos.x - 6, c.pos.y + 2.2, c.pos.z - 10, j.pos.x, j.pos.y + 1, j.pos.z, 40); return ['far jeeps', vis];
  });
  v.push(() => {
    const L = LAND.list.filter((q) => q.kind === 'terraces')[0]; if (!L) return ['no terraces'];
    env(9.5, 'clear'); const a = 2.6, d = L.R * 1.25, x = L.x + Math.cos(a) * d, z = L.z + Math.sin(a) * d;
    freeCam(x, terrainAt(x, z) + 90, z, L.x, L.y + 10, L.z, 55); return ['terraces air'];
  });
  v.push(() => {
    const L = LAND.list.filter((q) => q.kind === 'terraces')[0]; if (!L) return ['no terraces'];
    env(15.5, 'clear'); const b = L.def.F.box, ex = (b[2] - 10) * L.s, wx = L.x + ex * L.c, wz = L.z - ex * L.sn;
    const ox = wx + (wx - L.x) / Math.hypot(wx - L.x, wz - L.z) * 45, oz = wz + (wz - L.z) / Math.hypot(wx - L.x, wz - L.z) * 45;
    freeCam(ox, terrainAt(ox, oz) + 14, oz, wx, terrainAt(wx, wz), wz, 55); return ['terraces rim'];
  });
  window.__views = v; window.__vi = 0;
  return v.length;
})()
