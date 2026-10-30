"""the UAZ-469 (zhe_kan, CC-BY 4.0) → a GLB the game can drive: everything flattened into one body node, the four road wheels
cut apart into their own nodes pivoting at the hubs (wheel_fl, wheel_fr, wheel_rl, wheel_rr), facing +z, on the ground.
usage: python3 -I um_car.py <scene.gltf> <out.glb> <wheel-group-node-name>"""
import sys, os, json, struct
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gltfread import G

src, out, wheel_node = sys.argv[1:4]
g = G(src); js = g.js
# which top node each primitive hangs under
parent = {}
for i, n in enumerate(js['nodes']):
    for c in n.get('children', []): parent[c] = i
def under(ni, name):
    while ni in parent:
        if js['nodes'][ni].get('name', '').startswith(name): return True
        ni = parent[ni]
    return js['nodes'][ni].get('name', '').startswith(name)
groups = {'body': [], 'wheel_fl': [], 'wheel_fr': [], 'wheel_rl': [], 'wheel_rr': []}
for ni, mi, pi, p, M in g.prims():
    P = g.acc(p['attributes']['POSITION']); R = M[:3, :3]; Pw = P @ R.T + M[:3, 3]
    N = g.acc(p['attributes']['NORMAL']) @ R.T if 'NORMAL' in p['attributes'] else np.zeros_like(Pw)
    N /= np.linalg.norm(N, axis=1, keepdims=True) + 1e-12
    UV = g.acc(p['attributes']['TEXCOORD_0']) if 'TEXCOORD_0' in p['attributes'] else np.zeros((len(P), 2))
    I = g.acc(p['indices']).reshape(-1, 3).astype(np.int64) if 'indices' in p else np.arange(len(P)).reshape(-1, 3)
    mat = p.get('material', 0)
    if under(ni, wheel_node):
        cen = Pw[I].mean(1)
        for key, m in [('wheel_fl', (cen[:, 0] > 0) & (cen[:, 2] > 0)), ('wheel_fr', (cen[:, 0] <= 0) & (cen[:, 2] > 0)), ('wheel_rl', (cen[:, 0] > 0) & (cen[:, 2] <= 0)), ('wheel_rr', (cen[:, 0] <= 0) & (cen[:, 2] <= 0))]:
            if m.any(): groups[key].append((mat, Pw, N, UV, I[m]))
    else: groups['body'].append((mat, Pw, N, UV, I))
# stand it on the ground, centred
allP = np.concatenate([P for gr in groups.values() for (_, P, _, _, _) in gr])
lo, hi = allP.min(0), allP.max(0); shift = np.array([-(lo[0] + hi[0]) / 2, -lo[1], -(lo[2] + hi[2]) / 2])
new = {'asset': {'version': '2.0'}, 'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'name': 'uaz', 'children': []}], 'meshes': [], 'accessors': [], 'bufferViews': [], 'buffers': []}
blob = bytearray()
def add(arr, ctype, typ, target=None, minmax=False):
    while len(blob) % 4: blob.append(0)
    data = np.ascontiguousarray(arr).tobytes(); off = len(blob); blob.extend(data)
    bv = {'buffer': 0, 'byteOffset': off, 'byteLength': len(data)}
    if target: bv['target'] = target
    new['bufferViews'].append(bv)
    a = {'bufferView': len(new['bufferViews']) - 1, 'componentType': ctype, 'count': int(arr.shape[0]), 'type': typ}
    if minmax: a['min'] = [float(v) for v in arr.min(0)]; a['max'] = [float(v) for v in arr.max(0)]
    new['accessors'].append(a); return len(new['accessors']) - 1
hubs = {}
for key, prims in groups.items():
    if not prims: continue
    if key == 'body': piv = np.zeros(3)
    else:
        pts = np.concatenate([P[np.unique(I)] for (_, P, _, _, I) in prims]) + shift
        piv = (pts.min(0) + pts.max(0)) / 2; hubs[key] = [round(float(v), 4) for v in piv]
    mesh = {'name': key, 'primitives': []}
    for (mat, P, N, UV, I) in prims:
        used = np.unique(I); remap = -np.ones(len(P), np.int64); remap[used] = np.arange(len(used))
        Pp = (P[used] + shift - piv).astype(np.float32); Nn = N[used].astype(np.float32); Uu = UV[used].astype(np.float32); Ii = remap[I].reshape(-1)
        prim = {'attributes': {'POSITION': add(Pp, 5126, 'VEC3', 34962, True), 'NORMAL': add(Nn, 5126, 'VEC3', 34962), 'TEXCOORD_0': add(Uu, 5126, 'VEC2', 34962)},
                'indices': add(Ii.astype(np.uint32), 5125, 'SCALAR', 34963), 'material': mat}
        mesh['primitives'].append(prim)
    new['meshes'].append(mesh)
    new['nodes'].append({'name': key, 'mesh': len(new['meshes']) - 1, 'translation': [float(v) for v in piv]})
    new['nodes'][0]['children'].append(len(new['nodes']) - 1)
# materials and images as they were (images embedded)
new['materials'] = js.get('materials', []); new['textures'] = js.get('textures', []); new['samplers'] = js.get('samplers', [{}])
new['images'] = []
for im in js.get('images', []):
    data = open(os.path.join(g.dir, im['uri']), 'rb').read()
    while len(blob) % 4: blob.append(0)
    off = len(blob); blob.extend(data); new['bufferViews'].append({'buffer': 0, 'byteOffset': off, 'byteLength': len(data)})
    new['images'].append({'bufferView': len(new['bufferViews']) - 1, 'mimeType': 'image/png' if data[:4] == b'\x89PNG' else 'image/jpeg'})
while len(blob) % 4: blob.append(0)
new['buffers'] = [{'byteLength': len(blob)}]
new['extras'] = {'hubs': hubs, 'size': [round(float(v), 3) for v in (hi - lo)]}
jsb = json.dumps(new, separators=(',', ':')).encode(); jsb += b' ' * ((4 - len(jsb) % 4) % 4)
with open(out, 'wb') as f:
    f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(jsb) + 8 + len(blob))); f.write(struct.pack('<II', len(jsb), 0x4E4F534A)); f.write(jsb)
    f.write(struct.pack('<II', len(blob), 0x004E4942)); f.write(bytes(blob))
print('hubs', hubs, 'size', np.round(hi - lo, 3), 'wrote', out, os.path.getsize(out))
