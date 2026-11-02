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
	}
	queue_redraw()

func reset() -> void:
	stick_id = -1
	look_ids.clear()
	held.clear()
	if player:
		player.move_in = Vector2.ZERO
		player.touch_sprint = false
		player.weapon.touch_fire = false
	queue_redraw()

func _input(event: InputEvent) -> void:
	if not visible or player == null or not player.active:
		return
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
				player.jump_or_climb()
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
	if player == null or not player.active:
		return
	var op := float(Settings.get_v("touch_opacity"))
	var font := UiTheme.font_bold
	for n in buttons:
		var b: Array = buttons[n]
		var c: Vector2 = b[0]
		var r: float = b[1]
		var on: bool = held.has(n) or (n == "aim" and player.weapon.aim_toggle) or (n == "light" and player.flashlight.visible) or (n == "crouch" and player.crouching)
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
		"pause":
			draw_rect(Rect2(c + Vector2(-s * 0.55, -s * 0.6), Vector2(s * 0.35, s * 1.2)), col)
			draw_rect(Rect2(c + Vector2(s * 0.2, -s * 0.6), Vector2(s * 0.35, s * 1.2)), col)

func _process(_d: float) -> void:
	if visible and player and player.active:
		queue_redraw()
