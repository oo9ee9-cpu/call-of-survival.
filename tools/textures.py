#!/usr/bin/env python3
"""Call of Survival: Front - texture builder.
Terrain layers come from the game's texture strips (ambientCG CC0, Babylon.js Assets CC-BY 4.0, ez-tree MIT);
everything else (wood, burlap, metal, cloth, cards, particles, sky, noise) is procedural.
Packed "nrh" textures: R,G = tangent normal (OpenGL), B = roughness, A = height (also used as AO).
usage: python3 textures.py <game_assets_dir> <project_dir>
"""
import sys, os, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from texlib import tileable, normal_from_height, height_from_albedo, lum, match_tone, fbm_tile

SRC, PROJ = sys.argv[1], sys.argv[2]
T = PROJ + '/textures'
for d in ('terrain', 'veg', 'props', 'fx', 'sky', 'weapons', 'ui'): os.makedirs(T + '/' + d, exist_ok=True)
RS = np.random.RandomState(4242)

def layer(path, size, i, out=None):
    im = Image.open(path).convert('RGB'); s = im.size[0]
    im = im.crop((0, i * s, s, (i + 1) * s))
    if out and out != s: im = im.resize((out, out), Image.LANCZOS)
    return np.asarray(im).astype(np.float64) / 255.0
def save_rgb(a, path, q=90):
    im = Image.fromarray(np.clip(a * 255 + 0.5, 0, 255).astype(np.uint8))
    if path.endswith('.jpg'): im.save(path, quality=q, optimize=True)
    else: im.save(path, optimize=True)
def save_rgba(a, path):
    Image.fromarray(np.clip(a * 255 + 0.5, 0, 255).astype(np.uint8), 'RGBA').save(path, optimize=True)
def pnoise(W, H, fx, fy, seed, order=3):
    """periodic value noise, fx x fy cells over W x H"""
    g = np.random.RandomState(seed).rand(fy, fx)
    gg = np.tile(g, (3, 3)); z = ndimage.zoom(gg, (H / fy, W / fx), order=order)
    return z[H:2 * H, W:2 * W]
def fbm(W, H, fx, fy, seed, oct=5, gain=0.5):
    out = np.zeros((H, W)); a = 1.0; tot = 0
    for o in range(oct):
        out += a * pnoise(W, H, fx * 2 ** o, fy * 2 ** o, seed + o * 17); tot += a; a *= gain
    out /= tot; return (out - out.min()) / (out.max() - out.min() + 1e-9)
def nrh(height, rough, strength=2.0):
    n = normal_from_height(height, strength); rough = np.broadcast_to(np.asarray(rough, np.float64), height.shape)
    return np.dstack([n[..., 0], n[..., 1], np.clip(rough, 0, 1), np.clip(height, 0, 1)])
def blur(a, s): return ndimage.gaussian_filter(a, s, mode='wrap')
def norm01(a): return (a - a.min()) / (a.max() - a.min() + 1e-9)

TEX = SRC + '/tex'
# ------------------------------------------------------------------ terrain arrays
print('terrain layers', flush=True)
S = 1024; SN = 512
alb_layers, nrh_layers = [], []
def add_layer(alb, hgt, rough, nstr=2.0, ext_n=None):
    alb_layers.append(np.clip(alb, 0, 1))
    rough = np.broadcast_to(np.asarray(rough, np.float64), hgt.shape)
    h = Image.fromarray((np.clip(hgt, 0, 1) * 255).astype(np.uint8)).resize((SN, SN), Image.LANCZOS)
    h = np.asarray(h).astype(np.float64) / 255
    r = Image.fromarray((np.clip(rough, 0, 1) * 255).astype(np.uint8)).resize((SN, SN), Image.LANCZOS)
    r = np.asarray(r).astype(np.float64) / 255
    n = normal_from_height(h, nstr)
    if ext_n is not None:   # blend with the source normal map (detail), renormalise
        e = ext_n * 2 - 1; m = n * 2 - 1
        v = np.dstack([m[..., 0] + e[..., 0] * 0.8, m[..., 1] + e[..., 1] * 0.8, m[..., 2] * e[..., 2]])
        v /= np.linalg.norm(v, axis=2, keepdims=True); n = v * 0.5 + 0.5
    nrh_layers.append(np.dstack([n[..., 0], n[..., 1], r, h]))
ALB = TEX + '/ter_albedo_1024.jpg'; NRM = TEX + '/ter_normal_512.jpg'
def src(i): return layer(ALB, 1024, i), layer(NRM, 512, i)
fine = fbm(S, S, 8, 8, 3)
# 0 needles (forest floor)
a, n = src(4); a = match_tone(a, 0.27, 0.4, (1.1, 0.98, 0.84)); h = height_from_albedo(a, 1.0, 0.8)
add_layer(a, h, 0.82 + 0.1 * fine, 1.8, n)
# 1 litter: leaves and twigs, burnt brown
a, n = src(3); a = match_tone(a, 0.27, 0.3, (1.12, 0.97, 0.84)); h = height_from_albedo(a, 1.0, 0.8)
add_layer(a, h, 0.86 + 0.08 * fine, 2.0, n)
# 2 dry grass
a, n = src(2); a = match_tone(a, 0.36, 0.6, (1.02, 0.97, 0.86)); h = height_from_albedo(a, 1.0, 0.8)
add_layer(a, h, 0.9, 1.6, n)
# 3 soil
a, n = src(5); a = match_tone(a, 0.24, 0.8, (1.05, 0.98, 0.9)); h = height_from_albedo(a, 1.4, 0.7)
add_layer(a, h, 0.86 - 0.12 * fine, 1.8, n)
# 4 mud: dark and wet, puddle-like smooth patches
a, n = src(11); wetp = fbm(S, S, 6, 6, 9)
a = match_tone(a, 0.16, 0.85, (1.06, 0.98, 0.9)) * (0.85 + 0.25 * fine[..., None])
h = norm01(height_from_albedo(a, 2.0, 0.6) * 0.6 + blur(fine, 6) * 0.4) * 0.6
smooth = norm01(blur(wetp, 3))
add_layer(a, h, np.clip(0.4 + 0.45 * smooth, 0.3, 0.9), 1.3, n)
# 5 ash: grey ash over dark soil with charcoal bits
a, n = src(5); base = match_tone(a, 0.17, 0.3)
ash = fbm(S, S, 10, 10, 31, 5, 0.6); ashm = np.clip((ash - 0.5) * 2.2, 0, 1)
grey = np.dstack([0.37 + 0.1 * fine, 0.36 + 0.1 * fine, 0.35 + 0.09 * fine])
a = base * (1 - ashm[..., None] * 0.85) + grey * ashm[..., None] * 0.85
im = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)); dr = ImageDraw.Draw(im)
hgt = Image.new('L', (S, S), 128); dh = ImageDraw.Draw(hgt)
for k in range(1500):       # charcoal sticks and lumps
    x, y = RS.randint(0, S), RS.randint(0, S); L = RS.randint(4, 40); ang = RS.uniform(0, 6.28); w = RS.randint(2, 7)
    x2, y2 = x + L * math.cos(ang), y + L * math.sin(ang); c = int(RS.uniform(8, 30))
    for ox in (-S, 0, S):
        for oy in (-S, 0, S):
            dr.line((x + ox, y + oy, x2 + ox, y2 + oy), fill=(c, c, c - 2), width=w); dh.line((x + ox, y + oy, x2 + ox, y2 + oy), fill=200, width=w)
a = np.asarray(im).astype(np.float64) / 255; hh = np.asarray(hgt.filter(ImageFilter.GaussianBlur(1.2))).astype(np.float64) / 255
h = norm01(hh * 0.6 + height_from_albedo(a, 1.0, 0.5) * 0.4)
add_layer(a, h, 0.93, 2.2, n)
# 6 clay walls (used on steep trench walls, triplanar): orange-brown clay with spade marks and layers
a6 = layer(ALB, 1024, 6); a5 = layer(ALB, 1024, 5)
v = np.linspace(0, 1, S)[:, None] * np.ones((1, S))
bands = pnoise(S, S, 1, 14, 51) * 0.6 + pnoise(S, S, 2, 40, 52) * 0.4
spade = np.zeros((S, S))
for k in range(120):    # spade cuts: short vertical strokes
    x, y = RS.randint(0, S), RS.randint(0, S); w = RS.randint(18, 45); hgt_ = RS.randint(60, 160)
    yy, xx = np.mgrid[0:S, 0:S]
    dx = ((xx - x + S // 2) % S) - S // 2; dy = ((yy - y + S // 2) % S) - S // 2
    m = (np.abs(dx) < w) & (np.abs(dy) < hgt_); spade[m] += (1 - np.abs(dx[m] / w)) * 0.5
spade = blur(spade, 2)
clay = 0.55 * a5 + 0.45 * a6
clay = match_tone(clay, 0.3, 0.55, (1.1, 0.98, 0.84)) * (0.8 + 0.3 * bands[..., None])
h = norm01(0.5 * height_from_albedo(clay, 1.0, 0.7) + 0.3 * spade + 0.2 * bands)
roots = Image.new('L', (S, S), 0); dr = ImageDraw.Draw(roots)
for k in range(28):         # thin roots hanging out of the wall
    x, y = RS.randint(0, S), RS.randint(0, S); pts = [(x, y)]
    for s in range(RS.randint(6, 18)):
        x += RS.uniform(-6, 6); y += RS.uniform(4, 14); pts.append((x, y))
    dr.line(pts, fill=255, width=RS.randint(2, 5))
rt = np.asarray(roots.filter(ImageFilter.GaussianBlur(0.8))).astype(np.float64) / 255
clay = clay * (1 - rt[..., None] * 0.7) + np.array([0.2, 0.15, 0.1]) * rt[..., None] * 0.7
add_layer(tileable(clay, 0.15), tileable(norm01(h + rt * 0.4), 0.15), 0.8, 2.4)
# 7 gravel / road: stones with mud between
a, n = src(9); a = match_tone(a, 0.32, 0.5); h = height_from_albedo(a, 1.0, 1.0)
mud = match_tone(layer(ALB, 1024, 11), 0.15, 0.8)
low = np.clip((0.45 - h) * 4, 0, 1)[..., None]
a = a * (1 - low) + mud * low
add_layer(a, h, 0.7 + 0.2 * h, 2.2, n)
strip = np.concatenate(alb_layers, 0); save_rgb(strip, T + '/terrain/terrain_albedo.jpg', 92)
strip = np.concatenate(nrh_layers, 0); save_rgba(strip, T + '/terrain/terrain_nrh.png')

# ------------------------------------------------------------------ shared noise + sky
print('noise, sky', flush=True)
N = 512
noise = np.dstack([fbm(N, N, 4, 4, 61), fbm(N, N, 16, 16, 62, 4), fbm(N, N, 2, 2, 63, 6), norm01(blur(RS.rand(N, N), 1.0))])
save_rgba(noise, T + '/fx/noise.png')
C = 1024
cl = fbm(C, C, 3, 3, 71, 7, 0.55); cl2 = fbm(C, C, 6, 6, 72, 6, 0.5)
clouds = norm01(cl * 0.7 + cl2 * 0.3)
sky = np.dstack([clouds, norm01(blur(clouds, 6) - blur(clouds, 1) * 0.5), fbm(C, C, 8, 8, 73, 5)])
save_rgb(sky, T + '/sky/clouds.png')

# ------------------------------------------------------------------ bark
print('bark', flush=True)
BK = SRC + '/veg/bark_albedo.jpg'; BKN = SRC + '/veg/bark_normal.jpg'
def bark_tile(i, tone, sat, tint):
    a = layer(BK, 512, i); a = match_tone(a, tone, sat, tint)
    a2 = np.concatenate([a, np.flipud(a)], 0)           # 512 x 1024 (1 m around, 2 m tall)
    return tileable(a2, 0.1)
bk = bark_tile(0, 0.23, 0.65, (1.05, 0.95, 0.85)); h = height_from_albedo(bk, 1.0, 1.0)
save_rgb(bk, T + '/veg/bark_pine.jpg'); save_rgba(nrh(h, 0.85 + 0.1 * (1 - h), 2.6), T + '/veg/bark_pine_nrh.png')
bw = bark_tile(7, 0.4, 0.3, (1.0, 0.97, 0.92)); h = height_from_albedo(bw, 0.8, 1.2)
# weathered wood: add long cracks
cr = Image.new('L', (512, 1024), 0); dr = ImageDraw.Draw(cr)
for k in range(30):
    x = RS.randint(0, 512); y = RS.randint(0, 1024); pts = [(x, y)]
    for s in range(12): x += RS.uniform(-3, 3); y += RS.uniform(20, 50); pts.append((x, y))
    dr.line(pts, fill=255, width=RS.randint(1, 4))
c = np.asarray(cr.filter(ImageFilter.GaussianBlur(0.7))).astype(np.float64) / 255
bw = bw * (1 - 0.6 * c[..., None]); h = norm01(h - 0.5 * c)
save_rgb(bw, T + '/veg/wood_bare.jpg'); save_rgba(nrh(h, 0.8, 2.2), T + '/veg/wood_bare_nrh.png')

# ------------------------------------------------------------------ cards (alpha): twigs, needles, grass, litter, wire
print('cards', flush=True)
def card(size=512, ss=2):
    im = Image.new('RGBA', (size * ss, size * ss), (0, 0, 0, 0)); return im, ImageDraw.Draw(im), ss
def finish(im, size, path):
    im = im.convert('RGBa').resize((size, size), Image.LANCZOS).convert('RGBA')
    a = np.asarray(im).astype(np.float64) / 255
    rgb, al = a[..., :3], a[..., 3]
    # bleed colour into transparent texels so mipmaps do not get dark halos
    w = ndimage.gaussian_filter(al, 5) + 1e-6
    fill = np.dstack([ndimage.gaussian_filter(rgb[..., i] * al, 5) / w for i in range(3)])
    mean = (rgb * al[..., None]).sum((0, 1)) / max(1e-6, al.sum())
    fill = np.where((w > 1e-3)[..., None], fill, mean)
    out_rgb = np.where((al > 0.01)[..., None], rgb, fill)
    save_rgba(np.dstack([np.clip(out_rgb, 0, 1), al]), path)
def branch(dr, x, y, ang, L, w, depth, col, ss, rs, twigs=True):
    pts = [(x, y)]; cx, cy, a = x, y, ang
    segs = 6
    for s in range(segs):
        a += rs.uniform(-0.18, 0.18); cx += math.cos(a) * L / segs; cy += math.sin(a) * L / segs; pts.append((cx, cy))
    for i in range(len(pts) - 1):
        ww = max(1, int(w * (1 - i / len(pts)) * ss))
        dr.line([pts[i], pts[i + 1]], fill=col, width=ww)
    if depth > 0:
        for k in range(rs.randint(2, 5)):
            i = rs.randint(1, len(pts) - 1); px, py = pts[i]
            branch(dr, px, py, a + rs.choice([-1, 1]) * rs.uniform(0.4, 1.0), L * rs.uniform(0.35, 0.6), w * 0.6, depth - 1, col, ss, rs)
# dead twig card (branch seen from the side, base at the left edge centre)
im, dr, ss = card()
for k in range(3):
    c = tuple(int(v) for v in RS.uniform(40, 70, 3)) + (255,)
    branch(dr, 0, 512 * ss / 2 + RS.uniform(-40, 40) * ss, RS.uniform(-0.2, 0.2), 480 * ss, 9, 3, c, ss, RS)
finish(im, 512, T + '/veg/twigs.png')
# needle clumps: burnt (rusty brown / dark olive) and live (dark green)
def needles(path, cols, density, seed):
    rs = np.random.RandomState(seed); im, dr, ss = card(); S2 = 512 * ss
    branch(dr, 0, S2 / 2, 0.0, S2 * 0.95, 7, 1, (55, 42, 32, 255), ss, rs)
    for k in range(density):
        t = rs.uniform(0.05, 0.98); x = t * S2 * 0.95; y = S2 / 2 + rs.normal(0, 1) * S2 * 0.12 * (0.4 + t)
        for j in range(rs.randint(8, 18)):
            a = rs.uniform(0, 6.28); L = rs.uniform(18, 42) * ss
            c = cols[rs.randint(len(cols))]; c = tuple(int(np.clip(v * rs.uniform(0.75, 1.2), 0, 255)) for v in c) + (255,)
            dr.line((x, y, x + math.cos(a) * L, y + math.sin(a) * L), fill=c, width=max(1, int(1.6 * ss)))
    finish(im, 512, path)
needles(T + '/veg/needles_burnt.png', [(92, 62, 34), (70, 52, 30), (58, 60, 38), (110, 75, 40)], 70, 81)
needles(T + '/veg/needles_live.png', [(38, 56, 30), (30, 48, 26), (48, 64, 34), (42, 52, 28)], 110, 82)
# dry grass tuft
im, dr, ss = card(); S2 = 512 * ss
for k in range(170):
    x0 = S2 / 2 + RS.normal(0, 1) * S2 * 0.12; h = RS.uniform(0.35, 0.95) * S2; lean = RS.normal(0, 0.35)
    c = [(150, 128, 82), (128, 108, 70), (110, 98, 72), (165, 140, 92), (96, 86, 64)][RS.randint(5)]
    c = tuple(int(v * RS.uniform(0.7, 1.1)) for v in c) + (255,)
    pts = []
    for s in range(9):
        t = s / 8; pts.append((x0 + lean * h * t * t, S2 - t * h))
    for i in range(8):
        dr.line([pts[i], pts[i + 1]], fill=c, width=max(1, int((3.2 - 2.6 * i / 8) * ss)))
finish(im, 512, T + '/veg/grass_dry.png')
# forest litter (top view): twigs, cones, needles
im, dr, ss = card(); S2 = 512 * ss
for k in range(900):
    x, y = RS.uniform(0, S2), RS.uniform(0, S2); a = RS.uniform(0, 6.28); L = RS.uniform(6, 26) * ss
    c = tuple(int(v) for v in RS.uniform(50, 105, 3) * np.array([1.0, 0.8, 0.6])) + (255,)
    dr.line((x, y, x + math.cos(a) * L, y + math.sin(a) * L), fill=c, width=max(1, int(1.5 * ss)))
for k in range(40):
    x, y = RS.uniform(30, S2 - 30), RS.uniform(30, S2 - 30); a = RS.uniform(0, 6.28); L = RS.uniform(60, 200) * ss
    branch(dr, x, y, a, L, 6, 1, (58, 46, 36, 255), ss, RS)
for k in range(25):
    x, y = RS.uniform(30, S2 - 30), RS.uniform(30, S2 - 30); r = RS.uniform(10, 18) * ss
    dr.ellipse((x - r, y - r * 0.6, x + r, y + r * 0.6), fill=(62, 44, 30, 255))
finish(im, 512, T + '/veg/litter.png')
# barbed wire strand (horizontal)
W, Hh = 512, 64; im = Image.new('RGBA', (W * 2, Hh * 2), (0, 0, 0, 0)); dr = ImageDraw.Draw(im)
for k in range(2):
    pts = [(x, Hh + math.sin(x / 18.0 + k * math.pi) * 5) for x in range(0, W * 2 + 1, 4)]
    dr.line(pts, fill=(96, 90, 84, 255), width=4)
for bx in range(32, W * 2, 128):
    for a in (0.9, -0.9, 2.3, -2.3):
        dr.line((bx, Hh, bx + math.cos(a) * 26, Hh + math.sin(a) * 26), fill=(84, 74, 66, 255), width=4)
im.convert('RGBa').resize((W, Hh), Image.LANCZOS).convert('RGBA').save(T + '/props/wire.png')

# ------------------------------------------------------------------ impostor atlas (4 tree kinds, 128 x 512 each)
print('impostors', flush=True)
IW, IH = 128, 512; atlas = Image.new('RGBA', (IW * 4, IH), (0, 0, 0, 0))
for kind in range(4):
    rs = np.random.RandomState(90 + kind); im = Image.new('RGBA', (IW * 2, IH * 2), (0, 0, 0, 0)); dr = ImageDraw.Draw(im)
    top = {0: 0.05, 1: 0.55, 2: 0.08, 3: 0.04}[kind]
    x0 = IW; base_w = 9
    ybot = IH * 2 - 4; ytop = top * IH * 2
    for i in range(40):        # tapered trunk
        t0, t1 = i / 40, (i + 1) / 40
        y0, y1 = ybot - (ybot - ytop) * t0, ybot - (ybot - ytop) * t1
        w = base_w * (1 - 0.8 * t0) * 2
        c = (int(30 + 40 * t0), int(26 + 30 * t0), int(22 + 22 * t0), 255) if kind != 3 else (int(60 + 40 * t0), int(44 + 20 * t0), int(32 + 10 * t0), 255)
        dr.line((x0 + rs.uniform(-1, 1), y0, x0 + rs.uniform(-1, 1), y1), fill=c, width=max(2, int(w)))
    for i in range(int(18 * (1 - top))):   # branch stubs / dead branches
        y = ytop + (ybot - ytop) * rs.uniform(0.02, 0.6); side = rs.choice([-1, 1]); L = rs.uniform(12, 50) * (0.4 if kind == 1 else 1)
        dr.line((x0, y, x0 + side * L, y + rs.uniform(-4, 14)), fill=(45, 38, 32, 255), width=3)
    if kind in (2, 3):              # needle crowns
        cols = [(70, 56, 34), (58, 54, 36), (86, 64, 38)] if kind == 2 else [(34, 50, 28), (30, 44, 26), (44, 58, 32)]
        n = 26 if kind == 2 else 70
        for k in range(n):
            t = rs.uniform(0.0, 0.5 if kind == 3 else 0.35); y = ytop + (ybot - ytop) * t
            wdt = (20 + 60 * t) * (1.0 if kind == 3 else 0.7); x = x0 + rs.uniform(-wdt, wdt); r = rs.uniform(8, 20)
            c = cols[rs.randint(len(cols))] + (255,)
            dr.ellipse((x - r * 1.6, y - r * 0.7, x + r * 1.6, y + r * 0.7), fill=c)
    atlas.paste(im.convert('RGBa').resize((IW, IH), Image.LANCZOS).convert('RGBA'), (kind * IW, 0))
atlas.save(T + '/veg/impostors.png')

# ------------------------------------------------------------------ props: wood, logs, burlap, metals, paint, cloth, paper
print('props', flush=True)
P = 1024
def wood_planks(S, plank_n=6, seed=1, tone=0.2, tint=(1.0, 0.92, 0.8)):
    rs = np.random.RandomState(seed)
    y = np.arange(S)[:, None] * np.ones((1, S)); x = np.ones((S, 1)) * np.arange(S)[None, :]
    ph = S / plank_n; pi = (y // ph).astype(int); py = (y % ph) / ph
    grain = np.zeros((S, S)); col = np.zeros((S, S, 3)); hgt = np.zeros((S, S))
    g1 = pnoise(S, S, 2, 60, seed + 1); g2 = pnoise(S, S, 4, 160, seed + 2); g3 = fbm(S, S, 8, 8, seed + 3)
    for k in range(plank_n):
        m = pi == k; off = rs.uniform(0, 1)
        shift = int(rs.uniform(0, S))
        gr = np.roll(np.roll(g1, shift, 1), int(k * ph * 0.37), 0) * 0.6 + np.roll(g2, shift, 1) * 0.4
        b = rs.uniform(0.8, 1.15)
        grain[m] = gr[m]
        col[m] = np.array(tint) * tone * b
    rings = 0.5 + 0.5 * np.sin((grain * 9 + x / S * 2) * 6.28)
    lum_ = 0.75 + 0.35 * rings * 0.4 + 0.25 * (grain - 0.5) + 0.15 * (g3 - 0.5)
    edge = np.minimum(py, 1 - py) * ph
    gap = smooth_edge = np.clip(edge / 3.0, 0, 1)
    dirt = np.clip((y / S) * 0.0 + (1 - py) * 0.0, 0, 1)
    a = col * lum_[..., None] * (0.35 + 0.65 * gap[..., None])
    weather = fbm(S, S, 5, 5, seed + 9); a = a * (0.85 + 0.3 * weather[..., None])
    grey = lum(a)[..., None] * np.array([1.0, 1.0, 1.0])
    a = a * 0.65 + grey * 0.35 * 1.15
    hgt = np.clip(0.55 + 0.25 * (rings - 0.5) + 0.2 * (grain - 0.5), 0, 1) * gap
    for k in range(plank_n * 2):     # knots
        cx, cy = rs.randint(0, S), int((rs.randint(0, plank_n) + 0.5) * ph); r = rs.uniform(6, 16)
        d = np.hypot(((x - cx + S / 2) % S) - S / 2, (y - cy) * 1.6)
        kn = np.clip(1 - d / r, 0, 1); a = a * (1 - 0.5 * kn[..., None]); hgt = hgt - 0.1 * kn
    return a, np.clip(hgt, 0, 1)
wa, wh = wood_planks(P, 6, 11, 0.44)
save_rgb(wa, T + '/props/planks.jpg'); save_rgba(nrh(wh, 0.82 - 0.1 * wh, 3.0), T + '/props/planks_nrh.png')
# debarked logs (grain runs along V)
lg = fbm(512, 1024, 3, 3, 21) * 0.4 + pnoise(512, 1024, 60, 3, 22) * 0.6
cr = Image.new('L', (512, 1024), 0); dr = ImageDraw.Draw(cr)
for k in range(40):
    x = RS.randint(0, 512); y = RS.randint(0, 1024); pts = [(x, y)]
    for s in range(10): x += RS.uniform(-2, 2); y += RS.uniform(15, 40); pts.append((x, y))
    dr.line(pts, fill=255, width=RS.randint(1, 3))
c = np.asarray(cr.filter(ImageFilter.GaussianBlur(0.6))).astype(np.float64) / 255
la = np.dstack([0.36 + 0.14 * lg, 0.30 + 0.12 * lg, 0.23 + 0.09 * lg]) * (1 - 0.65 * c[..., None])
la = la * (0.8 + 0.3 * fbm(512, 1024, 4, 8, 23)[..., None])
save_rgb(tileable(la, 0.12), T + '/props/logs.jpg'); save_rgba(nrh(tileable(norm01(lg - c), 0.12), 0.8, 2.5), T + '/props/logs_nrh.png')
# burlap (sandbags)
B = 512; yy, xx = np.mgrid[0:B, 0:B]
wv = np.sin(xx / B * 64 * math.pi * 2) * np.sin(yy / B * 64 * math.pi * 2)
thread = pnoise(B, B, 64, 64, 31, 1)
weave = norm01(np.where(wv > 0, 0.6 + 0.4 * np.abs(np.sin(xx / B * 64 * math.pi * 2)), 0.6 + 0.4 * np.abs(np.sin(yy / B * 64 * math.pi * 2))) * (0.8 + 0.2 * thread))
dirt = fbm(B, B, 4, 4, 32); stains = np.clip((dirt - 0.5) * 2.5, 0, 1)
ba = np.dstack([0.42, 0.36, 0.25]) * (0.65 + 0.45 * weave[..., None])
ba = ba * (1 - 0.55 * stains[..., None]) + np.array([0.13, 0.1, 0.07]) * 0.55 * stains[..., None]
save_rgb(ba, T + '/props/burlap.jpg'); save_rgba(nrh(weave * 0.7 + 0.3 * blur(dirt, 2), 0.93, 1.6), T + '/props/burlap_nrh.png')
# metals: rusty iron, galvanised steel, olive paint, red paint
def metal(base, rust_amt, seed, scratches=0.0, gloss=0.4):
    f1 = fbm(B, B, 4, 4, seed); f2 = fbm(B, B, 16, 16, seed + 1)
    rust = np.clip((f1 * 0.7 + f2 * 0.3 - (1 - rust_amt)) * 3, 0, 1)
    rc = np.dstack([0.32, 0.16, 0.07]) * (0.7 + 0.5 * f2[..., None])
    a = np.array(base) * (0.85 + 0.25 * f2[..., None]); a = a * (1 - rust[..., None]) + rc * rust[..., None]
    rough = gloss + 0.45 * rust + 0.1 * f2
    if scratches > 0:
        im = Image.new('L', (B, B), 0); dr = ImageDraw.Draw(im)
        for k in range(int(300 * scratches)):
            x, y = RS.randint(0, B), RS.randint(0, B); an = RS.uniform(0, 6.28); L = RS.uniform(5, 40)
            dr.line((x, y, x + math.cos(an) * L, y + math.sin(an) * L), fill=255, width=1)
        sc = np.asarray(im).astype(np.float64) / 255
        a = a * (1 - sc[..., None] * 0.5) + np.array([0.45, 0.43, 0.4]) * sc[..., None] * 0.5; rough = rough - 0.2 * sc
    h = norm01(0.6 * rust * f2 + 0.4 * f2)
    return a, nrh(h, rough, 1.4)
for name, base, ra, sd, scr, gl in (('iron', (0.16, 0.15, 0.14), 0.55, 41, 0.5, 0.45), ('galv', (0.42, 0.43, 0.44), 0.3, 42, 0.3, 0.35),
                                   ('olive', (0.2, 0.22, 0.13), 0.12, 43, 1.0, 0.5), ('red', (0.42, 0.06, 0.04), 0.15, 44, 1.0, 0.4)):
    a, n = metal(base, ra, sd, scr, gl); save_rgb(a, T + '/props/%s.jpg' % name); save_rgba(n, T + '/props/%s_nrh.png' % name)
# cloth: wool blanket with stripes, olive canvas
bl = fbm(B, B, 32, 32, 51, 3); st = (np.abs(((yy / B) * 4) % 1 - 0.5) < 0.05)
bc = np.dstack([0.24, 0.22, 0.2]) * (0.75 + 0.4 * bl[..., None]); bc[st] = bc[st] * 0.4 + np.array([0.35, 0.1, 0.08]) * 0.6
save_rgb(bc, T + '/props/blanket.jpg'); save_rgba(nrh(bl, 0.95, 1.2), T + '/props/blanket_nrh.png')
cv = norm01(np.sin(xx / B * 96 * math.pi * 2) * 0.5 + np.sin(yy / B * 96 * math.pi * 2) * 0.5 + fbm(B, B, 8, 8, 52) * 1.5)
cc = np.dstack([0.25, 0.26, 0.16]) * (0.8 + 0.3 * cv[..., None]) * (0.8 + 0.3 * fbm(B, B, 3, 3, 53)[..., None])
save_rgb(cc, T + '/props/canvas.jpg'); save_rgba(nrh(cv, 0.9, 0.8), T + '/props/canvas_nrh.png')
# paper map
pm = np.dstack([0.74, 0.69, 0.55]) * (0.85 + 0.2 * fbm(B, B, 4, 4, 54)[..., None])
im = Image.fromarray((pm * 255).astype(np.uint8)); dr = ImageDraw.Draw(im)
f = fbm(B, B, 3, 3, 55)
for lev in np.linspace(0.2, 0.8, 9):
    m = np.abs(f - lev) < 0.004
    ys, xs = np.nonzero(m)
    for (y, x) in zip(ys[::3], xs[::3]): im.putpixel((int(x), int(y)), (120, 90, 60))
for g in range(0, B, 64): dr.line((g, 0, g, B), fill=(90, 110, 140), width=1); dr.line((0, g, B, g), fill=(90, 110, 140), width=1)
for k in range(6):
    pts = [(RS.randint(0, B), RS.randint(0, B)) for _ in range(4)]; dr.line(pts, fill=(160, 30, 30), width=3)
save_rgb(np.asarray(im).astype(np.float64) / 255, T + '/props/map.jpg')

# ------------------------------------------------------------------ fx: smoke, dust, spark, flash, bullet hole, rain, fire
print('fx', flush=True)
def radial(S, p=2.0):
    yy, xx = np.mgrid[0:S, 0:S]; d = np.hypot(xx - S / 2 + 0.5, yy - S / 2 + 0.5) / (S / 2); return np.clip(1 - d, 0, 1) ** p
S = 256
sm = radial(S, 1.5) * (0.55 + 0.45 * fbm(S, S, 4, 4, 81)); sm = np.clip(sm * 1.6, 0, 1)
save_rgba(np.dstack([np.ones((S, S)) * 0.9, np.ones((S, S)) * 0.9, np.ones((S, S)) * 0.9, sm]), T + '/fx/smoke.png')
du = radial(S, 1.2) * (0.4 + 0.6 * fbm(S, S, 6, 6, 82)); du = np.clip(du * 1.5, 0, 1)
save_rgba(np.dstack([np.ones((S, S)) * 0.55, np.ones((S, S)) * 0.47, np.ones((S, S)) * 0.38, du]), T + '/fx/dust.png')
sp = radial(64, 3.0); save_rgba(np.dstack([np.ones((64, 64)), np.ones((64, 64)) * 0.8, np.ones((64, 64)) * 0.45, sp]), T + '/fx/spark.png')
# muzzle flash: star burst
yy, xx = np.mgrid[0:S, 0:S]; ang = np.arctan2(yy - S / 2, xx - S / 2); d = np.hypot(xx - S / 2, yy - S / 2) / (S / 2)
spikes = np.clip(np.cos(ang * 5) * 0.5 + 0.5, 0, 1) ** 6
fl = np.clip((1 - d / (0.35 + 0.65 * spikes)) * 1.4, 0, 1) * (0.7 + 0.3 * fbm(S, S, 8, 8, 83))
core = radial(S, 2.5)
save_rgba(np.dstack([np.ones((S, S)), 0.75 + 0.25 * core, 0.35 + 0.6 * core, np.clip(fl + core, 0, 1)]), T + '/fx/flash.png')
# side flash (elongated)
d2 = np.hypot((xx - S * 0.1) / (S * 0.9), (yy - S / 2) / (S * 0.22))
fs = np.clip(1 - d2, 0, 1) ** 1.2 * (0.6 + 0.4 * fbm(S, S, 10, 4, 84))
save_rgba(np.dstack([np.ones((S, S)), 0.7 + 0.3 * fs, 0.3 + 0.5 * fs, np.clip(fs * 1.5, 0, 1)]), T + '/fx/flash_side.png')
# bullet hole (alpha, dark centre, torn ring)
H2 = 128; yy, xx = np.mgrid[0:H2, 0:H2]; d = np.hypot(xx - H2 / 2, yy - H2 / 2) / (H2 / 2); an = np.arctan2(yy - H2 / 2, xx - H2 / 2)
ring = np.clip(1 - np.abs(d - 0.3) / (0.25 + 0.15 * np.sin(an * 7)), 0, 1)
hole = (d < 0.16).astype(float)
al = np.clip(hole + ring * 0.8, 0, 1) * (d < 0.95)
col = np.dstack([0.08 + 0.12 * ring * (1 - hole), 0.07 + 0.1 * ring * (1 - hole), 0.06 + 0.08 * ring * (1 - hole)])
save_rgba(np.dstack([col, al]), T + '/fx/bullet_hole.png')
# rain streak: the drop fills the whole width so mipmaps keep it visible far away (the quad is only ~2.5 cm wide)
rw, rh = 8, 128; yy, xx = np.mgrid[0:rh, 0:rw]
ra = np.clip(1 - np.abs(xx - rw / 2 + 0.5) / (rw / 2), 0, 1) ** 0.7 * np.sin(np.clip((yy + 0.5) / rh, 0, 1) * math.pi) ** 0.6
save_rgba(np.dstack([np.ones((rh, rw)) * 0.82, np.ones((rh, rw)) * 0.84, np.ones((rh, rw)) * 0.87, ra * 0.85]), T + '/fx/rain.png')
# fire (stove / burning): soft flame shape
yy, xx = np.mgrid[0:S, 0:S]; u = (xx - S / 2) / (S / 2); v = 1 - yy / S
fla = np.clip(1 - np.abs(u) / (0.15 + 0.5 * (1 - v) ** 0.8 * v ** 0.3 + 1e-3), 0, 1) * np.clip(v * 3, 0, 1) * (0.6 + 0.4 * fbm(S, S, 4, 8, 85))
save_rgba(np.dstack([np.ones((S, S)), 0.45 + 0.5 * fla, 0.12 + 0.3 * fla ** 2, np.clip(fla * 1.3, 0, 1)]), T + '/fx/flame.png')
print('textures done')
