(() => {
  const toward = (x, z, cx, cz) => Math.atan2(cx - x, cz - z);
  __views.push(() => { const S = WORLD.data.settlements.find((q) => q.id === 'mountain'); const o = S.buildings[3]; const x = o.x + 7, z = o.z + 7; const r = __go(x, z, { hour: 10, w: 'clear', yaw: toward(x, z, o.x, o.z), pitch: 0.02, dist: 3 }); return ['chalet', r]; });
  __views.push(() => { const S = WORLD.data.settlements.find((q) => q.id === 'base'); const o = S.buildings[0]; const x = o.x + o.hx + 5, z = o.z + 3; const r = __go(x, z, { hour: 15, w: 'clear', yaw: toward(x, z, o.x, o.z), pitch: 0.02, dist: 3 }); return ['military', r]; });
  __views.push(() => { const p = WORLD.data.poi.find((q) => q.kind === 'castle'); const x = p.x + 30, z = p.z + 30; const r = __go(x, z, { hour: 16.5, w: 'clear', yaw: toward(x, z, p.x, p.z), pitch: 0.1, dist: 4 }); return ['castle', r]; });
  __views.push(() => { const S = WORLD.data.settlements.find((q) => q.id === 'fisher'); const o = S.buildings[1]; const x = o.x + 6, z = o.z - 6; const r = __go(x, z, { hour: 9, w: 'fair', yaw: toward(x, z, o.x, o.z), pitch: 0.02, dist: 3 }); return ['fisher', r]; });
  return __views.length;
})()
