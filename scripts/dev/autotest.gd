extends Node
## Developer check, only active when the game is started with:  -- --autotest <out_dir>
## Walks through the menu and a few spots, shoots, changes the weather, saves screenshots, prints timings.

var main: Node
var out := "user://shots"
var only := ""

func _ready() -> void:
	var a := OS.get_cmdline_user_args()
	var i := a.find("--autotest")
	if i >= 0 and i + 1 < a.size():
		out = a[i + 1]
	var j := a.find("--only")
	if j >= 0 and j + 1 < a.size():
		only = a[j + 1]
	var q := a.find("--quality")
	if q >= 0 and q + 1 < a.size():
		Settings.apply_preset(int(a[q + 1]))
	DirAccess.make_dir_recursive_absolute(out)
	_run.call_deferred()

func _wait(s: float) -> void:
	await get_tree().create_timer(s, true, false, true).timeout

func _frames(n: int) -> void:
	for k in n:
		await get_tree().process_frame

func shot(name: String) -> void:
	await _frames(3)
	var img := get_viewport().get_texture().get_image()
	img.save_png("%s/%s.png" % [out, name])
	print("SHOT ", name, "  fps=", Engine.get_frames_per_second(), "  draws=", Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME), "  prims=", Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME))

func _touch(i: int, p: Vector2, down: bool) -> void:
	var e := InputEventScreenTouch.new()
	e.index = i
	e.position = p
	e.pressed = down
	Input.parse_input_event(e)

func _drag(i: int, p: Vector2, rel: Vector2) -> void:
	var e := InputEventScreenDrag.new()
	e.index = i
	e.position = p
	e.relative = rel
	Input.parse_input_event(e)

func _place(p: Vector3, yaw: float, pitch: float) -> void:
	var pl: Player = main.player
	pl.global_position = p
	pl.velocity = Vector3.ZERO
	pl.yaw = yaw
	pl.pitch = pitch
	pl.yaw_node.rotation.y = yaw
	pl.body.body_yaw = yaw
	main.world.focus = p
	main.world.terrain.update_collision(p, 1.0, true)
	main.world.veg.update(p, 1.0, true)

func _run() -> void:
	main = get_parent()
	var t0 := Time.get_ticks_msec()
	while main.world == null or not main.world.ready_built or main.state != "menu":
		await _frames(1)
	print("LOADED in ", Time.get_ticks_msec() - t0, " ms")
	var w: World = main.world
	await _wait(1.0)
	if only == "" or only == "menu":
		await shot("01_menu")
		main.menus.show_settings("main")
		await shot("02_settings")
		main.menus.show_main()
	main._start()
	await _wait(1.2)
	await shot("03_dugout_door")
	var pl: Player = main.player
	pl.yaw += PI
	pl.pitch = -0.15
	await _wait(0.6)
	await shot("04_dugout_inside")
	# along the fire trench
	var tr: Array = w.lay["trenches"]
	var front: Array = tr[0]["pts"]
	var k := front.size() / 2
	var a := Vector3(front[k][0], 0, front[k][1])
	var b := Vector3(front[k + 1][0], 0, front[k + 1][1])
	a.y = w.height(a.x, a.z) + 0.15
	var d := (b - a)
	# a spot on the parapet looking over no-man's land
	var c := a + Vector3(0, 0, -3.5)
	c.y = w.height(c.x, c.z) + 0.1
	if only == "weather":
		await _place(c, 0.0, -0.06)
		await _wait(1.0)
		await _weather(pl)
		print("AUTOTEST DONE")
		Sfx.quit_game()
		return
	await _place(a, atan2(-d.x, -d.z), -0.05)
	await _wait(1.0)
	await shot("05_trench")
	# phone controls: push the stick forward (along the trench floor), drag to look
	var t := main.touch as TouchControls
	t.visible = true
	var yaw0 := pl.yaw
	var p0 := pl.global_position
	_touch(0, Vector2(200, 560), true)
	for s in 12:
		_drag(0, Vector2(200, 560 - s * 8), Vector2(0, -8))
		await _frames(1)
	_touch(1, Vector2(900, 300), true)
	for s in 6:
		_drag(1, Vector2(900 + s * 10, 300), Vector2(10, 0))
		await _frames(1)
	await _wait(0.8)
	_touch(0, Vector2(200, 470), false)
	_touch(1, Vector2(960, 300), false)
	print("TOUCH moved %.2f m, yaw %.3f -> %.3f, hint='%s'" % [p0.distance_to(pl.global_position), yaw0, pl.yaw, pl.interact_hint()])
	await shot("05b_touch_controls")
	t.visible = false
	# climb out towards the enemy side
	await _place(a, 0.0, 0.0)
	for f in 20:
		await get_tree().physics_frame
	var y0 := pl.global_position.y
	var ss := pl.get_world_3d().direct_space_state
	var fwd := Vector3(0, 0, -1)
	for reach: float in [0.45, 0.7, 0.95, 1.2]:
		var top := pl.global_position + fwd * reach + Vector3(0, 2.1, 0)
		var r := ss.intersect_ray(PhysicsRayQueryParameters3D.create(top, top + Vector3(0, -2.0, 0), 1 | 2))
		if r.is_empty():
			print("  reach %.2f: no hit" % reach)
			continue
		var lp: Vector3 = r["position"]
		print("  reach %.2f: h=%.2f n=%s fits=%s up_free=%s" % [reach, lp.y - pl.global_position.y, str(r["normal"]), str(not pl.test_move(Transform3D(Basis(), lp + fwd * 0.25 + Vector3(0, 0.06, 0)), Vector3(0, 0.04, 0))), str(not pl.test_move(pl.global_transform, Vector3(0, lp.y - pl.global_position.y + 0.08, 0)))])
	print("  on floor=", pl.is_on_floor(), " pos=", pl.global_position, " terrain=", w.height(pl.global_position.x, pl.global_position.z))
	pl.jump_or_climb()
	var started := pl.mantle_t >= 0.0
	# count physics steps, not wall time: the software renderer of the test machine runs at ~1 fps
	for f in 80:
		await get_tree().physics_frame
	print("CLIMB started=%s from y=%.2f to y=%.2f (ground %.2f)" % [str(started), y0, pl.global_position.y, w.base_height(pl.global_position.x, pl.global_position.z)])
	# up on the parapet looking over no-man's land
	await _place(c, 0.0, -0.06)
	await _wait(1.0)
	await shot("06_nomansland")
	# turn round: the burnt forest behind the lines
	pl.yaw = PI
	await _wait(0.8)
	await shot("07_forest")
	# shooting
	pl.yaw = 0.0
	pl.pitch = -0.12
	pl.weapon.touch_fire = true
	await _wait(0.33)
	await shot("08_firing")
	pl.weapon.touch_fire = false
	await _wait(0.5)
	pl.weapon.aim_toggle = true
	await _wait(0.6)
	await shot("09_aiming")
	pl.weapon.aim_toggle = false
	# a communication trench
	var comm: Array = tr[2]["pts"]
	var m := comm.size() / 3
	var p2 := Vector3(comm[m][0], 0, comm[m][1])
	p2.y = w.height(p2.x, p2.z) + 0.15
	await _place(p2, PI, -0.05)
	await _wait(1.0)
	await shot("10_comm_trench")
	if OS.get_cmdline_user_args().has("--fast"):
		print("AUTOTEST DONE")
		Sfx.quit_game()
		return
	await _weather(pl)
	# far view from a hill
	var h := Vector3(220, 0, 360)
	h.y = w.height(h.x, h.z) + 0.1
	await _place(h, deg_to_rad(200.0), -0.02)
	await _wait(1.5)
	await shot("14_far")
	print("AUTOTEST DONE")
	Sfx.quit_game()

## rain, dusk and night from where the player stands
func _weather(pl: Player) -> void:
	Settings.set_v("weather", 2)
	await _wait(1.5)
	await _frames(8)
	await shot("11_rain")
	Settings.set_v("weather", 0)
	Settings.set_v("time", 2)
	await _wait(1.0)
	await shot("12_dusk")
	Settings.set_v("time", 3)
	pl.toggle_flashlight()
	await _wait(1.0)
	await shot("13_night")
	Settings.set_v("time", 1)
	pl.toggle_flashlight()
