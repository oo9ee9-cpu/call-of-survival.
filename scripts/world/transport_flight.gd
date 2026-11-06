class_name TransportFlight
extends Node3D
## The way into a match: the transport helicopter (the Chinook) flies a straight route across the battlefield 450 m up,
## the player inside it. The camera follows it from outside and the player can look around it; "jump" (the jump
## button, Space or F) drops him out of the ramp: free fall, then the chute. At the end of the route he is pushed out.

signal jumped

const ALT := 450.0
const SPEED := 72.0

var world: World
var player: Player
var from := Vector3.ZERO
var to := Vector3.ZERO
var dir := Vector3.FORWARD
var heli: Node3D
var rotors: Array[Node3D] = []
var rotor_axes: Array[Vector3] = []
var cam: Camera3D
var cam_yaw := 0.0
var cam_pitch := -0.86
var t := 0.0
var length := 1.0
var done := false
var snd: AudioStreamPlayer3D

## a route of `span` metres through `over` (heading `heading`), at ALT over the ground there
func start(w: World, p: Player, over: Vector3, heading: Vector3, span := 3600.0) -> void:
	world = w
	player = p
	dir = Vector3(heading.x, 0.0, heading.z).normalized()
	from = over - dir * span * 0.5
	to = over + dir * span * 0.5
	var alt := world.height(over.x, over.z) + ALT
	from.y = alt
	to.y = alt
	length = from.distance_to(to)
	heli = Node3D.new()
	add_child(heli)
	var ps := load("res://models/u/chinook.glb") as PackedScene
	if ps:
		var mdl: Node3D = ps.instantiate()
		mdl.rotation.y = PI                 # the model's nose is +Z, the holder flies along -Z
		heli.add_child(mdl)
		var names := ["Object_6", "Object_7", "Object_8", "Object_9"]
		for mi in mdl.find_children("*", "MeshInstance3D", true, false):
			if names.has(String(mi.name)):
				_rotor(mi as MeshInstance3D)
	heli.global_position = from
	heli.look_at(from + dir, Vector3.UP)
	snd = Sfx.loop_at("heli_loop", heli, 8.0, 60.0, 4000.0)
	cam = Camera3D.new()
	cam.fov = 70.0
	cam.far = 6500.0
	add_child(cam)
	cam.current = true
	cam_yaw = atan2(-dir.x, -dir.z) + PI * 0.08
	player.in_transport = true
	player.visible = false
	player.global_position = from
	player.velocity = Vector3.ZERO

func _rotor(mi: MeshInstance3D) -> void:
	var a := mi.get_aabb()
	var pivot := Node3D.new()
	var parent := mi.get_parent()
	parent.add_child(pivot)
	pivot.transform = mi.transform * Transform3D(Basis(), a.get_center())
	var xf := mi.transform
	parent.remove_child(mi)
	pivot.add_child(mi)
	mi.transform = pivot.transform.affine_inverse() * xf
	var ax := Vector3.UP
	if a.size.x < a.size.y and a.size.x < a.size.z:
		ax = Vector3.RIGHT
	elif a.size.z < a.size.y and a.size.z < a.size.x:
		ax = Vector3.BACK
	rotors.append(pivot)
	rotor_axes.append(ax)

func _process(delta: float) -> void:
	if heli == null:
		return
	for i in rotors.size():
		rotors[i].rotate_object_local(rotor_axes[i], delta * (22.0 if i % 2 == 0 else -22.0))
	t += delta
	var k := minf(t * SPEED / length, 1.0)
	var p := from.lerp(to, k)
	p.y += sin(t * 0.7) * 1.5
	heli.global_position = p
	heli.look_at(p + dir, Vector3.UP)
	heli.rotate_object_local(Vector3.FORWARD, sin(t * 0.5) * 0.03)
	if not done:
		# the camera behind and above the helicopter; dragging the screen turns it round
		cam_yaw += player.look_in.x
		cam_pitch = clampf(cam_pitch + player.look_in.y, -1.2, 0.3)
		player.look_in = Vector2.ZERO
		var back := Basis(Vector3.UP, cam_yaw) * Basis(Vector3.RIGHT, cam_pitch) * Vector3(0, 0, 1)
		cam.global_position = p + back * 34.0 + Vector3(0, 4.0, 0)
		cam.look_at(p + Vector3(0, 2.0, 0), Vector3.UP)
		player.global_position = p - Vector3(0, 3.0, 0)
		world.focus = p
		if k >= 1.0:
			jump()
	elif t > 60.0 or heli.global_position.distance_to(player.global_position) > 3000.0:
		queue_free()

## out of the ramp at the back
func jump() -> void:
	if done:
		return
	done = true
	var p := heli.global_position - dir * 8.0 - Vector3(0, 3.0, 0)
	player.in_transport = false
	player.visible = true
	player.global_position = p
	player.yaw = atan2(-dir.x, -dir.z)
	player.yaw_node.rotation.y = player.yaw
	player.pitch = -0.6
	player.air_start()
	player.velocity = dir * SPEED * 0.6 + Vector3(0, -6.0, 0)
	player.cam.current = true
	Sfx.play("chute_open", -14.0, 0.05)
	jumped.emit()

## distance left on the route (for the HUD)
func left_m() -> float:
	return maxf(length - t * SPEED, 0.0)
