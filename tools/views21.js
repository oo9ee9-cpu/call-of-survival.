(() => {
  const X = -1990, Z = -1150;
  __views.push(() => { __go(X + 9, Z + 6, { hour: 11, w: 'clear' }); const kinds = ['sedan', 'taxi', 'police', 'suv', 'van', 'ambulance']; kinds.forEach((k, i) => spawnVehicle(k, X - i * 0.2, Z - 12 + i * 6, 0.0, i % 2 ? 0x2a5aa8 : 0xb8202a)); __go(X + 9, Z + 4, { hour: 11, w: 'clear', yaw: -Math.PI / 2 - 0.5, pitch: 0.1, dist: 3 }); return ['lineup']; });
  __views.push(() => { __go(X + 5, Z - 6 + 5, { hour: 11, w: 'clear', yaw: -2.4, pitch: 0.06, dist: 2.4 }); return ['front34']; });
  __views.push(() => { __go(X - 5, Z - 12 - 4, { hour: 17.5, w: 'clear', yaw: 0.9, pitch: 0.06, dist: 2.4 }); return ['rear34']; });
  return __views.length;
})()
