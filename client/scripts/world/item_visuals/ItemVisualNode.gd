extends Node3D
class_name ItemVisualNode

# ItemVisualNode is a reusable presentation node that renders one item visual.
#
# Responsibilities:
# - resolve item_id/context/quantity through ItemVisualRegistry
# - instance the correct wrapper scene variant when one exists
# - fall back to the shared placeholder path when no wrapper exists
#
# This keeps all quantity-variant asset selection out of:
# - NPC actor code
# - loose-item renderer code
# - future stockpile/build-site renderer code

const CONTEXT_CARRY: String = "carry"
const CONTEXT_LOOSE_GROUND: String = "loose_ground"

var _scene_visual: Node3D = null
var _scene_visual_path: String = ""
var _placeholder_mesh: MeshInstance3D = null

func clear_item_visual() -> void:
	_clear_scene_visual()
	_clear_placeholder_visual()

func apply_item_visual(item_id: String, quantity: int, context: String) -> float:
	if item_id == "" or quantity <= 0:
		clear_item_visual()
		return 0.0

	var scene_path: String = ItemVisualRegistry.get_item_visual_scene_path(
		item_id,
		context,
		quantity
	)
	if scene_path != "":
		var item_visual_scene: PackedScene = ItemVisualRegistry.get_scene_by_path(scene_path)
		if item_visual_scene != null:
			return _apply_scene_backed_visual(
				scene_path,
				item_visual_scene,
				item_id,
				quantity,
				context
			)

	return _apply_placeholder_visual(item_id, context)

func _apply_scene_backed_visual(
	scene_path: String,
	item_visual_scene: PackedScene,
	item_id: String,
	quantity: int,
	context: String
) -> float:
	_clear_placeholder_visual()

	if (
		_scene_visual == null
		or not is_instance_valid(_scene_visual)
		or _scene_visual_path != scene_path
	):
		_clear_scene_visual()

		var visual_instance_node: Node = item_visual_scene.instantiate()
		if visual_instance_node is Node3D:
			var visual_instance: Node3D = visual_instance_node as Node3D
			visual_instance.name = "SceneItemVisual"
			add_child(visual_instance)

			_scene_visual = visual_instance
			_scene_visual_path = scene_path

	if _scene_visual == null or not is_instance_valid(_scene_visual):
		return _apply_placeholder_visual(item_id, context)

	_scene_visual.position = Vector3.ZERO
	_scene_visual.scale = Vector3.ONE

	# Wrapper scene contract:
	# apply_item_visual_context(item_id: String, quantity: int, context: String) -> float
	if _scene_visual.has_method("apply_item_visual_context"):
		var result: Variant = _scene_visual.call(
			"apply_item_visual_context",
			item_id,
			quantity,
			context
		)

		if typeof(result) == TYPE_FLOAT:
			return result

		if typeof(result) == TYPE_INT:
			return float(result)

	return 0.0

func _apply_placeholder_visual(item_id: String, context: String) -> float:
	_clear_scene_visual()

	var placeholder_mesh: MeshInstance3D = _ensure_placeholder_mesh()

	match context:
		CONTEXT_LOOSE_GROUND:
			var visual_height: float = ItemPresentation.apply_placeholder_loose_item_visual(
				placeholder_mesh,
				item_id,
				1
			)
			placeholder_mesh.position = Vector3(0.0, visual_height * 0.5, 0.0)
			return visual_height

		_:
			ItemPresentation.apply_placeholder_carry_visual(
				placeholder_mesh,
				item_id,
				1
			)
			placeholder_mesh.position = Vector3.ZERO
			return 0.0

func _ensure_placeholder_mesh() -> MeshInstance3D:
	if _placeholder_mesh != null and is_instance_valid(_placeholder_mesh):
		return _placeholder_mesh

	var placeholder_mesh: MeshInstance3D = MeshInstance3D.new()
	placeholder_mesh.name = "PlaceholderItemVisual"
	add_child(placeholder_mesh)

	_placeholder_mesh = placeholder_mesh
	return _placeholder_mesh

func _clear_scene_visual() -> void:
	if _scene_visual != null and is_instance_valid(_scene_visual):
		_scene_visual.queue_free()

	_scene_visual = null
	_scene_visual_path = ""

func _clear_placeholder_visual() -> void:
	if _placeholder_mesh != null and is_instance_valid(_placeholder_mesh):
		_placeholder_mesh.queue_free()

	_placeholder_mesh = null
