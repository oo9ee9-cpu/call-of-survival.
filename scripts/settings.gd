extends Node
## Player options (saved in user://settings.cfg) and the input map.

signal changed(key: String)

const PATH := "user://settings.cfg"

var mobile := false
var data := {}

const DEFAULTS := {
	"quality": 1,          # 0 low, 1 medium, 2 high, 3 ultra
	"render_scale": 0.8,
	"view_distance": 1,    # 0 near, 1 normal, 2 far
	"shadows": 1,          # 0 off, 1 soft, 2 sharp + long
	"vegetation": 1,       # 0 sparse, 1 normal, 2 dense
	"bodycam": 1.0,
	"motion_blur": true,
	"fov": 100.0,
	"head_bob": 1.0,
	"crosshair": true,
	"sens_touch": 1.0,
	"sens_mouse": 1.0,
	"invert_y": false,
	"touch_scale": 1.0,
	"touch_opacity": 0.55,
	"vol_master": 0.9,
	"vol_sfx": 1.0,
	"vol_amb": 0.85,
	"show_fps": false,
	"weather": 0,          # 0 overcast, 1 fog, 2 rain
	"time": 1,             # 0 dawn, 1 day, 2 dusk, 3 night
	"battle": true,
}

func _ready() -> void:
	mobile = OS.has_feature("mobile") or OS.get_name() == "Android" or OS.get_name() == "iOS"
	if mobile:
		Engine.max_fps = 60   # 90/120 Hz screens: no need to draw faster, keeps the phone cooler
	data = DEFAULTS.duplicate()
	if not mobile:
		data["quality"] = 2
		data["render_scale"] = 1.0
		data["shadows"] = 2
		data["vegetation"] = 2
	var cf := ConfigFile.new()
	if cf.load(PATH) == OK:
		for k in DEFAULTS:
			if cf.has_section_key("s", k):
				data[k] = cf.get_value("s", k)
	_setup_input()
	apply_audio()

func get_v(k: String):
	return data.get(k, DEFAULTS.get(k))

func set_v(k: String, v) -> void:
	data[k] = v
	if k.begins_with("vol_"):
		apply_audio()
	changed.emit(k)
	save()

func save() -> void:
	var cf := ConfigFile.new()
	for k in data:
		cf.set_value("s", k, data[k])
	cf.save(PATH)

## a preset sets several options at once
func apply_preset(q: int) -> void:
	data["quality"] = q
	var t: Dictionary = {
		0: {"render_scale": 0.6, "shadows": 0, "vegetation": 0, "view_distance": 0, "motion_blur": false},
		1: {"render_scale": 0.8, "shadows": 1, "vegetation": 1, "view_distance": 1, "motion_blur": true},
		2: {"render_scale": 1.0, "shadows": 2, "vegetation": 2, "view_distance": 1, "motion_blur": true},
		3: {"render_scale": 1.0, "shadows": 2, "vegetation": 2, "view_distance": 2, "motion_blur": true},
	}[q]
	for k in t:
		data[k] = t[k]
	changed.emit("quality")
	save()

func apply_audio() -> void:
	_bus("Master", float(get_v("vol_master")))
	_bus("SFX", float(get_v("vol_sfx")))
	_bus("Ambience", float(get_v("vol_amb")))

func _bus(name: String, v: float) -> void:
	var i := AudioServer.get_bus_index(name)
	if i >= 0:
		AudioServer.set_bus_volume_db(i, linear_to_db(maxf(v, 0.0001)))
		AudioServer.set_bus_mute(i, v <= 0.001)

func _setup_input() -> void:
	var keys := {
		"move_forward": [KEY_W, KEY_UP], "move_back": [KEY_S, KEY_DOWN], "move_left": [KEY_A, KEY_LEFT], "move_right": [KEY_D, KEY_RIGHT],
		"sprint": [KEY_SHIFT], "crouch": [KEY_C, KEY_CTRL], "jump": [KEY_SPACE], "reload": [KEY_R], "interact": [KEY_E, KEY_F],
		"flashlight": [KEY_L, KEY_T], "fire_mode": [KEY_B, KEY_V], "pause": [KEY_ESCAPE, KEY_P], "toggle_fps": [KEY_F3],
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
		"reload": JOY_BUTTON_X, "interact": JOY_BUTTON_Y, "pause": JOY_BUTTON_START, "sprint": JOY_BUTTON_LEFT_STICK, "flashlight": JOY_BUTTON_DPAD_UP}
	for a in pads:
		var jb := InputEventJoypadButton.new()
		jb.button_index = pads[a]
		InputMap.action_add_event(a, jb)
	for ax in [["move_left", JOY_AXIS_LEFT_X, -1.0], ["move_right", JOY_AXIS_LEFT_X, 1.0], ["move_forward", JOY_AXIS_LEFT_Y, -1.0], ["move_back", JOY_AXIS_LEFT_Y, 1.0]]:
		var jm := InputEventJoypadMotion.new()
		jm.axis = ax[1]
		jm.axis_value = ax[2]
		InputMap.action_add_event(ax[0], jm)
