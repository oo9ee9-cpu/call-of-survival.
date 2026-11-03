#!/usr/bin/env python3
"""Writes the import options the game needs (texture arrays, VRAM compression, packed maps kept RGBA, no auto LODs for trees).
Run once after the first import, then import again.  usage: python3 import_settings.py <project_dir>"""
import os, re, sys
P = sys.argv[1]
def params_of(path):
    if not os.path.exists(path): return {}
    txt = open(path).read(); m = re.search(r'\[params\]\n(.*)', txt, re.S)
    out = {}
    if m:
        for line in m.group(1).splitlines():
            if '=' in line: k, v = line.split('=', 1); out[k.strip()] = v.strip()
    return out
def uid_of(path):
    if not os.path.exists(path): return ''
    m = re.search(r'^uid="([^"]+)"', open(path).read(), re.M)
    return ('uid="%s"\n' % m.group(1)) if m else ''
def write_tex(rel, mode, mip=True, normal=0, extra=None):
    imp = P + '/' + rel + '.import'; prm = params_of(imp); uid = uid_of(imp)
    prm.update({'compress/mode': str(mode), 'mipmaps/generate': 'true' if mip else 'false', 'detect_3d/compress_to': '0',
                'compress/normal_map': str(normal), 'process/fix_alpha_border': 'true'})
    if extra: prm.update(extra)
    body = '[remap]\n\nimporter="texture"\ntype="CompressedTexture2D"\n' + uid + '\n[deps]\n\nsource_file="res://%s"\n\n[params]\n\n' % rel
    body += '\n'.join('%s=%s' % kv for kv in prm.items()) + '\n'
    open(imp, 'w').write(body)
def write_array(rel, n, mode=2):
    uid = uid_of(P + '/' + rel + '.import')
    body = ('[remap]\n\nimporter="2d_array_texture"\ntype="CompressedTexture2DArray"\n' + uid + '\n[deps]\n\nsource_file="res://%s"\n\n[params]\n\n'
            'compress/mode=%d\ncompress/high_quality=false\ncompress/lossy_quality=0.7\ncompress/hdr_compression=1\ncompress/channel_pack=0\n'
            'mipmaps/generate=true\nmipmaps/limit=-1\nslices/horizontal=1\nslices/vertical=%d\n') % (rel, mode, n)
    open(P + '/' + rel + '.import', 'w').write(body)
for root, dirs, files in os.walk(P + '/textures'):
    for f in files:
        if f.endswith('.import'): continue
        rel = os.path.relpath(os.path.join(root, f), P).replace(os.sep, '/')
        if rel.startswith('textures/terrain/terrain_') or rel.startswith('textures/v8/terrain_'): continue
        if '/splat_' in rel: write_tex(rel, 0, True, extra={'process/fix_alpha_border': 'false'})
        elif rel.endswith('fx/noise.png'): write_tex(rel, 0, True)
        elif rel.endswith('_nrh.png'): write_tex(rel, 2, True, 2)
        elif rel.endswith('weapons/ak_1.jpg'): write_tex(rel, 2, True, 1)
        else: write_tex(rel, 2, True)
write_array('textures/terrain/terrain_albedo.jpg', 8)
write_array('textures/terrain/terrain_nrh.png', 8)
if os.path.exists(P + '/textures/v8/terrain_albedo.jpg'):
    write_array('textures/v8/terrain_albedo.jpg', 8)
    write_array('textures/v8/terrain_nrh.png', 8)
for sub in ('b', 'v8'):
    d = P + '/models/' + sub
    if not os.path.isdir(d): continue
    for f in os.listdir(d):
        imp = d + '/' + f + '.import'
        if not f.endswith('.glb') or not os.path.exists(imp): continue
        txt = open(imp).read()
        txt = re.sub(r'meshes/generate_lods=\w+', 'meshes/generate_lods=false', txt)
        txt = re.sub(r'meshes/light_baking=\d', 'meshes/light_baking=0', txt)
        open(imp, 'w').write(txt)
for f in os.listdir(P + '/models'):
    if not f.endswith('.glb'): continue
    imp = P + '/models/' + f + '.import'
    if not os.path.exists(imp): continue
    txt = open(imp).read()
    tree = f.split('.')[0] in ('pine_dead', 'pine_snag', 'pine_burnt', 'pine_live', 'stump', 'log', 'bush_dead', 'impostor', 'wire') or f.endswith('_lo.glb')
    txt = re.sub(r'meshes/generate_lods=\w+', 'meshes/generate_lods=%s' % ('false' if tree else 'true'), txt)
    txt = re.sub(r'meshes/light_baking=\d', 'meshes/light_baking=0', txt)
    txt = re.sub(r'animation/import=\w+', 'animation/import=false', txt)
    open(imp, 'w').write(txt)
print('import settings written')
