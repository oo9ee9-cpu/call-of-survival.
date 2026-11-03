class_name Realtime
extends Node
## Supabase Realtime: Phoenix channels over one WebSocket (protocol 1.0.0, JSON objects). One channel ("room") at a
## time, with broadcast (everyone else in the room gets what we send, we do not get our own) and presence (who is in
## the room and what each one said about himself when he came in). Heartbeat every 25 s, rejoins by itself when the
## connection drops while the room is wanted.
## Supabase counts every message sent and every message delivered (free plan: 100 a second for the whole project), so
## the game keeps its own rates low (see Coop).

signal joined
signal left(reason: String)
signal message(event: String, data: Dictionary)
signal peers_changed

var ws: WebSocketPeer
var url := ""
var topic := ""
var my_key := ""
var meta := {}
var token := ""
var state := "off"                  # off, connecting, joining, joined
var peers := {}                     # presence key -> its meta (without us)
var want := false                   # keep the room open (rejoin after a drop)
var sent := 0                       # messages sent (for the rate check)
var got := 0
var _ref := 0
var _join_ref := ""
var _hb := 0.0
var _retry := -1.0
var _tries := 0

## base_url: the project's https address (or ws:// of a local test server); key: the anon key
func open(base_url: String, key: String, room: String, my_id: String, my_meta: Dictionary, access_token := "") -> void:
	close()
	var u := base_url.strip_edges().trim_suffix("/")
	if u.begins_with("https://"):
		u = "wss://" + u.substr(8)
	elif u.begins_with("http://"):
		u = "ws://" + u.substr(7)
	url = u + "/realtime/v1/websocket?apikey=" + key.uri_encode() + "&vsn=1.0.0"
	topic = "realtime:" + room
	my_key = my_id
	meta = my_meta
	token = access_token
	want = true
	_tries = 0
	_connect()

func close() -> void:
	want = false
	if ws and state == "joined":
		_push(topic, "phx_leave", {})
	if ws:
		ws.close()
	ws = null
	state = "off"
	peers.clear()

func _exit_tree() -> void:
	close()

func is_joined() -> bool:
	return state == "joined"

func _connect() -> void:
	ws = WebSocketPeer.new()
	ws.inbound_buffer_size = 1 << 20
	ws.outbound_buffer_size = 1 << 20
	ws.max_queued_packets = 8192
	var err := ws.connect_to_url(url)
	if err != OK:
		ws = null
		state = "off"
		_retry = 3.0
		return
	state = "connecting"
	_hb = 25.0

func _process(delta: float) -> void:
	if ws == null:
		if want and _retry >= 0.0:
			_retry -= delta
			if _retry < 0.0:
				_tries += 1
				_connect()
		return
	ws.poll()
	var st := ws.get_ready_state()
	if st == WebSocketPeer.STATE_OPEN:
		if state == "connecting":
			state = "joining"
			_join()
		while ws and ws.get_available_packet_count() > 0:
			_on_packet(ws.get_packet().get_string_from_utf8())
		_hb -= delta
		if _hb <= 0.0 and ws:
			_hb = 25.0
			_push("phoenix", "heartbeat", {})
	elif st == WebSocketPeer.STATE_CLOSED:
		var reason := "%d %s" % [ws.get_close_code(), ws.get_close_reason()]
		var was := state
		ws = null
		state = "off"
		peers.clear()
		peers_changed.emit()
		if was == "joined" or was == "joining":
			left.emit(reason)
		if want:
			_retry = minf(2.0 + _tries * 2.0, 15.0)

func _join() -> void:
	_ref += 1
	_join_ref = str(_ref)
	var payload := {"config": {"broadcast": {"self": false, "ack": false}, "presence": {"key": my_key}, "private": false}}
	if token != "":
		payload["access_token"] = token
	_send({"topic": topic, "event": "phx_join", "payload": payload, "ref": _join_ref, "join_ref": _join_ref})

func _push(t: String, event: String, payload: Dictionary) -> void:
	_ref += 1
	var m := {"topic": t, "event": event, "payload": payload, "ref": str(_ref)}
	if t == topic:
		m["join_ref"] = _join_ref
	_send(m)

func _send(m: Dictionary) -> void:
	if ws and ws.get_ready_state() == WebSocketPeer.STATE_OPEN:
		ws.send_text(JSON.stringify(m))
		sent += 1

## to everyone else in the room
func send(event: String, data: Dictionary) -> void:
	if state != "joined":
		return
	_push(topic, "broadcast", {"type": "broadcast", "event": event, "payload": data})

func _on_packet(text: String) -> void:
	var j = JSON.parse_string(text)
	if not (j is Dictionary):
		return
	var m: Dictionary = j
	var ev := String(m.get("event", ""))
	var pl = m.get("payload", {})
	if not (pl is Dictionary):
		pl = {}
	var p: Dictionary = pl
	got += 1
	match ev:
		"phx_reply":
			if String(m.get("ref", "")) == _join_ref and state == "joining":
				if String(p.get("status", "")) == "ok":
					state = "joined"
					_tries = 0
					_push(topic, "presence", {"type": "presence", "event": "track", "payload": meta})
					joined.emit()
				else:
					var r = p.get("response", {})
					var why := String((r as Dictionary).get("reason", "rejected")) if r is Dictionary else "rejected"
					want = false
					close()
					left.emit(why)
		"broadcast":
			var data = p.get("payload", {})
			message.emit(String(p.get("event", "")), data if data is Dictionary else {})
		"presence_state":
			peers.clear()
			for k in p:
				_presence_add(String(k), p[k])
			peers_changed.emit()
		"presence_diff":
			var joins = p.get("joins", {})
			var leaves = p.get("leaves", {})
			if leaves is Dictionary:
				for k in leaves:
					peers.erase(String(k))
			if joins is Dictionary:
				for k in joins:
					_presence_add(String(k), joins[k])
			peers_changed.emit()
		"phx_error", "phx_close":
			if String(m.get("topic", "")) == topic and want:
				# the channel went down on the server: join again
				state = "joining"
				_join()

func _presence_add(k: String, v: Variant) -> void:
	if k == my_key or not (v is Dictionary):
		return
	var metas = (v as Dictionary).get("metas", [])
	if metas is Array and not (metas as Array).is_empty() and metas[0] is Dictionary:
		peers[k] = metas[0]
