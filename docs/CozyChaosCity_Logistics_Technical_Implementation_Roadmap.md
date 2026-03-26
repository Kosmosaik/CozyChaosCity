# Cozy Chaos City — Logistics / Storage / Sorting Technical Implementation Roadmap

_Last updated: 2026-03-24_

## Purpose

This document converts the current logistics design decisions into a practical technical roadmap for implementation.

It is based on:
- the current repo state and M3 foundation
- `docs/Logistics-Storage-Sorting-Implementation-Plan.md`
- the follow-up clarifications given after that plan
- the project architecture rules in `docs/GPT_Assistant_Rules.md`

This is not a replacement for the design plan. It is the **technical execution roadmap** that defines what should be built first, what each branch is responsible for, and what must remain deferred.

## Current implementation status after the 2026-03-24 session

### Completed branches
- **Branch 0A — Authoritative Item / Output Definitions**
  - Stable item ids now exist for:
    - `SCRAP_WOOD`
    - `SCRAP_METAL`
    - `TARP`
    - `MIXED_SALVAGE`
    - `WOODEN_PALLET`
  - Authoritative starter-rubble output rules now live in `server/src/core/items.ts`
  - Dedicated server tests exist for the item/output foundation

- **Branch 0B — Domain / Protocol Refactor for Logistics State**
  - `starter_objects` has been replaced by `plot_objects`
  - protocol/domain state now includes:
    - `PlotObject`
    - `PlotLooseItem`
    - `PlotObjectStorageState`
    - `carry_slots`
    - haul-target metadata on NPCs
  - legacy migration paths exist for older owned-plot saves

- **Branch 1A — Rubble Yield State and Loose Item Spawning**
  - rubble now uses `remaining_output_rolls`
  - each completed work round yields one real item
  - loose items exist as authoritative plot state
  - tile-based merge behavior is implemented:
    - same item + same tile = merge
    - different item + same tile = choose another tile

- **Branch 1B — NPC Carry
  - scavengers now carry a real item in `carry_slots`
  - direct-haul decision is server-authoritative for newly scavenged output
  - current routing is:
    - nearby valid Dump Zone within 8 tiles
    - otherwise ground fallback

- **Branch 1C — Dump Zone Object and Intake Logic**
  - starting Dump Zone now exists as a real plot object
  - Dump Zone now has authoritative abstract storage state
  - capacity is enforced
  - full-state handling now blocks retry for 1 minute and safely falls back to loose ground items

- **Branch 1D — Client Representation and Verification for Branch 1**
  - Dump Zone is rendered in the owned plot
  - loose ground items are rendered in the owned plot
  - carried-item visuals now reflect real item identity
  - NPC Character Sheet now shows carrying and drop-off state
  - Plot Debug Overlay now shows dump-zone, loose-item, carried-item, and haul-target summaries
  - Plot Debug Overlay is now scrollable and blocks camera wheel zoom while hovered

- **Branch 1E — Shared Item Visual Asset Pipeline**
  - shared item visual catalog/registry/node foundation now exists
  - carry and loose-item visuals now resolve through one shared path
  - missing assets fall back to placeholder visuals cleanly
  - quantity-specific loose-ground scene variants are supported through central catalog mapping
  - first wrapper scenes are wired for:
    - `SCRAP_WOOD`
    - `SCRAP_METAL`
    - `MIXED_SALVAGE`



### Current next branch
- **Branch 2 — Hauling Foundation**
  - add a real server-authoritative hauling job layer
  - treat hauling as an automatic background task that all NPCs can do in early game
  - Change the current Scavenger behavior to do hauling instead of direct-haul

### Important current limitations
- Current direct-haul still covers newly scavenged output only. (we will change that in Branch 2)
- General hauling jobs for existing loose items, Dump Zone extraction, manufacturing output, and construction delivery do not exist yet.
- Reservation rules are not yet implemented for item hauling.
- Workbench manufacturing does not exist yet.
- Construction sites and Basic Stockpile construction do not exist yet.
- Sorting Station gameplay does not exist yet.

---

## 1. Locked Inputs for This Roadmap

The following decisions are treated as locked for this implementation sequence.

### 1.1 Items currently in scope
- Scrap Wood
- Scrap Metal
- Tarp
- Mixed Salvage
- Wooden Pallet (as a construction/manufacturing input for the next phase)

### 1.2 Resource rules
- Only one resource node type in this phase (Rubble)
- Each rubble object yields a total of **3–8 outputs**
- Output is produced **one item at a time per work round**
- Result split is **50% clean resource / 50% Mixed Salvage**
- Clean output can be Scrap Wood, Scrap Metal, or Tarp
- Rubble is removed using the current completion/removal behavior when exhausted

### 1.3 Carry rules
- Medium items are carried **1 item on 2 hands / with both hands**
- NPCs can carry a maximum of **1 medium item**
- Mixed Salvage is Medium and is **not stackable while carried**
- Large-item logistics are not part of the first playable branch, but the data model must not block them

### 1.4 Dump Zone rules
- Starting Dump Zone exists near the shack from the beginning
- Target size is **8x8 tiles / 8x8 meters**
- Dump Zone accepts all items in this phase
- Deposited items become **abstracted inventory immediately**
- Capacity remains authoritative and finite
- If full, the system must surface a blocked state and fall back safely

### 1.5 Loose ground item rules
- Loose items are real world-state objects
- Merge rule is **tile-based**, not radius-based
- Same item on the same tile merges
- Different item types cannot share one tile
- If the preferred tile is occupied by a different item, choose another valid free tile
- Ground items persist for now unless explicitly hauled later

### 1.6 Routing rules
- Direct haul is allowed when a valid destination is within **8 tiles**
- Clean resource routing priority:
  1. matching stockpile
  2. Dump Zone
  3. ground
- If no valid nearby destination exists, the item drops near the source node

### 1.7 Stockpile rules
- Basic Stockpile is a later branch, not branch 1
- One Basic Stockpile = 4 pallet slots
- One slot = one resource type
- One slot = 20 medium items
- No hauling into stockpile until at least one filter is configured

### 1.8 Sorting rules
- Sorting Station is a later branch, not branch 1
- Mixed Salvage must always be sorted to become clean resources
- Sorting consumes worker time only in this phase

---

## 2. Architecture Principles for This Implementation

These principles are mandatory for the roadmap.

### 2.1 Build a small real foundation first
Do not patch the current scavenging loop with more generic strings like `SCRAP` or more one-off branches in NPC code.

Before the first playable logistics loop is complete, the project should have:
- real item ids
- real storage/object state boundaries
- real loose item state
- real carry state
- explicit routing helpers

### 2.2 Keep transport, domain state, and rendering separate
Do not mix:
- server domain objects
- wire DTOs
- persistence shape
- Godot presentation state

Protocol changes must be intentional and mirrored across server and client.

### 2.3 Avoid god-file growth
The current M3 base already has important logic concentrated in a few places. Logistics should be introduced through focused modules, not by dumping all new behavior into one existing simulation file.

### 2.4 Prefer definitions + instances
The system should move toward:
- object definitions
- item definitions
- loot/output tables
- recipe/process definitions
- object instance state

This keeps the game extensible for more nodes, more storage types, more buildings, and more orders.

---

## 3. Recommended Data Model Direction

This section defines the intended technical direction before the branch breakdown.

### 3.1 Item definitions
Add authoritative item definitions for gameplay/logistics properties only.

Each item should support at minimum:
- `id`
- `name`
- `category`
- `tags`
- `carry_class`
- `hand_slots_required`
- `max_stack_carried`
- `max_stack_storage`
- `dump_zone_capacity_cost`
- `allowed_storage_tags`
- routing flags where useful

### 3.2 Plot objects
Current starter-object language should evolve into a more general plot-object model.

Plot objects should be able to represent:
- shack
- rubble
- dump zone
- stockpile
- sorting station
- construction site

The model should support object definition + instance state rather than hardcoding one-off behavior per object id.

### 3.3 Loose items
Loose items should be first-class plot state, not hidden inside generic object metadata.

Each loose item should support at minimum:
- unique id
- item id
- quantity
- tile/world position
- reservation state
- created timestamp

### 3.4 Storage state
Storage must support multiple later storage styles without redesign.

The first two storage modes needed are:
- **Abstract storage**: Dump Zone
- **Slotted storage**: Basic Stockpile

### 3.5 - Removed

### 3.6 Resource node output state
Rubble should no longer only track clear hits. It should track remaining outputs or equivalent node-yield state.

### 3.7 Recipes / processes
Use one recipe/process foundation that can later support:
- manufactured outputs
- sorting outputs
- future workstation processing

---

## 4. Phase and Branch Order

The implementation should be split into **five phases** with clear branch boundaries.

---

# Phase 0 — Foundation Refactor for Logistics

## Goal
Introduce the real logistics data foundation before changing the full gameplay loop.

This phase is intentionally not flashy. Its purpose is to prevent branch 1 from becoming a temporary hack.

## Branch 0A — Authoritative Item / Output Definitions

### Scope
- Add real item ids for current logistics items
- Add authoritative item definition module
- Add starter rubble output rules in a dedicated module
- Add tests for item ids and rubble output generation

### Why it comes first
All later protocol, storage, haul, and recipe changes depend on stable item ids.

### Exit criteria
- Server has stable item definitions for current scope
- Starter rubble output rules live outside NPC logic
- `typecheck`, `lint`, and tests pass for the new foundation

## Branch 0B — Domain / Protocol Refactor for Logistics State

### Scope
- Rename or generalize `starter_objects` toward `plot_objects`
- Add wire-safe types for:
  - plot objects
  - loose items
  - dump-zone inventory state
  - NPC carry slots
- Replace generic carry markers like `SCRAP` with item-based carry data
- Keep current gameplay behavior unchanged where possible during this refactor

### Why it is a separate branch
This is a state-model refactor. It should land before gameplay logic expands, so later changes are built on the right shape.

### Exit criteria
- Client and server compile against the new DTO/state shape
- No temporary dual-model path remains unless clearly isolated and short-lived
- Existing gameplay still functions after the protocol refactor

---

# Phase 1 — Playable Branch 1: Extraction, Loose Items, Dump Zone Intake

## Goal
Create the first complete output loop:
**Rubble → item output → carry / drop / direct haul → Dump Zone or ground**

This is the first truly playable logistics phase.

## Branch 1A — Rubble Yield State and Loose Item Spawning

### Scope
- Replace rubble “generic scrap clear” behavior with real item output rolls
- Track remaining outputs per rubble instance
- Produce one output item per completed work round
- Remove rubble when exhausted
- Add authoritative loose-item state and spawning helpers
- Implement tile-based loose-item merge rules

### Key rules
- same item + same tile = merge
- different item + same tile = cannot merge
- if blocked by another item type, search nearby valid tile

### Exit criteria
- Rubble produces real items one at a time
- Loose items exist as authoritative plot state
- Merge behavior matches locked tile-based rule

## Branch 1B — NPC Carry, Pickup, Reservation, and Direct-Haul Decisions
**Status:** Partially implemented. The repo already supports real carried items and direct-haul decisions for newly scavenged output, but loose-item pickup reservations and hauling existing loose items are still deferred.

### Scope
- Convert NPC carry handling to carry slots
- Add pickup reservation for loose items
- Add destination selection helpers
- Implement direct-haul decision for nearby valid destinations
- Route to Dump Zone or ground for current branch scope

### Key rules
- direct haul allowed within 8 tiles
- fallback to ground when no valid destination exists
- no two NPCs should pick the same loose item simultaneously

### Exit criteria
- NPCs can carry real items
- Reservations prevent double-pickups
- Routing is server-authoritative and deterministic

## Branch 1C — Dump Zone Object and Intake Logic
**Status:** Server-side core is implemented. Dump Zone rendering and player-facing verification are still deferred to Branch 1D.

### Scope
- Add the starting Dump Zone as a real plot object
- Add authoritative abstract storage state for the Dump Zone
- Implement capacity usage and full-state handling
- On deposit, convert carried or loose items into Dump Zone totals immediately
- Add blocked/warning state when intake fails because of capacity

### Exit criteria
- Dump Zone exists as a real object near the shack
- Deposits abstract correctly
- Capacity limits are enforced
- Overflow safely falls back to loose ground items rather than destroying items

## Branch 1D — Client Representation and Verification for Branch 1
**Status:** Implemented for current scope

### Scope
- Render Dump Zone object
- Render loose ground items
- Update NPC presentation for carried item state as needed
- Update click/inspection helpers if required for debugging/verification
- Add or update tests for the new server-side logic

### Exit criteria
- Branch 1 is playable and readable in the client
- Server/client protocol is stable
- Core branch-1 tests pass

## Branch 1E — Shared Item Visual Asset Pipeline
**Status:** Implemented foundation. More wrapper scenes and quantity variants can be added later without gameplay-code changes.


### Goal
Introduce one durable client-side item-visual system so the same item keeps the same visual identity across:
- NPC carry visuals
- loose ground items
- stockpile representative visuals
- future build-site delivery visuals

### Scope
- Add a shared item-visual registry/mapping layer keyed by authoritative `item_id`
- Support item wrapper scenes rather than hardcoding mesh/material logic separately in each gameplay scene
- Use project-owned wrapper scenes for item visuals so scale, rotation, pivot, and future polish live in one place
- Convert carry/ground presentation to instance visuals through a shared path
- Keep a clear fallback placeholder path when a real asset does not exist yet
- Keep all of this client-presentation-only and separate from gameplay/domain logic

### Required structure direction
- authoritative item identity remains server-owned
- client presentation resolves `item_id -> visual scene / fallback`
- carry and loose-item presentation must not maintain separate item-shape logic
- one item should read as the same item before drop, during carry, and after drop
- visual scene ownership should live in one reusable layer, not spread across actor/world scripts

### Out of scope
- final art polish
- animation-heavy item handling
- one-model-per-unit rendering for storage piles
- inventory UI art pass
- gameplay rules for storage/carry capacity

### Exit criteria
- the same `item_id` uses the same shared visual source in carry and loose-item presentation
- adding a new item asset does not require patching multiple unrelated scripts
- missing assets degrade gracefully to a fallback placeholder
- the system is ready to be reused later by stockpiles and construction delivery visuals

---

# Phase 2 — Playable Branch 2: Hauling Foundation

## Goal
Turn hauling into a real server-authoritative background logistics task that can move existing items through the city without being tied only to scavenger dropoff.

### Locked direction from the branch questionnaire
- Early game: all NPCs can haul when they do not have a higher-priority task.
- Current scavenger direct-haul is changed to use the hauling framework. They will haul when they have no higher-priority task.
- Hauling jobs are invisible background logistics in this phase.
- First hardcoded priority order is:
  1. construction demand
  2. manufacturing demand
  3. ground cleanup
  4. storage refill / organization
  5. Dump Zone fallback
- Dump Zone is a last resort once real destinations exist.

## Branch 2 — Hauling Foundation

### Scope
- Add authoritative hauling jobs for existing loose items.
- Extend the same hauling framework so it can later serve:
  - Dump Zone extraction
  - stockpile transfers
  - manufacturing output movement
  - construction delivery
- Keep all early-game NPCs eligible to haul when they do not have a higher-priority task.
- Use a shared reservation model:
  - reserve a quantity inside a stack when possible
  - allow multiple NPCs to reserve different quantities from the same stack
  - if another NPC reaches a specific item first, the loser re-evaluates and continues
- Keep the current carry-capacity rules and one carried medium item at a time.
- Generate hauling jobs automatically when valid haulable state exists.
- Use a first hauling search radius of **10 tiles**.
- Make idle NPCs roam around the plot to find haulable items.
- Make sure roaming NPCs can not walk on other tiles/footprints than the ground.
- Surface later debugging hooks for:
  - haul job counts
  - reserved quantities
  - destination counts
  - blocked reasons

### Exit criteria
- Existing loose items with a valid destination create hauling jobs automatically.
- Idle/available NPCs can reserve, pick up, and deliver those items if they are in range.
- Reservation conflicts resolve by re-evaluation instead of item destruction or permanent job deadlock.
- Current scavenger direct-haul is changed to use the hauling framework. They will haul when they have no higher-priority task.
- NPCs roam around the plot to find haulable items without walking through other tiles/footprints than the ground.

---

# Phase 3 — Playable Branch 3: Manufacturing Foundation

## Goal
Introduce the first real production station and recipe loop so Wooden Pallets become manufactured physical items instead of a future special case.

## Branch 3 — Manufacturing Foundation

### Locked direction from the branch questionnaire
- First manufacturing station: **Workbench**.
- First recipe only: **1 Wooden Pallet = 4 Scrap Wood**.
- Craft time: **10 seconds**.
- Output quantity: **1**.
- One NPC assigned per station for the first version.
- Manufacturing is player-issued for now, not autonomous.

### Scope
- Add Workbench as a real placed object with authoritative state.
- Add Workbench recipe queue state that is easy to extend later.
- Add input buffer and output buffer state.
- Require physical delivery of ingredients to the Workbench.
- Allow the player to control manufacturing from:
  - the Orders panel
  - the station-local UI
- Support player-controlled quantity adjustment for pallet crafting.
- Block crafting when output buffer is full.
- Lock recipe inputs once crafting starts.
- If the player cancels queued work or removes the station, release unusable buffered ingredients back into hauling.
- Completed pallet outputs create hauling work automatically.
- Show first-pass station visuals for:
  - input materials
  - output pallets
  - simple crafting animation / VFX hooks

### Exit criteria
- The player can place or access a Workbench, queue Wooden Pallet crafting, deliver Scrap Wood to it, and receive real `WOODEN_PALLET` outputs through the same logistics system.
- Completed pallet outputs can be hauled like any other item.
- The recipe/station path is reusable for later stations and recipes.

Important Note!: Workbench will initially just be "spawned" into the world on entering a plot, but will in Branch 4 be moved into the construction foundation as a buildable item.

---

# Phase 4 — Playable Branch 4: Construction Foundation

## Goal
Introduce the first real blueprint-to-build flow with physical delivery, staged visuals, and a usable Basic Stockpile as the first constructed building.

## Branch 4 — Construction Foundation

### Locked direction from the branch questionnaire
- First construction target: **Basic Stockpile**.
- Construction starts from a placed blueprint and immediately creates a construction-site object.
- All materials must be delivered before build work starts.
- First stockpile recipe: **4 Wooden Pallets** only.
- Up to **2 NPCs** can work on one site.
- Base build time: **20 seconds**; with 2 NPCs the target time is **12 seconds**.
- Delivered materials are locked to the site until completion or cancellation.
- Canceling drops delivered materials back to the ground and hauling picks them up later.
- Construction and stockpile filter logic should be designed together in this branch.

### Scope
- Add a Construction order flow through the Orders UI.
- Add blueprint placement that creates authoritative construction-site state.
- Add real site delivery buffers for required materials.
- Generate hauling demand for existing required items.
- Generate manufacturing demand for missing pallets when construction needs them.
- Allow construction sites to wait for all required items before worker-time begins.
- After delivery is complete, generate normal construction work jobs.
- Support staged visuals:
  - minimum acceptable stage count is 2 (blueprint + completed)
  - if more staged assets exist later, progress should switch between them cleanly
- Visually show each delivered material at the site before construction starts.
- Add first usable Basic Stockpile behavior after completion:
  - 4 pallet slots
  - one resource type per slot
  - reject all intake until a filter is assigned
  - start empty
  - after filter assignment, matching loose items or dump zone items can generate haul jobs into it automatically
- Add site panel information for:
  - required items
  - delivered items
  - percent complete
  - assigned workers
  - blocked reason

### Exit criteria
- The player can place a Basic Stockpile blueprint, deliver 4 Wooden Pallets to it physically, complete the build with NPC worker time, assign filters, and then use it as the first real organized storage object.
- Construction cancellation returns delivered materials to the world instead of destroying them.
- Construction and stockpile state are both authoritative and inspectable.

---

# Phase 5 — Playable Branch 5: Sorting Station and Mixed Salvage Processing

## Goal
Turn Mixed Salvage into a true processing loop that feeds the rest of the logistics system.

## Branch 5A — Sorting Station Construction

### Scope
- Add Sorting Station as a buildable object.
- Use the same construction-site and physical-delivery foundation introduced for Basic Stockpile.
- Support object state needed for future process queues.

### Exit criteria
- Sorting Station can be built through the same durable construction foundation used by stockpiles.

## Branch 5B — Sorting Orders and Processing State

### Scope
- Add Sorting Station order path through the order system.
- NPCs will haul mixed salvage from the dump zone to the sorting station (a pallet on the left side)
- An NPC will take one mixed salvage from the pallet, put it on a bench, and process it, and then throw it in a hatch and create a clean output item. Most of this will be animated so the real process behind it is:    Move mixed salvage from the input buffer (pallet - belongs to the full asset), process it and then put it in the output buffer (hatch - belongs to the full asset).
- Consume worker time only.
- Convert inputs into random clean outputs through the recipe/process layer.

### Exit criteria
- Mixed Salvage can be turned into Scrap Wood / Scrap Metal / Tarp through a real process path.
- Processing state is server-authoritative.

## Branch 5C — Sorted Output Routing

### Scope
- Route sorted outputs to:
  1. matching stockpile
  2. build site if needed
  3. Dump Zone fallback
- Reuse common routing helpers rather than station-specific hardcoding.

### Exit criteria
- Sorted outputs re-enter the logistics network cleanly.
- Routing remains consistent with the rest of the game rules.

---

# Phase 6 — Playable Branch 6: First City Inventory / Logistics UI

## Goal
Give the player an exact practical logistics overview while more advanced reporting fantasy remains deferred.

## Branch 6A — Inventory Aggregation Layer

### Scope
- Add exact inventory aggregation by item type.
- Add source breakdown by source class:
  - Dump Zone
  - Stockpiles
  - Sorting Station
  - Ground / loose items
- Keep reserved / in-transit totals out of this first UI unless explicitly added later.

### Exit criteria
- The server can produce exact current logistics totals by source category.

## Branch 6B — Player-Facing Inventory Panel

### Scope
- Add one usable city inventory panel.
- Show item totals and expandable source breakdowns.
- Keep the first version practical and exact, not flavor-based.

### Exit criteria
- The player can inspect exact city totals during owned-plot play.

## Branch 6C — Local Object Panels and Warnings

### Scope
- Add local click panels for:
  - Dump Zone
  - Basic Stockpile
  - Sorting Station
  - Workbench
  - Construction Site
- Add blocked messages, warning messages, and simple activity/report lines.

### Exit criteria
- The player can inspect both global and object-local logistics state.
- Important blocked states are visible.

---

# Phase 7 — Hardening, Cleanup, and Expansion Safety

## Goal
Stabilize the first logistics foundation before adding more node types, more storage categories, or more advanced simulation detail.

## Branch 7A — Regression Coverage and Save/Protocol Safety

### Scope
- Add targeted tests for:
  - loot rolls
  - loose-item merging
  - hauling reservations
  - dump-zone capacity
  - manufacturing buffers
  - construction buffers
  - stockpile slot rules
  - sorting outputs
- Verify persistence shape is stable if save storage is affected.
- Verify protocol remains explicit and mirrored on both client and server.

## Branch 7B — Code Splits / Anti-Spaghetti Review

### Scope
- Review whether any simulation file became too central during the logistics work.
- Split routing, storage, manufacturing, or construction helpers if needed.
- Remove temporary debug-only wiring once no longer needed.

### Exit criteria
- The logistics system is in a stable state for the next family of features.
- The project is not boxed into a rushed milestone structure.

---

## 5. Dependency Order Summary

The recommended dependency chain is:

1. **0A** — Item/output definitions
2. **0B** — State/protocol refactor
3. **1A** — Rubble outputs + loose items
4. **1B** — NPC carry/direct-haul special case
5. **1C** — Dump Zone intake/capacity
6. **1D** — Client representation + verification
7. **1E** — Shared item-visual pipeline
8. **2** — Hauling foundation
9. **3** — Manufacturing foundation (Workbench + Wooden Pallets)
10. **4** — Construction foundation (Basic Stockpile)
11. **5A** — Sorting Station construction
12. **5B** — Sorting processing/orders
13. **5C** — Sorted output routing
14. **6A** — Inventory aggregation
15. **6B** — Inventory panel
16. **6C** — Local panels/warnings
17. **7A / 7B** — hardening and cleanup

---

## 6. What Must Stay Deferred

The following systems should remain deferred unless intentionally promoted into a later scoped branch:
- extra rubble/node types
- different node sizes
- small-item storage
- crates
- lighters and matches
- advanced dump penalties
- contamination / smell / rats / fire systems
- NPC personal ownership as real gameplay state
- NPC-owned business/domain hauling priorities as active gameplay logic
- estimated inventory reporting
- mistaken deliveries / wrong deliveries / over-delivery
- in-transit or reserved inventory UI layers
- imports / market / other players
- personality-driven reporting mistakes

## 6. What Must Stay Deferred

The following systems should remain deferred unless intentionally promoted into a later scoped branch:
- extra rubble/node types
- different node sizes
- small-item storage
- crates
- lighters and matches
- business/company-owned storage
- advanced dump penalties
- contamination / smell / rats / fire systems
- NPC personal ownership
- wrong deliveries / over-delivery / worker mistakes
- in-transit or reserved UI layers
- estimated inventory reporting
- market/import systems

These should not be added as hidden placeholders inside the first logistics branches.

---

## 7. Definition of “Done” for the First Full Logistics Milestone

The first logistics milestone should be considered complete when all of the following are true:
- rubble outputs real items one at a time
- loose items exist as real plot state
- NPCs can carry, reserve, drop  real items
- a starting Dump Zone accepts and abstracts deposited items with capacity enforcement
- Basic Stockpiles can be built through physical delivery and used with slot filters
- Mixed Salvage can be processed through a Sorting Station into clean resources
- the player can inspect exact current logistics totals and blocked states through a practical UI

At that point, the project will have its first **real early-game logistics backbone**, not just a temporary scavenging extension.

