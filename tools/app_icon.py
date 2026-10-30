"""the Android app's icon: the sunrise over the planet's edge from the boot film, gold letters «CS» in front.
usage: python3 tools/app_icon.py [still.jpg]   (writes android/app/src/main/res/…)"""
import os, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
src = Image.open(sys.argv[1] if len(sys.argv) > 1 else os.path.join(R, 'game/assets/boot/still.jpg')).convert('RGB')
W = 1024
bg = src.crop((700, 20, 1280, 600)).resize((W, W), Image.LANCZOS)
vig = Image.new('L', (W, W), 0); d = ImageDraw.Draw(vig)
for i in range(60):
    r = W * (0.75 - i * 0.008); a = int(255 * (i / 60) ** 1.6)
    d.ellipse((W / 2 - r, W * 0.56 - r, W / 2 + r, W * 0.56 + r), fill=a)
vig = vig.filter(ImageFilter.GaussianBlur(40))
bg = Image.composite(bg, Image.new('RGB', (W, W), (6, 9, 14)), vig.point(lambda v: min(255, v + 70)))
font = '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf'
f = ImageFont.truetype(font, 400)
mask = Image.new('L', (W, W), 0); md = ImageDraw.Draw(mask)
bb = md.textbbox((0, 0), 'CS', font=f); tw, th = bb[2] - bb[0], bb[3] - bb[1]
x, y = (W - tw) / 2 - bb[0], W * 0.60 - th / 2 - bb[1]
md.text((x, y), 'CS', font=f, fill=255)
grad = Image.new('RGB', (W, W)); gd = ImageDraw.Draw(grad)
stops = [(0.0, (255, 250, 240)), (0.34, (246, 216, 142)), (0.58, (192, 138, 52)), (1.0, (122, 82, 26))]
top, bot = y + bb[1], y + bb[3]
for yy in range(W):
    t = min(1, max(0, (yy - top) / max(1, bot - top)))
    for k in range(len(stops) - 1):
        if stops[k][0] <= t <= stops[k + 1][0]:
            u = (t - stops[k][0]) / (stops[k + 1][0] - stops[k][0]); c = tuple(int(stops[k][1][j] + (stops[k + 1][1][j] - stops[k][1][j]) * u) for j in range(3)); break
    gd.line([(0, yy), (W, yy)], fill=c)
fg = Image.new('RGBA', (W, W), (0, 0, 0, 0))
fg.paste((0, 0, 0, 255), (0, 14), mask.filter(ImageFilter.GaussianBlur(18)).point(lambda v: int(v * 0.85)))
gold = grad.convert('RGBA'); gold.putalpha(mask); fg = Image.alpha_composite(fg, gold)
full = Image.alpha_composite(bg.convert('RGBA'), fg)
res = os.path.join(R, 'android/app/src/main/res')
os.makedirs(res + '/drawable-nodpi', exist_ok=True)
bg.resize((432, 432), Image.LANCZOS).save(res + '/drawable-nodpi/ic_bg.png')
fs = Image.new('RGBA', (W, W), (0, 0, 0, 0)); sm = fg.resize((int(W * 0.66), int(W * 0.66)), Image.LANCZOS); fs.paste(sm, (int(W * 0.17), int(W * 0.17)), sm)
fs.resize((432, 432), Image.LANCZOS).save(res + '/drawable-nodpi/ic_fg.png')
for dens, px in [('mdpi', 48), ('hdpi', 72), ('xhdpi', 96), ('xxhdpi', 144), ('xxxhdpi', 192)]:
    os.makedirs(f'{res}/mipmap-{dens}', exist_ok=True)
    im = full.resize((px, px), Image.LANCZOS)
    for name, shape in [('ic_launcher', 'r'), ('ic_launcher_round', 'c')]:
        m = Image.new('L', (px * 4, px * 4), 0); dd = ImageDraw.Draw(m)
        if shape == 'r': dd.rounded_rectangle((0, 0, px * 4 - 1, px * 4 - 1), radius=px * 0.8, fill=255)
        else: dd.ellipse((0, 0, px * 4 - 1, px * 4 - 1), fill=255)
        m = m.resize((px, px), Image.LANCZOS); out = Image.new('RGBA', (px, px), (0, 0, 0, 0)); out.paste(im, (0, 0), m)
        out.save(f'{res}/mipmap-{dens}/{name}.png')
if len(sys.argv) > 2: full.convert('RGB').resize((512, 512), Image.LANCZOS).save(sys.argv[2])
print('icon written')
