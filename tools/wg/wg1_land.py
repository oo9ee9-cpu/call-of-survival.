# stage 1: coastline and base relief (before erosion)
import numpy as np, sys
from scipy import ndimage
from common import *

TARGET_LAND = float(sys.argv[1]) if len(sys.argv) > 1 else 0.528   # a little above 51.47 %: lakes and rivers take the rest
# --- domain warp shared by the whole coast
wx = fbm(X / 2100 + 3.1, Z / 2100 - 7.7, 4, seed=11) * 650
wz = fbm(X / 2100 - 5.3, Z / 2100 + 2.9, 4, seed=12) * 650
Xw, Zw = X + wx, Z + wz
def ellw(cx, cz, rx, rz, rot=0.0):
    c, s = np.cos(rot), np.sin(rot); dx = Xw - cx; dz = Zw - cz
    u = (dx * c + dz * s) / rx; v = (-dx * s + dz * c) / rz
    return 1 - np.sqrt(u * u + v * v)
main = np.maximum.reduce([
    ellw(-200, -100, 2000, 2150, 0.05),     # core
    ellw(-300, -2450, 2350, 950, 0.0),      # north coast (city)
    ellw(2250, -2600, 1150, 680, -0.6),     # north-east highland peninsula
    ellw(2100, 0, 980, 2050, -0.08),        # eastern mountains
    ellw(-2050, 2150, 1750, 980, 0.62),     # south-west desert peninsula
    ellw(550, 2300, 1500, 950, -0.15),      # southern delta
    ellw(-2500, -900, 1000, 1650, 0.12),    # western farmland coast
])
bays = np.maximum.reduce([
    ellw(300, -3330, 660, 780, 0.1),        # the city's harbour bay
    ellw(-2750, 520, 1250, 270, 0.08),      # western fjord
    ellw(1550, 3120, 460, 900, -0.4),       # southern estuary
    ellw(3020, -1500, 470, 620, 0.2),       # eastern cove
    ellw(-650, 3250, 720, 520, 0.2),        # south-west bay
    ellw(-2250, -2950, 620, 520, 0.3),      # north-west bay
])
islands = np.maximum.reduce([
    ellw(-3300, -3200, 620, 430, 0.3), ellw(-2700, -3760, 300, 220, 0.5), ellw(-3720, -2480, 260, 340), ellw(-3620, -3720, 190, 150),
    ellw(3320, 2300, 660, 920, 0.2), ellw(3640, -480, 230, 310), ellw(-200, 3760, 380, 230), ellw(2420, 3720, 300, 220, 0.4),
    ellw(-3760, 1700, 280, 380),
])
F = np.maximum(main - np.clip(bays, 0, None) * 2.4, islands)
F += fbm(X / 900, Z / 900, 5, seed=21) * 0.2 + fbm(X / 220, Z / 220, 3, seed=22) * 0.055
edge = np.maximum(np.abs(X), np.abs(Z))
F -= smooth(3550, 4050, edge) * 1.2
# --- pick the threshold that gives the land fraction
lo, hi = -0.5, 0.6
for _ in range(40):
    t = (lo + hi) / 2
    if (F > t)[inplay()].mean() > TARGET_LAND: lo = t
    else: hi = t
land = F > t
# keep only big pieces of land (drop specks) and fill tiny lakes
lab, n = ndimage.label(land); sizes = ndimage.sum(land, lab, range(1, n + 1))
land = np.isin(lab, 1 + np.where(sizes > 300)[0])
sea = ~land; lab, n = ndimage.label(sea); sizes = ndimage.sum(sea, lab, range(1, n + 1)); big = 1 + np.argmax(sizes)
land = land | (lab != big)
print('threshold', round(t, 4), 'land (8 km square)', round(land[inplay()].mean() * 100, 2), '%')
# --- distances (metres) to the coast, inland and out to sea
dIn = ndimage.distance_transform_edt(land) * STEP
dOut = ndimage.distance_transform_edt(~land) * STEP
save('land0', land); save('dIn', dIn); save('dOut', dOut); save('F', F)
