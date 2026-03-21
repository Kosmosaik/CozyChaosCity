extends Node
class_name NetClient

const WireAdapter = preload("res://scripts/net/WireAdapters.gd")

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
signal clear_plot_object_result_received(result: Dictionary)
signal issue_plot_order_result_received(result: Dictionary)
signal cancel_plot_order_result_received(result: Dictionary)


signal latency_updated(ms: int)
signal presence_updated(online: Array) # array of {player_id, display_name}

# -------------------------
# Networking constants
# -------------------------
# Default: what the shipped game will auto-connect to (your public IP for now).
# Example: "ws://83.12.34.56:27015"
const DEFAULT_SERVER_URL := "ws://90.225.57.62:27015"
const PROTOCOL_VERSION := 3

# Optional local override:
# If this file exists, its contents will be used as the server URL.
# Put your LAN URL here on YOUR PC only (e.g. ws://192.168.0.50:27015)
const OVERRIDE_PATH := "user://server_url.txt"

var _server_url: String = DEFAULT_SERVER_URL

var _online_players: Array = []      # last known presence snapshot
var _pending_pings: Dictionary = {}  # req_id -> send_time_ms
var _latency_ms: float = -1.0

# -------------------------
# Internal networking state
# -------------------------
var _ws: WebSocketPeer = WebSocketPeer.new()
var _is_connected: bool = false
var _is_connecting: bool = false
var _req_counter: int = 0

# Heartbeat: keeps server from disconnecting us due to inactivity
var _heartbeat_interval: float = 3.0
var _heartbeat_accum: float = 0.0

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
			var request_id: String = _next_req_id()
			_pending_pings[request_id] = Time.get_ticks_msec()
			_send("client_ping", { "client_ms": Time.get_ticks_msec() }, request_id)

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
	var prof: Dictionary = ProfileStore.load_profile(profile_name)
	player_id = str(prof.get("player_id", ""))
	secret = str(prof.get("secret", ""))
	display_name = str(prof.get("display_name", profile_name))

	var resolved_server_url: String = _resolve_server_url()
	if resolved_server_url == "":
		_emit_status("Server URL is missing or invalid.")
		return

	_emit_status("Connecting as '%s' to %s..." % [profile_name, resolved_server_url])
	_connect_ws(resolved_server_url)

func request_world() -> void:
	_send("request_world", {}, _next_req_id())

func claim_plot(plot_id: String) -> void:
	_send("claim_plot", { "plot_id": plot_id }, _next_req_id())
	
func clear_plot_object(plot_id: String, object_id: String) -> void:
	# Real M2 local interaction:
	# ask the server to clear one specific starter object on the owned plot.
	_send(
		"clear_plot_object",
		{
			"plot_id": plot_id,
			"object_id": object_id,
		},
		_next_req_id()
	)
	
func issue_plot_order(plot_id: String, order_kind: String, target_scope: String) -> void:
	_send(
		"issue_plot_order",
		{
			"plot_id": plot_id,
			"order_kind": order_kind,
			"target_scope": target_scope,
		},
		_next_req_id()
	)
	
func cancel_plot_order(plot_id: String) -> void:
	_send(
		"cancel_plot_order",
		{
			"plot_id": plot_id,
		},
		_next_req_id()
	)

func _read_override_server_url() -> String:
	# Optional per-machine override for local/LAN testing.
	# This keeps the public-IP default in source control while still letting
	# your own machine point somewhere else without editing the scene/UI.
	if not FileAccess.file_exists(OVERRIDE_PATH):
		return ""

	var file: FileAccess = FileAccess.open(OVERRIDE_PATH, FileAccess.READ)
	if file == null:
		return ""

	return _sanitize_server_url(file.get_as_text())

func _sanitize_server_url(raw_url: String) -> String:
	return raw_url.strip_edges()

func _is_supported_server_url(url: String) -> bool:
	return url.begins_with("ws://") or url.begins_with("wss://")

func _clear_presence_snapshot() -> void:
	if _online_players.is_empty():
		return

	_online_players = []
	emit_signal("presence_updated", _online_players)

func _reset_connection_runtime_state() -> void:
	# These values belong to one live connection session only.
	# Reset them before a new connect attempt and after disconnect so we do not
	# keep stale latency/presence/ping state around in the UI.
	_pending_pings.clear()
	_heartbeat_accum = 0.0
	_latency_ms = -1.0
	_clear_presence_snapshot()

func _reset_socket_for_new_connection() -> void:
	# Always start a fresh socket object for a new connection attempt.
	# This avoids carrying half-open or previously closed peer state into the
	# next attempt.
	if _ws.get_ready_state() != WebSocketPeer.STATE_CLOSED:
		_ws.close()

	_ws = WebSocketPeer.new()
	_is_connected = false
	_is_connecting = false
	_reset_connection_runtime_state()

func _resolve_server_url() -> String:
	var override_url: String = _read_override_server_url()
	if override_url != "":
		if _is_supported_server_url(override_url):
			return override_url

		push_warning("Ignoring invalid server_url.txt override. Expected ws:// or wss:// URL.")

	var default_url: String = _sanitize_server_url(DEFAULT_SERVER_URL)
	if _is_supported_server_url(default_url):
		return default_url

	push_warning("DEFAULT_SERVER_URL is invalid. Expected ws:// or wss:// URL.")
	return ""
	
func _connect_ws(server_url: String) -> void:
	_server_url = server_url
	_reset_socket_for_new_connection()

	var err: int = _ws.connect_to_url(_server_url)
	if err != OK:
		# Reset again so failed attempts do not leave ambiguous socket state
		# behind for the next connect attempt.
		_reset_socket_for_new_connection()
		_emit_status("WS connect failed (%s): %s" % [_server_url, str(err)])
		return

	_is_connecting = true

# -------------------------
# Internal networking
# -------------------------
func _poll_ws() -> void:
	_ws.poll()
	var state: int = _ws.get_ready_state()

	# Connection opened for the first time
	if state == WebSocketPeer.STATE_OPEN and not _is_connected:
		_is_connected = true
		_is_connecting = false
		emit_signal("connected")
		_emit_status("Connected. Sending hello...")

		# If we already have stored credentials for this profile, authenticate.
		# Otherwise, register a new identity using display_name.
		var payload: Dictionary = {}
		if player_id != "" and secret != "":
			payload = {
				"player_id": player_id,
				"secret": secret,
				"display_name": display_name,
			}
		else:
			payload = { "display_name": display_name }

		_send("hello", payload, _next_req_id())

	# Handle both:
	# - real disconnects after being connected
	# - connection attempts that close before login/handshake completes
	if state == WebSocketPeer.STATE_CLOSED and (_is_connected or _is_connecting):
		var was_connected: bool = _is_connected

		_is_connected = false
		_is_connecting = false
		_reset_connection_runtime_state()

		if was_connected:
			emit_signal("disconnected")
			_emit_status("Disconnected.")
		else:
			_emit_status("Connection closed before login completed.")

	# Process incoming messages
	while _ws.get_available_packet_count() > 0:
		var packet: PackedByteArray = _ws.get_packet()
		var text: String = packet.get_string_from_utf8()
		_handle_message(text)

func _handle_message(txt: String) -> void:
	var msg = JSON.parse_string(txt)
	if typeof(msg) != TYPE_DICTIONARY:
		return

	var msg_type: String = msg.get("type", "")
	var payload: Dictionary = msg.get("payload", {})

	# Capture a monotonic local receive time once for this message.
	# We will combine this with the server-authored timestamp carried in the
	# payload so rendering can estimate "current server time" safely.
	var received_local_ms: int = Time.get_ticks_msec()

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
			var save: Dictionary = {
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

		"world_state":
			# payload: { world: { version, plots: [...] }, server_time_ms }
			var world_payload: Dictionary = payload.get("world", {})
			var server_time_ms: int = int(payload.get("server_time_ms", 0))

			emit_signal(
				"world_state_received",
				WireAdapter.normalize_world_from_wire(
					world_payload,
					server_time_ms,
					received_local_ms
				)
			)

		"plot_update":
			# payload: { plot: {...}, owner_display_name?: "Alice", server_time_ms }
			var server_time_ms: int = int(payload.get("server_time_ms", 0))
			var p: Dictionary = WireAdapter.normalize_plot_from_wire(
				payload.get("plot", {}),
				server_time_ms,
				received_local_ms
			)

			# If server provided a name, store it on the plot dict.
			# This makes PlotView able to show the correct owner name even if
			# world.players is stale on this client.
			if payload.has("owner_display_name"):
				p["owner_display_name"] = str(payload.get("owner_display_name", ""))

			emit_signal("plot_updated", p)

		"world_patch":
			var server_time_ms: int = int(payload.get("server_time_ms", 0))
			emit_signal(
				"world_patch_received",
				WireAdapter.normalize_patch_from_wire(
					payload,
					server_time_ms,
					received_local_ms
				)
			)

		"claim_result":
			emit_signal("claim_result_received", payload)

		"clear_plot_object_result":
			emit_signal("clear_plot_object_result_received", payload)

		"error":
			_emit_server_error_status(payload)
			
		"presence_state":
			# payload: { online: [ {player_id, display_name}, ... ] }
			_online_players = payload.get("online", [])
			emit_signal("presence_updated", _online_players)
			
		"issue_plot_order_result":
			emit_signal("issue_plot_order_result_received", payload)
			
		"cancel_plot_order_result":
			emit_signal("cancel_plot_order_result_received", payload)
			
		"server_pong":
			# Compute RTT using the request id of the pong (if present)
			var request_id: String = str(msg.get("req_id", ""))
			if _pending_pings.has(request_id):
				var sent_ms: int = int(_pending_pings[request_id])
				_pending_pings.erase(request_id)
				var rtt_ms: int = Time.get_ticks_msec() - sent_ms

				# Light smoothing so it doesn't jump around
				if _latency_ms < 0.0:
					_latency_ms = float(rtt_ms)
				else:
					_latency_ms = lerp(_latency_ms, float(rtt_ms), 0.25)

				emit_signal("latency_updated", int(round(_latency_ms)))

		_:
			# Ignore unknown messages for now.
			pass
			
func _emit_server_error_status(payload: Dictionary) -> void:
	var reason: String = str(payload.get("reason", "")).strip_edges()
	if reason != "":
		_emit_status("Server error: %s" % reason)
		return

	_emit_status("Server error: %s" % str(payload))

func _send(type_name: String, payload: Dictionary, req_id: String) -> void:
	if _ws.get_ready_state() != WebSocketPeer.STATE_OPEN:
		return

	var env: Dictionary = {
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
