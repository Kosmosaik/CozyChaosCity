**## Patch Notes — v0.0.12 - Post-M3 Hardening Pass 1 — 2026-03-21 ##**

**NPC / Plot Feel**
- NPC movement now stays much more stable when leaving and re-entering your plot.
- NPCs no longer depend on your PC clock for movement presentation.
- Working NPCs now keep a more correct facing direction when returning to an active rubble pile.
- NPC visuals now use a cleaner internal setup, making the current character presentation more stable for future updates.

**Networking / Playtesting Stability**
- Improved connection handling for internal playtesting.
- Invalid local server overrides are now ignored instead of causing messy connection attempts.
- Reconnect attempts now start from a cleaner socket state.
- Stale latency/presence state is now cleared better after disconnects.
- Removed duplicate network error handling on the client.

**Performance / Debug**
- Added lightweight server performance tracking during dev/testing.
- The server can now report timing for NPC ticking, client plot payload building, and save operations.
- Early testing shows NPC simulation is still cheap.
- The first real pressure point appears to be save cloning/writing, not NPC logic.

**Tooling / Foundation**
- Improved server-side validation script reliability.
- Added a server-local `.gitignore` for cleaner workflow.
- Updated the project foundation toward a more durable post-M3 hardening direction instead of jumping straight into more feature growth.
