"""summary of a .gltf (json + external bin): meshes, triangles, materials, textures, skins, animations, extents
usage: python3 -I gltfinfo.py <dir-with-scene.gltf>..."""
import json, os, sys

for d in sys.argv[1:]:
    p = os.path.join(d, 'scene.gltf')
    try:
        g = json.load(open(p))
    except Exception as e:
        print('==', os.path.basename(d.rstrip('/')), 'ERR', e); continue
    acc = g.get('accessors', [])
    tris = 0; verts = 0; prims = 0
    lo = [1e18] * 3; hi = [-1e18] * 3
    for m in g.get('meshes', []):
        for pr in m.get('primitives', []):
            prims += 1
            a = acc[pr['attributes']['POSITION']]
            verts += a['count']
            if 'min' in a:
                for k in range(3): lo[k] = min(lo[k], a['min'][k]); hi[k] = max(hi[k], a['max'][k])
            if 'indices' in pr: tris += acc[pr['indices']]['count'] // 3
            else: tris += a['count'] // 3
    mats = [(m.get('name'), list(m.get('extensions', {}).keys()), m.get('alphaMode', 'OPAQUE')) for m in g.get('materials', [])]
    imgs = [im.get('uri') for im in g.get('images', [])]
    nodes = g.get('nodes', [])
    scl = [n.get('scale') for n in nodes if n.get('scale')][:3]
    mats_ = [n.get('matrix') for n in nodes if n.get('matrix')][:2]
    print('==', os.path.basename(d.rstrip('/')))
    print('  meshes', len(g.get('meshes', [])), 'prims', prims, 'verts', verts, 'tris', tris, 'nodes', len(nodes))
    print('  local extent', [round(hi[k] - lo[k], 2) for k in range(3)], 'min', [round(v, 2) for v in lo])
    print('  materials', mats[:8], '...' if len(mats) > 8 else '')
    print('  images', len(imgs), imgs[:6])
    print('  skins', len(g.get('skins', [])), 'joints', [len(s.get('joints', [])) for s in g.get('skins', [])], 'animations', [(a.get('name'), len(a.get('channels', []))) for a in g.get('animations', [])][:4])
    print('  extensionsUsed', g.get('extensionsUsed'), 'node scales', scl, 'matrices', [[round(x, 3) for x in m] for m in mats_][:1])
