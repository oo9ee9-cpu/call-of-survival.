(() => {
  const faceSun = (pitch) => { const s = ENV.sunDir; cam.yaw = cam.tyaw = Math.atan2(-s.x, -s.z); cam.pitch = cam.tpitch = pitch; updateCamera(0.016, true); };
  __views.push(() => { const p = __find((x, z) => biomeAt(x, z) === 3 && forestAt(x, z) > 0.8 && slopeAt(x, z) < 0.25, 48, [-900, -2600]); const r = __go(p[0], p[1], { hour: 16.3, w: 'clear' }); faceSun(-0.28); return ['forest', r]; });
  __views.push(() => { const p = __find((x, z) => classAt(x, z) === 1 && Math.abs(x + 2000) < 500 && Math.abs(z + 1300) < 500, 16, [-1930, -1380]); const r = __go(p[0], p[1], { hour: 11, w: 'storm', yaw: 0, camYaw: 0.5, pitch: 0.05 }); return ['farm-rain', r]; });
  __views.push(() => { const p = __find((x, z) => biomeAt(x, z) === 7 && classAt(x, z) === 5, 32, [-2100, 1700]); const r = __go(p[0], p[1], { hour: 17.2, w: 'clear', pitch: 0.05 }); return ['desert', r]; });
  __views.push(() => { const r = __go(1888 + 30, -1704 + 40, { hour: 20.6, w: 'storm', pitch: 0.1, camYaw: 0.4 }); WEATHER.snow = 1; return ['snow-night', r, tempAt(1888, -1704)]; });
  __views.push(() => { const r = __go(-717, -3211, { hour: 10, w: 'clear' }); openCraft('craft'); return ['bag', r]; });
  __views.push(() => { closeCraft(); const s = SHOP_SPOTS.find((q) => q.kind === 'clothes') || SHOP_SPOTS[0]; if (!s) return 'no shop'; const r = __go(s.x + Math.sin(s.ry) * 1.6, s.z + Math.cos(s.ry) * 1.6, { hour: 12, w: 'clear', yaw: s.ry + Math.PI }); openShop(s); return ['shop', s.kind, r]; });
  return __views.length;
})()
