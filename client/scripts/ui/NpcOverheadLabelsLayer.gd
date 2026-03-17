extends Control
class_name NpcOverheadLabelsLayer

# NpcOverheadLabelsLayer renders screen-space labels for world NPCs.
#
# Why this exists:
# - Label3D looked blurry and behaved poorly with zoom/depth.
# - Screen-space Control labels stay crisp.
# - The world renderer still owns NPC positions; this layer only presents them.
#
# This layer does NOT:
# - decide which NPCs exist
# - own selection state
# - query the server
# - calculate gameplay logic

const LABEL_SCENE: PackedScene = preload("res://scenes/ui/NpcOverheadLabel.tscn")

const LABEL_VERTICAL_GAP_PIXELS: float = 4.0

const LABEL_NEAR_DISTANCE: float = 18.0
const LABEL_MID_DISTANCE: float = 34.0

const NAME_FONT_SIZE_NEAR: int = 15
const NAME_FONT_SIZE_MID: int = 13
const NAME_FONT_SIZE_FAR: int = 11

const ACTIVITY_FONT_SIZE_NEAR: int = 12
const ACTIVITY_FONT_SIZE_MID: int = 10
const ACTIVITY_FONT_SIZE_FAR: int = 9

var _label_nodes_by_id: Dictionary = {}

func clear_labels() -> void:
	for node_value in _label_nodes_by_id.values():
		var label_node: Control = node_value as Control
		if label_node != null and is_instance_valid(label_node):
			label_node.queue_free()

	_label_nodes_by_id.clear()

func sync_labels(label_entries: Array) -> void:
	var next_ids: Dictionary = {}

	for entry_value in label_entries:
		if typeof(entry_value) != TYPE_DICTIONARY:
			continue

		var entry: Dictionary = entry_value as Dictionary
		var npc_id: String = str(entry.get("npc_id", ""))
		if npc_id == "":
			continue

		next_ids[npc_id] = true

		var label_node: Control = _label_nodes_by_id.get(npc_id, null) as Control
		if label_node == null or not is_instance_valid(label_node):
			label_node = _make_label_node()
			if label_node == null:
				continue

			_label_nodes_by_id[npc_id] = label_node
			add_child(label_node)

		_apply_entry_to_label(label_node, entry)

	var existing_ids: Array = _label_nodes_by_id.keys()
	for npc_id_value in existing_ids:
		var npc_id: String = str(npc_id_value)
		if next_ids.has(npc_id):
			continue

		var old_node: Control = _label_nodes_by_id.get(npc_id, null) as Control
		if old_node != null and is_instance_valid(old_node):
			old_node.queue_free()

		_label_nodes_by_id.erase(npc_id)

func _make_label_node() -> Control:
	if LABEL_SCENE == null:
		return null

	var instance: Node = LABEL_SCENE.instantiate()
	if instance is Control:
		return instance as Control

	return null

func _apply_distance_font_policy(
	name_label: Label,
	activity_label: Label,
	camera_distance: float
) -> void:
	# Keep labels sharp by changing font sizes in discrete bands instead of
	# scaling the whole Control tree. Scaling UI nodes causes blurred text.
	var name_font_size: int = NAME_FONT_SIZE_FAR
	var activity_font_size: int = ACTIVITY_FONT_SIZE_FAR

	if camera_distance <= LABEL_NEAR_DISTANCE:
		name_font_size = NAME_FONT_SIZE_NEAR
		activity_font_size = ACTIVITY_FONT_SIZE_NEAR
	elif camera_distance <= LABEL_MID_DISTANCE:
		name_font_size = NAME_FONT_SIZE_MID
		activity_font_size = ACTIVITY_FONT_SIZE_MID

	if name_label != null:
		name_label.add_theme_font_size_override("font_size", name_font_size)

	if activity_label != null:
		activity_label.add_theme_font_size_override("font_size", activity_font_size)

func _apply_entry_to_label(label_node: Control, entry: Dictionary) -> void:
	var vbox: VBoxContainer = label_node.get_node_or_null("VBoxContainer") as VBoxContainer
	var name_label: Label = label_node.get_node_or_null("VBoxContainer/NameLabel") as Label
	var activity_label: Label = label_node.get_node_or_null("VBoxContainer/ActivityLabel") as Label

	if name_label != null:
		name_label.text = str(entry.get("name", "NPC"))

	if activity_label != null:
		activity_label.text = str(entry.get("activity", "Idle"))

	var screen_position: Vector2 = entry.get("screen_position", Vector2.ZERO) as Vector2
	var is_visible: bool = bool(entry.get("is_visible", true))
	var camera_distance: float = float(entry.get("camera_distance", LABEL_NEAR_DISTANCE))

	label_node.visible = is_visible
	if not is_visible:
		return

	_apply_distance_font_policy(name_label, activity_label, camera_distance)

	# Measure and size from the actual content container.
	# The overhead label should be centered from the visible text block itself,
	# not from stale root Control editor offsets or deferred frame layout state.
	var content_size: Vector2 = Vector2.ZERO
	if vbox != null:
		content_size = vbox.get_combined_minimum_size()
		vbox.size = content_size

	label_node.size = content_size

	# Center the visible text block horizontally above the projected NPC anchor.
	label_node.position = screen_position - Vector2(
		content_size.x * 0.5,
		content_size.y + LABEL_VERTICAL_GAP_PIXELS
	)
