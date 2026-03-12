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

  /**
   * Starter layout rules:
   * - local plot is 40x40 cells/meters
   * - center contains a clear starter area
   * - shack is a 4x4 placed object
   * - rubble is now represented as real 4x4 local objects
   * - the hidden cell grid still carries blocked/clearable terrain logic underneath
   */

  const clearAreaMinX = Math.floor((STARTER_DETAIL_SIZE - STARTER_CLEAR_AREA_SIZE) / 2);
  const clearAreaMinY = Math.floor((STARTER_DETAIL_SIZE - STARTER_CLEAR_AREA_SIZE) / 2);
  const clearAreaMaxX = clearAreaMinX + STARTER_CLEAR_AREA_SIZE - 1;
  const clearAreaMaxY = clearAreaMinY + STARTER_CLEAR_AREA_SIZE - 1;

  const shackX = Math.floor((STARTER_DETAIL_SIZE - STARTER_SHACK_SIZE) / 2);
  const shackY = Math.floor((STARTER_DETAIL_SIZE - STARTER_SHACK_SIZE) / 2);

  for (let y = 0; y < STARTER_DETAIL_SIZE; y++) {
    for (let x = 0; x < STARTER_DETAIL_SIZE; x++) {
      const insideStarterClearArea =
        x >= clearAreaMinX &&
        x <= clearAreaMaxX &&
        y >= clearAreaMinY &&
        y <= clearAreaMaxY;

      cells.push({
        x,
        y,
        blocked: !insideStarterClearArea,
        clearable: !insideStarterClearArea,
        terrain: insideStarterClearArea ? "GROUND" : "RUBBLE",
      });
    }
  }

  // Add 4x4 rubble objects everywhere outside the central clear area.
  // Because the layout sizes are divisible by 4, this produces a clean object grid.
  for (let y = 0; y < STARTER_DETAIL_SIZE; y += STARTER_RUBBLE_SIZE) {
    for (let x = 0; x < STARTER_DETAIL_SIZE; x += STARTER_RUBBLE_SIZE) {
      const chunkInsideClearArea =
        x >= clearAreaMinX &&
        (x + STARTER_RUBBLE_SIZE - 1) <= clearAreaMaxX &&
        y >= clearAreaMinY &&
        (y + STARTER_RUBBLE_SIZE - 1) <= clearAreaMaxY;

      if (chunkInsideClearArea) {
        continue;
      }

      starterObjects.push({
        id: `starter_rubble_${x}_${y}`,
        kind: "RUBBLE_4X4",
        x,
        y,
        footprint_w: STARTER_RUBBLE_SIZE,
        footprint_h: STARTER_RUBBLE_SIZE,
      });
    }
  }

  starterObjects.push(
    {
      id: "starter_shack",
      kind: "SHACK",
      x: shackX,
      y: shackY,
      footprint_w: STARTER_SHACK_SIZE,
      footprint_h: STARTER_SHACK_SIZE,
    },
    {
      id: "starter_npc",
      kind: "NPC_MARKER",
      x: shackX + STARTER_SHACK_SIZE + 1,
      y: shackY + STARTER_SHACK_SIZE - 1,
      footprint_w: 1,
      footprint_h: 1,
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

function objectOccupiesCell(
  obj: PlotDetailStarterObject,
  x: number,
  y: number
): boolean {
  const footprintW = obj.footprint_w ?? 1;
  const footprintH = obj.footprint_h ?? 1;

  return (
    x >= obj.x &&
    x < obj.x + footprintW &&
    y >= obj.y &&
    y < obj.y + footprintH
  );
}

function getRubbleObjectAtCell(plot: Plot, x: number, y: number): PlotDetailStarterObject | null {
  const detail = plot.detail;
  if (!detail) {
    return null;
  }

  for (const obj of detail.starter_objects) {
    if (obj.kind !== "RUBBLE_4X4") {
      continue;
    }

    if (objectOccupiesCell(obj, x, y)) {
      return obj;
    }
  }

  return null;
}

function ensureStarterRubbleObjects(detail: PlotDetail): boolean {
  // Backward-safe migration helper:
  // if an older claimed plot has rubble cells but no rubble objects yet,
  // reconstruct the starter rubble object layout from the current cell data.
  const hasRubbleObjects = detail.starter_objects.some((obj) => obj.kind === "RUBBLE_4X4");
  if (hasRubbleObjects) {
    return false;
  }

  let changed = false;

  for (let y = 0; y < detail.height; y += STARTER_RUBBLE_SIZE) {
    for (let x = 0; x < detail.width; x += STARTER_RUBBLE_SIZE) {
      let fullRubbleChunk = true;

      for (let cy = y; cy < y + STARTER_RUBBLE_SIZE; cy++) {
        for (let cx = x; cx < x + STARTER_RUBBLE_SIZE; cx++) {
          const cell = detail.cells.find((c) => c.x === cx && c.y === cy);
          if (!cell || cell.terrain !== "RUBBLE") {
            fullRubbleChunk = false;
            break;
          }
        }

        if (!fullRubbleChunk) {
          break;
        }
      }

      if (!fullRubbleChunk) {
        continue;
      }

      detail.starter_objects.push({
        id: `starter_rubble_${x}_${y}`,
        kind: "RUBBLE_4X4",
        x,
        y,
        footprint_w: STARTER_RUBBLE_SIZE,
        footprint_h: STARTER_RUBBLE_SIZE,
      });
      changed = true;
    }
  }

  return changed;
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
  const detail = plot.detail;
  if (!detail) {
    return false;
  }

  // Preferred path:
  // if this cell belongs to a placed 4x4 rubble object, remove that object
  // and free the whole occupied footprint.
  const rubbleObject = getRubbleObjectAtCell(plot, x, y);
  if (rubbleObject) {
    detail.starter_objects = detail.starter_objects.filter((obj) => obj.id !== rubbleObject.id);

    const footprintW = rubbleObject.footprint_w ?? 1;
    const footprintH = rubbleObject.footprint_h ?? 1;

    for (let cy = rubbleObject.y; cy < rubbleObject.y + footprintH; cy++) {
      for (let cx = rubbleObject.x; cx < rubbleObject.x + footprintW; cx++) {
        const cell = getPlotDetailCell(plot, cx, cy);
        if (!cell) {
          continue;
        }

        cell.terrain = "GROUND";
        cell.blocked = false;
        cell.clearable = false;
      }
    }

    return true;
  }

  // Backward-safe fallback:
  // if no rubble object exists yet, fall back to the older per-cell clear behavior.
  const cell = getPlotDetailCell(plot, x, y);
  if (!cell) {
    return false;
  }

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
const STARTER_DETAIL_SIZE = 40;
const STARTER_CLEAR_AREA_SIZE = 8;
const STARTER_SHACK_SIZE = 4;
const STARTER_RUBBLE_SIZE = 4;

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
  }

  let migratedRubbleObjects = 0;

  for (const plot of world.plots) {
    if (!plot.detail) {
      continue;
    }

    if (ensureStarterRubbleObjects(plot.detail)) {
      migratedRubbleObjects += 1;
      changed = true;
    }
  }

  if (migratedRubbleObjects > 0) {
    return {
      changed,
      reason: `Migrated rubble local objects for ${migratedRubbleObjects} claimed plot(s).`,
    };
  }

  if (added.length > 0) {
    return { changed, reason: `Filled ${added.length} missing tiles inside existing bounds.` };
  }

  return { changed };
}