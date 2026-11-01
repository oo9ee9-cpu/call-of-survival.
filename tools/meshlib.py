"""Small mesh toolkit + glTF 2.0 binary writer (numpy only).
Meshes keep one part per material; parts carry positions, normals, uv, uv2 (custom data), colours (AO / tint)."""
import numpy as np, json, struct, math

def v3(*a): return np.array(a, np.float64)
def normalize(v):
    v = np.asarray(v, np.float64); n = np.linalg.norm(v, axis=-1, keepdims=True); return v / np.maximum(n, 1e-12)
def rot_x(a): c, s = math.cos(a), math.sin(a); return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
def rot_y(a): c, s = math.cos(a), math.sin(a); return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
def rot_z(a): c, s = math.cos(a), math.sin(a); return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])
def basis_from_dir(d, up=(0, 1, 0)):
    """3x3 whose columns are (side, d, fwd): local +Y follows d"""
    d = normalize(d); up = np.asarray(up, np.float64)
    if abs(d @ up) > 0.95: up = np.array([1.0, 0, 0])
    x = normalize(np.cross(up, d)); z = np.cross(x, d); return np.stack([x, d, z], 1)

class Mesh:
    def __init__(self):
        self.parts = {}
    def add(self, mat, P, N, UV, I, C=None, UV2=None):
        P = np.asarray(P, np.float64).reshape(-1, 3); n = len(P)
        p = self.parts.setdefault(mat, dict(P=[], N=[], UV=[], UV2=[], C=[], I=[], n=0))
        p['P'].append(P); p['N'].append(normalize(np.asarray(N, np.float64).reshape(-1, 3)))
        p['UV'].append(np.asarray(UV, np.float64).reshape(-1, 2))
        p['UV2'].append(np.zeros((n, 2)) if UV2 is None else np.broadcast_to(np.asarray(UV2, np.float64), (n, 2)).copy())
        if C is None: C = np.ones((n, 4))
        C = np.asarray(C, np.float64)
        if C.ndim == 1: C = np.broadcast_to(np.r_[C, [1.0] * (4 - len(C))] if len(C) < 4 else C, (n, 4)).copy()
        elif C.shape[1] == 3: C = np.hstack([C, np.ones((n, 1))])
        p['C'].append(C)
        p['I'].append(np.asarray(I, np.int64).reshape(-1, 3) + p['n']); p['n'] += n
        return self
    def arrays(self, mat):
        p = self.parts[mat]
        return (np.concatenate(p['P']), np.concatenate(p['N']), np.concatenate(p['UV']), np.concatenate(p['UV2']),
                np.concatenate(p['C']), np.concatenate(p['I']))
    def merge(self, other, R=None, t=(0, 0, 0), s=1.0):
        R = np.eye(3) if R is None else np.asarray(R, np.float64); t = np.asarray(t, np.float64)
        S = np.diag(np.broadcast_to(np.asarray(s, np.float64), (3,)))
        M = R @ S; Mn = np.linalg.inv(M).T
        for mat in other.parts:
            P, N, UV, UV2, C, I = other.arrays(mat)
            self.add(mat, P @ M.T + t, N @ Mn.T, UV, I, C, UV2)
        return self
    def transform(self, R=None, t=(0, 0, 0), s=1.0):
        m = Mesh(); m.merge(self, R, t, s); return m
    def vcount(self): return sum(p['n'] for p in self.parts.values())
    def tcount(self): return sum(sum(len(i) for i in p['I']) for p in self.parts.values())
    def bounds(self):
        P = np.concatenate([np.concatenate(p['P']) for p in self.parts.values()]); return P.min(0), P.max(0)

# ------------------------------------------------------------------ primitives
def box(m, mat, size, center=(0, 0, 0), R=None, uvs=1.0, color=(1, 1, 1, 1), uv2=(0, 0), uv_off=(0, 0), faces='xXyYzZ'):
    """axis box (then rotated by R about its centre); UVs are metric * uvs"""
    R = np.eye(3) if R is None else np.asarray(R); c = np.asarray(center, np.float64); h = np.asarray(size, np.float64) / 2
    defs = {'X': ((1, 0, 0), (0, 0, -1), (0, 1, 0)), 'x': ((-1, 0, 0), (0, 0, 1), (0, 1, 0)), 'Y': ((0, 1, 0), (1, 0, 0), (0, 0, -1)),
            'y': ((0, -1, 0), (1, 0, 0), (0, 0, 1)), 'Z': ((0, 0, 1), (1, 0, 0), (0, 1, 0)), 'z': ((0, 0, -1), (-1, 0, 0), (0, 1, 0))}
    for f in faces:
        n, u, v = (np.array(a, np.float64) for a in defs[f])
        P = []; UV = []
        for (su, sv) in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            p = n * h + u * h * su + v * h * sv; P.append(p)
            UV.append(((p @ u) * uvs + uv_off[0], -(p @ v) * uvs + uv_off[1]))
        P = np.array(P) @ R.T + c; N = np.tile(n @ R.T, (4, 1))
        m.add(mat, P, N, UV, [(0, 1, 2), (0, 2, 3)], color, uv2)
    return m

def tube(m, mat, pts, radii, sides=8, uv_around=1.0, uv_len=2.0, cap0=False, cap1=False, color_fn=None, uv2_fn=None,
         rnoise=None, up=(0, 0, 1), u_rep=None, v0=0.0):
    """generalised cylinder along a 3-D polyline with per-ring radius (parallel-transport frames)"""
    pts = np.asarray(pts, np.float64); radii = np.asarray(radii, np.float64); n = len(pts)
    T = np.zeros_like(pts)
    T[1:-1] = pts[2:] - pts[:-2]; T[0] = pts[1] - pts[0]; T[-1] = pts[-1] - pts[-2]; T = normalize(T)
    upv = np.asarray(up, np.float64)
    if abs(T[0] @ upv) > 0.9: upv = np.array([1.0, 0, 0])
    Nf = normalize(np.cross(T[0], upv)); frames = []
    for i in range(n):
        if i > 0:
            b = np.cross(T[i - 1], T[i]); bl = np.linalg.norm(b)
            if bl > 1e-9:
                b /= bl; ang = math.acos(np.clip(T[i - 1] @ T[i], -1, 1))
                Nf = Nf * math.cos(ang) + np.cross(b, Nf) * math.sin(ang) + b * (b @ Nf) * (1 - math.cos(ang))
        Bf = np.cross(T[i], Nf); frames.append((Nf.copy(), Bf))
    seg = np.r_[0, np.cumsum(np.linalg.norm(pts[1:] - pts[:-1], axis=1))]
    if u_rep is None: u_rep = max(1, round(2 * math.pi * radii.mean() / uv_around))
    P, N, UV, C, U2 = [], [], [], [], []
    for i in range(n):
        Nf, Bf = frames[i]
        for j in range(sides + 1):
            a = 2 * math.pi * j / sides; dirv = Nf * math.cos(a) + Bf * math.sin(a)
            r = radii[i] * (rnoise(i, a) if rnoise else 1.0)
            p = pts[i] + dirv * r; P.append(p); N.append(dirv)
            UV.append((u_rep * j / sides, v0 + seg[i] / uv_len))
            t = seg[i] / max(seg[-1], 1e-9)
            C.append(color_fn(p, t, a) if color_fn else (1, 1, 1, 1)); U2.append(uv2_fn(p, t, a) if uv2_fn else (0, 0))
    I = []
    for i in range(n - 1):
        for j in range(sides):
            a0 = i * (sides + 1) + j; a1 = a0 + 1; b0 = a0 + sides + 1; b1 = b0 + 1
            I += [(a0, b1, b0), (a0, a1, b1)]
    m.add(mat, P, N, UV, I, C, U2)
    for (cap, i, sgn) in ((cap0, 0, -1), (cap1, n - 1, 1)):
        if not cap: continue
        cm = cap if isinstance(cap, str) else mat
        Nf, Bf = frames[i]; cP = [pts[i]]; cN = [T[i] * sgn]; cUV = [(0.5, 0.5)]
        for j in range(sides + 1):
            a = 2 * math.pi * j / sides; dirv = Nf * math.cos(a) + Bf * math.sin(a)
            r = radii[i] * (rnoise(i, a) if rnoise else 1.0)
            cP.append(pts[i] + dirv * r); cN.append(T[i] * sgn); cUV.append((0.5 + 0.5 * math.cos(a) * min(1, r / 0.3), 0.5 + 0.5 * math.sin(a) * min(1, r / 0.3)))
        cI = [(0, j + 1, j + 2) if sgn > 0 else (0, j + 2, j + 1) for j in range(sides)]
        cc = color_fn(pts[i], 1.0 if sgn > 0 else 0.0, 0) if color_fn else (1, 1, 1, 1)
        cu2 = uv2_fn(pts[i], 1.0 if sgn > 0 else 0.0, 0) if uv2_fn else (0, 0)
        m.add(cm, cP, cN, cUV, cI, cc, cu2)
    return m

def cyl(m, mat, p0, p1, r0, r1=None, sides=8, uv_around=1.0, uv_len=2.0, caps=True, color=(1, 1, 1, 1), uv2=(0, 0)):
    r1 = r0 if r1 is None else r1
    return tube(m, mat, [p0, p1], [r0, r1], sides, uv_around, uv_len, caps, caps, (lambda p, t, a: color), (lambda p, t, a: uv2))

def lathe(m, mat, prof, sides=16, center=(0, 0, 0), R=None, uv_v=1.0, color=(1, 1, 1, 1), uv2=(0, 0), u_rep=1):
    """profile [(r, y), ...] revolved around +Y"""
    R = np.eye(3) if R is None else np.asarray(R); c = np.asarray(center, np.float64); prof = np.asarray(prof, np.float64)
    k = len(prof); tn = np.zeros((k, 2))
    for i in range(k):
        a = prof[max(i - 1, 0)]; b = prof[min(i + 1, k - 1)]; d = b - a; tn[i] = (d[1], -d[0])
    tn = tn / np.maximum(np.linalg.norm(tn, axis=1, keepdims=True), 1e-9)
    s = np.r_[0, np.cumsum(np.linalg.norm(prof[1:] - prof[:-1], axis=1))]
    P, N, UV = [], [], []
    for i in range(k):
        for j in range(sides + 1):
            a = 2 * math.pi * j / sides; ca, sa = math.cos(a), math.sin(a)
            P.append((prof[i, 0] * ca, prof[i, 1], prof[i, 0] * sa)); N.append((tn[i, 0] * ca, tn[i, 1], tn[i, 0] * sa))
            UV.append((u_rep * j / sides, s[i] * uv_v))
    I = []
    for i in range(k - 1):
        for j in range(sides):
            a0 = i * (sides + 1) + j; a1 = a0 + 1; b0 = a0 + sides + 1; b1 = b0 + 1
            I += [(a0, b0, b1), (a0, b1, a1)]
    P = np.array(P) @ R.T + c; N = np.array(N) @ R.T
    m.add(mat, P, N, UV, I, color, uv2); return m

def quad(m, mat, corners, uv=((0, 1), (1, 1), (1, 0), (0, 0)), color=(1, 1, 1, 1), uv2=(0, 0), normal=None):
    P = np.asarray(corners, np.float64)
    n = normalize(np.cross(P[1] - P[0], P[2] - P[0])) if normal is None else normalize(normal)
    m.add(mat, P, np.tile(n, (4, 1)), uv, [(0, 1, 2), (0, 2, 3)], color, uv2); return m

def card(m, mat, base, R, w, h, uv=(0, 0, 1, 1), color=(1, 1, 1, 1), uv2=(0, 0), bend=0.0):
    """vertical card: local x across (w), local y up (h), built along R's columns; optional bend backwards along local z"""
    R = np.asarray(R); b = np.asarray(base, np.float64)
    u0, v0, u1, v1 = uv
    rows = 3 if bend else 1
    P, N, UV, I = [], [], [], []
    for r in range(rows + 1):
        t = r / rows; z = bend * t * t
        for sx in (-0.5, 0.5):
            P.append(b + R @ np.array([sx * w, t * h, z])); N.append(R @ np.array([0, 0.25, 1.0]))
            UV.append((u0 + (sx + 0.5) * (u1 - u0), v1 - t * (v1 - v0)))
    for r in range(rows):
        a = r * 2; I += [(a, a + 1, a + 3), (a, a + 3, a + 2)]
    m.add(mat, P, N, UV, I, color, uv2); return m

def grid(m, mat, nx, nz, fn, uvs=1.0, color_fn=None, uv2=(0, 0)):
    """height-field style sheet: fn(u, v) -> (x, y, z) with u, v in [0, 1]"""
    P = np.array([[fn(i / nx, j / nz) for i in range(nx + 1)] for j in range(nz + 1)])
    Pf = P.reshape(-1, 3)
    du = np.gradient(P, axis=1); dv = np.gradient(P, axis=0); Nn = normalize(np.cross(dv, du)).reshape(-1, 3)
    UV = [(Pf[k, 0] * uvs, Pf[k, 2] * uvs) for k in range(len(Pf))]
    I = []
    for j in range(nz):
        for i in range(nx):
            a = j * (nx + 1) + i; b = a + 1; c = a + nx + 1; d = c + 1; I += [(a, c, d), (a, d, b)]
    C = [color_fn(p) for p in Pf] if color_fn else (1, 1, 1, 1)
    m.add(mat, Pf, Nn, UV, I, C, uv2); return m

def superbox(m, mat, size, n=(18, 10), e=0.35, center=(0, 0, 0), R=None, uvs=1.0, color_fn=None, deform=None, uv2=(0, 0)):
    """rounded pillow / bag: superellipsoid (exponent e) scaled to size; n = (around, pole to pole) segments"""
    R = np.eye(3) if R is None else np.asarray(R); c = np.asarray(center, np.float64); hs = np.asarray(size) / 2
    nu, nv = n
    def sp(x, p): return np.sign(x) * np.abs(x) ** p
    P, N, UV = [], [], []
    for j in range(nv + 1):
        v = -math.pi / 2 + math.pi * j / nv
        for i in range(nu + 1):
            u = -math.pi + 2 * math.pi * i / nu
            x = sp(math.cos(v), e) * sp(math.cos(u), e); y = sp(math.sin(v), e); z = sp(math.cos(v), e) * sp(math.sin(u), e)
            p = np.array([x, y, z]) * hs
            if deform: p = deform(p)
            P.append(p); UV.append((u / (2 * math.pi) * (hs[0] + hs[2]) * 4 * uvs, (v / math.pi + 0.5) * hs[1] * 4 * uvs))
    P = np.array(P).reshape(nv + 1, nu + 1, 3)
    du = np.gradient(P, axis=1); dv = np.gradient(P, axis=0); Nn = normalize(np.cross(dv, du))
    # poles: use the axis
    Nn[0, :] = (0, -1, 0); Nn[-1, :] = (0, 1, 0)
    I = []
    for j in range(nv):
        for i in range(nu):
            a = j * (nu + 1) + i; b = a + 1; cc = a + nu + 1; d = cc + 1; I += [(a, cc, d), (a, d, b)]
    Pf = P.reshape(-1, 3); C = [color_fn(p) for p in Pf] if color_fn else (1, 1, 1, 1)
    m.add(mat, Pf @ R.T + c, Nn.reshape(-1, 3) @ R.T, UV, I, C, uv2); return m

# ------------------------------------------------------------------ glTF binary writer
def write_glb(path, nodes, mats, tex_prefix):
    """nodes: [dict(name, mesh, t=(x,y,z), extras={})]; mats: name -> dict(tex, nrm, color, rough, metal, alpha, cutoff, double)"""
    buf = bytearray(); views = []; accs = []
    def blob(b, target=None):
        while len(buf) % 4: buf.append(0)
        off = len(buf); buf.extend(b)
        v = dict(buffer=0, byteOffset=off, byteLength=len(b))
        if target: v['target'] = target
        views.append(v); return len(views) - 1
    def acc(arr, comp, typ, target, minmax=False, normalized=False):
        arr = np.ascontiguousarray(arr); vi = blob(arr.tobytes(), target)
        a = dict(bufferView=vi, componentType=comp, count=int(arr.shape[0]), type=typ)
        if normalized: a['normalized'] = True
        if minmax: a['min'] = [float(x) for x in arr.min(0)]; a['max'] = [float(x) for x in arr.max(0)]
        accs.append(a); return len(accs) - 1
    images, textures, imap = [], [], {}
    def tex(uri):
        if uri not in imap:
            images.append(dict(uri=tex_prefix + uri)); textures.append(dict(source=len(images) - 1, sampler=0)); imap[uri] = len(textures) - 1
        return imap[uri]
    mat_list, mat_idx = [], {}
    def material(name):
        if name in mat_idx: return mat_idx[name]
        d = mats.get(name, {})
        pbr = dict(baseColorFactor=list(d.get('color', (1, 1, 1, 1))), metallicFactor=d.get('metal', 0.0), roughnessFactor=d.get('rough', 0.85))
        if d.get('tex'): pbr['baseColorTexture'] = dict(index=tex(d['tex']))
        if d.get('mr'): pbr['metallicRoughnessTexture'] = dict(index=tex(d['mr']))
        mm = dict(name=name, pbrMetallicRoughness=pbr)
        if d.get('nrm'): mm['normalTexture'] = dict(index=tex(d['nrm']))
        if d.get('alpha'): mm['alphaMode'] = d['alpha']
        if d.get('alpha') == 'MASK': mm['alphaCutoff'] = d.get('cutoff', 0.5)
        if d.get('double'): mm['doubleSided'] = True
        if d.get('emissive'): mm['emissiveFactor'] = list(d['emissive'])
        mat_list.append(mm); mat_idx[name] = len(mat_list) - 1; return mat_idx[name]
    gmeshes, gnodes = [], []
    for nd in nodes:
        mesh = nd['mesh']; prims = []
        for mat in mesh.parts:
            P, N, UV, UV2, C, I = mesh.arrays(mat)
            attrs = dict(POSITION=acc(P.astype(np.float32), 5126, 'VEC3', 34962, True), NORMAL=acc(normalize(N).astype(np.float32), 5126, 'VEC3', 34962),
                         TEXCOORD_0=acc(UV.astype(np.float32), 5126, 'VEC2', 34962))
            if np.any(UV2 != 0): attrs['TEXCOORD_1'] = acc(UV2.astype(np.float32), 5126, 'VEC2', 34962)
            if np.any(C != 1): attrs['COLOR_0'] = acc(np.clip(C, 0, 1).astype(np.float32), 5126, 'VEC4', 34962)
            prims.append(dict(attributes=attrs, indices=acc(I.reshape(-1).astype(np.uint32), 5125, 'SCALAR', 34963), material=material(mat)))
        gmeshes.append(dict(name=nd['name'], primitives=prims))
        node = dict(name=nd['name'], mesh=len(gmeshes) - 1)
        if 't' in nd: node['translation'] = [float(x) for x in nd['t']]
        if 'extras' in nd: node['extras'] = nd['extras']
        gnodes.append(node)
    for ex in [n for n in nodes if n.get('empty')]: pass
    js = dict(asset=dict(version='2.0', generator='cos-front meshlib'), scene=0, scenes=[dict(nodes=list(range(len(gnodes))))],
              nodes=gnodes, meshes=gmeshes, materials=mat_list, accessors=accs, bufferViews=views, buffers=[dict(byteLength=len(buf))])
    if images:
        js['images'] = images; js['textures'] = textures; js['samplers'] = [dict(magFilter=9729, minFilter=9987, wrapS=10497, wrapT=10497)]
    jb = json.dumps(js, separators=(',', ':')).encode()
    while len(jb) % 4: jb += b' '
    while len(buf) % 4: buf.append(0)
    out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(jb) + 8 + len(buf)) + struct.pack('<II', len(jb), 0x4E4F534A) + jb + struct.pack('<II', len(buf), 0x004E4942) + bytes(buf)
    open(path, 'wb').write(out)
    return len(out)
