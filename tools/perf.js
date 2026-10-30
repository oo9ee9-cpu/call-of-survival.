(() => {
  // per-view draw-call census: wraps renderBufferDirect for one frame, groups by a readable category
  const cat = (o, m) => {
    if (o.userData && o.userData.cat) return o.userData.cat;
    let n = o.name || ''; if (!n && o.parent && o.parent.name) n = o.parent.name;
    if (o.isInstancedMesh) n = 'inst:' + (m.type || '') + (o.geometry.attributes.aAO ? ':leaf' : '');
    if (o.isSkinnedMesh) n = 'skinned';
    if (!n) n = (m.type || 'mat') + (m.customProgramCacheKey ? ':' + m.customProgramCacheKey() : '');
    return n;
  };
  window.__census = () => {
    const R = renderer, orig = R.renderBufferDirect, out = {}; let shadow = 0, main = 0, tris = 0;
    R.renderBufferDirect = function (camera, scene, geometry, material, object, group) {
      const isShadow = scene === null; if (isShadow) shadow++; else main++;
      const k = (isShadow ? 'S ' : '') + cat(object, material);
      const ic = object.isInstancedMesh ? object.count : (geometry.isInstancedBufferGeometry ? geometry.instanceCount : 1);
      const n = (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3 * (ic || 0);
      if (!isShadow) tris += n;
      const e = out[k] || (out[k] = [0, 0]); e[0]++; e[1] += n;
      return orig.apply(this, arguments);
    };
    R.shadowMap.needsUpdate = true;
    const t0 = performance.now(); simulate(0.016); const t1 = performance.now(); POST.render(0.016); const t2 = performance.now();
    R.renderBufferDirect = orig;
    const top = Object.entries(out).sort((a, b) => b[1][0] - a[1][0]).slice(0, 18).map(([k, v]) => k + ' ×' + v[0] + ' ' + Math.round(v[1] / 1000) + 'k');
    return { main, shadow, tris: Math.round(tris / 1000) + 'k', sim: +(t1 - t0).toFixed(1), rend: +(t2 - t1).toFixed(1), tier: QUALITY.tier, top };
  };
  const st = (sid, k, i) => { const S = WORLD.data.settlements.find((q) => q.id === sid); const s = S.streets[k % S.streets.length]; const p = s.pts[Math.min(i, s.pts.length - 1)], q = s.pts[Math.min(i + 1, s.pts.length - 1)]; return [p[0], p[1], Math.atan2(q[0] - p[0], q[1] - p[1])]; };
  __views.push(() => { __go(-717, -3230, { hour: 10, w: 'clear', yaw: Math.PI }); return 'city'; });
  __views.push(() => ['city', __census()]);
  __views.push(() => { const p = __find((x, z) => biomeAt(x, z) === 3 && forestAt(x, z) > 0.85 && slopeAt(x, z) < 0.2, 48, [-400, -1600]); __go(p[0], p[1], { hour: 13, w: 'clear', yaw: 2.0 }); return 'forest'; });
  __views.push(() => ['forest', __census()]);
  __views.push(() => { const [x, z, yaw] = st('farm', 0, 2); __go(x, z, { hour: 8.5, w: 'fair', yaw, camYaw: 0.4 }); return 'village'; });
  __views.push(() => ['village', __census()]);
  return __views.length;
})()
