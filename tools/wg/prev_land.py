import numpy as np, sys
from PIL import Image, ImageDraw
from common import *
land = load('land0'); dIn = load('dIn'); dOut = load('dOut')
img = np.zeros((N, N, 3), np.uint8)
img[land] = (120, 160, 90); img[~land] = (40, 90, 140)
img[(~land) & (dOut < 200)] = (70, 140, 170)
img[land & (dIn < 60)] = (220, 200, 150)
im = Image.fromarray(img).resize((768, 768)); d = ImageDraw.Draw(im)
for k in range(-4000, 4001, 1000):
    p = (k + 4096) / 8192 * 768; d.line([(p, 0), (p, 768)], fill=(255, 255, 255, 60)); d.line([(0, p), (768, p)], fill=(255, 255, 255, 60))
im.save(OUT + '/prev_land.png')
