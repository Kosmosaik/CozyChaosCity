# TECHNICAL_SUMMARY_FOR_GPT_ASSISTANT

**Project:** CozyChaosCityBuilder (Cozy Chaos City)  
**Stack:** Godot 4 client + Node.js/TypeScript WebSocket server  
**Last updated:** 2026-03-11  
**Current milestone:** **M2 foundation in progress**  
**Current state:** M1 remains fully working; M2 server-side owned plot data foundation and first debug local interaction path are now implemented.

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

New M2 foundation now implemented:
- claimed player plots can initialize local owned-plot detail data
- local plot cells can represent rubble vs usable ground
- rubble cells can now be marked `clearable`
- the server can mutate a local cell from rubble to ground
- the client has a temporary in-game debug button to trigger one local cell clear action

Key concept:
- plots live on a deterministic grid
- plot IDs are stable: `T_<x>_<y>`
- server is authoritative for ownership, expansion, and local cell mutation
- M2 is moving toward:
  - World Map mode
  - Player Plot mode
  - neighborhood/local rendering around the owned plot

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

### M2 — in progress
Current delivered foundation:
- plot `shell` data on the server
- claimed-player-plot `detail` data on the server
- starter local plot generation on first claim
- local plot cells with:
  - `x`
  - `y`
  - `blocked`
  - `clearable`
  - `terrain`
- starter shelter + starter NPC marker objects
- centered starter shelter footprint surrounded by rubble
- world helper functions for local cell lookup and mutation
- server debug action for local cell clearing
- temporary in-game popup debug button for local cell clearing

### Out of scope for current M2 state
Still not implemented:
- World Map mode vs Player Plot mode
- neighborhood-based local plot loading
- local owned-plot rendering
- local neighborhood rendering of nearby plots/resource zones
- full local gameplay loops
- real exterior/interior split
- NPC simulation
- production/economy systems

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
    M2_implementation_plan.md
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
- M2 work so far is still concentrated in the existing server architecture plus small temporary client debug hooks.

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
- `Plot` now includes:
  - `id`
  - `type`
  - `x`
  - `y`
  - `claimed_by`
  - optional `shell`
  - optional `detail`
- `PlayerRecord` includes:
  - `id`
  - `secret`
  - `display_name`
- `WorldState` includes:
  - `version`
  - `plots`
  - `players`

New M2 data structures:
- `PlotShell`
  - `kind`
  - `variant`
  - `stage`
- `PlotDetail`
  - `width`
  - `height`
  - `cells`
  - `starter_objects`
- `PlotDetailCell`
  - `x`
  - `y`
  - `blocked`
  - `clearable`
  - `terrain`
- `PlotDetailStarterObjectKind`
  - `SHACK`
  - `NPC_MARKER`

Important design direction:
- generic rubble lives in the **cell layer**
- distinct placed things live in the **starter object layer**
- current shell data is still a lightweight public-facing summary, not the final long-term truth model for exterior structure

### 4.3 Pattern rule and expansion
`server/src/core/world.ts`
- `plotTypeAt(x, y)`:
  - `RESOURCE` if both coordinates are even
  - otherwise `PLAYER`
- initial world is 3×3
- expansions add one 3×3 module at a time
- expansion returns `{ added }`

### 4.4 M2 local plot foundation
`server/src/core/world.ts`

Important new helpers:
- `makeDefaultShell(plotType)`
  - creates default shell data for generated plots
- `makeStarterPlotDetail()`
  - creates starter owned-plot detail
- `ensureClaimedPlayerPlotInitialized(plot)`
  - initializes local detail when a `PLAYER` plot is first claimed
  - also updates the shell from `EMPTY` to `RUINED`
- `getPlotDetailCell(plot, x, y)`
  - returns a local cell or `null`
- `isPlotDetailCellClearable(plot, x, y)`
  - checks whether a local cell is clearable
- `clearPlotDetailCell(plot, x, y)`
  - mutates a clearable local cell from rubble to ground

Current starter local plot design:
- local grid currently uses `STARTER_DETAIL_SIZE = 8`
- shelter footprint is centered
- most of the surrounding plot starts as rubble
- rubble cells are blocked and clearable
- shelter cells are ground, unblocked, and not clearable

### 4.5 Networking flow
`server/src/index.ts`

Important message flow still in use:
- `hello`
  - authenticate via `{ player_id, secret }`
  - or register via `{ display_name }`
- `welcome`
  - returns server-issued `player_id`, `secret`, `display_name`
- `world_state`
  - sends `world: makeWorldForClient()`
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
  - now also initializes owned local plot detail when a player plot is claimed for the first time

New temporary debug message flow:
- `debug_clear_plot_cell`
  - validates:
    - payload
    - plot existence
    - plot type
    - ownership
    - local cell clearability
  - mutates the targeted local cell
  - saves world state
  - broadcasts `plot_update`
  - returns `debug_clear_plot_cell_result`

### 4.6 Presence
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

New temporary M2 debug support:
- public send method for:
  - `debug_clear_plot_cell(plot_id, x, y)`
- result signal for:
  - `debug_clear_plot_cell_result`

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

New temporary M2 debug responsibilities:
- determine whether the selected plot is owned by the local player
- show temporary debug action only on the local player's own claimed plot
- send `debug_clear_plot_cell` through `NetClient`
- handle `debug_clear_plot_cell_result`

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

New temporary M2 debug support:
- contains a static UI button:
  - `DebugClearCellButton`
- emits:
  - `debug_clear_requested(plot_id)`

Current temporary rule:
- the debug clear button is only shown for the local player's own claimed plot

This panel is intentionally still small, but it has now started to carry one temporary M2 debug action in addition to the M1 claim action.

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

Important M2 status note:
- this is still an M1-style world controller
- Player Plot mode and local neighborhood rendering are not implemented yet

### 5.6 PlotRenderer3D
`client/scripts/world/PlotRenderer3D.gd`

Responsibilities:
- spawn and own all tile instances under `TilesRoot`
- map `plot_id -> PlotTile3D`
- rebuild from `world_state`
- apply incremental plot updates
- keep selected/hovered tile visuals in sync

This is still the main M1 rendering module.

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

Important M2 status note:
- shell-based reduced-detail rendering is not implemented yet
- local owned-plot rendering is not implemented yet

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
  - contains:
    - `ClaimButton`
    - temporary `DebugClearCellButton`

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

## 7) M2 status assessment

### M1 still works
The original M1 prototype loop remains intact:
- connect/login
- enter world
- inspect plot
- claim plot
- receive updates

### M2 foundation is now meaningfully started
Completed so far:
- plot shell data exists
- claimed owned-plot detail exists
- starter local plot generation exists
- local cell lookup/clear helpers exist
- the server can mutate a local rubble cell
- the client can trigger that mutation through a temporary in-game debug button

### What is still missing for real M2 progression
Not done yet:
- World Map mode vs Player Plot mode
- neighborhood loading protocol
- local neighborhood snapshots
- local owned-plot rendering
- nearby shell/public rendering of surrounding plots
- local cell click interaction
- proper local UI/state instead of the temporary debug path

So the project is currently at a strong **M2 foundation checkpoint**, not yet at full M2 implementation.

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

6. **Do not confuse generic rubble with distinct placed objects.**
   Current design direction is:
   - rubble = local cell state
   - shelter / npc marker = placed objects
   This should be preserved unless the user explicitly redesigns it.

7. **Current local cell clearing is a temporary debug path, not the final gameplay flow.**
   Do not build too much permanent gameplay/UI around `DebugClearCellButton`.

8. **The world must remain gated behind the login/menu state unless deliberately redesigning that flow.**
   This was added specifically to avoid camera input while typing and to make the prototype feel more like a real game.

9. **If Connect stops working, check `HUD.gd` first.**
   There was already one regression where the connect logic ended up inside the quit handler.

---

## 9) Recommended next milestone direction

The next major step should be the real M2 structural move:

### Recommended next focus
- protocol support for entering Player Plot mode
- neighborhood/local plot snapshot loading
- client-side mode switching:
  - World Map mode
  - Player Plot mode
- initial local owned-plot rendering
- reduced-detail rendering of nearby surrounding plots/resource zones

### Recommended order
1. add protocol for local/neighborhood view
2. add client mode switch plumbing
3. add local neighborhood data handling
4. add owned-plot rendering
5. add nearby shell/public neighbor rendering

### Do not get distracted yet by
- full NPC systems
- production chains
- interiors
- polish-heavy graphics work
- premature optimization

The current project has reached a very good commit/handoff point before that larger M2 shift.

---

## 10) Summary for a new GPT assistant

The repo is no longer just “M1 complete.”
It is now:

- **M1 complete and still working**
- **M2 foundation started and partially implemented**

Most important current truths:
- the shared world map still works
- claimed player plots now have local detail data
- rubble is represented in local cells, not fake rubble objects
- local cells can be cleared server-side
- a temporary in-game debug button proves the end-to-end local interaction path
- the next real milestone work is neighborhood loading + Player Plot mode + local rendering
