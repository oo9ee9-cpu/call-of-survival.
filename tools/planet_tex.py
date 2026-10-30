"""an invented planet for the loading film (never shipped as a texture): continents, seas, deserts, forests, ice caps, city lights,
clouds, all from 3D noise sampled the way three.js wraps a SphereGeometry, so there is no seam.
usage: python3 -I planet_tex.py <out_dir> [width]"""
import sys, os, time
import numpy as np
from PIL import Image, ImageFilter

out = sys.argv[1]; W = int(sys.argv[2]) if len(sys.argv) > 2 else 4096; H = W // 2
os.makedirs(out, exist_ok=True); t0 = time.time()
rs = np.random.RandomState(1717)
perm = rs.permutation(256).astype(np.int32); perm = np.concatenate([perm, perm])
G3 = np.array([[1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0], [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
               [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]], np.float32)

def noise3(x, y, z):
    xi = np.floor(x); yi = np.floor(y); zi = np.floor(z)
    xf = (x - xi).astype(np.float32); yf = (y - yi).astype(np.float32); zf = (z - zi).astype(np.float32)
    xi = xi.astype(np.int32) & 255; yi = yi.astype(np.int32) & 255; zi = zi.astype(np.int32) & 255
    fade = lambda t: t * t * t * (t * (t * 6 - 15) + 10)
    u, v, w = fade(xf), fade(yf), fade(zf)
    def g(ix, iy, iz, dx, dy, dz):
        h = perm[perm[perm[ix] + iy] + iz] % 12
        gr = G3[h]
        return gr[..., 0] * dx + gr[..., 1] * dy + gr[..., 2] * dz
    x1 = xi + 1; y1 = yi + 1; z1 = zi + 1
    n000 = g(xi, yi, zi, xf, yf, zf); n100 = g(x1, yi, zi, xf - 1, yf, zf)
    n010 = g(xi, y1, zi, xf, yf - 1, zf); n110 = g(x1, y1, zi, xf - 1, yf - 1, zf)
    n001 = g(xi, yi, z1, xf, yf, zf - 1); n101 = g(x1, yi, z1, xf - 1, yf, zf - 1)
    n011 = g(xi, y1, z1, xf, yf - 1, zf - 1); n111 = g(x1, y1, z1, xf - 1, yf - 1, zf - 1)
    a = n000 + u * (n100 - n000); b = n010 + u * (n110 - n010); c = n001 + u * (n101 - n001); d = n011 + u * (n111 - n011)
    e = a + v * (b - a); f = c + v * (d - c)
    return e + w * (f - e)

def fbm(px, py, pz, octaves, freq=1.0, gain=0.5, lac=2.03, off=0.0):
    s = np.zeros_like(px); amp = 1.0; norm = 0.0
    for o in range(octaves):
        s += amp * noise3(px * freq + off + o * 7.13, py * freq - off + o * 3.71, pz * freq + o * 5.27); norm += amp
        amp *= gain; freq *= lac
    return s / norm

# the sphere's directions exactly as three.js's SphereGeometry lays its uvs (u around, v from the top)
u = (np.arange(W, dtype=np.float32) + 0.5) / W; v = (np.arange(H, dtype=np.float32) + 0.5) / H
phi = u * 2 * np.pi; th = v * np.pi
PH, TH = np.meshgrid(phi, th)
X = (-np.cos(PH) * np.sin(TH)).astype(np.float32); Y = np.cos(TH).astype(np.float32); Z = (np.sin(PH) * np.sin(TH)).astype(np.float32)
del PH, TH
lat = np.abs(Y)
print('grid', W, H, round(time.time() - t0, 1), 's', flush=True)

# land and sea: wide continents with ragged coasts, a few island chains
cont = fbm(X, Y, Z, 4, 1.15, off=1.3)
detail = fbm(X, Y, Z, 7, 3.2, 0.52, off=4.1)
E = 0.72 * cont + 0.34 * detail - 0.035
print('elevation', round(time.time() - t0, 1), 's', flush=True)
ridge = 1 - np.abs(fbm(X, Y, Z, 5, 5.5, 0.55, off=9.7)); ridge = ridge ** 3
moist = fbm(X, Y, Z, 4, 2.1, off=13.3)
print('ridges, moisture', round(time.time() - t0, 1), 's', flush=True)
land = E > 0
sm = lambda a, b, x: np.clip((x - a) / (b - a), 0, 1) ** 2 * (3 - 2 * np.clip((x - a) / (b - a), 0, 1))

# the colours: deep ocean to shallow shelf; deserts in the hot dry belts, grass and forest, tundra and ice toward the poles
deep = np.array([0.010, 0.040, 0.110], np.float32); shelf = np.array([0.030, 0.170, 0.270], np.float32)
sea = deep + (shelf - deep) * sm(-0.10, 0.0, E)[..., None]
temp = 1 - lat * 1.0 - np.maximum(E, 0) * 0.9 + moist * 0.06
dry = sm(0.15, 0.45, 0.5 - np.abs(lat - 0.4) * 2.5 - moist * 1.3)
desert = np.array([0.58, 0.47, 0.31], np.float32); grass = np.array([0.20, 0.32, 0.12], np.float32)
forest = np.array([0.07, 0.17, 0.07], np.float32); tundra = np.array([0.36, 0.35, 0.30], np.float32)
rock = np.array([0.40, 0.36, 0.31], np.float32); snow = np.array([0.90, 0.92, 0.96], np.float32)
g = grass + (forest - grass) * sm(-0.05, 0.25, moist)[..., None]
g = g + (desert - g) * dry[..., None]
g = g + (tundra - g) * sm(0.24, 0.12, temp)[..., None]
g = g + (rock - g) * (sm(0.12, 0.45, E) * ridge * 0.9)[..., None]
g = g + (snow - g) * sm(0.09, 0.02, temp)[..., None]
col = np.where(land[..., None], g, sea)
# sea ice at the poles
ice = sm(0.935, 0.965, lat + fbm(X, Y, Z, 3, 6, off=21.0) * 0.03)
col = col + (snow - col) * ice[..., None]
col = col * (0.92 + 0.16 * fbm(X, Y, Z, 3, 24, off=31.0)[..., None])
Image.fromarray(np.clip(np.round(np.power(np.clip(col, 0, 1), 1 / 2.2) * 255), 0, 255).astype(np.uint8)).save(os.path.join(out, 'day.jpg'), quality=92)
Image.fromarray((np.clip(1 - land - ice, 0, 1) * 255).astype(np.uint8)).resize((W // 2, H // 2), Image.BILINEAR).save(os.path.join(out, 'spec.png'))
print('day', round(time.time() - t0, 1), 's', flush=True)

# city lights: thousands of towns over the lowlands of the temperate and warm belts, thicker along the coasts, with a few
# bright metropolises; each a point or a small cluster with a soft glow around it
coast = sm(0.22, 0.0, E) * land
region = sm(-0.15, 0.35, fbm(X, Y, Z, 3, 2.6, off=41.0))
dens = land * (0.3 + 0.9 * coast) * (0.25 + 0.75 * region) * sm(0.86, 0.6, lat) * (1 - ice) * (1 - dry * 0.75) * sm(0.45, 0.15, E)
rnd = rs.random_sample(X.shape).astype(np.float32)
town = (rnd > 1 - 0.035 * dens).astype(np.float32) * (0.45 + 0.55 * rs.random_sample(X.shape).astype(np.float32))
metro = sm(0.55, 0.85, fbm(X, Y, Z, 2, 38, 0.5, off=51.0) * 0.5 + 0.5) * dens * sm(0.3, 0.7, region)
# the smooth maps the film's shader lights from: how many towns (R), how much city glow (G); the points are drawn there
DM = np.stack([np.clip(dens, 0, 1), np.clip(metro, 0, 1), np.zeros_like(dens)], -1)
Image.fromarray((DM * 255).astype(np.uint8)).resize((W // 2, H // 2), Image.BILINEAR).save(os.path.join(out, 'dens.png'))
L = np.clip(town + metro * 0.9, 0, 1)
Li = Image.fromarray((L * 255).astype(np.uint8))
glow = Li.filter(ImageFilter.GaussianBlur(1.6))
Lm = np.maximum(np.asarray(Li, np.float32) * 0.9, np.asarray(glow, np.float32) * 2.2)
Image.fromarray(np.clip(Lm, 0, 255).astype(np.uint8)).save(os.path.join(out, 'night.png'))
print('night', round(time.time() - t0, 1), 's', flush=True)

# clouds: storm bands and swirls (the field is pushed around by another noise first)
wx = fbm(X, Y, Z, 3, 1.8, off=61.0); wy = fbm(X, Y, Z, 3, 1.8, off=71.0); wz = fbm(X, Y, Z, 3, 1.8, off=81.0)
C = fbm(X + wx * 0.55, Y + wy * 0.55, Z + wz * 0.55, 7, 2.6, 0.55, off=91.0)
band = 0.55 + 0.45 * np.cos(lat * np.pi * 3.2)
A = sm(-0.02, 0.38, C + band * 0.14 - 0.08)
Image.fromarray((A * 255).astype(np.uint8)).save(os.path.join(out, 'clouds.png'))
print('clouds', round(time.time() - t0, 1), 's', flush=True)
