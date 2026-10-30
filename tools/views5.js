(() => {
  window.__hold = null; UPDATERS.push(() => { if (window.__hold) window.__hold(); });
  const front = (dist = 2.2, pitch = 0.05) => { window.__hold = () => { cam.yaw = cam.tyaw = player.yaw; cam.pitch = cam.tpitch = pitch; cam.user = dist; }; };
  const spot = () => __find((x, z) => biomeAt(x, z) === 6 && classAt(x, z) === 0 && slopeAt(x, z) < 0.08, 32, [-1800, -1500]);
  __views.push(() => { const p = spot(); const r = __go(p[0], p[1], { hour: 11, w: 'clear', yaw: 0 }); front(); return ['outfit-default', r]; });
  __views.push(() => { for (const id of ['top_shirt_red', 'pants_jeans_blue', 'shoes_sneakers_white', 'cap_black', 'sunglasses_black']) { invAdd(id, 1, true); wearItem(id); } front(); return ['outfit-casual', INV.wearing]; });
  __views.push(() => { for (const id of ['top_military_desert', 'pants_military_desert', 'helmet_kevlar', 'vest_kevlar', 'bigpack_olive']) { invAdd(id, 1, true); wearItem(id); } window.__hold = () => { cam.yaw = cam.tyaw = player.yaw + 2.4; cam.pitch = cam.tpitch = 0.1; cam.user = 2.4; }; return ['outfit-military', INV.wearing]; });
  __views.push(() => { INV.wearing = {}; invAdd('outfit_michelle', 1, true); wearItem('outfit_michelle'); invAdd('top_hoodie_pink', 1, true); wearItem('top_hoodie_pink'); front(2.4); return ['michelle', player.outfit && player.outfit.body]; });
  __views.push(() => { const p = spot(); const r = __go(p[0] + 30, p[1], { hour: 16.5, w: 'rain', yaw: 0 }); window.__hold = () => { cam.yaw = cam.tyaw = player.yaw + Math.PI; cam.pitch = cam.tpitch = 0.12; cam.user = 3.4; }; return ['rain-farm', r]; });
  return __views.length;
})()
