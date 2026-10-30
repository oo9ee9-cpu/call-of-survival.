import numpy as np, json, sys
from PIL import Image, ImageDraw
from scipy import ndimage
from common import *
P = json.load(open(OUT + '/places.json'))
cx, cz, r = (map(float, sys.argv[1:4]) if len(sys.argv) > 3 else (0.0, 0.0, 4096.0))
S = 1000; k = S / (2 * r)
h = load('h3').astype(np.float64); WL = load('WL')
# sample the terrain at the crop resolution
xs = cx - r + (np.arange(S) + 0.5) / k; zs = cz - r + (np.arange(S) + 0.5) / k
XX, ZZ = np.meshgrid((xs + HALF) / STEP, (zs + HALF) / STEP)
hh = ndimage.map_coordinates(h, [ZZ, XX], order=1); wl = ndimage.map_coordinates(np.nan_to_num(WL, nan=-999), [ZZ, XX], order=0)
gx = np.gradient(hh, axis=1) * k; gz = np.gradient(hh, axis=0) * k
sh = np.clip((0.5 * gx * -1 + 0.45 * gz * -1 + 0.75) / np.sqrt(gx * gx + gz * gz + 1), 0, 1)
col = np.zeros((S, S, 3)); g = np.clip(hh / 300, 0, 1)[..., None]
col[:] = (np.array([120, 160, 90]) * (1 - g) + np.array([150, 140, 120]) * g)
col *= (0.5 + 0.7 * sh[..., None])
water = wl > hh
col[water] = (50, 120, 170)
im = Image.fromarray(np.clip(col, 0, 255).astype(np.uint8)); d = ImageDraw.Draw(im)
T = lambda x, z: ((x - cx + r) * k, (z - cz + r) * k)
for s in P['settlements']:
    for st in s['streets']:
        d.line([T(*p) for p in st['pts']], fill=(70, 70, 70), width=max(1, int(st['w'] * k)))
    for b in s['buildings']:
        x0, z0 = T(b['x'] - b['hx'], b['z'] - b['hz']); x1, z1 = T(b['x'] + b['hx'], b['z'] + b['hz'])
        d.rectangle([x0, z0, x1, z1], fill=(240, 220, 170) if b.get('enter') else (200, 120, 90), outline=(60, 40, 30))
        dx, dz = {'n': (0, -1), 's': (0, 1), 'e': (1, 0), 'w': (-1, 0)}[b['door']]
        px, pz = T(b['x'] + dx * b['hx'], b['z'] + dz * b['hz']); d.ellipse([px - 2, pz - 2, px + 2, pz + 2], fill=(30, 30, 200))
    for p in s['props']:
        if p['kind'] in ('pier',):
            x0, z0 = T(p['x'] - p['w'] / 2, p['z'] - p['len'] / 2); x1, z1 = T(p['x'] + p['w'] / 2, p['z'] + p['len'] / 2); d.rectangle([x0, z0, x1, z1], fill=(140, 100, 60))
for p in P['poi']:
    x, z = T(p['x'], p['z']); d.ellipse([x - 4, z - 4, x + 4, z + 4], fill=(255, 40, 40))
im.save(OUT + '/prev_places.png')
