extends PanelContainer
class_name PlotDebugOverlay

# PlotDebugOverlay is a lightweight developer-only panel.
# It summarizes active owned-plot simulation data at a glance so system bugs
# can be spotted without clicking through multiple NPCs manually.
#
# This is intentionally presentation-only:
# - it does not own gameplay logic
# - it does not mutate plot state
# - it only formats already-synced client detail data
#
# Important layout note:
# The scene gives this overlay an initial position/width, but the panel height
# must be recalculated when the text changes. Otherwise the label can grow
# beyond the panel background after reopen or after switching between short and
# long debug text states.

@onready var scroll_container: ScrollContainer = $ScrollContainer
@onready var margin_container: MarginContainer = $ScrollContainer/MarginContainer
@onready var debug_label: Label = $ScrollContainer/MarginContainer/DebugLabel

var _debug_enabled: bool = false
var _base_width: float = 0.0

func _ready() -> void:
	# The debug overlay should capture mouse input while hovered so wheel events
	# do not leak through to the gameplay camera underneath.
	mouse_filter = Control.MOUSE_FILTER_STOP

	if scroll_container != null:
		scroll_container.mouse_filter = Control.MOUSE_FILTER_PASS

	# The debug label is display-only and should never interfere with input.
	if debug_label != null:
		debug_label.mouse_filter = Control.MOUSE_FILTER_IGNORE

	# Keep the width stable based on the scene layout, then let the script resize
	# the height to fit the current text content.
	_base_width = size.x
	if _base_width <= 0.0:
		_base_width = 360.0

	clear_panel()

func set_debug_enabled(enabled: bool) -> void:
	_debug_enabled = enabled

	if not _debug_enabled:
		hide()
		return

	show()

func is_debug_enabled() -> bool:
	return _debug_enabled

func clear_panel() -> void:
	_set_debug_text("Plot Debug\nNo active plot.")

	if _debug_enabled:
		show()
	else:
		hide()

func show_plot_debug(plot_id: String, detail: Dictionary) -> void:
	if not _debug_enabled:
		return

	var active_order_text: String = _build_active_order_text(detail)
	var rubble_count: int = _count_rubble_targets(detail)
	var jobs_value: Variant = detail.get("jobs", [])
	var npcs_value: Variant = detail.get("npcs", [])

	var jobs: Array = []
	if typeof(jobs_value) == TYPE_ARRAY:
		jobs = jobs_value as Array

	var npcs: Array = []
	if typeof(npcs_value) == TYPE_ARRAY:
		npcs = npcs_value as Array

	var queued_jobs: int = _count_jobs_by_status(jobs, "queued")
	var reserved_jobs: int = _count_jobs_by_status(jobs, "reserved")
	var in_progress_jobs: int = _count_jobs_by_status(jobs, "in_progress")
	var blocked_jobs: int = _count_jobs_by_status(jobs, "blocked")
	var completed_jobs: int = _count_jobs_by_status(jobs, "completed")
	var cancelled_jobs: int = _count_jobs_by_status(jobs, "cancelled")

	var idle_npcs: int = _count_npcs_by_state(npcs, "idle")
	var moving_npcs: int = _count_npcs_by_state(npcs, "moving_to_target")
	var working_npcs: int = _count_npcs_by_state(npcs, "working")
	var carrying_npcs: int = _count_npcs_by_state(npcs, "carrying_to_dropoff")
	var dropping_off_npcs: int = _count_npcs_by_state(npcs, "dropping_off")
	var returning_npcs: int = _count_npcs_by_state(npcs, "returning")

	var dump_zone_text: String = _build_dump_zone_summary_text(detail)
	var loose_items_text: String = _build_loose_items_summary_text(detail)
	var reservation_text: String = _build_loose_item_reservations_summary_text(detail)
	var carried_items_text: String = _build_carried_items_summary_text(npcs)
	var haul_targets_text: String = _build_haul_targets_summary_text(npcs)
	var haul_jobs_text: String = _build_haul_jobs_summary_text(jobs)

	var text: String = (
		"Plot Debug"
		+ "\nPlot: " + plot_id
		+ "\nActive Order: " + active_order_text
		+ "\nRubble Targets: " + str(rubble_count)
		+ "\n"
		+ "\nJobs"
		+ "\n- Total: " + str(jobs.size())
		+ "\n- Queued: " + str(queued_jobs)
		+ "\n- Reserved: " + str(reserved_jobs)
		+ "\n- In Progress: " + str(in_progress_jobs)
		+ "\n- Blocked: " + str(blocked_jobs)
		+ "\n- Completed: " + str(completed_jobs)
		+ "\n- Cancelled: " + str(cancelled_jobs)
		+ "\n"
		+ "\nHaul Jobs"
		+ haul_jobs_text
		+ "\n"
		+ "\nNPCs"
		+ "\n- Total: " + str(npcs.size())
		+ "\n- Idle: " + str(idle_npcs)
		+ "\n- Moving: " + str(moving_npcs)
		+ "\n- Working: " + str(working_npcs)
		+ "\n- Carrying: " + str(carrying_npcs)
		+ "\n- Dropping Off: " + str(dropping_off_npcs)
		+ "\n- Returning: " + str(returning_npcs)
		+ "\n"
		+ "\nDump Zone"
		+ dump_zone_text
		+ "\n"
		+ "\nLoose Items"
		+ loose_items_text
		+ "\n"
		+ "\nLoose Item Reservations"
		+ reservation_text
		+ "\n"
		+ "\nCarried Items"
		+ carried_items_text
		+ "\n"
		+ "\nHaul Targets"
		+ haul_targets_text
	)

	_set_debug_text(text)
	show()

func _set_debug_text(text: String) -> void:
	if debug_label == null or margin_container == null or scroll_container == null:
		return

	debug_label.text = text

	# Keep a stable overlay width.
	size.x = _base_width

	var left_margin: int = margin_container.get_theme_constant("margin_left")
	var right_margin: int = margin_container.get_theme_constant("margin_right")
	var top_margin: int = margin_container.get_theme_constant("margin_top")
	var bottom_margin: int = margin_container.get_theme_constant("margin_bottom")

	var content_width: float = _base_width - float(left_margin + right_margin)
	if content_width < 32.0:
		content_width = 32.0

	# Let the label compute the full content height for this fixed width.
	debug_label.custom_minimum_size = Vector2(content_width, 0.0)
	debug_label.reset_size()

	var label_min_size: Vector2 = debug_label.get_combined_minimum_size()
	var desired_height: float = label_min_size.y + float(top_margin + bottom_margin)

	# Keep the panel on-screen and let the ScrollContainer handle overflow.
	var viewport_height: float = get_viewport_rect().size.y
	var available_height: float = viewport_height - position.y - 16.0
	if available_height < 140.0:
		available_height = 140.0

	var final_height: float = minf(desired_height, available_height)

	size.y = final_height
	custom_minimum_size = Vector2(_base_width, final_height)
	
func _gui_input(event: InputEvent) -> void:
	# The overlay refreshes often, so we explicitly consume wheel input here.
	# This prevents camera zoom from triggering while the cursor is over the
	# debug panel and guarantees the scroll container moves instead.
	if scroll_container == null:
		return

	if event is InputEventMouseButton:
		var mouse_button_event: InputEventMouseButton = event as InputEventMouseButton
		if not mouse_button_event.pressed:
			return

		match mouse_button_event.button_index:
			MOUSE_BUTTON_WHEEL_UP:
				scroll_container.scroll_vertical = maxi(
					0,
					scroll_container.scroll_vertical - 48
				)
				accept_event()

			MOUSE_BUTTON_WHEEL_DOWN:
				var v_scroll_bar: VScrollBar = scroll_container.get_v_scroll_bar()
				var max_scroll: int = 0
				if v_scroll_bar != null:
					max_scroll = int(round(v_scroll_bar.max_value))

				scroll_container.scroll_vertical = mini(
					max_scroll,
					scroll_container.scroll_vertical + 48
				)
				accept_event()

func _build_active_order_text(detail: Dictionary) -> String:
	var active_order_value: Variant = detail.get("active_order", null)
	if typeof(active_order_value) != TYPE_DICTIONARY:
		return "None"

	var active_order: Dictionary = active_order_value as Dictionary
	var kind: String = str(active_order.get("kind", ""))
	if kind == "":
		return "None"

	if kind == "SCAVENGING":
		return "Scavenging"

	if kind == "SCAVENGING_SINGLE":
		return "Scavenge One"

	return kind.replace("_", " ").capitalize()

func _count_rubble_targets(detail: Dictionary) -> int:
	var count: int = 0
	var plot_objects_value: Variant = detail.get("plot_objects", [])
	if typeof(plot_objects_value) != TYPE_ARRAY:
		return count

	var plot_objects: Array = plot_objects_value as Array
	for object_value in plot_objects:
		if typeof(object_value) != TYPE_DICTIONARY:
			continue

		var plot_object: Dictionary = object_value as Dictionary
		if str(plot_object.get("kind", "")) == "RUBBLE_4X4":
			count += 1

	return count

func _build_dump_zone_summary_text(detail: Dictionary) -> String:
	var dump_zone_storage: Dictionary = _get_dump_zone_storage(detail)
	if dump_zone_storage.is_empty():
		return "\n- Present: No"

	var capacity_used: int = _read_non_negative_whole_number(
		dump_zone_storage.get("capacity_used", 0)
	)
	var capacity_max: int = _read_non_negative_whole_number(
		dump_zone_storage.get("capacity_max", 0)
	)

	var item_counts: Dictionary = _read_item_counts_dictionary(
		dump_zone_storage.get("item_counts", {})
	)
	var total_units: int = _sum_item_counts(item_counts)
	var distinct_types: int = _count_distinct_positive_item_types(item_counts)

	var blocked_until_ms: int = _read_non_negative_whole_number(
		dump_zone_storage.get("haul_blocked_until_ms", 0)
	)
	var retry_block_text: String = "No"
	if blocked_until_ms > 0:
		var now_ms: int = int(round(Time.get_unix_time_from_system() * 1000.0))
		var remaining_ms: int = maxi(0, blocked_until_ms - now_ms)
		if remaining_ms > 0:
			var remaining_seconds: int = int(ceil(float(remaining_ms) / 1000.0))
			retry_block_text = "Yes (" + str(remaining_seconds) + "s)"
		else:
			retry_block_text = "No"

	return (
		"\n- Present: Yes"
		+ "\n- Fill: " + str(capacity_used) + " / " + str(capacity_max)
		+ "\n- Stored Units: " + str(total_units)
		+ "\n- Stored Types: " + str(distinct_types)
		+ "\n- Retry Block: " + retry_block_text
		+ "\n- Items: " + _format_item_counts(item_counts)
	)

func _build_loose_items_summary_text(detail: Dictionary) -> String:
	var loose_items_value: Variant = detail.get("loose_items", [])
	if typeof(loose_items_value) != TYPE_ARRAY:
		return "\n- Stacks: 0\n- Units: 0\n- Types: 0\n- Items: None"

	var loose_items: Array = loose_items_value as Array
	var total_units: int = 0
	var item_counts: Dictionary = {}

	for loose_item_value in loose_items:
		if typeof(loose_item_value) != TYPE_DICTIONARY:
			continue

		var loose_item: Dictionary = loose_item_value as Dictionary
		var item_id: String = str(loose_item.get("item_id", ""))
		var quantity: int = _read_non_negative_whole_number(loose_item.get("quantity", 0))
		if item_id == "" or quantity <= 0:
			continue

		total_units += quantity

		var previous_count: int = _read_non_negative_whole_number(item_counts.get(item_id, 0))
		item_counts[item_id] = previous_count + quantity

	return (
		"\n- Stacks: " + str(loose_items.size())
		+ "\n- Units: " + str(total_units)
		+ "\n- Types: " + str(_count_distinct_positive_item_types(item_counts))
		+ "\n- Items: " + _format_item_counts(item_counts)
	)

func _build_carried_items_summary_text(npcs: Array) -> String:
	var carrier_npcs: int = 0
	var total_units: int = 0
	var item_counts: Dictionary = {}

	for npc_value in npcs:
		if typeof(npc_value) != TYPE_DICTIONARY:
			continue

		var npc: Dictionary = npc_value as Dictionary
		var carry_slots_value: Variant = npc.get("carry_slots", [])
		if typeof(carry_slots_value) != TYPE_ARRAY:
			continue

		var carry_slots: Array = carry_slots_value as Array
		var npc_has_carried_item: bool = false

		for carry_slot_value in carry_slots:
			if typeof(carry_slot_value) != TYPE_DICTIONARY:
				continue

			var carry_slot: Dictionary = carry_slot_value as Dictionary
			var item_id: String = str(carry_slot.get("item_id", ""))
			var quantity: int = _read_non_negative_whole_number(carry_slot.get("quantity", 0))
			if item_id == "" or quantity <= 0:
				continue

			npc_has_carried_item = true
			total_units += quantity

			var previous_count: int = _read_non_negative_whole_number(item_counts.get(item_id, 0))
			item_counts[item_id] = previous_count + quantity

		if npc_has_carried_item:
			carrier_npcs += 1

	return (
		"\n- Carrier NPCs: " + str(carrier_npcs)
		+ "\n- Units: " + str(total_units)
		+ "\n- Types: " + str(_count_distinct_positive_item_types(item_counts))
		+ "\n- Items: " + _format_item_counts(item_counts)
	)

func _build_haul_targets_summary_text(npcs: Array) -> String:
	var dump_zone_npcs: int = 0
	var ground_npcs: int = 0
	var none_npcs: int = 0
	var other_npcs: int = 0

	for npc_value in npcs:
		if typeof(npc_value) != TYPE_DICTIONARY:
			continue

		var npc: Dictionary = npc_value as Dictionary
		var haul_target_mode_variant: Variant = npc.get("haul_target_mode", null)

		if haul_target_mode_variant == null:
			none_npcs += 1
			continue

		var haul_target_mode: String = str(haul_target_mode_variant)
		if haul_target_mode == "":
			none_npcs += 1
			continue

		match haul_target_mode:
			"DUMP_ZONE":
				dump_zone_npcs += 1
			"GROUND":
				ground_npcs += 1
			_:
				other_npcs += 1

	return (
		"\n- Dump Zone: " + str(dump_zone_npcs)
		+ "\n- Ground: " + str(ground_npcs)
		+ "\n- None: " + str(none_npcs)
		+ "\n- Other: " + str(other_npcs)
	)

# Branch 2 hauling debug helpers:
# These keep the F3 overlay useful while we expand the logistics system.
# They are presentation-only and intentionally read the already-synced
# client detail payload without mutating any state.
func _build_haul_jobs_summary_text(jobs: Array) -> String:
	var total_haul_jobs: int = 0
	var queued_haul_jobs: int = 0
	var reserved_haul_jobs: int = 0
	var in_progress_haul_jobs: int = 0
	var blocked_haul_jobs: int = 0
	var completed_haul_jobs: int = 0
	var cancelled_haul_jobs: int = 0

	var dump_zone_jobs: int = 0
	var ground_jobs: int = 0
	var none_jobs: int = 0
	var other_jobs: int = 0

	var reason_counts: Dictionary = {}

	for job_value in jobs:
		if typeof(job_value) != TYPE_DICTIONARY:
			continue

		var job: Dictionary = job_value as Dictionary
		var job_kind: String = str(job.get("kind", ""))
		if job_kind != "HAUL_LOOSE_ITEM" and job_kind != "HAUL_MANUFACTURING_OUTPUT":
			continue

		total_haul_jobs += 1

		var status_name: String = str(job.get("status", ""))
		match status_name:
			"queued":
				queued_haul_jobs += 1
			"reserved":
				reserved_haul_jobs += 1
			"in_progress":
				in_progress_haul_jobs += 1
			"blocked":
				blocked_haul_jobs += 1
			"completed":
				completed_haul_jobs += 1
			"cancelled":
				cancelled_haul_jobs += 1

		var destination_mode: String = str(job.get("haul_destination_mode", ""))
		match destination_mode:
			"DUMP_ZONE":
				dump_zone_jobs += 1
			"GROUND":
				ground_jobs += 1
			"":
				none_jobs += 1
			_:
				other_jobs += 1

		var reason_code: String = str(job.get("blocked_reason", ""))
		if reason_code != "":
			var previous_count: int = _read_non_negative_whole_number(
				reason_counts.get(reason_code, 0)
			)
			reason_counts[reason_code] = previous_count + 1

	return (
		"\n- Total: " + str(total_haul_jobs)
		+ "\n- Queued: " + str(queued_haul_jobs)
		+ "\n- Reserved: " + str(reserved_haul_jobs)
		+ "\n- In Progress: " + str(in_progress_haul_jobs)
		+ "\n- Blocked: " + str(blocked_haul_jobs)
		+ "\n- Completed: " + str(completed_haul_jobs)
		+ "\n- Cancelled: " + str(cancelled_haul_jobs)
		+ "\n- Destinations: Dump Zone " + str(dump_zone_jobs)
		+ ", Ground " + str(ground_jobs)
		+ ", None " + str(none_jobs)
		+ ", Other " + str(other_jobs)
		+ "\n- Reasons: " + _format_reason_counts(reason_counts)
	)

func _build_loose_item_reservations_summary_text(detail: Dictionary) -> String:
	var loose_items_value: Variant = detail.get("loose_items", [])
	if typeof(loose_items_value) != TYPE_ARRAY:
		return "\n- Reserved Stacks: 0\n- Reserved Units: 0\n- Reserved NPCs: 0\n- Reserved Items: None"

	var loose_items: Array = loose_items_value as Array
	var reserved_stack_count: int = 0
	var reserved_units: int = 0
	var reserved_npc_ids: Dictionary = {}
	var reserved_item_counts: Dictionary = {}

	for loose_item_value in loose_items:
		if typeof(loose_item_value) != TYPE_DICTIONARY:
			continue

		var loose_item: Dictionary = loose_item_value as Dictionary
		var item_id: String = str(loose_item.get("item_id", ""))

		var reservations_value: Variant = loose_item.get("reservations", [])
		if typeof(reservations_value) != TYPE_ARRAY:
			continue

		var reservations: Array = reservations_value as Array
		var stack_reserved_units: int = 0

		for reservation_value in reservations:
			if typeof(reservation_value) != TYPE_DICTIONARY:
				continue

			var reservation: Dictionary = reservation_value as Dictionary
			var quantity: int = _read_non_negative_whole_number(
				reservation.get("quantity", 0)
			)
			if quantity <= 0:
				continue

			stack_reserved_units += quantity

			var npc_id: String = str(reservation.get("npc_id", ""))
			if npc_id != "":
				reserved_npc_ids[npc_id] = true

		if stack_reserved_units <= 0:
			continue

		reserved_stack_count += 1
		reserved_units += stack_reserved_units

		if item_id != "":
			var previous_item_count: int = _read_non_negative_whole_number(
				reserved_item_counts.get(item_id, 0)
			)
			reserved_item_counts[item_id] = previous_item_count + stack_reserved_units

	return (
		"\n- Reserved Stacks: " + str(reserved_stack_count)
		+ "\n- Reserved Units: " + str(reserved_units)
		+ "\n- Reserved NPCs: " + str(reserved_npc_ids.size())
		+ "\n- Reserved Items: " + _format_item_counts(reserved_item_counts)
	)

func _format_reason_counts(reason_counts: Dictionary) -> String:
	if reason_counts.is_empty():
		return "None"

	var parts: Array[String] = []
	var ordered_reason_codes: Array = [
		"no_valid_destination",
		"reservation_failed",
		"source_missing",
		"source_quantity_reduced",
		"pickup_failed"
	]

	for ordered_reason_code_variant in ordered_reason_codes:
		var ordered_reason_code: String = str(ordered_reason_code_variant)
		if not reason_counts.has(ordered_reason_code):
			continue

		var ordered_reason_count: int = _read_non_negative_whole_number(
			reason_counts.get(ordered_reason_code, 0)
		)
		if ordered_reason_count <= 0:
			continue

		parts.append(
			_format_reason_name(ordered_reason_code) + ": " + str(ordered_reason_count)
		)

	var extra_reason_codes: Array = reason_counts.keys()
	extra_reason_codes.sort()

	for extra_reason_code_variant in extra_reason_codes:
		var extra_reason_code: String = str(extra_reason_code_variant)
		if ordered_reason_codes.has(extra_reason_code):
			continue

		var extra_reason_count: int = _read_non_negative_whole_number(
			reason_counts.get(extra_reason_code, 0)
		)
		if extra_reason_count <= 0:
			continue

		parts.append(
			_format_reason_name(extra_reason_code) + ": " + str(extra_reason_count)
		)

	if parts.is_empty():
		return "None"

	return ", ".join(parts)

func _format_reason_name(reason_code: String) -> String:
	match reason_code:
		"no_valid_destination":
			return "No valid destination"
		"reservation_failed":
			return "Reservation failed"
		"source_missing":
			return "Source missing"
		"source_quantity_reduced":
			return "Source quantity reduced"
		"pickup_failed":
			return "Pickup failed"
		_:
			return reason_code.replace("_", " ").capitalize()

func _get_dump_zone_storage(detail: Dictionary) -> Dictionary:
	var plot_objects_value: Variant = detail.get("plot_objects", [])
	if typeof(plot_objects_value) != TYPE_ARRAY:
		return {}

	var plot_objects: Array = plot_objects_value as Array
	for plot_object_value in plot_objects:
		if typeof(plot_object_value) != TYPE_DICTIONARY:
			continue

		var plot_object: Dictionary = plot_object_value as Dictionary
		if str(plot_object.get("kind", "")) != "DUMP_ZONE_8X8":
			continue

		var storage_value: Variant = plot_object.get("storage", null)
		if typeof(storage_value) != TYPE_DICTIONARY:
			return {}

		return storage_value as Dictionary

	return {}

func _read_item_counts_dictionary(item_counts_variant: Variant) -> Dictionary:
	if typeof(item_counts_variant) != TYPE_DICTIONARY:
		return {}

	return item_counts_variant as Dictionary

func _sum_item_counts(item_counts: Dictionary) -> int:
	var total: int = 0

	for key_variant in item_counts.keys():
		total += _read_non_negative_whole_number(item_counts.get(key_variant, 0))

	return total

func _count_distinct_positive_item_types(item_counts: Dictionary) -> int:
	var count: int = 0

	for key_variant in item_counts.keys():
		var item_count: int = _read_non_negative_whole_number(item_counts.get(key_variant, 0))
		if item_count > 0:
			count += 1

	return count

func _format_item_counts(item_counts: Dictionary) -> String:
	if item_counts.is_empty():
		return "None"

	var parts: Array[String] = []
	var ordered_item_ids: Array = [
		"SCRAP_WOOD",
		"SCRAP_METAL",
		"TARP",
		"MIXED_SALVAGE",
		"WOODEN_PALLET"
	]

	for ordered_item_id_variant in ordered_item_ids:
		var ordered_item_id: String = str(ordered_item_id_variant)
		if not item_counts.has(ordered_item_id):
			continue

		var ordered_item_count: int = _read_non_negative_whole_number(
			item_counts.get(ordered_item_id, 0)
		)
		if ordered_item_count <= 0:
			continue

		parts.append(_format_item_name(ordered_item_id) + ": " + str(ordered_item_count))

	var extra_item_ids: Array = item_counts.keys()
	extra_item_ids.sort()

	for extra_item_id_variant in extra_item_ids:
		var extra_item_id: String = str(extra_item_id_variant)
		if ordered_item_ids.has(extra_item_id):
			continue

		var extra_item_count: int = _read_non_negative_whole_number(
			item_counts.get(extra_item_id, 0)
		)
		if extra_item_count <= 0:
			continue

		parts.append(_format_item_name(extra_item_id) + ": " + str(extra_item_count))

	if parts.is_empty():
		return "None"

	return ", ".join(parts)

func _format_item_name(item_id: String) -> String:
	match item_id:
		"SCRAP_WOOD":
			return "Scrap Wood"
		"SCRAP_METAL":
			return "Scrap Metal"
		"TARP":
			return "Tarp"
		"MIXED_SALVAGE":
			return "Mixed Salvage"
		"WOODEN_PALLET":
			return "Wooden Pallet"
		_:
			return item_id.replace("_", " ").capitalize()

func _read_non_negative_whole_number(value: Variant) -> int:
	# Wire-decoded numeric fields may arrive as either int or float.
	# The overlay only needs safe display values, so normalize them here.
	if typeof(value) == TYPE_INT:
		var int_value: int = value
		return maxi(0, int_value)

	if typeof(value) == TYPE_FLOAT:
		var float_value: float = value
		return maxi(0, int(round(float_value)))

	return 0

func _count_jobs_by_status(jobs: Array, status_name: String) -> int:
	var count: int = 0

	for job_value in jobs:
		if typeof(job_value) != TYPE_DICTIONARY:
			continue

		var job: Dictionary = job_value as Dictionary
		if str(job.get("status", "")) == status_name:
			count += 1

	return count

func _count_npcs_by_state(npcs: Array, state_name: String) -> int:
	var count: int = 0

	for npc_value in npcs:
		if typeof(npc_value) != TYPE_DICTIONARY:
			continue

		var npc: Dictionary = npc_value as Dictionary
		if str(npc.get("state", "")) == state_name:
			count += 1

	return count
