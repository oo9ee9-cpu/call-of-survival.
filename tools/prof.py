# per-frame cost of the game's subsystems + a CPU profile of the main thread, in a scenario
# usage: python3 prof.py <page> <scenario js expression (after __go helpers)> <seconds> <out prefix> [--w W --h H]
import sys, os, time, json, threading, http.server, socketserver, functools, argparse, collections
from playwright.sync_api import sync_playwright
ap = argparse.ArgumentParser(); ap.add_argument('page'); ap.add_argument('scenario'); ap.add_argument('secs', type=float); ap.add_argument('out')
ap.add_argument('--w', type=int, default=960); ap.add_argument('--h', type=int, default=540); ap.add_argument('--warm', type=float, default=6)
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
srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(Q, directory=os.path.abspath(SP))); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
WRAP = r"""
(() => {
  // wrap the subsystems simulate() calls: their time per frame
  const names = ['gatherInput','updateVehicles','updateTraffic','updatePlayer','updateWeapon','updateDrops','updateZombies','updateBots','updateAnimals','updateHealth','updateSurvival','updateBuild','updateBuilt','updateSave','updateCamera','updateFlashlight','updateLightPool','updateHud','updateBirds','updateSettlements','updateRoadLod','vegFrame','updateVegetation','updateGrass','updateRocks','updateWater','updateParticles','updateEffects','updateFeatures','updateWeather','updateEnvironment','updateAccount','placeSun','updateKeepers','updateLandforms'];
  window.__T = {}; window.__N = 0;
  for (const n of names) { const f = window[n]; if (typeof f !== 'function') continue; window[n] = function () { const t = performance.now(); try { return f.apply(this, arguments); } finally { __T[n] = (__T[n] || 0) + performance.now() - t; } }; }
  for (const [k, o, m] of [['TERRAIN.update', TERRAIN, 'update'], ['ENVMAP.update', ENVMAP, 'update'], ['POST.render', POST, 'render'], ['BLOBS.update', BLOBS, 'update'], ['RAIN.update', RAIN, 'update'], ['AUDIO.update', AUDIO, 'update']]) {
    const f = o[m]; o[m] = function () { const t = performance.now(); try { return f.apply(this, arguments); } finally { __T[k] = (__T[k] || 0) + performance.now() - t; } };
  }
  const sim = window.simulate; window.simulate = function (dt) { const t = performance.now(); __N++; try { return sim(dt); } finally { __T.simulate = (__T.simulate || 0) + performance.now() - t; } };
  const ups = UPDATERS.slice(); UPDATERS.length = 0; ups.forEach((u, i) => UPDATERS.push(function () { const t = performance.now(); try { return u.apply(this, arguments); } finally { const k = 'UPDATER' + i + ':' + (u.name || '?'); __T[k] = (__T[k] || 0) + performance.now() - t; } }));
  window.__reset = () => { __T = {}; __N = 0; renderer.info.reset(); };
  return 'wrapped ' + names.length;
})()
"""
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': a.w, 'height': a.h})
    def route(r):
        u = r.request.url
        if u in LOCAL: return r.fulfill(path=LOCAL[u], content_type='application/javascript')
        if u.startswith('https://fonts.'): return r.fulfill(body='', content_type='text/css')
        return r.continue_()
    pg.route('**/*', route)
    logs = []; pg.on('console', lambda m: m.type in ('error',) and logs.append(m.text[:300])); pg.on('pageerror', lambda e: logs.append('PAGEERR ' + str(e)[:300]))
    pg.goto(f'http://127.0.0.1:{port}/{a.page}', wait_until='load')
    t0 = time.time()
    while time.time() - t0 < 900:
        try:
            if pg.evaluate('window.BOOT && BOOT.ready'): break
        except Exception: pass
        time.sleep(1)
    print('boot', round(time.time() - t0), 's')
    pg.evaluate(open(os.path.join(SP, 'tools/gametest.js')).read())
    print('scenario ->', pg.evaluate(a.scenario))
    print(pg.evaluate(WRAP))
    time.sleep(a.warm)
    pg.evaluate('__reset()')
    cdp = pg.context.new_cdp_session(pg)
    cdp.send('Profiler.enable'); cdp.send('Profiler.setSamplingInterval', {'interval': 500}); cdp.send('Profiler.start')
    t1 = time.time(); time.sleep(a.secs)
    prof = cdp.send('Profiler.stop')['profile']
    res = pg.evaluate("({N: __N, T: __T, calls: renderer.info.render.calls, tris: renderer.info.render.triangles, frames: renderer.info.render.frame, geos: renderer.info.memory.geometries, texs: renderer.info.memory.textures, progs: renderer.info.programs.length, ratio: renderer.getPixelRatio(), dyn: DYNRES.scale, strain: STRAIN.level})")
    el = time.time() - t1
    json.dump(prof, open(a.out + '.cpuprofile', 'w'))
    N = max(1, res['N'])
    print(f"frames {N} in {el:.1f}s ({N/el:.1f} fps headless)  last-frame calls {res['calls']} tris {res['tris']}  geos {res['geos']} texs {res['texs']} programs {res['progs']} ratio {res['ratio']} dyn {res['dyn']} strain {res['strain']}")
    for k, v in sorted(res['T'].items(), key=lambda kv: -kv[1])[:32]: print(f'  {k:28s} {v / N:7.2f} ms/frame')
    # self time by function from the profile
    nodes = {n['id']: n for n in prof['nodes']}; self_t = collections.Counter()
    dt = prof.get('timeDeltas', []); samples = prof.get('samples', [])
    for s, d in zip(samples, dt): n = nodes[s]; cf = n['callFrame']; self_t[(cf['functionName'] or '(anon)', cf['url'].split('/')[-1][:20], cf['lineNumber'])] += d
    tot = sum(self_t.values()) or 1
    print('top self time:')
    for (fn, url, ln), t in self_t.most_common(30): print(f'  {t / 1000:8.1f} ms {100 * t / tot:5.1f}%  {fn} {url}:{ln}')
    for l in logs[-10:]: print('LOG', l)
    b.close()
