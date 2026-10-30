#!/bin/bash
# the checks before publishing the lobby update; each writes its own log in shots/
cd "$(dirname "$0")/.."
U="(typeof LOBBY!=='undefined'&&LOBBY.on)||window.__err"
echo "== acctest" > shots/checks.log
timeout 900 python3 tools/acctest.py >> shots/checks.log 2>&1
echo "== tour" >> shots/checks.log
timeout 900 python3 tools/shot.py . game.html shots/tour.png --w 1280 --h 640 --until "$U" --wait 4 --shots 10 --gap 1 --settle 5 --js "$(cat tools/lobbyshots.js)" --js2 "__ls()" 2>&1 | grep -v "^\s" | grep -v 404 | tail -14 >> shots/checks.log
echo "== phone" >> shots/checks.log
timeout 600 python3 tools/shot.py . game.html shots/phone.png --mobile --w 844 --h 390 --until "$U" --wait 6 --js "({q: QUALITY.level, err: window.__err||null})" 2>&1 | grep -v "^\s" | grep -v 404 | tail -4 >> shots/checks.log
echo "== mech" >> shots/checks.log
timeout 900 python3 tools/shot.py . game.html shots/mech.png --w 960 --h 540 --until "$U" --wait 1 --js "$(cat tools/gametest.js); $(cat tools/mech.js)" 2>&1 | grep -v "^\s" | grep -v 404 | tail -6 >> shots/checks.log
echo "== views24" >> shots/checks.log
timeout 900 python3 tools/shot.py . game.html shots/v24.png --w 1280 --h 640 --until "$U" --wait 2 --shots 3 --gap 1 --settle 8 --js "$(cat tools/gametest.js); $(cat tools/views24.js)" --js2 "__next()" 2>&1 | grep -v "^\s" | grep -v 404 | tail -6 >> shots/checks.log
echo "== end" >> shots/checks.log
