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
                if pg.evaluate("(typeof LOBBY!=='undefined'&&LOBBY.on)||!!window.__err"): break
            except Exception: pass
            time.sleep(0.5)
    def ev(js): return pg.evaluate(js)
    A = "({id: ACCOUNT.id, name: ACCOUNT.name, lv: ACCOUNT.level, xp: Math.round(ACCOUNT.xp), gold: ACCOUNT.gold, gems: ACCOUNT.gems, free: ACCOUNT.gemsFree, ward: ACCOUNT.wardrobe.length, look: ACCOUNT.look, upg: ACCOUNT.upg, life: ACCOUNT.life, daily: ACCOUNT.daily && ACCOUNT.daily.ids, wear: INV.wearing, doc: !!ACC.doc, err: window.__err || null})"
    boot()
    out.append(('boot1 new account', ev(A)))
    out.append(('store', ev("""(() => { ACCOUNT.gold += 1000; const a = buyWear('top_shirt_red'), b = buyWear('top_shirt_red'), c = buyWear('suit_gold'), d = buyWear('suit_desert'); wearItem('top_shirt_red', true);
      const u1 = buyUpgrade('bag'), u2 = buyUpgrade('bag'), u3 = buyUpgrade('gun'); return { a, b, c, d, gold: ACCOUNT.gold, gems: ACCOUNT.gems, look: ACCOUNT.look, cap: bagCap(), upg: ACCOUNT.upg, u1, u2, u3 }; })()""")))
    out.append(('ui sheets', ev("""(() => { const r = {}; for (const s of ['wardrobe', 'store', 'workshop', 'missions', 'training', 'friends']) { openSheet(s); r[s] = document.querySelectorAll('#lbBody .lb-item, #lbBody .lb-row').length; } closeSheet();
      for (const m of ['topup', 'gold', 'profile', 'map', 'exit', 'credits']) { openModal(m); r[m] = $('lbMCard').textContent.slice(0, 40); } closeModal(); openSettings(); for (const t of ['gfx','ctl','snd','ui','acc','play','about']) { setTab = t; renderSettings(); r['set_' + t] = document.querySelectorAll('#setBody .srow').length; } closeSettings(); return r; })()""")))
    ev("playFromLobby(); 1"); time.sleep(4)
    out.append(('in game', ev("({started, lobby: LOBBY.on, wear: INV.wearing, outfitTop: player.outfit.top, hour: +ENV.hour.toFixed(2), wstate: WEATHER.state})")))
    out.append(('progress', ev("""(() => { const lv0 = ACCOUNT.level, g0 = ACCOUNT.gold; track('kills', 16); track('wood', 220); track('felled', 9); addXP(400);
      const d = ACCOUNT.daily.ids.map((id) => [id, missionProgress('daily', missionDef('daily', id))]); const claims = ACCOUNT.daily.ids.map((id) => claimMission('daily', id));
      const ach = claimAch('a_kill'); return { lv0, lv: ACCOUNT.level, gold: ACCOUNT.gold - g0, d, claims, ach, cl: claimable() }; })()""")))
    ev("accFlush(); saveNow(); 1"); time.sleep(2)
    out.append(('db docs', ev("Object.keys(JSON.parse(localStorage.getItem('__mockdb')||'{}'))")))
    out.append(('world doc', ev("(async () => { const d = JSON.parse(localStorage.getItem('__mockdb'))['data/users/u1/world']; if (!d) return null; const back = JSON.parse(await worldFromBody(d)); return { packed: !!d.z, len: (d.z || d.json || '').length, v: back.v, keys: Object.keys(back) }; })()")))
    ev("player.bornAt = -99; damagePlayer(5000, null, 'test'); 1"); time.sleep(2)
    ev("document.getElementById('respawnBtn').click(); 1"); time.sleep(1)
    out.append(('after death', ev("({alive: player.alive, coins: INV.coins, wear: INV.wearing, look: ACCOUNT.look, lv: ACCOUNT.level, gold: ACCOUNT.gold, deaths: ACCOUNT.life.deaths, best: ACCOUNT.best})")))
    ev("toLobby(); 1"); time.sleep(3)
    out.append(('back in lobby', ev("({started, lobby: LOBBY.on, hud: hud.classList.contains('on')})")))
    ev("accFlush(); 1"); time.sleep(2)
    boot()
    out.append(('boot2 reload', ev(A)))
    ev("localStorage.removeItem('rock-island-account-v1'); 1")
    boot()
    out.append(('boot3 from db only', ev(A)))
    b.close()
for k, v in out: print(k, json.dumps(v, ensure_ascii=False)[:900])
seen = set()
for l in logs:
    if 'warning' in l or '404' in l or l in seen: continue
    seen.add(l); print(l[:300] if 'shader error' not in l else l)
