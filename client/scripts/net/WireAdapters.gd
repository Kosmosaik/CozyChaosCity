extends RefCounted
class_name WireAdapters

static func normalize_detail_from_wire(
	detail: Dictionary,
	server_time_ms: int = 0,
	received_local_ms: int = 0
) -> Dictionary:
	var normalized: Dictionary = detail.duplicate(true)

	# This metadata is client-only. It does not become authoritative gameplay
	# state; it only tells the renderer when this snapshot was authored on the
	# server and when it arrived on this client.
	normalized["_snapshot_server_time_ms"] = server_time_ms
	normalized["_received_local_ms"] = received_local_ms

	if normalized.has("cells"):
		return normalized

	var raw_rows: Variant = normalized.get("cell_rows", null)
	if typeof(raw_rows) != TYPE_ARRAY:
		return normalized

	var width: int = int(normalized.get("width", 0))
	var height: int = int(normalized.get("height", 0))
	var cells: Array = []
	var raw_rows_array: Array = raw_rows as Array

	for y in range(min(height, raw_rows_array.size())):
		var row_text: String = str(raw_rows_array[y])

		for x in range(min(width, row_text.length())):
			var ch: String = row_text.substr(x, 1)

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

static func normalize_plot_from_wire(
	plot: Dictionary,
	server_time_ms: int = 0,
	received_local_ms: int = 0
) -> Dictionary:
	var normalized: Dictionary = plot.duplicate(true)

	var raw_detail: Variant = normalized.get("detail", null)
	if typeof(raw_detail) == TYPE_DICTIONARY and not raw_detail.is_empty():
		normalized["detail"] = normalize_detail_from_wire(
			raw_detail as Dictionary,
			server_time_ms,
			received_local_ms
		)

	return normalized

static func normalize_world_from_wire(
	world: Dictionary,
	server_time_ms: int = 0,
	received_local_ms: int = 0
) -> Dictionary:
	var normalized: Dictionary = world.duplicate(true)

	var raw_plots: Variant = normalized.get("plots", null)
	if typeof(raw_plots) != TYPE_ARRAY:
		return normalized

	var plots: Array = []
	var raw_plots_array: Array = raw_plots as Array

	for raw_plot in raw_plots_array:
		if typeof(raw_plot) == TYPE_DICTIONARY:
			plots.append(
				normalize_plot_from_wire(
					raw_plot as Dictionary,
					server_time_ms,
					received_local_ms
				)
			)
		else:
			plots.append(raw_plot)

	normalized["plots"] = plots
	return normalized

static func normalize_patch_from_wire(
	patch: Dictionary,
	server_time_ms: int = 0,
	received_local_ms: int = 0
) -> Dictionary:
	var normalized: Dictionary = patch.duplicate(true)

	var raw_added: Variant = normalized.get("added", null)
	if typeof(raw_added) == TYPE_ARRAY:
		var added: Array = []
		var raw_added_array: Array = raw_added as Array

		for raw_plot in raw_added_array:
			if typeof(raw_plot) == TYPE_DICTIONARY:
				added.append(
					normalize_plot_from_wire(
						raw_plot as Dictionary,
						server_time_ms,
						received_local_ms
					)
				)
			else:
				added.append(raw_plot)

		normalized["added"] = added

	return normalized
