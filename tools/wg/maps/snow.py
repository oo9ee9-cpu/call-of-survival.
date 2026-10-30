# أرض الثلج — a 6 x 6 km island of the far north: a spine of snowy peaks, dark taiga in the lowlands, fjords on the
# north shore, frozen lakes you can walk across, a river that never quite freezes, a harbour town of timber houses
import numpy as np
from common import *
import mg
from mg import soft, ellw, warp, spine_dist, coast, town, village, military, lighthouse, lonely, HW, RD, TR, HWM

NAME = 'أرض الثلج'
TARGET_LAND = 0.55
SEED = 6606
DROPS = 650000
ROAD_COST = {'mount': 0.6}
CLIMATE = {'temp': 0.22, 'weather': 'snow'}
SPINE = [(950, -2350), (700, -1400), (1150, -400), (850, 650), (1350, 1650)]
VALLEY = [(-400, -1700), (150, -1250), (500, -700), (700, -150)]
_W = None
def _warp():
    global _W
    if _W is None: _W = warp(1300, 520, 501)
    return _W

def land_field():
    w = _warp()
    main = np.maximum.reduce([
        ellw(-150, 50, 2050, 1950, 0.1, w),
        ellw(1500, -1650, 950, 720, -0.5, w),      # the north-east highland
        ellw(-1750, 1250, 950, 620, 0.6, w),       # the south-west peninsula
        ellw(-1900, -1400, 760, 640, 0.2, w),      # the north-west cape
        ellw(1700, 1300, 800, 650, -0.3, w),       # the south-east shoulder
    ])
    bays = np.maximum.reduce([
        ellw(-700, -2250, 230, 1050, 0.15, w),     # fjords cut deep into the north shore
        ellw(250, -2350, 200, 900, -0.1, w),
        ellw(-1500, -2150, 190, 800, 0.35, w),
        ellw(1050, -2450, 170, 650, -0.25, w),
        ellw(300, 2300, 620, 420, 0.0, w),         # the harbour bay in the south
        ellw(2450, 300, 330, 800, 0.1, w),         # an eastern sound
        ellw(-2500, 200, 420, 300, 0.0, w),        # a western bay
    ])
    isl = np.maximum.reduce([ellw(2450, 2350, 280, 210, 0.4, w), ellw(-2650, -350, 240, 320, 0.0, w), ellw(2600, -2550, 220, 170, 0.3, w), ellw(-1150, 2600, 240, 150, 0.0, w), ellw(-2500, 2500, 200, 160, 0.5, w)])
    F = np.maximum(main - np.clip(bays, 0, None) * 2.6, isl)
    F += fbm(X / 900, Z / 900, 5, seed=502) * 0.2 + fbm(X / 220, Z / 220, 3, seed=503) * 0.06
    return F

def regions(land, dIn, dOut):
    w = (fbm(X / 1300 + 9.1, Z / 1300 - 2.2, 4, seed=511) * 380, fbm(X / 1300 - 4.4, Z / 1300 + 6.6, 4, seed=512) * 380)
    R = {}
    dS, tS = spine_dist(SPINE)
    R['mount'] = np.exp(-(np.maximum(0, dS + 200 * fbm(X / 800, Z / 800, 3, seed=513)) / 900) ** 2)
    R['ne'] = soft(1700, -1800, 1000, 750, -0.5, warp=w)
    R['taiga'] = np.clip(1 - R['mount'] * 1.2, 0, 1) * soft(-600, 200, 2400, 2300, 0.0, 0.8, warp=w)
    R['town'] = soft(250, 2150, 520, 320, 0.0, 0.6)
    R['lakes'] = soft(-900, 250, 700, 520, 0.2, 0.6, warp=w)
    dV, tV = spine_dist(VALLEY)
    R['valley'] = smooth(260, 90, dV + 40 * fbm(X / 300, Z / 300, 3, seed=514)).astype(np.float64)
    return R

def relief(R, land, dIn, dOut):
    n1 = fbm(X / 1100, Z / 1100, 5, seed=521); n2 = fbm(X / 380, Z / 380, 4, seed=522)
    rid = ridged(X / 1400 + 7.1, Z / 1400 - 3.3, 6, seed=523)
    h = 3 + 30 * (1 - np.exp(-dIn / 500))
    inl = smooth(80, 900, dIn)
    h += inl * (34 * (n1 * 0.5 + 0.5) + 22 * ridged(X / 650 + 2.2, Z / 650 + 8.8, 4, seed=524) + 8 * n2)
    h += inl * 55 * smooth(0.15, 0.6, fbm(X / 1700 + 5.5, Z / 1700 - 2.5, 3, seed=528))     # rolling fells
    peaks = 0.45 + 0.55 * smooth(-0.35, 0.45, fbm(X / 950 + 1.7, Z / 950 - 0.4, 3, seed=525))
    h += R['mount'] * (70 + peaks * 400 * rid + 22 * n2)
    h += R['ne'] * (90 + 60 * (n1 * 0.5 + 0.5) + 25 * ridged(X / 600, Z / 600, 4, seed=526))
    # a glacial valley: a broad U-shaped floor between the heights
    floor = 40 + 25 * smooth(-1, 1, n1)
    h = h * (1 - R['valley'] * 0.85) + R['valley'] * np.minimum(h, floor + 10 * n2)
    # the lake basin and the town slope
    h = h * (1 - R['lakes'] * 0.6) + R['lakes'] * (14 + 6 * n2)
    h = h * (1 - R['town'] * 0.7) + R['town'] * (2.5 + dIn * 0.02 + 3 * n2)
    cliffy = np.clip(R['mount'] * 1.3 + R['ne'] + smooth(-1600, -2600, Z) * 0.8, 0, 1) * smooth(0.4, 0.58, fbm(X / 1600, Z / 1600, 3, seed=527) * 0.5 + 0.5)
    return coast(h, cliffy, land, dIn, dOut, beach=(45.0, 40.0))

def erodibility(R, h):
    return 0.55 + R['mount'] * 0.6 + R['ne'] * 0.4 - R['lakes'] * 0.3 - R['town'] * 0.3

def water(W):
    W.lake('البحيرة المتجمدة', -950, 250, 430, 270, 0.25, frozen=True)
    W.lake('بحيرة الجليد', -250, -1250, 170, 120, 0.6, frozen=True)
    W.lake('بحيرة القمة', 1750, -1900, 160, 110, -0.4, frozen=True)
    top = W.lake('بحيرة المنبع', 950, -650, 120, 90, 0.2, depth=4.0)
    W.river('النهر البارد', [(900, -560), (600, 200), (450, 1000), (500, 1700), (300, 2500)], 8, 20, start_level=top, end_level=0.0)

def coast_z_south(A, x):
    col = A.h[:, int(round((x + HALF) / STEP))]
    idx = np.where(col > 0.5)[0]
    return -HALF + idx.max() * STEP

def places(A):
    # the harbour town faces south: build it as a grid just inland of the bay shore
    zs = float(np.percentile([coast_z_south(A, x) for x in np.arange(50, 451, 10)], 30)) - 16 - 14 - 3 * 40
    town(A, 'city', 'بلدة الجليد', 250.0, zs, NX=5, NZ=3, BW=44.0, BD=40.0, style='chalet', harbour=False, specials=[
        ('shop', 'ملابس الشتاء', 7.5, 6, {'shop': 'clothes', 'sign': 'ملابس الشتاء'}),
        ('shop', 'بقالة الشمال', 8, 6.5, {'shop': 'grocery', 'sign': 'بقالة'}),
        ('shop', 'صيدلية الثلج', 6, 5, {'shop': 'pharmacy', 'sign': 'صيدلية'}),
        ('shop', 'عدد وأدوات', 7, 6, {'shop': 'tools', 'sign': 'عدد وأدوات'}),
        ('shop', 'الصيد والسلاح', 6.5, 5.5, {'shop': 'guns', 'sign': 'الصيد والسلاح'}),
        ('shop', 'معرض السيارات', 12, 8, {'shop': 'cars', 'sign': 'معرض السيارات', 'showroom': True}),
        ('shop', 'مقهى المدفأة', 6.5, 5.5, {'shop': 'cafe', 'sign': 'مقهى المدفأة', 'terrace': True}),
        ('shop', 'مخبز الحطب', 5.5, 5, {'shop': 'bakery', 'sign': 'مخبز'}),
        ('shop', 'المصرف', 8, 6.5, {'shop': 'bank', 'sign': 'المصرف'}),
        ('lodge', 'فندق الشفق', 11, 8, {'floors': 3, 'sign': 'فندق الشفق'}),
        ('police', 'مركز الشرطة', 9, 7, {'sign': 'الشرطة'}),
        ('clinic', 'المستوصف', 9, 7, {'sign': 'المستوصف'}),
    ], kinds=('house', 'house', 'house', 'shopfront'), floors=(1, 2, 2))
    vx, vz = A.spot(150, -1150, 260, hmin=20, hmax=160, flat_r=8)
    village(A, 'village', 'قرية الثلج', vx, vz, 'chalet', 20, r=140, road_axis='z', extra=[('shop', 'متجر القرية', 6, 5, {'shop': 'grocery', 'sign': 'متجر القرية'})])
    lx, lz = A.spot(1500, 300, 400, hmin=60, hmax=300, flat_r=8)
    village(A, 'lodge', 'نُزل التزلج', lx, lz, 'chalet', 8, r=100, extra=[('lodge', 'نُزل التزلج', 12, 9, {'floors': 2, 'sign': 'نُزل التزلج'}), ('shop', 'متجر الجبل', 6, 5, {'shop': 'clothes', 'sign': 'ملابس الجبل'})])
    rx, rz = A.spot(1900, -1500, 350, hmin=60, hmax=320, flat_r=10)
    military(A, 'base', 'محطة الأبحاث القطبية', rx, rz, hx=100, hz=80)
    fx, fz = A.spot(-2300, 300, 300, hmin=1.8, hmax=20)
    village(A, 'fisher', 'قرية الصيادين', fx, fz, 'fisher', 10, r=75)
    mx, mz = A.spot(-1500, 1300, 300, hmin=8, hmax=120, flat_r=8)
    village(A, 'mine', 'بلدة المنجم', mx, mz, 'mining', 10, r=100, extra=[('mineshaft', 'مدخل المنجم', 6, 6, {}), ('shop', 'تاجر المعادن', 6, 5, {'shop': 'ores', 'sign': 'تاجر المعادن'})])
    landm = (A.h > 6) & ~A.wet(); xs_ = X[landm]; zs_ = Z[landm]; k = int(np.argmin(zs_ + np.abs(xs_ + 1800) * 0.4))
    lighthouse(A, float(xs_[k]), float(zs_[k]) + 30, 'منارة الشمال')
    peak = None
    for kind, name, (x, z), hmax in [('radio', 'برج الإرسال', (1000, -900), 520), ('castle', 'حصن الشمال', (-1700, -1300), 200), ('camp', 'المعسكر المهجور', (-400, 1400), 200),
                                     ('cabin', 'كوخ الصياد', (-1300, -500), 200), ('cabin', 'كوخ الحطاب', (1150, 1000), 260), ('cabin', 'ملجأ الجبل', (1300, -2100), 500),
                                     ('loggers', 'معسكر الحطابين', (-500, -400), 200), ('windfarm', 'مزرعة الرياح', (-2100, -1900), 200)]:
        try: x, z = A.spot(x, z, 220, hmin=3, hmax=hmax, tries=900)
        except RuntimeError: pass
        lonely(A, kind, name, x, z)

def roads(A):
    A.R('الطريق الشمالي', HWM, [A.gate('city', 'n'), A.gate('village', 's')])
    A.R('طريق الساحل الغربي', HW, [A.gate('city', 'w'), A.gate('mine', 'e'), A.gate('fisher', 'e')])
    A.R('طريق النُّزل', HWM, [A.gate('city', 'e'), A.gate('lodge', 's')])
    A.R('طريق المحطة', ('road', 6.5, 0.1, 0.4), [A.gate('lodge', 'n'), A.gate('base', 's')])
    A.R('طريق البحيرة', RD, [A.gate('village', 'w'), A.poi('كوخ الصياد'), A.poi('حصن الشمال')])
    A.R('درب المنارة', TR, [A.poi('حصن الشمال'), A.poi('منارة الشمال')])
    A.R('درب البرج', TR, [A.gate('village', 'e'), A.poi('برج الإرسال')])
    A.R('درب الحطابين', TR, [A.gate('village', 's'), A.poi('معسكر الحطابين')])
    A.R('درب المعسكر', TR, [A.gate('city', 'w'), A.poi('المعسكر المهجور')])
    A.R('درب الرياح', TR, [A.gate('fisher', 'n'), A.poi('مزرعة الرياح')])
    A.R('درب الكوخ', TR, [A.gate('lodge', 'w'), A.poi('كوخ الحطاب')])

def biomes(B):
    R = B.R; h = B.h; n1, n2 = B.n1, B.n2
    bio = np.full(h.shape, 4, np.int32)
    bio = np.where(((R['taiga'] + 0.35 * n1 < 0.45) | (B.n3 + 0.4 * n2 > 0.42)) & (h < 200), 11, bio)      # open snowfields among the woods
    bio = np.where((R['mount'] > 0.55) | (h > 260 + 40 * n1), 5, bio)
    bio = np.where(R['town'] > 0.5, 11, bio)
    bio = B.water_ids(bio)
    moist = np.clip(0.55 + 0.12 * n1 + 0.2 * np.exp(-B.dWater / 100) * B.land, 0, 1)
    temp = np.clip(0.24 + 0.05 * n1 - np.clip(h, 0, None) / 2400, 0, 1)
    fd = R['taiga'] * (0.72 + 0.25 * n1) + R['mount'] * (0.5 + 0.3 * n1) * (1 - smooth(200, 300, h)) + R['ne'] * 0.35
    fd += (1 - np.clip(R['taiga'] + R['mount'], 0, 1)) * (0.3 + 0.3 * n1)
    fd = B.finish_fd(fd, bio)
    cls = B.classes(bio)
    return {'bio': bio, 'moist': moist, 'fd': fd, 'temp': temp, 'cls': cls}

def amp(R, h):
    return 0.45 + R['mount'] * 0.9 + R['ne'] * 0.5 - R['town'] * 0.3 - R['lakes'] * 0.2

def spawn(P):
    c = [s for s in P['settlements'] if s['id'] == 'city'][0]; sq = c['squares'][0]
    return (sq['x'] + 6, sq['z'] + 16)
