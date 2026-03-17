# Cozy Chaos City — Handover Prompt for the Next GPT Assistant

You are continuing work on the **Cozy Chaos City** project.

## Important instructions

- Read the project source .zip **recursively** before making suggestions.
- Start by reading these files carefully:
  - `docs/GPT_Assistant_Rules.md`
  - `CHANGELOG.md`
  - `docs/milestones.md`
  - `docs/M3_implementation_plan.md`
  - `docs/TECHNICAL_SUMMARY_FOR_GPT_ASSISTANT.md`
- Follow `docs/GPT_Assistant_Rules.md` strictly.
- Use the **actual current files from the repo**, not assumptions.
- Give **exact file paths** and **exact insertion/replacement anchors**.
- Keep code **modular** and avoid spaghetti.
- For **new files**, provide the **full file**.
- For **existing files**, provide **minimal patches only**, perferably replacement of whole functions.
- Explain:
  - what each change does
  - where it goes
  - why it works
  - how to test it
- Use **Godot editor instructions first** when static UI/scene changes are needed.
- Keep **server/client protocol changes synchronized**.

## Current confirmed project state

The repo is already past the earlier M2 groundwork.

What is already implemented:

- M1 is complete and working.
- M2 has already delivered the first real owned-plot gameplay foundation.
- The player can:
  - connect/login
  - view the world
  - claim a plot
  - enter their owned plot
  - leave back to the world
- Camera enter/exit transition exists and works.
- Transition sound hook exists.
- Local owned-plot rendering exists.
- Hidden local cells still exist for logic.
- Ground is player-facing presentation, while the hidden grid is for logic/snap/blocking.
- Rubble is represented as real local 4x4 objects.
- Real rubble interaction is implemented:
  - click/right-click rubble
  - popup action flow
  - send clear request by object id
  - server validates and clears authoritatively
  - updated plot detail is broadcast back
  - removed rubble animates out on the client
- Multi-step rubble clearing is implemented:
  - rubble stores remaining clear hits
  - final clear removes rubble and frees its footprint
- Player Plot camera parity is implemented:
  - local mode now uses free camera movement after enter
  - movement bounds exist
  - world camera state is restored on exit
- Local visual polish was added:
  - rubble random Y rotation
  - rubble slight random X/Z offset
  - randomized multi-texture ground shader for the plot ground
  - smoke effect on final rubble removal
- Local detail is owner-only and compacted on the wire for stability.
- The current NPC in local view is still a **placeholder marker**.

## Current priority order

1. **M3 - NPC foundation and first local orders**
2. Then interaction UX polish as needed
3. Neighborhood/public local rendering later
4. Broader business/economy expansion after the NPC base is proven

## Important direction

Neighborhood loading/rendering is **not** the current next step anymore.

Do **not** write as if:
- neighborhood is still the immediate priority
- camera parity is still upcoming
- real rubble interaction is still upcoming

Those are already done.

## What M3 is supposed to achieve

The next milestone is:

## M3 - NPC Foundation and First Local Orders

The first M3 implementation should stay intentionally small and server-authoritative.

Target direction:
- add dedicated NPC data
- separate NPCs from static starter objects
- add a small bounded server-side NPC simulation/tick path
- replace the placeholder NPC marker with a real local NPC actor representation
- add the first simple NPC state machine
- add the first player-issued order:
  - `Scavenging`
- let an eligible NPC perform a simple local scavenging loop on the owned plot

Recommended first NPC states:
- `idle`
- `moving_to_target`
- `working`
- `carrying_to_dropoff`
- `dropping_off`
- `returning`

Recommended first scavenging loop:
1. Player issues `Scavenging` order
2. Server validates the order
3. Eligible owned-plot NPC accepts the task
4. NPC moves to a valid local scavenging target
5. NPC works for a short time
6. NPC returns to the shack/drop area
7. NPC visibly drops found material
8. NPC continues if more valid work remains, otherwise returns idle

## Very important technical direction

Do **not** fake major NPC behavior entirely on the client.

Keep the first NPC implementation **server-authoritative** for:
- task assignment
- state progression
- work timing
- result generation
- completion/cancel behavior

Client responsibilities should mainly be:
- rendering NPCs
- showing movement/state
- sending order requests
- reflecting server updates

## What I want from you first

Before proposing code changes:

1. Summarize the **current repo state** from the actual files.
2. Confirm exactly what is already implemented.
3. Identify the **cleanest first vertical slice for M3** based on the current codebase.
4. Then prepare the implementation for that M3 slice only.

## Extra guidance

- Do not skip the repo-reading step.
- Do not invent files or project state.
- Base everything on the actual repo.
- Keep the initial summary short before moving into the implementation plan.
- Keep the first M3 slice small, testable, and clean.
- Avoid giant speculative systems or overengineering.
- Prefer building the smallest real NPC loop that future work can extend.
