extends Node
class_name LocalPlotInteractor3D

signal rubble_clicked(object_id: String)

var _camera: Camera3D = null
var _enabled: bool = false

func setup(camera: Camera3D) -> void:
	# The interactor needs the active gameplay camera so it can raycast
	# into the local owned-plot scene.
	_camera = camera

func set_enabled(enabled: bool) -> void:
	_enabled = enabled

func _unhandled_input(event: InputEvent) -> void:
	if not _enabled:
		return

	if _camera == null:
		return

	# Local rubble interaction is left-click only for this first real pass.
	if event is InputEventMouseButton:
		var mouse_event := event as InputEventMouseButton
		if mouse_event.button_index == MOUSE_BUTTON_LEFT and mouse_event.pressed:
			var object_id := _pick_rubble_object_id_at_screen_pos(mouse_event.position)
			if object_id != "":
				rubble_clicked.emit(object_id)
				get_viewport().set_input_as_handled()

func _pick_rubble_object_id_at_screen_pos(screen_pos: Vector2) -> String:
	var ray_origin := _camera.project_ray_origin(screen_pos)
	var ray_direction := _camera.project_ray_normal(screen_pos)
	var ray_end := ray_origin + ray_direction * 1000.0

	var query := PhysicsRayQueryParameters3D.create(ray_origin, ray_end)
	query.collide_with_areas = false
	query.collide_with_bodies = true

	var space_state := _camera.get_world_3d().direct_space_state
	var result := space_state.intersect_ray(query)

	if result.is_empty():
		return ""

	var collider = result.get("collider", null)
	if collider == null:
		return ""

	if collider is Rubble4x4:
		return (collider as Rubble4x4).get_object_id()

	return ""
