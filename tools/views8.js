(() => {
  // polish pass views: city street, village road with poles, meadow, character close-up, forest beams, wet street
  const faceSun = (pitch) => { const s = ENV.sunDir; cam.yaw = cam.tyaw = Math.atan2(-s.x, -s.z); cam.pitch = cam.tpitch = pitch; updateCamera(0.016, true); };
  const st = (sid, k, i) => { const S = WORLD.data.settlements.find((q) => q.id === sid); const s = S.streets[k % S.streets.length]; const p = s.pts[Math.min(i, s.pts.length - 1)], q = s.pts[Math.min(i + 1, s.pts.length - 1)]; return [p[0], p[1], Math.atan2(q[0] - p[0], q[1] - p[1])]; };
  __views.push(() => { const [x, z, yaw] = st('city', 3, 1); const r = __go(x, z, { hour: 12.5, w: 'clear', yaw, camYaw: 0.25, pitch: 0.06 }); return ['city-street', r]; });
  __views.push(() => { const [x, z, yaw] = st('farm', 0, 2); const r = __go(x, z, { hour: 8.5, w: 'cloudy', yaw, camYaw: 0.4, pitch: 0.05 }); return ['village-road', r]; });
  __views.push(() => { const p = __find((x, z) => biomeAt(x, z) === 11 && classAt(x, z) === 0 && forestAt(x, z) < 0.15 && slopeAt(x, z) < 0.15, 32, [0, -1500]); const r = __go(p[0], p[1], { hour: 9, w: 'clear', pitch: 0.02 }); return ['meadow', r]; });
  __views.push(() => { const r = __go(-717, -3200, { hour: 11, w: 'clear', yaw: 0.6, camYaw: Math.PI, pitch: 0.05, dist: 2.2 }); return ['char-front', r]; });
  __views.push(() => { const p = __find((x, z) => biomeAt(x, z) === 3 && forestAt(x, z) > 0.85 && slopeAt(x, z) < 0.2, 48, [-400, -1600]); const r = __go(p[0], p[1], { hour: 8.2, w: 'clear' }); faceSun(0.02); return ['forest-beams', r]; });
  __views.push(() => { const [x, z, yaw] = st('city', 5, 1); const r = __go(x, z, { hour: 17.5, w: 'rain', yaw, camYaw: 0.2, pitch: 0.04 }); return ['city-rain', r]; });
  return __views.length;
})()
