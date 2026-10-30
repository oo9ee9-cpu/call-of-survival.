#!/bin/bash
# what the ground and the building shaders cost: three views (meadow, forest, city), each with the terrain/uber variants
cd "$(dirname "$0")/.."
PAGE=${1:-game_t.html}
U="(typeof LOBBY!=='undefined'&&LOBBY.on)||window.__err"
timeout 2400 python3 -u tools/shot.py . "$PAGE" shots/v14/terr.png --w 960 --h 540 --until "$U" --timeout 900 --wait 3 \
  --js "$(cat tools/gametest.js);$(cat tools/terrprobe.js)" --js2 "__next()" --shots 7 --settle 4 --gap 0.3 > shots/v14/terr.log 2>&1
grep "js2\|js ->\|pageerror\|elapsed" shots/v14/terr.log | cut -c1-900
