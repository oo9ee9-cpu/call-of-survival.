extends Node
## Sound: one-shots (2D and 3D, pooled), loops for ambience, sounds delayed by distance, indoor/outdoor mix.

const SOUND_SPEED := 343.0
var banks := {}          # name -> Array[AudioStream] (variants name_1, name_2 ... or a single file)
var pool3: Array[AudioStreamPlayer3D] = []
var pool2: Array[AudioStreamPlayer] = []
var i3 := 0
var i2 := 0
var inside := 0.0
var _rev: AudioEffectReverb
var _lp: AudioEffectLowPassFilter

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	var d := DirAccess.open("res://sounds")
	if d:
		var names := {}
		for f in d.get_files():
			var fn := f.trim_suffix(".import").trim_suffix(".remap")
			if not fn.ends_with(".ogg"):
				continue
			names[fn.get_basename()] = true
		for n in names:
			var key: String = n
			var parts := key.rsplit("_", true, 1)
			if parts.size() == 2 and parts[1].is_valid_int():
				key = parts[0]
			var st := load("res://sounds/%s.ogg" % n) as AudioStream
			if st:
				if not banks.has(key):
					banks[key] = []
				banks[key].append(st)
	for i in 28:
		var p := AudioStreamPlayer3D.new()
		p.bus = "SFX"
		p.attenuation_model = AudioStreamPlayer3D.ATTENUATION_INVERSE_DISTANCE
		p.max_polyphony = 1
		add_child(p)
		pool3.append(p)
	for i in 14:
		var p2 := AudioStreamPlayer.new()
		p2.bus = "SFX"
		add_child(p2)
		pool2.append(p2)
	var sb := AudioServer.get_bus_index("SFX")
	if sb >= 0 and AudioServer.get_bus_effect_count(sb) > 0:
		_rev = AudioServer.get_bus_effect(sb, 0) as AudioEffectReverb
	var ab := AudioServer.get_bus_index("Ambience")
	if ab >= 0 and AudioServer.get_bus_effect_count(ab) > 0:
		_lp = AudioServer.get_bus_effect(ab, 0) as AudioEffectLowPassFilter

func has(name: String) -> bool:
	return banks.has(name)

func pick(name: String) -> AudioStream:
	var b: Array = banks.get(name, [])
	if b.is_empty():
		return null
	return b[randi() % b.size()]

func play(name: String, vol_db := 0.0, pitch_var := 0.05, bus := "SFX") -> AudioStreamPlayer:
	var st := pick(name)
	if st == null:
		return null
	var p := pool2[i2]
	i2 = (i2 + 1) % pool2.size()
	p.stream = st
	p.volume_db = vol_db
	p.pitch_scale = 1.0 + randf_range(-pitch_var, pitch_var)
	p.bus = bus
	p.play()
	return p

## 3D one-shot; with delay < 0 the sound waits for its travel time from the listener's position
func play_at(name: String, pos: Vector3, vol_db := 0.0, unit := 6.0, max_dist := 0.0, delay := 0.0, pitch_var := 0.05, bus := "SFX") -> void:
	var st := pick(name)
	if st == null:
		return
	if delay < 0.0:
		var cam := get_viewport().get_camera_3d()
		delay = cam.global_position.distance_to(pos) / SOUND_SPEED if cam else 0.0
	if delay > 0.02:
		get_tree().create_timer(delay, false).timeout.connect(_play3.bind(st, pos, vol_db, unit, max_dist, pitch_var, bus))
	else:
		_play3(st, pos, vol_db, unit, max_dist, pitch_var, bus)

func _play3(st: AudioStream, pos: Vector3, vol_db: float, unit: float, max_dist: float, pitch_var: float, bus: String) -> void:
	var p := pool3[i3]
	i3 = (i3 + 1) % pool3.size()
	p.stream = st
	p.global_position = pos
	p.volume_db = vol_db
	p.unit_size = unit
	p.max_distance = max_dist
	p.pitch_scale = 1.0 + randf_range(-pitch_var, pitch_var)
	p.bus = bus
	p.play()

func loop(name: String, vol_db := 0.0, bus := "Ambience") -> AudioStreamPlayer:
	var st := pick(name)
	if st == null:
		return null
	if st is AudioStreamOggVorbis:
		(st as AudioStreamOggVorbis).loop = true
	var p := AudioStreamPlayer.new()
	p.stream = st
	p.bus = bus
	p.volume_db = vol_db
	add_child(p)
	p.play(randf() * maxf(st.get_length() - 0.1, 0.0))
	return p

func loop_at(name: String, parent: Node3D, vol_db := 0.0, unit := 2.0, max_dist := 25.0) -> AudioStreamPlayer3D:
	var st := pick(name)
	if st == null:
		return null
	if st is AudioStreamOggVorbis:
		(st as AudioStreamOggVorbis).loop = true
	var p := AudioStreamPlayer3D.new()
	p.stream = st
	p.bus = "SFX"
	p.volume_db = vol_db
	p.unit_size = unit
	p.max_distance = max_dist
	parent.add_child(p)
	p.play(randf() * maxf(st.get_length() - 0.1, 0.0))
	return p

## 0 = outdoors, 1 = inside a dugout: gunshots ring in the small room, the outside gets muffled
func set_inside(k: float) -> void:
	inside = k
	if _rev:
		_rev.wet = 0.32 * k
		_rev.dry = 1.0
	if _lp:
		_lp.cutoff_hz = lerpf(20000.0, 900.0, k)

## stops every sound in the game (loops, pooled one-shots, the stoves' crackle)
func stop_all() -> void:
	for t in ["AudioStreamPlayer", "AudioStreamPlayer3D"]:
		for n in get_tree().root.find_children("*", t, true, false):
			n.call("stop")

## quits once the audio thread has let go of the playing streams (quitting mid-sound makes the engine report them as leaked)
func quit_game() -> void:
	stop_all()
	await get_tree().create_timer(0.15, true, false, true).timeout
	get_tree().quit()
