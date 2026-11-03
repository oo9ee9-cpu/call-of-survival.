class_name Terrain
extends Node3D
## Geometry clipmap (the shader reads the height textures) + collision tiles streamed around the player.

const S0 := 0.25
const WAR_TILE := 128        # texels per war collision tile (32 m)
const BASE_TILE := 32        # texels per base collision tile (64 m)

var world: Node
var M := 64
var levels := 9
var mat: ShaderMaterial
var lv_nodes: Array = []
var centers := PackedVector2Array()
var base_img: Image
var war_img: Image
var tiles := {}
var _tile_t := 0.0
var shadows := false

func setup(w: Node, base: Image, war: Image, m_cells: int, nlev: int) -> void:
	world = w
	base_img = base
	war_img = war
	M = m_cells
	levels = nlev
	mat = ShaderMaterial.new()
	mat.shader = load("res://shaders/terrain_clip.gdshader")
	world.apply_ground_params(mat)
	mat.set_shader_parameter("clip_m", float(M))
	mat.set_shader_parameter("s0", S0)
	centers.resize(12)
	_build()

func _build() -> void:
	for n in get_children():
		n.queue_free()
	lv_nodes.clear()
	var h := M / 2
	var full := _grid(-M, -M, 2 * M, 2 * M, Vector2i(1 << 20, 1 << 20), Vector2i(1 << 20, 1 << 20))
	var ring := _grid(-M, -M, 2 * M, 2 * M, Vector2i(-h, -h), Vector2i(h + 1, h + 1))
	var vstrip := _grid(0, 0, 1, M + 1, Vector2i(1 << 20, 1 << 20), Vector2i(1 << 20, 1 << 20))
	var hstrip := _grid(0, 0, M, 1, Vector2i(1 << 20, 1 << 20), Vector2i(1 << 20, 1 << 20))
	for L in levels:
		var s := S0 * pow(2.0, L)
		var a := _inst(full if L == 0 else ring, s, L)
		var b: MeshInstance3D = null
		var c: MeshInstance3D = null
		if L > 0:
			b = _inst(vstrip, s, L)
			c = _inst(hstrip, s, L)
		lv_nodes.append([a, b, c])

func set_quality(m_cells: int, nlev: int, cast_shadows: bool) -> void:
	shadows = cast_shadows
	if m_cells != M or nlev != levels:
		M = m_cells
		levels = nlev
		mat.set_shader_parameter("clip_m", float(M))
		_build()
	for L in lv_nodes.size():
		for n in lv_nodes[L]:
			if n:
				(n as MeshInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if (shadows and L <= 2) else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

## grid of nx * nz cells starting at (i0, j0); cells inside [hmin, hmax) are left out
func _grid(i0: int, j0: int, nx: int, nz: int, hmin: Vector2i, hmax: Vector2i) -> ArrayMesh:
	var verts := PackedVector3Array()
	var norms := PackedVector3Array()
	verts.resize((nx + 1) * (nz + 1))
	norms.resize(verts.size())
	var k := 0
	for j in nz + 1:
		for i in nx + 1:
			verts[k] = Vector3(i0 + i, 0.0, j0 + j)
			norms[k] = Vector3.UP
			k += 1
	var idx := PackedInt32Array()
	idx.resize(nx * nz * 6)
	var n := 0
	var row := nx + 1
	for j in nz:
		var cj := j0 + j
		var hole_row := cj >= hmin.y and cj < hmax.y
		for i in nx:
			var ci := i0 + i
			if hole_row and ci >= hmin.x and ci < hmax.x:
				continue
			var a := j * row + i
			var b := a + 1
			var c := a + row
			var d := c + 1
			idx[n] = a; idx[n + 1] = b; idx[n + 2] = d
			idx[n + 3] = a; idx[n + 4] = d; idx[n + 5] = c
			n += 6
	idx.resize(n)
	var arr := []
	arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = verts
	arr[Mesh.ARRAY_NORMAL] = norms
	arr[Mesh.ARRAY_INDEX] = idx
	var m := ArrayMesh.new()
	m.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	m.custom_aabb = AABB(Vector3(i0, -400.0, j0), Vector3(nx, 2000.0, nz))
	return m

func _inst(mesh: ArrayMesh, s: float, L: int) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = mat
	mi.scale = Vector3(s, 1.0, s)
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if (shadows and L <= 2) else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.gi_mode = GeometryInstance3D.GI_MODE_DISABLED
	add_child(mi)
	return mi

func update_view(cam: Vector3) -> void:
	for L in levels:
		var s2 := S0 * pow(2.0, L) * 2.0
		centers[L] = Vector2(floor(cam.x / s2) * s2, floor(cam.z / s2) * s2)
	var h := M / 2
	for L in levels:
		var s := S0 * pow(2.0, L)
		var c := centers[L]
		var nodes: Array = lv_nodes[L]
		(nodes[0] as Node3D).position = Vector3(c.x, 0.0, c.y)
		if L > 0:
			var pc := centers[L - 1]
			var dx := int(round((pc.x - c.x) / s))
			var dz := int(round((pc.y - c.y) / s))
			var vx := h if dx == 0 else -h
			var hz := h if dz == 0 else -h
			(nodes[1] as Node3D).position = Vector3(c.x + vx * s, 0.0, c.y - h * s)
			(nodes[2] as Node3D).position = Vector3(c.x + (dx - h) * s, 0.0, c.y + hz * s)
	mat.set_shader_parameter("centers", centers)

# ------------------------------------------------------------------ collision tiles
func update_collision(p: Vector3, delta: float, force := false) -> void:
	_tile_t -= delta
	if _tile_t > 0.0 and not force:
		return
	_tile_t = 0.3
	var need := {}
	var wsp: float = world.war_sp
	var bsp: float = world.base_sp
	var wx0: float = world.war_x0
	var bx0: float = world.base_x0
	var wtm := WAR_TILE * wsp
	var btm := BASE_TILE * bsp
	var wmax := int((world.war_n - 1) / WAR_TILE) - 1
	var bmax := int((world.base_n - 1) / BASE_TILE) - 1
	var war_size: float = (world.war_n - 1) * wsp
	# detail (war) area: 128-texel tiles
	var rw := 56.0
	for tj in range(int(floor((p.z - rw - wx0) / wtm)), int(floor((p.z + rw - wx0) / wtm)) + 1):
		for ti in range(int(floor((p.x - rw - wx0) / wtm)), int(floor((p.x + rw - wx0) / wtm)) + 1):
			if ti < 0 or tj < 0 or ti > wmax or tj > wmax:
				continue
			need["w%d,%d" % [ti, tj]] = Vector3i(0, ti, tj)
	# everywhere else: 32-texel tiles of the base grid
	var rb := 140.0
	for tj in range(int(floor((p.z - rb - bx0) / btm)), int(floor((p.z + rb - bx0) / btm)) + 1):
		for ti in range(int(floor((p.x - rb - bx0) / btm)), int(floor((p.x + rb - bx0) / btm)) + 1):
			if ti < 0 or tj < 0 or ti > bmax or tj > bmax:
				continue
			var tx0 := bx0 + ti * btm
			var tz0 := bx0 + tj * btm
			if tx0 >= wx0 and tx0 + btm <= wx0 + war_size and tz0 >= wx0 and tz0 + btm <= wx0 + war_size:
				continue   # covered by the detail tiles
			need["b%d,%d" % [ti, tj]] = Vector3i(1, ti, tj)
	for k in tiles.keys():
		if not need.has(k):
			PhysicsServer3D.free_rid(tiles[k]["body"])
			tiles.erase(k)
	for k in need:
		if tiles.has(k):
			continue
		var t: Vector3i = need[k]
		var img: Image
		var sp: float
		var x0: float
		var z0: float
		var n: int
		if t.x == 0:
			n = WAR_TILE
			img = war_img.get_region(Rect2i(t.y * n, t.z * n, n + 1, n + 1))
			sp = wsp
			x0 = wx0 + t.y * wtm
			z0 = wx0 + t.z * wtm
		else:
			n = BASE_TILE
			img = base_img.get_region(Rect2i(t.y * n, t.z * n, n + 1, n + 1))
			sp = bsp
			x0 = bx0 + t.y * btm
			z0 = bx0 + t.z * btm
		var sh := HeightMapShape3D.new()
		sh.update_map_data_from_image(img, 0.0, 1.0 / sp)
		var body := PhysicsServer3D.body_create()
		PhysicsServer3D.body_set_mode(body, PhysicsServer3D.BODY_MODE_STATIC)
		var half := n * sp * 0.5
		PhysicsServer3D.body_add_shape(body, sh.get_rid(), Transform3D(Basis.from_scale(Vector3(sp, sp, sp)), Vector3(x0 + half, 0.0, z0 + half)))
		PhysicsServer3D.body_set_collision_layer(body, 1)
		PhysicsServer3D.body_set_collision_mask(body, 0)
		PhysicsServer3D.body_attach_object_instance_id(body, get_instance_id())
		PhysicsServer3D.body_set_space(body, get_world_3d().space)
		tiles[k] = {"body": body, "shape": sh}

func _exit_tree() -> void:
	for k in tiles:
		PhysicsServer3D.free_rid(tiles[k]["body"])
	tiles.clear()
