extends RefCounted
class_name PlotRenderer3D

const PLOT_TILE_SCENE := preload("res://scenes/world/PlotTile3D.tscn")
const TILE_SPACING: float = 1.1

# PlotRenderer3D is responsible only for 3D tile rendering.
# It does not own networking, HUD logic, or server message handling.
#
# Responsibilities:
# - spawn PlotTile3D instances
# - keep a plot_id -> tile lookup
# - update tile visuals when a plot changes
# - rebuild from a full world snapshot
#
# This separation keeps GameWorld3D focused on world state coordination
# instead of becoming a rendering god-object.

var _tiles_root: Node3D = null
var _my_player_id: String = ""
var _tiles_by_plot_id: Dictionary = {}
var _selected_plot_id: String = ""
var _hovered_plot_id: String = ""

func setup(tiles_root: Node3D, my_player_id: String = "") -> void:
	# The renderer needs a stable parent node where all tile instances live.
	_tiles_root = tiles_root
	_my_player_id = my_player_id

func set_my_player_id(player_id: String) -> void:
	# Store the local authenticated player id so tile visuals can distinguish
	# between "mine" and "someone else's".
	_my_player_id = player_id
	_refresh_all_tile_visuals()

func clear_all_tiles() -> void:
	# Remove all previously spawned tile instances.
	# We clear the lookup immediately so future calls do not touch stale nodes.
	for child in _tiles_by_plot_id.values():
		if is_instance_valid(child):
			child.queue_free()

	_tiles_by_plot_id.clear()
	
func set_selected_plot(plot_id: String) -> void:
	# Keep selection centralized here so only one tile is selected at a time.
	_selected_plot_id = plot_id
	_refresh_selection_and_hover()

func set_hovered_plot(plot_id: String) -> void:
	# Hover may be empty when the mouse is over nothing.
	_hovered_plot_id = plot_id
	_refresh_selection_and_hover()

func apply_world(world: Dictionary) -> void:
	# Full authoritative rebuild from the latest server snapshot.
	# This is the simplest and safest path for world_state handling.
	if _tiles_root == null:
		push_error("PlotRenderer3D.setup() must be called before apply_world().")
		return

	clear_all_tiles()

	var plots = world.get("plots", [])
	if typeof(plots) != TYPE_ARRAY:
		return

	for plot in plots:
		if typeof(plot) != TYPE_DICTIONARY:
			continue
		_apply_or_spawn_plot(plot)

func apply_plot_update(plot: Dictionary) -> void:
	# Incremental update path for plot_update and world_patch additions.
	if _tiles_root == null:
		push_error("PlotRenderer3D.setup() must be called before apply_plot_update().")
		return

	if typeof(plot) != TYPE_DICTIONARY:
		return

	_apply_or_spawn_plot(plot)

func _apply_or_spawn_plot(plot: Dictionary) -> void:
	var plot_id := str(plot.get("id", ""))
	if plot_id == "":
		return

	var tile: PlotTile3D = _tiles_by_plot_id.get(plot_id, null)

	# Spawn only if this plot does not already have a tile instance.
	if tile == null or not is_instance_valid(tile):
		tile = PLOT_TILE_SCENE.instantiate() as PlotTile3D
		if tile == null:
			push_error("Failed to instantiate PlotTile3D for plot_id=%s" % plot_id)
			return

		_tiles_root.add_child(tile)
		_tiles_by_plot_id[plot_id] = tile

	# Apply the latest authoritative plot data each time so visuals stay correct.
	tile.apply_plot(plot, _my_player_id)
	tile.position = _grid_to_world(int(plot.get("x", 0)), int(plot.get("y", 0)))

	# Re-apply interaction state after plot data changes so selection/hover
	# do not disappear visually during live updates.
	tile.set_selected(plot_id == _selected_plot_id, _my_player_id)
	tile.set_hovered(plot_id == _hovered_plot_id, _my_player_id)

func _refresh_all_tile_visuals() -> void:
	# Used when local identity becomes known after tiles already exist.
	# Example: world arrived first, welcome/identity arrived slightly later.
	for tile in _tiles_by_plot_id.values():
		if tile is PlotTile3D and is_instance_valid(tile):
			tile.apply_plot(
				{
					"id": tile.plot_id,
					"x": tile.grid_x,
					"y": tile.grid_y,
					"type": tile.plot_type,
					"claimed_by": tile.claimed_by,
					"owner_display_name": tile.owner_display_name,
				},
				_my_player_id
			)
			tile.set_selected(tile.plot_id == _selected_plot_id, _my_player_id)
			tile.set_hovered(tile.plot_id == _hovered_plot_id, _my_player_id)
			
func _refresh_selection_and_hover() -> void:
	for plot_id in _tiles_by_plot_id.keys():
		var tile := _tiles_by_plot_id[plot_id] as PlotTile3D
		if not is_instance_valid(tile):
			continue

		tile.set_selected(plot_id == _selected_plot_id, _my_player_id)
		tile.set_hovered(plot_id == _hovered_plot_id, _my_player_id)
		
func _grid_to_world(grid_x: int, grid_y: int) -> Vector3:
	# M1 maps server grid coordinates onto X/Z in 3D world space.
	# Y remains vertical, so tiles sit on y = 0.
	return Vector3(grid_x * TILE_SPACING, 0.0, grid_y * TILE_SPACING)
