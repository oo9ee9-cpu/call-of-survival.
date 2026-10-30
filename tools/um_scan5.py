"""a photogrammetry scan (a building, a fortress on its rock) → a light game asset that keeps its detail:
 1. the pieces welded into one surface (uv seams ignored), simplified to three levels of detail
 2. every level unwrapped with xatlas (charts follow the shape, so nothing is projected through a wall)
 3. every texel of the new atlas looks up the closest point on the full-resolution scan, takes that point's uv in the scan's own
    texture(s) and samples it: windows, carvings and lettering survive the cut from a million triangles to a few thousand
 4. a top-down height grid for walking and climbing (as um_scan2), so it drops into 31_landforms unchanged
usage: python3 -I um_scan5.py <scene.gltf> <out_dir> <name> <msimplify> <xunwrap> '{"lods":[[40000,2048],[9000,1024],[1800,512]],"hires":4096,"hf":150,"pad":40}'"""
import sys, os, json, base64, struct, subprocess, time
import numpy as np
from PIL import Image
from scipy.spatial import cKDTree
from scipy import ndimage
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gltfread import G
Image.MAX_IMAGE_PIXELS = None
t0 = time.time()
src, outd, name, msimp, xunwrap, opts = sys.argv[1:7]
O = json.loads(opts); os.makedirs(outd, exist_ok=True); work = os.path.join(outd, '_work'); os.makedirs(work, exist_ok=True)
g = G(src)
Ps, Us, Is, Ks = [], [], [], []; off = 0; IMGS = []; FLAT = {}
DROP = [d.lower() for d in O.get('drop', [])]
for ni, mi, pi, p, M in g.prims():
    mat = g.js['materials'][p.get('material', 0)]; nname = (g.js['nodes'][ni].get('name') or '').lower(); mname = (mat.get('name') or '').lower()
    if any(d in nname or d in mname for d in DROP) or p.get('mode', 4) != 4: continue
    P = g.acc(p['attributes']['POSITION'])
    UV = g.acc(p['attributes']['TEXCOORD_0']) if 'TEXCOORD_0' in p['attributes'] else np.zeros((len(P), 2))
    I = g.acc(p['indices']).reshape(-1).astype(np.int64) if 'indices' in p else np.arange(len(P))
    R = M[:3, :3]
    if np.linalg.det(R) < 0: I = I.reshape(-1, 3)[:, [0, 2, 1]].reshape(-1)
    sg = mat.get('extensions', {}).get('KHR_materials_pbrSpecularGlossiness')
    bt = (sg or {}).get('diffuseTexture') or mat.get('pbrMetallicRoughness', {}).get('baseColorTexture')
    if bt: k = g.js['textures'][bt['index']]['source']
    else:
        # an untextured part (a painted fence): a flat image of its colour stands in for a texture
        fac = (sg or {}).get('diffuseFactor') or mat.get('pbrMetallicRoughness', {}).get('baseColorFactor') or [0.7, 0.7, 0.7, 1]
        k = 'flat:' + ','.join('%.3f' % v for v in fac[:3]); FLAT[k] = fac[:3]; UV = np.full((len(P), 2), 0.5)
    if k not in IMGS: IMGS.append(k)
    tile = np.floor(np.median(UV, 0))                      # udim tiles (u1_v1, u2_v1 …): uvs of the second texture run 1..2
    Ps.append(P @ R.T + M[:3, 3]); Us.append(np.clip(UV - tile, 0, 1)); Ks.append(np.full(len(P), IMGS.index(k))); Is.append(I + off); off += len(P)
P0 = np.concatenate(Ps); UV0 = np.concatenate(Us); K0 = np.concatenate(Ks); I0 = np.concatenate(Is)
if O.get('yaw'): ca, sa = np.cos(np.radians(O['yaw'])), np.sin(np.radians(O['yaw'])); P0 = np.c_[P0[:, 0] * ca + P0[:, 2] * sa, P0[:, 1], -P0[:, 0] * sa + P0[:, 2] * ca]
if O.get('scale'): P0 = P0 * O['scale']
lo, hi = P0.min(0), P0.max(0); c = (lo + hi) / 2
P0 = P0 - np.array([c[0], lo[1], c[2]]); size = P0.max(0) - P0.min(0)
T0 = I0.reshape(-1, 3)
print(name, 'verts', len(P0), 'tris', len(T0), 'textures', len(IMGS), 'size', np.round(size, 1), round(time.time() - t0, 1), 's')
# the full scan, for lookups: triangle corners, their uvs and texture
TA, TB_, TC = P0[T0[:, 0]], P0[T0[:, 1]], P0[T0[:, 2]]
CTREE = cKDTree((TA + TB_ + TC) / 3)
def src_tex(k):
    if isinstance(k, str): return np.tile(np.clip(np.round(np.array(FLAT[k]) ** (1 / 2.2) * 255), 0, 255).astype(np.uint8), (4, 4, 1))
    im = Image.open(os.path.join(g.dir, g.js['images'][k]['uri'])); im.load(); im = im.convert('RGB')
    if O.get('srcMax') and max(im.size) > O['srcMax']: im = im.resize((O['srcMax'], O['srcMax'] * im.size[1] // im.size[0]), Image.LANCZOS)
    return np.asarray(im)
TEXS = [src_tex(k) for k in IMGS]
print('source textures', [t_.shape[:2] for t_ in TEXS], round(time.time() - t0, 1), 's')
# weld the pieces into one surface for simplifying (seams would hold it up)
tol = float(size.max()) * 2e-6
q = np.round(P0 / tol).astype(np.int64)
_, first, inv = np.unique(q, axis=0, return_index=True, return_inverse=True); inv = inv.reshape(-1)
PW = P0[first]; TW = inv[I0].reshape(-1, 3)
TW = TW[(TW[:, 0] != TW[:, 1]) & (TW[:, 1] != TW[:, 2]) & (TW[:, 0] != TW[:, 2])]
print('welded', len(PW), 'verts', len(TW), 'tris', round(time.time() - t0, 1), 's')

def simplify(V, I, tris, err):
    st = V.shape[1]; ratio = min(1.0, tris * 3 / len(I))
    with open(work + '/s5_in.bin', 'wb') as f:
        f.write(struct.pack('<IIIffI', len(V), len(I), st, ratio, err, 0)); f.write(V.astype(np.float32).tobytes()); f.write(I.astype(np.uint32).tobytes())
    r = subprocess.run([msimp, work + '/s5_in.bin', work + '/s5_out.bin'], check=True, stderr=subprocess.PIPE); print('  ', r.stderr.decode().strip())
    o = open(work + '/s5_out.bin', 'rb').read(); nv, ni = struct.unpack('<II', o[:8])
    vb = np.frombuffer(o[12:12 + nv * st * 4], np.float32).reshape(nv, st).astype(np.float64)
    ib = np.frombuffer(o[12 + nv * st * 4:12 + nv * st * 4 + ni * 4], np.uint32).astype(np.int64)
    return vb, ib
def unwrap(Pv, I, res):
    # bigger charts than xatlas's default (a scan's noisy surface splits into thousands of crumbs, and every crumb pays the gutter)
    with open(work + '/x5_in.bin', 'wb') as f:
        f.write(struct.pack('<IIIIfI', len(Pv), len(I), 2, O.get('gutter', 2), O.get('chartCost', 6.0), res)); f.write(Pv.astype(np.float32).tobytes()); f.write(I.astype(np.uint32).tobytes())
    r = subprocess.run([xunwrap, work + '/x5_in.bin', work + '/x5_out.bin'], check=True, stderr=subprocess.PIPE); print('  ', r.stderr.decode().strip())
    o = open(work + '/x5_out.bin', 'rb').read(); nv, ni, w, h = struct.unpack('<IIII', o[:16])
    rec = np.frombuffer(o[16:16 + nv * 12], dtype=np.dtype([('x', '<u4'), ('u', '<f4'), ('v', '<f4')]))
    idx = np.frombuffer(o[16 + nv * 12:16 + nv * 12 + ni * 4], np.uint32).astype(np.int64)
    return rec['x'].astype(np.int64), np.c_[rec['u'], rec['v']].astype(np.float64), idx, w, h
def vnormals(Pv, I):
    t = I.reshape(-1, 3); n = np.cross(Pv[t[:, 1]] - Pv[t[:, 0]], Pv[t[:, 2]] - Pv[t[:, 0]])
    N = np.zeros_like(Pv)
    for k in range(3): np.add.at(N, t[:, k], n)
    return N / (np.linalg.norm(N, axis=1, keepdims=True) + 1e-12)
def sample1(uv, TEX):
    TH, TW_ = TEX.shape[:2]
    x = np.clip(uv[:, 0] * TW_ - 0.5, 0, TW_ - 1.001); y = np.clip(uv[:, 1] * TH - 0.5, 0, TH - 1.001)
    x0 = x.astype(np.int64); y0 = y.astype(np.int64); fx = (x - x0)[:, None]; fy = (y - y0)[:, None]
    a = TEX[y0, x0].astype(np.float32); b = TEX[y0, x0 + 1].astype(np.float32); cc = TEX[y0 + 1, x0].astype(np.float32); d = TEX[y0 + 1, x0 + 1].astype(np.float32)
    return (a * (1 - fx) + b * fx) * (1 - fy) + (cc * (1 - fx) + d * fx) * fy
def lookup(pts):
    """the scan's colour at the closest point of the full scan to each point (8 candidate triangles by centroid)"""
    out = np.zeros((len(pts), 3), np.float32)
    for s0 in range(0, len(pts), 200000):
        p = pts[s0:s0 + 200000]; _, cand = CTREE.query(p, k=8, workers=-1)
        A = TA[cand]; B = TB_[cand]; C = TC[cand]; pp = p[:, None, :]
        e0 = B - A; e1 = C - A; v2 = pp - A
        d00 = (e0 * e0).sum(-1); d01 = (e0 * e1).sum(-1); d11 = (e1 * e1).sum(-1); d20 = (v2 * e0).sum(-1); d21 = (v2 * e1).sum(-1)
        den = d00 * d11 - d01 * d01; den = np.where(np.abs(den) < 1e-18, 1e-18, den)
        bv = (d11 * d20 - d01 * d21) / den; bw = (d00 * d21 - d01 * d20) / den; bu = 1 - bv - bw
        bu = np.clip(bu, 0, None); bv = np.clip(bv, 0, None); bw = np.clip(bw, 0, None); sm = bu + bv + bw + 1e-12; bu /= sm; bv /= sm; bw /= sm
        X = A * bu[..., None] + B * bv[..., None] + C * bw[..., None]
        dd = ((X - pp) ** 2).sum(-1); j = dd.argmin(1); r = np.arange(len(p))
        tri = cand[r, j]; wu = bu[r, j][:, None]; wv = bv[r, j][:, None]; ww = bw[r, j][:, None]
        t3 = T0[tri]; uv = UV0[t3[:, 0]] * wu + UV0[t3[:, 1]] * wv + UV0[t3[:, 2]] * ww; kk = K0[t3[:, 0]]
        col = np.zeros((len(p), 3), np.float32)
        for k in np.unique(kk): m = kk == k; col[m] = sample1(uv[m], TEXS[k])
        out[s0:s0 + 200000] = col
    return out
def bake(Pv, UV, I, W, H):
    t = I.reshape(-1, 3); U = UV * np.array([W, H]) - 0.5; pix = []; pts = []
    for k in range(len(t)):
        a, b, c3 = t[k]; ua, ub, uc = U[a], U[b], U[c3]
        xmin = int(np.floor(min(ua[0], ub[0], uc[0]))); xmax = int(np.ceil(max(ua[0], ub[0], uc[0])))
        ymin = int(np.floor(min(ua[1], ub[1], uc[1]))); ymax = int(np.ceil(max(ua[1], ub[1], uc[1])))
        xs, ys = np.meshgrid(np.arange(max(0, xmin), min(W, xmax + 1)), np.arange(max(0, ymin), min(H, ymax + 1)))
        xs = xs.reshape(-1); ys = ys.reshape(-1)
        if not len(xs): continue
        v0 = ub - ua; v1 = uc - ua; den = v0[0] * v1[1] - v1[0] * v0[1]
        if abs(den) < 1e-12: continue
        px = xs - ua[0]; py = ys - ua[1]
        l1 = (px * v1[1] - v1[0] * py) / den; l2 = (v0[0] * py - px * v0[1]) / den; l0 = 1 - l1 - l2
        m = (l0 >= -0.03) & (l1 >= -0.03) & (l2 >= -0.03)
        if not m.any(): continue
        pix.append(ys[m] * W + xs[m]); pts.append(l0[m, None] * Pv[a] + l1[m, None] * Pv[b] + l2[m, None] * Pv[c3])
    pix = np.concatenate(pix); pts = np.concatenate(pts)
    pix, ui = np.unique(pix, return_index=True); pts = pts[ui]
    col = lookup(pts)
    img = np.zeros((W * H, 3), np.float32); filled = np.zeros(W * H, bool); img[pix] = col; filled[pix] = True
    img = img.reshape(H, W, 3); filled = filled.reshape(H, W)
    _, (iy, ix) = ndimage.distance_transform_edt(~filled, return_indices=True)
    img = img[iy, ix]
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), 'RGB'), filled.mean()
def q16(a):
    a = np.asarray(a, np.float64); lo_ = a.min(0); hi_ = a.max(0); span = np.where(hi_ - lo_ > 1e-9, hi_ - lo_, 1)
    qq = np.round((a - lo_) / span * 65534 - 32767).astype(np.int16)
    return {'data': base64.b64encode(qq.tobytes()).decode(), 'min': [round(float(v), 5) for v in lo_], 'max': [round(float(v), 5) for v in hi_]}

lods = []; srcV, srcI = PW, TW.reshape(-1)
if O.get('hfOnly'): lods = json.load(open(os.path.join(outd, name + '.json')))['lods']; O['lods'] = []      # only the height grid again
for k, (tris, res) in enumerate(O['lods']):
    vb, ib = simplify(srcV, srcI, tris, O.get('err', 0.05)); srcV, srcI = vb, ib
    Nv = vnormals(vb, ib)
    xref, uv, idx, aw, ah = unwrap(vb, ib, res)
    Pv = vb[xref]; Nn = Nv[xref]
    # the atlas keeps xatlas's shape (often not square): res is its longer side
    W = res if aw >= ah else max(64, int(round(res * aw / ah))); H = res if ah >= aw else max(64, int(round(res * ah / aw)))
    img, util = bake(Pv, uv, idx, W, H)
    fn = f'{name}_{k}.jpg'; img.save(os.path.join(outd, fn), quality=O.get('q', 88), optimize=True)
    hi_fn = None
    if k == 0 and O.get('hires'):
        sc = O['hires'] / res; img2, _ = bake(Pv, uv, idx, int(W * sc), int(H * sc)); hi_fn = f'{name}_{k}h.jpg'; img2.save(os.path.join(outd, hi_fn), quality=O.get('q', 88), optimize=True)
    u32 = len(Pv) >= 65536
    lods.append({'n': int(len(Pv)), 'pos': q16(Pv), 'nrm': base64.b64encode(np.clip(np.round(Nn * 127), -127, 127).astype(np.int8).tobytes()).decode(),
                 'uv': q16(uv), 'idx': {'data': base64.b64encode(idx.astype(np.uint32 if u32 else np.uint16).tobytes()).decode(), 'u32': bool(u32)},
                 'tris': int(len(idx) // 3), 'tex': fn, **({'texHi': hi_fn} if hi_fn else {})})
    print('  lod', k, 'tris', len(idx) // 3, 'verts', len(Pv), 'tex', W, 'x', H, 'filled', round(float(util), 3), round(time.time() - t0, 1), 's')

n = O.get('hf', 112); pad = O.get('pad', 34); x0, z0 = P0[:, 0].min(), P0[:, 2].min(); wdt = max(P0[:, 0].max() - x0, P0[:, 2].max() - z0) * 1.0001; cell = wdt / n
# the surface sampled densely (a wall of two big triangles has no vertices in its middle)
_rng = np.random.default_rng(7); A_, B_, C_ = TA, TB_, TC
_ar = 0.5 * np.linalg.norm(np.cross(B_ - A_, C_ - A_), axis=1); _k = np.clip(np.ceil(_ar / (cell * cell * 0.2)), 0, 3000).astype(np.int64)
_id = np.repeat(np.arange(len(A_)), _k); _r1 = np.sqrt(_rng.random(len(_id)))[:, None]; _r2 = _rng.random(len(_id))[:, None]
SP = np.concatenate([P0, (1 - _r1) * A_[_id] + _r1 * (1 - _r2) * B_[_id] + _r1 * _r2 * C_[_id]])
print('height grid', n, 'cells of', round(cell, 3), 'm from', len(SP), 'surface points')
ix = np.clip(((SP[:, 0] - x0) / cell).astype(int), 0, n - 1); iz = np.clip(((SP[:, 2] - z0) / cell).astype(int), 0, n - 1); ci = iz * n + ix
Hh = np.full(n * n, -1.0); np.maximum.at(Hh, ci, SP[:, 1])
WALL = None
if O.get('interior'):
    # a building you walk into: the floor is the top of whatever lies within a hand of the lowest surface (gravel, a rug),
    # and a cell is wall where something stands between knee and head height above that floor
    low = np.full(n * n, np.inf); np.minimum.at(low, ci, SP[:, 1])
    m = SP[:, 1] <= low[ci] + 0.45; fl = np.full(n * n, -1.0); np.maximum.at(fl, ci[m], SP[m, 1])
    w = (SP[:, 1] > fl[ci] + 0.55) & (SP[:, 1] < fl[ci] + 1.9); WALL = np.zeros(n * n, bool); WALL[ci[w]] = True
    TOP = Hh.copy(); Hh = fl; print('interior: wall cells', int(WALL.sum()), 'of', int((fl >= 0).sum()))
Hh = Hh.reshape(n, n)
inside = Hh >= 0
inside = ndimage.binary_closing(inside, iterations=2) & ndimage.binary_fill_holes(inside) | inside
N2 = n + pad * 2; HP = np.full((N2, N2), -1.0); HP[pad:pad + n, pad:pad + n] = np.where(inside, Hh, -1)
M2 = np.zeros((N2, N2), bool); M2[pad:pad + n, pad:pad + n] = inside
dist, (iy, ix2) = ndimage.distance_transform_edt(~(HP >= 0), return_indices=True)
HE = HP[iy, ix2]
D = ndimage.distance_transform_edt(~M2)
hmax = float(HE.max())
meta = {'name': name, 'size': [round(float(v), 3) for v in size],
        'hf': {'n': int(N2), 'x0': round(float(x0 - pad * cell), 4), 'z0': round(float(z0 - pad * cell), 4), 'cell': round(float(cell), 5), 'hmax': round(hmax, 4), 'pad': pad,
               'data': base64.b64encode(np.round(np.clip(HE, 0, None) / max(1e-6, hmax) * 65535).astype(np.uint16).tobytes()).decode(),
               'dist': base64.b64encode(np.clip(np.round(D * 2), 0, 255).astype(np.uint8).tobytes()).decode(), 'dscale': 2},
        'lods': lods}
if WALL is not None:
    WP = np.zeros((N2, N2), bool); WP[pad:pad + n, pad:pad + n] = WALL.reshape(n, n)
    meta['hf']['wall'] = base64.b64encode(np.packbits(WP.reshape(-1))).decode(); meta['interior'] = True
    # the roofs: whoever comes down from above (a parachute) lands on top, not inside
    TP = np.zeros((N2, N2)); TP[pad:pad + n, pad:pad + n] = np.where(TOP.reshape(n, n) >= 0, TOP.reshape(n, n), 0)
    meta['hf']['top'] = base64.b64encode(np.round(np.clip(TP, 0, None) / max(1e-6, float(TP.max())) * 65535).astype(np.uint16).tobytes()).decode(); meta['hf']['tmax'] = round(float(TP.max()), 4)
json.dump(meta, open(os.path.join(outd, name + '.json'), 'w'), separators=(',', ':'))
print('wrote', name + '.json', os.path.getsize(os.path.join(outd, name + '.json')), 'textures', [os.path.getsize(os.path.join(outd, l['tex'])) for l in lods], round(time.time() - t0, 1), 's')
