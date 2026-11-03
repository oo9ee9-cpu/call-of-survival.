extends SceneTree
## Dev tool: renders every model in a folder from the side (+X looking -X), the front (+Z looking -Z) and the top into a
## contact sheet, with a 1 m grid floor and an arrow along -Z, to check sizes and which way each model faces.
## usage: godot --path <project> --script <abs>/tools/sheet_models.gd -- <res folder> <out png> [cols]

const CELL := 256

func _init() -> void:
	_run.call_deferred()

func _run() -> void:
	var args := OS.get_cmdline_user_args()
	var dir: String = args[0]
	var out: String = args[1]
	var names: Array[String] = []
	var only: Array = args.slice(2) if args.size() > 2 else []
	for f in DirAccess.get_files_at(dir):
		if f.ends_with(".glb") and (only.is_empty() or only.has(f.get_basename())):
			names.append(f.get_basename())
	names.sort()
	var vp := SubViewport.new()
	vp.size = Vector2i(CELL, CELL)
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	vp.msaa_3d = Viewport.MSAA_4X
	root.add_child(vp)
	var we := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color(0.55, 0.62, 0.7)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(0.7, 0.7, 0.75)
	e.ambient_light_energy = 0.8
	we.environment = e
	vp.add_child(we)
	var sun := DirectionalLight3D.new()
	sun.rotation = Vector3(-0.9, 0.6, 0)
	vp.add_child(sun)
	var cam := Camera3D.new()
	cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	vp.add_child(cam)
	var arrow := MeshInstance3D.new()
	var am := BoxMesh.new()
	var amat := StandardMaterial3D.new()
	amat.albedo_color = Color(1, 0.1, 0.1)
	amat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	am.material = amat
	arrow.mesh = am
	vp.add_child(arrow)
	var sheet := Image.create(CELL * 3, CELL * names.size(), false, Image.FORMAT_RGB8)
	for i in names.size():
		var sc: Node3D = (load(dir + "/" + names[i] + ".glb") as PackedScene).instantiate()
		vp.add_child(sc)
		if names[i] == "tank":
			TankLook.dress(sc)
		var aabb := _aabb(sc, Transform3D())
		var size := maxf(aabb.size.x, maxf(aabb.size.y, aabb.size.z)) * 1.15
		var c := aabb.get_center()
		# arrow pointing to -Z, along the floor in front of the model
		am.size = Vector3(size * 0.02, size * 0.02, size * 0.3)
		arrow.position = Vector3(c.x, 0.0, aabb.position.z - size * 0.05)
		cam.size = size
		var views := [Vector3(1, 0, 0), Vector3(0, 0, 1), Vector3(0, 1, 0.001)]
		for k in 3:
			var d: Vector3 = views[k]
			cam.position = c + d * size * 2.0
			cam.look_at(c, Vector3.UP if k < 2 else Vector3(0, 0, -1))
			for f in 3:
				await process_frame
			var img := vp.get_texture().get_image()
			img.convert(Image.FORMAT_RGB8)
			sheet.blit_rect(img, Rect2i(0, 0, CELL, CELL), Vector2i(k * CELL, i * CELL))
		print("%-18s size %s  center %s" % [names[i], str(aabb.size), str(c)])
		sc.queue_free()
		await process_frame
	sheet.save_png(out)
	print("sheet saved: ", names)
	quit()

func _aabb(n: Node, xf: Transform3D) -> AABB:
	var out := AABB()
	var first := true
	var t := xf
	if n is Node3D:
		t = xf * (n as Node3D).transform
	if n is MeshInstance3D and (n as MeshInstance3D).mesh:
		var a := t * (n as MeshInstance3D).mesh.get_aabb()
		out = a
		first = false
	for ch in n.get_children():
		var a2 := _aabb(ch, t)
		if a2.size != Vector3.ZERO:
			out = a2 if first else out.merge(a2)
			first = false
	return out
