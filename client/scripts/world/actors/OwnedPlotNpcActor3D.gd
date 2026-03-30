extends Node3D
class_name OwnedPlotNpcActor3D

# OwnedPlotNpcActor3D is the reusable presentation wrapper for local plot NPCs.
#
# Responsibilities:
# - own the click body / selection ring / carry visual
# - load the current visual model
# - resolve imported animation clips once
# - map authoritative NPC states into presentation animations
# - provide a stable label anchor for overhead UI
#
# This actor intentionally does NOT:
# - own authoritative NPC simulation
# - own networking
# - choose jobs/orders
# - own movement timing
#
# Movement timing remains in OwnedPlotDetailRenderer3D so the plot renderer
# still controls sync/tween behavior for all local detail actors consistently.

const NPC_VISUAL_SCENE: PackedScene = preload("res://scenes/actors/NpcVisual.tscn")
const CLICK_BODY_GROUP: StringName = &"owned_plot_npc_click_body"
const LABEL_FALLBACK_HEIGHT: float = 2.35

# Visual-only presentation offset used while working against rubble that has
# client-side visual translation. This must stay small so the visible model
# remains close to the authoritative root/click body.
const MAX_WORK_VISUAL_OFFSET_METERS: float = 0.45

const STATE_ANIMATION_CANDIDATES: Dictionary = {
	"idle": ["Idle", "Idle2", "Idle3"],
	"moving_to_target": ["Walk"],
	"working": ["Scavenge"],
	"pickup_recover": ["Scavenge Complete", "Idle"],
	"carrying_to_dropoff": ["Walk Carry", "Walk"],
	"dropping_off": ["Scavenge Start", "Scavenge", "Idle"],
	"dropoff_recover": ["Scavenge Complete", "Idle"],
	"returning": ["Walk"],
}

const ACTIVITY_ANIMATION_CANDIDATES: Dictionary = {
	"Operating workbench": ["Workbench_Work", "Scavenge"],
	"Picking up item": ["Scavenge Start", "Scavenge", "Idle"],
	"Finishing pickup": ["Scavenge Complete", "Idle"],
	"Dropping off item": ["Scavenge Start", "Scavenge", "Idle"],
	"Finishing dropoff": ["Scavenge Complete", "Idle"],
}

const LOOPING_ANIMATION_NAMES: Array[String] = [
	"Walk",
	"Walk Carry",
	"Scavenge",
	"Workbench_Work",
]

# Workbench operation uses an authored local anchor from the station scene.
# Allow a much larger visual-only offset here so the worker can read as
# standing close to the bench even though the authoritative server tile remains
# on the nearest valid adjacent interaction cell.
const WORKBENCH_VISUAL_OFFSET_MAX_METERS: float = 4.0

@onready var click_body: StaticBody3D = $ClickBody
@onready var visual_root: Node3D = $VisualRoot
@onready var selection_ring: MeshInstance3D = $SelectionRing
@onready var carry_visual: ItemVisualNode = $CarryVisual

var _visual_instance: Node3D = null
var _animation_player: AnimationPlayer = null
var _label_anchor: Node3D = null
var _resolved_animation_names_by_state: Dictionary = {}
var _resolved_animation_names_by_activity: Dictionary = {}
var _current_animation_name: String = ""
var _current_animation_signature: String = ""
var _last_facing_direction: Vector3 = Vector3.FORWARD

var _rng: RandomNumberGenerator = RandomNumberGenerator.new()
var _idle_animation_names: Array[String] = []
var _current_state: String = ""

func _ready() -> void:
	if click_body != null:
		_rng.randomize()
		click_body.input_ray_pickable = true
		click_body.add_to_group(CLICK_BODY_GROUP)

	if selection_ring != null:
		selection_ring.visible = false

	if carry_visual != null:
		carry_visual.visible = false

	_spawn_visual_if_needed()

func set_selected(is_selected: bool) -> void:
	if selection_ring != null:
		selection_ring.visible = is_selected

func get_label_world_position() -> Vector3:
	if _label_anchor != null and is_instance_valid(_label_anchor):
		_label_anchor.force_update_transform()
		return _label_anchor.global_position

	return global_position + Vector3(0.0, LABEL_FALLBACK_HEIGHT, 0.0)

func apply_snapshot(
	npc_data: Dictionary,
	current_position: Vector3,
	target_position: Vector3,
	has_move_target: bool,
	work_visual_target_position: Vector3,
	has_work_visual_target: bool
) -> void:
	var state: String = str(npc_data.get("state", "idle"))
	var activity: String = str(npc_data.get("current_activity", ""))
	var carry_slots_value: Variant = npc_data.get("carry_slots", [])
	var carry_slots: Array = []

	if typeof(carry_slots_value) == TYPE_ARRAY:
		carry_slots = carry_slots_value as Array

	_apply_carry_visual_from_slots(carry_slots)

	# Facing should be reconstructed from real snapshot context whenever possible.
	# That keeps the actor visually stable even after the plot is re-entered and
	# the presentation actor has to be rebuilt from scratch.
	_update_facing(
		state,
		current_position,
		target_position,
		has_move_target,
		work_visual_target_position,
		has_work_visual_target
	)
	_update_visual_work_offset(
		state,
		activity,
		current_position,
		work_visual_target_position,
		has_work_visual_target
	)
	_play_animation_for_snapshot(state, activity)

func _apply_carry_visual_from_slots(carry_slots: Array) -> void:
	if carry_visual == null:
		return

	var first_carry_slot: Dictionary = _get_first_non_empty_carry_slot(carry_slots)
	if first_carry_slot.is_empty():
		carry_visual.visible = false
		carry_visual.clear_item_visual()
		return

	var item_id: String = str(first_carry_slot.get("item_id", ""))
	var quantity: int = _read_non_negative_whole_number(first_carry_slot.get("quantity", 0))
	if item_id == "" or quantity <= 0:
		carry_visual.visible = false
		carry_visual.clear_item_visual()
		return

	carry_visual.visible = true
	carry_visual.apply_item_visual(
		item_id,
		quantity,
		ItemVisualNode.CONTEXT_CARRY
	)

func _get_first_non_empty_carry_slot(carry_slots: Array) -> Dictionary:
	for carry_slot_value in carry_slots:
		if typeof(carry_slot_value) != TYPE_DICTIONARY:
			continue

		var carry_slot: Dictionary = carry_slot_value as Dictionary
		var item_id: String = str(carry_slot.get("item_id", ""))
		var quantity: int = _read_non_negative_whole_number(carry_slot.get("quantity", 0))

		if item_id != "" and quantity > 0:
			return carry_slot

	return {}

func _read_non_negative_whole_number(value: Variant) -> int:
	# Wire-decoded JSON numbers may arrive as either TYPE_INT or TYPE_FLOAT.
	# Carry-slot quantities are logically whole numbers, so normalize them here.
	if typeof(value) == TYPE_INT:
		var int_value: int = value
		return maxi(0, int_value)

	if typeof(value) == TYPE_FLOAT:
		var float_value: float = value
		return maxi(0, int(round(float_value)))

	return 0

func _spawn_visual_if_needed() -> void:
	if _visual_instance != null and is_instance_valid(_visual_instance):
		return

	if NPC_VISUAL_SCENE == null:
		return

	var instance: Node = NPC_VISUAL_SCENE.instantiate()
	if not (instance is Node3D):
		return

	var visual_instance: Node3D = instance as Node3D
	visual_instance.name = "Visual"
	visual_root.add_child(visual_instance)

	_visual_instance = visual_instance
	_animation_player = null

	# Prefer the stable project-owned visual wrapper contract over walking the
	# raw imported model directly from actor code.
	if _visual_instance.has_method("get_animation_player"):
		var animation_player_value: Variant = _visual_instance.call("get_animation_player")
		if animation_player_value is AnimationPlayer:
			_animation_player = animation_player_value as AnimationPlayer

	# Safety fallback if the wrapper contract ever fails during iteration.
	if _animation_player == null:
		_animation_player = _find_animation_player_recursive(_visual_instance)

	_resolve_animation_names()
	_configure_animation_loop_modes()

	if _animation_player != null and not _animation_player.animation_finished.is_connected(_on_animation_finished):
		_animation_player.animation_finished.connect(_on_animation_finished)

	_resolve_label_anchor_from_visual_wrapper()

func _resolve_animation_names() -> void:
	_resolved_animation_names_by_state.clear()
	_resolved_animation_names_by_activity.clear()
	_idle_animation_names.clear()

	if _animation_player == null:
		return

	for state_name_value in STATE_ANIMATION_CANDIDATES.keys():
		var state_name: String = str(state_name_value)
		var animation_candidates_value: Variant = STATE_ANIMATION_CANDIDATES.get(state_name, [])
		if typeof(animation_candidates_value) != TYPE_ARRAY:
			continue

		var animation_candidates: Array = animation_candidates_value as Array

		if state_name == "idle":
			# Idle clips should finish naturally so animation_finished can chain
			# into another random idle clip while the NPC remains in idle state.
			for animation_name_value in animation_candidates:
				var idle_animation_name: String = str(animation_name_value)
				if _animation_player.has_animation(idle_animation_name):
					_idle_animation_names.append(idle_animation_name)

			if not _idle_animation_names.is_empty():
				_resolved_animation_names_by_state[state_name] = _idle_animation_names[0]

			continue

		var resolved_state_animation: String = _find_first_available_animation(
			animation_candidates
		)
		if resolved_state_animation != "":
			_resolved_animation_names_by_state[state_name] = resolved_state_animation

	for activity_name_value in ACTIVITY_ANIMATION_CANDIDATES.keys():
		var activity_name: String = str(activity_name_value)
		var activity_candidates_value: Variant = ACTIVITY_ANIMATION_CANDIDATES.get(
			activity_name,
			[]
		)
		if typeof(activity_candidates_value) != TYPE_ARRAY:
			continue

		var activity_candidates: Array = activity_candidates_value as Array
		var resolved_activity_animation: String = _find_first_available_animation(
			activity_candidates
		)
		if resolved_activity_animation != "":
			_resolved_animation_names_by_activity[activity_name] = resolved_activity_animation
			
func _find_first_available_animation(animation_candidates: Array) -> String:
	if _animation_player == null:
		return ""

	for animation_name_value in animation_candidates:
		var animation_name: String = str(animation_name_value)
		if _animation_player.has_animation(animation_name):
			return animation_name

	return ""
	
func _configure_animation_loop_modes() -> void:
	if _animation_player == null:
		return

	for animation_name in LOOPING_ANIMATION_NAMES:
		if not _animation_player.has_animation(animation_name):
			continue

		var animation: Animation = _animation_player.get_animation(animation_name)
		if animation == null:
			continue

		# Imported locomotion/work clips are not always authored as looping.
		# Force the stable runtime contract here so NPCs never slide after one
		# cycle while the server still thinks they are moving/working.
		animation.loop_mode = Animation.LOOP_LINEAR

func _resolve_label_anchor_from_visual_wrapper() -> void:
	# The actor should not know how the imported model is structured.
	# It asks the project-owned visual wrapper for one stable anchor instead.
	if _visual_instance != null and _visual_instance.has_method("get_label_anchor_node"):
		var label_anchor_value: Variant = _visual_instance.call("get_label_anchor_node")
		if label_anchor_value is Node3D:
			_label_anchor = label_anchor_value as Node3D
			return

	# Stable fallback if the visual wrapper contract is missing or broken.
	var fallback_anchor: Marker3D = Marker3D.new()
	fallback_anchor.name = "LabelAnchor"
	add_child(fallback_anchor)
	fallback_anchor.position = Vector3(0.0, LABEL_FALLBACK_HEIGHT, 0.0)
	_label_anchor = fallback_anchor

func _update_facing(
	state: String,
	current_position: Vector3,
	target_position: Vector3,
	has_move_target: bool,
	work_visual_target_position: Vector3,
	has_work_visual_target: bool
) -> void:
	var direction: Vector3 = Vector3.ZERO

	if has_move_target:
		# Moving states should always face the authoritative movement target.
		direction = target_position - current_position
	elif state == "working" and has_work_visual_target:
		# Working state used to depend only on remembered facing direction.
		# That breaks after leaving/re-entering the plot because the actor is
		# rebuilt and the old remembered direction is gone.
		#
		# By facing the actual rubble visual target, the pose becomes stable and
		# deterministic across refreshes and re-entry.
		direction = work_visual_target_position - current_position
	elif state == "working" or state == "dropping_off":
		# Fallback for cases where we do not have a better explicit target yet.
		direction = _last_facing_direction

	direction.y = 0.0

	if direction.length() <= 0.001:
		return

	_last_facing_direction = direction.normalized()
	look_at(global_position + _last_facing_direction, Vector3.UP, true)

	# Do not apply raw model yaw handling here anymore.
	# The visual wrapper scene owns model-space transform correction so the
	# actor only rotates the gameplay/presentation root itself.0)

func _update_visual_work_offset(
	state: String,
	activity: String,
	current_position: Vector3,
	work_visual_target_position: Vector3,
	has_work_visual_target: bool
) -> void:
	if visual_root == null:
		return

	# Reset to neutral unless the NPC is actively working on something that has
	# a known authored visual target.
	if state != "working" or not has_work_visual_target:
		visual_root.position = Vector3.ZERO
		return

	# The renderer provides the work visual target in the parent / plot space.
	# visual_root.position, however, is local to this actor node.
	#
	# Because the actor root rotates to face the work target, applying the raw
	# parent-space delta directly as a local offset produces the wrong result.
	# Convert the target delta into actor-local space first.
	var desired_parent_space_offset: Vector3 = (
		work_visual_target_position - current_position
	)
	desired_parent_space_offset.y = 0.0

	var desired_local_offset: Vector3 = (
		transform.basis.inverse() * desired_parent_space_offset
	)
	desired_local_offset.y = 0.0

	if activity == "Operating workbench":
		# For workbench operation, the station scene owns the authored visual
		# stance through NpcPosition. Keep the authoritative server tile unchanged
		# and only correct presentation here.
		if desired_local_offset.length() > WORKBENCH_VISUAL_OFFSET_MAX_METERS:
			desired_local_offset = (
				desired_local_offset.normalized()
				* WORKBENCH_VISUAL_OFFSET_MAX_METERS
			)

		visual_root.position = desired_local_offset
		return

	# Rubble keeps the smaller presentation-only correction because its visual
	# target is only compensating for client-side rubble presentation offsets.
	if desired_local_offset.length() > MAX_WORK_VISUAL_OFFSET_METERS:
		desired_local_offset = (
			desired_local_offset.normalized()
			* MAX_WORK_VISUAL_OFFSET_METERS
		)

	visual_root.position = desired_local_offset

func _play_animation_for_snapshot(state: String, activity: String) -> void:
	if _animation_player == null:
		return

	if state == "idle":
		if _current_state != "idle" or not _animation_player.is_playing():
			_current_state = "idle"
			_play_random_idle_animation()
		return

	_current_state = state

	var animation_name: String = str(
		_resolved_animation_names_by_activity.get(activity, "")
	)

	if animation_name == "":
		animation_name = str(_resolved_animation_names_by_state.get(state, ""))

	if animation_name == "":
		animation_name = str(_resolved_animation_names_by_state.get("idle", ""))

	if animation_name == "":
		return

	var animation_signature: String = "%s|%s|%s" % [state, activity, animation_name]

	# Do not suppress replay just because the clip name matches. One-shot clips
	# such as Scavenge Start must be allowed to restart when the authoritative
	# activity changes to a new action.
	if (
		_current_animation_signature == animation_signature
		and _animation_player.is_playing()
	):
		return

	_animation_player.play(animation_name)
	_current_animation_name = animation_name
	_current_animation_signature = animation_signature
	
func _play_random_idle_animation() -> void:
	if _animation_player == null:
		return

	if _idle_animation_names.is_empty():
		var fallback_animation_name: String = str(_resolved_animation_names_by_state.get("idle", ""))
		if fallback_animation_name != "":
			_animation_player.play(fallback_animation_name)
			_current_animation_name = fallback_animation_name
			_current_animation_signature = "idle||" + fallback_animation_name
		return

	var next_animation_name: String = _idle_animation_names[_rng.randi_range(0, _idle_animation_names.size() - 1)]

	if _idle_animation_names.size() > 1 and next_animation_name == _current_animation_name:
		var current_index: int = _idle_animation_names.find(next_animation_name)
		if current_index >= 0:
			next_animation_name = _idle_animation_names[(current_index + 1) % _idle_animation_names.size()]

	_animation_player.play(next_animation_name)
	_current_animation_name = next_animation_name
	_current_animation_signature = "idle||" + next_animation_name

func _on_animation_finished(animation_name: StringName) -> void:
	if _current_state != "idle":
		return

	if String(animation_name) != _current_animation_name:
		return

	_play_random_idle_animation()

func _find_animation_player_recursive(node: Node) -> AnimationPlayer:
	if node is AnimationPlayer:
		return node as AnimationPlayer

	for child_value in node.get_children():
		var child: Node = child_value as Node
		var found: AnimationPlayer = _find_animation_player_recursive(child)
		if found != null:
			return found

	return null
