class_name Veg
extends Node3D
## Trees and ground debris, in three rings around the camera:
##   near  (64 m cells)   detailed meshes, trunk colliders, shadows
##   mid   (128 m chunks) light meshes
##   far   (256 m chunks) two crossed cards per tree
## Every tree is drawn by exactly one ring: the shaders hide an instance by its own distance (global view_pos).
## Plus the GPU ground cover (dry grass, litter).

const CELL := 64.0
const CHUNK := 128.0
const TREES := ["pine_dead", "pine_snag", "pine_burnt", "pine_live"]
const SMALL := ["stump", "bush_dead", "log"]

var world: World
var data: Dictionary
var mid_data := {}          # type -> chunk key -> merged buffer
var hi_mesh := {}
var lo_mesh := {}
var cells := {}             # near cells
var chunks := {}            # mid chunks
var r_hi := 56.0
var r_lo := 210.0
var r_small := 110.0
var r_col := 72.0
var _t := 0.0
var _shapes := {}
var imp_nodes: Array[MultiMeshInstance3D] = []
var cover: Array[MultiMeshInstance3D] = []
var cover_mats: Array[ShaderMaterial] = []
var tree_r := {}
var shadow_hi := true
var hi_mats: Array[ShaderMaterial] = []
var lo_mats: Array[ShaderMaterial] = []

func setup(w: World) -> void:
	world = w
	data = w.lay["veg"]
	tree_r = w.lay["tree_radius"]
	for t in TREES + SMALL:
		hi_mesh[t] = _own_materials(w.load_mesh(t), hi_mats)
		lo_mesh[t] = _own_materials(w.load_mesh(t + "_lo"), lo_mats)
		var merged := {}
		if data.has(t):
			for k in data[t]:
				var ij: PackedStringArray = (k as String).split(",")
				var ck := "%d,%d" % [floori(int(ij[0]) / 2.0), floori(int(ij[1]) / 2.0)]
				var acc: PackedFloat32Array = merged.get(ck, PackedFloat32Array())
				acc.append_array(data[t][k])
				merged[ck] = acc
		mid_data[t] = merged
	_build_impostors()
	_build_cover()

## each ring gets its own copies of the tree materials, so it can carry its own distance window
func _own_materials(m: Mesh, into: Array[ShaderMaterial]) -> Mesh:
	if not (m is ArrayMesh):
		return m
	var copy := (m as ArrayMesh).duplicate() as ArrayMesh
	for i in copy.get_surface_count():
		var sm := copy.surface_get_material(i)
		if sm is ShaderMaterial:
			var c := (sm as ShaderMaterial).duplicate() as ShaderMaterial
			copy.surface_set_material(i, c)
			into.append(c)
	return copy

func set_quality(q: int, density: int, vd: int) -> void:
	r_hi = [34.0, 48.0, 64.0, 80.0][q]
	r_lo = [140.0, 190.0, 240.0, 300.0][q] + [-25.0, 0.0, 50.0][vd]
	r_small = [60.0, 90.0, 120.0, 150.0][q]
	shadow_hi = int(Settings.get_v("shadows")) > 0
	for m in hi_mats:
		m.set_shader_parameter("cut_near", -1.0)
		m.set_shader_parameter("cut_far", r_hi)
	for m in lo_mats:
		m.set_shader_parameter("cut_near", r_hi)
		m.set_shader_parameter("cut_far", r_lo)
	(world.material("impostor") as ShaderMaterial).set_shader_parameter("near_cut", r_lo)
	for n in imp_nodes:
		n.visibility_range_end = [900.0, 1300.0, 1800.0][vd]
	var counts: Array = [[52, 36], [76, 52], [104, 68], [128, 84]][q]
	var dens: float = [0.6, 1.0, 1.35][density]
	for i in cover.size():
		_set_cover_count(i, int(counts[i] * dens))
	for k in cells:
		_apply_shadow(cells[k])

func _build_impostors() -> void:
	var mesh := world.load_mesh("impostor")
	for key in world.lay["impostors"]:
		var arr: PackedFloat32Array = world.lay["impostors"][key]
		if arr.size() < 16:
			continue
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.use_custom_data = true
		mm.mesh = mesh
		mm.instance_count = arr.size() / 16
		mm.buffer = arr
		var mmi := MultiMeshInstance3D.new()
		mmi.multimesh = mm
		mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		mmi.visibility_range_end = 1300.0
		add_child(mmi)
		imp_nodes.append(mmi)

func _cover_mesh(flat: bool) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var quads := 1 if flat else 2
	for q in quads:
		var a := q * PI * 0.5
		var dx := Vector3(cos(a), 0.0, sin(a)) * 0.5
		var p0 := -dx
		var p1 := dx
		var up := Vector3(0, 1, 0)
		var v := [p0, p1, p1 + up, p0 + up]
		var uv := [Vector2(0, 1), Vector2(1, 1), Vector2(1, 0), Vector2(0, 0)]
		for k in [0, 2, 1, 0, 3, 2]:
			st.set_normal(Vector3.UP)
			st.set_uv(uv[k])
			st.add_vertex(v[k])
	return st.commit()

func _build_cover() -> void:
	var specs := [
		{"tex": "res://textures/veg/grass_dry.png", "flat": false, "spacing": 0.42, "size": 0.6, "hs": 0.55, "w": Vector4(0.06, 0.03, 1.4, 0.0), "tint": Color(0.72, 0.66, 0.55)},
		{"tex": "res://textures/veg/litter.png", "flat": true, "spacing": 0.8, "size": 1.1, "hs": 1.0, "w": Vector4(0.9, 1.2, 0.1, 0.25), "tint": Color(0.85, 0.8, 0.75)},
	]
	for s in specs:
		var m := ShaderMaterial.new()
		m.shader = load("res://shaders/ground_cover.gdshader")
		world.apply_ground_params(m)
		m.set_shader_parameter("card_tex", load(s["tex"]))
		m.set_shader_parameter("flat_cards", s["flat"])
		m.set_shader_parameter("spacing", s["spacing"])
		m.set_shader_parameter("size", s["size"])
		m.set_shader_parameter("height_scale", s["hs"])
		m.set_shader_parameter("density_w", s["w"])
		m.set_shader_parameter("tint", s["tint"])
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = _cover_mesh(s["flat"])
		mm.custom_aabb = AABB(Vector3(-5000, -500, -5000), Vector3(10000, 3000, 10000))
		var mmi := MultiMeshInstance3D.new()
		mmi.multimesh = mm
		mmi.material_override = m
		mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		mmi.gi_mode = GeometryInstance3D.GI_MODE_DISABLED
		add_child(mmi)
		cover.append(mmi)
		cover_mats.append(m)
		_set_cover_count(cover.size() - 1, 48)

func _set_cover_count(i: int, n: int) -> void:
	var mm := cover[i].multimesh
	if mm.instance_count == n * n:
		return
	mm.instance_count = n * n
	var buf := PackedFloat32Array()
	buf.resize(n * n * 12)
	for k in n * n:
		var o := k * 12
		buf[o] = 1.0
		buf[o + 5] = 1.0
		buf[o + 10] = 1.0
	mm.buffer = buf
	var m := cover_mats[i]
	m.set_shader_parameter("grid_n", n)
	var sp: float = m.get_shader_parameter("spacing")
	m.set_shader_parameter("max_dist", n * sp * 0.5)

func update(cam: Vector3, delta: float, force := false) -> void:
	for m in cover_mats:
		var sp: float = m.get_shader_parameter("spacing")
		m.set_shader_parameter("grid_origin", Vector3(floor(cam.x / sp) * sp, cam.y, floor(cam.z / sp) * sp))
	_t -= delta
	if _t > 0.0 and not force:
		return
	_t = 0.25
	_update_near(cam)
	_update_mid(cam)

func _update_near(cam: Vector3) -> void:
	var reach := maxf(r_hi, r_col) + CELL * 0.71
	var ci := int(floor(cam.x / CELL))
	var cj := int(floor(cam.z / CELL))
	var rc := int(ceil(reach / CELL)) + 1
	var need := {}
	for j in range(cj - rc, cj + rc + 1):
		for i in range(ci - rc, ci + rc + 1):
			var d := Vector2((i + 0.5) * CELL - cam.x, (j + 0.5) * CELL - cam.z).length()
			if d <= reach:
				need["%d,%d" % [i, j]] = d
	for k in cells.keys():
		if not need.has(k):
			_free_cell(k)
	for k in need:
		var d: float = need[k]
		if not cells.has(k):
			cells[k] = _make_cell(k)
		var c: Dictionary = cells[k]
		var draw := d < r_hi + CELL * 0.71
		for t in c["mmis"]:
			var mmi: MultiMeshInstance3D = c["mmis"][t]
			mmi.visible = draw and (t in TREES or d < r_small)
		if d < r_col and not c.has("body"):
			c["body"] = _make_body(k)
		elif d > r_col + 40.0 and c.has("body"):
			PhysicsServer3D.free_rid(c["body"])
			c.erase("body")

func _update_mid(cam: Vector3) -> void:
	var reach := r_lo + CHUNK * 0.71
	var ci := int(floor(cam.x / CHUNK))
	var cj := int(floor(cam.z / CHUNK))
	var rc := int(ceil(reach / CHUNK)) + 1
	var need := {}
	for j in range(cj - rc, cj + rc + 1):
		for i in range(ci - rc, ci + rc + 1):
			var d := Vector2((i + 0.5) * CHUNK - cam.x, (j + 0.5) * CHUNK - cam.z).length()
			if d <= reach:
				need["%d,%d" % [i, j]] = d
	for k in chunks.keys():
		if not need.has(k):
			for n in (chunks[k] as Array):
				(n as Node).queue_free()
			chunks.erase(k)
	for k in need:
		if chunks.has(k):
			continue
		var list := []
		for t in TREES + SMALL:
			var md: Dictionary = mid_data[t]
			if not md.has(k):
				continue
			var mmi := _mmi(lo_mesh[t], md[k])
			mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			list.append(mmi)
		chunks[k] = list

func _mmi(mesh: Mesh, arr: PackedFloat32Array) -> MultiMeshInstance3D:
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = mesh
	mm.instance_count = arr.size() / 12
	mm.buffer = arr
	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	mmi.gi_mode = GeometryInstance3D.GI_MODE_DISABLED
	add_child(mmi)
	return mmi

func _apply_shadow(c: Dictionary) -> void:
	for t in c["mmis"]:
		var on: bool = shadow_hi and t != "bush_dead"
		(c["mmis"][t] as MultiMeshInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if on else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

func _make_cell(k: String) -> Dictionary:
	var c := {"mmis": {}}
	for t in TREES + SMALL:
		if not data.has(t) or not (data[t] as Dictionary).has(k):
			continue
		c["mmis"][t] = _mmi(hi_mesh[t], data[t][k])
	_apply_shadow(c)
	return c

func _free_cell(k: String) -> void:
	var c: Dictionary = cells[k]
	for t in c["mmis"]:
		(c["mmis"][t] as Node).queue_free()
	if c.has("body"):
		PhysicsServer3D.free_rid(c["body"])
	cells.erase(k)

func _shape(kind: String, a: float, b: float) -> Shape3D:
	var key := "%s%.2f_%.2f" % [kind, a, b]
	if _shapes.has(key):
		return _shapes[key]
	var s: Shape3D
	if kind == "c":
		var cs := CylinderShape3D.new()
		cs.radius = a
		cs.height = b
		s = cs
	else:
		var bs := BoxShape3D.new()
		bs.size = Vector3(a, b, b)
		s = bs
	_shapes[key] = s
	return s

func _make_body(k: String) -> RID:
	var body := PhysicsServer3D.body_create()
	PhysicsServer3D.body_set_mode(body, PhysicsServer3D.BODY_MODE_STATIC)
	PhysicsServer3D.body_set_collision_layer(body, 1)
	PhysicsServer3D.body_set_collision_mask(body, 0)
	for t in TREES + ["stump", "log"]:
		if not data.has(t) or not (data[t] as Dictionary).has(k):
			continue
		var arr: PackedFloat32Array = data[t][k]
		for n in arr.size() / 12:
			var o := n * 12
			var bx := Vector3(arr[o], arr[o + 4], arr[o + 8])
			var by := Vector3(arr[o + 1], arr[o + 5], arr[o + 9])
			var bz := Vector3(arr[o + 2], arr[o + 6], arr[o + 10])
			var sc := bx.length()
			var pos := Vector3(arr[o + 3], arr[o + 7], arr[o + 11])
			if t == "log":
				var s := _shape("b", snappedf(7.0 * sc, 0.1), snappedf(0.34 * sc, 0.02))
				PhysicsServer3D.body_add_shape(body, s.get_rid(), Transform3D(Basis(bx / sc, by / sc, bz / sc), pos))
			else:
				var r := snappedf(float(tree_r.get(t, 0.2)) * sc, 0.01)
				var h := 1.2 if t == "stump" else 7.0
				var s2 := _shape("c", maxf(r, 0.08), h)
				PhysicsServer3D.body_add_shape(body, s2.get_rid(), Transform3D(Basis(), pos + Vector3(0, h * 0.5 - 0.1, 0)))
	PhysicsServer3D.body_attach_object_instance_id(body, get_instance_id())
	PhysicsServer3D.body_set_space(body, get_world_3d().space)
	return body

func _exit_tree() -> void:
	for k in cells:
		if cells[k].has("body"):
			PhysicsServer3D.free_rid(cells[k]["body"])
