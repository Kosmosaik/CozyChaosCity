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