# Cozy Chaos City — Logistics / Storage / Sorting Technical Implementation Roadmap

_Last updated: 2026-03-23_

## Purpose

This document converts the current logistics design decisions into a practical technical roadmap for implementation.

It is based on:
- the current repo state and M3 foundation
- `docs/Logistics-Storage-Sorting-Implementation-Plan.md`
- the follow-up clarifications given after that plan
- the project architecture rules in `docs/GPT_Assistant_Rules.md`

This is not a replacement for the design plan. It is the **technical execution roadmap** that defines what should be built first, what each branch is responsible for, and what must remain deferred.

## Current implementation status after the 2026-03-23 session

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

### Partially completed branches
- **Branch 1B — NPC Carry / Direct-Haul Decisions**
  - scavengers now carry a real item in `carry_slots`
  - direct-haul decision is now server-authoritative for newly scavenged output
  - current routing is:
    - nearby valid Dump Zone within 8 tiles
    - otherwise ground fallback
  - **Not implemented yet in this branch:**
    - hauling existing loose items
    - loose-item pickup reservations
    - stockpile-aware routing

- **Branch 1C — Dump Zone Object and Intake Logic**
  - starting Dump Zone now exists as a real plot object
  - Dump Zone now has authoritative abstract storage state
  - capacity is enforced
  - full-state handling now blocks retry for 1 minute and safely falls back to loose ground items
  - **Still pending:**
    - player-facing rendering / feedback for Dump Zone state

### Current next branch
- **Branch 1D — Client Representation and Verification for Branch 1**
  - render Dump Zone in the owned plot
  - render loose ground items
  - verify carried-item presentation against the new item/state path
  - add enough player-facing/debug visibility to confirm:
    - direct-haul to Dump Zone
    - ground fallback when full
    - loose-item placement/merge behavior

### Important current limitations
- Dump Zone and loose items are already authoritative on the server, but they are not yet visible in the client.
- Direct-haul currently covers newly scavenged output only.
- No stockpile or sorting logic is implemented yet.
- Branch 2 should not begin until Branch 1D makes the current server behavior readable and testable in the client.

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

### 3.5 NPC carry state
Replace generic carry markers with real carry-slot data.

The carry model should be ready for:
- 1 medium item in one hand
- 2 medium items total
- future two-hand large items

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
**Status:** This is now the active next branch

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

---

# Phase 2 — Playable Branch 2: Basic Stockpile and Physical Construction Delivery

## Goal
Introduce the first real buildable filtered storage and the first construction-delivery loop.

## Branch 2A — Construction Site and Physical Delivery Foundation

### Scope
- Add construction-site object state
- Add required-item buffers for buildables
- Require physical material delivery for storage construction
- Visually represent delivered materials at the site in a lightweight but durable way
- Lock delivered materials to the site until completion or cancellation rules exist

### Exit criteria
- Buildables can require real delivered materials
- Construction input buffers are authoritative
- Delivery state is not faked through abstract inventory subtraction

## Branch 2B — Wooden Pallet Recipe / Availability

### Scope
- Add Wooden Pallet production rule to the recipe/process layer
- Ensure the item exists in a durable way for future buildings too
- Keep manufacturing simple for this phase if needed, but do not hardcode pallet handling as a special one-off building exception

### Exit criteria
- Wooden Pallet can enter the logistics system as a real item
- Construction requirements can consume it normally

## Branch 2C — Basic Stockpile Storage Logic and Filters

### Scope
- Add Basic Stockpile object
- Add 4-slot pallet storage state
- Add slot filter configuration
- Prevent hauling into stockpile until a slot is configured
- Enforce one resource type per slot
- Enforce 20 medium items per slot
- Allow multiple stockpiles
- Handle filter change conflicts by requiring relocation first

### Exit criteria
- Basic Stockpile works as real slotted storage
- Filters control intake correctly
- Storage contents are represented in object state, not generic ad hoc counters

## Branch 2D — Routing Integration and Visual Representation

### Scope
- Update routing priority so clean resources prefer valid stockpiles
- Add representative stack visuals for stockpile contents
- Ensure stockpile capacity and filter behavior are visible and debuggable

### Exit criteria
- Stockpiles are usable and preferred correctly by the routing layer
- Visuals represent contents without one-model-per-unit spam

---

# Phase 3 — Playable Branch 3: Sorting Station and Mixed Salvage Processing

## Goal
Turn Mixed Salvage into a true processing loop that feeds the rest of the logistics system.

## Branch 3A — Sorting Station Construction

### Scope
- Add Sorting Station as a buildable object
- Use physical delivery for construction
- Support object state needed for future process queues

### Exit criteria
- Sorting Station can be built through the same durable construction foundation used by stockpiles

## Branch 3B — Sorting Orders and Processing State

### Scope
- Add Sorting Station order path through the order system
- Pull Mixed Salvage from the Dump Zone only for this phase
- Consume worker time only
- Convert inputs into random clean outputs through the recipe/process layer

### Exit criteria
- Mixed Salvage can be turned into Scrap Wood / Scrap Metal / Tarp through a real process path
- Processing state is server-authoritative

## Branch 3C — Sorted Output Routing

### Scope
- Route sorted outputs to:
  1. matching stockpile
  2. build site if needed
  3. Dump Zone fallback
- Reuse common routing helpers rather than station-specific hardcoding

### Exit criteria
- Sorted outputs re-enter the logistics network cleanly
- Routing remains consistent with the rest of the game rules

---

# Phase 4 — Playable Branch 4: First City Inventory / Logistics UI

## Goal
Give the player an exact practical logistics overview while more advanced reporting fantasy remains deferred.

## Branch 4A — Inventory Aggregation Layer

### Scope
- Add exact inventory aggregation by item type
- Add source breakdown by source class:
  - Dump Zone
  - Stockpiles
  - Sorting Station
  - Ground / loose items
- Keep reserved / in-transit totals out of this first UI unless explicitly added later

### Exit criteria
- The server can produce exact current logistics totals by source category

## Branch 4B — Player-Facing Inventory Panel

### Scope
- Add one usable city inventory panel
- Show item totals and expandable source breakdowns
- Keep the first version practical and exact, not flavor-based

### Exit criteria
- The player can inspect exact city totals during owned-plot play

## Branch 4C — Local Object Panels and Warnings

### Scope
- Add local click panels for:
  - Dump Zone
  - Basic Stockpile
  - Sorting Station
- Add blocked messages, warning messages, and simple activity/report lines

### Exit criteria
- The player can inspect both global and object-local logistics state
- Important blocked states are visible

---

# Phase 5 — Hardening, Cleanup, and Expansion Safety

## Goal
Stabilize the first logistics foundation before adding more node types, more storage categories, or more advanced simulation detail.

## Branch 5A — Regression Coverage and Save/Protocol Safety

### Scope
- Add targeted tests for:
  - loot rolls
  - loose-item merging
  - reservations
  - dump-zone capacity
  - stockpile slot rules
  - sorting outputs
- Verify persistence shape is stable if save storage is affected
- Verify protocol remains explicit and mirrored on both client and server

## Branch 5B — Code Splits / Anti-Spaghetti Review

### Scope
- Review whether any simulation file became too central during the logistics work
- Split routing, storage, node-output, or construction helpers if needed
- Remove temporary debug-only wiring once no longer needed

### Exit criteria
- The logistics system is in a stable state for the next family of features
- The project is not boxed into a rushed milestone structure

---

## 5. Dependency Order Summary

The recommended dependency chain is:

1. **0A** — Item/output definitions
2. **0B** — State/protocol refactor
3. **1A** — Rubble outputs + loose items
4. **1B** — NPC carry/reservations/routing
5. **1C** — Dump Zone intake/capacity
6. **1D** — Client representation + verification
7. **2A** — Construction delivery foundation
8. **2B** — Wooden Pallet production
9. **2C** — Stockpile logic/filters
10. **2D** — Stockpile routing + visuals
11. **3A** — Sorting Station construction
12. **3B** — Sorting processing/orders
13. **3C** — Sorted output routing
14. **4A** — Inventory aggregation
15. **4B** — Inventory panel
16. **4C** — Local panels/warnings
17. **5A / 5B** — hardening and cleanup

---

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
- NPCs can carry, reserve, drop, and direct-haul real items
- a starting Dump Zone accepts and abstracts deposited items with capacity enforcement
- Basic Stockpiles can be built through physical delivery and used with slot filters
- Mixed Salvage can be processed through a Sorting Station into clean resources
- the player can inspect exact current logistics totals and blocked states through a practical UI

At that point, the project will have its first **real early-game logistics backbone**, not just a temporary scavenging extension.

