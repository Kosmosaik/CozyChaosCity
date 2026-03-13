extends Node
class_name LocalPlotInteractor3D

signal rubble_context_requested(object_id: String, screen_position: Vector2)

var _camera: Camera3D = null
var _enabled: bool = false

# Right-click context behavior:
# - press may begin a context interaction
# - drag cancels the menu and allows camera rotation to remain the main feel
# - release without drag opens the context menu
const RMB_CLICK_MAX_DRAG_DISTANCE: float = 15.0

var _right_mouse_press_screen_position: Vector2 = Vector2.ZERO

var _right_mouse_pressed: bool = false
var _right_mouse_press_object_id: String = ""
var _right_mouse_dragged: bool = false

func setup(camera: Camera3D) -> void:
	# The interactor needs the active gameplay camera so it can raycast
	# into the local owned-plot scene.
	_camera = camera

func set_enabled(enabled: bool) -> void:
	_enabled = enabled

	# If local interaction gets disabled during a half-finished RMB gesture
	# (for example while entering/exiting plot mode), clear that state so
	# no stale menu interaction survives into the next mode.
	if not enabled:
		_right_mouse_pressed = false
		_right_mouse_press_screen_position = Vector2.ZERO
		_right_mouse_press_object_id = ""
		_right_mouse_dragged = false

func _unhandled_input(event: InputEvent) -> void:
	if not _enabled:
		return

	if _camera == null:
		return

	# Right-click local interaction is resolved on release, not on press.
	#
	# Why:
	# - CameraRigBasic already uses RMB hold/drag for rotation.
	# - If we open the rubble menu on RMB press, the two systems fight each other.
	# - So we only open the menu if the player pressed on rubble and then released
	#   without dragging beyond a small threshold.
	if event is InputEventMouseButton:
		var mouse_event := event as InputEventMouseButton

		if mouse_event.button_index == MOUSE_BUTTON_RIGHT:
			if mouse_event.pressed:
				_right_mouse_pressed = true
				_right_mouse_press_screen_position = mouse_event.position
				_right_mouse_press_object_id = _pick_rubble_object_id_at_screen_pos(mouse_event.position)
				_right_mouse_dragged = false
				return

			# Right mouse released:
			if _right_mouse_pressed:
				var release_object_id := _pick_rubble_object_id_at_screen_pos(mouse_event.position)
				var should_open_menu := (
					not _right_mouse_dragged
					and _right_mouse_press_object_id != ""
					and release_object_id == _right_mouse_press_object_id
				)

				_right_mouse_pressed = false

				if should_open_menu:
					rubble_context_requested.emit(release_object_id, mouse_event.position)
					get_viewport().set_input_as_handled()

				_right_mouse_press_screen_position = Vector2.ZERO
				_right_mouse_press_object_id = ""
				_right_mouse_dragged = false
				return

	if event is InputEventMouseMotion:
		if _right_mouse_pressed and not _right_mouse_dragged:
			var motion_event := event as InputEventMouseMotion
			if motion_event.position.distance_to(_right_mouse_press_screen_position) > RMB_CLICK_MAX_DRAG_DISTANCE:
				_right_mouse_dragged = true

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
