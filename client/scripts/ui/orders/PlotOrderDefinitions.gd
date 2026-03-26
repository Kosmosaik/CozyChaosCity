extends RefCounted
class_name PlotOrderDefinitions

# PlotOrderDefinitions centralizes client-visible order definitions,
# labels, active-order text, disabled reasons, and readable failure text.
# This keeps HUD.gd from becoming the long-term owner of order definitions.

const ORDER_KIND_SCAVENGING: String = "SCAVENGING"
const ORDER_KIND_SCAVENGING_SINGLE: String = "SCAVENGING_SINGLE"

const ACTION_TYPE_ISSUE_ORDER: String = "ISSUE_ORDER"
const ACTION_TYPE_CANCEL_ACTIVE_ORDER: String = "CANCEL_ACTIVE_ORDER"
const ACTION_TYPE_QUEUE_MANUFACTURING_RECIPE: String = "QUEUE_MANUFACTURING_RECIPE"
const ACTION_TYPE_CLEAR_MANUFACTURING_QUEUE: String = "CLEAR_MANUFACTURING_QUEUE"

const TARGET_SCOPE_ALL: String = "ALL"
const TARGET_SCOPE_SINGLE: String = "SINGLE"

static func build_active_order_text(detail: Dictionary) -> String:
	var active_order_value: Variant = detail.get("active_order", null)
	if typeof(active_order_value) != TYPE_DICTIONARY:
		return "None"

	var active_order: Dictionary = active_order_value as Dictionary
	var kind: String = str(active_order.get("kind", ""))
	if kind == "":
		return "None"

	match kind:
		ORDER_KIND_SCAVENGING:
			return "Scavenge All"
		ORDER_KIND_SCAVENGING_SINGLE:
			return "Scavenge One"
		_:
			return kind.replace("_", " ").capitalize()

static func build_entries(detail: Dictionary) -> Array[PlotOrderMenuEntry]:
	var entries: Array[PlotOrderMenuEntry] = []

	entries.append(_build_scavenge_entry(
		detail,
		"issue_scavenging_all",
		ORDER_KIND_SCAVENGING,
		"Scavenge All",
		TARGET_SCOPE_ALL
	))

	entries.append(_build_scavenge_entry(
		detail,
		"issue_scavenging_single",
		ORDER_KIND_SCAVENGING_SINGLE,
		"Scavenge One",
		TARGET_SCOPE_SINGLE
	))

	var workbench: Dictionary = _find_first_workbench(detail)
	if not workbench.is_empty():
		entries.append(_build_queue_workbench_pallet_entry(workbench))
		entries.append(_build_clear_workbench_queue_entry(workbench))

	return entries

static func has_active_order(detail: Dictionary) -> bool:
	var active_order_value: Variant = detail.get("active_order", null)
	if typeof(active_order_value) != TYPE_DICTIONARY:
		return false

	var active_order: Dictionary = active_order_value as Dictionary
	return str(active_order.get("kind", "")) != ""

static func _build_scavenge_entry(
	detail: Dictionary,
	entry_id: String,
	order_kind: String,
	label: String,
	target_scope: String
) -> PlotOrderMenuEntry:
	# Active-order conflicts should still disable the button for now because the
	# server only supports one active plot order at a time, but we intentionally
	# hide those specific hint texts to keep the menu visually clean.
	if has_active_order(detail):
		return PlotOrderMenuEntry.new(
			entry_id,
			ACTION_TYPE_ISSUE_ORDER,
			order_kind,
			label,
			target_scope,
			false,
			"",
			false
		)

	if not _has_eligible_order_npc(detail, order_kind):
		return PlotOrderMenuEntry.new(
			entry_id,
			ACTION_TYPE_ISSUE_ORDER,
			order_kind,
			label,
			target_scope,
			false,
			"No eligible scavenger is available.",
			true
		)

	if not _has_scavenge_target(detail):
		return PlotOrderMenuEntry.new(
			entry_id,
			ACTION_TYPE_ISSUE_ORDER,
			order_kind,
			label,
			target_scope,
			false,
			"No rubble remains on this plot.",
			true
		)

	return PlotOrderMenuEntry.new(
		entry_id,
		ACTION_TYPE_ISSUE_ORDER,
		order_kind,
		label,
		target_scope,
		true,
		"",
		false
	)

static func _build_queue_workbench_pallet_entry(workbench: Dictionary) -> PlotOrderMenuEntry:
	var workbench_id: String = str(workbench.get("id", ""))
	return PlotOrderMenuEntry.new(
		"queue_workbench_wooden_pallet",
		ACTION_TYPE_QUEUE_MANUFACTURING_RECIPE,
		"WOODEN_PALLET",
		"Queue 1 Wooden Pallet",
		workbench_id,
		true,
		"",
		false
	)

static func _build_clear_workbench_queue_entry(workbench: Dictionary) -> PlotOrderMenuEntry:
	var workbench_id: String = str(workbench.get("id", ""))
	var queue_quantity: int = _get_workbench_queue_quantity(workbench)
	if queue_quantity <= 0:
		return PlotOrderMenuEntry.new(
			"clear_workbench_queue",
			ACTION_TYPE_CLEAR_MANUFACTURING_QUEUE,
			"",
			"Clear Workbench Queue",
			workbench_id,
			false,
			"",
			true
		)

	return PlotOrderMenuEntry.new(
		"clear_workbench_queue",
		ACTION_TYPE_CLEAR_MANUFACTURING_QUEUE,
		"",
		"Clear Workbench Queue (%d queued)" % queue_quantity,
		workbench_id,
		true,
		"",
		false
	)

static func get_failure_text(reason: String) -> String:
	match reason:
		"plot_not_found":
			return "That plot no longer exists."
		"not_player_plot":
			return "Orders can only be issued on player plots."
		"not_plot_owner":
			return "You can only issue orders on your own plot."
		"order_already_active":
			return "Another order is already active on this plot."
		"nothing_to_scavenge":
			return "There is no rubble left to scavenge."
		"no_eligible_npc":
			return "No eligible scavenger is available."
		"no_valid_target":
			return "No valid target was found for that order."
		"invalid_order":
			return "That order is not valid."
		"no_active_order":
			return "There is no active order to cancel."
		"order_rejected":
			return "The order was rejected."
		"station_not_found":
			return "That workbench no longer exists."
		"station_not_manufacturing":
			return "That object can not manufacture items."
		"recipe_not_allowed":
			return "That recipe can not be queued on this station."
		"invalid_quantity":
			return "That manufacturing quantity is invalid."
		"queue_empty":
			return "The workbench queue is already empty."
		"manufacturing_rejected":
			return "The manufacturing request was rejected."
		_:
			return "Order failed: %s" % reason

static func _has_eligible_order_npc(detail: Dictionary, order_kind: String) -> bool:
	var npcs_value: Variant = detail.get("npcs", [])
	if typeof(npcs_value) != TYPE_ARRAY:
		return false

	var npcs: Array = npcs_value as Array
	for npc_value in npcs:
		if typeof(npc_value) != TYPE_DICTIONARY:
			continue

		var npc: Dictionary = npc_value as Dictionary
		var allowed_value: Variant = npc.get("allowed_order_kinds", [])
		if typeof(allowed_value) != TYPE_ARRAY:
			continue

		var allowed_order_kinds: Array = allowed_value as Array
		for allowed_kind_value in allowed_order_kinds:
			if str(allowed_kind_value) == order_kind:
				return true

	return false

static func _has_scavenge_target(detail: Dictionary) -> bool:
	var plot_objects_value: Variant = detail.get("plot_objects", [])
	if typeof(plot_objects_value) != TYPE_ARRAY:
		return false

	var plot_objects: Array = plot_objects_value as Array
	for object_value in plot_objects:
		if typeof(object_value) != TYPE_DICTIONARY:
			continue

		var plot_object: Dictionary = object_value as Dictionary
		if str(plot_object.get("kind", "")) == "RUBBLE_4X4":
			return true

	return false

static func _find_first_workbench(detail: Dictionary) -> Dictionary:
	var plot_objects_value: Variant = detail.get("plot_objects", [])
	if typeof(plot_objects_value) != TYPE_ARRAY:
		return {}

	var plot_objects: Array = plot_objects_value as Array
	for object_value in plot_objects:
		if typeof(object_value) != TYPE_DICTIONARY:
			continue

		var plot_object: Dictionary = object_value as Dictionary
		if str(plot_object.get("kind", "")) == "WORKBENCH_1X2":
			return plot_object

	return {}

static func _get_workbench_queue_quantity(workbench: Dictionary) -> int:
	var manufacturing_value: Variant = workbench.get("manufacturing", {})
	if typeof(manufacturing_value) != TYPE_DICTIONARY:
		return 0

	var manufacturing: Dictionary = manufacturing_value as Dictionary
	var queue_value: Variant = manufacturing.get("queue", [])
	if typeof(queue_value) != TYPE_ARRAY:
		return 0

	var queue: Array = queue_value as Array
	var total_quantity: int = 0
	for entry_value in queue:
		if typeof(entry_value) != TYPE_DICTIONARY:
			continue

		var entry: Dictionary = entry_value as Dictionary
		total_quantity += int(entry.get("quantity", 0))

	return total_quantity
