"""Converts the browser game's packed models (assets/models/*.json: glTF JSON + base64 buffer, textures as
sibling .jpg/.png files) into self-contained .glb files for Godot.
usage: python3 json2glb.py <model.json> <out.glb> [--keep-anims a,b,c]"""
import base64
import json
import os
import struct
import sys


def pad4(b, fill=b'\x00'):
    return b + fill * ((4 - len(b) % 4) % 4)


def convert(src, out, keep_anims=None):
    d = json.load(open(src))
    g = d['gltf'] if isinstance(d['gltf'], dict) else json.loads(d['gltf'])
    binb = bytearray(base64.b64decode(d['bin']))
    binb = bytearray(pad4(bytes(binb)))
    folder = os.path.dirname(src)
    views = g.setdefault('bufferViews', [])
    for img in g.get('images', []):
        uri = img.pop('uri', None)
        if uri is None:
            continue
        data = open(os.path.join(folder, uri), 'rb').read()
        off = len(binb)
        binb += pad4(data)
        views.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(data)})
        img['bufferView'] = len(views) - 1
        img.setdefault('mimeType', 'image/png' if uri.endswith('.png') else 'image/jpeg')
    if keep_anims is not None:
        g['animations'] = [a for a in g.get('animations', []) if a.get('name') in keep_anims]
    g['buffers'] = [{'byteLength': len(binb)}]
    js = pad4(json.dumps(g, separators=(',', ':')).encode(), b' ')
    total = 12 + 8 + len(js) + 8 + len(binb)
    with open(out, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(js), 0x4E4F534A))
        f.write(js)
        f.write(struct.pack('<II', len(binb), 0x004E4942))
        f.write(bytes(binb))
    return total


if __name__ == '__main__':
    keep = None
    if '--keep-anims' in sys.argv:
        keep = sys.argv[sys.argv.index('--keep-anims') + 1].split(',')
    n = convert(sys.argv[1], sys.argv[2], keep)
    print(sys.argv[2], n // 1024, 'KB')
