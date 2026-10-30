(() => {
  // what each part of the ground's shader costs: the same view rendered with one part of the terrain shader cut at a time
  // (SwiftShader is a CPU rasteriser: its time follows fragment work much like a phone GPU does — the ratios matter)
  const gl = renderer.getContext(), px = new Uint8Array(4);
  const sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const timeIt = (fn, n = 3) => { fn(); sync(); fn(); sync(); let s = 0; for (let i = 0; i < n; i++) { const t0 = performance.now(); fn(); sync(); s += performance.now() - t0; } return +(s / n).toFixed(1); };
  const plain = () => { renderer.shadowMap.needsUpdate = true; renderer.setRenderTarget(null); renderer.render(scene, camera); };
  const base = TERRAIN_MAT.onBeforeCompile, baseKey = TERRAIN_MAT.customProgramCacheKey;
  const variant = (name, edit) => {
    TERRAIN_MAT.onBeforeCompile = (sh) => { base(sh); sh.fragmentShader = edit(sh.fragmentShader); };
    TERRAIN_MAT.customProgramCacheKey = () => baseKey() + '|' + name; TERRAIN_MAT.needsUpdate = true;
  };
  const restore = () => { TERRAIN_MAT.onBeforeCompile = base; TERRAIN_MAT.customProgramCacheKey = baseKey; TERRAIN_MAT.needsUpdate = true; };
  const terr = () => { const out = []; TERRAIN.group.traverse((o) => { if (o.isMesh) out.push(o); }); return out; };
  const rep = (a, b) => (s) => { if (!s.includes(a)) throw new Error('no ' + a.slice(0, 40)); return s.split(a).join(b); };
  const V = {
    noNormal: rep('vec3 tn = layerN(float(id.x), uvA, uvB, far) * hb.x + layerN(float(id.y), uvA, uvB, far) * hb.y;', 'vec3 tn = vec3(0.0, 0.0, 1.0);'),
    oneSample: rep('vec4 b = texture(uAlb, vec3(uvB, L)); a = mix(a, b, 0.35 + 0.5 * far);', ''),
    noTop3: rep('ivec3 id; vec3 wt; top3(w, id, wt);', 'ivec3 id = ivec3(0, 1, 2); vec3 wt = vec3(0.6, 0.3, 0.1);'),
    noThird: rep('a2 = wt.z > 0.02 ? layerA(float(id.z), uvA, uvB, far) : vec4(0.0);', 'a2 = vec4(0.0);'),
    noFlowers: rep('if (dist > 6.0 && (biome == 11.0 || biome == 6.0 || biome == 2.0)) {', 'if (false) {'),
  };
  window.__tcost = () => {
    const out = { full: timeIt(plain) };
    TERR_OPT.vk = !TERR_OPT.vk; TERRAIN_MAT.needsUpdate = true; out['vk_' + TERR_OPT.vk] = timeIt(plain); TERR_OPT.vk = !TERR_OPT.vk; TERRAIN_MAT.needsUpdate = true;
    TERR_OPT.far = !TERR_OPT.far; TERRAIN_MAT.needsUpdate = true; out['far_' + TERR_OPT.far] = timeIt(plain); TERR_OPT.far = !TERR_OPT.far; TERRAIN_MAT.needsUpdate = true;
    TERR_OPT.vk = TERR_OPT.far = false; TERRAIN_MAT.needsUpdate = true; out.old = timeIt(plain); TERR_OPT.vk = TERR_OPT.far = true; TERRAIN_MAT.needsUpdate = true;
    const ubers = [UBER, UBER_FLAT, UBER_OBJ, UBER_IN]; UBER_OPT.far = false; ubers.forEach((m) => { m.needsUpdate = true; }); out.uberOld = timeIt(plain); UBER_OPT.far = true; ubers.forEach((m) => { m.needsUpdate = true; }); out.uberNew = timeIt(plain);
    for (const [k, f] of Object.entries(V)) { try { variant(k, f); out[k] = timeIt(plain); } catch (e) { out[k] = 'ERR ' + e.message; } restore(); }
    const T0 = terr(); const was = T0.map((o) => o.receiveShadow); T0.forEach((o) => { o.receiveShadow = false; }); TERRAIN_MAT.needsUpdate = true; out.noShadowRecv = timeIt(plain); T0.forEach((o, i) => { o.receiveShadow = was[i]; }); TERRAIN_MAT.needsUpdate = true;
    const env = scene.environment; scene.environment = null; out.noEnvAll = timeIt(plain); scene.environment = env;
    out.noTerrain = (() => { T0.forEach((o) => { o.visible = false; }); const r = timeIt(plain); T0.forEach((o) => { o.visible = true; }); return r; })();
    out.res = [renderer.domElement.width, renderer.domElement.height]; out.chunks = T0.length;
    return out;
  };
  const v = [];
  v.push(() => { DYNRES.scale = 1; SET.dynres = false; renderer.setPixelRatio(1); POST.resize(); STRAIN.level = 0; setStrain(0); const s = WORLD.data.spawn, p = __find((x, z) => classAt(x, z) === 0 && slopeAt(x, z) < 0.05 && forestAt(x, z) < 0.1 && moistAt(x, z) > 0.45, 32, [s.x + 160, s.z + 90]); __go(p[0], p[1], { hour: 16, w: 'clear', yaw: 1.0 }); return 'meadow'; });
  v.push(() => ['meadow', __tcost()]);
  v.push(() => { const p = __find((x, z) => biomeAt(x, z) === 3 && forestAt(x, z) > 0.8 && slopeAt(x, z) < 0.2, 48, [-400, -1600]); __go(p[0], p[1], { hour: 13, w: 'clear', yaw: 2.0 }); return 'forest'; });
  v.push(() => ['forest', __tcost()]);
  v.push(() => { __go(-717, -3230, { hour: 10, w: 'clear', yaw: Math.PI }); return 'city'; });
  v.push(() => ['city', __tcost()]);
  window.__views = v; window.__vi = 0;
  return v.length;
})()
