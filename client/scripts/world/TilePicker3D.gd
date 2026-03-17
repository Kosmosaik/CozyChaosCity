extends Node
class_name TilePicker3D

signal tile_hovered(plot_id: String)
signal tile_clicked(plot_id: String)

# TilePicker3D is responsible only for mouse -> 3D tile hit detection.
# It does not know anything about HUD logic, claim rules, or networking.
#
# Responsibilities:
# - raycast from the active camera
# - detect PlotTile3D bodies
# - emit plot_id-based hover/click events
#
# This keeps input picking separate from rendering and UI.

var _camera: Camera3D = null
var _last_hovered_plot_id: String = ""

func setup(camera: Camera3D) -> void:
	# The picker needs the camera used to render the world so it can convert
	# mouse position into a 3D ray.
	_camera = camera

func _unhandled_input(event: InputEvent) -> void:
	if _camera == null:
		return

	# Mouse move updates hover state.
	if event is InputEventMouseMotion:
		var motion_event : InputEventMouseMotion = event as InputEventMouseMotion
		var plot_id : String = _pick_plot_id_at_screen_pos(motion_event.position)

		# Emit only when hover actually changes to avoid noisy repeated updates.
		if plot_id != _last_hovered_plot_id:
			_last_hovered_plot_id = plot_id
			tile_hovered.emit(plot_id)

	# Left click selects a tile.
	elif event is InputEventMouseButton:
		var mouse_event : InputEventMouseButton = event as InputEventMouseButton
		if mouse_event.button_index == MOUSE_BUTTON_LEFT and mouse_event.pressed:
			var plot_id : String = _pick_plot_id_at_screen_pos(mouse_event.position)

			# Empty string means "clicked empty space".
			tile_clicked.emit(plot_id)

func _pick_plot_id_at_screen_pos(screen_pos: Vector2) -> String:
	# Convert the 2D mouse position into a 3D ray.
	var ray_origin: Vector3 = _camera.project_ray_origin(screen_pos)
	var ray_direction: Vector3 = _camera.project_ray_normal(screen_pos)
	var ray_end: Vector3 = ray_origin + ray_direction * 1000.0

	var query: PhysicsRayQueryParameters3D = PhysicsRayQueryParameters3D.create(ray_origin, ray_end)
	query.collide_with_areas = false
	query.collide_with_bodies = true

	var space_state: PhysicsDirectSpaceState3D = _camera.get_world_3d().direct_space_state
	var result: Dictionary = space_state.intersect_ray(query)

	if result.is_empty():
		return ""

	var collider_value: Variant = result.get("collider", null)
	if collider_value == null:
		return ""

	var current_node: Node = collider_value as Node
	while current_node != null:
		if current_node is PlotTile3D:
			var tile: PlotTile3D = current_node as PlotTile3D
			return tile.plot_id

		current_node = current_node.get_parent()

	return ""
