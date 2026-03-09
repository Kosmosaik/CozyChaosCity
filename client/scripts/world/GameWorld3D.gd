extends Node3D
class_name GameWorld3D

# GameWorld3D owns client-side world state and coordinates the 3D world.
# Rendering is delegated to PlotRenderer3D so this script stays focused on
# world data flow instead of tile instancing details.

signal plot_selected(plot: Dictionary, is_claimable: bool)

@onready var camera_rig: Node3D = $CameraRig
@onready var camera_3d: Camera3D = $CameraRig/YawPivot/PitchPivot/Camera3D
@onready var sun_light: DirectionalLight3D = $SunLight
@onready var tiles_root: Node3D = $TilesRoot
@onready var ground: MeshInstance3D = $Ground

var my_player_id: String = ""
var world_state: Dictionary = {}
var plots_by_id: Dictionary = {}
var plot_renderer: PlotRenderer3D = null
var tile_picker: TilePicker3D = null
var selected_plot_id: String = ""
var hovered_plot_id: String = ""

func set_my_player_id(player_id: String) -> void:
	# Stores the authenticated player id so tile visuals can know
	# which claimed plots belong to the local player.
	my_player_id = player_id

	# The renderer may already have spawned tiles before identity arrived.
	# Refresh those visuals so "mine" vs "taken" colors become correct.
	if plot_renderer != null:
		plot_renderer.set_my_player_id(player_id)

func set_world(world: Dictionary) -> void:
	# Replace the current world snapshot with the latest full snapshot
	# received from the server.
	world_state = world.duplicate(true)
	_rebuild_plot_index()

	# Render the authoritative snapshot in 3D.
	if plot_renderer != null:
		plot_renderer.apply_world(world_state)
		
	# Keep popup/UI state aligned with the latest authoritative world snapshot.
	if selected_plot_id != "" and not plots_by_id.has(selected_plot_id):
		selected_plot_id = ""
		if plot_renderer != null:
			plot_renderer.set_selected_plot("")
	_emit_selected_plot_state()

func apply_plot_update(plot: Dictionary) -> void:
	# Update one plot inside our local world cache.
	var plot_id := str(plot.get("id", ""))
	if plot_id == "":
		return

	var plot_copy := plot.duplicate(true)
	plots_by_id[plot_id] = plot_copy

	var plots: Array = world_state.get("plots", [])
	var replaced := false

	for i in range(plots.size()):
		var existing: Dictionary = plots[i]
		if str(existing.get("id", "")) == plot_id:
			plots[i] = plot_copy
			replaced = true
			break

	if not replaced:
		plots.append(plot_copy)

	world_state["plots"] = plots

	# Update or spawn the corresponding 3D tile.
	if plot_renderer != null:
		plot_renderer.apply_plot_update(plot_copy)
		
	# If the selected plot changed on the server, refresh the popup/HUD state.
	if selected_plot_id == plot_id:
		_emit_selected_plot_state()

func apply_world_patch(patch: Dictionary) -> void:
	# The real server currently sends:
	#   { added: [...], world_version: number }
	#
	# We merge each added plot through the normal single-plot path so both:
	# - local world cache
	# - 3D renderer
	# stay in sync through one code path.
	var added_plots = patch.get("added", null)
	if typeof(added_plots) == TYPE_ARRAY:
		for p in added_plots:
			if typeof(p) == TYPE_DICTIONARY:
				apply_plot_update(p)

	# Keep the cached world version aligned with the server if provided.
	if patch.has("world_version"):
		world_state["version"] = int(patch.get("world_version", world_state.get("version", 0)))
		
func _is_plot_claimable(plot: Dictionary) -> bool:
	# A plot is claimable only if:
	# - it is a PLAYER tile
	# - it is currently unclaimed
	if str(plot.get("type", "")) != "PLAYER":
		return false

	var raw_claimed_by = plot.get("claimed_by", null)
	var claimed_by := "" if raw_claimed_by == null else str(raw_claimed_by)
	return claimed_by == ""

func refresh_selected_plot_ui() -> void:
	_emit_selected_plot_state()

func _emit_selected_plot_state() -> void:
	if selected_plot_id == "":
		plot_selected.emit({}, false)
		return

	var plot: Dictionary = plots_by_id.get(selected_plot_id, {})
	if plot.is_empty():
		plot_selected.emit({}, false)
		return

	plot_selected.emit(plot.duplicate(true), _is_plot_claimable(plot))
	
func _on_tile_hovered(plot_id: String) -> void:
	hovered_plot_id = plot_id

	if plot_renderer != null:
		plot_renderer.set_hovered_plot(hovered_plot_id)

func _on_tile_clicked(plot_id: String) -> void:
	selected_plot_id = plot_id

	if plot_renderer != null:
		plot_renderer.set_selected_plot(selected_plot_id)

	_emit_selected_plot_state()
	
func set_world_enabled(enabled: bool) -> void:
	# This gates all world interaction during the login/menu phase.
	# When disabled:
	# - the 3D world is hidden
	# - camera movement/zoom/rotation stop
	# - tile picking stops
	# - hover/selection are cleared so HUD popup hides cleanly
	visible = enabled

	if camera_rig != null:
		camera_rig.set_process(enabled)
		camera_rig.set_process_unhandled_input(enabled)

	if tile_picker != null:
		tile_picker.set_process_unhandled_input(enabled)

	if camera_3d != null:
		camera_3d.current = enabled

	if not enabled:
		hovered_plot_id = ""
		selected_plot_id = ""

		if plot_renderer != null:
			plot_renderer.set_hovered_plot("")
			plot_renderer.set_selected_plot("")

		_emit_selected_plot_state()

func _rebuild_plot_index() -> void:
	plots_by_id.clear()

	var plots: Array = world_state.get("plots", [])
	for p in plots:
		if typeof(p) != TYPE_DICTIONARY:
			continue

		var plot_id := str(p.get("id", ""))
		if plot_id == "":
			continue

		plots_by_id[plot_id] = p.duplicate(true)

func _ready() -> void:
	# This scene is now the real runtime 3D world entry point.
	print("GameWorld3D ready: 3D world shell loaded.")

	# Create the modular renderer once and let it own all tile instances.
	plot_renderer = PlotRenderer3D.new()
	plot_renderer.setup(tiles_root, my_player_id)

	# Create the picker once and let it emit clean tile interaction events.
	tile_picker = TilePicker3D.new()
	tile_picker.name = "TilePicker3D"
	add_child(tile_picker)
	tile_picker.setup(camera_3d)
	tile_picker.tile_hovered.connect(_on_tile_hovered)
	tile_picker.tile_clicked.connect(_on_tile_clicked)

	# If HUD/NetClient already delivered world data before _ready finished,
	# render that cached snapshot now.
	if not world_state.is_empty():
		plot_renderer.apply_world(world_state)

	# Start disabled until the login/menu flow enables the world.
	set_world_enabled(false)
	
