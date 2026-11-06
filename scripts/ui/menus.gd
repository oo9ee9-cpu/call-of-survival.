class_name Menus
extends Control
## Main menu, pause menu, settings (graphics / camera / controls / sound / world), credits. Arabic, right to left.

signal start_pressed
signal resume_pressed
signal main_menu_pressed
signal layout_editor

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
	if back == "main":
		main_panel.visible = true          # the lobby's camp stays behind the settings
	settings_panel.visible = true
	_refresh()

func show_credits() -> void:
	_hide_all()
	main_panel.visible = true
	credits_panel.visible = true

func _back() -> void:
	if _back_to == "pause":
		show_pause()
	else:
		show_main()

# ------------------------------------------------------------------ main
func _build_main() -> void:
	var lobby := Lobby.new()
	lobby.start_pressed.connect(func(): start_pressed.emit())
	lobby.settings_pressed.connect(func(): show_settings("main"))
	lobby.credits_pressed.connect(show_credits)
	main_panel = lobby
	add_child(main_panel)

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
	_row(g, "الجودة", _opt("quality", ["منخفضة", "متوسطة", "عالية", "فائقة", "قصوى"], func(i): Settings.apply_preset(i)))
	_row(g, "الإطارات في الثانية", _opt("fps_limit", ["30", "40", "60", "90", "120", "144", "165", "240", "400", "بلا حد"]))
	_row(g, "المزامنة العمودية", _check("vsync"))
	_row(g, "دقة العرض", _slider("render_scale", 0.5, 1.0, 0.05))
	_row(g, "مسافة الرؤية", _opt("view_distance", ["قريبة", "عادية", "بعيدة"]))
	_row(g, "الظلال", _opt("shadows", ["بدون", "ناعمة", "عالية"]))
	_row(g, "كثافة العشب", _opt("vegetation", ["قليلة", "عادية", "كثيفة"]))
	_row(g, "ضبابية الحركة", _check("motion_blur"))
	_row(g, "عداد الإطارات", _check("show_fps"))
	var c := _page(tabs, "الكاميرا")
	_row(c, "المنظور", _opt("view_mode", ["الشخص الأول", "الشخص الثالث"]))
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
	_row(k, "مواقع الأزرار", _btn("تخصيص (اسحب الأزرار)", func(): layout_editor.emit(), 300))
	_row(k, "التقاط تلقائي للذخيرة والعلاج", _check("auto_pickup"))
	var a := _page(tabs, "الصوت")
	_row(a, "الصوت العام", _slider("vol_master", 0.0, 1.0, 0.05))
	_row(a, "المؤثرات", _slider("vol_sfx", 0.0, 1.0, 0.05))
	_row(a, "الأجواء", _slider("vol_amb", 0.0, 1.0, 0.05))
	var w := _page(tabs, "العالم")
	_row(w, "الوقت", _opt("time", ["فجر", "نهار غائم", "غروب", "ليل"]))
	_row(w, "الطقس", _opt("weather", ["صافٍ مشمس", "ضباب", "مطر", "غائم"]))
	_row(w, "معركة بعيدة (الجبهة)", _check("battle"))
	_row(w, "الغارات الجوية (الوادي)", _check("raids"))
	_row(w, "الجنود في كل فريق (عند بدء المباراة)", _opt("team_size", ["١٠", "٢٠", "٣٠", "٥٠"]))
	var maps := ["valley", "front"]
	_row(w, "الخريطة (عند إعادة التشغيل)", _opt("map", ["الوادي ٨×٨ كم", "الجبهة ٣×٣ كم"], func(i): Settings.set_v("map", maps[i])))

func _refresh() -> void:
	for key in _widgets:
		var w: Control = _widgets[key]
		var val = Settings.get_v(key)
		if w is OptionButton:
			if key == "map":
				(w as OptionButton).select(0 if String(val) == "valley" else 1)
			else:
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
	rt.text = CREDITS + _model_credits()
	v.add_child(rt)

const CREDITS := """[b]نداء البقاء[/b] — نسخة تجريبية على محرك Godot 4.7: خريطة الوادي ٨×٨ كم (مدن مهجورة، مطار، حاملات طائرات على البحيرات، غارات جوية، مركبات وطائرات تقودها) وخريطة الجبهة ٣×٣ كم (خنادق وملاجئ) بكاميرا جسم.

[b]التحكم على الهاتف[/b]
• العصا على اليسار للمشي، ادفعها إلى الأمام حتى الحافة للركض. اسحب في النصف الأيمن للنظر.
• «تفاعل» يظهر قرب الأبواب والمركبات: فتح الباب، ركوب المركبة، النزول منها.
• في المركبة: العصا للقيادة، «فرامل» لفرامل اليد، «رمي» مدفع الدبابة.
• في الطائرة: «رفع»/«خفض» للمحرك، العصا للمقدمة والميلان، «رمي» الرشاش، «صاروخ» الصواريخ أو القنابل. «قفز» يفتح المظلة.

[b]التحكم بالحاسوب[/b]
WASD حركة · Shift ركض · C انحناء · Z انبطاح · Space قفز/تسلّق/مظلة · الفأرة اليسرى رمي · اليمنى تصويب · R تلقيم · F تفاعل/ركوب · V المنظور · L مصباح · B نمط الرمي · M الخريطة · Tab الحقيبة · Esc قائمة · F3 عداد الإطارات
الطائرة: Shift/Ctrl المحرك · W/S المقدمة · A/D الميلان · Q/E الدفة · X صاروخ أو قنبلة · R مشاعل ضد الصواريخ

[b]الحقوق والتراخيص[/b]
• بندقية AK: نموذج «RAINIER AK - 3D» للفنان skartemka على Sketchfab — رخصة CC-BY-NC 4.0 (غير تجارية).
  https://sketchfab.com/3d-models/rainier-ak-3d-57aef8cdf42046a39f1ad9b428756213
• الجيب UAZ (والجيب المحترق): «UAZ 469 1973 (Classic)» للفنان zhe_kan على Sketchfab — CC-BY 4.0.
  https://sketchfab.com/3d-models/uaz-469-1973-classic-027fa204ce25452fac61a93ccfb8f1f8
• الجندي: جسم «X Bot» وحركاته من Mixamo (Adobe، كما في أمثلة three.js) بعد تعديله ولبس زيّ مموّه؛ الوجه: مسح الرأس «Lee Perry-Smith» من Infinite-Realities — رخصة CC-BY 3.0؛ الخوذة والصدرية: انظر نماذج المالك أدناه.
• الشعار وبطاقات اللوبي: رُسمت لهذه النسخة (خط DejaVu — رخصة حرة، وVazirmatn — SIL OFL 1.1).
• أنسجة الأرض والأشجار والأعشاب: من مجموعة أنسجة اللعبة الأصلية — ambientCG (CC0) وBabylon.js Assets (CC-BY 4.0) وأداة ez-tree لـ Daniel Greenheck (MIT).
• خريطة نتوءات الماء: أمثلة three.js (MIT).
• الخطوط: Vazirmatn (SIL OFL 1.1) — Saber Rastikerdar وفريق Vazirmatn؛ JetBrains Mono (SIL OFL 1.1) — JetBrains.
• صُنع لهذه النسخة: الخرائط، البيوت وأثاثها، الأشجار، الدبابة، الخنادق والملاجئ، الأنسجة، المؤثرات، الأصوات المولّدة، والشيفرة.
"""

## the owner's models with their authors and licences (data/credits_models.json, made by tools/credits.py)
func _model_credits() -> String:
	var rows = JSON.parse_string(FileAccess.get_file_as_string("res://data/credits_models.json"))
	if not (rows is Array):
		return ""
	var t := "\n[b]نماذجك (من مستودع uploads)[/b]\n"
	for r in rows:
		var d: Dictionary = r
		if String(d["author"]) == "owner":
			t += "• %s — من صنعك\n" % d["ar"]
		else:
			t += "• %s: «%s» للفنان %s — %s\n  %s\n" % [d["ar"], d["title"], d["author"], d["license"], d["source"]]
	t += "\nنصوص التراخيص الكاملة في مجلد المشروع: CREDITS.md وfonts/OFL.txt.\n"
	return t
