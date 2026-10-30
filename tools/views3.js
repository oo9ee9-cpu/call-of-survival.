(() => {
  const faceSun = (pitch) => { const s = ENV.sunDir; cam.yaw = cam.tyaw = Math.atan2(-s.x, -s.z); cam.pitch = cam.tpitch = pitch; updateCamera(0.016, true); };
  const look = (tx, tz, pitch = 0.08) => { const p = player.pos; cam.yaw = cam.tyaw = Math.atan2(-(tx - p.x), -(tz - p.z)); cam.pitch = cam.tpitch = pitch; player.yaw = cam.yaw + Math.PI; };
  window.__hold = null; UPDATERS.push(() => { if (window.__hold) window.__hold(); });
  __views.push(() => { const p = __find((x, z) => biomeAt(x, z) === 3 && forestAt(x, z) > 0.8 && slopeAt(x, z) < 0.25, 48, [-900, -2600]); const r = __go(p[0], p[1], { hour: 16.3, w: 'fair' }); window.__hold = () => faceSun(-0.3); return ['forest-sun', r]; });
  __views.push(() => { window.__hold = null; const r = __go(1888 - 20, -1704 + 50, { hour: 12.5, w: 'storm' }); snowCover = 0.85; WEATHER.snow = 1; window.__hold = () => look(1888, -1704, 0.12); return ['snow-village', r]; });
  __views.push(() => { const r = __go(-2700 + 30, 2500 + 75, { hour: 9.5, w: 'clear' }); window.__hold = () => look(-2700, 2500, -0.05); return ['castle', r, SETTLEMENTS.find((s) => s.poi && s.poi.kind === 'castle').state]; });
  __views.push(() => { const r = __go(-1500 - 30, -400 + 25, { hour: 15, w: 'fair' }); window.__hold = () => look(-1500, -400, 0.06); return ['gas', r]; });
  __views.push(() => { window.__hold = null; const r = __go(-690, -3170, { hour: 12, w: 'rain', fpp: true, pitch: -0.1 }); WEATHER.wet = 1; return ['city-rain-fpp', r]; });
  __views.push(() => { const p = __find((x, z) => biomeAt(x, z) === 6 && classAt(x, z) === 0 && slopeAt(x, z) < 0.1, 32, [-1800, -1500]); const r = __go(p[0], p[1], { hour: 10, w: 'clear' }); camMode = 'tpp';
    const made = []; for (const [k, dx, dz] of [['cow', 8, 12], ['cow', 11, 15], ['horse', -6, 14], ['sheep', 3, 18], ['sheep', 5, 19], ['chicken', -2, 9]]) { const an = makeAnimal(k, p[0] + dx, p[1] + dz); made.push(k + ':' + !!an); }
    const v = spawnVehicle('truck', p[0] + 14, p[1] + 8, 1.2); window.__hold = () => look(p[0] + 4, p[1] + 14, 0.1); return ['farm-animals', r, made]; });
  return __views.length;
})()
