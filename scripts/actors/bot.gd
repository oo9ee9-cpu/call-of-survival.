class_name Bot
extends CharacterBody3D
## A computer-controlled soldier of one of the two teams. Near the player it is a full soldier on the physics ground
## (collides, climbs, its body animated and aiming); far away it walks on the height field without physics and without
## a body to draw, so a hundred of them cost little. It heads for a capture zone its team does not hold (or holds one),
## stops to fight whoever of the other team it can see (it needs a moment to react, misses more at range and when
## moving), runs for cover when it reloads or gets hurt (a spot a few metres away that hides it from the shooter, where
## it crouches, then comes back up to fight), crouches to shoot at range, dies, leaves a crate, and comes back in at
## its team's deployment points or a zone its team holds.

const NEAR := 110.0                  # physics and full body within this distance of the player
const SEE := 170.0
const GUNS_BY_ROLE := ["ak", "ak", "carbine", "carbine", "smg", "shotgun", "sniper"]

var world: World
var match_: Match
var team := 1
var bot_name := ""
var health := 100.0
var dead := false
var body: Soldier
var gun := "ak"
var spec: Dictionary
var mag := 30
var cool := 0.0
var reload_t := 0.0
var target: Node3D
var react := 0.0
var goal := Vector3.ZERO
var goal_zone := -1
var think_t := 0.0
var see_t := 0.0
var yaw := 0.0
var near := false
var kills := 0
var _stuck_t := 0.0
var _last_p := Vector3.ZERO
var _strafe := 1.0
var _dead_t := 0.0
var _feel_t := 0.0
var _detour := Vector3.ZERO
var col: CollisionShape3D
var cap: CapsuleShape3D
var cover := Vector3.INF               # where it is hiding (INF: not hiding)
var cover_t := 0.0                     # how long it stays down there
var cover_cool := 0.0                  # time before it looks for cover again
var crouch := false
var kneel_t := 0.0                     # crouched shooting at range, for a while
var lod_force := -1                    # developer checks: a fixed level of detail

func setup(w: World, m: Match, t: int, nm: String) -> void:
	world = w
	match_ = m
	team = t
	bot_name = nm

func _ready() -> void:
	add_to_group("soldiers")
	add_to_group("bots")
	collision_layer = 4
	collision_mask = 1 | 2 | Vehicle.LAYER
	floor_max_angle = deg_to_rad(50.0)
	floor_snap_length = 0.5
	cap = CapsuleShape3D.new()
	cap.radius = 0.3
	cap.height = 1.8
	col = CollisionShape3D.new()
	col.shape = cap
	col.position.y = 0.9
	add_child(col)
	body = Soldier.new()
	add_child(body)
	gun = GUNS_BY_ROLE[randi() % GUNS_BY_ROLE.size()]
	spec = Guns.DATA[gun]
	mag = int(spec["mag"])
	body.set_weapon.call_deferred(gun)
	body.set_outfit.call_deferred(Color(0.42, 0.46, 0.36) if team == 0 else Color(0.62, 0.52, 0.38))
	body.set_shadows(false)
	_strafe = 1.0 if randf() < 0.5 else -1.0

func spawn_at(p: Vector3, facing: float) -> void:
	global_position = p
	yaw = facing
	health = 100.0
	dead = false
	body.revive()
	body.body_yaw = facing
	velocity = Vector3.ZERO
	target = null
	collision_layer = 4
	visible = true
	mag = int(spec["mag"])
	reload_t = 0.0
	goal_zone = -1
	think_t = 0.0
	cover = Vector3.INF
	cover_t = 0.0
	_set_crouch(false)

# ------------------------------------------------------------------ damage
func take_damage(amount: float, from: Vector3, attacker: Node = null) -> void:
	if dead:
		return
	var head := from.y - global_position.y > (0.95 if crouch else 1.45)
	health -= amount * (2.0 if head else 1.0)
	if attacker and is_instance_valid(attacker) and attacker is Node3D:
		if target == null or randf() < 0.6:
			target = attacker as Node3D
			react = 0.0
	if health <= 0.0:
		_die(attacker, head)

func _die(attacker: Node, head: bool) -> void:
	dead = true
	body.dead = true
	collision_layer = 0
	velocity = Vector3.ZERO
	_dead_t = 0.0
	if match_:
		match_.on_kill(attacker, self, head)
	if world.valley and world.valley.loot and randf() < 0.7:
		var kit := [{"type": "gun", "id": gun, "n": int(spec["mag"])}, {"type": "ammo", "id": String(spec["cal"]), "n": int(spec["mag"]) * 2}]
		if randf() < 0.5:
			kit.append({"type": "med", "id": "bandage", "n": 2})
		world.valley.loot.drop_crate(global_position + Vector3(0, 0.05, 0), kit)

# ------------------------------------------------------------------ the brain
func _physics_process(delta: float) -> void:
	if world == null or not world.ready_built:
		return
	var ref := world.phys_focus if world.phys_set else world.focus
	var dist := ref.distance_to(global_position)
	var was_near := near
	near = dist < NEAR
	if near != was_near:
		collision_mask = (1 | 2 | Vehicle.LAYER) if near else 0
	body.set_lod(lod_force if lod_force >= 0 else (0 if dist < 35.0 else (1 if dist < 120.0 else (2 if dist < 450.0 else 3))))
	if dead:
		_dead_t += delta
		if _dead_t > 7.0 and match_:
			match_.respawn(self)
		return
	cool = maxf(cool - delta, 0.0)
	think_t -= delta
	if think_t <= 0.0:
		think_t = randf_range(0.6, 1.0)
		_think()
	see_t -= delta
	if see_t <= 0.0:
		see_t = randf_range(0.25, 0.45) * (1.0 if near else 3.0)
		_look_for_enemies()
	var mv := Vector3.ZERO
	var spd := 4.0
	var pitch := 0.0
	cover_cool = maxf(cover_cool - delta, 0.0)
	if reload_t > 0.0 and (target == null or not is_instance_valid(target)):
		_reload_step(delta)
	if target and is_instance_valid(target) and _alive(target):
		var to := target.global_position - global_position
		var d := to.length()
		yaw = lerp_angle(yaw, atan2(-to.x, -to.z), clampf(delta * 6.0, 0.0, 1.0))
		pitch = atan2(to.y, Vector2(to.x, to.z).length())
		react += delta
		# reloading or hurt: off to a spot that hides it from the shooter, crouch there for a moment
		if cover == Vector3.INF and near and cover_cool <= 0.0 and (reload_t > 0.0 or (health < 55.0 and randf() < 0.02)):
			cover_cool = 6.0
			cover = _find_cover(target.global_position)
			cover_t = maxf(reload_t, 0.0) + randf_range(1.0, 2.5)
		if cover != Vector3.INF:
			var tc := cover - global_position
			tc.y = 0.0
			cover_t -= delta
			if tc.length() > 0.6:
				mv = tc.normalized()
				spd = 4.4
				_set_crouch(false)
			else:
				_set_crouch(true)
			if reload_t > 0.0:
				_reload_step(delta)
			if cover_t <= 0.0:
				cover = Vector3.INF
				_set_crouch(false)
		else:
			# close in to its gun's range, strafe a little while shooting; at range it kneels to shoot now and then
			var want_range := 25.0 if gun == "shotgun" or gun == "smg" else (120.0 if gun == "sniper" else 60.0)
			var side := Vector3(-to.z, 0.0, to.x).normalized() * _strafe
			kneel_t -= delta
			if kneel_t <= 0.0:
				kneel_t = randf_range(2.0, 4.0)
				_set_crouch(d > 45.0 and d <= want_range * 1.3 and randf() < 0.55)
			if d > want_range:
				mv = to.normalized() * 0.8 + side * 0.2
				spd = 3.2
				_set_crouch(false)
			elif not crouch:
				mv = side * 0.5
				spd = 1.6
			if react > 0.5:
				_shoot(target, d)
	else:
		target = null
		if cover != Vector3.INF or crouch:
			cover = Vector3.INF
			_set_crouch(false)
		var to := goal - global_position
		to.y = 0.0
		if to.length() > 6.0:
			mv = to.normalized()
			yaw = lerp_angle(yaw, atan2(-to.x, -to.z), clampf(delta * 3.0, 0.0, 1.0))
		else:
			mv = Vector3(sin(Time.get_ticks_msec() * 0.0004 + bot_name.length()), 0, cos(Time.get_ticks_msec() * 0.0003)) * 0.3
			spd = 1.2
	_move(mv, spd, delta)
	body.aim_yaw = yaw
	body.aim_pitch = lerpf(body.aim_pitch, clampf(pitch, -0.9, 0.9), clampf(delta * 5.0, 0.0, 1.0))
	body.crouch = move_toward(body.crouch, 1.0 if crouch else 0.0, delta * 4.0)
	body.speed = Vector2(velocity.x, velocity.z).length()
	body.move_dir = Vector2(velocity.x, velocity.z).normalized() if body.speed > 0.1 else Vector2.ZERO
	body.low_ready = 0.0 if target else 0.7
	body.face(delta, target != null)

func _set_crouch(on: bool) -> void:
	if on == crouch:
		return
	crouch = on
	cap.height = 1.2 if on else 1.8
	col.position.y = cap.height * 0.5

## a spot 3 to 9 metres away it can run to in a straight line, where something stands between it (crouched) and the
## shooter; the nearest such spot, or none
func _find_cover(threat: Vector3) -> Vector3:
	var ss := get_world_3d().direct_space_state
	var base := global_position
	var best := Vector3.INF
	var bd := INF
	var away := base - threat
	away.y = 0.0
	away = away.normalized()
	for k in 10:
		var a := TAU * k / 10.0 + randf() * 0.4
		var r := randf_range(3.0, 9.0)
		var p := base + Vector3(sin(a) * r, 0.0, cos(a) * r)
		var q := PhysicsRayQueryParameters3D.create(base + Vector3(0, 0.5, 0), p + Vector3(0, 0.5, 0), 1 | 2 | Vehicle.LAYER)
		q.exclude = [get_rid()]
		if not ss.intersect_ray(q).is_empty():
			continue
		var q2 := PhysicsRayQueryParameters3D.create(p + Vector3(0, 1.0, 0), threat + Vector3(0, 1.3, 0), 1 | 2 | Vehicle.LAYER)
		q2.exclude = [get_rid()]
		if ss.intersect_ray(q2).is_empty():
			continue
		# rather away from the shooter than towards him
		var d := p.distance_to(base) * (1.4 - 0.4 * (p - base).normalized().dot(away))
		if d < bd:
			bd = d
			best = p
	return best

func _reload_step(delta: float) -> void:
	reload_t -= delta
	if reload_t <= 0.0:
		reload_t = 0.0
		mag = int(spec["mag"])

func _alive(n: Node3D) -> bool:
	if n is Bot:
		return not (n as Bot).dead
	if n is Player:
		return not (n as Player).dead
	return is_instance_valid(n)

func _move(dir: Vector3, spd: float, delta: float) -> void:
	dir.y = 0.0
	if dir.length() > 1.0:
		dir = dir.normalized()
	if near:
		# around obstacles: feel ahead at knee height and turn away from what is there
		if dir.length() > 0.1:
			var ss := get_world_3d().direct_space_state
			var o := global_position + Vector3(0, 0.6, 0)
			var q := PhysicsRayQueryParameters3D.create(o, o + dir.normalized() * 1.6, 1 | 2 | Vehicle.LAYER)
			q.exclude = [get_rid()]
			if not ss.intersect_ray(q).is_empty():
				dir = dir.rotated(Vector3.UP, 1.1 * _strafe)
		var hv := dir * spd
		velocity.x = move_toward(velocity.x, hv.x, delta * 12.0)
		velocity.z = move_toward(velocity.z, hv.z, delta * 12.0)
		if not is_on_floor():
			velocity.y -= 9.8 * delta
		else:
			velocity.y = -0.5
		move_and_slide()
		# stuck against something: try the other way round
		_stuck_t += delta
		if _stuck_t > 1.5:
			if global_position.distance_to(_last_p) < 0.6 and dir.length() > 0.1:
				_strafe = -_strafe
				if is_on_wall():
					velocity.y = 4.5
			_stuck_t = 0.0
			_last_p = global_position
	else:
		# far away: walk on the height field, no physics; feel a few metres ahead for the walls of the houses (the
		# city's grid) and go round them
		var v := world.valley
		if v and dir.length() > 0.1:
			_feel_t -= delta
			if _feel_t <= 0.0:
				_feel_t = 0.3
				_detour = _way_round(dir.normalized())
			if _detour != Vector3.ZERO:
				dir = _detour * dir.length()
		var p := global_position + dir * spd * delta
		if v and v.roof_at(p.x, p.z) > 0.0 and v.roof_at(global_position.x, global_position.z) <= 0.0:
			p = global_position          # never into a wall
		p.y = world.height(p.x, p.z)
		velocity = dir * spd
		global_position = p

## a way past the walls ahead: straight on if it is open, else turned a little, then more, to one side first
func _way_round(d: Vector3) -> Vector3:
	var v := world.valley
	if v.roof_at(global_position.x, global_position.z) > 0.0:
		return Vector3.ZERO              # inside already (walked in while near the player): straight out
	for a in [0.0, 0.5, -0.5, 1.0, -1.0, 1.6, -1.6, 2.3, -2.3]:
		var dd := d.rotated(Vector3.UP, float(a) * _strafe)
		var q1 := global_position + dd * 1.5
		var q2 := global_position + dd * 4.0
		if v.roof_at(q1.x, q1.z) <= 0.0 and v.roof_at(q2.x, q2.z) <= 0.0:
			return dd
	_strafe = -_strafe
	return -d

## pick where to go: a zone its team does not hold, else hold one (with a few of them roaming)
func _think() -> void:
	if match_ == null:
		return
	if goal_zone < 0 or match_.zone_owner(goal_zone) == team and randf() < 0.3:
		goal_zone = match_.pick_zone(team, global_position)
		var z := match_.zone_pos(goal_zone)
		goal = z + Vector3(randf_range(-14, 14), 0, randf_range(-14, 14))

## the nearest enemy it can see (a ray from its eyes to the chest), looked for a few times a second
func _look_for_enemies() -> void:
	var best: Node3D = null
	var bd := SEE
	for n in get_tree().get_nodes_in_group("soldiers"):
		var s := n as Node3D
		if s == self or not _alive(s):
			continue
		var t := team_of(s)
		if t == team or t < 0:
			continue
		var d := s.global_position.distance_to(global_position)
		if d < bd:
			if d > 8.0 and not _can_see(s):
				continue
			bd = d
			best = s
	if best != target:
		target = best
		react = 0.0

static func team_of(n: Node) -> int:
	if n is Bot:
		return (n as Bot).team
	if n is Player:
		return (n as Player).team
	return -1

func _can_see(s: Node3D) -> bool:
	if not near:
		# far from the player there are no colliders: line of sight over the height field and the city's houses
		var a := global_position + Vector3(0, 1.6, 0)
		var b := s.global_position + Vector3(0, 1.2, 0)
		var dist := a.distance_to(b)
		var n := clampi(int(dist / 4.0), 4, 48)
		var v := world.valley
		for k in range(1, n):
			var f := float(k) / n
			var p := a.lerp(b, f)
			var g := world.height(p.x, p.z)
			if p.y < g + 0.5:
				return false
			if v and f * dist > 2.5 and (1.0 - f) * dist > 2.5 and p.y < g + v.roof_at(p.x, p.z):
				return false
		return true
	var ss := get_world_3d().direct_space_state
	var q := PhysicsRayQueryParameters3D.create(global_position + Vector3(0, 1.6, 0), s.global_position + Vector3(0, 1.2, 0), 1 | 2)
	q.exclude = [get_rid()]
	return ss.intersect_ray(q).is_empty()

func _shoot(t: Node3D, d: float) -> void:
	if reload_t > 0.0:
		if cover == Vector3.INF:
			_reload_step(get_physics_process_delta_time())
		return
	if cool > 0.0:
		return
	if mag <= 0:
		reload_t = float(spec.get("reload", 2.2)) + 0.4
		return
	cool = 60.0 / float(spec["rpm"]) * (1.0 if bool(spec["auto"]) else 1.6) + randf() * 0.05
	if randf() < 0.25 and bool(spec["auto"]):
		cool += randf_range(0.25, 0.6)          # short bursts
	mag -= 1
	body.shot_flash()
	if near or d < 200.0:
		var cam := get_viewport().get_camera_3d()
		var dc := cam.global_position.distance_to(global_position) if cam else 999.0
		if dc < 400.0:
			Sfx.play_at("enemy_fire" if dc > 90.0 else String(spec.get("sound", "ak_shot")), global_position + Vector3(0, 1.5, 0), -4.0 if dc < 90.0 else 2.0, 12.0, 600.0, 0.0, 0.08)
	# hit chance: worse with range, movement and the first moments
	var p := 0.55 - d / 260.0 - (0.15 if body.speed > 1.0 else 0.0) + clampf(react - 0.5, 0.0, 1.5) * 0.12 + (0.08 if crouch else 0.0)
	if t is Bot and (t as Bot).crouch:
		p -= 0.1
	if gun == "sniper":
		p += 0.2
	var pellets := int(spec.get("pellets", 1))
	for k in pellets:
		if randf() < clampf(p, 0.04, 0.85):
			var dmg := float(spec["dmg"]) * clampf(1.15 - d / 900.0, 0.5, 1.0)
			var low := t is Bot and (t as Bot).crouch
			var hy := (0.75 if randf() > 0.12 else 1.05) if low else (1.2 if randf() > 0.12 else 1.6)
			var at := t.global_position + Vector3(randf_range(-0.2, 0.2), hy, randf_range(-0.2, 0.2))
			if t is Player:
				dmg *= 0.55           # the player can take a little more than a bot
			t.call("take_damage", dmg, at, self)
		elif world.fx and near:
			var miss := t.global_position + Vector3(randf_range(-1.5, 1.5), randf_range(0.0, 2.0), randf_range(-1.5, 1.5))
			world.fx.impact(Vector3(miss.x, world.height(miss.x, miss.z), miss.z), Vector3.UP, "dirt")
