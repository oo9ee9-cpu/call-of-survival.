(() => {
  // the water world: the harbour, the village on posts, the pirates' nest under fire, a warship's deck, a boat ride, the chart
  const s = WORLD.data.spawn, look = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
  const onDeck = (x, z, y) => { player.pos.set(x, groundAt(x, z, y + 1), z); player.root.position.copy(player.pos); cam.focus.set(player.pos.x, player.pos.y + 1.6, player.pos.z); updateCamera(0.016, true); };
  const v = [];
  v.push(() => { const r = __go(s.x, s.z, { hour: 10.5, w: 'clear', yaw: 2.6, pitch: 0.18, dist: 6 }); return ['harbour', r]; });
  v.push(() => {
    const S = SETTLEMENTS.find((q) => q.id === 'stilts'); const x = S.x + 2, z = S.z + 18;
    __go(x, z, { hour: 16.8, w: 'clear', yaw: look(x, z, S.x, S.z - 20), pitch: 0.1, dist: 5 }); onDeck(x, z, 2.5);
    return ['stilts', +player.pos.y.toFixed(2), onPlatform(player.pos.x, player.pos.z, player.pos.y), S.state];
  });
  v.push(() => {
    const x = 452, z = -888;
    __go(x, z, { hour: 12.5, w: 'fair', yaw: look(x, z, 520, -920), pitch: 0.12, dist: 4 }); onDeck(x, z, 2.5);
    player.bornAt = T + 999; player.health = 100;
    for (let k = 0; k < 60; k++) updateBots(0.05, T + k * 0.05);
    const g = BOTS.filter((b) => b.active && b.guard).map((b) => [b.state, +b.y.toFixed(1)]);
    return ['pirates', +player.pos.y.toFixed(2), GUARD_SPOTS.length, g];
  });
  v.push(() => {
    const sh = SHIPS.find((q) => q.war) || SHIPS[0]; if (!sh) return ['no ship'];
    const x = sh.x + (sh.hx > sh.hz ? 14 : 0), z = sh.z + (sh.hx > sh.hz ? 0 : 14);
    __go(x, z, { hour: 9.5, w: 'clear', yaw: look(x, z, sh.x, sh.z), pitch: 0.15, dist: 6 }); onDeck(x, z, sh.deckY + 1);
    return ['warship', +player.pos.y.toFixed(2), SHIPS.length];
  });
  v.push(() => {
    __go(s.x, s.z, { hour: 15, w: 'clear' });
    const boat = VEHICLES.filter((q) => q.spec.water).sort((a, b) => Math.hypot(a.pos.x - s.x, a.pos.z - s.z) - Math.hypot(b.pos.x - s.x, b.pos.z - s.z))[0];
    if (!boat) return ['no boat', VEHICLES.length];
    enterVehicle(boat); cam.yaw = cam.tyaw = boat.yaw + Math.PI; cam.pitch = cam.tpitch = 0.2; updateCamera(0.016, true);
    return ['boat', boat.kind, +boat.pos.x.toFixed(0), +boat.pos.z.toFixed(0)];
  });
  v.push(() => { if (player.vehicle) exitVehicle(true); toggleChart(true); return ['chart', SETTLEMENTS.length]; });
  window.__views = v; window.__vi = 0;
  return v.length;
})()
