class_name Guns
extends RefCounted
## Every firearm and sight of the game: what it is, how it shoots, where its parts are. The AK is the Sketchfab
## model; the others are ours (tools/guns.py, points in data/guns.json). Positions are in the gun's own frame with the
## barrel along -Z (the frame the hands, the muzzle flash and the sights use).

const DATA := {
	"ak": {"title": "AKM", "model": "res://models/ak.glb", "cal": "762", "mag": 30, "rpm": 600.0, "dmg": 43.0, "spread": 1.1,
		"climb": 1.0, "auto": true, "sound": "ak_shot", "pitch": 1.0, "sight_y": 0.105, "rail_z": -0.05, "rail_y": 0.075,
		"slot": 0, "hip": Vector3(0.11, -0.2, -0.42), "reload": 2.25},
	"carbine": {"title": "M5 كاربين", "model": "res://models/w/carbine.glb", "cal": "556", "mag": 30, "rpm": 720.0, "dmg": 36.0,
		"spread": 0.9, "climb": 0.75, "auto": true, "sound": "ak_shot", "pitch": 1.14, "slot": 0, "hip": Vector3(0.1, -0.19, -0.4), "reload": 2.1},
	"smg": {"title": "MP9 رشاش", "model": "res://models/w/smg.glb", "cal": "9mm", "mag": 32, "rpm": 850.0, "dmg": 25.0,
		"spread": 1.4, "climb": 0.55, "auto": true, "sound": "ak_shot", "pitch": 1.32, "slot": 0, "hip": Vector3(0.1, -0.18, -0.36), "reload": 1.8},
	"sniper": {"title": "SR-9 قناص", "model": "res://models/w/sniper.glb", "cal": "338", "mag": 5, "rpm": 45.0, "dmg": 110.0,
		"spread": 3.0, "climb": 3.2, "auto": false, "sound": "ak_shot", "pitch": 0.68, "slot": 0, "hip": Vector3(0.11, -0.2, -0.46), "reload": 3.2,
		"default_sight": "x8"},
	"shotgun": {"title": "P12 بندقية صيد", "model": "res://models/w/shotgun.glb", "cal": "12g", "mag": 6, "rpm": 70.0, "dmg": 20.0,
		"pellets": 9, "spread": 4.5, "climb": 2.6, "auto": false, "sound": "ak_shot", "pitch": 0.6, "slot": 0, "hip": Vector3(0.11, -0.2, -0.44), "reload": 3.0},
	"pistol": {"title": "P9 مسدس", "model": "res://models/w/pistol.glb", "cal": "9mm", "mag": 15, "rpm": 380.0, "dmg": 28.0,
		"spread": 1.3, "climb": 1.1, "auto": false, "sound": "ak_shot", "pitch": 1.45, "slot": 2, "hip": Vector3(0.12, -0.16, -0.3), "reload": 1.5},
}
const SIGHTS := {
	"reddot": {"title": "منظار نقطة حمراء", "zoom": 1.15, "overlay": "dot"},
	"holo": {"title": "منظار هولوغرافي", "zoom": 1.2, "overlay": "holo"},
	"x2": {"title": "منظار ×٢", "zoom": 2.0, "overlay": "scope"},
	"x3": {"title": "منظار ×٣", "zoom": 3.0, "overlay": "scope"},
	"x4": {"title": "منظار ×٤", "zoom": 4.0, "overlay": "acog"},
	"x6": {"title": "منظار ×٦", "zoom": 6.0, "overlay": "scope"},
	"x8": {"title": "منظار ×٨", "zoom": 8.0, "overlay": "mil"},
}
const CALIBERS := {"762": "7.62 مم", "556": "5.56 مم", "9mm": "9 مم", "338": ".338", "12g": "عيار 12"}

static var _pts := {}

## the points of a gun (muzzle, hands, stock, the sight rail, the iron sight height)
static func points(id: String) -> Dictionary:
	if _pts.is_empty():
		var j = JSON.parse_string(FileAccess.get_file_as_string("res://data/guns.json"))
		if j is Dictionary:
			_pts = (j as Dictionary).get("guns", {})
			_pts["_sights"] = (j as Dictionary).get("sights", {})
	if id == "ak":
		return {"muzzle": Vector3(0.0, -0.0061, -0.5479), "grip_r": Vector3(0.012, -0.075, 0.10), "grip_l": Vector3(0.0, -0.035, -0.21),
			"stock": Vector3(0.0, -0.055, 0.34), "rail": Vector3(0.0, 0.075, -0.05), "iron_y": 0.105}
	var p: Dictionary = _pts.get(id, {})
	var out := {}
	for k in ["muzzle", "grip_r", "grip_l", "stock"]:
		var a: Array = p.get(k, [0, 0, 0])
		out[k] = Vector3(float(a[0]), float(a[1]), float(a[2]))
	var r: Array = p.get("rail", [])
	out["rail"] = Vector3(float(r[0]), float(r[1]), float(r[2])) if r.size() == 3 else Vector3.INF
	out["iron_y"] = float(p.get("iron_y", 0.09))
	return out

## how high the line of sight of a sight sits above its rail
static func sight_axis(id: String) -> float:
	points("ak")
	var s: Dictionary = (_pts.get("_sights", {}) as Dictionary).get(id, {})
	return float(s.get("axis_y", 0.03))

static func model(id: String) -> Node3D:
	var d: Dictionary = DATA.get(id, DATA["ak"])
	var n: Node3D = (load(String(d["model"])) as PackedScene).instantiate()
	n.rotation.y = PI
	return n

static func sight_model(id: String) -> Node3D:
	var n: Node3D = (load("res://models/w/sight_%s.glb" % id) as PackedScene).instantiate()
	n.rotation.y = PI
	return n
