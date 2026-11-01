# Call of Survival: Front (Godot 4.7 test slice)

A 3 x 3 km bodycam test map: a burnt pine forest on a front line, crenellated fire trench with fire steps,
communication trenches and saps, three furnished dugouts, flooded shell craters, barbed wire, sandbags,
a power line, a dirt road with puddles, two burnt jeeps, and a battle going on in the distance.
Arabic interface (right to left), touch controls for phones, keyboard/mouse/gamepad on desktop.

**Download (zip, ~50 MB):** https://github.com/oo9ee9-cpu/call-of-survival./archive/refs/heads/godot-front.zip
— in Godot's Project Manager: Import → pick the zip → choose an empty folder → Import & Edit.

Instructions in Arabic: `README_AR.md` (التعليمات بالعربي). Credits and licences: `CREDITS.md`.

## Run
Godot 4.7 (tested with 4.7.2 official). Import `project.godot`, wait for the first import, press Play.
Every platform uses the Compatibility renderer (OpenGL 3.3 / OpenGL ES 3.0), the path everything was tested on.
The scripts also handle Forward+ (SSAO, SSIL and volumetric fog on the High/Ultra presets) if you change
Rendering Method, but that path has not been tested.

## How it is built
- `scripts/world/terrain.gd` + `shaders/terrain_clip.gdshader`: geometry clipmap; heights come from two float textures
  (`data/base_h.res` 3 km at 2 m, `data/war_h.res` 512 m at 0.25 m with the trenches), sampled with texelFetch and the same
  bilinear maths as the CPU; collision is streamed as HeightMapShape3D tiles around the player.
- `shaders/terrain_inc.gdshaderinc`: 8 ground layers (Texture2DArray) blended by height, splat maps for the map and the
  war zone, triplanar clay on trench walls, wetness.
- `scripts/world/veg.gd`: ~100k trees in three rings (detailed / light meshes / crossed cards), each instance drawn by
  exactly one ring (distance windows in the shaders through the global `view_pos`), GPU ground cover.
- `scripts/world/props.gd`: trench furniture as MultiMeshes, colliders as server-side boxes, dugouts with lights and an
  earth mound, power line catenaries, water, wrecks, a firing range with cans, bottles and steel plates.
- `scripts/player/`: chest-camera controller (bob, roll, step-up, ledge and ladder climbing), AK with recoil, flash,
  cases, reload, impacts and holes.
- `shaders/bodycam.gdshader`: barrel distortion, chromatic fringes, smear on fast turns, grade, vignette, grain.

## Regenerating the data (optional)
`tools/` holds the generators (Python 3 with numpy, scipy, Pillow; ffmpeg with libvorbis):
```
python3 tools/worldgen.py build .            # heights, masks, placements -> build/*.f32, build/layout.json
python3 tools/textures.py <assets> .         # texture sets (needs the game's original texture strips)
python3 tools/meshes.py <assets> . build     # every .glb + build/dugout_meta.json
python3 tools/sounds.py .                    # every .ogg
godot --headless --path . --import
python3 tools/import_settings.py . && godot --headless --path . --import
godot --headless --path . --script "$PWD/tools/bake.gd" -- "$PWD/build"   # -> data/*.res (absolute paths)
```
`build/` is a scratch folder; keep it outside the project or delete it afterwards.
`scripts/dev/autotest.gd` (run with `-- --autotest <dir>`) walks through the map and saves screenshots.
