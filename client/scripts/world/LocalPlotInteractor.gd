extends Node
class_name LocalPlotInteractor3D

signal rubble_context_requested(object_id: String, screen_position: Vector2)
signal npc_clicked(npc_id: String, screen_position: Vector2)

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

	# Left click is reserved for NPC selection in local plot mode.
	# We emit an empty npc_id on non-NPC clicks so GameWorld3D can centrally
	# decide whether to clear the current selection.
	if event is InputEventMouseButton:
		var mouse_event: InputEventMouseButton = event as InputEventMouseButton

		if mouse_event.button_index == MOUSE_BUTTON_LEFT and mouse_event.pressed:
			var clicked_npc_id: String = _pick_npc_id_at_screen_pos(mouse_event.position)
			npc_clicked.emit(clicked_npc_id, mouse_event.position)
			get_viewport().set_input_as_handled()
			return

		if mouse_event.button_index == MOUSE_BUTTON_RIGHT:
			if mouse_event.pressed:
				_right_mouse_pressed = true
				_right_mouse_press_screen_position = mouse_event.position
				_right_mouse_press_object_id = _pick_rubble_object_id_at_screen_pos(mouse_event.position)
				_right_mouse_dragged = false
				return

			# Right mouse released:
			if _right_mouse_pressed:
				var release_object_id: String = _pick_rubble_object_id_at_screen_pos(mouse_event.position)
				var should_open_menu: bool = (
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
			var motion_event: InputEventMouseMotion = event as InputEventMouseMotion
			if motion_event.position.distance_to(_right_mouse_press_screen_position) > RMB_CLICK_MAX_DRAG_DISTANCE:
				_right_mouse_dragged = true

func _pick_result_at_screen_pos(screen_pos: Vector2) -> Dictionary:
	var ray_origin: Vector3 = _camera.project_ray_origin(screen_pos)
	var ray_direction: Vector3 = _camera.project_ray_normal(screen_pos)
	var ray_end: Vector3 = ray_origin + ray_direction * 1000.0

	var query: PhysicsRayQueryParameters3D = PhysicsRayQueryParameters3D.create(ray_origin, ray_end)
	query.collide_with_areas = false
	query.collide_with_bodies = true

	var space_state: PhysicsDirectSpaceState3D = _camera.get_world_3d().direct_space_state
	var result: Dictionary = space_state.intersect_ray(query)
	return result

func _pick_rubble_object_id_at_screen_pos(screen_pos: Vector2) -> String:
	var result: Dictionary = _pick_result_at_screen_pos(screen_pos)
	if result.is_empty():
		return ""

	var collider_value: Variant = result.get("collider", null)
	if collider_value == null:
		return ""

	var collider_node: Node = collider_value as Node
	if collider_node == null:
		return ""

	var current_node: Node = collider_node
	while current_node != null:
		if current_node.has_method("get_object_id"):
			return str(current_node.get_object_id())

		current_node = current_node.get_parent()

	return ""

func _pick_npc_id_at_screen_pos(screen_pos: Vector2) -> String:
	var result: Dictionary = _pick_result_at_screen_pos(screen_pos)
	if result.is_empty():
		return ""

	var collider_value: Variant = result.get("collider", null)
	if collider_value == null:
		return ""

	var collider_node: Node = collider_value as Node
	if collider_node == null:
		return ""

	var current_node: Node = collider_node
	while current_node != null:
		if current_node.has_meta("npc_id"):
			return str(current_node.get_meta("npc_id"))

		current_node = current_node.get_parent()

	return ""
