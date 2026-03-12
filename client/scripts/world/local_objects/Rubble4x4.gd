extends StaticBody3D
class_name Rubble4x4

signal clear_animation_finished(object_id: String)

@export var fallback_sink_distance: float = 1.25
@export var fallback_sink_duration: float = 0.45

var _object_id: String = ""
var _is_clearing: bool = false

func set_object_id(object_id: String) -> void:
	# The local renderer injects the authoritative starter-object id
	# so clicks and removals stay tied to real server data.
	_object_id = object_id

func get_object_id() -> String:
	return _object_id

func play_clear_animation() -> void:
	# Prevent duplicate play calls if multiple refreshes happen quickly.
	if _is_clearing:
		return

	_is_clearing = true
	input_ray_pickable = false
	_disable_collision_shapes_recursive(self)

	var animation_player := _find_animation_player_recursive(self)
	if animation_player != null:
		var animation_name := _choose_clear_animation_name(animation_player)
		if animation_name != "":
			animation_player.play(animation_name)
			await animation_player.animation_finished
			clear_animation_finished.emit(_object_id)
			queue_free()
			return

	# Safe fallback if the imported model has no usable remove animation:
	# sink the rubble below ground, then remove it.
	var tween := create_tween()
	tween.tween_property(
		self,
		"position:y",
		position.y - fallback_sink_distance,
		fallback_sink_duration
	)
	await tween.finished

	clear_animation_finished.emit(_object_id)
	queue_free()

func _choose_clear_animation_name(animation_player: AnimationPlayer) -> String:
	# Prefer an obvious remove/clear/sink animation name if one exists.
	# Otherwise use the first non-RESET animation as a practical fallback.
	var animation_names := animation_player.get_animation_list()

	for animation_name in animation_names:
		var lowered := String(animation_name).to_lower()
		if (
			lowered.contains("clear")
			or lowered.contains("remove")
			or lowered.contains("sink")
			or lowered.contains("destroy")
		):
			return String(animation_name)

	for animation_name in animation_names:
		if String(animation_name) != "RESET":
			return String(animation_name)

	return ""

func _find_animation_player_recursive(node: Node) -> AnimationPlayer:
	if node is AnimationPlayer:
		return node as AnimationPlayer

	for child in node.get_children():
		var found := _find_animation_player_recursive(child)
		if found != null:
			return found

	return null

func _disable_collision_shapes_recursive(node: Node) -> void:
	for child in node.get_children():
		if child is CollisionShape3D:
			(child as CollisionShape3D).disabled = true

		_disable_collision_shapes_recursive(child)
