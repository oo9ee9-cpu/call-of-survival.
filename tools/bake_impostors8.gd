extends SceneTree
## Renders every valley tree (lod0) from the side into an atlas for the far ring of the forest:
## textures/v8/impostors.png (cells of 256 x 512, 9 per row) + data/valley/impostors.json {variant: [cell, width, height]}.
## The colours are unlit (albedo only, with the same tints the game's tree shaders use): impostor8.gdshader lights them
## with the game's sun, so the far forest follows the time of day and the weather.
## Needs a display (run under xvfb): godot --path <project> --script <abs>/tools/bake_impostors8.gd

const CW := 256
const CH := 512
const COLS := 9
# the same leaf tints as Valley.LEAF_TINT (autoloads, and so the Valley script, are not available in --script mode)
const LEAF_TINT := {"oak": Color(0.85, 0.95, 0.8), "ash": Color(0.88, 0.95, 0.82), "aspen": Color(0.9, 0.96, 0.8), "pine": Color(0.8, 0.9, 0.82), "plane": Color(0.88, 0.95, 0.8)}

var vp: SubViewport
var cam: Camera3D

func _init() -> void:
	_run.call_deferred()

func _run() -> void:
	var info: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://data/valley/trees.json"))
	var names := info.keys()
	names.sort()
	vp = SubViewport.new()
	vp.size = Vector2i(CW * 2, CH * 2)
	vp.transparent_bg = true
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	vp.msaa_3d = Viewport.MSAA_4X
	root.add_child(vp)
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_CLEAR_COLOR
	e.tonemap_mode = Environment.TONE_MAPPER_LINEAR
	env.environment = e
	vp.add_child(env)
	cam = Camera3D.new()
	cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	vp.add_child(cam)
	var rows := int(ceil(names.size() / float(COLS)))
	var atlas := Image.create(CW * COLS, CH * rows, false, Image.FORMAT_RGBA8)
	atlas.fill(Color(0, 0, 0, 0))
	var out := {}
	for i in names.size():
		var v: String = names[i]
		var sc: Node3D = (load("res://models/v8/%s.glb" % v) as PackedScene).instantiate()
		vp.add_child(sc)
		var mi: MeshInstance3D = null
		for c in sc.get_children():
			c.visible = c.name == "lod0"
			if c.name == "lod0":
				mi = c
		var mesh := mi.mesh
		for s in mesh.get_surface_count():
			var sm := mesh.surface_get_material(s)
			var nm := sm.resource_name if sm else "bark_oak"
			var m := StandardMaterial3D.new()
			m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
			if nm.begins_with("bark_"):
				var b := nm.substr(5)
				m.albedo_texture = load("res://textures/v8/bark_%s.jpg" % b)
				m.albedo_color = Color(0.82, 0.78, 0.72) if b != "birch" else Color(1, 1, 0.97)
			else:
				var l := nm.substr(5)
				m.albedo_texture = load("res://textures/v8/leaf_%s.png" % l)
				m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA_SCISSOR
				m.alpha_scissor_threshold = 0.5
				m.cull_mode = BaseMaterial3D.CULL_DISABLED
				m.albedo_color = LEAF_TINT.get(l, Color(0.9, 0.95, 0.85))
				m.vertex_color_use_as_albedo = true
			mi.set_surface_override_material(s, m)
		var aabb := mi.get_aabb()
		var hgt := aabb.end.y
		var wid := maxf(aabb.size.x, aabb.size.z)
		var size := maxf(hgt, wid * 2.0) * 1.02
		cam.size = size
		cam.position = Vector3(0, size * 0.5, 60.0)
		cam.look_at(Vector3(0, size * 0.5, 0))
		for f in 4:
			await process_frame
		var img := vp.get_texture().get_image()
		img.resize(CW, CH, Image.INTERPOLATE_LANCZOS)
		var col := i % COLS
		var row := i / COLS
		atlas.blit_rect(img, Rect2i(0, 0, CW, CH), Vector2i(col * CW, row * CH))
		out[v] = [i, size * 0.5, size]
		sc.queue_free()
		await process_frame
	# dilate colour under transparent pixels so mipmaps do not darken the edges
	atlas.fix_alpha_edges()
	atlas.save_png("res://textures/v8/impostors.png")
	var f := FileAccess.open("res://data/valley/impostors.json", FileAccess.WRITE)
	f.store_string(JSON.stringify({"cols": COLS, "rows": rows, "cells": out}))
	print("impostors baked: ", names.size())
	quit()
