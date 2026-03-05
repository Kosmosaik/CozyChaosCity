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

# -------------------------
# Networking constants
# -------------------------
const WS_URL := "ws://localhost:8080"
const PROTOCOL_VERSION := 1

# -------------------------
# Internal networking state
# -------------------------
var _ws := WebSocketPeer.new()
var _is_connected := false
var _req_counter: int = 0

# Heartbeat: keeps server from disconnecting us due to inactivity
var _heartbeat_interval := 10.0
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
			_send("client_ping", {}, _next_req_id())

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

	_emit_status("Connecting as '%s'..." % profile_name)
	_connect_ws()

func request_world() -> void:
	_send("request_world", {}, _next_req_id())

func claim_plot(plot_id: String) -> void:
	_send("claim_plot", { "plot_id": plot_id }, _next_req_id())

# -------------------------
# Internal networking
# -------------------------
func _connect_ws() -> void:
	var err = _ws.connect_to_url(WS_URL)
	if err != OK:
		_emit_status("WS connect failed: %s" % err)
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
			emit_signal("world_state_received", payload.get("world", {}))

		"plot_update":
			emit_signal("plot_updated", payload.get("plot", {}))

		"world_patch":
			emit_signal("world_patch_received", payload)

		"claim_result":
			emit_signal("claim_result_received", payload)

		"server_pong":
			# Optional response to our heartbeat. No gameplay effect.
			pass

		"error":
			_emit_status("Server error: %s" % str(payload))

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
