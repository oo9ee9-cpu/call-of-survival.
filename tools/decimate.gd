extends SceneTree
## A lighter copy of a static glTF model: every surface takes the level of detail (Godot's own maker, meshoptimizer)
## whose triangle count is nearest to `ratio` of the full one; materials and textures carried over (textures as JPEG).
## Textures larger than [max_px] (default 1024) are scaled down: a prop seen across a street needs no 4K maps.
## usage: godot --headless --script tools/decimate.gd -- <in.glb> <out.glb> <ratio> [max_px]

func _init() -> void:
	var args := OS.get_cmdline_user_args()
	var ratio := float(args[2])
	var max_px := int(args[3]) if args.size() > 3 else 1024
	var doc := GLTFDocument.new()
	var st := GLTFState.new()
	if doc.append_from_file(args[0], st) != OK:
		push_error("cannot read " + args[0])
		quit(1)
		return
	var root := Node3D.new()
	root.name = args[1].get_file().get_basename()
	var full := 0
	var cut := 0
	for gm in st.get_meshes():
		var im: ImporterMesh = (gm as GLTFMesh).mesh
		im.generate_lods(60.0, 25.0, [])
		var am := ArrayMesh.new()
		for s in im.get_surface_count():
			var arr := im.get_surface_arrays(s)
			var idx: PackedInt32Array = arr[Mesh.ARRAY_INDEX]
			var want := int(idx.size() / 3 * ratio)
			var best := idx
			for l in im.get_surface_lod_count(s):
				var li := im.get_surface_lod_indices(s, l)
				if absi(li.size() / 3 - want) < absi(best.size() / 3 - want):
					best = li
			full += idx.size() / 3
			cut += best.size() / 3
			arr = _compact(arr, best)
			am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
			am.surface_set_material(am.get_surface_count() - 1, _small(im.get_surface_material(s), max_px))
		var mi := MeshInstance3D.new()
		mi.name = String(gm.resource_name) if gm.resource_name != "" else "mesh"
		mi.mesh = am
		root.add_child(mi)
		mi.owner = root
	# the nodes' own transforms (the file's meshes may sit under moved nodes)
	var nodes := st.get_nodes()
	var meshes_by_node := {}
	for i in nodes.size():
		var n: GLTFNode = nodes[i]
		if n.mesh >= 0:
			meshes_by_node[n.mesh] = _global(nodes, i)
	var k := 0
	for c in root.get_children():
		if meshes_by_node.has(k):
			(c as Node3D).transform = meshes_by_node[k]
		k += 1
	var out := GLTFDocument.new()
	out.image_format = "JPEG"
	out.lossy_quality = 0.85
	var st2 := GLTFState.new()
	if out.append_from_scene(root, st2) != OK or out.write_to_filesystem(st2, args[1]) != OK:
		push_error("cannot write " + args[1])
		quit(1)
		return
	print("%s: %d -> %d triangles" % [args[1].get_file(), full, cut])
	quit()

var _done := {}

## the surface keeping only the vertices the simplified triangles use
func _compact(arr: Array, idx: PackedInt32Array) -> Array:
	var verts: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
	var n := verts.size()
	var remap := PackedInt32Array()
	remap.resize(n)
	remap.fill(-1)
	var order := PackedInt32Array()
	for i in idx:
		if remap[i] < 0:
			remap[i] = order.size()
			order.append(i)
	var new_idx := PackedInt32Array()
	new_idx.resize(idx.size())
	for k in idx.size():
		new_idx[k] = remap[idx[k]]
	var out := arr.duplicate()
	for a in Mesh.ARRAY_MAX:
		if a == Mesh.ARRAY_INDEX or arr[a] == null or n == 0:
			continue
		var src = arr[a]
		var per: int = src.size() / n
		var dst = src.duplicate()
		dst.resize(order.size() * per)
		for j in order.size():
			for c in per:
				dst[j * per + c] = src[order[j] * per + c]
		out[a] = dst
	out[Mesh.ARRAY_INDEX] = new_idx
	return out

## the material with its textures no larger than max_px (each texture scaled once)
func _small(m: Material, max_px: int) -> Material:
	if not (m is BaseMaterial3D):
		return m
	var bm := m as BaseMaterial3D
	for slot in [BaseMaterial3D.TEXTURE_ALBEDO, BaseMaterial3D.TEXTURE_NORMAL, BaseMaterial3D.TEXTURE_ORM,
			BaseMaterial3D.TEXTURE_METALLIC, BaseMaterial3D.TEXTURE_ROUGHNESS, BaseMaterial3D.TEXTURE_EMISSION,
			BaseMaterial3D.TEXTURE_AMBIENT_OCCLUSION]:
		var t := bm.get_texture(slot)
		if t == null:
			continue
		if not _done.has(t):
			var img := t.get_image()
			if img and maxi(img.get_width(), img.get_height()) > max_px:
				img = img.duplicate()
				if img.is_compressed():
					img.decompress()
				var k := float(max_px) / maxi(img.get_width(), img.get_height())
				img.resize(maxi(int(img.get_width() * k), 1), maxi(int(img.get_height() * k), 1), Image.INTERPOLATE_LANCZOS)
				_done[t] = ImageTexture.create_from_image(img)
			else:
				_done[t] = t
		bm.set_texture(slot, _done[t])
	return bm

func _global(nodes: Array, i: int) -> Transform3D:
	var n: GLTFNode = nodes[i]
	var xf := n.xform
	if n.parent >= 0:
		return _global(nodes, n.parent) * xf
	return xf
