extends Control

signal plot_selected(plot_id: String, is_claimable: bool)

# -------------------------
# World data
# -------------------------
var world_version: int = 0
var plots: Array = []  # array of dictionaries: {id, type, x, y, claimed_by}

var my_player_id: String = ""
var players_by_id: Dictionary = {} # player_id -> {id, secret, display_name}

func set_my_player_id(id: String) -> void:
	my_player_id = id
	queue_redraw()

# -------------------------
# UI state
# -------------------------
var selected_id: String = ""
var cell_size := Vector2(90, 60)
var padding := Vector2(10, 10)

func set_world(world: Dictionary) -> void:
	world_version = int(world.get("version", 0))
	plots = world.get("plots", [])
	players_by_id = world.get("players", {})
	selected_id = ""
	queue_redraw()

func apply_plot_update(plot: Dictionary) -> void:
	var pid = str(plot.get("id", ""))
	for i in range(plots.size()):
		if str(plots[i].get("id", "")) == pid:
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
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.12, 0.12, 0.12), true)

	if plots.is_empty():
		return

	var bounds := _get_bounds()
	var min_x: int = bounds.min_x
	var min_y: int = bounds.min_y

	for i in range(plots.size()):
		var p: Dictionary = plots[i]
		var r := _rect_for_plot(p, min_x, min_y)

		draw_rect(r, _plot_color(p), true)
		draw_rect(r, Color(0,0,0), false, 2.0)

		if str(p.get("id","")) == selected_id:
			draw_rect(r.grow(2), Color(1, 1, 1), false, 3.0)

		var label := "%s" % p.get("id", "?")

		if str(p.get("type","")) == "RESOURCE":
			label += " RES"
		else:
			var claimed_by = p.get("claimed_by", null)
			if claimed_by != null:
				var owner_id := str(claimed_by)
				# Prefer name bundled with plot_update (if present), otherwise map via players_by_id,
				# otherwise fall back to the raw player_id.
				var owner_name := str(p.get("owner_display_name", ""))
				if owner_name == "":
					owner_name = _display_name_for_player(owner_id)

				if owner_id == my_player_id and my_player_id != "":
					label += " MINE"
				else:
					label += " TAKEN"

				# Second line: owner display name
				draw_string(get_theme_default_font(), r.position + Vector2(6, 36), "Owner: %s" % owner_name, HORIZONTAL_ALIGNMENT_LEFT, -1, 14)
			else:
				label += " FREE"

		draw_string(get_theme_default_font(), r.position + Vector2(6, 18), label, HORIZONTAL_ALIGNMENT_LEFT, -1, 14)

# -------------------------
# Coordinate layout helpers
# -------------------------
class Bounds:
	var min_x: int
	var max_x: int
	var min_y: int
	var max_y: int

func _get_bounds() -> Bounds:
	var b := Bounds.new()
	b.min_x = int(plots[0].get("x", 0))
	b.max_x = b.min_x
	b.min_y = int(plots[0].get("y", 0))
	b.max_y = b.min_y

	for p in plots:
		var x := int(p.get("x", 0))
		var y := int(p.get("y", 0))
		b.min_x = min(b.min_x, x)
		b.max_x = max(b.max_x, x)
		b.min_y = min(b.min_y, y)
		b.max_y = max(b.max_y, y)

	return b

func _rect_for_plot(p: Dictionary, min_x: int, min_y: int) -> Rect2:
	var x := int(p.get("x", 0))
	var y := int(p.get("y", 0))

	# Normalize so the smallest x/y starts at 0,0 on screen
	var gx := x - min_x
	var gy := y - min_y

	var pos = padding + Vector2(gx * (cell_size.x + padding.x), gy * (cell_size.y + padding.y))
	return Rect2(pos, cell_size)

func _plot_index_from_pos(pos: Vector2) -> int:
	if plots.is_empty():
		return -1

	var bounds := _get_bounds()
	for i in range(plots.size()):
		var r := _rect_for_plot(plots[i], bounds.min_x, bounds.min_y)
		if r.has_point(pos):
			return i

	return -1

func _is_plot_claimable(p: Dictionary) -> bool:
	if str(p.get("type","")) != "PLAYER":
		return false
	return p.get("claimed_by", null) == null

func _plot_color(p: Dictionary) -> Color:
	var t := str(p.get("type",""))
	if t == "RESOURCE":
		return Color(0.95, 0.75, 0.2) # resource plot

	var claimed_by = p.get("claimed_by", null)
	if claimed_by != null:
		if str(claimed_by) == my_player_id and my_player_id != "":
			return Color(0.2, 0.85, 0.35) # MINE
		return Color(0.45, 0.45, 0.45) # TAKEN

	return Color(0.2, 0.6, 0.9) # FREE

func _display_name_for_player(pid: String) -> String:
	if players_by_id.has(pid):
		return str(players_by_id[pid].get("display_name", pid))
	return pid
