class_name Hud
extends Control
## In-game overlay: the bodycam's own burn-in (REC, clock, unit), ammo, a small dot, prompts and messages.

var player: Player
var rec_label: Label
var cam_label: Label
var ammo_label: Label
var prompt: Label
var msg: Label
var fps: Label
var msg_t := 0.0
var blink := 0.0
var unit_id := ""

func _init() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	UiTheme.fonts()
	unit_id = "BC-07  #%04d" % (randi() % 9000 + 1000)
	var box := VBoxContainer.new()
	box.layout_direction = Control.LAYOUT_DIRECTION_LTR
	box.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	box.position = Vector2(-420, 22)
	box.size = Vector2(390, 90)
	box.alignment = BoxContainer.ALIGNMENT_BEGIN
	box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(box)
	rec_label = _mono(24)
	rec_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	box.add_child(rec_label)
	cam_label = _mono(19)
	cam_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	box.add_child(cam_label)
	ammo_label = _mono(22)
	ammo_label.layout_direction = Control.LAYOUT_DIRECTION_LTR
	ammo_label.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	ammo_label.position = Vector2(-160, -54)
	ammo_label.size = Vector2(320, 34)
	ammo_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_child(ammo_label)
	prompt = UiTheme.label("", 22)
	prompt.set_anchors_preset(Control.PRESET_CENTER)
	prompt.position = Vector2(-300, 60)
	prompt.size = Vector2(600, 36)
	prompt.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_child(prompt)
	msg = UiTheme.label("", 24, true)
	msg.set_anchors_preset(Control.PRESET_CENTER_TOP)
	msg.position = Vector2(-400, 120)
	msg.size = Vector2(800, 40)
	msg.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_child(msg)
	fps = _mono(18)
	fps.position = Vector2(96, 26)
	add_child(fps)

func _mono(size: int) -> Label:
	var l := Label.new()
	l.add_theme_font_override("font", UiTheme.font_mono)
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", Color(0.95, 0.95, 0.92, 0.92))
	l.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.75))
	l.add_theme_constant_override("shadow_offset_x", 2)
	l.add_theme_constant_override("shadow_offset_y", 2)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l

func show_message(t: String) -> void:
	msg.text = t
	msg_t = 3.0

func _process(delta: float) -> void:
	blink += delta
	var dt := Time.get_datetime_dict_from_system()
	rec_label.text = "%s REC   %04d-%02d-%02d  %02d:%02d:%02d" % ["●" if fmod(blink, 1.2) < 0.75 else " ", dt["year"], dt["month"], dt["day"], dt["hour"], dt["minute"], dt["second"]]
	rec_label.add_theme_color_override("font_color", Color(0.97, 0.95, 0.92, 0.95))
	cam_label.text = "%s   ▮▮▮▯" % unit_id
	if player:
		var w := player.weapon
		var mode := "AUTO" if w.auto else "SEMI"
		var rl := "  RELOAD" if w.reload_t >= 0.0 else ""
		ammo_label.text = "%02d | %03d   %s%s" % [w.ammo, w.reserve, mode, rl]
		var hint := player.interact_hint()
		if hint != "":
			prompt.text = ("زر التفاعل: " if Settings.mobile else "[E] ") + hint
		else:
			prompt.text = ""
	msg_t -= delta
	msg.modulate.a = clampf(msg_t, 0.0, 1.0)
	fps.visible = bool(Settings.get_v("show_fps"))
	if fps.visible:
		fps.text = "FPS %d" % Engine.get_frames_per_second()
	queue_redraw()

func _draw() -> void:
	if player == null or not bool(Settings.get_v("crosshair")):
		return
	var c := size * 0.5
	var a := 0.75 * (1.0 - player.weapon.ads * 0.6)
	draw_circle(c, 2.6, Color(0, 0, 0, a * 0.6))
	draw_circle(c, 1.8, Color(1, 1, 1, a))
