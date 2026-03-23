# Cozy Chaos City — Handover Prompt for the Next GPT Assistant

You are continuing work on the **Cozy Chaos City** project.

## Mandatory first step

Read the latest uploaded repo zip **recursively** before making suggestions.

Then read these files carefully:

- `docs/GPT_Assistant_Rules.md`
- `CHANGELOG.md`
- `docs/milestones.md`
- `docs/CozyChaosCity_Logistics_Technical_Implementation_Roadmap.md`
- `docs/TECHNICAL_SUMMARY_FOR_GPT_ASSISTANT.md`

Follow `docs/GPT_Assistant_Rules.md` strictly.

---

## Important implementation rules

- Use the **actual current files from the repo**, not assumptions.
- Give **exact file paths** and **exact insertion/replacement anchors**.
- Keep code modular.
- For **new files**, provide the **entire file**.
- For **existing files**, provide the **smallest exact patch possible**, preferably whole-function replacements when practical.
- Keep server/client protocol changes synchronized intentionally.
- Explain:
  - what each change does
  - where it goes
  - why it is structured that way
  - how to test it
- Leave meaningful comments in code.
- Do not invent design/balance behavior when the repo or user has not locked it yet — ask first.

---

## Current confirmed project state

The project is already past M3.

### Already implemented
- M0, M0.5, M1, M2, and the M3 NPC/order foundation
- post-M3 hardening:
  - server-authored snapshot timing
  - `NpcVisual` wrapper
  - dev metrics
  - safer NetClient reconnect flow

### Logistics foundation already implemented in the repo
- authoritative item ids and starter-rubble output rules now exist in:
  - `server/src/core/items.ts`
- owned-plot protocol/domain state now uses:
  - `plot_objects`
  - `loose_items`
  - `carry_slots`
  - plot-object storage state
  - NPC haul target metadata
- legacy migration paths exist for older owned-plot saves
- rubble now uses `remaining_output_rolls`
- each completed scavenging work round yields one real item
- loose items now exist as authoritative plot state
- same-item/same-tile merge is implemented
- a starter Dump Zone now exists server-side as a real plot object with:
  - abstract storage
  - finite capacity
  - full-state retry cooldown
- current scavenger behavior is:
  1. finish work round
  2. receive a real item into carry slots
  3. direct-haul to Dump Zone if valid and within 8 tiles
  4. otherwise drop to the ground

### Important current limitations
- Dump Zone is **not rendered yet** in the client
- loose ground items are **not rendered yet** in the client
- current direct-haul only covers newly scavenged output
- hauling existing loose items into storage is not implemented yet
- loose-item pickup reservations are not implemented yet
- Basic Stockpile is not implemented yet
- Sorting Station gameplay is not implemented yet

---

## Current priority order

1. **Branch 1D — Client representation and verification**
   - render Dump Zone
   - render loose items
   - make current logistics behavior readable in the client
2. **Phase 2 — Basic Stockpile and physical construction delivery**
3. **Phase 3 — Sorting Station and Mixed Salvage processing**

Do **not** steer the project back toward “more M3 feature work first” unless the user explicitly asks for it.

---

## Useful current assets in the repo

The uploaded repo already contains storage/building assets that may matter for upcoming client-side logistics visualization:

- `client/assets/storage/LastPall.glb`
- `client/assets/buildings/SortingStation.glb`

Do not assume they are already wired into scenes/scripts. Check the repo first.

---

## What I want from you first

Before proposing changes:

1. Summarize the **actual current repo state** from the latest files.
2. Confirm exactly what part of the logistics roadmap is already implemented.
3. Identify the **smallest correct next slice**.
4. Then implement **only that slice**.

The expected next slice is probably **Branch 1D**, unless the actual repo state proves otherwise.

---

## Technical direction reminder

Keep this server-authoritative.

Do not fake logistics entirely on the client.

The correct architecture direction is:
- server owns:
  - item ids
  - storage
  - routing decisions
  - loose-item state
  - NPC work/carry/drop state
- client owns:
  - rendering
  - interaction
  - readable verification/debug UI
  - presentation of server-authored state