/* ═════════ settings: graphics, controls (with your own keys), sound, interface, accessibility, play — one panel for the lobby and the pause ═════════ */
const KEY_ACTIONS = [
  ['fwd', 'تقدّم', 'KeyW'], ['back', 'تراجع', 'KeyS'], ['left', 'يسار', 'KeyA'], ['right', 'يمين', 'KeyD'], ['jump', 'قفز / فرامل', 'Space'], ['sprint', 'ركض', 'ShiftLeft'],
  ['use', 'ركوب ونزول واستخدام وفتح', 'KeyF'], ['bag', 'الحقيبة', 'Tab'], ['map', 'الخريطة', 'KeyM'], ['cam', 'كاميرا الجسد', 'KeyV'], ['reload', 'تعبئة / تدوير البناء', 'KeyR'],
  ['light', 'المصباح', 'KeyL'], ['eat', 'أكل أو شرب سريع أو ضماد', 'KeyH'], ['crouch', 'انحناء', 'KeyC'], ['prone', 'انبطاح', 'KeyZ'], ['leanL', 'ميلان لليسار', 'KeyQ'], ['leanR', 'ميلان لليمين', 'KeyE'],
  ['mode', 'نمط الإطلاق', 'KeyB'],
];
const KEY_DEF = Object.fromEntries(KEY_ACTIONS.map(([a, , c]) => [a, c]));
const keyOf = (a) => SET.keys[a] || KEY_DEF[a];
function actionOf(code) { for (const [a] of KEY_ACTIONS) if (keyOf(a) === code) return a; return null; }
const keyName = (c) => !c ? '—' : c === 'Space' ? 'مسافة' : c.startsWith('Key') ? c.slice(3) : c.startsWith('Digit') ? c.slice(5) : c === 'ShiftLeft' || c === 'ShiftRight' ? 'Shift' : c === 'ControlLeft' || c === 'ControlRight' ? 'Ctrl' : c === 'AltLeft' || c === 'AltRight' ? 'Alt' : c.replace('Arrow', '↑ ').replace('Numpad', 'Num ');

/* small helpers the rest of the game calls */
function buzz(ms) { if (!SET.vibrate || !navigator.vibrate) return; try { navigator.vibrate(ms); } catch (_) {} }
const _subs = new Map();
function subtitle(text, pan) {
  const box = $('subs'); if (!box || !started) return;
  const now = performance.now(), last = _subs.get(text); if (last && now - last.t < 1800) return;
  if (last && last.el.parentNode) last.el.remove();
  const el = document.createElement('span'); el.textContent = (pan > 0.35 ? '◀ ' : '') + '[' + text + ']' + (pan < -0.35 ? ' ▶' : '');
  box.append(el); _subs.set(text, { t: now, el }); while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => { if (el.parentNode) el.remove(); }, 2600);
}
function applyHudPrefs() {
  hud.classList.toggle('no-mini', !SET.hudMini); hud.classList.toggle('no-vitals', !SET.hudVitals); hud.classList.toggle('no-compass', !SET.hudCompass);
  hud.classList.toggle('no-kills', !SET.hudKills); hud.classList.toggle('no-res', !SET.hudRes); hud.classList.toggle('no-name', !SET.hudName);
  document.documentElement.style.setProperty('--ui', String(clamp(SET.uiScale, 0.75, 1.35)));
}
function applyAllSettings() {
  applyHudPrefs(); POST.setCB(SET.cb); AUDIO.setVolumes();
}

/* ── the panel ── */
let settingsOpen = false, setTab = 'gfx', keyWait = null;
const pctF = (v) => toAr(Math.round(v * 100)) + '٪';
const SET_TABS = [['gfx', 'الرسوم'], ['ctl', 'التحكم'], ['snd', 'الصوت'], ['ui', 'الواجهة'], ['acc', 'سهولة الوصول'], ['play', 'اللعب'], ['about', 'حول']];
const SET_SPEC = {
  gfx: [
    { head: 'الجودة' },
    { k: 'preset', label: 'الجودة العامة', note: 'تعيد تحميل الصفحة · رحلتك محفوظة', type: 'preset' },
    { k: 'fps', label: 'معدّل الإطارات', note: '٦٠ أنعم حركة · ٣٠ يوفّر البطارية ويبرّد الجهاز', type: 'seg', opts: [[30, '٣٠'], [45, '٤٥'], [60, '٦٠'], [90, '٩٠'], [120, '١٢٠'], [0, 'بلا حد']] },
    { k: 'rh', label: 'دقة الصورة', note: 'ارتفاع الصورة بالبكسل · تلقائي يختار حسب الجودة وشاشتك', type: 'seg', opts: [[0, 'تلقائي']].concat(RES_STEPS), fx: 'res' },
    { k: 'dynres', label: 'دقة تلقائية تحافظ على السلاسة', note: 'تخفض الدقة قليلاً (حتى ٧٥٪) فقط إن ثقلت اللعبة', type: 'toggle', fx: 'res' },
    { head: 'العالم' },
    { k: 'foliage', label: 'كثافة العشب والنبات', type: 'range', min: 0.4, max: 1.3, step: 0.05, fmt: pctF },
    { k: 'view', label: 'مدى الرؤية', type: 'range', min: 0.6, max: 1.3, step: 0.05, fmt: pctF },
    { k: 'fov', label: 'مجال الرؤية (FOV)', type: 'range', min: 50, max: 90, step: 1, fmt: (v) => toAr(v) + '°' },
    { head: 'الإضاءة والظلال' },
    { k: 'shadows', label: 'الظلال', note: 'تعيد تحميل الصفحة', type: 'seg', opts: [['auto', 'تلقائي'], ['off', 'بدون'], ['low', 'منخفضة'], ['mid', 'متوسطة'], ['high', 'عالية']], fx: 'reload' },
    { k: 'bloom', label: 'توهّج الأضواء', type: 'seg', opts: [['auto', 'تلقائي'], ['on', 'يعمل'], ['off', 'متوقف']], fx: 'post' },
    { k: 'rays', label: 'أشعة الشمس بين الأشجار', type: 'seg', opts: [['auto', 'تلقائي'], ['on', 'تعمل'], ['off', 'متوقفة']], fx: 'post' },
  ],
  ctl: [
    { head: 'الكاميرا والتصويب' },
    { k: 'sens', label: 'حساسية النظر', type: 'range', min: 0.3, max: 2.5, step: 0.05, fmt: (v) => '×' + toAr(v.toFixed(2)) },
    { k: 'aimSens', label: 'حساسية التصويب', type: 'range', min: 0.3, max: 2, step: 0.05, fmt: (v) => '×' + toAr(v.toFixed(2)) },
    { k: 'invertY', label: 'عكس المحور العمودي', type: 'toggle' },
    { head: 'الحركة' },
    { k: 'autoJump', label: 'تسلّق تلقائي', note: 'يقفز فوق الحواف والأسوار المنخفضة وأنت تمشي', type: 'toggle' },
    { k: 'vibrate', label: 'اهتزاز الهاتف عند الإصابة', type: 'toggle' },
    { head: 'أزرار لوحة المفاتيح', note: 'اضغط على زر ثم على المفتاح الجديد' },
    { type: 'keys' },
  ],
  snd: [
    { head: 'مستوى الصوت' },
    { k: 'vMaster', label: 'الصوت العام', type: 'range', min: 0, max: 1, step: 0.05, fmt: pctF, fx: 'vol' },
    { k: 'vMusic', label: 'الموسيقى', type: 'range', min: 0, max: 1, step: 0.05, fmt: pctF, fx: 'vol' },
    { k: 'vSfx', label: 'المؤثرات', note: 'الطلقات والأدوات والخطوات', type: 'range', min: 0, max: 1, step: 0.05, fmt: pctF, fx: 'vol' },
    { k: 'vAmb', label: 'الطبيعة والأجواء', note: 'البحر والريح والمطر والطيور', type: 'range', min: 0, max: 1, step: 0.05, fmt: pctF, fx: 'vol' },
    { k: 'vVoice', label: 'الحوار', note: 'كلام الناجين في الجزيرة', type: 'range', min: 0, max: 1, step: 0.05, fmt: pctF, fx: 'vol' },
    { k: 'vChat', label: 'الدردشة الصوتية', note: 'للعب مع الأصدقاء', type: 'range', min: 0, max: 1, step: 0.05, fmt: pctF },
    { head: 'المكان' },
    { k: 'spatial', label: 'صوت ثلاثي الأبعاد', note: 'تسمع من أين يأتي الزومبي والطلقات', type: 'toggle' },
  ],
  ui: [
    { head: 'ما يظهر على الشاشة' },
    { k: 'hudVitals', label: 'أشرطة الدم والطاقة والجوع والعطش', type: 'toggle', fx: 'hud' },
    { k: 'hudMini', label: 'الخريطة المصغّرة', type: 'toggle', fx: 'hud' }, { k: 'hudCompass', label: 'البوصلة والساعة', type: 'toggle', fx: 'hud' },
    { k: 'hudKills', label: 'عدّاد القتلى', type: 'toggle', fx: 'hud' }, { k: 'hudRes', label: 'الخشب والحجر', type: 'toggle', fx: 'hud' },
    { k: 'marks', label: 'علامات الطريق', note: 'أقرب مدينة وسيارتك وعلامة الكنز على البوصلة', type: 'toggle' },
    { k: 'uiScale', label: 'حجم الواجهة', type: 'range', min: 0.8, max: 1.3, step: 0.05, fmt: pctF, fx: 'hud' },
    { head: 'اللغة والنصوص' },
    { k: 'lang', label: 'اللغة', type: 'seg', opts: [['ar', 'العربية'], ['en', 'English · قريباً', true]] },
    { k: 'subs', label: 'ترجمة الأصوات', note: 'نص على الشاشة لصوت الزومبي والطلقات والرعد', type: 'toggle' },
  ],
  acc: [
    { head: 'الألوان' },
    { k: 'cb', label: 'وضع عمى الألوان', note: 'يعدّل الألوان لتفرّق بينها بسهولة', type: 'seg', opts: [['none', 'بدون'], ['protan', 'الأحمر'], ['deutan', 'الأخضر'], ['tritan', 'الأزرق']], fx: 'cb' },
    { head: 'الحركة' },
    { k: 'shake', label: 'اهتزاز الكاميرا', type: 'range', min: 0, max: 1, step: 0.05, fmt: pctF },
    { k: 'motion', label: 'تقليل الحركة', note: 'بلا تمايل للكاميرا ولا تكبير عند الركض', type: 'toggle' },
    { head: 'مساعدة' },
    { k: 'aimAssist', label: 'مساعدة التصويب', note: 'تميل الطلقة قليلاً نحو أقرب زومبي في مرمى البصر', type: 'toggle' },
  ],
  play: [
    { head: 'الوقت والطقس' },
    { type: 'night' }, { type: 'weather' },
  ],
  about: [{ type: 'about' }],
};
function openSettings(tab) {
  settingsOpen = true; if (tab) setTab = tab;
  $('settings').classList.remove('gone'); if (document.exitPointerLock && locked) document.exitPointerLock();
  renderSettings();
}
function closeSettings() { settingsOpen = false; keyWait = null; $('settings').classList.add('gone'); saveSettings(); }
$('setX').innerHTML = svg('close');
$('setX').addEventListener('click', closeSettings);
$('settings').addEventListener('click', (e) => { if (e.target.id === 'settings') closeSettings(); });
addEventListener('keydown', (e) => {
  if (!settingsOpen) return;
  if (keyWait) {
    e.preventDefault(); e.stopPropagation();
    if (e.code !== 'Escape') { for (const [a] of KEY_ACTIONS) if (a !== keyWait && keyOf(a) === e.code) SET.keys[a] = keyOf(keyWait); SET.keys[keyWait] = e.code; saveSettings(); }
    keyWait = null; renderSettings(); return;
  }
  if (e.code === 'Escape') { e.preventDefault(); closeSettings(); }
}, true);
function settingFx(fx) {
  saveSettings();
  if (fx === 'res') { if (!SET.dynres) DYNRES.scale = 1; renderer.setPixelRatio(renderRatio()); applyOrientation(); }
  else if (fx === 'post') { applyQualityOverrides(); POST.resize(); }
  else if (fx === 'vol') AUDIO.setVolumes();
  else if (fx === 'hud') applyHudPrefs();
  else if (fx === 'cb') POST.setCB(SET.cb);
}
function segEl(opts, cur, onPick) {
  const box = document.createElement('div'); box.className = 'seg';
  for (const [v, label, off] of opts) { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.setAttribute('aria-pressed', String(v === cur)); b.disabled = !!off; b.addEventListener('click', () => { onPick(v); AUDIO.ui(); }); box.append(b); }
  return box;
}
function srow(label, note, ctl) {
  const r = document.createElement('div'); r.className = 'srow';
  const l = document.createElement('div'); l.className = 'sl'; l.textContent = label; if (note) { const n = document.createElement('small'); n.textContent = note; l.append(n); }
  r.append(l); if (ctl) r.append(...[].concat(ctl)); return r;
}
function renderSettings() {
  const tabs = $('setTabs'), body = $('setBody');
  tabs.innerHTML = '';
  for (const [k, label] of SET_TABS) { const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'tab'); b.textContent = label; b.setAttribute('aria-selected', String(k === setTab)); b.addEventListener('click', () => { setTab = k; keyWait = null; renderSettings(); }); tabs.append(b); }
  body.innerHTML = '';
  for (const it of SET_SPEC[setTab]) {
    if (it.head) { const h = document.createElement('div'); h.className = 'shead'; h.textContent = it.head; body.append(h); if (it.note) body.append(Object.assign(document.createElement('p'), { className: 'lb-note', textContent: it.note })); continue; }
    if (it.type === 'preset') {
      body.append(srow(it.label, it.note, segEl([['low', 'خفيفة'], ['mid', 'متوسطة'], ['high', 'عالية'], ['ultra', 'فائقة']], QUALITY.level, (q) => setQuality(q))));
    } else if (it.type === 'seg') {
      body.append(srow(it.label, it.note, segEl(it.opts, SET[it.k], (v) => { SET[it.k] = v; if (it.fx === 'reload') { saveSettings(); renderSettings(); reloadNote(); return; } settingFx(it.fx); renderSettings(); })));
    } else if (it.type === 'range') {
      const inp = document.createElement('input'); inp.type = 'range'; inp.min = it.min; inp.max = it.max; inp.step = it.step; inp.value = SET[it.k]; inp.setAttribute('aria-label', it.label);
      const out = document.createElement('output'); out.textContent = it.fmt ? it.fmt(SET[it.k]) : SET[it.k];
      inp.addEventListener('input', () => { SET[it.k] = +inp.value; out.textContent = it.fmt ? it.fmt(SET[it.k]) : SET[it.k]; settingFx(it.fx); });
      body.append(srow(it.label, it.note, [inp, out]));
    } else if (it.type === 'toggle') {
      const t = document.createElement('button'); t.type = 'button'; t.className = 'tgl'; t.setAttribute('role', 'switch'); t.setAttribute('aria-checked', String(!!SET[it.k])); t.setAttribute('aria-label', it.label);
      t.addEventListener('click', () => { SET[it.k] = !SET[it.k]; t.setAttribute('aria-checked', String(SET[it.k])); settingFx(it.fx); AUDIO.ui(SET[it.k] ? 1 : 0); });
      body.append(srow(it.label, it.note, t));
    } else if (it.type === 'keys') {
      for (const [a, label] of KEY_ACTIONS) {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'keyb' + (keyWait === a ? ' wait' : ''); b.textContent = keyWait === a ? 'اضغط مفتاحاً…' : keyName(keyOf(a));
        b.addEventListener('click', () => { keyWait = keyWait === a ? null : a; renderSettings(); });
        body.append(srow(label, null, b));
      }
      const rs = document.createElement('button'); rs.type = 'button'; rs.className = 'ghost'; rs.textContent = 'إعادة الأزرار الأصلية'; rs.addEventListener('click', () => { SET.keys = {}; saveSettings(); renderSettings(); });
      body.append(srow('الأزرار ١–٦ للأدوات و Esc للإيقاف ثابتة', null, rs));
    } else if (it.type === 'night') {
      body.append(srow('الليل', 'ليل قصير يأتي بالزومبي، أو نهار دائم', segEl([['short', 'ليل قصير'], ['off', 'نهار دائم']], ENV.nightMode, (m) => { setNightMode(m); renderSettings(); })));
    } else if (it.type === 'weather') {
      body.append(srow('الطقس', null, segEl([['auto', 'متقلّب ومطر'], ['clear', 'صحو دائماً'], ['rain', 'مطر الآن']], ENV.weatherMode, (m) => { setWeatherMode(m); renderSettings(); })));
    } else if (it.type === 'about') {
      const p = (t, c = 'lb-note') => body.append(Object.assign(document.createElement('p'), { className: c, textContent: t }));
      const h = document.createElement('div'); h.className = 'shead'; h.textContent = 'Call of Survival'; body.append(h);
      p('© 2026 Call of Survival — جميع الحقوق محفوظة. الإصدار ٦٫٠');
      p('فيلم البداية وموسيقى اللعبة صُنعا لها خصيصاً: الكوكب ولقطة السقوط والممرّ الضوئي من محرك اللعبة نفسه، والموسيقى الفضائية ونغمة العنوان مؤلفة لها، وكلها ملك اللعبة.');
      p('حسابك: ' + ACCOUNT.name + ' · ID ' + ACCOUNT.id + ' · يُحفظ في سجلك الخاص وعلى هذا الجهاز.');
      const h2 = document.createElement('div'); h2.className = 'shead'; h2.textContent = 'المصادر المفتوحة'; body.append(h2);
      p(CREDITS);
      const h4 = document.createElement('div'); h4.className = 'shead'; h4.textContent = 'نماذج من Sketchfab أرسلها صاحب اللعبة'; body.append(h4);
      const ul = document.createElement('ul'); ul.className = 'lb-note credits-sf';
      for (const [title, who, url, what] of CREDITS_SF) {
        const li = document.createElement('li'), a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = '«' + title + '»';
        li.append(what + ': ', a, ' — ' + who); ul.append(li);
      }
      body.append(ul);
      p('تحت رخصة CC-BY 4.0 (creativecommons.org/licenses/by/4.0) ما لم يُذكر غيرها بجانب النموذج: CC-BY-NC 4.0 للاستعمال غير التجاري، أو رخصة Sketchfab القياسية. اللعبة مجانية بلا شراء بالمال الحقيقي. عُدّلت كلها للعبة: بُسّطت وأعيد ترتيب أنسجتها ولُوّنت من جديد، وأُلبست الشخصيات هيكلاً متحركاً.');
      const h3 = document.createElement('div'); h3.className = 'shead'; h3.textContent = 'الحساب'; body.append(h3);
      const rb = document.createElement('button'); rb.type = 'button'; rb.className = 'ghost'; rb.textContent = 'مسح الحساب والبدء من الصفر';
      let arm = 0; rb.addEventListener('click', () => { if (performance.now() - arm > 3000) { arm = performance.now(); rb.textContent = 'اضغط مرة ثانية: يمسح المستوى والذهب والملابس'; return; } resetAccount(); });
      body.append(srow('يمسح المستوى والذهب والجواهر والملابس والترقيات', null, rb));
    }
  }
}
function reloadNote() {
  const body = $('setBody'), b = document.createElement('button'); b.type = 'button'; b.className = 'cta'; b.textContent = 'أعد التحميل الآن';
  b.addEventListener('click', () => { if (started) saveNow(); accFlush(); setTimeout(() => location.reload(), 150); });
  body.prepend(srow('تُطبَّق الظلال بعد إعادة التحميل', 'رحلتك محفوظة', b));
}
function resetAccount() {
  const keep = { id: ACCOUNT.id };
  const fresh = newAccount(); fresh.id = keep.id;
  for (const k of Object.keys(ACCOUNT)) delete ACCOUNT[k];
  Object.assign(ACCOUNT, fresh); rollMissions(); accSoon(true); accFlush();
  syncLookToRun(); applyOutfit(); closeSettings(); if (typeof lobbyRefresh === 'function') lobbyRefresh(true);
}
