class_name Weapon
extends Node3D
## The AK: hip / aimed pose, sway and bob, recoil that climbs, muzzle flash and light, ejected cases,
## reload with its sounds, semi / auto, bullets traced against everything (and the far height field).

const MAG := 30
const MAX_RESERVE := 210
const RPM := 600.0
const MUZZLE := Vector3(0.0, -0.0061, 0.5479)
const HIP := Vector3(0.11, -0.2, -0.42)
const HIP_ROT := Vector3(0.06, 0.06, 0.03)
const ADS := Vector3(0.0, -0.105, -0.32)

var player: Player
var world: World
var ammo := MAG
var reserve := 150
var auto := true
var cool := 0.0
var reload_t := -1.0
var reload_len := 0.0
var reload_empty := false
var reload_done := {}
var recoil_cam := Vector2.ZERO
var recoil_vel := Vector2.ZERO
var kick := 0.0
var ads := 0.0
var sway := Vector2.ZERO
var bloom := 0.0
var touch_fire := false
var aim_toggle := false
var trigger_was := false
var shots_in_burst := 0
var wall_k := 0.0
var model: Node3D
var flash_root: Node3D
var flash_quads: Array[MeshInstance3D] = []
var flash_light: OmniLight3D
var flash_t := 0.0
var shells: Array[CPUParticles3D] = []
var shell_i := 0

func _ready() -> void:
	model = (load("res://models/ak.glb") as PackedScene).instantiate() as Node3D
	model.rotation.y = PI
	add_child(model)
	_no_shadows(model)
	flash_root = Node3D.new()
	flash_root.position = Vector3(-MUZZLE.x, MUZZLE.y, -MUZZLE.z - 0.02)
	add_child(flash_root)
	var star := StandardMaterial3D.new()
	star.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	star.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	star.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	star.albedo_texture = load("res://textures/fx/flash.png")
	star.albedo_color = Color(1.0, 0.8, 0.55)
	star.cull_mode = BaseMaterial3D.CULL_DISABLED
	star.disable_receive_shadows = true
	var side := star.duplicate() as StandardMaterial3D
	side.albedo_texture = load("res://textures/fx/flash_side.png")
	var qf := QuadMesh.new()
	qf.size = Vector2(0.2, 0.2)
	qf.material = star
	var f := MeshInstance3D.new()
	f.mesh = qf
	flash_root.add_child(f)
	flash_quads.append(f)
	for k in 2:
		var qs := QuadMesh.new()
		qs.size = Vector2(0.34, 0.11)
		qs.center_offset = Vector3(0.0, 0.0, 0.0)
		qs.material = side
		var s := MeshInstance3D.new()
		s.mesh = qs
		s.rotation = Vector3(0.0, PI * 0.5, k * PI * 0.5)
		s.position = Vector3(0, 0, -0.15)
		flash_root.add_child(s)
		flash_quads.append(s)
	for q in flash_quads:
		q.visible = false
		q.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	flash_light = OmniLight3D.new()
	flash_light.light_color = Color(1.0, 0.7, 0.4)
	flash_light.omni_range = 9.0
	flash_light.light_energy = 0.0
	flash_light.visible = false
	flash_root.add_child(flash_light)
	var brass := StandardMaterial3D.new()
	brass.albedo_color = Color(0.72, 0.55, 0.25)
	brass.metallic = 0.9
	brass.roughness = 0.3
	var cm := CylinderMesh.new()
	cm.top_radius = 0.0055
	cm.bottom_radius = 0.0058
	cm.height = 0.039
	cm.radial_segments = 6
	cm.rings = 1
	cm.material = brass
	for i in 5:
		var p := CPUParticles3D.new()
		p.amount = 1
		p.lifetime = 0.9
		p.one_shot = true
		p.emitting = false
		p.local_coords = false
		p.mesh = cm
		p.direction = Vector3(1, 0.6, 0.15)
		p.spread = 12.0
		p.initial_velocity_min = 2.4
		p.initial_velocity_max = 3.3
		p.angular_velocity_min = -720.0
		p.angular_velocity_max = 720.0
		p.gravity = Vector3(0, -9.8, 0)
		p.particle_flag_rotate_y = true
		p.position = Vector3(-0.03, 0.04, -0.12)
		add_child(p)
		shells.append(p)

func _no_shadows(n: Node) -> void:
	if n is GeometryInstance3D:
		(n as GeometryInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	for c in n.get_children():
		_no_shadows(c)

func aim_held() -> bool:
	return (Input.is_action_pressed("aim") and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED) or aim_toggle

func trigger_held() -> bool:
	return (Input.is_action_pressed("fire") and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED) or touch_fire

func toggle_mode() -> void:
	auto = not auto
	Sfx.play("ak_select", -6.0)
	player.message.emit("رمي آلي" if auto else "رمي فردي")

func reload() -> void:
	if reload_t >= 0.0 or ammo >= MAG + 1 or reserve <= 0:
		return
	reload_empty = ammo == 0
	reload_len = 2.9 if reload_empty else 2.25
	reload_t = 0.0
	reload_done = {}

func _process(delta: float) -> void:
	if player == null or not player.active:
		return
	cool = maxf(cool - delta, 0.0)
	var trig := trigger_held()
	if reload_t >= 0.0:
		_reload_step(delta)
	elif trig:
		if ammo <= 0:
			if not trigger_was:
				Sfx.play("ak_dry", -4.0)
				reload()
		elif cool <= 0.0 and (auto or not trigger_was) and wall_k < 0.5 and not player.sprinting:
			_fire()
	if not trig:
		shots_in_burst = 0
	trigger_was = trig
	_pose(delta)
	if flash_t > 0.0:
		flash_t -= delta
		if flash_t <= 0.0:
			for q in flash_quads:
				q.visible = false
			flash_light.visible = false

func _reload_step(delta: float) -> void:
	reload_t += delta
	var ev := [[0.28, "out", "ak_mag_out"], [1.2, "in", "ak_mag_in"]]
	if reload_empty:
		ev.append([1.95, "bolt", "ak_bolt"])
	for e in ev:
		if reload_t >= float(e[0]) and not reload_done.has(e[1]):
			reload_done[e[1]] = true
			Sfx.play(e[2], -3.0, 0.03)
	if reload_t >= reload_len:
		var want := MAG - ammo + (0 if reload_empty else 1)
		want = mini(want, MAG)
		var take := mini(want, reserve)
		ammo += take
		reserve -= take
		reload_t = -1.0

func _fire() -> void:
	ammo -= 1
	cool = 60.0 / RPM
	shots_in_burst += 1
	var cam := player.cam
	var origin := cam.global_position
	var fwd := -cam.global_transform.basis.z
	var gun_dir := -(global_transform.basis.z).normalized()
	var dir := fwd.lerp(gun_dir, 0.35 * (1.0 - ads)).normalized()
	var third := player.tpp_k > 0.5
	if third:
		# over the shoulder: shoot where the crosshair is, starting level with the soldier (nothing behind him counts)
		dir = fwd
		origin += fwd * (player.spring.get_hit_length() + 0.35)
		player.body.shot_flash()
	var spread := deg_to_rad(lerpf(1.1, 0.18, ads) + bloom * 2.2 + (0.8 if not player.is_on_floor() else 0.0) + (0.5 if third else 0.0))
	var r1 := randf() * TAU
	var r2 := sqrt(randf()) * spread
	var right := cam.global_transform.basis.x
	var up := cam.global_transform.basis.y
	dir = (dir + right * cos(r1) * r2 + up * sin(r1) * r2).normalized()
	_trace(origin, dir)
	bloom = minf(bloom + 0.12, 1.0)
	var climb := lerpf(0.016, 0.011, ads) * (1.0 + minf(shots_in_burst, 8) * 0.08)
	recoil_vel += Vector2(climb * 14.0, randf_range(-0.6, 0.75) * climb * 7.0)
	kick = minf(kick + 0.045, 0.09)
	Sfx.play("ak_shot", 1.0, 0.04)
	if Sfx.inside < 0.5:
		Sfx.play("ak_tail", -5.0, 0.05, "Ambience")
	player.add_shake(0.045)
	flash_t = 0.045
	for q in flash_quads:
		q.visible = true
	flash_quads[0].rotation.z = randf() * TAU
	var s := randf_range(0.8, 1.35)
	flash_root.scale = Vector3(s, s, randf_range(0.8, 1.4))
	flash_light.visible = true
	flash_light.light_energy = randf_range(2.6, 4.2)
	if world.env:
		world.env.flash = maxf(world.env.flash, 0.015)
	var sh := shells[shell_i]
	shell_i = (shell_i + 1) % shells.size()
	sh.restart()
	var gp := player.global_position + player.global_transform.basis.x * 0.6
	gp.y = world.height(gp.x, gp.z) + 0.02
	Sfx.play_at("casing", gp, -10.0, 2.0, 0.0, 0.5, 0.15)

func _trace(origin: Vector3, dir: Vector3) -> void:
	var ss := get_world_3d().direct_space_state
	var to := origin + dir * 700.0
	var q := PhysicsRayQueryParameters3D.create(origin, to, 1 | 2)
	q.exclude = [player.get_rid()]
	var r := ss.intersect_ray(q)
	var far := world.ray_ground(origin, dir, 700.0)
	if not r.is_empty():
		var pos: Vector3 = r["position"]
		if not far.is_empty() and origin.distance_to(far["position"]) < origin.distance_to(pos) - 0.3:
			world.fx.impact(far["position"], far["normal"], far["surface"])
			return
		var nrm: Vector3 = r["normal"]
		var col = r.get("collider")
		var surface := ""
		if col is RigidBody3D:
			var rb := col as RigidBody3D
			surface = str(rb.get_meta("surface", "metal"))
			rb.sleeping = false
			rb.apply_impulse(dir * (1.6 if surface == "metal" else 2.4), pos - rb.global_position)
			world.fx.burst("spark" if surface == "metal" else "glass", pos, nrm)
			Sfx.play_at("impact_metal" if surface == "metal" else "impact_glass", pos, 0.0, 4.0)
			return
		var rid: RID = r["rid"]
		if world.props.hit_plate(rid, dir):
			world.fx.burst("spark", pos, nrm)
			Sfx.play_at("impact_plate", pos, 4.0, 8.0)
			return
		surface = world.props.surface_of(rid, int(r["shape"]))
		if surface == "":
			surface = world.surface_at(pos) if col is Terrain or col == null else "wood"
			if col is Veg:
				surface = "wood"
		world.fx.impact(pos, nrm, surface)
	elif not far.is_empty():
		world.fx.impact(far["position"], far["normal"], far["surface"])

func _pose(delta: float) -> void:
	var aiming := player.aiming and reload_t < 0.0
	ads = move_toward(ads, 1.0 if aiming else 0.0, delta * 4.5)
	var a := smoothstep(0.0, 1.0, ads)
	bloom = maxf(bloom - delta * 1.6, 0.0)
	# camera recoil: kicked up, springs back
	recoil_cam += recoil_vel * delta
	recoil_vel = recoil_vel.lerp(Vector2.ZERO, clampf(delta * 18.0, 0.0, 1.0))
	recoil_cam = recoil_cam.lerp(Vector2.ZERO, clampf(delta * (3.5 if trigger_held() else 6.0), 0.0, 1.0))
	kick = move_toward(kick, 0.0, delta * 0.5)
	# sway follows the look, bob follows the steps
	var turn := player.last_look * 60.0
	sway = sway.lerp(Vector2(clampf(-turn.x * 0.004, -0.05, 0.05), clampf(-turn.y * 0.004, -0.04, 0.04)), clampf(delta * 8.0, 0.0, 1.0))
	var hs := Vector2(player.velocity.x, player.velocity.z).length()
	var bk := clampf(hs / 5.6, 0.0, 1.0) * (0.35 if aiming else 1.0)
	var bob := Vector3(cos(player.step_phase * 0.5) * 0.012, absf(sin(player.step_phase * 0.5)) * 0.014 - 0.007, 0.0) * bk
	var idle := Vector3(sin(Time.get_ticks_msec() * 0.0011) * 0.002, sin(Time.get_ticks_msec() * 0.0017) * 0.0025, 0.0) * (1.0 - a * 0.6)
	# too close to a wall: pull the rifle up and back
	var ss := get_world_3d().direct_space_state
	var cam := player.cam
	var q := PhysicsRayQueryParameters3D.create(cam.global_position, cam.global_position - cam.global_transform.basis.z * 0.85, 1 | 2)
	q.exclude = [player.get_rid()]
	var hit := ss.intersect_ray(q)
	var wk := 0.0
	if not hit.is_empty() and player.tpp_k < 0.5:
		wk = clampf(1.0 - cam.global_position.distance_to(hit["position"]) / 0.85, 0.0, 1.0)
	wall_k = lerpf(wall_k, wk, clampf(delta * 10.0, 0.0, 1.0))
	var sprint_k := 1.0 if (player.sprinting and reload_t < 0.0) else 0.0
	var pos := HIP.lerp(ADS, a) + bob + idle + Vector3(sway.x, sway.y, kick)
	var rot := HIP_ROT.lerp(Vector3.ZERO, a) + Vector3(sway.y * 1.5 + kick * 1.2, sway.x * 1.5, sway.x * 2.0)
	# reload: tip the rifle over and down
	if reload_t >= 0.0:
		var rt := reload_t / reload_len
		var k := smoothstep(0.0, 0.18, rt) * (1.0 - smoothstep(0.82, 1.0, rt))
		pos += Vector3(-0.05, -0.07, 0.03) * k
		rot += Vector3(-0.35, 0.25, 0.7) * k
	pos += Vector3(0.02, -0.06, 0.06) * wall_k
	rot += Vector3(0.8, 0.0, 0.25) * wall_k
	pos += Vector3(-0.03, -0.05, 0.02) * sprint_k
	rot += Vector3(-0.35, 0.6, 0.35) * sprint_k
	position = position.lerp(pos, clampf(delta * 16.0, 0.0, 1.0))
	rotation = rotation.lerp(rot, clampf(delta * 14.0, 0.0, 1.0))
