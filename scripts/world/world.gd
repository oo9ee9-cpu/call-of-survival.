class_name World
extends Node3D
## Loads the baked map and builds everything in it. Also answers questions about the ground (height, surface, rays).

signal progress(frac: float, text: String)

const WAR_N := 2049
const BASE_N := 1537

var lay: Dictionary
var base_img: Image
var war_img: Image
var base_f: PackedFloat32Array
var war_f: PackedFloat32Array
var base_tex: ImageTexture
var war_tex: ImageTexture
var terrain: Terrain
var veg: Veg
var props: Props
var env: Env
var battle: Battle
var fx: Fx
var mats := {}
var tex := {}
var _mesh_cache := {}
var ready_built := false
var focus := Vector3.ZERO      # where the active camera is

func build() -> void:
	_p(0.02, "تحميل بيانات الخريطة…")
	await get_tree().process_frame
	lay = (load("res://data/world.res") as Resource).get_meta("layout")
	base_img = load("res://data/base_h.res") as Image
	war_img = load("res://data/war_h.res") as Image
	base_f = base_img.get_data().to_float32_array()
	war_f = war_img.get_data().to_float32_array()
	base_tex = ImageTexture.create_from_image(base_img)
	war_tex = ImageTexture.create_from_image(war_img)
	_p(0.12, "تجهيز المواد…")
	await get_tree().process_frame
	_load_textures()
	_build_materials()
	_p(0.2, "بناء الأرض…")
	await get_tree().process_frame
	terrain = Terrain.new()
	terrain.name = "Terrain"
	add_child(terrain)
	var q := int(Settings.get_v("quality"))
	terrain.setup(self, base_img, war_img, [40, 48, 64, 64][q], [9, 9, 9, 10][q])
	env = Env.new()
	env.name = "Env"
	add_child(env)
	env.setup(self)
	_p(0.3, "زراعة الغابة المحروقة…")
	await get_tree().process_frame
	veg = Veg.new()
	veg.name = "Veg"
	add_child(veg)
	veg.setup(self)
	_p(0.5, "حفر الخنادق وبناء الملاجئ…")
	await get_tree().process_frame
	props = Props.new()
	props.name = "Props"
	add_child(props)
	await props.setup(self)
	_p(0.85, "المؤثرات والأصوات…")
	await get_tree().process_frame
	fx = Fx.new()
	fx.name = "Fx"
	add_child(fx)
	fx.setup(self)
	battle = Battle.new()
	battle.name = "Battle"
	add_child(battle)
	battle.setup(self)
	apply_settings()
	Settings.changed.connect(_on_setting)
	_p(0.95, "اللمسات الأخيرة…")
	await get_tree().process_frame
	focus = spawn_point()[0]
	terrain.update_view(focus)
	terrain.update_collision(focus, 1.0, true)
	veg.update(focus, 1.0, true)
	ready_built = true
	_p(1.0, "")

func _p(f: float, t: String) -> void:
	progress.emit(f, t)

func _process(delta: float) -> void:
	if not ready_built:
		return
	var cam := get_viewport().get_camera_3d()
	if cam:
		focus = cam.global_position
	RenderingServer.global_shader_parameter_set("view_pos", focus)
	terrain.update_view(focus)
	terrain.update_collision(focus, delta)
	veg.update(focus, delta)
	props.update(focus, delta)

func spawn_point() -> Array:
	var s: Array = lay["spawn"]
	return [Vector3(s[0], s[1] + 0.05, s[2]), float(s[3])]

# ------------------------------------------------------------------ settings
func _on_setting(_k: String) -> void:
	apply_settings()

func apply_settings() -> void:
	var q := int(Settings.get_v("quality"))
	var vd := int(Settings.get_v("view_distance"))
	var sh := int(Settings.get_v("shadows"))
	terrain.set_quality([40, 48, 64, 64][q], [9, 9, 9, 10][q] + (1 if vd == 2 and q < 3 else 0), sh >= 2 and q >= 2)
	veg.set_quality(q, int(Settings.get_v("vegetation")), vd)
	props.set_quality(q, vd)
	env.apply_settings()
	var vp := get_viewport()
	var rs := float(Settings.get_v("render_scale"))
	vp.scaling_3d_scale = rs
	var method := RenderingServer.get_current_rendering_method()
	if rs < 0.99 and method != "gl_compatibility":
		vp.scaling_3d_mode = Viewport.SCALING_3D_MODE_FSR
		vp.fsr_sharpness = 0.35
	else:
		vp.scaling_3d_mode = Viewport.SCALING_3D_MODE_BILINEAR
	if method == "gl_compatibility":
		vp.msaa_3d = [Viewport.MSAA_DISABLED, Viewport.MSAA_2X, Viewport.MSAA_4X, Viewport.MSAA_4X][q]
	else:
		vp.msaa_3d = [Viewport.MSAA_DISABLED, Viewport.MSAA_DISABLED, Viewport.MSAA_2X, Viewport.MSAA_4X][q]
		vp.screen_space_aa = Viewport.SCREEN_SPACE_AA_FXAA if q < 2 else Viewport.SCREEN_SPACE_AA_DISABLED
	RenderingServer.directional_shadow_atlas_set_size([1024, 2048, 4096][clampi(sh, 0, 2)], true)

# ------------------------------------------------------------------ ground queries
func _bil(a: PackedFloat32Array, n: int, fx: float, fz: float) -> float:
	fx = clampf(fx, 0.0, n - 1.0005)
	fz = clampf(fz, 0.0, n - 1.0005)
	var ix := int(fx)
	var iz := int(fz)
	var tx := fx - ix
	var tz := fz - iz
	var i := iz * n + ix
	return lerpf(lerpf(a[i], a[i + 1], tx), lerpf(a[i + n], a[i + n + 1], tx), tz)

func height(x: float, z: float) -> float:
	if x >= -256.0 and x <= 256.0 and z >= -256.0 and z <= 256.0:
		return _bil(war_f, WAR_N, (x + 256.0) * 4.0, (z + 256.0) * 4.0)
	return _bil(base_f, BASE_N, (x + 1536.0) * 0.5, (z + 1536.0) * 0.5)

func base_height(x: float, z: float) -> float:
	return _bil(base_f, BASE_N, (x + 1536.0) * 0.5, (z + 1536.0) * 0.5)

func dig_depth(x: float, z: float) -> float:
	if absf(x) > 256.0 or absf(z) > 256.0:
		return 0.0
	return maxf(base_height(x, z) - height(x, z), 0.0)

func normal_at(x: float, z: float) -> Vector3:
	var e := 0.3
	return Vector3(height(x - e, z) - height(x + e, z), 2.0 * e, height(x, z - e) - height(x, z + e)).normalized()

## ray against the height field (used past the streamed collision tiles)
func ray_ground(from: Vector3, dir: Vector3, max_d: float) -> Dictionary:
	var t := 0.0
	var step := 0.4
	var prev := 0.0
	while t < max_d:
		var p := from + dir * t
		if absf(p.x) > 1540.0 or absf(p.z) > 1540.0:
			return {}
		if p.y < height(p.x, p.z):
			var lo := prev
			var hi := t
			for i in 10:
				var m := (lo + hi) * 0.5
				var q := from + dir * m
				if q.y < height(q.x, q.z):
					hi = m
				else:
					lo = m
			var hp := from + dir * hi
			return {"position": hp, "normal": normal_at(hp.x, hp.z), "surface": surface_at(hp)}
		prev = t
		t += step
		step = minf(step * 1.04 + 0.01, 3.0)
	return {}

## what the ground is made of at a point: "mud", "dirt", "needles", "water", "wood", "metal", "bag"
func surface_at(p: Vector3) -> String:
	if props and props.water_at(p):
		return "water"
	var dg := dig_depth(p.x, p.z)
	if dg > 0.9:
		return "mud"
	var u := clampf((p.x + 256.0) / 512.0, 0.0, 1.0)
	if absf(p.x) < 256.0 and absf(p.z) < 256.0 and tex.has("splat_wb"):
		var img: Image = tex["splat_wb_img"]
		var c := img.get_pixel(int(u * 1023), int(clampf((p.z + 256.0) / 512.0, 0.0, 1.0) * 1023))
		if c.r > 0.45:
			return "mud"
	return "dirt" if dg > 0.05 else "needles"

# ------------------------------------------------------------------ textures and materials
func _t(path: String) -> Texture2D:
	if not tex.has(path):
		tex[path] = load(path)
	return tex[path]

func _load_textures() -> void:
	tex["t_alb"] = load("res://textures/terrain/terrain_albedo.jpg")
	tex["t_nrh"] = load("res://textures/terrain/terrain_nrh.png")
	for s in ["splat_base_a", "splat_base_b", "splat_war_a", "splat_war_b"]:
		tex[s] = load("res://textures/terrain/%s.png" % s)
	tex["splat_wb"] = tex["splat_war_b"]
	tex["splat_wb_img"] = (tex["splat_war_b"] as Texture2D).get_image()
	if tex["splat_wb_img"] and (tex["splat_wb_img"] as Image).is_compressed():
		(tex["splat_wb_img"] as Image).decompress()
	tex["noise"] = load("res://textures/fx/noise.png")

## the ground's textures and height maps, shared by every shader that includes terrain_inc
func apply_ground_params(m: ShaderMaterial) -> void:
	m.set_shader_parameter("base_h", base_tex)
	m.set_shader_parameter("war_h", war_tex)
	m.set_shader_parameter("t_alb", tex["t_alb"])
	m.set_shader_parameter("t_nrh", tex["t_nrh"])
	m.set_shader_parameter("splat_ba", tex["splat_base_a"])
	m.set_shader_parameter("splat_bb", tex["splat_base_b"])
	m.set_shader_parameter("splat_wa", tex["splat_war_a"])
	m.set_shader_parameter("splat_wb", tex["splat_war_b"])
	m.set_shader_parameter("noise_tex", tex["noise"])

func _prop_mat(alb: String, nrh: String, tint := Color(1, 1, 1), metallic := 0.0, rough_mul := 1.0) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = load("res://shaders/prop.gdshader")
	m.set_shader_parameter("alb_tex", _t(alb))
	if nrh != "":
		m.set_shader_parameter("nrh_tex", _t(nrh))
	else:
		m.set_shader_parameter("has_nrh", false)
	m.set_shader_parameter("tint", tint)
	m.set_shader_parameter("metallic", metallic)
	m.set_shader_parameter("rough_mul", rough_mul)
	return m

func _card_mat(texp: String, tint: Color, transl: float, flutter: float, cut := 0.45) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = load("res://shaders/cards.gdshader")
	m.set_shader_parameter("tex", _t(texp))
	m.set_shader_parameter("tint", tint)
	m.set_shader_parameter("translucency", transl)
	m.set_shader_parameter("flutter", flutter)
	m.set_shader_parameter("alpha_cut", cut)
	return m

func _build_materials() -> void:
	var bark := ShaderMaterial.new()
	bark.shader = load("res://shaders/bark.gdshader")
	bark.set_shader_parameter("bark_alb", _t("res://textures/veg/bark_pine.jpg"))
	bark.set_shader_parameter("bark_nrh", _t("res://textures/veg/bark_pine_nrh.png"))
	bark.set_shader_parameter("bare_alb", _t("res://textures/veg/wood_bare.jpg"))
	bark.set_shader_parameter("bare_nrh", _t("res://textures/veg/wood_bare_nrh.png"))
	bark.set_shader_parameter("noise_tex", tex["noise"])
	mats["bark"] = bark
	mats["bare"] = _prop_mat("res://textures/veg/wood_bare.jpg", "res://textures/veg/wood_bare_nrh.png", Color(0.85, 0.83, 0.8))
	mats["twigs"] = _card_mat("res://textures/veg/twigs.png", Color(0.85, 0.82, 0.8), 0.1, 0.5)
	mats["needles_burnt"] = _card_mat("res://textures/veg/needles_burnt.png", Color(0.9, 0.85, 0.8), 0.25, 1.0)
	mats["needles_live"] = _card_mat("res://textures/veg/needles_live.png", Color(0.85, 0.9, 0.85), 0.35, 1.0)
	var imp := ShaderMaterial.new()
	imp.shader = load("res://shaders/impostor.gdshader")
	imp.set_shader_parameter("tex", _t("res://textures/veg/impostors.png"))
	mats["impostor"] = imp
	mats["planks"] = _prop_mat("res://textures/props/planks.jpg", "res://textures/props/planks_nrh.png")
	mats["logs"] = _prop_mat("res://textures/props/logs.jpg", "res://textures/props/logs_nrh.png", Color(0.72, 0.68, 0.64))
	mats["burlap"] = _prop_mat("res://textures/props/burlap.jpg", "res://textures/props/burlap_nrh.png")
	mats["iron"] = _prop_mat("res://textures/props/iron.jpg", "res://textures/props/iron_nrh.png", Color(1, 1, 1), 0.55)
	mats["galv"] = _prop_mat("res://textures/props/galv.jpg", "res://textures/props/galv_nrh.png", Color(1, 1, 1), 0.65)
	mats["concrete"] = _prop_mat("res://textures/props/galv.jpg", "", Color(0.62, 0.6, 0.56), 0.0, 1.0)
	(mats["concrete"] as ShaderMaterial).set_shader_parameter("rough_add", 0.5)
	mats["olive"] = _prop_mat("res://textures/props/olive.jpg", "res://textures/props/olive_nrh.png", Color(1, 1, 1), 0.25)
	mats["red"] = _prop_mat("res://textures/props/red.jpg", "res://textures/props/red_nrh.png", Color(1, 1, 1), 0.25)
	mats["canvas"] = _prop_mat("res://textures/props/canvas.jpg", "res://textures/props/canvas_nrh.png")
	mats["blanket"] = _prop_mat("res://textures/props/blanket.jpg", "res://textures/props/blanket_nrh.png")
	mats["map"] = _prop_mat("res://textures/props/map.jpg", "", Color(0.9, 0.88, 0.85))
	(mats["map"] as ShaderMaterial).set_shader_parameter("rough_add", 0.8)
	var wire := _card_mat("res://textures/props/wire.png", Color(1, 1, 1), 0.0, 0.0, 0.35)
	wire.set_shader_parameter("wire_mode", true)
	wire.set_shader_parameter("sway", 0.0)
	wire.set_shader_parameter("metallic", 0.6)
	wire.set_shader_parameter("roughness", 0.55)
	mats["wire"] = wire
	for g in [["glass", Color(0.55, 0.6, 0.55, 0.3)], ["glass_green", Color(0.12, 0.28, 0.1, 0.55)]]:
		var gm := StandardMaterial3D.new()
		gm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		gm.albedo_color = g[1]
		gm.roughness = 0.05
		gm.metallic_specular = 0.8
		mats[g[0]] = gm
	var em := StandardMaterial3D.new()
	em.albedo_color = Color(1.0, 0.45, 0.12)
	em.emission_enabled = true
	em.emission = Color(1.0, 0.42, 0.1)
	em.emission_energy_multiplier = 3.0
	mats["ember"] = em
	var por := StandardMaterial3D.new()
	por.albedo_color = Color(0.3, 0.21, 0.15)
	por.roughness = 0.25
	mats["porcelain"] = por
	# indoor copies never get wet in the rain
	for k in ["planks", "logs", "burlap", "iron", "galv", "olive", "red", "canvas", "blanket", "map", "bare", "bark"]:
		var c := (mats[k] as ShaderMaterial).duplicate() as ShaderMaterial
		c.set_shader_parameter("wet_affect", 0.0)
		mats[k + "_in"] = c

func material(name: String, indoor := false) -> Material:
	if indoor and mats.has(name + "_in"):
		return mats[name + "_in"]
	return mats.get(name, null)

## a mesh from a .glb, with the game's materials put on its surfaces (meshes are shared, so this happens once)
func load_mesh(name: String) -> Mesh:
	if _mesh_cache.has(name):
		return _mesh_cache[name]
	var sc := load("res://models/%s.glb" % name) as PackedScene
	if sc == null:
		push_error("missing model " + name)
		return null
	var inst := sc.instantiate()
	var mi := _find_mesh(inst)
	var mesh: Mesh = mi.mesh if mi else null
	inst.free()
	if mesh is ArrayMesh:
		for i in mesh.get_surface_count():
			var sm := mesh.surface_get_material(i)
			var rep := material(sm.resource_name if sm else "")
			if rep:
				(mesh as ArrayMesh).surface_set_material(i, rep)
	_mesh_cache[name] = mesh
	return mesh

func _find_mesh(n: Node) -> MeshInstance3D:
	if n is MeshInstance3D:
		return n
	for c in n.get_children():
		var r := _find_mesh(c)
		if r:
			return r
	return null

## a model as a scene with indoor/outdoor materials applied per instance
func instance_model(name: String, indoor := false) -> Node3D:
	var sc := load("res://models/%s.glb" % name) as PackedScene
	var inst := sc.instantiate() as Node3D
	_apply_mats(inst, indoor)
	return inst

func _apply_mats(n: Node, indoor: bool) -> void:
	if n is MeshInstance3D:
		var mi := n as MeshInstance3D
		for i in mi.mesh.get_surface_count():
			var sm := mi.mesh.surface_get_material(i)
			var rep := material(sm.resource_name if sm else "", indoor)
			if rep:
				mi.set_surface_override_material(i, rep)
	for c in n.get_children():
		_apply_mats(c, indoor)
