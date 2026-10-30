# relief preview with a coordinate grid: MAP=<id> python3 preview_grid.py <h-name> <out.png> <grid metres>
import sys, numpy as np
from PIL import Image, ImageDraw
from common import *
h = load(sys.argv[1]).astype(np.float64); G = float(sys.argv[3]) if len(sys.argv) > 3 else 2000
gx = np.gradient(h, axis=1) / STEP; gz = np.gradient(h, axis=0) / STEP
shade = np.clip((-0.55 * gx - 0.5 * gz + 0.7) / np.sqrt(gx * gx + gz * gz + 1), 0, 1.2)
t = np.clip(h / max(1, h.max()), 0, 1)
col = np.stack([0.55 + 0.4 * t, 0.5 + 0.3 * t, 0.35 + 0.2 * t], -1) * 255 * (0.55 + 0.5 * shade[..., None])
col = np.where((h < 0)[..., None], np.array([40, 90, 130]) * (1 + np.clip(h, -40, 0)[..., None] / 80), col)
try:
    WL = load('WL'); wet = (~np.isnan(WL)) & (WL > h); col = np.where((wet & (h >= 0))[..., None], np.array([70, 150, 190]), col)
except Exception: pass
im = Image.fromarray(np.clip(col, 0, 255).astype(np.uint8)); S = 1024; im = im.resize((S, S)); d = ImageDraw.Draw(im)
T = lambda v: (v + HALF) / WORLD * S
v = -np.floor(HALF / G) * G
while v <= HALF:
    d.line([(T(v), 0), (T(v), S)], fill=(255, 255, 255), width=1); d.line([(0, T(v)), (S, T(v))], fill=(255, 255, 255), width=1)
    d.text((T(v) + 2, 2), str(int(v / 1000)), fill=(255, 255, 0)); d.text((2, T(v) + 2), str(int(v / 1000)), fill=(255, 255, 0)); v += G
im.save(sys.argv[2]); print('saved')
