# Vertical Cozy City — Combined Living Document v1 (No-Loss Merge)

---

## 0) Project Snapshot (Merged Core)

**High concept:** A cozy, slow-paced but system-heavy multiplayer simulation where each player owns a dense, vertical micro-city made of room-blocks. NPCs are the protagonists, becoming increasingly autonomous as the city grows.

**Core fantasy:** “I helped create this place — and now it’s doing things I never planned.” 

**Tone:** cozy + claustrophobic + absurd bureaucracy + visible suffering that is funny/instructive, not moralized.  

**Hard identity rules:**
- Player is an abstract planner/mayor-like force, not a character in the world.  
- NPCs are aware of your presence and can react to your actions and if they are unhappy with you, they may leave, rebel, increase prices, or reduce productivity.
- No conveyors. Production is people-driven. Example: A worker must physically carry goods from one station to another.
- No direct violence/combat. Conflict is strikes/protests/sabotage/unionization/corruption.  

---

## 1) Lock-Ins and Canon (Merged Core)

### 1.1 Direction 3 — High NPC Autonomy (Locked)
NPC autonomy increases with scale:
- Early: NPCs ask  
- Mid: NPCs negotiate  
- Late: NPCs act (with or without permission)

Loss of control is desired.  

### 1.2 Player Agency (Indirect Only)
Player cannot:
- kill/harm NPCs directly
- directly fire or evict NPCs
- use emergency override “god powers” to force outcomes

Player can:
- build/remove/decorate
- provide incentives and access
- neglect or overinvest
- shape environment, not outcomes  

### 1.3 “People, Not Belts” Production Philosophy
- No conveyors.
- Orders and outputs happen because people walk, communicate, misunderstand, reprioritize, and sometimes sabotage.  

### 1.4 Signature System — Order-Based Logistics
Orders are created and transmitted through imperfect systems:
- telegram machines (paper/clerks)
- pneumatic tubes
- messengers/runners

Orders can be delayed, lost, misunderstood, deprioritized, sabotaged. 

---

## 2) World Structure and Multiplayer (Merged Core)

### 2.1 Player-Owned Block Clusters
Each player owns a **private block cluster**, not one shared city.
- Blocks are rooms with types, furniture, machines, storage, and NPC navigation.
- Other players see exteriors + block type + public stats.
- You see interior detail: workers, orders, efficiency, tension, chaos.  

### 2.2 Vertical Class Layers
Lower layers:
- pollution, noise, cheap housing, heavy industry

Upper layers:
- cleaner air, education, management, wealth

Neglect leads to decay; investment leads to gentrification. 

### 2.3 Multiplayer Philosophy
- Players trade and compete economically and indirectly affect each other.
- No direct griefing; interactions are systemic.  

---

## 3) Interiors as Gameplay (Merged Core)

Rooms are physical spaces; layout is gameplay.
Players place:
- walls/floors
- furniture/decor
- machines/work surfaces
- storage

NPCs must physically navigate:
- bad layout causes congestion, delays, stress, accidents, inefficiency
- no auto-optimize; watching inefficiency is part of the fun 

Preset rooms:
- fast to place
- inefficient
- encourage later customization  

---

## 4) Economy, Materials, and Scarcity (Merged Core)

### 4.1 Materials
Primary early materials:
- Iron
- Coal
- Copper  

Advanced materials:
- Cables
- Machinery parts
- Electronics
- Structural components  

### 4.2 Global Market + Local Choice
There is a global shared market.
NPC businesses choose:
- sell locally (benefit city)
- sell to other player cities (profit)
- sell globally (profit)

Markets can crash; monopolies can form. Debt is normal but can be dangerous.   

---

## 5) Social Systems and Politics (Merged Core)

No combat. Conflict manifests as:
- strikes
- walkouts
- sabotage
- protests
- unionization
- corruption

Ideology can override needs; factions form through conversation.   

Education:
- takes time
- increases efficiency/quality/awareness
- skills do not decay
- educated NPCs may leave   

---

## 6) Time, Pace, and Decay (Merged Core)

- 1 in-game day ≈ 10 real minutes (tentative but repeated across docs).  
- No pause (multiplayer).
- Buildings age; infrastructure decays visibly.
- Decay can be mitigated but not fully stopped.
- No fixed endpoint; long-term transformation.  

---

## 7) Early Gameplay (Merged Core + New Notes)

### 7.1 In the original docs
Early loop described as:
- 0–30 min: one person, one apartment, manual hobby production, tiny profits, first market interaction
- 30–90 min: buy a new block, new NPC moves in, first logistics delays
- beyond: NPC autonomy accelerates  

### 7.2 New Notes (2026-03-02): Survival-first start
New direction discussed:
- Start with **one NPC in a small shelter** with **no light/heat/electricity/food stability**.
- Phase 0: manual survival loop (scavenge, fire pit, candles/oil, bucket water, waste spot, basic storage).
- Phase 1: “dirty & primitive electricity” (charcoal + tiny generator), hand pump, oil lamps/candles.
- Later: stabilize utilities, attract more NPCs, then expand into deeper production lines.

This is intended to keep the early feel **primitive and readable** while enabling deep upgrade arcs later.

### 7.3 New Notes (2026-03-02): Economy completeness
Concern: closed internal economy needs “money/value injection” or non-money systems.
Candidate approaches discussed:
- Exports, grants/budgets, external contracts, visitors/tourism, immigration savings/remittances
- Sinks: imports, maintenance, permits, taxes upward, decay/spoilage/tool wear
- Alternative: money-lite with city stockpile + debt/favors

(These are not in the uploaded docs; included here to preserve the new direction.)

---

## 8) Development Roadmap (Merged Core)

Milestones (v2) and rough asset needs are preserved here. 

### M0 — Project Skeleton (completed)
Goal: always-on dedicated server + multiple clients connect, server assigns plots, expands world, reconnect restores plot.  
Assets: placeholder ground tile, plot markers, plot highlight, debug UI. 

### M1 — World & Plots
Goal: shared world visuals and plot claiming clarity (in 3D).  
Assets: plot tile, borders, claimed/unclaimed indicators. 

### M2 — Camera & View Levels
Goal: shell/interior viewing feels correct; removable roof/cutaways.  
Assets: block shell, roof, wall segments, floor. 

### M3 — Time System
Goal: time exists and is trusted.  
Assets: clock UI. 

### M4 — Starter Block & First NPC
Goal: each player starts with a living place.  
Assets: starter block exterior/interior + NPC model and basic animations. 

### M5 — Resources & Inventory (Minimal)
Goal: resources visible; production/growth have meaning.  
Assets: UI icons (stone, wood, food, money), inventory UI panel. 

### M6 — Planning Mode
Ghost blocks + cost previews. 

### M7 — Construction Mode & Spectacle
Construction vehicle + dust + SFX. 

### M8 — Interior Furnishing
Chair/table/storage + starter hobby machine + decoration. 

### M9 — NPC Movement & Work
Interaction markers + thought bubble icons. 

### M10 — NPC Needs & Growth Pressure
Need icons (“need better machine”, “need more space”) + tooltips. 

### M11 — New NPCs Move In
NPC variations + arrival cue. 

### M12 — Market (Stub)
Market UI + buy/sell buttons + trend arrows. 

### M13 — Public vs Private Information
Public stats panel + hover outlines. 

### M14 — First “This Is the Game” Moment
Cohesion pass + ambient sounds. 

---

## 9) Milestone 0 Technical Spec (Merged Core)

M0 defines:
- one always-on dedicated server (Node.js + TypeScript)
- multiple Godot clients connect without hosting
- server-authoritative world state + plot assignment
- world expansion when plots run out
- no accounts/passwords; reconnect restores plot and minimal progress
- persistence via JSON world_state file
- protocol: JSON over WebSocket

The spec includes a recommended repo layout, message protocol, and copy-paste code for:
- Node server (ws) with world gen, expansion, persistence
- Godot 4 client with WebSocketPeer, identity token, simple plot rendering

Full spec preserved verbatim in Appendix A. 

---

## 10) Open Design Questions (Merged Core)

Open questions remain in areas such as:
- what is always visible vs inferred; how misinformation works
- soft vs hard limits; what “emergency overrides” mean in practice
- education duration
- max players
- how one player’s failure affects others
- collapse mechanics (block collapse?)
- endgame / replayability framing
- how “cozy exploitation” works without griefing

Full question list preserved verbatim in Appendix D. 

---

# Vertical Cozy City — Development Milestones & Asset Needs (Living Roadmap v2)

This document extends **Development Milestones v1** by adding a **rough asset list**
for each milestone.

The asset lists are:
- intentionally **non-exhaustive**
- scoped for **early development**
- suitable for **Blockbench-style low-poly / blocky assets**
- meant to guide parallel work between code and art

Assets can (and will) be reused across milestones.

---

## How to Use This Document

- Milestones are completed **top to bottom**
- Assets listed are the **minimum set** to visually support the milestone
- Placeholder / graybox assets are acceptable
- Detail and polish come later during deep dives

---

# MILESTONE 0 — Project Skeleton

**Goal:** A running project that can host future systems safely.

### Required Assets
- [ ] Placeholder ground tile / plane
- [ ] Placeholder plot boundary marker (lines, fences, pylons)
- [ ] Simple player plot highlight decal
- [ ] Debug UI font / icons

**Notes**
- Visual quality does not matter here
- Everything can be gray or flat colored

---

# MILESTONE 1 — World & Plots

**Goal:** A shared world where players can exist side-by-side.

### Required Assets
- [ ] Plot base tile (ground texture or mesh)
- [ ] Plot border mesh (low wall, curb, fence, painted line)
- [ ] Claimed plot indicator (flag, sign, glow, banner)
- [ ] Unclaimed plot indicator (different color / decal)

**Notes**
- Plots should read clearly from far zoom
- Shape language should already suggest “blocks will grow here”

---

# MILESTONE 2 — Camera & View Levels

**Goal:** Looking at the city feels correct.

### Required Assets
- [ ] Block shell mesh (generic exterior)
- [ ] Roof mesh (simple removable roof)
- [ ] Exterior wall segments
- [ ] Interior wall segments (can reuse exterior early)
- [ ] Floor tile mesh

### Optional (Nice to Have)
- [ ] Simple cutaway shader or material variant
- [ ] View-level UI icons (Shell / Interior)

**Notes**
- Same mesh can be reused and hidden/shown per view level
- No need for visual fidelity yet — clarity first

---

# MILESTONE 3 — Time System (Quiet but Real)

**Goal:** Time exists and is trusted.

### Required Assets
- [ ] Clock UI icon
- [ ] Simple UI panel/background for clock

**Notes**
- No animated clocks needed
- Keep UI minimal and readable

---

# MILESTONE 4 — Starter Block & First NPC

**Goal:** Every player starts with a living place.

### Required Assets
- [ ] Starter block exterior (rough / unfinished look)
- [ ] Starter block interior floor
- [ ] Starter block interior walls
- [ ] Door (simple)
- [ ] Window (simple)

### NPC Assets
- [ ] NPC base model (humanoid, blocky)
- [ ] NPC idle animation
- [ ] NPC walk animation
- [ ] NPC work animation (generic loop)

**Notes**
- One NPC model is enough
- Variations can be color swaps later

---

# MILESTONE 5 — Resources & Inventory (Minimal)

**Goal:** Production and growth have meaning.

### Required Assets
- [ ] Resource UI icons:
  - [ ] Stone
  - [ ] Wood
  - [ ] Food
  - [ ] Money
- [ ] Inventory UI panel background

**Optional**
- [ ] Simple world props for resources (pile of stone, logs)

---

# MILESTONE 6 — Planning Mode

**Goal:** Safe experimentation before commitment.

### Required Assets
- [ ] Ghost block material (transparent / outline)
- [ ] Ghost wall / floor / roof variants
- [ ] Cost preview UI icons (reuse resource icons)

**Notes**
- Ghost versions can reuse real meshes with special material

---

# MILESTONE 7 — Construction Mode & Spectacle

**Goal:** Building feels physical and rewarding.

### Required Assets
- [ ] Construction vehicle (truck / digger / crane)
- [ ] Construction vehicle idle animation
- [ ] Construction vehicle drive animation
- [ ] Construction sound effects (engine, hammering)
- [ ] Construction dust / debris particle

**Notes**
- One vehicle type is enough early
- Vehicles do not need complex physics

---

# MILESTONE 8 — Interior Furnishing

**Goal:** Rooms become real spaces.

### Required Assets
- [ ] Chair
- [ ] Table
- [ ] Storage box / shelf
- [ ] Hobby machine (starter tier)
- [ ] Interior decoration prop (lamp, poster, plant)

**Notes**
- Furniture scale and collision readability are critical
- Visual charm > realism

---

# MILESTONE 9 — NPC Movement & Work

**Goal:** NPCs feel alive.

### Required Assets
- [ ] NPC interaction markers (work spot, idle spot)
- [ ] Simple thought bubble icon (neutral)
- [ ] Path debug overlay (optional)

**Notes**
- NPC animation reuse is encouraged
- Avoid adding many animations early

---

# MILESTONE 10 — NPC Needs & Growth Pressure

**Goal:** NPCs push the city to grow.

### Required Assets
- [ ] Need icons:
  - [ ] “Need better machine”
  - [ ] “Need more space”
- [ ] Tooltip UI background
- [ ] Highlight effect for relevant machine/block

**Notes**
- Needs should be readable from medium zoom
- Avoid text-only indicators

---

# MILESTONE 11 — New NPCs Move In

**Goal:** City begins to populate.

### Required Assets
- [ ] NPC variation (color, hat, accessory)
- [ ] Spawn/arrival visual cue (door open, fade-in)

**Notes**
- Variations can be extremely light-weight
- Even a hat color goes a long way

---

# MILESTONE 12 — Market (Stub)

**Goal:** Production connects to economy.

### Required Assets
- [ ] Market UI panel
- [ ] Buy/Sell button icons
- [ ] Trend arrow icons (up/down)

**Optional**
- [ ] Abstract “market” building shell (visual flavor)

---

# MILESTONE 13 — Public vs Private Information

**Goal:** Multiplayer observation without intrusion.

### Required Assets
- [ ] Public stats UI panel
- [ ] Public stat icons (output, blocks, population)
- [ ] Hover outline for other players’ plots

**Notes**
- Avoid information overload
- Public data should feel vague but useful

---

# MILESTONE 14 — First “This Is the Game” Moment

**Goal:** Confirm the core fantasy works.

### Required Assets
- [ ] Minor visual upgrades to earlier assets
- [ ] Additional decoration props
- [ ] Subtle ambient sounds (wind, city hum)

**Notes**
- This milestone is about cohesion, not new assets
- Reuse everything

---

## General Asset Guidelines (Blockbench-Friendly)

- Prefer **modular pieces**
- Avoid baked lighting
- Keep poly count low
- Use color + shape for readability
- Assets should look good from:
  - far shell view
  - medium interior view
  - close-up NPC interaction view

---

End of Living Roadmap v2.

---

## Appendix C — Vertical Cozy City — Living Document v0 (verbatim)
Source: 

---
# Vertical Cozy City

## Complete Vision, Systems, Vibe & Development Grounding (Living Document v0)

> This document is intentionally **long, rich, and redundant**.\
> It is not optimized for scanning.\
> It exists to **preserve the soul, details, examples, and intent** of
> the project.\
> Nothing here is final. Nothing here is minimal.

------------------------------------------------------------------------

## 1. Core Fantasy

Vertical Cozy City is about **watching a dense, messy, vertical society
grow beyond your control**.

You do not play a hero.\
You do not play a ruler.\
You do not play a character at all.

You shape conditions.\
People live inside them.

The fantasy is: \> "I helped create this place --- and now it's doing
things I never planned."

The city is: - dense - claustrophobic - alive - inefficient - absurd -
strangely cozy

Inspired heavily by: - Kowloon Walled City - Old industrial cities -
Bureaucracy and paperwork - Emergent-simulation games where stories
matter more than wins

------------------------------------------------------------------------

## 2. Player Identity

The player is an **abstract planning force**: - a city planner - a mayor
without authority - a god without powers

Key rules: - The player is not a person in the world - NPCs are not
aware of the player - NPCs do not obey the player - The game does not
judge the player morally - The player does not age, die, or retire

The player exists **outside** the city, looking in.

------------------------------------------------------------------------

## 3. NPC Philosophy (Direction 3 -- Locked)

NPCs are the protagonists.

They: - have needs - have ambitions - have personalities - talk to each
other - lie, manipulate, and organize - radicalize - form factions -
exploit systems - make mistakes

NPC autonomy increases with scale: - Early game: NPCs ask - Mid game:
NPCs negotiate - Late game: NPCs act

Eventually, NPCs will: - ignore player intent - resist incentives -
create problems the player did not anticipate

This loss of control is **intentional and desirable**.

------------------------------------------------------------------------

## 4. World Structure -- Player-Owned Block Clusters

Each player owns a **private block cluster**, not a shared city.

### Blocks / Rooms

-   One block = one functional room
-   Blocks connect outward and vertically
-   Blocks have:
    -   type
    -   interior layout
    -   furniture
    -   machines
    -   storage
    -   NPC movement

Examples: - Residential - Workshop - Factory - Power - Education -
Logistics - Entertainment (gambling dens, brothels)

Other players see: - exterior - block type - public stats

You see: - workers - orders - efficiency - social tension - internal
chaos

------------------------------------------------------------------------

## 5. Vertical Class Layers

Cities naturally stratify vertically.

Lower layers: - pollution - noise - cheap housing - heavy industry

Upper layers: - clean air - education - management - wealth

NPCs may: - move upward as they improve - leave old blocks behind - sell
or repurpose previous spaces - own multiple blocks if they can afford
and manage them

Neglect leads to decay.\
Investment leads to gentrification.

------------------------------------------------------------------------

## 6. Interior Layout Is Gameplay

Rooms are physical spaces.

Players place: - walls - floors - furniture - machines - work surfaces -
storage - decorations

NPCs must physically navigate spaces.

Bad layouts cause: - congestion - delays - stress - accidents -
inefficiency

There is **no auto-optimize**.

Watching NPCs struggle through bad layouts is part of the fun.

------------------------------------------------------------------------

## 7. Expansion Pressure & Real Estate

Rooms cannot always expand cleanly.

If boxed in: - businesses buy nearby blocks - operate at a distance -
solve logistics manually - later relocate if space becomes available

Real estate competition emerges naturally.

------------------------------------------------------------------------

## 8. Preset Rooms

Players can place preset rooms: - fully furnished apartments - starter
workshops - basic factories

Presets: - are fast - are inefficient - encourage later customization

Advanced players can create their own presets.

------------------------------------------------------------------------

## 9. Production Philosophy -- People, Not Belts

There are **no conveyors**.

Production exists because: - people communicate - people walk - people
misunderstand - people reprioritize

Inefficiency is not a flaw. It is the heart of the simulation.

------------------------------------------------------------------------

## 10. Order-Based Logistics (Signature System)

Blocks generate **orders**.

Orders are transmitted via: - telegram machines (paper, sound, clerks) -
pneumatic tubes - messengers - runners

Example: 1. Power block needs copper wire 2. Clerk creates an order 3.
Telegram prints on the other side 4. Worker tears off paper 5. Walks to
production area 6. Production starts

Orders can: - be delayed - be lost - be misunderstood - be
deprioritized - be sabotaged

There is no central authority deciding priority.

------------------------------------------------------------------------

## 11. Economy & Materials

### Primary Materials (Early)

-   Iron
-   Coal
-   Copper

Produced via: - hobby production - small workshops

Low profit, high labor.

### Advanced Materials

-   Cables
-   Machinery parts
-   Electronics
-   Structural components

Require: - multiple blocks - skilled labor - education

Scarcity is strongest early.

------------------------------------------------------------------------

## 12. Market & Trade

There is a **global shared market**.

Players choose: - what to sell - how much - at what price

NPC businesses choose: - sell locally (benefit city) - sell globally
(profit)

Markets can: - crash - form monopolies - destabilize cities

Market statistics hint what to build next.

------------------------------------------------------------------------

## 13. Emergent NPC Destiny

NPCs are not static.

They may: - start hobbies at home - expand hobbies into businesses -
hire employees - become managers - move to better housing - leave the
city entirely

Example: Oscar solders circuit boards in his kitchen. He hires help. The
apartment becomes a factory. Oscar moves upstairs. The old block goes on
the market.

------------------------------------------------------------------------

## 14. Politics, Conflict & Society

There is no combat.

Conflict manifests as: - strikes - walkouts - sabotage - protests -
unionization - corruption

Ideology can override needs. Factions form via conversation.

The player cannot suppress politics --- only respond to them.

------------------------------------------------------------------------

## 15. Education & Knowledge

NPCs can: - study - train - apprentice

Education: - takes time - costs opportunity - increases efficiency -
reduces pollution - increases political awareness

Skills do not decay.

Educated NPCs may leave.

------------------------------------------------------------------------

## 16. Time, Pace & Decay

-   1 in-game day ≈ 10 real minutes
-   Day/night cycle
-   No pause (multiplayer)
-   Buildings age
-   Infrastructure decays
-   Decay can be mitigated but never fully stopped

There is no endpoint. Only long-term transformation.

------------------------------------------------------------------------

## 17. Player Agency

The player cannot: - kill NPCs - directly fire NPCs - evict residents

The player can: - build - remove - decorate - incentivize - neglect -
overinvest

All control is indirect.

------------------------------------------------------------------------

## 18. Early Gameplay Experience

### First 30 Minutes

-   One person
-   One apartment
-   Manual hobby production
-   Tiny profits
-   First market interaction

### 30--90 Minutes

-   Buy a new block, new NPC move in.
-   First logistics delays

### Beyond

-   NPC autonomy accelerates
-   Stories emerge
-   Control fades

------------------------------------------------------------------------

## 19. Multiplayer Philosophy

Players: - own private block clusters - trade and compete economically -
observe each other's city shells - affect each other indirectly

No direct griefing. All interaction is systemic.

------------------------------------------------------------------------

## 20. Tone & Cozy Chaos

The game is: - slow - readable - absurd - occasionally uncomfortable -
never cruel

Failure is: - visible - funny - instructive

Suffering is shown, not moralized.

------------------------------------------------------------------------

## 21. What This Game Refuses To Be

-   No perfect optimization
-   No conveyor porn
-   No god-mode control
-   No clean solutions
-   No binary success/failure

------------------------------------------------------------------------

## 22. Design Pillars (Final)

-   People, not belts
-   Environment over orders
-   Partial information
-   High NPC autonomy
-   Emergent stories
-   Cozy chaos

------------------------------------------------------------------------

End of Living Document v0.

---

## Appendix D — Vertical Cozy City — Open Design Questions v1 (verbatim)
Source: 

---
# Vertical Cozy City -- Open Design Questions (v1)

> This document is intentionally only questions. These questions define
> the unknowns that must be answered before locking scope, systems, and
> a development roadmap. There are no wrong answers --- only design
> consequences.

------------------------------------------------------------------------

## 1. Player Identity & Perspective

-   Who is the player fictionally?
A: The player is kinda like a mix between a mayor/cityplanner/god (but without powers).
-   Does the player character age or change?
A: No. The player character is static.
-   Are NPCs aware of the player?
A: No not really. The player can make some decisions that affect the NPCs, but the NPCs don't really care about the player.
-   Can NPCs oppose the player directly?
A: No.
-   Is the player morally defined or neutral?
A: The player is kinda neutral.

------------------------------------------------------------------------

## 2. Player Agency & Control

-   What actions are never allowed?
A: The player can't kill or harm NPCs directly, only via indirect means (e.g., poor city planning leading to crime).
-   Can the player fire or evict NPCs?
A: No, but the NPC may get fired or evict due to how the game is designed, or if other NPCs with certain powers decide to do so.
-   How much loss of control is acceptable?
A: The player control what to build and buy for the city, but the NPCs have their own goals and will act accordingly. The player should be able to influence the NPCs, but not control them.
-   Are there emergency overrides?
A: Not sure what that means, but I guess not.
-   Are limits soft or hard?
A: You'll have to explain what you mean by that.
------------------------------------------------------------------------

## 3. NPC Autonomy & Behavior

-   How often do NPCs act independently?
A: They will be independent from the player, but the player can influence them, and other NPCs, like bosses will make NPCs act in certain ways.
-   Can NPCs lie or manipulate?
A: Yes, with certain traits/personality combinations an NPC may lie/manipulate often.
-   How predictable should NPC behavior be?
A: Some basic behaviour and obeyance to vital needs like hunger, sleep, work etc should be predictable, but outside of that, anything can happen.
-   Can NPCs radicalize or hold grudges?
A: Yes, NPCs will develop relationships and personalities over time, and these can change based on the NPCs interactions with each other.

------------------------------------------------------------------------

## 4. Information & Transparency

-   What is always visible?
A: Not decided yet, but resources, time, and basic city information should be visible.
-   What must be inferred?
A: Not sure yet or what it means.
-   Can misinformation exist?
A: Yes, but it should be limited and not too common.
-   How does the player learn why things happen?
A: Through observation, interaction with NPCs, and events that unfold in the city.

------------------------------------------------------------------------

## 5. Time, Pace & Scale

-   How fast does time pass?
A: Not deicded yet but let's 1 day in game is around 10 minutes, with day/night cycles.
-   Can time be paused?
A: That would be complicated since the game is multiplayer and other players are also playing.
-   Does the city age or decay?
A: Yes, the city will age and decay over time, but it will also be repaired, rebuilt and expanded. There will be visible signs of aging and decay.
-   Is there an endpoint?
A: No, there is no endpoint thought out yet, but there will be events that will change the city and its inhabitants.

------------------------------------------------------------------------

## 6. Economy & Scarcity

-   What is truly scarce?
A: Pretty much everything is scarce in the beginning. You will have to work hard to gather resources, expand, get independent and build a sustainable economy.
-   Can markets crash?
A: Yes, markets can crash due to various reasons like resource shortages, economic instability, or external events.
-   Can monopolies form?
A: Yes, monopolies can form if a single entity controls a significant portion of the market.
-   Is debt dangerous or normal?
A: Debt can be dangerous if it becomes too high, but it can also be a normal part of building a sustainable economy.


------------------------------------------------------------------------

## 7. Space & Real Estate

-   How large can a city grow?
A: Each player gets a limited plot of land to build on. The city can be built on this plot and not outside. However, the city can be built vertically and get more effective with spacing with time. 
-   Can blocks collapse?
A: Not decided yet.
-   Can districts decay or gentrify?
A: Yes, if there are no NPCs to maintain the district, it will decay and get gentrified.

------------------------------------------------------------------------

## 8. Logistics & Orders

-   Can orders be delayed or sabotaged?
A: Yes, orders can be delayed or sabotaged.
-   Who prioritizes orders?
A: Not decided yet.
-   Can communication fail?
A: Yes, communication can fail.

------------------------------------------------------------------------

## 9. Education & Skills

-   How long does education take?
A: Not decided yet.
-   Can skills decay?
A: No. Skills are permanent.
-   Can educated NPCs leave?
A: Yes, educated NPCs can leave if they find better opportunities or if the city can't provide enough work for them.

------------------------------------------------------------------------

## 10. Social Systems & Politics

-   How do factions form?
A: NPCs talk to each other. Based on their conversations, they form factions
-   Can strikes spread?
A: Yes, strikes can spread if enough NPCs join the cause.
-   Can ideology override needs?
A: Yes, ideology can override needs if the NPCs are strongly convinced of their beliefs.

------------------------------------------------------------------------

## 11. Morality & Consequences

-   Is the game judging the player?
A: No.
-   Are consequences permanent?
A: Some consequences are permanent, but most can be mitigated over time.
-   Should suffering be visible?
A: Yes, suffering should be visible to the player.

------------------------------------------------------------------------

## 12. Multiplayer

-   How many players?
A: Not decided yet.
-   Can players exploit each other?
A: Yes, players can exploit each other. But it will be in a cozy way. 
-   How does one player's failure affect others?
A: Not decided yet.

------------------------------------------------------------------------

## 13. Tone & Comfort

-   Where is the cozy/stress line?
A: The player just accept he/she's along for the ride, but they can make choices that affect the outcome.
-   How dark is too dark?
A: Not decided yet.
-   Is failure entertaining?
A: Yes. Chaotic and funny.

------------------------------------------------------------------------

## 14. Scope & Feasibility

-   What must exist in v1?
A: Basic city building & expansion, able to decorate rooms, resource management, multiplayer setup, NPCs.
-   What must not exist in v1?
A: Not deicded yet.
-   Where must we say no?
A: Not decided yet

------------------------------------------------------------------------

## 15. Endgame & Replayability

-   Is success subjective?
A: Success / Completion is not decided yet.
-   Can cities collapse gracefully?
A: Not decided yet.
-   What makes replays different?
A: NPCs will have different personalities and behaviors in each replay and therefore the game will feel different each time.
------------------------------------------------------------------------

End of Open Questions.

---

## Appendix E — Vertical Cozy City — Design v6 (verbatim)
Source: 

---
# Vertical Cozy City -- Distributed Blocks, Autonomous NPCs & Emergent Society (v6)

> This document supersedes v5. It retains all existing content and adds
> clarified design intent based on answered Open Design Questions.

------------------------------------------------------------------------

## High-Level Vision

A cozy, slow-paced but deeply system-heavy multiplayer city simulation
where each player owns and grows their own dense, block-based
micro-city, while being economically, socially, and politically
entangled with others.

Tone: - Cozy - Slightly absurd - Emergent - Socially and politically
messy

Inspired by: - Kowloon Walled City - Dwarf Fortress - Anno-style
logistics - Old industrial cities - Bureaucracy simulators

------------------------------------------------------------------------

## Core Design Lock-In: Direction 3 (High NPC Autonomy)

NPCs become almost uncontrollable as the city grows.

The player shapes infrastructure, incentives, access, and environment.
NPCs optimize for themselves and act with or without permission.

Early: NPCs ask\
Mid: NPCs negotiate\
Late: NPCs act

------------------------------------------------------------------------

## Player Identity & Perspective

-   The player is an abstract city planner / mayor-like force
-   Not a character inside the world
-   Does not age or die
-   NPCs are not aware of the player
-   Player is morally neutral
-   The game does not judge the player

------------------------------------------------------------------------

## Player Agency & Control

-   Player cannot kill or directly harm NPCs
-   Player cannot directly fire or evict NPCs
-   NPCs may fire or evict each other
-   Player influence is indirect
-   No emergency overrides
-   Mostly soft limits

------------------------------------------------------------------------

## Player-Owned Block Clusters

Each player owns a private cluster of blocks.

Blocks: - One block = one functional room - Expand outward and
vertically - Fully simulated interiors

Block types: - Residential - Workshop - Factory - Power - Education -
Logistics - Entertainment

Other players see exteriors and public stats. You see full internal
detail.

------------------------------------------------------------------------

## Vertical Class Layers

Lower layers: - Pollution - Cheap housing - Heavy industry

Upper layers: - Clean - Educated - Wealthy

Blocks can decay or gentrify depending on maintenance.

------------------------------------------------------------------------

## Interior Layout Gameplay

Players place furniture, machines, storage, and decorations. NPCs must
physically navigate rooms. Bad layouts cause congestion and
inefficiency.

------------------------------------------------------------------------

## Room Expansion Pressure

If boxed in, NPCs buy nearby blocks or operate at distance. Real estate
pressure emerges naturally.

------------------------------------------------------------------------

## Preset Rooms

Preset rooms can be placed quickly but are inefficient. Players are
encouraged to customize later.

------------------------------------------------------------------------

## People-Driven Production

No conveyors. People communicate, move, misunderstand, and reprioritize.

------------------------------------------------------------------------

## Order-Based Logistics

Orders are sent via telegrams, tubes, or messengers. Orders can be
delayed, sabotaged, or misunderstood.

------------------------------------------------------------------------

## Materials & Economy

Primary: - Iron - Coal - Copper

Advanced: - Cables - Machinery - Electronics - Structural components

Markets can crash. Monopolies can form. Debt is normal but dangerous.

------------------------------------------------------------------------

## Emergent NPC Destiny

NPCs can start hobbies, form businesses, hire workers, move blocks, and
leave the city.

------------------------------------------------------------------------

## Politics & Social Conflict

-   Strikes
-   Protests
-   Sabotage
-   Unionization

Ideology can override needs.

------------------------------------------------------------------------

## Education & Skills

Education improves efficiency and awareness. Skills do not decay.
Educated NPCs may leave.

------------------------------------------------------------------------

## Time, Pace & Decay

-   1 day ≈ 10 minutes
-   No pause (multiplayer)
-   City ages and decays visibly
-   No fixed endpoint

------------------------------------------------------------------------

## Player Role Over Time

Early: - Manual involvement - Personal scale

Mid: - Negotiation - Oversight

Late: - Cultural steering - Crisis response

------------------------------------------------------------------------

## Early Gameplay Loop

0--30 min: - One person - One apartment - Hobby production

30--90 min: - First worker - First block - Logistics problems

------------------------------------------------------------------------

## Multiplayer

Players trade and compete indirectly. Player failure can affect others.
No direct griefing.

------------------------------------------------------------------------

## Why Cozy

-   No hard failure
-   Slow escalation
-   Visible suffering
-   Absurd bureaucracy
-   Failure is funny

------------------------------------------------------------------------

## Design Pillars

-   People, not belts
-   Environment over orders
-   Partial information
-   High NPC autonomy
-   Emergent stories
-   Cozy chaos

------------------------------------------------------------------------

End of v6.

---

## Appendix F — Vertical Cozy City — Design v5 (verbatim)
Source: fileciteturn2file5

---
# Vertical Cozy City -- Distributed Blocks, Autonomous NPCs & Emergent Society (v5)

> This document supersedes all previous versions. It combines
> player-owned block clusters, people-driven logistics, and high NPC
> autonomy (Direction 3). NPCs are actors with their own goals. The
> player shapes conditions --- not outcomes.

------------------------------------------------------------------------

## High-Level Vision

A cozy, slow-paced but deeply system-heavy multiplayer city simulation
where each player owns and grows their own dense, block-based
micro-city, while being economically, socially, and politically
entangled with others.

Tone: - Cozy - Slightly absurd - Emergent - Socially and politically
messy (playfully)

Inspired by: - Kowloon Walled City - Dwarf Fortress (emergence, not
cruelty) - Anno-style logistics - Old industrial cities - Bureaucracy
simulators

------------------------------------------------------------------------

## Core Design Lock-In: Direction 3 (High NPC Autonomy)

NPCs become almost uncontrollable as the city grows.

Player controls: - Infrastructure - Incentives - Access - Environment

NPCs: - Optimize for themselves - Organize socially and politically -
Act with or without permission

Early: NPCs ask. Mid: NPCs negotiate. Late: NPCs act.

------------------------------------------------------------------------

## Player-Owned Block Clusters

Each player owns a private cluster of blocks.

Blocks: - One block = one functional room - Attached outward and
vertically - Fully simulated interiors

Block types: - Residential - Workshop - Factory - Power - Education -
Logistics - Entertainment (gambling, brothels)

Other players see exteriors and public stats. You see full detail.

------------------------------------------------------------------------

## Vertical Class Layers

Lower layers: - Pollution - Cheap housing - Heavy industry

Upper layers: - Clean - Educated - Wealthy

Blocks evolve upward as NPCs improve. Old blocks may be sold or
repurposed.

------------------------------------------------------------------------

## Interior Layout Gameplay

Players place: - Furniture - Machines - Storage - Decorations

NPCs must physically move. Bad layouts cause congestion and delays.

------------------------------------------------------------------------

## Room Expansion Pressure

If boxed in: - NPCs buy nearby blocks - Solve logistics at a distance -
May relocate later

Real estate competition emerges naturally.

------------------------------------------------------------------------

## Preset Rooms

Prebuilt rooms can be placed: - Fast - Inefficient - Customizable later

------------------------------------------------------------------------

## People-Driven Production

No conveyors. People communicate and move.

------------------------------------------------------------------------

## Order-Based Logistics

Orders sent via: - Telegrams - Tubes - Messengers

Orders can be delayed or misunderstood.

------------------------------------------------------------------------

## Materials & Economy

Primary: - Iron - Coal - Copper

Advanced: - Cables - Machinery - Electronics - Structural components

------------------------------------------------------------------------

## Market & Trade

-   Global market
-   NPCs choose local vs global selling
-   Market stats hint future needs

------------------------------------------------------------------------

## Emergent NPC Destiny

NPCs: - Start hobbies - Become entrepreneurs - Hire workers - Move
blocks

------------------------------------------------------------------------

## Politics & Conflict

-   Strikes
-   Protests
-   Sabotage
-   Unionization

Player responds via conditions, not force.

------------------------------------------------------------------------

## Education

NPCs study and train. Education increases: - Efficiency - Quality -
Awareness

------------------------------------------------------------------------

## Player Role Over Time

Early: - Manual control - Personal scale

Mid: - Negotiation - Oversight

Late: - Cultural steering - Crisis response

------------------------------------------------------------------------

## Early Gameplay Loop

0--30 min: - One person - One apartment - Hobby production

30--90 min: - First worker - First block - Logistics issues

------------------------------------------------------------------------

## Multiplayer

-   Trade
-   Competition
-   Indirect dependence
-   No griefing

------------------------------------------------------------------------

## Why Cozy

-   No hard failure
-   Slow escalation
-   Absurd bureaucracy

------------------------------------------------------------------------

## Design Pillars

-   People, not belts
-   Environment over orders
-   Partial information
-   High autonomy
-   Emergent stories
-   Cozy chaos

------------------------------------------------------------------------

End of v5.

---

---

## Appendix G — Discord Merge Staging Area (paste here for v2 merge)

Paste your Discord conversation (or upload as a `.txt`/`.md`) and I will:
1) Detect **new vs duplicate** points,
2) Integrate them into the correct sections of the **Merged Core**, and
3) Preserve the Discord text verbatim in an appendix (so nothing is lost).

