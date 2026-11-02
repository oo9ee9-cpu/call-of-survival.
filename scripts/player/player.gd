class_name Player
extends CharacterBody3D
## The player: first person with a chest-mounted camera (bob, sway, lean into turns) or third person over
## the shoulder with the whole soldier visible (a Soldier body that aims and holds the rifle). Steps up small
## ledges, climbs out of trenches with the jump button, crouches, sprints. Aiming always looks down the sights.

signal message(text: String)

const STAND_H := 1.75
const CROUCH_H := 1.15
const CAM_STAND := 1.36
const CAM_CROUCH := 0.92
const STEP := 0.42

var world: World
var yaw := 0.0
var pitch := 0.0
var look_in := Vector2.ZERO          # accumulated look (touch / mouse) this frame, in radians
var last_look := Vector2.ZERO
var move_in := Vector2.ZERO          # from the touch stick (x right, y forward)
var touch_sprint := false
var crouching := false
var sprinting := false
var aiming := false
var mantle_t := -1.0
var mantle_from := Vector3.ZERO
var mantle_to := Vector3.ZERO
var mantle_dur := 0.75
var ladders: Array = []
var step_phase := 0.0
var last_step := 0.0
var bob := Vector3.ZERO
var roll := 0.0
var shake := 0.0
var shake_t := 0.0
var land_kick := 0.0
var was_floor := true
var fall_v := 0.0
var cam_h := CAM_STAND
var active := false
var stamina := 1.0
var tpp := true               # third person (Settings "view_mode")
var tpp_k := 1.0              # 1 = camera behind the shoulder, 0 = at the eyes (blends while aiming)
var health := 100.0
var dead := false
var team := 0

var body: Soldier
var tpp_pivot: Node3D
var spring: SpringArm3D
var tpp_anchor: Node3D

var col: CollisionShape3D
var capsule: CapsuleShape3D
var yaw_node: Node3D
var chest: Node3D
var cam: Camera3D
var weapon: Weapon
var flashlight: SpotLight3D
var breath: AudioStreamPlayer

func _ready() -> void:
	collision_layer = 4
	collision_mask = 1 | 2
	floor_max_angle = deg_to_rad(48.0)
	floor_snap_length = 0.45
	safe_margin = 0.02
	floor_stop_on_slope = true
	capsule = CapsuleShape3D.new()
	capsule.radius = 0.27
	capsule.height = STAND_H
	col = CollisionShape3D.new()
	col.shape = capsule
	col.position.y = STAND_H * 0.5
	add_child(col)
	yaw_node = Node3D.new()
	add_child(yaw_node)
	chest = Node3D.new()
	chest.position = Vector3(0, CAM_STAND, -0.08)
	yaw_node.add_child(chest)
	cam = Camera3D.new()
	cam.near = 0.03
	cam.far = 2600.0
	cam.fov = 100.0
	chest.add_child(cam)
	flashlight = SpotLight3D.new()
	flashlight.position = Vector3(0.06, -0.05, -0.05)
	flashlight.spot_range = 32.0
	flashlight.spot_angle = 32.0
	flashlight.spot_angle_attenuation = 1.6
	flashlight.light_energy = 3.2
	flashlight.light_color = Color(1.0, 0.96, 0.9)
	flashlight.shadow_enabled = true
	flashlight.visible = false
	cam.add_child(flashlight)
	weapon = Weapon.new()
	weapon.player = self
	cam.add_child(weapon)
	breath = Sfx.loop("breath_loop", -80.0, "SFX")
	body = Soldier.new()
	add_child(body)
	body.set_outfit.call_deferred(Color(0.46, 0.48, 0.4))
	tpp_pivot = Node3D.new()
	tpp_pivot.position = Vector3(0, 1.58, 0)
	add_child(tpp_pivot)
	spring = SpringArm3D.new()
	spring.position = Vector3(0.52, 0.12, 0.0)
	spring.spring_length = 2.55
	spring.margin = 0.12
	spring.collision_mask = 1 | 2
	var sph := SphereShape3D.new()
	sph.radius = 0.18
	spring.shape = sph
	spring.add_excluded_object(get_rid())
	tpp_pivot.add_child(spring)
	tpp_anchor = Node3D.new()
	spring.add_child(tpp_anchor)
	cam.top_level = true
	apply_settings.call_deferred()

func setup(w: World) -> void:
	world = w
	weapon.world = w
	var L: Dictionary = w.lay["props"].get("ladder", {})
	for k in L:
		var arr: PackedFloat32Array = L[k]
		for n in arr.size() / 12:
			var o := n * 12
			var z := Vector3(arr[o + 2], arr[o + 6], arr[o + 10])
			ladders.append([Vector3(arr[o + 3], arr[o + 7], arr[o + 11]), -Vector3(z.x, 0.0, z.z).normalized()])

func spawn(pos: Vector3, facing: float) -> void:
	global_position = pos
	yaw = facing
	pitch = -0.05
	velocity = Vector3.ZERO
	yaw_node.rotation.y = yaw
	health = 100.0
	dead = false
	body.dead = false
	body.body_yaw = facing

func apply_settings() -> void:
	cam.fov = float(Settings.get_v("fov"))
	flashlight.shadow_enabled = int(Settings.get_v("quality")) >= 1
	tpp = int(Settings.get_v("view_mode")) == 1
	body.set_shadows(int(Settings.get_v("shadows")) > 0)

func toggle_view() -> void:
	Settings.set_v("view_mode", 0 if tpp else 1)

func _unhandled_input(event: InputEvent) -> void:
	if not active:
		return
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		var mm := event as InputEventMouseMotion
		var s := 0.0022 * float(Settings.get_v("sens_mouse")) * (0.6 if aiming else 1.0)
		look_in += Vector2(-mm.relative.x * s, -mm.relative.y * s * (-1.0 if Settings.get_v("invert_y") else 1.0))
	if event.is_action_pressed("jump"):
		jump_or_climb()
	if event.is_action_pressed("crouch"):
		crouching = not crouching
	if event.is_action_pressed("flashlight"):
		toggle_flashlight()
	if event.is_action_pressed("interact"):
		interact()
	if event.is_action_pressed("reload"):
		weapon.reload()
	if event.is_action_pressed("fire_mode"):
		weapon.toggle_mode()
	if event.is_action_pressed("view_toggle"):
		toggle_view()

func toggle_flashlight() -> void:
	flashlight.visible = not flashlight.visible
	Sfx.play("lamp_click", -6.0)

func add_look(v: Vector2) -> void:
	look_in += v

func _physics_process(delta: float) -> void:
	if not active:
		return
	# look
	var lim := deg_to_rad(78.0)
	yaw += look_in.x
	pitch = clampf(pitch + look_in.y, -lim, lim)
	var turn_rate := look_in.x / maxf(delta, 0.001)
	last_look = look_in
	look_in = Vector2.ZERO
	yaw_node.rotation.y = yaw
	if mantle_t >= 0.0:
		_mantle(delta)
		_camera(delta, turn_rate, Vector2.ZERO, true)
		return
	# input
	var mv := Input.get_vector("move_left", "move_right", "move_back", "move_forward")
	if move_in.length() > 0.05:
		mv = move_in
	aiming = weapon.aim_held()
	var want_sprint := (Input.is_action_pressed("sprint") or touch_sprint) and mv.y > 0.3 and not aiming and stamina > 0.05
	if want_sprint and crouching:
		crouching = false
	sprinting = want_sprint
	var speed := 2.75
	if sprinting:
		speed = 5.6
	elif crouching:
		speed = 1.6
	if aiming:
		speed = minf(speed, 1.9)
	var surf := world.surface_at(global_position)
	if surf == "mud" or surf == "water":
		speed *= 0.86
	stamina = clampf(stamina + delta * (-0.09 if sprinting else 0.12), 0.0, 1.0)
	var yb := Basis(Vector3.UP, yaw)
	var wish := (yb * Vector3(mv.x, 0.0, -mv.y))
	if wish.length() > 1.0:
		wish = wish.normalized()
	var target := wish * speed
	var acc := 9.0 if is_on_floor() else 2.0
	var hv := Vector3(velocity.x, 0.0, velocity.z)
	hv = hv.move_toward(target, acc * delta * (speed + 1.0))
	velocity.x = hv.x
	velocity.z = hv.z
	if not is_on_floor():
		velocity.y -= 9.8 * delta
		fall_v = minf(fall_v, velocity.y)
	# crouch: shrink the capsule (stand up only with headroom)
	var want_h := CROUCH_H if crouching else STAND_H
	if not crouching and capsule.height < STAND_H - 0.01:
		var t := global_transform
		if test_move(t, Vector3(0, STAND_H - capsule.height, 0)):
			want_h = capsule.height
	capsule.height = move_toward(capsule.height, want_h, delta * 3.0)
	col.position.y = capsule.height * 0.5
	var pre_v := velocity
	move_and_slide()
	# step up over small ledges (duckboards, steps, roots)
	if is_on_wall() and hv.length() > 0.2 and (was_floor or is_on_floor()):
		_try_step(Vector3(pre_v.x, 0.0, pre_v.z) * delta * 2.0)
	var on_floor := is_on_floor()
	if on_floor and not was_floor:
		var impact := -fall_v
		if impact > 2.5:
			land_kick = clampf(impact * 0.012, 0.0, 0.08)
			_step_sound(clampf(impact / 6.0, 0.4, 1.0) * 3.0)
		fall_v = 0.0
	was_floor = on_floor
	# footsteps
	var hspeed := Vector2(velocity.x, velocity.z).length()
	if on_floor and hspeed > 0.4:
		var stride := 1.55 if sprinting else (1.05 if crouching else 1.3)
		step_phase += hspeed * delta / stride * PI
		if step_phase - last_step > PI:
			last_step = step_phase
			_step_sound(0.0 if crouching else (2.0 if sprinting else 0.0))
	_camera(delta, turn_rate, mv, on_floor)
	if breath:
		var target_db := -12.0 if (sprinting or stamina < 0.4) else -80.0
		breath.volume_db = lerpf(breath.volume_db, target_db, delta * 2.0)

func _try_step(motion: Vector3) -> void:
	if motion.length() < 0.001:
		return
	var t := global_transform
	var up := Vector3(0, STEP, 0)
	if test_move(t, up):
		return
	var t2 := t.translated(up)
	var m := motion.normalized() * maxf(motion.length(), 0.12)
	if test_move(t2, m):
		return
	var t3 := t2.translated(m)
	var kc := KinematicCollision3D.new()
	if test_move(t3, -up * 1.05, kc):
		if kc.get_normal().angle_to(Vector3.UP) < floor_max_angle:
			global_position = t3.origin + kc.get_travel()
			velocity.y = 0.0

## jump, or climb onto a ledge in front (trench walls, fire steps, sandbags)
func jump_or_climb() -> void:
	if mantle_t >= 0.0:
		return
	var fwd := Basis(Vector3.UP, yaw) * Vector3(0, 0, -1)
	# a trench ladder within reach: up and over the parapet
	for l in ladders:
		var foot: Vector3 = l[0]
		var dir: Vector3 = l[1]
		var to := Vector2(foot.x - global_position.x, foot.z - global_position.z)
		if to.length() < 1.4 and absf(foot.y - global_position.y) < 1.2 and dir.dot(fwd) > 0.2:
			for dist: float in [2.2, 2.8, 3.4]:
				var dest := foot + dir * dist
				dest.y = world.height(dest.x, dest.z) + 0.06
				if not test_move(Transform3D(Basis(), dest + Vector3(0, 0.08, 0)), Vector3(0, 0.05, 0)):
					_begin_mantle(dest, 1.5)
					return
	var ss := get_world_3d().direct_space_state
	for reach: float in [0.45, 0.7, 0.95, 1.2]:
		var top := global_position + fwd * reach + Vector3(0, 2.1, 0)
		var q := PhysicsRayQueryParameters3D.create(top, top + Vector3(0, -2.0, 0), 1 | 2)
		var r := ss.intersect_ray(q)
		if r.is_empty():
			continue
		var ledge: Vector3 = r["position"]
		var h := ledge.y - global_position.y
		if h < 0.4 or h > 1.8:
			continue
		if (r["normal"] as Vector3).y < 0.6:
			continue
		# stand a little beyond the edge, wherever the body fits
		var placed := false
		for extra: float in [0.25, 0.4, 0.1]:
			var dpos := ledge + fwd * extra
			var q2 := PhysicsRayQueryParameters3D.create(dpos + Vector3(0, 0.6, 0), dpos + Vector3(0, -0.6, 0), 1 | 2)
			var r2 := ss.intersect_ray(q2)
			if not r2.is_empty():
				dpos = r2["position"]
			if test_move(Transform3D(Basis(), dpos + Vector3(0, 0.06, 0)), Vector3(0, 0.04, 0)):
				continue
			if test_move(global_transform, Vector3(0, h + 0.08, 0)):
				break
			_begin_mantle(dpos + Vector3(0, 0.04, 0), 0.55 + h * 0.2)
			placed = true
			break
		if placed:
			return
	if is_on_floor():
		velocity.y = 3.6
		Sfx.play("jump", -8.0)

func _begin_mantle(to: Vector3, dur: float) -> void:
	mantle_from = global_position
	mantle_to = to
	mantle_dur = dur
	mantle_t = 0.0
	velocity = Vector3.ZERO
	crouching = false
	Sfx.play("climb", -4.0)

func _mantle(delta: float) -> void:
	mantle_t += delta / mantle_dur
	var t := clampf(mantle_t, 0.0, 1.0)
	var up_t := smoothstep(0.0, 0.62, t)
	var fw_t := smoothstep(0.38, 1.0, t)
	var p := Vector3(lerpf(mantle_from.x, mantle_to.x, fw_t), lerpf(mantle_from.y, mantle_to.y, up_t), lerpf(mantle_from.z, mantle_to.z, fw_t))
	global_position = p
	if mantle_t >= 1.0:
		mantle_t = -1.0
		velocity = Vector3.ZERO

func _step_sound(louder: float) -> void:
	var s := _foot_surface()
	var snd: String = {"mud": "step_mud", "water": "step_water", "wood": "step_wood", "metal": "step_wood", "bag": "step_dirt", "dirt": "step_dirt", "needles": "step_dirt"}.get(s, "step_dirt")
	Sfx.play_at(snd, global_position + Vector3(0, 0.1, 0), -4.0 + louder - (5.0 if crouching else 0.0), 2.5, 0.0, 0.0, 0.1)

func _foot_surface() -> String:
	var ss := get_world_3d().direct_space_state
	var q := PhysicsRayQueryParameters3D.create(global_position + Vector3(0, 0.3, 0), global_position + Vector3(0, -0.4, 0), 1 | 2)
	var r := ss.intersect_ray(q)
	if not r.is_empty():
		var s := world.props.surface_of(r["rid"], int(r["shape"]))
		if s == "wood" or s == "metal" or s == "bag":
			return s
	return world.surface_at(global_position)

func _camera(delta: float, turn_rate: float, mv: Vector2, on_floor: bool) -> void:
	var bob_amt := float(Settings.get_v("head_bob"))
	var hspeed := Vector2(velocity.x, velocity.z).length()
	var k := clampf(hspeed / 5.6, 0.0, 1.0) * bob_amt * (0.45 if aiming else 1.0)
	if not on_floor:
		k *= 0.2
	# chest camera bob: up/down twice per stride, sideways once, a little roll
	var target_bob := Vector3(sin(step_phase) * 0.035 * k, (absf(cos(step_phase)) - 0.6) * 0.055 * k, 0.0)
	bob = bob.lerp(target_bob, clampf(delta * 14.0, 0.0, 1.0))
	var target_roll := -mv.x * 0.025 * bob_amt - clampf(turn_rate * 0.004, -0.05, 0.05) * bob_amt + sin(step_phase) * 0.012 * k
	roll = lerpf(roll, target_roll, clampf(delta * 6.0, 0.0, 1.0))
	land_kick = move_toward(land_kick, 0.0, delta * 0.4)
	var ch := CAM_CROUCH if crouching else CAM_STAND
	cam_h = lerpf(cam_h, ch, clampf(delta * 8.0, 0.0, 1.0))
	shake = maxf(shake - delta * 1.2, 0.0)
	shake_t += delta * 38.0
	var sh := Vector3(sin(shake_t * 1.3) * 0.5 + sin(shake_t * 2.9) * 0.5, sin(shake_t * 1.7 + 1.0) * 0.5 + sin(shake_t * 3.3) * 0.5, 0.0) * shake * 0.03
	chest.position = Vector3(bob.x, cam_h + bob.y - land_kick, -0.08) + sh
	var rec := weapon.recoil_cam
	# eyes: the chest camera with the look, recoil and roll
	var eye := chest.global_transform * Transform3D(Basis.from_euler(Vector3(pitch + rec.x + sh.y * 0.6, rec.y + sh.x * 0.6, roll)), Vector3.ZERO)
	# third person: a pivot over the shoulders, a spring arm that keeps the camera out of walls;
	# aiming always goes to the sights (the camera slides forward to the eyes)
	var want := 1.0 if (tpp and not aiming) else 0.0
	tpp_k = move_toward(tpp_k, want, delta * 5.5)
	var tk := smoothstep(0.0, 1.0, tpp_k)
	if tk > 0.001:
		tpp_pivot.position.y = lerpf(tpp_pivot.position.y, 1.12 if crouching else 1.58, clampf(delta * 8.0, 0.0, 1.0))
		tpp_pivot.rotation = Vector3(pitch + rec.x * 0.7, yaw + rec.y * 0.7, 0.0)
		var third := Transform3D(tpp_pivot.global_transform.basis, tpp_anchor.global_position + sh * 0.5)
		cam.global_transform = eye.interpolate_with(third, tk)
	else:
		cam.global_transform = eye
	weapon.model.visible = tk < 0.5
	# a camera squeezed against the soldier (narrow trench, doorway) would look through him: hide him then
	body.visible = tk > 0.25 and not (tpp_k < 0.6 and aiming) and (tk < 0.99 or spring.get_hit_length() > 0.75)
	_update_body(delta)

func _update_body(delta: float) -> void:
	body.aim_yaw = yaw
	body.aim_pitch = pitch + weapon.recoil_cam.x
	var hv := Vector3(velocity.x, 0.0, velocity.z)
	body.speed = hv.length() if mantle_t < 0.0 else 0.0
	body.move_dir = Vector2(hv.x, hv.z).normalized() if body.speed > 0.05 else Vector2.ZERO
	body.crouch = move_toward(body.crouch, 1.0 if crouching else 0.0, delta * 4.0)
	body.airborne = not is_on_floor() and mantle_t < 0.0
	var low := 1.0 if ((sprinting and not aiming) or weapon.reload_t >= 0.0 or mantle_t >= 0.0) else 0.0
	body.low_ready = move_toward(body.low_ready, low, delta * 5.0)
	body.face(delta, aiming or weapon.trigger_held())

func add_shake(a: float) -> void:
	shake = clampf(shake + a, 0.0, 1.5)

func interact() -> void:
	var fwd := -cam.global_transform.basis.z
	var it := world.props.interactable_near(cam.global_position, fwd)
	if it.is_empty():
		return
	match it["kind"]:
		"lamp":
			var on := world.props.toggle_lamp(int(it["dug"]))
			Sfx.play("lamp_click", -4.0)
			message.emit("أُشعل المصباح" if on else "أُطفئ المصباح")
		"radio":
			Sfx.play_at("radio", it["pos"], -2.0, 3.0)
			message.emit("اللاسلكي: «…الوحدة الثالثة، اثبتوا في مواقعكم…»")
		"ammo":
			weapon.reserve = Weapon.MAX_RESERVE
			Sfx.play("ammo_pickup", -2.0)
			message.emit("أخذت الذخيرة")

func interact_hint() -> String:
	var fwd := -cam.global_transform.basis.z
	var it := world.props.interactable_near(cam.global_position, fwd)
	if it.is_empty():
		return ""
	return {"lamp": "المصباح", "radio": "اللاسلكي", "ammo": "صندوق الذخيرة"}.get(it["kind"], "")
