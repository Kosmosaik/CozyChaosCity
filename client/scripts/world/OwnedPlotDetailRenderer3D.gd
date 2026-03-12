extends RefCounted
class_name OwnedPlotDetailRenderer3D

# OwnedPlotDetailRenderer3D renders the local/detail view of exactly one owned plot.
#
# Responsibilities:
# - render local cells from plot.detail.cells
# - render starter objects from plot.detail.starter_objects
# - keep all local-detail visuals under one dedicated root
#
# Scale rules for the real-size M2 pass:
# - 1 local cell = 1x1 meter = 1 Godot unit
# - object footprints are expressed in cell counts
# - the local plot is centered around the OwnedPlotRoot origin
#
# This renderer intentionally does NOT:
# - know about networking
# - know about HUD buttons
# - switch game modes
# - handle camera logic

const CELL_SIZE_METERS: float = 1.0
const GROUND_TEXTURE_REPEAT_METERS: float = 4.0

const NPC_PLACEHOLDER_HEIGHT: float = 1.8
const NPC_PLACEHOLDER_RADIUS: float = 0.40

# Player-facing ground is one continuous textured surface.
const GROUND_TEXTURE_0: Texture2D = preload("res://assets/ground_textures/0.png")
const GROUND_TEXTURE_1: Texture2D = preload("res://assets/ground_textures/1.png")
const GROUND_TEXTURE_2: Texture2D = preload("res://assets/ground_textures/2.png")
const GROUND_TEXTURE_3: Texture2D = preload("res://assets/ground_textures/3.png")
const GROUND_TEXTURE_4: Texture2D = preload("res://assets/ground_textures/4.png")

const PLOT_GROUND_SHADER: Shader = preload("res://shaders/plot_ground_random_5.gdshader")

# Real authored local objects should be spawned from wrapper scenes, not raw GLBs directly.
const SHACK_SCENE: PackedScene = preload("res://scenes/local_objects/StarterShack.tscn")
const RUBBLE_SCENE: PackedScene = preload("res://scenes/local_objects/Rubble4x4.tscn")

# Tuning values kept here so asset placement can be adjusted without touching layout logic.
const SHACK_ASSET_SCALE: Vector3 = Vector3.ONE
const SHACK_ASSET_Y_OFFSET: float = 0.02
const SHACK_ASSET_Y_ROTATION_DEGREES: float = 0.0

const RUBBLE_ASSET_SCALE: Vector3 = Vector3.ONE
const RUBBLE_ASSET_Y_OFFSET: float = 0.02
const RUBBLE_ASSET_Y_ROTATION_DEGREES: float = 0.0

var _root: Node3D = null
var _content_root: Node3D = null

var _ground_node: MeshInstance3D = null
var _rendered_object_nodes_by_id: Dictionary = {}
var _last_plot_id: String = ""
var _last_plot_width: int = 0
var _last_plot_height: int = 0

func setup(root: Node3D) -> void:
	# The renderer needs one stable parent node where all local-detail content lives.
	_root = root
	_ensure_content_root()

func clear() -> void:
	if _content_root == null:
		return

	for child in _content_root.get_children():
		child.queue_free()

	_ground_node = null
	_rendered_object_nodes_by_id.clear()
	_last_plot_id = ""
	_last_plot_width = 0
	_last_plot_height = 0

func show_plot_detail(plot: Dictionary) -> void:
	# Full rebuild used for first entry into Player Plot mode.
	clear()

	if _content_root == null:
		return

	var detail = plot.get("detail", null)
	if typeof(detail) != TYPE_DICTIONARY or detail.is_empty():
		return

	var width := int(detail.get("width", 0))
	var height := int(detail.get("height", 0))
	if width <= 0 or height <= 0:
		return

	_last_plot_id = str(plot.get("id", ""))
	_last_plot_width = width
	_last_plot_height = height

	_render_plot_ground(width, height)
	_sync_starter_objects(detail, width, height)
	
func refresh_plot_detail(plot: Dictionary) -> void:
	# Incremental refresh used when the active owned plot receives a plot_update.
	# This lets us animate removed rubble instead of instantly deleting everything.
	if _content_root == null:
		return

	var detail = plot.get("detail", null)
	if typeof(detail) != TYPE_DICTIONARY or detail.is_empty():
		clear()
		return

	var width := int(detail.get("width", 0))
	var height := int(detail.get("height", 0))
	if width <= 0 or height <= 0:
		clear()
		return

	var plot_id := str(plot.get("id", ""))
	var needs_full_rebuild := (
		plot_id != _last_plot_id
		or width != _last_plot_width
		or height != _last_plot_height
		or _ground_node == null
	)

	if needs_full_rebuild:
		show_plot_detail(plot)
		return

	_sync_starter_objects(detail, width, height)

func _ensure_content_root() -> void:
	if _root == null:
		return

	if _content_root != null and is_instance_valid(_content_root):
		return

	_content_root = Node3D.new()
	_content_root.name = "OwnedPlotContent"
	_root.add_child(_content_root)

func _render_plot_ground(width: int, height: int) -> void:
	# Render one continuous textured ground plane for the whole local plot.
	# The hidden cell grid still exists in data, but the player should see
	# environment surfaces and placed objects, not visible board tiles.
	if _ground_node != null and is_instance_valid(_ground_node):
		_ground_node.queue_free()
		_ground_node = null

	var ground_mesh: MeshInstance3D = MeshInstance3D.new()
	ground_mesh.name = "PlotGround"

	var mesh: PlaneMesh = PlaneMesh.new()
	mesh.size = Vector2(
		float(width) * CELL_SIZE_METERS,
		float(height) * CELL_SIZE_METERS
	)
	ground_mesh.mesh = mesh

	var material := ShaderMaterial.new()
	material.shader = PLOT_GROUND_SHADER

	# These control how often each seamless texture tiles across the full plot.
	material.set_shader_parameter(
		"texture_repeat_x",
		float(width) / GROUND_TEXTURE_REPEAT_METERS
	)
	material.set_shader_parameter(
		"texture_repeat_y",
		float(height) / GROUND_TEXTURE_REPEAT_METERS
	)

	# These control how large each random texture-selection patch is.
	# Smaller numbers = bigger patches.
	# Bigger numbers = more frequent variation.
	material.set_shader_parameter("variation_grid_x", float(width) / 16.0)
	material.set_shader_parameter("variation_grid_y", float(height) / 16.0)

	material.set_shader_parameter("tex0", GROUND_TEXTURE_0)
	material.set_shader_parameter("tex1", GROUND_TEXTURE_1)
	material.set_shader_parameter("tex2", GROUND_TEXTURE_2)
	material.set_shader_parameter("tex3", GROUND_TEXTURE_3)
	material.set_shader_parameter("tex4", GROUND_TEXTURE_4)

	ground_mesh.material_override = material
	ground_mesh.position = Vector3(0.0, 0.0, 0.0)

	_content_root.add_child(ground_mesh)
	_ground_node = ground_mesh

func _sync_starter_objects(detail: Dictionary, width: int, height: int) -> void:
	var starter_objects = detail.get("starter_objects", [])
	if typeof(starter_objects) != TYPE_ARRAY:
		return

	var next_object_data_by_id: Dictionary = {}

	for object_data in starter_objects:
		if typeof(object_data) != TYPE_DICTIONARY:
			continue

		var object_id := str(object_data.get("id", ""))
		if object_id == "":
			continue

		next_object_data_by_id[object_id] = object_data

		if _rendered_object_nodes_by_id.has(object_id):
			continue

		var obj_node := _make_starter_object_node(object_data, width, height)
		if obj_node == null:
			continue

		_rendered_object_nodes_by_id[object_id] = obj_node
		_content_root.add_child(obj_node)

	var rendered_ids := _rendered_object_nodes_by_id.keys()
	for object_id in rendered_ids:
		if next_object_data_by_id.has(object_id):
			continue

		var existing_node = _rendered_object_nodes_by_id.get(object_id, null)
		if existing_node != null and is_instance_valid(existing_node):
			if existing_node.has_method("play_clear_animation"):
				existing_node.play_clear_animation()
			else:
				existing_node.queue_free()

		_rendered_object_nodes_by_id.erase(object_id)
		
func _make_starter_object_node(object_data: Dictionary, width: int, height: int) -> Node3D:
	var kind := str(object_data.get("kind", ""))
	var footprint_w: int = maxi(1, int(object_data.get("footprint_w", 1)))
	var footprint_h: int = maxi(1, int(object_data.get("footprint_h", 1)))

	var obj_node: Node3D = null

	match kind:
		"SHACK":
			obj_node = _make_shack_placeholder(footprint_w, footprint_h)
		"RUBBLE_4X4":
			obj_node = _make_rubble_object(footprint_w, footprint_h)
			if obj_node != null and obj_node.has_method("set_object_id"):
				obj_node.set_object_id(str(object_data.get("id", "")))
		"NPC_MARKER":
			obj_node = _make_npc_marker_placeholder()
		_:
			return null

	if obj_node == null:
		return null

	obj_node.position = _object_anchor_to_local_position(
		int(object_data.get("x", 0)),
		int(object_data.get("y", 0)),
		footprint_w,
		footprint_h,
		width,
		height
	)

	if kind == "RUBBLE_4X4":
		var visual_offset_range := CELL_SIZE_METERS * 0.5
		obj_node.position.x += randf_range(-visual_offset_range, visual_offset_range)
		obj_node.position.z += randf_range(-visual_offset_range, visual_offset_range)

	return obj_node

	return obj_node

func _make_rubble_object(footprint_w: int, footprint_h: int) -> Node3D:
	# Rubble must be instantiated as its real authored root scene, not wrapped
	# in a generic Node3D. The root carries:
	# - the StaticBody3D click target
	# - the Rubble4x4 script with object id storage
	# - the clear/remove animation entry point
	if RUBBLE_SCENE != null:
		var instance = RUBBLE_SCENE.instantiate()
		if instance is Node3D:
			var rubble_node := instance as Node3D
			rubble_node.name = "RubbleObject"
			rubble_node.scale = RUBBLE_ASSET_SCALE
			rubble_node.position.y = RUBBLE_ASSET_Y_OFFSET

			rubble_node.rotation_degrees.y = (
				RUBBLE_ASSET_Y_ROTATION_DEGREES
				+ randf_range(0.0, 360.0)
			)

			return rubble_node

			return rubble_node

	# Fallback if the rubble scene is missing or fails to instantiate.
	var node := Node3D.new()
	node.name = "RubbleObjectFallback"

	var mesh_instance := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = Vector3(
		float(footprint_w) * CELL_SIZE_METERS * 0.96,
		1.0,
		float(footprint_h) * CELL_SIZE_METERS * 0.96
	)
	mesh_instance.mesh = mesh

	var material := StandardMaterial3D.new()
	material.albedo_color = Color(0.44, 0.35, 0.28, 1.0)
	material.roughness = 1.0
	mesh_instance.material_override = material
	mesh_instance.position.y = 0.5

	node.add_child(mesh_instance)
	return node

func _instantiate_asset_wrapper(
	scene: PackedScene,
	node_name: String,
	asset_scale: Vector3,
	asset_y_offset: float,
	asset_y_rotation_degrees: float
):
	if scene == null:
		return null

	var instance = scene.instantiate()
	if not (instance is Node3D):
		return null

	var wrapper := Node3D.new()
	wrapper.name = node_name

	var visual := instance as Node3D
	visual.scale = asset_scale
	visual.position.y = asset_y_offset
	visual.rotation_degrees.y = asset_y_rotation_degrees

	wrapper.add_child(visual)
	return wrapper

func _make_shack_placeholder(footprint_w: int, footprint_h: int) -> Node3D:
	var asset_node = _instantiate_asset_wrapper(
		SHACK_SCENE,
		"StarterShack",
		SHACK_ASSET_SCALE,
		SHACK_ASSET_Y_OFFSET,
		SHACK_ASSET_Y_ROTATION_DEGREES
	)
	if asset_node != null:
		return asset_node

	# Fallback if the GLB is missing or instantiation fails.
	var node := Node3D.new()
	node.name = "StarterShackFallback"

	var mesh_instance := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = Vector3(
		float(footprint_w) * CELL_SIZE_METERS * 0.96,
		2.6,
		float(footprint_h) * CELL_SIZE_METERS * 0.96
	)
	mesh_instance.mesh = mesh

	var material := StandardMaterial3D.new()
	material.albedo_color = Color(0.64, 0.54, 0.36, 1.0)
	material.roughness = 0.95
	mesh_instance.material_override = material

	mesh_instance.position.y = 1.3
	node.add_child(mesh_instance)

	return node

func _make_npc_marker_placeholder() -> Node3D:
	var node := Node3D.new()
	node.name = "StarterNPCMarker"

	var mesh_instance := MeshInstance3D.new()
	var mesh := CylinderMesh.new()
	mesh.top_radius = NPC_PLACEHOLDER_RADIUS * 0.85
	mesh.bottom_radius = NPC_PLACEHOLDER_RADIUS
	mesh.height = NPC_PLACEHOLDER_HEIGHT
	mesh_instance.mesh = mesh

	var material := StandardMaterial3D.new()
	material.albedo_color = Color(0.24, 0.55, 0.78, 1.0)
	material.roughness = 0.85
	material.emission_enabled = true
	material.emission = Color(0.06, 0.12, 0.18, 1.0)
	mesh_instance.material_override = material

	mesh_instance.position.y = NPC_PLACEHOLDER_HEIGHT * 0.5
	node.add_child(mesh_instance)

	return node

func _object_anchor_to_local_position(
	cell_x: int,
	cell_y: int,
	footprint_w: int,
	footprint_h: int,
	width: int,
	height: int
) -> Vector3:
	# x/y represent the object's top-left footprint anchor in local cells.
	# We place the object at the center of that footprint.
	var local_x := (-width * CELL_SIZE_METERS * 0.5) + ((cell_x + (float(footprint_w) * 0.5)) * CELL_SIZE_METERS)
	var local_z := (-height * CELL_SIZE_METERS * 0.5) + ((cell_y + (float(footprint_h) * 0.5)) * CELL_SIZE_METERS)

	return Vector3(local_x, 0.02, local_z)
