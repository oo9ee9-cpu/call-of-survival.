extends SceneTree
## Turns the valley generator's output (heights as raw float32, layout as JSON) into Godot resources in res://data/valley/.
## usage: godot --headless --path <project> --script <abs>/tools/bake8.gd -- <build8_dir>

func _init() -> void:
	var b: String = OS.get_cmdline_user_args()[0]
	var t0 := Time.get_ticks_msec()
	var lay: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(b + "/layout.json"))
	var n := int(lay["n"])
	var wn := int(lay["war_n"])
	_save(_img(b + "/base_h.f32", n), "res://data/valley/base_h.res")
	_save(_img(b + "/war_h.f32", wn), "res://data/valley/war_h.res")
	var veg := {}
	for k in lay["veg"]:
		veg[k] = PackedFloat32Array(lay["veg"][k])
	lay["veg"] = veg
	var res := Resource.new()
	res.set_meta("layout", lay)
	_save(res, "res://data/valley/world.res")
	print("bake8 done in %d ms" % (Time.get_ticks_msec() - t0))
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
