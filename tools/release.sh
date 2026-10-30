#!/bin/bash
# a new version for everyone: the page rebuilt from src/, the manifest, a commit and the tag v<N> (the tag builds the APK on
# GitHub and the apps already installed see the update at their next start). usage: tools/release.sh <N> "what changed"
set -e
cd "$(dirname "$0")/.."
N=$1; MSG=${2:-"Version $1"}
[ -n "$N" ] || { echo "usage: tools/release.sh <version> [message]"; exit 1; }
M=$(ls src | grep -E '^[0-9]{2}_' | grep -v '^00_\|^99_' | sed 's/_.*//' | tr '\n' ' ')
OUT=game/index.html python3 tools/build.py $M
python3 tools/manifest.py "$N"
git add -A
git commit -m "$MSG

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git tag "v$N"
git push origin main "v$N"
