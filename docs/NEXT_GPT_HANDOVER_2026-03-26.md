# Cozy Chaos City — Current Handover Summary

_Last updated: 2026-03-30_

## Repo state summary
- M0, M0.5, M1, M2, and the M3 NPC/order foundation are in place.
- Branch 1 extraction / Dump Zone / client verification is complete enough for the current scope.
- Branch 2 hauling foundation is implemented in the repo:
  - authoritative `HAUL_LOOSE_ITEM` jobs
  - quantity reservations and re-evaluation
  - idle haul assignment for existing loose items
  - ground-only roaming/search
  - shared hauling path for successful fresh scavenger output
  - Plot Debug Overlay haul-job / reservation visibility
- Branch 3 manufacturing is functionally complete for the current gameplay scope:
  - starter Workbench plot object and manufacturing state
  - first recipe definition: `WOODEN_PALLET = 4 SCRAP_WOOD`, `10s`, output `1`
  - queue / clear manufacturing flow through Orders UI + protocol
  - authoritative input/output buffers
  - Scrap Wood hauling into the workbench input buffer
  - queue-clear release of buffered inputs back to loose items
  - ready-station detection / reservation / authored operate cell approach
  - authoritative active craft start and locked input consumption
  - real `WOODEN_PALLET` output generation into the output buffer
  - hauling finished pallet output through the shared logistics system
  - station visuals for both input Scrap Wood and output pallets
- Starter dump-zone generation now places the zone directly adjacent to the starter clear area instead of leaving it as a disconnected walkable island.
- Workbench stance presentation now resolves through the authored station anchor with correct actor-local offset math.

## Current limitations / not yet implemented
- Dump Zone extraction into manufacturing / stockpiles is not implemented yet.
- Construction sites / Basic Stockpile construction are not implemented yet.
- Sorting Station gameplay is not implemented yet.
- Full mid-segment haul reprioritization while already walking is still deferred.
- UI/UX polish is intentionally deferred to a later dedicated branch.

## Next branch order
1. **Branch 4 — Construction foundation (Basic Stockpile)**
2. **Branch 5 — Sorting Station and Mixed Salvage processing**
3. A later dedicated **UI/UX polish branch**

## Important design decisions still in force
- Early game: all NPCs can haul when they do not have a higher-priority task.
- First hauling search radius is **10 tiles**.
- Current haul priority order is effectively:
  1. manufacturing demand
  2. dump-zone cleanup
  3. ground fallback / blocked state
- First manufacturing building: **Workbench**.
- First recipe: **1 Wooden Pallet = 4 Scrap Wood**, **10s** craft time, **1** output.
- Workbench is still spawned as a starter plot object for now.
- First construction target: **Basic Stockpile**.
- First stockpile construction cost: **4 Wooden Pallets**.
- Construction requires materials delivered before worker build time starts.

## Reference docs
- `docs/GPT_Assistant_Rules.md` *(the only assistant-instruction document)*
- `CHANGELOG.md`
- `docs/milestones.md`
- `docs/CozyChaosCity_Logistics_Technical_Implementation_Roadmap.md`
- `docs/Logistics-Storage-Sorting-Implementation-Plan.md`
- `docs/TECHNICAL_SUMMARY_FOR_GPT_ASSISTANT.md`
- `docs/CozyChaosCity_Branch_Design_Questionnaire.md`
