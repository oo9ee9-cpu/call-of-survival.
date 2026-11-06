"""The 8 x 8 km island (the owner's map: data/valley/island_mask.png): the sea all round and a strait cutting off a
southern island joined by two bridges, mountains (a ridge in the north, a massif in the north-east, a range in the
south-west, a crater in the east, a peak on the southern island), four lakes (carriers on three), a river from the port
in the west through the south of the city to the east coast, a big airport in the north-west and a second one in the
north-east, a port with piers and containers, the ruined city in the middle with the five capture zones (each with a
computer), towns and villages in clusters (houses you can enter), two team bases, crash sites, forests. Writes heights,
splat maps, road and bridge meshes and the layout.
usage: python3 worldgen8.py <build_dir> <project_dir>"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, os.path.dirname(__file__))
from meshlib import Mesh, write_glb  # noqa: E402

OUT, PROJ = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
os.makedirs(PROJ + '/models/v8', exist_ok=True)
os.makedirs(PROJ + '/data/valley', exist_ok=True)
rs = np.random.RandomState(8081)
HALF = 4096.0
N = 2049
SP = 2 * HALF / (N - 1)                      # 4 m
xs = np.linspace(-HALF, HALF, N)
X, Z = np.meshgrid(xs, xs)                   # [row z, col x]
PREF = json.load(open(PROJ + '/data/valley/prefabs.json'))
TREES = json.load(open(PROJ + '/data/valley/trees.json'))


def vnoise(shape_n, cells, seed):
    g = np.random.RandomState(seed).rand(cells + 3, cells + 3)
    z = ndimage.zoom(g, (shape_n + 2) / (cells + 3), order=3)
    return z[1:shape_n + 1, 1:shape_n + 1]


def fbm(cells, seed, oct=5, gain=0.5):
    out = np.zeros((N, N))
    a, tot = 1.0, 0.0
    for o in range(oct):
        c = cells * 2 ** o
        if c > 900:
            break
        out += a * vnoise(N, c, seed + o * 31)
        tot += a
        a *= gain
    return out / tot


def sstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


print('heights', flush=True)
H = 50.0 + 56.0 * (fbm(3, 1, 3) - 0.5) + 26.0 * (fbm(9, 2, 4) - 0.5) + 6.0 * (fbm(40, 3, 3) - 0.5)
ridge = 1.0 - np.abs(fbm(6, 4, 4) * 2 - 1)
# ---- the island's outline
_mimg = np.asarray(Image.open(PROJ + '/data/valley/island_mask.png').convert('L')).astype(np.float32) / 255.0
LAND = np.clip(ndimage.zoom(_mimg, N / _mimg.shape[0], order=1)[:N, :N], 0, 1)
LANDB = LAND > 0.5
CDIST = ndimage.distance_transform_edt(LANDB) * SP          # metres inland from the coast
SDIST = ndimage.distance_transform_edt(~LANDB) * SP         # metres out to sea
MOUNTAINS = [  # name, x, z, radius, height, kind (1 ridged peak, 2 crater)
    ('سلسلة الشمال', -1050, -1950, 720, 390, 1), ('جبل الشرق', 1450, -2330, 650, 330, 1),
    ('جبال الجنوب الغربي', -1950, 1100, 820, 330, 1), ('قمة الجزيرة', 1050, 2720, 460, 300, 1), ('الفوهة', 2150, 1000, 470, 200, 2),
]
for (_nm, mx, mz, mr, mh, kind) in MOUNTAINS:
    d = np.hypot(X - mx, Z - mz) / mr
    bump = np.clip(1 - d, 0, 1) ** 1.6
    if kind == 2:
        bump = np.exp(-((d - 0.55) / 0.22) ** 2) + np.clip(1 - d, 0, 1) * 0.15
    H += mh * bump * (0.55 + 0.45 * ridge ** 2)
# down to a beach toward the coast, under the sea outside it
coast_k = sstep(0, 420, CDIST)
H = 2.4 + (H - 2.4) * coast_k
H = np.where(LANDB, H, -1.2 - np.minimum(SDIST, 600) / 600 * 13.0)
_band = (CDIST < 40) | (SDIST < 40)
H = np.where(_band, ndimage.gaussian_filter(H, 2.0), H)
SEA_LEVEL = 0.0


def on_land(x, z, margin=0.0):
    i = int(np.clip((z + HALF) / SP, 0, N - 1))
    j = int(np.clip((x + HALF) / SP, 0, N - 1))
    return bool(LANDB[i, j]) and CDIST[i, j] >= margin


def land_spot(x, z, margin=60.0):
    """the nearest point toward the middle of the island that is on land, `margin` metres from the sea"""
    for k in range(200):
        t = k / 200.0
        px, pz = x * (1 - t), z * (1 - t)
        if on_land(px, pz, margin):
            return px, pz
    return 0.0, 0.0


def flatten(cx, cz, r, level=None, edge=120.0, w=1.0):
    """pull the ground towards a level inside a circle (towns, bases)"""
    global H
    d = np.hypot(X - cx, Z - cz)
    k = sstep(r + edge, r, d) * w
    if level is None:
        m = d < r
        level = float(np.median(H[m])) if m.any() else float(H[int((cz + HALF) / SP), int((cx + HALF) / SP)])
    H = H * (1 - k) + level * k
    return level


def flatten_rect(cx, cz, hw, hd, level, edge=150.0):
    global H
    dx = np.maximum(np.abs(X - cx) - hw, 0)
    dz = np.maximum(np.abs(Z - cz) - hd, 0)
    k = sstep(edge, 0, np.hypot(dx, dz))
    H = H * (1 - k) + level * k


def hat(x, z):
    fx = (x + HALF) / SP
    fz = (z + HALF) / SP
    ix, iz = int(np.clip(fx, 0, N - 2)), int(np.clip(fz, 0, N - 2))
    tx, tz = fx - ix, fz - iz
    a = H[iz, ix] * (1 - tx) + H[iz, ix + 1] * tx
    b = H[iz + 1, ix] * (1 - tx) + H[iz + 1, ix + 1] * tx
    return float(a * (1 - tz) + b * tz)


# ---------------------------------------------------------------- lakes (each holds a carrier)
LAKES = [  # x, z, radius, carrier model ('' none), carrier yaw, the point it moves toward if it is too near the sea
    (-75, -1780, 600, 'cvn80', 0.4, (0, -900)), (-620, -980, 360, '', 0.0, (-300, -600)), (2186, -240, 580, 'cdg', -0.3, (1000, -200)),
    (1950, 2960, 400, '', 1.2, (1700, 2950)),
]
_moved = []
for (cx, cz, r, model, yaw, anchor) in LAKES:
    for _ in range(80):
        ii, jj = int(np.clip((cz + HALF) / SP, 0, N - 1)), int(np.clip((cx + HALF) / SP, 0, N - 1))
        if CDIST[ii, jj] >= r + 280:
            break
        cx, cz = cx + (anchor[0] - cx) * 0.04, cz + (anchor[1] - cz) * 0.04
    _moved.append((round(cx, 1), round(cz, 1), r, model, yaw))
LAKES = _moved
print('lakes', LAKES)
lake_mask = np.zeros((N, N))
lake_info = []
for i, (cx, cz, r, model, yaw) in enumerate(LAKES):
    ang = np.arctan2(Z - cz, X - cx)
    wob = 1.0 + 0.16 * np.sin(ang * 3 + i) + 0.1 * np.sin(ang * 5 + 2 * i) + 0.08 * (vnoise(N, 12, 50 + i) - 0.5)
    d = np.hypot(X - cx, Z - cz) / (r * wob)
    near = d < 1.6
    shore = float(np.percentile(H[(d > 1.0) & (d < 1.25)], 20))
    level = max(shore - 1.2, 5.0)
    # a rim round it: the water never runs out to the sea
    rim = (d > 0.98) & (d < 1.3) & LANDB
    H = np.where(rim, np.maximum(H, level + 1.2 + 2.0 * (d - 1.0)), H)
    depth = 16.0
    inside = np.clip(1 - d, 0, 1)
    target = level - 0.6 - depth * np.sqrt(inside)
    k = sstep(1.18, 0.98, d)
    H = np.where(near, np.minimum(H, H * (1 - k) + target * k + (1 - k) * 0), H)
    H = np.where(d < 1.0, np.minimum(H, target), H)
    lake_mask = np.maximum(lake_mask, (d < 1.0).astype(float))
    lake_info.append(dict(x=cx, z=cz, r=r, level=round(level, 2), carrier=model, yaw=yaw))

# ---------------------------------------------------------------- places
CENTER = (0.0, 0.0)
TOWNS = [  # name, x, z, radius, buildings target, style  (clustered like the owner's map)
    ('المدينة المدمرة', 0, 0, 640, 130, 'city'), ('الميناء', -2850, -230, 400, 56, 'town'),
    ('بلدة المطار', -1650, -560, 330, 42, 'town'), ('بلدة الشمال', 380, -2520, 300, 36, 'town'),
    ('المدينة الشرقية', 2950, 1560, 360, 46, 'town'), ('البلدة الجنوبية', 300, 1420, 380, 50, 'town'),
    ('الساحل الغربي', -2650, 1500, 340, 42, 'town'), ('جزيرة الجنوب', -60, 2860, 420, 56, 'town'),
    ('قرية الشمال الغربي', -2750, -2100, 180, 15, 'village'), ('قرية الساحل الشرقي', 2650, -1520, 170, 13, 'village'),
    ('قرية الخليج', -2050, 2050, 170, 14, 'village'), ('قرية الحقول', 1300, 420, 170, 13, 'village'),
    ('قرية الجزيرة الشرقية', 2330, 3280, 170, 13, 'village'),
]
BASES = [(0, -650.0, 1650.0, math.pi), (1, 500.0, -950.0, 0.0)]    # team, x, z, yaw (fronts face the centre)
AIRPORTS = [dict(name='المطار الكبير', x=-2250.0, z=-1180.0, len=2400.0, wid=45.0, hangars=10),
            dict(name='مطار الشرق', x=1700.0, z=-1080.0, len=1500.0, wid=40.0, hangars=6)]
AIRPORT = AIRPORTS[0]
PORT = dict(name='الميناء', x=-3060.0, z=-260.0, piers=[-470.0, -320.0, -170.0, -20.0], pier_len=300.0)
RIVERS = [  # the course, its width (m)
    dict(name='النهر الكبير', w=46.0, pts=[(-3700, -560), (-3150, -520), (-2500, -430), (-1950, -150), (-1350, 260), (-800, 640), (-150, 820),
                                           (550, 790), (1150, 640), (1700, 700), (2300, 600), (2900, 470), (3600, 400)]),
    dict(name='رافد الجنوب', w=26.0, pts=[(-1600, 600), (-1300, 640), (-1050, 690), (-800, 640)]),
]
# denser: tighter streets, more houses, less ground between them (towns, not houses scattered over the fields)
TOWNS = [(nm, cx, cz, r if st != 'town' else int(r * 0.84), n if st == 'village' else (int(n * 1.35) if st == 'town' else 380), st)
         for (nm, cx, cz, r, n, st) in TOWNS]
for (nm, cx, cz, r, n, st) in TOWNS:
    if not on_land(cx, cz, 50):
        print('  !! town in the sea:', nm, cx, cz)
CAPTURE = [(0.0, 0.0), (-470.0, -260.0), (440.0, -320.0), (-400.0, 400.0), (420.0, 370.0)]
CAP_NAMES = ['ألف', 'باء', 'جيم', 'دال', 'هاء']

print('flatten', flush=True)
town_levels = []
for (nm, cx, cz, r, n, st) in TOWNS:
    town_levels.append(flatten(cx, cz, r * 0.92, edge=r * 0.4, w=0.85))
for (team, bx, bz, yaw) in BASES:
    flatten(bx, bz, 230, edge=160)
for ap in AIRPORTS:
    hl = ap['len'] / 2 + 100
    lv = float(np.median(H[(np.abs(X - ap['x']) < hl) & (np.abs(Z - ap['z']) < 350) & LANDB]))
    ap['y'] = max(lv, 6.0)
    flatten_rect(ap['x'], ap['z'] - 120, hl, 330, ap['y'], edge=260)
ap_level = AIRPORT['y']
# the port: a flat quay along the shore
PORT['y'] = 3.0
flatten_rect(PORT['x'] + 120, PORT['z'] - 240, 160, 330, PORT['y'], edge=140)

# ---------------------------------------------------------------- roads (polylines between places)
def road_path(a, b, wiggle=0.12, seed=0):
    r2 = np.random.RandomState(seed)
    ax, az = a
    bx, bz = b
    L = math.hypot(bx - ax, bz - az)
    n = max(4, int(L / 60))
    nx, nz = -(bz - az) / L, (bx - ax) / L
    ph = r2.uniform(0, 6.28, 3)
    pts = []
    for k in range(n + 1):
        t = k / n
        off = L * wiggle * (0.6 * math.sin(t * math.pi) * math.sin(ph[0] + t * 3.1) + 0.3 * math.sin(ph[1] + t * 7.0) * math.sin(t * math.pi))
        pts.append((ax + (bx - ax) * t + nx * off, az + (bz - az) * t + nz * off))
    return pts


ROADS = []
P = {nm: (cx, cz) for (nm, cx, cz, r, n, st) in TOWNS}
links = [('المدينة المدمرة', 'الميناء'), ('المدينة المدمرة', 'بلدة المطار'), ('المدينة المدمرة', 'بلدة الشمال'),
         ('المدينة المدمرة', 'المدينة الشرقية'), ('المدينة المدمرة', 'البلدة الجنوبية'), ('المدينة المدمرة', 'الساحل الغربي'),
         ('المدينة المدمرة', 'قرية الحقول'), ('الميناء', 'بلدة المطار'), ('الميناء', 'قرية الشمال الغربي'),
         ('بلدة الشمال', 'قرية الساحل الشرقي'), ('المدينة الشرقية', 'قرية الحقول'), ('الساحل الغربي', 'قرية الخليج'),
         ('جزيرة الجنوب', 'قرية الجزيرة الشرقية'),
         # over the strait: the long bridge and the short one
         ('البلدة الجنوبية', 'جزيرة الجنوب'), ('المدينة الشرقية', 'قرية الجزيرة الشرقية')]
for i, (a, b) in enumerate(links):
    ROADS.append(dict(w=8.0, kind='asphalt', pts=road_path(P[a], P[b], 0.1 if i < 13 else 0.02, i)))
ROADS.append(dict(w=8.0, kind='asphalt', pts=road_path(P['بلدة المطار'], (AIRPORTS[0]['x'] + 400, AIRPORTS[0]['z'] - 330), 0.06, 50)))
ROADS.append(dict(w=8.0, kind='asphalt', pts=road_path(P['قرية الساحل الشرقي'], (AIRPORTS[1]['x'] + 300, AIRPORTS[1]['z'] - 330), 0.06, 51)))
ROADS.append(dict(w=8.0, kind='asphalt', pts=road_path(P['بلدة الشمال'], (AIRPORTS[1]['x'] - 500, AIRPORTS[1]['z'] - 330), 0.06, 52)))
for team, bx, bz, yaw in BASES:
    ROADS.append(dict(w=6.0, kind='dirt', pts=road_path((bx, bz), CENTER, 0.08, 60 + team)))


RIVER_DENSE = []      # per river: dense points (n, 2)
for rv in RIVERS:
    q = np.asarray(rv['pts'], np.float64)
    dd = []
    for i in range(len(q) - 1):
        n = max(1, int(np.hypot(*(q[i + 1] - q[i])) / 4))
        for k in range(n):
            dd.append(q[i] + (q[i + 1] - q[i]) * k / n)
    dd.append(q[-1])
    RIVER_DENSE.append(np.asarray(dd))


def river_dist(x, z):
    """distance to the nearest river's middle and that river's width"""
    best, bw = 1e9, 0.0
    for dd, rv in zip(RIVER_DENSE, RIVERS):
        d = float(np.min(np.hypot(dd[:, 0] - x, dd[:, 1] - z)))
        if d < best:
            best, bw = d, rv['w']
    return best, bw


BRIDGES = []          # [x0, z0, x1, z1, deck height] for the map


def carve_road(pts, w):
    """level the ground along a road: smooth profile along it, blended out over 18 m; over a river or the sea the
    ground is left alone and the road becomes a bridge (its level runs straight across, a little arched)"""
    global H
    pts = np.asarray(pts)
    dense = []
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]
        n = max(1, int(np.hypot(*(b - a)) / 4))
        for k in range(n):
            dense.append(a + (b - a) * k / n)
    dense.append(pts[-1])
    dense = np.asarray(dense)
    hs = np.array([hat(p[0], p[1]) for p in dense])
    wet = np.array([(not on_land(p[0], p[1], 6.0)) or (river_dist(p[0], p[1])[0] < river_dist(p[0], p[1])[1] * 0.5 + 14) for p in dense])
    wet = ndimage.binary_dilation(wet, iterations=4)
    hs = ndimage.gaussian_filter1d(hs, 12, mode='nearest')
    bridge = np.zeros(len(dense), bool)
    if wet.any():
        lab, nb = ndimage.label(wet)
        for b in range(1, nb + 1):
            idx_b = np.nonzero(lab == b)[0]
            i0, i1 = max(idx_b[0] - 1, 0), min(idx_b[-1] + 1, len(dense) - 1)
            h0, h1 = hs[i0], hs[i1]
            span = float(np.sum(np.hypot(*np.diff(dense[i0:i1 + 1], axis=0).T)))
            sea = any(not on_land(p[0], p[1], 0.0) for p in dense[idx_b])
            arch = 9.0 if sea else 2.5
            lift = max(0.0, (12.0 if sea else 5.0) - min(h0, h1))
            for k in range(i0, i1 + 1):
                t = (k - i0) / max(i1 - i0, 1)
                hs[k] = h0 + (h1 - h0) * t + (lift + arch) * math.sin(t * math.pi) ** 0.6
            bridge[i0:i1 + 1] = True
            BRIDGES.append([round(float(dense[i0][0]), 1), round(float(dense[i0][1]), 1), round(float(dense[i1][0]), 1),
                            round(float(dense[i1][1]), 1), round(float(max(h0, h1) + lift), 1), round(span, 1)])
    # rasterise: nearest dense point per grid cell around the road
    lo = np.floor((dense.min(0) - 40 + HALF) / SP).astype(int)
    hi = np.ceil((dense.max(0) + 40 + HALF) / SP).astype(int)
    lo = np.clip(lo, 0, N - 1)
    hi = np.clip(hi, 0, N - 1)
    sub_x = X[lo[1]:hi[1] + 1, lo[0]:hi[0] + 1]
    sub_z = Z[lo[1]:hi[1] + 1, lo[0]:hi[0] + 1]
    from scipy.spatial import cKDTree
    tree = cKDTree(dense)
    d, idx = tree.query(np.stack([sub_x.ravel(), sub_z.ravel()], 1))
    d = d.reshape(sub_x.shape)
    target = hs[idx].reshape(sub_x.shape)
    k = sstep(w * 0.5 + 18, w * 0.5 + 1.5, d)
    k = k * (~bridge[idx].reshape(sub_x.shape))               # under a bridge the ground stays as it is
    blk = H[lo[1]:hi[1] + 1, lo[0]:hi[0] + 1]
    H[lo[1]:hi[1] + 1, lo[0]:hi[0] + 1] = blk * (1 - k) + target * k
    return dense, hs, bridge


def carve_river(dd, w):
    """a channel along the river: the water a little under the smoothed ground, the bed 4 m under the water"""
    global H
    hs = np.array([hat(p[0], p[1]) for p in dd])
    level = np.maximum(ndimage.gaussian_filter1d(hs, 40, mode='nearest') - 2.6, 0.7)
    level = np.minimum(level, ndimage.minimum_filter1d(hs, 25) - 1.2)
    level = np.maximum(level, 0.6)
    level = ndimage.gaussian_filter1d(level, 8, mode='nearest')
    lo = np.clip(np.floor((dd.min(0) - w - 60 + HALF) / SP).astype(int), 0, N - 1)
    hi = np.clip(np.ceil((dd.max(0) + w + 60 + HALF) / SP).astype(int), 0, N - 1)
    sub_x = X[lo[1]:hi[1] + 1, lo[0]:hi[0] + 1]
    sub_z = Z[lo[1]:hi[1] + 1, lo[0]:hi[0] + 1]
    from scipy.spatial import cKDTree
    d, idx = cKDTree(dd).query(np.stack([sub_x.ravel(), sub_z.ravel()], 1))
    d = d.reshape(sub_x.shape)
    lv = level[idx].reshape(sub_x.shape)
    bed = lv - 4.0 * np.clip(1 - (d / (w * 0.5)) ** 2, 0, 1) - 0.8
    bank = lv + (d - w * 0.5) * 0.35                       # the banks rise gently from the water
    prof = np.where(d < w * 0.5, bed, bank)
    blk = H[lo[1]:hi[1] + 1, lo[0]:hi[0] + 1]
    H[lo[1]:hi[1] + 1, lo[0]:hi[0] + 1] = np.minimum(blk, prof)
    return level


print('roads', flush=True)
road_dense = []
for rd in ROADS:
    dense, hs, br = carve_road(rd['pts'], rd['w'])
    rd['hs'] = hs
    rd['bridge'] = br
    road_dense.append((dense, rd))
print('rivers', flush=True)
RIVER_OUT = []
for dd, rv in zip(RIVER_DENSE, RIVERS):
    lv = carve_river(dd, rv['w'])
    step = 3
    RIVER_OUT.append(dict(name=rv['name'], w=rv['w'], pts=[[round(float(p[0]), 1), round(float(p[1]), 1), round(float(l), 2)]
                                                         for p, l in zip(dd[::step], lv[::step])]))

# ---------------------------------------------------------------- towns: streets and houses
print('towns', flush=True)
HOUSE_TYPES = {
    'city': [('apartment', 4), ('townhouse', 5), ('shop', 4), ('house2', 3), ('house2_brick', 3), ('ruin', 5), ('ruin_small', 3), ('garage', 1)],
    'town': [('house2', 4), ('house2_brick', 3), ('cottage', 3), ('townhouse', 2), ('shop', 2), ('villa', 2), ('ruin', 2), ('garage', 1), ('barn', 1)],
    'village': [('cottage', 4), ('farmhouse', 4), ('barn', 2), ('house2', 1), ('ruin_small', 1), ('garage', 1)],
}
BUILDINGS = []          # [type, x, y, z, yaw, tint]
occupied = []           # (x, z, radius)
STREETS = []
SIDEWALKS = []          # raised concrete in front of the houses of towns and the city
STREET_PROPS = []       # [model, x, y, z, yaw]: burnt-out cars, concrete chicanes, containers
LANDMARKS = []          # [model, x, y, z, yaw, scale]
BLOCKERS = []           # (x, z, r): big things the town streets stop at
# the city's apartment blocks, placed first: the houses keep off them and the streets stop at them
for i, model in enumerate(['cathedral', 'res_contemporary', 'res_multistory', 'res_facade']):
    a = i * 1.57 + 0.6
    x, z = math.cos(a) * 210, math.sin(a) * 210
    LANDMARKS.append([model, round(x, 2), round(hat(x, z), 2), round(z, 2), round(math.atan2(-x, -z), 3), 1.0])
    occupied.append((x, z, 30))
    BLOCKERS.append((x, z, 30.0))


def free(x, z, r):
    for (ox, oz, orr) in occupied:
        if (x - ox) ** 2 + (z - oz) ** 2 < (r + orr) ** 2:
            return False
    for ap in AIRPORTS:
        if abs(z - ap['z']) < 420 and abs(x - ap['x']) < ap['len'] / 2 + 200:
            return False
    if abs(x - (PORT['x'] + 60)) < 260 and abs(z - (PORT['z'] - 240)) < 340:
        return False
    return True


def near_road(x, z, margin):
    for dense, rd in road_dense:
        d = np.min(np.hypot(dense[:, 0] - x, dense[:, 1] - z))
        if d < rd['w'] * 0.5 + margin:
            return True
    return False


def in_lake(x, z, margin=30):
    """water near: a lake, a river, or the sea"""
    for lk in lake_info:
        if math.hypot(x - lk['x'], z - lk['z']) < lk['r'] * 1.15 + margin:
            return True
    if not on_land(x, z, 30 + margin * 0.5):
        return True
    d, w = river_dist(x, z)
    return d < w * 0.5 + 25 + margin * 0.5


def pick(style, r2):
    opts = HOUSE_TYPES[style]
    tot = sum(w for _, w in opts)
    q = r2.uniform(0, tot)
    for t, w in opts:
        q -= w
        if q <= 0:
            return t
    return opts[0][0]


def lot_density(style, d, x, z):
    """how much a lot wants a house: a full core, thinning to the edge; the city also packs round its five squares"""
    if style == 'village':
        return 1.0 - 0.6 * d
    core = 0.2 if style == 'city' else 0.42
    fall = 1.5 if style == 'city' else 0.95
    p = 1.0 if d < core else max(0.03, 1.0 - (d - core) / (1.0 - core) * fall)
    if style == 'city':
        for (px, pz) in CAPTURE:
            dc = math.hypot(x - px, z - pz)
            if dc < 170:
                p = max(p, 1.1 - dc / 170 * 0.6)
    return p


def runs(vals, gap):
    """sorted values split where they jump by more than `gap`"""
    vals = sorted(vals)
    out = [[vals[0], vals[0]]]
    for v in vals[1:]:
        if v - out[-1][1] > gap:
            out.append([v, v])
        else:
            out[-1][1] = v
    return out


for ti, (nm, cx, cz, r, target, style) in enumerate(TOWNS):
    # Rows of houses along parallel streets (every `block` m in a rotated frame), broken by cross streets every `cross`
    # m. Every lot along every street is a candidate; the town keeps the `target` lots that want a house most (a dense
    # core, thinning out to scattered houses at the edge), and streets are laid only where houses stand.
    r2 = np.random.RandomState(300 + ti)
    rot = r2.uniform(0, math.pi / 2)
    ca, sa = math.cos(rot), math.sin(rot)
    village = style == 'village'
    block = 36.0 if not village else 60.0
    cross = 112.0 if style == 'city' else 124.0
    sw = 7.0 if style == 'city' else 6.0
    kind = 'asphalt' if not village else 'dirt'

    def to_w(u, v):
        return cx + u * ca - v * sa, cz + u * sa + v * ca

    rl = r * 1.2 if style == 'city' else r       # the city's districts reach past its rim, round the outer squares
    n = int(rl / block)
    lines = [0] if village else list(range(-n, n + 1))
    cand = []
    for k in lines:
        v0 = k * block
        if abs(v0) > rl * 0.9:
            continue
        half = math.sqrt(max((rl * 0.92) ** 2 - v0 ** 2, 0.0))
        for side in (-1, 1):
            u = -half + r2.uniform(0, 10)
            while u < half:
                typ = pick(style, r2)
                dims = PREF[typ]
                w, dd = dims['w'], dims['d']
                if not village:
                    m_ = sw / 2 + 1.5
                    j = math.floor(u / cross)
                    hit = None
                    for uj in (j * cross, (j + 1) * cross):
                        if u < uj + m_ and u + w > uj - m_:
                            hit = uj + m_
                    if hit is not None:
                        u = hit + r2.uniform(0, 3)
                        continue
                uc = u + w / 2
                if uc + w / 2 > half:
                    break
                setback = (5.0 if not village else r2.uniform(6, 14)) + dd / 2
                v = v0 + side * setback
                x, z = to_w(uc, v)
                u += w + (r2.uniform(2.5, 6.5) if not village else r2.uniform(8, 22))
                if any(math.hypot(x - px, z - pz) < 32 for (px, pz) in CAPTURE):
                    continue                      # the squares round the computers stay open
                rad = math.hypot(w, dd) * 0.5
                if not free(x, z, rad) or in_lake(x, z) or near_road(x, z, rad * 0.7):
                    continue
                dens = lot_density(style, math.hypot(uc, v) / r, x, z)
                yaw = -rot + (math.pi if side > 0 else 0.0)   # Godot yaw: the front (+Z) faces the street
                cand.append((dens + r2.uniform(0, 0.3), k, uc, typ, x, z, yaw, rad, side, w))
    cand.sort(key=lambda c: -c[0])
    keep = cand[:target]
    fronts = {}
    for (_, k, uc, typ, x, z, yaw, rad, side, w) in keep:
        BUILDINGS.append([typ, round(x, 2), round(hat(x, z), 2), round(z, 2), round(yaw, 4), int(r2.randint(0, 8))])
        fronts.setdefault((k, side), []).append((uc - w / 2 - 1.5, uc + w / 2 + 1.5))
    if not village:
        # pavements in front of the houses, from the kerb to the front walls (one strip along a row of neighbours)
        for (k, side), iv in fronts.items():
            iv.sort()
            merged = [list(iv[0])]
            for a_, b_ in iv[1:]:
                if a_ <= merged[-1][1] + 4.0:
                    merged[-1][1] = max(merged[-1][1], b_)
                else:
                    merged.append([a_, b_])
            vv = k * block + side * (sw / 2 + (5.0 - sw / 2) / 2)
            for a_, b_ in merged:
                SIDEWALKS.append(dict(w=5.0 - sw / 2, pts=[to_w(a_, vv), to_w(b_, vv)]))
    for (_, k, uc, typ, x, z, yaw, rad, side, w) in keep:
        occupied.append((x, z, rad + 1.0))
    # streets: along each line, the stretches that have houses; the town's two main axes right across
    def to_f(x, z):
        return (x - cx) * ca + (z - cz) * sa, -(x - cx) * sa + (z - cz) * ca

    blk = [(*to_f(bx, bz), br) for (bx, bz, br) in BLOCKERS if math.hypot(bx - cx, bz - cz) < rl + br]

    def cut(segs, fixed, along_u):
        # a street stops short of the big buildings in its way
        for (bu, bv, br) in blk:
            off = (fixed - bv) if along_u else (fixed - bu)
            if abs(off) >= br:
                continue
            c_ = bu if along_u else bv
            h_ = math.sqrt(br * br - off * off)
            out = []
            for a, b in segs:
                if b <= c_ - h_ or a >= c_ + h_:
                    out.append([a, b])
                    continue
                if c_ - h_ - a > 6:
                    out.append([a, c_ - h_])
                if b - (c_ + h_) > 6:
                    out.append([c_ + h_, b])
            segs = out
        return segs

    covered = {}
    for k in lines:
        us = [c[2] for c in keep if c[1] == k]
        half = math.sqrt(max((rl * 0.95) ** 2 - (k * block) ** 2, 0.0))
        segs = [[max(a - 14, -half), min(b + 14, half)] for a, b in runs(us, 95.0)] if us else []
        if k == 0:
            segs = [[-half, half]]
        segs = cut(segs, k * block, True)
        covered[k] = segs
        for a, b in segs:
            m_ = max(2, int((b - a) / 6.0) + 1)
            STREETS.append(dict(w=sw, kind=kind, pts=[to_w(s, k * block) for s in np.linspace(a, b, m_)]))
    if not village:
        jn = int(rl / cross)
        for j in range(-jn, jn + 1):
            uj = j * cross
            ks = [k for k in lines if any(a <= uj <= b for a, b in covered[k])]
            pairs = [k for k in ks if k + 1 in ks]
            if j == 0:
                half = math.sqrt(max((rl * 0.95) ** 2 - uj ** 2, 0.0))
                spans = [[-half, half]]
            else:
                spans = [[a * block, (b + 1) * block] for a, b in runs(pairs, 1)] if pairs else []
            spans = cut(spans, uj, False)
            for a, b in spans:
                m_ = max(2, int((b - a) / 6.0) + 1)
                STREETS.append(dict(w=sw, kind=kind, pts=[to_w(uj, s) for s in np.linspace(a, b, m_)]))
    if not village:
        # burnt-out cars by the kerb, along the streets that have houses
        spots = []
        for k in lines:
            for a_, b_ in covered.get(k, []):
                u = a_ + r2.uniform(10, 40)
                while u < b_ - 10:
                    side = 1 if r2.rand() < 0.5 else -1
                    x, z = to_w(u, k * block + side * (sw / 2 - 1.15))
                    if abs(u - round(u / cross) * cross) > sw / 2 + 5 and not near_road(x, z, 3.0) and \
                            all(math.hypot(x - px, z - pz) > 38 for px, pz in CAPTURE) and \
                            all(math.hypot(x - bx, z - bz) > br + 4 for bx, bz, br in BLOCKERS):
                        spots.append((x, z))
                    u += r2.uniform(35, 90)
        r2.shuffle(spots)
        for (x, z) in spots[:(28 if style == 'city' else 4)]:
            yaw = math.atan2(ca, sa) + (0.0 if r2.rand() < 0.5 else math.pi) + r2.normal(0, 0.08)
            STREET_PROPS.append(['car_wreck', round(x, 2), round(hat(x, z), 2), round(z, 2), round(yaw, 3)])
    if style == 'city':
        # concrete chicanes on the streets into each square, 70-85 m out
        for (px, pz) in CAPTURE:
            pu, pv = to_f(px, pz)
            opts = []
            for k in lines:
                dv = k * block - pv
                if abs(dv) > 60:
                    continue
                for a_, b_ in covered.get(k, []):
                    for sgn in (-1, 1):
                        for dist in (70.0, 85.0):
                            u = pu + sgn * math.sqrt(max(dist * dist - dv * dv, 0.0))
                            x, z = to_w(u, k * block)
                            if a_ + 8 < u < b_ - 8 and abs(u - round(u / cross) * cross) > sw / 2 + 6 and not near_road(x, z, 4.0):
                                opts.append((k, u))
            r2.shuffle(opts)
            for (k, u) in opts[:2]:
                for (du, dv) in ((0.0, -1.9), (4.5, 1.9)):
                    x, z = to_w(u + du, k * block + dv)
                    STREET_PROPS.append(['jersey', round(x, 2), round(hat(x, z), 2), round(z, 2), round(math.atan2(-ca, -sa), 3)])
        # containers on some of the empty lots of the quarters
        empty = [c for c in cand[target:] if c[0] > 0.8]
        r2.shuffle(empty)
        nc = 0
        for c in empty:
            x, z = c[4], c[5]
            if all(math.hypot(x - p[1], z - p[3]) > 12 for p in STREET_PROPS) and \
                    all(math.hypot(x - px, z - pz) > 40 for px, pz in CAPTURE):
                yaw = math.atan2(ca, sa) + (0.0 if r2.rand() < 0.5 else math.pi)
                STREET_PROPS.append(['container', round(x, 2), round(hat(x, z), 2), round(z, 2), round(yaw, 3)])
                occupied.append((x, z, 4.0))
                nc += 1
                if nc >= 14:
                    break
    print(' ', nm, len(keep), 'buildings of', len(cand), 'lots')

# farms in the open
r2 = np.random.RandomState(77)
farms = 0
while farms < 14:
    x, z = r2.uniform(-3600, 3600), r2.uniform(-2200, 3700)
    if in_lake(x, z, 80) or not free(x, z, 60) or near_road(x, z, 20) or np.hypot(x, z) < 900:
        continue
    yaw = r2.uniform(0, math.tau)
    for typ, off in (('farmhouse', (0, 0)), ('barn', (22, -6))):
        ox = x + off[0] * math.cos(yaw) + off[1] * math.sin(yaw)
        oz = z - off[0] * math.sin(yaw) + off[1] * math.cos(yaw)
        BUILDINGS.append([typ, round(ox, 2), round(hat(ox, oz), 2), round(oz, 2), round(yaw, 4), int(r2.randint(0, 8))])
        occupied.append((ox, oz, 12))
    farms += 1

# bases: barracks, command post, garages
SPECIAL = []
for team, bx, bz, yaw in BASES:
    cy, sy = math.cos(yaw), math.sin(yaw)
    for k in range(3):
        ox, oz = -40 + k * 40, -45
        x, z = bx + ox * cy + oz * sy, bz - ox * sy + oz * cy
        BUILDINGS.append(['barracks', round(x, 2), round(hat(x, z), 2), round(z, 2), round(yaw, 4), 2])
        occupied.append((x, z, 14))
    for k in range(2):
        ox, oz = -70 + k * 140, 20
        x, z = bx + ox * cy + oz * sy, bz - ox * sy + oz * cy
        BUILDINGS.append(['garage', round(x, 2), round(hat(x, z), 2), round(z, 2), round(yaw, 4), 1])
        occupied.append((x, z, 8))

# capture points: command posts with the computer
for i, (px, pz) in enumerate(CAPTURE):
    yaw = rs.uniform(0, math.tau)
    BUILDINGS.append(['command_post', px, round(hat(px, pz), 2), pz, round(yaw, 4), 3])
    occupied.append((px, pz, 10))

# airports: runway, apron, hangars, tower, terminal
for ap in AIRPORTS:
    ax, az = ap['x'], ap['z']
    sc = ap['len'] / 2400.0
    for k in range(ap['hangars']):
        x = ax - 1050 * sc + k * 115
        z = az - 290
        BUILDINGS.append(['hangar', round(x, 2), round(hat(x, z), 2), round(z, 2), 0.0, 0])
    BUILDINGS.append(['control_tower', ax + 300 * sc, round(hat(ax + 300 * sc, az - 190), 2), az - 190, 0.0, 4])
    BUILDINGS.append(['terminal', ax - 450 * sc, round(hat(ax - 450 * sc, az - 210), 2), az - 210, 0.0, 5])
ax, az = AIRPORT['x'], AIRPORT['z']
# the port: warehouses along the quay (the piers and the containers come below)
for k in range(5):
    x, z = PORT['x'] + 190, PORT['z'] - 520 + k * 120
    BUILDINGS.append(['hangar', round(x, 2), round(hat(x, z), 2), round(z, 2), math.pi * 0.5, 0])
    occupied.append((x, z, 40))
print('buildings total', len(BUILDINGS))

# ---------------------------------------------------------------- road / runway meshes (chunked)
print('road meshes', flush=True)
CH = 1024.0
road_meshes = {}


def chunk_of(x, z):
    return (int(math.floor((x + HALF) / CH)), int(math.floor((z + HALF) / CH)))


def box(m, mat, c, hx, hy, hz, yaw=0.0):
    """a box (pillars, railings) into a road mesh"""
    cy, sy = math.cos(yaw), math.sin(yaw)
    corners = []
    for dx, dy, dz in ((-1, -1, -1), (1, -1, -1), (1, -1, 1), (-1, -1, 1), (-1, 1, -1), (1, 1, -1), (1, 1, 1), (-1, 1, 1)):
        x, z = dx * hx, dz * hz
        corners.append((c[0] + x * cy + z * sy, c[1] + dy * hy, c[2] - x * sy + z * cy))
    faces = [((0, 1, 2, 3), (0, -1, 0)), ((4, 7, 6, 5), (0, 1, 0)), ((0, 4, 5, 1), (0, 0, -1)), ((1, 5, 6, 2), (1, 0, 0)),
             ((2, 6, 7, 3), (0, 0, 1)), ((3, 7, 4, 0), (-1, 0, 0))]
    for f, nrm in faces:
        P = [corners[i] for i in f]
        n_ = (nrm[0] * cy + nrm[2] * sy, nrm[1], -nrm[0] * sy + nrm[2] * cy)
        m.add(mat, P, [n_] * 4, [(0, 0), (1, 0), (1, 1), (0, 1)], [(0, 1, 2), (0, 2, 3)])


def bridge_parts(dense, hs, bridge, w):
    """pillars down to the bed every 36 m and a low wall along both edges of a bridge"""
    tang = np.gradient(dense, axis=0)
    tang /= np.linalg.norm(tang, axis=1, keepdims=True) + 1e-9
    acc = 0.0
    for i in range(len(dense)):
        if i > 0:
            acc += float(np.hypot(*(dense[i] - dense[i - 1])))
        if not bridge[i]:
            continue
        yaw = math.atan2(tang[i][0], tang[i][1])
        key = chunk_of(dense[i][0], dense[i][1])
        m = road_meshes.setdefault((key, 'road_concrete'), Mesh())
        if int(acc / 36.0) != int((acc - 6.0) / 36.0):
            g = min(hat(dense[i][0], dense[i][1]), 0.0 if not on_land(dense[i][0], dense[i][1]) else hat(dense[i][0], dense[i][1]))
            top = hs[i] - 0.6
            hh = max((top - (g - 2.0)) * 0.5, 0.5)
            box(m, 'road_concrete', (dense[i][0], top - hh, dense[i][1]), w * 0.32, hh, 1.4, yaw)
        if i % 2 == 0:
            for sgn in (-1, 1):
                nx, nz = -tang[i][1] * sgn, tang[i][0] * sgn
                box(m, 'road_concrete', (dense[i][0] + nx * (w * 0.5 + 0.2), hs[i] + 0.55, dense[i][1] + nz * (w * 0.5 + 0.2)), 0.2, 0.45, 6.2, yaw)


def strip(pts, w, mat, lift=0.12, step=6.0, prof=None, kerb=False):
    pts = np.asarray(pts, np.float64)
    dense = []
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]
        n = max(1, int(np.hypot(*(b - a)) / step))
        for k in range(n):
            dense.append(a + (b - a) * k / n)
    dense.append(pts[-1])
    dense = np.asarray(dense)
    if len(dense) < 2:
        return
    tang = np.gradient(dense, axis=0)
    tang /= np.linalg.norm(tang, axis=1, keepdims=True) + 1e-9
    nrm = np.stack([-tang[:, 1], tang[:, 0]], 1)
    hs = np.array([hat(p[0], p[1]) for p in dense])
    fixed = np.zeros(len(dense), bool)
    if prof is not None:
        # a bridge: the deck follows the road's own level, not the ground (or water) under it
        src, sh, sb = prof
        from scipy.spatial import cKDTree
        _, ii = cKDTree(src).query(dense)
        fixed = sb[ii]
        hs = np.where(fixed, sh[ii], hs)
    acc = 0.0
    for i in range(len(dense) - 1):
        a, b = dense[i], dense[i + 1]
        seg = float(np.hypot(*(b - a)))
        key = chunk_of(a[0], a[1])
        m = road_meshes.setdefault((key, mat), Mesh())
        P = []
        UV = []
        for (p, nn, h, v) in ((a, nrm[i], hs[i], acc), (b, nrm[i + 1], hs[i + 1], acc + seg)):
            for s in (-1, 1):
                q = p + nn * s * w / 2
                P.append((q[0], (h if fixed[i] else max(h, hat(q[0], q[1]))) + lift, q[1]))
                UV.append((0.5 + s * 0.5, v / 8.0))
        P = [P[0], P[1], P[3], P[2]]
        UV = [UV[0], UV[1], UV[3], UV[2]]
        m.add(mat, P, [(0, 1, 0)] * 4, UV, [(0, 2, 1), (0, 3, 2)])
        if kerb:
            # the two sides, down into the ground (a raised pavement must not float)
            for (ia, ib, sgn) in ((0, 3, -1), (1, 2, 1)):
                A, B = P[ia], P[ib]
                C = (B[0], B[1] - lift - 0.25, B[2])
                D = (A[0], A[1] - lift - 0.25, A[2])
                nn_ = (float(nrm[i][0]) * sgn, 0.0, float(nrm[i][1]) * sgn)
                tri = [(0, 2, 1), (0, 3, 2)] if sgn < 0 else [(0, 1, 2), (0, 2, 3)]
                m.add(mat, [A, B, C, D], [nn_] * 4, [(0, 0), (seg / 8.0, 0), (seg / 8.0, 0.05), (0, 0.05)], tri)
        acc += seg


for dense_, rd in road_dense:
    strip(rd['pts'], rd['w'], 'road_' + rd['kind'], prof=(dense_, rd['hs'], rd['bridge']))
    if rd['bridge'].any():
        bridge_parts(dense_, rd['hs'], rd['bridge'], rd['w'])
for rd in STREETS:
    strip(rd['pts'], rd['w'], 'road_' + rd['kind'])
for sw_ in SIDEWALKS:
    strip(sw_['pts'], sw_['w'], 'road_concrete', lift=0.24, kerb=True)
# runway with centre-line and threshold markings, taxiway, apron
rw_y = ap_level
def rect(cx, cz, hw, hd, mat, lift, y=None):
    key = chunk_of(cx, cz)
    m = road_meshes.setdefault((key, mat), Mesh())
    yy = rw_y if y is None else y
    P = [(cx - hw, yy + lift, cz - hd), (cx + hw, yy + lift, cz - hd), (cx + hw, yy + lift, cz + hd), (cx - hw, yy + lift, cz + hd)]
    t = 8.0 if mat.startswith('road') else 1.0
    UV = [(p[0] / t, p[2] / t) for p in P]
    m.add(mat, P, [(0, 1, 0)] * 4, UV, [(0, 2, 1), (0, 3, 2)])


for ap in AIRPORTS:
    ax, az, L, yy = ap['x'], ap['z'], ap['len'], ap['y']
    sc = L / 2400.0
    for k in range(int(L / 200)):   # runway in 200 m pieces (chunks)
        rect(ax - L / 2 + 100 + k * 200, az, 100, ap['wid'] / 2, 'road_runway', 0.14, yy)
    for k in range(int(L / 60)):
        x = ax - L / 2 + 30 + k * 60
        rect(x, az, 15, 0.45, 'mark_white', 0.16, yy)
    for end in (-1, 1):
        for j in range(8):
            rect(ax + end * (L / 2 - 30), az - 18 + j * 5.1, 18, 1.0, 'mark_white', 0.16, yy)
    rect(ax, az - 130, 1150 * sc, 12, 'road_runway', 0.13, yy)                      # taxiway
    rect(ax - 300 * sc, az - 250, 900 * sc, 75, 'road_runway', 0.12, yy)            # apron
    for x in (ax - 1150 * sc, ax + 1150 * sc):
        rect(x, az - 65, 12, 65, 'road_runway', 0.13, yy)
ax, az = AIRPORT['x'], AIRPORT['z']
# the port: a concrete quay and piers out over the sea
rect(PORT['x'] + 110, PORT['z'] - 240, 150, 330, 'road_concrete', 0.1, PORT['y'])
for pz in PORT['piers']:
    for k in range(int(PORT['pier_len'] / 50)):
        cx = PORT['x'] - 60 - k * 50
        rect(cx, PORT['z'] + pz + 20, 25, 18, 'road_concrete', 0.1, PORT['y'])
        m = road_meshes.setdefault((chunk_of(cx, PORT['z'] + pz + 20), 'road_concrete'), Mesh())
        for sx in (-1, 1):
            box(m, 'road_concrete', (cx, PORT['y'] - 8, PORT['z'] + pz + 20 + sx * 14), 2.0, 8.0, 2.0)
# base yards
for team, bx, bz, yaw in BASES:
    rect(bx, bz, 70, 45, 'road_concrete', 0.1)
nodes = []
for (key, mat), m in sorted(road_meshes.items()):
    nodes.append(dict(name='r_%d_%d_%s' % (key[0], key[1], mat), mesh=m))
write_glb(PROJ + '/models/v8/roads.glb', nodes, {}, '')
print('road nodes', len(nodes))

# ---------------------------------------------------------------- vehicles, aircraft, landmarks, wrecks
print('placements', flush=True)
VEH = []        # [kind, x, y, z, yaw]
for team, bx, bz, yaw in BASES:
    cy, sy = math.cos(yaw), math.sin(yaw)
    for k, kind in enumerate(['jeep', 'jeep', 'tank', 'tank', 'apc', 'truck']):
        ox, oz = -50 + k * 20, 25
        x, z = bx + ox * cy + oz * sy, bz - ox * sy + oz * cy
        VEH.append([kind, round(x, 2), round(hat(x, z) + 0.6, 2), round(z, 2), round(yaw, 3), team])
for i, (nm, cx, cz, r, n, st) in enumerate(TOWNS):
    r2 = np.random.RandomState(900 + i)
    for k in range(3 if st != 'village' else 1):
        for _t in range(40):
            x, z = cx + r2.uniform(-r, r) * 0.7, cz + r2.uniform(-r, r) * 0.7
            if free(x, z, 4) and not in_lake(x, z):
                break
        VEH.append([['car', 'jeep', 'car2', 'truck'][r2.randint(4)], round(x, 2), round(hat(x, z) + 0.6, 2), round(z, 2), round(r2.uniform(0, 6.28), 3), -1])
AIR = []        # parked aircraft [kind, x, y, z, yaw]
for ai, ap in enumerate(AIRPORTS):
    sc = ap['len'] / 2400.0
    for k in range(ap['hangars']):
        x = ap['x'] - 1050 * sc + k * 115
        z = ap['z'] - 290 + 2
        AIR.append([['jet', 'jet2', 'heli', 'transport'][(k + ai) % 4], round(x, 2), round(hat(x, z) + 0.2, 2), round(z, 2), 0.0])
BOATS = []
for lk in lake_info:
    a = rs.uniform(0, 6.28)
    x, z = lk['x'] + math.cos(a) * lk['r'] * 0.7, lk['z'] + math.sin(a) * lk['r'] * 0.7
    BOATS.append(['boat', round(x, 2), lk['level'], round(z, 2), round(a + 1.57, 3)])
for k, pz in enumerate(PORT['piers']):
    BOATS.append(['boat', round(PORT['x'] - 150 - k * 30, 2), SEA_LEVEL, round(PORT['z'] + pz + 50, 2), round(math.pi * 0.5, 3)])
for model, x0, z0, yaw in (('fortress', -1400.0, -2350.0, 0.6), ('warehouse', -2950.0, -1550.0, 0.2), ('inn', 2400.0, 2300.0, 1.0)):
    fx, fz = land_spot(x0, z0, 80.0)
    LANDMARKS.append([model, round(fx, 2), round(hat(fx, fz), 2), round(fz, 2), yaw, 1.0])
    occupied.append((fx, fz, 40))
# containers stacked on the quay
for k in range(14):
    x = PORT['x'] + 40 + (k % 7) * 14
    z = PORT['z'] - 120 - (k // 7) * 30
    LANDMARKS.append(['container', round(x, 2), round(PORT['y'] + 0.1, 2), round(z, 2), 0.0, 1.0])
for team, bx, bz, yaw in BASES:
    cy, sy = math.cos(yaw), math.sin(yaw)
    for (ox, oz, model) in ((-110, -90, 'patriot'), (110, -90, 'cram'), (0, -110, 'radar'), (-130, 60, 'watchtower'), (130, 60, 'watchtower')):
        x, z = bx + ox * cy + oz * sy, bz - ox * sy + oz * cy
        LANDMARKS.append([model, round(x, 2), round(hat(x, z), 2), round(z, 2), round(yaw, 3), 1.0])
WRECKS = []
for k in range(8):
    for _t in range(60):
        x, z = rs.uniform(-3500, 3500), rs.uniform(-3000, 3500)
        if not in_lake(x, z, 60) and free(x, z, 40) and not near_road(x, z, 30):
            break
    WRECKS.append([['jet', 'jet2', 'heli', 'transport'][k % 4], round(x, 2), round(hat(x, z), 2), round(z, 2), round(rs.uniform(0, 6.28), 3)])
    occupied.append((x, z, 30))

# ---------------------------------------------------------------- vegetation
print('trees', flush=True)
species = [k for k in TREES]
sp_by = {}
for k, v in TREES.items():
    sp_by.setdefault(v['species'], []).append(k)
forest = fbm(7, 900, 4)
moist = fbm(5, 901, 3)
slope = np.hypot(*np.gradient(H, SP))
VEG = {}
r2 = np.random.RandomState(4242)
cand = r2.uniform(-HALF + 20, HALF - 20, (520000, 2))
fi = np.clip(((cand[:, 1] + HALF) / SP).astype(int), 0, N - 1)
fj = np.clip(((cand[:, 0] + HALF) / SP).astype(int), 0, N - 1)
f = forest[fi, fj]
dens = (sstep(0.5, 0.62, f) * 0.9 + 0.04) * 0.65     # (a third fewer than at first: the owner's ask, and the phones')
keep = r2.rand(len(cand)) < dens
keep &= slope[fi, fj] < 0.9
keep &= H[fi, fj] > 1.5
keep &= lake_mask[fi, fj] < 0.5
from scipy.spatial import cKDTree
occ = np.array([(o[0], o[1]) for o in occupied])
occ_r = np.array([o[2] for o in occupied])
tr = cKDTree(occ)
dd, ii = tr.query(cand)
keep &= dd > occ_r[ii] + 4
for (nm, cx, cz, r, n, st) in TOWNS:
    keep &= np.hypot(cand[:, 0] - cx, cand[:, 1] - cz) > r * 0.75
for ap in AIRPORTS:
    keep &= ~((np.abs(cand[:, 0] - ap['x']) < ap['len'] / 2 + 200) & (np.abs(cand[:, 1] - ap['z'] + 120) < 420))
keep &= ~((np.abs(cand[:, 0] - PORT['x']) < 400) & (np.abs(cand[:, 1] - PORT['z'] + 200) < 420))
_rv = np.concatenate(RIVER_DENSE)
_drv, _irv = cKDTree(_rv).query(cand)
keep &= _drv > 34
for team, bx, bz, yaw in BASES:
    keep &= np.hypot(cand[:, 0] - bx, cand[:, 1] - bz) > 220
allr = np.concatenate([dense for dense, rd in road_dense] + [np.asarray(s['pts']) for s in STREETS])
dr, _ = cKDTree(allr).query(cand)
keep &= dr > 9
cand = cand[keep]
hh = H[np.clip(((cand[:, 1] + HALF) / SP).astype(int), 0, N - 1), np.clip(((cand[:, 0] + HALF) / SP).astype(int), 0, N - 1)]
mo = moist[np.clip(((cand[:, 1] + HALF) / SP).astype(int), 0, N - 1), np.clip(((cand[:, 0] + HALF) / SP).astype(int), 0, N - 1)]
for (x, z), h, m in zip(cand, hh, mo):
    if h > 170:
        sid = r2.choice(['spruce', 'pine', 'spruce'])
    elif m > 0.62:
        sid = r2.choice(['willow', 'birch', 'ash', 'oak'])
    elif m < 0.38:
        sid = r2.choice(['pine', 'oak_m', 'dead', 'cypress'])
    else:
        sid = r2.choice(['oak', 'ash', 'birch', 'oak', 'pine', 'oak_m'])
    if r2.rand() < 0.18:
        sid = r2.choice(['bush', 'bush2', 'bush3'])
    key = sp_by[sid][r2.randint(len(sp_by[sid]))]
    s = r2.uniform(0.75, 1.2)
    VEG.setdefault(key, []).extend([round(float(x), 2), round(hat(x, z) - 0.15, 2), round(float(z), 2), round(r2.uniform(0, 6.283), 3), round(s, 3)])
print('trees', sum(len(v) // 5 for v in VEG.values()))

# ---------------------------------------------------------------- splat maps (8 layers: grass, lush, forest, soil, mud, sand, rock, gravel)
print('splats', flush=True)
S2 = 2048
def rs_(a):
    return np.asarray(Image.fromarray(a.astype(np.float32)).resize((S2, S2), Image.BILINEAR))
Hs = rs_(H)
Ss = rs_(slope)
Fs = rs_(forest)
Ms = rs_(moist)
Ls = rs_(lake_mask)
gx = np.linspace(-HALF, HALF, S2)
GX, GZ = np.meshgrid(gx, gx)
Wl = np.zeros((S2, S2, 8))
# not all green: dry grass and bare soil in big patches, gravel and stone where it is steep or high
dry = rs_(fbm(8, 903, 4))
Wl[..., 0] = 0.75 * (1 - Ms) + 0.15
Wl[..., 1] = sstep(0.5, 0.78, Ms) * 0.9
Wl[..., 2] = sstep(0.5, 0.62, Fs) * 1.6
Wl[..., 3] = 0.3 * sstep(0.55, 0.8, rs_(fbm(30, 902, 3))) + 1.1 * sstep(0.52, 0.7, dry)
Wl[..., 7] = 0.45 * sstep(0.6, 0.78, rs_(fbm(18, 904, 3)))
Wl[..., 6] = sstep(0.55, 0.85, Ss) * 4.0 + sstep(160, 230, Hs) * 1.2
shore = np.zeros((S2, S2))
for lk in lake_info:
    d = np.hypot(GX - lk['x'], GZ - lk['z'])
    shore = np.maximum(shore, sstep(lk['r'] * 1.35, lk['r'] * 1.0, d) * (Hs < lk['level'] + 4))
Wl[..., 5] = shore * 2.5 + sstep(7, 1, Hs) * 3.5
Wl[..., 4] = shore * sstep(0.5, 0.8, Ms) * 1.5 + Ls * 0.5
# river banks: mud at the water, sand and gravel bars
rv_all = np.concatenate(RIVER_DENSE)
from scipy.spatial import cKDTree as _KD
_d, _ = _KD(rv_all[::2]).query(np.stack([GX.ravel(), GZ.ravel()], 1))
_d = _d.reshape(GX.shape)
Wl[..., 4] += sstep(60, 20, _d) * 2.0
Wl[..., 5] += sstep(45, 22, _d) * 1.2
# towns: worn soil and gravel; roads add gravel at their edges
for (nm, cx, cz, r, n, st) in TOWNS:
    d = np.hypot(GX - cx, GZ - cz)
    k = sstep(r, r * 0.6, d)
    Wl[..., 3] += k * 0.8
    Wl[..., 7] += k * 0.6
road_px = np.zeros((S2, S2))
for p in allr[::2]:
    i, j = int((p[1] + HALF) / (2 * HALF) * (S2 - 1)), int((p[0] + HALF) / (2 * HALF) * (S2 - 1))
    if 0 <= i < S2 and 0 <= j < S2:
        road_px[i, j] = 1.0
road_px = ndimage.maximum_filter(road_px, 3)
Wl[..., 7] += road_px * 4.0
# paved and trodden ground where nothing grows: the airfield (runway, taxiway, apron, hangar row), the base yards, the
# capture points (the ground cover reads these layers and keeps off)
def soft_rect(cx, cz, hw, hd, edge=20.0):
    return sstep(hw + edge, hw, np.abs(GX - cx)) * sstep(hd + edge, hd, np.abs(GZ - cz))
_aps = []
for ap in AIRPORTS:
    sc = ap['len'] / 2400.0
    _aps += [soft_rect(ap['x'], ap['z'], ap['len'] / 2 + 60, ap['wid'] / 2 + 10), soft_rect(ap['x'], ap['z'] - 130, 1160 * sc, 20),
             soft_rect(ap['x'] - 300 * sc, ap['z'] - 260, 920 * sc, 95),
             soft_rect(ap['x'] - 1150 * sc, ap['z'] - 65, 20, 75), soft_rect(ap['x'] + 1150 * sc, ap['z'] - 65, 20, 75)]
_aps.append(soft_rect(PORT['x'] + 110, PORT['z'] - 240, 170, 350))
apk = np.maximum.reduce(_aps)
Wl[..., 7] += apk * 8.0
for (team, bx, bz, yaw) in BASES:
    d = np.hypot(GX - bx, GZ - bz)
    Wl[..., 7] += sstep(150, 100, d) * 3.0
    Wl[..., 3] += sstep(190, 130, d) * 1.2
for (px, pz) in CAPTURE:
    d = np.hypot(GX - px, GZ - pz)
    Wl[..., 3] += sstep(30, 18, d) * 3.0
    Wl[..., 7] += sstep(22, 12, d) * 2.0
# (the city patch paints its own streets, sharp: it starts from the splat without the coarse road paint)
Wl_nr = Wl.astype(np.float32)
Wl_nr[..., 7] -= road_px * 4.0
Wl_nr = np.maximum(Wl_nr, 0)
Wl_nr /= Wl_nr.sum(-1, keepdims=True) + 1e-6
Wl = np.maximum(Wl, 0)
Wl /= Wl.sum(-1, keepdims=True) + 1e-6
A = (Wl[..., 0:4] * 255 + 0.5).astype(np.uint8)
Bm = (Wl[..., 4:8] * 255 + 0.5).astype(np.uint8)
Image.fromarray(A, 'RGBA').save(OUT + '/splat_base_a.png')
Image.fromarray(Bm, 'RGBA').save(OUT + '/splat_base_b.png')

# ---------------------------------------------------------------- the detail patch: centre 1 x 1 km at 0.5 m with craters
print('war patch', flush=True)
WN = 2049
WH = 512.0
wx = np.linspace(-WH, WH, WN)
WX, WZ = np.meshgrid(wx, wx)
from scipy.interpolate import RectBivariateSpline
spl = RectBivariateSpline(xs, xs, H.T, kx=3, ky=3)
W = spl.ev(WX.ravel(), WZ.ravel()).reshape(WN, WN)
# the streets and roads through the patch, sharp (1 m): how far each pixel lies beyond the edge of the nearest one
WS = 1024
cx_ = np.linspace(-WH, WH, WS)
CX, CZ = np.meshgrid(cx_, cx_)
_sp, _hw = [], []
for line, half_w in [(dn, rd['w'] / 2) for dn, rd in road_dense] + [(np.asarray(st['pts']), st['w'] / 2) for st in STREETS]:
    line = np.asarray(line, np.float64)
    if not ((np.abs(line[:, 0]) < WH + 60) & (np.abs(line[:, 1]) < WH + 60)).any():
        continue
    for i in range(len(line) - 1):
        a, b = line[i], line[i + 1]
        n_ = max(1, int(np.hypot(*(b - a)) / 1.2))
        t = np.linspace(0, 1, n_, endpoint=False)[:, None]
        _sp.append(a + (b - a) * t)
        _hw.append(np.full(n_, half_w))
_sp = np.concatenate(_sp)
_hw = np.concatenate(_hw)
from scipy.spatial import cKDTree as _KD2
_tree = _KD2(_sp)
_dq, _iq = _tree.query(np.stack([CX.ravel(), CZ.ravel()], 1), distance_upper_bound=40.0)
_far = ~np.isfinite(_dq)
road_e = np.where(_far, 99.0, _dq - _hw[np.where(_far, 0, _iq)]).reshape(WS, WS)


def road_edge_at(x, z):
    d, i = _tree.query((x, z))
    return d - _hw[i]


r3 = np.random.RandomState(55)
CRATERS = []
for k in range(140):
    cx, cz = r3.uniform(-480, 480, 2)
    if any(math.hypot(cx - px, cz - pz) < 28 for px, pz in CAPTURE):
        continue
    if any(math.hypot(cx - o[0], cz - o[1]) < o[2] + 4 for o in occupied):
        continue
    rr = r3.uniform(1.8, 5.5)
    if road_edge_at(cx, cz) < rr * 1.7 + 1.0:
        continue                                  # the road meshes are flat: a crater under one would be a hole
    d = np.hypot(WX - cx, WZ - cz) / rr
    m = d < 1.6
    W[m] += np.where(d[m] < 1.0, -rr * 0.35 * (1 - d[m] ** 2), rr * 0.12 * np.clip(1.6 - d[m], 0, 0.6) * np.clip(d[m] - 1.0, 0, 1) * 4)
    CRATERS.append((round(cx, 2), round(cz, 2), round(rr, 2)))
# keep the patch edge identical to the base
edge = np.minimum(np.minimum(WX + WH, WH - WX), np.minimum(WZ + WH, WH - WZ))
kk = sstep(0, 24, edge)
W = spl.ev(WX.ravel(), WZ.ravel()).reshape(WN, WN) * (1 - kk) + W * kk
# The patch's splat: the island's own under it (so the seams match), then the city: the ground dry and patchy (worn soil
# and grit, the grass in tufts), gravel under every street and road (nothing grows through), worn verges, trodden yards
# round the houses, churned soil and mud at the craters.
fi = (CZ + HALF) / (2 * HALF) * (S2 - 1)
fj = (CX + HALF) / (2 * HALF) * (S2 - 1)
Wp = np.stack([ndimage.map_coordinates(Wl_nr[..., c], [fi, fj], order=1) for c in range(8)], -1).astype(np.float64)
city_r = TOWNS[0][3]
in_city = sstep(city_r * 1.05, city_r * 0.7, np.hypot(CX, CZ))
for (px, pz) in CAPTURE[1:]:
    in_city = np.maximum(in_city, sstep(200, 120, np.hypot(CX - px, CZ - pz)))
in_city *= sstep(0, 60, np.minimum(np.minimum(CX + WH, WH - CX), np.minimum(CZ + WH, WH - CZ)))   # no seam at the rim
rn = ndimage.gaussian_filter(np.random.RandomState(57).rand(WS, WS), 5)
rn = (rn - rn.min()) / (rn.max() - rn.min() + 1e-9)
Wp[..., 0] *= 1 - 0.55 * in_city
Wp[..., 1] *= 1 - 0.75 * in_city
Wp[..., 3] += in_city * (0.35 + 0.5 * sstep(0.45, 0.7, rn))
Wp[..., 7] *= 1.0 - 0.7 * in_city
Wp[..., 7] += in_city * 0.16 * sstep(0.6, 0.85, rn)
Wp[..., 7] += sstep(1.2, -0.6, road_e) * 3.0
Wp[..., 3] += sstep(5.0, 0.5, road_e) * 0.9
yard = np.zeros((WS, WS))
for b in BUILDINGS:
    if abs(b[1]) < WH + 30 and abs(b[3]) < WH + 30:
        dims = PREF.get(b[0], {'w': 10, 'd': 10})
        rad = math.hypot(dims['w'], dims['d']) * 0.5
        j0, i0 = int((b[1] + WH) / (2 * WH) * (WS - 1)), int((b[3] + WH) / (2 * WH) * (WS - 1))
        R = int(rad + 7)
        ia, ib, ja, jb = max(i0 - R, 0), min(i0 + R + 1, WS), max(j0 - R, 0), min(j0 + R + 1, WS)
        if ia >= ib or ja >= jb:
            continue
        dd = np.hypot(CX[ia:ib, ja:jb] - b[1], CZ[ia:ib, ja:jb] - b[3])
        yard[ia:ib, ja:jb] = np.maximum(yard[ia:ib, ja:jb], sstep(rad + 6, rad + 1, dd))
Wp[..., 3] += yard * 0.9
Wp[..., 7] += yard * 0.2
cr = np.zeros((WS, WS))
for (cx, cz, rr) in CRATERS:
    cr = np.maximum(cr, sstep(rr * 1.7, rr * 0.6, np.hypot(CX - cx, CZ - cz)))
Wp[..., 3] += cr * 0.8
Wp[..., 4] += cr * 1.4
Wp = np.maximum(Wp, 0)
Wp /= Wp.sum(-1, keepdims=True) + 1e-6
Image.fromarray((Wp[..., 0:4] * 255 + 0.5).astype(np.uint8), 'RGBA').save(OUT + '/splat_war_a.png')
Image.fromarray((Wp[..., 4:8] * 255 + 0.5).astype(np.uint8), 'RGBA').save(OUT + '/splat_war_b.png')

# ---------------------------------------------------------------- write
H.astype('<f4').tofile(OUT + '/base_h.f32')
W.astype('<f4').tofile(OUT + '/war_h.f32')
spawns = {}
for team, bx, bz, yaw in BASES:
    pts = []
    for k in range(12):
        a = k / 12 * math.tau
        x, z = bx + math.cos(a) * 30, bz + math.sin(a) * 30
        pts.append([round(x, 2), round(hat(x, z) + 0.1, 2), round(z, 2)])
    spawns[str(team)] = pts
menu = []
for k in range(6):
    a = k / 6 * math.tau
    x, z = math.cos(a) * 320, math.sin(a) * 320
    menu.append([round(x, 2), round(hat(x, z) + 14, 2), round(z, 2)])
lay = dict(
    map='valley', half=HALF, n=N, sea_level=SEA_LEVEL, war_half=WH, war_n=WN,
    lakes=lake_info, towns=[dict(name=t[0], x=t[1], z=t[2], r=t[3]) for t in TOWNS],
    buildings=BUILDINGS, vehicles=VEH, aircraft=AIR, boats=BOATS, landmarks=LANDMARKS, wrecks=WRECKS, street_props=STREET_PROPS,
    capture=[dict(name=CAP_NAMES[i], x=p[0], z=p[1], y=round(hat(*p), 2)) for i, p in enumerate(CAPTURE)],
    bases=[dict(team=b[0], x=b[1], z=b[2], yaw=b[3]) for b in BASES], spawns=spawns,
    airport=dict(AIRPORT, y=round(ap_level, 2)), airports=[dict(a, y=round(a['y'], 2)) for a in AIRPORTS],
    port=dict(PORT), rivers=RIVER_OUT, bridges=BRIDGES, island=True,
    roads=[dict(w=rd['w'], kind=rd['kind'], pts=[[round(float(p[0]), 1), round(float(p[1]), 1)] for p in dn[::4]]) for dn, rd in road_dense],
    streets=[dict(w=rd['w'], kind=rd['kind'], pts=[[round(float(p[0]), 1), round(float(p[1]), 1)] for p in rd['pts']]) for rd in STREETS],
    mountains=[dict(name=m[0], x=m[1], z=m[2], r=m[3]) for m in MOUNTAINS],
    veg=VEG, craters=CRATERS, menu_cam=menu,
    spawn=[BASES[0][1], round(hat(BASES[0][1], BASES[0][2]) + 0.1, 2), BASES[0][2], 0.0],
)
json.dump(lay, open(OUT + '/layout.json', 'w'), separators=(',', ':'), ensure_ascii=False)
print('done', 'buildings', len(BUILDINGS), 'vehicles', len(VEH), 'aircraft', len(AIR), 'wrecks', len(WRECKS), 'street props', len(STREET_PROPS))
