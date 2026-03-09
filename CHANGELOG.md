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