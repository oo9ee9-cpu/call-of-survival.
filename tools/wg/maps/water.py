# عالم الماء — 3 x 3 km of open sea: a harbour island, a palm island with its lighthouse, a rocky isle with an old fort,
# a village of houses on posts over the shallows, a pirates' nest of platforms, and warships at anchor whose crews never sleep
import numpy as np
from common import *
import mg
from mg import soft, ellw, warp, spine_dist, coast, village, lighthouse, lonely, Layout, HW, RD, TR

NAME = 'عالم الماء'
TARGET_LAND = 0.11
SEED = 3303
DROPS = 200000
MIN_ISLAND = 120
CLIMATE = {'temp': 0.8, 'weather': 'water'}
WALK_Y = 2.0
_W = None
def _warp():
    global _W
    if _W is None: _W = warp(700, 160, 301)
    return _W

ISLANDS = [(-30, 520, 400, 270, 0.2), (950, -320, 270, 200, 0.5), (-930, -800, 300, 230, -0.3), (-1150, 1050, 150, 110, 0.0), (1150, 1100, 140, 120, 0.3), (250, -1250, 130, 100, 0.0)]
SHOALS = [(-700, 650, 260, 200, 0.0), (520, -920, 240, 180, 0.3)]          # the stilt village and the pirates' nest stand here

def land_field():
    w = _warp()
    F = np.maximum.reduce([ellw(x, z, rx, rz, r, w) for (x, z, rx, rz, r) in ISLANDS])
    F += fbm(X / 400, Z / 400, 4, seed=302) * 0.12 + fbm(X / 120, Z / 120, 3, seed=303) * 0.05
    return F

def regions(land, dIn, dOut):
    R = {}
    R['harbour'] = soft(-30, 520, 420, 300, 0.2, 0.7)
    R['palm'] = soft(950, -320, 300, 230, 0.5, 0.7)
    R['rock'] = soft(-930, -800, 330, 260, -0.3, 0.7)
    R['shoal'] = np.maximum.reduce([soft(x, z, rx, rz, r, 0.5) for (x, z, rx, rz, r) in SHOALS])
    return R

def relief(R, land, dIn, dOut):
    n1 = fbm(X / 500, Z / 500, 4, seed=321); n2 = fbm(X / 160, Z / 160, 4, seed=322)
    h = 2 + 14 * (1 - np.exp(-dIn / 140)) + 4 * (n1 * 0.5 + 0.5)
    h += R['rock'] * (18 + 30 * ridged(X / 260, Z / 260, 4, seed=323))
    h += R['palm'] * (6 + 22 * np.exp(-(((X - 980) / 140) ** 2 + ((Z + 330) / 120) ** 2)))
    h += R['harbour'] * (4 + 16 * np.exp(-(((X + 60) / 180) ** 2 + ((Z - 470) / 120) ** 2)))
    cliffy = np.clip(R['rock'] * 1.4, 0, 1) * smooth(0.35, 0.6, n1 * 0.5 + 0.5)
    h = coast(h, cliffy, land, dIn, dOut, beach=(45.0, 40.0), shelf=220.0, deep=26.0)
    # the shallows under the stilt village and the platforms: a sandy bank two or three metres down
    bank = -2.4 - 0.8 * (n2 * 0.5 + 0.5)
    h = np.where(~land, h * (1 - R['shoal']) + np.maximum(h, bank) * R['shoal'], h)
    return h

def erodibility(R, h):
    return 0.3 + R['rock'] * 0.4

def water(W):
    pass

def stilt_village(A, sid, name, cx, cz, NX=4, NZ=3, SP=18.0):
    """houses on posts over the shallows, joined by boardwalks, a market deck in the middle and a long walk to the shore"""
    rng = A.rng
    L = Layout(A, sid, name, 'village', cx, cz, int(max(NX, NZ) * SP / 2 + 40))
    x0 = cx - (NX - 1) * SP / 2; z0 = cz - (NZ - 1) * SP / 2
    for j in range(NZ):
        zr = z0 + j * SP
        L.prop('walk', cx, zr, x0=round(x0 - 8, 1), z0=round(zr, 1), x1=round(x0 + (NX - 1) * SP + 8, 1), z1=round(zr, 1), w=2.6)
    L.prop('walk', cx, cz, x0=round(cx, 1), z0=round(z0 - 8, 1), x1=round(cx, 1), z1=round(z0 + (NZ - 1) * SP + 8, 1), w=2.6)
    L.prop('deck', cx, cz, hx=7.0, hz=7.0, crates=True)
    L.block(cx, cz, 8, 8)
    for j in range(NZ):
        for i in range(NX):
            x = x0 + i * SP; z = z0 + j * SP
            if abs(x - cx) < 9 and abs(z - cz) < 9: continue
            for side in (-1, 1):
                hx, hz = rng.uniform(3.6, 4.6), rng.uniform(3.2, 4.0)
                bz = z + side * (hz + 2.2)
                L.add('house', x, bz, hx, hz, 'n' if side > 0 else 's', style='stilt', water=True, wet_ok=True, floors=1, seed=rng.randrange(1 << 30), wall=rng.choice([0x7a6a52, 0x6e5e48, 0x857256, 0x5f7a5a]), gap=0.6)
    # boats tied at the ends of the walks
    for j in range(NZ):
        zr = z0 + j * SP
        for sx in (-1, 1):
            xe = cx + sx * ((NX - 1) * SP / 2 + 13)
            L.prop('rboat', xe, zr + 3.5, ry=float(np.pi / 2))
    L.prop('lamp', cx + 6, cz + 6)
    A.poi('village', name, cx, cz, r=L.d['r'])
    return L

def shore_walk(A, L, x0, z0, x1, z1):
    """a long boardwalk from the village towards the nearest dry land"""
    dx, dz = x1 - x0, z1 - z0; d = np.hypot(dx, dz); ux, uz = dx / d, dz / d
    end = None
    for t in np.arange(0, d, 4.0):
        x, z = x0 + ux * t, z0 + uz * t
        if A.hb(x, z) > 0.8: end = (x, z); break
    if end: L.prop('walk', (x0 + end[0]) / 2, (z0 + end[1]) / 2, x0=round(x0, 1), z0=round(z0, 1), x1=round(end[0], 1), z1=round(end[1], 1), w=2.4)

def places(A):
    guards = []
    # the harbour island: a fishing town with its shops, piers and boats
    hx, hz = A.spot(-30, 470, 160, hmin=2.0, hmax=14, flat_r=8)
    H = village(A, 'city', 'مرفأ الجزر', hx, hz, 'fisher', 16, r=110, extra=[
        ('shop', 'بقالة المرفأ', 8, 6, {'shop': 'grocery', 'sign': 'بقالة المرفأ'}), ('shop', 'الصيد والسلاح', 6.5, 5.5, {'shop': 'guns', 'sign': 'الصيد والسلاح'}),
        ('shop', 'عدد البحّارة', 7, 6, {'shop': 'tools', 'sign': 'عدد البحّارة'}), ('shop', 'صيدلية الموج', 6, 5, {'shop': 'pharmacy', 'sign': 'صيدلية'}),
        ('shop', 'ملابس البحر', 7, 6, {'shop': 'clothes', 'sign': 'ملابس البحر'}), ('shop', 'مقهى الشاطئ', 6.5, 5.5, {'shop': 'cafe', 'sign': 'مقهى الشاطئ', 'terrace': True}),
    ])
    for (px, pz) in [A.coast_point(hx - 120, hz + 200), A.coast_point(hx + 160, hz + 160), A.coast_point(hx, hz - 220)]:
        H.prop('pier', px, pz, len=60, w=5.0)
        # the runtime runs the pier towards the lowest ground; put the boats beside its far end
        best = None
        for d in [(0, -1), (0, 1), (1, 0), (-1, 0)]:
            v = A.hb(px + d[0] * 48, pz + d[1] * 48)
            if best is None or v < best[0]: best = (v, d)
        dx, dz = best[1]; ex, ez = px + dx * 52, pz + dz * 52
        for q, sd in enumerate((-1, 1)):
            bx, bz = ex + dz * sd * 6.5, ez + dx * sd * 6.5
            H.prop('rboat', bx, bz, ry=float(np.arctan2(dx, dz)))
        H.prop('boat', ex + dz * 12, ez + dx * 12, ry=0.2, moored=True)
    # the village on posts and its long walk ashore
    V = stilt_village(A, 'stilts', 'قرية الأعمدة', -700.0, 650.0)
    shore_walk(A, V, -700 + 45, 650.0, hx, hz)
    # the pirates' nest: platforms on the far shoal, joined by walks, guarded day and night
    P = Layout(A, 'pirates', 'وكر القراصنة', 'military', 520.0, -920.0, 120)
    decks = [(520, -920, 10, 8), (560, -880, 6, 6), (470, -960, 7, 5), (580, -980, 6, 6), (450, -890, 5, 5)]
    for (x, z, dx, dz) in decks: P.prop('deck', x, z, hx=dx, hz=dz, crates=True, loot='military')
    for (a, b) in [(0, 1), (0, 2), (0, 3), (0, 4)]:
        (x0, z0, *_), (x1, z1, *_) = decks[a], decks[b]
        P.prop('walk', (x0 + x1) / 2, (z0 + z1) / 2, x0=x0, z0=z0, x1=x1, z1=z1, w=2.2)
    for (x, z, dx, dz) in decks: guards.append([x + 1.0, WALK_Y + 0.1, z - 1.0, max(2.0, min(dx, dz) - 1.5)])
    P.prop('rboat', 520 - 16, -920 + 2, ry=float(np.pi / 2))
    A.poi('military', 'وكر القراصنة', 520, -920, r=120)
    # warships and a cargo ship at anchor in the deep water
    for sid, name, x, z, ry, war in [('war1', 'السفينة الحربية', 1050.0, 720.0, 0.0, True), ('war2', 'المدمّرة', -1150.0, -150.0, np.pi / 2, True), ('cargo', 'سفينة الشحن', 280.0, -380.0, 0.0, False)]:
        S = Layout(A, sid, name, 'military' if war else 'village', x, z, 60)
        S.prop('ship', x, z, ry=float(ry), war=war, len=70 if war else 48)
        A.poi('military' if war else 'camp', name, x, z, r=60)
        if war:
            along = abs(np.sin(ry)) < 0.5; deck = 4.6 + 0.1
            for u in (-28, 9, 27):
                gx, gz = (x + u, z + 1.5) if along else (x + 1.5, z + u)
                guards.append([gx, deck, gz, 6.0])
    # the palm island with its lighthouse, the rocky isle with the old fort, a radio mast on the harbour hill
    landm = (A.h > 3) & ~A.wet() & (np.hypot(X - 950, Z + 320) < 320); xs_ = X[landm]; zs_ = Z[landm]; k = int(np.argmax(xs_ - zs_ * 0.3))
    lighthouse(A, float(xs_[k]) - 20, float(zs_[k]), 'منارة النخيل')
    for kind, name, (x, z), R_ in [('castle', 'الحصن القديم', (-930, -800), 160), ('radio', 'برج الإرسال', (-60, 470), 140), ('cabin', 'كوخ الصياد', (950, -250), 150), ('ruins', 'معبد الغرقى', (-1150, 1050), 90), ('camp', 'مخيم الناجين', (1150, 1100), 90)]:
        try: x, z = A.spot(x, z, R_, hmin=2.0, hmax=80, tries=900, grow=1)
        except RuntimeError: pass
        lonely(A, kind, name, x, z)
    birds = [['stork', -700.0, 650.0, 160, 30.0], ['parrot', 950.0, -320.0, 140, 24.0]]
    A.extras['guards'] = [[round(v, 2) for v in g] for g in guards]
    A.extras['birds'] = birds

def roads(A):
    A.R('درب البرج', TR, [A.gate('city', 'n'), A.poi('برج الإرسال')])

def biomes(B):
    R = B.R; h = B.h; n1, n2 = B.n1, B.n2
    bio = np.full(h.shape, 2, np.int32)
    bio = np.where(R['palm'] > 0.3, 9, bio)
    bio = np.where(R['rock'] > 0.3, 10, bio)
    bio = np.where((R['harbour'] > 0.3) & (n2 > 0.2), 9, bio)
    bio = B.water_ids(bio)
    moist = np.clip(0.55 + 0.1 * n1, 0, 1)
    temp = np.clip(0.8 + 0.04 * n1, 0, 1)
    fd = (R['palm'] * 0.65 + R['harbour'] * 0.3 + R['rock'] * 0.35 + 0.15) * (1 + 0.3 * n1)
    fd = B.finish_fd(fd, bio)
    cls = B.classes(bio)
    return {'bio': bio, 'moist': moist, 'fd': fd, 'temp': temp, 'cls': cls}

def amp(R, h):
    return 0.35 + R['rock'] * 0.6

def spawn(P):
    c = [s for s in P['settlements'] if s['id'] == 'city'][0]
    return (c['x'] + 6, c['z'] + 14)
