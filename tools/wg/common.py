import numpy as np, os
# which map: MAP=island (the original 8 x 8 km), desert, snow, forest, water, mega
MAP = os.environ.get('MAP', 'island')
GRIDS = {
    'island': (1025, 8192.0, 4000.0, 100.0),
    'desert': (513, 4096.0, 2000.0, 100.0),
    'water': (385, 3072.0, 1500.0, 100.0),
    'snow': (769, 6144.0, 3000.0, 100.0),
    'forest': (897, 7168.0, 3500.0, 100.0),
    'mega': (1921, 30720.0, 15000.0, 50.0),
}
N, WORLD, PLAY, HSCALE = GRIDS[MAP]   # samples per side, metres, playable half-size, height encoding (v / HSCALE - 100)
STEP = WORLD / (N - 1)       # 8 m (16 m on the mega map)
HALF = WORLD / 2
OUT = os.path.join(os.path.dirname(__file__), '../../build/wg' + ('' if MAP == 'island' else '_' + MAP))
DST = os.path.join(os.path.dirname(__file__), '../../assets/' + ('world' if MAP == 'island' else 'maps/' + MAP))
os.makedirs(OUT, exist_ok=True)
xs = -HALF + np.arange(N) * STEP
X, Z = np.meshgrid(xs, xs)   # X[j,i] = x(i), Z[j,i] = z(j); north = -z

def _perm(seed):
    r = np.random.RandomState(seed); p = r.permutation(256); return np.concatenate([p, p])
_GR = np.array([[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1],[0.7071,0.7071],[-0.7071,0.7071],[0.7071,-0.7071],[-0.7071,-0.7071]], dtype=np.float64)
def perlin(x, z, seed=0):
    p = _perm(seed)
    xi = np.floor(x).astype(np.int64); zi = np.floor(z).astype(np.int64)
    xf = x - xi; zf = z - zi
    xi &= 255; zi &= 255
    def grad(h, dx, dz):
        g = _GR[h % 12]; return g[..., 0] * dx + g[..., 1] * dz
    aa = p[p[xi] + zi]; ab = p[p[xi] + zi + 1]; ba = p[p[xi + 1] + zi]; bb = p[p[xi + 1] + zi + 1]
    u = xf * xf * xf * (xf * (xf * 6 - 15) + 10); v = zf * zf * zf * (zf * (zf * 6 - 15) + 10)
    x1 = grad(aa, xf, zf) * (1 - u) + grad(ba, xf - 1, zf) * u
    x2 = grad(ab, xf, zf - 1) * (1 - u) + grad(bb, xf - 1, zf - 1) * u
    return (x1 * (1 - v) + x2 * v)          # roughly -1..1
def fbm(x, z, oct=5, seed=0, lac=2.03, gain=0.5):
    s = np.zeros_like(x); a = 1.0; f = 1.0; n = 0.0
    for o in range(oct):
        s += a * perlin(x * f + o * 17.31, z * f - o * 9.13, seed + o * 101); n += a; a *= gain; f *= lac
    return s / n
def ridged(x, z, oct=5, seed=0, lac=2.1, gain=0.5):
    s = np.zeros_like(x); a = 1.0; f = 1.0; n = 0.0; w = np.ones_like(x)
    for o in range(oct):
        v = 1 - np.abs(perlin(x * f + o * 31.7, z * f + o * 11.3, seed + o * 77)); v = v * v * w
        w = np.clip(v * 1.6, 0, 1)
        s += a * v; n += a; a *= gain; f *= lac
    return s / n
def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)
def ell(cx, cz, rx, rz, rot=0.0):
    c, s = np.cos(rot), np.sin(rot); dx = X - cx; dz = Z - cz
    u = (dx * c + dz * s) / rx; v = (-dx * s + dz * c) / rz
    return 1 - np.sqrt(u * u + v * v)        # 1 at centre, 0 at the rim, negative outside
def save(name, arr): np.save(os.path.join(OUT, name + '.npy'), arr)
def load(name): return np.load(os.path.join(OUT, name + '.npy'))

def inplay():
    return (np.abs(X) <= PLAY) & (np.abs(Z) <= PLAY)
