(() => {
  // a tour of the lobby for screenshots: one step per call of __ls()
  const steps = [
    () => { ACCOUNT.gold = 1840; ACCOUNT.level = 7; ACCOUNT.xp = 430; ACCOUNT.life.kills = 312; ACCOUNT.life.wood = 900; ACCOUNT.life.felled = 40; lobbyRefresh(true); return 'main'; },
    () => { openSheet('store', 'featured'); LOBBY.preview = 'suit_desert'; lobbyDress(); renderSheet(); return 'store'; },
    () => { closeSheet(); openSheet('wardrobe', 'top'); return 'wardrobe'; },
    () => { openSheet('missions', 'daily'); return 'missions'; },
    () => { openSheet('workshop'); return 'workshop'; },
    () => { closeSheet(); openModal('topup'); return 'topup'; },
    () => { closeModal(); openModal('map'); return 'map'; },
    () => { closeModal(); openSettings('gfx'); return 'settings'; },
    () => { setTab = 'acc'; renderSettings(); return 'settings2'; },
  ];
  let i = 0;
  window.__ls = () => { const f = steps[i++]; return f ? f() : 'end'; };
  return steps.length;
})()
