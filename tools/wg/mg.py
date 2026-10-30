# the world pipeline for the extra maps: MAP=<id> python3 tools/wg/mg.py [stage ...]
# stages: land relief erode water places roads biomes export (default: all of them, in order)
# each map is described by tools/wg/maps/<id>.py; this file holds everything the maps share
import numpy as np, json, ctypes, random, importlib, sys, os, time
from scipy import ndimage
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
spec = importlib.import_module('maps.' + MAP)
lib = ctypes.CDLL(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'c/libwgc.so'))
fp = ctypes.POINTER(ctypes.c_float); ip = ctypes.POINTER(ctypes.c_int)
lib.erode.argtypes = [fp, fp, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_double, ctypes.c_double, ctypes.c_double, ctypes.c_double, ctypes.c_double, ctypes.c_double, ctypes.c_double, ctypes.c_double, ctypes.c_int, ctypes.c_uint, ctypes.c_float]
lib.thermal.argtypes = [fp, fp, ctypes.c_int, ctypes.c_int, ctypes.c_double, ctypes.c_double, ctypes.c_double]
lib.astar.argtypes = [fp, fp, ctypes.c_int, ctypes.c_double, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_double, ctypes.c_double, ip, ctypes.c_int]
toI = lambda x: int(max(0, min(N - 1, round((x + HALF) / STEP))))
toX = lambda i: -HALF + i * STEP
AREA_K = (N * N) / (1025 * 1025)          # this grid's cell count against the original island's
CELL_K = (8.0 / STEP) ** 2                 # cells per 8 m cell


def jdump(name, obj): json.dump(obj, open(os.path.join(OUT, name), 'w'), ensure_ascii=False)
def jload(name): return json.load(open(os.path.join(OUT, name)))
def regions(): return {k: load('R_' + k).astype(np.float64) for k in jload('regions.json')}
def hbil_of(h):
    def f(x, z):
        fx = (np.asarray(x, np.float64) + HALF) / STEP; fz = (np.asarray(z, np.float64) + HALF) / STEP
        i = np.clip(np.floor(fx).astype(int), 0, N - 2); j = np.clip(np.floor(fz).astype(int), 0, N - 2); u = np.clip(fx - i, 0, 1); v = np.clip(fz - j, 0, 1)
        return h[j, i] * (1 - u) * (1 - v) + h[j, i + 1] * u * (1 - v) + h[j + 1, i] * (1 - u) * v + h[j + 1, i + 1] * u * v
    return f
def soft(cx, cz, rx, rz, rot=0.0, edge=0.5, warp=None):
    """a soft elliptic region mask: 1 inside, easing to 0 at the rim (optionally domain-warped)"""
    WX, WZ = warp if warp is not None else (0.0, 0.0)
    c, s = np.cos(rot), np.sin(rot); dx = X + WX - cx; dz = Z + WZ - cz
    u = (dx * c + dz * s) / rx; v = (-dx * s + dz * c) / rz
    return smooth(0, edge, 1 - np.sqrt(u * u + v * v))
def ellw(cx, cz, rx, rz, rot=0.0, warp=None):
    WX, WZ = warp if warp is not None else (0.0, 0.0)
    c, s = np.cos(rot), np.sin(rot); dx = X + WX - cx; dz = Z + WZ - cz
    u = (dx * c + dz * s) / rx; v = (-dx * s + dz * c) / rz
    return 1 - np.sqrt(u * u + v * v)
def warp(scale, amp, seed):
    return (fbm(X / scale + 3.1, Z / scale - 7.7, 4, seed=seed) * amp, fbm(X / scale - 5.3, Z / scale + 2.9, 4, seed=seed + 1) * amp)
def spine_dist(pts):
    d = np.full(X.shape, 1e9); tpar = np.zeros(X.shape); acc = 0.0
    segs = list(zip(pts[:-1], pts[1:])); total = sum(np.hypot(b[0] - a[0], b[1] - a[1]) for a, b in segs)
    for a, b in segs:
        ax, az = a; bx, bz = b; dx, dz = bx - ax, bz - az; l2 = dx * dx + dz * dz; l = np.sqrt(l2)
        t = np.clip(((X - ax) * dx + (Z - az) * dz) / l2, 0, 1); dd = np.hypot(X - ax - dx * t, Z - az - dz * t)
        m = dd < d; d = np.where(m, dd, d); tpar = np.where(m, (acc + t * l) / total, tpar); acc += l
    return d, tpar


# ═════════ 1. land ═════════
def st_land():
    F = spec.land_field()
    edge = np.maximum(np.abs(X), np.abs(Z))
    m = getattr(spec, 'EDGE', min(450.0, PLAY * 0.12))
    F = F - smooth(PLAY - m, PLAY + 40, edge) * 1.5
    IP = inplay(); lo, hi = -2.0, 2.0
    for _ in range(50):
        t = (lo + hi) / 2
        if (F > t)[IP].mean() > spec.TARGET_LAND: lo = t
        else: hi = t
    land = F > t
    lab, n = ndimage.label(land); sizes = ndimage.sum(land, lab, range(1, n + 1))
    land = np.isin(lab, 1 + np.where(sizes > getattr(spec, 'MIN_ISLAND', 300) * CELL_K)[0])
    sea = ~land; lab, n = ndimage.label(sea); sizes = ndimage.sum(sea, lab, range(1, n + 1)); big = 1 + np.argmax(sizes)
    keep_sea = getattr(spec, 'KEEP_LAGOONS', 0) * CELL_K       # enclosed seas larger than this stay water (atolls, lagoons)
    fill = (lab != big) & (lab > 0)
    if keep_sea:
        bigs = 1 + np.where(sizes > keep_sea)[0]; fill &= ~np.isin(lab, bigs)
    land = land | fill
    print('land', round(land[IP].mean() * 100, 2), '% of the playable square')
    dIn = ndimage.distance_transform_edt(land) * STEP; dOut = ndimage.distance_transform_edt(~land) * STEP
    save('land0', land); save('dIn', dIn.astype(np.float32)); save('dOut', dOut.astype(np.float32))


# ═════════ 2. relief ═════════
def coast(h, cliffy, land, dIn, dOut, beach=(70.0, 60.0), shelf=430.0, deep=58.0):
    """cliffs where the land says so, beaches elsewhere, and a sea floor that falls away from the shore"""
    n2 = fbm(X / 380, Z / 380, 4, seed=32)
    cl = cliffy * (1 - smooth(0, 90, dIn))
    h = np.where(land, h * (1 - cl) + cl * np.maximum(h, 18 * smooth(0, 25, dIn)), h)
    b = 1 - smooth(0, beach[0] + beach[1] * (fbm(X / 500, Z / 500, 2, seed=42) * 0.5 + 0.5), dIn)
    h = np.where(land, h * (1 - b * (1 - cliffy)) + b * (1 - cliffy) * (0.5 + dIn * 0.035), h)
    sea = -(1.5 + deep * (1 - np.exp(-dOut / shelf))) + 2.5 * n2 - 6 * cliffy * smooth(0, 120, dOut)
    return np.where(land, np.maximum(h, 0.45), np.minimum(sea, -0.45))
def st_relief():
    land = load('land0'); dIn = load('dIn').astype(np.float64); dOut = load('dOut').astype(np.float64)
    R = spec.regions(land, dIn, dOut)
    for k, v in R.items(): save('R_' + k, v.astype(np.float32))
    jdump('regions.json', list(R.keys()))
    h = spec.relief(R, land, dIn, dOut)
    save('h0', h.astype(np.float32))
    print('h range', round(float(h.min()), 1), round(float(h.max()), 1), 'land', round(float((h > 0).mean()), 3))


# ═════════ 3. erosion ═════════
def st_erode():
    h = load('h0').astype(np.float32).copy(); R = regions()
    M = np.clip(spec.erodibility(R, h), 0.05, 1.0).astype(np.float32); M[h < 0] = 0.0
    land0 = h > 0
    drops = int(getattr(spec, 'DROPS', 700000) * AREA_K * max(0.25, float(land0.mean()) / 0.5))
    P = lambda a: a.ctypes.data_as(fp); t0 = time.time()
    lib.thermal(P(h), P(M), N, 6, STEP, 0.9, 0.35)
    lib.erode(P(h), P(M), N, drops, 100, STEP, 0.08, 3.0, 0.01, 0.25, 0.25, 0.012, 4.0, 2, 1234, 0.8)
    lib.thermal(P(h), P(M), N, 4, STEP, 0.85, 0.3)
    print('erosion', drops, 'drops', round(time.time() - t0, 1), 's')
    h0 = load('h0')
    h = np.where(land0, np.maximum(h, 0.45), np.minimum(h0, -0.45)).astype(np.float32)
    save('h1', h)


# ═════════ 4. water ═════════
class Water:
    def __init__(self):
        self.h = load('h1').astype(np.float32).copy()
        self.WL = np.full(self.h.shape, np.nan, np.float32)
        self.FLOW = np.zeros(self.h.shape + (2,), np.float32)
        self.ICE = np.zeros(self.h.shape, np.uint8)
        self.lakes = []; self.rivers = []; self.falls = []
        self.land0 = self.h > 0
    def hat(self, x, z): return float(self.h[toI(z), toI(x)])
    def lake(self, name, cx, cz, rx, rz, rot=0.0, depth=6.0, level=None, pct=35, frozen=False, island=None):
        h = self.h
        c, s = np.cos(rot), np.sin(rot); dx = X - cx; dz = Z - cz
        u = (dx * c + dz * s) / rx; v = (-dx * s + dz * c) / rz
        r = np.sqrt(u * u + v * v) + 0.22 * fbm(X / 260 + cx * 0.001, Z / 260 + cz * 0.001, 3, seed=61)
        inside = r < 1.0
        if level is None: level = float(np.percentile(h[inside], pct))
        if frozen:     # an ice sheet: the ground is the frozen surface itself, flat and walkable
            target = np.where(inside, level, level + 0.15 + (h - level - 0.15) * smooth(1.0, 1.5, r))
            h2 = np.where(r < 1.5, np.where(inside, level, np.minimum(h, np.maximum(target, level))), h)
            self.h = h2.astype(np.float32); self.ICE[(r < 1.04)] = 1
        else:
            bottom = level - depth * (1 - np.clip(r, 0, 1) ** 2) - 0.6
            rim = smooth(1.0, 1.6, r)
            target = np.where(inside, bottom, level + 0.4 + (h - level - 0.4) * rim)
            h2 = np.where(r < 1.6, np.minimum(h, np.maximum(target, np.minimum(h, bottom))), h)
            h2 = np.where(inside, np.minimum(h2, bottom), h2)
            if island is not None:      # a hidden island in the middle of the lake
                ix, iz, ir, ih = island; dd = np.hypot(X - ix, Z - iz) + 18 * fbm(X / 90, Z / 90, 3, seed=63)
                isl = level + ih * smooth(ir, ir * 0.35, dd) + 0.6 * smooth(ir * 1.15, ir, dd) - 0.6
                h2 = np.where(dd < ir * 1.2, np.maximum(h2, isl), h2)
            self.h = h2.astype(np.float32)
            m = (r < 1.15) & (self.h < level)
            self.WL[m] = level
        self.lakes.append({'name': name, 'x': cx, 'z': cz, 'rx': rx, 'rz': rz, 'level': round(level, 2), 'frozen': bool(frozen)})
        print('lake', name, 'level', round(level, 1), 'frozen' if frozen else '')
        return level
    def route(self, pts, meander=0.0):
        h = self.h
        cost = (1.0 + np.clip(h, 0, None) / 25.0).astype(np.float32); cost[h < -6] = -1
        out = []; buf = np.zeros(400000, np.int32); hb = hbil_of(h)
        for (ax, az), (bx, bz) in zip(pts[:-1], pts[1:]):
            n = lib.astar(h.ctypes.data_as(fp), cost.ctypes.data_as(fp), N, STEP, toI(ax), toI(az), toI(bx), toI(bz), 0.0, 10.0, buf.ctypes.data_as(ip), len(buf))
            if n < 0: raise RuntimeError('no path %s' % ((ax, az, bx, bz),))
            cells = buf[:n][::-1]; seg = [(toX(k % N), toX(k // N)) for k in cells]
            out += seg if not out else seg[1:]
        P = np.array(out, np.float64)
        for _ in range(30): P[1:-1] = P[1:-1] * 0.5 + (P[:-2] + P[2:]) * 0.25
        d = np.r_[0, np.cumsum(np.hypot(*np.diff(P, axis=0).T))]; s = np.arange(0, d[-1], 6.0)
        P = np.c_[np.interp(s, d, P[:, 0]), np.interp(s, d, P[:, 1])]
        if meander > 0 and len(P) > 40:
            T = np.gradient(P, axis=0); T /= np.linalg.norm(T, axis=1, keepdims=True) + 1e-9; Nn = np.c_[-T[:, 1], T[:, 0]]
            g = hb(P[:, 0], P[:, 1]); sl = np.abs(np.gradient(ndimage.uniform_filter1d(g, 9, mode='nearest'))) / 6.0
            flat = 1 - smooth(0.02, 0.09, ndimage.uniform_filter1d(sl, 31, mode='nearest'))
            ph = s / 260.0 * 2 * np.pi + 2.2 * np.cumsum(np.random.RandomState(len(P)).randn(len(P))) * 0.02
            off = meander * flat * np.sin(ph) * np.minimum(1, np.minimum(s, s[-1] - s) / 200.0)
            P = P + Nn * off[:, None]
            for _ in range(8): P[1:-1] = P[1:-1] * 0.5 + (P[:-2] + P[2:]) * 0.25
            d = np.r_[0, np.cumsum(np.hypot(*np.diff(P, axis=0).T))]; s = np.arange(0, d[-1], 6.0)
            P = np.c_[np.interp(s, d, P[:, 0]), np.interp(s, d, P[:, 1])]
        return P
    def snap_sea(self, x, z, R=None):
        R = R or max(900.0, STEP * 130)
        h = self.h; i, j = toI(x), toI(z); r = int(R / STEP)
        j0, j1, i0, i1 = max(0, j - r), min(N, j + r), max(0, i - r), min(N, i + r)
        sub = h[j0:j1, i0:i1]; jj, ii = np.mgrid[j0:j1, i0:i1]
        ok = (sub < -0.3) & (sub > -5.5); d = np.hypot(ii - i, jj - j); d[~ok] = 1e9; k = np.argmin(d)
        if d.flat[k] > 1e8: raise RuntimeError('no sea near %s' % ((x, z),))
        return (toX(ii.flat[k]), toX(jj.flat[k]))
    def river(self, name, pts, w0, w1, start_level=None, end_level=0.0, depth0=1.6, depth1=3.2, meander=55.0, falls=()):
        """falls: [(x, z, drop)] — the water level steps down there (a waterfall over a ledge)"""
        if end_level == 0.0: pts = pts[:-1] + [self.snap_sea(*pts[-1])]
        P = self.route(pts, meander=meander); n = len(P); hb = hbil_of(self.h)
        t = np.linspace(0, 1, n); width = w0 + (w1 - w0) * t; depth = depth0 + (depth1 - depth0) * t
        ground = hb(P[:, 0], P[:, 1]).astype(np.float64)
        gs = ndimage.uniform_filter1d(ground, 25, mode='nearest')
        W = np.minimum.accumulate(gs - 0.9)
        if start_level is not None: W = np.minimum(W, start_level)
        W = np.maximum(W, end_level)
        W = np.minimum.accumulate(ndimage.uniform_filter1d(W, 15, mode='nearest'))
        fall_at = []
        for (fx, fz, drop) in falls:      # a ledge: everything downstream of the nearest point sits `drop` lower
            k = int(np.argmin(np.hypot(P[:, 0] - fx, P[:, 1] - fz)))
            W[k:] = np.minimum(W[k:], W[k] - drop); fall_at.append(k)
        W = np.maximum(W, end_level)
        reach = (width.max() / 2 + 40); h = self.h
        for k in range(0, n - 1, 3):
            ax, az = P[k]; kk = min(n - 1, k + 3); bx, bz = P[kk]
            i0 = toI(min(ax, bx) - reach); i1 = toI(max(ax, bx) + reach); j0 = toI(min(az, bz) - reach); j1 = toI(max(az, bz) + reach)
            sub = (slice(j0, j1 + 1), slice(i0, i1 + 1)); xx = X[sub]; zz = Z[sub]
            dx, dz = bx - ax, bz - az; L2 = dx * dx + dz * dz + 1e-9
            tt = np.clip(((xx - ax) * dx + (zz - az) * dz) / L2, 0, 1); dd = np.hypot(xx - ax - dx * tt, zz - az - dz * tt)
            wl = W[k] + (W[kk] - W[k]) * tt; hw = (width[k] + (width[kk] - width[k]) * tt) / 2; dp = depth[k]
            bed = wl - dp * (1 - np.clip(dd / np.maximum(hw, 1), 0, 1) ** 2) - 0.25
            bank = wl + 0.35 + np.maximum(0, dd - hw) * 0.22
            hh = h[sub]
            newh = np.where(dd < hw, np.minimum(hh, bed), np.minimum(hh, np.maximum(bank, np.minimum(hh, bed + (dd - hw) * 0.6))))
            h[sub] = np.where(dd < hw + 40, newh, hh).astype(np.float32)
            wm = dd < hw + 1.5
            cur = self.WL[sub]; self.WL[sub] = np.where(wm & (np.isnan(cur) | (cur > wl)), wl, cur)
            f = self.FLOW[sub]; f[wm] = (dx / np.sqrt(L2), dz / np.sqrt(L2)); self.FLOW[sub] = f
        for k in fall_at:
            k0, k1 = max(0, k - 2), min(n - 1, k + 2); dx, dz = P[k1] - P[k0]; l = np.hypot(dx, dz) or 1
            self.falls.append({'x': round(float(P[k, 0]), 1), 'z': round(float(P[k, 1]), 1), 'top': round(float(W[max(0, k - 1)]), 2), 'bot': round(float(W[min(n - 1, k + 1)]), 2), 'w': round(float(width[k]), 1), 'dx': round(float(dx / l), 3), 'dz': round(float(dz / l), 3)})
        self.rivers.append({'name': name, 'pts': [[round(float(a), 1), round(float(b), 1)] for a, b in P[::3]], 'w': [round(float(x), 1) for x in width[::3]], 'wl': [round(float(x), 2) for x in W[::3]]})
        print('river', name, 'len', int(n * 6), 'm', 'level', round(W[0], 1), '->', round(W[-1], 1), 'falls', len(fall_at))
    def lagoons(self, mask, level=1.05, seed=62):
        """shallow wetland pools inside a soft region mask"""
        h = self.h; n = fbm(X / 180, Z / 180, 4, seed=seed)
        holes = (n > 0.18) & (mask > 0.55) & (h > 0)
        self.h = np.where(holes, np.minimum(h, 0.4 + (h - 0.4) * 0.3 - 0.9 * smooth(0.18, 0.4, n)), h).astype(np.float32)
        sw = (mask > 0.45) & (self.h < level) & (self.h > -0.5) & self.land0
        self.WL[sw & np.isnan(self.WL)] = level
    def finish(self):
        h = self.h
        lab, nn = ndimage.label(h < 0); border = set(np.unique(np.r_[lab[0], lab[-1], lab[:, 0], lab[:, -1]])) - {0}
        ocean = np.isin(lab, list(border))
        self.WL[ocean & np.isnan(self.WL)] = 0.0
        pits = (h < 0) & ~ocean
        self.WL[pits & np.isnan(self.WL)] = 0.2
        water = ~np.isnan(self.WL) & (h < self.WL)
        print('water cells', round(water[inplay()].mean() * 100, 2), '%')
        save('h2', h); save('WL', self.WL); save('FLOW', self.FLOW); save('ICE', self.ICE)
        jdump('water.json', {'lakes': self.lakes, 'rivers': self.rivers, 'falls': self.falls})
def st_water():
    W = Water(); spec.water(W); W.finish()


# ═════════ 5. places ═════════
DOORS = {'n': (0, -1), 's': (0, 1), 'e': (1, 0), 'w': (-1, 0)}
WALLS_MED = [0xf1ece2, 0xe9dfca, 0xe2d4b8, 0xeedfc8, 0xdbe2df, 0xe9d2bb, 0xe4ddd0, 0xd8c3a5, 0xf4efe6]
TRIMS = [0x2f6a9a, 0x2b8c86, 0x3f7a4a, 0x6b4a2f, 0x2d5f86, 0x8b4b3a, 0x7a3a2e]
class Places:
    def __init__(self):
        self.h = load('h2').astype(np.float64); self.WL = load('WL'); self.ICE = load('ICE')
        self.FLAT = np.zeros(self.h.shape, np.float32)
        self.settlements = []; self.POI = []; self.extras = {}
        self.rng = random.Random(getattr(spec, 'SEED', 20261022))
    def wet(self): return (~np.isnan(self.WL)) & (self.WL > self.h - 0.05)
    def hb(self, x, z):
        h = self.h; fx = (x + HALF) / STEP; fz = (z + HALF) / STEP; i = int(np.clip(np.floor(fx), 0, N - 2)); j = int(np.clip(np.floor(fz), 0, N - 2)); u = fx - i; v = fz - j
        return float(h[j, i] * (1 - u) * (1 - v) + h[j, i + 1] * u * (1 - v) + h[j + 1, i] * (1 - u) * v + h[j + 1, i + 1] * u * v)
    def water_at(self, x, z):
        i, j = toI(x), toI(z); w = self.WL[j, i]; return (not np.isnan(w)) and w > self.h[j, i] - 0.05
    def flatten(self, cx, cz, rx, rz, blend=50.0, max_grade=0.03, rot=0.0, minh=1.6, fixed=None):
        h = self.h
        c, s = np.cos(rot), np.sin(rot); dx = X - cx; dz = Z - cz
        u = (dx * c + dz * s) / rx; v = (-dx * s + dz * c) / rz; r = np.sqrt(u * u + v * v)
        wet = self.wet(); inside = (r < 1) & ~wet
        if fixed is None and inside.sum() >= 3:
            A = np.c_[dx[inside], dz[inside], np.ones(inside.sum())]; coef, *_ = np.linalg.lstsq(A, h[inside], rcond=None)
            gx, gz, h0 = coef; g = np.hypot(gx, gz)
            if g > max_grade: gx, gz = gx / g * max_grade, gz / g * max_grade
            h0 = max(h0, minh)
        else: gx, gz, h0 = 0.0, 0.0, (fixed if fixed is not None else max(minh, self.hb(cx, cz)))
        plane = h0 + gx * dx + gz * dz
        rb = 1 + blend / min(rx, rz)
        w = 1 - smooth(1.0, rb, r)
        keep = wet & (r < rb)
        self.h = np.where(keep, h, h * (1 - w) + plane * w)
        self.FLAT[:] = np.maximum(self.FLAT, (1 - smooth(0.9, rb, r)).astype(np.float32))
        return (gx, gz, h0)
    def poi(self, kind, name, x, z, **kw):
        d = {'kind': kind, 'name': name, 'x': round(x, 1), 'z': round(z, 1)}; d.update(kw); self.POI.append(d); return d
    def spot(self, cx, cz, R, hmin=2.5, hmax=40.0, flat_r=6, tries=3000, avoid=(), grow=3):
        """the flattest dry spot within R of (cx, cz); the search widens when nothing fits"""
        for g in range(grow + 1):
            try: return self._spot(cx, cz, R * (1.8 ** g), hmin, hmax * (1.5 ** g), flat_r, tries, avoid)
            except RuntimeError:
                if g == grow: raise
    def _spot(self, cx, cz, R, hmin, hmax, flat_r, tries, avoid):
        best = None; rng = self.rng
        for t in range(tries):
            a = rng.uniform(0, 2 * np.pi); d = R * np.sqrt(rng.random()); x = cx + np.cos(a) * d; z = cz + np.sin(a) * d
            if abs(x) > PLAY - 60 or abs(z) > PLAY - 60: continue
            hh = self.hb(x, z)
            if hh < hmin or hh > hmax or self.water_at(x, z): continue
            if any(np.hypot(x - ax, z - az) < ar for (ax, az, ar) in avoid): continue
            i, j = toI(x), toI(z); sub = self.h[max(0, j - flat_r):j + flat_r + 1, max(0, i - flat_r):i + flat_r + 1]
            sc = float(sub.max() - sub.min()) + d * 0.002
            if best is None or sc < best[0]: best = (sc, x, z)
        if best is None: raise RuntimeError('no spot near %s' % ((cx, cz),))
        return best[1], best[2]
    def coast_point(self, x, z, R=1200):
        """the nearest shore cell (land side) to (x, z)"""
        h = self.h; i, j = toI(x), toI(z); r = int(R / STEP)
        j0, j1, i0, i1 = max(1, j - r), min(N - 1, j + r), max(1, i - r), min(N - 1, i + r)
        sub = h[j0:j1, i0:i1]; jj, ii = np.mgrid[j0:j1, i0:i1]
        shore = (sub > 0.5) & (sub < 4) & ndimage.binary_dilation(sub < 0, iterations=2)
        d = np.hypot(ii - i, jj - j); d[~shore] = 1e9; k = np.argmin(d)
        return toX(ii.flat[k]), toX(jj.flat[k])
    def save(self):
        for s in self.settlements: print(s['id'], s['name'], 'buildings', len(s['buildings']), 'streets', len(s['streets']))
        save('h3', self.h.astype(np.float32)); save('FLAT', self.FLAT)
        jdump('places.json', {'settlements': self.settlements, 'poi': self.POI, 'extras': self.extras})

class Layout:
    def __init__(self, A, sid, name, kind, cx, cz, r):
        self.A = A
        self.d = {'id': sid, 'name': name, 'kind': kind, 'x': round(cx, 1), 'z': round(cz, 1), 'r': r, 'buildings': [], 'streets': [], 'props': [], 'parking': [], 'squares': []}
        self.occ = []; self.segs = []; A.settlements.append(self.d)
    def free(self, x, z, hx, hz, m=1.0):
        for (ox, oz, ohx, ohz) in self.occ:
            if abs(x - ox) < hx + ohx + m and abs(z - oz) < hz + ohz + m: return False
        for (px, pz, r) in self.segs:
            if abs(x - px) < hx + r and abs(z - pz) < hz + r: return False
        return True
    def ground_ok(self, x, z, hx, hz, maxd=2.4, wet_ok=False):
        pts = [(x - hx, z - hz), (x + hx, z - hz), (x - hx, z + hz), (x + hx, z + hz), (x, z)]
        if wet_ok: return all(abs(a) < PLAY - 20 and abs(b) < PLAY - 20 for a, b in pts)
        hs = [self.A.hb(a, b) for a, b in pts]
        if min(hs) < 1.3 or max(hs) - min(hs) > maxd: return False
        return not any(self.A.water_at(a, b) for a, b in pts)
    def add(self, kind, x, z, hx, hz, door, **kw):
        gap = kw.pop('gap', 1.0); maxd = kw.pop('maxd', 2.4); wet_ok = kw.pop('wet_ok', False)
        if not self.free(x, z, hx, hz, gap) or not self.ground_ok(x, z, hx, hz, maxd, wet_ok): return None
        b = {'kind': kind, 'x': round(x, 2), 'z': round(z, 2), 'hx': round(hx, 2), 'hz': round(hz, 2), 'door': door}; b.update(kw)
        if 'enter' not in b: b['enter'] = kind not in ('house', 'apartment', 'shopfront', 'warehouse') or self.A.rng.random() < 0.45
        self.d['buildings'].append(b); self.occ.append((x, z, hx, hz)); return b
    def block(self, x, z, hx, hz): self.occ.append((x, z, hx, hz))
    def street(self, pts, w, kind='street'):
        self.d['streets'].append({'pts': [[round(a, 1), round(b, 1)] for a, b in pts], 'w': w, 'kind': kind})
        for (ax, az), (bx, bz) in zip(pts[:-1], pts[1:]):
            n = max(1, int(np.hypot(bx - ax, bz - az) / 2.5))
            for k in range(n + 1):
                t = k / n; self.segs.append((ax + (bx - ax) * t, az + (bz - az) * t, w / 2 + 1.4))
    def prop(self, kind, x, z, ry=0.0, **kw):
        p = {'kind': kind, 'x': round(x, 2), 'z': round(z, 2), 'ry': round(ry, 3)}; p.update(kw); self.d['props'].append(p); return p

def frontage(A, L, x0, x1, zline, side, dmin, dmax, wmin, wmax, kinds, style, gapr=(0.5, 3.0)):
    rng = A.rng; x = x0 + rng.uniform(0, 4)
    while x < x1 - wmin:
        w = rng.uniform(wmin, wmax); d = rng.uniform(dmin, dmax)
        if x + w > x1: break
        cx = x + w / 2; cz = zline + side * (d / 2 + 0.2)
        L.add(rng.choice(kinds), cx, cz, w / 2, d / 2, 'n' if side > 0 else 's', style=style, floors=rng.choice([1, 1, 2, 2, 3]) if style == 'city' else rng.choice([1, 1, 2]), wall=rng.choice(WALLS_MED), trim=rng.choice(TRIMS), seed=rng.randrange(1 << 30))
        x += w + rng.uniform(*gapr)

def town(A, sid, name, cx, z_top, NX=6, NZ=4, BW=46.0, BD=42.0, specials=(), style='city', harbour=True, kinds=('house', 'house', 'apartment', 'apartment', 'shopfront'), floors=(1, 2, 2, 2, 3, 3), r=None, piers=3, kind='city', sea='n', post=None):
    """a grid town; with a harbour, the quay runs along z_top and the sea lies beyond it (north by default, or south with sea='s')"""
    rng = A.rng; sg = 1 if sea == 'n' else -1
    zw = z_top; x0 = cx - BW * NX / 2; z0 = zw + 14 * sg
    cz = z0 + sg * BD * NZ / 2
    L = Layout(A, sid, name, kind, cx, cz, r or int(max(BW * NX, BD * NZ) / 2 + 30))
    xs = [x0 + k * BW for k in range(NX + 1)]; zs = sorted([z0 + sg * k * BD for k in range(NZ + 1)])
    for x in xs: L.street([(x, zw if harbour else (zs[0] if sg > 0 else zs[-1])), (x, zs[-1] if sg > 0 else zs[0])], 8.0 if abs(x - cx) < 1 else 7.0)
    zfar = zs[-1] if sg > 0 else zs[0]
    A.flatten(cx, (zw + zfar) / 2, BW * NX / 2 + 30, abs(zfar - zw) / 2 + 40, blend=60, max_grade=0.015)
    mid = zs[NZ // 2]
    for z in zs: L.street([(xs[0], z), (xs[-1], z)], 8.0 if abs(z - mid) < 1 else 7.0)
    if harbour: L.street([(xs[0] - 90, zw), (xs[-1] + 90, zw)], 10.0, 'boulevard')
    else: L.street([(xs[0] - 60, mid), (xs[-1] + 60, mid)], 9.0, 'boulevard')
    sqx, sqz = xs[NX // 2 - 1] + BW / 2, zs[max(0, NZ // 2 - 1)] + BD / 2
    L.d['squares'].append({'x': sqx, 'z': sqz, 'r': 18}); L.block(sqx, sqz, BW / 2 - 4, BD / 2 - 4)
    L.prop('fountain', sqx, sqz)
    for k in range(4):
        a = np.pi / 4 + k * np.pi / 2; L.prop('stall', sqx + np.cos(a) * 12, sqz + np.sin(a) * 11, ry=float(np.arctan2(-np.cos(a), -np.sin(a))))
    pkx, pkz = xs[min(NX - 1, NX // 2)] + BW / 2, zs[min(NZ - 1, NZ // 2)] + BD / 2
    L.d['squares'].append({'x': pkx, 'z': pkz, 'r': 17, 'park': True}); L.block(pkx, pkz, BW / 2 - 4, BD / 2 - 4)
    lots = []
    for i in range(NX):
        for j in range(NZ):
            sw = lambda v, ref: (8.0 if abs(v - ref) < 1 else 7.0) / 2 + 1.7
            bx0, bx1, bz0, bz1 = xs[i] + sw(xs[i], cx), xs[i + 1] - sw(xs[i + 1], cx), zs[j] + sw(zs[j], mid), zs[j + 1] - sw(zs[j + 1], mid)
            if abs((xs[i] + BW / 2) - sqx) < 1 and abs((zs[j] + BD / 2) - sqz) < 1: continue
            if abs((xs[i] + BW / 2) - pkx) < 1 and abs((zs[j] + BD / 2) - pkz) < 1: continue
            lots.append((bx0, bx1, bz0, bz1))
    lots.sort(key=lambda q: np.hypot((q[0] + q[1]) / 2 - sqx, (q[2] + q[3]) / 2 - sqz))
    placed = 0
    for kind_, bname, hx, hz, extra in specials:
        done = False
        for (bx0, bx1, bz0, bz1) in lots:
            for (x, z, door) in [((bx0 + bx1) / 2, bz0 + hz, 'n'), ((bx0 + bx1) / 2, bz1 - hz, 's'), (bx0 + hx, (bz0 + bz1) / 2, 'w'), (bx1 - hx, (bz0 + bz1) / 2, 'e')]:
                b = L.add(kind_, x, z, hx, hz, door, name=bname, style=style, floors=extra.get('floors', 2 if kind_ != 'clocktower' else 1), wall=rng.choice(WALLS_MED), trim=rng.choice(TRIMS), seed=rng.randrange(1 << 30), gap=0.3, **{k: v for k, v in extra.items() if k != 'floors'})
                if b: placed += 1; done = True; break
            if done: break
    print(name, 'specials placed', placed, '/', len(specials))
    for (bx0, bx1, bz0, bz1) in lots:
        for side in ('n', 's', 'w', 'e'):
            t = (bx0 if side in 'ns' else bz0) + rng.uniform(0, 2); end = bx1 if side in 'ns' else bz1
            while t < end - 6:
                w = rng.uniform(8, 12.5); d = rng.uniform(8, 11)
                if t + w > end: w = end - t
                if w < 6.5: break
                if side == 'n': x, z, hx, hz = t + w / 2, bz0 + d / 2, w / 2, d / 2
                elif side == 's': x, z, hx, hz = t + w / 2, bz1 - d / 2, w / 2, d / 2
                elif side == 'w': x, z, hx, hz = bx0 + d / 2, t + w / 2, d / 2, w / 2
                else: x, z, hx, hz = bx1 - d / 2, t + w / 2, d / 2, w / 2
                L.add(rng.choice(kinds), x, z, hx - 0.15, hz - 0.15, side, style=style, floors=rng.choice(floors), wall=rng.choice(WALLS_MED), trim=rng.choice(TRIMS), seed=rng.randrange(1 << 30), gap=0.05)
                t += w + rng.uniform(0.0, 1.8)
    if harbour:
        frontage(A, L, xs[0] - 85, xs[-1] + 85, zw - 6.6 * sg, -sg, 10, 13, 14, 22, ['warehouse', 'warehouse', 'fishmarket'], 'port', gapr=(6, 16))
        for k in range(piers):
            px = cx + (k - (piers - 1) / 2) * 130
            pz = zw - 6 * sg
            for t in range(80):
                if A.hb(px, pz) < 0: break
                pz -= 4 * sg
            L.prop('pier', px, pz - 30 * sg, len=80, w=5.0)
            for q in range(3): L.prop('boat', px + rng.choice([-6.5, 6.5]), pz - (18 + q * 20) * sg, ry=rng.uniform(-0.1, 0.1), moored=True)
    for st in L.d['streets']:
        (ax, az), (bx, bz) = st['pts'][0], st['pts'][-1]
        n = int(np.hypot(bx - ax, bz - az) / 24)
        for k in range(n):
            t = (k + 0.5) / n; x = ax + (bx - ax) * t; z = az + (bz - az) * t; horiz = abs(bx - ax) > abs(bz - az)
            sgn = 1 if k % 2 else -1
            if horiz: L.prop('lamp', x, z + (st['w'] / 2 + 0.9) * sgn, side=-sgn, axis='z')
            else: L.prop('lamp', x + (st['w'] / 2 + 0.9) * sgn, z, side=-sgn, axis='x')
            if rng.random() < 0.3: L.d['parking'].append({'x': round(x + (0 if horiz else 2.2 * -sgn), 1), 'z': round(z + (2.2 * -sgn if horiz else 0), 1), 'ry': float(np.pi / 2 if horiz else 0.0)})
    if post: post(L, xs, zs)
    A.poi(kind, name, cx, cz, r=L.d['r'])
    return L

def village(A, sid, name, cx, cz, style, n_house=22, extra=(), r=180, road_axis='x', lamps=8, kind='village', flat=True):
    rng = A.rng
    if flat: A.flatten(cx, cz, r, r * 0.8, blend=60, max_grade=0.04)
    L = Layout(A, sid, name, kind, cx, cz, r)
    if road_axis == 'x':
        L.street([(cx - r, cz), (cx + r, cz)], 7.0, 'village'); L.street([(cx, cz - r * 0.6), (cx, cz + r * 0.6)], 6.0, 'village')
    else:
        L.street([(cx, cz - r), (cx, cz + r)], 7.0, 'village'); L.street([(cx - r * 0.6, cz), (cx + r * 0.6, cz)], 6.0, 'village')
    L.d['squares'].append({'x': cx, 'z': cz, 'r': 10})
    for kind_, name2, hx, hz, kw in extra:
        for t in range(80):
            a = rng.uniform(0, 2 * np.pi); d = rng.uniform(16, r * 0.75); x = cx + np.cos(a) * d; z = cz + np.sin(a) * d
            door = 'n' if z > cz else 's'
            if L.add(kind_, x, z, hx, hz, door, name=name2, style=style, seed=rng.randrange(1 << 30), **kw): break
    k = 0
    for t in range(n_house * 30):
        if k >= n_house: break
        along = rng.uniform(-r * 0.92, r * 0.92); side = rng.choice([-1, 1]); off = rng.uniform(9, 22) * side
        if road_axis == 'x': x, z = cx + along, cz + off
        else: x, z = cx + off, cz + along
        if rng.random() < 0.35:
            if road_axis == 'x': x, z = cx + off * 0.9, cz + rng.uniform(-r * 0.55, r * 0.55)
            else: x, z = cx + rng.uniform(-r * 0.55, r * 0.55), cz + off * 0.9
        hx, hz = rng.uniform(4, 6.5), rng.uniform(3.8, 6)
        door = ('n' if z > cz else 's') if road_axis == 'x' else ('w' if x > cx else 'e')
        if abs(x - cx) < 10 and road_axis == 'x': door = 'w' if x > cx else 'e'
        if L.add('house', x, z, hx, hz, door, style=style, floors=rng.choice([1, 1, 2]), seed=rng.randrange(1 << 30), wall=rng.choice(WALLS_MED), trim=rng.choice(TRIMS)):
            k += 1
    for t in range(lamps):
        a = rng.uniform(0, 2 * np.pi); d = rng.uniform(8, r * 0.8); L.prop('lamp', cx + np.cos(a) * d, cz + np.sin(a) * d)
    A.poi(kind, name, cx, cz, r=r)
    return L

def military(A, sid, name, cx, cz, hx=130, hz=100, poi_kind='military'):
    rng = A.rng
    A.flatten(cx, cz, hx + 10, hz + 10, blend=50, max_grade=0.01)
    L = Layout(A, sid, name, 'military', cx, cz, max(hx, hz) + 20)
    L.d['fence'] = {'x': cx, 'z': cz, 'hx': hx, 'hz': hz, 'gate': 's'}
    L.street([(cx, cz + hz), (cx, cz - hz * 0.6)], 8.0, 'base'); L.street([(cx - hx * 0.85, cz - 10), (cx + hx * 0.85, cz - 10)], 7.0, 'base')
    for (x, z) in [(cx - hx * 0.54, cz - hz * 0.5), (cx - hx * 0.54, cz + hz * 0.25), (cx + hx * 0.54, cz - hz * 0.5)]:
        L.add('barracks', x, z, 18, 7, 's', style='military', name='ثكنة', seed=rng.randrange(1 << 30))
    L.add('hangar', cx + hx * 0.54, cz + hz * 0.45, 22, 16, 'w', style='military', name='حظيرة الآليات', seed=rng.randrange(1 << 30))
    L.add('hq', cx - 20, cz - hz * 0.62, 13, 9, 's', style='military', name='مقر القيادة', floors=2, seed=rng.randrange(1 << 30), armory=True)
    for sx, sz in [(-1, -1), (1, -1), (-1, 1), (1, 1)]: L.prop('watchtower', cx + sx * (hx - 6), cz + sz * (hz - 6))
    L.prop('helipad', cx - hx * 0.46, cz + hz * 0.7)
    for k in range(6): L.prop('tent', cx + 20 + (k % 3) * 14, cz + 20 + (k // 3) * 14)
    for k in range(10): L.prop('crates', cx + rng.uniform(-hx * 0.77, hx * 0.77), cz + rng.uniform(-hz * 0.8, hz * 0.8))
    L.d['parking'] += [{'x': cx + 35 + k * 6, 'z': cz - 30, 'ry': 0.0, 'kind': 'military'} for k in range(4)]
    A.poi(poi_kind, name, cx, cz, r=max(hx, hz) + 20)
    return L

def lighthouse(A, x, z, name='المنارة'):
    A.flatten(x, z, 24, 24, blend=20, max_grade=0.0)
    L = Layout(A, 'light', name, 'lighthouse', x, z, 40)
    L.d['buildings'].append({'kind': 'lighthouse', 'x': round(x, 2), 'z': round(z, 2), 'hx': 3, 'hz': 3, 'door': 's', 'name': name})
    L.add('house', x - 12, z + 10, 4, 3.4, 's', style='city', name='بيت الحارس', seed=1, wall=0xece2cf, trim=0x8f3326)
    A.poi('lighthouse', name, x, z)
    return L

def lonely(A, kind, name, x, z):
    if kind == 'castle': A.flatten(x, z, 45, 45, blend=40, max_grade=0.0)
    elif kind == 'radio': A.flatten(x, z, 10, 10, blend=14, max_grade=0.0)
    elif kind != 'windfarm': A.flatten(x, z, 30, 30, blend=30, max_grade=0.02)
    return A.poi(kind, name, x, z)

def st_places():
    A = Places(); spec.places(A); A.save()


# ═════════ 6. roads ═════════
class Roads:
    def __init__(self):
        self.h = load('h3').astype(np.float64); self.WL = load('WL'); self.FLOW = load('FLOW'); self.FLAT = load('FLAT')
        self.P = jload('places.json'); self.ROADS = []; self.ROADCELL = np.zeros(self.h.shape, bool)
        h = self.h; WL = self.WL
        self.wetm = (~np.isnan(WL)) & (WL > h - 0.05)
        river = self.wetm & (np.hypot(self.FLOW[..., 0], self.FLOW[..., 1]) > 0.5)
        lakeocean = self.wetm & ~river
        cost = np.ones(h.shape, np.float32); cost[river] = 14.0
        cost[ndimage.binary_dilation(lakeocean, iterations=2)] = -1
        for k, w in getattr(spec, 'ROAD_COST', {}).items(): cost += (load('R_' + k) * w).astype(np.float32)
        for s in self.P['settlements']:
            for b in s['buildings']:
                i0, i1 = toI(b['x'] - b['hx'] - 3), toI(b['x'] + b['hx'] + 3); j0, j1 = toI(b['z'] - b['hz'] - 3), toI(b['z'] + b['hz'] + 3)
                cost[j0:j1 + 1, i0:i1 + 1] = -1
        for s in self.P['settlements']:
            for st in s['streets']:
                pts = st['pts']
                for (ax, az), (bx, bz) in zip(pts[:-1], pts[1:]):
                    n = max(1, int(np.hypot(bx - ax, bz - az) / 4))
                    for k in range(n + 1): cost[toI(az + (bz - az) * k / n), toI(ax + (bx - ax) * k / n)] = 0.3
        self.cost = cost
        self.S = {s['id']: s for s in self.P['settlements']}
    def hb(self, x, z): return float(hbil_of(self.h)(x, z))
    def wlbil(self, x, z):
        i = np.clip(np.round((x + HALF) / STEP).astype(int), 0, N - 1); j = np.clip(np.round((z + HALF) / STEP).astype(int), 0, N - 1)
        w = self.WL[j, i]; return np.where(np.isnan(w) | (w < self.h[j, i] - 0.05), -1e9, w)
    def road(self, name, kind, pts, w, grade, maxSlope):
        buf = np.zeros(800000, np.int32); out = []
        c = self.cost.copy(); c[self.ROADCELL] = np.minimum(c[self.ROADCELL], 0.35)
        for (ax, az), (bx, bz) in zip(pts[:-1], pts[1:]):
            for (px, pz) in [(ax, az), (bx, bz)]:
                c[toI(pz) - 2:toI(pz) + 3, toI(px) - 2:toI(px) + 3] = np.maximum(c[toI(pz) - 2:toI(pz) + 3, toI(px) - 2:toI(px) + 3], 0.5)
            n = lib.astar(self.h.astype(np.float32).ctypes.data_as(fp), c.ctypes.data_as(fp), N, STEP, toI(ax), toI(az), toI(bx), toI(bz), 3.0, maxSlope, buf.ctypes.data_as(ip), len(buf))
            if n < 0: print('  !! no route', name, (ax, az), (bx, bz)); return None
            cells = buf[:n][::-1]; seg = [(toX(k % N), toX(k // N)) for k in cells]
            seg[0] = (ax, az); seg[-1] = (bx, bz)
            out += seg if not out else seg[1:]
        Q = np.array(out, np.float64)
        for _ in range(14): Q[1:-1] = Q[1:-1] * 0.5 + (Q[:-2] + Q[2:]) * 0.25
        d = np.r_[0, np.cumsum(np.hypot(*np.diff(Q, axis=0).T))]; s = np.arange(0, d[-1] + 0.01, 4.0)
        Q = np.c_[np.interp(s, d, Q[:, 0]), np.interp(s, d, Q[:, 1])]
        for _ in range(6): Q[1:-1] = Q[1:-1] * 0.5 + (Q[:-2] + Q[2:]) * 0.25
        hb = hbil_of(self.h); g = hb(Q[:, 0], Q[:, 1]); wl = self.wlbil(Q[:, 0], Q[:, 1])
        over = wl > -1e8
        ov = ndimage.binary_dilation(over, iterations=4)
        y = ndimage.uniform_filter1d(g, 9, mode='nearest')
        y = np.where(ov, np.maximum(y, ndimage.maximum_filter1d(np.where(over, wl + 3.2, -1e9), 31, mode='nearest')), y)
        y = ndimage.uniform_filter1d(y, 5, mode='nearest')
        y[0], y[-1] = g[0], g[-1]
        gstep = grade * 4.0
        for i in range(1, len(y)): y[i] = np.clip(y[i], y[i - 1] - gstep, y[i - 1] + gstep)
        for i in range(len(y) - 2, -1, -1): y[i] = np.clip(y[i], y[i + 1] - gstep, y[i + 1] + gstep)
        reach = w / 2 + 16
        best_d = np.full(self.h.shape, 1e9); best_y = np.zeros(self.h.shape)
        for k in range(len(Q) - 1):
            if ov[k] and ov[k + 1]: continue
            ax, az = Q[k]; bx, bz = Q[k + 1]
            i0, i1 = toI(min(ax, bx) - reach), toI(max(ax, bx) + reach); j0, j1 = toI(min(az, bz) - reach), toI(max(az, bz) + reach)
            sub = (slice(j0, j1 + 1), slice(i0, i1 + 1)); xx = X[sub]; zz = Z[sub]
            dx, dz = bx - ax, bz - az; L2 = dx * dx + dz * dz + 1e-9
            t = np.clip(((xx - ax) * dx + (zz - az) * dz) / L2, 0, 1); dd = np.hypot(xx - ax - dx * t, zz - az - dz * t)
            yy = y[k] + (y[k + 1] - y[k]) * t
            m = dd < best_d[sub]; bd = best_d[sub]; by = best_y[sub]; bd[m] = dd[m]; by[m] = yy[m]; best_d[sub] = bd; best_y[sub] = by
        sel = best_d < reach
        wgt = 1 - smooth(w / 2 + 2.0, reach, best_d)
        keep = self.wetm & sel
        self.h = np.where(sel & ~keep, self.h * (1 - wgt) + (best_y - 0.12) * wgt, self.h)
        self.ROADCELL[best_d < w / 2 + 1] = True
        self.FLAT[sel] = np.maximum(self.FLAT[sel], wgt[sel].astype(np.float32))
        bridges = []; i = 0
        while i < len(over):
            if over[i]:
                j = i
                while j < len(over) and over[j]: j += 1
                bridges.append([max(0, i - 3), min(len(over) - 1, j + 2)]); i = j
            else: i += 1
        # where the line cuts deep into a ridge it runs through a tunnel (walls and a roof over the cut)
        dig = g - y; tunnels = []; i = 0
        while i < len(dig):
            if dig[i] > 9.0 and not over[i] and kind != 'track':
                j = i
                while j < len(dig) and dig[j] > 7.0 and not over[j]: j += 1
                if j - i >= 4: tunnels.append([max(0, i - 1), min(len(dig) - 1, j)])
                i = j
            else: i += 1
        r = {'name': name, 'kind': kind, 'w': w, 'pts': [[round(float(a), 1), round(float(b), 1), round(float(c), 2)] for (a, b), c in zip(Q, y)], 'bridges': bridges}
        if tunnels: r['tunnels'] = tunnels
        self.ROADS.append(r)
        print('road', name, kind, 'len', int(s[-1]), 'm', 'bridges', len(bridges), 'tunnels', len(tunnels))
        return r
    def span(self, name, a, b, w=7.0):
        """a suspension bridge: a straight deck from rim to rim over a gorge"""
        hb = hbil_of(self.h); (ax, az), (bx, bz) = a, b; L = float(np.hypot(bx - ax, bz - az)); n = max(3, int(L / 4.0) + 1)
        t = np.linspace(0, 1, n); xs = ax + (bx - ax) * t; zs = az + (bz - az) * t
        ya, yb = float(hb(ax, az)), float(hb(bx, bz)); y = ya + (yb - ya) * t
        for (x, z) in (a, b): self.ROADCELL[toI(z) - 1:toI(z) + 2, toI(x) - 1:toI(x) + 2] = True
        r = {'name': name, 'kind': 'road', 'w': w, 'pts': [[round(float(x), 1), round(float(z), 1), round(float(v), 2)] for x, z, v in zip(xs, zs, y)], 'bridges': [[0, n - 1]], 'sus': [[0, n - 1]]}
        self.ROADS.append(r); print('span', name, 'len', int(L), 'm'); return r
    def gate(self, sid, which):
        s = self.S[sid]
        bl = [q for q in s['streets'] if q['kind'] == 'boulevard']
        if bl and which in ('w', 'e', 's', 'sw', 'se', 'n'):
            b = bl[0]['pts']; xs = sorted(p[0] for q in s['streets'] for p in q['pts']); zs = sorted(p[1] for q in s['streets'] for p in q['pts'])
            return {'w': (b[0][0], b[0][1]), 'e': (b[-1][0], b[-1][1]), 's': (s['x'], zs[-1]), 'n': (s['x'], zs[0]), 'sw': (xs[0], zs[-1]), 'se': (xs[-1], zs[-1])}[which]
        horiz = [q for q in s['streets'][:2] if abs(q['pts'][-1][0] - q['pts'][0][0]) > abs(q['pts'][-1][1] - q['pts'][0][1])]
        vert = [q for q in s['streets'][:2] if q not in horiz]
        st = (horiz or vert)[0] if which in ('w', 'e') else (vert or horiz)[0]
        pts = st['pts']; a, b = pts[0], pts[-1]
        if which in ('w', 'n'): return tuple(a) if (a[0] < b[0] if which == 'w' else a[1] < b[1]) else tuple(b)
        return tuple(b) if (a[0] < b[0] if which == 'e' else a[1] < b[1]) else tuple(a)
    def poi(self, name, k=0):
        hits = [p for p in self.P['poi'] if p['name'] == name]
        return (hits[k]['x'], hits[k]['z'])
    def R(self, name, spec_, pts): return self.road(name, spec_[0], pts, spec_[1], spec_[2], spec_[3])
    def save(self):
        save('h4', self.h.astype(np.float32)); save('FLAT', self.FLAT); save('ROADCELL', self.ROADCELL)
        jdump('roads.json', self.ROADS)
        print('total road km', round(sum(len(r['pts']) * 4 for r in self.ROADS) / 1000, 1))
HW, RD, TR = ('highway', 8.0, 0.075, 0.22), ('road', 6.5, 0.09, 0.26), ('track', 4.2, 0.13, 0.34)
HWM = ('highway', 8.0, 0.1, 0.36)
def st_roads():
    A = Roads(); spec.roads(A); A.save()


# ═════════ 7. biomes ═════════
BIOMES = ['sea', 'beach', 'coast', 'forest', 'taiga', 'alpine', 'farm', 'desert', 'swamp', 'tropic', 'isles', 'meadow', 'lake', 'river']
CROPS = ['wheat', 'corn', 'sunflower', 'cotton', 'potato', 'tomato', 'fallow', 'wheat', 'corn', 'pumpkin', 'carrot', 'barley']
class Bio:
    def __init__(self):
        self.h = load('h4').astype(np.float64); self.WL = load('WL'); self.FLOW = load('FLOW'); self.FLAT = load('FLAT'); self.ROADCELL = load('ROADCELL'); self.ICE = load('ICE')
        self.P = jload('places.json'); self.ROADS = jload('roads.json'); self.R = regions()
        h = self.h; WL = self.WL
        self.wet = (~np.isnan(WL)) & (WL > h - 0.02)
        self.ocean = self.wet & (np.nan_to_num(WL) == 0) & (h < 0)
        self.land = ~self.wet
        gx = np.gradient(h, axis=1) / STEP; gz = np.gradient(h, axis=0) / STEP; self.slope = np.hypot(gx, gz)
        self.dWater = ndimage.distance_transform_edt(~self.wet) * STEP
        self.dSea = ndimage.distance_transform_edt(~self.ocean) * STEP
        self.n1 = fbm(X / 700 + 4.4, Z / 700 - 1.1, 4, seed=71); self.n2 = fbm(X / 180, Z / 180, 3, seed=72); self.n3 = fbm(X / 90, Z / 90, 2, seed=73)
        self.rng = random.Random(77)
    def water_ids(self, bio):
        """beach, sea, river and lake ids where the water says so"""
        h = self.h
        bio = np.where(self.land & (self.dSea < 70 + 40 * self.n2) & (h < 4.5) & (self.slope < 0.25) & (self.ICE == 0), 1, bio)
        bio = np.where(self.wet & self.ocean, 0, bio)
        bio = np.where(self.wet & ~self.ocean & (np.hypot(self.FLOW[..., 0], self.FLOW[..., 1]) > 0.5), 13, bio)
        bio = np.where(self.wet & ~self.ocean & (bio != 13), 12, bio)
        return bio
    def finish_fd(self, fd, bio, glades=True):
        if glades: fd = fd * smooth(-0.35, -0.05, self.n2 + 0.25 * self.n3)
        fd = fd * (1 - smooth(0.75, 1.1, self.slope))
        fd = fd * smooth(2.0, 6.0, self.h)
        fd = fd * (self.land & (bio != 1) & (self.ICE == 0))
        fd = fd * (1 - np.clip(self.FLAT * 1.3, 0, 1))
        return np.clip(fd, 0, 1)
    def classes(self, bio, dunes=None):
        h = self.h; cls = np.zeros(h.shape, np.uint8)
        cls[(bio == 1)] = 3
        bank = self.land & (self.dWater < 10) & ~self.ocean & (np.isin(bio, [3, 4, 6, 9, 11, 2, 8])) & (h < 400)
        cls[bank & (self.dSea > 40)] = 4
        if dunes is not None: cls[self.land & (dunes > 0.55) & (self.slope < 0.5)] = 5
        TOWN = np.zeros(h.shape, np.uint8)
        for s in self.P['settlements']:
            rr = s['r'] * (1.05 if s['kind'] != 'city' else 1.15)
            m = (np.hypot(X - s['x'], Z - s['z']) < rr) & (self.FLAT > 0.5) & self.land
            cls[m] = 2; TOWN[m] = 1
        cls[self.ROADCELL] = 7
        cls[self.ICE > 0] = 8
        self.TOWN = TOWN
        return cls
    def fields(self, cls, fd, farm_mask, box, n_max=60, crops=None):
        rng = self.rng; h = self.h; crop_id = np.zeros(h.shape, np.uint8); fields = []
        blocked = ndimage.binary_dilation(self.ROADCELL | self.wet | (self.TOWN > 0), iterations=2)
        x0, x1, z0, z1 = box
        for t in range(6000):
            if len(fields) >= n_max: break
            x = rng.uniform(x0, x1); z = rng.uniform(z0, z1)
            if farm_mask[toI(z), toI(x)] < 0.55: continue
            w = rng.uniform(70, 200); d = rng.uniform(50, 150)
            i0, i1, j0, j1 = toI(x - w / 2), toI(x + w / 2), toI(z - d / 2), toI(z + d / 2)
            if i0 < 2 or j0 < 2 or i1 >= N - 2 or j1 >= N - 2: continue
            sub = (slice(j0, j1 + 1), slice(i0, i1 + 1))
            if blocked[sub].any() or (crop_id[j0 - 2:j1 + 3, i0 - 2:i1 + 3] > 0).any(): continue
            if self.slope[sub].max() > 0.12 or h[sub].min() < 2.0: continue
            c = rng.choice(crops or CROPS); cid = CROPS.index(c) + 1
            crop_id[sub] = cid; cls[sub] = 1; fd[sub] = 0
            fields.append({'x': round(x, 1), 'z': round(z, 1), 'w': round(w, 1), 'd': round(d, 1), 'crop': c, 'rows': 'x' if rng.random() < 0.5 else 'z'})
        hedge = ndimage.binary_dilation(crop_id > 0, iterations=1) & ~(crop_id > 0) & ~blocked
        fd = np.where(hedge & (self.n3 > -0.1), np.maximum(fd, 0.55), fd)
        print('fields', len(fields))
        return crop_id, fd, fields
def st_biomes():
    B = Bio(); out = spec.biomes(B)
    bio = out['bio']; counts = {BIOMES[k]: round(float((bio == k).mean() * 100), 2) for k in range(len(BIOMES)) if (bio == k).any()}
    print('biome %', counts)
    save('bio', bio.astype(np.uint8)); save('moist', out['moist'].astype(np.float32)); save('fd', out['fd'].astype(np.float32)); save('cls', out['cls'].astype(np.uint8))
    save('crop', out.get('crop', np.zeros(bio.shape, np.uint8)).astype(np.uint8)); save('temp', out['temp'].astype(np.float32))
    jdump('fields.json', {'fields': out.get('fields', []), 'crops': CROPS, 'biomes': BIOMES})


# ═════════ 8. export ═════════
PAL = np.array([(36, 92, 124), (224, 208, 160), (176, 178, 118), (96, 134, 74), (78, 112, 78), (176, 172, 166), (196, 192, 122), (226, 200, 140), (110, 126, 86), (120, 176, 104), (150, 160, 128), (156, 182, 104), (52, 118, 156), (60, 130, 168)], np.float64)
def st_export():
    os.makedirs(DST, exist_ok=True)
    h = load('h4').astype(np.float64); WL = load('WL').astype(np.float64); FLOW = load('FLOW'); FLAT = load('FLAT'); ICE = load('ICE')
    bio = load('bio'); fd = load('fd'); cls = load('cls'); crop = load('crop'); moist = load('moist'); temp = load('temp')
    P = jload('places.json'); ROADS = jload('roads.json'); WAT = jload('water.json'); FI = jload('fields.json'); R = regions()
    amp = spec.amp(R, h) if hasattr(spec, 'amp') else np.full(h.shape, 0.45)
    amp = np.clip(amp, 0.08, 1.6) * (1 - np.clip(FLAT * 1.2, 0, 1)) * (h > 0.5) * (ICE == 0)
    def enc16(v): v = np.clip(np.round((v + 100.0) * HSCALE), 0, 65535).astype(np.uint32); return (v >> 8).astype(np.uint8), (v & 255).astype(np.uint8)
    hr, hg = enc16(h)
    Image.fromarray(np.dstack([hr, hg, np.clip(amp * 100, 0, 255).astype(np.uint8)]), 'RGB').save(DST + '/height.png', optimize=True)
    wl = np.where(np.isnan(WL), -100.0, WL); has = ~np.isnan(WL)
    for _ in range(2):
        grown = ndimage.grey_dilation(np.where(has, wl, -1e9), size=3)
        nw = (~has) & (grown > -1e8); wl = np.where(nw, grown, wl); has = has | nw
    wr, wg = enc16(np.where(has, wl, -100.0))
    ang = np.arctan2(FLOW[..., 1], FLOW[..., 0]); fl = np.hypot(FLOW[..., 0], FLOW[..., 1]) > 0.5
    fb = np.where(fl, 1 + np.round((ang % (2 * np.pi)) / (2 * np.pi) * 253), 0).astype(np.uint8)
    Image.fromarray(np.dstack([wr, wg, fb]), 'RGB').save(DST + '/water.png', optimize=True)
    Image.fromarray(np.dstack([np.clip(moist * 255, 0, 255), np.clip(fd * 255, 0, 255), np.clip(temp * 255, 0, 255)]).astype(np.uint8), 'RGB').save(DST + '/surface.png', optimize=True)
    Image.fromarray(np.dstack([bio, cls, crop]).astype(np.uint8), 'RGB').save(DST + '/ids.png', optimize=True)
    wet = (~np.isnan(WL)) & (WL > h); IP = inplay(); lp = 100.0 * (1 - wet[IP].mean())
    stats = {'size_m': int(PLAY * 2), 'play_half': PLAY, 'cells': N, 'step': STEP, 'land_pct': round(float(lp), 2), 'water_pct': round(100 - float(lp), 2), 'area_km2': round((PLAY * 2 / 1000) ** 2, 1),
             'max_h': round(float(h.max()), 1), 'roads_km': round(sum(len(r['pts']) * 4 for r in ROADS) / 1000, 1), 'buildings': sum(len(s['buildings']) for s in P['settlements'])}
    print(stats)
    sp = spec.spawn(P)
    world = {'v': 1, 'map': MAP, 'grid': {'n': N, 'step': STEP, 'half': HALF, 'play': PLAY, 'hs': HSCALE}, 'stats': stats, 'spawn': {'x': round(sp[0], 1), 'z': round(sp[1], 1)},
             'settlements': P['settlements'], 'poi': P['poi'], 'roads': ROADS, 'rivers': WAT['rivers'], 'lakes': WAT['lakes'], 'falls': WAT.get('falls', []),
             'fields': FI['fields'], 'biomes': FI['biomes'], 'crops': FI['crops'], 'extras': P.get('extras', {}), 'climate': getattr(spec, 'CLIMATE', {})}
    open(DST + '/world.json', 'w').write(json.dumps(world, ensure_ascii=False, separators=(',', ':')))
    # the chart: relief + biome colour + water + roads + buildings
    S = 2048; k = S / (N - 1)
    hh = np.array(Image.fromarray(h.astype(np.float32), 'F').resize((S, S), Image.BILINEAR)).astype(np.float64)
    gx = np.gradient(hh, axis=1) * k / STEP; gz = np.gradient(hh, axis=0) * k / STEP
    shade = np.clip((-0.55 * gx - 0.5 * gz + 0.7) / np.sqrt(gx * gx + gz * gz + 1), 0, 1.2)
    bb = np.array(Image.fromarray(bio).resize((S, S), Image.NEAREST)); col = PAL[bb]
    ff = np.array(Image.fromarray((fd * 255).astype(np.uint8)).resize((S, S), Image.BILINEAR)) / 255.0
    col = col * (1 - 0.35 * ff[..., None]) + np.array([46, 84, 46]) * 0.35 * ff[..., None]
    tt = np.array(Image.fromarray(temp.astype(np.float32), 'F').resize((S, S), Image.BILINEAR)).astype(np.float64)
    snow = np.clip((0.40 - tt) / 0.07, 0, 1)[..., None]; col = col * (1 - snow * 0.75) + np.array([236, 240, 244]) * snow * 0.75
    ii = np.array(Image.fromarray(ICE * 255).resize((S, S), Image.NEAREST)) > 0; col[ii] = (196, 222, 236)
    cc = np.array([(0, 0, 0), (214, 186, 92), (98, 156, 62), (226, 196, 70), (232, 232, 226), (110, 150, 78), (196, 92, 64), (150, 118, 88), (206, 176, 98), (110, 156, 70), (220, 140, 60), (200, 120, 70), (196, 186, 104)], np.float64)
    cr = np.array(Image.fromarray(crop).resize((S, S), Image.NEAREST)); m = cr > 0; col[m] = cc[cr[m]]
    col = col * (0.62 + 0.45 * shade[..., None])
    wlS = np.array(Image.fromarray(np.where(np.isnan(WL), -999, WL).astype(np.float32), 'F').resize((S, S), Image.NEAREST)).astype(np.float64)
    wetS = wlS > hh; depth = np.clip((wlS - hh) / 30, 0, 1)
    wcol = np.array([92, 168, 186]) * (1 - depth[..., None]) + np.array([28, 78, 116]) * depth[..., None]
    col = np.where(wetS[..., None], wcol, col)
    ci = 50 if h.max() < 700 else 100
    cont = (np.floor(hh / ci) != np.floor(np.roll(hh, 1, 0) / ci)) | (np.floor(hh / ci) != np.floor(np.roll(hh, 1, 1) / ci))
    col = np.where((cont & ~wetS & (hh > 1))[..., None], col * 0.82, col)
    im = Image.fromarray(np.clip(col, 0, 255).astype(np.uint8)); d = ImageDraw.Draw(im)
    T = lambda x, z: ((x + HALF) / WORLD * S, (z + HALF) / WORLD * S)
    sc = max(1, int(round(8192 / WORLD))) if WORLD < 8192 else 1
    for r in ROADS:
        wd = {'highway': 5, 'road': 4, 'track': 2, 'rail': 3}.get(r['kind'], 3) * sc; cl = {'highway': (246, 222, 140), 'road': (240, 236, 220), 'track': (190, 150, 100), 'rail': (90, 80, 76)}.get(r['kind'], (220, 220, 220))
        pts = [T(p[0], p[1]) for p in r['pts']]
        if r['kind'] not in ('track',): d.line(pts, fill=(60, 50, 40), width=wd + 2)
        d.line(pts, fill=cl, width=wd)
    for s in P['settlements']:
        for st in s['streets']: d.line([T(*p) for p in st['pts']], fill=(236, 230, 214), width=2 * sc)
        for b in s['buildings']:
            x0, z0 = T(b['x'] - b['hx'], b['z'] - b['hz']); x1, z1 = T(b['x'] + b['hx'], b['z'] + b['hz'])
            d.rectangle([x0, z0, max(x0 + 1, x1), max(z0 + 1, z1)], fill=(120, 90, 70))
        for p in s['props']:       # boardwalks, platforms and ships show on the chart too
            if p['kind'] == 'walk': d.line([T(p['x0'], p['z0']), T(p['x1'], p['z1'])], fill=(150, 112, 72), width=max(2, sc * 2))
            elif p['kind'] == 'deck':
                x0, z0 = T(p['x'] - p['hx'], p['z'] - p['hz']); x1, z1 = T(p['x'] + p['hx'], p['z'] + p['hz']); d.rectangle([x0, z0, x1, z1], fill=(150, 112, 72))
            elif p['kind'] == 'ship':
                L = p.get('len', 60) * 0.86; Bm = 11 if p.get('war') else 9; along = abs(np.sin(p.get('ry', 0))) < 0.5
                hx, hz = (L / 2, Bm / 2) if along else (Bm / 2, L / 2)
                x0, z0 = T(p['x'] - hx, p['z'] - hz); x1, z1 = T(p['x'] + hx, p['z'] + hz); d.rectangle([x0, z0, x1, z1], fill=(84, 92, 100) if p.get('war') else (150, 60, 50), outline=(30, 34, 38))
    im.save(DST + '/map.jpg', quality=84, optimize=True)
    im.resize((1024, 1024), Image.LANCZOS).save(DST + '/map_s.jpg', quality=84, optimize=True)
    for f in sorted(os.listdir(DST)): print(f, os.path.getsize(os.path.join(DST, f)))


STAGES = {'land': st_land, 'relief': st_relief, 'erode': st_erode, 'water': st_water, 'places': st_places, 'roads': st_roads, 'biomes': st_biomes, 'export': st_export}
if __name__ == '__main__':
    todo = sys.argv[1:] or list(STAGES)
    if todo[0].endswith('+'): todo = list(STAGES)[list(STAGES).index(todo[0][:-1]):]
    for st in todo:
        t0 = time.time(); print('══', MAP, st); STAGES[st](); print('   ', round(time.time() - t0, 1), 's')
