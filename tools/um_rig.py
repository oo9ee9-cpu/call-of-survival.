"""rig a static character (a scan or a sculpt from Sketchfab) onto the game's Mixamo skeleton, so the soldier's clips drive it.
 1. bake the model upright, turn it to face +z (yaw), scale it, stand it on the ground, simplify it for phones
 2. take Michelle's skeleton (the game's other Mixamo body), scale it to the model's height and bend its chains (arms, legs, head)
    onto landmarks picked from orthographic views: that bent skeleton is the new bind pose
 3. pose Michelle's own skinned mesh the same way and copy her skin weights across (nearest compatible surface, smoothed)
 4. write {gltf, bin} in the game's model format, joints named like Michelle's so the clips and the bone code find them
usage: python3 -I um_rig.py <scene.gltf> <michelle.json> <out_dir> <name> <msimplify> '{options}'
  options: yaw (deg), scale, tris, err, img, normalImg (0 = drop), landmarks {joint: [x,y,z] in the normalised preview's space},
           headYaw (deg), smooth (iterations), preview (true: only write the normalised mesh as <name>_norm.glb), metal, rough"""
import sys, os, json, struct, base64, subprocess, io
import numpy as np
from PIL import Image
from scipy.spatial import cKDTree
import scipy.sparse as sp
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gltfread import G

src, ref, outd, name, msimp, opts = sys.argv[1:7]
O = json.loads(opts)
work = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'build'); os.makedirs(work, exist_ok=True); os.makedirs(outd, exist_ok=True)

# ───────── 1. the target model ─────────
g = G(src); js = g.js
mat = js['materials'][0]
pbr = mat.get('pbrMetallicRoughness', {})
def tex_info(t):
    if not t: return None
    tr = t.get('extensions', {}).get('KHR_texture_transform', {})
    return {'img': os.path.join(g.dir, js['images'][js['textures'][t['index']]['source']]['uri']), 'tc': t.get('texCoord', 0), 'off': tr.get('offset', [0, 0]), 'scale': tr.get('scale', [1, 1]), 'rot': tr.get('rotation', 0)}
TB = tex_info(pbr.get('baseColorTexture')); TN = tex_info(mat.get('normalTexture'))
def uv_of(p, ti):
    key = 'TEXCOORD_%d' % ti['tc']
    uv = g.acc(p['attributes'][key]).astype(np.float64)
    if ti['rot']: raise SystemExit('texture rotation not handled')
    return uv * np.array(ti['scale']) + np.array(ti['off'])
Ps, Ns, Us, UNs, Is = [], [], [], [], []; base = 0
for ni, mi, pi, p, M in g.prims():
    P = g.acc(p['attributes']['POSITION']).astype(np.float64); R = M[:3, :3]; Pw = P @ R.T + M[:3, 3]
    N = g.acc(p['attributes']['NORMAL']).astype(np.float64) @ np.linalg.inv(R) if 'NORMAL' in p['attributes'] else np.zeros_like(Pw)
    N /= np.linalg.norm(N, axis=1, keepdims=True) + 1e-12
    I = g.acc(p['indices']).reshape(-1, 3).astype(np.int64) if 'indices' in p else np.arange(len(P)).reshape(-1, 3)
    if np.linalg.det(R) < 0: I = I[:, [0, 2, 1]]
    Ps.append(Pw); Ns.append(N); Us.append(uv_of(p, TB)); UNs.append(uv_of(p, TN) if TN else uv_of(p, TB)); Is.append(I + base); base += len(P)
P = np.concatenate(Ps); N = np.concatenate(Ns); U = np.concatenate(Us); UN = np.concatenate(UNs); I = np.concatenate(Is)
same_uv = np.abs(U - UN).max() < 1e-4
print('target', len(P), 'verts', len(I), 'tris', 'normal map shares uv:', same_uv)
yaw = np.radians(O.get('yaw', 0)); cy, sy = np.cos(yaw), np.sin(yaw)
RY = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
SC = O.get('scale', 1.0)
def norm_pts(X):
    return (np.asarray(X, np.float64) @ RY.T) * SC
Pn = norm_pts(P); Nn = N @ RY.T
lo, hi = Pn.min(0), Pn.max(0); shift = np.array([-(lo[0] + hi[0]) / 2, -lo[1], -(lo[2] + hi[2]) / 2])
Pn += shift
H = Pn[:, 1].max()
print('normalised height', round(H, 3), 'size', np.round(Pn.max(0) - Pn.min(0), 3))
# weld + simplify + smooth normals
def simplify(V, Ii, ratio, err):
    st = V.shape[1]
    open(work + '/rg_in.bin', 'wb').write(struct.pack('<IIIffI', len(V), Ii.size, st, ratio, err, 0) + V.astype(np.float32).tobytes() + Ii.astype(np.uint32).tobytes())
    subprocess.run([msimp, work + '/rg_in.bin', work + '/rg_out.bin'], check=True, stderr=subprocess.PIPE)
    o = open(work + '/rg_out.bin', 'rb').read(); nv, ni = struct.unpack('<II', o[:8])
    return np.frombuffer(o[12:12 + nv * st * 4], np.float32).reshape(nv, st).astype(np.float64), np.frombuffer(o[12 + nv * st * 4:12 + nv * st * 4 + ni * 4], np.uint32).astype(np.int64)
key = np.concatenate([np.round(Pn / 1e-4), np.round(U * 8192)], 1).astype(np.int64)
_, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
inv = inv.reshape(-1); Iw = inv[I.reshape(-1)].reshape(-1, 3); Iw = Iw[(Iw[:, 0] != Iw[:, 1]) & (Iw[:, 1] != Iw[:, 2]) & (Iw[:, 0] != Iw[:, 2])]
V = np.concatenate([Pn[first], U[first]], 1)
ratio = min(1.0, O.get('tris', 12000) / len(Iw))
vb, ib = simplify(V, Iw.reshape(-1), ratio, O.get('err', 0.01))
T = ib.reshape(-1, 3); PV = vb[:, :3]; UV = vb[:, 3:5]
# area-weighted smooth normals, split only at very sharp creases
fn = np.cross(PV[T[:, 1]] - PV[T[:, 0]], PV[T[:, 2]] - PV[T[:, 0]])
NV = np.zeros_like(PV)
for k in range(3): np.add.at(NV, T[:, k], fn)
NV /= np.linalg.norm(NV, axis=1, keepdims=True) + 1e-20
print('simplified', len(Iw), '->', len(T), 'tris', len(PV), 'verts')

def write_glb(path, pos, nrm, tris, col=None):
    blob = bytearray(); bvs = []; accs = []
    def put(arr, ctype, typ, target, mm=False):
        while len(blob) % 4: blob.append(0)
        d = np.ascontiguousarray(arr).tobytes(); bvs.append({'buffer': 0, 'byteOffset': len(blob), 'byteLength': len(d), 'target': target}); blob.extend(d)
        a = {'bufferView': len(bvs) - 1, 'componentType': ctype, 'count': len(arr), 'type': typ}
        if mm: a['min'] = [float(v) for v in arr.min(0)]; a['max'] = [float(v) for v in arr.max(0)]
        accs.append(a); return len(accs) - 1
    pa = put(pos.astype(np.float32), 5126, 'VEC3', 34962, True); na = put(nrm.astype(np.float32), 5126, 'VEC3', 34962); ia = put(tris.reshape(-1).astype(np.uint32), 5125, 'SCALAR', 34963)
    at = {'POSITION': pa, 'NORMAL': na}
    if col is not None: at['COLOR_0'] = put(col.astype(np.float32), 5126, 'VEC3', 34962)
    gj = {'asset': {'version': '2.0'}, 'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'mesh': 0}], 'meshes': [{'primitives': [{'attributes': at, 'indices': ia, 'material': 0}]}],
          'materials': [{'pbrMetallicRoughness': {'baseColorFactor': [0.75, 0.75, 0.75, 1], 'metallicFactor': 0, 'roughnessFactor': 0.8}}], 'accessors': accs, 'bufferViews': bvs, 'buffers': [{'byteLength': len(blob)}]}
    jb = json.dumps(gj).encode(); jb += b' ' * ((4 - len(jb) % 4) % 4)
    while len(blob) % 4: blob.append(0)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, 28 + len(jb) + len(blob))); f.write(struct.pack('<II', len(jb), 0x4E4F534A)); f.write(jb); f.write(struct.pack('<II', len(blob), 0x004E4942)); f.write(bytes(blob))
if O.get('preview'):
    write_glb(os.path.join(outd, name + '_norm.glb'), PV, NV, T); print('preview written'); sys.exit(0)

# ───────── 2. Michelle's skeleton, scaled and bent onto the landmarks ─────────
d = json.load(open(ref)); rg = d['gltf']; rb = base64.b64decode(d['bin'])
CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
def racc(i):
    a = rg['accessors'][i]; bv = rg['bufferViews'][a['bufferView']]; nc = NC[a['type']]; dt = CT[a['componentType']]; isz = nc * np.dtype(dt).itemsize
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0); st = bv.get('byteStride') or isz
    raw = np.frombuffer(rb, np.uint8, count=st * (a['count'] - 1) + isz, offset=off)
    arr = raw[np.arange(a['count'])[:, None] * st + np.arange(isz)[None, :]].copy().view(dt).reshape(a['count'], nc)
    if a.get('normalized'): arr = arr.astype(np.float64) / {5121: 255, 5123: 65535, 5120: 127, 5122: 32767}[a['componentType']]
    return arr
skin = rg['skins'][0]; J = skin['joints']; NJ = len(J)
jname = [rg['nodes'][j]['name'] for j in J]; jidx = {n: i for i, n in enumerate(jname)}
parent = [-1] * NJ
for i, j in enumerate(J):
    for c in rg['nodes'][j].get('children', []):
        if c in J: parent[J.index(c)] = i
IBM = racc(skin['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1).astype(np.float64)
Wb = np.linalg.inv(IBM)
Rj = Wb[:, :3, :3] / np.linalg.norm(Wb[:, :3, :3], axis=1, keepdims=True)       # unit-scale joint frames (columns normalised)
pj = Wb[:, :3, 3]
prim = rg['meshes'][0]['primitives'][0]
MV = racc(prim['attributes']['POSITION']).astype(np.float64); MN = racc(prim['attributes']['NORMAL']).astype(np.float64)
MJ = racc(prim['attributes']['JOINTS_0']).astype(np.int64); MW = racc(prim['attributes']['WEIGHTS_0']).astype(np.float64)
MW /= MW.sum(1, keepdims=True)
Hm = MV[:, 1].max() - MV[:, 1].min()
s = O.get('refScale', H / Hm)
ps = pj * s; MVs = MV * s
print('michelle height', round(Hm, 3), 'scale', round(s, 4))
L = {k: np.array(v, np.float64) for k, v in O.get('landmarks', {}).items()}        # picked on the normalised preview
for k in L:
    if k not in jidx: raise SystemExit('unknown joint ' + k)
AIM = O.get('aim', {})
order = []; seen = set()
def visit(i):
    if i in seen: return
    if parent[i] >= 0: visit(parent[i])
    seen.add(i); order.append(i)
for i in range(NJ): visit(i)
def rot_between(u, v):
    u = u / np.linalg.norm(u); v = v / np.linalg.norm(v); c = np.dot(u, v); ax = np.cross(u, v); sn = np.linalg.norm(ax)
    if sn < 1e-9: return np.eye(3) if c > 0 else -np.eye(3)
    ax /= sn; a = np.arctan2(sn, c); K = np.array([[0, -ax[2], ax[1]], [ax[2], 0, -ax[0]], [-ax[1], ax[0], 0]])
    return np.eye(3) + np.sin(a) * K + (1 - np.cos(a)) * K @ K
def roty(deg):
    a = np.radians(deg); return np.array([[np.cos(a), 0, np.sin(a)], [0, 1, 0], [-np.sin(a), 0, np.cos(a)]])
D = np.zeros((NJ, 4, 4))
children = [[c for c in range(NJ) if parent[c] == i] for i in range(NJ)]
for i in order:
    Dp = D[parent[i]] if parent[i] >= 0 else np.eye(4)
    newp = L[jname[i]] if jname[i] in L else (Dp @ np.append(ps[i], 1))[:3]
    Rp = Dp[:3, :3]
    aim = AIM.get(jname[i])
    if aim is None:
        cands = [c for c in children[i] if jname[c] in L]; aim = jname[cands[0]] if cands else None
    if aim is not None and aim in L:
        c = jidx[aim]; u = Rp @ (ps[c] - ps[i]); v = L[aim] - newp
        Ra = rot_between(u, v) @ Rp
    else: Ra = Rp
    hy = O.get('turn', {}).get(jname[i])
    if hy: Ra = roty(hy) @ Ra
    Di = np.eye(4); Di[:3, :3] = Ra; Di[:3, 3] = newp - Ra @ ps[i]; D[i] = Di
Wn = np.zeros((NJ, 4, 4))
for i in range(NJ): B = np.eye(4); B[:3, :3] = Rj[i]; B[:3, 3] = ps[i]; Wn[i] = D[i] @ B       # the new bind frames (unit scale)
for k in ['mixamorig:Hips', 'mixamorig:Head', 'mixamorig:LeftArm', 'mixamorig:LeftForeArm', 'mixamorig:LeftHand', 'mixamorig:RightHand', 'mixamorig:LeftUpLeg', 'mixamorig:LeftFoot']:
    print('  joint', k, np.round(Wn[jidx[k]][:3, 3], 3))
if O.get('skeletonOnly'):
    json.dump({'joints': {jname[i]: Wn[i][:3, 3].round(4).tolist() for i in range(NJ)}, 'parent': parent, 'names': jname}, open(os.path.join(outd, name + '_skel.json'), 'w'))
# ───────── 3. Michelle posed the same way, her weights copied across ─────────
MP = np.zeros_like(MVs); MNp = np.zeros_like(MN)
for k in range(4):
    Dk = D[MJ[:, k]]; w = MW[:, k:k + 1]
    MP += w * (np.einsum('nij,nj->ni', Dk[:, :3, :3], MVs) + Dk[:, :3, 3]); MNp += w * np.einsum('nij,nj->ni', Dk[:, :3, :3], MN)
MNp /= np.linalg.norm(MNp, axis=1, keepdims=True) + 1e-12
if O.get('skeletonOnly'):
    write_glb(os.path.join(outd, name + '_michelle_posed.glb'), MP, MNp, racc(prim['indices']).reshape(-1, 3).astype(np.int64)); print('posed michelle written'); sys.exit(0)
# ── weights from the bones themselves: each surface point goes to the nearest bone that lies *behind* it (inside the body),
#    so an arm hanging against the ribs does not grab the ribs; worked out on position-welded vertices so UV seams stay closed ──
wkey = np.round(PV / 1e-5).astype(np.int64)
_, wfirst, winv = np.unique(wkey, axis=0, return_index=True, return_inverse=True); winv = winv.reshape(-1)
PW = PV[wfirst]; TW = winv[T]
fnw = np.cross(PW[TW[:, 1]] - PW[TW[:, 0]], PW[TW[:, 2]] - PW[TW[:, 0]])
NW = np.zeros_like(PW)
for k in range(3): np.add.at(NW, TW[:, k], fnw)
NW /= np.linalg.norm(NW, axis=1, keepdims=True) + 1e-20
JP = Wn[:, :3, 3]
def jp(n): return JP[jidx['mixamorig:' + n]]
# the deforming bones and their segments (finger, toe-end and head-top joints only shape their parents' segments)
SEG = {}
for side in ('Left', 'Right'):
    SEG[side + 'Shoulder'] = (jp(side + 'Shoulder'), jp(side + 'Arm'), 0.045)
    SEG[side + 'Arm'] = (jp(side + 'Arm'), jp(side + 'ForeArm'), 0.04)
    SEG[side + 'ForeArm'] = (jp(side + 'ForeArm'), jp(side + 'Hand'), 0.032)
    tip = jp(side + 'HandMiddle4') if 'mixamorig:' + side + 'HandMiddle4' in jidx else jp(side + 'HandMiddle1')
    SEG[side + 'Hand'] = (jp(side + 'Hand'), tip, 0.025)
    SEG[side + 'UpLeg'] = (jp(side + 'UpLeg'), jp(side + 'Leg'), 0.065)
    SEG[side + 'Leg'] = (jp(side + 'Leg'), jp(side + 'Foot'), 0.045)
    SEG[side + 'Foot'] = (jp(side + 'Foot'), jp(side + 'ToeBase'), 0.035)
    SEG[side + 'ToeBase'] = (jp(side + 'ToeBase'), jp(side + 'Toe_End') if 'mixamorig:' + side + 'Toe_End' in jidx else jp(side + 'ToeBase'), 0.03)
pelvis = (jp('LeftUpLeg') + jp('RightUpLeg')) / 2
SEG['Hips'] = (pelvis - np.array([0, 0.03, 0]), jp('Spine'), 0.1)
SEG['Spine'] = (jp('Spine'), jp('Spine1'), 0.1)
SEG['Spine1'] = (jp('Spine1'), jp('Spine2'), 0.1)
SEG['Spine2'] = (jp('Spine2'), jp('Neck'), 0.1)
SEG['Neck'] = (jp('Neck'), jp('Head'), 0.045)
SEG['Head'] = (jp('Head'), jp('HeadTop_End'), 0.085)
for k, v in O.get('boneRadius', {}).items(): SEG[k] = (SEG[k][0], SEG[k][1], v)
names_b = list(SEG.keys()); bidx = np.array([jidx['mixamorig:' + n] for n in names_b])
A0 = np.stack([SEG[n][0] for n in names_b]); B0 = np.stack([SEG[n][1] for n in names_b]); RB = np.array([SEG[n][2] for n in names_b])
AB = B0 - A0; L2 = np.maximum((AB ** 2).sum(1), 1e-12)
tt = np.clip(((PW[:, None, :] - A0[None]) * AB[None]).sum(-1) / L2[None], 0, 1)
CP = A0[None] + tt[..., None] * AB[None]                       # closest point on every bone, for every vertex
DV = CP - PW[:, None, :]; DL = np.linalg.norm(DV, axis=-1) + 1e-9
behind = (NW[:, None, :] * DV).sum(-1) < -O.get('vis', 0.2) * DL
score = DL - RB[None]
sc = np.where(behind, score, score + 10)
lab = np.argmin(sc, 1)
nvis = (~behind.any(1)).sum()
print('labels before cleanup', {names_b[b]: int((lab == b).sum()) for b in range(len(names_b))})
# graph of the welded surface
E = np.concatenate([TW[:, [0, 1]], TW[:, [1, 2]], TW[:, [2, 0]]]); E = np.concatenate([E, E[:, ::-1]])
E = E[E[:, 0] != E[:, 1]]
A = sp.csr_matrix((np.ones(len(E)), (E[:, 0], E[:, 1])), shape=(len(PW), len(PW))); A.data[:] = 1
deg = np.asarray(A.sum(1)).ravel(); An = sp.diags(1 / np.maximum(deg, 1)) @ A
# islands: a patch of one bone cut off from that bone's main body (a hand resting on a thigh) joins its surroundings
from scipy.sparse.csgraph import connected_components
# loose little parts (buckles, straps, earrings) move as one with the body part they sit on
ncomp, comp = connected_components(A, directed=False); csize = np.bincount(comp)
mainm = csize[comp] >= O.get('partMin', 300)
if (~mainm).any() and mainm.any():
    ktree = cKDTree(PW[mainm]); mlab = lab[mainm]
    for c in np.where(csize < O.get('partMin', 300))[0]:
        vs = np.where(comp == c)[0]; _, nn = ktree.query(PW[vs]); lab[vs] = np.bincount(mlab[nn], minlength=len(names_b)).argmax()
print('mesh parts', ncomp, 'small parts re-attached', int((csize < O.get('partMin', 300)).sum()))
moved = 0
for it in range(3):
    for b in range(len(names_b)):
        m = np.where((lab == b) & mainm)[0]
        if len(m) < 2: continue
        sub = A[m][:, m]; nc, cl = connected_components(sub, directed=False)
        if nc <= 1: continue
        # keep the big islands (a torso band can be split front and back by the arms), move the small stray patches
        sizes = np.bincount(cl, minlength=nc); keep_min = max(O.get('islandMin', 24), 0.15 * sizes.max())
        if it == 0 and O.get('debug'): print('   ', names_b[b], 'islands', nc, 'sizes', sorted(sizes.tolist(), reverse=True)[:6], 'kept', int((sizes >= keep_min).sum()))
        for c in range(nc):
            if sizes[c] >= keep_min: continue
            vs = m[cl == c]
            # the bone most of the island's neighbours carry, else its second choice
            nbrs = np.unique(A[vs].indices); nbrs = nbrs[lab[nbrs] != b]
            if len(nbrs): lab[vs] = np.bincount(lab[nbrs], minlength=len(names_b)).argmax()
            else:
                s2 = sc[vs].copy(); s2[:, b] = 1e9; lab[vs] = np.argmin(s2, 1)
            moved += len(vs)
# skin against cloth: where a hand rests on a thigh (or sits in a pocket) the scan fused them; the texture still tells them apart:
# bare skin near an arm bone belongs to that arm, cloth that an arm bone had grabbed goes back to the leg or the hips
CS = O.get('colorSplit')
if CS and TB:
    tex = np.asarray(Image.open(TB['img']).convert('RGB'), np.float32) / 255.0
    th, tw_ = tex.shape[:2]; uvw = UV[wfirst]
    px = np.clip(np.floor((uvw[:, 0] % 1.0) * tw_), 0, tw_ - 1).astype(np.int64); py = np.clip(np.floor((uvw[:, 1] % 1.0) * th), 0, th - 1).astype(np.int64)
    col = tex[py, px]; r_, g_, b_ = col[:, 0], col[:, 1], col[:, 2]; mx = col.max(1); mn = col.min(1); sat = (mx - mn) / (mx + 1e-4)
    skinv = (r_ >= g_) & (g_ >= b_ * 0.95) & ((r_ - b_) > CS.get('rb', 0.06)) & (sat > 0.1) & (sat < 0.7) & (mx > 0.22)
    band = (PW[:, 1] > CS['y0'] * H) & (PW[:, 1] < CS['y1'] * H)
    armb = [names_b.index(n) for n in names_b if 'ForeArm' in n or n.endswith('Hand')]
    legb = [names_b.index(n) for n in names_b if 'UpLeg' in n] + [names_b.index('Hips')]
    darm = (DL[:, armb] - RB[armb][None]).min(1)
    trunkb = [names_b.index(n) for n in ('Hips', 'Spine', 'Spine1', 'Spine2')] + [names_b.index(n) for n in names_b if 'UpLeg' in n]
    dtrunk = (DL[:, trunkb] - RB[trunkb][None]).min(1)
    # skin close to an arm and closer to it than to the belly or a thigh (a bare midriff stays on the trunk)
    to_arm = band & skinv & (darm < CS.get('reach', 0.05)) & (darm < dtrunk + CS.get('bias', 0.01))
    to_leg = band & ~skinv & np.isin(lab, armb)
    # bare forearms (short sleeves, a tank top): no cloth rides on a forearm or a hand anywhere below the elbows
    if CS.get('bareArms'): to_leg = to_leg | ((PW[:, 1] < CS['bareArms'] * H) & ~skinv & np.isin(lab, armb))
    legb = legb + [names_b.index(n) for n in ('Spine', 'Spine1')]
    lab[to_arm] = np.array(armb)[np.argmin((DL[:, armb] - RB[armb][None])[to_arm], 1)]
    lab[to_leg] = np.array(legb)[np.argmin((DL[:, legb] - RB[legb][None])[to_leg], 1)]
    print('colour split: skin to arms', int(to_arm.sum()), 'cloth to legs', int(to_leg.sum()))
# a body that only stands and breathes (a shopkeeper behind the counter): limbs ride rigidly on the trunk, so fused contacts never tear
for src_b, dst_b in O.get('rigid', {}).items():
    for b in range(len(names_b)):
        if names_b[b].startswith(src_b) or names_b[b] == src_b: lab[lab == b] = names_b.index(dst_b)
# bones that may share a triangle: close kin in the skeleton (a joint), or both in the trunk; anything else is a contact
# the scan fused (a hand on a thigh) - those triangles go, and no blending crosses them
bpar = {}
for n in names_b:
    j = jidx['mixamorig:' + n]; q = parent[j]
    while q >= 0 and jname[q].replace('mixamorig:', '') not in SEG: q = parent[q]
    bpar[n] = jname[q].replace('mixamorig:', '') if q >= 0 else None
def hdist(a, b):
    pa = []; x = a
    while x: pa.append(x); x = bpar[x]
    pb = []; x = b
    while x: pb.append(x); x = bpar[x]
    common = next((x for x in pa if x in pb), None)
    return pa.index(common) + pb.index(common) if common else 99
TRUNK = {'Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'RightShoulder'}
OKP = np.zeros((len(names_b), len(names_b)), bool)
for i, a in enumerate(names_b):
    for k, b in enumerate(names_b): OKP[i, k] = hdist(a, b) <= O.get('kin', 2) or (a in TRUNK and b in TRUNK) or ({a, b} & {'LeftArm', 'RightArm'} and {a, b} & {'Spine', 'Spine1', 'Spine2'})
tl = lab[TW]
bridge = ~(OKP[tl[:, 0], tl[:, 1]] & OKP[tl[:, 1], tl[:, 2]] & OKP[tl[:, 0], tl[:, 2]])
from collections import Counter
pairs = Counter()
for t in np.where(bridge)[0]:
    for a, b in ((0, 1), (1, 2), (0, 2)):
        if not OKP[tl[t, a], tl[t, b]]: pairs[tuple(sorted((names_b[tl[t, a]], names_b[tl[t, b]])))] += 1
print('bridging triangles', int(bridge.sum()), dict(pairs.most_common(12)))
TWcut = TW[bridge]; TW = TW[~bridge]; T = T[~bridge]
# close the holes the cut left (a palm, the side of a thigh): a fan from the first vertex of every small new boundary loop
if O.get('fillHoles') and bridge.any():
    from collections import defaultdict
    ecount = Counter(); esplit = {}
    for t, ts in zip(TW, T):
        for (a2, b2), (sa, sb) in (((t[0], t[1]), (ts[0], ts[1])), ((t[1], t[2]), (ts[1], ts[2])), ((t[2], t[0]), (ts[2], ts[0]))):
            k2 = (min(a2, b2), max(a2, b2)); ecount[k2] += 1; esplit[(a2, b2)] = (sa, sb)
    adj = defaultdict(list); spl = {}
    for (a2, b2), (sa, sb) in esplit.items():
        if ecount[(min(a2, b2), max(a2, b2))] != 1: continue
        adj[a2].append(b2); adj[b2].append(a2); spl.setdefault(a2, sa); spl.setdefault(b2, sb)
    # the vertices next to a cut: only holes the cut opened are closed (not an open sleeve, the neck or the soles)
    cutv = set(np.unique(TWcut).tolist())
    used = set(); uedge = set(); addT = []; addTW = []; loops = 0; why = Counter()
    for start in list(adj.keys()):
        if start in used: continue
        loop = [start]; prev = start; v = adj[start][0]; ok = True; uedge.add((start, v))
        while v != start:
            nb = [w for w in adj[v] if w != prev and (v, w) not in uedge]
            if not nb: ok = False; why['dead end'] += 1; break
            if len(nb) > 1:
                # where two holes touch: carry on the way that bends least
                d0 = PW[v] - PW[prev]; d0 /= np.linalg.norm(d0) + 1e-12
                nb.sort(key=lambda w: -((PW[w] - PW[v]) @ d0) / (np.linalg.norm(PW[w] - PW[v]) + 1e-12))
            loop.append(v); uedge.add((v, nb[0])); prev, v = v, nb[0]
            if len(loop) > O.get('fillMax', 40): ok = False; why['long'] += 1; break
        used.update(loop)
        if not ok or len(loop) < 3: continue
        if not any(x in cutv for x in loop): why['not cut'] += 1; continue
        labs = {lab[x] for x in loop}
        if len(labs) > O.get('fillLabs', 3): why['labels'] += 1; continue
        # a fan from the first vertex, wound to face the way the surface round the hole faces
        nrm = NW[loop].sum(0); c0 = loop[0]; tri_w = []; tri_s = []
        for k in range(1, len(loop) - 1):
            a2, b2, c2 = c0, loop[k], loop[k + 1]
            fn_ = np.cross(PW[b2] - PW[a2], PW[c2] - PW[a2])
            if fn_ @ nrm < 0: b2, c2 = c2, b2
            tri_w.append((a2, b2, c2)); tri_s.append((spl[a2], spl[b2], spl[c2]))
        addTW += tri_w; addT += tri_s; loops += 1
    if addT: TW = np.concatenate([TW, np.array(addTW, np.int64)]); T = np.concatenate([T, np.array(addT, np.int64)])
    print('holes closed', loops, 'triangles', len(addT), 'skipped', dict(why))
E = np.concatenate([TW[:, [0, 1]], TW[:, [1, 2]], TW[:, [2, 0]]]); E = np.concatenate([E, E[:, ::-1]])
E = E[E[:, 0] != E[:, 1]]
A = sp.csr_matrix((np.ones(len(E)), (E[:, 0], E[:, 1])), shape=(len(PW), len(PW))); A.data[:] = 1
deg = np.asarray(A.sum(1)).ravel(); An = sp.diags(1 / np.maximum(deg, 1)) @ A
Wl = np.zeros((len(PW), len(names_b))); Wl[np.arange(len(PW)), lab] = 1
# loose cloth (a coat skirt) hangs from the hips as much as it follows the thigh: the further from the bone, the more it stays
if O.get('loose'):
    hb = names_b.index('Hips')
    for side in ('Left', 'Right'):
        b = names_b.index(side + 'UpLeg'); v = np.where(lab == b)[0]
        f = np.clip((DL[v, b] - RB[b] - O['loose'][0]) / O['loose'][1], 0, O['loose'][2])
        Wl[v, b] = 1 - f; Wl[v, hb] += f
for _ in range(O.get('smooth', 10)): Wl = 0.5 * Wl + 0.5 * (An @ Wl)
Wfull = np.zeros((len(PW), NJ)); Wfull[:, bidx] = Wl
Wt = Wfull[winv]                                                   # back to the split (UV-seam) vertices
top = np.argsort(-Wt, 1)[:, :4]; tw = np.take_along_axis(Wt, top, 1); tw /= tw.sum(1, keepdims=True)
print('weights: welded', len(PW), 'of', len(PV), 'no bone behind', int(nvis), 'island verts moved', moved, 'labels', {names_b[b]: int((lab == b).sum()) for b in range(len(names_b))})
if O.get('labels'):
    cols = np.random.RandomState(3).rand(len(names_b), 3) * 0.8 + 0.2
    write_glb(os.path.join(outd, name + '_labels.glb'), PW, NW, TW, cols[lab])
# ───────── 4. write the rigged model ─────────
new = {'asset': {'version': '2.0', 'generator': 'rock-island um_rig'}, 'scene': 0, 'scenes': [{'nodes': [0, 1]}], 'nodes': [], 'meshes': [], 'accessors': [], 'bufferViews': [], 'skins': [], 'materials': []}
chunks = []; total = [0]
def add(arr, ctype, typ, target=None, minmax=False, normalized=False):
    data = np.ascontiguousarray(arr).tobytes(); pad = (4 - total[0] % 4) % 4
    if pad: chunks.append(b'\0' * pad); total[0] += pad
    bv = {'buffer': 0, 'byteOffset': total[0], 'byteLength': len(data)}
    if target: bv['target'] = target
    new['bufferViews'].append(bv); chunks.append(data); total[0] += len(data)
    a = {'bufferView': len(new['bufferViews']) - 1, 'componentType': ctype, 'count': int(arr.shape[0]), 'type': typ}
    if normalized: a['normalized'] = True
    if minmax: a['min'] = [float(v) for v in arr.min(0)]; a['max'] = [float(v) for v in arr.max(0)]
    new['accessors'].append(a); return len(new['accessors']) - 1
def quat(Rm):
    U_, _, Vt = np.linalg.svd(Rm); Rm = U_ @ Vt
    t = np.trace(Rm)
    if t > 0: S = np.sqrt(t + 1) * 2; w = 0.25 * S; x = (Rm[2, 1] - Rm[1, 2]) / S; y = (Rm[0, 2] - Rm[2, 0]) / S; z = (Rm[1, 0] - Rm[0, 1]) / S
    elif Rm[0, 0] > Rm[1, 1] and Rm[0, 0] > Rm[2, 2]: S = np.sqrt(1 + Rm[0, 0] - Rm[1, 1] - Rm[2, 2]) * 2; w = (Rm[2, 1] - Rm[1, 2]) / S; x = 0.25 * S; y = (Rm[0, 1] + Rm[1, 0]) / S; z = (Rm[0, 2] + Rm[2, 0]) / S
    elif Rm[1, 1] > Rm[2, 2]: S = np.sqrt(1 + Rm[1, 1] - Rm[0, 0] - Rm[2, 2]) * 2; w = (Rm[0, 2] - Rm[2, 0]) / S; x = (Rm[0, 1] + Rm[1, 0]) / S; y = 0.25 * S; z = (Rm[1, 2] + Rm[2, 1]) / S
    else: S = np.sqrt(1 + Rm[2, 2] - Rm[0, 0] - Rm[1, 1]) * 2; w = (Rm[1, 0] - Rm[0, 1]) / S; x = (Rm[0, 2] + Rm[2, 0]) / S; y = (Rm[1, 2] + Rm[2, 1]) / S; z = 0.25 * S
    q = np.array([x, y, z, w]); return (q / np.linalg.norm(q)).tolist()
# node 0: the rig root; joints follow in Michelle's order; the body last
new['nodes'].append({'name': name + '_rig', 'children': [1 + i for i in range(NJ) if parent[i] < 0]})
for i in range(NJ):
    Lm = Wn[i] if parent[i] < 0 else np.linalg.inv(Wn[parent[i]]) @ Wn[i]
    nd = {'name': jname[i], 'translation': [float(v) for v in Lm[:3, 3]], 'rotation': quat(Lm[:3, :3])}
    if children[i]: nd['children'] = [1 + c for c in children[i]]
    new['nodes'].append(nd)
# the body node is the second scene root (index NJ+1)
new['scenes'][0]['nodes'] = [0, NJ + 1]
ibm = np.stack([np.linalg.inv(Wn[i]).T for i in range(NJ)]).astype(np.float32).reshape(NJ, 16)
new['skins'].append({'joints': [1 + i for i in range(NJ)], 'inverseBindMatrices': add(ibm, 5126, 'MAT4'), 'skeleton': 1 + [i for i in range(NJ) if parent[i] < 0][0]})
# no zero normals: the vertex shader normalises them, and one NaN varying blacks out the whole frame through the bloom
bad = np.linalg.norm(NV, axis=1) < 0.5
if bad.any():
    alt = NW[winv[bad]]; ok2 = np.linalg.norm(alt, axis=1) > 0.5
    NV[np.where(bad)[0][ok2]] = alt[ok2]; NV[np.where(bad)[0][~ok2]] = [0, 1, 0]
    print('zero normals fixed', int(bad.sum()))
nq = np.zeros((len(PV), 4), np.int8); nq[:, :3] = np.round(NV * 127)
def add_q(q):
    data = q.tobytes(); pad = (4 - total[0] % 4) % 4
    if pad: chunks.append(b'\0' * pad); total[0] += pad
    new['bufferViews'].append({'buffer': 0, 'byteOffset': total[0], 'byteLength': len(data), 'byteStride': 4, 'target': 34962}); chunks.append(data); total[0] += len(data)
    new['accessors'].append({'bufferView': len(new['bufferViews']) - 1, 'componentType': 5120, 'normalized': True, 'count': int(len(q)), 'type': 'VEC3'}); return len(new['accessors']) - 1
wq = np.round(tw * 255).astype(np.int64); wq[:, 0] += 255 - wq.sum(1)                 # exact sums of 255
attrs = {'POSITION': add(PV.astype(np.float32), 5126, 'VEC3', 34962, True), 'NORMAL': add_q(nq), 'TEXCOORD_0': add(UV.astype(np.float32), 5126, 'VEC2', 34962),
         'JOINTS_0': add(top.astype(np.uint8), 5121, 'VEC4', 34962), 'WEIGHTS_0': add(tw.astype(np.float32), 5126, 'VEC4', 34962)}     # float: three r128 reads normalised bytes raw on the CPU (boneTransform, skinnedBox)
big = len(PV) >= 65536
new['meshes'].append({'name': name, 'primitives': [{'attributes': attrs, 'indices': add(T.reshape(-1).astype(np.uint32 if big else np.uint16), 5125 if big else 5123, 'SCALAR', 34963), 'material': 0}]})
new['nodes'].append({'name': name + '_body', 'mesh': 0, 'skin': 0})
images = []
def save_img(path, size, fn):
    im = Image.open(path); im.load(); im = im.convert('RGB')
    if max(im.size) > size: im = im.resize((size, size * im.size[1] // im.size[0]), Image.LANCZOS)
    im.save(os.path.join(outd, fn), quality=O.get('quality', 86), optimize=True); images.append({'uri': fn, 'mimeType': 'image/jpeg'}); return len(images) - 1
m2 = {'name': name, 'pbrMetallicRoughness': {'metallicFactor': O.get('metal', 0.0), 'roughnessFactor': O.get('rough', 0.8)}}
texs = []
if TB: texs.append({'sampler': 0, 'source': save_img(TB['img'], O.get('img', 1024), name + '_0.jpg')}); m2['pbrMetallicRoughness']['baseColorTexture'] = {'index': len(texs) - 1}
if TN and same_uv and O.get('normalImg', 512): texs.append({'sampler': 0, 'source': save_img(TN['img'], O.get('normalImg', 512), name + '_1.jpg')}); m2['normalTexture'] = {'index': len(texs) - 1}
new['materials'].append(m2); new['images'] = images; new['textures'] = texs; new['samplers'] = [{'magFilter': 9729, 'minFilter': 9987}]
new['extensionsUsed'] = ['KHR_mesh_quantization']
bin_all = b''.join(chunks); new['buffers'] = [{'byteLength': len(bin_all)}]
json.dump({'gltf': new, 'bin': base64.b64encode(bin_all).decode()}, open(os.path.join(outd, name + '.json'), 'w'), separators=(',', ':'))
print('wrote', name, 'tris', len(T), 'verts', len(PV), 'bin', len(bin_all), 'json', os.path.getsize(os.path.join(outd, name + '.json')), 'images', [(i['uri'], os.path.getsize(os.path.join(outd, i['uri']))) for i in images])
