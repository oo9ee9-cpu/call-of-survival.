# quick look at a map's relief at any stage: MAP=<id> python3 preview.py <h-name> <out.png>
import sys, numpy as np
from PIL import Image
from common import *
h = load(sys.argv[1]).astype(np.float64)
gx = np.gradient(h, axis=1) / STEP; gz = np.gradient(h, axis=0) / STEP
shade = np.clip((-0.55 * gx - 0.5 * gz + 0.7) / np.sqrt(gx * gx + gz * gz + 1), 0, 1.2)
t = np.clip(h / max(1, h.max()), 0, 1)
col = np.stack([0.55 + 0.4 * t, 0.5 + 0.3 * t, 0.35 + 0.2 * t], -1) * 255 * (0.55 + 0.5 * shade[..., None])
col = np.where((h < 0)[..., None], np.array([40, 90, 130]) * (1 + np.clip(h, -40, 0)[..., None] / 80), col)
try:
    WL = load('WL'); wet = (~np.isnan(WL)) & (WL > h)
    col = np.where((wet & (h >= 0))[..., None], np.array([70, 150, 190]), col)
except Exception: pass
im = Image.fromarray(np.clip(col, 0, 255).astype(np.uint8))
if im.size[0] > 1024: im = im.resize((1024, 1024))
im.save(sys.argv[2]); print('saved', sys.argv[2], 'h', round(h.min(), 1), round(h.max(), 1))
