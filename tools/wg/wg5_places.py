# stage 5: settlements and points of interest, with building layouts; terrain flattened under them
import numpy as np, json, random
from scipy import ndimage
from common import *
h = load('h2').astype(np.float64)
WL = load('WL')
wet = lambda: (~np.isnan(WL)) & (WL > h - 0.05)
rng = random.Random(20261018)
toI = lambda x: int(round((x + HALF) / STEP))
FLAT = np.zeros(h.shape, np.float32)          # 1 where the ground was levelled (no runtime micro-relief)

def hb(x, z):
    fx = (x + HALF) / STEP; fz = (z + HALF) / STEP; i = int(np.clip(np.floor(fx), 0, N - 2)); j = int(np.clip(np.floor(fz), 0, N - 2)); u = fx - i; v = fz - j
    return float(h[j, i] * (1 - u) * (1 - v) + h[j, i + 1] * u * (1 - v) + h[j + 1, i] * (1 - u) * v + h[j + 1, i + 1] * u * v)
def water_at(x, z):
    i, j = toI(x), toI(z); w = WL[j, i]; return (not np.isnan(w)) and w > h[j, i] - 0.05

def flatten(cx, cz, rx, rz, blend=50.0, max_grade=0.03, rot=0.0, minh=1.6, fixed=None):
    """fit a gentle plane to the ground in an ellipse and blend the terrain onto it"""
    global h
    c, s = np.cos(rot), np.sin(rot); dx = X - cx; dz = Z - cz
    u = (dx * c + dz * s) / rx; v = (-dx * s + dz * c) / rz; r = np.sqrt(u * u + v * v)
    inside = (r < 1) & ~wet()
    if fixed is None:
        A = np.c_[dx[inside], dz[inside], np.ones(inside.sum())]; coef, *_ = np.linalg.lstsq(A, h[inside], rcond=None)
        gx, gz, h0 = coef; g = np.hypot(gx, gz)
        if g > max_grade: gx, gz = gx / g * max_grade, gz / g * max_grade
        h0 = max(h0, minh)
    else: gx, gz, h0 = 0.0, 0.0, fixed
    plane = h0 + gx * dx + gz * dz
    rb = 1 + blend / min(rx, rz)
    w = 1 - smooth(1.0, rb, r)
    keep = wet() & (r < rb)
    h = np.where(keep, h, h * (1 - w) + plane * w)
    FLAT[:] = np.maximum(FLAT, (1 - smooth(0.9, rb, r)).astype(np.float32))
    return (gx, gz, h0)

settlements = []
POI = []
def poi(kind, name, x, z, **kw):
    d = {'kind': kind, 'name': name, 'x': round(x, 1), 'z': round(z, 1)}; d.update(kw); POI.append(d); return d

class Layout:
    def __init__(self, sid, name, kind, cx, cz, r):
        self.d = {'id': sid, 'name': name, 'kind': kind, 'x': cx, 'z': cz, 'r': r, 'buildings': [], 'streets': [], 'props': [], 'parking': [], 'squares': []}
        self.occ = []; self.segs = []; settlements.append(self.d)
    def free(self, x, z, hx, hz, m=1.0):
        for (ox, oz, ohx, ohz) in self.occ:
            if abs(x - ox) < hx + ohx + m and abs(z - oz) < hz + ohz + m: return False
        for (px, pz, r) in self.segs:
            if abs(x - px) < hx + r and abs(z - pz) < hz + r: return False
        return True
    def ground_ok(self, x, z, hx, hz, maxd=2.4):
        pts = [(x - hx, z - hz), (x + hx, z - hz), (x - hx, z + hz), (x + hx, z + hz), (x, z)]
        hs = [hb(a, b) for a, b in pts]
        if min(hs) < 1.3 or max(hs) - min(hs) > maxd: return False
        return not any(water_at(a, b) for a, b in pts)
    def add(self, kind, x, z, hx, hz, door, **kw):
        if not self.free(x, z, hx, hz, kw.pop('gap', 1.0)) or not self.ground_ok(x, z, hx, hz, kw.pop('maxd', 2.4)): return None
        b = {'kind': kind, 'x': round(x, 2), 'z': round(z, 2), 'hx': round(hx, 2), 'hz': round(hz, 2), 'door': door}; b.update(kw)
        if 'enter' not in b: b['enter'] = kind not in ('house', 'apartment', 'shopfront', 'warehouse') or rng.random() < 0.45
        self.d['buildings'].append(b); self.occ.append((x, z, hx, hz)); return b
    def block(self, x, z, hx, hz):
        self.occ.append((x, z, hx, hz))
    def street(self, pts, w, kind='street'):
        self.d['streets'].append({'pts': [[round(a, 1), round(b, 1)] for a, b in pts], 'w': w, 'kind': kind})
        for (ax, az), (bx, bz) in zip(pts[:-1], pts[1:]):
            n = max(1, int(np.hypot(bx - ax, bz - az) / 2.5))
            for k in range(n + 1):
                t = k / n; self.segs.append((ax + (bx - ax) * t, az + (bz - az) * t, w / 2 + 1.4))
    def prop(self, kind, x, z, ry=0.0, **kw):
        p = {'kind': kind, 'x': round(x, 2), 'z': round(z, 2), 'ry': round(ry, 3)}; p.update(kw); self.d['props'].append(p); return p

DOORS = {'n': (0, -1), 's': (0, 1), 'e': (1, 0), 'w': (-1, 0)}
WALLS_MED = [0xf1ece2, 0xe9dfca, 0xe2d4b8, 0xeedfc8, 0xdbe2df, 0xe9d2bb, 0xe4ddd0, 0xd8c3a5, 0xf4efe6]
TRIMS = [0x2f6a9a, 0x2b8c86, 0x3f7a4a, 0x6b4a2f, 0x2d5f86, 0x8b4b3a, 0x7a3a2e]

def frontage(L, x0, x1, zline, side, dmin, dmax, wmin, wmax, kinds, style, gapr=(0.5, 3.0)):
    """buildings along a street line z=zline on one side (side=+1 means buildings at greater z, door facing -z)"""
    x = x0 + rng.uniform(0, 4)
    while x < x1 - wmin:
        w = rng.uniform(wmin, wmax); d = rng.uniform(dmin, dmax)
        if x + w > x1: break
        cx = x + w / 2; cz = zline + side * (d / 2 + 0.2)
        k = rng.choice(kinds)
        L.add(k, cx, cz, w / 2, d / 2, 'n' if side > 0 else 's', style=style, floors=rng.choice([1, 1, 2, 2, 3]) if style == 'city' else rng.choice([1, 1, 2]), wall=rng.choice(WALLS_MED), trim=rng.choice(TRIMS), seed=rng.randrange(1 << 30))
        x += w + rng.uniform(*gapr)
def frontage_v(L, z0, z1, xline, side, dmin, dmax, wmin, wmax, kinds, style, gapr=(0.5, 3.0)):
    z = z0 + rng.uniform(0, 4)
    while z < z1 - wmin:
        w = rng.uniform(wmin, wmax); d = rng.uniform(dmin, dmax)
        if z + w > z1: break
        cz = z + w / 2; cx = xline + side * (d / 2 + 0.2)
        k = rng.choice(kinds)
        L.add(k, cx, cz, d / 2, w / 2, 'w' if side > 0 else 'e', style=style, floors=rng.choice([1, 1, 2, 2, 3]) if style == 'city' else rng.choice([1, 1, 2]), wall=rng.choice(WALLS_MED), trim=rng.choice(TRIMS), seed=rng.randrange(1 << 30))
        z += w + rng.uniform(*gapr)

# ═════════ 1. مدينة المرسى — the port city on the north coast ═════════
def city():
    def coast_z(x):
        i = toI(x); col = h[:, i]; return -HALF + np.argmax(col > 0.5) * STEP
    cx = -700.0
    zw = float(np.percentile([coast_z(x) for x in np.arange(cx - 230, cx + 231, 10)], 70)) + 16     # the quay street just behind the shore
    BW, BD, NX, NZ = 46.0, 42.0, 6, 4
    x0 = cx - BW * NX / 2; z0 = zw + 14
    cz = z0 + BD * NZ / 2
    L = Layout('city', 'مدينة المرسى', 'city', cx, cz, 240)
    xs = [x0 + k * BW for k in range(NX + 1)]; zs = [z0 + k * BD for k in range(NZ + 1)]
    for x in xs: L.street([(x, zw), (x, zs[-1])], 8.0 if abs(x - cx) < 1 else 7.0)
    flatten(cx, (zw + zs[-1]) / 2, BW * NX / 2 + 30, (zs[-1] - zw) / 2 + 40, blend=60, max_grade=0.015)
    for z in zs: L.street([(xs[0], z), (xs[-1], z)], 8.0 if abs(z - zs[2]) < 1 else 7.0)
    L.street([(xs[0] - 90, zw), (xs[-1] + 90, zw)], 10.0, 'boulevard')
    # the square takes the central block, a park the block next to it
    sqx, sqz = xs[2] + BW / 2, zs[1] + BD / 2
    L.d['squares'].append({'x': sqx, 'z': sqz, 'r': 18}); L.block(sqx, sqz, BW / 2 - 4, BD / 2 - 4)
    L.prop('fountain', sqx, sqz)
    for k in range(4):
        a = np.pi / 4 + k * np.pi / 2; L.prop('stall', sqx + np.cos(a) * 12, sqz + np.sin(a) * 11, ry=float(np.arctan2(-np.cos(a), -np.sin(a))))
    pkx, pkz = xs[3] + BW / 2, zs[2] + BD / 2
    L.d['squares'].append({'x': pkx, 'z': pkz, 'r': 17, 'park': True}); L.block(pkx, pkz, BW / 2 - 4, BD / 2 - 4)
    specials = [
        ('mosque', 'مسجد المرسى', 11, 11, {'minaret': True}),
        ('clocktower', 'برج الساعة', 3.2, 3.2, {}),
        ('shop', 'متجر الأزياء', 7.5, 6, {'shop': 'clothes', 'sign': 'متجر الأزياء'}),
        ('shop', 'سوق المرسى', 8, 6.5, {'shop': 'grocery', 'sign': 'سوق المرسى'}),
        ('shop', 'صيدلية الشفاء', 6, 5, {'shop': 'pharmacy', 'sign': 'صيدلية الشفاء'}),
        ('shop', 'عدد وأدوات', 7, 6, {'shop': 'tools', 'sign': 'عدد وأدوات'}),
        ('shop', 'الصيد والسلاح', 6.5, 5.5, {'shop': 'guns', 'sign': 'الصيد والسلاح'}),
        ('shop', 'معرض السيارات', 12, 8, {'shop': 'cars', 'sign': 'معرض السيارات', 'showroom': True}),
        ('shop', 'مقهى البحر', 6.5, 5.5, {'shop': 'cafe', 'sign': 'مقهى البحر', 'terrace': True}),
        ('shop', 'مخبز الحارة', 5.5, 5, {'shop': 'bakery', 'sign': 'مخبز'}),
        ('shop', 'المصرف', 8, 6.5, {'shop': 'bank', 'sign': 'المصرف'}),
        ('hotel', 'فندق الصخرة', 11, 8, {'floors': 4, 'sign': 'فندق الصخرة'}),
        ('police', 'مركز الشرطة', 9, 7, {'sign': 'الشرطة'}),
        ('clinic', 'المستوصف', 9, 7, {'sign': 'المستوصف'}),
    ]
    # frontage lots around every block (outer ring of each block), specials first near the square
    lots = []
    for i in range(NX):
        for j in range(NZ):
            sw = lambda v, ref: (8.0 if abs(v - ref) < 1 else 7.0) / 2 + 1.7
            bx0, bx1, bz0, bz1 = xs[i] + sw(xs[i], cx), xs[i + 1] - sw(xs[i + 1], cx), zs[j] + sw(zs[j], zs[2]), zs[j + 1] - sw(zs[j + 1], zs[2])
            if abs((xs[i] + BW / 2) - sqx) < 1 and abs((zs[j] + BD / 2) - sqz) < 1: continue
            if abs((xs[i] + BW / 2) - pkx) < 1 and abs((zs[j] + BD / 2) - pkz) < 1: continue
            lots.append((bx0, bx1, bz0, bz1))
    lots.sort(key=lambda q: np.hypot((q[0] + q[1]) / 2 - sqx, (q[2] + q[3]) / 2 - sqz))
    placed = 0
    for kind, name, hx, hz, extra in specials:
        done = False
        for (bx0, bx1, bz0, bz1) in lots:
            for (x, z, door) in [((bx0 + bx1) / 2, bz0 + hz, 'n'), ((bx0 + bx1) / 2, bz1 - hz, 's'), (bx0 + hx, (bz0 + bz1) / 2, 'w'), (bx1 - hx, (bz0 + bz1) / 2, 'e')]:
                b = L.add(kind, x, z, hx, hz, door, name=name, style='city', floors=extra.get('floors', 2 if kind != 'clocktower' else 1), wall=rng.choice(WALLS_MED), trim=rng.choice(TRIMS), seed=rng.randrange(1 << 30), gap=0.3, **{k: v for k, v in extra.items() if k != 'floors'})
                if b: placed += 1; done = True; break
            if done: break
    print('city specials placed', placed, '/', len(specials))
    KINDS = ['house', 'house', 'apartment', 'apartment', 'shopfront']
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
                L.add(rng.choice(KINDS), x, z, hx - 0.15, hz - 0.15, side, style='city', floors=rng.choice([1, 2, 2, 2, 3, 3]), wall=rng.choice(WALLS_MED), trim=rng.choice(TRIMS), seed=rng.randrange(1 << 30), gap=0.05)
                t += w + rng.uniform(0.0, 1.8)
    # the harbour front: warehouses, fish market, and piers into the sea
    frontage(L, xs[0] - 85, xs[-1] + 85, zw - 6.6, -1, 10, 13, 14, 22, ['warehouse', 'warehouse', 'fishmarket'], 'port', gapr=(6, 16))
    for px in [cx - 150, cx - 20, cx + 110]:
        cz0 = coast_z(px)
        L.prop('pier', px, cz0 - 34, len=80, w=5.0)
        for k in range(3): L.prop('boat', px + rng.choice([-6.5, 6.5]), cz0 - 22 - k * 20, ry=rng.uniform(-0.1, 0.1), moored=True)
    for st in L.d['streets']:
        (ax, az), (bx, bz) = st['pts'][0], st['pts'][-1]
        n = int(np.hypot(bx - ax, bz - az) / 24)
        for k in range(n):
            t = (k + 0.5) / n; x = ax + (bx - ax) * t; z = az + (bz - az) * t; horiz = abs(bx - ax) > abs(bz - az)
            sgn = 1 if k % 2 else -1
            if horiz: L.prop('lamp', x, z + (st['w'] / 2 + 0.9) * sgn, side=-sgn, axis='z')
            else: L.prop('lamp', x + (st['w'] / 2 + 0.9) * sgn, z, side=-sgn, axis='x')
            if rng.random() < 0.3: L.d['parking'].append({'x': round(x + (0 if horiz else 2.2 * -sgn), 1), 'z': round(z + (2.2 * -sgn if horiz else 0), 1), 'ry': float(np.pi / 2 if horiz else 0.0)})
    poi('city', 'مدينة المرسى', cx, cz, r=240)
    return L

# ═════════ 2. villages ═════════
def village(sid, name, cx, cz, style, n_house=22, extra=(), r=180, road_axis='x'):
    flatten(cx, cz, r, r * 0.8, blend=60, max_grade=0.04)
    L = Layout(sid, name, 'village', cx, cz, r)
    if road_axis == 'x':
        L.street([(cx - r, cz), (cx + r, cz)], 7.0, 'village')
        L.street([(cx, cz - r * 0.6), (cx, cz + r * 0.6)], 6.0, 'village')
    else:
        L.street([(cx, cz - r), (cx, cz + r)], 7.0, 'village')
        L.street([(cx - r * 0.6, cz), (cx + r * 0.6, cz)], 6.0, 'village')
    L.d['squares'].append({'x': cx, 'z': cz, 'r': 10})
    for kind, name2, hx, hz, kw in extra:
        for t in range(60):
            a = rng.uniform(0, 2 * np.pi); d = rng.uniform(16, r * 0.75); x = cx + np.cos(a) * d; z = cz + np.sin(a) * d
            door = 'n' if z > cz else 's'
            if L.add(kind, x, z, hx, hz, door, name=name2, style=style, seed=rng.randrange(1 << 30), **kw): break
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
    for t in range(14):
        a = rng.uniform(0, 2 * np.pi); d = rng.uniform(8, r * 0.8); L.prop('lamp', cx + np.cos(a) * d, cz + np.sin(a) * d) if t < 8 else None
    poi('village', name, cx, cz, r=r)
    return L

# ═════════ 3. special compounds ═════════
def military(cx, cz):
    flatten(cx, cz, 140, 110, blend=50, max_grade=0.01)
    L = Layout('base', 'القاعدة العسكرية', 'military', cx, cz, 150)
    L.d['fence'] = {'x': cx, 'z': cz, 'hx': 130, 'hz': 100, 'gate': 's'}
    L.street([(cx, cz + 100), (cx, cz - 60)], 8.0, 'base'); L.street([(cx - 110, cz - 10), (cx + 110, cz - 10)], 7.0, 'base')
    for k, (x, z) in enumerate([(cx - 70, cz - 50), (cx - 70, cz + 25), (cx + 70, cz - 50)]):
        L.add('barracks', x, z, 18, 7, 's', style='military', name='ثكنة', seed=rng.randrange(1 << 30))
    L.add('hangar', cx + 70, cz + 45, 22, 16, 'w', style='military', name='حظيرة الآليات', seed=rng.randrange(1 << 30))
    L.add('hq', cx - 20, cz - 62, 13, 9, 's', style='military', name='مقر القيادة', floors=2, seed=rng.randrange(1 << 30), armory=True)
    for sx, sz in [(-1, -1), (1, -1), (-1, 1), (1, 1)]:
        L.prop('watchtower', cx + sx * 124, cz + sz * 94)
    L.prop('helipad', cx - 60, cz + 70)
    for k in range(6): L.prop('tent', cx + 20 + (k % 3) * 14, cz + 20 + (k // 3) * 14)
    for k in range(10): L.prop('crates', cx + rng.uniform(-100, 100), cz + rng.uniform(-80, 80))
    L.d['parking'] += [{'x': cx + 35 + k * 6, 'z': cz - 30, 'ry': 0.0, 'kind': 'military'} for k in range(4)]
    poi('military', 'القاعدة العسكرية', cx, cz, r=150)
    return L
def lighthouse(x, z):
    # pull a little inland so the tower stands on rock
    flatten(x, z, 24, 24, blend=20, max_grade=0.0)
    L = Layout('light', 'المنارة', 'lighthouse', x, z, 40)
    L.d['buildings'].append({'kind': 'lighthouse', 'x': x, 'z': z, 'hx': 3, 'hz': 3, 'door': 's', 'name': 'المنارة'})
    L.add('house', x - 12, z + 10, 4, 3.4, 's', style='city', name='بيت الحارس', seed=1, wall=0xece2cf, trim=0x8f3326)
    poi('lighthouse', 'المنارة', x, z)
    return L

# ── place everything ──
CITY = city()
FARMV = village('farm', 'قرية السنابل', -2000.0, -1300.0, 'farm', 26, extra=[('barn', 'الحظيرة الكبرى', 12, 8, {}), ('silo', 'الصومعة', 4, 4, {}), ('shop', 'دكّان القرية', 6, 5, {'shop': 'grocery', 'sign': 'دكّان القرية'}), ('barn', 'حظيرة', 10, 7, {})])
MTN = village('mountain', 'قرية الثلج', 1888.0, -1704.0, 'chalet', 18, extra=[('lodge', 'نُزل التزلّج', 12, 9, {'floors': 2, 'sign': 'نُزل التزلّج'}), ('shop', 'متجر الجبل', 6, 5, {'shop': 'clothes', 'sign': 'ملابس الجبل'})], r=120, road_axis='z')
DESERT = village('desert', 'واحة السراب', -2100.0, 1800.0, 'adobe', 22, extra=[('shop', 'سوق الواحة', 8, 6, {'shop': 'grocery', 'sign': 'سوق الواحة'}), ('caravanserai', 'الخان القديم', 16, 16, {})], r=160)
SWAMP = village('swamp', 'قرية المستنقع', 350.0, 2300.0, 'stilt', 12, r=120)
MINE = village('mine', 'بلدة المنجم', 2184.0, 472.0, 'mining', 12, extra=[('mineshaft', 'مدخل المنجم', 6, 6, {}), ('shop', 'متجر المعادن', 6, 5, {'shop': 'ores', 'sign': 'تاجر المعادن'})], r=110)
BASE = military(-700.0, 1100.0)
def ne_cape():
    landm = (h > 4) & ~wet(); idx = np.argwhere(landm); xs_ = X[landm]; zs_ = Z[landm]; sc = xs_ - zs_
    k = int(np.argmax(sc)); x, z = float(xs_[k]), float(zs_[k])
    # step back inland until the ground is a little higher and away from the cliff edge
    for t in range(60):
        if hb(x, z) > 8 and not water_at(x + 20, z - 20): break
        x -= 6; z += 6
    return x - 18, z + 18
LH = lighthouse(*ne_cape())
# resorts and outposts
RES = village('resort', 'منتجع البحيرة', 250.0, -880.0, 'chalet', 10, extra=[('lodge', 'فندق البحيرة', 11, 8, {'floors': 2, 'sign': 'فندق البحيرة'})], r=90)
# island villages: find a flat beachy spot on each island
def island_spot(cx, cz, R):
    best = None
    for t in range(2500):
        a = rng.uniform(0, 2 * np.pi); d = rng.uniform(0, R); x = cx + np.cos(a) * d; z = cz + np.sin(a) * d
        hh = hb(x, z)
        if hh < 2.5 or hh > 18 or water_at(x, z): continue
        i, j = toI(x), toI(z); sub = h[j - 6:j + 7, i - 6:i + 7]
        sc = float(sub.max() - sub.min())
        if best is None or sc < best[0]: best = (sc, x, z)
    return best[1], best[2]
tx, tz = island_spot(3320, 2300, 500); TROP = village('tropic', 'جزيرة النخيل', tx, tz, 'hut', 10, r=80)
nx_, nz_ = island_spot(-3300, -3200, 400); FISH = village('fisher', 'قرية الصيادين', nx_, nz_, 'fisher', 9, r=75)
# lonely places
for name, (x, z), kind in [('معسكر الحطابين', (-400, -1200), 'loggers'), ('القلعة القديمة', (-2700, 2500), 'castle'), ('معبد الرمال', (-1500, 2600), 'ruins'),
                           ('برج الإرسال', (2056, -1216), 'radio'), ('محطة وقود الغرب', (-1500, -400), 'gas'), ('محطة وقود الجنوب', (200, 1500), 'gas'),
                           ('كوخ الصياد', (-1300, -2200), 'cabin'), ('كوخ الصياد', (1300, 900), 'cabin'), ('كوخ الصياد', (-200, 300), 'cabin'),
                           ('المعسكر المهجور', (900, 1200), 'camp'), ('مزرعة الرياح', (-2700, -2000), 'windfarm')]:
    if kind in ('castle',): flatten(x, z, 45, 45, blend=40, max_grade=0.0)
    elif kind in ('radio',): flatten(x, z, 10, 10, blend=14, max_grade=0.0)
    elif kind != 'windfarm': flatten(x, z, 30, 30, blend=30, max_grade=0.02)
    poi(kind, name, x, z)
# ── stats and save
for s in settlements: print(s['id'], s['name'], 'buildings', len(s['buildings']), 'streets', len(s['streets']))
save('h3', h.astype(np.float32)); save('FLAT', FLAT)
json.dump({'settlements': settlements, 'poi': POI}, open(OUT + '/places.json', 'w'), ensure_ascii=False)
