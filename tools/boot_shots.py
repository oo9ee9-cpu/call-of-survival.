"""the boot screen over time: screenshots at given seconds after the page opens, the film's state, any page errors;
a tap at 3 s turns the sound on (the theme should start and the sting play)
usage: python3 boot_shots.py <page> <out_prefix> <w> <h> <times,...> [mobile]"""
import sys, os, time, json, threading, http.server, socketserver, functools
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
page, out, w, h, times = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), [float(x) for x in sys.argv[5].split(',')]
mobile = len(sys.argv) > 6
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'])
    ctx = b.new_context(viewport={'width': w, 'height': h}, is_mobile=mobile, has_touch=mobile)
    pg = ctx.new_page(); logs = []
    pg.on('console', lambda m: m.type in ('error', 'warning') and logs.append(f'[{m.type}] {m.text[:200]}'))
    pg.on('pageerror', lambda e: logs.append(f'[pageerror] {str(e)[:300]}'))
    def route(r):
        u = r.request.url
        if u in LOCAL: return r.fulfill(path=LOCAL[u], content_type='application/javascript')
        if u.startswith('https://fonts.'): return r.fulfill(body='', content_type='text/css')
        return r.continue_()
    pg.route('**/*', route)
    t0 = time.time(); pg.goto(f'http://127.0.0.1:{port}/{page}', wait_until='commit')
    tapped = False
    for k, t in enumerate(times):
        while time.time() - t0 < t: time.sleep(0.05)
        if not tapped and time.time() - t0 > 3:
            tapped = True
            try: pg.mouse.click(w * 0.3, h * 0.4)
            except Exception as e: logs.append('tap ' + str(e)[:80])
        try:
            st = pg.evaluate("""(() => { const a = document.getElementById('bootIntro'), b = document.getElementById('bootLoop'), i = document.getElementById('intro');
              const v = (x) => x ? { t: +x.currentTime.toFixed(2), paused: x.paused, ended: x.ended, rs: x.readyState, src: x.currentSrc.split('/').pop(), err: x.error && x.error.code, cls: x.className } : null;
              return { intro: v(a), loop: v(b), cls: i && i.className, bar: (document.getElementById('loadBar') || {}).style && document.getElementById('loadBar').style.transform,
                audio: typeof AUDIO !== 'undefined' ? AUDIO.on : '?', theme: typeof AUDIO !== 'undefined' ? AUDIO.theme : null, ctx: typeof AUDIO !== 'undefined' && AUDIO.ctx ? AUDIO.ctx.state : null, lobby: typeof LOBBY !== 'undefined' && LOBBY.on }; })()""")
        except Exception as e: st = str(e)[:120]
        pg.screenshot(path=f'{out}_{k}.png', timeout=240000)
        print(round(time.time() - t0, 1), json.dumps(st)[:600], flush=True)
    b.close()
for l in logs[-25:]: print(l)
