# Cozy Chaos City — Project Summary and Deep Audit

## 1. Executive summary

**Verdict:** this is **not** a throwaway prototype and **not** a spaghetti disaster. The project already has several strong professional foundations:

- a **server-authoritative architecture**
- an explicit **protocol contract**
- meaningful **domain separation** between world / NPC / hauling / manufacturing
- a good early focus on **debugging and observability**
- enough tests and tooling on the server to show engineering intent

That said, it is **not future-proof yet**.

The project’s biggest long-term risks are not “wrong game direction” risks. They are **architecture scaling risks**:

1. **Whole-world JSON persistence**
2. **Scan-heavy data access patterns**
3. **Per-unit haul jobs**
4. **Very large god-files in both client and server**
5. **Pathing/navigation that will not scale with plot size, NPC count, or content complexity**
6. **Client controller/render layers becoming too coupled to protocol payload shape**

So my professional recommendation is:

- **Do not rewrite the entire project from scratch**
- **Do refactor several core subsystems aggressively before adding a lot more content**
- **Do redesign persistence, indexing/querying, hauling tasks, and navigation/pathing before scale locks you in**

If this were a real studio project, I would call this:

> **A strong prototype architecture with several production-hostile internals that should be corrected now, while the project is still small enough to reshape safely.**

---

## 2. What the project currently is

## Game summary

From the docs and current code, this is a **server-authoritative multiplayer cozy-chaotic citybuilder / logistics sim** where the player acts more like a manager/initiator than a direct RTS hand. NPCs are the actual workers and embodied agents. The tone is intentionally messy, indirect, and systemic: bureaucracy, logistics friction, hauling, storage, workstations, rubble clearing, plot development, and later city growth.

The strongest design identity is:

- **people, not belts**
- **indirect control**
- **simulation-led progression**
- **plot-by-plot growth**
- **multiplayer with server truth**
- **debuggable systemic gameplay**

That is a very good identity. It is distinct.

## Technical summary

Current stack and structure:

- **Client:** Godot 4.6 project
- **Server:** Node.js + TypeScript + WebSocket
- **Validation:** Zod
- **Persistence:** debounced JSON world snapshot
- **Testing:** Vitest present for core server systems
- **Lint/typecheck:** working and clean
- **Networking model:** explicit typed client/server messages, server-auth, client renders filtered projection
- **Save snapshot:** already contains multiple claimed plots, NPCs, jobs, workbenches, dump zones, loose items, rubble, etc.

This is enough to continue development. You do **not** need a huge technology pivot to make progress. But you **do** need stronger data architecture and simulation architecture.

---

## 3. Overall professional assessment

## What is already good

### 3.1 Server-authoritative direction
This is the correct choice for this kind of game. You are already protecting yourself against a large class of future problems:

- desync drift
- client cheating
- inconsistent simulation rules
- multiplayer reconciliation nightmares
- UI accidentally becoming the game logic

That foundation is worth preserving.

### 3.2 The protocol is explicit
`server/src/protocol.ts` is one of the strongest files in the project. This is good engineering. It gives you:

- a real contract
- schema validation
- safer client/server evolution
- better debugging
- clearer payload ownership

Many prototypes skip this and regret it later. You did not.

### 3.3 The project already thinks in systems
The code is not just “make it work” glue. It already has concepts for:

- plot state
- owned plot detail
- NPC tasking/state
- hauling/reservations
- manufacturing queues/buffers
- player claim/session identity
- filtered client views
- metrics/debug overlays

That means the architecture has a real backbone.

### 3.4 Debug tooling exists early
This is better than average. The project already has:

- server dev metrics
- packet-size awareness
- plot debug overlay
- NPC labels / status
- several scene-level debug affordances

That is a very good sign.

---

## What is not good enough yet

### 3.5 The code is smart in intent, but not yet smart enough in structure
There is a lot of thoughtful code here, but also too much code that still relies on:

- repeated scans over arrays
- giant files with many responsibilities
- direct mutation from many directions
- plot data structures not optimized for query frequency
- logic coupling between simulation and representation

That is the gap between “good prototype” and “future-proof production foundation.”

### 3.6 Performance is currently acceptable only because scale is tiny
The current save snapshot is already a warning sign:

- only a few detailed plots
- only a few NPCs
- yet **hundreds of jobs** already exist, mostly queued haul + scavenge jobs

That means your current algorithms are still surviving because the world is small, not because they are intrinsically scalable.

### 3.7 The project needs subsystem refactors before content explosion
If you add lots of new items, buildings, recipes, NPC types, world size, and multiplayer concurrency **before** refactoring internals, you will make the eventual cleanup much more expensive.

---

## 4. The biggest risks

## Risk 1 — whole-world JSON persistence is a hard future blocker

`server/src/storage/persist.ts` currently deep-clones the world using JSON serialization and writes the whole world snapshot back to disk.

That is okay for a prototype, but it becomes a major bottleneck when any of these grow:

- world size
- plot count
- object count
- item count
- job count
- save frequency
- player concurrency

### Why this is dangerous

- Save cost scales with **everything**, not just what changed
- The clone is expensive
- The write is expensive
- The memory churn is expensive
- Large saves become a source of hitches and instability
- Corruption risk management becomes more important as files grow

### Professional recommendation

Move to one of these:

#### Best near-term option
**SQLite with WAL mode** as the persistent storage layer.

This gives you a much stronger base without operational complexity. SQLite’s WAL mode is designed to improve concurrency characteristics, including letting readers proceed while writes go to the WAL, which is a very pragmatic fit for small-to-mid multiplayer backends. ([sqlite.org](https://sqlite.org/wal.html))

#### Later-scale option
**PostgreSQL** if you outgrow single-node simplicity or want richer operational tooling.

### My recommendation
Do **not** jump straight to Postgres unless you already know you will need multi-service deployment, remote hosting complexity, admin tools, or significant analytics. For your current stage, **SQLite is the correct professional upgrade**.

---

## Risk 2 — scan-heavy data access patterns

This is the second major blocker.

Across server files, I repeatedly saw patterns like:

- `find(...)` over `detail.cells`
- `find(...)` over `plot_objects`
- full scans of loose items
- full scans of jobs
- repeated recomputation of relationships that should be indexed

This is acceptable for tiny worlds. It is not acceptable for a simulation game that intends to scale.

### Why this matters

In sim/citybuilder/server code, performance death usually comes from:

- not one giant expensive thing
- but **many medium-cost lookups repeated constantly**

That is exactly the pattern you are drifting into.

### Professional recommendation

Introduce a real **in-memory indexed query layer** per plot and per world.

At minimum, keep indexes for:

- cells by coordinate
- plot objects by id
- plot objects by kind
- plot objects by occupied tile
- loose items by id
- loose items by tile
- loose items by item kind
- jobs by id
- jobs by status
- jobs by kind
- jobs by NPC
- jobs by source/destination reference
- NPCs by id
- NPCs by state
- reservations by target

This one change will improve:

- performance
- correctness
- code clarity
- cancellation logic
- debugging
- future features

---

## Risk 3 — per-unit haul jobs

This is one of the clearest architectural problems in the current project.

The hauling system creates haul jobs in proportion to item quantity. In practice that means a stack of items can become many jobs.

This is the wrong long-term model.

### Why it is dangerous

It causes explosion in:

- job count
- save size
- sync payload size
- reconciliation cost
- cancellation complexity
- pathing churn
- UI clutter
- bug surface area

Your current save already shows the symptom: a very small world generating a surprisingly large queued job count.

### Correct long-term model

Use **task-level hauling**, not **unit-level hauling**.

A haul task should represent something like:

- move up to X quantity of item A
- from source S
- to destination D
- under reservation rules R

Then NPCs reserve quantities against that task.

This is how you avoid task explosion.

---

## Risk 4 — giant domain files

The project has several oversized files that are no longer healthy.

### Most notable server files
- `server/src/core/world.ts` — ~1900 lines
- `server/src/core/npc.ts` — ~1800 lines
- `server/src/index.ts` — ~1000 lines
- `server/src/core/hauling.ts` — ~800+ lines

### Most notable client files
- `client/scripts/world/OwnedPlotDetailRenderer3D.gd` — ~1000+ lines
- `client/scripts/ui/HUD.gd` — ~800+ lines
- `client/scripts/ui/PlotDebugOverlay.gd` — ~700+ lines
- `client/scripts/world/GameWorld3D.gd` — ~500+ lines
- `client/scripts/net/NetClient.gd` — ~500+ lines

These are not automatically “bad,” but at this size they become:

- harder to refactor
- harder to test
- harder to onboard into
- easier to break indirectly
- slower to reason about
- harder to assign to multiple developers safely

### Professional recommendation

Refactor by domain ownership, not by “misc utilities.”

For example:

#### `world.ts` should become
- `world_model.ts`
- `plot_generation.ts`
- `plot_queries.ts`
- `plot_objects.ts`
- `loose_items.ts`
- `reservations.ts`
- `world_migrations.ts`
- `starter_plot_templates.ts`

#### `npc.ts` should become
- `npc_state_machine.ts`
- `npc_task_selection.ts`
- `npc_movement.ts`
- `npc_navigation.ts`
- `npc_carrying.ts`
- `npc_recovery.ts`

#### `HUD.gd` should become
- `HUDRoot.gd`
- `HUDConnectionPanel.gd`
- `HUDOrdersController.gd`
- `HUDSelectionController.gd`
- `HUDDebugController.gd`
- `HUDNotifications.gd`

This is the kind of refactor that makes future work cheaper.

---

## Risk 5 — navigation/pathing will not scale

Current NPC movement/pathing is understandable and serviceable for the current prototype, but not future-proof.

The problem is not that it is “wrong.” The problem is that it is **too expensive per decision** and too tightly mixed into broader NPC logic.

### Current issues

- repeated BFS-style searches
- repeated tile lookups via array scans
- no strong navigation cache/index model
- no explicit occupancy service
- no proper path cost ownership separation
- movement/pathing logic and work logic are too mixed

### Why this matters

As soon as you increase:

- plot size
- obstacle density
- number of object types
- number of NPCs
- number of simultaneous jobs

pathing becomes one of the first major CPU hotspots.

### What industry normally does

For games like this, teams commonly use:

- **grid-based A\*** or similar for tile worlds
- cached occupancy/walkability grids
- connected-component or reachability caches
- dynamic obstacle invalidation
- path request throttling
- “good enough” short-range fallback paths
- hierarchical pathing if worlds get large

For Godot-side rendering/perf, Godot’s own docs repeatedly emphasize profiling first, using the profiler and custom performance monitors, and being careful with path/navigation cost and node overhead. ([docs.godotengine.org](https://docs.godotengine.org/en/4.4/tutorials/performance/general_optimization.html))

### Professional recommendation

Do not overengineer into fancy navmesh territory yet. For your game:

- use a **grid navigation service**
- keep an indexed occupancy map per plot
- use **A\*** on that grid
- cache common route computations
- separate path request generation from the NPC state machine
- invalidate only affected regions when objects change

That is the sane professional middle ground.

---

## Risk 6 — the client is drifting toward controller bloat

The Godot client has a lot of good structure, but the key orchestration files are getting too big and too responsible.

The main smell is not scene structure. The main smell is **control concentration**.

Examples:

- `HUD.gd`
- `NetClient.gd`
- `GameWorld3D.gd`
- `OwnedPlotDetailRenderer3D.gd`

These scripts currently do too much at once.

### Why it matters

On the client, the first thing that becomes unmaintainable is often not rendering but **state wiring**:

- who owns the selected plot?
- who reacts to connection changes?
- who converts protocol payloads into scene state?
- who owns debug UI?
- who triggers request messages?
- who owns visual entity lifecycle?

You are approaching that point.

### Professional recommendation

Introduce a proper split between:

- **transport**
- **protocol adapters**
- **client session state**
- **view-model / presentation state**
- **scene-specific renderers**

This is especially important if more UI and more game modes are coming.

---

## 5. World generation and plot generation review

## Current state

The current “world generation” is lightweight and deterministic. It is not inefficient in the computational sense. It is actually relatively cheap.

But it is also not yet a real content-generation pipeline.

What you currently have is closer to:

- deterministic plot graph / module growth
- starter plot initialization
- owned plot detail instantiation
- hardcoded object placement patterns
- hardcoded rubble and scaffolding of early gameplay

That is a good prototype technique.

## Is it inefficient?
**No, not yet.** The current world/plot generation is **not** your current performance problem.

## Is it future-proof?
**Also no.**

### Why not

Generation logic is embedded too deeply in general world code. That creates problems later:

- hard to swap templates
- hard to create multiple biome/plot archetypes
- hard to version/migrate generated layouts
- hard to support seasonal/event variants
- hard to tune progression balance without code edits
- hard to test generation in isolation

## What industry normally does

For this genre, teams commonly separate generation into layers:

### Layer 1 — macro world shell
- deterministic seed
- region/plot ownership
- roads/adjacency/zone identity
- cheap data, no heavy local detail

### Layer 2 — local plot template
- plot archetype
- starter object placements
- spawn markers
- blocked cells
- allowed expansions
- resource distributions

### Layer 3 — runtime simulation detail
- jobs
- loose items
- NPC runtime state
- station queues
- temporary reservations

That separation matters a lot.

## Professional recommendation

### Keep
- deterministic generation
- simple server-authoritative ownership of generated data
- plot-based decomposition

### Change
- move starter plot/object placement into **data-driven templates**
- introduce **plot archetype definitions**
- split “generated baseline” from “runtime mutable state”
- add **generator versioning** so old saves can migrate cleanly

### Do not do
- do not rush into complex procedural terrain/noise systems unless the design truly needs it
- do not confuse “more random” with “better generation”

For this game, the strongest generation approach is likely:

> **structured, authored procedural generation with templates and decorators**, not raw procedural chaos.

That fits the design.

---

## 6. Server/client separation review

## This part is directionally strong

The project already makes the correct big distinction:

- server owns simulation truth
- client receives filtered render state
- owner-only detail is protected
- client is not pretending to be authoritative

That is correct and should remain non-negotiable.

## What should be improved

### 6.1 Introduce clearer application/service boundaries on the server
Right now message handlers still mutate domain state too directly.

A more future-proof pattern is:

- message handler validates command
- application layer interprets command
- domain services mutate state
- repositories persist state
- projection layer builds client-safe views

This gives you:

- testability
- replayability
- easier auth checks
- easier undo/compensation
- cleaner logs

### 6.2 Introduce client-side view models
The client should not have to know too much about raw server DTO shapes everywhere.

Use adapters or local model classes for:

- plot summary view data
- plot detail presentation state
- NPC presentation state
- selected-object state
- workstation state

That makes protocol evolution safer.

---

## 7. Performance, metrics, and debug tooling

## What is already good

### Server
- custom dev metrics exist
- payload size awareness exists
- timing hooks already appear in key places
- explicit save timing exists

### Client
- plot debug overlay exists
- network state is visible
- debug selections are available
- NPC visual state can be observed

This is above-average prototype discipline.

## What is missing

### 7.1 Systematic performance budgets
You should define budgets for:

- server tick duration
- path request duration
- haul sync duration
- projection build duration
- packet sizes
- client frame time
- client plot render rebuild time

Without budgets, perf work becomes vague.

### 7.2 Stronger Godot instrumentation
Godot exposes performance monitors and supports custom monitors; use them. The engine documentation recommends profiling rather than guessing, and custom monitors are a clean fit for sim/debug views. ([docs.godotengine.org](https://docs.godotengine.org/en/4.4/tutorials/performance/general_optimization.html))

Track things like:

- frame time
- draw calls
- nodes in scene tree
- active loose item visuals
- active NPC visuals
- plot rebuild duration
- packet decode duration
- sync-to-render latency

### 7.3 Structured server logging
Move from mostly ad hoc logs to structured logs with categories:

- auth
- connection
- command
- simulation
- persistence
- pathing
- hauling
- manufacturing
- projection
- payload

### 7.4 Benchmark scenarios
Create repeatable scenarios:

- 1 plot / 2 NPCs
- 5 plots / 20 NPCs
- 20 plots / 100 NPCs
- high loose-item density
- high haul-task pressure
- blocked-path scenario
- mass station activity

Then record metrics over time.

---

## 8. File-by-file and area-by-area audit

I read the repository recursively. Below is the practical audit grouped by subsystem, with explicit notes on the materially relevant files.

## 8.1 Root / setup / repo

### `README.md`
Good as project entry. Should be tightened into:
- what the project is
- how to run client/server
- current milestone
- known limitations
- debugging commands
- save format and migration policy

### `CHANGELOG.md`
Good to have. Keep it disciplined and high signal.

### `HANDOVER_SUMMARY.txt`
Useful for transition context. Good for human continuity, not a substitute for technical docs.

### Existing audit/plan markdown files in root
These are actually useful and broadly aligned with the conclusions above. That is a positive sign: the project is introspective.

### Repo structure
Overall sensible:
- `client/`
- `server/`
- `docs/`

That is fine.

---

## 8.2 Server setup and tooling

### `server/package.json`
Good scripts:
- `dev`
- `build`
- `typecheck`
- `lint`
- `test`

This is enough for current stage.

### `server/tsconfig.json`
Strict TypeScript is the right choice.

### `server/.eslintrc.cjs`
Solid baseline, but turning off `no-explicit-any` should be revisited. The biggest offenders are connection/message edges, which are precisely the places where you want stronger typing.

### Recommendation
Add:
- CI pipeline
- test coverage reporting
- performance benchmark script
- schema compatibility test between client and server protocol expectations

---

## 8.3 Server core files

### `server/src/config.ts`
Good central config.  
Needs:
- environment-driven config
- separation of dev/staging/prod values
- no hidden production assumptions in source

### `server/src/protocol.ts`
**One of the best files in the project.**

Strengths:
- explicit schemas
- strong contract
- clean mental model
- safe message boundaries

Recommendation:
- keep this as a first-class API contract module
- eventually generate shared protocol types into a client-consumable package to reduce duplication risk

### `server/src/core/client_view.ts`
Also strong.

Strengths:
- correct idea: build client-safe projections
- owner filtering is a very good call
- projection timings are useful

Risks:
- projection cost will grow with scan-heavy source structures
- payload building should eventually rely on indexed/query-friendly world data

### `server/src/core/players.ts`
Good handling of identity and reconnect logic.

Strength:
- avoids sloppy session logic

Recommendation:
- formalize player/session/auth types and event logging more strongly later

### `server/src/core/presence.ts`
Simple and fine.

### `server/src/storage/persist.ts`
**Needs redesign.**

Strength:
- atomic temp-write rename pattern is good
- debouncing is sensible
- timing metrics are good

Major flaw:
- full-world clone and write

This should be replaced.

### `server/src/core/dev_metrics.ts`
Good prototype observability layer.

Recommendation:
- keep it, but evolve into a more structured metrics registry
- expose sampled metrics for HUD/debug client if useful

---

## 8.4 `server/src/core/world.ts`

This is a high-value file with good ideas and bad scale properties.

### What is good
- authoritative world ownership
- stable plot identity model
- lazy owned-plot detail init
- migration helpers exist
- useful world/plot concepts are present
- starter progression is embodied in real systems

### What is bad
- too many responsibilities
- too many flat-array scans
- generation logic mixed with live world mutation
- object/item/cell/job concerns intermixed
- ID generation and query patterns are not scalable

### Professional judgment
This file should **not** be “cleaned up gradually forever.”  
It should be **deliberately split** in a focused refactor.

### Redo level
**Moderate-to-high refactor required.**  
Not a rewrite-from-zero, but definitely a structural redo.

---

## 8.5 `server/src/core/npc.ts`

This is one of the most important files in the project, and one of the most dangerous to leave as-is for too long.

### What is good
- real state-machine thinking
- good comments
- server-owned NPC truth
- solid gameplay intent
- recovery logic exists
- tasking feels thought through

### What is bad
- too large
- too entangled
- movement/pathing/work logic too mixed
- difficult to test in isolated slices
- future behavior additions will create branching complexity

### Professional judgment
The code is not dumb. It is actually fairly thoughtful. But it is becoming too dense.

### Redo level
**High-priority refactor required.**

Not because it is bad today, but because it will become the project’s most expensive file to evolve.

---

## 8.6 `server/src/core/hauling.ts`

This subsystem is conceptually right but structurally wrong for scale.

### What is good
- you identified hauling as its own system
- reservations exist
- manufacturing integration exists
- destination priority logic exists

### What is bad
- per-unit jobs
- scan-heavy reconciliation
- likely over-churn in job sync
- too much state explosion potential

### Professional judgment
This is one of the first systems I would redesign.

### Redo level
**Yes, this should be substantially redone.**

Keep the gameplay intent. Replace the task model.

---

## 8.7 `server/src/core/manufacturing.ts`

This is cleaner than some other server systems.

### What is good
- explicit recipes
- clear station state model
- queue and active craft are understandable
- good candidate for content scaling

### What is bad
- still too tied to runtime object shapes
- content registry not mature yet
- some future coupling risk with hauling/input/output management

### Professional judgment
Refactor, but not urgently compared to persistence / hauling / navigation.

---

## 8.8 `server/src/index.ts`

This file is doing too much, even though it is fairly readable.

### What is good
- startup path is understandable
- connection flow is understandable
- heartbeat logic exists
- broadcast/update logic exists
- payload warnings are a good habit

### What is bad
- too many responsibilities in one entrypoint
- command handling, connection handling, scheduling, mutation, persistence triggers, and broadcasting are too close together
- typed boundaries could be stronger

### Recommendation
Split into:
- server bootstrap
- connection/session manager
- message router
- command handlers
- simulation scheduler
- broadcast/projection dispatcher

---

## 8.9 Server tests

There are meaningful tests for major subsystems, which is good.

### What this means professionally
The project is not relying purely on manual playtesting. Good.

### What should improve
Add tests for:
- migrations
- persistence schema/version transitions
- haul-task aggregation
- path obstruction edge cases
- projection filtering
- reconnect / stale session handling
- large save/load scenario
- performance guardrails for pathological job counts

---

## 8.10 Client network layer

### `client/scripts/net/NetClient.gd`
A strong prototype file with too many concerns.

### What is good
- explicit request API
- websocket lifecycle handling
- heartbeat
- status handling
- profile/load integration
- some packet-size awareness

### What is bad
- too large
- transport + session + protocol decode + UI-facing state all mixed
- hardcoded server URL in source is not acceptable long-term

### Recommendation
Split into:
- `WebSocketTransport.gd`
- `ClientProtocolAdapter.gd`
- `ClientSession.gd`
- `ConnectionState.gd`

### `client/scripts/net/WireAdapters.gd`
Good idea. Keep and grow it.

### `client/scripts/net/ProfileStore.gd`
Fine, but should be made slightly more robust.

---

## 8.11 Client world and rendering

### `client/scripts/world/GameWorld3D.gd`
Important orchestration file.

### Good
- central world-shell controller makes sense
- plot/world mode transitions are understandable
- scene ownership is coherent

### Bad
- too much state coordination
- too much selection/camera/render wiring in one place

### Recommendation
Split responsibilities into:
- world state controller
- plot mode controller
- camera mode coordinator
- selection coordinator

---

### `client/scripts/world/OwnedPlotDetailRenderer3D.gd`
This is currently the largest client architectural smell.

### Good
- it does solve a real problem: plot detail sync/render lifecycle
- object spawning and NPC visualization work are centralized

### Bad
- too many responsibilities
- data adaptation + lifecycle + scene management + terrain/material logic are mixed
- likely to become brittle with more object types and plot features
- ground texture setup still shows placeholder-style wiring

### Recommendation
Split into:
- `PlotDetailStateAdapter.gd`
- `PlotObjectRenderer.gd`
- `LooseItemRenderer.gd`
- `PlotGroundRenderer.gd`
- `PlotNpcRenderer.gd`

This file should be refactored before content breadth doubles.

---

### `client/scripts/world/PlotRenderer3D.gd`
Seems appropriately scoped.

### `client/scripts/world/PlotTile3D.gd`
Fine as a scene element, assuming not over-instanced beyond reason.

### `client/scripts/world/SelectionDecal.gd`
Fine.

### `client/scripts/world/CameraRigBasic.gd`
Reasonably scoped and healthy.

### `client/scripts/world/actors/OwnedPlotNpcActor3D.gd`
Large, but mostly cohesive. This is presentation logic, which is okay to be somewhat dense as long as it stays presentation-only.

### Recommendation
Keep, but guard against simulation leakage into it.

---

## 8.12 Client UI

### `client/scripts/ui/HUD.gd`
This should be split.

### Good
- practical prototype velocity
- central UI flow is easy to get working this way

### Bad
- too much orchestration
- too much dependency knowledge
- too much menu/selection/network coupling
- will become painful as more panels are added

### Recommendation
This is a classic “works well until it suddenly doesn’t” file. Refactor soon.

---

### `client/scripts/ui/PlotDebugOverlay.gd`
Large but justified.

### Good
- debug tools are valuable
- visibility into sim is excellent for this genre

### Bad
- formatting, data extraction, and view logic are too close together

### Recommendation
Refactor, but this is not as urgent as `HUD.gd` or `OwnedPlotDetailRenderer3D.gd`.

---

### Other UI scripts
Files such as:
- `BottomActionBar.gd`
- `OrdersMenuPanel.gd`
- `NpcCharacterSheet.gd`
- `InteractionHintLabel.gd`
- `OrderPickerOverlay.gd`

These generally look reasonable and modular enough for current stage.

---

## 8.13 Client local object / item visual scripts

Files like:
- `LooseItemStack.gd`
- `LooseItemStackVisual.gd`
- `DumpZone8x8.gd`
- `WorkbenchStation.gd`
- `StaticItemModelVisual.gd`
- item-specific visual wrappers

These are generally okay. The main risk here is not logic quality but potential **asset/scene proliferation** and **manual scene wiring cost** over time.

### Recommendation
As item/building variety increases, introduce a small **data-driven visual registry** so you do not need one-off scene logic everywhere.

---

## 8.14 Godot scenes

I reviewed the scene structure and accompanying scripts.

## Healthy patterns
- scenes are decomposed reasonably
- root composition is understandable
- item visuals are separated into reusable scenes
- world/NPC/building scenes are not absurdly entangled

## Risks
- too many near-identical scene wrappers over time
- renderer/controller scripts are becoming the real complexity center
- test/dev scenes should be clearly excluded from shipping build paths

### Recommendation
Keep the scene approach, but improve:
- scene naming consistency
- registry-based instantiation
- renderer responsibility boundaries

---

## 8.15 Documentation

The docs are actually a strength.

### Strong docs
- technical summary
- implementation roadmap
- logistics/storage docs
- milestone docs
- living design docs

### What is good
- the project has direction
- design and implementation are talking to each other
- milestones are concrete
- the docs care about architecture, not only features

### What is missing
You need a sharper distinction between:
- **current truth**
- **historical notes**
- **future ideas**
- **non-binding brainstorms**

### Recommendation
Create a docs index:

- `docs/current/`
- `docs/roadmap/`
- `docs/archive/`
- `docs/reference/`

And define one source of truth for:
- architecture
- protocol
- save schema
- current milestone
- coding standards

---

## 9. Is the code “smart”?

**Yes in design intent. Not fully in execution detail.**

That is the honest answer.

## Smart parts
- authoritative architecture
- explicit protocol validation
- projection filtering
- systemic gameplay modeling
- early metrics/debugging
- tests exist
- comments often explain intent well

## Not-smart-enough parts
- repeated array scans
- full JSON persistence
- per-unit hauling jobs
- growing monoliths
- insufficient indexing
- insufficient performance budgets
- some source-level hardcoding that should be config-driven

So I would describe it as:

> **Thoughtful prototype code written by someone making real architecture decisions, but still using several internal patterns that must be upgraded before scale.**

---

## 10. Should large parts be redone?

## Full project rewrite?
**No.**

That would be wasteful and probably harmful.

## Major subsystem redo?
**Yes, selectively.**

I would absolutely redo these areas before major content scale:

### Must redo / heavily refactor
1. **Persistence backend**
2. **In-memory indexing/query architecture**
3. **Hauling task model**
4. **NPC navigation/path query architecture**
5. **Large file decomposition**
6. **Client controller/render state split**

### Should refactor soon
7. `index.ts` server application boundaries
8. client network/session split
9. plot generation templating/data-driven structure
10. docs/source-of-truth organization

### Can stay mostly as-is for now
11. overall tech stack
12. protocol concept
13. server-authoritative model
14. general Godot scene decomposition
15. manufacturing concept, with moderate cleanup later

---

## 11. Tech stack review: is what you have enough?

## Current stack adequacy
Yes, mostly.

### Keep
- Godot for client
- TypeScript for authoritative sim server
- WebSockets
- Zod
- Vitest
- ESLint / TypeScript strictness

### Add soon
- SQLite
- CI pipeline
- benchmark harness
- shared protocol package or generated protocol types
- structured logging
- migration/versioning discipline
- performance dashboards/debug views

### Add later only if justified
- Postgres
- Redis
- worker threads or multi-process partitioning
- service decomposition

Node’s own documentation recommends `worker_threads` for CPU-intensive work when process isolation is not needed, while `cluster` is for process-level distribution. That means concurrency tools should be added only after profiling proves the server loop is CPU-bound; they are not the first fix here. Your first fixes are data structures and persistence. ([nodejs.org](https://nodejs.org/api/worker_threads.html))

---

## 12. Final professional verdict

If I were advising a real company, I would say this:

### The good news
You have a project worth investing in. The design has identity. The architecture has real merit. The codebase is not junk.

### The bad news
You are nearing the point where “prototype shortcuts” become “core architecture liabilities.”

### The most important decision
Do **not** keep layering new content and features on top of the current internal data/query/task model without refactoring it first.

### The direct recommendation
Preserve the big direction. Redo the internal simulation plumbing now.
