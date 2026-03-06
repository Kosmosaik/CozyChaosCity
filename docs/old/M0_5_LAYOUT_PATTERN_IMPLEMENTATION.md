# M0.5 — Layout Pattern Implementation (Pre-M1)

## Purpose
M0.5 is a focused milestone that **implements the real macro world layout pattern** (player plots + resource plots) on the server and renders it in the existing 2D PlotView. This locks in the **world-generation ruleset** before we move to 3D visuals.

**Outcome:** the world layout (including expansion) follows the intended repeating pattern **now**, in 2D, with claiming/persistence still working.

---

## What stays unchanged from M0
- Dedicated server + multi-client connectivity
- Profiles + `welcome` identity flow (`player_id + secret`)
- Plot claiming UX: click to highlight → press **Claim**
- Persistence (`world_state.json`) + atomic writes
- Expansion trigger (free plots threshold) remains, but the *expansion method* changes to preserve the pattern
- Heartbeat/keepalive

---

## M0.5 goals (we WILL implement these)
1) Add coordinates to plots (`x`, `y`) in the server world state.
2) Rename/standardize plot types:
   - `PLAYER` (claimable)
   - `RESOURCE` (resource plot / res-plot; shared/unclaimable)
3) Implement the **actual repeating pattern rule** from the design sketches via:
   - `plotTypeAt(x:int, y:int) -> "PLAYER" | "RESOURCE"`
4) Generate the starter world rectangle using the real pattern.
5) Update world expansion to add new plots by coordinates while preserving the same pattern.
6) Update Godot PlotView to render by `(x,y)` instead of array index.

---

## The pattern (what it should express)
### Starter cluster intent
- A starter “tile”/cluster where **resource plots occupy the corners** and player plots fill the rest.
- When tiled/expanded, the macro world shows **repeatable resource-plot rows** and **player-only rows** in between (as in the sketches).

> Exact rule will be coded in `plotTypeAt(x,y)` and verified visually in PlotView.

---

## Data model changes

### Plot (server)
Current (M0):
- `{ id, type, claimed_by }`

M0.5 update:
- `{ id, type, x, y, claimed_by }`

Notes:
- `claimed_by` remains `player_id`.
- `id` can remain simple for now, but should be stable and ideally derived from coordinates later (e.g., `T_x_y`).

### Plot type naming
Rename from internal `RES_SHARED` to:
- `RESOURCE`
And in UI/docs, always call these **resource plots / res-plots**.

---

## Server work (M0.5)

### 1) Protocol update
- `server/src/net/protocol.ts`
  - Add `x`, `y` to Plot
  - Add/rename plot types to include `RESOURCE`
- Add world migration/normalization on startup:
  - If old `world_state.json` lacks `players`, add `{}`
  - If old plots lack `x,y`, either regenerate or migrate (during early dev it’s acceptable to delete the save)

### 2) World generation with real pattern
- `server/src/core/world.ts`
  - Introduce `plotTypeAt(x,y)` implementing the real repeating pattern
  - Generate initial world as a coordinate grid (width/height) using `plotTypeAt`

### 3) Expansion that preserves the pattern
- Replace “append N new plots” with a coordinate-based expansion:
  - Add a new row/column band (or a ring) extending bounds
  - Every new coordinate uses `plotTypeAt(x,y)`
- Broadcast new plots using `world_patch` (include x,y)

---

## Client work (M0.5)

### 1) PlotView renders by coordinates
- Replace index-based layout (`cols`) with coordinate-based placement:
  - `screen_x = padding + x*(cell_w+pad_w)`
  - `screen_y = padding + y*(cell_h+pad_h)`
- Selection: click a rect → identify which plot has that rect → use its `id` for claiming

---

## Acceptance criteria (M0.5)
- The 2D client renders the intended repeating pattern clearly.
- Resource plots are unclaimable; player plots are claimable.
- Claiming still works and broadcasts correctly.
- Persistence still works.
- Expansion adds plots that continue the same pattern (no breaking seams).

---

## What M1 becomes after M0.5
With pattern generation locked in, **M1 shifts focus to presentation**:
- 3D rendering of the same plot grid (tiles/meshes)
- 3D camera controls and readability (zoom, pan, highlights)
- Visual differentiation of player plots vs resource plots in 3D
- (Optional) first pass at “paths/roads” visuals

**Important:** M1 should not change the core pattern rules; it should render what M0.5 already generates.

