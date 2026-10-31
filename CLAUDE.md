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
2. Android over the air: `tools/release.sh <N> "message"` (N = previous `v` in game/version.json + 1) commits the files, then
   game/version.json with `ref` = that commit, and pushes main. Installed apps read
   `raw.githubusercontent.com/oo9ee9-cpu/call-of-survival./main/game/version.json` at start and download only changed files from `ref`.
   This session cannot push tags (the git proxy answers 403). A new APK (for new installs, or when the Java side changed) comes from
   a release the owner creates on GitHub: Releases → Draft a new release → new tag `v<N>` → Publish; the tag runs
   `.github/workflows/apk.yml`, which attaches both APKs. A push to main that changes android/ (or the workflow) rebuilds them
   and replaces the APKs on the release `v<version in game/version.json>`, or on the newest release when that one does not
   exist (so …/releases/latest/download/CallOfSurvival-lite.apk is always current). Bump `"shell"` (manifest arg 2) and `SHELL` in
   android/app/build.gradle only when the Java side must change for the content.
3. Artifact: publish `game/index.html` with `files` = new/changed assets, url above, and the full capabilities:
   db rules (profiles, links, invites, worlds, clans, clanmembers: `{path:X, read:'view', write:'owner'}` + `{path:'X/{self}', write:'interact'}`;
   devworld, devmodels and devmats: read view, write owner), `assets: {}`, `user: {}`, `room: {topics: {invite: 'interact', act: 'interact'}}`.
   Read the artifact (any small file with `path`) before publishing to it from a new conversation.

## Ground materials and the internet's libraries (v19)
- `src/45_gmat.js` (materials, GPU arrays, the editor's «أرضية» tool), `src/46_netlib.js` (ambientCG, Poly Haven, Sketchfab,
  free3d), paint data `GP` in 02_world, shader + vertex weights in 03_terrain. Originals are never made smaller; only what the
  device draws is sized (setting «دقة خامات الأرض», `upFitGpu` for models). Details in NOTES.md (v19).
- Library tests run with `--netmock` (stand-ins for the sites and for the app's `/_net`, `/_lib`; files in shots/).

## Android app (android/)
- Shell 2 (BuildConfig.SHELL): `/_app/info`, `/_net/get?u=` (the sites' APIs and files, no CORS), `/_app/browse?u=` (Browser.java,
  downloads → files/lib/dl → `cosAppEvent`), `/_lib/…`, `/_app/libdel`. version.json keeps "shell": 1 while the page still works
  without them (it asks /_app/info). The updater's APK link is the lite APK.
- MainActivity: full-screen landscape WebView on https://appassets.androidplatform.net/ (requests answered in
  shouldInterceptRequest from downloaded updates, then APK assets `game/…`; CDN hosts from assets `cdn/…`), file chooser for
  the editor's uploads, back button → editor/pause (BACK_JS), renderer crash → reload.
- Updater: version.json compare, changed files to files/stage then files/game, SHA-1 checked; newer APK clears downloads.
  Two APKs per release: CallOfSurvival.apk (game inside, 110 MB) and CallOfSurvival-lite.apk (<1 MB, no game/ assets: the first
  start downloads the whole current version, then updates the same way). The owner's phone refused the 110 MB one as an
  «invalid package» (valid v1+v2+v3 signatures); the lite one installs — point people to the lite APK.
- Signing: `android/release.p12` (PKCS12, alias `cos`), password in the repository variable `KEY_PASS` (Settings → Secrets and
  variables → Actions; the secret form failed for the owner) — never in files.
- versionCode = game version (`-PgameVersion`), so a newer APK installs over an older one and keeps the saves.

## Rules
- Never commit tokens or passwords. The keystore password lives only in the `KEY_PASS` repository variable.
- The owner's game characters (Jett, Judy, Malenia, Tifa) are excluded; third-party content only with its licence credited (settings).
