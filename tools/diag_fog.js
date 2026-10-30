(() => {
  const st = (sid, k, i) => { const S = WORLD.data.settlements.find((q) => q.id === sid); const s = S.streets[k % S.streets.length]; const p = s.pts[Math.min(i, s.pts.length - 1)], q = s.pts[Math.min(i + 1, s.pts.length - 1)]; return [p[0], p[1], Math.atan2(q[0] - p[0], q[1] - p[1])]; };
  const orig = POST.render;
  __views.push(() => { const [x, z, yaw] = st('mountain', 0, 1); const r = __go(x, z, { hour: 11.5, w: 'fair', yaw, camYaw: 0.3, pitch: 0.08 }); return ['snow-village', r]; });
  __views.push(() => { const S = SETTLEMENTS.find((q) => q.id === 'mountain'); return ['state', S.state, camera.position.toArray().map((v) => +v.toFixed(1)), player.pos.toArray().map((v) => +v.toFixed(1)), 'ter', +terrainAt(camera.position.x, camera.position.z).toFixed(1), 'W', JSON.stringify({ fog: WEATHER.fog, snow: WEATHER.snow, rain: WEATHER.rain, cloud: WEATHER.cloud }), 'fogP', FOG_U.fogP.value.toArray ? FOG_U.fogP.value.toArray() : FOG_U.fogP.value, 'inside', player.inside, camera.near, camera.far]; });
  __views.push(() => { POST.render = () => { renderer.setRenderTarget(null); renderer.render(scene, camera); }; return 'nopost'; });
  __views.push(() => { POST.render = orig; RAIN.mesh && (RAIN.mesh.visible = false); return 'norain'; });
  return __views.length;
})()
