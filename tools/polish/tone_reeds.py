# darken the orange cattail heads of the reeds layer (index 5) in ground.png; write png + webp
import sys, numpy as np
from PIL import Image
src, outd = sys.argv[1], sys.argv[2]
im = np.asarray(Image.open(src).convert('RGBA')).astype(np.float32) / 255.0
W = im.shape[1]; L = 5
lay = im[L * W:(L + 1) * W].copy(); rgb = lay[..., :3]
mx = rgb.max(-1); mn = rgb.min(-1); d = mx - mn + 1e-6
r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60.0
s = np.where(mx > 0, d / (mx + 1e-6), 0)
sel = ((h < 45) | (h > 340)) & (s > 0.35) & (mx > 0.2)
k = np.where(sel, 1.0, 0.0)[..., None]
# towards a dark, dull brown: keep the shading, drop the saturation
lum = (0.299 * r + 0.587 * g + 0.114 * b)[..., None]
brown = np.concatenate([lum * 0.95, lum * 0.68, lum * 0.45], -1) * 0.85
lay[..., :3] = rgb * (1 - k) + brown * k
im[L * W:(L + 1) * W] = lay
out = (np.clip(im, 0, 1) * 255 + 0.5).astype(np.uint8)
Image.fromarray(out, 'RGBA').save(outd + '/ground.png', optimize=True)
Image.fromarray(out, 'RGBA').save(outd + '/ground.webp', quality=88, method=6)
print('ok', int(sel.sum()), 'px')
