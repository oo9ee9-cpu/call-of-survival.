"""render the loading film frame by frame: python3 render_boot.py <out_dir> <w> <h> <fps> <seconds> [first] [last] [step]
(frames are rendered for seconds + fade so the ends can be cross-faded into a loop by tools/make_boot.sh)"""
import sys, os, time, base64, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
SP = os.path.dirname(os.path.abspath(__file__)) + '/..'
out, w, h, fps, secs = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), float(sys.argv[5])
first = int(sys.argv[6]) if len(sys.argv) > 6 else 0
last = int(sys.argv[7]) if len(sys.argv) > 7 else int(round(secs * fps)) - 1
step = int(sys.argv[8]) if len(sys.argv) > 8 else 1
os.makedirs(out, exist_ok=True)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *x): pass
srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(Q, directory=SP)); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
t0 = time.time()
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': w, 'height': h})
    pg.on('console', lambda m: m.type == 'error' and print('[console]', m.text[:300], flush=True))
    pg.on('pageerror', lambda e: print('[pageerror]', str(e)[:300], flush=True))
    pg.goto(f'http://127.0.0.1:{port}/tools/boot_scene.html?w={w}&h={h}&' + os.environ.get('QS', ''), wait_until='load')
    for _ in range(600):
        st = pg.evaluate("({ok: window.READY, err: window.ERR || null, tex: [U.uDay, U.uDens, U.uSpec, U.uClouds].every((u) => u.value.image && u.value.image.complete)})")
        if st['err']: print('ERR', st['err']); sys.exit(1)
        if st['ok'] and st['tex']: break
        time.sleep(0.5)
    print('ready', round(time.time() - t0, 1), 's', flush=True)
    loop = float(os.environ.get('LOOP', secs)); fn = os.environ.get('FN', 'renderFrame')
    for i in range(first, last + 1, step):
        d = pg.evaluate(f"{fn}({i}, {fps}, {loop})")
        open(os.path.join(out, 'f%04d.jpg' % i), 'wb').write(base64.b64decode(d.split(',', 1)[1]))
        if i % 24 == 0: print('frame', i, round(time.time() - t0, 1), 's', flush=True)
    b.close()
print('done', round(time.time() - t0, 1), 's')
