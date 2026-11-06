#!/usr/bin/env python3
"""Call of Survival - the island's map picture for the in-game map and the minimap (textures/ui/map_valley.jpg,
2048 x 2048, north up, 4 m a pixel): the ground's own colours from the splat maps under a hill shade, the sea by depth
with a light rim at the coast, lakes and rivers, roads and bridges, town streets, every building, the runways, the
port's quay and piers. Names and markers are drawn by the game over it.
usage: python3 mapimg.py <build_dir> <project_dir>"""
import json
import math
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

B, PROJ = sys.argv[1], sys.argv[2]
lay = json.load(open(B + '/layout.json'))
N, HALF = lay['n'], lay['half']
S = 2048
PX = 2 * HALF / S                    # metres a pixel
H = np.fromfile(B + '/base_h.f32', '<f4').reshape(N, N)
Hs = np.asarray(Image.fromarray(H).resize((S, S), Image.BILINEAR)).astype(np.float32)
sa = np.asarray(Image.open(B + '/splat_base_a.png').convert('RGBA').resize((S, S), Image.BILINEAR)).astype(np.float32) / 255
sb = np.asarray(Image.open(B + '/splat_base_b.png').convert('RGBA').resize((S, S), Image.BILINEAR)).astype(np.float32) / 255
W = np.concatenate([sa, sb], -1)
# the terrain atlas's eight layers, averaged, a little livelier for a map
atlas = Image.open(PROJ + '/textures/v8/terrain_albedo.jpg').convert('RGB')
aw = atlas.width
cols = []
for k in range(8):
    c = np.asarray(atlas.crop((0, k * aw, aw, (k + 1) * aw)).resize((1, 1), Image.LANCZOS)).reshape(3).astype(np.float32)
    g = c.mean()
    cols.append(np.clip(g + (c - g) * 1.35, 0, 255) * 1.25)
cols = np.array(cols)
col = np.einsum('ijk,kc->ijc', W, cols) / np.maximum(W.sum(-1, keepdims=True), 1e-4)
# hill shade, light from the north-west
gz, gx = np.gradient(Hs, PX)
nrm = np.dstack([-gx, np.ones_like(Hs) * 1.0, -gz])
nrm /= np.linalg.norm(nrm, axis=2, keepdims=True)
L = np.array([-0.55, 0.62, -0.55])
L /= np.linalg.norm(L)
shade = np.clip(0.55 + 0.75 * (nrm @ L), 0.35, 1.35)
col *= shade[..., None]
col *= (0.92 + 0.12 * np.clip(Hs / 300.0, 0, 1))[..., None]
# snow on the highest tops
col = np.where((Hs > 330)[..., None], col * 0.4 + np.array([235, 238, 240]) * 0.6, col)
# the sea: deeper, darker; a pale rim along the coast
sea = Hs < 0.0
depth = np.clip(-Hs / 14.0, 0, 1)
seac = np.array([38, 118, 150])[None, None] * (1 - depth[..., None]) + np.array([14, 48, 86])[None, None] * depth[..., None]
coast = ndimage.binary_dilation(~sea, iterations=2) & sea
col = np.where(sea[..., None], seac, col)
col = np.where(coast[..., None], col * 0.4 + np.array([150, 200, 210]) * 0.6, col)
GX, GZ = np.meshgrid(np.linspace(-HALF, HALF, S), np.linspace(-HALF, HALF, S))
for lk in lay['lakes']:
    d = np.hypot(GX - lk['x'], GZ - lk['z'])
    m = (d < lk['r'] * 1.5) & (Hs < lk['level'])
    col = np.where(m[..., None], np.array([34, 100, 132]), col)
img = Image.fromarray(np.clip(col, 0, 255).astype(np.uint8))
d = ImageDraw.Draw(img)


def P(x, z):
    return ((x + HALF) / PX, (z + HALF) / PX)


for rv in lay.get('rivers', []):
    pts = [P(p[0], p[1]) for p in rv['pts']]
    d.line(pts, fill=(36, 102, 134), width=max(3, int(rv['w'] / PX + 0.5)), joint='curve')
for st in lay.get('streets', []):
    d.line([P(*p) for p in st['pts']], fill=(118, 116, 108), width=2)
for rd in lay.get('roads', []):
    pts = [P(*p) for p in rd['pts']]
    d.line(pts, fill=(64, 60, 54), width=5, joint='curve')
    d.line(pts, fill=(214, 206, 186) if rd['kind'] == 'asphalt' else (176, 150, 112), width=3, joint='curve')
for br in lay.get('bridges', []):
    d.line([P(br[0], br[1]), P(br[2], br[3])], fill=(236, 232, 220), width=4)
for ap in lay.get('airports', [lay.get('airport')]):
    if not ap:
        continue
    L_, wd = ap['len'], ap['wid']
    sc = L_ / 2400.0
    x0, z0 = P(ap['x'] - L_ / 2, ap['z'] - wd / 2)
    x1, z1 = P(ap['x'] + L_ / 2, ap['z'] + wd / 2)
    d.rectangle([x0, z0, x1, z1], fill=(92, 94, 96))
    d.line([P(ap['x'] - L_ / 2 + 40, ap['z']), P(ap['x'] + L_ / 2 - 40, ap['z'])], fill=(230, 230, 230), width=1)
    d.rectangle([*P(ap['x'] - 1150 * sc, ap['z'] - 142), *P(ap['x'] + 1150 * sc, ap['z'] - 118)], fill=(104, 106, 108))
    d.rectangle([*P(ap['x'] - 1200 * sc, ap['z'] - 325), *P(ap['x'] + 600 * sc, ap['z'] - 175)], fill=(112, 112, 114))
pt = lay.get('port')
if pt:
    d.rectangle([*P(pt['x'] - 40, pt['z'] - 570), *P(pt['x'] + 260, pt['z'] + 90)], fill=(150, 148, 142))
    for pz in pt['piers']:
        d.rectangle([*P(pt['x'] - 60 - pt['pier_len'], pt['z'] + pz + 2), *P(pt['x'] - 35, pt['z'] + pz + 38)], fill=(170, 168, 160))
PREF = json.load(open(PROJ + '/data/valley/prefabs.json'))
for b in lay['buildings']:
    t, x, y, z, yaw = b[0], b[1], b[2], b[3], b[4]
    dims = PREF.get(t, {'w': 10, 'd': 10})
    hw, hd = dims['w'] / 2, dims['d'] / 2
    c, s_ = math.cos(yaw), math.sin(yaw)
    poly = [P(x + ux * c + uz * s_, z - ux * s_ + uz * c) for ux, uz in ((-hw, -hd), (hw, -hd), (hw, hd), (-hw, hd))]
    d.polygon(poly, fill=(86, 84, 82) if t not in ('hangar', 'terminal') else (128, 128, 132), outline=(52, 50, 48))
img = img.filter(ImageFilter.UnsharpMask(radius=1.2, percent=60, threshold=2))
img.save(PROJ + '/textures/ui/map_valley.jpg', quality=88)
print('map picture', img.size)
