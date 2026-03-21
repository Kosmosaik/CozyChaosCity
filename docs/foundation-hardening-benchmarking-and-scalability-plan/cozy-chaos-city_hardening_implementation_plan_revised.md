# Cozy Chaos City — Revised Foundation Hardening Implementation Plan

_Last updated: 2026-03-20_

## Purpose

This document is a revised implementation plan for foundation hardening, benchmarking, and scalability work in **Cozy Chaos City**.

It is based on the current repo state and is designed to answer one key question:

**What should be hardened now, what should be prepared next, and what should be delayed until the game has grown enough to justify the cost?**

The goal is **not** to abandon long-term engineering discipline. The goal is to apply it in the correct order so that early development stays fast without building on fragile foundations.

---

## Current Assessment

The project is no longer at the “empty prototype” stage.

It already has real foundational systems in place:

- server-authoritative world and plot detail flow
- authoritative local orders / jobs / NPC loop
- owned-plot local rendering
- modular orders UI
- NPC presentation actor
- debounced JSON persistence
- some server-side tests

That means **some hardening is now necessary**.

However, the project is **not yet at the stage** where the full weight of broad benchmark infrastructure, full persistence migration, full architecture standardization, and wide documentation formalization should block feature progress.

So the right strategy is:

- fix fragility and correctness now
- add lightweight measurement now
- refactor based on evidence next
- pay larger scalability costs later, when scale actually appears

---

## Guiding Principles

### 1. Hardening should protect momentum, not kill it
We harden the systems that are already foundational, but we do not turn the project into process-heavy engineering theater.

### 2. Correctness before scale theater
A real timing bug, asset contract fragility, or unreliable dev environment matters more right now than a sophisticated benchmark matrix.

### 3. Measure before large refactors
Do not perform broad architectural surgery just because large files exist. Add enough instrumentation to identify the actual pain points first.

### 4. Prepare for scale before paying full price for scale
For example, define persistence interfaces and save versioning before doing a full SQLite migration.

### 5. Stop hotspot files from growing further
Even before major refactors, avoid adding more behavior into the files already identified as dangerous growth points.

---

## Priority Overview

This revised plan is split into three tracks:

- **Track A — Must Do Now**
- **Track B — Do Next, After Measurements**
- **Track C — Delay Until Scale Justifies It**

---

# Track A — Must Do Now

These tasks are worth doing immediately because they reduce real technical risk without requiring a massive rewrite.

## A1. Repo Hygiene and Reproducibility

### Why now
The repo must be clean and reproducible before deeper refactors become trustworthy.

### Problems observed
- archives contain noisy or generated content like `.git`, `node_modules`, `.godot`, temp scene files
- lint/test workflow is not consistently reproducible from a clean setup
- documentation and actual toolchain status can drift out of sync

### Goals
- clean handoff/archive quality
- clean install works consistently
- lint/test/typecheck expectations are honest and reproducible

### Tasks
- exclude generated/editor/vendor content from handoff archives
- verify package install and scripts from a clean environment
- fix toolchain execution issues so lint/test/typecheck are runnable in a normal setup
- document exact setup and validation commands in README or relevant docs
- ensure changelog / technical summary do not claim more tooling reliability than the repo currently guarantees

### Deliverables
- clean archive policy or checklist
- reproducible local setup instructions
- verified dev validation commands

### Definition of done
A new contributor or next GPT assistant can unpack the repo, install dependencies, and run the documented validation workflow without guesswork.

---

## A2. Replace Client Wall-Clock Dependency in NPC Movement Presentation

### Why now
This is one of the most important current technical risks.

NPC interpolation/presentation should not depend on unsynced client wall clock, because that creates drift, visual inconsistency, and future multiplayer headaches.

### Goals
- deterministic-looking NPC presentation across clients
- stable interpolation based on authoritative timing inputs

### Tasks
- remove dependence on local system time for movement interpolation
- introduce a simple server-time sync or movement-duration-based presentation contract
- make actor interpolation use authoritative timing information from the network layer
- verify animation state transitions still feel correct after the timing change

### Deliverables
- updated network timing contract for NPC movement presentation
- client actor interpolation based on synced/authoritative timing data

### Definition of done
NPC movement and work presentation no longer relies on unsynced client wall clock and remains visually stable across reloads and future multi-client scenarios.

---

## A3. Harden NPC Visual Asset Contract

### Why now
The actor separation is good, but it still depends on a fragile imported GLB structure and a brittle node lookup contract.

That is acceptable for a temporary art experiment, but not for a growing gameplay foundation.

### Goals
- protect gameplay code from raw imported asset structure changes
- stabilize animation and label anchor expectations

### Tasks
- wrap the raw NPC visual asset in a canonical scene
- expose explicit anchor nodes for labels / effects / future interaction markers
- define a stable animation mapping contract in one place
- update gameplay-facing actor code to depend on the wrapper scene contract, not raw asset assumptions

### Deliverables
- canonical NPC visual wrapper scene
- explicit anchor nodes and animation mapping contract
- actor code updated to use wrapper contract

### Definition of done
Changing or reimporting the raw NPC art asset does not silently break label attachment, animation lookup, or gameplay presentation code.

---

## A4. Add Lightweight Instrumentation

### Why now
The project needs numbers soon, but not a giant benchmark platform yet.

### Goals
- reveal current hotspots cheaply
- support evidence-based refactor priorities
- establish a baseline before adding more systems

### Tasks
- add lightweight timing around key server operations such as:
  - tick/update loop
  - client world snapshot building
  - plot detail payload building
  - save clone/flush timing
- add a simple dev-only client overlay or logging path for:
  - frame time
  - owned plot renderer cost indicators
  - active local visual counts when useful
- log save file size, plot counts, NPC counts, job counts during profiling runs
- keep the first version intentionally small and easy to remove or extend

### Deliverables
- minimal profiling hooks in server
- minimal dev-only client performance surface
- baseline measurement notes from a few controlled runs

### Definition of done
There is enough instrumentation to identify whether the next major split should target server tick flow, plot rendering, HUD/UI growth, or persistence cost.

---

## A5. Small Correctness and Reliability Cleanup Pass

### Why now
These are low-cost fixes with real long-term value.

### Goals
- reduce avoidable bugs
- remove small known sources of brittleness
- improve dev and handoff reliability

### Tasks
- remove duplicated network error handling branches
- move hardcoded WebSocket endpoint usage toward config / dev override flow
- sanitize profile filename handling
- verify plot enter/leave and menu/camera/UI interactions remain stable
- review obvious guardrails around local order UI state and connection recovery

### Deliverables
- cleaned-up small correctness issues
- improved environment/config handling
- reduced avoidable edge-case behavior

### Definition of done
Known small reliability issues are closed without broad rewrites, and common dev/runtime edge cases are less fragile.

---

## A6. Freeze Growth of Known Hotspot Files

### Why now
Before deep refactoring, stop making the problem worse.

### Current hotspot candidates
- `server/src/index.ts`
- `server/src/core/world.ts`
- `server/src/core/npc.ts`
- `client/scripts/ui/HUD.gd`
- `client/scripts/world/OwnedPlotDetailRenderer3D.gd`

### Goals
- prevent further architectural debt accumulation
- force new functionality into smaller focused modules where practical

### Tasks
- set a rule that new major behavior should not be added to these files unless strictly necessary
- route new logic into helper modules/services/components instead
- note temporary exceptions explicitly in changelog or technical summary when unavoidable

### Deliverables
- documented hotspot freeze rule
- evidence that new additions were redirected into smaller modules

### Definition of done
The biggest files may still exist, but they are no longer the default dumping ground for every new feature.

---

# Track B — Do Next, After Measurements

These tasks are important, but should happen **after Track A** has produced enough data to justify the first larger refactors.

## B1. Targeted File Splitting and Responsibility Cleanup

### Why next
Large files are a real concern, but the order of refactoring should be guided by measurements and pain, not by aesthetics alone.

### Candidate targets
- `server/src/index.ts`
- `server/src/core/world.ts`
- `server/src/core/npc.ts`
- `client/scripts/ui/HUD.gd`
- `client/scripts/world/OwnedPlotDetailRenderer3D.gd`

### Approach
- split by responsibility, not by arbitrary line count
- keep behavior stable while extracting clearer modules
- prefer service boundaries and explicit data contracts

### Example split directions
- `index.ts` → bootstrap, connection management, inbound message dispatch, tick orchestration, broadcast/update pipeline
- `HUD.gd` → menu state handling, orders UI, labels/debug/dev display, interaction wiring
- `OwnedPlotDetailRenderer3D.gd` → plot sync adapter, tile/object renderers, effect spawning, diff/update helpers

### Definition of done
At least one major hotspot file has been split in a way that reduces future feature friction without destabilizing gameplay.

---

## B2. Expand Benchmarking from Lightweight Instrumentation to Repeatable Scenarios

### Why next
Once instrumentation exists, repeatable benchmarks become much more useful.

### Goals
- compare before/after refactors
- expose degradation early
- create a shared language for performance discussions

### Tasks
- define a small set of repeatable scenarios such as:
  - idle owned plot
  - active scavenging on owned plot
  - multiple active NPC/job states
  - save flush under moderate world state
- store benchmark notes/results in a simple documented format
- keep the scope narrow and useful

### Definition of done
The team can rerun a small benchmark set after major changes and compare results meaningfully.

---

## B3. Introduce Save Format Versioning and Migration Hooks

### Why next
Before changing persistence backend, protect the save format itself.

### Goals
- support future schema evolution
- reduce risk when the world model grows
- prepare for backend changes without committing to them yet

### Tasks
- add explicit save schema versioning
- create migration hooks for old save formats
- define fallback/error behavior for corrupt or incompatible saves
- document what IDs/data must remain stable across save/load

### Definition of done
Save files are versioned and future schema changes can be introduced with controlled migrations.

---

## B4. Dirty-Set / Update Coalescing Strategy

### Why next
As plot and NPC activity grows, network update strategy will matter more.

### Goals
- reduce payload spam
- keep tick/broadcast behavior scalable
- prepare for richer world state updates

### Tasks
- identify which world changes should mark plots/entities dirty
- coalesce updates per tick instead of emitting overly granular updates
- introduce simple payload budgeting principles where useful

### Definition of done
The networking layer has a clearer strategy for aggregating world changes before broadcast.

---

## B5. Entity Lifecycle and Identity Contract

### Why next
As more systems get added, stable IDs and lifecycle rules become more important.

### Goals
- prevent accidental save/load inconsistencies
- make debugging and future migrations safer

### Tasks
- define what is stable across save/load and reconnects
- document lifecycle rules for plots, jobs, NPCs, starter objects, and future entities
- identify what may be regenerated versus what must persist

### Definition of done
There is a concise contract describing entity identity and lifecycle expectations across the project.

---

## B6. Dev Flags and Feature Toggles

### Why next
These improve testing, debugging, and performance analysis without major architecture changes.

### Tasks
- add toggles for labels, effects, debug overlays, dev metrics, benchmark mode, and other obvious dev-only presentation systems
- keep flags centralized and easy to discover

### Definition of done
Developers can isolate visual noise and compare performance more cleanly during testing.

---

# Track C — Delay Until Scale Justifies It

These tasks are good and likely still worth doing later, but they should **not** block current progress.

## C1. Full SQLite Migration

### Why delay
The current world size is a warning sign, but not yet enough to justify paying the migration cost immediately.

### Do now instead
- define persistence interfaces
- measure save cost and file growth
- add save versioning first

### Do later when justified
- move from whole-world JSON persistence to a more scalable backend such as SQLite
- preserve clean repository interface boundaries so the switch is controlled

### Trigger conditions
Prioritize this when one or more become true:
- save size grows rapidly with normal play
- save latency becomes user-visible or disruptive
- partial persistence/query patterns become necessary
- world scale or simulation density makes full snapshot saves too expensive

---

## C2. Full Benchmark Matrix and Performance Suite

### Why delay
A broad benchmark suite is valuable, but only after lightweight instrumentation and a few repeatable scenarios prove useful.

### Later scope may include
- scripted scenario packs
- automated benchmark output capture
- comparative historical run storage
- client and server benchmark modes

---

## C3. Broad Client Architecture Standardization

### Why delay
The client does need cleanup, but it is better to refactor based on actual growth pain rather than prematurely imposing a heavy architecture everywhere.

### Later scope may include
- more formal UI/controller/service boundaries
- broader renderer decomposition
- presentation/system layering conventions

---

## C4. Large-Scale Automated Test Expansion

### Why delay
Tests are useful, but early test strategy should be selective and high-value.

### Later scope may include
- broader server simulation coverage
- protocol contract tests
- client-side scene or scripting tests where practical
- persistence regression suites

---

## C5. ADR Rollout / Heavy Documentation Formalization

### Why delay
Documentation matters, but formal architecture records are most useful once the first major post-measurement refactors actually happen.

### Later scope may include
- ADRs for persistence, networking contracts, renderer architecture, and simulation boundaries
- stronger cross-doc consistency workflows

---

## C6. Full Effect Pooling / Advanced Rendering Budgets

### Why delay
Presentation optimization is important, but heavy pooling/budget systems can wait until there is measured pressure.

### Do now instead
- keep simple guards/caps on effect spawning
- expose toggles for debugging and testing

---

# Recommended Execution Order

## Phase 1 — Immediate Hardening Sprint
Focus only on the highest-value low-to-medium cost tasks.

1. Repo hygiene and reproducibility
2. NPC timing sync / wall-clock removal
3. NPC visual wrapper contract
4. Lightweight instrumentation
5. Small correctness cleanup
6. Hotspot file growth freeze

## Phase 2 — First Measurement Review
After Phase 1:
- run a few controlled profiling scenarios
- record basic server/client observations
- choose the first major refactor target based on evidence

## Phase 3 — First Structural Cleanup Sprint
Choose one or two of the highest-value follow-ups:
- split the most painful hotspot file
- add save schema versioning
- define entity lifecycle/identity contract
- introduce dirty-set/coalesced update strategy where it buys real value

## Phase 4 — Reassess Scale Triggers
Only after the previous phases:
- decide whether JSON persistence is still acceptable
- decide whether benchmark scope should expand
- decide whether the next refactor target is server, renderer, or UI driven

---

# What Should Explicitly Wait

To avoid over-engineering at this stage, the following should **not** be treated as blockers right now:

- full SQLite migration
- enterprise-style benchmark infrastructure
- broad architectural rewrites across the whole client
- extensive automated test expansion everywhere
- heavy ADR/documentation bureaucracy
- advanced pooling/budget systems without measured rendering pressure

These remain valid future tasks, but they should happen **because measurements and scale justify them**, not because they sound mature on paper.

---

# Suggested Branching Strategy

A practical branch sequence for this revised plan:

1. `chore/repo-hygiene-and-reproducibility`
2. `refactor/npc-timing-sync-foundation`
3. `refactor/npc-visual-wrapper-contract`
4. `dev/lightweight-performance-instrumentation`
5. `fix/client-network-config-and-reliability`
6. `refactor/<measured-hotspot-target>`

If preferred, the first five can also be grouped under one focused hardening branch, for example:

- `refactor/foundation-hardening-phase-1`

---

# Success Criteria for This Plan

This revised plan is successful if it achieves the following:

- the repo becomes easier to trust and hand over
- core NPC presentation becomes timing-stable and less fragile
- performance discussions start using real measurements instead of guesswork
- the largest files stop absorbing new unrelated behavior
- future scalability work is prepared intentionally without prematurely paying its full cost

---

# Final Recommendation

This project should **absolutely do hardening now**, but in a selective, staged way.

The correct approach is:

- **fix correctness and fragility now**
- **add lightweight measurement now**
- **refactor based on evidence next**
- **delay heavier scalability investments until they are truly justified**

That keeps the project moving while making sure future feature development rests on a stronger foundation.
