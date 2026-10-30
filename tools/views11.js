(() => {
  const toward = (x, z, cx, cz) => Math.atan2(cx - x, cz - z);
  __views.push(() => { const S = WORLD.data.settlements.find((q) => q.id === 'mountain'); const x = S.x + 40, z = S.z + 55; const r = __go(x, z, { hour: 10.5, w: 'fair', yaw: toward(x, z, S.x, S.z), pitch: 0.1, dist: 5 }); return ['snow-village', r]; });
  __views.push(() => { const S = WORLD.data.settlements.find((q) => q.id === 'mountain'); const x = S.x - 10, z = S.z + 5; const r = __go(x, z, { hour: 15, w: 'fair', yaw: 1.2, pitch: 0.06 }); return ['snow-village-in', r]; });
  __views.push(() => { const S = WORLD.data.settlements.find((q) => q.id === 'mountain'); const x = S.x + 20, z = S.z - 30; const r = __go(x, z, { hour: 9, w: 'storm', yaw: toward(x, z, S.x, S.z), pitch: 0.05 }); WEATHER.snow = 1; return ['snow-storm', r]; });
  return __views.length;
})()
