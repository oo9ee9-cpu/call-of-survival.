"""a photogrammetry scan (one textured mesh in pieces) → a compact game asset: three levels of detail, a top-down height grid
for walking on it, and one texture. usage:
  python3 -I um_scan.py <scene.gltf> <out_dir> <name> <msimplify> '{"lods":[40000,8000,1500],"img":2048,"hf":96}'"""
import sys, os, json, base64, struct, subprocess
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gltfread import G
Image.MAX_IMAGE_PIXELS = None

src, outd, name, msimp, opts = sys.argv[1:6]
O = json.loads(opts)
g = G(src)
Ps, Ns, Us, Is = [], [], [], []; off = 0; img_index = None
for ni, mi, pi, p, M in g.prims():
    P = g.acc(p['attributes']['POSITION']); N = g.acc(p['attributes']['NORMAL']); UV = g.acc(p['attributes']['TEXCOORD_0'])
    I = g.acc(p['indices']).reshape(-1).astype(np.int64) if 'indices' in p else np.arange(len(P))
    R = M[:3, :3]; Ps.append(P @ R.T + M[:3, 3]); Nw = N @ R.T; Ns.append(Nw / (np.linalg.norm(Nw, axis=1, keepdims=True) + 1e-9)); Us.append(UV)
    Is.append(I + off); off += len(P)
    mat = g.js['materials'][p['material']]; bt = mat.get('pbrMetallicRoughness', {}).get('baseColorTexture')
    if bt and img_index is None: img_index = g.js['textures'][bt['index']]['source']
P = np.concatenate(Ps); N = np.concatenate(Ns); UV = np.concatenate(Us); I = np.concatenate(Is)
# stand it on the ground at the origin
lo, hi = P.min(0), P.max(0); c = (lo + hi) / 2
P = P - np.array([c[0], lo[1], c[2]])
size = P.max(0) - P.min(0)
print(name, 'verts', len(P), 'tris', len(I) // 3, 'size', np.round(size, 1))

def simplify(V, I, tris, err, weights):
    work = os.path.join(outd, '_msimp'); os.makedirs(work, exist_ok=True)
    st = V.shape[1]; ratio = min(1.0, tris * 3 / len(I))
    head = struct.pack('<IIIffI', len(V), len(I), st, ratio, err, len(weights)) + struct.pack('<%df' % len(weights), *weights)
    with open(work + '/in.bin', 'wb') as f: f.write(head); f.write(V.astype(np.float32).tobytes()); f.write(I.astype(np.uint32).tobytes())
    r = subprocess.run([msimp, work + '/in.bin', work + '/out.bin'], check=True, stderr=subprocess.PIPE); print('  ', r.stderr.decode().strip())
    o = open(work + '/out.bin', 'rb').read(); nv, ni = struct.unpack('<II', o[:8])
    vb = np.frombuffer(o[12:12 + nv * st * 4], np.float32).reshape(nv, st).astype(np.float64)
    ib = np.frombuffer(o[12 + nv * st * 4:12 + nv * st * 4 + ni * 4], np.uint32).astype(np.int64)
    return vb, ib

def q16(a):
    a = np.asarray(a, np.float64); lo = a.min(0); hi = a.max(0); span = np.where(hi - lo > 1e-9, hi - lo, 1)
    q = np.round((a - lo) / span * 65534 - 32767).astype(np.int16)
    return {'data': base64.b64encode(q.tobytes()).decode(), 'min': [round(float(v), 5) for v in lo], 'max': [round(float(v), 5) for v in hi]}
def enc(vb, ib):
    n = len(vb); nrm = vb[:, 3:6]; nrm = nrm / (np.linalg.norm(nrm, axis=1, keepdims=True) + 1e-9)
    u32 = n >= 65536
    return {'n': int(n), 'pos': q16(vb[:, 0:3]), 'nrm': base64.b64encode(np.clip(np.round(nrm * 127), -127, 127).astype(np.int8).tobytes()).decode(),
            'uv': q16(vb[:, 6:8]), 'idx': {'data': base64.b64encode(ib.astype(np.uint32 if u32 else np.uint16).tobytes()).decode(), 'u32': bool(u32)}, 'tris': int(len(ib) // 3)}

V = np.c_[P, N, UV]
lods = []
src_v, src_i = V, I
for k, tris in enumerate(O['lods']):
    # each level from the previous one: fast, and the far shapes stay faithful to the near ones
    vb, ib = simplify(src_v, src_i, tris, O.get('err', 0.08), [0.5, 0.5, 0.5, 1.5, 1.5])
    lods.append(enc(vb, ib)); src_v, src_i = vb, ib
    print('  lod', k, 'tris', len(ib) // 3, 'verts', len(vb))

# the height grid: the highest surface over each cell, from the full scan
n = O.get('hf', 96); x0, z0 = P[:, 0].min(), P[:, 2].min(); w = max(P[:, 0].max() - x0, P[:, 2].max() - z0) * 1.0001
cell = w / n
ix = np.clip(((P[:, 0] - x0) / cell).astype(int), 0, n - 1); iz = np.clip(((P[:, 2] - z0) / cell).astype(int), 0, n - 1)
H = np.full(n * n, -1.0); np.maximum.at(H, iz * n + ix, P[:, 1]); H = H.reshape(n, n)
hq = np.where(H < 0, 0, np.round(H / max(1e-6, H.max()) * 65535)).astype(np.uint16)
meta = {'name': name, 'size': [round(float(v), 3) for v in size], 'hf': {'n': n, 'x0': round(float(x0), 4), 'z0': round(float(z0), 4), 'cell': round(float(cell), 5), 'hmax': round(float(H.max()), 4),
        'data': base64.b64encode(hq.tobytes()).decode(), 'mask': base64.b64encode(np.packbits((H >= 0).reshape(-1)).tobytes()).decode()}, 'lods': lods}
os.makedirs(outd, exist_ok=True)
json.dump(meta, open(os.path.join(outd, name + '.json'), 'w'), separators=(',', ':'))
# the texture
im = g.js['images'][img_index]; img = Image.open(os.path.join(g.dir, im['uri'])).convert('RGB')
sz = O.get('img', 2048); img = img.resize((sz, sz), Image.LANCZOS); img.save(os.path.join(outd, name + '.jpg'), quality=O.get('q', 88), optimize=True)
print('wrote', name, os.path.getsize(os.path.join(outd, name + '.json')), os.path.getsize(os.path.join(outd, name + '.jpg')), 'hf coverage', round(float((H >= 0).mean()), 3))
