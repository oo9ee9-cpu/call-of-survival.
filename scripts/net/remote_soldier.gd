class_name RemoteSoldier
extends CharacterBody3D
## Another player in the same match, as seen here: his soldier moving between the states his game sends (shown a
## little behind time so the gaps between them are smooth), his name over his head in his team's colour, the shots he
## fires. Our hits on him are sent to his game, which decides what they do.

var coop: Coop
var id := ""
var team := 0
var who := ""
var dead := false
var health := 100.0
var crouch := false
var gun := "ak"
var in_vehicle := false
var body: Soldier
var label: Label3D
var col: CollisionShape3D
var cap: CapsuleShape3D
var snaps: Array = []               # [time, position, yaw, pitch]
var delay := 0.3                    # how far behind his time we show him
var _shots := 0
var _shot_gap := 0.1
var _shot_t := 0.0
var _last := 0.0

func setup(c: Coop, pid: String, t: int, nm: String) -> void:
	coop = c
	id = pid
	team = t
	who = nm

func _ready() -> void:
	add_to_group("soldiers")
	collision_layer = 4
	collision_mask = 0
	cap = CapsuleShape3D.new()
	cap.radius = 0.3
	cap.height = 1.8
	col = CollisionShape3D.new()
	col.shape = cap
	col.position.y = 0.9
	add_child(col)
	body = Soldier.new()
	add_child(body)
	body.set_shadows(false)
	body.set_weapon.call_deferred(gun)
	label = Label3D.new()
	label.text = who
	label.position.y = 2.25
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.no_depth_test = true
	label.fixed_size = true
	label.pixel_size = 0.0016
	label.font_size = 30
	label.outline_size = 8
	label.modulate = Color(0.45, 0.75, 1.0) if team == 0 else Color(1.0, 0.45, 0.4)
	if UiTheme.font_bold:
		label.font = UiTheme.font_bold
	add_child(label)

## a state from his game: where he is, where he looks, what he holds, how many shots he fired since the last one
func push_state(d: Dictionary) -> void:
	var now := Time.get_ticks_msec() * 0.001
	var x = d.get("x", [])
	if not (x is Array) or (x as Array).size() < 3:
		return
	var pos := Vector3(float(x[0]), float(x[1]), float(x[2]))
	if snaps.is_empty() or pos.distance_to(snaps[-1][1]) > 40.0:
		snaps.clear()             # a jump (respawn, parachute start): no sliding across the map
		global_position = pos
	snaps.append([now, pos, float(d.get("y", 0.0)), float(d.get("a", 0.0))])
	while snaps.size() > 10:
		snaps.pop_front()
	var rate := maxf(float(d.get("r", 6.0)), 1.0)
	delay = clampf(1.6 / rate, 0.15, 0.8)
	var was_dead := dead
	dead = bool(d.get("d", false))
	if was_dead and not dead:
		body.revive()
	body.dead = dead
	health = float(d.get("h", 100.0))
	var c := int(d.get("c", 0)) == 1
	if c != crouch:
		crouch = c
		cap.height = 1.2 if c else 1.8
		col.position.y = cap.height * 0.5
	var g := String(d.get("g", gun))
	if g != gun and g != "":
		gun = g
		body.set_weapon(g)
	in_vehicle = int(d.get("e", 0)) == 1
	var s := int(d.get("s", 0))
	if s > 0:
		_shots = mini(_shots + s, 30)
		_shot_gap = clampf((1.0 / rate) / s, 0.05, 0.3)
	_last = now
	collision_layer = 0 if dead or in_vehicle else 4

func _process(delta: float) -> void:
	if snaps.is_empty():
		return
	var rt := Time.get_ticks_msec() * 0.001 - delay
	var a: Array = snaps[0]
	var b: Array = snaps[-1]
	for i in range(snaps.size() - 1):
		if float(snaps[i][0]) <= rt and float(snaps[i + 1][0]) >= rt:
			a = snaps[i]
			b = snaps[i + 1]
			break
	var f := 0.0
	if float(b[0]) > float(a[0]):
		f = clampf((rt - float(a[0])) / (float(b[0]) - float(a[0])), 0.0, 1.0)
	var pos: Vector3 = (a[1] as Vector3).lerp(b[1], f)
	var vel := Vector3.ZERO
	if float(b[0]) > float(a[0]):
		vel = ((b[1] as Vector3) - (a[1] as Vector3)) / (float(b[0]) - float(a[0]))
	global_position = pos
	var yaw := lerp_angle(float(a[2]), float(b[2]), f)
	body.aim_yaw = yaw
	body.aim_pitch = lerpf(float(a[3]), float(b[3]), f)
	body.speed = Vector2(vel.x, vel.z).length()
	body.move_dir = Vector2(vel.x, vel.z).normalized() if body.speed > 0.1 else Vector2.ZERO
	body.crouch = move_toward(body.crouch, 1.0 if crouch else 0.0, delta * 4.0)
	body.low_ready = 0.0 if _shots > 0 else 0.5
	body.face(delta, _shots > 0)
	body.visible = not in_vehicle
	label.visible = not dead and not in_vehicle
	# the level of detail by distance from our camera, like the bots
	var cam := get_viewport().get_camera_3d()
	if cam:
		var dist := cam.global_position.distance_to(global_position)
		body.set_lod(0 if dist < 35.0 else (1 if dist < 120.0 else (2 if dist < 450.0 else 3)))
	# his shots, spread over the time between his states
	if _shots > 0 and not dead:
		_shot_t -= delta
		if _shot_t <= 0.0:
			_shot_t = _shot_gap
			_shots -= 1
			body.shot_flash()
			var cp := cam.global_position if cam else global_position
			var dc := cp.distance_to(global_position)
			if dc < 600.0:
				var spec: Dictionary = Guns.DATA.get(gun, {})
				Sfx.play_at("enemy_fire" if dc > 90.0 else String(spec.get("sound", "ak_shot")), global_position + Vector3(0, 1.5, 0), -4.0 if dc < 90.0 else 2.0, 12.0, 700.0, 0.0, 0.08)
	elif dead:
		_shots = 0

## our shot hit him: his game decides
func take_damage(amount: float, from: Vector3, attacker: Node = null) -> void:
	if dead or coop == null:
		return
	var head := from.y - global_position.y > (0.95 if crouch else 1.45)
	coop.send_hit(id, amount, head, from, attacker)
