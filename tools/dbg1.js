(() => {
  const out = {};
  const p = __find((x, z) => biomeAt(x, z) === 6 && classAt(x, z) === 0 && slopeAt(x, z) < 0.08, 32, [-1800, -1500]);
  __go(p[0], p[1], { hour: 11, w: 'clear' });
  const box = (o) => { o.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(o); return [b.min.toArray().map((v) => +v.toFixed(2)), b.max.toArray().map((v) => +v.toFixed(2))]; };
  out.soldier = { box: box(RIG.body.root), pos: player.pos.toArray().map((v) => +v.toFixed(2)), scale: RIG.body.inner.scale.x, C: { s: CHARS.soldier.scale, flip: CHARS.soldier.flip, minY: CHARS.soldier.minY } };
  invAdd('outfit_michelle', 1, true); wearItem('outfit_michelle');
  out.michelle = { kind: RIG.body.kind, box: box(RIG.body.root), scale: RIG.body.inner.scale.x, C: { s: CHARS.michelle.scale, flip: CHARS.michelle.flip, minY: CHARS.michelle.minY }, inRoot: player.root.children.includes(RIG.body.root), vis: RIG.body.root.visible, meshes: (() => { const a = []; RIG.body.model.traverse((o) => { if (o.isMesh) a.push([o.name, o.visible, o.geometry.attributes.position.count, !!o.material.skinning, o.isSkinnedMesh]); }); return a; })() };
  const g = []; CHARS.michelle.scene.traverse((o) => g.push([o.type, o.name, o.scale.x.toFixed(3)])); out.tree = g.slice(0, 12);
  return out;
})()
