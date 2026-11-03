class_name AirRaid
extends Node3D
## Air raids on the valley. Twenty seconds before the missiles arrive the sirens of the target town start to wail
## (and keep on until the sky is clear again); a pair of jets screams over; then missiles and bombs come down on the
## zone, one after another. Near a base the air defence answers: the C-RAM and the Patriot fire up at the incoming
## missiles and catch some of them in the air. The HUD warns and shows how far away the zone is.

signal warned(text: String)

const WARN := 20.0                   # sirens this long before the first impact
const CLEAR := 9.0                   # the sirens stop this long after the last one

var world: World
var next_t := 100.0
var phase := ""                      # "", "warn", "strike", "clear"
var t := 0.0
var zone := Vector3.ZERO
var radius := 140.0
var count := 10
var fired := 0
var sirens: Array[AudioStreamPlayer3D] = []
var jets: Array[Node3D] = []
var enabled := true
var raid_snd: AudioStreamPlayer

func setup(w: World) -> void:
	world = w
	next_t = randf_range(80.0, 120.0)

func _process(delta: float) -> void:
	if world == null or not world.ready_built or not enabled:
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
			# one missile every 0.6 - 1.4 s
			if fired < count and t >= float(fired) * randf_range(0.6, 1.4):
				_strike()
			if fired >= count and t > float(count) * 1.4 + 6.0:
				phase = "clear"
				t = 0.0
		"clear":
			t += delta
			_fly_jets(delta)
			if t >= CLEAR:
				_stop()

## a raid now, on a zone near the player (or on the given point)
func start(at := Vector3.INF) -> void:
	if phase != "":
		return
	var focus := world.phys_focus if world.phys_set else world.focus
	if at != Vector3.INF:
		zone = at
	elif randf() < 0.6:
		var a := randf() * TAU
		var d := randf_range(90.0, 320.0)
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
	count = randi_range(8, 14)
	fired = 0
	phase = "warn"
	t = 0.0
	_sirens()
	_launch_jets()
	var d2 := Vector2(zone.x - focus.x, zone.z - focus.z).length()
	warned.emit("إنذار غارة جوية! الصواريخ بعد %d ثانية — %d م %s" % [int(WARN), int(d2), _bearing(focus, zone)])
	raid_snd = Sfx.play("hypersonic_raid", -6.0 if d2 < 600.0 else -16.0, 0.0, "Ambience")

func _bearing(from: Vector3, to: Vector3) -> String:
	var a := rad_to_deg(atan2(to.x - from.x, -(to.z - from.z)))
	var names := ["شمالاً", "شمال شرق", "شرقاً", "جنوب شرق", "جنوباً", "جنوب غرب", "غرباً", "شمال غرب"]
	return names[int(fposmod(a + 22.5, 360.0) / 45.0) % 8]

func _sirens() -> void:
	# three sirens around the zone, on poles above the roofs; heard across the valley
	for k in 3:
		var a := TAU * k / 3.0 + 0.4
		var p := zone + Vector3(cos(a) * radius * 0.8, 0.0, sin(a) * radius * 0.8)
		p.y = world.height(p.x, p.z) + 14.0
		var holder := Node3D.new()
		add_child(holder)
		holder.global_position = p
		var s := Sfx.loop_at("siren_loop", holder, 14.0, 120.0, 4000.0)
		if s:
			s.pitch_scale = 1.0 + k * 0.03
			s.attenuation_filter_cutoff_hz = 6000.0
			sirens.append(s)

func _launch_jets() -> void:
	# two fighters cross over the zone at 300 m, 260 m/s, one behind the other
	var dir := Vector3(randf_range(-1, 1), 0, randf_range(-1, 1)).normalized()
	var scene := load("res://models/u/j36.glb") as PackedScene
	for k in 2:
		var j: Node3D = scene.instantiate()
		add_child(j)
		var side := Vector3(-dir.z, 0, dir.x) * (k * 60.0 - 30.0)
		var start := zone - dir * 5200.0 + side + Vector3(0, 300.0 + k * 40.0, 0)
		j.global_position = start
		j.look_at(start + dir, Vector3.UP)
		j.rotate_object_local(Vector3.UP, PI)     # the model's nose is +Z
		j.set_meta("v", dir * 260.0)
		j.set_meta("delay", WARN - 7.0 + k * 1.2)
		j.set_meta("flyby", false)
		j.visible = false
		Sfx.loop_at("jet_loop", j, 12.0, 120.0, 3500.0)
		jets.append(j)

func _fly_jets(delta: float) -> void:
	var cam := get_viewport().get_camera_3d()
	for j in jets:
		var dl: float = float(j.get_meta("delay")) - delta
		j.set_meta("delay", dl)
		if dl > 0.0:
			continue
		j.visible = true
		var v: Vector3 = j.get_meta("v")
		j.global_position += v * delta
		if cam and not bool(j.get_meta("flyby")):
			var to := cam.global_position - j.global_position
			if to.dot(v) > 0.0 and to.length() < 1600.0:
				j.set_meta("flyby", true)
				Sfx.play_at("jet_flyby", j.global_position + v * 2.0, 14.0, 160.0, 0.0, 0.0, 0.03)

func _strike() -> void:
	fired += 1
	var a := randf() * TAU
	var r := sqrt(randf()) * radius
	var hit := zone + Vector3(cos(a) * r, 0.0, sin(a) * r)
	hit.y = world.height(hit.x, hit.z)
	# they come in steep from high up, from the side the jets went
	var from := hit + Vector3(randf_range(-250, 250), 1400.0, randf_range(-250, 250))
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

func _stop() -> void:
	phase = ""
	next_t = randf_range(150.0, 260.0)
	for s in sirens:
		var h := s.get_parent()
		var tw := create_tween()
		tw.tween_property(s, "volume_db", -60.0, 4.0)
		tw.tween_callback(h.queue_free)
	sirens.clear()
	for j in jets:
		j.queue_free()
	jets.clear()
	warned.emit("انتهت الغارة — السماء صافية")
