class_name AirDefence
extends Node3D
## Air defence on the island: radar sites at the two team bases (their own team), at both airports and at the port
## (neutral: they only fire at the raiders). A radar that sees an aircraft of the other side inside its circle
## (RANGE metres round it, under CEIL) fires a surface-to-air missile from its launcher: the AMRAAM model from the
## repository climbing out of a cloud of smoke, then turning after the aircraft. The missile is faster than a jet but
## turns slower than a hard-banking one, and it can be fooled by flares: so a good pilot gets away (break into a tight
## turn as it comes, drop flares at the right moment), a careless one is hit (proximity fuse, 15 m).
## The raid's jets and the AI pilots do the same: flares and a break turn when a missile closes on them.

const RANGE := 1200.0            # the radar's circle (metres, level)
const CEIL := 2600.0             # it sees nothing above this
const COOLDOWN := 6.5            # between two launches of one site
const BOOST := 0.9               # seconds straight up out of the tube
const VMAX := 430.0              # the missile's top speed (a jet flies at 170)
const TURN := 0.42               # how fast it can turn (radians a second at top speed)
const FUSE := 15.0
const LIFE := 13.0

var world: World
var sites: Array[Dictionary] = []      # {"pos", "launch", "team", "cool", "dish": Node3D}
var missiles: Array[Dictionary] = []   # {"node", "smoke", "target", "p", "v", "t", "decoy", "site_team"}
var flares: Array[Dictionary] = []     # {"node", "p", "v", "t"}
var warn_player := 0.0                 # > 0: a missile is after the player's aircraft
var _scan := 0.0
var _model: PackedScene

func setup(w: World) -> void:
	world = w
	_model = load("res://models/u/amraam.glb") if ResourceLoader.exists("res://models/u/amraam.glb") else null
	var lay := w.lay
	var vm: ValleyModels = w.valley.models if w.valley else null
	for b in lay.get("bases", []):
		var bs := Basis(Vector3.UP, float(b["yaw"]))
		var c := Vector3(float(b["x"]), 0, float(b["z"]))
		var lp := c + bs * Vector3(0, 0, -150)                       # the Pantsir the base already has
		_site(lp, int(b["team"]), vm, false, float(b["yaw"]))
	for ap in lay.get("airports", []):
		var sc := float(ap["len"]) / 2400.0
		_site(Vector3(float(ap["x"]) + 520.0 * sc, 0, float(ap["z"]) - 470.0), -1, vm, true, 0.0)
	var pt: Dictionary = lay.get("port", {})
	if not pt.is_empty():
		_site(Vector3(float(pt["x"]) + 260.0, 0, float(pt["z"]) - 600.0), -1, vm, true, PI * 0.5)

## a team's own site somewhere else (the war AI puts one behind each side's line by the city)
func add_site(p: Vector3, team: int) -> void:
	_site(p, team, world.valley.models if world.valley else null, true, 0.0)

## one site: (for the neutral ones) a Patriot launcher and a radar beside it; the dish turns
func _site(p: Vector3, team: int, vm: ValleyModels, build: bool, yaw: float) -> void:
	p.y = world.height(p.x, p.z)
	var dish: Node3D = null
	if vm and build:
		vm.place("patriot", vm._ground_xf("patriot", p.x, p.z, yaw))
		var rp := p + Basis(Vector3.UP, yaw) * Vector3(35, 0, 10)
		dish = vm.place("radar", vm._ground_xf("radar", rp.x, rp.z, yaw))
	sites.append({"pos": p, "launch": p + Vector3(0, 4.5, 0), "team": team, "cool": randf_range(0.0, 3.0), "dish": dish})

# ------------------------------------------------------------------ who flies where
## every aircraft in the air: [node, team (-2 the raiders), is the player in it]
func _targets() -> Array:
	var out := []
	if world.valley and world.valley.models:
		for v in world.valley.models.vehicles:
			if not (v is Aircraft) or v.dead:
				continue
			var d := v.driver()
			if d == null:
				continue
			if v.global_position.y - world.height(v.global_position.x, v.global_position.z) < 25.0:
				continue
			var tm := int(d.get_meta("team")) if d.has_meta("team") else (int(d.get("team")) if d.get("team") != null else 0)
			out.append([v, tm, d is Player])
	if world.raid:
		for j in world.raid.jets:
			if is_instance_valid(j) and not j.get_meta("down", false):
				out.append([j, -2, false])
	if world.war:
		for e in world.war.jets:
			var j: Node3D = e["node"]
			if is_instance_valid(j) and not j.get_meta("down", false):
				out.append([j, int(e["team"]), false])
	return out

func _process(delta: float) -> void:
	if world == null or not world.ready_built:
		return
	warn_player = maxf(warn_player - delta, 0.0)
	for s in sites:
		s["cool"] = maxf(float(s["cool"]) - delta, 0.0)
		var dish: Node3D = s["dish"]
		if dish and is_instance_valid(dish):
			dish.rotate_y(delta * 0.9)
	_scan -= delta
	if _scan <= 0.0:
		_scan = 0.25
		_look()
	_fly(delta)
	_fly_flares(delta)
	_evade(delta)

func _look() -> void:
	var tg := _targets()
	for s in sites:
		if float(s["cool"]) > 0.0:
			continue
		var sp: Vector3 = s["pos"]
		for t in tg:
			var n: Node3D = t[0]
			var team := int(t[1])
			var st := int(s["team"])
			if st >= 0 and (team == st or team == -1):
				continue
			if st == -1 and team != -2:
				continue                       # the airports and the port only answer the raiders
			var p := n.global_position
			if Vector2(p.x - sp.x, p.z - sp.z).length() > RANGE or p.y - sp.y > CEIL:
				continue
			var chasing := 0
			for m in missiles:
				if m["target"] == n:
					chasing += 1
			if chasing >= 2:
				continue
			_launch(s, n, bool(t[2]))
			s["cool"] = COOLDOWN
			break

func _launch(s: Dictionary, target: Node3D, at_player: bool) -> void:
	var p: Vector3 = s["launch"]
	var node := Node3D.new()
	add_child(node)
	if _model:
		var m := _model.instantiate() as Node3D
		node.add_child(m)
		m.rotation.y = PI                 # the model's nose to -Z, the way the holder looks
		m.scale = Vector3.ONE * 1.6
	node.global_position = p
	var smoke := world.projectiles._trail() if world.projectiles else null
	if smoke:
		add_child(smoke)
		smoke.global_position = p
		smoke.emitting = true
	missiles.append({"node": node, "smoke": smoke, "target": target, "p": p, "v": Vector3(0, 70, 0), "t": 0.0, "decoy": Vector3.INF})
	Sfx.play_at("rocket_launch", p, 14.0, 120.0, 0.0, 0.0, 0.05)
	if at_player:
		warn_player = 3.0
		Sfx.play("missile_incoming", -2.0)

func _fly(delta: float) -> void:
	var i := 0
	while i < missiles.size():
		var m: Dictionary = missiles[i]
		m["t"] = float(m["t"]) + delta
		var p: Vector3 = m["p"]
		var v: Vector3 = m["v"]
		var tgt: Node3D = m["target"]
		var alive := tgt != null and is_instance_valid(tgt)
		var aim := Vector3.INF
		if m["decoy"] != Vector3.INF:
			aim = m["decoy"]
		elif alive:
			# lead the target a little (where it will be when the missile gets there)
			var tv: Vector3 = tgt.get_meta("v") if tgt.has_meta("v") else (tgt.linear_velocity if tgt is RigidBody3D else Vector3.ZERO)
			var tt := p.distance_to(tgt.global_position) / maxf(v.length(), 100.0)
			aim = tgt.global_position + tv * minf(tt, 2.5)
			if alive and tgt is Aircraft and (tgt as Aircraft).driver() is Player:
				warn_player = maxf(warn_player, 0.6)
		var sp := v.length()
		if float(m["t"]) < BOOST:
			v += Vector3(0, 1, 0) * 140.0 * delta
		else:
			sp = minf(sp + 320.0 * delta, VMAX)
			if aim != Vector3.INF:
				var want := (aim - p).normalized()
				var cur := v.normalized()
				var ang := cur.angle_to(want)
				var step := TURN * (VMAX / maxf(sp, 120.0)) * delta     # slower: tighter
				var nd := cur.slerp(want, clampf(step / maxf(ang, 0.0001), 0.0, 1.0)) if ang > 0.0001 else cur
				v = nd * sp
			else:
				v = v.normalized() * sp
		var np := p + v * delta
		m["p"] = np
		m["v"] = v
		var node: Node3D = m["node"]
		node.global_position = np
		if v.length() > 1.0:
			node.look_at(np + v, Vector3.UP if absf(v.normalized().y) < 0.98 else Vector3.RIGHT)
		var sm: CPUParticles3D = m["smoke"]
		if sm:
			sm.global_position = np
		# the fuse: close to the aircraft, or the decoy, or the ground, or out of fuel
		var done := false
		if alive and m["decoy"] == Vector3.INF and np.distance_to(tgt.global_position) < FUSE:
			_hit(tgt, np)
			done = true
		elif m["decoy"] != Vector3.INF and np.distance_to(m["decoy"]) < FUSE:
			world.explode(np, 0.8, self)
			done = true
		elif np.y < world.height(np.x, np.z) + 1.0:
			world.explode(np, 0.8, self)
			done = true
		elif float(m["t"]) > LIFE:
			world.explode(np, 0.6, self)
			done = true
		if done:
			node.queue_free()
			if sm:
				sm.emitting = false
				get_tree().create_timer(3.5).timeout.connect(sm.queue_free)
			missiles.remove_at(i)
			continue
		i += 1

## the warhead goes off by the aircraft
func _hit(tgt: Node3D, at: Vector3) -> void:
	world.explode(at, 1.2, self)
	if tgt is Vehicle:
		(tgt as Vehicle).damage(720.0, at)
	elif world.raid and world.raid.jets.has(tgt):
		world.raid.shot_down(tgt)
	elif world.war:
		world.war.shot_down(tgt)

# ------------------------------------------------------------------ flares and getting away
## a fan of burning flares behind and under an aircraft; each missile chasing it may take one instead
func drop_flares(by: Node3D) -> void:
	if by == null or not is_instance_valid(by):
		return
	var now := Time.get_ticks_msec()
	if by.has_meta("flare_at") and now - int(by.get_meta("flare_at")) < 2200:
		return                             # the dispenser needs a moment between salvoes
	by.set_meta("flare_at", now)
	var bv: Vector3 = by.get_meta("v") if by.has_meta("v") else (by.linear_velocity if by is RigidBody3D else Vector3.ZERO)
	var base := by.global_position
	for k in 6:
		var dir := Vector3(randf_range(-1, 1), randf_range(-1.0, -0.3), randf_range(-1, 1)).normalized()
		var f := _flare_node()
		add_child(f)
		f.global_position = base
		flares.append({"node": f, "p": base, "v": bv * 0.45 + dir * 35.0, "t": 0.0})
	Sfx.play_at("lamp_click", base, 6.0, 40.0, 0.0, 0.0, 0.1)
	for m in missiles:
		if m["target"] == by and m["decoy"] == Vector3.INF:
			var d := (m["p"] as Vector3).distance_to(base)
			# the closer it already is, the less likely it lets go; too far it has not seen them yet
			var chance := 0.75 if d > 250.0 else 0.35
			if d < 2200.0 and randf() < chance:
				m["decoy"] = base + bv * 0.4 + Vector3(0, -25, 0)

func _flare_node() -> Node3D:
	var mi := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 0.9
	sm.height = 1.8
	mi.mesh = sm
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_color = Color(1.0, 0.85, 0.5)
	m.emission_enabled = true
	m.emission = Color(1.0, 0.7, 0.3)
	m.emission_energy_multiplier = 6.0
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return mi

func _fly_flares(delta: float) -> void:
	var i := 0
	while i < flares.size():
		var f: Dictionary = flares[i]
		f["t"] = float(f["t"]) + delta
		var v: Vector3 = f["v"]
		v.y -= 6.0 * delta
		v *= 1.0 - 0.6 * delta
		f["v"] = v
		f["p"] = (f["p"] as Vector3) + v * delta
		var n: Node3D = f["node"]
		n.global_position = f["p"]
		n.scale = Vector3.ONE * clampf(1.6 - float(f["t"]) * 0.35, 0.1, 1.6)
		if float(f["t"]) > 4.0:
			n.queue_free()
			flares.remove_at(i)
			continue
		i += 1

## the raiders and the AI pilots: flares and a hard turn when a missile is close behind
func _evade(delta: float) -> void:
	for m in missiles:
		var tgt: Node3D = m["target"]
		if tgt == null or not is_instance_valid(tgt) or m["decoy"] != Vector3.INF:
			continue
		var player_flies := tgt is Aircraft and (tgt as Aircraft).driver() is Player
		if player_flies:
			continue
		var d := (m["p"] as Vector3).distance_to(tgt.global_position)
		if d < 900.0 and float(m["t"]) > BOOST:
			drop_flares(tgt)
			if float(tgt.get_meta("turn", 0.0)) <= 0.0 and not (tgt is Vehicle):
				tgt.set_meta("turn", PI * 0.5)            # a break turn
