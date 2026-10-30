(() => {
  // the scanned shopkeepers at their counters, and the night hunter coming for you
  const v = [];
  const look = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
  const near = (x, z) => SHOP_SPOTS.map((s) => [s, Math.hypot(s.kx - x, s.kz - z)]).sort((a, b) => a[1] - b[1]);
  const visit = (s, hour) => {
    const fx = Math.sin(s.ry), fz = Math.cos(s.ry), x = s.kx + fx * 2.6, z = s.kz + fz * 2.6;
    const r = __go(x, z, { hour, w: 'clear', yaw: look(x, z, s.kx, s.kz), pitch: 0.04, dist: 1.2 });
    player.pos.y = s.y; player.root.position.copy(player.pos); keeperT = 0; updateKeepers(0.016); updateKeepers(0.5);
    const k = KEEPERS.find((q) => q.spot === s);
    return [s.kind, k ? k.body.kind : 'none', r];
  };
  let spots = null;
  v.push(() => {
    const s0 = WORLD.data.spawn; const town = SETTLEMENTS.find((S) => S.kind === 'city') || SETTLEMENTS[0];
    __go(town.src.x, town.src.z, { hour: 11, w: 'clear' });
    spots = near(town.src.x, town.src.z).slice(0, 6).map((q) => q[0]);
    for (const k of KEEPERS) { k.spot = null; k.body.root.visible = false; }
    const s = spots[0]; const x = s.kx + Math.sin(s.ry) * 2.6, z = s.kz + Math.cos(s.ry) * 2.6;
    const r = __go(x, z, { hour: 11, w: 'clear', yaw: look(x, z, s.kx, s.kz), pitch: 0.04, dist: 1.2 });
    keeperT = 0; updateKeepers(0.016);
    return ['keepers', KEEPERS.map((k) => k.body.kind + (k.spot ? '@' + k.spot.kind : '')), r, s0.x | 0];
  });
  v.push(() => { const k = KEEPERS.find((q) => q.body.kind === 'casual' && q.spot); if (!k) return ['no casual keeper']; return visit(k.spot, 11); });
  v.push(() => { const k = KEEPERS.find((q) => q.body.kind === 'blonde' && q.spot); if (!k) return ['no blonde keeper', KEEPERS.map((q) => q.body.kind + (q.spot ? '@' + q.spot.kind : ''))]; return visit(k.spot, 15); });
  v.push(() => {
    const z = ZOMBIES.find((q) => q.body.kind === 'hunter'); if (!z) return ['no hunter', ZOMBIES.map((q) => q.body.kind)];
    const s = WORLD.data.spawn, p = __find((x, zz) => classAt(x, zz) === 0 && slopeAt(x, zz) < 0.05 && forestAt(x, zz) < 0.1 && terrainAt(x, zz) > waterAt(x, zz) + 2, 32, [s.x + 300, s.z]);
    __go(p[0], p[1], { hour: 18.4, w: 'clear', yaw: 0, pitch: 0.06, dist: 3.4 });
    const x = p[0] + 0.6, zz = p[1] + 7;
    Object.assign(z, { active: true, state: 'chase', x, y: groundAt(x, zz, terrainAt(x, zz) + 1), z: zz, type: 'brute', hp: 260, scale: 1.16, flash: 0, deadT: 0, cd: 0, wT: 0, stuck: 0, sx: x, sz: zz, side: 0, sideT: 0, yaw: Math.PI, lunge: 0 });
    z.root.visible = true; z.root.rotation.set(0, z.yaw, 0); z.body.inner.scale.setScalar(CHARS.hunter.scale * z.scale);
    for (const a of Object.values(z.acts)) { a.stop(); a.enabled = true; }
    z.main = z.acts.Walk; z.main.play(); z.main.setEffectiveWeight(1); z.main.timeScale = 0.48;
    player.health = 1e9; return ['hunter', z.x | 0, z.z | 0];
  });
  v.push(() => { const z = ZOMBIES.find((q) => q.body.kind === 'hunter'); return ['hunter closer', z && Math.round(Math.hypot(z.x - player.pos.x, z.z - player.pos.z) * 10) / 10, z && z.state]; });
  window.__views = v; window.__vi = 0;
  return v.length;
})()
