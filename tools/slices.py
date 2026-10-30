"""centroids of a normalised mesh's vertices in horizontal slices, inside an x window: arm and leg centre lines for rig landmarks
usage: python3 -I slices.py <mesh.glb> '[[y, dy, xmin, xmax], ...]'"""
import sys, json, struct, numpy as np
b = open(sys.argv[1], 'rb').read(); off = 12; js = None; binc = b''
while off < len(b):
    L, T = struct.unpack('<II', b[off:off + 8]); c = b[off + 8:off + 8 + L]
    if T == 0x4E4F534A: js = json.loads(c)
    elif T == 0x004E4942: binc = c
    off += 8 + L
a = js['accessors'][js['meshes'][0]['primitives'][0]['attributes']['POSITION']]; bv = js['bufferViews'][a['bufferView']]
P = np.frombuffer(binc, np.float32, count=a['count'] * 3, offset=bv.get('byteOffset', 0)).reshape(-1, 3)
for y, dy, x0, x1 in json.loads(sys.argv[2]):
    s = P[(np.abs(P[:, 1] - y) < dy) & (P[:, 0] > x0) & (P[:, 0] < x1)]
    if not len(s): print(y, 'none'); continue
    print(f'y {y:.3f}  n {len(s):4d}  centre x {s[:, 0].mean():+.3f} z {s[:, 2].mean():+.3f}   x {s[:, 0].min():+.3f}..{s[:, 0].max():+.3f}  z {s[:, 2].min():+.3f}..{s[:, 2].max():+.3f}')
