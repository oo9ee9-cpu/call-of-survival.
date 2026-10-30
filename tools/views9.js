(() => {
  const faceSun = (pitch) => { const s = ENV.sunDir; cam.yaw = cam.tyaw = Math.atan2(-s.x, -s.z); cam.pitch = cam.tpitch = pitch; updateCamera(0.016, true); };
  const st = (sid, k, i) => { const S = WORLD.data.settlements.find((q) => q.id === sid); const s = S.streets[k % S.streets.length]; const p = s.pts[Math.min(i, s.pts.length - 1)], q = s.pts[Math.min(i + 1, s.pts.length - 1)]; return [p[0], p[1], Math.atan2(q[0] - p[0], q[1] - p[1])]; };
  __views.push(() => { const p = __find((x, z) => biomeAt(x, z) === 11 && classAt(x, z) === 0 && forestAt(x, z) < 0.1 && slopeAt(x, z) < 0.1, 32, [0, -1500]); const r = __go(p[0], p[1], { hour: 10, w: 'clear', yaw: 0.5, camYaw: Math.PI, pitch: 0.06, dist: 2.3 }); return ['char-front', r]; });
  __views.push(() => { const r = __go(-717, -3230, { hour: 10, w: 'clear', yaw: Math.PI, camYaw: 0, pitch: 0.04 }); return ['city-a', r]; });
  __views.push(() => { const r = __go(-717, -3190, { hour: 15, w: 'fair', yaw: 0, camYaw: 0, pitch: 0.04 }); return ['city-b', r]; });
  __views.push(() => { const p = __find((x, z) => biomeAt(x, z) === 3 && forestAt(x, z) > 0.85 && slopeAt(x, z) < 0.2, 48, [-400, -1600]); const r = __go(p[0], p[1], { hour: 8.2, w: 'clear' }); faceSun(0.02); return ['forest-beams', r]; });
  __views.push(() => { const p = __find((x, z) => biomeAt(x, z) === 3 && forestAt(x, z) > 0.85 && slopeAt(x, z) < 0.2, 48, [-400, -1600]); const r = __go(p[0], p[1], { hour: 13, w: 'clear', yaw: 2.0 }); return ['forest-noon', r]; });
  __views.push(() => { const [x, z, yaw] = st('farm', 0, 2); const r = __go(x, z, { hour: 8.5, w: 'fair', yaw, camYaw: 0.4, pitch: 0.05 }); return ['village-road', r]; });
  return __views.length;
})()
