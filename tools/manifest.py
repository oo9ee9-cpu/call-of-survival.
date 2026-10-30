"""game/version.json: the version of the game and every file in game/ with a short SHA-1 and its size. The Android app
compares it with the one it has and downloads only what changed (from the tag `ref`, so a version's files never move).
usage: python3 tools/manifest.py <version> [shell] [ref]
  shell: the app code this content needs (1 until the Java side changes)
  ref:   where the app downloads this version's files: a commit SHA (tools/release.sh) or a tag (default v<version>)"""
import os, sys, json, hashlib
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'game')
v = int(sys.argv[1]); shell = int(sys.argv[2]) if len(sys.argv) > 2 else 1; ref = sys.argv[3] if len(sys.argv) > 3 else f'v{v}'
files = {}
for d, _, fs in os.walk(R):
    for f in fs:
        p = os.path.join(d, f); rel = os.path.relpath(p, R).replace(os.sep, '/')
        if rel == 'version.json': continue
        files[rel] = [hashlib.sha1(open(p, 'rb').read()).hexdigest()[:16], os.path.getsize(p)]
m = {'v': v, 'shell': shell, 'ref': ref, 'bytes': sum(x[1] for x in files.values()), 'files': dict(sorted(files.items()))}
json.dump(m, open(os.path.join(R, 'version.json'), 'w'), separators=(',', ':'))
print('version', v, len(files), 'files', round(m['bytes'] / 1e6, 1), 'MB')
