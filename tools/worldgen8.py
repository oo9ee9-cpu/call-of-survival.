"""The 8 x 8 km valley: rolling green hills, a mountain range in the north, a sea bay in the west, six lakes, seven
abandoned towns and villages (400+ houses you can enter), a big airport, two team bases, five capture zones (each with a
computer) in the ruined city in the middle, crash sites, forests. Writes heights, splat maps, road meshes and the layout.
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
H = 55.0 + 70.0 * (fbm(3, 1, 3) - 0.5) + 30.0 * (fbm(9, 2, 4) - 0.5) + 6.0 * (fbm(40, 3, 3) - 0.5)
ridge = 1.0 - np.abs(fbm(6, 4, 4) * 2 - 1)
H += 210.0 * sstep(-2300, -3700, Z) * (0.45 + 0.55 * ridge ** 2)          # mountains in the north
H += 60.0 * sstep(2600, 3900, X) * sstep(-1000, -3500, Z) * ridge         # north-east hills
# the sea bay in the west
coast = -3300 + 260 * (fbm(5, 7, 3) - 0.5) + 400 * np.cos(Z / 1300.0)
sea = sstep(coast + 250, coast - 350, X)
H = H * (1 - sea) + (-14.0) * sea
SEA_LEVEL = 0.0


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
LAKES = [  # x, z, radius, carrier model, carrier yaw
    (-1650, -350, 640, 'cvn80', 0.4), (1750, -800, 660, 'cdg', -0.3), (-2450, 1050, 560, 'cvn65', 1.2),
    (2750, 1700, 540, 'cdg', 0.9), (-250, -2650, 600, 'cvn80', -0.8), (3150, -2550, 520, 'cvn65', 0.2),
]
lake_mask = np.zeros((N, N))
lake_info = []
for i, (cx, cz, r, model, yaw) in enumerate(LAKES):
    ang = np.arctan2(Z - cz, X - cx)
    wob = 1.0 + 0.16 * np.sin(ang * 3 + i) + 0.1 * np.sin(ang * 5 + 2 * i) + 0.08 * (vnoise(N, 12, 50 + i) - 0.5)
    d = np.hypot(X - cx, Z - cz) / (r * wob)
    near = d < 1.6
    shore = float(np.percentile(H[(d > 1.0) & (d < 1.25)], 20))
    level = shore - 1.2
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
TOWNS = [  # name, x, z, radius, buildings target, style
    ('المدينة المدمرة', 0, 0, 640, 130, 'city'), ('شمال الغرب', -2350, -1750, 420, 62, 'town'),
    ('التلال الشرقية', 2250, -2050, 380, 52, 'town'), ('الوادي الجنوبي', -2500, 2250, 420, 58, 'town'),
    ('المدينة الشرقية', 3050, 650, 360, 48, 'town'), ('بلدة المطار', 350, 2900, 380, 52, 'town'),
    ('قرية الجبل', -1150, -3050, 170, 14, 'village'), ('قرية الصنوبر', 1250, -3150, 170, 13, 'village'),
    ('قرية الساحل', -2500, -500, 170, 14, 'village'), ('قرية الشرق', 3450, -650, 160, 12, 'village'),
    ('قرية الجنوب', -1000, 3350, 170, 13, 'village'), ('قرية الحقول', 1750, 2050, 160, 12, 'village'),
]
BASES = [(0, -600.0, 1550.0, math.pi), (1, 650.0, -1500.0, 0.0)]    # team, x, z, yaw (fronts face the centre)
AIRPORT = dict(x=2250.0, z=3200.0, len=2400.0, wid=45.0)
CAPTURE = [(0.0, 0.0), (-470.0, -260.0), (440.0, -320.0), (-400.0, 400.0), (420.0, 370.0)]
CAP_NAMES = ['ألف', 'باء', 'جيم', 'دال', 'هاء']

print('flatten', flush=True)
town_levels = []
for (nm, cx, cz, r, n, st) in TOWNS:
    town_levels.append(flatten(cx, cz, r * 0.92, edge=r * 0.4, w=0.85))
for (team, bx, bz, yaw) in BASES:
    flatten(bx, bz, 230, edge=160)
ap_level = float(np.median(H[(np.abs(X - AIRPORT['x']) < 1300) & (np.abs(Z - AIRPORT['z']) < 350)]))
flatten_rect(AIRPORT['x'], AIRPORT['z'] - 120, 1300, 330, ap_level, edge=260)

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
links = [('المدينة المدمرة', 'شمال الغرب'), ('المدينة المدمرة', 'التلال الشرقية'), ('المدينة المدمرة', 'الوادي الجنوبي'),
         ('المدينة المدمرة', 'المدينة الشرقية'), ('المدينة المدمرة', 'بلدة المطار'), ('شمال الغرب', 'قرية الجبل'),
         ('التلال الشرقية', 'قرية الصنوبر'), ('شمال الغرب', 'قرية الساحل'), ('المدينة الشرقية', 'قرية الشرق'),
         ('الوادي الجنوبي', 'قرية الجنوب'), ('بلدة المطار', 'قرية الحقول'), ('قرية الحقول', 'المدينة الشرقية'),
         ('قرية الجبل', 'قرية الصنوبر'), ('الوادي الجنوبي', 'قرية الساحل')]
for i, (a, b) in enumerate(links):
    ROADS.append(dict(w=8.0, kind='asphalt', pts=road_path(P[a], P[b], 0.1, i)))
ROADS.append(dict(w=8.0, kind='asphalt', pts=road_path(P['بلدة المطار'], (AIRPORT['x'] - 900, AIRPORT['z'] - 330), 0.06, 50)))
for team, bx, bz, yaw in BASES:
    ROADS.append(dict(w=6.0, kind='dirt', pts=road_path((bx, bz), CENTER, 0.08, 60 + team)))


def carve_road(pts, w):
    """level the ground along a road: smooth profile along it, blended out over 18 m"""
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
    hs = ndimage.gaussian_filter1d(hs, 12, mode='nearest')
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
    blk = H[lo[1]:hi[1] + 1, lo[0]:hi[0] + 1]
    H[lo[1]:hi[1] + 1, lo[0]:hi[0] + 1] = blk * (1 - k) + target * k
    return dense, hs


print('roads', flush=True)
road_dense = []
for rd in ROADS:
    dense, hs = carve_road(rd['pts'], rd['w'])
    road_dense.append((dense, rd))

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


def free(x, z, r):
    for (ox, oz, orr) in occupied:
        if (x - ox) ** 2 + (z - oz) ** 2 < (r + orr) ** 2:
            return False
    if np.hypot(x - AIRPORT['x'], z - AIRPORT['z']) < 1400 and abs(z - AIRPORT['z']) < 420 and abs(x - AIRPORT['x']) < 1400:
        return False
    return True


def near_road(x, z, margin):
    for dense, rd in road_dense:
        d = np.min(np.hypot(dense[:, 0] - x, dense[:, 1] - z))
        if d < rd['w'] * 0.5 + margin:
            return True
    return False


def in_lake(x, z, margin=30):
    for lk in lake_info:
        if math.hypot(x - lk['x'], z - lk['z']) < lk['r'] * 1.15 + margin:
            return True
    return x < -3100 + 400 * math.cos(z / 1300.0)


def pick(style, r2):
    opts = HOUSE_TYPES[style]
    tot = sum(w for _, w in opts)
    q = r2.uniform(0, tot)
    for t, w in opts:
        q -= w
        if q <= 0:
            return t
    return opts[0][0]


for ti, (nm, cx, cz, r, target, style) in enumerate(TOWNS):
    r2 = np.random.RandomState(300 + ti)
    rot = r2.uniform(0, math.pi / 2)
    ca, sa = math.cos(rot), math.sin(rot)
    block = 46.0 if style != 'village' else 60.0
    # street grid: lines every `block` metres in a rotated frame
    n = int(r / block)
    for k in range(-n, n + 1):
        for axis in (0, 1):
            pts = []
            for s in np.linspace(-r * 0.95, r * 0.95, 24):
                u, v = (s, k * block) if axis == 0 else (k * block, s)
                x = cx + u * ca - v * sa
                z = cz + u * sa + v * ca
                if math.hypot(x - cx, z - cz) < r * 0.95:
                    pts.append((x, z))
            if len(pts) >= 3 and (style != 'village' or k == 0):
                STREETS.append(dict(w=7.0 if style == 'city' else 6.0, kind='asphalt' if style != 'village' else 'dirt', pts=pts))
    placed = 0
    tries = 0
    while placed < target and tries < target * 40:
        tries += 1
        # a lot facing a street: snap to the nearest street line in the rotated frame
        u = r2.uniform(-r, r)
        v = r2.uniform(-r, r)
        if u * u + v * v > (r * 0.92) ** 2:
            continue
        kk = round(v / block)
        side = 1 if v > kk * block else -1
        typ = pick(style, r2)
        dims = PREF[typ]
        setback = 4.5 + dims['d'] / 2
        if style == 'village':
            kk = 0
            side = 1 if v > 0 else -1
        v = kk * block + side * setback
        if style != 'village' and abs(v - kk * block) > block / 2 - 2:
            continue
        x = cx + u * ca - v * sa
        z = cz + u * sa + v * ca
        rad = math.hypot(dims['w'], dims['d']) * 0.5 + 1.5
        if not free(x, z, rad) or in_lake(x, z) or near_road(x, z, rad * 0.7):
            continue
        # face the street: front (+Z local) points back towards the street line
        yaw = -rot + (math.pi if side > 0 else 0.0)   # Godot yaw: front (+Z) towards the street
        y = hat(x, z)
        BUILDINGS.append([typ, round(x, 2), round(y, 2), round(z, 2), round(yaw, 4), int(r2.randint(0, 8))])
        occupied.append((x, z, rad))
        placed += 1
    print(' ', nm, placed, 'buildings')

# farms in the open
r2 = np.random.RandomState(77)
farms = 0
while farms < 26:
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

# airport: runway, apron, hangars, tower, terminal
ax, az = AIRPORT['x'], AIRPORT['z']
for k in range(10):
    x = ax - 1050 + k * 115
    z = az - 290
    BUILDINGS.append(['hangar', round(x, 2), round(hat(x, z), 2), round(z, 2), 0.0, 0])
BUILDINGS.append(['control_tower', ax + 300, round(hat(ax + 300, az - 190), 2), az - 190, 0.0, 4])
BUILDINGS.append(['terminal', ax - 450, round(hat(ax - 450, az - 210), 2), az - 210, 0.0, 5])
print('buildings total', len(BUILDINGS))

# ---------------------------------------------------------------- road / runway meshes (chunked)
print('road meshes', flush=True)
CH = 1024.0
road_meshes = {}


def chunk_of(x, z):
    return (int(math.floor((x + HALF) / CH)), int(math.floor((z + HALF) / CH)))


def strip(pts, w, mat, lift=0.12, step=6.0):
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
                P.append((q[0], max(h, hat(q[0], q[1])) + lift, q[1]))
                UV.append((0.5 + s * 0.5, v / 8.0))
        P = [P[0], P[1], P[3], P[2]]
        UV = [UV[0], UV[1], UV[3], UV[2]]
        m.add(mat, P, [(0, 1, 0)] * 4, UV, [(0, 2, 1), (0, 3, 2)])
        acc += seg


for rd in ROADS + STREETS:
    strip(rd['pts'], rd['w'], 'road_' + rd['kind'])
# runway with centre-line and threshold markings, taxiway, apron
rw_y = ap_level
def rect(cx, cz, hw, hd, mat, lift):
    key = chunk_of(cx, cz)
    m = road_meshes.setdefault((key, mat), Mesh())
    P = [(cx - hw, rw_y + lift, cz - hd), (cx + hw, rw_y + lift, cz - hd), (cx + hw, rw_y + lift, cz + hd), (cx - hw, rw_y + lift, cz + hd)]
    t = 8.0 if mat.startswith('road') else 1.0
    UV = [(p[0] / t, p[2] / t) for p in P]
    m.add(mat, P, [(0, 1, 0)] * 4, UV, [(0, 2, 1), (0, 3, 2)])


L = AIRPORT['len']
for k in range(12):   # runway in 200 m pieces (chunks)
    rect(ax - L / 2 + 100 + k * 200, az, 100, AIRPORT['wid'] / 2, 'road_runway', 0.14)
for k in range(int(L / 60)):
    x = ax - L / 2 + 30 + k * 60
    rect(x, az, 15, 0.45, 'mark_white', 0.16)
for end in (-1, 1):
    for j in range(8):
        rect(ax + end * (L / 2 - 30), az - 18 + j * 5.1, 18, 1.0, 'mark_white', 0.16)
rect(ax, az - 130, 1150, 12, 'road_runway', 0.13)                      # taxiway
rect(ax - 300, az - 250, 900, 75, 'road_runway', 0.12)                 # apron
for x in (ax - 1150, ax + 1150):
    rect(x, az - 65, 12, 65, 'road_runway', 0.13)
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
for k in range(10):
    x = ax - 1050 + k * 115
    z = az - 290 + 2
    AIR.append([['jet', 'jet2', 'heli', 'transport'][k % 4], round(x, 2), round(hat(x, z) + 0.2, 2), round(z, 2), 0.0])
BOATS = []
for lk in lake_info:
    a = rs.uniform(0, 6.28)
    x, z = lk['x'] + math.cos(a) * lk['r'] * 0.7, lk['z'] + math.sin(a) * lk['r'] * 0.7
    BOATS.append(['boat', round(x, 2), lk['level'], round(z, 2), round(a + 1.57, 3)])
LANDMARKS = []  # [model, x, y, z, yaw, scale]
for i, model in enumerate(['cathedral', 'res_contemporary', 'res_multistory', 'res_facade']):
    a = i * 1.57 + 0.6
    x, z = math.cos(a) * 210, math.sin(a) * 210
    LANDMARKS.append([model, round(x, 2), round(hat(x, z), 2), round(z, 2), round(math.atan2(-x, -z), 3), 1.0])
    occupied.append((x, z, 35))
fx, fz = -1400.0, -2200.0
LANDMARKS.append(['fortress', fx, round(hat(fx, fz), 2), fz, 0.6, 1.0])
LANDMARKS.append(['warehouse', -2250.0, round(hat(-2250, -1600), 2), -1600.0, 0.2, 1.0])
LANDMARKS.append(['inn', -1150.0, round(hat(-1150, -2950), 2), -2950.0, 1.0, 1.0])
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
dens = sstep(0.5, 0.62, f) * 0.9 + 0.04
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
keep &= ~((np.abs(cand[:, 0] - ax) < 1400) & (np.abs(cand[:, 1] - az + 120) < 420))
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
Wl[..., 0] = 0.9 * (1 - Ms) + 0.2
Wl[..., 1] = sstep(0.45, 0.75, Ms) * 1.1
Wl[..., 2] = sstep(0.5, 0.62, Fs) * 1.6
Wl[..., 3] = 0.25 * sstep(0.55, 0.8, rs_(fbm(30, 902, 3)))
Wl[..., 6] = sstep(0.55, 0.85, Ss) * 4.0 + sstep(160, 230, Hs) * 1.2
shore = np.zeros((S2, S2))
for lk in lake_info:
    d = np.hypot(GX - lk['x'], GZ - lk['z'])
    shore = np.maximum(shore, sstep(lk['r'] * 1.35, lk['r'] * 1.0, d) * (Hs < lk['level'] + 4))
Wl[..., 5] = shore * 2.5 + sstep(6, 0, Hs) * 3.0
Wl[..., 4] = shore * sstep(0.5, 0.8, Ms) * 1.5 + Ls * 0.5
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
apk = np.maximum.reduce([soft_rect(AIRPORT['x'], AIRPORT['z'], AIRPORT['len'] / 2 + 60, AIRPORT['wid'] / 2 + 10),
                         soft_rect(AIRPORT['x'], AIRPORT['z'] - 130, 1160, 20),
                         soft_rect(AIRPORT['x'] - 300, AIRPORT['z'] - 260, 920, 95),
                         soft_rect(AIRPORT['x'] - 1150, AIRPORT['z'] - 65, 20, 75), soft_rect(AIRPORT['x'] + 1150, AIRPORT['z'] - 65, 20, 75)])
Wl[..., 7] += apk * 8.0
for (team, bx, bz, yaw) in BASES:
    d = np.hypot(GX - bx, GZ - bz)
    Wl[..., 7] += sstep(150, 100, d) * 3.0
    Wl[..., 3] += sstep(190, 130, d) * 1.2
for (px, pz) in CAPTURE:
    d = np.hypot(GX - px, GZ - pz)
    Wl[..., 3] += sstep(30, 18, d) * 3.0
    Wl[..., 7] += sstep(22, 12, d) * 2.0
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
r3 = np.random.RandomState(55)
CRATERS = []
for k in range(140):
    cx, cz = r3.uniform(-480, 480, 2)
    if any(math.hypot(cx - px, cz - pz) < 28 for px, pz in CAPTURE):
        continue
    if any(math.hypot(cx - o[0], cz - o[1]) < o[2] + 4 for o in occupied):
        continue
    rr = r3.uniform(1.8, 5.5)
    d = np.hypot(WX - cx, WZ - cz) / rr
    m = d < 1.6
    W[m] += np.where(d[m] < 1.0, -rr * 0.35 * (1 - d[m] ** 2), rr * 0.12 * np.clip(1.6 - d[m], 0, 0.6) * np.clip(d[m] - 1.0, 0, 1) * 4)
    CRATERS.append((round(cx, 2), round(cz, 2), round(rr, 2)))
# keep the patch edge identical to the base
edge = np.minimum(np.minimum(WX + WH, WH - WX), np.minimum(WZ + WH, WH - WZ))
kk = sstep(0, 24, edge)
W = spl.ev(WX.ravel(), WZ.ravel()).reshape(WN, WN) * (1 - kk) + W * kk
Wa = np.zeros((1024, 1024, 4))
Wb = np.zeros((1024, 1024, 4))
base_a = np.asarray(Image.fromarray(A, 'RGBA').resize((1024, 1024), Image.BILINEAR)).astype(np.float64) / 255  # not used: recompute locally
cx_ = np.linspace(-WH, WH, 1024)
CX, CZ = np.meshgrid(cx_, cx_)
cr = np.zeros((1024, 1024))
for (cx, cz, rr) in CRATERS:
    cr = np.maximum(cr, sstep(rr * 1.7, rr * 0.6, np.hypot(CX - cx, CZ - cz)))
churn = np.clip(cr + 0.35 * ndimage.gaussian_filter(np.random.RandomState(56).rand(1024, 1024), 6) * 2, 0, 1)
Wa[..., 0] = 0.6 * (1 - churn)
Wa[..., 1] = 0.2 * (1 - churn)
Wa[..., 3] = 0.6 * churn + 0.3
Wb[..., 0] = cr * 1.2
Wb[..., 3] = 0.25
tot = Wa.sum(-1, keepdims=True) + Wb.sum(-1, keepdims=True) + 1e-6
Image.fromarray((Wa / tot * 255 + 0.5).astype(np.uint8), 'RGBA').save(OUT + '/splat_war_a.png')
Image.fromarray((Wb / tot * 255 + 0.5).astype(np.uint8), 'RGBA').save(OUT + '/splat_war_b.png')

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
    buildings=BUILDINGS, vehicles=VEH, aircraft=AIR, boats=BOATS, landmarks=LANDMARKS, wrecks=WRECKS,
    capture=[dict(name=CAP_NAMES[i], x=p[0], z=p[1], y=round(hat(*p), 2)) for i, p in enumerate(CAPTURE)],
    bases=[dict(team=b[0], x=b[1], z=b[2], yaw=b[3]) for b in BASES], spawns=spawns, airport=dict(AIRPORT, y=round(ap_level, 2)),
    veg=VEG, craters=CRATERS, menu_cam=menu,
    spawn=[BASES[0][1], round(hat(BASES[0][1], BASES[0][2]) + 0.1, 2), BASES[0][2], 0.0],
)
json.dump(lay, open(OUT + '/layout.json', 'w'), separators=(',', ':'), ensure_ascii=False)
print('done', 'buildings', len(BUILDINGS), 'vehicles', len(VEH), 'aircraft', len(AIR), 'wrecks', len(WRECKS))
