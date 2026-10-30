#!/bin/bash
# one boot: the terrain/uber cost probe (6 steps), then the building scans (land4.js)
cd "$(dirname "$0")/.."
PAGE=${1:-game_t.html}
U="(typeof LOBBY!=='undefined'&&LOBBY.on)||window.__err"
timeout 3000 python3 -u tools/shot.py . "$PAGE" shots/v14/probe.png --w 960 --h 540 --until "$U" --timeout 900 --wait 3 \
  --js "$(cat tools/gametest.js);$(cat tools/terrprobe.js);$(cat tools/land4.js)" --js2 "__next()" --shots 16 --settle 4 --gap 0.3 > shots/v14/probe.log 2>&1
grep "js2\|js ->\|pageerror\|elapsed" shots/v14/probe.log | cut -c1-1500
