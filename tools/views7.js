(() => {
  window.__hold = null; UPDATERS.push(() => { if (window.__hold) window.__hold(); });
  const spot = () => __find((x, z) => biomeAt(x, z) === 6 && classAt(x, z) === 0 && slopeAt(x, z) < 0.08, 32, [-1800, -1500]);
  __views.push(() => { const p = spot(); const r = __go(p[0], p[1], { hour: 11, w: 'clear', yaw: 0 }); invAdd('outfit_michelle', 1, true); wearItem('outfit_michelle'); window.__hold = () => { cam.yaw = cam.tyaw = player.yaw; cam.pitch = cam.tpitch = 0.05; cam.user = 2.6; }; return ['michelle-front', CHARS.michelle.flip]; });
  __views.push(() => { window.__hold = () => { cam.yaw = cam.tyaw = player.yaw + Math.PI * 0.5; cam.pitch = cam.tpitch = 0.05; cam.user = 2.6; input.mz = 1; }; return ['michelle-walk-side']; });
  return __views.length;
})()
