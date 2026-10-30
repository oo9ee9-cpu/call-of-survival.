(() => {
  // a sedan with yaw 0 (its +z is "forward" for the driving code) seen from its right side and from +z
  const X = -1990, Z = -1150;
  __views.push(() => { __go(X + 6, Z, { hour: 12, w: 'clear' }); const v = spawnVehicle('sedan', X, Z, 0, 0x2a5aa8); window.__v = v; __go(X + 6, Z, { hour: 12, w: 'clear', yaw: -Math.PI / 2, pitch: 0.05, dist: 2.2 }); return ['side', v.pos.toArray().map((q) => +q.toFixed(1))]; });
  __views.push(() => { __go(X, Z + 7, { hour: 12, w: 'clear', yaw: Math.PI, pitch: 0.05, dist: 2.2 }); return ['from +z']; });
  return __views.length;
})()
