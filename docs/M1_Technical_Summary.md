# Milestone 1 (M1) — 3D Rendering (Individual Tiles) — Technical Summary

**Project:** CozyChaosCityBuilder / Cozy Chaos City  
**Milestone:** M1  
**Branch:** `m1-3d-individual-tiles`  
**Purpose of this document:** A clear, living technical brief for *you* and any future GPT assistant to pick up M1 work quickly and correctly.

---

## 0) Context (What’s already done in M0.5)

M0.5 delivered the “real” world layout system and a playable 2D view:

- Server is authoritative for the world.
- Plots have deterministic coordinates and stable IDs:
  - Plot coordinates: `x`, `y`
  - Plot id: `T_<x>_<y>`
- Plot types are deterministic from coordinates:
  - `RESOURCE` if `x` and `y` are both even; else `PLAYER`
- Initial world: 3×3 (`x=0..2`, `y=0..2`)
- Expansion triggers when free claimable plots are below a threshold.
- Client 2D PlotView renders by `(x,y)` and supports selecting/claiming.
- Client shows ping (RTT) using `client_ping` / `server_pong`.
- Plot ownership shows **display_name** reliably (server includes `owner_display_name` on `plot_update`).

M0.5 also verified public playtesting works via router port-forwarding.

---

## 1) M1 Goal (What we are building)

**Core goal:** Render the same server-authoritative world in **3D** in Godot, using **individual tile scenes** (not MultiMesh) for M1.

M1 is about:
- Correct 3D placement of plot tiles based on `(x,y)`
- Clear visuals for plot types and ownership states
- Basic, functional camera controls
- 3D interaction: select a plot and claim it (same networking)

**Non-goals for M1 (defer):**
- Advanced camera modes (orbit, edge-scroll, cinematic smoothing, constraints tuned to gameplay)
- Presence/online lists and join/leave notifications
- Deep building systems, interiors, NPC AI
- World-map/minimap rendering

---

## 2) Rendering approach chosen for M1

### Chosen: Individual Tile Scenes
**Why:**
- M1 world view will render a small window (e.g. ~7×7) around a focus point.
- Individual nodes are easiest for:
  - collisions and picking (ray hits tile collider)
  - per-tile highlight, selection, simple decals/indicators
  - fast iteration and debugging

### Future direction
- Later milestones may introduce MultiMesh for world map / large zoom-out views.
- Keep renderer modular so replacing the backend later is feasible.

---

## 3) M1 Deliverables (Definition of Done)

### 3D World View
- New 3D scene (e.g. `World3D.tscn`) that:
  - connects to the existing networking client
  - receives `world_state`, `plot_update`, `world_patch`
  - spawns plot tiles at correct 3D positions

### PlotTile3D scene
- A reusable tile scene:
  - `MeshInstance3D` (plane/cube) + `CollisionShape3D`
  - optional child nodes for border/indicator/label (debug only)
- Visual states:
  - `RESOURCE` vs `PLAYER`
  - `FREE` vs `TAKEN` vs `MINE` (owner highlights)
  - hovered/selected highlight

### Basic camera system (M1 minimal)
- A simple camera rig:
  - pan/move (WASD or arrows)
  - mouse-drag pan (optional)
  - zoom (mouse wheel)
- Constraints are minimal (can be refined later).

### 3D Interaction
- Clicking a tile selects it.
- Claim action sends `claim_plot` using the selected plot id.
- Visual update on claim from server broadcast.

---

## 4) Recommended Modular Architecture (Client)

Create small scripts with single responsibilities:

1) `PlotGridMath.gd`
   - Constants: tile size, origin offset, axis mapping (grid x/y -> world x/z)
   - Functions:
     - `grid_to_world(x:int, y:int) -> Vector3`
     - `world_to_grid(pos:Vector3) -> Vector2i` (optional for later)

2) `PlotTile3D.gd`
   - Owns a single tile instance.
   - Fields: `plot_id`, `x`, `y`, `type`, `claimed_by`, `owner_display_name`
   - Methods:
     - `apply_plot(plot:Dictionary)`
     - `set_selected(bool)`, `set_hovered(bool)`
   - Only visual logic here.

3) `PlotRenderer3D.gd`
   - Owns a dictionary: `plot_id -> PlotTile3D instance`
   - Methods:
     - `apply_world_state(world:Dictionary)`
     - `apply_plot_update(plot:Dictionary)`
     - `apply_world_patch(added:Array)`
   - Responsible for instantiation/removal and stable updates.
   - Optional: limit rendering to a window (7×7) around a focus point.

4) `TilePicker3D.gd`
   - Handles raycast click selection
   - Emits signals like `tile_clicked(plot_id)` and `tile_hovered(plot_id)`
   - Keeps picking separate from rendering.

5) `CameraRigBasic.gd`
   - Self-contained camera movement/zoom.
   - Should not depend on networking.

> **Important:** Keep these independent so future refactors (e.g. MultiMesh) don’t rewrite everything.

---

## 5) Networking integration points (Client)

Reuse existing networking as-is:

- `world_state` (snapshot): initialize renderer
- `plot_update` (delta): update one tile
- `world_patch` (added tiles): spawn tiles (or window update)

Ownership name handling:
- Prefer `plot.owner_display_name` if present on updates.
- Otherwise map through `world.players` snapshot when available.

---

## 6) Suggested Implementation Order (Small steps)

1) Create `World3D.tscn` and show it (no networking yet)
2) Add `CameraRigBasic` and confirm movement/zoom
3) Create `PlotTile3D.tscn` (mesh + collision) and instantiate manually
4) Add `PlotGridMath` and place a 3×3 in 3D (offline test)
5) Implement `PlotRenderer3D` to spawn tiles from a dummy `world_state`
6) Wire to NetClient:
   - on `world_state` -> `apply_world_state`
   - on `plot_update` -> `apply_plot_update`
   - on `world_patch` -> `apply_world_patch`
7) Implement `TilePicker3D` and hook click -> select -> claim
8) Add selection/hover visuals
9) Add minimal “Selected plot” HUD info (optional)

---

## 7) Testing checklist

- Server running; client connects normally.
- 3D view shows at least the initial 3×3 plots aligned to grid.
- Tile visuals distinguish:
  - RESOURCE vs PLAYER
  - FREE vs TAKEN vs MINE
- Clicking a tile selects it (highlight).
- Claiming a free PLAYER tile works; server broadcasts; tile updates for all clients.
- Resource tiles cannot be claimed (UI feedback optional).
- Expansion triggers and new tiles appear correctly in 3D.

---

## 8) Development rules (must follow)

- Never guess file contents: always read project files first.
- Provide exact edit locations (file paths + line numbers/anchors).
- Keep code modular; avoid spaghetti.
- Provide educational comments and verification steps.

---

## 9) Notes for the next assistant

- M1 is intentionally scoped: 3D rendering + basic interaction + basic camera.
- Do not add presence systems or deep gameplay here unless explicitly requested.
- Prefer clarity and correctness over premature performance optimization.
