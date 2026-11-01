#!/usr/bin/env python3
"""Call of Survival: Front - every model as glTF binary (models/*.glb) + dugout metadata (build/dugout_meta.json).
Materials are named; the game swaps in its own shaders by these names.
usage: python3 meshes.py <game_assets_dir> <project_dir> <build_dir>"""
import sys, os, math, json, struct, base64, shutil
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from meshlib import *

SRC, PROJ, BUILD = sys.argv[1], sys.argv[2], sys.argv[3]
MD = PROJ + '/models'; os.makedirs(MD, exist_ok=True)
RS = np.random.RandomState(777)
def smooth(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a))); return t * t * (3 - 2 * t)

MATS = {
    'bark': dict(tex='veg/bark_pine.jpg', nrm='veg/bark_pine_nrh.png', rough=0.9),
    'bare': dict(tex='veg/wood_bare.jpg', nrm='veg/wood_bare_nrh.png', rough=0.85),
    'twigs': dict(tex='veg/twigs.png', alpha='MASK', cutoff=0.45, double=True, rough=0.9),
    'needles_burnt': dict(tex='veg/needles_burnt.png', alpha='MASK', cutoff=0.45, double=True, rough=0.85),
    'needles_live': dict(tex='veg/needles_live.png', alpha='MASK', cutoff=0.45, double=True, rough=0.8),
    'impostor': dict(tex='veg/impostors.png', alpha='MASK', cutoff=0.5, double=True),
    'planks': dict(tex='props/planks.jpg', nrm='props/planks_nrh.png', rough=0.85),
    'logs': dict(tex='props/logs.jpg', nrm='props/logs_nrh.png', rough=0.85),
    'burlap': dict(tex='props/burlap.jpg', nrm='props/burlap_nrh.png', rough=0.95),
    'iron': dict(tex='props/iron.jpg', nrm='props/iron_nrh.png', rough=0.6, metal=0.6),
    'galv': dict(tex='props/galv.jpg', nrm='props/galv_nrh.png', rough=0.5, metal=0.7),
    'concrete': dict(tex='props/galv.jpg', color=(0.62, 0.6, 0.56, 1), rough=0.9),
    'olive': dict(tex='props/olive.jpg', nrm='props/olive_nrh.png', rough=0.6, metal=0.3),
    'red': dict(tex='props/red.jpg', nrm='props/red_nrh.png', rough=0.5, metal=0.3),
    'canvas': dict(tex='props/canvas.jpg', nrm='props/canvas_nrh.png', rough=0.92),
    'blanket': dict(tex='props/blanket.jpg', nrm='props/blanket_nrh.png', rough=0.97),
    'map': dict(tex='props/map.jpg', rough=0.8),
    'glass': dict(color=(0.55, 0.62, 0.55, 0.35), alpha='BLEND', rough=0.05),
    'glass_green': dict(color=(0.15, 0.32, 0.12, 0.55), alpha='BLEND', rough=0.05),
    'ember': dict(color=(1.0, 0.45, 0.12, 1), emissive=(1.0, 0.4, 0.1), rough=1.0),
    'wire': dict(tex='props/wire.png', alpha='MASK', cutoff=0.4, double=True, rough=0.5, metal=0.6),
    'porcelain': dict(color=(0.32, 0.22, 0.16, 1), rough=0.25),
}
def save(name, nodes):
    if not isinstance(nodes, list): nodes = [dict(name=name, mesh=nodes)]
    n = write_glb('%s/%s.glb' % (MD, name), nodes, MATS, '../textures/')
    vc = sum(nd['mesh'].vcount() for nd in nodes); print('  %-18s %6d verts %7.1f KB' % (name, vc, n / 1024))

# =============================================================== trees
def trunk_mesh(m, H, r0, sides, rings, seed, kind, broken_at=None, lean_dir=0.0, fire_dir=0.0, char_h=4.0, bare_from=0.6):
    rs = np.random.RandomState(seed)
    top = broken_at if broken_at else H
    ts = np.concatenate([np.linspace(0, 0.08, max(2, rings // 4)), np.linspace(0.08, 1, rings)[1:]])
    bend = rs.uniform(0.1, 0.35); bdir = rs.uniform(0, 6.28)
    pts, rad = [], []
    for t in ts:
        y = -0.35 + (top + 0.35) * t
        off = bend * math.sin(math.pi * (y / H) * 0.8) + 0.06 * math.sin(y * 1.7 + seed)
        pts.append((math.cos(bdir) * off, y, math.sin(bdir) * off))
        u = y / H
        r = r0 * max(0.06, (1 - u) ** 0.85) * (1 + 0.65 * math.exp(-max(y, 0) / 0.32)) + 0.012
        rad.append(r)
    nz = rs.uniform(0, 100)
    def rnoise(i, a):
        y = pts[i][1]
        return 1 + 0.05 * math.sin(a * 3 + nz + y * 0.7) + (0.18 * max(0, math.sin(a * 5 + nz)) ** 3 * math.exp(-max(y, 0) / 0.45))
    def colf(p, t, a):
        ao = 0.5 + 0.5 * smooth(-0.3, 1.4, p[1]); return (ao, ao, ao, 1)
    def u2f(p, t, a):
        y = p[1]
        side = 0.6 + 0.4 * math.cos(a - fire_dir)
        ch = max(0.0, 1 - y / char_h) ** 0.7 * side
        if kind == 'live': ch *= 0.45
        bare = smooth(bare_from * H, bare_from * H + 4, y) * (0.85 if kind in ('dead', 'snag') else 0.3 if kind == 'burnt' else 0.0)
        return (min(1, ch), bare)
    tube(m, 'bark', pts, rad, sides, 1.0, 2.0, False, False, colf, u2f, rnoise)
    return np.array(pts), np.array(rad)

def splinters(m, p, r, n, h, seed):
    rs = np.random.RandomState(seed)
    for k in range(n):
        a0 = 2 * math.pi * k / n; a1 = 2 * math.pi * (k + 1) / n; am = (a0 + a1) / 2
        hh = h * rs.uniform(0.2, 1.0)
        b0 = np.array(p) + np.array([math.cos(a0) * r, 0, math.sin(a0) * r]); b1 = np.array(p) + np.array([math.cos(a1) * r, 0, math.sin(a1) * r])
        tip = np.array(p) + np.array([math.cos(am) * r * 0.55, hh, math.sin(am) * r * 0.55])
        quad(m, 'bare', [b0, b1, tip, tip], ((0, 1), (0.3, 1), (0.15, 0), (0.15, 0)), (0.8, 0.8, 0.8, 1), (0.0, 1.0))
        quad(m, 'bare', [b1, b0, np.array(p) + np.array([0, hh * 0.5, 0]), np.array(p) + np.array([0, hh * 0.5, 0])], ((0, 1), (0.3, 1), (0.15, 0), (0.15, 0)), (0.6, 0.6, 0.6, 1), (0.0, 1.0))
    # top cap
    ring = [np.array(p) + np.array([math.cos(2 * math.pi * k / n) * r, 0, math.sin(2 * math.pi * k / n) * r]) for k in range(n)]
    for k in range(n):
        quad(m, 'bare', [np.array(p), ring[(k + 1) % n], ring[k], ring[k]], ((0.5, 0.5), (1, 0), (0, 0), (0, 0)), (0.7, 0.7, 0.7, 1), (0.0, 1.0))

def branch_path(start, d, L, droop, n=4):
    pts = [np.array(start)]; d = normalize(d)
    for k in range(1, n + 1):
        t = k / n; p = np.array(start) + d * L * t + np.array([0, -droop * t * t * L, 0]); pts.append(p)
    return pts

def make_pine(kind, seed, lod):
    rs = np.random.RandomState(seed); m = Mesh()
    hi = lod == 0
    H = {'dead': 19.0, 'snag': 19.0, 'burnt': 18.0, 'live': 20.0}[kind] * rs.uniform(0.92, 1.08)
    r0 = rs.uniform(0.18, 0.23)
    brk = rs.uniform(6.5, 11.0) if kind == 'snag' else None
    fire = rs.uniform(0, 6.28); char_h = rs.uniform(3.0, 6.5) if kind != 'live' else 1.6
    pts, rad = trunk_mesh(m, H, r0, 10 if hi else 6, 26 if hi else 7, seed, kind, brk, 0, fire, char_h, rs.uniform(0.45, 0.7))
    top = brk if brk else H
    def trunk_at(y):
        i = int(np.clip(np.searchsorted(pts[:, 1], y), 1, len(pts) - 1)); t = (y - pts[i - 1][1]) / max(1e-6, pts[i][1] - pts[i - 1][1])
        return pts[i - 1] + (pts[i] - pts[i - 1]) * t, rad[i - 1] + (rad[i] - rad[i - 1]) * t
    if brk: splinters(m, pts[-1], rad[-1] * 1.05, 7 if hi else 4, rs.uniform(0.5, 1.4), seed)
    # lower branch stubs
    nst = (34 if hi else 0) if kind != 'live' else (24 if hi else 0)
    for k in range(nst):
        y = rs.uniform(1.4, top * 0.82); p, r = trunk_at(y); a = rs.uniform(0, 6.28)
        d = np.array([math.cos(a), rs.uniform(-0.35, 0.15), math.sin(a)]); L = rs.uniform(0.12, 0.55) * (1.4 if y > 6 else 1)
        rr = rs.uniform(0.018, 0.035)
        tube(m, 'bark', [p + normalize(d) * r * 0.6, p + normalize(d) * (r + L)], [rr, rr * 0.55], 4, 0.4, 1.0, False, True,
             lambda q, t, a_: (0.75, 0.75, 0.75, 1), lambda q, t, a_: (0.6, 0.8))
    # dead branches with twig cards (upper part)
    nb = {'dead': 10, 'snag': 3, 'burnt': 12, 'live': 18}[kind]
    if not hi: nb = {'dead': 4, 'snag': 1, 'burnt': 5, 'live': 8}[kind]
    y0 = top * (0.55 if kind != 'live' else 0.45)
    for k in range(nb):
        y = rs.uniform(y0, top * 0.97); p, r = trunk_at(y); a = rs.uniform(0, 6.28) + k * 2.4
        u = (y - y0) / max(1e-6, top - y0)
        L = (1.0 + 2.6 * (1 - u)) * rs.uniform(0.7, 1.2) * (1.15 if kind == 'live' else 1.0)
        d = np.array([math.cos(a), rs.uniform(0.0, 0.35) + (0.25 if kind == 'live' else 0), math.sin(a)])
        bp = branch_path(p + normalize(d) * r * 0.5, d, L, rs.uniform(0.05, 0.3), 3 if hi else 2)
        tube(m, 'bark', bp, np.linspace(0.04 * (1 - u * 0.5), 0.008, len(bp)), 4 if hi else 3, 0.4, 1.0, False, False,
             lambda q, t, a_: (0.7, 0.7, 0.7, 1), lambda q, t, a_: (0.5, 0.9))
        dd = normalize(bp[-1] - bp[0]); side = normalize(np.cross(dd, np.array([0, 1.0, 0])))
        Rb = np.stack([side, dd, np.cross(side, dd)], 1)          # card: local y along the branch
        if kind in ('dead', 'snag', 'burnt'):
            for c in range(2 if hi else 1):
                Rc = Rb @ rot_y(c * math.pi / 2 + rs.uniform(-0.3, 0.3))
                card(m, 'twigs', bp[0], Rc, L * 0.75, L * 1.05, (0, 0, 1, 1), (1, 1, 1, 1), (0.0, 0.0))
        if kind in ('burnt', 'live'):
            nc = (3 if kind == 'burnt' else 5) if hi else (1 if kind == 'burnt' else 2)
            mat = 'needles_burnt' if kind == 'burnt' else 'needles_live'
            for c in range(nc):
                t = rs.uniform(0.25, 0.9); q = bp[0] + (bp[-1] - bp[0]) * t
                Rc = Rb @ rot_y(rs.uniform(0, math.pi))
                w = rs.uniform(0.7, 1.2) * (1.3 if kind == 'live' else 1.0)
                Rr = Rc @ rot_x(-math.pi / 2)
                card(m, mat, q - dd * 0.2, Rc, w, L * (1 - t) * 0.9 + 0.5, (0, 0, 1, 1), (0.85 + 0.15 * u, 0.85 + 0.15 * u, 0.85 + 0.15 * u, 1), (0.6, 0.0))
    if kind == 'live':        # crown top: a spike of needles
        for c in range(4 if hi else 2):
            Rc = rot_y(c * math.pi / 4)
            card(m, 'needles_live', np.array(pts[-1]) - np.array([0, 2.2, 0]), Rc, 1.3, 2.6, (0, 0, 1, 1), (1, 1, 1, 1), (0.4, 0.0))
    return m

def make_stump(seed, lod):
    rs = np.random.RandomState(seed); m = Mesh()
    H = rs.uniform(0.6, 1.3)
    pts, rad = trunk_mesh(m, 18, 0.22, 10 if lod == 0 else 6, 6 if lod == 0 else 3, seed, 'dead', H, 0, rs.uniform(0, 6.28), 3.0, 0.9)
    splinters(m, pts[-1], rad[-1] * 1.05, 8 if lod == 0 else 4, rs.uniform(0.15, 0.5), seed)
    return m

def make_log(seed, lod):
    rs = np.random.RandomState(seed); m = Mesh(); L = 7.5
    n = 12 if lod == 0 else 4
    pts = [(-L / 2 + L * k / n, 0.0 + 0.05 * math.sin(k * 0.8), 0.04 * math.sin(k * 1.3)) for k in range(n + 1)]
    rad = [0.21 - 0.08 * k / n for k in range(n + 1)]
    fire = rs.uniform(0, 6.28)
    tube(m, 'bark', pts, rad, 9 if lod == 0 else 6, 1.0, 2.0, 'bare', 'bare', lambda p, t, a: (0.7 + 0.3 * max(0, math.sin(a)), 0.7 + 0.3 * max(0, math.sin(a)), 0.7 + 0.3 * max(0, math.sin(a)), 1),
         lambda p, t, a: (0.5 + 0.5 * max(0, math.cos(a - fire)), 0.3 * smooth(0.5, 1, t)))
    if lod == 0:
        for k in range(6):
            x = rs.uniform(-L / 2 + 1, L / 2 - 0.5); a = rs.uniform(0, 6.28); r = 0.2 - 0.08 * (x + L / 2) / L
            d = np.array([0.3, math.cos(a), math.sin(a)])
            p = np.array([x, 0, 0])
            tube(m, 'bark', [p + normalize(d) * r * 0.6, p + normalize(d) * (r + rs.uniform(0.15, 0.6))], [0.03, 0.015], 4, 0.4, 1.0, False, True,
                 lambda q, t, a_: (0.75, 0.75, 0.75, 1), lambda q, t, a_: (0.4, 0.8))
    return m

def make_bush(seed, lod):
    rs = np.random.RandomState(seed); m = Mesh()
    for k in range(7 if lod == 0 else 3):
        a = rs.uniform(0, 6.28); d = np.array([math.cos(a) * 0.5, 1.0, math.sin(a) * 0.5]); L = rs.uniform(0.6, 1.3)
        bp = branch_path((0, -0.05, 0), d, L, -0.1, 3)
        tube(m, 'bark', bp, [0.015, 0.01, 0.006, 0.003], 3, 0.3, 1.0, False, False, lambda q, t, a_: (0.6, 0.6, 0.6, 1), lambda q, t, a_: (0.7, 0.6))
        dd = normalize(bp[-1] - bp[0]); side = normalize(np.cross(dd, np.array([0, 0, 1.0]))); Rb = np.stack([side, dd, np.cross(side, dd)], 1)
        card(m, 'twigs', bp[0], Rb @ rot_y(rs.uniform(0, 3.14)), L * 0.9, L * 1.1, (0, 0, 1, 1), (0.9, 0.9, 0.9, 1), (0.0, 0.0))
    return m

def make_impostor():
    m = Mesh()
    for k in range(2):
        R = rot_y(k * math.pi / 2)
        card(m, 'impostor', (0, 0, 0), R, 5.0, 20.0, (0, 0, 1, 1), (1, 1, 1, 1), (0, 0))
    return m

print('trees', flush=True)
for kind, base, sd in (('dead', 'pine_dead', 11), ('snag', 'pine_snag', 23), ('burnt', 'pine_burnt', 37), ('live', 'pine_live', 51)):
    save(base, make_pine(kind, sd, 0))
    save(base + '_lo', make_pine(kind, sd, 1))
save('stump', make_stump(5, 0)); save('stump_lo', make_stump(5, 1))
save('log', make_log(7, 0)); save('log_lo', make_log(7, 1))
save('bush_dead', make_bush(9, 0)); save('bush_dead_lo', make_bush(9, 1))
save('impostor', make_impostor())

# =============================================================== trench props
print('props', flush=True)
def sandbag():
    m = Mesh()
    def deform(p):
        x = p[0] / 0.28
        p = p.copy(); p[2] *= 1 - 0.22 * smooth(0.72, 1.0, abs(x)); p[1] *= 1 - 0.35 * smooth(0.75, 1.0, abs(x))
        p[1] -= 0.012 * (1 - x * x) * (p[1] > 0)
        return p
    superbox(m, 'burlap', (0.56, 0.16, 0.33), n=(12, 6), e=0.3, uvs=1.3, deform=deform, color_fn=lambda p: (0.65 + 0.35 * smooth(-0.08, 0.06, p[1]),) * 3 + (1,))
    return m
save('sandbag', sandbag())

def revet_planks():
    m = Mesh(); rs = np.random.RandomState(3)
    for k in range(5):
        y = 0.01 + k * 0.2; dz = rs.uniform(-0.008, 0.008)
        box(m, 'planks', (1.0, 0.19, 0.035), (rs.uniform(-0.02, 0.02), y + 0.095, -0.02 + dz), rot_z(rs.uniform(-0.02, 0.02)), 1.0, (0.85,) * 3 + (1,), uv_off=(rs.uniform(0, 1), k * 0.166))
    return m
save('revet_planks', revet_planks())

def revet_wattle():
    m = Mesh(); rs = np.random.RandomState(4)
    for x in (-0.42, 0.0, 0.42):
        cyl(m, 'logs', (x, 0, -0.03), (x, 1.04, -0.03), 0.025, 0.022, 5, 0.3, 1.0, True, (0.8,) * 3 + (1,))
    for k in range(15):
        y = 0.04 + k * 0.066; ph = (k % 2) * math.pi
        pts = [(x, y + rs.uniform(-0.005, 0.005), -0.03 + 0.022 * math.sin(ph + (x + 0.42) / 0.42 * math.pi)) for x in np.linspace(-0.5, 0.5, 9)]
        tube(m, 'logs', pts, [rs.uniform(0.011, 0.017)] * 9, 4, 0.2, 1.0, False, False, lambda p, t, a: (0.75, 0.75, 0.75, 1))
    return m
save('revet_wattle', revet_wattle())

def revet_iron():
    m = Mesh()
    def fn(u, v):
        x = -0.5 + u; return (x, v * 1.0, -0.025 + 0.012 * math.sin(x * 2 * math.pi / 0.076) - 0.01 * math.sin(v * 3.1) * math.sin(u * 2.2))
    grid(m, 'iron', 52, 3, lambda u, v: fn(u, 1 - v) if False else fn(u, v), 1.0, lambda p: (0.8, 0.8, 0.8, 1))
    return m
# grid winding: cross(dv, du) must point at +Z (the trench side)
mI = revet_iron(); P, N, UV, UV2, C, I = mI.arrays('iron')
if N[:, 2].mean() < 0:
    mI = Mesh(); mI.add('iron', P, -N, UV, I[:, ::-1], C, UV2)
save('revet_iron', mI)

def post():
    m = Mesh(); tube(m, 'logs', [(0, 0, 0), (0.01, 0.5, 0), (0, 1.0, 0)], [0.06, 0.058, 0.055], 6, 0.4, 1.0, False, 'bare',
                     lambda p, t, a: (0.6 + 0.4 * t,) * 3 + (1,)); return m
save('post', post())

def duckboard():
    m = Mesh(); rs = np.random.RandomState(5)
    for z in (-0.22, 0.22): box(m, 'planks', (1.24, 0.07, 0.05), (0, 0.035, z), None, 1.0, (0.6, 0.6, 0.6, 1))
    for k in range(10):
        x = -0.56 + k * 0.125
        box(m, 'planks', (0.095, 0.022, 0.62), (x + rs.uniform(-0.01, 0.01), 0.081, rs.uniform(-0.02, 0.02)), rot_y(rs.uniform(-0.04, 0.04)), 1.0, (0.85, 0.85, 0.85, 1), uv_off=(rs.uniform(0, 1), rs.uniform(0, 1)))
    return m
save('duckboard', duckboard())

def ladder():
    m = Mesh()
    for x in (-0.22, 0.22): box(m, 'planks', (0.055, 2.6, 0.07), (x, 1.3, 0), None, 1.0, (0.85,) * 3 + (1,))
    for k in range(8): cyl(m, 'logs', (-0.22, 0.3 + 0.3 * k, 0), (0.22, 0.3 + 0.3 * k, 0), 0.02, 0.02, 5, 0.2, 1.0, False)
    return m
save('ladder', ladder())

def picket():
    m = Mesh(); tube(m, 'logs', [(0, -0.2, 0), (0.0, 0.6, 0.01), (0.01, 1.35, 0)], [0.04, 0.036, 0.032], 5, 0.3, 1.0, False, 'bare',
                     lambda p, t, a: (0.65 + 0.35 * t,) * 3 + (1,)); return m
save('picket', picket())

def wire():
    m = Mesh(); h = 0.035
    quad(m, 'wire', [(0, -h, 0), (1, -h, 0), (1, h, 0), (0, h, 0)], ((0, 1), (1, 1), (1, 0), (0, 0)))
    quad(m, 'wire', [(0, 0, -h), (1, 0, -h), (1, 0, h), (0, 0, h)], ((0, 1), (1, 1), (1, 0), (0, 0)), normal=(0, 1, 0))
    return m
save('wire', wire())

def concertina():
    m = Mesh(); pts = []
    for k in range(13 * 18 + 1):
        a = k / 18 * 2 * math.pi; x = -1 + 2 * k / (13 * 18)
        pts.append((x, 0.42 + 0.42 * math.sin(a), 0.42 * math.cos(a)))
    tube(m, 'iron', pts, [0.006] * len(pts), 3, 0.1, 1.0)
    return m
save('concertina', concertina())

def crate_ammo():
    m = Mesh()
    box(m, 'olive', (0.6, 0.24, 0.34), (0, 0.12, 0), None, 1.0, (0.85, 0.85, 0.85, 1))
    box(m, 'olive', (0.62, 0.03, 0.36), (0, 0.235, 0), None, 1.0, (0.95, 0.95, 0.95, 1))
    for x in (-0.31, 0.31): box(m, 'iron', (0.02, 0.05, 0.12), (x * 1.03, 0.15, 0), None, 1.0)
    return m
save('crate_ammo', crate_ammo())

def crate_long():
    m = Mesh()
    box(m, 'planks', (1.1, 0.3, 0.44), (0, 0.15, 0), None, 1.0, (0.85,) * 3 + (1,))
    for x in (-0.4, 0.4): box(m, 'planks', (0.06, 0.31, 0.45), (x, 0.155, 0), None, 1.0, (0.65,) * 3 + (1,))
    return m
save('crate_long', crate_long())

def bucket():
    m = Mesh()
    lathe(m, 'iron', [(0.0, 0.0), (0.11, 0.0), (0.112, 0.01), (0.14, 0.27), (0.145, 0.28), (0.135, 0.28), (0.105, 0.02), (0.0, 0.02)], 16, color=(0.8, 0.8, 0.8, 1))
    pts = [(0.14 * math.cos(a), 0.28 + 0.12 * math.sin(a), 0) for a in np.linspace(0, math.pi, 10)]
    tube(m, 'iron', pts, [0.004] * 10, 3, 0.1, 1.0)
    return m
save('bucket', bucket())

def jerrycan():
    m = Mesh()
    superbox(m, 'olive', (0.17, 0.46, 0.35), e=0.15, center=(0, 0.24, 0), uvs=1.0)
    for z in (-0.08, 0.0, 0.08): cyl(m, 'olive', (-0.03, 0.49, z), (0.03, 0.49, z), 0.012, 0.012, 5, 0.2, 1.0)
    cyl(m, 'iron', (0, 0.46, 0.12), (0, 0.52, 0.14), 0.02, 0.02, 8, 0.2, 1.0)
    return m
save('jerrycan', jerrycan())

def bridge():
    m = Mesh()
    for z in (-0.3, 0.0, 0.3): box(m, 'planks', (3.2, 0.045, 0.28), (0, 0.022, z), None, 1.0, (0.85,) * 3 + (1,))
    for x in (-1.3, 1.3): box(m, 'planks', (0.1, 0.08, 0.95), (x, -0.04, 0), None, 1.0, (0.6,) * 3 + (1,))
    return m
save('bridge', bridge())

def can():
    m = Mesh()
    lathe(m, 'galv', [(0, 0), (0.033, 0), (0.034, 0.005), (0.034, 0.02)], 14)
    lathe(m, 'red', [(0.034, 0.02), (0.034, 0.095)], 14, uv_v=3)
    lathe(m, 'galv', [(0.034, 0.095), (0.034, 0.11), (0.03, 0.115), (0, 0.112)], 14)
    return m
save('can', can())

def bottle():
    m = Mesh()
    lathe(m, 'glass_green', [(0, 0), (0.035, 0), (0.037, 0.01), (0.037, 0.18), (0.03, 0.21), (0.014, 0.24), (0.014, 0.28), (0.016, 0.285), (0, 0.285)], 14)
    return m
save('bottle', bottle())

def target_frame():
    m = Mesh()
    for x in (-0.35, 0.35): cyl(m, 'logs', (x, -0.3, 0), (x, 1.25, 0), 0.04, 0.035, 6, 0.3, 1.0)
    cyl(m, 'logs', (-0.42, 1.2, 0), (0.42, 1.2, 0), 0.035, 0.035, 6, 0.3, 1.0)
    for x in (-0.12, 0.12): cyl(m, 'iron', (x, 1.2, 0), (x, 1.02, 0), 0.006, 0.006, 4, 0.1, 1.0, False)
    return m
save('target_frame', target_frame())
def target_plate():
    m = Mesh()     # origin at the hinge line
    box(m, 'iron', (0.32, 0.45, 0.012), (0, -0.4, 0), None, 1.0, (0.9, 0.9, 0.9, 1))
    return m
save('target_plate', target_plate())

# =============================================================== pylon
print('pylon', flush=True)
def member(m, a, b, w=0.11, mat='galv'):
    a = np.asarray(a, np.float64); b = np.asarray(b, np.float64); d = b - a; L = np.linalg.norm(d)
    R = basis_from_dir(d)
    box(m, mat, (w, L, w * 0.8), (a + b) / 2, R, 1.0, (0.85, 0.85, 0.85, 1))
def pylon():
    m = Mesh()
    lv = [0.0, 3.5, 7.5, 11.5, 15.5, 18.0, 21.0, 24.0, 26.5]
    def half(y): return 2.8 - (2.8 - 0.75) * min(1.0, y / 15.5)
    corners = [(1, 1), (1, -1), (-1, -1), (-1, 1)]
    for (sx, sz) in corners:
        for i in range(len(lv) - 1):
            y0, y1 = lv[i], lv[i + 1]
            member(m, (sx * half(y0), y0, sz * half(y0)), (sx * half(y1), y1, sz * half(y1)), 0.16 if y0 < 10 else 0.12)
        box(m, 'concrete', (0.9, 0.6, 0.9), (sx * 2.8, 0.1, sz * 2.8), None, 1.0, (0.8, 0.8, 0.8, 1))
    for i, y in enumerate(lv):
        h = half(y)
        for k in range(4):
            (ax, az), (bx, bz) = corners[k], corners[(k + 1) % 4]
            member(m, (ax * h, y, az * h), (bx * h, y, bz * h), 0.09)
            if i < len(lv) - 1:
                y1 = lv[i + 1]; h1 = half(y1)
                member(m, (ax * h, y, az * h), (bx * h1, y1, bz * h1), 0.07)
                member(m, (bx * h, y, bz * h), (ax * h1, y1, az * h1), 0.07)
    # cross arms (along X) with insulator strings
    attach = []
    for (y, span) in ((15.5, 5.6), (21.0, 4.2)):
        h = half(y)
        for sx in (1, -1):
            tip = np.array([sx * span, y, 0.0])
            for sz in (1, -1):
                member(m, (sx * h, y, sz * h), tip, 0.1)
                member(m, (sx * h, y + 1.4, sz * h * 0.8), tip + np.array([0, 0.15, 0]), 0.08)
            member(m, (sx * h, y, 0), (sx * h, y + 1.4, 0), 0.07)
            for k in range(8):
                yy = y - 0.15 - k * 0.16
                lathe(m, 'porcelain', [(0.0, 0.0), (0.13, 0.02), (0.12, 0.05), (0.03, 0.08), (0.0, 0.09)], 10, center=(sx * span, yy - 0.09, 0))
            attach.append([sx * span, y - 1.5, 0.0])
    member(m, (0, 24.0, 0), (0, 27.2, 0), 0.08)
    attach.append([0.0, 27.0, 0.0])
    return m, attach
pm, PYLON_ATTACH = pylon()
save('pylon', pm)

# =============================================================== dugouts
print('dugouts', flush=True)
RX, RZ, CEIL = 1.8, 1.5, 2.05     # interior half-sizes and ceiling height (local frame: +Z towards the trench)
LR = 0.11                          # log radius
def log_along(m, axis, a, b, c1, c2, r=LR, mat='logs', seed=0, caps=True):
    rs = np.random.RandomState(seed)
    if axis == 'x': p0, p1 = (a, c1, c2), (b, c1, c2)
    else: p0, p1 = (c1, c2, a), (c1, c2, b)
    p0 = np.array(p0); p1 = np.array(p1); n = 4
    pts = [p0 + (p1 - p0) * k / n + np.array([0, rs.uniform(-0.01, 0.01), 0]) * (0 < k < n) for k in range(n + 1)]
    rr = r * rs.uniform(0.92, 1.08)
    tube(m, mat, pts, [rr] * (n + 1), 8, 0.5, 2.0, 'bare' if caps else False, 'bare' if caps else False,
         lambda p, t, a_: (0.75 + 0.25 * max(0, math.sin(a_)),) * 3 + (1,), None, None, (0, 1, 0) if axis != 'y' else (1, 0, 0), None, rs.uniform(0, 1))
COLL_D = {}; POINTS_D = {}
def dbox(v, center, half, mat=1, yaw=0.0):
    c, s = math.cos(yaw), math.sin(yaw)
    COLL_D.setdefault(v, []).extend([c, 0, s, center[0], 0, 1, 0, center[1], -s, 0, c, center[2]] + list(half) + [mat])
def shell(m, v):
    k = 0
    # back wall (z = -RZ - LR), side walls, front wall with door
    y = LR
    while y < CEIL + 0.65:
        log_along(m, 'x', -RX - 0.2, RX + 0.2, y, -RZ - LR, seed=k); k += 1
        if y < CEIL + 0.1:
            log_along(m, 'z', -RZ - 0.2, RZ + 0.2, RX + LR, y, seed=k); k += 1
            log_along(m, 'z', -RZ - 0.2, RZ + 0.2, -RX - LR, y, seed=k); k += 1
        if y < 1.86:
            log_along(m, 'x', -RX - 0.2, -0.62, y, RZ + LR, seed=k); k += 1
            log_along(m, 'x', 0.62, RX + 0.2, y, RZ + LR, seed=k); k += 1
        else:
            log_along(m, 'x', -RX - 0.2, RX + 0.2, y, RZ + LR, seed=k); k += 1
        y += LR * 1.9
    # door posts
    for x in (-0.6, 0.6):
        tube(m, 'logs', [(x, 0, RZ + LR), (x, 1.95, RZ + LR)], [0.1, 0.095], 8, 0.5, 2.0, False, 'bare', lambda p, t, a: (0.85,) * 3 + (1,))
    # ceiling logs (along z) and a beam (along x) on two posts
    x = -RX - 0.1
    while x <= RX + 0.12:
        log_along(m, 'z', -RZ - 0.25, RZ + 0.25, x, CEIL + LR, seed=k); k += 1; x += LR * 1.9
    log_along(m, 'x', -RX - 0.1, RX + 0.1, CEIL - 0.09, -0.1, r=0.1, seed=k)
    for x in (-RX + 0.1, RX - 0.1):
        tube(m, 'logs', [(x, 0, -0.1), (x, CEIL - 0.15, -0.1)], [0.08, 0.075], 8, 0.5, 2.0, False, False, lambda p, t, a: (0.8,) * 3 + (1,))
        dbox(v, (x, 1.0, -0.1), (0.08, 1.0, 0.08), 1)
    # floor boards
    rs = np.random.RandomState(v)
    z = -RZ
    while z < RZ - 0.01:
        box(m, 'planks', (2 * RX, 0.03, 0.19), (rs.uniform(-0.02, 0.02), 0.015, z + 0.1), None, 1.0, (0.7, 0.7, 0.7, 1), uv_off=(rs.uniform(0, 1), rs.uniform(0, 1)))
        z += 0.2
    # corridor: floor, two steps, plank walls
    box(m, 'planks', (1.2, 0.03, 0.47), (0, 0.015, RZ + 0.22), None, 1.0, (0.7,) * 3 + (1,))
    box(m, 'planks', (1.2, 0.27, 0.47), (0, 0.135, 2.185), None, 1.0, (0.75,) * 3 + (1,))
    box(m, 'planks', (1.2, 0.52, 0.53), (0, 0.26, 2.685), None, 1.0, (0.8,) * 3 + (1,))
    for sx in (-1, 1):
        for zz in (1.75, 2.35, 2.95):
            box(m, 'planks', (0.035, 2.75, 0.6), (sx * 0.6, 1.375, zz), None, 1.0, (0.7,) * 3 + (1,), uv_off=(zz, 0))
        tube(m, 'logs', [(sx * 0.62, 0, 3.1), (sx * 0.62, 2.8, 3.1)], [0.06, 0.055], 6, 0.4, 1.0, False, 'bare', lambda p, t, a: (0.8,) * 3 + (1,))
    # collision: walls, ceiling, floor, corridor
    dbox(v, (0, 1.4, -RZ - 0.15), (RX + 0.3, 1.4, 0.15), 1)
    dbox(v, (RX + 0.15, 1.4, 0), (0.15, 1.4, RZ + 0.3), 1); dbox(v, (-RX - 0.15, 1.4, 0), (0.15, 1.4, RZ + 0.3), 1)
    dbox(v, ((RX + 0.62) / 2, 1.4, RZ + 0.15), ((RX - 0.62) / 2 + 0.05, 1.4, 0.15), 1); dbox(v, (-(RX + 0.62) / 2, 1.4, RZ + 0.15), ((RX - 0.62) / 2 + 0.05, 1.4, 0.15), 1)
    dbox(v, (0, 2.4, RZ + 0.15), (0.65, 0.4, 0.15), 1)
    dbox(v, (0, CEIL + 0.25, 0), (RX + 0.3, 0.2, RZ + 0.3), 1)
    dbox(v, (0, -0.1, 0), (RX + 0.3, 0.13, RZ + 0.5), 1)
    dbox(v, (0, 0.11, 2.185), (0.6, 0.15, 0.235), 1); dbox(v, (0, 0.25, 2.685), (0.6, 0.26, 0.265), 1)
    dbox(v, (0.64, 1.4, 2.4), (0.05, 1.4, 0.75), 1); dbox(v, (-0.64, 1.4, 2.4), (0.05, 1.4, 0.75), 1)

def table(m, v, c, w=1.1, d=0.65, h=0.76):
    for k, z in enumerate(np.linspace(-d / 2 + 0.08, d / 2 - 0.08, 4)):
        box(m, 'planks', (w, 0.035, d / 4 - 0.008), (c[0], h - 0.017, c[2] + z), None, 1.0, (0.85,) * 3 + (1,), uv_off=(k * 0.3, k * 0.2))
    for sx in (-1, 1):
        for sz in (-1, 1):
            tube(m, 'logs', [(c[0] + sx * (w / 2 - 0.07), 0, c[2] + sz * (d / 2 - 0.07)), (c[0] + sx * (w / 2 - 0.07), h - 0.035, c[2] + sz * (d / 2 - 0.07))], [0.035, 0.032], 6, 0.3, 1.0, False, False, lambda p, t, a: (0.75,) * 3 + (1,))
    dbox(v, (c[0], h / 2, c[2]), (w / 2, h / 2, d / 2), 1)
def bench(m, v, c, w=1.1, yaw=0.0):
    R = rot_y(yaw)
    for k in range(2): box(m, 'planks', (w, 0.04, 0.14), np.array(c) + R @ np.array([0, 0.44, -0.08 + k * 0.16]), R, 1.0, (0.85,) * 3 + (1,))
    for sx in (-1, 1): box(m, 'planks', (0.05, 0.42, 0.3), np.array(c) + R @ np.array([sx * (w / 2 - 0.1), 0.21, 0]), R, 1.0, (0.7,) * 3 + (1,))
    dbox(v, (c[0], 0.23, c[2]), (w / 2, 0.23, 0.17), 1, yaw)
def lamp(m, c):
    lathe(m, 'galv', [(0, 0), (0.07, 0), (0.075, 0.02), (0.06, 0.08), (0.025, 0.1), (0.02, 0.12)], 14, center=c)
    lathe(m, 'glass', [(0.02, 0.12), (0.045, 0.16), (0.048, 0.2), (0.03, 0.26), (0.022, 0.32)], 14, center=c)
    lathe(m, 'ember', [(0.0, 0.135), (0.008, 0.15), (0.0, 0.19)], 6, center=c)
    pts = [(c[0] + 0.07 * math.cos(a), c[1] + 0.12 + 0.2 * math.sin(a), c[2]) for a in np.linspace(0, math.pi, 8)]
    tube(m, 'galv', pts, [0.003] * 8, 3, 0.1, 1.0)
    return (c[0], c[1] + 0.17, c[2])
def stove(m, v, c, yaw):
    R = rot_y(yaw); C = np.array(c)
    def P(x, y, z): return C + R @ np.array([x, y, z])
    box(m, 'iron', (0.46, 0.46, 0.62), P(0, 0.43, 0), R, 1.0, (0.8,) * 3 + (1,))
    box(m, 'iron', (0.5, 0.03, 0.66), P(0, 0.675, 0), R, 1.0, (0.9,) * 3 + (1,))
    for sx in (-1, 1):
        for sz in (-1, 1): box(m, 'iron', (0.04, 0.2, 0.04), P(sx * 0.19, 0.1, sz * 0.27), R, 1.0, (0.6,) * 3 + (1,))
    box(m, 'iron', (0.3, 0.22, 0.02), P(0, 0.42, 0.315), R, 1.0, (0.85,) * 3 + (1,))
    box(m, 'ember', (0.22, 0.03, 0.005), P(0, 0.545, 0.312), R, 1.0)
    box(m, 'ember', (0.2, 0.012, 0.005), P(0, 0.30, 0.328), R, 1.0)
    cyl(m, 'iron', P(0.0, 0.69, -0.2), P(0.0, 1.5, -0.2), 0.065, 0.065, 10, 0.4, 1.0, False)
    cyl(m, 'iron', P(0.0, 1.5, -0.2), P(0.0, 2.45, -0.36), 0.065, 0.065, 10, 0.4, 1.0, False)
    dbox(v, tuple(P(0, 0.35, 0)), (0.25, 0.35, 0.33), 2, yaw)
    return tuple(P(0, 0.45, 0.42))
def bunk(m, v, c, yaw, levels=2):
    R = rot_y(yaw); C = np.array(c)
    def P(x, y, z): return C + R @ np.array([x, y, z])
    L, W = 1.9, 0.8
    for sx in (-1, 1):
        for sz in (-1, 1):
            tube(m, 'logs', [P(sx * L / 2, 0, sz * W / 2), P(sx * L / 2, 1.75 if levels == 2 else 0.6, sz * W / 2)], [0.05, 0.047], 6, 0.3, 1.0, False, 'bare', lambda p, t, a: (0.75,) * 3 + (1,))
    for lv in range(levels):
        y = 0.38 + lv * 0.95
        for sz in (-1, 1): box(m, 'planks', (L, 0.12, 0.04), P(0, y, sz * W / 2), R, 1.0, (0.8,) * 3 + (1,))
        superbox(m, 'canvas', (L - 0.1, 0.13, W - 0.08), e=0.25, center=P(0, y + 0.1, 0), R=R, uvs=1.0)
        rs = np.random.RandomState(lv + 3 * v)
        def bl(u, w_):
            x = -L / 2 + 0.25 + u * (L * 0.62); z = -W / 2 + 0.02 + w_ * (W - 0.04)
            yy = y + 0.17 + 0.04 * math.sin(u * 9 + w_ * 3) * math.sin(w_ * math.pi) + 0.02 * rs.rand()
            if w_ < 0.08 or w_ > 0.92: yy -= 0.12 * (abs(w_ - 0.5) - 0.42) / 0.08
            return tuple(C + R @ np.array([x, yy, z]))
        grid(m, 'blanket', 14, 8, bl, 1.4, lambda p: (0.9, 0.9, 0.9, 1))
        superbox(m, 'canvas', (0.22, 0.09, 0.5), e=0.3, center=P(L / 2 - 0.2, y + 0.21, 0), R=R, uvs=1.0)
        dbox(v, tuple(P(0, y / 2 + 0.1, 0)), (L / 2, y / 2 + 0.12, W / 2), 1, yaw)
def shelf(m, v, c, yaw, w=1.2, items=True, seed=0):
    R = rot_y(yaw); C = np.array(c); rs = np.random.RandomState(seed)
    def P(x, y, z): return C + R @ np.array([x, y, z])
    for y in (1.3, 1.68):
        box(m, 'planks', (w, 0.03, 0.26), P(0, y, 0), R, 1.0, (0.85,) * 3 + (1,))
        for sx in (-1, 1): box(m, 'planks', (0.03, 0.12, 0.2), P(sx * (w / 2 - 0.08), y - 0.075, -0.02), R, 1.0, (0.7,) * 3 + (1,))
        if not items: continue
        x = -w / 2 + 0.1
        while x < w / 2 - 0.12:
            kind = rs.randint(5); p = P(x, y + 0.015, rs.uniform(-0.05, 0.05))
            if kind == 0:   # pot
                lathe(m, 'iron', [(0, 0), (0.09, 0), (0.1, 0.02), (0.1, 0.13), (0.11, 0.135), (0.0, 0.135)], 14, center=p); x += 0.24
            elif kind == 1:  # jar
                lathe(m, 'glass', [(0, 0), (0.05, 0), (0.055, 0.02), (0.055, 0.14), (0.04, 0.16), (0.04, 0.18), (0, 0.18)], 12, center=p)
                lathe(m, 'galv', [(0.0, 0.18), (0.042, 0.18), (0.042, 0.195), (0.0, 0.195)], 12, center=p); x += 0.14
            elif kind == 2:  # cans
                for j in range(rs.randint(1, 4)):
                    q = p + R @ np.array([0, 0.11 * j, 0]) * 0 + R @ np.array([0.075 * j, 0, 0])
                    lathe(m, 'red' if rs.rand() < 0.5 else 'olive', [(0, 0), (0.035, 0), (0.035, 0.11), (0, 0.11)], 10, center=q)
                x += 0.26
            elif kind == 3:  # kettle
                lathe(m, 'galv', [(0, 0), (0.08, 0), (0.09, 0.05), (0.085, 0.12), (0.05, 0.16), (0.02, 0.17), (0, 0.17)], 14, center=p)
                tube(m, 'galv', [p + R @ np.array([0.08, 0.05, 0]), p + R @ np.array([0.15, 0.12, 0])], [0.012, 0.007], 5, 0.1, 1.0)
                x += 0.24
            else:            # bottle
                lathe(m, 'glass_green', [(0, 0), (0.035, 0), (0.037, 0.18), (0.014, 0.24), (0.014, 0.28), (0, 0.28)], 12, center=p); x += 0.12
            x += rs.uniform(0.02, 0.08)
def gas_bottle(m, v, c):
    lathe(m, 'red', [(0, 0), (0.14, 0), (0.15, 0.03), (0.15, 0.45), (0.12, 0.54), (0.05, 0.58), (0.0, 0.585)], 16, center=c, uv_v=1.5)
    cyl(m, 'galv', (c[0], c[1] + 0.58, c[2]), (c[0], c[1] + 0.66, c[2]), 0.02, 0.02, 8, 0.1, 1.0)
    pts = [(c[0] + 0.07 * math.cos(a), c[1] + 0.6 + 0.08 * math.sin(a), c[2]) for a in np.linspace(0, math.pi, 8)]
    tube(m, 'iron', pts, [0.01] * 8, 4, 0.1, 1.0)
    dbox(v, (c[0], 0.3, c[2]), (0.15, 0.3, 0.15), 2)
def crates(m, v, c, yaw, n=3, seed=0):
    R = rot_y(yaw); C = np.array(c); rs = np.random.RandomState(seed); y = 0
    for k in range(n):
        p = C + np.array([rs.uniform(-0.03, 0.03), y, rs.uniform(-0.03, 0.03)])
        sub = crate_ammo() if k % 2 == 0 else crate_long()
        m.merge(sub, rot_y(yaw + rs.uniform(-0.1, 0.1)), p, 0.75 if k % 2 else 1.0)
        y += 0.24 if k % 2 == 0 else 0.225
    dbox(v, (c[0], y / 2, c[2]), (0.42, y / 2, 0.2), 1, yaw)
def firewood(m, v, c):
    rs = np.random.RandomState(4)
    for k in range(9):
        row = k // 4; x = c[0] + (k % 4 - 1.5) * 0.11; y = c[1] + 0.05 + row * 0.095
        cyl(m, 'bark', (x, y, c[2] - 0.22), (x + rs.uniform(-0.02, 0.02), y, c[2] + 0.22), 0.05, 0.048, 7, 0.3, 1.0, 'bare')
def radio(m, c, yaw):
    R = rot_y(yaw)
    box(m, 'olive', (0.3, 0.16, 0.22), np.array(c) + np.array([0, 0.08, 0]), R, 1.0)
    cyl(m, 'iron', np.array(c) + R @ np.array([-0.08, 0.1, 0.11]), np.array(c) + R @ np.array([-0.08, 0.1, 0.125]), 0.02, 0.02, 8, 0.1, 1.0)
    cyl(m, 'iron', np.array(c) + R @ np.array([0.04, 0.17, -0.05]), np.array(c) + R @ np.array([0.04, 0.17, 0.05]), 0.025, 0.025, 8, 0.1, 1.0)
def wall_map(m, c, yaw, w=0.7, h=0.5):
    R = rot_y(yaw); C = np.array(c)
    quad(m, 'map', [C + R @ np.array([-w / 2, -h / 2, 0]), C + R @ np.array([w / 2, -h / 2, 0]), C + R @ np.array([w / 2, h / 2, 0]), C + R @ np.array([-w / 2, h / 2, 0])], ((0, 1), (1, 1), (1, 0), (0, 0)))
def helmet(m, c):
    lathe(m, 'olive', [(0.0, 0.16), (0.08, 0.15), (0.13, 0.1), (0.15, 0.02), (0.16, 0.0), (0.15, -0.005)], 16, center=c)
def sack(m, v, c, s=1.0):
    superbox(m, 'burlap', (0.45 * s, 0.32 * s, 0.32 * s), e=0.45, center=(c[0], c[1] + 0.15 * s, c[2]), uvs=1.3,
             deform=lambda p: p + np.array([0, -0.03 * (p[1] > 0) * (1 - (p[0] / (0.23 * s)) ** 2), 0]))
    dbox(v, (c[0], 0.16 * s, c[2]), (0.22 * s, 0.16 * s, 0.16 * s), 3)

def dugout(v):
    m = Mesh(); shell(m, v); pts = {}
    if v == 0:      # command post
        bunk(m, v, (-0.8, 0, -RZ + 0.42), 0.0, 2)
        table(m, v, (RX - 0.38, 0, 0.0), 1.1, 0.7) if False else table(m, v, (RX - 0.4, 0, 0.05), 0.7, 1.15)
        pts['lamp'] = lamp(m, (RX - 0.42, 0.76, -0.25))
        radio(m, (RX - 0.4, 0.76, 0.35), -math.pi / 2); pts['radio'] = (RX - 0.4, 0.95, 0.35)
        wall_map(m, (RX - 0.02, 1.35, 0.05), -math.pi / 2, 0.9, 0.62)
        bench(m, v, (RX - 0.98, 0, 0.05), 1.0, math.pi / 2)
        pts['stove'] = stove(m, v, (-RX + 0.36, 0, 0.95), math.pi / 2)
        firewood(m, v, (-RX + 0.3, 0.0, 0.3))
        gas_bottle(m, v, (RX - 0.3, 0, -RZ + 0.3))
        shelf(m, v, (0.75, 0, -RZ + 0.14), 0.0, 1.0, True, 11)
        crates(m, v, (RX - 0.35, 0, RZ - 0.32), math.pi / 2, 3, 2); pts['ammo'] = (RX - 0.35, 0.6, RZ - 0.32)
        helmet(m, (-0.2, 1.25, -RZ + 0.12))
    elif v == 1:    # sleeping quarters
        bunk(m, v, (-0.75, 0, -RZ + 0.42), 0.0, 2)
        bunk(m, v, (-RX + 0.42, 0, 0.35), math.pi / 2, 2)
        pts['stove'] = stove(m, v, (RX - 0.36, 0, 0.9), -math.pi / 2)
        firewood(m, v, (RX - 0.3, 0.0, 0.25))
        table(m, v, (RX - 0.38, 0, -0.75), 0.62, 0.7)
        pts['lamp'] = lamp(m, (RX - 0.38, 0.76, -0.75))
        gas_bottle(m, v, (0.9, 0, -RZ + 0.25))
        shelf(m, v, (0.95, 0, -RZ + 0.14), 0.0, 1.1, True, 12)
        sack(m, v, (RX - 0.35, 0, -0.1)); helmet(m, (RX - 0.3, 0.78, -0.55))
        pts['ammo'] = None
    else:           # supply dugout
        crates(m, v, (-RX + 0.3, 0, -RZ + 0.35), 0.0, 4, 5); crates(m, v, (-RX + 0.3, 0, -0.35), math.pi / 2, 3, 6)
        crates(m, v, (-0.55, 0, -RZ + 0.3), 0.0, 3, 7); pts['ammo'] = (-0.55, 0.6, -RZ + 0.3)
        sack(m, v, (0.35, 0, -RZ + 0.3)); sack(m, v, (0.75, 0, -RZ + 0.35), 0.9); sack(m, v, (0.55, 0.3, -RZ + 0.32), 0.8)
        pts['stove'] = stove(m, v, (RX - 0.36, 0, 0.85), -math.pi / 2)
        firewood(m, v, (RX - 0.3, 0.0, 0.2))
        bench(m, v, (RX - 0.35, 0, -0.65), 0.9, math.pi / 2)
        crate_top = (RX - 0.38, 0.0, -1.2); m.merge(crate_ammo(), rot_y(0.2), crate_top); dbox(v, (crate_top[0], 0.12, crate_top[2]), (0.3, 0.12, 0.18), 1)
        pts['lamp'] = lamp(m, (RX - 0.38, 0.24, -1.2))
        gas_bottle(m, v, (-RX + 0.3, 0, 0.75)); gas_bottle(m, v, (-RX + 0.3, 0, 1.1))
        shelf(m, v, (1.0, 0, -RZ + 0.14), 0.0, 1.0, True, 13)
    POINTS_D[v] = {k: (list(map(float, p)) if p is not None else None) for k, p in pts.items()}
    return m
for v in range(3): save('dugout_%d' % v, dugout(v))

# =============================================================== weapon (AK) and the wreck (UAZ), from the game's json glTF
print('json models', flush=True)
def load_json_gltf(path):
    d = json.load(open(path)); g = d['gltf']; buf = base64.b64decode(d['bin'])
    CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
    NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}
    def acc(i):
        a = g['accessors'][i]; bv = g['bufferViews'][a['bufferView']]; dt = np.dtype(CT[a['componentType']]); nc = NC[a['type']]
        off = bv.get('byteOffset', 0) + a.get('byteOffset', 0); stride = bv.get('byteStride', 0) or dt.itemsize * nc
        raw = np.frombuffer(buf, np.uint8, count=stride * (a['count'] - 1) + dt.itemsize * nc, offset=off)
        arr = np.lib.stride_tricks.as_strided(raw, shape=(a['count'], dt.itemsize * nc), strides=(stride, 1)).copy().view(dt).reshape(a['count'], nc).astype(np.float64)
        if a.get('normalized'):
            arr = arr / {np.int8: 127.0, np.uint8: 255.0, np.int16: 32767.0, np.uint16: 65535.0}[CT[a['componentType']]]
            arr = np.maximum(arr, -1)
        return arr
    def node_mats(i, M):
        n = g['nodes'][i]; t = np.array(n.get('translation', [0, 0, 0])); s = np.array(n.get('scale', [1, 1, 1]))
        q = n.get('rotation', [0, 0, 0, 1]); x, y, z, w = q
        Rq = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
        L = np.eye(4); L[:3, :3] = Rq @ np.diag(s); L[:3, 3] = t; W = M @ L
        out = [(i, W)]
        for c in n.get('children', []): out += node_mats(c, W)
        return out
    meshes = []
    for root in g['scenes'][g.get('scene', 0)]['nodes']:
        for (i, W) in node_mats(root, np.eye(4)):
            n = g['nodes'][i]
            if 'mesh' not in n: continue
            for p in g['meshes'][n['mesh']]['primitives']:
                P = acc(p['attributes']['POSITION']); N = acc(p['attributes']['NORMAL']) if 'NORMAL' in p['attributes'] else np.tile([0, 1, 0], (len(P), 1))
                UV = acc(p['attributes']['TEXCOORD_0']) if 'TEXCOORD_0' in p['attributes'] else np.zeros((len(P), 2))
                C = acc(p['attributes']['COLOR_0']) if 'COLOR_0' in p['attributes'] else None
                if C is not None and C.shape[1] == 3: C = np.hstack([C, np.ones((len(C), 1))])
                I = acc(p['indices']).astype(np.int64).reshape(-1, 3)
                A = W[:3, :3]; P2 = P @ A.T + W[:3, 3]; N2 = normalize(N @ np.linalg.inv(A))
                if np.linalg.det(A) < 0: I = I[:, ::-1]
                meshes.append((n.get('name'), p.get('material'), P2, N2, UV, C, I))
    return g, meshes
# AK
TW = PROJ + '/textures/weapons'; os.makedirs(TW, exist_ok=True)
for i in range(3): shutil.copy(SRC + '/models/w_ak_%d.jpg' % i, TW + '/ak_%d.jpg' % i)
# the atlas has a bright red block (a plastic marker on the receiver); paint it gun-metal like the rest
_a = np.asarray(Image.open(TW + '/ak_0.jpg').convert('RGB')).astype(np.float64)
_red = (_a[..., 0] > 120) & (_a[..., 0] > _a[..., 1] * 2.2) & (_a[..., 0] > _a[..., 2] * 2.2)
from scipy import ndimage as _nd
_red = _nd.binary_dilation(_red, iterations=2)
_l = (_a.mean(2, keepdims=True) * 0.35 + 22)
_a = np.where(_red[..., None], np.concatenate([_l * 0.95, _l * 0.95, _l], 2), _a)
Image.fromarray(np.clip(_a, 0, 255).astype(np.uint8)).save(TW + '/ak_0.jpg', quality=92)
_m = np.asarray(Image.open(TW + '/ak_2.jpg').convert('RGB')).astype(np.float64)
_rm = np.asarray(Image.fromarray((_red * 255).astype(np.uint8)).resize((_m.shape[1], _m.shape[0]), Image.BILINEAR)) > 40
_m[_rm] = (255, 215, 30)          # occlusion 1, rough, not metal: a matte plastic part
Image.fromarray(_m.astype(np.uint8)).save(TW + '/ak_2.jpg', quality=92)
g, ms = load_json_gltf(SRC + '/models/w_ak.json')
ak = Mesh()
for (nm, mat, P, N, UV, C, I) in ms: ak.add('ak', P, N, UV, I)
MATS['ak'] = dict(tex='weapons/ak_0.jpg', nrm='weapons/ak_1.jpg', rough=1.0, metal=1.0, mr='weapons/ak_2.jpg')
save('ak', [dict(name='ak', mesh=ak, extras=g['nodes'][0].get('extras', {}))])
# UAZ wreck: burnt paint baked into new textures; glass and lamps dropped
g, ms = load_json_gltf(SRC + '/models/uaz.json')
def burn_tex(src, dst, keep=0.32, seed=1):
    a = np.asarray(Image.open(src).convert('RGB')).astype(np.float64) / 255; H, W = a.shape[:2]
    rs = np.random.RandomState(seed); from scipy import ndimage as nd
    n = nd.gaussian_filter(rs.rand(H // 8 + 1, W // 8 + 1), 1.5); n = np.kron(n, np.ones((8, 8)))[:H, :W]; n = (n - n.min()) / (n.max() - n.min() + 1e-9)
    rust = np.array([0.33, 0.17, 0.08]); soot = np.array([0.05, 0.045, 0.04])
    l = a.mean(2, keepdims=True); a = l * 0.5 + a * 0.5
    r = np.clip((n - 0.35) * 2.2, 0, 1)[..., None]
    out = a * keep * (1 - r) + rust * (0.7 + 0.6 * n[..., None]) * r
    out = out * (0.55 + 0.45 * n[..., None]) + soot * 0.3
    Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8)).save(dst, quality=88)
TP = PROJ + '/textures/props'
burn_tex(SRC + '/models/uaz_4.jpg', TP + '/uaz_body_burnt.jpg', 0.3, 3)
burn_tex(SRC + '/models/uaz_7.jpg', TP + '/uaz_roof_burnt.jpg', 0.25, 4)
burn_tex(SRC + '/models/uaz_0.jpg', TP + '/uaz_interior_burnt.jpg', 0.2, 5)
MATS['uaz_body'] = dict(tex='props/uaz_body_burnt.jpg', rough=0.85, metal=0.4)
MATS['uaz_roof'] = dict(tex='props/uaz_roof_burnt.jpg', rough=0.9, metal=0.3)
MATS['uaz_inside'] = dict(tex='props/uaz_interior_burnt.jpg', rough=0.95)
MATS['uaz_dark'] = dict(color=(0.06, 0.055, 0.05, 1), rough=0.95)
MATS['uaz_rust'] = dict(tex='props/iron.jpg', rough=0.8, metal=0.5)
names = [mm.get('name') for mm in g['materials']]
uaz = Mesh()
for (nm, mat, P, N, UV, C, I) in ms:
    mn = names[mat] if mat is not None else ''
    if mn in ('Windows', 'Light', 'LightRear', 'Number'): continue
    if nm.startswith('wheel'):
        if nm in ('wheel_fl', 'wheel_rr'): continue          # two wheels are gone
        out = 'uaz_dark'
    else:
        out = {'Paint_body': 'uaz_body', 'Pain_bump': 'uaz_body', 'Roof': 'uaz_roof', 'Interior_4': 'uaz_inside', 'Radiator': 'uaz_rust', 'uaz_metal': 'uaz_rust',
               'uaz_satin': 'uaz_rust', 'uaz_matte': 'uaz_dark', 'uaz_wheel': 'uaz_dark'}.get(mn, 'uaz_rust')
    if out == 'uaz_rust': UV = P[:, [0, 2]] * 1.5 + P[:, [1, 1]] * 0.5
    uaz.add(out, P, N, UV, I, None)
lo, hi = uaz.bounds(); print('  uaz bounds', lo.round(2), hi.round(2))
save('uaz_wreck', uaz)

json.dump(dict(colliders={str(k): [round(float(x), 4) for x in v] for k, v in COLL_D.items()}, points={str(k): v for k, v in POINTS_D.items()},
               pylon_attach=PYLON_ATTACH, room=dict(rx=RX, rz=RZ, ceil=CEIL), uaz=dict(lo=lo.tolist(), hi=hi.tolist())),
          open(BUILD + '/dugout_meta.json', 'w'))
print('meshes done')
