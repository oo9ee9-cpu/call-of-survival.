"""the UAZ-469 (zhe_kan, CC-BY 4.0) made game-ready, written straight in the game's model format ({gltf, bin} JSON + images):
 - every part baked to world space, standing on the ground, origin at the middle of the wheelbase, facing +z
 - the four road wheels cut out; one wheel mesh (front-left, simplified) shared by four nodes, the right-hand ones mirrored
 - untextured parts merged by finish into three vertex-coloured materials (matte / satin / metal), textured parts kept apart
 - every merged part simplified with meshoptimizer; images resized; heavy maps dropped
usage: python3 -I um_car2.py <scene.gltf> <out_dir> <name> <wheel-group-node> <msimplify> '{options}'
  options: {"body": [ratio, err], "wheel": [ratio, err], "img": {"Paint_body_baseColor": 1024, ...}, "imgDefault": 512, "dropNormal": ["Pain_bump", ...]}"""
import sys, os, json, struct, base64, subprocess, io
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gltfread import G

src, outd, name, wheel_node, msimp, opts = sys.argv[1:7]
O = json.loads(opts)
work = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'build'); os.makedirs(work, exist_ok=True)
g = G(src); js = g.js
parent = {}
for i, n in enumerate(js['nodes']):
    for c in n.get('children', []): parent[c] = i
def under(ni, nm):
    while True:
        if js['nodes'][ni].get('name', '').startswith(nm): return True
        if ni not in parent: return False
        ni = parent[ni]
mats = js['materials']
def tex_of(m, key):
    p = m.get('pbrMetallicRoughness', {})
    t = p.get(key) if key in ('baseColorTexture', 'metallicRoughnessTexture') else m.get(key)
    return t
def plain_class(m):
    nm = m.get('name', ''); p = m.get('pbrMetallicRoughness', {})
    if nm in ('Chrome', 'Mirror'): return 'metal'
    if nm == 'Tire': return 'matte'
    r = p.get('roughnessFactor', 1.0)
    return 'matte' if r >= 0.5 else 'satin'
CLASS = {'matte': (0.78, 0.0), 'satin': (0.38, 0.05), 'metal': (0.2, 0.85)}
# ---- gather triangles (world space) per (group, key) ----
parts = {}   # (group, key) -> list of (P, N, UV, C, I)
for ni, mi, pi, p, M in g.prims():
    P = g.acc(p['attributes']['POSITION']); R = M[:3, :3]; Pw = P @ R.T + M[:3, 3]
    nrm = np.linalg.inv(R).T
    N = g.acc(p['attributes']['NORMAL']) @ nrm.T if 'NORMAL' in p['attributes'] else np.zeros_like(Pw)
    N /= np.linalg.norm(N, axis=1, keepdims=True) + 1e-12
    UV = g.acc(p['attributes']['TEXCOORD_0']) if 'TEXCOORD_0' in p['attributes'] else np.zeros((len(P), 2))
    I = g.acc(p['indices']).reshape(-1, 3).astype(np.int64) if 'indices' in p else np.arange(len(P)).reshape(-1, 3)
    if np.linalg.det(R) < 0: I = I[:, [0, 2, 1]]
    m = mats[p.get('material', 0)]
    textured = tex_of(m, 'baseColorTexture') is not None or m.get('alphaMode') == 'BLEND'
    key = m['name'] if textured else plain_class(m)
    bc = np.array(m.get('pbrMetallicRoughness', {}).get('baseColorFactor', [1, 1, 1, 1])[:3])
    if m['name'] == 'Tire': bc = np.array([0.028, 0.028, 0.03])
    C = np.tile(bc, (len(P), 1))
    if under(ni, wheel_node):
        cen = Pw[I].mean(1)
        sel = (cen[:, 0] > 0) & (cen[:, 2] > 0)            # front-left wheel only: the other three reuse it
        if sel.any(): parts.setdefault(('wheel', 'wheel'), []).append((Pw, N, UV, C, I[sel]))
        # hubs of all four, from their vertex bounds
        for q, s in (('fl', (cen[:, 0] > 0) & (cen[:, 2] > 0)), ('fr', (cen[:, 0] <= 0) & (cen[:, 2] > 0)), ('rl', (cen[:, 0] > 0) & (cen[:, 2] <= 0)), ('rr', (cen[:, 0] <= 0) & (cen[:, 2] <= 0))):
            if s.any():
                pts = Pw[np.unique(I[s])]
                parts.setdefault(('hub', q), []).append(pts)
    elif key == 'Light':          # front lamps and rear lamps apart: the game lights them separately (headlights / brake lights)
        cz = Pw[I].mean(1)[:, 2]
        if (cz >= 0).any(): parts.setdefault(('body', 'Light'), []).append((Pw, N, UV, C, I[cz >= 0]))
        if (cz < 0).any(): parts.setdefault(('body', 'LightRear'), []).append((Pw, N, UV, C, I[cz < 0]))
    else:
        parts.setdefault(('body', key), []).append((Pw, N, UV, C, I))
# ---- placement: ground at y=0, x centred, origin at mid wheelbase ----
allP = np.concatenate([P for k, v in parts.items() if k[0] in ('body', 'wheel') for (P, _, _, _, _) in v] + [np.concatenate(parts[('hub', q)]) for q in ('fl', 'fr', 'rl', 'rr')])
lo, hi = allP.min(0), allP.max(0)
hub = {}
for q in ('fl', 'fr', 'rl', 'rr'):
    pts = np.concatenate(parts.pop(('hub', q))); hub[q] = (pts.min(0) + pts.max(0)) / 2
    hub[q + '_r'] = (pts.max(0)[1] - pts.min(0)[1]) / 2
zc = (hub['fl'][2] + hub['rl'][2]) / 2
shift = np.array([-(lo[0] + hi[0]) / 2, -lo[1], -zc])
for q in ('fl', 'fr', 'rl', 'rr'): hub[q] = hub[q] + shift
print('hubs', {q: np.round(hub[q], 3).tolist() for q in ('fl', 'fr', 'rl', 'rr')}, 'wheel r', round(float(hub['fl_r']), 3), 'size', np.round(hi - lo, 3), 'z range', round(float(lo[2] + shift[2]), 3), round(float(hi[2] + shift[2]), 3))
# ---- simplify ----
def simplify(V, I, ratio, err):
    st = V.shape[1]
    head = struct.pack('<IIIffI', len(V), I.size, st, ratio, err, 0)
    open(work + '/uc_in.bin', 'wb').write(head + V.astype(np.float32).tobytes() + I.astype(np.uint32).tobytes())
    r = subprocess.run([msimp, work + '/uc_in.bin', work + '/uc_out.bin'], check=True, stderr=subprocess.PIPE)
    o = open(work + '/uc_out.bin', 'rb').read(); nv, ni = struct.unpack('<II', o[:8])
    vb = np.frombuffer(o[12:12 + nv * st * 4], np.float32).reshape(nv, st).copy(); ib = np.frombuffer(o[12 + nv * st * 4:12 + nv * st * 4 + ni * 4], np.uint32).copy()
    return vb, ib
new = {'asset': {'version': '2.0', 'generator': 'rock-island um_car2'}, 'extensionsUsed': ['KHR_mesh_quantization'], 'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'name': name, 'children': []}], 'meshes': [], 'accessors': [], 'bufferViews': [], 'materials': []}
chunks = []; total = [0]
def add_q(arr, signed):
    # a VEC3 in 8-bit normalised integers, padded to 4 bytes per vertex (KHR_mesh_quantization layout)
    q = np.zeros((len(arr), 4), np.int8 if signed else np.uint8)
    q[:, :3] = np.round(np.clip(arr, -1, 1) * 127) if signed else np.round(np.clip(arr, 0, 1) * 255)
    data = q.tobytes(); pad = (4 - total[0] % 4) % 4
    if pad: chunks.append(b'\0' * pad); total[0] += pad
    new['bufferViews'].append({'buffer': 0, 'byteOffset': total[0], 'byteLength': len(data), 'byteStride': 4, 'target': 34962}); chunks.append(data); total[0] += len(data)
    new['accessors'].append({'bufferView': len(new['bufferViews']) - 1, 'componentType': 5120 if signed else 5121, 'normalized': True, 'count': int(len(arr)), 'type': 'VEC3'})
    return len(new['accessors']) - 1
def add(arr, ctype, typ, target=None, minmax=False):
    data = np.ascontiguousarray(arr).tobytes(); pad = (4 - total[0] % 4) % 4
    if pad: chunks.append(b'\0' * pad); total[0] += pad
    bv = {'buffer': 0, 'byteOffset': total[0], 'byteLength': len(data)}
    if target: bv['target'] = target
    new['bufferViews'].append(bv); chunks.append(data); total[0] += len(data)
    a = {'bufferView': len(new['bufferViews']) - 1, 'componentType': ctype, 'count': int(arr.shape[0]), 'type': typ}
    if minmax: a['min'] = [float(v) for v in arr.min(0)]; a['max'] = [float(v) for v in arr.max(0)]
    new['accessors'].append(a); return len(new['accessors']) - 1
# materials: textured ones copied without the extras the game does not use, plain classes made here
images_out = []; tex_out = []; img_map = {}
def texture(tinfo, nm):
    if tinfo is None or O.get('noImages'): return None          # a far level of detail borrows the near one's materials in the game
    srci = js['textures'][tinfo['index']]['source']
    if srci not in img_map:
        im = Image.open(os.path.join(g.dir, js['images'][srci]['uri'])); im.load()
        base = os.path.splitext(os.path.basename(js['images'][srci]['uri']))[0]
        mx = O.get('img', {}).get(base, O.get('imgDefault', 512)); s = min(1, mx / max(im.size))
        if s < 1: im = im.resize((max(1, round(im.size[0] * s)), max(1, round(im.size[1] * s))), Image.LANCZOS)
        fn = f'{name}_{len(images_out)}.jpg'; im.convert('RGB').save(os.path.join(outd, fn), quality=O.get('quality', 86), optimize=True)
        images_out.append({'uri': fn, 'mimeType': 'image/jpeg', 'name': base}); tex_out.append({'sampler': 0, 'source': len(images_out) - 1})
        img_map[srci] = len(tex_out) - 1
    return {'index': img_map[srci]}
mat_index = {}
def material(key):
    if key in mat_index: return mat_index[key]
    if key in CLASS:
        r, mtl = CLASS[key]; m2 = {'name': 'uaz_' + key, 'pbrMetallicRoughness': {'baseColorFactor': [1, 1, 1, 1], 'roughnessFactor': r, 'metallicFactor': mtl}}
    elif key == 'wheel':
        m2 = {'name': 'uaz_wheel', 'pbrMetallicRoughness': {'baseColorFactor': [1, 1, 1, 1], 'roughnessFactor': 0.72, 'metallicFactor': 0.0}}
    else:
        m = next(mm for mm in mats if mm['name'] == {'LightRear': 'Light'}.get(key, key)); p = m.get('pbrMetallicRoughness', {})
        m2 = {'name': key, 'pbrMetallicRoughness': {'baseColorFactor': p.get('baseColorFactor', [1, 1, 1, 1]), 'roughnessFactor': p.get('roughnessFactor', 0.5), 'metallicFactor': p.get('metallicFactor', 0.0)}}
        if p.get('metallicRoughnessTexture'):           # dropped: keep its average as the factors
            src_img = js['images'][js['textures'][p['metallicRoughnessTexture']['index']]['source']]['uri']
            a = np.asarray(Image.open(os.path.join(g.dir, src_img)).convert('RGB'), np.float32) / 255
            m2['pbrMetallicRoughness']['roughnessFactor'] = round(float(a[..., 1].mean()) * p.get('roughnessFactor', 1.0), 3)
            m2['pbrMetallicRoughness']['metallicFactor'] = round(float(a[..., 2].mean()) * p.get('metallicFactor', 1.0), 3)
        t = texture(p.get('baseColorTexture'), key)
        if t: m2['pbrMetallicRoughness']['baseColorTexture'] = t
        if m.get('normalTexture') and key not in O.get('dropNormal', []) and m['normalTexture'].get('texCoord', 0) == 0:
            tn = texture(m['normalTexture'], key)
            if tn: m2['normalTexture'] = tn
        if m.get('alphaMode'): m2['alphaMode'] = m['alphaMode']
        if m.get('doubleSided'): m2['doubleSided'] = True
    new['materials'].append(m2); mat_index[key] = len(new['materials']) - 1; return mat_index[key]
def weld(P, U, C, I, use_uv):
    cols = [np.round(P / 2e-4), np.round(C * 255)] + ([np.round(U * 2048)] if use_uv else [])
    key = np.concatenate(cols, 1).astype(np.int64)
    _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
    inv = inv.reshape(-1); I2 = inv[I.reshape(-1)].reshape(-1, 3)
    ok = (I2[:, 0] != I2[:, 1]) & (I2[:, 1] != I2[:, 2]) & (I2[:, 0] != I2[:, 2])
    return P[first], U[first], C[first], I2[ok]
def crease_normals(P, T, cos_lim):
    """per-corner normals: area-weighted average of the faces around the vertex that bend less than the crease angle; vertices split where they differ"""
    fn = np.cross(P[T[:, 1]] - P[T[:, 0]], P[T[:, 2]] - P[T[:, 0]]); fu = fn / (np.linalg.norm(fn, axis=1, keepdims=True) + 1e-20)
    cv = T.reshape(-1); cf = np.repeat(np.arange(len(T)), 3)
    order = np.argsort(cv, kind='stable'); cv_s = cv[order]; cf_s = cf[order]
    starts = np.searchsorted(cv_s, np.arange(len(P) + 1))
    CN = np.zeros((len(cv), 3))
    for v in range(len(P)):
        a, b = starts[v], starts[v + 1]
        if a == b: continue
        fs = cf_s[a:b]; d = fu[fs] @ fu[fs].T                    # k x k
        n = (d > cos_lim).astype(np.float64) @ fn[fs]            # each corner: sum of its smooth neighbours
        n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-20
        CN[order[a:b]] = n
    # split vertices by (vertex, quantised normal)
    key = np.concatenate([cv[:, None], np.round(CN * 64).astype(np.int64)], 1)
    _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
    return cv[first], CN[first], inv.reshape(-1, 3)
def build_mesh(group, offset):
    mesh = {'name': group, 'primitives': []}; tin = tout = 0
    for (gk, key), lst in sorted(parts.items()):
        if gk != group: continue
        Ps, Ns, Us, Cs, Is = [], [], [], [], []; base = 0
        for (P, N, UV, C, I) in lst:
            used = np.unique(I); remap = -np.ones(len(P), np.int64); remap[used] = np.arange(len(used))
            Ps.append(P[used] + shift - offset); Ns.append(N[used]); Us.append(UV[used]); Cs.append(C[used]); Is.append(remap[I] + base); base += len(used)
        P = np.concatenate(Ps); N = np.concatenate(Ns); U = np.concatenate(Us); C = np.concatenate(Cs); I = np.concatenate(Is).reshape(-1)
        ratio, err = O.get(group, [0.3, 0.004])
        if key in O.get('keep', []): ratio = 1.0
        textured = key not in CLASS and key != 'wheel'
        tin += I.size // 3
        if ratio < 1 and I.size // 3 > 200 and key not in O.get('noWeld', []):
            # weld by position (+uv / colour): normals are rebuilt afterwards, so hard edges no longer block the simplifier
            Pw_, Uw, Cw, Tw = weld(P, U, C, I, textured)
            V = np.concatenate([Pw_, Uw, Cw], 1)
            vb, ib = simplify(V, Tw.reshape(-1), ratio, err)
            T = ib.reshape(-1, 3).astype(np.int64); src_v, NN, T2 = crease_normals(vb[:, 0:3].astype(np.float64), T, np.cos(np.radians(O.get('crease', 38))))
            vb = np.concatenate([vb[src_v][:, 0:3], NN, vb[src_v][:, 3:5], vb[src_v][:, 5:8]], 1).astype(np.float32); ib = T2.reshape(-1).astype(np.uint32)
        else:
            vb = np.concatenate([P, N, U, C], 1).astype(np.float32); ib = I.astype(np.uint32)
        tout += ib.size // 3
        nn = vb[:, 3:6]; nn /= np.linalg.norm(nn, axis=1, keepdims=True) + 1e-12
        nn[np.linalg.norm(nn, axis=1) < 0.5] = [0, 1, 0]          # never a zero normal (NaN in the shader, black frame through the bloom)
        attrs = {'POSITION': add(vb[:, 0:3].astype(np.float32), 5126, 'VEC3', 34962, True), 'NORMAL': add_q(nn, True)}
        if textured: attrs['TEXCOORD_0'] = add(vb[:, 6:8].astype(np.float32), 5126, 'VEC2', 34962)
        else: attrs['COLOR_0'] = add_q(np.clip(vb[:, 8:11], 0, 1), False)
        big = len(vb) >= 65536
        prim = {'attributes': attrs, 'indices': add(ib.astype(np.uint32 if big else np.uint16), 5125 if big else 5123, 'SCALAR', 34963), 'material': material(key)}
        mesh['primitives'].append(prim)
        print(f'  {group:6s} {key:16s} {I.size // 3:7d} -> {ib.size // 3:6d} tris {len(vb):6d} verts')
    new['meshes'].append(mesh); print(group, tin, '->', tout); return len(new['meshes']) - 1
os.makedirs(outd, exist_ok=True)
body = build_mesh('body', np.zeros(3))
new['nodes'].append({'name': 'body', 'mesh': body}); new['nodes'][0]['children'].append(1)
wm = build_mesh('wheel', hub['fl'])
for q in ('fl', 'fr', 'rl', 'rr'):
    nd = {'name': 'wheel_' + q, 'mesh': wm, 'translation': [float(v) for v in hub[q]]}
    if q in ('fr', 'rr'): nd['scale'] = [-1, 1, 1]
    new['nodes'].append(nd); new['nodes'][0]['children'].append(len(new['nodes']) - 1)
new['images'] = images_out; new['textures'] = tex_out; new['samplers'] = [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497}]
bin_all = b''.join(chunks); new['buffers'] = [{'byteLength': len(bin_all)}]
new['extras'] = {'wheelR': round(float(hub['fl_r']), 3), 'wb': round(float(hub['fl'][2] - hub['rl'][2]), 3), 'track': round(float(hub['fl'][0] - hub['fr'][0]), 3), 'size': [round(float(v), 3) for v in (hi - lo)]}
json.dump({'gltf': new, 'bin': base64.b64encode(bin_all).decode()}, open(os.path.join(outd, name + '.json'), 'w'), separators=(',', ':'))
print('wrote', name, 'bin', len(bin_all), 'json', os.path.getsize(os.path.join(outd, name + '.json')), 'images', [(i['uri'], i['name'], os.path.getsize(os.path.join(outd, i['uri']))) for i in images_out], 'extras', new['extras'])
