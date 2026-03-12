extends Node
class_name NetClient

# -------------------------
# Signals (events HUD listens to)
# -------------------------
signal connected()
signal disconnected()
signal status_changed(text: String)

signal welcome_received(welcome: Dictionary)
signal identity_ready(player_id: String, display_name: String)

signal world_state_received(world: Dictionary)
signal plot_updated(plot: Dictionary)
signal world_patch_received(patch: Dictionary)
signal claim_result_received(result: Dictionary)
signal debug_clear_plot_cell_result_received(result: Dictionary)

signal latency_updated(ms: int)
signal presence_updated(online: Array) # array of {player_id, display_name}

# -------------------------
# Networking constants
# -------------------------
# Default: what the shipped game will auto-connect to (your public IP for now).
# Example: "ws://83.12.34.56:27015"
const DEFAULT_SERVER_URL := "ws://90.225.57.62:27015"
const PROTOCOL_VERSION := 2

# Optional local override:
# If this file exists, its contents will be used as the server URL.
# Put your LAN URL here on YOUR PC only (e.g. ws://192.168.0.50:27015)
const OVERRIDE_PATH := "user://server_url.txt"

var _server_url: String = DEFAULT_SERVER_URL

var _online_players: Array = []  # last known presence snapshot
var _pending_pings := {}         # req_id -> send_time_ms
var _latency_ms: float = -1.0

# -------------------------
# Internal networking state
# -------------------------
var _ws := WebSocketPeer.new()
var _is_connected := false
var _req_counter: int = 0

# Heartbeat: keeps server from disconnecting us due to inactivity
var _heartbeat_interval := 3.0
var _heartbeat_accum := 0.0

# -------------------------
# Profile + identity state
# -------------------------
# profile_name = what the user typed ("Alice") => selects local profile file
var profile_name: String = ""

# player_id/secret = server-issued identity credentials (persisted per profile)
var player_id: String = ""
var secret: String = ""

# display_name = human readable name; initially profile_name, later server may echo it back
var display_name: String = ""

func _ready() -> void:
	# We do NOT auto-connect anymore. UI should call connect_with_profile().
	_emit_status("Not connected. Enter username and press Connect.")

func _process(delta: float) -> void:
	_poll_ws()

	# Send a lightweight heartbeat so the server doesn't time us out.
	if _ws.get_ready_state() == WebSocketPeer.STATE_OPEN:
		_heartbeat_accum += delta
		if _heartbeat_accum >= _heartbeat_interval:
			_heartbeat_accum = 0.0
			var rid := _next_req_id()
			_pending_pings[rid] = Time.get_ticks_msec()
			_send("client_ping", { "client_ms": Time.get_ticks_msec() }, rid)

# -------------------------
# Public API (HUD calls these)
# -------------------------
func connect_with_profile(name: String) -> void:
	profile_name = name.strip_edges()
	if profile_name == "":
		_emit_status("Enter a username first.")
		return

	# Load profile credentials if they exist:
	# - If exists -> we authenticate with {player_id, secret}
	# - If not -> we register with {display_name}
	var prof := ProfileStore.load_profile(profile_name)
	player_id = str(prof.get("player_id", ""))
	secret = str(prof.get("secret", ""))
	display_name = str(prof.get("display_name", profile_name))

	_emit_status("Connecting as '%s' to %s..." % [profile_name, _resolve_server_url()])
	_connect_ws()

func request_world() -> void:
	_send("request_world", {}, _next_req_id())

func claim_plot(plot_id: String) -> void:
	_send("claim_plot", { "plot_id": plot_id }, _next_req_id())

func debug_clear_plot_cell(plot_id: String, x: int, y: int) -> void:
	# Temporary M2 debug action:
	# ask the server to clear one specific local cell on the owned plot.
	_send(
		"debug_clear_plot_cell",
		{
			"plot_id": plot_id,
			"x": x,
			"y": y,
		},
		_next_req_id()
	)

func _resolve_server_url() -> String:
	# Local override for you (LAN testing) without typing in-game.
	if FileAccess.file_exists(OVERRIDE_PATH):
		var f := FileAccess.open(OVERRIDE_PATH, FileAccess.READ)
		if f:
			var txt := f.get_as_text().strip_edges()
			if txt != "":
				return txt

	return DEFAULT_SERVER_URL

# -------------------------
# Internal networking
# -------------------------
func _connect_ws() -> void:
	_server_url = _resolve_server_url()
	var err = _ws.connect_to_url(_server_url)
	if err != OK:
		_emit_status("WS connect failed (%s): %s" % [_server_url, str(err)])
		return

func _poll_ws() -> void:
	_ws.poll()
	var state = _ws.get_ready_state()

	# Connection opened for the first time
	if state == WebSocketPeer.STATE_OPEN and not _is_connected:
		_is_connected = true
		emit_signal("connected")
		_emit_status("Connected. Sending hello...")

		# If we already have stored credentials for this profile, authenticate.
		# Otherwise, register a new identity using display_name.
		var payload := {}
		if player_id != "" and secret != "":
			payload = { "player_id": player_id, "secret": secret }
		else:
			payload = { "display_name": display_name }

		_send("hello", payload, _next_req_id())

	# Connection closed after being open
	if state == WebSocketPeer.STATE_CLOSED and _is_connected:
		_is_connected = false
		emit_signal("disconnected")
		_emit_status("Disconnected.")

	# Process incoming messages
	while _ws.get_available_packet_count() > 0:
		var pkt = _ws.get_packet()
		var txt = pkt.get_string_from_utf8()
		_handle_message(txt)

func _normalize_detail_from_wire(detail: Dictionary) -> Dictionary:
	# Convert compact wire detail into the richer client-side shape
	# the rest of the current M2 code already expects.
	#
	# Wire format:
	# - width
	# - height
	# - cell_rows: ["RRRGG...", ...]
	# - starter_objects
	#
	# Client runtime format:
	# - width
	# - height
	# - cells: [{x,y,blocked,clearable,terrain}, ...]
	# - starter_objects
	var normalized := detail.duplicate(true)

	if normalized.has("cells"):
		return normalized

	var raw_rows = normalized.get("cell_rows", null)
	if typeof(raw_rows) != TYPE_ARRAY:
		return normalized

	var width = int(normalized.get("width", 0))
	var height = int(normalized.get("height", 0))
	var cells: Array = []

	for y in range(min(height, raw_rows.size())):
		var row_text := str(raw_rows[y])

		for x in range(min(width, row_text.length())):
			var ch := row_text.substr(x, 1)

			if ch == "R":
				cells.append({
					"x": x,
					"y": y,
					"blocked": true,
					"clearable": true,
					"terrain": "RUBBLE",
				})
			else:
				cells.append({
					"x": x,
					"y": y,
					"blocked": false,
					"clearable": false,
					"terrain": "GROUND",
				})

	normalized["cells"] = cells
	return normalized

func _normalize_plot_from_wire(plot: Dictionary) -> Dictionary:
	var normalized := plot.duplicate(true)

	var raw_detail = normalized.get("detail", null)
	if typeof(raw_detail) == TYPE_DICTIONARY and not raw_detail.is_empty():
		normalized["detail"] = _normalize_detail_from_wire(raw_detail)

	return normalized

func _normalize_world_from_wire(world: Dictionary) -> Dictionary:
	var normalized := world.duplicate(true)

	var raw_plots = normalized.get("plots", null)
	if typeof(raw_plots) != TYPE_ARRAY:
		return normalized

	var plots: Array = []
	for raw_plot in raw_plots:
		if typeof(raw_plot) == TYPE_DICTIONARY:
			plots.append(_normalize_plot_from_wire(raw_plot))
		else:
			plots.append(raw_plot)

	normalized["plots"] = plots
	return normalized

func _normalize_patch_from_wire(patch: Dictionary) -> Dictionary:
	var normalized := patch.duplicate(true)

	var raw_added = normalized.get("added", null)
	if typeof(raw_added) == TYPE_ARRAY:
		var added: Array = []
		for raw_plot in raw_added:
			if typeof(raw_plot) == TYPE_DICTIONARY:
				added.append(_normalize_plot_from_wire(raw_plot))
			else:
				added.append(raw_plot)
		normalized["added"] = added

	return normalized

func _handle_message(txt: String) -> void:
	var msg = JSON.parse_string(txt)
	if typeof(msg) != TYPE_DICTIONARY:
		return

	var msg_type: String = msg.get("type", "")
	var payload: Dictionary = msg.get("payload", {})

	match msg_type:
		"hello_ok":
			# (Some servers may send hello_ok; ours sends welcome instead.)
			_emit_status("Hello OK")
		"welcome":
			# payload: { player_id, secret, display_name }
			player_id = str(payload.get("player_id", ""))
			secret = str(payload.get("secret", ""))
			display_name = str(payload.get("display_name", profile_name))

			# Save/update this profile on disk so reconnect works forever.
			var save := {
				"profile_name": profile_name,
				"player_id": player_id,
				"secret": secret,
				"display_name": display_name
			}
			ProfileStore.save_profile(profile_name, save)

			emit_signal("welcome_received", payload)
			emit_signal("identity_ready", player_id, display_name)

			_emit_status("Welcome '%s' (%s)" % [display_name, player_id])

			# Ask for world snapshot (safe even if server also sends it)
			request_world()

		"world_state":
			# payload: { world: { version, plots: [...] } }
			var world_payload: Dictionary = payload.get("world", {})
			emit_signal("world_state_received", _normalize_world_from_wire(world_payload))

		"plot_update":
			# payload: { plot: {...}, owner_display_name?: "Alice" }
			var p: Dictionary = _normalize_plot_from_wire(payload.get("plot", {}))

			# If server provided a name, store it on the plot dict.
			# This makes PlotView able to show the correct owner name even if
			# world.players is stale on this client.
			if payload.has("owner_display_name"):
				p["owner_display_name"] = str(payload.get("owner_display_name", ""))

			emit_signal("plot_updated", p)

		"world_patch":
			emit_signal("world_patch_received", _normalize_patch_from_wire(payload))

		"claim_result":
			emit_signal("claim_result_received", payload)

		"debug_clear_plot_cell_result":
			emit_signal("debug_clear_plot_cell_result_received", payload)

		"error":
			_emit_status("Server error: %s" % str(payload))
			
		"presence_state":
			# payload: { online: [ {player_id, display_name}, ... ] }
			_online_players = payload.get("online", [])
			emit_signal("presence_updated", _online_players)

		"server_pong":
			# Compute RTT using the request id of the pong (if present)
			var rid = str(msg.get("req_id", ""))
			if _pending_pings.has(rid):
				var sent_ms = int(_pending_pings[rid])
				_pending_pings.erase(rid)
				var rtt = Time.get_ticks_msec() - sent_ms

				# Light smoothing so it doesn't jump around
				if _latency_ms < 0:
					_latency_ms = float(rtt)
				else:
					_latency_ms = lerp(_latency_ms, float(rtt), 0.25)

				emit_signal("latency_updated", int(round(_latency_ms)))

		_:
			# Ignore unknown messages for now.
			pass

func _send(type_name: String, payload: Dictionary, req_id: String) -> void:
	if _ws.get_ready_state() != WebSocketPeer.STATE_OPEN:
		return

	var env := {
		"v": PROTOCOL_VERSION,
		"type": type_name,
		"req_id": req_id,
		"payload": payload
	}
	_ws.send_text(JSON.stringify(env))

func _next_req_id() -> String:
	_req_counter += 1
	return "g%d" % _req_counter

func _emit_status(t: String) -> void:
	emit_signal("status_changed", t)
