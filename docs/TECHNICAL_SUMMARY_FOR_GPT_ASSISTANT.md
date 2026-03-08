# TECHNICAL_SUMMARY_FOR_GPT_ASSISTANT

**Project:** CozyChaosCityBuilder (Cozy Chaos City)  
**Stack:** Godot (client) + Node.js/TypeScript WebSocket server (server)  
**Last updated:** 2026-03-06
**Current milestone:** **M1** (3D rendering in Godot using **individual tile scenes**)

This document is meant to be the single “handoff” reference for any future GPT assistant.

---

## 1) Project at a glance

The project is a multiplayer city-builder foundation:
- A **dedicated WebSocket server** owns the world state (plots, ownership, players).
- Multiple Godot clients connect, authenticate (profile-based), receive world snapshots, and can claim plots.
- World expansion is deterministic and pattern-based.

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
- Claimed plots display **owner display_name** (not just player_id) reliably.

### M1 (current)
Goal: bring the same world into **3D** in Godot using **individual tile scenes**, plus a basic camera.

Scope for M1:
- A new 3D world scene (client) that renders plots at correct positions derived from `(x,y)`.
- A basic camera system for panning/moving + zoom (simple, expandable later).
- 3D interaction:
  - click/select a plot
  - send `claim_plot` for the selected plot id
  - update visuals on server broadcasts

Out of scope for M1:
- Advanced camera polish and modes
- Presence/online UX (even though the server already emits presence snapshots)
- Buildings/interiors/NPC gameplay systems
- World map/minimap rendering (likely later, a simplified plots map (may be in 2D for performance reasons))

---

## 3) Repository structure (current)

```
cozy-chaos-city/
  README.md
  CHANGELOG.md
  docs/
    TECHNICAL_SUMMARY_FOR_GPT_ASSISTANT.md
    GPT_Assistant_Rules.md
    Vertical_Cozy_City_Living_Document_Combined_v1.md
    M1_Technical_Summary.md
    M1_Discord_Summary_No_Fluff.md

  server/
    package.json
    tsconfig.json
    world_state.json           # persisted world state (dev reset is OK early on)
    src/
      index.ts                 # WebSocket server message routing
      core/
        config.ts              # CONFIG (port, protocol version, thresholds)
        world.ts               # world generation, expansion, migration/normalization
        players.ts             # identity create/validate (player_id + secret)
        presence.ts            # online snapshot helper (currently used by server)
      net/
        protocol.ts            # message envelope + types + makeMsg()
      storage/
        persist.ts             # load/save world_state.json (atomic)
      test_client.ts           # dev helper (not required)
    dist/                      # compiled output (may exist from builds)

  client/                      # Godot project root
    project.godot
    main.tscn                  # main scene
    hud.tscn                   # HUD scene (2D UI)
    PlotView.gd                # 2D coordinate renderer
    scripts/
      net/
        NetClient.gd           # WebSocket client + profile auth + ping RTT
        ProfileStore.gd        # loads/saves user://profiles/<name>.json
      ui/
        HUD.gd                 # wires UI -> NetClient, PlotView integration
```

Notes:
- The repo zip may include `.godot/` editor cache and `.tmp` scene files; those are not important for logic.

---

## 4) Server architecture

### 4.1 Config
`server/src/core/config.ts`
- `port`: **27015**
- `protocolVersion`: **2**
- `expandWhenFreePlotsBelow`: **3**
- `persistPath`: `world_state.json`
- ping/timeouts: `pingIntervalMs`, `clientTimeoutMs`

### 4.2 World model (authoritative)
Defined in `server/src/net/protocol.ts`:
- `PlotType`: `"PLAYER" | "RESOURCE"`
- `Plot`: `{ id, type, x, y, claimed_by }`
- `WorldState`: `{ version, plots, players }`
- `players` is a dict: `player_id -> { id, secret, display_name }`

### 4.3 Pattern rule and expansion
`server/src/core/world.ts`
- `plotTypeAt(x,y)` implements the deterministic pattern:
  - RESOURCE if (x%2==0 && y%2==0) else PLAYER
- `newWorld()` creates initial 3×3 at x=0..2, y=0..2
- `expandWorld()` adds exactly one **3×3 module** per expansion (max 9 new plots)
- `normalizeWorldForM0_5()` normalizes older save formats at startup

### 4.4 Networking / routing
`server/src/index.ts`
- On connect: connection stored in `conns` with `{player_id:null,lastSeen}`
- Message validation:
  - parse JSON
  - validate envelope with Zod `EnvelopeSchema`
  - check `env.v` equals `CONFIG.protocolVersion`
- `hello`:
  - authenticate via `{player_id, secret}` or create new via `{display_name}`
  - sends `welcome { player_id, secret, display_name }`
  - sends `world_state { world }`
- `claim_plot { plot_id }`:
  - validates plot exists, is PLAYER, unclaimed
  - sets `claimed_by = player_id`
  - increments `world.version`
  - persists world
  - broadcasts `plot_update { plot, owner_display_name }`
  - sends `claim_result`
  - checks expansion threshold, may broadcast `world_patch { added, world_version }`
- Heartbeat:
  - client sends `client_ping`; server replies `server_pong` with same `req_id`
  - server also does a websocket ping/timeout watchdog

### 4.5 Presence snapshots (implemented server-side)
- Server sends `presence_state { online: [...] }` after hello and on disconnect.
- Client currently displays an online list in the HUD (even if “presence UX” is deferred).

---

## 5) Client architecture (Godot)

### 5.1 Entry scenes
- `client/main.tscn`: main scene containing NetClient + HUD (and PlotView)
- `client/hud.tscn`: HUD UI (username, connect, claim, status, ping, online)

### 5.2 NetClient (WebSocket client)
`client/scripts/net/NetClient.gd`
- Uses `WebSocketPeer`
- Envelope fields:
  - `v`: protocol version (2)
  - `type`, `req_id`, `payload`
- Auth flow:
  - reads profile from `ProfileStore`
  - sends `hello` with credentials or display_name
  - receives `welcome` and saves credentials to disk
- World flow:
  - receives `world_state` and emits `world_state_received(world)`
  - receives `plot_update` and emits `plot_updated(plot)` (attaches `owner_display_name` if present)
  - receives `world_patch` and emits `world_patch_received(patch)`
- RTT ping:
  - sends `client_ping` every `_heartbeat_interval` seconds
  - tracks `req_id -> send_time`
  - on `server_pong` computes RTT and emits `latency_updated(ms)`
- Connection target:
  - `DEFAULT_SERVER_URL` is currently hardcoded to a public IP + port
  - Optional override file: `user://server_url.txt` (LAN/dev convenience)

### 5.3 HUD wiring
`client/scripts/ui/HUD.gd`
- Finds NetClient via group `"netclient"` or fallback `/root/Main/NetClient`
- Connect button calls `net.connect_with_profile(username)`
- Claim button calls `net.claim_plot(selected_plot_id)`
- Updates:
  - status text
  - ping label
  - online label (presence snapshot)

### 5.4 2D PlotView
`client/PlotView.gd`
- Renders plots by `(x,y)` with computed bounds.
- Click selects plot and emits `plot_selected(plot_id, is_claimable)`
- Displays:
  - type (RESOURCE vs PLAYER)
  - ownership (FREE/MINE/TAKEN)
  - owner display name (prefers `owner_display_name` field)

---

## 6) Networking protocol (current)

All messages use:
- `v`: protocol version (2)
- `type`: string
- `req_id`: optional string
- `payload`: optional dict

Client -> Server:
- `hello`:
  - `{ player_id, secret }` for reconnect
  - OR `{ display_name }` for first-time identity creation
- `request_world`
- `claim_plot { plot_id }`
- `client_ping`

Server -> Client:
- `welcome { player_id, secret, display_name }`
- `world_state { world }`
- `plot_update { plot, owner_display_name? }`
- `world_patch { added, world_version }`
- `claim_result { ok, plot_id?, reason? }`
- `server_pong` (echoes `req_id`)
- `presence_state { online: [ {player_id, display_name}, ... ] }`
- `error { reason: ... }`

---

## 7) Local dev and running

### Server
From `server/`:
- `npm install`
- `npm run dev` (uses ts-node-dev)

Server listens on:
- `ws://0.0.0.0:27015` (LAN/public via port-forward)

### Client
Open `client/` in Godot and run.
- Enter username, Connect.
- Click plot, Claim.

Public test:
- Works via router port-forwarding TCP 27015 to the server LAN IP.

---

## 8) GPT Assistant rules (required working style)

See `docs/GPT_Assistant_Rules.md`. Summary:
- Never guess file contents. Always read the project files first.
- Give exact edit locations (file paths + line numbers/anchors).
- Keep code modular (no spaghetti).
- If creating a new script, provide the whole file and explain it.
- If patching a script, provide a minimal diff with exact insertion points.

---

## 9) M1 implementation notes (individual tiles)

For M1, implement 3D with individual tile scenes:
- Create a `PlotTile3D.tscn` (mesh + collision) and `PlotTile3D.gd` controller.
- Create a `PlotRenderer3D.gd` that:
  - instantiates tiles keyed by plot id
  - updates tiles on `plot_update`
  - adds tiles on `world_patch`
- Add a basic `CameraRigBasic.gd` for movement + zoom.
- Add picking:
  - raycast to tile collider -> select -> claim.

Keep the 2D PlotView as a fallback/debug view until 3D is stable.

---

## 10) Known “gotchas”
- If `DEFAULT_SERVER_URL` is a public IP, it may change (dynamic IP). A domain/DDNS can be added later.
- Presence UX is intentionally deferred, but server/client already include presence messages.
- The repository zip includes `server/node_modules/` and `server/dist/` which are not essential to read for logic changes; source of truth is `server/src/`.

