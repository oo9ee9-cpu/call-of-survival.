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
	if pl.para > 0:
		# the match starts with a jump: put away the chute
		pl.para = 0
		if pl.chute:
			pl.chute.visible = false
		pl._fall_sound(false)
		pl.body.airborne = false
	pl.global_position = p
	pl.velocity = Vector3.ZERO
	pl.yaw = yaw
	pl.pitch = pitch
	pl.yaw_node.rotation.y = yaw
	pl.body.body_yaw = yaw
	main.world.focus = p
	main.world.terrain.update_collision(p, 1.0, true)
	if main.world.veg:
		main.world.veg.update(p, 1.0, true)
	if main.world.valley:
		main.world.valley.update(p + Vector3(0, 1.6, 0), 1.0, true)

func _run() -> void:
	main = get_parent()
	var t0 := Time.get_ticks_msec()
	while main.world == null or not main.world.ready_built or main.state != "menu":
		await _frames(1)
	print("LOADED in ", Time.get_ticks_msec() - t0, " ms")
	var w: World = main.world
	await _wait(1.0)
	if only == "" or only == "menu" or only == "ui":
		await shot("01_menu")
		main.menus.show_settings("main")
		await shot("02_settings")
		main.menus.show_main()
	if only == "menu":
		print("AUTOTEST DONE")
		Sfx.quit_game()
		return
	if only == "online":
		await _online_test()
		print("AUTOTEST DONE")
		Sfx.quit_game()
		return
	if only == "ui" or only.begins_with("coop") or only == "flight":
		Settings.set_v("team_size", 0)
	if only == "flight":
		main.menus.main_panel.call("_start_matchmaking")
		await _wait(0.5)
		await shot("f00_matchmaking")
		while main.state != "play":
			await get_tree().process_frame
		await _flight_test(w)
		print("AUTOTEST DONE")
		Sfx.quit_game()
		return
	main._start()
	if w.map_id == "valley" and only == "coop_host":
		await _coop_host_test(w)
		print("AUTOTEST DONE")
		Sfx.quit_game()
		return
	if w.map_id == "valley" and only == "coop_guest":
		await _coop_guest_test(w)
		print("AUTOTEST DONE")
		Sfx.quit_game()
		return
	if w.map_id == "valley" and only == "ui":
		await _ui_test(w)
		print("AUTOTEST DONE")
		Sfx.quit_game()
		return
	if w.map_id == "valley" and only == "match":
		Engine.max_physics_steps_per_frame = 8
		await _match_test(w)
		print("AUTOTEST DONE")
		Sfx.quit_game()
		return
	if w.map_id == "valley" and only == "war":
		Engine.max_physics_steps_per_frame = 8
		await _war_test(w)
		print("AUTOTEST DONE")
		Sfx.quit_game()
		return
	if w.map_id == "valley" and only == "hud":
		await _hud_test(w)
		print("AUTOTEST DONE")
		Sfx.quit_game()
		return
	if w.map_id == "valley" and only == "island":
		await _island_test(w)
		print("AUTOTEST DONE")
		Sfx.quit_game()
		return
	if w.map_id == "valley" and only == "perf":
		await _perf_test(w)
		print("AUTOTEST DONE")
		Sfx.quit_game()
		return
	if w.map_id == "valley" and only == "raid":
		Engine.max_physics_steps_per_frame = 8
		await _raid_test(w)
		print("AUTOTEST DONE")
		Sfx.quit_game()
		return
	if w.map_id == "valley" and only == "combat":
		Engine.max_physics_steps_per_frame = 8
		await _combat_test(w)
		print("AUTOTEST DONE")
		Sfx.quit_game()
		return
	if w.map_id == "valley" and only == "vehicles":
		Engine.max_physics_steps_per_frame = 8
		await _vehicles_test(w)
		print("AUTOTEST DONE")
		Sfx.quit_game()
		return
	if w.map_id == "valley":
		await _valley_tour(w)
		print("AUTOTEST DONE")
		Sfx.quit_game()
		return
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

## the 8 x 8 km map: base, a street, a house inside, a door, a lake, the airfield, a view from a hill, the forest
func _valley_tour(w: World) -> void:
	var pl: Player = main.player
	await _wait(1.0)
	await shot("v01_base")
	var b: Array = w.lay["buildings"]
	var v: Valley = w.valley
	# a city house: stand in the street in front of it, then go inside
	var bi := 0
	for i in b.size():
		if String(b[i][0]) == "house2" and Vector2(b[i][1], b[i][3]).length() < 600.0:
			bi = i
			break
	var xf: Transform3D = v.bxf[bi]
	var pf: Dictionary = v.pref[v.btype[bi]]
	var front := xf * Vector3(-1.5, 0.3, float(pf["d"]) * 0.5 + 7.0)
	var look := xf.basis * Vector3(0, 0, -1)
	await _place(front, atan2(-look.x, -look.z), 0.05)
	await _settle()
	await shot("v02_street")
	# open the front door: stand in front of the first door of the house (outside), facing it
	var dd: Array = pf["doors"][0]
	var hinge: Vector3 = xf * Vector3(dd[0], dd[1], dd[2])
	var db: Basis = xf.basis * Basis(Vector3.UP, float(dd[5]))
	var dcen := hinge + db.x * float(dd[3]) * 0.5
	var dn := db.z
	if (dcen + dn - xf.origin).length() < (dcen - dn - xf.origin).length():
		dn = -dn
	var stand_d := dcen + dn * 1.3
	stand_d.y = w.height(stand_d.x, stand_d.z) + 0.1
	await _place(stand_d, atan2(dn.x, dn.z), -0.1)
	await _settle()
	print("DOOR hint before: '%s'" % pl.interact_hint())
	pl.interact()
	for f in 40:
		await get_tree().physics_frame
	print("DOOR hint after: '%s'" % pl.interact_hint())
	await shot("v03_door")
	var inside := xf * Vector3(1.5, 0.4, 1.0)
	await _place(inside, atan2(-look.x, -look.z) + PI, 0.0)
	await _settle()
	await shot("v04_inside")
	print("INSIDE factor %.2f" % v.inside_factor(inside + Vector3(0, 1.0, 0)).x)
	# a carrier: drop onto its flight deck (the deck is solid), look along it
	var vm: ValleyModels = v.models
	var cv: Dictionary = vm.carriers[0]
	var cxf: Transform3D = cv["xf"]
	var deck_p := cxf * Vector3(0, 0, 0)
	deck_p.y = float(cv["deck"]) + 3.0
	var along := cxf.basis.z if String(cv["name"]) != "cvn65" else cxf.basis.x
	await _place(deck_p, atan2(-along.x, -along.z), 0.0)
	for f in 90:
		await get_tree().physics_frame
	print("CARRIER %s deck=%.2f player_y=%.2f on_floor=%s" % [cv["name"], float(cv["deck"]), pl.global_position.y, pl.is_on_floor()])
	await _settle()
	await shot("v05_carrier_deck")
	# the same lake from its shore, a little uphill
	var lk: Dictionary = w.lay["lakes"][0]
	var dir := Vector3(1, 0, 0.3).normalized()
	var shore := Vector3(float(lk["x"]), 0, float(lk["z"]))
	for k in 200:
		var q := Vector3(float(lk["x"]), 0, float(lk["z"])) + dir * (float(lk["r"]) * 0.6 + k * 6.0)
		if w.height(q.x, q.z) > float(lk["level"]) + 3.0:
			shore = q
			break
	shore.y = w.height(shore.x, shore.z) + 0.2
	await _place(shore, atan2(dir.x, dir.z), -0.03)
	await _settle()
	await shot("v06_lake_carrier")
	# the airfield: on the apron, the hangars with their aircraft ahead
	var ap: Dictionary = w.lay["airport"]
	var apron := Vector3(float(ap["x"]) - 760.0, 0, float(ap["z"]) - 160.0)
	apron.y = w.height(apron.x, apron.z) + 0.2
	await _place(apron, PI * 0.82, 0.04)
	await _settle()
	await shot("v07_airport")
	# a base: the gate and the air defence
	var bs: Dictionary = w.lay["bases"][0]
	var byaw := float(bs["yaw"])
	var gate := Vector3(float(bs["x"]), 0, float(bs["z"])) + Basis(Vector3.UP, byaw) * Vector3(18.0, 0, 150.0)
	gate.y = w.height(gate.x, gate.z) + 0.2
	var to_b := (Vector3(float(bs["x"]), 0, float(bs["z"])) - gate).normalized()
	await _place(gate, atan2(-to_b.x, -to_b.z), 0.02)
	await _settle()
	await shot("v08_base_gate")
	# a capture zone: the computer on the desk
	var cp: Dictionary = vm.computers[0]
	var cpos: Vector3 = cp["pos"]
	var bi2 := 0
	for i in b.size():
		if String(b[i][0]) == "command_post":
			bi2 = i
			break
	var pxf: Transform3D = v.bxf[bi2]
	var stand := pxf * Vector3(0.3, 0.25, -0.2)
	var lookd := (cpos - stand)
	lookd.y = 0.0
	await _place(stand, atan2(-lookd.x, -lookd.z), -0.35)
	await _settle()
	await shot("v09_computer")
	# from a hill over the city
	var mc: Array = w.lay["menu_cam"][0]
	var hill := Vector3(mc[0], 0, mc[2])
	hill.y = w.height(hill.x, hill.z) + 0.2
	var to_c := -Vector3(hill.x, 0, hill.z).normalized()
	await _place(hill, atan2(-to_c.x, -to_c.z), -0.05)
	await _settle()
	await shot("v10_city_view")
	# the forest
	var vg: Dictionary = w.lay["veg"]
	var arr: PackedFloat32Array = vg[vg.keys()[0]]
	var tp := Vector3(arr[0] + 6.0, 0, arr[2] + 6.0)
	tp.y = w.height(tp.x, tp.z) + 0.2
	await _place(tp, PI * 0.25, 0.08)
	await _settle()
	await shot("v11_forest")
	# from the air: 400 m over the middle of the map, looking north-east (the far forest is cards there)
	await _place(Vector3(-600, 420, 900), PI * 0.8, -0.45)
	await _frames(4)
	await shot("v12_aerial")

func _settle() -> void:
	for f in 30:
		await get_tree().physics_frame
	await _wait(0.5)

## drive a jeep, an armoured car and a truck, take off in a jet, lift a helicopter off a carrier, bail out and float down
func _vehicles_test(w: World) -> void:
	var pl: Player = main.player
	var vm: ValleyModels = w.valley.models
	await _wait(0.5)
	for kind in ["tank", "uaz", "fennek", "tam150"]:
		var v: Vehicle = null
		for c in vm.vehicles:
			if c.kind == kind:
				v = c
				break
		if v == null:
			print("VEH %s missing" % kind)
			continue
		var side := v.global_transform * Vector3(v.half_size.x + 0.9, 0, 0)
		side.y = w.height(side.x, side.z) + 0.1
		await _place(side, 0.0, 0.0)
		for f in 30:
			await get_tree().physics_frame
		pl.interact()
		print("VEH %s entered=%s seat=%d frozen=%s wheels=%d" % [kind, pl.vehicle == v, pl.seat, v.freeze, v.wheels.size()])
		var p0 := v.global_position
		var yaw0 := atan2(v.global_transform.basis.z.x, v.global_transform.basis.z.z)
		pl.move_in = Vector2(0.0, 1.0)
		for f in 240:
			await get_tree().physics_frame
		print("VEH %s straight: moved %.1f m  speed %.1f km/h  fwd %.2f" % [kind, v.global_position.distance_to(p0), v.forward_speed() * 3.6, (v.global_position - p0).normalized().dot(v.global_transform.basis.z)])
		await shot("x_%s" % kind)
		if v is Tank:
			pl.move_in = Vector2.ZERO
			v.look(Vector2(-0.6, 0.0))
			for f in 90:
				await get_tree().physics_frame
			v.fire_primary()
			for f in 6:
				await get_tree().physics_frame
			print("TANK turret %.2f rad  gun %.2f  shells in flight %d" % [(v as Tank).turret_yaw, (v as Tank).gun_pitch, w.projectiles.live.size()])
			await shot("x_tank_fire")
			for f in 120:
				await get_tree().physics_frame
			pl.move_in = Vector2(1.0, 0.0)
			var yy := atan2(v.global_transform.basis.z.x, v.global_transform.basis.z.z)
			for f in 120:
				await get_tree().physics_frame
			print("TANK pivot turn: %.2f rad, moved %.1f m" % [wrapf(atan2(v.global_transform.basis.z.x, v.global_transform.basis.z.z) - yy, -PI, PI), v.linear_velocity.length()])
		pl.move_in = Vector2(0.8, 0.8)
		for f in 120:
			await get_tree().physics_frame
		var yaw1 := atan2(v.global_transform.basis.z.x, v.global_transform.basis.z.z)
		print("VEH %s turn right: yaw change %.2f rad (negative = right)" % [kind, wrapf(yaw1 - yaw0, -PI, PI)])
		pl.move_in = Vector2(0.0, -1.0)
		for f in 120:
			await get_tree().physics_frame
		print("VEH %s braking: speed %.1f km/h" % [kind, v.forward_speed() * 3.6])
		pl.move_in = Vector2.ZERO
		pl.interact()
		for f in 20:
			await get_tree().physics_frame
		print("VEH %s exited=%s player_y-ground=%.2f" % [kind, pl.vehicle == null, pl.global_position.y - w.height(pl.global_position.x, pl.global_position.z)])
	# the fighter in a hangar: full throttle out of the door, rotate at take-off speed
	var jet: Vehicle = null
	for c in vm.vehicles:
		if c.kind == "j36" and absf(c.global_position.x - float(w.lay["airport"]["x"])) < 1500.0:
			jet = c
			break
	if jet:
		var side := jet.global_transform * Vector3(jet.half_size.x * 0.4, 0, 0)
		side.y = w.height(side.x, side.z) + 0.1
		await _place(side, 0.0, 0.0)
		for f in 20:
			await get_tree().physics_frame
		pl.enter_vehicle(jet)
		print("JET entered=%s" % (pl.vehicle == jet))
		pl.touch_up = true
		var a := jet as Aircraft
		for f in 900:
			await get_tree().physics_frame
			if a.linear_velocity.length() > 68.0:
				pl.move_in = Vector2(0.0, -0.5)
			if f % 150 == 0:
				print("JET t=%.1fs speed %.0f km/h alt %.1f aoa %.1f ground %s thr %.2f" % [f / 60.0, a.linear_velocity.length() * 3.6, a.alt, rad_to_deg(a.aoa), a.on_ground, a.throttle])
		pl.move_in = Vector2.ZERO
		for f in 240:
			await get_tree().physics_frame
		print("JET after: speed %.0f km/h alt %.1f pitch %.2f" % [a.linear_velocity.length() * 3.6, a.alt, asin(clampf(a.global_transform.basis.z.y, -1, 1))])
		await shot("x_jet")
		a.fire_secondary()
		for f in 20:
			await get_tree().physics_frame
			a.fire_primary()
		print("JET fired: in flight %d, stores %d" % [w.projectiles.live.size(), a.stores])
		await shot("x_jet_fire")
		pl.touch_up = false
		pl.exit_vehicle()
		print("JET bailed: para=%d" % pl.para)
		for f in 300:
			await get_tree().physics_frame
		print("CHUTE para=%d h=%.0f vy=%.1f" % [pl.para, pl.global_position.y - w.height(pl.global_position.x, pl.global_position.z), pl.velocity.y])
		await shot("x_chute")
		for f in 3000:
			await get_tree().physics_frame
			if pl.para == 0:
				break
		print("CHUTE landed para=%d dead=%s health=%.0f" % [pl.para, pl.dead, pl.health])
	# the helicopter on a lake carrier
	var heli: Vehicle = null
	for c in vm.vehicles:
		if c.kind == "mi171" and vm.carrier_at(c.global_position).size() > 0:
			heli = c
			break
	if heli:
		await _place(heli.global_transform * Vector3(heli.half_size.x * 0.3 + 2.0, 0.5, 0), 0.0, 0.0)
		for f in 30:
			await get_tree().physics_frame
		pl.enter_vehicle(heli)
		var h0 := heli.global_position.y
		for f in 240:
			await get_tree().physics_frame
		print("HELI idle on deck: climb %.1f m rotor %.2f" % [heli.global_position.y - h0, (heli as Aircraft).rotor_spin])
		pl.touch_up = true
		for f in 240:
			await get_tree().physics_frame
		pl.touch_up = false
		print("HELI after 4 s up: climb %.1f m vy %.1f" % [heli.global_position.y - h0, heli.linear_velocity.y])
		for f in 600:
			await get_tree().physics_frame
			if f % 150 == 0:
				print("HELI hold t=%.1fs climb %.1f m vy %.1f coll %.2f" % [f / 60.0, heli.global_position.y - h0, heli.linear_velocity.y, (heli as Aircraft).throttle])
		pl.move_in = Vector2(0.0, 0.6)
		for f in 300:
			await get_tree().physics_frame
		print("HELI forward: speed %.0f km/h climb %.1f" % [heli.linear_velocity.length() * 3.6, heli.global_position.y - h0])
		await shot("x_heli")
		pl.move_in = Vector2.ZERO

## guns and sights, loot in a house, an air raid next to us
func _combat_test(w: World) -> void:
	var pl: Player = main.player
	await _wait(0.5)
	pl.give({"type": "gun", "id": "carbine", "n": 30})
	pl.give({"type": "sight", "id": "x4"})
	pl.inv["ammo"]["556"] = 120
	print("GUN now %s sight %s ammo %d reserve %d" % [pl.weapon.gun, pl.weapon.sight, pl.weapon.ammo, pl.weapon.reserve()])
	pl.tpp = false
	pl.weapon.aim_toggle = true
	await _wait(1.0)
	await shot("c01_carbine_x4")
	pl.weapon.touch_fire = true
	for f in 20:
		await get_tree().physics_frame
	pl.weapon.touch_fire = false
	print("GUN fired: ammo %d" % pl.weapon.ammo)
	pl.give({"type": "gun", "id": "sniper", "n": 5})
	await _wait(1.0)
	await shot("c02_sniper_x8")
	pl.weapon.aim_toggle = false
	pl.tpp = true
	await _wait(0.6)
	await shot("c03_tpp_sniper")
	# loot: the nearest house spot that has something
	var lt: Loot = w.valley.loot
	var best := ""
	var bd := INF
	for k in lt.items:
		var it: Dictionary = lt.items[k]
		var d: float = (it["pos"] as Vector3).distance_to(pl.global_position)
		if d < bd and String(it["type"]) == "gun":
			bd = d
			best = k
	if best != "":
		var it2: Dictionary = lt.items[best]
		var p: Vector3 = it2["pos"]
		await _place(p + Vector3(0.9, 0.05, 0.0), PI * 0.5, -0.6)
		for f in 30:
			await get_tree().physics_frame
		print("LOOT %s at %.0f m: hint '%s'" % [Loot.title(it2), bd, pl.interact_hint()])
		await shot("c04_loot")
		pl.interact()
		print("LOOT after: guns %s" % [pl.inv["guns"]])
	# an air raid 140 m away
	var at := pl.global_position + Vector3(140, 0, 40)
	w.raid.start(at)
	print("RAID phase %s zone %s" % [w.raid.phase, w.raid.zone])
	for f in 60 * 14:
		await get_tree().physics_frame
	pl.yaw = atan2(-(at.x - pl.global_position.x), -(at.z - pl.global_position.z))
	pl.pitch = 0.15
	for f in 60 * 5:
		await get_tree().physics_frame
	await shot("c05_raid_jets")
	for f in 60 * 4:
		await get_tree().physics_frame
	await shot("c06_raid_strike")
	for f in 60 * 3:
		await get_tree().physics_frame
	await shot("c07_raid_strike2")
	print("RAID phase %s fired %d health %.0f" % [w.raid.phase, w.raid.fired, pl.health])

## domination: the jump at the start, 99 bots coming in at their deployment points, a fight around the middle zone
## seen from close and from far (the held-rifle clips), the player's death and the choice of where to come back, the end
func _match_test(w: World) -> void:
	var pl: Player = main.player
	var m: Match = main.match_
	if w.raid:
		w.raid.enabled = false
	var g0 := w.height(pl.global_position.x, pl.global_position.z)
	print("MATCH start: para %d height %.0f m over the ground, %.0f m from the middle" % [pl.para, pl.global_position.y - g0, Vector2(pl.global_position.x - m.mid.x, pl.global_position.z - m.mid.z).length()])
	pl.tpp = true
	pl.pitch = -0.5
	for f in 120:
		await get_tree().physics_frame
	await shot("m00_jump")
	var t := 0
	while pl.para > 0 and t < 60 * 45:
		await get_tree().physics_frame
		t += 1
		if t == 60 * 9:
			await shot("m01_chute")
	print("MATCH landed after %.1f s: para %d health %.0f at %s" % [t / 60.0, pl.para, pl.health, pl.global_position])
	print("MATCH bots %d (team0 %d) deploy0 %s deploy1 %s" % [m.bots.size(), m.bots.filter(func(b): return b.team == 0).size(), m.deploy[0], m.deploy[1]])
	var far_from_zones := 0.0
	for b in m.bots:
		var dmin := INF
		for zz in m.zones:
			dmin = minf(dmin, b.global_position.distance_to(zz["pos"] as Vector3))
		far_from_zones = maxf(far_from_zones, dmin)
	print("MATCH the bots' farthest distance to a zone: %.0f m" % far_from_zones)
	# mid-match: everyone around the middle zone, the player 70 m back on his side, on the ground
	var za: Vector3 = m.zone_pos(0)
	for b in m.bots:
		var off := (m.side_dir[b.team] as Vector3) * randf_range(25.0, 140.0) + Vector3(randf_range(-60, 60), 0, randf_range(-60, 60))
		var q := m.free_spot(za + off, 12.0)
		if q.x < 1e9:
			b.spawn_at(q, atan2(-(za - q).x, -(za - q).z))
	var pp := m.free_spot(za + (m.side_dir[0] as Vector3) * 70.0, 10.0)
	var to := za - pp
	await _place(pp, atan2(-to.x, -to.z), -0.03)
	pl.tpp = false
	for k in 4:
		for f in 300:
			await get_tree().physics_frame
		var alive := m.bots.filter(func(b): return not b.dead).size()
		var near := m.bots.filter(func(b): return b.near).size()
		var lods := [0, 0, 0, 0]
		for b in m.bots:
			lods[b.body.lod] += 1
		var owners := []
		for zz in m.zones:
			owners.append(int(zz["owner"]))
		print("MATCH t=%.0fs score %s owners %s alive %d near %d lods %s feed %s player %.0f  proc %.1f ms phys %.1f ms" % [m.t, m.score, owners, alive, near, lods,
			m.feed.map(func(f): return f["text"]), pl.health, Performance.get_monitor(Performance.TIME_PROCESS) * 1000.0, Performance.get_monitor(Performance.TIME_PHYSICS_PROCESS) * 1000.0])
		await shot("m%02d_fight" % (k + 2))
	# the same fight from 300 m through the x8 scope (the far soldiers' clips)
	var pf := m.free_spot(za + (m.side_dir[0] as Vector3) * 300.0, 20.0)
	to = za - pf
	await _place(pf + Vector3(0, 0.1, 0), atan2(-to.x, -to.z), -0.02)
	pl.give({"type": "gun", "id": "sniper", "n": 5})
	for i in 3:
		if String((pl.inv["guns"][i] as Dictionary).get("id", "")) == "sniper":
			pl.switch_weapon(i)
	pl.weapon.aim_toggle = true
	for f in 120:
		await get_tree().physics_frame
	await shot("m06_scope_far")
	pl.weapon.aim_toggle = false
	# the player dies: the choice of where to come back
	pl.take_damage(500.0, pl.global_position + Vector3(0, 1.0, 0), null)
	for f in 90:
		await get_tree().physics_frame
	await shot("m07_deploy")
	var held := -1
	for i in m.zones.size():
		if m.can_spawn_at(i, 0):
			held = i
	m.choice = "zone%d" % held if held >= 0 else "air"
	while pl.dead:
		await get_tree().physics_frame
	print("MATCH came back (%s) at %s, para %d, %.0f m from the middle, lives %d" % [m.choice, pl.global_position, pl.para, Vector2(pl.global_position.x - m.mid.x, pl.global_position.z - m.mid.z).length(), pl.lives])
	m.finish()
	await _wait(1.0)
	await shot("m_results")

## where the frame time goes with 99 soldiers fighting around the player (run it headless: no drawing)
func _perf_test(w: World) -> void:
	var pl: Player = main.player
	var m: Match = main.match_
	if w.raid:
		w.raid.enabled = false
	while m.bots.size() < 99:
		await get_tree().process_frame
	var za: Vector3 = m.zone_pos(0)
	for b in m.bots:
		var off := (m.side_dir[b.team] as Vector3) * randf_range(25.0, 140.0) + Vector3(randf_range(-60, 60), 0, randf_range(-60, 60))
		var q := m.free_spot(za + off, 12.0)
		if q.x < 1e9:
			b.spawn_at(q, atan2(-(za - q).x, -(za - q).z))
	var pp := m.free_spot(za + (m.side_dir[0] as Vector3) * 70.0, 10.0)
	await _place(pp, 0.0, 0.0)
	pl.health = 100000.0
	for mode in ["normal", "lod3", "lod2", "lod1", "lod0", "no_ai", "normal"]:
		for b in m.bots:
			b.lod_force = int(String(mode).substr(3)) if String(mode).begins_with("lod") else -1
			b.set_physics_process(mode != "no_ai")
		for f in 30:
			await get_tree().process_frame
		var tp := 0.0
		var tf := 0.0
		var n := 0
		var t0 := Time.get_ticks_usec()
		for f in 90:
			await get_tree().process_frame
			tp += Performance.get_monitor(Performance.TIME_PROCESS)
			tf += Performance.get_monitor(Performance.TIME_PHYSICS_PROCESS)
			n += 1
		var lods := [0, 0, 0, 0]
		for b in m.bots:
			lods[b.body.lod] += 1
		print("PERF %-7s process %.2f ms  physics %.2f ms  frame %.2f ms  lods %s alive %d" % [mode, tp / n * 1000.0, tf / n * 1000.0, (Time.get_ticks_usec() - t0) / 1000.0 / n, lods, m.bots.filter(func(b): return not b.dead).size()])

## the screens of a match: waiting for the next life (where to come back) and the results
func _ui_test(w: World) -> void:
	var pl: Player = main.player
	var m: Match = main.match_
	if w.raid:
		w.raid.enabled = false
	var p0: Vector3 = m.deploy[0][0]
	await _place(m.free_spot(p0, 6.0), 0.0, -0.05)
	pl.tpp = false
	await _wait(1.0)
	await shot("u00_ground")
	pl.take_damage(500.0, pl.global_position + Vector3(0, 1.0, 0), null)
	await _wait(2.0)
	print("UI dead: lives %d left %.1f s choice %s" % [pl.lives, pl.respawn_left(), m.choice])
	await shot("u01_deploy")
	m.finish()
	await _wait(1.0)
	await shot("u02_results")

## playing together, the host's side (the guest runs in another game, see _coop_guest_test): the guest comes in and
## takes a bot's place, we see him and his shots, his hit kills one of our bots, the end goes to him
func _coop_host_test(w: World) -> void:
	var pl: Player = main.player
	var m: Match = main.match_
	var c: Coop = m.coop
	if w.raid:
		w.raid.enabled = false
	print("COOP host room %s joined %s" % [c.room, c.rt.state])
	var t0 := Time.get_ticks_msec()
	while c.rt.peers.is_empty() and Time.get_ticks_msec() - t0 < 240000:
		await get_tree().process_frame
	print("COOP host: peers %s retired %s bots %d" % [c.rt.peers.keys(), c.retired, m.bots.size()])
	var za: Vector3 = m.zone_pos(0)
	var me := m.free_spot(za + (m.side_dir[0] as Vector3) * 70.0, 4.0)
	var at := m.free_spot(za + (m.side_dir[0] as Vector3) * 60.0 + Vector3(3, 0, 0), 4.0)
	var to := at - me
	await _place(me, atan2(-to.x, -to.z), -0.08)
	pl.tpp = false
	# the enemy bots out of the way except three, 50 m in front
	var enemies := 0
	for b in m.bots:
		if b.team == 1 and not b.retired:
			if enemies < 3:
				var q := m.free_spot(za + (m.side_dir[0] as Vector3) * 15.0 + Vector3(enemies * 6.0 - 6.0, 0, 0), 4.0)
				b.spawn_at(q, 0.0)
				b.set_physics_process(false)
			else:
				b.retire()
			enemies += 1
		elif b.team == 0 and not b.retired:
			b.retire()
	t0 = Time.get_ticks_msec()
	while c.remotes.is_empty() and Time.get_ticks_msec() - t0 < 120000:
		await get_tree().process_frame
	for f in 240:
		await get_tree().physics_frame
	for r in c.remotes.values():
		var rs := r as RemoteSoldier
		print("COOP host sees %s (%s) at %s, %.1f m away, gun %s, rate %.1f/s" % [rs.who, rs.id, rs.global_position, rs.global_position.distance_to(pl.global_position), rs.gun, c.p_hz])
		to = rs.global_position - pl.global_position
		pl.yaw = atan2(-to.x, -to.z)
		pl.yaw_node.rotation.y = pl.yaw
	for f in 30:
		await get_tree().physics_frame
	await shot("k01_host_sees_guest")
	# the guest shoots the first enemy bot (his test does it): wait for it to die here
	var e0: Bot = null
	for b in m.bots:
		if b.team == 1 and not b.retired:
			e0 = b
			break
	t0 = Time.get_ticks_msec()
	while e0 and not e0.dead and Time.get_ticks_msec() - t0 < 120000:
		await get_tree().process_frame
	print("COOP host: enemy %s dead %s (feed %s) stats %s" % [e0.bot_name if e0 else "-", e0.dead if e0 else false, m.feed.map(func(f): return f["text"]), m.stats])
	pl.tpp = true
	for f in 60:
		await get_tree().physics_frame
	await shot("k02_host_tpp")
	print("COOP host: realtime sent %d got %d" % [c.rt.sent, c.rt.got])
	m.finish()
	for f in 120:
		await get_tree().physics_frame
	await shot("k03_host_results")

## playing together, the guest's side: in the host's room, his bots and zones here, a hit on his bot, his end
func _coop_guest_test(w: World) -> void:
	var pl: Player = main.player
	var m: Match = main.match_
	var c: Coop = m.coop
	print("COOP guest room %s guest %s" % [c.room, m.guest])
	var t0 := Time.get_ticks_msec()
	while m.bots.is_empty() and Time.get_ticks_msec() - t0 < 240000:
		await get_tree().process_frame
	print("COOP guest: %d puppets after %.1f s, peers %s" % [m.bots.size(), (Time.get_ticks_msec() - t0) / 1000.0, c.rt.peers.keys()])
	var za: Vector3 = m.zone_pos(0)
	var me := m.free_spot(za + (m.side_dir[0] as Vector3) * 60.0 + Vector3(3, 0, 0), 4.0)
	await _place(me, 0.0, 0.0)
	# wait for the host's set-up (three enemies in front of us)
	t0 = Time.get_ticks_msec()
	var target: Bot = null
	while target == null and Time.get_ticks_msec() - t0 < 120000:
		await get_tree().process_frame
		for b in m.bots:
			if b.team == 1 and not b.dead and not b.retired and b.global_position.distance_to(za) < 40.0:
				target = b
				break
	for f in 120:
		await get_tree().physics_frame
	var alive := m.bots.filter(func(b): return not b.dead).size()
	print("COOP guest: alive puppets %d, zones %s, score %s, t %.0f, host seen %s" % [alive, m.zones.map(func(z): return int(z["owner"])), m.score, m.t, c.remotes.keys()])
	if target:
		# aim and fire at it with the rifle
		var to := target.global_position + Vector3(0, 1.3, 0) - pl.cam.global_position
		pl.yaw = atan2(-to.x, -to.z)
		pl.yaw_node.rotation.y = pl.yaw
		pl.pitch = atan2(to.y, Vector2(to.x, to.z).length())
		print("COOP guest: shooting %s at %.0f m" % [target.bot_name, to.length()])
		for k in 3:
			pl.weapon.touch_fire = true
			for f in 30:
				await get_tree().physics_frame
			pl.weapon.touch_fire = false
			for f in 30:
				await get_tree().physics_frame
			if target.dead:
				break
		if not target.dead:
			target.take_damage(500.0, target.global_position + Vector3(0, 1.6, 0), pl)
		t0 = Time.get_ticks_msec()
		while not target.dead and Time.get_ticks_msec() - t0 < 30000:
			await get_tree().process_frame
		print("COOP guest: target dead %s, my stats %s, feed %s" % [target.dead, m.stats, m.feed.map(func(f): return f["text"])])
	t0 = Time.get_ticks_msec()
	while not m.over and Time.get_ticks_msec() - t0 < 240000:
		await get_tree().process_frame
	print("COOP guest: over %s score %s stats %s sent %d got %d" % [m.over, m.score, m.stats, c.rt.sent, c.rt.got])

## signing in and the friends' calls against a local stand-in for the project (-- --supabase http://127.0.0.1:4200 <key>)
func _online_test() -> void:
	var on := get_node("/root/Online")
	print("ONLINE configured %s key %s…" % [on.configured(), String(on.ANON).substr(0, 18)])
	var ok: bool = await on.sign_in_guest()
	print("ONLINE guest sign-in %s status '%s' user %s" % [ok, on.status, on.session.get("user_id", "")])
	await get_tree().create_timer(1.0).timeout
	print("ONLINE status after the profile: '%s'" % on.status)
	var p: Dictionary = await on.find_player("77777777")
	print("ONLINE find_player -> %s" % [p])
	await on.set_room("m123")
	print("ONLINE hosting room %s" % on.hosting_room)
	on.sign_out()

## a raid seen from the open, 350 m from its red zone: the jets coming in with their trails, the bombs, the siren
func _raid_test(w: World) -> void:
	var pl: Player = main.player
	var m: Match = main.match_
	if m:
		for b in m.bots:
			b.retire()
		m._to_spawn.clear()
	var p0 := Vector3(250.0, 0.0, 700.0)
	p0.y = w.height(p0.x, p0.z) + 0.1
	await _place(p0, 0.0, 0.25)
	pl.tpp = false
	var at := p0 + Vector3(0, 0, -380)
	w.raid.start(at)
	print("RAID zone %s radius %.0f siren %s jets %d" % [w.raid.zone, w.raid.radius, w.raid.siren != null, w.raid.jets.size()])
	for k in 6:
		for f in 60 * 5:
			await get_tree().physics_frame
		var j0: Node3D = w.raid.jets[0] if not w.raid.jets.is_empty() else null
		var jd := j0.global_position.distance_to(pl.global_position) if j0 else -1.0
		if j0:
			var to := j0.global_position - pl.cam.global_position
			pl.yaw = atan2(-to.x, -to.z)
			pl.yaw_node.rotation.y = pl.yaw
			pl.pitch = clampf(atan2(to.y, Vector2(to.x, to.z).length()), -0.3, 1.2)
		print("RAID t=%ds phase %s fired %d bombs_left %d jet %.0f m siren %s paused %s" % [(k + 1) * 5, w.raid.phase, w.raid.fired, w.raid.bombs_left, jd, w.raid.siren != null, w.raid.siren.stream_paused if w.raid.siren else false])
		await shot("r%02d" % k)

## into the match by the transport helicopter: riding it, looking round, jumping out
func _flight_test(w: World) -> void:
	var pl: Player = main.player
	var fl: TransportFlight = main.flight
	print("FLIGHT from %s to %s, player in it %s" % [fl.from, fl.to, pl.in_transport])
	for f in 90:
		await get_tree().process_frame
	await shot("f01_transport")
	pl.look_in = Vector2(1.6, 0.25)
	for f in 30:
		await get_tree().process_frame
	await shot("f02_transport_side")
	pl.jump_or_climb()
	for f in 60:
		await get_tree().physics_frame
	print("FLIGHT jumped: in transport %s para %d at %s" % [pl.in_transport, pl.para, pl.global_position])
	await shot("f03_freefall")



## the island: views from above and on the ground (the port, a river bridge, the strait's bridge, the east airport,
## the north lake's carrier, the coast)
func _island_test(w: World) -> void:
	main._start()
	await _wait(1.0)
	if main.flight and not main.flight.done:
		main.flight.jump()
		await _wait(0.3)
	var lay := w.lay
	var views := [["i01_port", Vector3(-2700, 0, -150), -1.9, -0.35, 60.0], ["i02_river", Vector3(-150, 0, 1000), PI, -0.3, 40.0],
		["i03_strait_bridge", Vector3(250, 0, 1700), PI, -0.25, 50.0], ["i04_east_airport", Vector3(1700, 0, -700), PI, -0.2, 40.0],
		["i05_lake_carrier", Vector3(-50, 0, -800), 0.0, -0.18, 30.0], ["i06_coast", Vector3(-3200, 0, 1300), -1.6, -0.15, 30.0],
		["i07_city_from_air", Vector3(0, 0, 1200), PI, -0.55, 500.0]]
	for v in views:
		var p: Vector3 = v[1]
		p.y = maxf(w.height(p.x, p.z), 0.0) + float(v[4])
		_place(p, float(v[2]), float(v[3]))
		main.player.velocity = Vector3.ZERO
		for f in 50:
			main.player.global_position = p
			main.player.velocity = Vector3.ZERO
			await get_tree().process_frame
		print("ISLAND %s at %s ground %.1f water %s" % [v[0], p, w.height(p.x, p.z), w.valley.water_level(p.x, p.z) if w.valley else -1.0])
		await shot(String(v[0]))


## the new HUD: the game screen with the minimap, the full map, the backpack (a sight that fits nothing marked),
## lying down
func _hud_test(w: World) -> void:
	main._start()
	await _wait(1.0)
	if main.flight and not main.flight.done:
		main.flight.jump()
		await _wait(0.3)
	var p := Vector3(-330, 0, 420)
	p.y = w.height(p.x, p.z) + 0.2
	_place(p, 0.6, -0.05)
	main.player.touch_sprint = false
	await _wait(2.0)
	main.touch.visible = true
	main.touch._layout()
	await shot("h01_game")
	main.hud.minimap.marker = Vector2(400, -300)
	main._open_map()
	await _wait(0.6)
	await shot("h02_full_map")
	main.hud.full_map.zoom = 3.0
	main.hud.full_map.center = Vector2(0, 0)
	await _wait(0.4)
	await shot("h03_full_map_zoom")
	main.hud.full_map.close()
	await _wait(0.3)
	# the backpack: an x4 on the rifle, a red dot and an x8 spare, the rifle thrown away so only the pistol is left
	var pl: Player = main.player
	pl.give({"type": "sight", "id": "x4"})
	pl.give({"type": "sight", "id": "reddot"})
	pl.give({"type": "sight", "id": "x8"})
	pl.give({"type": "med", "id": "medkit", "n": 1})
	pl.give({"type": "ammo", "id": "556", "n": 60})
	if pl._loot():
		pl._loot().drop_item({"type": "gun", "id": "ak", "n": 30}, pl.global_position + Vector3(0.8, 0, 0.4))
		pl._loot().drop_item({"type": "sight", "id": "holo"}, pl.global_position + Vector3(-0.6, 0, 0.6))
	main._open_bag()
	await _wait(0.5)
	await shot("h04_backpack")
	pl.drop_gun(0)
	main.hud.backpack._build()
	await _wait(0.4)
	await shot("h05_backpack_pistol_only")
	main.hud.backpack.close()
	await _wait(0.3)
	Settings.set_v("view_mode", 1)
	pl.toggle_prone()
	await _wait(2.0)
	await shot("h06_prone")
	print("HUD prone ", pl.proning, " capsule ", pl.capsule.height, " bag ", pl.inv["bag"])


## both sides' machines: the tanks on the move, an air strike met by the enemy's air defence
func _war_test(w: World) -> void:
	main._start()
	await _wait(1.0)
	if main.flight and not main.flight.done:
		main.flight.jump()
		await _wait(0.3)
	var pl: Player = main.player
	var cam := Camera3D.new()
	cam.far = 6000.0
	w.add_child(cam)
	var war := w.war
	print("WAR crews ", war.crews.size() if war else -1, " sites ", w.air_defence.sites.size() if w.air_defence else -1)
	var t0: Array = []
	for c in war.crews:
		t0.append((c["tank"] as Node3D).global_position)
	Engine.time_scale = 3.0
	await _wait(20.0)
	Engine.time_scale = 1.0
	for i in war.crews.size():
		var tk: Node3D = war.crews[i]["tank"]
		print("WAR tank %d team %d moved %.1f m to %s far %s" % [i, int(war.crews[i]["team"]), tk.global_position.distance_to(t0[i]) if i < t0.size() else -1.0, tk.global_position, (tk as Vehicle).ai_far])
	# look at the first tank from behind and above (the player stands by it so its physics is on)
	var tk0: Node3D = war.crews[0]["tank"]
	_place(tk0.global_position + tk0.global_transform.basis.z * -30.0 + Vector3(8, 0, 0), 0.0, 0.0)
	await _wait(1.5)
	cam.current = true
	cam.global_position = tk0.global_position - tk0.global_transform.basis.z * 18.0 + Vector3(4, 7, 0)
	cam.look_at(tk0.global_position + Vector3(0, 1.5, 0), Vector3.UP)
	await _wait(0.5)
	await shot("w01_tank")
	# an air strike by team 1 on the city: wait for the base's missiles
	war._sortie(1)
	var launched := false
	for k in 160:
		await get_tree().create_timer(0.25).timeout
		if not w.air_defence.missiles.is_empty():
			launched = true
			break
	print("WAR jets ", war.jets.size(), " missiles ", w.air_defence.missiles.size(), " launched ", launched)
	if launched:
		var m: Dictionary = w.air_defence.missiles[0]
		for k in 8:
			await get_tree().process_frame
		var mp: Vector3 = m["p"]
		var tg: Node3D = m["target"]
		if is_instance_valid(tg):
			cam.global_position = mp + (mp - tg.global_position).normalized() * 60.0 + Vector3(0, 20, 0)
			cam.look_at(tg.global_position, Vector3.UP)
		await shot("w02_missile")
		await _wait(3.0)
		if is_instance_valid(tg):
			cam.global_position = tg.global_position + Vector3(0, 60, 220)
			cam.look_at(tg.global_position, Vector3.UP)
		await shot("w03_after")
	print("WAR flares ", w.air_defence.flares.size(), " jets left ", war.jets.size(), " missiles ", w.air_defence.missiles.size())
	cam.current = false
	pl.cam.current = true
