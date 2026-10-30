# pack Poly Haven (CC0) scanned rocks, cliffs, a fallen trunk, dry branches, moss and a quiver tree out of the
# Babylon coastalCliff scene into a compact game file: quantised LOD0/LOD1 geometry + two texture-array strips
# usage: python3 -I pack_scans.py <decoded coastalCliff.glb> <image dir> <out dir> <msimplify path>
import sys, os, json, struct, base64, subprocess, glob
import numpy as np
from PIL import Image
glb, imgdir, outd, msimp = sys.argv[1:5]
work = os.path.join(outd, '..', '..', 'build')
os.makedirs(work, exist_ok=True)
b = open(glb, 'rb').read()
off = 12; js = None; binc = None
while off < len(b):
    L, T = struct.unpack('<II', b[off:off + 8]); c = b[off + 8:off + 8 + L]
    if T == 0x4E4F534A: js = json.loads(c)
    elif T == 0x004E4942: binc = c
    off += 8 + L
CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}
def acc(i):
    a = js['accessors'][i]; bv = js['bufferViews'][a['bufferView']]
    n = a['count'] * NC[a['type']]; dt = CT[a['componentType']]
    start = bv.get('byteOffset', 0) + a.get('byteOffset', 0); stride = bv.get('byteStride')
    item = NC[a['type']] * np.dtype(dt).itemsize
    if stride and stride != item:
        raw = np.frombuffer(binc, dtype=np.uint8, count=stride * a['count'], offset=start).reshape(a['count'], stride)[:, :item]
        return np.frombuffer(raw.tobytes(), dtype=dt).reshape(a['count'], NC[a['type']]).astype(np.float64 if dt == np.float32 else np.int64)
    arr = np.frombuffer(binc, dtype=dt, count=n, offset=start)
    return arr.reshape(a['count'], NC[a['type']]) if NC[a['type']] > 1 else arr.copy()
# texture sets: material name -> layer
LAYERS = ['rock_moss_set_01', 'rock_moss_set_02', 'coast_land_rocks_04', 'namaqualand_cliff_01', 'namaqualand_cliff_02', 'coastal_cliff_01', 'tree_trunk', 'dry_branches_medium_01', 'quiver_tree_02', 'moss_01']
# objects: name, mesh index, lod0 tris, lod1 tris
OBJ = [('boulder_a', 5, 1600, 300), ('boulder_b', 16, 1600, 300), ('boulder_f', 9, 1400, 260), ('rock01', 15, 900, 180), ('rock02', 6, 1100, 200),
       ('rock05', 14, 900, 180), ('mossy07', 8, 1400, 260), ('mossy10', 7, 1200, 240), ('flat', 3, 2600, 500), ('cliff1', 1, 3000, 600), ('cliff2', 2, 3000, 600),
       ('cliff0', 0, 2400, 500), ('log', 13, 2200, 500), ('branches', 4, 1400, 400), ('quiver', 12, 3000, 700)]
ERR = {'log': -0.5, 'branches': 0.4}
def simplify(P, N, U, I, target, err=0.08):
    n = len(P); st = 8
    v = np.concatenate([P, N, U], axis=1).astype(np.float32)
    ratio = min(1.0, target * 3 / len(I))
    head = struct.pack('<IIIffI', n, len(I), st, ratio, err, 5)
    w = np.array([0.5, 0.5, 0.5, 0.25, 0.25], np.float32)
    open(work + '/scan_in.bin', 'wb').write(head + w.tobytes() + v.tobytes() + I.astype(np.uint32).tobytes())
    subprocess.run([msimp, work + '/scan_in.bin', work + '/scan_out.bin'], check=True, stderr=subprocess.PIPE)
    o = open(work + '/scan_out.bin', 'rb').read(); nv, ni = struct.unpack('<II', o[:8])
    vb = np.frombuffer(o[12:12 + nv * st * 4], np.float32).reshape(nv, st); ib = np.frombuffer(o[12 + nv * st * 4:12 + nv * st * 4 + ni * 4], np.uint32)
    return vb[:, 0:3], vb[:, 3:6], vb[:, 6:8], ib
def quant(arr, comps):
    mn = arr.min(0); mx = arr.max(0); r = np.where(mx - mn > 0, mx - mn, 1)
    q = np.round((arr - mn) / r * 65534 - 32767).astype(np.int16)
    return {'data': base64.b64encode(q.tobytes()).decode(), 'min': [float(x) for x in mn], 'max': [float(x) for x in mx]}
def pack(P, N, U, I):
    nl = np.linalg.norm(N, axis=1, keepdims=True); N = N / np.where(nl > 0, nl, 1)
    n8 = np.round(np.clip(N, -1, 1) * 127).astype(np.int8)
    idx = I.astype(np.uint16) if len(P) < 65536 else I.astype(np.uint32)
    return {'n': int(len(P)), 'pos': quant(P, 3), 'nrm': base64.b64encode(n8.tobytes()).decode(), 'uv': quant(U, 2), 'idx': {'data': base64.b64encode(idx.tobytes()).decode(), 'u32': len(P) >= 65536}, 'tris': int(len(I) // 3)}
out = {'v': 1, 'layers': LAYERS, 'objects': {}}
for name, mi, t0, t1 in OBJ:
    pr = js['meshes'][mi]['primitives'][0]
    P = acc(pr['attributes']['POSITION']).astype(np.float64); N = acc(pr['attributes']['NORMAL']).astype(np.float64); U = acc(pr['attributes']['TEXCOORD_0']).astype(np.float64)
    I = acc(pr['indices']).astype(np.int64).reshape(-1)
    # the primitive node mirrors x (rotation 180 about z, scale -1 on y): undo it and fix the winding
    P[:, 0] *= -1; N[:, 0] *= -1; I = I.reshape(-1, 3)[:, [0, 2, 1]].reshape(-1)
    mat = js['materials'][pr['material']]['name']; layer = LAYERS.index(mat)
    # sit on the ground, centred
    mn = P.min(0); mx = P.max(0); P[:, 0] -= (mn[0] + mx[0]) / 2; P[:, 2] -= (mn[2] + mx[2]) / 2; P[:, 1] -= mn[1]
    e = ERR.get(name, 0.08); l0 = simplify(P, N, U, I, t0, e); l1 = simplify(P, N, U, I, t1, e if e < 0 else max(e, 0.25))
    size = (P.max(0) - P.min(0)).tolist()
    out['objects'][name] = {'layer': layer, 'size': [round(s, 3) for s in size], 'alpha': mat == 'moss_01', 'lod0': pack(*l0), 'lod1': pack(*l1)}
    print(name, mat, 'size', [round(s, 2) for s in size], 'tris', len(I) // 3, '->', len(l0[3]) // 3, len(l1[3]) // 3)
os.makedirs(outd, exist_ok=True)
json.dump(out, open(os.path.join(outd, 'scans.json'), 'w'), separators=(',', ':'))
# texture strips (512 per layer): albedo with alpha (webp), normal (jpg)
def img_of(mat_name, slot):
    m = next(m for m in js['materials'] if m['name'] == mat_name)
    t = m['pbrMetallicRoughness']['baseColorTexture']['index'] if slot == 'base' else m.get('normalTexture', {}).get('index')
    if t is None: return None
    src = js['textures'][t]['source']
    f = glob.glob(os.path.join(imgdir, f'img{src}_*'))[0]
    return Image.open(f)
alb, nrm = [], []
for L in LAYERS:
    a = img_of(L, 'base').convert('RGBA').resize((512, 512), Image.LANCZOS); alb.append(np.array(a))
    n = img_of(L, 'normal'); n = (n.convert('RGB') if n else Image.new('RGB', (512, 512), (128, 128, 255))).resize((512, 512), Image.LANCZOS); nrm.append(np.array(n))
Image.fromarray(np.concatenate(alb, 0), 'RGBA').save(os.path.join(outd, 'scans_albedo.webp'), quality=86, method=6)
Image.fromarray(np.concatenate(nrm, 0), 'RGB').save(os.path.join(outd, 'scans_normal.jpg'), quality=84, optimize=True)
for f in ['scans.json', 'scans_albedo.webp', 'scans_normal.jpg']: print(f, os.path.getsize(os.path.join(outd, f)))
