"""Green trees for the valley: the browser game's ez-tree species (assets/veg/trees.json, quantised meshes, two levels of
detail) written as glb files with nodes lod0 / lod1 and materials bark_<kind> / leaf_<kind> (the game swaps in its shaders).
usage: python3 trees8.py <game_assets_dir> <project_dir>  -> models/v8/<species>_<variant>.glb, data/valley/trees.json"""
import base64
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from meshlib import Mesh, write_glb  # noqa: E402

SRC, PROJ = sys.argv[1], sys.argv[2]
OUT = PROJ + '/models/v8'
os.makedirs(OUT, exist_ok=True)
KEEP = ['oak', 'oak_m', 'ash', 'birch', 'pine', 'spruce', 'cypress', 'willow', 'dead', 'bush', 'bush2', 'bush3']


def deq(q, n, comps):
    a = np.frombuffer(base64.b64decode(q['data']), dtype='<i2').astype(np.float64)[:n * comps].reshape(n, comps)
    mn = np.asarray(q['min'], np.float64)
    mx = np.asarray(q['max'], np.float64)
    return mn + (a + 32767.0) / 65534.0 * (mx - mn)


def nrm(s, n):
    return np.frombuffer(base64.b64decode(s), dtype=np.int8).astype(np.float64)[:n * 3].reshape(n, 3) / 127.0


def idx(q):
    b = base64.b64decode(q['data'])
    return np.frombuffer(b, dtype='<u4' if q.get('u32') else '<u2').astype(np.int64).reshape(-1, 3)


def part(m, mat, p, leaf):
    n = p['n']
    P = deq(p['pos'], n, 3)
    N = nrm(p['nrm'], n)
    if leaf and 'uv' not in p:
        q = n // 4
        UV = np.tile(np.array([[0, 0], [0, 1], [1, 1], [1, 0]], np.float64), (q, 1))
        base = np.arange(q) * 4
        I = np.stack([np.stack([base, base + 1, base + 2], 1), np.stack([base, base + 2, base + 3], 1)], 1).reshape(-1, 3)
    else:
        UV = deq(p['uv'], n, 2)
        I = idx(p['idx'])
    # ambient occlusion in the vertex colour: darker inside the crown and low on the trunk
    C = np.ones((n, 4))
    if leaf:
        r = np.linalg.norm(P[:, [0, 2]], axis=1)
        rr = r / (r.max() + 1e-6)
        C[:, :3] = (0.55 + 0.45 * np.clip(rr * 1.2, 0, 1))[:, None]
    m.add(mat, P, N, UV, I, C)


T = json.load(open(SRC + '/veg/trees.json'))
info = {}
for sid in KEEP:
    sp = T['species'][sid]
    for vi, va in enumerate(sp['variants']):
        nodes = []
        for lod in ('lod0', 'lod1'):
            L = va[lod]
            m = Mesh()
            part(m, 'bark_' + sp['bark'], L['trunk'], False)
            if 'leaves' in L:
                part(m, 'leaf_' + sp['leaf'], L['leaves'], True)
            if 'twigs' in L:
                part(m, 'leaf_' + sp.get('twig', sp['leaf']), L['twigs'], True)
            nodes.append(dict(name=lod, mesh=m))
        name = '%s_%d' % (sid, vi)
        write_glb(OUT + '/%s.glb' % name, nodes, {}, '')
        info[name] = dict(species=sid, height=va['height'], trunkR=va['trunkR'], crownR=va['crownR'], bark=sp['bark'],
                          leaf=sp['leaf'], tris=[nodes[0]['mesh'].tcount(), nodes[1]['mesh'].tcount()], bush=sid.startswith('bush'))
        print(name, info[name]['tris'], 'h', va['height'])
os.makedirs(PROJ + '/data/valley', exist_ok=True)
json.dump(info, open(PROJ + '/data/valley/trees.json', 'w'), indent=0)
