extends SceneTree
## A model from four sides on one sheet (front, right, back, three quarters), to check a model by eye:
##   godot --path . --resolution 512x640 --script res://tools/preview_model.gd -- res://models/x.glb <out.png> [anim] [t]
## The front is +Z unless the model says otherwise; [anim] plays that clip and stops at [t] seconds.

func _initialize() -> void:
	_run.call_deferred()

func _aabb(n: Node, xf: Transform3D, acc: Array) -> void:
	if n is MeshInstance3D and (n as MeshInstance3D).mesh:
		var mi := n as MeshInstance3D
		# a skinned mesh is drawn where its bones put it: its own numbers are already the model's
		var b := mi.get_aabb() if mi.skin != null or mi.get_parent() is Skeleton3D else (xf * mi.transform) * mi.get_aabb()
		acc.append(b)
	for c in n.get_children():
		_aabb(c, xf * ((n as Node3D).transform if n is Node3D else Transform3D()), acc)

func _run() -> void:
	var args := OS.get_cmdline_user_args()
	var path := String(args[0])
	var out := String(args[1])
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.32, 0.34, 0.36)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.55, 0.57, 0.6)
	env.ambient_light_energy = 0.7
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	var we := WorldEnvironment.new()
	we.environment = env
	root.add_child(we)
	var sun := DirectionalLight3D.new()
	sun.light_energy = 1.5
	sun.shadow_enabled = true
	root.add_child(sun)
	sun.rotation = Vector3(deg_to_rad(-45), deg_to_rad(30), 0)
	var model := (load(path) as PackedScene).instantiate() as Node3D
	root.add_child(model)
	if args.size() > 2:
		var aps := model.find_children("*", "AnimationPlayer", true, false)
		if aps.size() > 0:
			var ap := aps[0] as AnimationPlayer
			print("ANIMS ", ap.get_animation_list())
			ap.play(String(args[2]))
			ap.seek(float(args[3]) if args.size() > 3 else 0.0, true)
			ap.pause()
	await process_frame
	await process_frame
	var acc := []
	for c in model.get_children():
		_aabb(c, model.transform, acc)
	var box: AABB = acc[0] if acc.size() > 0 else AABB(Vector3(-1, 0, -1), Vector3(2, 2, 2))
	for b in acc:
		box = box.merge(b)
	print("AABB ", box)
	var c := box.get_center()
	var r := box.size.length() * 0.5
	var cam := Camera3D.new()
	cam.fov = 30.0
	root.add_child(cam)
	cam.current = true
	var sheet := Image.create(1024, 1280, false, Image.FORMAT_RGB8)
	var views := [Vector3(0, 0, 1), Vector3(1, 0, 0), Vector3(0, 0, -1), Vector3(-0.7, 0.25, 0.7)]
	for i in 4:
		var d: Vector3 = (views[i] as Vector3).normalized()
		cam.look_at_from_position(c + d * r * 3.9, c, Vector3.UP)
		for f in 4:
			await process_frame
		await RenderingServer.frame_post_draw
		var img := root.get_texture().get_image()
		img.convert(Image.FORMAT_RGB8)
		sheet.blit_rect(img, Rect2i(0, 0, 512, 640), Vector2i((i % 2) * 512, (i / 2) * 640))
	sheet.save_png(out)
	print("PREVIEW ", out)
	quit()
