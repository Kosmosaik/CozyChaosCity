# Milestones

This document tracks the current milestone plan for Cozy Chaos City and clarifies the intended direction of the project as it evolves from a multiplayer prototype into a shared-world city-building/simulation game.

The roadmap is meant to preserve the long-term vision while keeping implementation modular and milestone-driven.

---

## Core Direction

Cozy Chaos City is a **shared-world multiplayer city-building and social simulation game**.

The project is not aiming for isolated player instances or purely abstract city markers. The world should feel continuous, social, and readable from both a macro and local scale.

This means the game should support:

- a **shared world map**
- visible neighboring player cities
- resource zones and streets as public/shared spaces
- richer local detail when focusing on your own city
- privacy where it makes sense, such as interiors
- public visibility where it makes sense, such as exteriors and outside NPCs

The long-term rendering and simulation model should distinguish between:

- **Shell data**  
  High-level city/plot exterior shape visible at long range

- **Exterior public detail**  
  Publicly visible outside structures and objects

- **Interior/private detail**  
  Private interior rooms, furniture, and inside-only actors

- **Public actor visibility**  
  NPCs or actors physically outside and therefore potentially visible to nearby players

- **Private actor visibility**  
  NPCs or actors inside buildings/interiors and not visible to outsiders

This distinction is important and should guide future architecture, rendering, networking, and gameplay.

---

## Completed Milestones

### M0 - Multiplayer Foundation

**Goal**  
Create the first playable networked prototype with a dedicated authoritative server.

**Completed**
- Node.js/TypeScript WebSocket server
- Godot client connection flow
- authoritative world state
- plot claiming
- persistent storage
- reconnect support using server-issued identity/profile data
- basic multiplayer synchronization

**Result**  
The project established a working client/server base and a shared persistent world.

---

### M0.5 - Coordinate World and Expansion Rules

**Goal**  
Move from a rough prototype into a deterministic coordinate-based world model.

**Completed**
- stable coordinate-based plot IDs
- deterministic plot typing rules
- 3x3 starter world
- 3x3 module expansion
- world update broadcasting
- presence snapshots
- latency support
- clearer separation between world data and client rendering

**Result**  
The world became more scalable and predictable, making it suitable for the next rendering milestone.

---

### M1 - 3D Shared World Rendering

**Goal**  
Render the server world in 3D in Godot and support direct plot interaction.

**Completed**
- dedicated 3D world scene
- server-driven tile spawning and updates
- modular 3D plot/tile rendering
- hover and selection in 3D
- click-to-inspect plot flow
- claim flow from in-game popup
- main menu/login overlay
- world disabled until login
- in-game quit/menu controls
- live updates reflected in the 3D world

**Result**  
The project is now a working multiplayer 3D prototype with login, inspection, claiming, persistence, and shared world rendering.

---

## Current Milestone

## M2 - Multi-Scale Shared World Foundation

### Summary

M2 should establish the first proper version of the game's **two-scale shared world**.

This milestone should not treat the player plot as a completely isolated pocket dimension.  
Instead, it should introduce **two viewing/detail modes over the same shared world context**:

- **World Map mode**
- **Player Plot mode**

The difference between these modes is not that they are separate worlds.  
The difference is:

- how much of the world is rendered
- what detail level is rendered
- what the player is allowed to interact with

This preserves the feeling of a real shared world while allowing the player's own city to become richer and more detailed.

---

### M2 Design Intent

The world should remain continuous and social.

The intended player experience is:

1. See the shared world at a macro scale
2. Recognize neighboring cities by their visible shells/exteriors
3. Enter a more local view centered on your own plot
4. Continue seeing nearby surrounding plots/resource zones
5. Interact fully only with your own plot
6. Later see public outside NPC activity in nearby areas while interiors remain private

This means M2 is not just about adding a larger playable area.  
It is about establishing a **multi-scale rendering and data model** that supports both macro and local play.

---

### World Map Mode

**Purpose**
- macro overview
- navigation
- claiming
- seeing city shapes and neighboring development
- understanding the broader structure of the shared world

**Should render**
- plot bases
- ownership/state
- city shells / exterior building silhouettes
- resource zone shells/public exterior structure
- broad roads/terrain markers later

**Should not render**
- interiors
- interior objects
- fine local clutter
- deep simulation details
- most NPC detail

World Map mode should prioritize readability and scale over detail.

---

### Player Plot Mode

**Purpose**
- local city management
- building
- inspection
- future scavenging and early survival tasks
- future exterior/interior switching for the owned plot

When entering Player Plot mode, the client should not render the entire world in high detail.  
Instead, it should render a **local neighborhood window** centered on the player's owned plot.

Recommended first implementation target:
- **up to 7x7 plots centered on the owned plot**
- smaller if the world does not contain a full 7x7 around that location yet

**In this mode:**

#### Owned plot
Render:
- full exterior detail
- local objects
- rubble/debris
- shack/starter structure
- interactables
- owned NPCs
- later interior entry/switching

#### Nearby other player plots
Render:
- shell/exterior only
- public outside structure
- no interior details
- no interior objects
- no inside-only NPCs

#### Nearby resource zones
Render:
- public exterior/resource content
- world objects visible from outside
- later public/shared activity

This keeps the local view socially connected while preserving privacy and performance.

---

### Public vs Private Visibility Rule

This should become a foundational rule for future milestones.

**Public / visible to nearby players**
- plot shell / exterior silhouette
- outside structures
- outside props intended to be visible
- NPCs physically outside in public/shared space
- NPCs outside cities, on streets, or in resource zones

**Private / not visible to outsiders**
- interiors
- interior furniture/objects
- interior-only simulation details
- NPCs located inside player buildings/interiors

For the owner, more detail is visible on their own plot.  
For other players, only public/exterior-facing information should be shown.

This rule should influence:
- data modeling
- rendering
- protocol design
- culling/interest management later
- gameplay expectations

---

### M2 Technical Goals

M2 should introduce the first structure for:

1. **plot shell / summary data**
2. **detailed owned-plot data**
3. **neighborhood-based loading/rendering**
4. **mode switching between World Map and Player Plot**
5. **starter ruined owned plot state**
6. **future outside/public actor visibility**

This should be built in a way that supports later systems without requiring a rewrite.

---

### M2 Deliverables

**World / Data**
- preserve the shared world as the main world model
- introduce shell/exterior summary data for plots
- introduce richer detailed data for owned/local plot content
- support neighborhood-based data centered on a chosen plot
- keep persistence compatible with future expansion

**Client / Rendering**
- World Map mode
- Player Plot mode
- local neighborhood rendering around owned plot
- own plot rendered in higher detail
- neighboring plots/resource zones rendered in reduced public detail
- clear enter/exit flow between modes

**Starter Local Experience**
- ruined starter owned plot
- blocked/unblocked space
- rubble/debris placeholders
- starter shack placeholder
- starter NPC placeholder or marker
- inspectable local elements

**Architecture**
- maintain modular client/server responsibilities
- avoid turning the owned plot into a separate disconnected world
- support future interiors without forcing them into M2
- establish render/detail layers instead of one monolithic world renderer

---

### Recommended First M2 Scope

M2 should focus on structure, not content volume.

Good first-scope priorities:
- define the two-scale world model
- add shell vs detailed plot data separation
- add World Map vs Player Plot mode switching
- add a local neighborhood render window
- make the owned plot feel like a real place with a ruined starter state
- keep neighboring plots visible in reduced detail

This creates the correct container for future gameplay.

---

### M2 Out of Scope

Unless extremely cheap to add, M2 should avoid full implementation of:

- full NPC AI/simulation
- advanced pathfinding
- production chains
- full interiors
- interior furniture systems
- advanced build placement systems
- detailed scavenging loops
- resource extraction depth
- animation-heavy systems
- large-scale optimization work

These can and should come later once the shared-world local-detail structure is in place.

---

### Why M2 Matters

If M2 is done correctly, it becomes the foundation for:

- scavenging and early survival gameplay
- NPC work and outside/public life
- local city management
- exterior vs interior mode switching
- public visibility of neighboring city activity
- future social and logistical systems
- later streets, resource zones, and travel layers

If this is skipped or simplified into isolated instances, the game risks losing the shared-world social identity that makes the concept strong.

---

## Future Milestones

The milestones below remain intentionally broader and may evolve as M2 clarifies architecture.

---

## M3 - Early Plot Gameplay

**Goal**  
Turn the owned plot into the first real playable city space.

**Likely focus**
- clearing rubble
- reclaiming usable building space
- first basic orders/actions
- first starter NPC workflow
- first public-vs-private visibility rules in practice
- first real local object interactions

**Notes**
- should build directly on M2 neighborhood/local detail work
- should not break the shared-world continuity established in M2

---

## M4 - Exterior Building and City Skeleton

**Goal**  
Allow the owned plot to develop visible structure and begin to read like a real city.

**Likely focus**
- roads / pathways
- exterior building placement
- city shell growth visible to neighbors
- public exterior props
- improved shell rendering at map scale
- stronger city identity from outside

**Notes**
- shell/exterior readability should remain important for both World Map and nearby local views

---

## M5 - NPC Life and Work

**Goal**  
Introduce the first meaningful social/simulation layer.

**Likely focus**
- NPC roles
- task assignment / work systems
- movement in outside/public areas
- visible public NPC activity
- gradual support for NPCs existing both outside and inside structures

**Notes**
- outside vs inside visibility should remain a core rule
- other players should not need full private NPC simulation from your interiors

---

## M6 - Interiors and Private Spaces

**Goal**  
Make player buildings feel inhabited and meaningful beyond shell/exterior structure.

**Likely focus**
- interior mode for owned buildings
- rooms
- interior furniture and interactables
- inside-only NPC behavior
- privacy rules for interior state

**Notes**
- this should apply primarily to the owner's plot/buildings
- other players should still only see shell/public-facing information unless special rules are added later

---

## M7 - Resource Zones and Shared Outside Activity

**Goal**  
Expand public/shared world life beyond city plots.

**Likely focus**
- resource zones as shared/public spaces
- outside NPC activity beyond city borders
- travel and public work/extraction
- visibility of friends/NPCs in the outside world
- stronger connection between cities and surrounding land

**Notes**
- this milestone becomes much stronger if M2 already established neighborhood continuity and public actor visibility rules

---

## M8 - Systems Depth and Emergent City Life

**Goal**  
Move from foundational mechanics into richer city simulation.

**Likely focus**
- logistics
- indirect control
- bureaucracy/coordination friction
- production chains
- social outcomes
- more emergent city behavior

**Notes**
- this is where the long-term identity of the game should become clearer
- systems should grow from the modular architecture set earlier, not from shortcuts

---

## Ongoing Rules for All Milestones

These principles should apply throughout the project:

- keep server authority clear
- keep client/server responsibilities modular
- preserve shared-world continuity
- distinguish shell, exterior, interior, public, and private data
- avoid spaghetti architecture
- prefer clear data ownership and protocol boundaries
- build foundations before scale/content explosions
- optimize later unless performance becomes a blocker
- preserve the social readability of the world

---

## Current Priority

The current priority is still **M2 implementation progression**, but the immediate next steps have changed.

The next implementation order should now be:

1. **Player Plot camera parity**
   - carry the current world-view camera feel into Player Plot mode
   - let the player move around the owned plot more freely after entering
   - keep the enter/exit transition, but stop treating local mode as a mostly fixed overview

2. **Real rubble interaction**
   - replace the temporary debug clear flow with real local interaction
   - click rubble object
   - clear it through the normal interaction path
   - remove the rubble object
   - free its occupied hidden cells

3. **Neighborhood rendering after that**
   - only after local camera feel and real rubble interaction are working
   - then add nearby surrounding plots/resource zones in reduced public detail
   - then continue building outward from the owned plot into a true local neighborhood window

The project now has:
- working M1 world flow
- first owned-plot enter/exit mode
- first real local object foundation
- hidden-grid local plot logic under the player-facing scene

So the next milestone work should focus on making the owned plot itself feel playable before expanding into neighborhood rendering.