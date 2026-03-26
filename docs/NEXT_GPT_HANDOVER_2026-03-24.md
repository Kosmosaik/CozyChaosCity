# Cozy Chaos City — Next GPT Handover (2026-03-24)

## Repo state summary
- Branch 1 client verification is complete enough for the current scope.
- Dump Zone, loose items, item-aware carry visuals, NPC logistics sheet fields, and Plot Debug Overlay logistics summaries are all implemented.
- Shared item-visual pipeline foundations exist through:
  - `client/scripts/world/item_visuals/ItemVisualCatalog.gd`
  - `client/scripts/world/item_visuals/ItemVisualRegistry.gd`
  - `client/scripts/world/item_visuals/ItemVisualNode.gd`
  - `client/scripts/world/item_visuals/StaticItemModelVisual.gd`
- Current scavenger behavior is still the Branch-1 special case:
  1. finish work round
  2. receive a real item into carry slots
  3. direct-haul to Dump Zone if valid and within 8 tiles
  4. otherwise drop to the ground

## What is still not implemented
- general hauling jobs for existing loose items
- loose-item quantity reservations and conflict re-evaluation
- hauling from Dump Zone / station buffers / stockpiles
- Workbench manufacturing
- Construction sites / Basic Stockpile construction
- Sorting Station gameplay

## Locked next branch order
1. **Branch 2 — Hauling foundation**
2. **Branch 3 — Manufacturing foundation (Workbench + Wooden Pallets)**
3. **Branch 4 — Construction foundation (Basic Stockpile)**
4. **Branch 5 — Sorting Station and Mixed Salvage processing**

## Important design decisions from the questionnaire
- Early game: all NPCs can haul when they do not have a higher-priority task.
- Current scavenger direct-haul will be changed to use the new hauling system.
- First hauling search radius: **10 tiles**.
- First hardcoded logistics priority order:
  1. construction demand
  2. manufacturing demand
  3. eligible stockpile / storage
  4. Dump Zone
  5. ground fallback
- First manufacturing building: **Workbench**.
- First recipe: **1 Wooden Pallet = 4 Scrap Wood**, **10s** craft time, **1** output.
- First construction target: **Basic Stockpile**.
- First stockpile construction cost: **4 Wooden Pallets**.
- Construction requires all materials delivered before build work starts.
- Up to **2 NPCs** can work on one site.
- Basic Stockpile stays unusable until the player assigns a filter.

## Read first before coding
- `docs/GPT_Assistant_Rules.md`
- `CHANGELOG.md`
- `docs/milestones.md`
- `docs/CozyChaosCity_Logistics_Technical_Implementation_Roadmap.md`
- `docs/Logistics-Storage-Sorting-Implementation-Plan.md`
- `docs/TECHNICAL_SUMMARY_FOR_GPT_ASSISTANT.md`
- `docs/CozyChaosCity_Branch_Design_Questionnaire.md`

## Recommended first slice next time
Start **Branch 2 — Hauling foundation** with the smallest real server slice:
- authoritative hauling-job model for existing loose items only
- keep current scavenger direct-haul untouched
- add reservation/re-evaluation plumbing early
- expose just enough debug visibility to verify haul jobs and reservations
