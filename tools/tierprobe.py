# boot the game at a given quality level (low/mid/high/ultra), run a view script, screenshot, report errors
import sys, os, time, json, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
SP = os.path.dirname(os.path.abspath(__file__)) + '/..'
level, out, js = sys.argv[1], sys.argv[2], (sys.argv[3] if len(sys.argv) > 3 else '')
LOCAL = {
    'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js': SP + '/dl/three-r128/build/three.min.js',
    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js': SP + '/dl/three-r128/examples/js/loaders/GLTFLoader.js',
    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/utils/SkeletonUtils.js': SP + '/dl/three-r128/examples/js/utils/SkeletonUtils.js',
    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/utils/BufferGeometryUtils.js': SP + '/dl/three-r128/examples/js/utils/BufferGeometryUtils.js',
}
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *x): pass
srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(Q, directory=SP)); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    ctx = b.new_context(viewport={'width': 960, 'height': 540})
    ctx.add_init_script("try { localStorage.setItem('rock-island-q4', %s); } catch (e) {}" % json.dumps(level))
    pg = ctx.new_page(); logs = []
    pg.on('console', lambda m: logs.append(f'[{m.type}] {m.text}')); pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}'))
    def route(r):
        u = r.request.url
        if u in LOCAL: return r.fulfill(path=LOCAL[u], content_type='application/javascript')
        if u.startswith('https://fonts.'): return r.fulfill(body='', content_type='text/css')
        return r.continue_()
    pg.route('**/*', route)
    pg.goto(f'http://127.0.0.1:{port}/game.html', wait_until='load')
    t0 = time.time()
    while time.time() - t0 < 300:
        try:
            if pg.evaluate("(typeof BOOT!=='undefined'&&BOOT.ready)||!!window.__err"): break
        except Exception: pass
        time.sleep(0.5)
    if js: print('js ->', json.dumps(pg.evaluate(js))[:800])
    time.sleep(6)
    print('tier', pg.evaluate("({tier: QUALITY.tier, level: QUALITY.level, err: window.__err || null})"))
    pg.screenshot(path=out, timeout=300000)
    b.close()
for l in logs:
    if 'warning' not in l.lower() or 'error' in l.lower(): print(l[:300])
