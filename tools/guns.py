"""Firearms and sights of our own design (none copied from a real model or a game): a 5.56 carbine, a 9 mm SMG,
a bolt-action sniper rifle, a pump shotgun, a pistol, and seven sights (red dot, holographic, 2x, 3x, 4x, 6x, 8x).
Every gun is built with its barrel along +Z like the AK of the game (the game turns them round), the sight line on the
receiver top. Writes models/w/<name>.glb and data/guns.json with the points the game needs (muzzle, hands, stock,
sight rail, iron-sight height), all in the game's frame (barrel along -Z, as the AK after its turn).
usage: python3 guns.py <project_dir>"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, os.path.dirname(__file__))
from meshlib import Mesh, box, cyl, normalize, write_glb  # noqa: E402

PROJ = sys.argv[1]
os.makedirs(PROJ + '/models/w', exist_ok=True)
os.makedirs(PROJ + '/textures/w', exist_ok=True)


# ------------------------------------------------------------------ helpers (+Z = muzzle end, +Y = up)
def face(m, mat, pts, s=6.0):
    P = np.asarray(pts, np.float64)
    n = normalize(np.cross(P[1] - P[0], P[2] - P[0]))
    a = np.argmax(np.abs(n))
    if a == 0:
        UV = np.stack([P[:, 2] * s, -P[:, 1] * s], 1)
    elif a == 1:
        UV = np.stack([P[:, 0] * s, P[:, 2] * s], 1)
    else:
        UV = np.stack([P[:, 0] * s, -P[:, 1] * s], 1)
    m.add(mat, P, np.tile(n, (len(P), 1)), UV, [(0, k, k + 1) for k in range(1, len(P) - 1)])


def prism(m, mat, profile, x0, x1, s=6.0, bevel=0.0):
    """a side profile [(z, y), ...] (counter-clockwise seen from +X) extruded across x0..x1, flat shaded"""
    P = [np.array(p, np.float64) for p in profile]
    n = len(P)
    L = [np.array([x0, p[1], p[0]]) for p in P]
    R = [np.array([x1, p[1], p[0]]) for p in P]
    face(m, mat, R, s)
    face(m, mat, L[::-1], s)
    for i in range(n):
        j = (i + 1) % n
        face(m, mat, [L[i], L[j], R[j], R[i]], s)


def tube(m, mat, z0, z1, r0, r1=None, y=0.0, x=0.0, sides=14, caps=True):
    cyl(m, mat, (x, y, z0), (x, y, z1), r0, r0 if r1 is None else r1, sides, 0.05, 0.1, caps=caps)


def rail(m, z0, z1, y, w=0.021):
    """a Picatinny rail: base and the slotted top"""
    box(m, 'metal', (w, 0.008, z1 - z0), (0, y + 0.004, (z0 + z1) / 2), uvs=8.0)
    k = int((z1 - z0) / 0.01)
    for i in range(k):
        if i % 2 == 0:
            box(m, 'metal', (w * 1.05, 0.006, 0.0052), (0, y + 0.011, z0 + (i + 0.5) * (z1 - z0) / k), uvs=8.0)


def mag_curved(m, mat, z, y, h, depth, width, curve, segs=6):
    """a box magazine that curves forward as it goes down"""
    for k in range(segs):
        t0, t1 = k / segs, (k + 1) / segs
        za, zb = z + curve * t0 * t0, z + curve * t1 * t1
        ya, yb = y - h * t0, y - h * t1
        prof = [(za - depth / 2, ya), (za + depth / 2, ya), (zb + depth / 2, yb), (zb - depth / 2, yb)][::-1]
        prism(m, mat, prof, -width / 2, width / 2)


# ------------------------------------------------------------------ guns
def carbine():
    m = Mesh()
    # upper receiver, lower receiver with the magazine well, pistol grip, trigger guard
    prism(m, 'metal', [(-0.07, 0.0), (0.12, 0.0), (0.12, 0.05), (-0.07, 0.05)][::-1], -0.016, 0.016)
    prism(m, 'metal', [(-0.08, -0.045), (0.06, -0.045), (0.06, 0.0), (-0.08, 0.0)][::-1], -0.017, 0.017)
    prism(m, 'metal', [(0.02, -0.08), (0.06, -0.08), (0.06, -0.045), (0.02, -0.045)][::-1], -0.019, 0.019)
    prism(m, 'polymer', [(-0.075, -0.045), (-0.04, -0.045), (-0.055, -0.135), (-0.095, -0.13)][::-1], -0.014, 0.014)
    box(m, 'metal', (0.008, 0.004, 0.06), (0, -0.064, -0.015), uvs=8.0)
    # handguard (free-floating, flat sides with slots), barrel, gas block, muzzle brake
    prism(m, 'polymer', [(0.12, -0.012), (0.42, -0.012), (0.42, 0.047), (0.12, 0.047)][::-1], -0.021, 0.021)
    for k in range(5):
        for s in (-1, 1):
            box(m, 'metal', (0.002, 0.01, 0.028), (s * 0.0215, 0.018, 0.16 + k * 0.05), uvs=8.0)
    tube(m, 'metal', 0.42, 0.56, 0.0095, y=0.018)
    tube(m, 'metal', 0.42, 0.44, 0.014, y=0.018)
    tube(m, 'metal', 0.56, 0.61, 0.014, 0.012, y=0.018)
    rail(m, -0.07, 0.42, 0.05)
    # buffer tube and the collapsible stock
    tube(m, 'metal', -0.08, -0.25, 0.016, y=0.022)
    prism(m, 'polymer', [(-0.33, -0.065), (-0.2, -0.02), (-0.2, 0.05), (-0.33, 0.045)][::-1], -0.02, 0.02)
    box(m, 'polymer', (0.044, 0.12, 0.012), (0, -0.005, -0.336), uvs=8.0)
    # charging handle, ejection port cover, forward assist
    box(m, 'metal', (0.03, 0.008, 0.02), (0, 0.054, -0.06), uvs=8.0)
    box(m, 'metal', (0.002, 0.016, 0.06), (0.017, 0.028, 0.03), uvs=8.0)
    tube(m, 'metal', 0.0, 0.02, 0.006, x=0.02, y=0.035, sides=8)
    mag_curved(m, 'polymer', 0.04, -0.06, 0.16, 0.06, 0.024, 0.035)
    # flip-up iron sights (front on the gas block, rear on the rail)
    prism(m, 'metal', [(0.405, 0.05), (0.42, 0.05), (0.415, 0.098), (0.408, 0.098)][::-1], -0.004, 0.004)
    box(m, 'metal', (0.03, 0.03, 0.012), (0, 0.072, -0.04), uvs=8.0)
    return m, {"muzzle": 0.61, "bore_y": 0.018, "rail": [-0.07, 0.42, 0.058], "iron_y": 0.095, "grip": [-0.065, -0.07],
               "fore": [0.3, -0.005], "stock": [-0.33, 0.01], "mag": 30, "len": 0.94}


def smg():
    m = Mesh()
    prism(m, 'metal', [(-0.1, -0.03), (0.16, -0.03), (0.16, 0.035), (0.13, 0.05), (-0.1, 0.05)][::-1], -0.018, 0.018)
    prism(m, 'polymer', [(-0.07, -0.03), (-0.035, -0.03), (-0.05, -0.12), (-0.09, -0.115)][::-1], -0.014, 0.014)
    prism(m, 'polymer', [(0.06, -0.03), (0.15, -0.03), (0.15, 0.0), (0.06, 0.0)][::-1], -0.022, 0.022)
    tube(m, 'metal', 0.16, 0.28, 0.009, y=0.01)
    tube(m, 'metal', 0.25, 0.3, 0.017, y=0.01)
    mag_curved(m, 'metal', 0.03, -0.03, 0.17, 0.035, 0.02, 0.05)
    # folding stock: two struts and a butt plate
    for s in (-1, 1):
        box(m, 'metal', (0.006, 0.01, 0.22), (s * 0.016, 0.02, -0.2), uvs=8.0)
    box(m, 'polymer', (0.04, 0.1, 0.012), (0, -0.01, -0.31), uvs=8.0)
    rail(m, -0.05, 0.12, 0.05)
    box(m, 'metal', (0.012, 0.03, 0.01), (0, 0.068, 0.15), uvs=8.0)
    box(m, 'metal', (0.026, 0.025, 0.012), (0, 0.065, -0.07), uvs=8.0)
    box(m, 'metal', (0.008, 0.004, 0.05), (0, -0.05, -0.02), uvs=8.0)
    return m, {"muzzle": 0.3, "bore_y": 0.01, "rail": [-0.05, 0.12, 0.058], "iron_y": 0.08, "grip": [-0.06, -0.06],
               "fore": [0.11, -0.02], "stock": [-0.31, 0.01], "mag": 32, "len": 0.62}


def sniper():
    m = Mesh()
    # stock: one piece with a thumbhole-like grip and an adjustable cheek rest
    prof = [(-0.42, -0.07), (-0.3, -0.05), (-0.16, -0.06), (-0.11, -0.13), (-0.07, -0.13), (-0.06, -0.03), (0.38, -0.025),
            (0.38, 0.02), (-0.06, 0.02), (-0.16, 0.035), (-0.42, 0.04)]
    prism(m, 'stock', prof[::-1], -0.022, 0.022, 4.0)
    box(m, 'stock', (0.03, 0.03, 0.16), (0, 0.055, -0.28), uvs=6.0)
    box(m, 'polymer', (0.046, 0.12, 0.014), (0, -0.015, -0.425), uvs=8.0)
    # action, bolt handle, trigger guard, detachable mag
    tube(m, 'metal', -0.07, 0.16, 0.019, y=0.035)
    cyl(m, 'metal', (0.02, 0.04, -0.035), (0.06, 0.02, -0.045), 0.005, 0.005, 6)
    cyl(m, 'metal', (0.06, 0.02, -0.045), (0.065, 0.019, -0.046), 0.011, 0.011, 8)
    box(m, 'metal', (0.008, 0.004, 0.06), (0, -0.055, -0.03), uvs=8.0)
    box(m, 'metal', (0.03, 0.06, 0.08), (0, -0.04, 0.05), uvs=8.0)
    # a long heavy barrel with a brake; a folded bipod under the fore-end
    tube(m, 'metal', 0.16, 0.86, 0.013, 0.011, y=0.035)
    tube(m, 'metal', 0.86, 0.93, 0.017, y=0.035)
    for s in (-1, 1):
        box(m, 'metal', (0.008, 0.008, 0.16), (s * 0.012, -0.035, 0.28), uvs=8.0)
    rail(m, -0.06, 0.18, 0.054)
    return m, {"muzzle": 0.93, "bore_y": 0.035, "rail": [-0.06, 0.18, 0.062], "iron_y": 0.1, "grip": [-0.095, -0.08],
               "fore": [0.28, -0.03], "stock": [-0.42, 0.0], "mag": 5, "len": 1.35}


def shotgun():
    m = Mesh()
    prism(m, 'metal', [(-0.1, -0.03), (0.12, -0.03), (0.12, 0.04), (-0.1, 0.04)][::-1], -0.02, 0.02)
    tube(m, 'metal', 0.12, 0.62, 0.012, y=0.022)
    tube(m, 'metal', 0.12, 0.58, 0.012, y=-0.012)
    tube(m, 'metal', 0.58, 0.6, 0.014, y=-0.012)
    # the pump (ribbed wooden fore-end) and the stock with a pistol grip
    for k in range(6):
        tube(m, 'stock', 0.2 + k * 0.035, 0.228 + k * 0.035, 0.021, y=-0.008, sides=12)
    prof = [(-0.42, -0.08), (-0.18, -0.03), (-0.12, -0.06), (-0.08, -0.12), (-0.045, -0.115), (-0.04, -0.03), (-0.1, 0.035), (-0.42, 0.045)]
    prism(m, 'stock', prof[::-1], -0.02, 0.02, 4.0)
    box(m, 'polymer', (0.044, 0.13, 0.014), (0, -0.018, -0.425), uvs=8.0)
    box(m, 'metal', (0.008, 0.004, 0.06), (0, -0.05, -0.02), uvs=8.0)
    box(m, 'metal', (0.006, 0.01, 0.006), (0, 0.04, 0.6), uvs=8.0)
    rail(m, -0.06, 0.1, 0.04)
    return m, {"muzzle": 0.62, "bore_y": 0.022, "rail": [-0.06, 0.1, 0.048], "iron_y": 0.05, "grip": [-0.065, -0.075],
               "fore": [0.29, -0.01], "stock": [-0.42, 0.0], "mag": 6, "len": 1.04}


def pistol():
    m = Mesh()
    prism(m, 'metal', [(-0.09, 0.0), (0.105, 0.0), (0.105, 0.032), (-0.09, 0.034)][::-1], -0.013, 0.013)
    prism(m, 'polymer', [(-0.075, -0.035), (0.09, -0.035), (0.09, 0.0), (-0.075, 0.0)][::-1], -0.012, 0.012)
    prism(m, 'polymer', [(-0.075, -0.035), (-0.035, -0.035), (-0.052, -0.13), (-0.095, -0.125)][::-1], -0.0145, 0.0145)
    box(m, 'metal', (0.006, 0.004, 0.04), (0, -0.05, 0.0), uvs=8.0)
    tube(m, 'metal', 0.1, 0.108, 0.0055, y=0.017, sides=10)
    for k in range(6):
        box(m, 'metal', (0.027, 0.02, 0.003), (0, 0.018, -0.08 + k * 0.006), uvs=8.0)
    box(m, 'metal', (0.004, 0.006, 0.006), (0, 0.036, 0.095), uvs=8.0)
    box(m, 'metal', (0.016, 0.006, 0.006), (0, 0.036, -0.08), uvs=8.0)
    return m, {"muzzle": 0.108, "bore_y": 0.017, "rail": [0.0, 0.0, 0.0], "iron_y": 0.04, "grip": [-0.06, -0.065],
               "fore": [-0.06, -0.08], "stock": [-0.09, 0.0], "mag": 15, "len": 0.2}


# ------------------------------------------------------------------ sights (built on the rail at z = 0, along +Z)
def sight_reddot():
    m = Mesh()
    box(m, 'metal', (0.026, 0.012, 0.04), (0, 0.006, 0), uvs=8.0)
    tube(m, 'metal', -0.02, 0.025, 0.017, y=0.03, sides=16, caps=False)
    tube(m, 'lens', 0.012, 0.013, 0.015, y=0.03, sides=16)
    return m, 0.03


def sight_holo():
    m = Mesh()
    box(m, 'metal', (0.034, 0.016, 0.07), (0, 0.008, 0), uvs=8.0)
    for s in (-1, 1):
        box(m, 'metal', (0.004, 0.034, 0.05), (s * 0.017, 0.033, 0.005), uvs=8.0)
    box(m, 'metal', (0.038, 0.004, 0.05), (0, 0.051, 0.005), uvs=8.0)
    box(m, 'lens', (0.03, 0.03, 0.002), (0, 0.033, 0.026), uvs=8.0)
    return m, 0.033


def sight_scope(power):
    """a tube scope: longer and with a bigger objective as it magnifies more"""
    m = Mesh()
    L = 0.12 + power * 0.022
    ro = 0.016 + power * 0.0025
    h = 0.04 + power * 0.001
    for z in (-L * 0.22, L * 0.2):
        box(m, 'metal', (0.024, 0.012, 0.016), (0, 0.006, z), uvs=8.0)
        cyl(m, 'metal', (-0.02, h, z), (0.02, h, z), 0.017, 0.017, 10, caps=False)
    tube(m, 'metal', -L * 0.5, -L * 0.3, 0.019, 0.015, y=h)
    tube(m, 'metal', -L * 0.3, L * 0.25, 0.015, y=h, caps=False)
    tube(m, 'metal', L * 0.25, L * 0.36, 0.015, ro, y=h, caps=False)
    tube(m, 'metal', L * 0.36, L * 0.5, ro, y=h, caps=False)
    tube(m, 'lens', L * 0.495, L * 0.5, ro * 0.92, y=h)
    tube(m, 'lens', -L * 0.5, -L * 0.495, 0.017, y=h)
    cyl(m, 'metal', (0, h + 0.015, 0), (0, h + 0.03, 0), 0.01, 0.01, 10)
    cyl(m, 'metal', (0.015, h, 0), (0.03, h, 0), 0.01, 0.01, 10)
    return m, h


# ------------------------------------------------------------------ textures: parkerised steel, polymer, laminated wood
def noise(S, sigma, seed):
    n = ndimage.gaussian_filter(np.random.RandomState(seed).rand(S, S), sigma, mode='wrap')
    return (n - n.min()) / (n.max() - n.min() + 1e-9)


def textures():
    S = 256
    g = noise(S, 1.2, 1) * 0.6 + noise(S, 6, 2) * 0.4
    metal = np.stack([0.11 + g * 0.05, 0.11 + g * 0.05, 0.115 + g * 0.05], -1)
    edge = noise(S, 3, 3) > 0.82
    metal[edge] += 0.06
    Image.fromarray((np.clip(metal, 0, 1) * 255).astype(np.uint8)).save(PROJ + '/textures/w/metal.jpg', quality=92)
    poly = np.stack([0.07 + g * 0.03] * 3, -1)
    Image.fromarray((np.clip(poly, 0, 1) * 255).astype(np.uint8)).save(PROJ + '/textures/w/polymer.jpg', quality=92)
    yy = np.arange(S)[:, None] / S
    xx = np.arange(S)[None, :] / S
    rings = np.sin((yy * 40.0 + noise(S, 8, 4) * 6.0 + xx * 0.6) * math.pi) * 0.5 + 0.5
    wood = np.stack([0.32 + rings * 0.12, 0.2 + rings * 0.07, 0.11 + rings * 0.04], -1) * (0.85 + noise(S, 1, 5)[..., None] * 0.2)
    Image.fromarray((np.clip(wood, 0, 1) * 255).astype(np.uint8)).save(PROJ + '/textures/w/wood.jpg', quality=92)


textures()
mats = {'metal': dict(color=(1, 1, 1, 1), tex='../../textures/w/metal.jpg', rough=0.42, metal=0.75),
        'polymer': dict(color=(1, 1, 1, 1), tex='../../textures/w/polymer.jpg', rough=0.72, metal=0.0),
        'stock': dict(color=(1, 1, 1, 1), tex='../../textures/w/wood.jpg', rough=0.55, metal=0.0),
        'lens': dict(color=(0.1, 0.16, 0.2, 1), rough=0.05, metal=0.8)}
out = {}
for name, fn, kind in (('carbine', carbine, 'rifle'), ('smg', smg, 'smg'), ('sniper', sniper, 'sniper'), ('shotgun', shotgun, 'shotgun'), ('pistol', pistol, 'pistol')):
    mesh, pts = fn()
    write_glb(PROJ + '/models/w/%s.glb' % name, [dict(name=name, mesh=mesh)], mats, '')
    # into the game's frame: barrel along -Z (the game turns the model by 180 degrees about Y)
    out[name] = {"kind": kind, "tris": mesh.tcount(),
                 "muzzle": [0.0, pts["bore_y"], -pts["muzzle"]],
                 "grip_r": [0.012, pts["grip"][1], -pts["grip"][0]],
                 "grip_l": [0.0, pts["fore"][1] - 0.02, -pts["fore"][0]],
                 "stock": [0.0, pts["stock"][1], -pts["stock"][0]],
                 "rail": [0.0, pts["rail"][2], -(pts["rail"][0] + pts["rail"][1]) * 0.5] if pts["rail"][1] > pts["rail"][0] else [],
                 "iron_y": pts["iron_y"], "len": pts["len"]}
sights = {}
for name, fn in (('reddot', sight_reddot), ('holo', sight_holo), ('x2', lambda: sight_scope(2)), ('x3', lambda: sight_scope(3)),
                 ('x4', lambda: sight_scope(4)), ('x6', lambda: sight_scope(6)), ('x8', lambda: sight_scope(8))):
    mesh, h = fn()
    write_glb(PROJ + '/models/w/sight_%s.glb' % name, [dict(name=name, mesh=mesh)], mats, '')
    sights[name] = {"axis_y": h, "tris": mesh.tcount()}
json.dump({"guns": out, "sights": sights}, open(PROJ + '/data/guns.json', 'w'), indent=1)
for k, v in out.items():
    print('%-8s %5d tris  len %.2f' % (k, v['tris'], v['len']))
print('sights', {k: v['tris'] for k, v in sights.items()})
