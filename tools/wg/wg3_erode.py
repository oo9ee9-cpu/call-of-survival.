import numpy as np, ctypes, sys, time
from common import *
lib = ctypes.CDLL(os.path.join(os.path.dirname(__file__), 'c/libwgc.so'))
fp = ctypes.POINTER(ctypes.c_float)
lib.erode.argtypes = [fp, fp, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_double, ctypes.c_double, ctypes.c_double, ctypes.c_double, ctypes.c_double, ctypes.c_double, ctypes.c_double, ctypes.c_double, ctypes.c_int, ctypes.c_uint, ctypes.c_float]
lib.thermal.argtypes = [fp, fp, ctypes.c_int, ctypes.c_int, ctypes.c_double, ctypes.c_double, ctypes.c_double]
h = load('h0').astype(np.float32).copy()
R = {k: load('R_' + k) for k in ['mount', 'ne', 'forest', 'farm', 'desert', 'swamp', 'city', 'tropic', 'nwisles']}
M = np.clip(0.55 + R['mount'] * 0.6 + R['ne'] * 0.4 + R['nwisles'] * 0.3 - R['farm'] * 0.35 - R['desert'] * 0.45 - R['swamp'] * 0.5 - R['city'] * 0.3, 0.05, 1.0).astype(np.float32)
M[h < 0] = 0.0
land0 = h > 0
drops = int(sys.argv[1]) if len(sys.argv) > 1 else 700000
t0 = time.time()
P = lambda a: a.ctypes.data_as(fp)
lib.thermal(P(h), P(M), N, 6, STEP, 0.9, 0.35)
lib.erode(P(h), P(M), N, drops, 100, STEP, 0.08, 3.0, 0.01, 0.25, 0.25, 0.012, 4.0, 2, 1234, 0.8)
lib.thermal(P(h), P(M), N, 4, STEP, 0.85, 0.3)
print('erosion', round(time.time() - t0, 1), 's')
# keep the coastline: land stays land, sea stays sea
h0 = load('h0')
h = np.where(land0, np.maximum(h, 0.45), np.minimum(h0, -0.45)).astype(np.float32)
save('h1', h); save('erodeM', M)
print('range', h.min(), h.max())
