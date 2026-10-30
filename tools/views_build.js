(() => {
  // the building scans from the air and from their doorsteps: the fortress on its slope, the street, the cathedral, the warehouse
  const freeCam = (px, py, pz, lx, ly, lz, fov = 55) => {
    $('lobby').style.display = 'none'; hud.classList.remove('on'); player.root.visible = false;
    camera.fov = fov; camera.updateProjectionMatrix(); camera.position.set(px, py, pz); camera.lookAt(lx, ly, lz); camera.updateMatrixWorld();
    TERRAIN.update(0.016, px, py, pz, true); TERRAIN.update(0.016, px, py + 0.01, pz, true); updateSettlements(0.016, lx, lz, true); updateVegetation(0.016, px, pz, true); updateGrass(0.016, px, pz, true); updateRocks(0.016, px, pz, true); updateRoadLod(0, true);
    LAND.lastX = 1e9; updateLandforms();
    placeSun(lx, ly, lz); ENVMAP.update(0, true); sky.position.copy(camera.position); sky.scale.setScalar(camera.far * 0.9); stars.position.copy(camera.position); stars.scale.setScalar(camera.far * 0.85);
    paused = true;
  };
  const env = (hour, w) => { ENV.hour = hour; setWeather(w, true); updateEnvironment(0, false); };
  const of = (k) => LAND.list.filter((L) => L.kind === k);
  const air = (kind, a, dk, up, o = {}) => () => {
    const L = of(kind)[o.i || 0]; if (!L) return [kind, 'none'];
    env(o.hour || 15, 'clear'); if (!started) begin(true);
    const d = L.R * dk, x = L.x + Math.sin(a + L.rot) * d, z = L.z + Math.cos(a + L.rot) * d, h = L.def.size[1] * L.s;
    freeCam(x, Math.max(terrainAt(x, z) + 4, L.y + h * up), z, L.x, L.y + h * (o.look ?? 0.35), L.z, o.fov || 55);
    return [kind + ' a' + Math.round(a * 57.3) + ' d' + dk, Math.round(L.x), Math.round(L.z), Math.round(L.y), +(L.s).toFixed(2), Math.round(terrainAt(x, z))];
  };
  const v = [];
  v.push(air('fortress', 0, 1.6, 1.4));
  v.push(air('fortress', Math.PI * 0.6, 1.3, 0.9));
  v.push(air('fortress', Math.PI * 1.3, 1.0, 0.6, { look: 0.5 }));
  v.push(air('street', 0.4, 1.3, 2.2, { look: 0.1 }));
  v.push(air('street', Math.PI * 0.5, 0.9, 0.5, { look: 0.3 }));
  v.push(air('street', 0, 0.55, 0.25, { look: 0.25, fov: 62 }));
  v.push(air('cathedral', 2.2, 1.4, 1.6, { look: 0.3 }));
  v.push(air('warehouse', 0.8, 2.2, 2.0, { look: 0.3 }));
  window.__views = v; window.__vi = 0;
  return v.length;
})()
