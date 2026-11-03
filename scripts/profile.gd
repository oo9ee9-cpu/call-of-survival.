class_name Profile
extends RefCounted
## The player's own record, kept on the phone (user://profile.json): a unique ID that friends can search for, the name
## and photo, rating and tier, coins, what was bought in the store and what is worn, match totals. When signed in
## online the same fields are mirrored to the Supabase "profiles" table (Online).

const PATH := "user://profile.json"

static func _new_id() -> String:
	var rng := RandomNumberGenerator.new()
	rng.randomize()
	return "%d%07d" % [rng.randi_range(1, 9), rng.randi_range(0, 9999999)]

static func load_profile() -> Dictionary:
	var d := {}
	if FileAccess.file_exists(PATH):
		var j = JSON.parse_string(FileAccess.get_file_as_string(PATH))
		if j is Dictionary:
			d = j
	var defaults := {"id": _new_id(), "name": "جندي", "photo": "", "rating": 1000, "coins": 300, "matches": 0, "wins": 0,
		"kills": 0, "outfit": "olive", "owned": ["olive", "desert"], "hair": 0, "region": "me", "friends": [], "guest": true,
		"user_id": ""}
	var changed := false
	for k in defaults:
		if not d.has(k):
			d[k] = defaults[k]
			changed = true
	if changed:
		save_profile(d)
	return d

static func save_profile(d: Dictionary) -> void:
	var f := FileAccess.open(PATH, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(d, "\t"))
