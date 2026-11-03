class_name TankLook
extends RefCounted
## The tank's materials (tools/tank.py names them): woodland camouflage with its packed normal/roughness map and mud
## on the lower parts (vertex colour), the track belts (their texture scrolls with the speed of each side), dark
## steel, rubber, glass, engine grilles.

static var _mats := {}

static func material(name: String) -> Material:
	if _mats.has(name):
		return _mats[name]
	var m: Material
	match name:
		"camo":
			var sm := ShaderMaterial.new()
			sm.shader = load("res://shaders/vehicle_paint.gdshader")
			sm.set_shader_parameter("alb_tex", load("res://textures/v/tank_camo.jpg"))
			sm.set_shader_parameter("nrh_tex", load("res://textures/v/tank_camo_nrh.png"))
			sm.set_shader_parameter("uv_scale", 1.0)
			m = sm
		"track":
			var sm := ShaderMaterial.new()
			sm.shader = load("res://shaders/vehicle_paint.gdshader")
			sm.set_shader_parameter("alb_tex", load("res://textures/v/tank_track.jpg"))
			sm.set_shader_parameter("nrh_tex", load("res://textures/v/tank_track_nrh.png"))
			sm.set_shader_parameter("metallic", 0.45)
			sm.set_shader_parameter("double_sided_dark", true)
			m = sm
		_:
			var st := StandardMaterial3D.new()
			st.vertex_color_use_as_albedo = true
			match name:
				"metal":
					st.albedo_color = Color(0.17, 0.17, 0.16)
					st.metallic = 0.6
					st.roughness = 0.5
				"rubber":
					st.albedo_color = Color(0.07, 0.07, 0.07)
					st.roughness = 0.92
				"glass":
					st.albedo_color = Color(0.06, 0.09, 0.11)
					st.metallic = 0.6
					st.roughness = 0.08
				"grille":
					st.albedo_color = Color(0.04, 0.04, 0.04)
					st.roughness = 0.9
				_:
					st.albedo_color = Color(0.3, 0.3, 0.3)
			m = st
	_mats[name] = m
	return m

## give every surface of the model its material (by the names the glb carries); the tracks get their own copies
## so each side can scroll by itself
static func dress(n: Node) -> void:
	if n is MeshInstance3D:
		var mi := n as MeshInstance3D
		for i in mi.mesh.get_surface_count():
			var sm := mi.mesh.surface_get_material(i)
			var nm := sm.resource_name if sm else "camo"
			var m := material(nm)
			if nm == "track":
				m = m.duplicate()
			mi.set_surface_override_material(i, m)
	for c in n.get_children():
		dress(c)
