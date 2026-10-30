(() => {
  const st = (sid, k, i) => { const S = WORLD.data.settlements.find((q) => q.id === sid); const s = S.streets[k % S.streets.length]; const p = s.pts[Math.min(i, s.pts.length - 1)], q = s.pts[Math.min(i + 1, s.pts.length - 1)]; return [p[0], p[1], Math.atan2(q[0] - p[0], q[1] - p[1])]; };
  __views.push(() => { const [x, z, yaw] = st('farm', 1, 2); const r = __go(x, z, { hour: 11, w: 'storm', yaw, camYaw: 0.3, pitch: 0.12, fpp: true }); return ['both', r]; });
  __views.push(() => { SPLASH.off = true; return 'no splash'; });
  __views.push(() => { SPLASH.off = false; Object.defineProperty(TERR_U.uRain, 'value', { get: () => 0, set: () => {}, configurable: true }); return 'splash only'; });
  return __views.length;
})()
