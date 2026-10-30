(() => {
  __views.push(() => { const r = __go(-717, -3230, { hour: 10, w: 'clear', yaw: Math.PI }); setStrain(3); return ['strain3', r, JSON.stringify(STRAIN), camera.far]; });
  __views.push(() => ['after', JSON.stringify(STRAIN), camera.far, GRASS.mesh.material.uniforms.uR.value, window.__err || null]);
  __views.push(() => { setStrain(0); return ['back', camera.far]; });
  return __views.length;
})()
