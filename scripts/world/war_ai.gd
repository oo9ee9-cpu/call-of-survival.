class_name WarAI
extends Node3D
## Both sides use their machines, with crews that think a little:
## * tanks: two per team leave their base, drive to the zone their side most needs (stopping 140 m short of it to
##   support from there), swing the turret onto the nearest enemy they can see and fire the gun; stuck, they back off
##   and try another way; a wrecked tank is replaced from the base after a while;
## * air strikes: now and then each side sends two jets from its side of the island to bomb the zone the enemy holds
##   (or the one being fought over); the enemy base's air defence fires at them, and they drop flares and break away.

const TANKS_PER_TEAM := 2
const TANK_STOP := 140.0
const SEE_TANK := 380.0
const SORTIE_ALT := 260.0
const SORTIE_SPEED := 175.0

var world: World
var match_: Match
var crews: Array[Dictionary] = []       # {"tank": Tank, "team", "goal", "stuck_t", "back_t", "aim_t", "target", "slot"}
var jets: Array[Dictionary] = []        # {"node", "team", "target", "bombs", "drop_t", "left"}
var _respawn: Array[Dictionary] = []    # {"team", "slot", "t"}
var _sortie_t := [70.0, 130.0]

func setup(w: World, m: Match) -> void:
	world = w
	match_ = m
	for team in 2:
		for k in TANKS_PER_TEAM:
			_spawn_tank(team, k)
	# each side's forward air defence, a little behind its deployment line by the city
	if world.air_defence:
		for team in 2:
			var pts: Array = match_.deploy[team]
			if pts.is_empty():
				continue
			var p: Vector3 = pts[0]
			var back: Vector3 = match_.side_dir[team]
			world.air_defence.add_site(p + back * 140.0, team)

## a tank out of the base's yard, a crew in it
func _spawn_tank(team: int, slot: int) -> void:
	if world.valley == null or world.valley.models == null:
		return
	var b := _base(team)
	if b.is_empty():
		return
	var bs := Basis(Vector3.UP, float(b["yaw"]))
	var p := Vector3(float(b["x"]), 0, float(b["z"])) + bs * Vector3(-40.0 + slot * 30.0, 0, 60.0)
	p.y = world.height(p.x, p.z) + 1.2
	var xf := Transform3D(Basis(Vector3.UP, float(b["yaw"])), p)
	var t := world.valley.models.spawn_vehicle("tank", xf) as Tank
	if t == null:
		return
	var crew := Node.new()
	crew.name = "TankCrew%d_%d" % [team, slot]
	crew.set_meta("team", team)
	add_child(crew)
	t.board(crew, 0)
	crews.append({"tank": t, "team": team, "crew": crew, "goal": Vector3.INF, "stuck_t": 0.0, "back_t": 0.0, "aim_t": 0.0,
		"target": null, "slot": slot, "think_t": 0.0})

func _base(team: int) -> Dictionary:
	for b in world.lay.get("bases", []):
		if int(b["team"]) == team:
			return b
	return {}

func _physics_process(delta: float) -> void:
	if world == null or not world.ready_built or match_ == null or match_.over:
		return
	var i := 0
	while i < crews.size():
		var c: Dictionary = crews[i]
		var t: Tank = c["tank"]
		if t == null or not is_instance_valid(t) or t.dead:
			_respawn.append({"team": c["team"], "slot": c["slot"], "t": 90.0})
			if is_instance_valid(c["crew"]):
				(c["crew"] as Node).queue_free()
			crews.remove_at(i)
			continue
		_drive(c, t, delta)
		i += 1
	for r in _respawn.duplicate():
		r["t"] = float(r["t"]) - delta
		if float(r["t"]) <= 0.0:
			_respawn.erase(r)
			_spawn_tank(int(r["team"]), int(r["slot"]))
	for team in 2:
		_sortie_t[team] = float(_sortie_t[team]) - delta
		if float(_sortie_t[team]) <= 0.0:
			_sortie_t[team] = randf_range(110.0, 170.0)
			_sortie(team)
	_fly(delta)

# ------------------------------------------------------------------ tanks
func _drive(c: Dictionary, t: Tank, delta: float) -> void:
	c["think_t"] = float(c["think_t"]) - delta
	if float(c["think_t"]) <= 0.0:
		c["think_t"] = 2.0
		var zi := match_.pick_zone(int(c["team"]), t.global_position)
		if zi >= 0:
			var zp := match_.zone_pos(zi)
			# stop short of it, on the side of the tank's own base, spread by slot
			var back := (t.global_position - zp)
			back.y = 0.0
			back = back.normalized() if back.length() > 1.0 else Vector3.BACK
			c["goal"] = zp + back.rotated(Vector3.UP, (int(c["slot"]) - 0.5) * 0.7) * TANK_STOP
	var goal: Vector3 = c["goal"]
	var fwd := t.global_transform.basis.z
	var steer := 0.0
	var thr := 0.0
	if goal != Vector3.INF:
		var to := goal - t.global_position
		to.y = 0.0
		var d := to.length()
		var ang := Vector2(fwd.x, fwd.z).angle_to(Vector2(to.x, to.z))
		if float(c["back_t"]) > 0.0:
			c["back_t"] = float(c["back_t"]) - delta
			thr = -0.6
			steer = 0.6
		elif d > 12.0:
			steer = clampf(ang * 1.6, -1.0, 1.0)
			thr = 0.85 if absf(ang) < 0.5 else 0.25
			# stuck against something (hardly moved in 4 s while driving): back up and swing round
			c["stuck_t"] = float(c["stuck_t"]) + delta
			if float(c["stuck_t"]) > 4.0:
				var from: Vector3 = c.get("stuck_from", t.global_position)
				if from.distance_to(t.global_position) < 2.5 and thr > 0.2:
					c["back_t"] = 2.5
				c["stuck_t"] = 0.0
				c["stuck_from"] = t.global_position
	var ref := world.phys_focus if world.phys_set else world.focus
	var far := ref.distance_to(t.global_position) > 170.0
	if far != t.ai_far:
		t.ai_far = far
		if far:
			t.freeze = true
		else:
			# back to the physics near the player: set down on the ground the collision now has
			var gp := t.global_position
			t.global_position = Vector3(gp.x, world.height(gp.x, gp.z) + 0.6, gp.z)
			t.freeze = false
			t.sleeping = false
	if far:
		# by hand: turn on the spot or drive at the tracks' pace, follow the ground's slope
		var xf := t.global_transform
		var b := Basis(Vector3.UP, -steer * 0.55 * delta) * xf.basis
		var p := xf.origin + b.z.slide(Vector3.UP).normalized() * thr * 7.5 * delta
		var hc := world.height(p.x, p.z)
		var n := Vector3(world.height(p.x - 2.0, p.z) - world.height(p.x + 2.0, p.z), 4.0, world.height(p.x, p.z - 2.0) - world.height(p.x, p.z + 2.0)).normalized()
		var fz := b.z.slide(n).normalized()
		b = Basis(n.cross(fz).normalized(), n, fz)
		t.global_transform = Transform3D(b.orthonormalized(), Vector3(p.x, hc + 0.1, p.z))
		t.ctl = Vector3.ZERO
		t._aim(delta)
		t.reload_t = maxf(t.reload_t - delta, 0.0)
	else:
		t.ctl = Vector3(steer, thr, 0.0)
	_gunner(c, t, delta)

## the gunner: the nearest enemy he can see, the turret onto him, fire when it bears
func _gunner(c: Dictionary, t: Tank, delta: float) -> void:
	c["aim_t"] = float(c["aim_t"]) - delta
	if float(c["aim_t"]) <= 0.0:
		c["aim_t"] = 0.6
		c["target"] = _enemy_for(int(c["team"]), t)
	var tgt: Node3D = c["target"]
	if tgt == null or not is_instance_valid(tgt):
		t.cam_yaw = lerp_angle(t.cam_yaw, 0.0, delta)
		t.cam_pitch = -0.12
		return
	var muzzle := t.turret.global_position if t.turret else t.global_position + Vector3(0, 2.5, 0)
	var to_w := tgt.global_position + Vector3(0, 1.0, 0) - muzzle
	var local := t.global_transform.basis.inverse() * to_w
	t.cam_yaw = atan2(local.x, local.z)
	var elev := atan2(local.y, Vector2(local.x, local.z).length())
	t.cam_pitch = -elev - 0.12
	if absf(wrapf(t.turret_yaw - t.cam_yaw, -PI, PI)) < 0.04 and t.reload_t <= 0.0 and to_w.length() < SEE_TANK:
		t.fire_primary()

func _enemy_for(team: int, t: Tank) -> Node3D:
	var best: Node3D = null
	var bd := SEE_TANK
	var from := t.global_position + Vector3(0, 2.6, 0)
	var cands: Array = []
	for b in match_.bots:
		if b.team != team and not b.dead and not b.retired:
			cands.append(b)
	var pl := match_.player
	if pl and pl.team != team and not pl.dead:
		cands.append(pl)
	for cr in crews:
		if int(cr["team"]) != team and is_instance_valid(cr["tank"]):
			cands.append(cr["tank"])
	var ss := t.get_world_3d().direct_space_state
	for n in cands:
		var p := (n as Node3D).global_position + Vector3(0, 1.2, 0)
		var d := from.distance_to(p)
		if d >= bd:
			continue
		var q := PhysicsRayQueryParameters3D.create(from, p, 1)
		q.exclude = [t.get_rid()]
		if not ss.intersect_ray(q).is_empty():
			continue
		if p.y < world.height((from.x + p.x) * 0.5, (from.z + p.z) * 0.5) + 0.5:
			continue
		bd = d
		best = n
	return best

# ------------------------------------------------------------------ air strikes
func _sortie(team: int) -> void:
	if world.raid == null:
		return
	# the target: a zone the enemy holds, else the one being fought over, else the enemy's side of the city
	var target := Vector3.INF
	var name := ""
	for i in match_.zones.size():
		if int(match_.zones[i]["owner"]) == 1 - team:
			target = match_.zone_pos(i)
			name = String(match_.zones[i]["name"])
			break
	if target == Vector3.INF:
		var zi := match_.pick_zone(team, match_.mid)
		target = match_.zone_pos(zi)
		name = String(match_.zones[zi]["name"])
	var b := _base(team)
	if b.is_empty():
		return
	var from := Vector3(float(b["x"]), 0, float(b["z"]))
	var dir := target - from
	dir.y = 0.0
	dir = dir.normalized()
	for k in 2:
		var side := Vector3(-dir.z, 0, dir.x) * (k * 120.0 - 60.0)
		var start := from - dir * (2400.0 + k * 300.0) + side
		start.y = target.y + SORTIE_ALT + k * 25.0
		var j := world.raid._plane("j36", start, dir * SORTIE_SPEED, "jet_loop", [Vector3(-5.5, 0, 3.0), Vector3(5.5, 0, 3.0)])
		j.set_meta("turn", 0.0)
		jets.append({"node": j, "team": team, "target": target, "bombs": 4, "drop_t": 0.0, "left": 14000.0})
	var pl := match_.player
	if pl:
		var ours := pl.team == team
		match_.note.emit(("طائراتنا في طريقها لقصف المنطقة «%s»" if ours else "طائرات العدو تتجه لقصف المنطقة «%s» — ابتعد عنها!") % name)

func _fly(delta: float) -> void:
	var i := 0
	while i < jets.size():
		var e: Dictionary = jets[i]
		var j: Node3D = e["node"]
		if j == null or not is_instance_valid(j) or bool(j.get_meta("down", false)):
			jets.remove_at(i)
			continue
		var v: Vector3 = j.get_meta("v")
		var turning: float = float(j.get_meta("turn", 0.0))
		if turning > 0.0:
			# breaking away from a missile: a hard turn, then back on course
			var w := 0.9 * delta
			v = v.rotated(Vector3.UP, w)
			j.set_meta("turn", turning - w)
		else:
			var to: Vector3 = e["target"] - j.global_position
			to.y = 0.0
			if int(e["bombs"]) > 0 and to.length() > 300.0:
				var want := to.normalized() * SORTIE_SPEED
				v = v.lerp(Vector3(want.x, v.y, want.z), clampf(delta * 0.6, 0.0, 1.0))
		j.set_meta("v", v)
		j.global_position += v * delta
		j.look_at(j.global_position + v, Vector3.UP)
		if turning > 0.0:
			j.rotate_object_local(Vector3.FORWARD, -0.8)
		# over the target: a bomb every half second
		var flat := Vector2(j.global_position.x - e["target"].x, j.global_position.z - e["target"].z)
		if int(e["bombs"]) > 0 and flat.length() < 70.0:
			e["drop_t"] = float(e["drop_t"]) - delta
			if float(e["drop_t"]) <= 0.0:
				e["drop_t"] = 0.45
				e["bombs"] = int(e["bombs"]) - 1
				world.projectiles.fire("bomb", j.global_position - Vector3(0, 2.0, 0), v * 0.9, self)
		e["left"] = float(e["left"]) - v.length() * delta
		if float(e["left"]) <= 0.0:
			j.queue_free()
			jets.remove_at(i)
			continue
		i += 1

## the air defence brought one down
func shot_down(j: Node3D) -> void:
	for e in jets:
		if e["node"] == j:
			jets.erase(e)
			break
	if world.raid:
		world.raid.jets.append(j)            # the raid's falling and burning
		world.raid.shot_down(j)
