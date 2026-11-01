#!/usr/bin/env python3
"""Call of Survival: Front - world generator.

Writes into <out>:
  base_h.f32   1537x1537 float32 heights, 2 m spacing, x/z from -1536 to 1536 (row = z, column = x)
  war_h.f32    2049x2049 float32 heights, 0.25 m spacing, x/z from -256 to 256 (trenches, craters, dugout pits)
  layout.json  every placement (vegetation by 32 m cell, war props by 64 m chunk, dugouts, pylons, water, ...)
and into <project>/textures/terrain/: splat_base_a/b.png (3 m texels), splat_war_a/b.png (0.5 m texels)
Layers: 0 needles 1 litter 2 dry grass 3 soil 4 mud 5 ash 6 clay (walls, shader only) 7 gravel
usage: python3 worldgen.py <build_dir> <project_dir>
"""
import sys, os, json, math
import numpy as np
from scipy import ndimage
from PIL import Image

OUT, PROJ = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True); os.makedirs(PROJ + '/textures/terrain', exist_ok=True)
RS = np.random.RandomState(20261031)

BN, BX0, BS = 1537, -1536.0, 2.0
WN, WX0, WS = 2049, -256.0, 0.25
HALF = 1536.0

def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0); return t * t * (3 - 2 * t)

class Noise:
    def __init__(self, seed, cell, extent=3600.0):
        n = int(extent / cell) + 8
        g = np.random.RandomState(seed).rand(n, n) * 2 - 1
        self.g = ndimage.spline_filter(g, order=3); self.cell = cell; self.c = n / 2.0
    def __call__(self, x, z):
        x = np.asarray(x, np.float64); z = np.asarray(z, np.float64); sh = np.broadcast(x, z).shape
        x = np.broadcast_to(x, sh).reshape(-1); z = np.broadcast_to(z, sh).reshape(-1)
        r = ndimage.map_coordinates(self.g, [z / self.cell + self.c, x / self.cell + self.c], order=3, prefilter=False, mode='nearest')
        return r.reshape(sh) if sh else r[0]

N1, N2, N3, N4, N5 = Noise(1, 900), Noise(2, 380), Noise(3, 150), Noise(4, 62), Noise(5, 26)
NF1, NF2, NB1 = Noise(11, 420), Noise(12, 130), Noise(13, 600)       # forest / burn masks
NM1, NM2, NM3 = Noise(21, 6.0, 700), Noise(22, 2.4, 700), Noise(23, 1.1, 700)  # micro relief (war map)

def poly_dense(ctrl, step=2.0):
    """Catmull-Rom through control points, resampled every ~step metres"""
    P = np.array(ctrl, np.float64); P = np.vstack([P[0], P, P[-1]]); out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        n = max(2, int(np.linalg.norm(p2 - p1) / step))
        for k in range(n):
            t = k / n; t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(P[-2]); return np.array(out)

def dist_to_poly(x, z, P):
    """unsigned distance from points to a polyline (vectorised, chunked)"""
    d = np.full(x.shape, 1e9)
    for i in range(len(P) - 1):
        a, b = P[i], P[i + 1]; ab = b - a; l2 = ab @ ab + 1e-12
        t = np.clip(((x - a[0]) * ab[0] + (z - a[1]) * ab[1]) / l2, 0, 1)
        d = np.minimum(d, np.hypot(x - a[0] - t * ab[0], z - a[1] - t * ab[1]))
    return d

# ---------------- roads, creek, power line ----------------
ROAD = poly_dense([(-1560, 430), (-1150, 380), (-760, 300), (-480, 238), (-256, 206), (-120, 199), (0, 203), (130, 197),
                   (256, 188), (520, 150), (850, 60), (1150, -40), (1560, -120)], 2.0)
def creek_x(z): return -760 + 90 * np.sin(z / 310.0) + 40 * np.sin(z / 97.0 + 1.3)
PYL_A, PYL_B = np.array([-1520.0, 700.0]), np.array([1520.0, -170.0])

def war_weight(x, z):
    e = np.maximum(np.abs(x), np.abs(z)); return 1 - smoothstep(230, 420, e)

def base_height(x, z):
    w = war_weight(x, z)
    h = 46 + 21 * N1(x, z) + 8.5 * N2(x, z) + (3.2 * N3(x, z) + 1.1 * N4(x, z) + 0.4 * N5(x, z)) * (1 - 0.72 * w)
    h += 5.5 * np.exp(-((z - 30) / 230.0) ** 2) * np.exp(-(x / 900.0) ** 2)
    h -= 7.5 * smoothstep(-80, -700, z)
    d = np.abs(x - creek_x(z))
    h -= 8.5 * np.exp(-(d / 80.0) ** 2) + 1.7 * np.exp(-(d / 6.5) ** 2)
    pd = np.hypot(x + 640, z + 520); h -= 3.2 * np.exp(-(pd / 38.0) ** 2)                       # pond
    e = np.maximum(np.abs(x), np.abs(z))
    h += 30 * smoothstep(1150, 1536, e) * (0.75 + 0.25 * N2(x * 1.7 + 300, z * 1.7))
    return h

print('base heights ...', flush=True)
bx = BX0 + BS * np.arange(BN)
BXX, BZZ = np.meshgrid(bx, bx)
HB = base_height(BXX, BZZ)
# road: flatten into a smoothed bed with shallow ditches
rd = np.full(HB.shape, 1e9)
for i in range(0, len(ROAD) - 1):
    a, b = ROAD[i], ROAD[i + 1]
    x0, x1 = min(a[0], b[0]) - 14, max(a[0], b[0]) + 14; z0, z1 = min(a[1], b[1]) - 14, max(a[1], b[1]) + 14
    i0, i1 = max(0, int((x0 - BX0) / BS)), min(BN, int((x1 - BX0) / BS) + 2)
    j0, j1 = max(0, int((z0 - BX0) / BS)), min(BN, int((z1 - BX0) / BS) + 2)
    if i0 >= i1 or j0 >= j1: continue
    X, Z = BXX[j0:j1, i0:i1], BZZ[j0:j1, i0:i1]; ab = b - a; l2 = ab @ ab
    t = np.clip(((X - a[0]) * ab[0] + (Z - a[1]) * ab[1]) / l2, 0, 1)
    rd[j0:j1, i0:i1] = np.minimum(rd[j0:j1, i0:i1], np.hypot(X - a[0] - t * ab[0], Z - a[1] - t * ab[1]))
HBs = ndimage.gaussian_filter(HB, 6)
rk = 1 - smoothstep(4.0, 11.0, rd)
HB = HB * (1 - rk) + HBs * rk - 0.35 * np.exp(-((rd - 4.6) / 0.9) ** 2)
# big old craters out in the forest near the front (coarse map)
BCR = []
for k in range(260):
    x, z = RS.uniform(-1100, 1100), RS.uniform(-1000, 700)
    if max(abs(x), abs(z)) < 300: continue
    if math.hypot(x, z) > 1150 * (0.4 + 0.6 * RS.rand()): continue
    r = RS.uniform(3.5, 8.0); BCR.append((x, z, r, r * RS.uniform(0.22, 0.32)))
for (cx, cz, r, dep) in BCR:
    i0, i1 = max(0, int((cx - 2 * r - BX0) / BS)), min(BN, int((cx + 2 * r - BX0) / BS) + 2)
    j0, j1 = max(0, int((cz - 2 * r - BX0) / BS)), min(BN, int((cz + 2 * r - BX0) / BS) + 2)
    X, Z = BXX[j0:j1, i0:i1], BZZ[j0:j1, i0:i1]; rho = np.hypot(X - cx, Z - cz) / r
    HB[j0:j1, i0:i1] += -dep * np.clip(1 - rho * rho, 0, 1) ** 1.5 + 0.18 * dep * np.exp(-((rho - 1.05) / 0.3) ** 2)
HB = np.round(HB * 512) / 512
HB32 = HB.astype(np.float32)

def base_at(x, z):
    """bilinear on the base grid (same maths as the game)"""
    fx = np.clip((np.asarray(x) - BX0) / BS, 0, BN - 1); fz = np.clip((np.asarray(z) - BX0) / BS, 0, BN - 1)
    ix = np.minimum(np.floor(fx).astype(np.int64), BN - 2); iz = np.minimum(np.floor(fz).astype(np.int64), BN - 2)
    tx, tz = fx - ix, fz - iz
    h00 = HB32[iz, ix]; h10 = HB32[iz, ix + 1]; h01 = HB32[iz + 1, ix]; h11 = HB32[iz + 1, ix + 1]
    return (h00 * (1 - tx) + h10 * tx) * (1 - tz) + (h01 * (1 - tx) + h11 * tx) * tz

# ---------------- war map: ground ----------------
print('war ground ...', flush=True)
wx = WX0 + WS * np.arange(WN)
WXX, WZZ = np.meshgrid(wx, wx)
edge = 256 - np.maximum(np.abs(WXX), np.abs(WZZ))
wedge = smoothstep(2.0, 18.0, edge)
GW = base_at(WXX, WZZ).astype(np.float64)
micro = 0.13 * NM1(WXX, WZZ) + 0.05 * NM2(WXX, WZZ) + 0.018 * NM3(WXX, WZZ)
GW += micro * wedge

# ---------------- trench network ----------------
TR = {  # b: floor half width, t: top half width, D: depth, step: fire step (w, depth), parapet / parados (w, h)
    'fire':    dict(b=0.62, t=0.78, D=1.9, step=(0.72, 0.86), par=(2.4, 0.45), pdo=(1.8, 0.3)),
    'support': dict(b=0.62, t=0.78, D=1.85, step=(0.68, 0.86), par=(2.0, 0.36), pdo=(1.6, 0.25)),
    'comm':    dict(b=0.52, t=0.68, D=1.75, step=None, par=(1.5, 0.22), pdo=(1.5, 0.22)),
    'sap':     dict(b=0.46, t=0.62, D=1.55, step=None, par=(1.4, 0.3), pdo=(1.2, 0.2)),
}
DEPTH = np.zeros((WN, WN), np.float64); MOUND = np.zeros((WN, WN), np.float64)
TRENCHES = []   # (kind, points[N,2], enemy_dir or None)

def zc_front(x): return -38 + 6 * np.sin(x / 70.0) + 3 * np.sin(x / 23.0 + 1.0)
def zc_support(x): return 46 + 5 * np.sin(x / 90.0 + 0.7)

def stamp_poly(P, kind, enemy=None, ramps=(False, False)):
    p = TR[kind]; b, t, D = p['b'], p['t'], p['D']
    sw, sd = p['step'] if p['step'] else (0.0, 0.0)
    edge_e = (b + sw + (t - b)) if p['step'] else t
    marg = edge_e + max(p['par'][0], p['pdo'][0]) + 0.6
    P = np.asarray(P, np.float64)
    seg = np.linalg.norm(P[1:] - P[:-1], axis=1); cum = np.r_[0, np.cumsum(seg)]; L = cum[-1]
    for i in range(len(P) - 1):
        a, c = P[i], P[i + 1]; ab = c - a; l2 = ab @ ab + 1e-12
        x0, x1 = min(a[0], c[0]) - marg, max(a[0], c[0]) + marg; z0, z1 = min(a[1], c[1]) - marg, max(a[1], c[1]) + marg
        i0, i1 = max(0, int((x0 - WX0) / WS)), min(WN, int((x1 - WX0) / WS) + 2)
        j0, j1 = max(0, int((z0 - WX0) / WS)), min(WN, int((z1 - WX0) / WS) + 2)
        if i0 >= i1 or j0 >= j1: continue
        X, Z = WXX[j0:j1, i0:i1], WZZ[j0:j1, i0:i1]
        tt = np.clip(((X - a[0]) * ab[0] + (Z - a[1]) * ab[1]) / l2, 0, 1)
        dx, dz = X - a[0] - tt * ab[0], Z - a[1] - tt * ab[1]; d = np.hypot(dx, dz)
        s = cum[i] + tt * seg[i]
        ramp = np.ones_like(d)
        if ramps[0]: ramp *= smoothstep(0.0, 6.0, s)
        if ramps[1]: ramp *= smoothstep(L, L - 6.0, s)
        if enemy is not None:
            nx, nz = -ab[1], ab[0]
            if nx * enemy[0] + nz * enemy[1] < 0: nx, nz = -nx, -nz
            side = (dx * nx + dz * nz) > 0
        else:
            side = np.zeros(d.shape, bool)
        wall = np.where(d < b, D + 0.06 * (1 - d / b) ** 2, np.where(d < t, D * (t - d) / (t - b), 0.0))
        if p['step']:
            stp = np.where(d < b, D + 0.06 * (1 - d / b) ** 2, np.where(d < b + 0.12, D + (sd - D) * (d - b) / 0.12,
                  np.where(d < b + sw, sd, np.where(d < edge_e, sd * (edge_e - d) / (t - b), 0.0))))
            dep = np.where(side, stp, wall)
        else:
            dep = wall
        dep = dep * ramp
        # parapet towards the enemy (or both sides for symmetric trenches), parados behind
        ue = (d - edge_e) / p['par'][0]; ur = (d - t) / p['pdo'][0]
        shp = lambda u: np.where((u > 0) & (u < 1), np.where(u < 0.22, smoothstep(0, 0.22, u), 1 - smoothstep(0.22, 1.0, u)), 0.0)
        mnd = np.where(side, p['par'][1] * shp(ue), p['pdo'][1] * shp(ur)) * ramp
        DEPTH[j0:j1, i0:i1] = np.maximum(DEPTH[j0:j1, i0:i1], dep)
        MOUND[j0:j1, i0:i1] = np.maximum(MOUND[j0:j1, i0:i1], mnd)
    TRENCHES.append((kind, P, enemy, ramps))

print('trenches ...', flush=True)
# front (fire) trench: crenellated bays and traverses
pts = []; x = -234.0; k = 0
while x < 234:
    bay = RS.uniform(8.0, 11.0); off = 2.3 if k % 2 == 0 else -2.3
    pts.append((x, zc_front(x) + off)); pts.append((x + bay, zc_front(x + bay) + off))
    x += bay + RS.uniform(1.6, 2.2); k += 1
FRONT = np.array(pts)
stamp_poly(FRONT, 'fire', enemy=(0, -1), ramps=(True, True))
# support line: zig-zag
pts = []; x = -226.0; k = 0
while x <= 226:
    pts.append((x, zc_support(x) + (3.2 if k % 2 == 0 else -3.2))); x += RS.uniform(10.0, 13.0); k += 1
SUPPORT = np.array(pts)
stamp_poly(SUPPORT, 'support', enemy=(0, -1), ramps=(True, True))
# communication trenches (front -> support -> rear exit)
COMMS = []
for x0 in (-148.0, -12.0, 136.0):
    zf = zc_front(x0) + 1.0; zz = np.arange(zf, 168.0, 2.0)
    xs = x0 + 3.6 * np.sin(zz / 8.5) + 1.6 * np.sin(zz / 3.7 + x0)
    P = np.stack([xs, zz], 1); COMMS.append(P)
    stamp_poly(P, 'comm', None, ramps=(False, True))
# saps with machine-gun pits
SAPS = []
for xs in (-92.0, 58.0, 186.0):
    z0 = zc_front(xs) - 1.5; zz = np.arange(z0, z0 - 30.0, -2.0)
    xx = xs + 2.5 * np.sin((zz - z0) / 6.0)
    P = np.stack([xx, zz], 1); SAPS.append(P)
    stamp_poly(P, 'sap', None, ramps=(False, False))

def stamp_pit(cx, cz, r0, depth, rim=0.25):
    i0, i1 = max(0, int((cx - r0 - 3 - WX0) / WS)), min(WN, int((cx + r0 + 3 - WX0) / WS) + 2)
    j0, j1 = max(0, int((cz - r0 - 3 - WX0) / WS)), min(WN, int((cz + r0 + 3 - WX0) / WS) + 2)
    X, Z = WXX[j0:j1, i0:i1], WZZ[j0:j1, i0:i1]; d = np.hypot(X - cx, Z - cz)
    dep = np.where(d < r0, depth, np.where(d < r0 + 0.2, depth * (r0 + 0.2 - d) / 0.2, 0.0))
    DEPTH[j0:j1, i0:i1] = np.maximum(DEPTH[j0:j1, i0:i1], dep)
    u = (d - r0 - 0.2) / 1.6
    MOUND[j0:j1, i0:i1] = np.maximum(MOUND[j0:j1, i0:i1], np.where((u > 0) & (u < 1), rim * np.sin(np.pi * np.clip(u, 0, 1)) ** 0.8, 0.0))

MGPITS = [(P[-1][0], P[-1][1]) for P in SAPS]
for (cx, cz) in MGPITS: stamp_pit(cx, cz, 1.55, 1.35, 0.3)
MORTARS = [(-60.0, 88.0), (72.0, 92.0), (196.0, 84.0)]
for (cx, cz) in MORTARS: stamp_pit(cx, cz, 1.7, 1.1, 0.35)

# dugout sites: the middle of a support-line segment, rooms behind (south of) the trench
def seg_mid(P, x):
    i = int(np.clip(np.searchsorted(P[:, 0], x) - 1, 0, len(P) - 2)); a, b = P[i], P[i + 1]
    return (a + b) / 2, (b - a) / np.linalg.norm(b - a)
DUGOUTS = []
for k, xd in enumerate((-108.0, 14.0, 142.0)):
    p, d = seg_mid(SUPPORT, xd)
    xa = d if d[0] > 0 else -d                                 # local +X along the trench (east-ish)
    rear = np.array([-xa[1], xa[0]])
    if rear[1] < 0: rear = -rear                               # the room lies south (+z) of the trench
    centre = p + rear * (TR['support']['t'] + 1.55 + 1.5)      # trench centre -> rear wall -> corridor -> room centre
    DUGOUTS.append(dict(c=centre, xa=xa, za=-rear, trench=p, k=k))
RANGE_C = DUGOUTS[1]['c'] + DUGOUTS[1]['za'] * -20.0       # a small firing range behind dugout 2

# distance to any trench / pit / dugout on a 1 m grid (lookups for placement)
ALLP = [FRONT, SUPPORT] + COMMS + SAPS
ex_n = 513; exx = np.linspace(-256, 256, ex_n); EXX, EZZ = np.meshgrid(exx, exx)
tdist = np.full(EXX.shape, 1e9)
for P in ALLP: tdist = np.minimum(tdist, dist_to_poly(EXX, EZZ, P))
for (cx, cz) in MGPITS + MORTARS: tdist = np.minimum(tdist, np.hypot(EXX - cx, EZZ - cz) - 1.5)
for dg in DUGOUTS: tdist = np.minimum(tdist, np.hypot(EXX - dg['c'][0], EZZ - dg['c'][1]) - 3.5)
def tdist_at(x, z):
    i = int(np.clip(round(x + 256), 0, 512)); j = int(np.clip(round(z + 256), 0, 512)); return float(tdist[j, i])
def near_trench(x, z, m):
    if abs(x) > 256 or abs(z) > 256: return False
    return tdist_at(x, z) < m
CRATERS = []
tries = 0
while len(CRATERS) < 230 and tries < 6000:
    tries += 1
    if len(CRATERS) < 170: x, z = RS.uniform(-236, 236), RS.uniform(-236, zc_front(0) - 8)
    else: x, z = RS.uniform(-236, 236), RS.uniform(-20, 236)
    r = float(np.clip(RS.lognormal(math.log(2.6), 0.45), 1.2, 7.5))
    if len(CRATERS) >= 170: r = min(r, 3.5)
    if max(abs(x), abs(z)) > 238 - 2 * r: continue
    if near_trench(x, z, r + 2.5) and RS.rand() > 0.04: continue
    if near_trench(x, z, r + 5.0) and tdist_at(x, z) < 0: continue
    if any(math.hypot(x - dg['c'][0], z - dg['c'][1]) < r + 7 for dg in DUGOUTS): continue
    if math.hypot(x - RANGE_C[0], z - RANGE_C[1]) < r + 8: continue
    if abs(z - 203) < r + 6 and RS.rand() > 0.15: continue          # keep the road mostly whole
    CRATERS.append((x, z, r, r * RS.uniform(0.28, 0.42), RS.rand() < 0.42))
BOWL = np.zeros((WN, WN)); RIM = np.zeros((WN, WN))
CR_WATER = []
for (cx, cz, r, dep, wet) in CRATERS:
    i0, i1 = max(0, int((cx - 2 * r - WX0) / WS)), min(WN, int((cx + 2 * r - WX0) / WS) + 2)
    j0, j1 = max(0, int((cz - 2 * r - WX0) / WS)), min(WN, int((cz + 2 * r - WX0) / WS) + 2)
    X, Z = WXX[j0:j1, i0:i1], WZZ[j0:j1, i0:i1]
    ang = np.arctan2(Z - cz, X - cx)
    rr = r * (1 + 0.1 * np.sin(3 * ang + cx) + 0.06 * np.sin(5 * ang + cz))
    rho = np.hypot(X - cx, Z - cz) / rr
    BOWL[j0:j1, i0:i1] = np.minimum(BOWL[j0:j1, i0:i1], -dep * np.clip(1 - rho * rho, 0, 1) ** 1.4)
    RIM[j0:j1, i0:i1] += 0.22 * dep * np.exp(-((rho - 1.05) / 0.3) ** 2) * (0.75 + 0.5 * np.clip(NM2(X * 3, Z * 3), -1, 1))
GW += (BOWL + RIM) * wedge

# ---------------- dugouts ----------------
print('dugouts ...', flush=True)

def local_grid(dg, X, Z):
    rx, rz = X - dg['c'][0], Z - dg['c'][1]
    return rx * dg['xa'][0] + rz * dg['xa'][1], rx * dg['za'][0] + rz * dg['za'][1]
for dg in DUGOUTS:
    cx, cz = dg['c']; R = 7.5
    i0, i1 = max(0, int((cx - R - WX0) / WS)), min(WN, int((cx + R - WX0) / WS) + 2)
    j0, j1 = max(0, int((cz - R - WX0) / WS)), min(WN, int((cz + R - WX0) / WS) + 2)
    X, Z = WXX[j0:j1, i0:i1], WZZ[j0:j1, i0:i1]
    G = float(base_at(cx, cz)); dg['G'] = G
    lx, lz = local_grid(dg, X, Z)
    # flatten the ground over the room so the roof mound meets it
    fl = 1 - smoothstep(4.2, 7.0, np.maximum(np.abs(lx) - 0.6, np.abs(lz) - 0.3))
    GW[j0:j1, i0:i1] = GW[j0:j1, i0:i1] * (1 - fl) + (G + 0.02 * NM2(X, Z)) * fl
    floor = G - TR['support']['D'] - 0.5; dg['floor'] = floor
    room = (np.abs(lx) < 2.05) & (np.abs(lz) < 1.75)
    corr = (np.abs(lx) < 0.62) & (lz >= 1.7) & (lz < 4.2)
    # corridor floor: room floor until 1.95, steps up to the trench floor (0.5 higher) by 2.9, flat on to the trench
    cf = floor + np.clip((lz - 1.95) / 0.95, 0, 1) * 0.5
    dep_room = np.where(room, G - floor, 0.0); dep_corr = np.where(corr, G - cf, 0.0)
    DEPTH[j0:j1, i0:i1] = np.maximum(DEPTH[j0:j1, i0:i1], np.maximum(dep_room, dep_corr))
    MOUND[j0:j1, i0:i1] = np.where(room | corr, 0.0, MOUND[j0:j1, i0:i1])

# ---------------- road detail: crown, ruts ----------------
print('road ...', flush=True)
RW = (np.abs(WZZ - 203) < 30)
rdw = np.full(GW.shape, 1e9)
sub = np.where(RW.any(1))[0]
j0, j1 = sub.min(), sub.max() + 1
rdw[j0:j1] = dist_to_poly(WXX[j0:j1], WZZ[j0:j1], ROAD[(ROAD[:, 0] > -300) & (ROAD[:, 0] < 300)])
rut = np.exp(-((rdw - 1.05) / 0.28) ** 2) * (0.6 + 0.4 * NM1(WXX * 2, WZZ * 2))
GW += (-0.11 * rut + 0.04 * np.exp(-(rdw / 1.2) ** 2) - 0.03 * smoothstep(2.8, 3.6, rdw) * (1 - smoothstep(4.5, 6, rdw))) * wedge

# ---------------- compose war heights ----------------
DEPTH *= wedge; MOUND *= wedge
HW = np.where(DEPTH > 1e-4, GW - DEPTH, GW + MOUND)
# trench walls are not perfectly smooth
wall_band = (DEPTH > 0.05) & (DEPTH < 1.7)
HW += np.where(wall_band, 0.035 * NM2(WXX * 2.5, WZZ * 2.5), 0.0)
HW = np.round(HW * 512) / 512
HW32 = HW.astype(np.float32)
GW32 = GW.astype(np.float32)

def war_at(x, z, arr=None):
    A = HW32 if arr is None else arr
    fx = np.clip((np.asarray(x, np.float64) - WX0) / WS, 0, WN - 1); fz = np.clip((np.asarray(z, np.float64) - WX0) / WS, 0, WN - 1)
    ix = np.minimum(np.floor(fx).astype(np.int64), WN - 2); iz = np.minimum(np.floor(fz).astype(np.int64), WN - 2)
    tx, tz = fx - ix, fz - iz
    return (A[iz, ix] * (1 - tx) + A[iz, ix + 1] * tx) * (1 - tz) + (A[iz + 1, ix] * (1 - tx) + A[iz + 1, ix + 1] * tx) * tz

def H(x, z):
    """the game's height function"""
    x = np.asarray(x, np.float64); z = np.asarray(z, np.float64)
    inside = (x >= WX0) & (x <= -WX0) & (z >= WX0) & (z <= -WX0)
    return np.where(inside, war_at(x, z), base_at(x, z))
def ground(x, z):
    """the ground without trenches / pits (for props sitting next to them)"""
    x = np.asarray(x, np.float64); z = np.asarray(z, np.float64)
    inside = (x >= WX0) & (x <= -WX0) & (z >= WX0) & (z <= -WX0)
    return np.where(inside, war_at(x, z, GW32), base_at(x, z))

HB32.tofile(OUT + '/base_h.f32'); HW32.tofile(OUT + '/war_h.f32')
print('heights written', HB32.min(), HB32.max(), HW32.min(), HW32.max(), flush=True)

# ---------------- placements ----------------
def xform(pos, yaw=0.0, scale=(1, 1, 1), pitch=0.0, roll=0.0):
    """Godot Transform3D as the 12 floats of MultiMesh.buffer (rows of [basis | origin])"""
    cy, sy = math.cos(yaw), math.sin(yaw); cp, sp = math.cos(pitch), math.sin(pitch); cr, sr = math.cos(roll), math.sin(roll)
    Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]]); Rx = np.array([[1, 0, 0], [0, cp, -sp], [0, sp, cp]]); Rz = np.array([[cr, -sr, 0], [sr, cr, 0], [0, 0, 1]])
    B = Ry @ Rx @ Rz @ np.diag(scale)
    return [B[0, 0], B[0, 1], B[0, 2], pos[0], B[1, 0], B[1, 1], B[1, 2], pos[1], B[2, 0], B[2, 1], B[2, 2], pos[2]]
def xform_basis(pos, Xa, Ya, Za):
    return [Xa[0], Ya[0], Za[0], pos[0], Xa[1], Ya[1], Za[1], pos[1], Xa[2], Ya[2], Za[2], pos[2]]
def yaw_of(dx, dz):
    """yaw so that local +X points along (dx, dz)"""
    return math.atan2(-dz, dx)

PROPS = {}      # mesh -> chunk -> list of floats
COLL = {}       # chunk -> list of 16 floats (xform 12 + half extents 3 + material)
CH = 64.0
def ckey(x, z, size): return '%d,%d' % (math.floor(x / size), math.floor(z / size))
def add_prop(mesh, xf):
    PROPS.setdefault(mesh, {}).setdefault(ckey(xf[3], xf[11], CH), []).extend(xf)
def add_box(xf, he, mat):
    COLL.setdefault(ckey(xf[3], xf[11], CH), []).extend(list(xf) + list(he) + [mat])
MAT_EARTH, MAT_WOOD, MAT_METAL, MAT_BAG = 0, 1, 2, 3

def seg_iter(P):
    for i in range(len(P) - 1):
        a, b = np.asarray(P[i], np.float64), np.asarray(P[i + 1], np.float64); L = np.linalg.norm(b - a)
        if L > 0.05: yield a, b, L, (b - a) / L

print('trench furniture ...', flush=True)
WATER_STRIPS = []
for (kind, P, enemy, ramps) in TRENCHES:
    p = TR[kind]; b, t, D = p['b'], p['t'], p['D']
    segs = list(seg_iter(P)); nseg = len(segs)
    for si, (a, c, L, d) in enumerate(segs):
        yaw = yaw_of(d[0], d[1]); nrm = np.array([-d[1], d[0]])
        if enemy is not None and nrm @ np.array(enemy) < 0: nrm = -nrm
        if enemy is None and nrm[1] > 0: nrm = -nrm
        rampcut = (ramps[0] and si < 3) or (ramps[1] and si >= nseg - 3)
        if rampcut: continue
        # duckboards along the floor
        n = int((L - 0.6) / 1.26)
        wet = RS.rand() < (0.45 if kind != 'sap' else 0.25)
        if n >= 1:
            s0 = (L - n * 1.26) / 2 + 0.63
            for k in range(n):
                q = a + d * (s0 + k * 1.26)
                if RS.rand() < 0.07: continue                    # a missing board here and there
                h0 = float(H(q[0] - d[0] * 0.55, q[1] - d[1] * 0.55)); h1 = float(H(q[0] + d[0] * 0.55, q[1] + d[1] * 0.55))
                hm = float(H(q[0], q[1]))
                pitch = math.atan2(h1 - h0, 1.1)
                xf = xform((q[0], max(hm, (h0 + h1) / 2) + 0.07 + (0.06 if wet else 0), q[1]), yaw + RS.uniform(-0.04, 0.04), (1, 1, 1), 0, pitch)
                add_prop('duckboard', xf)
                add_box(xform((q[0], max(hm, (h0 + h1) / 2) + 0.05 + (0.06 if wet else 0), q[1]), yaw, (1, 1, 1), 0, pitch), (0.62, 0.05, 0.3), MAT_WOOD)
        if wet and L > 1.5:
            q = (a + c) / 2; hs = H(np.linspace(a[0], c[0], 9), np.linspace(a[1], c[1], 9))
            WATER_STRIPS.append([q[0], float(hs.min()) + 0.09, q[1], L + 0.5, 2 * b + 0.25, yaw])
        # revetments on both walls
        rtype = RS.choice(['planks', 'planks', 'wattle', 'corrugated', 'bare', 'planks'], p=[0.25, 0.2, 0.2, 0.15, 0.1, 0.1])
        for side in (1, -1):
            off = nrm * side
            if p['step'] and side == 1:
                pieces = [(b + 0.01, D, D - p['step'][1]), (b + p['step'][0] + 0.01, p['step'][1], 0.0)]   # riser, upper wall
            else:
                pieces = [(b + 0.01, D, 0.0)]
            for (dist, top_depth, bot_depth) in pieces:
                if rtype == 'bare': continue
                h_wall = top_depth - bot_depth
                npan = max(1, int(round((L - 0.3) / 2.0))); plen = (L - 0.3) / npan
                for k in range(npan):
                    q = a + d * (0.15 + plen * (k + 0.5)) + off * dist
                    g = float(ground(q[0] + off[0] * 0.9, q[1] + off[1] * 0.9))
                    y0 = g - top_depth
                    face = -off                                     # the panel's front (+Z) looks at the trench centre
                    pyaw = math.atan2(face[0], face[1])
                    mesh = {'planks': 'revet_planks', 'wattle': 'revet_wattle', 'corrugated': 'revet_iron'}[rtype]
                    add_prop(mesh, xform((q[0], y0, q[1]), pyaw, (plen, h_wall + (0.08 if bot_depth == 0 else 0), 1.0)))
                    if k == 0 or True:
                        pq = a + d * (0.15 + plen * k) + off * (dist + 0.04)
                        add_prop('post', xform((pq[0], g - D - 0.05, pq[1]), RS.uniform(0, 6.28), (1, D + 0.28 if bot_depth == 0 else h_wall + 0.1, 1)))
                if rtype != 'bare':
                    pq = c - d * 0.15 + off * (dist + 0.04)
                    add_prop('post', xform((pq[0], float(ground(pq[0], pq[1])) - D - 0.05, pq[1]), RS.uniform(0, 6.28), (1, D + 0.28, 1)))
        # sandbags along the enemy crest of fire / support trenches
        if p['step']:
            edge_e = b + p['step'][0] + (t - b)
            nb = int(L / 0.5)
            for k in range(nb):
                q = a + d * ((k + 0.5) * L / nb) + nrm * (edge_e + 0.32)
                g = float(H(q[0], q[1]))
                for row in range(2 if RS.rand() < 0.75 else 1):
                    jit = RS.uniform(-0.03, 0.03)
                    add_prop('sandbag', xform((q[0] + nrm[0] * jit, g + 0.07 + row * 0.15, q[1] + nrm[1] * jit), yaw + RS.uniform(-0.12, 0.12) + (math.pi if RS.rand() < 0.5 else 0), (RS.uniform(0.93, 1.07), RS.uniform(0.9, 1.1), RS.uniform(0.93, 1.07))))
            qm = (a + c) / 2 + nrm * (edge_e + 0.32)
            add_box(xform((qm[0], float(H(qm[0], qm[1])) + 0.18, qm[1]), yaw), (L / 2, 0.2, 0.28), MAT_BAG)
        # trench ladders on the front line, clutter in the bays
        if (kind == 'fire' and si % 7 == 3) or (kind == 'support' and si % 5 == 2):
            q = a + d * (L * 0.5) + nrm * (b - 0.28)
            lyaw = math.atan2(-nrm[0], -nrm[1])                # local -Z (the lean) points at the wall
            add_prop('ladder', xform((q[0], float(H(q[0], q[1])) + 0.02, q[1]), lyaw, (1, 1, 1), -0.32))
        if kind in ('fire', 'support', 'comm') and RS.rand() < 0.22:
            q = a + d * RS.uniform(0.3, 0.7) * L - nrm * (b - 0.32)
            item = RS.choice(['crate_ammo', 'crate_ammo', 'crate_long', 'bucket', 'jerrycan'])
            hq = float(H(q[0], q[1]))
            add_prop(item, xform((q[0], hq + 0.005, q[1]), yaw + RS.uniform(-0.3, 0.3)))
            he = {'crate_ammo': (0.3, 0.12, 0.17), 'crate_long': (0.55, 0.15, 0.22), 'bucket': (0.15, 0.17, 0.15), 'jerrycan': (0.18, 0.24, 0.09)}[item]
            add_box(xform((q[0], hq + he[1], q[1]), yaw), he, MAT_WOOD if 'crate' in item else MAT_METAL)

# planks bridging trenches where paths cross (communication trenches near the support line)
for P in COMMS:
    for zz in (68.0, 120.0):
        i = int(np.argmin(np.abs(P[:, 1] - zz))); q = P[i]; d = P[min(i + 1, len(P) - 1)] - P[max(i - 1, 0)]; d = d / np.linalg.norm(d)
        across = np.array([-d[1], d[0]]); yaw = yaw_of(across[0], across[1])
        g = float(ground(q[0] + across[0] * 1.5, q[1] + across[1] * 1.5)); g2 = float(ground(q[0] - across[0] * 1.5, q[1] - across[1] * 1.5))
        add_prop('bridge', xform((q[0], max(g, g2) + 0.04, q[1]), yaw))
        add_box(xform((q[0], max(g, g2) + 0.07, q[1]), yaw), (1.6, 0.05, 0.45), MAT_WOOD)

# sandbag rings around machine-gun and mortar pits
for (cx, cz, r0) in [(x, z, 1.55) for (x, z) in MGPITS] + [(x, z, 1.7) for (x, z) in MORTARS]:
    rr = r0 + 0.55; n = int(2 * math.pi * rr / 0.5)
    for k in range(n):
        a = 2 * math.pi * k / n
        if MGPITS.count((cx, cz)) and abs(((a - math.pi / 2 + math.pi) % (2 * math.pi)) - math.pi) < 0.45: continue  # gap to the sap
        x, z = cx + rr * math.cos(a), cz + rr * math.sin(a); g = float(H(x, z))
        for row in range(3 if (cx, cz) in MGPITS else 2):
            add_prop('sandbag', xform((x, g + 0.07 + row * 0.15, z), -a + math.pi / 2 + RS.uniform(-0.1, 0.1) + (row % 2) * 0.25))
    for k in range(8):
        a = 2 * math.pi * k / 8; x, z = cx + rr * math.cos(a), cz + rr * math.sin(a)
        add_box(xform((x, float(H(x, z)) + 0.25, z), -a + math.pi / 2), (0.5, 0.25, 0.28), MAT_BAG)

def in_crater_war(x, z):
    for (cx, cz, r, dep, wet) in CRATERS:
        if abs(cx - x) < r and abs(cz - z) < r and math.hypot(cx - x, cz - z) < r * 0.9: return True
    return False
# barbed wire belts in front of the line
print('wire ...', flush=True)
def add_wire(p0, p1, h0, h1):
    p0 = np.array([p0[0], h0, p0[1]]); p1 = np.array([p1[0], h1, p1[1]]); v = p1 - p0; L = np.linalg.norm(v)
    if L < 0.1: return
    Xa = v; up = np.array([0.0, 1.0, 0.0]); Za = np.cross(Xa / L, up); Za /= (np.linalg.norm(Za) + 1e-9); Ya = np.cross(Za, Xa / L)
    add_prop('wire', xform_basis(p0, Xa, Ya, Za))
PICKETS = []
for belt, off in enumerate((-14.0, -25.0)):
    x = -228.0; prev = None
    while x < 228:
        z = zc_front(x) + off + 1.2 * math.sin(x * 0.9) + RS.uniform(-0.6, 0.6)
        g = float(H(x, z))
        if g < float(ground(x, z)) - 0.3 or near_trench(x, z, 1.5) or in_crater_war(x, z):    # no pickets inside craters / trenches
            prev = None; x += RS.uniform(2.3, 2.9); continue
        tilt = RS.uniform(-0.12, 0.12)
        add_prop('picket', xform((x, g - 0.05, z), RS.uniform(0, 6.28), (1, RS.uniform(0.9, 1.1), 1), tilt, RS.uniform(-0.08, 0.08)))
        PICKETS.append((x, z, g))
        if prev is not None and RS.rand() > 0.08:
            for hh in (0.22, 0.62, 1.02):
                add_wire((prev[0], prev[1]), (x, z), prev[2] + hh * RS.uniform(0.9, 1.05), g + hh * RS.uniform(0.9, 1.05))
            add_wire((prev[0], prev[1]), (x, z), prev[2] + 1.02, g + 0.1)
            if belt == 1:
                mid = ((prev[0] + x) / 2, (prev[1] + z) / 2); gm = float(H(*mid))
                add_prop('concertina', xform((mid[0], gm + 0.02, mid[1]), yaw_of(x - prev[0], z - prev[1]), (math.hypot(x - prev[0], z - prev[1]) / 2.0, 1, 1)))
        prev = (x, z, g); x += RS.uniform(2.3, 2.9)

# ---------------- pylons and cables ----------------
print('pylons ...', flush=True)
PYLONS = []
v = PYL_B - PYL_A; Lp = np.linalg.norm(v); dpl = v / Lp; n = int(Lp / 140)
for k in range(n + 1):
    q = PYL_A + dpl * (Lp * k / n)
    q = q + np.array([-dpl[1], dpl[0]]) * RS.uniform(-3, 3)
    if near_trench(q[0], q[1], 8) or abs(q[1] - 203) < 9 and abs(q[0]) < 300: q = q + dpl * 12
    g = float(H(q[0], q[1]))
    PYLONS.append(dict(p=[float(q[0]), g, float(q[1])], yaw=yaw_of(dpl[0], dpl[1]) + math.pi / 2, broken=False))
# the tower nearest the trenches has been hit and leans over
bi = int(np.argmin([math.hypot(pp['p'][0] - 30, pp['p'][2] - 140) for pp in PYLONS])); PYLONS[bi]['broken'] = True

# ---------------- water ----------------
WATER_DISCS = []
for (cx, cz, r, dep, wet) in CRATERS:
    if not wet or r < 1.6: continue
    hc = float(H(cx, cz)); rim = float(np.min(H(cx + r * np.cos(np.linspace(0, 6.28, 16)), cz + r * np.sin(np.linspace(0, 6.28, 16)))))
    lvl = hc + (rim - hc) * RS.uniform(0.28, 0.5)
    WATER_DISCS.append([cx, lvl, cz, r * 0.95])
for (cx, cz, r, dep) in BCR:
    if RS.rand() < 0.35 and max(abs(cx), abs(cz)) > 300:
        hc = float(H(cx, cz)); WATER_DISCS.append([cx, hc + dep * 0.35, cz, r * 0.8])
# creek: strips that follow the bed downstream
zz = np.arange(-1450, 1450, 6.0); prevq = None
for z in zz:
    q = np.array([creek_x(z), z])
    if prevq is not None:
        m = (q + prevq) / 2; dd = q - prevq; L = np.linalg.norm(dd)
        lvl = float(min(H(q[0], q[1]), H(prevq[0], prevq[1]), H(m[0], m[1]))) + 0.55
        WATER_STRIPS.append([m[0], lvl, m[1], L + 1.6, 7.0, yaw_of(dd[0], dd[1])])
    prevq = q
WATER_DISCS.append([-640.0, float(H(-640, -520)) + 1.6, -520.0, 40.0])
# puddles in the road ruts
for x in np.arange(-250, 250, 7.0):
    if RS.rand() < 0.35:
        z = float(ROAD[np.argmin(np.abs(ROAD[:, 0] - x)), 1])
        for s in (-1.05, 1.05):
            if RS.rand() < 0.6:
                hz = H(np.array([x - 1.2, x, x + 1.2]), np.array([z + s] * 3))
                WATER_STRIPS.append([x, float(hz.min()) + 0.05, z + s, RS.uniform(1.5, 3.2), 0.5, 0.0])

# ---------------- vegetation ----------------
print('vegetation ...', flush=True)
VEG = {}          # type -> cell -> floats
CELL = 64.0
def add_veg(t, xf): VEG.setdefault(t, {}).setdefault(ckey(xf[3], xf[11], CELL), []).extend(xf)
# crater mask on a 2 m grid over the whole map
CMASK = np.zeros((BN, BN), bool)
for (cx, cz, r, *_rest) in list(CRATERS) + list(BCR):
    i0, i1 = max(0, int((cx - r - BX0) / BS)), min(BN, int((cx + r - BX0) / BS) + 2)
    j0, j1 = max(0, int((cz - r - BX0) / BS)), min(BN, int((cz + r - BX0) / BS) + 2)
    CMASK[j0:j1, i0:i1] |= np.hypot(BXX[j0:j1, i0:i1] - cx, BZZ[j0:j1, i0:i1] - cz) < r * 0.92
rdist = dist_to_poly(EXX, EZZ, ROAD[(ROAD[:, 0] > -300) & (ROAD[:, 0] < 300)])
def war_free(x, z, m):
    i = int(np.clip(round(x + 256), 0, 512)); j = int(np.clip(round(z + 256), 0, 512))
    return tdist[j, i] > m and rdist[j, i] > 5.5
def in_crater(x, z):
    i = int(np.clip(round((x - BX0) / BS), 0, BN - 1)); j = int(np.clip(round((z - BX0) / BS), 0, BN - 1)); return bool(CMASK[j, i])
def forest_density(x, z):
    f = 0.62 + 0.55 * NF1(x, z) + 0.3 * NF2(x, z)
    f -= 0.9 * np.exp(-(((x - 520) / 160.0) ** 2 + ((z - 640) / 110.0) ** 2))      # meadow south-east
    f -= 0.8 * np.exp(-(((x + 300) / 130.0) ** 2 + ((z - 900) / 160.0) ** 2))      # meadow south-west
    f -= 0.7 * np.exp(-(((x - 900) / 150.0) ** 2 + ((z + 700) / 140.0) ** 2))      # clearing north-east
    d = np.abs(x - creek_x(z)); f -= 0.6 * np.exp(-(d / 12.0) ** 2)
    return np.clip(f, 0, 1)
def burn(x, z):
    b = 1.15 - np.hypot(x, z * 1.3) / 1500 + 0.45 * NB1(x, z)
    return np.clip(b, 0, 1)
TREE_R = {'pine_dead': 0.2, 'pine_snag': 0.19, 'pine_burnt': 0.2, 'pine_live': 0.21, 'stump': 0.24, 'bush_dead': 0.0}
step = 7.6
gx = np.arange(-1500, 1500, step)
counts = {}
for zi, z0 in enumerate(gx):
    xs = gx + RS.uniform(0, step, len(gx)); zs = z0 + RS.uniform(0, step, len(gx))
    dens = forest_density(xs, zs); bn = burn(xs, zs); rnd = RS.rand(len(gx))
    hs = H(xs, zs); rd_d = dist_to_poly(xs, zs, ROAD[(np.abs(ROAD[:, 1] - z0) < 40)]) if np.any(np.abs(ROAD[:, 1] - z0) < 40) else np.full(len(gx), 1e9)
    pyl_d = np.abs((xs - PYL_A[0]) * (-dpl[1]) + (zs - PYL_A[1]) * dpl[0])
    for i in range(len(gx)):
        x, z = float(xs[i]), float(zs[i]); dsy = float(dens[i]); b = float(bn[i])
        inwar = abs(x) < 254 and abs(z) < 254
        if inwar:
            if not war_free(x, z, 4.0): continue
            if math.hypot(x - RANGE_C[0], z - RANGE_C[1]) < 16: continue
            zf = zc_front(x)
            if z < zf - 6: dsy = 0.16                        # no-man's land: a few broken snags
            elif z < zc_support(x) + 10: dsy = 0.32
            else: dsy = min(dsy, 0.42 + 0.004 * (z - 60))
        if rd_d[i] < 6.5 or pyl_d[i] < 9: continue
        if dsy <= 0.02 or rnd[i] > dsy: continue
        if in_crater(x, z): continue
        r = RS.rand()
        if inwar and z < zc_front(x) - 6:
            t = 'pine_snag' if r < 0.55 else ('stump' if r < 0.85 else 'pine_dead')
        else:
            p_dead = 0.25 + 0.6 * b; p_snag = 0.08 + 0.25 * b; p_live = max(0.0, 0.55 - 0.85 * b)
            if r < p_snag * 0.6: t = 'stump' if RS.rand() < 0.45 else 'pine_snag'
            elif r < p_snag * 0.6 + p_live: t = 'pine_live'
            elif r < p_snag * 0.6 + p_live + p_dead * 0.55: t = 'pine_dead'
            else: t = 'pine_burnt'
        s = RS.uniform(0.82, 1.22) if t != 'stump' else RS.uniform(0.8, 1.3)
        lean = RS.uniform(0, 0.05 if t != 'pine_snag' else 0.12)
        la = RS.uniform(0, 6.283)
        y = float(hs[i]) - 0.12
        add_veg(t, xform((x, y, z), RS.uniform(0, 6.283), (s, s, s), lean * math.cos(la), lean * math.sin(la)))
        counts[t] = counts.get(t, 0) + 1
        if RS.rand() < (0.05 if not inwar else 0.08):      # dead bushes and fallen logs between the trees
            bx_, bz_ = x + RS.uniform(-3, 3), z + RS.uniform(-3, 3)
            if not inwar or war_free(bx_, bz_, 3.0):
                if RS.rand() < 0.55:
                    add_veg('bush_dead', xform((bx_, float(H(bx_, bz_)) - 0.05, bz_), RS.uniform(0, 6.28), (RS.uniform(0.7, 1.3),) * 3))
                else:
                    yaw = RS.uniform(0, 6.283); L = 1.0
                    dx, dz = math.cos(yaw), -math.sin(yaw)
                    h0 = float(H(bx_ - dx * 4, bz_ - dz * 4)); h1 = float(H(bx_ + dx * 4, bz_ + dz * 4))
                    pitch = math.atan2(h1 - h0, 8.0)
                    sc = RS.uniform(0.8, 1.2)
                    xf = xform((bx_, (h0 + h1) / 2 + 0.12 * sc, bz_), yaw, (sc, sc, sc), 0, pitch)
                    add_veg('log', xf)
print('trees', counts, flush=True)

# smouldering stumps (smoke) and fallen logs in no-man's land
SMOKES = []
for k in range(14):
    for _ in range(40):
        x, z = RS.uniform(-240, 240), RS.uniform(-220, 230)
        if war_free(x, z, 5) and not in_crater(x, z): break
    SMOKES.append([x, float(H(x, z)), z, RS.uniform(0.6, 1.4)])
    add_veg('stump', xform((x, float(H(x, z)) - 0.1, z), RS.uniform(0, 6.28), (1.1, 0.9, 1.1)))

# ---------------- wrecks, targets, spawn, menu camera ----------------
WRECKS = []
for (x, yawd, tilt) in ((-96.0, 0.35, (0.05, 0.09)), (288.0, -0.5, (0.0, 0.03))):
    z = float(ROAD[np.argmin(np.abs(ROAD[:, 0] - x)), 1]) + (3.6 if x < 0 else -2.0)
    WRECKS.append(dict(model='uaz', p=[x, float(H(x, z)) - 0.05, z], yaw=yawd, tilt=list(tilt)))
d2 = DUGOUTS[1]
TARGETS = []
for k in range(5):
    q2 = RANGE_C + d2['za'] * (-3.0 - 1.6 * k) + d2['xa'] * (k * 2.4 - 4.8)
    TARGETS.append([float(q2[0]), float(H(q2[0], q2[1])), float(q2[1]), math.atan2(d2['za'][0], d2['za'][1])])
SPAWN = (d2['c'] - d2['za'] * 0.15, d2['floor'])
MENU = []
fi = len(FRONT) // 2
for k in range(fi - 6, fi + 7):
    q = FRONT[k]; MENU.append([float(q[0]), float(H(q[0], q[1])) + 1.55, float(q[1])])

# ---------------- dugout records (local frames, roof mound heights) ----------------
DUG_OUT = []
for dg in DUGOUTS:
    xa, za = dg['xa'], dg['za']
    yaw = math.atan2(za[0], za[1])          # Godot: basis.z = (sin yaw, 0, cos yaw)
    nx_, nz_ = 25, 21; xs_ = np.linspace(-2.75, 2.75, nx_); zs_ = np.linspace(-2.45, 1.92, nz_)
    hh = []
    for lz in zs_:
        for lx in xs_:
            wxp = dg['c'][0] + xa[0] * lx + za[0] * lz; wzp = dg['c'][1] + xa[1] * lx + za[1] * lz
            gl = float(ground(wxp, wzp))
            u = max(abs(lx) / 2.75, abs(lz + 0.27) / 2.18)
            mound = 0.5 * (1 - smoothstep(0.62, 1.0, u)) + 0.04 * float(NM2(wxp * 3, wzp * 3))
            if lz > 1.7: mound = max(mound, 0.32)            # flat front above the door frame
            hh += [round(float(wxp), 3), round(max(gl - 0.08, dg['G'] - 0.12 + mound) if u < 0.97 else gl - 0.1, 3), round(float(wzp), 3)]
    DUG_OUT.append(dict(p=[float(dg['c'][0]), float(dg['floor']), float(dg['c'][1])], yaw=yaw, G=float(dg['G']), variant=dg['k'],
                        za=[float(za[0]), float(za[1])], roof=dict(nx=nx_, nz=nz_, pts=hh)))

# ---------------- splat maps ----------------
print('splat ...', flush=True)
def norm_w(W):
    s = W.sum(0, keepdims=True) + 1e-6; W = W / s
    q = np.floor(W * 255).astype(np.int32); rem = 255 - q.sum(0)
    idx = np.argmax(W, 0); np.put_along_axis(q, idx[None], np.take_along_axis(q, idx[None], 0) + rem[None], 0)
    return np.clip(q, 0, 255).astype(np.uint8)
def base_weights(x, z):
    F = forest_density(x, z); Bn = burn(x, z)
    n1 = 0.5 + 0.5 * NF2(x * 3.1, z * 3.1)
    W = np.zeros((8,) + np.shape(x))
    W[0] = F * (1 - 0.55 * Bn) * (0.6 + 0.4 * n1)
    W[1] = F * 0.35 * (1 - n1 * 0.5)
    W[2] = (1 - F) * (1 - 0.45 * Bn) * 1.1
    W[3] = 0.12 + 0.18 * (1 - n1)
    rdd = road_dist(x, z)
    d = np.abs(x - creek_x(z)); W[4] = 1.2 * np.exp(-(d / 9.0) ** 2) + 0.35 * np.exp(-(rdd / 3.5) ** 2)
    W[5] = Bn * (0.12 + 0.3 * F) * (0.5 + 0.5 * (1 - n1))
    W[7] = 1.4 * np.exp(-(rdd / 2.6) ** 2)
    for i in (0, 1, 2, 3, 5): W[i] *= (1 - np.exp(-(rdd / 3.2) ** 2))
    return W
# road distance from a rasterised road + distance transform (1 m grid over the map)
RN = 3073; rmask = np.ones((RN, RN), bool)
for i in range(len(ROAD) - 1):
    a, b = ROAD[i], ROAD[i + 1]
    for t in np.linspace(0, 1, 4):
        q = a + (b - a) * t; ii, jj = int(round(q[0] + 1536)), int(round(q[1] + 1536))
        if 0 <= ii < RN and 0 <= jj < RN: rmask[jj, ii] = False
RDT = ndimage.distance_transform_edt(rmask).astype(np.float32)
def road_dist(x, z):
    ii = np.clip(np.round(np.asarray(x) + 1536).astype(int), 0, RN - 1); jj = np.clip(np.round(np.asarray(z) + 1536).astype(int), 0, RN - 1)
    return RDT[jj, ii]
S = 1024
cx_ = BX0 + (np.arange(S) + 0.5) * (2 * HALF / S); CX, CZ = np.meshgrid(cx_, cx_)
WB = np.zeros((8, S, S))
for j0 in range(0, S, 128): WB[:, j0:j0 + 128] = base_weights(CX[j0:j0 + 128], CZ[j0:j0 + 128])
QB = norm_w(WB)
Image.fromarray(np.moveaxis(QB[0:4], 0, -1), 'RGBA').save(PROJ + '/textures/terrain/splat_base_a.png', optimize=True)
Image.fromarray(np.moveaxis(QB[4:8], 0, -1), 'RGBA').save(PROJ + '/textures/terrain/splat_base_b.png', optimize=True)
# war area, 0.5 m texels
SW = 1024
cw = WX0 + (np.arange(SW) + 0.5) * 0.5; CWX, CWZ = np.meshgrid(cw, cw)
WWt = base_weights(CWX, CWZ)
ti = np.clip(((CWX + 256)).astype(int), 0, 512); tj = np.clip(((CWZ + 256)).astype(int), 0, 512)
td = tdist[tj, ti]
nmz = 0.5 + 0.5 * NM1(CWX * 0.7, CWZ * 0.7)
zf = zc_front(CWX)
noman = smoothstep(-4, -12, CWZ - zf)
churn = noman * 0.9 + (1 - noman) * np.exp(-(td / 9.0) ** 2) * 0.8
dug = (war_at(CWX, CWZ, GW32) - war_at(CWX, CWZ))
crat = (war_at(CWX, CWZ, GW32) - war_at(CWX, CWZ)) * 0
bowl_s = np.zeros_like(CWX)
for (cx, cz, r, dep, wet) in CRATERS:
    m = (np.abs(CWX - cx) < 1.6 * r) & (np.abs(CWZ - cz) < 1.6 * r)
    if not m.any(): continue
    rho = np.hypot(CWX[m] - cx, CWZ[m] - cz) / r
    bowl_s[m] = np.maximum(bowl_s[m], np.clip(1.25 - rho, 0, 1) * (1.0 if wet else 0.6))
W2 = WWt.copy()
W2[0] *= (1 - churn); W2[1] *= (1 - churn * 0.8); W2[2] *= (1 - churn)
W2[3] += churn * (0.5 + 0.4 * nmz)
W2[4] += churn * (0.25 + 0.5 * (1 - nmz)) + bowl_s * 1.6
W2[5] += churn * 0.12 * nmz
W2[7] += 0.25 * np.exp(-(td / 2.2) ** 2)
wb = smoothstep(2.0, 14.0, 256 - np.maximum(np.abs(CWX), np.abs(CWZ)))
W2 = W2 * wb[None] + WWt * (1 - wb[None])
QW = norm_w(W2)
Image.fromarray(np.moveaxis(QW[0:4], 0, -1), 'RGBA').save(PROJ + '/textures/terrain/splat_war_a.png', optimize=True)
Image.fromarray(np.moveaxis(QW[4:8], 0, -1), 'RGBA').save(PROJ + '/textures/terrain/splat_war_b.png', optimize=True)

# ---------------- impostors (far trees, 256 m chunks, custom data = type) ----------------
IMP = {}
TYPE_ID = {'pine_dead': 0, 'pine_snag': 1, 'pine_burnt': 2, 'pine_live': 3}
for t, cells in VEG.items():
    if t not in TYPE_ID: continue
    for k, arr in cells.items():
        a = np.array(arr).reshape(-1, 12)
        for row in a:
            key = ckey(row[3], row[11], 256.0)
            IMP.setdefault(key, []).extend(list(row) + [TYPE_ID[t], float(RS.rand()), 0.0, 0.0])

# ---------------- write ----------------
def r3(L): return [round(float(v), 4) for v in L]
layout = dict(
    version=1,
    base=dict(n=BN, x0=BX0, spacing=BS), war=dict(n=WN, x0=WX0, spacing=WS),
    spawn=[float(SPAWN[0][0]), float(SPAWN[1]), float(SPAWN[0][1]), math.atan2(-d2['za'][0], -d2['za'][1])],
    range=[float(RANGE_C[0]), float(H(RANGE_C[0], RANGE_C[1])), float(RANGE_C[1])],
    menu_cam=MENU,
    dugouts=DUG_OUT,
    pylons=PYLONS,
    wrecks=WRECKS,
    targets=TARGETS,
    smokes=[r3(s) for s in SMOKES],
    water_discs=[r3(w) for w in WATER_DISCS],
    water_strips=[r3(w) for w in WATER_STRIPS],
    props={m: {k: r3(v) for k, v in ch.items()} for m, ch in PROPS.items()},
    colliders={k: r3(v) for k, v in COLL.items()},
    veg={t: {k: r3(v) for k, v in ch.items()} for t, ch in VEG.items()},
    impostors={k: r3(v) for k, v in IMP.items()},
    tree_radius=TREE_R,
    battle=dict(x=[-1400, 1400], z=[-1450, -420]),
    trenches=[dict(kind=k, pts=[[round(float(p[0]), 2), round(float(p[1]), 2)] for p in P]) for (k, P, e, r) in TRENCHES],
    road=[[round(float(p[0]), 1), round(float(p[1]), 1)] for p in ROAD[::3]],
)
json.dump(layout, open(OUT + '/layout.json', 'w'), separators=(',', ':'))
print('props', {m: sum(len(v) // 12 for v in ch.values()) for m, ch in PROPS.items()})
print('colliders', sum(len(v) // 16 for v in COLL.values()), 'water', len(WATER_DISCS), len(WATER_STRIPS), 'craters', len(CRATERS))

# ---------------- previews ----------------
def hillshade(Hm, sp):
    gy, gx = np.gradient(Hm, sp); n = np.dstack([-gx, np.ones_like(Hm), -gy]); n /= np.linalg.norm(n, axis=2, keepdims=True)
    l = np.array([-0.5, 0.75, -0.45]); l /= np.linalg.norm(l); return np.clip(n @ l, 0, 1)
hs = hillshade(HW.astype(np.float64), WS)
Image.fromarray((hs * 255).astype(np.uint8)).resize((1024, 1024), Image.BILINEAR).save(OUT + '/prev_war.png')
crop = hs[int((-60 + 256) / WS):int((80 + 256) / WS), int((-40 + 256) / WS):int((60 + 256) / WS)]
Image.fromarray((crop * 255).astype(np.uint8)).save(OUT + '/prev_war_zoom.png')
hb = hillshade(HB.astype(np.float64), BS)
Image.fromarray((hb * 255).astype(np.uint8)).resize((768, 768), Image.BILINEAR).save(OUT + '/prev_base.png')
print('done')
