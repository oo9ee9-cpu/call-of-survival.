class_name Env
extends Node3D
## Sky, sun, fog, time of day, weather (overcast / fog / rain), and the camera adapting when you walk into a dugout.

var world: World
var we: WorldEnvironment
var e: Environment
var sun: DirectionalLight3D
var sky_mat: ShaderMaterial
var rain_p: GPUParticles3D
var inside := 0.0
var base_fog := 0.0                 # the weather's fog density at ground level
var cur := {}
var wet := 0.0
var wet_target := 0.0
var flash := 0.0
var exposure := 1.0

const TIMES := [
	# dawn
	{"elev": 7.0, "az": 115.0, "sun": Color(1.0, 0.78, 0.6), "sun_e": 1.0, "zen": Color(0.28, 0.31, 0.37), "hor": Color(0.5, 0.46, 0.44),
	 "cl": Color(0.52, 0.48, 0.48), "cd": Color(0.24, 0.24, 0.28), "fog": Color(0.46, 0.43, 0.42), "fog_d": 0.0045, "amb": 2.1, "exp": 1.15, "glow": 0.22},
	# overcast day
	{"elev": 40.0, "az": 200.0, "sun": Color(0.95, 0.95, 0.97), "sun_e": 0.95, "zen": Color(0.31, 0.33, 0.36), "hor": Color(0.47, 0.48, 0.49),
	 "cl": Color(0.53, 0.54, 0.55), "cd": Color(0.27, 0.29, 0.32), "fog": Color(0.44, 0.45, 0.47), "fog_d": 0.0026, "amb": 2.4, "exp": 1.15, "glow": 0.18},
	# dusk
	{"elev": 3.5, "az": 255.0, "sun": Color(1.0, 0.6, 0.38), "sun_e": 0.9, "zen": Color(0.18, 0.2, 0.27), "hor": Color(0.48, 0.38, 0.34),
	 "cl": Color(0.42, 0.35, 0.33), "cd": Color(0.15, 0.15, 0.19), "fog": Color(0.38, 0.32, 0.3), "fog_d": 0.0042, "amb": 1.9, "exp": 1.2, "glow": 0.3},
	# night (moon)
	{"elev": 34.0, "az": 150.0, "sun": Color(0.55, 0.64, 1.0), "sun_e": 0.16, "zen": Color(0.012, 0.016, 0.028), "hor": Color(0.04, 0.045, 0.06),
	 "cl": Color(0.05, 0.055, 0.07), "cd": Color(0.015, 0.017, 0.024), "fog": Color(0.03, 0.035, 0.045), "fog_d": 0.0042, "amb": 1.2, "exp": 1.8, "glow": 0.4},
]

func setup(w: World) -> void:
	world = w
	sky_mat = ShaderMaterial.new()
	sky_mat.shader = load("res://shaders/sky.gdshader")
	sky_mat.set_shader_parameter("clouds", load("res://textures/sky/clouds.png"))
	var sky := Sky.new()
	sky.sky_material = sky_mat
	sky.radiance_size = Sky.RADIANCE_SIZE_128
	e = Environment.new()
	e.background_mode = Environment.BG_SKY
	e.sky = sky
	e.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	e.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	e.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	e.tonemap_exposure = 1.0
	e.tonemap_white = 6.0
	e.glow_enabled = true
	e.glow_intensity = 0.6
	e.glow_strength = 1.0
	e.glow_bloom = 0.04
	e.glow_hdr_threshold = 1.15
	e.glow_blend_mode = Environment.GLOW_BLEND_MODE_SOFTLIGHT
	e.fog_enabled = true
	e.fog_mode = Environment.FOG_MODE_EXPONENTIAL
	e.fog_sky_affect = 0.35
	e.fog_aerial_perspective = 0.15
	e.fog_height = 55.0
	e.fog_height_density = 0.02
	e.adjustment_enabled = true
	e.adjustment_contrast = 1.06
	e.adjustment_saturation = 0.9
	we = WorldEnvironment.new()
	we.environment = e
	add_child(we)
	sun = DirectionalLight3D.new()
	sun.shadow_enabled = true
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_2_SPLITS
	sun.directional_shadow_max_distance = 60.0
	sun.directional_shadow_blend_splits = true
	sun.shadow_blur = 2.2
	sun.light_angular_distance = 3.5
	sun.shadow_opacity = 0.75
	sun.shadow_bias = 0.06
	sun.shadow_normal_bias = 1.4
	sun.sky_mode = DirectionalLight3D.SKY_MODE_LIGHT_AND_SKY
	add_child(sun)
	_build_rain()

func _build_rain() -> void:
	rain_p = GPUParticles3D.new()
	rain_p.amount = 3500
	rain_p.lifetime = 0.9
	rain_p.preprocess = 0.9
	rain_p.local_coords = false
	rain_p.visibility_aabb = AABB(Vector3(-30, -20, -30), Vector3(60, 40, 60))
	var pm := ParticleProcessMaterial.new()
	pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
	pm.emission_box_extents = Vector3(12, 1, 12)
	pm.direction = Vector3(0.12, -1, 0.05)
	pm.spread = 3.0
	pm.initial_velocity_min = 13.0
	pm.initial_velocity_max = 16.0
	pm.gravity = Vector3(0, -9.8, 0)
	rain_p.process_material = pm
	var q := QuadMesh.new()
	q.size = Vector2(0.026, 0.62)
	var m := StandardMaterial3D.new()
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_texture = load("res://textures/fx/rain.png")
	m.albedo_color = Color(0.8, 0.82, 0.86, 0.5)
	m.billboard_mode = BaseMaterial3D.BILLBOARD_FIXED_Y
	m.billboard_keep_scale = true
	# drops passing right in front of the lens would cross the whole picture as a bright beam: fade them out up close
	m.distance_fade_mode = BaseMaterial3D.DISTANCE_FADE_PIXEL_ALPHA
	m.distance_fade_min_distance = 1.2
	m.distance_fade_max_distance = 3.0
	q.material = m
	rain_p.draw_pass_1 = q
	rain_p.emitting = false
	rain_p.visible = false
	add_child(rain_p)

func apply_settings() -> void:
	var t: Dictionary = TIMES[clampi(int(Settings.get_v("time")), 0, 3)].duplicate()
	var wx := int(Settings.get_v("weather"))
	var q := mini(int(Settings.get_v("quality")), 3)
	var vd := int(Settings.get_v("view_distance"))
	var fog_mul: float = [1.35, 1.0, 0.72][vd]
	var cover := 0.84
	if wx == 1:
		fog_mul *= 3.2
		cover = 1.0
		t["sun_e"] *= 0.55
		e.fog_height_density = 0.12
	elif wx == 2:
		fog_mul *= 1.9
		cover = 1.0
		t["sun_e"] *= 0.5
		t["zen"] = (t["zen"] as Color) * 0.75
		t["cl"] = (t["cl"] as Color) * 0.75
		t["cd"] = (t["cd"] as Color) * 0.7
		e.fog_height_density = 0.05
	else:
		e.fog_height_density = 0.02
	cur = t
	wet_target = 1.0 if wx == 2 else (0.25 if wx == 1 else 0.0)
	var el := deg_to_rad(float(t["elev"]))
	var az := deg_to_rad(float(t["az"]))
	sun.rotation = Vector3(-el, az, 0.0)
	sun.light_color = t["sun"]
	sun.light_energy = t["sun_e"]
	var sh := int(Settings.get_v("shadows"))
	sun.shadow_enabled = sh > 0 and float(t["sun_e"]) > 0.08
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_2_SPLITS if sh < 2 else DirectionalLight3D.SHADOW_PARALLEL_4_SPLITS
	sun.directional_shadow_max_distance = [0.0, 45.0, 90.0][sh] * (1.25 if q == 3 else 1.0)
	sky_mat.set_shader_parameter("zenith", t["zen"])
	sky_mat.set_shader_parameter("horizon", t["hor"])
	sky_mat.set_shader_parameter("ground", (t["hor"] as Color) * 0.8)
	sky_mat.set_shader_parameter("cloud_light", t["cl"])
	sky_mat.set_shader_parameter("cloud_dark", t["cd"])
	sky_mat.set_shader_parameter("cover", cover)
	sky_mat.set_shader_parameter("sun_glow", 0.25 if wx == 0 else 0.1)
	e.fog_light_color = t["fog"]
	base_fog = float(t["fog_d"]) * fog_mul
	e.fog_density = base_fog
	e.ambient_light_energy = t["amb"]
	e.glow_intensity = t["glow"] * 3.0
	e.glow_enabled = q >= 1
	exposure = t["exp"]
	var fwd := RenderingServer.get_current_rendering_method() == "forward_plus"
	e.ssao_enabled = fwd and q >= 2
	e.ssao_radius = 1.2
	e.ssao_intensity = 2.2
	e.ssil_enabled = fwd and q >= 3
	e.sdfgi_enabled = false
	e.volumetric_fog_enabled = fwd and q >= 3
	e.volumetric_fog_density = 0.012 * (3.0 if wx == 1 else 1.0)
	e.volumetric_fog_albedo = t["fog"]
	e.volumetric_fog_length = 96.0
	rain_p.amount = [1200, 2500, 3500, 5000][q]
	RenderingServer.global_shader_parameter_set("rain", 1.0 if wx == 2 else 0.0)
	RenderingServer.global_shader_parameter_set("wind", Vector4(0.9, 0.35, 0.9 if wx == 2 else 0.55, 0.0))
	_set_loops(wx)

var _rain_loop: AudioStreamPlayer
var _wind_loop: AudioStreamPlayer
var _battle_loop: AudioStreamPlayer
func _set_loops(wx: int) -> void:
	if _wind_loop == null:
		_wind_loop = Sfx.loop("wind_loop", -9.0)
		_battle_loop = Sfx.loop("battle_loop", -12.0)
		_rain_loop = Sfx.loop("rain_loop", -80.0)
	if _rain_loop:
		_rain_loop.volume_db = -5.0 if wx == 2 else -80.0
	if _wind_loop:
		_wind_loop.volume_db = -6.0 if wx == 2 else -9.0
	if _battle_loop:
		_battle_loop.volume_db = -11.0 if Settings.get_v("battle") else -80.0

func _process(delta: float) -> void:
	if world == null or not world.ready_built:
		return
	var cam := get_viewport().get_camera_3d()
	var target := 0.0
	if cam and world.props:
		target = world.props.inside_factor(cam.global_position).x
	inside = move_toward(inside, target, delta * 0.9)
	var t := cur
	if t.is_empty():
		return
	e.ambient_light_energy = lerpf(float(t["amb"]), 0.18, inside)
	# high over the ground (a parachute jump, an aircraft) most of the haze lies under you, not all round: thinner fog
	if cam and base_fog > 0.0:
		var cp := cam.global_position
		var hk := smoothstep(40.0, 320.0, cp.y - world.height(cp.x, cp.z))
		e.fog_density = base_fog * lerpf(1.0, 0.38, hk)
	Sfx.set_inside(inside)
	wet = move_toward(wet, wet_target, delta * 0.05)
	RenderingServer.global_shader_parameter_set("wetness", wet)
	var raining := wet_target > 0.9
	if cam:
		rain_p.global_position = cam.global_position + Vector3(0, 7, 0) + cam.global_transform.basis.z * -4.0
	var show_rain := raining and inside < 0.4
	if rain_p.emitting != show_rain:
		rain_p.emitting = show_rain
	rain_p.visible = show_rain or rain_p.emitting
	flash = maxf(flash - delta * 6.0, 0.0)

## the camera exposure the post effect should use right now
func view_exposure() -> float:
	return exposure * lerpf(1.0, 1.8, inside)
