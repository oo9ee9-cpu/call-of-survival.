# headless Chromium harness: serve a folder, open a page, run optional JS, take screenshots
# usage: python3 shot.py <root_dir> <page> <out.png> [--w 1280 --h 720 --wait 8 --js "code" --until "expr" --shots n --gap s]
import sys, os, time, threading, argparse, json, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
ap = argparse.ArgumentParser()
ap.add_argument('root'); ap.add_argument('page'); ap.add_argument('out')
ap.add_argument('--w', type=int, default=1280); ap.add_argument('--h', type=int, default=720)
ap.add_argument('--wait', type=float, default=6.0); ap.add_argument('--js', default=''); ap.add_argument('--js2', default='')
ap.add_argument('--until', default=''); ap.add_argument('--timeout', type=float, default=240)
ap.add_argument('--shots', type=int, default=1); ap.add_argument('--gap', type=float, default=2.0)
ap.add_argument('--mobile', action='store_true'); ap.add_argument('--settle', type=float, default=0)
a = ap.parse_args()
SP = os.path.dirname(os.path.abspath(__file__)) + '/..'
LOCAL = {
    'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js': SP + '/dl/three-r128/build/three.min.js',
    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js': SP + '/dl/three-r128/examples/js/loaders/GLTFLoader.js',
    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/utils/SkeletonUtils.js': SP + '/dl/three-r128/examples/js/utils/SkeletonUtils.js',
    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/utils/BufferGeometryUtils.js': SP + '/dl/three-r128/examples/js/utils/BufferGeometryUtils.js',
}
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *x): pass
handler = functools.partial(Q, directory=os.path.abspath(a.root))
srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), handler); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
logs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'])
    ctx = b.new_context(viewport={'width': a.w, 'height': a.h}, device_scale_factor=1, is_mobile=a.mobile, has_touch=a.mobile)
    pg = ctx.new_page()
    pg.on('console', lambda m: logs.append(f'[{m.type}] {m.text}'))
    pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}'))
    def route(r):
        u = r.request.url
        if u in LOCAL: return r.fulfill(path=LOCAL[u], content_type='application/javascript')
        if u.startswith('https://fonts.'): return r.fulfill(body='', content_type='text/css')
        return r.continue_()
    pg.route('**/*', route)
    t0 = time.time()
    pg.goto(f'http://127.0.0.1:{port}/{a.page}', wait_until='load', timeout=120000)
    if a.until:
        while time.time() - t0 < a.timeout:
            try:
                if pg.evaluate(a.until): break
            except Exception as e: pass
            time.sleep(0.5)
    else: time.sleep(a.wait)
    if a.js:
        r = pg.evaluate(a.js)
        if r is not None: print('js ->', json.dumps(r)[:3000])
    if a.until and a.wait: time.sleep(a.wait)
    for k in range(a.shots):
        out = a.out if a.shots == 1 else a.out.replace('.png', f'_{k}.png')
        if a.js2 and k > 0:
            r = pg.evaluate(a.js2)
            if r is not None: print('js2 ->', json.dumps(r)[:2000])
            if a.settle: time.sleep(a.settle)
        pg.screenshot(path=out, timeout=180000)
        if k < a.shots - 1: time.sleep(a.gap)
    print('elapsed', round(time.time() - t0, 1))
    b.close()
for l in logs[-60:]: print(l[:500])
