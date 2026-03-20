# Cozy Chaos City — Updated Foundation Hardening, Benchmarking, and Scalability Plan (Latest Archive)

## Goal

Turn the current prototype into a durable, measurable, scalable base for a long-lived citybuilder/social sim, while also hardening the newly added animation/presentation layer.

This updated version keeps the previous benchmark-first strategy and adds new tasks for:

- animation/content pipeline hardening
- client/server time alignment for NPC interpolation
- visual/effect performance budgeting
- asset/content hygiene

---

## Core Principles

1. **Measure first, then refactor**
2. **Keep the server authoritative**
3. **Protect public / owner-only / server-only boundaries**
4. **Do not keep adding behavior into god-files**
5. **Treat imported art assets as unstable until wrapped**
6. **Do not rely on unsynced wall clocks for gameplay-timed presentation**
7. **Benchmark every major change**
8. **Do not let instrumentation become its own spaghetti**

---

## Execution Order

1. **Phase -1 — Baseline profiling and benchmark harness**
2. **Phase 0 — Stabilization and setup cleanup**
3. **Phase 1 — Observability and metrics foundation**
4. **Phase 2 — Server architecture hardening**
5. **Phase 3 — Persistence migration to SQLite**
6. **Phase 4 — Protocol, contracts, and time-sync hardening**
7. **Phase 5 — Client architecture refactor**
8. **Phase 5.5 — Animation, asset, and presentation pipeline hardening**
9. **Phase 6 — Testing strategy upgrade**
10. **Phase 7 — Documentation restructuring**
11. **Phase 8 — Gameplay-system readiness refactors**

---

## Phase -1 — Baseline Profiling and Benchmark Harness

## Objectives
- establish a repeatable baseline before structural refactors
- identify current server and client bottlenecks
- include the newly added animation/label/effect paths in benchmarking

## Tasks

### -1.1 Add benchmark mode
Create a reproducible benchmark/stress mode for the current version.

### -1.2 Add synthetic world seeder
Seed benchmark worlds with:
- total plots
- claimed plots
- detailed plots
- cells per detailed plot
- starter object count
- rubble density
- NPC count
- jobs/orders per plot
- connected client count

### -1.3 Add load/stress harness
Simulate:
- connect/login
- request world
- claim plot
- enter plot
- issue order
- cancel order
- idle connected clients
- reconnect cycles

### -1.4 Expand benchmark matrix
Minimum benchmark matrix should now include:

#### World/network
- 1 / 5 / 10 / 25 idle world-view clients
- claim bursts
- order issue/cancel spam
- save-heavy mutation churn

#### Local-plot simulation
- 1 detailed plot, 0 NPCs
- 1 detailed plot, 10 NPCs
- 1 detailed plot, 25 NPCs
- 1 detailed plot, 50 NPCs
- 1 detailed plot, dense objects, low NPC count
- multiple active detailed plots with jobs running

#### New visual/presentation scenarios
- 10 / 25 / 50 / 100 local NPCs with overhead labels enabled
- same scenarios with overhead labels disabled
- repeated plot enter/exit transitions
- repeated rubble clears with smoke active
- dense local actor scene with animations active and labels hidden
- dense local actor scene with animations active and labels visible

### -1.5 Persist benchmark outputs
Save:
- benchmark run id
- commit/hash
- scenario name
- seed parameters
- min / avg / p95 / p99 / max
- payload bytes
- tick stats
- save stats
- client frame stats

Output to:
- JSON
- CSV summary

### -1.6 Add a benchmark comparison convention
For every milestone:
- rerun same matrix
- compare p95/p99, not only averages
- keep before/after results side-by-side

---

## Phase 0 — Stabilization and Setup Cleanup

## Objectives
- make the repo reproducible
- remove packaging/process noise
- fix obvious correctness/setup debt

## Tasks

### 0.1 Fix server environment reproducibility
- stop shipping `node_modules`
- verify clean install from lockfile
- make lint/typecheck/test work from a fresh environment
- resolve executable permission and optional dependency issues
- standardize module format strategy

### 0.2 Remove hardcoded endpoint configuration
Replace hardcoded default server URL with config-driven environment selection.

### 0.3 Fix immediate client correctness issues
- remove duplicate `"error"` branch in `NetClient.gd`
- review plot-exit UI logic
- improve profile persistence error handling
- sanitize profile filenames

### 0.4 Clean repo noise
Remove and ignore:
- temp `.tmp` scene files
- generated/dev-only noise
- non-essential runtime artifacts from handoff archives

### 0.5 Rewrite README
Include:
- architecture overview
- setup/run instructions
- benchmark workflow
- profiling workflow
- persistence summary
- config handling

---

## Phase 1 — Observability and Metrics Foundation

## Objectives
- make real bottlenecks visible before refactors
- instrument both simulation and new presentation systems
- persist benchmark results for comparison

## Tasks

### 1.1 Add modular metrics wrappers
Create small metrics modules for:
- simulation
- persistence
- network
- client render
- client UI
- client effects
- client motion/interpolation

### 1.2 Add structured server logging
Track:
- connections/disconnections
- auth events
- claims
- clear actions
- order issue/cancel
- world patch broadcasts
- slow tick warnings
- save warnings/errors
- benchmark start/stop

### 1.3 Add server metrics
Expose at minimum:
- connection count
- online player count
- detailed plot count
- NPC count
- job count
- tick duration histogram
- changed plots per tick
- buildClientWorld duration
- buildClientPlot duration
- serialization duration
- broadcast fan-out duration
- message payload bytes
- save queue depth
- save clone duration
- flush duration

### 1.4 Instrument server hotspots
Instrument:
- `tickNpcSimulation`
- `tickNpc`
- `broadcastPlotUpdate`
- `buildClientPlot`
- `buildClientWorld`
- `makeMsg` / serialization
- WebSocket send fan-out
- `queueSave` clone cost
- flush/write/rename cost

### 1.5 Instrument client hotspots
Instrument:
- `HUD._process`
- `OwnedPlotDetailRenderer3D.get_npc_overhead_label_entries`
- `NpcOverheadLabelsLayer.sync_labels`
- `OwnedPlotDetailRenderer3D._sync_starter_objects`
- `OwnedPlotDetailRenderer3D._sync_npcs`
- local mode enter timing
- local mode exit timing
- rubble clear smoke spawn counts
- animated NPC count
- label count
- active tween count

### 1.6 Add client dev performance overlay
Display:
- FPS/frame time
- max frame time
- stutter count
- RTT
- world/local mode
- rendered NPC count
- rendered object count
- visible label count
- active effect count
- active tween count
- selected plot/NPC/object

### 1.7 Add deep profiling support
Add:
- Node CPU profiles
- heap snapshots
- documented Godot profiler workflow

### 1.8 Add timing dimensions
Every timing sample should include:
- total plots
- detailed plots
- object count
- NPC count
- job count
- connected clients
- payload bytes
- benchmark run id
- scenario name

---

## Phase 2 — Server Architecture Hardening

## Objectives
- stop server hotspot files from becoming permanent god-files
- define stable domain/service boundaries
- prepare for more simulation systems

## Tasks

### 2.1 Slim `server/src/index.ts`
Move out:
- session handling
- message routing
- broadcast logic
- simulation scheduling
- persistence orchestration

### 2.2 Split `world.ts`
Extract:
- generation
- migrations
- plot detail construction
- plot queries
- object queries
- expansion helpers

### 2.3 Split `npc.ts`
Extract:
- order service
- job service
- state machine
- targeting
- timing helpers

### 2.4 Add explicit indexes
Maintain indexes for:
- plot by id
- plot by coordinate
- object by id
- NPC by id
- job by id/state

### 2.5 Add simulation clock abstraction
Do not keep tying gameplay timing directly to ad hoc wall-clock reads.

### 2.6 Separate orchestration from domain rules
Keep domain logic pure where possible. Move orchestration into services.

---

## Phase 3 — Persistence Migration to SQLite

## Objectives
- replace monolithic JSON snapshot persistence
- make state queryable, migration-safe, and scalable

## Tasks

### 3.1 Define repository interfaces first
Repositories such as:
- world
- players
- plots
- plot detail
- NPCs
- jobs

### 3.2 Implement SQLite adapter
Add:
- transactions
- indexes
- migrations
- durable writes

### 3.3 Add JSON import path
One-time import from current `world_state.json`.

### 3.4 Add persistence integration tests
Verify:
- load
- save
- claim persistence
- object clear persistence
- order persistence
- NPC persistence across restart

### 3.5 Benchmark before/after migration
Specifically compare:
- clone cost
- write cost
- save queue depth
- mutation throughput

---

## Phase 4 — Protocol, Contracts, and Time-Sync Hardening

## Objectives
- reduce server/client drift
- harden wire contracts
- remove fragile timing assumptions from motion presentation

## Tasks

### 4.1 Split protocol concerns
Separate:
- domain types
- wire types
- schemas
- DTO builders

### 4.2 Create canonical protocol artifacts
Generate:
- JSON schema
- fixture payloads
- message reference docs

### 4.3 Improve client envelope validation
Validate envelopes and reject broken payloads cleanly in dev mode.

### 4.4 Formalize protocol versioning
Document versioning rules and compatibility expectations.

### 4.5 Add server-time/client-time alignment
This is new and now important.

Implement one of:
- server time offset estimation
- regular `server_now_ms` sync
- remaining-duration-based interpolation contract
- or another explicit motion timing contract

Goal:
- remove dependence on unsynced client wall-clock for NPC tween timing

### 4.6 Add motion-presentation contract tests
Verify:
- movement timing data is coherent
- client interpolation does not break under realistic clock offset
- fallback behavior is defined for missing timing fields

### 4.7 Move toward server-driven capabilities
Continue moving action availability out of hardcoded UI assumptions.

---

## Phase 5 — Client Architecture Refactor

## Objectives
- break up large client hotspot files
- reduce coupling across UI, networking, and world rendering
- preserve benchmarkability during refactors

## Tasks

### 5.1 Split `HUD.gd`
Break into:
- session/login controller
- status/top bar presenter
- local plot UI controller
- orders controller
- debug controller
- popup/context controller

### 5.2 Split `OwnedPlotDetailRenderer3D.gd`
Break into:
- ground renderer
- object renderer
- NPC renderer
- overhead-label source
- selection visual manager
- later: motion/interpolation presenter

### 5.3 Reduce `GameWorld3D.gd` scope
Move out:
- world state store
- mode controller
- selection model
- local transition coordinator where helpful

### 5.4 Improve scene wiring
Reduce brittle root-path lookups and prefer explicit composition references.

### 5.5 Make UI updates more event-driven
Reduce per-frame work outside truly visual paths.

### 5.6 Keep instrumentation stable during refactors
Do not lose benchmark comparability while reorganizing code.

---

## Phase 5.5 — Animation, Asset, and Presentation Pipeline Hardening

## Objectives
- make the new animation foundation durable
- reduce asset/import fragility
- prepare presentation systems for scale

## Tasks

### 5.5.1 Wrap imported NPC visuals in canonical scenes
Replace raw GLB preload usage with wrapper scenes, for example:
- `NpcScavengerVisual.tscn`

Wrapper scenes should own:
- imported model instance
- canonical label anchor
- animation mapping metadata
- material overrides
- future LOD hooks

### 5.5.2 Define animation contract explicitly
Do not rely long-term on raw clip names embedded directly in code.

Introduce one of:
- exported clip references
- actor-local animation config resource
- metadata-driven state map

### 5.5.3 Introduce presentation-state mapping
Separate raw server gameplay state from client presentation state where appropriate.

Example:
- gameplay state -> presentation state -> animation/effect selection

This makes future gameplay-state changes less likely to break art behavior.

### 5.5.4 Harden label-anchor contract
Do not depend long-term on imported model child lookup like `"Head"` as the only anchor path.

Use canonical wrapper-scene anchors.

### 5.5.5 Add effect budgeting / pooling
For smoke and future one-shot effects:
- pooled spawner or effect manager
- quality scaling
- burst budget

### 5.5.6 Add deterministic visual variation
Seed rubble/object visual offsets/rotations by object id so rebuilds stay visually consistent.

### 5.5.7 Clean asset hygiene
- remove duplicate/unused NPC assets
- define canonical referenced visuals
- keep generated/import cache out of handoff archives

---

## Phase 6 — Testing Strategy Upgrade

## Objectives
- protect correctness during heavy refactors
- add confidence around timing, presentation, and persistence

## Tasks

### 6.1 Expand unit tests
Add coverage for:
- world generation/query helpers
- order validation
- NPC state transitions
- timing helpers
- protocol transforms

### 6.2 Add integration tests
Add message-flow tests for:
- hello/login
- request world
- claim plot
- clear plot object
- issue order
- cancel order
- reconnect

### 6.3 Add persistence tests
Verify:
- restart safety
- migration behavior
- transaction failure handling

### 6.4 Add Godot-side tests
Use GdUnit4 or focused script tests for:
- wire adapters
- presentation-state helpers
- label/selection formatting
- actor snapshot application logic where practical

### 6.5 Add motion/clock tests
Verify client interpolation behavior under:
- zero offset
- positive clock skew
- negative clock skew
- missing timing fields

### 6.6 Add benchmark regression checks
At minimum, automatically validate:
- benchmark scenarios run
- output files are produced
- regression thresholds are tracked

---

## Phase 7 — Documentation Restructuring

## Objectives
- reduce ambiguity
- make canonical truth easy to find
- include benchmarking and presentation-pipeline docs

## Tasks

### 7.1 Promote canonical docs
Add/maintain:
- architecture overview
- roadmap
- GDD summary
- metrics guide
- benchmarking guide
- presentation pipeline guide

### 7.2 Archive non-canonical docs
Move AI handover and old milestone docs into archive sections.

### 7.3 Add ADRs
Create ADRs for:
- server authority
- shell/detail split
- SQLite adoption
- benchmark-first workflow
- time-sync strategy
- asset-wrapper strategy
- effect-budget strategy

---

## Phase 8 — Gameplay-System Readiness Refactors

## Objectives
prepare the architecture for:
- construction
- inventories/resources
- hauling/logistics
- pathfinding/reservations
- broader NPC role sets
- neighborhood/public-detail rendering

## Rules
- do not bolt future systems into current hotspot files
- do not weaken privacy/data-boundary rules
- do not bypass the new timing/presentation contracts
- do not let content imports become direct gameplay dependencies

---

## Updated Benchmark Priorities

The most likely current bottlenecks are:

1. `broadcastPlotUpdate` fan-out
2. JSON snapshot clone/save cost
3. NPC tick scans / repeated `.find(...)`
4. overhead label pipeline:
   - `HUD._process`
   - `get_npc_overhead_label_entries`
   - `sync_labels`
5. local renderer NPC/object sync churn
6. dense local tween/animation workload
7. repeated smoke/effect bursts
8. local mode enter/exit transition cost

---

## Updated Milestones

## Milestone B0 — Baseline Metrics and Stress Harness
- benchmark mode
- seeder
- load harness
- benchmark matrix
- persisted results
- baseline report

## Milestone R1 — Foundation Cleanup
- reproducible setup
- endpoint config cleanup
- immediate correctness fixes
- repo noise cleanup
- README rewrite

## Milestone R2 — Observability
- modular metrics wrappers
- server logging
- server metrics
- client dev performance overlay
- profiler workflow

## Milestone R3 — Server Architecture Split
- `index.ts` slimmed down
- `world.ts` split
- `npc.ts` split
- indexes added
- simulation clock introduced

## Milestone R4 — Persistence Migration
- repository layer
- SQLite schema
- migrations
- JSON import
- persistence tests

## Milestone R5 — Contracts and Time Sync
- protocol split
- canonical artifacts
- client envelope validation
- time-sync / motion contract
- contract tests

## Milestone R6 — Client Architecture Split
- `HUD.gd` split
- `OwnedPlotDetailRenderer3D.gd` split
- `GameWorld3D.gd` scope reduced
- event-driven improvements

## Milestone R6.5 — Presentation Pipeline Hardening
- wrapper scenes for imported visuals
- animation contract cleanup
- label-anchor hardening
- effect budget/pooling
- deterministic visual variation
- asset hygiene cleanup

## Milestone R7 — Testing Expansion
- integration tests
- Godot-side tests
- timing/clock tests
- benchmark regression checks

## Milestone R8 — Documentation and Readiness
- canonical docs
- archived non-canonical docs
- ADRs
- ready for broader city systems

---

## What Not to Do

1. do **not** skip baseline benchmarking
2. do **not** add more gameplay systems before measuring current hotspots
3. do **not** keep raw imported art assets as de facto gameplay contracts
4. do **not** rely on local machine wall clock for long-term motion sync
5. do **not** let one-shot effects or labels grow without budgets
6. do **not** keep adding behavior into `HUD.gd`, `GameWorld3D.gd`, `OwnedPlotDetailRenderer3D.gd`, `index.ts`, `world.ts`, or `npc.ts`

---

## Final Recommendation

The earlier plan remains valid.  
The latest archive does not require a new direction — it requires a more complete one.

### The most important additions are:
- benchmark animated/label/effect scenarios now
- harden the animation/content pipeline
- add time-sync for NPC interpolation
- add effect and label budgeting
- stop depending on raw imported asset structure

That will let the new animation foundation scale instead of becoming a new source of fragility.
