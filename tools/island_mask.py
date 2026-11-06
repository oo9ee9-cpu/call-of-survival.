#!/usr/bin/env python3
"""Call of Survival - the island's outline from the owner's map picture (an 8 x 8 km island seen from above, the sea
dark blue): land where the picture is not sea, the lakes and rivers filled in (the generator makes its own), small
islets kept. Writes data/valley/island_mask.png (1024 x 1024, white land) in world space: x east, z south, the city at
the centre of the world. The picture's city centre (u 0.53, v 0.41) goes to (0, 0) and it is shrunk 8 % to fit.
usage: python3 island_mask.py <project_dir> <map_picture>"""
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

PROJ, SRC = sys.argv[1], sys.argv[2]
U0, V0, K = 0.53, 0.41, 8192.0 * 0.92      # picture (u, v) -> world: x = (u - U0) * K, z = (v - V0) * K
HALF = 4096.0
N = 1024

im = np.asarray(Image.open(SRC).convert('RGB')).astype(np.float32)
r, g, b = im[..., 0], im[..., 1], im[..., 2]
sea = (b > r + 25) & (b > g - 10) & (r < 90)
land = ~sea
land = ndimage.binary_opening(land, iterations=3)          # bridges and piers go: the islands stay apart
land = ndimage.binary_closing(land, iterations=6)          # rivers and narrow creeks closed
# the ocean is the water that reaches the picture's edge; lakes and anything else inside become land
wl, wn = ndimage.label(~land)
edge = np.unique(np.concatenate([wl[0], wl[-1], wl[:, 0], wl[:, -1]]))
ocean = np.isin(wl, edge[edge > 0])
land = ~ocean
lab, n = ndimage.label(land)
sizes = ndimage.sum(land, lab, range(1, n + 1))
keep = np.zeros(n + 1, bool)
keep[1:] = sizes > 60                                        # drop specks, keep the islets
land = keep[lab]
src = ndimage.gaussian_filter(land.astype(np.float32), 1.2)
H, W = src.shape
# sample in world space
xs = np.linspace(-HALF, HALF, N)
XX, ZZ = np.meshgrid(xs, xs)
u = XX / K + U0
v = ZZ / K + V0
px = np.clip(u * (W - 1), 0, W - 1)
py = np.clip(v * (H - 1), 0, H - 1)
out = ndimage.map_coordinates(src, [py, px], order=1, mode='nearest')
out[(u < 0) | (u > 1) | (v < 0) | (v > 1)] = 0.0
# the strait between the main island and the southern one: closing the rivers shut it, so its own sea comes back
raw = ndimage.map_coordinates(ndimage.gaussian_filter(sea.astype(np.float32), 1.0), [py, px], order=1, mode='nearest')
STRAIT = np.array([(-1900, 1900), (-600, 2050), (600, 2000), (1800, 1900), (3600, 2000)], np.float64)
dmin = np.full(XX.shape, 1e9)
for i in range(len(STRAIT) - 1):
    a_, b_ = STRAIT[i], STRAIT[i + 1]
    ab = b_ - a_
    t = np.clip(((XX - a_[0]) * ab[0] + (ZZ - a_[1]) * ab[1]) / (ab @ ab), 0, 1)
    dmin = np.minimum(dmin, np.hypot(XX - (a_[0] + ab[0] * t), ZZ - (a_[1] + ab[1] * t)))
band = dmin < 520
out = np.where(band & (raw > 0.5), 0.0, out)
Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8)).save(PROJ + '/data/valley/island_mask.png')
print('island mask', out.shape, 'land %.1f %%' % (100 * (out > 0.5).mean()))
