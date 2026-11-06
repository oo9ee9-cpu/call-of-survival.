extends SceneTree
## Renders the lobby's pictures from the game's own models (run with a window, e.g. under xvfb):
##   godot --path . --resolution 1120x520 --script res://tools/render_ui.gd -- mode_card <out.jpg>
## mode_card: the transport helicopter in the evening sky (the mode card under «بدء»)

## an evening sky with soft clouds lit from the sun's side
const SKY := """
shader_type sky;
uniform float warm = 1.0;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
	vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { float a = 0.5; float s = 0.0; for (int i = 0; i < 6; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
void sky() {
	vec3 d = EYEDIR;
	vec3 top = mix(vec3(0.3, 0.45, 0.7), vec3(0.34, 0.46, 0.64), warm);
	vec3 hor = mix(vec3(0.78, 0.82, 0.86), vec3(1.0, 0.77, 0.5), warm);
	vec3 col = mix(hor, top, pow(clamp(d.y, 0.0, 1.0), 0.55));
	if (d.y < 0.0) { col = mix(hor, vec3(0.5, 0.42, 0.33), clamp(-d.y * 4.0, 0.0, 1.0)); }
	float sd = max(dot(d, normalize(LIGHT0_DIRECTION)), 0.0);
	col += vec3(1.0, 0.82, 0.55) * (pow(sd, 600.0) * 8.0 + pow(sd, 10.0) * 0.4 * warm);
	if (d.y > 0.0) {
		vec2 uv = d.xz / (d.y + 0.08) * 0.9;
		float c = smoothstep(0.42, 0.78, fbm(uv * 1.3 + vec2(3.0, 7.0)));
		float lit = 0.6 + 0.4 * fbm(uv * 1.3 + vec2(3.3, 7.2) + normalize(LIGHT0_DIRECTION).xz * 0.15);
		vec3 cc = mix(vec3(0.62, 0.52, 0.5), vec3(1.0, 0.9, 0.76), lit) * mix(0.85, 1.15, pow(sd, 2.0));
		col = mix(col, cc, c * 0.85 * smoothstep(0.0, 0.12, d.y));
	}
	COLOR = col;
}
"""

func _initialize() -> void:
	_run.call_deferred()

func _sky_env(sun_dir: Vector3, warm := true) -> void:
	var env := Environment.new()
	var sky := Sky.new()
	var ps := ShaderMaterial.new()
	var sh := Shader.new()
	sh.code = SKY
	ps.shader = sh
	ps.set_shader_parameter("warm", 1.0 if warm else 0.0)
	sky.sky_material = ps
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_energy = 0.9 if warm else 0.35
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.tonemap_exposure = 1.05
	env.fog_enabled = true
	env.fog_light_color = Color(0.95, 0.78, 0.58)
	env.fog_density = 0.0012
	env.fog_sky_affect = 0.25
	var we := WorldEnvironment.new()
	we.environment = env
	root.add_child(we)
	var sun := DirectionalLight3D.new()
	sun.light_color = Color(1.0, 0.86, 0.66) if warm else Color(1.0, 0.95, 0.86)
	sun.light_energy = 1.6 if warm else 1.3
	sun.shadow_enabled = true
	root.add_child(sun)
	sun.look_at_from_position(Vector3.ZERO, -sun_dir, Vector3.UP)

func _run() -> void:
	var args := OS.get_cmdline_user_args()
	var what := String(args[0]) if args.size() > 0 else "mode_card"
	var out := String(args[1]) if args.size() > 1 else "user://out.jpg"
	if what == "mode_card":
		_sky_env(Vector3(-0.7, 0.18, -0.6).normalized())
		var heli := (load("res://models/u/chinook.glb") as PackedScene).instantiate() as Node3D
		root.add_child(heli)
		heli.rotation = Vector3(0.05, deg_to_rad(-62.0), -0.08)
		var cam := Camera3D.new()
		cam.fov = 38.0
		cam.far = 4000.0
		root.add_child(cam)
		cam.look_at_from_position(Vector3(-5.0, -2.5, 30.0), Vector3(-3.5, 1.8, 0.0), Vector3.UP)
		cam.current = true
	elif what == "soldier":
		# the soldier up close, lit from the front: four of them side by side (outfits, the two vests, faces)
		_sky_env(Vector3(0.3, 0.55, 0.8).normalized(), false)
		var ground := MeshInstance3D.new()
		var pm := PlaneMesh.new()
		pm.size = Vector2(30, 30)
		ground.mesh = pm
		var gm := StandardMaterial3D.new()
		gm.albedo_color = Color(0.36, 0.33, 0.27)
		ground.material_override = gm
		root.add_child(ground)
		var cols := [Color(0.42, 0.46, 0.36), Color(0.62, 0.52, 0.38), Color(0.3, 0.36, 0.24), Color(0.45, 0.46, 0.5)]
		for i in 4:
			var s := Soldier.new()
			root.add_child(s)
			s.position = Vector3(-1.95 + i * 1.3, 0, 0)
			s.body_yaw = deg_to_rad([0.0, 35.0, 0.0, -35.0][i]) + PI
			s.aim_yaw = s.body_yaw
			s.low_ready = 0.7 if i % 2 == 1 else 0.0
			s.set_outfit.call_deferred(cols[i])
		var cam := Camera3D.new()
		cam.fov = 34.0
		root.add_child(cam)
		cam.look_at_from_position(Vector3(0, 1.25, 7.6), Vector3(0, 1.0, 0), Vector3.UP)
		cam.current = true
	elif what == "banner":
		# the login reward's picture: a soldier from behind, looking at the broken city
		_sky_env(Vector3(-0.4, 0.35, -0.85).normalized(), true)
		var ground := MeshInstance3D.new()
		var pm := PlaneMesh.new()
		pm.size = Vector2(600, 600)
		ground.mesh = pm
		var gm := StandardMaterial3D.new()
		gm.albedo_texture = load("res://textures/v8/terrain_albedo.jpg")
		gm.albedo_color = Color(0.75, 0.68, 0.6)
		gm.uv1_scale = Vector3(60, 7.5, 1)
		ground.material_override = gm
		root.add_child(ground)
		for r in [["b/apartment", Vector3(-14, 0, -48), 0.2, Vector3(1.5, 2.4, 1.5)], ["b/ruin", Vector3(6, 0, -60), 0.9, Vector3(1.6, 3.0, 1.6)],
				["u/res_multistory", Vector3(22, 0, -80), -0.3, Vector3(1, 1.1, 1)], ["b/ruin", Vector3(-34, 0, -75), 0.4, Vector3(1.5, 2.6, 1.5)],
				["b/apartment", Vector3(40, 0, -66), 0.5, Vector3(1.4, 2.8, 1.4)], ["b/ruin_small", Vector3(-4, 0, -30), 0.1, Vector3(1.2, 1.4, 1.2)]]:
			var n := (load("res://models/%s.glb" % String(r[0])) as PackedScene).instantiate() as Node3D
			root.add_child(n)
			n.position = r[1]
			n.rotation.y = float(r[2])
			n.scale = r[3]
		var s2 := Soldier.new()
		root.add_child(s2)
		s2.position = Vector3(-1.2, 0, 0)
		s2.body_yaw = 0.35
		s2.aim_yaw = 0.35
		s2.low_ready = 0.8
		s2.set_outfit.call_deferred(Color(0.46, 0.48, 0.4))
		var cam := Camera3D.new()
		cam.fov = 42.0
		cam.far = 2000.0
		root.add_child(cam)
		cam.look_at_from_position(Vector3(0.6, 1.5, 3.2), Vector3(-0.6, 2.2, -20), Vector3.UP)
		cam.current = true
	elif what == "tree":
		_sky_env(Vector3(0.3, 0.55, 0.8).normalized(), false)
		var ls := LobbyScene.new()
		root.add_child(ls)
		ls._trees()
		for c in ls.get_children():
			for mi in c.get_children():
				if mi is MeshInstance3D:
					for i in (mi as MeshInstance3D).mesh.get_surface_count():
						var sm := (mi as MeshInstance3D).mesh.surface_get_material(i)
						print("TREE ", c.name, " ", mi.name, " surf ", i, " name '", sm.resource_name if sm else "-", "' override ", (mi as MeshInstance3D).get_surface_override_material(i))
		var cam := Camera3D.new()
		root.add_child(cam)
		cam.look_at_from_position(Vector3(0, 6, 22), Vector3(0, 5, -3), Vector3.UP)
		cam.current = true
	elif what == "soldier_face":
		_sky_env(Vector3(0.3, 0.55, 0.8).normalized(), false)
		var s := Soldier.new()
		root.add_child(s)
		s.body_yaw = PI + 0.35
		s.aim_yaw = s.body_yaw
		var cam := Camera3D.new()
		cam.fov = 30.0
		root.add_child(cam)
		cam.look_at_from_position(Vector3(0.25, 1.62, 1.35), Vector3(0, 1.45, 0), Vector3.UP)
		cam.current = true
	for i in 12:
		await process_frame
	await RenderingServer.frame_post_draw
	var img := root.get_texture().get_image()
	img.resize(img.get_width() / 2, img.get_height() / 2, Image.INTERPOLATE_LANCZOS)
	if out.ends_with(".png"):
		img.save_png(out)
	else:
		img.save_jpg(out, 0.88)
	print("RENDERED ", what, " -> ", out, " ", img.get_size())
	quit()
