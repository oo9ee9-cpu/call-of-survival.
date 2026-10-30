// world generation helpers in C: hydraulic erosion (droplets), thermal erosion, A* paths
#include <math.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
static uint64_t rs = 88172645463325252ULL;
static inline double rnd(void) { rs ^= rs << 13; rs ^= rs >> 7; rs ^= rs << 17; return (rs >> 11) * (1.0 / 9007199254740992.0); }
static inline void grad(const float* H, int N, double x, double z, double* h, double* gx, double* gz) {
  int i = (int)x, j = (int)z; double u = x - i, v = z - j;
  int k = j * N + i; double a = H[k], b = H[k + 1], c = H[k + N], d = H[k + N + 1];
  *gx = (b - a) * (1 - v) + (d - c) * v; *gz = (c - a) * (1 - u) + (d - b) * u;
  *h = a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}
// H: heights (metres), M: erosion strength 0..1 per cell, cell: metres per cell
void erode(float* H, const float* M, int N, int drops, int maxSteps, double cell, double inertia, double capF, double minCap, double erodeR, double depoR, double evap, double grav, int radius, unsigned seed, float minH) {
  rs ^= seed * 2654435761ULL;
  int R = radius, bw = 2 * R + 1; double* W = malloc(sizeof(double) * bw * bw); double ws = 0;
  for (int b = -R; b <= R; b++) for (int a = -R; a <= R; a++) { double d = sqrt(a * a + b * b); double w = d > R ? 0 : 1 - d / R; W[(b + R) * bw + a + R] = w; ws += w; }
  for (int k = 0; k < bw * bw; k++) W[k] /= ws;
  for (int n = 0; n < drops; n++) {
    double x = R + 1 + rnd() * (N - 2 * R - 3), z = R + 1 + rnd() * (N - 2 * R - 3);
    { int ci = (int)x, cj = (int)z; if (H[cj * N + ci] < minH) continue; }
    double dx = 0, dz = 0, sp = 1, water = 1, sed = 0;
    for (int s = 0; s < maxSteps; s++) {
      int ci = (int)x, cj = (int)z; double u = x - ci, v = z - cj;
      double h, gx, gz; grad(H, N, x, z, &h, &gx, &gz);
      dx = dx * inertia - gx * (1 - inertia); dz = dz * inertia - gz * (1 - inertia);
      double l = sqrt(dx * dx + dz * dz); if (l < 1e-9) { double a = rnd() * 6.2831853; dx = cos(a); dz = sin(a); l = 1; }
      dx /= l; dz /= l;
      double nx = x + dx, nz = z + dz;
      if (nx < R + 1 || nz < R + 1 || nx >= N - R - 2 || nz >= N - R - 2) break;
      double nh, t1, t2; grad(H, N, nx, nz, &nh, &t1, &t2);
      double dh = nh - h;                         // metres along one cell
      double m = M[cj * N + ci];
      double cap = fmax(-dh / cell * sp * water * capF, minCap);
      if (sed > cap || dh > 0) {
        double dep = dh > 0 ? fmin(dh, sed) : (sed - cap) * depoR;
        sed -= dep; int k = cj * N + ci;
        H[k] += dep * (1 - u) * (1 - v); H[k + 1] += dep * u * (1 - v); H[k + N] += dep * (1 - u) * v; H[k + N + 1] += dep * u * v;
      } else {
        double er = fmin((cap - sed) * erodeR * m, -dh);
        for (int b = -R; b <= R; b++) for (int a = -R; a <= R; a++) {
          int ii = ci + a, jj = cj + b; double w = W[(b + R) * bw + a + R]; if (w <= 0) continue;
          int k = jj * N + ii; double e = er * w; if (H[k] - e < minH - 2) e = fmax(0, H[k] - (minH - 2));
          H[k] -= e; sed += e;
        }
      }
      sp = sqrt(fmax(0, sp * sp - dh / cell * grav)); water *= (1 - evap);
      x = nx; z = nz;
      if (water < 0.01) break;
    }
  }
  free(W);
}
// thermal: move material downhill where the slope exceeds talus (metres rise per metre)
void thermal(float* H, const float* M, int N, int iters, double cell, double talus, double rate) {
  float* D = malloc(sizeof(float) * N * N);
  static const int OX[8] = { 1, -1, 0, 0, 1, 1, -1, -1 }, OZ[8] = { 0, 0, 1, -1, 1, -1, 1, -1 };
  for (int it = 0; it < iters; it++) {
    memset(D, 0, sizeof(float) * N * N);
    for (int j = 1; j < N - 1; j++) for (int i = 1; i < N - 1; i++) {
      int k = j * N + i; double h = H[k], dmax = 0, dsum = 0, dd[8];
      for (int q = 0; q < 8; q++) { double dist = (q < 4 ? 1.0 : 1.41421356) * cell; double d = (h - H[k + OZ[q] * N + OX[q]]) - talus * dist; dd[q] = d > 0 ? d : 0; dsum += dd[q]; if (d > dmax) dmax = d; }
      if (dsum <= 0) continue;
      double mv = rate * dmax * 0.5 * M[k];
      for (int q = 0; q < 8; q++) if (dd[q] > 0) { double f = mv * dd[q] / dsum; D[k] -= f; D[k + OZ[q] * N + OX[q]] += f; }
    }
    for (int k = 0; k < N * N; k++) H[k] += D[k];
  }
  free(D);
}
// A* on a grid with a cost field (cost per metre multiplier, <0 = blocked) and slope penalty; returns path length, writes cells into out (max outMax)
typedef struct { float f; int k; } Node;
static Node* heap; static int hn;
static void push(float f, int k) { int i = hn++; heap[i].f = f; heap[i].k = k; while (i > 0) { int p = (i - 1) / 2; if (heap[p].f <= heap[i].f) break; Node t = heap[p]; heap[p] = heap[i]; heap[i] = t; i = p; } }
static Node pop(void) { Node r = heap[0]; heap[0] = heap[--hn]; int i = 0; for (;;) { int l = 2 * i + 1, rr = l + 1, m = i; if (l < hn && heap[l].f < heap[m].f) m = l; if (rr < hn && heap[rr].f < heap[m].f) m = rr; if (m == i) break; Node t = heap[m]; heap[m] = heap[i]; heap[i] = t; i = m; } return r; }
int astar(const float* H, const float* C, int N, double cell, int sx, int sz, int tx, int tz, double slopeW, double maxSlope, int* out, int outMax) {
  int NN = N * N; float* g = malloc(sizeof(float) * NN); int* from = malloc(sizeof(int) * NN); unsigned char* closed = calloc(NN, 1);
  heap = malloc(sizeof(Node) * NN * 2); hn = 0;
  for (int k = 0; k < NN; k++) { g[k] = 1e30f; from[k] = -1; }
  int s = sz * N + sx, t = tz * N + tx; g[s] = 0; push(0, s);
  static const int OX[16] = { 1, -1, 0, 0, 1, 1, -1, -1, 2, 2, -2, -2, 1, 1, -1, -1 }, OZ[16] = { 0, 0, 1, -1, 1, -1, 1, -1, 1, -1, 1, -1, 2, -2, 2, -2 };
  int found = 0;
  while (hn > 0) {
    Node nd = pop(); int k = nd.k; if (closed[k]) continue; closed[k] = 1;
    if (k == t) { found = 1; break; }
    int i = k % N, j = k / N;
    for (int q = 0; q < 16; q++) {
      int ii = i + OX[q], jj = j + OZ[q]; if (ii < 1 || jj < 1 || ii >= N - 1 || jj >= N - 1) continue;
      int kk = jj * N + ii; if (closed[kk]) continue;
      double c1 = C[kk]; if (c1 < 0) continue;
      double dist = sqrt((double)(OX[q] * OX[q] + OZ[q] * OZ[q])) * cell, slope = fabs(H[kk] - H[k]) / dist;
      if (slope > maxSlope) continue;
      double cost = dist * (c1 + C[k]) * 0.5 * (1 + slopeW * slope * slope * 100);
      double ng = g[k] + cost;
      if (ng < g[kk]) { g[kk] = ng; from[kk] = k; double hx = (ii - tx), hz = (jj - tz); push(ng + sqrt(hx * hx + hz * hz) * cell * 0.9, kk); }
    }
  }
  int n = 0;
  if (found) { int k = t; while (k != -1 && n < outMax) { out[n++] = k; k = from[k]; } }
  free(g); free(from); free(closed); free(heap);
  return found ? n : -1;
}
