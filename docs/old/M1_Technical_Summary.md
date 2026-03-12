# Milestone 1 (M1) — 3D Rendering (Individual Tiles) — Technical Summary

**Project:** CozyChaosCityBuilder / Cozy Chaos City  
**Milestone:** M1  
**Branch:** `m1-3d-individual-tiles`  
**Purpose of this document:** A clear, living technical brief for you and any future GPT assistant to pick up M1 work quickly and correctly.

---

## 0) Context (What was already done before recent M1 work)

Before the latest M1 progress, the project already had:

- Server-authoritative world state
- Stable plot coordinates and IDs
  - coordinates: `x`, `y`
  - id format: `T_<x>_<y>`
- Deterministic plot typing from coordinates
  - `RESOURCE` if `x` and `y` are both even
  - otherwise `PLAYER`
- Initial world size: 3×3
- Expansion logic when free player plots fall below threshold
- Working 2D PlotView from M0.5
- Ping / RTT display
- Ownership display name support from the server
- Verified public multiplayer playtesting via port forwarding

That original M1 summary defined the goal as moving from the old 2D presentation to a 3D client using individual tile scenes. :contentReference[oaicite:1]{index=1}

---

## 1) M1 Goal (Current interpretation)

**Core goal:** Render the same server-authoritative world in **3D** in Godot using **individual tile scenes**, with a functional city-builder style camera and later 3D interaction for selecting and claiming plots.

M1 is about:
- correct 3D placement of plot tiles based on `(x, y)`
- modular 3D world/client architecture
- clear visual distinction for plot types and ownership states
- functional camera controls suitable for a city-builder
- 3D selection and claim flow using the existing network protocol

**Still not part of M1:**
- advanced gameplay systems
- interiors / NPC AI
- minimap / world map
- major performance optimization systems such as MultiMesh
- advanced presence / social systems

---

## 2) Rendering approach chosen for M1

### Chosen: Individual Tile Scenes
This decision remains unchanged.

**Why:**
- easier picking/collision
- easier per-tile visual state
- easier debugging
- faster iteration during early 3D migration

### Current status
This approach is now partially implemented:
- a reusable 3D tile scene exists
- a local 3×3 test grid exists
- real server-driven spawning is not connected yet

### Future direction
A later milestone may use MultiMesh for zoomed-out or large-scale views, but M1 should continue using individual tile scenes.

---

## 3) What has actually been completed so far in M1

### Completed
- Added a dedicated 3D world scene:
  - `client/scenes/world/GameWorld3D.tscn`
- Added a dedicated 3D world controller:
  - `client/scripts/world/GameWorld3D.gd`
- Main scene now instances the 3D world scene alongside:
  - UI
  - networking
- HUD was refactored to be **UI-only**
- Old active 2D PlotView rendering path was removed from the active gameplay flow
- Client-side world-data ownership was moved into `GameWorld3D.gd`
- Added a reusable tile scene:
  - `client/scenes/world/PlotTile3D.tscn`
- Added a reusable tile script:
  - `client/scripts/world/PlotTile3D.gd`
- Added tile visuals for:
  - `RESOURCE`
  - free `PLAYER`
  - claimed plot
  - local-player-owned plot
- Added a temporary local 3×3 tile render test
- Added a dedicated camera controller:
  - `client/scripts/world/CameraRigBasic.gd`
- Added city-builder style runtime camera controls:
  - movement
  - zoom-scaled movement speed
  - right mouse drag yaw
  - right mouse drag pitch/tilt
  - mouse wheel zoom
  - zoom toward mouse world position

### Not completed yet
- `PlotRenderer3D.gd`
- `PlotGridMath.gd`
- `TilePicker3D.gd`
- real server-driven 3D tile spawning
- 3D tile selection
- reconnected claim flow through 3D tile selection
- hover/selection visuals beyond basic tile-local support

---

## 4) Current client architecture

### Current scene direction
The client is now moving toward this structure:

- `Main`
  - `GameWorld3D`
  - `UI`
    - `HUD`
  - `NetClient`

### Current responsibilities

#### `HUD.gd`
UI-only responsibilities:
- username input
- connect button
- claim button
- labels/status
- forwarding network/world data to the world layer

It should **not** own rendering logic anymore.

#### `GameWorld3D.gd`
World-level responsibilities:
- own client-side world data
- store local player id
- receive full world snapshots
- receive single plot updates
- receive world patches
- coordinate world rendering systems

Right now it still includes a temporary local test-grid path.

#### `PlotTile3D.gd`
Tile-level responsibilities:
- own one tile’s visual state
- apply plot data locally
- expose visual methods like:
  - `apply_plot(...)`
  - `set_selected(...)`
  - `set_hovered(...)`

#### `CameraRigBasic.gd`
Camera-only responsibilities:
- runtime movement
- zoom
- yaw
- pitch/tilt
- zoom toward mouse position

It should remain independent from networking and tile ownership logic.

---

## 5) Current 3D world scene status

### `GameWorld3D.tscn`
The 3D world scene currently includes the basic world shell:
- camera rig
- sunlight
- tile root container
- ground plane

### Camera rig structure
The camera has been refactored into a proper pivot hierarchy:

- `CameraRig`
  - `YawPivot`
    - `PitchPivot`
      - `Camera3D`

This is now the intended long-term structure for M1.

---

## 6) Current tile scene status

### `PlotTile3D.tscn`
The reusable tile scene exists and is structured as:
- `StaticBody3D`
  - `MeshInstance3D`
  - `CollisionShape3D`

### `PlotTile3D.gd`
The tile script currently stores and applies:
- `plot_id`
- `grid_x`
- `grid_y`
- `plot_type`
- `claimed_by`
- `owner_display_name`

The tile script currently handles basic visual state changes for:
- resource vs player plot
- free vs taken vs mine
- selected / hovered support hooks

This is the correct direction and should continue to own only tile-local behavior.

---

## 7) Current networking integration status

The existing networking layer is still intended to be reused as-is.

### Already wired conceptually
`HUD.gd` forwards:
- local player identity
- full world snapshots
- single plot updates
- world patches

into `GameWorld3D.gd`

### Current limitation
Those data flows exist, but **real tile rendering is not yet driven by them**.

At the moment:
- `GameWorld3D.gd` stores the data
- the visible 3D tiles still come from a temporary local 3×3 test grid

So the next renderer step is still required.

---

## 8) Updated recommended modular architecture

This is the recommended direction from here:

### 1) `PlotTile3D.gd`
Already exists. Keep it tile-local only.

### 2) `CameraRigBasic.gd`
Already exists. Keep it camera-only.

### 3) `PlotRenderer3D.gd`
Still needed.

Recommended responsibilities:
- own dictionary: `plot_id -> PlotTile3D instance`
- spawn/remove/update tiles
- apply full world snapshot
- apply single plot updates
- apply world patches

### 4) `PlotGridMath.gd`
Still recommended.

Responsibilities:
- centralize grid-to-world coordinate math
- keep axis mapping and spacing in one place

### 5) `TilePicker3D.gd`
Still needed.

Responsibilities:
- perform 3D picking
- emit selected/hovered plot ids
- keep picking separate from rendering

### Important
Do **not** let `GameWorld3D.gd` become a permanent god-object.  
It should coordinate systems, not permanently own all rendering details.

---

## 9) Updated implementation order from this point

### Completed already
1. Create 3D world scene shell
2. Add and improve runtime camera
3. Create reusable 3D tile scene
4. Add temporary local 3×3 tile test
5. Refactor HUD to UI-only
6. Move world-data ownership into `GameWorld3D.gd`

### Recommended next steps
7. Create `PlotRenderer3D.gd`
8. Move tile spawning out of `GameWorld3D.gd`
9. Replace temporary local 3×3 test with real server-driven rendering
10. Optionally add `PlotGridMath.gd` if coordinate logic is about to spread
11. Add `TilePicker3D.gd`
12. Implement 3D tile selection
13. Reconnect claim flow through 3D tile selection
14. Add hover / selected visual feedback
15. Polish camera feel and bounds later

---

## 10) Current testing status

### Verified working
- project launches with a dedicated 3D world scene
- HUD still appears as overlay UI
- camera movement works
- zoom-scaled movement works
- right mouse drag yaw works
- right mouse drag pitch/tilt works
- mouse wheel zoom works
- zoom toward mouse world position works
- reusable tile scene can be spawned in a temporary local test grid

### Not yet verified in final M1 sense
- real server plots rendering in 3D
- 3D tile picking
- 3D claim interaction
- server-driven tile updates appearing live in the 3D world
- expansion updates visually spawning new 3D tiles

---

## 11) Development rules (must follow)

- Never guess file contents: always read project files first.
- Provide exact edit locations: file paths plus exact anchors or line references.
- Keep code modular and avoid spaghetti.
- New systems go in new scripts.
- New file = provide the whole file.
- Existing file = provide minimal patch instructions.
- Prefer Godot editor instructions for scene structure changes.
- Provide educational comments and clear verification/testing steps.
- Think ahead and avoid temporary architecture that will need immediate replacement.

---

## 12) Notes for the next assistant

- M1 has already moved significantly into 3D.
- Do not restart from the old 2D assumptions.
- The HUD is no longer the renderer owner.
- `GameWorld3D.gd` currently holds world data and still contains a temporary local test-grid render path.
- The highest-value next technical step is to create a dedicated `PlotRenderer3D.gd` and replace the temporary local test-grid path with real server-driven 3D rendering.
- After that, add `TilePicker3D.gd` and reconnect claiming through 3D selection.
- Camera improvements can be revisited later, but the current camera is good enough to continue M1 work.