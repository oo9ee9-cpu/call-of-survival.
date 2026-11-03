class_name Loot
extends Node3D
## Things to pick up in the valley: guns, ammunition, sights, medicine, helmets and vests lie on the floors of the
## houses (the prefabs mark the spots), more of them in the town centres. They are drawn only around the player
## (streamed like the doors); ammunition and medicine are picked up by walking over them (setting), the rest with the
## interact button. A soldier who dies leaves a crate with his kit.

const TABLE := [
	[10, "ammo", "762", 60], [9, "ammo", "556", 60], [7, "ammo", "9mm", 45], [3, "ammo", "338", 10], [4, "ammo", "12g", 16],
	[4, "gun", "ak", 30], [5, "gun", "carbine", 30], [5, "gun", "smg", 32], [2, "gun", "sniper", 5], [3, "gun", "shotgun", 6], [3, "gun", "pistol", 15],
	[4, "sight", "reddot", 1], [3, "sight", "holo", 1], [3, "sight", "x2", 1], [2, "sight", "x3", 1], [2, "sight", "x4", 1], [1, "sight", "x6", 1], [1, "sight", "x8", 1],
	[8, "med", "bandage", 3], [4, "med", "kit", 1], [1, "med", "medkit", 1],
	[3, "helmet", "helmet", 1], [2, "helmet", "helmet", 2], [1, "helmet", "helmet", 3],
	[3, "vest", "vest", 1], [2, "vest", "vest", 2], [1, "vest", "vest2", 3],
]
const CH := 64.0
const NEAR := 45.0

var world: World
var items := {}          # key -> {"type", "id", "n", "pos", "yaw", "taken"}
var by_chunk := {}       # Vector2i -> Array[String]
var nodes := {}          # key -> Node3D
var _t := 0.0
var _mats := {}
var _total_w := 0

func setup(w: World, bxf: Array[Transform3D], btype: PackedStringArray, pref: Dictionary) -> void:
	world = w
	for row in TABLE:
		_total_w += int(row[0])
	for i in bxf.size():
		var pts: Array = (pref[btype[i]] as Dictionary).get("loot", [])
		var rng := RandomNumberGenerator.new()
		rng.seed = 7700 + i * 131
		for j in pts.size():
			if rng.randf() > 0.6:
				continue
			var lp: Array = pts[j]
			var p: Vector3 = bxf[i] * Vector3(float(lp[0]), float(lp[1]) + 0.02, float(lp[2]))
			var row: Array = _pick(rng)
			_add("%d:%d" % [i, j], {"type": row[1], "id": row[2], "n": row[3], "pos": p, "yaw": rng.randf() * TAU, "taken": false})

func _pick(rng: RandomNumberGenerator) -> Array:
	var r := rng.randi() % _total_w
	for row in TABLE:
		r -= int(row[0])
		if r < 0:
			return row
	return TABLE[0]

func _add(key: String, it: Dictionary) -> void:
	items[key] = it
	var p: Vector3 = it["pos"]
	var k := Vector2i(floori(p.x / CH), floori(p.z / CH))
	if not by_chunk.has(k):
		by_chunk[k] = []
	(by_chunk[k] as Array).append(key)

## what the item is called on the screen
static func title(it: Dictionary) -> String:
	match String(it["type"]):
		"gun":
			return String(Guns.DATA[it["id"]]["title"])
		"ammo":
			return "ذخيرة " + String(Guns.CALIBERS.get(it["id"], it["id"]))
		"sight":
			return String(Guns.SIGHTS[it["id"]]["title"])
		"med":
			return {"bandage": "ضمادات", "kit": "إسعافات أولية", "medkit": "حقيبة طبية"}.get(it["id"], "علاج")
		"helmet":
			return "خوذة مستوى %d" % int(it["n"])
		"vest":
			return "درع مستوى %d" % int(it["n"])
		"crate":
			return "صندوق جندي"
	return ""

# ------------------------------------------------------------------ streaming and picking up
func update(focus: Vector3, delta: float, player: Player) -> void:
	_t -= delta
	if _t > 0.0:
		return
	_t = 0.3
	var want := {}
	var r := ceili(NEAR / CH)
	var c := Vector2i(floori(focus.x / CH), floori(focus.z / CH))
	for dj in range(-r, r + 1):
		for di in range(-r, r + 1):
			for key in by_chunk.get(c + Vector2i(di, dj), []):
				var it: Dictionary = items[key]
				if not bool(it["taken"]) and (it["pos"] as Vector3).distance_to(focus) < NEAR:
					want[key] = true
	for key in nodes.keys():
		if not want.has(key):
			(nodes[key] as Node).queue_free()
			nodes.erase(key)
	for key in want:
		if not nodes.has(key):
			nodes[key] = _make(items[key])
	# walking over ammunition and medicine picks them up
	if player and not player.dead and player.vehicle == null and bool(Settings.get_v("auto_pickup")):
		for key in want:
			var it: Dictionary = items[key]
			var t := String(it["type"])
			if (t == "ammo" or t == "med") and (it["pos"] as Vector3).distance_to(player.global_position) < 1.3:
				if player.give(it):
					take(key)

func take(key: String) -> void:
	if not items.has(key):
		return
	items[key]["taken"] = true
	if nodes.has(key):
		(nodes[key] as Node).queue_free()
		nodes.erase(key)

## the item in front of the soldier within reach: {"key", "item"} or {}
func nearest(from: Vector3, fwd: Vector3) -> Dictionary:
	var best := {}
	var bd := 2.3
	for key in nodes:
		var it: Dictionary = items[key]
		var to: Vector3 = (it["pos"] as Vector3) + Vector3(0, 0.1, 0) - from
		var d := to.length()
		if d < bd and (d < 1.0 or to.normalized().dot(fwd) > 0.55):
			bd = d
			best = {"key": key, "item": it}
	return best

## one item put down on the ground (a gun swapped for another)
func drop_item(it: Dictionary, p: Vector3) -> void:
	var key := "d%d" % Time.get_ticks_usec()
	var item := it.duplicate()
	item["pos"] = p + Vector3(0, 0.02, 0)
	item["yaw"] = randf() * TAU
	item["taken"] = false
	_add(key, item)
	_t = 0.0

## a fallen soldier's kit in a crate where he fell
func drop_crate(p: Vector3, kit: Array) -> void:
	if kit.is_empty():
		return
	var key := "c%d" % Time.get_ticks_usec()
	_add(key, {"type": "crate", "id": "crate", "n": 1, "pos": p, "yaw": randf() * TAU, "taken": false, "kit": kit})
	_t = 0.0

# ------------------------------------------------------------------ what it looks like
func _mat(name: String, col: Color, metal := 0.0, rough := 0.7) -> StandardMaterial3D:
	if _mats.has(name):
		return _mats[name]
	var m := StandardMaterial3D.new()
	m.albedo_color = col
	m.metallic = metal
	m.roughness = rough
	_mats[name] = m
	return m

func _box(parent: Node3D, size: Vector3, pos: Vector3, m: Material) -> void:
	var mi := MeshInstance3D.new()
	var b := BoxMesh.new()
	b.size = size
	b.material = m
	mi.mesh = b
	mi.position = pos
	parent.add_child(mi)

func _make(it: Dictionary) -> Node3D:
	var root := Node3D.new()
	add_child(root)
	root.global_position = it["pos"]
	root.rotation.y = float(it["yaw"])
	var id := String(it["id"])
	match String(it["type"]):
		"gun":
			var g := Guns.model(id)
			g.rotation = Vector3(0.0, PI, PI * 0.5)
			g.position.y = 0.035
			root.add_child(g)
		"sight":
			var s := Guns.sight_model(id)
			root.add_child(s)
		"ammo":
			var col: Color = {"762": Color(0.3, 0.33, 0.2), "556": Color(0.22, 0.27, 0.2), "9mm": Color(0.32, 0.26, 0.18),
				"338": Color(0.2, 0.2, 0.22), "12g": Color(0.45, 0.12, 0.1)}.get(id, Color(0.3, 0.3, 0.3))
			_box(root, Vector3(0.28, 0.15, 0.14), Vector3(0, 0.075, 0), _mat("ammo_" + id, col, 0.2, 0.6))
			_box(root, Vector3(0.05, 0.02, 0.02), Vector3(0, 0.16, 0), _mat("handle", Color(0.1, 0.1, 0.1)))
		"med":
			var w := _mat("white", Color(0.85, 0.85, 0.82))
			var red := _mat("red", Color(0.7, 0.08, 0.06))
			var s := {"bandage": 0.6, "kit": 1.0, "medkit": 1.5}.get(id, 1.0) as float
			_box(root, Vector3(0.22, 0.09, 0.15) * s, Vector3(0, 0.045 * s, 0), w)
			_box(root, Vector3(0.12, 0.092, 0.03) * s, Vector3(0, 0.046 * s, 0), red)
			_box(root, Vector3(0.03, 0.092, 0.1) * s, Vector3(0, 0.046 * s, 0), red)
		"helmet", "vest":
			var nm := id if ResourceLoader.exists("res://models/u/%s.glb" % id) else "helmet"
			var m: Node3D = (load("res://models/u/%s.glb" % nm) as PackedScene).instantiate()
			if String(it["type"]) == "vest":
				m.rotation.x = -PI * 0.5
				m.position.y = 0.1
			root.add_child(m)
		"crate":
			var wood := _mat("crate", Color(0.36, 0.28, 0.17), 0.0, 0.85)
			_box(root, Vector3(0.9, 0.5, 0.6), Vector3(0, 0.25, 0), wood)
			_box(root, Vector3(0.92, 0.06, 0.62), Vector3(0, 0.5, 0), _mat("crate_lid", Color(0.26, 0.2, 0.12)))
	return root
