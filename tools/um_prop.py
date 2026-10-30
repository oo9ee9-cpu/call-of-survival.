"""a hand-held prop (a gun, a blade, an axe) from Sketchfab → one game model in the game's format ({gltf, bin} JSON + jpg atlases):
 - every part baked to world space, turned so the barrel / blade points along +z and up is +y, scaled to a real length,
   the origin moved to the grip (where the right hand holds it)
 - each material simplified with meshoptimizer, then all of them share one texture atlas (colour, normal, metal-rough),
   so the whole prop draws in one call; untextured materials get a flat cell of their colour
usage: python3 -I um_prop.py <scene.gltf> <out_dir> <name> <msimplify> '{options}'
  options: rot [x,y,z] degrees applied after the scene's own transforms (find it from the preview: the long axis becomes z)
           len   metres along the longest axis after rotation      grip [u,v,w] the hand's point in the box (0..1 per axis)
           tris  total triangles to keep                            atlas size of the atlas (1024)
           drop  substrings of node or material names to leave out  nrm  keep the normal atlas (true)
           at    where the grip point lands in the model's own space (guns: [0, -0.1, -0.1], as the procedural guns)
           flat  {material substring: [r,g,b]} colours for untextured parts, overriding their factors
           gripLow f: for blades and axes standing up (handle down): the grip is the handle's middle at height f of the prop"""
import sys, os, json, struct, base64, subprocess, re
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gltfread import G
Image.MAX_IMAGE_PIXELS = None

src, outd, name, msimp, opts = sys.argv[1:6]
O = json.loads(opts); os.makedirs(outd, exist_ok=True)
work = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'build'); os.makedirs(work, exist_ok=True)
g = G(src); js = g.js
drop = [d.lower() for d in O.get('drop', [])]

def texinfo(t):
    if not t: return None
    return os.path.join(g.dir, js['images'][js['textures'][t['index']]['source']]['uri'])
# ── gather the parts per material ──
parts = {}
for ni, mi, pi, p, M in g.prims():
    nname = (js['nodes'][ni].get('name') or '').lower(); mat_i = p.get('material', 0); mat = js['materials'][mat_i] if 'materials' in js else {}
    mname = (mat.get('name') or '').lower()
    if any(d in nname or d in mname for d in drop): continue
    if p.get('mode', 4) != 4: continue
    P = g.acc(p['attributes']['POSITION']).astype(np.float64)
    N = g.acc(p['attributes']['NORMAL']).astype(np.float64) if 'NORMAL' in p['attributes'] else None
    U = g.acc(p['attributes']['TEXCOORD_0']).astype(np.float64) if 'TEXCOORD_0' in p['attributes'] else np.zeros((len(P), 2))
    I = g.acc(p['indices']).reshape(-1).astype(np.int64) if 'indices' in p else np.arange(len(P))
    R = M[:3, :3]; Pw = P @ R.T + M[:3, 3]
    if N is None:
        t = I.reshape(-1, 3); fn = np.cross(P[t[:, 1]] - P[t[:, 0]], P[t[:, 2]] - P[t[:, 0]]); N = np.zeros_like(P)
        for k in range(3): np.add.at(N, t[:, k], fn)
    Nw = N @ np.linalg.inv(R); Nw /= np.linalg.norm(Nw, axis=1, keepdims=True) + 1e-12
    if np.linalg.det(R) < 0: I = I.reshape(-1, 3)[:, [0, 2, 1]].reshape(-1)
    q = parts.setdefault(mat_i, {'P': [], 'N': [], 'U': [], 'I': [], 'n': 0, 'mat': mat})
    q['P'].append(Pw); q['N'].append(Nw); q['U'].append(U); q['I'].append(I + q['n']); q['n'] += len(P)
for q in parts.values():
    for k in ('P', 'N', 'U', 'I'): q[k] = np.concatenate(q[k])
allP = np.concatenate([q['P'] for q in parts.values()])
# ── orientation, size, grip ──
def rmat(deg):
    x, y, z = np.radians(deg)
    Rx = np.array([[1, 0, 0], [0, np.cos(x), -np.sin(x)], [0, np.sin(x), np.cos(x)]]); Ry = np.array([[np.cos(y), 0, np.sin(y)], [0, 1, 0], [-np.sin(y), 0, np.cos(y)]])
    Rz = np.array([[np.cos(z), -np.sin(z), 0], [np.sin(z), np.cos(z), 0], [0, 0, 1]])
    return Rz @ Ry @ Rx
RO = rmat(O.get('rot', [0, 0, 0]))
allP = allP @ RO.T; lo, hi = allP.min(0), allP.max(0); size = hi - lo
s = O.get('len', float(size.max())) / float(size.max())
grip = lo + np.array(O.get('grip', [0.5, 0.5, 0.5])) * size
if O.get('gripLow'):
    # a handle standing up: the hand holds it a little above its lower end, at the middle of the handle there
    f = O['gripLow']; band = allP[allP[:, 1] < lo[1] + size[1] * f * 2]
    grip = np.array([band[:, 0].mean(), lo[1] + size[1] * f, band[:, 2].mean()])
for q in parts.values():
    q['P'] = (q['P'] @ RO.T - grip) * s + np.array(O.get('at', [0, 0, 0])); q['N'] = q['N'] @ RO.T
print(name, 'parts', len(parts), 'tris', sum(len(q['I']) // 3 for q in parts.values()), 'size m', np.round(size * s, 3))
# ── simplify each material ──
def simplify(V, I, ratio, err, weights):
    st = V.shape[1]
    with open(work + '/pr_in.bin', 'wb') as f:
        f.write(struct.pack('<IIIffI', len(V), len(I), st, ratio, err, len(weights)) + struct.pack('<%df' % len(weights), *weights)); f.write(V.astype(np.float32).tobytes()); f.write(I.astype(np.uint32).tobytes())
    r = subprocess.run([msimp, work + '/pr_in.bin', work + '/pr_out.bin'], check=True, stderr=subprocess.PIPE)
    o = open(work + '/pr_out.bin', 'rb').read(); nv, ni = struct.unpack('<II', o[:8])
    return np.frombuffer(o[12:12 + nv * st * 4], np.float32).reshape(nv, st).astype(np.float64), np.frombuffer(o[12 + nv * st * 4:12 + nv * st * 4 + ni * 4], np.uint32).astype(np.int64)
tot = sum(len(q['I']) // 3 for q in parts.values()); want = O.get('tris', 8000)
for k, q in parts.items():
    n = len(q['I']) // 3; ratio = min(1.0, want / tot)
    # weld exact duplicates first (scans and exports split every vertex)
    if O.get('weld') == 'pos':
        # flat-shaded exports split every corner: weld by place alone and smooth the normals again
        key = np.round(q['P'] / 1e-5).astype(np.int64)
    else: key = np.concatenate([np.round(q['P'] / 1e-6), np.round(q['N'] * 1e3), np.round(q['U'] * 1e5)], 1).astype(np.int64)
    _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True); inv = inv.reshape(-1)
    V = np.c_[q['P'][first], q['N'][first], q['U'][first]]; I = inv[q['I']]
    if O.get('weld') == 'pos':
        t = I.reshape(-1, 3); fn = np.cross(V[t[:, 1], :3] - V[t[:, 0], :3], V[t[:, 2], :3] - V[t[:, 0], :3]); Nn = np.zeros((len(V), 3))
        for kk in range(3): np.add.at(Nn, t[:, kk], fn)
        V[:, 3:6] = Nn / (np.linalg.norm(Nn, axis=1, keepdims=True) + 1e-12)
    t = I.reshape(-1, 3); I = t[(t[:, 0] != t[:, 1]) & (t[:, 1] != t[:, 2]) & (t[:, 0] != t[:, 2])].reshape(-1)
    if ratio < 0.999 and n > 64:
        vb, ib = simplify(V, I, ratio, O.get('err', 0.02), [0.3, 0.3, 0.3, 1.0, 1.0])
        if len(ib) // 3 > n * ratio * 1.6:          # seams held it up: let the uvs slide a little more
            vb, ib = simplify(V, I, ratio, O.get('err', 0.02) * 2.5, [0.15, 0.15, 0.15, 0.4, 0.4])
    else: vb, ib = V, I
    q['V'] = vb; q['IB'] = ib
    print('  ', (q['mat'].get('name') or '?')[:30], n, '->', len(ib) // 3)
# ── the atlas: one cell per material, its share by surface area (textured parts count double) ──
def mat_maps(mat):
    pb = mat.get('pbrMetallicRoughness', {}); ext = mat.get('extensions', {}); sg = ext.get('KHR_materials_pbrSpecularGlossiness')
    if sg:
        return {'col': texinfo(sg.get('diffuseTexture')), 'fac': sg.get('diffuseFactor', [1, 1, 1, 1]), 'nrm': texinfo(mat.get('normalTexture')), 'mr': None,
                'metal': 0.0, 'rough': 1 - sg.get('glossinessFactor', 0.5), 'emi': texinfo(mat.get('emissiveTexture')), 'emf': mat.get('emissiveFactor', [0, 0, 0])}
    return {'col': texinfo(pb.get('baseColorTexture')), 'fac': pb.get('baseColorFactor', [1, 1, 1, 1]), 'nrm': texinfo(mat.get('normalTexture')), 'mr': texinfo(pb.get('metallicRoughnessTexture')),
            'metal': pb.get('metallicFactor', 1.0), 'rough': pb.get('roughnessFactor', 1.0), 'emi': texinfo(mat.get('emissiveTexture')), 'emf': mat.get('emissiveFactor', [0, 0, 0])}
cells = []
for k, q in parts.items():
    t = q['IB'].reshape(-1, 3); Pv = q['V'][:, :3]
    area = 0.5 * np.linalg.norm(np.cross(Pv[t[:, 1]] - Pv[t[:, 0]], Pv[t[:, 2]] - Pv[t[:, 0]]), axis=1).sum()
    mm = mat_maps(q['mat']); q['maps'] = mm
    uv = q['V'][:, 6:8]; q['uvlo'] = uv.min(0); q['uvhi'] = uv.max(0)
    w = area * (2.0 if mm['col'] else 0.15)
    cells.append([k, max(w, 1e-6)])
RES = O.get('atlas', 1024)
tw = sum(c[1] for c in cells)
# shelf packing of squares, side ∝ sqrt(share), shrunk until all fit
sides = {k: np.sqrt(w / tw) * RES for k, w in cells}
for attempt in range(80):
    x = y = rowh = 0; place = {}; ok = True
    for k, _ in sorted(cells, key=lambda c: -sides[c[0]]):
        sd = max(8, int(sides[k]))
        if x + sd > RES: x = 0; y += rowh; rowh = 0
        if y + sd > RES: ok = False; break
        place[k] = (x, y, sd); x += sd; rowh = max(rowh, sd)
    if ok: break
    for k in sides: sides[k] *= 0.95
print('atlas', RES, 'cells', {(parts[k]['mat'].get('name') or '?')[:16]: place[k][2] for k in place})
COL = Image.new('RGB', (RES, RES), (128, 128, 128)); NRM = Image.new('RGB', (RES, RES), (128, 128, 255)); MR = Image.new('RGB', (RES, RES), (255, 200, 0))
def crop_uv(path, lo_, hi_, size, mode='RGB'):
    im = Image.open(path); im.load(); im = im.convert(mode)
    W, H = im.size
    # the part of the texture the material really uses (uvs outside 0..1 wrap: take the whole image then)
    if lo_.min() < -0.01 or hi_.max() > 1.01: box = (0, 0, W, H)
    else: box = (int(np.floor(lo_[0] * W)), int(np.floor(lo_[1] * H)), int(np.ceil(hi_[0] * W)), int(np.ceil(hi_[1] * H)))
    box = (max(0, box[0] - 2), max(0, box[1] - 2), min(W, max(box[2], box[0] + 1) + 2), min(H, max(box[3], box[1] + 1) + 2))
    return im.crop(box).resize((size, size), Image.LANCZOS), box, (W, H)
flat = O.get('flat', {})
for k, q in parts.items():
    x0, y0, sd = place[k]; mm = q['maps']; pad = 2; inner = sd - pad * 2
    fac = np.array(mm['fac'][:3]); mname = (q['mat'].get('name') or '').lower()
    for sub, cval in flat.items():
        if sub.lower() in mname: fac = np.array(cval)
    if mm['col']:
        im, box, (W, H) = crop_uv(mm['col'], q['uvlo'], q['uvhi'], inner)
        a = np.asarray(im).astype(np.float32) * fac[None, None, :]
        if mm['emi'] and max(mm['emf']) > 0:
            e, _, _ = crop_uv(mm['emi'], q['uvlo'], q['uvhi'], inner); a = a + np.asarray(e).astype(np.float32) * np.array(mm['emf'])[None, None, :] * 0.6
        im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
        # uv → atlas: the crop box (in texels of the source) maps onto the cell's inner square
        u = q['V'][:, 6]; v = q['V'][:, 7]
        if q['uvlo'].min() < -0.01 or q['uvhi'].max() > 1.01: u = u % 1.0; v = v % 1.0
        fu = (u * W - box[0]) / (box[2] - box[0]); fv = (v * H - box[1]) / (box[3] - box[1])
    else:
        c = np.clip(np.round((fac ** (1 / 2.2)) * 255), 0, 255).astype(np.uint8)
        im = Image.new('RGB', (inner, inner), tuple(int(v) for v in c)); fu = np.full(len(q['V']), 0.5); fv = np.full(len(q['V']), 0.5)
    # the cell's edge bleeds into its padding
    edge = im.resize((sd, sd), Image.BILINEAR); COL.paste(edge, (x0, y0)); COL.paste(im, (x0 + pad, y0 + pad))
    if mm['nrm'] and O.get('nrm', True) and mm['col']:
        n_im, _, _ = crop_uv(mm['nrm'], q['uvlo'], q['uvhi'], inner); NRM.paste(n_im.resize((sd, sd), Image.BILINEAR), (x0, y0)); NRM.paste(n_im, (x0 + pad, y0 + pad))
    if mm['mr'] and mm['col']:
        m_im, _, _ = crop_uv(mm['mr'], q['uvlo'], q['uvhi'], inner)
        a = np.asarray(m_im).astype(np.float32); a[..., 1] *= mm['rough']; a[..., 2] *= mm['metal']; m_im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
        MR.paste(m_im.resize((sd, sd), Image.BILINEAR), (x0, y0)); MR.paste(m_im, (x0 + pad, y0 + pad))
    else:
        MR.paste(Image.new('RGB', (sd, sd), (255, int(np.clip(mm['rough'], 0.05, 1) * 255), int(np.clip(mm['metal'], 0, 1) * 255))), (x0, y0))
    q['AU'] = np.c_[(x0 + pad + np.clip(fu, 0, 1) * inner) / RES, (y0 + pad + np.clip(fv, 0, 1) * inner) / RES]
# ── one mesh ──
Pv = np.concatenate([q['V'][:, :3] for q in parts.values()]); Nv = np.concatenate([q['V'][:, 3:6] for q in parts.values()]); Uv = np.concatenate([q['AU'] for q in parts.values()])
offs = np.cumsum([0] + [len(q['V']) for q in parts.values()])[:-1]
Iv = np.concatenate([q['IB'] + o for q, o in zip(parts.values(), offs)])
Nv /= np.linalg.norm(Nv, axis=1, keepdims=True) + 1e-12
bad = ~np.isfinite(Nv).all(1) | (np.linalg.norm(Nv, axis=1) < 0.5); Nv[bad] = [0, 1, 0]
# the muzzle (guns): the front end of the bore, where the flash and the tracers start
zmax = Pv[:, 2].max(); tip = Pv[Pv[:, 2] > zmax - (zmax - Pv[:, 2].min()) * 0.015]
extras = {'muzzle': [0.0, round(float(np.median(tip[:, 1])), 4), round(float(zmax), 4)], 'len': round(float(zmax - Pv[:, 2].min()), 4), 'top': round(float(Pv[:, 1].max()), 4)}
new = {'asset': {'version': '2.0', 'generator': 'rock-island um_prop'}, 'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'name': name, 'mesh': 0, 'extras': extras}], 'meshes': [], 'accessors': [], 'bufferViews': [], 'materials': []}
chunks = []; total = [0]
def add(arr, ctype, typ, target=None, minmax=False):
    data = np.ascontiguousarray(arr).tobytes(); pad_ = (4 - total[0] % 4) % 4
    if pad_: chunks.append(b'\0' * pad_); total[0] += pad_
    bv = {'buffer': 0, 'byteOffset': total[0], 'byteLength': len(data)}
    if target: bv['target'] = target
    new['bufferViews'].append(bv); chunks.append(data); total[0] += len(data)
    a = {'bufferView': len(new['bufferViews']) - 1, 'componentType': ctype, 'count': int(arr.shape[0]), 'type': typ}
    if minmax: a['min'] = [float(v) for v in arr.min(0)]; a['max'] = [float(v) for v in arr.max(0)]
    new['accessors'].append(a); return len(new['accessors']) - 1
big = len(Pv) >= 65536
attrs = {'POSITION': add(Pv.astype(np.float32), 5126, 'VEC3', 34962, True), 'NORMAL': add(Nv.astype(np.float32), 5126, 'VEC3', 34962), 'TEXCOORD_0': add(Uv.astype(np.float32), 5126, 'VEC2', 34962)}
new['meshes'].append({'name': name, 'primitives': [{'attributes': attrs, 'indices': add(Iv.astype(np.uint32 if big else np.uint16), 5125 if big else 5123, 'SCALAR', 34963), 'material': 0}]})
q_ = O.get('quality', 86)
COL.save(os.path.join(outd, name + '_0.jpg'), quality=q_, optimize=True)
imgs = [{'uri': name + '_0.jpg', 'mimeType': 'image/jpeg'}]; texs = [{'sampler': 0, 'source': 0}]
m2 = {'name': name, 'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicFactor': 1.0, 'roughnessFactor': 1.0}}
if O.get('nrm', True) and any(q['maps']['nrm'] for q in parts.values()):
    nr = O.get('nrmSize', RES); NRM.resize((nr, nr), Image.LANCZOS).save(os.path.join(outd, name + '_1.jpg'), quality=90, optimize=True)
    imgs.append({'uri': name + '_1.jpg', 'mimeType': 'image/jpeg'}); texs.append({'sampler': 0, 'source': 1}); m2['normalTexture'] = {'index': 1}
mr = O.get('mrSize', RES // 2); MR.resize((mr, mr), Image.LANCZOS).save(os.path.join(outd, name + '_2.jpg'), quality=88, optimize=True)
imgs.append({'uri': name + '_2.jpg', 'mimeType': 'image/jpeg'}); texs.append({'sampler': 0, 'source': len(imgs) - 1}); m2['pbrMetallicRoughness']['metallicRoughnessTexture'] = {'index': len(texs) - 1}
new['materials'].append(m2); new['images'] = imgs; new['textures'] = texs; new['samplers'] = [{'magFilter': 9729, 'minFilter': 9987}]
bin_all = b''.join(chunks); new['buffers'] = [{'byteLength': len(bin_all)}]
json.dump({'gltf': new, 'bin': base64.b64encode(bin_all).decode()}, open(os.path.join(outd, name + '.json'), 'w'), separators=(',', ':'))
print('wrote', name, 'tris', len(Iv) // 3, 'verts', len(Pv), 'json', os.path.getsize(os.path.join(outd, name + '.json')), 'images', [(i['uri'], os.path.getsize(os.path.join(outd, i['uri']))) for i in imgs],
      'box', np.round(Pv.min(0), 3).tolist(), np.round(Pv.max(0), 3).tolist())
