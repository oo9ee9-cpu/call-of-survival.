class_name SoldierRig
extends SkeletonModifier3D
## Runs after the walk / run / idle clip on the soldier's skeleton:
## 1. turns and bends the spine, neck and head towards the aim (the legs keep walking where they go),
## 2. lowers the hips for crouching and bends the legs so the feet stay where the clip put them,
## 3. puts the rifle against the right shoulder pointing at the aim,
## 4. closes both hands on it (two-bone IK, hands oriented from the hand's own finger bones).
## Works in skeleton space; the model is in centimetres, so world metres are scaled by `unit`.

var soldier: Soldier
var B := {}            # short name -> bone index
var unit := 100.0      # skeleton units per metre
var ready_ok := false

const SPINE := ["Spine", "Spine1", "Spine2"]
const SPINE_YAW := [0.3, 0.3, 0.4]
const SPINE_PITCH := [0.22, 0.28, 0.32]

func setup(s: Soldier) -> void:
	soldier = s
	var sk := get_skeleton()
	for i in sk.get_bone_count():
		var n := sk.get_bone_name(i)
		var short := n.substr(n.find("_") + 1) if n.begins_with("mixamorig") else n
		B[short] = i
	for need in ["Hips", "Spine", "Spine1", "Spine2", "Neck", "Head", "RightShoulder", "RightArm", "RightForeArm", "RightHand",
			"LeftShoulder", "LeftArm", "LeftForeArm", "LeftHand", "LeftUpLeg", "LeftLeg", "LeftFoot", "RightUpLeg", "RightLeg", "RightFoot"]:
		if not B.has(need):
			push_warning("rig: missing bone " + need)
			return
	ready_ok = true

## bone pose helpers: globals are rebuilt by hand from the local poses so nothing waits on the skeleton's cache
func _local(i: int) -> Transform3D:
	return get_skeleton().get_bone_pose(i)

func _global(i: int) -> Transform3D:
	var sk := get_skeleton()
	var t := sk.get_bone_pose(i)
	var p := sk.get_bone_parent(i)
	while p >= 0:
		t = sk.get_bone_pose(p) * t
		p = sk.get_bone_parent(p)
	return t

func _set_global_basis(i: int, parent_global: Transform3D, b: Basis) -> void:
	var local_b := parent_global.basis.inverse() * b
	get_skeleton().set_bone_pose_rotation(i, local_b.orthonormalized().get_rotation_quaternion())

func _process_modification_with_delta(_delta: float) -> void:
	if not ready_ok or soldier == null:
		return
	var sk := get_skeleton()
	var sg := sk.global_transform
	var inv := sg.affine_inverse()
	unit = 1.0 / maxf(sg.basis.get_scale().x, 1e-6)
	var up_s := (inv.basis * Vector3.UP).normalized()
	var body_fwd_w := -soldier.global_transform.basis.z
	# ---- 2. crouch: lower the hips, remember where the feet were
	var hips: int = B["Hips"]
	var feet_before := [_global(B["LeftFoot"]), _global(B["RightFoot"])]
	var drop := soldier.crouch * 0.42 + soldier.prone_drop
	if drop > 0.001:
		var hp := _local(hips)
		sk.set_bone_pose_position(hips, hp.origin - up_s * drop * unit)
	# ---- 1. spine towards the aim
	var yaw_d := clampf(wrapf(soldier.aim_yaw - soldier.body_yaw, -PI, PI), -1.25, 1.25)
	var pitch := clampf(soldier.aim_pitch, -1.2, 1.2)
	var aim_w := Basis(Vector3.UP, soldier.aim_yaw) * Basis(Vector3.RIGHT, pitch) * Vector3(0, 0, -1)
	var right_w := aim_w.cross(Vector3.UP).normalized()
	var right_s := (inv.basis * right_w).normalized()
	var parent_g := _global(sk.get_bone_parent(B["Spine"]))
	for k in SPINE.size():
		var i: int = B[SPINE[k]]
		var g := parent_g * _local(i)
		var r := Basis(right_s, pitch * SPINE_PITCH[k] * soldier.aim_weight) * Basis(up_s, yaw_d * SPINE_YAW[k] * soldier.aim_weight)
		var nb := r * g.basis
		_set_global_basis(i, parent_g, nb)
		parent_g = Transform3D(nb, g.origin)
	# neck and head: the rest of the pitch so the eyes follow the sights
	for nm in ["Neck", "Head"]:
		var i: int = B[nm]
		var g := parent_g * _local(i)
		var nb := Basis(right_s, pitch * 0.1 * soldier.aim_weight) * g.basis
		_set_global_basis(i, parent_g, nb)
		parent_g = Transform3D(nb, g.origin)
	# ---- 3. the rifle: butt against the right shoulder, barrel along the aim
	var gun := soldier.gun_holder
	if gun and gun.visible and soldier.hold > 0.0:
		var chest_g := _global(B["Spine2"])
		var rsh := _global(B["RightArm"]).origin
		var aim_s := (inv.basis * aim_w).normalized()
		# low ready while sprinting / reloading: muzzle down and across the chest
		var low := soldier.low_ready
		var aim_g := (Basis(up_s, 0.55 * low) * Basis(right_s, -0.75 * low)) * aim_s
		var fwd_s := aim_g.normalized()
		var rgt_s := fwd_s.cross(up_s).normalized()
		var upv_s := rgt_s.cross(fwd_s).normalized()
		var pocket := rsh + (rgt_s * -0.065 + upv_s * -0.035 + fwd_s * 0.04) * unit
		var off: Vector3 = soldier.gun_stock      # stock point in the holder's own frame (metres)
		var gb := Basis(rgt_s, upv_s, -fwd_s)     # holder looks down -Z
		var holder_s := Transform3D(gb, pocket - gb * (off * unit))
		holder_s.origin += gb * (Vector3(0, 0, soldier.recoil_kick) * unit)
		var holder_w := sg * holder_s
		gun.global_transform = Transform3D(holder_w.basis.orthonormalized(), holder_w.origin)
		# ---- 4. hands on the grips
		var rgrip: Vector3 = holder_s * (soldier.grip_r * unit)
		var lgrip: Vector3 = holder_s * (soldier.grip_l * unit)
		var fwd2 := fwd_s
		var down := -upv_s
		var left := -rgt_s
		# right hand: fingers forward-down round the pistol grip, palm to the left, index (on the trigger) above
		_arm("Right", rgrip, rsh + (down * 0.5 + rgt_s * 0.6 - fwd2 * 0.2) * unit,
			(fwd2 * 0.55 + down * 0.8).normalized(), (upv_s * 0.9 + fwd2 * 0.3).normalized(), soldier.hold)
		# left hand: from under the handguard, fingers up round its right side, index towards the muzzle
		var lsh := _global(B["LeftArm"]).origin
		_arm("Left", lgrip, lsh + (down * 0.8 + left * 0.4) * unit,
			(rgt_s * 0.75 + upv_s * 0.45 + fwd2 * 0.2).normalized(), (fwd2 * 0.95 + upv_s * 0.1).normalized(), soldier.hold * soldier.left_hand)
	# ---- 2b. legs: feet back where the clip had them
	if drop > 0.001:
		var knee_dir_s := (inv.basis * body_fwd_w).normalized()
		for side in ["Left", "Right"]:
			var fg: Transform3D = feet_before[0] if side == "Left" else feet_before[1]
			var target := fg.origin + knee_dir_s * soldier.crouch * 0.08 * unit
			var upl: int = B[side + "UpLeg"]
			var pole := _global(upl).origin + (knee_dir_s * 1.0 + up_s * -0.2) * unit
			_two_bone(upl, B[side + "Leg"], B[side + "Foot"], target, pole, fg.basis, 1.0)

## two-bone IK for an arm, then turn the hand so its own fingers point along f and its pinky->index along s
func _arm(side: String, target: Vector3, pole: Vector3, f: Vector3, s: Vector3, weight: float) -> void:
	if weight <= 0.001:
		return
	var hand: int = B[side + "Hand"]
	var hb := _hand_basis(side, f, s)
	# the hand bone sits at the wrist: put the palm, not the wrist, on the grip
	var palm_n := f.cross(s).normalized() * (1.0 if side == "Left" else -1.0)
	var wrist := target - f * 0.07 * unit - palm_n * 0.02 * unit
	_two_bone(B[side + "Arm"], B[side + "ForeArm"], hand, wrist, pole, hb, weight)

func _hand_basis(side: String, f: Vector3, s: Vector3) -> Basis:
	var hand: int = B[side + "Hand"]
	var hg := _global(hand)
	var mid: int = B.get(side + "HandMiddle1", -1)
	var idx: int = B.get(side + "HandIndex1", -1)
	var pnk: int = B.get(side + "HandPinky1", -1)
	if mid < 0 or idx < 0 or pnk < 0:
		return hg.basis
	var f0 := (hg * _local(mid).origin - hg.origin).normalized()
	var s0 := (hg * _local(idx).origin - hg * _local(pnk).origin).normalized()
	var cur := _frame(f0, s0)
	var want := _frame(f, s)
	return (want * cur.inverse()) * hg.basis

func _frame(f: Vector3, s: Vector3) -> Basis:
	var x := f.normalized()
	var z := x.cross(s).normalized()
	var y := z.cross(x).normalized()
	return Basis(x, y, z)

## classic two-bone solve: a (shoulder / hip) - b (elbow / knee) - c (hand / foot), bending towards the pole
func _two_bone(a: int, b: int, c: int, target: Vector3, pole: Vector3, end_basis: Basis, weight: float) -> void:
	var sk := get_skeleton()
	var pa := sk.get_bone_parent(a)
	var pg := _global(pa) if pa >= 0 else Transform3D()
	var ga := pg * _local(a)
	var gb := ga * _local(b)
	var gc := gb * _local(c)
	var A := ga.origin
	var Bp := gb.origin
	var C := gc.origin
	var la := A.distance_to(Bp)
	var lb := Bp.distance_to(C)
	var t := target - A
	var tl := t.length()
	if tl < 1e-4 or la < 1e-4 or lb < 1e-4:
		return
	var dir := t / tl
	var d := clampf(tl, absf(la - lb) + 1e-3, (la + lb) * 0.999)
	var pv := pole - A
	var n := dir.cross(pv)
	if n.length() < 1e-5:
		n = dir.cross(Vector3(0, 0, 1))
		if n.length() < 1e-5:
			n = dir.cross(Vector3(1, 0, 0))
	n = n.normalized()
	var cos_a := clampf((la * la + d * d - lb * lb) / (2.0 * la * d), -1.0, 1.0)
	var elbow := A + dir.rotated(n, acos(cos_a)) * la
	var end := A + dir * d
	# blend with the animated pose
	if weight < 0.999:
		elbow = Bp.lerp(elbow, weight)
		end = C.lerp(end, weight)
	var q1 := _arc((Bp - A).normalized(), (elbow - A).normalized())
	var ga_b := Basis(q1) * ga.basis
	var c1 := A + q1 * (C - A)
	var q2 := _arc((c1 - elbow).normalized(), (end - elbow).normalized())
	var gb_b := Basis(q2) * Basis(q1) * gb.basis
	var gc_b := gc.basis
	if weight > 0.0:
		gc_b = Basis((Basis(q2) * Basis(q1) * gc.basis).get_rotation_quaternion().slerp(end_basis.get_rotation_quaternion(), weight))
	_set_global_basis(a, pg, ga_b)
	_set_global_basis(b, Transform3D(ga_b, A), gb_b)
	_set_global_basis(c, Transform3D(gb_b, elbow), gc_b)

func _arc(from: Vector3, to: Vector3) -> Quaternion:
	var d := from.dot(to)
	if d > 0.99999:
		return Quaternion()
	if d < -0.99999:
		var ax := from.cross(Vector3(1, 0, 0))
		if ax.length() < 1e-4:
			ax = from.cross(Vector3(0, 1, 0))
		return Quaternion(ax.normalized(), PI)
	return Quaternion(from, to)
