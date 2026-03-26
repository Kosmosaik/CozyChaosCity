# CozyChaosCity — Branch Design Questionnaire

Use this worksheet to lock down the design for the next three branches before implementation.

Suggested branch structure:
- **Branch 2A — Hauling**
- **Branch 2B — Manufacturing**
- **Branch 2C — Construction**

Answer in any format you like. Short answers are fine.

---

## How to fill this in

You can answer directly under each question, for example:

```md
1. Yes
2. Loose ground items only in first version
3. Dump Zone should be fallback only
```

Or copy the template style below:

```md
1. Answer:
2. Answer:
3. Answer:
```

---

# Branch 2A — Hauling

## Core hauling purpose
1. What counts as “haulable” in the first version?
   - loose ground items only?
   - items inside Dump Zone too?
   - items inside future stockpiles too?
   - manufacturing output items too?
   - construction delivery items too?

Answer: All of this.

2. In the first version, should hauling mean:
   - “move item from one storage/location to another”
   - or also “pick up newly created output and deliver it”

Answer: Both.

3. Do you want hauling to fully replace the current special scavenger dropoff behavior later, or should scavenging still keep a tiny special-case layer?

Answer: Scavenger will haul their own items after every action. This is not the current design but will be implemented in the future. So no, hauling will not fully replace the current special scavenger dropoff behavior.

## Who can haul
4. In early game, should **all NPCs always be eligible** to haul?

Answer: Yes

5. If all NPCs are eligible, can they haul while unemployed / idle only, or also between other work?

Answer: Whenever they don't have a higher priority task, which is pretty much anything except idle.

6. Should hauling be treated as:
   - a passive background system that assigns itself automatically
   - or a visible order/task category in UI too?

Answer: A passive background system for now. We may implement a way to let the player see and manage hauling tasks in the future.

7. Later, when NPC priorities split, do you imagine hauling priority groups like:
   - personal/home
   - business/workplace
   - public/shared settlement
   - emergency/high priority

Answer: Yes, something like that. Scenario: A police officer won't haul items from the Dump Zone to a build site because they have no reason or connection to that build site.

8. For now, do we ignore those future ownership domains and just let everyone haul everything?

Answer: Yes

## Haul job generation
9. What creates a hauling job in the first version?
   - any loose item with a valid destination?
   - any manufacturing recipe waiting for input?
   - any construction site waiting for materials?
   - all of the above eventually, but only loose items first?

Answer: All of the above. Starting with loose items might be a good idea, but in the current state the scavenger will haul their own items after every action, so we don't need to generate hauling jobs for those items. But if there would be loose items that don't belong to any NPC, those should be hauled by someone.

10. Should hauling jobs be generated automatically by the server whenever a haulable item exists?

Answer: Yes

11. Should one loose-item stack create:
   - one hauling job per stack
   - or one hauling job per unit/item
   - or one hauling job for “up to carry capacity from this stack”

Answer: Per unit/item unless the NPC can carry more than one of that specific item

12. If a stack has 8 items and an NPC can carry 2, should:
   - one NPC take 2 and leave 6
   - or one NPC reserve the whole stack until finished
   - or something else

Answer: One NPC take 2 and leave 6 with no reservation for the remaining 6 items.

## Pickup / reservation rules
13. Should hauling use reservations in the first version?

Answer: Yes, but NPCs might reserve the same item. The NPC who gets there first should be able to pick it up, and then the reservation gets cancelled for the other NPC.

14. If yes, what should be reserved:
   - the whole loose-item stack
   - a quantity inside the stack
   - the pickup tile
   - the destination slot
   - both source and destination

Answer: a quantity inside the stack, if it is a stack, otherwise the whole item

15. Can multiple NPCs reserve different quantities from the same stack at the same time?

Answer: Yes

16. If an NPC is hauling from a stack and another NPC gets there first and changes the stack, should the first NPC:
   - re-evaluate and continue
   - fail and requeue
   - switch target automatically

Answer: re-evaluate and continue

17. When does a reservation expire?
   - immediately if NPC changes task
   - after timeout
   - on failed path
   - on pickup complete only

Answer: immediately if NPC changes task, on failed path or pickup complete. A reservation also expires if a different NPC picks up the item.

## Carry capacity
18. In the first hauling branch, how much can one NPC carry?
   - still effectively 1 unit/stack entry
   - item-dependent capacity
   - a small fixed capacity like 1 medium item
   - weight/volume based

Answer: Whatever is already implemented in the game

19. Should different items have different haul sizes or carry costs already now?

Answer: No

20. For now, do you want to keep it simple with one carried stack at a time?

Answer: Yes

## Destination priority
21. When an item can go to multiple valid places, what is the priority order?
   Example:
   - manufacturing input buffer first
   - construction site first
   - stockpile first
   - Dump Zone fallback last

Answer: If there's an order like construction or manufacturing, that should be prioritized. After that: Eligible stockpile/storage -> Dump Zone.

22. Should Dump Zone remain only a fallback / temporary sink once stockpiles and manufacturing exist?

Answer: Yes. Dump Zone will be the last resort for items that don't have a processing order or stored elsewhere.

23. For clean usable items, should NPCs avoid Dump Zone if a valid production/storage destination exists?

Answer: Yes

24. Should junk/mixed salvage still be allowed in Dump Zone after stockpiles exist?

Answer: Not if an eligible stockpile exists with a filter and free space for junk/salvage. Otherwise, yes.

25. If no valid destination exists, should the item stay on the ground?

Answer: Yes, it should stay on the ground.

## Haul job priority
26. Which is more important in the first real logistics version?
   - feed manufacturing
   - feed construction
   - clean the ground
   - refill storage

Answer: feed construction -> feed manufacturing -> clean the ground -> refill storage

27. Should construction inputs outrank manufacturing inputs?

Answer: Yes

28. Should manufacturing inputs outrank generic stockpile cleanup?

Answer: Yes

29. Should emergency overflow cleanup ever outrank both?

Answer: No, the player will in that case have to prioritize the overflow cleanup manually by pausing/canceling other tasks.

30. Do you want explicit priority levels in data now, or just fixed hardcoded routing priority first?

Answer: Fixed hardcoded routing priority first.

## Idle behavior
31. When an NPC finishes its primary work and no direct work task exists, should it automatically look for hauling work?

Answer: Yes

32. Should idle NPCs roam for haul work globally across the owned plot?

Answer: Yes

33. Should there be a distance limit for “acceptable” haul jobs?

Answer: Yes, the NPC needs to be able to reach the destination within a reasonable time. Kinda like a detection range.

34. If yes, what kind of distance rule:
   - nearest only
   - max tile radius
   - score by distance

Answer: max tile radius, let's say 10 tiles for now, so the NPC will have to roam around to find a suitable haul job. We could mask this by making the NPC look like it's taking a more relaxed regular walk.

## Hauling visuals / UX
35. Should hauling jobs be visible in UI as separate jobs/orders, or invisible background logistics?

Answer: Invisible background logistics for now.

36. In debug overlay, what haul info do you want to see later:
   - haul job count
   - reserved stacks
   - destination counts
   - blocked haul reasons

Answer: All of the above.

37. In character sheet, later should we also show:
   - pickup source
   - destination object
   - reserved quantity

Answer: All of the above.

## Failure / edge cases
38. What should happen if destination becomes full while NPC is walking?

Answer: The NPC needs to get closer to the destination to check if it's still valid, and then decide what to do based on the result.

39. What should happen if destination is deleted while NPC is walking?

Answer: The NPC needs to get closer to the destination to check if it's still valid, and then decide what to do based on the result.

40. What should happen if pickup stack disappears before arrival?

Answer: The NPC needs to get closer to the pickup location to check if the item is still there, and then decide what to do based on the result.

41. What should happen if item becomes invalid for that destination mid-haul?

Answer: The NPC needs to get closer to the destination to check if it's still valid, and then decide what to do based on the result.

42. Should NPC reroute mid-carry, or drop and re-evaluate?

Answer: The NPC needs to get closer to the destination to check if it's still valid, and then decide what to do based on the result.

---

# Branch 2B — Manufacturing

## Core manufacturing concept
1. What is the first manufacturing building/object called?
   - Sorting Station?
   - Workbench?
   - Carpentry Station?
   - Makeshift Workshop?
   - something else?

Answer: Workbench will be used for making wooden pallets. Sorting Station will be used for sorting items, turning mixed salvage into specific items.

2. Is the first manufacturing scope only:
   - **Wooden Pallet**
   - or do you want another recipe or two in the same first branch?

Answer: Only Wooden Pallet for now. Sorting Station will be implemented shortly after in its own branch.

3. Should manufacturing always happen at a specific placed object/building?

Answer: Yes, but it depends on the type of manufacturing. For example, Workbench will be used for making wooden pallets, and Sorting Station will be used for sorting items.

4. Can manufacturing happen without a worker assigned to that station, or must an NPC actively operate it?

Answer: Manufacturing will always require an NPC to be assigned to the station.

## Recipe structure
5. Confirm the first pallet recipe:
   - **1 Wooden Pallet = 4 Scrap Wood**
   - still correct?

Answer: Sure

6. Craft time for one Wooden Pallet?

Answer: 10 seconds

7. Output quantity per craft?

Answer: 1

8. Any byproducts?

Answer: No

9. Any failure chance?

Answer: No

10. Any tools/fuel/power needed in first version?

Answer: No

## Input handling
11. Should input materials be physically delivered to the manufacturing station first?

Answer: Yes

12. Does the station need:
   - an input buffer
   - an output buffer
   - both

Answer: Both. I'm thinking just an area around the station where materials can be placed and then moved to the station when needed.

13. If a recipe is waiting for materials, should hauling jobs automatically be created for missing ingredients?

Answer: Yes

14. Should the station reserve incoming ingredients before they physically arrive?

Answer: No, NPCs will take care of that.

15. Can delivered materials be removed again by haulers if the recipe has not started yet?

Answer: No, only if the player cancels the recipe.

16. Once crafting starts, are inputs locked?

Answer: Yes

## Job model
17. Is manufacturing a player-issued order, or an automatic repeatable task?

Answer: Player-issued order for now, but can later be made automatic.

18. For pallets specifically, should the player:
   - click “craft 1”
   - queue a number
   - toggle maintain-stock amount
   - or just craft on demand for construction

Answer: Click Workbench -> Select recipe -> Click "Craft Now" or "+" or "-" to adjust quantity

19. Should one NPC be assigned to one station, or can any available NPC walk up and craft?

Answer: One NPC per station for now.

20. If multiple NPCs can craft at the same station later, do we need that now, or single-operator only for first version?

Answer: Single-operator only for first version.

## Output behavior
21. When a recipe completes, where does the output go?
   - station output buffer
   - immediately to ground if no space
   - directly to nearby storage if valid
   - directly carried by the crafting NPC

Answer: Station output buffer first, then it may be hauled to nearby storage if valid.

22. If output buffer is full, should crafting be blocked?

Answer: Yes

23. Should completed output create hauling work automatically?

Answer: Yes

24. Should produced Wooden Pallets be treated exactly like any other haulable item?

Answer: Yes

## Manufacturing priorities
25. If Scrap Wood is needed both for pallets and some future other recipe, how should priority be decided?

Answer: Construction demand should take priority over manufacturing demand. If there's two manufacturing requests for the same item, the one that was requested first should take priority.

26. Should construction demand for pallets automatically create pallet manufacturing demand?

Answer: Yes

27. Should manufacturing ever “pull” ingredients away from construction buffers?

Answer: No

## UI / player control
28. What should the player see in the first manufacturing UI?
   - recipe list only
   - queued crafts
   - required/available ingredients
   - station status
   - output waiting

Answer: All of the above for the specific station. There will be two UIs. One general that you can open from the main bottom bar, and one that opens when you click on a specific station.

29. Do you want a very small first version UI, mostly for Wooden Pallets only?

Answer: It should be implemented so that it can be easily extended to support other recipes in the future.

30. Should manufacturing be controlled through the existing Orders panel, or through clicking the station?

Answer: Both. Either click the station or go through the Orders panel. 

## Blocking / edge cases
31. What happens if station is destroyed or removed while ingredients are inside?

Answer: The ingredients should be released back to hauling.

32. What happens if recipe queue changes while materials are already delivered?

Answer: The materials should be released back to hauling if they can't be used for the new recipe.

33. Can the player cancel queued crafts?

Answer: Yes

34. If yes, what happens to already delivered ingredients?

Answer: The ingredients should be released back to hauling.

35. Should ingredients remain buffered or be released back to hauling?

Answer: The ingredients should be released back to hauling if they can't be used for the new recipe.

## Visuals
36. Should input materials visually appear at the station in first version?

Answer: Yes

37. Should output pallets visually appear at the station in first version?

Answer: Yes

38. Do you want crafting animation/VFX now, or later?

Answer: Let's implement all of it now so we have a good foundation to build upon. animation and VFX themselves could be simple for now, as long as they are implemented and can be easily extended in the future.

---

# Branch 2C — Construction

## Core construction flow
1. Is the intended first construction target still:
   - **Basic Stockpile**

Answer:

2. Should construction start only after player places a blueprint?

Answer: Yes

3. Once placed, does it immediately create a construction-site object with required materials?

Answer: Yes, like a blueprint.

4. Should construction require:
   - all materials delivered before work starts
   - or partial build progress as materials arrive

Answer: All materials delivered before work starts.

## Basic Stockpile requirements
5. Confirm current recipe:
   - **Basic Stockpile = 4 Wooden Pallets**
   - still correct?

Answer: Yes

6. Any other ingredients for first version, or only pallets?

Answer: Only pallets

7. Construction time after materials are delivered?

Answer: Depends on how many NPCs are working on it. Let's say base time is 20 seconds, and with 2 NPCs (which is max) it should be 12 seconds.

8. Number of NPCs that can work on one construction site at once?

Answer: 2

## Site buffers / delivery
9. Should the site have a real delivery buffer/inventory?

Answer: Yes

10. Are delivered materials locked once they reach the site?

Answer: Yes unless the player cancels the construction.

11. Can site-delivered materials be reclaimed if construction is cancelled?

Answer: Yes

12. Should site buffers be visible in debug and/or UI?

Answer: Yes in UI

## Build stages
13. Do you want staged visuals for construction in the first version?
   Example:
   - empty blueprint
   - partially delivered materials visible
   - under construction
   - completed structure

Answer: Each material delivered should be rendered as a separate object on the ground. Construction progress should be implemented so that I can choose how many assets to use for the construction between 0-100%. If have only have 2 assets (blueprint and completed structured) it will only switch between these two, but if I have more assets (e.g. 5 assets) it will switch between them based on the progress.

14. Or should first version be simpler:
   - blueprint
   - completed object

Answer: Let's implement the staged visuals, but if I only have 2 assets (blueprint and completed structure) it will only switch between these two, but if I have more assets (e.g. 5 assets) it will switch between them based on the progress.

15. If staged, what is the minimum acceptable number of stages?

Answer: 2. Blueprint and completed structure.

## Work logic
16. After all required materials are delivered, should construction work generate a normal worker job?

Answer: Yes for now. Later it will be a specialized builder job.

17. Can any NPC build in early game?

Answer: Yes

18. Later, do you expect specialized builders, but not now?

Answer: Yes

19. Should builders carry tools eventually, or ignore that for now?

Answer: Ignore for now, but later it will be a thing

## Cancellation / editing
20. Can the player cancel a construction site before completion?

Answer: Yes

21. If cancelled, what happens to delivered materials?
   - returned to loose items on ground
   - returned to nearest storage
   - lost
   - partially refunded

Answer: The construction will cancel and the materials will be dropped to the ground again and eventually hauled by NPCs.

22. Can the player move a placed blueprint before any materials are delivered?

Answer: No, it's better to cancel and place a new one.

23. Can the player move it after some materials are delivered?

Answer: No, it's better to cancel and place a new one.

## Relationship to hauling and manufacturing
24. Should unmet construction requirements automatically generate:
   - hauling jobs for existing required items
   - manufacturing demand for missing crafted ingredients like pallets

Answer: Yes

25. If a site needs 4 pallets and 2 exist already, should the remaining 2 automatically create manufacturing demand?

Answer: Yes

26. Should the construction site be allowed to “reserve” those future pallets before they exist?

Answer: No, the NPCs will reserve them how they see fit when they are completed.

27. If pallets are produced, should construction site be first priority destination?

Answer: Yes, but if a NPC has already reserved them for something else BEFORE the construction order is placed, they can be used for that instead.

## Basic Stockpile completion behavior
28. The moment Basic Stockpile is completed, should it immediately become usable storage?

Answer: No. Player will have to assign a filter to it before it can be used.

29. Should it start empty with no auto-transfer yet?

Answer: Yes

30. Should existing matching loose items then generate hauling jobs into it automatically?

Answer: Yes if they are eligible for the filter.

## Stockpile logic overlap
31. Do you want Basic Stockpile filter logic designed now together with Construction, or in a later branch after construction completion works?

Answer: Together with Construction.

32. For first usable stockpile, should it require the player to set a filter before haulers can use it?

Answer: Yes.

33. If no filter is set, should it reject everything?

Answer: Yes, and after some time send a notification to the player to set a filter.

## Visuals / UX
34. What should the player see on the construction site panel in first version?
   - required items
   - delivered items
   - percent complete
   - assigned workers
   - blocked reason

Answer: All of the above.

35. Should delivered pallets be visibly stacked on the site before build completion?

Answer: Yes.

36. Do you want a separate Construction order in the Orders panel already, or does site placement itself create the work?

Answer: Separate Construction order, so you will have Order -> Choose between Construction, Manufacturing, Scavenging, etc -> If you choose construction, you will be able to select what type of construction you want to build (in early development you will be able to choose between Basic Stockpile and Sorting Station)

---

# Cross-branch questions

1. What should be the first priority order between these systems?
   Example:
   - feed manufacturing
   - then construction
   - then stockpile cleanup
   - then Dump Zone fallback

Answer: 1: Add Hauling as a task and make it work. 2: Manufacturing. 3: Construction (Stockpile). 4: Stockpile cleanup. 5: Dump Zone fallback. Although I'm not sure what Stockpile cleanup means.

2. Do you want one shared **logistics scoring/priority system** eventually, even if first version is hardcoded?

Answer: Sure, but the priority system will be different for each NPC depending on personality, assignment, job, interests etc.

3. Should all three systems use the same reservation model from the start?

Answer: Yes

4. Should all item movement remain fully physical/visible in the world, with no teleporting between buffers?

Answer: Yes, unless we decide to make some storage/buffer abstract.

5. Are there any items that should **never** be allowed in Dump Zone once real logistics exists?

Answer: No.

6. Do you want the player to manually create manufacturing/construction demand only, while hauling stays automatic?

Answer: Yes. Later on NPCs will think more by themselves and create their own demands.

7. Should Basic Stockpile be the very first constructed building, or do you want another simpler construction target before it?

Answer: Basic Stockpile should be the first constructed building.

---

# Notes / Extra Rules

Use this space for any extra decisions, future reminders, or rules that do not fit cleanly into one question above.

Notes:

