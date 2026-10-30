// usage: msimplify in.bin out.bin   (in: u32 vcount, u32 icount, u32 stride(floats, first 3 = position), f32 ratio, f32 maxerr, u32 attrcount, f32 weights[attrcount], f32 verts[vcount*stride], u32 idx[icount])
#include "../../dl/meshopt/src/meshoptimizer.h"
#include <cstdio>
#include <cstdlib>
#include <vector>
#include <cstring>
int main(int argc, char** argv) {
  FILE* f = fopen(argv[1], "rb"); if (!f) return 1;
  unsigned vc, ic, st, ac; float ratio, maxerr;
  fread(&vc, 4, 1, f); fread(&ic, 4, 1, f); fread(&st, 4, 1, f); fread(&ratio, 4, 1, f); fread(&maxerr, 4, 1, f); fread(&ac, 4, 1, f);
  std::vector<float> w(ac); fread(w.data(), 4, ac, f);
  std::vector<float> v((size_t)vc * st); fread(v.data(), 4, v.size(), f);
  std::vector<unsigned> idx(ic); fread(idx.data(), 4, ic, f); fclose(f);
  size_t target = (size_t)(ic * ratio) / 3 * 3;
  std::vector<unsigned> out(ic);
  float err = 0;
  size_t n;
  if (maxerr < 0) n = meshopt_simplifySloppy(out.data(), idx.data(), ic, v.data(), vc, st * 4, target, -maxerr, &err);
  else if (ac > 0) n = meshopt_simplifyWithAttributes(out.data(), idx.data(), ic, v.data(), vc, st * 4, v.data() + 3, st * 4, w.data(), ac, nullptr, target, maxerr, 0, &err);
  else n = meshopt_simplify(out.data(), idx.data(), ic, v.data(), vc, st * 4, target, maxerr, 0, &err);
  out.resize(n);
  meshopt_optimizeVertexCache(out.data(), out.data(), n, vc);
  std::vector<unsigned> remap(vc);
  size_t nv = meshopt_optimizeVertexFetchRemap(remap.data(), out.data(), n, vc);
  std::vector<float> nvbuf(nv * st);
  meshopt_remapVertexBuffer(nvbuf.data(), v.data(), vc, st * 4, remap.data());
  meshopt_remapIndexBuffer(out.data(), out.data(), n, remap.data());
  FILE* o = fopen(argv[2], "wb"); unsigned nvu = nv, nu = n; fwrite(&nvu, 4, 1, o); fwrite(&nu, 4, 1, o); fwrite(&err, 4, 1, o);
  fwrite(nvbuf.data(), 4, nvbuf.size(), o); fwrite(out.data(), 4, n, o); fclose(o);
  fprintf(stderr, "simplified %u -> %zu tris, %u -> %zu verts, err %.4f\n", ic / 3, n / 3, vc, nv, err);
  return 0;
}
