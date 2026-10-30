# الغابات المجنونة — a 7 x 7 km island under one endless forest: giant old oaks in the middle, pine hills in the
# north-east, a misty swamp in the south-west, a great lake with a hidden island, and a river that falls through a gorge
import numpy as np
from common import *
import mg
from mg import soft, ellw, warp, spine_dist, coast, town, village, military, lighthouse, lonely, HW, RD, TR, HWM

NAME = 'الغابات المجنونة'
TARGET_LAND = 0.6
SEED = 7707
DROPS = 700000
ROAD_COST = {'swamp': 0.6, 'gorge': 1.5}
CLIMATE = {'temp': 0.55, 'weather': 'forest', 'treeScale': 1.3, 'fogBase': 0.25}
GORGE = [(2200, -1500), (1900, -900), (1500, -500), (1000, -250)]
_W = None
def _warp():
    global _W
    if _W is None: _W = warp(1500, 520, 701)
    return _W

def land_field():
    w = _warp()
    main = np.maximum.reduce([
        ellw(-100, 0, 2350, 2250, 0.15, w),
        ellw(1950, -1800, 1050, 820, -0.5, w),     # the pine hills
        ellw(-1900, 1600, 1100, 760, 0.5, w),      # the swamp lowland
        ellw(-2100, -1500, 820, 700, 0.2, w),
        ellw(1800, 1800, 900, 650, -0.3, w),
    ])
    bays = np.maximum.reduce([
        ellw(-250, 2750, 700, 560, 0.0, w),        # the southern bay
        ellw(2850, 200, 520, 900, 0.1, w),
        ellw(-2900, 100, 600, 700, 0.0, w),
        ellw(400, -2850, 700, 480, 0.2, w),
        ellw(-1300, -2750, 380, 600, -0.3, w),
        ellw(2700, 2600, 450, 380, 0.4, w),
    ])
    isl = np.maximum.reduce([ellw(3000, 2950, 300, 220, 0.4, w), ellw(-3000, -2950, 260, 300, 0.0, w), ellw(3050, -2900, 220, 170, 0.3, w), ellw(-2950, 2900, 280, 200, 0.2, w)])
    F = np.maximum(main - np.clip(bays, 0, None) * 2.4, isl)
    F += fbm(X / 1000, Z / 1000, 5, seed=702) * 0.2 + fbm(X / 250, Z / 250, 3, seed=703) * 0.06
    return F

def regions(land, dIn, dOut):
    w = (fbm(X / 1400 + 9.1, Z / 1400 - 2.2, 4, seed=711) * 420, fbm(X / 1400 - 4.4, Z / 1400 + 6.6, 4, seed=712) * 420)
    R = {}
    R['ancient'] = soft(-300, -700, 1700, 1300, 0.3, 0.7, warp=w)
    R['pines'] = soft(2000, -1800, 1300, 1000, -0.5, 0.6, warp=w)
    R['swamp'] = soft(-2000, 1600, 1200, 850, 0.5, 0.6, warp=w)
    R['lake'] = soft(300, 400, 900, 700, 0.2, 0.6, warp=w)
    R['town'] = soft(-300, 2350, 520, 330, 0.0, 0.6)
    dG, tG = spine_dist(GORGE)
    R['gorge'] = smooth(220, 60, dG + 30 * fbm(X / 260, Z / 260, 3, seed=713)).astype(np.float64)
    R['hills'] = np.clip(1 - R['swamp'] - R['lake'] * 0.8 - R['town'], 0, 1)
    return R

def relief(R, land, dIn, dOut):
    n1 = fbm(X / 1100, Z / 1100, 5, seed=721); n2 = fbm(X / 380, Z / 380, 4, seed=722)
    h = 3 + 28 * (1 - np.exp(-dIn / 520))
    inl = smooth(80, 900, dIn)
    h += R['hills'] * inl * (45 * (n1 * 0.5 + 0.5) + 35 * ridged(X / 800 + 2.2, Z / 800 + 8.8, 5, seed=723) + 10 * n2)
    h += R['pines'] * (80 + 90 * ridged(X / 900, Z / 900, 5, seed=724) + 20 * n2)
    h += R['ancient'] * (20 + 25 * (n1 * 0.5 + 0.5))
    # the gorge: steep walls, the river's floor stepping down towards the lake
    floor = 18 + 60 * smooth(1000, 2200, X) * (1 - R['lake'])
    h = h * (1 - R['gorge']) + R['gorge'] * np.minimum(h, floor)
    h = h * (1 - R['lake'] * 0.7) + R['lake'] * (12 + 5 * n2)
    h = h * (1 - R['swamp'] * 0.92) + R['swamp'] * (1.6 + 1.2 * fbm(X / 260, Z / 260, 4, seed=725))
    h = h * (1 - R['town'] * 0.7) + R['town'] * (3 + dIn * 0.02 + 2 * n2)
    cliffy = np.clip(R['pines'] + R['gorge'] * 0.5, 0, 1) * smooth(0.4, 0.6, fbm(X / 1600, Z / 1600, 3, seed=726) * 0.5 + 0.5)
    return coast(h, cliffy, land, dIn, dOut, beach=(50.0, 50.0))

def erodibility(R, h):
    return 0.55 + R['pines'] * 0.5 + R['gorge'] * 0.4 - R['swamp'] * 0.5 - R['lake'] * 0.3 - R['town'] * 0.3

def water(W):
    big = W.lake('البحيرة العظيمة', 300, 380, 520, 360, 0.2, depth=9.0, island=(380, 330, 110, 9.0))
    pl = W.lake('بحيرة الصنوبر', 2050, -1950, 160, 110, -0.5, depth=5.0)
    up = W.lake('بركة الغزلان', -1500, -1400, 120, 90, 0.4, depth=3.0)
    W.river('النهر الكبير', [(2100, -1800), (1950, -1000), (1500, -520), (900, 200)], 9, 16, start_level=pl, end_level=big, falls=[(1720, -760, 9.0), (1300, -420, 7.0)])
    W.river('نهر الجنوب', [(300, 750), (100, 1400), (-100, 2000)], 14, 26, start_level=big, end_level=0.0)
    W.river('جدول الغزلان', [(-1450, -1300), (-1600, -500), (-1900, 300), (-2600, 600)], 6, 12, start_level=up, end_level=0.0)
    W.lagoons(W_region('swamp'), level=1.05)

def W_region(name):
    return load('R_' + name).astype(np.float64)

def places(A):
    col = lambda x: A.h[:, int(round((x + HALF) / STEP))]
    shore = float(np.percentile([-HALF + np.where(col(x) > 0.5)[0].max() * STEP for x in np.arange(-700, -279, 10)], 30))
    town(A, 'city', 'بلدة النهر', -490.0, shore - 16 - 14 - 3 * 40, NX=5, NZ=3, BW=44.0, BD=40.0, style='farm', harbour=False, specials=[
        ('shop', 'ملابس الغابة', 7.5, 6, {'shop': 'clothes', 'sign': 'ملابس الغابة'}),
        ('shop', 'بقالة النهر', 8, 6.5, {'shop': 'grocery', 'sign': 'بقالة'}),
        ('shop', 'صيدلية الأعشاب', 6, 5, {'shop': 'pharmacy', 'sign': 'صيدلية'}),
        ('shop', 'عدد وأدوات', 7, 6, {'shop': 'tools', 'sign': 'عدد وأدوات'}),
        ('shop', 'الصيد والسلاح', 6.5, 5.5, {'shop': 'guns', 'sign': 'الصيد والسلاح'}),
        ('shop', 'معرض السيارات', 12, 8, {'shop': 'cars', 'sign': 'معرض السيارات', 'showroom': True}),
        ('shop', 'مقهى الطاحونة', 6.5, 5.5, {'shop': 'cafe', 'sign': 'مقهى الطاحونة', 'terrace': True}),
        ('shop', 'مخبز القرية', 5.5, 5, {'shop': 'bakery', 'sign': 'مخبز'}),
        ('shop', 'المصرف', 8, 6.5, {'shop': 'bank', 'sign': 'المصرف'}),
        ('hotel', 'نُزل الغابة', 11, 8, {'floors': 3, 'sign': 'نُزل الغابة'}),
        ('police', 'مركز الشرطة', 9, 7, {'sign': 'الشرطة'}),
        ('clinic', 'المستوصف', 9, 7, {'sign': 'المستوصف'}),
    ], kinds=('house', 'house', 'house', 'shopfront', 'apartment'), floors=(1, 2, 2))
    vx, vz = A.spot(-900, -600, 380, hmin=15, hmax=140, flat_r=8)
    village(A, 'village', 'قرية الحطابين', vx, vz, 'chalet', 20, r=130, extra=[('shop', 'متجر الحطابين', 6, 5, {'shop': 'tools', 'sign': 'عدد الحطابين'}), ('barn', 'المنشرة', 12, 8, {})])
    sx, sz = A.spot(-2000, 1500, 400, hmin=1.4, hmax=6, flat_r=6)
    village(A, 'swamp', 'قرية المستنقع', sx, sz, 'stilt', 12, r=110)
    mx, mz = A.spot(2100, -1300, 380, hmin=40, hmax=260, flat_r=8)
    village(A, 'mine', 'بلدة المنجم', mx, mz, 'mining', 10, r=100, extra=[('mineshaft', 'مدخل المنجم', 6, 6, {}), ('shop', 'تاجر المعادن', 6, 5, {'shop': 'ores', 'sign': 'تاجر المعادن'})])
    rx, rz = A.spot(1400, 1500, 400, hmin=8, hmax=160, flat_r=10)
    military(A, 'base', 'محطة الحرّاس', rx, rz, hx=80, hz=65)
    fx, fz = A.spot(2300, 2200, 400, hmin=1.8, hmax=20)
    village(A, 'fisher', 'قرية الصيادين', fx, fz, 'fisher', 9, r=75)
    landm = (A.h > 6) & ~A.wet() & (np.abs(Z) < 1200) & (np.abs(X) < PLAY * 0.9); xs_ = X[landm]; zs_ = Z[landm]; k = int(np.argmin(xs_ + np.abs(zs_) * 0.3))
    lighthouse(A, float(xs_[k]) + 30, float(zs_[k]), 'منارة الغرب')
    for kind, name, (x, z), hmax in [('radio', 'برج المراقبة', (600, -1700), 400), ('castle', 'القلعة المنسية', (-2200, -1700), 250), ('camp', 'المعسكر المهجور', (1000, 2500), 200),
                                     ('cabin', 'كوخ الصياد', (-300, -1900), 300), ('cabin', 'كوخ الغابة', (-1200, 600), 200), ('cabin', 'كوخ الشلال', (1600, -900), 300),
                                     ('loggers', 'معسكر الحطابين', (-200, -1200), 300), ('ruins', 'معبد الغابة', (800, -900), 300)]:
        try: x, z = A.spot(x, z, 260, hmin=3, hmax=hmax, tries=900)
        except RuntimeError: pass
        lonely(A, kind, name, x, z)

def roads(A):
    A.R('طريق الغابة الكبير', HW, [A.gate('city', 'n'), A.poi('كوخ الغابة'), A.gate('village', 's')])
    A.R('طريق المستنقع', RD, [A.gate('city', 'w'), A.gate('swamp', 'e')])
    A.R('طريق الحرّاس', HW, [A.gate('city', 'e'), A.gate('base', 'w')])
    A.R('طريق الجبل', HWM, [A.gate('base', 'n'), A.gate('mine', 's')])
    A.R('طريق الصيادين', RD, [A.gate('base', 'e'), A.gate('fisher', 'w')])
    A.R('درب البرج', TR, [A.gate('village', 'e'), A.poi('معسكر الحطابين'), A.poi('برج المراقبة')])
    A.R('درب القلعة', TR, [A.gate('village', 'w'), A.poi('القلعة المنسية')])
    A.R('درب المنارة', TR, [A.gate('swamp', 'n'), A.poi('منارة الغرب')])
    A.R('درب الشلال', TR, [A.gate('mine', 'w'), A.poi('كوخ الشلال'), A.poi('معبد الغابة')])
    A.R('درب المعسكر', TR, [A.gate('city', 'e'), A.poi('المعسكر المهجور')])
    A.R('درب الصياد', TR, [A.gate('village', 'n'), A.poi('كوخ الصياد')])

def biomes(B):
    R = B.R; h = B.h; n1, n2 = B.n1, B.n2
    bio = np.full(h.shape, 3, np.int32)
    bio = np.where(R['pines'] + 0.25 * n1 > 0.45, 4, bio)
    bio = np.where(R['swamp'] + 0.2 * n2 > 0.5, 8, bio)
    bio = np.where((R['town'] > 0.5) | ((R['lake'] > 0.55) & (n2 > 0.15)), 11, bio)
    bio = np.where(h > 320 + 30 * n1, 5, bio)
    bio = B.water_ids(bio)
    moist = np.clip(0.62 + 0.12 * n1 + R['swamp'] * 0.3 + 0.2 * np.exp(-B.dWater / 100) * B.land, 0, 1)
    temp = np.clip(0.6 + 0.06 * n1 + (Z / HALF) * 0.05 - np.clip(h, 0, None) / 1500, 0, 1)
    fd = 0.82 + 0.2 * n1 + R['ancient'] * 0.25 - R['town'] * 0.6 - R['lake'] * 0.25
    fd = B.finish_fd(fd, bio, glades=False) * smooth(-0.55, -0.3, n2 + 0.2 * B.n3)      # a few glades, the rest is wood
    cls = B.classes(bio)
    return {'bio': bio, 'moist': moist, 'fd': fd, 'temp': temp, 'cls': cls}

def amp(R, h):
    return 0.5 + R['pines'] * 0.7 + R['gorge'] * 0.5 - R['swamp'] * 0.3 - R['town'] * 0.3

def spawn(P):
    c = [s for s in P['settlements'] if s['id'] == 'city'][0]; sq = c['squares'][0]
    return (sq['x'] + 6, sq['z'] + 16)
