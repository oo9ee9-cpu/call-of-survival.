# two players in one browser: a mocked shared db and room (BroadcastChannel) — friends, invite, party, shared world, live avatars
import sys, os, time, json, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
SP = os.path.dirname(os.path.abspath(__file__)) + '/..'
LOCAL = {
    'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js': SP + '/dl/three-r128/build/three.min.js',
    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js': SP + '/dl/three-r128/examples/js/loaders/GLTFLoader.js',
    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/utils/SkeletonUtils.js': SP + '/dl/three-r128/examples/js/utils/SkeletonUtils.js',
}
MOCK = r"""
(() => {
  const P = new URLSearchParams(location.search), uid = P.get('u') || 'u1', K = '__mockdb';
  // each player keeps their own game storage; the mock db is shared
  const gi = Storage.prototype.getItem, si = Storage.prototype.setItem, ri = Storage.prototype.removeItem;
  Storage.prototype.getItem = function (k) { return gi.call(this, k === K ? k : uid + ':' + k); };
  Storage.prototype.setItem = function (k, v) { return si.call(this, k === K ? k : uid + ':' + k, v); };
  Storage.prototype.removeItem = function (k) { return ri.call(this, k === K ? k : uid + ':' + k); };
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  const load = () => JSON.parse(localStorage.getItem(K) || '{}'), save = (o) => localStorage.setItem(K, JSON.stringify(o));
  const bc = new BroadcastChannel('mockdb'), subs = new Set(), notify = () => { for (const f of [...subs]) try { f(); } catch (e) { console.error(e); } };
  bc.onmessage = () => notify();
  const snapDoc = (path, o) => Object.freeze({ id: path.split('/').pop(), exists: path in o, data: () => o[path], metadata: { fromCache: false, hasPendingWrites: false } });
  const write = (fn) => { const o = load(); fn(o); save(o); bc.postMessage(1); setTimeout(notify, 0); (window.__dblog = window.__dblog || []).push(Object.keys(o).length); };
  const allowed = (path) => { const seg = path.split('/'); if (seg[0] === 'data' && seg[1] === 'users' && seg[2] !== uid) return false; if (['profiles', 'links', 'invites', 'worlds'].includes(seg[0]) && seg[1] !== uid) return false; return true; };
  const doc = (path) => ({
    id: path.split('/').pop(), path,
    async get() { await delay(15); return snapDoc(path, load()); },
    async set(v) { await delay(25); if (!allowed(path)) throw { code: 'invalid_argument', message: 'not yours' }; write((o) => { o[path] = JSON.parse(JSON.stringify(v)); }); },
    async update(v) { await delay(25); write((o) => { o[path] = Object.assign({}, o[path], JSON.parse(JSON.stringify(v))); }); },
    async delete() { await delay(25); if (!allowed(path)) throw { code: 'invalid_argument', message: 'not yours' }; write((o) => { delete o[path]; }); },
    onSnapshot(next) { const f = () => next(snapDoc(path, load())); subs.add(f); setTimeout(f, 5); return () => subs.delete(f); },
  });
  const coll = (cpath, filters = [], lim = 1000) => {
    const q = {
      path: cpath,
      where(f, op, v) { return coll(cpath, [...filters, [f, op, v]], lim); },
      orderBy() { return q; }, limit(n) { return coll(cpath, filters, n); },
      _docs() {
        const o = load(), out = [];
        for (const k of Object.keys(o).sort()) {
          if (!k.startsWith(cpath + '/') || k.slice(cpath.length + 1).includes('/')) continue;
          const d = o[k]; if (!filters.every(([f, op, v]) => op === '==' ? d[f] === v : op === 'array-contains' ? Array.isArray(d[f]) && d[f].includes(v) : true)) continue;
          out.push(snapDoc(k, o));
        }
        return out.slice(0, lim);
      },
      async get() { await delay(15); const docs = q._docs(); return { docs, size: docs.length, empty: !docs.length, docChanges: () => docs.map((d) => ({ type: 'added', doc: d })) }; },
      onSnapshot(next) {
        let prev = new Map();
        const f = () => { const docs = q._docs(), now = new Map(docs.map((d) => [d.id, d])), ch = []; for (const d of docs) ch.push({ type: prev.has(d.id) ? 'modified' : 'added', doc: d }); for (const [id, d] of prev) if (!now.has(id)) ch.push({ type: 'removed', doc: d }); prev = now; next({ docs, size: docs.length, empty: !docs.length, docChanges: () => ch }); };
        subs.add(f); setTimeout(f, 5); return () => subs.delete(f);
      },
      doc(id) { return doc(cpath + '/' + (id || Math.random().toString(36).slice(2))); },
    };
    return q;
  };
  const peerId = uid + '-' + Math.random().toString(36).slice(2, 8);
  const mkRoom = (name) => {
    const ch = new BroadcastChannel('room-' + name), peers = new Map(), handlers = new Map(), peerHandlers = new Set();
    let me = Object.freeze({ peer: peerId, by: uid, isMe: true, sameTab: true, kind: 'viewer', guest: false, presence: Object.freeze({}), updatedAt: Date.now() });
    peers.set(peerId, me);
    const fire = (joined = [], left = [], updated = []) => { const arr = Object.freeze([...peers.values()]); for (const h of peerHandlers) h({ peers: arr, joined, left, updated }); };
    ch.onmessage = (e) => {
      const m = e.data;
      if (m.t === 'pres') { const had = peers.has(m.peer), p = Object.freeze({ peer: m.peer, by: m.by, isMe: false, sameTab: false, kind: 'viewer', guest: false, presence: Object.freeze(m.presence || {}), updatedAt: Date.now() }); peers.set(m.peer, p); fire(had ? [] : [p], [], had ? [p] : []); if (!had) ch.postMessage({ t: 'pres', peer: peerId, by: uid, presence: me.presence }); }
      else if (m.t === 'leave') { const p = peers.get(m.peer); peers.delete(m.peer); if (p) fire([], [p], []); }
      else if (m.t === 'emit') for (const h of handlers.get(m.topic) || []) h({ topic: m.topic, data: m.data, peer: m.peer, by: m.by, isMe: false, sameTab: false, kind: 'viewer', guest: false });
    };
    addEventListener('pagehide', () => ch.postMessage({ t: 'leave', peer: peerId }));
    const api = {
      name,
      async emit(topic, data) { (window.__emits = window.__emits || []).push(name + ':' + topic); ch.postMessage({ t: 'emit', topic, data, peer: peerId, by: uid }); for (const h of handlers.get(topic) || []) h({ topic, data, peer: peerId, by: uid, isMe: true, sameTab: true, kind: 'viewer', guest: false }); },
      on(topic, h) { if (!handlers.has(topic)) handlers.set(topic, new Set()); handlers.get(topic).add(h); return () => handlers.get(topic).delete(h); },
      async presence(patch) { const pr = Object.assign({}, me.presence, patch); for (const k of Object.keys(pr)) if (pr[k] === null) delete pr[k]; me = Object.freeze({ ...me, presence: Object.freeze(pr), updatedAt: Date.now() }); peers.set(peerId, me); ch.postMessage({ t: 'pres', peer: peerId, by: uid, presence: pr }); },
      peers() { return Object.freeze([...peers.values()]); },
      onPeers(h) { peerHandlers.add(h); setTimeout(() => h({ peers: api.peers(), joined: api.peers(), left: [], updated: [] }), 0); return () => peerHandlers.delete(h); },
      connected() { return true; }, onConnection(h) { setTimeout(() => h(true), 0); return () => {}; },
      async leave() { ch.postMessage({ t: 'leave', peer: peerId }); ch.close(); rooms.delete(name); },
    };
    ch.postMessage({ t: 'pres', peer: peerId, by: uid, presence: {} });
    return api;
  };
  const rooms = new Map(), lobby = mkRoom('lobby');
  lobby.join = async (name) => { if (!rooms.has(name)) rooms.set(name, mkRoom(name)); return rooms.get(name); };
  window.claude = { use: async (cap) => cap === 'db' ? { doc, collection: (p) => coll(p) } : cap === 'user' ? { id: async () => uid, me: async () => ({ id: uid }), isOwner: async () => uid === 'u1', canEdit: async () => uid === 'u1', can: async () => true } : cap === 'room' ? lobby : null };
})();
"""
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *x): pass
srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(Q, directory=SP)); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
out = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    ctx = b.new_context(viewport={'width': 480, 'height': 270})
    ctx.add_init_script("try { localStorage.setItem('u1:rock-island-q4', 'low'); localStorage.setItem('u2:rock-island-q4', 'low'); } catch (e) {}")
    ctx.add_init_script(MOCK)
    logs = []
    def mk(u):
        pg = ctx.new_page()
        pg.on('console', lambda m, u=u: logs.append(f'[{u} {m.type}] {m.text}')); pg.on('pageerror', lambda e, u=u: logs.append(f'[{u} pageerror] {e}'))
        def route(r):
            url = r.request.url
            if url in LOCAL: return r.fulfill(path=LOCAL[url], content_type='application/javascript')
            if url.startswith('https://fonts.'): return r.fulfill(body='', content_type='text/css')
            return r.continue_()
        pg.route('**/*', route)
        pg.goto(f'http://127.0.0.1:{port}/game.html?u={u}', wait_until='load')
        return pg
    A = mk('u1'); B = mk('u2')
    def ready(pg):
        t0 = time.time()
        while time.time() - t0 < 500:
            try:
                if pg.evaluate("(typeof LOBBY!=='undefined'&&LOBBY.on&&typeof NET!=='undefined'&&NET.ok)||!!window.__err"): return True
            except Exception: pass
            time.sleep(1)
        return False
    out.append(('ready', ready(A), ready(B)))
    S = "({gid: ACCOUNT.id, name: ACCOUNT.name, ok: NET.ok, why: NET.why, profiles: NET.profiles.size, out: NET.out, inSet: [...NET.inSet], friends: friendUids(), invites: [...NET.invites.keys()], party: NET.party, hosting: NET.hosting, inHost: NET.inHost, world: NET.worldName, peers: NET.world ? NET.world.peers().length : 0, remotes: NET.remotes.size, started, built: BUILT.length, err: window.__err || null})"
    time.sleep(3)
    out.append(('A', A.evaluate(S))); out.append(('B', B.evaluate(S)))
    bgid = B.evaluate("ACCOUNT.id")
    out.append(('A search B', A.evaluate("(g) => searchPlayers(g)", bgid)))
    A.evaluate("addFriend('u2')"); time.sleep(2)
    out.append(('B incoming', B.evaluate("incomingUids()")))
    B.evaluate("addFriend('u1')"); time.sleep(2)
    out.append(('friends', A.evaluate("friendUids()"), B.evaluate("friendUids()")))
    A.evaluate("inviteFriend('u2')"); time.sleep(3)
    out.append(('B invites', B.evaluate("[...NET.invites.keys()]")))
    B.evaluate("acceptInvite('u1')"); time.sleep(3)
    out.append(('A after accept', A.evaluate(S))); out.append(('B after accept', B.evaluate(S)))
    A.evaluate("playFromLobby()"); time.sleep(25)
    out.append(('A playing', A.evaluate(S))); out.append(('B follows', B.evaluate(S)))
    # A builds a foundation next to themselves: B must receive it
    out.append(('A builds', A.evaluate("""(() => { invAdd('b_foundation_wood', 1, true); startPlace('b_foundation_wood'); const p = player.pos, it = ITEMS.b_foundation_wood, plan = planPiece(it, p.x + 4, terrainAt(p.x + 4, p.z), p.z); BUILD.plan = plan; BUILD.ok = !plan.why; BUILD.why = plan.why; placeBuild(); return { why: plan.why || 'ok', built: BUILT.length, nk: BUILT.length ? BUILT[BUILT.length - 1].nk : null }; })()""")))
    time.sleep(4)
    out.append(('B sees build', B.evaluate("({built: BUILT.length, nks: BUILT.map((r) => r.nk).slice(-3), remotes: NET.remotes.size, pos: player.pos.toArray().map((v) => +v.toFixed(1))})")))
    out.append(('A sees B', A.evaluate("({remotes: NET.remotes.size, pos: player.pos.toArray().map((v) => +v.toFixed(1))})")))
    A.screenshot(path=SP + '/shots/net_A.png'); B.screenshot(path=SP + '/shots/net_B.png')
    b.close()
for r in out: print(json.dumps(r, ensure_ascii=False)[:1200])
for l in logs[-40:]:
    if 'warning' not in l and '404' not in l: print(l[:300])
