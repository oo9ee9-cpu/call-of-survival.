/* ═════════ terrain: quadtree of chunks (2 m near you, 256 m at the horizon), photographic layers blended by biome, slope, height, rain and snow ═════════ */
const TERRAIN_LAYERS = ['grass', 'lush', 'dry', 'forest', 'needles', 'soil', 'cracked', 'sand', 'rock', 'gravel', 'snow', 'mud'];
const TEXA = { alb: null, nrm: null, maps: null, ids: null, ready: false };
const TERR_U = {
  uAlb: { value: null }, uNrm: { value: null }, uMaps: { value: null }, uIds: { value: null }, uDetail: { value: DETAIL },
  uWet: WET_U, uSnow: { value: 0 }, uTime: { value: 0 }, uRain: { value: 0 }, uTreeFar: { value: QUALITY.treeFar }, uDebug: { value: 0 }, uNight: { value: 0 },
};
const TERRAIN_MAT = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 });
ENV_HOOKS.push((env) => { TERR_U.uNight.value = env.night; });
TERRAIN_MAT.customProgramCacheKey = () => 'terrain5-' + QUALITY.tier + (TERR_OPT.vk ? 'v' : '') + (TERR_OPT.far ? 'f' : '');
// the climate under the ground (moisture, forest, warmth, and the smooth weights of fields, towns, roads, beaches…) changes over
// metres, not pixels: it is read once per vertex and handed to the pixels, instead of five texture reads in every pixel
const TERR_OPT = { vk: true, far: true };      // far: beyond 160 m one texture read per layer and no normal maps (mipmaps flatten them there anyway)
TERRAIN_MAT.onBeforeCompile = (sh) => {
  Object.assign(sh.uniforms, TERR_U);
  const VK = (TERR_OPT.vk ? '#define TERR_VK\n' : '') + (TERR_OPT.far ? '#define TERR_FAR\n' : '');
  sh.vertexShader = VK + sh.vertexShader
    .replace('#include <common>', `#include <common>
      varying vec3 vW; varying vec3 vNW;
      #ifdef TERR_VK
        uniform sampler2D uMaps, uIds; varying vec3 vMp; varying vec4 vK0, vK1, vK2; varying vec2 vK3;
      #endif`)
    .replace('#include <fog_vertex>', `#include <fog_vertex>
      vW = (modelMatrix * vec4(transformed, 1.0)).xyz; vNW = normalize(mat3(modelMatrix) * objectNormal);
      #ifdef TERR_VK
      {
        vMp = textureLod(uMaps, ${GL_MAPUV('vW.xz')}, 0.0).rgb;
        vec2 gcc = (vW.xz + ${GL_HALF}) / ${GL_STEP}; ivec2 gi = ivec2(floor(gcc)); vec2 gfr = gcc - vec2(gi);
        vK0 = vec4(0.0); vK1 = vec4(0.0); vK2 = vec4(0.0); vK3 = vec2(0.0);
        for (int q = 0; q < 4; q++) {
          ivec2 o = ivec2(q & 1, q >> 1); vec3 c = floor(texelFetch(uIds, clamp(gi + o, ivec2(0), ivec2(${GL_NI})), 0).rgb * 255.0 + 0.5);
          float wq = (o.x == 1 ? gfr.x : 1.0 - gfr.x) * (o.y == 1 ? gfr.y : 1.0 - gfr.y);
          vK0 += wq * vec4(float(c.g == 2.0), float(c.g == 1.0), float(c.g == 3.0 || c.r == 1.0), float(c.g == 4.0));
          vK1 += wq * vec4(float(c.g == 5.0), float(c.g == 7.0), float(c.r == 7.0), float(c.r == 8.0));
          vK2 += wq * vec4(float(c.r == 5.0), float(c.r == 10.0), float(c.r == 4.0), float(c.g == 8.0));
          vK3 += wq * vec2(float(c.g == 9.0), float(c.g == 10.0));
        }
      }
      #endif`);
  const HQ = QUALITY.tier >= 2 ? '#define TERRAIN_HQ\n' : '';
  const LQ = QUALITY.tier === 0 ? '#define TERRAIN_LQ\n' : '';
  sh.fragmentShader = 'precision highp sampler2DArray;\n' + HQ + LQ + VK + sh.fragmentShader
    .replace('#include <common>', `#include <common>
      uniform sampler2DArray uAlb, uNrm; uniform sampler2D uMaps, uIds, uDetail; uniform float uWet, uSnow, uTime, uRain, uTreeFar, uDebug, uNight;
      varying vec3 vW; varying vec3 vNW;
      #ifdef TERR_VK
        varying vec3 vMp; varying vec4 vK0, vK1, vK2; varying vec2 vK3;
      #endif
      vec3 tNrm; float tRough; float tWetK; vec3 tGlow;
      vec4 layerA(float L, vec2 uvA, vec2 uvB, float far){
        #ifdef TERR_FAR
          if (far > 0.995) return texture(uAlb, vec3(uvB, L));
        #endif
        vec4 a = texture(uAlb, vec3(uvA, L));
        #ifndef TERRAIN_LQ
          vec4 b = texture(uAlb, vec3(uvB, L)); a = mix(a, b, 0.35 + 0.5 * far);
        #endif
        return a;
      }
      vec3 layerN(float L, vec2 uvA, vec2 uvB, float far){
        vec3 a = texture(uNrm, vec3(uvA, L)).xyz;
        #ifdef TERRAIN_HQ
          vec3 b = texture(uNrm, vec3(uvB, L)).xyz; a = mix(a, b, 0.35 + 0.5 * far);
        #endif
        return a * 2.0 - 1.0;
      }
      // the same integer-hash value noise as vnoise() in the page script: wildflower fields line up with the flowers drawn near you
      float ihash(ivec2 p){ uint h = uint(p.x) * 374761393u ^ uint(p.y) * 668265263u; h = (h ^ (h >> 13u)) * 1274126177u; h ^= h >> 16u; return float(h) / 4294967296.0; }
      float vnoiseG(vec2 p){ vec2 i = floor(p), f = p - i; vec2 u = f * f * (3.0 - 2.0 * f); ivec2 c = ivec2(i);
        float a = ihash(c), b = ihash(c + ivec2(1, 0)), cc = ihash(c + ivec2(0, 1)), d = ihash(c + ivec2(1, 1));
        return a + (b - a) * u.x + (cc - a) * u.y + (a - b - cc + d) * u.x * u.y; }
      void top3(inout float w[12], out ivec3 id, out vec3 wt){
        id = ivec3(0); wt = vec3(0.0);
        for (int i = 0; i < 12; i++) {
          float v = w[i];
          if (v > wt.x) { wt.z = wt.y; id.z = id.y; wt.y = wt.x; id.y = id.x; wt.x = v; id.x = i; }
          else if (v > wt.y) { wt.z = wt.y; id.z = id.y; wt.y = v; id.y = i; }
          else if (v > wt.z) { wt.z = v; id.z = i; }
        }
      }`)
    .replace('#include <map_fragment>', `
      vec2 muv = ${GL_MAPUV('vW.xz')};
      #ifdef TERR_VK
        vec3 mp = vMp;
      #else
        vec3 mp = texture(uMaps, muv).rgb;           // moisture, forest, temperature
      #endif
      vec3 idv = floor(texture(uIds, muv).rgb * 255.0 + 0.5);   // biome, class, crop (nearest)
      float moist = mp.r, fdens = mp.g, temp = mp.b, biome = idv.r, cls = idv.g, crop = idv.b;
      // smooth indicator weights from the four surrounding cells: no staircase edges between classes and biomes
      #ifdef TERR_VK
      float kTown = vK0.x, kField = vK0.y, kBeach = vK0.z, kBank = vK0.w, kDune = vK1.x, kRoad = vK1.y, kDesert = vK1.z, kSwamp = vK1.w, kAlp = vK2.x, kIsle = vK2.y, kTaiga = vK2.z, kIce = vK2.w, kLava = vK3.x, kAsh = vK3.y;
      #else
      vec2 gcc = (vW.xz + ${GL_HALF}) / ${GL_STEP}; ivec2 gi = ivec2(floor(gcc)); vec2 gfr = gcc - vec2(gi);
      float kTown = 0.0, kField = 0.0, kBeach = 0.0, kBank = 0.0, kDune = 0.0, kRoad = 0.0, kDesert = 0.0, kSwamp = 0.0, kAlp = 0.0, kIsle = 0.0, kTaiga = 0.0, kIce = 0.0, kLava = 0.0, kAsh = 0.0;
      for (int q = 0; q < 4; q++) {
        ivec2 o = ivec2(q & 1, q >> 1); vec3 c = floor(texelFetch(uIds, clamp(gi + o, ivec2(0), ivec2(${GL_NI})), 0).rgb * 255.0 + 0.5);
        float wq = (o.x == 1 ? gfr.x : 1.0 - gfr.x) * (o.y == 1 ? gfr.y : 1.0 - gfr.y);
        kTown += wq * float(c.g == 2.0); kField += wq * float(c.g == 1.0); kBeach += wq * float(c.g == 3.0 || c.r == 1.0); kBank += wq * float(c.g == 4.0);
        kDune += wq * float(c.g == 5.0); kRoad += wq * float(c.g == 7.0); kDesert += wq * float(c.r == 7.0); kSwamp += wq * float(c.r == 8.0);
        kAlp += wq * float(c.r == 5.0); kIsle += wq * float(c.r == 10.0); kTaiga += wq * float(c.r == 4.0); kIce += wq * float(c.g == 8.0); kLava += wq * float(c.g == 9.0); kAsh += wq * float(c.g == 10.0);
      }
      #endif
      vec3 Ng = normalize(vNW); float slope = 1.0 - Ng.y;
      float dist = length(vW - cameraPosition);
      float far = smoothstep(30.0, 160.0, dist);
      vec4 mac = texture(uDetail, vW.xz * 0.0021);  // large-scale variation
      vec4 mac2 = texture(uDetail, vW.xz * 0.013 + 0.37);
      float n1 = mac.r, n2 = mac2.b;
      float w[12];
      for (int i = 0; i < 12; i++) w[i] = 0.0;
      // vegetated ground by moisture
      float dryk = smoothstep(0.42, 0.22, moist + (n1 - 0.5) * 0.18), lushk = smoothstep(0.62, 0.86, moist + (n2 - 0.5) * 0.12);
      w[0] = 1.0 - dryk - lushk * 0.7; w[1] = lushk; w[2] = dryk;
      // forest floors: broadleaf litter or needles in the cold
      float fk = smoothstep(0.28, 0.62, fdens + (n2 - 0.5) * 0.25);
      float cold = smoothstep(0.42, 0.3, temp) + kTaiga * 0.8;
      w[3] = fk * (1.0 - clamp(cold, 0.0, 1.0)); w[4] = fk * clamp(cold, 0.0, 1.0);
      w[0] *= 1.0 - fk * 0.8; w[1] *= 1.0 - fk * 0.8; w[2] *= 1.0 - fk * 0.8;
      // deserts, beaches and banks
      float desert = max(smoothstep(0.25, 0.75, kDesert + (n1 - 0.5) * 0.3), smoothstep(0.16, 0.06, moist) * smoothstep(0.42, 0.56, temp) * (1.0 - kTaiga) * (1.0 - kAlp));
      float dune = smoothstep(0.3, 0.7, kDune + (n2 - 0.5) * 0.3);
      w[7] += desert * (dune * 1.6 + (1.0 - dune) * 0.9 * smoothstep(0.35, 0.65, n1)); w[6] += desert * (1.0 - dune) * (1.0 - smoothstep(0.35, 0.65, n1));
      w[0] *= 1.0 - desert; w[1] *= 1.0 - desert; w[2] *= 1.0 - desert * 0.6;
      w[7] += 2.2 * smoothstep(0.3, 0.7, kBeach + (n2 - 0.5) * 0.35);
      float bank = smoothstep(0.25, 0.7, kBank + (n1 - 0.5) * 0.3); w[11] += bank * (0.9 + (n2 - 0.5)); w[5] += bank * 0.5;
      w[11] += kSwamp * 0.6 * smoothstep(0.4, 0.7, n1); w[1] += kSwamp * 0.4;
      // fields, towns, road shoulders
      float fieldK = smoothstep(0.35, 0.65, kField);
      if (fieldK > 0.0) { for (int i = 0; i < 12; i++) w[i] *= 1.0 - fieldK * 0.9; w[5] += 2.0 * fieldK; if (crop == 1.0 || crop == 8.0 || crop == 12.0) w[2] += 1.2 * far * fieldK; else if (crop != 7.0) w[0] += 1.0 * far * fieldK; }
      // town ground: trodden dry grass and earth, a little gravel; edges frayed by noise
      float townK = smoothstep(0.3, 0.75, kTown + (n1 - 0.5) * 0.35 + (n2 - 0.5) * 0.2);
      w[0] *= 1.0 - townK * 0.5; w[1] *= 1.0 - townK * 0.8; w[3] *= 1.0 - townK * 0.8; w[4] *= 1.0 - townK * 0.8;
      w[2] += townK * 0.7; w[5] += townK * 0.55 * smoothstep(0.35, 0.65, n2); w[9] += townK * 0.35 * (1.0 - smoothstep(0.3, 0.6, n2)); w[7] += townK * kDesert * 1.2;
      w[5] += kRoad * 0.3;   // the road ribbons carry the real surface
      // rock on steep ground and above the trees
      float rk = smoothstep(0.42, 0.72, slope + (n2 - 0.5) * 0.18) + kAlp * (0.6 + 0.4 * smoothstep(0.3, 0.7, n1)) + kIsle * 0.25 * smoothstep(0.4, 0.7, n1);
      w[8] += rk * 2.4;
      // snow above a line set by the climate, deeper in the cold, plus fresh snow from storms
      float snowLine = 300.0 + temp * 260.0 - uSnow * 220.0 + (n1 - 0.5) * 60.0;
      float sk = smoothstep(snowLine, snowLine + 45.0, vW.y) * (1.0 - smoothstep(0.55, 0.85, slope)) + uSnow * smoothstep(0.35, 0.15, temp) * (1.0 - smoothstep(0.4, 0.7, slope));
      // the cold north-east lies under snow all year (ploughed roads stay dark)
      float winter = smoothstep(0.40, 0.335, temp + (n1 - 0.5) * 0.05);
      sk = max(sk, winter * (1.0 - smoothstep(0.55, 0.85, slope)) * (1.0 - kRoad * 0.6));
      float iceK = smoothstep(0.3, 0.7, kIce);            // frozen lakes: clear blue ice with a little drifted snow
      w[10] += sk * 4.0 * (1.0 - iceK * (1.0 - 0.8 * smoothstep(0.6, 0.78, n2 + (n1 - 0.5) * 0.2)));
      // under water: sand and mud
      if (vW.y < 0.3) { w[7] += 3.0 * smoothstep(0.3, -1.5, vW.y); }
      for (int i = 0; i < 12; i++) w[i] = max(w[i], 0.0);
      ivec3 id; vec3 wt; top3(w, id, wt);
      #ifdef TERRAIN_LQ
        wt.z = 0.0;
      #endif
      vec2 uvA = vW.xz * 0.24, uvB = vW.xz * 0.061 + vec2(0.31, 0.77);
      vec4 a0 = layerA(float(id.x), uvA, uvB, far), a1 = layerA(float(id.y), uvA, uvB, far), a2 = wt.z > 0.02 ? layerA(float(id.z), uvA, uvB, far) : vec4(0.0);
      // rock gets triplanar on cliffs
      if (id.x == 8 && slope > 0.35) {
        vec3 bw = pow(abs(Ng), vec3(4.0)); bw /= bw.x + bw.y + bw.z;
        a0 = texture(uAlb, vec3(vW.zy * 0.16, 8.0)) * bw.x + texture(uAlb, vec3(vW.xz * 0.16, 8.0)) * bw.y + texture(uAlb, vec3(vW.xy * 0.16, 8.0)) * bw.z;
      }
      // height-aware blend: the brighter (higher) texel wins at the edges
      vec3 hb = wt * (vec3(dot(a0.rgb, vec3(0.33)), dot(a1.rgb, vec3(0.33)), dot(a2.rgb, vec3(0.33))) + 0.25);
      hb = pow(max(hb, vec3(0.0001)), vec3(3.0)); hb /= (hb.x + hb.y + hb.z);
      vec3 alb = a0.rgb * hb.x + a1.rgb * hb.y + a2.rgb * hb.z;
      alb = pow(alb, vec3(2.2));
      // far fields read as the colour of their crop
      if (fieldK > 0.01 && crop > 0.0) {
        vec3 cc = crop == 1.0 || crop == 8.0 ? vec3(0.3, 0.2, 0.065) : crop == 12.0 ? vec3(0.32, 0.25, 0.1) : crop == 2.0 || crop == 9.0 ? vec3(0.045, 0.095, 0.02) : crop == 3.0 ? vec3(0.2, 0.17, 0.02) : crop == 4.0 ? vec3(0.17, 0.19, 0.13) : crop == 10.0 ? vec3(0.07, 0.12, 0.025) : crop == 7.0 ? vec3(0.075, 0.048, 0.03) : vec3(0.05, 0.1, 0.022);
        cc *= 0.78 + 0.44 * n1;
        float rows = 0.5 + 0.5 * sin((mod(crop, 2.0) < 0.5 ? vW.x : vW.z) * 4.2);
        alb = mix(alb, cc * (0.8 + 0.3 * rows), (smoothstep(8.0, 70.0, dist) * 0.85 + 0.1) * fieldK * (1.0 - clamp(sk, 0.0, 1.0) * 0.93));   // under snow only faint furrows show
      }
      alb *= mix(0.74, 1.16, n1) * mix(0.88, 1.08, n2);
      // the volcano: dark ash on the flanks, lava in the crater and the flows (a black crust, glowing cracks, molten pools)
      tGlow = vec3(0.0);
      float ashK = smoothstep(0.25, 0.75, kAsh + (n2 - 0.5) * 0.3), lavaK = smoothstep(0.3, 0.7, kLava);
      if (ashK > 0.001) alb = mix(alb, vec3(0.032, 0.03, 0.029) * (0.75 + 0.5 * n1), ashK * 0.9);
      if (lavaK > 0.001) {
        float f1 = vnoiseG(vW.xz * 0.09 + vec2(uTime * 0.013, -uTime * 0.009)), f2 = vnoiseG(vW.xz * 0.37 - vec2(uTime * 0.03, uTime * 0.02));
        float molten = smoothstep(0.62, 0.76, f1 * 0.7 + f2 * 0.3 + (kLava - 1.0) * 0.3), crack = smoothstep(0.03, 0.0, abs(f2 - 0.5)) * (1.0 - molten);   // mostly black crust; the fire shows in pools and cracks
        float pulse = 0.75 + 0.25 * sin(uTime * 0.9 + f1 * 9.0);
        alb = mix(alb, mix(vec3(0.02, 0.016, 0.014), vec3(0.35, 0.08, 0.01), molten), lavaK);
        tGlow = (vec3(2.5, 0.6, 0.08) * molten * pulse + vec3(1.4, 0.3, 0.04) * crack) * lavaK * (0.5 + 0.5 * uNight);   // the glow tells most at night
      }
      if (iceK > 0.001 && id.x != 10) {
        // frozen water: dark clear ice in patches, milky ice around them, white cracks running through both
        float cr = smoothstep(0.03, 0.0, abs(vnoiseG(vW.xz * 0.09) - 0.5)) * 0.6 + smoothstep(0.018, 0.0, abs(vnoiseG(vW.xz * 0.31 + 4.0) - 0.5)) * 0.4;
        float clearI = smoothstep(0.38, 0.68, vnoiseG(vW.xz * 0.021 + vec2(2.0, 5.0)) + (n2 - 0.5) * 0.2);
        vec3 ice = mix(vec3(0.11, 0.2, 0.26), vec3(0.025, 0.06, 0.085), clearI) * mix(0.85, 1.15, n1);
        ice = mix(ice, vec3(0.5, 0.58, 0.62), clamp(cr, 0.0, 1.0) * 0.75);
        alb = mix(alb, ice, iceK);
      }
      // beyond the drawn road ribbons the roads stay visible as dark asphalt lines
      alb = mix(alb, vec3(0.04, 0.042, 0.046), smoothstep(${(ROAD_FAR * 0.8).toFixed(1)}, ${(ROAD_FAR * 0.95).toFixed(1)}, dist) * smoothstep(0.35, 0.75, kRoad) * 0.9);
      // meadows are never one green: yellowed and darker patches at every scale
      alb = mix(alb, alb * vec3(1.18, 1.02, 0.66), smoothstep(0.45, 0.8, mac.g) * 0.55 * (1.0 - desert));
      alb = mix(alb, alb * vec3(0.7, 0.8, 0.72), smoothstep(0.55, 0.85, mac2.r) * 0.5 * (1.0 - desert));
      // wildflower fields: from afar their colour lies on the ground (near you the flowers themselves stand in the grass)
      if (dist > 6.0 && (biome == 11.0 || biome == 6.0 || biome == 2.0)) {
        float fpk = smoothstep(0.66, 0.78, vnoiseG(vW.xz * 0.011 + vec2(7.7, -3.1)) + (n2 - 0.5) * 0.08) * (1.0 - smoothstep(0.25, 0.4, fdens)) * smoothstep(0.25, 0.35, moist)
          * (1.0 - townK) * (1.0 - fieldK) * (1.0 - kRoad) * (1.0 - desert) * (1.0 - winter);
        if (fpk > 0.001) {
          float q = vnoiseG(vW.xz * 0.0045 + vec2(1.3, 9.1));
          vec3 fc = q < 0.25 ? vec3(0.3, 0.05, 0.03) : q < 0.45 ? vec3(0.16, 0.11, 0.24) : q < 0.65 ? vec3(0.36, 0.38, 0.3) : q < 0.82 ? vec3(0.34, 0.3, 0.05) : vec3(0.22, 0.18, 0.12);
          alb = mix(alb, fc, fpk * 0.24 * smoothstep(8.0, 45.0, dist) * (0.6 + 0.8 * n1 * n2));
        }
      }
      // beyond the last drawn trees the forest is still there: a canopy colour on the ground
      float canopy = smoothstep(uTreeFar * 0.62, uTreeFar * 0.95, dist) * smoothstep(0.3, 0.62, fdens) * (1.0 - townK) * (1.0 - fieldK) * (1.0 - smoothstep(0.55, 0.85, slope));
      alb = mix(alb, mix(mix(vec3(0.03, 0.055, 0.025), vec3(0.02, 0.04, 0.03), clamp(cold, 0.0, 1.0)), vec3(0.3, 0.32, 0.35), winter * 0.8) * (0.8 + 0.4 * n2), canopy * 0.92 * (1.0 - winter * 0.55) * (1.0 - clamp(sk, 0.0, 1.0) * 0.6));
      // wet ground: darker, glossy, puddles on the flat
      float snowCov = clamp(sk, 0.0, 1.0);     // snow and ice do not puddle: falling snow keeps them white
      float puddle = uWet * smoothstep(0.1, 0.02, slope) * smoothstep(0.66, 0.74, mac2.g + (1.0 - moist) * 0.06) * (0.5 + townK * 0.6) * (1.0 - desert) * (1.0 - fk * 0.7) * (1.0 - snowCov) * (1.0 - iceK);
      tWetK = clamp(uWet * (1.0 - slope * 0.6) * (1.0 - desert * 0.7) * (1.0 - snowCov * 0.85), 0.0, 1.0);
      alb *= 1.0 - tWetK * 0.42 - puddle * 0.3;
      diffuseColor.rgb = alb;
      if (uDebug > 0.5) { int q = id.x; diffuseColor.rgb = q == 0 ? vec3(0.1, 0.5, 0.1) : q == 1 ? vec3(0.0, 0.8, 0.3) : q == 2 ? vec3(0.6, 0.6, 0.1) : q == 3 ? vec3(0.1, 0.25, 0.05) : q == 4 ? vec3(0.2, 0.1, 0.3) : q == 5 ? vec3(0.4, 0.2, 0.05) : q == 6 ? vec3(0.9, 0.4, 0.1) : q == 7 ? vec3(1.0, 0.9, 0.2) : q == 8 ? vec3(0.4, 0.4, 0.45) : q == 9 ? vec3(0.1, 0.1, 0.9) : q == 10 ? vec3(1.0, 1.0, 1.0) : vec3(0.9, 0.0, 0.9); diffuseColor.rgb = pow(diffuseColor.rgb, vec3(2.2)); }
      tRough = mix(0.97, 0.86, w[8] > 1.0 ? 1.0 : 0.0);
      tRough = mix(tRough, 0.5, tWetK); tRough = mix(tRough, 0.1, clamp(puddle * 2.0, 0.0, 1.0));
      if (id.x == 10) tRough = 0.62;
      tRough = mix(tRough, 0.32, iceK * (id.x == 10 ? 0.3 : 1.0));      // frosted, not a mirror: a glassy sheet only shows the sky
      tRough = mix(tRough, 0.95, ashK); tRough = mix(tRough, 0.55, lavaK);
      #ifndef TERRAIN_LQ
      #ifdef TERR_FAR
      if (far > 0.995 && puddle < 0.01) tNrm = Ng; else {
      #endif
        vec3 tn = layerN(float(id.x), uvA, uvB, far) * hb.x + layerN(float(id.y), uvA, uvB, far) * hb.y;
        if (wt.z > 0.02) tn += layerN(float(id.z), uvA, uvB, far) * hb.z;
        tn.xy *= (1.0 - far * 0.6) * (1.0 - clamp(puddle * 2.5, 0.0, 1.0)) * (1.0 - iceK * 0.55);
        // rain rings on the puddles
        if (uRain > 0.05 && puddle > 0.05 && dist < 40.0) {
          // every drop that lands opens a ring that runs outwards and fades: two layers of random cells
          vec2 rg = vec2(0.0);
          for (int k = 0; k < 2; k++) {
            vec2 q = vW.xz * 1.9 + float(k) * vec2(0.37, 0.71); vec2 ci = floor(q), f = fract(q) - 0.5;
            float h = fract(sin(dot(ci, vec2(127.1, 311.7)) + float(k) * 13.7) * 43758.5453);
            vec2 dd = f - (vec2(fract(h * 17.3), fract(h * 31.7)) - 0.5) * 0.5; float r = length(dd);
            float ph = fract(uTime * (0.9 + h * 0.6) + h * 7.0), x = (r - ph * 0.42) * 46.0;
            rg += dd / max(r, 1e-3) * (abs(x) < 3.1416 ? sin(x) : 0.0) * (1.0 - ph) * (1.0 - ph);
          }
          tn.xy += rg * 0.13 * uRain * smoothstep(0.2, 0.55, puddle) * (1.0 - smoothstep(12.0, 30.0, dist));
        }
        vec3 T = normalize(vec3(1.0, 0.0, 0.0) - Ng * Ng.x); vec3 B = cross(Ng, T);
        tNrm = normalize(Ng * max(tn.z, 0.2) + T * tn.x + B * tn.y);
      #ifdef TERR_FAR
      }
      #endif
      #else
        tNrm = Ng;
      #endif
    `)
    .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = tRough;')
    .replace('#include <normal_fragment_maps>', 'normal = normalize((viewMatrix * vec4(tNrm, 0.0)).xyz);')
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n      totalEmissiveRadiance += tGlow;');
};
ENV_MATS.push(TERRAIN_MAT);
async function loadTerrainTextures() {
  const sz = QUALITY.texSize;
  const [ia, inm] = await Promise.all([loadImage(`assets/tex/ter_albedo_${sz}.jpg`), loadImage(`assets/tex/ter_normal_${Math.min(sz, 512)}.jpg`)]);
  TEXA.alb = stripToArray(ia, TERRAIN_LAYERS.length); TEXA.nrm = stripToArray(inm, TERRAIN_LAYERS.length);
  // world maps as textures for the shader: RGB surface fields (smooth) and ids (nearest)
  const mk = (arr3, nearest) => {
    const d = new Uint8Array(WN * WN * 4);
    for (let i = 0; i < WN * WN; i++) { d[i * 4] = arr3[0][i]; d[i * 4 + 1] = arr3[1][i]; d[i * 4 + 2] = arr3[2][i]; d[i * 4 + 3] = 255; }
    const t = new THREE.DataTexture(d, WN, WN, THREE.RGBAFormat); t.minFilter = t.magFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.generateMipmaps = false; t.needsUpdate = true; return t;
  };
  TEXA.maps = mk([MOI, FOR, TMP], false); TEXA.ids = mk([BIO, CLS, CROP], true);
  try {
    // heights as half floats (filterable): the props' shader finds the ground under any wall
    const hd = new Uint16Array(WN * WN), toHalf = THREE.DataUtils.toHalfFloat;
    for (let i = 0; i < WN * WN; i++) hd[i] = toHalf(HM[i]);
    const ht = new THREE.DataTexture(hd, WN, WN, THREE.RedFormat, THREE.HalfFloatType);
    ht.minFilter = ht.magFilter = THREE.LinearFilter; ht.wrapS = ht.wrapT = THREE.ClampToEdgeWrapping; ht.generateMipmaps = false; ht.needsUpdate = true;
    TEXA.hgt = ht; HGT_U.value = ht;
  } catch (e) { console.warn('height texture', e); }
  CLIMATE_U.value = TEXA.maps;
  TERR_U.uAlb.value = TEXA.alb; TERR_U.uNrm.value = TEXA.nrm; TERR_U.uMaps.value = TEXA.maps; TERR_U.uIds.value = TEXA.ids;
  TEXA.ready = true;
}

/* ── chunks ── */
// the quadtree's root: the smallest power of two that covers the whole map
const TERRAIN_ROOT = 2 ** Math.ceil(Math.log2(WHALF * 2));
const TERRAIN = (() => {
  const RES = 32, VN = RES + 1, SK = VN * 4;          // grid vertices + skirt ring
  const NV = VN * VN + SK;
  // one index buffer shared by every chunk: the grid, then the skirt walls
  const idx = [];
  for (let j = 0; j < RES; j++) for (let i = 0; i < RES; i++) { const a = j * VN + i, b = a + 1, c = a + VN, d = c + 1; idx.push(a, c, b, b, c, d); }
  const ring = [];
  for (let i = 0; i < RES; i++) ring.push(i);                       // north edge, west → east
  for (let j = 0; j < RES; j++) ring.push(j * VN + RES);            // east edge
  for (let i = RES; i > 0; i--) ring.push(RES * VN + i);            // south edge
  for (let j = RES; j > 0; j--) ring.push(j * VN);                  // west edge
  for (let k = 0; k < ring.length; k++) { const a = ring[k], b = ring[(k + 1) % ring.length], sa = VN * VN + k, sb = VN * VN + (k + 1) % ring.length; idx.push(a, b, sa, b, sb, sa); }
  const INDEX = new THREE.BufferAttribute(new Uint16Array(idx), 1);
  const H = new Float32Array((VN + 2) * (VN + 2));
  const live = new Map(), queue = [], pool = [];
  let lastCx = 1e9, lastCz = 1e9, lastCy = 1e9, t = 0, root = null;
  const group = new THREE.Group(); scene.add(group);
  function build(node) {
    const size = node.size, x0 = node.x - size / 2, z0 = node.z - size / 2, st = size / RES;
    for (let j = -1; j <= VN; j++) for (let i = -1; i <= VN; i++) H[(j + 1) * (VN + 2) + i + 1] = terrainAt(x0 + i * st, z0 + j * st);
    let geo = pool.pop();
    if (!geo) {
      geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NV * 3), 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(NV * 3), 3));
      geo.setIndex(INDEX);
    }
    const P = geo.attributes.position.array, Nn = geo.attributes.normal.array;
    let hmin = 1e9, hmax = -1e9;
    for (let j = 0; j < VN; j++) for (let i = 0; i < VN; i++) {
      const k = j * VN + i, hh = H[(j + 1) * (VN + 2) + i + 1];
      P[k * 3] = x0 + i * st; P[k * 3 + 1] = hh; P[k * 3 + 2] = z0 + j * st;
      const hx = H[(j + 1) * (VN + 2) + i + 2] - H[(j + 1) * (VN + 2) + i], hz = H[(j + 2) * (VN + 2) + i + 1] - H[j * (VN + 2) + i + 1];
      const nl = Math.hypot(hx, 2 * st, hz); Nn[k * 3] = -hx / nl; Nn[k * 3 + 1] = 2 * st / nl; Nn[k * 3 + 2] = -hz / nl;
      if (hh < hmin) hmin = hh; if (hh > hmax) hmax = hh;
    }
    const drop = Math.max(2, st * 1.5);
    for (let k = 0; k < ring.length; k++) {
      const a = ring[k], s = VN * VN + k;
      P[s * 3] = P[a * 3]; P[s * 3 + 1] = P[a * 3 + 1] - drop; P[s * 3 + 2] = P[a * 3 + 2];
      Nn[s * 3] = Nn[a * 3]; Nn[s * 3 + 1] = Nn[a * 3 + 1]; Nn[s * 3 + 2] = Nn[a * 3 + 2];
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.normal.needsUpdate = true;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(node.x, (hmin + hmax) / 2, node.z), Math.hypot(size * 0.71, (hmax - hmin) / 2 + drop));
    let mesh = node.mesh;
    // the ground is drawn after everything standing on it: wherever grass, trees, walls or people cover it, its costly pixels are skipped
    if (!mesh) { mesh = new THREE.Mesh(geo, TERRAIN_MAT); mesh.matrixAutoUpdate = false; mesh.updateMatrix(); mesh.renderOrder = 40; node.mesh = mesh; }
    else mesh.geometry = geo;
    mesh.receiveShadow = true; mesh.castShadow = QUALITY.shadows && size <= 128;
    node.hmin = hmin; node.hmax = hmax;
    return mesh;
  }
  function wanted(cx, cy, cz) {
    const out = [];
    const visit = (x, z, size) => {
      if (Math.abs(x) - size / 2 > WHALF || Math.abs(z) - size / 2 > WHALF) return;
      const dx = Math.max(0, Math.abs(cx - x) - size / 2), dz = Math.max(0, Math.abs(cz - z) - size / 2);
      const d = Math.hypot(dx, dz, Math.max(0, cy - 120) * 0.5);
      if (d > camera.far + size) return;
      if (size > QUALITY.terrainMin && d < size * QUALITY.terrainK) { const q = size / 4; visit(x - q, z - q, size / 2); visit(x + q, z - q, size / 2); visit(x - q, z + q, size / 2); visit(x + q, z + q, size / 2); return; }
      out.push({ key: size + ':' + x + ':' + z, x, z, size, d });
    };
    visit(0, 0, TERRAIN_ROOT);
    return out;
  }
  function deepSea(node) {
    // skip chunks that lie entirely under deep water (the ocean shader draws the sea floor tint)
    const s = node.size, x0 = node.x - s / 2, z0 = node.z - s / 2;
    // (raised by the world editor, the sea floor can come up into an island)
    const hf = EDT.n || EDP.n || EDS.n ? terrainAt : hBase;
    for (let j = 0; j <= 4; j++) for (let i = 0; i <= 4; i++) if (hf(x0 + s * i / 4, z0 + s * j / 4) > -14) return false;
    return true;
  }
  return {
    group,
    get count() { return live.size; },
    update(dt, cx, cy, cz, force) {
      t -= dt;
      if (force || t <= 0 || Math.hypot(cx - lastCx, cz - lastCz) > 8 || Math.abs(cy - lastCy) > 20) {
        t = 0.3; lastCx = cx; lastCz = cz; lastCy = cy;
        const want = wanted(cx, cy, cz), keys = new Set();
        for (const n of want) {
          keys.add(n.key);
          const cur = live.get(n.key);
          if (cur) { cur.d = n.d; continue; }
          if (!queue.some((q) => q.key === n.key)) queue.push(n);
        }
        for (let i = queue.length - 1; i >= 0; i--) if (!keys.has(queue[i].key)) queue.splice(i, 1);
        queue.sort((a, b) => a.d - b.d);
        // drop chunks nobody wants once their area is covered by built replacements
        for (const [k, node] of live) {
          if (keys.has(k)) continue;
          const pending = queue.some((q) => Math.abs(q.x - node.x) < (q.size + node.size) / 2 && Math.abs(q.z - node.z) < (q.size + node.size) / 2);
          if (pending) continue;
          group.remove(node.mesh); if (node.mesh.geometry) pool.push(node.mesh.geometry); live.delete(k);
        }
      }
      // build within a time budget
      const t0 = nowMs(), budget = force ? 1e9 : 5;
      while (queue.length && nowMs() - t0 < budget) {
        const n = queue.shift();
        if (deepSea(n)) { live.set(n.key, Object.assign(n, { mesh: new THREE.Object3D(), sea: true })); continue; }
        const m = build(n); live.set(n.key, n); group.add(m);
      }
    },
    /* rebuild chunks touching an area (after digging) */
    dirtyArea(x, z, r) {
      for (const [k, n] of live) {
        if (n.sea) { if (Math.abs(n.x - x) < n.size / 2 + r && Math.abs(n.z - z) < n.size / 2 + r && !deepSea(n)) { group.remove(n.mesh); n.sea = false; n.mesh = null; group.add(build(n)); } continue; }
        if (Math.abs(n.x - x) < n.size / 2 + r && Math.abs(n.z - z) < n.size / 2 + r) { const old = n.mesh.geometry; build(n); if (old && old !== n.mesh.geometry) pool.push(old); }
      }
    },
    busy() { return queue.length; },
  };
})();
