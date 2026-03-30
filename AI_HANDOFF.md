# AI_HANDOFF.md

## Project
**Cozy Chaos City**

Server-authoritative multiplayer cozy-chaotic citybuilder / logistics sim.

Core stack:
- **Client:** Godot 4.x
- **Server:** Node.js + TypeScript + WebSocket
- **Validation:** Zod
- **Tests:** Vitest
- **Current persistence:** JSON world snapshot (known temporary architecture; should be replaced)

This document is the operating brief for any AI assistant helping on the project.

---

## 1. What this game is

Cozy Chaos City is a **server-authoritative simulation-first citybuilder** with indirect control.

The player is not meant to micromanage like in a classic RTS. NPCs are the embodied workers and agents. The game identity is built around:
- people, not belts
- indirect control
- logistics friction
- plot-by-plot growth
- systemic simulation
- readable debugability
- multiplayer with server truth

The project should preserve that identity.

---

## 2. Current architectural truth

These are the current truths that should be respected unless there is a very strong reason to change them:

- The **server is authoritative** for simulation state.
- The **client is a renderer/controller** and should not own gameplay truth.
- Client/server communication should remain based on an **explicit protocol contract**.
- Owner-only and private simulation data must stay filtered correctly.
- Systems should become **more modular and more data-driven** over time.
- We do **not** want temporary slices, one-off hacks, or short-lived workarounds.
- We are optimizing for **future-proof architecture**, not just feature speed.

---

## 3. Non-negotiable engineering principles

When helping with this project, always follow these rules:

1. **No temporary hacks**
   - Do not propose band-aids if the underlying architecture is wrong.
   - If a subsystem should be redesigned, say so clearly.

2. **Preserve server authority**
   - Never move simulation truth into the Godot client unless explicitly requested for a very narrow presentation-only concern.

3. **Prefer durable architecture over speed**
   - Choose solutions that scale with more plots, more NPCs, more items, and more players.

4. **Minimize scan-heavy logic**
   - Repeated full-array scans in simulation code are a red flag.
   - Prefer indexed/queryable structures.

5. **Prefer modular subsystems**
   - Split oversized files by domain responsibility.
   - Avoid giant controller files.

6. **Prefer data-driven content**
   - New buildings, items, recipes, plot archetypes, and visuals should move toward registries/templates instead of hardcoded switch-heavy logic.

7. **Profile before guessing**
   - Performance changes should be explained in terms of actual hot paths, expected scaling, and instrumentation.

8. **Keep docs in sync with architecture**
   - Any meaningful system refactor should update the relevant docs.

---

## 4. What is already good

The assistant should recognize and preserve these strengths:

- server-authoritative simulation model
- explicit protocol/schema validation
- meaningful systemic design direction
- strong early debug mindset
- existing tests/tooling on the server
- plot-based world structure
- NPC-centered logistics gameplay

Do not casually replace these strengths with simpler but weaker patterns.

---

## 5. Known major architectural problems

These are known high-priority concerns and should be treated as real issues, not cosmetic polish:

### A. Persistence
Current whole-world JSON snapshot persistence is not future-proof.

Problems:
- full-world serialization cost
- memory churn
- save cost scales with whole world size
- increasingly poor fit as simulation complexity grows

Preferred direction:
- move to **SQLite + WAL** first
- keep JSON export/import only as a debug/backup tool if useful

### B. Scan-heavy data access
Many systems rely too much on repeated scans over arrays of cells, objects, items, and jobs.

Preferred direction:
- introduce explicit world/plot indexes
- centralize mutation ownership so indexes stay correct

### C. Hauling model
Per-unit haul jobs are not the right long-term architecture.

Preferred direction:
- replace with **aggregated haul tasks** plus explicit reservation tracking

### D. NPC architecture
NPC behavior, movement, and work logic are too concentrated.

Preferred direction:
- separate behavior selection, movement, navigation, carrying, recovery, and state machine concerns

### E. Navigation/pathing
Current pathing is acceptable for prototype scale but not future-proof.

Preferred direction:
- explicit occupancy/walkability service
- indexed grid navigation
- A* or equivalent grid pathing
- selective invalidation and caching

### F. Large multi-responsibility files
Several server and client files are too large and should be split.

---

## 6. Current priority order

Unless a task explicitly says otherwise, the next assistant should generally prioritize work in this order:

### Phase 0 — baseline discipline
- CI
- validation flow
- reproducible benchmarks
- migration policy
- performance budgets

### Phase 1 — indexing/query layer
- plot indexes
- world indexes
- explicit query APIs
- mutation ownership

### Phase 2 — hauling redesign
- aggregated haul tasks
- reservation model
- reduced task explosion

### Phase 3 — NPC/navigation refactor
- navigation service
- occupancy grid
- pathing separation
- simulation scheduling cleanup

### Phase 4 — persistence redesign
- SQLite repository layer
- migrations
- import from current JSON save format

### Phase 5 — modularization
- split oversized server files
- split oversized Godot controller/renderer files
- reduce coupling between raw network DTOs and presentation logic

### Phase 6 — generation/data pipeline
- data-driven plot archetypes
- template/versioned generation
- better separation between generated baseline and runtime mutable state

---

## 7. Known hotspots in the codebase

These areas deserve extra scrutiny before feature expansion:

### Server
- `server/src/core/world.ts`
- `server/src/core/npc.ts`
- `server/src/core/hauling.ts`
- `server/src/index.ts`
- `server/src/storage/persist.ts`

### Client
- `client/scripts/world/OwnedPlotDetailRenderer3D.gd`
- `client/scripts/ui/HUD.gd`
- `client/scripts/ui/PlotDebugOverlay.gd`
- `client/scripts/world/GameWorld3D.gd`
- `client/scripts/net/NetClient.gd`

When editing these, prefer structured decomposition over adding more responsibilities.

---

## 8. Expected assistant workflow

When asked to help with implementation, the assistant should:

1. Read the relevant docs and the affected source files first.
2. Explain the architectural context briefly.
3. Identify whether the requested change is:
   - local/safe
   - cross-cutting
   - architecture-affecting
4. If architecture-affecting, propose the right subsystem boundary before writing code.
5. Produce code that matches the long-term direction.
6. Call out tradeoffs and migration concerns.
7. Suggest related doc updates when needed.

If a requested change conflicts with the long-term architecture, the assistant should say so clearly.

---

## 9. What the assistant should avoid

Do **not** do the following unless explicitly instructed:

- do not move authoritative logic into the client
- do not add one-off special cases that bypass system rules
- do not add more scan-heavy hot-path logic
- do not grow giant files further if a split is clearly warranted
- do not propose temporary "just for now" persistence solutions
- do not hardcode content that should clearly be data-driven
- do not recommend a full rewrite unless there is a truly compelling reason

The default stance should be: **preserve what is good, redesign what blocks scale**.

---

## 10. Definition of a good solution

A good solution for this project should usually be:
- server-authoritative
- modular
- index-friendly
- testable
- migration-aware
- data-driven where appropriate
- easy to reason about
- scalable with more content and more simulation load
- documented clearly enough for future continuation

---

## 11. Files that should always be considered during handoff/use

Whenever possible, work with these together:
- the source project zip / repo
- `cozy-chaos-city-audit.md`
- `cozy-chaos-city-implementation-plan.md`
- this `AI_HANDOFF.md`

The audit explains **what is wrong and why**.
The implementation plan explains **what order to fix things in**.
This handoff file explains **how the assistant should think while helping**.

---

## 12. Immediate instruction for the next assistant

Before proposing new features, first check whether the requested work touches one of the following foundation concerns:
- indexing/query performance
- hauling/task architecture
- NPC/navigation architecture
- persistence
- oversized file decomposition
- protocol/client presentation separation

If yes, prefer improving the foundation correctly instead of stacking more feature code on top of a weak subsystem.

If a major subsystem needs to be redone, say it directly.
The project owner is open to substantial refactors when justified.

---

## 13. Final note

This project should be treated like a real production-bound simulation game, not like a throwaway prototype.

The goal is not to ship fast by cutting corners.
The goal is to build a strong base that remains healthy as the project becomes larger, more systemic, and more multiplayer-heavy.
