class_name UiTheme
extends RefCounted
## The look of every menu: dark military panels, warm khaki accents, Vazirmatn for Arabic.

const ACCENT := Color(0.78, 0.66, 0.42)
const TEXT := Color(0.92, 0.9, 0.84)
const DIM := Color(0.62, 0.6, 0.55)

static var font_regular: Font
static var font_bold: Font
static var font_mono: Font

static func fonts() -> void:
	if font_regular:
		return
	font_regular = load("res://fonts/Vazirmatn-Regular.woff2")
	font_bold = load("res://fonts/Vazirmatn-Bold.woff2")
	font_mono = load("res://fonts/JetBrainsMono-Regular.woff2")

static func box(bg: Color, border := Color(0, 0, 0, 0), bw := 0, radius := 8, pad := 12.0) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = bg
	s.border_color = border
	s.set_border_width_all(bw)
	s.set_corner_radius_all(radius)
	s.content_margin_left = pad * 1.4
	s.content_margin_right = pad * 1.4
	s.content_margin_top = pad * 0.7
	s.content_margin_bottom = pad * 0.7
	s.anti_aliasing = true
	return s

static func build() -> Theme:
	fonts()
	var t := Theme.new()
	t.default_font = font_regular
	t.default_font_size = 22
	t.set_color("font_color", "Label", TEXT)
	t.set_color("font_shadow_color", "Label", Color(0, 0, 0, 0.6))
	t.set_constant("shadow_offset_x", "Label", 1)
	t.set_constant("shadow_offset_y", "Label", 1)
	for c in ["Button", "OptionButton", "CheckButton", "CheckBox"]:
		t.set_color("font_color", c, TEXT)
		t.set_color("font_hover_color", c, Color(1, 0.97, 0.88))
		t.set_color("font_pressed_color", c, Color(0.1, 0.09, 0.07))
		t.set_color("font_focus_color", c, Color(1, 0.97, 0.88))
		t.set_color("font_disabled_color", c, DIM)
	var normal := box(Color(0.07, 0.07, 0.06, 0.78), Color(0.78, 0.66, 0.42, 0.35), 1, 6, 12.0)
	var hover := box(Color(0.16, 0.15, 0.12, 0.9), Color(0.78, 0.66, 0.42, 0.8), 1, 6, 12.0)
	var pressed := box(Color(0.78, 0.66, 0.42, 0.95), Color(0.95, 0.85, 0.6, 1.0), 1, 6, 12.0)
	var focus := box(Color(0, 0, 0, 0), Color(0.95, 0.85, 0.6, 0.7), 2, 6, 12.0)
	for c in ["Button", "OptionButton"]:
		t.set_stylebox("normal", c, normal)
		t.set_stylebox("hover", c, hover)
		t.set_stylebox("pressed", c, pressed)
		t.set_stylebox("focus", c, focus)
		t.set_stylebox("disabled", c, normal)
	t.set_stylebox("panel", "PanelContainer", box(Color(0.045, 0.045, 0.04, 0.88), Color(0.78, 0.66, 0.42, 0.25), 1, 12, 18.0))
	t.set_stylebox("panel", "Panel", box(Color(0.045, 0.045, 0.04, 0.88), Color(0.78, 0.66, 0.42, 0.25), 1, 12, 18.0))
	var slider_bg := box(Color(0.2, 0.19, 0.17, 0.9), Color(0, 0, 0, 0), 0, 4, 0.0)
	slider_bg.content_margin_top = 4
	slider_bg.content_margin_bottom = 4
	var slider_fill := box(ACCENT, Color(0, 0, 0, 0), 0, 4, 0.0)
	slider_fill.content_margin_top = 4
	slider_fill.content_margin_bottom = 4
	t.set_stylebox("slider", "HSlider", slider_bg)
	t.set_stylebox("grabber_area", "HSlider", slider_fill)
	t.set_stylebox("grabber_area_highlight", "HSlider", slider_fill)
	t.set_icon("grabber", "HSlider", _dot(22, Color(0.95, 0.88, 0.7)))
	t.set_icon("grabber_highlight", "HSlider", _dot(24, Color(1, 0.95, 0.8)))
	t.set_stylebox("panel", "TabContainer", box(Color(0.045, 0.045, 0.04, 0.0), Color(0, 0, 0, 0), 0, 0, 10.0))
	t.set_stylebox("tab_selected", "TabContainer", box(Color(0.78, 0.66, 0.42, 0.95), Color(0, 0, 0, 0), 0, 6, 10.0))
	t.set_stylebox("tab_unselected", "TabContainer", box(Color(0.1, 0.1, 0.09, 0.85), Color(0, 0, 0, 0), 0, 6, 10.0))
	t.set_stylebox("tab_hovered", "TabContainer", box(Color(0.2, 0.18, 0.14, 0.9), Color(0, 0, 0, 0), 0, 6, 10.0))
	t.set_color("font_selected_color", "TabContainer", Color(0.08, 0.07, 0.05))
	t.set_color("font_unselected_color", "TabContainer", TEXT)
	t.set_color("font_hovered_color", "TabContainer", Color(1, 0.97, 0.88))
	t.set_font_size("font_size", "TabContainer", 20)
	t.set_stylebox("panel", "PopupMenu", box(Color(0.06, 0.06, 0.05, 0.97), Color(0.78, 0.66, 0.42, 0.4), 1, 6, 8.0))
	t.set_color("font_color", "PopupMenu", TEXT)
	t.set_color("font_hover_color", "PopupMenu", Color(0.1, 0.09, 0.07))
	t.set_stylebox("hover", "PopupMenu", box(ACCENT, Color(0, 0, 0, 0), 0, 4, 6.0))
	t.set_font_size("font_size", "PopupMenu", 22)
	t.set_color("default_color", "RichTextLabel", TEXT)
	t.set_font("bold_font", "RichTextLabel", font_bold)
	t.set_font("normal_font", "RichTextLabel", font_regular)
	t.set_font_size("normal_font_size", "RichTextLabel", 19)
	t.set_font_size("bold_font_size", "RichTextLabel", 21)
	var pb_bg := box(Color(0.15, 0.14, 0.12, 0.9), Color(0, 0, 0, 0), 0, 3, 0.0)
	var pb_fg := box(ACCENT, Color(0, 0, 0, 0), 0, 3, 0.0)
	t.set_stylebox("background", "ProgressBar", pb_bg)
	t.set_stylebox("fill", "ProgressBar", pb_fg)
	t.set_color("font_color", "ProgressBar", Color(0, 0, 0, 0))
	return t

static func _dot(s: int, c: Color) -> ImageTexture:
	var img := Image.create(s, s, false, Image.FORMAT_RGBA8)
	var r := s * 0.5 - 1.0
	for y in s:
		for x in s:
			var d := Vector2(x + 0.5 - s * 0.5, y + 0.5 - s * 0.5).length()
			var a := clampf(r - d + 0.5, 0.0, 1.0)
			img.set_pixel(x, y, Color(c.r, c.g, c.b, a))
	return ImageTexture.create_from_image(img)

static func label(text: String, size := 22, bold := false, col := TEXT) -> Label:
	fonts()
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	if bold:
		l.add_theme_font_override("font", font_bold)
	l.add_theme_color_override("font_color", col)
	return l
