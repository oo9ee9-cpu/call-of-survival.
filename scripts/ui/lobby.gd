class_name Lobby
extends Control
## The lobby: the camp behind (LobbyScene, its own little 3D world) with the player's soldier in the middle, and over it
## the menus laid out like a battle-royale lobby: the big yellow start button and the mode card (top left), the season,
## ranking and inventory tabs, mail and settings (top), the player's picture, name, level and money (top right), the
## crates, shop and survival pass (right), the login reward card, the bottom bar (friends, chat, missions, events) and
## the game's emblem and name (bottom left). Pressing start looks for players for a few seconds, then the match begins.

signal start_pressed
signal settings_pressed
signal credits_pressed

const OUTFITS := {
	"olive": {"title": "زيتوني", "color": Color(0.46, 0.48, 0.4), "price": 0},
	"desert": {"title": "صحراوي", "color": Color(0.62, 0.52, 0.38), "price": 0},
	"woodland": {"title": "غابات", "color": Color(0.3, 0.36, 0.24), "price": 400},
	"urban": {"title": "رمادي المدن", "color": Color(0.45, 0.46, 0.5), "price": 500},
	"navy": {"title": "كحلي", "color": Color(0.2, 0.25, 0.38), "price": 700},
	"black": {"title": "العمليات الخاصة", "color": Color(0.16, 0.16, 0.18), "price": 900},
	"snow": {"title": "ثلجي", "color": Color(0.82, 0.84, 0.86), "price": 1000},
	"crimson": {"title": "قرمزي", "color": Color(0.45, 0.12, 0.12), "price": 1500},
	"gold": {"title": "ذهبي", "color": Color(0.75, 0.6, 0.25), "price": 3000},
}
const REGIONS := [["me", "الشرق الأوسط"], ["eu", "أوروبا"], ["na", "أمريكا الشمالية"], ["sa", "أمريكا الجنوبية"]]
const DAILY := [50, 80, 100, 120, 150, 200, 250, 500]        # the eight days of the login reward
const GOLD := Color(1.0, 0.82, 0.25)
const ORANGE := Color(0.98, 0.58, 0.14)
const REGION_EN := {"me": "Middle East", "eu": "Europe", "na": "North America", "sa": "South America"}

var prof: Dictionary
var scene: LobbyScene
var preview_soldier: Soldier
var card_photo: TextureRect
var name_label: Label
var level_label: Label
var coins_label: Label
var gems_label: Label
var tickets_label: Label
var status_label: Label
var mode_label: Label
var map_label: Label
var region_label: Label
var invite_label: Label
var daily_label: Label
var overlay: Control
var file_dialog: FileDialog
var start_btn: Button
var start_sub: Label
var players_label: Label
var matching := false
var _wait_t := 0.0
var _wait_need := 0.0

func _init() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	# laid out like the reference picture: the start plate at the left, the shop column at the right
	# (the menus around it are right to left; the panels opened from here are too)
	layout_direction = Control.LAYOUT_DIRECTION_LTR
	mouse_filter = Control.MOUSE_FILTER_IGNORE

func _ready() -> void:
	prof = Profile.load_profile()
	_build()
	var on := get_node_or_null("/root/Online")
	if on:
		on.status_changed.connect(func(t: String): status_label.text = "[النظام]: " + t)
		status_label.text = "[النظام]: " + String(on.status)

func _process(delta: float) -> void:
	if matching:
		_matching_step(delta)

# ------------------------------------------------------------------ small builders
static func icon(nm: String) -> Texture2D:
	return UiTheme.picture("res://textures/ui/icons/%s.png" % nm)

func _lbl(text: String, size: int, bold := true, col := Color(1, 1, 1)) -> Label:
	var l := UiTheme.label(text, size, bold, col)
	l.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.8))
	l.add_theme_constant_override("shadow_offset_x", 2)
	l.add_theme_constant_override("shadow_offset_y", 2)
	l.add_theme_constant_override("outline_size", 4)
	l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.55))
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l

func _at(c: Control, anchor: int, pos: Vector2, size := Vector2.ZERO) -> Control:
	c.set_anchors_preset(anchor)
	c.position = pos
	if size != Vector2.ZERO:
		c.size = size
	add_child(c)
	return c

## an invisible button over a piece of the layout (the whole piece is the touch target)
func _hit(parent: Control, cb: Callable) -> void:
	var b := Button.new()
	b.flat = true
	b.focus_mode = Control.FOCUS_NONE
	b.set_anchors_preset(Control.PRESET_FULL_RECT)
	var empty := StyleBoxEmpty.new()
	for s in ["normal", "hover", "pressed", "focus", "hover_pressed"]:
		b.add_theme_stylebox_override(s, empty)
	b.pressed.connect(func():
		Sfx.play("ui_click", -6.0, 0.0, "UI")
		cb.call())
	parent.add_child(b)

## an icon with its name under it (the right-hand column)
func _side_button(nm: String, text: String, cb: Callable, dot := false) -> Control:
	var box := Control.new()
	box.custom_minimum_size = Vector2(92, 74)
	var ic := TextureRect.new()
	ic.texture = icon(nm)
	ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	ic.position = Vector2(22, 0)
	ic.size = Vector2(48, 46)
	ic.mouse_filter = Control.MOUSE_FILTER_IGNORE
	box.add_child(ic)
	var l := _lbl(text, 15)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.position = Vector2(-14, 46)
	l.size = Vector2(120, 24)
	box.add_child(l)
	if dot:
		_dot(box, Vector2(68, 0))
	_hit(box, cb)
	return box

func _dot(parent: Control, at: Vector2) -> void:
	var d := Panel.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.95, 0.3, 0.15)
	sb.set_corner_radius_all(7)
	d.add_theme_stylebox_override("panel", sb)
	d.position = at
	d.size = Vector2(13, 13)
	d.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(d)

func _icon_text(nm: String, text: String, size: int, icon_size := 30) -> HBoxContainer:
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 8)
	h.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var ic := TextureRect.new()
	ic.texture = icon(nm)
	ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	ic.custom_minimum_size = Vector2(icon_size, icon_size)
	ic.mouse_filter = Control.MOUSE_FILTER_IGNORE
	h.add_child(ic)
	var l := _lbl(text, size)
	h.add_child(l)
	return h

func _btn(text: String, cb: Callable, h := 54) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(0, h)
	b.add_theme_font_size_override("font_size", 24)
	b.pressed.connect(func():
		Sfx.play("ui_click", -6.0, 0.0, "UI")
		cb.call())
	return b

static func level_of(p: Dictionary) -> int:
	var xp := int(p.get("matches", 0)) * 60 + int(p.get("kills", 0)) * 12 + int(p.get("wins", 0)) * 120
	return 1 + int(sqrt(xp / 90.0))

# ------------------------------------------------------------------ the layout
func _build() -> void:
	# the camp, drawn in its own viewport behind everything
	var svc := SubViewportContainer.new()
	svc.set_anchors_preset(Control.PRESET_FULL_RECT)
	svc.stretch = true
	svc.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(svc)
	var vp := SubViewport.new()
	vp.own_world_3d = true
	vp.msaa_3d = Viewport.MSAA_2X
	vp.size = Vector2i(1280, 720)
	svc.add_child(vp)
	scene = LobbyScene.new()
	vp.add_child(scene)
	scene.build()
	preview_soldier = scene.soldier
	preview_soldier.set_outfit.call_deferred(_outfit_color())
	# darker edges at the top and the bottom for the writing
	for top in [true, false]:
		var g := TextureRect.new()
		var gt := GradientTexture2D.new()
		var gr := Gradient.new()
		gr.set_color(0, Color(0, 0, 0, 0.55))
		gr.set_color(1, Color(0, 0, 0, 0.0))
		gt.gradient = gr
		gt.fill_from = Vector2(0, 0) if top else Vector2(0, 1)
		gt.fill_to = Vector2(0, 1) if top else Vector2(0, 0)
		g.texture = gt
		g.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		g.stretch_mode = TextureRect.STRETCH_SCALE
		g.mouse_filter = Control.MOUSE_FILTER_IGNORE
		g.set_anchors_preset(Control.PRESET_TOP_WIDE if top else Control.PRESET_BOTTOM_WIDE)
		g.offset_top = 0 if top else -230
		g.offset_bottom = 120 if top else 0
		add_child(g)
	_start_block()
	_top_bar()
	_player_block()
	_side_column()
	_events_card()
	_bottom_bar()
	_logo()
	_refresh_card()

## a gradient strip (vertical unless `across`)
func _grad(c0: Color, c1: Color, across := false) -> TextureRect:
	var g := TextureRect.new()
	var gt := GradientTexture2D.new()
	var gr := Gradient.new()
	gr.set_color(0, c0)
	gr.set_color(1, c1)
	gt.gradient = gr
	gt.fill_from = Vector2(0, 0)
	gt.fill_to = Vector2(1, 0) if across else Vector2(0, 1)
	g.texture = gt
	g.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	g.stretch_mode = TextureRect.STRETCH_SCALE
	g.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return g

func _tex_rect(tex: Texture2D, pos: Vector2, sz: Vector2, cover := false) -> TextureRect:
	var t := TextureRect.new()
	t.texture = tex
	t.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	t.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED if cover else TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	t.position = pos
	t.size = sz
	t.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return t

## a dark, slightly see-through tile (the small buttons at the sides)
func _tile(pos: Vector2, sz: Vector2, anchor: int, alpha := 0.5) -> Panel:
	var p := Panel.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.04, 0.04, 0.04, alpha)
	sb.border_color = Color(1, 1, 1, 0.16)
	sb.set_border_width_all(1)
	sb.set_corner_radius_all(3)
	p.add_theme_stylebox_override("panel", sb)
	_at(p, anchor, pos, sz)
	return p

## a small upward chevron (the bottom bar's «more» arrows)
func _chevron(parent: Control, at: Vector2) -> void:
	var l := Line2D.new()
	l.points = PackedVector2Array([Vector2(0, 8), Vector2(8, 0), Vector2(16, 8)])
	l.width = 2.5
	l.default_color = Color(0.85, 0.85, 0.85)
	l.position = at
	parent.add_child(l)

func _start_block() -> void:
	# the big yellow start plate
	start_btn = Button.new()
	start_btn.text = "بدء"
	start_btn.focus_mode = Control.FOCUS_NONE
	for s in ["normal", "hover", "pressed", "focus"]:
		var sb := StyleBoxFlat.new()
		sb.bg_color = Color(0.92, 0.75, 0.12) if s != "pressed" else Color(0.78, 0.62, 0.08)
		sb.border_color = Color(0.64, 0.48, 0.05)
		sb.set_border_width_all(2)
		sb.set_corner_radius_all(2)
		sb.shadow_color = Color(0, 0, 0, 0.4)
		sb.shadow_size = 5
		sb.shadow_offset = Vector2(0, 2)
		start_btn.add_theme_stylebox_override(s, sb)
	start_btn.add_theme_font_override("font", UiTheme.font_bold)
	start_btn.add_theme_font_size_override("font_size", 44)
	for c in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color"]:
		start_btn.add_theme_color_override(c, Color(0.27, 0.17, 0.02))
	start_btn.pressed.connect(_start_matchmaking)
	_at(start_btn, Control.PRESET_TOP_LEFT, Vector2(19, 17), Vector2(278, 82))
	# light across the plate, brightest at the top left
	var sheen := _grad(Color(1, 1, 0.85, 0.34), Color(1, 1, 1, 0.0))
	(sheen.texture as GradientTexture2D).fill_to = Vector2(0.8, 1.0)
	sheen.set_anchors_preset(Control.PRESET_FULL_RECT)
	start_btn.add_child(sheen)
	# while looking for players: the clock and how many were found, along the bottom of the plate
	start_sub = _lbl("", 15, true, Color(0.27, 0.17, 0.02))
	start_sub.remove_theme_color_override("font_outline_color")
	start_sub.add_theme_constant_override("outline_size", 0)
	start_sub.add_theme_color_override("font_shadow_color", Color(1, 1, 1, 0.0))
	start_sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	start_sub.position = Vector2(0, 55)
	start_sub.size = Vector2(278, 24)
	start_sub.visible = false
	start_btn.add_child(start_sub)
	# the mode card under it: the transport plane, the region, the mode, the map, the squad
	var card := Panel.new()
	var sbc := StyleBoxFlat.new()
	sbc.bg_color = Color(0.1, 0.1, 0.1, 0.85)
	card.add_theme_stylebox_override("panel", sbc)
	card.clip_contents = true
	_at(card, Control.PRESET_TOP_LEFT, Vector2(17, 110), Vector2(280, 130))
	var p := "res://textures/ui/mode_card.jpg"
	card.add_child(_tex_rect(load(p) if ResourceLoader.exists(p) else _mode_thumb(), Vector2.ZERO, Vector2(280, 130), true))
	var top_shade := _grad(Color(0, 0, 0, 0.55), Color(0, 0, 0, 0.0))
	top_shade.position = Vector2.ZERO
	top_shade.size = Vector2(280, 40)
	card.add_child(top_shade)
	var bot_shade := _grad(Color(0, 0, 0, 0.0), Color(0, 0, 0, 0.78))
	bot_shade.position = Vector2(0, 50)
	bot_shade.size = Vector2(280, 80)
	card.add_child(bot_shade)
	var edge := ColorRect.new()
	edge.color = ORANGE
	edge.size = Vector2(4, 130)
	edge.mouse_filter = Control.MOUSE_FILTER_IGNORE
	card.add_child(edge)
	region_label = _lbl("", 15, false, Color(0.92, 0.92, 0.92))
	region_label.position = Vector2(12, 5)
	region_label.size = Vector2(150, 22)
	card.add_child(region_label)
	var sel := _lbl("Select بدء  »", 15, true, ORANGE)
	sel.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	sel.position = Vector2(140, 5)
	sel.size = Vector2(132, 22)
	card.add_child(sel)
	mode_label = _lbl("", 25)
	mode_label.position = Vector2(12, 64)
	mode_label.size = Vector2(262, 36)
	card.add_child(mode_label)
	map_label = _lbl("", 14, false, Color(0.92, 0.92, 0.92))
	map_label.position = Vector2(12, 103)
	map_label.size = Vector2(190, 22)
	card.add_child(map_label)
	var pl := _icon_text("players", "1", 15, 20)
	players_label = pl.get_child(1)
	pl.position = Vector2(218, 102)
	card.add_child(pl)
	_hit(card, _mode_panel)
	_refresh_mode()
	# «how to play», under the card and again under the logo
	for at in [[Control.PRESET_TOP_LEFT, Vector2(8, 327)], [Control.PRESET_BOTTOM_LEFT, Vector2(30, -120)]]:
		var t := _tile(at[1], Vector2(62, 54), int(at[0]))
		t.add_child(_tex_rect(icon("tutorial"), Vector2(15, 5), Vector2(32, 26)))
		var l := _lbl("Tutorial", 13)
		l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		l.position = Vector2(0, 31)
		l.size = Vector2(62, 20)
		t.add_child(l)
		_hit(t, _tutorial)

func _mode_thumb() -> Texture2D:
	# without the rendered card: the plane icon over a dusk sky
	var img := Image.create(280, 130, false, Image.FORMAT_RGBA8)
	for y in 130:
		var c := Color(0.95, 0.7, 0.4).lerp(Color(0.45, 0.4, 0.3), y / 129.0)
		for x in 280:
			img.set_pixel(x, y, c)
	var plane: Texture2D = icon("plane")
	if plane:
		var pi := plane.get_image()
		pi.resize(90, 90)
		img.blend_rect(pi, Rect2i(0, 0, 90, 90), Vector2i(150, 18))
	return ImageTexture.create_from_image(img)

func _refresh_mode() -> void:
	var m := String(Settings.get_v("map"))
	var rid := String(Settings.get_v("region"))
	region_label.text = String(REGION_EN.get(rid, "Middle East"))
	var n: int = [10, 20, 30, 50][clampi(int(Settings.get_v("team_size")), 0, 3)]
	mode_label.text = "Classic الكلاسيكي" if String(Settings.get_v("mode")) == "domination" else "Free حر"
	map_label.text = "Map: " + ("الوادي" if m == "valley" else "الجبهة")
	players_label.text = str(n)

func _top_bar() -> void:
	# a dark band behind the right end, fading out to the left
	var band := _grad(Color(0, 0, 0, 0.0), Color(0, 0, 0, 0.62), true)
	band.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	band.offset_left = -660
	band.offset_right = 0
	band.offset_top = 0
	band.offset_bottom = 58
	add_child(band)
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 12)
	h.alignment = BoxContainer.ALIGNMENT_END
	h.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_at(h, Control.PRESET_TOP_RIGHT, Vector2(-580, 6), Vector2(566, 46))
	var items := [["موسم", _season, false, 84], ["تصنيف", _ranking, false, 96], ["المخزون", _inventory, true, 112]]
	for i in items.size():
		var it: Array = items[i]
		var b := Control.new()
		b.custom_minimum_size = Vector2(float(it[3]), 46)
		var l := _lbl(String(it[0]), 29)
		l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		l.set_anchors_preset(Control.PRESET_FULL_RECT)
		b.add_child(l)
		if bool(it[2]):
			_dot(b, Vector2(float(it[3]) - 6, 0))
		_hit(b, it[1])
		h.add_child(b)
		if i < items.size() - 1:
			var sep := ColorRect.new()
			sep.color = Color(1, 1, 1, 0.32)
			sep.custom_minimum_size = Vector2(1, 30)
			sep.size_flags_vertical = Control.SIZE_SHRINK_CENTER
			sep.mouse_filter = Control.MOUSE_FILTER_IGNORE
			h.add_child(sep)
	var gap := Control.new()
	gap.custom_minimum_size = Vector2(8, 10)
	gap.mouse_filter = Control.MOUSE_FILTER_IGNORE
	h.add_child(gap)
	for nm in ["mail", "gear"]:
		var b := Control.new()
		b.custom_minimum_size = Vector2(40, 46)
		b.add_child(_tex_rect(icon(nm), Vector2(3, 8), Vector2(34, 30)))
		_hit(b, _mail if nm == "mail" else _gear_menu)
		h.add_child(b)

func _player_block() -> void:
	# the picture at the right edge, the name left of it, the level in a hexagon
	var frame := Panel.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.1, 0.1, 0.1, 0.85)
	sb.border_color = Color(0.92, 0.92, 0.92, 0.9)
	sb.set_border_width_all(2)
	frame.add_theme_stylebox_override("panel", sb)
	_at(frame, Control.PRESET_TOP_RIGHT, Vector2(-64, 60), Vector2(54, 54))
	card_photo = _tex_rect(null, Vector2(2, 2), Vector2(50, 50), true)
	frame.add_child(card_photo)
	_load_photo()
	_hit(frame, _profile_panel)
	name_label = _lbl("", 22)
	name_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	name_label.clip_text = true
	_at(name_label, Control.PRESET_TOP_RIGHT, Vector2(-300, 70), Vector2(226, 32))
	var hex := Control.new()
	hex.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_at(hex, Control.PRESET_TOP_RIGHT, Vector2(-340, 66), Vector2(32, 36))
	var pts := PackedVector2Array()
	for k in 6:
		var a := PI / 6.0 + k * PI / 3.0
		pts.append(Vector2(16, 18) + Vector2(cos(a), sin(a)) * 16.0)
	var fill := Polygon2D.new()
	fill.polygon = pts
	fill.color = Color(0.08, 0.08, 0.08, 0.7)
	hex.add_child(fill)
	var ring := Line2D.new()
	pts.append(pts[0])
	ring.points = pts
	ring.width = 2.0
	ring.default_color = Color(0.92, 0.92, 0.92)
	hex.add_child(ring)
	level_label = _lbl("1", 18)
	level_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	level_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	level_label.set_anchors_preset(Control.PRESET_FULL_RECT)
	hex.add_child(level_label)
	var line := ColorRect.new()
	line.color = Color(1, 1, 1, 0.28)
	line.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_at(line, Control.PRESET_TOP_RIGHT, Vector2(-350, 118), Vector2(340, 1))
	# money, a column at the right edge
	var labels: Array[Label] = []
	for i in 3:
		var r := _icon_text(["coin", "gem", "ticket"][i], "0", 20, 24)
		_at(r, Control.PRESET_TOP_RIGHT, Vector2(-112, 127 + i * 31), Vector2(70, 28))
		labels.append(r.get_child(1) as Label)
	coins_label = labels[0]
	gems_label = labels[1]
	tickets_label = labels[2]
	var plus := _tile(Vector2(-40, 189), Vector2(26, 26), Control.PRESET_TOP_RIGHT, 0.6)
	var pl := _lbl("+", 22)
	pl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	pl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	pl.set_anchors_preset(Control.PRESET_FULL_RECT)
	plus.add_child(pl)
	_hit(plus, _store)

func _side_column() -> void:
	var specs := [["crate", "Crates", _crates, true, 240], ["shop", "Shop", _store, true, 318], ["pass", "Survival Pass", _pass, false, 396]]
	for s in specs:
		var b := _side_button(String(s[0]), String(s[1]), s[2], bool(s[3]))
		_at(b, Control.PRESET_TOP_RIGHT, Vector2(-96, float(s[4])), Vector2(92, 74))

func _events_card() -> void:
	# the login reward banner over the bottom right
	var card := Panel.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.08, 0.09, 0.1, 0.9)
	sb.border_color = Color(1, 1, 1, 0.3)
	sb.set_border_width_all(1)
	card.add_theme_stylebox_override("panel", sb)
	card.clip_contents = true
	_at(card, Control.PRESET_BOTTOM_RIGHT, Vector2(-292, -234), Vector2(224, 114))
	var p := "res://textures/ui/events_banner.jpg"
	if ResourceLoader.exists(p):
		card.add_child(_tex_rect(load(p), Vector2(1, 1), Vector2(222, 112), true))
	else:
		var ic := _tex_rect(icon("events"), Vector2(70, 8), Vector2(84, 64))
		ic.modulate = GOLD
		card.add_child(ic)
	var shade := _grad(Color(0, 0, 0, 0.0), Color(0, 0, 0, 0.82))
	shade.position = Vector2(0, 56)
	shade.size = Vector2(224, 58)
	card.add_child(shade)
	var t := _lbl("مكافأة تسجيل الدخول 8 أيام", 17)
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	t.position = Vector2(4, 82)
	t.size = Vector2(216, 28)
	card.add_child(t)
	daily_label = _lbl("", 13, true, GOLD)
	daily_label.position = Vector2(8, 3)
	daily_label.size = Vector2(208, 20)
	card.add_child(daily_label)
	_hit(card, _daily)
	# the arrows and the events tab beside it
	var arr := _tile(Vector2(-62, -234), Vector2(44, 36), Control.PRESET_BOTTOM_RIGHT, 0.55)
	var al := _lbl("»", 28)
	al.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	al.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	al.set_anchors_preset(Control.PRESET_FULL_RECT)
	arr.add_child(al)
	_hit(arr, _events)
	var ev := _tile(Vector2(-62, -192), Vector2(44, 72), Control.PRESET_BOTTOM_RIGHT, 0.55)
	ev.add_child(_tex_rect(icon("events"), Vector2(6, 6), Vector2(32, 32)))
	var el := _lbl("EVENTS", 10)
	el.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	el.position = Vector2(0, 44)
	el.size = Vector2(44, 20)
	ev.add_child(el)
	_hit(ev, _events)
	# «report», just over the bottom bar
	var rep := _tile(Vector2(-84, -104), Vector2(70, 32), Control.PRESET_BOTTOM_RIGHT, 0.45)
	var rl := _lbl("Report", 15, false, Color(0.82, 0.82, 0.82))
	rl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	rl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	rl.set_anchors_preset(Control.PRESET_FULL_RECT)
	rep.add_child(rl)
	_dot(rep, Vector2(62, -5))
	_hit(rep, _report)

func _bottom_bar() -> void:
	var bar := Panel.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.03, 0.03, 0.04, 0.8)
	bar.add_theme_stylebox_override("panel", sb)
	bar.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	bar.offset_top = -56
	bar.offset_bottom = 0
	bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(bar)
	# the right end, a shade darker
	var dark := ColorRect.new()
	dark.color = Color(0, 0, 0, 0.32)
	dark.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_at(dark, Control.PRESET_BOTTOM_RIGHT, Vector2(-376, -56), Vector2(376, 56))
	# friends: the icon, «Invite Friends», how many, an arrow
	var fr := Control.new()
	_at(fr, Control.PRESET_BOTTOM_LEFT, Vector2(0, -56), Vector2(330, 56))
	fr.add_child(_tex_rect(icon("friends"), Vector2(20, 12), Vector2(36, 32)))
	var l1 := _lbl("Invite Friends", 17, false)
	l1.position = Vector2(110, 14)
	l1.size = Vector2(124, 28)
	fr.add_child(l1)
	invite_label = _lbl("0/5", 20)
	invite_label.position = Vector2(240, 12)
	invite_label.size = Vector2(44, 30)
	fr.add_child(invite_label)
	_chevron(fr, Vector2(292, 23))
	_hit(fr, _friends)
	var sep := ColorRect.new()
	sep.color = Color(1, 1, 1, 0.18)
	sep.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_at(sep, Control.PRESET_BOTTOM_LEFT, Vector2(346, -46), Vector2(1, 36))
	# world chat: the icon, «World», the last line, the copyright under it
	var ch := Control.new()
	_at(ch, Control.PRESET_BOTTOM_LEFT, Vector2(350, -56), Vector2(520, 56))
	ch.add_child(_tex_rect(icon("chat"), Vector2(28, 14), Vector2(30, 28)))
	var w := _lbl("World", 17, true, Color(0.45, 0.66, 1.0))
	w.position = Vector2(104, 8)
	w.size = Vector2(56, 26)
	ch.add_child(w)
	status_label = _lbl("", 16, false, Color(0.95, 0.95, 0.95))
	status_label.position = Vector2(164, 8)
	status_label.size = Vector2(330, 26)
	status_label.clip_text = true
	ch.add_child(status_label)
	var cp := _lbl("© Call of Survival, all rights reserved.", 11, false, Color(0.72, 0.72, 0.72))
	cp.position = Vector2(164, 34)
	cp.size = Vector2(330, 18)
	ch.add_child(cp)
	_hit(ch, _friends)
	var flag := _tex_rect(icon("flag"), Vector2(-428, -44), Vector2(26, 30))
	_at(flag, Control.PRESET_BOTTOM_RIGHT, Vector2(-430, -44), Vector2(26, 30))
	# missions and events, then the arrow to everything else
	var specs := [["missions", "مهمات", _missions, -340], ["events", "فعاليات", _events, -196]]
	for s in specs:
		var b := Control.new()
		_at(b, Control.PRESET_BOTTOM_RIGHT, Vector2(float(s[3]), -56), Vector2(132, 56))
		b.add_child(_tex_rect(icon(String(s[0])), Vector2(4, 12), Vector2(30, 32)))
		var l := _lbl(String(s[1]), 22)
		l.position = Vector2(40, 9)
		l.size = Vector2(90, 36)
		b.add_child(l)
		_dot(b, Vector2(30, 6))
		_hit(b, s[2])
	var more := Control.new()
	_at(more, Control.PRESET_BOTTOM_RIGHT, Vector2(-50, -56), Vector2(44, 56))
	_chevron(more, Vector2(12, 23))
	_hit(more, _gear_menu)

func _logo() -> void:
	var p := "res://textures/ui/logo.png"
	if ResourceLoader.exists(p):
		var t := _tex_rect(load(p), Vector2.ZERO, Vector2(380, 239))
		_at(t, Control.PRESET_BOTTOM_LEFT, Vector2(22, -362), Vector2(380, 239))
		return
	var box := Control.new()
	box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_at(box, Control.PRESET_BOTTOM_LEFT, Vector2(16, -362), Vector2(400, 239))
	var em := _tex_rect(icon("emblem"), Vector2(145, 0), Vector2(110, 110))
	box.add_child(em)
	for row in [["CALL OF SURVIVAL", 46, 106], ["نداء البقاء", 54, 150]]:
		var l := Label.new()
		l.text = String(row[0])
		l.add_theme_font_override("font", UiTheme.font_bold)
		l.add_theme_font_size_override("font_size", int(row[1]))
		l.add_theme_color_override("font_color", Color(0.86, 0.84, 0.8))
		l.add_theme_color_override("font_outline_color", Color(0.12, 0.08, 0.05))
		l.add_theme_constant_override("outline_size", 12)
		l.position = Vector2(0, float(row[2]))
		l.size = Vector2(400, 70)
		l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		l.mouse_filter = Control.MOUSE_FILTER_IGNORE
		box.add_child(l)

## «report»: a few words about a problem, kept on the phone with the date
func _report() -> void:
	var v := _open("إبلاغ")
	v.add_child(UiTheme.label("صف المشكلة أو اللاعب الذي تريد الإبلاغ عنه:", 22, false))
	var te := TextEdit.new()
	te.custom_minimum_size = Vector2(0, 220)
	te.add_theme_font_size_override("font_size", 22)
	v.add_child(te)
	var note := UiTheme.label("", 20, false, GOLD)
	v.add_child(_btn("حفظ البلاغ", func():
		var t := te.text.strip_edges()
		if t == "":
			return
		var f := FileAccess.open("user://reports.txt", FileAccess.READ_WRITE if FileAccess.file_exists("user://reports.txt") else FileAccess.WRITE)
		if f:
			f.seek_end()
			f.store_line("[%s] %s" % [Time.get_datetime_string_from_system(), t.replace("\n", " ")])
			f.close()
		te.text = ""
		note.text = "حُفظ البلاغ في سجل اللعبة على هذا الهاتف."))
	v.add_child(note)

# ------------------------------------------------------------------ the card's values
func _outfit_color() -> Color:
	return (OUTFITS.get(String(prof.get("outfit", "olive")), OUTFITS["olive"]) as Dictionary)["color"]

func _refresh_card() -> void:
	prof = Profile.load_profile()
	name_label.text = String(prof["name"])
	level_label.text = str(level_of(prof))
	coins_label.text = _thousands(int(prof["coins"]))
	gems_label.text = str(int(prof.get("gems", 0)))
	tickets_label.text = "%d  +" % int(prof.get("tickets", 0))
	var day := int(prof.get("daily_day", 0))
	daily_label.text = "اليوم %d من 8 — %s" % [mini(day + 1, 8), "استلم الآن" if _daily_ready() else "عد غداً"]
	invite_label.text = "%d/5" % mini((prof.get("friends", []) as Array).size(), 5)

static func _thousands(n: int) -> String:
	var s := str(absi(n))
	var out := ""
	while s.length() > 3:
		out = "," + s.substr(s.length() - 3) + out
		s = s.substr(0, s.length() - 3)
	return ("-" if n < 0 else "") + s + out

func _set_name(t: String) -> void:
	t = t.strip_edges()
	if t == "" or t == String(prof["name"]):
		return
	prof["name"] = t
	Profile.save_profile(prof)
	var on := get_node_or_null("/root/Online")
	if on and on.signed():
		on.upsert_profile()
	_refresh_card()

func _set_map(m: String) -> void:
	if m == String(Settings.get_v("map")):
		return
	Settings.set_v("map", m)
	# the other map has to be built: start again
	get_tree().reload_current_scene()

# ------------------------------------------------------------------ start: looking for players
func _start_matchmaking() -> void:
	Sfx.play("ui_click", -4.0, 0.0, "UI")
	if matching:
		_stop_matching()
		return
	matching = true
	_wait_t = 0.0
	_wait_need = randf_range(3.5, 6.0)
	start_btn.text = "إلغاء"
	start_btn.add_theme_font_size_override("font_size", 30)
	start_sub.visible = true
	_matching_step(0.0)

func _stop_matching() -> void:
	matching = false
	start_btn.text = "بدء"
	start_btn.add_theme_font_size_override("font_size", 44)
	start_sub.visible = false

func _matching_step(delta: float) -> void:
	_wait_t += delta
	var found := mini(int(_wait_t / _wait_need * 99.0) + 1, 100)
	start_sub.text = "جارٍ المطابقة  %02d:%02d   %d/100" % [int(_wait_t) / 60, int(_wait_t) % 60, found]
	if _wait_t >= _wait_need:
		_stop_matching()
		start_pressed.emit()

# ------------------------------------------------------------------ the photo from the phone
func _pick_photo() -> void:
	if file_dialog == null:
		file_dialog = FileDialog.new()
		file_dialog.file_mode = FileDialog.FILE_MODE_OPEN_FILE
		file_dialog.access = FileDialog.ACCESS_FILESYSTEM
		file_dialog.filters = PackedStringArray(["*.png, *.jpg, *.jpeg, *.webp ; الصور"])
		file_dialog.use_native_dialog = true
		file_dialog.file_selected.connect(_photo_chosen)
		add_child(file_dialog)
	file_dialog.popup_centered_ratio(0.8)

func _photo_chosen(path: String) -> void:
	var img := Image.load_from_file(path)
	if img == null or img.is_empty():
		return
	var s := mini(img.get_width(), img.get_height())
	img = img.get_region(Rect2i((img.get_width() - s) / 2, (img.get_height() - s) / 2, s, s))
	img.resize(256, 256, Image.INTERPOLATE_LANCZOS)
	img.save_png("user://avatar.png")
	prof["photo"] = "user://avatar.png"
	Profile.save_profile(prof)
	_load_photo()

func _load_photo() -> void:
	if FileAccess.file_exists("user://avatar.png"):
		var img := Image.load_from_file("user://avatar.png")
		if img:
			card_photo.texture = ImageTexture.create_from_image(img)
			return
	# no photo yet: a plain silhouette
	var img2 := Image.create(64, 64, false, Image.FORMAT_RGBA8)
	img2.fill(Color(0.18, 0.2, 0.18))
	for y in 64:
		for x in 64:
			var d1 := Vector2(x - 32, y - 24).length()
			var d2 := Vector2((x - 32) * 0.7, y - 64).length()
			if d1 < 12.0 or d2 < 26.0:
				img2.set_pixel(x, y, Color(0.45, 0.47, 0.42))
	card_photo.texture = ImageTexture.create_from_image(img2)

# ------------------------------------------------------------------ screens over the lobby
func _open(title: String) -> VBoxContainer:
	if overlay:
		overlay.queue_free()
	overlay = Control.new()
	overlay.set_anchors_preset(Control.PRESET_FULL_RECT)
	overlay.layout_direction = Control.LAYOUT_DIRECTION_RTL
	add_child(overlay)
	var bg := ColorRect.new()
	bg.color = Color(0, 0, 0, 0.6)
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	overlay.add_child(bg)
	var pc := PanelContainer.new()
	pc.set_anchors_preset(Control.PRESET_CENTER)
	pc.position = Vector2(-430, -310)
	pc.size = Vector2(860, 620)
	overlay.add_child(pc)
	var sc := ScrollContainer.new()
	sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	pc.add_child(sc)
	var v := VBoxContainer.new()
	v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	v.add_theme_constant_override("separation", 12)
	sc.add_child(v)
	var top := HBoxContainer.new()
	v.add_child(top)
	var t := UiTheme.label(title, 34, true)
	t.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top.add_child(t)
	top.add_child(_btn("إغلاق", _close, 46))
	return v

func _close() -> void:
	if overlay:
		overlay.queue_free()
		overlay = null
	_refresh_card()
	_refresh_mode()

## map, mode, region and the size of the teams
func _mode_panel() -> void:
	var v := _open("اختيار المباراة")
	var maps := OptionButton.new()
	maps.add_item("الوادي ٨×٨ كم")
	maps.add_item("الجبهة ٣×٣ كم")
	maps.select(0 if String(Settings.get_v("map")) == "valley" else 1)
	maps.item_selected.connect(func(i): _set_map(["valley", "front"][i]))
	v.add_child(_labeled("الخريطة", maps))
	var mode := OptionButton.new()
	mode.add_item("سيطرة — فريقان")
	mode.add_item("حر — بلا مباراة")
	mode.select(0 if String(Settings.get_v("mode")) == "domination" else 1)
	mode.item_selected.connect(func(i): Settings.set_v("mode", ["domination", "free"][i]))
	v.add_child(_labeled("النمط", mode))
	var size := OptionButton.new()
	for n in [10, 20, 30, 50]:
		size.add_item("%d ضد %d" % [n, n])
	size.select(clampi(int(Settings.get_v("team_size")), 0, 3))
	size.item_selected.connect(func(i): Settings.set_v("team_size", i))
	v.add_child(_labeled("الجنود", size))
	var reg := OptionButton.new()
	for r in REGIONS:
		reg.add_item(String(r[1]))
	var ri := 0
	for k in REGIONS.size():
		if String(REGIONS[k][0]) == String(Settings.get_v("region")):
			ri = k
	reg.select(ri)
	reg.item_selected.connect(func(i): Settings.set_v("region", REGIONS[i][0]))
	v.add_child(_labeled("الخادم", reg))
	v.add_child(UiTheme.label("المباراة تبدأ بطائرة نقل تعبر فوق الخريطة: اقفز متى شئت وانزل بالمظلة.", 18, false, UiTheme.DIM))

func _labeled(text: String, w: Control) -> HBoxContainer:
	var h := HBoxContainer.new()
	var l := UiTheme.label(text, 22)
	l.custom_minimum_size = Vector2(130, 0)
	h.add_child(l)
	w.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	w.custom_minimum_size = Vector2(0, 50)
	h.add_child(w)
	return h

func _gear_menu() -> void:
	var v := _open("القائمة")
	v.add_child(_btn("الإعدادات", func():
		_close()
		settings_pressed.emit()))
	v.add_child(_btn("حول اللعبة والحقوق", func():
		_close()
		credits_pressed.emit()))
	v.add_child(_btn("الخروج من اللعبة", func(): Sfx.quit_game()))

## the player's card: picture, name, ID, totals
func _profile_panel() -> void:
	var v := _open("بطاقتي")
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 16)
	v.add_child(h)
	var ph := TextureRect.new()
	ph.texture = card_photo.texture
	ph.custom_minimum_size = Vector2(140, 140)
	ph.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	ph.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	h.add_child(ph)
	var col := VBoxContainer.new()
	col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	h.add_child(col)
	var nm := LineEdit.new()
	nm.text = String(prof["name"])
	nm.max_length = 18
	nm.custom_minimum_size = Vector2(0, 50)
	nm.text_submitted.connect(_set_name)
	nm.focus_exited.connect(func(): _set_name(nm.text))
	col.add_child(nm)
	col.add_child(_btn("تغيير الصورة", _pick_photo, 46))
	var r := int(prof["rating"])
	v.add_child(UiTheme.label("المعرّف: %s — أعطه لأصدقائك ليجدوك" % prof["id"], 22, true, UiTheme.ACCENT))
	v.add_child(UiTheme.label("المستوى %d — %s — %d نقطة" % [level_of(prof), Match.tier_of(r), r], 22))
	v.add_child(UiTheme.label("المباريات %d   الانتصارات %d   القتلى %d" % [int(prof["matches"]), int(prof["wins"]), int(prof["kills"])], 20))

## the season: the tiers and how far the player is
func _season() -> void:
	var v := _open("الموسم")
	var r := int(prof["rating"])
	v.add_child(UiTheme.label("فئتك: %s — %d نقطة" % [Match.tier_of(r), r], 26, true, GOLD))
	for k in Match.TIERS.size():
		var t: Array = Match.TIERS[k]
		var nxt := int(Match.TIERS[k + 1][0]) if k + 1 < Match.TIERS.size() else 99999
		var here := r >= int(t[0]) and r < nxt
		v.add_child(UiTheme.label("%s %s — من %d نقطة" % ["▶" if here else "  ", String(t[1]), int(t[0])], 21, here, GOLD if here else UiTheme.TEXT))
	v.add_child(UiTheme.label("تربح النقاط بالفوز والقتلى والمناطق، وتخسرها بالهزيمة.", 18, false, UiTheme.DIM))

## the ranking: the player among his friends
func _ranking() -> void:
	var v := _open("التصنيف")
	v.add_child(UiTheme.label("%s — %d نقطة (المستوى %d)" % [prof["name"], int(prof["rating"]), level_of(prof)], 24, true, GOLD))
	var on := get_node_or_null("/root/Online")
	if on == null or not on.signed():
		v.add_child(UiTheme.label("اتصل بالإنترنت لترى تصنيف أصدقائك.", 20, false, UiTheme.DIM))
		return
	var fr: Array = await on.friends()
	if fr.is_empty():
		v.add_child(UiTheme.label("أضف أصدقاء لتتنافسوا في التصنيف.", 20, false, UiTheme.DIM))
	for f in fr:
		var d: Dictionary = f
		v.add_child(UiTheme.label("%s (%s)" % [d.get("name", "?"), d.get("public_id", "")], 20))

## the inventory: the outfits the player owns
func _inventory() -> void:
	var v := _open("المخزون")
	v.add_child(UiTheme.label("ملابسك — اختر ما يرتديه جنديك", 20, false, UiTheme.DIM))
	var grid := GridContainer.new()
	grid.columns = 3
	grid.add_theme_constant_override("h_separation", 12)
	grid.add_theme_constant_override("v_separation", 12)
	v.add_child(grid)
	for id in OUTFITS:
		if not (prof["owned"] as Array).has(id):
			continue
		grid.add_child(_outfit_box(id, _inventory))

func _outfit_box(id: String, back: Callable) -> Control:
	var o: Dictionary = OUTFITS[id]
	var box := VBoxContainer.new()
	box.custom_minimum_size = Vector2(250, 0)
	var sw := ColorRect.new()
	sw.color = o["color"]
	sw.custom_minimum_size = Vector2(250, 70)
	box.add_child(sw)
	box.add_child(UiTheme.label(String(o["title"]), 22, true))
	var owned: bool = (prof["owned"] as Array).has(id)
	var worn: bool = String(prof["outfit"]) == id
	var label := "ترتديه" if worn else ("ارتداء" if owned else "شراء — %d" % int(o["price"]))
	var b := _btn(label, func():
		_buy_or_wear(id)
		back.call(), 46)
	b.disabled = worn
	box.add_child(b)
	return box

## the store: outfits for coins (earned in matches); the bought ones can be worn any time
func _store() -> void:
	var v := _open("المتجر")
	v.add_child(UiTheme.label("العملات: %s — تكسبها من المباريات (القتلى والمناطق والانتصار) ومكافآت الدخول" % _thousands(int(prof["coins"])), 20, false, UiTheme.ACCENT))
	var grid := GridContainer.new()
	grid.columns = 3
	grid.add_theme_constant_override("h_separation", 12)
	grid.add_theme_constant_override("v_separation", 12)
	v.add_child(grid)
	for id in OUTFITS:
		grid.add_child(_outfit_box(id, _store))

func _buy_or_wear(id: String) -> void:
	var o: Dictionary = OUTFITS[id]
	var owned: Array = prof["owned"]
	if not owned.has(id):
		if int(prof["coins"]) < int(o["price"]):
			return
		prof["coins"] = int(prof["coins"]) - int(o["price"])
		owned.append(id)
		Sfx.play("ammo_pickup", -4.0)
	prof["outfit"] = id
	Profile.save_profile(prof)
	preview_soldier.set_outfit(o["color"])

## a crate: 150 coins for a surprise (an outfit not owned yet, or coins back)
func _crates() -> void:
	var v := _open("الصناديق")
	v.add_child(UiTheme.label("صندوق إمداد — 150 عملة: لباس جديد أو عملات", 22, true, GOLD))
	var res := UiTheme.label("", 24, true)
	v.add_child(_btn("افتح صندوقاً", func():
		if int(prof["coins"]) < 150:
			res.text = "لا تكفي عملاتك"
			return
		prof["coins"] = int(prof["coins"]) - 150
		var missing: Array = []
		for id in OUTFITS:
			if not (prof["owned"] as Array).has(id):
				missing.append(id)
		if not missing.is_empty() and randf() < 0.45:
			var id: String = missing[randi() % missing.size()]
			(prof["owned"] as Array).append(id)
			res.text = "حصلت على لباس: " + String(OUTFITS[id]["title"])
		else:
			var c := randi_range(60, 260)
			prof["coins"] = int(prof["coins"]) + c
			res.text = "حصلت على %d عملة" % c
		Profile.save_profile(prof)
		Sfx.play("ammo_pickup", -4.0), 56))
	v.add_child(res)

## the survival pass: ten steps along the levels, each with its reward
func _pass() -> void:
	var v := _open("تذكرة البقاء")
	var lv := level_of(prof)
	var claimed: Array = prof.get("pass_claimed", [])
	v.add_child(UiTheme.label("مستواك %d — كل مستوى يفتح مكافأة" % lv, 22, true, GOLD))
	for k in range(1, 11):
		var h := HBoxContainer.new()
		var reward := k * 60
		var l := UiTheme.label("المستوى %d: %d عملة" % [k + 1, reward], 21)
		l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		h.add_child(l)
		var got: bool = claimed.has(k)
		var b := _btn("استُلمت" if got else ("استلم" if lv > k else "مقفل"), func():
			var c: Array = prof.get("pass_claimed", [])
			c.append(k)
			prof["pass_claimed"] = c
			prof["coins"] = int(prof["coins"]) + reward
			Profile.save_profile(prof)
			_pass(), 44)
		b.disabled = got or lv <= k
		h.add_child(b)
		v.add_child(h)

## the login reward: once a day, eight days in a row
func _daily_ready() -> bool:
	return String(prof.get("daily_date", "")) != Time.get_date_string_from_system()

func _daily() -> void:
	var v := _open("مكافأة تسجيل الدخول")
	var day := int(prof.get("daily_day", 0))
	var g := GridContainer.new()
	g.columns = 4
	g.add_theme_constant_override("h_separation", 10)
	g.add_theme_constant_override("v_separation", 10)
	v.add_child(g)
	for k in 8:
		var c := PanelContainer.new()
		c.custom_minimum_size = Vector2(190, 90)
		var l := UiTheme.label("اليوم %d\n%d عملة%s" % [k + 1, DAILY[k], "  ✓" if k < day else ""], 20, k == day, GOLD if k == day else UiTheme.TEXT)
		l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		c.add_child(l)
		g.add_child(c)
	var b := _btn("استلم مكافأة اليوم" if _daily_ready() else "استلمتها اليوم — عد غداً", func():
		var d := int(prof.get("daily_day", 0)) % 8
		prof["coins"] = int(prof["coins"]) + DAILY[d]
		prof["daily_day"] = (d + 1) % 8
		prof["daily_date"] = Time.get_date_string_from_system()
		Profile.save_profile(prof)
		Sfx.play("ammo_pickup", -4.0)
		_daily(), 56)
	b.disabled = not _daily_ready()
	v.add_child(b)

## the day's missions, counted from the match totals since the day began
func _missions() -> void:
	var today := Time.get_date_string_from_system()
	if String(prof.get("mission_date", "")) != today:
		prof["mission_date"] = today
		prof["mission_base"] = {"matches": int(prof["matches"]), "kills": int(prof["kills"]), "wins": int(prof["wins"])}
		prof["mission_done"] = []
		Profile.save_profile(prof)
	var base: Dictionary = prof["mission_base"]
	var v := _open("مهمات اليوم")
	for m in [["matches", "العب مباراتين", 2, 120], ["kills", "اقتل 10 أعداء", 10, 150], ["wins", "اربح مباراة", 1, 200]]:
		var key := String(m[0])
		var have := int(prof[key]) - int(base.get(key, 0))
		var done: bool = (prof["mission_done"] as Array).has(key)
		var h := HBoxContainer.new()
		var l := UiTheme.label("%s  (%d/%d) — %d عملة" % [m[1], mini(have, int(m[2])), int(m[2]), int(m[3])], 21)
		l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		h.add_child(l)
		var reward := int(m[3])
		var b := _btn("استُلمت" if done else "استلم", func():
			(prof["mission_done"] as Array).append(key)
			prof["coins"] = int(prof["coins"]) + reward
			Profile.save_profile(prof)
			_missions(), 44)
		b.disabled = done or have < int(m[2])
		h.add_child(b)
		v.add_child(h)

func _events() -> void:
	var v := _open("الفعاليات")
	v.add_child(UiTheme.label("● مكافأة تسجيل الدخول — ٨ أيام", 22, true, GOLD))
	v.add_child(_btn("افتح", _daily, 46))
	v.add_child(UiTheme.label("● غارات جوية على المدن: ابتعد عن الدائرة الحمراء حين تسمع صفارة الإنذار.", 20))
	v.add_child(UiTheme.label("● حاملات الطائرات في البحيرات: اهبط عليها بالمقاتلة أو المروحية.", 20))

func _mail() -> void:
	var v := _open("الرسائل")
	var on := get_node_or_null("/root/Online")
	if on == null or not on.signed():
		v.add_child(UiTheme.label("لا رسائل — اتصل بالإنترنت لتصلك طلبات الصداقة.", 20, false, UiTheme.DIM))
		return
	var reqs: Array = await on.requests_in()
	if reqs.is_empty():
		v.add_child(UiTheme.label("لا رسائل جديدة.", 20, false, UiTheme.DIM))
	for r in reqs:
		var d: Dictionary = r
		var who: Dictionary = d.get("sender", {}) if d.get("sender") is Dictionary else {}
		var h := HBoxContainer.new()
		var l := UiTheme.label("طلب صداقة من %s (%s)" % [who.get("name", "?"), who.get("public_id", "")], 20)
		l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		h.add_child(l)
		h.add_child(_btn("قبول", func():
			await on.answer_request(int(d["id"]), true)
			_mail(), 44))
		h.add_child(_btn("رفض", func():
			await on.answer_request(int(d["id"]), false)
			_mail(), 44))
		v.add_child(h)

func _tutorial() -> void:
	var v := _open("كيف تلعب")
	for line in ["● اضغط «بدء»: تبحث اللعبة عن لاعبين ثم تركب طائرة النقل. اضغط «قفز» فوق المكان الذي تريده.",
			"● تفتح المظلة وحدها على ١٢٠ م، أو اضغط القفز مرة أخرى. وجّهها بالعصا.",
			"● السيطرة: قف داخل دائرة المنطقة أو اخترق حاسوبها. كل منطقة تملكها تعطي نقاطاً.",
			"● الحقيبة: اضغطها لترى ما معك، ترمي منه أو تتعالج. ما لا يركب على أسلحتك عليه 🚫.",
			"● الخريطة: اضغط الخريطة الصغيرة في الزاوية لتكبيرها: المناطق والمطاران والميناء والحاملات.",
			"● الدائرة الحمراء: منطقة قصف جوي — اخرج منها قبل أن تسقط القنابل."]:
		var l := UiTheme.label(line, 20)
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		v.add_child(l)

## friends: find a player by his ID, send a request, answer the ones that came, see who is online
func _friends() -> void:
	var on := get_node_or_null("/root/Online")
	var v := _open("الأصدقاء")
	v.add_child(UiTheme.label("معرّفك: %s — أعطه لأصدقائك ليجدوك" % prof["id"], 22, true, UiTheme.ACCENT))
	if on == null or not on.signed():
		v.add_child(UiTheme.label("غير متصل بعد — تتصل اللعبة وحدها حين يتوفر الإنترنت. (%s)" % (on.status if on else ""), 20))
		if on:
			v.add_child(_btn("أعد المحاولة الآن", func():
				await on.sign_in_guest()
				_friends()))
		return
	var row := HBoxContainer.new()
	v.add_child(row)
	var q := LineEdit.new()
	q.placeholder_text = "معرّف اللاعب"
	q.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	q.custom_minimum_size = Vector2(0, 50)
	row.add_child(q)
	var result := UiTheme.label("", 20)
	row.add_child(_btn("بحث", func():
		result.text = "…"
		var p: Dictionary = await on.find_player(q.text)
		if p.is_empty():
			result.text = "لا يوجد لاعب بهذا المعرّف"
			return
		result.text = "%s — %s" % [p.get("name", "?"), p.get("tier", "")]
		var add := _btn("إرسال طلب صداقة", func():
			var ok: bool = await on.send_request(String(p["id"]))
			result.text = "أُرسل الطلب" if ok else "تعذر الإرسال", 46)
		v.add_child(add), 50))
	v.add_child(result)
	v.add_child(UiTheme.label("طلبات واردة", 24, true))
	var reqs: Array = await on.requests_in()
	if reqs.is_empty():
		v.add_child(UiTheme.label("لا شيء", 18, false, UiTheme.DIM))
	for r in reqs:
		var d: Dictionary = r
		var h := HBoxContainer.new()
		var who: Dictionary = d.get("sender", {}) if d.get("sender") is Dictionary else {}
		var l := UiTheme.label("%s (%s)" % [who.get("name", "?"), who.get("public_id", "")], 20)
		l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		h.add_child(l)
		h.add_child(_btn("قبول", func():
			await on.answer_request(int(d["id"]), true)
			_friends(), 44))
		h.add_child(_btn("رفض", func():
			await on.answer_request(int(d["id"]), false)
			_friends(), 44))
		v.add_child(h)
	v.add_child(UiTheme.label("أصدقاؤك", 24, true))
	var fr: Array = await on.friends()
	if fr.is_empty():
		v.add_child(UiTheme.label("لا أصدقاء بعد", 18, false, UiTheme.DIM))
	for f in fr:
		var d: Dictionary = f
		var seen := String(d.get("last_seen", ""))
		var online := false
		if seen != "":
			var t := Time.get_unix_time_from_datetime_string(seen.substr(0, 19))
			online = Time.get_unix_time_from_system() - t < 300.0
		# hosting a match right now (his profile's room, refreshed every minute while he plays)
		var room := String(d.get("room", "")) if d.get("room") is String else ""
		var playing := false
		if room != "" and d.get("room_at") is String:
			var rt := Time.get_unix_time_from_datetime_string(String(d["room_at"]).substr(0, 19))
			playing = Time.get_unix_time_from_system() - rt < 180.0
		var h := HBoxContainer.new()
		var l := UiTheme.label("%s %s (%s)%s" % ["●" if online else "○", d.get("name", "?"), d.get("public_id", ""), "  — في مباراة" if playing else ""], 20, false, Color(0.5, 1.0, 0.6) if online else UiTheme.DIM)
		l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		h.add_child(l)
		if playing:
			h.add_child(_btn("انضم", func(): _join(room), 44))
		v.add_child(h)
	v.add_child(UiTheme.label("حين يبدأ صديقك مباراة يظهر بجانبه زر «انضم»: تدخل فريقه مكان أحد الجنود الآليين.", 17, false, UiTheme.DIM))

## into a friend's match: the valley is needed (loaded again if another map is open)
## into a friend's match: the valley is needed (loaded again if another map is open)
func _join(room: String) -> void:
	Online.pending_room = room
	Settings.set_v("mode", "domination")
	if String(Settings.get_v("map")) != "valley":
		Settings.set_v("map", "valley")
		get_tree().reload_current_scene()
		return
	start_pressed.emit()
