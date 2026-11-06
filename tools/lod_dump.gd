extends SceneTree
## The simplified index lists Godot's own level-of-detail maker (meshoptimizer) gives each mesh of a glTF file, with
## the vertices they index, for tools/trooper.py to cut the soldier down to what a phone can draw by the dozen.
## usage: godot --headless --script tools/lod_dump.gd -- <in.glb> <out.json>

func _init() -> void:
	var args := OS.get_cmdline_user_args()
	var doc := GLTFDocument.new()
	var st := GLTFState.new()
	var err := doc.append_from_file(args[0], st)
	if err != OK:
		push_error("cannot read %s (%d)" % [args[0], err])
		quit(1)
		return
	var out := {}
	for gm in st.get_meshes():
		var im: ImporterMesh = (gm as GLTFMesh).mesh
		im.generate_lods(60.0, 25.0, [])
		for s in im.get_surface_count():
			var arr := im.get_surface_arrays(s)
			var pos: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
			var uv: PackedVector2Array = arr[Mesh.ARRAY_TEX_UV] if arr[Mesh.ARRAY_TEX_UV] != null else PackedVector2Array()
			var flat := PackedFloat32Array()
			flat.resize(pos.size() * 5)
			for k in pos.size():
				flat[k * 5] = pos[k].x
				flat[k * 5 + 1] = pos[k].y
				flat[k * 5 + 2] = pos[k].z
				flat[k * 5 + 3] = uv[k].x if uv.size() > k else 0.0
				flat[k * 5 + 4] = uv[k].y if uv.size() > k else 0.0
			var lods := [Array(arr[Mesh.ARRAY_INDEX] as PackedInt32Array)]
			for l in im.get_surface_lod_count(s):
				lods.append(Array(im.get_surface_lod_indices(s, l)))
			var nm := String(gm.resource_name if gm.resource_name != "" else im.resource_name)
			out["%s#%d" % [nm, s]] = {"v": Array(flat), "lods": lods}
			print("%s#%d verts %d tris %s" % [nm, s, pos.size(), str(lods.map(func(a): return a.size() / 3))])
	var f := FileAccess.open(args[1], FileAccess.WRITE)
	f.store_string(JSON.stringify(out))
	f.close()
	quit()
