/* ═════════ road signs at the edge of every town: «مرحباً بك في …», green for villages, blue for the city, red-bordered for the base ═════════ */
const WELCOME = { mesh: null, faces: null, tex: null, list: [] };
function initWelcomeSigns() {
  const towns = SETTLEMENTS.filter((S) => S.kind !== 'lighthouse');
  const W = 1024, Hs = 320, cols = 2, rows = Math.ceil(towns.length / cols), cv = document.createElement('canvas');
  cv.width = W * cols; cv.height = Hs * rows;
  const style = (S) => S.kind === 'city' ? { bg: '#1d4f8c', edge: '#e9f1fb' } : S.kind === 'military' ? { bg: '#3a3f2e', edge: '#e5493c' } : { bg: '#1e6a44', edge: '#eef6ef' };
  const paint = () => {
    const g = cv.getContext('2d'); if (!g) return;
    towns.forEach((S, i) => {
      const x = (i % cols) * W, y = Math.floor(i / cols) * Hs, st = style(S);
      g.fillStyle = st.bg; g.fillRect(x, y, W, Hs);
      const r0 = RNG(i * 31 + 7); for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(255,255,255,${r0() * 0.035})`; g.fillRect(x + r0() * W, y + r0() * Hs, 3, 3); }
      g.strokeStyle = st.edge; g.lineWidth = 12; g.strokeRect(x + 16, y + 16, W - 32, Hs - 32);
      g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
      g.font = `500 54px 'Readex Pro','Segoe UI',Tahoma,sans-serif`;
      g.fillText(S.kind === 'military' ? 'منطقة عسكرية · مرحباً بك في' : 'مرحباً بك في', x + W / 2, y + 88);
      let fs = 118; g.font = `700 ${fs}px 'Aref Ruqaa','Amiri',serif`; while (g.measureText(S.name).width > W - 110 && fs > 60) { fs -= 6; g.font = `700 ${fs}px 'Aref Ruqaa','Amiri',serif`; }
      g.fillText(S.name, x + W / 2, y + 205);
      g.fillStyle = 'rgba(255,255,255,.8)'; g.fillRect(x + W / 2 - 90, y + Hs - 52, 180, 6);
    });
    if (WELCOME.tex) WELCOME.tex.needsUpdate = true;
  };
  paint();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(paint).catch(() => {});
  WELCOME.tex = new THREE.CanvasTexture(cv); WELCOME.tex.encoding = THREE.sRGBEncoding; WELCOME.tex.anisotropy = Math.min(8, MAX_ANISO);
  const faceMat = new THREE.MeshStandardMaterial({ map: WELCOME.tex, emissive: 0xffffff, emissiveMap: WELCOME.tex, emissiveIntensity: 0, roughness: 0.55, metalness: 0 });
  ENV_MATS.push(faceMat); ENV_HOOKS.push((env) => { faceMat.emissiveIntensity = env.lamps * 0.32; });
  const posts = new Builder(), P = [], N = [], UV = [];
  const quad = (cx, cy, cz, nx, nz, w, h, u0, u1, v0, v1) => {
    const rx = nz, rz = -nx;               // the reader's right, standing in front of the sign
    const c = [[-w / 2, -h / 2, u0, v0], [w / 2, -h / 2, u1, v0], [w / 2, h / 2, u1, v1], [-w / 2, h / 2, u0, v1]];
    const at = ([a, b]) => [cx + nx * 0.07 + rx * a, cy + b, cz + nz * 0.07 + rz * a];
    for (const k of [0, 1, 2, 0, 2, 3]) { P.push(...at(c[k])); N.push(nx, 0, nz); UV.push(c[k][2], c[k][3]); }
  };
  towns.forEach((S, i) => {
    const R = S.r + 45, u0 = (i % cols) / cols, u1 = u0 + 1 / cols, v1 = 1 - Math.floor(i / cols) / rows, v0 = v1 - 1 / rows;
    const placed = [];
    for (const road of ROADS) {
      const pts = road.pts;
      for (let k = 0; k < pts.length - 1; k++) {
        const a = pts[k], b = pts[k + 1], da = Math.hypot(a[0] - S.x, a[1] - S.z), db = Math.hypot(b[0] - S.x, b[1] - S.z);
        if ((da - R) * (db - R) > 0) continue;
        const t = (da - R) / ((da - db) || 1e-6), x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
        if (placed.some((q) => Math.hypot(q[0] - x, q[1] - z) < 70)) continue;
        if (road.bridge && (road.bridge[k] || road.bridge[k + 1])) continue;
        // driving in towards the town: the sign stands on the right of the road and faces you
        let tx = b[0] - a[0], tz = b[1] - a[1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
        if (db > da) { tx = -tx; tz = -tz; }
        const side = road.w + 2.8, sx = x - tz * side, sz = z + tx * side, g = terrainAt(sx, sz);
        if (g < waterAt(sx, sz) + 0.2 || buildingAt(sx, sz, g + 1)) continue;
        const nx = -tx, nz = -tz, ry = Math.atan2(nx, nz), w = 4.6, h = 1.44, y = g + 2.45;
        posts.box(sx, y, sz, w + 0.16, h + 0.16, 0.1, 0x8f969c, ry, K.metal);
        for (const s of [-1, 1]) posts.add(G.cyl8, M(sx + nz * s * (w * 0.36) - nx * 0.09, g + 1.5, sz - nx * s * (w * 0.36) - nz * 0.09, 0, 0.055, 3.0, 0.055), 0x7d8489, K.metal);
        quad(sx, y, sz, nx, nz, w, h, u0, u1, v0, v1);
        for (const s of [-1, 1]) addCollider({ t: 'c', x: sx + nz * s * (w * 0.36) - nx * 0.09, z: sz - nx * s * (w * 0.36) - nz * 0.09, r: 0.14, y1: g + 3.2 });
        placed.push([x, z]); WELCOME.list.push({ x: sx, z: sz, nx, nz, name: S.name });
      }
    }
  });
  if (!posts.empty) { WELCOME.mesh = posts.mesh(UBER, QUALITY.shadows); scene.add(WELCOME.mesh); }
  if (P.length) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.computeBoundingSphere();
    WELCOME.faces = new THREE.Mesh(g, faceMat); WELCOME.faces.receiveShadow = true; scene.add(WELCOME.faces);
  }
}
