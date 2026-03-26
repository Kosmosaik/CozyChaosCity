extends PanelContainer
class_name NpcCharacterSheet

# NpcCharacterSheet is a pure presentation component.
#
# Responsibilities:
# - show player-facing NPC identity/details
# - format one selected NPC dictionary into readable labels
# - stay reusable for future stats/traits expansion
#
# It does NOT:
# - own world selection state
# - query GameWorld3D directly
# - decide which NPC is selected
# - issue orders

@onready var title_label: Label = $MarginContainer/VBoxContainer/TitleLabel
@onready var name_value_label: Label = $MarginContainer/VBoxContainer/InfoGrid/NameValueLabel
@onready var role_value_label: Label = $MarginContainer/VBoxContainer/InfoGrid/RoleValueLabel
@onready var activity_value_label: Label = $MarginContainer/VBoxContainer/InfoGrid/ActivityValueLabel
@onready var state_value_label: Label = $MarginContainer/VBoxContainer/InfoGrid/StateValueLabel
@onready var assignment_value_label: Label = $MarginContainer/VBoxContainer/InfoGrid/AssignmentValueLabel
@onready var target_value_label: Label = $MarginContainer/VBoxContainer/InfoGrid/TargetValueLabel
@onready var carrying_value_label: Label = $MarginContainer/VBoxContainer/InfoGrid/CarryingValueLabel
@onready var dropoff_value_label: Label = $MarginContainer/VBoxContainer/InfoGrid/DropoffValueLabel
@onready var traits_value_label: Label = $MarginContainer/VBoxContainer/TraitsValueLabel
@onready var future_stats_value_label: Label = $MarginContainer/VBoxContainer/FutureStatsValueLabel

func _ready() -> void:
	clear_panel()

func clear_panel() -> void:
	visible = false
	title_label.text = "Character Sheet"
	name_value_label.text = "-"
	role_value_label.text = "-"
	activity_value_label.text = "-"
	state_value_label.text = "-"
	assignment_value_label.text = "-"
	target_value_label.text = "-"
	carrying_value_label.text = "-"
	dropoff_value_label.text = "-"
	traits_value_label.text = "No traits yet."
	future_stats_value_label.text = "Skills / stats will be added in a later phase."

func show_npc(npc: Dictionary) -> void:
	if npc.is_empty():
		clear_panel()
		return

	visible = true

	var npc_name: String = str(npc.get("name", "Unknown NPC"))
	var npc_role: String = str(npc.get("job_type", "UNKNOWN"))
	var npc_activity: String = str(npc.get("current_activity", "Unknown"))
	var npc_state: String = str(npc.get("state", "unknown"))
	var assigned_order_variant: Variant = npc.get("assigned_order", null)
	var target_variant: Variant = npc.get("target_object_id", null)
	var carry_slots_variant: Variant = npc.get("carry_slots", [])
	var haul_target_mode_variant: Variant = npc.get("haul_target_mode", null)
	var haul_target_object_id_variant: Variant = npc.get("haul_target_object_id", null)
	var traits_variant: Variant = npc.get("traits", [])

	title_label.text = "Character Sheet"
	name_value_label.text = npc_name
	role_value_label.text = _format_role_text(npc_role)
	activity_value_label.text = npc_activity
	state_value_label.text = _format_state_text(npc_state)
	assignment_value_label.text = _format_optional_text(assigned_order_variant, "None")
	target_value_label.text = _format_optional_text(target_variant, "None")
	carrying_value_label.text = _format_carry_slots_text(carry_slots_variant)
	dropoff_value_label.text = _format_dropoff_text(
		haul_target_mode_variant,
		haul_target_object_id_variant
	)
	traits_value_label.text = _format_traits_text(traits_variant)
	future_stats_value_label.text = "Skills / stats will be added in a later phase."

func _format_role_text(role_text: String) -> String:
	match role_text:
		"SCAVENGER":
			return "Scavenger"
		"LABORER":
			return "Laborer"
		_:
			return role_text.capitalize()

func _format_state_text(state_text: String) -> String:
	return state_text.replace("_", " ").capitalize()

func _format_optional_text(value: Variant, fallback_text: String) -> String:
	if value == null:
		return fallback_text

	var text: String = str(value)
	if text == "":
		return fallback_text

	return text

func _format_carry_slots_text(carry_slots_variant: Variant) -> String:
	if typeof(carry_slots_variant) != TYPE_ARRAY:
		return "None"

	var carry_slots: Array = carry_slots_variant as Array
	for carry_slot_value in carry_slots:
		if typeof(carry_slot_value) != TYPE_DICTIONARY:
			continue

		var carry_slot: Dictionary = carry_slot_value as Dictionary
		var item_id: String = str(carry_slot.get("item_id", ""))
		var quantity: int = _read_non_negative_whole_number(carry_slot.get("quantity", 0))

		if item_id == "" or quantity <= 0:
			continue

		return _format_item_name(item_id) + " x" + str(quantity)

	return "None"

func _format_dropoff_text(
	haul_target_mode_variant: Variant,
	haul_target_object_id_variant: Variant
) -> String:
	if haul_target_mode_variant == null:
		return "None"

	var haul_target_mode: String = str(haul_target_mode_variant)
	if haul_target_mode == "":
		return "None"

	match haul_target_mode:
		"DUMP_ZONE":
			# Keep the UI readable first. We can expose exact ids later in the
			# debug overlay where raw verification data belongs more naturally.
			return "Dump Zone"

		"GROUND":
			return "Ground fallback"

		_:
			var raw_target_text: String = haul_target_mode.replace("_", " ").capitalize()
			var haul_target_object_id: String = str(haul_target_object_id_variant)
			if haul_target_object_id == "":
				return raw_target_text

			return raw_target_text + " (" + haul_target_object_id + ")"

func _format_item_name(item_id: String) -> String:
	match item_id:
		"SCRAP_WOOD":
			return "Scrap Wood"
		"SCRAP_METAL":
			return "Scrap Metal"
		"TARP":
			return "Tarp"
		"MIXED_SALVAGE":
			return "Mixed Salvage"
		"WOODEN_PALLET":
			return "Wooden Pallet"
		_:
			return item_id.replace("_", " ").capitalize()

func _read_non_negative_whole_number(value: Variant) -> int:
	# Network-decoded numeric fields may arrive as int or float.
	# This keeps the UI resilient without assuming one exact wire runtime type.
	if typeof(value) == TYPE_INT:
		var int_value: int = value
		return maxi(0, int_value)

	if typeof(value) == TYPE_FLOAT:
		var float_value: float = value
		return maxi(0, int(round(float_value)))

	return 0

func _format_traits_text(traits_variant: Variant) -> String:
	if typeof(traits_variant) != TYPE_ARRAY:
		return "No traits yet."

	var traits: Array = traits_variant as Array
	if traits.is_empty():
		return "No traits yet."

	var parts: Array[String] = []
	for trait_variant in traits:
		parts.append(str(trait_variant))

	return ", ".join(parts)
