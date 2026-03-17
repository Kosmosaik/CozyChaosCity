extends PanelContainer
class_name BottomActionBar

signal orders_pressed()
signal leave_plot_pressed()

@onready var orders_button: Button = $MarginContainer/HBoxContainer/OrdersButton
@onready var leave_plot_button: Button = $MarginContainer/HBoxContainer/LeavePlotButton

func _ready() -> void:
	hide()
	orders_button.pressed.connect(_on_orders_pressed)
	leave_plot_button.pressed.connect(_on_leave_plot_pressed)

func show_for_player_plot() -> void:
	show()
	orders_button.disabled = false
	leave_plot_button.disabled = false

func hide_bar() -> void:
	hide()
	orders_button.disabled = true
	leave_plot_button.disabled = true

func set_orders_highlighted(is_highlighted: bool) -> void:
	if is_highlighted:
		orders_button.text = "Orders ▲"
	else:
		orders_button.text = "Orders"

func _on_orders_pressed() -> void:
	orders_pressed.emit()

func _on_leave_plot_pressed() -> void:
	leave_plot_pressed.emit()
