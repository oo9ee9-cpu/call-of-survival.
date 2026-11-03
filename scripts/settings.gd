extends Node
## Player options (saved in user://settings.cfg), the input map, and the frame-rate cap.

signal changed(key: String)

const PATH := "user://settings.cfg"
## frame-rate caps offered in the graphics tab (0 = no cap)
const FPS_OPTIONS := [30, 40, 60, 90, 120, 144, 165, 240, 400, 0]

var mobile := false
var data := {}

const DEFAULTS := {
	"quality": 1,          # 0 low, 1 medium, 2 high, 3 ultra, 4 extreme
	"render_scale": 0.8,
	"view_distance": 1,    # 0 near, 1 normal, 2 far
	"shadows": 1,          # 0 off, 1 soft, 2 sharp + long
	"vegetation": 1,       # 0 sparse, 1 normal, 2 dense
	"fps_limit": 2,        # index in FPS_OPTIONS
	"vsync": true,
	"bodycam": 0.6,
	"motion_blur": false,  # the smear on fast turns (off: it blurred the picture when turning)
	"fov": 90.0,
	"view_mode": 1,        # 0 first person, 1 third person
	"head_bob": 0.6,
	"crosshair": true,
	"sens_touch": 1.0,
	"sens_mouse": 1.0,
	"sens_ads": 0.7,
	"sens_scope": 0.55,
	"gyro": false,
	"invert_y": false,
	"touch_scale": 1.0,
	"touch_opacity": 0.6,
	"hud_layout": {},      # button -> [x, y, scale, opacity] (fractions of the screen)
	"auto_pickup": true,
	"auto_door": true,
	"vol_master": 0.9,
	"vol_sfx": 1.0,
	"vol_amb": 0.85,
	"vol_music": 0.55,
	"show_fps": false,
	"weather": 0,          # 0 overcast, 1 fog, 2 rain
	"time": 1,             # 0 dawn, 1 day, 2 dusk, 3 night
	"battle": true,
	"map": "valley",       # valley (8 x 8 km) | front (3 x 3 km)
	"mode": "domination",
	"region": "me",        # eu | me | na | sa
	"raids": true,         # air raids on the valley (sirens, jets, missiles)
	"team_size": 3,        # soldiers per team: 10 | 20 | 30 | 50 (index)
}

func _ready() -> void:
	mobile = OS.has_feature("mobile") or OS.get_name() == "Android" or OS.get_name() == "iOS"
	data = DEFAULTS.duplicate(true)
	if not mobile:
		data["quality"] = 2
		data["render_scale"] = 1.0
		data["shadows"] = 2
		data["vegetation"] = 2
		data["fps_limit"] = 9
	var cf := ConfigFile.new()
	if cf.load(PATH) == OK:
		for k in DEFAULTS:
			if cf.has_section_key("s", k):
				data[k] = cf.get_value("s", k)
		# old saves had the turn smear on by default: switch it off once
		if not cf.has_section_key("s", "fps_limit"):
			data["motion_blur"] = false
	_setup_input()
	apply_audio()
	apply_display()

func get_v(k: String):
	return data.get(k, DEFAULTS.get(k))

func set_v(k: String, v) -> void:
	data[k] = v
	if k.begins_with("vol_"):
		apply_audio()
	if k == "fps_limit" or k == "vsync":
		apply_display()
	changed.emit(k)
	save()

func save() -> void:
	var cf := ConfigFile.new()
	for k in data:
		cf.set_value("s", k, data[k])
	cf.save(PATH)

func fps_cap() -> int:
	return int(FPS_OPTIONS[clampi(int(get_v("fps_limit")), 0, FPS_OPTIONS.size() - 1)])

## frame-rate cap and vertical sync (a cap above the screen's refresh rate needs vsync off)
func apply_display() -> void:
	var cap := fps_cap()
	Engine.max_fps = cap
	var vs := bool(get_v("vsync")) and (cap == 0 or cap <= 120)
	DisplayServer.window_set_vsync_mode(DisplayServer.VSYNC_ENABLED if vs else DisplayServer.VSYNC_DISABLED)

## a preset sets several options at once
func apply_preset(q: int) -> void:
	data["quality"] = q
	var t: Dictionary = {
		0: {"render_scale": 0.6, "shadows": 0, "vegetation": 0, "view_distance": 0},
		1: {"render_scale": 0.8, "shadows": 1, "vegetation": 1, "view_distance": 1},
		2: {"render_scale": 1.0, "shadows": 2, "vegetation": 2, "view_distance": 1},
		3: {"render_scale": 1.0, "shadows": 2, "vegetation": 2, "view_distance": 2},
		4: {"render_scale": 1.0, "shadows": 2, "vegetation": 2, "view_distance": 2},
	}[clampi(q, 0, 4)]
	for k in t:
		data[k] = t[k]
	changed.emit("quality")
	save()

func apply_audio() -> void:
	_bus("Master", float(get_v("vol_master")))
	_bus("SFX", float(get_v("vol_sfx")))
	_bus("Ambience", float(get_v("vol_amb")))
	_bus("UI", float(get_v("vol_music")))

func _bus(name: String, v: float) -> void:
	var i := AudioServer.get_bus_index(name)
	if i >= 0:
		AudioServer.set_bus_volume_db(i, linear_to_db(maxf(v, 0.0001)))
		AudioServer.set_bus_mute(i, v <= 0.001)

func _setup_input() -> void:
	var keys := {
		"move_forward": [KEY_W, KEY_UP], "move_back": [KEY_S, KEY_DOWN], "move_left": [KEY_A, KEY_LEFT], "move_right": [KEY_D, KEY_RIGHT],
		"sprint": [KEY_SHIFT], "crouch": [KEY_C], "prone": [KEY_Z], "jump": [KEY_SPACE], "reload": [KEY_R], "interact": [KEY_F],
		"lean_left": [KEY_Q], "lean_right": [KEY_E], "flashlight": [KEY_L, KEY_T], "fire_mode": [KEY_B], "view_toggle": [KEY_V],
		"inventory": [KEY_TAB, KEY_I], "map": [KEY_M], "heal": [KEY_H], "grenade": [KEY_G], "weapon_1": [KEY_1], "weapon_2": [KEY_2],
		"weapon_3": [KEY_3], "pause": [KEY_ESCAPE, KEY_P], "toggle_fps": [KEY_F3], "brake": [KEY_SPACE], "throttle_up": [KEY_SHIFT],
		"throttle_down": [KEY_CTRL], "vehicle_fire2": [KEY_X],
	}
	for a in keys:
		if not InputMap.has_action(a):
			InputMap.add_action(a, 0.2)
		for k in keys[a]:
			var ev := InputEventKey.new()
			ev.physical_keycode = k
			InputMap.action_add_event(a, ev)
	for pair in [["fire", MOUSE_BUTTON_LEFT], ["aim", MOUSE_BUTTON_RIGHT]]:
		if not InputMap.has_action(pair[0]):
			InputMap.add_action(pair[0], 0.2)
		var mb := InputEventMouseButton.new()
		mb.button_index = pair[1]
		InputMap.action_add_event(pair[0], mb)
	var pads := {"fire": JOY_BUTTON_RIGHT_SHOULDER, "aim": JOY_BUTTON_LEFT_SHOULDER, "jump": JOY_BUTTON_A, "crouch": JOY_BUTTON_B,
		"reload": JOY_BUTTON_X, "interact": JOY_BUTTON_Y, "pause": JOY_BUTTON_START, "sprint": JOY_BUTTON_LEFT_STICK,
		"flashlight": JOY_BUTTON_DPAD_UP, "view_toggle": JOY_BUTTON_BACK, "inventory": JOY_BUTTON_DPAD_DOWN}
	for a in pads:
		if not InputMap.has_action(a):
			InputMap.add_action(a, 0.2)
		var jb := InputEventJoypadButton.new()
		jb.button_index = pads[a]
		InputMap.action_add_event(a, jb)
	for ax in [["move_left", JOY_AXIS_LEFT_X, -1.0], ["move_right", JOY_AXIS_LEFT_X, 1.0], ["move_forward", JOY_AXIS_LEFT_Y, -1.0], ["move_back", JOY_AXIS_LEFT_Y, 1.0]]:
		var jm := InputEventJoypadMotion.new()
		jm.axis = ax[1]
		jm.axis_value = ax[2]
		InputMap.action_add_event(ax[0], jm)
