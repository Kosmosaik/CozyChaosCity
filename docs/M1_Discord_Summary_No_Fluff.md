M1 Summary (Discord)

Scope
- Render the server world in 3D in Godot using individual tile scenes.
- Add a basic camera for panning/moving and zoom.
- Add 3D interaction: click/select a plot and claim it using the existing networking.

What is already done (M0.5 baseline)
- Server-authoritative plot grid with coordinates x,y.
- Stable plot ids: T_<x>_<y>.
- Plot types from coordinates:
  - RESOURCE if x and y are both even
  - otherwise PLAYER
- Initial world is 3x3 at x=0..2, y=0..2.
- Expansion triggers when free claimable plots fall below a threshold.
- Client 2D PlotView renders by x,y and supports claiming.
- Ping display and owner display names are working in 2D.

M1 Deliverables
- New 3D world scene that:
  - connects with the existing NetClient
  - consumes world_state, plot_update, world_patch
  - spawns and updates tiles based on plot id and x,y
- PlotTile3D scene:
  - mesh + collision
  - visuals for RESOURCE vs PLAYER
  - visuals for FREE vs TAKEN vs MINE
  - hover and selection highlight
- Basic camera:
  - pan/move via keys
  - optional mouse drag pan
  - zoom via mouse wheel
- Clicking a tile selects it.
- Claiming a free PLAYER tile sends claim_plot and updates on server broadcast.

Not in scope for M1
- Advanced camera modes and polish
- Online list / join leave notifications
- Buildings, interiors, NPC logic
- World map or minimap rendering

Implementation order
1) Create the 3D world scene and basic camera rig.
2) Create PlotTile3D (mesh + collision).
3) Implement PlotGridMath for x,y to 3D position mapping.
4) Implement PlotRenderer3D that instantiates tiles and updates them by plot id.
5) Implement 3D picking (raycast to tile collider), selection, and claim integration.
6) Add hover/selection visuals and verify updates on plot_update/world_patch.

Definition of done
- Client connects and renders the initial 3x3 in 3D at correct positions.
- Tile states are visually clear (type and ownership).
- Selecting and claiming works and syncs across multiple clients.
- Expansion tiles appear in 3D without breaking layout.
