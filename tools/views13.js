(() => {
  const toward = (x, z, cx, cz) => Math.atan2(cx - x, cz - z);
  const faceSun = (pitch) => { const s = ENV.sunDir; cam.yaw = cam.tyaw = Math.atan2(-s.x, -s.z); cam.pitch = cam.tpitch = pitch; updateCamera(0.016, true); };
  const beach = () => __find((x, z) => biomeAt(x, z) === 1 && terrainAt(x, z) > 1.5 && terrainAt(x, z) < 4, 48, [-3500, 0]);
  __views.push(() => { const p = beach(); const r = __go(p[0], p[1], { hour: 17.6, w: 'fair' }); faceSun(0.02); return ['golden', r]; });
  __views.push(() => { const p = beach(); const r = __go(p[0], p[1], { hour: 18.25, w: 'fair' }); faceSun(0.02); return ['sunset', r]; });
  __views.push(() => { const p = beach(); const r = __go(p[0], p[1], { hour: 18.7, w: 'fair' }); faceSun(0.02); return ['twilight', r]; });
  __views.push(() => { const p = __find((x, z) => biomeAt(x, z) === 7 && classAt(x, z) === 5 && slopeAt(x, z) < 0.15, 32, [-2600, 1200]); const r = __go(p[0], p[1], { hour: 13, w: 'clear', yaw: 0.8, pitch: 0.08 }); return ['dunes', r]; });
  __views.push(() => { const S = WORLD.data.settlements.find((q) => q.id === 'swamp'); const p = __find((x, z) => biomeAt(x, z) === 8 && terrainAt(x, z) > waterAt(x, z) + 0.2, 32, [S.x + 120, S.z]); const r = __go(p[0], p[1], { hour: 7.5, w: 'mist', yaw: 1.5, pitch: 0.05 }); return ['swamp', r]; });
  __views.push(() => { const p = __find((x, z) => biomeAt(x, z) === 11 && forestAt(x, z) < 0.2, 64, [-300, -2000]); const r = __go(p[0], p[1], { hour: 15, w: 'clear', yaw: 2.6, pitch: 0.02 }); return ['far-forests', r]; });
  return __views.length;
})()
