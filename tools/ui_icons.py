#!/usr/bin/env python3
"""Call of Survival - the lobby's and the HUD's icons, drawn at 4x and scaled down (smooth edges): white shapes the
game tints (and a few coloured ones: the coin, the gem, the ticket, the logo's emblem).
usage: python3 ui_icons.py <project_dir>"""
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFilter

OUT = sys.argv[1] + '/textures/ui/icons'
os.makedirs(OUT, exist_ok=True)
S = 512          # drawing size; saved at 128
W = (255, 255, 255, 255)


def canvas():
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    return im, ImageDraw.Draw(im)


def save(name, im, size=128, shadow=True):
    if shadow:
        a = im.split()[3].filter(ImageFilter.GaussianBlur(10))
        sh = Image.new('RGBA', im.size, (0, 0, 0, 0))
        sh.putalpha(a.point(lambda v: int(v * 0.45)))
        base = Image.new('RGBA', im.size, (0, 0, 0, 0))
        base.alpha_composite(sh, (6, 10))
        base.alpha_composite(im)
        im = base
    im.resize((size, size), Image.LANCZOS).save(OUT + '/' + name + '.png')
    print('icon', name)


def P(*pts):
    return [(x * S, y * S) for x, y in pts]


def rr(d, box, r, **kw):
    d.rounded_rectangle([v * S for v in box], radius=r * S, **kw)


def circle(d, cx, cy, r, **kw):
    d.ellipse([(cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S], **kw)


def line(d, pts, w, fill=W):
    d.line(P(*pts), fill=fill, width=int(w * S), joint='curve')
    for p in (pts[0], pts[-1]):
        circle(d, p[0], p[1], w / 2, fill=fill)


# ---------------------------------------------------------------- lobby
def gear():
    im, d = canvas()
    n = 9
    pts = []
    for i in range(n * 4):
        a = i / (n * 4) * math.tau
        r = 0.42 if (i % 4) in (1, 2) else 0.33
        pts.append((0.5 + math.cos(a) * r, 0.5 + math.sin(a) * r))
    d.polygon(P(*pts), fill=W)
    circle(d, 0.5, 0.5, 0.13, fill=(0, 0, 0, 0))
    return im


def mail():
    im, d = canvas()
    rr(d, (0.12, 0.24, 0.88, 0.76), 0.05, fill=W)
    d.line(P((0.15, 0.28), (0.5, 0.55), (0.85, 0.28)), fill=(0, 0, 0, 0), width=int(0.06 * S))
    return im


def coin():
    im, d = canvas()
    circle(d, 0.5, 0.5, 0.42, fill=(150, 95, 20, 255))
    circle(d, 0.5, 0.48, 0.4, fill=(242, 190, 60, 255))
    circle(d, 0.5, 0.48, 0.3, fill=(255, 214, 92, 255), outline=(190, 130, 30, 255), width=int(0.025 * S))
    d.polygon(P((0.5, 0.3), (0.56, 0.44), (0.7, 0.46), (0.59, 0.55), (0.62, 0.69), (0.5, 0.61), (0.38, 0.69), (0.41, 0.55), (0.3, 0.46), (0.44, 0.44)), fill=(205, 145, 35, 255))
    return im


def gem():
    im, d = canvas()
    d.polygon(P((0.5, 0.88), (0.12, 0.38), (0.28, 0.16), (0.72, 0.16), (0.88, 0.38)), fill=(40, 150, 230, 255))
    d.polygon(P((0.5, 0.88), (0.12, 0.38), (0.88, 0.38)), fill=(25, 110, 200, 255))
    d.polygon(P((0.28, 0.16), (0.5, 0.38), (0.72, 0.16)), fill=(140, 210, 255, 255))
    d.polygon(P((0.36, 0.38), (0.5, 0.86), (0.64, 0.38)), fill=(60, 170, 245, 255))
    return im


def ticket():
    im, d = canvas()
    rr(d, (0.1, 0.25, 0.9, 0.75), 0.06, fill=(225, 160, 80, 255))
    circle(d, 0.1, 0.5, 0.08, fill=(0, 0, 0, 0))
    circle(d, 0.9, 0.5, 0.08, fill=(0, 0, 0, 0))
    for k in range(5):
        circle(d, 0.68, 0.32 + k * 0.09, 0.018, fill=(150, 90, 30, 255))
    d.polygon(P((0.36, 0.36), (0.4, 0.46), (0.5, 0.47), (0.42, 0.53), (0.45, 0.63), (0.36, 0.57), (0.27, 0.63), (0.3, 0.53), (0.22, 0.47), (0.32, 0.46)), fill=(150, 90, 30, 255))
    return im


def crate():
    im, d = canvas()
    d.polygon(P((0.5, 0.12), (0.88, 0.3), (0.5, 0.48), (0.12, 0.3)), fill=(235, 190, 110, 255))
    d.polygon(P((0.12, 0.3), (0.5, 0.48), (0.5, 0.9), (0.12, 0.72)), fill=(200, 140, 60, 255))
    d.polygon(P((0.88, 0.3), (0.5, 0.48), (0.5, 0.9), (0.88, 0.72)), fill=(170, 110, 45, 255))
    d.line(P((0.3, 0.39), (0.3, 0.81)), fill=(120, 70, 25, 255), width=int(0.04 * S))
    d.line(P((0.7, 0.39), (0.7, 0.81)), fill=(110, 65, 22, 255), width=int(0.04 * S))
    return im


def shop():
    im, d = canvas()
    d.polygon(P((0.12, 0.35), (0.2, 0.15), (0.8, 0.15), (0.88, 0.35)), fill=(235, 90, 60, 255))
    for k in range(4):
        x0 = 0.12 + k * 0.19
        d.chord([x0 * S, 0.25 * S, (x0 + 0.19) * S, 0.45 * S], 0, 180, fill=(235, 90, 60, 255) if k % 2 == 0 else (250, 240, 230, 255))
    rr(d, (0.16, 0.42, 0.84, 0.86), 0.03, fill=(240, 220, 190, 255))
    rr(d, (0.24, 0.52, 0.44, 0.86), 0.02, fill=(150, 90, 50, 255))
    rr(d, (0.52, 0.52, 0.76, 0.7), 0.02, fill=(110, 170, 210, 255))
    return im


def pass_card():
    im, d = canvas()
    rr(d, (0.2, 0.08, 0.8, 0.92), 0.06, fill=(245, 230, 200, 255))
    rr(d, (0.26, 0.14, 0.74, 0.5), 0.04, fill=(70, 80, 60, 255))
    d.text((0.34 * S, 0.17 * S), 'WP', fill=(240, 220, 160, 255), font=None)
    for k in range(3):
        rr(d, (0.28, 0.58 + k * 0.1, 0.72, 0.63 + k * 0.1), 0.02, fill=(150, 130, 90, 255))
    return im


def friends():
    im, d = canvas()
    circle(d, 0.36, 0.32, 0.13, fill=W)
    d.chord([0.12 * S, 0.5 * S, 0.6 * S, 1.1 * S], 180, 360, fill=W)
    circle(d, 0.68, 0.36, 0.11, fill=(255, 255, 255, 200))
    d.chord([0.5 * S, 0.54 * S, 0.9 * S, 1.06 * S], 180, 360, fill=(255, 255, 255, 200))
    return im


def chat():
    im, d = canvas()
    rr(d, (0.12, 0.18, 0.88, 0.7), 0.1, fill=W)
    d.polygon(P((0.3, 0.66), (0.26, 0.86), (0.48, 0.68)), fill=W)
    for k in range(3):
        circle(d, 0.33 + k * 0.17, 0.44, 0.045, fill=(0, 0, 0, 0))
    return im


def flag():
    im, d = canvas()
    d.rectangle([0.2 * S, 0.1 * S, 0.26 * S, 0.9 * S], fill=W)
    d.polygon(P((0.26, 0.12), (0.84, 0.22), (0.66, 0.36), (0.84, 0.5), (0.26, 0.5)), fill=W)
    return im


def missions():
    im, d = canvas()
    rr(d, (0.2, 0.14, 0.8, 0.9), 0.05, fill=W)
    rr(d, (0.36, 0.08, 0.64, 0.2), 0.03, fill=W)
    for k in range(3):
        y = 0.36 + k * 0.17
        d.line(P((0.3, y), (0.36, y + 0.05), (0.46, y - 0.05)), fill=(0, 0, 0, 0), width=int(0.04 * S))
        d.line(P((0.52, y), (0.72, y)), fill=(0, 0, 0, 0), width=int(0.04 * S))
    return im


def events():
    im, d = canvas()
    rr(d, (0.14, 0.4, 0.86, 0.88), 0.04, fill=W)
    rr(d, (0.1, 0.28, 0.9, 0.42), 0.03, fill=W)
    d.rectangle([0.46 * S, 0.28 * S, 0.54 * S, 0.88 * S], fill=(0, 0, 0, 0))
    d.ellipse([0.28 * S, 0.1 * S, 0.5 * S, 0.3 * S], outline=W, width=int(0.05 * S))
    d.ellipse([0.5 * S, 0.1 * S, 0.72 * S, 0.3 * S], outline=W, width=int(0.05 * S))
    return im


def players():
    im, d = canvas()
    for k, (x, s) in enumerate(((0.3, 0.8), (0.7, 0.8), (0.5, 1.0))):
        circle(d, x, 0.36, 0.11 * s, fill=W)
        d.chord([(x - 0.2 * s) * S, 0.52 * S, (x + 0.2 * s) * S, (0.52 + 0.5 * s) * S], 180, 360, fill=W)
    return im


def trophy():
    im, d = canvas()
    d.chord([0.24 * S, -0.1 * S, 0.76 * S, 0.62 * S], 0, 180, fill=W)
    d.arc([0.08 * S, 0.12 * S, 0.34 * S, 0.42 * S], 90, 270, fill=W, width=int(0.05 * S))
    d.arc([0.66 * S, 0.12 * S, 0.92 * S, 0.42 * S], 270, 90, fill=W, width=int(0.05 * S))
    d.rectangle([0.45 * S, 0.6 * S, 0.55 * S, 0.76 * S], fill=W)
    rr(d, (0.3, 0.76, 0.7, 0.88), 0.02, fill=W)
    return im


def medal():
    im, d = canvas()
    d.polygon(P((0.3, 0.08), (0.44, 0.08), (0.56, 0.42), (0.42, 0.42)), fill=W)
    d.polygon(P((0.56, 0.08), (0.7, 0.08), (0.58, 0.42), (0.44, 0.42)), fill=(255, 255, 255, 190))
    circle(d, 0.5, 0.64, 0.24, fill=W)
    d.polygon(P((0.5, 0.48), (0.55, 0.6), (0.68, 0.61), (0.58, 0.69), (0.61, 0.81), (0.5, 0.74), (0.39, 0.81), (0.42, 0.69), (0.32, 0.61), (0.45, 0.6)), fill=(0, 0, 0, 0))
    return im


def backpack():
    im, d = canvas()
    rr(d, (0.22, 0.2, 0.78, 0.9), 0.12, fill=W)
    d.arc([0.34 * S, 0.06 * S, 0.66 * S, 0.34 * S], 180, 360, fill=W, width=int(0.05 * S))
    rr(d, (0.32, 0.56, 0.68, 0.78), 0.04, fill=(0, 0, 0, 0))
    rr(d, (0.36, 0.6, 0.64, 0.74), 0.03, fill=W)
    d.line(P((0.3, 0.44), (0.7, 0.44)), fill=(0, 0, 0, 0), width=int(0.035 * S))
    return im


def book():
    im, d = canvas()
    d.polygon(P((0.1, 0.22), (0.48, 0.3), (0.48, 0.86), (0.1, 0.78)), fill=W)
    d.polygon(P((0.9, 0.22), (0.52, 0.3), (0.52, 0.86), (0.9, 0.78)), fill=W)
    return im


def tutorial():
    # a little board with lines of writing and a pointer (the lobby's «Tutorial» tiles)
    im, d = canvas()
    rr(d, (0.08, 0.14, 0.92, 0.72), 0.05, outline=W, width=int(0.06 * S))
    for k, w in enumerate((0.5, 0.36, 0.44)):
        d.line(P((0.2, 0.3 + k * 0.13), (0.2 + w, 0.3 + k * 0.13)), fill=W, width=int(0.05 * S))
    d.line(P((0.5, 0.72), (0.5, 0.86)), fill=W, width=int(0.05 * S))
    d.line(P((0.3, 0.88), (0.7, 0.88)), fill=W, width=int(0.06 * S))
    d.polygon(P((0.7, 0.5), (0.9, 0.62), (0.81, 0.65), (0.88, 0.76), (0.83, 0.79), (0.76, 0.68), (0.7, 0.74)), fill=W)
    return im


def map_icon():
    im, d = canvas()
    d.polygon(P((0.1, 0.22), (0.37, 0.12), (0.63, 0.22), (0.9, 0.12), (0.9, 0.78), (0.63, 0.88), (0.37, 0.78), (0.1, 0.88)), fill=W)
    d.line(P((0.37, 0.12), (0.37, 0.78)), fill=(0, 0, 0, 0), width=int(0.03 * S))
    d.line(P((0.63, 0.22), (0.63, 0.88)), fill=(0, 0, 0, 0), width=int(0.03 * S))
    return im


def close():
    im, d = canvas()
    line(d, [(0.25, 0.25), (0.75, 0.75)], 0.1)
    line(d, [(0.75, 0.25), (0.25, 0.75)], 0.1)
    return im


def back():
    im, d = canvas()
    line(d, [(0.62, 0.2), (0.32, 0.5), (0.62, 0.8)], 0.1)
    return im


def plane():
    im, d = canvas()
    d.polygon(P((0.5, 0.06), (0.56, 0.16), (0.56, 0.4), (0.92, 0.58), (0.92, 0.66), (0.56, 0.56), (0.56, 0.78), (0.66, 0.86), (0.66, 0.92), (0.5, 0.88), (0.34, 0.92), (0.34, 0.86), (0.44, 0.78), (0.44, 0.56), (0.08, 0.66), (0.08, 0.58), (0.44, 0.4), (0.44, 0.16)), fill=W)
    return im


# ---------------------------------------------------------------- HUD
def bullet():
    im, d = canvas()
    d.chord([0.38 * S, 0.06 * S, 0.62 * S, 0.5 * S], 180, 360, fill=W)
    d.rectangle([0.38 * S, 0.27 * S, 0.62 * S, 0.74 * S], fill=W)
    rr(d, (0.34, 0.76, 0.66, 0.92), 0.02, fill=W)
    d.line(P((0.38, 0.52), (0.62, 0.52)), fill=(0, 0, 0, 0), width=int(0.02 * S))
    return im


def scope():
    im, d = canvas()
    circle(d, 0.5, 0.5, 0.36, outline=W, width=int(0.06 * S))
    circle(d, 0.5, 0.5, 0.06, fill=W)
    for a, b in (((0.5, 0.06), (0.5, 0.3)), ((0.5, 0.7), (0.5, 0.94)), ((0.06, 0.5), (0.3, 0.5)), ((0.7, 0.5), (0.94, 0.5))):
        line(d, [a, b], 0.05)
    return im


def rifle():
    im, d = canvas()
    d.polygon(P((0.04, 0.44), (0.62, 0.44), (0.66, 0.4), (0.96, 0.4), (0.96, 0.46), (0.7, 0.48), (0.66, 0.54), (0.36, 0.54), (0.32, 0.7), (0.24, 0.7), (0.26, 0.54), (0.14, 0.56), (0.04, 0.6)), fill=W)
    d.polygon(P((0.44, 0.54), (0.5, 0.54), (0.54, 0.72), (0.46, 0.72)), fill=W)
    return im


def person(pose):
    im, d = canvas()
    if pose == 'stand':
        circle(d, 0.5, 0.14, 0.08, fill=W)
        line(d, [(0.5, 0.25), (0.5, 0.56)], 0.12)
        line(d, [(0.5, 0.56), (0.38, 0.92)], 0.1)
        line(d, [(0.5, 0.56), (0.62, 0.92)], 0.1)
        line(d, [(0.5, 0.3), (0.34, 0.5)], 0.08)
        line(d, [(0.5, 0.3), (0.68, 0.46)], 0.08)
    elif pose == 'crouch':
        circle(d, 0.44, 0.26, 0.08, fill=W)
        line(d, [(0.46, 0.36), (0.56, 0.62)], 0.12)
        line(d, [(0.56, 0.62), (0.36, 0.72), (0.36, 0.9)], 0.1)
        line(d, [(0.56, 0.62), (0.7, 0.9)], 0.1)
        line(d, [(0.48, 0.42), (0.7, 0.48)], 0.08)
    else:  # prone
        circle(d, 0.18, 0.6, 0.08, fill=W)
        line(d, [(0.28, 0.66), (0.62, 0.7)], 0.12)
        line(d, [(0.62, 0.7), (0.94, 0.74)], 0.1)
        line(d, [(0.3, 0.64), (0.12, 0.8)], 0.08)
    return im


def arrow_up():
    im, d = canvas()
    d.polygon(P((0.5, 0.1), (0.86, 0.5), (0.62, 0.5), (0.62, 0.88), (0.38, 0.88), (0.38, 0.5), (0.14, 0.5)), fill=W)
    return im


def reload_icon():
    im, d = canvas()
    d.arc([0.16 * S, 0.16 * S, 0.84 * S, 0.84 * S], 40, 330, fill=W, width=int(0.09 * S))
    d.polygon(P((0.82, 0.12), (0.88, 0.46), (0.56, 0.32)), fill=W)
    return im


def heal():
    im, d = canvas()
    rr(d, (0.4, 0.14, 0.6, 0.86), 0.04, fill=W)
    rr(d, (0.14, 0.4, 0.86, 0.6), 0.04, fill=W)
    return im


def hand():
    im, d = canvas()
    rr(d, (0.26, 0.42, 0.74, 0.9), 0.14, fill=W)
    for k, h in enumerate((0.2, 0.12, 0.14, 0.24)):
        rr(d, (0.27 + k * 0.12, h, 0.37 + k * 0.12, 0.6), 0.05, fill=W)
    rr(d, (0.08, 0.46, 0.3, 0.58), 0.05, fill=W)
    return im


def lamp():
    im, d = canvas()
    d.polygon(P((0.1, 0.36), (0.42, 0.36), (0.66, 0.14), (0.66, 0.86), (0.42, 0.64), (0.1, 0.64)), fill=W)
    for a in (-0.35, 0.0, 0.35):
        line(d, [(0.74, 0.5 + a * 0.3), (0.92, 0.5 + a * 0.75)], 0.04)
    return im


def mode_icon():
    im, d = canvas()
    for k in range(3):
        rr(d, (0.18 + k * 0.24, 0.2, 0.3 + k * 0.24, 0.8), 0.03, fill=W)
    return im


def eye():
    im, d = canvas()
    d.chord([0.06 * S, 0.24 * S, 0.94 * S, 1.0 * S], 180, 360, fill=W)
    d.chord([0.06 * S, 0.0 * S, 0.94 * S, 0.76 * S], 0, 180, fill=W)
    circle(d, 0.5, 0.5, 0.16, fill=(0, 0, 0, 0))
    circle(d, 0.5, 0.5, 0.08, fill=W)
    return im


def no_sign():
    im, d = canvas()
    circle(d, 0.5, 0.5, 0.4, outline=(230, 40, 40, 255), width=int(0.1 * S))
    d.line(P((0.22, 0.22), (0.78, 0.78)), fill=(230, 40, 40, 255), width=int(0.1 * S))
    return im


def grenade():
    im, d = canvas()
    circle(d, 0.48, 0.6, 0.3, fill=W)
    rr(d, (0.38, 0.2, 0.6, 0.36), 0.03, fill=W)
    d.arc([0.52 * S, 0.1 * S, 0.84 * S, 0.42 * S], 180, 90, fill=W, width=int(0.04 * S))
    return im


def emblem():
    """the logo's emblem: a brass compass with an axe and a shovel crossed behind it"""
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    steel = (150, 152, 150, 255)
    wood = (120, 75, 40, 255)
    # the shovel (left to right, up) and the axe (right to left, up)
    d.line(P((0.18, 0.86), (0.78, 0.26)), fill=wood, width=int(0.05 * S))
    d.polygon(P((0.74, 0.16), (0.92, 0.06), (0.86, 0.28), (0.8, 0.32), (0.7, 0.24)), fill=steel)
    d.line(P((0.82, 0.86), (0.24, 0.24)), fill=wood, width=int(0.05 * S))
    d.polygon(P((0.3, 0.2), (0.12, 0.08), (0.06, 0.26), (0.2, 0.36)), fill=steel)
    # the compass
    circle(d, 0.5, 0.52, 0.27, fill=(90, 60, 25, 255))
    circle(d, 0.5, 0.52, 0.25, fill=(196, 150, 70, 255))
    circle(d, 0.5, 0.52, 0.2, fill=(235, 225, 200, 255))
    for k in range(16):
        a = k / 16 * math.tau
        r1 = 0.17 if k % 4 else 0.13
        d.line(P((0.5 + math.cos(a) * r1, 0.52 + math.sin(a) * r1), (0.5 + math.cos(a) * 0.19, 0.52 + math.sin(a) * 0.19)), fill=(80, 60, 40, 255), width=int(0.008 * S))
    d.polygon(P((0.5, 0.34), (0.54, 0.52), (0.46, 0.52)), fill=(200, 40, 35, 255))
    d.polygon(P((0.5, 0.7), (0.54, 0.52), (0.46, 0.52)), fill=(60, 60, 65, 255))
    circle(d, 0.5, 0.52, 0.02, fill=(196, 150, 70, 255))
    circle(d, 0.5, 0.235, 0.035, outline=(196, 150, 70, 255), width=int(0.015 * S))
    return im


for name, fn in [('gear', gear), ('mail', mail), ('crate', crate), ('shop', shop), ('pass', pass_card), ('friends', friends),
                 ('chat', chat), ('flag', flag), ('missions', missions), ('events', events), ('players', players), ('trophy', trophy),
                 ('medal', medal), ('backpack', backpack), ('book', book), ('map', map_icon), ('close', close), ('back', back),
                 ('plane', plane), ('bullet', bullet), ('scope', scope), ('rifle', rifle), ('jump', arrow_up), ('reload', reload_icon),
                 ('heal', heal), ('hand', hand), ('lamp', lamp), ('mode', mode_icon), ('eye', eye), ('grenade', grenade),
                 ('tutorial', tutorial)]:
    save(name, fn())
save('stand', person('stand'))
save('crouch', person('crouch'))
save('prone', person('prone'))
for name, fn in [('coin', coin), ('gem', gem), ('ticket', ticket), ('no', no_sign)]:
    save(name, fn(), 96)
save('emblem', emblem(), 256)
