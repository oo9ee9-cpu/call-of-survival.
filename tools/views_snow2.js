(() => {
  // the snow fixes: blue ice on the frozen lake, snow-covered fields with faint furrows, conifers, no puddles in a blizzard
  const W0 = WORLD.data, lakes = W0.lakes || [];
  const look = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
  const v = [];
  const L = lakes.find((q) => q.frozen) || lakes[0];
  v.push(() => { const x = L.x + L.rx * 0.98, z0 = L.z; const r = __go(x + 30, z0, { hour: 15.2, w: 'clear', yaw: look(x + 30, z0, L.x, L.z), pitch: 0.2, dist: 6 }); return ['shore', r]; });
  v.push(() => { const x = L.x + L.rx * 0.55, z = L.z + L.rz * 0.2; const r = __go(x, z, { hour: 11.5, w: 'clear', yaw: look(x, z, L.x - L.rx, L.z), pitch: 0.12, dist: 5 }); return ['on ice', L.name, r, classAt(x, z)]; });
  v.push(() => {
    const t = W0.settlements.find((q) => q.kind === 'village') || W0.settlements[0];
    const r = __go(t.x + t.r * 0.9, t.z, { hour: 13, w: 'blizzard', yaw: look(t.x + t.r * 0.9, t.z, t.x, t.z), pitch: 0.1, dist: 4 }); return ['blizzard', t.name, r];
  });
  window.__views = v; window.__vi = 0;
  return v.length;
})()
