(() => {
  // the street and the fortress up close: are their meshes in the scene, where, and what the ground does under them
  const landAt = (kind) => LAND.list.find((L) => L.kind === kind);
  const info = (kind) => {
    const L = landAt(kind); if (!L) return kind + ' none';
    const D = L.def, out = { kind, x: Math.round(L.x), z: Math.round(L.z), y: +L.y.toFixed(2), s: +L.s.toFixed(2), rot: +L.rot.toFixed(2), R: Math.round(L.R), terr: +terrainAt(L.x, L.z).toFixed(2), top: +landTop(L.x, L.z).toFixed(2) };
    out.meshes = [0, 1, 2].map((k) => { const m = D['mesh' + k]; if (!m) return null; const e = new THREE.Matrix4(); if (m.count) m.getMatrixAt(0, e); const p = new THREE.Vector3().setFromMatrixPosition(e); return { count: m.count, vis: m.visible, inScene: !!m.parent, verts: m.geometry.attributes.position.count, img: !!(m.material.map && m.material.map.image), at: [Math.round(p.x), +p.y.toFixed(1), Math.round(p.z)], bs: m.geometry.boundingSphere && Math.round(m.geometry.boundingSphere.radius) }; });
    // the ground along the scan's long axis, every 8 m: terrain, scan floor, scan roof
    const prof = []; for (let t = -60; t <= 60; t += 12) { const x = L.x + Math.sin(L.rot) * t, z = L.z + Math.cos(L.rot) * t; prof.push([t, +terrainAt(x, z).toFixed(1), +landTop(x, z).toFixed(1), +landTop(x, z, 999).toFixed(1)]); }
    out.prof = prof; out.cam = [Math.round(camera.position.x), Math.round(camera.position.y), Math.round(camera.position.z)], out.far = Math.round(camera.far);
    return out;
  };
  const v = window.__views;
  const look = (kind, ang, dist, o = {}) => () => {
    const L = landAt(kind); if (!L) return [kind, 'none'];
    const a = ang + L.rot, x = L.x + Math.sin(a) * dist, z = L.z + Math.cos(a) * dist;
    __go(x, z, { hour: 15, w: 'clear', yaw: Math.atan2(L.x - x, L.z - z), pitch: o.pitch ?? 0.1, dist: o.cd || 3.4 });
    player.root.visible = false; camera.position.copy(cam.pos); camera.updateMatrixWorld();
    LAND.lastX = 1e9; updateLandforms();
    return [kind + '@' + Math.round(ang * 57.3) + '/' + dist, info(kind)];
  };
  v.push(look('street', 0, 90, { pitch: 0.35, cd: 6 }));
  v.push(look('street', Math.PI / 2, 60, { pitch: 0.3, cd: 6 }));
  v.push(look('fortress', 0, 260, { pitch: 0.25, cd: 6 }));
  v.push(look('fortress', Math.PI / 2, 220, { pitch: 0.2, cd: 6 }));
  return v.length;
})()
