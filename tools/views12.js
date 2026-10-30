(() => {
  const toward = (x, z, cx, cz) => Math.atan2(cx - x, cz - z);
  const faceSun = (pitch) => { const s = ENV.sunDir; cam.yaw = cam.tyaw = Math.atan2(-s.x, -s.z); cam.pitch = cam.tpitch = pitch; updateCamera(0.016, true); };
  // beach looking out to sea
  __views.push(() => { const p = __find((x, z) => biomeAt(x, z) === 1 && classAt(x, z) === 3 && terrainAt(x, z) > 1.2 && terrainAt(x, z) < 3, 48, [-1500, -3600]); const sea = __find((x, z) => biomeAt(x, z) === 0, 32, p); const r = __go(p[0], p[1], { hour: 11, w: 'clear', yaw: toward(p[0], p[1], sea[0], sea[1]), pitch: 0.05 }); return ['beach', r]; });
  // sunset over the sea
  __views.push(() => { const p = __find((x, z) => biomeAt(x, z) === 1 && terrainAt(x, z) > 1.5 && terrainAt(x, z) < 4, 48, [-3500, 0]); const r = __go(p[0], p[1], { hour: 18.6, w: 'fair' }); faceSun(0.0); return ['sunset', r]; });
  // lake shore
  __views.push(() => { const p = __find((x, z) => biomeAt(x, z) !== 12 && biomeAt(x, z) !== 0 && waterAt(x, z) > terrainAt(x, z) - 3 && waterAt(x, z) < terrainAt(x, z) && terrainAt(x, z) > 5, 32, [250, -880]); const lk = __find((x, z) => biomeAt(x, z) === 12, 16, p); const r = __go(p[0], p[1], { hour: 9.5, w: 'clear', yaw: toward(p[0], p[1], lk[0], lk[1]), pitch: 0.06 }); return ['lake', r]; });
  // city at night
  __views.push(() => { const r = __go(-717, -3230, { hour: 22, w: 'clear', yaw: Math.PI, pitch: 0.05 }); return ['city-night', r]; });
  // desert dunes at noon
  __views.push(() => { const p = __find((x, z) => biomeAt(x, z) === 7 && classAt(x, z) === 5 && slopeAt(x, z) < 0.15, 32, [-2600, 1200]); const r = __go(p[0], p[1], { hour: 13, w: 'clear', yaw: 0.8, pitch: 0.08 }); return ['dunes', r]; });
  // swamp
  __views.push(() => { const S = WORLD.data.settlements.find((q) => q.id === 'swamp'); const p = __find((x, z) => biomeAt(x, z) === 8 && terrainAt(x, z) > waterAt(x, z) + 0.2, 32, [S.x + 120, S.z]); const r = __go(p[0], p[1], { hour: 7.5, w: 'mist', yaw: 1.5, pitch: 0.05 }); return ['swamp', r]; });
  return __views.length;
})()
