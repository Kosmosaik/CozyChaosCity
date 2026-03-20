# M3_Implementation_Plan.md — Revised

## Milestone 3 — NPC Foundation, Identity, Readability, and Order Expansion

### Status
M3 foundation is now complete enough for the current project flow.
The plan remains useful as a reference, but the repo has already delivered the major foundation items below.

### M3 Goal

M3 should no longer be treated as only “the first NPC work loop.”

M3 should deliver the first **player-readable NPC gameplay foundation** for owned plots.

That means M3 must include:

- authoritative NPC simulation
- readable NPC identity
- NPC inspection
- role/job specialization
- player-readable current activity
- overhead labels
- role-based order eligibility
- the first expandable order UI foundation

M3 is complete only when NPCs feel like actual plot inhabitants instead of invisible technical workers.

---

## M3 Design Principles

### 1. Simulation correctness
The server remains authoritative for:
- NPC state progression
- order acceptance/rejection
- job creation
- job assignment
- work results
- role eligibility

### 2. Player readability
The player must be able to understand:
- who an NPC is
- what role/job type they have
- what they are doing right now
- why they did or did not respond to an order

### 3. Stability-first implementation
New NPC features must be added in a way that does not force another architecture cleanup immediately after implementation.

That means:
- no hardcoded one-off content paths
- no scattered order-role checks across unrelated scripts
- no duplicated activity text logic
- no inferred local variable declarations in GDScript
- no UI strings generated ad hoc in several places
- no character data hidden inside unrelated structures

---

## M3 Scope

### M3.1 — NPC Data Foundation
Extend the NPC model so it supports first-class character data.

Each NPC should have at minimum:
- `id`
- `name`
- `job_type`
- `current_activity`
- `state`
- `x`
- `y`
- `home_x`
- `home_y`
- `assigned_order`
- `target_object_id`
- `move_to_x`
- `move_to_y`
- `state_started_at_ms`
- `state_ends_at_ms`
- `carrying_kind`

Optional but recommended in M3:
- `traits: []`
- `allowed_order_kinds: []`

### Why
This creates a durable base for:
- Character Sheet
- overhead labels
- role gating
- future progression
- future trait/stat systems

---

### M3.2 — Player-Facing Activity Layer
Add a dedicated player-readable activity layer instead of exposing raw internal state directly.

Keep both:
- internal simulation `state`
- player-facing `current_activity`

Examples:
- state: `moving_to_target`
- current_activity: `Walking to rubble`

- state: `working`
- current_activity: `Clearing rubble`

- state: `carrying_to_dropoff`
- current_activity: `Carrying scrap`

### Why
This avoids coupling player-facing UI text directly to internal implementation terms.

---

### M3.3 — Name Generation Foundation
Add a lightweight random name generation system for NPCs.

Requirements:
- generated server-side
- saved persistently
- deterministic enough that names do not change after reload
- easy to extend later

The generated name should appear in:
- NPC model
- Character Sheet
- overhead labels

### Recommendation
Use a small curated list-based generator first:
- first-name list only, or
- first-name + surname/descriptor list

Keep it simple and readable.

---

### M3.4 — Job Type / Role Specialization
Add a real first role system.

Minimum roles for M3:
- `SCAVENGER`
- `BUILDER` or `LABORER`

Scavenging orders must only be executable by eligible NPCs.

### Why
This is needed so the game can properly test and demonstrate:
- role filtering
- order eligibility
- role-based behavior
- future order expansion

This is not optional anymore if M3 is supposed to establish the NPC system properly.

---

### M3.5 — Role-Based Order Eligibility
The order system must stop assuming every NPC can do every job.

Add explicit order eligibility logic so the server can answer:
- is there any eligible NPC for this order?
- which NPCs are allowed to take this job?
- why was the order rejected?

Examples of rejection reasons:
- `no_eligible_npc`
- `order_already_active`
- `nothing_to_scavenge`
- `no_valid_target`

### Why
This is essential for both debugging and player clarity.

---

### M3.6 — Character Sheet
Add an NPC Character Sheet that opens when the player clicks an NPC in owned plot mode.

The Character Sheet should show at minimum:
- name
- role/job type
- current activity
- current state
- current assignment or current target summary
- traits section placeholder
- future stats/skills placeholder

### Requirements
- the panel should be structured so more fields can be added later without redesign
- opening/closing should be local/client-side
- no server authority is needed for the UI open/close state itself

### Why
This makes the NPC system actually readable and testable to the player.

---

### M3.7 — NPC Selection / Inspection Interaction
NPC actors in the local plot should support click selection.

Selection should:
- open Character Sheet
- visually identify which NPC is selected
- not conflict badly with camera or plot interaction

This can be simple for M3:
- click NPC → open Character Sheet
- click elsewhere / close button → close sheet

---

### M3.8 — Overhead NPC Labels
Add a small overhead label above every NPC.

At minimum it should show:
- NPC name
- current activity

This should be:
- lightweight
- readable
- not final-polish dependent

### Why
This gives immediate feedback without forcing the player to click every NPC.

---

### M3.9 — Order UI Foundation Expansion
Convert the current one-off Scavenge flow into the first expandable order menu foundation.

This does **not** mean implementing all future orders right now.

It **does** mean:
- the UI should stop being a one-button dead end
- the structure should anticipate more order types cleanly

Prepare for future order categories like:
- Scavenge
- Haul materials
- Deliver to blueprint
- Construct
- Clear area
- Repair

For M3, only supported orders need to be enabled, but the menu foundation should be ready.

**Current repo state**
- This is now implemented as a dedicated bottom-bar Orders menu plus `OrdersMenuPanel`.
- Order definitions are no longer hardcoded directly inside the HUD flow.
- Current real order actions are:
  - `Scavenge All`
  - `Scavenge One`
- Active-order cancellation is now exposed as a dedicated inline cancel control beside the active-order label, not as a noisy list row.
- `Scavenge All` is still considered temporary convenience UI until targeted selection/area-order flow replaces it later.

---

### M3.10 — Multi-NPC Testing Foundation
M3 should support proper role testing.

Recommended:
- at least two starter NPCs in debug/dev testing setup, or
- a test configuration where one scavenger and one non-scavenger can coexist

This is important so you can visibly confirm:
- only scavengers take scavenging jobs
- non-scavengers remain idle or show no eligible task
- Character Sheet and overhead labels reflect the difference

This can be temporary for M3 testing if needed, but the system should support it cleanly.

---

### M3.11 — Trait Foundation (Lightweight)
Add a trait-ready field but keep scope controlled.

Recommended M3 behavior:
- traits may be empty, or
- use 1–2 simple readable starter traits for testing

Examples:
- Hardworking
- Slow
- Careful
- Strong

Traits should **not** become a full balancing/simulation system in M3.
They should only establish the structural foundation.

---

### M3.12 — Feedback / UX Clarity
The player should get clear feedback when an order fails.

Examples:
- No eligible NPC
- Already active
- Nothing to scavenge

This should surface in the UI, not only logs.

Also recommended:
- disable or visually mute unavailable order actions when possible
- show role mismatch clearly in Character Sheet and/or order UI

**Current repo state**
- The noisy “Another order is already active” / “This order is already active” list labels were intentionally removed from the menu.
- Active-order cancellation is now presented as a compact inline `X` beside the active-order value.
- The current lightweight `PlotDebugOverlay` (F3) is available for development-time visibility into live jobs, NPC states, rubble count, and active order.
- The debug overlay is a temporary development tool, not a final player-facing UI feature.

---

## Suggested M3 Implementation Order

### Phase A — Data and server foundation
1. extend NPC model with:
   - `name`
   - `job_type`
   - `current_activity`
   - optional `traits`
   - optional `allowed_order_kinds`
2. add starter name generation on the server
3. migrate/normalize old save data so old NPCs get valid new fields
4. add role eligibility helpers on the server
5. restrict scavenging jobs to eligible roles only

### Phase B — Presentation and interaction
6. add local NPC selection/click interaction
7. add Character Sheet UI
8. add overhead labels for:
   - name
   - current activity
9. add current-activity mapping/update flow from server to client

### Phase C — Order expansion foundation
10. replace one-off Scavenge interaction with first expandable order menu structure
11. add rejection/eligibility feedback to UI
12. verify role-specific order behavior with at least two role types

**Current repo state**
- Phase C is now implemented.
- The current repo has a bottom-bar Orders button, a dedicated `OrdersMenuPanel`, typed order-menu entries, centralized order definitions, real `Scavenge One` / `Scavenge All` issue flow, and server-authoritative cancel support.

### Phase D — Validation and polish
13. verify persistence for:
   - name
   - role
   - activity
   - traits
14. verify Character Sheet correctness during active jobs
15. verify overhead label stability during enter/leave plot
16. ensure all new GDScript uses explicit local variable types
17. validate the temporary debug overlay against the live job/NPC state during order testing

### Completion note
The repo now satisfies the intended M3 foundation outcome.
The next meaningful step should be targeted order-selection flow rather than more one-off order-menu content.

---

## Architecture Rules for M3

### Rule 1 — One authoritative NPC model
All NPC-facing data should come from one coherent server-authoritative NPC model.

Do not split NPC identity data across:
- random renderer dictionaries
- UI-only fake objects
- hardcoded label builders

### Rule 2 — Separate simulation state from player-facing text
Do not use raw internal state strings directly everywhere in the UI.

Keep:
- internal state
- player-facing activity text

### Rule 3 — Role checks must be centralized
Do not scatter checks like:
- `if npc.job_type == "SCAVENGER"`  
through many files.

Use a centralized eligibility/helper layer.

### Rule 4 — Character Sheet must be future-ready
Even if only a few fields are filled now, the structure must clearly support future additions:
- traits
- skills
- stats
- health
- needs
- equipment
- assignment history

### Rule 5 — No inferred local variable declarations in GDScript
Do not use local `:=` declarations in gameplay/UI/runtime scripts.

Always prefer explicit local types, for example:
```gdscript
var npc_id: String = ...
var result: Dictionary = ...
var tween: Tween = ...
var state: String = ...
var duration_sec: float = ...
```
