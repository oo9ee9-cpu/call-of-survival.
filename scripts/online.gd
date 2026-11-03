extends Node
## Online account and friends through the owner's Supabase project (REST, no plugin):
## - sign in as a guest (anonymous sign-in) or with Google / Facebook (OAuth with PKCE: the system browser opens, the
##   provider sends it back to a small local server of the game on 127.0.0.1:43123, the code is swapped for a session);
## - the player's profile row (public ID, name, rating, tier, last seen) in table "profiles";
## - search a player by ID, friend requests (table "friend_requests"): send, accept, decline, the friends list.
## The tables and their row-level security are in supabase/schema.sql (run it once in the project's SQL editor).
## Everything here is asynchronous and fails gently: with no network the game plays on as a guest offline.

signal status_changed(text: String)
signal signed_in

# the project's address and its public "anon" key come from data/supabase.json (shipped with the URL) or, once the
# player has pasted the key in the sign-in screen, from user://supabase.json. The anon key is made to be shipped in apps:
# the tables are protected by row-level security (supabase/schema.sql).
var URL := ""
var ANON := ""
const SESSION := "user://session.json"
const PORT := 43123

var session := {}                    # access_token, refresh_token, user_id, provider, expires_at
var status := "غير متصل"
var _server: TCPServer
var _verifier := ""
var _poll_t := 0.0

func _ready() -> void:
	_load_config()
	if FileAccess.file_exists(SESSION):
		var j = JSON.parse_string(FileAccess.get_file_as_string(SESSION))
		if j is Dictionary:
			session = j
	if not session.is_empty():
		_set_status("متصل — " + ("ضيف" if String(session.get("provider", "")) == "anonymous" else String(session.get("provider", ""))))
		refresh_if_needed()

func _load_config() -> void:
	for path in ["res://data/supabase.json", "user://supabase.json"]:
		if FileAccess.file_exists(path):
			var j = JSON.parse_string(FileAccess.get_file_as_string(path))
			if j is Dictionary:
				if String((j as Dictionary).get("url", "")) != "":
					URL = String(j["url"]).trim_suffix("/")
				if String((j as Dictionary).get("anon_key", "")) != "":
					ANON = String(j["anon_key"]).strip_edges()

## the key pasted in the sign-in screen (kept on the phone)
func set_key(key: String, url := "") -> void:
	var d := {"url": url if url != "" else URL, "anon_key": key.strip_edges()}
	var f := FileAccess.open("user://supabase.json", FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(d))
	_load_config()

func configured() -> bool:
	return URL != "" and ANON.length() > 40

func signed() -> bool:
	return not session.is_empty() and String(session.get("access_token", "")) != ""

func _set_status(t: String) -> void:
	status = t
	status_changed.emit(t)

func _save() -> void:
	var f := FileAccess.open(SESSION, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(session))

# ------------------------------------------------------------------ HTTP
## one REST call; resolves to {"ok": bool, "code": int, "data": Variant}
func call_api(method: int, path: String, body: Variant = null, extra_headers: PackedStringArray = []) -> Dictionary:
	if not configured():
		return {"ok": false, "code": 0, "data": "no key"}
	var req := HTTPRequest.new()
	req.timeout = 15.0
	add_child(req)
	var headers := PackedStringArray(["apikey: " + ANON, "Content-Type: application/json"])
	if signed():
		headers.append("Authorization: Bearer " + String(session["access_token"]))
	else:
		headers.append("Authorization: Bearer " + ANON)
	headers.append_array(extra_headers)
	var err := req.request(URL + path, headers, method, JSON.stringify(body) if body != null else "")
	if err != OK:
		req.queue_free()
		return {"ok": false, "code": 0, "data": "request failed (%d)" % err}
	var res: Array = await req.request_completed
	req.queue_free()
	var code := int(res[1])
	var text := (res[3] as PackedByteArray).get_string_from_utf8()
	var data = JSON.parse_string(text) if text != "" else null
	return {"ok": code >= 200 and code < 300, "code": code, "data": data if data != null else text}

# ------------------------------------------------------------------ signing in
func sign_in_guest() -> bool:
	if not configured():
		_set_status("أضف مفتاح Supabase (anon) أولاً")
		return false
	_set_status("جارٍ الدخول كضيف…")
	var r := await call_api(HTTPClient.METHOD_POST, "/auth/v1/signup", {"data": {"guest": true}})
	if not r["ok"]:
		_set_status("تعذر الدخول (%d) — تابع اللعب دون اتصال" % int(r["code"]))
		return false
	_take_session(r["data"], "anonymous")
	return true

func _take_session(d: Variant, provider: String) -> void:
	if not (d is Dictionary):
		return
	var dd: Dictionary = d
	session = {"access_token": dd.get("access_token", ""), "refresh_token": dd.get("refresh_token", ""),
		"user_id": (dd.get("user", {}) as Dictionary).get("id", ""), "provider": provider,
		"expires_at": Time.get_unix_time_from_system() + float(dd.get("expires_in", 3600))}
	_save()
	_set_status("متصل — " + ("ضيف" if provider == "anonymous" else provider))
	signed_in.emit()
	upsert_profile()

func refresh_if_needed() -> void:
	if not signed() or Time.get_unix_time_from_system() < float(session.get("expires_at", 0)) - 120.0:
		return
	var r := await call_api(HTTPClient.METHOD_POST, "/auth/v1/token?grant_type=refresh_token", {"refresh_token": session.get("refresh_token", "")})
	if r["ok"]:
		_take_session(r["data"], String(session.get("provider", "")))
	else:
		_set_status("انتهت الجلسة — سجّل الدخول من جديد")

func sign_out() -> void:
	session = {}
	if FileAccess.file_exists(SESSION):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(SESSION))
	_set_status("غير متصل")

## Google or Facebook: the browser does the signing in, comes back to the game's local server with a code
func sign_in_oauth(provider: String) -> void:
	if not configured():
		_set_status("أضف مفتاح Supabase (anon) أولاً")
		return
	_verifier = _random_string(64)
	var challenge := Marshalls.raw_to_base64(_verifier.sha256_buffer()).replace("+", "-").replace("/", "_").replace("=", "")
	_server = TCPServer.new()
	if _server.listen(PORT, "127.0.0.1") != OK:
		_set_status("تعذر فتح المنفذ المحلي")
		return
	var redirect := "http://127.0.0.1:%d/callback" % PORT
	var link := "%s/auth/v1/authorize?provider=%s&redirect_to=%s&code_challenge=%s&code_challenge_method=s256" % [URL, provider, redirect.uri_encode(), challenge]
	OS.shell_open(link)
	_set_status("أكمل الدخول في المتصفح ثم عد إلى اللعبة…")
	session["provider_pending"] = provider

func _process(delta: float) -> void:
	_poll_t -= delta
	if _server and _server.is_connection_available():
		var peer := _server.take_connection()
		_handle_callback(peer)
	if _poll_t <= 0.0:
		_poll_t = 120.0
		if signed():
			refresh_if_needed()
			touch_presence()

func _handle_callback(peer: StreamPeerTCP) -> void:
	var t0 := Time.get_ticks_msec()
	while peer.get_available_bytes() == 0 and Time.get_ticks_msec() - t0 < 2000:
		peer.poll()
		OS.delay_msec(10)
	var req := peer.get_utf8_string(peer.get_available_bytes())
	var code := ""
	var m := RegEx.create_from_string("[?&]code=([^& ]+)").search(req)
	if m:
		code = m.get_string(1)
	var page := "<html><body style='font-family:sans-serif;text-align:center;padding:40px'><h2>%s</h2><p>يمكنك العودة إلى اللعبة الآن.</p></body></html>" % ("تم تسجيل الدخول" if code != "" else "لم يكتمل تسجيل الدخول")
	peer.put_data(("HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: %d\r\nConnection: close\r\n\r\n" % page.to_utf8_buffer().size()).to_utf8_buffer() + page.to_utf8_buffer())
	peer.disconnect_from_host()
	_server.stop()
	_server = null
	if code == "":
		_set_status("لم يكتمل تسجيل الدخول")
		return
	var r := await call_api(HTTPClient.METHOD_POST, "/auth/v1/token?grant_type=pkce", {"auth_code": code, "code_verifier": _verifier})
	if r["ok"]:
		_take_session(r["data"], String(session.get("provider_pending", "oauth")))
	else:
		_set_status("تعذر إكمال الدخول (%d)" % int(r["code"]))

func _random_string(n: int) -> String:
	var chars := "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"
	var rng := RandomNumberGenerator.new()
	rng.randomize()
	var s := ""
	for i in n:
		s += chars[rng.randi() % chars.length()]
	return s

# ------------------------------------------------------------------ profile, friends
func upsert_profile() -> void:
	if not signed():
		return
	var p := Profile.load_profile()
	p["user_id"] = session.get("user_id", "")
	p["guest"] = String(session.get("provider", "")) == "anonymous"
	Profile.save_profile(p)
	await call_api(HTTPClient.METHOD_POST, "/rest/v1/profiles", {"id": p["user_id"], "public_id": p["id"], "name": p["name"],
		"rating": p["rating"], "tier": Match.tier_of(int(p["rating"])), "last_seen": Time.get_datetime_string_from_system(true) + "Z"},
		PackedStringArray(["Prefer: resolution=merge-duplicates"]))

func touch_presence() -> void:
	if signed():
		await call_api(HTTPClient.METHOD_PATCH, "/rest/v1/profiles?id=eq." + String(session.get("user_id", "")),
			{"last_seen": Time.get_datetime_string_from_system(true) + "Z"})

## a player by the ID shown on his card
func find_player(public_id: String) -> Dictionary:
	var r := await call_api(HTTPClient.METHOD_GET, "/rest/v1/profiles?select=id,public_id,name,rating,tier,last_seen&public_id=eq." + public_id.strip_edges().uri_encode())
	if r["ok"] and r["data"] is Array and not (r["data"] as Array).is_empty():
		return (r["data"] as Array)[0]
	return {}

func send_request(to_user: String) -> bool:
	var r := await call_api(HTTPClient.METHOD_POST, "/rest/v1/friend_requests", {"from_id": session.get("user_id", ""), "to_id": to_user, "status": "pending"})
	return bool(r["ok"])

func requests_in() -> Array:
	var me := String(session.get("user_id", ""))
	var r := await call_api(HTTPClient.METHOD_GET, "/rest/v1/friend_requests?select=id,from_id,status,sender:profiles!friend_requests_from_id_fkey(name,public_id)&status=eq.pending&to_id=eq." + me)
	return r["data"] if r["ok"] and r["data"] is Array else []

func answer_request(id: int, accept: bool) -> bool:
	var r := await call_api(HTTPClient.METHOD_PATCH, "/rest/v1/friend_requests?id=eq.%d" % id, {"status": "accepted" if accept else "declined"})
	return bool(r["ok"])

## accepted friends with their names and when they were last seen
func friends() -> Array:
	var me := String(session.get("user_id", ""))
	var r := await call_api(HTTPClient.METHOD_GET, "/rest/v1/friend_requests?select=from_id,to_id,a:profiles!friend_requests_from_id_fkey(public_id,name,last_seen),b:profiles!friend_requests_to_id_fkey(public_id,name,last_seen)&status=eq.accepted&or=(from_id.eq.%s,to_id.eq.%s)" % [me, me])
	var out := []
	if r["ok"] and r["data"] is Array:
		for row in r["data"]:
			var d: Dictionary = row
			out.append(d["b"] if String(d["from_id"]) == me else d["a"])
	return out
