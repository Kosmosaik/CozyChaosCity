extends Node3D
class_name StaticItemModelVisual

# StaticItemModelVisual is a reusable wrapper for simple non-animated item models.
#
# Responsibilities:
# - own model-space transform tuning for one imported item asset
# - expose one stable apply_item_visual_context(...) contract to ItemVisualNode
# - keep carry-vs-ground transform differences out of actor/world scripts
#
# This keeps item asset integration modular:
# - gameplay code only knows item_id
# - ItemVisualRegistry chooses a wrapper scene
# - the wrapper scene owns scale/rotation/offset details

const CONTEXT_CARRY: String = "carry"
const CONTEXT_LOOSE_GROUND: String = "loose_ground"

@export var carry_model_scale: Vector3 = Vector3.ONE
@export var carry_model_position: Vector3 = Vector3.ZERO
@export var carry_model_yaw_offset_degrees: float = 0.0

@export var loose_ground_model_scale: Vector3 = Vector3.ONE
@export var loose_ground_model_position: Vector3 = Vector3.ZERO
@export var loose_ground_model_yaw_offset_degrees: float = 0.0
@export var loose_ground_visual_height: float = 0.25

var _model_root: Node3D = null
var _model_node: Node3D = null

func _ready() -> void:
	_resolve_nodes()

func apply_item_visual_context(item_id: String, quantity: int, context: String) -> float:
	# item_id and quantity are accepted to match the shared wrapper contract,
	# even though this generic static wrapper does not branch on them internally.
	_resolve_nodes()

	if _model_root == null or _model_node == null:
		return 0.0

	match context:
		CONTEXT_LOOSE_GROUND:
			_apply_model_transform(
				loose_ground_model_scale,
				loose_ground_model_position,
				loose_ground_model_yaw_offset_degrees
			)

			return loose_ground_visual_height

		CONTEXT_CARRY:
			_apply_model_transform(
				carry_model_scale,
				carry_model_position,
				carry_model_yaw_offset_degrees
			)

			return 0.0

		_:
			_apply_model_transform(
				carry_model_scale,
				carry_model_position,
				carry_model_yaw_offset_degrees
			)
			return 0.0

func _resolve_nodes() -> void:
	if _model_root == null:
		_model_root = get_node_or_null("ModelRoot") as Node3D

	if _model_node == null:
		_model_node = get_node_or_null("ModelRoot/Model") as Node3D

func _apply_model_transform(
	model_scale: Vector3,
	model_position: Vector3,
	model_yaw_offset_degrees: float
) -> void:
	# The wrapper scene owns all imported-model transform tuning so the shared
	# item pipeline never needs to care how the raw asset is authored.
	_model_root.rotation_degrees = Vector3(0.0, model_yaw_offset_degrees, 0.0)
	_model_node.scale = model_scale
	_model_node.position = model_position
