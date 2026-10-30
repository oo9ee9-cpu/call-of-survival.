# end-to-end save test with a mocked private db: save → reload → restore → die → wipe → new life → reload
import sys, os, time, json, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
SP = os.path.dirname(os.path.abspath(__file__)) + '/..'
LOCAL = {
    'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js': SP + '/dl/three-r128/build/three.min.js',
    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js': SP + '/dl/three-r128/examples/js/loaders/GLTFLoader.js',
    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/utils/SkeletonUtils.js': SP + '/dl/three-r128/examples/js/utils/SkeletonUtils.js',
    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/utils/BufferGeometryUtils.js': SP + '/dl/three-r128/examples/js/utils/BufferGeometryUtils.js',
}
MOCK = r"""
(() => {
  const K = '__mockdb', load = () => JSON.parse(localStorage.getItem(K) || '{}'), save = (o) => localStorage.setItem(K, JSON.stringify(o));
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  const doc = (path) => ({
    async get() { await delay(50); const o = load(); return { exists: path in o, data: () => o[path] }; },
    async set(v) { await delay(80); const o = load(); o[path] = v; save(o); (window.__dblog = window.__dblog || []).push('set ' + path); },
    async delete() { await delay(600); const o = load(); delete o[path]; save(o); (window.__dblog = window.__dblog || []).push('del ' + path); },
  });
  window.claude = { use: async (cap) => cap === 'db' ? { doc } : cap === 'user' ? { id: async () => 'u1' } : null };
})();
"""
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=SP)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *x): pass
srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(Q, directory=SP)); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
out = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    ctx = b.new_context(viewport={'width': 640, 'height': 360})
    ctx.add_init_script(MOCK)
    pg = ctx.new_page(); logs = []
    pg.on('console', lambda m: logs.append(f'[{m.type}] {m.text}')); pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}'))
    def route(r):
        u = r.request.url
        if u in LOCAL: return r.fulfill(path=LOCAL[u], content_type='application/javascript')
        if u.startswith('https://fonts.'): return r.fulfill(body='', content_type='text/css')
        return r.continue_()
    pg.route('**/*', route)
    def boot():
        pg.goto(f'http://127.0.0.1:{port}/game.html', wait_until='load')
        t0 = time.time()
        while time.time() - t0 < 300:
            try:
                if pg.evaluate("(typeof BOOT!=='undefined'&&BOOT.ready)||!!window.__err"): break
            except Exception: pass
            time.sleep(0.5)
    def ev(js): return pg.evaluate(js)
    boot()
    out.append(('boot1', ev("({loaded: BOOT.loaded, src: SAVE.source, hasDoc: !!SAVE.doc, coins: INV.coins})")))
    ev("begin(true); INV.coins = 777; saveNow(); 1")
    time.sleep(3)
    out.append(('after save', ev("({db: Object.keys(JSON.parse(localStorage.getItem('__mockdb')||'{}')), coins: JSON.parse(JSON.parse(localStorage.getItem('__mockdb'))['data/users/u1/save'].json).coins, log: window.__dblog})")))
    boot()
    out.append(('boot2', ev("({loaded: BOOT.loaded, src: SAVE.source, coins: INV.coins})")))
    ev("begin(true); damagePlayer(5000, null, 'test'); 1")
    time.sleep(1.0)
    ev("document.getElementById('respawnBtn').click(); 1")   # new life while the wipe is still running (mock delete takes 0.6 s each)
    out.append(('respawned', ev("({alive: player.alive, coins: INV.coins, busy: SAVE.busy, dead: SAVE.dead})")))
    t0 = time.time()
    while time.time() - t0 < 60:
        st = ev("({busy: SAVE.busy, dirty: SAVE.dirty, db: Object.keys(JSON.parse(localStorage.getItem('__mockdb')||'{}'))})")
        if not st['busy'] and len(st['db']) == 2: break
        ev("updateSave(0.016); 1"); time.sleep(1)
    out.append(('after wipe+new', ev("({db: Object.keys(JSON.parse(localStorage.getItem('__mockdb')||'{}')), log: window.__dblog, coins: (() => { const o = JSON.parse(localStorage.getItem('__mockdb')||'{}')['data/users/u1/save']; return o ? JSON.parse(o.json).coins : null; })()})")))
    boot()
    out.append(('boot3', ev("({loaded: BOOT.loaded, src: SAVE.source, coins: INV.coins})")))
    b.close()
for k, v in out: print(k, json.dumps(v)[:600])
for l in logs[-15:]:
    if 'warning' not in l: print(l[:300])
