/* ═════════ models from the internet, packed next to the page: Mixamo characters (soldier, Michelle), animals (horse, fox,
   flamingo, parrot, stork), cars (Ferrari 458 by vicent091036, Cesium milk truck); clothes are recoloured per body region ═════════ */
const MODEL_DIR = 'assets/models/';
const MODELS = {};
function glbFrom(json, bin) {
  const js = new TextEncoder().encode(JSON.stringify(json)), jp = (4 - js.length % 4) % 4, bp = (4 - bin.length % 4) % 4;
  const total = 28 + js.length + jp + bin.length + bp, buf = new ArrayBuffer(total), dv = new DataView(buf), u8 = new Uint8Array(buf);
  dv.setUint32(0, 0x46546C67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
  dv.setUint32(12, js.length + jp, true); dv.setUint32(16, 0x4E4F534A, true); u8.set(js, 20); u8.fill(0x20, 20 + js.length, 20 + js.length + jp);
  const o = 20 + js.length + jp; dv.setUint32(o, bin.length + bp, true); dv.setUint32(o + 4, 0x004E4942, true); u8.set(bin, o + 8);
  return buf;
}
function loadModel(name) {
  if (MODELS[name]) return MODELS[name];
  if (!THREE.GLTFLoader) return (MODELS[name] = Promise.reject(new Error('GLTFLoader missing')));
  MODELS[name] = fetchJSON(MODEL_DIR + name + '.json').then((d) => new Promise((res, rej) => new THREE.GLTFLoader().parse(glbFrom(d.gltf, b64Bytes(d.bin)), MODEL_DIR, res, rej)));
  return MODELS[name];
}
/* hand-held props modelled by artists (the AK, the 9 mm, blades and axes; tools/um_prop.py): fetched the first time someone
   holds one, then shared. Until it arrives the procedural model stands in; PROP_WAIT hears when it lands. */
const PROPS = {}, PROP_WAIT = [];
function propMesh(name) {
  const P = PROPS[name];
  if (P) return P.mesh ? P : null;
  PROPS[name] = { loading: true };
  loadModel(name).then((g) => {
    let mesh = null; g.scene.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
    if (!mesh) throw new Error('no mesh');
    const ex = mesh.userData || {}, mt = mesh.material;
    for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap']) if (mt[k]) mt[k].anisotropy = MAX_ANISO;
    mt.envMapIntensity = 1; ENV_MATS.push(mt);
    PROPS[name] = { mesh, muzzle: new THREE.Vector3(...(ex.muzzle || [0, 0.02, 0.5])), len: ex.len || 1 };
    for (const f of PROP_WAIT) { try { f(name); } catch (e) { console.warn('prop hook', e); } }
  }).catch((e) => { console.warn('prop', name, e); PROPS[name] = { failed: true }; });
  return null;
}
/* attach an object to a bone keeping a pose given in the rig's space at bind time */
function attachAt(rig, bone, obj, x, y, z, rx = 0, ry = 0, rz = 0) {
  obj.position.set(x, y, z); obj.rotation.set(rx, ry, rz);
  rig.add(obj); rig.updateMatrixWorld(true); bone.attach(obj);
  return obj;
}
/* rotate a bone in world space after the mixer ran: pose overrides for aiming, swinging, sitting, zombie arms */
const _pq = new THREE.Quaternion(), _bq = new THREE.Quaternion(), _rq = new THREE.Quaternion();
function boneTurn(bone, axisWorld, angle) {
  if (!bone || Math.abs(angle) < 1e-4) return;
  bone.parent.updateMatrixWorld(true); bone.getWorldQuaternion(_bq);
  _rq.setFromAxisAngle(axisWorld, angle); _bq.premultiply(_rq);
  bone.parent.getWorldQuaternion(_pq).invert(); bone.quaternion.copy(_pq.multiply(_bq)); bone.updateMatrixWorld(true);
}
const _dir = new THREE.Vector3(), _cur = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _rqq = new THREE.Quaternion();
function aimLimb(bone, child, lx, ly, lz, w, rootQ) {
  if (!bone || !child || w <= 0.001) return;
  bone.getWorldPosition(_a); child.getWorldPosition(_b); _cur.subVectors(_b, _a).normalize();
  _dir.set(lx, ly, lz).normalize().applyQuaternion(rootQ);
  if (w < 1) _dir.lerp(_cur, 1 - w).normalize();
  _rqq.setFromUnitVectors(_cur, _dir);
  bone.parent.updateMatrixWorld(true); bone.getWorldQuaternion(_bq); _bq.premultiply(_rqq);
  bone.parent.getWorldQuaternion(_pq).invert(); bone.quaternion.copy(_pq.multiply(_bq)); bone.updateMatrixWorld(true);
}

/* ───────── characters ───────── */
/* clothing regions: 0 bare (skin, face), 1 top, 2 trousers, 3 shoes, 4 head (helmet, hair), 5 hands (gloves) */
const REGION_RULES = {
  scan: () => 0,      // the night hunter wears his own coat: no regions to tint
  // the scanned women: shoes, jeans, top by height; the shader keeps skin, hair and face as they are
  scanw: (x, h) => h < 0.055 ? 3 : h < 0.47 ? 2 : h < 0.53 ? (Math.abs(x) < 0.11 ? 2 : 1) : h < 0.83 ? 1 : 4,
  soldier: (x, h, d) => h < 0.065 ? 3 : h < 0.5 ? 2 : h < 0.84 ? (Math.abs(x) < 0.36 ? 1 : 5) : 4,
  michelle: (x, h, d) => h < 0.06 ? 3 : h < 0.52 ? 2 : h < 0.8 ? (Math.abs(x) < 0.11 ? 1 : 0) : (h > 0.93 || d < -0.03 ? 4 : 0),
};
const CHAR_DEF = { soldier: { up: 'z', rule: 'soldier' }, michelle: { up: 'y', rule: 'michelle', clipsFrom: 'soldier' },
  // bodies made from the Sketchfab models the owner sent (CC-BY 4.0), rigged by tools/um_rig.py onto Michelle's skeleton:
  // two scanned women who keep shops (they stand and breathe), and the night hunter that walks with the brutes
  casual: { up: 'y', rule: 'scanw', clipsFrom: 'soldier', scan: true, wear: true }, blonde: { up: 'y', rule: 'scanw', clipsFrom: 'soldier', scan: true, wear: true },
  hunter: { up: 'y', rule: 'scan', clipsFrom: 'soldier', scan: true } };
const CHARS = {};
const PATTERN = { solid: 0, camo: 1, desert: 2, checks: 3, stripes: 4, urban: 5 };
function charMaterial(src, scan) {
  const m = new THREE.MeshStandardMaterial({ map: src.map || null, normalMap: src.normalMap || null, color: 0xffffff, roughness: 0.82, metalness: 0, skinning: true });
  // a scanned body was cut where its hands touched its hips: both faces drawn, so a gap shows cloth, not the sky through it
  if (scan) { m.side = THREE.DoubleSide; m.shadowSide = THREE.FrontSide; }
  m.customProgramCacheKey = () => 'char5' + (m.normalMap ? 'n' : '') + (scan ? 's' : '');
  m.userData.tint = { uTint: { value: [0, 1, 2, 3, 4, 5].map(() => new THREE.Color(1, 1, 1)) }, uTintP: { value: [0, 1, 2, 3, 4, 5].map(() => new THREE.Vector4(0, 0, 1, 0)) }, uSick: { value: 0 }, uWetC: WET_U };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, m.userData.tint);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aRegion; varying float vRegion; varying vec3 vObjP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRegion = aRegion; vObjP = position;');
    sh.fragmentShader = (scan ? '#define SCAN_SKIN\n' : '') + sh.fragmentShader.replace('#include <common>', `#include <common>
      uniform vec3 uTint[6]; uniform vec4 uTintP[6]; uniform float uSick, uWetC; varying float vRegion; varying vec3 vObjP; vec3 tGlowC;
      float chh(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      float cn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(chh(i), chh(i + vec3(1,0,0)), f.x), mix(chh(i + vec3(0,1,0)), chh(i + vec3(1,1,0)), f.x), f.y), mix(mix(chh(i + vec3(0,0,1)), chh(i + vec3(1,0,1)), f.x), mix(chh(i + vec3(0,1,1)), chh(i + vec3(1,1,1)), f.x), f.y), f.z); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
      tGlowC = vec3(0.0);
      {
        int r = int(vRegion + 0.5); vec4 tp = uTintP[r]; vec3 tc = uTint[r];
        float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        vec3 base = tc;
        vec3 q = vObjP * tp.z;
        #ifdef SCAN_SKIN
          // a scanned body keeps its skin, hair and face: only cloth-coloured texels take the outfit
          vec3 sc = pow(max(diffuseColor.rgb, vec3(0.0)), vec3(0.4545)); float mxv = max(sc.r, max(sc.g, sc.b)), mnv = min(sc.r, min(sc.g, sc.b)), sat = (mxv - mnv) / (mxv + 1e-4);
          float skinK = step(sc.b, sc.g) * step(sc.g, sc.r) * smoothstep(0.06, 0.14, sc.r - sc.b) * smoothstep(0.12, 0.2, sat) * (1.0 - smoothstep(0.55, 0.7, sat)) * smoothstep(0.22, 0.32, mxv);
          tp.x *= 1.0 - skinK;
        #endif
        if (tp.y > 0.5 && tp.y < 1.5) { float n = cn(q * 0.06) * 0.65 + cn(q * 0.15) * 0.35; base = n < 0.42 ? tc : n < 0.56 ? tc * vec3(0.55, 0.62, 0.45) : n < 0.68 ? vec3(0.09, 0.08, 0.06) : tc * 1.35; }
        else if (tp.y > 1.5 && tp.y < 2.5) { float n = cn(q * 0.05) * 0.7 + cn(q * 0.13) * 0.3; base = n < 0.45 ? tc : n < 0.62 ? tc * vec3(0.78, 0.7, 0.55) : tc * vec3(0.55, 0.45, 0.33); }
        else if (tp.y > 2.5 && tp.y < 3.5) { vec3 g = floor(q * 0.12); base = mod(g.x + g.z + g.y, 2.0) < 1.0 ? tc : tc * 0.55; }
        else if (tp.y > 3.5 && tp.y < 4.5) { base = fract(q.z * 0.1) < 0.5 ? tc : vec3(0.92); }
        else if (tp.y > 4.5 && tp.y < 5.5) { float n = cn(q * 0.08); base = n < 0.35 ? tc * 0.45 : n < 0.6 ? tc : n < 0.8 ? tc * 1.5 : vec3(0.12); }
        else if (tp.y > 5.5 && tp.y < 6.5) { float st = sin(q.y * 0.55 + cn(q * 0.04) * 7.0 + q.x * 0.18); base = st > 0.62 ? vec3(0.03) : tc * (0.9 + 0.3 * cn(q * 0.1)); tGlowC = st > 0.62 ? vec3(0.0) : tc; }
        else if (tp.y > 6.5 && tp.y < 7.5) { float f = cn(vec3(q.x * 0.09, q.y * 0.05, q.z * 0.09)) + 0.35 * cn(q * 0.2) - fract(q.y * 0.004) * 0.6;
          base = f > 0.55 ? mix(tc, vec3(1.0, 0.82, 0.25), smoothstep(0.55, 0.85, f)) : mix(vec3(0.05, 0.02, 0.02), tc, smoothstep(0.25, 0.55, f)); tGlowC = f > 0.55 ? base : vec3(0.0); }
        else if (tp.y > 7.5 && tp.y < 8.5) { vec3 g = floor(q * 0.22); float h = chh(g); base = h < 0.4 ? tc : h < 0.72 ? tc * 0.6 : h < 0.9 ? tc * 1.3 : vec3(0.1); }
        else if (tp.y > 8.5 && tp.y < 9.5) { vec3 g = floor(q * 0.6); base = mod(g.x + g.y + g.z, 2.0) < 1.0 ? tc : tc * 0.55 + 0.02; }
        else if (tp.y > 9.5 && tp.y < 10.5) { float n = cn(q * 0.05), st = step(0.985, chh(floor(q * 0.9))); base = mix(tc * 0.35, mix(tc, vec3(0.9, 0.3, 0.8), n), smoothstep(0.35, 0.8, n)) + vec3(st); tGlowC = vec3(st) + tc * smoothstep(0.6, 0.9, n) * 0.6; }
        else if (tp.y > 10.5) { float n = cn(q * 0.035); base = tc * (0.55 + 1.1 * n * n); }
        tGlowC *= tp.w;
        // mixing happens in linear light, where even a tenth of a white plate shows through dark cloth: lean the mix towards the cloth
        diffuseColor.rgb = mix(diffuseColor.rgb, base * (0.42 + lum * 1.15), 1.0 - (1.0 - tp.x) * (1.0 - tp.x));
        if (uSick > 0.0) { vec3 sick = mix(vec3(lum), diffuseColor.rgb, 0.22) * vec3(0.56, 0.62, 0.5);
          float st = chh(floor(vObjP * 0.09)); sick *= mix(1.0, 0.4, step(0.82, st)); sick = mix(sick, vec3(0.13, 0.015, 0.01), step(0.93, st) * 0.85);
          diffuseColor.rgb = mix(diffuseColor.rgb, sick, uSick); }
        diffuseColor.rgb *= 1.0 - uWetC * 0.18;
      }`).replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n      totalEmissiveRadiance += tGlowC * 0.7;');
  };
  ENV_MATS.push(m);
  return m;
}
const pc = (A, i, k) => (k === 0 ? A.getX(i) : k === 1 ? A.getY(i) : A.getZ(i));
/* the true size of a skinned body in its bind pose: geometry bounds lie when the rig carries its own unit scale */
function skinnedBox(root) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3(), v = new THREE.Vector3(); let any = false;
  root.traverse((o) => {
    if (!o.isSkinnedMesh || !o.boneTransform) return;
    const n = o.geometry.attributes.position.count;
    for (let i = 0; i < n; i += 3) { o.boneTransform(i, v); v.applyMatrix4(o.matrixWorld); box.expandByPoint(v); any = true; }
  });
  return any ? box : new THREE.Box3().setFromObject(root);
}
async function loadCharacter(kind) {
  if (CHARS[kind]) return CHARS[kind];
  const def = CHAR_DEF[kind], gltf = await loadModel(kind), m = gltf.scene;
  m.updateMatrixWorld(true);
  m.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
    const g = o.geometry, P = g.attributes.position, n = P.count, reg = new Float32Array(n);
    g.computeBoundingBox(); const bb = g.boundingBox;
    const up = def.up === 'z' ? 2 : 1, H = bb.max.getComponent(up) - bb.min.getComponent(up), side = 0, dep = def.up === 'z' ? 1 : 2;
    for (let i = 0; i < n; i++) {
      const h = (pc(P, i, up) - bb.min.getComponent(up)) / H, x = pc(P, i, side) / H, d = pc(P, i, dep) / H;
      reg[i] = /visor/i.test(o.name) ? 4 : REGION_RULES[def.rule](x, h, d);
    }
    g.setAttribute('aRegion', new THREE.BufferAttribute(reg, 1));
    o.material = charMaterial(o.material, def.scan);
  });
  const box = skinnedBox(m), h = Math.max(0.1, box.max.y - box.min.y);
  const lh = m.getObjectByName('mixamorigLeftHand'), rh = m.getObjectByName('mixamorigRightHand');
  const lp = new THREE.Vector3(), rp = new THREE.Vector3(); if (lh) lh.getWorldPosition(lp); if (rh) rh.getWorldPosition(rp);
  let clips = gltf.animations.filter((c) => c.name !== 'TPose' && c.name !== 'SambaDance'), flip = lp.x - rp.x < 0 ? Math.PI : 0;
  if (def.clipsFrom) {
    const src = await loadCharacter(def.clipsFrom);
    // Mixamo rigs share bone names: borrow rotations, leave the hips where this body has them
    // the two rigs hang their hips under differently turned 'Character' nodes: carry the difference into the hips track
    const hs = src.scene.getObjectByName('mixamorigHips'), hm = m.getObjectByName('mixamorigHips');
    const qs = new THREE.Quaternion(), qm = new THREE.Quaternion();
    if (hs && hs.parent) { src.scene.updateMatrixWorld(true); hs.parent.getWorldQuaternion(qs); }
    if (hm && hm.parent) hm.parent.getWorldQuaternion(qm);
    const fix = qm.clone().invert().multiply(qs), tq = new THREE.Quaternion();
    flip = src.flip;     // it now moves with the other rig's hips, so it faces the way that rig faces
    clips = src.clips.map((c) => new THREE.AnimationClip(c.name, c.duration, c.tracks.filter((t) => t.name.endsWith('.quaternion')).map((t) => {
      if (t.name !== 'mixamorigHips.quaternion') return t;
      const v = t.values.slice();
      for (let i = 0; i < v.length; i += 4) { tq.set(v[i], v[i + 1], v[i + 2], v[i + 3]).premultiply(fix); v[i] = tq.x; v[i + 1] = tq.y; v[i + 2] = tq.z; v[i + 3] = tq.w; }
      return new THREE.QuaternionKeyframeTrack(t.name, t.times, v);
    })));
  }
  CHARS[kind] = { kind, scene: m, clips, scale: 1.78 / h, flip, minY: box.min.y };
  return CHARS[kind];
}
/* one walking body: a clone with its own mixer, bones and clothing uniforms */
const BONE_NAMES = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot'];
function makeBody(kind, opts = {}) {
  const C0 = CHARS[kind]; if (!C0) return null;
  const m = THREE.SkeletonUtils.clone(C0.scene);
  const mats = [];
  m.traverse((o) => { if (o.isMesh) { const nm = charMaterial(o.material, CHAR_DEF[kind] && CHAR_DEF[kind].scan); o.material = nm; mats.push(nm); o.castShadow = opts.shadow !== false; o.receiveShadow = true; o.frustumCulled = false; } });
  const inner = new THREE.Group(); inner.rotation.y = C0.flip; inner.scale.setScalar(C0.scale * (opts.scale || 1)); inner.add(m); m.position.y = -C0.minY;
  const root = new THREE.Group(); root.add(inner);
  const mixer = new THREE.AnimationMixer(m), act = {};
  for (const c of C0.clips) { const a = mixer.clipAction(c); a.play(); a.setEffectiveWeight(c.name === 'Idle' ? 1 : 0); act[c.name] = a; }
  const bones = {}; for (const n of BONE_NAMES) bones[n] = m.getObjectByName('mixamorig' + n);
  const body = { kind, root, inner, model: m, mixer, act, bones, mats, acc: {} };
  if (opts.outfit) dressBody(body, opts.outfit);
  return body;
}
/* outfits: colour + pattern per region, plus accessories on the bones */
function dressBody(body, outfit) {
  if (CHAR_DEF[body.kind] && CHAR_DEF[body.kind].scan && !CHAR_DEF[body.kind].wear) {          // the night hunter: his own coat, no tints, no props
    for (const m of body.mats) for (let r = 0; r < 6; r++) m.userData.tint.uTintP.value[r].set(0, 0, 1, 0);
    return;
  }
  const scanW = CHAR_DEF[body.kind] && CHAR_DEF[body.kind].wear;
  for (const m of body.mats) {
    const T = m.userData.tint;
    for (let r = 0; r < 6; r++) {
      const nm = ['skin', 'top', 'pants', 'shoes', 'head', 'hands'][r];
      // the armoured base body never shows its bare tan plates: missing gloves or headgear take the survivor defaults
      const part = outfit[nm] || (body.kind === 'soldier' && (nm === 'hands' || nm === 'head') && typeof DEFAULT_OUTFIT !== 'undefined' ? DEFAULT_OUTFIT[nm] : null);
      // the scanned women keep their own clothes until you dress them (the default outfit is the soldier's)
      if (!part || (scanW && (nm === 'head' || nm === 'hands' || nm === 'skin' || part.dflt))) { T.uTintP.value[r].set(0, 0, 1, 0); continue; }
      T.uTint.value[r].setHex(part.c).convertSRGBToLinear(); T.uTintP.value[r].set(part.a !== undefined ? part.a : 0.85, PATTERN[part.p || 'solid'] || 0, body.kind === 'soldier' ? 1 : 100, part.glow || 0);
    }
  }
  // accessories
  for (const k of Object.keys(body.acc)) { const o = body.acc[k]; if (o && o.parent) o.parent.remove(o); delete body.acc[k]; }
  body.root.updateMatrixWorld(true);
  const headPos = boneLocal(body, 'Head'), chest = boneLocal(body, 'Spine2');
  if (outfit.hat && ACCESSORY[outfit.hat]) body.acc.hat = attachAt(body.root, body.bones.Head, ACCESSORY[outfit.hat](outfit.hatC), headPos.x, headPos.y + (body.kind === 'soldier' ? 0.13 : 0.11), headPos.z + 0.01);
  if (outfit.glasses && ACCESSORY[outfit.glasses]) body.acc.glasses = attachAt(body.root, body.bones.Head, ACCESSORY[outfit.glasses](outfit.glassesC), headPos.x, headPos.y + 0.06, headPos.z + 0.09);
  if (outfit.vest && ACCESSORY[outfit.vest]) body.acc.vest = attachAt(body.root, body.bones.Spine2, ACCESSORY[outfit.vest](outfit.vestC), chest.x, chest.y - 0.08, chest.z + 0.0);
  if (outfit.pack && ACCESSORY[outfit.pack]) body.acc.pack = attachAt(body.root, body.bones.Spine2, ACCESSORY[outfit.pack](outfit.packC), chest.x, chest.y - 0.06, chest.z - 0.24);
  body.outfit = outfit;
}
function boneLocal(body, n) { const v = new THREE.Vector3(); const b = body.bones[n]; if (b) { b.getWorldPosition(v); body.root.worldToLocal(v); } return v; }
/* accessory meshes, built once per kind and colour */
const _accCache = new Map();
function accMesh(key, build) { let g = _accCache.get(key); if (!g) { const b = new Builder(); build(b); g = b.geometry(); _accCache.set(key, g); } const m = new THREE.Mesh(g, UBER_OBJ); m.castShadow = true; m.receiveShadow = true; return m; }
const ACCESSORY = {
  cap: (c = 0x2f4a6a) => accMesh('cap' + c, (b) => { b.add(G.dome, M(0, 0, 0, 0, 0.115, 0.08, 0.125), c, K.fabric); b.add(G.box, M(0, -0.005, 0.12, 0, 0.17, 0.012, 0.1, 0.12), c, K.fabric); }),
  beanie: (c = 0x3a3a3c) => accMesh('beanie' + c, (b) => { b.add(G.dome, M(0, -0.02, 0, 0, 0.118, 0.12, 0.125), c, K.fabric); b.add(G.cyl14, M(0, -0.03, 0, 0, 0.12, 0.04, 0.128), c, K.fabric); }),
  cowboy: (c = 0x6b4a2f) => accMesh('cowboy' + c, (b) => { b.add(G.cyl14, M(0, 0.0, 0, 0, 0.26, 0.012, 0.27), c, K.fabric); b.add(G.cyl14, M(0, 0.06, 0, 0, 0.1, 0.12, 0.11), c, K.fabric); b.add(G.dome, M(0, 0.11, 0, 0, 0.1, 0.04, 0.11), c, K.fabric); b.add(G.cyl14, M(0, 0.015, 0, 0, 0.103, 0.025, 0.113), 0x2a1d14, K.fabric); }),
  helmet: (c = 0x4a5038) => accMesh('helmet' + c, (b) => { b.add(G.dome, M(0, -0.02, 0, 0, 0.135, 0.13, 0.145), c, K.metal); b.add(G.cyl14, M(0, -0.03, 0, 0, 0.14, 0.02, 0.15), c, K.metal); }),
  shemagh: (c = 0xd8d0c4) => accMesh('shemagh3' + c, (b) => { b.add(G.dome, M(0, -0.035, 0, 0, 0.142, 0.135, 0.148), c, K.fabric); b.add(G.box, M(0, -0.165, -0.085, 0, 0.25, 0.25, 0.09), c, K.fabric); b.add(G.torus, M(0, 0.04, 0, 0, 0.118, 0.118, 0.06, Math.PI / 2), 0x151515, K.fabric); }),
  bandana: (c = 0x8a2a2a) => accMesh('bandana' + c, (b) => { b.add(G.dome, M(0, -0.03, 0, 0, 0.12, 0.08, 0.128), c, K.fabric); b.add(G.box, M(0, -0.05, -0.13, 0, 0.05, 0.08, 0.04), c, K.fabric); }),
  sunglasses: (c = 0x111214) => accMesh('sun' + c, (b) => { for (const s of [-1, 1]) b.add(G.cyl14, M(s * 0.035, 0, 0, 0, 0.026, 0.006, 0.02, Math.PI / 2), c, K.glass); b.box(0, 0.005, 0, 0.11, 0.006, 0.006, c, 0, K.metal); for (const s of [-1, 1]) b.box(s * 0.07, 0.005, -0.06, 0.005, 0.005, 0.12, c, 0, K.metal); }),
  goggles: (c = 0x2a2a2a) => accMesh('gog' + c, (b) => { b.box(0, 0, 0, 0.16, 0.05, 0.02, 0x88aacc, 0, K.glass); b.box(0, 0, -0.08, 0.2, 0.02, 0.16, c, 0, K.fabric); }),
  vest: (c = 0x4a5038) => accMesh('vest' + c, (b) => { b.box(0, 0, 0.11, 0.36, 0.42, 0.06, c, 0, K.fabric); b.box(0, 0, -0.12, 0.36, 0.42, 0.06, c, 0, K.fabric); for (const s of [-1, 1]) b.box(s * 0.17, 0.02, 0, 0.04, 0.38, 0.22, c, 0, K.fabric); for (let k = 0; k < 3; k++) b.box(-0.1 + k * 0.1, -0.08, 0.15, 0.08, 0.12, 0.04, c, 0, K.fabric); }),
  pack: (c = 0x56603f) => accMesh('pack' + c, (b) => {
    const ell = new THREE.CylinderGeometry(1, 1, 1, 18);
    b.add(ell, M(0, 0, 0, 0, 0.19, 0.54, 0.115), c, K.fabric); b.add(G.dome, M(0, 0.27, 0, 0, 0.19, 0.09, 0.115), c, K.fabric); b.add(G.dome, M(0, -0.27, 0, 0, 0.19, 0.05, 0.115, Math.PI), c, K.fabric);
    b.add(ell, M(0, -0.06, -0.1, 0, 0.15, 0.3, 0.07), 0x666448, K.fabric); for (const s of [-1, 1]) b.add(ell, M(s * 0.19, -0.1, 0, 0, 0.045, 0.24, 0.07), 0x666448, K.fabric);
    for (const y of [0.13, -0.15]) b.box(0, y, -0.005, 0.4, 0.028, 0.245, 0x2c3224, 0, K.fabric);
    b.add(G.cyl8, M(0, -0.37, -0.01, 0, 0.075, 0.42, 0.075, 0, Math.PI / 2), 0x4a5038, K.fabric);
    for (const s of [-1, 1]) b.box(s * 0.1, 0.02, 0.125, 0.055, 0.46, 0.025, 0x2c3224, 0, K.fabric);
    ell.dispose();
  }),
  bigpack: (c = 0x3d4f6f) => accMesh('bigpack' + c, (b) => {
    const ell = new THREE.CylinderGeometry(1, 1, 1, 18);
    b.add(ell, M(0, 0.06, -0.02, 0, 0.22, 0.72, 0.15), c, K.fabric); b.add(G.dome, M(0, 0.42, -0.02, 0, 0.22, 0.12, 0.15), c, K.fabric);
    b.add(G.cyl8, M(0, 0.5, 0.0, 0, 0.09, 0.44, 0.09, 0, Math.PI / 2), 0x8a3a2e, K.fabric); b.add(ell, M(0, -0.08, -0.15, 0, 0.17, 0.3, 0.06), 0x2c3224, K.fabric);
    for (const s of [-1, 1]) b.box(s * 0.11, 0.05, 0.14, 0.055, 0.52, 0.025, 0x1c1c1c, 0, K.fabric);
    ell.dispose();
  }),
};

/* ───────── animals and vehicles: shared models, prepared once ───────── */
const ANIMAL_MODELS = {}, CAR_MODELS = {};
async function loadAnimalModels() {
  const list = [['horse', 'horse'], ['fox', 'fox'], ['flamingo', 'flamingo'], ['parrot', 'parrot'], ['stork', 'stork']];
  await Promise.all(list.map(async ([k, file]) => {
    try {
      const g = await loadModel(file), s = g.scene;
      s.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; const mt = o.material; if (mt) { mt.roughness = 0.9; mt.metalness = 0; if (mt.vertexColors !== undefined && o.geometry.attributes.color) mt.vertexColors = true; ENV_MATS.push(mt); } } });
      s.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(s);
      ANIMAL_MODELS[k] = { scene: s, clips: g.animations, box, size: box.getSize(new THREE.Vector3()) };
    } catch (e) { console.warn('animal model', k, e); }
  }));
}
async function loadCarModels() {
  // the field jeep (UAZ-469 by zhe_kan, CC-BY 4.0), made game-ready by tools/um_car2.py, and its far level (no textures of its own)
  await Promise.all([['uaz', 'uaz'], ['uaz_lo', 'uaz_lo']].map(async ([k, file]) => {
    try {
      const g = await loadModel(file), s = g.scene;
      s.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      // each wheel gets a pivot at its hub: the pivot steers, the wheel inside it rolls
      for (const nm of ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr']) {
        const w = s.getObjectByName(nm); if (!w) continue;
        const piv = new THREE.Group(); piv.name = 'piv_' + nm; piv.position.copy(w.position); w.parent.add(piv); piv.add(w); w.position.set(0, 0, 0);
      }
      s.updateMatrixWorld(true);
      CAR_MODELS[k] = { scene: s };
    } catch (e) { console.warn('car model', k, e); }
  }));
  // the far jeep wears the near one's materials, so their textures go up to the GPU once
  const hi = CAR_MODELS.uaz, lo = CAR_MODELS.uaz_lo;
  if (hi) {
    const byName = {}; hi.scene.traverse((o) => { if (o.isMesh) byName[o.material.name] = o.material; });
    if (lo) lo.scene.traverse((o) => { if (o.isMesh && byName[o.material.name]) o.material = byName[o.material.name]; });
    for (const m of Object.values(byName)) if (!ENV_MATS.includes(m)) ENV_MATS.push(m);
  } else delete CAR_MODELS.uaz_lo;
}
