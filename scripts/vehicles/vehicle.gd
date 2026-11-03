class_name Vehicle
extends VehicleBody3D
## A vehicle you can drive or fly: one of the owner's models (or the UAZ) on Godot's raycast wheels. The model's own
## wheel meshes are found by name and hung on the wheels, so they turn, steer and ride the suspension. Seats, a chase
## camera that keeps out of walls, the engine heard by its revs, tyres squealing when they slide, damage and burning out.
## Aircraft (Aircraft) are vehicles too: the same seats, camera, damage and landing gear, with a flight model on top.
## Like glTF models, every vehicle faces +Z (Godot's VehicleBody3D drives along +Z too).

signal destroyed(v: Vehicle)

const LAYER := 8                     # vehicles' collision layer (terrain 1, buildings 2, soldiers 4)
const GROUND := {
	"uaz": {"scene": "res://models/vehicles/uaz.glb", "title": "جيب UAZ-469", "mass": 1650.0, "power": 4300.0, "vmax": 31.0,
		"brake": 45.0, "steer": 0.55, "wheels": ["wheel_"], "stiff": 40.0, "rest": 0.24, "travel": 0.24, "grip": 10.5,
		"sound": "eng_car", "start": "engine_start", "seats": [Vector3(0.4, 1.15, 0.05), Vector3(-0.4, 1.15, 0.05), Vector3(0.4, 1.15, -0.85), Vector3(-0.4, 1.15, -0.85)],
		"cam": Vector2(6.0, 1.9), "eye": Vector3(0.4, 1.62, 0.1), "health": 900.0, "open": true},
	"ar55": {"scene": "res://models/u/ar55.glb", "title": "زاستافا AR-55", "mass": 1900.0, "power": 4800.0, "vmax": 30.0,
		"brake": 50.0, "steer": 0.55, "wheels": ["zastavaar55_wheel"], "stiff": 42.0, "rest": 0.24, "travel": 0.24, "grip": 10.0,
		"sound": "eng_car", "start": "engine_start", "seats": [Vector3(0.38, 1.15, 0.1), Vector3(-0.38, 1.15, 0.1), Vector3(0.38, 1.15, -0.9), Vector3(-0.38, 1.15, -0.9)],
		"cam": Vector2(6.0, 1.9), "eye": Vector3(0.38, 1.62, 0.15), "health": 950.0, "open": true},
	"fennek": {"scene": "res://models/u/fennek.glb", "title": "مدرّعة فينك", "mass": 9500.0, "power": 19000.0, "vmax": 30.0,
		"brake": 160.0, "steer": 0.45, "wheels": ["wheel", "tire"], "stiff": 75.0, "rest": 0.28, "travel": 0.26, "grip": 9.0,
		"sound": "eng_diesel", "start": "engine_start_diesel", "seats": [Vector3(0.55, 1.5, 0.6), Vector3(-0.55, 1.5, 0.6), Vector3(0.0, 2.2, -0.6)],
		"cam": Vector2(8.0, 2.6), "eye": Vector3(0.55, 2.05, 0.75), "health": 2600.0, "open": false},
	"tam150": {"scene": "res://models/u/tam150.glb", "title": "شاحنة TAM 150", "mass": 8800.0, "power": 15000.0, "vmax": 24.0,
		"brake": 150.0, "steer": 0.5, "wheels": ["Wheel_"], "stiff": 85.0, "rest": 0.3, "travel": 0.3, "grip": 9.5,
		"sound": "eng_diesel", "start": "engine_start_diesel", "seats": [Vector3(0.55, 2.0, 2.6), Vector3(-0.55, 2.0, 2.6), Vector3(0.6, 1.9, -1.0), Vector3(-0.6, 1.9, -1.0), Vector3(0.6, 1.9, -2.2), Vector3(-0.6, 1.9, -2.2)],
		"cam": Vector2(10.0, 3.2), "eye": Vector3(0.55, 2.55, 2.75), "health": 1800.0, "open": false},
}

var kind := ""
var spec: Dictionary
var title := ""
var model: Node3D
var wheels: Array[VehicleWheel3D] = []
var front: Array[VehicleWheel3D] = []
var rear: Array[VehicleWheel3D] = []
var occupants: Array = []            # Player (or bot) per seat, null when free
var health := 1000.0
var max_health := 1000.0
var dead := false
var world: World
# the driver's controls this frame: x steer (-1 left .. 1 right), y throttle (-1 brake/reverse .. 1), z handbrake
var ctl := Vector3.ZERO
var engine_on := false
var rpm := 0.0                       # 0..1 of the band of the current gear
var gear := 1
# camera
var cam_rig: Node3D
var cam_arm: SpringArm3D
var cam: Camera3D
var cam_yaw := 0.0
var cam_pitch := -0.18
var cam_idle := 0.0
var first_person := false
var snd_engine: AudioStreamPlayer3D
var snd_skid: AudioStreamPlayer3D
var _flip_t := 0.0
var _last_v := Vector3.ZERO
var half_size := Vector3(1, 1, 2)
var wheelbase := 2.5
var burn: Node3D
var _lod_t := 0.0

func _ready() -> void:
	spec = _spec()
	title = String(spec.get("title", kind))
	add_to_group("vehicles")
	collision_layer = LAYER
	collision_mask = 1 | 2 | LAYER
	mass = float(spec["mass"])
	max_health = float(spec.get("health", 1000.0))
	health = max_health
	model = (load(String(spec["scene"])) as PackedScene).instantiate()
	add_child(model)
	_build()
	var seats: Array = spec["seats"]
	occupants.resize(seats.size())
	_camera_rig()
	snd_engine = Sfx.loop_at(String(spec.get("sound", "eng_car")), self, -80.0, 6.0, 260.0)
	snd_skid = Sfx.loop_at("skid_loop", self, -80.0, 4.0, 80.0)
	if snd_engine:
		snd_engine.stream_paused = true
	contact_monitor = true
	max_contacts_reported = 4
	body_entered.connect(_on_hit)
	can_sleep = true
	# parked vehicles wait frozen until a soldier comes near (the ground has colliders only around the player)
	freeze_mode = RigidBody3D.FREEZE_MODE_STATIC
	freeze = true

func _spec() -> Dictionary:
	return GROUND[kind]

# ------------------------------------------------------------------ building the body from the model
## transform of a node relative to an ancestor
static func rel_xf(n: Node, root: Node) -> Transform3D:
	var t := Transform3D()
	var c := n
	while c != null and c != root:
		if c is Node3D:
			t = (c as Node3D).transform * t
		c = c.get_parent()
	return t

static func meshes_of(n: Node, out: Array[MeshInstance3D]) -> void:
	if n is MeshInstance3D and (n as MeshInstance3D).mesh != null:
		out.append(n)
	for c in n.get_children():
		meshes_of(c, out)

func _build() -> void:
	var all: Array[MeshInstance3D] = []
	meshes_of(model, all)
	var pats: Array = spec.get("wheels", [])
	var wheel_meshes: Array[MeshInstance3D] = []
	var body_box := AABB()
	var first := true
	for mi in all:
		var nm := String(mi.name).to_lower()
		var is_wheel := false
		for p in pats:
			if nm.begins_with(String(p).to_lower()):
				is_wheel = true
		var a := rel_xf(mi, self) * mi.mesh.get_aabb()
		if is_wheel:
			wheel_meshes.append(mi)
		else:
			body_box = a if first else body_box.merge(a)
			first = false
	# group the wheel meshes (rim + tyre) by where their centres are
	var groups: Array = []
	for mi in wheel_meshes:
		var a := rel_xf(mi, self) * mi.mesh.get_aabb()
		var c := a.get_center()
		var placed := false
		for g in groups:
			if (g["c"] as Vector3).distance_to(c) < maxf(a.size.y * 0.3, 0.15):
				(g["m"] as Array).append(mi)
				g["r"] = maxf(float(g["r"]), a.size.y * 0.5)
				placed = true
				break
		if not placed:
			groups.append({"c": c, "r": a.size.y * 0.5, "m": [mi]})
	_make_wheels(groups)
	_make_body(body_box)

func _make_wheels(groups: Array) -> void:
	if groups.is_empty():
		return
	var zmin := INF
	var zmax := -INF
	for g in groups:
		zmin = minf(zmin, (g["c"] as Vector3).z)
		zmax = maxf(zmax, (g["c"] as Vector3).z)
	var zmid := (zmin + zmax) * 0.5
	wheelbase = maxf(zmax - zmin, 1.0)
	for g in groups:
		var c: Vector3 = g["c"]
		var w := VehicleWheel3D.new()
		w.position = c + Vector3(0, float(spec.get("rest", 0.25)) * 0.5, 0)
		w.wheel_radius = maxf(float(g["r"]), 0.2)
		w.wheel_rest_length = float(spec.get("rest", 0.25))
		w.suspension_travel = float(spec.get("travel", 0.25))
		w.suspension_stiffness = float(spec.get("stiff", 50.0))
		w.suspension_max_force = mass * 9.8 * 2.5
		w.damping_compression = 0.9
		w.damping_relaxation = 1.4
		w.wheel_friction_slip = float(spec.get("grip", 10.0))
		w.wheel_roll_influence = 0.08
		w.use_as_traction = true
		var is_front := c.z > zmid + 0.1
		w.use_as_steering = is_front
		add_child(w)
		# hang the model's wheel meshes on it, where they are
		for mi in g["m"]:
			var m: MeshInstance3D = mi
			var xf := rel_xf(m, self)
			m.get_parent().remove_child(m)
			w.add_child(m)
			m.transform = w.transform.affine_inverse() * xf
		wheels.append(w)
		if is_front:
			front.append(w)
		else:
			rear.append(w)

func _make_body(box: AABB) -> void:
	var wheel_top := box.position.y
	for w in wheels:
		wheel_top = maxf(wheel_top, w.position.y - w.wheel_rest_length * 0.5)
	var bottom := wheel_top + 0.05 if not wheels.is_empty() else box.position.y
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = Vector3(box.size.x * 0.96, maxf(box.end.y - bottom, 0.5), box.size.z * 0.97)
	cs.shape = bs
	cs.position = Vector3(box.get_center().x, (bottom + box.end.y) * 0.5, box.get_center().z)
	add_child(cs)
	half_size = bs.size * 0.5
	center_of_mass_mode = RigidBody3D.CENTER_OF_MASS_MODE_CUSTOM
	center_of_mass = Vector3(box.get_center().x, bottom + 0.15, box.get_center().z)

# ------------------------------------------------------------------ seats
func free_seat() -> int:
	for i in occupants.size():
		if occupants[i] == null:
			return i
	return -1

func seat_xf(i: int) -> Transform3D:
	var seats: Array = spec["seats"]
	return global_transform * Transform3D(Basis(), seats[clampi(i, 0, seats.size() - 1)])

func driver() -> Node:
	return occupants[0] if not occupants.is_empty() else null

func board(p: Node, seat := -1) -> int:
	if dead:
		return -1
	var i := seat if seat >= 0 and seat < occupants.size() and occupants[seat] == null else free_seat()
	if i < 0:
		return -1
	occupants[i] = p
	if i == 0:
		_start_engine()
	sleeping = false
	return i

func leave(p: Node) -> void:
	var i := occupants.find(p)
	if i < 0:
		return
	occupants[i] = null
	if i == 0:
		ctl = Vector3.ZERO

## a free spot beside the vehicle to step out to
func exit_point(i: int) -> Vector3:
	var side := 1.0 if i % 2 == 0 else -1.0
	for k in 4:
		var s := side if k < 2 else -side
		var local := Vector3(s * (half_size.x + 0.9), 0.5, (0.0 if k % 2 == 0 else -half_size.z * 0.6))
		var p := global_transform * local
		var ss := get_world_3d().direct_space_state
		var q := PhysicsRayQueryParameters3D.create(p + Vector3(0, 2.0, 0), p + Vector3(0, -4.0, 0), 1 | 2)
		var r := ss.intersect_ray(q)
		if not r.is_empty():
			return (r["position"] as Vector3) + Vector3(0, 0.1, 0)
	var g := global_transform * Vector3(half_size.x + 1.0, 0, 0)
	g.y = world.height(g.x, g.z) + 0.1 if world else g.y
	return g

func _start_engine() -> void:
	if engine_on:
		return
	engine_on = true
	Sfx.play_at(String(spec.get("start", "engine_start")), global_position, -2.0, 6.0)
	if snd_engine:
		snd_engine.stream_paused = false

# ------------------------------------------------------------------ driving
func forward_speed() -> float:
	return linear_velocity.dot(global_transform.basis.z)

func _physics_process(delta: float) -> void:
	_lod(delta)
	if freeze:
		return
	if dead:
		engine_force = 0.0
		brake = float(spec.get("brake", 60.0))
		return
	_drive(delta)
	_sounds(delta)
	_self_right(delta)
	_last_v = linear_velocity

func _drive(delta: float) -> void:
	var v := forward_speed()
	var vmax := float(spec.get("vmax", 30.0))
	var power := float(spec.get("power", 6000.0))
	var has_driver := driver() != null
	if not has_driver:
		engine_force = 0.0
		brake = float(spec.get("brake", 60.0)) * 0.15
		steering = move_toward(steering, 0.0, delta * 2.0)
		return
	var thr := ctl.y
	var ef := 0.0
	var br := 0.0
	if thr > 0.02:
		if v < -0.8:
			br = float(spec["brake"]) * thr
		else:
			ef = power * thr * clampf(1.0 - pow(maxf(v, 0.0) / vmax, 2.0), 0.0, 1.0)
	elif thr < -0.02:
		if v > 0.8:
			br = float(spec["brake"]) * -thr
		else:
			ef = -power * 0.55 * -thr * clampf(1.0 - pow(maxf(-v, 0.0) / (vmax * 0.3), 2.0), 0.0, 1.0)
	engine_force = ef
	brake = br
	# the handbrake locks the rear wheels
	for w in rear:
		w.brake = float(spec["brake"]) * 1.4 if ctl.z > 0.5 else br
	# less steering lock at speed
	var lock := float(spec.get("steer", 0.5)) * lerpf(1.0, 0.16, clampf(absf(v) / vmax * 1.25, 0.0, 1.0))
	steering = move_toward(steering, -ctl.x * lock, delta * 2.2)
	# stability control: hold the yaw rate near what the front wheels ask for (no spinning out at speed)
	var want_rate := v * tan(steering) / maxf(wheelbase, 1.0)
	var rate := angular_velocity.dot(global_transform.basis.y)
	var err := rate - want_rate
	if absf(err) > 0.12 and absf(v) > 4.0:
		apply_torque(global_transform.basis.y * (-err) * mass * 2.5)
	# air drag and a little downforce keep it on the road
	var lv := linear_velocity
	apply_central_force(-lv * lv.length() * 0.42 - global_transform.basis.y * absf(v) * mass * 0.02)
	# gears: the revs climb through each band of speed
	var band := vmax / 5.0
	gear = clampi(int(absf(v) / band) + 1, 1, 5)
	var target := clampf((absf(v) - (gear - 1) * band) / band, 0.0, 1.0) * 0.75 + 0.25 * absf(thr)
	rpm = move_toward(rpm, target, delta * 2.5)

func _sounds(_delta: float) -> void:
	if snd_engine:
		var running := engine_on and (driver() != null or rpm > 0.05)
		snd_engine.volume_db = lerpf(-12.0, 1.0, clampf(rpm * 0.8 + absf(ctl.y) * 0.4, 0.0, 1.0)) if running else -80.0
		snd_engine.pitch_scale = 0.62 + rpm * 0.95 + gear * 0.03
	if snd_skid:
		var slip := 0.0
		for w in wheels:
			if w.is_in_contact():
				slip = maxf(slip, 1.0 - w.get_skidinfo())
		var sp := linear_velocity.length()
		snd_skid.volume_db = lerpf(-60.0, -4.0, clampf((slip - 0.25) * 2.0, 0.0, 1.0) * clampf(sp / 6.0, 0.0, 1.0)) if sp > 2.0 else -80.0

## upside down or on its side and stopped: set it back on its wheels after a moment
func _self_right(delta: float) -> void:
	if global_transform.basis.y.y < 0.35 and linear_velocity.length() < 2.0:
		_flip_t += delta
		if _flip_t > 3.0:
			_flip_t = 0.0
			var f := global_transform.basis.z
			f.y = 0.0
			var p := global_position + Vector3(0, 1.5, 0)
			global_transform = Transform3D(Basis.looking_at(-f.normalized(), Vector3.UP), p)
			linear_velocity = Vector3.ZERO
			angular_velocity = Vector3.ZERO
	else:
		_flip_t = 0.0

## frozen while nobody is in it, it is not moving and no soldier is near (no ground colliders out there)
func _lod(delta: float) -> void:
	_lod_t -= delta
	if _lod_t > 0.0:
		return
	_lod_t = 0.4 + randf() * 0.2
	var busy := false
	for o in occupants:
		if o != null:
			busy = true
	var p := global_position
	var ref := world.phys_focus if world and world.phys_set else p + Vector3(1e5, 0, 0)
	var in_war := absf(p.x) < 500.0 and absf(p.z) < 500.0
	var near := ref.distance_to(p) < (40.0 if in_war else 105.0)
	var want := not busy and not near and linear_velocity.length() < 3.0
	if freeze != want:
		freeze = want
		if not want:
			sleeping = false
	if freeze and snd_engine:
		snd_engine.volume_db = -80.0

# ------------------------------------------------------------------ damage
func _on_hit(_body: Node) -> void:
	var dv := (linear_velocity - _last_v).length()
	if dv > 6.0:
		damage((dv - 6.0) * mass * 0.004, global_position)
		Sfx.play_at("impact_metal", global_position, clampf(dv - 4.0, 0.0, 10.0) - 4.0, 8.0)

func damage(amount: float, _at: Vector3) -> void:
	if dead:
		return
	health -= amount
	if health <= 0.0:
		_destroy()

func _destroy() -> void:
	dead = true
	engine_on = false
	if snd_engine:
		snd_engine.volume_db = -80.0
	var burnt := StandardMaterial3D.new()
	burnt.albedo_color = Color(0.04, 0.035, 0.03, 0.8)
	burnt.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	burnt.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_overlay(model, burnt)
	for w in wheels:
		for c in w.get_children():
			_overlay(c, burnt)
	if world and world.has_method("explode"):
		world.explode(global_position + Vector3(0, 1.0, 0), 1.0, self)
	apply_central_impulse(Vector3(0, mass * 4.0, 0))
	apply_torque_impulse(Vector3(randf_range(-1, 1), 0, randf_range(-1, 1)) * mass * 1.5)
	destroyed.emit(self)

func _overlay(n: Node, m: Material) -> void:
	if n is GeometryInstance3D:
		(n as GeometryInstance3D).material_overlay = m
	for c in n.get_children():
		_overlay(c, m)

# ------------------------------------------------------------------ weapons and the HUD line
func fire_primary() -> void:
	pass

func fire_secondary() -> void:
	pass

func hud_text() -> String:
	return "%d km/h   G%d   %d%%" % [int(absf(forward_speed()) * 3.6), gear, int(100.0 * health / maxf(max_health, 1.0))]

# ------------------------------------------------------------------ camera
func _camera_rig() -> void:
	cam_rig = Node3D.new()
	cam_rig.top_level = true
	add_child(cam_rig)
	cam_arm = SpringArm3D.new()
	cam_arm.spring_length = float((spec.get("cam", Vector2(6, 2)) as Vector2).x)
	cam_arm.collision_mask = 1 | 2
	cam_arm.margin = 0.2
	var sph := SphereShape3D.new()
	sph.radius = 0.25
	cam_arm.shape = sph
	cam_arm.add_excluded_object(get_rid())
	cam_rig.add_child(cam_arm)
	cam = Camera3D.new()
	cam.fov = float(Settings.get_v("fov"))
	cam.far = 6500.0
	cam_arm.add_child(cam)

## the driver looks around (mouse or touch drag); the camera drifts back behind the vehicle on its own
func look(d: Vector2) -> void:
	cam_yaw -= d.x
	cam_pitch = clampf(cam_pitch - d.y, -1.2, 0.5)
	cam_idle = 0.0

func update_camera(delta: float) -> void:
	var c: Vector2 = spec.get("cam", Vector2(6, 2))
	cam_idle += delta
	if cam_idle > 1.5 and linear_velocity.length() > 3.0:
		cam_yaw = lerp_angle(cam_yaw, 0.0, clampf(delta * 1.5, 0.0, 1.0))
		cam_pitch = lerpf(cam_pitch, -0.18, clampf(delta * 1.0, 0.0, 1.0))
	var yaw := atan2(global_transform.basis.z.x, global_transform.basis.z.z)
	if first_person:
		var eye: Vector3 = spec.get("eye", Vector3(0, 1.6, 0))
		cam_arm.spring_length = 0.0
		cam_rig.global_transform = global_transform * Transform3D(Basis.from_euler(Vector3(cam_pitch, PI + cam_yaw, 0.0)), eye)
	else:
		cam_arm.spring_length = c.x
		var target := global_position + Vector3(0, c.y, 0)
		cam_rig.global_position = cam_rig.global_position.lerp(target, clampf(delta * 12.0, 0.0, 1.0)) if cam_rig.global_position.distance_to(target) < 20.0 else target
		cam_rig.global_rotation = Vector3(cam_pitch, yaw + PI + cam_yaw, 0.0)
