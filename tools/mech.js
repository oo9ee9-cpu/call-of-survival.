(() => {
  // mechanics checks: run each step and report what changed
  const out = {};
  const step = (name, fn) => { try { out[name] = fn(); } catch (e) { out[name] = 'ERR ' + (e && e.stack || e).toString().slice(0, 300); } };
  begin(true);
  // 1. chop a tree: stand next to the nearest tree, face it, hit until it falls
  step('tree', () => {
    const p0 = __find((x, z) => biomeAt(x, z) === 3 && forestAt(x, z) > 0.7, 64, [-900, -2600]);
    __go(p0[0], p0[1], { hour: 12, w: 'clear' });
    let t = null; treesNear(player.pos.x, player.pos.z, 30, (q) => { if (!q.bush) { t = q; return false; } });
    if (!t) return 'no tree';
    const a = Math.atan2(t.x - player.pos.x, t.z - player.pos.z), r = VEG.species[t.id].variants[t.v].trunkR * t.s;
    player.pos.set(t.x - Math.sin(a) * (r + 0.9), t.y, t.z - Math.cos(a) * (r + 0.9)); player.yaw = a;
    equip('axe_stone'); const w0 = invCount('wood');
    for (let k = 0; k < 20 && !isFelled(t); k++) harvestHit('axe');
    return { felled: isFelled(t), wood: invCount('wood') - w0, logs: LOGS.length, sp: t.id };
  });
  // 2. dig with the shovel
  step('dig', () => {
    const p = player.pos, d0 = DIG.list.length; equip('shovel_stone'); player.yaw += Math.PI; const items0 = [...INV.items].length;
    for (let k = 0; k < 6; k++) { player.stamina = 100; groundWork('shovel'); }
    return { craters: DIG.list.length - d0, depth: -digOffset(p.x + Math.sin(player.yaw) * 1.25, p.z + Math.cos(player.yaw) * 1.25), kinds: [...INV.items].length - items0, stats: STATS.dug };
  });
  // 3. build a foundation and four walls and a door
  step('build', () => {
    for (const [id, n] of [['b_foundation_wood', 2], ['b_wall_wood', 3], ['b_wall_door_wood', 1], ['b_door_wood', 1], ['b_floor_wood', 1]]) invAdd(id, n, true);
    const p = __find((x, z) => biomeAt(x, z) === 6 && slopeAt(x, z) < 0.05 && classAt(x, z) === 0 && roadDist(x, z) > 20, 32, [-1800, -1500]);
    __go(p[0] + 0.2, p[1] + 0.2, { hour: 12 });
    const i = Math.floor(p[0] / 3) + 2, j = Math.floor(p[1] / 3);
    const res = [];
    const place = (id, ax, az, turn = 0) => { startPlace(id); BUILD.turn = turn; const it = ITEMS[id]; const plan = it.build ? planPiece(it, ax, terrainAt(ax, az), az) : null; BUILD.plan = plan; BUILD.ok = !plan.why; BUILD.why = plan.why; BUILD.x = plan.x; BUILD.y = plan.y; BUILD.z = plan.z; BUILD.ry = plan.ry; placeBuild(); res.push(id + ':' + (plan.why || 'ok')); };
    place('b_foundation_wood', cellC(i), cellC(j));
    place('b_wall_wood', cellC(i), cellC(j) - 1.4);
    place('b_wall_wood', cellC(i) + 1.4, cellC(j));
    place('b_wall_door_wood', cellC(i), cellC(j) + 1.4);
    place('b_door_wood', cellC(i), cellC(j) + 1.4);
    place('b_wall_wood', cellC(i) - 1.4, cellC(j));
    rebuildChunks();
    return { res, built: BUILT.length, slots: SLOTS.size, chunks: BCHUNKS.size };
  });
  // 4. craft: planks from wood, a workbench
  step('craft', () => { invAdd('wood', 30, true); const a = craftItem('plank'); invAdd('nails', 2, true); for (let k = 0; k < 3; k++) craftItem('plank'); return { plank: a, planks: invCount('plank'), wb: craftItem('f_workbench'), has: invCount('f_workbench') }; });
  // 5. a car: spawn the Ferrari, get in, drive
  step('car', () => {
    const v = spawnVehicle('sports', player.pos.x + 6, player.pos.z, 0); enterVehicle(v);
    for (let k = 0; k < 60; k++) { input.mz = 1; updateVehicles(0.05, T + k * 0.05); }
    input.mz = 0; const sp = v.speed; exitVehicle(true); return { speed: +sp.toFixed(1), model: !!v.root, wheels: v.wheels.length, gltf: !!(CAR_MODELS.ferrari) };
  });
  // 6. shop: buy a shirt and wear it
  step('shop', () => { const s = SHOP_SPOTS.find((q) => q.kind === 'clothes'); if (!s) return 'no clothes shop in range'; __go(s.x, s.z + 1, {}); openShop(s); INV.coins += 500; const ok = buyItem('top_shirt_red'); const w = wearItem('top_shirt_red'); closeCraft(); return { ok, w, coins: INV.coins, wearing: INV.wearing }; });
  // 7. save snapshot size
  step('save', () => ({ core: JSON.stringify(snapshotCore()).length, world: JSON.stringify(snapshotWorld(), stripRec).length }));
  // 8. eat, fish spot test
  step('eat', () => { player.health = 50; return { ate: useItem('bread'), hp: player.health }; });
  return out;
})()
