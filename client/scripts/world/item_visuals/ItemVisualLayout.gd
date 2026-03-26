extends RefCounted
class_name ItemVisualLayout

# ItemVisualLayout centralizes how repeated loose-item visuals are laid out on one tile.
#
# Responsibilities:
# - keep quantity presentation out of actor/world scripts
# - return stable per-item offsets for loose ground rendering
# - make it easy to adjust spacing later without rewriting item logic

static func get_loose_ground_unit_offsets(quantity: int) -> Array:
	var offsets: Array = []

	var safe_quantity: int = maxi(1, quantity)
	var columns: int = 1

	if safe_quantity <= 1:
		columns = 1
	elif safe_quantity <= 4:
		columns = 2
	else:
		columns = 3

	var spacing: float = 0.26
	var rows: int = int(ceil(float(safe_quantity) / float(columns)))
	var total_width: float = float(columns - 1) * spacing
	var total_depth: float = float(rows - 1) * spacing

	for index in range(safe_quantity):
		var column: int = index % columns
		var row: int = int(index / columns)

		offsets.append(
			Vector3(
				(float(column) * spacing) - (total_width * 0.5),
				0.0,
				(float(row) * spacing) - (total_depth * 0.5)
			)
		)

	return offsets
