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

@onready var margin_container: MarginContainer = $MarginContainer
@onready var debug_label: Label = $MarginContainer/DebugLabel

var _debug_enabled: bool = false
var _base_width: float = 0.0

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE

	# The debug label is display-only and should never interfere with input.
	if debug_label != null:
		debug_label.mouse_filter = Control.MOUSE_FILTER_IGNORE

	# Keep the width stable based on the scene layout, then let the script resize
	# the height to fit the current text content.
	_base_width = size.x
	if _base_width <= 0.0:
		_base_width = 260.0

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
		+ "\nNPCs"
		+ "\n- Total: " + str(npcs.size())
		+ "\n- Idle: " + str(idle_npcs)
		+ "\n- Moving: " + str(moving_npcs)
		+ "\n- Working: " + str(working_npcs)
		+ "\n- Carrying: " + str(carrying_npcs)
		+ "\n- Dropping Off: " + str(dropping_off_npcs)
		+ "\n- Returning: " + str(returning_npcs)
	)

	_set_debug_text(text)
	show()

func _set_debug_text(text: String) -> void:
	if debug_label == null or margin_container == null:
		return

	debug_label.text = text

	# Keep a stable overlay width and recompute only the height.
	# This prevents the label from overflowing outside the panel when the text
	# becomes longer after the overlay was previously showing a short message.
	size.x = _base_width

	var left_margin: int = margin_container.get_theme_constant("margin_left")
	var right_margin: int = margin_container.get_theme_constant("margin_right")
	var top_margin: int = margin_container.get_theme_constant("margin_top")
	var bottom_margin: int = margin_container.get_theme_constant("margin_bottom")

	var content_width: float = _base_width - float(left_margin + right_margin)
	if content_width < 32.0:
		content_width = 32.0

	# Give the autowrapping label the actual usable width, then ask it for its
	# minimum height for that width.
	debug_label.custom_minimum_size = Vector2(content_width, 0.0)
	debug_label.reset_size()

	var label_min_size: Vector2 = debug_label.get_combined_minimum_size()
	var total_height: float = label_min_size.y + float(top_margin + bottom_margin)

	size.y = total_height
	custom_minimum_size = Vector2(_base_width, total_height)

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
