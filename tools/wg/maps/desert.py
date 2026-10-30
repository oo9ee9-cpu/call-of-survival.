# الصحراء القاحلة — a 4 x 4 km desert island: a dune sea, sandstone mesas cut by a dry canyon, an oasis with palms,
# a port town of mud-brick on the north bay, a salt flat with its mine, an old fort and a buried temple
import numpy as np
from common import *
import mg
from mg import soft, ellw, warp, spine_dist, coast, town, village, military, lighthouse, lonely, HW, RD, TR, HWM

NAME = 'الصحراء القاحلة'
TARGET_LAND = 0.56
SEED = 4404
DROPS = 260000
ROAD_COST = {'erg': 0.35, 'mesa': 0.25}
CLIMATE = {'temp': 0.85, 'weather': 'desert', 'sand': True}
WARP = None

def _warp():
    global WARP
    if WARP is None: WARP = warp(1100, 330, 401)
    return WARP

def land_field():
    w = _warp()
    main = np.maximum.reduce([
        ellw(-80, 180, 1380, 1180, 0.15, w),        # the body of the island
        ellw(1350, -380, 760, 380, 0.35, w),        # the rocky east cape
        ellw(-1450, 480, 640, 230, -0.6, w),        # the western sand spit
        ellw(-650, 1250, 820, 520, 0.05, w),        # the southern dunes
        ellw(-950, -700, 640, 470, 0.25, w),        # the north-west shoulder
        ellw(550, -950, 520, 380, -0.2, w),         # the north-east shore
    ])
    bays = np.maximum.reduce([
        ellw(-230, -1180, 470, 330, 0.05, w),       # the harbour bay
        ellw(950, 1350, 430, 330, -0.3, w),         # the south-east cove
        ellw(-1700, -150, 330, 420, 0.2, w),        # the west inlet
        ellw(1700, 650, 300, 380, 0.1, w),          # the east bight
    ])
    islets = np.maximum.reduce([ellw(1500, 1550, 190, 140, 0.3, w), ellw(-1650, -1400, 210, 150, 0.5, w), ellw(700, -1700, 130, 100, 0.0, w), ellw(-1750, 1500, 140, 110, 0.0, w)])
    F = np.maximum(main - np.clip(bays, 0, None) * 2.4, islets)
    F += fbm(X / 700, Z / 700, 5, seed=402) * 0.18 + fbm(X / 180, Z / 180, 3, seed=403) * 0.05
    return F

WADI = [(560, -760), (820, -540), (980, -300), (1230, -230), (1440, -20), (1740, 110)]

def regions(land, dIn, dOut):
    w = (fbm(X / 900 + 9.1, Z / 900 - 2.2, 4, seed=411) * 300, fbm(X / 900 - 4.4, Z / 900 + 6.6, 4, seed=412) * 300)
    R = {}
    R['erg'] = soft(-450, 700, 1350, 950, 0.3, warp=w)
    R['mesa'] = soft(1100, -250, 820, 700, 0.4, warp=w)
    R['oasis'] = soft(-150, -250, 420, 330, 0.0, 0.6)
    R['town'] = soft(-250, -880, 520, 320, 0.0, 0.6)
    R['salt'] = soft(620, 880, 430, 260, -0.2, 0.4, warp=w)
    R['erg'] = R['erg'] * (1 - R['oasis']) * (1 - R['town']) * (1 - R['salt'])
    dW, tW = spine_dist(WADI)
    R['wadi'] = smooth(140, 40, dW + 30 * fbm(X / 260, Z / 260, 3, seed=413)).astype(np.float64)
    return R

def relief(R, land, dIn, dOut):
    n1 = fbm(X / 900, Z / 900, 5, seed=421); n2 = fbm(X / 300, Z / 300, 4, seed=422)
    h = 2 + 22 * (1 - np.exp(-dIn / 420)) + 6 * (n1 * 0.5 + 0.5)
    # the dune sea: long transverse ridges with soft crests, crossed by a second set
    ang = 0.65; u = X * np.cos(ang) + Z * np.sin(ang); wv = fbm(X / 700, Z / 700, 3, seed=423) * 3.0
    lam = 62 + 40 * (fbm(X / 1500, Z / 1500, 2, seed=424) * 0.5 + 0.5)
    ph = u / lam + wv + 0.8 * fbm(X / 240, Z / 240, 3, seed=425)
    big = (8 + 22 * (fbm(X / 1200, Z / 1200, 3, seed=426) * 0.5 + 0.5))
    dunes = (1 - np.abs(np.sin(ph))) ** 1.8 * big * smooth(-0.3, 0.25, fbm(X / 450, Z / 450, 3, seed=427))
    u2 = X * np.cos(ang + 1.2) + Z * np.sin(ang + 1.2)
    dunes += (1 - np.abs(np.sin(u2 / (lam * 1.7) + wv * 0.5))) ** 3 * big * 0.35
    h = h * (1 - R['erg'] * 0.55) + R['erg'] * (10 + dunes)
    # the mesas: flat-topped sandstone tables in three steps
    mn = fbm(X / 600 + 3, Z / 600 - 1, 4, seed=428) * 0.5 + 0.5
    mesa = smooth(0.52, 0.555, mn) * 38 + smooth(0.64, 0.665, mn) * 30 + smooth(0.76, 0.78, mn) * 22
    h = h * (1 - R['mesa'] * 0.55) + R['mesa'] * (14 + mesa + 4 * n2)
    # the dry canyon: a flat sandy floor between steep walls
    floor = 5.5 + 1.5 * n2
    h = h * (1 - R['wadi']) + R['wadi'] * np.minimum(h, floor + (1 - R['wadi']) * 40)
    # the oasis basin, the town slope, the salt flat
    h = h * (1 - R['oasis'] * 0.85) + R['oasis'] * (4.5 + 2 * n2)
    h = h * (1 - R['town'] * 0.75) + R['town'] * (2.5 + dIn * 0.02 + 2 * n2)
    h = h * (1 - R['salt'] * 0.96) + R['salt'] * (2.2 + 0.12 * n2)
    cliffy = np.clip(R['mesa'] * 1.5, 0, 1) * smooth(0.4, 0.6, fbm(X / 900, Z / 900, 3, seed=429) * 0.5 + 0.5)
    return coast(h, cliffy, land, dIn, dOut, beach=(80.0, 70.0))

def erodibility(R, h):
    return 0.35 + 0.5 * R['mesa'] - 0.3 * R['erg'] - 0.3 * R['salt'] - 0.2 * R['oasis']

def water(W):
    W.lake('واحة السراب', -150, -250, 125, 92, 0.3, depth=4.0)
    W.lake('عين الصحراء', -830, 1010, 34, 26, 0.0, depth=2.0)

def coast_z(A, x):
    col = A.h[:, int(round((x + HALF) / STEP))]
    return -HALF + int(np.argmax(col > 0.5)) * STEP

def places(A):
    zt = float(np.percentile([coast_z(A, x) for x in np.arange(-450, 51, 10)], 70)) + 16
    town(A, 'city', 'مدينة الرمال', -200.0, zt, NX=5, NZ=3, BW=44.0, BD=40.0, style='adobe', piers=2, specials=[
        ('mosque', 'جامع الرمال', 11, 11, {'minaret': True}),
        ('shop', 'سوق الأقمشة', 7.5, 6, {'shop': 'clothes', 'sign': 'سوق الأقمشة'}),
        ('shop', 'بقالة الواحة', 8, 6.5, {'shop': 'grocery', 'sign': 'بقالة'}),
        ('shop', 'صيدلية الرمال', 6, 5, {'shop': 'pharmacy', 'sign': 'صيدلية'}),
        ('shop', 'عدد وأدوات', 7, 6, {'shop': 'tools', 'sign': 'عدد وأدوات'}),
        ('shop', 'الصيد والسلاح', 6.5, 5.5, {'shop': 'guns', 'sign': 'الصيد والسلاح'}),
        ('shop', 'معرض السيارات', 12, 8, {'shop': 'cars', 'sign': 'معرض السيارات', 'showroom': True}),
        ('shop', 'مقهى القافلة', 6.5, 5.5, {'shop': 'cafe', 'sign': 'مقهى القافلة', 'terrace': True}),
        ('shop', 'مخبز التنور', 5.5, 5, {'shop': 'bakery', 'sign': 'مخبز'}),
        ('hotel', 'فندق الكثبان', 11, 8, {'floors': 3, 'sign': 'فندق الكثبان'}),
        ('police', 'مركز الشرطة', 9, 7, {'sign': 'الشرطة'}),
        ('clinic', 'المستوصف', 9, 7, {'sign': 'المستوصف'}),
    ], kinds=('house', 'house', 'house', 'apartment', 'shopfront'), floors=(1, 1, 2, 2, 3))
    village(A, 'oasis', 'واحة النخيل', -150.0, 25.0, 'adobe', 18, r=130, extra=[
        ('shop', 'سوق الواحة', 8, 6, {'shop': 'grocery', 'sign': 'سوق الواحة'}), ('caravanserai', 'الخان القديم', 16, 16, {})])
    fx, fz = A.spot(-1420, 470, 160, hmin=1.6, hmax=12)
    village(A, 'fisher', 'قرية الصيادين', fx, fz, 'fisher', 9, r=70)
    sx, sz = A.spot(620, 1080, 140, hmin=2.0, hmax=14)
    village(A, 'mine', 'منجم الملح', sx, sz, 'mining', 10, r=100, extra=[('mineshaft', 'مدخل المنجم', 6, 6, {}), ('shop', 'تاجر الملح', 6, 5, {'shop': 'ores', 'sign': 'تاجر الملح والمعادن'})])
    bx, bz = A.spot(260, 420, 220, hmin=4, hmax=60, flat_r=10)
    military(A, 'base', 'قاعدة الصحراء', bx, bz, hx=110, hz=85)
    # the lighthouse on the far east cape
    landm = (A.h > 5) & ~A.wet(); xs_ = X[landm]; zs_ = Z[landm]; k = int(np.argmax(xs_ - zs_ * 0.2))
    lx, lz = float(xs_[k]) - 30, float(zs_[k])
    lighthouse(A, lx, lz, 'منارة الرأس')
    for kind, name, (x, z) in [('castle', 'القلعة القديمة', (-1180, -420)), ('ruins', 'معبد الرمال', (-930, 1110)), ('radio', 'برج الإرسال', (1180, -380)),
                               ('gas', 'محطة وقود الصحراء', (-260, 640)), ('camp', 'مخيم البدو', (1120, 1180)), ('cabin', 'كوخ الصياد', (-1300, 250)),
                               ('cabin', 'استراحة القافلة', (420, -560)), ('windfarm', 'مزرعة الرياح', (-1000, -850))]:
        try: x, z = A.spot(x, z, 90, hmin=2.5, hmax=120, tries=800)
        except RuntimeError: pass
        lonely(A, kind, name, x, z)

def roads(A):
    A.R('طريق الواحة', HW, [A.gate('city', 'sw'), A.gate('oasis', 'n')])
    A.R('طريق الجنوب', HW, [A.gate('oasis', 's'), A.poi('محطة وقود الصحراء'), A.gate('base', 'n')])
    A.R('طريق الملح', HW, [A.gate('base', 's'), A.gate('mine', 'w')])
    A.R('طريق الرأس', RD, [A.gate('city', 'se'), A.poi('استراحة القافلة'), A.poi('منارة الرأس')])
    A.R('طريق الساحل الغربي', RD, [A.gate('city', 'w'), A.gate('fisher', 'n')])
    A.R('درب القلعة', TR, [A.gate('oasis', 'w'), A.poi('القلعة القديمة')])
    A.R('درب المعبد', TR, [A.gate('fisher', 's'), A.poi('معبد الرمال')])
    A.R('درب البرج', TR, [A.poi('استراحة القافلة'), A.poi('برج الإرسال')])
    A.R('درب البدو', TR, [A.gate('mine', 'e'), A.poi('مخيم البدو')])
    A.R('درب الرياح', TR, [A.gate('city', 'w'), A.poi('مزرعة الرياح')])

def biomes(B):
    R = B.R; h = B.h; n1, n2 = B.n1, B.n2
    bio = np.full(h.shape, 7, np.int32)
    ring = R['oasis'] + 0.18 * n2 + 0.1 * B.n3                        # the oasis edge is ragged, not a circle
    bio = np.where(ring > 0.42, 9, bio)
    bio = np.where((ring > 0.28) & (ring <= 0.42), 11, bio)
    bio = B.water_ids(bio)
    moist = np.clip(0.12 + 0.05 * n1 + R['oasis'] * 0.6 + 0.3 * np.exp(-B.dWater / 60) * B.land, 0, 1)
    temp = np.clip(0.86 + 0.04 * n1 - np.clip(h, 0, None) / 900, 0, 1)
    fd = R['oasis'] * (0.55 + 0.25 * n2) + R['mesa'] * 0.06 + 0.02
    fd = B.finish_fd(fd, bio, glades=False)
    cls = B.classes(bio, dunes=R['erg'])
    cls[(R['salt'] > 0.5) & B.land] = 3
    cls[(R['wadi'] > 0.6) & B.land & (h < 12)] = 5
    farm = (R['oasis'] > 0.25) & (R['oasis'] < 0.75)
    crop, fd, fields = B.fields(cls, fd, farm.astype(np.float64), (-700, 400, -700, 250), n_max=10, crops=['wheat', 'barley', 'tomato', 'carrot', 'corn'])
    return {'bio': bio, 'moist': moist, 'fd': fd, 'temp': temp, 'cls': cls, 'crop': crop, 'fields': fields}

def amp(R, h):
    return 0.35 + R['mesa'] * 0.7 - R['erg'] * 0.2 - R['salt'] * 0.3 - R['town'] * 0.25

def spawn(P):
    c = [s for s in P['settlements'] if s['id'] == 'city'][0]; sq = c['squares'][0]
    return (sq['x'] + 6, sq['z'] + 16)
