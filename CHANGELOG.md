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

  ---

## [0.0.6] — 2026-03-12 — M2 Progress (Player Plot Mode + Local Object Foundation)

### Added
- First playable **Player Plot mode** on the client:
  - select your own claimed `PLAYER` plot
  - press **Enter Plot**
  - switch into local owned-plot view
  - press **Leave Plot** to return to the world
- Dedicated owned-plot renderer:
  - `client/scripts/world/OwnedPlotDetailRenderer3D.gd`
- Dedicated local object wrapper scenes:
  - `client/scenes/local_objects/StarterShack.tscn`
  - `client/scenes/local_objects/Rubble4x4.tscn`
- Local-view camera transition flow:
  - zoom-in tween when entering plot mode
  - zoom-out tween when leaving plot mode
- Transition audio hook in the 3D world scene.
- Real authored local object assets integrated into the local plot view:
  - shed / shack model
  - rubble model
- New local-view scene nodes:
  - `OwnedPlotRoot`
  - `TransitionAudioPlayer`
- New popup/UI controls:
  - `EnterPlotButton`
  - `ExitPlotButton`

### Changed
- Owned plot detail is now rendered at real local scale:
  - `1 cell = 1 meter`
  - starter owned plot expanded to a larger local playable area
- Player-facing local rendering no longer exposes the hidden cell grid directly.
- Local plot presentation now uses:
  - one full plot ground surface
  - placed local objects on top
- Rubble was refactored from “pure cell-layer presentation” into real local `4x4` placed objects while the hidden cell grid still remains authoritative for logic.
- Starter rubble layout now generates as placed `RUBBLE_4X4` local objects.
- Clearing a rubble cell now removes the owning `4x4` rubble object and frees its occupied cells.
- Claimed plot detail payloads are now owner-only and compacted for safer network/runtime behavior.

### Fixed
- Fixed connect-time instability caused by oversized local plot detail leaking into shared world payloads.
- Fixed claim-time instability by compacting owner-local detail on the wire and normalizing it client-side.
- Fixed several temporary local-renderer regressions during the shift from visible-cell rendering to object-based rendering.

### Notes / Known limitations
- This is still not full neighborhood rendering yet.
- Player Plot mode currently focuses on the owned plot only.
- Nearby surrounding plots/resource zones are not yet rendered as a local neighborhood window.
- The debug clear button is still a temporary developer/testing interaction path.
- NPC still uses a temporary placeholder marker in local view.
- Ground/rubble visuals are now on the correct architectural path, but more polish and final art setup are still expected later.

---

## [0.0.7] — 2026-03-12 — M2 Progress (Player Plot Camera Parity + Real Rubble Interaction + Local Visual Polish)

### Added
- First real local object interaction flow in Player Plot mode:
  - click rubble object
  - send clear request by object id
  - server validates ownership and clears authoritatively
  - updated plot detail is broadcast back to clients
- Dedicated local plot interaction script:
  - `client/scripts/world/LocalPlotInteractor.gd`
- Real object-based clear request path:
  - `clear_plot_object`
- Animated rubble clear/removal behavior using:
  - `client/assets/Rubble_A.glb`
  - `client/scripts/world/local_objects/Rubble4x4.gd`
- Incremental owned-plot refresh path so removed rubble can animate out instead of instantly disappearing.
- Local visual variation for rubble:
  - random Y-axis rotation
  - slight random X/Z placement offset
- Randomized local ground material using 5 seamless textures through:
  - `client/shaders/plot_ground_random_5.gdshader`
  - `client/assets/ground_textures/`

### Changed
- Player Plot mode camera now reuses the world-style camera controls more naturally after entering.
- Local camera movement is now bounded to the owned-plot area plus extra padding instead of remaining mostly fixed.
- `OwnedPlotDetailRenderer3D.gd` now tracks starter objects by id and refreshes the active owned plot incrementally.
- Rubble is now instantiated as the real authored scene root so click handling, ids, and clear animation all operate on the same node.
- Active owned-plot local detail now refreshes when authoritative `plot_update` messages arrive.

### Fixed
- Fixed local rubble clicks not producing any action because the clickable rubble body was not receiving the authoritative object id.
- Fixed rubble removal popping instantly by refreshing active local detail and animating removed rubble on the client.
- Fixed Player Plot camera behavior so local mode no longer feels like a mostly locked overview shot.

### Notes / Known limitations
- The old debug clear path still exists and is temporary.
- Neighborhood loading/rendering is still not implemented yet.
- Nearby player plots and nearby resource plots are not yet rendered in local mode.
- The current local NPC is still a placeholder marker.
- Local rubble interaction currently clears on click directly; hover/selection feedback is not implemented yet.

---

## [0.0.8] — 2026-03-13 — M2 Progress (Rubble UX Polish + Debug Clear Removal + Local Camera/Input Cleanup)

### Added
- Procedural sky / world environment for the 3D scene.
- Dedicated rubble context menu in the HUD:
  - right-click rubble
  - cursor popup
  - `Clear` action
- Multi-step rubble clearing:
  - starter rubble now tracks `clear_hits_remaining`
  - each clear action reduces the remaining count
  - final clear removes the rubble object
- Clear-result feedback now reports:
  - whether rubble was fully cleared
  - how many clear actions remain
- Smoke particle effect on final rubble removal:
  - `client/scenes/local_objects/RubbleClearSmoke.tscn`
  - `client/assets/particles/smoke_flipbook.png`
- Extra local input polish for camera/menu coexistence:
  - RMB release-to-open interaction logic
  - camera rotate cancel/reset support for popup flows
  - RMB drag threshold before camera rotation begins

### Changed
- Rubble interaction now uses a proper context action flow instead of immediate click-to-clear.
- Local rubble interaction now opens on right-click release only when the pointer did not meaningfully drag.
- Camera rotation no longer begins instantly on RMB press; a small drag threshold is required first.
- HUD now prevents popup/menu flows from leaving the camera stuck in rotate mode.
- Plot selection UI is now suppressed while inside Player Plot mode so rubble interaction does not wrongly reopen the world-side plot panel.

### Removed
- Removed the temporary debug clear cell gameplay path from the active client/server flow.
- Removed debug clear UI from `PlotInfoPanel`.

### Fixed
- Fixed `PlotInfoPanel` reappearing during owned-plot rubble interaction.
- Fixed camera/menu input conflicts when interacting with rubble quickly.
- Fixed a stuck-camera state that could happen after opening and dismissing the rubble context menu.
- Fixed rubble smoke not playing by using an active emitting particle setup.

### Notes / Known limitations
- Local NPC still uses a placeholder marker.
- Player Plot mode still renders only the owned plot.
- Neighborhood loading/rendering is still not implemented.
- Local gameplay is still at an early interaction stage beyond rubble clearing.

---

## [0.0.9] — 2026-03-16 — M3 Progress (Foundation Hardening + Real NPC Orders + Stability Pass)

### Added
- First real local NPC gameplay foundation:
  - dedicated `npcs` data on owned plot detail
  - dedicated `jobs` data for owned-plot work
  - first real local NPC actor rendering in Player Plot mode
- First authoritative local order flow:
  - `Scavenging`
  - server validates order ownership/eligibility
  - jobs are created authoritatively
  - NPC performs the work loop on the owned plot
- First authoritative NPC state loop:
  - `idle`
  - `moving_to_target`
  - `working`
  - `carrying_to_dropoff`
  - `dropping_off`
  - `returning`
- Starter owned-plot scavenging loop:
  - NPC selects local rubble work targets
  - moves to the target
  - works over time
  - carries result back toward the shack dropoff
- Client-safe world payload shaping:
  - dedicated client world/build path
  - owner-only local detail remains private
  - player secrets are no longer included in world snapshots
- Runtime protocol validation using dedicated message schemas.
- Safer persistence foundation:
  - runtime save path moved under `server/data/`
  - debounced JSON world repository introduced
- First server automated tests:
  - client-world sanitization test
  - NPC/job-system behavior test
- First server code-quality toolchain:
  - `typecheck`
  - `test`
  - `lint`

### Changed
- NPC order handling was refactored away from the earlier rushed single-order slice toward a more durable job-based foundation.
- Scavenging now starts only when the player explicitly issues the order.
- Repeated scavenging requests are now rejected while an active scavenging loop already exists on that plot.
- NPC target selection now prefers the nearest valid queued rubble target instead of arbitrary queue order.
- NPC local movement presentation now keeps active movement state more stable instead of restarting tweens unnecessarily on repeated updates.
- Client networking now uses the newer protocol version and normalized wire-adapter flow for owned-plot detail.
- World persistence/config setup is now cleaner and more production-oriented than the earlier direct save-file path.

### Removed
- Removed the unsafe client world snapshot behavior where full server player data could leak into client-facing world payloads.
- Removed the old raw direct-save pattern as the main persistence path in favor of the repository/debounced save approach.

### Fixed
- Fixed a major security issue where player secrets could leak through full world payloads.
- Fixed owned-plot re-entry crashes caused by freed NPC node references being reused in the local renderer.
- Fixed NPC scavenging auto-starting on plot entry without the player pressing the order button.
- Fixed NPC movement slowdown/snap issues caused by repeated tween restarts from repeated updates.
- Fixed several Godot strict-typing/warning-as-error issues by replacing inferred local variables with explicit types in key world/client scripts.
- Fixed server linting/tooling setup and brought the server baseline to passing:
  - `npm run typecheck`
  - `npm run test`
  - `npm run lint`

### Notes / Known limitations
- The Scavenge button is still clickable while a scavenging loop is already active; the server rejects duplicate orders, but the button is not yet disabled in the UI.
- Local NPC visuals/animation are still early and not final-polish quality yet.
- Player Plot mode still renders only the owned plot.
- Neighborhood loading/rendering is still not implemented yet.
- The current job/order system is now on the correct architectural path, but broader economy/logistics/business systems are still future work.

---

## v0.0.11 - M3 Orders Foundation & Debug Overlay

### Orders System
- Introduced new modular Orders panel in bottom UI
- Added Scavenge One and Scavenge All as order actions
- Active order now displayed clearly in UI
- Cancel Active Order moved to inline X button
- Removed redundant error messages from UI
- Orders list now supports future expansion

### Server / Simulation
- Fixed critical issue where cancelled jobs were retained
- Jobs are now properly removed on cancel
- Prevents duplicate job IDs and unstable state
- Improved NPC cleanup when cancelling orders

### UI / Stability
- Fixed order panel resizing and layout expansion issues
- Fixed button hover and click inconsistencies
- Improved layout structure for scalability

### Debug Tools
- Added Plot Debug Overlay (toggle with F3)
- Displays:
  - Active order
  - Job counts by status
  - NPC counts by state
  - Rubble targets
- Overlay updates in real-time

---
## [0.0.12] — 2026-03-21 — Post-M3 Hardening Pass Part 1 (Timing Sync + Visual Wrapper + Dev Metrics + NetClient Cleanup)

### Added
- Server-side developer metrics foundation:
  - `server/src/core/dev_metrics.ts`
  - `server/src/core/dev_metrics.test.ts`
- Timed network payload support:
  - `world_state`, `plot_update`, and `world_patch` now include `server_time_ms`
  - `server_pong` now returns `server_time_ms`
- Canonical NPC visual wrapper:
  - `client/scenes/actors/NpcVisual.tscn`
  - `client/scripts/world/actors/NpcVisual.gd`
- Server-local ignore rules:
  - `server/.gitignore`

### Changed
- NPC movement presentation no longer depends on the client wall clock:
  - client wire adapters now preserve snapshot timing metadata
  - the owned-plot renderer reconstructs movement progress from server-authored timestamps plus local monotonic receive time
- NPC actor presentation now depends on the project-owned `NpcVisual` wrapper instead of raw imported model assumptions for:
  - animation player lookup
  - label anchor resolution
  - model-space transform ownership
- NPC working-state facing is now reconstructed deterministically from the rubble work target when re-entering the plot.
- NetClient connection flow is now cleaner for playtesting:
  - validates `server_url.txt` overrides
  - resets socket/runtime state before reconnect attempts
  - clears stale latency/presence on disconnect
  - removes the duplicate `"error"` branch
- Server tooling scripts now call ESLint/Vitest through direct node entrypoints instead of relying on copied `.bin` shims.
- Server config now exposes dev-metrics flags:
  - `CCC_ENABLE_DEV_METRICS`
  - `CCC_DEV_METRICS_REPORT_INTERVAL_MS`
- Client world/plot DTO shaping and JSON persistence now emit timing metrics during dev runs.

### Fixed
- Fixed the stale NPC test expectation by advancing to the actual `state_ends_at_ms` boundary instead of a magic timestamp.
- Fixed NPC facing changing on plot re-entry while working on rubble.
- Fixed a missing `_connect_ws(...)` path during the NetClient cleanup pass.
- Fixed one major visual correctness issue where reconnect/re-entry could restart movement presentation from an incorrect position.
- Fixed one class of zip/archive tooling failures where copied server bin shims were not executable.

### Notes / Known limitations
- JSON persistence is still the current save backend; the new metrics confirm that clone/write cost is the first real scaling pressure, not NPC simulation.
- Dev metrics are still a developer-only aid, not a final player-facing benchmark system.
- The current uploaded repo still contains noisy archive content (`.git`, `node_modules`, `.godot`, temp files), so clean handoff hygiene is still an active workflow issue.
- The current repo README in the uploaded zip is truncated; restore the corrected README before finalizing the branch.

---