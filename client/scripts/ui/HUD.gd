extends Control

# IMPORTANT:
# These paths match the node structure you showed + the two new nodes we just added.

@onready var game_world := get_tree().get_root().get_node_or_null("Main/GameWorld3D")

@onready var username_line_edit := $TopBar/HBoxContainer/UsernameLineEdit
@onready var connect_button := $TopBar/HBoxContainer/ConnectButton

@onready var claim_button := $TopBar/HBoxContainer/ClaimButton
@onready var status_label := $TopBar/HBoxContainer/StatusLabel

@onready var latency_label := $TopBar/HBoxContainer/LatencyLabel
@onready var online_label := $TopBar/HBoxContainer/OnlineLabel

var net: NetClient
var selected_plot_id: String = ""
var _is_logged_in: bool = false

func _ready() -> void:
	# Initial UI state
	claim_button.disabled = true
	_is_logged_in = false

	# Hook UI events
	connect_button.pressed.connect(_on_connect_pressed)
	claim_button.pressed.connect(_on_claim_pressed)

	# Find NetClient (you already used this pattern)
	net = get_tree().get_first_node_in_group("netclient") as NetClient
	if net == null:
		net = get_node_or_null("/root/Main/NetClient") as NetClient

	if net == null:
		status_label.text = "NetClient not found!"
		return

	# Hook NetClient signals
	net.status_changed.connect(_on_status)
	net.world_state_received.connect(_on_world_state)
	net.plot_updated.connect(_on_plot_update)
	net.world_patch_received.connect(_on_world_patch)
	net.claim_result_received.connect(_on_claim_result)

	# IMPORTANT: identity_ready signature is now (player_id, display_name)
	net.identity_ready.connect(_on_identity_ready)

	# Friendly starting text (NetClient already emits a default status too)
	status_label.text = "Enter username and press Connect."
	
	net.latency_updated.connect(_on_latency_updated)
	net.presence_updated.connect(_on_presence_updated)

func _on_connect_pressed() -> void:
	if net == null:
		return

	var username: String = username_line_edit.text.strip_edges()
	if username == "":
		status_label.text = "Please enter a username."
		return

	# Disable connect button so you don't spam-connect
	connect_button.disabled = true
	status_label.text = "Connecting..."

	# This triggers the whole profile flow:
	# - loads user://profiles/<username>.json if it exists
	# - if exists: sends {player_id, secret}
	# - else: sends {display_name: username}
	net.connect_with_profile(username)

func _on_identity_ready(player_id: String, display_name: String) -> void:
	# We are now authenticated as this server-issued player_id
	_is_logged_in = true

	# Tell the 3D world who the local player is.
	if game_world != null:
		game_world.set_my_player_id(player_id)

	# Once logged in, allow claim button logic to work (still needs plot selection)
	connect_button.disabled = false
	status_label.text = "Logged in as %s (%s)" % [display_name, player_id]

func _on_status(t: String) -> void:
	# NetClient status messages are useful. We show them.
	status_label.text = t

	# If connection failed / disconnected, allow reconnect
	if "Disconnected" in t or "failed" in t:
		connect_button.disabled = false
		_is_logged_in = false
		claim_button.disabled = true

func _on_world_state(world: Dictionary) -> void:
	if game_world != null:
		game_world.set_world(world)

func _on_plot_update(plot: Dictionary) -> void:
	if game_world != null:
		game_world.apply_plot_update(plot)

func _on_world_patch(patch: Dictionary) -> void:
	if game_world != null:
		game_world.apply_world_patch(patch)

func _on_plot_selected(plot_id: String, is_claimable: bool) -> void:
	selected_plot_id = plot_id

	# Claim is only enabled if:
	# - you are logged in (identity ready)
	# - plot is claimable (PLAYER + free)
	claim_button.disabled = not (_is_logged_in and is_claimable)

func _on_claim_pressed() -> void:
	if not _is_logged_in:
		status_label.text = "Not logged in. Connect first."
		return

	if selected_plot_id == "":
		return

	claim_button.disabled = true
	net.claim_plot(selected_plot_id)

func _on_claim_result(result: Dictionary) -> void:
	if result.get("ok", false):
		status_label.text = "Claimed: %s" % result.get("plot_id", "")
	else:
		status_label.text = "Claim failed: %s" % result.get("reason", "unknown")
		# PlotView updates will arrive via plot_update/world_state and re-enable button if appropriate
		
func _on_latency_updated(ms: int) -> void:
	latency_label.text = "Ping: %d ms" % ms

func _on_presence_updated(online: Array) -> void:
	# Show a compact list: "Online (3): Alice, Bob, ..."
	var names: Array = []
	for p in online:
		names.append(str(p.get("display_name", "?")))

	online_label.text = "Online (%d): %s" % [names.size(), ", ".join(names)]
