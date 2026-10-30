# ground cover sprites (grass, flowers, ferns, reeds, crops) drawn as RGBA cards → assets/veg/ground.webp (256 x 256*L strip)
import numpy as np, os, sys, math, random
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage
SP = os.path.join(os.path.dirname(__file__), '..'); OUTD = SP + '/assets/veg'
S = 512   # drawn at 2x, stored at 256
def new(): return Image.new('RGBA', (S, S), (0, 0, 0, 0))
def hsv(h, s, v, a=255):
    import colorsys; r, g, b = colorsys.hsv_to_rgb(h % 1, max(0, min(1, s)), max(0, min(1, v))); return (int(r * 255), int(g * 255), int(b * 255), a)
def blade(d, x0, y0, h, lean, w, col_base, col_tip, rs, curve=0.35, segs=10):
    pts_l, pts_r = [], []
    for k in range(segs + 1):
        t = k / segs; x = x0 + lean * h * (t + curve * t * t); y = y0 - h * t * (1 - 0.15 * t * t * abs(lean))
        ww = w * (1 - t) ** 0.9 + 0.4
        pts_l.append((x - ww, y)); pts_r.append((x + ww, y))
    for k in range(segs):
        t = (k + 0.5) / segs
        c = tuple(int(col_base[i] + (col_tip[i] - col_base[i]) * t) for i in range(3)) + (255,)
        d.polygon([pts_l[k], pts_r[k], pts_r[k + 1], pts_l[k + 1]], fill=c)
def grass_clump(rs, n=110, hmin=0.45, hmax=0.95, hue=(0.22, 0.30), sat=(0.45, 0.7), val=(0.35, 0.7), dry=0.0, heads=0.0, spread=0.42):
    im = new(); d = ImageDraw.Draw(im)
    order = sorted([rs.random() for _ in range(n)])
    for k in range(n):
        x0 = S * 0.5 + rs.gauss(0, S * spread * 0.45); h = S * rs.uniform(hmin, hmax); lean = rs.gauss(0, 0.32) + (x0 - S / 2) / S * 0.8
        hh = rs.uniform(*hue) - dry * rs.uniform(0.08, 0.14); ss = rs.uniform(*sat) * (1 - dry * 0.35); vv = rs.uniform(*val) * (1 + dry * 0.3)
        base = hsv(hh, ss, vv * 0.45); tip = hsv(hh + 0.01, ss * 0.85, min(1, vv * 1.15))
        blade(d, x0, S - 2, h, lean, rs.uniform(3.0, 6.5), base, tip, rs)
        if heads and rs.random() < heads:
            tx = x0 + lean * h * 1.3; ty = S - 2 - h * 0.98
            for j in range(9):
                jx = rs.gauss(0, 2); d.ellipse([tx - 3 + jx, ty - j * 6 - 4, tx + 3 + jx, ty - j * 6 + 4], fill=hsv(0.12, 0.35, 0.72))
    return im
def flowers(rs):
    im = grass_clump(rs, 80, 0.3, 0.75)
    d = ImageDraw.Draw(im)
    palette = [(250, 250, 245), (245, 220, 60), (190, 90, 210), (220, 40, 40), (250, 160, 200), (120, 140, 240)]
    for k in range(26):
        x = S * 0.5 + rs.gauss(0, S * 0.2); top = S - S * rs.uniform(0.35, 0.85)
        d.line([(x, S - 2), (x + rs.gauss(0, 10), top)], fill=hsv(0.27, 0.55, 0.4), width=3)
        c = rs.choice(palette); r = rs.uniform(7, 13)
        for p in range(6):
            a = p / 6 * 2 * math.pi; d.ellipse([x + math.cos(a) * r * 0.8 - r * 0.6, top + math.sin(a) * r * 0.8 - r * 0.6, x + math.cos(a) * r * 0.8 + r * 0.6, top + math.sin(a) * r * 0.8 + r * 0.6], fill=c + (255,))
        d.ellipse([x - r * 0.45, top - r * 0.45, x + r * 0.45, top + r * 0.45], fill=(240, 200, 40, 255) if c != (245, 220, 60) else (150, 90, 30, 255))
    return im
def cup_flowers(rs, n, col, rmin, rmax, centre, petals=5, grass=60):
    # a grassy clump with cup-shaped blossoms on thin stems (poppies, buttercups)
    im = grass_clump(rs, grass, 0.25, 0.65)
    d = ImageDraw.Draw(im)
    for k in range(n):
        x = S * 0.5 + rs.gauss(0, S * 0.2); top = S - S * rs.uniform(0.3, 0.8)
        d.line([(x, S - 2), (x + rs.gauss(0, 8), top)], fill=hsv(0.27, 0.5, 0.38), width=3)
        r = rs.uniform(rmin, rmax); g = rs.uniform(0.85, 1.08)
        c = tuple(min(255, int(v * g)) for v in col)
        for p in range(petals):
            a = p / petals * 2 * math.pi + rs.uniform(0, 0.6)
            d.ellipse([x + math.cos(a) * r * 0.55 - r * 0.62, top + math.sin(a) * r * 0.45 - r * 0.55, x + math.cos(a) * r * 0.55 + r * 0.62, top + math.sin(a) * r * 0.45 + r * 0.55], fill=c + (255,))
        d.ellipse([x - r * 0.3, top - r * 0.3, x + r * 0.3, top + r * 0.3], fill=centre + (255,))
    return im
def poppy(rs): return cup_flowers(rs, 18, (214, 36, 28), 11, 17, (30, 20, 22), petals=4)
def buttercup(rs): return cup_flowers(rs, 30, (246, 206, 34), 6, 9, (200, 150, 20), petals=5, grass=80)
def daisy(rs):
    im = grass_clump(rs, 70, 0.25, 0.6)
    d = ImageDraw.Draw(im)
    for k in range(22):
        x = S * 0.5 + rs.gauss(0, S * 0.2); top = S - S * rs.uniform(0.28, 0.7)
        d.line([(x, S - 2), (x + rs.gauss(0, 8), top)], fill=hsv(0.27, 0.5, 0.4), width=3)
        r = rs.uniform(9, 14)
        for p in range(14):
            a = p / 14 * 2 * math.pi
            d.line([(x, top), (x + math.cos(a) * r, top + math.sin(a) * r * 0.7)], fill=(248, 248, 244, 255), width=4)
        d.ellipse([x - r * 0.32, top - r * 0.26, x + r * 0.32, top + r * 0.26], fill=(242, 196, 30, 255))
    return im
def lavender(rs):
    im = new(); d = ImageDraw.Draw(im)
    for k in range(46):
        x0 = S * 0.5 + rs.gauss(0, S * 0.12); a = rs.gauss(0, 0.32); L = S * rs.uniform(0.45, 0.9)
        x1, y1 = x0 + math.sin(a) * L, S - 2 - math.cos(a) * L
        d.line([(x0, S - 2), (x1, y1)], fill=hsv(0.28, 0.22, rs.uniform(0.38, 0.55)), width=3)
        if rs.random() < 0.8:
            g = rs.uniform(0.8, 1.1)
            for j in range(11):
                t = 1 - j * 0.024; px, py = x0 + math.sin(a) * L * t, S - 2 - math.cos(a) * L * t
                rr = 4.2 - j * 0.15
                d.ellipse([px - rr, py - rr * 1.3, px + rr, py + rr * 1.3], fill=(int(132 * g), int(96 * g), int(196 * g), 255))
    for k in range(30):   # grey-green leaves at the base
        x0 = S * 0.5 + rs.gauss(0, S * 0.1)
        blade(d, x0, S - 2, S * rs.uniform(0.12, 0.3), rs.gauss(0, 0.6), 3, hsv(0.3, 0.25, 0.3), hsv(0.3, 0.2, 0.6), rs)
    return im
def fern(rs):
    im = new(); d = ImageDraw.Draw(im)
    for f in range(9):
        ang = math.radians(-70 + f * 17 + rs.gauss(0, 6)); L = S * rs.uniform(0.55, 0.85)
        pts = []
        for k in range(30):
            t = k / 29; a = ang + t * 0.5 * (1 if ang > 0 else -1)
            pts.append((S * 0.5 + math.sin(a) * L * t, S - 4 - math.cos(a) * L * t * (1 - 0.35 * t)))
        d.line(pts, fill=hsv(0.27, 0.6, 0.35), width=3)
        for k in range(2, 28):
            t = k / 29; x, y = pts[k]; px, py = pts[k - 1]; dx, dy = x - px, y - py; l = math.hypot(dx, dy) or 1; nx, ny = -dy / l, dx / l
            ll = (1 - t) * S * 0.09 + 6
            for side in (-1, 1):
                ex, ey = x + nx * ll * side + dx / l * ll * 0.3, y + ny * ll * side + dy / l * ll * 0.3
                d.polygon([(x, y), ((x + ex) / 2 + dx / l * 3, (y + ey) / 2 + dy / l * 3), (ex, ey), ((x + ex) / 2 - dx / l * 3, (y + ey) / 2 - dy / l * 3)], fill=hsv(0.26 + rs.gauss(0, 0.01), 0.62, rs.uniform(0.38, 0.6)))
    return im
def reeds(rs):
    im = grass_clump(rs, 40, 0.6, 0.98, hue=(0.18, 0.24), sat=(0.4, 0.55), val=(0.4, 0.6), spread=0.3)
    d = ImageDraw.Draw(im)
    for k in range(7):
        x = S * 0.5 + rs.gauss(0, S * 0.12); top = S * rs.uniform(0.05, 0.25)
        d.line([(x, S - 2), (x + rs.gauss(0, 6), top)], fill=hsv(0.2, 0.5, 0.45), width=4)
        d.rounded_rectangle([x - 7, top + 10, x + 7, top + 70], radius=7, fill=(72, 48, 32, 255))
    return im
def wheat(rs, barley=False):
    im = new(); d = ImageDraw.Draw(im)
    for k in range(34):
        x = S * 0.5 + rs.gauss(0, S * 0.2); h = S * rs.uniform(0.7, 0.96); lean = rs.gauss(0, 0.06)
        tx, ty = x + lean * h, S - h
        g = rs.uniform(0.85, 1.05)
        d.line([(x, S - 2), (tx, ty + 60)], fill=(int(190 * g), int(160 * g), int(80 * g), 255), width=3)
        for j in range(12):
            yy = ty + j * 5.5
            for side in (-1, 1):
                d.ellipse([tx + side * 3 - 3.5, yy - 4, tx + side * 3 + 3.5, yy + 4], fill=(int(215 * g), int(178 * g), int(92 * g), 255))
            if barley: d.line([(tx + rs.gauss(0, 1), yy), (tx + rs.gauss(0, 6) + lean * 40, yy - 40)], fill=(220, 190, 110, 255), width=1)
        if not barley: d.line([(tx, ty), (tx + lean * 20, ty - 14)], fill=(220, 190, 110, 255), width=1)
        if rs.random() < 0.6: blade(d, x, S - 2, h * 0.5, rs.gauss(0, 0.5), 3, (150, 140, 70), (200, 180, 100), rs)
    return im
def leaf_poly(d, x, y, ang, L, W, col, vein):
    # pointed oval leaf with a central vein
    ca, sa = math.cos(ang), math.sin(ang); pts = []
    for t in np.linspace(0, 1, 9):
        w = W * math.sin(t * math.pi) ** 0.8; pts.append((t * L, w))
    for t in np.linspace(1, 0, 9)[1:-1]:
        w = W * math.sin(t * math.pi) ** 0.8; pts.append((t * L, -w))
    P = [(x + px * ca - py * sa, y + px * sa + py * ca) for px, py in pts]
    d.polygon(P, fill=col)
    d.line([(x, y), (x + L * 0.92 * ca, y + L * 0.92 * sa)], fill=vein, width=2)
def leafy_rows(rs, tint=(0.27, 0.6, 0.45), dots=None, dotc=(200, 40, 30)):
    im = new(); d = ImageDraw.Draw(im)
    stems = [(S * 0.5 + rs.gauss(0, S * 0.2), S * rs.uniform(0.35, 0.62)) for _ in range(9)]
    for (sx, sh) in stems:
        top = S - sh
        d.line([(sx, S - 2), (sx + rs.gauss(0, 8), top)], fill=hsv(tint[0], tint[1] * 0.8, tint[2] * 0.55), width=4)
    for k in range(190):
        sx, sh = rs.choice(stems); t = rs.uniform(0.05, 1.0); x = sx + rs.gauss(0, 6); y = S - 2 - sh * t
        ang = rs.uniform(-math.pi, 0) if rs.random() < 0.8 else rs.uniform(0, math.pi)
        L = rs.uniform(30, 58) * (1.1 - 0.4 * t); W = L * rs.uniform(0.28, 0.4)
        v = rs.uniform(tint[2] * 0.6, tint[2] * 1.25) * (0.75 + 0.35 * t)
        leaf_poly(d, x, y, ang, L, W, hsv(tint[0] + rs.gauss(0, 0.012), tint[1], v), hsv(tint[0], tint[1] * 0.6, v * 1.3))
    if dots:
        for k in range(dots):
            sx, sh = rs.choice(stems); x = sx + rs.gauss(0, 18); y = S - 2 - sh * rs.uniform(0.15, 0.85); r = rs.uniform(7, 12)
            d.ellipse([x - r, y - r, x + r, y + r], fill=dotc + (255,))
            if dotc != (250, 250, 250): d.ellipse([x - r * 0.45, y - r * 0.7, x - r * 0.05, y - r * 0.3], fill=(255, 230, 220, 255)); d.line([(x, y - r), (x + 2, y - r - 6)], fill=(60, 110, 40, 255), width=2)
            else:
                for j in range(4): d.ellipse([x - r + rs.gauss(0, 3), y - r + rs.gauss(0, 3), x + r * 0.7 + rs.gauss(0, 3), y + r * 0.7 + rs.gauss(0, 3)], fill=(245, 245, 240, 255))
    return im
def corn(rs):
    im = new(); d = ImageDraw.Draw(im)
    for st in range(3):
        x = S * (0.28 + st * 0.22) + rs.gauss(0, 8); top = S * rs.uniform(0.02, 0.08)
        d.line([(x, S - 2), (x + rs.gauss(0, 4), top)], fill=(118, 146, 66, 255), width=9)
        for k in range(9):
            y = S - 26 - k * (S - top) / 10; side = 1 if (k + st) % 2 else -1; L = S * rs.uniform(0.26, 0.4)
            pts = [(x + side * L * t, y - L * 0.55 * math.sin(t * 1.9) + L * 0.6 * t * t) for t in np.linspace(0, 1, 16)]
            for j in range(15):
                w = 16 * (1 - j / 15) ** 0.6 + 2
                v = rs.uniform(0.46, 0.62)
                d.line([pts[j], pts[j + 1]], fill=hsv(0.235 + rs.gauss(0, 0.008), 0.62, v), width=int(w))
            d.line(pts, fill=hsv(0.2, 0.3, 0.75), width=1)
        for j in range(6): d.line([(x, top + 6), (x + rs.gauss(0, 14), top - 34 - rs.uniform(0, 12))], fill=(214, 190, 120, 255), width=2)
        ey = S * rs.uniform(0.42, 0.52)
        d.ellipse([x + 5, ey - 62, x + 30, ey + 18], fill=(146, 168, 84, 255)); d.ellipse([x + 9, ey - 70, x + 24, ey - 44], fill=(222, 198, 120, 255))
        for j in range(5): d.line([(x + 16, ey - 68), (x + 16 + rs.gauss(0, 7), ey - 92)], fill=(170, 110, 60, 255), width=2)
    return im
def sunflower(rs):
    im = new(); d = ImageDraw.Draw(im)
    for st in range(2):
        x = S * (0.33 + st * 0.34) + rs.gauss(0, 6); top = S * rs.uniform(0.14, 0.22)
        d.line([(x, S - 2), (x + rs.gauss(0, 3), top)], fill=(96, 126, 52, 255), width=11)
        for k in range(6):
            y = S - 50 - k * 62; side = 1 if (k + st) % 2 else -1
            L = rs.uniform(70, 96) * (1 - k * 0.07); ang = (-0.35 if side > 0 else math.pi + 0.35) + rs.gauss(0, 0.12)
            v = rs.uniform(0.38, 0.52)
            leaf_poly(d, x, y, ang, L, L * 0.42, hsv(0.25, 0.62, v), hsv(0.22, 0.4, v * 1.35))
        R = 58; cx, cy = x + 10, top + 6
        for ring in range(2):
            n = 26
            for p in range(n):
                a = (p + ring * 0.5) / n * 2 * math.pi; rr = R * (0.98 - ring * 0.1)
                px, py = cx + math.cos(a) * rr, cy + math.sin(a) * rr * 0.92
                g = rs.uniform(0.85, 1.05)
                leaf_poly(d, cx + math.cos(a) * R * 0.5, cy + math.sin(a) * R * 0.46, a, R * 0.62, 9, (int(250 * g), int(190 * g), int(28 * g), 255), (int(230 * g), int(160 * g), 20, 255))
        d.ellipse([cx - R * 0.56, cy - R * 0.52, cx + R * 0.56, cy + R * 0.52], fill=(86, 52, 24, 255))
        for j in range(140):
            a = j * 2.39996; r = R * 0.52 * math.sqrt(j / 140)
            d.ellipse([cx + math.cos(a) * r - 1.6, cy + math.sin(a) * r * 0.93 - 1.6, cx + math.cos(a) * r + 1.6, cy + math.sin(a) * r * 0.93 + 1.6], fill=(52, 30, 12, 255))
    return im
def cotton(rs): return leafy_rows(rs, (0.2, 0.42, 0.38), dots=34, dotc=(250, 250, 250))
def shrub(rs):
    im = new(); d = ImageDraw.Draw(im)
    for k in range(110):
        x0 = S * 0.5 + rs.gauss(0, 40); y0 = S - 2; a = rs.uniform(-1.3, 1.3); L = S * rs.uniform(0.25, 0.6)
        x1 = x0 + math.sin(a) * L; y1 = y0 - math.cos(a) * L * 0.8
        d.line([(x0, y0), (x1, y1)], fill=(110, 90, 65, 255), width=3)
        for j in range(5):
            t = rs.random(); bx = x0 + (x1 - x0) * t; by = y0 + (y1 - y0) * t; b2 = a + rs.gauss(0, 0.8)
            d.line([(bx, by), (bx + math.sin(b2) * 30, by - math.cos(b2) * 24)], fill=(130, 110, 80, 255), width=2)
            if rs.random() < 0.5: d.ellipse([bx - 5, by - 5, bx + 5, by + 5], fill=hsv(0.2, 0.35, 0.45))
    return im
def tundra(rs): return grass_clump(rs, 90, 0.18, 0.45, hue=(0.16, 0.22), sat=(0.2, 0.35), val=(0.45, 0.7), spread=0.5)
def beachgrass(rs): return grass_clump(rs, 60, 0.4, 0.9, hue=(0.17, 0.22), sat=(0.25, 0.45), val=(0.5, 0.75), spread=0.35)
rs = random.Random(42)
LAYERS = [
    ('grass', lambda: grass_clump(rs)),
    ('grass_tall', lambda: grass_clump(rs, 90, 0.55, 1.0, heads=0.25)),
    ('grass_dry', lambda: grass_clump(rs, 100, 0.4, 0.9, dry=1.0, heads=0.2)),
    ('flowers', lambda: flowers(rs)),
    ('fern', lambda: fern(rs)),
    ('reeds', lambda: reeds(rs)),
    ('wheat', lambda: wheat(rs)),
    ('barley', lambda: wheat(rs, True)),
    ('greens', lambda: leafy_rows(rs)),
    ('tomato', lambda: leafy_rows(rs, (0.29, 0.6, 0.35), dots=22)),
    ('cotton', lambda: cotton(rs)),
    ('sunflower', lambda: sunflower(rs)),
    ('corn', lambda: corn(rs)),
    ('shrub', lambda: shrub(rs)),
    ('tundra', lambda: tundra(rs)),
    ('beachgrass', lambda: beachgrass(rs)),
    ('poppy', lambda: poppy(rs)),
    ('lavender', lambda: lavender(rs)),
    ('daisy', lambda: daisy(rs)),
    ('buttercup', lambda: buttercup(rs)),
]
cards = []
for name, fn in LAYERS:
    im = fn().filter(ImageFilter.GaussianBlur(0.5)).resize((256, 256), Image.LANCZOS)
    a = np.asarray(im).copy()
    m = a[..., 3] > 8
    if not m.all():
        idx = ndimage.distance_transform_edt(~m, return_distances=False, return_indices=True); a[..., :3] = a[..., :3][idx[0], idx[1]]
    cards.append(a)
strip = np.concatenate(cards, 0)
Image.fromarray(strip, 'RGBA').save(OUTD + '/ground.webp', quality=90, method=6)
Image.fromarray(strip, 'RGBA').save(OUTD + '/ground.png', optimize=True)
open(OUTD + '/ground_layers.txt', 'w').write('\n'.join(n for n, f in LAYERS))
prev = Image.new('RGBA', (256 * 8, 512), (190, 200, 210, 255))
for k, c in enumerate(cards): prev.alpha_composite(Image.fromarray(c), ((k % 8) * 256, (k // 8) * 256))
prev.convert('RGB').save(SP + '/build/ground_prev.jpg', quality=88)
print(os.path.getsize(OUTD + '/ground.webp'), os.path.getsize(OUTD + '/ground.png'))
