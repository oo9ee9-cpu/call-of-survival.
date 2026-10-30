(() => {
  // the uploaded vegetation in place: a plane tree up close, a meadow of the new grass, a forest floor with ivy
  const W0 = WORLD.data, s = W0.spawn;
  const look = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
  const v = [];
  const findTree = (near) => {
    let best = null, bd = 1e12;
    for (let k = 0; k < 6 && !best; k++) {
      const p = __find((x, z) => { const b = biomeAt(x, z); return (b === 11 || b === 3 || b === 6) && classAt(x, z) === 0 && forestAt(x, z) > 0.25 && forestAt(x, z) < 0.6 && terrainAt(x, z) > 8; }, 64, near);
      if (!p) break; updateVegetation(0.016, p[0], p[1], true);
      for (const c of VCELLS.values()) for (const t of c.trees) if (t.id === 'plane') { const d = (t.x - p[0]) ** 2 + (t.z - p[1]) ** 2; if (d < bd) { bd = d; best = t; } }
      near = [near[0] + 600, near[1] + 400];
    }
    return best;
  };
  v.push(() => {
    const t = findTree([s.x + 300, s.z + 300]); if (!t) return ['no plane tree'];
    const x = t.x + 16, z = t.z + 12; const r = __go(x, z, { hour: 10.5, w: 'clear', yaw: look(x, z, t.x, t.z), pitch: 0.02, dist: 3 });
    player.root.visible = false; window.__tree = t;
    return ['plane', t.v, Math.round(t.x), Math.round(t.z), r];
  });
  v.push(() => {
    const t0 = window.__tree; let best = null, bd = 1e12;
    for (const c of VCELLS.values()) for (const t of c.trees) if (t.id === 'plane' && t !== t0 && t.v !== t0.v) { const d = (t.x - t0.x) ** 2 + (t.z - t0.z) ** 2; if (d < bd) { bd = d; best = t; } }
    if (!best) return ['no second'];
    const x = best.x - 14, z = best.z + 10; const r = __go(x, z, { hour: 16.8, w: 'clear', yaw: look(x, z, best.x, best.z), pitch: 0.05, dist: 3 });
    player.root.visible = false; return ['plane2', best.v, r];
  });
  v.push(() => {
    player.root.visible = true;
    const p = __find((x, z) => biomeAt(x, z) === 11 && forestAt(x, z) < 0.2 && moistAt(x, z) > 0.45 && classAt(x, z) === 0 && slopeAt(x, z) < 0.15, 48, [s.x - 400, s.z + 200]);
    const r = __go(p[0], p[1], { hour: 17.2, w: 'clear', yaw: 1.1, pitch: 0.06, dist: 3.2 }); return ['meadow', r];
  });
  v.push(() => {
    const p = __find((x, z) => forestAt(x, z) > 0.6 && biomeAt(x, z) === 3 && classAt(x, z) === 0 && slopeAt(x, z) < 0.2, 48, [s.x + 500, s.z - 300]);
    const r = __go(p[0], p[1], { hour: 13, w: 'clear', yaw: 0.6, pitch: 0.1, dist: 3.5 }); return ['forest floor', r];
  });
  window.__views = v; window.__vi = 0;
  return v.length;
})()
