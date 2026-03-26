extends Node3D
class_name LooseItemStack

# LooseItemStack is a presentation-only visual for one authoritative loose-item record.
#
# Responsibilities:
# - render one ground stack at the synced tile position
# - react to item id / quantity changes
# - stay lightweight and fully client-passive
#
# Important:
# - no pickup logic here
# - no merge logic here
# - no gameplay ownership here

@onready var item_visual: ItemVisualNode = $ItemVisual

var _record_id: String = ""

func set_record_id(record_id: String) -> void:
	_record_id = record_id

func get_record_id() -> String:
	return _record_id

func apply_snapshot(loose_item_data: Dictionary) -> void:
	var item_id: String = str(loose_item_data.get("item_id", "UNKNOWN"))
	var quantity: int = _read_non_negative_whole_number(loose_item_data.get("quantity", 0))

	_apply_visual(item_id, quantity)

func _apply_visual(item_id: String, quantity: int) -> void:
	if item_visual == null:
		return

	if quantity <= 0:
		item_visual.visible = false
		item_visual.clear_item_visual()
		return

	item_visual.visible = true
	item_visual.apply_item_visual(
		item_id,
		quantity,
		ItemVisualNode.CONTEXT_LOOSE_GROUND
	)

func _read_non_negative_whole_number(value: Variant) -> int:
	# Wire-decoded JSON numbers may arrive as either TYPE_INT or TYPE_FLOAT.
	# Loose-item quantities are whole numbers, so normalize safely here.
	if typeof(value) == TYPE_INT:
		var int_value: int = value
		return maxi(0, int_value)

	if typeof(value) == TYPE_FLOAT:
		var float_value: float = value
		return maxi(0, int(round(float_value)))

	return 0
