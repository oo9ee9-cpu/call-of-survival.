"""lobby map cards from the card shots: assets/ui/map_<id>.webp (560x350, the card is 16:10) and the maps banner (520x228, the new maps side by side)
usage: python3 tools/make_cards.py snow forest desert water mega"""
import sys
from PIL import Image, ImageDraw, ImageFilter

maps = sys.argv[1:] or ['snow', 'forest', 'desert', 'water', 'mega']
cards = {}
for m in maps:
    src = Image.open(f'shots/card_{m}_1.png').convert('RGB')
    w, h = src.size
    # 560x350 (16:10 like the card) from the middle band
    tw, th = 560, 350
    s = max(tw / w, th / h)
    im = src.resize((round(w * s), round(h * s)), Image.LANCZOS)
    left, top = (im.size[0] - tw) // 2, (im.size[1] - th) // 2
    im = im.crop((left, top, left + tw, top + th))
    im.save(f'assets/ui/map_{m}.webp', quality=82, method=6)
    cards[m] = im
    print('card', m, im.size)

# the banner: slanted slices of every new map, side by side
BW, BH = 520, 228
ban = Image.new('RGB', (BW, BH), (20, 28, 34))
n = len(maps); slant = 26
seam = lambda k, y: 0 if k == 0 else BW if k == n else k * BW / n + slant / 2 - slant * y / BH
for i, m in enumerate(maps):
    im = cards[m]
    sc = BH / im.size[1]
    im = im.resize((round(im.size[0] * sc), BH), Image.LANCZOS)
    cx = (seam(i, BH / 2) + seam(i + 1, BH / 2)) / 2
    layer = Image.new('RGB', (BW, BH)); layer.paste(im, (round(cx - im.size[0] / 2), 0))
    mask = Image.new('L', (BW, BH), 0)
    ImageDraw.Draw(mask).polygon([(seam(i, 0), 0), (seam(i + 1, 0), 0), (seam(i + 1, BH), BH), (seam(i, BH), BH)], fill=255)
    ban.paste(layer, (0, 0), mask)
d = ImageDraw.Draw(ban)
for k in range(1, n): d.line([(seam(k, 0), 0), (seam(k, BH), BH)], fill=(255, 214, 120), width=2)
ban.save('assets/ui/ban_maps.webp', quality=84, method=6)
print('banner', ban.size)
