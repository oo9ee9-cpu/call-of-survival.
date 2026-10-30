import sys, os, base64, threading, http.server, socketserver, functools, time, io
from playwright.sync_api import sync_playwright
from PIL import Image
SP = os.path.dirname(os.path.abspath(__file__)) + '/..'
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *x): pass
srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(Q, directory=SP)); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 640, 'height': 360})
    pg.goto(f'http://127.0.0.1:{port}/tools/boot_scene.html?w=640&h=360', wait_until='load')
    for _ in range(300):
        if pg.evaluate("window.READY && [U.uDay, U.uDens, U.uSpec, U.uClouds].every((u) => u.value.image && u.value.image.complete)"): break
        time.sleep(0.3)
    tiles = []
    for k in range(12):
        r = k / 12
        d = pg.evaluate(f"(() => {{ window.ROT0 = {r}; return renderFrame(0, 24, 14); }})()")
        im = Image.open(io.BytesIO(base64.b64decode(d.split(',', 1)[1]))).resize((320, 180)); tiles.append(im)
    W = Image.new('RGB', (1280, 540))
    for i, t in enumerate(tiles): W.paste(t, ((i % 4) * 320, (i // 4) * 180))
    W.save(sys.argv[1]); b.close()
