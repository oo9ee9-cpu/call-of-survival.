/* ═════════ مكتبات الإنترنت (46): free models and ground materials from ambientCG, Poly Haven and Sketchfab, browsed inside
   the editor (their own APIs: search, pictures, the files at the size you choose, nothing made smaller), downloaded once and
   kept with the game or on this device like your own uploads, so they work offline. free3d (and any other site) opens in
   the app's own browser: what you download there arrives in the editor. In the Android app the requests go through the
   app (no site can refuse a page that is not its own); in a browser tab only sites that allow it answer ═════════ */
const LIB_SITES = [
  ['acg', 'ambientCG', 'mat', 'خامات أرض وجدران · CC0 مجانية لأي استعمال'],
  ['phm', 'Poly Haven', 'mat', 'خامات بدقة حتى 8K · CC0 · Powered by Poly Haven'],
  ['phmod', 'Poly Haven', 'model', 'نماذج مجانية CC0 · Powered by Poly Haven'],
  ['sf', 'Sketchfab', 'model', 'نماذج قابلة للتنزيل · تحتاج رمز حسابك (API token) · لكل نموذج رخصته'],
  ['f3d', 'free3d', 'model', 'لا واجهة برمجية: يُفتح الموقع في متصفح اللعبة، وما تنزّله منه يُضاف هنا'],
];
const LIB = { on: false, site: 'acg', q: '', items: [], next: null, busy: false, app: null, ph: {}, gen: 0, sel: null, pend: [] };
const LIB_UA_NOTE = 'Powered by Poly Haven';

/* ── the network: the app's own pass-through when there is one, the page's fetch otherwise ── */
async function libApp() {
  if (LIB.app !== null) return LIB.app;
  try { const r = await withTimeout(fetch('/_app/info', { cache: 'no-store' }), 2500); const j = r && r.ok && /json/.test(r.headers.get('content-type') || '') ? await r.json() : null; LIB.app = j && j.app ? j : false; }
  catch (_) { LIB.app = false; }
  return LIB.app;
}
async function libFetch(url, opt) {
  opt = opt || {};
  const app = await libApp(), h = {};
  if (opt.auth) h[app && app.net ? 'X-Cos-Auth' : 'Authorization'] = opt.auth;
  let r;
  try { r = await fetch(app && app.net ? '/_net/get?u=' + encodeURIComponent(url) : url, { headers: h, cache: 'no-store' }); }
  catch (_) { throw upErr(app && app.net ? 'لا اتصال بالإنترنت' : 'الموقع لا يسمح بالتحميل من صفحة اللعبة هنا · يعمل في تطبيق أندرويد (النسخة الجديدة)'); }
  if (!r.ok) throw Object.assign(upErr(r.status === 401 ? 'الرمز غير صحيح أو انتهى' : r.status === 403 ? 'رفض الموقع الطلب (' + r.status + ')' : r.status === 404 ? 'غير موجود (404)' : 'خطأ من الموقع (' + r.status + ')'), { status: r.status });
  return r;
}
const libJSON = async (url, opt) => (await libFetch(url, opt)).json();
async function libBlob(url, opt, onp, size) {
  const r = await libFetch(url, opt), total = +r.headers.get('x-cos-size') || +r.headers.get('content-length') || size || 0;
  if (!r.body || !r.body.getReader) return r.blob();
  const rd = r.body.getReader(), parts = []; let got = 0, t = 0;
  for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); got += value.length; const now = performance.now(); if (onp && now - t > 150) { t = now; onp(got, total); } }
  return new Blob(parts, { type: r.headers.get('content-type') || '' });
}
// every web address inside a piece of JSON (for answers whose shape a site may change)
function libUrls(v, out = []) {
  if (typeof v === 'string') { if (/^https?:\/\//.test(v)) out.push(v); }
  else if (Array.isArray(v)) for (const x of v) libUrls(x, out);
  else if (v && typeof v === 'object') for (const k of Object.keys(v)) libUrls(v[k], out);
  return out;
}
function libImg(v, want) {
  const L = libUrls(v).filter((u) => /\.(png|jpe?g|webp)(\?|$)/i.test(u) || /thumb|preview|image/i.test(u));
  if (!L.length) return '';
  const size = (u) => { const m = u.match(/(\d{2,4})(?:[-_x]|\.)/); return m ? +m[1] : 512; };
  L.sort((a, b) => Math.abs(size(a) - want) - Math.abs(size(b) - want));
  return L[0];
}
const libMB = (n) => (n ? (n >= 1e9 ? toAr((n / 1e9).toFixed(1)) + ' غ.ب' : toAr(Math.max(0.1, n / 1e6).toFixed(n < 1e7 ? 1 : 0)) + ' م.ب') : '');

/* ── the sites ── */
const LIB_SRC = {
  // ambientCG (API v3): the list with pictures; the files are zips by size and format, ID_2K-JPG.zip
  acg: {
    async list(q, page) {
      const off = page * 30;
      const js = await libJSON('https://ambientcg.com/api/v3/assets?type=material&sort=popular&limit=30&offset=' + off + '&include=title,thumbnails,previews,downloads,dimensions' + (q ? '&q=' + encodeURIComponent(q) : ''));
      const arr = js.assets || js.foundAssets || [];
      const items = arr.map((a) => {
        const id = a.id || a.assetId; if (!id) return null;
        const dl = libUrls(a.downloads || a.downloadFolders || {}).filter((u) => /\.zip|get\?file=/i.test(u));
        const res = [...new Set(dl.map((u) => (u.match(/_(\d+)K-(JPG|PNG)/i) || [])[1]).filter(Boolean).map(Number))].sort((x, y) => x - y);
        return { id, name: a.title || a.displayName || id, th: libImg(a.thumbnails || a.previews || a.previewImage || a, 256), res: res.length ? res : [1, 2, 4, 8], dl, by: 'ambientCG', lic: 'CC0', page: 'https://ambientcg.com/view?id=' + encodeURIComponent(id), dim: a.dimensions };
      }).filter(Boolean);
      // pictures missing from the new API's answer: the older one gives them by id
      if (items.length && !items.some((it) => it.th)) {
        try {
          const v2 = await libJSON('https://ambientcg.com/api/v2/full_json?type=Material&include=previewData&id=' + items.map((it) => encodeURIComponent(it.id)).join(','));
          const by = new Map((v2.foundAssets || []).map((a) => [a.assetId, libImg(a.previewImage || a, 256)]));
          for (const it of items) it.th = by.get(it.id) || '';
        } catch (e) { console.warn('ambientCG pictures', e); }
      }
      return { items, more: !!js.nextPageHttp || arr.length === 30 };
    },
    async get(it, res, onp) {
      const url = it.dl.find((u) => new RegExp('_' + res + 'K-JPG', 'i').test(u)) || it.dl.find((u) => new RegExp('_' + res + 'K-PNG', 'i').test(u)) || 'https://ambientcg.com/get?file=' + encodeURIComponent(it.id) + '_' + res + 'K-JPG.zip';
      const blob = await libBlob(url, null, onp);
      const f = new File([blob], it.id + '_' + res + 'K.zip');
      const G = (await gmGroups([f]))[0]; if (!G) throw upErr('لم أجد صور الخامة داخل الملف');
      G.name = it.name; const d = it.dim, m = d && (d.x || d.width || (Array.isArray(d) && d[0])); if (m) G.m = m > 20 ? m / 100 : m;
      return { mat: G };
    },
  },
  // Poly Haven: every texture (or model) in one answer, searched here; the files by map and size
  phm: { type: 'textures' }, phmod: { type: 'models' },
  // Sketchfab: downloadable models; the download needs the owner's API token
  sf: {
    async list(q, page, cur) {
      const url = cur || 'https://api.sketchfab.com/v3/search?type=models&downloadable=true&count=24&sort_by=-likeCount' + (q ? '&q=' + encodeURIComponent(q) : '');
      const js = await libJSON(url);
      const items = (js.results || []).filter((m) => m && m.uid && !m.isAgeRestricted).map((m) => ({
        id: m.uid, name: m.name || m.uid, th: m.thumbnails && m.thumbnails.images ? (m.thumbnails.images.slice().sort((a, b) => Math.abs(a.width - 360) - Math.abs(b.width - 360))[0] || {}).url : '',
        by: (m.user && (m.user.displayName || m.user.username)) || '', lic: (m.license && (m.license.label || m.license.slug)) || '', page: m.viewerUrl || 'https://sketchfab.com/3d-models/' + m.uid,
        faces: m.faceCount || 0, size: m.archives && m.archives.glb ? m.archives.glb.size : m.archives && m.archives.gltf ? m.archives.gltf.size : 0,
      }));
      return { items, more: !!js.next, cur: js.next || null };
    },
    async info(it) {
      try { const m = await libJSON('https://api.sketchfab.com/v3/models/' + it.id); if (m.license) it.lic = m.license.label || it.lic; if (m.user) it.by = m.user.displayName || m.user.username || it.by; if (m.archives) it.size = (m.archives.glb || m.archives.gltf || {}).size || it.size; } catch (_) {}
    },
    async get(it, res, onp) {
      const tok = (SET.sfTok || '').trim(); if (!tok) throw upErr('أدخل رمز حسابك في Sketchfab أولاً (API token)');
      const d = await libJSON('https://api.sketchfab.com/v3/models/' + it.id + '/download', { auth: 'Token ' + tok });
      const a = d.glb || d.gltf; if (!a || !a.url) throw upErr('هذا النموذج لا يُنزَّل بصيغة glTF');
      const blob = await libBlob(a.url, null, onp, a.size);
      return { files: [new File([blob], it.id + (d.glb ? '.glb' : '.zip'))] };
    },
  },
};
for (const k of ['phm', 'phmod']) Object.assign(LIB_SRC[k], {
  async all() {
    const t = this.type; if (LIB.ph[t]) return LIB.ph[t];
    const js = await libJSON('https://api.polyhaven.com/assets?t=' + t);
    const list = Object.entries(js).map(([id, a]) => ({ id, name: a.name || id, th: a.thumbnail_url || 'https://cdn.polyhaven.com/asset_img/thumbs/' + id + '.png?width=256&height=256', tags: [].concat(a.tags || [], a.categories || []).join(' ').toLowerCase(), n: a.download_count || 0, dim: a.dimensions, max: a.max_resolution, by: Object.keys(a.authors || {}).join('، '), lic: 'CC0', page: 'https://polyhaven.com/a/' + id }));
    list.sort((a, b) => b.n - a.n);
    return (LIB.ph[t] = list);
  },
  async list(q, page) {
    const all = await this.all(), w = q.trim().toLowerCase(), L = w ? all.filter((it) => it.name.toLowerCase().includes(w) || it.tags.includes(w) || it.id.includes(w)) : all;
    return { items: L.slice(page * 30, page * 30 + 30), more: L.length > page * 30 + 30 };
  },
  async info(it) {
    const js = await libJSON('https://api.polyhaven.com/files/' + it.id); it.files = js;
    const src = this.type === 'models' ? js.gltf : js.Diffuse || js.diffuse || js.Color;
    it.res = src ? Object.keys(src).map((r) => parseInt(r, 10)).filter((n) => n > 0).sort((a, b) => a - b) : [1, 2, 4];
  },
  async get(it, res, onp) {
    const js = it.files || (await libJSON('https://api.polyhaven.com/files/' + it.id)), rk = res + 'k';
    if (this.type === 'models') {
      const g = js.gltf && (js.gltf[rk] || js.gltf[Object.keys(js.gltf)[0]]), f = g && g.gltf; if (!f || !f.url) throw upErr('لا ملف glTF لهذا النموذج');
      const inc = Object.entries(f.include || {}), total = (f.size || 0) + inc.reduce((a, [, v]) => a + (v.size || 0), 0); let base = 0;
      const files = new Map(), step = (n) => (got) => onp && onp(base + got, total || n);
      const main = await libBlob(f.url, null, step(f.size)); base += main.size;
      for (const [p, v] of inc) { const b = await libBlob(v.url, null, step(v.size)); base += b.size; b.path = p; files.set(p.toLowerCase(), b); }
      return { group: { name: upClean(it.name), main, ext: 'gltf', base: '', files } };
    }
    const pick = (keys) => { for (const k of keys) { const m = js[k], q = m && (m[rk] || null); const f = q && (q.jpg || q.png); if (f && f.url) return f; } return null; };
    const want = { a: pick(['Diffuse', 'diffuse', 'Color']), nm: pick(['nor_gl', 'Normal', 'normal']), r: pick(['Rough', 'rough', 'Roughness']), ao: pick(['AO', 'ao']), h: pick(['Displacement', 'Disp', 'disp']) };
    if (!want.a) throw upErr('لا صورة لون بهذه الدقة');
    const keys = Object.keys(want).filter((k) => want[k]), total = keys.reduce((a, k) => a + (want[k].size || 0), 0); let base = 0;
    const maps = {};
    for (const k of keys) { const b = await libBlob(want[k].url, null, (got) => onp && onp(base + got, total)); base += b.size; maps[k] = b; }
    const d = it.dim; return { mat: { name: it.name, maps, m: Array.isArray(d) && d[0] ? clamp(d[0] / 1000, 0.3, 30) : 2 } };
  },
});

/* ── the screen ── */
function libEl() {
  let el = $('lib'); if (el) return el;
  el = document.createElement('div'); el.id = 'lib'; el.className = 'gone';
  el.innerHTML = `<div class="libsheet" role="dialog" aria-label="مكتبات الإنترنت">
    <header><h3>مكتبات الإنترنت</h3><input id="libQ" type="search" placeholder="ابحث بالإنجليزية: rock, grass, car…" autocomplete="off"><button id="libX" class="edb ic" type="button" aria-label="إغلاق">${edSvg('close')}</button></header>
    <nav id="libSites"></nav><div id="libNote"></div><div id="libGrid"></div></div>
    <div id="libItem" hidden></div>`;
  $('ed').appendChild(el);
  const tap = (sel, fn) => el.addEventListener('click', (e) => { const b = e.target.closest(sel); if (b && el.contains(b)) fn(b, e); });
  $('libX').addEventListener('click', () => libClose());
  tap('[data-site]', (b) => libSite(b.dataset.site));
  tap('[data-it]', (b) => libItem(+b.dataset.it));
  tap('[data-more]', () => libLoad(true));
  tap('[data-open]', (b) => libBrowse(b.dataset.open));
  tap('[data-tok]', () => { const i = $('libTok'); if (!i) return; SET.sfTok = i.value.trim(); saveSettings(); edToast(SET.sfTok ? 'حُفظ الرمز على هذا الجهاز' : 'مُسح الرمز', ''); libNote(); });
  tap('[data-res]', (b) => { if (LIB.sel) { LIB.sel.pick = +b.dataset.res; libItemDraw(); } });
  tap('[data-get]', () => libGet());
  tap('[data-iback]', () => { $('libItem').hidden = true; LIB.sel = null; });
  let qt = 0; $('libQ').addEventListener('input', () => { clearTimeout(qt); qt = setTimeout(() => { LIB.q = $('libQ').value; libLoad(false); }, 450); });
  el.addEventListener('pointerdown', (e) => { if (e.target === el) libClose(); });
  for (const ev of ['wheel', 'touchmove']) el.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  return el;
}
function libOpen(kind) {
  const el = libEl(); el.classList.remove('gone'); LIB.on = true;
  const first = LIB_SITES.find((s) => s[2] === kind) || LIB_SITES[0];
  if (!LIB_SITES.find((s) => s[0] === LIB.site && s[2] === kind)) LIB.site = first[0];
  libSite(LIB.site);
}
function libClose() { const el = $('lib'); if (el) el.classList.add('gone'); LIB.on = false; LIB.sel = null; if ($('libItem')) $('libItem').hidden = true; }
function libSite(k) {
  LIB.site = k; LIB.q = ''; $('libQ').value = '';
  $('libSites').innerHTML = LIB_SITES.map(([id, n, kind]) => `<button type="button" class="edtab${id === k ? ' on' : ''}" data-site="${id}">${edSvg(kind === 'mat' ? 'gmat' : 'upl')}<span>${n}</span><i>${kind === 'mat' ? 'خامات' : 'نماذج'}</i></button>`).join('');
  $('libQ').hidden = k === 'f3d';
  libNote(); libLoad(false);
}
function libNote() {
  const s = LIB_SITES.find((q) => q[0] === LIB.site), esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  let h = `<p>${esc(s[3])}</p>`;
  if (LIB.site === 'sf') h += `<div class="libtok"><input id="libTok" type="password" placeholder="رمز Sketchfab (API token)" value="${esc(SET.sfTok || '')}" autocomplete="off"><button type="button" class="edupb" data-tok="1">حفظ</button><button type="button" class="edupb" data-open="https://sketchfab.com/settings/password">أين رمزي؟</button></div><p class="libsmall">الرمز يُحفظ على هذا الجهاز فقط ولا يُرسل إلا إلى Sketchfab. التنزيل مجاني للنماذج المسموح تنزيلها، ويُذكر صاحب كل نموذج ورخصته في الإعدادات.</p>`;
  $('libNote').innerHTML = h;
}
async function libLoad(more) {
  const g = ++LIB.gen, grid = $('libGrid'), site = LIB.site, src = LIB_SRC[site];
  if (!more) { LIB.items = []; LIB.page = 0; LIB.cur = null; grid.innerHTML = '<p class="edempty">…</p>'; grid.scrollTop = 0; }
  if (site === 'f3d') {
    grid.innerHTML = `<div class="libf3d"><p>اختر نموذجاً مجانياً من free3d واضغط «Download» هناك: يصل الملف إلى «من جهازك» ويُضاف إلى العالم.</p>
      <button type="button" class="edc wide" data-open="https://free3d.com/3d-models/free">${edSvg('web')}<span>افتح free3d</span></button>
      <button type="button" class="edupb" data-open="https://sketchfab.com/search?features=downloadable&type=models">موقع Sketchfab</button>
      <button type="button" class="edupb" data-open="https://ambientcg.com/list?type=material">موقع ambientCG</button>
      <button type="button" class="edupb" data-open="https://polyhaven.com/textures">موقع Poly Haven</button></div>`;
    return;
  }
  if (LIB.busy && !more) LIB.busy = false;
  if (LIB.busy) return; LIB.busy = true;
  try {
    const r = await src.list(LIB.q, LIB.page || 0, LIB.cur);
    if (g !== LIB.gen) return;
    LIB.items = LIB.items.concat(r.items); LIB.page = (LIB.page || 0) + 1; LIB.cur = r.cur || null; LIB.more = r.more;
    libGridDraw();
  } catch (e) {
    if (g !== LIB.gen) return;
    console.warn('library', site, e);
    grid.innerHTML = `<p class="edempty">${(e && e.ui) || 'تعذّر الوصول إلى الموقع'}</p>`;
  } finally { if (g === LIB.gen) LIB.busy = false; }
}
function libGridDraw() {
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const mat = LIB_SITES.find((s) => s[0] === LIB.site)[2] === 'mat';
  $('libGrid').innerHTML = (LIB.items.length ? LIB.items.map((it, i) => `<button type="button" class="edcard libcard" data-it="${i}">${it.th ? `<img src="${esc(it.th)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : `<span class="edph">${edSvg(mat ? 'gmat' : 'upl')}</span>`}<span class="ednm">${esc(it.name)}</span><small>${esc([it.lic, it.by].filter(Boolean).join(' · '))}</small></button>`).join('') : '<p class="edempty">لا نتائج</p>')
    + (LIB.more ? '<button type="button" class="edupb libmore" data-more="1">المزيد</button>' : '');
  // a picture that does not come: the card keeps its drawn placeholder
  for (const im of $('libGrid').querySelectorAll('img')) im.addEventListener('error', () => { const ph = document.createElement('span'); ph.className = 'edph'; ph.innerHTML = edSvg(mat ? 'gmat' : 'upl'); im.replaceWith(ph); }, { once: true });
}
async function libItem(i) {
  const it = LIB.items[i]; if (!it) return;
  LIB.sel = it; it.pick = it.pick || (LIB.site === 'sf' ? 0 : Math.min(qsel(1, 2, 4, 4), Math.max(...(it.res || [2]))));
  libItemDraw();
  const src = LIB_SRC[LIB.site];
  if (src.info && !it.infoDone) {
    try { await src.info(it); it.infoDone = true; if (it.res && !it.res.includes(it.pick)) it.pick = it.res.includes(2) ? 2 : it.res[0]; } catch (e) { console.warn('library item', e); }
    if (LIB.sel === it) libItemDraw();
  }
}
function libItemDraw() {
  const it = LIB.sel, el = $('libItem'); if (!it) { el.hidden = true; return; }
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const sf = LIB.site === 'sf', mat = LIB_SITES.find((s) => s[0] === LIB.site)[2] === 'mat';
  let h = `<div class="libic">${it.th ? `<img src="${esc(it.th)}" alt="" referrerpolicy="no-referrer">` : ''}<div class="libinfo"><b>${esc(it.name)}</b><small>${esc([it.by && 'من ' + it.by, it.lic && 'الرخصة: ' + it.lic, it.size && 'الحجم ' + libMB(it.size), it.faces && toAr(it.faces) + ' مضلّع'].filter(Boolean).join(' · '))}</small>`;
  if (!sf && it.res && it.res.length) h += `<div class="libres"><span>${mat ? 'الدقة' : 'دقة الصور'}</span>${it.res.map((r) => `<button type="button" class="edtab${r === it.pick ? ' on' : ''}" data-res="${r}">${r}K</button>`).join('')}</div><small>كل الدقات تُحفظ كما هي بلا تخفيض · 4K و8K ملفات كبيرة</small>`;
  if (sf) h += `<small>${SET.sfTok ? 'يُنزَّل بصيغة glTF الأصلية بكل صوره' : 'أدخل رمز Sketchfab أعلاه ليُنزَّل'}</small>`;
  h += `<div class="librow"><button type="button" class="edb save dirty" data-get="1">${edSvg('add')}<span>${mat ? 'نزّلها وأضفها لخاماتك' : 'نزّله وأضفه إلى العالم'}</span></button><button type="button" class="edb" data-open="${esc(it.page)}">في الموقع</button><button type="button" class="edb" data-iback="1">رجوع</button></div></div></div>`;
  el.innerHTML = h; el.hidden = false;
}
async function libGet() {
  const it = LIB.sel; if (!it) return;
  if (UPL.busy) { edToast('جارٍ تنزيل شيء آخر', 'انتظر حتى ينتهي'); return; }
  if (!upCanUp()) { edToast('الحفظ غير متاح هنا', ''); return; }
  const src = LIB_SRC[LIB.site], site = LIB_SITES.find((s) => s[0] === LIB.site), cr = { by: it.by || site[1], lic: it.lic || '', url: it.page, site: site[1] };
  UPL.busy = true; upShow(it.name, 'تنزيل من ' + site[1], 0.01);
  try {
    const got = await src.get(it, it.pick, (n, total) => upShow(it.name, 'تنزيل ' + (total ? toAr(Math.round(n / total * 100)) + '٪ من ' + libMB(total) : libMB(n)), total ? 0.02 + 0.6 * n / total : 0.3));
    if (got.mat) { got.mat.name = upClean(got.mat.name || it.name); const R = await gmImport(got.mat, '', cr); libClose(); gmAfterImport([R]); }
    else {
      const groups = got.group ? [got.group] : await upGroups(got.files);
      if (!groups.length) throw upErr('لم أجد نموذجاً داخل الملف');
      groups[0].name = upClean(it.name); groups[0].cr = cr;
      const R = await upOne(groups[0], '');
      upHide(); libClose(); edCatOpen(false); edPlace('U_' + R.mid);
      edToast('أُضيف «' + R.n + '»', (R.src === 'cloud' ? 'محفوظ مع لعبتك' : 'محفوظ على هذا الجهاز') + (cr.lic ? ' · ' + cr.lic : ''));
      upUsage();
    }
  } catch (e) {
    console.warn('library download', e);
    upFail(e && e.ui ? e.ui : 'تعذّر التنزيل', e && e.ui ? '' : String((e && e.message) || e).slice(0, 90));
  } finally { UPL.busy = false; }
}
// a site in the app's own browser (its downloads come back here), or a new tab where there is no app
async function libBrowse(url) {
  const app = await libApp();
  if (app && app.browse) { try { await fetch('/_app/browse?u=' + encodeURIComponent(url), { cache: 'no-store' }); return; } catch (_) {} }
  try { window.open(url, '_blank', 'noopener'); } catch (_) {}
  if (!app) edToast('يُفتح الموقع في نافذة جديدة', 'نزّل الملف ثم ارفعه من «من جهازك»');
  else edToast('حدّث التطبيق ليُفتح الموقع داخل اللعبة', 'نزّل النسخة الجديدة من صفحة الإصدارات');
}
// a file downloaded in the app's browser (the app calls this): added like an upload, once the editor is open
window.cosAppEvent = (ev) => {
  if (!ev || ev.t !== 'dl' || typeof ev.path !== 'string') return;
  LIB.pend.push(ev);
  if (ED.on) libTakeDownloads();
  else toast('وصل ملف من المتصفح', 'افتح وضع التطوير ليُضاف');
};
async function libTakeDownloads() {
  if (!LIB.pend.length || UPL.busy) return;
  const ev = LIB.pend.shift();
  try {
    const r = await fetch('/_lib/' + ev.path.split('/').map(encodeURIComponent).join('/'), { cache: 'no-store' });
    if (!r.ok) throw new Error('file ' + r.status);
    const f = new File([await r.blob()], ev.name || ev.path.split('/').pop());
    libClose(); await upFiles([f]);
    fetch('/_app/libdel?p=' + encodeURIComponent(ev.path)).catch(() => {});
  } catch (e) { console.warn('browser download', e); edToast('تعذّر فتح الملف المنزّل', String(ev.name || '')); }
  if (LIB.pend.length) setTimeout(libTakeDownloads, 400);
}
// the settings' «حول»: everything taken from these libraries, by whom, under which licence
function libCredits(body, p) {
  const rows = [];
  for (const R of UPL.recs.values()) if (R.cr) rows.push(['نموذج', R.n, R.cr]);
  for (const R of GMAT.recs.values()) if (R.cr) rows.push(['خامة', R.n, R.cr]);
  if (!rows.length) return;
  const h = document.createElement('div'); h.className = 'shead'; h.textContent = 'من مكتبات الإنترنت'; body.append(h);
  const ul = document.createElement('ul'); ul.className = 'lb-note credits-sf';
  for (const [what, n, cr] of rows) {
    const li = document.createElement('li'), a = document.createElement('a'); a.href = cr.url || '#'; a.target = '_blank'; a.rel = 'noopener'; a.textContent = '«' + n + '»';
    li.append(what + ': ', a, ' — ' + [cr.by, cr.site, cr.lic].filter(Boolean).join(' · ')); ul.append(li);
  }
  body.append(ul);
  if (rows.some((r) => r[2].site === 'Poly Haven')) p(LIB_UA_NOTE + ' — polyhaven.com (CC0)');
}
