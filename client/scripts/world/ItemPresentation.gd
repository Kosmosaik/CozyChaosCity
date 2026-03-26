extends RefCounted
class_name ItemPresentation

# ItemPresentation centralizes client-only presentation defaults for logistics items.
#
# Responsibilities:
# - keep item-to-color mapping consistent across world props and UI
# - provide small presentation helpers that do not belong in server/domain code
#
# Important:
# - this file is presentation-only
# - it must not contain gameplay rules or routing logic
# - it must not become a data authority replacing server item definitions

static func get_item_color(item_id: String) -> Color:
	match item_id:
		"SCRAP_WOOD":
			return Color(0.55, 0.40, 0.22, 1.0)
		"SCRAP_METAL":
			return Color(0.55, 0.58, 0.62, 1.0)
		"TARP":
			return Color(0.24, 0.36, 0.62, 1.0)
		"MIXED_SALVAGE":
			return Color(0.45, 0.30, 0.18, 1.0)
		"WOODEN_PALLET":
			return Color(0.66, 0.50, 0.28, 1.0)
		_:
			return Color(0.65, 0.20, 0.65, 1.0)

static func apply_placeholder_carry_visual(
	mesh_instance: MeshInstance3D,
	item_id: String,
	quantity: int
) -> void:
	# Carry visuals and loose-item visuals must share the same base item shape
	# language so a carried item still reads as the same object after drop-off.
	if mesh_instance == null:
		return

	_ensure_placeholder_material(mesh_instance, item_id)

	var mesh: BoxMesh = mesh_instance.mesh as BoxMesh
	if mesh == null:
		mesh = BoxMesh.new()
		mesh_instance.mesh = mesh

	mesh.size = _get_placeholder_box_size(item_id)
	# Carry presentation no longer scales by quantity.
	# Loose-ground quantity is now shown as repeated item visuals instead.
	mesh_instance.scale = Vector3.ONE

static func apply_placeholder_loose_item_visual(
	mesh_instance: MeshInstance3D,
	item_id: String,
	quantity: int
) -> float:
	# Loose items use the same base item shape as carried items.
	# The only difference is that merged ground stacks may scale up slightly.
	if mesh_instance == null:
		return 0.0

	_ensure_placeholder_material(mesh_instance, item_id)

	var mesh: BoxMesh = mesh_instance.mesh as BoxMesh
	if mesh == null:
		mesh = BoxMesh.new()
		mesh_instance.mesh = mesh

	var base_size: Vector3 = _get_placeholder_box_size(item_id)
	mesh.size = base_size

	# Loose-ground quantity is no longer shown by scaling one mesh larger.
	# ItemVisualNode now renders one unit visual per item on the tile instead.
	mesh_instance.scale = Vector3.ONE

	return base_size.y

static func _ensure_placeholder_material(
	mesh_instance: MeshInstance3D,
	item_id: String
) -> void:
	var material: StandardMaterial3D = mesh_instance.material_override as StandardMaterial3D
	if material == null:
		material = StandardMaterial3D.new()
		mesh_instance.material_override = material

	material.albedo_color = get_item_color(item_id)
	material.roughness = 0.95

static func _get_placeholder_box_size(item_id: String) -> Vector3:
	# These are still placeholder meshes, but they are now stable and shared
	# between carry presentation and loose ground presentation.
	match item_id:
		"SCRAP_WOOD":
			return Vector3(0.46, 0.14, 0.18)
		"SCRAP_METAL":
			return Vector3(0.28, 0.24, 0.28)
		"TARP":
			return Vector3(0.50, 0.06, 0.38)
		"MIXED_SALVAGE":
			return Vector3(0.34, 0.30, 0.34)
		"WOODEN_PALLET":
			return Vector3(0.58, 0.08, 0.58)
		_:
			return Vector3(0.35, 0.25, 0.35)
