#!/bin/bash
# render a list of named views: name|query
cd "$(dirname "$0")/.."
while IFS='|' read -r name q; do
  [ -z "$name" ] && continue
  timeout 600 python3 tools/shot.py . "index.html?$q" shots/$name.png --w ${W:-960} --h ${H:-540} --until "window.__done||window.__err" --timeout 400 --wait 1 --js "({s:window.__stats,e:window.__err,i:window.__info})" 2>&1 | grep -v "^\[warning\]" | tail -4 | sed "s/^/$name: /"
done
