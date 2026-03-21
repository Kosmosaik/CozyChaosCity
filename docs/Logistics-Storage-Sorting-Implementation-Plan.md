# Early Logistics / Storage / Sorting — Multi-Branch Implementation Plan

## Purpose

This document defines the implementation plan for the first real early-game logistics foundation in **Cozy Chaos City**.

The goal is to build the system in staged branches so that:

- Rubble produces **clean resources** and **Mixed Salvage**
- Scavengers can **extract, carry, drop, and route** output
- A starting **Dump Zone** acts as early intake and overflow
- A **Basic Stockpile** allows filtered storage for selected medium resources
- A **Sorting Station** converts Mixed Salvage into usable materials
- The player gets a first useful **city inventory / logistics UI**

This plan is specifically designed to reduce ambiguity for future GPT assistants and avoid placeholder features or invented systems that are not yet intended.

---

# 1. Locked Design Decisions

## 1.1 Resources in Scope

This implementation phase includes:

- **Scrap Wood**
- **Scrap Metal**
- **Tarp**
- **Mixed Salvage**

Not included in this phase:

- Lighter
- Matches
- Small-item storage
- Crates for small-item storage
- Business/company-owned storage
- Import/global market systems

---

## 1.2 Mixed Salvage Rules

- Rubble currently yields **50% clean resources / 50% Mixed Salvage**
- Later, this ratio will vary by resource node type
- Mixed Salvage must **always be sorted**
- Mixed Salvage:
  - is **Medium**
  - is **not stackable while carried**
  - can exist as a visible loose world item when dropped on the ground

---

## 1.3 Carry Rules

Items must separate carry behavior from storage behavior using fields such as:

- `carry_class`
- `max_stack_carried`
- `max_stack_storage`

### Carry class rules for this phase

#### Small
- Not part of this phase in practical storage gameplay

#### Medium
Used by:
- Scrap Wood
- Scrap Metal
- Tarp
- Mixed Salvage

Rules:
- NPC can carry **1 item per hand**
- Maximum **2 medium items total**
- No true stacked-carry behavior beyond that two-item total

#### Large
- Future only
- No implementation in these branches

---

## 1.4 Rubble Rules

For this implementation phase:

- Only **one Rubble node/tile type**
- Each Rubble tile yields a **random total output between 3 and 8**
- Output appears **one item at a time during work**
- When a scavenger completes one scavenge round, they receive **one item**
- When Rubble is emptied:
  - it plays the current completion/removal behavior
  - then it is deleted like the current implementation

Later:
- Different node types
- Different node sizes
- Different loot tables
- Node-specific clean-vs-unsorted ratios

But not in this implementation phase.

---

## 1.5 Dump Zone Rules

### Starting state
- Player starts with **one Dump Zone** near the shack
- It is usable immediately for dumping
- Player cannot place more Dump Zones in this phase

### Storage rules
- Dump Zone accepts **all items**
- Items become **immediately abstracted** when deposited into the Dump Zone
- Dump Zone has a fixed capacity system

### Capacity rules
- Small item = **1 capacity point**
- Medium item = **2 capacity points**
- Maximum Dump Zone capacity = **200 capacity points**

### Full behavior
When the Dump Zone is full:

- warning message appears
- haulers warn that the Dump Zone is full
- haulers stop trying to haul to it for **1 minute**
- after 1 minute they retry

If new scavenged output needs somewhere to go and no valid nearby stockpile exists:
- the item is dropped on the ground near the resource node

This prevents total deadlock.

---

## 1.6 Basic Stockpile Rules

### Unlock timing
- Early unlock after starting gameplay
- Must be **constructed**, not created for free by painting an area

### Build cost
- **4 x Wooden Pallets**

These pallets must be:
- manufactured
- physically delivered to the build site

### Structure
One Basic Stockpile is:
- one placed object
- containing **4 pallets total**
- each pallet = **1 slot**
- total = **4 slots**

### Slot rules
- One slot can contain **only 1 resource type**
- One slot holds **20 medium items**

### Filtering
- Player places the stockpile first
- Then configures filters afterward
- No hauling into the stockpile occurs until the player has activated at least one filter

### Allowed contents
Basic Stockpile is for pallet-suitable, stackable medium resources, such as:
- Scrap Wood
- Scrap Metal
- Tarp

Not for:
- small loose items
- tiny junk
- later things that should require crates or dedicated small-item storage

### Multiple stockpiles
- Allowed
- Can use the same filter layout if desired

### Changing filters
Changing a slot to a different resource type is allowed, but:

- if the slot already contains another resource,
- haulers must first move the old contents elsewhere:
  - another valid stockpile
  - or the Dump Zone

### Visuals
- Basic Stockpile must visually show stored items
- Use a **representative visual stack**, not one model per unit

### Layout note
The logical structure is locked:
- 4 pallets total
- 2x2 pallet layout
- walking space between pallets

Exact final tile footprint may be adjusted during implementation, but the **4-slot stockpile structure is fixed**.

---

## 1.7 Sorting Station Rules

### Unlock timing
- Early unlock after start
- Built after the player has enough resources and has unlocked it

### Build cost
- **1 x Wooden Pallet**
- **4 x Scrap Wood**
- **2 x Scrap Metal**

### Function
- Takes **Mixed Salvage** from the Dump Zone only
- Sorting is triggered via the **Order system**
- Uses **worker time only**
- No fuel/tools/additional inputs in this implementation phase

### Output rules
Sorting output is random and can produce:

- Scrap Wood
- Scrap Metal
- Tarp

### Output routing
Sorted output may be hauled:
- to a valid Basic Stockpile
- directly to a build site if the item is needed there
- to the Dump Zone as fallback if no better destination exists

---

## 1.8 Scavenge / Carry / Drop / Haul Rules

### Direct haul rule
Locked for now:
- If a valid destination is within **8 tiles**, direct haul is allowed

### Clean resource routing priority
If a clean resource is found and multiple destinations are possible:

1. matching stockpile
2. Dump Zone
3. ground

### If stockpile is far away but Dump Zone is nearby
- Prefer the Dump Zone

### If no valid nearby destination exists
- scavenger drops the item on the ground near the resource node
- it remains there until hauled later

### Ground item behavior
- ground items can remain forever for now
- later a thief/despawn system may remove them, but not in this phase
- ground items can be hauled from anywhere as long as they are not reserved
- identical nearby loose items should merge/stack

---

## 1.9 Ownership / Reservation Rules

For this implementation phase:

- everything gathered is **city-owned / colony-owned**
- NPCs only **reserve/claim temporarily** for jobs
- personal ownership/claiming is future work

Later:
- companies/businesses will have more control
- NPCs may claim personal items under specific rule sets

But not now.

---

## 1.10 Construction Delivery Rules

Physical construction delivery should be introduced when buildable storage/processing structures are part of the branch.

Rules for that phase:

- any buildable requiring resources needs **physical delivery**
- construction sites have **input buffers**
- delivered materials are visibly placed at the site
- those materials are locked there until:
  - construction finishes
  - or the blueprint/designation is removed

Future behavior:
- wrong deliveries
- over-delivery
- extra materials
- NPC mistakes

Not part of current implementation branches unless explicitly added later.

---

## 1.11 UI Direction for This Phase

For now:

- use **exact numbers**
- build **one practical UI**, not separate normal-vs-debug systems yet

### First UI scope
The first city UI should show:
- city inventory
- blocked messages
- activities
- reports
- warnings

### Inventory layout
- simple panel/list
- first level = total amount by item type
- expandable `+` tree for source breakdown

### Source breakdown
For now, show totals by source:
- Dump Zone
- Stockpiles
- Sorting Station
- Ground / loose items

Do **not** include for now:
- in transit
- reserved
- estimated vs true comparison
- personality-based reporting errors
- flavor report language

### Local click panels
Planned panels for:
- Dump Zone
- Basic Stockpile
- Sorting Station

These should show local inventory at that specific object/location.

---

# 2. Recommended Branch Split

This work should be split into smaller branches to keep scope under control and avoid fragile half-systems.

---

## Branch 1 — Resource Extraction, Loose Items, and Dump Zone Intake

### Goal
Create the first working scavenging output loop with Rubble, clean resources, Mixed Salvage, loose ground items, item carrying/dropping, and Dump Zone intake.

### In scope
- resource/item definitions:
  - Scrap Wood
  - Scrap Metal
  - Tarp
  - Mixed Salvage
- carry class data support
- Medium item carry rules
- one Rubble node type
- Rubble loot behavior:
  - 3–8 total outputs
  - 50/50 clean resources vs Mixed Salvage
  - one output per scavenge round
- item pickup / carry / drop presentation
- loose world items
- loose item stacking/merging on ground
- direct-haul logic within 8 tiles
- routing to Dump Zone or ground
- starting Dump Zone near shack
- Dump Zone abstraction behavior
- Dump Zone capacity logic
- Dump Zone full warning / retry cooldown
- reservation basics for hauling/pickup

### Out of scope
- Basic Stockpile
- Sorting Station
- physical construction delivery
- player-facing city inventory UI beyond minimal temporary dev help if absolutely necessary

### Success condition
The player can scavenge Rubble and produce Scrap Wood, Scrap Metal, Tarp, and Mixed Salvage. NPCs can carry, drop, and haul those outputs. The starting Dump Zone accepts and abstracts them, while overflow falls back to loose ground drops.

---

## Branch 2 — Basic Stockpile Construction and Physical Delivery

### Goal
Introduce the first true buildable filtered storage and the first real physical construction delivery loop.

### In scope
- Wooden Pallet as manufactured construction input
- Basic Stockpile as a buildable object
- physical delivery required to construct it
- construction input buffer
- visible delivered materials at build site
- Basic Stockpile 4-slot pallet system
- slot filtering behavior
- slot capacity:
  - 20 medium items per slot
- no hauling into stockpile until filters are assigned
- multiple stockpiles allowed
- changing filters requires relocation of conflicting stored contents
- stockpile visuals using representative stack props
- routing update so clean resources prefer matching stockpile when available

### Out of scope
- Sorting Station
- city inventory UI
- small-item storage
- business/company storage

### Success condition
The player can build a Basic Stockpile through physical material delivery, assign filters, and use it as the first organized storage alternative to the Dump Zone.

---

## Branch 3 — Sorting Station and Mixed Salvage Processing

### Goal
Introduce the processing loop that converts Mixed Salvage into usable materials.

### In scope
- Sorting Station buildable
- physical material delivery required to construct it
- Sorting Station order request through the Order system
- worker-time sorting process
- Dump Zone → Sorting Station input flow
- random output conversion into:
  - Scrap Wood
  - Scrap Metal
  - Tarp
- output routing to:
  - stockpiles
  - build sites
  - Dump Zone fallback

### Out of scope
- additional resource node types
- small-item storage
- advanced dump penalties as full gameplay systems

### Success condition
The player can order Mixed Salvage from the Dump Zone to be sorted into usable materials, and those outputs can re-enter the logistics network.

---

## Branch 4 — First City Inventory / Logistics UI

### Goal
Give the player a practical exact-number logistics view while the later NPC-reporting fantasy is still under development.

### In scope
- one city inventory panel visible while inside the owned plot
- expandable tree view:
  - total by item type
  - source breakdown by location type
- source categories include:
  - Dump Zone
  - Stockpiles
  - Sorting Station
  - Ground / loose items
- blocked messages
- activity messages
- warnings
- local click panels for:
  - Dump Zone
  - Basic Stockpile
  - Sorting Station

### Out of scope
- estimated vs true count comparison
- confidence systems
- NPC-spoken flavor reports
- forecasting/report quality systems
- in-transit/reserved UI layers

### Success condition
The player can inspect exact city inventory totals and source breakdowns and see the first useful warnings, block states, and activity messages related to logistics.

---

# 3. Recommended Branch Order

Implementation order should be:

1. **Branch 1 — Resource extraction / loose items / Dump Zone**
2. **Branch 2 — Basic Stockpile + physical construction delivery**
3. **Branch 3 — Sorting Station**
4. **Branch 4 — Inventory / logistics UI**

This order matches both the gameplay flow and the technical dependency chain.

---

# 4. Important Future Systems That Must Not Be Improvised Yet

These are intentionally deferred and should **not** be quietly added as placeholders:

- additional node types
- different node size variants
- small-item storage
- lighters/matches
- crates
- advanced dump penalties
- rats / contamination / smell / fire systems
- NPC personal ownership
- company/business-owned storage
- estimated inventory reporting
- mistaken deliveries / wrong deliveries / over-delivery
- in-transit or reserved inventory UI
- imports / market / other players
- personality-driven reporting mistakes

---

# 5. Branch Guiding Statement

Use this as the main scope guard for the next GPT assistant:

**Build the first early-game logistics foundation in staged branches: Rubble extraction and Dump Zone intake first, then buildable filtered stockpiles with physical construction delivery, then Mixed Salvage sorting, then an exact-number city inventory UI.**

---

# 6. Notes for the Next GPT Assistant

## Do not invent placeholder systems
If something is not yet included in the branch scope, do not create temporary fake versions unless explicitly requested.

## Do not widen scope
The branch should stay focused on the success condition defined for that branch.

## Do not assume later systems already exist
Examples:
- company-owned storage
- reporting uncertainty
- tiny-item storage
- market/import logic
- NPC inventory mistakes

## Treat the Basic Stockpile structure as locked
Even if final footprint details are adjusted, the design intent is fixed:

- 1 stockpile object
- 4 pallet slots
- 2x2 pallet arrangement
- visible storage stacks
- filtered by slot

---

# 7. Final Summary

This implementation phase is about establishing a clean foundation for:

- extraction
- carrying
- dropping
- hauling
- dumping
- stockpiling
- sorting
- first-pass inventory visibility

It should be done in staged branches to avoid messy shortcuts and to keep the architecture expandable for later city-scale logistics, business-owned storage, and NPC-driven reporting systems.