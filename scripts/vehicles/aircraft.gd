class_name Aircraft
extends Vehicle
## Jets and helicopters you can fly. The landing gear is a set of Godot raycast wheels (taxiing, taking off and landing,
## also on a carrier's deck); in the air an arcade flight model takes over.
## Jets: thrust, lift from the angle of attack (stalls past ~16 degrees), drag, the nose weathervaning into the airflow,
## controls that bite harder with speed. Helicopters: collective lift (it holds its height when you let go), the
## cyclic tilts it, pedals turn it, it levels itself when the stick is centred.
## Controls (ctl): x roll / turn (-1 .. 1), y pitch (stick back = nose up, +1), z yaw, w throttle or collective (0 .. 1).

const AIR := {
	"j36": {"scene": "res://models/u/j36.glb", "title": "مقاتلة J-36", "type": "jet", "mass": 19000.0, "thrust": 210000.0,
		"area": 75.0, "vstall": 62.0, "vmax": 420.0, "rates": Vector3(1.6, 3.2, 0.5), "gear": [Vector3(0, 0, 7.5), Vector3(2.6, 0, -1.5), Vector3(-2.6, 0, -1.5)],
		"gear_r": 0.55, "seats": [Vector3(0, 2.3, 6.2)], "cam": Vector2(26.0, 6.0), "eye": Vector3(0, 2.8, 6.4), "health": 1400.0,
		"sound": "jet_loop", "start": "engine_start_diesel", "weapons": ["gun", "missile"]},
	"b2": {"scene": "res://models/u/b2.glb", "title": "قاذفة B-2", "type": "jet", "mass": 72000.0, "thrust": 360000.0,
		"area": 470.0, "vstall": 70.0, "vmax": 300.0, "rates": Vector3(0.7, 1.1, 0.25), "gear": [Vector3(0, 0, 6.5), Vector3(5.5, 0, -2.0), Vector3(-5.5, 0, -2.0)],
		"gear_r": 0.7, "seats": [Vector3(0.6, 3.4, 6.5), Vector3(-0.6, 3.4, 6.5)], "cam": Vector2(52.0, 12.0), "eye": Vector3(0.6, 3.9, 7.2), "health": 3000.0,
		"sound": "jet_loop", "start": "engine_start_diesel", "weapons": ["bomb"]},
	"mi171": {"scene": "res://models/u/mi171.glb", "title": "مروحية Mi-171", "type": "heli", "mass": 11000.0, "lift": 2.2,
		"vmax": 75.0, "rates": Vector3(1.2, 1.0, 1.4), "gear": [Vector3(0, 0, 4.2), Vector3(1.6, 0, -1.2), Vector3(-1.6, 0, -1.2)],
		"gear_r": 0.4, "seats": [Vector3(0.6, 2.1, 4.6), Vector3(-0.6, 2.1, 4.6), Vector3(0.7, 1.4, 1.5), Vector3(-0.7, 1.4, 1.5), Vector3(0.7, 1.4, 0.0), Vector3(-0.7, 1.4, 0.0)],
		"cam": Vector2(22.0, 5.0), "eye": Vector3(0.6, 2.7, 4.9), "health": 1600.0, "sound": "heli_loop", "start": "engine_start_diesel",
		"rotor": "Object_3", "weapons": ["rocket"]},
	"chinook": {"scene": "res://models/u/chinook.glb", "title": "مروحية شينوك", "type": "heli", "mass": 15000.0, "lift": 2.0,
		"vmax": 80.0, "rates": Vector3(0.9, 0.8, 1.0), "gear": [Vector3(1.4, 0, 6.5), Vector3(-1.4, 0, 6.5), Vector3(1.4, 0, -4.5), Vector3(-1.4, 0, -4.5)],
		"gear_r": 0.5, "seats": [Vector3(0.6, 2.4, 7.6), Vector3(-0.6, 2.4, 7.6), Vector3(0.8, 1.2, 3.0), Vector3(-0.8, 1.2, 3.0), Vector3(0.8, 1.2, 0.5), Vector3(-0.8, 1.2, 0.5), Vector3(0.8, 1.2, -2.0), Vector3(-0.8, 1.2, -2.0)],
		"cam": Vector2(28.0, 6.0), "eye": Vector3(0.6, 3.0, 8.0), "health": 2000.0, "sound": "heli_loop", "start": "engine_start_diesel",
		"rotor": "Object_6,Object_7,Object_8,Object_9", "weapons": []},
}

var heli := false
var throttle := 0.0
var rotor_spin := 0.0
var rotors: Array[Node3D] = []
var rotor_axes: Array[Vector3] = []
var on_ground := true
var gear_wheels: Array[VehicleWheel3D] = []
var alt := 0.0
var aoa := 0.0
var snd_wind: AudioStreamPlayer3D
var gun_t := 0.0
var store_t := 0.0
var stores := 0                      # missiles / bombs / rockets left

func _spec() -> Dictionary:
	return AIR[kind]

func _build() -> void:
	heli = String(spec["type"]) == "heli"
	# the body: the model's bounds; the gear: raycast wheels where the spec says
	var all: Array[MeshInstance3D] = []
	Vehicle.meshes_of(model, all)
	var box := AABB()
	var first := true
	var rot_names := String(spec.get("rotor", "")).split(",", false)
	for mi in all:
		var a := Vehicle.rel_xf(mi, self) * mi.mesh.get_aabb()
		if rot_names.has(String(mi.name)):
			_rotor(mi, a)
			continue
		box = a if first else box.merge(a)
		first = false
	var r := float(spec.get("gear_r", 0.5))
	for g in spec["gear"]:
		var gp: Vector3 = g
		var w := VehicleWheel3D.new()
		w.position = Vector3(gp.x, box.position.y + r + 0.35, gp.z)
		w.wheel_radius = r
		w.wheel_rest_length = 0.35
		w.suspension_travel = 0.3
		w.suspension_stiffness = 60.0 if not heli else 45.0
		w.suspension_max_force = mass * 9.8 * 3.0
		w.damping_compression = 1.2
		w.damping_relaxation = 1.8
		w.wheel_friction_slip = 4.0
		w.wheel_roll_influence = 0.05
		w.use_as_steering = gp.z > 2.0 and not heli
		w.use_as_traction = false
		add_child(w)
		wheels.append(w)
		gear_wheels.append(w)
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	# a fuselage box (the wings do not collide: landing on a deck needs only the gear)
	bs.size = Vector3(minf(box.size.x, 3.6 if not heli else box.size.x * 0.4), box.size.y * 0.7, box.size.z * 0.9)
	cs.shape = bs
	cs.position = Vector3(box.get_center().x, box.position.y + r * 2.0 + 0.3 + bs.size.y * 0.5, box.get_center().z)
	add_child(cs)
	half_size = Vector3(box.size.x * 0.5, box.size.y * 0.5, box.size.z * 0.5)
	center_of_mass_mode = RigidBody3D.CENTER_OF_MASS_MODE_CUSTOM
	center_of_mass = Vector3(0, cs.position.y - bs.size.y * 0.2, box.get_center().z)
	angular_damp = 1.5
	snd_wind = Sfx.loop_at("wind_loop", self, -80.0, 8.0, 120.0)
	stores = {"j36": 6, "b2": 16, "mi171": 32, "chinook": 0}.get(kind, 0)

## a rotor mesh: spun about its own vertical axis through the middle of its disc
func _rotor(mi: MeshInstance3D, a: AABB) -> void:
	var pivot := Node3D.new()
	add_child(pivot)
	pivot.position = a.get_center()
	var xf := Vehicle.rel_xf(mi, self)
	mi.get_parent().remove_child(mi)
	pivot.add_child(mi)
	mi.transform = pivot.transform.affine_inverse() * xf
	rotors.append(pivot)
	# the blades lie in the plane of the two longest sides; the axis is the shortest
	var ax := Vector3.UP
	if a.size.x < a.size.y and a.size.x < a.size.z:
		ax = Vector3.RIGHT
	elif a.size.z < a.size.y and a.size.z < a.size.x:
		ax = Vector3.BACK
	rotor_axes.append(ax)

func _drive(delta: float) -> void:
	var has_driver := driver() != null
	on_ground = false
	for w in gear_wheels:
		if w.is_in_contact():
			on_ground = true
	alt = global_position.y - (world.height(global_position.x, global_position.z) if world else 0.0)
	if not has_driver:
		throttle = move_toward(throttle, 0.0, delta * 0.3)
		brake = 30.0
		engine_force = 0.0
		steering = 0.0
		if not on_ground:
			_aero(delta, Vector4.ZERO)
		_spin_rotors(delta)
		return
	var c4 := Vector4(ctl.x, ctl.y, ctl.z, clampf(throttle, 0.0, 1.0))
	if heli:
		_heli(delta, c4)
	else:
		_aero(delta, c4)
	# on the ground: wheel brakes when the throttle is down, nose-wheel steering with the rudder
	brake = 25.0 if throttle < 0.08 and on_ground else 0.0
	steering = move_toward(steering, -ctl.z * 0.5, delta * 2.0)
	engine_force = 0.0
	_spin_rotors(delta)
	rpm = clampf(throttle, 0.0, 1.0)

## jets: the throttle stays where you leave it; helicopters: the collective springs back to "hold my height"
func set_throttle_input(d: float, delta: float) -> void:
	if heli:
		var want := 0.5 + d * 0.5
		if on_ground and d <= 0.0:
			want = 0.0
		throttle = move_toward(throttle, want, delta * 2.0)
	else:
		throttle = clampf(throttle + d * delta * 0.5, 0.0, 1.0)

func _aero(_delta: float, c: Vector4) -> void:
	var b := global_transform.basis
	var fwd := b.z
	var up := b.y
	var right := -b.x
	var v := linear_velocity
	var sp := v.length()
	var q := 0.5 * 1.2 * sp * sp
	var area := float(spec.get("area", 60.0))
	var thrust := float(spec.get("thrust", 100000.0))
	# thrust (afterburner above 90 %)
	apply_central_force(fwd * thrust * c.w * (1.35 if c.w > 0.9 else 1.0))
	if sp < 1.0:
		return
	var vd := v / sp
	# angle of attack in the pitch plane, sideslip in the yaw plane
	aoa = atan2(-vd.dot(up), vd.dot(fwd))
	var beta := atan2(vd.dot(right), vd.dot(fwd))
	var cl := 0.0
	var a_deg := rad_to_deg(aoa)
	if absf(a_deg) < 16.0:
		cl = aoa * 5.0
	else:
		cl = signf(aoa) * maxf(1.4 - (absf(a_deg) - 16.0) * 0.06, 0.25)
	cl += 0.25 * (1.0 - absf(aoa) * 2.0)    # camber: a little lift at zero angle
	var lift_dir := vd.cross(right).normalized()
	if lift_dir.dot(up) < 0.0:
		lift_dir = -lift_dir
	# ground effect: a little more lift within half a wingspan of the ground (the flare before touchdown)
	var ge := 1.0 + clampf(1.0 - alt / maxf(half_size.x, 4.0), 0.0, 1.0) * 0.25
	apply_central_force(lift_dir * q * area * cl * ge)
	var cd := 0.02 + 0.06 * cl * cl + absf(beta) * 0.3
	apply_central_force(-vd * q * area * cd)
	# the airflow turns the nose into it (weathervane) and damps wobbles
	var auth := clampf(sp / float(spec.get("vstall", 60.0)), 0.15, 1.6)
	var rates: Vector3 = spec.get("rates", Vector3(1, 2, 0.5))
	# (on the ground the gear holds the nose down: much more pitch authority to rotate for take-off)
	var inertia_k := mass * (9.0 if on_ground else 3.0)
	var target_w := right * (c.y * rates.x) - fwd * (c.x * rates.y) + up * (-c.z * rates.z)
	# fly-by-wire: steer the angular velocity towards what the stick asks, with authority from the airspeed
	var w_err := target_w * auth - angular_velocity
	apply_torque(w_err * inertia_k * 3.0 * auth)
	apply_torque(right * (-aoa) * q * area * 0.02 * (1.0 if absf(c.y) < 0.1 else 0.2))
	apply_torque(up * (beta) * q * area * 0.02)
	# a gentle bank turns it (coordinated turn)
	var bank := asin(clampf(-b.x.y, -1.0, 1.0))
	apply_torque(Vector3.UP * (-bank) * mass * 0.6 * auth)

func _heli(delta: float, c: Vector4) -> void:
	var b := global_transform.basis
	var up := b.y
	var fwd := b.z
	var right := -b.x
	var g := 9.8 * mass
	# collective: 0.5 holds the height, 1 climbs at 12 m/s, 0 sinks at 12 m/s (0 on the ground: sits still)
	var col := c.w
	var vs_want := (col - 0.5) * 24.0
	var lift := mass * (9.8 + clampf((vs_want - linear_velocity.y) * 1.6, -9.8, 9.8)) / maxf(up.y, 0.4)
	lift = clampf(lift, 0.0, g * float(spec.get("lift", 2.0)))
	if on_ground and col < 0.05:
		lift = 0.0
	if rotor_spin < 0.85:
		lift *= rotor_spin * rotor_spin
	apply_central_force(up * lift)
	# cyclic: tilt towards the stick; level itself when the stick is centred
	var rates: Vector3 = spec.get("rates", Vector3(1, 1, 1))
	var want_pitch := -c.y * 0.42
	var want_roll := c.x * 0.5
	var pitch_now := asin(clampf(fwd.y, -1.0, 1.0))
	var roll_now := asin(clampf(-right.y, -1.0, 1.0))
	var tq := right * (want_pitch - pitch_now) * rates.x * 4.0 * -1.0 + fwd * (want_roll - roll_now) * rates.y * 4.0 * -1.0
	tq += up * (-c.z * rates.z * 1.6 - angular_velocity.dot(up) * 1.5)
	apply_torque((tq - angular_velocity * 1.8) * mass * 2.2)
	# drag
	var v := linear_velocity
	apply_central_force(-v * v.length() * 0.9 - Vector3(v.x, 0, v.z) * mass * 0.05)
	throttle = c.w

func _spin_rotors(delta: float) -> void:
	var target := 1.0 if (engine_on and driver() != null) else 0.0
	rotor_spin = move_toward(rotor_spin, target, delta * (0.25 if target > 0.5 else 0.12))
	for i in rotors.size():
		rotors[i].rotate_object_local(rotor_axes[i], rotor_spin * delta * (24.0 if i == 0 else -24.0))

func _sounds(delta: float) -> void:
	var running := engine_on and (driver() != null or rotor_spin > 0.05 or throttle > 0.02)
	if snd_engine:
		var k := rotor_spin if heli else clampf(throttle, 0.0, 1.0)
		snd_engine.volume_db = lerpf(-14.0, 4.0, k) if running else -80.0
		snd_engine.pitch_scale = (0.55 + rotor_spin * 0.45) if heli else (0.7 + k * 0.6)
		snd_engine.max_distance = 1800.0
		snd_engine.unit_size = 25.0
	if snd_wind:
		var sp := linear_velocity.length()
		snd_wind.volume_db = lerpf(-50.0, -6.0, clampf(sp / 200.0, 0.0, 1.0)) if sp > 20.0 else -80.0
	if snd_skid:
		snd_skid.volume_db = -80.0

func _self_right(_delta: float) -> void:
	pass

func update_camera(delta: float) -> void:
	var c: Vector2 = spec.get("cam", Vector2(20, 5))
	cam_idle += delta
	if cam_idle > 1.0:
		cam_yaw = lerp_angle(cam_yaw, 0.0, clampf(delta * 2.0, 0.0, 1.0))
		cam_pitch = lerpf(cam_pitch, -0.12, clampf(delta * 1.5, 0.0, 1.0))
	if first_person:
		var eye: Vector3 = spec.get("eye", Vector3(0, 2, 2))
		cam_arm.spring_length = 0.0
		cam_rig.global_transform = global_transform * Transform3D(Basis.from_euler(Vector3(cam_pitch * 0.5, PI + cam_yaw, 0.0)), eye)
		return
	cam_arm.spring_length = c.x
	# chase: follow the nose with a lag, keep the horizon level-ish
	var b := global_transform.basis
	var yaw := atan2(b.z.x, b.z.z)
	var pitch := asin(clampf(b.z.y, -1.0, 1.0))
	var target := global_position + Vector3(0, c.y, 0)
	cam_rig.global_position = target
	var want := Vector3(-pitch * 0.6 + cam_pitch, yaw + PI + cam_yaw, 0.0)
	var cur := cam_rig.global_rotation
	cam_rig.global_rotation = Vector3(lerp_angle(cur.x, want.x, clampf(delta * 4.0, 0.0, 1.0)), lerp_angle(cur.y, want.y, clampf(delta * 5.0, 0.0, 1.0)), 0.0)

## the speed shown on the HUD (km/h), the height above the ground, the engine, what is left to fire
func hud_text() -> String:
	var w: Array = spec.get("weapons", [])
	var st := ""
	if w.has("missile"):
		st = "   صواريخ %d" % stores
	elif w.has("bomb"):
		st = "   قنابل %d" % stores
	elif w.has("rocket"):
		st = "   صواريخ %d" % stores
	return "%d كم/س   الارتفاع %d م   المحرك %d%%%s" % [int(linear_velocity.length() * 3.6), int(alt), int(throttle * 100.0), st]

# ------------------------------------------------------------------ weapons
## the nose gun (jets) or the rocket pods (helicopters), held down
func fire_primary() -> void:
	var w: Array = spec.get("weapons", [])
	var b := global_transform.basis
	var t := Time.get_ticks_msec() / 1000.0
	if w.has("gun"):
		if t - gun_t < 0.066:
			return
		gun_t = t
		var muzzle := global_transform * Vector3(0.9, 1.4, half_size.z * 0.8)
		var spread := Vector3(randf_range(-1, 1), randf_range(-1, 1), 0.0) * 0.004
		world.projectiles.fire("round", muzzle, linear_velocity + (b.z + b * spread).normalized() * 0.01, self)
		Sfx.play_at("plane_gun", muzzle, 2.0, 30.0, 0.0, 0.0, 0.05)
	elif w.has("rocket") and stores > 0:
		if t - gun_t < 0.25:
			return
		gun_t = t
		stores -= 1
		var side := 1.0 if stores % 2 == 0 else -1.0
		var p := global_transform * Vector3(side * 2.2, 1.2, 1.0)
		world.projectiles.fire("rocket", p, linear_velocity + b.z * 0.01, self)
		Sfx.play_at("rocket_launch", p, 4.0, 25.0)

## guided missiles (jets) or bombs (bombers), one per press
func fire_secondary() -> void:
	var w: Array = spec.get("weapons", [])
	var t := Time.get_ticks_msec() / 1000.0
	if stores <= 0 or t - store_t < 0.6:
		return
	store_t = t
	var b := global_transform.basis
	if w.has("missile"):
		stores -= 1
		var side := 1.0 if stores % 2 == 0 else -1.0
		var p := global_transform * Vector3(side * 3.0, 0.6, 0.5)
		world.projectiles.fire("missile", p, linear_velocity + b.z * 0.01, self, _target_ahead(), _point_ahead())
		Sfx.play_at("rocket_launch", p, 6.0, 30.0)
	elif w.has("bomb"):
		stores -= 1
		var p := global_transform * Vector3(0.0, 0.8, 0.0)
		world.projectiles.fire("guided_bomb" if stores % 2 == 0 else "bomb", p, linear_velocity - b.y * 2.0, self, null, _point_ahead())

## the nearest vehicle in a narrow cone ahead (for the missiles)
func _target_ahead() -> Node3D:
	var best: Node3D = null
	var bd := 2500.0
	var f := global_transform.basis.z
	for n in get_tree().get_nodes_in_group("vehicles"):
		var v := n as Vehicle
		if v == null or v == self or v.dead:
			continue
		var to := v.global_position - global_position
		var d := to.length()
		if d < bd and d > 30.0 and to.normalized().dot(f) > 0.94:
			bd = d
			best = v
	return best

## where the gunsight points on the ground (for guided bombs and missiles with no vehicle to chase)
func _point_ahead() -> Vector3:
	var p := global_position
	var d := (global_transform.basis.z * 0.8 - global_transform.basis.y * 0.6).normalized()
	for k in 200:
		p += d * 15.0
		if p.y < world.height(p.x, p.z):
			return p
	return Vector3.INF
