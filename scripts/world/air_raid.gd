class_name AirRaid
extends Node3D
## Air raids on the valley, and the planes that cross the sky.
## A raid has a red zone (a circle on the map and the minimap). Twenty seconds before the first bomb the zone's siren
## starts to wail; it is heard in and around the zone only, not across the whole valley, and stops when the sky is
## clear. Two jets come in low over the zone, drop their bombs on it, turn round far away and make a second pass, their
## vapour trails drawn on the sky; cruise missiles come down on it too. Near a base the air defence answers and catches
## some of the missiles. Between raids, planes and bombers cross the sky now and then.

signal warned(text: String)

const WARN := 20.0                   # siren this long before the first bomb
const CLEAR := 9.0                   # the siren stops this long after the last one
const JET_SPEED := 170.0
const JET_ALT := 240.0

var world: World
var next_t := 100.0
var phase := ""                      # "", "warn", "strike", "clear"
var t := 0.0
var zone := Vector3.ZERO
var radius := 140.0
var count := 10                      # cruise missiles
var fired := 0
var bombs_left := 0
var siren: AudioStreamPlayer3D
var siren_holder: Node3D
var jets: Array[Node3D] = []
var enabled := true
var traffic_t := 30.0
var traffic: Array[Node3D] = []
var _models := {}

func setup(w: World) -> void:
	world = w
	next_t = randf_range(80.0, 120.0)
	traffic_t = randf_range(15.0, 35.0)

func _process(delta: float) -> void:
	if world == null or not world.ready_built:
		return
	_traffic(delta)
	if not enabled:
		return
	match phase:
		"":
			next_t -= delta
			if next_t <= 0.0:
				start()
		"warn":
			t += delta
			_fly_jets(delta)
			if t >= WARN:
				phase = "strike"
				t = 0.0
		"strike":
			t += delta
			_fly_jets(delta)
			if fired < count and t >= 3.0 + float(fired) * randf_range(0.9, 1.8):
				_strike()
			if fired >= count and bombs_left <= 0 and t > 3.0 + float(count) * 1.8 + 6.0:
				phase = "clear"
				t = 0.0
		"clear":
			t += delta
			_fly_jets(delta)
			if t >= CLEAR:
				_stop()

## the red zone on the map: centre, radius, and whether it is live
func active() -> bool:
	return phase != ""

## a raid now, on a zone near the player (or on the given point)
func start(at := Vector3.INF) -> void:
	if phase != "":
		return
	var focus := world.phys_focus if world.phys_set else world.focus
	if at != Vector3.INF:
		zone = at
	elif randf() < 0.55:
		var a := randf() * TAU
		var d := randf_range(150.0, 450.0)
		zone = focus + Vector3(cos(a) * d, 0.0, sin(a) * d)
	else:
		var towns: Array = world.lay.get("towns", [])
		var tw: Dictionary = towns[randi() % towns.size()] if not towns.is_empty() else {"x": 0.0, "z": 0.0}
		zone = Vector3(float(tw["x"]), 0.0, float(tw["z"]))
	var half := float(world.lay.get("half", 4000.0)) - 200.0
	zone.x = clampf(zone.x, -half, half)
	zone.z = clampf(zone.z, -half, half)
	zone.y = world.height(zone.x, zone.z)
	radius = randf_range(110.0, 170.0)
	count = randi_range(4, 8)
	bombs_left = 10
	fired = 0
	phase = "warn"
	t = 0.0
	_siren()
	_launch_jets()
	var d2 := Vector2(zone.x - focus.x, zone.z - focus.z).length()
	if d2 < radius:
		warned.emit("إنذار! أنت داخل منطقة القصف (الدائرة الحمراء) — اخرج منها خلال %d ثانية" % int(WARN))
	elif d2 < radius + 900.0:
		warned.emit("إنذار غارة جوية: الدائرة الحمراء على بعد %d م %s — القصف بعد %d ثانية" % [int(d2 - radius), _bearing(focus, zone), int(WARN)])
	else:
		warned.emit("غارة جوية على منطقة بعيدة (الدائرة الحمراء على الخريطة)")
	if d2 < radius + 600.0:
		Sfx.play("hypersonic_raid", -10.0, 0.0, "Ambience")

func _bearing(from: Vector3, to: Vector3) -> String:
	var a := rad_to_deg(atan2(to.x - from.x, -(to.z - from.z)))
	var names := ["شمالاً", "شمال شرق", "شرقاً", "جنوب شرق", "جنوباً", "جنوب غرب", "غرباً", "شمال غرب"]
	return names[int(fposmod(a + 22.5, 360.0) / 45.0) % 8]

## one siren on a pole in the middle of the zone, heard over the zone and a few hundred metres around it
func _siren() -> void:
	siren_holder = Node3D.new()
	add_child(siren_holder)
	siren_holder.global_position = zone + Vector3(0, 16.0, 0)
	siren = Sfx.loop_at("siren_loop", siren_holder, 2.0, 70.0, radius + 650.0)
	if siren:
		siren.attenuation_model = AudioStreamPlayer3D.ATTENUATION_INVERSE_DISTANCE
		siren.attenuation_filter_cutoff_hz = 9000.0
		siren.attenuation_filter_db = -8.0
		siren.panning_strength = 0.7
		siren.bus = "SFX"

func _model(nm: String) -> PackedScene:
	if not _models.has(nm):
		_models[nm] = load("res://models/u/%s.glb" % nm) if ResourceLoader.exists("res://models/u/%s.glb" % nm) else null
	return _models[nm]

## a white vapour trail behind a plane (two wing tips, or one for the big bomber)
func _trail(on: Node3D, offsets: Array) -> void:
	for o in offsets:
		var p := CPUParticles3D.new()
		p.amount = 90
		p.lifetime = 4.0
		p.local_coords = false
		p.emission_shape = CPUParticles3D.EMISSION_SHAPE_POINT
		p.direction = Vector3(0, 0, 1)
		p.spread = 2.0
		p.initial_velocity_min = 2.0
		p.initial_velocity_max = 4.0
		p.gravity = Vector3.ZERO
		p.scale_amount_min = 1.6
		p.scale_amount_max = 2.4
		var curve := Curve.new()
		curve.add_point(Vector2(0, 0.4))
		curve.add_point(Vector2(1, 1.6))
		p.scale_amount_curve = curve
		var grad := Gradient.new()
		grad.set_color(0, Color(1, 1, 1, 0.55))
		grad.set_color(1, Color(1, 1, 1, 0.0))
		p.color_ramp = grad
		var q := QuadMesh.new()
		q.size = Vector2(1.5, 1.5)
		var m := StandardMaterial3D.new()
		m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
		m.vertex_color_use_as_albedo = true
		m.albedo_texture = load("res://textures/fx/dust.png")
		q.material = m
		p.mesh = q
		p.position = o
		p.visibility_aabb = AABB(Vector3(-4000, -400, -4000), Vector3(8000, 800, 8000))
		on.add_child(p)

func _plane(nm: String, pos: Vector3, vel: Vector3, sound: String, trail: Array) -> Node3D:
	var scene := _model(nm)
	var holder := Node3D.new()
	add_child(holder)
	holder.global_position = pos
	holder.look_at(pos + vel, Vector3.UP)
	if scene:
		var mdl: Node3D = scene.instantiate()
		mdl.rotation.y = PI          # the models' noses are +Z
		holder.add_child(mdl)
		for g in mdl.find_children("*", "GeometryInstance3D", true, false):
			(g as GeometryInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	holder.set_meta("v", vel)
	_trail(holder, trail)
	if sound != "":
		Sfx.loop_at(sound, holder, 10.0, 140.0, 3200.0)
	return holder

func _launch_jets() -> void:
	# two fighters, 400 m apart, come in from far away towards the zone, low enough to be seen
	var dir := Vector3(randf_range(-1, 1), 0, randf_range(-1, 1)).normalized()
	for k in 2:
		var side := Vector3(-dir.z, 0, dir.x) * (k * 90.0 - 45.0)
		var start := zone - dir * (JET_SPEED * (WARN + 3.0) + k * 400.0) + side
		start.y = zone.y + JET_ALT + k * 30.0
		var j := _plane("j36", start, dir * JET_SPEED, "jet_loop", [Vector3(-5.5, 0, 3.0), Vector3(5.5, 0, 3.0)])
		j.set_meta("passes", 0)
		j.set_meta("turn", 0.0)
		j.set_meta("drop_t", 0.0)
		j.set_meta("flyby", false)
		jets.append(j)

## straight through the zone, bombs over it, on 2.5 km beyond, a wide turn, and back for a second pass
func _fly_jets(delta: float) -> void:
	var cam := get_viewport().get_camera_3d()
	for j in jets:
		var v: Vector3 = j.get_meta("v")
		var turning: float = j.get_meta("turn")
		var flat := Vector2(j.global_position.x - zone.x, j.global_position.z - zone.z)
		var vflat := Vector2(v.x, v.z).normalized()
		if turning > 0.0:
			# a level turn of 180 degrees in 12 s
			var w := PI / 12.0 * delta
			v = v.rotated(Vector3.UP, w)
			turning -= w
			j.set_meta("turn", turning)
		elif flat.length() > 2500.0 and flat.normalized().dot(vflat) > 0.5 and int(j.get_meta("passes")) < 2:
			j.set_meta("turn", PI)
			j.set_meta("passes", int(j.get_meta("passes")) + 1)
		j.set_meta("v", v)
		j.global_position += v * delta
		j.look_at(j.global_position + v - Vector3(0, 0, 0), Vector3.UP)
		if turning > 0.0:
			j.rotate_object_local(Vector3.FORWARD, -0.7)          # banked in the turn
		# over the zone during the strike: a bomb every third of a second
		if phase == "strike" and flat.length() < radius * 0.9 and bombs_left > 0:
			var dt: float = float(j.get_meta("drop_t")) - delta
			if dt <= 0.0:
				dt = 0.33
				bombs_left -= 1
				world.projectiles.fire("bomb", j.global_position - Vector3(0, 2.0, 0), v * 0.9, self)
			j.set_meta("drop_t", dt)
		if cam and not bool(j.get_meta("flyby")):
			var to := cam.global_position - j.global_position
			if to.dot(v) > 0.0 and to.length() < 1400.0:
				j.set_meta("flyby", true)
				Sfx.play_at("jet_flyby", j.global_position + v * 2.0, 12.0, 160.0, 0.0, 0.0, 0.03)
		elif cam and (cam.global_position - j.global_position).dot(v) < -400.0:
			j.set_meta("flyby", false)

func _strike() -> void:
	fired += 1
	var a := randf() * TAU
	var r := sqrt(randf()) * radius
	var hit := zone + Vector3(cos(a) * r, 0.0, sin(a) * r)
	hit.y = world.height(hit.x, hit.z)
	var from := hit + Vector3(randf_range(-400, 400), 1400.0, randf_range(-400, 400))
	world.projectiles.fire("strike", from, (hit - from).normalized() * 0.01, self, null, hit)
	_air_defence(from, hit)

## a base nearby answers: interceptors climb at the incoming missile (most of them are caught)
func _air_defence(from: Vector3, hit: Vector3) -> void:
	for b in world.lay.get("bases", []):
		var bd: Dictionary = b
		var bp := Vector3(float(bd["x"]), 0.0, float(bd["z"]))
		if Vector2(hit.x - bp.x, hit.z - bp.z).length() > 900.0:
			continue
		if randf() > 0.6:
			return
		var launch := bp + Basis(Vector3.UP, float(bd["yaw"])) * Vector3(-110.0, 0.0, -90.0)
		launch.y = world.height(launch.x, launch.z) + 4.0
		var target: Node3D = null
		if not world.projectiles.live.is_empty():
			target = world.projectiles.live[world.projectiles.live.size() - 1]["node"]
		get_tree().create_timer(randf_range(0.6, 1.4), false).timeout.connect(func():
			if is_instance_valid(target):
				world.projectiles.fire("missile", launch, Vector3(0, 1, 0) * 0.01, self, target)
				Sfx.play_at("rocket_launch", launch, 10.0, 60.0))
		return

## a raider hit by the air defence: it rolls over, falls burning and blows up on the ground
func shot_down(j: Node3D) -> void:
	if not jets.has(j) or bool(j.get_meta("down", false)):
		return
	j.set_meta("down", true)
	jets.erase(j)
	var v: Vector3 = j.get_meta("v")
	var fire := world.projectiles._trail() if world.projectiles else null
	if fire:
		j.add_child(fire)
		fire.emitting = true
	warned.emit("أُسقطت طائرة مغيرة!")
	var t := 0.0
	while is_instance_valid(j):
		var dt := get_process_delta_time()
		t += dt
		v.y -= 9.8 * dt
		v *= 1.0 - 0.08 * dt
		j.global_position += v * dt
		j.rotate_object_local(Vector3.FORWARD, dt * 2.2)
		j.rotate_object_local(Vector3.RIGHT, -dt * 0.4)
		var gh := world.height(j.global_position.x, j.global_position.z)
		if j.global_position.y <= gh + 2.0 or t > 40.0:
			world.explode(Vector3(j.global_position.x, gh, j.global_position.z), 2.6, self)
			j.queue_free()
			return
		await get_tree().process_frame

func _stop() -> void:
	phase = ""
	next_t = randf_range(150.0, 260.0)
	if siren:
		var h := siren_holder
		var tw := create_tween()
		tw.tween_property(siren, "volume_db", -60.0, 4.0)
		tw.tween_callback(h.queue_free)
		siren = null
	for j in jets:
		j.queue_free()
	jets.clear()
	warned.emit("انتهت الغارة — السماء صافية")

# ------------------------------------------------------------------ planes crossing the sky
## every half minute or so a plane crosses the sky somewhere the player can see it: a pair of fighters, a bomber
func _traffic(delta: float) -> void:
	for p in traffic.duplicate():
		var v: Vector3 = p.get_meta("v")
		p.global_position += v * delta
		var life: float = float(p.get_meta("life")) - delta
		p.set_meta("life", life)
		if life <= 0.0:
			traffic.erase(p)
			p.queue_free()
	traffic_t -= delta
	if traffic_t > 0.0 or not world.ready_built:
		return
	traffic_t = randf_range(35.0, 80.0)
	var cam := get_viewport().get_camera_3d()
	if cam == null:
		return
	var c := cam.global_position
	var dir := Vector3(randf_range(-1, 1), 0, randf_range(-1, 1)).normalized()
	var side := Vector3(-dir.z, 0, dir.x) * randf_range(-900.0, 900.0)
	var kind := randi() % 3
	var nm := "b2" if kind == 0 else "j36"
	var speed := 150.0 if kind == 0 else 210.0
	var alt := randf_range(380.0, 650.0) if kind == 0 else randf_range(260.0, 520.0)
	var n := 1 if kind == 0 else 2
	for k in n:
		var start := c - dir * 4200.0 + side + Vector3(-dir.z, 0, dir.x) * k * 70.0 - dir * k * 120.0
		start.y = world.height(c.x, c.z) + alt + k * 20.0
		var trail := [Vector3(0, 0, 8.0)] if kind == 0 else [Vector3(-5.5, 0, 3.0), Vector3(5.5, 0, 3.0)]
		var pl := _plane(nm, start, dir * speed, "jet_loop", trail)
		pl.set_meta("life", 8400.0 / speed)
		traffic.append(pl)
