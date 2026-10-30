(() => {
  // the fixes after the first in-game pass: the crate page's art, the scope under the controls, the camera under the parachute,
  // the ground under the cathedral (no cones round its towers), the fortress and the street where they now stand
  const st0 = document.createElement('style');
  st0.textContent = '*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition:none!important}';
  document.head.append(st0);
  const errs = []; const oe = console.error; console.error = (...a) => { errs.push(String(a[0]).slice(0, 160)); oe.apply(console, a); };
  window.addEventListener('error', (e) => errs.push('ERR ' + String(e.message).slice(0, 200)));
  const give = (id, n = 1) => { invAdd(id, n, true); };
  const landAt = (kind, i = 0) => LAND.list.filter((L) => L.kind === kind)[i];
  const v = __views;
  v.push(() => {
    if (!LOBBY.on) enterLobby(true);
    const fr = $('firstRun'); if (fr) { $('frName').value = 'سارة'; $('frGo').click(); }
    ACCOUNT.crates = { classic: 3, premium: 1 }; lobbyRefresh(true); openSheet('crates', 'premium');
    const art = document.querySelector('#lobby .cr-hero .cr-art');
    return ['crates', !!art, art && art.querySelectorAll('i').length, errs.slice(-2)];
  });
  v.push(() => {
    closeSheet();
    const p = __find((x, z) => biomeAt(x, z) === 11 && slopeAt(x, z) < 0.05 && roadDist(x, z) > 25 && forestAt(x, z) < 0.05, 48, [400, 300]);
    const r = __go(p[0], p[1], { hour: 10, w: 'clear', yaw: 0.6, pitch: 0.05, dist: 3.4 });
    hud.classList.add('on'); give('gun_akm'); give('ammo762', 90); give('att_4x'); assignSlot(1, 'gun_akm'); equip('gun_akm');
    for (let i = 0; i < 20; i++) updatePlayer(0.05, T + i * 0.05);
    attachTo('gun_akm', 'att_4x'); setScope(true); for (let i = 0; i < 15; i++) { updatePlayer(0.05, T + i * 0.05); updateCamera(0.05, false); }
    return ['scope', r, SCOPE.on, errs.slice(-2)];
  });
  v.push(() => { setScope(false); boardPlane(); for (let i = 0; i < 30; i++) { updateDrop(0.05); updateCamera(0.05, false); } jumpOut(); for (let i = 0; i < 60; i++) { updateDrop(0.05); updateSkydive(0.05); updateCamera(0.05, false); } DROP.t = 4; openChute(); for (let i = 0; i < 60; i++) { updateDrop(0.05); updateSkydive(0.05); updateCamera(0.05, false); } return ['chute', DROP.state, Math.round(DROP.camD || 0), errs.slice(-2)]; });
  v.push(() => { let k = 0; while (DROP.state && k++ < 4000) updateSkydive(0.05); updateCamera(0.05, true); return ['landed', k]; });
  const look = (kind, ang, dist, o = {}) => () => {
    const L = landAt(kind, o.i || 0); if (!L) return [kind, 'none', LAND.list.map((q) => q.kind)];
    const a = ang + L.rot, x = L.x + Math.sin(a) * dist, z = L.z + Math.cos(a) * dist;
    const r = __go(x, z, { hour: o.hour || 15, w: 'clear', yaw: Math.atan2(L.x - x, L.z - z), pitch: o.pitch ?? 0.1, dist: o.cd || 3.4 });
    player.root.visible = !o.hide;
    LAND.lastX = 1e9; updateLandforms();
    return [kind + '@' + Math.round(ang * 57.3) + '/' + Math.round(dist), r, Math.round(L.x), Math.round(L.z), zoneAt(x, z).name, errs.slice(-2)];
  };
  v.push(look('cathedral', 0, 75, { pitch: 0.08, hide: true }));
  v.push(look('cathedral', Math.PI * 0.6, 50, { pitch: 0.05, hide: true }));
  v.push(look('fortress', 0, 150, { pitch: 0.12, hide: true, hour: 16 }));
  v.push(look('fortress', Math.PI, 110, { pitch: 0.1, hide: true, hour: 16 }));
  v.push(look('street', 0, 0, { pitch: 0.05 }));
  v.push(look('street', Math.PI * 0.5, 70, { pitch: 0.1, hide: true }));
  v.push(() => ['errors', errs.slice(0, 12), LAND.list.map((q) => q.kind + '@' + Math.round(q.x) + ',' + Math.round(q.z))]);
  return v.length;
})()
