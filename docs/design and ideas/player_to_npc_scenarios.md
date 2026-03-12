# Player -> NPC Workflow: Scenario Pack

## Overview

This document contains a set of new gameplay scenarios built around the **Player -> NPC -> Company -> Project Execution** workflow.

The purpose of these scenarios is to show how the system can create:
- clear player intent
- NPC-driven execution
- inter-company coordination
- popups and intervention points
- funny mistakes
- emergent storytelling
- different kinds of bottlenecks

Each scenario follows the same basic pattern:

1. The player decides on a goal
2. A company receives the order
3. The manager breaks the order into tasks
4. Other firms and workers get involved
5. Resources, skills, machines, and housing are checked
6. Problems appear
7. The player reacts
8. The building or service eventually becomes operational

---

# Scenario 1 — Opening a Quarry Outside Town

## Setup
The player wants a new stone source because the city is running low on stone for foundations, walls, and civic buildings.

The player places a **Quarry** blueprint in a rocky extraction zone at position x,y.

## Initial Requirement Check
The game checks:
- valid stone deposit
- road access
- nearby worker housing
- available quarry company
- required quarry foreman
- required machine operators
- tool availability
- hauling capacity

## Missing Requirement
The city has laborers and builders, but no **Quarry Foreman**.

The player chooses between:
- posting an outside job ad
- retraining an experienced mason into Quarry Foreman

## Company Workflow
The order goes to **Berg & Spräck AB**.

The company boss breaks the job into:
- site survey
- foreman staffing
- access road clearing
- tool and explosive supply
- worker assignment
- hauling contracts
- safety inspection

## Inter-company Requests
- road crew is asked to widen the approach road
- housing office is asked to reserve beds for quarry workers
- blacksmith is asked for extra chisels, wedges, and hammers
- hauling company is asked to schedule stone transport
- fuel supplier is asked to reserve diesel for excavation equipment

## Example Problems
- The survey NPC marks the wrong cliff face
- Stone carts arrive before the access road is ready
- Workers complain the housing block is too far away
- The blasting powder delivery gets sent to the brickworks by mistake
- One quarry worker refuses the job because "last time the foreman was an idiot"

## Example Popups
- "Quarry requires 1 Quarry Foreman. None available."
- "Post external job ad? Cost: 3,500 kr."
- "Access road too narrow for heavy equipment."
- "Blasting supplies delivered to wrong site. Redirect now?"
- "Berg & Spräck AB requests safety fencing budget increase: 6,000 kr."

## End Result
Once the road, staffing, and hauling are in place, the quarry opens.

Now the city gets:
- stone
- gravel
- possible marble or higher-grade stone later

This scenario emphasizes:
- remote-site planning
- worker housing
- transport
- site safety
- extraction logistics

---

# Scenario 2 — Emergency Hospital Extension

## Setup
A disease outbreak or industrial accident means the city needs more medical capacity immediately.

The player places a **Hospital Extension** on an existing hospital block.

## Initial Requirement Check
The system checks:
- building materials
- hospital administration approval
- plumbers
- electricians
- medical furniture supply
- clean water access
- stable electricity
- medical staff recruitment

## Missing Requirement
Construction capacity exists, but there are not enough **Electricians** and **Medical Installers**.

The player can:
- pull them from lower-priority city projects
- train internal workers
- hire outside specialists at premium rates

## Company Workflow
The order goes to:
- **Stadens Sjukhusförvaltning** for operation
- **AkutByggarna AB** for construction
- **El & Rörgruppen** for electrical and plumbing systems

The manager at AkutByggarna splits the project into:
- shell extension
- sanitary line installation
- electrical wiring
- ventilation installation
- bed and cabinet delivery
- final medical inspection

## Inter-company Requests
- furniture maker is asked for hospital beds and cabinets
- textile supplier is asked for clean sheets and curtains
- power office is asked to ensure emergency load capacity
- water service is asked to verify pressure and sanitation

## Example Problems
- Hospital beds are delivered before the floor is finished
- A wiring crew is delayed because they were still working on an office tower
- Temporary power fails during commissioning
- The hospital director demands higher-quality materials than the budget allows
- The construction foreman insists that "white paint makes it look finished" even though the plumbing is incomplete

## Example Popups
- "Hospital extension marked as emergency priority."
- "Not enough electricians available. Pull from office tower project?"
- "Medical bed shipment has arrived but storage space is unavailable."
- "Backup generator connection failed inspection."
- "Emergency contractor available. Cost +35%."

## End Result
If completed quickly, the city gets:
- more patient capacity
- better survival outcomes
- higher public trust

If delayed, the city may suffer:
- higher death rate
- panic
- lower confidence in administration

This scenario emphasizes:
- urgent re-prioritization
- conflict between projects
- service dependency
- operation after construction

---

# Scenario 3 — Building a Brickworks District

## Setup
The player wants to move from timber and rough stone into dense brick urbanization.

They place blueprints for:
- clay pit
- brick kiln
- worker housing
- storage yard
- road link
- brickworks office

## Initial Requirement Check
The system checks:
- clay source
- water source
- kiln operator
- brickmaker workforce
- fuel supply
- hauling routes
- storage capacity

## Missing Requirement
There is no **Kiln Operator** and the city has weak fuel reserves.

The player chooses to:
- hire a kiln operator from another town
- train a furnace worker from the lime kiln
- import fired bricks temporarily while local production ramps up

## Company Workflow
The brickworks company boss creates tasks for:
- clay extraction
- kiln construction
- fuel contracting
- labor recruitment
- worker housing assignment
- brick mold production
- delivery scheduling

## Inter-company Requests
- forestry camp is asked for fuel wood
- tool workshop is asked for brick molds and trowels
- builders are contracted to make the kilns
- transport company is asked to stage cart traffic
- housing manager is asked to open nearby cheap worker units

## Example Problems
- Fuel wood stock is lower than reported
- Clay extraction starts before drainage is installed
- The kiln is structurally fine but dries too slowly due to weather
- Workers keep stealing dry bricks to patch their own homes
- A clerk orders roof tiles instead of standard bricks

## Example Popups
- "Brickworks chain started."
- "Kiln Operator missing. Hire or retrain?"
- "Fuel reserve insufficient for planned output."
- "Local theft reported: 18 unfired bricks missing."
- "Brick batch quality poor due to moisture. Sell at discount or reuse internally?"

## End Result
The city now has a local brick economy.

This unlocks:
- row houses
- brick apartments
- schools
- bathhouses
- more fire-resistant growth

This scenario emphasizes:
- industrial district creation
- fuel dependency
- labor district planning
- quality control

---

# Scenario 4 — The Broken Bulldozer Before a Factory Project

## Setup
The player places a blueprint for a **Machine Factory** on a large flat lot.

The project requires site leveling, foundation work, and heavy equipment.

## Initial Requirement Check
The city has enough money, materials, and a construction crew.
However, the required bulldozer exists only as a single unit in the city fleet.

## Hidden Problem
The bulldozer has not been properly maintained.
It is technically listed as available, but has:
- low oil
- worn tracks
- overdue inspection

## Company Workflow
The order goes to **Stål & Verkstad Bygg**.

The manager assigns:
- lot clearing to the heavy equipment team
- concrete ordering to the industrial materials office
- steel procurement to the mill liaison
- machine installation planning to the plant engineer

## Failure Event
The bulldozer seizes during lot prep.

This creates a cascade:
- site leveling pauses
- concrete schedule slips
- builder crew waits
- steel delivery timing becomes suboptimal
- player gets multiple intervention prompts

## Example Interventions
- urgent repair
- rent outside bulldozer
- postpone project
- use manual labor and smaller equipment
- cannibalize parts from another machine

## Example Popups
- "Bulldozer #3 has seized due to poor lubrication."
- "Mechanic estimates repair in 4 days."
- "Outside rental available. Cost: 18,000 kr."
- "Builder crew idle. Keep on payroll or reassign?"
- "Steel delivery is scheduled before site is ready. Delay shipment?"

## End Result
This scenario is about how one overlooked machine maintenance issue can disrupt an entire advanced project.

It emphasizes:
- maintenance
- machine readiness
- cascading delays
- player intervention choices

---

# Scenario 5 — Luxury Mansion for a Rich Patron

## Setup
A wealthy patron or political elite wants a **Luxury Mansion** on a hill overlooking the city.

This is not a survival project.
It is a prestige project.

## Initial Requirement Check
The system checks:
- land value
- prestige materials
- master carpenter
- master mason
- glass installer
- interior decorator / finisher
- road quality
- imported materials

## Missing Requirement
The city has the structure capacity but lacks:
- marble finishing capability
- luxury interior goods
- advanced glazing specialist

## Player Choices
- import the missing luxury components
- rush local training
- downgrade to an upper-class villa instead

## Company Workflow
The project goes to **Fina Rum & Bygg**.

The company manager breaks the work into:
- facade stone supply
- premium timber procurement
- glass and metal fitting installation
- elite interior furnishing
- landscape finishing
- decorative lighting

## Inter-company Requests
- quarry asked for decorative stone
- polishing workshop asked for premium slabs
- furniture workshop asked for fine cabinets and beds
- glassworks asked for large framed windows
- electrical firm asked for decorative fixtures

## Example Problems
- Marble shipment cracks in transport
- The patron changes their mind about the entry hall mid-project
- Master finisher refuses to work with "budget brass"
- Imported chandelier arrives but does not fit the ceiling structure
- The mansion shell is complete, but prestige score remains low because furnishings are not installed

## Example Popups
- "Luxury Mansion designated as Prestige Project."
- "Imported marble damaged in transit. Reorder?"
- "Patron requests expanded ballroom. Approve redesign?"
- "Master Finisher threatens to quit over poor material quality."
- "Prestige penalty: mansion lacks completed interior package."

## End Result
The mansion provides:
- prestige
- tourism appeal
- elite satisfaction
- possible political bonuses

This scenario emphasizes:
- high-end supply chains
- interior objects
- redesign risk
- luxury standards

---

# Scenario 6 — Worker Housing Before the Steel Mill Expands

## Setup
The player wants to expand the steel mill, but the game detects that there is not enough nearby worker housing for the larger labor force.

Instead of letting the expansion magically proceed, the system creates a social bottleneck.

## Initial Requirement Check
The steel expansion needs:
- more steelworkers
- more mechanics
- more shift labor
- more power
- more fuel
- more housing

The housing requirement becomes the true blocker.

## Player Options
- build worker blocks near the mill
- increase transit capacity and use distant housing
- raise wages to attract long commuters
- delay steel expansion

## Company Workflow
The order starts as a steel mill expansion, but branches into:
- residential construction
- service expansion
- utility planning
- later industrial recruitment

## Inter-company Requests
- housing authority begins worker block plans
- utility office begins water and power extension
- transit office evaluates bus or tram connection
- furnishings workshop prepares beds, lockers, and kitchen fittings

## Example Problems
- Housing gets built, but no grocery or service building exists nearby
- Workers refuse long commutes without better pay
- A newly hired mechanic takes a job elsewhere because the mill district is too ugly
- The housing block opens before plumbing is commissioned
- The steel mill expansion finishes, but staffing remains low because nobody wants to live there

## Example Popups
- "Steel Mill Expansion blocked: insufficient housing capacity."
- "Build Worker Housing Package now?"
- "Transit alternative available. Lower capital cost, higher long-term commute burden."
- "Worker Block A completed but sanitation systems are still offline."
- "Recruitment penalty: district desirability too low."

## End Result
This scenario emphasizes:
- labor as people, not numbers
- industry-housing relationship
- district planning
- delayed indirect unlocks

---

# Scenario 7 — Market Hall That Becomes a Comedy of Errors

## Setup
The player wants a **Market Hall** in the town center to improve commerce, food access, and district attractiveness.

## Initial Requirement Check
The system checks:
- central location
- builders
- carpenters or masons depending on tier
- market stalls
- merchant permits
- road accessibility
- enough vendors to occupy the spaces

## Company Workflow
The market company manager delegates:
- shell construction
- interior stall carpentry
- storage room setup
- signage
- merchant recruitment
- opening day coordination

## Inter-company Requests
- carpentry workshop makes counters and stalls
- painters make signs
- food distributors reserve future stalls
- sanitation crew prepares waste collection
- lighting supplier installs lamps

## Example Problems
- The signs are printed with the wrong district name
- Fish sellers are assigned to the dry goods wing
- The hall is finished but no vendor contracts are finalized
- Too many flower merchants accept and no butcher wants the last stall
- The opening festival is scheduled before the roof leak is repaired

## Example Popups
- "Market Hall construction complete. Awaiting vendor contracts."
- "Signage error: 'North Plaza Hall' delivered for South Plaza project."
- "No butcher has accepted the final stall. Offer rent discount?"
- "Roof leak reported ahead of opening ceremony."
- "Merchant guild requests cleaner waste access before launch."

## End Result
The project can still succeed, but only if the player helps align:
- construction
- interiors
- vendors
- service flow

This scenario emphasizes:
- non-industrial projects
- interior setup
- post-construction activation
- humorous urban chaos

---

# Scenario 8 — Rebuilding After a Warehouse Fire

## Setup
A major warehouse burns down, destroying stored timber, tools, and furniture.

The player orders an emergency rebuild.

## Initial Requirement Check
The system checks:
- salvageable remains
- replacement materials
- builder availability
- fire-resistant redesign options
- temporary storage elsewhere
- insurance / compensation systems if applicable

## Company Workflow
The logistics company and builder company both get involved immediately.

The manager has to:
- assess losses
- salvage what remains
- redirect surviving stock
- secure a rebuild crew
- decide whether to rebuild cheap and fast or stronger and slower

## Inter-company Requests
- demolition team clears dangerous debris
- tool workshop replaces lost tools
- timber yard redirects stock
- brickworks offers fire-resistant alternative wall package
- transport office reassigns deliveries that previously targeted the old warehouse

## Example Problems
- The inventory records were inaccurate, so shortages appear later
- A panicked clerk double-orders replacement hammers
- Temporary storage is too small and goods begin to pile up outdoors
- The player rushes the rebuild and quality drops
- Workers argue whether the fire was caused by bad wiring or bad storage discipline

## Example Popups
- "Warehouse fire damage assessment complete."
- "Rebuild as Timber Warehouse or upgrade to Brick Warehouse?"
- "Temporary storage overflow risk detected."
- "Inventory mismatch: 60 timber unaccounted for."
- "Insurance payout delayed pending inspection."

## End Result
The disaster becomes a branching opportunity:
- restore old function quickly
- or modernize and improve resilience

This scenario emphasizes:
- disaster response
- supply chain rerouting
- rebuild decisions
- forced modernization

---

# Scenario 9 — Opening a Bus Depot for Better Labor Movement

## Setup
The city is growing outward, and worker commute times are hurting attendance and productivity.

The player decides to build a **Bus Depot** and begin structured worker transport.

## Initial Requirement Check
The system checks:
- vehicle workshop capacity
- drivers
- mechanics
- fuel depot access
- road suitability
- depot building materials
- route planning office

## Missing Requirement
The city has mechanics, but not enough **Bus Drivers** and no dedicated depot manager.

## Company Workflow
The transit company manager creates tasks for:
- depot construction
- bus acquisition
- fuel routing
- staffing
- maintenance schedules
- route setup
- stop placement

## Inter-company Requests
- machine workshop prepares buses
- fuel office reserves diesel
- hiring office recruits drivers
- city planning office marks stops
- housing office checks whether depot workers need nearby homes

## Example Problems
- The buses are built, but there is no spare tire inventory
- Drivers are hired, but route maps are incomplete
- Workers refuse the schedule because first departure is too late
- Depot opens, but the fuel contract was never finalized
- The first week of operation reveals one district stop is on the wrong side of the road

## Example Popups
- "Bus Depot requires 4 Drivers and 1 Depot Manager."
- "Recruit externally or retrain truck drivers?"
- "Fuel contract incomplete. Depot cannot begin full service."
- "Commute reduction expected: -22% average travel time."
- "Route 2 stop placement causing unsafe crossing complaints."

## End Result
If successful, the depot improves:
- worker punctuality
- industrial staffing stability
- district integration

This scenario emphasizes:
- service infrastructure
- labor flow
- machines plus staffing
- second-order city benefits

---

# Scenario 10 — Founding a Technical School

## Setup
The player is tired of constantly importing specialists and decides to create a **Technical School**.

This is not just another building.
It is a strategic shift in how the city grows.

## Initial Requirement Check
The school needs:
- teachers
- construction materials
- desks
- tools for practice workshops
- electricity in some classrooms
- curriculum approval
- enough educated base population to recruit from

## Missing Requirement
The city can build the shell, but does not yet have enough teachers or workshop equipment.

## Company Workflow
The education authority coordinates with:
- builders
- furniture makers
- tool workshop
- electrical installers
- housing office for teachers

The school manager later coordinates:
- admissions
- class schedules
- practical training
- industry placement partnerships

## Inter-company Requests
- carpentry workshop makes desks and cabinets
- tool workshop makes training kits
- electrical firm wires classrooms
- hiring office recruits instructors
- firms sign apprenticeship partnerships

## Example Problems
- The school opens before all workshop tools arrive
- One instructor quits because teacher housing is poor
- Firms disagree over curriculum priorities
- Students are trained, but employers say they are "book smart and useless"
- The workshop wing cannot open because the ventilation system is unfinished

## Example Popups
- "Technical School designated as Strategic Infrastructure."
- "Recruit outside teachers? Cost: high."
- "Workshop equipment incomplete. Delay opening?"
- "Local firms request practical-heavy curriculum."
- "Graduate pipeline expected to reduce specialist imports within 2 years."

## End Result
The school unlocks long-term advantages:
- more internal training
- reduced dependence on outside hires
- stronger specialist economy
- better industrial self-sufficiency

This scenario emphasizes:
- long-term planning
- workforce development
- indirect unlocks
- strategic institutions

---

# Scenario Design Notes

These scenarios show that the same player -> NPC workflow can support many types of gameplay:

- extraction
- healthcare
- industry
- luxury projects
- housing
- transport
- education
- disaster recovery
- commerce

The point is not just that buildings get made.
The point is that every project becomes a living story involving:
- people
- firms
- mistakes
- tradeoffs
- timing
- politics
- infrastructure
- money
- improvisation

That is what makes the system feel distinct and memorable.
