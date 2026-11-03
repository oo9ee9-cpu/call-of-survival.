class_name Projectiles
extends Node3D
## Everything fired that flies for a while: tank shells, aircraft cannon rounds, rockets, guided missiles, bombs and the
## missiles of an air raid. Each flies its own path (gravity, thrust, guidance), is checked against the world between
## two frames (a ray) and against the ground out where there are no colliders, leaves a tracer or a smoke trail, and
## ends in a hit: a puff and damage for cannon rounds, an explosion (Boom) for the rest.

const KINDS := {
	"shell": {"speed": 520.0, "grav": 1.0, "boom": 0.6, "tracer": Color(1.0, 0.75, 0.4), "len": 6.0, "life": 8.0},
	"round": {"speed": 900.0, "grav": 1.0, "boom": 0.0, "dmg": 70.0, "tracer": Color(1.0, 0.85, 0.5), "len": 9.0, "life": 3.0},
	"rocket": {"speed": 60.0, "accel": 260.0, "vmax": 420.0, "grav": 0.2, "boom": 0.6, "smoke": true, "model": "", "life": 9.0},
	"missile": {"speed": 120.0, "accel": 300.0, "vmax": 900.0, "grav": 0.0, "boom": 1.0, "smoke": true, "model": "amraam", "guided": true, "life": 14.0},
	"bomb": {"speed": 0.0, "grav": 1.0, "boom": 2.2, "model": "mk84", "life": 40.0},
	"guided_bomb": {"speed": 0.0, "grav": 1.0, "boom": 2.0, "model": "gbu24", "guided": true, "life": 40.0},
	"strike": {"speed": 700.0, "grav": 0.0, "boom": 2.4, "smoke": true, "model": "gbu27", "guided": true, "life": 30.0, "whistle": true},
}

var world: World
var live: Array[Dictionary] = []
var models := {}
var tracer_mesh: QuadMesh

func setup(w: World) -> void:
	world = w
	tracer_mesh = QuadMesh.new()
	tracer_mesh.size = Vector2(0.12, 1.0)
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.albedo_texture = load("res://textures/fx/spark.png")
	m.billboard_mode = BaseMaterial3D.BILLBOARD_FIXED_Y
	m.vertex_color_use_as_albedo = true
	tracer_mesh.material = m

## fire one: kind from KINDS, from p with velocity v (its own speed is added along v's direction when v is short)
func fire(kind: String, p: Vector3, v: Vector3, src: Node = null, target: Node3D = null, target_pos := Vector3.INF) -> void:
	var k: Dictionary = KINDS[kind]
	var dir := v.normalized() if v.length() > 0.01 else Vector3.DOWN
	var vel := v + dir * float(k.get("speed", 0.0))
	var node := Node3D.new()
	add_child(node)
	node.global_position = p
	var nm := String(k.get("model", ""))
	if nm != "":
		if not models.has(nm):
			models[nm] = load("res://models/u/%s.glb" % nm)
		var mdl: Node3D = (models[nm] as PackedScene).instantiate()
		# the store models lie along X (bombs) or Z (the AMRAAM): turn them so their length runs along -Z of the node
		var info: Dictionary = world.valley.models.info.get(nm, {}) if world.valley and world.valley.models else {}
		var sz: Array = info.get("size", [0.3, 0.3, 3.0])
		if float(sz[0]) > float(sz[2]):
			mdl.rotation.y = PI * 0.5
		node.add_child(mdl)
	if k.has("tracer"):
		var t := MeshInstance3D.new()
		t.mesh = tracer_mesh
		t.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		t.scale = Vector3(1.0, float(k.get("len", 5.0)), 1.0)
		t.rotation.x = -PI * 0.5
		t.position.z = float(k.get("len", 5.0)) * 0.5
		var c: Color = k["tracer"]
		var tm := (tracer_mesh.material as StandardMaterial3D).duplicate() as StandardMaterial3D
		tm.albedo_color = c * 2.0
		tm.billboard_mode = BaseMaterial3D.BILLBOARD_DISABLED
		t.material_override = tm
		node.add_child(t)
	var smoke: CPUParticles3D = null
	if bool(k.get("smoke", false)):
		smoke = _trail()
		add_child(smoke)
		smoke.global_position = p
		smoke.emitting = true
	var snd: AudioStreamPlayer3D = null
	if bool(k.get("whistle", false)):
		snd = Sfx.loop_at("missile_incoming", node, 6.0, 40.0, 3000.0)
	elif kind == "rocket" or kind == "missile":
		snd = Sfx.loop_at("wind_fall_loop", node, -2.0, 10.0, 600.0)
	live.append({"kind": kind, "k": k, "node": node, "p": p, "v": vel, "t": 0.0, "src": src, "target": target,
		"tpos": target_pos, "smoke": smoke, "snd": snd})

func _trail() -> CPUParticles3D:
	var p := CPUParticles3D.new()
	p.amount = 90
	p.lifetime = 3.0
	p.local_coords = false
	p.emitting = false
	p.direction = Vector3(0, 1, 0)
	p.spread = 180.0
	p.initial_velocity_min = 0.2
	p.initial_velocity_max = 1.0
	p.gravity = Vector3(0.6, 0.5, 0.2)
	p.scale_amount_min = 1.0
	p.scale_amount_max = 1.8
	var c := Curve.new()
	c.add_point(Vector2(0, 0.4))
	c.add_point(Vector2(1, 2.8))
	p.scale_amount_curve = c
	var g := Gradient.new()
	g.set_color(0, Color(1.0, 0.85, 0.6, 0.9))
	g.set_color(1, Color(0.6, 0.6, 0.6, 0.0))
	g.add_point(0.08, Color(0.75, 0.73, 0.7, 0.7))
	p.color_ramp = g
	var q := QuadMesh.new()
	q.size = Vector2(1.2, 1.2)
	var m := StandardMaterial3D.new()
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.vertex_color_use_as_albedo = true
	m.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	m.albedo_texture = load("res://textures/fx/smoke.png")
	q.material = m
	p.mesh = q
	p.visibility_aabb = AABB(Vector3(-400, -400, -400), Vector3(800, 800, 800))
	return p

func _physics_process(delta: float) -> void:
	if live.is_empty():
		return
	var ss := get_world_3d().direct_space_state
	var i := 0
	while i < live.size():
		var s: Dictionary = live[i]
		var k: Dictionary = s["k"]
		var p: Vector3 = s["p"]
		var v: Vector3 = s["v"]
		s["t"] = float(s["t"]) + delta
		# thrust, guidance, gravity
		if k.has("accel"):
			var sp := v.length()
			if sp < float(k.get("vmax", 400.0)):
				v += v.normalized() * float(k["accel"]) * delta
		if bool(k.get("guided", false)):
			var aim := Vector3.INF
			var tgt: Node3D = s["target"]
			if tgt and is_instance_valid(tgt):
				aim = tgt.global_position
			elif s["tpos"] != Vector3.INF:
				aim = s["tpos"]
			if aim != Vector3.INF:
				var want := (aim - p).normalized()
				var sp2 := maxf(v.length(), 1.0)
				var turn := 1.6 if String(s["kind"]) == "missile" else 0.7
				if String(s["kind"]).ends_with("bomb"):
					# glide bombs steer their fall
					v = v.lerp(want * maxf(sp2, 60.0), clampf(delta * turn, 0.0, 1.0))
				else:
					v = v.normalized().slerp(want, clampf(delta * turn * 2.0, 0.0, 1.0)) * sp2
		v.y -= 9.8 * float(k.get("grav", 1.0)) * delta
		var np := p + v * delta
		# an interceptor chasing another projectile: proximity fuse, both go up in the air
		var tg: Node3D = s["target"]
		if tg and is_instance_valid(tg) and tg.get_parent() == self and tg.global_position.distance_to(np) < 18.0:
			for j in live.size():
				if live[j]["node"] == tg:
					var other: Dictionary = live[j]
					live.remove_at(j)
					if j < i:
						i -= 1
					_end(other, tg.global_position, Vector3.UP, null, true)
					break
			_end(s, np, Vector3.UP, null, true)
			live.remove_at(i)
			continue
		var hit := false
		var hp := np
		var hn := Vector3.UP
		var collider: Object = null
		var q := PhysicsRayQueryParameters3D.create(p, np, 1 | 2 | Vehicle.LAYER | 4)
		var src = s["src"]
		if src is CollisionObject3D:
			q.exclude = [(src as CollisionObject3D).get_rid()]
		var r := ss.intersect_ray(q)
		if not r.is_empty():
			hit = true
			hp = r["position"]
			hn = r["normal"]
			collider = r["collider"]
		elif np.y < world.height(np.x, np.z):
			hit = true
			hp = Vector3(np.x, world.height(np.x, np.z), np.z)
		elif world.props and world.props.has_method("water_level") and np.y < float(world.props.water_level(np.x, np.z)):
			hit = true
			hp = np
		if hit or float(s["t"]) > float(k.get("life", 10.0)):
			_end(s, hp, hn, collider, hit)
			live.remove_at(i)
			continue
		s["p"] = np
		s["v"] = v
		var node: Node3D = s["node"]
		node.global_position = np
		if v.length() > 0.5:
			node.look_at(np + v, Vector3.UP if absf(v.normalized().y) < 0.98 else Vector3.RIGHT)
		var sm: CPUParticles3D = s["smoke"]
		if sm:
			sm.global_position = np
		i += 1

func _end(s: Dictionary, p: Vector3, n: Vector3, collider: Object, hit: bool) -> void:
	var k: Dictionary = s["k"]
	var node: Node3D = s["node"]
	node.queue_free()
	var sm: CPUParticles3D = s["smoke"]
	if sm:
		sm.emitting = false
		get_tree().create_timer(3.5, false).timeout.connect(sm.queue_free)
	if not hit:
		return
	var b := float(k.get("boom", 0.0))
	if b > 0.0:
		world.explode(p + n * 0.5, b, s["src"])
		return
	# a cannon round: a puff where it lands and damage to what it hits
	if world.fx:
		world.fx.impact(p, n, "metal" if collider is Vehicle else "dirt")
	var dmg := float(k.get("dmg", 30.0))
	if collider is Vehicle:
		(collider as Vehicle).damage(dmg, p)
	elif collider and collider.has_method("take_damage"):
		collider.call("take_damage", dmg, p)
