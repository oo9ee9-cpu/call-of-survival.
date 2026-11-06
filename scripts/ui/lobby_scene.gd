class_name LobbyScene
extends Node3D
## The lobby's own little world behind the menus: a camp on a rocky river bank at the golden hour, a tent with its
## ropes, ammunition crates and jerrycans, grass and stones, a river behind, the ruins of the city on the far side in
## the evening haze. The player's soldier stands in front of the tent with his rifle.

var soldier: Soldier
var cam: Camera3D
var _t := 0.0
var _cam_base := Vector3(0.0, 1.02, 3.35)
var _look := Vector3(0.0, 0.97, 0.0)
## the river's course past the camp (x, z), from the near left out to the far distance
const RIVER := [Vector2(-16, 4), Vector2(-9.5, -5), Vector2(-6.5, -15), Vector2(-5.0, -28), Vector2(-7.5, -46), Vector2(-13, -72), Vector2(-21, -110), Vector2(-30, -170)]

func build() -> void:
	_environment()
	_ground()
	_river()
	_rocks()
	_cliffs()
	_tent(Vector3(5.4, 0.0, -9.6), 0.5)
	_props()
	_ruins()
	_trees()
	_grass()
	soldier = Soldier.new()
	add_child(soldier)
	soldier.position = Vector3(0, 0, 0)
	soldier.body_yaw = PI
	soldier.aim_yaw = PI
	soldier.low_ready = 0.85
	soldier.aim_pitch = -0.12
	cam = Camera3D.new()
	cam.fov = 40.0
	cam.near = 0.1
	cam.far = 900.0
	add_child(cam)
	cam.position = _cam_base
	cam.look_at(_look, Vector3.UP)

func _process(delta: float) -> void:
	_t += delta
	if soldier:
		# breathing on the spot, now and then a glance aside
		soldier.speed = 0.0
		soldier.aim_yaw = PI + sin(_t * 0.23) * 0.22
		soldier.face(delta, false)
	if cam:
		cam.position = _cam_base + Vector3(sin(_t * 0.11) * 0.06, sin(_t * 0.17) * 0.02, 0.0)
		cam.look_at(_look, Vector3.UP)

## the evening sky: warm at the horizon, soft clouds, the low sun's glow at the upper left behind the camp
const SKY := """
shader_type sky;
uniform vec3 glow_dir = vec3(-0.55, 0.22, -0.8);
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
	vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { float a = 0.5; float s = 0.0; for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
void sky() {
	vec3 d = EYEDIR;
	vec3 g = normalize(glow_dir);
	float sd = max(dot(d, g), 0.0);
	vec3 top = vec3(0.32, 0.45, 0.62);
	vec3 hor = vec3(1.0, 0.76, 0.48);
	vec3 col = mix(hor, top, pow(clamp(d.y, 0.0, 1.0), 0.6));
	if (d.y < 0.0) { col = mix(hor, vec3(0.45, 0.36, 0.28), clamp(-d.y * 5.0, 0.0, 1.0)); }
	col += vec3(1.0, 0.78, 0.45) * (pow(sd, 900.0) * 10.0 + pow(sd, 24.0) * 0.55 + pow(sd, 4.0) * 0.18);
	if (d.y > 0.0) {
		vec2 uv = d.xz / (d.y + 0.1) * 0.8;
		float c = smoothstep(0.45, 0.8, fbm(uv * 1.4 + vec2(2.0, 5.0)));
		float lit = 0.55 + 0.45 * fbm(uv * 1.4 + vec2(2.2, 5.1) + g.xz * 0.2);
		vec3 cc = mix(vec3(0.58, 0.46, 0.42), vec3(1.0, 0.86, 0.66), lit) * (0.85 + 0.5 * pow(sd, 3.0));
		col = mix(col, cc, c * 0.8 * smoothstep(0.0, 0.1, d.y));
	}
	COLOR = col;
}
"""

func _environment() -> void:
	var sky_m := ShaderMaterial.new()
	var sh := Shader.new()
	sh.code = SKY
	sky_m.shader = sh
	var sky := Sky.new()
	sky.sky_material = sky_m
	sky.radiance_size = Sky.RADIANCE_SIZE_64
	var e := Environment.new()
	e.background_mode = Environment.BG_SKY
	e.sky = sky
	e.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	e.ambient_light_energy = 0.3
	e.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	e.tonemap_exposure = 0.95
	e.fog_enabled = true
	e.fog_light_color = Color(0.93, 0.74, 0.52)
	e.fog_density = 0.003
	e.fog_sky_affect = 0.15
	e.glow_enabled = true
	e.glow_intensity = 0.2
	e.glow_bloom = 0.04
	e.adjustment_enabled = true
	e.adjustment_saturation = 1.06
	e.adjustment_contrast = 1.12
	var we := WorldEnvironment.new()
	we.environment = e
	add_child(we)
	# the low sun from the front left: the soldier's face and the camp in warm light, long shadows to the back right
	var sun := DirectionalLight3D.new()
	sun.light_color = Color(1.0, 0.8, 0.56)
	sun.light_energy = 1.35
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 40.0
	sun.shadow_blur = 1.2
	add_child(sun)
	sun.look_at_from_position(Vector3(-6.0, 4.2, 6.5), Vector3.ZERO, Vector3.UP)
	# the sky's cool light from the back right on the far side of everything
	var fill := DirectionalLight3D.new()
	fill.light_color = Color(0.62, 0.7, 0.92)
	fill.light_energy = 0.4
	add_child(fill)
	fill.look_at_from_position(Vector3(5.0, 4.0, -6.0), Vector3.ZERO, Vector3.UP)

## a material from one layer of the terrain atlas (8 squares stacked: grass, grass, leaves, soil, dark soil, sand,
## gravel, stone)
func _ground_mat(layers: Vector4, scale: float) -> ShaderMaterial:
	var sh := Shader.new()
	sh.code = """
shader_type spatial;
uniform sampler2D atlas : source_color, filter_linear_mipmap, repeat_disable;
uniform vec4 layers;   // x, y: two layers mixed by a noise; z: a third in patches; w: how much of it
uniform float uv_scale = 0.25;
varying vec3 wp;
void vertex() { wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
vec3 layer(float l, vec2 uv) { vec2 u = fract(uv); u = mix(vec2(0.004), vec2(0.996), u); return texture(atlas, vec2(u.x, (l + u.y) / 8.0)).rgb; }
void fragment() {
	vec2 uv = wp.xz * uv_scale;
	float m = smoothstep(0.35, 0.65, n(wp.xz * 0.35) * 0.7 + n(wp.xz * 1.3) * 0.3);
	vec3 a = mix(layer(layers.x, uv), layer(layers.y, uv * 1.3), m);
	float p = smoothstep(0.55, 0.75, n(wp.xz * 0.12 + 7.0)) * layers.w;
	ALBEDO = mix(a, layer(layers.z, uv * 0.8), p);
	ROUGHNESS = 0.95;
}
"""
	var m := ShaderMaterial.new()
	m.shader = sh
	m.set_shader_parameter("atlas", load("res://textures/v8/terrain_albedo.jpg"))
	m.set_shader_parameter("layers", layers)
	m.set_shader_parameter("uv_scale", scale)
	return m

func _ground() -> void:
	# a gently rolling field of dry grass and dirt that drops to the river bank
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var n := 80
	var size := 160.0
	var noise := FastNoiseLite.new()
	noise.frequency = 0.03
	for j in n:
		for i in n:
			for q in [[0, 0], [1, 1], [1, 0], [0, 0], [0, 1], [1, 1]]:
				var x: float = -size * 0.5 + (i + int(q[0])) * size / n
				var z: float = -size * 0.75 + (j + int(q[1])) * size / n
				st.add_vertex(Vector3(x, _h(x, z, noise), z))
	st.generate_normals()
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	mi.material_override = _ground_mat(Vector4(3.0, 4.0, 1.0, 0.55), 0.3)
	add_child(mi)

func _h(x: float, z: float, noise: FastNoiseLite) -> float:
	# level where the soldier and the tent stand, rolling further out, down to the river along its course
	var camp := smoothstep(2.5, 9.0, Vector2(x * 0.8, z).length())
	var y := noise.get_noise_2d(x, z) * 0.9 * camp
	var d := _river_dist(x, z)
	y -= (1.0 - smoothstep(3.0, 9.0, d)) * 1.6
	return y

## distance from (x, z) to the river's middle line
func _river_dist(x: float, z: float) -> float:
	var p := Vector2(x, z)
	var best := 1e9
	for i in RIVER.size() - 1:
		var a: Vector2 = RIVER[i]
		var b: Vector2 = RIVER[i + 1]
		var ab := b - a
		var t := clampf((p - a).dot(ab) / ab.length_squared(), 0.0, 1.0)
		best = minf(best, p.distance_to(a + ab * t))
	return best

func _river() -> void:
	# a ribbon of water along the course, wider as it goes away
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var pts: Array[Vector3] = []
	for i in RIVER.size():
		var c: Vector2 = RIVER[i]
		var a: Vector2 = RIVER[maxi(i - 1, 0)]
		var b: Vector2 = RIVER[mini(i + 1, RIVER.size() - 1)]
		var dir := (b - a).normalized()
		var side := Vector2(-dir.y, dir.x) * (3.2 + i * 1.6)
		pts.append(Vector3(c.x + side.x, -1.05, c.y + side.y))
		pts.append(Vector3(c.x - side.x, -1.05, c.y - side.y))
	for i in RIVER.size() - 1:
		var a0 := pts[i * 2]
		var a1 := pts[i * 2 + 1]
		var b0 := pts[i * 2 + 2]
		var b1 := pts[i * 2 + 3]
		for v in [a0, b0, b1, a0, b1, a1]:
			st.set_normal(Vector3.UP)
			st.add_vertex(v)
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.2, 0.27, 0.27)
	m.metallic = 0.55
	m.roughness = 0.08
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	mi.material_override = m
	add_child(mi)

func _rock_mesh(seed: int) -> ArrayMesh:
	var sm := SphereMesh.new()
	sm.radial_segments = 14
	sm.rings = 8
	var arr := sm.get_mesh_arrays()
	var verts: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
	var noise := FastNoiseLite.new()
	noise.seed = seed
	noise.frequency = 1.6
	for i in verts.size():
		var v := verts[i]
		var k := 1.0 + noise.get_noise_3dv(v * 1.3) * 0.35
		verts[i] = Vector3(v.x * k, maxf(v.y * k * 0.62, -0.1), v.z * k)
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var idx: PackedInt32Array = arr[Mesh.ARRAY_INDEX]
	for i in idx:
		st.add_vertex(verts[i])
	st.generate_normals()
	return st.commit()

func _rocks() -> void:
	var m := StandardMaterial3D.new()
	m.albedo_texture = load("res://textures/b/concrete.jpg")
	m.albedo_color = Color(0.78, 0.68, 0.56)
	m.uv1_triplanar = true
	m.uv1_scale = Vector3(0.6, 0.6, 0.6)
	m.roughness = 0.9
	var spots := [[-3.0, -3.6, 1.1], [-4.8, -1.2, 0.7], [5.8, -1.8, 0.6], [-2.4, -7.5, 1.6], [7.8, -9.5, 2.0], [-9.0, 1.0, 1.4],
		[1.7, 1.7, 0.3], [-1.5, 1.4, 0.25], [2.6, -2.0, 0.45]]
	for k in spots.size():
		var s: Array = spots[k]
		var mi := MeshInstance3D.new()
		mi.mesh = _rock_mesh(k * 7 + 3)
		mi.material_override = m
		mi.position = Vector3(s[0], -0.1, s[1])
		mi.scale = Vector3.ONE * float(s[2])
		mi.rotation.y = k * 1.7
		add_child(mi)

## a ridge tent of olive canvas with its door rolled up, poles and guy ropes
func _tent(at: Vector3, yaw: float) -> void:
	var root := Node3D.new()
	root.position = at
	root.rotation.y = yaw
	add_child(root)
	var w := 2.6
	var l := 3.4
	var h := 2.0
	var canvas := StandardMaterial3D.new()
	canvas.albedo_color = Color(0.42, 0.42, 0.3)
	canvas.roughness = 0.95
	canvas.cull_mode = BaseMaterial3D.CULL_DISABLED
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var a := Vector3(-w * 0.5, 0, -l * 0.5)
	var b := Vector3(w * 0.5, 0, -l * 0.5)
	var c := Vector3(w * 0.5, 0, l * 0.5)
	var d := Vector3(-w * 0.5, 0, l * 0.5)
	var r0 := Vector3(0, h, -l * 0.5)
	var r1 := Vector3(0, h, l * 0.5)
	# the two slopes, sagging a little between the poles
	for side in [[a, d, r1, r0], [b, c, r1, r0]]:
		var p0: Vector3 = side[0]
		var p1: Vector3 = side[1]
		var q1: Vector3 = side[2]
		var q0: Vector3 = side[3]
		for s in 6:
			var t0 := s / 6.0
			var t1 := (s + 1) / 6.0
			var sag0 := sin(t0 * PI) * 0.12
			var sag1 := sin(t1 * PI) * 0.12
			var e0 := p0.lerp(p1, t0)
			var e1 := p0.lerp(p1, t1)
			var f0 := q0.lerp(q1, t0) - Vector3(0, sag0, 0)
			var f1 := q0.lerp(q1, t1) - Vector3(0, sag1, 0)
			for v in [e0, e1, f1, e0, f1, f0]:
				st.add_vertex(v)
	# the back wall, and the door half rolled up at the front
	for v in [a, b, r0]:
		st.add_vertex(v)
	for v in [d, d.lerp(c, 0.3), r1.lerp(d, 0.35)]:
		st.add_vertex(v)
	st.generate_normals()
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	mi.material_override = canvas
	root.add_child(mi)
	var pole_m := StandardMaterial3D.new()
	pole_m.albedo_color = Color(0.3, 0.22, 0.14)
	for z in [-l * 0.5, l * 0.5]:
		var p := MeshInstance3D.new()
		var cm := CylinderMesh.new()
		cm.top_radius = 0.03
		cm.bottom_radius = 0.03
		cm.height = h + 0.25
		p.mesh = cm
		p.material_override = pole_m
		p.position = Vector3(0, (h + 0.25) * 0.5, z)
		root.add_child(p)
	var rope_m := StandardMaterial3D.new()
	rope_m.albedo_color = Color(0.7, 0.66, 0.55)
	for e in [[Vector3(0, h + 0.2, -l * 0.5), Vector3(0, 0, -l * 0.5 - 1.6)], [Vector3(0, h + 0.2, l * 0.5), Vector3(0, 0, l * 0.5 + 1.6)],
			[Vector3(-w * 0.5, 0.4, 0), Vector3(-w * 0.5 - 1.2, 0, 0)], [Vector3(w * 0.5, 0.4, 0), Vector3(w * 0.5 + 1.2, 0, 0)]]:
		var p0: Vector3 = e[0]
		var p1: Vector3 = e[1]
		var rope := MeshInstance3D.new()
		var cm := CylinderMesh.new()
		cm.top_radius = 0.008
		cm.bottom_radius = 0.008
		cm.height = p0.distance_to(p1)
		cm.radial_segments = 4
		rope.mesh = cm
		rope.material_override = rope_m
		var dir := (p1 - p0).normalized()
		rope.transform = Transform3D(Basis(Quaternion(Vector3.UP, dir)), (p0 + p1) * 0.5)
		root.add_child(rope)

func _place_model(path: String, at: Vector3, yaw: float, s := 1.0) -> Node3D:
	if not ResourceLoader.exists(path):
		return null
	var n: Node3D = (load(path) as PackedScene).instantiate()
	n.position = at
	n.rotation.y = yaw
	n.scale = Vector3.ONE * s
	add_child(n)
	return n

func _props() -> void:
	# the camp's stores in front of the tent
	_place_model("res://models/crate_ammo.glb", Vector3(2.9, 0.0, -4.6), 0.3)
	_place_model("res://models/crate_ammo.glb", Vector3(3.05, 0.36, -4.55), 0.1)
	_place_model("res://models/crate_long.glb", Vector3(4.3, 0.0, -4.2), -0.2)
	_place_model("res://models/crate_long.glb", Vector3(5.6, 0.0, -4.9), 0.15)
	_place_model("res://models/crate_ammo.glb", Vector3(5.4, 0.0, -3.9), 1.2)
	_place_model("res://models/jerrycan.glb", Vector3(2.2, 0.0, -3.9), 0.8)
	_place_model("res://models/jerrycan.glb", Vector3(2.45, 0.0, -3.7), 1.4)
	_place_model("res://models/sandbag.glb", Vector3(-2.6, 0.0, -2.4), 0.6)
	_place_model("res://models/u/container.glb", Vector3(9.5, 0.0, -14.0), -0.4)

## the far bank: the broken towers of the city in the evening haze, right of the soldier
func _ruins() -> void:
	var ruins := [["b/apartment", Vector3(34, 0, -130), 0.2, Vector3(1.5, 2.6, 1.5)], ["b/ruin", Vector3(52, 0, -150), 0.9, Vector3(1.6, 3.4, 1.6)],
		["u/res_multistory", Vector3(70, 0, -190), -0.3, Vector3(1.0, 1.2, 1.0)], ["b/apartment", Vector3(92, 0, -170), 0.5, Vector3(1.5, 3.2, 1.5)],
		["b/ruin", Vector3(22, 0, -175), -0.2, Vector3(1.4, 2.4, 1.4)], ["u/res_contemporary", Vector3(112, 0, -230), 0.4, Vector3(1.0, 1.4, 1.0)],
		["b/ruin_small", Vector3(40, 0, -110), 0.6, Vector3(1.3, 1.6, 1.3)], ["b/apartment", Vector3(130, 0, -200), -0.6, Vector3(1.6, 2.8, 1.6)],
		["b/ruin", Vector3(-40, 0, -220), 0.3, Vector3(1.4, 2.2, 1.4)]]
	for r in ruins:
		var n := _place_model("res://models/%s.glb" % String(r[0]), r[1], float(r[2]))
		if n:
			n.scale = r[3]
			_dress_building(n)

## the city's own walls on a building made for the valley: its middle level of detail, the valley's materials
var _bmats := {}
func _dress_building(n: Node) -> void:
	var kids := n.get_children()
	var has_mid := false
	for c in kids:
		if String(c.name) == "mid":
			has_mid = true
	for c in kids:
		if not (c is MeshInstance3D):
			continue
		var mi := c as MeshInstance3D
		if has_mid and String(mi.name) != "mid":
			mi.visible = false
			continue
		for i in mi.mesh.get_surface_count():
			var sm := mi.mesh.surface_get_material(i)
			var nm := sm.resource_name if sm else "concrete"
			if not Valley.BMAT.has(nm):
				continue
			var m: ShaderMaterial = _bmats.get(nm)
			if m == null:
				var d: Array = Valley.BMAT[nm]
				m = ShaderMaterial.new()
				m.shader = load("res://shaders/building.gdshader")
				m.set_shader_parameter("alb_tex", load(d[0]))
				if str(d[1]) != "":
					m.set_shader_parameter("nrh_tex", load(d[1]))
				else:
					m.set_shader_parameter("has_nrh", false)
				var extra: Dictionary = d[2]
				for k in extra:
					m.set_shader_parameter(k, extra[k])
				m.set_shader_parameter("cut_near", -1.0)
				m.set_shader_parameter("cut_far", 100000.0)
				_bmats[nm] = m
			mi.set_surface_override_material(i, m)

## sandstone cliffs on the far side of the river, at the left
func _cliffs() -> void:
	var m := StandardMaterial3D.new()
	m.albedo_texture = load("res://textures/b/concrete.jpg")
	m.albedo_color = Color(0.8, 0.66, 0.5)
	m.uv1_triplanar = true
	m.uv1_scale = Vector3(0.25, 0.25, 0.25)
	m.roughness = 0.95
	var spots := [[-17, -10, 5.0, 4.5], [-21, -20, 6.5, 6.0], [-16, -30, 4.5, 7.5], [-24, -40, 8.0, 9.0], [-18, -52, 6.0, 6.5],
		[-30, -60, 9.0, 11.0], [-22, -76, 7.0, 8.0], [-36, -88, 10.0, 12.0], [-12, -18, 2.6, 2.2], [-14, -40, 3.0, 3.0]]
	for k in spots.size():
		var sp: Array = spots[k]
		var mi := MeshInstance3D.new()
		mi.mesh = _rock_mesh(k * 13 + 5)
		mi.material_override = m
		mi.position = Vector3(float(sp[0]), -0.6, float(sp[1]))
		mi.scale = Vector3(float(sp[2]), float(sp[3]), float(sp[2]) * 0.8)
		mi.rotation.y = k * 2.3
		add_child(mi)

## trees close by at both sides, their crowns over the top corners
func _trees() -> void:
	for t in [["oak_0", Vector3(-6.2, 0, -6.0), 0.4, 0.85], ["ash_1", Vector3(6.6, 0, -5.5), 2.1, 0.8], ["oak_1", Vector3(-11.0, 0, -12.0), 1.0, 1.0],
			["ash_0", Vector3(12.0, 0, -16.0), 0.2, 1.0], ["birch_0", Vector3(-8.5, 0, -22.0), 0.7, 1.0]]:
		var n := _place_model("res://models/v8/%s.glb" % String(t[0]), t[1], float(t[2]), float(t[3]))
		if n == null:
			continue
		# the near level of the tree only, with the bark and leaf pictures the world uses
		for c in n.get_children():
			if not (c is MeshInstance3D):
				continue
			var mi := c as MeshInstance3D
			if String(mi.name) != "lod0":
				mi.visible = false
				continue
			for i in mi.mesh.get_surface_count():
				var nm := mi.mesh.surface_get_material(i).resource_name if mi.mesh.surface_get_material(i) else "bark_oak"
				var m := ShaderMaterial.new()
				if nm.begins_with("leaf"):
					# the leaf cards are opened by the shader, as in the world
					m.shader = load("res://shaders/cards.gdshader")
					m.set_shader_parameter("tex", load("res://textures/v8/%s.png" % (nm if ResourceLoader.exists("res://textures/v8/%s.png" % nm) else "leaf_oak")))
					m.set_shader_parameter("tint", Color(0.95, 0.9, 0.62))
					m.set_shader_parameter("translucency", 0.35)
					m.set_shader_parameter("flutter", 1.0)
					m.set_shader_parameter("alpha_cut", 0.5)
					m.set_shader_parameter("roughness", 0.75)
				else:
					var b := nm.trim_prefix("bark_")
					if not ResourceLoader.exists("res://textures/v8/bark_%s.jpg" % b):
						b = "oak"
					m.shader = load("res://shaders/tree_bark.gdshader")
					m.set_shader_parameter("alb_tex", load("res://textures/v8/bark_%s.jpg" % b))
					m.set_shader_parameter("nrh_tex", load("res://textures/v8/bark_%s_nrh.png" % b))
					m.set_shader_parameter("tint", Color(0.82, 0.78, 0.72))
				mi.set_surface_override_material(i, m)

func _grass() -> void:
	# dry golden grass and reeds, thick in the foreground corners, a few wild flowers
	var kinds := [["g_grass_tall", Vector2(0.8, 0.6), Color(0.86, 0.8, 0.55), 420], ["g_tuft", Vector2(0.6, 0.45), Color(0.8, 0.8, 0.58), 420],
		["g_blades", Vector2(0.4, 0.85), Color(0.92, 0.8, 0.5), 110], ["g_flowers", Vector2(0.45, 0.4), Color(1, 1, 1), 70]]
	var noise := FastNoiseLite.new()
	noise.frequency = 0.03
	for k in kinds.size():
		var kd: Array = kinds[k]
		var m := StandardMaterial3D.new()
		m.albedo_texture = load("res://textures/v8/%s.png" % String(kd[0]))
		m.albedo_color = kd[2]
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA_SCISSOR
		m.alpha_scissor_threshold = 0.4
		m.cull_mode = BaseMaterial3D.CULL_DISABLED
		m.roughness = 0.9
		var q := QuadMesh.new()
		q.size = kd[1]
		q.center_offset = Vector3(0, q.size.y * 0.5, 0)
		q.material = m
		var xfs: Array[Transform3D] = []
		var rng := RandomNumberGenerator.new()
		rng.seed = 11 + k
		for i in int(kd[3]):
			var x := rng.randf_range(-14.0, 14.0)
			var z := rng.randf_range(-16.0, 3.0)
			# more of it near the camera's corners, none on the soldier, the tent or the stores
			if rng.randf() < 0.35:
				x = rng.randf_range(1.2, 3.4) * (1.0 if rng.randf() < 0.5 else -1.0)
				z = rng.randf_range(0.8, 2.6)
			if Vector2(x, z).length() < 1.0 or (x > 1.6 and x < 7.0 and z > -9.0 and z < -3.4) or _river_dist(x, z) < 2.5:
				continue
			var s := rng.randf_range(0.7, 1.45)
			var b := Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3(s, s, s))
			xfs.append(Transform3D(b, Vector3(x, _h(x, z, noise) - 0.02, z)))
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = q
		mm.instance_count = xfs.size()
		for i in xfs.size():
			mm.set_instance_transform(i, xfs[i])
		var mmi := MultiMeshInstance3D.new()
		mmi.multimesh = mm
		mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(mmi)
