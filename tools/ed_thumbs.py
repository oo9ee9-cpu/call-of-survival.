"""the world editor's catalogue pictures, made by the game itself. Things that stand on their own (houses, fences, furniture,
cars, people, trees, rocks, the scanned landforms) are put down, then drawn alone in a small studio (soft sky, a key light and
a fill, a shadow under them) from a three-quarter view; the shapes of the land and the water are shot where they lie, on a
cleared meadow away from the towns. Saved as assets/ui/ed/<key>.webp (4:3).
usage: python3 -I ed_thumbs.py <page> <out_dir> [key,key,...]"""
import sys, os, time, json, base64, io, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
from PIL import Image
SP = os.path.dirname(os.path.abspath(__file__)) + '/..'
page, out = sys.argv[1], sys.argv[2]
only = sys.argv[3].split(',') if len(sys.argv) > 3 and sys.argv[3] else None
os.makedirs(out, exist_ok=True)
LOCAL = {
    'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js': SP + '/dl/three-r128/build/three.min.js',
    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js': SP + '/dl/three-r128/examples/js/loaders/GLTFLoader.js',
    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/utils/SkeletonUtils.js': SP + '/dl/three-r128/examples/js/utils/SkeletonUtils.js',
}
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *x): pass
srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(Q, directory=os.path.abspath(SP))); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
W, H = 960, 600
FRAMES = "(n) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r(k) : requestAnimationFrame(f)); requestAnimationFrame(f); })"
SETUP = r"""() => {
  begin(true); ENV.hour = 10.2; setWeather('clear', true); WEATHER.lock = true;
  edEnter(); document.getElementById('ed').style.visibility = 'hidden'; ED.hinted = true;
  // an open, flat meadow away from the towns and roads, cleared of trees and rocks
  let best = null;
  for (let k = 0; k < 900 && !best; k++) { const a = k * 2.399, r = 200 + k * 9, x = player.pos.x + Math.cos(a) * r, z = player.pos.z + Math.sin(a) * r;
    if (!inPlay(x, z) || waterAt(x, z) > terrainAt(x, z) - 2 || slopeAt(x, z) > 0.06 || roadDist(x, z) < 60 || nearSettlement(x, z, 1.6) || (LAND_ON && landTop(x, z) > -1e8)) continue;
    let ok = true; for (let q = 0; q < 12 && ok; q++) { const b = q / 12 * TAU; for (const d of [30, 80]) if (Math.abs(terrainAt(x + Math.cos(b) * d, z + Math.sin(b) * d) - terrainAt(x, z)) > (d > 40 ? 8 : 3)) ok = false; }
    if (ok) best = [x, z]; }
  if (!best) best = [player.pos.x + 300, player.pos.z];
  window.__spot = best;
  const zn = zoneAdd({ t: 'c', x: best[0], z: best[1], r: 90, m: 3 }); ED.er.push(zn); edTouch(best[0], best[1], 90, false, 3);
  EDC.x = best[0]; EDC.z = best[1]; edCamApply(0); edFlush(true);
  // the studio
  const scn = new THREE.Scene();
  scn.background = canvasTex(4, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#e9eef2'); gr.addColorStop(0.62, '#d9d4ca'); gr.addColorStop(1, '#bfb7aa'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  scn.environment = scene.environment;
  scn.add(new THREE.HemisphereLight(0xf2f5ff, 0x8a7a64, 0.95));
  const key = new THREE.DirectionalLight(0xfff0dc, 2.4); scn.add(key); scn.add(key.target);
  const fill = new THREE.DirectionalLight(0xdfe8ff, 0.55); scn.add(fill); scn.add(fill.target);
  const blob = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ map: canvasTex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 2, 64, 64, 64); gr.addColorStop(0, 'rgba(40,32,24,0.5)'); gr.addColorStop(0.6, 'rgba(40,32,24,0.18)'); gr.addColorStop(1, 'rgba(40,32,24,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }, false), transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; scn.add(blob);
  const cam = new THREE.PerspectiveCamera(30, 4 / 3, 0.05, 20000);
  const RT = THREE.WebGLMultisampleRenderTarget || THREE.WebGLRenderTarget, rt = new RT(480, 360); rt.texture.encoding = THREE.sRGBEncoding; if ('samples' in rt) rt.samples = 4;
  const cv = document.createElement('canvas'); cv.width = 480; cv.height = 360; const g2 = cv.getContext('2d');
  window.__studio = (objs, yaw, pitch, k, fix) => {
    const back = objs.map((o) => [o, o.parent, o.visible]);
    for (const o of objs) { scn.add(o); o.visible = true; }
    const box = new THREE.Box3(); for (const o of objs) { o.updateMatrixWorld(true); box.expandByObject(o); }
    if (box.isEmpty()) { for (const [o, p, v] of back) { if (p) p.add(o); else scn.remove(o); o.visible = v; } return null; }
    if (fix) box.setFromCenterAndSize(new THREE.Vector3(fix[0], fix[1], fix[2]), new THREE.Vector3(fix[3], fix[4], fix[5]));     // (animals: their real size, not their skeleton's box)
    const sph = box.getBoundingSphere(new THREE.Sphere()), c = sph.center, r = Math.max(0.25, sph.radius), d = r / Math.sin(cam.fov * Math.PI / 360) * (k || 1);
    cam.position.set(c.x + Math.sin(yaw) * Math.cos(pitch) * d, c.y + Math.sin(pitch) * d, c.z + Math.cos(yaw) * Math.cos(pitch) * d);
    cam.near = d / 200; cam.far = d * 10; cam.updateProjectionMatrix(); cam.lookAt(c);
    blob.position.set(c.x, box.min.y + Math.min(0.02, r * 0.01), c.z); blob.scale.setScalar(Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * 0.62 + 0.2);
    key.position.set(c.x - 0.45 * d, c.y + 0.9 * d, c.z + 0.6 * d); key.target.position.copy(c); key.target.updateMatrixWorld();
    fill.position.set(c.x + 0.7 * d, c.y + 0.3 * d, c.z - 0.4 * d); fill.target.position.copy(c); fill.target.updateMatrixWorld();
    const cc = new THREE.Color(); renderer.getClearColor(cc); const ca = renderer.getClearAlpha(), prev = renderer.getRenderTarget();
    renderer.setRenderTarget(rt); renderer.setClearColor(0xd8d2c8, 1); renderer.clear(); renderer.render(scn, cam);
    const px = new Uint8Array(480 * 360 * 4); renderer.readRenderTargetPixels(rt, 0, 0, 480, 360, px);
    renderer.setRenderTarget(prev); renderer.setClearColor(cc, ca);
    for (const [o, p, v] of back) { if (p) p.add(o); else scn.remove(o); o.visible = v; }
    const img = g2.createImageData(480, 360); for (let y = 0; y < 360; y++) img.data.set(px.subarray((359 - y) * 1920, (360 - y) * 1920), y * 1920);
    g2.putImageData(img, 0, 0); return cv.toDataURL('image/png');
  };
  return { spot: best.map(Math.round), keys: Object.keys(EDK) };
}"""
PREP = r"""(key) => {
  for (const o of ED.objs.slice()) edRemove(o); edFlush(true);
  const d = EDK[key], [sx, sz] = window.__spot;
  EDC.x = sx; EDC.z = sz; EDC.lift = 0; EDC.yaw = EDC.tyaw = 0; EDC.pitch = EDC.tpitch = 0.6; EDC.dist = EDC.tdist = 30; EDC.fly = null; edCamApply(0);
  if (d.type === 'veh' && VSPEC[d.veh].water) { edPlace('Q_lake'); edChange(ED.sel, (q) => { q.w = 34; q.h = 3; }); }
  edPlace(key); const o = ED.sel; edSelect(null); edTool('sel'); edCatOpen(false);
  ED_LINE.sel.visible = ED_LINE.arrow.visible = ED_LINE.brush.visible = false;
  if (!o) return { key, none: true };
  if (d.type === 'tree' || d.type === 'rock') { o.ry = 0.5; o.c = 0; if (d.type === 'tree') o.s = 1; edRebuild(o); }
  const world = d.type === 'shape' || d.type === 'lake' || d.pre === 'plot' || d.pre === 'path_stone' || d.pre === 'path_dirt' || d.pre === 'road' || (d.type === 'animal' && ASPEC[d.an].proc);
  return { key, type: d.type, world, big: d.type === 'shape' || (d.type === 'lake' && d.key === 'Q_lake') };
}"""
# the studio: what to draw for each kind of thing, and from where
STUDIO = r"""(key) => {
  const o = ED.objs[ED.objs.length - 1], d = EDK[key], v = o && o.v; if (!v) return null;
  const tmp = [], objs = [];
  // one instance, its place carried by the mesh itself (so the studio frames it by its own box)
  const inst = (geo, mat, x, y, z, ry, s, col) => { const m = new THREE.InstancedMesh(geo, mat, 1); m.frustumCulled = false; m.position.set(x, y, z); m.rotation.y = ry; m.scale.setScalar(s); m.setMatrixAt(0, new THREE.Matrix4()); m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array([col.r, col.g, col.b]), 3); m.instanceMatrix.needsUpdate = true; if (!geo.boundingBox) geo.computeBoundingBox(); tmp.push(m); objs.push(m); };
  let yaw = 0.62, pitch = 0.32, k = 1.0;
  switch (d.type) {
    case 'tree': { const t = v.t, dr = drawFor(t.id, t.v, 0, true), c = tintOf(t, new THREE.Color()); for (const m of [dr.trunk, dr.leaves, dr.twigs]) if (m) inst(m.geometry, m.material, t.x, t.y, t.z, t.rot, t.s, m === dr.trunk ? new THREE.Color(1, 1, 1) : c); pitch = 0.1; k = 0.92; break; }
    case 'rock': { const t = v.t, dr = rdraw(t.name, 0); inst(dr.m.geometry, dr.m.material, t.x, t.y, t.z, t.ry, t.s, new THREE.Color(1, 1, 1)); pitch = 0.32; break; }
    case 'land': { const L = v.L, D = L.def, m0 = D.mesh0; inst(m0.geometry, m0.material, L.x, L.y, L.z, L.rot, L.s, new THREE.Color(1, 1, 1)); pitch = 0.42; k = 0.95; break; }
    case 'house': for (const m of v.S.ctx.meshes) objs.push(m); pitch = 0.3; break;
    case 'villa': for (const m of v.S.ctx.meshes) objs.push(m); objs.push(v.root); for (const m of v.meshes) objs.push(m); pitch = 0.5; k = 0.9; break;
    case 'veh': objs.push(v.veh.root); pitch = 0.28; break;
    case 'body': objs.push(v.body.root); pitch = 0.08; yaw = 0.35; k = 0.95; break;
    case 'animal': { for (const an of v.herd.members) if (an.root) objs.push(an.root); pitch = 0.22; const S = ASPEC[d.an], an = v.herd.members[0]; if (an) { const L = S.len * (S.sx || 1); var fix = [an.x, an.y + S.h * 0.5, an.z, L, S.h, L]; } break; }
    case 'pickup': objs.push(v.root); pitch = d.prop ? 0.62 : 0.4; break;
    default: objs.push(v.root); pitch = d.world ? 0.5 : 0.32;
  }
  const url = window.__studio(objs, yaw, pitch, k, typeof fix !== 'undefined' ? fix : null);
  for (const m of tmp) m.dispose && m.dispose();
  return url;
}"""
FRAME = r"""(key) => {
  const o = ED.objs[ED.objs.length - 1]; if (!o || !o.v) return { key, none: true };
  const d = EDK[key], v = o.v, f = edFoot(o);
  let r = f.r !== undefined ? f.r : Math.max(f.hx || f.rx || 1, f.hz || f.rz || 1), h = 2, pitch = 0.42, k = 2.2;
  if (d.type === 'shape') { h = Math.abs(o.h); r = Math.max(o.w, o.d) / 2; k = 2.0; pitch = 0.38; }
  else if (d.type === 'lake') { k = d.pool ? 2.6 : 2.3; pitch = 0.68; h = 0; }
  else if (d.type === 'animal') { h = ASPEC[d.an].h; r = Math.max(r, ASPEC[d.an].len); k = 2.2; pitch = 0.3; }
  else { r = o.w / 2; k = d.pre === 'plot' ? 1.7 : 1.5; pitch = d.pre === 'plot' ? 0.75 : 0.5; h = 0.5; }
  const dist = Math.max(r * k, h * 1.9, 2);
  EDC.x = o.x + (f.ox || 0); EDC.z = o.z + (f.oz || 0); EDC.lift = h * 0.42; EDC.yaw = EDC.tyaw = 0.62; EDC.pitch = EDC.tpitch = pitch; EDC.dist = EDC.tdist = dist; edCamApply(0);
  return { key, r: Math.round(r * 10) / 10, dist: Math.round(dist) };
}"""
def save(png, key):
    im = Image.open(io.BytesIO(png)).convert('RGB').resize((280, 210), Image.LANCZOS)
    im.save(os.path.join(out, key + '.webp'), quality=76, method=6)
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    ctx = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=1)
    pg = ctx.new_page(); logs = []
    pg.on('pageerror', lambda e: logs.append(f'[pageerror] {str(e)[:300]}'))
    pg.on('console', lambda m: m.type in ('error', 'warning') and logs.append(f'[{m.type}] {m.text[:240]}'))
    def route(r):
        u = r.request.url
        if u in LOCAL: return r.fulfill(path=LOCAL[u], content_type='application/javascript')
        if u.startswith('https://fonts.'): return r.fulfill(body='', content_type='text/css')
        return r.continue_()
    pg.route('**/*', route)
    t0 = time.time()
    pg.goto(f'http://127.0.0.1:{port}/{page}', wait_until='commit', timeout=120000)
    while time.time() - t0 < 400:
        try:
            if pg.evaluate("(typeof LOBBY!=='undefined'&&LOBBY.on)||!!window.__err"): break
        except Exception: pass
        time.sleep(0.5)
    info = pg.evaluate(SETUP); print('spot', info['spot'], len(info['keys']), 'keys', flush=True)
    pg.evaluate(FRAMES, 20)
    keys = only or info['keys']
    later = []
    for key in keys:
        try:
            r = pg.evaluate(PREP, key)
            if r.get('none'): print('skip', key, flush=True); continue
            for _ in range(80):     # landforms and the owner's props arrive a little later
                if pg.evaluate("(k) => { const o = ED.objs[ED.objs.length - 1], d = EDK[k]; return !o || !o.v || (d.type !== 'land' || (o.v.L && LAND.defs[d.land] && LAND.defs[d.land].mesh0)) && (!d.prop || !!o.v.prop); }", key): break
                time.sleep(0.5)
            if r.get('world'): later.append(key); continue
            url = pg.evaluate(STUDIO, key)
            if not url: print('empty', key, flush=True); continue
            save(base64.b64decode(url.split(',', 1)[1]), key)
            print(round(time.time() - t0), key, flush=True)
        except Exception as e:
            print('fail', key, str(e)[:240], flush=True)
    # the land and the water, shot where they lie
    for key in later:
        try:
            r = pg.evaluate(PREP, key); fr = pg.evaluate(FRAME, key)
            pg.evaluate(FRAMES, 22 if r.get('big') else 12); pg.evaluate(FRAME, key); pg.evaluate(FRAMES, 6)
            cw, ch = 600, 450
            png = pg.screenshot(clip={'x': (W - cw) / 2, 'y': (H - ch) / 2, 'width': cw, 'height': ch}, timeout=240000)
            save(png, key); print(round(time.time() - t0), key, json.dumps(fr, ensure_ascii=False), flush=True)
        except Exception as e:
            print('fail', key, str(e)[:240], flush=True)
    b.close()
for l in logs[-40:]: print(l)
