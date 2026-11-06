extends Control
## The small app's first start (export preset «Android Lite»): the game's content (every model, texture, sound and the
## island's data) comes from the GitHub release this build was made with, as content-<build>.pck, in 8 MB pieces; when
## the line drops it goes on from where it stopped. The file is checked (size and SHA-256), mounted, and the game
## starts. Later starts mount the file already there. The full APK has the content inside and never shows this screen.
## res://boot/content.json ({"url", "size", "sha256", "build", "page"}) is written by the build (.github/workflows).

const INFO_PATH := "res://boot/content.json"
const PIECE := 8 * 1024 * 1024
const RETRIES := 30

var info := {}
var dest := ""
var part := ""
var http: HTTPRequest
var got := 0
var total := 0
var fails := 0
var title: Label
var status: Label
var detail: Label
var bar: ProgressBar
var btn: Button
var _hash: HashingContext
var _hfile: FileAccess
var _rate_t := 0.0
var _rate_b := 0
var _rate := 0.0
var _font: Font

func _ready() -> void:
	_font = load("res://fonts/Vazirmatn-Bold.woff2") as Font if ResourceLoader.exists("res://fonts/Vazirmatn-Bold.woff2") else null
	_ui()
	var txt := FileAccess.get_file_as_string(INFO_PATH)
	var j = JSON.parse_string(txt) if txt != "" else null
	if not (j is Dictionary) or not (j as Dictionary).has("url"):
		_fail("معلومات المحتوى مفقودة من هذا التطبيق. نزّل النسخة الكاملة من صفحة الإصدار.")
		return
	info = j
	print("BOOT content ", info.get("build"), " ", info.get("size"))
	total = int(info["size"])
	# (a .zip or a .pck, named like the file on the release: Godot tells the two apart by the extension)
	dest = "user://content-%s.%s" % [str(info["build"]), String(info["url"]).get_extension()]
	part = dest + ".part"
	http = HTTPRequest.new()
	http.use_threads = true
	http.timeout = 90.0
	http.max_redirects = 8
	add_child(http)
	http.request_completed.connect(_on_piece)
	if FileAccess.file_exists(dest) and _size(dest) == total:
		_mount()
	else:
		_start()

# ------------------------------------------------------------------ the screen
func _ui() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	layout_direction = Control.LAYOUT_DIRECTION_RTL
	var bg := ColorRect.new()
	bg.color = Color(0.06, 0.07, 0.06)
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	var box := VBoxContainer.new()
	box.set_anchors_preset(Control.PRESET_CENTER)
	box.custom_minimum_size = Vector2(760, 0)
	box.position = Vector2(-380, -150)
	box.add_theme_constant_override("separation", 18)
	add_child(box)
	title = _label("نداء البقاء", 48, Color(1.0, 0.8, 0.25))
	box.add_child(title)
	status = _label("يجهّز ملفات اللعبة...", 26, Color(0.95, 0.94, 0.9))
	box.add_child(status)
	bar = ProgressBar.new()
	bar.custom_minimum_size = Vector2(0, 30)
	bar.max_value = 1.0
	bar.show_percentage = false
	var fill := StyleBoxFlat.new()
	fill.bg_color = Color(0.95, 0.68, 0.16)
	fill.set_corner_radius_all(6)
	var back := StyleBoxFlat.new()
	back.bg_color = Color(1, 1, 1, 0.12)
	back.set_corner_radius_all(6)
	bar.add_theme_stylebox_override("fill", fill)
	bar.add_theme_stylebox_override("background", back)
	box.add_child(bar)
	detail = _label("", 20, Color(1, 1, 1, 0.7))
	box.add_child(detail)
	btn = Button.new()
	btn.text = "إعادة المحاولة"
	btn.custom_minimum_size = Vector2(260, 64)
	btn.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	if _font:
		btn.add_theme_font_override("font", _font)
	btn.add_theme_font_size_override("font_size", 26)
	btn.visible = false
	btn.pressed.connect(func():
		fails = 0
		_start())
	box.add_child(btn)

func _label(t: String, fs: int, col: Color) -> Label:
	var l := Label.new()
	l.text = t
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	if _font:
		l.add_theme_font_override("font", _font)
	l.add_theme_font_size_override("font_size", fs)
	l.add_theme_color_override("font_color", col)
	return l

func _mb(b: int) -> String:
	return "%.1f" % (b / 1048576.0)

# ------------------------------------------------------------------ downloading
func _size(p: String) -> int:
	var f := FileAccess.open(p, FileAccess.READ)
	if f == null:
		return -1
	var n := f.get_length()
	f.close()
	return n

func _start() -> void:
	btn.visible = false
	got = maxi(_size(part), 0)
	if got > total:
		DirAccess.remove_absolute(ProjectSettings.globalize_path(part))
		got = 0
	status.text = "ينزّل محتوى اللعبة (مرة واحدة فقط)" if got == 0 else "يكمل التنزيل من حيث توقف"
	_rate_t = Time.get_ticks_msec() / 1000.0
	_rate_b = got
	_next()

func _next() -> void:
	print("BOOT piece from ", got, " of ", total)
	if got >= total:
		_verify()
		return
	var to := mini(got + PIECE, total) - 1
	var err := http.request(String(info["url"]), ["Range: bytes=%d-%d" % [got, to], "User-Agent: CallOfSurvival-Godot"])
	if err != OK:
		_again("تعذّر بدء الطلب (%d)" % err)

func _on_piece(result: int, code: int, _headers: PackedStringArray, body: PackedByteArray) -> void:
	print("BOOT reply result ", result, " code ", code, " bytes ", body.size())
	if result != HTTPRequest.RESULT_SUCCESS:
		_again("انقطع الاتصال")
		return
	if code == 206 or (code == 200 and got == 0 and body.size() == total):
		var f := FileAccess.open(part, FileAccess.READ_WRITE if FileAccess.file_exists(part) else FileAccess.WRITE)
		if f == null:
			_fail("لا مكان للحفظ على الهاتف (يلزم %s ميغابايت فارغة)." % _mb(total))
			return
		f.seek(got)
		f.store_buffer(body)
		f.close()
		got += body.size()
		fails = 0
		_next()
	elif code == 416:
		got = total
		_next()
	elif code == 404:
		_fail("هذه النسخة من المحتوى لم تعد على GitHub: نزّل أحدث تطبيق من صفحة الإصدار:\n" + String(info.get("page", "")))
	else:
		_again("ردّ الخادم %d" % code)

## a failed piece: try again on its own a few seconds later, then leave it to the button
func _again(why: String) -> void:
	fails += 1
	if fails > RETRIES:
		_fail(why + ". تأكد من الإنترنت ثم اضغط إعادة المحاولة؛ سيكمل من حيث توقف.")
		return
	status.text = "%s، يعيد المحاولة..." % why
	await get_tree().create_timer(minf(2.0 + fails, 10.0)).timeout
	if not btn.visible:
		_next()

func _fail(why: String) -> void:
	print("BOOT fail: ", why)
	status.text = why
	btn.visible = info.size() > 0

func _process(delta: float) -> void:
	if _hfile:
		_hash_step()
		return
	if http == null or total <= 0:
		return
	var cur := got + (http.get_downloaded_bytes() if http.get_http_client_status() == HTTPClient.STATUS_BODY else 0)
	bar.value = float(cur) / float(total)
	var now := Time.get_ticks_msec() / 1000.0
	if now - _rate_t > 1.0:
		_rate = lerpf(_rate, float(cur - _rate_b) / (now - _rate_t), 0.5) if _rate > 0.0 else float(cur - _rate_b) / (now - _rate_t)
		_rate_t = now
		_rate_b = cur
	var left := ""
	if _rate > 1000.0 and cur < total:
		left = "  —  باقي نحو %d دقيقة" % int(ceil((total - cur) / _rate / 60.0))
	detail.text = "%s / %s ميغابايت%s" % [_mb(cur), _mb(total), left]

# ------------------------------------------------------------------ checking and starting
func _verify() -> void:
	status.text = "يتحقق من الملف..."
	_hash = HashingContext.new()
	_hash.start(HashingContext.HASH_SHA256)
	_hfile = FileAccess.open(part, FileAccess.READ)
	if _hfile == null:
		_fail("تعذّر فتح الملف بعد التنزيل.")

func _hash_step() -> void:
	_hash.update(_hfile.get_buffer(4 * 1024 * 1024))
	bar.value = float(_hfile.get_position()) / float(maxi(total, 1))
	if _hfile.get_position() < _hfile.get_length():
		return
	_hfile.close()
	_hfile = null
	var hex := _hash.finish().hex_encode()
	if hex != String(info["sha256"]).to_lower():
		DirAccess.remove_absolute(ProjectSettings.globalize_path(part))
		got = 0
		_fail("الملف وصل تالفاً وحُذف. اضغط إعادة المحاولة لتنزيله من جديد.")
		return
	var d := DirAccess.open("user://")
	for f in d.get_files():
		if f.begins_with("content-") and f != dest.get_file() and f != part.get_file():
			d.remove(f)
	d.rename(part.get_file(), dest.get_file())
	_mount()

func _mount() -> void:
	print("BOOT mount ", dest)
	status.text = "يشغّل اللعبة..."
	detail.text = ""
	bar.value = 1.0
	await get_tree().process_frame
	if not ProjectSettings.load_resource_pack(dest, true):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(dest))
		got = 0
		_fail("تعذّر فتح ملف المحتوى فحُذف. اضغط إعادة المحاولة لتنزيله من جديد.")
		return
	var sfx := get_node_or_null("/root/Sfx")
	if sfx and sfx.has_method("rescan"):
		sfx.rescan()
	await get_tree().process_frame
	get_tree().change_scene_to_file("res://scenes/main.tscn")
