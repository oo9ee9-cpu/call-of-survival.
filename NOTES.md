# جزيرة الصخرة v4 — working notes (read me after a context reset)

User request (Arabic, 2026-10-18): much more realism (trees "scary real", crops, forests that differ, sun shafts in forest, real rain like the farm photo), 8×8 km map (64 km², land 51.47 %, water 48.53 %) with varied biomes, cars + bot players + animals + new cars, realistic models from the internet (permission given; we still respect licences + credit), human character, clothes shop, 800+ craftable things, dig with pickaxe for coal/treasure, persistent save (reset everything on death), long day / short night, real rain, keep ALL HUD counters/layout the same, much smoother.
Publish target: update artifact https://claude.ai/artifact/6gq2bVqVUv19bWBas36eYo in place (v3 source fully Read; saved copy at v3src/v3.html, split into v3src/mods/*.js).

## Paths
- SP = /tmp/claude-0/-home-claude/e074db26-2f12-5b8f-9b8a-91abbda2e708/scratchpad/v4
- tools/wg/*.py  world generator (run in order wg1..wg8; outputs build/wg/*.npy, assets/world/*)
  - wg1 land (arg = land target before water, 0.530 gives 51.47 % after), wg2 relief, wg3 erosion (C), wg4 lakes/rivers, wg5 places, wg6 roads, wg7 biomes/fields, wg8 export
- tools/wg/c/wgc.c → libwgc.so (erosion, thermal, A*)
- tools/gltfdecode.cjs (Draco/KTX2 → plain GLB), tools/glbinfo.py, tools/msimp/msimplify (meshoptimizer CLI), tools/lfsget.sh, tools/sheet.py
- dl/ : three-dev (latest three.js blobless), three-r128 (build + GLTFLoader etc.), ez-tree, babylon (Assets), khronos (glTF-Sample-Assets), drei-assets, meshopt, dec/ (decoded glbs)
- assets/ : files to publish (world/ done)

## World data (assets/world)
- height.png 1025² RGB: R,G = uint16 v → h = v/100 − 100 (m); B = micro-relief amplitude ×100 (m)
- water.png 1025² RGB: R,G = water level (same encoding; −100 = none); B = flow angle (0 still; 1..254 → angle)
- surface.png 1025² RGB: moisture, forest density, temperature (0..255)
- ids.png 1025² RGB: biome id, surface class, crop id
  - biomes: 0 sea,1 beach,2 coast(mediterranean),3 forest,4 taiga,5 alpine,6 farm,7 desert,8 swamp,9 tropic,10 isles,11 meadow,12 lake,13 river
  - classes: 0 natural,1 field,2 town ground,3 beach sand,4 bank,5 dunes,7 road
  - crops: 1 wheat,2 corn,3 sunflower,4 cotton,5 potato,6 tomato,7 fallow,8 wheat,9 corn,10 pumpkin,11 carrot,12 barley
- world.json: stats, spawn, settlements[{id,name,kind,x,z,r,buildings[{kind,x,z,hx,hz,door,style,floors,wall,trim,seed,enter,name,shop,sign..}],streets[{pts,w,kind}],props[{kind,x,z,ry,..}],parking,squares,fence}], poi, roads[{name,kind,w,pts[[x,z,y]],bridges[[i0,i1]]}], rivers[{name,pts,w,wl}], lakes, fields[{x,z,w,d,crop,rows}]
- grid: 1025 samples, 8 m step, covers ±4096 m; playable square ±4000 m (64 km²). North = −Z.
- map.jpg 2048² / map_s.jpg 1024² chart.

## Licences / credits collected
- ez-tree (MIT, Daniel Greenheck) tree generator + leaf textures; bark textures ambientCG CC0
- Babylon.js Assets (CC-BY 4.0): grass.png, dirt.jpg, ground.jpg, sand.jpg, rockyGround PBR, coastalCliff.glb (Poly Haven CC0 content), particles, seagull etc.
- three.js examples: Soldier/Michelle/Xbot (Mixamo), Horse/Flamingo/Parrot/Stork (mirada / ro.me), ferrari.glb (vicent091036, CC-BY), kira (CC0)
- Khronos glTF samples: CarConcept, CesiumMilkTruck, Fox, BarramundiFish, SheenChair, Lantern, Sunglasses, sofas... (CC0 / CC-BY 4.0)
- OpenGameArt Dark Grass (CC-BY 3.0) from v3

## Runtime plan (modules in src/, concatenated by tools/build.py into one HTML)
00 head (v3 HUD CSS/HTML + bag tabs) · 01 core (helpers, quality, renderer, sky, time/weather) · 02 worlddata (PNG decode, height bicubic+detail, water, spatial hash colliders) · 03 terrain (quadtree chunks, texture-array splat) · 04 water (ocean + inland water meshes) · 05 materials · 06 town (buildings/roads/props streaming) · 07 veg (trees LOD/impostors, grass, crops, rocks) · 08 assets · 09 player · 10 combat/zombies · 11 npc bots · 12 animals · 13 vehicles (+AI traffic) · 14 items (800+) · 15 survival (craft/build/dig/farm/fish) · 16 shop/wardrobe · 17 save · 18 audio · 19 post (bloom, god rays, rain lens, dyn-res) · 20 hud (minimap/chart/bag tabs) · 21 main

## Status (2026-10-19, after context reset #2)
- [x] all runtime modules written: 01 core, 02 world, 03 terrain, 04 water, 05 roads, 06 town, 07 veg, 08 assets, 09 player, 10 combat, 11 rocks, 12 animals, 13 vehicles (+traffic, parked cars), 14 items (934 items / 840 recipes), 15 places (POIs: castle, temple ruins, radio mast, gas stations, cabins, camp, wind farm, loggers + zoneAt/nearSettlement), 16 survival (harvest, felling, logs, stumps, digging + treasures + metal detector, fishing, eating, loot boxes, beds, use button/interact), 17 build (3 m grid pieces up to 4 storeys, placed furniture/stations/lamps/deco/farm, plots, saplings, stashes, doors, hammer pick-up, stationNear), 18 npc (survivor/bandit bots, shopkeepers), 19 shop (catalogs, buy/sell, car dealer, wardrobe/outfits), 20 audio, 21 post (rain/snow streaks, bloom, sun shafts, lens drops, grading, FXAA, dynamic resolution), 22 hud (v3 layout; bag tabs craft/inv/shop/wear; minimap+chart from assets/world/map.jpg), 23 save (db capability per-viewer docs data/users/<uid>/save + /world, localStorage mirror; permadeath wipe + newLife in place), 24 main (boot + loop)
- 07 veg hooks: GBLOCK set + grassBlocked(x,z,crop) in grassTile; plantedIn(ci,cj,keep) in genCell. 06 town hook: buildJob calls poiBuild(ctx, src.poi).
- lint: tools/lint.sh 00 01 ... 24 (ESLint 10 flat config in tools/lint/; no-undef etc.). Must be clean before building.
- game build: OUT=game.html python3 tools/build.py 00 01 ... 24 (excludes 99 test main). Test: tools/shot.py with --js "$(cat tools/gametest.js); $(cat tools/views1.js)" --shots N --js2 "__next()"
- publish needs capabilities {db:{}, user:{}} (save). v3 hot-reload snapshot dropped (only claude.use is promised).
- 2026-10-19 12:45 Baghdad: PUBLISHED v4 in place (artifact version id 1792403148-f45b) with capabilities {db:{}, user:{}}; 36 asset files (21.7 MB) under assets/…; v3 root files removed. Probe write/list/delete on data/users/me OK.
- Fixed before publish: r128 BufferAttribute.getComponent → getX/Y/Z; character height from skinned pose (skinnedBox); Michelle hips retarget + flip from soldier; terrain wet look; overcast sun glow; night ambient; shafts/bloom tone-down; snow/rain colours; default outfit without backpack; forest sun beams (BEAMS in 21_post); hot snapshot/ready boot (window.claude.hot) carries core+world save.
- Test helpers: tools/gametest.js (__go/__find/__views/__next), tools/views1..7.js, tools/mech.js, tools/stress.js; shot.py --settle N waits after each js2.

## Polish batch 2 (2026-10-19, published as artifact version 1792412457-0eaa)
- default outfit: dark field jacket/jeans/boots tint (a ≈ 0.9) over the Vanguard soldier (was beige armour)
- trees: aspen leaf layer recoloured green (tools/polish/green_aspen.py, original in build/leaves_orig.png); crownShade() gives leaf cards crown normals + aAO attribute (inner/under crown shade); leaves matt (spec ×0.3/0.4, roughness 0.9, envMapIntensity 0.55); SUNDIR_U now points TOWARDS the sun (back-light glow was inverted)
- grass: root AO, warm tips, translucency (uSunD), verge thinning near roads/towns (EDGE_PROBE), straw tufts in snow
- UBER: weathering (streaks, stains, foot grime via HGT_U half-float height texture), snow on up-facing surfaces via WINTER_GLSL (CLIMATE_U = TEXA.maps, temp < ~0.37 → permanent snow; SNOWC_U = storm snow cover); UBER_IN for interiors and player floors/furniture (no weather/snow)
- winter region (16 % of land, north-east taiga/alpine): terrain snow, snowy trees/bark/impostors/rocks, sparse straw grass
- camera never inside vehicles (camBlocked checks VEHICLES cols); POST NaN guards; POST.dbg getter
- perf: road ribbons hidden beyond ROAD_FAR (qsel 800/1200/2000/3000) with terrain painting far roads dark; shadow map every 2nd frame on tier ≤ 1
- test drivers: tools/views8..11.js, tools/perf.js (__census draw calls by category), tools/diag_*.js
- headless runs are tier 1 ('mid', phone tier) because 960×540 counts as small

## Batches 3–4 (published versions 1792414370-0428, 1792415040-4429, 1792415152-1280)
- sky clouds: CLOUD_TEX (512² tiling fbm baked once on GPU, RGB = base/detail/cirrus) instead of per-pixel fbm
- dusk: ENV.day = smooth(0, .3, e), ENV.night = smooth(-.05, -.22, e) → long golden hour + twilight
- impostors: bake on black transparent background, leaves write alpha 1, card shader divides by coverage (far forests no longer dark)
- rain: SPLASH (ring + crown instanced, CPU-placed with groundAt/waterAt, none indoors/snow); terrain puddle ripple rings (2 cell layers, subtle)
- reeds smaller (1.15) with dark cattail heads; tools/tex_ground.py now also makes poppy/lavender/daisy/buttercup (layers 16–19)
- wildflower fields: flowerField/flowerKind (vnoise) in grassTile; terrain shader replicates vnoise exactly (uint hash) to tint far fields subtly
- STRAIN levels (01_core setStrain; driven from updateDynRes when FPS < ~31 at render scale 0.6): grass range, view distance, shadow update interval, shafts
- shadow map: autoUpdate off, needsUpdate every max(SHADOW_EVERY, STRAIN.shadowEvery) frames
- texture files renamed to bust caches: assets/veg/ground_v3.webp, assets/veg/leaves_v2.webp (old names removed); stripToArray trusts the image's layer count
- leftover v3 files still published (unused): assets/grass.jpg, assets/sky.json, assets/soldier.json, assets/soldier_diffuse.jpg, assets/waternormals.jpg

## Batch 5 (published version 1792416134-de14)
- DETAIL2 (01_core): R plaster (copy of DETAIL), G lap siding (8 boards/repeat, butt joints), B stone masonry (6 courses, staggered blocks), A weave; UBER triDetail(sc) samples DETAIL2 (wood at 1.6× scale); DETAIL stays for terrain/roads/weathering
- UBER screen-space bump from the pattern (bumpN), fading out 25–60 m; tier 0 ('low') keeps only snow (no weathering, no bump)
- pfbm2/pnoise2: tiling fbm with separate x/y periods
- save: device copy always written; db write waits while busy; death wipe sets busy until deletes finish (8 s timeouts) then marks dirty → tools/savetest.py (mock db: save → reload → die → respawn during wipe → reload) passes
- tools/tierprobe.py <low|mid|high|ultra> <out.png> [js]: boot at a quality level via init script
- removed unused v3 files from the artifact (assets/grass.jpg, sky.json, soldier.json, soldier_diffuse.jpg, waternormals.jpg)

## Batch 6
- cows: Holstein coat shader (white hide, smooth black patches, model shading kept as brightness) — 'cowspots2'
- procedural cars rebuilt (13_vehicles carBodyGeo/carModel2): nose now at +z (the old extrusion faced backwards!), wheel arches cut into the silhouette, tumblehome per style (TUMBLE), rounded ends, tucked sill, smoothNormals(crease 52°), door seams/handles/black B-pillar, grille, plates, lamps at nose height; body/glass geometry cached per style
- wheels share geometry per size (_wheelGeo); removeVehicle disposes per-car geometries and lamp/tail material clones (was leaking with traffic)
- pickup: new BODY_STYLES.pickup (cab + covered bed, rails) via carModel2; jeep keeps the old open 4x4
- lakes: uShore = 1 mirrors dark shores near the horizon (less milky); ocean unchanged

## v5 phase 1: lobby, account, settings (2026-10-22)
- 25_account.js: ACCOUNT (8-digit id, name, level/xp with need = level×100, gold, gems with free cap 8, wardrobe of cosmetic item ids, look, workshop upg levels, lifetime counters `life`, best.surv, daily/weekly missions keyed by date/week seed with `base` snapshot of `life`, achievements tiers, training steps). Saved to localStorage `rock-island-account-v1` + db `data/users/<uid>/account` (newer `t` wins); never wiped on death. `track(stat, n)` feeds XP/missions; hooks in combat (kills/brutes/gun & melee multipliers), harvest (wood/stone/rocks/felled, tierMul × harvest upgrade), build, crafting, fishing, digging, treasure, hunting, eating, buying, driving (trackDrive per 100 m), survival seconds (+1 gold / 2 min).
- Clothes are account-owned: isCosmetic(it) = wear without armor/cap (helmets, vests, packs stay run gear). invAdd diverts cosmetics to the wardrobe; wearItem/takeOff update both INV.wearing and ACCOUNT.look; startKit/applySave call syncLookToRun(); accAbsorbRun() migrates older runs once. SUITS (slot 'suit', some for gems) override the clothing slots in outfitFromWearing(W).
- Character tint: mix weight now 1-(1-a)² (linear-light mixing made dark cloth over white plates look washed out); lum factor 0.42+lum×1.15.
- 26_settings.js + SET in 01_core (localStorage `rock-island-settings-v1`): fps cap (frame skip), render scale (×DYNRES), dyn-res toggle, foliage (grass radius), view distance, FOV offset, shadows (reload), bloom/rays (POST rebuild), sensitivity/aim/invertY, key rebinding (keyOf/actionOf), auto-climb (09_player ledge probe), vibration (buzz), volumes via AUDIO buses (sfx/amb/music/voice), 3D pan toggle, HUD toggles + --ui zoom, waypoints toggle, subtitles (#subs captions from AUDIO), colour-blind daltonize in POST comp (uCB), camera shake scale, reduce motion, aim assist (assistDir in 10_combat).
- 27_lobby.js: findLobbySpot (forest clearing near spawn, sun from the side, clear camera corridor, forest behind) + CLEARINGS (short grass) in grassTile; mannequin body (own makeBody, axe), lobbyPose camera (shift when a sheet is open, zoom), WEATHER.lock misty morning (hour 8.4), avatar = close-up rendered through POST and copied from the canvas; UI: profile, kills, gold/gems (+ → info / top-up «صفحة الشحن قيد التطوير»), settings/exit, left menu (friends placeholder, training, store), banners (assets/ui/*.webp), mode/map modal (other maps «قريباً»), play «كمل رحلتك» (fade → prepareAround(player) → begin with swoop), bottom tabs wardrobe/workshop/missions, copyright. toLobby() from pause/death. Lobby music (Hijaz pad) + lobby ambience in AUDIO.
- 28_signs.js: «مرحباً بك في …» boards where roads cross each settlement's radius+45 m (own canvas atlas, posts, collider).
- 18_npc.js: bots carry gamer tags, 8-digit ids and levels near yours (sprite nameplates, red when hostile); active count = QUALITY.bots + level/3 (pool +6).
- tools/uishots.py + tools/uiviews.js render the lobby pictures; tools/acctest.py = account end-to-end with mock db.

## v5 phase 2: friends and playing together (29_online.js)
- db docs (rules: each writes only its own, everyone reads): profiles/<uid> {gid, name, lv, look, ava (64 px jpeg), t}; links/<uid> {out:[uid]} (friendship = both ways); invites/<uid> {to:[uid], room 'w-<gid>', gid, name, t}; worlds/<uid> {json (snapshotWorld), pos, hour, t}.
- capabilities to publish: db rules [{profiles,read view,write owner},{profiles/{self},write interact}] ×4 prefixes + user {} + room {topics: {invite: interact, act: interact}}.
- room: lobby presence {gid, where}; 'invite' topic for live invites; named room 'w-<hostGid>' per party: presence carries the player state 10×/s (x,y,z,yaw,spd,veh,look,name,lv,host,where), 'act' topic carries world edits (b+ rec with nk, b- nk, dig, fell, rock, shot, go).
- HOOK table (25_account) is filled by 29: built/unbuilt/dug/felled/rock/shot/start/frame/lobby/init/ava/play. SAVE.guest: no world writes while visiting; leaving a party reloads the page (own world from its record).
- tools/nettest.py: two pages, mock db (localStorage + BroadcastChannel) and mock room, per-user storage prefix.

## v5 phase 3 plan: maps
- MAPS_DEF in 01_core chosen from localStorage 'rock-island-map' before any shader is built; shader literals 4096/8/1025/1023 → MAPDEF; WN/WSTEP/WHALF/PLAY, terrain quadtree root, MAP_W, chart clamps, save keys per map, loadWorld dir.
- generator: tools/wg common.py reads MAP env (N, WORLD, PLAY, OUT, DST); per-map stage 1 (shapes), 5 (places), 7 (biomes).

## v5 published so far (2026-10-22)
- Version 10 (1792675582-418a): phase 1 lobby. Version 11 (1792676491-5874): phase 2 online with capabilities db rules (profiles/links/invites/worlds: read view, write owner + {self} interact), user {}, room topics invite/act at interact.
- Saves: world doc packed (deflate+base64 {z}) via worldBody/worldFromBody in 23_save; core write errors no longer disable world saving and vice versa.
- Fixed: BLOBS contact-shade shader had a // comment swallowing gl_Position (never rendered before); lbtn svg size; preview look reset on sheet switch.

## v5 phase 3: maps (in progress)
- Engine: MAPS_DEF/MAP_ID/MAPDEF in 01_core (localStorage 'rock-island-map', ?map=<id>&dev=1 for tests), GL_* literals in shaders, WN/WSTEP/WHALF/PLAY/HSC from MAPDEF, TERRAIN_ROOT, MAP_W = 2*WHALF, chart span by size, per-map save keys (SAVE.key + '-<map>', db docs save-<map>/world-<map>), lobby map picker → switchMap() reload, LOBBY_CFG per map for the lobby spot, MAP_BLURB intro text, refreshTips per map, WEATHER.climate (W_NEXT_BY: desert sand storms, snow blizzards, water squalls, forest mists) + dust fog + sand particles (RAIN uSand).
- Terrain classes: 8 ice (frozen lakes, walkable, bare ice), 9 lava (glow via tGlow emissive, damage in 30_features), 10 ash (dark, dead trees only).
- 06_town: water buildings (o.water, footprintO, WALK_Y 2.0), props walk/deck/ship (cargo + war, walkable decks, gangways, hull colliders), rboat → rideable boats (13_vehicles), ruin style (no glass/lights, broken roofs, bent poles), SHIPS list.
- 18_npc: armBot refactor, GUARD_SPOTS from extras.guards (respawn 90-150 s, hold post, 75 m aggro).
- 05_roads: streamed runs (built within ROAD_FAR, dropped beyond ×1.35), polesOf/powerLine per run, rail kind 3 (ballast/sleepers shader + steel rails), tunnels (walls+roof+portals+lamps over deep cuts), suspension bridges (r.sus).
- 30_features.js: VOLCANO (smoke sprites, glow light, rumble), lava damage, FOW fog of war (256² mask, towers reveal 3.6 km, packed in core save), TRAINS (rail roads with train/cart flags), regional climate for mega.
- 29_online: invites carry map; accepting a different map switches map via sessionStorage 'rock-island-join'.
- Generator: tools/wg/mg.py (stages land relief erode water places roads biomes export; MAP env; common.py GRIDS), specs tools/wg/maps/{desert,snow,forest,water,mega}.py; preview.py / preview_grid.py; outputs assets/maps/<id>/.
- Test drivers: tools/views_map.js, tools/views_water.js, tools/cardviews.js, tools/errprobe.py <page> <secs> [w h].

## v5 phase 3: verification (2026-10-22 afternoon)
- Tours: tools/views_map.js (generic), views_water.js, views_mega.js, views_snow2.js; contact sheets with tools/wsheet.py out.jpg --w 620 files...
- Snow fixes: crop colour overlay fades under snow (no dark furrow stripes in snowy fields), fewer dry tufts on snow (skip wk*0.93).
- Labs (mega, o.lab): furnish labbench/tank/console (glowing flasks, specimen tanks, screens via ctx.bulbs), sure armory loot, 3 guard posts per lab POI (18_npc initGuards).
- Lobby: 'مع الأصدقاء' mode now live (opens the friends sheet); maps banner 'خمس خرائط جديدة'; MAPS_READY = all six.
- Cards: tools/cards.sh <maps> (shot 0 = map lobby, shot 1 = cardviews __card()), tools/make_cards.py → assets/ui/map_<id>.webp 560x350 + ban_maps.webp slices.
- Publish file list: pub/files_v12.json (maps × 7 files + assets/ui).
- Train (30_features): drivable locomotive registered in VEHICLES as kind 'train' (VSPEC.train rail:true, root = loco mesh, v.train = tr); updateVehicles calls railVehicle() for rail specs; W/S throttle along the line (tr.sv, signed), jump brakes, buffers stop it; on exit the train coasts to a stop and resumes its timetable (tr.ai). Cars: 3 round colliders each (turn with the line), engine always at the +s end (pushes when backing; no flip at the termini), lateral/along hit test, AUDIO.trainHorn.
- Dead city: ruin buildings take soot-grey walls and dull trims (generator wall colours overridden), no awnings; parked cars become matte rusted wrecks (v.wreck, not enterable).
- Ice: darker clear/milky patches with white cracks, roughness 0.32 (0.08 made a white sky mirror), normals kept at 45 %.
- GLOW_MAT (vertexColors, always lit) + ctx.glow builder for coloured light (BULB_MAT ignores vertex colours).
- Test harness: freeCam must call TERRAIN.update(force) twice; one call leaves the previous view's chunks overlapping the new ones (terraces with striped skirt walls in shots).

## v13: the owner's Sketchfab models (2026-10-23)
- Sources: 17 zips in ../user_models (CC-BY 4.0, credited in CREDITS_SF, 24_main.js, rendered with links on the settings 'about' page). Not used: Jett, Judy Alvarez, Malenia, Tifa (owned game characters), the three spam re-uploads (provenance unknown), bschLABS (GIS diorama).
- Vegetation: tools/um_tree.py / um_strips.py → assets/veg/trees_extra.json (species 'plane' from Tree Animate), bark_albedo_v2 / bark_normal_v2 / leaves_v3 / ground_v4 strips (Realtime Grass, Meadow).
- Landforms (31_landforms.js): tools/um_scan2.py → assets/scans/crag.* (Peak cliff) and terraces.* (Terraced fields): terrain blends into them (LAND_ON, landTerrain/landTop), cars stop at rock faces, vegetation and rocks keep off.
- Field jeep: tools/um_car2.py → assets/models/uaz.json (UAZ 469 by zhe_kan): world-baked, wheels cut out (one mesh, four nodes, right ones mirrored), untextured parts merged into matte/satin/metal vertex-colour materials, welded + simplified (98k→25k body, 24k→2.9k wheel), crease normals, 8-bit normals/colours (KHR_mesh_quantization layout), lamps split front/rear. In game: gltfCar('uaz') (13_vehicles) with uazPaint (orange → paint, white → off-white, army olive all over: MIL_OLIVE at military parking), uazLamp emissive maps, wheel pivots made at load (08_assets loadCarModels). Ferrari/milk truck are no longer loaded (the old 'sports'/'truck' keys never matched, so they were never shown).
- Characters: tools/um_rig.py rigs a static model onto Michelle's skeleton: normalise (yaw, scale, ground, simplify), bend the scaled skeleton onto landmarks picked on tools/test/ortho_gltf.html views (tools/slices.py helps), weights = nearest bone *behind* the surface (normal test) on position-welded verts, stray islands and loose parts re-attached, triangles joining unrelated bones (fused contacts) cut, Laplacian smoothing; 'rigid' maps limbs onto trunk bones (bodies that only stand), 'loose' lets a coat skirt hang from the hips. tools/test/rig_test.html plays the soldier clips the game's way.
  - casual (Casual Look, restore50) and blonde (Blonde Confidence, Grauwolf): rigid-limb shopkeepers (makeKeeper: casual, soldier, blonde, michelle). Their hands are fused to their thighs in the scans, so walking is not possible without tearing.
  - hunter (Low Poly Midnight Shadow Hunter, iRahulRajput): full rig, coat loose; every fifth zombie body, always spawns as the brute (10_combat), no sick tint.
  - CHAR_DEF.scan: dressBody skips tints and props; REGION_RULES.scan.
- Pitfalls found in v13 testing: (1) three r128 reads normalised byte attributes raw on the CPU (BufferAttribute.getX), so uint8 WEIGHTS_0 made skinnedBox() measure a 480 m body and scale the keepers to millimetres: um_rig writes float weights. (2) A zero vertex normal becomes NaN in the vertex shader (normalize) and one NaN pixel spreads through the bloom into a black frame: um_rig/um_car2 replace zero normals, and the bloom bright pass drops non-finite colours (21_post).
- Terraces rim: the terraced fields are a clean rectangle in their own space (F.box from the field); landRim(x,z) gives a wavy 4–18 m band where the land's own grass covers the scan (landTerrain lifts the ground RIM_UP over the scan there, landTop/landKindAt treat it as off the scan, the shader discards the scan with the same formula). Terraces graded (0.34, 0.53, 0.2) × 0.5 to sit near the island's grass.
- Published Version 13 (1792752362-88a1), 2026-10-23: pub/files_v13.json (41 files: veg, scans, ui cards, uaz + uaz_lo, casual, blonde, hunter). All six maps probed without errors (tools/errprobe.py "game.html?map=<id>&dev=1"). Jeep far level: uaz_lo.json (5k body + 0.6k wheel, no textures; borrows uaz's materials by name), THREE.LOD switch at 45 m.

## v14: the big batch (2026-10-23/24) — PUBG-style meta, drop, weapons, the owner's second model batch
- New modules: 32_crates (death crates, loot list, auto-loot), 33_arsenal (all chart weapons, attachments, loot, botKit, PROP_MELEE blades), 34_gunmodels (procedural guns; a gun with WEAPONS[id].prop uses the artist model), 35_throw (frag/C4/flare), 36_plane (cargo plane, free fall, parachute, supply drops), 37_meta (rarities, crate outfits, chutes, weapon skins + 7-level upgrades, crates, 63 titles, missions + activity chests), 38_lobby2 (crate UI/opening, upgrade bench, titles, deals, materials, first run), 39_clans (db 'clans'/'clanmembers'), 40_rooms (lobby backdrops).
- Lobby rooms (40_rooms): SET.lobbyBg 'hall' | 'museum' | 'island' (button #lbBg cycles). A room is its own THREE.Scene in VIEW.scene (01_core); POST.render draws VIEW.scene || scene; simulate() stops streaming the island while VIEW.scene is set (only ENVMAP updates). Room meshes = um_scan5 LOD0 (assets/rooms/kingshall.*, hintze.*), MeshBasicMaterial (light baked in the scan), floor found by a raycast at the spot; ROOMS[id] sets spot/phi/fov/camY/lookY/dist/maxDist (lobbyPose reads them from LOBBY.spot).
- tools/um_scan5.py: scans → landform/room assets that keep detail: weld (seams ignored) → simplify LODs → xatlas charts (tools/xunwrap: mode bit 2 passes maxCost + resolution; chartCost 6, gutter 2 roughly doubles texel use) → every texel samples the closest point of the full scan (8 candidate triangles by centroid, barycentric uv, the scan's own textures incl. udim tiles and flat colours of untextured parts). Options: drop, srcMax, interior (floor grid + wall mask + roof grid for walk-in buildings), hfOnly (redo only the grid). um_scan3/um_scan4 were experiments (projection bake / original-atlas) — use um_scan5.
- Landforms now: crag, terraces, cathedral (by a town), fortress (ridges), street (after-the-rain old town, interior grid), warehouse (walk-in, doors removed so they are openings). LAND_BYTOWN kinds use byTown(); interior kinds: landTop(x, z, y) returns the floor, wall cells +3.2 m, and the roof when y is above it (parachute landings); groundAt/canStep pass y. LAND_NAMES feed zoneAt().
- tools/um_prop.py: hand props → one mesh + one atlas (colour/normal/metal-rough), rot/len/grip|gripLow/at/drop/weld:'pos'. Node extras carry muzzle/len. assets/models: w_ak (Rainier AK → AKM), w_9mm (→ P92), m_knife/m_axe/m_jian/m_bardiche/m_battleaxe/m_ornate (PROP_MELEE items mw_*: hit/swing/reach per item). 08_assets propMesh() loads lazily; PROP_WAIT rebuilds what is in hand; skinPaint tints textured guns.
- Characters (casual, blonde): full rig now (no 'rigid' limbs, feet rigid to calves). um_rig colorSplit (skin vs cloth in the hand/thigh band, bareArms: no cloth on forearms/hands below the elbows, midriff kept on the trunk), Arm–Spine pairs allowed (armpits stretch instead of tearing), boundary-loop hole filling (undirected walk, branch-aware, wound to the surface). charMaterial draws scans double-sided so cut seams show cloth. stancePose resets the hips to rest when no clip drives them (crouch no longer sinks every frame).
- Terrain: TERR_OPT.vk moves the climate reads (uMaps + four uIds texel fetches + 14 indicator weights) into the vertex shader (5 varyings).
- Damaged uploads (not used): massive_scale_model_of_ancient_rome (scene.bin broken), futatsugoya tunnel (3 of 12 textures missing); the warehouse's two missing wall textures were replaced by its other brick texture (tools2/fixmissing.py).
- v14 test pass 2 (2026-10-24): tools/game3.js (HUD, stances, scope, prop guns/blades, crate list, chart, plane/free fall/chute/landing,
  landmarks) ran clean. Fixes from it: #scopeOv moved to the first child of #hud (it was inside .hud-in after the controls, so its
  black ring hid the fire button and stopped 16 px short of the edges); dropCamera eases to 13 m and looks 1.8 m higher under the
  canopy (DROP.camD/camUp); crate hero art was wiped by hero.querySelector('span') (the art is a span) → '.cr-info span';
  the chart's «علامة» stays without dev teleport.
- Building scans (cathedral, fortress) are scanned from outside: hf is their roof/tower surface. landTerrain now reads F.G, the
  grid opened by LAND_OPEN metres (gridMinMax min then max), so the island's ground no longer rises in grass cones round the towers.
- shot.py waits: use U="(typeof LOBBY!=='undefined'&&LOBBY.on)||window.__err"; "window.BOOT&&BOOT.ready" never holds (BOOT is a
  const, not a window property) and costs the full --timeout.
- Placement: a building kind keeps the plan's gap only from its own kind (t.R + R + 250 from others); the 2–3 km gaps counted
  against every crag/field had left the island without the fortress and the street. LAND_BYTOWN kinds try byTown first, then
  any open ground away from towns; the street's edge fit allows 0.05 × its height. Crags and terraces are placed exactly as in v13.
  Island now: cathedral −2019,−946 · street −1661,−1544 · warehouses −2262,−1254 / −372,−3018 · fortress 2500,766. Water: none.
- The street's houses are solid blocks without floors, so its interior floor grid holds their roofs: LAND_OPEN.street = 9.
  The fortress has cliffs of its own: LAND_ERODE.fortress = 6 m steps the ground back from every drop (insideDist blends it in
  from the scan's edge), so the island's coarser ground no longer leans out of the rock as a white sheet.
- Warehouse rebaked (tools2/bakeE.sh): tools2/fixwall.py rebuilt mur-droite and briques-ss-fenetre from the rows that decode
  (LOAD_TRUNCATED_IMAGES; the rest mirror-repeated, a stain patched), tools2/regltf.py → user_models2/warehouse/scene_fix2.gltf;
  dropped pandagun, graffiti and cardboard (BLEND decals that baked as black-and-white squares).
- Scope: the drop closes it (updateCamera), and the fire button keeps its icon while scoped.
- Published 2026-10-24: Version 14 (1792838429-13f6) = the v13 page + 40 asset files (weapons, rooms, cathedral);
  Version 15 (1792838865-71f5) = the v14 page + 21 files (fortress, street, warehouse, re-rigged casual/blonde) with
  capabilities db 12 rules (profiles/links/invites/worlds/clans/clanmembers), user {}, room topics invite/act at interact.
  170 published files. Re-publishing files published before a context reset needs an Artifact read of them first.
- Version 16 (1792848427-7260): the landmarks are findable — landmarks() in 22_hud lists LAND.list kinds named in LAND_NAMES
  (numbered when a kind stands twice); purple 'land' tower glyph + name on the big map (always, not behind the fog), on the
  minimap, and the nearest within 2.5 km on the compass; #chartLands in the map's legend: tap one → map centres on it, the pick
  sits 0.85 R out on your side facing it (teleportTo(x, z, face)); lobby banner «معالم حقيقية على الخرائط» (assets/ui/ban_lands.webp).
- v17 (2026-10-24): the game is now «Call of Survival» (title, logo, footer, about; «جزيرة الصخرة» stays the first map's name).
  Boot screen (#intro): assets/boot/intro.(webm|mp4) = warp 2.5 s + first second of the fall out of white; loop.(webm|mp4) =
  fall seconds 1–15 with its last second cross-faded into 0–1 (seamless native loop). VP9 WebM first, H.264 MP4 fallback
  (headless Chromium has no H.264/AAC). BOOTFILM (01_core) switches intro→loop, adds #intro.titled ~2.3 s into the film,
  stops and frees both on lobby/begin, plays again on exitToTitle (#intro.menu lifts the logo over «ادخل»). The thin line
  (#loadTrack/#loadBar, LTR) is the only progress; #loadNote is screen-reader only unless .err. Data saver: still.jpg.
  The lobby waits until BOOTFILM.shown() (4.2 s from script start) so the name is seen once.
  Film: tools/boot_scene.html (three r128; planet maps tools/planet_tex.py → build/boot, procedural city lights in cells with
  value-noise clusters, atmosphere by closest approach of the ray to the ground, warp shader), tools/render_boot.py renders
  frames (FN=renderWarp|renderFrame, QS=rot=0.1667, LOOP=14) at 1920×1080, tools/make_boot.py cuts/encodes 1280×720.
  Music: tools/space_music.py → assets/audio/theme.(m4a|ogg) (64 s, built on a circle: notes wrap, drone/wind periodic,
  circular-convolution hall → no seam) and sting.(m4a|ogg). 20_audio THEME: fetched 4 s after load or on the first tap,
  decoded once the AudioContext exists; the synthesised pad plays until then and hands over (musicSwap); the sting plays once
  when the music first starts. AUDIO.theme exposes state for tests. The owner's TikTok clips and the song were not used
  (others' content); the film and music are original to the game.
- v18 (2026-10-30): وضع التطوير — the world editor, from the pause menu («وضع التطوير»). Modules 41_edcore (records, kinds
  ED_T: mesh prefabs, tree, rock, land, house, villa, lake, shape, veh, body, animal, pickup, crate, umodel; zones that clear
  trees/rocks/grass, ED_HOOK veg/rocks/grass, edTouch/edFlush rebuild), 42_edui (editor camera EDC, picking, outline, undo/redo,
  terrain brush EDB raise/lower/flat/smooth/rough, planting brush EDE trees/grass/flowers/erase/restore, catalogue with
  thumbnails assets/ui/ed/<key>.webp from tools/ed_thumbs.py, pointer/touch handling, edEnter/edLeave(test)), 43_edsave
  (devworld/<MAP_ID> db doc(s) deflate+base64 in 240 kB parts, owner writes, everyone reads; localStorage copy; draft offer;
  ED.orphans keeps records whose kind is missing), 44_edup (uploads, below). 02_world: EDS shapes, EDT brush chunks, EDP pads,
  'oramp' platforms, 'g' grid platforms/colliders (edGridY/edGridPush in 44).
- Uploads from the device (44_edup): catalogue tab «من جهازك» (cat 'upl') + «رفع» button in the sheet header + files dropped
  on the editor. .glb / .gltf (+ .bin + pictures, loose or in a .zip, Sketchfab layout) / .obj (+ .mtl) / .fbx (three r128
  OBJLoader/MTLLoader/FBXLoader + GLTFExporter, fetched from jsdelivr when first needed; Draco through DRACOLoader). Pipeline:
  zip read in-page (central directory, deflate-raw via DecompressionStream, fflate fallback) → one glTF + one binary (upFlat)
  → every picture decoded, ≤2048 px, re-encoded WebP (JPEG/PNG where the browser cannot write WebP; kept as is when that is
  smaller) and put back into the binary (upAssemble; unreferenced views emptied) → GLB parsed with GLTFLoader, measured,
  studio thumbnail (upStudio) → GLB deflated, base64, text/plain parts ≤15 MiB + thumbnail through the `assets` capability
  (owner/editors) with a record db doc devmodels/<mid> {n, b:[ids], z, th, by, tr, sz, u, an, ext, t}; without assets
  (another viewer, or no runtime) the same goes to IndexedDB 'cos-models' (stores blobs, recs; refs start with 'L').
  Units: u = 0.01 when FBX/OBJ > 30 or anything > 250 units (centimetres), else fitted. Kinds U_<mid> (type 'umodel'):
  size ×0.02–50, «اقلبه» (o.up: 6 turns), animations through «var» (o.c: 0 still, n = clip n), collision o.col 0 none /
  1 box + top platform / 2 exact (upGrid: triangles on a grid in metres, cell max(size/150, 0.1): floors |ny|>0.7 → up to 6
  levels a cell, walls → up to 4 height intervals; edGridY gives the highest level ≤ feet+STEP_UP, bilinear on one surface,
  editor queries (y>5000) the highest within 1.2 m of the base; edGridPush pushes out of cells whose walls cross knees–head
  (feet+0.5…+1.7)), o.pad levels the ground under it (default for exact models ≤ 80 m).
- Tests: tools/scenario.py (steps js/frames/wait/until/tap/drag/key/reload/shot; --cloud = stand-in runtime: assets, db, user
  through exposed bindings, /_blob/ served by the script), tools/edt/u1.json (local uploads: glb, obj, Sketchfab-style zip,
  meshopt error, save, reload), u2.json (cloud: two at once, save to db, reload from db, test mode), s3.json (editor touch).
- PUBLISHED 2026-10-30: Version 18 (1793352523-0bf7), capabilities db rules (the 12 + devworld + devmodels: read view, write owner), assets {}, user {},
  room topics invite/act at interact. Files: index.html + assets/ui/ed/*.webp (196) + assets/rooms/kingshall.json, hintze.json.
- Android app (2026-10-30): this repository (github.com/oo9ee9-cpu/call-of-survival.) holds the game (game/), its source (src/,
  tools/) and the app (android/). Release v18 (tag created by the owner on GitHub; this session cannot push tags) built
  CallOfSurvival.apk (110 MB, signed with android/release.p12, password in the repository variable KEY_PASS). Later versions
  reach installed apps over the air: tools/release.sh <N> (files committed, version.json → that commit, pushed to main).
  See CLAUDE.md.

## v19: ground materials, painting, digging, the internet's libraries (2026-10-31)
- 45_gmat: ground materials. Records GMAT.recs {id, n, a/nm/r/ao/h/arm (file refs), gloss, dx, th, px, m (metres one picture
  covers), cr (credit), t}: db devmats/<id> (owner) or IndexedDB 'cos-models' store 'mats' (version 2). Files are kept as they
  came: images ≤ 19.5 MiB as image assets, bigger ones as base64 text parts ('T:' + ids), local 'L…' blobs. On the GPU: two
  TEXTURE_2D_ARRAYs made with raw WebGL2 (texStorage3D, texSubImage3D per layer, generateMipmap) and handed to three as
  DataTexture2DArray(version 0) via renderer.properties.get(tx).__webglTexture; colour (×AO) + roughness in A, normal (GL,
  DX flipped) + height in A; layer size gmSize() = SET.gmRes or qsel(512, 1024, 2048, 2048/4096); arrays grow by 4 layers,
  old layers copied on the GPU (copyTexSubImage3D from a READ framebuffer, then renderer.resetState()).
- GP (02_world): painted ground, 0.5 m points in 64 m tiles {id (0–7 palette slot), w (0–255)}; levels l1 (2 m), l2 (8 m),
  l3 (tile) for far chunks; gpWeights(x, z, st) bilinear. GMAT.pal: the world's 8 materials ('b:L' the game's layer L, or
  'm:id'); GMAT.base: the game's 12 layers replaced over the whole map. Saved in the dev world as D.gm {pal, base, p: tile key
  → base64 runs (n, id, w)}. Undo ops 'gp' (tile snapshots) and 'gb' (a base layer).
- 03_terrain: chunk geometries carry aPw0/aPw1 (8 painted weights, Uint8 normalized) and aDig (dug depth /4 m); marks() fills
  them only where paint or holes are (st ≤ 64 / ≤ 4). Shader: uUAlb/uUNrm, uUS (1/m per layer), uRemap[12] (the game's
  layer → user layer), uPal[8] (100 + L for the game's layers); textureGrad with gDx/gDy (dFdx of world xz) for user layers;
  the two strongest painted weights blended with hmix (height-led edges); dug ground shows soil (layer 5), clay (11, tinted)
  where damp/deep, sand (7) in deserts and beaches, darker with depth. Finer chunks near holes (8 m = 25 cm) and paint (16 m).
- Digging (02 addCrater): a stroke within 0.5 m of a hole deepens it (r = max(r, 0.7 + 0.42·d), the middle drifts 25 % to the
  stroke): one record per hole; digWhy stops at 40 m. 
- Editor «أرضية» tool (paint): material chip → catalogue tab «خامات الأرض» (gmCards: upload, internet, your materials, the
  game's 12, «أرضية الخريطة كلها» = tap a layer then a material); modes ارسم/احفر/ارفع/سوِّ/امسح الرسم (edBrushStep with a
  mode for the land), sliders for size/strength, «حجم الصورة على الأرض» (R.m) for your materials, «السحب يحرّك الدائرة» +
  hold «طبّق هنا». The uploader sends files without a model to gmFiles (maps found by name: Color/Albedo/Diffuse,
  NormalGL/DX, Roughness/Gloss, AO, ARM, Displacement; previews skipped).
- 44_edup now keeps every picture as it came (GIF/BMP → PNG); upFitGpu() scales only the copy drawn on this device (cap
  qsel(1024, 2048, 4096, 8192) ≤ MAX_TEXTURE_SIZE). Models keep R.cr (site, author, licence).
- 46_netlib «مكتبات الإنترنت» (libOpen('mat'|'model')): ambientCG (API v3 assets + include, files ambientcg.com/get?file=
  ID_<n>K-JPG.zip), Poly Haven (api.polyhaven.com/assets?t=textures|models, /files/<id>: Diffuse/nor_gl/Rough/AO/
  Displacement by 1k–8k; gltf + include), Sketchfab (api.sketchfab.com/v3/search?type=models&downloadable=true, /v3/models/
  <uid>/download with «Authorization: Token» — SET.sfTok on the device only; glb preferred, else the gltf zip), free3d (site
  in the app's browser). libFetch goes through /_net/get?u= when /_app/info says the app can (Android shell 2), else plain
  fetch (sites without CORS refuse). Credits of everything imported: settings → حول (libCredits).
- Android shell 2: /_app/info, /_net/get (GET https, X-Cos-Auth → Authorization on the first host only, redirects followed by
  hand, X-Cos-Size), /_app/browse (Browser.java: a WebView over the game; downloads → files/lib/dl → cosAppEvent({t:'dl'})
  → the editor imports /_lib/dl/<name>, then /_app/libdel), UA + " CallOfSurvival/<v>", back button closes the library and
  steps back in the browser. Updater offers CallOfSurvival-lite.apk. version.json stays "shell": 1 (the page feature-detects).
- Tests: tools/edt/g1.json (paint, dig/raise with material, undo, catalogue), g2.json (shovel hole, material zip, paint with
  it, map-wide layer, save/reload), g3.json with --netmock (stand-ins for the three sites and the app's /_net, /_lib).
- PUBLISHED 2026-10-31: Version 19 (1793448165-592a), capabilities as v18 + devmats (read view, write owner). OTA: game/version.json v19
  (files at e2ba8ae). APK workflow run 41197662649 built shell 2 and replaced both APKs on release v18 (the newest; no v19 release).
