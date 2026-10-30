"""'Tree Animate' by RandyGF (CC-BY 4.0) → three variants of a new species in the trees.json format
(trunk + leaf cards + twig cards, two levels of detail). usage: python3 -I um_tree.py <scene.gltf> <out.json> <msimplify>"""
import sys, os, json, base64, struct, subprocess
import numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gltfread import G

src, out, msimp = sys.argv[1:4]
g = G(src)
parts = {}
for ni, mi, pi, p, M in g.prims():
    name = g.js['materials'][p['material']]['name']
    P = g.acc(p['attributes']['POSITION']); N = g.acc(p['attributes']['NORMAL']); UV = g.acc(p['attributes']['TEXCOORD_0'])
    I = g.acc(p['indices']).reshape(-1).astype(np.int64)
    R = M[:3, :3]; Pw = P @ R.T + M[:3, 3]; Nw = N @ R.T; Nw /= np.linalg.norm(Nw, axis=1, keepdims=True) + 1e-9
    parts[name] = dict(P=Pw, N=Nw, UV=UV, I=I)

def components(P, I):
    """connected pieces (cards, twigs, the trunk): label per vertex"""
    t = I.reshape(-1, 3); n = len(P)
    rows = np.r_[t[:, 0], t[:, 1], t[:, 2]]; cols = np.r_[t[:, 1], t[:, 2], t[:, 0]]
    A = coo_matrix((np.ones(len(rows)), (rows, cols)), shape=(n, n))
    return connected_components(A, directed=False)[1]

# the three trunks: bark pieces grouped by where they stand
bark = parts['Bark']
lab = components(bark['P'], bark['I'])
cent = np.array([bark['P'][lab == k].mean(0) for k in range(lab.max() + 1)])
order = np.argsort(cent[:, 0]); xs = cent[order, 0]
groups = [[order[0]]]
for a, b in zip(order[:-1], order[1:]):
    if cent[b, 0] - cent[a, 0] > 12: groups.append([])
    groups[-1].append(b)
assert len(groups) == 3, ('trunk groups', len(groups))
trunks = []
for gr in groups:
    m = np.isin(lab, gr); Pp = bark['P'][m]; base = Pp[Pp[:, 1] < Pp[:, 1].min() + 3]
    trunks.append(np.array([base[:, 0].mean(), Pp[:, 1].min(), base[:, 2].mean()]))
trunks = np.array(trunks)
print('trunk bases', np.round(trunks, 1))

def split(part):
    """pieces of a part assigned to the nearest trunk (by the piece's centre, across the ground)"""
    lab = components(part['P'], part['I']); K = lab.max() + 1
    cen = np.zeros((K, 3)); np.add.at(cen, lab, part['P']); cen /= np.bincount(lab, minlength=K)[:, None]
    d = ((cen[:, None, [0, 2]] - trunks[None, :, [0, 2]]) ** 2).sum(-1); owner = d.argmin(1)
    return lab, owner

S = 14.0 / 75.0            # 75 model units → 14 m
def sub(part, keep_v):
    """the triangles whose vertices are all kept, reindexed"""
    t = part['I'].reshape(-1, 3); tm = keep_v[t].all(1); t = t[tm]
    used = np.unique(t); remap = -np.ones(len(part['P']), np.int64); remap[used] = np.arange(len(used))
    return dict(P=part['P'][used], N=part['N'][used], UV=part['UV'][used], I=remap[t].reshape(-1), src=used)

def simplify(V, I, ratio, err):
    work = os.path.join(os.path.dirname(os.path.abspath(out)), '_msimp'); os.makedirs(work, exist_ok=True)
    st = V.shape[1]; head = struct.pack('<IIIffI', len(V), len(I), st, ratio, err, 0)
    open(work + '/in.bin', 'wb').write(head + V.astype(np.float32).tobytes() + I.astype(np.uint32).tobytes())
    subprocess.run([msimp, work + '/in.bin', work + '/out.bin'], check=True, stderr=subprocess.PIPE)
    o = open(work + '/out.bin', 'rb').read(); nv, ni = struct.unpack('<II', o[:8])
    vb = np.frombuffer(o[12:12 + nv * st * 4], np.float32).reshape(nv, st).astype(np.float64)
    ib = np.frombuffer(o[12 + nv * st * 4:12 + nv * st * 4 + ni * 4], np.uint32).astype(np.int64)
    return vb, ib

def q16(a):
    a = np.asarray(a, np.float64); lo = a.min(0); hi = a.max(0); span = np.where(hi - lo > 1e-9, hi - lo, 1)
    q = np.round((a - lo) / span * 65534 - 32767).astype(np.int16)
    return {'data': base64.b64encode(q.tobytes()).decode(), 'min': [round(float(v), 5) for v in lo], 'max': [round(float(v), 5) for v in hi]}
def enc(m, cards=False):
    n = len(m['P']); I = m['I'].astype(np.uint32)
    nrm = np.clip(np.round(m['N'] * 127), -127, 127).astype(np.int8)
    d = {'n': int(n), 'pos': q16(m['P']), 'nrm': base64.b64encode(nrm.tobytes()).decode(), 'uv': q16(m['UV']), 'tris': int(len(I) // 3)}
    u32 = n >= 65536; d['idx'] = {'data': base64.b64encode(I.astype(np.uint32 if u32 else np.uint16).tobytes()).decode(), 'u32': bool(u32)}
    if cards: d['cards'] = True
    return d

def thin_cards(m, keep, grow, seed):
    """the far level: a share of the cards, each grown about its own middle so the crown keeps its fullness"""
    lab = components(m['P'], m['I']); K = lab.max() + 1; rng = np.random.default_rng(seed)
    kept = rng.random(K) < keep
    cen = np.zeros((K, 3)); np.add.at(cen, lab, m['P']); cen /= np.bincount(lab, minlength=K)[:, None]
    mm = dict(m); P = m['P'].copy(); P = cen[lab] + (P - cen[lab]) * grow; mm['P'] = P
    return sub(mm, kept[lab])

lab_l, own_l = split(parts['Leaf']); lab_b, own_b = split(parts['Branch'])
species = {'bark': 'plane', 'leaf': 'plane', 'twig': 'planetwig', 'variants': []}
for k in range(3):
    T0 = trunks[k]
    def place(m):
        m = dict(m); P = (m['P'] - T0) * S; m['P'] = P; return m
    bk = place(sub(bark, np.isin(lab, groups[k])))
    bk['UV'] = bk['UV'] * np.array([1.0, 1.0 / 0.3])          # the bark shader squeezes v by 0.3 for the long ez-tree trunks
    lf = place(sub(parts['Leaf'], own_l[lab_l] == k)); tw = place(sub(parts['Branch'], own_b[lab_b] == k))
    # far trunk: simplified with its uvs
    V = np.c_[bk['P'], bk['N'], bk['UV']]; vb, ib = simplify(V, bk['I'], 0.3, 0.02)
    bk1 = dict(P=vb[:, 0:3], N=vb[:, 3:6] / (np.linalg.norm(vb[:, 3:6], axis=1, keepdims=True) + 1e-9), UV=vb[:, 6:8], I=ib)
    lf1 = thin_cards(lf, 0.38, 1.45, 11 + k); tw1 = thin_cards(tw, 0.3, 1.35, 31 + k)
    allP = np.r_[bk['P'], lf['P'], tw['P']]
    H = float(allP[:, 1].max()); low = bk['P'][bk['P'][:, 1] < 1.2]
    trunkR = float(np.percentile(np.hypot(low[:, 0], low[:, 2]), 90)) if len(low) else 0.3
    crownR = float(np.percentile(np.hypot(lf['P'][:, 0], lf['P'][:, 2]), 97))
    crown = [round(float(v), 2) for v in lf['P'].mean(0)]
    va = {'height': round(H, 2), 'trunkR': round(trunkR, 3), 'crownR': round(crownR, 2), 'crown': crown,
          'lod0': {'trunk': enc(bk), 'leaves': enc(lf, True), 'twigs': enc(tw, True)},
          'lod1': {'trunk': enc(bk1), 'leaves': enc(lf1, True), 'twigs': enc(tw1, True)}}
    species['variants'].append(va)
    print('variant', k, 'H', round(H, 1), 'trunkR', round(trunkR, 2), 'crownR', round(crownR, 1), 'lod0 tris', va['lod0']['trunk']['tris'], va['lod0']['leaves']['tris'], va['lod0']['twigs']['tris'], 'lod1', va['lod1']['trunk']['tris'], va['lod1']['leaves']['tris'], va['lod1']['twigs']['tris'])
json.dump({'v': 1, 'species': {'plane': species}}, open(out, 'w'), separators=(',', ':'))
print('wrote', out, os.path.getsize(out))
