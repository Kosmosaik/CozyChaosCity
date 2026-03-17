extends PanelContainer
class_name OrdersMenuPanel

signal order_requested(order_kind: String, target_scope: String)
signal close_requested()

@onready var title_label: Label = $MarginContainer/VBoxContainer/HeaderRow/TitleLabel
@onready var close_button: Button = $MarginContainer/VBoxContainer/HeaderRow/CloseButton
@onready var active_order_value_label: Label = $MarginContainer/VBoxContainer/HBoxContainer/InfoGrid/ActiveOrderValueLabel
@onready var feedback_label: Label = $MarginContainer/VBoxContainer/FeedbackLabel
@onready var orders_list: VBoxContainer = $MarginContainer/VBoxContainer/HBoxContainer/OrdersList

const ORDER_BUTTON_MIN_HEIGHT: float = 30.0
const ORDER_ROW_SEPARATION: int = 2

var _plot_id: String = ""
var _request_in_flight: bool = false
var _button_by_kind: Dictionary = {}
var _hint_by_kind: Dictionary = {}
var _row_by_kind: Dictionary = {}
var _target_scope_by_kind: Dictionary = {}

func _ready() -> void:
	hide()

	# Presentation-only labels should never interfere with real clickable controls.
	title_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	active_order_value_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	feedback_label.mouse_filter = Control.MOUSE_FILTER_IGNORE

	close_button.pressed.connect(_on_close_pressed)
	clear_panel()

func clear_panel() -> void:
	_plot_id = ""
	_request_in_flight = false
	title_label.text = "Orders"
	active_order_value_label.text = "None"
	feedback_label.text = ""
	_clear_order_rows()
	hide()

func show_orders(plot_id: String, active_order_text: String, order_entries: Array) -> void:
	_plot_id = plot_id
	title_label.text = "Orders"
	active_order_value_label.text = active_order_text

	if not _request_in_flight:
		feedback_label.text = ""

	# Update rows in place instead of rebuilding them every refresh.
	# This keeps hover/click stable while authoritative plot updates arrive.
	_sync_order_rows(order_entries)
	show()

func set_feedback_text(text: String) -> void:
	feedback_label.text = text

func set_request_pending(order_kind: String) -> void:
	_request_in_flight = true
	feedback_label.text = "Issuing order..."

	for kind_key in _button_by_kind.keys():
		var button: Button = _button_by_kind[kind_key] as Button
		if button != null:
			button.disabled = true

	for kind_key in _hint_by_kind.keys():
		var hint_label: Label = _hint_by_kind[kind_key] as Label
		if hint_label != null:
			hint_label.text = "Waiting for server..."

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
	_target_scope_by_kind.clear()

func _sync_order_rows(order_entries: Array) -> void:
	var wanted_kinds: Dictionary = {}

	for entry_value in order_entries:
		if typeof(entry_value) != TYPE_DICTIONARY:
			continue

		var entry: Dictionary = entry_value as Dictionary
		var kind: String = str(entry.get("kind", ""))
		if kind == "":
			continue

		wanted_kinds[kind] = true

		if not _row_by_kind.has(kind):
			_create_order_row(kind)

		_update_order_row(kind, entry)

	# Remove rows that are no longer present.
	var existing_kinds: Array = _row_by_kind.keys()
	for existing_kind_value in existing_kinds:
		var existing_kind: String = str(existing_kind_value)
		if wanted_kinds.has(existing_kind):
			continue

		_remove_order_row(existing_kind)

	# Preserve the order provided by HUD so future additional orders render
	# predictably and are easy to reason about.
	for entry_value in order_entries:
		if typeof(entry_value) != TYPE_DICTIONARY:
			continue

		var entry: Dictionary = entry_value as Dictionary
		var kind: String = str(entry.get("kind", ""))
		if kind == "":
			continue

		var row: VBoxContainer = _row_by_kind.get(kind, null) as VBoxContainer
		if row == null:
			continue

		orders_list.move_child(row, orders_list.get_child_count() - 1)

func _create_order_row(order_kind: String) -> void:
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

	_row_by_kind[order_kind] = row
	_button_by_kind[order_kind] = button
	_hint_by_kind[order_kind] = hint_label
	_target_scope_by_kind[order_kind] = "ALL"

	button.pressed.connect(
		func() -> void:
			_on_order_button_pressed(order_kind)
	)

func _update_order_row(order_kind: String, entry: Dictionary) -> void:
	var button: Button = _button_by_kind.get(order_kind, null) as Button
	var hint_label: Label = _hint_by_kind.get(order_kind, null) as Label

	if button == null or hint_label == null:
		return

	var label_text: String = str(entry.get("label", order_kind))
	var disabled_reason: String = str(entry.get("disabled_reason", ""))
	var enabled: bool = bool(entry.get("enabled", false))
	var target_scope: String = str(entry.get("target_scope", "ALL"))

	button.text = label_text
	button.disabled = not enabled or _request_in_flight
	_target_scope_by_kind[order_kind] = target_scope

	if disabled_reason != "":
		hint_label.text = disabled_reason
		hint_label.visible = true
	else:
		hint_label.text = ""
		hint_label.visible = false

func _remove_order_row(order_kind: String) -> void:
	var row: VBoxContainer = _row_by_kind.get(order_kind, null) as VBoxContainer
	if row != null:
		orders_list.remove_child(row)
		row.queue_free()

	_row_by_kind.erase(order_kind)
	_button_by_kind.erase(order_kind)
	_hint_by_kind.erase(order_kind)
	_target_scope_by_kind.erase(order_kind)

func _on_order_button_pressed(order_kind: String) -> void:
	if _plot_id == "":
		return

	var target_scope: String = str(_target_scope_by_kind.get(order_kind, "ALL"))
	order_requested.emit(order_kind, target_scope)

func _on_close_pressed() -> void:
	close_requested.emit()
