"""tiny glTF reader for .gltf + external .bin: accessors as numpy, node world matrices"""
import json, os, numpy as np
CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
class G:
    def __init__(self, path):
        self.dir = os.path.dirname(path); self.js = json.load(open(path))
        self.bufs = [open(os.path.join(self.dir, b['uri']), 'rb').read() if 'uri' in b else None for b in self.js.get('buffers', [])]
    def acc(self, i):
        a = self.js['accessors'][i]; nc = NC[a['type']]; dt = CT[a['componentType']]
        if 'bufferView' not in a: return np.zeros((a['count'], nc), dt)
        bv = self.js['bufferViews'][a['bufferView']]; buf = self.bufs[bv['buffer']]
        start = bv.get('byteOffset', 0) + a.get('byteOffset', 0); item = nc * np.dtype(dt).itemsize; stride = bv.get('byteStride') or item
        if stride == item: arr = np.frombuffer(buf, dt, count=a['count'] * nc, offset=start).reshape(a['count'], nc)
        else:
            raw = np.frombuffer(buf, np.uint8, count=stride * (a['count'] - 1) + item, offset=start)
            idx = (np.arange(a['count'])[:, None] * stride + np.arange(item)[None, :])
            arr = raw[idx].copy().view(dt).reshape(a['count'], nc)
        arr = arr.astype(np.float64) if dt == np.float32 else arr.copy()
        if a.get('normalized'):
            arr = arr.astype(np.float64) / {5121: 255, 5123: 65535, 5120: 127, 5122: 32767}[a['componentType']]
        return arr
    def node_mats(self):
        js = self.js; W = {}
        def local(n):
            if 'matrix' in n: return np.array(n['matrix'], np.float64).reshape(4, 4).T
            T = np.eye(4)
            t = n.get('translation', [0, 0, 0]); r = n.get('rotation', [0, 0, 0, 1]); s = n.get('scale', [1, 1, 1])
            x, y, z, w = r
            R = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
            T[:3, :3] = R * np.array(s)[None, :]; T[:3, 3] = t; return T
        def walk(i, P):
            M = P @ local(js['nodes'][i]); W[i] = M
            for c in js['nodes'][i].get('children', []): walk(c, M)
        for s in js['scenes'][js.get('scene', 0)]['nodes']: walk(s, np.eye(4))
        return W
    def prims(self):
        """(node, mesh, primitive index, primitive, world matrix) for every drawn primitive"""
        W = self.node_mats(); out = []
        for ni, M in W.items():
            n = self.js['nodes'][ni]
            if 'mesh' not in n: continue
            for pi, p in enumerate(self.js['meshes'][n['mesh']]['primitives']): out.append((ni, n['mesh'], pi, p, M))
        return out
