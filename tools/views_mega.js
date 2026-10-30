(() => {
  // the continent: capital, the volcano's crater and a lava flow, the ghost city, a suspension bridge, the train, a tunnel, the fog over the chart
  const W0 = WORLD.data, s = W0.spawn, Vx = W0.extras.volcano;
  const look = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
  const freeCam = (px, py, pz, lx, ly, lz, fov = 55) => {
    $('lobby').style.display = 'none'; hud.classList.remove('on'); player.root.visible = false;
    camera.fov = fov; camera.updateProjectionMatrix(); camera.position.set(px, py, pz); camera.lookAt(lx, ly, lz); camera.updateMatrixWorld();
    TERRAIN.update(0.016, px, py, pz, true); TERRAIN.update(0.016, px, py + 0.01, pz, true); updateSettlements(0.016, lx, lz, true); updateVegetation(0.016, px, pz, true); updateGrass(0.016, px, pz, true); updateRocks(0.016, px, pz, true); updateRoadLod(0, true);
    placeSun(lx, ly, lz); ENVMAP.update(0, true); sky.position.copy(camera.position); sky.scale.setScalar(camera.far * 0.9); stars.position.copy(camera.position); stars.scale.setScalar(camera.far * 0.85);
    paused = true;
  };
  const env = (hour, w) => { ENV.hour = hour; setWeather(w, true); WEATHER.dust = W_STATES[w].dust || 0; updateEnvironment(0, false); };
  const S = (id) => SETTLEMENTS.find((q) => q.id === id);
  const road = (name) => ROADS.find((r) => r.name === name);
  const v = [];
  v.push(() => { const r = __go(s.x, s.z, { hour: 10.5, w: 'clear', yaw: 2.8, pitch: 0.16, dist: 6 }); return ['capital', r, ROADS.length]; });
  v.push(() => { env(18.6, 'clear'); for (let k = 0; k < 40; k++) VOLCANO.update(3); const a = 0.8, R = Vx.r + 140, x = Vx.x + Math.cos(a) * R, z = Vx.z + Math.sin(a) * R, y = terrainAt(x, z) + 30; freeCam(x, y, z, Vx.x, terrainAt(Vx.x, Vx.z) - 10, Vx.z, 60); return ['crater', Math.round(y), Math.round(terrainAt(Vx.x, Vx.z))]; });
  v.push(() => { paused = false; env(19.0, 'clear'); const x = Vx.x + 1400, z = Vx.z + 900; freeCam(x, terrainAt(x, z) + 90, z, Vx.x + 700, terrainAt(Vx.x + 700, Vx.z + 300), Vx.z + 300, 60); return ['flows']; });
  v.push(() => { paused = false; env(16.5, 'cloudy'); const t = S('ghost'); const st = t.src.streets[0], p = st.pts[0]; const r = __go(p[0] + 4, p[1] + 3, { hour: 16.5, w: 'cloudy', yaw: look(p[0], p[1], t.x, t.z), pitch: 0.12, dist: 5 }); return ['ghost', r]; });
  v.push(() => { paused = false; const b = road('الجسر المعلّق'); if (!b) return ['no bridge']; const p = b.pts[0], q = b.pts[b.pts.length - 1]; env(9.5, 'clear'); const bx = p[0] - (q[0] - p[0]) * 0.25, bz = p[1] - (q[1] - p[1]) * 0.25; freeCam(bx + 60, p[2] + 40, bz + 60, (p[0] + q[0]) / 2, p[2] - 10, (p[1] + q[1]) / 2, 55); return ['bridge', b.pts.length, Math.round(b.total)]; });
  v.push(() => { paused = false; const tr = TRAINS.find((q) => !q.cart); if (!tr) return ['no train', TRAINS.length]; tr.wait = 0; tr.s = tr.R.total * 0.35; tr.v = 14; tr.dir = 1; updateTrains(0.016); const c = tr.cars[0].m.position; env(14.5, 'clear'); freeCam(c.x + 30, c.y + 12, c.z + 30, c.x, c.y + 1.5, c.z, 50); return ['train', TRAINS.length, Math.round(c.x), Math.round(c.z)]; });
  v.push(() => { paused = false; const R = ROADS.find((r) => r.tunnels.length && r.kind !== 2); if (!R) return ['no tunnel']; const [a] = R.tunnels[0], p = R.pts[Math.max(0, a - 12)], q = R.pts[a]; env(11, 'clear'); freeCam(p[0], terrainAt(p[0], p[1]) + 6, p[1], q[0], terrainAt(q[0], q[1]) + 3, q[1], 60); return ['tunnel', R.name, R.tunnels.length]; });
  v.push(() => { paused = false; player.root.visible = true; __go(s.x, s.z, { hour: 12, w: 'clear' }); FOW.reveal(s.x, s.z, 900); const t = FOW.towers[0]; if (t) FOW.reveal(t.x, t.z, 3600); toggleChart(true); return ['chart', FOW.on, FOW.towers.length]; });
  window.__views = v; window.__vi = 0;
  return v.length;
})()
