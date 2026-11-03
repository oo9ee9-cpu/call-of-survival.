"""Prepares the owner's uploaded models (oo9ee9-cpu/uploads) for the valley: real-world size, standing on the ground
at the origin, facing -Z, textures shrunk for phones (JPEG unless they need alpha), credits kept.
Reads the uploads as data only.  usage: python3 -I user_models.py <uploads_dir> <project_dir> [name ...]
Writes models/u/<name>.glb and data/valley/user_models.json (size, credit, licence)."""
import io
import json
import math
import os
import struct
import sys
import zipfile

import numpy as np
from PIL import Image

SRC, PROJ = sys.argv[1], sys.argv[2]
ONLY = set(sys.argv[3:])
OUT = PROJ + '/models/u'
os.makedirs(OUT, exist_ok=True)

# name: (source file, inner file for zips or None, target size in metres of the longest side, yaw fix (deg), max texture)
MODELS = {
    'cvn65': ('uss_enterprise_cvn-65_aircraft_carrier.glb', None, 342.0, 0, 2048),
    'cvn80': ('uss_enterprise_cvn-80_aircraft_carrier.glb', None, 337.0, 0, 2048),
    'cdg': ('charles_de_gaulle_aircraft_carrier.glb', None, 261.0, 0, 2048),
    'chinook': ('boeing_ch-47_chinook_military_transport_aircraft.glb', None, 30.0, 0, 1024),
    'b2': ('b-2_spirit__mwt_tank_battles.glb', None, 52.0, 0, 1024),
    'j36': ('j-36__mwt_tank_battles.glb', None, 23.0, 0, 1024),
    'mi171': ('mi-171sh__mwt_tank_battles.glb', None, 25.0, 0, 1024),
    'fennek': ('knds_fennek.glb', None, 5.7, 0, 1024),
    'tam150': ('tam_150.glb', None, 8.0, 0, 1024),
    'patriot': ('mim-104_patriot_air_defense_system.glb', None, 11.0, 0, 1024),
    'cram': ('centurion_c-ram.glb', None, 8.0, 0, 1024),
    'cactus_sam': ('cactus_sam_south_africa.glb', None, 6.2, 0, 1024),
    'cactus_sahv': ('cactus_sahv_south_africa.glb', None, 6.0, 0, 1024),
    'pantsir': ('pantsir_s-1__mwt_tank_battles.glb', None, 11.0, 0, 1024),
    'radar': ('p-18_terek_radar_spoon_rest_d_on_ural-4320.glb', None, 12.0, 0, 1024),
    'watchtower': ('argentine__watchtower.glb', None, 10.0, 0, 1024),
    'fence': ('barrier_fence.glb', None, 3.5, 0, 512),
    'jersey': ('concrete_road_barrier.glb', None, 3.0, 0, 512),
    'container': ('container__door_open.glb', None, 6.06, 0, 1024),
    'res_contemporary': ('contemporary_residential_building_-.glb', None, 24.0, 0, 2048),
    'res_facade': ('modern_apartment_building_facade_scan.glb', None, 30.0, 0, 2048),
    'res_multistory': ('modern_multi-story_residential_building..glb', None, 30.0, 0, 2048),
    'inn': ('big_basin_inn_1920s.glb', None, 22.0, 0, 1024),
    'helmet': ('tactical_helmet_with_headset_game-ready.glb', None, 0.3, 0, 1024),
    'vest': ('modern_tactical_vest__plate_carrier.glb', None, 0.62, 0, 1024),
    'vest2': ('tactical_plate_carrier_vest_-_game_ready.glb', None, 0.6, 0, 1024),
    'laptop': ('macbook_pro_proledxdr.glb', None, 0.31, 0, 512),
    'drone': ('fpv_drone.glb', None, 0.26, 0, 512),
    'amraam': ('aim-120c_amraam.glb', None, 3.65, 0, 512),
    'gbu24': ('gbu-24_paveway_iii_lgb.glb', None, 4.4, 0, 512),
    'gbu27': ('gbu-27_paveway_iii_lgb.glb', None, 4.2, 0, 512),
    'mk84': ('mk84_air_low_drag_bomb.glb', None, 3.3, 0, 512),
    'palm': ('phoenix-palm-tree.zip', 'source/proprio__palmeira-phoenix.glb', 6.0, 0, 512),
    'ar55': ('zastava_ar55.glb', None, 3.75, 0, 1024),
}

# untextured models: colours by material name (the palm's materials are named in Portuguese: trunk, dry bases, rachises,
# leaflets)
MATCOL = {
    'palm': {'Tronco_castanho': [0.32, 0.24, 0.17, 1], 'Bases_secas_e_fibras': [0.42, 0.33, 0.22, 1],
             'Raques_verde_oliva': [0.36, 0.4, 0.2, 1], 'Foliolos_verdes': [0.2, 0.36, 0.12, 1]},
}

COMP = {5120: 'b', 5121: 'B', 5122: 'h', 5123: 'H', 5125: 'I', 5126: 'f'}
NCOMP = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def read_glb(data):
    magic, ver, total = struct.unpack('<III', data[:12])
    assert magic == 0x46546C67
    jl, jt = struct.unpack('<II', data[12:20])
    js = json.loads(data[20:20 + jl])
    off = 20 + jl
    binb = b''
    if off < len(data):
        bl, bt = struct.unpack('<II', data[off:off + 8])
        binb = data[off + 8:off + 8 + bl]
    return js, binb


def node_matrix(n):
    if 'matrix' in n:
        return np.array(n['matrix'], np.float64).reshape(4, 4).T
    t = np.array(n.get('translation', [0, 0, 0]), np.float64)
    q = n.get('rotation', [0, 0, 0, 1])
    s = np.array(n.get('scale', [1, 1, 1]), np.float64)
    x, y, z, w = q
    R = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                  [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                  [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
    M = np.eye(4)
    M[:3, :3] = R * s
    M[:3, 3] = t
    return M


def scene_bounds(js, binb):
    """axis-aligned bounds of every mesh vertex under the scene's node transforms (true positions, not accessor boxes)"""
    lo = np.full(3, np.inf)
    hi = np.full(3, -np.inf)
    views = js.get('bufferViews', [])
    accs = js.get('accessors', [])
    cache = {}

    def positions(ai):
        if ai in cache:
            return cache[ai]
        a = accs[ai]
        v = views[a['bufferView']]
        stride = v.get('byteStride', 12)
        base = v.get('byteOffset', 0) + a.get('byteOffset', 0)
        n = a['count']
        if stride == 12:
            P = np.frombuffer(binb[base:base + n * 12], '<f4').reshape(n, 3)
        else:
            P = np.array([struct.unpack('<fff', binb[base + i * stride:base + i * stride + 12]) for i in range(n)])
        cache[ai] = P.astype(np.float64)
        return cache[ai]

    def walk(ni, M):
        nonlocal lo, hi
        n = js['nodes'][ni]
        M2 = M @ node_matrix(n)
        if 'mesh' in n:
            for pr in js['meshes'][n['mesh']]['primitives']:
                ai = pr['attributes'].get('POSITION')
                if ai is None:
                    continue
                P = positions(ai)
                if len(P) > 60000:
                    P = P[::max(1, len(P) // 60000)]
                W = (M2[:3, :3] @ P.T).T + M2[:3, 3]
                lo = np.minimum(lo, W.min(0))
                hi = np.maximum(hi, W.max(0))
        for c in n.get('children', []):
            walk(c, M2)

    sc = js['scenes'][js.get('scene', 0)]
    for r in sc['nodes']:
        walk(r, np.eye(4))
    return lo, hi


def shrink_images(js, binb, max_px):
    """re-encode every embedded image no larger than max_px; rebuild the binary buffer"""
    views = js.get('bufferViews', [])
    img_views = {}
    for im in js.get('images', []):
        if 'bufferView' in im:
            img_views[im['bufferView']] = im
    out = bytearray()
    for vi, v in enumerate(views):
        b = binb[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']]
        if vi in img_views:
            try:
                im = Image.open(io.BytesIO(b))
                im.load()
                has_alpha = im.mode in ('RGBA', 'LA', 'P') and (im.mode != 'P' or 'transparency' in im.info)
                if has_alpha:
                    im = im.convert('RGBA')
                    if np.asarray(im)[..., 3].min() > 250:
                        has_alpha = False
                if max(im.size) > max_px:
                    s = max_px / max(im.size)
                    im = im.resize((max(1, int(im.size[0] * s)), max(1, int(im.size[1] * s))), Image.LANCZOS)
                buf = io.BytesIO()
                if has_alpha:
                    im.convert('RGBA').save(buf, 'PNG', optimize=True)
                    img_views[vi]['mimeType'] = 'image/png'
                else:
                    im.convert('RGB').save(buf, 'JPEG', quality=86, optimize=True)
                    img_views[vi]['mimeType'] = 'image/jpeg'
                b = buf.getvalue()
            except Exception as e:  # keep the original bytes
                print('   image kept:', e)
        while len(out) % 4:
            out.append(0)
        v['byteOffset'] = len(out)
        v['byteLength'] = len(b)
        v['buffer'] = 0
        out.extend(b)
    js['buffers'] = [{'byteLength': len(out)}]
    return bytes(out)


def write_glb(path, js, binb):
    jb = json.dumps(js, separators=(',', ':')).encode()
    while len(jb) % 4:
        jb += b' '
    bb = bytearray(binb)
    while len(bb) % 4:
        bb.append(0)
    total = 12 + 8 + len(jb) + 8 + len(bb)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(jb), 0x4E4F534A))
        f.write(jb)
        f.write(struct.pack('<II', len(bb), 0x004E4942))
        f.write(bytes(bb))


info = {}
for name, (src, inner, size, yaw, max_px) in MODELS.items():
    if ONLY and name not in ONLY:
        continue
    p = os.path.join(SRC, src)
    if not os.path.exists(p):
        print('missing', src)
        continue
    data = open(p, 'rb').read()
    if inner:
        data = zipfile.ZipFile(io.BytesIO(data)).read(inner)
    js, binb = read_glb(data)
    lo, hi = scene_bounds(js, binb)
    ext = hi - lo
    s = size / max(ext.max(), 1e-6)
    c = (lo + hi) / 2
    binb = shrink_images(js, binb, max_px)
    for m in js.get('materials', []):
        col = MATCOL.get(name, {}).get(m.get('name', ''))
        if col:
            m.setdefault('pbrMetallicRoughness', {})['baseColorFactor'] = col
    # wrap the scene: scale, centre on the footprint, feet on the ground, turn
    sc = js['scenes'][js.get('scene', 0)]
    q = [0.0, math.sin(math.radians(yaw) / 2), 0.0, math.cos(math.radians(yaw) / 2)]
    rootn = {'name': name, 'children': list(sc['nodes']), 'scale': [s, s, s], 'rotation': q}
    t = np.array([-c[0] * s, -lo[1] * s, -c[2] * s])
    if yaw:
        a = math.radians(yaw)
        t = np.array([t[0] * math.cos(a) + t[2] * math.sin(a), t[1], -t[0] * math.sin(a) + t[2] * math.cos(a)])
    rootn['translation'] = [float(v) for v in t]
    js['nodes'].append(rootn)
    sc['nodes'] = [len(js['nodes']) - 1]
    ex = js.get('asset', {}).get('extras', {}) if isinstance(js.get('asset', {}).get('extras'), dict) else {}
    write_glb(OUT + '/%s.glb' % name, js, binb)
    info[name] = dict(size=[round(float(v * s), 3) for v in ext], credit=ex.get('author', 'owner'), title=ex.get('title', name),
                      license=ex.get('license', 'owner'), source=ex.get('source', ''), mb=round(os.path.getsize(OUT + '/%s.glb' % name) / 1e6, 2))
    print('%-16s %6.2f MB  size %s  %s' % (name, info[name]['mb'], info[name]['size'], info[name]['license'][:18]))
old = {}
jp = PROJ + '/data/valley/user_models.json'
if os.path.exists(jp):
    old = json.load(open(jp))
old.update(info)
json.dump(old, open(jp, 'w'), indent=1, ensure_ascii=False)
