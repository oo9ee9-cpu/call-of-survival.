(() => {
  // the field jeep (UAZ-469): a row in five paints, the army one up close, driving at night with its lamps, the front wheels steering
  const W0 = WORLD.data, s = W0.spawn;
  const look = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
  const v = [];
  const flat = __find((x, z) => classAt(x, z) === 0 && slopeAt(x, z) < 0.04 && terrainAt(x, z) > waterAt(x, z) + 3 && forestAt(x, z) < 0.08 && roadDist(x, z) > 30, 24, [s.x + 160, s.z + 90]);
  const P = [0xd8702a, MIL_OLIVE, 0x1e3a6a, 0xe8e6e0, 0x8a3a2e];
  const J = [];
  v.push(() => {
    const [x0, z0] = flat;
    P.forEach((p, i) => J.push(spawnVehicle('jeep', x0 + (i - 2) * 3.6, z0, 0.55, p)));
    const r = __go(x0 - 1, z0 - 10, { hour: 10.5, w: 'clear', yaw: 0, pitch: 0.1, dist: 3.4 });
    return ['row', J.length, J.map((j) => j.wheels.length + (j.root.children[0] && j.root.children[0].name)), r];
  });
  v.push(() => {
    const j = J[1], x = j.pos.x + Math.cos(j.yaw) * 4.2 + Math.sin(j.yaw) * 1.2, z = j.pos.z - Math.sin(j.yaw) * 4.2 + Math.cos(j.yaw) * 1.2;
    const r = __go(x, z, { hour: 15.5, w: 'clear', yaw: look(x, z, j.pos.x, j.pos.z), pitch: 0.06, dist: 1.6 });
    player.root.visible = false; return ['army side', r];
  });
  v.push(() => {
    player.root.visible = true;
    const j = J[0]; __go(j.pos.x - 3, j.pos.z, { hour: 21.5, w: 'clear' }); nearVeh = j; enterVehicle(j); joy.y = 0.45; joy.x = 0;
    return ['night drive', player.vehicle === j];
  });
  v.push(() => { const j = J[0]; joy.y = 0.5; joy.x = -1; return ['steer', Math.round(j.speed * 3.6), j.wheels.map((w) => w.piv ? +w.piv.rotation.y.toFixed(2) : null)]; });
  v.push(() => {
    const j = J[0]; joy.y = 0; joy.x = 0; const st = j.wheels.map((w) => w.piv ? +w.piv.rotation.y.toFixed(2) : null);
    exitVehicle(true); j.settled = true;
    const x = j.pos.x + Math.sin(j.yaw) * 4.5 + Math.cos(j.yaw) * 2.2, z = j.pos.z + Math.cos(j.yaw) * 4.5 - Math.sin(j.yaw) * 2.2;
    const r = __go(x, z, { hour: 9.5, w: 'clear', yaw: look(x, z, j.pos.x, j.pos.z), pitch: 0.12, dist: 1.4 });
    player.root.visible = false; return ['front wheels', st, r];
  });
  window.__views = v; window.__vi = 0;
  return v.length;
})()
