# TECHNICAL_SUMMARY_FOR_GPT_ASSISTANT

**Project:** CozyChaosCityBuilder (Cozy Chaos City)  
**Stack:** Godot 4 client + Node.js/TypeScript WebSocket server  
**Last updated:** 2026-03-30  
**Current milestone direction:** **Branch 3 manufacturing is complete for the current gameplay scope; immediate next priority is Branch 4 — Construction foundation**  
**Current state:** M1 is complete. M2 delivered the first owned-plot gameplay foundation. M3 delivered the real NPC/order foundation. Branch 1 extraction/client verification is complete, Branch 2 hauling foundation is implemented, and Branch 3 manufacturing now has a working end-to-end pallet loop. The repo now has authoritative item ids, `plot_objects`, `loose_items`, real NPC carry slots, rubble output rolls, shared haul jobs/reservations/roaming, starter workbench state, active craft state, manufacturing queue/input/output flow, and client-readable logistics + station-buffer visuals.

This document is the current technical handoff summary for the repo.

---

## 1) Project at a glance

Cozy Chaos City is a server-authoritative shared-world multiplayer city-building/simulation game.

Current playable loop:
- player launches client
- sees menu/login overlay
- enters a username
- authenticates or reconnects
- enters the shared 3D world rendered from server state
- clicks a plot to inspect it
- claims a free `PLAYER` plot
- enters their owned local plot
- moves around locally with the same core camera feel
- interacts with rubble through the local popup flow
- sends authoritative clear requests by object id
- opens the bottom-bar Orders menu
- can issue the current real local orders:
  - `Scavenge All`
  - `Scavenge One`
- server creates authoritative jobs
- local NPC moves through the work loop and current scavenger direct-haul / ground-fallback behavior
- can cancel the active plot order cleanly
- can toggle the F3 debug overlay to inspect live job/NPC state
- player leaves back to the shared world

Important current direction:
- the project already has a working first owned-plot mode
- neighborhood loading/rendering is **not** the active next priority
- the project is now continuing from the **M3 NPC/order foundation** plus the first readable logistics foundation
- future work should keep extending stable systems instead of adding rushed feature slices
- the next priority is now **Branch 4 — Construction**, followed by Sorting and later UI/UX polish

---

## 2) Milestone state

### M0 — completed
Delivered:
- WebSocket multiplayer foundation
- server-authoritative plot claiming
- persistence
- profile-based reconnect identity

### M0.5 — completed
Delivered:
- coordinate-based plot system
- deterministic plot typing rule
- initial 3×3 world
- constant-size expansion modules
- presence snapshots
- latency support

### M1 — completed
Delivered:
- dedicated 3D shared world rendering
- reusable 3D tile scene and renderer
- hover/selection/inspect flow
- claim flow from in-game popup
- main menu/login overlay
- world disabled until login
- live server-driven world updates

### M2 — completed foundation
Delivered:
- shell data on plots
- owned-plot detail data on claimed player plots
- first Player Plot mode
- enter/exit transition between world and owned plot
- local owned-plot rendering
- one plot-wide local ground presentation
- hidden local cell grid for logic/blocking/snap future
- real local starter objects:
  - `SHACK`
  - `RUBBLE_4X4`
- compact owner-only local detail payloads using `cell_rows`
- real authoritative rubble interaction
- multi-step rubble clearing via `clear_hits_remaining`
- local polish:
  - rubble random rotation/offset
  - randomized plot-ground shader
  - smoke effect on final rubble removal
  - procedural sky/world environment
  - improved popup/camera input interaction
  - local free-move camera parity with world camera feel
  - world camera state restored on exit

### M3 — foundation complete for current flow
Delivered:
- dedicated `npcs` data on owned plot detail
- dedicated `jobs` data for owned-plot work
- current real authoritative local orders:
  - `Scavenge All`
  - `Scavenge One`
- first server-authoritative NPC state loop:
  - `idle`
  - `moving_to_target`
  - `working`
  - `carrying_to_dropoff`
  - `dropping_off`
  - `returning`
- first real local NPC actor rendering
- bounded server NPC progression/tick path
- nearest-valid rubble targeting for scavenging
- duplicate-order rejection while scavenging is already active
- server-authoritative active-order cancellation
- centralized client order definitions and typed order-menu entries
- dedicated bottom-bar Orders UI + `OrdersMenuPanel` foundation
- lightweight F3 `PlotDebugOverlay` for live job/NPC state inspection
- client-safe world payload shaping
- runtime protocol validation
- debounced repository-based JSON persistence
- first passing server baseline:
  - `npm run typecheck`
  - `npm run test`
  - `npm run lint`

### Deferred from active priority
Still not the current next step:
- neighborhood loading/rendering
- nearby-plot reduced-detail local view
- public local neighborhood window

These remain valid future goals but are not the active implementation target.

### Post-M3 hardening / playtest baseline — partly implemented
Delivered in the current session:
- server-authored timing fields on world/plot payloads:
  - `server_time_ms` on `world_state`
  - `server_time_ms` on `plot_update`
  - `server_time_ms` on `world_patch`
  - `server_time_ms` on `server_pong`
- client wire adapters now preserve snapshot timing metadata:
  - `_snapshot_server_time_ms`
  - `_received_local_ms`
- owned-plot NPC presentation now reconstructs movement progress from server snapshot timing instead of client wall-clock time
- working-state facing now rebuilds deterministically from the rubble target on plot re-entry
- NPC visuals now use a project-owned `NpcVisual` wrapper scene/script for:
  - animation player lookup
  - label-anchor resolution
  - model-space transform ownership
- server-side lightweight dev metrics now exist for:
  - `npc_simulation_ms`
  - `npc_tick_loop_ms`
  - `build_client_plot_ms`
  - `build_client_world_ms`
  - `persist_clone_world_ms`
  - `persist_flush_ms`
  - `persist_write_snapshot_ms`
- NetClient connection flow is cleaner for playtesting:
  - override URL validation
  - fresh socket reset before reconnect attempts
  - stale latency/presence reset on disconnect
  - duplicate `"error"` handling removed

Current measurement result:
- NPC simulation is still cheap under multi-plot scavenging tests
- the first real scaling pressure is JSON persistence clone/write cost, not NPC logic

---

### Early logistics foundation and current branch status
Delivered in the current repo:
- authoritative item/output foundation:
  - `server/src/core/items.ts`
  - `server/src/core/items.test.ts`
- logistics protocol/domain refactor:
  - `plot_objects`
  - `loose_items`
  - `PlotObjectStorageState`
  - `carry_slots`
  - NPC haul target metadata
- legacy migration support from:
  - `starter_objects` -> `plot_objects`
  - `clear_hits_remaining` -> `remaining_output_rolls`
- rubble now yields one real item per completed work round
- loose items now exist as authoritative plot state with tile-based merge behavior
- starter Dump Zone now exists server-side as a real plot object with:
  - abstract storage
  - finite capacity
  - full-state retry block
  - starter-generation placement directly connected to the main starter clear area
- Branch 2 hauling foundation now exists through:
  - authoritative `HAUL_LOOSE_ITEM` jobs
  - quantity reservations / re-evaluation
  - idle haul assignment for existing loose items
  - ground-only roaming/search
  - shared hauling path for successful fresh scavenger output
  - priority-aware manufacturing-input routing over dump-zone cleanup
- manual clear and manufacturing queue changes can now wake idle workers immediately
- Branch 3 manufacturing core loop now exists through:
  - starter workbench plot object
  - `server/src/core/manufacturing.ts`
  - first recipe definition for `WOODEN_PALLET`
  - workbench queue / clear flow
  - authoritative input/output buffers
  - Scrap Wood hauling into manufacturing input
  - queue-clear release of buffered inputs back to loose items
  - ready-station detection and reservation
  - active craft start with locked input consumption
  - 10-second authoritative craft timer
  - real `WOODEN_PALLET` output generation into the output buffer
  - hauling finished pallet output through the shared logistics system
- Dump Zone is rendered in the client
- loose-item ground stacks are rendered in the client
- carry visuals are item-aware instead of generic on/off markers
- shared item visual pipeline now exists through:
  - `ItemVisualCatalog.gd`
  - `ItemVisualRegistry.gd`
  - `ItemVisualNode.gd`
  - wrapper item scenes
- first station-buffer visual foundation now exists through:
  - `ManufacturingStationVisual.gd`
  - `ManufacturingStationVisualCatalog.gd`
  - workbench wrapper scene using the authored workbench model
  - workbench input/output buffer visuals
  - authored NPC work anchor resolved in actor-local presentation space
- the NPC Character Sheet now shows carrying + drop-off state
- the Plot Debug Overlay now shows dump-zone, loose-item, carried-item, haul-target, haul-job, and reservation summaries
- session / payload hardening now exists for real playtests:
  - invalid stored credentials are rejected instead of silently creating a new player id
  - websocket close/timeout diagnostics exist on client and server
  - larger Godot websocket buffers prevent the current oversized plot snapshots from immediately disconnecting the client
  - terminal job history is pruned and filtered from client payloads

Still not implemented:
- Dump Zone extraction / stockpile extraction into manufacturing
- Construction sites / Basic Stockpile construction
- Sorting Station gameplay
- full mid-segment haul reprioritization while already walking
- UI/UX polish branch work

Important current next step:
- continue with **Branch 4 — Construction foundation**
- then **Branch 5 — Sorting Station**
- do the dedicated **UI/UX polish branch** later without redefining the gameplay foundations already in place

---

## 3) Repository structure (actual repo conventions / active areas)

```text
cozy-chaos-city/
  CHANGELOG.md
  README.md
  docs/
    Assistant_Wrapup.txt
    CozyChaosCity_Branch_Design_Questionnaire.md
    CozyChaosCity_Logistics_Technical_Implementation_Roadmap.md
    GPT_Assistant_Rules.md
    Logistics-Storage-Sorting-Implementation-Plan.md
    NEXT_GPT_HANDOVER_2026-03-26.md
    TECHNICAL_SUMMARY_FOR_GPT_ASSISTANT.md
    milestones.md

  server/
    package.json
    package-lock.json
    tsconfig.json
    data/
      world_state.json
    src/
      index.ts
      core/
        client_view.ts
        config.ts
        dev_metrics.ts
        hauling.ts
        items.ts
        manufacturing.ts
        npc.ts
        players.ts
        presence.ts
        world.ts
        *.test.ts
      net/
        protocol.ts
      storage/
        persist.ts

  client/
    project.godot
    main.tscn
    hud.tscn
    scenes/
      actors/
        NpcVisual.tscn
        OwnedPlotNpcActor3D.tscn
      items/
      local_objects/
        DumpZone8x8.tscn
        LooseItemStack.tscn
        Rubble4x4.tscn
        StarterShack.tscn
      stations/
        WorkbenchStation.tscn
        workbench.tscn
      ui/
        BottomActionBar.tscn
        NpcCharacterSheet.tscn
        NpcOverheadLabel.tscn
        OrdersMenuPanel.tscn
      world/
        GameWorld3D.tscn
        PlotTile3D.tscn
    scripts/
      net/
        NetClient.gd
        ProfileStore.gd
        WireAdapters.gd
      ui/
        BottomActionBar.gd
        HUD.gd
        NpcCharacterSheet.gd
        NpcOverheadLabelsLayer.gd
        OrdersMenuPanel.gd
        PlotDebugOverlay.gd
        PlotInfoPanel.gd
        orders/
          PlotOrderDefinitions.gd
          PlotOrderMenuEntry.gd
      world/
        CameraRigBasic.gd
        GameWorld3D.gd
        ItemPresentation.gd
        LocalPlotInteractor.gd
        OwnedPlotDetailRenderer3D.gd
        PlotRenderer3D.gd
        PlotTile3D.gd
        TilePicker3D.gd
        actors/
          NpcVisual.gd
          OwnedPlotNpcActor3D.gd
        item_visuals/
          ItemVisualCatalog.gd
          ItemVisualNode.gd
          ItemVisualRegistry.gd
        local_objects/
          DumpZone8x8.gd
          LooseItemStack.gd
          ManufacturingStationVisual.gd
          ManufacturingStationVisualCatalog.gd
          Rubble4x4.gd
```

## 4) Current server architecture

### `server/src/core/config.ts`
Defines:
- port
- protocol version
- expansion threshold
- persistence path under `server/data/`
- keepalive / timeout settings
- save debounce timing
- dev-metrics enable/report window flags

### `server/src/net/protocol.ts`
Defines the main protocol/world/domain types and runtime message schemas.

Important current concepts:
- `PlotType = "PLAYER" | "RESOURCE"`
- `Plot`
  - `id`
  - `type`
  - `x`
  - `y`
  - `claimed_by`
  - optional `shell`
  - optional `detail`
- `WorldState`
  - `version`
  - `plots`
  - `players`

Important current local detail concepts:
- `PlotDetail`
- `PlotDetailCell`
- `starter_objects`
  - `SHACK`
  - `RUBBLE_4X4`
- `npcs`
- `jobs`
- `active_order`

Important architectural note:
- do not leak raw `WorldState` to clients
- client-safe payloads are built explicitly now
- keep DTO/wire shape changes synchronized on both server and client
- current movement presentation timing now depends on explicit timed payload contracts, not implicit client wall clock assumptions

### `server/src/core/client_view.ts`
Owns client-facing world shaping.

Important responsibilities:
- build client-safe world payloads
- encode owner-only detail for the owning player only
- prevent player secret leakage into client world snapshots
- emit lightweight dev metrics for world/plot DTO build cost during profiling runs

This file exists because raw server state and client-visible state must stay separate.

### `server/src/core/world.ts`
Owns most world/data-side gameplay helpers.

Important current responsibilities:
- deterministic plot typing
- world creation / expansion
- default shell creation
- starter claimed-plot detail creation
- claim-time plot initialization
- local cell helpers
- object-based clear logic
- clear-hit migration safety for older saves
- initialization of owned-plot `npcs` / `jobs` data

Implemented reality:
- starter owned plot detail size is `40`
- local cell grid remains the hidden logic layer
- rubble is represented as real placed objects
- final rubble clear removes the object and frees its footprint

### `server/src/core/npc.ts`
Owns the first local NPC/job/order loop.

Important current responsibilities:
- create scavenging jobs when the player issues a scavenging-family order
- support both `Scavenge All` and `Scavenge One`
- reject conflicting scavenging orders while active work already exists
- cancel the active plot order server-authoritatively
- remove active-order jobs cleanly on cancel so deterministic job ids remain safe
- assign jobs to eligible NPCs
- choose the nearest valid queued rubble target
- advance NPCs through the first bounded state loop
- keep `active_order` synchronized with active jobs

Important architectural note:
- this file is the first real foundation, not the final full economy/task system
- future orders should extend the job-based direction, not bypass it with ad hoc special cases

### `server/src/storage/persist.ts`
Owns persistence via a debounced JSON repository.

Important responsibilities:
- load world snapshot
- queue debounced saves
- write atomically through temp-file rename
- keep persistence behind an abstraction instead of direct save calls everywhere
- emit lightweight dev metrics for clone/flush/write timing

Important current reality:
- profiling now shows JSON persistence clone/write cost is the first real scaling pressure under multi-plot scavenging tests
- JSON save remains acceptable for the current stage, but it is the first subsystem to revisit when scale grows

### `server/src/index.ts`
Currently handles:
- WebSocket server setup
- hello/welcome/auth flow
- world state sending
- plot claim handling
- clear-object request handling
- order request handling
- broadcasting updates
- presence / disconnect / ping management
- invoking the NPC tick loop

Important architectural note:
- `index.ts` still does a lot
- future work should keep moving toward cleaner transport vs domain separation rather than putting every new system directly here

---

## 5) Current client architecture

### Main world controller
`client/scripts/world/GameWorld3D.gd`

Important current responsibilities:
- world-map mode flow
- owned-plot enter/exit flow
- world camera save/restore
- local camera activation/deactivation
- world/local render coordination
- transition integration

### Local detail renderer
`client/scripts/world/OwnedPlotDetailRenderer3D.gd`

Important current responsibilities:
- render the owned plot local presentation
- create the ground surface
- render local objects
- render local NPC actors
- keep static objects and NPC actors tracked separately
- keep local refresh incremental where possible
- manage movement tween presentation carefully

Important architectural note:
- this script was recently hardened against freed-node reuse and over-aggressive movement tween resets
- NPC movement presentation now reconstructs progress from `server_time_ms` snapshot metadata plus local monotonic receive time instead of using client wall clock time
- future work should keep presentation state separate from authoritative gameplay state

### Local interaction relay
`client/scripts/world/LocalPlotInteractor.gd`

Current responsibilities:
- local object selection/interaction routing
- rubble interaction flow
- prevents local interaction from incorrectly reopening world-side plot inspection

### Camera
`client/scripts/world/CameraRigBasic.gd`

Current responsibilities:
- world camera movement
- local mode free-move parity
- bounded local camera behavior
- drag-threshold improvements for RMB rotation handling

### Networking
`client/scripts/net/NetClient.gd`
`client/scripts/net/WireAdapters.gd`

Current responsibilities:
- socket communication
- login/reconnect flow
- protocol message handling
- owned-plot detail decoding/adaptation
- client-side callbacks/signals for world/local updates
- clear request sending
- issue-order request sending
- cancel-order request sending
- preserving snapshot timing metadata for NPC presentation
- validating / resolving endpoint override flow for playtesting

Important current detail:
- compact owner-only local detail is adapted on the client
- client adapters now preserve snapshot timing metadata so NPC movement presentation can be reconstructed from server-authored timing
- `NetClient.gd` now validates override URLs, resets stale socket/runtime state on reconnect attempts, and clears stale latency/presence on disconnect
- any protocol changes for NPC/local data must be kept synchronized with server changes

### UI
`client/scripts/ui/HUD.gd`
`client/scripts/ui/BottomActionBar.gd`
`client/scripts/ui/OrdersMenuPanel.gd`
`client/scripts/ui/PlotDebugOverlay.gd`
`client/scripts/ui/orders/PlotOrderDefinitions.gd`
`client/scripts/ui/PlotInfoPanel.gd`

Current responsibilities include:
- login/menu flow
- plot popup flow
- owned-plot enter/leave flow hooks
- rubble action popup flow
- bottom-bar Orders flow coordination
- active-order cancel request flow
- status/feedback UI
- developer-only debug overlay toggle/refresh

Important note:
- HUD is still a flow coordinator and should not become the owner of raw order definitions
- order menu content now comes from dedicated order-definition data
- `OrdersMenuPanel` stays presentation-only
- `PlotDebugOverlay` is temporary development tooling, not a final player-facing feature

---

## 6) Current implemented gameplay facts

These are true in the project direction now:

- the world is server-authoritative
- plots use deterministic coordinate-based IDs
- players can claim free `PLAYER` plots
- claimed player plots are initialized with shell + local detail
- local detail is owner-only
- local detail is compacted on the wire
- the player can enter their owned plot
- the player can leave back to the shared world
- rubble is represented as real local objects
- rubble clearing is object-id based
- rubble clearing is multi-step
- the final clear removes rubble and frees blocked cells
- cleared rubble animates out on the client
- local camera parity is implemented
- local visual polish exists
- there is now a real local NPC actor path
- there is now a real bounded server NPC simulation loop
- the player can issue `Scavenge All` and `Scavenge One` from the Orders menu
- the active plot order can be cancelled cleanly
- the NPC selects nearby rubble jobs and performs the work loop
- duplicate conflicting scavenging orders are rejected
- existing loose items can generate shared haul jobs and be delivered automatically
- idle NPCs can roam to find haul work on clear ground
- the player can queue and clear Wooden Pallet work on the starter workbench
- Scrap Wood can be hauled into the workbench input buffer
- the developer can inspect live plot job/NPC state with F3
- NPC movement presentation now uses server-authored snapshot timing instead of local wall-clock time
- NPC visuals now route through the project-owned `NpcVisual` wrapper scene
- lightweight server dev metrics now exist for tick/build/save timing during playtests

---

## 7) What is still temporary / limited

Still temporary or incomplete:
- Dump Zone extraction into manufacturing or stockpiles is not implemented yet
- local NPC visuals/animation are still early and a dedicated UI/UX polish branch is planned later
- the debug overlay is a temporary development tool
- there is still only the first small manufacturing domain (one station, one recipe)
- no broader economy/business/logistics systems exist yet
- neighborhood rendering is not implemented
- local mode still renders only the owned plot
- interior/private room systems are not implemented
- `server/src/index.ts` still carries too many responsibilities
- profile filename sanitization is still deferred
- archives are still noisy unless `.git`, `node_modules`, `.godot`, and temp files are excluded manually

---

## 8) Current architecture cautions

Important current architectural truths:
- gameplay progression remains server-authoritative
- client payloads now intentionally filter terminal job history instead of mirroring raw authoritative history forever
- manufacturing buffer visuals are presentation-only mirrors of authoritative buffer counts
- the authored workbench scene is still the visible workbench model; the wrapper scene/script adds station-local anchors and snapshot presentation
- session/auth handling now rejects bad stored credentials instead of silently swapping player identity
- websocket payload size still needs monitoring even though the immediate 1009 disconnect was mitigated with larger client buffers

## 9) Reference docs

Useful current docs:
- `docs/GPT_Assistant_Rules.md`
- `CHANGELOG.md`
- `docs/milestones.md`
- `docs/CozyChaosCity_Logistics_Technical_Implementation_Roadmap.md`
- `docs/Logistics-Storage-Sorting-Implementation-Plan.md`
- `docs/CozyChaosCity_Branch_Design_Questionnaire.md`

## 10) Current next slice

The next practical slice is still inside **Branch 3**:
- detect when a queued pallet recipe has enough Scrap Wood buffered
- start one authoritative active craft on the workbench
- lock/consume the required Scrap Wood from the input buffer
- complete the 10-second craft
- write real `WOODEN_PALLET` output into the output buffer
- create haul work for finished pallets
