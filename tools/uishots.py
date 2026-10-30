# render picture assets for the lobby (banners, map cards) from the game itself at a chosen quality
# usage: python3 tools/uishots.py <level> <views.js> [only_name...]
import sys, os, time, json, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
SP = os.path.dirname(os.path.abspath(__file__)) + '/..'
level, views = sys.argv[1], sys.argv[2]; only = sys.argv[3:]
LOCAL = {
    'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js': SP + '/dl/three-r128/build/three.min.js',
    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js': SP + '/dl/three-r128/examples/js/loaders/GLTFLoader.js',
    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/utils/SkeletonUtils.js': SP + '/dl/three-r128/examples/js/utils/SkeletonUtils.js',
}
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *x): pass
srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(Q, directory=SP)); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
W, H = int(os.environ.get('W', 960)), int(os.environ.get('H', 540))
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    ctx = b.new_context(viewport={'width': W, 'height': H})
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
    while time.time() - t0 < 400:
        try:
            if pg.evaluate("(typeof LOBBY!=='undefined'&&LOBBY.on)||!!window.__err"): break
        except Exception: pass
        time.sleep(0.5)
    print('boot', round(time.time() - t0), pg.evaluate("({tier: QUALITY.level, err: window.__err || null})"))
    pg.evaluate(open(SP + '/tools/gametest.js').read())
    names = pg.evaluate(open(views).read())
    for name in names:
        if only and name not in only: continue
        t1 = time.time()
        r = pg.evaluate('__ui[%s]()' % json.dumps(name))
        time.sleep(float(r.get('wait', 8)) if isinstance(r, dict) else 8)
        pg.screenshot(path=f'{SP}/shots/ui_{name}.png', timeout=300000)
        print(name, round(time.time() - t1), json.dumps(r)[:300])
    b.close()
for l in logs[-30:]:
    if '404' not in l: print(l[:300])
