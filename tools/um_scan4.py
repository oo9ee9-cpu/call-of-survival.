"""a photogrammetry scan of a building → a light game asset that keeps the scan's own texture atlas (no re-bake: windows, carvings
and lettering stay sharp): the pieces are welded, simplified with their uv seams kept to three levels of detail, the scan's
textures (one or several) are laid side by side in one image per level, plus the walkable height grid of um_scan2.
usage: python3 -I um_scan4.py <scene.gltf> <out_dir> <name> <msimplify> '{"lods":[[60000,2048],[12000,1024],[2500,512]],"hires":4096,"hf":150,"pad":40}'
  each level: [triangles, texture size per source texture]; hires: a sharper texture for the near level on strong devices"""
import sys, os, json, base64, struct, subprocess, time
import numpy as np
from PIL import Image
from scipy import ndimage
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gltfread import G
Image.MAX_IMAGE_PIXELS = None
t0 = time.time()
src, outd, name, msimp, opts = sys.argv[1:6]
O = json.loads(opts); os.makedirs(outd, exist_ok=True); work = os.path.join(outd, '_work'); os.makedirs(work, exist_ok=True)
g = G(src)
Ps, Us, Is = [], [], []; off = 0; IMGS = []
for ni, mi, pi, p, M in g.prims():
    P = g.acc(p['attributes']['POSITION']); UV = g.acc(p['attributes']['TEXCOORD_0'])
    I = g.acc(p['indices']).reshape(-1).astype(np.int64) if 'indices' in p else np.arange(len(P))
    R = M[:3, :3]
    if np.linalg.det(R) < 0: I = I.reshape(-1, 3)[:, [0, 2, 1]].reshape(-1)
    mat = g.js['materials'][p['material']]; bt = mat.get('pbrMetallicRoughness', {}).get('baseColorTexture')
    k = g.js['textures'][bt['index']]['source'] if bt else IMGS[0]
    if k not in IMGS: IMGS.append(k)
    Ps.append(P @ R.T + M[:3, 3]); Us.append(np.c_[UV, np.full(len(P), IMGS.index(k))]); Is.append(I + off); off += len(P)
P0 = np.concatenate(Ps); U3 = np.concatenate(Us); I0 = np.concatenate(Is); NT = len(IMGS)
if O.get('yaw'): ca, sa = np.cos(np.radians(O['yaw'])), np.sin(np.radians(O['yaw'])); P0 = np.c_[P0[:, 0] * ca + P0[:, 2] * sa, P0[:, 1], -P0[:, 0] * sa + P0[:, 2] * ca]
if O.get('scale'): P0 = P0 * O['scale']
lo, hi = P0.min(0), P0.max(0); c = (lo + hi) / 2
P0 = P0 - np.array([c[0], lo[1], c[2]]); size = P0.max(0) - P0.min(0)
print(name, 'verts', len(P0), 'tris', len(I0) // 3, 'textures', NT, 'size', np.round(size, 1), 'uv range', np.round(U3[:, :2].min(0), 3), np.round(U3[:, :2].max(0), 3))
# the textures side by side: u' = (u + k) / NT
UV0 = np.c_[(np.clip(U3[:, 0], 0, 1) + U3[:, 2]) / NT, np.clip(U3[:, 1], 0, 1)]
# weld exact duplicates (same place, same uv), keep uv seams
tol = float(size.max()) * 1e-6
key = np.c_[np.round(P0 / tol), np.round(UV0 * 2 ** 20)].astype(np.int64)
_, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True); inv = inv.reshape(-1)
PV = P0[first]; UVW = UV0[first]; T = inv[I0].reshape(-1, 3)
T = T[(T[:, 0] != T[:, 1]) & (T[:, 1] != T[:, 2]) & (T[:, 0] != T[:, 2])]
print('welded', len(PV), 'verts', len(T), 'tris', round(time.time() - t0, 1), 's')

def simplify(V, I, tris, err, weights):
    st = V.shape[1]; ratio = min(1.0, tris * 3 / len(I))
    with open(work + '/s4_in.bin', 'wb') as f:
        f.write(struct.pack('<IIIffI', len(V), len(I), st, ratio, err, len(weights)) + struct.pack('<%df' % len(weights), *weights)); f.write(V.astype(np.float32).tobytes()); f.write(I.astype(np.uint32).tobytes())
    r = subprocess.run([msimp, work + '/s4_in.bin', work + '/s4_out.bin'], check=True, stderr=subprocess.PIPE); print('  ', r.stderr.decode().strip())
    o = open(work + '/s4_out.bin', 'rb').read(); nv, ni = struct.unpack('<II', o[:8])
    vb = np.frombuffer(o[12:12 + nv * st * 4], np.float32).reshape(nv, st).astype(np.float64)
    ib = np.frombuffer(o[12 + nv * st * 4:12 + nv * st * 4 + ni * 4], np.uint32).astype(np.int64)
    return vb, ib
def vnormals(Pv, I):
    # smooth across uv seams: normals summed per position
    q = np.round(Pv / tol).astype(np.int64); _, pinv = np.unique(q, axis=0, return_inverse=True); pinv = pinv.reshape(-1)
    t = I.reshape(-1, 3); n = np.cross(Pv[t[:, 1]] - Pv[t[:, 0]], Pv[t[:, 2]] - Pv[t[:, 0]])
    Np = np.zeros((pinv.max() + 1, 3))
    for k in range(3): np.add.at(Np, pinv[t[:, k]], n)
    N = Np[pinv]; return N / (np.linalg.norm(N, axis=1, keepdims=True) + 1e-12)
def q16(a):
    a = np.asarray(a, np.float64); lo_ = a.min(0); hi_ = a.max(0); span = np.where(hi_ - lo_ > 1e-9, hi_ - lo_, 1)
    qq = np.round((a - lo_) / span * 65534 - 32767).astype(np.int16)
    return {'data': base64.b64encode(qq.tobytes()).decode(), 'min': [round(float(v), 5) for v in lo_], 'max': [round(float(v), 5) for v in hi_]}
SRC = [Image.open(os.path.join(g.dir, g.js['images'][k]['uri'])).convert('RGB') for k in IMGS]
def atlas(sz, fn):
    im = Image.new('RGB', (sz * NT, sz))
    for k, s_ in enumerate(SRC): im.paste(s_.resize((sz, sz), Image.LANCZOS), (k * sz, 0))
    im.save(os.path.join(outd, fn), quality=O.get('q', 86), optimize=True); return os.path.getsize(os.path.join(outd, fn))

lods = []; V = np.c_[PV, UVW]; I = T.reshape(-1)
for k, (tris, res) in enumerate(O['lods']):
    vb, ib = simplify(V, I, tris, O.get('err', 0.02), [O.get('uvw', 1.0)] * 2)
    if len(ib) // 3 > tris * 1.5:            # held up by seams: a sloppier pass for the far levels
        vb, ib = simplify(V, I, tris, O.get('err', 0.02) * 4, [O.get('uvw', 1.0) * 0.25] * 2)
    V, I = vb, ib
    Pv = vb[:, :3]; uv = vb[:, 3:5]; Nn = vnormals(Pv, ib)
    fn = f'{name}_{k}.jpg'; sz0 = atlas(res, fn)
    hi_fn = None
    if k == 0 and O.get('hires'): hi_fn = f'{name}_{k}h.jpg'; atlas(O['hires'], hi_fn)
    u32 = len(Pv) >= 65536
    lods.append({'n': int(len(Pv)), 'pos': q16(Pv), 'nrm': base64.b64encode(np.clip(np.round(Nn * 127), -127, 127).astype(np.int8).tobytes()).decode(),
                 'uv': q16(uv), 'idx': {'data': base64.b64encode(ib.astype(np.uint32 if u32 else np.uint16).tobytes()).decode(), 'u32': bool(u32)},
                 'tris': int(len(ib) // 3), 'tex': fn, **({'texHi': hi_fn} if hi_fn else {})})
    print('  lod', k, 'tris', len(ib) // 3, 'verts', len(Pv), 'tex', res * NT, 'x', res, sz0, round(time.time() - t0, 1), 's')

# the height grid (as um_scan2): the top surface over each cell, padded, with the distance to the scan
n = O.get('hf', 112); pad = O.get('pad', 34); x0, z0 = P0[:, 0].min(), P0[:, 2].min(); wdt = max(P0[:, 0].max() - x0, P0[:, 2].max() - z0) * 1.0001; cell = wdt / n
ix = np.clip(((P0[:, 0] - x0) / cell).astype(int), 0, n - 1); iz = np.clip(((P0[:, 2] - z0) / cell).astype(int), 0, n - 1)
H = np.full(n * n, -1.0); np.maximum.at(H, iz * n + ix, P0[:, 1]); H = H.reshape(n, n)
inside = H >= 0
inside = ndimage.binary_closing(inside, iterations=2) & ndimage.binary_fill_holes(inside) | inside
N2 = n + pad * 2; HP = np.full((N2, N2), -1.0); HP[pad:pad + n, pad:pad + n] = np.where(inside, H, -1)
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
json.dump(meta, open(os.path.join(outd, name + '.json'), 'w'), separators=(',', ':'))
print('wrote', name + '.json', os.path.getsize(os.path.join(outd, name + '.json')), round(time.time() - t0, 1), 's')
