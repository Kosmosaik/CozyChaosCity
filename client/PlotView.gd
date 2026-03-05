extends Control

signal plot_selected(plot_id: String, is_claimable: bool)

# -------------------------
# World data
# -------------------------
var world_version: int = 0
var plots: Array = []  # array of dictionaries: {id, type, claimed_by}

# This is your *server-issued* identity id (NOT a username).
# We compare claimed_by == my_player_id to decide if a plot is MINE.
var my_player_id: String = ""

func set_my_player_id(id: String) -> void:
	# Called by HUD when NetClient receives "welcome"
	my_player_id = id
	queue_redraw()

# -------------------------
# UI state
# -------------------------
var selected_id: String = ""
var cell_size := Vector2(90, 60)
var padding := Vector2(10, 10)
var cols := 6  # simple layout for M0

func set_world(world: Dictionary) -> void:
	world_version = int(world.get("version", 0))
	plots = world.get("plots", [])
	selected_id = ""
	queue_redraw()

func apply_plot_update(plot: Dictionary) -> void:
	var pid = plot.get("id", "")
	for i in range(plots.size()):
		if plots[i].get("id", "") == pid:
			plots[i] = plot
			break
	queue_redraw()

func apply_world_patch(patch: Dictionary) -> void:
	var added: Array = patch.get("added", [])
	for p in added:
		plots.append(p)
	world_version = int(patch.get("world_version", world_version))
	queue_redraw()

func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		var idx = _plot_index_from_pos(event.position)
		if idx == -1:
			return
		var p: Dictionary = plots[idx]
		selected_id = str(p.get("id", ""))
		var claimable = _is_plot_claimable(p)
		emit_signal("plot_selected", selected_id, claimable)
		queue_redraw()

func _draw() -> void:
	# background
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.12, 0.12, 0.12), true)

	for i in range(plots.size()):
		var p: Dictionary = plots[i]
		var r := _rect_for_index(i)

		var base_color := _plot_color(p)
		draw_rect(r, base_color, true)

		# border
		draw_rect(r, Color(0,0,0), false, 2.0)

		# selected highlight
		if str(p.get("id","")) == selected_id:
			draw_rect(r.grow(2), Color(1, 1, 1), false, 3.0)

		# text label
		var label := "%s" % p.get("id", "?")

		# NOTE: You asked to call these "resource plot / res-plot".
		# Internally, type is still "RES_SHARED" for now.
		if p.get("type","") == "RES_SHARED":
			label += " RES-PLOT"
		else:
			var claimed_by = p.get("claimed_by", null)
			if claimed_by != null:
				# claimed_by is the server-issued player_id
				if str(claimed_by) == my_player_id and my_player_id != "":
					label += " MINE"
				else:
					label += " TAKEN"
			else:
				label += " FREE"

		draw_string(get_theme_default_font(), r.position + Vector2(6, 18), label, HORIZONTAL_ALIGNMENT_LEFT, -1, 14)

func _rect_for_index(i: int) -> Rect2:
	var row = i / cols
	var col = i % cols
	var pos = padding + Vector2(col * (cell_size.x + padding.x), row * (cell_size.y + padding.y))
	return Rect2(pos, cell_size)

func _plot_index_from_pos(pos: Vector2) -> int:
	for i in range(plots.size()):
		if _rect_for_index(i).has_point(pos):
			return i
	return -1

func _is_plot_claimable(p: Dictionary) -> bool:
	if p.get("type","") != "PLAYER":
		return false
	return p.get("claimed_by", null) == null

func _plot_color(p: Dictionary) -> Color:
	var t = p.get("type","")
	if t == "RES_SHARED":
		return Color(0.95, 0.75, 0.2) # res-plot (resource plot)

	var claimed_by = p.get("claimed_by", null)
	if claimed_by != null:
		if str(claimed_by) == my_player_id and my_player_id != "":
			return Color(0.2, 0.85, 0.35) # MINE = green
		return Color(0.45, 0.45, 0.45) # TAKEN = grey

	return Color(0.2, 0.6, 0.9) # FREE = blue
