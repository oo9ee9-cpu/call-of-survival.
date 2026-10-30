import sys, os, base64, threading, http.server, socketserver, functools, time
from playwright.sync_api import sync_playwright
SP = os.path.dirname(os.path.abspath(__file__)) + '/..'
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *x): pass
srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(Q, directory=SP)); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
out = sys.argv[1]
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 480, 'height': 480})
    pg.on('pageerror', lambda e: print('[pageerror]', str(e)[:300]))
    pg.goto(f'http://127.0.0.1:{port}/tools/boot_scene.html?w=480&h=480', wait_until='load')
    for _ in range(200):
        if pg.evaluate('window.READY'): break
        time.sleep(0.3)
    from PIL import Image
    import io
    tiles = []
    for posed in (0, 1):
        for view in ('front', 'side', 'back', 'top'):
            d = pg.evaluate(f"debugBody({posed}, '{view}')")
            tiles.append(Image.open(io.BytesIO(base64.b64decode(d.split(',', 1)[1]))).resize((240, 240)))
    W = Image.new('RGB', (960, 480))
    for i, t in enumerate(tiles): W.paste(t, ((i % 4) * 240, (i // 4) * 240))
    W.save(out); b.close()
