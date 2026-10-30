# stage 7: biome fields (moisture, forest density, biome ids, surface classes) and the farm fields
import numpy as np, json, random
from scipy import ndimage
from common import *
rng = random.Random(77)
h = load('h4').astype(np.float64); WL = load('WL'); FLOW = load('FLOW'); FLAT = load('FLAT'); ROADCELL = load('ROADCELL')
P = json.load(open(OUT + '/places.json')); ROADS = json.load(open(OUT + '/roads.json'))
R = {k: load('R_' + k).astype(np.float64) for k in ['mount', 'ne', 'forest', 'farm', 'desert', 'swamp', 'city', 'tropic', 'nwisles']}
toI = lambda x: int(round((x + HALF) / STEP))
wet = (~np.isnan(WL)) & (WL > h - 0.02)
ocean = wet & (np.nan_to_num(WL) == 0) & (h < 0)
land = ~wet
gx = np.gradient(h, axis=1) / STEP; gz = np.gradient(h, axis=0) / STEP; slope = np.hypot(gx, gz)
dWater = ndimage.distance_transform_edt(~wet) * STEP
dSea = ndimage.distance_transform_edt(~ocean) * STEP
n1 = fbm(X / 700 + 4.4, Z / 700 - 1.1, 4, seed=71); n2 = fbm(X / 180, Z / 180, 3, seed=72); n3 = fbm(X / 90, Z / 90, 2, seed=73)
# ---- moisture 0..1
moist = 0.5 + 0.12 * n1
moist += R['forest'] * 0.22 + R['ne'] * 0.12 + R['swamp'] * 0.45 + R['tropic'] * 0.25 + R['mount'] * 0.05
moist -= R['desert'] * 0.5 + R['city'] * 0.12 + R['farm'] * 0.02
moist += 0.28 * np.exp(-dWater / 120) * land
moist = np.clip(moist, 0, 1)
# ---- temperature-ish (for snow, palms): colder up north and up high
temp = 0.62 + (Z / HALF) * 0.12 - np.clip(h, 0, None) / 650 + R['desert'] * 0.18 + R['tropic'] * 0.2 - R['ne'] * 0.08
# ---- biome ids
BIOMES = ['sea', 'beach', 'coast', 'forest', 'taiga', 'alpine', 'farm', 'desert', 'swamp', 'tropic', 'isles', 'meadow', 'lake', 'river']
W = np.stack([R['city'] * 1.1, R['forest'] * 1.0 + 0.0, R['ne'] * 1.0, R['mount'] * 0.95, R['farm'] * 1.05, R['desert'] * 1.1, R['swamp'] * 1.15, R['tropic'] * 1.2, R['nwisles'] * 1.2, np.full(h.shape, 0.3)])
ids_map = np.array([2, 3, 4, 4, 6, 7, 8, 9, 10, 11])
bio = ids_map[np.argmax(W, axis=0)]
bio = np.where((bio == 11) & (moist > 0.7) & (h > 30), 3, bio)
bio = np.where(land & (h > 330 + 30 * n1), 5, bio)                         # above the tree line
bio = np.where(land & (dSea < 70 + 40 * n2) & (h < 4.5) & (slope < 0.25), 1, bio)
bio = np.where(wet & ocean, 0, bio)
bio = np.where(wet & ~ocean & (np.hypot(FLOW[..., 0], FLOW[..., 1]) > 0.5), 13, bio)
bio = np.where(wet & ~ocean & (bio != 13), 12, bio)
# ---- forest density 0..1
fd = np.zeros(h.shape)
fd += R['forest'] * (0.78 + 0.25 * n1)
fd += R['ne'] * (0.7 + 0.25 * n1)
fd += R['mount'] * (0.65 + 0.3 * n1) * (1 - smooth(260, 360, h))
fd += R['city'] * 0.18 * smooth(0.1, 0.4, n1)
fd += R['farm'] * 0.12 * smooth(0.25, 0.45, n1)
fd += R['swamp'] * (0.35 + 0.3 * n2)
fd += R['tropic'] * (0.35 + 0.25 * n2)
fd += R['nwisles'] * (0.3 + 0.3 * n1)
fd += (1 - np.clip(sum(R.values()), 0, 1)) * (0.45 + 0.35 * n1)               # in-between lands: mixed woods
fd *= smooth(-0.35, -0.05, n2 + 0.25 * n3)                                      # glades and clearings
fd *= 1 - R['desert']
fd *= 1 - smooth(0.75, 1.1, slope)                                              # cliffs stay bare
fd *= smooth(2.0, 6.0, h)
fd *= land & (bio != 1)
fd *= 1 - np.clip(FLAT * 1.3, 0, 1)                                             # no trees on roads and in towns
fd = np.clip(fd, 0, 1)
# ---- surface classes: 0 natural, 1 field, 2 town ground, 3 beach sand, 4 river/lake bank, 5 dunes, 6 snow cap hint, 7 road shoulder
cls = np.zeros(h.shape, np.uint8)
cls[(bio == 1)] = 3
bank = land & (dWater < 10) & ~ocean & (np.isin(bio, [3, 4, 6, 9, 11, 2, 8])) & (h < 400)
cls[bank & (dSea > 40)] = 4
cls[land & (R['desert'] > 0.55) & (slope < 0.5)] = 5
TOWN = np.zeros(h.shape, np.uint8)
for s in P['settlements']:
    rr = s['r'] * (1.05 if s['kind'] != 'city' else 1.15)
    m = (np.hypot(X - s['x'], Z - s['z']) < rr) & (FLAT > 0.5) & land
    cls[m] = 2; TOWN[m] = 1
cls[ROADCELL] = 7
# ---- farm fields: rectangles in the farmland, avoiding roads, towns and water
CROPS = ['wheat', 'corn', 'sunflower', 'cotton', 'potato', 'tomato', 'fallow', 'wheat', 'corn', 'pumpkin', 'carrot', 'barley']
crop_id = np.zeros(h.shape, np.uint8)
fields = []
blocked = ndimage.binary_dilation(ROADCELL | wet | (TOWN > 0), iterations=2)
for t in range(5000):
    if len(fields) >= 90: break
    x = rng.uniform(-3600, 300); z = rng.uniform(-2600, 900)
    if R['farm'][toI(z), toI(x)] < 0.55 and not (R['city'][toI(z), toI(x)] > 0.5 and rng.random() < 0.3): continue
    w = rng.uniform(70, 200); d = rng.uniform(50, 150)
    i0, i1, j0, j1 = toI(x - w / 2), toI(x + w / 2), toI(z - d / 2), toI(z + d / 2)
    if i0 < 2 or j0 < 2 or i1 >= N - 2 or j1 >= N - 2: continue
    sub = (slice(j0, j1 + 1), slice(i0, i1 + 1))
    if blocked[sub].any() or (crop_id[j0 - 2:j1 + 3, i0 - 2:i1 + 3] > 0).any(): continue
    if slope[sub].max() > 0.12 or h[sub].min() < 2.0: continue
    c = rng.choice(CROPS); cid = CROPS.index(c) + 1
    crop_id[sub] = cid; cls[sub] = 1; fd[sub] = 0
    fields.append({'x': round(x, 1), 'z': round(z, 1), 'w': round(w, 1), 'd': round(d, 1), 'crop': c, 'rows': 'x' if rng.random() < 0.5 else 'z'})
# hedgerows along field edges: a thin line of forest density
hedge = ndimage.binary_dilation(crop_id > 0, iterations=1) & ~(crop_id > 0) & ~blocked
fd = np.where(hedge & (n3 > -0.1), np.maximum(fd, 0.55), fd)
print('fields', len(fields))
# ---- zones: names for the HUD
counts = {BIOMES[k]: round(float((bio == k).mean() * 100), 2) for k in range(len(BIOMES))}
print('biome %', counts)
save('bio', bio.astype(np.uint8)); save('moist', moist.astype(np.float32)); save('fd', fd.astype(np.float32)); save('cls', cls); save('crop', crop_id); save('temp', temp.astype(np.float32))
json.dump({'fields': fields, 'crops': CROPS, 'biomes': BIOMES}, open(OUT + '/fields.json', 'w'), ensure_ascii=False)
