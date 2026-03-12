extends Node3D
class_name GameWorld3D

# GameWorld3D owns client-side world state and coordinates the 3D world.
# Rendering is delegated to PlotRenderer3D so this script stays focused on
# world data flow instead of tile instancing details.

signal plot_selected(plot: Dictionary, is_claimable: bool)
signal view_mode_changed(mode_name: String, active_plot_id: String)

@onready var camera_rig: CameraRigBasic = $CameraRig
@onready var camera_3d: Camera3D = $CameraRig/YawPivot/PitchPivot/Camera3D
@onready var sun_light: DirectionalLight3D = $SunLight
@onready var tiles_root: Node3D = $TilesRoot
@onready var owned_plot_root: Node3D = $OwnedPlotRoot
@onready var transition_audio_player: AudioStreamPlayer = $TransitionAudioPlayer
@onready var ground: MeshInstance3D = $Ground

var my_player_id: String = ""
var world_state: Dictionary = {}
var plots_by_id: Dictionary = {}
var plot_renderer: PlotRenderer3D = null
var tile_picker: TilePicker3D = null

var owned_plot_renderer: OwnedPlotDetailRenderer3D = null

var current_view_mode: String = "WORLD"
var active_player_plot_id: String = ""
var _is_view_transition_running: bool = false

var _saved_world_camera_position: Vector3 = Vector3.ZERO
var _saved_world_zoom_distance: float = 14.0
var _saved_world_pitch_degrees: float = -45.0

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
	if current_view_mode != "WORLD":
		return
	hovered_plot_id = plot_id

	if plot_renderer != null:
		plot_renderer.set_hovered_plot(hovered_plot_id)

func _on_tile_clicked(plot_id: String) -> void:
	if current_view_mode != "WORLD":
		return
	selected_plot_id = plot_id

	if plot_renderer != null:
		plot_renderer.set_selected_plot(selected_plot_id)

	_emit_selected_plot_state()

func enter_player_plot_mode(plot_id: String) -> bool:
	# This first M2 slice only allows entering your own claimed PLAYER plot,
	# using the already-cached plot.detail data from the regular world snapshot.
	if _is_view_transition_running:
		return false

	if current_view_mode != "WORLD":
		return false

	var plot: Dictionary = plots_by_id.get(plot_id, {})
	if plot.is_empty():
		return false

	if str(plot.get("type", "")) != "PLAYER":
		return false

	var raw_claimed_by = plot.get("claimed_by", null)
	var claimed_by := "" if raw_claimed_by == null else str(raw_claimed_by)
	if claimed_by == "" or claimed_by != my_player_id:
		return false

	var detail = plot.get("detail", null)
	if typeof(detail) != TYPE_DICTIONARY or detail.is_empty():
		return false

	_saved_world_camera_position = camera_rig.global_position
	_saved_world_zoom_distance = camera_rig.get_zoom_distance()
	_saved_world_pitch_degrees = camera_rig.get_pitch_degrees()

	current_view_mode = "PLAYER_PLOT"
	active_player_plot_id = plot_id
	_is_view_transition_running = true

	# Stop normal world interaction while entering local mode.
	camera_rig.set_controls_locked(true)
	tile_picker.set_process_unhandled_input(false)

	hovered_plot_id = ""
	if plot_renderer != null:
		plot_renderer.set_hovered_plot("")

	# Render the local plot exactly at the same world position as the macro tile.
	# This keeps the mode transition feeling like a zoom-in instead of a teleport.
	owned_plot_root.position = _grid_to_world(
		int(plot.get("x", 0)),
		int(plot.get("y", 0))
	)
	owned_plot_renderer.show_plot_detail(plot)
	owned_plot_root.visible = true
	tiles_root.visible = false

	_play_transition_swoosh()

	var detail_width := int(detail.get("width", 0))
	var detail_height := int(detail.get("height", 0))
	var local_plot_span := float(max(detail_width, detail_height))

	# Fit the camera to the actual local plot size instead of the old mini test board.
	# This keeps Player Plot mode usable as we move to real meter-based lots.
	var target_zoom_distance = max(local_plot_span * 0.95, 18.0)

	var tween := camera_rig.tween_to_state(
		_grid_to_world(int(plot.get("x", 0)), int(plot.get("y", 0))),
		target_zoom_distance,
		-62.0,
		0.35
	)
	tween.finished.connect(_on_enter_player_plot_mode_finished, CONNECT_ONE_SHOT)

	view_mode_changed.emit(current_view_mode, active_player_plot_id)
	return true

func exit_player_plot_mode() -> bool:
	if _is_view_transition_running:
		return false

	if current_view_mode != "PLAYER_PLOT":
		return false

	_is_view_transition_running = true

	# Swap back to macro rendering before the reverse tween so it feels like
	# we are pulling back out into the existing shared world.
	owned_plot_root.visible = false
	tiles_root.visible = true

	_play_transition_swoosh()

	var tween := camera_rig.tween_to_state(
		_saved_world_camera_position,
		_saved_world_zoom_distance,
		_saved_world_pitch_degrees,
		0.35
	)
	tween.finished.connect(_on_exit_player_plot_mode_finished, CONNECT_ONE_SHOT)

	return true

func get_view_mode() -> String:
	return current_view_mode

func _on_enter_player_plot_mode_finished() -> void:
	_is_view_transition_running = false
	# Remain input-locked for the world map while in local mode.
	# We only unlock those controls again when returning to world mode.
	pass

func _on_exit_player_plot_mode_finished() -> void:
	current_view_mode = "WORLD"
	active_player_plot_id = ""
	_is_view_transition_running = false

	camera_rig.set_controls_locked(false)
	tile_picker.set_process_unhandled_input(true)

	view_mode_changed.emit(current_view_mode, active_player_plot_id)
	_emit_selected_plot_state()

func _play_transition_swoosh() -> void:
	# This is a sound hook only.
	# If no stream is assigned yet in the editor, the transition still works silently.
	if transition_audio_player == null:
		return

	if transition_audio_player.stream == null:
		return

	transition_audio_player.stop()
	transition_audio_player.play()

func _grid_to_world(grid_x: int, grid_y: int) -> Vector3:
	return Vector3(
		grid_x * PlotRenderer3D.TILE_SPACING,
		0.0,
		grid_y * PlotRenderer3D.TILE_SPACING
	)

func set_world_enabled(enabled: bool) -> void:
	# This gates all world interaction during the login/menu phase.
	# When disabled:
	# - the 3D world is hidden
	# - camera movement/zoom/rotation stop
	# - tile picking stops
	# - hover/selection are cleared so HUD popup hides cleanly
	visible = enabled
	if not enabled:
		current_view_mode = "WORLD"
		active_player_plot_id = ""
		_is_view_transition_running = false

		tiles_root.visible = true
		owned_plot_root.visible = false

		if camera_rig != null:
			camera_rig.set_controls_locked(false)

		view_mode_changed.emit(current_view_mode, active_player_plot_id)

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
	owned_plot_renderer = OwnedPlotDetailRenderer3D.new()
	owned_plot_renderer.setup(owned_plot_root)
	owned_plot_root.visible = false

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
	
