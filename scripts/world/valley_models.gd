class_name ValleyModels
extends Node3D
## The owner's models in the valley: an aircraft carrier on every lake and one in the bay (their decks are solid: you can
## walk on them and land on them), aircraft at the airfield (in the hangars and on the apron) and at the crash sites,
## military vehicles at the bases and in the towns, air defences, watchtowers, barriers and containers at the bases,
## apartment blocks around the central square, a laptop next to the computer of every capture zone, palms by the sea.
## Every model gets colliders from data/valley/model_cols.json (tools/model_cols.py) and draws only within a distance
## that suits its size.

const KIND_MODEL := {"jet": "j36", "jet2": "b2", "heli": "mi171", "transport": "chinook",
	"jeep": "uaz", "apc": "fennek", "tank": "tank", "truck": "tam150", "car": "ar55", "car2": "uaz"}
const CARRIERS := ["cvn80", "cdg", "cvn65", "cvn80", "cdg", "cvn65"]
const DRAFT := 0.38                 # waterline as a share of the keel-to-deck height (a Nimitz: 11 m of 30 m)
# colliders of the game's own props that tools/model_cols.py does not measure
const EXTRA_COLS := {"car_wreck": {"boxes": [[0.0, 0.85, -0.16, 1.9, 1.6, 4.1]]}}
# how far each street prop draws
const PROP_VIS := {"car_wreck": 200.0, "jersey": 200.0, "container": 320.0}
# palms along the bay and around the coast village
const PALMS := [[-2980.0, -760.0], [-3040.0, -520.0], [-3010.0, -300.0], [-2930.0, -140.0], [-3060.0, 60.0],
	[-3120.0, 380.0], [-3090.0, 640.0], [-2640.0, -560.0], [-2580.0, -420.0], [-2420.0, -610.0], [-2380.0, -380.0], [-2700.0, -300.0]]

var world: World
var cols: Dictionary
var info: Dictionary
var scenes := {}
var bodies: Array[RID] = []
var shapes: Array[RID] = []
var carriers: Array[Dictionary] = []     # {"name", "xf": Transform3D, "deck": world height of the flight deck}
var computers: Array[Dictionary] = []    # {"pos": Vector3, "zone": int}
var placed: Array[Dictionary] = []       # {"name", "xf", "node"}
var vehicles: Array[Vehicle] = []        # everything you can drive or fly

func setup(w: World) -> void:
	world = w
	cols = JSON.parse_string(FileAccess.get_file_as_string("res://data/valley/model_cols.json"))
	for k in EXTRA_COLS:
		if not cols.has(k):
			cols[k] = EXTRA_COLS[k]
	info = JSON.parse_string(FileAccess.get_file_as_string("res://data/valley/user_models.json"))
	var lay := w.lay
	var lakes: Array = lay["lakes"]
	for i in lakes.size():
		var lk: Dictionary = lakes[i]
		var cm := String(lk.get("carrier", CARRIERS[i % CARRIERS.size()]))
		if cm == "" or float(lk["r"]) < 450.0:
			continue          # a pond: no room for a carrier
		_carrier(cm, Vector3(float(lk["x"]), float(lk["level"]), float(lk["z"])), float(lk.get("yaw", 0.7 + i * 1.3)))
	var sea := float(lay.get("sea_level", 0.0))
	if lay.get("island", false):
		# at sea: off the port in the west, and off the south-east coast
		_carrier("cvn65", Vector3(-3850.0, sea, -700.0), 0.0)
		_carrier("cdg", Vector3(3850.0, sea, 2500.0), 0.3)
	else:
		_carrier("cvn65", Vector3(-3780.0, sea, 300.0), PI * 0.5)
	await get_tree().process_frame
	_aircraft(lay)
	_wrecks(lay)
	await get_tree().process_frame
	_vehicles(lay)
	_landmarks(lay)
	_bases(lay)
	_computers(lay)
	_palms()
	_street_props(lay)

func _exit_tree() -> void:
	for b in bodies:
		PhysicsServer3D.free_rid(b)
	for s in shapes:
		PhysicsServer3D.free_rid(s)
	bodies.clear()
	shapes.clear()

# ------------------------------------------------------------------ placing
func _scene(nm: String) -> PackedScene:
	if not scenes.has(nm):
		# the owner's models in models/u (a lighter copy, nm_lo, where tools/decimate.gd made one: the palms, the
		# laptops, a carrier, the Pantsir), the game's own small props in models/
		var p := "res://models/u/%s_lo.glb" % nm
		if not ResourceLoader.exists(p):
			p = "res://models/u/%s.glb" % nm
		if not ResourceLoader.exists(p):
			p = "res://models/%s.glb" % nm
		scenes[nm] = load(p) if ResourceLoader.exists(p) else null
	return scenes[nm]

func _size(nm: String) -> float:
	var s: Array = (info.get(nm, {}) as Dictionary).get("size", [10, 10, 10])
	return maxf(float(s[0]), maxf(float(s[1]), float(s[2])))

## one model at a transform: drawn within a distance that suits its size, with its colliders
func place(nm: String, xf: Transform3D, collide := true, vis_end := -1.0) -> Node3D:
	var ps := _scene(nm)
	if ps == null:
		return null
	var n: Node3D = ps.instantiate()
	n.transform = xf
	add_child(n)
	var ve := vis_end if vis_end > 0.0 else clampf(_size(nm) * 45.0, 160.0, 3500.0)
	_vis(n, ve)
	if collide:
		_boxes(nm, xf)
	placed.append({"name": nm, "xf": xf, "node": n})
	return n

func _vis(n: Node, end: float) -> void:
	if n is GeometryInstance3D:
		var g := n as GeometryInstance3D
		g.visibility_range_end = end
		g.visibility_range_end_margin = end * 0.05
		g.visibility_range_fade_mode = GeometryInstance3D.VISIBILITY_RANGE_FADE_DISABLED
		g.gi_mode = GeometryInstance3D.GI_MODE_DISABLED
	for c in n.get_children():
		_vis(c, end)

func _boxes(nm: String, xf: Transform3D) -> void:
	var c: Dictionary = cols.get(nm, {})
	if not c.has("boxes"):
		return
	var body := PhysicsServer3D.body_create()
	PhysicsServer3D.body_set_mode(body, PhysicsServer3D.BODY_MODE_STATIC)
	for b in c["boxes"]:
		var bx: Array = b
		var sh := PhysicsServer3D.box_shape_create()
		PhysicsServer3D.shape_set_data(sh, Vector3(maxf(float(bx[3]), 0.05), maxf(float(bx[4]), 0.05), maxf(float(bx[5]), 0.05)) * 0.5)
		PhysicsServer3D.body_add_shape(body, sh, xf * Transform3D(Basis(), Vector3(bx[0], bx[1], bx[2])))
		shapes.append(sh)
	_finish_body(body)

func _finish_body(body: RID) -> void:
	PhysicsServer3D.body_set_collision_layer(body, 2)
	PhysicsServer3D.body_set_collision_mask(body, 0)
	PhysicsServer3D.body_attach_object_instance_id(body, get_instance_id())
	PhysicsServer3D.body_set_space(body, get_world_3d().space)
	bodies.append(body)

## yaw that turns a model's nose (+Z, as glTF models come) towards a direction on the ground
static func yaw_to(dx: float, dz: float) -> float:
	return atan2(dx, dz)

func _ground_xf(nm: String, x: float, z: float, yaw: float, lift := 0.0) -> Transform3D:
	return Transform3D(Basis(Vector3.UP, yaw), Vector3(x, world.height(x, z) + lift, z))

# ------------------------------------------------------------------ carriers
func _carrier(nm: String, water: Vector3, yaw: float) -> void:
	var c: Dictionary = cols.get(nm, {})
	var deck := float(c.get("deck", 30.0))
	var xf := Transform3D(Basis(Vector3.UP, yaw), water - Vector3(0, deck * DRAFT, 0))
	place(nm, xf, false, 6500.0)
	if c.has("grid"):
		var g: Array = c["grid"]
		var gw := int(g[0])
		var gd := int(g[1])
		var heights := Marshalls.base64_to_raw(String(g[4])).to_float32_array()
		var hmin := 1e9
		var hmax := -1e9
		for h in heights:
			hmin = minf(hmin, h)
			hmax = maxf(hmax, h)
		var sh := PhysicsServer3D.heightmap_shape_create()
		PhysicsServer3D.shape_set_data(sh, {"width": gw, "depth": gd, "heights": heights, "min_height": hmin, "max_height": hmax})
		shapes.append(sh)
		var body := PhysicsServer3D.body_create()
		PhysicsServer3D.body_set_mode(body, PhysicsServer3D.BODY_MODE_STATIC)
		var centre := Vector3(float(g[2]) + (gw - 1) * 0.5, 0.0, float(g[3]) + (gd - 1) * 0.5)
		PhysicsServer3D.body_add_shape(body, sh, xf * Transform3D(Basis(), centre))
		_finish_body(body)
	carriers.append({"name": nm, "xf": xf, "deck": xf.origin.y + deck})

## the flight deck under a point, if there is one (for spawning on it and for aircraft)
func carrier_at(p: Vector3) -> Dictionary:
	for c in carriers:
		var lp := (c["xf"] as Transform3D).affine_inverse() * p
		var s: Array = (info.get(c["name"], {}) as Dictionary).get("size", [300, 80, 300])
		if absf(lp.x) < float(s[0]) * 0.5 and absf(lp.z) < float(s[2]) * 0.5:
			return c
	return {}

# ------------------------------------------------------------------ the airfield and the crash sites
## a vehicle or an aircraft you can take (Vehicle / Aircraft), drawn within a distance that suits it
func spawn_vehicle(k: String, xf: Transform3D) -> Vehicle:
	var v: Vehicle
	if Aircraft.AIR.has(k):
		v = Aircraft.new()
	elif k == "tank":
		v = Tank.new()
	else:
		v = Vehicle.new()
	v.kind = k
	v.world = world
	v.transform = xf
	add_child(v)
	_vis(v, 3500.0 if v is Aircraft else 900.0)
	vehicles.append(v)
	return v

func _aircraft(lay: Dictionary) -> void:
	var air: Array = lay["aircraft"]
	for i in air.size():
		var a: Array = air[i]
		var nm: String = KIND_MODEL.get(String(a[0]), "j36")
		var x := float(a[1])
		var z := float(a[3])
		# helicopters and the fighter stand in the hangars (nose to the door), the big ones on the apron
		if nm == "b2" or nm == "chinook":
			z += 64.0
		spawn_vehicle(nm, _ground_xf(nm, x, z, float(a[4]), 0.3))
	# every carrier keeps an aircraft on its deck, near the stern, pointing along the deck
	for i in carriers.size():
		var c: Dictionary = carriers[i]
		var cxf: Transform3D = c["xf"]
		var along := Vector3(0, 0, 1) if String(c["name"]) != "cvn65" else Vector3(1, 0, 0)
		var local := -along * 95.0
		var p := cxf * local
		p.y = float(c["deck"]) + 0.4
		var dir := cxf.basis * along
		spawn_vehicle("j36" if i % 2 == 0 else "mi171", Transform3D(Basis(Vector3.UP, atan2(dir.x, dir.z)), p))

func _wrecks(lay: Dictionary) -> void:
	var burnt := StandardMaterial3D.new()
	burnt.albedo_color = Color(0.05, 0.045, 0.04, 0.72)
	burnt.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	burnt.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	for i in (lay["wrecks"] as Array).size():
		var a: Array = lay["wrecks"][i]
		var nm: String = KIND_MODEL.get(String(a[0]), "j36")
		var x := float(a[1])
		var z := float(a[3])
		var b := Basis(Vector3.UP, float(a[4])) * Basis(Vector3(0, 0, 1), 0.18 * (1 if i % 2 == 0 else -1)) * Basis(Vector3(1, 0, 0), 0.07)
		var xf := Transform3D(b, Vector3(x, world.height(x, z) - 0.6, z))
		var n := place(nm, xf)
		if n:
			_overlay(n, burnt)

func _overlay(n: Node, m: Material) -> void:
	if n is GeometryInstance3D:
		(n as GeometryInstance3D).material_overlay = m
	for c in n.get_children():
		_overlay(c, m)

# ------------------------------------------------------------------ vehicles
func _vehicles(lay: Dictionary) -> void:
	for v in lay["vehicles"]:
		var a: Array = v
		var nm: String = KIND_MODEL.get(String(a[0]), "uaz")
		if Vehicle.GROUND.has(nm) or nm == "tank":
			spawn_vehicle(nm, _ground_xf(nm, float(a[1]), float(a[3]), float(a[4]), 0.5))
		else:
			place(nm, _ground_xf(nm, float(a[1]), float(a[3]), float(a[4]), 0.0))

# ------------------------------------------------------------------ landmarks, bases, capture zones, palms
## the streets of the city and the towns: burnt-out cars by the kerb, concrete chicanes on the way into the squares,
## containers on empty lots
func _street_props(lay: Dictionary) -> void:
	for a in lay.get("street_props", []):
		var nm := String(a[0])
		var x := float(a[1])
		var z := float(a[3])
		var n := place(nm, Transform3D(Basis(Vector3.UP, float(a[4])), Vector3(x, world.height(x, z) - 0.02, z)), true, PROP_VIS.get(nm, 300.0))
		if n:
			_lod(n, 0.6)

func _lod(n: Node, bias: float) -> void:
	if n is GeometryInstance3D:
		(n as GeometryInstance3D).lod_bias = bias
	for c in n.get_children():
		_lod(c, bias)

func _landmarks(lay: Dictionary) -> void:
	for l in lay["landmarks"]:
		var a: Array = l
		var nm := String(a[0])
		if not ResourceLoader.exists("res://models/u/%s.glb" % nm):
			continue
		var n := place(nm, _ground_xf(nm, float(a[1]), float(a[3]), float(a[4]), -0.05))
		if n and nm.begins_with("res_"):
			_lod(n, 0.4)       # 120k-triangle apartment blocks: their coarser levels sooner

func _bases(lay: Dictionary) -> void:
	for b in lay["bases"]:
		var bd: Dictionary = b
		var bx := float(bd["x"])
		var bz := float(bd["z"])
		var yaw := float(bd["yaw"])
		var bs := Basis(Vector3.UP, yaw)
		# more air defence beside the Patriot and the C-RAM
		for e in [[-150.0, -70.0, "cactus_sam"], [150.0, -70.0, "cactus_sahv"], [0.0, -150.0, "pantsir"]]:
			var p := Vector3(bx, 0, bz) + bs * Vector3(e[0], 0, e[1])
			place(String(e[2]), _ground_xf(String(e[2]), p.x, p.z, yaw))
		# the gate: jersey barriers in a chicane, fences either side, a few containers
		for k in 6:
			var p := Vector3(bx, 0, bz) + bs * Vector3(-12.0 + (k % 2) * 6.0, 0, 100.0 + k * 4.0)
			place("jersey", _ground_xf("jersey", p.x, p.z, yaw + PI * 0.5 * (k % 2)))
		for k in 8:
			for side in [-1.0, 1.0]:
				var p := Vector3(bx, 0, bz) + bs * Vector3(side * (22.0 + k * 3.5), 0, 118.0)
				place("fence", _ground_xf("fence", p.x, p.z, yaw))
		for k in 5:
			var p := Vector3(bx, 0, bz) + bs * Vector3(60.0 + (k % 3) * 2.2, 0, -20.0 + (k / 3) * 8.0)
			place("container", _ground_xf("container", p.x, p.z, yaw))

func _computers(lay: Dictionary) -> void:
	var b: Array = lay["buildings"]
	var zone := 0
	for i in b.size():
		var row: Array = b[i]
		if String(row[0]) != "command_post":
			continue
		var xf := Transform3D(Basis(Vector3.UP, float(row[4])), Vector3(row[1], row[2], row[3]))
		# on the desk, beside the screen, its screen towards the room (+Z of the bunker)
		var lxf := xf * Transform3D(Basis(), Vector3(0.55, 0.97, -1.65))
		place("laptop", lxf, false, 60.0)
		computers.append({"pos": xf * Vector3(0.0, 1.0, -1.8), "zone": zone})
		zone += 1

func _palms() -> void:
	for p in PALMS:
		var x := float(p[0])
		var z := float(p[1])
		var h := world.height(x, z)
		if h < float(world.lay.get("sea_level", 0.0)) + 0.3:
			continue
		var s := 1.0 + fposmod(x * 0.37 + z * 0.11, 0.5)
		var xf := Transform3D(Basis(Vector3.UP, fposmod(x * 0.7, TAU)).scaled(Vector3(s, s, s)), Vector3(x, h - 0.1, z))
		place("palm", xf, false, 450.0)
		# only the trunk stops you (the crown is far overhead)
		var body := PhysicsServer3D.body_create()
		PhysicsServer3D.body_set_mode(body, PhysicsServer3D.BODY_MODE_STATIC)
		var cap := PhysicsServer3D.capsule_shape_create()
		PhysicsServer3D.shape_set_data(cap, {"radius": 0.3 * s, "height": 4.0 * s})
		PhysicsServer3D.body_add_shape(body, cap, Transform3D(Basis(), Vector3(x, h + 2.0 * s, z)))
		shapes.append(cap)
		_finish_body(body)
