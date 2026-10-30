/* ═════════ roads: 46 km of asphalt and dirt tracks laid on the ground, bridges over the rivers, power lines along the highways ═════════ */
const ROADS = [], RGRID = new SGrid(32);
const ROAD_KIND = { highway: 0, road: 1, track: 2, rail: 3 };
const ROAD_U = { uWet: WET_U, uAlb: TERR_U.uAlb, uDetail: { value: DETAIL }, uRain: TERR_U.uRain, uTime: TERR_U.uTime };
const ROAD_MAT = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
ROAD_MAT.customProgramCacheKey = () => 'road4';
ROAD_MAT.onBeforeCompile = (sh) => {
  Object.assign(sh.uniforms, ROAD_U);
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nattribute vec3 aRoad; varying vec3 vRoad; varying vec3 vRW;')
    .replace('#include <project_vertex>', `#include <project_vertex>
      vRoad = aRoad; vRW = (modelMatrix * vec4(transformed, 1.0)).xyz;
      // pull the ribbon slightly towards the camera so the coarse far terrain never swallows it
      gl_Position.z -= 0.0007 * gl_Position.w * clamp(length(mvPosition.xyz) / 60.0, 0.2, 6.0);`);
  sh.fragmentShader = 'precision highp sampler2DArray;\n' + sh.fragmentShader
    .replace('#include <common>', `#include <common>
      uniform sampler2DArray uAlb; uniform sampler2D uDetail; uniform float uWet, uRain, uTime; varying vec3 vRoad; varying vec3 vRW; float rRough;
      float rh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`)
    .replace('#include <map_fragment>', `
      float u = vRoad.x, v = vRoad.y, kind = vRoad.z, au = abs(u);
      vec4 dt = texture2D(uDetail, vRW.xz * 0.11), dt2 = texture2D(uDetail, vRW.xz * 0.023 + 0.3);
      vec3 gravel = pow(texture(uAlb, vec3(vRW.xz * 0.24, 9.0)).rgb, vec3(2.2)), soil = pow(texture(uAlb, vec3(vRW.xz * 0.24, 5.0)).rgb, vec3(2.2));
      vec3 col; float alpha = 1.0 - smoothstep(1.15, 1.6, au);
      rRough = 0.92;
      if (kind < 1.5) {
        // asphalt: dark, grainy, patched, worn grey in the wheel tracks
        float n = dt.b, patchy = smoothstep(0.62, 0.7, dt2.r);
        col = vec3(0.055, 0.056, 0.058) * (0.75 + n * 0.55);
        col = mix(col, vec3(0.03, 0.031, 0.033), patchy * 0.8);
        float wear = smoothstep(0.25, 0.0, abs(au - 0.5)) * 0.35; col *= 1.0 + wear;
        float crack = smoothstep(0.03, 0.0, abs(dt2.g - 0.5)) * step(0.55, dt.r); col = mix(col, vec3(0.018), crack * 0.7);
        // paint: highway has a dashed centre and solid edges, the smaller road a dashed centre only
        float centre = smoothstep(0.035, 0.02, au) * step(0.5, fract(v / 9.0));
        float edges = kind < 0.5 ? smoothstep(0.03, 0.015, abs(au - 0.9)) : 0.0;
        float paint = clamp(centre + edges, 0.0, 1.0) * (0.8 + 0.2 * dt.r) * (1.0 - step(0.82, dt.a) * 0.6);
        col = mix(col, kind < 0.5 ? vec3(0.62, 0.6, 0.55) : vec3(0.62, 0.5, 0.18), paint);
        rRough = mix(0.86, 0.6, paint);
        // gravel shoulders
        col = mix(col, gravel * 0.85, smoothstep(0.98, 1.08, au));
      } else if (kind > 2.5) {
        // the railway: grey ballast, dark sleepers every 0.65 m (the steel rails are real geometry on top)
        col = mix(gravel * vec3(0.78, 0.76, 0.74), vec3(0.16, 0.15, 0.14), dt.b * 0.35);
        float sl = step(0.62, fract(v / 0.65)) * (1.0 - smoothstep(0.62, 0.7, au));
        col = mix(col, vec3(0.085, 0.06, 0.045) * (0.8 + 0.4 * dt.r), sl);
        alpha = 1.0 - smoothstep(0.95, 1.4, au + (dt.r - 0.5) * 0.25);
      } else {
        // dirt track: two ruts, a grassy hump, puddles in the ruts after rain
        float rut = smoothstep(0.2, 0.0, abs(au - 0.55));
        col = mix(soil * 0.95, gravel * 0.9, dt.b * 0.6);
        col *= 1.0 - rut * 0.25;
        float hump = smoothstep(0.22, 0.05, au) * (0.6 + 0.4 * dt.g);
        col = mix(col, vec3(0.09, 0.12, 0.045), hump * 0.55);
        alpha = 1.0 - smoothstep(0.9, 1.5, au + (dt.r - 0.5) * 0.3);
      }
      float wetK = uWet * (kind < 1.5 ? 0.9 : 1.0);
      col *= 1.0 - wetK * 0.45;
      float puddle = uWet * smoothstep(0.55, 0.7, dt2.b) * (kind < 1.5 ? 0.6 : smoothstep(0.2, 0.0, abs(au - 0.55)) * 1.4);
      rRough = mix(rRough, 0.25, wetK); rRough = mix(rRough, 0.03, clamp(puddle * 1.6, 0.0, 1.0));
      diffuseColor.rgb = col; diffuseColor.a = alpha;`)
    .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = rRough;');
};
ENV_MATS.push(ROAD_MAT);
/* a ribbon over a run of points; every vertex sits on the ground, the pavement is flat across */
function ribbon(pts, w, kind, i0, i1) {
  const P = [], N = [], A = [], I = [];
  const across = kind >= 2 ? [-1.5, -1, -0.55, 0, 0.55, 1, 1.5] : [-1.6, -1.12, -1, -0.5, 0, 0.5, 1, 1.12, 1.6];
  const nA = across.length;
  let v = 0, rows = 0;
  for (let i = i0; i <= i1; i++) {
    const p = pts[i], pa = pts[Math.max(i0, i - 1)], pb = pts[Math.min(i1, i + 1)];
    let dx = pb[0] - pa[0], dz = pb[1] - pa[1]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    if (i > i0) v += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
    // two sub-steps per 4 m point so the ribbon hugs the 2 m terrain mesh
    const subs = i < i1 ? 2 : 1;
    for (let s = 0; s < subs; s++) {
      const t = s / subs, q = s ? [lerp(p[0], pb[0], t), lerp(p[1], pb[1], t)] : p, vv = v + (s ? Math.hypot(pb[0] - p[0], pb[1] - p[1]) * t : 0);
      for (const a of across) {
        const x = q[0] + dz * a * w, z = q[1] - dx * a * w;
        P.push(x, terrainAt(x, z) + (Math.abs(a) > 1.05 ? 0.03 : 0.06), z); N.push(0, 1, 0); A.push(a, vv, kind);
      }
      rows++;
    }
  }
  for (let r = 0; r < rows - 1; r++) for (let k = 0; k < nA - 1; k++) { const a = r * nA + k, b = a + 1, c = a + nA, d = c + 1; I.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('aRoad', new THREE.Float32BufferAttribute(A, 3));
  g.setIndex(I); g.computeVertexNormals(); g.computeBoundingSphere();
  const m = new THREE.Mesh(g, ROAD_MAT); m.receiveShadow = true; m.renderOrder = 1;
  return m;
}
/* bridges: a deck on piers with railings, walkable and drivable; over a gorge, a suspension bridge between two towers */
function bridge(b, pts, i0, i1, w, out, sus) {
  const keep = (o, kind) => { if (out) out[kind].push(o); return o; };
  const addDeck = (...a) => keep(addDeckRaw(...a), 'decks'), addCollider = (c) => keep(addColliderRaw(c), 'cols');
  const a = Math.max(0, i0 - 1), e = Math.min(pts.length - 1, i1 + 1), ya = pts[a][2], yb = pts[e][2];
  let total = 0; for (let k = a; k < e; k++) total += Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]);
  let run = 0;
  for (let k = a; k < e; k++) {
    const p = pts[k], q = pts[k + 1], L = Math.hypot(q[0] - p[0], q[1] - p[1]), y0 = lerp(ya, yb, run / total) + 0.35, y1 = lerp(ya, yb, (run + L) / total) + 0.35;
    const mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2, ry = Math.atan2(q[0] - p[0], q[1] - p[1]), my = (y0 + y1) / 2, pitch = -Math.atan2(y1 - y0, L);
    b.add(G.box, M(mx, my - 0.25, mz, ry, w * 2 + 1.2, 0.5, L + 0.05, pitch), 0x8a8478, K.stone);
    for (const s of [-1, 1]) {
      const ox = Math.cos(ry) * s * (w + 0.5), oz = -Math.sin(ry) * s * (w + 0.5);
      b.add(G.box, M(mx + ox, my + 0.45, mz + oz, ry, 0.08, 0.08, L + 0.05, pitch), 0x9aa0a6, K.metal);
      b.add(G.box, M(mx + ox, my + 0.2, mz + oz, ry, 0.06, 0.06, L + 0.05, pitch), 0x9aa0a6, K.metal);
      b.add(G.box, M(mx + ox, my + 0.25, mz + oz, ry, 0.08, 0.5, 0.08), 0x9aa0a6, K.metal);
      addCollider({ t: 'c', x: mx + ox, z: mz + oz, r: 0.12, y0: my - 1, y1: my + 0.9 });
    }
    // a pier every other span, down to the riverbed (a suspension bridge hangs instead)
    if (!sus && (k - a) % 2 === 1) { const g = terrainAt(mx, mz) - 1; if (my - g > 1.5) b.add(G.box, M(mx, (g + my) / 2, mz, ry, w * 1.6, my - g, 1.2), 0x7d776c, K.stone); }
    addDeck(p[0], p[1], y0, q[0], q[1], y1, w + 0.45);
    run += L;
  }
  if (sus) suspension(b, pts, a, e, w, ya, yb, addCollider);
}
function suspension(b, pts, a, e, w, ya, yb, addCollider) {
  const A = pts[a], E = pts[e], dx = E[0] - A[0], dz = E[1] - A[1], L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L, nx = uz, nz = -ux, ry = Math.atan2(dx, dz);
  const H = 16 + L * 0.05, sag = L * 0.09;
  const deckAt = (t) => lerp(ya, yb, t) + 0.35, topAt = (t) => lerp(ya, yb, t) + 0.35 + H - sag * 4 * t * (1 - t) * 1.0;
  for (const [t, end] of [[0.02, A], [0.98, E]]) for (const s of [-1, 1]) {
    const x = A[0] + dx * t + nx * s * (w + 1.2), z = A[1] + dz * t + nz * s * (w + 1.2), g = Math.min(terrainAt(x, z), deckAt(t) - 1) - 2, top = deckAt(t) + H;
    b.add(G.box, M(x, (g + top) / 2, z, ry, 1.1, top - g, 1.1), 0x8a3a2a, K.metal);
    addCollider({ t: 'c', x, z, r: 0.7 });
    if (s > 0) b.add(G.box, M(x - nx * (w + 1.2), top - 1, z - nz * (w + 1.2), ry + Math.PI / 2, (w + 1.2) * 2, 0.9, 0.9), 0x8a3a2a, K.metal);
  }
  const N = Math.max(8, Math.round(L / 4));
  for (const s of [-1, 1]) {
    let px = null;
    for (let k = 0; k <= N; k++) {
      const t = 0.02 + 0.96 * k / N, x = A[0] + dx * t + nx * s * (w + 1.2), z = A[1] + dz * t + nz * s * (w + 1.2), y = topAt(t) - (k === 0 || k === N ? 0 : 0);
      if (px) { const mx = (px[0] + x) / 2, my = (px[1] + y) / 2, mz = (px[2] + z) / 2, l = Math.hypot(x - px[0], y - px[1], z - px[2]), pitch = -Math.atan2(y - px[1], Math.hypot(x - px[0], z - px[2])); b.add(G.box, M(mx, my, mz, ry, 0.16, 0.16, l + 0.04, pitch), 0x5a5f64, K.metal); }
      const d0 = deckAt(t) + 0.4; if (y - d0 > 0.6) b.add(G.box, M(x, (y + d0) / 2, z, 0, 0.04, y - d0, 0.04), 0x6a6f74, K.metal);
      px = [x, y, z];
    }
  }
}
/* the railway: two steel rails on the ballast */
function railTrack(b, pts, i0, i1, inBridge) {
  for (let k = i0; k < i1; k++) {
    const p = pts[k], q = pts[k + 1], L = Math.hypot(q[0] - p[0], q[1] - p[1]); if (L < 0.01) continue;
    const ux = (q[0] - p[0]) / L, uz = (q[1] - p[1]) / L, ry = Math.atan2(q[0] - p[0], q[1] - p[1]), mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2;
    const onDeck = inBridge[k] && inBridge[k + 1], y0 = onDeck ? p[2] + 0.35 : terrainAt(p[0], p[1]) + 0.06, y1 = onDeck ? q[2] + 0.35 : terrainAt(q[0], q[1]) + 0.06, pitch = -Math.atan2(y1 - y0, L);
    for (const s of [-0.72, 0.72]) b.add(G.box, M(mx + uz * s, (y0 + y1) / 2 + 0.1, mz - ux * s, ry, 0.07, 0.13, L + 0.03, pitch), 0x6d6a66, K.metal);
  }
}
/* a tunnel where the line cuts deep into a ridge: concrete walls and a roof over the cut, portals at both ends, lamps inside */
function tunnel(b, pts, i0, i1, w, ta, tb, out) {
  const H = 6.2, W2 = w + 1.6;
  for (let k = i0; k < i1; k++) {
    const p = pts[k], q = pts[k + 1], L = Math.hypot(q[0] - p[0], q[1] - p[1]); if (L < 0.01) continue;
    const ry = Math.atan2(q[0] - p[0], q[1] - p[1]), ux = (q[0] - p[0]) / L, uz = (q[1] - p[1]) / L, mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2;
    const y = (terrainAt(p[0], p[1]) + terrainAt(q[0], q[1])) / 2;
    for (const s of [-1, 1]) {
      b.add(G.box, M(mx + uz * s * W2, y + H / 2, mz - ux * s * W2, ry, 0.6, H, L + 0.05), 0x8c8a84, K.stone);
      const c = addColliderRaw({ t: 'b', x: mx + uz * s * W2, z: mz - ux * s * W2, hx: Math.abs(uz) * 0.3 + Math.abs(ux) * L / 2 + 0.2, hz: Math.abs(ux) * 0.3 + Math.abs(uz) * L / 2 + 0.2, y0: y - 2, y1: y + H });
      out.cols.push(c);
    }
    b.add(G.box, M(mx, y + H + 0.4, mz, ry, W2 * 2 + 0.6, 0.8, L + 0.05), 0x7a7266, K.stone);
    if ((k - ta) % 6 === 0) { const lt = { x: mx, y: y + H - 0.5, z: mz, color: 0xffd9a0, range: 14, kind: 'lamp' }; LIGHT_ANCHORS.push(lt); out.lights.push(lt); b.box(mx, y + H - 0.15, mz, 0.5, 0.12, 0.5, 0xfff2d0, ry, K.glass); }
  }
  for (const [k, dir] of [[ta, -1], [tb, 1]]) {
    if (k < i0 || k > i1) continue;
    const p = pts[k], q = pts[Math.min(pts.length - 1, Math.max(0, k - dir))], L = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1, ry = Math.atan2(q[0] - p[0], q[1] - p[1]), y = terrainAt(p[0], p[1]);
    b.add(G.box, M(p[0], y + H + 1.6, p[1], ry, W2 * 2 + 3, 3.2, 1.2), 0x9a958c, K.stone);
    for (const s of [-1, 1]) b.add(G.box, M(p[0] + Math.cos(ry) * s * (W2 + 0.9), y + H / 2, p[1] - Math.sin(ry) * s * (W2 + 0.9), ry, 1.8, H + 0.4, 1.2), 0x9a958c, K.stone);
  }
}
/* power poles and sagging wires along the highways: the poles are worked out once, drawn with the stretch of road they stand by */
function polesOf(pts, w, side) {
  const out = []; let acc = 0, prev = null;
  for (let i = 1; i < pts.length; i++) {
    acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (acc < 42) continue; acc = 0;
    const p = pts[i], q = pts[Math.min(pts.length - 1, i + 1)];
    let dx = q[0] - p[0], dz = q[1] - p[1]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    const x = p[0] + dz * side * (w + 3.2), z = p[1] - dx * side * (w + 3.2), g = terrainAt(x, z);
    if (g < 0.5 || waterAt(x, z) > g) { prev = null; continue; }
    const pole = { i, x, z, g, ry: Math.atan2(dx, dz), prev };
    out.push(pole); prev = pole;
  }
  return out;
}
function powerLine(b, lines, poles, i0, i1, out) {
  const tips = (P) => [-1, 0, 1].map((k) => [P.x + Math.cos(P.ry) * k * 1.0, P.g + 8.75, P.z - Math.sin(P.ry) * k * 1.0]);
  for (const P of poles) {
    if (P.i < i0 || P.i >= i1) continue;
    b.add(G.cyl8, M(P.x, P.g + 4.5, P.z, 0, 0.13, 9, 0.13), 0x5a4632, K.wood);
    b.add(G.box, M(P.x, P.g + 8.6, P.z, P.ry + Math.PI / 2, 0.12, 0.12, 2.4), 0x5a4632, K.wood);
    out.cols.push(addColliderRaw({ t: 'c', x: P.x, z: P.z, r: 0.18 }));
    if (!P.prev) continue;
    const ta = tips(P.prev), tb = tips(P);
    for (let k = 0; k < 3; k++) {
      const A = ta[k], B = tb[k], segs = 8;
      for (let s = 0; s < segs; s++) {
        const t0 = s / segs, t1 = (s + 1) / segs, sag = (t) => -Math.sin(t * Math.PI) * 0.9;
        lines.push(lerp(A[0], B[0], t0), lerp(A[1], B[1], t0) + sag(t0), lerp(A[2], B[2], t0), lerp(A[0], B[0], t1), lerp(A[1], B[1], t1) + sag(t1), lerp(A[2], B[2], t1));
      }
    }
  }
}
function initRoads() {
  for (const r of WORLD.data.roads) {
    const kind = ROAD_KIND[r.kind] !== undefined ? ROAD_KIND[r.kind] : 1, w = r.w / 2, pts = r.pts;
    const R = { name: r.name, kind, w, pts, len: [], runs: [], bridges: r.bridges || [], sus: new Set((r.sus || []).map((q) => q[0])), tunnels: r.tunnels || [] };
    let L = 0; R.len.push(0); for (let i = 1; i < pts.length; i++) { L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); R.len.push(L); }
    R.total = L;
    const inBridge = new Uint8Array(pts.length); for (const [a, b] of R.bridges) for (let k = a; k <= b; k++) inBridge[k] = 1;
    R.bridge = inBridge;
    R.poles = kind === 0 ? polesOf(pts, w, 1) : [];
    // runs of ~240 m, built when you come near and folded away when you leave
    for (let i = 0; i < pts.length - 1; i += 60) {
      const j = Math.min(pts.length - 1, i + 60); let cx = 0, cz = 0;
      for (let k = i; k <= j; k++) { cx += pts[k][0]; cz += pts[k][1]; } cx /= j - i + 1; cz /= j - i + 1;
      let rad = 0; for (let k = i; k <= j; k++) rad = Math.max(rad, Math.hypot(pts[k][0] - cx, pts[k][1] - cz));
      R.runs.push({ i, j, cx, cz, rad: rad + w + 30, built: null });
    }
    for (let k = 0; k < pts.length - 1; k++) {
      const s = { r: R, k, x0: pts[k][0], z0: pts[k][1], x1: pts[k + 1][0], z1: pts[k + 1][1] };
      RGRID.insert(s, Math.min(s.x0, s.x1) - w - 2, Math.min(s.z0, s.z1) - w - 2, Math.max(s.x0, s.x1) + w + 2, Math.max(s.z0, s.z1) + w + 2);
    }
    ROADS.push(R);
  }
}
function buildRun(R, run) {
  const { i, j } = run, pts = R.pts, inB = R.bridge, out = { meshes: [], decks: [], cols: [], lights: [] };
  let a = i;
  while (a < j) {
    if (inB[a] && inB[a + 1]) { a++; continue; }
    let b = a; while (b < j && !(inB[b] && inB[b + 1])) b++;
    if (b > a) { const m = ribbon(pts, R.w, R.kind, a, b); scene.add(m); out.meshes.push(m); }
    a = b;
  }
  const bld = new Builder(), lines = [];
  for (const [ba, bb] of R.bridges) if (ba >= i && ba < j) bridge(bld, pts, ba, bb, R.w, out, R.sus.has(ba));
  if (R.poles.length) powerLine(bld, lines, R.poles, i, j, out);
  if (R.kind === 3) railTrack(bld, pts, i, j, inB);
  for (const [ta, tb] of R.tunnels) if (ta < j && tb > i) tunnel(bld, pts, Math.max(ta, i), Math.min(tb, j), R.w, ta, tb, out);
  if (!bld.empty) { const m = bld.mesh(UBER, QUALITY.shadows); scene.add(m); out.meshes.push(m); }
  if (lines.length) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
    const l = new THREE.LineSegments(g, WIRE_MAT); l.frustumCulled = true; g.computeBoundingSphere(); scene.add(l); out.meshes.push(l);
  }
  return out;
}
function dropRun(run) {
  const o = run.built; run.built = null; if (!o) return;
  for (const m of o.meshes) { scene.remove(m); m.geometry.dispose(); }
  for (const d of o.decks) removePlatform(d);
  for (const c of o.cols) removeCollider(c);
  for (const l of o.lights) { const k = LIGHT_ANCHORS.indexOf(l); if (k >= 0) LIGHT_ANCHORS.splice(k, 1); }
}
const WIRE_MAT = new THREE.LineBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.8 });
const addDeckRaw = (...a) => addDeck(...a), addColliderRaw = (c) => addCollider(c);
/* far road ribbons are dropped (fewer draws); out there the ground shader paints the roads as dark lines */
const ROAD_FAR = qsel(800, 1200, 2000, 3000);
let roadLodT = 0;
function updateRoadLod(dt, force) {
  if ((roadLodT -= dt) > 0 && !force) return; roadLodT = 0.4;
  const cp = camera.position, t0 = nowMs(), budget = force ? 1e9 : 5;
  // the player's own spot always has its roads (bridges carry you, tunnels hold you), then the nearest stretches first
  const fx = started ? player.pos.x : cp.x, fz = started ? player.pos.z : cp.z, want = [];
  for (const R of ROADS) for (const run of R.runs) {
    const d = Math.min(Math.hypot(run.cx - cp.x, run.cz - cp.z), Math.hypot(run.cx - fx, run.cz - fz)) - run.rad;
    if (run.built) { if (d > ROAD_FAR * 1.35) dropRun(run); }
    else if (d < ROAD_FAR) want.push([d, R, run]);
  }
  want.sort((a, b) => a[0] - b[0]);
  for (const [, R, run] of want) { if (nowMs() - t0 > budget) break; run.built = buildRun(R, run); }
}
/* distance from a point to the nearest road edge (negative on the road) and the segment */
function roadInfo(x, z) {
  const a = RGRID.at(x, z); if (!a) return null;
  let best = null, bd = 1e9;
  for (const s of a) {
    const dx = s.x1 - s.x0, dz = s.z1 - s.z0, L2 = dx * dx + dz * dz || 1, t = clamp(((x - s.x0) * dx + (z - s.z0) * dz) / L2, 0, 1);
    const d = Math.hypot(x - s.x0 - dx * t, z - s.z0 - dz * t) - s.r.w;
    if (d < bd) { bd = d; best = { d, s, t }; }
  }
  return best;
}
const roadDist = (x, z) => { const r = roadInfo(x, z); return r ? r.d : 99; };
