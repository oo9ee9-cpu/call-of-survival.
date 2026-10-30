"""pack a .gltf with an external .bin and image files into one .glb (images go into buffer views)
usage: python3 -I gltf2glb.py <scene.gltf> <out.glb> [skip-broken-images]"""
import sys, os, json, struct
src, out = sys.argv[1:3]
d = os.path.dirname(src); g = json.load(open(src))
bins = [open(os.path.join(d, b['uri']), 'rb').read() for b in g['buffers']]
assert len(bins) == 1, 'one buffer expected'
blob = bytearray(bins[0])
def pad4():
    while len(blob) % 4: blob.append(0)
for im in g.get('images', []):
    if 'uri' not in im: continue
    data = open(os.path.join(d, im['uri']), 'rb').read()
    mime = 'image/png' if data[:4] == b'\x89PNG' else 'image/jpeg'
    pad4(); off = len(blob); blob += data
    g['bufferViews'].append({'buffer': 0, 'byteOffset': off, 'byteLength': len(data)})
    im.pop('uri'); im['bufferView'] = len(g['bufferViews']) - 1; im['mimeType'] = mime
pad4()
g['buffers'] = [{'byteLength': len(blob)}]
js = json.dumps(g, separators=(',', ':')).encode()
js += b' ' * ((4 - len(js) % 4) % 4)
with open(out, 'wb') as f:
    f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(blob)))
    f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
    f.write(struct.pack('<II', len(blob), 0x004E4942)); f.write(bytes(blob))
print('wrote', out, os.path.getsize(out))
