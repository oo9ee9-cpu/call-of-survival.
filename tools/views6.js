(() => {
  window.__hold = null; UPDATERS.push(() => { if (window.__hold) window.__hold(); });
  const front = (dist = 2.2, pitch = 0.05) => { window.__hold = () => { cam.yaw = cam.tyaw = player.yaw; cam.pitch = cam.tpitch = pitch; cam.user = dist; }; };
  const spot = () => __find((x, z) => biomeAt(x, z) === 6 && classAt(x, z) === 0 && slopeAt(x, z) < 0.08, 32, [-1800, -1500]);
  __views.push(() => { const p = spot(); const r = __go(p[0], p[1], { hour: 11, w: 'clear', yaw: 0 }); invAdd('outfit_michelle', 1, true); wearItem('outfit_michelle'); invAdd('top_hoodie_pink', 1, true); wearItem('top_hoodie_pink'); front(2.4); return ['michelle', CHARS.michelle.scale, CHARS.soldier.scale]; });
  __views.push(() => { delete INV.wearing.body; delete INV.wearing.top; applyOutfit(); front(2.4); return ['soldier-default', player.outfit.body]; });
  __views.push(() => { const p = __find((x, z) => biomeAt(x, z) === 3 && forestAt(x, z) > 0.85 && slopeAt(x, z) < 0.2, 48, [-900, -2600]); const r = __go(p[0], p[1], { hour: 9.2, w: 'mist' }); const s = ENV.sunDir; window.__hold = () => { cam.yaw = cam.tyaw = Math.atan2(-s.x, -s.z) + 1.4; cam.pitch = cam.tpitch = -0.05; }; return ['forest-beams', r, ENV.sunVis]; });
  return __views.length;
})()
