class_name Menus
extends Control
## Main menu, pause menu, settings (graphics / camera / controls / sound / world), credits. Arabic, right to left.

signal start_pressed
signal resume_pressed
signal main_menu_pressed

var main_panel: Control
var pause_panel: Control
var settings_panel: Control
var credits_panel: Control
var _back_to := "main"
var _widgets := {}

func _init() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	layout_direction = Control.LAYOUT_DIRECTION_RTL
	mouse_filter = Control.MOUSE_FILTER_IGNORE

func _ready() -> void:
	_build_main()
	_build_pause()
	_build_settings()
	_build_credits()
	show_main()

# ------------------------------------------------------------------ helpers
func _btn(text: String, cb: Callable, w := 360) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(w, 58)
	b.add_theme_font_size_override("font_size", 26)
	b.pressed.connect(func():
		Sfx.play("ui_click", -6.0, 0.0, "UI")
		cb.call())
	return b

func _shade(alpha_l: float, alpha_r: float) -> TextureRect:
	var g := Gradient.new()
	g.set_color(0, Color(0, 0, 0, alpha_l))
	g.set_color(1, Color(0, 0, 0, alpha_r))
	var gt := GradientTexture2D.new()
	gt.gradient = g
	gt.width = 256
	gt.height = 4
	var tr := TextureRect.new()
	tr.texture = gt
	tr.stretch_mode = TextureRect.STRETCH_SCALE
	tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	tr.set_anchors_preset(Control.PRESET_FULL_RECT)
	tr.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return tr

func _hide_all() -> void:
	for p in [main_panel, pause_panel, settings_panel, credits_panel]:
		p.visible = false

func show_main() -> void:
	_hide_all()
	main_panel.visible = true
	visible = true

func show_pause() -> void:
	_hide_all()
	pause_panel.visible = true
	visible = true

func show_settings(back: String) -> void:
	_back_to = back
	_hide_all()
	settings_panel.visible = true
	_refresh()

func show_credits() -> void:
	_hide_all()
	credits_panel.visible = true

func _back() -> void:
	if _back_to == "pause":
		show_pause()
	else:
		show_main()

# ------------------------------------------------------------------ main
func _build_main() -> void:
	main_panel = Control.new()
	main_panel.set_anchors_preset(Control.PRESET_FULL_RECT)
	main_panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	main_panel.layout_direction = Control.LAYOUT_DIRECTION_LTR
	add_child(main_panel)
	main_panel.add_child(_shade(0.0, 0.82))
	var holder := Control.new()
	holder.layout_direction = Control.LAYOUT_DIRECTION_LTR
	holder.set_anchors_preset(Control.PRESET_RIGHT_WIDE)
	holder.offset_left = -560
	holder.offset_right = -70
	holder.offset_top = 90
	holder.offset_bottom = -40
	holder.mouse_filter = Control.MOUSE_FILTER_IGNORE
	main_panel.add_child(holder)
	var v := VBoxContainer.new()
	v.layout_direction = Control.LAYOUT_DIRECTION_RTL
	v.set_anchors_preset(Control.PRESET_FULL_RECT)
	v.add_theme_constant_override("separation", 14)
	holder.add_child(v)
	var t := UiTheme.label("الجبهة", 86, true, Color(0.95, 0.92, 0.84))
	v.add_child(t)
	for line in [["نداء البقاء — نسخة تجريبية على محرك Godot", 22, UiTheme.ACCENT], ["غابة صنوبر محروقة، خنادق، ملاجئ تحت الأرض — خريطة ٣×٣ كم", 18, UiTheme.DIM]]:
		var l := UiTheme.label(line[0], line[1], false, line[2])
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		v.add_child(l)
	var sp := Control.new()
	sp.custom_minimum_size = Vector2(0, 26)
	v.add_child(sp)
	v.add_child(_btn("ابدأ", func(): start_pressed.emit()))
	v.add_child(_btn("الإعدادات", func(): show_settings("main")))
	v.add_child(_btn("حول اللعبة والحقوق", show_credits))
	v.add_child(_btn("خروج", func(): Sfx.quit_game()))
	var foot := UiTheme.label("Godot %s · %s" % [Engine.get_version_info()["string"], RenderingServer.get_current_rendering_method()], 15, false, UiTheme.DIM)
	foot.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	foot.layout_direction = Control.LAYOUT_DIRECTION_LTR
	foot.position = Vector2(24, -40)
	main_panel.add_child(foot)

func _build_pause() -> void:
	pause_panel = Control.new()
	pause_panel.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(pause_panel)
	var bg := ColorRect.new()
	bg.color = Color(0, 0, 0, 0.55)
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	pause_panel.add_child(bg)
	var c := CenterContainer.new()
	c.set_anchors_preset(Control.PRESET_FULL_RECT)
	pause_panel.add_child(c)
	var pc := PanelContainer.new()
	c.add_child(pc)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 12)
	pc.add_child(v)
	v.add_child(UiTheme.label("متوقف مؤقتاً", 40, true))
	v.add_child(_btn("متابعة", func(): resume_pressed.emit()))
	v.add_child(_btn("الإعدادات", func(): show_settings("pause")))
	v.add_child(_btn("القائمة الرئيسية", func(): main_menu_pressed.emit()))
	v.add_child(_btn("خروج", func(): Sfx.quit_game()))

# ------------------------------------------------------------------ settings
func _row(parent: Control, text: String, w: Control) -> void:
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 18)
	var l := UiTheme.label(text, 21)
	l.custom_minimum_size = Vector2(300, 0)
	h.add_child(l)
	w.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	h.add_child(w)
	parent.add_child(h)

func _opt(key: String, items: Array, on_change := Callable()) -> OptionButton:
	var o := OptionButton.new()
	o.custom_minimum_size = Vector2(300, 48)
	for it in items:
		o.add_item(it)
	o.item_selected.connect(func(i):
		if on_change.is_valid():
			on_change.call(i)
		else:
			Settings.set_v(key, i)
		_refresh())
	_widgets[key] = o
	return o

func _slider(key: String, lo: float, hi: float, step: float, pct := true) -> HBoxContainer:
	var h := HBoxContainer.new()
	var s := HSlider.new()
	s.min_value = lo
	s.max_value = hi
	s.step = step
	s.custom_minimum_size = Vector2(260, 40)
	s.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	s.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	var val := UiTheme.label("", 19, false, UiTheme.ACCENT)
	val.custom_minimum_size = Vector2(70, 0)
	s.value_changed.connect(func(v):
		val.text = ("%d٪" % roundi(v * 100.0)) if pct else ("%d" % roundi(v))
		if absf(float(Settings.get_v(key)) - v) > 0.0001:
			Settings.set_v(key, v))
	h.add_child(s)
	h.add_child(val)
	_widgets[key] = s
	return h

func _check(key: String) -> CheckButton:
	var c := CheckButton.new()
	c.toggled.connect(func(on): Settings.set_v(key, on))
	_widgets[key] = c
	return c

func _page(tabs: TabContainer, title: String) -> VBoxContainer:
	var sc := ScrollContainer.new()
	sc.name = title
	sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	tabs.add_child(sc)
	var v := VBoxContainer.new()
	v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	v.add_theme_constant_override("separation", 10)
	sc.add_child(v)
	return v

func _build_settings() -> void:
	settings_panel = Control.new()
	settings_panel.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(settings_panel)
	var bg := ColorRect.new()
	bg.color = Color(0, 0, 0, 0.6)
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	settings_panel.add_child(bg)
	var pc := PanelContainer.new()
	pc.set_anchors_preset(Control.PRESET_FULL_RECT)
	pc.offset_left = 70
	pc.offset_right = -70
	pc.offset_top = 36
	pc.offset_bottom = -36
	settings_panel.add_child(pc)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 10)
	pc.add_child(v)
	var top := HBoxContainer.new()
	top.add_child(UiTheme.label("الإعدادات", 34, true))
	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top.add_child(spacer)
	top.add_child(_btn("رجوع", _back, 180))
	v.add_child(top)
	var tabs := TabContainer.new()
	tabs.size_flags_vertical = Control.SIZE_EXPAND_FILL
	v.add_child(tabs)
	var g := _page(tabs, "الرسومات")
	_row(g, "الجودة", _opt("quality", ["منخفضة", "متوسطة", "عالية", "فائقة"], func(i): Settings.apply_preset(i)))
	_row(g, "دقة العرض", _slider("render_scale", 0.5, 1.0, 0.05))
	_row(g, "مسافة الرؤية", _opt("view_distance", ["قريبة", "عادية", "بعيدة"]))
	_row(g, "الظلال", _opt("shadows", ["بدون", "ناعمة", "عالية"]))
	_row(g, "كثافة العشب", _opt("vegetation", ["قليلة", "عادية", "كثيفة"]))
	_row(g, "ضبابية الحركة", _check("motion_blur"))
	_row(g, "عداد الإطارات", _check("show_fps"))
	var c := _page(tabs, "الكاميرا")
	_row(c, "تأثير كاميرا الجسم", _slider("bodycam", 0.0, 1.0, 0.05))
	_row(c, "مجال الرؤية", _slider("fov", 70.0, 115.0, 1.0, false))
	_row(c, "اهتزاز المشي", _slider("head_bob", 0.0, 1.5, 0.05))
	_row(c, "نقطة التصويب", _check("crosshair"))
	var k := _page(tabs, "التحكم")
	_row(k, "حساسية اللمس", _slider("sens_touch", 0.3, 2.5, 0.05))
	_row(k, "حساسية الفأرة", _slider("sens_mouse", 0.3, 2.5, 0.05))
	_row(k, "عكس المحور العمودي", _check("invert_y"))
	_row(k, "حجم الأزرار", _slider("touch_scale", 0.7, 1.4, 0.05))
	_row(k, "وضوح الأزرار", _slider("touch_opacity", 0.2, 1.0, 0.05))
	var a := _page(tabs, "الصوت")
	_row(a, "الصوت العام", _slider("vol_master", 0.0, 1.0, 0.05))
	_row(a, "المؤثرات", _slider("vol_sfx", 0.0, 1.0, 0.05))
	_row(a, "الأجواء", _slider("vol_amb", 0.0, 1.0, 0.05))
	var w := _page(tabs, "العالم")
	_row(w, "الوقت", _opt("time", ["فجر", "نهار غائم", "غروب", "ليل"]))
	_row(w, "الطقس", _opt("weather", ["غائم", "ضباب", "مطر"]))
	_row(w, "معركة بعيدة", _check("battle"))

func _refresh() -> void:
	for key in _widgets:
		var w: Control = _widgets[key]
		var val = Settings.get_v(key)
		if w is OptionButton:
			(w as OptionButton).select(int(val))
		elif w is HSlider:
			(w as HSlider).set_value_no_signal(float(val))
			(w as HSlider).value_changed.emit(float(val))
		elif w is CheckButton:
			(w as CheckButton).set_pressed_no_signal(bool(val))

# ------------------------------------------------------------------ credits
func _build_credits() -> void:
	credits_panel = Control.new()
	credits_panel.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(credits_panel)
	var bg := ColorRect.new()
	bg.color = Color(0, 0, 0, 0.6)
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	credits_panel.add_child(bg)
	var pc := PanelContainer.new()
	pc.set_anchors_preset(Control.PRESET_FULL_RECT)
	pc.offset_left = 90
	pc.offset_right = -90
	pc.offset_top = 40
	pc.offset_bottom = -40
	credits_panel.add_child(pc)
	var v := VBoxContainer.new()
	pc.add_child(v)
	var top := HBoxContainer.new()
	top.add_child(UiTheme.label("حول اللعبة والحقوق", 32, true))
	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top.add_child(spacer)
	top.add_child(_btn("رجوع", show_main, 180))
	v.add_child(top)
	var rt := RichTextLabel.new()
	rt.bbcode_enabled = true
	rt.size_flags_vertical = Control.SIZE_EXPAND_FILL
	rt.text = CREDITS
	v.add_child(rt)

const CREDITS := """[b]نداء البقاء: الجبهة[/b] — نسخة تجريبية على محرك Godot 4.7: خريطة ٣×٣ كم لغابة صنوبر محروقة وخط جبهة بخنادقه وملاجئه، بكاميرا جسم.

[b]التحكم على الهاتف[/b]
• العصا على اليسار للمشي، ادفعها إلى الأمام حتى الحافة للركض.
• اسحب في النصف الأيمن للنظر. زر «رمي» يرمي ويمكنك السحب عليه للتصويب أثناء الرمي.
• «قفز» يتسلق حافة الخندق أو أكياس الرمل إذا كانت أمامك، وإلا يقفز.
• «تفاعل» يظهر قرب المصباح واللاسلكي وصناديق الذخيرة.

[b]التحكم بالحاسوب[/b]
WASD حركة · Shift ركض · C انحناء · Space قفز/تسلّق · زر الفأرة الأيسر رمي · الأيمن تصويب · R تلقيم · E تفاعل · L مصباح · B نمط الرمي · Esc قائمة · F3 عداد الإطارات

[b]الحقوق والتراخيص[/b]
• بندقية AK: نموذج «RAINIER AK - 3D» للفنان skartemka على Sketchfab — رخصة CC-BY-NC 4.0 (غير تجارية).
  https://sketchfab.com/3d-models/rainier-ak-3d-57aef8cdf42046a39f1ad9b428756213
• الجيب المحترق: «UAZ 469 1973 (Classic)» للفنان zhe_kan على Sketchfab — CC-BY 4.0 (أُعيد تلوينه كهيكل محترق).
  https://sketchfab.com/3d-models/uaz-469-1973-classic-027fa204ce25452fac61a93ccfb8f1f8
• أنسجة الأرض: من مجموعة أنسجة اللعبة الأصلية — ambientCG (CC0) وBabylon.js Assets (CC-BY 4.0) وأداة ez-tree لـ Daniel Greenheck (MIT).
• أنسجة اللحاء: ambientCG (CC0). خريطة نتوءات الماء: أمثلة three.js (MIT).
• الخطوط: Vazirmatn (SIL OFL 1.1) — Saber Rastikerdar وفريق Vazirmatn؛ JetBrains Mono (SIL OFL 1.1) — JetBrains.
• كل ما سوى ذلك صُنع لهذه النسخة: الأشجار، الخنادق، الملاجئ وأثاثها، أبراج الكهرباء، أكياس الرمل، الأسلاك، الأنسجة الخشبية والمعدنية والقماشية، المؤثرات، الأصوات (مولّدة بالحاسوب)، والشيفرة.

نصوص التراخيص الكاملة في مجلد المشروع: CREDITS.md وfonts/OFL.txt.
"""
