extends Node
## Game flow: loading screen -> main menu (a camera drifting down the front trench) -> play -> pause.

var world: World
var player: Player
var menu_cam: Camera3D
var hud: Hud
var match_: Match
var touch: TouchControls
var menus: Menus
var post: ColorRect
var post_mat: ShaderMaterial
var loading: Control
var load_bar: ProgressBar
var load_text: Label
var state := "loading"
var menu_t := 0.0
var _last_basis := Basis()
var _shadow_atlas := -1

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	get_tree().quit_on_go_back = false
	get_window().theme = UiTheme.build()
	_build_loading()
	if OS.get_cmdline_user_args().has("--autotest"):
		var at: Node = (load("res://scripts/dev/autotest.gd") as Script).new()
		at.process_mode = Node.PROCESS_MODE_ALWAYS
		add_child(at)
	await get_tree().process_frame
	await get_tree().process_frame
	world = World.new()
	world.name = "World"
	world.map_id = String(Settings.get_v("map"))
	var args := OS.get_cmdline_user_args()
	var mi := args.find("--map")
	if mi >= 0 and mi + 1 < args.size():
		world.map_id = args[mi + 1]
	world.process_mode = Node.PROCESS_MODE_PAUSABLE
	add_child(world)
	world.progress.connect(_on_progress)
	await world.build()
	player = Player.new()
	player.name = "Player"
	world.add_child(player)
	player.setup(world)
	var sp := world.spawn_point()
	player.spawn(sp[0], sp[1])
	player.message.connect(_on_message)
	if world.battle:
		world.battle.shake.connect(func(a): player.add_shake(a))
	if world.boom:
		world.boom.shake.connect(func(a): player.add_shake(a))
	if world.raid:
		world.raid.warned.connect(func(t: String): hud.show_message(t))

	menu_cam = Camera3D.new()
	menu_cam.fov = 78.0
	menu_cam.far = 2600.0 if world.map_id == "front" else 6500.0
	player.cam.far = menu_cam.far
	world.add_child(menu_cam)
	_build_layers()
	Settings.changed.connect(_on_setting)
	_on_setting("")
	loading.queue_free()
	_to_menu()
	if Online.pending_room != "" and world.map_id == "valley":
		_start()                                 # joining a friend's match (the valley was loaded for it)

func _build_loading() -> void:
	var layer := CanvasLayer.new()
	layer.layer = 10
	add_child(layer)
	loading = Control.new()
	loading.set_anchors_preset(Control.PRESET_FULL_RECT)
	loading.layout_direction = Control.LAYOUT_DIRECTION_RTL
	layer.add_child(loading)
	var bg := ColorRect.new()
	bg.color = Color(0.035, 0.035, 0.03)
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	loading.add_child(bg)
	var v := VBoxContainer.new()
	v.set_anchors_preset(Control.PRESET_CENTER)
	v.position = Vector2(-330, -110)
	v.size = Vector2(660, 220)
	v.add_theme_constant_override("separation", 14)
	loading.add_child(v)
	v.add_child(UiTheme.label("الوادي" if String(Settings.get_v("map")) == "valley" else "الجبهة", 64, true))
	load_text = UiTheme.label("…", 20, false, UiTheme.DIM)
	v.add_child(load_text)
	load_bar = ProgressBar.new()
	load_bar.custom_minimum_size = Vector2(660, 10)
	load_bar.max_value = 1.0
	load_bar.show_percentage = false
	v.add_child(load_bar)
	v.add_child(UiTheme.label("في المرة الأولى على الهاتف يستورد محرك Godot الملفات، فقد يطول التحميل قليلاً.", 16, false, UiTheme.DIM))

func _on_progress(f: float, t: String) -> void:
	if load_bar:
		load_bar.value = f
	if load_text and t != "":
		load_text.text = t

func _build_layers() -> void:
	var pl := CanvasLayer.new()
	pl.layer = 0
	add_child(pl)
	post = ColorRect.new()
	post.set_anchors_preset(Control.PRESET_FULL_RECT)
	post.mouse_filter = Control.MOUSE_FILTER_IGNORE
	post_mat = ShaderMaterial.new()
	post_mat.shader = load("res://shaders/bodycam.gdshader")
	post.material = post_mat
	pl.add_child(post)
	var hl := CanvasLayer.new()
	hl.layer = 1
	hl.process_mode = Node.PROCESS_MODE_PAUSABLE
	add_child(hl)
	hud = Hud.new()
	hud.player = player
	player.hit_marker.connect(hud.on_hit)
	hl.add_child(hud)
	var tl := CanvasLayer.new()
	tl.layer = 2
	tl.process_mode = Node.PROCESS_MODE_PAUSABLE
	add_child(tl)
	touch = TouchControls.new()
	touch.player = player
	touch.pause_pressed.connect(_pause)
	tl.add_child(touch)
	var ml := CanvasLayer.new()
	ml.layer = 3
	ml.process_mode = Node.PROCESS_MODE_ALWAYS
	add_child(ml)
	menus = Menus.new()
	menus.start_pressed.connect(_start)
	menus.resume_pressed.connect(_resume)
	menus.main_menu_pressed.connect(_to_menu)
	menus.layout_editor.connect(func():
		menus.visible = false
		touch.start_editor())
	touch.editor_closed.connect(func():
		touch.visible = state == "play" and (Settings.mobile or DisplayServer.is_touchscreen_available())
		menus.visible = true
		menus.show_settings("pause" if state == "pause" else "main"))
	ml.add_child(menus)

func _on_setting(_k: String) -> void:
	if player:
		player.apply_settings()
	if touch:
		touch._layout()
	var sh := int(Settings.get_v("shadows"))
	if sh != _shadow_atlas:
		_shadow_atlas = sh

func _on_message(t: String) -> void:
	if hud:
		hud.show_message(t)

func _to_menu() -> void:
	state = "menu"
	get_tree().paused = false
	player.active = false
	player.visible = false
	menu_cam.current = true
	hud.visible = false
	touch.visible = false
	touch.reset()
	menus.show_main()
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE

func _start() -> void:
	state = "play"
	var join := Online.pending_room if world.map_id == "valley" else ""
	Online.pending_room = ""
	var args := OS.get_cmdline_user_args()
	if join == "" and args.has("--guest"):
		var ri := args.find("--room")
		join = args[ri + 1] if ri >= 0 and ri + 1 < args.size() else "dev"
	if world.map_id == "valley" and (String(Settings.get_v("mode")) == "domination" or join != "") and match_ == null:
		match_ = Match.new()
		match_.name = "Match"
		world.add_child(match_)
		match_.setup(world, player, join != "")
		_start_coop(join)
		match_.note.connect(func(t: String): hud.show_message(t))
		match_.ended.connect(_on_match_end)
		player.died.connect(_on_player_died)
		player.respawned.connect(_on_player_respawned)
		hud.match_ = match_
		# the match starts with a jump over the team's side of the city
		var first: Array = match_.player_spawn("air")
		player.spawn(first[0], first[1])
		player.air_start()
	else:
		var sp := world.spawn_point()
		player.spawn(sp[0], sp[1])
	player.visible = true
	player.active = true
	player.cam.current = true
	menus.visible = false
	hud.visible = true
	touch.visible = Settings.mobile or DisplayServer.is_touchscreen_available()
	touch.reset()
	if not touch.visible:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	Sfx.play("rec_beep", -4.0, 0.0, "UI")
	if match_:
		hud.show_message("سيطر على المناطق الخمس في المدينة المدمرة — اهبط بالمظلة في جهة فريقك")
	elif world.map_id == "valley":
		hud.show_message("بدأ التسجيل — الوادي: سيطر على المناطق الخمس في المدينة المدمرة")
	else:
		hud.show_message("بدأ التسجيل — اخرج من الملجأ إلى الخندق")

func _pause() -> void:
	if state != "play":
		return
	state = "pause"
	get_tree().paused = true
	touch.reset()
	menus.show_pause()
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE

func _resume() -> void:
	state = "play"
	get_tree().paused = false
	menus.visible = false
	if not touch.visible:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_GO_BACK_REQUEST:
		if state == "play":
			_pause()
		elif state == "pause":
			_resume()
	elif what == NOTIFICATION_APPLICATION_FOCUS_OUT and state == "play":
		_pause()

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("pause"):
		if state == "play":
			_pause()
		elif state == "pause":
			_resume()
	elif event.is_action_pressed("toggle_fps"):
		Settings.set_v("show_fps", not bool(Settings.get_v("show_fps")))
	elif state == "play" and event is InputEventMouseButton and (event as InputEventMouseButton).pressed and not touch.visible:
		if Input.mouse_mode != Input.MOUSE_MODE_CAPTURED:
			Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

func _process(delta: float) -> void:
	if world == null or not world.ready_built or post_mat == null:
		return
	if state == "menu":
		_menu_camera(delta)
	var cam := get_viewport().get_camera_3d()
	var strength := float(Settings.get_v("bodycam")) if state != "menu" else 0.55
	if state != "menu" and player:
		strength *= 1.0 - smoothstep(0.0, 1.0, player.tpp_k)   # the chest-camera look belongs to first person only
	post_mat.set_shader_parameter("strength", strength)
	post_mat.set_shader_parameter("exposure", world.env.view_exposure())
	post_mat.set_shader_parameter("time_s", Time.get_ticks_msec() * 0.001)
	post_mat.set_shader_parameter("flash", world.env.flash)
	var smear := Vector2.ZERO
	if cam and bool(Settings.get_v("motion_blur")) and state == "play":
		var b := cam.global_transform.basis
		var dyaw := (_last_basis.z.cross(b.z)).y
		var dpitch := b.z.y - _last_basis.z.y
		_last_basis = b
		var fov := deg_to_rad(cam.fov)
		smear = Vector2(-dyaw / fov, dpitch / fov) * 0.25
		if smear.length() < 0.003:
			smear = Vector2.ZERO
		smear = smear.limit_length(0.012)
	post_mat.set_shader_parameter("smear", smear)

func _menu_camera(delta: float) -> void:
	var path: Array = world.lay["menu_cam"]
	if path.size() < 2:
		return
	menu_t += delta * 0.045
	var n := path.size() - 1
	var u := pingpong(menu_t, 1.0) * n
	var i := mini(int(u), n - 1)
	var f := u - i
	var a := Vector3(path[i][0], path[i][1], path[i][2])
	var b := Vector3(path[i + 1][0], path[i + 1][1], path[i + 1][2])
	var p := a.lerp(b, smoothstep(0.0, 1.0, f))
	var dir := (b - a)
	dir.y = 0.0
	var forward := dir.normalized() if fmod(menu_t, 2.0) < 1.0 else -dir.normalized()
	var look: Vector3
	if world.map_id == "front":
		# walking the trench
		p.y = world.base_height(p.x, p.z) + 0.55 + sin(menu_t * 9.0) * 0.03
		look = p + forward * 8.0 + Vector3(0, -0.6, 0) + Vector3(-forward.z, 0, forward.x) * sin(menu_t * 3.0) * 2.5
	else:
		# a slow drone pass over the valley (the path is already above the ground)
		p.y = maxf(p.y, world.height(p.x, p.z) + 8.0) + sin(menu_t * 2.0) * 0.4
		look = p + forward * 70.0 + Vector3(0, -12.0, 0) + Vector3(-forward.z, 0, forward.x) * sin(menu_t * 1.5) * 20.0
	menu_cam.global_position = menu_cam.global_position.lerp(p, clampf(delta * 2.0, 0.0, 1.0)) if menu_cam.global_position.length() > 1.0 else p
	var t := menu_cam.global_transform.looking_at(look, Vector3.UP)
	menu_cam.global_transform = menu_cam.global_transform.interpolate_with(t, clampf(delta * 1.5, 0.0, 1.0))


## a match with friends: hosted here (a room on the player's profile that his friends can join) or a friend's one
func _start_coop(join: String) -> void:
	var args := OS.get_cmdline_user_args()
	var dev_room := ""
	var ri := args.find("--room")
	if ri >= 0 and ri + 1 < args.size():
		dev_room = args[ri + 1]
	if join == "" and not Online.can_host():
		return
	var coop := Coop.new()
	coop.name = "Coop"
	match_.coop = coop
	match_.add_child(coop)
	var prof := Profile.load_profile()
	var room := join if join != "" else (dev_room if dev_room != "" else "m" + String(prof.get("id", "")))
	coop.start(match_, player, room, join == "")
	if join == "":
		Online.set_room(room)
	elif world.raid:
		world.raid.enabled = false            # the host's game has the raids

func _on_player_died(a: Node) -> void:
	match_.on_player_death(a)
	touch.reset()
	if player.lives >= 0 and not touch.visible:
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE      # to pick where to come back

func _on_player_respawned() -> void:
	if state == "play" and not touch.visible:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

## the match is over: the results over the game, then back to the menu with a new match
func _on_match_end(r: Dictionary) -> void:
	if match_ and match_.coop and not match_.guest:
		Online.set_room("")
	hud.show_results(r)
	player.active = false
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
