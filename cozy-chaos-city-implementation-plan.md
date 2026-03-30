# Cozy Chaos City — Detailed Implementation Plan

## 1. Goal

Turn the current project from a **strong prototype** into a **stable long-term production foundation** without losing the current design identity.

This plan assumes:

- no temporary slices
- no band-aid fixes
- no “we’ll rewrite later”
- architectural changes should be durable

---

## 2. Delivery philosophy

### Principles
1. **Preserve server authority**
2. **Refactor around domain boundaries**
3. **Replace scan-heavy access with indexed access**
4. **Replace per-unit haul jobs with aggregated tasking**
5. **Move to durable persistence**
6. **Profile continuously**
7. **Keep protocol explicit**
8. **Keep gameplay behavior stable while internals improve**

---

## 3. Phase 0 — Baseline stabilization

## Objectives
- create reliable engineering baseline
- avoid refactoring blind
- define performance budgets

## Tasks

### 3.1 CI and validation
- Add CI for:
  - install
  - typecheck
  - lint
  - test
- Add build artifacts validation
- Add save load smoke test

### 3.2 Performance budgets
Define initial budgets for:
- server simulation tick target
- max save duration
- max projection build time
- max packet size by message type
- max client plot rebuild duration
- max active node counts for core scenes

### 3.3 Benchmark scenarios
Create scripted scenarios:
- starter plot baseline
- high rubble density
- high loose item density
- mass hauling scenario
- multiple owned plots active
- blocked station access
- reconnect storm

### 3.4 Migration policy
Define:
- world schema versioning policy
- migration testing policy
- save compatibility policy

## Exit criteria
- CI green
- baseline budgets documented
- reproducible benchmark fixtures created

---

## 4. Phase 1 — Data model and indexing refactor

## Objectives
Replace scan-heavy access with fast, explicit query structures.

## Tasks

### 4.1 Introduce plot indexes
Per detailed plot maintain:
- `cellsByCoord`
- `objectById`
- `objectsByKind`
- `objectsByTile`
- `looseItemById`
- `looseItemsByTile`
- `looseItemsByKind`
- `npcById`
- `jobsById`
- `jobsByStatus`
- `jobsByKind`
- `jobsByNpc`
- reservation indexes

### 4.2 Introduce world indexes
At world level maintain:
- plots by id
- claimed plots by player
- detailed plots by id
- players by id
- connected player sessions
- region/module indexes if needed

### 4.3 Query API
Create explicit query modules:
- `plot_queries.ts`
- `job_queries.ts`
- `item_queries.ts`
- `npc_queries.ts`

No subsystem should directly rely on flat scans if a maintained index exists.

### 4.4 Mutation ownership
All mutations should update indexes atomically through one mutation layer.

## Exit criteria
- no hot path depends on repeated `array.find` over cells/objects/jobs
- benchmark shows material reduction in tick cost

---

## 5. Phase 2 — Persistence redesign

## Objectives
Replace full JSON snapshot persistence with durable, scalable storage.

## Recommended choice
**SQLite + WAL**

## Tasks

### 5.1 Define persistence boundary
Create repository interfaces for:
- players
- plots
- plot details
- objects
- loose items
- jobs
- NPC state
- manufacturing state
- migrations

### 5.2 Schema design
Separate:
- static/generated data
- mutable plot state
- runtime simulation state
- player/session state

### 5.3 Save strategy
Use:
- incremental writes
- transaction-based updates
- snapshot/export utility for backup/debug
- migration scripts

### 5.4 Import existing JSON world
Build a one-time importer from current save format.

## Exit criteria
- game can load/save entirely from SQLite
- JSON save becomes export/debug tool, not primary backend
- save cost scales with changed data, not whole world size

---

## 6. Phase 3 — Hauling redesign

## Objectives
Replace per-unit jobs with aggregated, reservation-based haul tasks.

## Tasks

### 6.1 New haul task model
A haul task should contain:
- source reference
- destination reference
- item kind
- quantity requested
- quantity reserved
- quantity in transit
- quantity delivered
- priority
- allowed hauler types / constraints

### 6.2 Reservation layer
Reservations should be explicit and auditable:
- source quantity reservation
- destination capacity reservation
- hauler assignment reservation

### 6.3 Reconciliation
Instead of constantly creating many tiny jobs:
- maintain one task record
- split only when necessary
- merge compatible tasks
- garbage collect only completed/invalid tasks

### 6.4 UI/debug update
Update debug overlays to visualize:
- aggregate haul tasks
- reservation state
- blocked reasons
- task aging

## Exit criteria
- job/task count no longer grows with item quantity in a naive way
- save size and tick cost drop materially in hauling-heavy scenarios

---

## 7. Phase 4 — NPC simulation and navigation refactor

## Objectives
Separate behavior selection from movement/pathfinding and make navigation scalable.

## Tasks

### 7.1 Split NPC architecture
Create:
- `npc_state_machine.ts`
- `npc_behavior_selection.ts`
- `npc_navigation.ts`
- `npc_movement.ts`
- `npc_carrying.ts`
- `npc_recovery.ts`

### 7.2 Navigation service
Implement:
- occupancy grid per plot
- walkability cache
- A* pathfinding
- invalidation when blocking objects change
- route request throttling
- cheap reachability checks

### 7.3 Simulation scheduling
Move away from “all logic every tick” where possible:
- event-driven wakeups
- targeted dirty-set processing
- plot-local work queues
- throttled expensive recomputations

### 7.4 Debug tooling
Add server metrics for:
- path requests/sec
- average path length
- failed path rate
- repath rate
- stuck recovery count

## Exit criteria
- NPC logic is modular and easier to test
- pathing cost is predictable
- benchmark scenarios remain stable at higher NPC counts

---

## 8. Phase 5 — Server application architecture cleanup

## Objectives
Reduce entrypoint complexity and clarify ownership boundaries.

## Tasks

### 8.1 Split `index.ts`
Create:
- `server_bootstrap.ts`
- `connection_manager.ts`
- `message_router.ts`
- `command_handlers/`
- `simulation_scheduler.ts`
- `broadcast_dispatcher.ts`

### 8.2 Command model
Every client action becomes a command:
- claim plot
- enter plot
- clear rubble
- place building
- set recipe
- etc.

### 8.3 Projection layer
Keep projection building separate from mutation logic.

### 8.4 Structured logging
Adopt structured logs and category tags.

## Exit criteria
- entrypoint becomes orchestration only
- command flow is testable and auditable

---

## 9. Phase 6 — Client architecture cleanup

## Objectives
Prevent client controller bloat and make scene/render code maintainable.

## Tasks

### 9.1 Split `NetClient.gd`
Create:
- `WebSocketTransport.gd`
- `ClientSession.gd`
- `ProtocolDecoder.gd`
- `ClientRequestApi.gd`

### 9.2 Split `HUD.gd`
Create:
- connection panel controller
- orders controller
- selection controller
- debug controller
- top-level HUD coordinator

### 9.3 Split `OwnedPlotDetailRenderer3D.gd`
Create:
- state adapter
- object renderer
- loose item renderer
- NPC renderer
- ground renderer

### 9.4 Split `GameWorld3D.gd`
Create:
- world shell controller
- plot mode controller
- camera coordinator
- selection coordinator

### 9.5 Introduce client view models
Use typed local wrappers for incoming protocol data.

## Exit criteria
- major client files are under control
- rendering code is presentation-focused
- network/session state is not smeared across UI and world layers

---

## 10. Phase 7 — World/plot generation pipeline redesign

## Objectives
Turn current hardcoded generation into a durable content pipeline.

## Tasks

### 10.1 Separate generation layers
Create:
- macro world generator
- plot archetype generator
- local detail template generator
- runtime state initializer

### 10.2 Template data
Store starter layouts, object placements, and decorators in data files:
- plot archetypes
- rubble distributions
- starter stockpiles
- early station layouts
- future biome/region themes

### 10.3 Generator versioning
Every generated structure should carry:
- generator version
- template id
- seed

### 10.4 Migration strategy
Support regeneration or migration from older template versions safely.

## Exit criteria
- generation logic is data-driven
- world.ts no longer owns template authoring logic
- content designers can tune more without invasive code changes

---

## 11. Phase 8 — Observability and performance tooling

## Objectives
Make performance a managed part of development, not guesswork.

## Tasks

### 11.1 Server metrics
Track:
- tick duration
- path duration
- projection duration
- save duration
- active tasks/jobs
- reservations
- packet sizes
- player counts
- per-plot sim cost

### 11.2 Godot performance monitors
Use built-in and custom monitors for:
- FPS
- frame time
- draw calls
- active nodes
- render object counts
- plot rebuild duration
- sync latency

Godot’s documentation supports and encourages this style of profiling and custom monitor use. ([docs.godotengine.org](https://docs.godotengine.org/en/4.4/tutorials/performance/general_optimization.html))

### 11.3 Debug dashboards
Add:
- server stats panel
- plot heatmaps
- pathing stats
- reservation/task state overlays

### 11.4 Performance regression checks
Add benchmark thresholds into CI where practical.

## Exit criteria
- performance regressions are visible quickly
- optimization work is evidence-based

---

## 12. Phase 9 — Content/data architecture

## Objectives
Prepare for adding many more items, buildings, recipes, and NPC behavior without increasing code chaos.

## Tasks

### 12.1 Data registries
Create registries for:
- items
- buildings
- recipes
- NPC roles
- plot archetypes
- object visuals

### 12.2 Validation
Validate all content data at startup.

### 12.3 Content ownership
Ensure runtime systems consume validated data definitions rather than hardcoded switch logic where possible.

## Exit criteria
- adding content is mostly data work
- code changes for new content types are minimized

---

## 13. Proposed order of execution

## Recommended real-world order

### Step 1
Phase 0 — baseline, CI, metrics, benchmark fixtures

### Step 2
Phase 1 — indexes/query architecture

### Step 3
Phase 3 — hauling redesign

### Step 4
Phase 4 — NPC navigation/simulation split

### Step 5
Phase 2 — persistence redesign

### Step 6
Phase 5 — server application cleanup

### Step 7
Phase 6 — client architecture cleanup

### Step 8
Phase 7 — generation/data pipeline

### Step 9
Phase 8/9 — observability and content systems expansion

## Why this order
Because the biggest architectural gains come from fixing:
- access patterns
- task explosion
- simulation cost
- persistence

before layering more systems on top.

---

## 14. What should not be changed

To be clear, I would **preserve** these core choices:

- Godot client
- TypeScript server
- server-authoritative simulation
- explicit protocol schemas
- plot-based world structure
- systemic/NPC-centered design
- strong debug culture

Those are good choices.

---

## 15. Final recommendation to management / studio leadership

If this were a company project, my recommendation would be:

### Green light
Yes, continue investing in the project.

### Condition
Pause major feature/content expansion for a short architecture pass.

### Mandatory technical initiative
Run a focused refactor initiative on:
- persistence
- indexing/query model
- hauling
- NPC navigation
- server/client large-file decomposition

### Why
Because that work will multiply the value of all future feature development.

### Final call
**Do not rewrite the whole game.**  
**Do rewrite several core internals now, while the codebase is still small enough to reshape cleanly.**
