(() => {
  window.__errs = []; addEventListener('error', (e) => window.__errs.push(String(e.message)));
  __go(-640, -3000, { hour: 20.2, w: 'clear' });
  ENV.nightMode = 'short'; player.bornAt = T - 30;
  // keep walking forward and turning; fire now and then
  keys.add('KeyW'); keys.add('ShiftLeft'); player.yaw = 0; cam.yaw = cam.tyaw = Math.PI;
  window.__stat = () => ({ errs: window.__errs.slice(0, 5), err: window.__err || null, z: ZOMBIES.filter((q) => q.active).length, bots: BOTS.filter((q) => q.active).length, traffic: TRAFFIC.length, animals: ANIMALS.filter((q) => q.active).length, veh: VEHICLES.length, pos: [player.pos.x | 0, player.pos.z | 0], hp: Math.round(player.health), alive: player.alive, hour: +ENV.hour.toFixed(2), calls: renderer.info.render.calls, built: SETTLEMENTS.filter((s) => s.state === 'near').map((s) => s.id) });
  return 'ok';
})()
