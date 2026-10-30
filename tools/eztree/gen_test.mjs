import { Tree } from './lib/index.js';
const t = new Tree();
t.loadPreset('Oak Large');
const g = t.createGeometry({});
console.log('branches verts', g.branches.attributes.position.count, 'tris', g.branches.index ? g.branches.index.count / 3 : 0);
console.log('leaves verts', g.leaves.attributes.position.count, 'tris', g.leaves.index ? g.leaves.index.count / 3 : 0, Object.keys(g.leaves.attributes));
g.branches.computeBoundingBox(); console.log(g.branches.boundingBox);
