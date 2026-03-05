# Technical Summary for Next GPT Assistant (Vertical Cozy City / CozyChaosCity)

## Project at a glance
A multiplayer city-builder foundation is being built in **Godot (client)** + **Node.js/TypeScript (server)**. Milestone 0 is complete (networking + plot claiming + persistence + profiles). Next work is Milestone 1 (world layout rules/pattern generation).

Concept/design is captured separately in:
- `Vertical_Cozy_City_Living_Document_Clean_v3.md` (design-only, no code)

## Current milestone status
### M0 — Completed (core acceptance)
- Dedicated server runs continuously.
- Multiple clients connect and receive `world_state`.
- Player selects a free plot (click highlight) then presses **Claim**.
- Server validates claim and broadcasts `plot_update`.
- Claimed plots persist across client restart and server restart (`world_state.json`).
- World expands when free plots drop below a threshold (currently `< 3`).
- Heartbeat keeps clients connected.
- Profiles:
  - player enters a username (local profile name).
  - server issues `player_id + secret` via `welcome`.
  - client stores per-profile credentials and reconnects as same player.
- Client UI shows plots as **FREE / MINE / TAKEN** based on `player_id`.

### Next milestone
### M0.5 — World Layout Pattern (next)
Implement intended macro world layout pattern:
- player plots and **resource plots (res-plots)** in a repeating arrangement
- requires plot coordinates (x,y) and pattern-based generation
- expansion must preserve the pattern when adding new plots

## Repository structure (what exists now)
```
/server
  /src
    index.ts                 # WebSocket server: routing, hello/welcome auth, claim, expansion check, persistence
    /core
      config.ts              # CONFIG constants (port, thresholds, etc.)
      world.ts               # world generation + expansion functions
      players.ts             # create/validate server-issued identity (player_id + secret)
    /net
      protocol.ts            # Envelope + Plot/WorldState types
    /storage
      persist.ts             # load/save world_state.json (atomic write)
    test_client.ts           # optional dev helper (not required for current workflow)
  package.json
  tsconfig.json
  world_state.json           # persisted world (often deleted for clean resets)

/client (Godot project)
  project.godot
  /Scenes
    Main.tscn                # main scene; contains NetClient + UI/HUD
    HUD.tscn                 # UI: username input, connect button, claim button, status label, PlotView
  /Scripts
    /Net
      NetClient.gd           # WebSocket client; hello/welcome, world updates, claim_plot, heartbeat
      ProfileStore.gd        # load/save per-profile credentials (user://profiles/<name>.json)
    /UI
      HUD.gd                 # wires UI → NetClient; injects player_id into PlotView
    PlotView.gd              # draws plot grid; FREE/MINE/TAKEN; labels resource plots as RES-PLOT
  user://profiles/           # created at runtime; stores per-profile JSON credentials
```

## Networking protocol (current)
Messages are JSON with a versioned envelope:
- `v`: protocol version (1)
- `type`: message type string
- `req_id`: request id (debugging)
- `payload`: message data

### Key message types
Client → Server:
- `hello`
  - `{display_name}` for first-time profile
  - `{player_id, secret}` for reconnect/auth
- `request_world` (optional; server also sends world snapshot after welcome)
- `claim_plot` `{plot_id}`
- `client_ping` heartbeat

Server → Client:
- `welcome` `{player_id, secret, display_name}`
- `world_state` `{world}` where `world` contains `version`, `plots`, `players`
- `plot_update` `{plot}`
- `world_patch` `{added, world_version}`
- `claim_result` `{ok, plot_id?, reason?}`
- optional `server_pong`
- `error`

### Plot ownership
- Plots have `{ id, type, claimed_by }`
- `claimed_by` stores **player_id** (not username)

## Identity (profiles)
- Player enters a username (treated as a local profile name).
- Client loads `user://profiles/<username>.json` if exists:
  - if present: sends `{player_id, secret}` in `hello`
  - if not: sends `{display_name: username}`
- Server responds `welcome` and client saves/updates profile JSON.
- Client uses `player_id` to mark plots as **MINE**.

## Persistence + migration note
- Server schema may evolve; old `world_state.json` may be missing new fields (e.g., `world.players`).
- Server should normalize/migrate missing fields on startup (ensure `players = {}`).
- Deleting `world_state.json` is acceptable during early development to reset the world.

## What to work on next (M1)
- Add grid coordinates to plots (x,y).
- Implement repeating resource-plot pattern based on design sketches.
- Update expansion to maintain the pattern.
- Update PlotView to render by coordinates instead of index.
