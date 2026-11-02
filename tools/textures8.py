"""Textures for the 8 x 8 km valley map and its buildings.
- terrain array from the browser game's ground strips (assets/tex: grass, lush, dry, forest, needles, soil, cracked, sand,
  rock, gravel, snow, mud), toned for the shared terrain shader, packed normal/roughness/height maps;
- trees: bark and leaf layers and ground sprites (grass, flowers, fern, ivy...) from assets/veg;
- buildings: plaster, interior plaster, brick, concrete, clay roof tiles, corrugated metal, floor tiles, asphalt, carrier deck,
  painted metal, a computer screen.
usage: python3 textures8.py <game_assets_dir> <project_dir>"""
import math
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, os.path.dirname(__file__))
from texlib import normal_from_height, tileable  # noqa: E402

SRC, PROJ = sys.argv[1], sys.argv[2]
TV = PROJ + '/textures/v8'
TB = PROJ + '/textures/b'
os.makedirs(TV, exist_ok=True)
os.makedirs(TB, exist_ok=True)


def strip_layer(path, n, i, size=None, mode='RGB'):
    im = Image.open(path).convert(mode)
    w, h = im.size
    lh = h // n
    tile = im.crop((0, i * lh, w, (i + 1) * lh))
    if size and tile.size[0] != size:
        tile = tile.resize((size, size), Image.LANCZOS)
    return np.asarray(tile).astype(np.float64) / 255.0


def save_rgb(a, path, q=90):
    im = Image.fromarray(np.clip(a * 255 + 0.5, 0, 255).astype(np.uint8))
    if path.endswith('.jpg'):
        im.save(path, quality=q, optimize=True)
    else:
        im.save(path, optimize=True)


def save_rgba(a, path):
    Image.fromarray(np.clip(a * 255 + 0.5, 0, 255).astype(np.uint8), 'RGBA').save(path, optimize=True)


def pnoise(W, H, fx, fy, seed, order=3):
    g = np.random.RandomState(seed).rand(fy, fx)
    gg = np.tile(g, (3, 3))
    z = ndimage.zoom(gg, (H / fy, W / fx), order=order)
    return z[H:2 * H, W:2 * W]


def fbm(W, H, fx, fy, seed, oct=5, gain=0.5):
    out = np.zeros((H, W))
    a, tot = 1.0, 0.0
    for o in range(oct):
        out += a * pnoise(W, H, fx * 2 ** o, fy * 2 ** o, seed + o * 17)
        tot += a
        a *= gain
    out /= tot
    return (out - out.min()) / (out.max() - out.min() + 1e-9)


def nrh(height, rough, strength=2.0):
    n = normal_from_height(height, strength)
    rough = np.broadcast_to(np.asarray(rough, np.float64), height.shape)
    return np.dstack([n[..., 0], n[..., 1], np.clip(rough, 0, 1), np.clip(height, 0, 1)])


def lum(a):
    return a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114


def tone(a, target, sat=1.0, tint=(1, 1, 1)):
    l = lum(a)
    a = a * (target / max(l.mean(), 1e-4))
    l2 = lum(a)[..., None]
    a = l2 + (a - l2) * sat
    return np.clip(a * np.asarray(tint), 0, 1)


def blur(a, s):
    return ndimage.gaussian_filter(a, s, mode='wrap')


def norm01(a):
    return (a - a.min()) / (a.max() - a.min() + 1e-9)


# ------------------------------------------------------------------ terrain array (8 layers)
print('terrain', flush=True)
TL = ['grass', 'lush', 'dry', 'forest', 'needles', 'soil', 'cracked', 'sand', 'rock', 'gravel', 'snow', 'mud']
ALB = SRC + '/tex/ter_albedo_1024.jpg'
NRM = SRC + '/tex/ter_normal_512.jpg'
# valley layer: (source layer, target luminance, saturation, roughness, normal strength)
V8 = [('grass', 0.30, 0.95, 0.92), ('lush', 0.27, 1.0, 0.9), ('forest', 0.24, 0.95, 0.92), ('soil', 0.26, 0.9, 0.9),
      ('mud', 0.17, 0.85, 0.55), ('sand', 0.44, 0.85, 0.93), ('rock', 0.36, 0.8, 0.78), ('gravel', 0.34, 0.75, 0.88)]
alb_l, nrh_l = [], []
for name, tl, sat, rough in V8:
    i = TL.index(name)
    a = tone(strip_layer(ALB, 12, i, 1024), tl, sat)
    nm = strip_layer(NRM, 12, i, 512)
    h = blur(lum(np.asarray(Image.fromarray((a * 255).astype(np.uint8)).resize((512, 512), Image.LANCZOS)) / 255.0), 1.0)
    h = norm01(h)
    alb_l.append(a)
    nrh_l.append(np.dstack([nm[..., 0], nm[..., 1], np.full((512, 512), rough), h]))
save_rgb(np.concatenate(alb_l, 0), TV + '/terrain_albedo.jpg', 92)
save_rgba(np.concatenate(nrh_l, 0), TV + '/terrain_nrh.png')

# ------------------------------------------------------------------ trees and ground sprites
print('veg', flush=True)
BARK = ['oak', 'ash', 'pine', 'birch', 'cedar', 'moss', 'olive', 'dead', 'palm', 'plane']
LEAF = ['oak', 'ash', 'aspen', 'pine', 'palm', 'plane', 'planetwig']
GROUND = ['grass', 'grass_tall', 'grass_dry', 'flowers', 'fern', 'reeds', 'wheat', 'barley', 'greens', 'tomato', 'cotton',
          'sunflower', 'corn', 'shrub', 'tundra', 'beachgrass', 'poppy', 'lavender', 'daisy', 'buttercup', 'blades', 'blades2',
          'tuft', 'ivy']
for i, n in enumerate(BARK):
    if n in ('olive', 'palm'):
        continue
    a = strip_layer(SRC + '/veg/bark_albedo_v2.jpg', len(BARK), i, 512)
    nm = strip_layer(SRC + '/veg/bark_normal_v2.jpg', len(BARK), i, 512)
    save_rgb(a, TV + '/bark_%s.jpg' % n, 90)
    h = norm01(blur(lum(a), 0.8))
    save_rgba(np.dstack([nm[..., 0], nm[..., 1], np.full((512, 512), 0.9), h]), TV + '/bark_%s_nrh.png' % n)
for i, n in enumerate(LEAF):
    if n in ('palm', 'planetwig'):
        continue
    a = strip_layer(SRC + '/veg/leaves_v3.webp', len(LEAF), i, 512, 'RGBA')
    save_rgba(a, TV + '/leaf_%s.png' % n)
KEEP = ['grass', 'grass_tall', 'flowers', 'fern', 'poppy', 'daisy', 'blades', 'tuft', 'ivy', 'shrub', 'buttercup', 'reeds']
cols = [strip_layer(SRC + '/veg/ground_v4.webp', len(GROUND), GROUND.index(n), 256, 'RGBA') for n in KEEP]
save_rgba(np.concatenate(cols, 0), TV + '/ground_strip.png')
print('ground layers', KEEP)

# ------------------------------------------------------------------ building materials
print('buildings', flush=True)
S = 512


def stains(seed, amt=0.25):
    n = fbm(S, S, 3, 3, seed, 5)
    return 1.0 - amt * np.clip((n - 0.45) * 2.2, 0, 1)


def cracks(seed, n=14, length=120):
    rs = np.random.RandomState(seed)
    c = np.zeros((S, S))
    for _ in range(n):
        x, y = rs.uniform(0, S, 2)
        ang = rs.uniform(0, math.tau)
        for _k in range(length):
            ang += rs.normal(0, 0.35)
            x = (x + math.cos(ang)) % S
            y = (y + math.sin(ang)) % S
            c[int(y), int(x)] = 1.0
    return np.clip(blur(c, 0.6) * 3.0, 0, 1)


# plaster: rough lime render, blotches, hairline cracks (white-ish; tinted per house in the shader)
g = fbm(S, S, 32, 32, 3, 4) * 0.5 + fbm(S, S, 6, 6, 4, 4) * 0.5
cr = cracks(5)
a = np.dstack([0.83 + 0.08 * g, 0.81 + 0.08 * g, 0.77 + 0.08 * g]) * stains(7, 0.18)[..., None]
a *= (1.0 - 0.45 * cr)[..., None]
save_rgb(a, TB + '/plaster.jpg')
save_rgba(nrh(g * 0.6 - cr * 0.4 + 0.4, 0.93, 2.2), TB + '/plaster_nrh.png')
# interior plaster: smoother, faint vertical wallpaper stripes, water stains
st = 0.5 + 0.5 * np.sin(np.arange(S)[None, :] / S * math.tau * 16)
a = np.dstack([0.78 + 0.03 * st, 0.75 + 0.03 * st, 0.68 + 0.02 * st]) * np.ones((S, 1, 1)) * stains(11, 0.3)[..., None]
a *= (0.96 + 0.04 * fbm(S, S, 24, 24, 12, 3))[..., None]
save_rgb(a, TB + '/plaster_in.jpg')
save_rgba(nrh(fbm(S, S, 40, 40, 13, 3) * 0.3 + 0.5, 0.95, 0.8), TB + '/plaster_in_nrh.png')
# brick: running bond, 8 courses x 4 bricks per tile (tile = 2 m x 0.52 m -> uv scaled in the shader)
y, x = np.mgrid[0:S, 0:S].astype(np.float64)
rows = 8
bh = S / rows
r = (y // bh).astype(int)
bw = S / 4
xo = (x + (r % 2) * bw * 0.5) % S
mortar = ((y % bh) < 4) | ((xo % bw) < 4)
rs = np.random.RandomState(21)
tone_b = rs.uniform(0.75, 1.15, (rows, 8))
bt = tone_b[r % rows, (xo // bw).astype(int) % 8]
base = np.dstack([0.55 * bt, 0.27 * bt, 0.2 * bt]) * (0.85 + 0.3 * fbm(S, S, 48, 48, 22, 3))[..., None]
a = np.where(mortar[..., None], np.array([0.55, 0.53, 0.5]) * (0.8 + 0.2 * fbm(S, S, 30, 30, 23, 3))[..., None], base)
a *= stains(24, 0.22)[..., None]
h = np.where(mortar, 0.15, 0.75 + 0.2 * fbm(S, S, 40, 40, 25, 3))
save_rgb(a, TB + '/brick.jpg')
save_rgba(nrh(blur(h, 0.7), np.where(mortar, 0.95, 0.85), 3.0), TB + '/brick_nrh.png')
# concrete: board-formed lines, pores, rust run-off
pores = (np.random.RandomState(31).rand(S, S) > 0.997).astype(float)
h = 0.6 + 0.15 * fbm(S, S, 20, 20, 32, 4) - 0.4 * blur(pores, 0.8) * 8 - 0.12 * ((y % (S / 4)) < 2)
v = 0.48 + 0.1 * fbm(S, S, 8, 8, 33, 4)
a = np.dstack([v, v * 0.98, v * 0.95]) * stains(34, 0.3)[..., None]
run = blur((np.random.RandomState(35).rand(1, S) > 0.985).astype(float), (0, 1.5)) * np.linspace(1, 0.2, S)[:, None]
a *= (1.0 - 0.25 * np.clip(run * 4, 0, 1))[..., None]
a[..., 0] += 0.05 * np.clip(run * 4, 0, 1)
save_rgb(a, TB + '/concrete.jpg')
save_rgba(nrh(np.clip(h, 0, 1), 0.9, 2.0), TB + '/concrete_nrh.png')
# clay roof tiles: rows of curved tiles (tile = 2 m wide, 1 m along the slope per texture repeat x 4 rows)
tr = 4
ty = (y % (S / tr)) / (S / tr)
tx = (x % (S / 8)) / (S / 8)
curve = np.sin(tx * math.pi) ** 0.6
lap = np.clip(ty * 1.3, 0, 1)
h = curve * 0.6 + lap * 0.4
rt = np.random.RandomState(41).uniform(0.8, 1.15, (tr, 8))[(y // (S / tr)).astype(int) % tr, (x // (S / 8)).astype(int) % 8]
a = np.dstack([0.55 * rt, 0.28 * rt, 0.18 * rt]) * (0.7 + 0.3 * h)[..., None] * stains(42, 0.35)[..., None]
moss = np.clip((fbm(S, S, 5, 5, 43, 4) - 0.6) * 3, 0, 1) * (1 - lap)
a = a * (1 - moss[..., None] * 0.6) + np.array([0.18, 0.22, 0.1]) * moss[..., None] * 0.6
save_rgb(a, TB + '/roof_tiles.jpg')
save_rgba(nrh(h, 0.8, 3.0), TB + '/roof_tiles_nrh.png')
# corrugated metal, rusty
cor = 0.5 + 0.5 * np.sin(x / S * math.tau * 24)
rust = np.clip((fbm(S, S, 6, 6, 51, 5) - 0.42) * 2.5, 0, 1)
a = np.dstack([0.45 + 0.05 * cor, 0.47 + 0.05 * cor, 0.48 + 0.05 * cor]) * (1 - rust[..., None]) + \
    np.dstack([0.42, 0.22, 0.1]) * (0.7 + 0.3 * fbm(S, S, 30, 30, 52, 3))[..., None] * rust[..., None]
save_rgb(a, TB + '/roof_metal.jpg')
save_rgba(nrh(cor * 0.8 + rust * 0.1, 0.5 + 0.4 * rust, 2.5), TB + '/roof_metal_nrh.png')
# floor tiles 0.3 m (texture = 1.2 m -> 4 x 4 tiles), dust and broken corners
tl = (S / 4)
grout = ((x % tl) < 3) | ((y % tl) < 3)
tt = np.random.RandomState(61).uniform(0.85, 1.1, (4, 4))[(y // tl).astype(int) % 4, (x // tl).astype(int) % 4]
check = (((x // tl) + (y // tl)) % 2).astype(float)
a = np.dstack([0.62 - 0.2 * check, 0.6 - 0.2 * check, 0.56 - 0.18 * check]) * tt[..., None]
a = np.where(grout[..., None], np.array([0.35, 0.33, 0.3]), a) * stains(62, 0.3)[..., None]
save_rgb(a, TB + '/floor_tiles.jpg')
save_rgba(nrh(np.where(grout, 0.2, 0.7), np.where(grout, 0.9, 0.35), 2.0), TB + '/floor_tiles_nrh.png')
# asphalt: aggregate, cracks, patches
agg = np.random.RandomState(71).rand(S, S)
v = 0.17 + 0.06 * blur(agg, 0.6) + 0.04 * fbm(S, S, 10, 10, 72, 4)
cr = cracks(73, 10, 200)
patch = (fbm(S, S, 3, 3, 74, 3) > 0.7).astype(float)
v = v * (1 - 0.5 * cr) - 0.03 * patch
save_rgb(np.dstack([v, v, v * 1.03]), TB + '/asphalt.jpg')
save_rgba(nrh(0.6 + 0.3 * blur(agg, 0.6) - 0.5 * cr, 0.88, 1.6), TB + '/asphalt_nrh.png')
# carrier deck: dark grey non-skid with weathered patches
v = 0.2 + 0.05 * blur(np.random.RandomState(81).rand(S, S), 0.7) + 0.05 * fbm(S, S, 4, 4, 82, 4)
save_rgb(np.dstack([v, v * 1.01, v * 1.04]), TB + '/deck.jpg')
save_rgba(nrh(0.5 + 0.4 * blur(np.random.RandomState(83).rand(S, S), 0.5), 0.92, 1.4), TB + '/deck_nrh.png')
# painted metal (hangars, carrier island, tanks get their own tint in the shader)
v = 0.62 + 0.05 * fbm(S, S, 8, 8, 91, 4)
sc = blur((np.random.RandomState(92).rand(S, S) > 0.998).astype(float), (0.5, 6)) * 6
a = np.dstack([v, v, v]) * (1 - 0.3 * np.clip(sc, 0, 1))[..., None] * stains(93, 0.25)[..., None]
save_rgb(a, TB + '/paint.jpg')
save_rgba(nrh(0.6 - 0.3 * np.clip(sc, 0, 1), 0.55, 1.0), TB + '/paint_nrh.png')
# computer screen: dark green terminal text
scr = np.zeros((256, 256, 3))
rs = np.random.RandomState(99)
for row in range(18):
    n = rs.randint(6, 28)
    scr[12 + row * 13:20 + row * 13, 12:12 + n * 8] = [0.1, 0.9, 0.35]
scr *= (rs.rand(256, 256, 1) > 0.25)
scr += np.array([0.0, 0.06, 0.03])
save_rgb(blur(scr, (0.6, 0.6, 0)), TB + '/screen.png')
print('done')
