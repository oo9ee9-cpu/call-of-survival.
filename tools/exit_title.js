(() => {
  // the lobby's «exit» back to the title: the film comes back with the name and «ادخل»; «ادخل» opens the lobby again
  const v = window.__views = []; window.__vi = 0; window.__next = () => { const f = v[window.__vi++]; if (!f) return 'end'; try { return f(); } catch (e) { return 'ERR ' + e.message; } };
  v.push(() => { exitToTitle(); return ['exit', $('intro').className]; });
  v.push(() => { const b = $('bootLoop'); return ['title', $('intro').className, !$('startBtn').hidden, b.currentSrc.split('/').pop(), b.paused, +b.currentTime.toFixed(1)]; });
  v.push(() => { $('startBtn').click(); return ['enter']; });
  v.push(() => ['lobby', LOBBY.on, $('intro').className]);
  return v.length;
})()
