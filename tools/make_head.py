# derive the v4 page head (CSS + HUD markup) from v3: the HUD stays identical, the bag/pause/death/intro panels grow
import re, os
SP = os.path.join(os.path.dirname(__file__), '..')
src = open(SP + '/v3src/mods/head.html', encoding='utf8').read().split('\n')
head = '<meta charset="utf-8">\n' + '\n'.join(src[1:456])         # drop the host wrapper line; stop before the script tags
def rep(a, b, s, count=1):
    if a not in s: raise SystemExit('missing: ' + a[:80])
    return s.replace(a, b, count)
# ── the backpack becomes a tabbed panel: craft · inventory · shop · wardrobe ──
i0 = head.index('<div id="craft" class="layer gone"'); i1 = head.index('<div id="chart" hidden')
head = head[:i0] + '''<div id="craft" class="layer gone" dir="rtl" lang="ar">
    <div class="bag" role="dialog" aria-label="الحقيبة">
      <header>
        <h3>الحقيبة</h3>
        <div class="cap"><span>الحمولة <b id="craftLoad">٠ / ٣٠٠</b></span><i><b id="craftLoadBar"></b></i></div>
        <div class="have"><span><b id="craftWoodI"></b><b id="craftWood">٠</b></span><span><b id="craftStoneI"></b><b id="craftStone">٠</b></span><span class="money"><b id="craftCoinI"></b><b id="craftCoin">٠</b></span></div>
        <button id="craftClose" type="button" aria-label="إغلاق الحقيبة"></button>
      </header>
      <nav id="bagTabs" role="tablist">
        <button type="button" role="tab" data-tab="craft" aria-selected="true">الصناعة</button>
        <button type="button" role="tab" data-tab="inv" aria-selected="false">المخزون</button>
        <button type="button" role="tab" data-tab="shop" aria-selected="false">المتجر</button>
        <button type="button" role="tab" data-tab="wear" aria-selected="false">الملابس</button>
      </nav>
      <div id="bagTools"><div id="bagCats" role="toolbar" aria-label="الأقسام"></div><input id="bagSearch" type="search" placeholder="ابحث…" aria-label="ابحث في القائمة" autocomplete="off"></div>
      <div id="bagNote" role="status"></div>
      <div id="craftList"></div>
    </div>
  </div>

  ''' + head[i1:]
# ── pause: settings for night, weather and quality, plus the save line ──
p0 = head.index('<div id="pause" class="layer gone"'); p1 = head.index('<div id="death" class="layer gone"')
head = head[:p0] + '''<div id="pause" class="layer gone" dir="rtl" lang="ar">
    <div class="panel">
      <h2>استراحة</h2>
      <p>العصا يسار الشاشة للمشي، واسحب يمينها لتدوير الكاميرا. الشريط في الأسفل للأدوات، والحقيبة للصناعة والمتجر والملابس.</p>
      <p>على الحاسوب: <kbd>W A S D</kbd> للمشي، <kbd>Shift</kbd> ركض، <kbd>مسافة</kbd> قفز أو فرامل، الفأرة للضرب والإطلاق، <kbd>1–6</kbd> الأدوات، <kbd>Tab</kbd> الحقيبة، <kbd>E</kbd> ركوب ونزول واستخدام، <kbd>V</kbd> كاميرا الجسد، <kbd>R</kbd> تعبئة أو تدوير البناء، <kbd>F</kbd> المصباح، <kbd>M</kbd> الخريطة.</p>
      <div class="row"><span>جودة الرسوم:</span>
        <button class="ghost" type="button" data-q="ultra">فائقة</button><button class="ghost" type="button" data-q="high">عالية</button><button class="ghost" type="button" data-q="mid">متوسطة</button><button class="ghost" type="button" data-q="low">خفيفة</button>
      </div>
      <div class="row"><span>الليل:</span>
        <button class="ghost" type="button" data-night="short">ليل قصير</button><button class="ghost" type="button" data-night="off">نهار دائم</button>
      </div>
      <div class="row"><span>الطقس:</span>
        <button class="ghost" type="button" data-weather="auto">متقلّب ومطر</button><button class="ghost" type="button" data-weather="clear">صحو دائماً</button><button class="ghost" type="button" data-weather="rain">مطر الآن</button>
      </div>
      <p id="saveNote" class="credits">تُحفظ رحلتك تلقائياً على هذا الجهاز، وتبدأ من جديد إذا سقطت.</p>
      <div class="row"><button id="resumeBtn" class="cta" type="button">متابعة</button><button id="resetBtn" class="ghost" type="button">بداية جديدة</button></div>
      <p class="credits" id="credits"></p>
    </div>
  </div>

  ''' + head[p1:]
# ── death: permadeath ──
d0 = head.index('<div id="death" class="layer gone"'); d1 = head.index('<div id="intro" class="layer"')
head = head[:d0] + '''<div id="death" class="layer gone" dir="rtl" lang="ar">
    <div class="panel">
      <h2>سقطت</h2>
      <div class="stats"><div><b id="dKills">٠</b><span>زومبي قتلتهم</span></div><div><b id="dTime">٠:٠٠</b><span>مدة النجاة</span></div><div><b id="dBest">٠</b><span>أفضل رقم</span></div></div>
      <p>انتهت هذه الحياة: كل ما جمعته وبنيته واشتريته يعود إلى البداية، والجزيرة تنتظرك من أولها.</p>
      <div class="row"><button id="respawnBtn" class="cta" type="button">حياة جديدة</button></div>
    </div>
  </div>

  ''' + head[d1:]
# ── intro ──
n0 = head.index('<div id="intro" class="layer"'); n1 = head.rindex('</div>')
head = head[:n0] + '''<div id="intro" class="layer" dir="rtl" lang="ar">
    <div class="card">
      <span class="tag">نجاة · صناعة · بناء · ٦٤ كم²</span>
      <h1>جزيرة الصخرة</h1>
      <p class="lede">جزيرة طولها ثمانية كيلومترات وعرضها ثمانية: مدينة على البحر وقرى وحقول قمح وذرة، غابات بلّوط وصنوبر، جبال يكسوها الثلج، صحراء وواحة، ومستنقع وجزر نخيل. اقطع واحفر واصنع، اشترِ ملابسك، قُد سيارتك أو اركب حصانك، والليل قصير لكنه يأتي بالزومبي.</p>
      <div class="keys">
        <span>على الهاتف: الشاشة أفقية. امشِ بإصبعك يساراً، ودوّر الكاميرا يميناً، والأدوات في الشريط أسفل الوسط.</span>
        <span>على الحاسوب: <kbd>W A S D</kbd> مشي، الفأرة للضرب والإطلاق، <kbd>1–6</kbd> الأدوات، <kbd>Tab</kbd> الحقيبة، <kbd>E</kbd> ركوب واستخدام، <kbd>V</kbd> كاميرا الجسد.</span>
      </div>
      <button id="startBtn" class="cta" type="button" disabled>ابدأ</button>
      <span id="loadTrack"><i id="loadBar"></i></span>
      <div id="loadNote" role="status">جارٍ تشكيل الجزيرة…</div>
    </div>
  </div>
''' + head[n1:]
# ── chart legend ──
head = re.sub(r'<div class="legend">.*?</div>', '''<div class="legend">
        <span><i style="background:#2b6a8c"></i>بحر وبحيرات</span>
        <span><i style="background:#e0d0a0"></i>شاطئ ورمل</span>
        <span><i style="background:#9cb468"></i>مراعٍ وحقول</span>
        <span><i style="background:#4e6e48"></i>غابات</span>
        <span><i style="background:#b0aca6"></i>جبال وثلج</span>
        <span><i style="background:#f6de8c"></i>طرق</span>
        <span><i style="background:#9fe0ff"></i>مركبة</span>
        <span><i style="background:#ffb53d"></i>موقعك</span>
        <span class="hint">اسحب لتحريك الخريطة · قرّب بإصبعين</span>
        <button id="chartClose" class="ghost" type="button">إغلاق الخريطة</button>
      </div>''', head, count=1, flags=re.S)
# ── CSS for the new panels ──
css = '''
/* v4: tabbed backpack, shop and wardrobe, settings */
.money{color:#ffd76a;} #craftCoinI{color:#ffd76a;}
#bagTabs{display:flex;gap:4px;padding:8px 12px 0;}
#bagTabs button{flex:1;font:700 13.5px var(--f-ui);color:rgba(242,246,241,.7);background:rgba(255,255,255,.05);border:1px solid var(--edge-soft);border-bottom:0;border-radius:12px 12px 0 0;padding:8px 6px;cursor:pointer;}
#bagTabs button[aria-selected="true"]{color:var(--ink);background:var(--amber);border-color:var(--amber);}
#bagTools{display:flex;gap:8px;align-items:center;padding:8px 12px;border-top:1px solid var(--edge-soft);border-bottom:1px solid var(--edge-soft);}
#bagCats{display:flex;gap:5px;overflow-x:auto;flex:1;scrollbar-width:none;}
#bagCats::-webkit-scrollbar{display:none;}
#bagCats button{flex:none;font:500 12px var(--f-ui);color:var(--foam);background:rgba(255,255,255,.06);border:1px solid var(--edge-soft);border-radius:999px;padding:4px 10px;cursor:pointer;white-space:nowrap;}
#bagCats button[aria-pressed="true"]{background:rgba(255,181,61,.25);border-color:var(--amber);}
#bagSearch{width:120px;flex:none;font:13px var(--f-ui);color:var(--foam);background:rgba(255,255,255,.08);border:1px solid var(--edge-soft);border-radius:10px;padding:6px 9px;outline:none;-webkit-user-select:text;user-select:text;}
#bagSearch:focus{border-color:var(--amber);}
#bagNote{font-size:12px;color:var(--sand);padding:6px 14px 0;min-height:0;}
#bagNote:empty{display:none;}
.bag{width:min(760px,100%);}
#craftList{min-height:120px;}
.rcard .cnt{font-size:11px;color:var(--sand);font-weight:500;}
.rcard.sel{border-color:var(--amber);background:rgba(255,181,61,.1);}
.rcard .sw{display:inline-block;width:14px;height:14px;border-radius:50%;border:1px solid rgba(255,255,255,.5);vertical-align:-2px;margin-inline-end:4px;}
.rcard .rb2{display:flex;flex-direction:column;gap:5px;flex:none;}
.rbtn.alt{background:rgba(255,255,255,.12);color:var(--foam);}
.cost .cc svg{color:#ffd76a;} .cost .ci{color:var(--foam);}
.ricon img{width:34px;height:34px;}
.wear-slots{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;padding:10px 12px;}
.legend .hint{font-size:11px;opacity:.8;}
.ghost[data-night][aria-pressed="true"],.ghost[data-weather][aria-pressed="true"]{background:rgba(255,181,61,.3);border-color:var(--amber);}
#chartCanvas{touch-action:none;cursor:grab;}
@media (max-height:460px){ #bagTabs button{padding:6px 4px;font-size:12.5px;} #bagTools{padding:6px 10px;} #bagSearch{width:96px;} }
'''
head = head.replace('</style>', css + '</style>', 1)
head += '''
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/utils/SkeletonUtils.js"></script>
'''
os.makedirs(SP + '/src', exist_ok=True)
open(SP + '/src/00_head.html', 'w', encoding='utf8').write(head)
print('head', len(head))
