# Call of Survival — working notes for Claude

Browser 3D survival game (three.js r128, one page) shipped two ways:
1. a Claude artifact (online: db/room/user/assets capabilities — friends, clans, cloud saves, shared dev world): https://claude.ai/artifact/6gq2bVqVUv19bWBas36eYo
2. this repo's Android app (WebView, offline, local saves), built by GitHub Actions, updated over the air from `game/`.

## Layout
- `src/00_head.html` (CSS + markup) and `src/NN_*.js` modules → `tools/build.py` concatenates them into one page.
  Build: `M=$(ls src | grep -E '^[0-9]{2}_' | grep -v '^00_\|^99_' | sed 's/_.*//' | tr '\n' ' '); OUT=game/index.html python3 tools/build.py $M`
  Lint: `bash tools/lint.sh $M` must print `summary {}` (eslint config in tools/lint/).
- `game/` = the web root: `index.html` + `assets/…` (the same files the artifact publishes). `game/version.json` from `tools/manifest.py`.
- `cdn/<host>/<path>` (with `@` written `-at-`): three.js r128 + GLTFLoader, SkeletonUtils, OBJ/MTL/FBX/Draco loaders, GLTFExporter, fflate.
- `NOTES.md`: the long history of the game's systems (read the parts you need).
- Headless tests: `python3 tools/scenario.py game/index.html tools/edt/<steps>.json shots/<prefix> [--mobile --cloud]` (Playwright,
  swiftshader; ~2 fps, so step physics in JS rather than holding keys). `--cloud` stands in for the artifact runtime.

## Releasing a new version (both targets)
1. Change `src/`, lint, build `game/index.html`, test.
2. Android + over-the-air: `tools/release.sh <N> "message"` (N = previous `v` in game/version.json + 1): manifest, commit, tag `v<N>`, push.
   The tag runs `.github/workflows/apk.yml`: signed `CallOfSurvival.apk` on release `v<N>`. Installed apps read
   `raw.githubusercontent.com/oo9ee9-cpu/call-of-survival./main/game/version.json` at start and download only changed files from tag `v<N>`.
   Bump `"shell"` (manifest arg 2) and `SHELL` in android/app/build.gradle only when the Java side must change for the content.
3. Artifact: publish `game/index.html` with `files` = new/changed assets, url above, and the full capabilities:
   db rules (profiles, links, invites, worlds, clans, clanmembers: `{path:X, read:'view', write:'owner'}` + `{path:'X/{self}', write:'interact'}`;
   devworld and devmodels: read view, write owner), `assets: {}`, `user: {}`, `room: {topics: {invite: 'interact', act: 'interact'}}`.
   Read the artifact (any small file with `path`) before publishing to it from a new conversation.

## Android app (android/)
- MainActivity: full-screen landscape WebView on https://appassets.androidplatform.net/ (requests answered in
  shouldInterceptRequest from downloaded updates, then APK assets `game/…`; CDN hosts from assets `cdn/…`), file chooser for
  the editor's uploads, back button → editor/pause (BACK_JS), renderer crash → reload.
- Updater: version.json compare, changed files to files/stage then files/game, SHA-1 checked; newer APK clears downloads.
- Signing: `android/release.p12` (PKCS12, alias `cos`), password in the repo secret `KEY_PASS` (never in files).
- versionCode = game version (`-PgameVersion`), so a newer APK installs over an older one and keeps the saves.

## Rules
- Never commit tokens or passwords. The keystore password lives only in the `KEY_PASS` secret.
- The owner's game characters (Jett, Judy, Malenia, Tifa) are excluded; third-party content only with its licence credited (settings).
