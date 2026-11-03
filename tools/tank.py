"""A main battle tank of our own design (no real model copied): welded wedge turret with a bustle, long smoothbore gun
with a thermal sleeve and fume extractor, sloped glacis, side skirts, seven road wheels a side, track belts.
Separate nodes so the game can move them: hull, turret (pivot on the turret ring), gun (pivot on the trunnions),
track_l / track_r (the belts: their texture scrolls), wheels. Faces +Z like glTF models. Woodland camouflage textures.
usage: python3 tank.py <project_dir>  -> models/u/tank.glb, textures/v/tank_*.{jpg,png}"""
import math
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, os.path.dirname(__file__))
from meshlib import Mesh, cyl, box, normalize, write_glb  # noqa: E402

PROJ = sys.argv[1]
os.makedirs(PROJ + '/textures/v', exist_ok=True)
os.makedirs(PROJ + '/models/u', exist_ok=True)

TURRET_PIVOT = np.array([0.0, 1.86, 0.05])
GUN_PIVOT = np.array([0.0, 2.2, 1.75])


# ------------------------------------------------------------------ mesh helpers
def planar_uv(P, n, s):
    a = np.argmax(np.abs(n))
    if a == 0:
        return np.stack([P[:, 2] * s * np.sign(n[0]), -P[:, 1] * s], 1)
    if a == 1:
        return np.stack([P[:, 0] * s, P[:, 2] * s], 1)
    return np.stack([-P[:, 0] * s * np.sign(n[2]), -P[:, 1] * s], 1)


def face(m, mat, pts, uvs=0.5, col=None):
    """a flat convex polygon (fan), normal from its winding"""
    P = np.asarray(pts, np.float64)
    n = normalize(np.cross(P[1] - P[0], P[2] - P[0]))
    if np.linalg.norm(np.cross(P[1] - P[0], P[2] - P[0])) < 1e-9 and len(P) > 3:
        n = normalize(np.cross(P[2] - P[0], P[3] - P[0]))
    UV = planar_uv(P, n, uvs)
    I = [(0, k, k + 1) for k in range(1, len(P) - 1)]
    C = None
    if col is not None:
        C = [col(p) for p in P]
    m.add(mat, P, np.tile(n, (len(P), 1)), UV, I, C)


def loft(m, mat, sections, uvs=0.5, cap0=True, cap1=True, col=None):
    """flat-shaded solid through cross-sections [(z, [(x, y), ...]), ...]; polygons counter-clockwise seen from +Z"""
    S = [np.array([[x, y, z] for (x, y) in poly], np.float64) for z, poly in sections]
    n = len(S[0])
    for i in range(len(S) - 1):
        a, b = S[i], S[i + 1]
        for j in range(n):
            k = (j + 1) % n
            quad = [a[j], a[k], b[k], b[j]]
            if np.linalg.norm(quad[0] - quad[1]) < 1e-6 and np.linalg.norm(quad[2] - quad[3]) < 1e-6:
                continue
            # outward: CCW seen from +Z, going towards +Z: (a_j, b_j, b_k, a_k) faces out
            face(m, mat, [a[j], b[j], b[k], a[k]], uvs, col)
    if cap0:
        face(m, mat, list(S[0][::-1]), uvs, col)
    if cap1:
        face(m, mat, list(S[-1]), uvs, col)


def dirt(p):
    """mud on the lower parts, a little dust on top"""
    k = np.clip((p[1] - 0.3) / 1.2, 0, 1)
    c = 0.62 + 0.38 * k
    return (c, c * 0.98, c * 0.94, 1.0)


def wheel(m, x, y, z, r, w, side):
    """a dual road wheel: rubber rims and a dished steel hub"""
    for dx in (-w * 0.27, w * 0.27):
        x0 = x + dx - w * 0.2
        x1 = x + dx + w * 0.2
        cyl(m, 'rubber', (x0, y, z), (x1, y, z), r, r, 18, 0.4, 0.4, caps=False)
        cyl(m, 'metal', (x0, y, z), (x1, y, z), r * 0.84, r * 0.84, 18, 0.4, 0.4, caps=True)
    cyl(m, 'metal', (x + side * w * 0.5, y, z), (x + side * w * 0.62, y, z), r * 0.3, r * 0.22, 8, 0.3, 0.3)


def belt(m, side_x, width=0.64, thick=0.07):
    """the track: a band running under the wheels, round the idler (front) and the sprocket (rear), back over the top"""
    path = []
    # bottom run, front idler arc, top run (sagging a little), rear sprocket arc
    for z in np.linspace(-3.05, 3.05, 18):
        path.append((z, 0.035))
    cz, cy, r = 3.42, 0.62, 0.36
    for a in np.linspace(-math.pi / 2 + 0.35, math.pi / 2, 9):
        path.append((cz + r * math.cos(a), cy + r * math.sin(a)))
    for z in np.linspace(3.3, -3.3, 14):
        sag = 0.04 * math.sin((z + 3.3) / 6.6 * math.pi * 3) ** 2
        path.append((z, 0.98 - sag))
    cz, cy, r = -3.55, 0.66, 0.36
    for a in np.linspace(math.pi / 2, math.pi * 1.5 - 0.35, 9):
        path.append((cz + r * math.cos(a), cy + r * math.sin(a)))
    path.append(path[0])
    P2 = np.array(path)
    seg = np.r_[0, np.cumsum(np.linalg.norm(P2[1:] - P2[:-1], axis=1))]
    P, N, UV, I = [], [], [], []
    for i, (z, y) in enumerate(P2):
        t = P2[min(i + 1, len(P2) - 1)] - P2[max(i - 1, 0)]
        t = t / (np.linalg.norm(t) + 1e-9)
        nrm = np.array([0.0, -t[0], t[1]])     # outward (the loop runs counter-clockwise in z-y)
        nrm = np.array([0.0, t[0], -t[1]]) if (y > 0.5 and nrm[1] < 0 and z > -3.2 and z < 3.2) else nrm
        for sx in (-0.5, 0.5):
            P.append((side_x + sx * width, y, z))
            N.append((0.0, -t[0], t[1]))
            UV.append((sx + 0.5, seg[i] / 0.9))
    n = len(P2)
    for i in range(n - 1):
        a, b = i * 2, (i + 1) * 2
        I += [(a, b, b + 1), (a, b + 1, a + 1)]
    m.add('track', P, N, UV, I)
    # the inner face of the band (seen through the wheels), darker
    P2i = []
    for (z, y) in P2:
        P2i.append((z, y))
    Pi = [(p[0], p[1] + 0.0, p[2]) for p in P]
    m.add('track', Pi, [(-a[0], -a[1], -a[2]) for a in N], UV, [(a, c, b) for (a, b, c) in I], (0.5, 0.5, 0.5, 1))


# ------------------------------------------------------------------ the parts
def hull():
    m = Mesh()
    base = [(-1.18, 0.5), (1.18, 0.5), (1.2, 1.15), (1.78, 1.2), (1.8, 1.66), (1.62, 1.8), (-1.62, 1.8), (-1.8, 1.66), (-1.78, 1.2), (-1.2, 1.15)]

    def sec(z, ylo, yhi, xs=1.0):
        out = []
        for (x, y) in base:
            yy = ylo + (y - 0.5) / (1.8 - 0.5) * (yhi - ylo)
            out.append((x * xs, yy))
        return (z, out)
    loft(m, 'camo', [sec(-3.98, 0.7, 1.72, 0.98), sec(-3.86, 0.55, 1.8), sec(2.25, 0.5, 1.8), sec(3.3, 0.66, 1.52), sec(3.98, 1.02, 1.3, 0.99)], 0.45, col=dirt)
    # side skirts over the upper run of the tracks (slightly sloped, a little lower at the front)
    for s in (-1, 1):
        x = s * 1.83
        face(m, 'camo', [(x, 0.56, -3.7), (x, 0.56, 3.55), (x + s * 0.06, 1.24, 3.7), (x + s * 0.06, 1.24, -3.75)][::(1 if s > 0 else -1)], 0.45, dirt)
        face(m, 'camo', [(x - s * 0.04, 0.56, 3.55), (x - s * 0.04, 0.56, -3.7), (x - s * 0.04 + s * 0.06, 1.24, -3.75), (x - s * 0.04 + s * 0.06, 1.24, 3.7)][::(1 if s > 0 else -1)], 0.45, dirt)
        box(m, 'camo', (0.08, 0.06, 7.45), (x + s * 0.02, 0.56, -0.07), uvs=0.45, color=(0.6, 0.58, 0.55, 1))
    # engine deck: grilles and a raised access plate
    for k in range(3):
        box(m, 'grille', (1.1, 0.03, 0.42), (0.0 if k < 2 else 0.0, 1.81, -3.2 + k * 0.5), uvs=2.0)
    box(m, 'camo', (2.6, 0.08, 1.6), (0, 1.83, -1.7), uvs=0.45)
    # headlights and their guards, tow hooks
    for s in (-1, 1):
        box(m, 'metal', (0.22, 0.14, 0.12), (s * 1.45, 1.42, 3.88), uvs=2.0)
        box(m, 'glass', (0.16, 0.08, 0.02), (s * 1.45, 1.43, 3.95), uvs=2.0)
        cyl(m, 'metal', (s * 0.75, 0.82, 3.6), (s * 0.75, 0.82, 3.82), 0.07, 0.07, 6)
        cyl(m, 'metal', (s * 0.8, 0.95, -3.98), (s * 0.8, 0.95, -4.1), 0.07, 0.07, 6)
    # driver's hatch and periscopes
    cyl(m, 'camo', (0, 1.8, 2.75), (0, 1.86, 2.75), 0.36, 0.34, 14)
    for k in range(3):
        box(m, 'glass', (0.16, 0.05, 0.04), ((k - 1) * 0.2, 1.88, 3.02), uvs=2.0)
    # stowage boxes on the fenders
    for s in (-1, 1):
        box(m, 'camo', (0.4, 0.32, 1.6), (s * 1.55, 1.96, -2.6), uvs=0.45)
    return m


def wheels():
    m = Mesh()
    for s in (-1, 1):
        x = s * 1.45
        for k in range(7):
            wheel(m, x, 0.43, -2.75 + k * 0.92, 0.4, 0.6, s)
        # rear drive sprocket (toothed ring) and front idler
        cyl(m, 'metal', (x - 0.3, 0.66, -3.55), (x + 0.3, 0.66, -3.55), 0.36, 0.36, 14, caps=True)
        for t in range(12):
            a = t / 12 * math.tau
            box(m, 'metal', (0.5, 0.08, 0.12), (x, 0.66 + 0.4 * math.sin(a), -3.55 + 0.4 * math.cos(a)), uvs=2.0)
        cyl(m, 'metal', (x - 0.28, 0.62, 3.42), (x + 0.28, 0.62, 3.42), 0.33, 0.33, 14, caps=True)
        # return rollers
        for k in range(3):
            cyl(m, 'rubber', (x - 0.2, 0.9, -1.8 + k * 1.8), (x + 0.2, 0.9, -1.8 + k * 1.8), 0.1, 0.1, 8)
    return m


def tracks(side):
    m = Mesh()
    belt(m, side * 1.45)
    return m


def turret():
    m = Mesh()
    base = [(-1.62, 0.0), (1.62, 0.0), (1.76, 0.38), (1.52, 0.72), (-1.52, 0.72), (-1.76, 0.38)]

    def sec(z, xs, ylo, yhi, xo=0.0):
        return (z, [(x * xs + xo, ylo + y / 0.72 * (yhi - ylo)) for (x, y) in base])
    y0 = 1.86
    loft(m, 'camo', [sec(-2.75, 0.84, y0 + 0.12, y0 + 0.64), sec(-2.55, 0.97, y0 + 0.02, y0 + 0.72), sec(0.85, 1.0, y0, y0 + 0.72),
                     sec(1.75, 0.66, y0 + 0.04, y0 + 0.66), sec(2.3, 0.3, y0 + 0.12, y0 + 0.52)], 0.45)
    # commander's cupola with vision blocks, loader's hatch, the gunner's sight
    cyl(m, 'camo', (-0.62, y0 + 0.72, -0.55), (-0.62, y0 + 0.95, -0.55), 0.42, 0.38, 16)
    for k in range(6):
        a = k / 6 * math.tau
        box(m, 'glass', (0.12, 0.08, 0.03), (-0.62 + 0.39 * math.sin(a), y0 + 0.84, -0.55 + 0.39 * math.cos(a)), uvs=2.0)
    cyl(m, 'camo', (-0.62, y0 + 0.95, -0.55), (-0.62, y0 + 1.0, -0.55), 0.34, 0.3, 16)
    cyl(m, 'camo', (0.62, y0 + 0.72, -0.5), (0.62, y0 + 0.78, -0.5), 0.36, 0.34, 14)
    box(m, 'camo', (0.38, 0.34, 0.5), (0.85, y0 + 0.9, 0.75), uvs=0.45)
    box(m, 'glass', (0.3, 0.16, 0.02), (0.85, y0 + 0.92, 1.01), uvs=2.0)
    # the roof machine gun on the cupola
    cyl(m, 'metal', (-0.62, y0 + 1.12, -0.6), (-0.62, y0 + 1.16, 0.55), 0.035, 0.03, 6)
    box(m, 'metal', (0.12, 0.16, 0.36), (-0.62, y0 + 1.1, -0.65), uvs=2.0)
    cyl(m, 'metal', (-0.62, y0 + 1.0, -0.6), (-0.62, y0 + 1.1, -0.6), 0.04, 0.04, 6)
    # smoke grenade launchers either side of the front
    for s in (-1, 1):
        for k in range(4):
            p0 = np.array([s * (1.35 + k * 0.06), y0 + 0.55 + (k % 2) * 0.1, 0.55 - k * 0.12])
            d = normalize(np.array([s * 0.55, 0.55, 0.6]))
            cyl(m, 'metal', p0, p0 + d * 0.3, 0.05, 0.05, 8)
    # bustle basket (rails) and antennas
    for s in (-1, 1):
        cyl(m, 'metal', (s * 1.3, y0 + 0.75, -2.7), (s * 1.3, y0 + 0.75, -1.2), 0.025, 0.025, 6)
        cyl(m, 'metal', (s * 1.2, y0 + 0.75, -2.72), (s * 1.2, y0 + 3.2, -2.75), 0.012, 0.006, 4)
    cyl(m, 'metal', (-1.3, y0 + 0.75, -2.7), (1.3, y0 + 0.75, -2.7), 0.025, 0.025, 6)
    box(m, 'camo', (2.3, 0.3, 0.2), (0, y0 + 0.86, -2.85), uvs=0.45, color=(0.85, 0.85, 0.85, 1))
    return m.transform(t=-TURRET_PIVOT)


def gun():
    m = Mesh()
    y = GUN_PIVOT[1]
    # mantlet
    loft(m, 'camo', [(1.45, [(-0.48, y - 0.3), (0.48, y - 0.3), (0.5, y + 0.28), (-0.5, y + 0.28)]),
                     (2.05, [(-0.4, y - 0.24), (0.4, y - 0.24), (0.42, y + 0.22), (-0.42, y + 0.22)])], 0.45)
    # barrel: thermal sleeve in sections, the fume extractor, the muzzle reference sensor
    z0 = 2.05
    prof = [(z0, 0.15), (2.7, 0.14), (3.4, 0.135), (4.1, 0.13), (4.25, 0.19), (4.95, 0.19), (5.1, 0.125), (5.9, 0.12), (6.7, 0.115), (7.4, 0.11), (7.5, 0.125), (7.62, 0.125)]
    for (za, ra), (zb, rb) in zip(prof[:-1], prof[1:]):
        cyl(m, 'camo' if za < 7.3 else 'metal', (0, y, za), (0, y, zb), ra, rb, 16, 0.6, 0.6, caps=False)
    cyl(m, 'metal', (0, y, 7.62), (0, y, 7.63), 0.125, 0.06, 16, caps=True)
    for k in range(3):
        box(m, 'metal', (0.3, 0.02, 0.02), (0, y + 0.13, 2.8 + k * 1.3), uvs=2.0)
    box(m, 'metal', (0.1, 0.08, 0.14), (0, y + 0.17, 7.42), uvs=2.0)
    # coaxial gun port
    cyl(m, 'metal', (0.32, y - 0.06, 1.98), (0.32, y - 0.06, 2.2), 0.04, 0.035, 8)
    return m.transform(t=-GUN_PIVOT)


# ------------------------------------------------------------------ textures
def fbm(S, octaves, base, seed):
    rs = np.random.RandomState(seed)
    out = np.zeros((S, S))
    amp = 1.0
    for o in range(octaves):
        n = base * 2 ** o
        g = rs.rand(n, n)
        up = np.kron(g, np.ones((S // n, S // n)))
        up = ndimage.gaussian_filter(up, S / n * 0.5, mode='wrap')
        out += up * amp
        amp *= 0.5
    out -= out.min()
    return out / out.max()


def camo_textures():
    S = 1024
    base = np.array([0.33, 0.37, 0.22])
    cols = [np.array([0.19, 0.23, 0.12]), np.array([0.36, 0.28, 0.17]), np.array([0.08, 0.08, 0.07])]
    img = np.tile(base, (S, S, 1))
    for i, c in enumerate(cols):
        n = fbm(S, 4, 4, 10 + i)
        th = [0.6, 0.62, 0.7][i]
        mask = ndimage.gaussian_filter((n > th).astype(float), 1.6, mode='wrap')
        img = img * (1 - mask[..., None]) + c * mask[..., None]
    grain = fbm(S, 6, 8, 40)
    wear = fbm(S, 5, 16, 41)
    img *= (0.88 + 0.22 * grain)[..., None]
    chips = (wear > 0.86).astype(float)
    chips = ndimage.gaussian_filter(chips, 0.6, mode='wrap')
    img = img * (1 - chips[..., None] * 0.6) + np.array([0.24, 0.22, 0.2]) * chips[..., None] * 0.6
    streaks = ndimage.gaussian_filter(np.random.RandomState(42).rand(S, S), (14, 0.8), mode='wrap')
    streaks = (streaks - streaks.mean()) / streaks.std()
    img *= (1.0 - 0.05 * np.clip(streaks, -2, 2))[..., None]
    Image.fromarray((np.clip(img, 0, 1) ** (1 / 1.0) * 255).astype(np.uint8)).save(PROJ + '/textures/v/tank_camo.jpg', quality=90)
    # normal + roughness: cast/rolled armour texture, chips a bit rougher
    h = ndimage.gaussian_filter(fbm(S, 6, 8, 50), 1.0, mode='wrap') * 1.5 + chips * 0.6
    gy, gx = np.gradient(h)
    nx, ny = -gx * 6.0, -gy * 6.0
    nz = np.ones_like(nx)
    ln = np.sqrt(nx * nx + ny * ny + nz * nz)
    rough = np.clip(0.55 + 0.25 * grain + chips * 0.2, 0, 1)
    nrh = np.stack([(nx / ln) * 0.5 + 0.5, (ny / ln) * 0.5 + 0.5, rough, np.ones_like(rough)], -1)
    Image.fromarray((nrh * 255).astype(np.uint8), 'RGBA').save(PROJ + '/textures/v/tank_camo_nrh.png')


def track_textures():
    W, H = 256, 512           # u across the band, v along it (one tile = 0.9 m = 6 links)
    v = np.arange(H)[:, None] / H * 6.0
    u = np.arange(W)[None, :] / W
    link = np.abs((v % 1.0) - 0.5) * 2
    ridge = np.clip(1.0 - np.abs(link - 0.15) * 8.0, 0, 1)
    pad = ((u > 0.08) & (u < 0.46) | (u > 0.54) & (u < 0.92)) & (link < 0.82)
    h = pad * 0.6 + ridge * 0.35 + np.random.RandomState(5).rand(H, W) * 0.05
    h = ndimage.gaussian_filter(h, 1.0)
    alb = np.zeros((H, W, 3))
    alb[:] = (0.16, 0.15, 0.14)
    alb[pad] = (0.1, 0.1, 0.1)
    alb += (h * 0.12)[..., None]
    rust = fbm(256, 4, 4, 60)
    rust = np.kron(rust, np.ones((2, 1)))[:H, :W]
    alb = alb * (1 - (rust > 0.7)[..., None] * 0.4) + np.array([0.3, 0.2, 0.13]) * (rust > 0.7)[..., None] * 0.4
    Image.fromarray((np.clip(alb, 0, 1) * 255).astype(np.uint8)).save(PROJ + '/textures/v/tank_track.jpg', quality=90)
    gy, gx = np.gradient(h)
    nx, ny = -gx * 10.0, -gy * 10.0
    ln = np.sqrt(nx * nx + ny * ny + 1)
    nrh = np.stack([(nx / ln) * 0.5 + 0.5, (ny / ln) * 0.5 + 0.5, np.clip(0.75 - pad * 0.2, 0, 1), np.ones_like(nx)], -1)
    Image.fromarray((nrh * 255).astype(np.uint8), 'RGBA').save(PROJ + '/textures/v/tank_track_nrh.png')


camo_textures()
track_textures()
nodes = [dict(name='hull', mesh=hull()), dict(name='wheels', mesh=wheels()), dict(name='track_l', mesh=tracks(1)), dict(name='track_r', mesh=tracks(-1)),
         dict(name='turret', mesh=turret(), t=tuple(TURRET_PIVOT)), dict(name='gun', mesh=gun(), t=tuple(GUN_PIVOT))]
mats = {'camo': dict(color=(1, 1, 1, 1), rough=0.6), 'grille': dict(color=(0.05, 0.05, 0.05, 1), rough=0.9),
        'metal': dict(color=(0.16, 0.16, 0.15, 1), rough=0.5, metal=0.6), 'rubber': dict(color=(0.07, 0.07, 0.07, 1), rough=0.9),
        'glass': dict(color=(0.08, 0.12, 0.14, 1), rough=0.1, metal=0.5), 'track': dict(color=(0.3, 0.3, 0.3, 1), rough=0.7, metal=0.4)}
size = write_glb(PROJ + '/models/u/tank.glb', nodes, mats, '')
tris = sum(n['mesh'].tcount() for n in nodes)
print('tank.glb %.0f KB, %d triangles' % (size / 1024, tris))
