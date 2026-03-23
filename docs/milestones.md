# Milestones

This document tracks the current milestone plan for Cozy Chaos City and clarifies the intended direction of the project as it evolves from a multiplayer prototype into a shared-world city-building/simulation game.

The roadmap is meant to preserve the long-term vision while keeping implementation modular and milestone-driven.

---

## Core Direction

Cozy Chaos City is a **shared-world multiplayer city-building and social simulation game**.

The project is not aiming for isolated player instances or purely abstract city markers. The world should feel continuous, social, and readable from both a macro and local scale.

This means the game should support:

- a **shared world map**
- visible neighboring player cities
- resource zones and streets as public/shared spaces
- richer local detail when focusing on your own city
- privacy where it makes sense, such as interiors
- public visibility where it makes sense, such as exteriors and outside NPCs

The long-term rendering and simulation model should distinguish between:

- **Shell data**  
  High-level city/plot exterior shape visible at long range

- **Exterior public detail**  
  Publicly visible outside structures and objects

- **Interior/private detail**  
  Private interior rooms, furniture, and inside-only actors

- **Public actor visibility**  
  NPCs or actors physically outside and therefore potentially visible to nearby players

- **Private actor visibility**  
  NPCs or actors inside buildings/interiors and not visible to outsiders

This distinction is important and should guide future architecture, rendering, networking, and gameplay.

---

## Completed Milestones

### M0 - Multiplayer Foundation

**Goal**  
Create the first playable networked prototype with a dedicated authoritative server.

**Completed**
- Node.js/TypeScript WebSocket server
- Godot client connection flow
- authoritative world state
- plot claiming
- persistent storage
- reconnect support using server-issued identity/profile data
- basic multiplayer synchronization

**Result**  
The project established a working client/server base and a shared persistent world.

---

### M0.5 - Coordinate World and Expansion Rules

**Goal**  
Move from a rough prototype into a deterministic coordinate-based world model.

**Completed**
- stable coordinate-based plot IDs
- deterministic plot typing rules
- 3x3 starter world
- 3x3 module expansion
- world update broadcasting
- presence snapshots
- latency support
- clearer separation between world data and client rendering

**Result**  
The world became more scalable and predictable, making it suitable for the next rendering milestone.

---

### M1 - 3D Shared World Rendering

**Goal**  
Render the server world in 3D in Godot and support direct plot interaction.

**Completed**
- dedicated 3D world scene
- server-driven tile spawning and updates
- modular 3D plot/tile rendering
- hover and selection in 3D
- click-to-inspect plot flow
- claim flow from in-game popup
- main menu/login overlay
- world disabled until login
- in-game quit/menu controls
- live updates reflected in the 3D world

**Result**  
The project is now a working multiplayer 3D prototype with login, inspection, claiming, persistence, and shared world rendering.

---

### M2 - Multi-Scale Shared World Foundation

**Goal**  
Establish the first real owned-plot gameplay foundation on top of the shared world.

**Completed**
- shell data on plots
- owned-plot detail data on claimed player plots
- first Player Plot mode
- enter/exit flow between World Map mode and Player Plot mode
- local owned-plot rendering
- compact owner-only detail payloads (`cell_rows`)
- player-plot camera parity using the existing camera rig
- real rubble interaction:
  - right click rubble
  - release without meaningful drag opens a cursor popup
  - `Clear` action from the popup
  - clear by object id
  - authoritative server update
  - animated removal on client
- multi-step rubble clearing:
  - rubble stores `clear_hits_remaining`
  - each clear action reduces the remaining count
  - final clear removes rubble and frees its footprint
- local visual polish:
  - animated rubble removal
  - smoke effect on final rubble removal
  - randomized rubble rotation/offset
  - randomized multi-texture ground shader
  - procedural sky / world environment
- local input/camera polish:
  - Player Plot rubble interaction no longer reopens the world-side plot panel
  - popup/menu flow no longer leaves the camera stuck rotating
  - camera rotation now begins only after a small RMB drag threshold

**Result**
M2 delivered the first real owned-plot gameplay foundation.
The player can now:
- connect/login
- claim a plot
- enter their owned plot
- move around locally with the normal camera feel
- interact with rubble
- clear rubble through the authoritative server path
- return back to the shared world

**Deferred**
Neighborhood rendering is still part of the long-term shared-world vision, but it is not the current next priority.

**Still temporary / limited**
- local mode currently renders only the owned plot
- neighborhood loading/rendering is not implemented yet
- broader local gameplay beyond rubble clearing is still early

---

## Current Milestone Direction

## Milestone 3 — Owned Plot NPCs, Identity, Orders, and Debug Foundation

### Status
M3 foundation is now complete enough for the current project flow.
A first post-M3 hardening/playtest pass is now also implemented on top of that foundation.

### Purpose
Establish the first **complete NPC gameplay foundation** for owned plots, not just a hidden technical work loop.

### M3 now includes
- server-authoritative NPC simulation
- NPC identity data
- persistent random names
- role/job specialization
- player-readable current activity
- overhead labels
- click-to-inspect Character Sheet
- role-based order eligibility
- first expandable order menu foundation

### M3 deliverables

#### 1. NPC simulation foundation
- job-based work loop remains authoritative on the server
- NPCs only act on valid jobs/orders
- role eligibility is enforced server-side

#### 2. NPC identity foundation
- each NPC has a persistent name
- each NPC has a role/job type
- each NPC supports future traits/stats expansion

#### 3. NPC readability
- current activity is visible to the player
- overhead labels show at least:
  - name
  - current activity
- Character Sheet shows:
  - name
  - role
  - current activity
  - current state
  - current assignment summary
  - placeholder areas for future traits/stats

#### 4. Role specialization
- at least one scavenger role
- at least one non-scavenger role for testing
- scavenging orders only use eligible NPCs

#### 5. Order system expansion base
- the old one-off Scavenge button flow has been replaced with a dedicated bottom-bar Orders menu
- order menu entries are now built from dedicated order-definition data instead of being hardcoded directly inside the HUD flow
- the current real order actions are:
  - `Scavenge All`
  - `Scavenge One`
- active-order cancellation now exists through a dedicated inline cancel control beside the active-order label
- future order types can be added without redoing the whole UI structure

#### 6. Stability rules
- no inferred local GDScript variables in new gameplay/UI code
- no one-off hardcoded role checks scattered across the codebase
- no duplicated activity string logic in multiple places
- cancelled orders now remove active jobs instead of keeping duplicate reusable job ids alive in plot state
- a lightweight developer-only plot debug overlay exists for validating live job/NPC state while the system grows

### Exit criteria
M3 is complete when the player can:
- identify an NPC by name
- see that NPC’s role/job type
- understand what the NPC is currently doing
- inspect them via Character Sheet
- verify that only eligible NPCs respond to scavenging orders
- use the Orders menu instead of a one-off button
- cancel the currently active plot order cleanly
- inspect live plot job/NPC state through the debug overlay when needed

### Current result
The repo now meets the M3 foundation goal:
- NPC simulation, names, readable activity, Character Sheet, and overhead labels are in place
- role-based eligibility is in place
- modular Orders UI foundation is in place
- `Scavenge One` and `Scavenge All` both exist as real server-authoritative orders
- active-order cancellation is implemented server-side and exposed cleanly in the UI
- a lightweight F3 debug overlay exists for live job/NPC validation
- NPC movement presentation now uses server-authored snapshot timing instead of client wall-clock time
- NPC visuals now route through the project-owned `NpcVisual` wrapper scene instead of depending directly on raw imported model structure
- lightweight server dev metrics now exist for tick cost, client payload building, and JSON persistence timing
- NetClient connection handling is more reliable for friend playtesting through cleaner override validation and socket reset flow

### Next recommended direction after M3

The project has now already started the first real **early logistics foundation** on top of the M3 NPC/order base.

### What is already true in the repo
- owned-plot logistics now has authoritative item ids
- owned-plot state now uses `plot_objects` instead of `starter_objects`
- owned-plot state now supports:
  - loose ground items
  - NPC carry slots
  - storage state on plot objects
- rubble now produces one real item per completed work round
- starter rubble now uses `remaining_output_rolls`
- a starter Dump Zone now exists server-side as a real plot object with:
  - abstract storage
  - finite capacity
  - 1-minute retry block when full
- scavengers now:
  - receive a real item into their hands first
  - direct-haul to the Dump Zone when it is valid and within range
  - otherwise fall back to a ground drop

### Immediate next priority
The immediate next milestone slice is **Branch 1D** of the logistics roadmap:

- render the Dump Zone in the owned plot
- render loose ground items
- expose enough player-facing/debug readability to verify:
  - carried item flow
  - direct-haul into Dump Zone
  - fallback to ground when Dump Zone is full

### What should come after that
After Branch 1D is readable and stable in the client, the next real gameplay phase should be:

- **Phase 2 — Basic Stockpile and Physical Construction Delivery**
- then **Phase 3 — Sorting Station and Mixed Salvage processing**

### Important direction
Do not steer the project back toward “more M3 features first” as the default path.

The correct current direction is:

1. finish Branch 1D client verification for the logistics foundation
2. then continue into stockpiles / construction delivery
3. then sorting / Mixed Salvage processing

---

## Long-Term Direction Reminder

Still valid future goals:
- neighborhood/public local rendering
- outside/public actor visibility
- interior/private spaces
- deeper local production/business chains
- logistics/supply behavior
- richer role/skill systems
- nearby city/public-space readability

But those should build on the stable NPC/order/data foundations now in place, not replace them with a new rushed milestone slice.
