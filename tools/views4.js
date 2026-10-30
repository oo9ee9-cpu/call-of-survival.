(() => {
  const look = (tx, tz, pitch = 0.08) => { const p = player.pos; cam.yaw = cam.tyaw = Math.atan2(-(tx - p.x), -(tz - p.z)); cam.pitch = cam.tpitch = pitch; player.yaw = cam.yaw + Math.PI; };
  window.__hold = null; UPDATERS.push(() => { if (window.__hold) window.__hold(); });
  __views.push(() => { const r = __go(-1500 - 30, -400 + 25, { hour: 15, w: 'fair' }); TERR_U.uDebug.value = 1; window.__hold = () => look(-1500, -400, 0.06); return ['gas-debug', r]; });
  __views.push(() => { const p = __find((x, z) => biomeAt(x, z) === 3 && forestAt(x, z) > 0.8 && slopeAt(x, z) < 0.25, 48, [-900, -2600]); const r = __go(p[0], p[1], { hour: 16.3, w: 'fair' }); window.__hold = () => { cam.pitch = cam.tpitch = 0.25; }; return ['forest-debug', r]; });
  __views.push(() => { TERR_U.uDebug.value = 0; const S = SETTLEMENTS.find((s) => s.poi && s.poi.kind === 'castle'); const r = __go(-2700 + 10, 2500 + 50, { hour: 9.5, w: 'clear' }); window.__hold = () => look(-2700, 2500, -0.02); return ['castle', r, S.state, S.ctx ? [S.ctx.cols.length, S.ctx.meshes.length, S.ctx.ext.size] : null, terrainAt(-2700, 2500), terrainAt(-2690, 2550)]; });
  return __views.length;
})()
