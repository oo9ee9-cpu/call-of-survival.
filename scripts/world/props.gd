class_name Props
extends Node3D
## Everything built by hand in the war zone: trench furniture, colliders, the three dugouts, power line,
## water, the burnt jeeps, the firing range, smoke from smouldering stumps.

const RANGES := {"sandbag": 170.0, "duckboard": 110.0, "revet_planks": 140.0, "revet_wattle": 120.0, "revet_iron": 140.0,
	"post": 120.0, "ladder": 90.0, "picket": 160.0, "wire": 75.0, "concertina": 110.0, "crate_ammo": 60.0, "crate_long": 70.0,
	"bucket": 45.0, "jerrycan": 55.0, "bridge": 120.0}
const SURF := ["dirt", "wood", "metal", "bag"]

var world: World
var prop_nodes: Array[MultiMeshInstance3D] = []
var body_mats := {}               # body RID -> PackedByteArray (surface per shape)
var bodies: Array[RID] = []
var dugouts: Array = []           # {xf, lamp, stove, ...}
var interactables: Array = []     # {pos, kind, dug}
var water_items := {}             # 64 m chunk -> [[kind, x, y, z, a, b, yaw]]
var range_scale := 1.0
var smokes: Array[Node3D] = []
var plates: Array = []
var _shapes := {}
var _flick := 0.0
var _shadow_t := 0.0

func setup(w: World) -> void:
	world = w
	_war_props()
	await get_tree().process_frame
	_colliders()
	_dugouts()
	await get_tree().process_frame
	_pylons()
	_water()
	_wrecks()
	_range()
	_smokes()

func set_quality(q: int, vd: int) -> void:
	range_scale = [0.7, 1.0, 1.25, 1.5][q] * [0.85, 1.0, 1.2][vd]
	for n in prop_nodes:
		var base: float = n.get_meta("range")
		n.visibility_range_end = base * range_scale
	_shadow_t = 0.0
	for s in smokes:
		s.visible = q > 0 or s.get_meta("major", false)
	for d in dugouts:
		(d["lamp"] as OmniLight3D).shadow_enabled = q >= 1
		(d["stove"] as OmniLight3D).shadow_enabled = q >= 2

# ------------------------------------------------------------------ trench furniture (MultiMesh per kind and 64 m chunk)
func _war_props() -> void:
	var P: Dictionary = world.lay["props"]
	for kind in P:
		var mesh := world.load_mesh(kind)
		if mesh == null:
			continue
		var merged := {}
		for key in P[kind]:
			var ij: PackedStringArray = (key as String).split(",")
			var ck := Vector2i(floori(int(ij[0]) / 2.0), floori(int(ij[1]) / 2.0))
			var acc: PackedFloat32Array = merged.get(ck, PackedFloat32Array())
			acc.append_array(P[kind][key])
			merged[ck] = acc
		for ck in merged:
			var arr: PackedFloat32Array = merged[ck]
			var mm := MultiMesh.new()
			mm.transform_format = MultiMesh.TRANSFORM_3D
			mm.mesh = mesh
			mm.instance_count = arr.size() / 12
			mm.buffer = arr
			var mmi := MultiMeshInstance3D.new()
			mmi.multimesh = mm
			mmi.gi_mode = GeometryInstance3D.GI_MODE_DISABLED
			mmi.set_meta("range", RANGES.get(kind, 100.0))
			mmi.set_meta("shadow", kind != "wire" and kind != "concertina")
			mmi.visibility_range_end = RANGES.get(kind, 100.0)
			mmi.set_meta("centre", Vector3((ck.x + 0.5) * 128.0, 0.0, (ck.y + 0.5) * 128.0))
			mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			add_child(mmi)
			prop_nodes.append(mmi)

func _box(he: Vector3) -> BoxShape3D:
	var key := "%.2f_%.2f_%.2f" % [he.x, he.y, he.z]
	if not _shapes.has(key):
		var b := BoxShape3D.new()
		b.size = he * 2.0
		_shapes[key] = b
	return _shapes[key]

func _new_body(layer := 1) -> RID:
	var body := PhysicsServer3D.body_create()
	PhysicsServer3D.body_set_mode(body, PhysicsServer3D.BODY_MODE_STATIC)
	PhysicsServer3D.body_set_collision_layer(body, layer)
	PhysicsServer3D.body_set_collision_mask(body, 0)
	PhysicsServer3D.body_attach_object_instance_id(body, get_instance_id())
	PhysicsServer3D.body_set_space(body, get_world_3d().space)
	bodies.append(body)
	return body

## boxes: 16 floats each = Transform3D rows (12), half extents (3), surface id
func _add_boxes(arr: PackedFloat32Array, xf := Transform3D.IDENTITY) -> RID:
	var body := _new_body()
	var sm := PackedByteArray()
	for n in arr.size() / 16:
		var o := n * 16
		var t := Transform3D(Basis(Vector3(arr[o], arr[o + 4], arr[o + 8]), Vector3(arr[o + 1], arr[o + 5], arr[o + 9]), Vector3(arr[o + 2], arr[o + 6], arr[o + 10])),
			Vector3(arr[o + 3], arr[o + 7], arr[o + 11]))
		var he := Vector3(arr[o + 12], arr[o + 13], arr[o + 14])
		PhysicsServer3D.body_add_shape(body, _box(he).get_rid(), xf * t)
		sm.append(int(arr[o + 15]))
	body_mats[body] = sm
	return body

func _colliders() -> void:
	var C: Dictionary = world.lay["colliders"]
	for key in C:
		_add_boxes(C[key])

func surface_of(rid: RID, shape: int) -> String:
	if body_mats.has(rid):
		var sm: PackedByteArray = body_mats[rid]
		if shape >= 0 and shape < sm.size():
			return SURF[sm[shape]]
	return ""

# ------------------------------------------------------------------ dugouts
func _dugouts() -> void:
	var meta: Dictionary = world.lay["dugout_meta"]
	var mound_mat := ShaderMaterial.new()
	mound_mat.shader = load("res://shaders/terrain_mesh.gdshader")
	world.apply_ground_params(mound_mat)
	for d in world.lay["dugouts"]:
		var v := int(d["variant"])
		var p := Vector3(d["p"][0], d["p"][1], d["p"][2])
		var za := Vector3(d["za"][0], 0.0, d["za"][1]).normalized()
		var bz := za
		var bx := Vector3.UP.cross(bz).normalized()
		var xf := Transform3D(Basis(bx, Vector3.UP, bz), p)
		var model := world.instance_model("dugout_%d" % v, true)
		model.transform = xf
		add_child(model)
		var cols: PackedFloat32Array = meta["colliders"][str(v)]
		_add_boxes(cols, xf)
		var pts: Dictionary = meta["points"][str(v)]
		var rec := {"xf": xf, "inv": xf.affine_inverse(), "variant": v, "lamp_on": true}
		# lamp: warm, flickers a little, casts shadows
		var lamp := OmniLight3D.new()
		lamp.light_color = Color(1.0, 0.8, 0.6)
		lamp.light_energy = 1.35
		lamp.omni_range = 7.0
		lamp.omni_attenuation = 1.2
		lamp.shadow_enabled = true
		lamp.shadow_bias = 0.04
		lamp.light_size = 0.05
		lamp.position = xf * Vector3(pts["lamp"][0], pts["lamp"][1] + 0.02, pts["lamp"][2])
		add_child(lamp)
		rec["lamp"] = lamp
		rec["lamp_e"] = 1.35
		interactables.append({"pos": lamp.position, "kind": "lamp", "dug": dugouts.size()})
		# stove glow
		var stove := OmniLight3D.new()
		stove.light_color = Color(1.0, 0.5, 0.22)
		stove.light_energy = 0.9
		stove.omni_range = 4.5
		stove.omni_attenuation = 1.6
		stove.position = xf * Vector3(pts["stove"][0], pts["stove"][1], pts["stove"][2])
		add_child(stove)
		rec["stove"] = stove
		var snd := Node3D.new()
		snd.position = stove.position
		add_child(snd)
		Sfx.loop_at("stove_loop", snd, -6.0, 1.5, 12.0)
		# daylight falling in through the door
		var door := OmniLight3D.new()
		door.light_color = Color(0.75, 0.8, 0.9)
		door.light_energy = 0.35
		door.omni_range = 3.6
		door.position = xf * Vector3(0.0, 1.4, 1.65)
		add_child(door)
		rec["door"] = door
		if pts.get("radio") != null:
			interactables.append({"pos": xf * Vector3(pts["radio"][0], pts["radio"][1], pts["radio"][2]), "kind": "radio", "dug": dugouts.size()})
		if pts.get("ammo") != null:
			interactables.append({"pos": xf * Vector3(pts["ammo"][0], pts["ammo"][1], pts["ammo"][2]), "kind": "ammo", "dug": dugouts.size()})
		# earth over the roof (a mesh shaped like the ground) + its collider
		_mound(d["roof"], mound_mat)
		# smoke from the stove pipe
		var pipe_top := xf * (Vector3(pts["stove"][0], 0.0, pts["stove"][2]) + Vector3(0, 2.9, 0))
		pipe_top.y = float(d["G"]) + 0.6
		var sm := _smoke(pipe_top, 0.5, Color(0.55, 0.55, 0.56, 0.5), 10)
		sm.set_meta("major", true)
		dugouts.append(rec)

func _mound(r: Dictionary, m: Material) -> void:
	var nx := int(r["nx"])
	var nz := int(r["nz"])
	var pts: Array = r["pts"]
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var V := PackedVector3Array()
	for k in nx * nz:
		V.append(Vector3(pts[k * 3], pts[k * 3 + 1], pts[k * 3 + 2]))
	var faces := PackedVector3Array()
	for j in nz - 1:
		for i in nx - 1:
			var a := V[j * nx + i]
			var b := V[j * nx + i + 1]
			var c := V[(j + 1) * nx + i]
			var dd := V[(j + 1) * nx + i + 1]
			# wind both triangles so they face up whatever way the grid runs
			for tri in [[a, b, dd], [a, dd, c]]:
				var n: Vector3 = (tri[1] - tri[0]).cross(tri[2] - tri[0])
				if n.y > 0.0:
					tri = [tri[0], tri[2], tri[1]]
				for q in tri:
					st.set_uv(Vector2(q.x, q.z))
					st.add_vertex(q)
					faces.append(q)
	st.generate_normals()
	var mesh := st.commit()
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = m
	add_child(mi)
	var cs := ConcavePolygonShape3D.new()
	cs.set_faces(faces)
	_shapes["mound%d" % _shapes.size()] = cs
	var body := _new_body()
	PhysicsServer3D.body_add_shape(body, cs.get_rid())
	body_mats[body] = PackedByteArray([0])

## 0..1: how far inside a dugout a point is (the corridor fades out), and which one
func inside_factor(p: Vector3) -> Vector2:
	for i in dugouts.size():
		var l: Vector3 = (dugouts[i]["inv"] as Transform3D) * p
		if absf(l.x) < 1.95 and l.z > -1.7 and l.z < 3.0 and l.y > -0.5 and l.y < 2.4:
			var k := 1.0 - smoothstep(1.3, 2.9, l.z)
			if absf(l.x) > 0.7 and l.z > 1.6:
				k = 0.0
			return Vector2(k, i)
	return Vector2(0.0, -1)

func toggle_lamp(i: int) -> bool:
	var d: Dictionary = dugouts[i]
	d["lamp_on"] = not d["lamp_on"]
	(d["lamp"] as OmniLight3D).visible = d["lamp_on"]
	return d["lamp_on"]

func interactable_near(p: Vector3, fwd: Vector3) -> Dictionary:
	var best := {}
	var bd := 2.2
	for it in interactables:
		var to: Vector3 = (it["pos"] as Vector3) - p
		var d := to.length()
		if d < bd and to.normalized().dot(fwd) > 0.55:
			bd = d
			best = it
	return best

func update(cam: Vector3, delta: float) -> void:
	_flick += delta
	_shadow_t -= delta
	if _shadow_t <= 0.0:
		_shadow_t = 0.5
		var sh := int(Settings.get_v("shadows")) > 0
		for n in prop_nodes:
			var c: Vector3 = n.get_meta("centre")
			var on: bool = sh and n.get_meta("shadow") and Vector2(c.x - cam.x, c.z - cam.z).length() < 100.0
			n.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if on else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	for d in dugouts:
		var l: OmniLight3D = d["lamp"]
		l.light_energy = d["lamp_e"] * (0.94 + 0.06 * sin(_flick * 13.0 + l.position.x) * sin(_flick * 7.3))
		var s: OmniLight3D = d["stove"]
		s.light_energy = 0.85 + 0.22 * sin(_flick * 9.0 + s.position.z) * sin(_flick * 4.1) + 0.08 * sin(_flick * 23.0)
	for pl in plates:
		var node: Node3D = pl["node"]
		pl["v"] = pl["v"] * 0.985 - pl["a"] * 18.0 * delta
		pl["a"] += pl["v"] * delta
		node.rotation.x = pl["a"]

# ------------------------------------------------------------------ power line
func _pylons() -> void:
	var mesh := world.load_mesh("pylon")
	var attach: Array = world.lay["dugout_meta"]["pylon_attach"]
	var pyl: Array = world.lay["pylons"]
	var tops := []
	for p in pyl:
		var pos := Vector3(p["p"][0], p["p"][1] - 0.15, p["p"][2])
		var b := Basis(Vector3.UP, float(p["yaw"]))
		if p["broken"]:
			b = b * Basis(Vector3(0, 0, 1), 0.38) * Basis(Vector3(1, 0, 0), 0.08)
			pos.y -= 0.6
		var mi := MeshInstance3D.new()
		mi.mesh = mesh
		mi.transform = Transform3D(b, pos)
		mi.visibility_range_end = 2400.0
		add_child(mi)
		var pts := []
		for a in attach:
			pts.append(mi.transform * Vector3(a[0], a[1], a[2]))
		tops.append(pts)
		var body := _new_body()
		PhysicsServer3D.body_add_shape(body, _box(Vector3(3.0, 1.2, 3.0)).get_rid(), Transform3D(b, pos + b * Vector3(0, 1.2, 0)))
		body_mats[body] = PackedByteArray([2])
	# cables: sagging catenaries between towers (thin tubes)
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in tops.size() - 1:
		for c in tops[i].size():
			var a: Vector3 = tops[i][c]
			var b2: Vector3 = tops[i + 1][c]
			var L := a.distance_to(b2)
			var sag := L * (0.028 if c < 4 else 0.02)
			var prev := a
			var n := 22
			for k in range(1, n + 1):
				var t := float(k) / n
				var q := a.lerp(b2, t)
				q.y -= sag * 4.0 * t * (1.0 - t)
				q.y = maxf(q.y, world.height(q.x, q.z) + 0.05)
				_tube_seg(st, prev, q, 0.012 if c < 4 else 0.009)
				prev = q
	st.generate_normals()
	var cm := MeshInstance3D.new()
	cm.mesh = st.commit()
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.09, 0.09, 0.1)
	mat.metallic = 0.6
	mat.roughness = 0.45
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	cm.material_override = mat
	cm.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(cm)

func _tube_seg(st: SurfaceTool, a: Vector3, b: Vector3, r: float) -> void:
	var d := (b - a).normalized()
	var s1 := d.cross(Vector3.UP).normalized() * r
	var s2 := d.cross(s1).normalized() * r
	var ring := [s1, s2 * 0.87 - s1 * 0.5, -s2 * 0.87 - s1 * 0.5]
	for k in 3:
		var p0: Vector3 = a + ring[k]
		var p1: Vector3 = a + ring[(k + 1) % 3]
		var q0: Vector3 = b + ring[k]
		var q1: Vector3 = b + ring[(k + 1) % 3]
		for v in [p0, q0, q1, p0, q1, p1]:
			st.add_vertex(v)

# ------------------------------------------------------------------ water
func _water() -> void:
	var wm := ShaderMaterial.new()
	wm.shader = load("res://shaders/water.gdshader")
	wm.set_shader_parameter("nmap", load("res://textures/fx/waternormals.jpg"))
	# unit disc and unit square
	var disc := SurfaceTool.new()
	disc.begin(Mesh.PRIMITIVE_TRIANGLES)
	for k in 28:
		var a0 := TAU * k / 28.0
		var a1 := TAU * (k + 1) / 28.0
		for v in [Vector3.ZERO, Vector3(cos(a0), 0, sin(a0)), Vector3(cos(a1), 0, sin(a1))]:
			disc.set_normal(Vector3.UP)
			disc.add_vertex(v)
	var dmesh := disc.commit()
	var sq := SurfaceTool.new()
	sq.begin(Mesh.PRIMITIVE_TRIANGLES)
	for v in [Vector3(-0.5, 0, -0.5), Vector3(0.5, 0, -0.5), Vector3(0.5, 0, 0.5), Vector3(-0.5, 0, -0.5), Vector3(0.5, 0, 0.5), Vector3(-0.5, 0, 0.5)]:
		sq.set_normal(Vector3.UP)
		sq.add_vertex(v)
	var smesh := sq.commit()
	for spec in [["water_discs", dmesh, 4], ["water_strips", smesh, 6]]:
		var arr: PackedFloat32Array = world.lay[spec[0]]
		var n: int = spec[2]
		var cnt := arr.size() / n
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = spec[1]
		mm.instance_count = cnt
		for i in cnt:
			var o := i * n
			var t: Transform3D
			if n == 4:
				t = Transform3D(Basis.from_scale(Vector3(arr[o + 3], 1.0, arr[o + 3])), Vector3(arr[o], arr[o + 1], arr[o + 2]))
				_water_add(["d", arr[o], arr[o + 1], arr[o + 2], arr[o + 3], 0.0, 0.0])
			else:
				t = Transform3D(Basis(Vector3.UP, arr[o + 5]).scaled_local(Vector3(arr[o + 3], 1.0, arr[o + 4])), Vector3(arr[o], arr[o + 1], arr[o + 2]))
				_water_add(["s", arr[o], arr[o + 1], arr[o + 2], arr[o + 3], arr[o + 4], arr[o + 5]])
			mm.set_instance_transform(i, t)
		var mmi := MultiMeshInstance3D.new()
		mmi.multimesh = mm
		mmi.material_override = wm
		mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(mmi)

func _water_add(item: Array) -> void:
	var key := "%d,%d" % [int(floor(item[1] / 64.0)), int(floor(item[3] / 64.0))]
	if not water_items.has(key):
		water_items[key] = []
	water_items[key].append(item)

func water_at(p: Vector3) -> bool:
	for dz in [-1, 0, 1]:
		for dx in [-1, 0, 1]:
			var key := "%d,%d" % [int(floor(p.x / 64.0)) + dx, int(floor(p.z / 64.0)) + dz]
			for it in water_items.get(key, []):
				if p.y > float(it[2]) + 0.12 or p.y < float(it[2]) - 1.5:
					continue
				var dxp := p.x - float(it[1])
				var dzp := p.z - float(it[3])
				if it[0] == "d":
					if dxp * dxp + dzp * dzp < float(it[4]) * float(it[4]):
						return true
				else:
					var c := cos(float(it[6]))
					var s := sin(float(it[6]))
					var lx := dxp * c - dzp * s
					var lz := dxp * s + dzp * c
					if absf(lx) < float(it[4]) * 0.5 and absf(lz) < float(it[5]) * 0.5:
						return true
	return false

# ------------------------------------------------------------------ wrecks, firing range, smoke
func _wrecks() -> void:
	var b: Dictionary = world.lay["dugout_meta"]["uaz"]
	var lo := Vector3(b["lo"][0], b["lo"][1], b["lo"][2])
	var hi := Vector3(b["hi"][0], b["hi"][1], b["hi"][2])
	for w in world.lay["wrecks"]:
		var m := world.instance_model("uaz_wreck")
		var wb := Basis(Vector3.UP, float(w["yaw"])) * Basis(Vector3(1, 0, 0), float(w["tilt"][0])) * Basis(Vector3(0, 0, 1), float(w["tilt"][1]))
		m.transform = Transform3D(wb, Vector3(w["p"][0], w["p"][1], w["p"][2]))
		add_child(m)
		var body := _new_body()
		var c := (lo + hi) * 0.5
		PhysicsServer3D.body_add_shape(body, _box((hi - lo) * 0.5 * Vector3(0.95, 0.8, 0.97)).get_rid(), m.transform * Transform3D(Basis(), c - Vector3(0, (hi.y - lo.y) * 0.1, 0)))
		body_mats[body] = PackedByteArray([2])
		var sm := _smoke(m.transform * Vector3(0, 1.0, 1.2), 1.0, Color(0.32, 0.31, 0.3, 0.55), 14)
		sm.set_meta("major", true)

func _range() -> void:
	var can_mesh := world.load_mesh("can")
	var bottle_mesh := world.load_mesh("bottle")
	var crate := world.load_mesh("crate_long")
	var frame := world.load_mesh("target_frame")
	var plate := world.load_mesh("target_plate")
	var k := 0
	for t in world.lay["targets"]:
		var pos := Vector3(t[0], t[1], t[2])
		var b := Basis(Vector3.UP, float(t[3]))
		if k % 2 == 0:
			var mi := MeshInstance3D.new()
			mi.mesh = crate
			mi.transform = Transform3D(b, pos)
			add_child(mi)
			var body := _new_body()
			PhysicsServer3D.body_add_shape(body, _box(Vector3(0.55, 0.15, 0.22)).get_rid(), Transform3D(b, pos + Vector3(0, 0.15, 0)))
			body_mats[body] = PackedByteArray([1])
			for i in 5:
				var bottle := i % 2 == 1
				var rb := RigidBody3D.new()
				rb.mass = 0.35 if bottle else 0.12
				rb.collision_layer = 2
				rb.collision_mask = 1 | 2
				var cs := CollisionShape3D.new()
				var cyl := CylinderShape3D.new()
				cyl.radius = 0.036 if bottle else 0.034
				cyl.height = 0.28 if bottle else 0.115
				cs.shape = cyl
				cs.position.y = cyl.height * 0.5
				rb.add_child(cs)
				var vis := MeshInstance3D.new()
				vis.mesh = bottle_mesh if bottle else can_mesh
				rb.add_child(vis)
				rb.set_meta("surface", "glass" if bottle else "metal")
				rb.position = pos + b * Vector3(-0.4 + i * 0.2, 0.31, 0.0)
				rb.can_sleep = true
				rb.sleeping = true
				add_child(rb)
		else:
			var fr := MeshInstance3D.new()
			fr.mesh = frame
			fr.transform = Transform3D(b, pos)
			add_child(fr)
			var hinge := Node3D.new()
			hinge.transform = Transform3D(b, pos + b * Vector3(0, 1.02, 0))
			add_child(hinge)
			var pm := MeshInstance3D.new()
			pm.mesh = plate
			hinge.add_child(pm)
			var body := _new_body()
			PhysicsServer3D.body_add_shape(body, _box(Vector3(0.16, 0.225, 0.02)).get_rid(), hinge.transform * Transform3D(Basis(), Vector3(0, -0.4, 0)))
			body_mats[body] = PackedByteArray([2])
			plates.append({"node": hinge, "a": 0.0, "v": 0.0, "body": body})
		k += 1

## a shot hit a steel plate: swing it
func hit_plate(rid: RID, dir: Vector3) -> bool:
	for pl in plates:
		if pl["body"] == rid:
			var node: Node3D = pl["node"]
			var push := dir.dot(node.global_transform.basis.z)
			pl["v"] = float(pl["v"]) + signf(push if absf(push) > 0.01 else 1.0) * 3.5
			return true
	return false

func _smoke(pos: Vector3, size: float, col: Color, amount: int) -> CPUParticles3D:
	var p := CPUParticles3D.new()
	p.amount = amount
	p.lifetime = 9.0
	p.preprocess = 9.0
	p.position = pos
	p.direction = Vector3(0, 1, 0)
	p.spread = 12.0
	p.initial_velocity_min = 0.35 * size
	p.initial_velocity_max = 0.7 * size
	p.gravity = Vector3(0.25, 0.12, 0.08)
	p.damping_min = 0.02
	p.damping_max = 0.06
	p.scale_amount_min = 0.8 * size
	p.scale_amount_max = 1.4 * size
	var curve := Curve.new()
	curve.add_point(Vector2(0, 0.35))
	curve.add_point(Vector2(1, 3.2))
	p.scale_amount_curve = curve
	var g := Gradient.new()
	g.set_color(0, Color(col.r, col.g, col.b, 0.0))
	g.set_color(1, Color(col.r * 1.15, col.g * 1.15, col.b * 1.15, 0.0))
	g.add_point(0.12, col)
	g.add_point(0.6, Color(col.r * 1.1, col.g * 1.1, col.b * 1.1, col.a * 0.55))
	p.color_ramp = g
	var q := QuadMesh.new()
	q.size = Vector2(1.6, 1.6)
	q.material = _smoke_mat()
	p.mesh = q
	p.visibility_aabb = AABB(Vector3(-15, -2, -15), Vector3(30, 40, 30))
	add_child(p)
	smokes.append(p)
	return p

var _smat: StandardMaterial3D
func _smoke_mat() -> StandardMaterial3D:
	if _smat == null:
		_smat = StandardMaterial3D.new()
		_smat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		_smat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		_smat.vertex_color_use_as_albedo = true
		_smat.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
		_smat.billboard_keep_scale = true
		_smat.albedo_texture = load("res://textures/fx/smoke.png")
		_smat.disable_receive_shadows = true
		_smat.proximity_fade_enabled = false
	return _smat

func _smokes() -> void:
	for s in world.lay["smokes"]:
		_smoke(Vector3(s[0], s[1] + 0.4, s[2]), float(s[3]), Color(0.42, 0.41, 0.4, 0.4), 8)

func _exit_tree() -> void:
	for b in bodies:
		PhysicsServer3D.free_rid(b)
	bodies.clear()
