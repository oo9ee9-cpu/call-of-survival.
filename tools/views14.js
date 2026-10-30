(() => {
  const st = (sid, k, i) => { const S = WORLD.data.settlements.find((q) => q.id === sid); const s = S.streets[k % S.streets.length]; const p = s.pts[Math.min(i, s.pts.length - 1)], q = s.pts[Math.min(i + 1, s.pts.length - 1)]; return [p[0], p[1], Math.atan2(q[0] - p[0], q[1] - p[1])]; };
  __views.push(() => { const [x, z, yaw] = st('farm', 1, 2); const r = __go(x, z, { hour: 11, w: 'storm', yaw, camYaw: 0.3, pitch: 0.12, fpp: true }); return ['farm-storm-fpp', r]; });
  __views.push(() => { const r = __go(-717, -3230, { hour: 12, w: 'rain', yaw: Math.PI, pitch: 0.25 }); return ['city-rain-puddles', r]; });
  __views.push(() => { const p = __find((x, z) => biomeAt(x, z) === 11 && forestAt(x, z) < 0.2, 64, [-300, -2000]); const r = __go(p[0], p[1], { hour: 10, w: 'fair', yaw: 2.6, pitch: -0.35 }); return ['sky-fair', r]; });
  __views.push(() => { const p = __find((x, z) => biomeAt(x, z) === 11 && forestAt(x, z) < 0.2, 64, [-300, -2000]); const r = __go(p[0], p[1], { hour: 16, w: 'cloudy', yaw: 0.6, pitch: -0.3 }); return ['sky-cloudy', r]; });
  return __views.length;
})()
