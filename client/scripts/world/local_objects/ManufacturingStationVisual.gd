extends Node3D
class_name ManufacturingStationVisual

const ManufacturingStationVisualCatalog = preload(
	"res://scripts/world/local_objects/ManufacturingStationVisualCatalog.gd"
)

@onready var input_buffer_visual: ItemVisualNode = $InputBufferAnchor/InputBufferVisual
@onready var output_buffer_visual: ItemVisualNode = $OutputBufferAnchor/OutputBufferVisual
@onready var npc_position_node: Node3D = $NpcPosition

var _object_id: String = ""

func set_object_id(object_id: String) -> void:
	_object_id = object_id

func get_object_id() -> String:
	return _object_id
	
func get_npc_position_node() -> Node3D:
	return npc_position_node

func apply_snapshot(object_data: Dictionary) -> void:
	var manufacturing_value: Variant = object_data.get("manufacturing", {})
	if typeof(manufacturing_value) != TYPE_DICTIONARY:
		_clear_all_buffer_visuals()
		return

	var manufacturing: Dictionary = manufacturing_value as Dictionary
	var station_kind: String = str(manufacturing.get("station_kind", ""))
	var slot_definitions: Array[Dictionary] = (
		ManufacturingStationVisualCatalog.get_station_buffer_slot_definitions(
			station_kind
		)
	)
	var applied_slot_ids: Dictionary = {}

	for slot_definition in slot_definitions:
		var slot_id: String = str(slot_definition.get("slot_id", ""))
		if slot_id == "":
			continue

		var item_visual: ItemVisualNode = _get_buffer_visual_node(slot_id)
		if item_visual == null:
			continue

		var buffer_key: String = str(slot_definition.get("buffer_key", ""))
		var item_id: String = str(slot_definition.get("item_id", ""))
		var context: String = str(
			slot_definition.get("context", ItemVisualNode.CONTEXT_LOOSE_GROUND)
		)
		var quantity: int = _read_buffer_item_count(
			manufacturing,
			buffer_key,
			item_id
		)

		_apply_buffer_visual(item_visual, item_id, quantity, context)
		applied_slot_ids[slot_id] = true

	_clear_unconfigured_slot_visuals(applied_slot_ids)

func _get_buffer_visual_node(slot_id: String) -> ItemVisualNode:
	match slot_id:
		"INPUT_MAIN":
			return input_buffer_visual
		"OUTPUT_MAIN":
			return output_buffer_visual
		_:
			return null

func _clear_unconfigured_slot_visuals(applied_slot_ids: Dictionary) -> void:
	# Slots that are not configured for the current station kind must be cleared
	# so an old visual never leaks across snapshot changes.
	var known_slot_ids: Array[String] = [
		"INPUT_MAIN",
		"OUTPUT_MAIN"
	]

	for known_slot_id in known_slot_ids:
		if applied_slot_ids.has(known_slot_id):
			continue

		var item_visual: ItemVisualNode = _get_buffer_visual_node(known_slot_id)
		if item_visual == null:
			continue

		item_visual.visible = false
		item_visual.clear_item_visual()

func _clear_all_buffer_visuals() -> void:
	_clear_unconfigured_slot_visuals({})

func _read_buffer_item_count(
	manufacturing: Dictionary,
	buffer_key: String,
	item_id: String
) -> int:
	var buffer_value: Variant = manufacturing.get(buffer_key, {})
	if typeof(buffer_value) != TYPE_DICTIONARY:
		return 0

	var buffer_state: Dictionary = buffer_value as Dictionary
	var item_counts_value: Variant = buffer_state.get("item_counts", {})
	if typeof(item_counts_value) != TYPE_DICTIONARY:
		return 0

	var item_counts: Dictionary = item_counts_value as Dictionary
	return _read_non_negative_whole_number(item_counts.get(item_id, 0))

func _apply_buffer_visual(
	item_visual: ItemVisualNode,
	item_id: String,
	quantity: int,
	context: String
) -> void:
	if item_visual == null:
		return

	if quantity <= 0:
		item_visual.visible = false
		item_visual.clear_item_visual()
		return

	item_visual.visible = true

	# Buffer visuals are presentation-only mirrors of authoritative buffered
	# counts. They are not loose world items and should stay derived from the
	# station snapshot.
	item_visual.apply_item_visual(item_id, quantity, context)

func _read_non_negative_whole_number(value: Variant) -> int:
	if typeof(value) == TYPE_INT:
		var int_value: int = value
		return maxi(0, int_value)

	if typeof(value) == TYPE_FLOAT:
		var float_value: float = value
		return maxi(0, int(round(float_value)))

	return 0
