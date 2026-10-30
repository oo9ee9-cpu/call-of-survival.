# crop and compress the rendered pictures into the lobby's webp assets
import os, sys
from PIL import Image, ImageEnhance
SP = os.path.dirname(os.path.abspath(__file__)) + '/..'
S = lambda n: Image.open(f'{SP}/shots/ui_{n}.png').convert('RGB')
def out(img, name, w):
    h = round(img.height * w / img.width)
    img.resize((w, h), Image.LANCZOS).save(f'{SP}/assets/ui/{name}.webp', 'WEBP', quality=78, method=6)
    print(name, w, h, os.path.getsize(f'{SP}/assets/ui/{name}.webp'))
jobs = {
    'map_island': ('map_island', (0, 90, 960, 540), 560),
    'map_snow': ('map_snow', (0, 40, 960, 540), 560),
    'map_forest': ('map_forest', (0, 0, 960, 540), 560),
    'map_desert': ('map_desert', (0, 60, 960, 540), 560),
    'map_water': ('map_water', (0, 40, 960, 540), 560),
    'map_mega': ('map_mega', (60, 230, 900, 540), 560),
    'ban_maps': ('map_snow', (0, 60, 960, 480), 520),
    'ban_missions': ('ban_fight', (190, 222, 700, 436), 520),
    'ban_suit': ('ban_suit', (170, 0, 790, 271), 520),
}
for name, (src, box, w) in jobs.items():
    if len(sys.argv) > 1 and name not in sys.argv[1:]: continue
    try: im = S(src).crop(box)
    except FileNotFoundError: print('missing', src); continue
    if name == 'map_snow' or name == 'ban_maps': im = ImageEnhance.Brightness(im).enhance(0.9)
    if name == 'map_mega': im = ImageEnhance.Contrast(im).enhance(1.08)
    if name == 'ban_missions': im = ImageEnhance.Brightness(im).enhance(1.35)
    out(im, name, w)
