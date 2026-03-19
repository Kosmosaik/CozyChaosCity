extends PanelContainer
class_name OrdersMenuPanel

signal menu_action_requested(action_type: String, order_kind: String, target_scope: String)
signal cancel_active_order_requested()
signal close_requested()

@onready var title_label: Label = $MarginContainer/VBoxContainer/HeaderRow/TitleLabel
@onready var close_button: Button = $MarginContainer/VBoxContainer/HeaderRow/CloseButton
@onready var active_order_value_label: Label = $MarginContainer/VBoxContainer/HBoxContainer/InfoGrid/ActiveOrderRow/ActiveOrderValueLabel
@onready var cancel_active_order_button: Button = $MarginContainer/VBoxContainer/HBoxContainer/InfoGrid/ActiveOrderRow/CancelActiveOrderButton
@onready var feedback_label: Label = $MarginContainer/VBoxContainer/FeedbackLabel
@onready var orders_list: VBoxContainer = $MarginContainer/VBoxContainer/HBoxContainer/OrdersList

const ORDER_BUTTON_MIN_HEIGHT: float = 30.0
const ORDER_ROW_SEPARATION: int = 2

var _plot_id: String = ""
var _request_in_flight: bool = false
var _button_by_kind: Dictionary = {}
var _hint_by_kind: Dictionary = {}
var _row_by_kind: Dictionary = {}
var _action_type_by_entry_id: Dictionary = {}
var _order_kind_by_entry_id: Dictionary = {}
var _target_scope_by_entry_id: Dictionary = {}
var _has_active_order: bool = false

func _ready() -> void:
	hide()

	# Presentation-only labels should never interfere with real clickable controls.
	title_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	active_order_value_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	feedback_label.mouse_filter = Control.MOUSE_FILTER_IGNORE

	close_button.pressed.connect(_on_close_pressed)
	cancel_active_order_button.pressed.connect(_on_cancel_active_order_pressed)
	clear_panel()

func clear_panel() -> void:
	_plot_id = ""
	_request_in_flight = false
	_has_active_order = false

	title_label.text = "Orders"
	active_order_value_label.text = "None"
	feedback_label.text = ""
	cancel_active_order_button.visible = false
	cancel_active_order_button.disabled = false

	_clear_order_rows()
	hide()

func show_orders(
	plot_id: String,
	active_order_text: String,
	order_entries: Array[PlotOrderMenuEntry]
) -> void:
	_plot_id = plot_id
	title_label.text = "Orders"
	active_order_value_label.text = active_order_text
	_has_active_order = active_order_text != "None"

	# The active-order cancel control is now a dedicated side button instead of
	# a noisy list row. This keeps the list focused on issue-order actions.
	cancel_active_order_button.visible = _has_active_order
	cancel_active_order_button.disabled = _request_in_flight and _has_active_order

	if not _request_in_flight:
		feedback_label.text = ""

	# Update rows in place instead of rebuilding them every refresh.
	# This keeps hover/click stable while authoritative plot updates arrive.
	_sync_order_rows(order_entries)
	show()

func set_feedback_text(text: String) -> void:
	feedback_label.text = text

func set_request_pending(feedback_text: String) -> void:
	# Keep the feedback text visible while a request is in flight, but do not
	# disable the whole order list just because one request was sent.
	# The server is still authoritative, and this keeps the UI closer to the
	# future direction where repeated targeted scavenging requests will be valid.
	_request_in_flight = true
	feedback_label.text = feedback_text

	if _has_active_order:
		cancel_active_order_button.disabled = true

func show_request_result(success_text: String, error_text: String, was_success: bool) -> void:
	_request_in_flight = false

	if was_success:
		feedback_label.text = success_text
	else:
		feedback_label.text = error_text

func _clear_order_rows() -> void:
	var children: Array = orders_list.get_children()
	for child_value in children:
		var child: Node = child_value as Node
		if child == null:
			continue

		orders_list.remove_child(child)
		child.queue_free()

	_button_by_kind.clear()
	_hint_by_kind.clear()
	_row_by_kind.clear()
	_action_type_by_entry_id.clear()
	_order_kind_by_entry_id.clear()
	_target_scope_by_entry_id.clear()

func _sync_order_rows(order_entries: Array[PlotOrderMenuEntry]) -> void:
	var wanted_kinds: Dictionary = {}

	for entry in order_entries:
		if entry == null:
			continue

		var entry_id: String = entry.entry_id
		if entry_id == "":
			continue

		wanted_kinds[entry_id] = true

		if not _row_by_kind.has(entry_id):
			_create_order_row(entry_id)

		_update_order_row(entry)

	var existing_kinds: Array = _row_by_kind.keys()
	for existing_kind_value in existing_kinds:
		var existing_kind: String = str(existing_kind_value)
		if wanted_kinds.has(existing_kind):
			continue

		_remove_order_row(existing_kind)

	for entry in order_entries:
		if entry == null:
			continue

		var row: VBoxContainer = _row_by_kind.get(entry.entry_id, null) as VBoxContainer
		if row == null:
			continue

		orders_list.move_child(row, orders_list.get_child_count() - 1)

func _create_order_row(entry_id: String) -> void:
	var row: VBoxContainer = VBoxContainer.new()
	row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_theme_constant_override("separation", ORDER_ROW_SEPARATION)
	orders_list.add_child(row)

	var button: Button = Button.new()
	button.name = "ActionButton"
	button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	button.size_flags_vertical = 0
	button.custom_minimum_size = Vector2(0.0, ORDER_BUTTON_MIN_HEIGHT)
	button.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	row.add_child(button)

	var hint_label: Label = Label.new()
	hint_label.name = "HintLabel"
	hint_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hint_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	hint_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hint_label.visible = false
	row.add_child(hint_label)

	_row_by_kind[entry_id] = row
	_button_by_kind[entry_id] = button
	_hint_by_kind[entry_id] = hint_label
	_target_scope_by_entry_id[entry_id] = "ALL"
	_action_type_by_entry_id[entry_id] = PlotOrderDefinitions.ACTION_TYPE_ISSUE_ORDER
	_order_kind_by_entry_id[entry_id] = ""

	button.pressed.connect(
		func() -> void:
			_on_order_button_pressed(entry_id)
	)

func _update_order_row(entry: PlotOrderMenuEntry) -> void:
	if entry == null:
		return

	var button: Button = _button_by_kind.get(entry.entry_id, null) as Button
	var hint_label: Label = _hint_by_kind.get(entry.entry_id, null) as Label

	if button == null or hint_label == null:
		return

	button.text = entry.label
	button.disabled = not entry.enabled
	_action_type_by_entry_id[entry.entry_id] = entry.action_type
	_order_kind_by_entry_id[entry.entry_id] = entry.order_kind
	_target_scope_by_entry_id[entry.entry_id] = entry.target_scope

	if entry.show_disabled_reason and entry.disabled_reason != "":
		hint_label.text = entry.disabled_reason
		hint_label.visible = true
	else:
		hint_label.text = ""
		hint_label.visible = false

func _remove_order_row(entry_id: String) -> void:
	var row: VBoxContainer = _row_by_kind.get(entry_id, null) as VBoxContainer
	if row != null:
		orders_list.remove_child(row)
		row.queue_free()

	_row_by_kind.erase(entry_id)
	_button_by_kind.erase(entry_id)
	_hint_by_kind.erase(entry_id)
	_action_type_by_entry_id.erase(entry_id)
	_order_kind_by_entry_id.erase(entry_id)
	_target_scope_by_entry_id.erase(entry_id)

func _on_order_button_pressed(entry_id: String) -> void:
	if _plot_id == "":
		return

	var action_type: String = str(
		_action_type_by_entry_id.get(
			entry_id,
			PlotOrderDefinitions.ACTION_TYPE_ISSUE_ORDER
		)
	)
	var order_kind: String = str(_order_kind_by_entry_id.get(entry_id, ""))
	var target_scope: String = str(_target_scope_by_entry_id.get(entry_id, "ALL"))

	menu_action_requested.emit(action_type, order_kind, target_scope)
	
func _on_cancel_active_order_pressed() -> void:
	if not _has_active_order:
		return

	cancel_active_order_requested.emit()

func _on_close_pressed() -> void:
	close_requested.emit()
