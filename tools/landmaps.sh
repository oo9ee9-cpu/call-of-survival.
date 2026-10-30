#!/bin/bash
# boot every map and list where its landforms stand, plus any page error
cd "$(dirname "$0")/.."
PAGE=${1:-game_t.html}
U="(typeof LOBBY!=='undefined'&&LOBBY.on)||window.__err"
for m in island desert snow forest water mega; do
  echo "== $m"
  timeout 900 python3 -u tools/shot.py . "$PAGE?map=$m&dev=1" shots/v14/map_$m.png --w 640 --h 360 --until "$U" --timeout 800 --wait 2 \
    --js "({err: window.__err || null, land: LAND.list.map((q) => q.kind + '@' + Math.round(q.x) + ',' + Math.round(q.z))})" 2>&1 | grep "js ->\|pageerror\|\[error\]" | grep -v "404\|favicon" | cut -c1-900
done
