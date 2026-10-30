# vegetation textures: bark array strip, leaf array strip (with alpha), palm frond, grass/crop card atlas
import numpy as np, os, sys, math, random
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage
sys.path.insert(0, os.path.dirname(__file__))
from texlib import *
SP = os.path.join(os.path.dirname(__file__), '..')
OUTD = SP + '/assets/veg'; os.makedirs(OUTD, exist_ok=True)
EZ = SP + '/dl/ez-tree/src/app/public/textures'
B = 512

def bleed(rgba):
    """push colour into transparent texels so filtering never pulls in black fringes"""
    a = rgba[..., 3] > 8; rgb = rgba[..., :3].astype(np.float64)
    if a.all(): return rgba
    idx = ndimage.distance_transform_edt(~a, return_distances=False, return_indices=True)
    out = rgba.copy(); out[..., :3] = rgb[idx[0], idx[1]].astype(np.uint8); return out

# ---- bark array: oak, ash, pine, birch, cedar, moss, olive, dead
BARKS = [('oak', 'Bark001'), ('ash', 'Bark002'), ('pine', 'Bark004'), ('birch', 'Bark007'), ('cedar', 'Bark014'), ('moss', 'Bark013'), ('olive', 'Bark012'), ('dead', 'Bark003'), ('palm', 'Bark015')]
alb, nrm = [], []
for name, folder in BARKS:
    c = Image.open(f'{EZ}/bark/{folder}_1K-JPG/{folder}_1K-JPG_Color.jpg').convert('RGB').resize((B, B), Image.LANCZOS)
    n = Image.open(f'{EZ}/bark/{folder}_1K-JPG/{folder}_1K-JPG_NormalGL.jpg').convert('RGB').resize((B, B), Image.LANCZOS)
    ca = np.asarray(c).astype(np.float64) / 255
    if name == 'dead': l = lum(ca)[..., None]; ca = np.clip(l * 0.9 + (ca - l) * 0.25, 0, 1) * np.array([1.0, 0.97, 0.92])
    if name == 'birch': ca = np.clip(ca * 1.12, 0, 1)
    alb.append((ca * 255).astype(np.uint8)); nrm.append(np.asarray(n))
Image.fromarray(np.concatenate(alb, 0)).save(OUTD + '/bark_albedo.jpg', quality=85, optimize=True)
Image.fromarray(np.concatenate(nrm, 0)).save(OUTD + '/bark_normal.jpg', quality=82, optimize=True)
open(OUTD + '/bark_layers.txt', 'w').write('\n'.join(n for n, f in BARKS))

# ---- palm frond texture (drawn): a curved rachis with long leaflets
def palm_frond(S=1024, seed=1):
    rs = random.Random(seed); im = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    pts = [(S * 0.5 + math.sin(t * 1.2) * S * 0.03, S * (1 - t)) for t in np.linspace(0.0, 0.98, 60)]
    for k in range(len(pts) - 1):
        t = k / len(pts); w = (1 - t) * S * 0.012 + 2
        d.line([pts[k], pts[k + 1]], fill=(120, 110, 60, 255), width=int(w))
    for k in range(4, len(pts) - 2):
        t = k / len(pts); L = S * (0.36 * math.sin(min(1, t * 1.15) * math.pi) ** 0.7 + 0.05) * (1 - t * 0.35)
        x, y = pts[k]
        for side in (-1, 1):
            ang = math.radians(rs.uniform(52, 64)) * side
            ex = x + math.sin(ang) * L; ey = y - math.cos(ang) * L * 0.55 + L * 0.18
            wv = S * 0.012 * (1 - t * 0.4)
            nx, ny = -(ey - y), (ex - x); nl = math.hypot(nx, ny) or 1; nx, ny = nx / nl * wv, ny / nl * wv
            g = rs.uniform(0.75, 1.05); col = (int(70 * g), int(118 * g), int(42 * g), 255)
            mx, my = (x + ex) / 2 + nx * 0.3, (y + ey) / 2 + ny * 0.3
            d.polygon([(x, y), (mx + nx, my + ny), (ex, ey), (mx - nx, my - ny)], fill=col)
            d.line([(x, y), (ex, ey)], fill=(int(96 * g), int(130 * g), int(60 * g), 255), width=2)
            if rs.random() < 0.35: d.line([((x + ex * 3) / 4, (y + ey * 3) / 4), (ex, ey)], fill=(150, 130, 70, 255), width=3)
    im = im.filter(ImageFilter.GaussianBlur(0.6))
    return im
# ---- leaf array: oak, ash, aspen, pine, palm
leaves = []
for n in ('oak', 'ash', 'aspen', 'pine'):
    im = Image.open(f'{EZ}/leaves/{n}.png').convert('RGBA').resize((B, B), Image.LANCZOS)
    leaves.append(bleed(np.asarray(im).copy()))
pf = palm_frond(1024).resize((B, B), Image.LANCZOS); leaves.append(bleed(np.asarray(pf).copy()))
strip = np.concatenate(leaves, 0)
Image.fromarray(strip, 'RGBA').save(OUTD + '/leaves.webp', quality=88, method=6)
Image.fromarray(strip, 'RGBA').save(OUTD + '/leaves.png', optimize=True)
open(OUTD + '/leaf_layers.txt', 'w').write('oak\nash\naspen\npine\npalm')
for f in sorted(os.listdir(OUTD)): print(f, os.path.getsize(OUTD + '/' + f))
