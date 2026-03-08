extends Node3D
class_name GameWorld3D

const PLOT_TILE_SCENE := preload("res://scenes/world/PlotTile3D.tscn")
const TEST_TILE_SPACING: float = 1.1

# World3D is the root controller for the 3D game world.
# Step 1 keeps this script intentionally small:
# - it owns references to the camera rig and future tile parent
# - it does NOT talk to NetClient yet
# - it does NOT contain tile spawning logic yet
#
# Why this exists now:
# We want the 3D world to have a permanent owner from day one,
# instead of letting HUD or Main grow into a god-object later.

@onready var camera_rig: Node3D = $CameraRig
@onready var camera_3d: Camera3D = $CameraRig/YawPivot/PitchPivot/Camera3D
@onready var sun_light: DirectionalLight3D = $SunLight
@onready var tiles_root: Node3D = $TilesRoot
@onready var ground: MeshInstance3D = $Ground

var my_player_id: String = ""
var world_state: Dictionary = {}
var plots_by_id: Dictionary = {}

func set_my_player_id(player_id: String) -> void:
	# Stores the authenticated player id so future tile visuals can know
	# which claimed plots belong to the local player.
	my_player_id = player_id

func set_world(world: Dictionary) -> void:
	# Replace the current world snapshot with the latest full snapshot
	# received from the server.
	world_state = world.duplicate(true)
	_rebuild_plot_index()

func apply_plot_update(plot: Dictionary) -> void:
	# Update one plot inside our local world cache.
	var plot_id := str(plot.get("id", ""))
	if plot_id == "":
		return

	plots_by_id[plot_id] = plot.duplicate(true)

	var plots: Array = world_state.get("plots", [])
	var replaced := false

	for i in range(plots.size()):
		var existing: Dictionary = plots[i]
		if str(existing.get("id", "")) == plot_id:
			plots[i] = plot.duplicate(true)
			replaced = true
			break

	if not replaced:
		plots.append(plot.duplicate(true))

	world_state["plots"] = plots

func apply_world_patch(patch: Dictionary) -> void:
	# For now, keep patch handling simple and safe:
	# if the server sends a plot list inside the patch, merge those plots.
	# This gives us a stable world-data owner without guessing future patch shape.
	var patch_plots = patch.get("plots", null)
	if typeof(patch_plots) == TYPE_ARRAY:
		for p in patch_plots:
			if typeof(p) == TYPE_DICTIONARY:
				apply_plot_update(p)

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

func _grid_to_world(grid_x: int, grid_y: int) -> Vector3:
	# M1 uses grid x/y from the server and maps them onto 3D x/z.
	# Y stays vertical in world space, so we place tiles on y = 0.
	return Vector3(grid_x * TEST_TILE_SPACING, 0.0, grid_y * TEST_TILE_SPACING)

func _clear_tiles_root() -> void:
	# Safe cleanup helper for local rendering tests.
	for child in tiles_root.get_children():
		child.queue_free()

func _spawn_test_tile(plot: Dictionary) -> void:
	var tile := PLOT_TILE_SCENE.instantiate() as PlotTile3D
	if tile == null:
		push_error("Failed to instantiate PlotTile3D scene.")
		return

	tile.position = _grid_to_world(int(plot.get("x", 0)), int(plot.get("y", 0)))

	# Add the tile to the scene tree before calling methods that depend on
	# @onready child references inside PlotTile3D.
	tiles_root.add_child(tile)

	# Now the tile can safely access child nodes like $Visual.
	tile.apply_plot(plot, my_player_id)

func _spawn_local_test_grid() -> void:
	# Temporary local rendering test for Step 3 only.
	# This is intentionally isolated so we can delete it cleanly once the
	# real PlotRenderer3D takes over.
	_clear_tiles_root()

	for y in range(3):
		for x in range(3):
			var plot_type := "RESOURCE" if (x % 2 == 0 and y % 2 == 0) else "PLAYER"

			var plot := {
				"id": "TEST_%d_%d" % [x, y],
				"x": x,
				"y": y,
				"type": plot_type,
				"claimed_by": null,
			}

			_spawn_test_tile(plot)

func _ready() -> void:
	# Step 3 verification:
	# If this scene is instanced correctly by Main, this message should
	# appear in the Output panel when the project runs.
	print("GameWorld3D ready: 3D world shell loaded.")

	# Step 3 local render test:
	# spawn a tiny 3x3 grid in 3D so we can verify the tile scene,
	# material logic, spacing, and instancing pipeline before wiring
	# real server-driven rendering.
	_spawn_local_test_grid()
	
