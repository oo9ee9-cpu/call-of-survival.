#!/usr/bin/env python3
"""Call of Survival - the lobby's logo: the emblem (a compass over a crossed axe and shovel) above «CALL OF SURVIVAL» and
«نداء البقاء», cut in weathered stone with bevelled edges, a dark rim and a soft shadow.
usage: python3 logo.py <project_dir> <latin_bold.ttf> <arabic_bold.ttf>
(the Arabic face is Vazirmatn Bold from fonts/, saved as TTF; the Latin one DejaVu Sans Condensed Bold)"""
import math
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageChops
from scipy import ndimage

PROJ, LATIN, ARABIC = sys.argv[1], sys.argv[2], sys.argv[3]
W, H = 1520, 956          # drawn at 4x the shown size (380 x 239), saved at 2x
rng = np.random.default_rng(7)


def noise(shape, scale, octaves=5):
    """value noise: random grids blown up and summed"""
    h, w = shape
    out = np.zeros(shape, np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        gh, gw = max(2, int(h / scale) + 2), max(2, int(w / scale) + 2)
        g = rng.random((gh, gw)).astype(np.float32)
        im = Image.fromarray((g * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
        out += np.asarray(im, np.float32) / 255.0 * amp
        tot += amp
        amp *= 0.5
        scale /= 2.0
    return out / tot


def bevel(mask, width, light=(-0.55, -0.65, 0.52)):
    """height from the distance to the edge, lit from the top left: 0..1 shade"""
    m = mask > 127
    d = ndimage.distance_transform_edt(m).astype(np.float32)
    hgt = np.clip(d / width, 0, 1)
    hgt = np.sin(hgt * math.pi / 2)
    hgt = ndimage.gaussian_filter(hgt, 1.2)
    gy, gx = np.gradient(hgt)
    k = width * 0.9
    n = np.dstack([-gx * k, -gy * k, np.ones_like(hgt)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    L = np.array(light, np.float32)
    L /= np.linalg.norm(L)
    sh = np.clip((n @ L), 0, 1)
    return sh, m


def stone(shape, base, var=26, cracks=True):
    h, w = shape
    n1 = noise(shape, 90)
    n2 = noise(shape, 14, 3)
    col = np.zeros((h, w, 3), np.float32)
    for c in range(3):
        col[..., c] = base[c] + (n1 - 0.5) * var * 1.6 + (n2 - 0.5) * var
    if cracks:
        cr = noise(shape, 40, 4)
        line = np.abs(cr - 0.5) < 0.012
        pits = noise(shape, 6, 2) > 0.8
        dark = ndimage.binary_dilation(line, iterations=1) | pits
        col[dark] *= 0.55
    return col


def finish(mask, base, bevel_w, rim=10, shade_lo=0.38):
    """stone letters: bevel shade over the texture, a dark rim round them; returns RGBA"""
    sh, m = bevel(mask, bevel_w)
    col = stone(mask.shape, base)
    lit = col * (shade_lo + (1.0 - shade_lo) * sh[..., None] * 1.25)
    # a little light along the top edges, darker toward the bottom of each letter
    lit = np.clip(lit, 0, 255)
    rgba = np.zeros(mask.shape + (4,), np.uint8)
    rim_m = ndimage.binary_dilation(m, iterations=rim)
    rgba[rim_m] = (34, 26, 20, 255)
    rgba[m, :3] = lit[m].astype(np.uint8)
    rgba[m, 3] = 255
    out = Image.fromarray(rgba, 'RGBA')
    # the rim's own bevel: a lighter line round its outer edge at the top
    return out


def text_mask(text, font_path, size, squeeze=1.0, rtl=False):
    f = ImageFont.truetype(font_path, size, layout_engine=ImageFont.Layout.RAQM)
    kw = {'direction': 'rtl', 'language': 'ar'} if rtl else {}
    box = f.getbbox(text, **kw)
    w, h = box[2] - box[0] + 40, box[3] - box[1] + 40
    im = Image.new('L', (w, h), 0)
    ImageDraw.Draw(im).text((20 - box[0], 20 - box[1]), text, font=f, fill=255, **kw)
    if squeeze != 1.0:
        im = im.resize((int(w * squeeze), h), Image.LANCZOS)
    return im


def fit(im, max_w):
    if im.width > max_w:
        im = im.resize((max_w, int(im.height * max_w / im.width)), Image.LANCZOS)
    return im


def shadow(canvas, layer, at, off=(10, 14), blur=10, alpha=0.65):
    a = layer.split()[3]
    sh = Image.new('RGBA', layer.size, (0, 0, 0, 0))
    sh.putalpha(a.point(lambda v: int(v * alpha)))
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    canvas.alpha_composite(sh, (at[0] + off[0], at[1] + off[1]))


# ------------------------------------------------------------------ the emblem
def emblem(size=560):
    S = size
    out = Image.new('RGBA', (S, S), (0, 0, 0, 0))

    def layer_from(draw_fn):
        m = Image.new('L', (S, S), 0)
        draw_fn(ImageDraw.Draw(m))
        return m

    def tool(angle, head):
        # a wooden handle and a steel head, drawn upright then turned
        cx = S / 2
        hm = layer_from(lambda d: d.rounded_rectangle([cx - 14, S * 0.08, cx + 14, S * 1.0], 12, fill=255))
        if head == 'axe':
            def hd(d):
                # the eye round the handle and the blade out to the left, its edge curved
                d.rounded_rectangle([cx - 24, S * 0.07, cx + 28, S * 0.25], 8, fill=255)
                d.polygon([(cx - 20, S * 0.10), (cx - 20, S * 0.23), (cx - 104, S * 0.33), (cx - 132, S * 0.24),
                           (cx - 140, S * 0.15), (cx - 130, S * 0.05), (cx - 104, S * -0.02)], fill=255)
        else:
            def hd(d):
                # a spade: the point away from the handle, square shoulders, the socket
                d.polygon([(cx, S * -0.02), (cx + 52, S * 0.05), (cx + 70, S * 0.16), (cx + 64, S * 0.27),
                           (cx - 64, S * 0.27), (cx - 70, S * 0.16), (cx - 52, S * 0.05)], fill=255)
                d.rounded_rectangle([cx - 20, S * 0.25, cx + 20, S * 0.38], 6, fill=255)
        hdm = layer_from(hd)
        res = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        wood_sh, wm = bevel(np.asarray(hm), 9)
        wood = stone((S, S), (120, 78, 44), var=30, cracks=False)
        grain = noise((S, S), 6, 2)
        wood *= (0.82 + 0.3 * grain)[..., None]
        wl = np.clip(wood * (0.45 + 0.75 * wood_sh[..., None]), 0, 255)
        a = np.zeros((S, S, 4), np.uint8)
        rim = ndimage.binary_dilation(wm, iterations=5)
        a[rim] = (30, 22, 16, 255)
        a[wm, :3] = wl[wm].astype(np.uint8)
        a[wm, 3] = 255
        res.alpha_composite(Image.fromarray(a, 'RGBA'))
        st_sh, sm = bevel(np.asarray(hdm), 14)
        steel = stone((S, S), (150, 152, 156), var=22, cracks=False)
        sl = np.clip(steel * (0.4 + 0.95 * st_sh[..., None]), 0, 255)
        b = np.zeros((S, S, 4), np.uint8)
        rim = ndimage.binary_dilation(sm, iterations=5)
        b[rim] = (26, 26, 28, 255)
        b[sm, :3] = sl[sm].astype(np.uint8)
        b[sm, 3] = 255
        res.alpha_composite(Image.fromarray(b, 'RGBA'))
        return res.rotate(angle, resample=Image.BICUBIC, center=(S / 2, S * 0.56))

    out.alpha_composite(tool(46, 'axe'))
    out.alpha_composite(tool(-46, 'shovel'))
    # the compass: a brass ring, a cream face, the needle
    cx, cy, r = S / 2, S * 0.56, S * 0.25
    ring = layer_from(lambda d: d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=255))
    sh, m = bevel(np.asarray(ring), 22)
    brass = stone((S, S), (176, 132, 70), var=26, cracks=False)
    bl = np.clip(brass * (0.42 + 0.95 * sh[..., None]), 0, 255)
    a = np.zeros((S, S, 4), np.uint8)
    rim = ndimage.binary_dilation(m, iterations=6)
    a[rim] = (36, 26, 14, 255)
    a[m, :3] = bl[m].astype(np.uint8)
    a[m, 3] = 255
    out.alpha_composite(Image.fromarray(a, 'RGBA'))
    # the bow on top
    bow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    bd = ImageDraw.Draw(bow)
    bd.ellipse([cx - 26, cy - r - 46, cx + 26, cy - r + 6], outline=(150, 112, 58, 255), width=12)
    out.alpha_composite(bow)
    face = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    fd = ImageDraw.Draw(face)
    fr = r * 0.78
    fd.ellipse([cx - fr, cy - fr, cx + fr, cy + fr], fill=(232, 222, 196, 255))
    for k in range(32):
        a_ = k / 32 * math.tau
        l = 0.16 if k % 8 == 0 else 0.07
        fd.line([(cx + math.cos(a_) * fr * (0.94 - l), cy + math.sin(a_) * fr * (0.94 - l)),
                 (cx + math.cos(a_) * fr * 0.94, cy + math.sin(a_) * fr * 0.94)], fill=(60, 50, 40, 255), width=5 if k % 8 == 0 else 3)
    try:
        f = ImageFont.truetype(LATIN, int(fr * 0.26))
        for t, (dx, dy) in (('N', (0, -0.62)), ('E', (0.62, 0)), ('S', (0, 0.62)), ('W', (-0.62, 0))):
            fd.text((cx + dx * fr, cy + dy * fr), t, font=f, fill=(50, 40, 32, 255), anchor='mm')
    except OSError:
        pass
    nl = fr * 0.86
    fd.polygon([(cx, cy - nl), (cx + fr * 0.13, cy), (cx - fr * 0.13, cy)], fill=(196, 40, 30, 255))
    fd.polygon([(cx, cy + nl), (cx + fr * 0.13, cy), (cx - fr * 0.13, cy)], fill=(40, 44, 50, 255))
    fd.ellipse([cx - 13, cy - 13, cx + 13, cy + 13], fill=(170, 130, 70, 255))
    # glass: a soft highlight across the top
    gl = Image.new('L', (S, S), 0)
    ImageDraw.Draw(gl).ellipse([cx - fr * 0.8, cy - fr * 0.92, cx + fr * 0.5, cy - fr * 0.1], fill=70)
    gl = gl.filter(ImageFilter.GaussianBlur(14))
    face = Image.composite(Image.new('RGBA', (S, S), (255, 255, 255, 255)), face, gl.point(lambda v: v))
    out.alpha_composite(face)
    return out


def main():
    canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    em = emblem(560)
    em = em.resize((400, 400), Image.LANCZOS)
    shadow(canvas, em, ((W - 400) // 2, -6), off=(8, 12), blur=8, alpha=0.6)
    canvas.alpha_composite(em, ((W - 400) // 2, -6))
    # the English line
    en = fit(text_mask('CALL OF SURVIVAL', LATIN, 230, squeeze=0.86), W - 70)
    en_rgba = finish(np.asarray(en), (204, 198, 186), bevel_w=13, rim=11)
    y_en = 362
    shadow(canvas, en_rgba, ((W - en.width) // 2, y_en))
    canvas.alpha_composite(en_rgba, ((W - en.width) // 2, y_en))
    # the Arabic line, bigger
    ar = fit(text_mask('نداء البقاء', ARABIC, 330, rtl=True), W - 110)
    ar_rgba = finish(np.asarray(ar), (200, 192, 178), bevel_w=15, rim=12)
    y_ar = H - ar.height - 8
    shadow(canvas, ar_rgba, ((W - ar.width) // 2, y_ar))
    canvas.alpha_composite(ar_rgba, ((W - ar.width) // 2, y_ar))
    bb = canvas.getbbox()
    print('logo box', bb, 'en', en.size, 'ar', ar.size)
    canvas = canvas.resize((W // 2, H // 2), Image.LANCZOS)
    canvas.save(PROJ + '/textures/ui/logo.png')
    em.resize((256, 256), Image.LANCZOS).save(PROJ + '/textures/ui/icons/emblem.png')
    print('saved logo', canvas.size)


main()
