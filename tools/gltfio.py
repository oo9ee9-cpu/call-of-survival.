"""minimal glTF 2.0 (.glb) reading and writing with numpy: accessors in, accessors out"""
import json, math, struct
import numpy as np

CT = {5126: np.float32, 5125: np.uint32, 5123: np.uint16, 5121: np.uint8, 5122: np.int16, 5120: np.int8}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def load(path):
    b = open(path, 'rb').read()
    assert b[:4] == b'glTF'
    off = 12
    js, bn = None, b''
    while off < len(b):
        ln, typ = struct.unpack_from('<I4s', b, off)
        off += 8
        if typ == b'JSON':
            js = json.loads(b[off:off + ln])
        elif typ == b'BIN\x00':
            bn = b[off:off + ln]
        off += ln
    return js, bn


def acc(js, bn, i):
    a = js['accessors'][i]
    ct = CT[a['componentType']]
    n = NC[a['type']]
    if 'bufferView' not in a:
        return np.zeros((a['count'], n), ct)
    bv = js['bufferViews'][a['bufferView']]
    o = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    st = bv.get('byteStride', 0)
    isz = np.dtype(ct).itemsize * n
    if st and st != isz:
        raw = np.frombuffer(bn, np.uint8, count=st * (a['count'] - 1) + isz, offset=o)
        rows = np.lib.stride_tricks.as_strided(raw, (a['count'], isz), (st, 1))
        arr = np.frombuffer(rows.copy().tobytes(), ct).reshape(a['count'], n)
    else:
        arr = np.frombuffer(bn, ct, count=a['count'] * n, offset=o).reshape(a['count'], n)
    if a.get('normalized'):
        arr = arr.astype(np.float32) / float(np.iinfo(ct).max)
    return arr.copy()


def image_bytes(js, bn, img_index):
    im = js['images'][img_index]
    bv = js['bufferViews'][im['bufferView']]
    o = bv.get('byteOffset', 0)
    return bn[o:o + bv['byteLength']], im.get('mimeType', 'image/jpeg')


class Builder:
    def __init__(self):
        self.js = {'asset': {'version': '2.0', 'generator': 'cos-trooper'}, 'buffers': [], 'bufferViews': [], 'accessors': []}
        self.bin = bytearray()

    def _view(self, data, target=None):
        while len(self.bin) % 4:
            self.bin += b'\x00'
        bv = {'buffer': 0, 'byteOffset': len(self.bin), 'byteLength': len(data)}
        if target:
            bv['target'] = target
        self.bin += data
        self.js['bufferViews'].append(bv)
        return len(self.js['bufferViews']) - 1

    def accessor(self, arr, typ, target=None, minmax=False, normalized=False):
        arr = np.ascontiguousarray(arr)
        ct = {np.dtype(np.float32): 5126, np.dtype(np.uint32): 5125, np.dtype(np.uint16): 5123, np.dtype(np.uint8): 5121}[arr.dtype]
        n = NC[typ]
        count = arr.size // n
        a = {'bufferView': self._view(arr.tobytes(), target), 'componentType': ct, 'count': count, 'type': typ}
        if normalized:
            a['normalized'] = True
        if minmax:
            r = arr.reshape(count, n)
            a['min'] = [float(v) for v in r.min(0)]
            a['max'] = [float(v) for v in r.max(0)]
        self.js['accessors'].append(a)
        return len(self.js['accessors']) - 1

    def image(self, data, mime):
        self.js.setdefault('images', []).append({'bufferView': self._view(data), 'mimeType': mime})
        self.js.setdefault('samplers', [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497}])
        self.js.setdefault('textures', []).append({'sampler': 0, 'source': len(self.js['images']) - 1})
        return len(self.js['textures']) - 1

    def save(self, path):
        while len(self.bin) % 4:
            self.bin += b'\x00'
        self.js['buffers'] = [{'byteLength': len(self.bin)}]
        j = json.dumps(self.js, separators=(',', ':')).encode()
        while len(j) % 4:
            j += b' '
        total = 12 + 8 + len(j) + 8 + len(self.bin)
        with open(path, 'wb') as f:
            f.write(struct.pack('<4sII', b'glTF', 2, total))
            f.write(struct.pack('<I4s', len(j), b'JSON'))
            f.write(j)
            f.write(struct.pack('<I4s', len(self.bin), b'BIN\x00'))
            f.write(bytes(self.bin))


# ------------------------------------------------------------------ scene graph and animation sampling
def quat_mat(q):
    x, y, z, w = q
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                     [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                     [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]], np.float64)


def trs(t=None, r=None, s=None):
    m = np.eye(4)
    if s is not None:
        m[:3, :3] = np.diag(s)
    if r is not None:
        m[:3, :3] = quat_mat(r) @ m[:3, :3]
    if t is not None:
        m[:3, 3] = t
    return m


def node_matrix(n):
    if 'matrix' in n:
        return np.array(n['matrix'], np.float64).reshape(4, 4).T
    return trs(n.get('translation'), n.get('rotation'), n.get('scale'))


def parents(js):
    par = {}
    for i, n in enumerate(js['nodes']):
        for c in n.get('children', []):
            par[c] = i
    return par


def world_meshes(js):
    """(node index, mesh index, world matrix) for every mesh node of the default scene"""
    out = []

    def walk(i, m):
        n = js['nodes'][i]
        w = m @ node_matrix(n)
        if 'mesh' in n:
            out.append((i, n['mesh'], w))
        for c in n.get('children', []):
            walk(c, w)
    for r in js['scenes'][js.get('scene', 0)]['nodes']:
        walk(r, np.eye(4))
    return out


def slerp(a, b, t):
    d = float(np.dot(a, b))
    if d < 0:
        b = -b
        d = -d
    if d > 0.9995:
        q = a + (b - a) * t
    else:
        th = math.acos(d)
        q = (math.sin((1 - t) * th) * a + math.sin(t * th) * b) / math.sin(th)
    return q / np.linalg.norm(q)


def sample_anim(js, bn, anim, t):
    """local TRS overrides {node: {'translation'|'rotation'|'scale': value}} at time t"""
    out = {}
    for ch in anim['channels']:
        smp = anim['samplers'][ch['sampler']]
        times = acc(js, bn, smp['input'])[:, 0]
        vals = acc(js, bn, smp['output'])
        k = int(np.searchsorted(times, t))
        if k <= 0:
            v = vals[0]
        elif k >= len(times):
            v = vals[-1]
        else:
            u = (t - times[k - 1]) / max(times[k] - times[k - 1], 1e-9)
            if ch['target']['path'] == 'rotation':
                v = slerp(vals[k - 1].astype(np.float64), vals[k].astype(np.float64), u)
            else:
                v = vals[k - 1] + (vals[k] - vals[k - 1]) * u
        out.setdefault(ch['target']['node'], {})[ch['target']['path']] = v
    return out


def pose_globals(js, over, root_m=None):
    """world matrices of every node with the sampled overrides applied"""
    par = parents(js)
    cache = {}

    def g(i):
        if i in cache:
            return cache[i]
        n = js['nodes'][i]
        o = over.get(i, {})
        if 'matrix' in n and not o:
            m = node_matrix(n)
        else:
            m = trs(o.get('translation', n.get('translation')), o.get('rotation', n.get('rotation')), o.get('scale', n.get('scale')))
        w = (g(par[i]) if i in par else (root_m if root_m is not None else np.eye(4))) @ m
        cache[i] = w
        return w
    return [g(i) for i in range(len(js['nodes']))]
