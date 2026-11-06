class_name Match
extends Node3D
## Domination on the valley: two teams of fifty (the player and 49 bots against 50 bots; a friend who joins takes a
## bot's place), five capture zones in the ruined city, each with its computer. A zone turns when one team has soldiers
## in it and the other none, or at once when someone hacks its computer (stand at the screen and hold interact for
## four seconds). Every zone held scores a point every two seconds; first to 600 wins, or the higher score after
## fifteen minutes. The player comes back three times; after that, or at the end, the results: kills, zones, the
## rating points won or lost, the tier and the coins (kept in user://profile.json).
## With friends (Coop, over Supabase Realtime): the host's game runs all of this; a guest's game only shows the host's
## bots (puppets), zones, score and clock, and sends its hits and its hacks to the host.
## Coming in: each team has deployment points on its own side of the city (in front of the zones nearest its base),
## and comes back there or at a zone it holds while no enemy is close to it. The player picks while he waits: the
## deployment line, one of his zones, the base with the vehicles, or a parachute jump over his side (the match starts
## with that jump).

signal ended(result: Dictionary)
signal note(text: String)

const TEAM_SIZE := 50
const WIN := 600
const TIME := 900.0
const ZONE_R := 18.0
const CAPTURE_TIME := 8.0
const HACK_TIME := 4.0
const NAMES := ["أبو علي", "حيدر", "مصطفى", "ياسر", "سجاد", "علي", "كرار", "منتظر", "عباس", "حسين", "زيد", "مهند", "رامي", "سيف",
	"عمار", "باسم", "قاسم", "جعفر", "نزار", "وسام", "ليث", "فراس", "أنمار", "صادق", "رعد", "طه", "هادي", "مرتضى", "سامر", "أسد"]
const TIERS := [[0, "برونزي"], [1000, "فضي"], [1500, "ذهبي"], [2000, "بلاتيني"], [2500, "ماسي"], [3000, "تاج"], [3500, "آس"], [4200, "أسطوري"]]

var world: World
var player: Player
var bots: Array[Bot] = []
var zones: Array[Dictionary] = []
var score := [0, 0]
var t := 0.0
var _tick := 0.0
var _cap_t := 0.0
var over := false
var feed: Array[Dictionary] = []       # {"text", "t"}
var stats := {"kills": 0, "deaths": 0, "zones": 0, "headshots": 0}
var hacking := -1
var hack_t := 0.0
var _to_spawn: Array = []
var deploy: Array = [[], []]           # per team: deployment points on its side of the city
var side_dir: Array = [Vector3.BACK, Vector3.FORWARD]   # from the middle of the zones towards each team's side
var mid := Vector3.ZERO
var choice := "deploy"                 # where the player comes back: "deploy", "zone<i>", "base", "air"
var guest := false                     # a friend's match: the host's game decides
var coop: Coop

func setup(w: World, p: Player, as_guest := false) -> void:
	world = w
	player = p
	player.team = 0
	guest = as_guest
	var comps: Array = world.valley.models.computers if world.valley and world.valley.models else []
	var caps: Array = world.lay.get("capture", [])
	for i in caps.size():
		var c: Dictionary = caps[i]
		var pos := Vector3(float(c["x"]), float(c["y"]), float(c["z"]))
		var comp: Vector3 = (comps[i] as Dictionary)["pos"] if i < comps.size() else pos
		zones.append({"name": String(c["name"]), "pos": pos, "computer": comp, "owner": -1, "progress": 0.0, "c": [0, 0], "around": [0, 0]})
	_deploy_points()
	if guest:
		return                         # the bots come from the host
	# the teams come in a few at a time (keeps the first frames smooth); smaller teams on slow phones (settings)
	var n: int = [10, 20, 30, 50][clampi(int(Settings.get_v("team_size")), 0, 3)]
	for i in n - 1:
		_to_spawn.append(0)
	for i in n:
		_to_spawn.append(1)
	_to_spawn.shuffle()
	# the machines with their crews: tanks out of the bases, air strikes now and then (the island only)
	if world.lay.get("island", false):
		var war := WarAI.new()
		war.name = "WarAI"
		world.add_child(war)
		world.war = war
		war.setup(world, self)

func _spawn_some() -> void:
	for k in 4:
		if _to_spawn.is_empty():
			return
		var team: int = _to_spawn.pop_back()
		var b := Bot.new()
		b.name = "Bot%d" % bots.size()
		b.setup(world, self, team, bot_name_for(bots.size()))
		add_child(b)
		bots.append(b)
		respawn(b)

static func bot_name_for(i: int) -> String:
	return NAMES[i % NAMES.size()] + ("" if i < NAMES.size() else " %d" % (i / NAMES.size()))

## (guest) one more of the host's bots, moved by his messages
func add_puppet() -> void:
	var b := Bot.new()
	b.name = "Bot%d" % bots.size()
	b.puppet = true
	b.setup(world, self, 1, bot_name_for(bots.size()))
	add_child(b)
	bots.append(b)

## (host) a friend came in: a bot of his team steps out (a dead one if there is one); its index, or -1
func retire_bot(team: int) -> int:
	var best := -1
	for i in bots.size():
		var b := bots[i]
		if b.team != team or b.retired:
			continue
		if best < 0 or (b.dead and not bots[best].dead):
			best = i
	if best >= 0:
		bots[best].retire()
	return best

func unretire_bot(i: int) -> void:
	if i >= 0 and i < bots.size() and bots[i].retired:
		bots[i].retired = false
		respawn(bots[i])

## the deployment points: in front of each zone on the team's side (nearer its base than the enemy's), 150 m back
## towards the base, and one on the edge of the city in the middle of its side
func _deploy_points() -> void:
	mid = Vector3.ZERO
	for z in zones:
		mid += z["pos"]
	mid /= maxf(zones.size(), 1.0)
	mid.y = 0.0
	var base := [Vector3(0, 0, 1000), Vector3(0, 0, -1000)]
	for b in world.lay.get("bases", []):
		base[int(b["team"])] = Vector3(float(b["x"]), 0.0, float(b["z"]))
	for team in 2:
		var d: Vector3 = base[team] - mid
		d.y = 0.0
		side_dir[team] = d.normalized()
		var pts: Array = []
		for z in zones:
			var zp: Vector3 = z["pos"]
			if zp.distance_to(base[team]) < zp.distance_to(base[1 - team]) - 100.0:
				pts.append(zp + side_dir[team] * 150.0)
		pts.append(mid + side_dir[team] * 520.0)
		var ok: Array = []
		for p in pts:
			var q := free_spot(p, 40.0)
			if q.x < 1e9:
				ok.append(q)
		if ok.is_empty():
			ok.append(spawn_base(team))
		deploy[team] = ok
	print("MATCH deploy %s" % [deploy])

## a spot on open ground near p: no walls within two metres, no water (far off when there is none)
func free_spot(p: Vector3, r: float) -> Vector3:
	var v := world.valley
	for k in 24:
		var q := p if k == 0 else p + Vector3(randf_range(-r, r), 0.0, randf_range(-r, r))
		if v == null or v.open_at(q.x, q.z, 2.0):
			q.y = world.height(q.x, q.z) + 0.1
			return q
	return Vector3(1e10, 0, 0)

## a spot at the team's base (its vehicles are there), spread around its spawn points
func spawn_base(team: int) -> Vector3:
	var pts: Array = (world.lay.get("spawns", {}) as Dictionary).get(str(team), [])
	if pts.is_empty():
		return Vector3.ZERO
	var a: Array = pts[randi() % pts.size()]
	var p := Vector3(float(a[0]) + randf_range(-6, 6), 0.0, float(a[2]) + randf_range(-6, 6))
	p.y = world.height(p.x, p.z) + 0.1
	return p

## a zone the team can come back at: its own, with no enemy within 45 m
func can_spawn_at(i: int, team: int) -> bool:
	return i >= 0 and i < zones.size() and int(zones[i]["owner"]) == team and int((zones[i]["around"] as Array)[1 - team]) == 0

## where a soldier of this team comes in: a deployment point, or (twice as likely) a quiet zone it holds
func spawn_point(team: int) -> Vector3:
	var opts: Array = (deploy[team] as Array).duplicate()
	for i in zones.size():
		if can_spawn_at(i, team):
			opts.append(zone_pos(i) + side_dir[team] * 28.0)
			opts.append(zone_pos(i) + side_dir[team] * 28.0)
	var p: Vector3 = opts[randi() % opts.size()]
	var q := free_spot(p, 14.0)
	return q if q.x < 1e9 else p

## the player's way in: [position, facing, from the air]; `how` overrides his choice (the start is a jump)
func player_spawn(how := "") -> Array:
	var team := player.team
	var c := how if how != "" else choice
	var p := Vector3(1e10, 0, 0)
	var air := false
	if c.begins_with("zone"):
		var i := int(c.substr(4))
		if can_spawn_at(i, team):
			p = free_spot(zone_pos(i) + side_dir[team] * 28.0, 12.0)
	elif c == "base":
		p = spawn_base(team)
	elif c == "air":
		# over the team's side of the city, between its deployment line and the middle; the chute does the rest
		var a: Vector3 = mid + side_dir[team] * 300.0 + Vector3(randf_range(-90, 90), 0, randf_range(-90, 90))
		p = Vector3(a.x, world.height(a.x, a.z) + 420.0, a.z)
		air = true
	if p.x > 1e9:
		var best: Vector3 = deploy[team][0]
		for d in deploy[team]:
			if (d as Vector3).distance_to(mid) < best.distance_to(mid):
				best = d
		p = free_spot(best, 12.0)
		if p.x > 1e9:
			p = best
	var to := mid - p
	return [p, atan2(-to.x, -to.z), air]

func respawn(b: Bot) -> void:
	if over:
		return
	var p := spawn_point(b.team)
	var to := mid - p
	b.spawn_at(p, atan2(-to.x, -to.z))

# ------------------------------------------------------------------ zones
func zone_owner(i: int) -> int:
	return int(zones[i]["owner"]) if i >= 0 and i < zones.size() else -1

func zone_pos(i: int) -> Vector3:
	return zones[i]["pos"] if i >= 0 and i < zones.size() else Vector3.ZERO

## the zone a soldier of this team should head for: the nearest one the team does not hold, now and then any
## sandbags round a zone's computer, put up by the side that holds it (a few walls a zone)
var barricades := {}                   # zone -> how many walls
func build_barricade(zi: int, at: Vector3, facing: float) -> bool:
	if zi < 0 or zi >= zones.size() or world.valley == null or world.valley.models == null:
		return false
	if int(barricades.get(zi, 0)) >= 4:
		return false
	barricades[zi] = int(barricades.get(zi, 0)) + 1
	var b := Basis(Vector3.UP, facing)
	for k in 3:
		var p := at + b * Vector3(-1.4 + k * 1.4, 0, 0)
		world.valley.models.place("sandbag", world.valley.models._ground_xf("sandbag", p.x, p.z, facing))
	return true

## where a guard of zone `zi` stands: one of eight places round its computer, facing out
func guard_spot(zi: int, slot: int) -> Vector3:
	var c: Vector3 = zones[zi]["computer"]
	var a := slot * TAU / 8.0
	var p := c + Vector3(cos(a), 0, sin(a)) * (7.0 + (slot % 2) * 3.0)
	p.y = world.height(p.x, p.z)
	return p

func pick_zone(team: int, from: Vector3) -> int:
	var best := -1
	var bd := INF
	for i in zones.size():
		var d := from.distance_to(zones[i]["pos"] as Vector3) * (1.0 if int(zones[i]["owner"]) != team else 2.5) * randf_range(0.7, 1.3)
		if d < bd:
			bd = d
			best = i
	return best

func _process(delta: float) -> void:
	if world == null or over:
		return
	_spawn_some()
	t += delta
	for f in feed:
		f["t"] = float(f["t"]) - delta
	feed = feed.filter(func(f): return float(f["t"]) > 0.0)
	_cap_t -= delta
	if _cap_t <= 0.0:
		_cap_t = 0.5
		_capture(0.5)
	_hack(delta)
	if guest:
		return                         # the score and the end come from the host
	_tick -= delta
	if _tick <= 0.0:
		_tick = 2.0
		for z in zones:
			var o := int(z["owner"])
			if o >= 0:
				score[o] += 1
	if int(score[0]) >= WIN or int(score[1]) >= WIN or t >= TIME:
		finish()

func _capture(dt: float) -> void:
	var soldiers := []
	for b in bots:
		if not b.dead:
			soldiers.append([b.global_position, b.team])
	if player and not player.dead:
		soldiers.append([player.global_position, player.team])
	if coop:
		for r in coop.remotes.values():
			if not (r as RemoteSoldier).dead:
				soldiers.append([(r as RemoteSoldier).global_position, (r as RemoteSoldier).team])
	for i in zones.size():
		var z: Dictionary = zones[i]
		var c := [0, 0]
		var around := [0, 0]
		for s in soldiers:
			var d := ((s[0] as Vector3) - (z["pos"] as Vector3)).length()
			if d < ZONE_R:
				c[int(s[1])] += 1
			if d < 45.0:
				around[int(s[1])] += 1
		z["c"] = c
		z["around"] = around
		if guest:
			continue
		var pr := float(z["progress"])
		if c[0] > 0 and c[1] == 0:
			pr = maxf(pr - dt / CAPTURE_TIME * minf(c[0], 3) * 0.6, -1.0)
		elif c[1] > 0 and c[0] == 0:
			pr = minf(pr + dt / CAPTURE_TIME * minf(c[1], 3) * 0.6, 1.0)
		z["progress"] = pr
		if pr <= -1.0 and int(z["owner"]) != 0:
			_take(i, 0, c[0] > 0 and player and not player.dead and (player.global_position - (z["pos"] as Vector3)).length() < ZONE_R)
		elif pr >= 1.0 and int(z["owner"]) != 1:
			_take(i, 1, false)

func _take(i: int, team: int, by_player: bool) -> void:
	var z: Dictionary = zones[i]
	z["owner"] = team
	z["progress"] = -1.0 if team == 0 else 1.0
	if by_player:
		stats["zones"] = int(stats["zones"]) + 1
	on_zone_taken(i, team)

## the news of a zone that changed hands (here, or in the host's game for a guest)
func on_zone_taken(i: int, team: int) -> void:
	var z: Dictionary = zones[i]
	var who := "فريقك" if team == player.team else "العدو"
	note.emit("%s سيطر على المنطقة «%s»" % [who, z["name"]])
	_feed("المنطقة %s ← %s" % [z["name"], who])
	Sfx.play("rec_beep", -2.0 if team == player.team else -6.0, 0.0, "UI")

## the player at a zone's computer, holding interact: the zone is his team's when the bar fills
func computer_near(p: Vector3) -> int:
	for i in zones.size():
		if (zones[i]["computer"] as Vector3).distance_to(p) < 1.8:
			return i
	return -1

func start_hack(i: int) -> void:
	if i < 0 or int(zones[i]["owner"]) == player.team:
		return
	hacking = i
	hack_t = 0.0
	note.emit("اختراق الحاسوب…")

func _hack(delta: float) -> void:
	if hacking < 0:
		return
	if player.dead or (zones[hacking]["computer"] as Vector3).distance_to(player.global_position + Vector3(0, 1.0, 0)) > 2.2:
		hacking = -1
		note.emit("توقف الاختراق")
		return
	hack_t += delta
	if hack_t >= HACK_TIME:
		var i := hacking
		hacking = -1
		if guest:
			# the host's game owns the zones: tell it, count it here
			stats["zones"] = int(stats["zones"]) + 1
			note.emit("اخترقت حاسوب المنطقة «%s»" % zones[i]["name"])
			if coop:
				coop.send_hack(i)
		else:
			_take(i, player.team, true)

# ------------------------------------------------------------------ kills and the end
func on_kill(attacker: Node, victim: Node, head: bool) -> void:
	var an := _name(attacker)
	var vn := _name(victim)
	_feed("%s ⟵ %s%s" % [vn, an, "  (رأس)" if head else ""])
	if attacker == player:
		stats["kills"] = int(stats["kills"]) + 1
		if head:
			stats["headshots"] = int(stats["headshots"]) + 1
	if coop:
		coop.send_kill(victim, attacker, head)

func on_player_death(attacker: Node) -> void:
	stats["deaths"] = int(stats["deaths"]) + 1
	_feed("%s ⟵ %s" % ["أنت", _name(attacker)])
	if coop:
		coop.send_kill(player, attacker, false)
	if player.lives <= 0 and not guest and (coop == null or coop.players() <= 1):
		get_tree().create_timer(2.5, false).timeout.connect(finish)
	elif player.lives <= 0:
		note.emit("انتهت محاولاتك — تتابع المباراة مع أصدقائك حتى نهايتها")

func _name(n: Node) -> String:
	if n == player:
		return "أنت"
	return _name_for_others(n)

## how the others in the room call this soldier
func _name_for_others(n: Node) -> String:
	if n == null:
		return "؟"
	if n == player:
		return coop.my_name if coop else "لاعب"
	if n is Bot:
		return (n as Bot).bot_name
	if n is RemoteSoldier:
		return (n as RemoteSoldier).who
	return "غارة" if n is AirRaid else "؟"

## a line from the room (a death in another game)
func feed_line(text: String) -> void:
	_feed(text)

func _feed(text: String) -> void:
	feed.push_front({"text": text, "t": 6.0})
	if feed.size() > 5:
		feed.resize(5)

static func tier_of(rating: int) -> String:
	var name := "برونزي"
	for tr in TIERS:
		if rating >= int(tr[0]):
			name = String(tr[1])
	return name

func finish() -> void:
	if over:
		return
	over = true
	if coop and not guest:
		coop.send_end()
	var win: bool = int(score[0]) > int(score[1])
	var draw: bool = int(score[0]) == int(score[1])
	var prof := Profile.load_profile()
	var delta := (25 if win else (3 if draw else -15)) + int(stats["kills"]) * 2 + int(stats["zones"]) * 3 - int(stats["deaths"])
	var coins := 40 + int(stats["kills"]) * 10 + int(stats["zones"]) * 15 + (100 if win else (30 if draw else 0))
	var before := int(prof.get("rating", 1000))
	prof["rating"] = maxi(before + delta, 0)
	prof["coins"] = int(prof.get("coins", 0)) + coins
	prof["matches"] = int(prof.get("matches", 0)) + 1
	prof["wins"] = int(prof.get("wins", 0)) + (1 if win else 0)
	prof["kills"] = int(prof.get("kills", 0)) + int(stats["kills"])
	Profile.save_profile(prof)
	ended.emit({"win": win, "draw": draw, "score": score.duplicate(), "kills": stats["kills"], "deaths": stats["deaths"], "zones": stats["zones"],
		"headshots": stats["headshots"], "rating_before": before, "rating": prof["rating"], "delta": delta, "coins": coins,
		"tier": tier_of(int(prof["rating"])), "time": t})
