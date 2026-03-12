# M2 Implementation Plan

## M2 Goal

Introduce the first working version of the game's **multi-scale shared world**.

The world remains shared and continuous, but the client supports 2 different view/detail modes:

- **World Map mode**
- **Player Plot mode**

World Map mode shows the broader world in simplified shell/public exterior form.

Player Plot mode shows a **local neighborhood window** centered on the owned plot:
- own plot = high detail
- nearby other plots = reduced public/exterior detail
- nearby resource zones = reduced public/public-world detail

---

## Main M2 Rule

Do **not** turn the owned plot into a disconnected private instance.

Instead:
- keep one shared world
- switch render/detail mode
- change interaction scope
- change neighborhood radius

---

## M2 Technical Strategy

Build M2 in practical vertical slices:

1. **Server data foundation**
2. **Client mode switching + first local owned-plot rendering**
3. **Player Plot camera parity**
4. **Real local interaction with rubble**
5. **Neighborhood loading/rendering after the owned plot feels playable**

---

# M2.1 - Server Data Foundation

## Goal
Extend the world model so each plot can support:
- shell/public summary data
- richer local detail data
- future visibility rules

## Required concepts

### 1. Plot shell data
This is lightweight data used for World Map mode and nearby reduced-detail rendering.

Examples:
- shell type
- shell variant
- exterior stage
- public exterior markers
- later roof/block silhouette info

This should be visible to anyone who can see the plot.

### 2. Plot detail data
This is richer data used primarily for the owned plot in Player Plot mode.

Examples:
- local cell grid
- blocked/unblocked cells
- rubble/debris
- starter shack
- interactables
- owned NPC placeholders
- later interior entrances

### 3. Visibility split
The data model should already distinguish between:
- shell/public exterior data
- detailed owned-plot data
- future interior/private data

You do not need full interior systems now, but the model should leave room for them.

---

## Server tasks

- [ ] Add shell/public summary data to plots
- [ ] Add detailed owned-plot/local data structure
- [ ] Add starter ruined state generator for claimed player plots
- [ ] Ensure plot detail is persisted
- [ ] Keep old world functionality working during transition

---

## Suggested data direction

### Current world plot
Keep the existing world plot as the main shared plot record.

Expand it with something like:
- `shell`
- `detail`
- later `interior_refs` or similar

### Shell data should be lightweight
Used in:
- World Map mode
- nearby non-owned plot rendering

### Detail data should be richer
Used in:
- owned plot local rendering
- inspectable local interactions later

---

# M2.2 - Protocol Additions

## Goal
Allow the client to request and receive the correct data for:
- World Map mode
- Player Plot mode neighborhood view

## Important design rule
Do not make protocol assume "load isolated private plot only".

Instead, protocol should support:
- broad world state for map mode
- local neighborhood state for plot mode

---

## Required protocol additions

### 1. Enter plot mode request
Client tells server which owned plot it wants to focus on.

Example concept:
- `enter_plot_view`

### 2. Neighborhood state response
Server returns data centered around that plot.

Example concept:
- center plot id
- radius
- visible neighboring plots
- shell data for neighbors
- detailed data for owned plot
- visible public resource-zone data nearby

### 3. Exit plot mode request
Client returns to World Map mode.

Example concept:
- `exit_plot_view`

### 4. Future patch/update support
Later, local detail updates should be patchable, but M2 can begin with full neighborhood snapshot responses if simpler.

---

## Protocol tasks

- [ ] Define request for entering Player Plot mode
- [ ] Define response carrying neighborhood state
- [ ] Define request for exiting Player Plot mode
- [ ] Keep existing world-state protocol intact where possible
- [ ] Make new protocol version changes carefully and consistently

---

# M2.3 - Client Mode Switching

## Goal
Support 2 client modes cleanly without turning one script into a mess.

## Recommended approach
Keep one high-level world controller, but split responsibilities by renderer and mode.

---

## Recommended client structure

### Keep
- `GameWorld3D.gd` as the high-level world coordinator

### Add / preserve
Potential responsibilities/scripts:

- `PlotRenderer3D.gd`
- `OwnedPlotDetailRenderer3D.gd`

Later, when neighborhood rendering is ready, a separate neighborhood renderer may still be added, but it should not be forced in before the owned plot itself feels good to play in.

### PlotRenderer3D
Responsible for:
- macro map shells
- simplified plot visuals
- resource zone shell visuals

### OwnedPlotDetailRenderer3D
Responsible for:
- owned-plot local ground
- local rubble objects
- starter shack
- interactables
- owned NPC placeholders
- later local building/clear interactions

This is cleaner than overloading one renderer with every detail tier.

---

## Client tasks

- [x] Add render/view mode state
- [x] Add World Map mode behavior
- [x] Add Player Plot mode behavior
- [x] Add enter/exit flow
- [x] Keep selection/interactions mode-aware
- [ ] Carry world-style camera movement into Player Plot mode after entering
- [ ] Keep local camera control feeling natural and playable
- [ ] Keep camera handling clean between modes without turning local mode into a locked showcase view

---

# M2.4 - Local Camera and Neighborhood Progression

## Goal
Do not jump into neighborhood work too early.

Before adding nearby surrounding plots, make the owned plot itself feel properly playable.

---

## Immediate next goal: Player Plot camera parity

After entering Player Plot mode, the player should be able to move around the owned plot more freely using the same general camera feel as world view.

This means:
- preserve the existing enter/exit transition
- preserve the current camera rig philosophy
- allow freer local camera movement after entering
- avoid making Player Plot mode feel like a mostly fixed overview shot

---

## After camera parity: real rubble interaction

Once local camera control feels right, replace the temporary debug clear path with a real interaction flow:

- click rubble object
- validate interaction
- send clear action
- remove rubble object
- free its occupied hidden cells
- refresh the local plot view

This becomes the first real local gameplay loop.

---

## Neighborhood comes after that

Only once:
- local camera feels good
- rubble interaction feels real
- the owned plot itself feels playable

then proceed with:

- nearby surrounding plots in reduced public detail
- nearby resource zone surroundings
- local neighborhood window centered on the owned plot

---

## Future neighborhood target

Recommended first target later:
- up to **7x7 plots**
- centered on the owned plot
- smaller near world edges if needed

But this should now be treated as a **later M2 sub-step**, not the immediate next implementation target.

---

## Tasks

- [ ] Carry world-style camera behavior into Player Plot mode
- [ ] Support freer camera movement inside the owned plot
- [ ] Replace debug clear with real rubble click interaction
- [ ] Add proper local clear/remove feedback
- [ ] Only after that, add neighborhood loading/rendering

---

# M2.5 - Starter Plot State

## Goal
Make the owned plot feel like the beginning of a real game, not just a tech test.

## Current implemented checkpoint
The project now has an early but real starter-state implementation:
- larger owned local plot area
- centered starter shack
- rubble represented as real placed `4x4` local objects
- hidden grid/cells retained underneath for:
  - blocking
  - clearability
  - future snapping / structure placement
- temporary NPC marker
- temporary debug clear path for removing rubble

## First starter state should include
- ruined/blocked sections
- some open usable space
- starter shack
- rubble objects
- starter NPC placeholder/marker
- inspectable local elements later

This should remain visually simple for now, but structurally correct.

---

## Starter-state tasks

- [x] Generate ruined starter layout on first claim
- [x] Add blocked/unblocked space data
- [x] Add starter shack data
- [x] Add starter NPC placeholder data
- [x] Add starter rubble object data
- [x] Add temporary debug clear path
- [ ] Make local elements inspectable in Player Plot mode
- [ ] Replace temporary NPC marker with a real NPC scene
- [ ] Improve final ground / rubble art polish

---

# M2.6 - Visibility Rules Foundation

## Goal
Lock the public/private rendering model early.

## Rule set

### Public
- plot shell
- outside structures
- public exterior props
- later outside NPCs in public/shared areas

### Private
- interiors
- interior objects
- interior-only NPC state

For M2:
- fully enforce shell/public vs interior/private structure
- outside NPC cross-player visibility can remain future-facing, but the architecture should allow it

---

## Visibility tasks

- [ ] Separate shell/public data from private/interior-facing data
- [ ] Ensure neighboring plots do not expose private internals
- [ ] Keep owned-plot detail privileged to owner view
- [ ] Prepare for future outside/public NPC visibility

---

# M2 Suggested Development Order

## Phase 1
Server model first
- [x] add shell data
- [x] add detail data
- [x] add starter plot generation
- [x] add persistence changes

## Phase 2
Client mode support
- [x] add first Player Plot mode
- [x] add enter/exit switching flow
- [x] add owned-plot local rendering foundation

## Phase 3
Protocol / data safety
- [x] keep owned-plot detail privileged to owner view
- [x] compact large local detail payloads for safer runtime behavior

## Phase 4
Owned-plot playability
- [ ] carry world-style camera behavior into Player Plot mode
- [ ] make local camera movement feel natural after entering
- [ ] keep local mode readable without locking the player into a static overview

## Phase 5
Starter interactions
- [ ] inspect local objects
- [ ] replace temporary debug clear flow with proper rubble interaction
- [ ] click rubble -> clear -> remove object -> free cells
- [ ] add stronger local build/clear interaction rules

## Phase 6
Neighborhood work
- [ ] add protocol for local/neighborhood view
- [ ] add local neighborhood data handling
- [ ] render nearby shell/public neighbor plots
- [ ] render nearby public resource-zone surroundings

---

# M2 Out of Scope

Do not let M2 expand into:
- full NPC AI
- full interiors
- production chains
- advanced building systems
- deep scavenging loops
- heavy optimization passes unless required

M2 is about **foundation and structure**.

---

# Definition of Done for M2

M2 is done when a player can:

1. log in
2. see the world in **World Map mode**
3. claim a player plot
4. enter **Player Plot mode**
5. move around their owned plot with a proper local camera
6. see their own plot in high detail
7. interact with rubble through a real click/clear/remove flow
8. exit back to World Map mode
9. see nearby other plots/resource zones in reduced public detail once neighborhood rendering is added

This keeps M2 grounded in a proper owned-plot gameplay loop first, then expands outward into the shared local neighborhood.