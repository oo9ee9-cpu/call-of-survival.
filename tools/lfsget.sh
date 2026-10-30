#!/bin/bash
# usage: lfsget.sh <repo_dir> <owner/repo> <ref> <path>...   (replaces LFS pointer files in place, verifying sha256)
dir=$1; slug=$2; ref=$3; shift 3
cd "$dir" || exit 1
for p in "$@"; do
  if head -c 200 "$p" 2>/dev/null | grep -q "git-lfs.github.com/spec"; then
    oid=$(grep -o 'sha256:[0-9a-f]*' "$p" | cut -d: -f2)
    enc=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$p")
    curl -sS -L --max-time 120 -o "$p.tmp" "https://media.githubusercontent.com/media/$slug/$ref/$enc" || { echo "FAIL $p"; continue; }
    got=$(sha256sum "$p.tmp" | cut -d' ' -f1)
    if [ "$got" = "$oid" ]; then mv "$p.tmp" "$p"; echo "ok $(stat -c %s "$p") $p"; else echo "BADSHA $p"; rm -f "$p.tmp"; fi
  else echo "plain $(stat -c %s "$p" 2>/dev/null) $p"; fi
done
