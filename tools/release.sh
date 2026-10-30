#!/bin/bash
# a new version for the Android app's players, over the air: the page rebuilt from src/, its files committed, then
# game/version.json pointing at that commit (the app downloads changed files from it, so they never move) and pushed.
# No tag is needed (this session cannot push tags); a new APK for new installs comes from a release the owner creates
# on GitHub (Releases → Draft a new release → tag v<N>), which runs .github/workflows/apk.yml.
# usage: tools/release.sh <N> "what changed"
set -e
cd "$(dirname "$0")/.."
N=$1; MSG=${2:-"Version $1"}
[ -n "$N" ] || { echo "usage: tools/release.sh <version> [message]"; exit 1; }
M=$(ls src | grep -E '^[0-9]{2}_' | grep -v '^00_\|^99_' | sed 's/_.*//' | tr '\n' ' ')
OUT=game/index.html python3 tools/build.py $M
TRAIL="Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git add -A
git commit -m "$MSG

$TRAIL"
REF=$(git rev-parse HEAD)
python3 tools/manifest.py "$N" 1 "$REF"
git add game/version.json
git commit -m "Version $N for the app (files at ${REF:0:7})

$TRAIL"
git push origin main
