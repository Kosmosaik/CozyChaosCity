extends RefCounted
class_name PlotOrderMenuEntry

# PlotOrderMenuEntry is the typed client view-model for one Orders menu row.
# It lets the order-definition layer decide:
# - which order exists
# - whether it is enabled
# - whether a disabled hint should be shown
#
# This keeps menu presentation simple while allowing some disabled states
# to stay visually quiet instead of always printing a label under the button.

var entry_id: String
var action_type: String
var order_kind: String
var label: String
var target_scope: String
var enabled: bool
var disabled_reason: String
var show_disabled_reason: bool

func _init(
	p_entry_id: String,
	p_action_type: String,
	p_order_kind: String,
	p_label: String,
	p_target_scope: String,
	p_enabled: bool,
	p_disabled_reason: String = "",
	p_show_disabled_reason: bool = true
) -> void:
	entry_id = p_entry_id
	action_type = p_action_type
	order_kind = p_order_kind
	label = p_label
	target_scope = p_target_scope
	enabled = p_enabled
	disabled_reason = p_disabled_reason
	show_disabled_reason = p_show_disabled_reason
