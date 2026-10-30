/* ═════════ the picture: rain and snow falling around you, then post — bloom, sun shafts through the trees,
   the bodycam lens, drops on the glass, grading — and a render scale that follows the frame rate ═════════ */
const RAIN = (() => {
  const N = qsel(2600, 5200, 9000, 14000), B = new THREE.Vector3(36, 26, 36);
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const seed = new Float32Array(N * 4), r = RNG(91);
  for (let i = 0; i < N; i++) { seed[i * 4] = r(); seed[i * 4 + 1] = r(); seed[i * 4 + 2] = r(); seed[i * 4 + 3] = r(); }
  g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4));
  g.instanceCount = 0;
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: { uTime: { value: 0 }, uBox: { value: B }, uCam: { value: new THREE.Vector3() }, uWind: { value: new THREE.Vector2() }, uSnow: { value: 0 }, uSand: { value: 0 }, uCol: { value: new THREE.Color() }, uAlpha: { value: 0 } },
    vertexShader: `attribute vec4 aSeed; uniform float uTime, uSnow, uSand; uniform vec3 uBox, uCam; uniform vec2 uWind; varying vec2 vUv; varying float vFade;
      void main(){
        float speed = mix(mix(mix(7.5, 10.5, aSeed.w), mix(0.9, 1.6, aSeed.w), uSnow), mix(-0.4, 1.0, aSeed.w), uSand);
        float gust = 1.0 + uSand * (9.0 + 4.0 * aSeed.y);              // sand is carried sideways by the wind
        vec3 vel = vec3(uWind.x * gust, -speed, uWind.y * gust);
        vec3 p = fract(aSeed.xyz + vec3(0.0, -uTime * speed / uBox.y, 0.0) + vec3(uWind.x, 0.0, uWind.y) * gust * uTime / uBox.x * 0.3 - uCam / uBox) * uBox - uBox * 0.5 + uCam;
        p.y -= uSand * uBox.y * 0.32 * aSeed.z;                          // most of it low over the ground
        p.x += sin(uTime * 1.3 + aSeed.w * 30.0) * 0.4 * uSnow; p.z += cos(uTime * 1.1 + aSeed.x * 20.0) * 0.4 * uSnow;
        vec3 dir = normalize(vel), toCam = normalize(cameraPosition - p), side = normalize(cross(dir, toCam));
        float len = mix(mix(0.022 * speed + 0.25, 0.035, uSnow), 0.55 + aSeed.x * 0.5, uSand), wid = mix(mix(0.012, 0.035, uSnow), 0.016, uSand);
        vec3 wp = p + side * position.x * wid + dir * (position.y - 0.5) * len;
        vUv = position.xy + vec2(0.5, 0.0);
        float d = length(cameraPosition - p); vFade = smoothstep(0.4, 2.0, d) * (1.0 - smoothstep(uBox.x * 0.32, uBox.x * 0.5, d));
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`,
    fragmentShader: `uniform vec3 uCol; uniform float uAlpha, uSnow; varying vec2 vUv; varying float vFade;
      void main(){
        float a = (1.0 - abs(vUv.x - 0.5) * 2.0);
        a *= mix(smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.6, vUv.y), 1.0 - smoothstep(0.3, 0.5, length(vUv - 0.5)), uSnow);
        gl_FragColor = vec4(uCol, a * uAlpha * vFade);
      }`,
  });
  const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = 5; scene.add(mesh);
  return {
    update(dt, t) {
      const W = WEATHER, dust = W.dust || 0, amount = Math.max(W.rain, dust * 0.9) * (1 - WATERVIEW.under);
      const under = player.inside && started ? 0.08 : 1;
      g.instanceCount = Math.round(N * clamp(amount * 1.25, 0, 1));
      mesh.visible = g.instanceCount > 0;
      if (!mesh.visible) return;
      const u = mat.uniforms, sand = dust > W.rain ? 1 : 0; u.uTime.value = t; u.uCam.value.copy(camera.position); u.uSnow.value = sand ? 0 : W.snow; u.uSand.value = sand;
      u.uWind.value.set(Math.cos(t * 0.05) * W.wind * 3.5, Math.sin(t * 0.04) * W.wind * 2.5);
      // flakes are white, drops a pale grey-blue, both lit by the day; the fog tints them a little
      const lit = 0.18 + 0.82 * Math.max(ENV.day, ENV.dusk * 0.6) * (1 - W.storm * 0.25);
      if (sand) u.uCol.value.setRGB(0.62 * lit, 0.43 * lit, 0.24 * lit);
      else if (W.snow > 0.5) u.uCol.value.setRGB(0.92 * lit, 0.94 * lit, 0.97 * lit); else u.uCol.value.setRGB(0.72 * lit, 0.77 * lit, 0.82 * lit);
      u.uCol.value.lerp(scene.fog.color, 0.25);
      u.uAlpha.value = (sand ? 0.34 * dust : W.snow > 0.5 ? 0.7 : 0.26 + 0.18 * W.storm) * under;
    },
  };
})();

/* rain hitting the ground around you: a ring opening on the surface and a little crown of spray, on every floor, road,
   roof and pond the drops can reach (none indoors, none in the snow) */
const SPLASH = (() => {
  const N = qsel(0, 140, 260, 420), LIFE = 0.36;
  if (!N) return { update() {} };
  const P = [], K = [], I = [];
  for (let k = 0; k < 2; k++) { const b = P.length / 3; P.push(-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5); K.push(k, k, k, k); I.push(b, b + 1, b + 2, b, b + 2, b + 3); }
  const g = new THREE.InstancedBufferGeometry(); g.setIndex(I);
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aK', new THREE.Float32BufferAttribute(K, 1));
  const pos = new Float32Array(N * 4); for (let i = 0; i < N; i++) pos[i * 4 + 3] = -99;
  const attr = new THREE.InstancedBufferAttribute(pos, 4).setUsage(THREE.DynamicDrawUsage); g.setAttribute('iP', attr);
  g.instanceCount = N;
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: { uTime: { value: 0 }, uCol: { value: new THREE.Color() }, uA: { value: 0 } },
    vertexShader: `attribute float aK; attribute vec4 iP; uniform float uTime; varying vec2 vUv; varying float vAge; varying float vK;
      void main(){
        float age = (uTime - iP.w) / ${LIFE.toFixed(2)}; vAge = clamp(age, 0.0, 1.0); vK = aK; vUv = position.xz + 0.5;
        vec3 c = iP.xyz, wp;
        if (aK < 0.5) { float s = 0.05 + vAge * 0.2; wp = c + vec3(position.x * s * 2.0, 0.012, position.z * s * 2.0); }
        else { vec3 toC = cameraPosition - c; vec3 rt = normalize(vec3(toC.z, 0.0, -toC.x) + vec3(1e-4, 0.0, 0.0)); float s = 0.045 + vAge * 0.07;
          wp = c + rt * position.x * s * 2.4 + vec3(0.0, (position.z + 0.5) * (0.03 + 0.11 * sin(vAge * 3.1416)), 0.0); }
        gl_Position = (age < 0.0 || age >= 1.0) ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`,
    fragmentShader: `uniform vec3 uCol; uniform float uA; varying vec2 vUv; varying float vAge; varying float vK;
      void main(){
        float a;
        if (vK < 0.5) { float r = length(vUv - 0.5) * 2.0; a = smoothstep(0.6, 0.85, r) * smoothstep(1.0, 0.88, r) * (1.0 - vAge) * 0.8; }
        else { float x = abs(vUv.x - 0.5) * 2.0; a = smoothstep(0.55, 1.0, abs(sin(vUv.x * 15.7))) * (1.0 - x) * smoothstep(1.0, 0.25, vUv.y) * (1.0 - vAge); }
        gl_FragColor = vec4(uCol, a * uA);
      }`,
  });
  const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = 5; mesh.visible = false; scene.add(mesh);
  let next = 0, carry = 0, off = false; const _f = new THREE.Vector3();
  return {
    set off(v) { off = v; },
    update(dt, t) {
      const W = WEATHER, amount = W.rain * (1 - W.snow) * (1 - WATERVIEW.under) * (started && !player.inside ? 1 : 0);
      mesh.visible = amount > 0.05 && !off; if (!mesh.visible) return;
      const u = mat.uniforms; u.uTime.value = t;
      const lit = 0.25 + 0.75 * Math.max(ENV.day, ENV.dusk * 0.6);
      u.uCol.value.setRGB(0.78 * lit, 0.82 * lit, 0.86 * lit); u.uA.value = 0.5 + 0.3 * W.storm;
      // new splashes each frame, more of them in front of you where you can see them
      carry += N / LIFE * amount * dt; let n = Math.min(N, Math.floor(carry)); carry -= n;
      if (!n) return;
      camera.getWorldDirection(_f); const cx = camera.position.x + _f.x * 5, cz = camera.position.z + _f.z * 5, top = camera.position.y + 4;
      for (let k = 0; k < n; k++) {
        const i = next; next = (next + 1) % N;
        const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * 10, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
        const gy = groundAt(x, z, top), wl = waterAt(x, z), y = Math.max(gy, wl > -1e8 ? wl : -1e9);
        pos[i * 4] = x; pos[i * 4 + 1] = y + 0.01; pos[i * 4 + 2] = z; pos[i * 4 + 3] = t - Math.random() * 0.05;
      }
      attr.needsUpdate = true;
    },
  };
})();
/* contact shade: a soft dark ellipse under every car, animal and person, lying on the ground's slope —
   grounds them where the sun's shadow map does not reach (and on phones without shadows at all) */
const BLOBS = (() => {
  const N = 140, quad = new THREE.PlaneGeometry(1, 1); quad.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    uniforms: { uA: { value: QUALITY.shadows ? 0.42 : 0.6 } },
    // instanceColor and instanceMatrix are declared by three's instancing prefix
    vertexShader: `varying vec2 vUv; varying float vA; void main(){ vUv = uv; vA = instanceColor.r; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uA; varying vec2 vUv; varying float vA; void main(){ float r = length(vUv * 2.0 - 1.0); float a = 1.0 - smoothstep(0.15, 1.0, r); gl_FragColor = vec4(0.0, 0.0, 0.0, a * a * uA * vA); }`,
  });
  const mesh = new THREE.InstancedMesh(quad, mat, N); mesh.count = 0; mesh.frustumCulled = false; mesh.renderOrder = 1;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3).setUsage(THREE.DynamicDrawUsage);
  scene.add(mesh);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _n = new THREE.Vector3(), _c = new THREE.Color();
  let n = 0;
  const put = (x, y, z, yaw, len, wid, a) => {
    if (n >= N) return;
    const cx = camera.position.x - x, cz = camera.position.z - z; if (cx * cx + cz * cz > 140 * 140) return;
    const g = groundAt(x, z, y + 0.6); if (y - g > 2.5) return;           // high in the air: no shade on the ground
    const e = 0.7, hx = terrainAt(x + e, z) - terrainAt(x - e, z), hz = terrainAt(x, z + e) - terrainAt(x, z - e);
    _n.set(-hx, 2 * e, -hz).normalize(); _q.setFromUnitVectors(UP, _n); _q2.setFromAxisAngle(UP, yaw); _q.multiply(_q2);
    _m.compose(_p.set(x, g + 0.04, z), _q, _s.set(wid, 1, len)); mesh.setMatrixAt(n, _m);
    mesh.setColorAt(n, _c.setRGB(a * clamp(1 - (y - g) / 2.5, 0, 1), 0, 0)); n++;
  };
  return {
    update() {
      n = 0;
      if (started && player.alive && !player.vehicle && !player.swimming) put(player.pos.x, player.pos.y, player.pos.z, player.yaw, 0.9, 0.7, 0.9);
      if (LOBBY.on && LOBBY.body && LOBBY.body.root.visible) { const r = LOBBY.body.root; put(r.position.x, r.position.y, r.position.z, r.rotation.y, 0.95, 0.75, 0.95); }
      for (const v of VEHICLES) { if (v.spec.water || v.spec.horse || v.spec.rail) continue; put(v.pos.x, v.pos.y, v.pos.z, v.yaw, (v.spec.wb || 2.5) + 1.7, (v.spec.track || 1.6) + 0.5, 1); }
      for (const a of ANIMALS) if (a.active && a.state !== 'dead' && a.root && a.root.visible) put(a.x, a.y, a.z, a.yaw, a.S.len * 1.05, a.S.r * 1.3, 0.9);
      for (const b of BOTS) if (b.active && b.state !== 'dead') put(b.x, b.y, b.z, b.yaw || 0, 0.9, 0.7, 0.9);
      for (const z of ZOMBIES) if (z.active && z.state !== 'dead') put(z.x, z.y, z.z, z.yaw || 0, 0.9, 0.7, 0.9);
      mesh.count = n; mesh.visible = n > 0;
      if (n) { mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; }
    },
  };
})();
/* sun beams in the woods: soft shafts of light leaning toward the sun, where the canopy breaks */
const BEAMS = (() => {
  const N = qsel(0, 8, 14, 20);
  if (!N) return { update() {} };
  const P = [], U = [], I = [];
  for (let k = 0; k < 2; k++) { const a = k * Math.PI / 2, cx = Math.cos(a) * 0.5, cz = Math.sin(a) * 0.5, b = P.length / 3; P.push(-cx, 0, -cz, cx, 0, cz, cx, 1, cz, -cx, 1, -cz); U.push(0, 0, 1, 0, 1, 1, 0, 1); I.push(b, b + 1, b + 2, b, b + 2, b + 3); }
  const g = new THREE.BufferGeometry(); g.setIndex(I); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uCol: { value: new THREE.Color() }, uA: { value: 0 }, uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; varying float vD; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vD = length(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform vec3 uCol; uniform float uA, uTime; varying vec2 vUv; varying float vD; varying vec3 vW;
      void main(){
        float edge = sin(vUv.x * 3.14159); edge *= edge;
        float along = smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.5, vUv.y);
        float dust = 0.78 + 0.22 * sin(vW.y * 2.3 + uTime * 0.6 + vW.x * 1.7) * sin(vW.z * 1.9 - uTime * 0.4);
        float near = smoothstep(1.5, 7.0, vD) * (1.0 - smoothstep(40.0, 65.0, vD));
        gl_FragColor = vec4(uCol * edge * along * dust * near * uA, 1.0);
      }`,
  });
  const beams = [];
  for (let i = 0; i < N; i++) { const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.visible = false; m.renderOrder = 6; scene.add(m); beams.push({ m, x: 1e9, z: 1e9, life: 0 }); }
  return {
    update(dt, time) {
      const s = ENV.sunDir, here = started ? forestAt(player.pos.x, player.pos.z) : 0;
      const want = started && ENV.sunVis > 0.15 && s.y > 0.12 && s.y < 0.8 ? clamp(here * 1.8 - 0.45, 0, 1) * ENV.sunVis * (1 - WEATHER.rain) : 0;
      const u = mat.uniforms; u.uA.value = damp(u.uA.value, want * (0.13 + WEATHER.fog * 0.12), 1.2, dt);
      u.uCol.value.copy(sun.color).lerp(_beamWarm, 0.35); u.uTime.value = time;
      if (u.uA.value < 0.002) { for (const b of beams) b.m.visible = false; return; }
      for (const b of beams) {
        b.life -= dt;
        if (b.life > 0 && Math.hypot(b.x - player.pos.x, b.z - player.pos.z) < 55) continue;
        const a = rr(0, TAU), r = rr(5, 38); b.x = player.pos.x + Math.cos(a) * r; b.z = player.pos.z + Math.sin(a) * r; b.life = rr(12, 28);
        const w = rr(0.8, 2.8), gy = terrainAt(b.x, b.z);
        b.m.position.set(b.x, gy - 0.3, b.z); b.m.quaternion.setFromUnitVectors(UP, s); b.m.scale.set(w, rr(18, 28), w);
        b.m.visible = forestAt(b.x, b.z) > 0.35 && gy > waterAt(b.x, b.z);
      }
    },
  };
})();
const _beamWarm = new THREE.Color(1.0, 0.86, 0.6);

const POST = (() => {
  let on = QUALITY.post, rt = null, bA = null, bB = null, rA = null, fpp = 0, rays = 0, lens = 0;
  const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const scn = new THREE.Scene(), oc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false; scn.add(quad);
  const mk = (uniforms, fs) => new THREE.ShaderMaterial({ uniforms, vertexShader: VS, fragmentShader: fs, depthTest: false, depthWrite: false, toneMapped: false });
  const bright = mk({ tIn: { value: null }, uTexel: { value: new THREE.Vector2() } }, `uniform sampler2D tIn; uniform vec2 uTexel; varying vec2 vUv;
    void main(){ vec3 c = texture2D(tIn, vUv + uTexel * vec2(-1.0, -1.0)).rgb + texture2D(tIn, vUv + uTexel * vec2(1.0, -1.0)).rgb
      + texture2D(tIn, vUv + uTexel * vec2(-1.0, 1.0)).rgb + texture2D(tIn, vUv + uTexel * vec2(1.0, 1.0)).rgb; c *= 0.25;
      float l = max(c.r, max(c.g, c.b)); if (!(l < 65000.0)) { c = vec3(0.0); l = 0.0; }    // a NaN from any one model must not spread through the bloom
      gl_FragColor = vec4(c * smoothstep(0.72, 1.0, l), 1.0); }`);
  const blur = mk({ tIn: { value: null }, uDir: { value: new THREE.Vector2() } }, `uniform sampler2D tIn; uniform vec2 uDir; varying vec2 vUv;
    void main(){ vec3 c = texture2D(tIn, vUv).rgb * 0.227;
      c += (texture2D(tIn, vUv + uDir * 1.385).rgb + texture2D(tIn, vUv - uDir * 1.385).rgb) * 0.316;
      c += (texture2D(tIn, vUv + uDir * 3.231).rgb + texture2D(tIn, vUv - uDir * 3.231).rgb) * 0.07;
      gl_FragColor = vec4(c, 1.0); }`);
  // sun shafts: march from each pixel toward the sun on screen, gathering the bright sky that shows through the leaves
  const RAY_N = qsel(16, 20, 28, 36);
  const shafts = mk({ tIn: { value: null }, uSun: { value: new THREE.Vector2(0.5, 0.5) }, uAsp: { value: 1 } }, `uniform sampler2D tIn; uniform vec2 uSun; uniform float uAsp; varying vec2 vUv;
    float sky(vec2 uv){ vec3 c = texture2D(tIn, uv).rgb; float l = dot(c, vec3(0.299, 0.587, 0.114)); float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
      return smoothstep(0.66, 0.95, l) * (1.0 - smoothstep(0.25, 0.5, sat)) * step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0); }
    void main(){
      vec2 d = (uSun - vUv); float dl = length(d * vec2(uAsp, 1.0));
      vec2 stepv = d / float(${RAY_N}) * 0.95;
      vec2 uv = vUv + stepv * fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453);
      float acc = 0.0, w = 1.0;
      for (int i = 0; i < ${RAY_N}; i++) { acc += sky(uv) * w; w *= 0.955; uv += stepv; }
      acc /= float(${RAY_N});
      gl_FragColor = vec4(vec3(acc * exp(-dl * 2.4)), 1.0);
    }`);
  const comp = mk({ tScene: { value: null }, tBloom: { value: null }, tRays: { value: null }, uBloom: { value: 0 }, uRays: { value: 0 }, uRayCol: { value: new THREE.Color() }, uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 }, uFpp: { value: 0 }, uNight: { value: 0 }, uGrain: { value: 0.03 }, uVig: { value: 0.5 },
    uLens: { value: 0 }, uWet: { value: 0 }, uGrade: { value: new THREE.Vector4(1.06, 1.0, 0, 0) }, uTint: { value: new THREE.Color(1, 1, 1) }, uFade: { value: 0 }, uFxaa: { value: QUALITY.fxaa ? 1 : 0 }, uCB: { value: 0 } },
    `uniform sampler2D tScene, tBloom, tRays; uniform float uBloom, uRays, uTime, uFpp, uNight, uGrain, uVig, uLens, uWet, uFade, uFxaa, uCB; uniform vec3 uRayCol, uTint; uniform vec4 uGrade; uniform vec2 uRes; varying vec2 vUv;
    // colour-blind help: simulate what the eye loses, then move that difference into the channels it still sees
    vec3 daltonize(vec3 c, float m){
      vec3 L = vec3(17.8824 * c.r + 43.5161 * c.g + 4.11935 * c.b, 3.45565 * c.r + 27.1554 * c.g + 3.86714 * c.b, 0.0299566 * c.r + 0.184309 * c.g + 1.46709 * c.b), s = L;
      if (m < 1.5) s.x = 2.02344 * L.y - 2.52581 * L.z; else if (m < 2.5) s.y = 0.494207 * L.x + 1.24827 * L.z; else s.z = -0.395913 * L.x + 0.801109 * L.y;
      vec3 sim = vec3(0.0809444479 * s.x - 0.130504409 * s.y + 0.116721066 * s.z, -0.0102485335 * s.x + 0.0540193266 * s.y - 0.113614708 * s.z, -0.000365296938 * s.x - 0.00412161469 * s.y + 0.693511405 * s.z);
      vec3 e = c - sim;
      return clamp(c + (m < 2.5 ? vec3(0.0, 0.7 * e.r + e.g, 0.7 * e.r + e.b) : vec3(e.r + 0.7 * e.b, e.g + 0.7 * e.b, 0.0)), 0.0, 1.0);
    }
    float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    vec3 fxaa(vec2 uv){
      vec2 px = 1.0 / uRes; vec3 c = texture2D(tScene, uv).rgb;
      if (uFxaa < 0.5) return c;
      vec3 L = vec3(0.299, 0.587, 0.114);
      float lM = dot(c, L), lN = dot(texture2D(tScene, uv + vec2(0.0, px.y)).rgb, L), lS = dot(texture2D(tScene, uv - vec2(0.0, px.y)).rgb, L), lE = dot(texture2D(tScene, uv + vec2(px.x, 0.0)).rgb, L), lW = dot(texture2D(tScene, uv - vec2(px.x, 0.0)).rgb, L);
      float mn = min(lM, min(min(lN, lS), min(lE, lW))), mx = max(lM, max(max(lN, lS), max(lE, lW)));
      if (mx - mn < max(0.04, mx * 0.12)) return c;
      vec2 dir = vec2(-((lN + lS) - (lE + lW)), (lN + lE) - (lS + lW)); dir = normalize(dir + 1e-5) * px * 1.2;
      return (texture2D(tScene, uv + dir * 0.5).rgb + texture2D(tScene, uv - dir * 0.5).rgb + c * 2.0) * 0.25;
    }
    vec2 drops(vec2 uv, float t){
      // a few rain drops sitting on the lens, each a small lens of its own
      vec2 g = uv * vec2(uRes.x / uRes.y, 1.0) * 7.0, id = floor(g), f = fract(g) - 0.5;
      float r = h12(id + floor(t * 0.2 + h12(id) * 5.0)); if (r > 0.18) return vec2(0.0);
      vec2 c = (vec2(h12(id + 3.1), h12(id + 7.7)) - 0.5) * 0.6; float s = 0.12 + r * 0.6;
      vec2 q = f - c; float d = length(q); float m = smoothstep(s, s * 0.7, d);
      return q * m * 0.25;
    }
    void main(){
      float asp = uRes.x / uRes.y; vec2 c = vUv - 0.5, cc = vec2(c.x * asp, c.y); float r2 = dot(cc, cc);
      float k = 0.14 * uFpp, norm = 1.0 + k * 0.25 * asp * asp;
      vec2 suv = c * (1.0 + k * r2) / norm + 0.5;
      if (uLens > 0.01) suv += drops(vUv, uTime) * uLens;
      vec2 ca = c * (0.0012 + 0.0042 * uFpp) * (0.35 + r2 * 2.2);
      vec3 col = fxaa(suv); col.r = mix(col.r, texture2D(tScene, suv + ca).r, 0.8); col.b = mix(col.b, texture2D(tScene, suv - ca).b, 0.8);
      float inside = step(0.0, suv.x) * step(0.0, suv.y) * step(suv.x, 1.0) * step(suv.y, 1.0);
      col *= inside;
      col += texture2D(tBloom, suv).rgb * uBloom * inside;
      col += uRayCol * texture2D(tRays, suv).r * uRays * inside;
      // grading: a gentle film curve, saturation and the tint of the weather
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(l), col, uGrade.y - uFpp * 0.16);
      col = (col - 0.5) * (uGrade.x + uFpp * 0.07) + 0.5;
      col *= uTint;
      col *= mix(vec3(1.0), vec3(0.96, 1.0, 1.05), uFpp);
      col = mix(col, col * vec3(0.9, 1.0, 0.95) + vec3(0.012, 0.018, 0.014), uNight * uFpp * 0.8);
      float n = h12(gl_FragCoord.xy + fract(uTime * 7.31) * 913.0) - 0.5;
      col += n * (uGrain + uNight * 0.045 * (0.4 + uFpp)) * (1.2 - l * 0.6);
      float v = smoothstep(1.05, 0.28, length(c * vec2(asp * 0.78, 1.0)) * (1.0 + uFpp * 0.3));
      col *= mix(1.0, v, uVig);
      col *= 1.0 - uFade;
      col = clamp(col, 0.0, 1.0);
      if (uCB > 0.5) col = daltonize(col, uCB);
      gl_FragColor = vec4(col, 1.0);
    }`);
  const size = new THREE.Vector2();
  function target(w, h, samples) {
    const o = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, depthBuffer: samples >= 0, stencilBuffer: false };
    let t;
    if (samples > 0 && renderer.capabilities.isWebGL2 && THREE.WebGLMultisampleRenderTarget) { t = new THREE.WebGLMultisampleRenderTarget(w, h, o); t.samples = samples; }
    else t = new THREE.WebGLRenderTarget(w, h, o);
    t.texture.generateMipmaps = false; return t;
  }
  function build() {
    renderer.getDrawingBufferSize(size);
    const w = Math.max(2, size.x), h = Math.max(2, size.y);
    if (rt) { rt.dispose(); bA && bA.dispose(); bB && bB.dispose(); rA && rA.dispose(); }
    bA = bB = rA = null;
    rt = target(w, h, QUALITY.tier >= 3 ? 4 : QUALITY.tier >= 2 ? 2 : 0); rt.texture.encoding = THREE.sRGBEncoding;
    comp.uniforms.uFxaa.value = QUALITY.tier >= 2 ? 0 : 1;
    const bw = Math.max(2, Math.round(w / 4)), bh = Math.max(2, Math.round(h / 4));
    if (QUALITY.bloom) { bA = target(bw, bh, -1); bB = target(bw, bh, -1); bright.uniforms.uTexel.value.set(1 / w, 1 / h); }
    if (QUALITY.godrays) { const rs = QUALITY.tier >= 2 ? 2 : 3; rA = target(Math.max(2, Math.round(w / rs)), Math.max(2, Math.round(h / rs)), -1); }
    comp.uniforms.uRes.value.set(w, h);
  }
  function pass(mat, out) { quad.material = mat; renderer.setRenderTarget(out); renderer.render(scn, oc); }
  const _sv = new THREE.Vector3(), _cd = new THREE.Vector3(), _rc = new THREE.Color();
  return {
    get on() { return on; },
    get fpp() { return fpp; },
    setCB(m) { comp.uniforms.uCB.value = { protan: 1, deutan: 2, tritan: 3 }[m] || 0; },
    get dbg() { return { rays, lens, fpp, uni: Object.fromEntries(Object.entries(comp.uniforms).filter(([, u]) => typeof u.value === "number").map(([k, u]) => [k, u.value])) }; },
    init() { if (!on) return; try { build(); } catch (e) { console.warn('post disabled', e); on = false; } },
    resize() { if (on) try { build(); } catch (e) { on = false; } },
    render(dt) {
      const SC = VIEW.scene || scene;
      if (!on || !rt) { renderer.setRenderTarget(null); renderer.render(SC, camera); return; }
      fpp = damp(fpp, camMode === 'fpp' && started && !LOBBY.on ? 1 : 0, 6, dt);
      renderer.setRenderTarget(rt); renderer.render(SC, camera);
      const cu = comp.uniforms;
      if (bA) {
        bright.uniforms.tIn.value = rt.texture; pass(bright, bA);
        blur.uniforms.tIn.value = bA.texture; blur.uniforms.uDir.value.set(1 / bA.width, 0); pass(blur, bB);
        blur.uniforms.tIn.value = bB.texture; blur.uniforms.uDir.value.set(0, 1 / bA.height); pass(blur, bA);
        cu.tBloom.value = bA.texture; cu.uBloom.value = 0.3 + ENV.night * 0.4;
      } else { cu.tBloom.value = rt.texture; cu.uBloom.value = 0; }
      // shafts only when the sun is up, in front of us, and something can break it into rays
      let want = 0;
      if (rA) {
        _sv.copy(ENV.sunDir).multiplyScalar(1000).add(camera.position); camera.getWorldDirection(_cd);
        const facing = _cd.dot(ENV.sunDir);
        if (STRAIN.shafts && !VIEW.scene && ENV.sunVis > 0.02 && facing > 0.05 && ENV.sunDir.y > 0.03) {
          _sv.project(camera);
          const sx = _sv.x * 0.5 + 0.5, sy = _sv.y * 0.5 + 0.5;
          shafts.uniforms.uSun.value.set(sx, sy); shafts.uniforms.uAsp.value = rt.width / rt.height; shafts.uniforms.tIn.value = rt.texture;
          pass(shafts, rA);
          const fp = LOBBY.on && LOBBY.spot ? LOBBY.spot : started ? player.pos : null, forest = fp ? forestAt(fp.x, fp.z) : 0.3;
          want = smooth(0.05, 0.5, facing) * ENV.sunVis * (0.55 + forest * 0.9 + WEATHER.fog * 0.8) * (1 - WEATHER.rain * 0.8);
        }
        cu.tRays.value = rA.texture;
      } else cu.tRays.value = rt.texture;
      rays = damp(rays, want, 3, dt); if (!isFinite(rays)) rays = 0; cu.uRays.value = rays * 0.55;
      _rc.copy(sun.color).lerp(_rc.setRGB(1, 0.92, 0.75), 0.4); cu.uRayCol.value.copy(_rc);
      // drops on the lens when it rains and you look up (or ride without a roof)
      camera.getWorldDirection(_cd);
      lens = damp(lens, WEATHER.rain * (1 - WEATHER.snow) * (fpp * 0.7 + 0.3) * smooth(-0.3, 0.4, _cd.y) * (player.inside ? 0 : 1), 1.5, dt);
      if (!isFinite(lens)) lens = 0; if (!isFinite(fpp)) fpp = 0;
      cu.uLens.value = lens;
      // grading follows the weather: grey and flat in rain, warm and crisp in sun
      const W = WEATHER, grey = clamp(W.rain * 0.8 + W.fog * 0.5, 0, 1);
      cu.uGrade.value.set(lerp(1.09, 1.0, grey), lerp(1.04, 0.82, grey), 0, 0);
      cu.uTint.value.setRGB(lerp(1.02, 0.97, grey), 1.0, lerp(0.97, 1.03, grey));
      cu.tScene.value = rt.texture; cu.uTime.value = T; cu.uFpp.value = fpp; cu.uNight.value = ENV.night;
      cu.uGrain.value = 0.012 + fpp * 0.024; cu.uVig.value = 0.36 + ENV.night * 0.25 + fpp * 0.2;
      cu.uFade.value = typeof sleepFade !== 'undefined' ? clamp(sleepFade > 1.3 ? (2.2 - sleepFade) / 0.9 : sleepFade / 1.3, 0, 1) : 0;
      pass(comp, null);
    },
  };
})();
/* render scale: the picture gets a little softer before the frame rate drops (never below three quarters of the chosen size),
   measured against the frame-rate cap so a 30 fps cap is not mistaken for a slow device */
const DYNRES = { scale: 1, acc: 0, n: 0, cool: 3 };
const DYN_MIN = 0.75;
function updateDynRes(dt) {
  if (!SET.dynres) { if (DYNRES.scale !== 1) { DYNRES.scale = 1; renderer.setPixelRatio(renderRatio()); if (typeof applyOrientation === 'function') applyOrientation(); } return; }
  if (!started || paused) { DYNRES.acc = 0; DYNRES.n = 0; return; }      // menus run at their own pace: judge only real play
  DYNRES.acc += dt; DYNRES.n++; DYNRES.cool -= dt;
  if (DYNRES.acc < 1.5) return;
  const avg = DYNRES.acc / DYNRES.n; DYNRES.acc = 0; DYNRES.n = 0;
  if (DYNRES.cool > 0) return;
  const goal = 1 / Math.min(FRAME_CAP > 0 ? FRAME_CAP : 60, 60);
  let s = DYNRES.scale;
  if (avg > goal * 1.45 && s > DYN_MIN) s = Math.max(DYN_MIN, +(s - 0.05).toFixed(2));
  else if (avg < goal * 1.06 && s < 1) s = Math.min(1, +(s + 0.05).toFixed(2));
  if (s === DYNRES.scale) {
    // already at the smallest picture and still slow: drop detail one step; fast again for a while: bring it back
    if (avg > goal * 1.9 && s <= DYN_MIN + 0.01 && STRAIN.level < 3) { if (++STRAIN.bad >= 2) { setStrain(STRAIN.level + 1); STRAIN.bad = 0; DYNRES.cool = 5; } } else STRAIN.bad = 0;
    if (avg < goal * 1.08 && s >= 0.99 && STRAIN.level > 0) { if (++STRAIN.good >= 4) { setStrain(STRAIN.level - 1); STRAIN.good = 0; DYNRES.cool = 5; } } else STRAIN.good = 0;
  }
  if (s !== DYNRES.scale) { DYNRES.scale = s; DYNRES.cool = 4; renderer.setPixelRatio(renderRatio()); if (typeof applyOrientation === 'function') applyOrientation(); else POST.resize(); }
}
