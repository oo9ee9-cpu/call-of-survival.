(() => {
  const st = (sid, k, i) => { const S = WORLD.data.settlements.find((q) => q.id === sid); const s = S.streets[k % S.streets.length]; const p = s.pts[Math.min(i, s.pts.length - 1)], q = s.pts[Math.min(i + 1, s.pts.length - 1)]; return [p[0], p[1], Math.atan2(q[0] - p[0], q[1] - p[1])]; };
  __views.push(() => { const [x, z, yaw] = st('mountain', 0, 1); const r = __go(x, z, { hour: 11.5, w: 'fair', yaw, camYaw: 0.3, pitch: 0.08 }); return ['snow-village', r, tempAt(x, z)]; });
  __views.push(() => { const p = __find((x, z) => biomeAt(x, z) === 4 && forestAt(x, z) > 0.7 && tempAt(x, z) < 0.36 && slopeAt(x, z) < 0.2, 48, [1888, -1704]); const r = __go(p[0], p[1], { hour: 13, w: 'clear', yaw: 1.0, pitch: 0.06 }); return ['snow-forest', r, tempAt(p[0], p[1])]; });
  __views.push(() => { const p = __find((x, z) => tempAt(x, z) < 0.37 && tempAt(x, z) > 0.3 && forestAt(x, z) < 0.3 && slopeAt(x, z) < 0.2, 48, [1700, -1300]); const r = __go(p[0], p[1], { hour: 15.5, w: 'clear', yaw: 2.4, pitch: 0.1, dist: 4 }); return ['snow-open', r, tempAt(p[0], p[1])]; });
  return __views.length;
})()
