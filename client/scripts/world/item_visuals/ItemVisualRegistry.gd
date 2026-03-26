extends RefCounted
class_name ItemVisualRegistry

# ItemVisualRegistry resolves item visual scenes from the data-only catalog.
#
# Responsibilities:
# - keep item_id/context/quantity lookup logic out of actor/world scripts
# - cache loaded PackedScenes
# - provide graceful fallback when an exact loose-ground quantity variant
#   does not exist yet
#
# Fallback order for loose-ground visuals:
# 1. exact quantity variant
# 2. nearest lower quantity variant
# 3. carry scene
# 4. placeholder path in ItemVisualNode

static var _scene_cache_by_path: Dictionary = {}

static func get_item_visual_scene_path(item_id: String, context: String, quantity: int) -> String:
	var item_definition: Dictionary = ItemVisualCatalog.get_item_visual_definition(item_id)
	if item_definition.is_empty():
		return ""

	match context:
		"loose_ground":
			return _resolve_loose_ground_scene_path(item_definition, quantity)
		_:
			return str(item_definition.get("carry_scene_path", ""))

static func get_scene_by_path(scene_path: String) -> PackedScene:
	if scene_path == "":
		return null

	if _scene_cache_by_path.has(scene_path):
		var cached_value: Variant = _scene_cache_by_path.get(scene_path, null)
		if cached_value is PackedScene:
			return cached_value as PackedScene

	var loaded_resource: Resource = load(scene_path)
	if loaded_resource is PackedScene:
		var packed_scene: PackedScene = loaded_resource as PackedScene
		_scene_cache_by_path[scene_path] = packed_scene
		return packed_scene

	return null

static func get_item_visual_scene(item_id: String, context: String, quantity: int) -> PackedScene:
	var scene_path: String = get_item_visual_scene_path(item_id, context, quantity)
	return get_scene_by_path(scene_path)

static func _resolve_loose_ground_scene_path(item_definition: Dictionary, quantity: int) -> String:
	var variant_paths_value: Variant = item_definition.get("loose_ground_variant_scene_paths", null)
	if typeof(variant_paths_value) == TYPE_DICTIONARY:
		var variant_paths: Dictionary = variant_paths_value as Dictionary
		var safe_quantity: int = maxi(1, quantity)

		for candidate_quantity in range(safe_quantity, 0, -1):
			if variant_paths.has(candidate_quantity):
				return str(variant_paths.get(candidate_quantity, ""))

	return str(item_definition.get("carry_scene_path", ""))
