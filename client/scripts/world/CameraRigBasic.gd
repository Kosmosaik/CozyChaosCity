extends Node3D
class_name CameraRigBasic

# CameraRigBasic owns runtime camera controls for the 3D world.
#
# Responsibilities:
# - Move the camera rig across the ground plane
# - Scale movement speed by zoom distance
# - Rotate the camera left/right using a yaw pivot
# - Tilt the camera up/down using a pitch pivot
# - Zoom the camera in/out by moving Camera3D locally
#
# This script does NOT:
# - know anything about plots, selection, HUD, or networking
#
# Scene structure required:
# CameraRig
# └── YawPivot
#     └── PitchPivot
#         └── Camera3D

@export var base_move_speed: float = 8.0

# Mouse drag sensitivity in degrees per pixel while the right mouse button is held.
@export var mouse_yaw_sensitivity: float = 0.20
@export var mouse_pitch_sensitivity: float = 0.20

@export var min_zoom_distance: float = 4.0
@export var max_zoom_distance: float = 80.0
@export var zoom_step: float = 1.5
@export var initial_zoom_distance: float = 14.0

@export var min_pitch_degrees: float = -90.0
@export var max_pitch_degrees: float = -15.0
@export var initial_pitch_degrees: float = -45.0

@onready var yaw_pivot: Node3D = $YawPivot
@onready var pitch_pivot: Node3D = $YawPivot/PitchPivot
@onready var camera_3d: Camera3D = $YawPivot/PitchPivot/Camera3D

var _zoom_distance: float = 14.0
var _pitch_degrees: float = -45.0
var _is_rotating_with_mouse: bool = false
var _controls_locked: bool = false
var _active_tween: Tween = null

func set_controls_locked(locked: bool) -> void:
	# Used by mode transitions so the player cannot pan/rotate/zoom
	# while the camera is tweening between world and local-plot views.
	_controls_locked = locked

	if locked:
		_is_rotating_with_mouse = false

func get_zoom_distance() -> float:
	return _zoom_distance

func get_pitch_degrees() -> float:
	return _pitch_degrees

func tween_to_state(
	target_position: Vector3,
	target_zoom_distance: float,
	target_pitch_degrees: float,
	duration: float = 0.35
) -> Tween:
	# Kill any previous transition so only one camera tween is active at a time.
	if _active_tween != null and is_instance_valid(_active_tween):
		_active_tween.kill()

	var clamped_zoom = clamp(target_zoom_distance, min_zoom_distance, max_zoom_distance)
	var clamped_pitch = clamp(target_pitch_degrees, min_pitch_degrees, max_pitch_degrees)

	_active_tween = create_tween()
	_active_tween.set_trans(Tween.TRANS_SINE)
	_active_tween.set_ease(Tween.EASE_IN_OUT)

	_active_tween.parallel().tween_property(self, "global_position", target_position, duration)
	_active_tween.parallel().tween_method(
		Callable(self, "_set_zoom_distance_from_tween"),
		_zoom_distance,
		clamped_zoom,
		duration
	)
	_active_tween.parallel().tween_method(
		Callable(self, "_set_pitch_degrees_from_tween"),
		_pitch_degrees,
		clamped_pitch,
		duration
	)

	return _active_tween

func _set_zoom_distance_from_tween(value: float) -> void:
	_zoom_distance = value
	_apply_zoom()

func _set_pitch_degrees_from_tween(value: float) -> void:
	_pitch_degrees = value
	_apply_pitch()

func _ready() -> void:
	# Validate the expected scene structure early so setup mistakes fail clearly.
	if yaw_pivot == null:
		push_error("CameraRigBasic requires a child node at 'YawPivot'.")
		return

	if pitch_pivot == null:
		push_error("CameraRigBasic requires a child node at 'YawPivot/PitchPivot'.")
		return

	if camera_3d == null:
		push_error("CameraRigBasic requires a child Camera3D at 'YawPivot/PitchPivot/Camera3D'.")
		return

	_zoom_distance = clamp(initial_zoom_distance, min_zoom_distance, max_zoom_distance)
	_pitch_degrees = clamp(initial_pitch_degrees, min_pitch_degrees, max_pitch_degrees)

	_apply_pitch()
	_apply_zoom()

func _process(delta: float) -> void:
	_handle_movement(delta)

func _unhandled_input(event: InputEvent) -> void:
	# Use _unhandled_input so UI gets first chance to consume input.
	# Camera controls only react to input that the UI did not already handle.
	
	if _controls_locked:
		return

	if event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_RIGHT:
			_is_rotating_with_mouse = event.pressed
			if event.pressed:
				get_viewport().set_input_as_handled()
			return

		if event.pressed:
			if event.button_index == MOUSE_BUTTON_WHEEL_UP:
				_zoom_toward_mouse(-zoom_step, event.position)
				get_viewport().set_input_as_handled()
				return
			elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
				_zoom_toward_mouse(zoom_step, event.position)
				get_viewport().set_input_as_handled()
				return

	if event is InputEventMouseMotion and _is_rotating_with_mouse:
		# Horizontal mouse drag = yaw
		# Vertical mouse drag = pitch/tilt
		yaw_pivot.rotate_y(deg_to_rad(-event.relative.x * mouse_yaw_sensitivity))

		_pitch_degrees = clamp(
			_pitch_degrees - (event.relative.y * mouse_pitch_sensitivity),
			min_pitch_degrees,
			max_pitch_degrees
		)
		_apply_pitch()

		get_viewport().set_input_as_handled()

func _handle_movement(delta: float) -> void:
	if _controls_locked:
		return
	var input_dir := Input.get_vector("camera_left", "camera_right", "camera_down", "camera_up")
	if input_dir == Vector2.ZERO:
		return

	# Scale move speed with zoom so travelling across the map feels faster when
	# zoomed out and more precise when zoomed in.
	var zoom_ratio := _zoom_distance / initial_zoom_distance
	var move_speed := base_move_speed * zoom_ratio

	# Move relative to the yaw pivot so "forward" follows the camera's facing
	# direction on the ground plane, which is the typical city-builder feel.
	var forward := -yaw_pivot.global_basis.z
	forward.y = 0.0
	forward = forward.normalized()

	var right := yaw_pivot.global_basis.x
	right.y = 0.0
	right = right.normalized()

	var move_vector := (right * input_dir.x) + (forward * input_dir.y)
	global_position += move_vector * move_speed * delta

func _zoom_toward_mouse(delta_zoom: float, mouse_screen_pos: Vector2) -> void:
	# Find the ground point currently under the mouse before zooming.
	var before_point = _get_mouse_world_on_ground(mouse_screen_pos)

	_zoom_distance = clamp(_zoom_distance + delta_zoom, min_zoom_distance, max_zoom_distance)
	_apply_zoom()

	# Find the ground point under the same mouse position after zooming.
	var after_point = _get_mouse_world_on_ground(mouse_screen_pos)

	# If both intersections are valid, move the rig so the same world point
	# stays under the cursor. This creates "zoom toward mouse position".
	if before_point != null and after_point != null:
		global_position += before_point - after_point

func _get_mouse_world_on_ground(mouse_screen_pos: Vector2):
	# Project the mouse position into a 3D ray from the active camera.
	var ray_origin := camera_3d.project_ray_origin(mouse_screen_pos)
	var ray_direction := camera_3d.project_ray_normal(mouse_screen_pos)

	# Our current world is flat, so zoom anchoring can use the ground plane y = 0.
	# Plane(Vector3.UP, 0.0) means all points where y == 0.
	var ground_plane := Plane(Vector3.UP, 0.0)
	return ground_plane.intersects_ray(ray_origin, ray_direction)

func _apply_zoom() -> void:
	if camera_3d == null:
		return

	# Keep zoom simple and stable by changing only the camera's local distance
	# from the pitch pivot.
	camera_3d.position = Vector3(0.0, 0.0, _zoom_distance)

func _apply_pitch() -> void:
	if pitch_pivot == null:
		return

	pitch_pivot.rotation_degrees.x = _pitch_degrees
