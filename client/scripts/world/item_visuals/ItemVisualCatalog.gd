extends RefCounted
class_name ItemVisualCatalog

# ItemVisualCatalog is the single configuration surface for item visual mapping.
#
# Change this file when you want to:
# - swap one item to a different wrapper scene
# - add a 2x / 3x / 4x loose-ground variant
# - add a new item visual without touching gameplay scripts
#
# Keep this file data-only. The registry resolves lookup/fallback behavior.

const ITEM_VISUAL_DEFINITIONS: Dictionary = {
	"SCRAP_WOOD": {
		"carry_scene_path": "res://scenes/items/Scrap_Wood/ScrapWoodItemVisual.tscn",
		"loose_ground_variant_scene_paths": {
			1: "res://scenes/items/Scrap_Wood/ScrapWoodItemVisual.tscn",
			2: "res://scenes/items/Scrap_Wood/ScrapWood_2_ItemVisual.tscn",
			3: "res://scenes/items/Scrap_Wood/ScrapWood_3_ItemVisual.tscn",
			4: "res://scenes/items/Scrap_Wood/ScrapWood_4_ItemVisual.tscn"
			# Later example:
			# 2: "res://scenes/items/ScrapWoodItemVisual_2x.tscn"
		}
	},
	"SCRAP_METAL": {
		"carry_scene_path": "res://scenes/items/Scrap_Metal/ScrapMetalItemVisual.tscn",
		"loose_ground_variant_scene_paths": {
			1: "res://scenes/items/Scrap_Metal/ScrapMetalItemVisual.tscn",
			2: "res://scenes/items/Scrap_Metal/ScrapMetal_2_ItemVisual.tscn",
			3: "res://scenes/items/Scrap_Metal/ScrapMetal_3_ItemVisual.tscn",
			4: "res://scenes/items/Scrap_Metal/ScrapMetal_4_ItemVisual.tscn"
		}
	},
	"MIXED_SALVAGE": {
		"carry_scene_path": "res://scenes/items/Mixed_Salvage/MixedSalvageItemVisual.tscn",
		"loose_ground_variant_scene_paths": {
			1: "res://scenes/items/Mixed_Salvage/MixedSalvageItemVisual.tscn",
			2: "res://scenes/items/Mixed_Salvage/MixedSalvage_2_ItemVisual.tscn",
			3: "res://scenes/items/Mixed_Salvage/MixedSalvage_3_ItemVisual.tscn",
			4: "res://scenes/items/Mixed_Salvage/MixedSalvage_4_ItemVisual.tscn"
		}
	},
	"WOODEN_PALLET": {
		"carry_scene_path": "res://scenes/items/wooden_pallet.tscn",
		"loose_ground_variant_scene_paths": {
			1: "res://scenes/items/wooden_pallet.tscn"
		}
	}
	# TARP intentionally stays on placeholder fallback until a wrapper scene exists.
}

static func get_item_visual_definition(item_id: String) -> Dictionary:
	var definition_value: Variant = ITEM_VISUAL_DEFINITIONS.get(item_id, null)
	if typeof(definition_value) != TYPE_DICTIONARY:
		return {}

	return definition_value as Dictionary
