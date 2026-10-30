(() => {
  const toward = (x, z, cx, cz) => Math.atan2(cx - x, cz - z);
  __views.push(() => { const p = __find((x, z) => biomeAt(x, z) !== 12 && biomeAt(x, z) !== 0 && waterAt(x, z) > terrainAt(x, z) - 3 && waterAt(x, z) < terrainAt(x, z) && terrainAt(x, z) > 5, 32, [250, -880]); const lk = __find((x, z) => biomeAt(x, z) === 12, 16, p); const r = __go(p[0], p[1], { hour: 9.5, w: 'clear', yaw: toward(p[0], p[1], lk[0], lk[1]), pitch: 0.06 }); return ['lake', r]; });
  __views.push(() => { const X = -1990, Z = -1150; __go(X + 6, Z + 2, { hour: 11, w: 'clear' }); spawnVehicle('pickup', X, Z, 0.3, 0x8a3a2e); spawnVehicle('pickup', X - 4, Z + 8, -0.4, 0x2f6a4a); __go(X + 6, Z + 5, { hour: 11, w: 'clear', yaw: -2.2, pitch: 0.06, dist: 2.6 }); return ['pickups']; });
  return __views.length;
})()
