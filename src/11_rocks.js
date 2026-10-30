/* ═════════ scanned nature (Poly Haven, CC0): boulders and mossy rocks you can break, cliff faces on the mountains, flat shore rocks,
   old stumps and dry branches on the forest floor, quiver trees in the desert ═════════ */
const SCAN = { ready: false, obj: {}, alb: null, nrm: null };
const SCAN_LAYERS_ROCK = new Set([0, 1, 2, 3, 4, 5]);
function scanMaterial(layer) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, side: layer === 7 || layer === 8 ? THREE.DoubleSide : THREE.FrontSide });
  m.customProgramCacheKey = () => 'scan4';
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTex = { value: SCAN.alb }; sh.uniforms.uTexN = { value: SCAN.nrm }; sh.uniforms.uLayer = { value: layer }; sh.uniforms.uWet = WET_U; sh.uniforms.uSnowK = SNOWK_U; sh.uniforms.uClimate = CLIMATE_U; sh.uniforms.uSnowC = SNOWC_U;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vUv2; varying vec3 vWN; varying vec3 vWP2;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvUv2 = uv;')
      .replace('#include <fog_vertex>', `#include <fog_vertex>
        #ifdef USE_INSTANCING
          vWN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal); vWP2 = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        #else
          vWN = normalize(mat3(modelMatrix) * objectNormal); vWP2 = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #endif`);
    sh.fragmentShader = 'precision highp sampler2DArray;\n' + sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2DArray uTex, uTexN; uniform float uLayer, uWet, uSnowK; varying vec2 vUv2; varying vec3 vWN; varying vec3 vWP2; float sTop;
        ${WINTER_GLSL}`)
      .replace('#include <map_fragment>', `
        vec4 tx = texture(uTex, vec3(vUv2, uLayer));
        ${layer === 7 || layer === 8 ? 'if (tx.a < 0.5) discard;' : ''}
        vec3 alb = pow(tx.rgb, vec3(2.2));
        #ifdef USE_INSTANCING_COLOR
          alb *= vColor;
        #endif
        // snow settles on the tops in the cold, rain darkens everything
        sTop = smoothstep(0.55, 0.85, normalize(vWN).y) * max(uSnowK * smoothstep(250.0, 330.0, vWP2.y + 60.0 * uSnowK), winterAt(vWP2.xz));
        alb = mix(alb, vec3(0.82, 0.85, 0.9), sTop);
        alb *= 1.0 - uWet * 0.35 * (1.0 - sTop);
        diffuseColor.rgb = alb;`)
      .replace('#include <color_fragment>', '')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(mix(0.92, 0.35, uWet), 0.7, sTop);')
      .replace('#include <normal_fragment_maps>', `{
          vec3 mapN = texture(uTexN, vec3(vUv2, uLayer)).xyz * 2.0 - 1.0; mapN.xy *= 1.2 * (1.0 - sTop * 0.8);
          vec3 q0 = dFdx(-vViewPosition), q1 = dFdy(-vViewPosition); vec2 st0 = dFdx(vUv2), st1 = dFdy(vUv2);
          vec3 N = normal, q1p = cross(q1, N), q0p = cross(N, q0);
          vec3 T = q1p * st0.x + q0p * st1.x, B = q1p * st0.y + q0p * st1.y;
          float det = max(dot(T, T), dot(B, B)); float sc = det == 0.0 ? 0.0 : inversesqrt(det);
          normal = normalize(T * (mapN.x * sc) + B * (mapN.y * sc) + N * mapN.z);
        }`);
  };
  ENV_MATS.push(m);
  return m;
}
const SNOWK_U = { value: 1 };
function scanGeo(p) {
  const g = new THREE.BufferGeometry(), n = p.n;
  g.setAttribute('position', new THREE.BufferAttribute(deq(p.pos, n, 3), 3));
  const nb = b64Bytes(p.nrm), ni = new Int8Array(nb.buffer, nb.byteOffset, nb.length), nr = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) nr[i] = ni[i] / 127;
  g.setAttribute('normal', new THREE.BufferAttribute(nr, 3));
  // texture arrays keep the image's top row at v = 0: flip v
  const uv = deq(p.uv, n, 2); for (let i = 1; i < uv.length; i += 2) uv[i] = 1 - uv[i];
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const ib = b64Bytes(p.idx.data); g.setIndex(new THREE.BufferAttribute(p.idx.u32 ? new Uint32Array(ib.buffer, ib.byteOffset, ib.length / 4) : new Uint16Array(ib.buffer, ib.byteOffset, ib.length / 2), 1));
  g.computeBoundingSphere();
  return g;
}
async function loadScans() {
  const [J, a, n] = await Promise.all([fetchJSON('assets/props/scans.json'), loadImage('assets/props/scans_albedo.webp'), loadImage('assets/props/scans_normal.jpg')]);
  const L = J.layers.length;
  SCAN.alb = stripToArray(a, L); SCAN.nrm = stripToArray(n, L);
  for (const [k, o] of Object.entries(J.objects)) SCAN.obj[k] = { layer: o.layer, size: o.size, lod0: scanGeo(o.lod0), lod1: scanGeo(o.lod1), mat: null };
  for (const o of Object.values(SCAN.obj)) o.mat = scanMaterial(o.layer);
  SCAN.ready = true;
}
/* ── placement rules per 64 m cell ── */
const ROCK_KINDS = {
  boulder: ['boulder_a', 'boulder_b', 'boulder_f', 'rock01', 'rock02', 'rock05'], mossy: ['mossy07', 'mossy10', 'boulder_a', 'boulder_b'],
  cliff: ['cliff0', 'cliff1', 'cliff2'], flat: ['flat'], stump: ['log'], branches: ['branches'], quiver: ['quiver'],
};
const RCELLS = new Map(), RBROKEN = new Map();
function genRockCell(ci, cj) {
  const r = RNG(Math.floor(hash(ci * 11 + 3, cj * 17 - 5) * 2147483647) || 1), out = [];
  const x0 = ci * VCELL, z0 = cj * VCELL;
  const put = (kind, x, z, size, opts = {}) => {
    const names = ROCK_KINDS[kind], name = names[Math.floor(r() * names.length)], o = SCAN.obj[name]; if (!o) return;
    const base = Math.max(o.size[0], o.size[2]), s = size / base, h = terrainAt(x, z);
    const tilt = opts.tilt || 0, ry = r() * TAU;
    const sink = kind === 'flat' ? 0.25 * s * o.size[1] : kind === 'cliff' ? 0.15 * s * o.size[1] : kind === 'stump' || kind === 'branches' ? 0.02 : 0.22 * s * o.size[1];
    const rk = { name, kind, x, z, y: h - sink, s, ry, tilt, r: size * 0.5, h: s * o.size[1], tint: 0.85 + r() * 0.3, ore: opts.ore || null };
    if (kind === 'boulder' || kind === 'mossy') { rk.hp = Math.max(2, Math.round(size * 3)); rk.maxHp = rk.hp; }
    out.push(rk);
  };
  for (let k = 0; k < 26; k++) {
    const x = x0 + r() * VCELL, z = z0 + r() * VCELL;
    if (!inPlay(x, z)) continue;
    const b = biomeAt(x, z), c = classAt(x, z), h = terrainAt(x, z), wl = waterAt(x, z), sl = slopeAt(x, z), fd = forestAt(x, z);
    if (c === 7 || c === 2 || c === 1 || c === 8 || c === 9 || b === 0 || h < wl - 0.3) continue;
    if (LAND_ON && landTop(x, z) > h - 2) continue;      // under a scanned landform
    const q = r();
    if (sl > 0.75 && (b === 5 || b === 10 || b === 4 || h > 140)) { if (q < 0.25) put('cliff', x, z, 8 + r() * 14); continue; }
    if (b === 1 || c === 3) { if (q < 0.06) put('flat', x, z, 3 + r() * 4); else if (q < 0.12) put('boulder', x, z, 0.6 + r() * 1.6); continue; }
    if (b === 10) { if (q < 0.18) put('boulder', x, z, 1 + r() * 3.5); else if (q < 0.24) put('flat', x, z, 4 + r() * 5); continue; }
    if (b === 7) { if (q < 0.035) put('quiver', x, z, 1.6 + r() * 1.6); else if (q < 0.09) put('boulder', x, z, 0.8 + r() * 2.4); continue; }
    if (b === 5 || h > 260) { const ore = Math.hypot(x - MINE.x, z - MINE.z) < 500 || h > 220 ? (r() < 0.22 ? (r() < 0.6 ? 'iron_ore' : r() < 0.7 ? 'copper_ore' : 'gold_ore') : null) : null; if (q < 0.3) put('boulder', x, z, 0.8 + r() * 3.4, { ore }); continue; }
    if (fd > 0.4) {
      if (q < 0.14) put('branches', x, z, 1.4 + r() * 1.8);
      else if (q < 0.19) put('stump', x, z, 1.1 + r() * 1.2);
      else if (q < 0.27) put('mossy', x, z, 0.7 + r() * 2.2);
      continue;
    }
    if (sl > 0.4) { if (q < 0.12) put('boulder', x, z, 0.8 + r() * 2.5); continue; }
    if (b === 8 && q < 0.05) put('stump', x, z, 1 + r());
    else if (q < 0.025) put('boulder', x, z, 0.5 + r() * 1.6);
  }
  out.forEach((t, k) => { t.key = 'r' + ci + ',' + cj + ',' + k; });
  if (ED_HOOK.rocks) return { ci, cj, rocks: ED_HOOK.rocks(ci, cj, out), colliders: null };
  return { ci, cj, rocks: out, colliders: null };
}
const rockGone = (t) => { const r = RBROKEN.get(t.key); if (r === undefined) return false; if (r <= T_GAME) { RBROKEN.delete(t.key); t.hp = t.maxHp; return false; } return true; };
/* ── instanced draws per object and level ── */
const RDRAW = new Map();
function rdraw(name, lod) {
  const key = name + lod; let d = RDRAW.get(key); if (d) return d;
  const o = SCAN.obj[name], cap = lod ? 700 : 260;
  const m = new THREE.InstancedMesh(lod ? o.lod1 : o.lod0, o.mat, cap); m.count = 0; m.frustumCulled = false;
  m.castShadow = QUALITY.shadows && (lod === 0 || o.layer >= 3 && o.layer <= 5); m.receiveShadow = true;
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3).setUsage(THREE.DynamicDrawUsage);
  scene.add(m); d = { m, n: 0, cap }; RDRAW.set(key, d); return d;
}
const ORE_TINT = { iron_ore: [1.15, 0.86, 0.72], copper_ore: [0.78, 1.05, 0.9], gold_ore: [1.2, 1.08, 0.7] };
let rockT = 0, rockLX = 1e9, rockLZ = 1e9;
const _rm = new THREE.Matrix4(), _rq2 = new THREE.Quaternion(), _re = new THREE.Euler(), _rp = new THREE.Vector3(), _rs = new THREE.Vector3(), _rc = new THREE.Color();
function updateRocks(dt, cx, cz, force) {
  if (!SCAN.ready) return;
  rockT -= dt;
  const moved = Math.hypot(cx - rockLX, cz - rockLZ);
  if (!force && rockT > 0 && moved < 4) return;
  rockT = 0.3; rockLX = cx; rockLZ = cz;
  const R = qsel(260, 380, 520, 700), RC = qsel(500, 800, 1100, 1400), cr = Math.ceil(RC / VCELL), c0i = Math.floor(cx / VCELL), c0j = Math.floor(cz / VCELL);
  const t0 = nowMs();
  for (let j = -cr; j <= cr; j++) for (let i = -cr; i <= cr; i++) {
    if (Math.hypot(i, j) * VCELL > RC + VCELL) continue;
    const k = vkey(c0i + i, c0j + j);
    if (!RCELLS.has(k) && (force || nowMs() - t0 < 3)) RCELLS.set(k, genRockCell(c0i + i, c0j + j));
  }
  for (const [k, c] of RCELLS) if (Math.hypot((c.ci + 0.5) * VCELL - cx, (c.cj + 0.5) * VCELL - cz) > RC + 300) { if (c.colliders) for (const col of c.colliders) removeCollider(col); RCELLS.delete(k); }
  for (const d of RDRAW.values()) d.n = 0;
  const L0 = qsel(30, 45, 65, 90);
  for (const c of RCELLS.values()) {
    const ccx = (c.ci + 0.5) * VCELL - cx, ccz = (c.cj + 0.5) * VCELL - cz, cd = Math.hypot(ccx, ccz);
    const wantCol = cd < 90;
    if (wantCol && !c.colliders) { c.colliders = []; for (const t of c.rocks) { if (t.kind === 'branches' || (t.kind !== 'cliff' && t.r < 0.35)) continue; const col = addCollider({ t: 'c', x: t.x, z: t.z, r: t.kind === 'flat' ? t.r * 0.7 : t.r * 0.8, y1: t.y + t.h * 0.9 }); t.col = col; c.colliders.push(col); } }
    else if (!wantCol && c.colliders) { for (const col of c.colliders) removeCollider(col); c.colliders = null; for (const t of c.rocks) t.col = null; }
    if (cd > RC + 50) continue;
    for (const t of c.rocks) {
      if (rockGone(t)) { if (t.col) t.col.off = true; continue; } else if (t.col) t.col.off = false;
      const d = Math.hypot(t.x - cx, t.z - cz), far = t.kind === 'cliff' || t.kind === 'flat' ? RC : t.kind === 'branches' ? R * 0.25 : t.kind === 'stump' ? R * 0.5 : R * (0.5 + t.r * 0.2);
      if (d > far) continue;
      const dr = rdraw(t.name, d < L0 * (t.kind === 'cliff' ? 3 : 1) ? 0 : 1); if (dr.n >= dr.cap) continue;
      const shrink = t.hp !== undefined ? 0.55 + 0.45 * t.hp / t.maxHp : 1;
      _re.set(t.tilt, t.ry, 0, 'YXZ'); _rq2.setFromEuler(_re);
      _rm.compose(_rp.set(t.x, t.y, t.z), _rq2, _rs.setScalar(t.s * shrink));
      dr.m.setMatrixAt(dr.n, _rm);
      const ot = t.ore && ORE_TINT[t.ore]; if (ot) _rc.setRGB(ot[0] * t.tint, ot[1] * t.tint, ot[2] * t.tint); else _rc.setRGB(t.tint, t.tint, t.tint * 0.98);
      dr.m.setColorAt(dr.n, _rc); dr.n++;
    }
  }
  for (const d of RDRAW.values()) { d.m.count = d.n; d.m.visible = d.n > 0; if (d.n) { d.m.instanceMatrix.needsUpdate = true; d.m.instanceColor.needsUpdate = true; } }
}
function rocksNear(x, z, r, fn) {
  for (let i = Math.floor((x - r) / VCELL); i <= Math.floor((x + r) / VCELL); i++) for (let j = Math.floor((z - r) / VCELL); j <= Math.floor((z + r) / VCELL); j++) {
    const c = RCELLS.get(vkey(i, j)); if (!c) continue;
    for (const t of c.rocks) { if (t.kind === 'branches' || t.kind === 'flat' || t.kind === 'quiver' || rockGone(t)) continue; if ((t.x - x) ** 2 + (t.z - z) ** 2 < (r + t.r) * (r + t.r)) if (fn(t) === false) return; }
  }
}
