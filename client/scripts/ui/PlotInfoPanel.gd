extends PanelContainer
class_name PlotInfoPanel

signal claim_requested(plot_id: String)
signal debug_clear_requested(plot_id: String)

# PlotInfoPanel owns the selected-plot popup UI.
# It displays lightweight plot information and exposes a Claim button
# when the selected plot is a free PLAYER plot.
#
# This panel is intentionally small in M1, but structured so it can grow
# later with population, production, and other per-plot stats.

@onready var title_label: Label = $MarginContainer/VBoxContainer/TitleLabel
@onready var type_value_label: Label = $MarginContainer/VBoxContainer/InfoGrid/TypeValueLabel
@onready var owner_value_label: Label = $MarginContainer/VBoxContainer/InfoGrid/OwnerValueLabel
@onready var claim_button: Button = $MarginContainer/VBoxContainer/ClaimButton
@onready var debug_clear_cell_button: Button = $MarginContainer/VBoxContainer/DebugClearCellButton

var _selected_plot_id: String = ""

func _ready() -> void:
	# Start hidden until the player selects a tile.
	hide()
	claim_button.pressed.connect(_on_claim_pressed)
	debug_clear_cell_button.pressed.connect(_on_debug_clear_pressed)

func clear_panel() -> void:
	# Hide the panel and clear all temporary selection state.
	_selected_plot_id = ""
	title_label.text = "Plot"
	type_value_label.text = "-"
	owner_value_label.text = "-"
	claim_button.visible = false
	claim_button.disabled = true
	debug_clear_cell_button.visible = false
	debug_clear_cell_button.disabled = true
	hide()

func show_plot(plot: Dictionary, is_claimable: bool, is_logged_in: bool, is_owned_by_me: bool) -> void:
	# Display the currently selected plot.
	_selected_plot_id = str(plot.get("id", ""))

	var plot_type := str(plot.get("type", "UNKNOWN"))
	var owner_name := str(plot.get("owner_display_name", ""))

	var raw_claimed_by = plot.get("claimed_by", null)
	var claimed_by := "" if raw_claimed_by == null else str(raw_claimed_by)

	title_label.text = "Plot %s" % _selected_plot_id
	type_value_label.text = plot_type

	if claimed_by == "":
		owner_value_label.text = "Unclaimed"
	else:
		# If the server did not provide a display name for some reason,
		# fall back to the raw owner id so the user still sees something useful.
		owner_value_label.text = owner_name if owner_name != "" else claimed_by

	# The claim button is only shown for free claimable plots.
	claim_button.visible = is_claimable
	claim_button.disabled = not (is_claimable and is_logged_in)

	# Temporary M2 debug button:
	# only show it for the local player's own claimed plot.
	debug_clear_cell_button.visible = is_owned_by_me
	debug_clear_cell_button.disabled = not (is_owned_by_me and is_logged_in)

	show()

func _on_claim_pressed() -> void:
	if _selected_plot_id == "":
		return

	claim_requested.emit(_selected_plot_id)
	
func _on_debug_clear_pressed() -> void:
	if _selected_plot_id == "":
		return

	debug_clear_requested.emit(_selected_plot_id)
