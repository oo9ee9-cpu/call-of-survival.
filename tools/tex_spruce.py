# paint a dense conifer branch (spruce/fir: short dark needles in combs along twigs) into layer 3 of the leaf atlas
import os, math, random
import numpy as np
from PIL import Image, ImageDraw
SP = os.path.join(os.path.dirname(__file__), '..')
OUTD = SP + '/assets/veg'
S = 4                      # supersampling
N = 512 * S
rnd = random.Random(7)
img = Image.new('RGBA', (N, N), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

def col(base, var=14, a=255):
    return tuple(max(0, min(255, int(c + rnd.uniform(-var, var)))) for c in base) + (a,)

DARK, MID, TIP, STEM = (34, 52, 26), (52, 76, 36), (88, 118, 52), (78, 58, 38)

def needles_along(p0, p1, length, density, side_angle, tipward):
    """short needles along a twig, both sides, leaning towards the tip"""
    x0, y0 = p0; x1, y1 = p1
    L = math.hypot(x1 - x0, y1 - y0); ux, uy = (x1 - x0) / L, (y1 - y0) / L
    n = int(L / density)
    for i in range(n):
        t = (i + rnd.random()) / n
        px, py = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
        ln = length * (0.55 + 0.45 * math.sin(min(1, t * 1.15 + 0.08) * math.pi)) * rnd.uniform(0.8, 1.15)
        for s in (-1, 1):
            a = side_angle * s + rnd.uniform(-0.25, 0.25)
            ca, sa = math.cos(a), math.sin(a)
            dx, dy = ux * ca - uy * sa, ux * sa + uy * ca
            # lean forward
            dx, dy = dx * (1 - tipward) + ux * tipward, dy * (1 - tipward) + uy * tipward
            m = math.hypot(dx, dy); dx, dy = dx / m, dy / m
            c = col(TIP if t > 0.82 and rnd.random() < 0.7 else (MID if rnd.random() < 0.45 else DARK), 10)
            d.line([(px, py), (px + dx * ln, py + dy * ln)], fill=c, width=max(2, int(S * 1.1)))
        # a few needles lying on top, pointing at the viewer (short dark dots)
        if rnd.random() < 0.5:
            r = S * 1.4; d.ellipse([px - r, py - r, px + r, py + r], fill=col(DARK, 8))

# main stem: from the attach point (bottom centre) to the tip, a gentle curve
stem = []
for k in range(41):
    t = k / 40
    stem.append((N * 0.5 + math.sin(t * 2.2) * N * 0.025, N * (0.985 - 0.93 * t)))
d.line(stem, fill=STEM + (255,), width=int(S * 3.2))
# side twigs alternate up the stem, shorter towards the tip, angled forward
k = 0; t = 0.1
while t < 0.93:
    i = int(t * 40); px, py = stem[i]
    side = 1 if k % 2 == 0 else -1
    span = (1 - t) * 0.55 + 0.12
    L = N * span * rnd.uniform(0.8, 1.0) * 0.68
    ang = -math.pi / 2 + side * rnd.uniform(0.95, 1.2)
    ex, ey = px + math.cos(ang) * L, py + math.sin(ang) * L * 0.8
    # twig with a slight droop at the end
    mx, my = (px + ex) / 2, (py + ey) / 2 - L * 0.05
    d.line([(px, py), (mx, my), (ex, ey)], fill=STEM + (255,), width=int(S * 1.6))
    needles_along((px, py), (mx, my), S * 13, S * 1.3, 1.05, 0.35)
    needles_along((mx, my), (ex, ey), S * 12, S * 1.3, 1.0, 0.4)
    # small second-order twigs
    for q in (0.3, 0.55, 0.78):
        bx, by = px + (ex - px) * q, py + (ey - py) * q
        a2 = ang + side * rnd.uniform(-0.9, -0.5) * (1 if rnd.random() < 0.5 else -1)
        l2 = L * rnd.uniform(0.25, 0.4)
        cx_, cy_ = bx + math.cos(a2) * l2, by + math.sin(a2) * l2
        d.line([(bx, by), (cx_, cy_)], fill=STEM + (255,), width=int(S * 1.0))
        needles_along((bx, by), (cx_, cy_), S * 10, S * 1.5, 1.0, 0.4)
    k += 1; t += rnd.uniform(0.045, 0.06)
needles_along(stem[2], stem[-1], S * 12, S * 1.5, 1.1, 0.3)
small = img.resize((512, 512), Image.LANCZOS)
a = np.array(small)
# keep colour under transparent pixels close to the needles (no dark halos when mipmapped)
alpha = a[..., 3:4].astype(np.float32) / 255
rgb = a[..., :3].astype(np.float32)
avg = (rgb * alpha).sum((0, 1)) / max(1, alpha.sum())
a[..., :3] = np.where(alpha > 0.02, rgb, avg).astype(np.uint8)
strip = np.array(Image.open(OUTD + '/leaves.png').convert('RGBA'))
strip[3 * 512:4 * 512] = a
Image.fromarray(strip, 'RGBA').save(OUTD + '/leaves.webp', quality=88, method=6)
Image.fromarray(strip, 'RGBA').save(OUTD + '/leaves.png', optimize=True)
prev = Image.new('RGBA', (512, 512), (90, 120, 160, 255)); prev.alpha_composite(Image.fromarray(a, 'RGBA'))
prev.convert('RGB').save(SP + '/../leaf_spruce_prev.png')
print('ok', os.path.getsize(OUTD + '/leaves.webp'))
