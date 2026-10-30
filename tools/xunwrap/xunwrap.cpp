// usage: xunwrap in.bin out.bin
// in:  u32 vcount, u32 icount, u32 mode (bit 0: pack the charts given by the input uvs; bit 1: f32 maxCost and u32 resolution follow), u32 padding,
//      f32 pos[vcount*3], [mode 1: f32 uv[vcount*2]], u32 idx[icount]
// out: u32 nv, u32 ni, u32 width, u32 height, {u32 xref, f32 u, f32 v}[nv], u32 idx[ni]   (u, v in 0..1)
#include "../../dl/xatlas/source/xatlas/xatlas.h"
#include <cstdio>
#include <vector>
int main(int argc, char** argv) {
  if (argc < 3) return 1;
  FILE* f = fopen(argv[1], "rb"); if (!f) return 1;
  unsigned vc, ic, mode, pad;
  if (fread(&vc, 4, 1, f) != 1 || fread(&ic, 4, 1, f) != 1 || fread(&mode, 4, 1, f) != 1 || fread(&pad, 4, 1, f) != 1) return 2;
  float maxCost = 2.0f; unsigned res = 0;
  if (mode & 2) { if (fread(&maxCost, 4, 1, f) != 1 || fread(&res, 4, 1, f) != 1) return 2; }
  const bool useUv = mode & 1;
  std::vector<float> pos((size_t)vc * 3), uv; std::vector<unsigned> idx(ic);
  if (fread(pos.data(), 4, pos.size(), f) != pos.size()) return 3;
  if (useUv) { uv.resize((size_t)vc * 2); if (fread(uv.data(), 4, uv.size(), f) != uv.size()) return 3; }
  if (fread(idx.data(), 4, ic, f) != ic) return 3;
  fclose(f);
  xatlas::Atlas* atlas = xatlas::Create();
  xatlas::MeshDecl md; md.vertexPositionData = pos.data(); md.vertexCount = vc; md.vertexPositionStride = 12;
  if (useUv) { md.vertexUvData = uv.data(); md.vertexUvStride = 8; }
  md.indexData = idx.data(); md.indexCount = ic; md.indexFormat = xatlas::IndexFormat::UInt32;
  if (xatlas::AddMesh(atlas, md, 1) != xatlas::AddMeshError::Success) { fprintf(stderr, "addmesh failed\n"); return 4; }
  xatlas::ChartOptions co; co.maxIterations = 2; co.useInputMeshUvs = useUv; co.maxCost = maxCost;
  xatlas::PackOptions po; po.resolution = res; po.padding = pad; po.bilinear = true; po.blockAlign = false; po.bruteForce = false; po.rotateCharts = true;
  xatlas::Generate(atlas, co, po);
  const xatlas::Mesh& m = atlas->meshes[0];
  FILE* o = fopen(argv[2], "wb");
  unsigned nv = m.vertexCount, ni = m.indexCount, w = atlas->width, h = atlas->height;
  fwrite(&nv, 4, 1, o); fwrite(&ni, 4, 1, o); fwrite(&w, 4, 1, o); fwrite(&h, 4, 1, o);
  for (unsigned i = 0; i < nv; i++) { const xatlas::Vertex& v = m.vertexArray[i]; unsigned x = v.xref; float u = v.uv[0] / w, vv = v.uv[1] / h; fwrite(&x, 4, 1, o); fwrite(&u, 4, 1, o); fwrite(&vv, 4, 1, o); }
  fwrite(m.indexArray, 4, ni, o); fclose(o);
  fprintf(stderr, "unwrapped %u verts -> %u, charts %u, atlases %u, atlas %ux%u, utilization %.2f\n", vc, nv, atlas->chartCount, atlas->atlasCount, w, h, atlas->utilization ? atlas->utilization[0] : 0.0f);
  xatlas::Destroy(atlas);
  return 0;
}
