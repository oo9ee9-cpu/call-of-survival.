# القارة الكبرى — a 30 x 30 km continent: a frozen north, a volcano with a lava lake and lava flows, a great range with a
# summit you can climb, a great lake with a secret island, rivers falling over ledges, forests, a misty swamp, farmland,
# a desert with a ghost city, a canyon crossed by suspension bridges, a railway through tunnels, labs dug into the ground,
# and watchtowers on the heights that open the fog over the chart
import numpy as np
from common import *
import mg
from mg import soft, ellw, warp, spine_dist, coast, town, village, military, lighthouse, lonely, Layout, HW, RD, TR, HWM

NAME = 'القارة الكبرى'
TARGET_LAND = 0.62
SEED = 30030
DROPS = 700000
MIN_ISLAND = 60
ROAD_COST = {'swamp': 0.8, 'canyon': 6.0, 'volcano': 1.5}
CLIMATE = {'temp': 0.55, 'weather': 'mega', 'regional': True}
VOLC = (8500.0, -6500.0)
RANGE = [(-6000, -11000), (-3500, -7200), (-1200, -3500), (1500, 0), (4300, 3300), (6600, 5200)]
SUMMIT = (-1200.0, -3500.0)
CANYON = [(6800, 7300), (8800, 8600), (11200, 9300), (13800, 10800)]
LAKE = (-6500.0, 1500.0)
_W = None
def _warp():
    global _W
    if _W is None: _W = warp(5600, 2500, 901)
    return _W

def land_field():
    w = _warp()
    main = np.maximum.reduce([
        ellw(0, 0, 11000, 10600, 0.1, w),
        ellw(9000, -8800, 5200, 3600, -0.5, w), ellw(-9400, 9200, 5200, 3400, 0.5, w),
        ellw(-10000, -8000, 4200, 4600, 0.2, w), ellw(9400, 9000, 4800, 3800, -0.3, w),
    ])
    bays = np.maximum.reduce([
        ellw(-2000, 13300, 2700, 1900, 0.0, w), ellw(13400, -200, 2700, 5000, 0.1, w), ellw(-13300, 1500, 3200, 3800, 0.0, w),
        ellw(-3000, -13000, 900, 4200, 0.15, w), ellw(2600, -13200, 800, 3600, -0.1, w), ellw(6300, 13300, 1800, 1500, 0.3, w),
        ellw(-12800, -2600, 1800, 1600, 0.2, w), ellw(12700, -12700, 2600, 2100, -0.6, w), ellw(-12800, 12900, 2300, 2100, 0.6, w),
        ellw(-7000, -13600, 1700, 1500, 0.0, w), ellw(13600, 6000, 1500, 1800, 0.0, w),
    ])
    isl = np.maximum.reduce([ellw(13800, 13600, 900, 700, 0.4, w), ellw(-13600, -13400, 800, 900, 0.0, w), ellw(13700, -13500, 700, 600, 0.3, w), ellw(-13500, 13300, 900, 650, 0.2, w), ellw(500, 14300, 600, 380, 0.0, w), ellw(-14000, 7000, 700, 900, 0.0, w)])
    F = np.maximum(main - np.clip(bays, 0, None) * 2.4, isl)
    F += fbm(X / 2600, Z / 2600, 5, seed=902) * 0.18 + fbm(X / 700, Z / 700, 3, seed=903) * 0.05
    return F

def regions(land, dIn, dOut):
    w = (fbm(X / 3000 + 9.1, Z / 3000 - 2.2, 4, seed=911) * 1100, fbm(X / 3000 - 4.4, Z / 3000 + 6.6, 4, seed=912) * 1100)
    R = {}
    R['north'] = smooth(-7000, -10500, Z + 900 * fbm(X / 3000, Z / 3000, 3, seed=913)).astype(np.float64)
    dV = np.hypot(X - VOLC[0], Z - VOLC[1]); R['volcano'] = smooth(4200, 1800, dV).astype(np.float64)
    dS, tS = spine_dist(RANGE); R['range'] = np.exp(-(np.maximum(0, dS + 500 * fbm(X / 2200, Z / 2200, 3, seed=914)) / 2600) ** 2)
    R['lake'] = soft(LAKE[0], LAKE[1], 3400, 2400, 0.2, 0.6, warp=w)
    R['forest'] = soft(-10000, -2200, 3800, 4200, 0.1, 0.7, warp=w)
    R['swamp'] = soft(-9500, 9200, 3500, 2500, 0.5, 0.6, warp=w)
    R['farm'] = soft(0, 8600, 5800, 3200, 0.0, 0.7, warp=w)
    R['desert'] = soft(8600, 2200, 3000, 4200, 0.0, 0.7, warp=w)
    dC, tC = spine_dist(CANYON); R['canyon'] = smooth(380, 120, dC + 80 * fbm(X / 700, Z / 700, 3, seed=915)).astype(np.float64)
    R['canyonland'] = soft(10000, 9000, 4500, 3000, -0.2, 0.6, warp=w)
    R['capital'] = soft(-2000, 9500, 900, 700, 0.0, 0.6)
    return R

def relief(R, land, dIn, dOut):
    n1 = fbm(X / 3000, Z / 3000, 5, seed=921); n2 = fbm(X / 900, Z / 900, 4, seed=922); n3 = fbm(X / 280, Z / 280, 3, seed=923)
    rid = ridged(X / 3800 + 7.1, Z / 3800 - 3.3, 6, seed=924)
    h = 3 + 40 * (1 - np.exp(-dIn / 1400))
    inl = smooth(200, 2500, dIn)
    h += inl * (60 * (n1 * 0.5 + 0.5) + 45 * ridged(X / 1700 + 2.2, Z / 1700 + 8.8, 5, seed=925) + 12 * n2)
    peaks = 0.45 + 0.55 * smooth(-0.35, 0.45, fbm(X / 2600 + 1.7, Z / 2600 - 0.4, 3, seed=926))
    h += R['range'] * (160 + peaks * 620 * rid + 30 * n2)
    dSm = np.hypot(X - SUMMIT[0], Z - SUMMIT[1]); h += 420 * np.exp(-(dSm / 1300) ** 2)        # the summit, the highest point of the range
    h += R['north'] * (60 + 80 * (n1 * 0.5 + 0.5))
    # the volcano: a broad cone, steeper near the top, a crater with a lava lake
    dV = np.hypot(X - VOLC[0], Z - VOLC[1]) + 120 * n3
    cone = 1060 * np.exp(-(dV / 2500) ** 1.5); cone = np.where(dV < 520, 1060 * np.exp(-(520 / 2500) ** 1.5) - 140 * smooth(520, 260, dV), cone)
    h = np.maximum(h, cone + 20 * n2 * smooth(3000, 800, dV))
    # the great lake basin, the farm plains, the swamp, the desert dunes, the canyon lands and the capital's slope
    h = h * (1 - R['lake'] * 0.75) + R['lake'] * (40 + 8 * n2)
    h = h * (1 - R['farm'] * 0.7) + R['farm'] * (25 + 25 * (fbm(X / 6000, Z / 6000, 3, seed=927) * 0.5 + 0.5))
    h = h * (1 - R['swamp'] * 0.94) + R['swamp'] * (1.6 + 1.2 * fbm(X / 400, Z / 400, 4, seed=928))
    ang = 0.6; u = X * np.cos(ang) + Z * np.sin(ang); ph = u / (90 + 50 * (fbm(X / 3000, Z / 3000, 2, seed=929) * 0.5 + 0.5)) + 3 * fbm(X / 1500, Z / 1500, 3, seed=930)
    dunes = (1 - np.abs(np.sin(ph))) ** 1.8 * (10 + 22 * (fbm(X / 2000, Z / 2000, 3, seed=931) * 0.5 + 0.5))
    h = h * (1 - R['desert'] * 0.6) + R['desert'] * (60 + dunes)
    mn = fbm(X / 1400 + 3, Z / 1400 - 1, 4, seed=932) * 0.5 + 0.5
    mesa = smooth(0.5, 0.53, mn) * 60 + smooth(0.62, 0.645, mn) * 45
    h = h * (1 - R['canyonland'] * 0.6) + R['canyonland'] * (90 + mesa + 8 * n2)
    h = h - R['canyon'] * np.clip(h - 25, 0, None) * 0.92                                     # the canyon cuts down to a dry floor
    h = h * (1 - R['capital'] * 0.75) + R['capital'] * (3 + dIn * 0.012 + 3 * n2)
    cliffy = np.clip(R['range'] * 0.8 + R['north'] * 0.8 + R['canyonland'] * 0.6, 0, 1) * smooth(0.4, 0.6, fbm(X / 4000, Z / 4000, 3, seed=933) * 0.5 + 0.5)
    return coast(h, cliffy, land, dIn, dOut, beach=(90.0, 90.0), shelf=900.0, deep=60.0)

def erodibility(R, h):
    return 0.5 + R['range'] * 0.5 + R['north'] * 0.3 - R['desert'] * 0.35 - R['farm'] * 0.3 - R['swamp'] * 0.5 - R['volcano'] * 0.25 - R['capital'] * 0.3

def water(W):
    big = W.lake('البحيرة العظيمة', LAKE[0], LAKE[1], 2300, 1500, 0.2, depth=14.0, island=(LAKE[0] + 200, LAKE[1] - 100, 380, 12.0))
    W.lake('بحيرة الجليد الكبرى', -900, -8900, 900, 520, 0.3, frozen=True)
    W.lake('بحيرة الشمال', 4600, -9300, 600, 400, -0.2, frozen=True)
    W.lake('البحيرة الزرقاء', 2600, -1800, 520, 360, 0.5, depth=8.0)
    mt = W.lake('بحيرة الجبل', -3300, -6400, 380, 260, 0.4, depth=6.0)
    W.lake('واحة الصحراء', 9500, 3000, 220, 160, 0.0, depth=4.0)
    W.river('النهر العظيم', [(-2900, -6100), (-3800, -3500), (-5000, -800), (-5900, 300)], 16, 30, start_level=mt, end_level=big, falls=[(-3600, -4300, 14.0)])
    W.river('نهر الغرب', [(-8200, 2600), (-10000, 3600), (-12100, 4300)], 26, 44, start_level=big, end_level=0.0)
    W.river('نهر الوادي', [(2200, -1300), (1800, 2500), (900, 6500), (-200, 9900)], 18, 36, start_level=None, end_level=0.0, falls=[(1900, 1500, 10.0)])
    W.river('نهر الشمال', [(-2000, -6900), (-2600, -8700), (-3300, -9900)], 14, 26, start_level=None, end_level=0.0, falls=[(-2500, -8300, 12.0)])
    W.lagoons(_R('swamp'), level=1.05)

def _R(name): return load('R_' + name).astype(np.float64)

# ── the special places ──
def lab(A, sid, name, x, z):
    """a laboratory dug into the ground: a pit with a sloping way down, a concrete bunker at the bottom"""
    g = A.hb(x, z)
    A.flatten(x, z, 30, 30, blend=34, max_grade=0.0, fixed=max(1.5, g - 8.0), minh=1.0)
    L = Layout(A, sid, name, 'military', x, z, 60)
    L.add('hq', x, z, 12, 9, 's', style='military', name=name, floors=1, seed=A.rng.randrange(1 << 30), armory=True, lab=True, maxd=3.0)
    for k in range(5): L.prop('crates', x + A.rng.uniform(-22, 22), z + A.rng.uniform(-22, 22))
    A.poi('lab', name, x, z, r=60)
    return L

def tower(A, sid, x, z, name='برج المراقبة'):
    """a watchtower on the heights: climb it and the fog lifts from the chart all around"""
    x, z = A.spot(x, z, 260, hmin=4, hmax=1100, flat_r=3, tries=600, grow=1)
    A.flatten(x, z, 6, 6, blend=8, max_grade=0.0)
    L = Layout(A, sid, name, 'tower', x, z, 24)
    L.prop('watchtower', x, z)
    A.extras.setdefault('towers', []).append([round(x, 1), round(z, 1)])
    return L

TOWNS = []
def places(A):
    rng = A.rng
    # the capital on the south coast, facing a southern harbour
    col = lambda x: A.h[:, int(round((x + HALF) / STEP))]
    shore = float(np.percentile([-HALF + np.where(col(x) > 0.5)[0].max() * STEP for x in np.arange(-2300, -1700, 16)], 30))
    town(A, 'city', 'العاصمة', -2000.0, shore - 16, NX=8, NZ=5, BW=46.0, BD=42.0, sea='s', specials=[
        ('mosque', 'الجامع الكبير', 11, 11, {'minaret': True}), ('clocktower', 'برج الساعة', 3.2, 3.2, {}),
        ('shop', 'متجر الأزياء', 7.5, 6, {'shop': 'clothes', 'sign': 'متجر الأزياء'}), ('shop', 'السوق الكبير', 8, 6.5, {'shop': 'grocery', 'sign': 'السوق الكبير'}),
        ('shop', 'صيدلية العاصمة', 6, 5, {'shop': 'pharmacy', 'sign': 'صيدلية'}), ('shop', 'عدد وأدوات', 7, 6, {'shop': 'tools', 'sign': 'عدد وأدوات'}),
        ('shop', 'الصيد والسلاح', 6.5, 5.5, {'shop': 'guns', 'sign': 'الصيد والسلاح'}), ('shop', 'معرض السيارات', 12, 8, {'shop': 'cars', 'sign': 'معرض السيارات', 'showroom': True}),
        ('shop', 'مقهى العاصمة', 6.5, 5.5, {'shop': 'cafe', 'sign': 'مقهى العاصمة', 'terrace': True}), ('shop', 'مخبز الحي', 5.5, 5, {'shop': 'bakery', 'sign': 'مخبز'}),
        ('shop', 'المصرف المركزي', 8, 6.5, {'shop': 'bank', 'sign': 'المصرف المركزي'}), ('hotel', 'فندق القارة', 11, 8, {'floors': 5, 'sign': 'فندق القارة'}),
        ('police', 'مركز الشرطة', 9, 7, {'sign': 'الشرطة'}), ('clinic', 'المستشفى', 10, 8, {'sign': 'المستشفى', 'floors': 3}),
        ('warehouse', 'محطة القطار', 14, 7, {'sign': 'محطة القطار', 'floors': 1}),
    ])
    # inland cities
    vx, vz = A.spot(5600, -3600, 800, hmin=20, hmax=400, flat_r=14)
    town(A, 'volcity', 'مدينة البركان', vx, vz - 90, NX=5, NZ=3, harbour=False, style='city', specials=[
        ('shop', 'متجر الأزياء', 7.5, 6, {'shop': 'clothes', 'sign': 'أزياء البركان'}), ('shop', 'بقالة', 8, 6.5, {'shop': 'grocery', 'sign': 'بقالة'}),
        ('shop', 'الصيد والسلاح', 6.5, 5.5, {'shop': 'guns', 'sign': 'الصيد والسلاح'}), ('shop', 'تاجر المعادن', 6, 5, {'shop': 'ores', 'sign': 'تاجر المعادن'}),
        ('shop', 'صيدلية', 6, 5, {'shop': 'pharmacy', 'sign': 'صيدلية'}), ('warehouse', 'محطة القطار', 14, 7, {'sign': 'محطة القطار', 'floors': 1}),
        ('police', 'مركز الشرطة', 9, 7, {'sign': 'الشرطة'}),
    ])
    ncol = lambda x: -HALF + int(np.argmax(col(x) > 0.5)) * STEP
    nshore = float(np.percentile([ncol(x) for x in np.arange(-500, 500, 16)], 70)) + 16
    town(A, 'north', 'ميناء الشمال', 0.0, nshore, NX=5, NZ=3, style='chalet', piers=2, specials=[
        ('shop', 'ملابس الشتاء', 7.5, 6, {'shop': 'clothes', 'sign': 'ملابس الشتاء'}), ('shop', 'بقالة الشمال', 8, 6.5, {'shop': 'grocery', 'sign': 'بقالة'}),
        ('shop', 'الصيد والسلاح', 6.5, 5.5, {'shop': 'guns', 'sign': 'الصيد والسلاح'}), ('shop', 'عدد وأدوات', 7, 6, {'shop': 'tools', 'sign': 'عدد وأدوات'}),
        ('lodge', 'نُزل الشفق', 11, 8, {'floors': 2, 'sign': 'نُزل الشفق'}),
    ], kinds=('house', 'house', 'shopfront'), floors=(1, 2, 2))
    gx, gz = A.spot(9000, 700, 900, hmin=20, hmax=300, flat_r=14)
    town(A, 'ghost', 'مدينة الأشباح', gx, gz - 100, NX=6, NZ=4, harbour=False, style='ruin', kind='ruin', specials=[], kinds=('house', 'apartment', 'apartment', 'shopfront'), floors=(1, 2, 3, 4))
    cx_, cz_ = A.spot(8600, 6300, 700, hmin=20, hmax=400, flat_r=12)
    town(A, 'canyontown', 'بلدة الوادي', cx_, cz_ - 70, NX=4, NZ=3, harbour=False, style='adobe', specials=[
        ('shop', 'بقالة الوادي', 8, 6.5, {'shop': 'grocery', 'sign': 'بقالة'}), ('shop', 'سوق الأقمشة', 7.5, 6, {'shop': 'clothes', 'sign': 'سوق الأقمشة'}),
        ('shop', 'الصيد والسلاح', 6.5, 5.5, {'shop': 'guns', 'sign': 'الصيد والسلاح'}),
    ], kinds=('house', 'house', 'shopfront'), floors=(1, 1, 2))
    # villages all over
    V = [('farm1', 'قرية السنابل', (2500, 8200), 'farm', [('barn', 'الحظيرة الكبرى', 12, 8, {}), ('silo', 'الصومعة', 4, 4, {}), ('shop', 'دكّان القرية', 6, 5, {'shop': 'grocery', 'sign': 'دكّان'})]),
         ('farm2', 'قرية الذرة', (-4200, 7600), 'farm', [('barn', 'حظيرة', 10, 7, {})]), ('farm3', 'قرية الطاحونة', (5000, 9300), 'farm', [('barn', 'حظيرة', 10, 7, {}), ('silo', 'الصومعة', 4, 4, {})]),
         ('wood1', 'قرية الحطابين', (-10200, -1500), 'chalet', [('shop', 'عدد الحطابين', 6, 5, {'shop': 'tools', 'sign': 'عدد الحطابين'})]), ('wood2', 'قرية البلّوط', (-8200, -4800), 'chalet', []),
         ('wood3', 'قرية الصنوبر', (-11500, 2200), 'chalet', []), ('swamp1', 'قرية المستنقع', (-9600, 9000), 'stilt', []),
         ('lake1', 'قرية الصيادين', (-4300, 2600), 'fisher', [('shop', 'سوق السمك', 7, 6, {'shop': 'grocery', 'sign': 'سوق السمك'})]), ('lake2', 'قرية الضفة', (-9900, 1900), 'fisher', []),
         ('mine1', 'بلدة المنجم', (-1800, -6200), 'mining', [('mineshaft', 'مدخل المنجم', 6, 6, {}), ('shop', 'تاجر المعادن', 6, 5, {'shop': 'ores', 'sign': 'تاجر المعادن'})]),
         ('mine2', 'منجم الشمال', (3600, -8600), 'mining', [('mineshaft', 'مدخل المنجم', 6, 6, {})]),
         ('ice1', 'قرية الجليد', (-6500, -9400), 'chalet', [('shop', 'متجر القرية', 6, 5, {'shop': 'grocery', 'sign': 'متجر القرية'})]), ('ice2', 'قرية الثلج', (7000, -9500), 'chalet', []),
         ('oasis', 'واحة الصحراء', (9400, 3500), 'adobe', [('shop', 'سوق الواحة', 8, 6, {'shop': 'grocery', 'sign': 'سوق الواحة'}), ('caravanserai', 'الخان', 16, 16, {})]),
         ('hill1', 'قرية التلال', (3200, 3600), 'farm', []), ('hill2', 'قرية الوادي الأخضر', (-500, 2200), 'farm', [])]
    for sid, name, (x, z), style, extra in V:
        try: x, z = A.spot(x, z, 700, hmin=2.0 if style in ('stilt', 'fisher') else 6, hmax=700, flat_r=10, tries=1500)
        except RuntimeError: continue
        village(A, sid, name, x, z, style, 16 if style != 'stilt' else 12, r=130, extra=extra)
    bx, bz = A.spot(-200, 4500, 900, hmin=10, hmax=300, flat_r=14); military(A, 'base1', 'القاعدة الجنوبية', bx, bz)
    bx, bz = A.spot(2000, -8800, 900, hmin=10, hmax=500, flat_r=14); military(A, 'base2', 'القاعدة الشمالية', bx, bz)
    ox, oz = A.spot(VOLC[0] - 2600, VOLC[1] + 1200, 600, hmin=60, hmax=700, flat_r=10); military(A, 'observ', 'مرصد البركان', ox, oz, hx=70, hz=55)
    for sid, name, (x, z) in [('lab1', 'المختبر السري', (VOLC[0] - 3400, VOLC[1] - 1600)), ('lab2', 'مختبر الجليد', (-5500, -9600)), ('lab3', 'مختبر الصحراء', (10000, 5200))]:
        x, z = A.spot(x, z, 700, hmin=12, hmax=700, flat_r=10, tries=1500)
        lab(A, sid, name, x, z)
    # the lighthouses on the capes
    for sid, name, sel in [('light1', 'منارة الجنوب', lambda xs, zs: zs - np.abs(xs - 6000) * 0.3), ('light2', 'منارة الغرب', lambda xs, zs: -xs - np.abs(zs + 6000) * 0.3)]:
        m = (A.h > 5) & ~A.wet() & (np.abs(X) < PLAY - 400) & (np.abs(Z) < PLAY - 400); xs_ = X[m]; zs_ = Z[m]; k = int(np.argmax(sel(xs_, zs_)))
        L = lighthouse(A, float(xs_[k]), float(zs_[k]), name); L.d['id'] = sid
    # watchtowers on the heights, all over the continent
    for k, (x, z) in enumerate([(-1200, -3300), (2500, -5500), (-6000, -8000), (6200, -8800), (-9000, -4500), (-12000, 3500), (-7000, 6000), (-3000, 3600), (3000, 6000),
                                (6800, 1500), (9500, -1500), (10200, 6800), (9000, 11000), (-10500, 10500), (-1000, -9000), (4600, -3000), (9600, -9800), (-4000, -1200), (1000, 9600), (10200, -4200)]):
        try: tower(A, 'tower%d' % k, x, z)
        except RuntimeError: pass
    # lonely places
    for kind, name, (x, z) in [('castle', 'القلعة القديمة', (-7600, -6200)), ('castle', 'حصن الصحراء', (10400, 1200)), ('ruins', 'معبد الرمال', (9500, 4600)), ('ruins', 'أطلال الغابة', (-11500, -500)),
                               ('radio', 'برج الإرسال', (SUMMIT[0] + 60, SUMMIT[1] + 40)), ('radio', 'برج الشمال', (1500, -9000)), ('gas', 'محطة وقود الجنوب', (600, 9800)), ('gas', 'محطة وقود الشرق', (6500, 2500)),
                               ('gas', 'محطة وقود الغرب', (-6800, 5200)), ('camp', 'المعسكر المهجور', (8800, -2800)), ('camp', 'مخيم الصيادين', (-10800, 6800)), ('cabin', 'كوخ القمة', (SUMMIT[0] - 500, SUMMIT[1] + 600)),
                               ('cabin', 'كوخ البحيرة', (-6000, 3800)), ('cabin', 'كوخ الجليد', (-4500, -8700)), ('loggers', 'معسكر الحطابين', (-9500, -2600)), ('windfarm', 'مزرعة الرياح', (3500, 9600))]:
        try: x, z = A.spot(x, z, 500, hmin=3, hmax=1200, tries=900, grow=1)
        except RuntimeError: pass
        lonely(A, kind, name, x, z)
    # the secret island in the great lake: a cabin and a buried treasure
    A.poi('secret', 'الجزيرة السرية', LAKE[0] + 200, LAKE[1] - 100)
    A.extras['volcano'] = {'x': VOLC[0], 'z': VOLC[1], 'r': 520}
    A.extras['fog'] = True

def roads(A):
    g = A.gate
    A.R('الطريق السريع الشرقي', HW, [g('city', 'n'), A.poi('محطة وقود الجنوب'), g('farm1', 'w'), g('hill1', 's'), A.poi('محطة وقود الشرق'), g('volcity', 's')])
    A.R('الطريق السريع الغربي', HW, [g('city', 'n'), g('farm2', 'e'), A.poi('محطة وقود الغرب'), g('lake1', 's')])
    A.R('طريق البحيرة', RD, [g('lake1', 'w'), g('lake2', 'e')])
    A.R('طريق الغابة', HW, [g('lake2', 'n'), g('wood1', 's'), g('wood2', 'w')])
    A.R('طريق الجبل', HWM, [g('wood2', 'e'), g('mine1', 'w')])
    A.R('طريق القمة', ('road', 6.5, 0.12, 0.45), [g('mine1', 's'), A.poi('كوخ القمة')])
    A.R('طريق الشمال', HWM, [g('mine1', 'n'), A.poi('برج الشمال'), g('north', 's')])
    A.R('طريق الجليد', RD, [g('north', 's'), g('ice1', 'e')])
    A.R('طريق القاعدة الشمالية', RD, [g('north', 's'), g('base2', 'w'), g('mine2', 's')])
    A.R('طريق البركان', HWM, [g('mine2', 'e'), g('ice2', 's'), g('volcity', 'n')])
    A.R('طريق المرصد', RD, [g('volcity', 'e'), g('observ', 's')])
    A.R('طريق الصحراء', HW, [g('volcity', 'e'), g('ghost', 'w'), g('oasis', 'n')])
    A.R('طريق الوادي', HW, [g('oasis', 's'), g('canyontown', 'e')])
    A.R('طريق المزارع', RD, [g('farm1', 'e'), g('farm3', 'w')])
    A.R('طريق التلال', RD, [g('hill2', 's'), g('base1', 'n')])
    A.R('طريق القاعدة الجنوبية', RD, [g('base1', 's'), A.poi('محطة وقود الجنوب')])
    A.R('طريق المستنقع', RD, [g('farm2', 'w'), g('swamp1', 'e')])
    A.R('طريق الصنوبر', RD, [g('wood1', 'w'), g('wood3', 'n')])
    for name, a, b in [('درب القلعة', g('wood2', 'n'), A.poi('القلعة القديمة')), ('درب البرج', g('mine1', 'e'), A.poi('برج الإرسال')), ('درب الحطابين', g('wood1', 'n'), A.poi('معسكر الحطابين')),
                       ('درب المختبر', g('volcity', 'w'), A.poi('المختبر السري')), ('درب الأطلال', g('wood3', 's'), A.poi('أطلال الغابة')), ('درب المعبد', g('oasis', 'w'), A.poi('معبد الرمال')),
                       ('درب الحصن', g('oasis', 'e'), A.poi('حصن الصحراء')), ('درب مختبر الصحراء', g('canyontown', 'n'), A.poi('مختبر الصحراء')), ('درب مختبر الجليد', g('ice1', 'n'), A.poi('مختبر الجليد')),
                       ('درب المعسكر', g('volcity', 's'), A.poi('المعسكر المهجور')), ('درب الكوخ', g('lake1', 'e'), A.poi('كوخ البحيرة')), ('درب الرياح', g('farm3', 's'), A.poi('مزرعة الرياح')),
                       ('درب الصيادين', g('swamp1', 'n'), A.poi('مخيم الصيادين')), ('درب الجليد', g('ice1', 's'), A.poi('كوخ الجليد'))]:
        A.R(name, TR, [a, b])
    # the railway: from the capital's station up through the farmland and the range to the volcano city
    RAIL = ('rail', 3.4, 0.03, 0.12)
    st = lambda sid: [b for b in A.S[sid]['buildings'] if b.get('name') == 'محطة القطار']
    a = st('city'); b = st('volcity')
    pa = (a[0]['x'], a[0]['z'] - a[0]['hz'] - 6) if a else g('city', 'n'); pb = (b[0]['x'], b[0]['z'] + b[0]['hz'] + 6) if b else g('volcity', 's')
    r = A.R('سكة الحديد', RAIL, [pa, g('farm1', 's'), g('hill1', 'w'), pb])
    if r: r['train'] = True
    shaft = [b for b in A.S['mine1']['buildings'] if b.get('name') == 'مدخل المنجم']
    if shaft:
        sh = shaft[0]; r = A.R('سكة المنجم', ('rail', 3.0, 0.05, 0.2), [g('mine1', 'e'), (sh['x'] + sh['hx'] + 5, sh['z'])])
        if r: r['cart'] = True
    # suspension bridges over the canyon
    for name, t in [('الجسر المعلّق', 0.32), ('جسر الوادي', 0.68)]:
        span = canyon_span(A, t)
        if span: A.span(name, span[0], span[1])

def canyon_span(A, t):
    """two points on the canyon's rims, straight across from each other, at a fraction t along its spine"""
    pts = np.array(CANYON, float); seg = np.r_[0, np.cumsum(np.hypot(*np.diff(pts, axis=0).T))]; s = t * seg[-1]
    k = int(np.clip(np.searchsorted(seg, s) - 1, 0, len(pts) - 2)); u = (s - seg[k]) / (seg[k + 1] - seg[k])
    p = pts[k] + (pts[k + 1] - pts[k]) * u; d = (pts[k + 1] - pts[k]) / np.linalg.norm(pts[k + 1] - pts[k]); nrm = np.array([-d[1], d[0]])
    rims = []
    for sd in (-1, 1):
        for q in range(10, 160):
            x, z = p + nrm * sd * q * 4.0
            if A.hb(x, z) > 60: rims.append((float(x + nrm[0] * sd * 12), float(z + nrm[1] * sd * 12))); break
    return rims if len(rims) == 2 else None

def biomes(B):
    R = B.R; h = B.h; n1, n2, n3 = B.n1, B.n2, B.n3
    bio = np.full(h.shape, 11, np.int32)
    nb = fbm(X / 1800 + 2.2, Z / 1800 - 4.1, 4, seed=941); nc = fbm(X / 600, Z / 600, 3, seed=942)
    bio = np.where(R['forest'] + 0.35 * nb + 0.15 * nc > 0.45, 3, bio)
    bio = np.where((R['range'] + 0.45 * nb > 0.55) & (h < 520), 3, bio)
    bio = np.where((R['range'] > 0.3) & (nb < -0.15) & (h < 520), 11, bio)
    bio = np.where(R['farm'] + 0.2 * n2 > 0.5, 6, bio)
    bio = np.where(R['swamp'] + 0.3 * nb + 0.15 * nc > 0.5, 8, bio)
    bio = np.where(R['desert'] + R['canyonland'] * 0.9 + 0.3 * nb + 0.12 * nc > 0.5, 7, bio)
    northN = smooth(-6000, -10800, Z + 2400 * nb + 600 * nc)
    bio = np.where(northN > 0.45, 4, bio)
    bio = np.where((h > 560 + 60 * n1) & (R['volcano'] < 0.3), 5, bio)
    bio = np.where(R['volcano'] > 0.35, 10, bio)
    bio = np.where(R['capital'] > 0.5, 2, bio)
    bio = B.water_ids(bio)
    moist = np.clip(0.5 + 0.12 * n1 + R['forest'] * 0.2 + R['swamp'] * 0.4 - R['desert'] * 0.45 - R['canyonland'] * 0.35 - R['volcano'] * 0.25 + 0.2 * np.exp(-B.dWater / 160) * B.land, 0, 1)
    temp = np.clip(0.62 + 0.05 * n1 + (Z / HALF) * 0.1 - np.clip(h, 0, None) / 2600 - northN * 0.34 + R['desert'] * 0.2 + R['volcano'] * 0.25, 0, 1)
    fd = R['forest'] * 0.9 + R['range'] * (0.35 + 0.45 * smooth(-0.4, 0.4, nb)) * (1 - smooth(450, 560, h)) + northN * 0.45 + R['swamp'] * 0.45 + R['farm'] * 0.12 + R['lake'] * 0.4
    fd += (1 - np.clip(R['forest'] + R['range'] + R['farm'] + R['desert'] + R['north'], 0, 1)) * (0.45 + 0.3 * n1)
    fd *= 1 - np.clip(R['desert'] + R['canyonland'] * 0.8, 0, 1) * 0.94
    fd *= 1 - R['volcano'] * 0.9
    fd = B.finish_fd(fd, bio)
    cls = B.classes(bio, dunes=R['desert'])
    # the volcano: ash on its flanks, lava in the crater and in three flows down its sides
    dV = np.hypot(X - VOLC[0], Z - VOLC[1])
    ash = (dV < 2700 + 900 * nb + 350 * nc) & B.land & (h > 30)
    cls[ash & (cls == 0)] = 10
    lava = (dV < 360 + 30 * n3) & (h > 600)
    for ang in (0.6, 2.3, 4.4):
        along = (X - VOLC[0]) * np.cos(ang) + (Z - VOLC[1]) * np.sin(ang); across = -(X - VOLC[0]) * np.sin(ang) + (Z - VOLC[1]) * np.cos(ang)
        wid = 26 + 30 * smooth(500, 2600, along) + 18 * n3
        lava |= (along > 380) & (along < 2400 + 300 * n1) & (np.abs(across + 160 * np.sin(along / 300)) < wid) & B.land
    cls[lava] = 9
    fd[lava | ash] *= 0.1
    crop, fd, fields = B.fields(cls, fd, R['farm'], (-6000, 7000, 5000, 12500), n_max=160)
    return {'bio': bio, 'moist': moist, 'fd': fd, 'temp': temp, 'cls': cls, 'crop': crop, 'fields': fields}

def amp(R, h):
    return 0.5 + R['range'] * 0.9 + R['north'] * 0.4 + R['volcano'] * 0.5 + R['canyonland'] * 0.6 - R['farm'] * 0.3 - R['swamp'] * 0.3 - R['capital'] * 0.3

def spawn(P):
    c = [s for s in P['settlements'] if s['id'] == 'city'][0]; sq = c['squares'][0]
    return (sq['x'] + 6, sq['z'] + 16)
