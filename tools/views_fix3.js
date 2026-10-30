(() => {
  // after the fixes: the fortress's cliff without the ground leaning out of it, the warehouse without the painted squares,
  // the fire button while scoped, the parachute camera
  const freeCam = (px, py, pz, lx, ly, lz, fov = 55) => {
    $('lobby').style.display = 'none'; hud.classList.remove('on'); player.root.visible = false;
    camera.fov = fov; camera.updateProjectionMatrix(); camera.position.set(px, py, pz); camera.lookAt(lx, ly, lz); camera.updateMatrixWorld();
    TERRAIN.update(0.016, px, py, pz, true); TERRAIN.update(0.016, px, py + 0.01, pz, true); updateSettlements(0.016, lx, lz, true); updateVegetation(0.016, px, pz, true); updateGrass(0.016, px, pz, true); updateRocks(0.016, px, pz, true); updateRoadLod(0, true);
    LAND.lastX = 1e9; updateLandforms();
    placeSun(lx, ly, lz); ENVMAP.update(0, true); sky.position.copy(camera.position); sky.scale.setScalar(camera.far * 0.9); stars.position.copy(camera.position); stars.scale.setScalar(camera.far * 0.85);
    paused = true;
  };
  const back = () => { paused = false; hud.classList.add('on'); player.root.visible = true; camera.fov = 60; camera.updateProjectionMatrix(); };
  const env = (hour, w) => { ENV.hour = hour; setWeather(w, true); updateEnvironment(0, false); };
  const of = (k) => LAND.list.filter((L) => L.kind === k);
  const air = (kind, a, dk, up, o = {}) => () => {
    const L = of(kind)[o.i || 0]; if (!L) return [kind, 'none'];
    env(o.hour || 15, 'clear'); if (!started) begin(true);
    const d = L.R * dk, x = L.x + Math.sin(a + L.rot) * d, z = L.z + Math.cos(a + L.rot) * d, h = L.def.size[1] * L.s;
    freeCam(x, Math.max(terrainAt(x, z) + 4, L.y + h * up), z, L.x, L.y + h * (o.look ?? 0.35), L.z, o.fov || 55);
    return [kind + ' a' + Math.round(a * 57.3) + ' d' + dk];
  };
  const v = [];
  v.push(air('fortress', Math.PI * 1.3, 1.0, 0.6, { look: 0.5 }));
  v.push(air('fortress', Math.PI * 0.6, 1.3, 0.9));
  v.push(air('warehouse', 0.8, 1.6, 1.2, { look: 0.3 }));
  v.push(air('warehouse', 2.6, 1.2, 0.5, { look: 0.4 }));
  v.push(() => {
    back(); const L = of('warehouse')[0]; if (!L) return 'no warehouse';
    const r = __go(L.x, L.z, { hour: 12, w: 'clear', yaw: L.rot, pitch: 0.05, dist: 3.4 });
    return ['inside warehouse', r, Math.round(landTop(L.x, L.z, L.y + 1))];
  });
  v.push(() => {
    const p = __find((x, z) => biomeAt(x, z) === 11 && slopeAt(x, z) < 0.05 && roadDist(x, z) > 25 && forestAt(x, z) < 0.05, 48, [400, 300]);
    const r = __go(p[0], p[1], { hour: 10, w: 'clear', yaw: 0.6, pitch: 0.05, dist: 3.4 });
    invAdd('gun_akm', 1, true); invAdd('ammo762', 90, true); invAdd('att_4x', 1, true); assignSlot(1, 'gun_akm'); equip('gun_akm');
    for (let i = 0; i < 20; i++) updatePlayer(0.05, T + i * 0.05);
    attachTo('gun_akm', 'att_4x'); setScope(true); for (let i = 0; i < 15; i++) { updatePlayer(0.05, T + i * 0.05); updateCamera(0.05, false); }
    return ['scope', r, SCOPE.on];
  });
  v.push(() => {
    setScope(false); boardPlane(); for (let i = 0; i < 30; i++) { updateDrop(0.05); updateCamera(0.05, false); }
    jumpOut(); for (let i = 0; i < 60; i++) { updateDrop(0.05); updateSkydive(0.05); updateCamera(0.05, false); }
    DROP.t = 4; openChute(); for (let i = 0; i < 60; i++) { updateDrop(0.05); updateSkydive(0.05); updateCamera(0.05, false); }
    return ['chute', DROP.state, Math.round(DROP.camD || 0), SCOPE.on, +SCOPE.k.toFixed(2)];
  });
  window.__views = v; window.__vi = 0;
  return v.length;
})()
