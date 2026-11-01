extends SceneTree
## Turns the generator's output (heights as raw float32, layout as JSON) into Godot resources in res://data/.
## usage: godot --headless --path <project> --script <abs>/tools/bake.gd -- <build_dir>

func _init() -> void:
	var b: String = OS.get_cmdline_user_args()[0]
	var t0 := Time.get_ticks_msec()
	var base := _img(b + "/base_h.f32", 1537)
	var war := _img(b + "/war_h.f32", 2049)
	_save(base, "res://data/base_h.res")
	_save(war, "res://data/war_h.res")
	var lay: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(b + "/layout.json"))
	var meta: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(b + "/dugout_meta.json"))
	lay["props"] = _pack2(lay["props"])
	lay["veg"] = _pack2(lay["veg"])
	lay["impostors"] = _pack1(lay["impostors"])
	lay["colliders"] = _pack1(lay["colliders"])
	lay["water_discs"] = _flat(lay["water_discs"])
	lay["water_strips"] = _flat(lay["water_strips"])
	meta["colliders"] = _pack1(meta["colliders"])
	lay["dugout_meta"] = meta
	var res := Resource.new()
	res.set_meta("layout", lay)
	_save(res, "res://data/world.res")
	print("bake done in %d ms" % (Time.get_ticks_msec() - t0))
	quit()

func _save(r: Resource, path: String) -> void:
	var err := ResourceSaver.save(r, path, ResourceSaver.FLAG_COMPRESS)
	if err != OK:
		push_error("save failed %s: %d" % [path, err])
	else:
		print("saved ", path)

func _img(path: String, n: int) -> Image:
	var bytes := FileAccess.get_file_as_bytes(path)
	assert(bytes.size() == n * n * 4)
	return Image.create_from_data(n, n, false, Image.FORMAT_RF, bytes)

func _pack1(d: Dictionary) -> Dictionary:
	var out := {}
	for k in d:
		out[k] = PackedFloat32Array(d[k])
	return out

func _pack2(d: Dictionary) -> Dictionary:
	var out := {}
	for k in d:
		out[k] = _pack1(d[k])
	return out

func _flat(a: Array) -> PackedFloat32Array:
	var out := PackedFloat32Array()
	for row in a:
		out.append_array(PackedFloat32Array(row))
	return out
