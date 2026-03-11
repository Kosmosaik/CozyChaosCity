# Changelog — CozyChaosCity

This project is in early development. Version numbers are informal for now.

## [0.0.1] — 2026-03-05 — Milestone 0 Complete (Networking + Claiming + Persistence + Profiles)

### Added
- Dedicated WebSocket server (Node.js + TypeScript) with server-authoritative world state.
- Plot claiming flow:
  - client connects → selects a free plot → presses **Claim** → server validates and broadcasts update.
- Persistence:
  - `world_state.json` saved atomically so claimed plots persist across client and server restarts.
- World expansion:
  - server adds new player plots automatically when free plots drop below a threshold (currently `< 3`).
- Heartbeat/keepalive:
  - client sends periodic heartbeat to prevent inactivity disconnects.
- Identity system (profiles + server-issued credentials):
  - client prompts for a **username** (treated as a local profile name).
  - server issues `player_id + secret` on first connect and returns them via `welcome`.
  - client stores credentials per profile and uses them to reconnect as the same player.
  - UI shows plots as **MINE** vs **TAKEN** based on `player_id`.
- Godot client prototype UI:
  - plot list/grid view with selection highlight.
  - **Claim** button enabled only when a free player plot is selected.
  - status label for connection/state messages.

### Changed
- Identity moved from “client-generated token” to “server-issued credentials per profile”.
- Plot ownership stored as `claimed_by = player_id`.

### Notes / Known limitations
- World layout is still a simple list/grid; design-pattern world generation comes next (M1).
- Security is “auth-lite” (good enough for prototyping, not hardened).
- No gameplay beyond plot claiming and visualization yet.

---

## [0.0.3] — 2026-03-08 — M1 Progress (3D World Foundation + Camera)

### Added
- Dedicated 3D world scene:
  - `client/scenes/world/GameWorld3D.tscn`
- Dedicated 3D world controller:
  - `client/scripts/world/GameWorld3D.gd`
- Reusable 3D tile scene:
  - `client/scenes/world/PlotTile3D.tscn`
- Reusable 3D tile script:
  - `client/scripts/world/PlotTile3D.gd`
- Dedicated runtime camera controller:
  - `client/scripts/world/CameraRigBasic.gd`
- 3D world foundation elements:
  - `CameraRig`
  - `Camera3D`
  - `SunLight`
  - `TilesRoot`
  - `Ground`
- Local world-state handling inside the 3D world controller:
  - local player id
  - full world snapshots
  - single plot updates
  - world patches
- Reusable 3D tile setup using:
  - `StaticBody3D`
  - `MeshInstance3D`
  - `CollisionShape3D`
- Tile-local visual states for:
  - resource plots
  - free player plots
  - claimed plots
  - plots owned by the local player
- Temporary local 3×3 render test grid for verifying:
  - tile instancing
  - spacing
  - visibility
  - material/state coloring
- City-builder style camera rig hierarchy:
  - `CameraRig`
    - `YawPivot`
      - `PitchPivot`
        - `Camera3D`
- Runtime camera features:
  - movement across the world
  - zoom-scaled movement speed
  - right mouse drag yaw/rotation
  - right mouse drag pitch/tilt
  - mouse wheel zoom
  - zoom toward mouse world position

### Changed
- Main scene now includes the dedicated 3D world scene alongside:
  - UI
  - networking
- HUD was refactored to be UI-only.
- World-data ownership moved out of `HUD.gd` and into `GameWorld3D.gd`.
- Old 2D `PlotView` dependency was removed from the active gameplay flow.
- Camera was refactored from a simple fixed camera setup into a modular pivot-based rig.

### Fixed
- Tile initialization order:
  - tile logic now runs after the instance has entered the scene tree.
- Camera path references after the camera rig hierarchy changed.
- Obsolete HUD-to-2D-renderer coupling was removed.

### Notes / Known limitations
- Real server-driven 3D tile rendering is not connected yet.
- The current 3D tile display still uses a temporary local 3×3 test grid.
- 3D tile selection / picking is not implemented yet.
- Claim flow is not yet reconnected through 3D tile interaction.
- Camera feel is improved, but further polish may still be needed later.

---

## [0.0.4] — 2026-03-09 — M1 Complete (Server-Driven 3D World + Tile Interaction + Menu Flow)

### Added
- Real server-driven 3D world rendering in Godot using individual tile scenes.
- Dedicated modular 3D plot renderer:
  - `client/scripts/world/PlotRenderer3D.gd`
- Dedicated 3D tile picking system:
  - `client/scripts/world/TilePicker3D.gd`
- Plot selection flow in 3D:
  - hover feedback
  - selected-tile feedback
  - click-to-select behavior
- Dedicated plot popup UI:
  - `client/scripts/ui/PlotInfoPanel.gd`
  - owner / unclaimed display
  - claim button inside the popup for valid free `PLAYER` plots
- Main menu / login overlay with static background image.
- In-menu and in-game quit buttons.

### Changed
- `GameWorld3D.gd` now uses real server data instead of a temporary local 3×3 tile test.
- `world_patch` handling on the client now uses the actual server payload shape:
  - `added`
  - `world_version`
- Plot claiming now flows through 3D tile selection + popup UI instead of depending on the old top-bar claim interaction.
- Login flow now starts in a menu state instead of spawning the player directly into an interactive world.
- The 3D world is hidden/disabled until login succeeds, which prevents camera movement while typing a username.
- Top-bar login controls were moved into the centered main menu.

### Fixed
- Claimed plots now show the owner's display name consistently across all server plot payloads:
  - `world_state`
  - `plot_update`
  - `world_patch`
- Restored full tile interaction chain:
  - mouse click
  - 3D picker
  - tile selection
  - popup update
- Fixed a HUD regression where Connect stopped working because the connect logic had accidentally ended up inside the quit handler.

### M1 Deliverables now complete
- Dedicated 3D world scene and controller.
- Reusable 3D tile scene and tile-local visual state.
- Server-driven plot rendering from full snapshots and incremental updates.
- 3D tile picking, selection, and hover feedback.
- Claim flow reconnected through 3D interaction.
- City-builder style runtime camera controls.
- Basic front-end login/menu flow for entering the game cleanly.

### Notes / Known limitations
- Visuals are still prototype-level:
  - simple tile materials/colors
  - no final textures or detailed 3D models yet
- No buildings, interiors, NPC gameplay, or deeper city simulation yet.
- No settings/options menu yet for display mode, resolution, or graphics preferences.

---

## [0.0.5] — 2026-03-11 — M2 Foundation Progress (Owned Plot Detail + Clearable Rubble + Debug Local Interaction)

### Added
- Server-side plot shell data:
  - every generated plot now has public-facing `shell` data for future World Map / reduced-detail rendering.
- Server-side owned plot detail data:
  - claimed `PLAYER` plots now initialize local `detail` data on first claim.
- Starter local plot generation:
  - claimed player plots now generate a centered shelter footprint with rubble surrounding it out toward the plot edges.
- Local plot cell model:
  - `x`
  - `y`
  - `blocked`
  - `clearable`
  - `terrain`
- Starter object model for owned plots:
  - `SHACK`
  - `NPC_MARKER`
- World helper functions for local plot logic:
  - `ensureClaimedPlayerPlotInitialized(...)`
  - `getPlotDetailCell(...)`
  - `isPlotDetailCellClearable(...)`
  - `clearPlotDetailCell(...)`
- Temporary server debug action:
  - `debug_clear_plot_cell`
- Temporary in-game debug UI path:
  - plot popup button for clearing local cell `(0,0)` on the player's own claimed plot.
- Network client support for the debug local clear action:
  - request send path
  - result signal handling

### Changed
- Claimed player plots now update their public shell from `EMPTY` to `RUINED` when local starter detail is initialized.
- Generic rubble is now modeled in the **cell layer** instead of as separate fake rubble objects.
- Local plot starter data now follows the intended design direction more closely:
  - shelter in the center
  - rubble surrounding the shelter
  - future expansion expected to happen outward from the center
- Plot popup UI can now expose a temporary debug action for the local player's own plot only.

### Removed
- Removed `RUBBLE_PILE` from the starter object model.
- Removed the mixed prototype approach where some rubble existed as separate objects while the rest only existed as terrain data.

### Notes / Known limitations
- This is still M2 foundation work, not the full Player Plot implementation.
- World Map mode vs Player Plot mode is not implemented yet.
- Local neighborhood loading is not implemented yet.
- Local plot rendering is not implemented yet.
- The current local cell clearing flow is a temporary debug/testing path only.
- The next major M2 step is expected to focus on:
  - neighborhood/local plot protocol flow
  - mode switching
  - local owned-plot rendering