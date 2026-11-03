class_name Tank
extends Vehicle
## The main battle tank (tools/tank.py): seven road wheels a side on raycast suspension, steered by driving the two
## tracks at different speeds (it turns on the spot), the belts' texture running with each side. The turret turns
## towards where the camera looks and the gun lifts to it; the main gun fires a shell every 4 s (Projectiles "shell").

const SPEC := {"scene": "res://models/u/tank.glb", "title": "دبابة القتال", "mass": 52000.0, "power": 0.0, "vmax": 17.0,
	"brake": 900.0, "seats": [Vector3(0.0, 2.6, 0.2), Vector3(-0.6, 2.9, -0.5)], "cam": Vector2(13.0, 4.2),
	"eye": Vector3(0.85, 3.05, 0.9), "health": 6000.0, "sound": "eng_tank", "start": "engine_start_diesel"}
const TRAVERSE := 0.75               # turret rad/s
const ELEVATE := 0.5
const RELOAD := 4.0

var turret: Node3D
var gun: Node3D
var track_mats: Array[ShaderMaterial] = []   # left, right
var scroll := Vector2.ZERO
var reload_t := 0.0
var turret_yaw := 0.0                # relative to the hull
var gun_pitch := 0.0
var snd_tracks: AudioStreamPlayer3D

func _spec() -> Dictionary:
	return SPEC

func _build() -> void:
	TankLook.dress(model)
	var hull_box := AABB(Vector3(-1.85, 0.0, -4.0), Vector3(3.7, 1.85, 8.0))
	for c in model.get_children():
		match String(c.name):
			"turret":
				turret = c
			"gun":
				gun = c
	if turret and gun:
		var gxf := Vehicle.rel_xf(gun, model)
		model.remove_child(gun)
		turret.add_child(gun)
		gun.transform = turret.transform.affine_inverse() * gxf
	for side in ["track_l", "track_r"]:
		var t := model.get_node_or_null(side) as MeshInstance3D
		if t:
			track_mats.append(t.get_surface_override_material(0) as ShaderMaterial)
	# seven road wheels a side, all driven
	for s in [-1.0, 1.0]:
		for k in 7:
			var w := VehicleWheel3D.new()
			w.position = Vector3(s * 1.45, 0.43 + 0.2, -2.75 + k * 0.92)
			w.wheel_radius = 0.43
			w.wheel_rest_length = 0.3
			w.suspension_travel = 0.25
			w.suspension_stiffness = 90.0
			w.suspension_max_force = mass * 9.8 * 0.6
			w.damping_compression = 1.4
			w.damping_relaxation = 2.0
			w.wheel_friction_slip = 2.6
			w.wheel_roll_influence = 0.02
			w.use_as_traction = true
			w.use_as_steering = false
			add_child(w)
			wheels.append(w)
			if s < 0.0:
				front.append(w)      # right side (x < 0) in "front", left side in "rear": just two lists
			else:
				rear.append(w)
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = Vector3(3.5, 1.3, 7.8)
	cs.shape = bs
	cs.position = Vector3(0, 1.25, 0)
	add_child(cs)
	var cs2 := CollisionShape3D.new()
	var bs2 := BoxShape3D.new()
	bs2.size = Vector3(3.0, 0.75, 4.6)
	cs2.shape = bs2
	cs2.position = Vector3(0, 2.25, -0.4)
	add_child(cs2)
	half_size = Vector3(1.85, 1.3, 4.0)
	center_of_mass_mode = RigidBody3D.CENTER_OF_MASS_MODE_CUSTOM
	center_of_mass = Vector3(0, 0.9, 0)
	snd_tracks = Sfx.loop_at("tracks_loop", self, -80.0, 6.0, 200.0)
	if hull_box.size.x < 0.0:
		pass

func _drive(delta: float) -> void:
	reload_t = maxf(reload_t - delta, 0.0)
	var has_driver := driver() != null
	var v := forward_speed()
	var vmax := float(SPEC["vmax"])
	if not has_driver:
		for w in wheels:
			w.engine_force = 0.0
			w.brake = 60.0
		_tracks(delta, v, 0.0)
		return
	var thr := ctl.y
	var steer := ctl.x
	# tracks: both sides push for speed; one side forward and the other back to turn on the spot
	var per := mass * 9.8 * 0.55 / wheels.size()
	var lim := clampf(1.0 - pow(absf(v) / vmax, 2.0), 0.0, 1.0)
	var left := clampf(thr + steer * 0.9, -1.0, 1.0)
	var right := clampf(thr - steer * 0.9, -1.0, 1.0)
	for w in rear:
		w.engine_force = left * per * lim
		w.brake = 0.0
	for w in front:
		w.engine_force = right * per * lim
		w.brake = 0.0
	if absf(thr) < 0.05 and absf(steer) < 0.05:
		for w in wheels:
			w.brake = 120.0
	elif thr * v < -0.5:
		for w in wheels:
			w.brake = 250.0 * absf(thr)
	# raycast wheels grip sideways too hard to slew a 50 t hull: the tracks slip while it turns, and help the turn
	var yaw_rate := angular_velocity.dot(global_transform.basis.y)
	var slip := lerpf(2.6, 0.55, clampf(absf(steer), 0.0, 1.0))
	for w in wheels:
		w.wheel_friction_slip = slip
	apply_torque(global_transform.basis.y * (-steer * 0.6 - yaw_rate) * mass * 14.0)
	var lv := linear_velocity
	apply_central_force(-lv * lv.length() * 2.0)
	gear = clampi(int(absf(v) / (vmax / 4.0)) + 1, 1, 4)
	rpm = move_toward(rpm, clampf(absf(thr) * 0.6 + absf(steer) * 0.3 + absf(v) / vmax * 0.4, 0.0, 1.0), delta * 1.5)
	_tracks(delta, v, yaw_rate)
	_aim(delta)

func _tracks(delta: float, v: float, yaw_rate: float) -> void:
	# each belt runs at the hull's speed plus or minus the turn
	var sl := v - yaw_rate * 1.45
	var sr := v + yaw_rate * 1.45
	scroll += Vector2(sl, sr) * delta / 0.9
	if track_mats.size() == 2:
		track_mats[0].set_shader_parameter("scroll", -scroll.x)
		track_mats[1].set_shader_parameter("scroll", -scroll.y)
	if snd_tracks:
		var sp := maxf(absf(sl), absf(sr))
		snd_tracks.volume_db = lerpf(-30.0, 0.0, clampf(sp / 8.0, 0.0, 1.0)) if sp > 0.3 else -80.0
		snd_tracks.pitch_scale = 0.7 + clampf(sp / 12.0, 0.0, 0.8)

## the turret follows the camera's direction, the gun its height
func _aim(delta: float) -> void:
	if turret == null:
		return
	var want_yaw := wrapf(cam_yaw, -PI, PI)
	var d := wrapf(want_yaw - turret_yaw, -PI, PI)
	turret_yaw += clampf(d, -TRAVERSE * delta, TRAVERSE * delta)
	turret.rotation.y = turret_yaw
	var want_pitch := clampf(-cam_pitch - 0.12, -0.14, 0.35)
	gun_pitch = move_toward(gun_pitch, want_pitch, ELEVATE * delta)
	if gun:
		gun.rotation.x = -gun_pitch

func fire_primary() -> void:
	if reload_t > 0.0 or dead or gun == null:
		return
	reload_t = RELOAD
	var muzzle := gun.global_transform * Vector3(0, 0, 5.9)
	var dir := gun.global_transform.basis.z.normalized()
	if world and world.projectiles:
		world.projectiles.fire("shell", muzzle, dir * 0.01, self)
	Sfx.play_at("cannon", muzzle, 10.0, 30.0, 0.0, 0.0, 0.04)
	if world and world.fx:
		world.fx.burst("spark", muzzle, dir)
	apply_impulse(-dir * mass * 0.6, muzzle - global_position)

func update_camera(delta: float) -> void:
	# the camera looks where the gun will point; it does not drift back behind the hull
	cam_idle = 0.0
	super.update_camera(delta)

func hud_text() -> String:
	return "%d km/h   %s   %d%%" % [int(absf(forward_speed()) * 3.6), "جاهز" if reload_t <= 0.0 else "تلقيم %.1f" % reload_t, int(100.0 * health / max_health)]
