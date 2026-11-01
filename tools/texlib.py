# texture helpers: tileable conversion, image quilting, normal maps, simple procedural layers
import numpy as np
from PIL import Image
from scipy import ndimage

def load(path, size=None):
    im = Image.open(path).convert('RGB')
    if size: im = im.resize((size, size), Image.LANCZOS)
    return np.asarray(im).astype(np.float64) / 255.0

def save(arr, path, quality=88):
    im = Image.fromarray(np.clip(arr * 255 + 0.5, 0, 255).astype(np.uint8))
    if path.endswith('.png'): im.save(path, optimize=True)
    else: im.save(path, quality=quality, optimize=True)

def tileable(img, edge=0.22):
    """offset-blend: the seams of the half-shifted copy hide in the middle where the original wins"""
    H, W = img.shape[:2]
    sh = np.roll(np.roll(img, H // 2, 0), W // 2, 1)
    y = np.abs(np.linspace(-1, 1, H))[:, None]; x = np.abs(np.linspace(-1, 1, W))[None, :]
    m = np.clip((1 - np.maximum(x, y)) / edge, 0, 1)
    m = m * m * (3 - 2 * m)
    # break the square look of the blend with noise
    n = ndimage.gaussian_filter(np.random.RandomState(3).rand(H, W), H / 40)
    n = (n - n.mean()) / (n.std() + 1e-9)
    m = np.clip(m + 0.25 * n * m * (1 - m) * 4, 0, 1)
    return img * m[..., None] + sh * (1 - m[..., None]) if img.ndim == 3 else img * m + sh * (1 - m)

def quilt(src, out=512, patch=72, overlap=20, seed=1, weight=None, tries=600):
    """Efros-Freeman image quilting with toroidal wrap so the result tiles"""
    rs = np.random.RandomState(seed)
    H, W = src.shape[:2]; step = patch - overlap
    n = int(np.ceil(out / step)); S = n * step
    dst = np.zeros((S + overlap, S + overlap, 3)); filled = np.zeros((S + overlap, S + overlap), bool)
    cand = []
    for t in range(tries):
        y = rs.randint(0, H - patch); x = rs.randint(0, W - patch)
        if weight is not None and weight[y:y + patch, x:x + patch].mean() < 0.5: continue
        cand.append((y, x))
    cand = np.array(cand)
    def err_of(p, oy, ox):
        e = 0.0
        reg = dst[oy:oy + patch, ox:ox + patch]; fm = filled[oy:oy + patch, ox:ox + patch]
        d = ((p - reg) ** 2).sum(-1)
        return (d * fm).sum() / max(1, fm.sum()), d
    for i in range(n):
        for j in range(n):
            oy, ox = i * step, j * step
            best = None
            sub = cand[rs.choice(len(cand), min(120, len(cand)), replace=False)]
            for (y, x) in sub:
                p = src[y:y + patch, x:x + patch]
                e, d = err_of(p, oy, ox)
                if best is None or e < best[0]: best = (e, p, d)
            e, p, d = best
            mask = np.ones((patch, patch), bool)
            fm = filled[oy:oy + patch, ox:ox + patch]
            # vertical seam on the left overlap
            if j > 0:
                E = d[:, :overlap].copy()
                for r in range(1, patch):
                    prev = np.minimum(np.minimum(np.r_[1e9, E[r - 1, :-1]], E[r - 1]), np.r_[E[r - 1, 1:], 1e9]); E[r] += prev
                c = int(np.argmin(E[-1]))
                for r in range(patch - 1, -1, -1):
                    mask[r, :c] = False
                    if r > 0:
                        lo, hi = max(0, c - 1), min(overlap, c + 2); c = lo + int(np.argmin(E[r - 1, lo:hi]))
            if i > 0:
                E = d[:overlap, :].T.copy()
                for r in range(1, patch):
                    prev = np.minimum(np.minimum(np.r_[1e9, E[r - 1, :-1]], E[r - 1]), np.r_[E[r - 1, 1:], 1e9]); E[r] += prev
                c = int(np.argmin(E[-1]))
                for r in range(patch - 1, -1, -1):
                    mask[:c, r] = False
                    if r > 0:
                        lo, hi = max(0, c - 1), min(overlap, c + 2); c = lo + int(np.argmin(E[r - 1, lo:hi]))
            mask |= ~fm
            reg = dst[oy:oy + patch, ox:ox + patch]
            reg[mask] = p[mask]; filled[oy:oy + patch, ox:ox + patch] = True
    res = dst[:S, :S]
    # wrap: the strip beyond S overlapped the start; blend it back for continuity
    res = tileable(res, 0.12)
    return np.asarray(Image.fromarray((np.clip(res, 0, 1) * 255).astype(np.uint8)).resize((out, out), Image.LANCZOS)).astype(np.float64) / 255

def lum(img): return img[..., 0] * 0.299 + img[..., 1] * 0.587 + img[..., 2] * 0.114

def normal_from_height(hgt, strength=2.0):
    """height in 0..1 → tangent-space normal (OpenGL convention, +Y up in the image = −row)"""
    gx = (np.roll(hgt, -1, 1) - np.roll(hgt, 1, 1)) * 0.5
    gy = (np.roll(hgt, -1, 0) - np.roll(hgt, 1, 0)) * 0.5
    nx = -gx * strength * hgt.shape[1] / 64; ny = gy * strength * hgt.shape[0] / 64; nz = np.ones_like(hgt)
    l = np.sqrt(nx * nx + ny * ny + nz * nz)
    return np.dstack([nx / l * 0.5 + 0.5, ny / l * 0.5 + 0.5, nz / l * 0.5 + 0.5])

def height_from_albedo(img, blur=1.2, detail=0.6):
    l = lum(img); lo = ndimage.gaussian_filter(l, blur); big = ndimage.gaussian_filter(l, 12)
    hgt = (lo - big) * detail + 0.5
    return np.clip((hgt - hgt.min()) / (hgt.max() - hgt.min() + 1e-9), 0, 1)

def fbm_tile(S, octaves=6, base=4, seed=0, gain=0.5):
    """tileable value-noise fbm (periodic grid)"""
    rs = np.random.RandomState(seed); out = np.zeros((S, S)); amp = 1.0; tot = 0
    for o in range(octaves):
        f = base * (2 ** o); g = rs.rand(f, f)
        # periodic bicubic-ish upsample via Fourier-free zoom with wrap
        gg = np.tile(g, (3, 3)); z = ndimage.zoom(gg, S / f, order=3)[S:2 * S, S:2 * S]
        out += amp * z; tot += amp; amp *= gain
    out /= tot; return (out - out.min()) / (out.max() - out.min() + 1e-9)

def match_tone(img, mean_lum, sat=1.0, tint=None):
    l = lum(img); m = l.mean() + 1e-9
    out = img * (mean_lum / m)
    if sat != 1.0:
        l2 = lum(out)[..., None]; out = l2 + (out - l2) * sat
    if tint is not None: out = out * np.array(tint)[None, None, :]
    return np.clip(out, 0, 1)

def scatter(base, sprites, count, size_range, seed=0, tints=None, shadow=0.35, rot=True):
    """paste RGBA sprites at random spots with wrap-around (tileable), drop shadows under them"""
    rs = np.random.RandomState(seed); S = base.shape[0]; out = base.copy()
    for k in range(count):
        sp = sprites[rs.randint(len(sprites))]
        s = int(rs.uniform(*size_range)); im = sp.resize((s, s), Image.LANCZOS)
        if rot: im = im.rotate(rs.uniform(0, 360), resample=Image.BICUBIC, expand=False)
        a = np.asarray(im).astype(np.float64) / 255.0
        rgb, al = a[..., :3], a[..., 3:4]
        if tints is not None: rgb = rgb * np.array(tints[rs.randint(len(tints))])[None, None, :] * rs.uniform(0.8, 1.15)
        x = rs.randint(0, S); y = rs.randint(0, S)
        ys = (np.arange(s) + y) % S; xs = (np.arange(s) + x) % S
        reg = out[np.ix_(ys, xs)]
        if shadow > 0:
            sh = ndimage.gaussian_filter(al[..., 0], s / 30 + 0.5)
            sh = np.roll(np.roll(sh, 2, 0), 2, 1)[..., None]
            reg = reg * (1 - shadow * sh)
        reg = reg * (1 - al) + rgb * al
        out[np.ix_(ys, xs)] = reg
    return out
