# TECHNICAL_SUMMARY_FOR_GPT_ASSISTANT

**Project:** CozyChaosCityBuilder (Cozy Chaos City)  
**Stack:** Godot 4 client + Node.js/TypeScript WebSocket server  
**Last updated:** 2026-03-19  
**Current milestone direction:** **M3 foundation complete; next step should be targeted order selection**  
**Current state:** M1 is complete. M2 delivered the first owned-plot gameplay foundation. M3 now includes the real NPC/order foundation, modular Orders UI, active-order cancellation, and a lightweight developer debug overlay.

This document is the handoff reference for any future GPT assistant.

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
- local NPC moves through the work loop and returns toward the shack dropoff
- can cancel the active plot order cleanly
- can toggle the F3 debug overlay to inspect live job/NPC state
- player leaves back to the shared world

Important current direction:
- the project already has a working first owned-plot mode
- neighborhood loading/rendering is **not** the active next priority
- the project is now continuing from the **M3 NPC/order foundation**
- future work should keep extending stable systems instead of adding rushed feature slices

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

---

## 3) Repository structure (actual repo conventions / active areas)

```text
cozy-chaos-city/
  CHANGELOG.md
  README.md
  docs/
    Assistant_Wrapup.txt
    GPT_Assistant_Rules.md
    Handover_prompt.txt
    M3_Implementation_Plan.md
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
      ui/
        BottomActionBar.tscn
        NpcCharacterSheet.tscn
        NpcOverheadLabel.tscn
        OrdersMenuPanel.tscn
      local_objects/
        Rubble4x4.tscn
        RubbleClearSmoke.tscn
        StarterShack.tscn
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
        LocalPlotInteractor.gd
        OwnedPlotDetailRenderer3D.gd
        PlotRenderer3D.gd
        PlotTile3D.gd
        TilePicker3D.gd
        local_objects/
          Rubble4x4.gd
    shaders/
      plot_ground_random_5.gdshader
    assets/
      NPC/
      Shed.glb
      Rubble_A.glb
      ground_textures/
      particles/
```

Notes:
- Ignore `.godot/` and `.tmp` files for logic work
- `client/PlotView.gd` is legacy and not part of the active world flow
- The active world flow is the Godot 3D path under `client/scenes/world/` and `client/scripts/world/`

---

## 4) Current server architecture

### `server/src/core/config.ts`
Defines:
- port
- protocol version
- expansion threshold
- persistence path under `server/data/`
- keepalive / timeout settings
- save debounce timing

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

### `server/src/core/client_view.ts`
Owns client-facing world shaping.

Important responsibilities:
- build client-safe world payloads
- encode owner-only detail for the owning player only
- prevent player secret leakage into client world snapshots

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

Important current detail:
- compact owner-only local detail is adapted on the client
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
- the developer can inspect live plot job/NPC state with F3

---

## 7) What is still temporary / limited

Still temporary or incomplete:
- local NPC visuals/animation are still early
- `Scavenge All` is still a temporary convenience action until targeted/area selection replaces it
- the debug overlay is a temporary development tool
- there is still only the first simple scavenging-family order domain
- no broader economy/business/logistics systems exist yet
- neighborhood rendering is not implemented
- local mode still renders only the owned plot
- interior/private room systems are not implemented
- `server/src/index.ts` still carries too many responsibilities

---

## 8)Updated M3 Direction

M3 is no longer only about “basic NPC scavenging.”
Any new NPC/order feature added after this point should extend the stable foundation instead of reintroducing one-off UI or job hacks.

M3 now covers the first complete NPC gameplay foundation for owned plots:
- server-authoritative NPC jobs
- identity fields
- readable current activity
- role/job specialization
- Character Sheet
- overhead labels
- role-based order eligibility
- expandable order UI foundation
- server-authoritative active-order cancellation
- temporary live debug overlay for system validation

### Critical implementation rules

#### 1. Stability before content
Do not add new NPC/order content in a way that forces immediate refactor afterward.

#### 2. One authoritative NPC model
NPC-facing data should come from one coherent model, not spread across unrelated structures.

#### 3. Separate internal state from player-facing activity
Keep:
- `state` for simulation
- `current_activity` for UI/player readability

#### 4. Centralize role eligibility
Do not scatter role checks across multiple files. Use centralized helpers/services.

#### 5. Character Sheet must be future-ready
Even if fields are initially sparse, the structure must support future expansion.

#### 6. No inferred local variable declarations in GDScript
Do not use `:=` for local runtime/gameplay/UI variables in Godot scripts.
Use explicit local types instead.

Example:
```gdscript
var npc_id: String = ...
var result: Dictionary = ...
var tween: Tween = ...
var duration_sec: float = ...
```

---

## 9) Recommended implementation principles for future GPT assistants

Follow `docs/GPT_Assistant_Rules.md` strictly.

Especially:
- never guess file contents
- always read the actual repo first
- give exact file paths and exact insertion/replacement anchors
- keep code modular
- never use inferred local variable types in GDScript
- keep public/client DTOs separate from raw server state
- provide:
  - what changes
  - why
  - where
  - how to test

Additional project-specific guidance:
- prefer static UI setup in Godot editor for persistent UI
- keep protocol changes synchronized on both server and client
- keep server quality gates passing after important architecture changes
- build small real foundations, not milestone-only hacks
- do not write as if neighborhood rendering is still the immediate next step

---

## 10) Handoff warning for the next assistant

Do **not** assume the next task is to continue M2 neighborhood rendering.

That was the old direction.

The updated direction is:
- M2 foundation is complete enough for now
- neighborhood is deferred
- M3 foundation is complete enough for the current project flow
- the next work should continue from this stable architecture by adding targeted order-selection flow instead of more one-off menu actions
