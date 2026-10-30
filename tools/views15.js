(() => {
  const fieldOf = (kind, near) => __find((x, z) => (biomeAt(x, z) === 11 || biomeAt(x, z) === 6) && classAt(x, z) === 0 && forestAt(x, z) < 0.2 && moistAt(x, z) > 0.36 && flowerField(x, z) > 0.9 && flowerKind(x, z) === GL_[kind], 24, near);
  __views.push(() => { const p = fieldOf('poppy', [0, -1500]); if (!p) return 'no poppy'; const r = __go(p[0], p[1], { hour: 9.5, w: 'clear', yaw: 0.7, pitch: 0.06 }); return ['poppy', r]; });
  __views.push(() => { const p = fieldOf('lavender', [0, -1500]); if (!p) return 'no lavender'; const r = __go(p[0], p[1], { hour: 16.5, w: 'clear', yaw: 2.2, pitch: 0.06 }); return ['lavender', r]; });
  __views.push(() => { const p = fieldOf('daisy', [0, -1500]); if (!p) return 'no daisy'; const r = __go(p[0], p[1], { hour: 11, w: 'fair', yaw: 1.2, pitch: 0.1, dist: 4 }); return ['daisy', r]; });
  return __views.length;
})()
