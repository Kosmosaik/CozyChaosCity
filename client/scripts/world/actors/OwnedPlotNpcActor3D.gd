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
	"carrying_to_dropoff": ["Walk Carry", "Walk"],
	"dropping_off": ["Scavenge", "Idle"],
	"returning": ["Walk"],
}

@onready var click_body: StaticBody3D = $ClickBody
@onready var visual_root: Node3D = $VisualRoot
@onready var selection_ring: MeshInstance3D = $SelectionRing
@onready var carry_visual: MeshInstance3D = $CarryVisual

var _visual_instance: Node3D = null
var _animation_player: AnimationPlayer = null
var _label_anchor: Node3D = null
var _resolved_animation_names_by_state: Dictionary = {}
var _current_animation_name: String = ""
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
	var carrying_kind_value: Variant = npc_data.get("carrying_kind", null)
	var is_carrying: bool = carrying_kind_value != null

	if carry_visual != null:
		carry_visual.visible = is_carrying

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
		current_position,
		work_visual_target_position,
		has_work_visual_target
	)
	_play_animation_for_state(state)

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

	if _animation_player != null and not _animation_player.animation_finished.is_connected(_on_animation_finished):
		_animation_player.animation_finished.connect(_on_animation_finished)

	_resolve_label_anchor_from_visual_wrapper()

func _resolve_animation_names() -> void:
	_resolved_animation_names_by_state.clear()
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

		for animation_name_value in animation_candidates:
			var animation_name: String = str(animation_name_value)
			if _animation_player.has_animation(animation_name):
				_resolved_animation_names_by_state[state_name] = animation_name
				break

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
	current_position: Vector3,
	work_visual_target_position: Vector3,
	has_work_visual_target: bool
) -> void:
	if visual_root == null:
		return

	# Reset to neutral unless the NPC is actively working on a rubble object
	# that has a known client-side visual position.
	if state != "working" or not has_work_visual_target:
		visual_root.position = Vector3.ZERO
		return

	var desired_offset: Vector3 = work_visual_target_position - current_position
	desired_offset.y = 0.0

	# Clamp the visual-only shift so the visible character stays close to the
	# authoritative root. This avoids the model looking detached from its click
	# body / selection ring.
	if desired_offset.length() > MAX_WORK_VISUAL_OFFSET_METERS:
		desired_offset = desired_offset.normalized() * MAX_WORK_VISUAL_OFFSET_METERS

	visual_root.position = desired_offset

func _play_animation_for_state(state: String) -> void:
	if _animation_player == null:
		return

	if state == "idle":
		if _current_state != "idle" or not _animation_player.is_playing():
			_current_state = "idle"
			_play_random_idle_animation()
		return

	_current_state = state

	var animation_name: String = str(_resolved_animation_names_by_state.get(state, ""))
	if animation_name == "":
		animation_name = str(_resolved_animation_names_by_state.get("idle", ""))

	if animation_name == "":
		return

	if _current_animation_name == animation_name and _animation_player.is_playing():
		return

	_animation_player.play(animation_name)
	_current_animation_name = animation_name
	
func _play_random_idle_animation() -> void:
	if _animation_player == null:
		return

	if _idle_animation_names.is_empty():
		var fallback_animation_name: String = str(_resolved_animation_names_by_state.get("idle", ""))
		if fallback_animation_name != "":
			_animation_player.play(fallback_animation_name)
			_current_animation_name = fallback_animation_name
		return

	var next_animation_name: String = _idle_animation_names[_rng.randi_range(0, _idle_animation_names.size() - 1)]

	if _idle_animation_names.size() > 1 and next_animation_name == _current_animation_name:
		var current_index: int = _idle_animation_names.find(next_animation_name)
		if current_index >= 0:
			next_animation_name = _idle_animation_names[(current_index + 1) % _idle_animation_names.size()]

	_animation_player.play(next_animation_name)
	_current_animation_name = next_animation_name

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
