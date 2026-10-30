(() => {
  // in-game checks for v5: a welcome sign, the HUD with name and level, bots with name tags
  __views.push(() => {
    const s = WELCOME.list.find((q) => q.name.includes('السنابل')) || WELCOME.list[0];
    const x = s.x + s.nx * 9 + s.nz * 1.5, z = s.z + s.nz * 9 - s.nx * 1.5;
    const r = __go(x, z, { hour: 10, w: 'clear', yaw: Math.atan2(s.x - x, s.z - z), pitch: 0.02, dist: 2.2 });
    return ['sign', s.name, r];
  });
  __views.push(() => {
    const p = __find((x, z) => biomeAt(x, z) === 6 && slopeAt(x, z) < 0.05 && roadDist(x, z) > 20, 48, [-1700, -1500]);
    const r = __go(p[0], p[1], { hour: 9.5, w: 'clear', yaw: 0.4, pitch: 0.1, dist: 3 });
    hud.classList.add('on');
    let k = 0;
    for (const b of BOTS) {
      if (k >= 3) break; spawnBot(); if (!b.active) continue;
      const a = 0.4 + (k - 1) * 0.35, d = 7 + k * 2.5; b.x = player.pos.x + Math.sin(a) * d; b.z = player.pos.z + Math.cos(a) * d; b.y = groundAt(b.x, b.z, terrainAt(b.x, b.z) + 1); b.state = 'rest'; b.restT = 60; b.yaw = a + Math.PI; k++;
    }
    for (let i = 0; i < 6; i++) updateBots(0.05, T + i * 0.05);
    return ['bots', r, BOTS.filter((b) => b.active).map((b) => b.name + ' ' + b.lv)];
  });
  return __views.length;
})()
