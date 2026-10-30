# stage 6: the road network (A* over the terrain), graded and carved, with bridges over rivers
import numpy as np, json, ctypes
from scipy import ndimage
from common import *
lib = ctypes.CDLL(os.path.join(os.path.dirname(__file__), 'c/libwgc.so'))
fp = ctypes.POINTER(ctypes.c_float); ip = ctypes.POINTER(ctypes.c_int)
lib.astar.argtypes = [fp, fp, ctypes.c_int, ctypes.c_double, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_double, ctypes.c_double, ip, ctypes.c_int]
h = load('h3').astype(np.float64)
WL = load('WL'); FLOW = load('FLOW'); FLAT = load('FLAT')
P = json.load(open(OUT + '/places.json'))
toI = lambda x: int(round((x + HALF) / STEP)); toX = lambda i: -HALF + i * STEP
wet = (~np.isnan(WL)) & (WL > h - 0.05)
river = wet & (np.hypot(FLOW[..., 0], FLOW[..., 1]) > 0.5)
lakeocean = wet & ~river
# river cells right next to lakes/ocean count as lake (no bridges across river mouths into lakes)
cost = np.ones(h.shape, np.float32)
cost[river] = 14.0
cost[ndimage.binary_dilation(lakeocean, iterations=2)] = -1
R_desert = load('R_desert'); R_swamp = load('R_swamp')
cost += (R_desert * 0.3 + R_swamp * 0.6).astype(np.float32)
# buildings are obstacles, streets are cheap
for s in P['settlements']:
    for b in s['buildings']:
        i0, i1 = toI(b['x'] - b['hx'] - 3), toI(b['x'] + b['hx'] + 3); j0, j1 = toI(b['z'] - b['hz'] - 3), toI(b['z'] + b['hz'] + 3)
        cost[j0:j1 + 1, i0:i1 + 1] = -1
for s in P['settlements']:
    for st in s['streets']:
        pts = st['pts']
        for (ax, az), (bx, bz) in zip(pts[:-1], pts[1:]):
            n = max(1, int(np.hypot(bx - ax, bz - az) / 4))
            for k in range(n + 1):
                x = ax + (bx - ax) * k / n; z = az + (bz - az) * k / n; cost[toI(z), toI(x)] = 0.3
ROADS = []
ROADCELL = np.zeros(h.shape, bool)
def hbil(x, z):
    fx = (x + HALF) / STEP; fz = (z + HALF) / STEP; i = np.clip(np.floor(fx).astype(int), 0, N - 2); j = np.clip(np.floor(fz).astype(int), 0, N - 2); u = fx - i; v = fz - j
    return h[j, i] * (1 - u) * (1 - v) + h[j, i + 1] * u * (1 - v) + h[j + 1, i] * (1 - u) * v + h[j + 1, i + 1] * u * v
def wlbil(x, z):
    i = np.clip(np.round((x + HALF) / STEP).astype(int), 0, N - 1); j = np.clip(np.round((z + HALF) / STEP).astype(int), 0, N - 1)
    w = WL[j, i]; return np.where(np.isnan(w) | (w < h[j, i] - 0.05), -1e9, w)
def road(name, kind, pts, w, grade, maxSlope):
    global h
    buf = np.zeros(400000, np.int32); out = []
    c = cost.copy(); c[ROADCELL] = np.minimum(c[ROADCELL], 0.35)
    for (ax, az), (bx, bz) in zip(pts[:-1], pts[1:]):
        for (px, pz) in [(ax, az), (bx, bz)]:
            c[toI(pz) - 2:toI(pz) + 3, toI(px) - 2:toI(px) + 3] = np.maximum(c[toI(pz) - 2:toI(pz) + 3, toI(px) - 2:toI(px) + 3], 0.5)
        n = lib.astar(h.astype(np.float32).ctypes.data_as(fp), c.ctypes.data_as(fp), N, STEP, toI(ax), toI(az), toI(bx), toI(bz), 3.0, maxSlope * STEP / STEP, buf.ctypes.data_as(ip), len(buf))
        if n < 0: print('  !! no route', name, (ax, az), (bx, bz)); return None
        cells = buf[:n][::-1]; seg = [(toX(k % N), toX(k // N)) for k in cells]
        seg[0] = (ax, az); seg[-1] = (bx, bz)
        out += seg if not out else seg[1:]
    Q = np.array(out, np.float64)
    for _ in range(14): Q[1:-1] = Q[1:-1] * 0.5 + (Q[:-2] + Q[2:]) * 0.25
    d = np.r_[0, np.cumsum(np.hypot(*np.diff(Q, axis=0).T))]; s = np.arange(0, d[-1] + 0.01, 4.0)
    Q = np.c_[np.interp(s, d, Q[:, 0]), np.interp(s, d, Q[:, 1])]
    for _ in range(6): Q[1:-1] = Q[1:-1] * 0.5 + (Q[:-2] + Q[2:]) * 0.25
    g = hbil(Q[:, 0], Q[:, 1]); wl = wlbil(Q[:, 0], Q[:, 1])
    over = wl > -1e8
    # bridge spans: water plus a little run-up either side
    ov = ndimage.binary_dilation(over, iterations=4)
    y = ndimage.uniform_filter1d(g, 9, mode='nearest')
    y = np.where(ov, np.maximum(y, ndimage.maximum_filter1d(np.where(over, wl + 3.2, -1e9), 31, mode='nearest')), y)
    y = ndimage.uniform_filter1d(y, 5, mode='nearest')
    y[0], y[-1] = g[0], g[-1]
    gstep = grade * 4.0
    for i in range(1, len(y)): y[i] = np.clip(y[i], y[i - 1] - gstep, y[i - 1] + gstep)
    for i in range(len(y) - 2, -1, -1): y[i] = np.clip(y[i], y[i + 1] - gstep, y[i + 1] + gstep)
    # carve the corridor (not where the deck crosses water)
    reach = w / 2 + 16
    best_d = np.full(h.shape, 1e9); best_y = np.zeros(h.shape)
    for k in range(len(Q) - 1):
        if ov[k] and ov[k + 1]: continue
        ax, az = Q[k]; bx, bz = Q[k + 1]
        i0, i1 = max(0, toI(min(ax, bx) - reach)), min(N - 1, toI(max(ax, bx) + reach)); j0, j1 = max(0, toI(min(az, bz) - reach)), min(N - 1, toI(max(az, bz) + reach))
        sub = (slice(j0, j1 + 1), slice(i0, i1 + 1)); xx = X[sub]; zz = Z[sub]
        dx, dz = bx - ax, bz - az; L2 = dx * dx + dz * dz + 1e-9
        t = np.clip(((xx - ax) * dx + (zz - az) * dz) / L2, 0, 1); dd = np.hypot(xx - ax - dx * t, zz - az - dz * t)
        yy = y[k] + (y[k + 1] - y[k]) * t
        m = dd < best_d[sub]; bd = best_d[sub]; by = best_y[sub]; bd[m] = dd[m]; by[m] = yy[m]; best_d[sub] = bd; best_y[sub] = by
    sel = best_d < reach
    wgt = 1 - smooth(w / 2 + 2.0, reach, best_d)
    keep = wet & sel
    hn = np.where(sel & ~keep, h * (1 - wgt) + (best_y - 0.12) * wgt, h)
    h = hn
    ROADCELL[best_d < w / 2 + 1] = True
    FLAT[sel] = np.maximum(FLAT[sel], wgt[sel].astype(np.float32))
    bridges = []
    i = 0
    while i < len(over):
        if over[i]:
            j = i
            while j < len(over) and over[j]: j += 1
            bridges.append([max(0, i - 3), min(len(over) - 1, j + 2)]); i = j
        else: i += 1
    r = {'name': name, 'kind': kind, 'w': w, 'pts': [[round(float(a), 1), round(float(b), 1), round(float(c), 2)] for (a, b), c in zip(Q, y)], 'bridges': bridges}
    ROADS.append(r)
    print('road', name, kind, 'len', int(s[-1]), 'm', 'bridges', len(bridges))
    return r
S = {s['id']: s for s in P['settlements']}
POI = {p['name'] + str(i): p for i, p in enumerate(P['poi'])}
def gate(sid, which):
    s = S[sid]; st = s['streets'][0] if which in ('w', 'e') else s['streets'][1]
    if sid == 'city':
        bl = [q for q in s['streets'] if q['kind'] == 'boulevard'][0]['pts']; xs = sorted(p[0] for q in s['streets'] for p in q['pts'])
        zmax = max(p[1] for q in s['streets'] for p in q['pts'])
        return {'w': (bl[0][0], bl[0][1]), 'e': (bl[-1][0], bl[-1][1]), 's': (s['x'], zmax), 'sw': (xs[0], zmax), 'se': (xs[-1], zmax)}[which]
    horiz = [q for q in s['streets'][:2] if abs(q['pts'][-1][0] - q['pts'][0][0]) > abs(q['pts'][-1][1] - q['pts'][0][1])]
    vert = [q for q in s['streets'][:2] if q not in horiz]
    st = (horiz or vert)[0] if which in ('w', 'e') else (vert or horiz)[0]
    pts = st['pts']; a, b = pts[0], pts[-1]
    if which in ('w', 'n'): return tuple(a) if (a[0] < b[0] if which == 'w' else a[1] < b[1]) else tuple(b)
    return tuple(b) if (a[0] < b[0] if which == 'e' else a[1] < b[1]) else tuple(a)
def P_(name):
    for p in P['poi']:
        if p['name'] == name: return (p['x'], p['z'])
    raise KeyError(name)
HW, RD, TR = ('highway', 8.0, 0.075, 0.22), ('road', 6.5, 0.09, 0.26), ('track', 4.2, 0.13, 0.34)
HWM = ('highway', 8.0, 0.1, 0.36)
def R(name, spec, pts): return road(name, spec[0], pts, spec[1], spec[2], spec[3])
# the ring highway
R('طريق السنابل', HW, [gate('city', 'sw'), gate('farm', 'n')])
R('طريق الغرب', HW, [gate('farm', 's'), P_('محطة وقود الغرب'), gate('base', 'n') if False else (S['base']['x'], S['base']['z'] - 70)])
R('طريق الصحراء', HW, [(S['base']['x'], S['base']['z'] + 100), gate('desert', 'e')])
R('طريق الساحل الجنوبي', HW, [gate('desert', 'e'), P_('محطة وقود الجنوب'), gate('swamp', 'w')])
R('طريق المنجم', HW, [gate('swamp', 'e'), gate('mine', 's')])
R('طريق الجبل', HWM, [gate('mine', 'n'), gate('mountain', 's')])
R('طريق الوادي', ('road', 6.5, 0.1, 0.36), [gate('mountain', 's'), (1150.0, -1150.0), gate('resort', 'e')])
# secondary roads
R('طريق البحيرة', RD, [gate('city', 's'), gate('resort', 'n')])
R('طريق الغابة', RD, [gate('resort', 's'), P_('محطة وقود الجنوب')])
R('طريق المنارة', ('road', 6.5, 0.1, 0.4), [gate('city', 'e'), P_('المنارة')])
# tracks to the lonely places
R('درب الحطابين', TR, [gate('resort', 'w'), P_('معسكر الحطابين')])
R('درب القلعة', TR, [gate('desert', 'w'), P_('القلعة القديمة')])
R('درب المعبد', TR, [gate('desert', 's'), P_('معبد الرمال')])
R('درب البرج', TR, [gate('mountain', 's'), P_('برج الإرسال')])
R('درب الرياح', TR, [gate('farm', 'w'), P_('مزرعة الرياح')])
R('درب المعسكر', TR, [gate('mine', 'w'), P_('المعسكر المهجور')])
R('درب الكوخ', TR, [P_('محطة وقود الغرب'), [p for p in P['poi'] if p['name'] == 'كوخ الصياد'][2]['x'] and ([p for p in P['poi'] if p['name'] == 'كوخ الصياد'][2]['x'], [p for p in P['poi'] if p['name'] == 'كوخ الصياد'][2]['z'])])
save('h4', h.astype(np.float32)); save('FLAT', FLAT); save('ROADCELL', ROADCELL)
json.dump(ROADS, open(OUT + '/roads.json', 'w'), ensure_ascii=False)
print('total road km', round(sum(len(r['pts']) * 4 for r in ROADS) / 1000, 1))
