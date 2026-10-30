/* ═════════ vegetation: real-photo trees in two levels of detail plus baked impostors, forests that differ by biome,
   grass, flowers and crops around you, rocks, felling and regrowth ═════════ */
const BARK_LAYERS = ['oak', 'ash', 'pine', 'birch', 'cedar', 'moss', 'olive', 'dead', 'palm', 'plane'];
const LEAF_LAYERS = ['oak', 'ash', 'aspen', 'pine', 'palm', 'plane', 'planetwig'];
const GROUND_LAYERS = ['grass', 'grass_tall', 'grass_dry', 'flowers', 'fern', 'reeds', 'wheat', 'barley', 'greens', 'tomato', 'cotton', 'sunflower', 'corn', 'shrub', 'tundra', 'beachgrass', 'poppy', 'lavender', 'daisy', 'buttercup', 'blades', 'blades2', 'tuft', 'ivy'];
const GL_ = Object.fromEntries(GROUND_LAYERS.map((n, i) => [n, i]));
const VEG = { ready: false, species: {}, list: [], barkTex: null, barkN: null, leafTex: null, groundTex: null, impostor: null };
const WIND = { value: 0.3 }, TIME_U = { value: 0 }, SUNDIR_U = { value: new THREE.Vector3(0, 1, 0) }, SUNCOL_U = { value: new THREE.Color(1, 1, 1) };
/* ── materials: bark and leaves sample texture arrays; leaves sway, glow when the sun is behind them ── */
function vegMaterial(kind, layer) {
  const leaf = kind === 'leaf';
  const m = new THREE.MeshStandardMaterial({ roughness: leaf ? 0.9 : 0.95, metalness: 0, side: leaf ? THREE.DoubleSide : THREE.FrontSide, alphaTest: leaf ? 0.5 : 0 });
  if (leaf) m.envMapIntensity = 0.55;
  m.customProgramCacheKey = () => 'veg5-' + kind;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTex = { value: leaf ? VEG.leafTex : VEG.barkTex }; sh.uniforms.uTexN = { value: VEG.barkN }; sh.uniforms.uLayer = { value: layer };
    sh.uniforms.uWind = WIND; sh.uniforms.uTime = TIME_U; sh.uniforms.uSunDir = SUNDIR_U; sh.uniforms.uSunCol = SUNCOL_U; sh.uniforms.uWet = WET_U; sh.uniforms.uClimate = CLIMATE_U; sh.uniforms.uSnowC = SNOWC_U;
    // bark photos are lit evenly; real trunks read darker and warmer (birch and palm stay pale)
    sh.uniforms.uTint = { value: leaf ? new THREE.Vector3(1, 1, 1) : BARK_LAYERS[layer] === 'birch' ? new THREE.Vector3(1.0, 1.0, 0.96) : BARK_LAYERS[layer] === 'palm' ? new THREE.Vector3(0.85, 0.8, 0.72) : new THREE.Vector3(0.62, 0.57, 0.5) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uWind, uTime; varying vec2 vUv2; varying vec3 vWp; varying float vWinter, vUpN;${leaf ? ' attribute float aAO; varying float vAO;' : ''}
        ${WINTER_GLSL}`)
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvUv2 = uv;' + (leaf ? ' vAO = aAO;' : ''))
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = instanceMatrix[3].xyz; float isc = length(instanceMatrix[0].xyz);
        #else
          vec3 ip = vec3(0.0); float isc = 1.0;
        #endif
        float hgt = max(position.y, 0.0);
        float ph = ip.x * 0.37 + ip.z * 0.23;
        float sway = (sin(uTime * 0.9 + ph) * 0.6 + sin(uTime * 2.1 + ph * 1.7) * 0.25) * uWind * 0.0026 * hgt * hgt / max(isc, 0.3);
        transformed.x += sway; transformed.z += sway * 0.6;
        ${leaf ? 'transformed += normal * sin(uTime * 7.0 + position.x * 3.0 + position.z * 2.0 + ph) * 0.03 * (0.3 + uWind) * min(hgt * 0.2, 1.0);' : ''}`)
      .replace('#include <fog_vertex>', `#include <fog_vertex>
        #ifdef USE_INSTANCING
          vWp = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz; vUpN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal).y;
          vWinter = winterAt((modelMatrix * vec4(ip, 1.0)).xz);
        #else
          vWp = (modelMatrix * vec4(transformed, 1.0)).xyz; vUpN = normalize(mat3(modelMatrix) * objectNormal).y; vWinter = 0.0;
        #endif`);
    sh.fragmentShader = 'precision highp sampler2DArray;\n' + sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2DArray uTex, uTexN; uniform float uLayer, uWet; uniform vec3 uSunDir, uSunCol, uTint; varying vec2 vUv2; varying vec3 vWp; varying float vWinter, vUpN;${leaf ? ' varying float vAO;' : ''}`)
      // leaf cards carry the crown's own normals: both faces of a card are lit the same, as one soft mass
      .replace('#include <normal_fragment_begin>', leaf ? 'float faceDirection = gl_FrontFacing ? 1.0 : -1.0; vec3 normal = normalize(vNormal); vec3 geometryNormal = normal;' : '#include <normal_fragment_begin>')
      .replace('#include <map_fragment>', leaf ? `
        vec4 tx = texture(uTex, vec3(vUv2, uLayer));
        vec2 dd = vUv2 * 512.0; float mip = max(0.0, 0.5 * log2(max(dot(dFdx(dd), dFdx(dd)), dot(dFdy(dd), dFdy(dd)))));
        diffuseColor.rgb *= pow(tx.rgb, vec3(2.2)) * vAO; diffuseColor.a = tx.a * (1.0 + mip * 0.28);
        diffuseColor.rgb *= 1.0 - uWet * 0.25;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.8, 0.83, 0.87) * (0.65 + 0.35 * vAO), vWinter * smoothstep(-0.05, 0.6, vUpN) * 0.85);` : `
        vec2 buv = vUv2 * vec2(1.0, 0.3);
        vec4 tx = texture(uTex, vec3(buv, uLayer));
        diffuseColor.rgb *= pow(tx.rgb, vec3(2.2)) * uTint * (1.0 - uWet * 0.3);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.82, 0.85, 0.9), vWinter * smoothstep(0.35, 0.8, vUpN) * 0.9);`)
      .replace('#include <alphatest_fragment>', leaf ? 'if (diffuseColor.a < 0.5) discard; diffuseColor.a = 1.0;' : '')   // solid coverage: the impostor bake's mips average cleanly
      // foliage is matt: a crown of cards must not mirror the sky at grazing angles
      .replace('#include <aomap_fragment>', leaf ? '#include <aomap_fragment>\nreflectedLight.indirectSpecular *= 0.3; reflectedLight.directSpecular *= 0.4;' : '#include <aomap_fragment>')
      .replace('#include <normal_fragment_maps>', leaf || QUALITY.tier === 0 ? '#include <normal_fragment_maps>' : `
        { // bark relief from the normal map, tangent frame from screen derivatives
          vec3 mapN = texture(uTexN, vec3(buv, uLayer)).xyz * 2.0 - 1.0; mapN.xy *= 1.4;
          vec3 q0 = dFdx(-vViewPosition), q1 = dFdy(-vViewPosition); vec2 st0 = dFdx(buv), st1 = dFdy(buv);
          vec3 N = normal, q1p = cross(q1, N), q0p = cross(N, q0);
          vec3 T = q1p * st0.x + q0p * st1.x, B = q1p * st0.y + q0p * st1.y;
          float det = max(dot(T, T), dot(B, B)); float sc = det == 0.0 ? 0.0 : inversesqrt(det);
          normal = normalize(T * (mapN.x * sc) + B * (mapN.y * sc) + N * mapN.z);
        }`)
      .replace('#include <emissivemap_fragment>', leaf ? `#include <emissivemap_fragment>
        { vec3 vd = normalize(vWp - cameraPosition); float back = pow(max(dot(vd, uSunDir), 0.0), 5.0);
          totalEmissiveRadiance += diffuseColor.rgb * uSunCol * back * 0.55 * vAO; }` : '#include <emissivemap_fragment>');
  };
  ENV_MATS.push(m);
  return m;
}
const _vmats = new Map();
const vmat = (kind, layer) => { const k = kind + layer; if (!_vmats.has(k)) _vmats.set(k, vegMaterial(kind, layer)); return _vmats.get(k); };
let LEAF_DEPTH = null;
/* ── decode quantised geometry from trees.json ── */
function deq(q, n, comps) {
  const s = b64Bytes(q.data), a = new Int16Array(s.buffer, s.byteOffset, s.length / 2), out = new Float32Array(n * comps);
  for (let i = 0; i < n * comps; i++) { const c = i % comps; out[i] = q.min[c] + (a[i] + 32767) / 65534 * (q.max[c] - q.min[c]); }
  return out;
}
function treeGeo(p, leaf) {
  const g = new THREE.BufferGeometry(), n = p.n;
  g.setAttribute('position', new THREE.BufferAttribute(deq(p.pos, n, 3), 3));
  const nb = b64Bytes(p.nrm), ni = new Int8Array(nb.buffer, nb.byteOffset, nb.length), nr = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) nr[i] = ni[i] / 127;
  g.setAttribute('normal', new THREE.BufferAttribute(nr, 3));
  if (leaf && !p.uv) {
    const uv = new Float32Array(n * 2), q = n / 4, idx = new Uint32Array(q * 6);
    // ez-tree's quad corners, with v flipped: our texture arrays keep the image's top row at v = 0
    for (let k = 0; k < q; k++) { uv.set([0, 0, 0, 1, 1, 1, 1, 0], k * 8); const i = k * 4; idx.set([i, i + 1, i + 2, i, i + 2, i + 3], k * 6); }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(new THREE.BufferAttribute(n < 65536 ? new Uint16Array(idx) : idx, 1));
  } else {
    g.setAttribute('uv', new THREE.BufferAttribute(deq(p.uv, n, 2), 2));
    const ib = b64Bytes(p.idx.data); g.setIndex(new THREE.BufferAttribute(p.idx.u32 ? new Uint32Array(ib.buffer, ib.byteOffset, ib.length / 4) : new Uint16Array(ib.buffer, ib.byteOffset, ib.length / 2), 1));
  }
  g.computeBoundingSphere();
  return g;
}
/* leaf cards shaded as one soft crown: normals lean out from the crown's middle (a little skywards),
   and the inside and underside of the crown sit in their own shade */
function crownShade(g) {
  const P = g.attributes.position, N = g.attributes.normal, n = P.count, ao = new Float32Array(n);
  g.computeBoundingBox(); const bb = g.boundingBox;
  const cx = (bb.min.x + bb.max.x) / 2, cy = (bb.min.y + bb.max.y) / 2, cz = (bb.min.z + bb.max.z) / 2;
  const rx = Math.max(0.3, (bb.max.x - bb.min.x) / 2), ry = Math.max(0.3, (bb.max.y - bb.min.y) / 2), rz = Math.max(0.3, (bb.max.z - bb.min.z) / 2);
  for (let i = 0; i < n; i++) {
    const dx = (P.getX(i) - cx) / rx, dy = (P.getY(i) - cy) / ry, dz = (P.getZ(i) - cz) / rz, len = Math.hypot(dx, dy, dz);
    let ox = dx / rx, oy = dy / ry, oz = dz / rz; const ol = Math.hypot(ox, oy, oz) || 1; ox /= ol; oy = oy / ol + 0.3; oz /= ol;
    let nx = N.getX(i), ny = N.getY(i), nz = N.getZ(i);
    if (nx * ox + ny * oy + nz * oz < 0) { nx = -nx; ny = -ny; nz = -nz; }
    const bx = nx * 0.3 + ox * 0.7, by = ny * 0.3 + oy * 0.7, bz = nz * 0.3 + oz * 0.7, bl = Math.hypot(bx, by, bz) || 1;
    N.setXYZ(i, bx / bl, by / bl, bz / bl);
    ao[i] = (0.4 + 0.6 * smooth(0.12, 1.0, len)) * (0.74 + 0.26 * smooth(-1.0, 0.7, dy));
  }
  N.needsUpdate = true;
  g.setAttribute('aAO', new THREE.BufferAttribute(ao, 1));
  return g;
}
/* ── procedural species: coconut palm and saguaro cactus ── */
function palmGeo(seed, lod) {
  const r = RNG(seed), tr = new THREE.BufferGeometry(), P = [], Nn = [], U = [], I = [];
  const H = 7 + r() * 3, lean = 0.12 + r() * 0.25, segs = lod ? 6 : 9, sides = lod ? 5 : 8;
  const spine = []; for (let k = 0; k <= segs; k++) { const t = k / segs; spine.push([Math.sin(t * 1.4) * lean * H * 0.35, t * H, 0]); }
  for (let k = 0; k <= segs; k++) {
    const [cx, cy, cz] = spine[k], rad = 0.24 * (1 - k / segs * 0.35);
    for (let s = 0; s <= sides; s++) { const a = s / sides * TAU; P.push(cx + Math.cos(a) * rad, cy, cz + Math.sin(a) * rad); Nn.push(Math.cos(a), 0, Math.sin(a)); U.push(s / sides * 2, cy * 0.9); }
  }
  for (let k = 0; k < segs; k++) for (let s = 0; s < sides; s++) { const a = k * (sides + 1) + s, b = a + sides + 1; I.push(a, b, a + 1, a + 1, b, b + 1); }
  tr.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); tr.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3)); tr.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); tr.setIndex(I);
  // fronds: bent strips of quads carrying the frond texture
  const lf = new THREE.BufferGeometry(), LP = [], LN = [], LU = [], LI = []; const top = spine[segs], n = lod ? 9 : 14;
  for (let f = 0; f < n; f++) {
    const yaw = f / n * TAU + r() * 0.3, droop = 0.25 + r() * 0.5, L = 3.6 + r() * 1.4, steps = lod ? 3 : 6, W = 1.25;
    const dx = Math.cos(yaw), dz = Math.sin(yaw), px = -dz, pz = dx;
    for (let k = 0; k <= steps; k++) {
      const t = k / steps, ang = 0.5 - t * (1.2 + droop * 1.6);
      const x = top[0] + dx * L * t, y = top[1] + Math.sin(ang) * L * t * 0.55 + 0.1, z = top[2] + dz * L * t;
      const w = W * Math.sin(Math.min(1, t * 1.1 + 0.08) * Math.PI) * 0.6 + 0.08;
      LP.push(x - px * w, y, z - pz * w, x + px * w, y, z + pz * w); LN.push(0, 1, 0, 0, 1, 0); LU.push(0, 1 - t, 1, 1 - t);
      if (k < steps) { const b = (LP.length / 3) - 2; LI.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
    }
  }
  lf.setAttribute('position', new THREE.Float32BufferAttribute(LP, 3)); lf.setAttribute('normal', new THREE.Float32BufferAttribute(LN, 3)); lf.setAttribute('uv', new THREE.Float32BufferAttribute(LU, 2)); lf.setIndex(LI);
  lf.computeVertexNormals(); crownShade(lf); tr.computeBoundingSphere(); lf.computeBoundingSphere();
  return { trunk: tr, leaves: lf, height: H + 1.2, trunkR: 0.24, crownR: 4.2 };
}
function cactusGeo(seed, lod) {
  const r = RNG(seed), b = new Builder(), green = 0x4f7a3a;
  const sides = lod ? 7 : 12, H = 3 + r() * 2.5;
  const ribbed = (len, rad) => { const g = new THREE.CylinderGeometry(rad * 0.85, rad, len, sides, lod ? 1 : 4); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)), k = 1 + 0.08 * Math.cos(a * sides); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } g.computeVertexNormals(); return g; };
  const trunk = ribbed(H, 0.32); b.add(trunk, M(0, H / 2, 0), green, MATID.plain); trunk.dispose();
  const top = new THREE.SphereGeometry(0.28, sides, 4, 0, TAU, 0, Math.PI / 2); b.add(top, M(0, H, 0), green, MATID.plain); top.dispose();
  const arms = 1 + Math.floor(r() * 3);
  for (let k = 0; k < arms; k++) {
    const a = r() * TAU, y = H * (0.35 + r() * 0.3), out = 0.65, up = 0.8 + r() * 1.2;
    const h1 = ribbed(out, 0.2); b.add(h1, M(Math.cos(a) * out / 2, y, Math.sin(a) * out / 2, -a, 1, 1, 1, 0, Math.PI / 2), green, MATID.plain); h1.dispose();
    const v = ribbed(up, 0.2); b.add(v, M(Math.cos(a) * out, y + up / 2, Math.sin(a) * out), green, MATID.plain); v.dispose();
  }
  return { geo: b.geometry(), height: H + 0.3, trunkR: 0.34, crownR: 1.2 };
}
/* ── species tables: what grows where ── */
const SP_INFO = {
  oak: { ar: 'شجرة بلّوط', wood: 4, hp: 7, s: [0.8, 1.2] }, oak_m: { ar: 'شجرة بلّوط', wood: 3, hp: 5, s: [0.8, 1.15] }, ash: { ar: 'شجرة دردار', wood: 4, hp: 7, s: [0.8, 1.2] },
  birch: { ar: 'شجرة بتولا', wood: 3, hp: 5, s: [0.8, 1.2] }, pine: { ar: 'شجرة صنوبر', wood: 4, hp: 7, s: [0.75, 1.2] }, spruce: { ar: 'شجرة تنّوب', wood: 4, hp: 7, s: [0.75, 1.25] },
  cypress: { ar: 'شجرة سرو', wood: 3, hp: 5, s: [0.8, 1.15] }, willow: { ar: 'شجرة صفصاف', wood: 3, hp: 6, s: [0.85, 1.2] }, olive: { ar: 'شجرة زيتون', wood: 3, hp: 6, s: [0.8, 1.2] },
  acacia: { ar: 'شجرة أكاسيا', wood: 3, hp: 5, s: [0.8, 1.2] }, dead: { ar: 'شجرة يابسة', wood: 3, hp: 4, s: [0.8, 1.2] }, palm: { ar: 'نخلة', wood: 2, hp: 5, s: [0.85, 1.15] },
  plane: { ar: 'شجرة دلب', wood: 4, hp: 7, s: [0.85, 1.2] },
  cactus: { ar: 'صبّار', wood: 1, hp: 3, s: [0.8, 1.2] }, bush: { ar: 'شجيرة', wood: 1, hp: 2, s: [0.7, 1.3], bush: true }, bush2: { ar: 'شجيرة', wood: 1, hp: 2, s: [0.7, 1.3], bush: true }, bush3: { ar: 'شجيرة', wood: 1, hp: 2, s: [0.7, 1.3], bush: true },
};
// biome → weighted species (bushes are scattered separately)
const MIX = {
  2: [['olive', 4], ['cypress', 2.5], ['pine', 2], ['palm', 1.5], ['oak_m', 1], ['plane', 1.5]],
  3: [['oak', 3.5], ['ash', 2.5], ['birch', 2], ['oak_m', 1.2], ['pine', 1], ['plane', 3]],
  4: [['spruce', 5], ['pine', 3.5], ['birch', 1.2]],
  5: [['spruce', 1], ['pine', 1]],
  6: [['oak', 3], ['ash', 2], ['oak_m', 2], ['cypress', 1], ['plane', 3]],
  7: [['acacia', 3], ['cactus', 4], ['palm', 1.5], ['dead', 1.5]],
  8: [['willow', 4], ['dead', 1.5], ['ash', 1.5], ['birch', 1], ['plane', 1]],
  9: [['palm', 8], ['oak_m', 0.6]],
  10: [['pine', 4], ['spruce', 1], ['dead', 0.4]],
  11: [['oak', 3], ['ash', 2], ['birch', 2], ['oak_m', 1.5], ['pine', 1], ['plane', 3.5]],
};
function speciesAt(x, z, biome, r) {
  let mix = MIX[biome] || MIX[11];
  const st = vnoise(x * 0.004 + 3.3, z * 0.004 - 7.1);       // stands: groves of one kind
  if (biome === 3 || biome === 11) { if (st > 0.66) mix = [['birch', 5], ['ash', 1]]; else if (st < 0.25) mix = [['pine', 3], ['oak', 1]]; else if (st > 0.44 && st < 0.56) mix = [['plane', 5], ['oak', 1]]; }
  if (biome === 4 && st > 0.7) mix = [['birch', 4], ['spruce', 1]];
  const h = terrainAt(x, z);
  if (h > 300) mix = [['spruce', 3], ['pine', 2]];
  else if (tempAt(x, z) < 0.36) mix = st > 0.7 ? [['birch', 4], ['spruce', 1]] : [['spruce', 5], ['pine', 3], ['birch', 1]];     // the cold lands grow conifers
  if (biome === 2 && h < 6) mix = [['palm', 4], ['olive', 1]];
  let tot = 0; for (const [, w] of mix) tot += w; let q = r * tot;
  for (const [id, w] of mix) { if ((q -= w) <= 0) return id; }
  return mix[0][0];
}
/* ── the cell store: trees are generated per 64 m cell from the world maps, deterministically ── */
const VCELL = 64;
const VCELLS = new Map();
const FELLED = new Map();              // "ci,cj,k" → time when it grows back
const vkey = (i, j) => i * 100000 + j;
function genCell(ci, cj) {
  const r = RNG(Math.floor(hash(ci * 7 + 13, cj * 13 - 7) * 2147483647) || 1), out = [];
  const x0 = ci * VCELL, z0 = cj * VCELL;
  const tryPlace = (x, z, dens, isBush) => {
    if (!inPlay(x, z)) return;
    const b = biomeAt(x, z), cl = classAt(x, z);
    if (b === 0 || b === 12 || b === 13 || cl === 7 || cl === 2 || cl === 1 || cl === 8 || cl === 9 || (cl === 3 && b !== 9 && b !== 2)) return;
    const h = terrainAt(x, z); if (h < 0.6 || h < waterAt(x, z) + 0.4) return;
    if (slopeAt(x, z) > 0.8) return;
    let onLand = -Infinity;
    if (LAND_ON) { onLand = landTop(x, z); if (onLand > h - 2 && (isBush || r() < 0.55 || landKindAt(x, z) !== 'terraces')) return; }
    const fd = forestAt(x, z);
    let p = isBush ? 0.05 + fd * 0.28 : Math.pow(fd, 1.25) * dens + 0.008;
    if (b === 7) p = isBush ? 0.03 : 0.025 + (h < 40 && moistAt(x, z) > 0.18 ? 0.2 : 0);
    if (b === 5) p *= 0.35;
    if (r() > p) return;
    const id = cl === 10 ? (isBush || r() < 0.6 ? null : 'dead') : isBush ? pick3(r) : speciesAt(x, z, b, r());
    if (!id) return;
    const sp = VEG.species[id]; if (!sp) return;
    const info = SP_INFO[id], s = lerp(info.s[0], info.s[1], r()) * (b === 5 ? 0.65 : 1);
    out.push({ id, v: Math.floor(r() * sp.variants.length), x, z, y: (onLand > h - 2 ? onLand : h) - 0.05, s, rot: r() * TAU, tint: r(), bush: !!isBush });
  };
  const pick3 = (rf) => { const q = rf(); return q < 0.45 ? 'bush' : q < 0.75 ? 'bush2' : 'bush3'; };
  for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) tryPlace(x0 + (i + 0.15 + r() * 0.7) * 8, z0 + (j + 0.15 + r() * 0.7) * 8, 0.92, false);
  for (let k = 0; k < 10; k++) tryPlace(x0 + r() * VCELL, z0 + r() * VCELL, 0, true);
  // keep trunks apart
  const keep = [];
  for (const t of out) { if (keep.some((o) => (o.x - t.x) ** 2 + (o.z - t.z) ** 2 < (t.bush || o.bush ? 6 : 16))) continue; keep.push(t); }
  keep.forEach((t, k) => { t.k = k; t.key = ci + ',' + cj + ',' + k; t.hp = SP_INFO[t.id].hp; });
  if (typeof plantedIn === 'function') plantedIn(ci, cj, keep);
  if (ED_HOOK.veg) { const k2 = ED_HOOK.veg(ci, cj, keep); return { ci, cj, trees: k2, colliders: null }; }   // the world editor: trees put down, trees taken away
  return { ci, cj, trees: keep, colliders: null };
}
function cellAt(ci, cj) { const k = vkey(ci, cj); let c = VCELLS.get(k); if (!c) { c = genCell(ci, cj); VCELLS.set(k, c); } return c; }
const isFelled = (t) => { const r = FELLED.get(t.key); if (r === undefined) return false; if (r <= T_GAME) { FELLED.delete(t.key); t.hp = SP_INFO[t.id].hp; return false; } return true; };
let T_GAME = 0;
/* ── instanced draw lists per species / variant / level; the near ones cast shadows ── */
const VDRAW = new Map();     // key → { trunk: InstancedMesh, leaves: InstancedMesh, n }
function drawFor(id, v, lod, shadow) {
  const key = id + ':' + v + ':' + lod + (shadow ? 's' : '');
  let d = VDRAW.get(key); if (d) return d;
  const sp = VEG.species[id], va = sp.variants[v], L = va[lod === 0 ? 'lod0' : 'lod1'], cap = lod === 0 ? 260 : shadow ? 520 : 1200;
  d = { n: 0, cap };
  const mk = (geo, mat, leaf) => {
    const m = new THREE.InstancedMesh(geo, mat, cap); m.count = 0; m.frustumCulled = false;
    m.castShadow = QUALITY.shadows && !!shadow; m.receiveShadow = true;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3).setUsage(THREE.DynamicDrawUsage);
    if (leaf && LEAF_DEPTH) m.customDepthMaterial = LEAF_DEPTH;
    m.visible = false; scene.add(m); return m;
  };
  if (L.single) d.trunk = mk(L.single, UBER, false);
  else {
    d.trunk = mk(L.trunk, vmat('bark', BARK_LAYERS.indexOf(sp.bark)), false); if (L.leaves) d.leaves = mk(L.leaves, vmat('leaf', LEAF_LAYERS.indexOf(sp.leaf)), true);
    if (L.twigs) d.twigs = mk(L.twigs, vmat('leaf', LEAF_LAYERS.indexOf(sp.twig)), true);
  }
  VDRAW.set(key, d); return d;
}
/* ── impostors: every tree variant photographed from eight sides at load, drawn far away as cards that turn to face you ── */
const IMP = { cols: 8, fw: QUALITY.tier >= 2 ? 112 : 72, fh: QUALITY.tier >= 2 ? 192 : 128, rows: 0, rt: null, index: new Map(), mesh: null, cap: qsel(9000, 16000, 26000, 36000) };
function bakeImpostors() {
  const entries = [];
  for (const [id, sp] of Object.entries(VEG.species)) { if (SP_INFO[id] && SP_INFO[id].bush) continue; sp.variants.forEach((va, v) => entries.push([id, v, va])); }
  IMP.rows = entries.length;
  const W = IMP.cols * IMP.fw, H = IMP.rows * IMP.fh;
  const rt = IMP.rt = new THREE.WebGLRenderTarget(W, H, { minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true, stencilBuffer: false });
  rt.texture.generateMipmaps = false; rt.texture.encoding = THREE.sRGBEncoding;
  const bscene = new THREE.Scene();
  const key = new THREE.DirectionalLight(0xffffff, 2.3); key.position.set(0.3, 1, 0.45); bscene.add(key);
  bscene.add(new THREE.HemisphereLight(0xdfefff, 0x6a6650, 1.05));
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  const saved = { rt: renderer.getRenderTarget(), clear: renderer.getClearColor(new THREE.Color()), alpha: renderer.getClearAlpha(), tone: renderer.toneMapping, auto: renderer.autoClear };
  rt.viewport.set(0, 0, W, H); rt.scissor.set(0, 0, W, H); rt.scissorTest = false;
  // a black, fully transparent background: the mip levels then average colour × coverage, and the card shader divides it back out
  renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(true, true, false);
  renderer.autoClear = false; renderer.toneMapping = THREE.NoToneMapping;
  const grp = new THREE.Group(); bscene.add(grp);
  entries.forEach(([id, v, va], row) => {
    while (grp.children.length) grp.remove(grp.children[0]);
    const L = va.lod0, sp = VEG.species[id];
    if (L.single) grp.add(new THREE.Mesh(L.single, UBER));
    else { grp.add(new THREE.Mesh(L.trunk, vmat('bark', BARK_LAYERS.indexOf(sp.bark)))); if (L.leaves) grp.add(new THREE.Mesh(L.leaves, vmat('leaf', LEAF_LAYERS.indexOf(sp.leaf)))); if (L.twigs) grp.add(new THREE.Mesh(L.twigs, vmat('leaf', LEAF_LAYERS.indexOf(sp.twig)))); }
    // frame: from the foot of the trunk to just over the crown, wide enough for the crown
    let span = va.height * 1.05 + 0.4, hw = span * IMP.fw / IMP.fh / 2;
    const needHW = va.crownR * 1.1 + 0.4;
    if (hw < needHW) { hw = needHW; span = hw * 2 * IMP.fh / IMP.fw; }
    cam.left = -hw; cam.right = hw; cam.bottom = 0; cam.top = span; cam.updateProjectionMatrix();
    va.impHalf = hw; va.impH = span; va.impRow = row;
    for (let f = 0; f < IMP.cols; f++) {
      const a = f / IMP.cols * TAU;
      cam.position.set(Math.sin(a) * 60, 0, Math.cos(a) * 60); cam.lookAt(0, 0, 0);
      const vx = f * IMP.fw, vy = H - (row + 1) * IMP.fh;
      rt.viewport.set(vx, vy, IMP.fw, IMP.fh); rt.scissor.set(vx, vy, IMP.fw, IMP.fh); rt.scissorTest = true;
      renderer.setRenderTarget(rt);
      renderer.render(bscene, cam);
    }
    IMP.index.set(id + ':' + v, row);
  });
  // one empty render with mipmaps switched on builds the mip chain once
  rt.texture.generateMipmaps = true; rt.viewport.set(0, 0, 1, 1); rt.scissor.set(0, 0, 1, 1);
  while (grp.children.length) grp.remove(grp.children[0]);
  renderer.setRenderTarget(rt); renderer.render(bscene, cam);
  rt.viewport.set(0, 0, W, H); rt.scissor.set(0, 0, W, H); rt.scissorTest = false;
  renderer.setRenderTarget(saved.rt); renderer.setClearColor(saved.clear, saved.alpha); renderer.toneMapping = saved.tone; renderer.autoClear = saved.auto;
  // the card mesh: one quad per far tree
  const quad = new THREE.PlaneGeometry(1, 1); quad.translate(0, 0.5, 0);
  const g = new THREE.InstancedBufferGeometry(); g.index = quad.index; g.attributes.position = quad.attributes.position; g.attributes.uv = quad.attributes.uv;
  g.setAttribute('iPos', new THREE.InstancedBufferAttribute(new Float32Array(IMP.cap * 4), 4).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('iDat', new THREE.InstancedBufferAttribute(new Float32Array(IMP.cap * 4), 4).setUsage(THREE.DynamicDrawUsage));
  g.instanceCount = 0;
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTex: { value: rt.texture }, uRows: { value: IMP.rows }, uCols: { value: IMP.cols }, uLight: { value: new THREE.Color(1, 1, 1) }, uFadeIn: { value: QUALITY.treeL1 }, uWet: WET_U, uClimate: CLIMATE_U, uSnowC: SNOWC_U, fogCol: FOG_U.fogCol, fogP: FOG_U.fogP },
    vertexShader: `attribute vec4 iPos; attribute vec4 iDat; uniform float uRows, uCols, uFadeIn; varying vec2 vUv; varying vec2 vUv2; varying float vBlend; varying vec3 vW; varying float vTint; varying float vWin;
      ${WINTER_GLSL}
      void main(){
        vec3 c = iPos.xyz; float sc = iPos.w; float rot = iDat.x, row = iDat.y, hw = iDat.z, hh = iDat.w;
        vec3 toCam = cameraPosition - c; vec2 d = normalize(toCam.xz + vec2(1e-4));
        vec3 right = vec3(d.y, 0.0, -d.x);
        float dist = length(toCam);
        float grow = smoothstep(uFadeIn * 0.9, uFadeIn * 1.02, dist);
        vec3 wp = c + right * (position.x * hw * 2.0 * sc) + vec3(0.0, position.y * hh * sc * grow, 0.0);
        float ang = atan(d.x, d.y) - rot; float fr = mod(ang / 6.2831853 * uCols + uCols * 8.0, uCols);
        float f0 = floor(fr); vBlend = fr - f0; float f1 = mod(f0 + 1.0, uCols);
        vUv = vec2((f0 + uv.x) / uCols, 1.0 - (row + 1.0 - uv.y) / uRows);
        vUv2 = vec2((f1 + uv.x) / uCols, vUv.y);
        vW = wp; vTint = fract(sin(dot(c.xz, vec2(12.9898, 78.233))) * 43758.5453); vWin = winterAt(c.xz) * smoothstep(0.15, 0.75, uv.y);
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`,
    fragmentShader: `uniform sampler2D uTex; uniform vec3 uLight; uniform float uWet; varying vec2 vUv; varying vec2 vUv2; varying float vBlend; varying vec3 vW; varying float vTint; varying float vWin;
      ${FOG_GLSL}
      void main(){
        vec4 a = texture2D(uTex, vUv), b = texture2D(uTex, vUv2); vec4 c = mix(a, b, vBlend);
        if (c.a < 0.42) discard;
        c.rgb /= max(c.a, 0.05);    // far mips stay as bright as the near tree
        vec3 col = pow(min(c.rgb, vec3(1.0)), vec3(2.2)) * uLight * (0.88 + vTint * 0.24) * (1.0 - uWet * 0.25);
        col = mix(col, vec3(0.62, 0.65, 0.7) * uLight, vWin * 0.45);
        col = applyFog(col, length(cameraPosition - vW), vW.y);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`,
  });
  IMP.mesh = new THREE.Mesh(g, mat); IMP.mesh.frustumCulled = false; scene.add(IMP.mesh);
}
/* ── loading ── */
async function loadVegetation() {
  const [T, TX, ba, bn, lv, gr] = await Promise.all([fetchJSON('assets/veg/trees.json'), fetchJSON('assets/veg/trees_extra.json').catch(() => null), loadImage('assets/veg/bark_albedo_v2.jpg'), loadImage('assets/veg/bark_normal_v2.jpg'), loadImage('assets/veg/leaves_v3.webp'), loadImage('assets/veg/ground_v4.webp')]);
  if (TX) Object.assign(T.species, TX.species);      // trees from Sketchfab (credited in the credits page)
  VEG.barkTex = stripToArray(ba, BARK_LAYERS.length); VEG.barkN = stripToArray(bn, BARK_LAYERS.length);
  VEG.leafTex = stripToArray(lv, LEAF_LAYERS.length, { clamp: true }); VEG.groundTex = stripToArray(gr, GROUND_LAYERS.length, { clamp: true });
  LEAF_DEPTH = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaTest: 0.5 });
  LEAF_DEPTH.onBeforeCompile = (sh) => {
    sh.uniforms.uTex = { value: VEG.leafTex };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vUv2;').replace('#include <uv_vertex>', '#include <uv_vertex>\nvUv2 = uv;');
    sh.fragmentShader = 'precision highp sampler2DArray;\n' + sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2DArray uTex; varying vec2 vUv2;')
      .replace('#include <alphatest_fragment>', 'if (texture(uTex, vec3(vUv2, 0.0)).a < 0.5) discard;');
  };
  for (const [id, s] of Object.entries(T.species)) {
    const lod = (L) => ({ trunk: treeGeo(L.trunk, false), leaves: L.leaves ? crownShade(treeGeo(L.leaves, true)) : null, twigs: L.twigs ? crownShade(treeGeo(L.twigs, true)) : null });
    VEG.species[id] = { bark: s.bark, leaf: s.leaf, twig: s.twig, variants: s.variants.map((va) => ({
      height: va.height, trunkR: va.trunkR, crownR: va.crownR, crown: va.crown, lod0: lod(va.lod0), lod1: lod(va.lod1),
    })) };
  }
  VEG.species.palm = { bark: 'palm', leaf: 'palm', variants: [1, 2].map((s) => { const a = palmGeo(s * 101, 0), b = palmGeo(s * 101, 1); return { height: a.height, trunkR: a.trunkR, crownR: a.crownR, crown: [0, a.height - 1, 0], lod0: { trunk: a.trunk, leaves: a.leaves }, lod1: { trunk: b.trunk, leaves: b.leaves } }; }) };
  VEG.species.cactus = { bark: 'palm', leaf: 'palm', variants: [1, 2].map((s) => { const a = cactusGeo(s * 31, 0), b = cactusGeo(s * 31, 1); return { height: a.height, trunkR: a.trunkR, crownR: a.crownR, crown: [0, a.height / 2, 0], lod0: { single: a.geo }, lod1: { single: b.geo } }; }) };
  bakeImpostors();
  VEG.ready = true;
}
/* ── per-frame: choose a level for every tree in range, fill the instance buffers, keep colliders near the player ── */
const _vm = new THREE.Matrix4(), _vq = new THREE.Quaternion(), _vp = new THREE.Vector3(), _vs = new THREE.Vector3(), _ve = new THREE.Euler(), _vc = new THREE.Color(), _vc2 = new THREE.Color(), _vf = new THREE.Vector3();
let vegT = 0, vegLX = 1e9, vegLZ = 1e9, vegYaw = 1e9, vegPitch = 0;
const genQueue = [];
const LEAF_TINT = { olive: [0.78, 0.84, 0.66], spruce: [0.86, 0.92, 0.88], cypress: [0.86, 0.94, 0.84], pine: [1.0, 1.02, 0.94], acacia: [0.9, 0.92, 0.7], willow: [0.88, 1.0, 0.82] };
function tintOf(t, out) {
  const k = t.tint, lt = LEAF_TINT[t.id];
  if (t.id === 'birch') return k > 0.12 ? out.setRGB(0.84 + k * 0.22, 0.9 + k * 0.12, 0.74 + k * 0.1) : out.setRGB(1.45, 1.08, 0.4);   // fresh green birches, a few turning yellow
  out.setRGB(0.82 + k * 0.3, 0.86 + k * 0.22, 0.78 + k * 0.2);
  if (lt) { out.r *= lt[0]; out.g *= lt[1]; out.b *= lt[2]; }
  return out;
}
function updateVegetation(dt, cx, cz, force) {
  if (!VEG.ready) return;
  vegT -= dt;
  const moved = Math.hypot(cx - vegLX, cz - vegLZ);
  // generate missing cells nearest first, a few milliseconds per frame
  const R = QUALITY.treeFar, cr = Math.ceil(R / VCELL), c0i = Math.floor(cx / VCELL), c0j = Math.floor(cz / VCELL);
  if (force || moved > 24 || (!genQueue.length && vegT < -1)) {
    genQueue.length = 0;
    for (let j = -cr; j <= cr; j++) for (let i = -cr; i <= cr; i++) { const d = Math.hypot(i, j) * VCELL; if (d > R + VCELL) continue; if (!VCELLS.has(vkey(c0i + i, c0j + j))) genQueue.push([d, c0i + i, c0j + j]); }
    genQueue.sort((a, b) => a[0] - b[0]);
  }
  const t0 = nowMs(), budget = force ? 1e9 : 3;
  let made = 0;
  while (genQueue.length && nowMs() - t0 < budget) { const [, i, j] = genQueue.shift(); cellAt(i, j); made++; }
  camera.getWorldDirection(_vf);
  const yaw = Math.atan2(_vf.x, _vf.z), turned = Math.abs(angDiff(yaw, vegYaw)) > 0.14 || Math.abs(_vf.y - vegPitch) > 0.12;
  if (!force && !turned && moved < 3 && !(made && vegT < 0) && vegT > -0.6) return;
  if (!force && vegT > 0 && !turned) return;
  vegT = 0.2; vegLX = cx; vegLZ = cz; vegYaw = yaw; vegPitch = _vf.y;
  // forget cells far behind
  for (const [k, c] of VCELLS) if (Math.hypot((c.ci + 0.5) * VCELL - cx, (c.cj + 0.5) * VCELL - cz) > R + 400) { if (c.colliders) for (const col of c.colliders) removeCollider(col); VCELLS.delete(k); }
  for (const d of VDRAW.values()) d.n = 0;
  const L0 = QUALITY.treeL0, L1 = QUALITY.treeL1, SHD = QUALITY.shadows ? QUALITY.shadowDist * 1.1 : -1;
  // a view cone a little wider than the screen: far trees behind you are skipped (their shadows do not reach you)
  const half = Math.atan(Math.tan(camera.fov * Math.PI / 360) * Math.hypot(1, camera.aspect)) + 0.32, cosH = Math.cos(Math.min(half, Math.PI * 0.95));
  const fx = _vf.x, fz = _vf.z, fl = Math.hypot(fx, fz) || 1, lookDown = _vf.y < -0.75;
  const ip = IMP.mesh.geometry.attributes.iPos.array, id = IMP.mesh.geometry.attributes.iDat.array; let ni = 0;
  const colR = 34;
  for (const c of VCELLS.values()) {
    const ccx = (c.ci + 0.5) * VCELL - cx, ccz = (c.cj + 0.5) * VCELL - cz, cd = Math.hypot(ccx, ccz);
    if (cd > R + 46) continue;
    // trunks close to the player are solid
    const wantCol = cd < colR + 46;
    if (wantCol && !c.colliders) { c.colliders = []; for (const t of c.trees) { if (t.bush) continue; const va = VEG.species[t.id].variants[t.v]; const col = addCollider({ t: 'c', x: t.x, z: t.z, r: Math.max(0.12, va.trunkR * t.s * 0.85), y1: t.y + 8 }); col.tree = t; t.col = col; c.colliders.push(col); } }
    else if (!wantCol && c.colliders) { for (const col of c.colliders) removeCollider(col); c.colliders = null; for (const t of c.trees) t.col = null; }
    // cull whole cells outside the view cone
    if (cd > SHD + 64 && !lookDown && (ccx * fx + ccz * fz) / (cd * fl) < Math.cos(Math.min(half + 0.5, Math.PI))) continue;
    for (const t of c.trees) {
      if (isFelled(t)) { if (t.col) t.col.off = true; continue; } else if (t.col) t.col.off = false;
      if (t.fx) continue;
      const dx = t.x - cx, dz = t.z - cz, d = Math.hypot(dx, dz);
      if (d > R) continue;
      if (d > SHD && !lookDown && d > 12 && (dx * fx + dz * fz) / (d * fl) < cosH) continue;
      const va = VEG.species[t.id].variants[t.v], g = t.grow === undefined ? 1 : t.grow;
      if (t.bush) {
        if (d > L1 * 0.55) continue;
        const dr = drawFor(t.id, t.v, d < L0 * 0.6 ? 0 : 1, d < SHD * 0.5);
        if (dr.n >= dr.cap) continue;
        _ve.set(0, t.rot, 0, 'YXZ'); _vq.setFromEuler(_ve); _vm.compose(_vp.set(t.x, t.y, t.z), _vq, _vs.setScalar(t.s * g));
        dr.trunk.setMatrixAt(dr.n, _vm); dr.trunk.setColorAt(dr.n, _vc2.setRGB(1, 1, 1));
        if (dr.leaves) { dr.leaves.setMatrixAt(dr.n, _vm); dr.leaves.setColorAt(dr.n, tintOf(t, _vc)); }
        dr.n++; continue;
      }
      if (d < L1) {
        const lod = d < L0 ? 0 : 1, dr = drawFor(t.id, t.v, lod, lod === 0 || d < SHD);
        if (dr.n >= dr.cap) continue;
        _ve.set(0, t.rot, 0, 'YXZ'); _vq.setFromEuler(_ve);
        _vm.compose(_vp.set(t.x, t.y, t.z), _vq, _vs.setScalar(t.s * g));
        dr.trunk.setMatrixAt(dr.n, _vm); tintOf(t, _vc); dr.trunk.setColorAt(dr.n, _vc2.setRGB(0.9 + t.tint * 0.2, 0.9 + t.tint * 0.15, 0.9 + t.tint * 0.1));
        if (dr.leaves) { dr.leaves.setMatrixAt(dr.n, _vm); dr.leaves.setColorAt(dr.n, _vc); }
        if (dr.twigs) { dr.twigs.setMatrixAt(dr.n, _vm); dr.twigs.setColorAt(dr.n, _vc); }
        dr.n++;
      }
      if (d > L1 * 0.9 && ni < IMP.cap) {   // a little overlap so the swap is not seen
        const k = ni * 4;
        ip[k] = t.x; ip[k + 1] = t.y - 0.25; ip[k + 2] = t.z; ip[k + 3] = t.s * g;
        id[k] = t.rot; id[k + 1] = IMP.index.get(t.id + ':' + t.v); id[k + 2] = va.impHalf; id[k + 3] = va.impH;
        ni++;
      }
    }
  }
  for (const d of VDRAW.values()) {
    for (const m of [d.trunk, d.leaves, d.twigs]) { if (!m) continue; m.count = d.n; m.visible = d.n > 0; if (d.n) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; } }
  }
  const g = IMP.mesh.geometry; g.instanceCount = ni; g.attributes.iPos.needsUpdate = true; g.attributes.iDat.needsUpdate = true;
  g.attributes.iPos.updateRange.count = ni * 4; g.attributes.iDat.updateRange.count = ni * 4;
  VEG.stats = { imp: ni, near: [...VDRAW.values()].reduce((s, d) => s + d.n, 0), cells: VCELLS.size };
}
function vegFrame(dt, t) {
  TIME_U.value = t; WIND.value = 0.25 + WEATHER.wind * 1.1;
  SUNDIR_U.value.copy(ENV.lightDir); SUNCOL_U.value.copy(sun.color)   // towards the sun: leaves and grass glow when you look into the light.multiplyScalar(sun.intensity * 0.45 * (ENV.sunVis || 0));
  if (IMP.mesh) { const L = IMP.mesh.material.uniforms.uLight.value; L.copy(sun.color).multiplyScalar(sun.intensity * 0.3).add(_vc.copy(hemi.color).multiplyScalar(hemi.intensity * 1.2)); }
}
/* trees near a point, for felling and building checks */
function treesNear(x, z, r, fn) {
  for (let i = Math.floor((x - r) / VCELL); i <= Math.floor((x + r) / VCELL); i++) for (let j = Math.floor((z - r) / VCELL); j <= Math.floor((z + r) / VCELL); j++) {
    const c = VCELLS.get(vkey(i, j)); if (!c) continue;
    for (const t of c.trees) { if (isFelled(t)) continue; if ((t.x - x) ** 2 + (t.z - z) ** 2 < r * r) if (fn(t) === false) return; }
  }
}

/* ═════════ ground cover: grass, flowers, ferns, reeds and the crops in the fields, on 8 m tiles around you ═════════
   every tile holds many candidates with a random rank; the shader keeps all of them at your feet and thins them with distance */
const GBLOCK = new Set();        // 8 m tiles where something (a crater, a floor, a reaped patch) may push grass aside
const GRASS = { tiles: new Map(), queue: [], mesh: null, cap: qsel(26000, 52000, 90000, 140000), per: qsel(110, 200, 300, 420), dirty: true, lx: 1e9, lz: 1e9, fill: true };
const EDGE_PROBE = [[2.5, 0], [-2.5, 0], [0, 2.5], [0, -2.5], [5, 0], [-5, 0], [0, 5], [0, -5]];
/* wildflower fields: patches a few hundred metres wide where one flower takes over the meadow (the terrain shader paints the same patches from afar) */
const flowerField = (x, z) => smooth(0.66, 0.78, vnoise(x * 0.011 + 7.7, z * 0.011 - 3.1));
const flowerKind = (x, z) => { const q = vnoise(x * 0.0045 + 1.3, z * 0.0045 + 9.1); return q < 0.25 ? GL_.poppy : q < 0.45 ? GL_.lavender : q < 0.65 ? GL_.daisy : q < 0.82 ? GL_.buttercup : GL_.flowers; };
const GSIZE = { reeds: 1.15, fern: 0.85, grass_tall: 0.95, shrub: 0.8, flowers: 0.6, poppy: 0.62, lavender: 0.72, daisy: 0.5, buttercup: 0.5, blades: 0.82, blades2: 0.9, tuft: 0.78, ivy: 0.42 };
const GSIZE_L = GROUND_LAYERS.map((n) => GSIZE[n] || 0.62);
const CROP_KIND = { 1: 'wheat', 2: 'corn', 3: 'sunflower', 4: 'cotton', 5: 'greens', 6: 'tomato', 8: 'wheat', 9: 'corn', 10: 'greens', 11: 'greens', 12: 'barley' };
const CROP_SIZE = { wheat: [0.55, 0.6, 1.05], barley: [0.55, 0.6, 0.95], corn: [0.9, 1.0, 2.3], sunflower: [0.95, 1.1, 1.75], cotton: [0.75, 0.95, 1.0], greens: [0.6, 0.85, 0.7], tomato: [0.7, 0.95, 0.85] };
const CLEARINGS = [];          // trodden places (the lobby camp): only short grass grows there
function grassTile(ti, tj) {
  const r = RNG(Math.floor(hash(ti * 3 + 5, tj * 5 + 3) * 2147483647) || 1);
  const x0 = ti * 8, z0 = tj * 8;
  const nearClear = CLEARINGS.length && CLEARINGS.some((c) => Math.abs(c.x - x0 - 4) < c.r + 6 && Math.abs(c.z - z0 - 4) < c.r + 6);
  // a 5 × 5 grid of heights (2 m) for cheap, exact-enough placement
  const HG = new Float32Array(25); for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) HG[j * 5 + i] = terrainAt(x0 + i * 2, z0 + j * 2);
  const hAt = (x, z) => { const fx = (x - x0) / 2, fz = (z - z0) / 2, i = Math.min(3, fx | 0), j = Math.min(3, fz | 0), u = fx - i, v = fz - j, k = j * 5 + i; return (HG[k] * (1 - u) + HG[k + 1] * u) * (1 - v) + (HG[k + 5] * (1 - u) + HG[k + 6] * u) * v; };
  const slp = (x, z) => { const fx = (x - x0) / 2, fz = (z - z0) / 2, i = Math.min(3, fx | 0), j = Math.min(3, fz | 0), k = j * 5 + i; return Math.hypot(HG[k + 1] - HG[k], HG[k + 5] - HG[k]) / 2; };
  const out = [];
  const crop = cropAt(x0 + 4, z0 + 4), cls = classAt(x0 + 4, z0 + 4), blocked = GBLOCK.has(ti * 100000 + tj);
  const painted = ED_HOOK.grass ? ED_HOOK.grass : null;          // grass and flowers the world editor painted (they grow anywhere dry)
  if (cls === 1 && crop && !(painted && painted(x0 + 4, z0 + 4))) {
    // crops in rows, every row the same kind; the field's own rows run along x or z
    const kind = CROP_KIND[crop]; if (!kind) return new Float32Array(0);
    const [dx0, dz0, sz] = CROP_SIZE[kind], alongX = (crop % 2) === 0;
    const dx = alongX ? dx0 * 0.6 : dz0, dz = alongX ? dz0 : dx0 * 0.6;
    const layer = GL_[kind];
    for (let z = z0 + dz * 0.5; z < z0 + 8; z += dz) for (let x = x0 + dx * 0.5; x < x0 + 8; x += dx) {
      const px = x + (r() - 0.5) * dx * (alongX ? 0.8 : 0.2), pz = z + (r() - 0.5) * dz * (alongX ? 0.2 : 0.8);
      if (classAt(px, pz) !== 1) continue;
      if (blocked && grassBlocked(px, pz, true)) continue;
      out.push(px, hAt(px, pz) - 0.03, pz, sz * (0.85 + r() * 0.3), r() * TAU, layer, -1);
    }
    return new Float32Array(out);
  }
  for (let k = 0; k < GRASS.per; k++) {
    const x = x0 + r() * 8, z = z0 + r() * 8, rank = r(), b = biomeAt(x, z), c = classAt(x, z), force = painted ? painted(x, z) : 0;
    if (!force && (c === 7 || c === 2 || c === 1 || c === 8 || c === 9 || c === 10 || b === 0 || b === 12 || b === 13)) continue;
    const h = hAt(x, z), wl = waterAt(x, z);
    if (h < wl - 0.25) continue;
    if (blocked && grassBlocked(x, z, false)) continue;
    if (LAND_ON && landTop(x, z) > h - 2) continue;
    if (force) {
      const q = r(), layer = force & 16 ? (q < 0.55 ? flowerKind(x + q * 40, z) : q < 0.8 ? GL_.grass_tall : GL_.blades) : q < 0.3 ? GL_.grass_tall : q < 0.55 ? GL_.blades : q < 0.75 ? GL_.blades2 : q < 0.9 ? GL_.grass : GL_.tuft;
      out.push(x, h - 0.05, z, GSIZE_L[layer] * (0.8 + r() * 0.5), r() * TAU, layer, rank); continue;
    }
    // under the snow of the cold north-east only a few dry tufts show
    const tw = tempAt(x, z), wk = tw < 0.4 ? smooth(0.4, 0.335, tw) : 0;
    if (wk > 0 && r() < wk * 0.93) continue;
    const nearW = h < wl + 0.7;
    const m = moistAt(x, z), fd = forestAt(x, z), sl = slp(x, z);
    if (sl > 0.7 || h > 380) continue;
    let layer;
    if (nearW && (b === 8 || b === 3 || b === 11 || b === 6 || b === 4)) { if (r() > 0.7) continue; layer = GL_.reeds; }
    else if (b === 1 || c === 3 || c === 5) { if (r() > 0.18) continue; layer = GL_.beachgrass; }
    else if (b === 7) { if (r() > 0.1) continue; layer = r() < 0.55 ? GL_.shrub : GL_.grass_dry; }
    else if (b === 5 || h > 290 || wk > 0.3) { if (r() > 0.55) continue; layer = wk > 0.3 ? GL_.grass_dry : GL_.tundra; }
    else if (fd > 0.45) { const q = r(); if (q > 0.62) continue; layer = q < 0.17 ? GL_.fern : q < 0.27 ? GL_.ivy : q < 0.34 ? GL_.tuft : q < 0.48 ? GL_.grass_tall : q < 0.55 ? GL_.blades2 : GL_.grass; }
    else if (b === 9 || b === 10) { layer = r() < 0.7 ? GL_.grass_tall : GL_.beachgrass; }
    else if ((b === 11 || b === 6 || b === 2) && fd < 0.35 && m >= 0.3 && r() < flowerField(x, z) * 0.6) layer = flowerKind(x, z);
    else { const q = r(); layer = m < 0.3 ? (q < 0.65 ? GL_.grass_dry : q < 0.75 ? GL_.shrub : q < 0.88 ? GL_.blades : GL_.grass) : q < 0.06 ? GL_.flowers : q < 0.2 ? GL_.grass_tall : q < 0.42 ? GL_.blades : q < 0.6 ? GL_.blades2 : q < 0.68 ? GL_.tuft : GL_.grass; }
    let s = GSIZE_L[layer];
    // mown verges: grass grows shorter and thinner towards a road, a yard or a street, never a hedge-like wall
    let edge = 0; for (const [ox, oz] of EDGE_PROBE) { const ec = classAt(x + ox, z + oz); if (ec === 2 || ec === 7) edge++; }
    if (edge) { if (r() < edge * 0.12) continue; s *= Math.max(0.35, 1 - edge * 0.1); }
    if (nearClear) {
      let k = 0; for (const c of CLEARINGS) { const d = Math.hypot(x - c.x, z - c.z); if (d < c.r) k = Math.max(k, 1 - (d / c.r) * 0.55); }
      if (k > 0) { if (r() < k * 0.6) continue; if (layer !== GL_.grass && layer !== GL_.flowers && layer !== GL_.daisy) layer = GL_.grass; s = GSIZE_L[layer] * (1 - k * 0.6); }
    }
    out.push(x, h - 0.05, z, s * (0.7 + r() * 0.6), r() * TAU, layer, rank);
  }
  return new Float32Array(out);
}
function makeGrassMesh() {
  // three crossed cards per clump
  const P = [], U = [], I = [];
  for (let k = 0; k < 3; k++) {
    const a = k * Math.PI / 3, cx = Math.cos(a) * 0.5, cz = Math.sin(a) * 0.5, b = P.length / 3;
    P.push(-cx, 0, -cz, cx, 0, cz, cx, 1, cz, -cx, 1, -cz); U.push(0, 1, 1, 1, 1, 0, 0, 0); I.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const g = new THREE.InstancedBufferGeometry(); g.setIndex(I); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.setAttribute('iA', new THREE.InstancedBufferAttribute(new Float32Array(GRASS.cap * 4), 4).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('iB', new THREE.InstancedBufferAttribute(new Float32Array(GRASS.cap * 3), 3).setUsage(THREE.DynamicDrawUsage));
  g.instanceCount = 0;
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.lights, {
    uTex: { value: null }, uMaps: { value: null }, uSunCol: { value: new THREE.Color() }, uAmb: { value: new THREE.Color() }, uR: { value: QUALITY.grassR }, uRC: { value: qsel(40, 55, 70, 85) }, uPlayer: { value: new THREE.Vector3() },
  }]);
  Object.assign(uniforms, { uTex: { value: VEG.groundTex }, uMaps: { value: TEXA.maps }, uTime: TIME_U, uWind: WIND, uWet: WET_U, uSunD: SUNDIR_U, fogCol: FOG_U.fogCol, fogP: FOG_U.fogP });
  const mat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide, lights: true, uniforms,
    vertexShader: `#include <common>
      #include <packing>
      attribute vec4 iA; attribute vec3 iB; uniform float uTime, uWind, uR, uRC; uniform vec3 uPlayer; uniform sampler2D uMaps;
      varying vec2 vUv; varying float vLayer; varying vec3 vW; varying float vShade; varying float vFade; varying float vSun; varying vec3 vTint;
      #if defined(USE_SHADOWMAP) && NUM_DIR_LIGHT_SHADOWS > 0
        uniform sampler2D directionalShadowMap[NUM_DIR_LIGHT_SHADOWS]; uniform mat4 directionalShadowMatrix[NUM_DIR_LIGHT_SHADOWS];
      #endif
      float sunVis(vec3 wp){
        #if defined(USE_SHADOWMAP) && NUM_DIR_LIGHT_SHADOWS > 0
          vec4 sc = directionalShadowMatrix[0] * vec4(wp, 1.0); vec3 c = sc.xyz / sc.w;
          if (c.x < 0.01 || c.x > 0.99 || c.y < 0.01 || c.y > 0.99 || c.z > 1.0) return 1.0;
          float o = 1.0 / 1024.0, s = 0.0;
          s += step(c.z - 0.003, unpackRGBAToDepth(texture2D(directionalShadowMap[0], c.xy + vec2(-o, -o))));
          s += step(c.z - 0.003, unpackRGBAToDepth(texture2D(directionalShadowMap[0], c.xy + vec2(o, -o))));
          s += step(c.z - 0.003, unpackRGBAToDepth(texture2D(directionalShadowMap[0], c.xy + vec2(-o, o))));
          s += step(c.z - 0.003, unpackRGBAToDepth(texture2D(directionalShadowMap[0], c.xy + vec2(o, o))));
          return s * 0.25;
        #else
          return 1.0;
        #endif
      }
      void main(){
        float rot = iB.x; vLayer = iB.y; float rank = iB.z; float s = iA.w;
        float dist = length(cameraPosition - iA.xyz);
        // thin out with distance (clumps shrink away as they pass their rank), grow the survivors a little
        if (rank < 0.0) s *= smoothstep(uRC, uRC * 0.85, dist);     // crops: every plant, out to the far edge of the field
        else { float keep = mix(1.0, 0.16, smoothstep(5.0, uR, dist));
          s *= smoothstep(rank, rank + 0.08, keep) * (1.0 + 0.5 * smoothstep(8.0, uR, dist)) * smoothstep(uR, uR * 0.8, dist); }
        float c = cos(rot), sn = sin(rot);
        vec3 p = vec3(position.x * c - position.z * sn, position.y, position.x * sn + position.z * c) * s;
        float ph = iA.x * 0.31 + iA.z * 0.27;
        float bend = (sin(uTime * 1.6 + ph) * 0.5 + sin(uTime * 3.7 + ph * 2.3) * 0.2 + 0.25) * uWind * 0.22 * position.y * position.y * s;
        p.x += bend; p.z += bend * 0.6;
        vec3 w = iA.xyz + p;
        // pushed aside where you walk
        vec2 away = w.xz - uPlayer.xz; float dp = length(away);
        if (dp < 1.2 && abs(w.y - uPlayer.y) < 2.0) { float k = (1.2 - dp); w.xz += normalize(away + 1e-4) * k * 0.55 * position.y * s; w.y -= k * 0.3 * position.y * s; }
        vFade = 1.0;
        vUv = uv; vW = w; vShade = smoothstep(-0.05, 1.0, position.y);
        vSun = s > 0.001 ? sunVis(iA.xyz + vec3(0.0, 0.25 + position.y * s * 0.6, 0.0)) : 1.0;
        vec3 mp = texture2D(uMaps, ${GL_MAPUV('iA.xz')}).rgb;
        vTint = mix(vec3(1.12, 1.0, 0.72), vec3(0.88, 1.02, 0.86), smoothstep(0.2, 0.7, mp.r)) * (0.9 + 0.2 * fract(ph * 7.31));
        vTint = mix(vTint, vec3(1.1, 0.95, 0.72), smoothstep(0.40, 0.335, mp.b) * 0.75);   // straw-pale tufts above the snow
        gl_Position = s > 0.001 ? projectionMatrix * viewMatrix * vec4(w, 1.0) : vec4(2.0, 2.0, 2.0, 1.0);
      }`,
    fragmentShader: `precision highp sampler2DArray; uniform sampler2DArray uTex; uniform vec3 uSunCol, uAmb, uSunD; uniform float uWet;
      varying vec2 vUv; varying float vLayer; varying vec3 vW; varying float vShade; varying float vFade; varying float vSun; varying vec3 vTint;
      ${FOG_GLSL}
      void main(){
        vec4 t = texture(uTex, vec3(vUv, vLayer));
        if (t.a < 0.45) discard;
        vec3 alb = pow(t.rgb, vec3(2.2)) * vTint * (1.0 - uWet * 0.25);
        // roots in the shade of the clump, sunlit tips a touch warmer; blades glow when the sun is behind them
        alb *= mix(vec3(0.86, 0.92, 0.88), vec3(1.07, 1.04, 0.88), vShade);
        float ao = mix(0.3, 1.0, vShade);
        float trans = pow(max(dot(normalize(vW - cameraPosition), uSunD), 0.0), 4.0) * vShade;
        vec3 col = alb * (uAmb * ao + uSunCol * vSun * (0.3 + 0.7 * vShade + trans * 1.1));
        col = applyFog(col, length(cameraPosition - vW), vW.y);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`,
  });
  GRASS.mesh = new THREE.Mesh(g, mat); GRASS.mesh.frustumCulled = false; scene.add(GRASS.mesh);
}
function updateGrass(dt, cx, cz, force) {
  if (!VEG.ready) return;
  if (!GRASS.mesh) makeGrassMesh();
  const u = GRASS.mesh.material.uniforms;
  u.uSunCol.value.copy(sun.color).multiplyScalar(sun.intensity * 0.42); u.uAmb.value.copy(hemi.color).multiplyScalar(hemi.intensity * 1.05);
  u.uR.value = QUALITY.grassR * STRAIN.grassK * SET.foliage;
  if (typeof player !== 'undefined' && player) u.uPlayer.value.copy(player.pos);
  const ti = Math.floor(cx / 8), tj = Math.floor(cz / 8);
  if (ti !== GRASS.lx || tj !== GRASS.lz || GRASS.dirty || force) {
    GRASS.lx = ti; GRASS.lz = tj; GRASS.dirty = false;
    const RG = QUALITY.grassR + 6, RC = Math.max(QUALITY.grassR, qsel(40, 55, 70, 85)), want = new Set();
    GRASS.queue.length = 0;
    const n = Math.ceil(RC / 8) + 1;
    for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) {
      const d = Math.max(0, Math.hypot(i * 8 + 4 - (cx - ti * 8), j * 8 + 4 - (cz - tj * 8)) - 5.7);
      if (d > RG && !(d <= RC && classAt((ti + i) * 8 + 4, (tj + j) * 8 + 4) === 1)) continue;
      const k = (ti + i) * 100000 + (tj + j); want.add(k);
      if (!GRASS.tiles.has(k)) GRASS.queue.push([d, ti + i, tj + j, k]);
    }
    GRASS.queue.sort((a, b) => a[0] - b[0]);
    for (const k of GRASS.tiles.keys()) if (!want.has(k)) GRASS.tiles.delete(k);
    GRASS.fill = true;
  }
  const t0 = nowMs(), budget = force ? 1e9 : 2.5;
  while (GRASS.queue.length && nowMs() - t0 < budget) { const [, i, j, k] = GRASS.queue.shift(); GRASS.tiles.set(k, grassTile(i, j)); GRASS.fill = true; }
  if (!GRASS.fill) return;
  GRASS.fill = false;
  const g = GRASS.mesh.geometry, A = g.attributes.iA.array, B = g.attributes.iB.array; let n = 0;
  for (const arr of GRASS.tiles.values()) {
    for (let q = 0; q < arr.length && n < GRASS.cap; q += 7) { A[n * 4] = arr[q]; A[n * 4 + 1] = arr[q + 1]; A[n * 4 + 2] = arr[q + 2]; A[n * 4 + 3] = arr[q + 3]; B[n * 3] = arr[q + 4]; B[n * 3 + 1] = arr[q + 5]; B[n * 3 + 2] = arr[q + 6]; n++; }
  }
  g.instanceCount = n; g.attributes.iA.needsUpdate = true; g.attributes.iB.needsUpdate = true;
  g.attributes.iA.updateRange.count = n * 4; g.attributes.iB.updateRange.count = n * 3;
  GRASS.count = n;
}
/* the ground under you changed (a crater, a building): rebuild the tiles there */
function grassDirtyArea(x, z, r) {
  for (let i = Math.floor((x - r) / 8); i <= Math.floor((x + r) / 8); i++) for (let j = Math.floor((z - r) / 8); j <= Math.floor((z + r) / 8); j++) GRASS.tiles.delete(i * 100000 + j);
  GRASS.dirty = true;
}
