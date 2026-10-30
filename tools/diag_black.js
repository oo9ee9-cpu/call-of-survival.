(() => {
  const st = (sid, k, i) => { const S = WORLD.data.settlements.find((q) => q.id === sid); const s = S.streets[k % S.streets.length]; const p = s.pts[Math.min(i, s.pts.length - 1)], q = s.pts[Math.min(i + 1, s.pts.length - 1)]; return [p[0], p[1], Math.atan2(q[0] - p[0], q[1] - p[1])]; };
  const orig = POST.render;
  __views.push(() => { const [x, z, yaw] = st('city', 5, 1); const r = __go(x, z, { hour: 17.5, w: 'rain', yaw, camYaw: 0.2, pitch: 0.04 }); return ['city-rain post', r, camera.position.toArray().map((v) => +v.toFixed(2)), player.inside, ENV.sunVis, WEATHER.rain]; });
  __views.push(() => { POST.render = () => { renderer.setRenderTarget(null); renderer.render(scene, camera); }; return ['no post', camera.position.toArray().map((v) => +v.toFixed(2))]; });
  __views.push(() => { POST.render = orig; ENV.hour = 12; return ['noon rain', ENV.hour]; });
  __views.push(() => { ENV.hour = 17.5; setWeather('clear', true); WEATHER.rain = 0; WEATHER.wet = 0; Object.assign(WEATHER, W_STATES.clear); return ['17.5 clear']; });
  return __views.length;
})()
