"""Buildings for the 8 x 8 km valley: houses you can walk into (rooms, stairs, floors, doors, window frames,
furniture), shops, apartment blocks, barns, garages, ruins, barracks, the capture-point command posts, the airport's
hangars, control tower and terminal. Every type is written once as a glb with three levels of detail (nodes hi / mid /
far) plus a description for the game: box colliders, door hinges, loot spots, ivy spots, size.
Front of every building is +Z, origin at the middle of the footprint, ground floor at y = 0.2.
usage: python3 buildings.py <project_dir>      -> models/b/*.glb, data/valley/prefabs.json"""
import json
import math
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from meshlib import Mesh, write_glb  # noqa: E402

PROJ = sys.argv[1]
OUT = PROJ + '/models/b'
DATA = PROJ + '/data/valley'
os.makedirs(OUT, exist_ok=True)
os.makedirs(DATA, exist_ok=True)

# metres per texture repeat; the game swaps these material names for its own shaders
TILE = {'plaster': 2.0, 'plaster_in': 2.5, 'brick': 0.6, 'concrete': 3.0, 'floor_wood': 2.0, 'floor_tiles': 1.2,
        'ceiling': 2.5, 'roof_tiles': 2.0, 'roof_metal': 2.0, 'wood': 1.5, 'fabric': 1.0, 'metal': 2.0, 'paint': 4.0,
        'screen': 1.0, 'glass': 1.0, 'rubble': 2.0}
PREVIEW = {'plaster': (0.85, 0.82, 0.76), 'plaster_in': (0.8, 0.77, 0.7), 'brick': (0.55, 0.3, 0.22),
           'concrete': (0.55, 0.55, 0.53), 'floor_wood': (0.45, 0.32, 0.2), 'floor_tiles': (0.6, 0.58, 0.55),
           'ceiling': (0.85, 0.85, 0.82), 'roof_tiles': (0.55, 0.28, 0.18), 'roof_metal': (0.45, 0.47, 0.48),
           'wood': (0.4, 0.28, 0.18), 'fabric': (0.35, 0.35, 0.3), 'metal': (0.4, 0.42, 0.42),
           'paint': (0.55, 0.58, 0.55), 'screen': (0.1, 0.5, 0.2), 'glass': (0.2, 0.25, 0.28), 'rubble': (0.5, 0.48, 0.45)}

FACES = {  # normal, u (right), v (up) with u x v = normal (counter-clockwise seen from outside)
    'X': ((1, 0, 0), (0, 0, -1), (0, 1, 0)), 'x': ((-1, 0, 0), (0, 0, 1), (0, 1, 0)),
    'Z': ((0, 0, 1), (1, 0, 0), (0, 1, 0)), 'z': ((0, 0, -1), (-1, 0, 0), (0, 1, 0)),
    'Y': ((0, 1, 0), (1, 0, 0), (0, 0, -1)), 'y': ((0, -1, 0), (1, 0, 0), (0, 0, 1)),
}


def wbox(m, mat, x0, x1, y0, y1, z0, z1, faces='xXyYzZ', color=(1, 1, 1, 1)):
    """axis-aligned box; UVs projected from building space so neighbouring pieces continue the texture"""
    if x1 - x0 < 1e-4 or y1 - y0 < 1e-4 or z1 - z0 < 1e-4:
        return
    t = TILE.get(mat, 2.0)
    c = np.array([(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2])
    h = np.array([(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2])
    for f in faces:
        n, u, v = (np.array(a, np.float64) for a in FACES[f])
        P, UV = [], []
        for su, sv in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            p = c + n * h + u * h * su + v * h * sv
            P.append(p)
            UV.append((p @ u / t, -(p @ v) / t))
        m.add(mat, P, np.tile(n, (4, 1)), UV, [(0, 1, 2), (0, 2, 3)], color)


def quad(m, mat, P, color=(1, 1, 1, 1), uaxis=None):
    """planar quad (counter-clockwise seen from its front), UVs from building space"""
    P = np.asarray(P, np.float64)
    n = np.cross(P[1] - P[0], P[2] - P[0])
    n /= np.linalg.norm(n) + 1e-12
    u = np.asarray(uaxis, np.float64) if uaxis is not None else (P[1] - P[0]) / (np.linalg.norm(P[1] - P[0]) + 1e-12)
    v = np.cross(n, u)
    t = TILE.get(mat, 2.0)
    UV = [(p @ u / t, -(p @ v) / t) for p in P]
    m.add(mat, P, np.tile(n, (4, 1)), UV, [(0, 1, 2), (0, 2, 3)], color)


def tri(m, mat, P, color=(1, 1, 1, 1)):
    P = np.asarray(P, np.float64)
    n = np.cross(P[1] - P[0], P[2] - P[0])
    n /= np.linalg.norm(n) + 1e-12
    u = (P[1] - P[0]) / (np.linalg.norm(P[1] - P[0]) + 1e-12)
    v = np.cross(n, u)
    t = TILE.get(mat, 2.0)
    m.add(mat, P, np.tile(n, (3, 1)), [(p @ u / t, -(p @ v) / t) for p in P], [(0, 1, 2)], color)


class B:
    def __init__(self, name, w, d):
        self.name, self.w, self.d = name, w, d
        self.hi, self.mid, self.far = Mesh(), Mesh(), Mesh()
        self.cols, self.doors, self.loot, self.ivy, self.lights, self.points = [], [], [], [], [], {}
        self.h = 3.0

    def col(self, x0, x1, y0, y1, z0, z1, rot=(0, 0, 0)):
        self.cols.append([round((x0 + x1) / 2, 3), round((y0 + y1) / 2, 3), round((z0 + z1) / 2, 3),
                          round(x1 - x0, 3), round(y1 - y0, 3), round(z1 - z0, 3), round(rot[0], 4), round(rot[1], 4), round(rot[2], 4)])

    def solid(self, mat, x0, x1, y0, y1, z0, z1, collide=True, lods='h', faces='xXyYzZ', color=(1, 1, 1, 1)):
        if 'h' in lods:
            wbox(self.hi, mat, x0, x1, y0, y1, z0, z1, faces, color)
        if 'm' in lods:
            wbox(self.mid, mat, x0, x1, y0, y1, z0, z1, faces, color)
        if 'f' in lods:
            wbox(self.far, mat, x0, x1, y0, y1, z0, z1, faces, color)
        if collide:
            self.col(x0, x1, y0, y1, z0, z1)

    # ---- a wall with holes: runs along `axis` ('x' or 'z') from a0 to a1, centred on c, thickness t
    def wall(self, axis, c, a0, a1, y0, y1, t, mat_out, mat_in, out, holes=(), lods='hm', frames=True, ext=True):
        holes = [(max(hh[0], a0), min(hh[1], a1)) + tuple(hh[2:]) for hh in holes if hh[1] > a0 and hh[0] < a1]
        # cut the wall into vertical strips at every hole edge; in each strip keep what no hole covers
        cuts = sorted(set([a0, a1] + [hh[0] for hh in holes] + [hh[1] for hh in holes]))
        strips = []
        for i in range(len(cuts) - 1):
            ua, ub = cuts[i], cuts[i + 1]
            if ub - ua < 1e-4:
                continue
            cover = sorted([(hh[2], hh[3]) for hh in holes if hh[0] <= ua + 1e-6 and hh[1] >= ub - 1e-6])
            solid, cur_v = [], y0
            for (v0, v1) in cover:
                if v0 > cur_v + 1e-3:
                    solid.append((cur_v, min(v0, y1)))
                cur_v = max(cur_v, v1)
            if y1 > cur_v + 1e-3:
                solid.append((cur_v, y1))
            if strips and strips[-1][2] == solid and abs(strips[-1][1] - ua) < 1e-6:
                strips[-1] = (strips[-1][0], ub, solid)     # same profile as the strip before: widen it
            else:
                strips.append((ua, ub, solid))
        segs = [(ua, ub, v0, v1) for (ua, ub, solid) in strips for (v0, v1) in solid]
        o_face = ('Z' if out > 0 else 'z') if axis == 'x' else ('X' if out > 0 else 'x')
        i_face = ('z' if out > 0 else 'Z') if axis == 'x' else ('x' if out > 0 else 'X')
        e_faces = 'xXyY' if axis == 'x' else 'zZyY'
        for (u0, u1, v0, v1) in segs:
            if axis == 'x':
                box = (u0, u1, v0, v1, c - t / 2, c + t / 2)
            else:
                box = (c - t / 2, c + t / 2, v0, v1, u0, u1)
            self.solid(mat_out, *box, collide=True, lods=lods, faces=o_face)
            self.solid(mat_in, *box, collide=False, lods=lods.replace('m', '') if not ext else lods, faces=i_face)
            self.solid(mat_out if ext else mat_in, *box, collide=False, lods=lods, faces=e_faces)
        if frames:
            for (u0, u1, v0, v1, kind) in holes:
                self.frame(axis, c, u0, u1, v0, v1, t, kind)

    def frame(self, axis, c, u0, u1, v0, v1, t, kind):
        fw = 0.06
        pieces = [(u0, u0 + fw, v0, v1), (u1 - fw, u1, v0, v1), (u0, u1, v1 - fw, v1)]
        if kind == 'window':
            pieces += [(u0, u1, v0, v0 + fw), ((u0 + u1) / 2 - 0.03, (u0 + u1) / 2 + 0.03, v0, v1)]
        for (a, b, p, q) in pieces:
            if axis == 'x':
                wbox(self.hi, 'wood', a, b, p, q, c - t * 0.3, c + t * 0.3)
            else:
                wbox(self.hi, 'wood', c - t * 0.3, c + t * 0.3, p, q, a, b)
        if kind == 'window':   # sill outside
            if axis == 'x':
                wbox(self.hi, 'concrete', u0 - 0.05, u1 + 0.05, v0 - 0.06, v0, c - t * 0.5 - 0.04, c + t * 0.5 + 0.04)
            else:
                wbox(self.hi, 'concrete', c - t * 0.5 - 0.04, c + t * 0.5 + 0.04, v0 - 0.06, v0, u0 - 0.05, u1 + 0.05)

    def door(self, axis, c, u0, u1, y0, hgt, out):
        """a door leaf the game opens: hinge at u0, closed along the wall"""
        if axis == 'x':
            hinge = [u0 + 0.04, y0, c]
            yaw = 0.0
        else:
            hinge = [c, y0, u0 + 0.04]
            yaw = -math.pi / 2
        self.doors.append([round(hinge[0], 3), round(hinge[1], 3), round(hinge[2], 3), round(u1 - u0 - 0.08, 3), round(hgt - 0.04, 3), yaw, out])

    def slab(self, y, x0, x1, z0, z1, hole=None, top='floor_wood', thick=0.22, lods='hm'):
        """a floor: wood or tiles on top, ceiling under, an optional rectangular hole (stairs)"""
        rects = [(x0, x1, z0, z1)]
        if hole:
            hx0, hx1, hz0, hz1 = hole
            rects = [(x0, x1, z0, hz0), (x0, x1, hz1, z1), (x0, hx0, hz0, hz1), (hx1, x1, hz0, hz1)]
        for (a, b, p, q) in rects:
            if b - a < 1e-3 or q - p < 1e-3:
                continue
            self.solid(top, a, b, y - 0.04, y, p, q, collide=False, lods=lods, faces='Y')
            self.solid('ceiling', a, b, y - thick, y - 0.04, p, q, collide=False, lods=lods, faces='y')
            self.solid('concrete', a, b, y - thick, y - 0.04, p, q, collide=False, lods='h', faces='xXzZ')
            self.col(a, b, y - thick, y, p, q)

    def stairs(self, x0, x1, z0, y0, y1, run_dir=1):
        """straight stairs climbing towards +z (run_dir 1) or -z, over x0..x1, starting at z0"""
        n = max(4, int(round((y1 - y0) / 0.19)))
        rise = (y1 - y0) / n
        run = 0.27
        for k in range(n):
            za = z0 + run_dir * k * run
            zb = za + run_dir * run
            wbox(self.hi, 'wood', x0, x1, y0 + k * rise, y0 + (k + 1) * rise, min(za, zb), max(za, zb))
            wbox(self.hi, 'concrete', x0, x1, y0, y0 + k * rise, min(za, zb), max(za, zb), faces='xX')
        length = n * run
        ang = math.atan2(y1 - y0, length)
        hyp = math.hypot(length, y1 - y0)
        zc = z0 + run_dir * length / 2
        # collider: one ramp under the step noses
        self.cols.append([round((x0 + x1) / 2, 3), round((y0 + y1) / 2 - 0.08, 3), round(zc, 3), round(x1 - x0, 3), 0.16,
                          round(hyp, 3), round(-ang * run_dir, 4), 0.0, 0.0])
        return length

    def gable(self, y, x0, x1, z0, z1, rise, mat='roof_tiles', ov=0.45, wall_mat='plaster', t=0.25):
        """pitched roof, ridge along x"""
        zc = (z0 + z1) / 2
        hz = (z1 - z0) / 2 + ov
        slope = rise / ((z1 - z0) / 2)
        ye = y - ov * slope
        top = y + rise
        xa, xb = x0 - ov, x1 + ov
        for lod in (self.hi, self.mid, self.far):
            for s in (1, -1):
                ze = zc + s * hz
                # outer tiles
                P = [(xa, ye, ze), (xb, ye, ze), (xb, top, zc), (xa, top, zc)]
                if s < 0:
                    P = [P[1], P[0], P[3], P[2]]
                quad(lod, mat, P, uaxis=(1, 0, 0))
                if lod is not self.far:
                    Q = [(p[0], p[1] - 0.12, p[2]) for p in P]
                    quad(lod, 'wood', [Q[1], Q[0], Q[3], Q[2]], uaxis=(-1, 0, 0))
                    # fascia along the eave
                    wbox(lod, 'wood', xa, xb, ye - 0.14, ye + 0.02, min(ze, ze - s * 0.05), max(ze, ze - s * 0.05))
            # gable triangles (both faces)
            for xg, sg in ((x0, -1), (x1, 1)):
                A, Bp, C = (xg, y, z0), (xg, y, z1), (xg, top, zc)
                if sg > 0:
                    tri(lod, wall_mat, [A, C, Bp])
                    if lod is self.hi:
                        tri(lod, 'plaster_in', [(xg - 0.01, y, z0), (xg - 0.01, y, z1), (xg - 0.01, top, zc)])
                else:
                    tri(lod, wall_mat, [A, Bp, C])
                    if lod is self.hi:
                        tri(lod, 'plaster_in', [(xg + 0.01, y, z0), (xg + 0.01, top, zc), (xg + 0.01, y, z1)])
        for s in (1, -1):
            ang = math.atan2(rise, (z1 - z0) / 2)
            zc2 = zc + s * hz / 2
            self.cols.append([round((x0 + x1) / 2, 3), round((ye + top) / 2 - 0.08, 3), round(zc2, 3), round(xb - xa, 3), 0.16,
                              round(math.hypot(hz, top - ye), 3), round(s * ang, 4), 0.0, 0.0])

    def flat_roof(self, y, x0, x1, z0, z1, parapet=0.9, mat='concrete', t=0.25):
        for lod, lods in ((self.hi, 'h'), (self.mid, 'm'), (self.far, 'f')):
            wbox(lod, 'concrete', x0, x1, y, y + 0.25, z0, z1, faces='Y' if lod is not self.hi else 'Y')
        self.col(x0, x1, y, y + 0.25, z0, z1)
        if parapet > 0:
            for (a0, a1, b0, b1) in ((x0, x1, z0, z0 + t), (x0, x1, z1 - t, z1), (x0, x0 + t, z0, z1), (x1 - t, x1, z0, z1)):
                self.solid(mat, a0, a1, y, y + parapet, b0, b1, collide=True, lods='hmf')

    def furniture(self, kind, x, z, rot, y):
        """axis-aligned pieces; rot in quarter turns. Returns nothing; adds colliders and loot spots."""
        def put(mat, lx0, lx1, ly0, ly1, lz0, lz1, collide=False):
            pts = []
            for (a, b) in ((lx0, lz0), (lx1, lz1)):
                for _ in range(rot % 4):
                    a, b = b, -a
                pts.append((a, b))
            ax0, ax1 = sorted([pts[0][0], pts[1][0]])
            az0, az1 = sorted([pts[0][1], pts[1][1]])
            wbox(self.hi, mat, x + ax0, x + ax1, y + ly0, y + ly1, z + az0, z + az1)
            if collide:
                self.col(x + ax0, x + ax1, y + ly0, y + ly1, z + az0, z + az1)
        if kind == 'bed':
            put('wood', -1.0, 1.0, 0.0, 0.32, -0.47, 0.47, True)
            put('fabric', -0.95, 0.95, 0.32, 0.52, -0.43, 0.43)
            put('fabric', 0.6, 0.92, 0.52, 0.62, -0.35, 0.35)
            put('wood', 0.98, 1.06, 0.0, 0.95, -0.47, 0.47, True)
            self.loot.append([round(x, 2), round(y + 0.55, 2), round(z, 2)])
        elif kind == 'table':
            put('wood', -0.7, 0.7, 0.71, 0.76, -0.42, 0.42)
            for sx in (-0.62, 0.58):
                for sz in (-0.36, 0.32):
                    put('wood', sx, sx + 0.05, 0.0, 0.71, sz, sz + 0.05)
            self.col(x - 0.7, x + 0.7, y, y + 0.76, z - 0.42, z + 0.42)
            for sz in (-0.75, 0.75):   # chairs
                cz = z + sz if rot % 2 == 0 else z
                cx = x if rot % 2 == 0 else x + sz
                wbox(self.hi, 'wood', cx - 0.22, cx + 0.22, y + 0.42, y + 0.46, cz - 0.22, cz + 0.22)
                wbox(self.hi, 'wood', cx - 0.2, cx - 0.16, y, y + 0.42, cz - 0.2, cz - 0.16)
                wbox(self.hi, 'wood', cx + 0.16, cx + 0.2, y, y + 0.42, cz + 0.16, cz + 0.2)
            self.loot.append([round(x, 2), round(y + 0.78, 2), round(z, 2)])
        elif kind == 'wardrobe':
            put('wood', -0.5, 0.5, 0.0, 2.0, -0.28, 0.28, True)
        elif kind == 'sofa':
            put('fabric', -1.0, 1.0, 0.0, 0.45, -0.42, 0.42, True)
            put('fabric', -1.0, 1.0, 0.45, 0.85, 0.28, 0.42)
            put('fabric', -1.0, -0.82, 0.45, 0.65, -0.42, 0.42)
            put('fabric', 0.82, 1.0, 0.45, 0.65, -0.42, 0.42)
        elif kind == 'shelf':
            put('wood', -0.6, 0.6, 0.0, 1.8, 0.14, 0.18, True)
            for hy in (0.05, 0.6, 1.15, 1.7):
                put('wood', -0.6, 0.6, hy, hy + 0.03, -0.18, 0.18)
            self.loot.append([round(x, 2), round(y + 0.65, 2), round(z, 2)])
        elif kind == 'counter':
            put('wood', -1.2, 1.2, 0.0, 0.86, -0.3, 0.3, True)
            put('floor_tiles', -1.22, 1.22, 0.86, 0.9, -0.32, 0.32)
            self.loot.append([round(x, 2), round(y + 0.92, 2), round(z, 2)])
        elif kind == 'crates':
            put('wood', -0.5, 0.5, 0.0, 0.8, -0.5, 0.5, True)
            put('wood', -0.35, 0.35, 0.8, 1.4, -0.35, 0.35, True)
            self.loot.append([round(x, 2), round(y + 1.42, 2), round(z, 2)])
        elif kind == 'desk_pc':
            put('wood', -0.8, 0.8, 0.72, 0.77, -0.4, 0.4, True)
            put('metal', -0.75, -0.7, 0.0, 0.72, -0.35, 0.35)
            put('metal', 0.7, 0.75, 0.0, 0.72, -0.35, 0.35)
            put('metal', -0.3, 0.3, 0.77, 1.15, 0.12, 0.16)
            put('screen', -0.27, 0.27, 0.8, 1.12, 0.1, 0.12)
            self.points['computer'] = [round(x, 2), round(y + 0.8, 2), round(z, 2)]
        elif kind == 'locker':
            put('metal', -0.45, 0.45, 0.0, 1.9, -0.25, 0.25, True)
            self.loot.append([round(x, 2), round(y + 0.05, 2), round(z + (0.5 if rot % 4 == 0 else -0.5), 2)])

    def floor_loot(self, x0, x1, z0, z1, y, n, rs):
        for _ in range(n):
            self.loot.append([round(rs.uniform(x0 + 0.6, x1 - 0.6), 2), round(y + 0.02, 2), round(rs.uniform(z0 + 0.6, z1 - 0.6), 2)])

    def plinth(self, x0, x1, z0, z1, top=0.2):
        self.solid('concrete', x0 - 0.05, x1 + 0.05, -1.4, top, z0 - 0.05, z1 + 0.05, collide=True, lods='hmf', faces='xXzZ')

    def save(self):
        lo_tris = 0
        nodes = []
        for nm, mesh in (('hi', self.hi), ('mid', self.mid), ('far', self.far)):
            if mesh.parts:
                nodes.append(dict(name=nm, mesh=mesh))
        mats = {k: dict(color=PREVIEW[k] + (1,), rough=0.9) for k in PREVIEW}
        write_glb(OUT + '/%s.glb' % self.name, nodes, mats, '')
        return dict(w=self.w, d=self.d, h=round(self.h, 2), cols=self.cols, doors=self.doors, loot=self.loot,
                    ivy=self.ivy, points=self.points, tris=[self.hi.tcount(), self.mid.tcount(), self.far.tcount()])


def windows_on(a0, a1, y0, fh, floors, avoid=(), w=1.2, hgt=1.35, sill=0.95, bay=2.6):
    """evenly spaced windows on every floor of a wall; `avoid` = (u0, u1, floor) ranges kept clear"""
    out = []
    n = max(1, int((a1 - a0 - 0.8) // bay))
    step = (a1 - a0) / n
    for f in range(floors):
        for k in range(n):
            uc = a0 + step * (k + 0.5)
            u0, u1 = uc - w / 2, uc + w / 2
            if any(f == af and u1 > au0 - 0.3 and u0 < au1 + 0.3 for (au0, au1, af) in avoid):
                continue
            v0 = y0 + f * fh + sill
            out.append((u0, u1, v0, v0 + hgt, 'window'))
    return out


def house(name, W, D, F, roof='gable', ext='plaster', roof_mat='roof_tiles', fh=3.0, seed=1, kind='house', ruin=0.0):
    rs = np.random.RandomState(seed)
    b = B(name, W, D)
    t = 0.25
    x0, x1, z0, z1 = -W / 2, W / 2, -D / 2, D / 2
    y0 = 0.2
    b.plinth(x0, x1, z0, z1, y0)
    top = y0 + F * fh
    b.h = top
    inner = 'plaster_in'
    sb = 1.15                       # stair bay width (along the left wall)
    has_stairs = F > 1
    door_u = (x0 + sb + 0.9, x0 + sb + 1.9) if has_stairs else (-0.5, 0.5)
    if kind == 'shop':
        door_u = (-0.9, 0.9)
    holes = {'front': [], 'back': [], 'left': [], 'right': []}
    holes['front'].append((door_u[0], door_u[1], y0, y0 + 2.2, 'door'))
    if kind != 'garage':
        holes['back'].append((x1 - 2.4, x1 - 1.4, y0, y0 + 2.2, 'door'))
    if kind == 'shop':
        holes['front'] += [(x0 + 0.8, -1.4, y0 + 0.5, y0 + 2.7, 'window'), (1.4, x1 - 0.8, y0 + 0.5, y0 + 2.7, 'window')]
    elif kind in ('barn', 'garage', 'hangar_small'):
        holes['front'] = [(-1.9, 1.9, y0, y0 + min(3.4, fh - 0.4), 'gate')]
    else:
        holes['front'] += windows_on(x0 + 0.3, x1 - 0.3, y0, fh, F, avoid=[(door_u[0], door_u[1], 0)])
    if kind not in ('barn', 'garage'):
        holes['back'] += windows_on(x0 + 0.3, x1 - 0.3, y0, fh, F, avoid=[(x1 - 2.4, x1 - 1.4, 0)])
        holes['left'] += windows_on(z0 + 0.3, z1 - 0.3, y0, fh, F, avoid=[(z0, z1, 0)] if has_stairs else [])
        holes['right'] += windows_on(z0 + 0.3, z1 - 0.3, y0, fh, F)
    else:
        holes['left'] += [(z0 + 1.5, z0 + 2.5, y0 + fh - 1.6, y0 + fh - 0.6, 'window'), (z1 - 2.5, z1 - 1.5, y0 + fh - 1.6, y0 + fh - 0.6, 'window')]
        holes['right'] += [(z0 + 1.5, z0 + 2.5, y0 + fh - 1.6, y0 + fh - 0.6, 'window'), (z1 - 2.5, z1 - 1.5, y0 + fh - 1.6, y0 + fh - 0.6, 'window')]
    # ruins: knock holes in the walls
    if ruin > 0:
        for side in holes:
            for _ in range(2):
                u = rs.uniform(-1, 1) * (W / 2 - 1.2 if side in ('front', 'back') else D / 2 - 1.2)
                v = y0 + rs.uniform(0.6, top - y0 - 1.0)
                holes[side].append((u - rs.uniform(0.6, 1.4), u + rs.uniform(0.6, 1.4), v, min(top, v + rs.uniform(1.0, 2.6)), 'breach'))
    # exterior walls (outer faces in the exterior material, inner faces plastered)
    b.wall('x', z1 - t / 2, x0, x1, y0, top, t, ext, inner, 1, holes['front'])
    b.wall('x', z0 + t / 2, x0, x1, y0, top, t, ext, inner, -1, holes['back'])
    b.wall('z', x0 + t / 2, z0 + t, z1 - t, y0, top, t, ext, inner, -1, holes['left'])
    b.wall('z', x1 - t / 2, z0 + t, z1 - t, y0, top, t, ext, inner, 1, holes['right'])
    b.door('x', z1 - t / 2, door_u[0], door_u[1], y0, 2.2, 1)
    if kind != 'garage':
        b.door('x', z0 + t / 2, x1 - 2.4, x1 - 1.4, y0, 2.2, -1)
    # floors, stairs, partitions, furniture
    ix0, ix1, iz0, iz1 = x0 + t, x1 - t, z0 + t, z1 - t
    stair_len = 0.0
    hole = None
    if has_stairs:
        stair_len = round((fh / 0.19)) * 0.27
        hole = (ix0, ix0 + sb, iz0 + 0.3, iz0 + 0.3 + stair_len)
    zsplit = z0 + D * 0.48
    xsplit = x0 + W * 0.55
    for f in range(F):
        yf = y0 + f * fh
        floor_top = 'floor_tiles' if (f == 0 and kind in ('shop', 'garage', 'barn')) else 'floor_wood'
        if f == 0:
            b.slab(yf, ix0, ix1, iz0, iz1, None, floor_top, thick=0.1)
        else:
            b.slab(yf, ix0, ix1, iz0, iz1, hole, floor_top)
            if ruin > 0 and f == F - 1:
                pass
        if has_stairs and f < F - 1:
            b.stairs(ix0 + 0.05, ix0 + sb - 0.05, iz0 + 0.3, yf, yf + fh, 1)
        if kind in ('barn', 'garage', 'shop', 'hangar_small'):
            continue
        # partition along x (front rooms / back rooms) and along z in the back
        px0 = ix0 + (sb if has_stairs else 0.0)
        d_u = (px0 + 0.6, px0 + 1.5)
        b.wall('x', zsplit, px0, ix1, yf, yf + fh - (0.0 if f == F - 1 else 0.0), 0.12, inner, inner, 1,
               [(d_u[0], d_u[1], yf, yf + 2.1, 'idoor')], lods='h', ext=False)
        b.wall('z', xsplit, iz0, zsplit - 0.06, yf, yf + fh, 0.12, inner, inner, 1,
               [(zsplit - 1.6, zsplit - 0.7, yf, yf + 2.1, 'idoor')], lods='h', ext=False)
        # furniture by room: front room (living / bedroom), back left, back right
        fy = yf
        if f == 0:
            b.furniture('sofa', (px0 + ix1) / 2, iz1 - 0.6, 2, fy)
            b.furniture('table', (px0 + ix1) / 2 + 0.6, (zsplit + iz1) / 2 - 0.2, 0, fy)
            b.furniture('counter', (px0 + xsplit) / 2 + 0.2, iz0 + 0.45, 0, fy)
            b.furniture('shelf', ix1 - 0.3, (iz0 + zsplit) / 2, 1, fy)
        else:
            b.furniture('bed', (px0 + ix1) / 2 + 0.3, iz1 - 0.65, 0, fy)
            b.furniture('wardrobe', ix1 - 0.45, zsplit + 0.6, 1, fy)
            b.furniture('bed', (xsplit + ix1) / 2, iz0 + 0.6, 0, fy)
            b.furniture('table', (px0 + xsplit) / 2, (iz0 + zsplit) / 2, 1, fy)
        b.floor_loot(px0, xsplit, iz0, zsplit, fy, 1, rs)
        b.floor_loot(px0, ix1, zsplit, iz1, fy, 1, rs)
    if kind in ('barn', 'shop', 'garage'):
        for k in range(3 if kind == 'barn' else 2):
            b.furniture('crates' if kind != 'shop' else 'shelf', ix0 + 1.0 + k * 2.4, iz0 + 0.7, 0, y0)
        if kind == 'shop':
            b.furniture('counter', 0.0, (iz0 + iz1) / 2 + 0.6, 0, y0)
        b.floor_loot(ix0, ix1, iz0, iz1, y0, 3, rs)
    # roof
    if roof == 'gable' and ruin <= 0:
        b.slab(top, ix0, ix1, iz0, iz1, None, 'floor_wood', lods='h')
        b.gable(top, x0, x1, z0, z1, rise=min(W, D) * 0.33, mat=roof_mat, wall_mat=ext)
        b.h = top + min(W, D) * 0.33
    elif roof == 'flat':
        b.flat_roof(top, x0, x1, z0, z1, 0.9, ext)
        b.h = top + 0.9
    else:
        for k in range(10):   # rubble on the top floor
            rx, rz = rs.uniform(ix0 + 0.5, ix1 - 0.5), rs.uniform(iz0 + 0.5, iz1 - 0.5)
            s = rs.uniform(0.3, 0.8)
            wbox(b.hi, 'rubble', rx - s, rx + s, top - fh, top - fh + s * 0.6, rz - s * 0.7, rz + s * 0.7)
    # far level: a solid box with the roof
    wbox(b.far, ext, x0, x1, y0, top, z0, z1, faces='xXzZ')
    # ivy spots: along the walls between windows (x, y, z, nx, nz, height)
    for k in range(int(W + D) // 3):
        side = rs.randint(4)
        if side < 2:
            u = rs.uniform(x0 + 0.5, x1 - 0.5)
            p = [u, y0 - 0.1, z1 + 0.02 if side == 0 else z0 - 0.02, 0, 1 if side == 0 else -1]
        else:
            u = rs.uniform(z0 + 0.5, z1 - 0.5)
            p = [x1 + 0.02 if side == 2 else x0 - 0.02, y0 - 0.1, u, 1 if side == 2 else -1, 0]
        b.ivy.append([round(v, 2) for v in p] + [round(rs.uniform(1.8, top - y0 + 0.4), 2)])
    return b


def command_post(name='command_post'):
    """the capture point: a concrete bunker with sandbags, a desk and a computer"""
    b = house(name, 9.0, 7.0, 1, roof='flat', ext='concrete', kind='barn', fh=3.0, seed=7)
    b.loot = []
    b.furniture('desk_pc', 0.0, -1.8, 2, 0.2)
    b.furniture('locker', -3.4, -2.6, 0, 0.2)
    b.furniture('locker', -2.5, -2.6, 0, 0.2)
    b.furniture('table', 2.4, 0.8, 1, 0.2)
    for k in range(12):   # sandbag wall in front
        x = -4.4 + k * 0.8
        wbox(b.hi, 'fabric', x, x + 0.75, 0.0, 0.42, 4.2, 4.75)
        wbox(b.hi, 'fabric', x + 0.4, x + 1.15, 0.42, 0.84, 4.2, 4.75)
    b.col(-4.4, 5.4, 0.0, 0.84, 4.2, 4.75)
    return b


def barracks(name='barracks'):
    b = house(name, 20.0, 8.0, 1, roof='gable', ext='plaster', roof_mat='roof_metal', kind='barn', fh=3.2, seed=11)
    b.loot = []
    for k in range(6):
        b.furniture('bed', -8.0 + k * 3.2, -2.8, 0, 0.2)
        b.furniture('locker', -8.6 + k * 3.2, -3.4, 0, 0.2)
    b.floor_loot(-9, 9, -3, 3, 0.2, 4, np.random.RandomState(3))
    return b


def hangar(name='hangar', span=40.0, depth=48.0, height=15.0, segs=14):
    """arched hangar, open front (+Z), painted metal, concrete floor"""
    b = B(name, span, depth)
    b.h = height
    r = span / 2
    for k in range(segs):
        a0 = math.pi * k / segs
        a1 = math.pi * (k + 1) / segs
        p0 = (r * math.cos(a0), height * math.sin(a0))
        p1 = (r * math.cos(a1), height * math.sin(a1))
        for lod in (b.hi, b.mid, b.far):
            quad(lod, 'roof_metal', [(p1[0], p1[1], -depth / 2), (p0[0], p0[1], -depth / 2), (p0[0], p0[1], depth / 2), (p1[0], p1[1], depth / 2)], uaxis=(0, 0, 1))
            if lod is b.hi:
                quad(lod, 'paint', [(p0[0] * 0.995, p0[1] * 0.995, -depth / 2), (p1[0] * 0.995, p1[1] * 0.995, -depth / 2),
                                    (p1[0] * 0.995, p1[1] * 0.995, depth / 2), (p0[0] * 0.995, p0[1] * 0.995, depth / 2)], uaxis=(0, 0, -1))
        mx, my = (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2
        L = math.hypot(p1[0] - p0[0], p1[1] - p0[1])
        ang = math.atan2(p1[1] - p0[1], p1[0] - p0[0])
        b.cols.append([round(mx, 3), round(my, 3), 0.0, round(L, 3), 0.2, depth, 0.0, 0.0, round(ang, 4)])
        # back wall slice
        for lod in (b.hi, b.mid):
            quad(lod, 'paint', [(p0[0], 0, -depth / 2), (p1[0], 0, -depth / 2), (p1[0], p1[1], -depth / 2), (p0[0], p0[1], -depth / 2)], uaxis=(1, 0, 0))
            quad(lod, 'paint', [(p1[0], 0, -depth / 2 - 0.05), (p0[0], 0, -depth / 2 - 0.05), (p0[0], p0[1], -depth / 2 - 0.05), (p1[0], p1[1], -depth / 2 - 0.05)], uaxis=(-1, 0, 0))
    b.col(-r, r, 0, height * 0.8, -depth / 2 - 0.3, -depth / 2)
    b.solid('concrete', -r, r, -0.6, 0.05, -depth / 2, depth / 2, collide=True, lods='hm', faces='YxXzZ')
    # front frame beams
    for x in (-r, r):
        b.solid('paint', x - 0.4, x + 0.4, 0.0, 1.2, depth / 2 - 0.6, depth / 2, collide=True, lods='hm')
    for k in range(6):
        b.furniture('crates', -r + 3.0 + k * 1.6, -depth / 2 + 1.5, 0, 0.05)
    b.points['plane'] = [0.0, 0.05, 2.0]
    return b


def tower(name='control_tower'):
    b = house(name, 7.0, 7.0, 3, roof='flat', ext='concrete', fh=3.2, seed=13)
    # glass cab on top
    y = 0.2 + 3 * 3.2 + 0.25
    for (a0, a1, c0, c1) in ((-3.2, 3.2, 3.0, 3.2), (-3.2, 3.2, -3.2, -3.0), (-3.2, -3.0, -3.0, 3.0), (3.0, 3.2, -3.0, 3.0)):
        b.solid('glass', a0, a1, y + 1.0, y + 3.0, c0, c1, collide=False, lods='hmf')
        b.solid('paint', a0, a1, y, y + 1.0, c0, c1, collide=True, lods='hmf')
    b.solid('paint', -3.6, 3.6, y + 3.0, y + 3.35, -3.6, 3.6, collide=True, lods='hmf')
    b.h = y + 3.4
    return b


def main():
    types = {}
    specs = [
        ('cottage', dict(W=8.0, D=7.0, F=1, roof='gable', ext='plaster', seed=1)),
        ('farmhouse', dict(W=11.0, D=8.0, F=1, roof='gable', ext='plaster', seed=2)),
        ('house2', dict(W=9.5, D=8.5, F=2, roof='gable', ext='plaster', seed=3)),
        ('house2_brick', dict(W=10.5, D=9.0, F=2, roof='gable', ext='brick', seed=4)),
        ('townhouse', dict(W=7.0, D=10.0, F=2, roof='flat', ext='plaster', seed=5)),
        ('apartment', dict(W=14.0, D=11.0, F=3, roof='flat', ext='concrete', seed=6)),
        ('shop', dict(W=12.0, D=9.0, F=1, roof='flat', ext='brick', seed=7, kind='shop', fh=3.6)),
        ('villa', dict(W=14.0, D=11.0, F=2, roof='gable', ext='plaster', seed=8)),
        ('barn', dict(W=16.0, D=10.0, F=1, roof='gable', ext='brick', roof_mat='roof_metal', seed=9, kind='barn', fh=5.0)),
        ('garage', dict(W=7.0, D=6.0, F=1, roof='flat', ext='concrete', seed=10, kind='garage', fh=3.2)),
        ('ruin', dict(W=10.0, D=8.5, F=2, roof='none', ext='brick', seed=11, ruin=0.4)),
        ('ruin_small', dict(W=8.0, D=7.0, F=1, roof='none', ext='plaster', seed=12, ruin=0.5)),
        ('terminal', dict(W=40.0, D=18.0, F=2, roof='flat', ext='concrete', seed=14, kind='shop', fh=4.0)),
    ]
    for name, sp in specs:
        args = dict(sp)
        b = house(name, args.pop('W'), args.pop('D'), args.pop('F'), **args)
        types[name] = b.save()
        print(name, types[name]['tris'], 'cols', len(types[name]['cols']), 'loot', len(types[name]['loot']))
    for fn in (command_post, barracks, hangar, tower):
        b = fn()
        types[b.name] = b.save()
        print(b.name, types[b.name]['tris'], 'cols', len(types[b.name]['cols']))
    json.dump(types, open(DATA + '/prefabs.json', 'w'), separators=(',', ':'))
    print('prefabs', len(types))


main()
