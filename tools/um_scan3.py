"""a photogrammetry scan → a light game asset that keeps its look: the pieces are welded into one surface, simplified to three
levels of detail, each level gets a fresh uv atlas (xatlas) and its own texture baked from the full-resolution scan; plus a top-down
height grid so you can walk and climb on it.
usage: python3 -I um_scan3.py (um_scan2 + several source textures, up/yaw/scale/noCurtain options) <scene.gltf> <out_dir> <name> <msimplify> <xunwrap> '{"lods":[[40000,2048],[9000,1024],[1800,512]],"hf":112}'"""
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
Ps, Us, Is, Ts = [], [], [], []; off = 0; IMGS = []
for ni, mi, pi, p, M in g.prims():
    P = g.acc(p['attributes']['POSITION']); UV = g.acc(p['attributes']['TEXCOORD_0'])
    I = g.acc(p['indices']).reshape(-1).astype(np.int64) if 'indices' in p else np.arange(len(P))
    R = M[:3, :3]; Ps.append(P @ R.T + M[:3, 3]); Us.append(UV); Is.append(I + off); off += len(P)
    mat = g.js['materials'][p['material']]; bt = mat.get('pbrMetallicRoughness', {}).get('baseColorTexture')
    src_img = g.js['textures'][bt['index']]['source'] if bt else IMGS[0]
    if src_img not in IMGS: IMGS.append(src_img)
    Ts.append(np.full(len(P), IMGS.index(src_img), np.int64))
P0 = np.concatenate(Ps); UV0 = np.concatenate(Us); I0 = np.concatenate(Is); TID0 = np.concatenate(Ts)
if O.get('up') == 'z': P0 = P0[:, [0, 2, 1]] * np.array([1, 1, -1])      # scans lying on their back
if O.get('yaw'): ca, sa = np.cos(np.radians(O['yaw'])), np.sin(np.radians(O['yaw'])); P0 = np.c_[P0[:, 0] * ca + P0[:, 2] * sa, P0[:, 1], -P0[:, 0] * sa + P0[:, 2] * ca]
if O.get('scale'): P0 = P0 * O['scale']
lo, hi = P0.min(0), P0.max(0); c = (lo + hi) / 2
P0 = P0 - np.array([c[0], lo[1], c[2]]); size = P0.max(0) - P0.min(0)
print(name, 'verts', len(P0), 'tris', len(I0) // 3, 'size', np.round(size, 1), round(time.time() - t0, 1), 's')

# weld the pieces and the uv seams into one surface
tol = float(size.max()) * 2e-6
q = np.round(P0 / tol).astype(np.int64)
_, first, inv = np.unique(q, axis=0, return_index=True, return_inverse=True); inv = inv.reshape(-1)
PW = P0[first]; T = inv[I0].reshape(-1, 3)
T = T[(T[:, 0] != T[:, 1]) & (T[:, 1] != T[:, 2]) & (T[:, 0] != T[:, 2])]
T = np.unique(np.sort(T, axis=1), axis=0, return_index=True)[1]; T = inv[I0].reshape(-1, 3)[np.sort(T)]
T = T[(T[:, 0] != T[:, 1]) & (T[:, 1] != T[:, 2]) & (T[:, 0] != T[:, 2])]
print('welded', len(PW), 'verts', len(T), 'tris', round(time.time() - t0, 1), 's')

def simplify(V, I, tris, err):
    st = V.shape[1]; ratio = min(1.0, tris * 3 / len(I))
    with open(work + '/s_in.bin', 'wb') as f:
        f.write(struct.pack('<IIIffI', len(V), len(I), st, ratio, err, 0)); f.write(V.astype(np.float32).tobytes()); f.write(I.astype(np.uint32).tobytes())
    r = subprocess.run([msimp, work + '/s_in.bin', work + '/s_out.bin'], check=True, stderr=subprocess.PIPE); print('  ', r.stderr.decode().strip())
    o = open(work + '/s_out.bin', 'rb').read(); nv, ni = struct.unpack('<II', o[:8])
    vb = np.frombuffer(o[12:12 + nv * st * 4], np.float32).reshape(nv, st).astype(np.float64)
    ib = np.frombuffer(o[12 + nv * st * 4:12 + nv * st * 4 + ni * 4], np.uint32).astype(np.int64)
    return vb, ib
def box_charts(Pv, I):
    """charts by facing: every triangle goes to the axis its normal points along most, connected runs of one facing become one
    chart, projected flat along that axis (a scan's noisy normals would otherwise cut it into thousands of tiny charts)"""
    from scipy.sparse import coo_matrix
    from scipy.sparse.csgraph import connected_components
    t = I.reshape(-1, 3); fn = np.cross(Pv[t[:, 1]] - Pv[t[:, 0]], Pv[t[:, 2]] - Pv[t[:, 0]])
    # the facing comes from the surface around each triangle (voxels of a twelfth of the scan), not its own noisy normal
    cen = Pv[t].mean(1); vs = float((Pv.max(0) - Pv.min(0)).max()) / 12; vi = np.floor((cen - Pv.min(0)) / vs).astype(np.int64) + 1
    dims = vi.max(0) + 2; acc = np.zeros((dims[0], dims[1], dims[2], 3)); np.add.at(acc, (vi[:, 0], vi[:, 1], vi[:, 2]), fn)
    sm = np.zeros_like(fn)
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            for dz in (-1, 0, 1): sm += acc[vi[:, 0] + dx, vi[:, 1] + dy, vi[:, 2] + dz]
    sm = sm * 0.85 + fn / (np.linalg.norm(fn, axis=1, keepdims=True) + 1e-12) * np.linalg.norm(sm, axis=1, keepdims=True) * 0.15
    ax = np.abs(sm).argmax(1); sg = np.sign(sm[np.arange(len(t)), ax]); face = ax * 2 + (sg > 0)
    # triangles that share an edge and a facing are joined
    e = np.r_[t[:, [0, 1]], t[:, [1, 2]], t[:, [2, 0]]]; tri = np.tile(np.arange(len(t)), 3)
    key = np.sort(e, axis=1); order = np.lexsort((key[:, 1], key[:, 0])); ks = key[order]; ts = tri[order]
    same = (ks[1:] == ks[:-1]).all(1); a = ts[:-1][same]; b = ts[1:][same]; ok = face[a] == face[b]
    for it in range(4):
        ok = face[a] == face[b]
        A = coo_matrix((np.ones(ok.sum()), (a[ok], b[ok])), shape=(len(t), len(t)))
        nc, lab = connected_components(A, directed=False)
        cnt = np.bincount(lab, minlength=nc); small = cnt[lab] < 24
        if not small.any() or it == 3: break
        # a triangle of a small chart takes the facing of its largest neighbouring chart
        nb_a = np.r_[a, b]; nb_b = np.r_[b, a]; m = small[nb_a] & ~small[nb_b]
        best = np.full(len(t), -1); bestc = np.zeros(len(t))
        for x, y in zip(nb_a[m], nb_b[m]):
            c = cnt[lab[y]]
            if c > bestc[x]: bestc[x] = c; best[x] = face[y]
        face = np.where(best >= 0, best, face)
    # split vertices per chart, projected along the chart's axis
    corner_v = t.reshape(-1); corner_c = np.repeat(lab, 3)
    pair = corner_v.astype(np.int64) * (nc + 1) + corner_c
    up, first, inv = np.unique(pair, return_index=True, return_inverse=True)
    nv = len(up); vsrc = corner_v[first]; vchart = corner_c[first]; vface = face[np.repeat(np.arange(len(t)), 3)[first]]
    axis = vface // 2; Pn = Pv[vsrc]
    u = np.where(axis == 0, Pn[:, 2], Pn[:, 0]); v = np.where(axis == 1, Pn[:, 2], Pn[:, 1])
    flip = (vface % 2 == 0)                 # mirror the back-facing projections so charts are not inside out
    u = np.where(flip, -u, u)
    return vsrc, np.c_[u, v], inv.reshape(-1), nc
def unwrap(Pv, I, res):
    """box charts packed in shelves on a square atlas, as many texels per metre as fit"""
    vsrc, uv_in, I2, nch = box_charts(Pv, I)
    t = I2.reshape(-1, 3)
    # each chart's vertices (a vertex belongs to exactly one chart)
    vchart = np.full(len(vsrc), -1); tri_chart = np.zeros(len(t), np.int64)
    # charts are the connected pieces of the split mesh
    from scipy.sparse import coo_matrix
    from scipy.sparse.csgraph import connected_components
    A = coo_matrix((np.ones(len(t) * 3), (np.r_[t[:, 0], t[:, 1], t[:, 2]], np.r_[t[:, 1], t[:, 2], t[:, 0]])), shape=(len(vsrc), len(vsrc)))
    nc, vchart = connected_components(A, directed=False)
    lo = np.full((nc, 2), 1e18); hi = np.full((nc, 2), -1e18)
    np.minimum.at(lo, vchart, uv_in); np.maximum.at(hi, vchart, uv_in)
    size = hi - lo; pad = 3
    order = np.argsort(-size[:, 1])
    tpm = np.sqrt(res * res * 0.8 / max(1e-9, (size[:, 0] * size[:, 1]).sum()))
    for attempt in range(60):
        x = y = rowh = 0; ok = True; place = np.zeros((nc, 2))
        for c in order:
            w = size[c, 0] * tpm + pad * 2; h = size[c, 1] * tpm + pad * 2
            if x + w > res: x = 0; y += rowh; rowh = 0
            if y + h > res or w > res: ok = False; break
            place[c] = (x + pad, y + pad); x += w; rowh = max(rowh, h)
        if ok: break
        tpm *= 0.96
    uv = (uv_in - lo[vchart]) * tpm + place[vchart]
    used = (size[:, 0] * size[:, 1]).sum() * tpm * tpm / (res * res)
    print('   box charts', nch, 'pieces', nc, 'texels per metre', round(float(tpm), 2), 'atlas use', round(float(used), 2))
    return vsrc, uv / res, I2
def vnormals(Pv, I):
    t = I.reshape(-1, 3); n = np.cross(Pv[t[:, 1]] - Pv[t[:, 0]], Pv[t[:, 2]] - Pv[t[:, 0]])
    N = np.zeros_like(Pv); np.add.at(N, t[:, 0], n); np.add.at(N, t[:, 1], n); np.add.at(N, t[:, 2], n)
    return N / (np.linalg.norm(N, axis=1, keepdims=True) + 1e-12)

# the source texture and a lookup from any point to the colour of the scan there
TEXS = [np.asarray(Image.open(os.path.join(g.dir, g.js['images'][k]['uri'])).convert('RGB')) for k in IMGS]
print('source textures', [t_.shape for t_ in TEXS], round(time.time() - t0, 1), 's')
tree = cKDTree(P0)
# the scan's cut sides (vertical walls along the edge of its square) carry smeared streaks: they get a real rock face instead
ROCK = np.asarray(Image.open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets/tex/ter_albedo_1024.jpg')).convert('RGB'))[8 * 1024:9 * 1024].astype(np.float32)
SQ_LO = P0.min(0); SQ_HI = P0.max(0); MARGIN = float(size.max()) * O.get('curtainMargin', 0.025)
def curtain_tris(Pv, t):
    fn = np.cross(Pv[t[:, 1]] - Pv[t[:, 0]], Pv[t[:, 2]] - Pv[t[:, 0]]); fn /= np.linalg.norm(fn, axis=1, keepdims=True) + 1e-12
    cen = Pv[t].mean(1)
    near = (cen[:, 0] < SQ_LO[0] + MARGIN) | (cen[:, 0] > SQ_HI[0] - MARGIN) | (cen[:, 2] < SQ_LO[2] + MARGIN) | (cen[:, 2] > SQ_HI[2] - MARGIN)
    return near & (np.abs(fn[:, 1]) < 0.45), fn
def rock_at(pts, fn, tile):
    s_ = np.where(np.abs(fn[:, 0]) > np.abs(fn[:, 2]), pts[:, 2], pts[:, 0]); t_ = pts[:, 1]
    x = (s_ / tile % 1.0) * 1023; y = (-t_ / tile % 1.0) * 1023
    return ROCK[y.astype(int), x.astype(int)]
def sample(uv, tid):
    out = np.zeros((len(uv), 3), np.float32)
    for k in np.unique(tid):
        m = tid == k; out[m] = sample1(uv[m], TEXS[k])
    return out
def sample1(uv, TEX):
    TH, TW = TEX.shape[:2]
    x = np.clip((uv[:, 0] % 1.0) * TW - 0.5, 0, TW - 1.001); y = np.clip((uv[:, 1] % 1.0) * TH - 0.5, 0, TH - 1.001)
    x0 = x.astype(np.int64); y0 = y.astype(np.int64); fx = (x - x0)[:, None]; fy = (y - y0)[:, None]
    a = TEX[y0, x0].astype(np.float32); b = TEX[y0, x0 + 1].astype(np.float32); cc = TEX[y0 + 1, x0].astype(np.float32); d = TEX[y0 + 1, x0 + 1].astype(np.float32)
    return (a * (1 - fx) + b * fx) * (1 - fy) + (cc * (1 - fx) + d * fx) * fy
def bake(Pv, UV, I, res):
    """every texel of the new atlas: its point on the low surface → the scan's colour at the nearest scanned points"""
    t = I.reshape(-1, 3); pix = []; pts = []; tid = []
    cur, fnrm = curtain_tris(Pv, t)
    U = UV * res - 0.5
    for k in range(len(t)):
        a, b, c3 = t[k]; ua, ub, uc = U[a], U[b], U[c3]
        xmin = int(np.floor(min(ua[0], ub[0], uc[0]))); xmax = int(np.ceil(max(ua[0], ub[0], uc[0])))
        ymin = int(np.floor(min(ua[1], ub[1], uc[1]))); ymax = int(np.ceil(max(ua[1], ub[1], uc[1])))
        xs, ys = np.meshgrid(np.arange(max(0, xmin), min(res, xmax + 1)), np.arange(max(0, ymin), min(res, ymax + 1)))
        xs = xs.reshape(-1); ys = ys.reshape(-1)
        if not len(xs): continue
        v0 = ub - ua; v1 = uc - ua; den = v0[0] * v1[1] - v1[0] * v0[1]
        if abs(den) < 1e-12: continue
        px = xs - ua[0]; py = ys - ua[1]
        l1 = (px * v1[1] - v1[0] * py) / den; l2 = (v0[0] * py - px * v0[1]) / den; l0 = 1 - l1 - l2
        m = (l0 >= -0.02) & (l1 >= -0.02) & (l2 >= -0.02)
        if not m.any(): continue
        pix.append(ys[m] * res + xs[m]); pts.append(l0[m, None] * Pv[a] + l1[m, None] * Pv[b] + l2[m, None] * Pv[c3]); tid.append(np.full(int(m.sum()), k))
    pix = np.concatenate(pix); pts = np.concatenate(pts); tid = np.concatenate(tid)
    pix, ui = np.unique(pix, return_index=True); pts = pts[ui]; tid = tid[ui]
    dist, nn = tree.query(pts, k=4, workers=-1)
    w = 1.0 / (dist + 1e-4) ** 2; w /= w.sum(1, keepdims=True)
    col = np.zeros((len(pts), 3), np.float32)
    for j in range(4): col += sample(UV0[nn[:, j]], TID0[nn[:, j]]) * w[:, j:j + 1]
    cm = cur[tid] & (not O.get('noCurtain'))
    if cm.any():
        stone = col[~cm]; sat = stone.max(1) - stone.min(1); stone = stone[sat < np.percentile(sat, 40)]
        target = stone.mean(0) if len(stone) else np.array([140, 135, 128], np.float32)
        rk = rock_at(pts[cm], fnrm[tid[cm]], O.get('rockTile', 5.0)); gain = target / (ROCK.reshape(-1, 3).mean(0) + 1e-3)
        hgt = np.clip(pts[cm, 1] / max(1e-6, float(size[1])) * 3.0, 0, 1)[:, None]
        col[cm] = np.clip(rk * gain * (0.72 + 0.28 * hgt), 0, 255)
    img = np.zeros((res * res, 3), np.float32); filled = np.zeros(res * res, bool); img[pix] = col; filled[pix] = True
    img = img.reshape(res, res, 3); filled = filled.reshape(res, res)
    _, (iy, ix) = ndimage.distance_transform_edt(~filled, return_indices=True)       # bleed into the gutters for clean mipmaps
    img = img[iy, ix]
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), 'RGB'), filled.mean()

def q16(a):
    a = np.asarray(a, np.float64); lo_ = a.min(0); hi_ = a.max(0); span = np.where(hi_ - lo_ > 1e-9, hi_ - lo_, 1)
    qq = np.round((a - lo_) / span * 65534 - 32767).astype(np.int16)
    return {'data': base64.b64encode(qq.tobytes()).decode(), 'min': [round(float(v), 5) for v in lo_], 'max': [round(float(v), 5) for v in hi_]}

lods = []; srcV, srcI = PW, T.reshape(-1)
for k, (tris, res) in enumerate(O['lods']):
    vb, ib = simplify(srcV, srcI, tris, O.get('err', 0.05)); srcV, srcI = vb, ib
    Nv = vnormals(vb, ib)
    xref, uv, idx = unwrap(vb, ib, res)
    Pv = vb[xref]; Nn = Nv[xref]
    img, util = bake(Pv, uv, idx, res)
    fn = f'{name}_{k}.jpg'; img.save(os.path.join(outd, fn), quality=O.get('q', 88), optimize=True)
    hi_fn = None
    if k == 0 and O.get('hires'):
        img2, _ = bake(Pv, uv, idx, O['hires']); hi_fn = f'{name}_{k}h.jpg'; img2.save(os.path.join(outd, hi_fn), quality=O.get('q', 88), optimize=True)
    u32 = len(Pv) >= 65536
    lods.append({'n': int(len(Pv)), 'pos': q16(Pv), 'nrm': base64.b64encode(np.clip(np.round(Nn * 127), -127, 127).astype(np.int8).tobytes()).decode(),
                 'uv': q16(uv), 'idx': {'data': base64.b64encode(idx.astype(np.uint32 if u32 else np.uint16).tobytes()).decode(), 'u32': bool(u32)},
                 'tris': int(len(idx) // 3), 'tex': fn, **({'texHi': hi_fn} if hi_fn else {})})
    print('  lod', k, 'tris', len(idx) // 3, 'verts', len(Pv), 'tex', res, 'filled', round(float(util), 3), round(time.time() - t0, 1), 's')

# height grid from the full scan: the top surface over each cell, on a grid padded all round so the land outside can be
# blended to meet the scan's edge (heights there are the nearest edge's; the distance to the scan is kept per cell)
n = O.get('hf', 112); pad = O.get('pad', 34); x0, z0 = P0[:, 0].min(), P0[:, 2].min(); wdt = max(P0[:, 0].max() - x0, P0[:, 2].max() - z0) * 1.0001; cell = wdt / n
ix = np.clip(((P0[:, 0] - x0) / cell).astype(int), 0, n - 1); iz = np.clip(((P0[:, 2] - z0) / cell).astype(int), 0, n - 1)
H = np.full(n * n, -1.0); np.maximum.at(H, iz * n + ix, P0[:, 1]); H = H.reshape(n, n)
inside = H >= 0
inside = ndimage.binary_closing(inside, iterations=2) & ndimage.binary_fill_holes(inside) | inside
N2 = n + pad * 2; HP = np.full((N2, N2), -1.0); HP[pad:pad + n, pad:pad + n] = np.where(inside, H, -1)
M2 = np.zeros((N2, N2), bool); M2[pad:pad + n, pad:pad + n] = inside
# holes inside take their neighbours' height
dist, (iy, ix2) = ndimage.distance_transform_edt(~(HP >= 0), return_indices=True)
HE = HP[iy, ix2]
D = ndimage.distance_transform_edt(~M2)
hmax = float(HE.max())
meta = {'name': name, 'size': [round(float(v), 3) for v in size],
        'hf': {'n': int(N2), 'x0': round(float(x0 - pad * cell), 4), 'z0': round(float(z0 - pad * cell), 4), 'cell': round(float(cell), 5), 'hmax': round(hmax, 4), 'pad': pad,
               'data': base64.b64encode(np.round(np.clip(HE, 0, None) / max(1e-6, hmax) * 65535).astype(np.uint16).tobytes()).decode(),
               'dist': base64.b64encode(np.clip(np.round(D * 2), 0, 255).astype(np.uint8).tobytes()).decode(), 'dscale': 2},
        'lods': lods}
json.dump(meta, open(os.path.join(outd, name + '.json'), 'w'), separators=(',', ':'))
print('wrote', name + '.json', os.path.getsize(os.path.join(outd, name + '.json')), 'textures', [os.path.getsize(os.path.join(outd, l['tex'])) for l in lods], round(time.time() - t0, 1), 's')
