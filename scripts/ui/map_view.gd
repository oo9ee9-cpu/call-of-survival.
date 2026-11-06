class_name MapView
extends Control
## The island's map (textures/ui/map_valley.jpg, north up). Two of them live in the HUD:
## the minimap at the top right (700 m across round the player: his arrow and where he looks, team mates, the zones with
## their letters, the raid's red circle, the transport's route, his own marker), and the full map over the whole
## screen (the island, towns, the two airports, the port, the carriers, the mountains, the bases, the zones, the route
## and the red circle; drag to move, pinch or the wheel or + / - to zoom, a tap puts a marker, a tap on it takes it
## away, X or the map key closes it).

signal closed
signal open_full

const ZONE_LETTERS := ["أ", "ب", "ج", "د", "ه", "و", "ز", "ح", "ط"]
const OURS := Color(0.35, 0.65, 1.0)
const THEIRS := Color(1.0, 0.36, 0.3)

var world: World
var player: Player
var match_: Match
var full := false
var tex: Texture2D
var half := 4096.0
var tsize := 2048.0
var span := 720.0                 # minimap: metres across
var zoom := 1.0                   # full map: 1 = the whole island fits
var center := Vector2.ZERO        # full map: the world (x, z) in the middle of the screen
var marker := Vector2.INF         # the player's own pin (world x, z), shared by both maps
var route_from := Vector3.ZERO    # the transport's route while it flies
var route_to := Vector3.ZERO
var route_on := false
var _touch := {}                  # index -> position
var _press_at := Vector2.ZERO
var _moved := 0.0
var _pinch := 0.0
var _close_rect := Rect2()
var _zoom_rects: Array[Rect2] = []
var _anchor_pts := PackedVector2Array()
var _icons := {}                  # loaded in setup: a texture first loaded inside _draw comes out as a blank square

func setup(w: World, p: Player, as_full: bool) -> void:
	world = w
	player = p
	full = as_full
	tex = UiTheme.picture("res://textures/ui/map_valley.jpg")
	if tex:
		tsize = float(tex.get_width())
	half = float(w.lay.get("half", 4096.0)) if w.lay else 4096.0
	mouse_filter = Control.MOUSE_FILTER_STOP
	clip_contents = not full
	for nm in ["plane"]:
		var t: Texture2D = Lobby.icon(nm)
		if t:
			_icons[nm] = t

## world (x, z) -> this control's pixels
func _to_screen(x: float, z: float) -> Vector2:
	if full:
		return size * 0.5 + (Vector2(x, z) - center) * _k()
	var c := Vector2(player.global_position.x, player.global_position.z)
	return size * 0.5 + (Vector2(x, z) - c) * (size.x / span)

func _to_world(s: Vector2) -> Vector2:
	return center + (s - size * 0.5) / _k()

## full map: pixels a metre
func _k() -> float:
	return minf(size.x, size.y) * 0.94 / (2.0 * half) * zoom

func _process(_d: float) -> void:
	if visible:
		queue_redraw()

# ------------------------------------------------------------------ drawing
func _draw() -> void:
	if world == null or player == null:
		return
	var font := UiTheme.font_bold
	if full:
		draw_rect(Rect2(Vector2.ZERO, size), Color(0.03, 0.06, 0.1, 0.94))
	# the picture
	if tex:
		if full:
			var tl := _to_screen(-half, -half)
			var br := _to_screen(half, half)
			draw_texture_rect(tex, Rect2(tl, br - tl), false)
		else:
			var pp := Vector2(player.global_position.x, player.global_position.z)
			var reg := span / (2.0 * half) * tsize
			var c := (pp + Vector2(half, half)) / (2.0 * half) * tsize
			draw_texture_rect_region(tex, Rect2(Vector2.ZERO, size), Rect2(c - Vector2(reg, reg) * 0.5, Vector2(reg, reg)))
	var lay := world.lay
	var k := _k() if full else size.x / span
	# names on the full map: mountains, towns, the airports, the port
	if full and lay:
		for m in lay.get("mountains", []):
			var s := _to_screen(float(m["x"]), float(m["z"]))
			draw_colored_polygon(PackedVector2Array([s + Vector2(0, -9), s + Vector2(8, 5), s + Vector2(-8, 5)]), Color(0.85, 0.82, 0.76, 0.9))
			_label(s + Vector2(0, 20), String(m["name"]), 13, Color(0.95, 0.92, 0.85))
		for t in lay.get("towns", []):
			var s := _to_screen(float(t["x"]), float(t["z"]))
			_label(s, String(t["name"]), 17 if float(t["r"]) > 300.0 else 14, Color(1, 1, 1))
		for ap in lay.get("airports", []):
			var s := _to_screen(float(ap["x"]), float(ap["z"]) - 200.0)
			_icon("plane", s + Vector2(0, -22), 30.0, Color(1, 1, 1))
			_label(s + Vector2(0, 6), String(ap.get("name", "مطار")), 15, Color(1, 0.95, 0.75))
		var pt: Dictionary = lay.get("port", {})
		if not pt.is_empty():
			var s := _to_screen(float(pt["x"]), float(pt["z"]) - 250.0)
			_anchor(s + Vector2(0, -20), 13.0, Color(1, 1, 1))
			_label(s + Vector2(0, 8), "الميناء", 15, Color(1, 0.95, 0.75))
		for b in lay.get("bases", []):
			var s := _to_screen(float(b["x"]), float(b["z"]))
			var col := OURS if int(b["team"]) == player.team else THEIRS
			draw_rect(Rect2(s - Vector2(9, 9), Vector2(18, 18)), Color(col.r, col.g, col.b, 0.85))
			draw_rect(Rect2(s - Vector2(9, 9), Vector2(18, 18)), Color(1, 1, 1), false, 2.0)
			_label(s + Vector2(0, 24), "قاعدتنا" if int(b["team"]) == player.team else "قاعدة العدو", 13, col.lightened(0.3))
	# carriers (both maps)
	if world.valley and world.valley.models:
		for c in world.valley.models.carriers:
			var xf: Transform3D = c["xf"]
			var s := _to_screen(xf.origin.x, xf.origin.z)
			var fwd := Vector2(xf.basis.z.x, xf.basis.z.z).normalized()
			var side := Vector2(-fwd.y, fwd.x)
			var L := clampf(170.0 * k, 6.0, 40.0)
			var W := L * 0.22
			draw_colored_polygon(PackedVector2Array([s + fwd * L, s + side * W - fwd * L * 0.8, s - side * W - fwd * L * 0.8]), Color(0.75, 0.78, 0.82, 0.95))
			if full:
				_label(s + Vector2(0, L * 0.5 + 16), "حاملة طائرات", 12, Color(0.85, 0.9, 1.0))
	# the raid's red circle
	if world.raid and world.raid.active():
		var s := _to_screen(world.raid.zone.x, world.raid.zone.z)
		var r := world.raid.radius * k
		draw_circle(s, r, Color(0.95, 0.1, 0.08, 0.32))
		draw_arc(s, r, 0, TAU, 48, Color(1, 0.2, 0.15, 0.95), 2.0, true)
		if full:
			_label(s + Vector2(0, -r - 10), "منطقة قصف", 15, Color(1, 0.6, 0.55))
	# the transport's route and where it is now
	if route_on:
		var a := _to_screen(route_from.x, route_from.z)
		var b := _to_screen(route_to.x, route_to.z)
		_dashed(a, b, Color(1, 1, 1, 0.85))
		var fl: Node3D = player.transport as Node3D
		if fl and fl is TransportFlight and (fl as TransportFlight).heli:
			var hp := (fl as TransportFlight).heli.global_position
			_icon("plane", _to_screen(hp.x, hp.z), 24.0 if full else 18.0, Color(1, 0.9, 0.4))
	# zones with their letters, coloured by who holds them
	if match_:
		for i in match_.zones.size():
			var z: Dictionary = match_.zones[i]
			var p: Vector3 = z["pos"]
			var s := _to_screen(p.x, p.z)
			var o := int(z["owner"])
			var col := OURS if o == player.team else (THEIRS if o >= 0 else Color(0.95, 0.95, 0.95))
			var rr := 11.0 if not full else maxf(11.0, 60.0 * k)
			draw_circle(s, rr, Color(0, 0, 0, 0.55))
			draw_arc(s, rr, 0, TAU, 32, col, 2.5, true)
			var letter: String = ZONE_LETTERS[i % ZONE_LETTERS.size()]
			_label(s + Vector2(0, 6), letter, 14 if not full else 16, Color(1, 1, 1), false)
		# team mates
		for b in match_.bots:
			if b.dead or b.team != player.team or b.retired:
				continue
			var s := _to_screen(b.global_position.x, b.global_position.z)
			draw_circle(s, 3.5 if not full else 4.0, OURS)
		if match_.coop:
			for r in match_.coop.remotes.values():
				var rs := r as RemoteSoldier
				if rs.dead or rs.team != player.team:
					continue
				var s := _to_screen(rs.global_position.x, rs.global_position.z)
				draw_circle(s, 5.0, Color(0.3, 0.95, 0.55))
	# the player's marker
	if marker != Vector2.INF:
		var s := _to_screen(marker.x, marker.y)
		draw_colored_polygon(PackedVector2Array([s, s + Vector2(-7, -14), s + Vector2(7, -14)]), Color(1, 0.85, 0.15))
		draw_circle(s + Vector2(0, -16), 7.0, Color(1, 0.85, 0.15))
		draw_circle(s + Vector2(0, -16), 3.0, Color(0.3, 0.2, 0.0))
	# the player: an arrow, and a fan where he looks
	var me := _to_screen(player.global_position.x, player.global_position.z)
	var yaw := player.yaw
	var fwd := Vector2(-sin(yaw), -cos(yaw))
	var rgt := Vector2(-fwd.y, fwd.x)
	var fan := PackedVector2Array([me])
	for a in 9:
		var ang := -0.55 + a * 0.1375
		fan.append(me + fwd.rotated(ang) * (60.0 if not full else 70.0))
	draw_colored_polygon(fan, Color(1, 1, 1, 0.16))
	draw_colored_polygon(PackedVector2Array([me + fwd * 10.0, me - fwd * 6.0 + rgt * 6.5, me - fwd * 3.0, me - fwd * 6.0 - rgt * 6.5]), Color(1, 0.95, 0.3))
	if full:
		_full_chrome(font)
	else:
		draw_rect(Rect2(Vector2.ZERO, size), Color(1, 1, 1, 0.55), false, 2.0)
		draw_string(font, Vector2(size.x * 0.5 - 6, 16), "N", HORIZONTAL_ALIGNMENT_CENTER, 12, 14, Color(1, 0.4, 0.3))
		if marker != Vector2.INF:
			var dm := Vector2(player.global_position.x, player.global_position.z).distance_to(marker)
			draw_string(font, Vector2(6, size.y - 6), "%d م" % int(dm), HORIZONTAL_ALIGNMENT_LEFT, 80, 13, Color(1, 0.88, 0.3))

## the full map's frame: title, close, zoom, the scale
func _full_chrome(font: Font) -> void:
	draw_rect(Rect2(0, 0, size.x, 52), Color(0, 0, 0, 0.55))
	draw_string(font, Vector2(24, 36), "الخريطة", HORIZONTAL_ALIGNMENT_LEFT, 200, 26, Color(1, 1, 1))
	draw_string(font, Vector2(150, 34), "اسحب للتحريك — قرّب بإصبعين أو بالعجلة — انقر لوضع علامة", HORIZONTAL_ALIGNMENT_LEFT, 700, 15, Color(1, 1, 1, 0.7))
	_close_rect = Rect2(size.x - 64, 6, 52, 40)
	draw_rect(_close_rect, Color(0.8, 0.15, 0.12, 0.85))
	draw_line(_close_rect.position + Vector2(16, 10), _close_rect.end - Vector2(16, 10), Color(1, 1, 1), 3.0)
	draw_line(Vector2(_close_rect.position.x + 16, _close_rect.end.y - 10), Vector2(_close_rect.end.x - 16, _close_rect.position.y + 10), Color(1, 1, 1), 3.0)
	_zoom_rects = [Rect2(size.x - 64, size.y * 0.5 - 60, 52, 52), Rect2(size.x - 64, size.y * 0.5 + 8, 52, 52)]
	for i in 2:
		var r: Rect2 = _zoom_rects[i]
		draw_rect(r, Color(0, 0, 0, 0.6))
		draw_rect(r, Color(1, 1, 1, 0.6), false, 2.0)
		draw_line(r.get_center() - Vector2(12, 0), r.get_center() + Vector2(12, 0), Color(1, 1, 1), 3.0)
		if i == 0:
			draw_line(r.get_center() - Vector2(0, 12), r.get_center() + Vector2(0, 12), Color(1, 1, 1), 3.0)
	# scale: a round number of metres about 120 px long
	var k := _k()
	var m := 120.0 / k
	var nice := 50.0
	for c in [50.0, 100.0, 200.0, 500.0, 1000.0, 2000.0]:
		if c <= m:
			nice = c
	var px := nice * k
	var y := size.y - 24.0
	draw_line(Vector2(24, y), Vector2(24 + px, y), Color(1, 1, 1), 3.0)
	draw_line(Vector2(24, y - 6), Vector2(24, y + 2), Color(1, 1, 1), 2.0)
	draw_line(Vector2(24 + px, y - 6), Vector2(24 + px, y + 2), Color(1, 1, 1), 2.0)
	draw_string(UiTheme.font_bold, Vector2(24, y - 10), ("%d كم" % int(nice / 1000.0)) if nice >= 1000.0 else ("%d م" % int(nice)), HORIZONTAL_ALIGNMENT_LEFT, 120, 14, Color(1, 1, 1))
	# compass rose
	var nc := Vector2(size.x - 40, size.y - 60)
	draw_circle(nc, 20.0, Color(0, 0, 0, 0.5))
	draw_colored_polygon(PackedVector2Array([nc + Vector2(0, -17), nc + Vector2(6, 0), nc + Vector2(-6, 0)]), Color(1, 0.35, 0.3))
	draw_colored_polygon(PackedVector2Array([nc + Vector2(0, 17), nc + Vector2(6, 0), nc + Vector2(-6, 0)]), Color(0.9, 0.9, 0.9))
	draw_string(UiTheme.font_bold, nc + Vector2(-5, -22), "N", HORIZONTAL_ALIGNMENT_CENTER, 12, 13, Color(1, 1, 1))

func _label(at: Vector2, text: String, fs: int, col: Color, shadow := true) -> void:
	var font := UiTheme.font_bold
	var w := font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x
	var p := at - Vector2(w * 0.5, 0)
	if shadow:
		draw_string_outline(font, p, text, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, 4, Color(0, 0, 0, 0.75))
	draw_string(font, p, text, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, col)

func _icon(nm: String, c: Vector2, s: float, col: Color) -> void:
	var t: Texture2D = _icons.get(nm)
	if t:
		draw_texture_rect(t, Rect2(c - Vector2(s, s) * 0.5, Vector2(s, s)), false, col)

## the port's anchor
func _anchor(c: Vector2, r: float, col: Color) -> void:
	draw_arc(c + Vector2(0, r * 0.2), r, 0.25, PI - 0.25, 16, col, 2.5, true)
	draw_line(c + Vector2(0, -r), c + Vector2(0, r * 1.2), col, 2.5)
	draw_line(c + Vector2(-r * 0.5, -r * 0.55), c + Vector2(r * 0.5, -r * 0.55), col, 2.5)
	draw_circle(c + Vector2(0, -r * 1.15), 3.0, col)

func _dashed(a: Vector2, b: Vector2, col: Color) -> void:
	var L := a.distance_to(b)
	if L < 1.0:
		return
	var d := (b - a) / L
	var t := 0.0
	while t < L:
		draw_line(a + d * t, a + d * minf(t + 10.0, L), col, 2.0)
		t += 18.0

# ------------------------------------------------------------------ input
func _gui_input(event: InputEvent) -> void:
	if not full:
		# the minimap: a tap opens the full map
		if (event is InputEventScreenTouch and (event as InputEventScreenTouch).pressed) or (event is InputEventMouseButton and (event as InputEventMouseButton).pressed and (event as InputEventMouseButton).button_index == MOUSE_BUTTON_LEFT):
			open_full.emit()
			accept_event()
		return
	if event is InputEventScreenTouch:
		var e := event as InputEventScreenTouch
		if e.pressed:
			_touch[e.index] = e.position
			if _touch.size() == 1:
				_press_at = e.position
				_moved = 0.0
			elif _touch.size() == 2:
				var ps: Array = _touch.values()
				_pinch = (ps[0] as Vector2).distance_to(ps[1] as Vector2)
		else:
			if _touch.size() == 1 and _moved < 12.0:
				_tap(e.position)
			_touch.erase(e.index)
		accept_event()
	elif event is InputEventScreenDrag:
		var e := event as InputEventScreenDrag
		_touch[e.index] = e.position
		if _touch.size() >= 2:
			var ps: Array = _touch.values()
			var d := (ps[0] as Vector2).distance_to(ps[1] as Vector2)
			if _pinch > 1.0:
				_zoom_by(d / _pinch, ((ps[0] as Vector2) + (ps[1] as Vector2)) * 0.5)
			_pinch = d
			_moved = 999.0
		else:
			_moved += e.relative.length()
			center -= e.relative / _k()
			_clamp()
		accept_event()
	elif event is InputEventMouseButton:
		var e := event as InputEventMouseButton
		if e.button_index == MOUSE_BUTTON_WHEEL_UP and e.pressed:
			_zoom_by(1.2, e.position)
		elif e.button_index == MOUSE_BUTTON_WHEEL_DOWN and e.pressed:
			_zoom_by(1.0 / 1.2, e.position)
		elif e.button_index == MOUSE_BUTTON_LEFT:
			if e.pressed:
				_press_at = e.position
				_moved = 0.0
			elif _moved < 6.0:
				_tap(e.position)
		accept_event()
	elif event is InputEventMouseMotion and ((event as InputEventMouseMotion).button_mask & MOUSE_BUTTON_MASK_LEFT) != 0:
		var e := event as InputEventMouseMotion
		_moved += e.relative.length()
		center -= e.relative / _k()
		_clamp()
		accept_event()

func _zoom_by(f: float, at: Vector2) -> void:
	var before := _to_world(at)
	zoom = clampf(zoom * f, 1.0, 9.0)
	var after := _to_world(at)
	center += before - after
	_clamp()

func _clamp() -> void:
	var lim := half * (1.0 - 1.0 / zoom)
	center = Vector2(clampf(center.x, -lim, lim), clampf(center.y, -lim, lim))

func _tap(p: Vector2) -> void:
	if _close_rect.has_point(p):
		close()
		return
	if _zoom_rects.size() == 2:
		if _zoom_rects[0].has_point(p):
			_zoom_by(1.5, size * 0.5)
			return
		if _zoom_rects[1].has_point(p):
			_zoom_by(1.0 / 1.5, size * 0.5)
			return
	var w := _to_world(p)
	if marker != Vector2.INF and _to_screen(marker.x, marker.y).distance_to(p) < 24.0:
		marker = Vector2.INF
	else:
		marker = w
	Sfx.play("ui_click", -8.0, 0.0, "UI")

func open() -> void:
	center = Vector2(player.global_position.x, player.global_position.z) if zoom > 1.01 else Vector2.ZERO
	_touch.clear()
	visible = true

func close() -> void:
	visible = false
	_touch.clear()
	closed.emit()
