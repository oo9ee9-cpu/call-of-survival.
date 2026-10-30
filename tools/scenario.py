"""run a scripted visit of the game in headless Chromium: each step runs some JS, lets a number of frames pass, and may take a
screenshot; page errors and warnings are printed at the end.
usage: python3 tools/scenario.py game/index.html <steps.json> <out_prefix> [--w 960 --h 540 --mobile --keep-storage <dir>]
steps.json: [{"js": "...", "frames": 20, "wait": 0, "shot": "name", "until": "expr", "timeout": 120}, ...]"""
import sys, os, time, json, argparse, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
ap = argparse.ArgumentParser()
ap.add_argument('page'); ap.add_argument('steps'); ap.add_argument('out')
ap.add_argument('--w', type=int, default=960); ap.add_argument('--h', type=int, default=540)
ap.add_argument('--mobile', action='store_true'); ap.add_argument('--state', default='')
ap.add_argument('--cloud', action='store_true')   # a stand-in for the artifact's runtime: assets, db and user in this script
a = ap.parse_args()
SP = os.path.dirname(os.path.abspath(__file__)) + '/..'
LOCAL = {   # the CDN files the page asks for, served from cdn/ (kept by host and path, '@' as '-at-')
    'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js': SP + '/cdn/cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
}
for f in ['loaders/GLTFLoader.js', 'utils/SkeletonUtils.js', 'loaders/OBJLoader.js', 'loaders/MTLLoader.js', 'loaders/FBXLoader.js', 'loaders/DRACOLoader.js', 'exporters/GLTFExporter.js', 'libs/fflate.min.js',
          'libs/draco/gltf/draco_decoder.js', 'libs/draco/gltf/draco_wasm_wrapper.js', 'libs/draco/gltf/draco_decoder.wasm']:
    LOCAL['https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/' + f] = SP + '/cdn/cdn.jsdelivr.net/npm/three-at-0.128.0/examples/js/' + f
MOCK = r'''(() => {
  const b64 = async (blob) => { const u = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  const assets = {
    upload: async (blob, o) => { const type = (o && o.type) || blob.type; if (blob.size > 20 * 1048576) throw { code: 'too_large', message: 'too large' }; const id = await window.__bput(await b64(blob), type); return { id, url: '/_blob/' + id, sizeBytes: blob.size, contentType: type }; },
    delete: async (id) => ({ deleted: await window.__bdel(id) }),
    list: async () => { const u = await window.__busage(); return { assets: [], usage: { files: u[0], bytes: u[1], maxFiles: 5000, maxBytes: 5e9 } }; },
  };
  const snap = (id, v) => ({ id, exists: v != null, data: () => (v == null ? undefined : JSON.parse(JSON.stringify(v))), metadata: {} });
  const doc = (p) => ({ id: p.split('/').pop(), get: async () => snap(p.split('/').pop(), await window.__dget(p)), set: async (v) => { await window.__dset(p, JSON.parse(JSON.stringify(v))); }, update: async (v) => { await window.__dset(p, Object.assign({}, await window.__dget(p), v)); }, delete: async () => { await window.__ddel(p); }, onSnapshot: () => () => {} });
  const coll = (c) => { const q = { get: async () => { const L = await window.__dlist(c); return { docs: L.map(([id, v]) => snap(id, v)), size: L.length, empty: !L.length, docChanges: () => [] }; }, doc: (id) => doc(c + '/' + id), where: () => q, orderBy: () => q, limit: () => q, onSnapshot: () => () => {} }; return q; };
  const db = { doc, collection: coll };
  const user = { id: async () => null, me: async () => ({ id: 'tester', name: '' }), isOwner: async () => true, canEdit: async () => true, can: async () => true, profiles: async () => ({}) };
  window.claude = { use: async (n) => (n === 'assets' ? assets : n === 'db' ? db : n === 'user' ? user : null) };
})();'''
BLOBS, DOCS = {}, {}
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *x): pass
srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(Q, directory=os.path.abspath(SP))); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
steps = json.load(open(a.steps))
logs = []
FRAMES = "(n) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r(k) : requestAnimationFrame(f)); requestAnimationFrame(f); })"
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'])
    kw = dict(viewport={'width': a.w, 'height': a.h}, device_scale_factor=1, is_mobile=a.mobile, has_touch=a.mobile)
    if a.state and os.path.exists(a.state): kw['storage_state'] = a.state
    ctx = b.new_context(**kw)
    if a.cloud:
        import base64, hashlib
        def b_put(src, data, typ):
            raw = base64.b64decode(data); i = hashlib.md5(raw + str(len(BLOBS)).encode()).hexdigest(); BLOBS[i] = (raw, typ); return i
        ctx.expose_binding('__bput', b_put)
        ctx.expose_binding('__bdel', lambda src, i: BLOBS.pop(i, None) is not None)
        ctx.expose_binding('__busage', lambda src: [len(BLOBS), sum(len(v[0]) for v in BLOBS.values())])
        ctx.expose_binding('__dget', lambda src, p: DOCS.get(p))
        def d_set(src, p, v): DOCS[p] = v; return True
        ctx.expose_binding('__dset', d_set)
        ctx.expose_binding('__ddel', lambda src, p: DOCS.pop(p, None) is not None)
        ctx.expose_binding('__dlist', lambda src, c: [[k.rsplit('/', 1)[1], v] for k, v in DOCS.items() if k.rsplit('/', 1)[0] == c])
        ctx.add_init_script(MOCK)
    pg = ctx.new_page()
    pg.on('console', lambda m: m.type in ('error', 'warning') and logs.append(f'[{m.type}] {m.text[:300]}'))
    pg.on('pageerror', lambda e: logs.append(f'[pageerror] {str(e)[:500]}'))
    def route(r):
        u = r.request.url
        if u in LOCAL: return r.fulfill(path=LOCAL[u], content_type='application/wasm' if u.endswith('.wasm') else 'application/javascript')
        if '/_blob/' in u:
            v = BLOBS.get(u.rsplit('/', 1)[1].split('?')[0])
            return r.fulfill(body=v[0], content_type=v[1]) if v else r.fulfill(status=404, body='')
        if u.startswith('https://fonts.'): return r.fulfill(body='', content_type='text/css')
        return r.continue_()
    pg.route('**/*', route)
    t0 = time.time()
    pg.goto(f'http://127.0.0.1:{port}/{a.page}', wait_until='commit', timeout=120000)
    for i, st in enumerate(steps):
        if st.get('reload'):
            pg.reload(wait_until='commit', timeout=120000); print(f'[{round(time.time() - t0)}s] reload', flush=True)
        if st.get('until'):
            t1 = time.time()
            while time.time() - t1 < st.get('timeout', 180):
                try:
                    if pg.evaluate(st['until']): break
                except Exception: pass
                time.sleep(0.5)
            else: print('step', i, 'until timed out:', st['until'][:80], flush=True)
        if st.get('js'):
            try:
                r = pg.evaluate(st['js'])
                if r is not None: print(f'[{round(time.time() - t0)}s] step {i} ->', json.dumps(r, ensure_ascii=False)[:1500], flush=True)
            except Exception as e: print('step', i, 'js error:', str(e)[:400], flush=True)
        if st.get('frames'):
            try: pg.evaluate(FRAMES, st['frames'])
            except Exception as e: print('frames', str(e)[:200])
        if st.get('wait'): time.sleep(st['wait'])
        if st.get('tap'):
            x, y = st['tap']
            if a.mobile: pg.touchscreen.tap(x, y)
            else: pg.mouse.click(x, y)
        if st.get('drag'):
            x0, y0, x1, y1 = st['drag']; n = st.get('n', 12)
            pg.mouse.move(x0, y0); pg.mouse.down()
            for k in range(1, n + 1): pg.mouse.move(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n); time.sleep(0.03)
            pg.mouse.up()
        if st.get('key'):
            pg.keyboard.down(st['key']); time.sleep(st.get('hold', 0.5)); pg.keyboard.up(st['key'])
        if st.get('js_after'):
            try:
                r = pg.evaluate(st['js_after'])
                if r is not None: print(f'[{round(time.time() - t0)}s] step {i} after ->', json.dumps(r, ensure_ascii=False)[:1500], flush=True)
            except Exception as e: print('step', i, 'js_after error:', str(e)[:400], flush=True)
        if st.get('shot'):
            pg.screenshot(path=f'{a.out}_{st["shot"]}.png', timeout=240000)
            print(f'[{round(time.time() - t0)}s] shot', st['shot'], flush=True)
    if a.state: ctx.storage_state(path=a.state)
    b.close()
for l in logs[-40:]: print(l)
