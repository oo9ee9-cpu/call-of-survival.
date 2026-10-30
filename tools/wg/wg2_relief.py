# stage 2: relief per region (before erosion)
import numpy as np
from scipy import ndimage
from common import *
land = load('land0'); dIn = load('dIn'); dOut = load('dOut')
WX = fbm(X / 1300 + 9.1, Z / 1300 - 2.2, 4, seed=51) * 420
WZ = fbm(X / 1300 - 4.4, Z / 1300 + 6.6, 4, seed=52) * 420
def soft(cx, cz, rx, rz, rot=0.0, edge=0.5):
    c, s = np.cos(rot), np.sin(rot); dx = X + WX - cx; dz = Z + WZ - cz
    u = (dx * c + dz * s) / rx; v = (-dx * s + dz * c) / rz
    return smooth(0, edge, 1 - np.sqrt(u * u + v * v))
def spine_dist(pts):
    d = np.full(X.shape, 1e9); tpar = np.zeros(X.shape); acc = 0.0; L = 0.0
    segs = list(zip(pts[:-1], pts[1:])); total = sum(np.hypot(b[0] - a[0], b[1] - a[1]) for a, b in segs)
    for a, b in segs:
        ax, az = a; bx, bz = b; dx, dz = bx - ax, bz - az; l2 = dx * dx + dz * dz; l = np.sqrt(l2)
        t = np.clip(((X - ax) * dx + (Z - az) * dz) / l2, 0, 1); dd = np.hypot(X - ax - dx * t, Z - az - dz * t)
        m = dd < d; d = np.where(m, dd, d); tpar = np.where(m, (acc + t * l) / total, tpar); acc += l
    return d, tpar
# ---- regions (soft masks 0..1)
R = {}
R['city'] = soft(0, -2850, 1500, 900)
R['ne'] = soft(2250, -2550, 1250, 800, -0.6)
R['forest'] = soft(-150, -350, 1500, 1350)
R['farm'] = soft(-2300, -700, 1250, 1900, 0.12)
R['desert'] = soft(-1950, 2150, 1900, 1150, 0.62)
R['swamp'] = soft(650, 2350, 1250, 820, -0.15)
R['tropic'] = soft(3320, 2300, 720, 980, 0.2)
R['nwisles'] = soft(-3250, -3200, 1000, 900)
spine = [(2350, -2350), (2150, -1350), (2300, -300), (2050, 700), (1700, 1600)]
dS, tS = spine_dist(spine)
R['mount'] = np.exp(-(np.maximum(0, dS + 160 * fbm(X / 800, Z / 800, 3, seed=54)) / 820) ** 2)
for k, v in R.items(): save('R_' + k, v.astype(np.float32))
# ---- relief
base = 3 + 34 * (1 - np.exp(-dIn / 520))
h = base.copy()
n1 = fbm(X / 1100, Z / 1100, 5, seed=31)          # rolling hills
n2 = fbm(X / 380, Z / 380, 4, seed=32)
rid = ridged(X / 1500 + 7.1, Z / 1500 - 3.3, 6, seed=33)
# rolling hills everywhere inland, quieter on farmland, the swamp and the city coast
calm = np.clip(R['farm'] * 0.85 + R['swamp'] + R['city'] * 0.6 + R['desert'] * 0.7, 0, 1)
inl = smooth(80, 900, dIn)
h += (1 - calm) * inl * (22 * (n1 * 0.5 + 0.5) + 16 * ridged(X / 650 + 2.2, Z / 650 + 8.8, 4, seed=55) + 6 * n2)
# central forest: hills
h += R['forest'] * (35 + 70 * (n1 * 0.5 + 0.5) + 14 * n2)
# north-east highlands: a plateau with knolls
h += R['ne'] * (110 + 70 * (n1 * 0.5 + 0.5) + 30 * ridged(X / 600, Z / 600, 4, seed=34))
# the eastern range: peaks along the spine
peaks = 0.45 + 0.55 * smooth(-0.35, 0.45, fbm(X / 950 + 1.7, Z / 950 - 0.4, 3, seed=53))
mnt = R['mount'] * (90 + peaks * 470 * rid + 25 * n2)
h += mnt
# farmland: almost flat, gentle long swells
h = h * (1 - R['farm'] * 0.55) + R['farm'] * (12 + 10 * fbm(X / 2600, Z / 2600, 3, seed=35))
# desert: transverse dunes and a few mesas
ang = 0.5; u = X * np.cos(ang) + Z * np.sin(ang); wv = fbm(X / 900, Z / 900, 3, seed=36) * 3.0
lam = 70 + 45 * (fbm(X / 1800, Z / 1800, 2, seed=56) * 0.5 + 0.5)
ph = u / lam + wv + 0.8 * fbm(X / 260, Z / 260, 3, seed=57)
dunes = (1 - np.abs(np.sin(ph))) ** 1.8 * (6 + 16 * (fbm(X / 1400, Z / 1400, 3, seed=37) * 0.5 + 0.5)) * smooth(-0.2, 0.3, fbm(X / 500, Z / 500, 3, seed=58))
mesa_n = fbm(X / 700 + 3, Z / 700 - 1, 4, seed=38) * 0.5 + 0.5
mesas = smooth(0.62, 0.66, mesa_n) * 34 + smooth(0.72, 0.75, mesa_n) * 22
h = h * (1 - R['desert'] * 0.6) + R['desert'] * (16 + dunes * (1 - smooth(0.55, 0.62, mesa_n)) + mesas)
# swamp: flat lowland with hummocks
h = h * (1 - R['swamp'] * 0.92) + R['swamp'] * (1.6 + 1.2 * fbm(X / 260, Z / 260, 4, seed=39))
# city coast: gentle slope up from the harbour
h = h * (1 - R['city'] * 0.65) + R['city'] * (2.5 + dIn * 0.022 + 5 * n2)
# tropical island: a central volcanic hill
h += R['tropic'] * (np.exp(-(((X - 3380) / 380) ** 2 + ((Z - 2150) / 420) ** 2)) * 95 + 6 * n2)
# north-west isles: rocky knolls and cliffs
h += R['nwisles'] * (25 + 55 * ridged(X / 500, Z / 500, 4, seed=40))
# coastal cliffs along the mountains and highlands
cliffy = np.clip(R['mount'] * 1.4 + R['ne'] + R['nwisles'], 0, 1) * smooth(0.45, 0.6, fbm(X / 1600, Z / 1600, 3, seed=41) * 0.5 + 0.5)
h = np.where(land, h * (1 - cliffy * (1 - smooth(0, 90, dIn))) + cliffy * (1 - smooth(0, 90, dIn)) * np.maximum(h, 18 * smooth(0, 25, dIn)), h)
# beaches: blend to a low shore inside the first 60 m
beach = 1 - smooth(0, 70 + 60 * (fbm(X / 500, Z / 500, 2, seed=42) * 0.5 + 0.5), dIn)
h = np.where(land, h * (1 - beach * (1 - cliffy)) + beach * (1 - cliffy) * (0.5 + dIn * 0.035), h)
# the sea floor
sea = -(1.5 + 58 * (1 - np.exp(-dOut / 430))) + 2.5 * n2 - 6 * cliffy * smooth(0, 120, dOut)
h = np.where(land, np.maximum(h, 0.45), np.minimum(sea, -0.45))
save('h0', h.astype(np.float32))
print('h range', h.min(), h.max(), 'land', (h > 0).mean())
