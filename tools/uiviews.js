(() => {
  // pictures for the lobby: map cards and banners, rendered from the island itself
  window.__ui = {};
  const freeCam = (px, py, pz, lx, ly, lz, fov = 50) => {
    paused = true; $('pause').classList.add('gone'); hud.classList.remove('on'); player.root.visible = false;
    camera.fov = fov; camera.updateProjectionMatrix(); camera.position.set(px, py, pz); camera.lookAt(lx, ly, lz); camera.updateMatrixWorld();
    TERRAIN.update(0.016, px, py, pz, true);
    updateSettlements(0.016, px, pz, true); updateVegetation(0.016, px, pz, true); updateGrass(0.016, px, pz, true); updateRocks(0.016, px, pz, true); updateRoadLod(0, true);
    placeSun(lx, ly, lz); ENVMAP.update(0, true);
    sky.position.copy(camera.position); sky.scale.setScalar(camera.far * 0.9); stars.position.copy(camera.position); stars.scale.setScalar(camera.far * 0.85);
  };
  const live = () => { paused = false; player.root.visible = true; hud.classList.remove('on'); };
  __ui.map_island = () => { __go(-500, -2700, { hour: 9.6, w: 'clear' }); freeCam(-150, 420, -2150, -760, 0, -3260, 55); return { wait: 14 }; };
  __ui.map_snow = () => {
    const p = __find((x, z) => biomeAt(x, z) === 5 && terrainAt(x, z) > 300, 48, [1900, -1700]);
    const cx = p[0] + 260, cz = p[1] + 300, gy = terrainAt(cx, cz);
    __go(cx, cz, { hour: 10.8, w: 'clear' }); freeCam(cx, gy + 45, cz, p[0], terrainAt(p[0], p[1]) - 20, p[1], 55); return { wait: 14, p, h: terrainAt(p[0], p[1]) };
  };
  __ui.map_forest = () => {
    const p = __find((x, z) => biomeAt(x, z) === 3 && forestAt(x, z) > 0.75 && slopeAt(x, z) < 0.2, 64, [-900, -2600]);
    __go(p[0], p[1], { hour: 17.3, w: 'clear' });
    const a = Math.atan2(ENV.sunDir.x, ENV.sunDir.z), gy = terrainAt(p[0], p[1]);
    freeCam(p[0], gy + 1.7, p[1], p[0] + Math.sin(a) * 30, gy + 6, p[1] + Math.cos(a) * 30, 62); return { wait: 14, p };
  };
  __ui.map_desert = () => {
    const p = __find((x, z) => biomeAt(x, z) === 7 && slopeAt(x, z) < 0.15 && terrainAt(x, z) > 20, 48, [-2300, 2300]);
    const gy = terrainAt(p[0], p[1]);
    __go(p[0], p[1], { hour: 16.4, w: 'clear' }); freeCam(p[0], gy + 22, p[1], p[0] + 180, gy, p[1] + 120, 55); return { wait: 14, p };
  };
  __ui.map_water = () => { __go(-700, -3215, { hour: 18.1, w: 'clear' }); freeCam(-640, 16, -3470, -705, 3, -3225, 52); return { wait: 14 }; };
  __ui.map_mega = () => { __go(0, 300, { hour: 10, w: 'clear' }); freeCam(400, 1500, 3000, 0, 0, -400, 60); return { wait: 14 }; };
  __ui.ban_fight = () => {
    live();
    const p = __find((x, z) => biomeAt(x, z) === 6 && slopeAt(x, z) < 0.06 && roadDist(x, z) > 30, 48, [-1700, -1500]);
    __go(p[0], p[1], { hour: 17.7, w: 'clear', yaw: 0.6, pitch: 0.08, dist: 2.8 });
    invAdd('rifle', 1, true); invAdd('ammo556', 120, true); equip('rifle'); player.mag = 30;
    let k = 0;
    for (const z of ZOMBIES) {
      if (k >= 4) break; spawnZombie(); if (!z.active) continue;
      const d = 9 + k * 3.5, a = 0.6 + (k - 1.5) * 0.25; z.x = player.pos.x + Math.sin(a) * d; z.z = player.pos.z + Math.cos(a) * d; z.y = groundAt(z.x, z.z, terrainAt(z.x, z.z) + 1); z.state = 'chase'; k++;
    }
    input.aim = true; player.bornAt = T + 999; return { wait: 16, zombies: k };
  };
  __ui.ban_suit = () => {
    input.aim = false; paused = false; started = false; hud.classList.remove('on'); player.root.visible = true;
    for (const z of ZOMBIES) { z.active = false; z.root.visible = false; }
    enterLobby(true);
    if (!ACCOUNT.wardrobe.includes('suit_gold')) ACCOUNT.wardrobe.push('suit_gold');
    wearItem('suit_gold', true); LOBBY.zoom = 0.6; LOBBY.rot = -0.35; $('lobby').style.display = 'none';
    return { wait: 16 };
  };
  return Object.keys(__ui);
})()
