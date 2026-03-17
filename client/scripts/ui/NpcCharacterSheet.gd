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
	var traits_variant: Variant = npc.get("traits", [])

	title_label.text = "Character Sheet"
	name_value_label.text = npc_name
	role_value_label.text = _format_role_text(npc_role)
	activity_value_label.text = npc_activity
	state_value_label.text = _format_state_text(npc_state)
	assignment_value_label.text = _format_optional_text(assigned_order_variant, "None")
	target_value_label.text = _format_optional_text(target_variant, "None")
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
