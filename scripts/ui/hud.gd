class_name Hud
extends Control
## In-game overlay: the bodycam's own burn-in (REC, clock, unit), ammo, a small dot, prompts and messages; the weapon
## slots with the health bar under them, armour and medicine; the reticle of a sight when aimed; a hit marker.

var player: Player
var match_: Match
var results: Control
var rec_label: Label
var cam_label: Label
var ammo_label: Label
var prompt: Label
var msg: Label
var fps: Label
var msg_t := 0.0
var hit_t := 0.0
var deploy_box: PanelContainer
var deploy_label: Label
var deploy_btns := {}            # key -> Button
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
	ammo_label.position = Vector2(-160, -158)
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
		if player.vehicle:
			ammo_label.text = player.vehicle.hud_text()
		elif player.para > 0:
			ammo_label.text = "%d m" % int(player.global_position.y - player.world.height(player.global_position.x, player.global_position.z))
		elif player.dead:
			ammo_label.text = ""
		else:
			ammo_label.text = "%02d | %03d   %s%s" % [w.ammo, w.reserve(), mode, rl]
		if results != null:
			ammo_label.text = ""
		var hint := player.interact_hint() if player.vehicle == null and results == null else ""
		if player.para == 1 and results == null:
			hint = "فتح المظلة (قفز)"
		if hint != "":
			prompt.text = ("زر التفاعل: " if Settings.mobile else "[F] ") + hint
		else:
			prompt.text = ""
	_deploy_ui()
	msg_t -= delta
	hit_t = maxf(hit_t - delta, 0.0)
	msg.modulate.a = clampf(msg_t, 0.0, 1.0)
	fps.visible = bool(Settings.get_v("show_fps"))
	if fps.visible:
		fps.text = "FPS %d" % Engine.get_frames_per_second()
	queue_redraw()

func on_hit() -> void:
	hit_t = 0.25

func _draw() -> void:
	if player == null:
		return
	_status()
	if match_:
		_match_bar()
	if player.vehicle != null and not (player.vehicle is Aircraft):
		return
	var c := size * 0.5
	var w := player.weapon
	var ov := w.overlay() if player.vehicle == null else ""
	if w.ads > 0.85 and player.vehicle == null and player.tpp_k < 0.5 and ov != "":
		_reticle(c, ov, clampf((w.ads - 0.85) / 0.15, 0.0, 1.0))
	elif bool(Settings.get_v("crosshair")):
		var a := 0.75 * (1.0 - w.ads * 0.6)
		draw_circle(c, 2.6, Color(0, 0, 0, a * 0.6))
		draw_circle(c, 1.8, Color(1, 1, 1, a))
	if hit_t > 0.0:
		var k := hit_t / 0.25
		for sg in [Vector2(1, 1), Vector2(-1, 1), Vector2(1, -1), Vector2(-1, -1)]:
			draw_line(c + sg * 7.0, c + sg * 15.0, Color(1, 1, 1, k), 2.5, true)

## what a sight shows: a red dot, a holographic ring, or a scope's black surround with its reticle
func _reticle(c: Vector2, kind: String, a: float) -> void:
	var red := Color(1.0, 0.12, 0.08, a)
	match kind:
		"dot":
			draw_circle(c, 3.2, red)
		"holo":
			draw_arc(c, 22.0, 0, TAU, 48, red, 2.0, true)
			draw_circle(c, 2.4, red)
			for d in [Vector2(0, -1), Vector2(0, 1), Vector2(-1, 0), Vector2(1, 0)]:
				draw_line(c + d * 22.0, c + d * 30.0, red, 2.0, true)
		_:
			var r := minf(size.x, size.y) * 0.46
			var black := Color(0, 0, 0, a)
			# the dark tube around the round view
			draw_rect(Rect2(0, 0, c.x - r, size.y), black)
			draw_rect(Rect2(c.x + r, 0, size.x - c.x - r, size.y), black)
			draw_rect(Rect2(c.x - r, 0, r * 2.0, c.y - r), black)
			draw_rect(Rect2(c.x - r, c.y + r, r * 2.0, size.y - c.y - r), black)
			# the corners between the round view and the square around it
			var rr := r + 6.0
			while rr < r * 1.45:
				draw_arc(c, rr, 0, TAU, 96, black, 14.0, false)
				rr += 12.0
			draw_arc(c, r - 6.0, 0, TAU, 96, Color(0, 0, 0, a * 0.5), 10.0, true)
			var ink := Color(0.02, 0.02, 0.02, a)
			match kind:
				"acog":
					# a red chevron with a drop line
					draw_colored_polygon(PackedVector2Array([c, c + Vector2(-14, 20), c + Vector2(-9, 20), c + Vector2(0, 7), c + Vector2(9, 20), c + Vector2(14, 20)]), red)
					draw_line(c + Vector2(0, 22), c + Vector2(0, r * 0.6), ink, 2.0)
					for k in 4:
						var y := 40.0 + k * 30.0
						draw_line(c + Vector2(-12 + k * 2, y), c + Vector2(12 - k * 2, y), ink, 2.0)
				"mil":
					draw_line(c + Vector2(-r, 0), c + Vector2(-6, 0), ink, 2.0)
					draw_line(c + Vector2(6, 0), c + Vector2(r, 0), ink, 2.0)
					draw_line(c + Vector2(0, -r), c + Vector2(0, -6), ink, 2.0)
					draw_line(c + Vector2(0, 6), c + Vector2(0, r), ink, 2.0)
					for k in range(1, 6):
						for d in [Vector2(1, 0), Vector2(-1, 0), Vector2(0, 1), Vector2(0, -1)]:
							draw_circle(c + d * k * r * 0.12, 2.6, ink)
					draw_line(c + Vector2(-r, 0), c + Vector2(-r * 0.62, 0), ink, 6.0)
					draw_line(c + Vector2(r * 0.62, 0), c + Vector2(r, 0), ink, 6.0)
					draw_line(c + Vector2(0, r * 0.62), c + Vector2(0, r), ink, 6.0)
				_:
					draw_line(c + Vector2(-r, 0), c + Vector2(-4, 0), ink, 1.6)
					draw_line(c + Vector2(4, 0), c + Vector2(r, 0), ink, 1.6)
					draw_line(c + Vector2(0, -r), c + Vector2(0, -4), ink, 1.6)
					draw_line(c + Vector2(0, 4), c + Vector2(0, r), ink, 1.6)
					draw_circle(c, 1.6, red)

## bottom middle: the three weapon slots with their ammunition, and under them the health bar with armour and medicine
func _status() -> void:
	if player.vehicle != null or player.dead or results != null:
		return
	var font := UiTheme.font_bold
	var mono := UiTheme.font_mono
	var W := 420.0
	var x0 := size.x * 0.5 - W * 0.5
	var y0 := size.y - 118.0
	var inv: Dictionary = player.inv
	for i in 3:
		var g: Dictionary = inv["guns"][i]
		var r := Rect2(x0 + i * (W / 3.0) + 3.0, y0, W / 3.0 - 6.0, 34.0)
		var cur := i == int(inv["cur"])
		draw_rect(r, Color(0, 0, 0, 0.45 if cur else 0.25))
		draw_rect(r, Color(1, 1, 1, 0.7 if cur else 0.2), false, 1.5)
		var txt := "%d  —" % (i + 1)
		if not g.is_empty():
			var am := player.weapon.ammo if cur else int(g["ammo"])
			txt = "%d  %s  %d" % [i + 1, String(Guns.DATA[g["id"]]["title"]).split(" ")[0], am]
		draw_string(font, r.position + Vector2(8, 24), txt, HORIZONTAL_ALIGNMENT_LEFT, r.size.x - 10, 17, Color(1, 1, 1, 0.92 if cur else 0.6))
	# health
	var hb := Rect2(x0, y0 + 42.0, W, 12.0)
	draw_rect(hb, Color(0, 0, 0, 0.55))
	var h := clampf(player.health / 100.0, 0.0, 1.0)
	var hc := Color(0.9, 0.92, 0.9) if h > 0.6 else (Color(1.0, 0.75, 0.2) if h > 0.3 else Color(1.0, 0.25, 0.2))
	draw_rect(Rect2(hb.position, Vector2(W * h, 12.0)), hc)
	if player.heal_t >= 0.0:
		var need: float = {"bandage": 3.0, "kit": 5.0, "medkit": 7.0}.get(player.heal_kind, 3.0)
		draw_rect(Rect2(hb.position + Vector2(0, 14), Vector2(W * player.heal_t / need, 3.0)), Color(0.4, 1.0, 0.5, 0.9))
	draw_rect(hb, Color(1, 1, 1, 0.5), false, 1.0)
	# armour and medicine under it
	var meds: Dictionary = inv["meds"]
	var line := "خوذة %d   درع %d   ضمادات %d   إسعافات %d   حقيبة %d" % [int(inv["helmet"]), int(inv["vest"]), int(meds.get("bandage", 0)), int(meds.get("kit", 0)), int(meds.get("medkit", 0))]
	draw_string(font, Vector2(x0, y0 + 76.0), line, HORIZONTAL_ALIGNMENT_CENTER, W, 15, Color(1, 1, 1, 0.75))
	if mono == null:
		return

## top middle: the five zones (our colour, theirs, nobody's) with the capture state, the two scores and the clock;
## top left: the kill feed; markers over team mates
func _match_bar() -> void:
	var font := UiTheme.font_bold
	var n := match_.zones.size()
	var cx := size.x * 0.5
	var y := 34.0
	var ours := Color(0.35, 0.65, 1.0)
	var theirs := Color(1.0, 0.35, 0.3)
	draw_string(font, Vector2(cx - 220, y + 8), "%d" % match_.score[0], HORIZONTAL_ALIGNMENT_RIGHT, 60, 26, ours)
	draw_string(font, Vector2(cx + 160, y + 8), "%d" % match_.score[1], HORIZONTAL_ALIGNMENT_LEFT, 60, 26, theirs)
	for i in n:
		var z: Dictionary = match_.zones[i]
		var c := Vector2(cx + (i - (n - 1) * 0.5) * 50.0, y)
		var o := int(z["owner"])
		var col := ours if o == 0 else (theirs if o == 1 else Color(0.9, 0.9, 0.9))
		draw_circle(c, 18.0, Color(0, 0, 0, 0.5))
		draw_arc(c, 18.0, 0, TAU, 32, Color(col.r, col.g, col.b, 0.9), 3.0, true)
		var pr := float(z["progress"])
		if absf(pr) < 0.999 and absf(pr) > 0.01:
			draw_arc(c, 14.0, -PI * 0.5, -PI * 0.5 + TAU * absf(pr), 32, ours if pr < 0.0 else theirs, 4.0, true)
		var nm := String(z["name"]).substr(0, 1)
		draw_string(font, c + Vector2(-9, 7), nm, HORIZONTAL_ALIGNMENT_CENTER, 18, 18, Color(1, 1, 1))
	var left := maxf(Match.TIME - match_.t, 0.0)
	draw_string(UiTheme.font_mono, Vector2(cx - 40, y + 44), "%02d:%02d" % [int(left) / 60, int(left) % 60], HORIZONTAL_ALIGNMENT_CENTER, 80, 18, Color(1, 1, 1, 0.85))
	# kill feed
	var fy := 150.0
	for f in match_.feed:
		draw_string(font, Vector2(24, fy), String(f["text"]), HORIZONTAL_ALIGNMENT_LEFT, 420, 17, Color(1, 1, 1, clampf(float(f["t"]), 0.0, 1.0)))
		fy += 24.0
	# team mates: a small marker over each one within 150 m
	var cam := get_viewport().get_camera_3d()
	if cam:
		for b in match_.bots:
			if b.dead or b.team != player.team:
				continue
			var p := b.global_position + Vector3(0, 2.2, 0)
			var d := p.distance_to(cam.global_position)
			if d > 150.0 or cam.is_position_behind(p):
				continue
			var sp := cam.unproject_position(p)
			draw_colored_polygon(PackedVector2Array([sp + Vector2(-6, -8), sp + Vector2(6, -8), sp + Vector2(0, 2)]), Color(0.35, 0.65, 1.0, 0.85))
		# friends in the room: a bigger marker, at any distance, with the distance under it
		if match_.coop:
			for r in match_.coop.remotes.values():
				var rs := r as RemoteSoldier
				if rs.dead or rs.team != player.team:
					continue
				var p := rs.global_position + Vector3(0, 2.6, 0)
				if cam.is_position_behind(p):
					continue
				var sp := cam.unproject_position(p)
				draw_colored_polygon(PackedVector2Array([sp + Vector2(-9, -12), sp + Vector2(9, -12), sp + Vector2(0, 3)]), Color(0.3, 0.95, 0.55, 0.95))
				var d := int(p.distance_to(cam.global_position))
				if d > 40:
					draw_string(UiTheme.font_bold, sp + Vector2(-40, -16), "%s  %d م" % [rs.who, d], HORIZONTAL_ALIGNMENT_CENTER, 80, 14, Color(0.6, 1.0, 0.75, 0.9))

## while the player waits for his next life: where to come back (the deployment line, a zone his team holds with no
## enemy near it, the base with the vehicles, or a parachute jump over his side of the city)
func _deploy_ui() -> void:
	var show := player != null and match_ != null and player.dead and player.lives >= 0 and not match_.over
	if not show:
		if deploy_box:
			deploy_box.visible = false
		return
	if deploy_box == null:
		deploy_box = PanelContainer.new()
		deploy_box.add_theme_stylebox_override("panel", UiTheme.box(Color(0.045, 0.045, 0.04, 0.82), Color(0.78, 0.66, 0.42, 0.3), 1, 12, 16.0))
		deploy_box.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
		deploy_box.position = Vector2(-430, -300)
		deploy_box.size = Vector2(860, 0)
		deploy_box.grow_vertical = Control.GROW_DIRECTION_BEGIN
		deploy_box.mouse_filter = Control.MOUSE_FILTER_STOP
		add_child(deploy_box)
		var col := VBoxContainer.new()
		col.add_theme_constant_override("separation", 10)
		deploy_box.add_child(col)
		deploy_label = UiTheme.label("", 24, true)
		deploy_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		col.add_child(deploy_label)
		var row := HBoxContainer.new()
		row.alignment = BoxContainer.ALIGNMENT_CENTER
		row.add_theme_constant_override("separation", 8)
		col.add_child(row)
		var keys := [["deploy", "خط الانتشار"]]
		for i in match_.zones.size():
			keys.append(["zone%d" % i, String(match_.zones[i]["name"])])
		keys.append(["base", "القاعدة"])
		keys.append(["air", "مظلة"])
		var st_n := UiTheme.box(Color(0.1, 0.1, 0.09, 0.9), Color(0.78, 0.66, 0.42, 0.45), 1, 6, 10.0)
		var st_p := UiTheme.box(Color(0.78, 0.66, 0.42, 0.95), Color(0.95, 0.85, 0.6, 1.0), 2, 6, 10.0)
		var st_d := UiTheme.box(Color(0.06, 0.06, 0.05, 0.6), Color(0.3, 0.3, 0.28, 0.4), 1, 6, 10.0)
		for k in keys:
			var b := Button.new()
			b.text = String(k[1])
			b.custom_minimum_size = Vector2(88, 60)
			b.toggle_mode = true
			b.focus_mode = Control.FOCUS_NONE
			b.add_theme_font_size_override("font_size", 20)
			b.add_theme_stylebox_override("normal", st_n)
			b.add_theme_stylebox_override("hover", st_n)
			b.add_theme_stylebox_override("pressed", st_p)
			b.add_theme_stylebox_override("hover_pressed", st_p)
			b.add_theme_stylebox_override("disabled", st_d)
			b.add_theme_color_override("font_pressed_color", Color(0.08, 0.07, 0.05))
			b.add_theme_color_override("font_hover_pressed_color", Color(0.08, 0.07, 0.05))
			b.add_theme_color_override("font_color", Color(0.95, 0.93, 0.88))
			b.add_theme_color_override("font_disabled_color", Color(0.45, 0.44, 0.4))
			var key := String(k[0])
			b.pressed.connect(func(): match_.choice = key)
			row.add_child(b)
			deploy_btns[key] = b
		var help := UiTheme.label("المناطق: التي يملكها فريقك ولا عدو قربها · القاعدة: فيها المركبات · مظلة: قفز فوق جهة فريقك", 16, false, UiTheme.DIM)
		help.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		col.add_child(help)
	deploy_box.visible = true
	if match_.choice.begins_with("zone") and not match_.can_spawn_at(int(match_.choice.substr(4)), player.team):
		match_.choice = "deploy"
	for key in deploy_btns:
		var b: Button = deploy_btns[key]
		if String(key).begins_with("zone"):
			b.disabled = not match_.can_spawn_at(int(String(key).substr(4)), player.team)
		b.set_pressed_no_signal(key == match_.choice)
	deploy_label.text = "تعود بعد %d ث — اختر مكان العودة" % ceili(player.respawn_left())

## the results at the end of the match: won or lost, what you did, the rating points and the tier, the coins
func show_results(r: Dictionary) -> void:
	if results:
		results.queue_free()
	if deploy_box:
		deploy_box.visible = false
	# the game darkened behind the results
	results = ColorRect.new()
	results.color = Color(0, 0, 0, 0.5)
	results.set_anchors_preset(Control.PRESET_FULL_RECT)
	results.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(results)
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", UiTheme.box(Color(0.045, 0.045, 0.04, 0.95), Color(0.78, 0.66, 0.42, 0.4), 1, 14, 22.0))
	panel.set_anchors_preset(Control.PRESET_CENTER)
	panel.position = Vector2(-330, -240)
	panel.size = Vector2(660, 480)
	results.add_child(panel)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 12)
	panel.add_child(v)
	var win := bool(r["win"])
	var draw := bool(r.get("draw", false))
	v.add_child(UiTheme.label("انتصار!" if win else ("تعادل" if draw else "خسارة"), 54, true,
		Color(0.4, 0.9, 0.5) if win else (Color(0.9, 0.85, 0.6) if draw else Color(1.0, 0.4, 0.35))))
	var sc: Array = r["score"]
	for line in ["النتيجة: %d — %d" % [int(sc[0]), int(sc[1])],
			"القتلى: %d   (إصابات رأس %d)   مرات موتك: %d" % [int(r["kills"]), int(r["headshots"]), int(r["deaths"])],
			"مناطق سيطرت عليها: %d" % int(r["zones"]),
			"نقاط التصنيف: %d  (%s%d)" % [int(r["rating"]), "+" if int(r["delta"]) >= 0 else "", int(r["delta"])],
			"الفئة: %s" % String(r["tier"]),
			"العملات: +%d" % int(r["coins"])]:
		v.add_child(UiTheme.label(line, 24))
	var b := Button.new()
	b.text = "العودة إلى القائمة"
	b.custom_minimum_size = Vector2(0, 60)
	b.add_theme_font_size_override("font_size", 24)
	b.add_theme_stylebox_override("normal", UiTheme.box(Color(0.12, 0.11, 0.09, 0.95), Color(0.78, 0.66, 0.42, 0.7), 1, 8, 12.0))
	b.add_theme_stylebox_override("hover", UiTheme.box(Color(0.2, 0.18, 0.14, 0.95), Color(0.95, 0.85, 0.6, 0.9), 1, 8, 12.0))
	b.add_theme_stylebox_override("pressed", UiTheme.box(Color(0.78, 0.66, 0.42, 0.95), Color(0.95, 0.85, 0.6, 1.0), 1, 8, 12.0))
	b.pressed.connect(func(): get_tree().reload_current_scene())
	v.add_child(b)
