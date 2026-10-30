# stage 8: tune the land share, export the maps the game loads, the world json and the chart image
import numpy as np, json, os
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage
from common import *
DST = os.path.join(os.path.dirname(__file__), '../../assets/world')
os.makedirs(DST, exist_ok=True)
h = load('h4').astype(np.float64); WL = load('WL').astype(np.float64); FLOW = load('FLOW'); FLAT = load('FLAT')
bio = load('bio'); fd = load('fd'); cls = load('cls'); crop = load('crop'); moist = load('moist'); temp = load('temp')
P = json.load(open(OUT + '/places.json')); ROADS = json.load(open(OUT + '/roads.json')); WAT = json.load(open(OUT + '/water.json')); FI = json.load(open(OUT + '/fields.json'))
TARGET = 51.47
IP = inplay()
def land_pct():
    wet = (~np.isnan(WL)) & (WL > h)
    return 100.0 * (1 - wet[IP].mean())
# nudge shallow shore cells until the land share reads 51.47 %
lp = land_pct(); print('land before', round(lp, 4))
ocean = (np.nan_to_num(WL, nan=-1) == 0)
shore_sea = ocean & (h < 0) & (h > -4.0) & ndimage.binary_dilation(h > 0, iterations=1) & IP
shore_land = (h > 0) & (h < 1.5) & ndimage.binary_dilation(ocean & (h < 0), iterations=1) & (FLAT < 0.1) & IP
need = int(round((TARGET - lp) / 100 * IP.sum()))
if need > 0:
    idx = np.argwhere(shore_sea); np.random.RandomState(5).shuffle(idx)
    for j, i in idx[:need]: h[j, i] = 0.35
elif need < 0:
    idx = np.argwhere(shore_land); np.random.RandomState(5).shuffle(idx)
    for j, i in idx[:-need]: h[j, i] = -0.35
lp = land_pct(); print('land after', round(lp, 4), 'water', round(100 - lp, 4))
# ---- detail amplitude for runtime micro-relief
R = {k: load('R_' + k) for k in ['mount', 'ne', 'forest', 'farm', 'desert', 'swamp', 'city', 'tropic', 'nwisles']}
amp = 0.45 + R['mount'] * 0.9 + R['ne'] * 0.5 + R['forest'] * 0.15 - R['farm'] * 0.25 - R['swamp'] * 0.3 - R['city'] * 0.3 + R['nwisles'] * 0.4
amp = np.clip(amp, 0.08, 1.6) * (1 - np.clip(FLAT * 1.2, 0, 1)) * (h > 0.5)
def enc16(v): v = np.clip(np.round((v + 100.0) * 100.0), 0, 65535).astype(np.uint32); return (v >> 8).astype(np.uint8), (v & 255).astype(np.uint8)
hr, hg = enc16(h)
Image.fromarray(np.dstack([hr, hg, np.clip(amp * 100, 0, 255).astype(np.uint8)]), 'RGB').save(DST + '/height.png', optimize=True)
wl = np.where(np.isnan(WL), -100.0, WL)
# water surface grid extends two cells past the shore so the plane meets the banks
has = ~np.isnan(WL)
for _ in range(2):
    grown = ndimage.grey_dilation(np.where(has, wl, -1e9), size=3)
    nw = (~has) & (grown > -1e8); wl = np.where(nw, grown, wl); has = has | nw
wr, wg = enc16(np.where(has, wl, -100.0))
ang = np.arctan2(FLOW[..., 1], FLOW[..., 0]); fl = np.hypot(FLOW[..., 0], FLOW[..., 1]) > 0.5
fb = np.where(fl, 1 + np.round((ang % (2 * np.pi)) / (2 * np.pi) * 253), 0).astype(np.uint8)
Image.fromarray(np.dstack([wr, wg, fb]), 'RGB').save(DST + '/water.png', optimize=True)
Image.fromarray(np.dstack([np.clip(moist * 255, 0, 255), np.clip(fd * 255, 0, 255), np.clip(temp * 255, 0, 255)]).astype(np.uint8), 'RGB').save(DST + '/surface.png', optimize=True)
Image.fromarray(np.dstack([bio, cls, crop]).astype(np.uint8), 'RGB').save(DST + '/ids.png', optimize=True)
# ---- stats
wet = (~np.isnan(WL)) & (WL > h)
stats = {'size_m': 8000, 'play_half': PLAY, 'cells': N, 'step': STEP, 'land_pct': round(float(lp), 2), 'water_pct': round(100 - float(lp), 2), 'area_km2': 64.0,
         'max_h': round(float(h.max()), 1), 'roads_km': round(sum(len(r['pts']) * 4 for r in ROADS) / 1000, 1), 'buildings': sum(len(s['buildings']) for s in P['settlements'])}
print(stats)
# ---- spawn: the city square
city = [s for s in P['settlements'] if s['id'] == 'city'][0]; sq = city['squares'][0]
world = {'v': 1, 'stats': stats, 'spawn': {'x': sq['x'] + 6, 'z': sq['z'] + 16}, 'settlements': P['settlements'], 'poi': P['poi'], 'roads': ROADS,
         'rivers': WAT['rivers'], 'lakes': WAT['lakes'], 'fields': FI['fields'], 'biomes': FI['biomes'], 'crops': FI['crops']}
js = json.dumps(world, ensure_ascii=False, separators=(',', ':'))
open(DST + '/world.json', 'w').write(js)
# ---- the chart: relief + colour by biome + water + roads + buildings
S = 2048; k = S / (N - 1)
hh = np.array(Image.fromarray(h.astype(np.float32), 'F').resize((S, S), Image.BILINEAR)).astype(np.float64)
gx = np.gradient(hh, axis=1) * k / STEP * 1.0; gz = np.gradient(hh, axis=0) * k / STEP
shade = np.clip((-0.55 * gx - 0.5 * gz + 0.7) / np.sqrt(gx * gx + gz * gz + 1), 0, 1.2)
pal = np.array([(36, 92, 124), (224, 208, 160), (176, 178, 118), (96, 134, 74), (78, 112, 78), (176, 172, 166), (196, 192, 122), (226, 200, 140), (110, 126, 86), (120, 176, 104), (150, 160, 128), (156, 182, 104), (52, 118, 156), (60, 130, 168)], np.float64)
bb = np.array(Image.fromarray(bio).resize((S, S), Image.NEAREST))
col = pal[bb]
ff = np.array(Image.fromarray((fd * 255).astype(np.uint8)).resize((S, S), Image.BILINEAR)) / 255.0
col = col * (1 - 0.35 * ff[..., None]) + np.array([46, 84, 46]) * 0.35 * ff[..., None]
cc = np.array([(0, 0, 0), (214, 186, 92), (98, 156, 62), (226, 196, 70), (232, 232, 226), (110, 150, 78), (196, 92, 64), (150, 118, 88), (206, 176, 98), (110, 156, 70), (220, 140, 60), (200, 120, 70), (196, 186, 104)], np.float64)
cr = np.array(Image.fromarray(crop).resize((S, S), Image.NEAREST)); m = cr > 0; col[m] = cc[cr[m]]
col = col * (0.62 + 0.45 * shade[..., None])
wlS = np.array(Image.fromarray(np.where(np.isnan(WL), -999, WL).astype(np.float32), 'F').resize((S, S), Image.NEAREST)).astype(np.float64)
wetS = wlS > hh
depth = np.clip((wlS - hh) / 30, 0, 1)
wcol = np.array([92, 168, 186]) * (1 - depth[..., None]) + np.array([28, 78, 116]) * depth[..., None]
col = np.where(wetS[..., None], wcol, col)
# contour every 50 m
cont = (np.floor(hh / 50) != np.floor(np.roll(hh, 1, 0) / 50)) | (np.floor(hh / 50) != np.floor(np.roll(hh, 1, 1) / 50))
col = np.where((cont & ~wetS & (hh > 1))[..., None], col * 0.82, col)
im = Image.fromarray(np.clip(col, 0, 255).astype(np.uint8))
d = ImageDraw.Draw(im)
T = lambda x, z: ((x + HALF) / 8192 * S, (z + HALF) / 8192 * S)
for r in ROADS:
    wd = {'highway': 5, 'road': 4, 'track': 2}[r['kind']]; cl = {'highway': (246, 222, 140), 'road': (240, 236, 220), 'track': (190, 150, 100)}[r['kind']]
    pts = [T(p[0], p[1]) for p in r['pts']]
    if r['kind'] != 'track': d.line(pts, fill=(60, 50, 40), width=wd + 2)
    d.line(pts, fill=cl, width=wd)
for s in P['settlements']:
    for st in s['streets']: d.line([T(*p) for p in st['pts']], fill=(236, 230, 214), width=2)
    for b in s['buildings']:
        x0, z0 = T(b['x'] - b['hx'], b['z'] - b['hz']); x1, z1 = T(b['x'] + b['hx'], b['z'] + b['hz'])
        d.rectangle([x0, z0, max(x0 + 1, x1), max(z0 + 1, z1)], fill=(120, 90, 70))
im = im.filter(ImageFilter.SMOOTH_MORE) if False else im
im.save(DST + '/map.jpg', quality=84, optimize=True)
im.resize((1024, 1024), Image.LANCZOS).save(DST + '/map_s.jpg', quality=84, optimize=True)
for f in sorted(os.listdir(DST)): print(f, os.path.getsize(os.path.join(DST, f)))
