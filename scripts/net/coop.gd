class_name Coop
extends Node
## Playing a match with friends over the owner's Supabase Realtime. The player who starts the match hosts it: his game
## runs the bots, the zones and the score and sends them three times a second; every player sends where he is and what
## he does, as often as the room's message budget allows (Supabase counts every message sent and delivered: about 70 a
## second for the whole room here, the free plan's limit is 100 for the whole project). A hit is decided by the shooter
## and applied where the target lives: the host for bots, each player for himself. Friends join the host's team, each
## one taking a bot's place; the bot comes back when he leaves.
##
## Messages: "p" a player's state, "w" the host's world (bots packed 12 bytes each, zones, score, clock), "hit",
## "kill" (for the feed and the killer's score), "hack" (a guest took a zone's computer), "end" (the host's result).

const GUNS := ["ak", "carbine", "smg", "sniper", "shotgun", "pistol"]
const BUDGET := 70.0
const W_HZ := 3.0
const BOT_BYTES := 12

var rt: Realtime
var match_: Match
var player: Player
var host := false
var room := ""
var my_id := ""
var my_name := ""
var remotes := {}                   # player id -> RemoteSoldier
var retired := {}                   # (host) player id -> index of the bot he replaced
var p_hz := 6.0
var host_quiet := 0.0               # (guest) seconds since the host was last heard
var _p_t := 0.0
var _w_t := 0.0
var _shots_seen := 0
var _status := ""

func start(m: Match, p: Player, room_name: String, as_host: bool) -> void:
	match_ = m
	player = p
	room = room_name
	host = as_host
	var prof := Profile.load_profile()
	my_id = String(prof.get("id", str(randi())))
	my_name = String(prof.get("name", "جندي"))
	var args := OS.get_cmdline_user_args()
	var pi := args.find("--pid")
	if pi >= 0 and pi + 1 < args.size():
		my_id = args[pi + 1]               # developer checks: two games on one machine
		my_name = "لاعب " + my_id
	rt = Realtime.new()
	rt.name = "Realtime"
	add_child(rt)
	rt.message.connect(_on_message)
	rt.peers_changed.connect(_on_peers)
	rt.joined.connect(func(): match_.note.emit("الغرفة مفتوحة — يمكن لأصدقائك الانضمام" if host else "انضممت إلى مباراة صديقك"))
	rt.left.connect(func(r: String): match_.note.emit("انقطع الاتصال بالغرفة (%s) — إعادة المحاولة…" % r))
	rt.open(Online.realtime_base(), Online.ANON, room, my_id, {"name": my_name, "host": host, "team": player.team}, Online.token())
	_shots_seen = player.weapon.shots_fired

func stop() -> void:
	if rt:
		rt.close()

func players() -> int:
	return 1 + rt.peers.size() if rt else 1

func _process(delta: float) -> void:
	if rt == null or not rt.is_joined():
		return
	if not host:
		host_quiet += delta
		if host_quiet > 20.0 and not match_.over:
			match_.note.emit("غادر المضيف — انتهت المباراة")
			match_.finish()
	if rt.peers.is_empty():
		return                          # alone in the room: nothing to tell anyone (Supabase counts every message)
	var n := players()
	p_hz = clampf((BUDGET - W_HZ * n) / float(n * n), 2.0, 8.0)
	_p_t -= delta
	if _p_t <= 0.0:
		_p_t = 1.0 / p_hz
		_send_state()
	if host:
		_w_t -= delta
		if _w_t <= 0.0 and not match_.over:
			_w_t = 1.0 / W_HZ
			_send_world()

# ------------------------------------------------------------------ sending
func _send_state() -> void:
	var p := player.global_position
	var shots := player.weapon.shots_fired - _shots_seen
	_shots_seen = player.weapon.shots_fired
	rt.send("p", {"i": my_id, "n": my_name, "t": player.team, "x": [snappedf(p.x, 0.01), snappedf(p.y, 0.01), snappedf(p.z, 0.01)],
		"y": snappedf(player.yaw, 0.01), "a": snappedf(player.pitch, 0.01), "c": 1 if player.crouching else 0, "g": player.weapon.gun,
		"s": shots, "d": player.dead, "h": int(player.health), "e": 1 if player.vehicle else 0, "r": snappedf(p_hz, 0.1)})

func _send_world() -> void:
	var bots := match_.bots
	var buf := PackedByteArray()
	buf.resize(bots.size() * BOT_BYTES)
	for i in bots.size():
		var b := bots[i]
		var o := i * BOT_BYTES
		var gp := b.global_position
		buf.encode_s16(o, clampi(roundi(gp.x * 4.0), -32767, 32767))
		buf.encode_s16(o + 2, clampi(roundi(gp.z * 4.0), -32767, 32767))
		buf.encode_s16(o + 4, clampi(roundi(gp.y * 10.0), -32767, 32767))
		buf.encode_u8(o + 6, int(fposmod(b.yaw, TAU) / TAU * 255.0) & 255)
		var fl := (1 if b.dead else 0) | (2 if b.crouch else 0) | (4 if b.target != null else 0) | (8 if b.retired else 0) | (16 if b.team == 1 else 0)
		buf.encode_u8(o + 7, fl)
		buf.encode_u8(o + 8, maxi(GUNS.find(b.gun), 0))
		buf.encode_u8(o + 9, mini(b.shots_out, 255))
		b.shots_out = 0
		buf.encode_s8(o + 10, clampi(roundi(b.body.aim_pitch * 100.0), -127, 127))
		buf.encode_u8(o + 11, clampi(roundi(Vector2(b.velocity.x, b.velocity.z).length() * 20.0), 0, 255))
	var z := []
	for zz in match_.zones:
		z.append([int(zz["owner"]), snappedf(float(zz["progress"]), 0.01)])
	rt.send("w", {"t": snappedf(match_.t, 0.1), "sc": match_.score, "z": z, "b": Marshalls.raw_to_base64(buf)})

## a hit decided here on someone who lives in another game (a remote player, or a bot when we are a guest)
func send_hit(target: String, dmg: float, head: bool, at: Vector3, attacker: Node) -> void:
	rt.send("hit", {"to": target, "d": snappedf(dmg, 0.1), "hd": head, "at": [snappedf(at.x, 0.01), snappedf(at.y, 0.01), snappedf(at.z, 0.01)], "by": id_of(attacker)})

## a death decided here (our own, or a bot's on the host): the others' feeds and the killer's score
func send_kill(victim: Node, attacker: Node, head: bool) -> void:
	if rt == null or not rt.is_joined():
		return
	rt.send("kill", {"v": id_of(victim), "vn": match_._name_for_others(victim), "by": id_of(attacker), "kn": match_._name_for_others(attacker), "hd": head})

func send_hack(zone: int) -> void:
	if rt and rt.is_joined():
		rt.send("hack", {"z": zone, "t": player.team})

func send_end() -> void:
	if rt and rt.is_joined():
		rt.send("end", {"sc": match_.score})

func id_of(n: Node) -> String:
	if n == null:
		return ""
	if n == player:
		return my_id
	if n is RemoteSoldier:
		return (n as RemoteSoldier).id
	if n is Bot:
		return "b%d" % match_.bots.find(n as Bot)
	return ""

func node_of(i: String) -> Node:
	if i == "":
		return null
	if i == my_id:
		return player
	if i.begins_with("b"):
		var k := int(i.substr(1))
		return match_.bots[k] if k >= 0 and k < match_.bots.size() else null
	return remotes.get(i, null)

# ------------------------------------------------------------------ receiving
func _on_message(ev: String, d: Dictionary) -> void:
	match ev:
		"p":
			_remote_state(d)
		"w":
			if not host:
				host_quiet = 0.0
				_world(d)
		"hit":
			_hit(d)
		"kill":
			var by := String(d.get("by", ""))
			match_.feed_line("%s ⟵ %s%s" % [_shown(String(d.get("v", "")), String(d.get("vn", "؟"))), _shown(by, String(d.get("kn", "؟"))), "  (رأس)" if bool(d.get("hd", false)) else ""])
			if by == my_id:
				match_.stats["kills"] = int(match_.stats["kills"]) + 1
				if bool(d.get("hd", false)):
					match_.stats["headshots"] = int(match_.stats["headshots"]) + 1
		"hack":
			if host:
				var zi := int(d.get("z", -1))
				if zi >= 0 and zi < match_.zones.size():
					match_._take(zi, int(d.get("t", 0)), false)
		"end":
			if not host and not match_.over:
				var sc = d.get("sc", [0, 0])
				if sc is Array and (sc as Array).size() == 2:
					match_.score = [int(sc[0]), int(sc[1])]
				match_.finish()

func _shown(i: String, nm: String) -> String:
	return "أنت" if i == my_id else nm

func _remote_state(d: Dictionary) -> void:
	var i := String(d.get("i", ""))
	if i == "" or i == my_id:
		return
	var r: RemoteSoldier = remotes.get(i, null)
	if r == null:
		r = RemoteSoldier.new()
		r.name = "Remote_" + i
		r.setup(self, i, int(d.get("t", 0)), String(d.get("n", "لاعب")))
		match_.add_child(r)
		remotes[i] = r
		match_.note.emit("%s دخل المباراة" % r.who)
	r.push_state(d)

func _world(d: Dictionary) -> void:
	match_.t = float(d.get("t", match_.t))
	var sc = d.get("sc", null)
	if sc is Array and (sc as Array).size() == 2:
		match_.score = [int(sc[0]), int(sc[1])]
	var z = d.get("z", [])
	if z is Array:
		for k in mini((z as Array).size(), match_.zones.size()):
			var zz: Array = z[k]
			var was := int(match_.zones[k]["owner"])
			match_.zones[k]["owner"] = int(zz[0])
			match_.zones[k]["progress"] = float(zz[1])
			if was != int(zz[0]) and int(zz[0]) >= 0:
				match_.on_zone_taken(k, int(zz[0]))
	var raw := Marshalls.base64_to_raw(String(d.get("b", "")))
	var n := raw.size() / BOT_BYTES
	while match_.bots.size() < n:
		match_.add_puppet()
	var now := Time.get_ticks_msec() * 0.001
	for i in n:
		var o := i * BOT_BYTES
		var fl := raw.decode_u8(o + 7)
		var b := match_.bots[i]
		b.puppet_state(Vector3(raw.decode_s16(o) / 4.0, raw.decode_s16(o + 4) / 10.0, raw.decode_s16(o + 2) / 4.0),
			raw.decode_u8(o + 6) / 255.0 * TAU, fl, GUNS[mini(raw.decode_u8(o + 8), GUNS.size() - 1)], raw.decode_u8(o + 9),
			raw.decode_s8(o + 10) / 100.0, raw.decode_u8(o + 11) / 20.0, now, 1.0 / W_HZ)

func _hit(d: Dictionary) -> void:
	var to := String(d.get("to", ""))
	var dmg := float(d.get("d", 0.0))
	var head := bool(d.get("hd", false))
	var by := node_of(String(d.get("by", "")))
	var a = d.get("at", [0, 0, 0])
	var at := Vector3(float(a[0]), float(a[1]), float(a[2])) if a is Array and (a as Array).size() == 3 else Vector3.ZERO
	if to == my_id:
		if not player.dead:
			# where the shooter saw the hit (head or body), on us as we are here
			player.take_damage(dmg, player.global_position + Vector3(0, 1.6 if head else 1.1, 0), by)
	elif host and to.begins_with("b"):
		var k := int(to.substr(1))
		if k >= 0 and k < match_.bots.size():
			var b := match_.bots[k]
			b.take_damage(dmg, b.global_position + Vector3(0, (1.05 if b.crouch else 1.6) if head else (0.75 if b.crouch else 1.2), 0), by)

## (host) friends come in on the host's team, each in place of a bot; the bot comes back when he goes
func _on_peers() -> void:
	if host:
		for pid in rt.peers:
			if not retired.has(pid):
				var k := match_.retire_bot(player.team)
				if k >= 0:
					retired[pid] = k
		for pid in retired.keys():
			if not rt.peers.has(pid):
				match_.unretire_bot(int(retired[pid]))
				retired.erase(pid)
	for pid in remotes.keys():
		if not rt.peers.has(pid):
			var r: RemoteSoldier = remotes[pid]
			match_.note.emit("%s غادر المباراة" % r.who)
			r.queue_free()
			remotes.erase(pid)
	if not host:
		var any_host := false
		for pid in rt.peers:
			if bool((rt.peers[pid] as Dictionary).get("host", false)):
				any_host = true
		if any_host:
			host_quiet = 0.0
