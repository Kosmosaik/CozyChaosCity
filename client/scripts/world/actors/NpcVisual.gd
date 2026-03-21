extends Node3D
class_name NpcVisual

# NpcVisual is the project-owned wrapper around the imported NPC model.
#
# Responsibilities:
# - own model-space transform tuning (scale / offset / yaw)
# - hide raw imported scene structure from gameplay actor code
# - resolve the animation player once
# - expose one stable label anchor contract
#
# This means OwnedPlotNpcActor3D no longer needs to know:
# - where the raw model lives
# - how the imported hierarchy is organized
# - how to search the imported scene for animation/anchor details
#
# If the model asset changes later, this wrapper is the main place that should
# absorb that change.

const LABEL_FALLBACK_HEIGHT: float = 2.35
const LABEL_HEAD_NODE_CANDIDATES: Array[String] = ["Head"]

@export var model_scale: Vector3 = Vector3(1.15, 1.15, 1.15)
@export var model_position: Vector3 = Vector3(0.0, 0.02, 0.0)
@export var model_yaw_offset_degrees: float = 180.0

var _model_root: Node3D = null
var _model_node: Node3D = null
var _label_anchor_fallback: Marker3D = null

var _animation_player: AnimationPlayer = null
var _resolved_label_anchor: Node3D = null

func _ready() -> void:
	_ensure_contract_ready()

func get_animation_player() -> AnimationPlayer:
	_ensure_contract_ready()
	return _animation_player

func get_label_anchor_node() -> Node3D:
	_ensure_contract_ready()
	return _resolved_label_anchor

func _ensure_contract_ready() -> void:
	_resolve_nodes()

	if _model_root == null or _model_node == null or _label_anchor_fallback == null:
		return

	_apply_visual_transform_contract()

	if _animation_player == null:
		_animation_player = _find_animation_player_recursive(_model_node)

	if _resolved_label_anchor == null or not is_instance_valid(_resolved_label_anchor):
		_resolved_label_anchor = _resolve_label_anchor()

func _resolve_nodes() -> void:
	if _model_root == null:
		_model_root = get_node_or_null("ModelRoot") as Node3D

	if _model_node == null:
		_model_node = get_node_or_null("ModelRoot/Model") as Node3D

	if _label_anchor_fallback == null:
		_label_anchor_fallback = get_node_or_null("LabelAnchorFallback") as Marker3D

func _apply_visual_transform_contract() -> void:
	# All model-space tuning lives here so the actor scene does not need to
	# know anything about imported asset offsets.
	_model_root.rotation_degrees = Vector3(0.0, model_yaw_offset_degrees, 0.0)
	_model_node.scale = model_scale
	_model_node.position = model_position

func _resolve_label_anchor() -> Node3D:
	# Prefer a real anchor attached to the imported head node so overhead labels
	# follow animation correctly. If the imported hierarchy changes later, this
	# lookup logic stays isolated in the visual wrapper.
	var head_node: Node3D = _find_first_named_node_recursive(
		_model_node,
		LABEL_HEAD_NODE_CANDIDATES
	)

	if head_node != null:
		var existing_anchor: Marker3D = head_node.get_node_or_null("LabelAnchor") as Marker3D
		if existing_anchor != null:
			return existing_anchor

		var label_anchor: Marker3D = Marker3D.new()
		label_anchor.name = "LabelAnchor"
		head_node.add_child(label_anchor)
		label_anchor.position = Vector3.ZERO
		return label_anchor

	# Stable fallback if the model no longer exposes the expected head node.
	_label_anchor_fallback.position = Vector3(0.0, LABEL_FALLBACK_HEIGHT, 0.0)
	return _label_anchor_fallback

func _find_first_named_node_recursive(node: Node, candidate_names: Array[String]) -> Node3D:
	if node == null:
		return null

	for candidate_name in candidate_names:
		if String(node.name) == candidate_name and node is Node3D:
			return node as Node3D

	for child_value in node.get_children():
		var child: Node = child_value as Node
		var found: Node3D = _find_first_named_node_recursive(child, candidate_names)
		if found != null:
			return found

	return null

func _find_animation_player_recursive(node: Node) -> AnimationPlayer:
	if node == null:
		return null

	if node is AnimationPlayer:
		return node as AnimationPlayer

	for child_value in node.get_children():
		var child: Node = child_value as Node
		var found: AnimationPlayer = _find_animation_player_recursive(child)
		if found != null:
			return found

	return null
