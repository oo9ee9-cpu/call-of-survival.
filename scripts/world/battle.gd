class_name Battle
extends Node3D
## The war going on over the hill: shells landing far away (flash, smoke column, delayed rumble),
## machine-gun bursts, flares at night, and now and then a shell close enough to shake the camera.

signal shake(amount: float)

var world: World
var t := 4.0
var lights: Array[OmniLight3D] = []
var columns: Array[CPUParticles3D] = []
var dirt: Array[CPUParticles3D] = []
var li := 0
var ci := 0
var flares: Array = []

func setup(w: World) -> void:
	world = w
	for i in 3:
		var l := OmniLight3D.new()
		l.light_color = Color(1.0, 0.62, 0.3)
		l.omni_range = 160.0
		l.omni_attenuation = 1.5
		l.light_energy = 0.0
		l.visible = false
		add_child(l)
		lights.append(l)
	for i in 4:
		columns.append(_column())
		dirt.append(_dirt())

func _smoke_mat(col: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.vertex_color_use_as_albedo = true
	m.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	m.billboard_keep_scale = true
	m.albedo_texture = load("res://textures/fx/smoke.png")
	m.albedo_color = col
	return m

func _column() -> CPUParticles3D:
	var p := CPUParticles3D.new()
	p.amount = 22
	p.lifetime = 11.0
	p.one_shot = true
	p.explosiveness = 0.88
	p.emitting = false
	p.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
	p.emission_sphere_radius = 3.0
	p.direction = Vector3(0, 1, 0)
	p.spread = 25.0
	p.initial_velocity_min = 5.0
	p.initial_velocity_max = 14.0
	p.damping_min = 1.2
	p.damping_max = 2.4
	p.gravity = Vector3(1.2, 0.6, 0.4)
	p.scale_amount_min = 4.0
	p.scale_amount_max = 7.0
	var c := Curve.new()
	c.add_point(Vector2(0, 0.4))
	c.add_point(Vector2(0.3, 1.0))
	c.add_point(Vector2(1, 2.4))
	p.scale_amount_curve = c
	var g := Gradient.new()
	g.set_color(0, Color(0.16, 0.14, 0.12, 0.0))
	g.set_color(1, Color(0.45, 0.45, 0.46, 0.0))
	g.add_point(0.04, Color(0.18, 0.15, 0.12, 0.85))
	g.add_point(0.4, Color(0.36, 0.35, 0.34, 0.6))
	p.color_ramp = g
	var q := QuadMesh.new()
	q.size = Vector2(2, 2)
	q.material = _smoke_mat(Color(1, 1, 1))
	p.mesh = q
	p.visibility_aabb = AABB(Vector3(-60, -10, -60), Vector3(120, 120, 120))
	add_child(p)
	return p

func _dirt() -> CPUParticles3D:
	var p := CPUParticles3D.new()
	p.amount = 40
	p.lifetime = 2.6
	p.one_shot = true
	p.explosiveness = 1.0
	p.emitting = false
	p.direction = Vector3(0, 1, 0)
	p.spread = 30.0
	p.initial_velocity_min = 14.0
	p.initial_velocity_max = 30.0
	p.gravity = Vector3(0, -9.8, 0)
	p.scale_amount_min = 0.6
	p.scale_amount_max = 1.8
	var g := Gradient.new()
	g.set_color(0, Color(0.12, 0.1, 0.08, 1.0))
	g.set_color(1, Color(0.2, 0.17, 0.14, 0.0))
	p.color_ramp = g
	var q := QuadMesh.new()
	q.size = Vector2(1, 1)
	q.material = _smoke_mat(Color(1, 1, 1))
	p.mesh = q
	p.visibility_aabb = AABB(Vector3(-40, -5, -40), Vector3(80, 60, 80))
	add_child(p)
	return p

func _process(delta: float) -> void:
	if world == null or not world.ready_built:
		return
	for l in lights:
		if l.visible:
			l.light_energy = maxf(l.light_energy - delta * l.get_meta("decay", 40.0), 0.0)
			if l.light_energy <= 0.01:
				l.visible = false
	for f in flares.duplicate():
		var fl: OmniLight3D = f["light"]
		f["t"] = float(f["t"]) - delta
		fl.position.y -= delta * 2.2
		fl.light_energy = (2.5 + 0.6 * sin(Time.get_ticks_msec() * 0.03)) * clampf(float(f["t"]) / 3.0, 0.0, 1.0)
		if float(f["t"]) <= 0.0:
			fl.queue_free()
			flares.erase(f)
	if not Settings.get_v("battle"):
		return
	t -= delta
	if t <= 0.0:
		t = randf_range(3.0, 10.0)
		_event()

func _focus() -> Vector3:
	return world.focus

func _event() -> void:
	var r := randf()
	var night := int(Settings.get_v("time")) == 3
	if r < 0.5:
		var b: Dictionary = world.lay["battle"]
		var p := Vector3(randf_range(b["x"][0], b["x"][1]), 0.0, randf_range(b["z"][0], b["z"][1]))
		explosion(p)
	elif r < 0.7:
		var f := _focus()
		var p2 := Vector3(f.x + randf_range(-260, 260), 0.0, randf_range(-250.0, -120.0))
		explosion(p2)
	elif r < 0.93:
		var b2: Dictionary = world.lay["battle"]
		var pm := Vector3(randf_range(b2["x"][0], b2["x"][1]), 0.0, randf_range(b2["z"][0], -300.0))
		pm.y = world.height(pm.x, pm.z) + 1.0
		Sfx.play_at("mg_far", pm, 8.0, 120.0, 0.0, -1.0, 0.08, "Ambience")
		if night and randf() < 0.7:
			_flare(pm + Vector3(randf_range(-80, 80), 140.0, randf_range(-60, 60)))
	else:
		if night:
			_flare(_focus() + Vector3(randf_range(-250, 250), 180.0, randf_range(-400, -200)))
		else:
			var f2 := _focus()
			var ang := randf() * TAU
			var dist := randf_range(130.0, 230.0)
			var p3 := f2 + Vector3(cos(ang) * dist, 0.0, sin(ang) * dist)
			Sfx.play("shell_whistle", -4.0, 0.08)
			get_tree().create_timer(1.6, false).timeout.connect(explosion.bind(p3))

func explosion(p: Vector3) -> void:
	p.y = world.height(p.x, p.z)
	var cam := get_viewport().get_camera_3d()
	var d := cam.global_position.distance_to(p) if cam else 1000.0
	var col := columns[ci]
	var dr := dirt[ci]
	ci = (ci + 1) % columns.size()
	col.global_position = p + Vector3(0, 2.0, 0)
	col.restart()
	dr.global_position = p + Vector3(0, 0.5, 0)
	dr.restart()
	if d < 1500.0:
		var l := lights[li]
		li = (li + 1) % lights.size()
		l.global_position = p + Vector3(0, 6, 0)
		l.light_energy = 14.0 if int(Settings.get_v("time")) == 3 else 6.0
		l.set_meta("decay", 60.0)
		l.visible = true
	var snd := "expl_near" if d < 300.0 else "expl_far"
	Sfx.play_at(snd, p + Vector3(0, 3, 0), 10.0 if d < 300.0 else 14.0, 140.0, 0.0, -1.0, 0.1, "SFX" if d < 300.0 else "Ambience")
	if d < 500.0:
		get_tree().create_timer(d / Sfx.SOUND_SPEED, false).timeout.connect(func(): shake.emit(clampf(1.0 - d / 500.0, 0.05, 1.0)))
	if world.env and d < 900.0:
		world.env.flash = maxf(world.env.flash, 0.05 * (1.0 - d / 900.0))

func _flare(p: Vector3) -> void:
	var l := OmniLight3D.new()
	l.light_color = Color(1.0, 0.92, 0.75)
	l.omni_range = 260.0
	l.omni_attenuation = 1.2
	l.light_energy = 2.5
	add_child(l)
	l.global_position = p
	flares.append({"light": l, "t": 22.0})
