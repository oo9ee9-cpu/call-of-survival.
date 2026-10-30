import numpy as np, sys
from PIL import Image
from common import *
name = sys.argv[1] if len(sys.argv) > 1 else 'h0'
h = load(name).astype(np.float64)
gx = np.gradient(h, axis=1) / STEP; gz = np.gradient(h, axis=0) / STEP
nx, ny, nz = -gx, np.ones_like(h), -gz; l = np.sqrt(nx * nx + ny * ny + nz * nz)
L = np.array([-0.5, 0.75, -0.45]); L /= np.linalg.norm(L)
shade = np.clip((nx * L[0] + ny * L[1] + nz * L[2]) / l, 0, 1)
stops = [(-60, (20, 50, 90)), (-5, (60, 130, 170)), (0, (90, 170, 190)), (0.01, (226, 210, 160)), (6, (150, 170, 100)), (60, (110, 150, 80)), (160, (130, 140, 90)), (300, (140, 120, 100)), (420, (170, 165, 160)), (520, (245, 245, 250))]
c = np.zeros(h.shape + (3,))
for (a, ca), (b, cb) in zip(stops[:-1], stops[1:]):
    t = np.clip((h - a) / (b - a), 0, 1)[..., None]; m = ((h >= a) & (h < b))[..., None]
    c = np.where(m, np.array(ca) * (1 - t) + np.array(cb) * t, c)
c = np.where((h >= stops[-1][0])[..., None], np.array(stops[-1][1]), c)
c = c * (0.45 + 0.75 * shade[..., None])
try:
    WL = load('WL'); wet = ~np.isnan(WL) & (WL > h) & (h > -0.5 + 0 * h)
    dep = np.nan_to_num(WL - h)
    wc = np.array([60, 140, 175]) * (1 - np.clip(dep / 8, 0, 1))[..., None] + np.array([25, 75, 120]) * np.clip(dep / 8, 0, 1)[..., None]
    lakeish = wet & (np.nan_to_num(WL) > 0.01)
    c = np.where(lakeish[..., None], wc * (0.85 + 0.2 * shade[..., None]), c)
except Exception as e: print(e)
Image.fromarray(np.clip(c, 0, 255).astype(np.uint8)).resize((900, 900), Image.LANCZOS).save(OUT + f'/prev_{name}.png')
