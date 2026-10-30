# stage 4: lakes and rivers carved into the eroded relief; water level grid
import numpy as np, ctypes, json
from scipy import ndimage
from common import *
lib = ctypes.CDLL(os.path.join(os.path.dirname(__file__), 'c/libwgc.so'))
fp = ctypes.POINTER(ctypes.c_float); ip = ctypes.POINTER(ctypes.c_int)
lib.astar.argtypes = [fp, fp, ctypes.c_int, ctypes.c_double, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_double, ctypes.c_double, ip, ctypes.c_int]
h = load('h1').astype(np.float32).copy()
land0 = h > 0
WL = np.full(h.shape, np.nan, np.float32)        # water surface
FLOW = np.zeros(h.shape + (2,), np.float32)      # river flow direction
toI = lambda x: int(round((x + HALF) / STEP)); toX = lambda i: -HALF + i * STEP
def hat(x, z): return float(h[toI(z), toI(x)])
lakes = []
def hbil(x, z):
    fx = (x + HALF) / STEP; fz = (z + HALF) / STEP; i = np.clip(np.floor(fx).astype(int), 0, N - 2); j = np.clip(np.floor(fz).astype(int), 0, N - 2); u = fx - i; v = fz - j
    return h[j, i] * (1 - u) * (1 - v) + h[j, i + 1] * u * (1 - v) + h[j + 1, i] * (1 - u) * v + h[j + 1, i + 1] * u * v
def lake(name, cx, cz, rx, rz, rot=0.0, depth=6.0, level=None, pct=35):
    global h
    c, s = np.cos(rot), np.sin(rot); dx = X - cx; dz = Z - cz
    u = (dx * c + dz * s) / rx; v = (-dx * s + dz * c) / rz
    r = np.sqrt(u * u + v * v) + 0.22 * fbm(X / 260 + cx * 0.001, Z / 260 + cz * 0.001, 3, seed=61)
    inside = r < 1.0
    if level is None: level = float(np.percentile(h[inside], pct))
    bottom = level - depth * (1 - np.clip(r, 0, 1) ** 2) - 0.6
    rim = smooth(1.0, 1.6, r)                       # banks rise back to the terrain
    target = np.where(inside, bottom, level + 0.4 + (h - level - 0.4) * rim)
    h = np.where(r < 1.6, np.minimum(h, np.maximum(target, np.minimum(h, bottom))), h).astype(np.float32)
    h = np.where(inside, np.minimum(h, bottom), h).astype(np.float32)
    m = (r < 1.15) & (h < level)
    WL[m] = level; lakes.append({'name': name, 'x': cx, 'z': cz, 'rx': rx, 'rz': rz, 'level': round(level, 2)})
    print('lake', name, 'level', round(level, 1), 'cells', int(m.sum()))
    return level
def route(pts, slopeW=0.0, meander=0.0):
    """A* between waypoints over a cost that prefers low ground, returns world points"""
    cost = (1.0 + np.clip(h, 0, None) / 25.0).astype(np.float32)
    cost[h < -6] = -1
    out = []
    buf = np.zeros(200000, np.int32)
    for (ax, az), (bx, bz) in zip(pts[:-1], pts[1:]):
        n = lib.astar(h.ctypes.data_as(fp), cost.ctypes.data_as(fp), N, STEP, toI(ax), toI(az), toI(bx), toI(bz), slopeW, 10.0, buf.ctypes.data_as(ip), len(buf))
        if n < 0: raise RuntimeError('no path %s' % ((ax, az, bx, bz),))
        cells = buf[:n][::-1]
        seg = [(toX(k % N), toX(k // N)) for k in cells]
        out += seg if not out else seg[1:]
    # smooth + resample every 6 m
    P = np.array(out, np.float64)
    for _ in range(30): P[1:-1] = P[1:-1] * 0.5 + (P[:-2] + P[2:]) * 0.25
    d = np.r_[0, np.cumsum(np.hypot(*np.diff(P, axis=0).T))]; s = np.arange(0, d[-1], 6.0)
    P = np.c_[np.interp(s, d, P[:, 0]), np.interp(s, d, P[:, 1])]
    if meander > 0 and len(P) > 40:
        T = np.gradient(P, axis=0); T /= np.linalg.norm(T, axis=1, keepdims=True) + 1e-9; Nn = np.c_[-T[:, 1], T[:, 0]]
        g = hbil(P[:, 0], P[:, 1]); sl = np.abs(np.gradient(ndimage.uniform_filter1d(g, 9, mode='nearest'))) / 6.0
        flat = 1 - smooth(0.02, 0.09, ndimage.uniform_filter1d(sl, 31, mode='nearest'))
        ph = s / 260.0 * 2 * np.pi + 2.2 * np.cumsum(np.random.RandomState(len(P)).randn(len(P))) * 0.02
        off = meander * flat * np.sin(ph) * np.minimum(1, np.minimum(s, s[-1] - s) / 200.0)
        P = P + Nn * off[:, None]
        for _ in range(8): P[1:-1] = P[1:-1] * 0.5 + (P[:-2] + P[2:]) * 0.25
        d = np.r_[0, np.cumsum(np.hypot(*np.diff(P, axis=0).T))]; s = np.arange(0, d[-1], 6.0)
        P = np.c_[np.interp(s, d, P[:, 0]), np.interp(s, d, P[:, 1])]
    return P
rivers = []
def snap_sea(x, z, R=900):
    i, j = toI(x), toI(z); r = int(R / STEP)
    sub = h[max(0, j - r):j + r, max(0, i - r):i + r]; jj, ii = np.mgrid[max(0, j - r):j + r, max(0, i - r):i + r]
    ok = (sub < -0.3) & (sub > -5.5); d = np.hypot(ii - i, jj - j); d[~ok] = 1e9; k = np.argmin(d)
    if d.flat[k] > 1e8: raise RuntimeError('no sea near %s' % ((x, z),))
    return (toX(ii.flat[k]), toX(jj.flat[k]))
def river(name, pts, w0, w1, start_level=None, end_level=0.0, depth0=1.6, depth1=3.2, meander=55.0):
    global h
    if end_level == 0.0: pts = pts[:-1] + [snap_sea(*pts[-1])]
    print('  waypoints', [(int(a), int(b), round(hat(a, b), 1)) for a, b in pts])
    P = route(pts, meander=meander); n = len(P)
    t = np.linspace(0, 1, n); width = w0 + (w1 - w0) * t; depth = depth0 + (depth1 - depth0) * t
    ground = hbil(P[:, 0], P[:, 1]).astype(np.float64)
    gs = ndimage.uniform_filter1d(ground, 25, mode='nearest')
    W = np.minimum.accumulate(gs - 0.9)
    if start_level is not None: W = np.minimum(W, start_level)
    W = np.maximum(W, end_level)
    W = np.minimum.accumulate(ndimage.uniform_filter1d(W, 15, mode='nearest'))
    # carve: walk segments, update cells in a corridor
    reach = (width.max() / 2 + 40)
    for k in range(0, n - 1):
        ax, az = P[k]; bx, bz = P[k + 1]
        i0 = max(0, toI(min(ax, bx) - reach)); i1 = min(N - 1, toI(max(ax, bx) + reach))
        j0 = max(0, toI(min(az, bz) - reach)); j1 = min(N - 1, toI(max(az, bz) + reach))
        if k % 3: continue
        sub = (slice(j0, j1 + 1), slice(i0, i1 + 1)); xx = X[sub]; zz = Z[sub]
        kk = min(n - 1, k + 3); bx, bz = P[kk]; dx, dz = bx - ax, bz - az; L2 = dx * dx + dz * dz + 1e-9
        tt = np.clip(((xx - ax) * dx + (zz - az) * dz) / L2, 0, 1); dd = np.hypot(xx - ax - dx * tt, zz - az - dz * tt)
        wl = W[k] + (W[kk] - W[k]) * tt; hw = (width[k] + (width[kk] - width[k]) * tt) / 2; dp = depth[k]
        bed = wl - dp * (1 - np.clip(dd / np.maximum(hw, 1), 0, 1) ** 2) - 0.25
        bank = wl + 0.35 + np.maximum(0, dd - hw) * 0.22
        hh = h[sub]
        newh = np.where(dd < hw, np.minimum(hh, bed), np.minimum(hh, np.maximum(bank, np.minimum(hh, bed + (dd - hw) * 0.6))))
        h[sub] = np.where(dd < hw + 40, newh, hh).astype(np.float32)
        wm = dd < hw + 1.5
        cur = WL[sub]; WL[sub] = np.where(wm & (np.isnan(cur) | (cur > wl)), wl, cur)
        f = FLOW[sub]; f[wm] = (dx / np.sqrt(L2), dz / np.sqrt(L2)); FLOW[sub] = f
    rivers.append({'name': name, 'pts': [[round(float(a), 1), round(float(b), 1)] for a, b in P[::3]], 'w': [round(float(x), 1) for x in width[::3]], 'wl': [round(float(x), 2) for x in W[::3]]})
    print('river', name, 'len', int(n * 6), 'm', 'level', round(W[0], 1), '->', round(W[-1], 1))
# ---- lakes first (rivers flow between them)
L_big = lake('البحيرة الكبرى', 250, -330, 640, 410, 0.25, depth=9)
L_tarn = lake('بحيرة الجبل', 1760, -1150, 210, 160, 0.4, depth=7)
L_ne = lake('بحيرة المرتفعات', 2050, -2480, 260, 170, -0.5, depth=6)
L_oasis = lake('واحة السراب', -1950, 2080, 95, 75, 0.0, depth=3)
L_pond = lake('بركة المزرعة', -2250, -650, 95, 70, 0.6, depth=2.5)
L_forest = lake('بحيرة الصنوبر', -850, -1550, 170, 120, 0.9, depth=4)
# ---- rivers
river('نهر الوادي', [(1640, -1080), (1200, -820), (760, -480), (790, -330)], 9, 16, start_level=L_tarn, end_level=L_big)
river('نهر الجنوب', [(320, 90), (260, 700), (420, 1400), (700, 2000), (820, 2500), (850, 2950)], 16, 30, start_level=L_big, end_level=0.0)
river('نهر الشمال', [(1950, -2330), (1450, -2350), (1000, -2600), (800, -2780)], 10, 22, start_level=L_ne, end_level=0.0)
river('نهر السهول', [(-720, -1450), (-900, -800), (-1200, 0), (-1380, 420)], 8, 18, start_level=L_forest, end_level=0.0)
# ---- swamp lagoons: low hollows that fill to a shallow level
Rsw = load('R_swamp')
holes = (fbm(X / 180, Z / 180, 4, seed=62) > 0.18) & (Rsw > 0.55) & (h > 0)
h = np.where(holes, np.minimum(h, 0.4 + (h - 0.4) * 0.3 - 0.9 * smooth(0.18, 0.4, fbm(X / 180, Z / 180, 4, seed=62))), h).astype(np.float32)
sw = (Rsw > 0.45) & (h < 1.05) & (h > -0.5) & land0
WL[sw & np.isnan(WL)] = 1.05
# ---- ocean: everything below 0 connected to the open sea
lab, nn = ndimage.label(h < 0); border = set(np.unique(np.r_[lab[0], lab[-1], lab[:, 0], lab[:, -1]])) - {0}
ocean = np.isin(lab, list(border))
WL[ocean & np.isnan(WL)] = 0.0
# any remaining land below 0 that is not ocean becomes a pond at its spill level (simplified: 0.2)
pits = (h < 0) & ~ocean
WL[pits & np.isnan(WL)] = 0.2
water = ~np.isnan(WL) & (h < WL)
print('water cells (8 km)', round(water[inplay()].mean() * 100, 3), '% ; land', round(100 - water[inplay()].mean() * 100, 3))
save('h2', h); save('WL', WL); save('FLOW', FLOW)
json.dump({'lakes': lakes, 'rivers': rivers}, open(OUT + '/water.json', 'w'), ensure_ascii=False)
