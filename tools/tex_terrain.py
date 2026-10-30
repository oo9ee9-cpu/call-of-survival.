# builds the terrain texture array strips: assets/tex/ter_albedo_{512,1024}.jpg and ter_normal_{512,1024}.jpg
import numpy as np, os, sys
from PIL import Image
from scipy import ndimage
sys.path.insert(0, os.path.dirname(__file__))
from texlib import *
SP = os.path.join(os.path.dirname(__file__), '..')
DL = SP + '/dl'; OUTD = SP + '/assets/tex'; os.makedirs(OUTD, exist_ok=True)
S = 1024
EZ = DL + '/ez-tree/src/app/public/textures'
BAB = DL + '/babylon/textures'
CLIFF = DL + '/dec/cliff_img'
V3G = SP + '/../artifact-files/2e0d4c5f-196d-448c-bac0-9f0a6ae2fbd0/assets/grass.jpg'
layers = []  # (name, albedo, normal)
def add(name, alb, nrm): layers.append((name, np.clip(alb, 0, 1), np.clip(nrm, 0, 1))); print('layer', len(layers) - 1, name, round(float(lum(alb).mean()), 3))
def nrm_rgb(path, size=S):
    a = load(path, size); return a
# 0 meadow grass
g0 = tileable(load(BAB + '/grass.png', S)); g0 = match_tone(g0, 0.27, 1.05)
add('grass', g0, normal_from_height(height_from_albedo(g0, 1.0, 0.8), 1.6))
# 1 lush grass
g1 = load(V3G, S); g1 = tileable(g1, 0.15); g1 = match_tone(g1, 0.24, 1.0, (0.92, 1.0, 0.85))
add('lush', g1, normal_from_height(height_from_albedo(g1, 1.0, 0.8), 1.6))
# 2 dry grass
g2 = tileable(load(EZ + '/ground/grass.jpg', S)); g2 = match_tone(g2, 0.30, 0.75, (1.22, 1.0, 0.55))
add('dry', g2, normal_from_height(height_from_albedo(g2, 1.0, 0.8), 1.4))
# soil base used by several layers
soil = tileable(load(EZ + '/ground/dirt_color.jpg', S)); soilN = tileable(load(EZ + '/ground/dirt_normal.jpg', S))
leaves = [Image.open(EZ + '/leaves/%s.png' % n).convert('RGBA') for n in ('oak', 'ash', 'aspen')]
pine = Image.open(EZ + '/leaves/pine.png').convert('RGBA')
# individual leaf sprites: cut the twig images into small tiles that contain mostly leaf
def leaf_bits(im, n=24, s=180, seed=0):
    a = np.asarray(im); rs = np.random.RandomState(seed); out = []
    for t in range(400):
        x = rs.randint(0, a.shape[1] - s); y = rs.randint(0, a.shape[0] - s); al = a[y:y + s, x:x + s, 3]
        if (al > 128).mean() > 0.32: out.append(Image.fromarray(a[y:y + s, x:x + s]))
        if len(out) >= n: break
    return out
bits = sum([leaf_bits(l, 20, 170, k) for k, l in enumerate(leaves)], [])
# 3 forest floor: dark soil under a litter of fallen leaves
ff = match_tone(soil, 0.12, 0.9)
ff = scatter(ff, bits, 1400, (40, 92), seed=11, tints=[(0.75, 0.5, 0.3), (0.9, 0.62, 0.32), (0.6, 0.45, 0.3), (0.85, 0.75, 0.4), (0.55, 0.6, 0.35)], shadow=0.45)
twig = [Image.fromarray(np.dstack([np.full((64, 64), 60), np.full((64, 64), 45), np.full((64, 64), 30), (np.abs(np.arange(64)[:, None] - 32 - 0.15 * np.arange(64)[None, :] + 4) < 1.4) * 255]).astype(np.uint8))]
ff = scatter(ff, twig, 160, (40, 120), seed=12, shadow=0.3)
ff = match_tone(ff, 0.17, 1.0)
hff = height_from_albedo(ff, 0.8, 1.0)
add('forest', ff, normal_from_height(hff, 2.2))
# 4 needle floor: soil + brown needles + a few cones-ish dark dots
nf = match_tone(soil, 0.13, 0.8, (1.05, 0.95, 0.85))
rs = np.random.RandomState(4)
needle = []
for k in range(6):
    a = np.zeros((48, 48, 4), np.uint8); t = np.linspace(0, 1, 60)
    ang = rs.uniform(0, np.pi); L = rs.uniform(16, 22)
    for tt in t:
        x = int(24 + np.cos(ang) * (tt - 0.5) * L); y = int(24 + np.sin(ang) * (tt - 0.5) * L)
        a[max(0, y - 0):y + 1, max(0, x - 0):x + 1] = (int(140 + rs.uniform(-30, 30)), int(92 + rs.uniform(-20, 20)), 52, 255)
    needle.append(Image.fromarray(a))
nf = scatter(nf, needle, 9000, (26, 44), seed=13, shadow=0.25)
pine_bits = leaf_bits(pine, 16, 200, 9)
nf = scatter(nf, pine_bits, 120, (60, 120), seed=14, tints=[(0.8, 0.6, 0.35), (0.7, 0.55, 0.35)], shadow=0.4)
nf = match_tone(nf, 0.16, 1.0)
add('needles', nf, normal_from_height(height_from_albedo(nf, 0.8, 1.0), 2.0))
# 5 soil (fields, paths)
s5 = match_tone(soil, 0.16, 0.95)
add('soil', s5, soilN)
# 6 cracked dry earth
ce = tileable(load(BAB + '/ground.jpg', S)); ce = match_tone(ce, 0.40, 0.85)
add('cracked', ce, normal_from_height(height_from_albedo(ce, 0.8, 1.2), 2.4))
# 7 sand
sd = tileable(load(BAB + '/sand.jpg', S)); sd = match_tone(sd, 0.45, 0.85, (1.03, 1.0, 0.92))
ripple = 0.5 + 0.5 * np.sin((np.arange(S)[:, None] * 0.9 + np.arange(S)[None, :] * 0.25) / S * 2 * np.pi * 22 + fbm_tile(S, 3, 4, 5) * 6)
hs = height_from_albedo(sd, 0.8, 0.6) * 0.6 + ripple * 0.4
add('sand', sd, normal_from_height(hs, 1.0))
# 8 rock: quilt from the photographed cliffs
rk1 = load(CLIFF + '/img6_namaqualand_cliff_02 (Base Color).png'); rk2 = load(CLIFF + '/img9_coast_land_rocks_04 (Base Color).png')
def validity(img):
    l = lum(img); gx = ndimage.sobel(l, 1); gy = ndimage.sobel(l, 0)
    # dilation streaks are smooth along one axis: high anisotropy, low total detail
    sx = ndimage.uniform_filter(gx * gx, 9); sy = ndimage.uniform_filter(gy * gy, 9)
    an = np.abs(sx - sy) / (sx + sy + 1e-6)
    return (an < 0.55).astype(np.float64)
rq = quilt(rk1, 512, 64, 18, seed=3, weight=validity(rk1), tries=1500)
rq2 = quilt(rk2, 512, 64, 18, seed=4, weight=validity(rk2), tries=1500)
rock = 0.65 * rq + 0.35 * rq2
rock = np.asarray(Image.fromarray((rock * 255).astype(np.uint8)).resize((S, S), Image.LANCZOS)) / 255.0
rock = match_tone(rock, 0.27, 0.7, (1.0, 0.98, 0.95))
add('rock', rock, normal_from_height(height_from_albedo(rock, 1.0, 1.4), 3.0))
# 9 gravel
gv = tileable(load(BAB + '/rockyGround_basecolor.png', S)); gv = match_tone(gv, 0.36, 0.7)
gvN = tileable(load(BAB + '/rockyGround_normal.png', S))
add('gravel', gv, gvN)
# 10 snow
sn = fbm_tile(S, 7, 4, 21); sn2 = fbm_tile(S, 5, 16, 22)
snow = np.dstack([0.86 + 0.08 * sn, 0.89 + 0.07 * sn, 0.95 + 0.04 * sn]) * (0.94 + 0.06 * sn2[..., None])
spark = (np.random.RandomState(9).rand(S, S) > 0.9985)
snow[spark] = 1.0
add('snow', snow, normal_from_height(sn * 0.7 + sn2 * 0.3, 0.9))
# 11 mud
md = match_tone(soil, 0.09, 0.8, (1.0, 0.95, 0.85))
wetm = fbm_tile(S, 4, 4, 31); md = md * (1 - 0.35 * (wetm > 0.55)[..., None] * 0.6)
add('mud', md, normal_from_height(ndimage.gaussian_filter(height_from_albedo(md, 1.2, 0.8), 1.5) * (1 - 0.7 * (wetm > 0.55)), 1.2))
# ---- write strips
names = [n for n, a, b in layers]
for size in (1024, 512, 256):
    A = np.concatenate([np.asarray(Image.fromarray((a * 255).astype(np.uint8)).resize((size, size), Image.LANCZOS)) for n, a, b in layers], 0)
    Nn = np.concatenate([np.asarray(Image.fromarray((b * 255).astype(np.uint8)).resize((size, size), Image.LANCZOS)) for n, a, b in layers], 0)
    Image.fromarray(A).save(OUTD + '/ter_albedo_%d.jpg' % size, quality=86 if size > 256 else 90, optimize=True)
    Image.fromarray(Nn).save(OUTD + '/ter_normal_%d.jpg' % size, quality=88, optimize=True)
open(OUTD + '/ter_layers.txt', 'w').write('\n'.join(names))
# preview sheet
prev = np.concatenate([np.concatenate([np.asarray(Image.fromarray((layers[r * 4 + c][1] * 255).astype(np.uint8)).resize((256, 256))) for c in range(4)], 1) for r in range(3)], 0)
Image.fromarray(prev).save(SP + '/build/ter_prev.jpg', quality=88)
for f in sorted(os.listdir(OUTD)): print(f, os.path.getsize(OUTD + '/' + f))
