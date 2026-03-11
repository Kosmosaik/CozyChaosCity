import {
  Plot,
  PlotDetail,
  PlotDetailCell,
  PlotDetailStarterObject,
  PlotShell,
  PlotType,
  WorldState,
} from "../net/protocol";

/**
 * M0.5 Pattern Rule
 * RESOURCE when both x and y are even; otherwise PLAYER.
 *
 * This matches your sketches:
 * - 3x3 starter has resource plots at the corners
 * - expanded world shows repeating "RES rows" and "player-only rows"
 */
export function plotTypeAt(x: number, y: number): PlotType {
  const isEvenEven = (x % 2 === 0) && (y % 2 === 0);
  return isEvenEven ? "RESOURCE" : "PLAYER";
}

/**
 * Stable ID derived from coordinates.
 * This avoids "index-based" ids breaking when we expand.
 */
export function plotIdFor(x: number, y: number): string {
  return `T_${x}_${y}`;
}

function makeStarterPlotDetail(): PlotDetail {
  const cells: PlotDetailCell[] = [];
  const starterObjects: PlotDetailStarterObject[] = [];

  // Shelter footprint in the center of the local plot.
  // Everything outside this area starts as blocked rubble.
  const shelterMinX = 3;
  const shelterMaxX = 4;
  const shelterMinY = 3;
  const shelterMaxY = 4;

  for (let y = 0; y < STARTER_DETAIL_SIZE; y++) {
    for (let x = 0; x < STARTER_DETAIL_SIZE; x++) {
      const insideShelterFootprint =
        x >= shelterMinX &&
        x <= shelterMaxX &&
        y >= shelterMinY &&
        y <= shelterMaxY;

      cells.push({
        x,
        y,
        blocked: !insideShelterFootprint,
        clearable: !insideShelterFootprint,
        terrain: insideShelterFootprint ? "GROUND" : "RUBBLE",
      });
    }
  }

  starterObjects.push(
    {
      id: "starter_shack",
      kind: "SHACK",
      x: 3,
      y: 3,
    },
    {
      id: "starter_npc",
      kind: "NPC_MARKER",
      x: 4,
      y: 4,
    }
  );

  return {
    width: STARTER_DETAIL_SIZE,
    height: STARTER_DETAIL_SIZE,
    cells,
    starter_objects: starterObjects,
  };
}

function makeDefaultShell(plotType: PlotType): PlotShell {
  if (plotType === "PLAYER") {
    return {
      // Public shell summary for player plots in World Map mode / reduced-detail views later.
      kind: "EMPTY",
      variant: "player_plot_default",
      stage: 0,
    };
  }

  return {
    // Public shell summary for resource plots.
    // Later this can branch into forest/quarry/ruin/etc variants.
    kind: "EMPTY",
    variant: "resource_plot_default",
    stage: 0,
  };
}

function makePlot(x: number, y: number): Plot {
  const type = plotTypeAt(x, y);

  return {
    id: plotIdFor(x, y),
    type,
    x,
    y,
    claimed_by: null,

    // Public-facing macro shell data for M2.
    shell: makeDefaultShell(type),

    // Owned/local detailed plot data is generated later when needed.
    detail: undefined,
  };
}

export function ensureClaimedPlayerPlotInitialized(plot: Plot): boolean {
  // Only PLAYER plots should ever receive owned/local starter detail.
  if (plot.type !== "PLAYER") {
    return false;
  }

  // If detail already exists, do not overwrite it.
  if (plot.detail) {
    return false;
  }

  plot.detail = makeStarterPlotDetail();

  // Once a player plot becomes initialized for owned local play,
  // its public shell should no longer read as completely empty.
  plot.shell = {
    kind: "RUINED",
    variant: "player_plot_ruined",
    stage: 0,
  };

  return true;
}

export function getPlotDetailCell(plot: Plot, x: number, y: number): PlotDetailCell | null {
  const detail = plot.detail;
  if (!detail) {
    return null;
  }

  // Reject coordinates outside the local plot bounds early.
  if (x < 0 || y < 0 || x >= detail.width || y >= detail.height) {
    return null;
  }

  // Cells are currently stored as a flat array, so we do a simple search.
  // This is perfectly fine for M2-scale starter data and keeps persistence simple.
  const cell = detail.cells.find(c => c.x === x && c.y === y);
  return cell ?? null;
}

export function isPlotDetailCellClearable(plot: Plot, x: number, y: number): boolean {
  const cell = getPlotDetailCell(plot, x, y);
  if (!cell) {
    return false;
  }

  // For the current M2 starter model, a cell is only clearable if the cell
  // explicitly says so. This keeps future gameplay checks simple and centralized.
  return cell.clearable;
}

export function clearPlotDetailCell(plot: Plot, x: number, y: number): boolean {
  const cell = getPlotDetailCell(plot, x, y);
  if (!cell) {
    return false;
  }

  // Only allow mutation through the explicit clearable flag.
  // This keeps the gameplay rule centralized and easy to evolve later.
  if (!cell.clearable) {
    return false;
  }

  cell.terrain = "GROUND";
  cell.blocked = false;
  cell.clearable = false;

  return true;
}

/**
 * Creates the starter rectangle for M0.5:
 * x=0..2, y=0..2 (3x3).
 */
function makeStarterPlots3x3(): Plot[] {
  const plots: Plot[] = [];
  for (let y = 0; y <= 2; y++) {
    for (let x = 0; x <= 2; x++) {
      plots.push(makePlot(x, y));
    }
  }
  return plots;
}

export function newWorld(): WorldState {
  return {
    version: 1,
    plots: makeStarterPlots3x3(),
    players: {},
  };
}

/**
 * Counts how many PLAYER plots are unclaimed.
 * RESOURCE plots are ignored (unclaimable).
 */
export function countFreePlayerPlots(world: WorldState): number {
  return world.plots.filter(p => p.type === "PLAYER" && p.claimed_by === null).length;
}

/**
 * Computes the rectangular bounds of the world based on plot coordinates.
 */
export function getWorldBounds(world: WorldState): { minX: number; maxX: number; minY: number; maxY: number } {
  // Safe defaults (starter world)
  let minX = 0, maxX = 0, minY = 0, maxY = 0;

  if (world.plots.length > 0) {
    minX = maxX = world.plots[0].x;
    minY = maxY = world.plots[0].y;
  }

  for (const p of world.plots) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  return { minX, maxX, minY, maxY };
}

/**
 * Ensures the world contains plots for every coordinate in [minX..maxX] x [minY..maxY].
 * Returns any newly created plots.
 */
export function fillRectMissing(world: WorldState, rect: { minX: number; maxX: number; minY: number; maxY: number }): Plot[] {
  const existing = new Set<string>(world.plots.map(p => p.id));
  const added: Plot[] = [];

  for (let y = rect.minY; y <= rect.maxY; y++) {
    for (let x = rect.minX; x <= rect.maxX; x++) {
      const id = plotIdFor(x, y);
      if (existing.has(id)) continue;

      const p = makePlot(x, y);
      world.plots.push(p);
      existing.add(id);
      added.push(p);
    }
  }

  return added;
}

// --- Module expansion helpers (constant-size expansions) ---
const MODULE_SIZE = 3;
const STARTER_DETAIL_SIZE = 8;

function moduleKey(mx: number, my: number): string {
  return `M_${mx}_${my}`;
}

/**
 * A module is considered "present" if its top-left tile exists.
 * (x % 3 == 0 && y % 3 == 0)
 */
function getExistingModules(world: WorldState): Set<string> {
  const mods = new Set<string>();
  for (const p of world.plots) {
    if (p.x % MODULE_SIZE === 0 && p.y % MODULE_SIZE === 0) {
      const mx = Math.floor(p.x / MODULE_SIZE);
      const my = Math.floor(p.y / MODULE_SIZE);
      mods.add(moduleKey(mx, my));
    }
  }
  return mods;
}

function getModuleExtents(mods: Set<string>): { maxMx: number; maxMy: number } {
  let maxMx = 0;
  let maxMy = 0;

  for (const key of mods) {
    const parts = key.split("_"); // ["M", mx, my]
    const mx = parseInt(parts[1], 10);
    const my = parseInt(parts[2], 10);
    if (mx > maxMx) maxMx = mx;
    if (my > maxMy) maxMy = my;
  }

  return { maxMx, maxMy };
}

/**
 * Picks the next module in a stable, safe order:
 * 1) Fill any missing module inside current module rectangle (row-major).
 * 2) If none missing, grow "square-ish":
 *    - if width <= height, add a new column to the right
 *    - else add a new row at the bottom
 */
function pickNextModule(world: WorldState): { mx: number; my: number } {
  const mods = getExistingModules(world);
  const { maxMx, maxMy } = getModuleExtents(mods);

  // 1) Fill holes in 0..maxMx x 0..maxMy
  for (let my = 0; my <= maxMy; my++) {
    for (let mx = 0; mx <= maxMx; mx++) {
      if (!mods.has(moduleKey(mx, my))) return { mx, my };
    }
  }

  // 2) Grow outward
  const width = maxMx + 1;
  const height = maxMy + 1;

  if (width <= height) {
    return { mx: maxMx + 1, my: 0 };       // extend right side
  } else {
    return { mx: 0, my: maxMy + 1 };       // extend downward
  }
}

function rectForModule(mx: number, my: number) {
  const minX = mx * MODULE_SIZE;
  const minY = my * MODULE_SIZE;
  return {
    minX,
    minY,
    maxX: minX + (MODULE_SIZE - 1),
    maxY: minY + (MODULE_SIZE - 1),
  };
}

/**
 * Expands the world by adding exactly ONE 3x3 module (max 9 plots).
 * This keeps expansion patches constant size and avoids spikes.
 */
export function expandWorld(world: WorldState): { added: Plot[] } {
  const { mx, my } = pickNextModule(world);
  const rect = rectForModule(mx, my);

  const added = fillRectMissing(world, rect);

  if (added.length > 0) {
    world.version += 1;
  }

  return { added };
}

/**
 * Normalizes an older save to M0.5 shape.
 * If plots are missing x/y (old save), we regenerate a fresh 3x3 layout
 * but keep the player registry (so identities still work).
 *
 * This keeps M0.5 iteration simple; later we can implement a true migration.
 */
export function normalizeWorldForM0_5(world: WorldState): { changed: boolean; reason?: string } {
  let changed = false;

  if (!world.players) {
    world.players = {};
    changed = true;
  }

  // Detect M0 plots (missing coords) or old type RES_SHARED
  const hasAnyMissingCoords = world.plots?.some((p: any) => typeof p.x !== "number" || typeof p.y !== "number");
  const hasOldType = world.plots?.some((p: any) => p.type === "RES_SHARED");

  if (hasAnyMissingCoords || hasOldType) {
    world.plots = makeStarterPlots3x3();
    world.version = 1;
    changed = true;
    return { changed, reason: "Old save detected (missing coords / old plot type). Regenerated starter 3x3." };
  }

  // Ensure any missing tiles in the current bounds are filled (safety)
  const bounds = getWorldBounds(world);
  const added = fillRectMissing(world, bounds);
  if (added.length > 0) {
    world.version += 1;
    changed = true;
    return { changed, reason: `Filled ${added.length} missing tiles inside existing bounds.` };
  }

  return { changed };
}