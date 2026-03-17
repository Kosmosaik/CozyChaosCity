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

const NPC_SCENE: PackedScene = preload("res://assets/NPC/NPC_Idle.glb")
const NPC_CLICK_BODY_HEIGHT: float = 1.75
const NPC_CLICK_BODY_RADIUS: float = 0.45

const NPC_SELECTION_RING_RADIUS_TOP: float = 0.55
const NPC_SELECTION_RING_RADIUS_BOTTOM: float = 0.72
const NPC_SELECTION_RING_HEIGHT: float = 0.05

const NPC_LABEL_WORLD_HEIGHT: float = 2.35

var _root: Node3D = null
var _content_root: Node3D = null

var _ground_node: MeshInstance3D = null
var _rendered_object_nodes_by_id: Dictionary = {}
var _rendered_npc_nodes_by_id: Dictionary = {}
var _npc_move_tweens_by_id: Dictionary = {}
var _npc_move_signatures_by_id: Dictionary = {}
var _selected_npc_id: String = ""

var _last_plot_id: String = ""
var _last_plot_width: int = 0
var _last_plot_height: int = 0

func setup(root: Node3D) -> void:
	# The renderer needs one stable parent node where all local-detail content lives.
	_root = root
	_ensure_content_root()

func clear() -> void:
	for tween_value in _npc_move_tweens_by_id.values():
		var tween: Tween = tween_value as Tween
		if tween != null:
			tween.kill()

	_npc_move_tweens_by_id.clear()
	_npc_move_signatures_by_id.clear()
	_rendered_npc_nodes_by_id.clear()
	_rendered_object_nodes_by_id.clear()

	if _content_root != null and is_instance_valid(_content_root):
		for child in _content_root.get_children():
			var node: Node = child
			node.queue_free()

	_ground_node = null

	_last_plot_id = ""
	_last_plot_width = 0
	_last_plot_height = 0
	_selected_npc_id = ""
	
func set_selected_npc_id(npc_id: String) -> void:
	# Selection is owned by GameWorld3D. The renderer only reflects it visually.
	_selected_npc_id = npc_id

	for rendered_npc_id_value in _rendered_npc_nodes_by_id.keys():
		var rendered_npc_id: String = str(rendered_npc_id_value)
		var npc_node: Node3D = _rendered_npc_nodes_by_id.get(rendered_npc_id, null) as Node3D
		if npc_node == null or not is_instance_valid(npc_node):
			continue

		_apply_npc_selection_state_to_node(
			npc_node,
			rendered_npc_id == _selected_npc_id
		)

func _apply_npc_selection_state_to_node(
	npc_node: Node3D,
	is_selected: bool
) -> void:
	var selection_ring: MeshInstance3D = npc_node.get_node_or_null("SelectionRing") as MeshInstance3D
	if selection_ring != null:
		selection_ring.visible = is_selected
		
func _attach_npc_label_anchor(
	npc_node: Node3D,
	visual_node: Node3D
) -> void:
	# Overhead labels must follow the visible character, not just the actor root.
	# The imported NPC asset contains a real animated "Head" node, so we attach
	# a dedicated anchor there. If that node is ever missing, we fall back to a
	# stable root-level offset so the system still works.
	var label_anchor: Marker3D = Marker3D.new()
	label_anchor.name = "LabelAnchor"

	var head_node: Node = null
	if visual_node != null:
		head_node = visual_node.find_child("Head", true, false)

	if head_node is Node3D:
		var head_node_3d: Node3D = head_node as Node3D
		head_node_3d.add_child(label_anchor)
		label_anchor.position = Vector3.ZERO
		npc_node.set_meta("label_anchor_path", npc_node.get_path_to(label_anchor))
		return

	label_anchor.position = Vector3(0.0, NPC_LABEL_WORLD_HEIGHT, 0.0)
	npc_node.add_child(label_anchor)
	npc_node.set_meta("label_anchor_path", npc_node.get_path_to(label_anchor))

func _get_npc_label_world_position(npc_node: Node3D) -> Vector3:
	var anchor_path_value: Variant = npc_node.get_meta("label_anchor_path", NodePath(""))
	if typeof(anchor_path_value) == TYPE_NODE_PATH:
		var anchor_node: Node3D = npc_node.get_node_or_null(anchor_path_value) as Node3D
		if anchor_node != null and is_instance_valid(anchor_node):
			anchor_node.force_update_transform()
			return anchor_node.global_position

	return npc_node.global_position + Vector3(0.0, NPC_LABEL_WORLD_HEIGHT, 0.0)
		
func get_npc_overhead_label_entries(camera: Camera3D, viewport_size: Vector2) -> Array:
	var entries: Array = []

	if camera == null:
		return entries
		
	# The overhead label layer samples world transforms from a separate UI path.
	# Force the camera transform to be current before projecting 3D points into
	# screen space so labels do not trail behind camera motion within the frame.
	camera.force_update_transform()

	for npc_id_value in _rendered_npc_nodes_by_id.keys():
		var npc_id: String = str(npc_id_value)
		var npc_node: Node3D = _rendered_npc_nodes_by_id.get(npc_id, null) as Node3D
		if npc_node == null or not is_instance_valid(npc_node):
			continue
			
		# NPC movement is tween-driven. Force the current transform before reading
		# global_position so the screen-space label tracks the same up-to-date
		# world transform as the rendered actor.
		npc_node.force_update_transform()

		var label_world_position: Vector3 = _get_npc_label_world_position(npc_node)

		var is_behind: bool = camera.is_position_behind(label_world_position)
		if is_behind:
			entries.append({
				"npc_id": npc_id,
				"is_visible": false,
			})
			continue

		var screen_position: Vector2 = camera.unproject_position(label_world_position)
		var camera_distance: float = camera.global_position.distance_to(label_world_position)
		var is_on_screen: bool = (
			screen_position.x >= -100.0
			and screen_position.x <= viewport_size.x + 100.0
			and screen_position.y >= -100.0
			and screen_position.y <= viewport_size.y + 100.0
		)

		var npc_name: String = ""
		var npc_activity: String = ""

		var npc_data: Dictionary = _find_rendered_npc_data_by_id(npc_id)
		if not npc_data.is_empty():
			npc_name = str(npc_data.get("name", "NPC"))
			npc_activity = str(npc_data.get("current_activity", "Idle"))

		entries.append({
			"npc_id": npc_id,
			"name": npc_name,
			"activity": npc_activity,
			"screen_position": screen_position,
			"camera_distance": camera_distance,
			"is_visible": is_on_screen,
		})

	return entries

func _find_rendered_npc_data_by_id(npc_id: String) -> Dictionary:
	# The renderer stores live visual nodes, not authoritative data snapshots.
	# We cache the last known NPC payload on the node metadata so overhead UI can
	# be rebuilt without re-querying unrelated systems.
	var npc_node: Node3D = _rendered_npc_nodes_by_id.get(npc_id, null) as Node3D
	if npc_node == null or not is_instance_valid(npc_node):
		return {}

	var cached_value: Variant = npc_node.get_meta("npc_data", {})
	if typeof(cached_value) != TYPE_DICTIONARY:
		return {}

	return cached_value as Dictionary

func show_plot_detail(plot: Dictionary) -> void:
	# Full rebuild used for first entry into Player Plot mode.
	clear()

	if _content_root == null:
		return

	var detail = plot.get("detail", null)
	if typeof(detail) != TYPE_DICTIONARY or detail.is_empty():
		return

	var width : int = int(detail.get("width", 0))
	var height : int = int(detail.get("height", 0))
	if width <= 0 or height <= 0:
		return

	_last_plot_id = str(plot.get("id", ""))
	_last_plot_width = width
	_last_plot_height = height

	_render_plot_ground(width, height)
	_sync_starter_objects(detail, width, height)
	_sync_npcs(detail, width, height)

	
func refresh_plot_detail(plot: Dictionary) -> void:
	# Incremental refresh used when the active owned plot receives a plot_update.
	# This lets us animate removed rubble instead of instantly deleting everything.
	if _content_root == null:
		return

	var detail = plot.get("detail", null)
	if typeof(detail) != TYPE_DICTIONARY or detail.is_empty():
		clear()
		return

	var width : int = int(detail.get("width", 0))
	var height : int = int(detail.get("height", 0))
	if width <= 0 or height <= 0:
		clear()
		return

	var plot_id : String = str(plot.get("id", ""))
	var needs_full_rebuild : bool = (
		plot_id != _last_plot_id
		or width != _last_plot_width
		or height != _last_plot_height
		or _ground_node == null
	)

	if needs_full_rebuild:
		show_plot_detail(plot)
		return

	_sync_starter_objects(detail, width, height)
	_sync_npcs(detail, width, height)

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

	var material : ShaderMaterial = ShaderMaterial.new()
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

		var object_id : String = str(object_data.get("id", ""))
		if object_id == "":
			continue

		next_object_data_by_id[object_id] = object_data

		if _rendered_object_nodes_by_id.has(object_id):
			continue

		var obj_node : Node3D = _make_starter_object_node(object_data, width, height)
		if obj_node == null:
			continue

		_rendered_object_nodes_by_id[object_id] = obj_node
		_content_root.add_child(obj_node)

	var rendered_ids : Array = _rendered_object_nodes_by_id.keys()
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
	var kind : String = str(object_data.get("kind", ""))
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
		var visual_offset_range : float = CELL_SIZE_METERS * 0.5
		obj_node.position.x += randf_range(-visual_offset_range, visual_offset_range)
		obj_node.position.z += randf_range(-visual_offset_range, visual_offset_range)

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
			var rubble_node : Node3D = instance as Node3D
			rubble_node.name = "RubbleObject"
			rubble_node.scale = RUBBLE_ASSET_SCALE
			rubble_node.position.y = RUBBLE_ASSET_Y_OFFSET

			rubble_node.rotation_degrees.y = (
				RUBBLE_ASSET_Y_ROTATION_DEGREES
				+ randf_range(0.0, 360.0)
			)

			return rubble_node

	# Fallback if the rubble scene is missing or fails to instantiate.
	var node : Node3D = Node3D.new()
	node.name = "RubbleObjectFallback"

	var mesh_instance : MeshInstance3D = MeshInstance3D.new()
	var mesh : BoxMesh = BoxMesh.new()
	mesh.size = Vector3(
		float(footprint_w) * CELL_SIZE_METERS * 0.96,
		1.0,
		float(footprint_h) * CELL_SIZE_METERS * 0.96
	)
	mesh_instance.mesh = mesh

	var material : StandardMaterial3D = StandardMaterial3D.new()
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
) -> Node3D:
	if scene == null:
		return null

	var instance = scene.instantiate()
	if not (instance is Node3D):
		return null

	var wrapper : Node3D = Node3D.new()
	wrapper.name = node_name

	var visual : Node3D = instance as Node3D
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
	var node : Node3D = Node3D.new()
	node.name = "StarterShackFallback"

	var mesh_instance : MeshInstance3D = MeshInstance3D.new()
	var mesh : BoxMesh = BoxMesh.new()
	mesh.size = Vector3(
		float(footprint_w) * CELL_SIZE_METERS * 0.96,
		2.6,
		float(footprint_h) * CELL_SIZE_METERS * 0.96
	)
	mesh_instance.mesh = mesh

	var material : StandardMaterial3D = StandardMaterial3D.new()
	material.albedo_color = Color(0.64, 0.54, 0.36, 1.0)
	material.roughness = 0.95
	mesh_instance.material_override = material

	mesh_instance.position.y = 1.3
	node.add_child(mesh_instance)

	return node

func _make_npc_marker_placeholder() -> Node3D:
	var node : Node3D = Node3D.new()
	node.name = "StarterNPCMarker"

	var mesh_instance : MeshInstance3D = MeshInstance3D.new()
	var mesh : CylinderMesh = CylinderMesh.new()
	mesh.top_radius = NPC_PLACEHOLDER_RADIUS * 0.85
	mesh.bottom_radius = NPC_PLACEHOLDER_RADIUS
	mesh.height = NPC_PLACEHOLDER_HEIGHT
	mesh_instance.mesh = mesh

	var material : StandardMaterial3D = StandardMaterial3D.new()
	material.albedo_color = Color(0.24, 0.55, 0.78, 1.0)
	material.roughness = 0.85
	material.emission_enabled = true
	material.emission = Color(0.06, 0.12, 0.18, 1.0)
	mesh_instance.material_override = material

	mesh_instance.position.y = NPC_PLACEHOLDER_HEIGHT * 0.5
	node.add_child(mesh_instance)

	return node

func _sync_npcs(detail: Dictionary, width: int, height: int) -> void:
	var npcs: Variant = detail.get("npcs", [])
	if typeof(npcs) != TYPE_ARRAY:
		return

	var next_npc_data_by_id: Dictionary = {}
	var next_rendered_npc_nodes_by_id: Dictionary = {}

	for npc_data in npcs:
		if typeof(npc_data) != TYPE_DICTIONARY:
			continue

		var npc_dict: Dictionary = npc_data
		var npc_id: String = str(npc_dict.get("id", ""))
		if npc_id == "":
			continue

		next_npc_data_by_id[npc_id] = npc_dict

		var npc_node: Node3D = _rendered_npc_nodes_by_id.get(npc_id, null) as Node3D
		if npc_node == null or not is_instance_valid(npc_node):
			npc_node = _make_npc_actor()
			if npc_node == null:
				continue

			npc_node.name = "NPC_" + npc_id
			_content_root.add_child(npc_node)
			_apply_npc_snapshot_to_node(npc_node, npc_dict, width, height, true)
		else:
			_apply_npc_snapshot_to_node(npc_node, npc_dict, width, height, false)

		next_rendered_npc_nodes_by_id[npc_id] = npc_node

	for npc_id in _rendered_npc_nodes_by_id.keys():
		if next_rendered_npc_nodes_by_id.has(npc_id):
			continue

		var old_node: Node3D = _rendered_npc_nodes_by_id.get(npc_id, null) as Node3D
		if old_node != null and is_instance_valid(old_node):
			old_node.queue_free()

		var old_tween: Tween = _npc_move_tweens_by_id.get(npc_id, null) as Tween
		if old_tween != null:
			old_tween.kill()
		_npc_move_tweens_by_id.erase(npc_id)
		_npc_move_signatures_by_id.erase(npc_id)

	_rendered_npc_nodes_by_id = next_rendered_npc_nodes_by_id

func _make_npc_actor() -> Node3D:
	var node: Node3D = Node3D.new()
	node.name = "NPC_temp"

	# The click body is separate from the visual so:
	# - selection uses stable physics picking
	# - visuals can change later without breaking interaction
	# - future hover/right-click interactions can reuse the same actor root
	var click_body: StaticBody3D = StaticBody3D.new()
	click_body.name = "ClickBody"
	click_body.input_ray_pickable = true
	click_body.add_to_group("owned_plot_npc_click_body")

	var collision_shape: CollisionShape3D = CollisionShape3D.new()
	collision_shape.name = "CollisionShape3D"

	var capsule_shape: CapsuleShape3D = CapsuleShape3D.new()
	capsule_shape.radius = NPC_CLICK_BODY_RADIUS
	capsule_shape.height = NPC_CLICK_BODY_HEIGHT

	collision_shape.shape = capsule_shape
	collision_shape.position.y = 0.9
	click_body.add_child(collision_shape)
	node.add_child(click_body)

	var visual_root: Node3D = null

	if NPC_SCENE != null:
		var instance: Node = NPC_SCENE.instantiate()
		if instance is Node3D:
			var visual: Node3D = instance as Node3D
			visual.name = "Visual"
			visual.scale = Vector3(1.15, 1.15, 1.15)
			visual.position.y = 0.02
			node.add_child(visual)
			visual_root = visual
	else:
		var mesh_instance: MeshInstance3D = MeshInstance3D.new()
		mesh_instance.name = "Visual"

		var mesh: CylinderMesh = CylinderMesh.new()
		mesh.top_radius = 0.35
		mesh.bottom_radius = 0.4
		mesh.height = 1.7
		mesh_instance.mesh = mesh
		mesh_instance.position.y = 0.85

		var material: StandardMaterial3D = StandardMaterial3D.new()
		material.albedo_color = Color(0.24, 0.55, 0.78, 1.0)
		mesh_instance.material_override = material
		node.add_child(mesh_instance)
		visual_root = mesh_instance

	_attach_npc_label_anchor(node, visual_root)

	var selection_ring: MeshInstance3D = MeshInstance3D.new()
	selection_ring.name = "SelectionRing"

	var selection_ring_mesh: CylinderMesh = CylinderMesh.new()
	selection_ring_mesh.top_radius = NPC_SELECTION_RING_RADIUS_TOP
	selection_ring_mesh.bottom_radius = NPC_SELECTION_RING_RADIUS_BOTTOM
	selection_ring_mesh.height = NPC_SELECTION_RING_HEIGHT
	selection_ring.mesh = selection_ring_mesh
	selection_ring.position.y = NPC_SELECTION_RING_HEIGHT * 0.5
	selection_ring.visible = false

	var selection_ring_material: StandardMaterial3D = StandardMaterial3D.new()
	selection_ring_material.albedo_color = Color(0.92, 0.80, 0.42, 0.95)
	selection_ring_material.roughness = 0.35
	selection_ring_material.emission_enabled = true
	selection_ring_material.emission = Color(0.28, 0.22, 0.08, 1.0)
	selection_ring.material_override = selection_ring_material
	node.add_child(selection_ring)

	var carry_visual: MeshInstance3D = MeshInstance3D.new()
	carry_visual.name = "CarryVisual"

	var carry_mesh: BoxMesh = BoxMesh.new()
	carry_mesh.size = Vector3(0.35, 0.25, 0.35)
	carry_visual.mesh = carry_mesh
	carry_visual.position = Vector3(0.0, 1.3, -0.35)
	carry_visual.visible = false

	var carry_material: StandardMaterial3D = StandardMaterial3D.new()
	carry_material.albedo_color = Color(0.68, 0.53, 0.28, 1.0)
	carry_visual.material_override = carry_material
	node.add_child(carry_visual)
	
	return node

func _apply_npc_snapshot_to_node(
	npc_node: Node3D,
	npc_data: Dictionary,
	width: int,
	height: int,
	snap_immediately: bool
) -> void:
	var npc_id: String = str(npc_data.get("id", ""))
	npc_node.name = "NPC_" + npc_id
	npc_node.set_meta("npc_id", npc_id)
	npc_node.set_meta("npc_data", npc_data.duplicate(true))

	var click_body: StaticBody3D = npc_node.get_node_or_null("ClickBody") as StaticBody3D
	if click_body != null:
		click_body.set_meta("npc_id", npc_id)

	var current_pos: Vector3 = _object_anchor_to_local_position(
		int(npc_data.get("x", 0)),
		int(npc_data.get("y", 0)),
		1,
		1,
		width,
		height
	)

	var state: String = str(npc_data.get("state", "idle"))
	var has_move_target: bool = npc_data.get("move_to_x", null) != null and npc_data.get("move_to_y", null) != null

	var target_pos: Vector3 = current_pos
	if has_move_target:
		target_pos = _object_anchor_to_local_position(
			int(npc_data.get("move_to_x", 0)),
			int(npc_data.get("move_to_y", 0)),
			1,
			1,
			width,
			height
		)

	if snap_immediately:
		npc_node.position = current_pos

	var existing_tween: Tween = _npc_move_tweens_by_id.get(npc_id, null) as Tween

	if state in ["moving_to_target", "carrying_to_dropoff", "returning"] and has_move_target:
		var start_ms: int = int(npc_data.get("state_started_at_ms", 0))
		var end_ms: int = int(npc_data.get("state_ends_at_ms", 0))
		var move_signature: String = "%s|%s|%s|%s|%s" % [
			state,
			str(npc_data.get("move_to_x", "")),
			str(npc_data.get("move_to_y", "")),
			str(start_ms),
			str(end_ms)
		]

		var previous_signature: String = str(_npc_move_signatures_by_id.get(npc_id, ""))

		if previous_signature != move_signature:
			if existing_tween != null:
				existing_tween.kill()
				_npc_move_tweens_by_id.erase(npc_id)

			var now_ms: int = int(Time.get_unix_time_from_system() * 1000.0)
			var remaining_ms: int = maxi(0, end_ms - now_ms)
			var duration_sec: float = maxf(0.05, float(remaining_ms) / 1000.0)

			var tween: Tween = npc_node.create_tween()
			tween.tween_property(npc_node, "position", target_pos, duration_sec)

			_npc_move_tweens_by_id[npc_id] = tween
			_npc_move_signatures_by_id[npc_id] = move_signature
	else:
		if existing_tween != null:
			existing_tween.kill()
			_npc_move_tweens_by_id.erase(npc_id)

		_npc_move_signatures_by_id.erase(npc_id)
		npc_node.position = current_pos

	var carry_visual: MeshInstance3D = npc_node.get_node_or_null("CarryVisual") as MeshInstance3D
	if carry_visual != null:
		var carrying_kind: Variant = npc_data.get("carrying_kind", null)
		carry_visual.visible = carrying_kind != null

	_apply_npc_selection_state_to_node(
		npc_node,
		npc_id == _selected_npc_id
	)

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
	var local_x : float = (-width * CELL_SIZE_METERS * 0.5) + ((cell_x + (float(footprint_w) * 0.5)) * CELL_SIZE_METERS)
	var local_z : float = (-height * CELL_SIZE_METERS * 0.5) + ((cell_y + (float(footprint_h) * 0.5)) * CELL_SIZE_METERS)

	return Vector3(local_x, 0.02, local_z)
