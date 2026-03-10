# TECHNICAL_SUMMARY_FOR_GPT_ASSISTANT

**Project:** CozyChaosCityBuilder (Cozy Chaos City)  
**Stack:** Godot 4 client + Node.js/TypeScript WebSocket server  
**Last updated:** 2026-03-09  
**Current milestone:** **M1 complete**  
**Current state:** friend-testable prototype with server-driven 3D world, 3D tile interaction, popup claim flow, and menu/login overlay.

This document is the handoff reference for any future GPT assistant.

---

## 1) Project at a glance

CozyChaosCityBuilder is a multiplayer city-builder foundation with a server-authoritative world.

Core loop currently implemented:
- player launches client
- sees a menu/login overlay
- enters a username
- authenticates or reconnects with a stored profile
- enters a 3D world rendered from server state
- clicks a plot to inspect it
- claims free `PLAYER` plots
- receives live updates and expansion patches from the server

Key concept:
- plots live on a deterministic grid
- plot IDs are stable: `T_<x>_<y>`
- server is authoritative for ownership and expansion

---

## 2) Milestones

### M0 — completed
Delivered:
- WebSocket multiplayer foundation
- server-authoritative plot claiming
- persistence to `server/world_state.json`
- profile-based reconnect identity

### M0.5 — completed
Delivered:
- coordinate-based plot system
- deterministic plot typing rule
  - `RESOURCE` if both `x` and `y` are even
  - otherwise `PLAYER`
- initial 3×3 world
- constant-size expansion modules
- 2D coordinate-based rendering prototype
- presence snapshots and latency display

### M1 — completed
Delivered:
- dedicated 3D world scene and controller
- reusable 3D tile scene and script
- city-builder style 3D camera rig
- server-driven 3D tile rendering via dedicated renderer
- 3D tile hover and selection
- plot popup UI for owner/unclaimed state
- claim action inside the popup
- permanent server-side owner display-name enrichment for plot payloads
- main menu/login overlay with static background
- world hidden/disabled before login
- quit buttons in menu and in-game top bar

### Out of scope for M1
Still not part of M1:
- buildings and interiors
- NPC gameplay systems
- production/economy simulation
- minimap/world map
- major rendering optimization systems such as MultiMesh
- settings/options menu

---

## 3) Repository structure (current)

```text
cozy-chaos-city/
  README.md
  CHANGELOG.md
  docs/
    GPT_Assistant_Rules.md
    M1_Discord_Summary_No_Fluff.md
    M1_Technical_Summary.md
    TECHNICAL_SUMMARY_FOR_GPT_ASSISTANT.md
    Vertical_Cozy_City_Living_Document_Combined_v1.md

  server/
    package.json
    package-lock.json
    tsconfig.json
    world_state.json
    src/
      index.ts
      core/
        config.ts
        players.ts
        presence.ts
        world.ts
      net/
        protocol.ts
      storage/
        persist.ts

  client/
    project.godot
    main.tscn
    hud.tscn
    PlotView.gd                # old 2D renderer kept as reference/fallback
    0.png
    1.png
    background.png
    background2.png
    scenes/
      world/
        GameWorld3D.tscn
        PlotTile3D.tscn
    scripts/
      net/
        NetClient.gd
        ProfileStore.gd
      ui/
        HUD.gd
        PlotInfoPanel.gd
      world/
        CameraRigBasic.gd
        GameWorld3D.gd
        PlotRenderer3D.gd
        PlotTile3D.gd
        TilePicker3D.gd
```

Notes:
- Ignore `.godot/`, `.tmp`, and exported cache files for logic work.
- `server/src/` is the backend source of truth.
- `client/PlotView.gd` still exists but is no longer the active world presentation path.

---

## 4) Current server architecture

### 4.1 Config
`server/src/core/config.ts`
- `port = 27015`
- `protocolVersion = 2`
- `expandWhenFreePlotsBelow = 3`
- persistence path points to `world_state.json`
- keepalive / timeout settings are configured here

### 4.2 World model
Defined in `server/src/net/protocol.ts`.
Important concepts:
- `PlotType = "PLAYER" | "RESOURCE"`
- `Plot` includes at least:
  - `id`
  - `type`
  - `x`
  - `y`
  - `claimed_by`
- `PlayerRecord` includes:
  - `id`
  - `secret`
  - `display_name`
- `WorldState` includes:
  - `version`
  - `plots`
  - `players`

### 4.3 Pattern rule and expansion
`server/src/core/world.ts`
- `plotTypeAt(x, y)`:
  - `RESOURCE` if both coordinates are even
  - otherwise `PLAYER`
- initial world is 3×3
- expansions add one 3×3 module at a time
- expansion returns `{ added }`

### 4.4 Networking flow
`server/src/index.ts`

Important message flow:
- `hello`
  - authenticate via `{ player_id, secret }`
  - or register via `{ display_name }`
- `welcome`
  - returns server-issued `player_id`, `secret`, `display_name`
- `world_state`
  - now sends `world: makeWorldForClient()`
  - plots are enriched with `owner_display_name`
- `plot_update`
  - sends enriched `plot`
  - also includes top-level `owner_display_name` for backward safety
- `world_patch`
  - sends `{ added, world_version }`
  - `added` plots are enriched with `owner_display_name`
- `claim_plot`
  - validates server-side
  - updates world + persistence
  - broadcasts `plot_update`
  - may trigger `world_patch`

### 4.5 Presence
`server/src/core/presence.ts`
- server broadcasts full presence snapshots
- client shows online player names in the HUD

---

## 5) Current client architecture

### 5.1 Entry scene
`client/main.tscn`

Current active structure:
- `Main`
  - `GameWorld3D`
  - `UI` (`CanvasLayer`)
    - `HUD`
  - `NetClient`

### 5.2 NetClient
`client/scripts/net/NetClient.gd`

Responsibilities:
- connect to server via `WebSocketPeer`
- load/save profile credentials via `ProfileStore`
- authenticate with existing credentials or new display name
- emit signals for:
  - status
  - identity
  - world snapshots
  - plot updates
  - world patches
  - claim results
  - latency
  - presence

Important notes:
- default server URL is still hardcoded to the current public IP
- optional override file: `user://server_url.txt`

### 5.3 HUD
`client/scripts/ui/HUD.gd`

Responsibilities:
- manage menu/login UI state vs in-world UI state
- forward world messages into `GameWorld3D`
- react to plot selection and update `PlotInfoPanel`
- reuse existing `claim_plot` network flow
- show status, ping, and online-player list
- handle quit buttons

Important current UI states:
- **menu state**
  - `MenuOverlay` visible
  - `TopBar` hidden
  - world disabled
- **in-world state**
  - `MenuOverlay` hidden
  - `TopBar` visible
  - world enabled

Important note for future assistants:
- a recent bug occurred when `_on_connect_pressed()` was accidentally emptied and its logic ended up inside `_on_quit_pressed()`.
- The intended correct state is:
  - `_on_connect_pressed()` handles username validation + `net.connect_with_profile(username)`
  - `_on_quit_pressed()` only calls `get_tree().quit()`
- If a new zip appears to have a dead Connect button, check this function pair first.

### 5.4 PlotInfoPanel
`client/scripts/ui/PlotInfoPanel.gd`

Responsibilities:
- show selected plot info
- show type and owner/unclaimed state
- show Claim button only when valid
- emit `claim_requested(plot_id)`

This panel is intentionally small in M1 but is meant to grow later with:
- population
- production
- happiness
- plot stats

### 5.5 GameWorld3D
`client/scripts/world/GameWorld3D.gd`

Responsibilities:
- own client-side world cache
- receive full world snapshots
- receive plot updates and world patches
- track local player id
- track selected and hovered plot ids
- emit `plot_selected(plot, is_claimable)`
- enable/disable the whole world during menu/login flow

Important methods:
- `set_my_player_id(player_id)`
- `set_world(world)`
- `apply_plot_update(plot)`
- `apply_world_patch(patch)`
- `refresh_selected_plot_ui()`
- `set_world_enabled(enabled)`

### 5.6 PlotRenderer3D
`client/scripts/world/PlotRenderer3D.gd`

Responsibilities:
- spawn and own all tile instances under `TilesRoot`
- map `plot_id -> PlotTile3D`
- rebuild from `world_state`
- apply incremental plot updates
- keep selected/hovered tile visuals in sync

This is the main M1 rendering module.

### 5.7 PlotTile3D
`client/scripts/world/PlotTile3D.gd`

Responsibilities:
- own tile-local plot fields
- apply plot data visually
- render different states for:
  - `RESOURCE`
  - free `PLAYER`
  - taken by me
  - taken by others
- render selection and hover effects

Important methods:
- `apply_plot(plot, my_player_id)`
- `set_selected(is_selected, my_player_id)`
- `set_hovered(is_hovered, my_player_id)`

### 5.8 TilePicker3D
`client/scripts/world/TilePicker3D.gd`

Responsibilities:
- raycast from the active camera into the 3D world
- detect `PlotTile3D`
- emit:
  - `tile_hovered(plot_id)`
  - `tile_clicked(plot_id)`

### 5.9 CameraRigBasic
`client/scripts/world/CameraRigBasic.gd`

Responsibilities:
- movement
- zoom
- yaw
- pitch/tilt
- zoom toward mouse world position

This remains independent from networking and HUD logic.

---

## 6) Scene/UI structure notes

### 6.1 HUD scene
`client/hud.tscn`

Current important nodes include:
- `MenuOverlay`
  - static background image
  - centered login panel
  - username input
  - connect button
  - quit button
  - menu status label
- `TopBar`
  - claim button kept hidden for now
  - status label
  - latency label
  - online label
  - in-game quit button
- `PlotInfoPanel`
  - popup shown when a tile is selected

### 6.2 World scene
`client/scenes/world/GameWorld3D.tscn`

Current important nodes include:
- `CameraRig`
  - `YawPivot`
    - `PitchPivot`
      - `Camera3D`
- `SunLight`
- `TilesRoot`
- `Ground`

---

## 7) M1 status assessment

### M1 core goals are complete
Based on the current repo plus latest working chat instructions, M1 is functionally complete.

Completed M1 deliverables:
- 3D world renders from server snapshots and incremental updates
- reusable individual tile scene approach is in place
- camera is functional for city-builder viewing
- tiles can be hovered and selected in 3D
- claim flow is reconnected through 3D interaction
- world patches render correctly in 3D
- login/menu flow prevents camera movement while typing

### Remaining work is polish or future scope
These are not blockers for calling M1 complete:
- prettier textures / more detailed tile models
- camera feel polish
- settings/options menu
- richer plot popup content
- gameplay systems beyond plot claiming

---

## 8) Important pitfalls for future GPT assistants

1. **Always read the latest zip and the docs first.**
   The project changes quickly and stale assumptions have already caused mistakes.

2. **Follow `docs/GPT_Assistant_Rules.md` strictly.**
   The user wants exact file paths, exact insertion/replacement anchors, modular code, educational comments, and Godot-editor instructions for static UI.

3. **Do not regress the server/client payload consistency.**
   Plot payloads sent to clients should already include `owner_display_name`.

4. **Do not put rendering logic back into `HUD.gd`.**
   `HUD.gd` is UI coordination only.

5. **Do not remove `PlotRenderer3D` / `TilePicker3D` modular separation.**
   That separation is intentional and should be preserved.

6. **The world must remain gated behind the login/menu state unless deliberately redesigning that flow.**
   This was added specifically to avoid camera input while typing and to make the prototype feel more like a real game.

7. **If Connect stops working, check `HUD.gd` first.**
   There was already one regression where the connect logic ended up inside the quit handler.

---

## 9) Recommended next milestone direction

Likely next steps after M1:
- replace placeholder tile visuals with better textures/models
- begin real plot content / building representation
- add richer plot popup information
- add settings/options menu for resolution/window mode/fullscreen
- continue toward actual city-building gameplay systems

