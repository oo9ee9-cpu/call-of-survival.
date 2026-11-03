class_name TouchControls
extends Control
## Phone controls: a floating stick on the left (push to the edge to sprint), drag anywhere on the right to look,
## buttons for fire (drag on it to aim while shooting), aim, reload, jump / climb, crouch, interact, light, mode, pause.

signal pause_pressed

var player: Player
var stick_id := -1
var stick_origin := Vector2.ZERO
var stick_pos := Vector2.ZERO
var look_ids := {}
var held := {}            # button name -> touch index
var buttons := {}         # name -> [centre, radius, label]
# the layout editor (settings): drag a button to move it, + / - to size the chosen one; saved in Settings "hud_layout"
signal editor_closed
var editing := false
var edit_sel := ""
var edit_drag := -1
var edit_layout := {}

func _init() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE

func _ready() -> void:
	resized.connect(_layout)
	_layout()

func _layout() -> void:
	var s := float(Settings.get_v("touch_scale"))
	var W := size.x
	var H := size.y
	buttons = {
		"fire": [Vector2(W - 165 * s, H - 175 * s), 74.0 * s, "رمي"],
		"aim": [Vector2(W - 330 * s, H - 105 * s), 48.0 * s, "تصويب"],
		"reload": [Vector2(W - 335 * s, H - 245 * s), 42.0 * s, "تلقيم"],
		"jump": [Vector2(W - 95 * s, H - 345 * s), 44.0 * s, "قفز"],
		"crouch": [Vector2(W - 215 * s, H - 360 * s), 40.0 * s, "انحناء"],
		"interact": [Vector2(W * 0.5 + 170 * s, H - 150 * s), 42.0 * s, "تفاعل"],
		"light": [Vector2(W - 80 * s, 205 * s), 34.0 * s, "مصباح"],
		"mode": [Vector2(W - 165 * s, 205 * s), 34.0 * s, "نمط"],
		"view": [Vector2(W - 250 * s, 205 * s), 34.0 * s, "منظور"],
		"pause": [Vector2(54 * s, 54 * s), 30.0 * s, "قائمة"],
		# in a vehicle: throttle up / down (aircraft), the handbrake (ground vehicles)
		"t_up": [Vector2(W - 95 * s, H - 345 * s), 46.0 * s, "رفع"],
		"t_down": [Vector2(W - 95 * s, H - 225 * s), 46.0 * s, "خفض"],
		"brake": [Vector2(W - 330 * s, H - 105 * s), 52.0 * s, "فرامل"],
		"fire2": [Vector2(W - 300 * s, H - 330 * s), 44.0 * s, "صاروخ"],
		"swap": [Vector2(W * 0.5 + 250 * s, H - 75 * s), 36.0 * s, "سلاح"],
		"heal": [Vector2(W * 0.5 - 250 * s, H - 75 * s), 36.0 * s, "علاج"],
	}
	# the player's own layout: centre as a share of the screen, and a size factor
	var lay: Dictionary = edit_layout if editing else (Settings.get_v("hud_layout") as Dictionary)
	for n in lay:
		if buttons.has(n):
			var e: Array = lay[n]
			buttons[n][0] = Vector2(float(e[0]) * W, float(e[1]) * H)
			buttons[n][1] = float(buttons[n][1]) * float(e[2])
	queue_redraw()

# ------------------------------------------------------------------ the layout editor
func start_editor() -> void:
	editing = true
	edit_layout = (Settings.get_v("hud_layout") as Dictionary).duplicate(true)
	edit_sel = ""
	visible = true
	_layout()

func _edit_buttons() -> Dictionary:
	var W := size.x
	return {"_save": [Vector2(W * 0.5 - 170, 60), 44.0, "حفظ"], "_reset": [Vector2(W * 0.5, 60), 44.0, "افتراضي"],
		"_back": [Vector2(W * 0.5 + 170, 60), 44.0, "رجوع"], "_plus": [Vector2(W * 0.5 - 70, 150), 34.0, "+"], "_minus": [Vector2(W * 0.5 + 70, 150), 34.0, "−"]}

func _edit_input(event: InputEvent) -> void:
	var p := Vector2.ZERO
	var pressed := false
	var released := false
	var drag := false
	if event is InputEventScreenTouch:
		p = (event as InputEventScreenTouch).position
		pressed = (event as InputEventScreenTouch).pressed
		released = not pressed
	elif event is InputEventMouseButton and (event as InputEventMouseButton).button_index == MOUSE_BUTTON_LEFT:
		p = (event as InputEventMouseButton).position
		pressed = (event as InputEventMouseButton).pressed
		released = not pressed
	elif event is InputEventScreenDrag:
		p = (event as InputEventScreenDrag).position
		drag = true
	elif event is InputEventMouseMotion and edit_drag >= 0:
		p = (event as InputEventMouseMotion).position
		drag = true
	else:
		return
	get_viewport().set_input_as_handled()
	if pressed:
		var eb := _edit_buttons()
		for n in eb:
			if p.distance_to(eb[n][0]) < float(eb[n][1]):
				_edit_cmd(n)
				return
		for n in buttons:
			if p.distance_to(buttons[n][0]) <= float(buttons[n][1]):
				edit_sel = n
				edit_drag = 1
				queue_redraw()
				return
	elif released:
		edit_drag = -1
	elif drag and edit_drag >= 0 and edit_sel != "":
		var e: Array = edit_layout.get(edit_sel, [0.5, 0.5, 1.0])
		e[0] = clampf(p.x / size.x, 0.02, 0.98)
		e[1] = clampf(p.y / size.y, 0.02, 0.98)
		edit_layout[edit_sel] = e
		_layout()

func _edit_cmd(n: String) -> void:
	match n:
		"_save":
			Settings.set_v("hud_layout", edit_layout.duplicate(true))
			_end_editor()
		"_reset":
			edit_layout = {}
			_layout()
		"_back":
			_end_editor()
		"_plus", "_minus":
			if edit_sel != "":
				var c: Vector2 = buttons[edit_sel][0]
				var e: Array = edit_layout.get(edit_sel, [c.x / size.x, c.y / size.y, 1.0])
				e[2] = clampf(float(e[2]) * (1.12 if n == "_plus" else 0.89), 0.5, 2.2)
				edit_layout[edit_sel] = e
				_layout()

func _end_editor() -> void:
	editing = false
	edit_sel = ""
	_layout()
	editor_closed.emit()

## which buttons make sense right now (on foot, driving, flying, under the canopy)
func _shown(n: String) -> bool:
	var v := player.vehicle
	if v == null:
		if player.para > 0:
			return n in ["jump", "pause", "view"]
		return not (n in ["t_up", "t_down", "brake", "fire2"])
	if v is Aircraft:
		var w: Array = v.spec.get("weapons", [])
		return n in ["t_up", "t_down", "interact", "pause", "view"] or (n == "fire" and (w.has("gun") or w.has("rocket"))) or (n == "fire2" and (w.has("missile") or w.has("bomb")))
	if v is Tank:
		return n in ["brake", "interact", "pause", "view", "fire"]
	return n in ["brake", "interact", "pause", "view"]

func reset() -> void:
	stick_id = -1
	look_ids.clear()
	held.clear()
	if player:
		player.move_in = Vector2.ZERO
		player.touch_sprint = false
		player.weapon.touch_fire = false
		player.touch_up = false
		player.touch_down = false
		player.touch_brake = false
	queue_redraw()

func _input(event: InputEvent) -> void:
	if editing:
		_edit_input(event)
		return
	if not visible or player == null or not player.active or player.dead:
		return                      # dead: the touches go to the buttons that pick where to come back
	if event is InputEventScreenTouch:
		var e := event as InputEventScreenTouch
		if e.pressed:
			_press(e.index, e.position)
		else:
			_release(e.index)
		get_viewport().set_input_as_handled()
	elif event is InputEventScreenDrag:
		var d := event as InputEventScreenDrag
		_drag(d.index, d.position, d.relative)
		get_viewport().set_input_as_handled()

func _hit(p: Vector2) -> String:
	for n in buttons:
		if not _shown(n):
			continue
		var b: Array = buttons[n]
		if p.distance_to(b[0]) <= float(b[1]) * 1.15:
			return n
	return ""

func _press(i: int, p: Vector2) -> void:
	var b := _hit(p)
	if b != "":
		held[b] = i
		match b:
			"fire":
				player.weapon.touch_fire = true
				look_ids[i] = true
			"aim":
				player.weapon.aim_toggle = not player.weapon.aim_toggle
			"reload":
				player.weapon.reload()
			"jump":
				if player.para == 1:
					player.open_chute()
				else:
					player.jump_or_climb()
			"t_up":
				player.touch_up = true
			"t_down":
				player.touch_down = true
			"brake":
				player.touch_brake = true
			"fire2":
				player.touch_fire2 = true
			"swap":
				player.next_weapon()
			"heal":
				player.heal()
			"crouch":
				player.crouching = not player.crouching
			"interact":
				player.interact()
			"light":
				player.toggle_flashlight()
			"mode":
				player.weapon.toggle_mode()
			"view":
				player.toggle_view()
			"pause":
				pause_pressed.emit()
		queue_redraw()
		return
	if p.x < size.x * 0.42 and stick_id == -1:
		stick_id = i
		stick_origin = p
		stick_pos = p
	else:
		look_ids[i] = true
	queue_redraw()

func _release(i: int) -> void:
	if i == stick_id:
		stick_id = -1
		player.move_in = Vector2.ZERO
		player.touch_sprint = false
	look_ids.erase(i)
	for n in held.keys():
		if held[n] == i:
			held.erase(n)
			if n == "fire":
				player.weapon.touch_fire = false
			elif n == "t_up":
				player.touch_up = false
			elif n == "t_down":
				player.touch_down = false
			elif n == "brake":
				player.touch_brake = false
	queue_redraw()

func _drag(i: int, p: Vector2, rel: Vector2) -> void:
	if i == stick_id:
		stick_pos = p
		var r := 85.0 * float(Settings.get_v("touch_scale"))
		var v := (p - stick_origin) / r
		player.touch_sprint = v.length() > 1.25 and v.y < -0.6
		if v.length() > 1.0:
			v = v.normalized()
		player.move_in = Vector2(v.x, -v.y)
		queue_redraw()
	elif look_ids.has(i):
		var s := 0.0042 * float(Settings.get_v("sens_touch")) * (0.55 if player.aiming else 1.0)
		player.add_look(Vector2(-rel.x * s, -rel.y * s * (-1.0 if Settings.get_v("invert_y") else 1.0)))

func _draw() -> void:
	if editing:
		_draw_editor()
		return
	if player == null or not player.active:
		return
	var op := float(Settings.get_v("touch_opacity"))
	var font := UiTheme.font_bold
	for n in buttons:
		var b: Array = buttons[n]
		var c: Vector2 = b[0]
		var r: float = b[1]
		var on: bool = held.has(n) or (n == "aim" and player.weapon.aim_toggle) or (n == "light" and player.flashlight.visible) or (n == "crouch" and player.crouching)
		if not _shown(n):
			continue
		if n == "interact" and player.interact_hint() == "":
			continue
		draw_circle(c, r, Color(0.05, 0.05, 0.04, 0.35 * op + (0.25 if on else 0.0)))
		draw_arc(c, r, 0, TAU, 48, Color(0.95, 0.9, 0.78, (0.55 if not on else 0.95) * op), 2.0 if n != "fire" else 3.0, true)
		_icon(n, c, r * 0.42, Color(0.98, 0.95, 0.88, 0.9 * op))
		var fs := int(clampf(r * 0.34, 12.0, 22.0))
		var txt: String = b[2]
		var w := font.get_string_size(txt, HORIZONTAL_ALIGNMENT_CENTER, -1, fs).x
		draw_string(font, c + Vector2(-w * 0.5, r * 0.78), txt, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, Color(1, 1, 1, 0.75 * op))
	if stick_id != -1:
		var rr := 85.0 * float(Settings.get_v("touch_scale"))
		draw_circle(stick_origin, rr, Color(0, 0, 0, 0.22 * op))
		draw_arc(stick_origin, rr, 0, TAU, 48, Color(1, 1, 1, 0.45 * op), 2.0, true)
		var k := (stick_pos - stick_origin).limit_length(rr)
		draw_circle(stick_origin + k, rr * 0.42, Color(0.95, 0.9, 0.78, (0.75 if player.touch_sprint else 0.45) * op))
	else:
		var hint_c := Vector2(size.x * 0.16, size.y * 0.72)
		draw_arc(hint_c, 60.0, 0, TAU, 40, Color(1, 1, 1, 0.12 * op), 2.0, true)

func _draw_editor() -> void:
	var font := UiTheme.font_bold
	draw_rect(Rect2(Vector2.ZERO, size), Color(0, 0, 0, 0.35))
	draw_string(font, Vector2(0, size.y * 0.5 - 20), "اسحب أي زر إلى المكان الذي تريده، واختر زراً ثم + أو − لتغيير حجمه", HORIZONTAL_ALIGNMENT_CENTER, size.x, 22, Color(1, 1, 1, 0.8))
	for n in buttons:
		var b: Array = buttons[n]
		var sel: bool = n == edit_sel
		draw_circle(b[0], b[1], Color(0.05, 0.05, 0.04, 0.5 if sel else 0.35))
		draw_arc(b[0], b[1], 0, TAU, 48, Color(1.0, 0.85, 0.3) if sel else Color(1, 1, 1, 0.7), 3.0 if sel else 2.0, true)
		var txt: String = b[2]
		var fs := int(clampf(float(b[1]) * 0.36, 12.0, 22.0))
		var w := font.get_string_size(txt, HORIZONTAL_ALIGNMENT_CENTER, -1, fs).x
		draw_string(font, (b[0] as Vector2) + Vector2(-w * 0.5, fs * 0.35), txt, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, Color(1, 1, 1, 0.9))
	var eb := _edit_buttons()
	for n in eb:
		var b: Array = eb[n]
		draw_circle(b[0], b[1], Color(0.2, 0.35, 0.2, 0.85) if n == "_save" else Color(0.15, 0.15, 0.15, 0.85))
		draw_arc(b[0], b[1], 0, TAU, 40, Color(1, 1, 1, 0.8), 2.0, true)
		var txt: String = b[2]
		var w := font.get_string_size(txt, HORIZONTAL_ALIGNMENT_CENTER, -1, 20).x
		draw_string(font, (b[0] as Vector2) + Vector2(-w * 0.5, 7), txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 20, Color(1, 1, 1))

func _icon(n: String, c: Vector2, s: float, col: Color) -> void:
	match n:
		"fire":
			draw_rect(Rect2(c + Vector2(-s * 0.22, -s * 0.9), Vector2(s * 0.44, s * 1.4)), col)
			draw_circle(c + Vector2(0, -s * 0.9), s * 0.22, col)
			draw_rect(Rect2(c + Vector2(-s * 0.3, s * 0.55), Vector2(s * 0.6, s * 0.25)), col)
		"aim":
			draw_arc(c, s * 0.75, 0, TAU, 32, col, 2.0, true)
			draw_line(c + Vector2(-s, 0), c + Vector2(-s * 0.35, 0), col, 2.0)
			draw_line(c + Vector2(s, 0), c + Vector2(s * 0.35, 0), col, 2.0)
			draw_line(c + Vector2(0, -s), c + Vector2(0, -s * 0.35), col, 2.0)
			draw_line(c + Vector2(0, s), c + Vector2(0, s * 0.35), col, 2.0)
		"reload":
			draw_arc(c, s * 0.7, 0.3, TAU - 0.6, 28, col, 3.0, true)
			draw_colored_polygon(PackedVector2Array([c + Vector2(s * 0.75, -s * 0.05), c + Vector2(s * 1.05, -s * 0.5), c + Vector2(s * 0.4, -s * 0.45)]), col)
		"jump":
			draw_colored_polygon(PackedVector2Array([c + Vector2(0, -s), c + Vector2(s * 0.8, 0), c + Vector2(-s * 0.8, 0)]), col)
			draw_rect(Rect2(c + Vector2(-s * 0.25, 0), Vector2(s * 0.5, s * 0.8)), col)
		"crouch":
			draw_colored_polygon(PackedVector2Array([c + Vector2(0, s), c + Vector2(s * 0.8, 0), c + Vector2(-s * 0.8, 0)]), col)
			draw_rect(Rect2(c + Vector2(-s * 0.25, -s * 0.8), Vector2(s * 0.5, s * 0.8)), col)
		"interact":
			draw_circle(c, s * 0.35, col)
			draw_arc(c, s * 0.8, 0, TAU, 32, col, 2.0, true)
		"light":
			draw_colored_polygon(PackedVector2Array([c + Vector2(-s * 0.7, -s * 0.35), c + Vector2(-s * 0.1, -s * 0.35), c + Vector2(s * 0.8, -s * 0.8), c + Vector2(s * 0.8, s * 0.8), c + Vector2(-s * 0.1, s * 0.35), c + Vector2(-s * 0.7, s * 0.35)]), col)
		"mode":
			for k in 3:
				draw_rect(Rect2(c + Vector2(-s * 0.7 + k * s * 0.5, -s * 0.5), Vector2(s * 0.3, s * 1.0)), col if (k == 0 or player.weapon.auto) else Color(col.r, col.g, col.b, col.a * 0.3))
		"t_up":
			draw_colored_polygon(PackedVector2Array([c + Vector2(0, -s * 0.9), c + Vector2(s * 0.8, s * 0.3), c + Vector2(-s * 0.8, s * 0.3)]), col)
		"t_down":
			draw_colored_polygon(PackedVector2Array([c + Vector2(0, s * 0.9), c + Vector2(s * 0.8, -s * 0.3), c + Vector2(-s * 0.8, -s * 0.3)]), col)
		"swap":
			draw_rect(Rect2(c + Vector2(-s * 0.8, -s * 0.15), Vector2(s * 1.6, s * 0.3)), col)
			draw_rect(Rect2(c + Vector2(-s * 0.5, s * 0.15), Vector2(s * 0.25, s * 0.45)), col)
		"heal":
			draw_rect(Rect2(c + Vector2(-s * 0.2, -s * 0.7), Vector2(s * 0.4, s * 1.4)), col)
			draw_rect(Rect2(c + Vector2(-s * 0.7, -s * 0.2), Vector2(s * 1.4, s * 0.4)), col)
		"fire2":
			draw_colored_polygon(PackedVector2Array([c + Vector2(0, -s), c + Vector2(s * 0.35, -s * 0.4), c + Vector2(s * 0.35, s * 0.7), c + Vector2(-s * 0.35, s * 0.7), c + Vector2(-s * 0.35, -s * 0.4)]), col)
		"brake":
			draw_arc(c, s * 0.8, 0, TAU, 32, col, 3.0, true)
			draw_rect(Rect2(c + Vector2(-s * 0.45, -s * 0.12), Vector2(s * 0.9, s * 0.24)), col)
		"pause":
			draw_rect(Rect2(c + Vector2(-s * 0.55, -s * 0.6), Vector2(s * 0.35, s * 1.2)), col)
			draw_rect(Rect2(c + Vector2(s * 0.2, -s * 0.6), Vector2(s * 0.35, s * 1.2)), col)

func _process(_d: float) -> void:
	if visible and player and player.active:
		queue_redraw()
