(() => {
  // the landmarks on the map: the list in the map's panel, a tap on one, «انتقال» to it, the compass and minimap afterwards
  const errs = []; const oe = console.error; console.error = (...a) => { errs.push(String(a[0]).slice(0, 160)); oe.apply(console, a); };
  window.addEventListener('error', (e) => errs.push('ERR ' + String(e.message).slice(0, 200)));
  const v = window.__views;
  v.push(() => {
    const p = __find((x, z) => biomeAt(x, z) === 11 && slopeAt(x, z) < 0.05 && roadDist(x, z) > 25, 48, [0, 0]);
    __go(p[0], p[1], { hour: 11, w: 'clear', yaw: 0.6 }); hud.classList.add('on');
    toggleChart(true);
    return ['chart', [...document.querySelectorAll('#chartLands button')].map((b) => b.textContent), errs.slice(-2)];
  });
  v.push(() => { const b = document.querySelectorAll('#chartLands button')[1]; b.click(); return ['picked', b.textContent, CHART.pick && [Math.round(CHART.pick.x), Math.round(CHART.pick.z)], $('chartPick') && !$('chartPick').hidden, errs.slice(-2)]; });
  v.push(() => { $('cpGo').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); for (let i = 0; i < 10; i++) { updatePlayer(0.05, T + i * 0.05); updateCamera(0.05, false); } LAND.lastX = 1e9; updateLandforms(); return ['went', [Math.round(player.pos.x), Math.round(player.pos.y), Math.round(player.pos.z)], zoneAt(player.pos.x, player.pos.z).name, errs.slice(-2)]; });
  v.push(() => ['errors', errs.slice(0, 8)]);
  return v.length;
})()
