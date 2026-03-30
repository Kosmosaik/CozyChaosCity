import {
  Plot,
  PlotDetail,
  PlotDetailCell,
  PlotDetailNpc,
  PlotLooseItem,
  PlotLooseItemReservation,
  PlotObject,
  PlotObjectItemBufferState,
  PlotObjectManufacturingState,
  PlotShell,
  PlotType,
  WorldState,
} from "../net/protocol";
import {
  getItemDefinition,
  type ItemId,
  rollStarterRubbleOutputItem,
  rollStarterRubbleOutputRollCount,
} from "./items";
import { makeNpcName } from "./npc_names";
import {
  findManufacturingInputDestinationForSingleItem,
  getAllowedManufacturingRecipeIdsForStation,
} from "./manufacturing";


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

function makeStarterNpcNameSeed(plotId: string, npcId: string): string {
  // Names should be stable once created, but not repeated on every new plot.
  // Using plot id + npc id keeps the seed deterministic and persistent while
  // still producing different names across different claimed plots.
  return `${plotId}:${npcId}`;
}

export function makeStarterNpc(
  plotId: string,
  id: string,
  x: number,
  y: number,
  jobType: "SCAVENGER" | "LABORER"
): PlotDetailNpc {
  const allowedOrderKinds: ("SCAVENGING" | "SCAVENGING_SINGLE")[] =
    jobType === "SCAVENGER" ? ["SCAVENGING", "SCAVENGING_SINGLE"] : [];

  return {
    id,
    kind: "STARTER_WORKER",
    name: makeNpcName(makeStarterNpcNameSeed(plotId, id)),
    job_type: jobType,
    current_activity: "Idle",
    traits: [],
    allowed_order_kinds: allowedOrderKinds,
    x,
    y,
    home_x: x,
    home_y: y,
    state: "idle",
    assigned_order: null,
    assigned_job_id: null,
    target_object_id: null,
    move_to_x: null,
    move_to_y: null,
    state_started_at_ms: null,
    state_ends_at_ms: null,
    // Carry slots replace the old carrying_kind string so later branches can
    // spawn real items directly into NPC hands without changing the DTO again.
    carry_slots: [],
    haul_target_mode: null,
    haul_target_object_id: null,
  };
}

function makeStarterPlotDetail(plotId: string): PlotDetail {
  const cells: PlotDetailCell[] = [];
  const plotObjects: PlotObject[] = [];

  const clearAreaMinX = Math.floor((STARTER_DETAIL_SIZE - STARTER_CLEAR_AREA_SIZE) / 2);
  const clearAreaMinY = Math.floor((STARTER_DETAIL_SIZE - STARTER_CLEAR_AREA_SIZE) / 2);
  const clearAreaMaxX = clearAreaMinX + STARTER_CLEAR_AREA_SIZE - 1;
  const clearAreaMaxY = clearAreaMinY + STARTER_CLEAR_AREA_SIZE - 1;

  const shackX = Math.floor((STARTER_DETAIL_SIZE - STARTER_SHACK_SIZE) / 2);
  const shackY = Math.floor((STARTER_DETAIL_SIZE - STARTER_SHACK_SIZE) / 2);

  const dumpZonePlacement = getStarterDumpZonePlacement(clearAreaMinX, clearAreaMinY);
  const workbenchPlacement = getStarterWorkbenchPlacement(shackX, shackY);

  for (let y = 0; y < STARTER_DETAIL_SIZE; y++) {
    for (let x = 0; x < STARTER_DETAIL_SIZE; x++) {
      const insideStarterClearArea =
        x >= clearAreaMinX &&
        x <= clearAreaMaxX &&
        y >= clearAreaMinY &&
        y <= clearAreaMaxY;

      const insideStarterDumpZone = isInsideFootprint(
        x,
        y,
        dumpZonePlacement.x,
        dumpZonePlacement.y,
        dumpZonePlacement.footprint_w,
        dumpZonePlacement.footprint_h
      );

      const isWalkableStarterGround =
        insideStarterClearArea || insideStarterDumpZone;

      cells.push({
        x,
        y,
        blocked: !isWalkableStarterGround,
        clearable: !isWalkableStarterGround,
        terrain: isWalkableStarterGround ? "GROUND" : "RUBBLE",
      });
    }
  }

  for (let y = 0; y < STARTER_DETAIL_SIZE; y += STARTER_RUBBLE_SIZE) {
    for (let x = 0; x < STARTER_DETAIL_SIZE; x += STARTER_RUBBLE_SIZE) {
      const chunkInsideClearArea =
        x >= clearAreaMinX &&
        (x + STARTER_RUBBLE_SIZE - 1) <= clearAreaMaxX &&
        y >= clearAreaMinY &&
        (y + STARTER_RUBBLE_SIZE - 1) <= clearAreaMaxY;

      const chunkOverlapsDumpZone = footprintsOverlap(
        x,
        y,
        STARTER_RUBBLE_SIZE,
        STARTER_RUBBLE_SIZE,
        dumpZonePlacement.x,
        dumpZonePlacement.y,
        dumpZonePlacement.footprint_w,
        dumpZonePlacement.footprint_h
      );

      if (chunkInsideClearArea || chunkOverlapsDumpZone) {
        continue;
      }

      plotObjects.push({
        id: `starter_rubble_${x}_${y}`,
        kind: "RUBBLE_4X4",
        x,
        y,
        footprint_w: STARTER_RUBBLE_SIZE,
        footprint_h: STARTER_RUBBLE_SIZE,
        // Starter rubble now uses real output counts instead of generic clear hits.
        remaining_output_rolls: rollStarterRubbleOutputRollCount(),
      });
    }
  }

  plotObjects.push({
    id: "starter_shack",
    kind: "SHACK",
    x: shackX,
    y: shackY,
    footprint_w: STARTER_SHACK_SIZE,
    footprint_h: STARTER_SHACK_SIZE,
  });

  plotObjects.push(makeStarterDumpZoneObject(dumpZonePlacement.x, dumpZonePlacement.y));
  plotObjects.push(makeStarterWorkbenchObject(workbenchPlacement.x, workbenchPlacement.y));

  const starterNpcX = shackX + STARTER_SHACK_SIZE + 1;
  const starterNpcY = shackY + STARTER_SHACK_SIZE - 1;

  return {
    width: STARTER_DETAIL_SIZE,
    height: STARTER_DETAIL_SIZE,
    cells,
    plot_objects: plotObjects,
    loose_items: [],
    npcs: [
      makeStarterNpc(plotId, "starter_worker_1", starterNpcX, starterNpcY, "SCAVENGER"),
      makeStarterNpc(plotId, "starter_worker_2", starterNpcX, starterNpcY + 2, "LABORER"),
    ],
    jobs: [],
    active_order: null,
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

  plot.detail = makeStarterPlotDetail(plot.id);

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
  obj: PlotObject,
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

function isInsideFootprint(
  x: number,
  y: number,
  footprintX: number,
  footprintY: number,
  footprintW: number,
  footprintH: number
): boolean {
  return (
    x >= footprintX &&
    x < footprintX + footprintW &&
    y >= footprintY &&
    y < footprintY + footprintH
  );
}

function footprintsOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number
): boolean {
  return !(
    ax + aw <= bx ||
    bx + bw <= ax ||
    ay + ah <= by ||
    by + bh <= ay
  );
}

function getStarterDumpZonePlacement(
  clearAreaMinX: number,
  clearAreaMinY: number
): { x: number; y: number; footprint_w: number; footprint_h: number } {
  const clearAreaMaxX = clearAreaMinX + STARTER_CLEAR_AREA_SIZE - 1;

  return {
    // Keep the starter dump zone directly connected to the starter clear area.
    // This makes the dump zone part of the same walkable region from the start.
    x: clearAreaMaxX + 1,
    y: clearAreaMinY,
    footprint_w: STARTER_DUMP_ZONE_SIZE,
    footprint_h: STARTER_DUMP_ZONE_SIZE,
  };
}

function makeStarterDumpZoneObject(x: number, y: number): PlotObject {
  return {
    id: "starter_dump_zone",
    kind: "DUMP_ZONE_8X8",
    x,
    y,
    footprint_w: STARTER_DUMP_ZONE_SIZE,
    footprint_h: STARTER_DUMP_ZONE_SIZE,
    storage: {
      mode: "ABSTRACT",
      capacity_max: STARTER_DUMP_ZONE_CAPACITY,
      capacity_used: 0,
      item_counts: {},
      haul_blocked_until_ms: null,
    },
  };
}

function makeEmptyItemBufferState(): PlotObjectItemBufferState {
  return {
    // Buffer identity/counts need to exist before we wire delivery/crafting rules.
    item_counts: {},
  };
}

function makeStarterWorkbenchManufacturingState(): PlotObjectManufacturingState {
  return {
    station_kind: "WORKBENCH",
    allowed_recipe_ids: getAllowedManufacturingRecipeIdsForStation("WORKBENCH"),
    assigned_npc_id: null,
    queue: [],
    input_buffer: makeEmptyItemBufferState(),
    output_buffer: makeEmptyItemBufferState(),
    active_craft: null,
  };
}

function getStarterWorkbenchPlacement(
  shackX: number,
  shackY: number
): { x: number; y: number; footprint_w: number; footprint_h: number } {
  return {
    // The starter workbench lives inside the current clear area on the shack's
    // left side so Branch 3 can start without waiting for Branch 4 construction.
    x: shackX - STARTER_WORKBENCH_FOOTPRINT_W + 2,
    y: shackY + 2,
    footprint_w: STARTER_WORKBENCH_FOOTPRINT_W,
    footprint_h: STARTER_WORKBENCH_FOOTPRINT_H,
  };
}

function makeStarterWorkbenchObject(x: number, y: number): PlotObject {
  return {
    id: "starter_workbench",
    kind: "WORKBENCH_1X2",
    x,
    y,
    footprint_w: STARTER_WORKBENCH_FOOTPRINT_W,
    footprint_h: STARTER_WORKBENCH_FOOTPRINT_H,
    manufacturing: makeStarterWorkbenchManufacturingState(),
  };
}

function clearCellsInsideFootprint(
  detail: PlotDetail,
  footprintX: number,
  footprintY: number,
  footprintW: number,
  footprintH: number
): void {
  for (let y = footprintY; y < footprintY + footprintH; y += 1) {
    for (let x = footprintX; x < footprintX + footprintW; x += 1) {
      const cell = detail.cells.find((candidate) => candidate.x === x && candidate.y === y);
      if (!cell) {
        continue;
      }

      cell.terrain = "GROUND";
      cell.blocked = false;
      cell.clearable = false;
    }
  }
}

function getDumpZoneObject(detail: PlotDetail): PlotObject | null {
  return detail.plot_objects.find((obj) => obj.kind === "DUMP_ZONE_8X8") ?? null;
}

export function getPlotObjectById(plot: Plot, objectId: string): PlotObject | null {
  const detail = plot.detail;
  if (!detail) {
    return null;
  }

  return detail.plot_objects.find((obj) => obj.id === objectId) ?? null;
}

function getOrCreateDumpZoneStorageState(dumpZoneObject: PlotObject) {
  if (!dumpZoneObject.storage) {
    dumpZoneObject.storage = {
      mode: "ABSTRACT",
      capacity_max: STARTER_DUMP_ZONE_CAPACITY,
      capacity_used: 0,
      item_counts: {},
      haul_blocked_until_ms: null,
    };
  }

  if (typeof dumpZoneObject.storage.haul_blocked_until_ms === "undefined") {
    dumpZoneObject.storage.haul_blocked_until_ms = null;
  }

  return dumpZoneObject.storage;
}

function getNearestObjectFootprintDistance(
  object: PlotObject,
  fromX: number,
  fromY: number
): number {
  const footprintW = object.footprint_w ?? 1;
  const footprintH = object.footprint_h ?? 1;
  const minX = object.x;
  const maxX = object.x + footprintW - 1;
  const minY = object.y;
  const maxY = object.y + footprintH - 1;

  const nearestX = Math.max(minX, Math.min(fromX, maxX));
  const nearestY = Math.max(minY, Math.min(fromY, maxY));
  return Math.abs(fromX - nearestX) + Math.abs(fromY - nearestY);
}

function canDumpZoneAcceptSingleItemNow(
  dumpZoneObject: PlotObject,
  itemId: ItemId,
  nowMs: number
): boolean {
  // Reserved for future time-based dump-zone rules.
  void nowMs;

  const storage = getOrCreateDumpZoneStorageState(dumpZoneObject);
  const itemDefinition = getItemDefinition(itemId);

  if (!itemDefinition.storage.allowed_storage_tags.includes("DUMP_ZONE")) {
    return false;
  }

  const nextCapacityUsed =
    storage.capacity_used + itemDefinition.storage.dump_zone_capacity_cost;

  if (nextCapacityUsed <= storage.capacity_max) {
    // Current branch does not extract from the dump zone yet.
    // If there is still space, any old retry timestamp is stale and should not
    // keep unrelated hauling blocked.
    storage.haul_blocked_until_ms = null;
    return true;
  }

  return false;
}

export type DirectHaulDestination =
  | { mode: "DUMP_ZONE"; object_id: string }
  | { mode: "MANUFACTURING_INPUT"; object_id: string }
  | { mode: "GROUND" };

export function resolveDirectHaulDestinationForSingleItem(
  plot: Plot,
  itemId: ItemId,
  sourceX: number,
  sourceY: number,
  nowMs: number,
  options?: {
    include_pending_manufacturing_jobs?: boolean;
    planned_inbound_by_station_item_key?: Map<string, number>;
  }
): DirectHaulDestination {
  const detail = plot.detail;
  if (!detail) {
    return { mode: "GROUND" };
  }

  const manufacturingInputDestination = findManufacturingInputDestinationForSingleItem(
    plot,
    itemId,
    sourceX,
    sourceY,
    {
      include_pending_jobs: options?.include_pending_manufacturing_jobs,
      planned_inbound_by_station_item_key:
        options?.planned_inbound_by_station_item_key,
    }
  );

  if (manufacturingInputDestination) {
    const manufacturingObject = getPlotObjectById(
      plot,
      manufacturingInputDestination.object_id
    );

    if (manufacturingObject) {
      const distanceToManufacturingInput = getNearestObjectFootprintDistance(
        manufacturingObject,
        sourceX,
        sourceY
      );

      if (distanceToManufacturingInput <= DIRECT_HAUL_MAX_DISTANCE_TILES) {
        return {
          mode: "MANUFACTURING_INPUT",
          object_id: manufacturingObject.id,
        };
      }
    }
  }

  const dumpZoneObject = getDumpZoneObject(detail);
  if (!dumpZoneObject) {
    return { mode: "GROUND" };
  }

  const itemDefinition = getItemDefinition(itemId);

  // Items that are not legal dump-zone storage should not poison the dump zone
  // with a retry cooldown. They simply have no dump-zone destination.
  if (!itemDefinition.storage.allowed_storage_tags.includes("DUMP_ZONE")) {
    return { mode: "GROUND" };
  }

  const distanceToDumpZone = getNearestObjectFootprintDistance(
    dumpZoneObject,
    sourceX,
    sourceY
  );
  if (distanceToDumpZone > DIRECT_HAUL_MAX_DISTANCE_TILES) {
    return { mode: "GROUND" };
  }

  if (!canDumpZoneAcceptSingleItemNow(dumpZoneObject, itemId, nowMs)) {
    const storage = getOrCreateDumpZoneStorageState(dumpZoneObject);

    // Retry cooldown is only for real capacity pressure, not unsupported items.
    storage.haul_blocked_until_ms = nowMs + DUMP_ZONE_RETRY_BLOCK_MS;
    return { mode: "GROUND" };
  }

  return {
    mode: "DUMP_ZONE",
    object_id: dumpZoneObject.id,
  };
}

export function tryDepositSingleItemIntoDumpZone(
  plot: Plot,
  dumpZoneObjectId: string,
  itemId: ItemId,
  nowMs: number
): { changed: boolean; deposited: boolean } {
  const detail = plot.detail;
  if (!detail) {
    return { changed: false, deposited: false };
  }

  const dumpZoneObject = detail.plot_objects.find(
    (obj) => obj.id === dumpZoneObjectId && obj.kind === "DUMP_ZONE_8X8"
  );
  if (!dumpZoneObject) {
    return { changed: false, deposited: false };
  }

  const storage = getOrCreateDumpZoneStorageState(dumpZoneObject);
  const itemDefinition = getItemDefinition(itemId);

  if (!itemDefinition.storage.allowed_storage_tags.includes("DUMP_ZONE")) {
    return { changed: false, deposited: false };
  }

  const nextCapacityUsed =
    storage.capacity_used + itemDefinition.storage.dump_zone_capacity_cost;
  if (nextCapacityUsed > storage.capacity_max) {
    storage.haul_blocked_until_ms = nowMs + DUMP_ZONE_RETRY_BLOCK_MS;
    return { changed: true, deposited: false };
  }

  storage.capacity_used = nextCapacityUsed;
  storage.item_counts[itemId] = (storage.item_counts[itemId] ?? 0) + 1;
  storage.haul_blocked_until_ms = null;

  return { changed: true, deposited: true };
}

function getRubbleObjectAtCell(plot: Plot, x: number, y: number): PlotObject | null {
  const detail = plot.detail;
  if (!detail) {
    return null;
  }

  for (const obj of detail.plot_objects) {
    if (obj.kind !== "RUBBLE_4X4") {
      continue;
    }

    if (objectOccupiesCell(obj, x, y)) {
      return obj;
    }
  }

  return null;
}

function getRubbleObjectById(plot: Plot, objectId: string): PlotObject | null {
  const plotObject = getPlotObjectById(plot, objectId);
  if (!plotObject || plotObject.kind !== "RUBBLE_4X4") {
    return null;
  }

  return plotObject;
}

function getLooseItems(detail: PlotDetail): PlotLooseItem[] {
  if (!Array.isArray(detail.loose_items)) {
    detail.loose_items = [];
  }

  return detail.loose_items;
}

function findLooseItemAtTile(
  detail: PlotDetail,
  x: number,
  y: number
): PlotLooseItem | null {
  for (const looseItem of getLooseItems(detail)) {
    if (looseItem.x === x && looseItem.y === y) {
      return looseItem;
    }
  }

  return null;
}

function makeLooseItemId(detail: PlotDetail): string {
  let maxNumericId = 0;

  for (const looseItem of getLooseItems(detail)) {
    const match = /^loose_(\d+)$/.exec(looseItem.id);
    if (!match) {
      continue;
    }

    const parsed = Number.parseInt(match[1], 10);
    if (Number.isFinite(parsed) && parsed > maxNumericId) {
      maxNumericId = parsed;
    }
  }

  return `loose_${maxNumericId + 1}`;
}

function getLooseItemReservations(looseItem: PlotLooseItem): PlotLooseItemReservation[] {
  if (!Array.isArray(looseItem.reservations)) {
    looseItem.reservations = [];
  }

  return looseItem.reservations;
}

function syncLooseItemLegacyReservationField(looseItem: PlotLooseItem): void {
  const reservations = getLooseItemReservations(looseItem).filter((reservation) => reservation.quantity > 0);
  looseItem.reservations = reservations;

  if (reservations.length === 1 && reservations[0]) {
    looseItem.reserved_by_npc_id = reservations[0].npc_id;
    return;
  }

  looseItem.reserved_by_npc_id = null;
}

export function getLooseItemById(plot: Plot, looseItemId: string): PlotLooseItem | null {
  const detail = plot.detail;
  if (!detail) {
    return null;
  }

  return getLooseItems(detail).find((looseItem) => looseItem.id === looseItemId) ?? null;
}

export function getLooseItemReservedQuantity(
  looseItem: PlotLooseItem,
  ignoreNpcId?: string | null
): number {
  let totalReserved = 0;

  for (const reservation of getLooseItemReservations(looseItem)) {
    if (reservation.quantity <= 0) {
      continue;
    }

    if (ignoreNpcId && reservation.npc_id === ignoreNpcId) {
      continue;
    }

    totalReserved += reservation.quantity;
  }

  return totalReserved;
}

export function reserveLooseItemQuantity(
  plot: Plot,
  looseItemId: string,
  npcId: string,
  quantity: number,
  nowMs: number
): boolean {
  if (quantity <= 0) {
    return false;
  }

  const looseItem = getLooseItemById(plot, looseItemId);
  if (!looseItem) {
    return false;
  }

  const availableQuantity = looseItem.quantity - getLooseItemReservedQuantity(looseItem, npcId);
  if (availableQuantity < quantity) {
    return false;
  }

  const reservations = getLooseItemReservations(looseItem);
  const existingReservation = reservations.find((reservation) => reservation.npc_id === npcId);
  if (existingReservation) {
    existingReservation.quantity += quantity;
    existingReservation.reserved_at_ms = nowMs;
  } else {
    reservations.push({
      npc_id: npcId,
      quantity,
      reserved_at_ms: nowMs,
    });
  }

  syncLooseItemLegacyReservationField(looseItem);
  return true;
}

export function releaseLooseItemReservation(
  plot: Plot,
  looseItemId: string,
  npcId: string
): boolean {
  const looseItem = getLooseItemById(plot, looseItemId);
  if (!looseItem) {
    return false;
  }

  const reservations = getLooseItemReservations(looseItem);
  const nextReservations = reservations.filter((reservation) => reservation.npc_id !== npcId);
  const changed = nextReservations.length !== reservations.length;
  if (!changed) {
    return false;
  }

  looseItem.reservations = nextReservations;
  syncLooseItemLegacyReservationField(looseItem);
  return true;
}

export function pickupReservedLooseItemQuantity(
  plot: Plot,
  looseItemId: string,
  npcId: string,
  quantity: number
): { changed: boolean; itemId: ItemId | null; quantityPicked: number } {
  if (quantity <= 0) {
    return { changed: false, itemId: null, quantityPicked: 0 };
  }

  const detail = plot.detail;
  if (!detail) {
    return { changed: false, itemId: null, quantityPicked: 0 };
  }

  const looseItems = getLooseItems(detail);
  const looseItemIndex = looseItems.findIndex((candidate) => candidate.id === looseItemId);
  if (looseItemIndex < 0) {
    return { changed: false, itemId: null, quantityPicked: 0 };
  }

  const looseItem = looseItems[looseItemIndex];
  const reservations = getLooseItemReservations(looseItem);
  const reservation = reservations.find((candidate) => candidate.npc_id === npcId);
  if (!reservation || reservation.quantity < quantity || looseItem.quantity < quantity) {
    return { changed: false, itemId: null, quantityPicked: 0 };
  }

  reservation.quantity -= quantity;
  looseItem.quantity -= quantity;
  looseItem.reservations = reservations.filter((candidate) => candidate.quantity > 0);
  syncLooseItemLegacyReservationField(looseItem);

  const itemId = looseItem.item_id;
  if (looseItem.quantity <= 0) {
    looseItems.splice(looseItemIndex, 1);
  }

  return {
    changed: true,
    itemId,
    quantityPicked: quantity,
  };
}

function isTileInsidePlotBounds(detail: PlotDetail, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < detail.width && y < detail.height;
}

function isAnyPlotObjectOccupyingTile(
  detail: PlotDetail,
  x: number,
  y: number,
  ignoreObjectId?: string | null
): boolean {
  for (const plotObject of detail.plot_objects) {
    if (ignoreObjectId && plotObject.id === ignoreObjectId) {
      continue;
    }

    if (objectOccupiesCell(plotObject, x, y)) {
      return true;
    }
  }

  return false;
}

function canLooseItemOccupyTile(
  detail: PlotDetail,
  x: number,
  y: number,
  itemId: ItemId,
  ignoreObjectId?: string | null
): boolean {
  if (!isTileInsidePlotBounds(detail, x, y)) {
    return false;
  }

  const cell = detail.cells.find((candidate) => candidate.x === x && candidate.y === y);
  if (!cell || cell.blocked) {
    return false;
  }

  if (isAnyPlotObjectOccupyingTile(detail, x, y, ignoreObjectId)) {
    return false;
  }

  const existingLooseItem = findLooseItemAtTile(detail, x, y);
  if (!existingLooseItem) {
    return true;
  }

  return existingLooseItem.item_id === itemId;
}

export function findLooseItemPlacementTileNear(
  plot: Plot,
  itemId: ItemId,
  preferredX: number,
  preferredY: number,
  ignoreObjectId?: string | null
): { x: number; y: number } | null {
  const detail = plot.detail;
  if (!detail) {
    return null;
  }

  const maxRadius = Math.max(detail.width, detail.height);

  // Ring search keeps placement deterministic and local-first.
  // We try the preferred tile first, then expand outward until we find:
  // - an empty valid tile
  // - or a same-item tile that can merge
  for (let radius = 0; radius <= maxRadius; radius += 1) {
    for (let y = preferredY - radius; y <= preferredY + radius; y += 1) {
      for (let x = preferredX - radius; x <= preferredX + radius; x += 1) {
        const onRingEdge =
          x === preferredX - radius ||
          x === preferredX + radius ||
          y === preferredY - radius ||
          y === preferredY + radius;

        if (!onRingEdge) {
          continue;
        }

        if (!canLooseItemOccupyTile(detail, x, y, itemId, ignoreObjectId)) {
          continue;
        }

        return { x, y };
      }
    }
  }

  return null;
}

export function spawnLooseItemNearTile(
  plot: Plot,
  itemId: ItemId,
  preferredX: number,
  preferredY: number,
  nowMs: number,
  ignoreObjectId?: string | null
): { changed: boolean; looseItem: PlotLooseItem | null } {
  const detail = plot.detail;
  if (!detail) {
    return { changed: false, looseItem: null };
  }

  const itemDefinition = getItemDefinition(itemId);
  if (!itemDefinition.storage.can_exist_loose) {
    return { changed: false, looseItem: null };
  }

  const placementTile = findLooseItemPlacementTileNear(
    plot,
    itemId,
    preferredX,
    preferredY,
    ignoreObjectId
  );
  if (!placementTile) {
    return { changed: false, looseItem: null };
  }

  const existingLooseItem = findLooseItemAtTile(detail, placementTile.x, placementTile.y);
  if (existingLooseItem) {
    existingLooseItem.quantity += 1;
    return { changed: true, looseItem: existingLooseItem };
  }

  const looseItem: PlotLooseItem = {
    id: makeLooseItemId(detail),
    item_id: itemId,
    quantity: 1,
    x: placementTile.x,
    y: placementTile.y,
    reserved_by_npc_id: null,
    reservations: [],
    created_at_ms: nowMs,
  };

  getLooseItems(detail).push(looseItem);
  return { changed: true, looseItem };
}

export function releaseManufacturingInputBufferToGround(
  plot: Plot,
  stationObjectId: string,
  nowMs: number
): { changed: boolean; released_quantity: number } {
  const stationObject = getPlotObjectById(plot, stationObjectId);
  if (!stationObject?.manufacturing) {
    return { changed: false, released_quantity: 0 };
  }

  let changed = false;
  let releasedQuantity = 0;
  const bufferedItemCounts = stationObject.manufacturing.input_buffer.item_counts;

  for (const [bufferedItemIdValue, bufferedQuantityValue] of Object.entries(bufferedItemCounts)) {
    const bufferedItemId = bufferedItemIdValue as ItemId;
    let remainingQuantity = Math.max(0, Math.floor(Number(bufferedQuantityValue ?? 0)));
    if (remainingQuantity <= 0) {
      delete bufferedItemCounts[bufferedItemId];
      continue;
    }

    while (remainingQuantity > 0) {
      const spawned = spawnLooseItemNearTile(
        plot,
        bufferedItemId,
        stationObject.x,
        stationObject.y,
        nowMs,
        stationObject.id
      );
      if (!spawned.changed) {
        break;
      }

      remainingQuantity -= 1;
      releasedQuantity += 1;
      changed = true;
    }

    if (remainingQuantity > 0) {
      bufferedItemCounts[bufferedItemId] = remainingQuantity;
    } else {
      delete bufferedItemCounts[bufferedItemId];
    }
  }

  return { changed, released_quantity: releasedQuantity };
}

function ensurePlotObjectsCollection(detail: PlotDetail): boolean {
  // Saved plots may still carry the old starter_objects field. Migrate that data
  // once into the durable plot_objects collection before any gameplay code uses it.
  let changed = false;
  const legacyStarterObjects =
    (detail as PlotDetail & { starter_objects?: PlotObject[] }).starter_objects;

  if (!Array.isArray(detail.plot_objects)) {
    detail.plot_objects = Array.isArray(legacyStarterObjects) ? legacyStarterObjects : [];
    changed = true;
  }

  if (Array.isArray(legacyStarterObjects)) {
    delete (detail as PlotDetail & { starter_objects?: PlotObject[] }).starter_objects;
    changed = true;
  }

  return changed;
}

function clearRubbleObjectFootprint(
  plot: Plot,
  rubbleObject: PlotObject
): boolean {
  const detail = plot.detail;
  if (!detail) {
    return false;
  }

  detail.plot_objects = detail.plot_objects.filter((obj) => obj.id !== rubbleObject.id);

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

function ensureStarterDumpZone(detail: PlotDetail): boolean {
  const migratedPlotObjects = ensurePlotObjectsCollection(detail);
  let changed = migratedPlotObjects;

  const existingDumpZone = getDumpZoneObject(detail);
  if (existingDumpZone) {
    const storage = getOrCreateDumpZoneStorageState(existingDumpZone);
    if (storage.capacity_max !== STARTER_DUMP_ZONE_CAPACITY) {
      storage.capacity_max = STARTER_DUMP_ZONE_CAPACITY;
      changed = true;
    }

    clearCellsInsideFootprint(
      detail,
      existingDumpZone.x,
      existingDumpZone.y,
      existingDumpZone.footprint_w ?? STARTER_DUMP_ZONE_SIZE,
      existingDumpZone.footprint_h ?? STARTER_DUMP_ZONE_SIZE
    );

    return changed;
  }

  const clearAreaMinX = Math.floor((detail.width - STARTER_CLEAR_AREA_SIZE) / 2);
  const clearAreaMinY = Math.floor((detail.height - STARTER_CLEAR_AREA_SIZE) / 2);
  const dumpZonePlacement = getStarterDumpZonePlacement(clearAreaMinX, clearAreaMinY);

  detail.plot_objects = detail.plot_objects.filter(
    (obj) =>
      obj.kind !== "RUBBLE_4X4" ||
      !footprintsOverlap(
        obj.x,
        obj.y,
        obj.footprint_w ?? 1,
        obj.footprint_h ?? 1,
        dumpZonePlacement.x,
        dumpZonePlacement.y,
        dumpZonePlacement.footprint_w,
        dumpZonePlacement.footprint_h
      )
  );

  detail.plot_objects.push(
    makeStarterDumpZoneObject(dumpZonePlacement.x, dumpZonePlacement.y)
  );

  clearCellsInsideFootprint(
    detail,
    dumpZonePlacement.x,
    dumpZonePlacement.y,
    dumpZonePlacement.footprint_w,
    dumpZonePlacement.footprint_h
  );

  changed = true;
  return changed;
}

function ensurePlotObjectItemBufferState(
  bufferState: PlotObjectItemBufferState | null | undefined
): { bufferState: PlotObjectItemBufferState; changed: boolean } {
  if (bufferState && typeof bufferState === "object" && bufferState.item_counts) {
    return { bufferState, changed: false };
  }

  return {
    bufferState: makeEmptyItemBufferState(),
    changed: true,
  };
}

function ensureStarterWorkbench(detail: PlotDetail): boolean {
  const migratedPlotObjects = ensurePlotObjectsCollection(detail);
  let changed = migratedPlotObjects;

  const existingWorkbench = detail.plot_objects.find(
    (obj) => obj.kind === "WORKBENCH_1X2"
  );

  if (existingWorkbench) {
    if (existingWorkbench.id !== "starter_workbench") {
      existingWorkbench.id = "starter_workbench";
      changed = true;
    }

    if (existingWorkbench.footprint_w !== STARTER_WORKBENCH_FOOTPRINT_W) {
      existingWorkbench.footprint_w = STARTER_WORKBENCH_FOOTPRINT_W;
      changed = true;
    }

    if (existingWorkbench.footprint_h !== STARTER_WORKBENCH_FOOTPRINT_H) {
      existingWorkbench.footprint_h = STARTER_WORKBENCH_FOOTPRINT_H;
      changed = true;
    }

    if (!existingWorkbench.manufacturing) {
      existingWorkbench.manufacturing = makeStarterWorkbenchManufacturingState();
      changed = true;
    } else {
      if (existingWorkbench.manufacturing.station_kind !== "WORKBENCH") {
        existingWorkbench.manufacturing.station_kind = "WORKBENCH";
        changed = true;
      }

      const allowedRecipeIds =
        getAllowedManufacturingRecipeIdsForStation("WORKBENCH");
      if (
        JSON.stringify(existingWorkbench.manufacturing.allowed_recipe_ids ?? []) !==
        JSON.stringify(allowedRecipeIds)
      ) {
        existingWorkbench.manufacturing.allowed_recipe_ids = allowedRecipeIds;
        changed = true;
      }

      if (!Array.isArray(existingWorkbench.manufacturing.queue)) {
        existingWorkbench.manufacturing.queue = [];
        changed = true;
      }

      if (typeof existingWorkbench.manufacturing.assigned_npc_id === "undefined") {
        existingWorkbench.manufacturing.assigned_npc_id = null;
        changed = true;
      }

      const inputBufferResult = ensurePlotObjectItemBufferState(
        existingWorkbench.manufacturing.input_buffer
      );
      existingWorkbench.manufacturing.input_buffer = inputBufferResult.bufferState;
      changed = changed || inputBufferResult.changed;

      const outputBufferResult = ensurePlotObjectItemBufferState(
        existingWorkbench.manufacturing.output_buffer
      );
      existingWorkbench.manufacturing.output_buffer = outputBufferResult.bufferState;
      changed = changed || outputBufferResult.changed;

      if (typeof existingWorkbench.manufacturing.active_craft === "undefined") {
        existingWorkbench.manufacturing.active_craft = null;
        changed = true;
      }
    }

    const footprintW =
      existingWorkbench.footprint_w ?? STARTER_WORKBENCH_FOOTPRINT_W;
    const footprintH =
      existingWorkbench.footprint_h ?? STARTER_WORKBENCH_FOOTPRINT_H;

    clearCellsInsideFootprint(
      detail,
      existingWorkbench.x,
      existingWorkbench.y,
      footprintW,
      footprintH
    );

    // Keep the authored south/front operate tile usable.
    clearCellsInsideFootprint(
      detail,
      existingWorkbench.x,
      existingWorkbench.y + footprintH,
      footprintW,
      1
    );

    return changed;
  }

  const shack = detail.plot_objects.find((obj) => obj.kind === "SHACK");
  if (!shack) {
    return changed;
  }

  const workbenchPlacement = getStarterWorkbenchPlacement(shack.x, shack.y);
  detail.plot_objects.push(
    makeStarterWorkbenchObject(workbenchPlacement.x, workbenchPlacement.y)
  );

  clearCellsInsideFootprint(
    detail,
    workbenchPlacement.x,
    workbenchPlacement.y,
    workbenchPlacement.footprint_w,
    workbenchPlacement.footprint_h
  );

  // Keep the authored south/front operate tile usable.
  clearCellsInsideFootprint(
    detail,
    workbenchPlacement.x,
    workbenchPlacement.y + workbenchPlacement.footprint_h,
    workbenchPlacement.footprint_w,
    1
  );

  changed = true;
  return changed;
}

function ensureStarterRubbleObjects(detail: PlotDetail): boolean {
  const migratedPlotObjects = ensurePlotObjectsCollection(detail);

  // Backward-safe migration helper:
  // if an older claimed plot has rubble cells but no rubble objects yet,
  // reconstruct the starter rubble object layout from the current cell data.
  const hasRubbleObjects = detail.plot_objects.some((obj) => obj.kind === "RUBBLE_4X4");
  if (hasRubbleObjects) {
    return migratedPlotObjects;
  }

  let changed = migratedPlotObjects;

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

      detail.plot_objects.push({
        id: `starter_rubble_${x}_${y}`,
        kind: "RUBBLE_4X4",
        x,
        y,
        footprint_w: STARTER_RUBBLE_SIZE,
        footprint_h: STARTER_RUBBLE_SIZE,
        remaining_output_rolls: rollStarterRubbleOutputRollCount(),
      });
      changed = true;
    }
  }

  return changed;
}

function ensureStarterRubbleObjectRemainingOutputs(detail: PlotDetail): boolean {
  const migratedPlotObjects = ensurePlotObjectsCollection(detail);
  let changed = migratedPlotObjects;

  for (const obj of detail.plot_objects) {
    if (obj.kind !== "RUBBLE_4X4") {
      continue;
    }

    if (
      typeof obj.remaining_output_rolls !== "number" ||
      obj.remaining_output_rolls <= 0
    ) {
      // Older saves may still have the pre-logistics clear-hit field.
      // Migrate it once into the new remaining-output model.
      const legacyClearHits =
        (obj as PlotObject & { clear_hits_remaining?: number }).clear_hits_remaining;

      obj.remaining_output_rolls =
        typeof legacyClearHits === "number" && legacyClearHits > 0
          ? legacyClearHits
          : rollStarterRubbleOutputRollCount();

      delete (obj as PlotObject & { clear_hits_remaining?: number }).clear_hits_remaining;
      changed = true;
    }
  }

  return changed;
}

function normalizeStarterNpc(
  plotId: string,
  npc: PlotDetailNpc,
  fallbackJobType: "SCAVENGER" | "LABORER"
): boolean {
  let changed = false;

  if (typeof npc.name !== "string" || npc.name.length === 0) {
    npc.name = makeNpcName(makeStarterNpcNameSeed(plotId, npc.id));
    changed = true;
  }

  if (npc.job_type !== "SCAVENGER" && npc.job_type !== "LABORER") {
    npc.job_type = fallbackJobType;
    changed = true;
  }

  if (
    typeof npc.current_activity !== "string" ||
    npc.current_activity.length === 0
  ) {
    npc.current_activity = npc.state === "idle" ? "Idle" : "Busy";
    changed = true;
  }

  if (!Array.isArray(npc.traits)) {
    npc.traits = [];
    changed = true;
  }

  const expectedAllowedOrderKinds: ("SCAVENGING" | "SCAVENGING_SINGLE")[] =
    npc.job_type === "SCAVENGER"
      ? ["SCAVENGING", "SCAVENGING_SINGLE"]
      : [];

  const hasMatchingAllowedOrders =
    Array.isArray(npc.allowed_order_kinds) &&
    npc.allowed_order_kinds.length === expectedAllowedOrderKinds.length &&
    npc.allowed_order_kinds.every(
      (kind, index) => kind === expectedAllowedOrderKinds[index]
    );

  if (!hasMatchingAllowedOrders) {
    npc.allowed_order_kinds = expectedAllowedOrderKinds;
    changed = true;
  }

  if (typeof (npc as PlotDetailNpc & { assigned_job_id?: string | null }).assigned_job_id === "undefined") {
    (npc as PlotDetailNpc & { assigned_job_id?: string | null }).assigned_job_id = null;
    changed = true;
  }

  if (typeof (npc as PlotDetailNpc & { haul_target_mode?: string | null }).haul_target_mode === "undefined") {
    (npc as PlotDetailNpc & { haul_target_mode?: string | null }).haul_target_mode = null;
    changed = true;
  }

  if (typeof (npc as PlotDetailNpc & { haul_target_object_id?: string | null }).haul_target_object_id === "undefined") {
    (npc as PlotDetailNpc & { haul_target_object_id?: string | null }).haul_target_object_id = null;
    changed = true;
  }

  return changed;
}

function ensureStarterNpcData(plot: Plot): boolean {
  const detail = plot.detail;
  if (!detail) {
    return false;
  }

  let changed = ensurePlotObjectsCollection(detail);

  if (!Array.isArray(detail.npcs)) {
    detail.npcs = [];
    changed = true;
  }

  if (!Array.isArray((detail as any).jobs)) {
    (detail as any).jobs = [];
    changed = true;
  }

  let fallbackX = 0;
  let fallbackY = 0;

  const oldMarker = detail.plot_objects.find((obj) => obj.kind === "NPC_MARKER");
  if (oldMarker) {
    fallbackX = oldMarker.x;
    fallbackY = oldMarker.y;
    detail.plot_objects = detail.plot_objects.filter(
      (obj) => obj.id !== oldMarker.id
    );
    changed = true;
  } else {
    const shack = detail.plot_objects.find((obj) => obj.kind === "SHACK");
    if (shack) {
      const shackW = shack.footprint_w ?? 1;
      const shackH = shack.footprint_h ?? 1;
      fallbackX = shack.x + shackW + 1;
      fallbackY = shack.y + shackH - 1;
    }
  }

  if (detail.npcs.length === 0) {
    detail.npcs.push(
      makeStarterNpc(plot.id, "starter_worker_1", fallbackX, fallbackY, "SCAVENGER")
    );
    detail.npcs.push(
      makeStarterNpc(plot.id, "starter_worker_2", fallbackX, fallbackY + 2, "LABORER")
    );
    changed = true;
  }

  for (let index = 0; index < detail.npcs.length; index += 1) {
    const fallbackJobType = index === 0 ? "SCAVENGER" : "LABORER";
    const npc = detail.npcs[index];

    if (normalizeStarterNpc(plot.id, npc, fallbackJobType)) {
      changed = true;
    }

    if (!Array.isArray(npc.carry_slots)) {
      npc.carry_slots = [];
      changed = true;
    }
  }

  if (typeof detail.active_order === "undefined") {
    detail.active_order = null;
    changed = true;
  }

  if (!Array.isArray(detail.loose_items)) {
    detail.loose_items = [];
    changed = true;
  }

  for (const looseItem of detail.loose_items) {
    if (!Array.isArray(looseItem.reservations)) {
      looseItem.reservations = [];
      changed = true;
    }

    if (
      typeof looseItem.reserved_by_npc_id === "string" &&
      looseItem.reserved_by_npc_id.length > 0 &&
      looseItem.reservations.length === 0
    ) {
      looseItem.reservations.push({
        npc_id: looseItem.reserved_by_npc_id,
        quantity: 1,
        reserved_at_ms: looseItem.created_at_ms,
      });
      changed = true;
    }

    syncLooseItemLegacyReservationField(looseItem);
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

export function extractRubbleOutputFromPlotObject(
  plot: Plot,
  objectId: string
): { changed: boolean; cleared: boolean; outputsRemaining: number; itemId: ItemId | null } {
  const rubbleObject = getRubbleObjectById(plot, objectId);
  if (!rubbleObject) {
    return { changed: false, cleared: false, outputsRemaining: -1, itemId: null };
  }

  const currentOutputsRemaining =
    typeof rubbleObject.remaining_output_rolls === "number" && rubbleObject.remaining_output_rolls > 0
      ? rubbleObject.remaining_output_rolls
      : rollStarterRubbleOutputRollCount();

  const itemId = rollStarterRubbleOutputItem();

  if (currentOutputsRemaining > 1) {
    rubbleObject.remaining_output_rolls = currentOutputsRemaining - 1;
    return {
      changed: true,
      cleared: false,
      outputsRemaining: rubbleObject.remaining_output_rolls,
      itemId,
    };
  }

  const cleared = clearRubbleObjectFootprint(plot, rubbleObject);
  return {
    changed: cleared,
    cleared,
    outputsRemaining: 0,
    itemId,
  };
}

export function applyClearActionToPlotObject(
  plot: Plot,
  objectId: string,
  nowMs: number = Date.now()
): { changed: boolean; cleared: boolean; hitsRemaining: number } {
  // Manual/debug clear actions should still yield a real loose item.
  // Capture the source tile before extraction in case this work round exhausts
  // and removes the rubble object completely.
  const sourceObject = getRubbleObjectById(plot, objectId);
  const preferredX = sourceObject?.x ?? 0;
  const preferredY = sourceObject?.y ?? 0;

  const action = extractRubbleOutputFromPlotObject(plot, objectId);
  if (!action.changed || !action.itemId) {
    return {
      changed: action.changed,
      cleared: action.cleared,
      hitsRemaining: action.outputsRemaining,
    };
  }

  spawnLooseItemNearTile(plot, action.itemId, preferredX, preferredY, nowMs, objectId);

  return {
    changed: true,
    cleared: action.cleared,
    hitsRemaining: action.outputsRemaining,
  };
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
    return clearRubbleObjectFootprint(plot, rubbleObject);
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
const STARTER_DUMP_ZONE_SIZE = 8;
const STARTER_DUMP_ZONE_CAPACITY = 200;
const STARTER_WORKBENCH_FOOTPRINT_W = 1;
const STARTER_WORKBENCH_FOOTPRINT_H = 4;
const DIRECT_HAUL_MAX_DISTANCE_TILES = 80;
const DUMP_ZONE_RETRY_BLOCK_MS = 60_000;

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
  const hasAnyMissingCoords = world.plots?.some(
    (p: any) => typeof p.x !== "number" || typeof p.y !== "number"
  );
  const hasOldType = world.plots?.some((p: any) => p.type === "RES_SHARED");

  if (hasAnyMissingCoords || hasOldType) {
    world.plots = makeStarterPlots3x3();
    world.version = 1;
    changed = true;
    return {
      changed,
      reason: "Old save detected (missing coords / old plot type). Regenerated starter 3x3.",
    };
  }

  // Ensure any missing tiles in the current bounds are filled (safety)
  const bounds = getWorldBounds(world);
  const added = fillRectMissing(world, bounds);
  if (added.length > 0) {
    world.version += 1;
    changed = true;
  }

  let migratedPlotObjects = 0;
  let migratedRubbleObjects = 0;
  let migratedRubbleClearHits = 0;

  for (const plot of world.plots) {
    if (!plot.detail) {
      continue;
    }

    if (ensurePlotObjectsCollection(plot.detail)) {
      migratedPlotObjects += 1;
      changed = true;
    }

    if (ensureStarterDumpZone(plot.detail)) {
      changed = true;
    }

    if (ensureStarterWorkbench(plot.detail)) {
      changed = true;
    }

    if (ensureStarterRubbleObjects(plot.detail)) {
      migratedRubbleObjects += 1;
      changed = true;
    }

    if (ensureStarterRubbleObjectRemainingOutputs(plot.detail)) {
      migratedRubbleClearHits += 1;
      changed = true;
    }

    if (ensureStarterNpcData(plot)) {
      changed = true;
    }
  }

  if (migratedPlotObjects > 0 || migratedRubbleObjects > 0 || migratedRubbleClearHits > 0) {
    return {
      changed,
      reason:
        `Migrated plot-object collections for ${migratedPlotObjects} claimed plot(s), ` +
        `reconstructed rubble objects for ${migratedRubbleObjects} claimed plot(s), ` +
        `and initialized rubble output counts for ${migratedRubbleClearHits} claimed plot(s).`,
    };
  }

  if (added.length > 0) {
    return { changed, reason: `Filled ${added.length} missing tiles inside existing bounds.` };
  }

  return { changed };
}