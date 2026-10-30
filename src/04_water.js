/* ═════════ water: the open sea (swell, shore foam, depth colour) and the inland lakes, rivers and swamp pools ═════════ */
const TEX = { water: null };
const WAVES = [[1.0, 0.35, 0.065, 0.32], [-0.45, 1.0, 0.11, 0.2], [0.7, -0.7, 0.19, 0.11], [-0.95, -0.2, 0.31, 0.06], [0.3, 0.95, 0.47, 0.035]];
function waveY(x, z, t) { let h = 0; for (const [dx, dz, k, a] of WAVES) { const L = Math.hypot(dx, dz); h += a * Math.sin((dx * x + dz * z) / L * k - Math.sqrt(9.8 * k) * t); } return h * WEATHERSEA.k; }
const WEATHERSEA = { k: 1 };
const GLSL_SWELL = `
  uniform float uSea;
  vec3 swell(vec2 p, float t){
    vec3 r = vec3(0.0);
    ${WAVES.map(([dx, dz, k, a]) => { const L = Math.hypot(dx, dz), Dx = (dx / L).toFixed(4), Dz = (dz / L).toFixed(4);
      return `{ float ph = dot(vec2(${Dx}, ${Dz}), p) * ${k.toFixed(4)} - ${Math.sqrt(9.8 * k).toFixed(4)} * t; float c = cos(ph);
        r.x += ${a.toFixed(4)} * sin(ph); r.y += ${(a * k).toFixed(5)} * ${Dx} * c; r.z += ${(a * k).toFixed(5)} * ${Dz} * c; }`; }).join('\n')}
    return r * uSea;
  }`;
/* the sea floor as a texture: depth colour and shore foam need it in the shader */
let SEABED = null;
function makeSeabedTexture() {
  // full-range ground height, 16 bits split over R and G, sampled with a manual bilinear filter
  const d = new Uint8Array(WN * WN * 4);
  for (let i = 0; i < WN * WN; i++) { const v = clamp(Math.round((HM[i] + 100) * 100), 0, 65535); d[i * 4] = v >> 8; d[i * 4 + 1] = v & 255; d[i * 4 + 2] = 0; d[i * 4 + 3] = 255; }
  SEABED = new THREE.DataTexture(d, WN, WN, THREE.RGBAFormat); SEABED.magFilter = SEABED.minFilter = THREE.NearestFilter; SEABED.wrapS = SEABED.wrapT = THREE.ClampToEdgeWrapping; SEABED.generateMipmaps = false; SEABED.needsUpdate = true;
  oceanMat.uniforms.uHeight.value = SEABED; lakeMat.uniforms.uHeight.value = SEABED;
}
const WATER_COMMON = `
  uniform float uTime, uDay, uHasN, uRain, uShore; uniform sampler2D uHeight, uNormals;
  uniform vec3 uLight, uLightCol, uDeep, uShallow, uTop, uHor;
  ${FOG_GLSL}
  float hAt(ivec2 c){ vec2 rg = texelFetch(uHeight, clamp(c, ivec2(0), ivec2(${GL_NI})), 0).rg; return (rg.r * 65280.0 + rg.g * 255.0) / 100.0 - 100.0; }
  float ground(vec2 xz){ vec2 f = (xz + ${GL_HALF}) / ${GL_STEP}; if (f.x < 0.0 || f.y < 0.0 || f.x > ${GL_NM2} || f.y > ${GL_NM2}) return -40.0;
    ivec2 i = ivec2(floor(f)); vec2 u = f - vec2(i);
    return mix(mix(hAt(i), hAt(i + ivec2(1, 0)), u.x), mix(hAt(i + ivec2(0, 1)), hAt(i + ivec2(1, 1)), u.x), u.y); }
  vec2 ripples(vec2 p, float t, float fade, vec2 flow){
    vec2 rip = vec2(0.0);
    if (uHasN > 0.5) {
      vec3 n1 = texture2D(uNormals, p * 0.029 + vec2(t * 0.011, t * 0.007) + flow * t * 0.05).rgb * 2.0 - 1.0;
      vec3 n2 = texture2D(uNormals, p * 0.081 - vec2(t * 0.019, -t * 0.013) + flow * t * 0.09).rgb * 2.0 - 1.0;
      rip = (n1.xy + n2.xy * 0.7) * 0.3 * (0.35 + 0.65 * fade);
    } else rip = vec2(sin(p.x * 0.9 + t * 2.0), sin(p.y * 0.8 - t * 1.7)) * 0.05 * fade;
    // raindrops: tiny expanding rings
    if (uRain > 0.02) { vec2 c = floor(p * 1.6); vec2 f = fract(p * 1.6) - 0.5; float ph = fract(t * 1.4 + fract(sin(dot(c, vec2(12.9, 78.2))) * 437.5));
      float r = length(f); float ring = sin((r - ph * 0.5) * 60.0) * smoothstep(0.5, 0.0, abs(r - ph * 0.5) * 5.0) * (1.0 - ph);
      rip += f / max(r, 0.001) * ring * 0.25 * uRain * fade; }
    return rip;
  }
  vec3 shade(vec3 wpos, vec3 n, float depth, float foam, float alphaBase, out float alpha){
    vec3 v = normalize(cameraPosition - wpos); float ndv = max(dot(n, v), 0.0);
    float fres = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
    vec3 water = mix(uShallow, uDeep, 1.0 - exp(-depth * 0.2));
    vec3 r = reflect(-v, n);
    vec3 skyc = mix(uHor, uTop, pow(max(r.y, 0.0), 0.5));
    // a lake mirrors its own dark shores near the horizon, not open sky
    skyc = mix(skyc, vec3(0.05, 0.07, 0.05) * (0.25 + 0.75 * uDay), uShore * (1.0 - smoothstep(0.03, 0.2, r.y)) * 0.85);
    vec3 col = mix(water, skyc, clamp(fres, 0.0, 1.0) * mix(0.9, 0.82, uShore));
    float sp = max(dot(r, uLight), 0.0);
    col += uLightCol * (pow(sp, 700.0) * 16.0 + pow(sp, 70.0) * 0.35) * step(0.0, uLight.y) * (1.0 - uRain * 0.7);
    col = mix(col, mix(vec3(0.02, 0.03, 0.035), vec3(0.86, 0.89, 0.88), uDay * 0.9 + 0.1), foam * 0.8);
    alpha = max(mix(alphaBase, 0.97, smoothstep(0.0, 5.0, depth)), foam * 0.9);
    float dist = length(cameraPosition - wpos);
    col = applyFog(col, dist, wpos.y);
    return col;
  }`;
const WATER_UNI = () => ({
  uTime: { value: 0 }, uHeight: { value: null }, uNormals: { value: DETAIL }, uHasN: { value: 0 }, uRain: { value: 0 }, uSea: { value: 1 }, uShore: { value: 0 },
  uLight: { value: new THREE.Vector3(0, 1, 0) }, uLightCol: { value: C(0xfff3d6) }, uDeep: { value: C(0x1d5f73) }, uShallow: { value: C(0x63d3c6) },
  uTop: { value: C(0x4f9fd2) }, uHor: { value: C(0xcfe5ea) }, uDay: { value: 1 }, fogCol: FOG_U.fogCol, fogP: FOG_U.fogP,
});
const oceanMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, fog: false, uniforms: WATER_UNI(),
  vertexShader: `uniform float uTime; varying vec3 vW; varying float vH; ${GLSL_SWELL}
    void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vec3 s = swell(w.xz, uTime); float fade = 1.0 - smoothstep(600.0, 1600.0, length(w.xz - cameraPosition.xz)); w.y += s.x * fade; vW = w.xyz; vH = s.x; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `${WATER_COMMON} varying vec3 vW; varying float vH; ${GLSL_SWELL}
    void main(){
      float t = uTime; vec2 p = vW.xz; float depth = vW.y - ground(p);
      if (depth < -0.05) discard;
      float dist = length(cameraPosition - vW); vec3 s = swell(p, t);
      float fade = 1.0 - smoothstep(40.0, 360.0, dist);
      vec2 rip = ripples(p, t, fade, vec2(0.0));
      vec3 n = normalize(vec3(-s.y + rip.x, 1.0, -s.z + rip.y));
      float shore = 1.0 - smoothstep(0.0, 1.6, depth);
      float band = 0.5 + 0.5 * sin(depth * 6.0 - t * 2.2 + sin(p.x * 0.21 + p.y * 0.17) * 2.5);
      float crest = smoothstep(0.45 * uSea, 0.75 * uSea, vH) * (0.5 + 0.5 * sin(p.x * 0.7 + p.y * 0.5 + t)) * fade;
      float foam = clamp(shore * (0.45 + 0.55 * band) + crest * 0.5, 0.0, 1.0);
      float a; vec3 col = shade(vW, n, depth, foam, 0.55, a);
      gl_FragColor = vec4(col, a);
      #include <tonemapping_fragment>
      #include <encodings_fragment>
    }`,
});
/* a radial grid around the camera: fine near you, coarse at the horizon */
function radialGrid(rings, segs, r0, rMax) {
  const pos = [], idx = []; const g = Math.pow(rMax / r0, 1 / rings);
  pos.push(0, 0, 0);
  for (let k = 0; k <= rings; k++) { const r = r0 * Math.pow(g, k); for (let s = 0; s < segs; s++) { const a = s / segs * TAU; pos.push(Math.cos(a) * r, 0, Math.sin(a) * r); } }
  for (let s = 0; s < segs; s++) idx.push(0, 1 + (s + 1) % segs, 1 + s);
  for (let k = 0; k < rings; k++) for (let s = 0; s < segs; s++) {
    const a = 1 + k * segs + s, b = 1 + k * segs + (s + 1) % segs, c = a + segs, d = b + segs; idx.push(a, b, c, b, d, c);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); return geo;
}
const ocean = new THREE.Mesh(radialGrid(Math.round(QUALITY.waterSeg * 0.42), Math.round(QUALITY.waterSeg * 0.6), 3, 9000), oceanMat);
ocean.renderOrder = 2; ocean.frustumCulled = false; scene.add(ocean);
/* inland water: built from the water level grid, one mesh per 512 m block */
const lakeMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, fog: false, uniforms: WATER_UNI(),
  vertexShader: `attribute vec2 aFlow; varying vec3 vW; varying vec2 vFlow; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vFlow = aFlow; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `${WATER_COMMON} varying vec3 vW; varying vec2 vFlow;
    void main(){
      float t = uTime; vec2 p = vW.xz; float depth = vW.y - ground(p);
      if (depth < -0.08) discard;
      float dist = length(cameraPosition - vW); float fade = 1.0 - smoothstep(30.0, 300.0, dist);
      float speed = length(vFlow);
      vec2 rip = ripples(p, t, fade, vFlow * 2.5) * (0.7 + speed * 0.8);
      vec3 n = normalize(vec3(rip.x, 1.0, rip.y));
      float shore = 1.0 - smoothstep(0.0, 0.9, depth);
      float rapids = speed * smoothstep(0.6, 0.0, depth) * (0.5 + 0.5 * sin(dot(p, vFlow) * 3.0 - t * 6.0));
      float foam = clamp(shore * 0.35 + rapids * 0.5, 0.0, 1.0);
      float a; vec3 col = shade(vW, n, depth, foam, 0.62, a);
      gl_FragColor = vec4(col, a);
      #include <tonemapping_fragment>
      #include <encodings_fragment>
    }`,
});
lakeMat.uniforms.uShore.value = 1;
const LAKES = { group: new THREE.Group(), built: false };
scene.add(LAKES.group);
function buildInlandWater() {
  const B = 64;   // cells per block
  for (let bj = 0; bj < (WN - 1) / B; bj++) for (let bi = 0; bi < (WN - 1) / B; bi++) {
    const pos = [], flow = [], idx = []; const vmap = new Map();
    const lvl = (i, j) => { const k = j * WN + i, w = WLV[k]; return (w > 0.04) ? w : -1e9; };
    const vert = (i, j) => {
      const key = j * WN + i; let v = vmap.get(key); if (v !== undefined) return v;
      let w = lvl(i, j);
      if (w < -1e8) { let best = -1e9; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const q = (i + a >= 0 && j + b >= 0 && i + a < WN && j + b < WN) ? lvl(i + a, j + b) : -1e9; if (q > best) best = q; } w = best; }
      const fl = FLW[key]; let fx = 0, fz = 0;
      if (fl) { const ang = (fl - 1) / 253 * TAU; fx = Math.cos(ang); fz = Math.sin(ang); }
      v = pos.length / 3; pos.push(-WHALF + i * WSTEP, w + 0.02, -WHALF + j * WSTEP); flow.push(fx, fz); vmap.set(key, v); return v;
    };
    for (let j = bj * B; j < Math.min(WN - 1, (bj + 1) * B); j++) for (let i = bi * B; i < Math.min(WN - 1, (bi + 1) * B); i++) {
      const a = lvl(i, j), b = lvl(i + 1, j), c = lvl(i, j + 1), d = lvl(i + 1, j + 1);
      if (Math.max(a, b, c, d) < -1e8) continue;
      const va = vert(i, j), vb = vert(i + 1, j), vc = vert(i, j + 1), vd = vert(i + 1, j + 1);
      if (pos[va * 3 + 1] < -1e8 || pos[vb * 3 + 1] < -1e8 || pos[vc * 3 + 1] < -1e8 || pos[vd * 3 + 1] < -1e8) continue;
      idx.push(va, vc, vb, vb, vc, vd);
    }
    if (!idx.length) continue;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aFlow', new THREE.Float32BufferAttribute(flow, 2)); g.setIndex(idx); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, lakeMat); m.renderOrder = 2; LAKES.group.add(m);
  }
  LAKES.built = true;
}
const _lakeTint = new THREE.Color();
/* keep the water colours in step with the sky */
function updateWater(dt, t) {
  for (const m of [oceanMat, lakeMat]) {
    const u = m.uniforms; u.uTime.value = t; u.uRain.value = WEATHER.rain;
    mixKey(KEY.deep, u.uDeep.value); mixKey(KEY.shallow, u.uShallow.value);
    const oc = smooth(0.55, 1, WEATHER.cloud); u.uDeep.value.multiplyScalar(1 - oc * 0.35); u.uShallow.value.lerp(u.uDeep.value, oc * 0.4);
    u.uTop.value.copy(skyMat.uniforms.uTop.value); u.uHor.value.copy(skyMat.uniforms.uHor.value);
    u.uLight.value.copy(ENV.lightDir); u.uLightCol.value.copy(sun.color).multiplyScalar(sun.intensity / 2.6 * (ENV.lightDir === ENV.sunDir ? 1 : 3));
    u.uDay.value = ENV.day + ENV.dusk * 0.5;
  }
  // lakes and rivers are darker and greener than the sea
  { const u = lakeMat.uniforms; u.uShallow.value.multiply(_lakeTint.setRGB(0.42, 0.62, 0.55)); u.uDeep.value.multiply(_lakeTint.setRGB(0.5, 0.66, 0.6)); }
  WEATHERSEA.k = 1 + WEATHER.wind * 0.9 + WEATHER.storm * 0.8; oceanMat.uniforms.uSea.value = WEATHERSEA.k;
  ocean.position.set(Math.round(camera.position.x / 3) * 3, 0, Math.round(camera.position.z / 3) * 3);
  // under water?
  const wl = waterAt(camera.position.x, camera.position.z);
  const wave = wl === 0 ? waveY(camera.position.x, camera.position.z, t) : 0;
  WATERVIEW.level = wl + wave; WATERVIEW.under = camera.position.y < wl + wave - 0.05 ? 1 : 0;
}
