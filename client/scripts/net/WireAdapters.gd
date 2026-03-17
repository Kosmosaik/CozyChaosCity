extends RefCounted
class_name WireAdapters

static func normalize_detail_from_wire(detail: Dictionary) -> Dictionary:
	var normalized := detail.duplicate(true)

	if normalized.has("cells"):
		return normalized

	var raw_rows = normalized.get("cell_rows", null)
	if typeof(raw_rows) != TYPE_ARRAY:
		return normalized

	var width = int(normalized.get("width", 0))
	var height = int(normalized.get("height", 0))
	var cells: Array = []

	for y in range(min(height, raw_rows.size())):
		var row_text := str(raw_rows[y])

		for x in range(min(width, row_text.length())):
			var ch := row_text.substr(x, 1)

			if ch == "R":
				cells.append({
					"x": x,
					"y": y,
					"blocked": true,
					"clearable": true,
					"terrain": "RUBBLE",
				})
			else:
				cells.append({
					"x": x,
					"y": y,
					"blocked": false,
					"clearable": false,
					"terrain": "GROUND",
				})

	normalized["cells"] = cells
	return normalized

static func normalize_plot_from_wire(plot: Dictionary) -> Dictionary:
	var normalized := plot.duplicate(true)

	var raw_detail = normalized.get("detail", null)
	if typeof(raw_detail) == TYPE_DICTIONARY and not raw_detail.is_empty():
		normalized["detail"] = normalize_detail_from_wire(raw_detail)

	return normalized

static func normalize_world_from_wire(world: Dictionary) -> Dictionary:
	var normalized := world.duplicate(true)

	var raw_plots = normalized.get("plots", null)
	if typeof(raw_plots) != TYPE_ARRAY:
		return normalized

	var plots: Array = []
	for raw_plot in raw_plots:
		if typeof(raw_plot) == TYPE_DICTIONARY:
			plots.append(normalize_plot_from_wire(raw_plot))
		else:
			plots.append(raw_plot)

	normalized["plots"] = plots
	return normalized

static func normalize_patch_from_wire(patch: Dictionary) -> Dictionary:
	var normalized := patch.duplicate(true)

	var raw_added = normalized.get("added", null)
	if typeof(raw_added) == TYPE_ARRAY:
		var added: Array = []
		for raw_plot in raw_added:
			if typeof(raw_plot) == TYPE_DICTIONARY:
				added.append(normalize_plot_from_wire(raw_plot))
			else:
				added.append(raw_plot)
		normalized["added"] = added

	return normalized
