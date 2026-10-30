(() => {
  const X = -1990, Z = -1150;
  __views.push(() => { __go(X + 6, Z + 2, { hour: 11, w: 'clear' }); spawnVehicle('sedan', X, Z, 0.3, 0x8a3a2e); spawnVehicle('suv', X - 4, Z + 8, -0.4, 0x2f6a4a); __go(X + 6, Z + 5, { hour: 11, w: 'clear', yaw: -2.2, pitch: 0.06, dist: 2.6 }); return ['cars']; });
  __views.push(() => { const S = WORLD.data.settlements.find((q) => q.id === 'farm'); __go(S.x + 60, S.z + 40, { hour: 16, w: 'cloudy' }); for (let i = 0; i < 14; i++) updateAnimals(2.6, T + i); for (let i = 0; i < 10; i++) updateAnimals(0.1, T + 40 + i * 0.1); let a = null; for (const q of ANIMALS) if (q.active && q.kind === 'cow') { a = q; break; } if (!a) return 'no cow'; __go(a.x + 6, a.z + 2, { hour: 16, w: 'cloudy', yaw: Math.atan2(-6, -2), pitch: 0.12, dist: 3 }); return ['cows-cloudy']; });
  return __views.length;
})()
