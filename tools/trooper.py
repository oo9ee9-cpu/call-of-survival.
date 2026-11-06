#!/usr/bin/env python3
"""Call of Survival - the soldier (models/chars/trooper.glb), put together from open parts:
  body + skeleton + idle / walk / run: Mixamo "X Bot" (Adobe Mixamo licence, as shipped with the three.js examples),
      reshaped (narrower hips, straight waist, flat chest), its clothes thickened and creased, boots and gloves marked;
  head: "Infinite, 3D Head Scan" by Lee Perry-Smith (CC-BY 3.0), cut at the neck, on the head bone;
  helmet with headset, two plate carriers: by "Exactly" on Sketchfab (CC-BY 4.0), on the head / chest bones.
The body's UV channels are replaced by its rest position (UV = x, y; UV2 = z) so the game's shader can print any camouflage
on it without seams, and COLOR_0 marks the parts: r boots, g gloves, b bare skin, a trousers.
Cut down for the game (a phone draws dozens of them): with TROOPER_LODS=<lods.json> (tools/lod_dump.gd run on the full
model) every part takes the simplified triangle list nearest to its share in LOD_TARGET (~28k triangles in all, from
~116k), and drops the vertices it no longer uses. TROOPER_OUT=<file.glb> writes somewhere other than the project.
usage: python3 trooper.py <project_dir> <Xbot.glb> <LeePerrySmith_dir> [preview_params.json]"""
import json
import math
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gltfio  # noqa: E402

PROJ, XBOT, LPS = sys.argv[1], sys.argv[2], sys.argv[3]
U = PROJ + '/models/u/'
P_ = {  # fitting numbers (metres, the model's rest space: Y up, facing +Z, T-pose)
    'head_scale': 0.0490, 'head_y': 1.598, 'head_z': -0.004, 'head_cut': -1.75,
    'helmet_scale': 1.0, 'helmet_up': 0.018, 'helmet_z': -0.004,
    'vest_h': 0.53, 'vest_y': 1.235, 'vest_z': 0.006, 'vest_w': 0.45,
    'vest2_h': 0.53, 'vest2_y': 1.235, 'vest2_z': 0.006, 'vest2_w': 0.45,
}
if len(sys.argv) > 4:
    P_.update(json.load(open(sys.argv[4])))
rng = np.random.default_rng(11)
LODS = json.load(open(os.environ['TROOPER_LODS'])) if os.environ.get('TROOPER_LODS') else None
LOD_TARGET = {'Body': 6800, 'Pads': 2600, 'Head': 4000, 'Helmet': 9300, 'Vest': 3700, 'Vest2': 1700}
LOD_TARGET.update(json.loads(os.environ.get('TROOPER_TARGET', '{}')))


def simplify(name, part):
    """the part with the simplified triangles Godot made for it (matched by position and uv), unused vertices dropped"""
    key = [k for k in LODS if k.endswith('_' + name + '#0')]
    if not key:
        return part
    e = LODS[key[0]]
    gv = np.asarray(e['v'], np.float32).reshape(-1, 5)
    lods = e['lods']
    pick = min(lods, key=lambda a: abs(len(a) // 3 - LOD_TARGET.get(name, len(a) // 3)))
    idx = np.asarray(pick, np.int64).reshape(-1, 3)[:, [0, 2, 1]].reshape(-1)   # Godot winds the other way round
    P = part['P'].astype(np.float32)
    if len(gv) == len(P) and np.abs(gv[:, :3] - P).max() < 1e-5:
        remap = np.arange(len(P))
    else:
        from scipy.spatial import cKDTree
        key5 = np.concatenate([P, part['UV0'].astype(np.float32)], 1)
        _, remap = cKDTree(key5).query(gv)
    idx = remap[idx]
    used, inv = np.unique(idx, return_inverse=True)
    out = {}
    for k, v in part.items():
        out[k] = v if k == 'I' else v[used]
    out['I'] = inv.astype(np.uint32)
    print('  %-7s %6d -> %6d triangles, %6d -> %6d vertices' % (name, len(part['I']) // 3, len(out['I']) // 3, len(P), len(used)))
    return out


def bell(x, c, w):
    return np.exp(-((x - c) / w) ** 2)


# ------------------------------------------------------------------ value noise in 3D (creases)
_perm = rng.random(4096).astype(np.float32)


def vnoise(p):
    i = np.floor(p).astype(np.int64)
    f = p - i
    f = f * f * (3 - 2 * f)

    def h(dx, dy, dz):
        k = (i[:, 0] + dx) * 73856093 ^ (i[:, 1] + dy) * 19349663 ^ (i[:, 2] + dz) * 83492791
        return _perm[k & 4095]
    x00 = h(0, 0, 0) * (1 - f[:, 0]) + h(1, 0, 0) * f[:, 0]
    x10 = h(0, 1, 0) * (1 - f[:, 0]) + h(1, 1, 0) * f[:, 0]
    x01 = h(0, 0, 1) * (1 - f[:, 0]) + h(1, 0, 1) * f[:, 0]
    x11 = h(0, 1, 1) * (1 - f[:, 0]) + h(1, 1, 1) * f[:, 0]
    y0 = x00 * (1 - f[:, 1]) + x10 * f[:, 1]
    y1 = x01 * (1 - f[:, 1]) + x11 * f[:, 1]
    return y0 * (1 - f[:, 2]) + y1 * f[:, 2]


def recompute_normals(P, tri):
    n = np.zeros_like(P)
    a, b, c = P[tri[:, 0]], P[tri[:, 1]], P[tri[:, 2]]
    fn = np.cross(b - a, c - a)
    for k in range(3):
        np.add.at(n, tri[:, k], fn)
    n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-9)
    return n.astype(np.float32)


# ------------------------------------------------------------------ the body
X, XB = gltfio.load(XBOT)
skin = X['skins'][0]
JN = [X['nodes'][j]['name'].replace('mixamorig:', '') for j in skin['joints']]
JI = {n: i for i, n in enumerate(JN)}
IBM = gltfio.acc(X, XB, skin['inverseBindMatrices'])
GB = np.linalg.inv(IBM.reshape(-1, 4, 4).transpose(0, 2, 1))   # joint rest globals (model space, metres)
JPOS = {n: GB[i][:3, 3] for i, n in enumerate(JN)}


def bone_w(J, W, names):
    ids = [JI[n] for n in names if n in JI]
    return sum(((J == i) * W).sum(1) for i in ids)


HEAD_B = ['Head', 'HeadTop_End', 'LeftEye', 'RightEye']
HAND_B = [n for n in JN if 'Hand' in n]
FOOT_B = ['LeftFoot', 'LeftToeBase', 'LeftToe_End', 'RightFoot', 'RightToeBase', 'RightToe_End']
LEG_B = ['LeftUpLeg', 'LeftLeg', 'RightUpLeg', 'RightLeg']
ARM_B = ['LeftArm', 'LeftForeArm', 'RightArm', 'RightForeArm']


def body_part(mesh_index, pads):
    pr = X['meshes'][mesh_index]['primitives'][0]
    P = gltfio.acc(X, XB, pr['attributes']['POSITION']).astype(np.float64)
    N = gltfio.acc(X, XB, pr['attributes']['NORMAL']).astype(np.float64)
    J = gltfio.acc(X, XB, pr['attributes']['JOINTS_0']).astype(np.uint16)
    W = gltfio.acc(X, XB, pr['attributes']['WEIGHTS_0']).astype(np.float32)
    tri = gltfio.acc(X, XB, pr['indices']).reshape(-1, 3).astype(np.int64)
    hw = bone_w(J, W, HEAD_B)
    # the head goes: the scanned one sits on the head bone instead
    keep = ~((hw[tri] > 0.45).all(1))
    tri = tri[keep]
    y, x, z = P[:, 1], P[:, 0], P[:, 2]
    torso = np.abs(x) < 0.24
    # ---- a man's build: narrower hips, a waist as wide as the hips, a flat chest, a thicker neck base
    hips = bell(y, 0.92, 0.11) * torso
    P[:, 0] *= 1.0 - 0.16 * hips
    # slimmer thighs: in towards each leg's own line
    for side, sx in (('Left', 1.0), ('Right', -1.0)):
        lw_ = bone_w(J, W, [side + 'UpLeg', side + 'Leg'])
        ax = JPOS[side + 'UpLeg'][0] * (1.0 - 0.16 * bell(0.85, 0.92, 0.11))
        k = 0.13 * lw_ * bell(y, 0.72, 0.2)
        P[:, 0] = P[:, 0] - (P[:, 0] - ax) * k * (np.sign(P[:, 0]) == sx)
        P[:, 2] = P[:, 2] - (P[:, 2] - 0.0) * k * 0.6 * (np.sign(P[:, 0]) == sx)
    waist = bell(y, 1.15, 0.075) * torso
    P[:, 0] *= 1.0 + 0.30 * waist
    P[:, 2] = np.where(torso, P[:, 2] * (1.0 + 0.12 * waist), P[:, 2])
    chest = (bell(y, 1.31, 0.07) * torso * (P[:, 2] > 0.03))
    P[:, 2] = np.where(chest > 0.05, P[:, 2] - (P[:, 2] - 0.03) * 0.55 * chest, P[:, 2])
    upper = bell(y, 1.40, 0.07) * torso
    P[:, 0] *= 1.0 + 0.12 * upper
    # ---- clothes: thicker than the skin, baggier down the legs, creased
    gw = bone_w(J, W, HAND_B)
    fw = bone_w(J, W, FOOT_B)
    lw = bone_w(J, W, LEG_B)
    aw = bone_w(J, W, ARM_B)
    boots = np.clip(np.maximum(fw * 1.6, (lw > 0.4) * (y < 0.21) * 1.0), 0, 1)
    gloves = np.clip((gw - 0.35) * 2.5, 0, 1)
    trousers = np.clip((1.03 - y) * 25.0, 0, 1) * (1.0 - boots)
    cloth = (1.0 - gloves) * (1.0 - boots * 0.6)
    thick = 0.008 + 0.003 * trousers * bell(y, 0.5, 0.25) + 0.004 * aw
    if pads:
        thick = thick + 0.002
    cre = vnoise(P * np.array([14.0, 30.0, 14.0])) - 0.5
    cre2 = vnoise(P * 55.0 + 7.0) - 0.5
    knee = bell(y, 0.52, 0.06) * (lw > 0.3) + bell(np.abs(x), 0.43, 0.06) * aw   # bunched at knees and elbows
    d = (thick + cre * (0.006 + 0.008 * knee) + cre2 * 0.0025) * cloth
    P += N * d[:, None]
    # boots: a sole that sticks out a little, gloves a touch thicker
    P += N * (boots * 0.006 + gloves * 0.002)[:, None]
    N2 = recompute_normals(P, tri)
    col = np.zeros((len(P), 4), np.float32)
    col[:, 0] = boots
    col[:, 1] = gloves
    col[:, 2] = 0.0
    col[:, 3] = trousers
    # drop the vertices nothing uses any more
    used = np.zeros(len(P), bool)
    used[tri.ravel()] = True
    remap = -np.ones(len(P), np.int64)
    remap[used] = np.arange(used.sum())
    tri = remap[tri]
    sel = used
    rest = P[sel]
    uv0 = rest[:, :2].astype(np.float32)
    uv1 = np.stack([rest[:, 2], np.full(len(rest), 1.0 if pads else 0.0)], 1).astype(np.float32)
    return {'P': rest.astype(np.float32), 'N': N2[sel], 'UV0': uv0, 'UV1': uv1, 'C': (col[sel] * 255).round().astype(np.uint8),
            'J': J[sel], 'W': W[sel], 'I': tri.astype(np.uint32).ravel()}


# ------------------------------------------------------------------ rigid parts on one bone (or two, blended by height)
def rigid(P, N, UV, bone, bone2=None, y0=0.0, y1=1.0):
    J = np.zeros((len(P), 4), np.uint16)
    W = np.zeros((len(P), 4), np.float32)
    J[:, 0] = JI[bone]
    if bone2 is None:
        W[:, 0] = 1.0
    else:
        t = np.clip((P[:, 1] - y0) / (y1 - y0), 0, 1)
        J[:, 1] = JI[bone2]
        W[:, 0] = t
        W[:, 1] = 1 - t
    return J, W


def load_part(path):
    """the first mesh of a .glb in its own world space, with its texture"""
    js, bn = gltfio.load(path)
    node, mi, M = gltfio.world_meshes(js)[0]
    pr = js['meshes'][mi]['primitives'][0]
    P = gltfio.acc(js, bn, pr['attributes']['POSITION']).astype(np.float64)
    N = gltfio.acc(js, bn, pr['attributes']['NORMAL']).astype(np.float64)
    UV = gltfio.acc(js, bn, pr['attributes']['TEXCOORD_0']).astype(np.float32)
    I = gltfio.acc(js, bn, pr['indices']).reshape(-1).astype(np.uint32)
    P = (np.c_[P, np.ones(len(P))] @ M.T)[:, :3]
    N = N @ np.linalg.inv(M[:3, :3])
    N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
    tex = None
    mat = js['materials'][pr['material']] if 'material' in pr else {}
    bct = mat.get('pbrMetallicRoughness', {}).get('baseColorTexture')
    if bct is not None:
        src = js['textures'][bct['index']]['source']
        tex = gltfio.image_bytes(js, bn, src)
    return P, N, UV, I, tex


def rot_y(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


def head_part():
    js, bn = gltfio.load(LPS + '/LeePerrySmith.glb')
    pr = js['meshes'][0]['primitives'][0]
    P = gltfio.acc(js, bn, pr['attributes']['POSITION']).astype(np.float64)
    N = gltfio.acc(js, bn, pr['attributes']['NORMAL']).astype(np.float64)
    UV = gltfio.acc(js, bn, pr['attributes']['TEXCOORD_0']).astype(np.float32)
    tri = gltfio.acc(js, bn, pr['indices']).reshape(-1, 3).astype(np.int64)
    keep = (P[tri][:, :, 1] > P_['head_cut']).all(1)
    tri = tri[keep]
    used = np.zeros(len(P), bool)
    used[tri.ravel()] = True
    remap = -np.ones(len(P), np.int64)
    remap[used] = np.arange(used.sum())
    tri = remap[tri]
    P, N, UV = P[used], N[used], UV[used]
    s = P_['head_scale']
    P = P * s + np.array([0.0, P_['head_y'], P_['head_z']])
    return P, N, UV, tri.astype(np.uint32).ravel()


def main():
    b = gltfio.Builder()
    out = b.js
    out['nodes'] = json.loads(json.dumps(X['nodes']))
    out['scenes'] = [{'nodes': []}]
    out['scene'] = 0
    out['materials'] = []
    out['meshes'] = []
    # skin
    out['skins'] = [{'joints': skin['joints'], 'inverseBindMatrices': b.accessor(IBM.astype(np.float32), 'MAT4')}]
    if 'skeleton' in skin:
        out['skins'][0]['skeleton'] = skin['skeleton']
    # the clips the soldier uses, under the names the game knows
    out['animations'] = []
    for a in X['animations']:
        nm = {'idle': 'Idle', 'walk': 'Walk', 'run': 'Run'}.get(a['name'])
        if nm is None:
            continue
        smps = []
        for s in a['samplers']:
            ti = gltfio.acc(X, XB, s['input']).astype(np.float32)
            to = gltfio.acc(X, XB, s['output']).astype(np.float32)
            typ = {1: 'SCALAR', 3: 'VEC3', 4: 'VEC4'}[to.shape[1]]
            smps.append({'input': b.accessor(ti, 'SCALAR', minmax=True), 'output': b.accessor(to, typ),
                         'interpolation': s.get('interpolation', 'LINEAR')})
        out['animations'].append({'name': nm, 'samplers': smps, 'channels': a['channels']})

    def material(name, color, tex=None, rough=0.9, normal=None):
        m = {'name': name, 'pbrMetallicRoughness': {'baseColorFactor': color, 'metallicFactor': 0.0, 'roughnessFactor': rough}}
        if tex is not None:
            m['pbrMetallicRoughness']['baseColorTexture'] = {'index': b.image(*tex)}
        if normal is not None:
            m['normalTexture'] = {'index': b.image(*normal)}
        out['materials'].append(m)
        return len(out['materials']) - 1

    def add_mesh(name, part, mat):
        if LODS is not None:
            part = simplify(name, part)
        attrs = {'POSITION': b.accessor(part['P'], 'VEC3', 34962, minmax=True),
                 'NORMAL': b.accessor(part['N'].astype(np.float32), 'VEC3', 34962),
                 'TEXCOORD_0': b.accessor(part['UV0'], 'VEC2', 34962)}
        if 'UV1' in part:
            attrs['TEXCOORD_1'] = b.accessor(part['UV1'], 'VEC2', 34962)
        if 'C' in part:
            attrs['COLOR_0'] = b.accessor(part['C'], 'VEC4', 34962, normalized=True)
        attrs['JOINTS_0'] = b.accessor(part['J'].astype(np.uint16), 'VEC4', 34962)
        attrs['WEIGHTS_0'] = b.accessor(part['W'].astype(np.float32), 'VEC4', 34962)
        out['meshes'].append({'name': name, 'primitives': [{'attributes': attrs, 'indices': b.accessor(part['I'], 'SCALAR', 34963),
                                                            'material': mat}]})
        out['nodes'].append({'name': name, 'mesh': len(out['meshes']) - 1, 'skin': 0})
        return len(out['nodes']) - 1

    arm_i = [i for i, n in enumerate(X['nodes']) if n.get('name') == 'Armature'][0]
    # drop the old mesh nodes from the armature
    old_mesh_nodes = [i for i, n in enumerate(X['nodes']) if 'mesh' in n]
    out['nodes'][arm_i]['children'] = [c for c in out['nodes'][arm_i]['children'] if c not in old_mesh_nodes]
    for i in old_mesh_nodes:
        out['nodes'][i] = {'name': 'unused_' + str(i)}
    new = []
    mat_u = material('uniform', [0.42, 0.4, 0.31, 1.0])
    mat_p = material('uniform_pads', [0.3, 0.29, 0.24, 1.0])
    new.append(add_mesh('Body', body_part(1, False), mat_u))
    new.append(add_mesh('Pads', body_part(0, True), mat_p))
    # head
    hp, hn, huv, hi = head_part()
    J, W = rigid(hp, hn, huv, 'Head', 'Neck', P_['head_y'] - 0.05, P_['head_y'] + 0.01)
    col = open(LPS + '/Map-COL.jpg', 'rb').read()
    nrm = open(LPS + '/Infinite-Level_02_Tangent_SmoothUV.jpg', 'rb').read()
    mat_h = material('skin', [1, 1, 1, 1], (col, 'image/jpeg'), 0.62, (nrm, 'image/jpeg'))
    new.append(add_mesh('Head', {'P': hp.astype(np.float32), 'N': hn.astype(np.float32), 'UV0': huv, 'J': J, 'W': W, 'I': hi}, mat_h))
    top = hp[:, 1].max()
    # helmet: it faces +X in its file; turned to face +Z, its inside a little above the scalp
    P, N, UV, I, tex = load_part(U + 'helmet.glb')
    R = rot_y(-math.pi / 2)
    P = P @ R.T
    N = N @ R.T
    P *= P_['helmet_scale']
    # the shell's inner top is ~1.2 cm under its outer top
    P += np.array([0.0, top + P_['helmet_up'] + 0.012 - P[:, 1].max(), P_['helmet_z'] - (P[:, 2].max() + P[:, 2].min()) / 2])
    J, W = rigid(P, N, UV, 'Head')
    new.append(add_mesh('Helmet', {'P': P.astype(np.float32), 'N': N.astype(np.float32), 'UV0': UV, 'J': J, 'W': W, 'I': I},
                        material('helmet', [1, 1, 1, 1], tex, 0.75)))
    # the two plate carriers on the chest
    for nm, face in (('vest', 0.0), ('vest2', -math.pi / 2)):
        P, N, UV, I, tex = load_part(U + nm + '.glb')
        R = rot_y(face)
        P = P @ R.T
        N = N @ R.T
        h = P[:, 1].max() - P[:, 1].min()
        s = P_[nm + '_h'] / h
        w = (P[:, 0].max() - P[:, 0].min()) * s
        sx = P_[nm + '_w'] / w
        c = (P.max(0) + P.min(0)) / 2
        P = (P - c) * np.array([s * sx, s, s])
        N = N / np.array([s * sx, s, s])
        N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
        P += np.array([0.0, P_[nm + '_y'], P_[nm + '_z']])
        J, W = rigid(P, N, UV, 'Spine2', 'Spine1', P_[nm + '_y'] - 0.12, P_[nm + '_y'] + 0.06)
        new.append(add_mesh(nm.capitalize(), {'P': P.astype(np.float32), 'N': N.astype(np.float32), 'UV0': UV, 'J': J, 'W': W, 'I': I},
                            material(nm, [1, 1, 1, 1], tex, 0.8)))
    out['nodes'][arm_i]['children'] = out['nodes'][arm_i]['children'] + new
    # a root that turns the soldier to look down -Z, as the game's models do
    out['nodes'].append({'name': 'Trooper', 'rotation': [0.0, 1.0, 0.0, 0.0], 'children': [arm_i]})
    out['scenes'][0]['nodes'] = [len(out['nodes']) - 1]
    dst = os.environ.get('TROOPER_OUT') or PROJ + '/models/chars/trooper.glb'
    b.save(dst)
    print('trooper', dst, os.path.getsize(dst) // 1024, 'KB', 'head top %.3f' % top)


main()
