'use strict';
/* ═════════ Call of Survival (once «جزيرة الصخرة», still the first map's name) v4 — core: helpers, quality, renderer, lights, time of day (long day, short night), weather, sky, height fog, builders ═════════ */
const $ = (id) => document.getElementById(id);
function failBoot(msg) { const n = $('loadNote'); if (n) { n.textContent = msg; n.classList.add('err'); } const b = $('startBtn'); if (b) b.disabled = true; }
/* the loading film (assets/boot, rendered for the game by tools/boot_scene.html): the warp plays once, then the fall over the
   planet loops; the game's name comes in after the flash. Stopped, and its decoder let go, once the lobby is up */
const BOOTFILM = (() => {
  const a = $('bootIntro'), b = $('bootLoop'), box = $('intro'), T0 = performance.now();
  const title = () => { if (box) box.classList.add('titled'); };
  if (!a || !b || !box) return { stop() {}, play() {}, shown: () => true };
  let saveData = false; try { saveData = !!(navigator.connection && navigator.connection.saveData); } catch (_) {}
  const srcs = [a.innerHTML, b.innerHTML];
  const drop = (v) => { try { v.pause(); v.innerHTML = ''; v.load(); } catch (_) {} };
  if (saveData) { drop(a); drop(b); a.poster = 'assets/boot/still.jpg'; title(); return { stop() {}, play() {}, shown: () => true }; }
  const toLoop = () => {
    if (b.dataset.on) return; b.dataset.on = '1';
    const show = () => { b.classList.add('on'); a.classList.add('off'); }, p = b.play();
    if (p && p.then) p.then(show).catch(() => { delete b.dataset.on; }); else show();
  };
  if (!a.paused && a.currentTime > 0) setTimeout(title, Math.max(0, 2300 - a.currentTime * 1000));
  else a.addEventListener('playing', () => setTimeout(title, Math.max(0, 2300 - a.currentTime * 1000)), { once: true });
  a.addEventListener('ended', toLoop); a.addEventListener('error', () => { title(); toLoop(); });
  setTimeout(title, 4000);
  if (a.ended) toLoop();
  return {
    shown: () => performance.now() - T0 > 4200,
    stop() { drop(a); drop(b); delete b.dataset.on; },
    play() {
      title(); a.classList.add('off'); b.classList.add('on');
      if (!b.childElementCount) { b.innerHTML = srcs[1]; b.load(); }
      try { const p = b.play(); if (p && p.catch) p.catch(() => {}); } catch (_) {}
    },
  };
})();
if (typeof THREE === 'undefined') { failBoot('تعذّر تحميل محرك الرسوم. تحقّق من الاتصال ثم أعد فتح الصفحة.'); throw new Error('three.js missing'); }

const TAU = Math.PI * 2;
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const toAr = (n) => String(n).replace(/\d/g, (d) => AR_DIGITS[d]);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function angLerp(a, b, k) { const d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI; return a + d * k; }
const angDiff = (a, b) => ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
function hash(x, y) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function hash3(x, y, z) { return hash(x + Math.imul(z | 0, 1103515245), y ^ Math.imul(z | 0, 2654435761)); }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, o = 4) { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < o; i++) { s += a * vnoise(x * f + i * 17.3, y * f - i * 9.1); n += a; a *= 0.5; f *= 2.03; } return s / n; }
let _seed = 20261018;
function rand() { _seed = (Math.imul(_seed, 1664525) + 1013904223) | 0; return (_seed >>> 0) / 4294967296; }
const rr = (a, b) => a + (b - a) * rand();
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
/* a small seeded generator for deterministic world content (trees, rocks, loot) */
function RNG(seed) { let s = (seed | 0) || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) | 0; return (s >>> 0) / 4294967296; }; }
const C = (hex) => new THREE.Color(hex).convertSRGBToLinear();
const nowMs = () => performance.now();

/* ───────── which map: the original island or one of the others. Chosen in the lobby and kept on this device; switching maps
   reloads the page, so every grid size below is known before a single shader is written ───────── */
const MAP_KEY = 'rock-island-map';
const MAPS_DEF = {
  island: { ar: 'جزيرة الصخرة', dir: 'assets/world', n: 1025, step: 8, half: 4096, play: 4000, hs: 100, km: 8 },
  desert: { ar: 'الصحراء القاحلة', dir: 'assets/maps/desert', n: 513, step: 8, half: 2048, play: 2000, hs: 100, km: 4 },
  snow: { ar: 'أرض الثلج', dir: 'assets/maps/snow', n: 769, step: 8, half: 3072, play: 3000, hs: 100, km: 6 },
  forest: { ar: 'الغابات المجنونة', dir: 'assets/maps/forest', n: 897, step: 8, half: 3584, play: 3500, hs: 100, km: 7 },
  water: { ar: 'عالم الماء', dir: 'assets/maps/water', n: 385, step: 8, half: 1536, play: 1500, hs: 100, km: 3 },
  mega: { ar: 'القارة الكبرى', dir: 'assets/maps/mega', n: 1921, step: 16, half: 15360, play: 15000, hs: 50, km: 30 },
};
const mapTitle = (id = MAP_ID) => MAPS_DEF[id].ar;
// the title screen tells which world is loading
const MAP_BLURB = {
  desert: 'جزيرة صحراوية أربعة في أربعة كيلومترات: كثبان رملية لا تنتهي، وهضاب من الحجر الرملي يشقّها وادٍ جاف، وواحة نخيل حول بحيرة، ومدينة طينية على خليج الميناء، ومنجم ملح، وقلعة ومعبد مدفون… وعواصف رملية تخفي الشمس.',
  snow: 'أرض الثلج: ستة في ستة كيلومترات من القمم البيضاء والغابات الداكنة والخلجان الضيقة، وبحيرات متجمّدة تمشي فوقها، ونهر بارد لا يتجمّد، وبلدة خشبية على الخليج، ومحطة أبحاث في الأعالي… وعواصف ثلجية.',
  forest: 'الغابات المجنونة: سبعة في سبعة كيلومترات من الأشجار العملاقة والضباب، أنهار وشلالات ومستنقعات، وقرى حطّابين وأبراج حرّاس… ضع علامة كي لا تضيع.',
  water: 'عالم الماء: ثلاثة في ثلاثة كيلومترات من البحر المفتوح، جزر صغيرة وبيوت على أعمدة ومنصّات خشبية، وسفن وقوارب، وسفن حربية يحرسها قراصنة… القتال لا يتوقف.',
  mega: 'القارة الكبرى: ثلاثون في ثلاثين كيلومتراً، بركان يسيل منه الحمم، وجبل تتسلّقه، وأنفاق، ومختبرات تحت الأرض يحرسها مسلّحون، ومدن مهجورة، وقطار تقوده بنفسك وجسور معلّقة، وأبراج مراقبة تكشف الضباب عن الخريطة، وجزيرة سرية وسط بحيرة.',
};
function applyMapIntro() {
  const d = MAPDEF, b = MAP_BLURB[MAP_ID]; if (!b) return;
  const t = $('introTag'), l = $('introLede');
  if (t) t.textContent = 'نجاة · صناعة · بناء · ' + toAr(d.km * d.km) + ' كم²'; if (l) l.textContent = b;
}
const MAPS_READY = ['island', 'desert', 'snow', 'forest', 'water', 'mega'];
const MAP_ID = (() => {
  let m = null, dev = false;
  try { const q = new URLSearchParams(location.search); dev = q.has('dev'); m = q.get('map') || localStorage.getItem(MAP_KEY); } catch (_) {}
  return MAPS_DEF[m] && (MAPS_READY.includes(m) || dev) ? m : 'island';
})();
const MAPDEF = MAPS_DEF[MAP_ID];
applyMapIntro();
// the grid as GLSL literals: world → map texture coordinates
const GL_HALF = MAPDEF.half.toFixed(1), GL_STEP = MAPDEF.step.toFixed(1), GL_N = MAPDEF.n.toFixed(1), GL_NM2 = (MAPDEF.n - 2).toFixed(1), GL_NI = MAPDEF.n - 1;
const GL_MAPUV = (v) => `((${v} + ${GL_HALF}) / ${GL_STEP} + 0.5) / ${GL_N}`;

/* ───────── quality ───────── */
const IS_SMALL = Math.min(innerWidth, innerHeight) < 600 || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent || '');
const QLEVEL = (() => { let q = null; try { q = localStorage.getItem('rock-island-q4'); } catch (_) {} return ['ultra', 'high', 'mid', 'low'].includes(q) ? q : IS_SMALL ? 'mid' : 'high'; })();
const QT = { ultra: 3, high: 2, mid: 1, low: 0 }[QLEVEL];
const qsel = (low, mid, high, ultra) => [low, mid, high, ultra][QT];
const QUALITY = {
  level: QLEVEL, tier: QT,
  ratio: Math.min(window.devicePixelRatio || 1, qsel(1, 1.25, 1.6, 2)),
  scale: 1,
  post: QT >= 1, bloom: QT >= 2, godrays: QT >= 1, fxaa: QT >= 1,
  shadows: QT >= 1, shadowSize: qsel(512, 1024, 2048, 4096), shadowDist: qsel(30, 42, 64, 90),
  terrainK: qsel(1.25, 1.55, 1.95, 2.4), terrainMin: qsel(128, 64, 64, 32),
  treeL0: qsel(14, 24, 36, 55), treeL1: qsel(48, 72, 110, 170), treeFar: qsel(600, 950, 1400, 2000),
  grassR: qsel(16, 28, 40, 56), grassDen: qsel(0.32, 0.6, 0.85, 1.0),
  view: qsel(1500, 2200, 3000, 3800),
  texSize: qsel(256, 512, 512, 1024),
  zombies: qsel(6, 9, 12, 16), bots: qsel(3, 5, 7, 10), animals: qsel(8, 14, 20, 28), traffic: qsel(2, 4, 6, 9),
  waterSeg: qsel(96, 140, 190, 240),
};

/* ───────── the player's settings (graphics, controls, sound, interface, accessibility): kept on this device ───────── */
const SET_KEY = 'rock-island-settings-v1';
const SET_DEFAULT = {
  fps: 60, res: 1, rh: 0, dynres: true, sv: 0, foliage: 1, view: 1, shadows: 'auto', bloom: 'auto', rays: 'auto', fov: 62,
  sens: 1, aimSens: 1, invertY: false, autoJump: true, vibrate: true, keys: {},
  vMaster: 0.9, vMusic: 0.45, vSfx: 1, vAmb: 0.8, vVoice: 1, vChat: 1, spatial: true, subs: false,
  hudMini: true, hudVitals: true, hudCompass: true, hudKills: true, hudRes: true, hudName: true, uiScale: 1, marks: true, lang: 'ar',
  cb: 'none', shake: 1, motion: false, aimAssist: false, autoLoot: true, planeDrop: true, devTeleport: true, lobbyBg: 'hall',
  gmRes: 0, sfTok: '',
};
const SET = (() => {
  let o = {}; try { o = JSON.parse(localStorage.getItem(SET_KEY) || '{}') || {}; } catch (_) {}
  const s = JSON.parse(JSON.stringify(SET_DEFAULT));
  for (const k of Object.keys(s)) if (o[k] !== undefined && o[k] !== null && typeof o[k] === typeof s[k]) s[k] = o[k];
  return s;
})();
function saveSettings() { try { localStorage.setItem(SET_KEY, JSON.stringify(SET)); } catch (_) {} }
// settings saved before the frame cap existed ran unlimited (a hot phone on a 120 Hz screen): they start at 60 once
if (SET.sv < 2) { if (SET.fps === 0) SET.fps = 60; SET.sv = 2; saveSettings(); }
/* the picture's size is a height in real pixels (720p, 1080p, 1440p, 4K), the same on every screen whatever its density;
   'auto' takes the quality level's size but never more than the screen itself has */
const RES_STEPS = [[540, '٥٤٠'], [720, '٧٢٠'], [900, '٩٠٠'], [1080, '١٠٨٠'], [1440, '١٤٤٠'], [2160, '4K']];
function renderRatio() {
  const dpr = window.devicePixelRatio || 1, short = Math.max(200, Math.min(innerWidth, innerHeight));
  const auto = Math.min(qsel(540, 720, 1080, 1440), short * dpr);
  const r = clamp((SET.rh || auto) / short, 0.5, Math.max(1, dpr) * 2);
  let d = 1; try { d = DYNRES.scale; } catch (_) {}         // (not made yet while the renderer is being set up)
  return r * d;
}
function applyQualityOverrides() {
  if (SET.shadows !== 'auto') { QUALITY.shadows = SET.shadows !== 'off'; if (QUALITY.shadows) { QUALITY.shadowSize = { low: 1024, mid: 2048, high: 4096 }[SET.shadows] || 2048; QUALITY.shadowDist = { low: 36, mid: 56, high: 80 }[SET.shadows] || 56; } }
  QUALITY.bloom = QUALITY.post && (SET.bloom === 'auto' ? QT >= 2 : SET.bloom === 'on');
  QUALITY.godrays = QUALITY.post && (SET.rays === 'auto' ? QT >= 1 : SET.rays === 'on');
}
applyQualityOverrides();

/* when a phone stays slow even at the lowest render scale, detail gives way step by step (and comes back when it is fast again) */
// what the frame shows: the island, or (in the lobby) a scanned room of its own (40_rooms)
const VIEW = { scene: null };
const STRAIN = { level: 0, grassK: 1, viewK: 1, shadowEvery: 1, shafts: true, bad: 0, good: 0 };
function setStrain(l) {
  STRAIN.level = clamp(l, 0, 3);
  STRAIN.grassK = [1, 0.8, 0.65, 0.5][STRAIN.level]; STRAIN.viewK = [1, 1, 0.8, 0.65][STRAIN.level];
  STRAIN.shadowEvery = [1, 3, 4, 6][STRAIN.level]; STRAIN.shafts = STRAIN.level < 1;
}
/* ───────── renderer, scene, camera ───────── */
const canvas = $('scene');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: !QUALITY.post, powerPreference: 'high-performance', stencil: false }); }
catch (e) { failBoot('هذا الجهاز لا يدعم الرسوم ثلاثية الأبعاد (WebGL). جرّب متصفحاً آخر.'); throw e; }
if (!renderer.capabilities.isWebGL2) { failBoot('تحتاج هذه النسخة متصفحاً حديثاً يدعم WebGL2 (كروم أو سفاري أو فايرفوكس محدّث).'); throw new Error('WebGL2 required'); }
renderer.setPixelRatio(renderRatio());
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = QUALITY.shadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = true;
const GL = renderer.getContext();
const MAX_ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 4);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(C(0xcfe5ea), 0.0009, 10.012);   // packed: near = density, far = base height + falloff
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.08, QUALITY.view);
scene.add(camera);

/* ───────── height fog: every built-in material fogs by distance and by altitude (valley mist, rain haze) ─────────
   three.js only uploads near/far for THREE.Fog, so they carry the density and the packed height parameters */
const FOG = { density: 0.0009, height: 10.0, falloff: 0.012 };
THREE.ShaderChunk.fog_pars_vertex = '#ifdef USE_FOG\n varying float vFogDepth; varying float vFogH;\n#endif';
THREE.ShaderChunk.fog_vertex = '#ifdef USE_FOG\n vFogDepth = length(mvPosition.xyz); vFogH = cameraPosition.y + (transpose(mat3(viewMatrix)) * mvPosition.xyz).y;\n#endif';
THREE.ShaderChunk.fog_pars_fragment = `#ifdef USE_FOG
  uniform vec3 fogColor; varying float vFogDepth; varying float vFogH;
  uniform float fogNear; uniform float fogFar;
  float heightFogAmount(float dist, float hc, float hp, float dens, float h0, float k){
    float a = exp(-k * (hc - h0)), b = exp(-k * (hp - h0)), dh = hp - hc;
    float od = abs(dh) > 0.05 ? (a - b) / (k * dh) : a;
    return 1.0 - exp(-dens * dist * clamp(od, 0.0, 40.0));
  }
#endif`;
THREE.ShaderChunk.fog_fragment = `#ifdef USE_FOG
  float fogFactor = heightFogAmount(vFogDepth, cameraPosition.y, vFogH, fogNear, floor(fogFar), max(fract(fogFar), 0.0005));
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
#endif`;
function setFog(density, h0, k) { scene.fog.near = density; scene.fog.far = Math.floor(h0) + clamp(k, 0.0005, 0.999); }
/* lamps, fires, the muzzle flash and the flashlight are in every lit shader all the time, mostly dark: their lighting maths
   (the costly part of a pixel) now runs only where a light actually reaches — one test instead of a full light per pixel */
{
  const lit = 'if ( directLight.color.r + directLight.color.g + directLight.color.b > 0.0 ) RE_Direct( directLight, geometry, material, reflectedLight );';
  const src = THREE.ShaderChunk.lights_fragment_begin;
  const out = src.replace(/(getPointDirectLightIrradiance\( pointLight, geometry, directLight \);[\s\S]*?)RE_Direct\( directLight, geometry, material, reflectedLight \);/, '$1' + lit)
    .replace(/(getSpotDirectLightIrradiance\( spotLight, geometry, directLight \);[\s\S]*?)RE_Direct\( directLight, geometry, material, reflectedLight \);/, '$1' + lit);
  if (out.split(lit).length === 3) THREE.ShaderChunk.lights_fragment_begin = out; else console.warn('light skip patch did not apply');
}
/* the same fog in GLSL for custom shaders (water, grass): include FOG_GLSL and call applyFog(col, dist, worldY) */
const FOG_U = { fogCol: { value: new THREE.Color() }, fogP: { value: new THREE.Vector3() } };
const FOG_GLSL = `uniform vec3 fogCol; uniform vec3 fogP;
  vec3 applyFog(vec3 col, float dist, float wy){
    float a = exp(-fogP.z * (cameraPosition.y - fogP.y)), b = exp(-fogP.z * (wy - fogP.y)), dh = wy - cameraPosition.y;
    float od = abs(dh) > 0.05 ? (a - b) / (fogP.z * dh) : a;
    return mix(col, fogCol, 1.0 - exp(-fogP.x * dist * clamp(od, 0.0, 40.0)));
  }`;

/* ───────── lights ───────── */
const ENV = {
  hour: 9.0, night: 0, day: 1, dusk: 0, lamps: 0, sunUp: 1,
  sunDir: new THREE.Vector3(-0.4, 0.7, 0.5).normalize(), moonDir: new THREE.Vector3(0.3, 0.6, -0.5).normalize(), lightDir: new THREE.Vector3(),
  nightMode: 'short', weatherMode: 'auto', dayMin: 26, nightMin: 2.6,
};
try { const nm = localStorage.getItem('rock-island-night'); if (nm === 'short' || nm === 'off') ENV.nightMode = nm; const wm = localStorage.getItem('rock-island-weather'); if (wm === 'auto' || wm === 'clear') ENV.weatherMode = wm; } catch (_) {}
const ENV_MATS = [];
const hemi = new THREE.HemisphereLight(C(0xcde8f2), C(0x8a7d5e), 0.4); scene.add(hemi);
const sun = new THREE.DirectionalLight(C(0xfff0d4), 2.6);
sun.castShadow = QUALITY.shadows;
const SH = QUALITY.shadowDist;
Object.assign(sun.shadow.camera, { left: -SH, right: SH, top: SH, bottom: -SH, near: 1, far: 700 });
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.mapSize.set(QUALITY.shadowSize, QUALITY.shadowSize);
sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.4;
scene.add(sun, sun.target);
const _snap = new THREE.Vector3();
function placeSun(x, y, z) {
  const texel = (SH * 2) / sun.shadow.mapSize.x;
  _snap.set(Math.round(x / texel) * texel, Math.round(y / texel) * texel, Math.round(z / texel) * texel);
  sun.target.position.copy(_snap); sun.position.copy(_snap).addScaledVector(ENV.lightDir, 320); sun.target.updateMatrixWorld();
}
const flash = new THREE.SpotLight(C(0xfff1d8), 0, 52, 0.5, 0.55, 1.6);
const flashTarget = new THREE.Object3D(); scene.add(flash, flashTarget); flash.target = flashTarget;
const POOL = [0, 1, 2, 3].map(() => { const l = new THREE.PointLight(C(0xffc98a), 0, 18, 2); scene.add(l); return l; });
const muzzleLight = new THREE.PointLight(C(0xffc070), 0, 16, 2); scene.add(muzzleLight);
// lightning lights the world through the sky light (a second sun in every shader cost more than the flash is worth)
const _flashCol = new THREE.Color(0.87, 0.91, 1.0);

/* ───────── weather: clouds, rain (snow in the cold), fog, wind, wet ground ───────── */
const WEATHER = { cloud: 0.25, rain: 0, fog: 0, wind: 0.3, wet: 0, storm: 0, snow: 0, t: 120, state: 'clear', target: null, flash: 0, nextFlash: 8, local: 1 };
const W_STATES = {
  clear: { cloud: 0.18, rain: 0, fog: 0.0, wind: 0.25, storm: 0 },
  fair: { cloud: 0.42, rain: 0, fog: 0.05, wind: 0.35, storm: 0 },
  cloudy: { cloud: 0.72, rain: 0, fog: 0.12, wind: 0.5, storm: 0 },
  drizzle: { cloud: 0.86, rain: 0.35, fog: 0.3, wind: 0.45, storm: 0 },
  rain: { cloud: 0.95, rain: 0.75, fog: 0.42, wind: 0.65, storm: 0.15 },
  storm: { cloud: 1.0, rain: 1.0, fog: 0.55, wind: 0.95, storm: 1 },
  mist: { cloud: 0.55, rain: 0, fog: 0.85, wind: 0.1, storm: 0 },
  sand: { cloud: 0.3, rain: 0, fog: 0.55, wind: 1.0, storm: 0, dust: 1 },          // a sandstorm: the desert's weather
  blizzard: { cloud: 1.0, rain: 1.0, fog: 0.8, wind: 1.0, storm: 0.1 },           // snow driven sideways (the cold makes it snow)
};
const W_NEXT = { clear: [['clear', 3], ['fair', 4], ['mist', 0.6]], fair: [['clear', 2], ['cloudy', 3], ['fair', 1]], cloudy: [['fair', 2], ['drizzle', 2.2], ['rain', 1.5]],
  drizzle: [['cloudy', 2], ['rain', 2]], rain: [['drizzle', 1.5], ['storm', 1.0], ['cloudy', 1.5]], storm: [['rain', 2], ['cloudy', 1]], mist: [['fair', 2], ['clear', 1]] };
// every map has its own sky: the desert's sandstorms, the snow land's blizzards, the sea's squalls, the forest's mists
const W_NEXT_BY = {
  desert: { clear: [['clear', 4], ['fair', 3], ['sand', 1.1]], fair: [['clear', 3], ['sand', 1.4], ['cloudy', 0.4]], cloudy: [['fair', 3], ['drizzle', 0.3]], drizzle: [['cloudy', 1]], rain: [['cloudy', 1]], storm: [['rain', 1]], mist: [['clear', 1]], sand: [['fair', 2], ['clear', 1.2]], blizzard: [['clear', 1]] },
  snow: { clear: [['fair', 3], ['cloudy', 2], ['mist', 1]], fair: [['cloudy', 3], ['clear', 1]], cloudy: [['drizzle', 2], ['rain', 2], ['fair', 1]], drizzle: [['rain', 2], ['cloudy', 1]], rain: [['blizzard', 1.2], ['drizzle', 1], ['cloudy', 1]], storm: [['rain', 1]], blizzard: [['rain', 2], ['cloudy', 1]], mist: [['cloudy', 1], ['fair', 1]], sand: [['clear', 1]] },
  water: { clear: [['clear', 2], ['fair', 3]], fair: [['cloudy', 3], ['clear', 1]], cloudy: [['rain', 2], ['drizzle', 1.5], ['fair', 1]], drizzle: [['rain', 2], ['cloudy', 1]], rain: [['storm', 1.8], ['drizzle', 1], ['cloudy', 1]], storm: [['rain', 2], ['cloudy', 0.6]], mist: [['fair', 1]], sand: [['clear', 1]], blizzard: [['rain', 1]] },
  forest: { clear: [['fair', 3], ['mist', 1.6]], fair: [['clear', 1], ['cloudy', 2.5], ['mist', 1]], cloudy: [['fair', 2], ['drizzle', 2], ['mist', 1]], drizzle: [['cloudy', 2], ['rain', 1.6], ['mist', 1]], rain: [['drizzle', 2], ['storm', 0.8], ['mist', 1]], storm: [['rain', 2]], mist: [['fair', 1.5], ['mist', 1], ['drizzle', 0.8]], sand: [['clear', 1]], blizzard: [['rain', 1]] },
};
function weatherPick(from) { const opts = (W_NEXT_BY[WEATHER.climate] || W_NEXT)[from] || W_NEXT.clear; let tot = opts.reduce((s, o) => s + o[1], 0), r = Math.random() * tot; for (const [k, w] of opts) { if ((r -= w) <= 0) return k; } return opts[0][0]; }
function setWeather(state, instant) { WEATHER.state = state; WEATHER.target = W_STATES[state]; WEATHER.t = state === 'clear' ? rr(200, 420) : rr(120, 300); if (instant) Object.assign(WEATHER, W_STATES[state]); }
setWeather('clear', true);
function updateWeather(dt, localDry, cold) {
  const W = WEATHER;
  if (W.lock) W.t = 999;                  // the lobby keeps its own misty morning
  else if (ENV.weatherMode === 'clear') { if (W.state !== 'clear' && W.state !== 'fair') setWeather('clear'); W.t = 999; }
  else if (ENV.weatherMode === 'rain') { if (W.state !== 'rain' && W.state !== 'storm') setWeather('rain'); W.t = 999; }
  else if ((W.t -= dt) <= 0) setWeather(weatherPick(W.state));
  const tg = W.target, k = 1 - Math.exp(-dt / 25);
  W.cloud = lerp(W.cloud, tg.cloud, k); W.fog = lerp(W.fog, tg.fog, k); W.wind = lerp(W.wind, tg.wind, k); W.storm = lerp(W.storm, tg.storm, k); W.dust = lerp(W.dust || 0, tg.dust || 0, k * 1.6);
  W.rain = lerp(W.rain, tg.rain * (1 - localDry * 0.85), 1 - Math.exp(-dt / 12));
  W.snow = smooth(0.25, 0.6, cold) * W.rain;
  W.wet = clamp(W.wet + (W.rain > 0.08 ? W.rain * dt / 40 : -dt / 260), 0, 1);
  // lightning
  W.flash = Math.max(0, W.flash - dt * 6);
  if (W.storm > 0.5 && (W.nextFlash -= dt) <= 0) { W.nextFlash = rr(5, 16); W.flash = 1; W.thunder = rr(0.6, 3.5); }
  if (W.thunder !== undefined) { W.thunder -= dt; if (W.thunder <= 0) { delete W.thunder; if (typeof AUDIO !== 'undefined') AUDIO.thunder(); } }
}

/* ───────── sky dome: atmosphere, sun, moon, stars, two cloud layers, overcast ───────── */
/* the clouds come from a tiling fbm texture painted once on the GPU: three lookups per sky pixel instead of eighteen noise sums,
   and the mip chain keeps the far clouds soft instead of shimmering */
const CLOUD_TEX = (() => {
  const rt = new THREE.WebGLRenderTarget(512, 512, { minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping, depthBuffer: false, stencilBuffer: false });
  rt.texture.generateMipmaps = true;
  const m = new THREE.ShaderMaterial({
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `varying vec2 vUv;
      float h2(vec2 p, float P){ p = mod(p, P); return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n2(vec2 p, float P){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h2(i, P), h2(i + vec2(1.0, 0.0), P), f.x), mix(h2(i + vec2(0.0, 1.0), P), h2(i + vec2(1.0, 1.0), P), f.x), f.y); }
      float fbm(vec2 p, float P){ float s = 0.0, a = 0.5; for (int i = 0; i < 7; i++) { s += a * n2(p, P); p = p * 2.0 + vec2(1.0, 3.0); P *= 2.0; a *= 0.5; } return s / 0.992; }
      void main(){ vec2 p = vUv * 8.0; gl_FragColor = vec4(fbm(p, 8.0), fbm(p + vec2(3.0, 5.0), 8.0), fbm(p + vec2(6.0, 1.0), 8.0), 1.0); }`,
    depthTest: false, depthWrite: false,
  });
  const scn = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m);
  q.frustumCulled = false; scn.add(q);
  try { const old = renderer.getRenderTarget(); renderer.setRenderTarget(rt); renderer.render(scn, cam); renderer.setRenderTarget(old); } catch (e) { console.warn('clouds', e); }
  q.geometry.dispose(); m.dispose();
  return rt.texture;
})();
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { uTop: { value: C(0x4f9fd2) }, uHor: { value: C(0xcfe5ea) }, uSun: { value: ENV.sunDir }, uSunCol: { value: C(0xfff2cf) }, uMoon: { value: ENV.moonDir }, uNight: { value: 0 }, uDay: { value: 1 },
    uCloud: { value: C(0xf4f4f0) }, uCloudShade: { value: C(0x8a96a6) }, uTime: { value: 0 }, uCover: { value: 0.25 }, uRain: { value: 0 }, uFlash: { value: 0 }, uFogCol: { value: C(0xcfe5ea) }, uHaze: { value: 0 }, tCloud: { value: CLOUD_TEX } },
  vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w; }',
  fragmentShader: `uniform vec3 uTop, uHor, uSun, uSunCol, uMoon, uCloud, uCloudShade, uFogCol; uniform float uNight, uDay, uTime, uCover, uRain, uFlash, uHaze; uniform sampler2D tCloud; varying vec3 vDir;
    void main(){
      vec3 d = normalize(vDir); float h = max(d.y, 0.0);
      vec3 col = mix(uHor, uTop, pow(h, 0.45));
      float s = max(dot(d, uSun), 0.0), up = smoothstep(-0.1, 0.06, uSun.y);
      // mie halo grows near the horizon, the disk is hidden by clouds below
      col += uSunCol * (pow(s, 7.0) * 0.22 + pow(s, 48.0) * 0.6) * up * (1.0 - smoothstep(0.35, 0.95, uCover) * 0.92);
      float m = max(dot(d, uMoon), 0.0);
      col += vec3(0.75, 0.82, 1.0) * (smoothstep(0.9993, 0.9996, m) * 1.6 + pow(m, 60.0) * 0.05) * uNight;
      float cl = 0.0, shade = 0.0;
      if (d.y > -0.02) {
        vec2 uv = d.xz / (d.y + 0.16) * 0.55;
        vec2 wind = vec2(uTime * 0.006, uTime * 0.0032);
        float base = texture2D(tCloud, (uv * 1.3 + wind) * 0.125).r;
        float detail = texture2D(tCloud, (uv * 4.2 + wind * 2.3) * 0.125).g;
        float cov = mix(0.62, 0.22, uCover);
        cl = smoothstep(cov, cov + 0.32, base * 0.8 + detail * 0.3) * smoothstep(-0.02, 0.18, d.y);
        float cir = smoothstep(0.55, 0.85, texture2D(tCloud, (vec2(uv.x * 0.6, uv.y * 3.0) + wind * 0.5) * 0.125).b) * 0.35 * (1.0 - uCover) * smoothstep(0.05, 0.3, d.y);
        float light = clamp(1.0 - (detail - 0.45) * 1.6, 0.0, 1.0);
        vec3 cc = mix(uCloudShade, uCloud, light * (0.55 + 0.45 * up)) + uSunCol * pow(s, 5.0) * 0.6 * up * (1.0 - uCover * 0.7);
        col = mix(col, cc, clamp(cl * (0.8 + uCover * 0.2) + cir, 0.0, 1.0));
        // overcast: a heavy grey lid
        col = mix(col, uCloudShade * (0.85 + 0.25 * up) + uSunCol * 0.04, smoothstep(0.6, 1.0, uCover) * 0.85);
      }
      col *= 1.0 - uRain * 0.25;
      col += vec3(0.6, 0.65, 0.8) * uFlash * (0.6 + 0.4 * cl);
      // horizon haze meets the fog colour
      float hz = 1.0 - smoothstep(-0.02, 0.22 + uHaze * 0.35, d.y);
      col = mix(col, uFogCol, hz * (0.55 + uHaze * 0.45));
      if (d.y < 0.0) col = mix(col, uFogCol, smoothstep(0.0, -0.08, d.y));
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <encodings_fragment>
    }`,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 20), skyMat);
// the sky is drawn last, only where nothing else covers it (it used to fill the whole screen first)
sky.renderOrder = 50; sky.frustumCulled = false; scene.add(sky);
const stars = (() => {
  const n = 2200, p = new Float32Array(n * 3), r0 = RNG(77);
  for (let i = 0; i < n; i++) { const y = Math.pow(r0(), 0.7), a = r0() * TAU, r = Math.sqrt(1 - y * y); p[i * 3] = Math.cos(a) * r; p[i * 3 + 1] = y - 0.02; p[i * 3 + 2] = Math.sin(a) * r; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const m = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false }));
  m.renderOrder = -1; m.frustumCulled = false; scene.add(m); return m;
})();

/* ───────── day & night: long days, short nights (or no night at all) ───────── */
const ENV_HOOKS = [];
const KEY = {
  top: [C(0x03060d), C(0x3a4f7a), C(0x4a96cf)], hor: [C(0x070d18), C(0xe39a6a), C(0xc6e0ea)],
  fog: [C(0x05090f), C(0xb98068), C(0xc4dbe3)], hsky: [C(0x22324e), C(0xd4a07a), C(0xcde8f2)],
  hgnd: [C(0x07090c), C(0x5a4636), C(0x7a6e52)], sun: [C(0x8fa8da), C(0xffa25a), C(0xfff0d8)],
  deep: [C(0x01060a), C(0x123241), C(0x14495a)], shallow: [C(0x061a1c), C(0x3c8a84), C(0x4fb9ad)],
  cloud: [C(0x0b0f18), C(0xe4987a), C(0xf2f2ee)], cshade: [C(0x05070c), C(0x6a5a62), C(0x8f9aaa)],
};
const OVERCAST = { top: C(0x7d8a96), hor: C(0xa9b2ba), fog: C(0x9aa3ab), sun: C(0xc8ccd2), cloud: C(0xb8bec4), cshade: C(0x5e666e) };
function mixKey(arr, out) {
  out.r = arr[0].r * ENV.night + arr[1].r * ENV.dusk + arr[2].r * ENV.day;
  out.g = arr[0].g * ENV.night + arr[1].g * ENV.dusk + arr[2].g * ENV.day;
  out.b = arr[0].b * ENV.night + arr[1].b * ENV.dusk + arr[2].b * ENV.day;
  return out;
}
const _oc = new THREE.Color();
function overcast(out, key, k) { _oc.copy(OVERCAST[key]).multiplyScalar(0.12 + 0.88 * (ENV.day + ENV.dusk * 0.6)); return out.lerp(_oc, k); }
let T_ENV = 0;
function timeRate() {
  // hours per real second: daytime is slow, night races by
  const h = ENV.hour, dayLen = 13, nightLen = 11;
  const dayRate = dayLen / (ENV.dayMin * 60), nightRate = ENV.nightMode === 'off' ? nightLen / 7 : nightLen / (ENV.nightMin * 60);
  const nightness = h < 6 || h >= 19 ? 1 : h < 6.6 ? 1 - (h - 6) / 0.6 : h > 18.4 ? (h - 18.4) / 0.6 : 0;
  return lerp(dayRate, nightRate, nightness);
}
let lastFar = 0;
const DUST_COL = C(0xc9965c), _dust = new THREE.Color();
function updateEnvironment(dt, advance) {
  if (advance) ENV.hour = (ENV.hour + dt * timeRate()) % 24;
  const a = (ENV.hour - 6) / 12 * Math.PI;
  ENV.sunDir.set(Math.cos(a), Math.sin(a) * 0.95, 0.32 + 0.18 * Math.sin(a)).normalize();
  ENV.moonDir.set(-Math.cos(a) * 0.8, Math.max(0.35, -Math.sin(a)) * 0.95, -0.35).normalize();
  const e = ENV.sunDir.y;
  // a long golden hour and a real twilight: the sky keeps its glow until the sun is ~12° below the horizon
  ENV.day = smooth(0.0, 0.3, e); ENV.night = smooth(-0.05, -0.22, e); ENV.dusk = Math.max(0, 1 - ENV.day - ENV.night);
  const W = WEATHER, oc = smooth(0.55, 1.0, W.cloud) * 0.9 + W.rain * 0.1;
  ENV.lamps = clamp(smooth(0.14, -0.02, e) + oc * 0.35 * ENV.day * (W.rain > 0.4 ? 1 : 0), 0, 1);
  const su = skyMat.uniforms;
  mixKey(KEY.top, su.uTop.value); mixKey(KEY.hor, su.uHor.value); mixKey(KEY.sun, su.uSunCol.value); mixKey(KEY.cloud, su.uCloud.value); mixKey(KEY.cshade, su.uCloudShade.value);
  overcast(su.uTop.value, 'top', oc); overcast(su.uHor.value, 'hor', oc * 0.9); overcast(su.uCloud.value, 'cloud', oc * 0.7); overcast(su.uCloudShade.value, 'cshade', oc * 0.6);
  su.uNight.value = ENV.night * (1 - W.cloud * 0.8); su.uDay.value = ENV.day; su.uTime.value = T_ENV; su.uCover.value = W.cloud; su.uRain.value = W.rain; su.uFlash.value = W.flash * W.storm;
  mixKey(KEY.fog, scene.fog.color); overcast(scene.fog.color, 'fog', clamp(oc + W.fog * 0.6, 0, 1));
  if (W.dust > 0.005) {      // a sandstorm turns the air the colour of the dunes
    const dl = 0.25 + 0.75 * Math.max(ENV.day, ENV.dusk * 0.5);
    _dust.copy(DUST_COL).multiplyScalar(dl); scene.fog.color.lerp(_dust, W.dust * 0.85); su.uHor.value.lerp(_dust, W.dust * 0.75); su.uTop.value.lerp(_dust, W.dust * 0.45);
  }
  su.uFogCol.value.copy(scene.fog.color); su.uHaze.value = clamp(W.fog + W.rain * 0.6, 0, 1);
  // fog: base haze + weather; height falloff keeps valleys misty
  const viewK = 2200 / (QUALITY.view * STRAIN.viewK * SET.view);
  FOG.density = (0.00042 * viewK + ENV.night * 0.0016 + ENV.dusk * 0.0003 + W.fog * 0.0042 + W.rain * 0.0028 + (W.dust || 0) * 0.0065) * (1 + WATERVIEW.under * 30);
  FOG.height = lerp(10, 40, W.fog); FOG.falloff = lerp(0.012, 0.004, W.fog);
  setFog(FOG.density, FOG.height, FOG.falloff);
  FOG_U.fogCol.value.copy(scene.fog.color); FOG_U.fogP.value.set(FOG.density, FOG.height, FOG.falloff);
  mixKey(KEY.hsky, hemi.color); mixKey(KEY.hgnd, hemi.groundColor); overcast(hemi.color, 'hor', oc * 0.7);
  hemi.intensity = (0.11 * ENV.night + 0.34 * ENV.dusk + 0.42 * ENV.day) * (1 + oc * 0.55);
  const sunI = smooth(-0.06, 0.1, e) * (0.9 + 2.1 * ENV.day) * (1 - oc * 0.82) * (1 - (W.dust || 0) * 0.5), moonI = 0.3 * ENV.night * (1 - W.cloud * 0.6);
  if (sunI >= moonI) { ENV.lightDir.copy(ENV.sunDir); mixKey(KEY.sun, sun.color); sun.intensity = sunI; }
  else { ENV.lightDir.copy(ENV.moonDir); sun.color.copy(C(0x9db4e6)); sun.intensity = moonI; }
  ENV.sunVis = sunI >= moonI ? (1 - oc) * smooth(-0.02, 0.12, e) : 0;
  const fl = W.flash * W.storm; if (fl > 0.001) { hemi.color.lerp(_flashCol, Math.min(1, fl)); hemi.intensity += fl * 2.4; }
  stars.material.opacity = ENV.night * 0.9 * (1 - W.cloud);
  renderer.toneMappingExposure = 1.0 + ENV.night * 0.38 + ENV.dusk * 0.1 + oc * 0.12;
  const ei = (0.06 + ENV.day * 0.8 + ENV.dusk * 0.35) * (1 - oc * 0.25);
  for (const m of ENV_MATS) m.envMapIntensity = ei;
  const VW = QUALITY.view * STRAIN.viewK * SET.view, far = Math.round(lerp(VW, VW * 0.45, Math.max(ENV.night * 0.7, W.fog * 0.6, W.rain * 0.5)) / 50) * 50;
  if (far !== lastFar) { camera.far = far; camera.updateProjectionMatrix(); lastFar = far; }
  for (const h of ENV_HOOKS) h(ENV);
}
const WATERVIEW = { under: 0, level: -1e9 };

/* ───────── sky-lit environment map for reflections, refreshed now and then ───────── */
const ENVMAP = (() => {
  let pmrem = null, rt = null, t = 0, lastHour = -9, lastCloud = -9;
  const cubeRT = new THREE.WebGLCubeRenderTarget(64, { generateMipmaps: false });
  const cubeCam = new THREE.CubeCamera(0.5, 10, cubeRT);
  const envScene = new THREE.Scene();
  const envSky = new THREE.Mesh(sky.geometry, skyMat); envScene.add(envSky);
  const groundMat = new THREE.MeshBasicMaterial({ color: C(0x56604a), side: THREE.BackSide, fog: false });
  const ground = new THREE.Mesh(new THREE.SphereGeometry(4, 16, 8, 0, TAU, Math.PI * 0.52, Math.PI * 0.48), groundMat); envScene.add(ground);
  return {
    update(dt, force) {
      t -= dt;
      if (!force && t > 0 && Math.abs(ENV.hour - lastHour) < 0.6 && Math.abs(WEATHER.cloud - lastCloud) < 0.15) return;
      t = 20; lastHour = ENV.hour; lastCloud = WEATHER.cloud;
      envSky.scale.setScalar(5);
      groundMat.color.copy(hemi.groundColor).multiplyScalar(0.6 + 0.4 * ENV.day);
      const oldTarget = renderer.getRenderTarget();
      cubeCam.update(renderer, envScene);
      if (!pmrem) pmrem = new THREE.PMREMGenerator(renderer);
      const nrt = pmrem.fromCubemap(cubeRT.texture);
      if (rt) rt.dispose();
      rt = nrt; scene.environment = rt.texture;
      renderer.setRenderTarget(oldTarget);
    },
  };
})();

/* ───────── detail texture: plaster (R), wood planks (G), stone (B), fine weave (A), all tileable ───────── */
function pnoise(x, y, P) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const h = (a, b) => hash(((a % P) + P) % P, ((b % P) + P) % P);
  const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function pnoise2(x, y, Px, Py) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const h = (a, b) => hash(((a % Px) + Px) % Px, ((b % Py) + Py) % Py);
  const A = h(xi, yi), B = h(xi + 1, yi), Cc = h(xi, yi + 1), D = h(xi + 1, yi + 1);
  return A + (B - A) * u + (Cc - A) * v + (A - B - Cc + D) * u * v;
}
// tiling fbm with its own period on each axis (stretched grain that still wraps cleanly)
function pfbm2(x, y, Px, Py, o) { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < o; i++) { s += a * pnoise2(x * f + i * 13, y * f - i * 7, Px * f, Py * f); n += a; a *= 0.5; f *= 2; } return s / n; }
function pfbm(x, y, P, o) { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < o; i++) { s += a * pnoise(x * f + i * 13, y * f - i * 7, P * f); n += a; a *= 0.5; f *= 2; } return s / n; }
const DETAIL = (() => {
  const N = 256, P = 8, d = new Uint8Array(N * N * 4);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = i / N * P, y = j / N * P, k = (j * N + i) * 4, g = hash(i, j) - 0.5;
    const pl = pfbm(x, y, P, 5), stain = smooth(0.62, 0.8, pfbm(x * 0.5 + 3, y * 0.5 + 1, P / 2, 3));
    d[k] = clamp((0.55 + (pl - 0.5) * 0.7 - stain * 0.35 + g * 0.1) * 255, 0, 255);
    const plank = Math.floor(y / 2), seam = (y % 2) < 0.05 || ((x + plank * 2.7) % 8) < 0.06;
    const grain = 0.5 + 0.28 * Math.sin(y * TAU * 2 + pfbm(x * 0.5 + plank * 5, y * 2, P, 3) * 9) + (pfbm(x, y * 4, P, 2) - 0.5) * 0.3;
    d[k + 1] = clamp((seam ? 0.12 : grain * 0.85 + 0.1 + (hash(plank, 7) - 0.5) * 0.25) * 255, 0, 255);
    const st = pfbm(x * 1.0 + 9, y * 1.0 - 4, P, 5), ridge = 1 - Math.abs(pfbm(x * 2, y * 2, P * 2, 3) * 2 - 1);
    d[k + 2] = clamp((0.25 + st * 0.75 - ridge * ridge * 0.25 + g * 0.18) * 255, 0, 255);
    d[k + 3] = clamp((0.5 + 0.18 * Math.sin(i * Math.PI / 2) * Math.sin(j * Math.PI / 2) + g * 0.3) * 255, 0, 255);
  }
  const t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.anisotropy = 4; t.needsUpdate = true;
  return t;
})();
/* ───────── surface patterns for the props (kept apart from DETAIL, which the ground and roads read as noise):
   R plaster (as DETAIL), G lap siding / planks, B stone masonry, A weave ───────── */
const DETAIL2 = (() => {
  const N = 256, P = 8, d = new Uint8Array(N * N * 4), src = DETAIL.image.data, COURSE = P / 6, WID = [1.6, 2, 2.6667, 2, 1.6, 2.6667];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = i / N * P, y = j / N * P, k = (j * N + i) * 4, g = hash(i + 7, j + 3) - 0.5;
    d[k] = src[k]; d[k + 3] = src[k + 3];
    // siding: 8 boards per repeat, a shadow under each board's lip, one butt joint per board, grain along the board
    const b = Math.floor(y), fy = y - b, jx = (x + hash(b, 11) * P) % P;
    const grain = 0.56 + 0.12 * Math.sin(x * TAU * 7 / P + b * 1.7 + pfbm2(x * 0.5, y * 4, 4, 32, 3) * 8) + (pfbm2(x * 2, y * 8, 16, 64, 2) - 0.5) * 0.3;
    let w = grain * (0.84 + (hash(b, 5) - 0.5) * 0.32) * (0.6 + 0.4 * smooth(0.0, 0.25, fy));
    if (fy < 0.05 || jx < 0.05) w = 0.12;
    d[k + 1] = clamp(w * 255, 0, 255);
    // masonry: six courses of staggered blocks in three widths, dark mortar, a tone per block, worn edges
    const R = Math.floor(y / COURSE), fr = y / COURSE - R, W = WID[R % 6], ox = ((x + hash(R, 3) * P) % P + P) % P, bi = Math.floor(ox / W), fx = ox / W - bi;
    const edge = Math.min(fr, 1 - fr, fx * W / COURSE, (1 - fx) * W / COURSE);
    const tone = 0.6 + (hash(R * 31 + bi, 17) - 0.5) * 0.34 + (pfbm(x + 9, y - 4, P, 4) - 0.5) * 0.45;
    d[k + 2] = clamp((edge < 0.05 ? 0.26 + g * 0.08 : tone * (0.78 + 0.22 * smooth(0.04, 0.16, edge))) * 255, 0, 255);
  }
  const t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.anisotropy = 4; t.needsUpdate = true;
  // each pattern's average tone: what a far wall fades to (the shader stops reading the pattern there)
  const avg = [0, 0, 0, 0]; for (let k = 0; k < d.length; k += 4) for (let c = 0; c < 4; c++) avg[c] += d[k + c];
  if (!t.userData) t.userData = {};   // (three r128 textures have no userData yet)
  t.userData.avg = new THREE.Vector4(...avg.map((v) => v / (N * N * 255)));
  return t;
})();
const MATID = { plaster: 0, wood: 1, stone: 2, metal: 3, fabric: 4, plain: 5, glass: 6 };
const K = MATID;
/* the wet look: every shaded surface darkens and turns glossy in the rain */
const WET_U = { value: 0 };
/* the ground height as a texture (half floats, 8 m grid): walls know where the mud splashes */
const HGT_U = { value: null };
/* the climate map (moisture, forest, temperature) for every shader: the cold north-east lies under snow all year.
   until the real map arrives a warm 1 × 1 stand-in keeps the world green */
const CLIMATE_U = { value: (() => { const t = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1, THREE.RGBAFormat); t.needsUpdate = true; return t; })() };
const SNOWC_U = { value: 0 };     // fresh snow from storms (0..1), the terrain and roofs share it
const WINTER_GLSL = `uniform sampler2D uClimate; uniform float uSnowC;
  float climT(vec2 xz){ return texture2D(uClimate, ${GL_MAPUV('xz')}).b; }
  float winterAt(vec2 xz){ float t = climT(xz); return max(smoothstep(0.40, 0.335, t), uSnowC * smoothstep(0.35, 0.15, t)); }`;
const WET_GLSL = `
  #ifdef WET_SURFACE
    float wetK = uWet * clamp(vWetUp * 1.4, 0.0, 1.0);
    diffuseColor.rgb *= 1.0 - wetK * 0.38;
  #endif`;
/* one material for every static prop: vertex colour × triplanar detail, roughness and metalness per surface kind */
// far from you a wall's fine pattern and rain streaks are below a pixel: beyond ~90 m they fade to their average and are not read
const UBER_OPT = { far: true };
function makeUber(opts = {}) {
  const { detailScale, objectSpace, interior, ...matOpts } = opts;
  const m = new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, roughness: 1, metalness: 0 }, matOpts));
  const space = objectSpace ? 'vWPos = transformed; vWNor = normalize(objectNormal);' : `#ifdef USE_INSTANCING
          vWPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz; vWNor = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
        #else
          vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz; vWNor = normalize(mat3(modelMatrix) * objectNormal);
        #endif`;
  m.customProgramCacheKey = () => 'uber6-' + (objectSpace ? 'obj' : interior ? 'in' : 'world') + (UBER_OPT.far ? 'f' : '');
  // weathering for the world-space props (walls, fences, poles): rain streaks, soft stains, mud along the foot of every wall,
  // and snow on whatever faces the sky in the cold; interiors and carried objects stay clean
  const lite = QUALITY.tier === 0;     // the lowest tier keeps only the snow
  const weather = 'float snowK = 0.0;' + (objectSpace || interior ? '' : lite ? `
        snowK = winterAt(vWPos.xz) * smoothstep(0.5, 0.85, normalize(vWNor).y) * step(vMat, 5.5);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.89, 0.93), snowK * 0.95);` : `
        {
          vec3 wn = normalize(vWNor); float vert = 1.0 - abs(wn.y);
          float wallK = vMat < 0.5 ? 1.0 : vMat < 1.5 ? 0.7 : vMat < 2.5 ? 1.0 : vMat > 4.5 && vMat < 5.5 ? 0.5 : 0.0;
          vec2 suv = vec2((abs(wn.x) > abs(wn.z) ? vWPos.z : vWPos.x) * 0.5, vWPos.y * 0.04);
          float streak = 0.0;
          #ifdef UBER_FAR
          if (uberFar < 0.999)
          #endif
          streak = smoothstep(0.52, 0.86, texture2D(uDetail, suv).b) * smoothstep(0.35, 0.85, texture2D(uDetail, suv * vec2(0.23, 0.6) + 0.31).r);
          #ifdef UBER_FAR
          streak *= 1.0 - uberFar;
          #endif
          float big = texture2D(uDetail, vWPos.xz * 0.011 + vWPos.y * 0.019 + 0.13).r;
          float gh = texture2D(uHgt, ${GL_MAPUV('vWPos.xz')}).r;
          float foot = (1.0 - smoothstep(0.0, 1.25, vWPos.y - gh)) * step(-2.0, vWPos.y - gh) * vert;
          diffuseColor.rgb *= 1.0 - streak * vert * wallK * 0.26;
          diffuseColor.rgb *= mix(1.0, mix(0.86, 1.07, big), wallK);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.58, 0.52, 0.44), foot * 0.6 * step(0.1, wallK));
          snowK = winterAt(vWPos.xz) * smoothstep(0.5, 0.85, wn.y) * step(vMat, 5.5) * (0.85 + 0.15 * big);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.89, 0.93), snowK * 0.95);
        }`);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uDetail = { value: DETAIL }; sh.uniforms.uDetail2 = { value: DETAIL2 }; sh.uniforms.uDtlAvg = { value: DETAIL2.userData.avg }; sh.uniforms.uScale = { value: detailScale || 0.45 }; sh.uniforms.uWet = WET_U; sh.uniforms.uHgt = HGT_U; sh.uniforms.uClimate = CLIMATE_U; sh.uniforms.uSnowC = SNOWC_U;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aMat; varying float vMat; varying vec3 vWPos; varying vec3 vWNor; varying float vWetUp;')
      .replace('#include <fog_vertex>', `#include <fog_vertex>
        vMat = aMat;
        ${space}
        vWetUp = ${objectSpace ? 'normalize(mat3(modelMatrix) * objectNormal).y' : 'vWNor.y'} * 0.5 + 0.5;`);
    sh.fragmentShader = '#define WET_SURFACE\n' + (UBER_OPT.far ? '#define UBER_FAR\n' : '') + sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D uDetail, uDetail2, uHgt; uniform float uScale, uWet; uniform vec4 uDtlAvg; varying float vMat; varying vec3 vWPos; varying vec3 vWNor; varying float vWetUp;
        ${WINTER_GLSL}
        vec4 triDetail(float sc){ vec3 w = pow(abs(normalize(vWNor)), vec3(4.0)); w /= (w.x + w.y + w.z);
          return texture2D(uDetail2, vWPos.zy * sc) * w.x + texture2D(uDetail2, vWPos.xz * sc) * w.y + texture2D(uDetail2, vWPos.xy * sc) * w.z; }
        // relief from the pattern: mortar and board seams catch the light (screen-space bump, no extra texture)
        vec3 bumpN(vec3 sp, vec3 sn, vec2 dH, float fd){ vec3 sx = dFdx(sp), sy = dFdy(sp), r1 = cross(sy, sn), r2 = cross(sn, sx);
          float det = dot(sx, r1) * fd; vec3 gr = sign(det) * (dH.x * r1 + dH.y * r2); return normalize(abs(det) * sn - gr); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float dk = vMat < 0.5 ? uDtlAvg.r : vMat < 1.5 ? uDtlAvg.g : vMat < 2.5 ? uDtlAvg.b : vMat < 4.5 ? uDtlAvg.a : 0.5, dkAvg = dk, uberFar = 0.0;
        #ifdef UBER_FAR
        uberFar = smoothstep(70.0, 90.0, length(vViewPosition));
        if (uberFar < 0.999) {
        #endif
        vec4 dtl = triDetail(uScale * (vMat > 0.5 && vMat < 1.5 ? 1.6 : 1.0));
        dk = vMat < 0.5 ? dtl.r : vMat < 1.5 ? dtl.g : vMat < 2.5 ? dtl.b : vMat < 4.5 ? dtl.a : 0.5;
        #ifdef UBER_FAR
        dk = mix(dk, dkAvg, uberFar);
        }
        #endif
        diffuseColor.rgb *= mix(0.66, 1.24, dk);` + weather + WET_GLSL)
      .replace('#include <roughnessmap_fragment>', `float roughnessFactor = vMat < 0.5 ? 0.9 : vMat < 1.5 ? 0.74 : vMat < 2.5 ? 0.95 : vMat < 3.5 ? 0.38 : vMat < 4.5 ? 0.98 : vMat < 5.5 ? 0.82 : 0.05;
        roughnessFactor = clamp(roughnessFactor + (dk - 0.5) * 0.2, 0.05, 1.0);
        roughnessFactor = mix(roughnessFactor, 0.18, wetK * (1.0 - snowK)); roughnessFactor = mix(roughnessFactor, 0.8, snowK);`)
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = (vMat > 2.5 && vMat < 3.5) ? 0.7 : 0.0;')
      .replace('#include <normal_fragment_maps>', lite ? '#include <normal_fragment_maps>' : `#include <normal_fragment_maps>
        { float bk = vMat < 0.5 ? 0.25 : vMat < 1.5 ? 0.7 : vMat < 2.5 ? 1.0 : 0.0;
          float hh = dk * bk * 0.025 * (1.0 - snowK) * (1.0 - smoothstep(25.0, 60.0, length(vViewPosition)));
          normal = bumpN(-vViewPosition, normal, vec2(dFdx(hh), dFdy(hh)), faceDirection); }`);
  };
  ENV_MATS.push(m);
  return m;
}
const UBER = makeUber();
const UBER_FLAT = makeUber({ flatShading: true });
const UBER_OBJ = makeUber({ objectSpace: true, detailScale: 2.6 });
const UBER_IN = makeUber({ interior: true });      // inside houses: no weather, no snow on the floors

/* ───────── merge builder: static props become one draw call per group ───────── */
const G = {
  box: new THREE.BoxGeometry(1, 1, 1), cyl6: new THREE.CylinderGeometry(1, 1, 1, 6), cyl8: new THREE.CylinderGeometry(1, 1, 1, 10),
  cyl14: new THREE.CylinderGeometry(1, 1, 1, 18), cone: new THREE.ConeGeometry(1, 1, 10), cone5: new THREE.ConeGeometry(1, 1, 5),
  dome: new THREE.SphereGeometry(1, 16, 8, 0, TAU, 0, Math.PI / 2), ico: new THREE.IcosahedronGeometry(1, 0),
  ico1: new THREE.IcosahedronGeometry(1, 1), dodec: new THREE.DodecahedronGeometry(1, 0), sph: new THREE.SphereGeometry(1, 12, 8),
  torus: new THREE.TorusGeometry(1, 0.32, 8, 18), cyl3: new THREE.CylinderGeometry(1, 1, 1, 3),
};
const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
function M(x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) {
  _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
}
/* cache non-indexed copies of the shared shapes: buildings call add() tens of thousands of times */
const _flatCache = new WeakMap();
function flatOf(geo) { let g = _flatCache.get(geo); if (!g) { g = geo.index ? geo.toNonIndexed() : geo; _flatCache.set(geo, g); } return g; }
const _bv = new THREE.Vector3(), _bn = new THREE.Matrix3();
class Builder {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.uv = []; this.mat = []; }
  add(geo, m, color, kind = MATID.plain) {
    const g = flatOf(geo), p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
    const nm = _bn.getNormalMatrix(m), c = color && color.isColor ? color : C(color), e = m.elements;
    const P = p.array, Nn = n.array, U = uv ? uv.array : null;
    for (let i = 0; i < p.count; i++) {
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
      this.pos.push(e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]);
      _bv.set(Nn[i * 3], Nn[i * 3 + 1], Nn[i * 3 + 2]).applyMatrix3(nm).normalize(); this.nor.push(_bv.x, _bv.y, _bv.z);
      this.col.push(c.r, c.g, c.b); this.mat.push(kind);
      if (U) this.uv.push(U[i * 2], U[i * 2 + 1]); else this.uv.push(0, 0);
    }
  }
  box(x, y, z, sx, sy, sz, color, ry = 0, kind = MATID.plain) { this.add(G.box, M(x, y, z, ry, sx, sy, sz), color, kind); }
  limb(x, y, z, dir, len, r0, r1, color, sides = 6, kind = MATID.wood) {
    const geo = new THREE.CylinderGeometry(r1, r0, 1, sides);
    _q.setFromUnitVectors(UP, dir);
    this.add(geo, new THREE.Matrix4().compose(_p.set(x + dir.x * len / 2, y + dir.y * len / 2, z + dir.z * len / 2), _q, _s.set(1, len, 1)), color, kind);
    geo.dispose();
    return [x + dir.x * len, y + dir.y * len, z + dir.z * len];
  }
  get empty() { return this.pos.length === 0; }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aMat', new THREE.Float32BufferAttribute(this.mat, 1));
    g.computeBoundingSphere();
    return g;
  }
  mesh(mat = UBER, shadows = true) { const m = new THREE.Mesh(this.geometry(), mat); m.castShadow = shadows; m.receiveShadow = true; return m; }
}
function canvasTex(w, h, draw, srgb = true, repeat = false) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); if (g) draw(g, w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.encoding = THREE.sRGBEncoding;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4; return t;
}
/* texture arrays from a vertical strip image (layers stacked top to bottom) */
function stripToArray(img, layers, opts = {}) {
  const w = img.width, h = img.height, c = document.createElement('canvas'); c.width = w; c.height = h;
  // square layers: trust the picture over the list if they disagree (an older cached strip still slices cleanly)
  if (h % w === 0 && h / w !== layers) { console.warn('strip has', h / w, 'layers, expected', layers); layers = h / w; }
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
  const data = new Uint8Array(g.getImageData(0, 0, w, h).data.buffer);
  const t = new THREE.DataTexture2DArray(data, w, h / layers, layers);
  t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = opts.clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  t.generateMipmaps = true; t.anisotropy = MAX_ANISO; t.needsUpdate = true;
  return t;
}
const loadImage = (url) => new Promise((res, rej) => { const im = new Image(); im.decoding = 'async'; im.onload = () => res(im); im.onerror = () => rej(new Error('image ' + url)); im.src = url; });
const fetchJSON = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); });
function b64Bytes(s) { const bin = atob(s), n = bin.length, u = new Uint8Array(n); for (let i = 0; i < n; i++) u[i] = bin.charCodeAt(i); return u; }
