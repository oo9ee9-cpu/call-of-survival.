(() => {
  // close-ups: the nearest cow, sheep and a parked car
  const nearestAnimal = (kinds) => { let best = null, bd = 1e12; for (const a of ANIMALS) { if (!kinds.includes(a.kind) || !a.active || !a.root) continue; const d = (a.x - player.pos.x) ** 2 + (a.z - player.pos.z) ** 2; if (d < bd) { bd = d; best = a; } } return best; };
  __views.push(() => { const S = WORLD.data.settlements.find((q) => q.id === 'farm'); const r = __go(S.x + 60, S.z + 40, { hour: 10, w: 'clear' }); for (let i = 0; i < 14; i++) updateAnimals(2.6, T + i); for (let i = 0; i < 10; i++) updateAnimals(0.1, T + 40 + i * 0.1); return ['farm', r, ANIMALS.filter((a) => a.active).map((a) => a.kind).join(',')]; });
  __views.push(() => { const a = nearestAnimal(['cow']) || nearestAnimal(['horse']); if (!a) return 'no cow'; const x = a.x + 4, z = a.z + 4; const r = __go(x, z, { hour: 10, w: 'clear', yaw: Math.atan2(a.x - x, a.z - z), pitch: 0.02, dist: 2.5 }); return ['cow', a.kind, r]; });
  __views.push(() => { const a = nearestAnimal(['sheep', 'goat', 'deer', 'boar']); if (!a) return 'no sheep'; const x = a.x + 3, z = a.z + 3; const r = __go(x, z, { hour: 10, w: 'clear', yaw: Math.atan2(a.x - x, a.z - z), pitch: 0.02, dist: 2.5 }); return ['sheep', a.kind, r]; });
  __views.push(() => { const v = VEHICLES.find((q) => ['sedan', 'taxi', 'suv', 'pickup', 'van'].includes(q.kind)); if (!v) return 'no car ' + VEHICLES.map((q) => q.kind).join(','); const x = v.pos.x + 5, z = v.pos.z + 4; const r = __go(x, z, { hour: 11, w: 'clear', yaw: Math.atan2(v.pos.x - x, v.pos.z - z), pitch: 0.05, dist: 2.5 }); return ['car', v.kind, r]; });
  return __views.length;
})()
