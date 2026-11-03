"""Colliders for the owner's models (models/u/*.glb, already at real size, standing on y = 0):
  - ships with a flight deck (the carriers): a 1 m height grid of everything you can stand on (deck, island, aircraft
    parked on deck), turned into a HeightMapShape3D in the game, plus the deck height (to set the waterline);
  - everything else: a handful of boxes from a voxel model of the mesh (surface voxels, holes filled, greedy merge).
Writes data/valley/model_cols.json: {name: {"deck": h, "grid": [w, d, x0, z0, base64 float32 heights]} or
{"boxes": [[cx, cy, cz, sx, sy, sz], ...]}}.
usage: python3 -I model_cols.py <project_dir> [name ...]"""
import base64
import json
import math
import os
import struct
import sys

import numpy as np
from scipy import ndimage

PROJ = sys.argv[1]
ONLY = set(sys.argv[2:])
DECK = {'cvn65', 'cvn80', 'cdg'}
SKIP = {'helmet', 'vest', 'vest2', 'laptop', 'drone', 'amraam', 'gbu24', 'gbu27', 'mk84'}   # carried or too small
MAX_BOXES = {'res_contemporary': 24, 'res_facade': 24, 'res_multistory': 24, 'radar': 10, 'watchtower': 12, 'palm': 1}
COMP = {5120: ('b', 1), 5121: ('B', 1), 5122: ('h', 2), 5123: ('H', 2), 5125: ('I', 4), 5126: ('f', 4)}
NCOMP = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}


def read_glb(path):
    data = open(path, 'rb').read()
    jl = struct.unpack('<I', data[12:16])[0]
    js = json.loads(data[20:20 + jl])
    off = 20 + jl
    bl = struct.unpack('<I', data[off:off + 4])[0]
    return js, data[off + 8:off + 8 + bl]


def node_matrix(n):
    if 'matrix' in n:
        return np.array(n['matrix'], np.float64).reshape(4, 4).T
    t = np.array(n.get('translation', [0, 0, 0]), np.float64)
    x, y, z, w = n.get('rotation', [0, 0, 0, 1])
    s = np.array(n.get('scale', [1, 1, 1]), np.float64)
    R = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                  [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                  [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
    M = np.eye(4)
    M[:3, :3] = R * s
    M[:3, 3] = t
    return M


def accessor(js, binb, ai):
    a = js['accessors'][ai]
    v = js['bufferViews'][a['bufferView']]
    fmt, size = COMP[a['componentType']]
    nc = NCOMP[a['type']]
    stride = v.get('byteStride', size * nc)
    base = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    n = a['count']
    if stride == size * nc:
        arr = np.frombuffer(binb[base:base + n * stride], '<' + fmt).reshape(n, nc) if nc > 1 else np.frombuffer(binb[base:base + n * size], '<' + fmt)
    else:
        raw = np.frombuffer(binb[base:base + n * stride + size * nc], np.uint8)
        rows = np.lib.stride_tricks.as_strided(raw, (n, size * nc), (stride, 1))
        arr = np.frombuffer(rows.copy().tobytes(), '<' + fmt).reshape(n, nc)
    return np.asarray(arr, np.float64 if fmt == 'f' else np.int64)


def triangles(path):
    js, binb = read_glb(path)
    out = []

    def walk(ni, M):
        n = js['nodes'][ni]
        M2 = M @ node_matrix(n)
        if 'mesh' in n:
            for pr in js['meshes'][n['mesh']]['primitives']:
                if pr.get('mode', 4) != 4 or 'POSITION' not in pr['attributes']:
                    continue
                P = accessor(js, binb, pr['attributes']['POSITION'])
                I = accessor(js, binb, pr['indices']).reshape(-1) if 'indices' in pr else np.arange(len(P))
                W = (M2[:3, :3] @ P.T).T + M2[:3, 3]
                out.append(W[I.reshape(-1, 3)])
        for c in n.get('children', []):
            walk(c, M2)

    for r in js['scenes'][js.get('scene', 0)]['nodes']:
        walk(r, np.eye(4))
    return np.concatenate(out) if out else np.zeros((0, 3, 3))


def sample_points(T, step):
    """points on every triangle no further than ~step apart (vertices, centroids, recursive splits)"""
    pts = [T.reshape(-1, 3)]
    cur = T
    for _ in range(9):
        if len(cur) == 0:
            break
        e = np.maximum.reduce([np.linalg.norm(cur[:, 1] - cur[:, 0], axis=1), np.linalg.norm(cur[:, 2] - cur[:, 1], axis=1),
                               np.linalg.norm(cur[:, 0] - cur[:, 2], axis=1)])
        pts.append(cur.mean(1))
        big = cur[e > step]
        if len(big) == 0 or len(big) > 4_000_000:
            break
        a, b, c = big[:, 0], big[:, 1], big[:, 2]
        ab, bc, ca = (a + b) / 2, (b + c) / 2, (c + a) / 2
        pts.append(np.concatenate([ab, bc, ca]))
        cur = np.concatenate([np.stack([a, ab, ca], 1), np.stack([ab, b, bc], 1), np.stack([ca, bc, c], 1), np.stack([ab, bc, ca], 1)])
    return np.concatenate(pts)


def deck_grid(T):
    n = np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0])
    ln = np.linalg.norm(n, axis=1) + 1e-12
    up = T[(n[:, 1] / ln) > 0.35]
    P = sample_points(up, 0.7)
    lo = P.min(0)
    hi = P.max(0)
    x0, z0 = math.floor(lo[0]) - 1, math.floor(lo[2]) - 1
    w, d = int(math.ceil(hi[0] - x0)) + 2, int(math.ceil(hi[2] - z0)) + 2
    g = np.full((d, w), -1.0)
    ix = np.clip(np.round(P[:, 0] - x0).astype(int), 0, w - 1)
    iz = np.clip(np.round(P[:, 2] - z0).astype(int), 0, d - 1)
    np.maximum.at(g, (iz, ix), P[:, 1])
    # close pinholes inside the hull (cells no sample fell in)
    for _ in range(3):
        empty = g < 0
        nb = ndimage.maximum_filter(g, 3)
        cnt = ndimage.uniform_filter((~empty).astype(float), 3) * 9
        fill = empty & (cnt >= 5)
        g[fill] = nb[fill]
    g[g < 0] = 0.0
    # the deck: the most common height above half the hull
    top = g[g > g.max() * 0.2]
    hist, edges = np.histogram(top, bins=np.arange(0, g.max() + 1.0, 0.5))
    deck = float(edges[np.argmax(hist)] + 0.25)
    return deck, w, d, x0, z0, g.astype(np.float32)


def boxes(T, max_boxes):
    lo = T.reshape(-1, 3).min(0)
    hi = T.reshape(-1, 3).max(0)
    size = hi - lo
    r = max(float(size.max()) / 40.0, 0.12)
    P = sample_points(T, r * 0.5)
    dims = np.maximum(np.ceil(size / r).astype(int) + 1, 1)
    V = np.zeros(dims, bool)
    idx = np.clip(((P - lo) / r).astype(int), 0, dims - 1)
    V[idx[:, 0], idx[:, 1], idx[:, 2]] = True
    V = ndimage.binary_closing(V, iterations=1) | V
    V = ndimage.binary_fill_holes(V)
    used = np.zeros_like(V)
    out = []
    # greedy: grow boxes from the biggest solid runs first
    order = np.argwhere(V)
    for (i, j, k) in order:
        if used[i, j, k]:
            continue
        i2 = i
        while i2 + 1 < dims[0] and V[i2 + 1, j, k] and not used[i2 + 1, j, k]:
            i2 += 1
        k2 = k
        while k2 + 1 < dims[2] and V[i:i2 + 1, j, k2 + 1].all() and not used[i:i2 + 1, j, k2 + 1].any():
            k2 += 1
        j2 = j
        while j2 + 1 < dims[1] and V[i:i2 + 1, j2 + 1, k:k2 + 1].all() and not used[i:i2 + 1, j2 + 1, k:k2 + 1].any():
            j2 += 1
        used[i:i2 + 1, j:j2 + 1, k:k2 + 1] = True
        a = lo + np.array([i, j, k]) * r
        b = lo + np.array([i2 + 1, j2 + 1, k2 + 1]) * r
        out.append(((b - a).prod(), a, b))
    out.sort(key=lambda t: -t[0])
    total = sum(t[0] for t in out)
    keep = []
    acc = 0.0
    for vol, a, b in out:
        if len(keep) >= max_boxes or (acc > total * 0.97 and len(keep) >= 3):
            break
        keep.append([round(float(v), 3) for v in list((a + b) / 2) + list(b - a)])
        acc += vol
    return keep, len(out)


jp = PROJ + '/data/valley/model_cols.json'
res = json.load(open(jp)) if os.path.exists(jp) else {}
for f in sorted(os.listdir(PROJ + '/models/u')):
    if not f.endswith('.glb'):
        continue
    name = f[:-4]
    if (ONLY and name not in ONLY) or name in SKIP:
        continue
    T = triangles(PROJ + '/models/u/' + f)
    if name in DECK:
        deck, w, d, x0, z0, g = deck_grid(T)
        res[name] = {'deck': round(deck, 2), 'grid': [w, d, x0, z0, base64.b64encode(g.tobytes()).decode()]}
        print('%-16s deck %.1f m  grid %d x %d  (%d tris)' % (name, deck, w, d, len(T)))
    else:
        bx, nraw = boxes(T, MAX_BOXES.get(name, 8))
        res[name] = {'boxes': bx}
        print('%-16s %d boxes (of %d)  (%d tris)' % (name, len(bx), nraw, len(T)))
json.dump(res, open(jp, 'w'), separators=(',', ':'))
print('written', jp)
