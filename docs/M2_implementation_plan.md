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

Build M2 in 4 steps:

1. **Server data foundation**
2. **Protocol support**
3. **Client mode switching + neighborhood loading**
4. **Local detail rendering**

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

### Add
Potential new responsibilities/scripts:

- `WorldMapRenderer3D.gd`
- `NeighborhoodRenderer3D.gd`
- `OwnedPlotDetailRenderer3D.gd`

You may rename these, but the idea is:

### WorldMapRenderer3D
Responsible for:
- macro map shells
- simplified plot visuals
- resource zone shell visuals

### NeighborhoodRenderer3D
Responsible for:
- rendering the local 7x7 neighborhood window
- handling reduced-detail nearby plots
- handling nearby resource zones

### OwnedPlotDetailRenderer3D
Responsible for:
- full-detail rendering of the owned plot
- rubble
- shack
- interactables
- owned NPC placeholders

This is cleaner than overloading `PlotRenderer3D.gd` with every detail tier.

---

## Client tasks

- [ ] Add render/view mode state
- [ ] Add World Map mode behavior
- [ ] Add Player Plot mode behavior
- [ ] Add enter/exit flow
- [ ] Keep camera handling clean between modes
- [ ] Keep selection/interactions mode-aware

---

# M2.4 - Neighborhood Rendering

## Goal
Render local surroundings while preserving privacy and shared-world continuity.

## Recommended first target
- up to **7x7 plots**
- centered on the owned plot
- smaller near world edges if needed

---

## Rendering rules

### In World Map mode
Render:
- plot bases
- ownership
- shell/public exterior structure
- simplified city silhouette

Do not render:
- interiors
- local clutter
- private detail
- deep NPC state

### In Player Plot mode

#### Owned plot
Render:
- full exterior detail
- blocked/unblocked cells
- rubble/debris
- starter shack
- interactables
- owned NPC placeholder

#### Neighboring player plots
Render:
- shell only
- public exterior only
- no interiors
- no inside-only NPCs

#### Nearby resource zones
Render:
- public/shared exterior features
- visible resource/world objects

---

## Rendering tasks

- [ ] Render owned plot in high detail
- [ ] Render nearby player plots in reduced public detail
- [ ] Render nearby resource zones in reduced public detail
- [ ] Ensure local neighborhood does not require whole-world high-detail rendering

---

# M2.5 - Starter Plot State

## Goal
Make the owned plot feel like the beginning of a real game, not just a tech test.

## First starter state should include
- ruined/blocked sections
- some open usable space
- starter shack placeholder
- rubble/debris placeholders
- starter NPC placeholder/marker
- inspectable elements

This should be visually simple for now, but structurally correct.

---

## Starter-state tasks

- [ ] Generate ruined starter layout on first claim
- [ ] Add blocked/unblocked space data
- [ ] Add rubble/debris placeholder data
- [ ] Add shack placeholder data
- [ ] Add NPC placeholder data
- [ ] Make local elements inspectable in Player Plot mode

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
- add shell data
- add detail data
- add starter plot generation
- add persistence changes

## Phase 2
Protocol
- add enter plot view request
- add neighborhood state response
- add exit plot view request

## Phase 3
Client mode support
- add World Map mode
- add Player Plot mode
- add switching flow

## Phase 4
Rendering
- map shell rendering
- neighborhood rendering
- owned-plot detail rendering

## Phase 5
Starter interactions
- inspect local objects
- inspect rubble/shack/NPC placeholders

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
5. see a local neighborhood centered on their plot
6. see their own plot in high detail
7. still see nearby other plots/resource zones in reduced public detail
8. inspect the ruined starter state of their owned plot
9. exit back to World Map mode

At that point, the project will have the correct structural base for future gameplay.