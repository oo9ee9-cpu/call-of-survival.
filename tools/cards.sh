#!/bin/bash
# one clean scenic picture per map for the lobby's map cards (shot 0 is the map's lobby, shot 1 the card view)
# usage: bash tools/cards.sh snow forest desert water mega
cd "$(dirname "$0")/.." || exit 1
U="(typeof LOBBY!=='undefined'&&LOBBY.on)||window.__err"
for m in "$@"; do
  timeout 900 python3 tools/shot.py . "game.html?map=$m&dev=1" "shots/card_$m.png" --w 1280 --h 720 --until "$U" --wait 3 --shots 2 --gap 1 --settle 12 \
    --js "$(cat tools/gametest.js); $(cat tools/cardviews.js)" --js2 "__card()" > "shots/card_$m.log" 2>&1
  echo "== card $m"; grep -v "^\s" "shots/card_$m.log" | grep -v 404 | grep -iv "warning" | cut -c1-200 | tail -3
done
