import sys
from PIL import Image, ImageDraw
# wide contact sheet: python3 tools/wsheet.py out.jpg [--w 640] [--cols 2] files...
args = sys.argv[1:]
out = args.pop(0)
W, cols = 640, 2
while args and args[0].startswith('--'):
    k, v = args.pop(0), args.pop(0)
    if k == '--w': W = int(v)
    if k == '--cols': cols = int(v)
ims = []
for f in args:
    try:
        im = Image.open(f).convert('RGB')
    except Exception:
        im = Image.new('RGB', (W, W // 2), (90, 0, 0))
    h = round(im.size[1] * W / im.size[0])
    ims.append((f.split('/')[-1], im.resize((W, h), Image.LANCZOS)))
H = max(i.size[1] for _, i in ims)
rows = (len(ims) + cols - 1) // cols
S = Image.new('RGB', (cols * W + (cols - 1) * 4, rows * (H + 18)), (24, 24, 24))
d = ImageDraw.Draw(S)
for k, (n, im) in enumerate(ims):
    x, y = (k % cols) * (W + 4), (k // cols) * (H + 18)
    S.paste(im, (x, y + 18)); d.text((x + 4, y + 3), n, fill=(255, 230, 0))
S.save(out, quality=86)
print(out, S.size)
