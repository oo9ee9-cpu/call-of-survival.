(() => {
  // the building scans in the world: why a kind was not placed (each test of placeLandforms counted), and close looks at
  // the cathedral and the warehouse from several sides
  const errs = []; const oe = console.error; console.error = (...a) => { errs.push(String(a[0]).slice(0, 160)); oe.apply(console, a); };
  window.addEventListener('error', (e) => errs.push('ERR ' + String(e.message).slice(0, 200)));
  const diag = (kind) => {
    const D = LAND.defs[kind]; if (!D) return kind + ': no def';
    const plan = LAND_PLAN[kind], F = D.F, s = 1, R = (Math.hypot(D.size[0], D.size[2]) * 0.5 + F.pad * F.cell * 0.85) * s;
    const o = { kind, R: Math.round(R), size: D.size.map((v) => Math.round(v)), grid: 0, base: 0, slope: 0, taken: 0, town: 0, wet: 0, road: 0, edge: 0, ok: 0, best: 1e9, lim: 0 };
    const byTown = (x, z, R) => SETTLEMENTS.some((S) => S.kind !== 'poi' && S.kind !== 'military' && Math.hypot(S.x - x, S.z - z) < S.r + R + 170) && !SETTLEMENTS.some((S) => Math.hypot(S.x - x, S.z - z) < S.r + R + 25);
    const farFromTowns = (x, z, R) => !SETTLEMENTS.some((S) => Math.hypot(S.x - x, S.z - z) < S.r + R + 140);
    const step = MAP_ID === 'mega' ? 220 : 120;
    o.lim = +((kind === 'crag' ? 0.1 : LAND_BYTOWN[kind] ? 0.03 : 0.08) * D.size[1] * s).toFixed(2);
    for (let z = -PLAY + 300; z < PLAY - 300; z += step) for (let x = -PLAY + 300; x < PLAY - 300; x += step) {
      o.grid++;
      const h = terrainAt(x, z), b = biomeAt(x, z), c = classAt(x, z);
      if (h < 6 || waterAt(x, z) > h - 3 || c === 2 || c === 7 || c === 8 || c === 9 || c === 10 || b === 0 || b === 12 || b === 13) { o.base++; continue; }
      const sl = slopeAt(x, z);
      if (kind === 'fortress' && (sl < 0.08 || sl > 0.7)) { o.slope++; continue; }
      if (LAND_BYTOWN[kind] && sl > (kind === 'warehouse' ? 0.09 : 0.07)) { o.slope++; continue; }
      if (LAND.list.some((t) => t.kind !== kind && Math.hypot(t.x - x, t.z - z) < Math.max(plan.gap, t.R + R + 80))) { o.taken++; continue; }
      if (LAND_BYTOWN[kind] ? !byTown(x, z, R) : !farFromTowns(x, z, R)) { o.town++; continue; }
      let wet = false, road = false;
      for (const f of [0, 0.5, 1]) for (let k = 0; k < (f ? 16 : 1) && !wet && !road; k++) {
        const a = k / 16 * TAU, px = x + Math.cos(a) * R * f, pz = z + Math.sin(a) * R * f;
        if (waterAt(px, pz) > terrainAt(px, pz) - 1) wet = true;
        if (roadDist(px, pz) < 26 || classAt(px, pz) === 2 || classAt(px, pz) === 7) road = true;
      }
      if (wet) { o.wet++; continue; } if (road) { o.road++; continue; }
      let best = 1e9;
      for (let k = 0; k < 36; k++) {
        const rot = k / 36 * TAU, cc = Math.cos(rot), sn = Math.sin(rot), diffs = [];
        for (const [ex, ez, eh] of F.edge) diffs.push(terrainAt(x + (ex * cc + ez * sn) * s, z + (-ex * sn + ez * cc) * s) - eh * s);
        diffs.sort((a, b) => a - b); const y = diffs[diffs.length >> 1]; let cost = 0; for (const d of diffs) cost += Math.abs(d - y);
        best = Math.min(best, cost / F.edge.length);
      }
      o.best = Math.min(o.best, +best.toFixed(2));
      if (best > o.lim) { o.edge++; continue; }
      o.ok++;
    }
    return o;
  };
  const landAt = (kind, i = 0) => LAND.list.filter((L) => L.kind === kind)[i];
  const look = (kind, ang, dist, o = {}) => () => {
    const L = landAt(kind, o.i || 0); if (!L) return [kind, 'none'];
    const a = ang + L.rot, x = L.x + Math.sin(a) * dist, z = L.z + Math.cos(a) * dist;
    const r = __go(x, z, { hour: o.hour || 15, w: 'clear', yaw: Math.atan2(L.x - x, L.z - z), pitch: o.pitch ?? 0.1, dist: o.cd || 3.4 });
    if (o.hide) player.root.visible = false;
    LAND.lastX = 1e9; updateLandforms();
    const lods = [0, 1, 2].map((k) => { const m = L.def['mesh' + k]; return m ? m.count : -1; });
    return [kind + '@' + Math.round(ang * 57.3) + '/' + Math.round(dist), r, 'R', Math.round(L.R), 'lods', lods, zoneAt(x, z).name, errs.slice(-2)];
  };
  const v = window.__views;
  v.push(() => ['diag', ['cathedral', 'street', 'warehouse', 'fortress'].map(diag), LAND.list.map((q) => q.kind + '@' + Math.round(q.x) + ',' + Math.round(q.z) + ' R' + Math.round(q.R))]);
  v.push(look('cathedral', 0, 60, { pitch: 0.06, hide: true }));
  v.push(look('cathedral', Math.PI * 0.5, 45, { pitch: 0.04, hide: true }));
  v.push(look('cathedral', Math.PI, 30, { pitch: 0.02, hide: true }));
  v.push(look('cathedral', Math.PI * 1.5, 120, { pitch: 0.12, hide: true }));
  v.push(look('cathedral', 0, 420, { pitch: 0.08, hide: true }));
  v.push(look('warehouse', 0, 40, { pitch: 0.05, hide: true }));
  v.push(look('warehouse', Math.PI * 0.75, 30, { pitch: 0.05, hide: true }));
  v.push(() => ['errors', errs.slice(0, 10)]);
  return v.length;
})()
