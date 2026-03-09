extends Control

# IMPORTANT:
# These paths match the node structure you showed + the two new nodes we just added.

@onready var game_world := get_tree().get_root().get_node_or_null("Main/GameWorld3D")
@onready var plot_info_panel: PlotInfoPanel = $PlotInfoPanel

@onready var menu_overlay: Control = $MenuOverlay
@onready var top_bar: PanelContainer = $TopBar

@onready var username_line_edit: LineEdit = $MenuOverlay/CenterContainer/MenuPanel/MarginContainer/VBoxContainer/UsernameLineEdit
@onready var connect_button: Button = $MenuOverlay/CenterContainer/MenuPanel/MarginContainer/VBoxContainer/ConnectButton
@onready var menu_status_label: Label = $MenuOverlay/CenterContainer/MenuPanel/MarginContainer/VBoxContainer/MenuStatusLabel

@onready var claim_button: Button = $TopBar/HBoxContainer/ClaimButton
@onready var status_label: Label = $TopBar/HBoxContainer/StatusLabel
@onready var latency_label: Label = $TopBar/HBoxContainer/LatencyLabel
@onready var online_label: Label = $TopBar/HBoxContainer/OnlineLabel
@onready var quit_button: Button = $MenuOverlay/CenterContainer/MenuPanel/MarginContainer/VBoxContainer/QuitButton
@onready var quit_button_in_game: Button = $TopBar/HBoxContainer/QuitButtonInGame

var net: NetClient
var selected_plot_id: String = ""
var _is_logged_in: bool = false

func _show_login_menu() -> void:
	# Login/menu state:
	# - menu visible
	# - top bar hidden
	# - plot popup hidden
	# - 3D world disabled so typing does not move the camera
	menu_overlay.visible = true
	top_bar.visible = false
	plot_info_panel.clear_panel()

	if game_world != null:
		game_world.set_world_enabled(false)

func _enter_world_ui() -> void:
	# In-game state:
	# - menu hidden
	# - top bar visible
	# - 3D world enabled
	menu_overlay.visible = false
	top_bar.visible = true

	if game_world != null:
		game_world.set_world_enabled(true)

func _set_status_text(text: String) -> void:
	# Keep both labels updated so whichever UI layer is currently visible
	# always has the latest connection status.
	menu_status_label.text = text
	status_label.text = text

func _ready() -> void:
	# Initial UI state
	claim_button.disabled = true
	claim_button.visible = false
	_is_logged_in = false
	plot_info_panel.clear_panel()
	_show_login_menu()
	_set_status_text("Enter username and press Connect.")

	# Hook UI events
	connect_button.pressed.connect(_on_connect_pressed)
	quit_button.pressed.connect(_on_quit_pressed)
	quit_button_in_game.pressed.connect(_on_quit_pressed)

	# Keep the old top-bar claim button hidden for now.
	# The popup panel is the new interaction path for plot claims.
	claim_button.pressed.connect(_on_claim_pressed)
	plot_info_panel.claim_requested.connect(_on_plot_info_claim_requested)

	# Find NetClient (you already used this pattern)
	net = get_tree().get_first_node_in_group("netclient") as NetClient
	if net == null:
		net = get_node_or_null("/root/Main/NetClient") as NetClient

	if net == null:
		status_label.text = "NetClient not found!"
		return
		
	# Listen for 3D world selection events so the popup can reflect
	# the currently selected plot.
	if game_world != null:
		game_world.plot_selected.connect(_on_plot_selected)

	# Hook NetClient signals
	net.status_changed.connect(_on_status)
	net.world_state_received.connect(_on_world_state)
	net.plot_updated.connect(_on_plot_update)
	net.world_patch_received.connect(_on_world_patch)
	net.claim_result_received.connect(_on_claim_result)

	# IMPORTANT: identity_ready signature is now (player_id, display_name)
	net.identity_ready.connect(_on_identity_ready)

	# Friendly starting text (NetClient already emits a default status too)
	_set_status_text("Enter username and press Connect.")
	
	net.latency_updated.connect(_on_latency_updated)
	net.presence_updated.connect(_on_presence_updated)

func _on_connect_pressed() -> void:
	if net == null:
		return

	var username: String = username_line_edit.text.strip_edges()
	if username == "":
		_set_status_text("Please enter a username.")
		return

	# Disable connect button so you don't spam-connect.
	connect_button.disabled = true
	_set_status_text("Connecting...")

	# This triggers the whole profile flow:
	# - loads user://profiles/<username>.json if it exists
	# - if exists: sends {player_id, secret}
	# - else: sends {display_name: username}
	net.connect_with_profile(username)

func _on_quit_pressed() -> void:
	# Close the game application.
	get_tree().quit()

func _on_identity_ready(player_id: String, display_name: String) -> void:
	# We are now authenticated as this server-issued player_id.
	_is_logged_in = true

	# Tell the 3D world who the local player is.
	if game_world != null:
		game_world.set_my_player_id(player_id)

	# Re-enable the button for future reconnect attempts, then ent§er the world UI.
	connect_button.disabled = false
	_set_status_text("Logged in as %s (%s)" % [display_name, player_id])
	_enter_world_ui()

	if game_world != null:
		game_world.refresh_selected_plot_ui()

func _on_status(t: String) -> void:
	# NetClient status messages are useful. Mirror them to both menu + top bar.
	_set_status_text(t)

	# If connection failed / disconnected, return to menu state.
	if "Disconnected" in t or "failed" in t:
		connect_button.disabled = false
		_is_logged_in = false
		claim_button.disabled = true
		_show_login_menu()

		if game_world != null:
			game_world.refresh_selected_plot_ui()

func _on_world_state(world: Dictionary) -> void:
	if game_world != null:
		game_world.set_world(world)

func _on_plot_update(plot: Dictionary) -> void:
	if game_world != null:
		game_world.apply_plot_update(plot)

func _on_world_patch(patch: Dictionary) -> void:
	if game_world != null:
		game_world.apply_world_patch(patch)

func _on_plot_selected(plot: Dictionary, is_claimable: bool) -> void:
	if plot.is_empty():
		selected_plot_id = ""
		claim_button.disabled = true
		plot_info_panel.clear_panel()
		return

	selected_plot_id = str(plot.get("id", ""))

	# Keep the old button state aligned even though it is hidden,
	# so we still have one source of truth for claimability.
	claim_button.disabled = not (_is_logged_in and is_claimable)

	plot_info_panel.show_plot(plot, is_claimable, _is_logged_in)
	
func _on_plot_info_claim_requested(plot_id: String) -> void:
	# The popup reuses the same claim flow as the old top-bar button.
	selected_plot_id = plot_id
	_on_claim_pressed()

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
