class_name Valley
extends Node3D
## The 8 x 8 km valley at run time: roads and the airfield, 500+ buildings in three levels of detail (full interiors
## near you, shells further out, boxes on the horizon), their colliders and doors streamed around the player, ivy on the
## walls, 115k green trees in three rings (full trees, lighter trees, then camera-facing cards from a baked atlas), grass,
## lakes and the sea. Answers the same questions as the trench map's Props (surfaces, water, interactables) so the player
## and the weapon work on both maps.
##
## Draw calls stay flat: every ring is one MultiMesh per model (rebuilt from the instances around the camera when it has
## moved a few metres), so a frame costs about the same in a town, a forest or a plane. Each instance also cuts itself
## to its ring in the vertex shader (cut_near / cut_far from the global view_pos), and neighbouring rings dissolve into
## each other with the same screen noise (fade_in / fade_out), so nothing jumps.

const TINTS := [Color(0.95, 0.9, 0.8), Color(0.97, 0.96, 0.93), Color(0.93, 0.8, 0.58), Color(0.93, 0.8, 0.76),
	Color(0.8, 0.84, 0.87), Color(0.88, 0.83, 0.7), Color(0.76, 0.76, 0.74), Color(0.82, 0.88, 0.78)]
const BMAT := {
	"plaster": ["res://textures/b/plaster.jpg", "res://textures/b/plaster_nrh.png", {"house_tint": true}],
	"plaster_in": ["res://textures/b/plaster_in.jpg", "res://textures/b/plaster_in_nrh.png", {"wet_affect": 0.0, "grime": 0.3}],
	"ceiling": ["res://textures/b/plaster_in.jpg", "res://textures/b/plaster_in_nrh.png", {"wet_affect": 0.0, "grime": 0.0, "tint": Color(0.92, 0.92, 0.9)}],
	"brick": ["res://textures/b/brick.jpg", "res://textures/b/brick_nrh.png", {}],
	"concrete": ["res://textures/b/concrete.jpg", "res://textures/b/concrete_nrh.png", {}],
	"rubble": ["res://textures/b/concrete.jpg", "res://textures/b/concrete_nrh.png", {"tint": Color(0.8, 0.76, 0.7)}],
	"floor_wood": ["res://textures/props/planks.jpg", "res://textures/props/planks_nrh.png", {"wet_affect": 0.0, "grime": 0.0}],
	"floor_tiles": ["res://textures/b/floor_tiles.jpg", "res://textures/b/floor_tiles_nrh.png", {"wet_affect": 0.0, "grime": 0.0}],
	"roof_tiles": ["res://textures/b/roof_tiles.jpg", "res://textures/b/roof_tiles_nrh.png", {"grime": 0.0}],
	"roof_metal": ["res://textures/b/roof_metal.jpg", "res://textures/b/roof_metal_nrh.png", {"metallic": 0.45, "grime": 0.0}],
	"wood": ["res://textures/props/planks.jpg", "res://textures/props/planks_nrh.png", {"tint": Color(0.72, 0.6, 0.48), "grime": 0.0}],
	"fabric": ["res://textures/props/blanket.jpg", "res://textures/props/blanket_nrh.png", {"wet_affect": 0.0, "grime": 0.0}],
	"metal": ["res://textures/props/galv.jpg", "res://textures/props/galv_nrh.png", {"metallic": 0.6, "grime": 0.2}],
	"paint": ["res://textures/b/paint.jpg", "res://textures/b/paint_nrh.png", {"metallic": 0.3, "grime": 0.4}],
	"screen": ["res://textures/b/screen.png", "", {"emission": Color(0.25, 1.0, 0.45), "emission_energy": 1.6, "grime": 0.0, "wet_affect": 0.0}],
	"glass": ["res://textures/b/paint.jpg", "", {"tint": Color(0.18, 0.24, 0.27), "rough_add": -0.8, "metallic": 0.6, "grime": 0.0}],
	"road_asphalt": ["res://textures/b/asphalt.jpg", "res://textures/b/asphalt_nrh.png", {"grime": 0.0}],
	"road_runway": ["res://textures/b/asphalt.jpg", "res://textures/b/asphalt_nrh.png", {"grime": 0.0, "tint": Color(0.82, 0.82, 0.84)}],
	"road_dirt": ["res://textures/b/concrete.jpg", "res://textures/b/concrete_nrh.png", {"grime": 0.0, "tint": Color(0.55, 0.45, 0.33), "rough_add": 0.1}],
	"road_concrete": ["res://textures/b/concrete.jpg", "res://textures/b/concrete_nrh.png", {"grime": 0.0}],
	"mark_white": ["res://textures/b/paint.jpg", "", {"tint": Color(1.25, 1.25, 1.22), "grime": 0.0}],
}
const LEAF_TINT := {"oak": Color(0.85, 0.95, 0.8), "ash": Color(0.88, 0.95, 0.82), "aspen": Color(0.9, 0.96, 0.8), "pine": Color(0.8, 0.9, 0.82), "plane": Color(0.88, 0.95, 0.8)}
const B_CH_HI := 128.0
const T_CH_NEAR := 128.0
const IMP_CH := 1024.0
const BAND0 := 12.0                 # lod0 trees dissolve into lod1 over this many metres
const BAND1 := 45.0                 # lod1 trees dissolve into the impostor cards
const REBUILD_STEP := 10.0          # rebuild the sets around the camera after it moved this far

var world: World
var lay: Dictionary
var pref: Dictionary
var tinfo: Dictionary
var ring_b: Array[float] = [150.0, 1300.0]           # buildings: hi -> mid -> far
var ring_t: Array[float] = [140.0, 320.0, 2600.0]    # trees: lod0 -> lod1 -> impostor cards -> none
var shadow_r := 45.0                # trees cast shadows (with their lod1 shape) this close
var bmesh := {}                     # type -> [hi, mid, far]
var tmesh := {}                     # variant -> [lod0, lod1, lod1 for shadows]
var mats := {}                      # "name|ring" -> material
var mat_ring := {}                  # material -> [kind ("b" or "t"), name, ring]
var bxf: Array[Transform3D] = []    # per building
var btype: PackedStringArray = []
var btint: PackedInt32Array = []
var bchunk_hi := {}                 # Vector2i -> PackedInt32Array of building indices (colliders, doors, inside test)
var b_mm := {}                      # type -> [MultiMeshInstance3D hi, mid, far]
var t_mm := {}                      # variant -> [MultiMeshInstance3D lod0, lod1, shadow]
var imp_mmi: Array[MultiMeshInstance3D] = []
var imp_mat: ShaderMaterial
var ivy_mmi: MultiMeshInstance3D
var _ivy_sig := -1
var tchunk_near := {}               # Vector2i -> {variant: PackedFloat32Array (x, y, z, yaw, scale)}
var bodies := {}                    # building index -> RID
var tree_bodies := {}               # Vector2i -> RID
var body_shapes := {}               # body RID -> Array[RID] (freed with the body)
var models: ValleyModels
var loot: Loot
var doors := {}                     # "b:d" -> {"node": Node3D, "open": bool, "angle": float, "hinge": Vector3}
var door_open := {}                 # "b:d" -> bool (kept when the node is freed)
var lakes: Array = []
var cover: Array[MultiMeshInstance3D] = []
var cover_mats: Array[ShaderMaterial] = []
var _t := 0.0
var _focus := Vector3(1e9, 0, 0)
var _tfocus := Vector3(1e9, 0, 0)
var _bfocus := Vector3(1e9, 0, 0)
var _qkey := ""
var door_mat: Material
var door_mesh_cache := {}
## the city's buildings on a 2 m grid (roof height over the ground, quarter metres): spawn spots, soldiers walking far
## from the player (no colliders there) and their line of sight
const GRID_HALF := 720.0
const GRID_CELL := 2.0
var grid_n := 0
var roof := PackedByteArray()

func setup(w: World) -> void:
	world = w
	lay = w.lay
	pref = JSON.parse_string(FileAccess.get_file_as_string("res://data/valley/prefabs.json"))
	tinfo = JSON.parse_string(FileAccess.get_file_as_string("res://data/valley/trees.json"))
	_apply_quality()
	_meshes()
	await get_tree().process_frame
	_roads()
	_buildings_static()
	_city_grid()
	loot = Loot.new()
	loot.name = "Loot"
	add_child(loot)
	loot.setup(world, bxf, btype, pref)
	await get_tree().process_frame
	_trees_static()
	await get_tree().process_frame
	_impostors()
	await get_tree().process_frame
	_water()
	_cover()
	models = ValleyModels.new()
	models.name = "Models"
	add_child(models)
	await models.setup(world)

func _exit_tree() -> void:
	for i in bodies:
		_free_body(bodies[i])
	for k in tree_bodies:
		_free_body(tree_bodies[k])
	bodies.clear()
	tree_bodies.clear()

func _free_body(b: RID) -> void:
	PhysicsServer3D.free_rid(b)
	for sh in body_shapes.get(b, []):
		PhysicsServer3D.free_rid(sh)
	body_shapes.erase(b)

func _apply_quality() -> void:
	var q := int(Settings.get_v("view_distance"))
	var sh := int(Settings.get_v("shadows"))
	ring_b = [[110.0, 150.0, 190.0][q], [900.0, 1300.0, 2200.0][q]]
	ring_t = [[100.0, 140.0, 190.0][q], [230.0, 320.0, 440.0][q], [1800.0, 2600.0, 3800.0][q]]
	shadow_r = [0.0, 45.0, 90.0][clampi(sh, 0, 2)] * (1.25 if int(Settings.get_v("quality")) >= 3 else 1.0)
	_qkey = "%d|%d|%d" % [q, sh, int(Settings.get_v("quality"))]

# ------------------------------------------------------------------ materials and meshes
func _bmat(name: String, ring: int) -> Material:
	var key := "%s|%d" % [name, ring]
	if mats.has(key):
		return mats[key]
	var d: Array = BMAT.get(name, BMAT["concrete"])
	var m := ShaderMaterial.new()
	m.shader = load("res://shaders/building.gdshader")
	m.set_shader_parameter("alb_tex", load(d[0]))
	if str(d[1]) != "":
		m.set_shader_parameter("nrh_tex", load(d[1]))
	else:
		m.set_shader_parameter("has_nrh", false)
	var extra: Dictionary = d[2]
	for k in extra:
		m.set_shader_parameter(k, extra[k])
	mats[key] = m
	mat_ring[m] = ["b", name, ring]
	_window(m)
	return m

func _tmat(name: String, ring: int) -> Material:
	var key := "t%s|%d" % [name, ring]
	if mats.has(key):
		return mats[key]
	var m := ShaderMaterial.new()
	if name.begins_with("bark_"):
		var b := name.substr(5)
		m.shader = load("res://shaders/tree_bark.gdshader")
		m.set_shader_parameter("alb_tex", load("res://textures/v8/bark_%s.jpg" % b))
		m.set_shader_parameter("nrh_tex", load("res://textures/v8/bark_%s_nrh.png" % b))
		m.set_shader_parameter("tint", Color(0.82, 0.78, 0.72) if b != "birch" else Color(1, 1, 0.97))
	else:
		var l := name.substr(5)
		m.shader = load("res://shaders/cards.gdshader")
		m.set_shader_parameter("tex", load("res://textures/v8/leaf_%s.png" % l))
		m.set_shader_parameter("tint", LEAF_TINT.get(l, Color(0.9, 0.95, 0.85)))
		m.set_shader_parameter("translucency", 0.35)
		m.set_shader_parameter("flutter", 1.0 if ring == 0 else 0.0)
		m.set_shader_parameter("alpha_cut", 0.5)
		m.set_shader_parameter("roughness", 0.75)
	mats[key] = m
	mat_ring[m] = ["t", name, ring]
	_window(m)
	return m

## the distance window of one material (its ring), from the current view distance
func _window(m: ShaderMaterial) -> void:
	var info: Array = mat_ring[m]
	var ring: int = info[2]
	if info[0] == "b":
		if ring < 0:
			return
		m.set_shader_parameter("cut_near", [-1.0, ring_b[0], ring_b[1]][ring])
		m.set_shader_parameter("cut_far", [ring_b[0], ring_b[1], 100000.0][ring])
		return
	var bark := String(info[1]).begins_with("bark_")
	match ring:
		0:
			m.set_shader_parameter("cut_near", -1.0)
			m.set_shader_parameter("cut_far", ring_t[0])
			if not bark:
				m.set_shader_parameter("fade_out", BAND0)
		1:
			m.set_shader_parameter("cut_near", ring_t[0] if bark else ring_t[0] - BAND0)
			m.set_shader_parameter("cut_far", ring_t[1])
			m.set_shader_parameter("fade_out", BAND1)
			if not bark:
				m.set_shader_parameter("fade_in", BAND0)
		_:
			m.set_shader_parameter("cut_near", -1.0)
			m.set_shader_parameter("cut_far", 100000.0)

func _meshes() -> void:
	for t in pref:
		var sc := load("res://models/b/%s.glb" % t) as PackedScene
		var inst := sc.instantiate()
		var out: Array = [null, null, null]
		for c in inst.get_children():
			var ring: int = {"hi": 0, "mid": 1, "far": 2}.get(String(c.name), -1)
			if ring < 0 or not (c is MeshInstance3D):
				continue
			var mesh := (c as MeshInstance3D).mesh as ArrayMesh
			for i in mesh.get_surface_count():
				var sm := mesh.surface_get_material(i)
				mesh.surface_set_material(i, _bmat(sm.resource_name if sm else "concrete", ring))
			out[ring] = mesh
		inst.free()
		bmesh[t] = out
	for v in tinfo:
		var sc := load("res://models/v8/%s.glb" % v) as PackedScene
		var inst := sc.instantiate()
		var out: Array = [null, null, null]
		for c in inst.get_children():
			var ring: int = {"lod0": 0, "lod1": 1}.get(String(c.name), -1)
			if ring < 0 or not (c is MeshInstance3D):
				continue
			var mesh := (c as MeshInstance3D).mesh as ArrayMesh
			for i in mesh.get_surface_count():
				var sm := mesh.surface_get_material(i)
				mesh.surface_set_material(i, _tmat(sm.resource_name if sm else "bark_oak", ring))
			out[ring] = mesh
		inst.free()
		if out[1] != null:
			var shm := (out[1] as ArrayMesh).duplicate() as ArrayMesh
			for i in shm.get_surface_count():
				var info: Array = mat_ring.get(shm.surface_get_material(i), ["t", "bark_oak", 1])
				shm.surface_set_material(i, _tmat(String(info[1]), 2))
			out[2] = shm
		tmesh[v] = out
	var dm := StandardMaterial3D.new()
	dm.albedo_texture = load("res://textures/props/planks.jpg")
	dm.albedo_color = Color(0.62, 0.48, 0.36)
	dm.roughness = 0.85
	dm.uv1_triplanar = true
	dm.uv1_scale = Vector3(0.7, 0.7, 0.7)
	door_mat = dm

# ------------------------------------------------------------------ roads and the airfield
func _roads() -> void:
	var sc := load("res://models/v8/roads.glb") as PackedScene
	var inst := sc.instantiate()
	for c in inst.get_children():
		if not (c is MeshInstance3D):
			continue
		var mi := c as MeshInstance3D
		var parts := String(mi.name).split("_")
		var mat_name := "_".join(parts.slice(3)) if parts.size() > 3 else "road_asphalt"
		var mesh := mi.mesh as ArrayMesh
		for i in mesh.get_surface_count():
			mesh.surface_set_material(i, _bmat(mat_name, -1))
		var n := MeshInstance3D.new()
		n.mesh = mesh
		n.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		n.visibility_range_end = 3200.0
		add_child(n)
	inst.free()

# ------------------------------------------------------------------ buildings
func _buildings_static() -> void:
	var b: Array = lay["buildings"]
	var all := {}
	for i in b.size():
		var row: Array = b[i]
		var t := String(row[0])
		var xf := Transform3D(Basis(Vector3.UP, float(row[4])), Vector3(row[1], row[2], row[3]))
		bxf.append(xf)
		btype.append(t)
		btint.append(int(row[5]))
		var kh := Vector2i(floori(xf.origin.x / B_CH_HI), floori(xf.origin.z / B_CH_HI))
		if not bchunk_hi.has(kh):
			bchunk_hi[kh] = PackedInt32Array()
		var arr: PackedInt32Array = bchunk_hi[kh]
		arr.append(i)
		bchunk_hi[kh] = arr
		var la: Array = all.get(t, [])
		la.append(i)
		all[t] = la
	for t in bmesh:
		var l: Array = [null, null, null]
		for ring in 3:
			var mesh: Mesh = bmesh[t][ring]
			if mesh == null:
				continue
			var mm := MultiMesh.new()
			mm.transform_format = MultiMesh.TRANSFORM_3D
			mm.use_custom_data = true
			mm.mesh = mesh
			var mmi := MultiMeshInstance3D.new()
			mmi.multimesh = mm
			mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			mmi.gi_mode = GeometryInstance3D.GI_MODE_DISABLED
			mmi.visible = false
			add_child(mmi)
			l[ring] = mmi
		b_mm[t] = l
		# the horizon boxes hold every building of the type, once
		if l[2] != null and all.has(t):
			_fill_buildings(l[2], all[t])
	ivy_mmi = MultiMeshInstance3D.new()
	var imm := MultiMesh.new()
	imm.transform_format = MultiMesh.TRANSFORM_3D
	imm.mesh = _ivy_mesh()
	ivy_mmi.multimesh = imm
	ivy_mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	ivy_mmi.visible = false
	add_child(ivy_mmi)

func _fill_buildings(mmi: MultiMeshInstance3D, ids: Array) -> void:
	var n := ids.size()
	var buf := PackedFloat32Array()
	buf.resize(n * 16)
	for j in n:
		var i: int = ids[j]
		var xf := bxf[i]
		var o := j * 16
		buf[o] = xf.basis.x.x
		buf[o + 1] = xf.basis.y.x
		buf[o + 2] = xf.basis.z.x
		buf[o + 3] = xf.origin.x
		buf[o + 4] = xf.basis.x.y
		buf[o + 5] = xf.basis.y.y
		buf[o + 6] = xf.basis.z.y
		buf[o + 7] = xf.origin.y
		buf[o + 8] = xf.basis.x.z
		buf[o + 9] = xf.basis.y.z
		buf[o + 10] = xf.basis.z.z
		buf[o + 11] = xf.origin.z
		var c: Color = TINTS[btint[i] % TINTS.size()]
		buf[o + 12] = c.r
		buf[o + 13] = c.g
		buf[o + 14] = c.b
		buf[o + 15] = 1.0
	var mm := mmi.multimesh
	mm.instance_count = n
	if n > 0:
		mm.buffer = buf
	mmi.visible = n > 0

## full interiors and shells around the camera (3D distance, so a plane overhead sees the right ring)
func _rebuild_buildings(p: Vector3) -> void:
	var hi_r: float = ring_b[0] + REBUILD_STEP + 20.0
	var mid_in: float = ring_b[0] - REBUILD_STEP - 20.0
	var mid_r: float = ring_b[1] + REBUILD_STEP + 40.0
	var hi := {}
	var mid := {}
	var hi_ids: Array[int] = []
	for i in bxf.size():
		var d := bxf[i].origin.distance_to(p)
		if d < hi_r:
			var l: Array = hi.get(btype[i], [])
			l.append(i)
			hi[btype[i]] = l
			hi_ids.append(i)
		if d > mid_in and d < mid_r:
			var l2: Array = mid.get(btype[i], [])
			l2.append(i)
			mid[btype[i]] = l2
	var sh := int(Settings.get_v("shadows")) > 0
	for t in b_mm:
		var l: Array = b_mm[t]
		if l[0] != null:
			_fill_buildings(l[0], hi.get(t, []))
			(l[0] as MultiMeshInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if sh else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		if l[1] != null:
			_fill_buildings(l[1], mid.get(t, []))
	var sig := hash(hi_ids)
	if sig != _ivy_sig:
		_ivy_sig = sig
		_fill_ivy(hi_ids)
	_cover_holes(p)

## no grass on the floors of the buildings near the camera
func _cover_holes(p: Vector3) -> void:
	var near: Array = []
	for k in _keys_around(p, B_CH_HI, 70.0):
		if not bchunk_hi.has(k):
			continue
		for i in bchunk_hi[k]:
			var d := Vector2(bxf[i].origin.x - p.x, bxf[i].origin.z - p.z).length()
			if d < 70.0:
				near.append([d, i])
	near.sort_custom(func(a: Array, b: Array) -> bool: return float(a[0]) < float(b[0]))
	var hv := PackedVector4Array()
	var hr := PackedVector2Array()
	for e in near.slice(0, 24):
		var i: int = e[1]
		var pf: Dictionary = pref[btype[i]]
		var bx := bxf[i].basis.x
		hv.append(Vector4(bxf[i].origin.x, bxf[i].origin.z, float(pf["w"]) * 0.5 - 0.05, float(pf["d"]) * 0.5 - 0.05))
		hr.append(Vector2(bx.x, -bx.z))
	while hv.size() < 24:
		hv.append(Vector4(0, 0, -1, -1))
		hr.append(Vector2(1, 0))
	for m in cover_mats:
		m.set_shader_parameter("holes", hv)
		m.set_shader_parameter("holes_r", hr)
		m.set_shader_parameter("hole_n", mini(near.size(), 24))

## ivy cards climbing the walls of the buildings close by
func _fill_ivy(ids: Array[int]) -> void:
	var xfs: Array[Transform3D] = []
	for i in ids:
		var spots: Array = pref[btype[i]]["ivy"]
		var rng := RandomNumberGenerator.new()
		rng.seed = i * 7919
		for s in spots:
			if rng.randf() < 0.45:
				continue
			var h: float = s[5]
			var nrm := Vector3(s[3], 0, s[4])
			var levels := int(ceil(h / 1.1))
			var w := rng.randf_range(1.1, 1.8)
			for k in levels:
				var local := Vector3(s[0], float(s[1]) + 0.55 + k * 1.0, s[2]) + nrm * 0.03
				var b := Basis.looking_at(-nrm, Vector3.UP)
				b = b.scaled(Vector3(w * (1.0 - k * 0.12), 1.15, 1.0))
				xfs.append(bxf[i] * Transform3D(b, local))
	var mm := ivy_mmi.multimesh
	mm.instance_count = xfs.size()
	for j in xfs.size():
		mm.set_instance_transform(j, xfs[j])
	ivy_mmi.visible = not xfs.is_empty()

var _ivy_m: ArrayMesh
func _ivy_mesh() -> ArrayMesh:
	if _ivy_m:
		return _ivy_m
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var v := [Vector3(-0.5, -0.55, 0), Vector3(0.5, -0.55, 0), Vector3(0.5, 0.55, 0), Vector3(-0.5, 0.55, 0)]
	var uv := [Vector2(0, 1), Vector2(1, 1), Vector2(1, 0), Vector2(0, 0)]
	for k in [0, 2, 1, 0, 3, 2]:
		st.set_normal(Vector3(0, 0, 1))
		st.set_uv(uv[k])
		st.set_uv2(Vector2(1, 0))
		st.add_vertex(v[k])
	_ivy_m = st.commit()
	var m := ShaderMaterial.new()
	m.shader = load("res://shaders/cards.gdshader")
	m.set_shader_parameter("tex", load("res://textures/v8/g_ivy.png"))
	m.set_shader_parameter("tint", Color(0.75, 0.85, 0.65))
	m.set_shader_parameter("translucency", 0.3)
	m.set_shader_parameter("flutter", 0.4)
	m.set_shader_parameter("sway", 0.0)
	m.set_shader_parameter("alpha_cut", 0.45)
	m.set_shader_parameter("cut_far", ring_b[0] + 20.0)
	_ivy_m.surface_set_material(0, m)
	return _ivy_m

# ------------------------------------------------------------------ trees
func _trees_static() -> void:
	var veg: Dictionary = lay["veg"]
	for v in veg:
		if not tmesh.has(v):
			continue
		var arr: PackedFloat32Array = veg[v]
		# group the variant by 128 m cell (local arrays, written back once: no copy per append)
		var by := {}
		for o in range(0, arr.size(), 5):
			var kn := Vector2i(floori(arr[o] / T_CH_NEAR), floori(arr[o + 2] / T_CH_NEAR))
			var l: Array = by.get(kn, [])
			if l.is_empty():
				by[kn] = l
			l.append(o)
		for kn in by:
			var offs: Array = by[kn]
			var pn := PackedFloat32Array()
			pn.resize(offs.size() * 5)
			for j in offs.size():
				var o: int = offs[j]
				for c in 5:
					pn[j * 5 + c] = arr[o + c]
			if not tchunk_near.has(kn):
				tchunk_near[kn] = {}
			(tchunk_near[kn] as Dictionary)[v] = pn
		var l3: Array = [null, null, null]
		for ring in 3:
			var mesh: Mesh = tmesh[v][ring]
			if mesh == null:
				continue
			var mm := MultiMesh.new()
			mm.transform_format = MultiMesh.TRANSFORM_3D
			mm.mesh = mesh
			var mmi := MultiMeshInstance3D.new()
			mmi.multimesh = mm
			mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_SHADOWS_ONLY if ring == 2 else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			mmi.gi_mode = GeometryInstance3D.GI_MODE_DISABLED
			mmi.visible = false
			add_child(mmi)
			l3[ring] = mmi
		t_mm[v] = l3

## full trees, lighter trees and the shadow casters around the camera
func _rebuild_trees(p: Vector3) -> void:
	var r0: float = ring_t[0] + REBUILD_STEP + 6.0
	var r1in: float = ring_t[0] - BAND0 - REBUILD_STEP - 6.0
	var r1: float = ring_t[1] + REBUILD_STEP + 6.0
	var rs: float = shadow_r + REBUILD_STEP + 6.0 if shadow_r > 0.0 else -1.0
	var keys := _keys_around(p, T_CH_NEAR, r1)
	for v in t_mm:
		var b0 := PackedFloat32Array()
		var b1 := PackedFloat32Array()
		var bs := PackedFloat32Array()
		for k in keys:
			var d: Dictionary = tchunk_near.get(k, {})
			if not d.has(v):
				continue
			var arr: PackedFloat32Array = d[v]
			for o in range(0, arr.size(), 5):
				var dist := Vector3(arr[o], arr[o + 1], arr[o + 2]).distance_to(p)
				if dist > r1:
					continue
				var sc := arr[o + 4]
				var c := cos(arr[o + 3]) * sc
				var sn := sin(arr[o + 3]) * sc
				var row := PackedFloat32Array([c, 0.0, sn, arr[o], 0.0, sc, 0.0, arr[o + 1], -sn, 0.0, c, arr[o + 2]])
				if dist < r0:
					b0.append_array(row)
				if dist > r1in:
					b1.append_array(row)
				if dist < rs:
					bs.append_array(row)
		var l: Array = t_mm[v]
		_set_mm(l[0], b0)
		_set_mm(l[1], b1)
		_set_mm(l[2], bs)

func _set_mm(mmi: MultiMeshInstance3D, buf: PackedFloat32Array) -> void:
	if mmi == null:
		return
	var n := buf.size() / 12
	var mm := mmi.multimesh
	mm.instance_count = n
	if n > 0:
		mm.buffer = buf
	mmi.visible = n > 0

## the far forest: every tree once, as a card from the atlas, in 1 km blocks that switch off when out of the ring
func _impostors() -> void:
	var info: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://data/valley/impostors.json"))
	var cells: Dictionary = info["cells"]
	imp_mat = ShaderMaterial.new()
	imp_mat.shader = load("res://shaders/impostor8.gdshader")
	imp_mat.set_shader_parameter("atlas", load("res://textures/v8/impostors.png"))
	imp_mat.set_shader_parameter("grid", Vector2(float(info["cols"]), float(info["rows"])))
	var mesh := _card_mesh()
	mesh.surface_set_material(0, imp_mat)
	var half: float = float(lay["half"])
	var nc := ceili(half * 2.0 / IMP_CH)
	var veg: Dictionary = lay["veg"]
	var counts := PackedInt32Array()
	counts.resize(nc * nc)
	var total := 0
	for v in veg:
		if not cells.has(v):
			continue
		var arr: PackedFloat32Array = veg[v]
		for o in range(0, arr.size(), 5):
			var ci := clampi(floori((arr[o] + half) / IMP_CH), 0, nc - 1) + clampi(floori((arr[o + 2] + half) / IMP_CH), 0, nc - 1) * nc
			counts[ci] += 1
			total += 1
	var start := PackedInt32Array()
	start.resize(nc * nc)
	var acc := 0
	for c in nc * nc:
		start[c] = acc
		acc += counts[c]
	var cur := start.duplicate()
	var buf := PackedFloat32Array()
	buf.resize(total * 16)
	var lo := PackedVector3Array()
	var hi := PackedVector3Array()
	lo.resize(nc * nc)
	hi.resize(nc * nc)
	lo.fill(Vector3(INF, INF, INF))
	hi.fill(Vector3(-INF, -INF, -INF))
	for v in veg:
		if not cells.has(v):
			continue
		var cell: Array = cells[v]
		var idx := float(cell[0])
		var cw := float(cell[1])
		var ch := float(cell[2])
		var arr: PackedFloat32Array = veg[v]
		for o in range(0, arr.size(), 5):
			var x := arr[o]
			var y := arr[o + 1]
			var z := arr[o + 2]
			var sc := arr[o + 4]
			var ci := clampi(floori((x + half) / IMP_CH), 0, nc - 1) + clampi(floori((z + half) / IMP_CH), 0, nc - 1) * nc
			var bo := cur[ci] * 16
			cur[ci] += 1
			buf[bo] = sc
			buf[bo + 3] = x
			buf[bo + 5] = sc
			buf[bo + 7] = y
			buf[bo + 10] = sc
			buf[bo + 11] = z
			buf[bo + 12] = idx
			buf[bo + 13] = cw
			buf[bo + 14] = ch
			buf[bo + 15] = fposmod(x * 0.1731 + z * 0.3197, 1.0)
			var pnt := Vector3(x, y, z)
			lo[ci] = lo[ci].min(pnt)
			hi[ci] = hi[ci].max(pnt)
	for c in nc * nc:
		if counts[c] == 0:
			continue
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.use_custom_data = true
		mm.mesh = mesh
		mm.instance_count = counts[c]
		mm.buffer = buf.slice(start[c] * 16, (start[c] + counts[c]) * 16)
		mm.custom_aabb = AABB(lo[c] - Vector3(25, 2, 25), hi[c] - lo[c] + Vector3(50, 50, 50))
		var mmi := MultiMeshInstance3D.new()
		mmi.multimesh = mm
		mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		mmi.gi_mode = GeometryInstance3D.GI_MODE_DISABLED
		add_child(mmi)
		imp_mmi.append(mmi)
	_imp_windows()

func _imp_windows() -> void:
	if imp_mat == null:
		return
	imp_mat.set_shader_parameter("cut_near", ring_t[1] - BAND1)
	imp_mat.set_shader_parameter("fade_in", BAND1)
	imp_mat.set_shader_parameter("cut_far", ring_t[2])
	imp_mat.set_shader_parameter("fade_out", ring_t[2] * 0.15)
	var half_diag := IMP_CH * 0.7072
	for mmi in imp_mmi:
		mmi.visibility_range_begin = maxf(0.0, ring_t[1] - BAND1 - half_diag)
		mmi.visibility_range_end = ring_t[2] + half_diag

func _card_mesh() -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var v := [Vector3(-0.5, 0, 0), Vector3(0.5, 0, 0), Vector3(0.5, 1, 0), Vector3(-0.5, 1, 0)]
	var uv := [Vector2(0, 1), Vector2(1, 1), Vector2(1, 0), Vector2(0, 0)]
	for k in [0, 2, 1, 0, 3, 2]:
		st.set_normal(Vector3(0, 0, 1))
		st.set_uv(uv[k])
		st.add_vertex(v[k])
	return st.commit()

# ------------------------------------------------------------------ water
func _water() -> void:
	var lm := ShaderMaterial.new()
	lm.shader = load("res://shaders/lake.gdshader")
	lm.set_shader_parameter("nmap", load("res://textures/fx/waternormals.jpg"))
	for lk in lay["lakes"]:
		lakes.append([float(lk["x"]), float(lk["z"]), float(lk["r"]), float(lk["level"])])
		_water_mesh(float(lk["x"]), float(lk["z"]), float(lk["r"]) * 1.45, float(lk["level"]), lm)
	# the sea bay: a big sheet along the west edge
	var sea: float = lay.get("sea_level", 0.0)
	lakes.append([-4600.0, 0.0, -1.0, sea])
	_water_mesh(-4100.0, 0.0, 1900.0, sea, lm, true)

func _water_mesh(cx: float, cz: float, r: float, level: float, m: Material, square := false) -> void:
	var n := 64
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var step := 2.0 * r / n
	var verts := {}
	for j in n + 1:
		for i in n + 1:
			var x := cx - r + i * step
			var z := cz - r * (2.4 if square else 1.0) + j * step * (2.4 if square else 1.0)
			var depth := clampf(level - world.height(x, z), 0.0, 20.0)
			verts[Vector2i(i, j)] = [Vector3(x, level, z), depth]
	for j in n:
		for i in n:
			var quad := [Vector2i(i, j), Vector2i(i + 1, j), Vector2i(i + 1, j + 1), Vector2i(i, j + 1)]
			var any_wet := false
			for q in quad:
				if float(verts[q][1]) > 0.02:
					any_wet = true
			if not any_wet:
				continue
			for k in [0, 2, 1, 0, 3, 2]:
				var e: Array = verts[quad[k]]
				st.set_color(Color(float(e[1]) / 20.0, 0, 0))
				st.set_normal(Vector3.UP)
				st.set_uv(Vector2((e[0] as Vector3).x, (e[0] as Vector3).z) * 0.05)
				st.add_vertex(e[0])
	var mesh := st.commit()
	if mesh.get_surface_count() == 0:
		return
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)

func water_at(p: Vector3) -> bool:
	for lk in lakes:
		if float(lk[2]) < 0.0:
			if p.x < -2600.0 and p.y < float(lk[3]) + 0.05 and world.height(p.x, p.z) < float(lk[3]):
				return true
			continue
		if Vector2(p.x - float(lk[0]), p.z - float(lk[1])).length() < float(lk[2]) * 1.5 and p.y < float(lk[3]) + 0.05 and world.height(p.x, p.z) < float(lk[3]):
			return true
	return false

## water surface height at a point, or -INF
func water_level(x: float, z: float) -> float:
	for lk in lakes:
		var inside := (float(lk[2]) < 0.0 and x < -2600.0) or (float(lk[2]) > 0.0 and Vector2(x - float(lk[0]), z - float(lk[1])).length() < float(lk[2]) * 1.5)
		if inside and world.height(x, z) < float(lk[3]):
			return float(lk[3])
	return -INF

# ------------------------------------------------------------------ grass
func _cover() -> void:
	var specs := [
		{"tex": "res://textures/v8/g_grass.png", "spacing": 0.5, "size": 0.62, "hs": 0.42, "w": Vector4(1.2, 1.4, 0.15, 0.05), "tint": Color(0.82, 0.92, 0.72)},
		{"tex": "res://textures/v8/g_grass_tall.png", "spacing": 1.6, "size": 0.9, "hs": 0.75, "w": Vector4(0.15, 1.1, 0.05, 0.0), "tint": Color(0.85, 0.92, 0.75)},
		{"tex": "res://textures/v8/g_flowers.png", "spacing": 1.9, "size": 0.7, "hs": 0.7, "w": Vector4(0.5, 0.9, 0.0, 0.0), "tint": Color(1, 1, 1)},
		{"tex": "res://textures/v8/g_fern.png", "spacing": 1.4, "size": 0.95, "hs": 0.8, "w": Vector4(0.0, 0.2, 1.4, 0.0), "tint": Color(0.85, 0.92, 0.8)},
	]
	var q := int(Settings.get_v("vegetation"))
	for s in specs:
		var m := ShaderMaterial.new()
		m.shader = load("res://shaders/ground_cover.gdshader")
		world.apply_ground_params(m)
		m.set_shader_parameter("card_tex", load(s["tex"]))
		m.set_shader_parameter("flat_cards", false)
		m.set_shader_parameter("spacing", s["spacing"])
		m.set_shader_parameter("size", s["size"])
		m.set_shader_parameter("height_scale", s["hs"])
		m.set_shader_parameter("density_w", s["w"])
		m.set_shader_parameter("tint", s["tint"])
		m.set_shader_parameter("kill_b", Vector4(0.5, 0.45, 0.45, 0.28))
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = _cover_mesh()
		mm.custom_aabb = AABB(Vector3(-5000, -500, -5000), Vector3(10000, 3000, 10000))
		var nn: int = [40, 56, 72][q] if float(s["spacing"]) < 0.8 else [28, 36, 44][q]
		mm.instance_count = nn * nn
		var buf := PackedFloat32Array()
		buf.resize(nn * nn * 12)
		for k in nn * nn:
			var o := k * 12
			buf[o] = 1.0
			buf[o + 5] = 1.0
			buf[o + 10] = 1.0
		mm.buffer = buf
		m.set_shader_parameter("grid_n", nn)
		m.set_shader_parameter("max_dist", nn * float(s["spacing"]) * 0.5)
		var mmi := MultiMeshInstance3D.new()
		mmi.multimesh = mm
		mmi.material_override = m
		mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(mmi)
		cover.append(mmi)
		cover_mats.append(m)

func _cover_mesh() -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for q in 2:
		var a := q * PI * 0.5
		var dx := Vector3(cos(a), 0.0, sin(a)) * 0.5
		var v := [-dx, dx, dx + Vector3.UP, -dx + Vector3.UP]
		var uv := [Vector2(0, 1), Vector2(1, 1), Vector2(1, 0), Vector2(0, 0)]
		for k in [0, 2, 1, 0, 3, 2]:
			st.set_normal(Vector3.UP)
			st.set_uv(uv[k])
			st.add_vertex(v[k])
	return st.commit()

# ------------------------------------------------------------------ streaming around the player
func update(focus: Vector3, delta: float, force := false) -> void:
	for i in cover_mats.size():
		var sp: float = cover_mats[i].get_shader_parameter("spacing")
		cover_mats[i].set_shader_parameter("grid_origin", Vector3(floor(focus.x / sp) * sp, 0.0, floor(focus.z / sp) * sp))
	_animate_doors(delta)
	if loot:
		loot.update(world.phys_focus if world.phys_set else focus, delta, world.get_node_or_null("Player") as Player)
	if force or focus.distance_to(_tfocus) > REBUILD_STEP:
		_tfocus = focus
		_rebuild_trees(focus)
	if force or focus.distance_to(_bfocus) > REBUILD_STEP:
		_bfocus = focus
		_rebuild_buildings(focus)
	_t -= delta
	if _t > 0.0 and not force:
		return
	_t = 0.3
	if not force and focus.distance_to(_focus) < 4.0:
		return
	_focus = focus
	_stream_colliders(focus)
	_stream_tree_bodies(focus)

func _keys_around(p: Vector3, size: float, r: float) -> Array[Vector2i]:
	var out: Array[Vector2i] = []
	for j in range(floori((p.z - r) / size), floori((p.z + r) / size) + 1):
		for i in range(floori((p.x - r) / size), floori((p.x + r) / size) + 1):
			out.append(Vector2i(i, j))
	return out

## colliders and doors of the buildings close by
func _stream_colliders(p: Vector3) -> void:
	for i in bodies.keys():
		if bxf[i].origin.distance_to(p) > 140.0:
			_free_body(bodies[i])
			bodies.erase(i)
	for k in _keys_around(p, B_CH_HI, 110.0):
		if not bchunk_hi.has(k):
			continue
		for i in bchunk_hi[k]:
			if bodies.has(i) or bxf[i].origin.distance_to(p) > 110.0:
				continue
			bodies[i] = _building_body(i)
	for key in doors.keys():
		var d: Dictionary = doors[key]
		if (d["hinge"] as Vector3).distance_to(p) > 70.0:
			(d["node"] as Node).queue_free()
			doors.erase(key)
	for k in _keys_around(p, B_CH_HI, 55.0):
		if not bchunk_hi.has(k):
			continue
		for i in bchunk_hi[k]:
			if bxf[i].origin.distance_to(p) > 55.0:
				continue
			var dl: Array = pref[btype[i]]["doors"]
			for di in dl.size():
				var key := "%d:%d" % [i, di]
				if not doors.has(key):
					_make_door(i, di, dl[di])

func _building_body(i: int) -> RID:
	var body := PhysicsServer3D.body_create()
	PhysicsServer3D.body_set_mode(body, PhysicsServer3D.BODY_MODE_STATIC)
	var cols: Array = pref[btype[i]]["cols"]
	var shs: Array[RID] = []
	body_shapes[body] = shs
	for c in cols:
		var sh := PhysicsServer3D.box_shape_create()
		shs.append(sh)
		PhysicsServer3D.shape_set_data(sh, Vector3(maxf(float(c[3]), 0.02), maxf(float(c[4]), 0.02), maxf(float(c[5]), 0.02)) * 0.5)
		var t := Transform3D(Basis.from_euler(Vector3(c[6], c[7], c[8])), Vector3(c[0], c[1], c[2]))
		PhysicsServer3D.body_add_shape(body, sh, bxf[i] * t)
	PhysicsServer3D.body_set_collision_layer(body, 2)
	PhysicsServer3D.body_set_collision_mask(body, 0)
	PhysicsServer3D.body_attach_object_instance_id(body, get_instance_id())
	PhysicsServer3D.body_set_space(body, get_world_3d().space)
	return body

func _make_door(i: int, di: int, d: Array) -> void:
	var key := "%d:%d" % [i, di]
	var w: float = d[3]
	var h: float = d[4]
	var pivot := Node3D.new()
	add_child(pivot)
	var hinge := bxf[i] * Vector3(d[0], d[1], d[2])
	pivot.global_transform = Transform3D(bxf[i].basis * Basis(Vector3.UP, float(d[5])), hinge)
	var body := AnimatableBody3D.new()
	body.sync_to_physics = false
	body.collision_layer = 2
	body.collision_mask = 0
	pivot.add_child(body)
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = Vector3(w, h, 0.05)
	cs.shape = bs
	cs.position = Vector3(w * 0.5, h * 0.5, 0)
	body.add_child(cs)
	var mi := MeshInstance3D.new()
	var bm: BoxMesh = door_mesh_cache.get("%.2f|%.2f" % [w, h])
	if bm == null:
		bm = BoxMesh.new()
		bm.size = Vector3(w, h, 0.05)
		bm.material = door_mat
		door_mesh_cache["%.2f|%.2f" % [w, h]] = bm
	mi.mesh = bm
	mi.position = cs.position
	body.add_child(mi)
	var open: bool = door_open.get(key, false)
	var ang := _door_target(open, int(d[6]))
	body.rotation.y = ang
	doors[key] = {"node": pivot, "body": body, "open": open, "angle": ang, "hinge": hinge, "out": int(d[6])}

func _door_target(open: bool, out: int) -> float:
	return (-1.45 if out > 0 else 1.45) if open else 0.0

func _animate_doors(delta: float) -> void:
	for key in doors:
		var d: Dictionary = doors[key]
		var target := _door_target(bool(d["open"]), int(d["out"]))
		var a: float = d["angle"]
		if absf(a - target) > 0.001:
			a = move_toward(a, target, delta * 3.2)
			d["angle"] = a
			(d["body"] as Node3D).rotation.y = a

func toggle_door(key: String) -> bool:
	if not doors.has(key):
		return false
	var d: Dictionary = doors[key]
	d["open"] = not bool(d["open"])
	door_open[key] = d["open"]
	Sfx.play_at("impact_wood", d["hinge"], -10.0, 3.0)
	return bool(d["open"])

## trunks you bump into
func _stream_tree_bodies(p: Vector3) -> void:
	for k in tree_bodies.keys():
		if Vector2((k.x + 0.5) * T_CH_NEAR - p.x, (k.y + 0.5) * T_CH_NEAR - p.z).length() > 200.0:
			_free_body(tree_bodies[k])
			tree_bodies.erase(k)
	for k in _keys_around(p, T_CH_NEAR, 90.0):
		if tree_bodies.has(k) or not tchunk_near.has(k):
			continue
		var body := PhysicsServer3D.body_create()
		PhysicsServer3D.body_set_mode(body, PhysicsServer3D.BODY_MODE_STATIC)
		var shs: Array[RID] = []
		body_shapes[body] = shs
		var d: Dictionary = tchunk_near[k]
		for v in d:
			var info: Dictionary = tinfo[v]
			if bool(info["bush"]):
				continue
			var arr: PackedFloat32Array = d[v]
			for o in range(0, arr.size(), 5):
				var r := maxf(float(info["trunkR"]) * arr[o + 4] * 0.85, 0.12)
				var cap := PhysicsServer3D.capsule_shape_create()
				shs.append(cap)
				PhysicsServer3D.shape_set_data(cap, {"radius": r, "height": 7.0})
				PhysicsServer3D.body_add_shape(body, cap, Transform3D(Basis(), Vector3(arr[o], arr[o + 1] + 3.5, arr[o + 2])))
		PhysicsServer3D.body_set_collision_layer(body, 2)
		PhysicsServer3D.body_set_collision_mask(body, 0)
		PhysicsServer3D.body_attach_object_instance_id(body, get_instance_id())
		PhysicsServer3D.body_set_space(body, get_world_3d().space)
		tree_bodies[k] = body

func set_quality(_q: int, _vd: int) -> void:
	var old := _qkey
	_apply_quality()
	if old == _qkey or bxf.is_empty():
		return
	for m in mat_ring:
		_window(m)
	_imp_windows()
	if _ivy_m:
		(_ivy_m.surface_get_material(0) as ShaderMaterial).set_shader_parameter("cut_far", ring_b[0] + 20.0)
	update(_tfocus if _tfocus.x < 1e8 else world.focus, 0.0, true)

# ------------------------------------------------------------------ what Props answers on the trench map
func surface_of(_rid: RID, _shape: int) -> String:
	return "wood"

func hit_plate(_rid: RID, _dir: Vector3) -> bool:
	return false

func toggle_lamp(_i: int) -> bool:
	return false

func _city_grid() -> void:
	var t0 := Time.get_ticks_msec()
	grid_n = int(GRID_HALF * 2.0 / GRID_CELL)
	roof.resize(grid_n * grid_n)
	roof.fill(0)
	for i in bxf.size():
		var o := bxf[i].origin
		if absf(o.x) > GRID_HALF + 40.0 or absf(o.z) > GRID_HALF + 40.0:
			continue
		var pf: Dictionary = pref[btype[i]]
		var hw := float(pf["w"]) * 0.5
		var hd := float(pf["d"]) * 0.5
		var h := clampi(int(float(pf["h"]) * 4.0), 1, 255)
		var inv := bxf[i].affine_inverse()
		var r := sqrt(hw * hw + hd * hd) * bxf[i].basis.get_scale().x + GRID_CELL
		var x0 := clampi(floori((o.x - r + GRID_HALF) / GRID_CELL), 0, grid_n - 1)
		var x1 := clampi(floori((o.x + r + GRID_HALF) / GRID_CELL), 0, grid_n - 1)
		var z0 := clampi(floori((o.z - r + GRID_HALF) / GRID_CELL), 0, grid_n - 1)
		var z1 := clampi(floori((o.z + r + GRID_HALF) / GRID_CELL), 0, grid_n - 1)
		for gz in range(z0, z1 + 1):
			for gx in range(x0, x1 + 1):
				var lp := inv * Vector3(-GRID_HALF + (gx + 0.5) * GRID_CELL, o.y, -GRID_HALF + (gz + 0.5) * GRID_CELL)
				if absf(lp.x) < hw + 0.3 and absf(lp.z) < hd + 0.3:
					var k := gz * grid_n + gx
					if roof[k] < h:
						roof[k] = h
	print("VALLEY city grid %d x %d in %d ms" % [grid_n, grid_n, Time.get_ticks_msec() - t0])

## the height of the building standing at this point over the ground (0 in the open; the city only)
func roof_at(x: float, z: float) -> float:
	var gx := floori((x + GRID_HALF) / GRID_CELL)
	var gz := floori((z + GRID_HALF) / GRID_CELL)
	if gx < 0 or gz < 0 or gx >= grid_n or gz >= grid_n:
		return 0.0
	return roof[gz * grid_n + gx] * 0.25

## open ground here and around (no walls within `margin` metres, no water)
func open_at(x: float, z: float, margin := 2.0) -> bool:
	var m := ceili(margin / GRID_CELL)
	var gx := floori((x + GRID_HALF) / GRID_CELL)
	var gz := floori((z + GRID_HALF) / GRID_CELL)
	for j in range(gz - m, gz + m + 1):
		for i in range(gx - m, gx + m + 1):
			if i >= 0 and j >= 0 and i < grid_n and j < grid_n and roof[j * grid_n + i] > 0:
				return false
	return water_level(x, z) == -INF

## x = how far inside a building the point is (0 outside, 1 well inside), for the light and the sound
func inside_factor(p: Vector3) -> Vector2:
	var k := Vector2i(floori(p.x / B_CH_HI), floori(p.z / B_CH_HI))
	for dj in range(-1, 2):
		for di in range(-1, 2):
			var kk := k + Vector2i(di, dj)
			if not bchunk_hi.has(kk):
				continue
			for i in bchunk_hi[kk]:
				var pf: Dictionary = pref[btype[i]]
				var lp := bxf[i].affine_inverse() * p
				var hw := float(pf["w"]) * 0.5 - 0.3
				var hd := float(pf["d"]) * 0.5 - 0.3
				if absf(lp.x) < hw and absf(lp.z) < hd and lp.y > -0.5 and lp.y < float(pf["h"]):
					var edge := minf(hw - absf(lp.x), hd - absf(lp.z))
					return Vector2(clampf(edge / 1.5, 0.0, 1.0) * 0.8, 0.0)
	return Vector2.ZERO

## doors within reach, in front of the eyes
func interactable_near(from: Vector3, fwd: Vector3) -> Dictionary:
	var best := {}
	var bd := 2.4
	for key in doors:
		var d: Dictionary = doors[key]
		var body := d["body"] as Node3D
		var c := body.global_transform * Vector3(0.45, 1.0, 0.0)
		var to := c - from
		var dist := to.length()
		if dist < bd and to.normalized().dot(fwd) > 0.3:
			bd = dist
			best = {"kind": "door", "key": key, "pos": c, "open": d["open"]}
	return best
