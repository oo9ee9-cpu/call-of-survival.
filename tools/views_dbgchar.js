(() => {
  // why are the scanned keepers not showing? bodies in the open, numbers about their rigs
  const v = [];
  const info = (kind) => {
    const C0 = CHARS[kind]; if (!C0) return kind + ': none';
    const b = makeBody(kind, {}); scene.add(b.root); b.root.position.set(0, 0, 0); b.mixer.update(0.5); b.root.updateMatrixWorld(true);
    let sm = null; b.model.traverse((o) => { if (o.isSkinnedMesh) sm = o; });
    const box = new THREE.Box3(), vv = new THREE.Vector3(); const n = sm.geometry.attributes.position.count;
    for (let i = 0; i < n; i += 7) { sm.boneTransform(i, vv); vv.applyMatrix4(sm.matrixWorld); box.expandByPoint(vv); }
    const hp = new THREE.Vector3(); b.bones.Hips.getWorldPosition(hp); const hd = new THREE.Vector3(); b.bones.Head.getWorldPosition(hd);
    scene.remove(b.root);
    return { kind, scale: +C0.scale.toFixed(4), minY: +C0.minY.toFixed(3), flip: +C0.flip.toFixed(2), clips: C0.clips.map((c) => c.name), box: [box.min.toArray().map((x) => +x.toFixed(2)), box.max.toArray().map((x) => +x.toFixed(2))], hips: hp.toArray().map((x) => +x.toFixed(2)), head: hd.toArray().map((x) => +x.toFixed(2)), mat: sm.material.type, skinning: sm.material.skinning, bindMode: sm.bindMode, vis: sm.visible };
  };
  v.push(() => [info('soldier'), info('michelle'), info('casual'), info('blonde'), info('hunter')]);
  v.push(() => {
    const s = WORLD.data.spawn, p = __find((x, z) => classAt(x, z) === 0 && slopeAt(x, z) < 0.04 && forestAt(x, z) < 0.08 && terrainAt(x, z) > waterAt(x, z) + 3, 24, [s.x + 120, s.z + 60]);
    __go(p[0], p[1] - 6, { hour: 11, w: 'clear', yaw: 0, pitch: 0.05, dist: 2.5 });
    const out = [];
    ['soldier', 'casual', 'blonde', 'hunter', 'michelle'].forEach((k, i) => {
      const b = makeBody(k, {}); if (!b) { out.push(k + ' none'); return; }
      dressBody(b, KEEPER_OUTFIT.grocery);
      const x = p[0] + (i - 2) * 1.3, z = p[1]; b.root.position.set(x, groundAt(x, z, terrainAt(x, z) + 1), z); b.root.rotation.y = Math.PI; scene.add(b.root);
      for (const a of Object.values(b.act)) { a.stop(); a.enabled = true; } if (b.act.Idle) { b.act.Idle.play(); b.act.Idle.setEffectiveWeight(1); }
      b.mixer.update(0.3); window['__b' + i] = b; out.push(k);
    });
    window.__tick = () => { for (let i = 0; i < 5; i++) if (window['__b' + i]) window['__b' + i].mixer.update(0.016); };
    return ['line-up', out];
  });
  v.push(() => { const k = KEEPERS.find((q) => q.body.kind === 'casual'); if (!k) return 'no casual keeper'; const r = k.body.root; const wp = new THREE.Vector3(); r.getWorldPosition(wp); return { spot: k.spot && [k.spot.kx, k.spot.y, k.spot.kz], vis: r.visible, parent: !!r.parent, pos: wp.toArray().map((x) => +x.toFixed(1)), inner: k.body.inner.scale.x }; });
  window.__views = v; window.__vi = 0;
  return v.length;
})()
