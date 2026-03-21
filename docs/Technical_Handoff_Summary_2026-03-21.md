# Technical Handoff Summary — 2026-03-21

## What is already implemented

### Core hardening delivered this session
- server/tooling baseline improved:
  - `server/.gitignore` added
  - `server/package.json` lint/test scripts now call direct node entrypoints
- explicit timed payload contract added:
  - `server_time_ms` on `world_state`
  - `server_time_ms` on `plot_update`
  - `server_time_ms` on `world_patch`
  - `server_time_ms` on `server_pong`
- client wire adapters now preserve timing metadata:
  - `_snapshot_server_time_ms`
  - `_received_local_ms`
- owned-plot renderer now reconstructs NPC movement progress from server snapshot timing instead of `Time.get_unix_time_from_system()`
- NPC working-state facing now rebuilds deterministically from the rubble work target when re-entering the plot
- NPC visuals now use the project-owned `NpcVisual` wrapper scene/script instead of direct raw imported-model assumptions
- lightweight server dev metrics added for:
  - NPC tick/simulation time
  - client world/plot DTO build time
  - JSON persistence clone/flush/write time
- NetClient cleanup delivered:
  - cleaner endpoint override validation
  - fresh socket reset before reconnect attempts
  - stale latency/presence cleared on disconnect
  - duplicate `"error"` handler removed
- stale server test updated:
  - `npc.test.ts` now advances using the actual `state_ends_at_ms` boundary

### Current measured result
With 10 claimed plots and Scavenge All running across them:
- NPC simulation is still cheap
- tick loop still has healthy headroom
- the first real pressure point is JSON persistence clone/write cost, not NPC logic

## What is next

### Immediate recommended next step
- friend playtesting plus selective cleanup only where testing proves it matters

### Next small hardening items still available
- profile filename sanitization
- plot enter/leave + HUD/menu/camera stability validation pass
- optional cleaner perf log formatting if logs become hard to read during larger tests

### Next gameplay-facing step after that
- targeted order-selection flow to replace reliance on `Scavenge All`
- implementation of resources, materials, dump zone, stockpile and storage + UI

## What is still temporary / known limitations
- JSON persistence is still the save backend
- persistence clone/write is now the first known scaling pressure
- dev metrics are developer-only and intentionally lightweight
- `server/src/index.ts` and some major client scripts are still hotspot files and should not become dumping grounds
- profile filename sanitization is still deferred
- the uploaded repo still contains noisy archive content (`.git`, `node_modules`, `.godot`, temp files)
- the current uploaded `README.md` is truncated and should be replaced with the corrected version before finalizing the branch
