class_name Boom
extends Node3D
## Explosions on the valley (vehicles blowing up, missiles, bombs, tank shells): a fireball, a column of smoke that
## drifts with the wind, flying sparks and debris, a flash that lights the ground, the bang (heard late when far away),
## and the blast: it hurts soldiers and vehicles around it and shakes the camera of whoever is close.

signal shake(amount: float)

const SETS := 6

var world: World
var fires: Array[CPUParticles3D] = []
var smokes: Array[CPUParticles3D] = []
var debris: Array[CPUParticles3D] = []
var lights: Array[OmniLight3D] = []
var idx := 0

func setup(w: World) -> void:
	world = w
	for i in SETS:
		fires.append(_fire())
		smokes.append(_smoke())
		debris.append(_debris())
		var l := OmniLight3D.new()
		l.light_color = Color(1.0, 0.6, 0.28)
		l.omni_range = 60.0
		l.omni_attenuation = 1.4
		l.light_energy = 0.0
		l.visible = false
		l.shadow_enabled = false
		add_child(l)
		lights.append(l)

func _mat(tex: String, additive: bool) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.vertex_color_use_as_albedo = true
	m.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	m.billboard_keep_scale = true
	m.albedo_texture = load(tex)
	if additive:
		m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	return m

func _fire() -> CPUParticles3D:
	var p := CPUParticles3D.new()
	p.amount = 26
	p.lifetime = 1.3
	p.one_shot = true
	p.explosiveness = 0.95
	p.emitting = false
	p.local_coords = false
	p.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
	p.emission_sphere_radius = 1.5
	p.direction = Vector3(0, 1, 0)
	p.spread = 70.0
	p.initial_velocity_min = 4.0
	p.initial_velocity_max = 13.0
	p.damping_min = 4.0
	p.damping_max = 7.0
	p.gravity = Vector3(0, 3.0, 0)
	p.scale_amount_min = 3.0
	p.scale_amount_max = 6.0
	var c := Curve.new()
	c.add_point(Vector2(0, 0.5))
	c.add_point(Vector2(0.25, 1.0))
	c.add_point(Vector2(1, 1.4))
	p.scale_amount_curve = c
	var g := Gradient.new()
	g.set_color(0, Color(1.0, 0.95, 0.7, 1.0))
	g.set_color(1, Color(0.2, 0.08, 0.02, 0.0))
	g.add_point(0.3, Color(1.0, 0.55, 0.15, 0.9))
	g.add_point(0.6, Color(0.6, 0.18, 0.04, 0.5))
	p.color_ramp = g
	var q := QuadMesh.new()
	q.size = Vector2(2, 2)
	q.material = _mat("res://textures/fx/smoke.png", true)
	p.mesh = q
	p.visibility_aabb = AABB(Vector3(-40, -10, -40), Vector3(80, 60, 80))
	add_child(p)
	return p

func _smoke() -> CPUParticles3D:
	var p := CPUParticles3D.new()
	p.amount = 30
	p.lifetime = 14.0
	p.one_shot = true
	p.explosiveness = 0.75
	p.emitting = false
	p.local_coords = false
	p.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
	p.emission_sphere_radius = 2.5
	p.direction = Vector3(0, 1, 0)
	p.spread = 22.0
	p.initial_velocity_min = 4.0
	p.initial_velocity_max = 12.0
	p.damping_min = 1.0
	p.damping_max = 2.0
	p.gravity = Vector3(1.4, 0.8, 0.5)
	p.scale_amount_min = 4.0
	p.scale_amount_max = 8.0
	var c := Curve.new()
	c.add_point(Vector2(0, 0.35))
	c.add_point(Vector2(0.3, 1.0))
	c.add_point(Vector2(1, 2.6))
	p.scale_amount_curve = c
	var g := Gradient.new()
	g.set_color(0, Color(0.1, 0.09, 0.08, 0.0))
	g.set_color(1, Color(0.4, 0.4, 0.42, 0.0))
	g.add_point(0.05, Color(0.12, 0.1, 0.09, 0.9))
	g.add_point(0.45, Color(0.28, 0.27, 0.27, 0.6))
	p.color_ramp = g
	var q := QuadMesh.new()
	q.size = Vector2(2, 2)
	q.material = _mat("res://textures/fx/smoke.png", false)
	p.mesh = q
	p.visibility_aabb = AABB(Vector3(-80, -10, -80), Vector3(160, 160, 160))
	add_child(p)
	return p

func _debris() -> CPUParticles3D:
	var p := CPUParticles3D.new()
	p.amount = 40
	p.lifetime = 2.2
	p.one_shot = true
	p.explosiveness = 1.0
	p.emitting = false
	p.local_coords = false
	p.direction = Vector3(0, 1, 0)
	p.spread = 60.0
	p.initial_velocity_min = 10.0
	p.initial_velocity_max = 32.0
	p.gravity = Vector3(0, -12.0, 0)
	p.scale_amount_min = 0.08
	p.scale_amount_max = 0.3
	var g := Gradient.new()
	g.set_color(0, Color(1.0, 0.8, 0.45, 1.0))
	g.set_color(1, Color(0.15, 0.12, 0.1, 0.0))
	g.add_point(0.2, Color(0.9, 0.45, 0.12, 1.0))
	g.add_point(0.5, Color(0.2, 0.17, 0.14, 1.0))
	p.color_ramp = g
	var q := QuadMesh.new()
	q.size = Vector2(1, 1)
	q.material = _mat("res://textures/fx/spark.png", false)
	p.mesh = q
	p.visibility_aabb = AABB(Vector3(-60, -10, -60), Vector3(120, 80, 120))
	add_child(p)
	return p

## an explosion at p; size 1 = a vehicle or a missile, 2 = a heavy bomb, 0.5 = a shell or a grenade
func explode(p: Vector3, size := 1.0, src: Node = null) -> void:
	var i := idx
	idx = (idx + 1) % SETS
	var f := fires[i]
	var s := smokes[i]
	var d := debris[i]
	f.global_position = p
	s.global_position = p
	d.global_position = p
	f.scale_amount_min = 3.0 * size
	f.scale_amount_max = 6.0 * size
	s.scale_amount_min = 4.0 * size
	s.scale_amount_max = 8.0 * size
	d.initial_velocity_max = 32.0 * sqrt(size)
	f.restart()
	s.restart()
	d.restart()
	var l := lights[i]
	l.global_position = p + Vector3(0, 3.0, 0)
	l.omni_range = 45.0 * size + 15.0
	l.light_energy = 10.0
	l.visible = true
	l.set_meta("t", 0.6)
	var cam := get_viewport().get_camera_3d()
	var dist := cam.global_position.distance_to(p) if cam else 1000.0
	var snd := "expl_big" if size >= 0.9 else "expl_near"
	Sfx.play_at(snd, p, 12.0 + size * 4.0, 60.0 * size, 0.0, dist / Sfx.SOUND_SPEED, 0.08)
	if dist < 260.0 * size:
		var k := clampf(1.0 - dist / (260.0 * size), 0.0, 1.0)
		get_tree().create_timer(dist / Sfx.SOUND_SPEED, false).timeout.connect(func(): shake.emit(k))
	if world and world.env and dist < 1500.0:
		world.env.flash = maxf(world.env.flash, 0.08 * size * (1.0 - dist / 1500.0))
	_blast(p, size, src)

## who is caught in it: soldiers (the player and, later, bots) and vehicles take damage falling off with distance
func _blast(p: Vector3, size: float, src: Node) -> void:
	var r := 14.0 * size
	for n in get_tree().get_nodes_in_group("vehicles"):
		var v := n as Vehicle
		if v == null or v == src or v.dead:
			continue
		var dv := v.global_position.distance_to(p)
		if dv < r * 1.5:
			v.damage(1600.0 * size * (1.0 - dv / (r * 1.5)), p)
			v.apply_central_impulse((v.global_position - p).normalized() * v.mass * 3.0 * size * (1.0 - dv / (r * 1.5)))
	for n in get_tree().get_nodes_in_group("soldiers"):
		var sn := n as Node3D
		if sn == null or not sn.has_method("take_damage"):
			continue
		var ds := (sn.global_position + Vector3(0, 1.0, 0)).distance_to(p)
		if ds < r:
			sn.call("take_damage", 160.0 * (1.0 - ds / r) * clampf(size, 0.5, 2.0), p)

func _process(delta: float) -> void:
	for l in lights:
		if not l.visible:
			continue
		var t: float = float(l.get_meta("t", 0.0)) - delta
		l.set_meta("t", t)
		l.light_energy = maxf(t, 0.0) / 0.6 * 10.0
		if t <= 0.0:
			l.visible = false
