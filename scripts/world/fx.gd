class_name Fx
extends Node3D
## Bullet impacts: dust or splinters or sparks or splashes, a hole left on the surface, the sound of the hit.

var world: World
var pools := {}
var pidx := {}
var holes: MultiMeshInstance3D
var hole_i := 0
const HOLES := 160

func setup(w: World) -> void:
	world = w
	pools["dust"] = _pool(Color(0.33, 0.28, 0.22), 10, 0.55, 2.2, 0.18, 0.5, false, "res://textures/fx/dust.png")
	pools["mud"] = _pool(Color(0.14, 0.12, 0.1), 12, 0.6, 3.2, 0.06, 0.16, true, "res://textures/fx/dust.png")
	pools["wood"] = _pool(Color(0.42, 0.33, 0.24), 10, 0.8, 4.0, 0.03, 0.07, true, "res://textures/fx/dust.png")
	pools["spark"] = _pool(Color(1.0, 0.75, 0.4), 12, 0.25, 6.0, 0.03, 0.05, true, "res://textures/fx/spark.png", true)
	pools["water"] = _pool(Color(0.55, 0.55, 0.52), 14, 0.7, 3.5, 0.05, 0.12, true, "res://textures/fx/dust.png")
	pools["glass"] = _pool(Color(0.5, 0.6, 0.5), 14, 0.7, 3.0, 0.02, 0.04, true, "res://textures/fx/spark.png")
	var q := QuadMesh.new()
	q.size = Vector2(0.075, 0.075)
	var m := StandardMaterial3D.new()
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA_SCISSOR
	m.alpha_scissor_threshold = 0.3
	m.albedo_texture = load("res://textures/fx/bullet_hole.png")
	m.roughness = 0.9
	q.material = m
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = q
	mm.instance_count = HOLES
	mm.visible_instance_count = 0
	holes = MultiMeshInstance3D.new()
	holes.multimesh = mm
	holes.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(holes)

func _pool(col: Color, amount: int, life: float, vel: float, s0: float, s1: float, gravity: bool, texp: String, additive := false) -> Array:
	var arr := []
	for i in 6:
		var p := CPUParticles3D.new()
		p.amount = amount
		p.lifetime = life
		p.one_shot = true
		p.explosiveness = 1.0
		p.emitting = false
		p.local_coords = false
		p.direction = Vector3(0, 0, 1)
		p.spread = 35.0
		p.initial_velocity_min = vel * 0.4
		p.initial_velocity_max = vel
		p.gravity = Vector3(0, -9.8, 0) if gravity else Vector3(0, 0.3, 0)
		p.damping_min = 0.5 if gravity else 3.0
		p.damping_max = 1.0 if gravity else 5.0
		p.scale_amount_min = s0
		p.scale_amount_max = s1
		if not gravity:
			var c := Curve.new()
			c.add_point(Vector2(0, 0.5))
			c.add_point(Vector2(1, 2.5))
			p.scale_amount_curve = c
		var g := Gradient.new()
		g.set_color(0, col)
		g.set_color(1, Color(col.r, col.g, col.b, 0.0))
		p.color_ramp = g
		var qm := QuadMesh.new()
		qm.size = Vector2(1, 1)
		var m := StandardMaterial3D.new()
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		m.vertex_color_use_as_albedo = true
		m.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
		m.billboard_keep_scale = true
		m.albedo_texture = load(texp)
		if additive:
			m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
		qm.material = m
		p.mesh = qm
		add_child(p)
		arr.append(p)
	return arr

func burst(kind: String, pos: Vector3, nrm: Vector3) -> void:
	if not pools.has(kind):
		return
	var arr: Array = pools[kind]
	var i: int = pidx.get(kind, 0)
	pidx[kind] = (i + 1) % arr.size()
	var p: CPUParticles3D = arr[i]
	var up := Vector3.UP if absf(nrm.y) < 0.95 else Vector3.RIGHT
	p.global_transform = Transform3D(Basis.looking_at(-nrm, up), pos + nrm * 0.03)
	p.restart()

## a shot landed: effect, hole, sound
func impact(pos: Vector3, nrm: Vector3, surface: String) -> void:
	match surface:
		"wood":
			burst("wood", pos, nrm)
			burst("dust", pos, nrm)
			Sfx.play_at("impact_wood", pos, 0.0, 4.0)
		"metal":
			burst("spark", pos, nrm)
			Sfx.play_at("impact_metal", pos, 2.0, 6.0)
		"water":
			burst("water", pos, Vector3.UP)
			Sfx.play_at("impact_water", pos, 0.0, 4.0)
			return
		"glass":
			burst("glass", pos, nrm)
			Sfx.play_at("impact_glass", pos, 0.0, 4.0)
			return
		"bag":
			burst("dust", pos, nrm)
			Sfx.play_at("impact_dirt", pos, -3.0, 4.0)
		"mud":
			burst("mud", pos, nrm)
			Sfx.play_at("impact_dirt", pos, 0.0, 4.0)
		_:
			burst("dust", pos, nrm)
			burst("mud", pos, nrm)
			Sfx.play_at("impact_dirt", pos, 0.0, 4.0)
	var up := Vector3.UP if absf(nrm.y) < 0.95 else Vector3.FORWARD
	var b := Basis.looking_at(-nrm, up).rotated(nrm, randf() * TAU)
	var mm := holes.multimesh
	mm.set_instance_transform(hole_i, Transform3D(b, pos + nrm * 0.004))
	hole_i = (hole_i + 1) % HOLES
	mm.visible_instance_count = mini(mm.visible_instance_count + 1, HOLES)
