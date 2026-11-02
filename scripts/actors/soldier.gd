class_name Soldier
extends Node3D
## A full soldier body for third person, for team mates and for bots: the rigged model, its walk / run /
## idle clips matched to the real speed, the rig that aims and holds the rifle, a muzzle flash, outfits.
## The controller (player or bot) only sets the fields below every frame.

const MODEL := "res://models/chars/soldier.glb"
## weapon kinds -> model, stock / grip points in the holder frame (metres, holder looks down -Z), muzzle
const GUNS := {
	"ak": {"model": "res://models/ak.glb", "flip": true, "stock": Vector3(0.0, -0.055, 0.34), "grip_r": Vector3(0.012, -0.075, 0.10),
		"grip_l": Vector3(0.0, -0.035, -0.21), "muzzle": Vector3(0.0, -0.006, -0.56), "scale": 1.0, "two_hands": 1.0},
}
## clip speeds (m/s the feet cover when the clip plays at 1x)
const WALK_SPEED := 1.45
const RUN_SPEED := 4.4

# ---- driven by the controller
var aim_yaw := 0.0
var aim_pitch := 0.0
var aim_weight := 1.0
var body_yaw := 0.0
var speed := 0.0                 # horizontal speed, m/s
var move_dir := Vector2.ZERO     # world-space horizontal velocity direction (x, z)
var crouch := 0.0                # 0..1
var prone_drop := 0.0            # extra metres down (prone / seated)
var low_ready := 0.0             # 0 aiming .. 1 rifle down across the chest
var hold := 1.0                  # hands on the gun
var left_hand := 1.0
var recoil_kick := 0.0
var airborne := false
var dead := false
var lod := 0                     # 0 full (rig), 1 clip only, 2 hidden
var team_color := Color(0.35, 0.4, 0.3)

# ---- built here
var model: Node3D
var skel: Skeleton3D
var ap: AnimationPlayer
var rig: SoldierRig
var gun_holder: Node3D
var gun_model: Node3D
var gun_kind := ""
var gun_stock := Vector3.ZERO
var grip_r := Vector3.ZERO
var grip_l := Vector3.ZERO
var muzzle: Node3D
var flash: MeshInstance3D
var flash_t := 0.0
var meshes: Array[MeshInstance3D] = []
var _clip := ""
var _dead_t := 0.0
var _outfit_mat: Array[ShaderMaterial] = []

static var _flash_mat: StandardMaterial3D

func _ready() -> void:
	model = (load(MODEL) as PackedScene).instantiate() as Node3D
	add_child(model)   # this model already faces -Z
	skel = model.find_children("*", "Skeleton3D", true, false)[0] as Skeleton3D
	ap = model.find_children("*", "AnimationPlayer", true, false)[0] as AnimationPlayer
	for c in model.find_children("*", "BoneAttachment3D", true, false):
		c.queue_free()   # leaf helpers the importer made; nothing hangs on them
	for n in ["Idle", "Walk", "Run"]:
		var a := ap.get_animation(n)
		if a:
			a.loop_mode = Animation.LOOP_LINEAR
			_strip_root_motion(a)
	for mi in model.find_children("*", "MeshInstance3D", true, false):
		meshes.append(mi as MeshInstance3D)
	rig = SoldierRig.new()
	skel.add_child(rig)
	rig.setup(self)
	gun_holder = Node3D.new()
	gun_holder.top_level = true
	add_child(gun_holder)
	muzzle = Node3D.new()
	gun_holder.add_child(muzzle)
	if _flash_mat == null:
		_flash_mat = StandardMaterial3D.new()
		_flash_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		_flash_mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
		_flash_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		_flash_mat.albedo_texture = load("res://textures/fx/flash.png")
		_flash_mat.albedo_color = Color(1.0, 0.8, 0.55)
		_flash_mat.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
		_flash_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	flash = MeshInstance3D.new()
	var q := QuadMesh.new()
	q.size = Vector2(0.32, 0.32)
	q.material = _flash_mat
	flash.mesh = q
	flash.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	flash.visible = false
	muzzle.add_child(flash)
	set_weapon("ak")
	ap.play("Idle")
	_clip = "Idle"

## the clips walk on the spot except for the hips' sway; drop any forward drift so the body stays on its capsule
func _strip_root_motion(a: Animation) -> void:
	# the importer turned the finger-tip end nodes into attachments; their node tracks have nothing to drive
	for t in range(a.get_track_count() - 1, -1, -1):
		if not str(a.track_get_path(t)).contains(":"):
			a.remove_track(t)
	for t in a.get_track_count():
		var p := str(a.track_get_path(t))
		if a.track_get_type(t) == Animation.TYPE_POSITION_3D and p.ends_with("Hips"):
			var k0: Vector3 = a.position_track_interpolate(t, 0.0)
			for k in a.track_get_key_count(t):
				var v: Vector3 = a.track_get_key_value(t, k)
				a.track_set_key_value(t, k, Vector3(v.x, k0.y, v.z))   # skeleton space is Z-up, Y forward

func set_weapon(kind: String) -> void:
	if kind == gun_kind:
		return
	gun_kind = kind
	if gun_model:
		gun_model.queue_free()
		gun_model = null
	if kind == "" or not GUNS.has(kind):
		gun_holder.visible = false
		hold = 0.0
		return
	var g: Dictionary = GUNS[kind]
	gun_model = (load(g["model"]) as PackedScene).instantiate() as Node3D
	if g["flip"]:
		gun_model.rotation.y = PI
	gun_model.scale = Vector3.ONE * float(g["scale"])
	gun_holder.add_child(gun_model)
	gun_holder.visible = true
	gun_stock = g["stock"]
	grip_r = g["grip_r"]
	grip_l = g["grip_l"]
	muzzle.position = g["muzzle"]
	left_hand = g["two_hands"]
	hold = 1.0

## a muzzle flash for one frame or two (bots and third person)
func shot_flash() -> void:
	flash.visible = true
	flash.rotation.z = randf() * TAU
	var s := randf_range(0.8, 1.3)
	flash.scale = Vector3(s, s, s)
	flash_t = 0.05
	recoil_kick = minf(recoil_kick + 0.035, 0.07)

func muzzle_position() -> Vector3:
	return muzzle.global_position

## outfit: tint over the body texture (uniform colours for the store and the two teams)
func set_outfit(body: Color, visor: Color = Color(0.1, 0.1, 0.1)) -> void:
	for mi in meshes:
		for si in mi.mesh.get_surface_count():
			var src := mi.get_active_material(si)
			if src is StandardMaterial3D:
				var m := (src as StandardMaterial3D).duplicate() as StandardMaterial3D
				m.albedo_color = visor if mi.name.contains("visor") else body
				mi.set_surface_override_material(si, m)

func set_shadows(on: bool) -> void:
	for mi in meshes:
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if on else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

func set_lod(l: int) -> void:
	if l == lod:
		return
	lod = l
	visible = l < 2
	rig.active = l == 0
	ap.active = l < 2
	gun_holder.visible = l < 2 and gun_kind != ""

func _process(delta: float) -> void:
	if flash_t > 0.0:
		flash_t -= delta
		if flash_t <= 0.0:
			flash.visible = false
	recoil_kick = move_toward(recoil_kick, 0.0, delta * 0.6)
	if lod >= 2:
		return
	if dead:
		_dead_t += delta
		var k := smoothstep(0.0, 0.7, _dead_t)
		model.rotation = Vector3(PI * 0.5 * k * 0.98, 0.0, 0.0)
		model.position = Vector3(0, 0.12 * k, -0.85 * k)
		hold = 0.0
		ap.speed_scale = maxf(0.0, 1.0 - k * 2.0)
		return
	rotation.y = body_yaw
	# pick the clip and its speed from the real ground speed
	var fwd := Vector2(-sin(body_yaw), -cos(body_yaw))
	var along := move_dir.dot(fwd) if move_dir.length() > 0.01 else 1.0
	var want := "Idle"
	var sc := 1.0
	if airborne:
		want = "Idle"
		sc = 0.4
	elif speed > 3.0:
		want = "Run"
		sc = clampf(speed / RUN_SPEED, 0.75, 1.35)
	elif speed > 0.25:
		want = "Walk"
		sc = clampf(speed / WALK_SPEED, 0.55, 1.6) * (1.0 if along >= -0.3 else -1.0)
	if crouch > 0.5 and want == "Run":
		want = "Walk"
		sc = clampf(speed / (WALK_SPEED * 1.15), 0.6, 1.8)
	if want != _clip:
		ap.play(want, 0.22)
		_clip = want
	ap.speed_scale = sc

## turn the body: towards the movement when walking (within reach of the twisting spine), to the aim when still
func face(delta: float, aiming: bool) -> void:
	var target := aim_yaw
	if speed > 0.3 and not aiming:
		var mv_yaw := atan2(-move_dir.x, -move_dir.y)
		var diff := wrapf(mv_yaw - aim_yaw, -PI, PI)
		if absf(diff) > PI * 0.62:
			diff = wrapf(diff + PI, -PI, PI)   # walking backwards: face the aim, play the clip in reverse
		target = aim_yaw + clampf(diff, -1.1, 1.1)
	var rate := 10.0 if speed > 0.3 else 5.0
	var d := wrapf(target - body_yaw, -PI, PI)
	if absf(wrapf(aim_yaw - body_yaw, -PI, PI)) > 1.2:
		rate = 14.0   # never let the aim leave what the spine can reach
	body_yaw = wrapf(body_yaw + d * clampf(delta * rate, 0.0, 1.0), -PI, PI)
