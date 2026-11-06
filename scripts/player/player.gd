class_name Player
extends CharacterBody3D
## The player: first person with a chest-mounted camera (bob, sway, lean into turns) or third person over
## the shoulder with the whole soldier visible (a Soldier body that aims and holds the rifle). Steps up small
## ledges, climbs out of trenches with the jump button, crouches, sprints. Aiming always looks down the sights.

signal message(text: String)
signal hit_marker
signal died(attacker: Node)
signal respawned

const STAND_H := 1.75
const CROUCH_H := 1.15
const CAM_STAND := 1.36
const CAM_CROUCH := 0.92
const CAM_PRONE := 0.36
const PRONE_H := 0.62
const STEP := 0.42

var world: World
var yaw := 0.0
var pitch := 0.0
var look_in := Vector2.ZERO          # accumulated look (touch / mouse) this frame, in radians
var last_look := Vector2.ZERO
var move_in := Vector2.ZERO          # from the touch stick (x right, y forward)
var touch_sprint := false
var crouching := false
var proning := false                # lying down: slow, low, small to hit
var ui_block := false               # the full map or the backpack is open: the soldier stands still
const BAG_MAX := 8                  # spare attachments in the backpack
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
# vehicles and the parachute
var vehicle: Vehicle
var seat := -1
var touch_up := false              # phone buttons while flying / driving
var touch_down := false
var touch_brake := false
var touch_fire2 := false
var para := 0                      # 0 on foot, 1 free fall, 2 under the canopy
# what the soldier carries: two long guns and a pistol, ammunition by calibre, medicine, armour levels
var inv := {"guns": [{"id": "ak", "ammo": 30, "sight": ""}, {}, {"id": "pistol", "ammo": 15, "sight": ""}], "cur": 0,
	"ammo": {"762": 90, "556": 0, "9mm": 30, "338": 0, "12g": 0}, "meds": {"bandage": 2, "kit": 1, "medkit": 0}, "helmet": 0, "vest": 0, "bag": []}
var heal_t := -1.0
var heal_kind := ""
var kills := 0
var deaths := 0
var lives := 3
var respawn_timer: SceneTreeTimer  # the wait for the next life
var in_transport := false          # riding the transport helicopter into the match (TransportFlight moves him)
var transport: Node                # that flight
var chute: Node3D
var snd_fall: AudioStreamPlayer

func _ready() -> void:
	add_to_group("soldiers")
	collision_layer = 4
	collision_mask = 1 | 2 | Vehicle.LAYER
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
	var prof := Profile.load_profile()
	body.set_outfit.call_deferred((Lobby.OUTFITS.get(String(prof.get("outfit", "olive")), Lobby.OUTFITS["olive"]) as Dictionary)["color"])
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
	var L: Dictionary = w.lay["props"].get("ladder", {}) if w.lay.has("props") else {}
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
	body.revive()
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
	if vehicle:
		if event.is_action_pressed("interact"):
			exit_vehicle()
		elif event.is_action_pressed("view_toggle"):
			vehicle.first_person = not vehicle.first_person
		elif event.is_action_pressed("reload") and vehicle is Aircraft:
			drop_flares()
		return
	if in_transport:
		if event.is_action_pressed("jump") or event.is_action_pressed("interact"):
			jump_or_climb()
		return
	if event.is_action_pressed("jump"):
		if para == 1:
			open_chute()
		else:
			jump_or_climb()
	if event.is_action_pressed("crouch"):
		crouching = not crouching
		proning = false
	if event.is_action_pressed("prone"):
		toggle_prone()
	if event.is_action_pressed("flashlight"):
		toggle_flashlight()
	if event.is_action_pressed("interact"):
		interact()
	if event.is_action_pressed("reload"):
		weapon.reload()
	if event.is_action_pressed("fire_mode"):
		weapon.toggle_mode()
	for i in 3:
		if event.is_action_pressed("weapon_%d" % (i + 1)):
			switch_weapon(i)
	if event.is_action_pressed("heal"):
		heal()
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
	if in_transport:
		world.phys_focus = global_position
		world.phys_set = true
		return
	# look
	var lim := deg_to_rad(78.0)
	yaw += look_in.x
	pitch = clampf(pitch + look_in.y, -lim, lim)
	var turn_rate := look_in.x / maxf(delta, 0.001)
	last_look = look_in
	look_in = Vector2.ZERO
	yaw_node.rotation.y = yaw
	world.phys_focus = vehicle.global_position if vehicle else global_position
	world.phys_set = true
	if dead:
		velocity = Vector3(0.0, velocity.y - 9.8 * delta, 0.0)
		move_and_slide()
		_camera(delta, 0.0, Vector2.ZERO, is_on_floor())
		return
	_heal_step(delta)
	if vehicle:
		_ride(delta)
		return
	if para > 0:
		_parachute(delta)
		return
	if mantle_t >= 0.0:
		_mantle(delta)
		_camera(delta, turn_rate, Vector2.ZERO, true)
		return
	# input
	var mv := Input.get_vector("move_left", "move_right", "move_back", "move_forward")
	if move_in.length() > 0.05:
		mv = move_in
	if ui_block:
		mv = Vector2.ZERO
	aiming = weapon.aim_held()
	var want_sprint := (Input.is_action_pressed("sprint") or touch_sprint) and mv.y > 0.3 and not aiming and stamina > 0.05
	if want_sprint and (crouching or proning):
		crouching = false
		proning = false
	sprinting = want_sprint
	var speed := 2.75
	if sprinting:
		speed = 5.6
	elif proning:
		speed = 0.75
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
	var want_h := PRONE_H if proning else (CROUCH_H if crouching else STAND_H)
	if not proning and capsule.height < want_h - 0.01:
		var t := global_transform
		if test_move(t, Vector3(0, want_h - capsule.height, 0)):
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
	if in_transport:
		if transport and is_instance_valid(transport):
			transport.call("jump")
		return
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
		var s: String = world.props.surface_of(r["rid"], int(r["shape"]))
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
	var ch := CAM_PRONE if proning else (CAM_CROUCH if crouching else CAM_STAND)
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
	var want := 1.0 if dead or (tpp and not aiming) else 0.0      # dead: the camera steps back from the body
	tpp_k = move_toward(tpp_k, want, delta * 5.5)
	var tk := smoothstep(0.0, 1.0, tpp_k)
	if tk > 0.001:
		tpp_pivot.position.y = lerpf(tpp_pivot.position.y, 0.6 if proning else (1.12 if crouching else 1.58), clampf(delta * 8.0, 0.0, 1.0))
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
	body.prone = move_toward(body.prone, 1.0 if proning else 0.0, delta * 2.5)
	body.airborne = not is_on_floor() and mantle_t < 0.0
	var low := 1.0 if ((sprinting and not aiming) or weapon.reload_t >= 0.0 or mantle_t >= 0.0) else 0.0
	body.low_ready = move_toward(body.low_ready, low, delta * 5.0)
	body.face(delta, aiming or weapon.trigger_held())

func add_shake(a: float) -> void:
	shake = clampf(shake + a, 0.0, 1.5)

## where the soldier's eyes are and where they look (the camera may be behind the shoulder)
func eye_xf() -> Transform3D:
	return chest.global_transform * Transform3D(Basis.from_euler(Vector3(pitch, 0.0, 0.0)), Vector3.ZERO)

func interact() -> void:
	if vehicle:
		exit_vehicle()
		return
	var m := _match()
	if m and m.computer_near(global_position + Vector3(0, 1.0, 0)) >= 0:
		var zi := m.computer_near(global_position + Vector3(0, 1.0, 0))
		if m.zone_owner(zi) != team:
			m.start_hack(zi)
			return
	var lt := loot_near()
	if not lt.is_empty():
		pick_up(lt)
		return
	var v := vehicle_near()
	if v:
		enter_vehicle(v)
		return
	var ex := eye_xf()
	var it: Dictionary = world.props.interactable_near(ex.origin, -ex.basis.z)
	if it.is_empty():
		return
	match it["kind"]:
		"door":
			world.props.toggle_door(String(it["key"]))
		"lamp":
			var on: bool = world.props.toggle_lamp(int(it["dug"]))
			Sfx.play("lamp_click", -4.0)
			message.emit("أُشعل المصباح" if on else "أُطفئ المصباح")
		"radio":
			Sfx.play_at("radio", it["pos"], -2.0, 3.0)
			message.emit("اللاسلكي: «…الوحدة الثالثة، اثبتوا في مواقعكم…»")
		"ammo":
			for c in inv["ammo"]:
				inv["ammo"][c] = maxi(int(inv["ammo"][c]), 120)
			Sfx.play("ammo_pickup", -2.0)
			message.emit("أخذت الذخيرة")

func interact_hint() -> String:
	if vehicle:
		return "نزول"
	var m := _match()
	if m:
		var zi := m.computer_near(global_position + Vector3(0, 1.0, 0))
		if zi >= 0 and m.zone_owner(zi) != team:
			return ("جارٍ الاختراق… %d%%" % int(m.hack_t / Match.HACK_TIME * 100.0)) if m.hacking == zi else "اختراق حاسوب المنطقة «%s»" % m.zones[zi]["name"]
	var lt := loot_near()
	if not lt.is_empty():
		return "التقاط: " + Loot.title(lt["item"])
	var v := vehicle_near()
	if v:
		return "ركوب: " + v.title
	var ex := eye_xf()
	var it: Dictionary = world.props.interactable_near(ex.origin, -ex.basis.z)
	if it.is_empty():
		return ""
	if it["kind"] == "door":
		return "إغلاق الباب" if bool(it["open"]) else "فتح الباب"
	return {"lamp": "المصباح", "radio": "اللاسلكي", "ammo": "صندوق الذخيرة"}.get(it["kind"], "")

# ------------------------------------------------------------------ vehicles
## the closest vehicle with a free seat within a step or two of the soldier
func vehicle_near() -> Vehicle:
	if dead or para > 0:
		return null
	var best: Vehicle = null
	var bd := 2.2
	for n in get_tree().get_nodes_in_group("vehicles"):
		var v := n as Vehicle
		if v == null or v.dead or v.free_seat() < 0:
			continue
		var lp := v.global_transform.affine_inverse() * (global_position + Vector3(0, 1.0, 0))
		var d := Vector3(maxf(absf(lp.x) - v.half_size.x, 0.0), 0.0, maxf(absf(lp.z) - v.half_size.z, 0.0)).length()
		if d < bd and absf(lp.y) < v.half_size.y * 2.0 + 2.0:
			bd = d
			best = v
	return best

func enter_vehicle(v: Vehicle) -> void:
	var s := v.board(self)
	if s < 0:
		return
	vehicle = v
	seat = s
	collision_layer = 0
	collision_mask = 0
	velocity = Vector3.ZERO
	crouching = false
	body.visible = false
	weapon.model.visible = false
	v.first_person = not tpp
	v.cam_yaw = 0.0
	v.cam.fov = float(Settings.get_v("fov"))
	v.cam.current = true
	Sfx.play_at("car_door", v.global_position, -4.0, 4.0)
	message.emit(v.title + ("  — القيادة" if s == 0 else "  — راكب"))

func exit_vehicle() -> void:
	if vehicle == null:
		return
	var v := vehicle
	var p := v.exit_point(seat)
	var high := v.global_position.y - world.height(v.global_position.x, v.global_position.z) > 12.0
	if high:
		# out of an aircraft in flight: drop clear of it
		p = v.global_position + v.global_transform.basis.x * (v.half_size.x + 2.0) - Vector3(0, 3.0, 0)
	v.leave(self)
	vehicle = null
	seat = -1
	global_position = p
	velocity = v.linear_velocity * (0.6 if high else 0.0)
	collision_layer = 4
	collision_mask = 1 | 2 | Vehicle.LAYER
	body.visible = true
	cam.current = true
	yaw = atan2(-v.global_transform.basis.z.x, -v.global_transform.basis.z.z) + PI
	Sfx.play_at("car_door", v.global_position, -4.0, 4.0)
	if high:
		para = 1
		_fall_sound(true)

func _ride(delta: float) -> void:
	var v := vehicle
	if v.dead and seat >= 0:
		exit_vehicle()
		return
	var mv := Input.get_vector("move_left", "move_right", "move_back", "move_forward")
	if move_in.length() > 0.05:
		mv = move_in
	if seat == 0:
		if v is Aircraft:
			var a := v as Aircraft
			var thr := 0.0
			if Input.is_action_pressed("throttle_up") or touch_up:
				thr += 1.0
			if Input.is_action_pressed("throttle_down") or touch_down:
				thr -= 1.0
			a.set_throttle_input(thr, delta)
			var rud := 0.0
			if Input.is_action_pressed("lean_right"):
				rud += 1.0
			if Input.is_action_pressed("lean_left"):
				rud -= 1.0
			# stick back (pull) = nose up
			v.ctl = Vector3(mv.x, -mv.y if not a.heli else mv.y, rud)
		else:
			v.ctl = Vector3(mv.x, mv.y, 1.0 if (Input.is_action_pressed("brake") or touch_brake) else 0.0)
	if seat == 0:
		if Input.is_action_pressed("fire") or weapon.touch_fire:
			v.fire_primary()
		if Input.is_action_just_pressed("vehicle_fire2") or touch_fire2:
			touch_fire2 = false
			v.fire_secondary()
	v.look(look_in * 0.8)
	look_in = Vector2.ZERO
	global_position = v.seat_xf(seat).origin - Vector3(0, 1.0, 0)
	velocity = v.linear_velocity
	v.update_camera(delta)
	if breath:
		breath.volume_db = -80.0

# ------------------------------------------------------------------ parachute
func open_chute() -> void:
	if para != 1:
		return
	para = 2
	Sfx.play("chute_open", -2.0)
	if chute == null:
		chute = _make_chute()
		add_child(chute)
	chute.visible = true
	chute.scale = Vector3(0.2, 0.2, 0.2)
	message.emit("المظلة مفتوحة — وجّه بالعصا")

func _parachute(delta: float) -> void:
	var mv := Input.get_vector("move_left", "move_right", "move_back", "move_forward")
	if move_in.length() > 0.05:
		mv = move_in
	var yb := Basis(Vector3.UP, yaw)
	var ground := world.height(global_position.x, global_position.z)
	var h := global_position.y - ground
	if para == 1:
		# free fall: belly to earth, lean forward to dive; the chute opens by itself at 120 m
		var dive := clampf(mv.y, 0.0, 1.0)
		var vt := lerpf(54.0, 72.0, dive)
		velocity.y = move_toward(velocity.y, -vt, 9.8 * delta)
		var hv := yb * Vector3(mv.x, 0.0, -mv.y) * lerpf(9.0, 24.0, dive)
		velocity.x = move_toward(velocity.x, hv.x, delta * 6.0)
		velocity.z = move_toward(velocity.z, hv.z, delta * 6.0)
		if h < 120.0:
			open_chute()
	else:
		# under the canopy: a slow descent, glide where the stick points, pull back to brake
		var brake_k := clampf(-mv.y, 0.0, 1.0)
		velocity.y = move_toward(velocity.y, -lerpf(5.2, 3.6, brake_k), 18.0 * delta)
		var fwd_v := lerpf(9.5, 3.0, brake_k)
		var hv := yb * Vector3(mv.x * 4.0, 0.0, -fwd_v)
		velocity.x = move_toward(velocity.x, hv.x, delta * 3.0)
		velocity.z = move_toward(velocity.z, hv.z, delta * 3.0)
		yaw -= mv.x * delta * 0.6
		if chute:
			chute.scale = chute.scale.move_toward(Vector3.ONE, delta * 2.5)
			chute.rotation = Vector3(0.0, yaw, -mv.x * 0.25)
	move_and_slide()
	body.airborne = true
	_camera(delta, 0.0, mv, false)
	if is_on_floor() or h < 0.3:
		_land()

func _land() -> void:
	para = 0
	if chute:
		chute.visible = false
	body.airborne = false
	_fall_sound(false)
	if velocity.y < -20.0:
		take_damage(100.0, global_position)
	velocity = Vector3.ZERO
	land_kick = 0.06

func _fall_sound(on: bool) -> void:
	if on and snd_fall == null:
		snd_fall = Sfx.loop("wind_fall_loop", -4.0, "SFX")
	elif not on and snd_fall:
		snd_fall.queue_free()
		snd_fall = null

## a round canopy on its lines over the soldier (cloth panels in two colours)
func _make_chute() -> Node3D:
	var root := Node3D.new()
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var n := 20
	var R := 3.6
	var top := 6.2
	for i in n:
		var a0 := TAU * i / n
		var a1 := TAU * (i + 1) / n
		var c := Color(0.36, 0.42, 0.28) if i % 2 == 0 else Color(0.62, 0.6, 0.5)
		for ring in 4:
			var t0 := ring / 4.0
			var t1 := (ring + 1) / 4.0
			var r0 := R * sin(t0 * PI * 0.5 + 0.08)
			var r1 := R * sin(t1 * PI * 0.5 + 0.08)
			var y0 := top - (1.0 - cos(t0 * PI * 0.5)) * 1.8
			var y1 := top - (1.0 - cos(t1 * PI * 0.5)) * 1.8
			var v := [Vector3(cos(a0) * r0, y0, sin(a0) * r0), Vector3(cos(a1) * r0, y0, sin(a1) * r0), Vector3(cos(a1) * r1, y1, sin(a1) * r1), Vector3(cos(a0) * r1, y1, sin(a0) * r1)]
			for k in [0, 1, 2, 0, 2, 3]:
				st.set_color(c)
				var vv: Vector3 = v[k]
				st.set_normal(Vector3(vv.x, 1.0, vv.z).normalized())
				st.add_vertex(vv)
	st.index()
	var mesh := st.commit()
	var m := StandardMaterial3D.new()
	m.vertex_color_use_as_albedo = true
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	m.roughness = 0.8
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = m
	root.add_child(mi)
	# the lines
	var lm := StandardMaterial3D.new()
	lm.albedo_color = Color(0.15, 0.15, 0.13)
	for i in 8:
		var a := TAU * i / 8.0
		var tip := Vector3(cos(a) * R * 0.98, top - 1.75, sin(a) * R * 0.98)
		var base := Vector3(0, 1.45, 0)
		var line := MeshInstance3D.new()
		var cm := CylinderMesh.new()
		cm.top_radius = 0.008
		cm.bottom_radius = 0.008
		cm.height = tip.distance_to(base)
		cm.radial_segments = 4
		cm.material = lm
		line.mesh = cm
		line.transform = Transform3D(Basis.looking_at(tip - base, Vector3.FORWARD if absf((tip - base).normalized().y) > 0.99 else Vector3.UP) * Basis(Vector3.RIGHT, PI * 0.5), (tip + base) * 0.5)
		root.add_child(line)
	return root

# ------------------------------------------------------------------ getting hurt
func take_damage(amount: float, from: Vector3, attacker: Node = null) -> void:
	if dead:
		return
	# a hit high on the body is a head shot (the helmet takes part of it); the vest covers the chest
	var head := from.y - global_position.y > 1.45 and from.distance_to(global_position) < 3.0
	var k := 1.0
	if head:
		amount *= 2.0
		k = [1.0, 0.7, 0.6, 0.45][clampi(int(inv["helmet"]), 0, 3)]
	else:
		k = [1.0, 0.7, 0.6, 0.45][clampi(int(inv["vest"]), 0, 3)]
	amount *= k
	heal_t = -1.0
	health -= amount
	add_shake(clampf(amount / 60.0, 0.1, 1.0))
	if health <= 0.0:
		_die(attacker)

func _die(attacker: Node = null) -> void:
	health = 0.0
	if vehicle:
		exit_vehicle()
	deaths += 1
	if _loot():
		_loot().drop_crate(global_position + Vector3(0, 0.05, 0), kit())
	dead = true
	body.dead = true
	weapon.aim_toggle = false
	para = 0
	if chute:
		chute.visible = false
	_fall_sound(false)
	lives -= 1
	died.emit(attacker)
	if lives >= 0:
		var wait := 8.0 if _match() else 5.0          # in a match: time to pick where to come back
		message.emit("قُتلت — بقي لك %d %s" % [lives, "محاولة" if lives == 1 else "محاولات"])
		respawn_timer = get_tree().create_timer(wait, false)
		respawn_timer.timeout.connect(_respawn)
	else:
		message.emit("قُتلت — انتهت محاولاتك")

## seconds until the next life
func respawn_left() -> float:
	return respawn_timer.time_left if respawn_timer else 0.0

func _respawn() -> void:
	var m := _match()
	if m and m.over:
		return
	var sp: Array = m.player_spawn() if m else world.spawn_point()
	inv = {"guns": [{"id": "ak", "ammo": 30, "sight": ""}, {}, {"id": "pistol", "ammo": 15, "sight": ""}], "cur": 0,
		"ammo": {"762": 90, "556": 0, "9mm": 30, "338": 0, "12g": 0}, "meds": {"bandage": 2, "kit": 1, "medkit": 0}, "helmet": 0, "vest": 0, "bag": []}
	weapon.equip("ak", 30)
	body.set_weapon("ak")
	spawn(sp[0], sp[1])
	if sp.size() > 2 and bool(sp[2]):
		air_start()
	respawned.emit()

## in the air over the battlefield (the start of a match, or the jump chosen while waiting): free fall, then the chute
func air_start() -> void:
	para = 1
	velocity = Vector3(0.0, -12.0, 0.0)
	_fall_sound(true)
	message.emit("قفز حر — المظلة تُفتح وحدها على ١٢٠ م، أو بزر القفز")

# ------------------------------------------------------------------ the kit
func _match() -> Match:
	return world.get_node_or_null("Match") as Match

func _loot() -> Loot:
	return world.valley.loot if world.valley else null

func loot_near() -> Dictionary:
	var l := _loot()
	if l == null or dead or vehicle or para > 0:
		return {}
	var ex := eye_xf()
	return l.nearest(ex.origin - Vector3(0, 0.8, 0), (-ex.basis.z + Vector3(0, -0.6, 0)).normalized())

func pick_up(lt: Dictionary) -> void:
	var it: Dictionary = lt["item"]
	if String(it["type"]) == "crate":
		var n := 0
		for k in it["kit"]:
			if give(k):
				n += 1
		_loot().take(String(lt["key"]))
		message.emit("أخذت %d من محتويات الصندوق" % n)
		return
	if give(it):
		_loot().take(String(lt["key"]))
	else:
		message.emit("لا حاجة لك به")

## what this soldier leaves in his crate
func kit() -> Array:
	var out := []
	save_ammo()
	for g in inv["guns"]:
		if not (g as Dictionary).is_empty():
			out.append({"type": "gun", "id": g["id"], "n": g["ammo"]})
	for c in inv["ammo"]:
		if int(inv["ammo"][c]) > 0:
			out.append({"type": "ammo", "id": c, "n": int(inv["ammo"][c])})
	for m in inv["meds"]:
		if int(inv["meds"][m]) > 0:
			out.append({"type": "med", "id": m, "n": int(inv["meds"][m])})
	if int(inv["helmet"]) > 0:
		out.append({"type": "helmet", "id": "helmet", "n": int(inv["helmet"])})
	if int(inv["vest"]) > 0:
		out.append({"type": "vest", "id": "vest", "n": int(inv["vest"])})
	for g in inv["guns"]:
		if not (g as Dictionary).is_empty() and String(g.get("sight", "")) != "":
			out.append({"type": "sight", "id": String(g["sight"]), "n": 1})
	for b in inv.get("bag", []):
		out.append((b as Dictionary).duplicate())
	return out

# ------------------------------------------------------------------ the backpack (tap the bag button)
## can this sight go on any gun the soldier carries?
func sight_fits(_sid: String) -> bool:
	for g in inv["guns"]:
		if not (g as Dictionary).is_empty() and Guns.points(String(g["id"]))["rail"] != Vector3.INF:
			return true
	return false

func _drop(it: Dictionary) -> void:
	if _loot():
		var fwd := -global_transform.basis.z
		_loot().drop_item(it, global_position + fwd * 0.8 + Vector3(randf_range(-0.3, 0.3), 0, randf_range(-0.3, 0.3)))
	Sfx.play("ammo_pickup", -8.0, 0.15)

func drop_gun(slot: int) -> void:
	var g: Dictionary = inv["guns"][slot]
	if g.is_empty():
		return
	save_ammo()
	_drop({"type": "gun", "id": g["id"], "n": int(g["ammo"])})
	if String(g.get("sight", "")) != "":
		_drop({"type": "sight", "id": String(g["sight"]), "n": 1})
	inv["guns"][slot] = {}
	if slot == int(inv["cur"]):
		for k in 3:
			if not (inv["guns"][k] as Dictionary).is_empty():
				inv["cur"] = -1
				switch_weapon(k)
				break
	message.emit("رميت " + String(Guns.DATA[g["id"]]["title"]))

func drop_ammo(cal: String) -> void:
	var n := int(inv["ammo"].get(cal, 0))
	if n <= 0:
		return
	inv["ammo"][cal] = 0
	_drop({"type": "ammo", "id": cal, "n": n})

func drop_med(kind: String) -> void:
	var n := int(inv["meds"].get(kind, 0))
	if n <= 0:
		return
	inv["meds"][kind] = n - 1
	_drop({"type": "med", "id": kind, "n": 1})

func drop_armor(kind: String) -> void:
	var lv := int(inv[kind])
	if lv <= 0:
		return
	inv[kind] = 0
	_drop({"type": kind, "id": kind, "n": lv})

func drop_bag(i: int) -> void:
	var bag: Array = inv.get("bag", [])
	if i < 0 or i >= bag.size():
		return
	var it: Dictionary = bag[i]
	bag.remove_at(i)
	_drop({"type": it["type"], "id": it["id"], "n": 1})

## a sight from the backpack onto the gun in hand (the one on it goes into the backpack)
func mount_from_bag(i: int) -> bool:
	var bag: Array = inv.get("bag", [])
	var g: Dictionary = inv["guns"][int(inv["cur"])]
	if i < 0 or i >= bag.size() or g.is_empty() or Guns.points(String(g["id"]))["rail"] == Vector3.INF:
		return false
	var it: Dictionary = bag[i]
	bag.remove_at(i)
	if String(g.get("sight", "")) != "":
		bag.append({"type": "sight", "id": String(g["sight"])})
	g["sight"] = String(it["id"])
	save_ammo()
	weapon.equip(String(g["id"]), int(g["ammo"]), String(g["sight"]))
	message.emit("ركّبت " + String(Guns.SIGHTS[g["sight"]]["title"]))
	return true

func unmount_sight(slot: int) -> void:
	var g: Dictionary = inv["guns"][slot]
	if g.is_empty() or String(g.get("sight", "")) == "":
		return
	var bag: Array = inv.get("bag", [])
	bag.append({"type": "sight", "id": String(g["sight"])})
	inv["bag"] = bag
	g["sight"] = ""
	if slot == int(inv["cur"]):
		save_ammo()
		weapon.equip(String(g["id"]), int(g["ammo"]), "")

## «تغيير العدسة»: the next sight from the backpack onto the gun in hand, round to the iron sights and back
func cycle_sight() -> void:
	var bag: Array = inv.get("bag", [])
	for i in bag.size():
		if String((bag[i] as Dictionary).get("type", "")) == "sight":
			if mount_from_bag(i):
				return
	var g: Dictionary = inv["guns"][int(inv["cur"])]
	if not g.is_empty() and String(g.get("sight", "")) != "":
		unmount_sight(int(inv["cur"]))
		message.emit("التسديد بالفرضة والشعيرة")
	else:
		message.emit("لا توجد عدسة في الحقيبة")

## use one kind of medicine from the backpack
func use_med(kind: String) -> void:
	if heal_t >= 0.0 or dead or int(inv["meds"].get(kind, 0)) <= 0:
		return
	if health >= 99.0:
		message.emit("صحتك كاملة")
		return
	heal_kind = kind
	heal_t = 0.0
	message.emit({"bandage": "ضمادة…", "kit": "إسعافات أولية…", "medkit": "حقيبة طبية…"}[kind])

## flares from the aircraft he flies (R / the flare button): a missile on his tail may take them instead
func drop_flares() -> void:
	if vehicle is Aircraft and world.air_defence:
		world.air_defence.drop_flares(vehicle)
		message.emit("مشاعل!")

func toggle_prone() -> void:
	proning = not proning
	if proning:
		crouching = false

func save_ammo() -> void:
	var g: Dictionary = inv["guns"][int(inv["cur"])]
	if not g.is_empty():
		g["ammo"] = weapon.ammo

func switch_weapon(i: int) -> void:
	var g: Dictionary = inv["guns"][i]
	if g.is_empty() or i == int(inv["cur"]) or vehicle:
		return
	save_ammo()
	inv["cur"] = i
	weapon.equip(String(g["id"]), int(g["ammo"]), String(g.get("sight", "")))
	body.set_weapon(String(g["id"]))
	message.emit(String(Guns.DATA[g["id"]]["title"]))

## the next gun in hand (the phone button)
func next_weapon() -> void:
	for k in range(1, 4):
		var i := (int(inv["cur"]) + k) % 3
		if not (inv["guns"][i] as Dictionary).is_empty():
			switch_weapon(i)
			return

## use the best medicine for how hurt the soldier is (it takes a few seconds; moving on cancels nothing, a hit does)
func heal() -> void:
	if heal_t >= 0.0 or health >= 99.0 or dead:
		return
	var m: Dictionary = inv["meds"]
	for kind in (["medkit", "kit", "bandage"] if health < 60.0 else ["bandage", "kit", "medkit"]):
		if int(m.get(kind, 0)) > 0:
			if kind == "bandage" and health >= 75.0:
				continue
			heal_kind = kind
			heal_t = 0.0
			message.emit({"bandage": "ضمادة…", "kit": "إسعافات أولية…", "medkit": "حقيبة طبية…"}[kind])
			return
	message.emit("لا يوجد علاج")

func _heal_step(delta: float) -> void:
	if heal_t < 0.0:
		return
	heal_t += delta
	var need: float = {"bandage": 3.0, "kit": 5.0, "medkit": 7.0}[heal_kind]
	if heal_t >= need:
		heal_t = -1.0
		inv["meds"][heal_kind] = int(inv["meds"][heal_kind]) - 1
		match heal_kind:
			"bandage":
				health = minf(health + 15.0, 75.0)
			"kit":
				health = maxf(health, 75.0)
			"medkit":
				health = 100.0
		message.emit("الصحة %d" % int(health))

## a picked-up item; returns false when there is no room / no use for it
func give(it: Dictionary) -> bool:
	var t := String(it.get("type", ""))
	match t:
		"gun":
			var id := String(it["id"])
			var slot := int(Guns.DATA[id]["slot"])
			if slot == 0:
				# a long gun: the free long slot, else swap with the one in hand (dropped where it was found)
				if (inv["guns"][0] as Dictionary).is_empty():
					slot = 0
				elif (inv["guns"][1] as Dictionary).is_empty():
					slot = 1
				else:
					slot = int(inv["cur"]) if int(inv["cur"]) < 2 else 0
			save_ammo()
			var old: Dictionary = inv["guns"][slot]
			if not old.is_empty() and _loot():
				# the gun it replaces is left where it was found
				_loot().drop_item({"type": "gun", "id": old["id"], "n": int(old["ammo"])}, global_position + global_transform.basis.x * 0.5)
			inv["guns"][slot] = {"id": id, "ammo": int(it.get("n", Guns.DATA[id]["mag"])), "sight": ""}
			if slot == int(inv["cur"]) or (inv["guns"][int(inv["cur"])] as Dictionary).is_empty():
				inv["cur"] = slot
				weapon.equip(id, int(inv["guns"][slot]["ammo"]), "")
				body.set_weapon(id)
			message.emit("أخذت " + String(Guns.DATA[id]["title"]))
		"ammo":
			var cal := String(it["id"])
			inv["ammo"][cal] = int(inv["ammo"].get(cal, 0)) + int(it.get("n", 30))
			message.emit("ذخيرة %s +%d" % [Guns.CALIBERS.get(cal, cal), int(it.get("n", 30))])
		"sight":
			# onto the gun in hand if it has a rail and nothing better on it; otherwise into the backpack
			var sid := String(it["id"])
			var g: Dictionary = inv["guns"][int(inv["cur"])]
			var bag: Array = inv.get("bag", [])
			var fits: bool = not g.is_empty() and Guns.points(String(g["id"]))["rail"] != Vector3.INF
			var cur_sid := String(g.get("sight", "")) if fits else ""
			if fits and (cur_sid == "" or float(Guns.SIGHTS[sid]["zoom"]) > float(Guns.SIGHTS.get(cur_sid, {"zoom": 0.0})["zoom"])):
				if cur_sid != "":
					bag.append({"type": "sight", "id": cur_sid})
				g["sight"] = sid
				save_ammo()
				weapon.equip(String(g["id"]), int(g["ammo"]), sid)
				message.emit("ركّبت " + String(Guns.SIGHTS[sid]["title"]))
			else:
				if bag.size() >= BAG_MAX:
					return false
				bag.append({"type": "sight", "id": sid})
				message.emit("في الحقيبة: " + String(Guns.SIGHTS[sid]["title"]))
			inv["bag"] = bag
		"med":
			var k := String(it["id"])
			inv["meds"][k] = int(inv["meds"].get(k, 0)) + int(it.get("n", 1))
			message.emit({"bandage": "ضمادات", "kit": "إسعافات أولية", "medkit": "حقيبة طبية"}.get(k, k))
		"helmet", "vest":
			var lv := int(it.get("n", 1))
			if lv <= int(inv[t]):
				return false
			inv[t] = lv
			message.emit(("خوذة" if t == "helmet" else "درع") + " مستوى %d" % lv)
		_:
			return false
	Sfx.play("ammo_pickup", -4.0)
	return true
