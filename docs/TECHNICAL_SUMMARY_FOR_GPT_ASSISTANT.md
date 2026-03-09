# TECHNICAL_SUMMARY_FOR_GPT_ASSISTANT

**Project:** CozyChaosCityBuilder (Cozy Chaos City)  
**Stack:** Godot (client) + Node.js/TypeScript WebSocket server (server)  
**Last updated:** 2026-03-08  
**Current milestone:** **M1** (3D rendering in Godot using **individual tile scenes**)

This document is meant to be the single “handoff” reference for any future GPT assistant.

---

## 1) Project at a glance

The project is a multiplayer city-builder foundation:
- A **dedicated WebSocket server** owns the world state (plots, ownership, players).
- Multiple Godot clients connect, authenticate (profile-based), receive world snapshots, and can claim plots.
- World expansion is deterministic and pattern-based.
- The client has now started its real migration from the old 2D plot view into a modular **3D world scene**.

Key concept: plots are on a **grid** with stable coordinates and IDs.

---

## 2) Milestones

### M0 (completed)
- Server accepts multiple clients.
- Claiming a plot is validated server-side and broadcast to all clients.
- World persists to disk (`server/world_state.json`) and survives restart.
- Client stores per-profile credentials and reconnects as the same identity.

### M0.5 (completed)
Goal: implement the intended world layout rule + coordinate-based rendering.

Delivered:
- Plot coordinates (`x`, `y`) and stable IDs (`T_<x>_<y>`).
- Pattern rule implemented on the server:
  - `RESOURCE` if `x` and `y` are both even
  - otherwise `PLAYER`
- Initial world is **3×3**: `x=0..2`, `y=0..2`.
- Expansion adds exactly **one 3×3 module** per expansion (constant-size patch, max 9 plots).
- Godot 2D PlotView renders by coordinates (not index).
- Ping/latency shown in HUD (client RTT).
- Claimed plots display **owner display_name** reliably.
- Presence snapshots are emitted by the server and shown in the HUD.

### M1 (current)
Goal: bring the same world into **3D** in Godot using **individual tile scenes**, with a usable city-builder style camera and later 3D plot interaction.

#### M1 progress already completed
- Dedicated 3D world scene is in place.
- Dedicated 3D world controller script is in place.
- Main scene now instances the 3D world alongside UI and networking.
- HUD was refactored to be **UI-only**.
- Old active 2D PlotView path was removed from the active gameplay flow.
- Reusable 3D tile scene exists.
- Reusable 3D tile script exists.
- Temporary local 3×3 3D test grid exists.
- Dedicated runtime camera controller exists.
- Camera now supports:
  - movement
  - zoom-scaled movement speed
  - right-mouse drag yaw
  - right-mouse drag pitch/tilt
  - mouse-wheel zoom
  - zoom toward mouse world position

#### Still remaining for M1
- Real server-driven 3D tile rendering
- Dedicated `PlotRenderer3D.gd`
- 3D tile picking / selection
- Reconnect claim flow through 3D tile interaction
- Camera polish / bounds / feel improvements later

#### Out of scope for M1
- Buildings/interiors/NPC gameplay systems
- Advanced presence UX
- Minimap/world map work
- Major performance optimization systems such as MultiMesh

---

## 3) Repository structure (current)

```text
cozy-chaos-city/
  README.md
  CHANGELOG.md
  docs/
    TECHNICAL_SUMMARY_FOR_GPT_ASSISTANT.md
    GPT_Assistant_Rules.md
    Vertical_Cozy_City_Living_Document_Combined_v1.md
    M1_Technical_Summary.md
    M1_Discord_Summary_No_Fluff.md
    old/
      M0_5_LAYOUT_PATTERN_IMPLEMENTATION.md
      PATCH_NOTES_DISCORD.txt

  server/
    package.json
    package-lock.json
    tsconfig.json
    world_state.json
    src/
      index.ts
      core/
        config.ts
        world.ts
        players.ts
        presence.ts
      net/
        protocol.ts
      storage/
        persist.ts
      test_client.ts
    dist/                # build output, not source of truth
    node_modules/        # not source of truth

  client/
    project.godot
    main.tscn
    hud.tscn
    PlotView.gd          # old 2D renderer still exists in repo as fallback/reference
    export_presets.cfg
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
      world/
        GameWorld3D.gd
        PlotTile3D.gd
        CameraRigBasic.gd
```

Notes:
- The zip may include `.godot/` editor cache and `.tmp` scene files. Ignore them for logic work.
- `server/src/` is the source of truth on the backend.
- `client/PlotView.gd` still exists in the repo, but it is no longer the active world-rendering path in `main.tscn`.

---

## 4) Server architecture

### 4.1 Config
`server/src/core/config.ts`
- `port`: **27015**
- `protocolVersion`: **2**
- `expandWhenFreePlotsBelow`: **3**
- `persistPath`: `world_state.json`
- `pingIntervalMs`: used by websocket keepalive / timeout watchdog
- `clientTimeoutMs`: used to terminate stale clients
- `maxMessageBytes`: size guard for incoming messages

### 4.2 World model (authoritative)
Defined in `server/src/net/protocol.ts`:
- `PlotType`: `"PLAYER" | "RESOURCE"`
- `Plot`: `{ id, type, x, y, claimed_by }`
- `PlayerRecord`: `{ id, secret, display_name }`
- `WorldState`: `{ version, plots, players }`
- `players` is a dictionary: `player_id -> PlayerRecord`

Envelope shape:
- `v`: protocol version
- `type`: message type
- `req_id`: optional request id
- `payload`: optional object

### 4.3 Pattern rule and expansion
`server/src/core/world.ts`
- `plotTypeAt(x, y)` implements the deterministic pattern:
  - `RESOURCE` if `(x % 2 == 0 && y % 2 == 0)`
  - otherwise `PLAYER`
- `newWorld()` creates initial 3×3 at `x=0..2`, `y=0..2`
- Expansion is module-based:
  - `MODULE_SIZE = 3`
  - world grows by adding exactly **one 3×3 module** per expansion
- `expandWorld()` fills missing tiles in the chosen next module and returns `{ added }`
- `normalizeWorldForM0_5()` handles older save migration / normalization

### 4.4 Networking / routing
`server/src/index.ts`
- On connect: connection stored in `conns` with `{ player_id: null, lastSeen }`
- Incoming message flow:
  - parse JSON
  - validate envelope with Zod `EnvelopeSchema`
  - reject protocol version mismatch
  - enforce message size limit
- `hello`:
  - authenticate via `{ player_id, secret }`
  - or create a new player via `{ display_name }`
  - send `welcome { player_id, secret, display_name }`
  - send `world_state { world }`
  - send `presence_state { online }`
  - broadcast updated `presence_state`
- `request_world`:
  - sends fresh `world_state`
- `client_ping`:
  - replies with `server_pong` echoing the same `req_id`
- `claim_plot { plot_id }`:
  - validates plot exists
  - validates plot is `PLAYER`
  - validates plot is still free
  - sets `claimed_by = player_id`
  - increments `world.version`
  - persists world
  - broadcasts `plot_update { plot, owner_display_name }`
  - sends `claim_result`
  - checks free-plot threshold and may broadcast `world_patch { added, world_version }`
- Disconnect / timeout:
  - connection removed from `conns`
  - broadcast fresh `presence_state`

### 4.5 Presence snapshots
`server/src/core/presence.ts`
- Server keeps presence simple by broadcasting **full online snapshots**.
- Snapshot shape used by client:
  - `{ player_id, display_name }`

---

## 5) Client architecture (Godot)

### 5.1 Entry scenes
- `client/main.tscn`
  - `Main`
    - `GameWorld3D`
    - `UI` (`CanvasLayer`)
      - `HUD`
    - `NetClient`
- `client/hud.tscn`
  - top-bar style UI only

### 5.2 NetClient (WebSocket client)
`client/scripts/net/NetClient.gd`
- Uses `WebSocketPeer`
- Hardcoded default server URL currently points to a public IP + port:
  - `ws://90.225.57.62:27015`
- Optional override file supported:
  - `user://server_url.txt`
- Auth flow:
  - loads profile from `ProfileStore`
  - sends `hello` with stored credentials or new `display_name`
  - receives `welcome`
  - saves server-issued credentials back to disk
- Emits signals:
  - `status_changed`
  - `identity_ready(player_id, display_name)`
  - `world_state_received(world)`
  - `plot_updated(plot)`
  - `world_patch_received(patch)`
  - `claim_result_received(result)`
  - `latency_updated(ms)`
  - `presence_updated(online)`
- RTT ping:
  - sends `client_ping` on heartbeat interval
  - tracks request ids
  - computes RTT on `server_pong`

### 5.3 ProfileStore
`client/scripts/net/ProfileStore.gd`
- Stores per-profile JSON files under:
  - `user://profiles/<name>.json`
- Persists:
  - `player_id`
  - `secret`
  - `display_name`

### 5.4 HUD wiring
`client/scripts/ui/HUD.gd`
- Finds `GameWorld3D` using `/root/Main/GameWorld3D`
- Finds `NetClient` by group `netclient` or fallback `/root/Main/NetClient`
- Connect button:
  - calls `net.connect_with_profile(username)`
- Claim button:
  - calls `net.claim_plot(selected_plot_id)`
- World forwarding:
  - forwards local player identity to `GameWorld3D.set_my_player_id(...)`
  - forwards `world_state`, `plot_update`, and `world_patch` to `GameWorld3D`
- UI responsibilities now include:
  - username entry
  - connect button
  - claim button
  - status text
  - ping label
  - online label

Important:
- `HUD.gd` still contains `_on_plot_selected(plot_id, is_claimable)` and claim-button logic, but there is currently **no active 3D tile selection system** emitting into it yet.
- That means the HUD is structurally ready for claim integration, but the 3D selection pipeline is still missing.

### 5.5 PlotView (old 2D renderer)
`client/PlotView.gd`
- Still exists in the repo.
- Still supports:
  - rendering plots by `x,y`
  - selection
  - ownership display
  - owner name display
- It is **not** instanced in `main.tscn` anymore.
- Treat it as fallback/reference/debug material, not the active world renderer.

---

## 6) Current 3D world implementation status

### 6.1 `GameWorld3D.tscn`
`client/scenes/world/GameWorld3D.tscn`

Current 3D world shell includes:
- `CameraRig`
  - `YawPivot`
    - `PitchPivot`
      - `Camera3D`
- `SunLight`
- `TilesRoot`
- `Ground`

This is now the active world scene instanced by `main.tscn`.

### 6.2 `GameWorld3D.gd`
`client/scripts/world/GameWorld3D.gd`

Current responsibilities:
- store local player id
- store latest world snapshot
- maintain `plots_by_id`
- receive:
  - full world snapshots
  - single plot updates
  - world patches
- currently spawn a **temporary local 3×3 test grid** into `TilesRoot`

Important limitation:
- `GameWorld3D.gd` is currently doing two roles:
  - world-data ownership
  - temporary local tile spawning
- This is acceptable as a temporary test harness, but it should **not** become the permanent renderer owner.
- The next real renderer step should move tile spawning/update logic into a dedicated `PlotRenderer3D.gd`.

### 6.3 `PlotTile3D.tscn`
`client/scenes/world/PlotTile3D.tscn`

Current structure:
- `PlotTile3D` (`StaticBody3D`)
  - `Visual` (`MeshInstance3D`)
  - `Collider` (`CollisionShape3D`)

This prepares the tile for future:
- 3D ray picking
- selection
- tile-local visuals

### 6.4 `PlotTile3D.gd`
`client/scripts/world/PlotTile3D.gd`

Current tile-level responsibilities:
- store tile-local state:
  - `plot_id`
  - `grid_x`
  - `grid_y`
  - `plot_type`
  - `claimed_by`
  - `owner_display_name`
- support:
  - `apply_plot(plot, my_player_id)`
  - `set_selected(...)`
  - `set_hovered(...)`
- apply tile-local visual state for:
  - `RESOURCE`
  - free `PLAYER`
  - claimed plot
  - local-player-owned plot

### 6.5 Temporary local render test
Current M1 rendering still uses a temporary local test path inside `GameWorld3D.gd`:
- `_spawn_local_test_grid()`
- `_spawn_test_tile(...)`
- grid-to-world placement helper

Purpose:
- verify tile instancing
- verify spacing
- verify basic materials / colors
- verify the 3D scene is rendering correctly

This should be replaced by real server-driven rendering.

---

## 7) Current camera implementation status

### `CameraRigBasic.gd`
`client/scripts/world/CameraRigBasic.gd`

The dedicated camera controller now exists and is attached to `CameraRig`.

Current features:
- movement over the ground plane using Input Map actions:
  - `camera_left`
  - `camera_right`
  - `camera_up`
  - `camera_down`
- move speed scales with current zoom distance
- right mouse drag rotates yaw
- right mouse drag adjusts pitch/tilt
- pitch is clamped between exported min/max values
- mouse wheel zoom adjusts camera distance
- zoom is anchored toward the mouse world position on the flat ground plane (`y = 0`)

Important limitation:
- Camera feel is “good enough for now” but not final.
- Pitch/zoom feel may still need polish later.
- Mouse-target zoom currently uses a flat ground-plane intersection, not physics ray hits.
  - This is correct for the current flat world.
  - If terrain/building height becomes important later, this should be upgraded to real ray hits.

---

## 8) Networking protocol (current)

All messages use:
- `v`: protocol version (`2`)
- `type`: string
- `req_id`: optional string
- `payload`: optional dict/object

### Client -> Server
- `hello`
  - `{ player_id, secret }` for reconnect
  - or `{ display_name }` for first-time identity creation
- `request_world`
- `claim_plot { plot_id }`
- `client_ping`

### Server -> Client
- `welcome { player_id, secret, display_name }`
- `world_state { world }`
- `plot_update { plot, owner_display_name? }`
- `world_patch { added, world_version }`
- `claim_result { ok, plot_id?, reason? }`
- `server_pong`
- `presence_state { online: [ { player_id, display_name }, ... ] }`
- `error { reason }`

---

## 9) Local dev and running

### Server
From `server/`:
- `npm install`
- `npm run dev`

Server listens on:
- `ws://0.0.0.0:27015`

### Client
Open `client/` in Godot and run.

Current flow:
- enter username
- press Connect
- client authenticates / creates identity
- HUD shows status + ping + online list
- active world view is now the 3D scene

Important current limitation:
- 3D tile claiming is **not yet active**, because there is no 3D tile selection/picking wired into the HUD yet.
- The old 2D claim path existed through `PlotView`, but the active world scene is now 3D.

Public playtest note:
- `NetClient.gd` currently defaults to the public IP above.
- LAN/dev override is still possible with `user://server_url.txt`.

---

## 10) GPT Assistant rules (required working style)

See `docs/GPT_Assistant_Rules.md`. Core rules:
- Never guess file contents. Always read the actual project files first.
- Give exact edit locations (file paths + line numbers or precise anchors).
- Keep code modular.
- New file = provide the whole file.
- Existing file = provide only the minimal patch with exact placement.
- Prefer Godot editor instructions for scene/UI structure changes.
- Explain what + why + how to test after each step.

---

## 11) Recommended next implementation order

### Highest-value next step
1. Create `PlotRenderer3D.gd`
   - own `plot_id -> tile instance`
   - spawn/update/remove tiles
   - consume full `world_state`
   - consume `plot_update`
   - consume `world_patch`

### After that
2. Remove the temporary local 3×3 test-grid path from `GameWorld3D.gd`
3. Optionally add `PlotGridMath.gd` if coordinate math is about to spread
4. Create `TilePicker3D.gd`
5. Implement 3D tile selection
6. Reconnect claim flow through 3D tile selection and existing HUD / NetClient path
7. Add hover / selection visuals
8. Polish camera bounds / feel later

### Important architectural rule
Do **not** let `GameWorld3D.gd` become a permanent god-object.
- `GameWorld3D.gd` should coordinate systems.
- Tile spawning/rendering should move into `PlotRenderer3D.gd`.
- Picking should move into its own module.
- Camera should remain in `CameraRigBasic.gd`.

---

## 12) Known gotchas / current realities

- `client/PlotView.gd` still exists in the repo, but it is no longer part of the active scene flow.
- `HUD.gd` is ready to receive selection state, but nothing currently emits 3D tile selections yet.
- The active 3D world is still rendering only a temporary local test grid, not the live server world.
- `NetClient.gd` currently points to a public IP by default. That may change if the public IP changes.
- Presence snapshots are already implemented and shown in the HUD, even though deeper presence UX is not the focus of M1.
- Camera zoom-to-mouse currently assumes a flat ground plane at `y = 0`.

---

## 13) Short handoff summary for the next assistant

The project has already moved significantly into M1.

What is true **right now**:
- The active client world scene is 3D.
- The old 2D PlotView is no longer the active renderer.
- HUD is now UI-only.
- `GameWorld3D.gd` owns world data and currently runs a temporary local 3×3 tile render test.
- Reusable 3D tile scene and script exist.
- Runtime camera controls exist and are good enough to continue.
- The biggest missing piece is **real server-driven 3D tile rendering**.

So the next assistant should **not** restart from 2D assumptions.
The next assistant should read the live files first, then continue with:
- `PlotRenderer3D.gd`
- real snapshot/patch rendering
- 3D tile picking
- claim integration
