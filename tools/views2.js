(() => {
  const faceSun = (pitch) => { const s = ENV.sunDir; cam.yaw = cam.tyaw = Math.atan2(-s.x, -s.z); cam.pitch = cam.tpitch = pitch; updateCamera(0.016, true); };
  const keep = (fn) => { window.__hold = fn; };
  UPDATERS.push(() => { if (window.__hold) window.__hold(); });
  __views.push(() => { const p = __find((x, z) => biomeAt(x, z) === 3 && forestAt(x, z) > 0.8 && slopeAt(x, z) < 0.25, 48, [-900, -2600]); const r = __go(p[0], p[1], { hour: 16.3, w: 'fair' }); keep(() => faceSun(-0.3)); return ['forest-sun', r]; });
  __views.push(() => { keep(null); const p = __find((x, z) => classAt(x, z) === 1 && Math.abs(x + 2000) < 500 && Math.abs(z + 1300) < 500, 16, [-1930, -1380]); const r = __go(p[0], p[1], { hour: 11, w: 'storm', yaw: 0, camYaw: 0.5, pitch: 0.05 }); return ['farm-rain', r]; });
  __views.push(() => { const r = __go(1888 + 30, -1704 + 40, { hour: 13, w: 'rain', pitch: 0.12, camYaw: 0.4 }); return ['snow-day', r, WEATHER.snow, snowCover]; });
  __views.push(() => { const r = __go(-2700 + 10, 2500 + 40, { hour: 9.5, w: 'clear', pitch: 0.02, camYaw: 0 }); return ['castle', r]; });
  __views.push(() => { const r = __go(-1500 + 30, -400 + 20, { hour: 18.4, w: 'fair', pitch: 0.05, camYaw: 0.7 }); return ['gas', r]; });
  __views.push(() => { const r = __go(-700, -3150, { hour: 14, w: 'clear', pitch: 0.06, camYaw: 0.0 }); const v = spawnVehicle('truck', player.pos.x + 5, player.pos.z + 3, 0.6); return ['city-truck', r, v.wheels.length]; });
  return __views.length;
})()
