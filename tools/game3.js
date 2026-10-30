(() => {
  // in-game checks for the big batch: HUD bars, stances, the scope, the modelled AK and blades in hand, the plane, the free
  // fall and the parachute, a crate's loot list, the map, and the new landmarks (cathedral, fortress, street, warehouse)
  const errs = []; const oe = console.error; console.error = (...a) => { errs.push(String(a[0]).slice(0, 160)); oe.apply(console, a); };
  window.addEventListener('error', (e) => errs.push('ERR ' + String(e.message).slice(0, 200)));
  window.__errs = errs;
  const give = (id, n = 1) => { invAdd(id, n, true); };
  const st = () => ({ stance: player.stance, tool: player.tool, item: player.toolItem, drop: DROP.state, hp: Math.round(player.health), fd: Math.round(player.food || 0), wt: Math.round(player.water || 0), errs: errs.slice(-3) });
  const landAt = (kind) => LAND.list.find((L) => L.kind === kind);
  const v = __views;
  v.push(() => {
    const p = __find((x, z) => biomeAt(x, z) === 11 && slopeAt(x, z) < 0.05 && roadDist(x, z) > 25, 48, [0, 0]);
    const r = __go(p[0], p[1], { hour: 10, w: 'clear', yaw: 0.6, pitch: 0.18, dist: 3.4 });
    hud.classList.add('on'); player.food = 62; player.water = 38; player.health = 74; hudDirty = true;
    give('gun_akm'); give('ammo762', 90); give('mw_jian'); give('mw_battleaxe'); give('gun_p92'); give('ammo9', 30); give('att_4x');
    assignSlot(1, 'gun_akm'); assignSlot(2, 'mw_jian'); assignSlot(3, 'gun_p92'); assignSlot(4, 'mw_battleaxe');
    equip('gun_akm'); return ['hud+ak', r, st(), Object.keys(PROPS)];
  });
  v.push(() => { for (let i = 0; i < 20; i++) updatePlayer(0.05, T + i * 0.05); return ['ak-loaded', st(), PROPS.w_ak && !!PROPS.w_ak.mesh]; });
  v.push(() => { setStance('crouch'); for (let i = 0; i < 20; i++) updatePlayer(0.05, T + i * 0.05); return ['crouch', st()]; });
  v.push(() => { setStance('prone'); for (let i = 0; i < 30; i++) updatePlayer(0.05, T + i * 0.05); return ['prone', st()]; });
  v.push(() => { setStance('stand'); setLean(-1); for (let i = 0; i < 20; i++) updatePlayer(0.05, T + i * 0.05); return ['lean-left', st()]; });
  v.push(() => { setLean(-1); attachTo('gun_akm', 'att_4x'); setScope(true); for (let i = 0; i < 15; i++) { updatePlayer(0.05, T + i * 0.05); updateCamera(0.05, false); } return ['scope', st(), SCOPE.on]; });
  v.push(() => { setScope(false); equip('mw_jian'); for (let i = 0; i < 10; i++) updatePlayer(0.05, T + i * 0.05); cam.yaw = cam.tyaw = player.yaw + Math.PI * 0.6; return ['jian', st(), PROPS.m_jian && !!PROPS.m_jian.mesh]; });
  v.push(() => { equip('mw_battleaxe'); startSwing(); for (let i = 0; i < 8; i++) { updatePlayer(0.05, T + i * 0.05); updateWeapon(0.05, T); } return ['battleaxe-swing', st()]; });
  v.push(() => { equip('gun_p92'); for (let i = 0; i < 10; i++) updatePlayer(0.05, T + i * 0.05); return ['pistol', st(), PROPS.w_9mm && !!PROPS.w_9mm.mesh]; });
  v.push(() => {
    const items = [['gun_m416', 1], ['ammo556', 60], ['medkit', 1], ['bottle_water', 2], ['vest_l2', 1], ['att_reddot', 1], ['mw_ornate', 1]];
    const c = makeCrate(player.pos.x + 1.4, player.pos.z + 0.6, items, { name: 'صندوق «بشير»' }); SET.autoLoot = false; openCrate(c); return ['crate', st(), !!c];
  });
  v.push(() => { closeCrate(); toggleChart(true); return ['chart', st()]; });
  v.push(() => { toggleChart(false); boardPlane(); for (let i = 0; i < 30; i++) { updateDrop(0.05); updateCamera(0.05, false); } return ['plane', st(), DROP.path && Math.round(DROP.path.y)]; });
  v.push(() => { jumpOut(); for (let i = 0; i < 40; i++) { updateDrop(0.05); updateSkydive(0.05); updateCamera(0.05, false); } return ['freefall', st(), Math.round(player.pos.y - terrainAt(player.pos.x, player.pos.z))]; });
  v.push(() => { DROP.t = 4; openChute(); for (let i = 0; i < 30; i++) { updateDrop(0.05); updateSkydive(0.05); updateCamera(0.05, false); } return ['chute', st()]; });
  v.push(() => { let k = 0; while (DROP.state && k++ < 4000) { updateSkydive(0.05); } updateCamera(0.05, true); return ['landed', st(), k]; });
  const visit = (kind, o) => () => {
    const L = landAt(kind); if (!L) return [kind, 'none placed', LAND.list.map((q) => q.kind)];
    const a = (o.ang || 0) + L.rot, d = L.R * (o.dist || 0.55), x = L.x + Math.sin(a) * d, z = L.z + Math.cos(a) * d;
    const r = __go(x, z, { hour: o.hour || 15, w: 'clear', yaw: Math.atan2(L.x - x, L.z - z), pitch: o.pitch || 0.08, dist: 3.4 });
    for (let i = 0; i < 4; i++) updateLandforms(); LAND.lastX = 1e9; updateLandforms();
    return [kind, r, Math.round(L.x), Math.round(L.z), LAND.ready, zoneAt(x, z).name];
  };
  v.push(visit('cathedral', { dist: 0.62, pitch: 0.12 }));
  v.push(visit('fortress', { dist: 0.75, pitch: 0.2, hour: 16 }));
  v.push(visit('street', { dist: 0.0, pitch: 0.05 }));
  v.push(visit('warehouse', { dist: 0.08, pitch: 0.05, hour: 12 }));
  v.push(() => ['errors', errs.slice(0, 14), LAND.list.map((q) => q.kind + '@' + Math.round(q.x) + ',' + Math.round(q.z))]);
  return v.length;
})()
