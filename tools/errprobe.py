# load the page and print every console error and page error in the first seconds
import sys, time, threading, http.server, socketserver, functools, os
from playwright.sync_api import sync_playwright
SP = os.path.dirname(os.path.abspath(__file__)) + '/..'
LOCAL = {
    'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js': SP + '/dl/three-r128/build/three.min.js',
    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js': SP + '/dl/three-r128/examples/js/loaders/GLTFLoader.js',
    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/utils/SkeletonUtils.js': SP + '/dl/three-r128/examples/js/utils/SkeletonUtils.js',
}
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *x): pass
srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(Q, directory=SP)); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
page = sys.argv[1] if len(sys.argv) > 1 else 'game.html'; wait = float(sys.argv[2]) if len(sys.argv) > 2 else 25
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': int(sys.argv[3]) if len(sys.argv) > 3 else 640, 'height': int(sys.argv[4]) if len(sys.argv) > 4 else 360})
    def route(r):
        u = r.request.url
        if u in LOCAL: return r.fulfill(path=LOCAL[u], content_type='application/javascript')
        if u.startswith('https://fonts.'): return r.fulfill(body='', content_type='text/css')
        return r.continue_()
    pg.route('**/*', route)
    pg.on('console', lambda m: m.type in ('error',) and print('[console]', m.text[:400]))
    pg.on('pageerror', lambda e: print('[pageerror]', str(e)[:600]))
    pg.goto(f'http://127.0.0.1:{port}/{page}', wait_until='load')
    t0 = time.time()
    while time.time() - t0 < wait:
        time.sleep(1)
        try:
            st = pg.evaluate("({stack: String(window.__err || '').slice(0, 900), world: typeof WORLD !== 'undefined' && WORLD.ready, lobby: typeof LOBBY !== 'undefined' && LOBBY.on, note: (document.getElementById('loadNote') || {}).textContent})")
            if st['lobby'] or st['stack']: break
        except Exception as e: st = str(e)[:200]
    print('state', st)
    b.close()
