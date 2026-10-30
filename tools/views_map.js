(() => {
  // a tour of the chosen map: spawn town, a lake, open country, high ground, weather, the chart
  const W0 = WORLD.data, s = W0.spawn, sett = W0.settlements, lakes = W0.lakes || [];
  const look = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
  const v = [];
  v.push(() => { const r = __go(s.x, s.z, { hour: 10.2, w: 'clear', yaw: 0.4, pitch: 0.16, dist: 5 }); return ['town', r, MAP_ID, WEATHER.climate]; });
  if (lakes.length) v.push(() => {
    const L = lakes[0], x = L.x, z = L.z + L.rz + 40;
    const r = __go(x, z, { hour: 16.4, w: 'clear', yaw: look(x, z, L.x, L.z), pitch: 0.1, dist: 4 }); return ['lake', L.name, r];
  });
  v.push(() => {
    const p = __find((x, z) => { const b = biomeAt(x, z); return b !== 0 && b !== 1 && b !== 12 && b !== 13 && classAt(x, z) !== 2 && terrainAt(x, z) > 12 && slopeAt(x, z) < 0.25 && roadDist(x, z) > 60; }, 32, [s.x - 500, s.z + 700]);
    const r = __go(p[0], p[1], { hour: 17.3, w: 'clear', yaw: 2.4, pitch: 0.08, dist: 4 }); return ['country', r];
  });
  v.push(() => {
    let hi = null, hh = -1e9; for (let z = -PLAY + 200; z < PLAY - 200; z += 40) for (let x = -PLAY + 200; x < PLAY - 200; x += 40) { const h = terrainAt(x, z); if (h > hh && slopeAt(x, z) < 0.35) { hh = h; hi = [x, z]; } }
    const r = __go(hi[0], hi[1], { hour: 9.0, w: 'clear', yaw: look(hi[0], hi[1], s.x, s.z), pitch: 0.05, dist: 5 }); return ['high', r, Math.round(hh)];
  });
  v.push(() => {
    const t = sett.find((q) => q.kind === 'village') || sett[0];
    const r = __go(t.x + t.r * 0.9, t.z, { hour: 13, w: WEATHER.climate === 'desert' ? 'sand' : WEATHER.climate === 'snow' ? 'blizzard' : 'rain', yaw: look(t.x + t.r * 0.9, t.z, t.x, t.z), pitch: 0.1, dist: 4 });
    WEATHER.dust = (W_STATES[WEATHER.state].dust || 0); return ['weather', t.name, WEATHER.state, r];
  });
  v.push(() => { WEATHER.dust = 0; setWeather('clear', true); toggleChart(true); return ['chart', SETTLEMENTS.length]; });
  window.__views = v; window.__vi = 0;
  return v.length;
})()
