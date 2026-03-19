extends RefCounted
class_name PlotOrderDefinitions

# PlotOrderDefinitions centralizes client-visible order definitions,
# labels, active-order text, disabled reasons, and readable failure text.
# This keeps HUD.gd from becoming the long-term owner of order definitions.

const ORDER_KIND_SCAVENGING: String = "SCAVENGING"
const ORDER_KIND_SCAVENGING_SINGLE: String = "SCAVENGING_SINGLE"

const ACTION_TYPE_ISSUE_ORDER: String = "ISSUE_ORDER"
const ACTION_TYPE_CANCEL_ACTIVE_ORDER: String = "CANCEL_ACTIVE_ORDER"

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
	var starter_objects_value: Variant = detail.get("starter_objects", [])
	if typeof(starter_objects_value) != TYPE_ARRAY:
		return false

	var starter_objects: Array = starter_objects_value as Array
	for object_value in starter_objects:
		if typeof(object_value) != TYPE_DICTIONARY:
			continue

		var starter_object: Dictionary = object_value as Dictionary
		if str(starter_object.get("kind", "")) == "RUBBLE_4X4":
			return true

	return false
