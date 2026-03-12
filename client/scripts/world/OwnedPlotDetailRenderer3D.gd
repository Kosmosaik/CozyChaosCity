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
const GROUND_TEXTURE: Texture2D = preload("res://1.png")

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

func setup(root: Node3D) -> void:
	# The renderer needs one stable parent node where all local-detail content lives.
	_root = root
	_ensure_content_root()

func clear() -> void:
	if _content_root == null:
		return

	for child in _content_root.get_children():
		child.queue_free()

func show_plot_detail(plot: Dictionary) -> void:
	# Rebuild the local-detail view from the authoritative plot data.
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

	# Player-facing local view:
	# - one textured ground surface for the full plot
	# - placed local objects on top (shack, rubble chunks, NPC marker)
	# The hidden cell grid remains for snapping/blocking/clearing only.
	_render_plot_ground(width, height)
	_render_starter_objects(detail, width, height)

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
	var ground_mesh: MeshInstance3D = MeshInstance3D.new()
	ground_mesh.name = "PlotGround"

	var mesh: PlaneMesh = PlaneMesh.new()
	mesh.size = Vector2(
		float(width) * CELL_SIZE_METERS,
		float(height) * CELL_SIZE_METERS
	)
	ground_mesh.mesh = mesh

	var material: StandardMaterial3D = StandardMaterial3D.new()
	material.albedo_texture = GROUND_TEXTURE
	material.albedo_color = Color(1, 1, 1, 1)
	material.roughness = 1.0
	material.metallic = 0.0

	# If the texture import is set to repeat, this tiles it across the plot.
	# If repeat is disabled in the texture import, it will still render safely,
	# but the texture will stretch instead of tile.
	material.uv1_scale = Vector3(
		float(width) / GROUND_TEXTURE_REPEAT_METERS,
		float(height) / GROUND_TEXTURE_REPEAT_METERS,
		1.0
	)

	ground_mesh.material_override = material
	ground_mesh.position = Vector3(0.0, 0.0, 0.0)

	_content_root.add_child(ground_mesh)

func _render_starter_objects(detail: Dictionary, width: int, height: int) -> void:
	var starter_objects = detail.get("starter_objects", [])
	if typeof(starter_objects) != TYPE_ARRAY:
		return

	for object_data in starter_objects:
		if typeof(object_data) != TYPE_DICTIONARY:
			continue

		var kind := str(object_data.get("kind", ""))
		var footprint_w: int = maxi(1, int(object_data.get("footprint_w", 1)))
		var footprint_h: int = maxi(1, int(object_data.get("footprint_h", 1)))

		var obj_node: Node3D = null

		match kind:
			"SHACK":
				obj_node = _make_shack_placeholder(footprint_w, footprint_h)
			"RUBBLE_4X4":
				obj_node = _make_rubble_object(footprint_w, footprint_h)
			"NPC_MARKER":
				obj_node = _make_npc_marker_placeholder()
			_:
				continue

		obj_node.position = _object_anchor_to_local_position(
			int(object_data.get("x", 0)),
			int(object_data.get("y", 0)),
			footprint_w,
			footprint_h,
			width,
			height
		)

		_content_root.add_child(obj_node)

func _make_rubble_object(footprint_w: int, footprint_h: int) -> Node3D:
	var asset_node = _instantiate_asset_wrapper(
		RUBBLE_SCENE,
		"RubbleObject",
		RUBBLE_ASSET_SCALE,
		RUBBLE_ASSET_Y_OFFSET,
		RUBBLE_ASSET_Y_ROTATION_DEGREES
	)
	if asset_node != null:
		return asset_node

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
