(() => {
  // what each part of the picture costs: the same view rendered with one thing switched off at a time (SwiftShader is a CPU
  // rasteriser, so its time follows fragment work much like a phone GPU does — the ratios are what matter)
  const gl = renderer.getContext(), px = new Uint8Array(4);
  const sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const timeIt = (fn, n = 3) => { fn(); sync(); fn(); sync(); let s = 0; for (let i = 0; i < n; i++) { const t0 = performance.now(); fn(); sync(); s += performance.now() - t0; } return +(s / n).toFixed(1); };
  const post = () => { renderer.shadowMap.needsUpdate = true; POST.render(0.016); };
  const plain = () => { renderer.shadowMap.needsUpdate = true; renderer.setRenderTarget(null); renderer.render(scene, camera); };
  const keyOf = (o) => (o.material && o.material.customProgramCacheKey ? String(o.material.customProgramCacheKey()) : '') + (o.isInstancedMesh ? ':inst' : '');
  const groups = () => {
    const g = { grass: [], leaves: [], trunks: [], imp: [], terrain: [], water: [], town: [], other: [] };
    scene.traverse((o) => {
      if (!o.isMesh && !o.isInstancedMesh) return;
      if (o === GRASS.mesh) g.grass.push(o);
      else if (typeof IMP !== 'undefined' && o === IMP.mesh) g.imp.push(o);
      else if (o.isInstancedMesh && o.material && o.material.alphaTest > 0) g.leaves.push(o);
      else if (o.isInstancedMesh) g.trunks.push(o);
      else if (o.parent && TERRAIN && TERRAIN.group && (o.parent === TERRAIN.group || o.parent.parent === TERRAIN.group)) g.terrain.push(o);
      else if (o === ocean || (LAKES.group && o.parent === LAKES.group)) g.water.push(o);
      else if (o.material === UBER || o.material === UBER_IN || o.material === GLASS_MAT) g.town.push(o);
      else g.other.push(o);
    });
    return g;
  };
  const without = (list, fn) => { const was = list.map((o) => o.visible); list.forEach((o) => { o.visible = false; }); const r = fn(); list.forEach((o, i) => { o.visible = was[i]; }); return r; };
  window.__cost = () => {
    const g = groups(), out = {};
    out.counts = Object.fromEntries(Object.entries(g).map(([k, v]) => [k, v.filter((o) => o.visible).length]));
    out.full = timeIt(post);
    out.noPost = timeIt(plain);
    out.noShafts = (() => { const s = STRAIN.shafts; STRAIN.shafts = false; const r = timeIt(post); STRAIN.shafts = s; return r; })();
    out.noShadows = (() => { const c = sun.castShadow; sun.castShadow = false; const r = timeIt(post); sun.castShadow = c; return r; })();
    for (const k of ['grass', 'leaves', 'trunks', 'imp', 'terrain', 'water', 'town', 'other']) out['no_' + k] = without(g[k], () => timeIt(post));
    out.res = [renderer.domElement.width, renderer.domElement.height, renderer.getPixelRatio()];
    return out;
  };
  const v = [];
  v.push(() => { DYNRES.scale = 1; SET.dynres = false; renderer.setPixelRatio(1); POST.resize(); const p = __find((x, z) => biomeAt(x, z) === 3 && forestAt(x, z) > 0.8 && slopeAt(x, z) < 0.2, 48, [-400, -1600]); __go(p[0], p[1], { hour: 13, w: 'clear', yaw: 2.0 }); return 'forest'; });
  v.push(() => ['forest', __cost()]);
  v.push(() => { __go(-717, -3230, { hour: 10, w: 'clear', yaw: Math.PI }); return 'city'; });
  v.push(() => ['city', __cost()]);
  v.push(() => { const s = WORLD.data.spawn, p = __find((x, z) => classAt(x, z) === 0 && slopeAt(x, z) < 0.05 && forestAt(x, z) < 0.1 && moistAt(x, z) > 0.45, 32, [s.x + 160, s.z + 90]); __go(p[0], p[1], { hour: 16, w: 'clear', yaw: 1.0 }); return 'meadow'; });
  v.push(() => ['meadow', __cost()]);
  window.__views = v; window.__vi = 0;
  return v.length;
})()
