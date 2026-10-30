(() => {
  // the new lobby: first visit, the hall backdrop, crates and their opening, missions, titles, weapon upgrades, the wardrobe,
  // clans, the store's deals, the museum and the island backdrops. CSS animations off (headless frames are too slow for them)
  const st = document.createElement('style');
  st.textContent = '*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition:none!important}';
  document.head.append(st);
  const errs = []; const oe = console.error; console.error = (...a) => { errs.push(String(a[0]).slice(0, 160)); oe.apply(console, a); };
  window.addEventListener('error', (e) => errs.push('ERR ' + String(e.message).slice(0, 160)));
  window.__errs = errs;
  const info = () => ({ room: typeof ROOM !== 'undefined' ? ROOM.active : '?', bg: SET.lobbyBg, sheet: LOBBY.sheet, errs: errs.slice(-4) });
  const steps = [
    () => { if (!LOBBY.on) enterLobby(true); return ['first-run', !!$('firstRun'), info()]; },
    () => { const i = $('frName'); if (i) { i.value = 'سارة'; $('frGo').click(); } ACCOUNT.gold = 25000; ACCOUNT.gems = 900; ACCOUNT.level = 12; ACCOUNT.crates = { classic: 3, premium: 1 }; ACCOUNT.shards = 7; ACCOUNT.mat = 140; lobbyRefresh(true); return ['lobby', ACCOUNT.name, info()]; },
    () => { openSheet('crates', 'premium'); return ['crates', info()]; },
    () => { closeSheet(); crateOpenUI('classic', 1); return ['open-classic', info()]; },
    () => { const ov = $('crateOpen'); if (ov) { ov.hidden = true; ov.innerHTML = ''; } crateOpenUI('premium', 10); return ['open-ten', info()]; },
    () => { const ov = $('crateOpen'); if (ov) { ov.hidden = true; ov.innerHTML = ''; } openSheet('missions', 'daily'); return ['missions', info()]; },
    () => { openSheet('titles', 'all'); return ['titles', info()]; },
    () => { ACCOUNT.wskins.akm_dragon = 3; ACCOUNT.wskinOn.akm = 'akm_dragon'; openSheet('upgrade', 'akm_dragon'); return ['upgrade', info()]; },
    () => { openSheet('wardrobe', 'suit'); return ['wardrobe', info()]; },
    () => { openSheet('clan'); return ['clan', info()]; },
    () => { openSheet('store', 'deals'); return ['store-deals', info()]; },
    () => { closeSheet(); SET.lobbyBg = 'museum'; lobbyBackdrop(true); return ['museum', info()]; },
    () => ['museum2', info()],
    () => { SET.lobbyBg = 'island'; lobbyBackdrop(true); return ['island', info()]; },
    () => { SET.lobbyBg = 'hall'; lobbyBackdrop(true); return ['hall-again', info()]; },
    () => ['errors', errs.slice(0, 12)],
  ];
  let i = 0;
  window.__ls = () => { const f = steps[i++]; try { return f ? f() : 'end'; } catch (e) { return 'ERR ' + e.message; } };
  return steps.length;
})()
