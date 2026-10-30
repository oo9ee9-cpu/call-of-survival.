(() => {
  // second look at the lobby with css animations switched off (headless frames are too slow for them),
  // then the game itself: the contact shade under the survivor and a parked car
  const st = document.createElement('style');
  st.textContent = '*,*::before,*::after{animation:none!important;transition:none!important}';
  document.head.append(st);
  const errs = []; const oe = console.error; console.error = (...a) => { errs.push(String(a[0]).slice(0, 120)); oe.apply(console, a); };
  window.__errs = errs;
  const steps = [
    () => { ACCOUNT.gold = 1840; ACCOUNT.level = 7; ACCOUNT.xp = 430; lobbyRefresh(true); openSheet('store', 'featured'); LOBBY.preview = 'suit_desert'; lobbyDress(); renderSheet(); LOBBY.shift = 1; return 'store'; },
    () => { openSheet('workshop'); LOBBY.shift = 1; return 'workshop'; },
    () => { closeSheet(); LOBBY.shift = 0; openModal('topup'); return 'topup'; },
    () => { closeModal(); openSettings('gfx'); return 'settings'; },
    () => {
      closeSettings();
      const p = __find((x, z) => biomeAt(x, z) === 11 && slopeAt(x, z) < 0.05 && roadDist(x, z) > 25, 48, [-1500, -1500]);
      const r = __go(p[0], p[1], { hour: 13, w: 'clear', yaw: 0.5, pitch: 0.32, dist: 4.2 });
      const v = spawnVehicle('sedan', player.pos.x + 3.2, player.pos.z + 4.5, 0.4); v.owned = false;
      return ['blob', r, errs.length];
    },
    () => ['errors', errs.slice(0, 6)],
  ];
  let i = 0;
  window.__ls = () => { const f = steps[i++]; return f ? f() : 'end'; };
  return steps.length;
})()
