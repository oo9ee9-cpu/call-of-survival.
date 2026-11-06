class_name Backpack
extends Control
## The backpack (the bag button, Tab / I): everything the soldier carries, and what lies on the ground beside him.
## Guns: drop one, take its sight off. Medicine: use one now, drop one. Ammunition and armour: drop. Spare sights:
## put one on the gun in hand, or drop it; a sight no gun he carries can take is marked with a small 🚫.
## Things on the ground within 4 m: take them.

signal closed

var player: Player
var list: VBoxContainer
var cols: Array[VBoxContainer] = []

func _init() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	layout_direction = Control.LAYOUT_DIRECTION_RTL
	visible = false

func open(p: Player) -> void:
	player = p
	visible = true
	_build()

func close() -> void:
	visible = false
	closed.emit()

func _gui_input(event: InputEvent) -> void:
	accept_event()

func _build() -> void:
	for c in get_children():
		c.queue_free()
	var bg := ColorRect.new()
	bg.color = Color(0.02, 0.03, 0.04, 0.82)
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(bg)
	var top := HBoxContainer.new()
	top.set_anchors_preset(Control.PRESET_TOP_WIDE)
	top.offset_top = 10
	top.offset_bottom = 60
	top.offset_left = 24
	top.offset_right = -24
	add_child(top)
	var ic := TextureRect.new()
	ic.texture = Lobby.icon("backpack")
	ic.custom_minimum_size = Vector2(40, 40)
	ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	top.add_child(ic)
	top.add_child(UiTheme.label("الحقيبة", 30))
	var sp := Control.new()
	sp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top.add_child(sp)
	var x := _button("إغلاق ✕", Color(0.75, 0.16, 0.12), close)
	top.add_child(x)
	var row := HBoxContainer.new()
	row.set_anchors_preset(Control.PRESET_FULL_RECT)
	row.offset_top = 70
	row.offset_left = 24
	row.offset_right = -24
	row.offset_bottom = -16
	row.add_theme_constant_override("separation", 18)
	add_child(row)
	cols.clear()
	for title in ["الأسلحة", "في الحقيبة", "على الأرض"]:
		var panel := PanelContainer.new()
		var sb := StyleBoxFlat.new()
		sb.bg_color = Color(1, 1, 1, 0.05)
		sb.border_color = Color(1, 1, 1, 0.14)
		sb.set_border_width_all(1)
		sb.set_corner_radius_all(6)
		sb.set_content_margin_all(10)
		panel.add_theme_stylebox_override("panel", sb)
		panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(panel)
		var v := VBoxContainer.new()
		v.add_theme_constant_override("separation", 6)
		panel.add_child(v)
		v.add_child(UiTheme.label(title, 22, true, Color(1.0, 0.82, 0.25)))
		var scroll := ScrollContainer.new()
		scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
		scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
		v.add_child(scroll)
		var inner := VBoxContainer.new()
		inner.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		inner.add_theme_constant_override("separation", 6)
		scroll.add_child(inner)
		cols.append(inner)
	_guns(cols[0])
	_bag(cols[1])
	_ground(cols[2])

# ------------------------------------------------------------------ the three columns
func _guns(v: VBoxContainer) -> void:
	var inv := player.inv
	player.save_ammo()
	for i in 3:
		var g: Dictionary = inv["guns"][i]
		if g.is_empty():
			v.add_child(_row("rifle", "%d — فارغ" % (i + 1), "", [], true))
			continue
		var d: Dictionary = Guns.DATA[g["id"]]
		var sight := String(g.get("sight", ""))
		var info := "%d / %s  —  %s" % [int(g["ammo"]), Guns.CALIBERS.get(d["cal"], d["cal"]), String(Guns.SIGHTS[sight]["title"]) if sight != "" else ("بلا عدسة" if Guns.points(String(g["id"]))["rail"] != Vector3.INF else "لا يقبل عدسة")]
		var acts := [["رمي", func(): player.drop_gun(i); _build()]]
		if sight != "":
			acts.append(["نزع العدسة", func(): player.unmount_sight(i); _build()])
		if i != int(inv["cur"]):
			acts.append(["في اليد", func(): player.switch_weapon(i); _build()])
		v.add_child(_row("rifle", "%d  %s%s" % [i + 1, d["title"], "  ◀" if i == int(inv["cur"]) else ""], info, acts))

func _bag(v: VBoxContainer) -> void:
	var inv := player.inv
	var meds: Dictionary = inv["meds"]
	for k in ["bandage", "kit", "medkit"]:
		var n := int(meds.get(k, 0))
		if n <= 0:
			continue
		var nm: String = {"bandage": "ضمادات", "kit": "إسعافات أولية", "medkit": "حقيبة طبية"}[k]
		var heals: String = {"bandage": "+15 حتى 75", "kit": "حتى 75", "medkit": "حتى 100"}[k]
		v.add_child(_row("heal", "%s ×%d" % [nm, n], heals, [["استخدام", func(): player.use_med(k); close()], ["رمي", func(): player.drop_med(k); _build()]]))
	for cal in inv["ammo"]:
		var n := int(inv["ammo"][cal])
		if n <= 0:
			continue
		var used := false
		for g in inv["guns"]:
			if not (g as Dictionary).is_empty() and String(Guns.DATA[g["id"]]["cal"]) == String(cal):
				used = true
		v.add_child(_row("bullet", "ذخيرة %s ×%d" % [Guns.CALIBERS.get(cal, cal), n], "" if used else "لا يستعملها سلاحك", [["رمي", func(): player.drop_ammo(String(cal)); _build()]], false, not used))
	for k in ["helmet", "vest"]:
		var lv := int(inv[k])
		if lv > 0:
			v.add_child(_row("medal", ("خوذة" if k == "helmet" else "درع") + " مستوى %d" % lv, "", [["رمي", func(): player.drop_armor(k); _build()]]))
	var bag: Array = inv.get("bag", [])
	for i in bag.size():
		var it: Dictionary = bag[i]
		if String(it["type"]) != "sight":
			continue
		var sid := String(it["id"])
		var fits := player.sight_fits(sid)
		var g: Dictionary = inv["guns"][int(inv["cur"])]
		var on_hand: bool = not g.is_empty() and Guns.points(String(g["id"]))["rail"] != Vector3.INF
		var acts := []
		if on_hand:
			acts.append(["تركيب", func(): player.mount_from_bag(i); _build()])
		acts.append(["رمي", func(): player.drop_bag(i); _build()])
		var why := "" if fits else "لا يناسب أي سلاح معك"
		if fits and not on_hand:
			why = "لا يركب على السلاح الذي في يدك"
		v.add_child(_row("scope", String(Guns.SIGHTS[sid]["title"]), why, acts, false, not fits))
	if v.get_child_count() == 0:
		v.add_child(UiTheme.label("الحقيبة فارغة", 18, false, Color(1, 1, 1, 0.6)))

func _ground(v: VBoxContainer) -> void:
	var lt := player._loot()
	var near: Array = lt.nearby(player.global_position, 4.0) if lt else []
	if near.is_empty():
		v.add_child(UiTheme.label("لا شيء قريب منك", 18, false, Color(1, 1, 1, 0.6)))
		return
	for e in near:
		var it: Dictionary = e["item"]
		var t := String(it["type"])
		var ic: String = {"gun": "rifle", "ammo": "bullet", "sight": "scope", "med": "heal", "crate": "crate"}.get(t, "medal")
		var extra := ""
		if t == "ammo" or t == "med":
			extra = "×%d" % int(it.get("n", 1))
		var bad := t == "sight" and not player.sight_fits(String(it["id"]))
		v.add_child(_row(ic, Loot.title(it) + ("  " + extra if extra != "" else ""), "لا يناسب أي سلاح معك" if bad else "", [["أخذ", func(): player.pick_up(e); _build()]], false, bad))

# ------------------------------------------------------------------ pieces
## one line: an icon, the name (with the 🚫 mark when it fits nothing), a note, its buttons
func _row(icon_name: String, title: String, note: String, acts: Array, dim := false, no_fit := false) -> Control:
	var panel := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0, 0, 0, 0.35)
	sb.set_corner_radius_all(5)
	sb.set_content_margin_all(6)
	panel.add_theme_stylebox_override("panel", sb)
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 8)
	panel.add_child(h)
	var ic := TextureRect.new()
	ic.texture = Lobby.icon(icon_name)
	ic.custom_minimum_size = Vector2(34, 34)
	ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	ic.modulate = Color(1, 1, 1, 0.5 if dim else 0.95)
	h.add_child(ic)
	var tv := VBoxContainer.new()
	tv.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tv.add_theme_constant_override("separation", 0)
	h.add_child(tv)
	var th := HBoxContainer.new()
	tv.add_child(th)
	th.add_child(UiTheme.label(title, 18, true, Color(1, 1, 1, 0.55 if dim else 0.95)))
	if no_fit:
		var no := TextureRect.new()
		no.texture = Lobby.icon("no")
		no.custom_minimum_size = Vector2(20, 20)
		no.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		no.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		no.modulate = Color(1, 0.3, 0.25)
		th.add_child(no)
	if note != "":
		tv.add_child(UiTheme.label(note, 14, false, Color(1, 0.55, 0.45) if no_fit else Color(1, 1, 1, 0.62)))
	for a in acts:
		h.add_child(_button(String(a[0]), Color(0.18, 0.4, 0.25) if String(a[0]) in ["استخدام", "تركيب", "أخذ", "في اليد"] else Color(0.3, 0.3, 0.32), a[1]))
	return panel

func _button(text: String, col: Color, cb: Callable) -> Button:
	var b := Button.new()
	b.text = text
	b.focus_mode = Control.FOCUS_NONE
	b.custom_minimum_size = Vector2(86, 40)
	for s in ["normal", "hover", "pressed", "focus"]:
		var sb := StyleBoxFlat.new()
		sb.bg_color = col if s != "pressed" else col.darkened(0.25)
		sb.set_corner_radius_all(5)
		sb.set_content_margin_all(6)
		b.add_theme_stylebox_override(s, sb)
	b.add_theme_font_override("font", UiTheme.font_bold)
	b.add_theme_font_size_override("font_size", 17)
	b.pressed.connect(func():
		Sfx.play("ui_click", -6.0, 0.0, "UI")
		cb.call())
	return b
