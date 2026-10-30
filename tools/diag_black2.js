(() => {
  const nan = () => { const bad = []; const chk = (n, v) => { if (typeof v === 'number' && !isFinite(v)) bad.push(n); }; for (const [k, v] of Object.entries(ENV)) { if (typeof v === 'number') chk('ENV.' + k, v); else if (v && v.isVector3) { chk('ENV.' + k + '.x', v.x); chk('ENV.' + k + '.y', v.y); } } for (const [k, v] of Object.entries(WEATHER)) chk('W.' + k, v); chk('cam.x', camera.position.x); chk('sun.int', sun.intensity); chk('hemi.int', hemi.intensity); return bad; };
  window.__nan = nan;
  const L = __views.length; const wrap = [];
  for (let i = 0; i < L; i++) { const f = __views[i]; wrap.push(() => { const r = f(); return [r, 'post', JSON.stringify(POST.dbg), 'nan', nan()]; }); }
  __views.length = 0; __views.push(...wrap);
  __views.push(() => ['final', JSON.stringify(POST.dbg), nan(), camera.position.toArray()]);
  return __views.length;
})()
