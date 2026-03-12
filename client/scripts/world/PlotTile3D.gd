extends StaticBody3D
class_name PlotTile3D

# PlotTile3D owns one visible/clickable tile in the 3D world.
# This script intentionally focuses on tile-local state + visuals only.
# It does not know about networking, HUD, or world spawning rules.

@onready var visual: MeshInstance3D = $Visual

var plot_id: String = ""
var grid_x: int = 0
var grid_y: int = 0
var plot_type: String = "PLAYER"
var claimed_by: String = ""
var owner_display_name: String = ""

var _is_selected: bool = false
var _is_hovered: bool = false

func _ready() -> void:
	# Ensure the tile has its own material instance so visual changes on one tile
	# do not accidentally affect every other instanced tile.
	if visual.material_override == null:
		visual.material_override = StandardMaterial3D.new()
	else:
		visual.material_override = visual.material_override.duplicate()

	_refresh_visual()

func apply_plot(plot: Dictionary, my_player_id: String = "") -> void:
	# Store the raw plot fields that matter for M1 visuals.
	# We keep this tile API narrow and self-contained.
	plot_id = str(plot.get("id", ""))
	grid_x = int(plot.get("x", 0))
	grid_y = int(plot.get("y", 0))
	plot_type = str(plot.get("type", "PLAYER"))

	var raw_claimed_by = plot.get("claimed_by", null)
	claimed_by = "" if raw_claimed_by == null else str(raw_claimed_by)

	owner_display_name = str(plot.get("owner_display_name", ""))

	# We pass my_player_id in so the tile can decide whether it should render as MINE.
	_refresh_visual(my_player_id)

func set_selected(is_selected: bool, my_player_id: String = "") -> void:
	_is_selected = is_selected
	_refresh_visual(my_player_id)

func set_hovered(is_hovered: bool, my_player_id: String = "") -> void:
	_is_hovered = is_hovered
	_refresh_visual(my_player_id)

func _refresh_visual(my_player_id: String = "") -> void:
	var material := visual.material_override as StandardMaterial3D
	if material == null:
		return

	# Base color rules for M1:
	# - RESOURCE = warm stone/soil tone
	# - PLAYER free = light green
	# - PLAYER taken by me = blue
	# - PLAYER taken by someone else = red
	#
	# Selection and hover add simple roughness/emission tweaks for visibility.
	if plot_type == "RESOURCE":
		material.albedo_color = Color(0.89, 0.79, 0.222, 1.0)
	elif claimed_by == "":
		material.albedo_color = Color(0.886, 0.7, 0.803, 1.0)
	elif claimed_by == my_player_id:
		material.albedo_color = Color(0.35, 0.58, 0.88)
	else:
		material.albedo_color = Color(0.851, 0.417, 0.128, 1.0)

	# Keep a fairly matte look by default.
	material.roughness = 0.95
	material.metallic = 0.0
	material.emission_enabled = false

	# Hover and selection are intentionally subtle here.
	# We are proving the rendering pipeline first, not polishing UX yet.
	if _is_hovered:
		material.emission_enabled = true
		material.emission = material.albedo_color * 0.35

	if _is_selected:
		material.emission_enabled = true
		material.emission = material.albedo_color * 0.60
		material.roughness = 0.75
