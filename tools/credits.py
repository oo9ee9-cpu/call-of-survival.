"""Credits for the owner's uploaded models, from the authors, titles, licences and sources their glb files carry
(collected by user_models.py into data/valley/user_models.json). Rewrites the section between the markers in
CREDITS.md and writes data/credits_models.json for the in-game credits page.
usage: python3 -I credits.py <project_dir>"""
import json
import re
import sys

P = sys.argv[1]
info = json.load(open(P + '/data/valley/user_models.json'))
AR = {'cvn65': 'حاملة الطائرات CVN-65', 'cvn80': 'حاملة الطائرات CVN-80', 'cdg': 'حاملة الطائرات شارل ديغول',
      'chinook': 'مروحية شينوك', 'b2': 'قاذفة B-2', 'j36': 'مقاتلة J-36', 'mi171': 'مروحية Mi-171', 'fennek': 'مدرّعة فينك',
      'tam150': 'شاحنة TAM 150', 'patriot': 'منظومة باتريوت', 'cram': 'منظومة C-RAM', 'cactus_sam': 'منظومة كاكتوس',
      'cactus_sahv': 'عربة كاكتوس', 'pantsir': 'منظومة بانتسير', 'radar': 'رادار P-18', 'watchtower': 'برج المراقبة',
      'fence': 'السياج', 'jersey': 'الحواجز الخرسانية', 'container': 'الحاويات', 'res_contemporary': 'مبنى سكني حديث',
      'res_facade': 'واجهة عمارة', 'res_multistory': 'عمارة متعددة الطوابق', 'inn': 'نُزُل Big Basin',
      'helmet': 'الخوذة التكتيكية', 'vest': 'الدرع', 'vest2': 'الدرع الثاني', 'laptop': 'الحاسوب المحمول', 'drone': 'المسيّرة',
      'amraam': 'صاروخ AIM-120', 'gbu24': 'قنبلة GBU-24', 'gbu27': 'قنبلة GBU-27', 'mk84': 'قنبلة Mk84', 'palm': 'النخيل',
      'ar55': 'سيارة زاستافا AR-55'}


def clean(s):
    return re.sub(r'\s*\(https?://[^)]*\)', '', str(s)).strip()


def link(s):
    m = re.search(r'\((https?://[^)]*)\)', str(s))
    return m.group(1) if m else ''


rows = []
for name in sorted(info):
    d = info[name]
    author = clean(d.get('credit', 'owner'))
    lic = clean(d.get('license', 'owner'))
    rows.append(dict(name=name, ar=AR.get(name, name), title=d.get('title', name), author=author, author_url=link(d.get('credit', '')),
                     license=lic, license_url=link(d.get('license', '')), source=d.get('source', '')))
json.dump(rows, open(P + '/data/credits_models.json', 'w'), ensure_ascii=False, indent=1)

md = ['<!-- models:begin (tools/credits.py) -->', '## The owner\'s uploaded models (models/u/)', '',
      'Sent in by the game\'s owner (repository oo9ee9-cpu/uploads). Resized, re-centred and their textures shrunk for phones;',
      'credited as their files say.', '', '| Model | Title | Author | Licence | Source |', '|---|---|---|---|---|']
for r in rows:
    if r['author'] == 'owner':
        md.append('| `%s` | %s | the game\'s owner | owner | — |' % (r['name'], r['title']))
    else:
        md.append('| `%s` | %s | %s | %s | %s |' % (r['name'], r['title'].replace('|', '\\|'), r['author'], r['license'], r['source']))
md += ['', 'CC-BY-NC 4.0 models may not be used in a game that is sold.', '<!-- models:end -->']
txt = open(P + '/CREDITS.md').read()
block = '\n'.join(md)
if '<!-- models:begin' in txt:
    txt = re.sub(r'<!-- models:begin.*?<!-- models:end -->', block, txt, flags=re.S)
else:
    txt = txt.replace('## Made for this test slice', block + '\n\n## Made for this test slice')
open(P + '/CREDITS.md', 'w').write(txt)
print('credits:', len(rows), 'models')
