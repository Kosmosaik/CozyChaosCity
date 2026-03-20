# Cozy Chaos City — Updated Technical Audit (Latest Archive)

## Scope

This audit is based on a fresh recursive review of the latest uploaded archive, including:

- root repo/config files
- Godot client scripts, scenes, assets, project settings
- Node/TypeScript server code, tests, persistence, and runtime setup
- current design/milestone/technical handover docs

This version includes the newer **NPC actor animation foundation** and recent local-plot UI/debug work.

---

## Executive Summary

The latest archive is still a **good prototype foundation with the right macro architecture**, and the new animation work is a **net positive**. The project is moving in a better direction, not a worse one.

The biggest positive change since the previous audit is that the client now has a clearer **presentation-layer NPC actor**:

- `client/scripts/world/actors/OwnedPlotNpcActor3D.gd`
- `client/scenes/actors/OwnedPlotNpcActor3D.tscn`

That is the correct direction for long-term maintainability. It reduces how much the plot renderer must know about visual internals, animation players, and label anchoring. The rubble-clear smoke feedback is also a good early presentation pattern.

### Updated professional verdict

**Current state:** strong prototype / pre-foundation-hardening stage  
**Architecture quality:** above average for this stage  
**Futureproofing today:** still not strong enough for long-lived citybuilder scope  
**Risk if left as-is:** still high once simulation density and content breadth expand

### Bottom line

The earlier implementation plan is still correct in direction.  
I would **keep it**, but I would now add several specific items around:

1. **animation/content pipeline hardening**
2. **client/server time sync for tweened NPC motion**
3. **visual-effect and overhead-label performance budgeting**
4. **asset hygiene / wrapper scenes / canonical visual contracts**

---

## What changed since the previous audit

## Clear improvements in the latest archive

### 1. Dedicated NPC actor presentation layer
This is one of the best changes in the repo.

`OwnedPlotNpcActor3D.gd` now owns:
- click body
- selection ring
- carry visual
- model loading
- animation lookup
- state-to-animation mapping
- label anchor resolution

That is much better than keeping all of that inside `OwnedPlotDetailRenderer3D.gd`.

### 2. Better local visual feedback
The project now has:
- rubble clear smoke effect scene
- stronger authored remove-feedback path in `Rubble4x4.gd`
- transition audio hook in `GameWorld3D.tscn`

That is a meaningful polish step and also a useful pattern for future authored effects.

### 3. More UI modularization
The addition of:
- `BottomActionBar.gd`
- `OrdersMenuPanel.gd`
- `PlotOrderDefinitions.gd`
- `PlotOrderMenuEntry.gd`
- `PlotDebugOverlay.gd`

is a step in the right direction, even though `HUD.gd` is still too large.

### 4. Better order/NPC usability
The order UI, active-order cancellation, debug overlay, and NPC sheet flow make the current prototype much easier to reason about and test.

---

## What did NOT fundamentally change

The key architectural hotspots remain the same:

### Server
- `server/src/index.ts`
- `server/src/core/world.ts`
- `server/src/core/npc.ts`
- `server/src/storage/persist.ts`

### Client
- `client/scripts/ui/HUD.gd`
- `client/scripts/world/GameWorld3D.gd`
- `client/scripts/world/OwnedPlotDetailRenderer3D.gd`
- `client/scripts/net/NetClient.gd`

So the earlier “foundation hardening first” recommendation still stands.

---

## Updated strongest parts of the project

## 1. Server-authoritative gameplay direction
Still the project’s best architectural choice.

- server owns world truth
- server owns NPC state progression
- owner-only local detail is still filtered correctly
- client is still primarily presentation-driven

## 2. Plot shell vs plot detail direction
Still correct and future-safe in concept.

- public shell
- owner-only detail
- room for future neighborhood/public-detail layers

## 3. New NPC actor presentation boundary
The new actor scene/script is a good pattern worth extending.

## 4. Small but real authored feedback loop
Rubble removal, smoke, transition audio, carry visual, and animation state mapping are not fake placeholder UX. That matters.

---

## Updated major risks

## P0 risks — still highest priority

### 1. Monolithic server entry and domain files
`index.ts`, `world.ts`, and `npc.ts` are still carrying too much responsibility.

### 2. Monolithic JSON persistence
Still one of the biggest long-term risks.

Current sample world snapshot is about **3.0 MB** and already contains:
- 36 plots
- 11 claimed/detailed plots
- 1051 starter objects
- 22 NPCs
- 16 jobs

That is still tiny relative to intended game scope, and it is already large enough to prove the current persistence strategy will become a liability.

### 3. Large client hotspot files
`HUD.gd`, `GameWorld3D.gd`, and `OwnedPlotDetailRenderer3D.gd` are still too central.

### 4. Weak production/setup reproducibility
Typecheck still passes, but:
- `npm run lint` still fails because `eslint` is not executable in the shipped environment
- `npm test` still fails because `vitest` is not executable in the shipped environment
- direct Vitest invocation still fails due to missing Rollup optional dependency in the packaged environment

That remains a real repo/process problem.

---

## New/expanded risks introduced or exposed by the animation implementation

## 1. Client wall-clock dependence for NPC tween timing
This is the most important new finding.

In `OwnedPlotDetailRenderer3D.gd`, NPC motion interpolation duration is derived from server timestamps:

- `state_started_at_ms`
- `state_ends_at_ms`

but the client computes remaining duration using:

- `Time.get_unix_time_from_system()`

That means NPC interpolation currently depends on the client machine’s local wall clock being reasonably aligned with the server clock.

### Risk
If the client clock is ahead or behind:
- movement tweens may finish too early
- movement tweens may lag behind
- actors may snap or drift visually
- animation/motion smoothness becomes inconsistent across players

### Recommendation
Add a proper **server time offset / clock sync layer** before relying further on timestamp-based interpolation.

Best practical options:
- send `server_now_ms` regularly and maintain client offset
- or send `remaining_ms`/`duration_ms` in movement snapshots
- or move to sequence-based interpolation that is independent of local absolute time

This should be added to the implementation plan.

---

## 2. Raw imported GLB dependency is too brittle
`OwnedPlotNpcActor3D.gd` currently preloads:

- `res://assets/NPC/NPC_Scavenger.glb`

That means runtime presentation depends directly on the raw imported model asset.

### Why this is risky
Imported raw assets are not a stable gameplay contract. A reimport, node-name change, clip rename, or skeleton change can silently break:
- animation lookup
- head anchor lookup
- label anchor behavior
- materials
- future LOD setup
- future retargeting

### Recommendation
Create a dedicated wrapper scene, for example:

- `res://scenes/actors/NpcScavengerVisual.tscn`

That wrapper scene should own:
- the imported model instance
- canonical label anchor node
- canonical animation metadata / clip mapping
- any material overrides
- future LOD or quality hooks

Then `OwnedPlotNpcActor3D.gd` should preload the wrapper scene, not the raw GLB.

This is a meaningful addition to the plan.

---

## 3. Animation clip mapping is string-fragile
`OwnedPlotNpcActor3D.gd` maps states to candidate animation names like:
- `Idle`
- `Idle2`
- `Idle3`
- `Walk`
- `Walk Carry`
- `Scavenge`

This is fine for prototype speed, but it is fragile.

### Risk
Any art pipeline or reimport change can silently break expected presentation behavior.

### Recommendation
Introduce a visual contract layer, for example:
- actor-local animation config resource
- scene-exported clip references
- or a small metadata table in a wrapper scene

The important point is: **do not let gameplay depend on raw imported clip names long-term**.

---

## 4. Overhead labels are now even more important as a performance hotspot
The new actor anchor work improved correctness, but the current label pipeline still has a measurable cost profile:

- camera transform forced each frame
- each NPC node force-updated each frame
- world-to-screen projection per visible NPC each frame
- `sync_labels(...)` runs every frame in `HUD._process`

### Why this matters more now
Animated/tweened actors plus label-follow correctness make this path more expensive and more likely to become a visible hotspot.

### Recommendation
Keep this as one of the first benchmark targets:
- labels on
- labels off
- 10 / 25 / 50 / 100 NPC local view

Also plan for later improvements:
- update throttling
- dirty/event-driven refresh where possible
- distance culling bands
- optional label budget cap

---

## 5. One-shot smoke effects will need a budget/pool later
`Rubble4x4.gd` now spawns a smoke scene per clear event and schedules cleanup with timers.

That is correct for the current scale and good for prototype polish.  
It is not yet futureproof for bursty clear events.

### Risk later
If many objects clear in a short window:
- particle instance churn
- timer churn
- transient frame spikes

### Recommendation
Add a future task for:
- one-shot effect budget
- pooled effect spawner
- optional quality tier disabling or reducing smoke density

Not urgent before baseline profiling, but it should be in the plan.

---

## 6. Visual randomness is still not deterministic
Rubble visual positions still use runtime randomness on spawn.

That means:
- entering/exiting plot mode
- full visual rebuilds
- or reloading a plot

can shift rubble visuals in a way that is not server-authoritative.

### Recommendation
Seed per-object visual randomness using object id, for example:
- deterministic rotation
- deterministic local offset
- deterministic variation

This is a small but worthwhile futureproofing change.

---

## 7. Asset hygiene is now a real issue
The latest archive contains both:
- `NPC_Scavenger.glb`
- `NPC_Scavenger_Split.glb`

but the active actor currently references only `NPC_Scavenger.glb`.

There are also stale temp files and packaged generated directories.

### Recommendation
Add an explicit content-hygiene task:
- remove dead/duplicate NPC assets
- define canonical actor visual source
- clean temp scene files
- keep generated/import caches out of handoff archives

---

## File-specific updated review

## Client

### `client/scripts/world/actors/OwnedPlotNpcActor3D.gd`
**Updated verdict:** strong addition

### Good
- correct presentation-layer responsibility
- recursive animation-player lookup happens once on spawn, not per frame
- selection, carry, label anchor, and animation logic are centralized
- random idle chaining is a good prototype-level touch

### Risks / improvements
- raw GLB dependency should become a wrapped scene
- clip-name mapping should become more explicit and less string-fragile
- head-node lookup is brittle if the imported model hierarchy changes
- actor and renderer still split movement/presentation in a way that may get awkward later

### Recommendation
Keep this pattern, but harden the asset contract around it.

---

### `client/scripts/world/OwnedPlotDetailRenderer3D.gd`
**Updated verdict:** still one of the biggest client hotspots, though the new actor split helped

### Positive change
The actor scene removed some visual complexity from this file.

### Still too much responsibility
This file still handles:
- ground
- object sync
- object removal animation trigger
- NPC node lifecycle
- NPC movement tween lifecycle
- label projection source
- selection sync
- presentation metadata caching

### New important issue
Client-side movement tween timing depends on wall-clock time instead of synced server time.

### Recommendation
Still split this later into:
- ground renderer
- object renderer
- NPC renderer
- overhead-label source
- selection visual manager
- ideally a motion/interpolation presenter

---

### `client/scripts/world/local_objects/Rubble4x4.gd`
**Updated verdict:** good prototype presentation object

### Good
- clean authored-object ownership
- proper clear animation entry point
- good fallback if imported animation is absent
- smoke spawn kept local to the object

### Risks
- effect spawning not budgeted
- recursive animation-player lookup every clear is acceptable now but could later be cached
- fallback sink animation is okay, but art-specific remove logic should live in authored content eventually

### Recommendation
Keep, but later add pooled effect spawning / effect budgeting.

---

### `client/scripts/ui/HUD.gd`
**Updated verdict:** still too large

### Positive change
The new orders UI pieces reduced some direct UI clutter.

### Still problematic
It still owns:
- menu/login flow
- bottom bar flow
- orders flow
- debug overlay refresh
- overhead labels sync
- network callback fan-in
- plot interaction outputs
- context menu flow
- selection-driven sheet visibility
- status/presence/latency text

### Recommendation
Still needs to be split. No change in verdict.

---

### `client/scripts/ui/PlotDebugOverlay.gd`
**Updated verdict:** useful dev tool, but not performance instrumentation

### Good
- readable live-state visibility
- useful for order/job validation

### Concern
It is refreshed every frame from `HUD._process` when enabled. That is okay now but should not be confused with a real metrics system.

### Recommendation
Later throttle to a lower refresh rate or make it event-driven.  
Do not treat it as the answer to performance instrumentation.

---

### `client/scripts/net/NetClient.gd`
**Updated verdict:** still needs cleanup

### Still present
- hardcoded server URL
- duplicate `"error"` match arm still exists
- no robust reconnect/backoff state model
- permissive message handling
- weak profile-path sanitization via `ProfileStore`

### Recommendation
No change in verdict. Still a priority cleanup area.

---

### `client/scripts/world/GameWorld3D.gd`
**Updated verdict:** still central, but growing in useful ways

### Good
- world/local mode transition flow is solid
- transition audio hook is a nice touch
- local NPC selection flow is coherent

### Risk
This file still owns too many cross-cutting concerns:
- world state
- view mode switching
- local selection
- local interactor wiring
- transition sequencing
- camera bounds
- owned plot renderer coordination

### Recommendation
Still needs boundary cleanup.

---

## Server

### `server/src/core/npc.ts`
**Updated verdict:** still the strongest gameplay file, still too broad

### Positive
The current order system remains structurally respectable.

### Still problematic
It still mixes:
- order validation
- job creation
- job assignment
- target selection
- state machine transitions
- movement timing
- dropoff handling
- cancellation semantics

### Additional note after animation pass
Because client motion interpolation now depends on server timing fields, this server file is no longer only gameplay logic — it is also implicitly a client animation timing contract.

That makes it even more important to separate:
- simulation state
- transport contract
- presentation timing contract

---

### `server/src/index.ts`
**Updated verdict:** still a god-file

No material change in conclusion.

Still mixes:
- bootstrap
- connection/session handling
- message dispatch
- domain mutation
- broadcasting
- presence broadcasting
- tick loop setup
- timeout/ping behavior

Still should become a thin composition root only.

---

### `server/src/storage/persist.ts`
**Updated verdict:** unchanged and still unacceptable long-term

Still clones via:
- `JSON.parse(JSON.stringify(world))`

Still rewrites full snapshot.

No change in core verdict.

---

## Repo / process / documentation findings still relevant

## Still relevant and still should be addressed

- `.git`, `node_modules`, `.godot`, and runtime save data are still present in handoff archive
- temp scene files are still present
- README is still far too thin
- AI handover docs are still too prominent relative to canonical docs
- test/lint in packaged environment still fail at executable layer
- profile filename sanitization is still deferred
- duplicate `error` branch in `NetClient.gd` still exists

---

## Updated implementation-plan changes required

The previous updated implementation plan is still correct, but it should now include these additions.

## Additions to the plan

### 1. Add animation/content pipeline hardening tasks
Under client architecture refactor, add tasks for:

- replace raw GLB preload with wrapper scenes
- define canonical animation clip contract
- define canonical label anchor in wrapped visual scenes
- isolate presentation-state mapping from raw gameplay state names
- remove duplicate/unused NPC visual assets

### 2. Add client/server time-sync task
Before relying further on tween interpolation:
- add server-time offset estimation or equivalent timing contract
- remove direct reliance on unsynced client wall-clock for movement tween duration

### 3. Expand benchmark matrix with visual/presentation scenarios
Add benchmark scenarios for:
- 10 / 25 / 50 / 100 local NPCs with labels on
- same scenarios with labels off
- object-dense local plot with actor animations active
- repeated rubble clears with smoke effects
- local plot enter/exit transition timing

### 4. Add effect budgeting / pooling task
For later client optimization:
- pooled one-shot effects
- particle budget
- optional quality scaling

### 5. Add content hygiene / asset contract task
Add explicit cleanup for:
- dead or duplicate NPC assets
- wrapper-scene-only asset references
- temporary scene files
- non-canonical generated content in handoff archives

### 6. Add deterministic visual-variation task
Seed rubble/object visual randomness by object id.

---

## Updated benchmark priority order

The most likely current bottlenecks are now, in this order:

1. `broadcastPlotUpdate` fan-out cost
2. full-world clone/save cost
3. NPC tick scans / repeated `.find(...)`
4. client overhead label path:
   - `HUD._process`
   - `get_npc_overhead_label_entries`
   - `sync_labels`
5. local renderer NPC/object sync churn
6. client tween/effect churn during dense local activity
7. smoke/effect burst cost during repeated removals

---

## Final conclusion

The latest archive is better than the earlier one.

The new animation implementation does **not** overturn the earlier recommendations.  
It **strengthens** them.

### What I would keep
- server-authoritative direction
- shell/detail split
- new NPC actor presentation pattern
- orders/debug/UI modularization trend
- authored local visual feedback

### What I would add
- animation/content pipeline hardening
- server-time/client-time alignment for motion presentation
- visual benchmark scenarios
- effect budget/pooling
- asset hygiene cleanup
- deterministic visual variation

### Final professional assessment
This is still a project worth hardening, not rewriting.  
The new animation foundation is the right move.  
But it also exposes exactly why measurement-first and boundary hardening must happen before significantly more simulation and content are added.
