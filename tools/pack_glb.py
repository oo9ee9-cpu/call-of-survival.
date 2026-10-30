# repack a plain (decoded) GLB for the game: keep the node tree, skins, chosen animations and morph targets,
# drop extra uv sets / tangents / heavy extensions, optionally simplify static and skinned meshes,
# write {gltf, bin(base64)} JSON plus resized external images.
# usage: python3 -I pack_glb.py in.glb out_dir name '{json options}' msimplify
#   options: {"ratio": 0.3, "minTris": 300, "img": 512, "anims": ["Idle","Walk"], "dropExt": true, "noSimplify": ["meshname"], "keepImages": [0,1]}
import sys, os, json, struct, base64, subprocess, io
import numpy as np
from PIL import Image
src, outd, name, opts_s, msimp = sys.argv[1:6]
O = json.loads(opts_s)
work = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'build'); os.makedirs(work, exist_ok=True)
b = open(src, 'rb').read(); off = 12; js = None; binc = b''
while off < len(b):
    L, T = struct.unpack('<II', b[off:off + 8]); c = b[off + 8:off + 8 + L]
    if T == 0x4E4F534A: js = json.loads(c)
    elif T == 0x004E4942: binc = c
    off += 8 + L
CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
def read(i):
    a = js['accessors'][i]
    nc = NC[a['type']]; dt = CT[a['componentType']]
    if 'bufferView' not in a: arr = np.zeros((a['count'], nc), dt)
    else:
        bv = js['bufferViews'][a['bufferView']]; start = bv.get('byteOffset', 0) + a.get('byteOffset', 0); item = nc * np.dtype(dt).itemsize; stride = bv.get('byteStride') or item
        raw = np.frombuffer(binc, np.uint8, count=stride * (a['count'] - 1) + item, offset=start)
        if stride == item: arr = np.frombuffer(raw.tobytes(), dt).reshape(a['count'], nc)
        else: arr = np.stack([np.frombuffer(raw[k * stride:k * stride + item].tobytes(), dt) for k in range(a['count'])])
    if 'sparse' in a: raise SystemExit('sparse accessors not supported')
    return arr.copy()
new = {'asset': {'version': '2.0', 'generator': 'rock-island pack'}, 'scene': js.get('scene', 0), 'scenes': js['scenes'], 'nodes': js['nodes'], 'buffers': [], 'bufferViews': [], 'accessors': []}
chunks = []; total = 0
def add_acc(arr, ctype, typ, target=None, normalized=False, minmax=False):
    global total
    data = np.ascontiguousarray(arr.astype(CT[ctype])).tobytes()
    pad = (4 - total % 4) % 4
    if pad: chunks.append(b'\0' * pad); total += pad
    bv = {'buffer': 0, 'byteOffset': total, 'byteLength': len(data)}
    if target: bv['target'] = target
    new['bufferViews'].append(bv); chunks.append(data); total += len(data)
    a = {'bufferView': len(new['bufferViews']) - 1, 'componentType': ctype, 'count': int(arr.shape[0]), 'type': typ}
    if normalized: a['normalized'] = True
    if minmax or typ == 'VEC3' and target == 34962:
        flat = arr.reshape(arr.shape[0], -1)
        a['min'] = [float(x) for x in flat.min(0)]; a['max'] = [float(x) for x in flat.max(0)]
    new['accessors'].append(a); return len(new['accessors']) - 1
def copy_acc(i, target=None):
    a = js['accessors'][i]; arr = read(i)
    return add_acc(arr, a['componentType'], a['type'], target, a.get('normalized', False), 'min' in a)
def simplify(V, I, target_tris, err):
    st = V.shape[1]; n = len(V)
    ratio = min(1.0, target_tris * 3 / len(I))
    head = struct.pack('<IIIffI', n, len(I), st, ratio, err, 0)
    open(work + '/pk_in.bin', 'wb').write(head + V.astype(np.float32).tobytes() + I.astype(np.uint32).tobytes())
    subprocess.run([msimp, work + '/pk_in.bin', work + '/pk_out.bin'], check=True, stderr=subprocess.PIPE)
    o = open(work + '/pk_out.bin', 'rb').read(); nv, ni = struct.unpack('<II', o[:8])
    vb = np.frombuffer(o[12:12 + nv * st * 4], np.float32).reshape(nv, st); ib = np.frombuffer(o[12 + nv * st * 4:12 + nv * st * 4 + ni * 4], np.uint32)
    return vb, ib
KEEP = ['POSITION', 'NORMAL', 'TEXCOORD_0', 'JOINTS_0', 'WEIGHTS_0', 'COLOR_0']
new['meshes'] = []
tris_in = tris_out = 0
mesh_node = {}
for n in js['nodes']:
    if 'mesh' in n: mesh_node[n['mesh']] = n.get('name') or ''
drop = set(O.get('drop', []))
mesh_remap = {}
for mi, m in enumerate(js.get('meshes', [])):
    nodename = mesh_node.get(mi, '')
    if nodename in drop: continue
    mesh_remap[mi] = len(new['meshes'])
    err = O.get('errBy', {}).get(nodename, O.get('err', 0.02))
    nm = {'primitives': []}
    if m.get('name'): nm['name'] = m['name']
    if 'weights' in m: nm['weights'] = m['weights']
    for p in m['primitives']:
        attrs = {k: v for k, v in p['attributes'].items() if k in KEEP}
        I = read(p['indices']).reshape(-1).astype(np.int64) if 'indices' in p else np.arange(js['accessors'][attrs['POSITION']]['count'])
        targets = p.get('targets', [])
        tris_in += len(I) // 3
        simp = O.get('ratio', 1) < 1 and not targets and len(I) // 3 > O.get('minTris', 300) and (m.get('name') or nodename) not in O.get('noSimplify', [])
        np_ = {'attributes': {}}
        if 'material' in p: np_['material'] = p['material']
        if 'mode' in p: np_['mode'] = p['mode']
        if simp:
            cols = []; layout = []
            for k in attrs:
                arr = read(attrs[k]).astype(np.float64)
                a = js['accessors'][attrs[k]]
                if a.get('normalized'): arr = arr / {5121: 255, 5123: 65535, 5120: 127, 5122: 32767}[a['componentType']]
                cols.append(arr); layout.append((k, arr.shape[1], a))
            # position must come first for the simplifier
            order = sorted(range(len(layout)), key=lambda i: 0 if layout[i][0] == 'POSITION' else 1)
            cols = [cols[i] for i in order]; layout = [layout[i] for i in order]
            V = np.concatenate(cols, 1)
            target = max(O.get('minTris', 300), int(len(I) // 3 * O.get('ratioBy', {}).get(nodename, O['ratio'])))
            vb, ib = simplify(V, I, target, err)
            o = 0
            for k, nc, a in layout:
                arr = vb[:, o:o + nc]; o += nc
                if k == 'JOINTS_0': np_['attributes'][k] = add_acc(np.round(arr), 5123, 'VEC4', 34962)
                elif k == 'WEIGHTS_0': s = arr.sum(1, keepdims=True); np_['attributes'][k] = add_acc(arr / np.where(s > 0, s, 1), 5126, 'VEC4', 34962)
                elif k == 'COLOR_0': np_['attributes'][k] = add_acc(arr, 5126, a['type'], 34962)
                else: np_['attributes'][k] = add_acc(arr, 5126, a['type'], 34962, minmax=(k == 'POSITION'))
            np_['indices'] = add_acc(ib.astype(np.uint32) if len(vb) >= 65536 else ib.astype(np.uint16), 5125 if len(vb) >= 65536 else 5123, 'SCALAR', 34963)
            tris_out += len(ib) // 3
        else:
            for k, v in attrs.items(): np_['attributes'][k] = copy_acc(v, 34962)
            if 'indices' in p: np_['indices'] = copy_acc(p['indices'], 34963)
            if targets: np_['targets'] = [{k: copy_acc(v, 34962) for k, v in t.items() if k in ('POSITION', 'NORMAL')} for t in targets]
            tris_out += len(I) // 3
        nm['primitives'].append(np_)
    new['meshes'].append(nm)
for n in new['nodes']:
    if 'mesh' in n:
        if n['mesh'] in mesh_remap: n['mesh'] = mesh_remap[n['mesh']]
        else: del n['mesh']
if js.get('skins'):
    new['skins'] = []
    for s in js['skins']:
        ns = dict(s)
        if 'inverseBindMatrices' in s: ns['inverseBindMatrices'] = copy_acc(s['inverseBindMatrices'])
        new['skins'].append(ns)
keep_anims = O.get('anims')
if js.get('animations'):
    new['animations'] = []
    for a in js['animations']:
        if keep_anims is not None and a.get('name') not in keep_anims: continue
        smap = {}
        na = {'name': a.get('name', 'anim'), 'samplers': [], 'channels': []}
        for i, s in enumerate(a['samplers']):
            na['samplers'].append({'input': copy_acc(s['input']), 'output': copy_acc(s['output']), 'interpolation': s.get('interpolation', 'LINEAR')})
        na['channels'] = a['channels']
        new['animations'].append(na)
# materials, minus heavy extensions; images resized and written next to the json
new['materials'] = []
for mt in js.get('materials', []):
    m2 = {k: v for k, v in mt.items() if k not in ('extensions',)}
    ext = mt.get('extensions', {})
    if 'KHR_materials_pbrSpecularGlossiness' in ext and 'pbrMetallicRoughness' not in mt:
        sg = ext['KHR_materials_pbrSpecularGlossiness']; m2['pbrMetallicRoughness'] = {'metallicFactor': 0, 'roughnessFactor': 1 - sg.get('glossinessFactor', 0.3)}
        if 'diffuseTexture' in sg: m2['pbrMetallicRoughness']['baseColorTexture'] = sg['diffuseTexture']
        if 'diffuseFactor' in sg: m2['pbrMetallicRoughness']['baseColorFactor'] = sg['diffuseFactor']
    pbr = m2.get('pbrMetallicRoughness', {})
    pbr.pop('metallicRoughnessTexture', None)
    m2.pop('occlusionTexture', None)
    if O.get('noNormal'): m2.pop('normalTexture', None)
    new['materials'].append(m2)
used_tex = set()
for m2 in new['materials']:
    for t in [m2.get('pbrMetallicRoughness', {}).get('baseColorTexture'), m2.get('normalTexture'), m2.get('emissiveTexture')]:
        if t: used_tex.add(t['index'])
if js.get('textures'):
    new['textures'] = []; new['images'] = []; new['samplers'] = js.get('samplers', [{}])
    remap_img = {}
    for ti, t in enumerate(js['textures']):
        srci = t.get('source')
        if ti not in used_tex or srci is None: new['textures'].append({'sampler': t.get('sampler', 0), 'source': 0}); continue
        if srci not in remap_img:
            im = js['images'][srci]; bv = js['bufferViews'][im['bufferView']]
            data = binc[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]
            img = Image.open(io.BytesIO(data)); img.load()
            mx = O.get('img', 512); s = min(1, mx / max(img.size))
            if s < 1: img = img.resize((max(1, int(img.size[0] * s)), max(1, int(img.size[1] * s))), Image.LANCZOS)
            alpha = img.mode in ('RGBA', 'LA') and np.array(img.convert('RGBA'))[..., 3].min() < 250
            fn = f'{name}_{len(new["images"])}.' + ('png' if alpha else 'jpg')
            (img.convert('RGBA') if alpha else img.convert('RGB')).save(os.path.join(outd, fn), **({} if alpha else {'quality': 84, 'optimize': True}))
            new['images'].append({'uri': fn, 'mimeType': 'image/png' if alpha else 'image/jpeg'}); remap_img[srci] = len(new['images']) - 1
        new['textures'].append({'sampler': t.get('sampler', 0), 'source': remap_img[srci]})
    if not new['images']: new.pop('images'); new.pop('textures'); new.pop('samplers')
bin_all = b''.join(chunks)
new['buffers'] = [{'byteLength': len(bin_all)}]
os.makedirs(outd, exist_ok=True)
json.dump({'gltf': new, 'bin': base64.b64encode(bin_all).decode()}, open(os.path.join(outd, name + '.json'), 'w'), separators=(',', ':'))
print(name, 'tris', tris_in, '->', tris_out, 'bin', len(bin_all), 'json', os.path.getsize(os.path.join(outd, name + '.json')), 'anims', [a['name'] for a in new.get('animations', [])])
