extends StaticBody3D
class_name DumpZone8x8

# DumpZone8x8 is a presentation-only wrapper for the authoritative starter dump zone.
#
# Responsibilities:
# - render the dump-zone footprint in the owned plot
# - store the authoritative object id for future click/debug expansion
# - react to storage snapshot changes without owning gameplay logic
#
# Important:
# - this script does NOT own inventory rules
# - this script does NOT decide hauling
# - this script only reflects already-synced server state

@onready var fill_level_mesh: MeshInstance3D = $FillLevel
@onready var blocked_marker: MeshInstance3D = $BlockedMarker

var _object_id: String = ""

func _ready() -> void:
	# This object is only visual in this branch.
	# We keep the StaticBody3D root so future branches can attach interaction
	# without changing the scene root type again.
	input_ray_pickable = false

func set_object_id(object_id: String) -> void:
	_object_id = object_id

func get_object_id() -> String:
	return _object_id

func _read_non_negative_whole_number(value: Variant) -> int:
	# Wire-decoded JSON numbers may arrive as either TYPE_INT or TYPE_FLOAT.
	# Dump zone snapshot fields are logically whole numbers, so this helper
	# accepts both and normalizes them to a safe non-negative int.
	if typeof(value) == TYPE_INT:
		var int_value: int = value
		return maxi(0, int_value)

	if typeof(value) == TYPE_FLOAT:
		var float_value: float = value
		return maxi(0, int(round(float_value)))

	return 0

func apply_snapshot(object_data: Dictionary) -> void:
	var storage_value: Variant = object_data.get("storage", null)
	var capacity_used: int = 0
	var capacity_max: int = 0
	var haul_blocked_until_ms: int = 0

	if typeof(storage_value) == TYPE_DICTIONARY:
		var storage: Dictionary = storage_value as Dictionary

		capacity_used = _read_non_negative_whole_number(storage.get("capacity_used", 0))
		capacity_max = _read_non_negative_whole_number(storage.get("capacity_max", 0))
		haul_blocked_until_ms = _read_non_negative_whole_number(
			storage.get("haul_blocked_until_ms", 0)
		)

	var fill_ratio: float = 0.0
	if capacity_max > 0:
		fill_ratio = clampf(float(capacity_used) / float(capacity_max), 0.0, 1.0)

	_apply_fill_ratio(fill_ratio)

	if blocked_marker != null:
		# In this branch we only show whether the dump zone is currently blocked
		# according to the latest snapshot. Exact countdown text comes later in UI.
		blocked_marker.visible = haul_blocked_until_ms > 0

func _apply_fill_ratio(fill_ratio: float) -> void:
	if fill_level_mesh == null:
		return

	var clamped_ratio: float = clampf(fill_ratio, 0.0, 1.0)
	if clamped_ratio <= 0.001:
		fill_level_mesh.visible = false
		return

	fill_level_mesh.visible = true

	# The fill mesh is a 1-meter-tall box. Scaling Y gives us a simple readable
	# storage-level indicator without needing a custom shader or per-item visuals yet.
	fill_level_mesh.scale = Vector3(1.0, clamped_ratio, 1.0)
	fill_level_mesh.position = Vector3(0.0, 0.08 + (0.5 * clamped_ratio), 0.0)
