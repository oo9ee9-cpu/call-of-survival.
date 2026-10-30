# concatenate the page: head (CSS + HUD) + every src/*.js module in order → index.html
import os, sys, glob, re
SP = os.path.join(os.path.dirname(__file__), '..')
only = sys.argv[1:]  # optional list of module prefixes to include (for tests)
head = open(SP + '/src/00_head.html', encoding='utf8').read()
mods = sorted(glob.glob(SP + '/src/[0-9][0-9]_*.js'))
if only: mods = [m for m in mods if any(os.path.basename(m).startswith(p) for p in only)]
js = '\n'.join(open(m, encoding='utf8').read() for m in mods)
html = head + '\n<script>\n' + js + '\n</script>\n'
out = SP + '/' + os.environ.get('OUT', 'index.html')
open(out, 'w', encoding='utf8').write(html)
print('built', out, len(html), 'bytes;', len(mods), 'modules:', ' '.join(os.path.basename(m)[:2] for m in mods))
