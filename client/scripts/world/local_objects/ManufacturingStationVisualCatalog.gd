extends RefCounted
class_name ManufacturingStationVisualCatalog

# ManufacturingStationVisualCatalog keeps station-specific visual buffer mapping
# out of the wrapper node script.
#
# The wrapper should only know:
# - how to read the authoritative manufacturing snapshot
# - how to apply one buffer item visual to one visual slot
#
# It should not grow a pile of recipe-specific if/else branches every time a new
# station or recipe is added.

const STATION_BUFFER_SLOT_DEFINITIONS: Dictionary = {
	"WORKBENCH": [
		{
			"slot_id": "INPUT_MAIN",
			"buffer_key": "input_buffer",
			"item_id": "SCRAP_WOOD",
			"context": "loose_ground"
		},
		{
			"slot_id": "OUTPUT_MAIN",
			"buffer_key": "output_buffer",
			"item_id": "WOODEN_PALLET",
			"context": "loose_ground"
		}
	]
}

static func get_station_buffer_slot_definitions(
	station_kind: String
) -> Array[Dictionary]:
	var definitions_value: Variant = STATION_BUFFER_SLOT_DEFINITIONS.get(
		station_kind,
		[]
	)
	if typeof(definitions_value) != TYPE_ARRAY:
		return []

	var definitions: Array = definitions_value as Array
	var result: Array[Dictionary] = []

	for definition_value in definitions:
		if typeof(definition_value) != TYPE_DICTIONARY:
			continue

		var definition: Dictionary = definition_value as Dictionary
		result.append(definition.duplicate(true))

	return result
