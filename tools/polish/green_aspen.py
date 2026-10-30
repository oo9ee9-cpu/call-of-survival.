# turn the golden aspen leaf layer (index 2) of leaves.png into a fresh summer green, keep alpha; write png + webp
import sys, numpy as np
from PIL import Image
src, outd = sys.argv[1], sys.argv[2]
im = np.asarray(Image.open(src).convert('RGBA')).astype(np.float32) / 255.0
W = im.shape[1]; L = 2
lay = im[L * W:(L + 1) * W].copy()
rgb = lay[..., :3]
mx = rgb.max(-1); mn = rgb.min(-1); d = mx - mn + 1e-6
r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60.0
s = np.where(mx > 0, d / (mx + 1e-6), 0); v = mx
# golden/orange leaves (hue 15..70) → green 88..105 depending on the original hue; slightly less bright and saturated
sel = (h > 10) & (h < 75)
nh = np.where(sel, 82 + (h - 15) * 0.38, h)
ns = np.where(sel, np.clip(s * 0.78, 0, 1), s)
nv = np.where(sel, v * 0.72, v)
c = nv * ns; x = c * (1 - np.abs((nh / 60.0) % 2 - 1)); m = nv - c
hi = (nh // 60).astype(int) % 6
z = np.zeros_like(c)
R = np.select([hi == 0, hi == 1, hi == 2, hi == 3, hi == 4, hi == 5], [c, x, z, z, x, c])
G = np.select([hi == 0, hi == 1, hi == 2, hi == 3, hi == 4, hi == 5], [x, c, c, x, z, z])
B = np.select([hi == 0, hi == 1, hi == 2, hi == 3, hi == 4, hi == 5], [z, z, x, c, c, x])
lay[..., 0] = R + m; lay[..., 1] = G + m; lay[..., 2] = B + m
im[L * W:(L + 1) * W] = lay
out = (np.clip(im, 0, 1) * 255 + 0.5).astype(np.uint8)
Image.fromarray(out, 'RGBA').save(outd + '/leaves.png', optimize=True)
Image.fromarray(out, 'RGBA').save(outd + '/leaves.webp', quality=88, method=6)
print('ok', out.shape)
