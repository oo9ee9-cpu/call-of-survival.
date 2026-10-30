(() => {
  const toward = (x, z, cx, cz) => Math.atan2(cx - x, cz - z);
  __views.push(() => { const S = WORLD.data.settlements.find((q) => q.id === 'farm'); const o = S.buildings[2]; const x = o.x + o.hx + 9, z = o.z + o.hz + 9; const r = __go(x, z, { hour: 9.5, w: 'clear', yaw: toward(x, z, o.x, o.z), pitch: 0.06, dist: 3.5 }); return ['farmhouse', r, o.kind, o.style]; });
  __views.push(() => { const r = __go(-717, -3230, { hour: 13, w: 'clear', yaw: Math.PI + 0.4, pitch: 0.12 }); return ['city', r]; });
  __views.push(() => { const S = WORLD.data.settlements.find((q) => q.id === 'city'); const o = S.buildings.find((b) => b.kind === 'house' || b.kind === 'apartment') || S.buildings[5]; const r = __go(o.x, o.z, { hour: 12, w: 'clear', yaw: 0.3, pitch: 0.05, dist: 2.2 }); return ['interior', r, o.kind]; });
  return __views.length;
})()
