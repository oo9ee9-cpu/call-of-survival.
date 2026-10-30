(() => {
  // run the keeper/hunter views, then the v13 views, in one session
  const a = window.__views.slice();
  return a.length;
})()
