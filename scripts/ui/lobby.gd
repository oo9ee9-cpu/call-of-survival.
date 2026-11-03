class_name Lobby
extends Control
## The lobby (the main menu): the player card (photo from the phone, name, ID, tier and rating, coins), the soldier
## in his outfit turning slowly in the middle, and on the right: start, map, mode and server, store, friends,
## settings, credits, quit. The sign-in, friends and store screens open over it.

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

var prof: Dictionary
var card_photo: TextureRect
var card_name: LineEdit
var card_info: Label
var coins_label: Label
var status_label: Label
var preview_vp: SubViewport
var preview_soldier: Soldier
var preview_pivot: Node3D
var overlay: Control
var file_dialog: FileDialog

func _init() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	layout_direction = Control.LAYOUT_DIRECTION_RTL

func _ready() -> void:
	prof = Profile.load_profile()
	_build()
	if Engine.has_singleton("Online") or get_node_or_null("/root/Online"):
		var on := get_node("/root/Online")
		on.status_changed.connect(func(t: String): status_label.text = t)
		status_label.text = on.status

func _process(delta: float) -> void:
	if preview_pivot and is_visible_in_tree():
		preview_pivot.rotate_y(delta * 0.35)

# ------------------------------------------------------------------ building
func _panel(rect: Rect2, anchors: int) -> PanelContainer:
	var p := PanelContainer.new()
	p.set_anchors_preset(anchors)
	p.position = rect.position
	p.size = rect.size
	add_child(p)
	return p

func _btn(text: String, cb: Callable, h := 54) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(0, h)
	b.add_theme_font_size_override("font_size", 24)
	b.pressed.connect(func():
		Sfx.play("ui_click", -6.0, 0.0, "UI")
		cb.call())
	return b

func _build() -> void:
	# soft dark edges over the live world behind
	var shade := ColorRect.new()
	shade.color = Color(0, 0, 0, 0.35)
	shade.set_anchors_preset(Control.PRESET_FULL_RECT)
	shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(shade)
	# --- the player card (top left)
	var card := _panel(Rect2(24, 24, 430, 220), Control.PRESET_TOP_LEFT)
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 14)
	card.add_child(h)
	var pv := VBoxContainer.new()
	h.add_child(pv)
	card_photo = TextureRect.new()
	card_photo.custom_minimum_size = Vector2(120, 120)
	card_photo.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	card_photo.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	pv.add_child(card_photo)
	pv.add_child(_btn("تغيير الصورة", _pick_photo, 40))
	_load_photo()
	var iv := VBoxContainer.new()
	iv.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	h.add_child(iv)
	card_name = LineEdit.new()
	card_name.text = String(prof["name"])
	card_name.max_length = 18
	card_name.add_theme_font_size_override("font_size", 24)
	card_name.text_submitted.connect(_set_name)
	card_name.focus_exited.connect(func(): _set_name(card_name.text))
	iv.add_child(card_name)
	card_info = UiTheme.label("", 19, false, UiTheme.DIM)
	iv.add_child(card_info)
	coins_label = UiTheme.label("", 22, true, UiTheme.ACCENT)
	iv.add_child(coins_label)
	_refresh_card()
	# --- the soldier in the middle
	var svc := SubViewportContainer.new()
	svc.set_anchors_preset(Control.PRESET_CENTER)
	svc.position = Vector2(-200, -300)
	svc.size = Vector2(400, 600)
	svc.stretch = true
	svc.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(svc)
	preview_vp = SubViewport.new()
	preview_vp.size = Vector2i(400, 600)
	preview_vp.transparent_bg = true
	preview_vp.own_world_3d = true
	preview_vp.msaa_3d = Viewport.MSAA_4X
	svc.add_child(preview_vp)
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_CLEAR_COLOR
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(0.75, 0.78, 0.82)
	e.ambient_light_energy = 0.6
	e.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.environment = e
	preview_vp.add_child(env)
	var key := DirectionalLight3D.new()
	key.rotation = Vector3(-0.5, 0.7, 0)
	key.light_energy = 1.6
	preview_vp.add_child(key)
	var rim := DirectionalLight3D.new()
	rim.rotation = Vector3(-0.3, PI + 0.6, 0)
	rim.light_energy = 0.8
	rim.light_color = Color(0.8, 0.85, 1.0)
	preview_vp.add_child(rim)
	var cam := Camera3D.new()
	cam.position = Vector3(0, 1.1, 3.4)
	cam.fov = 38.0
	preview_vp.add_child(cam)
	cam.look_at(Vector3(0, 0.95, 0))
	preview_pivot = Node3D.new()
	preview_vp.add_child(preview_pivot)
	preview_soldier = Soldier.new()
	preview_pivot.add_child(preview_soldier)
	preview_soldier.set_outfit.call_deferred(_outfit_color())
	# --- the right column
	var col := _panel(Rect2(-404, 24, 380, 0), Control.PRESET_TOP_RIGHT)
	col.size = Vector2(380, 0)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 10)
	col.add_child(v)
	v.add_child(UiTheme.label("نداء البقاء", 44, true, Color(0.95, 0.92, 0.84)))
	v.add_child(_btn("ابدأ المعركة", func(): start_pressed.emit(), 70))
	var maps := OptionButton.new()
	maps.add_item("الوادي ٨×٨ كم")
	maps.add_item("الجبهة ٣×٣ كم")
	maps.select(0 if String(Settings.get_v("map")) == "valley" else 1)
	maps.item_selected.connect(func(i): _set_map(["valley", "front"][i]))
	v.add_child(_labeled("الخريطة", maps))
	var mode := OptionButton.new()
	mode.add_item("سيطرة — ٥٠ ضد ٥٠")
	mode.add_item("حر — بلا مباراة")
	mode.select(0 if String(Settings.get_v("mode")) == "domination" else 1)
	mode.item_selected.connect(func(i): Settings.set_v("mode", ["domination", "free"][i]))
	v.add_child(_labeled("النمط", mode))
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
	v.add_child(_btn("المتجر", _store))
	v.add_child(_btn("الأصدقاء", _friends))
	v.add_child(_btn("الإعدادات", func(): settings_pressed.emit()))
	v.add_child(_btn("حول اللعبة والحقوق", func(): credits_pressed.emit()))
	v.add_child(_btn("خروج", func(): Sfx.quit_game()))
	# --- sign-in state (bottom left)
	var sv := HBoxContainer.new()
	sv.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	sv.position = Vector2(24, -70)
	sv.add_theme_constant_override("separation", 12)
	add_child(sv)
	sv.add_child(_btn("تسجيل الدخول", _login, 46))
	status_label = UiTheme.label("غير متصل", 18, false, UiTheme.DIM)
	sv.add_child(status_label)

func _labeled(text: String, w: Control) -> HBoxContainer:
	var h := HBoxContainer.new()
	var l := UiTheme.label(text, 20)
	l.custom_minimum_size = Vector2(110, 0)
	h.add_child(l)
	w.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	w.custom_minimum_size = Vector2(0, 46)
	h.add_child(w)
	return h

func _outfit_color() -> Color:
	return (OUTFITS.get(String(prof.get("outfit", "olive")), OUTFITS["olive"]) as Dictionary)["color"]

func _refresh_card() -> void:
	var r := int(prof["rating"])
	card_info.text = "المعرّف: %s\n%s — %d نقطة\nمباريات %d  انتصارات %d  قتلى %d" % [prof["id"], Match.tier_of(r), r, int(prof["matches"]), int(prof["wins"]), int(prof["kills"])]
	coins_label.text = "العملات: %d" % int(prof["coins"])

func _set_name(t: String) -> void:
	t = t.strip_edges()
	if t == "" or t == String(prof["name"]):
		return
	prof["name"] = t
	Profile.save_profile(prof)
	var on := get_node_or_null("/root/Online")
	if on and on.signed():
		on.upsert_profile()

func _set_map(m: String) -> void:
	if m == String(Settings.get_v("map")):
		return
	Settings.set_v("map", m)
	# the other map has to be built: start again
	get_tree().reload_current_scene()

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
	add_child(overlay)
	var bg := ColorRect.new()
	bg.color = Color(0, 0, 0, 0.6)
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	overlay.add_child(bg)
	var pc := PanelContainer.new()
	pc.set_anchors_preset(Control.PRESET_CENTER)
	pc.position = Vector2(-420, -300)
	pc.size = Vector2(840, 600)
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

## the store: outfits for coins (earned in matches); the bought ones can be worn any time
func _store() -> void:
	var v := _open("المتجر")
	v.add_child(UiTheme.label("العملات: %d — تكسبها من المباريات (القتلى والمناطق والانتصار)" % int(prof["coins"]), 20, false, UiTheme.ACCENT))
	var grid := GridContainer.new()
	grid.columns = 3
	grid.add_theme_constant_override("h_separation", 12)
	grid.add_theme_constant_override("v_separation", 12)
	v.add_child(grid)
	for id in OUTFITS:
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
		var b := _btn(label, func(): _buy_or_wear(id), 46)
		b.disabled = worn
		box.add_child(b)
		grid.add_child(box)

func _buy_or_wear(id: String) -> void:
	var o: Dictionary = OUTFITS[id]
	var owned: Array = prof["owned"]
	if not owned.has(id):
		if int(prof["coins"]) < int(o["price"]):
			_store()
			return
		prof["coins"] = int(prof["coins"]) - int(o["price"])
		owned.append(id)
		Sfx.play("ammo_pickup", -4.0)
	prof["outfit"] = id
	Profile.save_profile(prof)
	preview_soldier.set_outfit(o["color"])
	_store()

## signing in: as a guest, with Google or Facebook (Supabase); the project's public key pasted once
func _login() -> void:
	var on := get_node_or_null("/root/Online")
	var v := _open("تسجيل الدخول")
	if on == null:
		v.add_child(UiTheme.label("الاتصال غير متاح في هذه النسخة", 22))
		return
	v.add_child(UiTheme.label("الحالة: " + String(on.status), 20, false, UiTheme.DIM))
	if not on.configured():
		v.add_child(UiTheme.label("الصق مفتاح مشروعك العام من لوحة Supabase: Settings ← API Keys ← Publishable key (يبدأ بـ sb_publishable_) أو المفتاح القديم anon public (يبدأ بـ eyJ). لا تضع المفتاح السري (secret / service_role) أبداً.", 18))
		var key := LineEdit.new()
		key.placeholder_text = "sb_publishable_…  أو  eyJ…"
		key.custom_minimum_size = Vector2(0, 50)
		v.add_child(key)
		var warn := UiTheme.label("", 18, false, Color(1.0, 0.6, 0.45))
		v.add_child(_btn("حفظ المفتاح", func():
			var k := key.text.strip_edges()
			if k.begins_with("sb_secret_"):
				warn.text = "هذا هو المفتاح السري — لا تضعه في اللعبة. انسخ Publishable key."
				return
			if not on.key_looks_right(k):
				warn.text = "المفتاح غير صحيح: يجب أن يبدأ بـ sb_publishable_ أو eyJ"
				return
			on.set_key(k)
			_login(), 50))
		v.add_child(warn)
		return
	v.add_child(_btn("الدخول كضيف (معرّف فريد)", func():
		await on.sign_in_guest()
		_login()))
	v.add_child(_btn("الدخول بحساب Google", func(): on.sign_in_oauth("google")))
	v.add_child(_btn("الدخول بحساب Facebook", func(): on.sign_in_oauth("facebook")))
	if on.signed():
		v.add_child(_btn("تسجيل الخروج", func():
			on.sign_out()
			_login()))
	v.add_child(UiTheme.label("بعد الدخول بـ Google أو Facebook في المتصفح عد إلى اللعبة: يكتمل الدخول وحده.", 17, false, UiTheme.DIM))

## friends: find a player by his ID, send a request, answer the ones that came, see who is online
func _friends() -> void:
	var on := get_node_or_null("/root/Online")
	var v := _open("الأصدقاء")
	v.add_child(UiTheme.label("معرّفك: %s — أعطه لأصدقائك ليجدوك" % prof["id"], 22, true, UiTheme.ACCENT))
	if on == null or not on.signed():
		v.add_child(UiTheme.label("سجّل الدخول أولاً (ولو كضيف) لتضيف الأصدقاء.", 20))
		v.add_child(_btn("تسجيل الدخول", _login))
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
func _join(room: String) -> void:
	Online.pending_room = room
	Settings.set_v("mode", "domination")
	if String(Settings.get_v("map")) != "valley":
		Settings.set_v("map", "valley")
		get_tree().reload_current_scene()
		return
	start_pressed.emit()
