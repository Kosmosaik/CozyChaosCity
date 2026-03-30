import {
  Plot,
  PlotDetail,
  PlotDetailNpc,
  PlotNpcCarrySlot,
  PlotObject,
  PlotJob,
  PlotOrderKind,
  PlotOrderTargetScope,
} from "../net/protocol";

import {
  extractRubbleOutputFromPlotObject,
  findLooseItemPlacementTileNear,
  getLooseItemById,
  getPlotObjectById,
  resolveDirectHaulDestinationForSingleItem,
  spawnLooseItemNearTile,
  tryDepositSingleItemIntoDumpZone,
} from "./world";

import {
  assignNextLooseItemHaulJob,
  assignNextManufacturingOutputHaulJob,
  assignSpecificLooseItemHaulJob,
  getHaulDestinationPriority,
  getHaulPickupDurationMs,
  HAUL_JOB_SEARCH_RADIUS_TILES,
  pickupManufacturingOutputForHaulJob,
  pickupLooseItemForHaulJob,
  releaseLooseItemHaulReservationForJob,
  syncLooseItemHaulJobs,
} from "./hauling";

import {
  completeManufacturingCraft,
  findActiveManufacturingCraftByNpc,
  findManufacturingStationAssignedToNpc,
  findReadyManufacturingStationForNpc,
  reserveManufacturingStationForNpc,
  tryDepositSingleItemIntoManufacturingInput,
  tryStartManufacturingCraft,
} from "./manufacturing";

const MOVE_MS_PER_CELL = 430;
const MIN_MOVE_MS = 450;
const WORK_MS = 9000;
const DROP_MS = 750;
const PICKUP_RECOVER_MS = 1800;
const DROP_RECOVER_MS = 1800;
const MAX_ROAM_SEGMENT_CELLS = 4;
const TERMINAL_JOB_RETENTION_MS = 5_000;

const ACTIVITY_BY_STATE: Record<PlotDetailNpc["state"], string> = {
  idle: "Idle",
  moving_to_target: "Walking to rubble",
  working: "Clearing rubble",
  pickup_recover: "Finishing pickup",
  carrying_to_dropoff: "Carrying item",
  dropping_off: "Dropping off item",
  dropoff_recover: "Finishing dropoff",
  returning: "Returning",
};

const DEFAULT_SCAVENGE_ORDER_KIND: PlotOrderKind = "SCAVENGING";
const DEFAULT_SCAVENGE_TARGET_SCOPE: PlotOrderTargetScope = "ALL";

function updateNpcActivity(npc: PlotDetailNpc, activityOverride?: string | null) {
  npc.current_activity = activityOverride ?? ACTIVITY_BY_STATE[npc.state];
}

function canNpcTakeOrder(npc: PlotDetailNpc, orderKind: PlotOrderKind): boolean {
  return (
    Array.isArray(npc.allowed_order_kinds) &&
    npc.allowed_order_kinds.includes(orderKind)
  );
}

function canNpcTakeScavengeJobs(npc: PlotDetailNpc): boolean {
  return canNpcTakeOrder(npc, "SCAVENGING") || canNpcTakeOrder(npc, "SCAVENGING_SINGLE");
}

function canNpcOperateManufacturing(npc: PlotDetailNpc): boolean {
  return npc.job_type === "LABORER";
}

function getEligibleNpcsForOrder(detail: PlotDetail, orderKind: PlotOrderKind): PlotDetailNpc[] {
  const npcs = Array.isArray(detail.npcs) ? detail.npcs : [];
  return npcs.filter((npc) => canNpcTakeOrder(npc, orderKind));
}

function getDetail(plot: Plot): PlotDetail | null {
  return plot.detail ?? null;
}

function getJobs(detail: PlotDetail): PlotJob[] {
  if (!Array.isArray(detail.jobs)) {
    detail.jobs = [];
  }

  return detail.jobs;
}

function getRubbleObjects(plot: Plot) {
  const detail = getDetail(plot);
  if (!detail) return [];

  return detail.plot_objects.filter((obj) => obj.kind === "RUBBLE_4X4");
}

function manhattanDistance(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

function getNearestObjectFootprintTile(
  object: PlotObject,
  fromX: number,
  fromY: number
): { x: number; y: number } {
  const footprintW = object.footprint_w ?? 1;
  const footprintH = object.footprint_h ?? 1;
  const minX = object.x;
  const maxX = object.x + footprintW - 1;
  const minY = object.y;
  const maxY = object.y + footprintH - 1;

  return {
    x: Math.max(minX, Math.min(fromX, maxX)),
    y: Math.max(minY, Math.min(fromY, maxY)),
  };
}

function getDumpZoneDropoffCell(
  detail: PlotDetail,
  dumpZoneObject: PlotObject,
  fromX: number,
  fromY: number
): { x: number; y: number } {
  const nearestFootprintTile = getNearestObjectFootprintTile(
    dumpZoneObject,
    fromX,
    fromY
  );

  // Dump-zone dropoff should not strand workers inside an isolated pass-through
  // footprint. Find the nearest walkable exterior access tile around the zone.
  const nearestExteriorTile = findNearestWalkableGroundTile(
    detail,
    nearestFootprintTile.x,
    nearestFootprintTile.y,
    16
  );

  if (nearestExteriorTile) {
    return nearestExteriorTile;
  }

  // Last-resort fallback: stay where the worker already is rather than snapping
  // deeper into a footprint that may have no useful exit route.
  return { x: fromX, y: fromY };
}

function getDropoffCell(
  plot: Plot,
  npc: PlotDetailNpc,
  nowMs: number
): { x: number; y: number } {
  const detail = getDetail(plot);
  if (!detail) {
    return { x: npc.home_x, y: npc.home_y };
  }

  const carriedItem = getFirstCarriedItemId(npc);
  if (!carriedItem) {
    npc.haul_target_mode = null;
    npc.haul_target_object_id = null;
    return { x: npc.home_x, y: npc.home_y };
  }

  const preferredX = npc.x;
  const preferredY = npc.y;
  const haulTarget = resolveDirectHaulDestinationForSingleItem(
    plot,
    carriedItem,
    preferredX,
    preferredY,
    nowMs
  );

  if (
    haulTarget.mode === "DUMP_ZONE" ||
    haulTarget.mode === "MANUFACTURING_INPUT"
  ) {
    const targetObject = getPlotObjectById(plot, haulTarget.object_id);
    if (targetObject) {
      npc.haul_target_mode = haulTarget.mode;
      npc.haul_target_object_id = targetObject.id;

      if (haulTarget.mode === "MANUFACTURING_INPUT") {
        return getManufacturingInteractionCell(
          detail,
          targetObject,
          "INPUT",
          npc.x,
          npc.y
        );
      }

      return getDumpZoneDropoffCell(detail, targetObject, npc.x, npc.y);
    }
  }

  npc.haul_target_mode = "GROUND";
  npc.haul_target_object_id = null;

  const syntheticPlot: Plot = {
    id: "synthetic_drop_target_plot",
    type: "PLAYER",
    x: 0,
    y: 0,
    claimed_by: null,
    detail,
  };

  const dropTile = findLooseItemPlacementTileNear(
    syntheticPlot,
    carriedItem,
    preferredX,
    preferredY,
    npc.target_object_id ?? null
  );

  if (dropTile) {
    return dropTile;
  }

  return { x: npc.home_x, y: npc.home_y };
}

function clearMovementFields(npc: PlotDetailNpc) {
  npc.move_to_x = null;
  npc.move_to_y = null;
}

function clearNpcCarrySlots(npc: PlotDetailNpc): void {
  npc.carry_slots = [];
}

function clearNpcHaulTarget(npc: PlotDetailNpc): void {
  npc.haul_target_mode = null;
  npc.haul_target_object_id = null;
}

function clearNpcJobAssignment(npc: PlotDetailNpc): void {
  npc.assigned_job_id = null;
  npc.assigned_order = null;
  npc.target_object_id = null;
}

function createCarrySlotsForSingleItem(itemId: PlotNpcCarrySlot["item_id"]): PlotNpcCarrySlot[] {
  return [{ slot: "LEFT_HAND", item_id: itemId, quantity: 1 }];
}

function getFirstCarriedItemId(npc: PlotDetailNpc): PlotNpcCarrySlot["item_id"] | null {
  const firstSlot = Array.isArray(npc.carry_slots) ? npc.carry_slots[0] : null;
  return firstSlot?.item_id ?? null;
}

function snapNpcToMoveTarget(npc: PlotDetailNpc) {
  if (typeof npc.move_to_x === "number") npc.x = npc.move_to_x;
  if (typeof npc.move_to_y === "number") npc.y = npc.move_to_y;
  clearMovementFields(npc);
}

function setNpcIdle(npc: PlotDetailNpc): void {
  npc.state = "idle";
  npc.state_started_at_ms = null;
  npc.state_ends_at_ms = null;
  clearMovementFields(npc);
  updateNpcActivity(npc);
}

function beginTimedState(
  npc: PlotDetailNpc,
  state: PlotDetailNpc["state"],
  nowMs: number,
  durationMs: number,
  activityOverride?: string | null
) {
  npc.state = state;
  npc.state_started_at_ms = nowMs;
  npc.state_ends_at_ms = nowMs + durationMs;
  updateNpcActivity(npc, activityOverride);
}

function beginMove(
  npc: PlotDetailNpc,
  state: "moving_to_target" | "carrying_to_dropoff" | "returning",
  targetX: number,
  targetY: number,
  nowMs: number,
  activityOverride?: string | null
) {
  const dist = manhattanDistance(npc.x, npc.y, targetX, targetY);
  const durationMs = Math.max(MIN_MOVE_MS, dist * MOVE_MS_PER_CELL);

  npc.move_to_x = targetX;
  npc.move_to_y = targetY;
  beginTimedState(npc, state, nowMs, durationMs, activityOverride);
}

function makeJobId(objectId: string): string {
  return `job_scavenge_${objectId}`;
}

function isActiveOrderJob(job: PlotJob): boolean {
  if (job.source_order_kind == null || job.source_target_scope == null) {
    return false;
  }

  return job.status === "queued" || job.status === "reserved" || job.status === "in_progress" || job.status === "blocked";
}

function syncActiveOrder(detail: PlotDetail) {
  const activeJobs = getJobs(detail).filter((job) => isActiveOrderJob(job));
  if (activeJobs.length === 0) {
    detail.active_order = null;
    return;
  }

  const oldest = activeJobs.reduce((best, job) => (job.created_at_ms < best.created_at_ms ? job : best));
  detail.active_order = {
    kind: oldest.source_order_kind ?? DEFAULT_SCAVENGE_ORDER_KIND,
    target_scope: oldest.source_target_scope ?? DEFAULT_SCAVENGE_TARGET_SCOPE,
    issued_at_ms: oldest.created_at_ms,
  };
}

function hasActiveScavengeJobs(detail: PlotDetail): boolean {
  return getJobs(detail).some((job) => job.kind === "SCAVENGE_RUBBLE" && (job.status === "queued" || job.status === "reserved" || job.status === "in_progress"));
}

function hasQueuedScavengeJobs(detail: PlotDetail): boolean {
  return getJobs(detail).some((job) => job.kind === "SCAVENGE_RUBBLE" && job.status === "queued");
}

function hasQueuedHaulJobs(detail: PlotDetail): boolean {
  return getJobs(detail).some(
    (job) =>
      (job.kind === "HAUL_LOOSE_ITEM" ||
        job.kind === "HAUL_MANUFACTURING_OUTPUT") &&
      job.status === "queued"
  );
}

function isCancelableJobStatus(status: PlotJob["status"]): boolean {
  return status === "queued" || status === "reserved" || status === "in_progress" || status === "blocked";
}

function getObjectEdgeWorkCell(
  detail: PlotDetail,
  object: PlotObject,
  fromX: number,
  fromY: number
): { x: number; y: number } {
  const w = object.footprint_w ?? 1;
  const h = object.footprint_h ?? 1;
  const minX = object.x;
  const maxX = object.x + w - 1;
  const minY = object.y;
  const maxY = object.y + h - 1;
  const candidates: Array<{ x: number; y: number }> = [];

  for (let x = minX; x <= maxX; x += 1) {
    candidates.push({ x, y: minY - 1 });
    candidates.push({ x, y: maxY + 1 });
  }

  for (let y = minY; y <= maxY; y += 1) {
    candidates.push({ x: minX - 1, y });
    candidates.push({ x: maxX + 1, y });
  }

  let bestCandidate: { x: number; y: number } | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    // Work cells must be on real walkable ground, not on the footprint itself.
    if (!isWalkableGroundRoamTile(detail, candidate.x, candidate.y)) {
      continue;
    }

    const distance = manhattanDistance(fromX, fromY, candidate.x, candidate.y);
    if (distance < bestDistance) {
      bestCandidate = candidate;
      bestDistance = distance;
    }
  }

  if (bestCandidate) {
    return bestCandidate;
  }

  // Fallback only if no adjacent walkable tile exists.
  const clampedX = Math.max(
    0,
    Math.min(detail.width - 1, Math.max(minX, Math.min(fromX, maxX)))
  );
  const clampedY = Math.max(
    0,
    Math.min(detail.height - 1, Math.max(minY, Math.min(fromY, maxY)))
  );
  return { x: clampedX, y: clampedY };
}

type ManufacturingInteractionKind = "OPERATE" | "INPUT" | "OUTPUT";

function getWorkbenchRowPriority(
  footprintH: number,
  interactionKind: ManufacturingInteractionKind
): number[] {
  const rowPriority: number[] = [];
  const usedRows = new Set<number>();

  function pushRow(rowOffset: number): void {
    if (rowOffset < 0 || rowOffset >= footprintH || usedRows.has(rowOffset)) {
      return;
    }

    rowPriority.push(rowOffset);
    usedRows.add(rowOffset);
  }

  if (interactionKind === "INPUT") {
    for (let rowOffset = 0; rowOffset < footprintH; rowOffset += 1) {
      pushRow(rowOffset);
    }
    return rowPriority;
  }

  if (interactionKind === "OUTPUT") {
    for (let rowOffset = footprintH - 1; rowOffset >= 0; rowOffset -= 1) {
      pushRow(rowOffset);
    }
    return rowPriority;
  }

  const lowerCenterRow = Math.floor(footprintH / 2);
  const upperCenterRow = Math.max(0, lowerCenterRow - 1);

  pushRow(lowerCenterRow);
  pushRow(upperCenterRow);

  for (let rowOffset = 0; rowOffset < footprintH; rowOffset += 1) {
    pushRow(rowOffset);
  }

  return rowPriority;
}

function getWorkbenchInteractionCell(
  detail: PlotDetail,
  workbench: PlotObject,
  interactionKind: ManufacturingInteractionKind,
  fromX: number,
  fromY: number
): { x: number; y: number } {
  const footprintW = workbench.footprint_w ?? 1;
  const footprintH = workbench.footprint_h ?? 1;
  const minX = workbench.x;
  const maxX = workbench.x + footprintW - 1;
  const minY = workbench.y;
  const maxY = workbench.y + footprintH - 1;

  // Keep actual bench operation on the authored south/front cell.
  // Input/output can use side-adjacent interaction tiles, but operating should
  // stay where the current workbench presentation already expects it.
  if (interactionKind === "OPERATE") {
    const operateX = minX + Math.floor((footprintW - 1) / 2);
    const operateY = maxY + 1;

    if (isWalkableGroundRoamTile(detail, operateX, operateY)) {
      return { x: operateX, y: operateY };
    }

    return getObjectEdgeWorkCell(detail, workbench, fromX, fromY);
  }

  // Input/output use side-adjacent routing so they no longer collapse onto the
  // same tile as the operate interaction.
  const preferredSideXs =
    fromX <= minX ? [minX - 1, maxX + 1] : [maxX + 1, minX - 1];

  const rowPriority = getWorkbenchRowPriority(footprintH, interactionKind);
  const orderedCandidates: Array<{ x: number; y: number }> = [];

  for (const rowOffset of rowPriority) {
    const rowY = minY + rowOffset;

    for (const sideX of preferredSideXs) {
      orderedCandidates.push({ x: sideX, y: rowY });
    }
  }

  for (const candidate of orderedCandidates) {
    if (isWalkableGroundRoamTile(detail, candidate.x, candidate.y)) {
      return candidate;
    }
  }

  return getObjectEdgeWorkCell(detail, workbench, fromX, fromY);
}

function getManufacturingInteractionCell(
  detail: PlotDetail,
  object: PlotObject,
  interactionKind: ManufacturingInteractionKind,
  fromX: number,
  fromY: number
): { x: number; y: number } {
  if (object.kind === "WORKBENCH_1X2") {
    return getWorkbenchInteractionCell(
      detail,
      object,
      interactionKind,
      fromX,
      fromY
    );
  }

  return getObjectEdgeWorkCell(detail, object, fromX, fromY);
}

function isNpcPassThroughObjectKind(kind: PlotObject["kind"]): boolean {
  return kind === "DUMP_ZONE_8X8";
}

function doesBlockingPlotObjectOccupyTile(
  detail: PlotDetail,
  x: number,
  y: number
): boolean {
  for (const plotObject of detail.plot_objects) {
    const footprintW = plotObject.footprint_w ?? 1;
    const footprintH = plotObject.footprint_h ?? 1;

    if (
      x >= plotObject.x &&
      x < plotObject.x + footprintW &&
      y >= plotObject.y &&
      y < plotObject.y + footprintH &&
      !isNpcPassThroughObjectKind(plotObject.kind)
    ) {
      return true;
    }
  }

  return false;
}

function isWalkableGroundRoamTile(detail: PlotDetail, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= detail.width || y >= detail.height) {
    return false;
  }

  const cell = detail.cells.find((candidate) => candidate.x === x && candidate.y === y);
  if (!cell || cell.blocked || cell.terrain !== "GROUND") {
    return false;
  }

  // Dump zones are intentionally walk-through. Other footprints still block
  // roaming and work-cell selection.
  if (doesBlockingPlotObjectOccupyTile(detail, x, y)) {
    return false;
  }

  return true;
}

function findNearestWalkableGroundTile(
  detail: PlotDetail,
  fromX: number,
  fromY: number,
  maxRadius: number
): { x: number; y: number } | null {
  if (isWalkableGroundRoamTile(detail, fromX, fromY)) {
    return { x: fromX, y: fromY };
  }

  for (let radius = 1; radius <= maxRadius; radius += 1) {
    let bestTile: { x: number; y: number } | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let dx = -radius; dx <= radius; dx += 1) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        if (Math.abs(dx) + Math.abs(dy) !== radius) {
          continue;
        }

        const candidateX = fromX + dx;
        const candidateY = fromY + dy;

        if (!isWalkableGroundRoamTile(detail, candidateX, candidateY)) {
          continue;
        }

        const distance = manhattanDistance(fromX, fromY, candidateX, candidateY);
        if (distance < bestDistance) {
          bestTile = { x: candidateX, y: candidateY };
          bestDistance = distance;
        }
      }
    }

    if (bestTile) {
      return bestTile;
    }
  }

  return null;
}

function rescueNpcFromInvalidStandingTile(
  detail: PlotDetail,
  npc: PlotDetailNpc
): boolean {
  if (isWalkableGroundRoamTile(detail, npc.x, npc.y)) {
    return false;
  }

  const rescuedTile = findNearestWalkableGroundTile(detail, npc.x, npc.y, 4);
  if (!rescuedTile) {
    return false;
  }

  // This remains a safety rail for ending up inside blocking footprints such as
  // rubble or workbenches. Dump zones are now intentionally pass-through and
  // no longer trigger rescue.
  npc.x = rescuedTile.x;
  npc.y = rescuedTile.y;
  clearMovementFields(npc);
  return true;
}

function makeTileKey(x: number, y: number): string {
  return `${x},${y}`;
}

function parseTileKey(tileKey: string): { x: number; y: number } {
  const [xPart, yPart] = tileKey.split(",");
  return { x: Number(xPart), y: Number(yPart) };
}

function findNearestQueuedHaulSourceTile(
  plot: Plot,
  npc: PlotDetailNpc
): { x: number; y: number } | null {
  const detail = getDetail(plot);
  if (!detail) {
    return null;
  }

  let bestTarget: { x: number; y: number } | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestPriority = Number.POSITIVE_INFINITY;
  let bestCreatedAtMs = Number.POSITIVE_INFINITY;

  for (const job of getJobs(detail)) {
    if (job.status !== "queued" || job.assigned_npc_id !== null) {
      continue;
    }

    let sourceX = npc.x;
    let sourceY = npc.y;

    if (job.kind === "HAUL_LOOSE_ITEM") {
      if (typeof job.target_loose_item_id !== "string") {
        continue;
      }

      const looseItem = getLooseItemById(plot, job.target_loose_item_id);
      if (!looseItem) {
        continue;
      }

      sourceX = looseItem.x;
      sourceY = looseItem.y;
    } else if (job.kind === "HAUL_MANUFACTURING_OUTPUT") {
      if (typeof job.target_object_id !== "string") {
        continue;
      }

      const stationObject = getPlotObjectById(plot, job.target_object_id);
      if (!stationObject) {
        continue;
      }

      // Output hauling should approach the output side of the station.
      const stationWorkCell = getManufacturingInteractionCell(
        detail,
        stationObject,
        "OUTPUT",
        npc.x,
        npc.y
      );
      sourceX = stationWorkCell.x;
      sourceY = stationWorkCell.y;
    } else {
      continue;
    }

    const distance = manhattanDistance(npc.x, npc.y, sourceX, sourceY);
    const destinationPriority = getHaulDestinationPriority(
      job.haul_destination_mode
    );

    if (
      bestTarget === null ||
      destinationPriority < bestPriority ||
      (destinationPriority === bestPriority && distance < bestDistance) ||
      (
        destinationPriority === bestPriority &&
        distance === bestDistance &&
        job.created_at_ms < bestCreatedAtMs
      )
    ) {
      bestTarget = { x: sourceX, y: sourceY };
      bestDistance = distance;
      bestPriority = destinationPriority;
      bestCreatedAtMs = job.created_at_ms;
    }
  }

  return bestTarget;
}

function buildGroundRoamPath(
  detail: PlotDetail,
  startX: number,
  startY: number,
  targetX: number,
  targetY: number
): Array<{ x: number; y: number }> | null {
  if (!isWalkableGroundRoamTile(detail, targetX, targetY)) {
    return null;
  }

  const startKey = makeTileKey(startX, startY);
  const targetKey = makeTileKey(targetX, targetY);
  const frontier: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];
  const visited = new Set<string>([startKey]);
  const previousByKey = new Map<string, string | null>();
  previousByKey.set(startKey, null);

  const neighborOffsets: Array<{ x: number; y: number }> = [
    { x: -1, y: 0 },
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
  ];

  while (frontier.length > 0) {
    const current = frontier.shift();
    if (!current) {
      break;
    }

    if (current.x === targetX && current.y === targetY) {
      break;
    }

    for (const offset of neighborOffsets) {
      const nextX = current.x + offset.x;
      const nextY = current.y + offset.y;
      const nextKey = makeTileKey(nextX, nextY);

      if (visited.has(nextKey)) {
        continue;
      }

      if (!isWalkableGroundRoamTile(detail, nextX, nextY)) {
        continue;
      }

      visited.add(nextKey);
      previousByKey.set(nextKey, makeTileKey(current.x, current.y));
      frontier.push({ x: nextX, y: nextY });
    }
  }

  if (!previousByKey.has(targetKey)) {
    return null;
  }

  const reversedPath: Array<{ x: number; y: number }> = [];
  let currentKey: string | null = targetKey;
  while (currentKey !== null) {
    reversedPath.push(parseTileKey(currentKey));
    currentKey = previousByKey.get(currentKey) ?? null;
  }

  return reversedPath.reverse();
}

function buildBestEffortGroundRoamPath(
  detail: PlotDetail,
  startX: number,
  startY: number,
  targetX: number,
  targetY: number
): Array<{ x: number; y: number }> | null {
  if (!isWalkableGroundRoamTile(detail, startX, startY)) {
    return null;
  }

  const startKey = makeTileKey(startX, startY);
  const targetKey = makeTileKey(targetX, targetY);
  const frontier: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];
  const visited = new Set<string>([startKey]);
  const previousByKey = new Map<string, string | null>();
  previousByKey.set(startKey, null);

  const neighborOffsets: Array<{ x: number; y: number }> = [
    { x: -1, y: 0 },
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
  ];

  let bestReachableKey = startKey;
  let bestReachableDistance = manhattanDistance(startX, startY, targetX, targetY);

  while (frontier.length > 0) {
    const current = frontier.shift();
    if (!current) {
      break;
    }

    const currentDistance = manhattanDistance(
      current.x,
      current.y,
      targetX,
      targetY
    );

    // Track the closest tile inside the current connected walkable region.
    if (currentDistance < bestReachableDistance) {
      bestReachableKey = makeTileKey(current.x, current.y);
      bestReachableDistance = currentDistance;
    }

    if (current.x === targetX && current.y === targetY) {
      bestReachableKey = targetKey;
      break;
    }

    for (const offset of neighborOffsets) {
      const nextX = current.x + offset.x;
      const nextY = current.y + offset.y;
      const nextKey = makeTileKey(nextX, nextY);

      if (visited.has(nextKey)) {
        continue;
      }

      if (!isWalkableGroundRoamTile(detail, nextX, nextY)) {
        continue;
      }

      visited.add(nextKey);
      previousByKey.set(nextKey, makeTileKey(current.x, current.y));
      frontier.push({ x: nextX, y: nextY });
    }
  }

  if (!previousByKey.has(bestReachableKey) || bestReachableKey === startKey) {
    return null;
  }

  const reversedPath: Array<{ x: number; y: number }> = [];
  let currentKey: string | null = bestReachableKey;

  while (currentKey !== null) {
    reversedPath.push(parseTileKey(currentKey));
    currentKey = previousByKey.get(currentKey) ?? null;
  }

  return reversedPath.reverse();
}

function getStraightRoamWaypoint(
  roamPath: Array<{ x: number; y: number }>
): { x: number; y: number } | null {
  if (roamPath.length < 2) {
    return null;
  }

  let waypoint = roamPath[1];
  let directionX = waypoint.x - roamPath[0].x;
  let directionY = waypoint.y - roamPath[0].y;
  let traversedCells = 1;

  for (let index = 2; index < roamPath.length; index += 1) {
    if (traversedCells >= MAX_ROAM_SEGMENT_CELLS) {
      break;
    }

    const nextDirectionX = roamPath[index].x - roamPath[index - 1].x;
    const nextDirectionY = roamPath[index].y - roamPath[index - 1].y;

    if (nextDirectionX !== directionX || nextDirectionY !== directionY) {
      break;
    }

    waypoint = roamPath[index];
    directionX = nextDirectionX;
    directionY = nextDirectionY;
    traversedCells += 1;
  }

  return waypoint;
}

function beginRoamingTowardQueuedHaulWork(
  plot: Plot,
  npc: PlotDetailNpc,
  nowMs: number
): boolean {
  const detail = getDetail(plot);
  if (!detail) {
    return false;
  }

  const sourceTile = findNearestQueuedHaulSourceTile(plot, npc);
  if (!sourceTile) {
    return false;
  }

  const distanceToSource = manhattanDistance(npc.x, npc.y, sourceTile.x, sourceTile.y);
  if (distanceToSource <= HAUL_JOB_SEARCH_RADIUS_TILES) {
    return false;
  }

  // Prefer a real connected path to the haul source when one exists.
  // If the current starter layout places the NPC in a disconnected walkable
  // region, fall back to a best-effort roam slice toward the nearest reachable
  // frontier tile instead of idling in place.
  const roamPath =
    buildGroundRoamPath(detail, npc.x, npc.y, sourceTile.x, sourceTile.y) ??
    buildBestEffortGroundRoamPath(detail, npc.x, npc.y, sourceTile.x, sourceTile.y);

  if (!roamPath) {
    return false;
  }

  const waypoint = getStraightRoamWaypoint(roamPath);
  if (!waypoint) {
    return false;
  }

  clearNpcJobAssignment(npc);
  clearNpcHaulTarget(npc);

  // First roaming slice:
  // move along a ground-only corridor segment until a real haul job comes into range.
  beginMove(
    npc,
    "moving_to_target",
    waypoint.x,
    waypoint.y,
    nowMs,
    "Roaming for haul work"
  );
  return true;
}

function createScavengeJob(rubble: PlotObject, nowMs: number, orderKind: PlotOrderKind, targetScope: PlotOrderTargetScope): PlotJob {
  return {
    id: makeJobId(rubble.id),
    kind: "SCAVENGE_RUBBLE",
    source_order_kind: orderKind,
    source_target_scope: targetScope,
    target_object_id: rubble.id,
    target_loose_item_id: null,
    haul_item_id: null,
    haul_quantity: null,
    haul_destination_mode: null,
    haul_destination_object_id: null,
    blocked_reason: null,
    status: "queued",
    assigned_npc_id: null,
    created_at_ms: nowMs,
    updated_at_ms: nowMs,
  };
}

function ensureScavengeJobsForAll(plot: Plot, nowMs: number, orderKind: PlotOrderKind, targetScope: PlotOrderTargetScope): number {
  const detail = getDetail(plot);
  if (!detail) return 0;

  const jobs = getJobs(detail);
  const rubbleObjects = getRubbleObjects(plot);
  let created = 0;

  for (const rubble of rubbleObjects) {
    const jobId = makeJobId(rubble.id);
    const existing = jobs.find((job) => job.id === jobId && job.status !== "completed" && job.status !== "cancelled");
    if (existing) continue;

    jobs.push(createScavengeJob(rubble, nowMs, orderKind, targetScope));
    created += 1;
  }

  syncActiveOrder(detail);
  return created;
}

function ensureScavengeJobForSingle(plot: Plot, nowMs: number, orderKind: PlotOrderKind, targetScope: PlotOrderTargetScope): number {
  const detail = getDetail(plot);
  if (!detail) return 0;

  const jobs = getJobs(detail);
  const rubbleObjects = getRubbleObjects(plot);
  const eligibleNpcs = getEligibleNpcsForOrder(detail, orderKind);
  if (eligibleNpcs.length === 0 || rubbleObjects.length === 0) return 0;

  let bestRubble: PlotObject | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const rubble of rubbleObjects) {
    const jobId = makeJobId(rubble.id);
    const existing = jobs.find((job) => job.id === jobId && job.status !== "completed" && job.status !== "cancelled");
    if (existing) continue;

    let nearestNpcDistance = Number.POSITIVE_INFINITY;
    for (const npc of eligibleNpcs) {
      const target = getObjectEdgeWorkCell(detail, rubble, npc.x, npc.y);
      const dist = manhattanDistance(npc.x, npc.y, target.x, target.y);
      if (dist < nearestNpcDistance) nearestNpcDistance = dist;
    }

    if (bestRubble === null || nearestNpcDistance < bestDistance || (nearestNpcDistance === bestDistance && rubble.id.localeCompare(bestRubble.id) < 0)) {
      bestRubble = rubble;
      bestDistance = nearestNpcDistance;
    }
  }

  if (!bestRubble) {
    syncActiveOrder(detail);
    return 0;
  }

  jobs.push(createScavengeJob(bestRubble, nowMs, orderKind, targetScope));
  syncActiveOrder(detail);
  return 1;
}

function findJobTargetCell(plot: Plot, job: PlotJob, fromX: number, fromY: number): { x: number; y: number } | null {
  const detail = getDetail(plot);
  if (!detail || job.kind !== "SCAVENGE_RUBBLE" || typeof job.target_object_id !== "string") return null;

  const rubble = detail.plot_objects.find((obj) => obj.kind === "RUBBLE_4X4" && obj.id === job.target_object_id);
  if (!rubble) return null;

  return getObjectEdgeWorkCell(detail, rubble, fromX, fromY);
}

function findAssignedJob(detail: PlotDetail, npc: PlotDetailNpc): PlotJob | null {
  const jobs = getJobs(detail);

  if (typeof npc.assigned_job_id === "string" && npc.assigned_job_id.length > 0) {
    const assignedJob = jobs.find((job) => job.id === npc.assigned_job_id && (job.status === "reserved" || job.status === "in_progress"));
    if (assignedJob) return assignedJob;
  }

  return jobs.find((job) => job.assigned_npc_id === npc.id && job.target_object_id === npc.target_object_id && (job.status === "reserved" || job.status === "in_progress")) ?? null;
}

function releaseAssignedHaulReservation(plot: Plot, npc: PlotDetailNpc, job?: PlotJob | null): void {
  const detail = getDetail(plot);
  if (!detail) return;

  const assignedJob = job ?? findAssignedJob(detail, npc);
  if (!assignedJob) return;

  releaseLooseItemHaulReservationForJob(plot, assignedJob, npc.id);
}

function assignNextScavengeJob(plot: Plot, npc: PlotDetailNpc, nowMs: number): boolean {
  const detail = getDetail(plot);
  if (!detail || !canNpcTakeScavengeJobs(npc)) return false;

  let nextJob: PlotJob | null = null;
  let nextJobDistance = Number.POSITIVE_INFINITY;

  for (const candidateJob of getJobs(detail)) {
    if (candidateJob.kind !== "SCAVENGE_RUBBLE" || candidateJob.status !== "queued" || candidateJob.assigned_npc_id !== null) continue;

    const target = findJobTargetCell(plot, candidateJob, npc.x, npc.y);
    if (!target) continue;

    const dist = manhattanDistance(npc.x, npc.y, target.x, target.y);
    if (nextJob === null || dist < nextJobDistance || (dist === nextJobDistance && candidateJob.created_at_ms < nextJob.created_at_ms)) {
      nextJob = candidateJob;
      nextJobDistance = dist;
    }
  }

  if (!nextJob) return false;

  const target = findJobTargetCell(plot, nextJob, npc.x, npc.y);
  if (!target) {
    nextJob.status = "cancelled";
    nextJob.updated_at_ms = nowMs;
    nextJob.assigned_npc_id = null;
    return assignNextScavengeJob(plot, npc, nowMs);
  }

  nextJob.status = "reserved";
  nextJob.assigned_npc_id = npc.id;
  nextJob.updated_at_ms = nowMs;

  npc.assigned_job_id = nextJob.id;
  npc.assigned_order = nextJob.source_order_kind ?? null;
  npc.target_object_id = nextJob.target_object_id ?? null;
  clearNpcCarrySlots(npc);
  clearNpcHaulTarget(npc);

  beginMove(npc, "moving_to_target", target.x, target.y, nowMs);
  syncActiveOrder(detail);
  return true;
}

function tryBeginImmediateHaulForFreshScavengeOutput(
  plot: Plot,
  npc: PlotDetailNpc,
  itemId: PlotNpcCarrySlot["item_id"],
  nowMs: number
): boolean {
  const detail = getDetail(plot);
  if (!detail) {
    return false;
  }

  const spawned = spawnLooseItemNearTile(
    plot,
    itemId,
    npc.x,
    npc.y,
    nowMs,
    npc.target_object_id ?? null
  );
  if (!spawned.changed || !spawned.looseItem) {
    return false;
  }

  // Route fresh scavenger output through the shared haul-job system.
  // The item still becomes real authoritative loose state first, but because it
  // spawned at the worker's feet we can continue seamlessly into carrying.
  syncLooseItemHaulJobs(plot, nowMs);

  const haulAssignment = assignSpecificLooseItemHaulJob(
    plot,
    npc,
    spawned.looseItem.id,
    nowMs
  );
  if (!haulAssignment.ok || !haulAssignment.job) {
    return false;
  }

  const pickup = pickupLooseItemForHaulJob(plot, haulAssignment.job, npc.id);
  if (!pickup.changed || !pickup.itemId) {
    releaseAssignedHaulReservation(plot, npc, haulAssignment.job);
    haulAssignment.job.status = "cancelled";
    haulAssignment.job.assigned_npc_id = null;
    haulAssignment.job.blocked_reason = "pickup_failed";
    haulAssignment.job.updated_at_ms = nowMs;
    return false;
  }

  haulAssignment.job.status = "in_progress";
  haulAssignment.job.assigned_npc_id = npc.id;
  haulAssignment.job.haul_item_id = pickup.itemId;
  haulAssignment.job.updated_at_ms = nowMs;

  npc.assigned_job_id = haulAssignment.job.id;
  npc.assigned_order = null;
  npc.target_object_id = null;
  npc.carry_slots = createCarrySlotsForSingleItem(pickup.itemId);

  const dropoff = getDropoffCell(plot, npc, nowMs);
  beginMove(npc, "carrying_to_dropoff", dropoff.x, dropoff.y, nowMs, "Carrying item");
  syncActiveOrder(detail);
  return true;
}

function assignReadyManufacturingStation(
  plot: Plot,
  npc: PlotDetailNpc,
  nowMs: number
): boolean {
  const detail = getDetail(plot);
  if (!detail) {
    return false;
  }

  if (!canNpcOperateManufacturing(npc)) {
    return false;
  }

  const readyStation = findReadyManufacturingStationForNpc(plot, npc.x, npc.y);
  if (!readyStation) {
    return false;
  }

  const stationObject = getPlotObjectById(plot, readyStation.object_id);
  if (!stationObject?.manufacturing) {
    return false;
  }

  const reserved = reserveManufacturingStationForNpc(
    plot,
    stationObject.id,
    npc.id
  );
  if (!reserved.reserved) {
    return false;
  }

  clearNpcCarrySlots(npc);
  clearNpcHaulTarget(npc);
  npc.assigned_job_id = null;
  npc.assigned_order = null;
  npc.target_object_id = stationObject.id;

  const workCell = getManufacturingInteractionCell(
    detail,
    stationObject,
    "OPERATE",
    npc.x,
    npc.y
  );

  beginMove(
    npc,
    "moving_to_target",
    workCell.x,
    workCell.y,
    nowMs,
    "Walking to workbench"
  );

  return true;
}

function assignNextAvailableWork(plot: Plot, npc: PlotDetailNpc, nowMs: number): boolean {
  const detail = getDetail(plot);
  if (!detail) return false;

  const wasIdle = npc.state === "idle";

  if (hasQueuedScavengeJobs(detail) && assignNextScavengeJob(plot, npc, nowMs)) {
    return true;
  }

  if (assignReadyManufacturingStation(plot, npc, nowMs)) {
    return true;
  }

  const outputHaulAssignment = assignNextManufacturingOutputHaulJob(
    plot,
    npc,
    nowMs
  );
  if (outputHaulAssignment.ok && outputHaulAssignment.job && outputHaulAssignment.stationObject) {
    npc.assigned_job_id = outputHaulAssignment.job.id;
    npc.assigned_order = null;
    npc.target_object_id = outputHaulAssignment.stationObject.id;
    clearNpcCarrySlots(npc);
    clearNpcHaulTarget(npc);

    const pickupCell = getManufacturingInteractionCell(
      detail,
      outputHaulAssignment.stationObject,
      "OUTPUT",
      npc.x,
      npc.y
    );

    beginMove(
      npc,
      "moving_to_target",
      pickupCell.x,
      pickupCell.y,
      nowMs,
      "Walking to output buffer"
    );
    syncActiveOrder(detail);
    return true;
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const haulAssignment = assignNextLooseItemHaulJob(plot, npc, nowMs);
    if (haulAssignment.ok && haulAssignment.job && haulAssignment.looseItem) {
      npc.assigned_job_id = haulAssignment.job.id;
      npc.assigned_order = null;
      npc.target_object_id = null;
      clearNpcCarrySlots(npc);
      clearNpcHaulTarget(npc);
      beginMove(
        npc,
        "moving_to_target",
        haulAssignment.looseItem.x,
        haulAssignment.looseItem.y,
        nowMs,
        "Walking to item"
      );
      syncActiveOrder(detail);
      return true;
    }

    if (!hasQueuedHaulJobs(detail)) {
      break;
    }
  }

  if (hasQueuedHaulJobs(detail) && beginRoamingTowardQueuedHaulWork(plot, npc, nowMs)) {
    syncActiveOrder(detail);
    return true;
  }

  clearNpcJobAssignment(npc);
  clearNpcHaulTarget(npc);

  setNpcIdle(npc);
  syncActiveOrder(detail);
  return !wasIdle;
}

export function wakeIdleNpcsForAvailableWork(plot: Plot, nowMs: number): boolean {
  const detail = getDetail(plot);
  if (!detail) {
    return false;
  }

  let changed = false;

  for (const npc of detail.npcs ?? []) {
    if (npc.state !== "idle") {
      continue;
    }

    // This helper is intentionally narrow:
    // it only wakes already-idle workers after an external server action
    // created or rerouted work, so we do not need to wait for the next
    // unrelated simulation tick for them to react.
    if (assignNextAvailableWork(plot, npc, nowMs)) {
      changed = true;
    }
  }

  return changed;
}

function isTerminalJobStatus(status: PlotJob["status"]): boolean {
  return status === "completed" || status === "cancelled";
}

export function pruneStaleTerminalJobs(plot: Plot, nowMs: number): boolean {
  const detail = getDetail(plot);
  if (!detail || !Array.isArray(detail.jobs) || detail.jobs.length === 0) {
    return false;
  }

  const nextJobs = detail.jobs.filter((job) => {
    if (!isTerminalJobStatus(job.status)) {
      return true;
    }

    const updatedAtMs =
      typeof job.updated_at_ms === "number" ? job.updated_at_ms : 0;

    // Keep terminal jobs around briefly so local debug/UI can still observe
    // recent completions, but do not let them accumulate forever in the save
    // file or outbound plot-update payloads.
    return nowMs - updatedAtMs < TERMINAL_JOB_RETENTION_MS;
  });

  if (nextJobs.length === detail.jobs.length) {
    return false;
  }

  detail.jobs = nextJobs;
  syncActiveOrder(detail);
  return true;
}

function depositCarriedItem(plot: Plot, npc: PlotDetailNpc, nowMs: number): void {
  const carriedItemId = getFirstCarriedItemId(npc);
  if (!carriedItemId) {
    return;
  }

  if (
    npc.haul_target_mode === "DUMP_ZONE" &&
    typeof npc.haul_target_object_id === "string"
  ) {
    const deposit = tryDepositSingleItemIntoDumpZone(
      plot,
      npc.haul_target_object_id,
      carriedItemId,
      nowMs
    );
    if (!deposit.deposited) {
      spawnLooseItemNearTile(
        plot,
        carriedItemId,
        npc.x,
        npc.y,
        nowMs,
        npc.haul_target_object_id
      );
    }
    return;
  }

  if (
    npc.haul_target_mode === "MANUFACTURING_INPUT" &&
    typeof npc.haul_target_object_id === "string"
  ) {
    const deposit = tryDepositSingleItemIntoManufacturingInput(
      plot,
      npc.haul_target_object_id,
      carriedItemId
    );
    if (!deposit.deposited) {
      // If the queue was cleared mid-haul, do not destroy the item.
      // Drop it back near the station so the logistics loop can see it again.
      spawnLooseItemNearTile(
        plot,
        carriedItemId,
        npc.x,
        npc.y,
        nowMs,
        npc.haul_target_object_id
      );
    }
    return;
  }

  spawnLooseItemNearTile(
    plot,
    carriedItemId,
    npc.x,
    npc.y,
    nowMs,
    npc.target_object_id ?? null
  );
}

export function cancelActivePlotOrder(plot: Plot): { ok: boolean; reason?: string; cancelled_order_kind?: PlotOrderKind; cancelled_target_scope?: PlotOrderTargetScope } {
  const detail = getDetail(plot);
  if (!detail) return { ok: false, reason: "plot_detail_missing" };

  const activeOrder = detail.active_order;
  if (!activeOrder) return { ok: false, reason: "no_active_order" };

  const jobs = getJobs(detail);
  const cancelledTargetIds = new Set<string>();
  let cancelledAny = false;
  const remainingJobs: PlotJob[] = [];

  for (const job of jobs) {
    const matchesActiveOrder = job.source_order_kind === activeOrder.kind && job.source_target_scope === activeOrder.target_scope;
    if (matchesActiveOrder && isCancelableJobStatus(job.status)) {
      cancelledAny = true;
      if (typeof job.target_object_id === "string") cancelledTargetIds.add(job.target_object_id);
      continue;
    }
    remainingJobs.push(job);
  }

  jobs.length = 0;
  for (const job of remainingJobs) jobs.push(job);

  for (const npc of detail.npcs ?? []) {
    const job = findAssignedJob(detail, npc);
    const isAssignedToActiveOrder = job && job.source_order_kind === activeOrder.kind && job.source_target_scope === activeOrder.target_scope;
    const isAssignedToCancelledTarget = typeof npc.target_object_id === "string" && cancelledTargetIds.has(npc.target_object_id);
    if (!isAssignedToActiveOrder && !isAssignedToCancelledTarget) continue;

    releaseAssignedHaulReservation(plot, npc, job);
    clearNpcCarrySlots(npc);
    clearNpcHaulTarget(npc);
    clearNpcJobAssignment(npc);

    // Cancel should stop work cleanly and leave the NPC where it actually is.
    // We no longer synthesize a return-home phase here.
    setNpcIdle(npc);
  }

  syncActiveOrder(detail);
  return {
    ok: cancelledAny,
    reason: cancelledAny ? undefined : "no_active_order",
    cancelled_order_kind: activeOrder.kind,
    cancelled_target_scope: activeOrder.target_scope,
  };
}

export function issueScavengingOrder(plot: Plot, nowMs: number, orderKind: PlotOrderKind = "SCAVENGING", targetScope: PlotOrderTargetScope = "ALL"): { ok: boolean; reason?: string } {
  const detail = getDetail(plot);
  if (!detail) return { ok: false, reason: "plot_detail_missing" };

  const isAllOrder = orderKind === "SCAVENGING" && targetScope === "ALL";
  const isSingleOrder = orderKind === "SCAVENGING_SINGLE" && targetScope === "SINGLE";
  if (!isAllOrder && !isSingleOrder) return { ok: false, reason: "invalid_order" };

  if (getEligibleNpcsForOrder(detail, orderKind).length === 0) return { ok: false, reason: "no_eligible_npc" };
  if (getRubbleObjects(plot).length === 0) return { ok: false, reason: "nothing_to_scavenge" };
  if (hasActiveScavengeJobs(detail)) return { ok: false, reason: "order_already_active" };

  const created = isSingleOrder ? ensureScavengeJobForSingle(plot, nowMs, orderKind, targetScope) : ensureScavengeJobsForAll(plot, nowMs, orderKind, targetScope);
  if (created === 0) return { ok: false, reason: "nothing_to_scavenge" };

  for (const npc of detail.npcs ?? []) {
    if (npc.state === "idle") assignNextAvailableWork(plot, npc, nowMs);
  }

  syncActiveOrder(detail);
  return { ok: true };
}

function tickNpc(plot: Plot, npc: PlotDetailNpc, nowMs: number): boolean {
  const detail = getDetail(plot);
  if (!detail) return false;

  let changed = false;

  if (rescueNpcFromInvalidStandingTile(detail, npc)) {
    changed = true;
  }

  if (npc.state === "returning") {
    clearNpcHaulTarget(npc);
    clearNpcJobAssignment(npc);
    setNpcIdle(npc);
    syncActiveOrder(detail);
    return true;
  }

  if (typeof npc.state_ends_at_ms === "number" && nowMs < npc.state_ends_at_ms) {
    return changed;
  }

  switch (npc.state) {
    case "idle": {
      // Idle workers must always re-check available work, not only queued haul /
      // scavenge jobs. Manufacturing can become immediately startable once buffered
      // inputs are ready, and that state is not represented by a queued haul job.
      return assignNextAvailableWork(plot, npc, nowMs) || changed;
    }

    case "moving_to_target": {
      snapNpcToMoveTarget(npc);
      const job = findAssignedJob(detail, npc);
      if (!job) {
        const assignedStation = findManufacturingStationAssignedToNpc(plot, npc.id);
        if (
          assignedStation?.manufacturing &&
          npc.target_object_id === assignedStation.id
        ) {
          const craftStart = tryStartManufacturingCraft(
            plot,
            assignedStation.id,
            npc.id,
            nowMs
          );
          if (craftStart.started && typeof craftStart.ends_at_ms === "number") {
            beginTimedState(
              npc,
              "working",
              nowMs,
              craftStart.ends_at_ms - nowMs,
              "Operating workbench"
            );
            return true;
          }

          clearNpcJobAssignment(npc);
          clearNpcHaulTarget(npc);
          setNpcIdle(npc);
          return assignNextAvailableWork(plot, npc, nowMs) || changed;
        }

        clearNpcJobAssignment(npc);
        clearNpcHaulTarget(npc);
        return assignNextAvailableWork(plot, npc, nowMs) || changed;
      }

      if (job.kind === "HAUL_LOOSE_ITEM" || job.kind === "HAUL_MANUFACTURING_OUTPUT") {
        const pickupActivity =
          job.kind === "HAUL_MANUFACTURING_OUTPUT"
            ? "Picking up output item"
            : "Picking up item";

        beginTimedState(
          npc,
          "working",
          nowMs,
          getHaulPickupDurationMs(),
          pickupActivity
        );
        return true;
      }

      job.status = "in_progress";
      job.updated_at_ms = nowMs;
      beginTimedState(npc, "working", nowMs, WORK_MS);
      return true;
    }

    case "working": {
      const activeCraft = findActiveManufacturingCraftByNpc(plot, npc.id);
      if (
        activeCraft?.stationObject.manufacturing?.active_craft &&
        npc.target_object_id === activeCraft.stationObject.id
      ) {
        completeManufacturingCraft(plot, activeCraft.stationObject.id, npc.id, nowMs);
        syncLooseItemHaulJobs(plot, nowMs);

        clearNpcCarrySlots(npc);
        clearNpcHaulTarget(npc);
        clearNpcJobAssignment(npc);

        // Completing a craft can immediately expose follow-up work.
        return assignNextAvailableWork(plot, npc, nowMs) || changed;
      }

      const job = findAssignedJob(detail, npc);
      if (!job) {
        clearNpcJobAssignment(npc);
        clearNpcHaulTarget(npc);
        setNpcIdle(npc);
        syncActiveOrder(detail);
        return true;
      }

      if (job.kind === "HAUL_LOOSE_ITEM" || job.kind === "HAUL_MANUFACTURING_OUTPUT") {
        const pickup =
          job.kind === "HAUL_LOOSE_ITEM"
            ? pickupLooseItemForHaulJob(plot, job, npc.id)
            : pickupManufacturingOutputForHaulJob(plot, job);

        if (!pickup.changed || !pickup.itemId) {
          if (job.kind === "HAUL_LOOSE_ITEM") {
            releaseAssignedHaulReservation(plot, npc, job);
          }

          job.status = "cancelled";
          job.assigned_npc_id = null;
          job.blocked_reason = "pickup_failed";
          job.updated_at_ms = nowMs;

          clearNpcJobAssignment(npc);
          clearNpcHaulTarget(npc);
          clearNpcCarrySlots(npc);
          return assignNextAvailableWork(plot, npc, nowMs) || changed;
        }

        job.status = "in_progress";
        job.assigned_npc_id = npc.id;
        job.haul_item_id = pickup.itemId;
        job.updated_at_ms = nowMs;

        npc.carry_slots = createCarrySlotsForSingleItem(pickup.itemId);

        // Play a short finish beat before starting the carry move.
        const pickupRecoverActivity =
          job.kind === "HAUL_MANUFACTURING_OUTPUT"
            ? "Finishing output pickup"
            : "Finishing pickup";

        beginTimedState(
          npc,
          "pickup_recover",
          nowMs,
          PICKUP_RECOVER_MS,
          pickupRecoverActivity
        );
        syncActiveOrder(detail);
        return true;
      }

      if (!npc.target_object_id) {
        clearNpcJobAssignment(npc);
        clearNpcHaulTarget(npc);
        setNpcIdle(npc);
        syncActiveOrder(detail);
        return true;
      }

      const action = extractRubbleOutputFromPlotObject(plot, npc.target_object_id);
      if (!action.changed || !action.itemId) {
        job.status = "cancelled";
        job.assigned_npc_id = null;
        job.updated_at_ms = nowMs;
        clearNpcJobAssignment(npc);
        clearNpcHaulTarget(npc);
        setNpcIdle(npc);
        syncActiveOrder(detail);
        return true;
      }

      if (action.cleared) {
        job.status = "completed";
        job.assigned_npc_id = npc.id;
        job.updated_at_ms = nowMs;
      } else {
        job.status = "queued";
        job.assigned_npc_id = null;
        job.updated_at_ms = nowMs;
      }

      npc.assigned_job_id = null;

      if (tryBeginImmediateHaulForFreshScavengeOutput(plot, npc, action.itemId, nowMs)) {
        return true;
      }

      npc.carry_slots = createCarrySlotsForSingleItem(action.itemId);
      const dropoff = getDropoffCell(plot, npc, nowMs);
      beginMove(npc, "carrying_to_dropoff", dropoff.x, dropoff.y, nowMs);
      syncActiveOrder(detail);
      return true;
    }

    case "pickup_recover": {
      const dropoff = getDropoffCell(plot, npc, nowMs);
      const carryActivity =
        npc.haul_target_mode === "MANUFACTURING_INPUT"
          ? "Carrying to input buffer"
          : "Carrying item";

      beginMove(
        npc,
        "carrying_to_dropoff",
        dropoff.x,
        dropoff.y,
        nowMs,
        carryActivity
      );
      syncActiveOrder(detail);
      return true;
    }

    case "carrying_to_dropoff": {
      snapNpcToMoveTarget(npc);

      const dropActivity =
        npc.haul_target_mode === "MANUFACTURING_INPUT"
          ? "Dropping into input buffer"
          : "Dropping off item";

      beginTimedState(npc, "dropping_off", nowMs, DROP_MS, dropActivity);
      return true;
    }

    case "dropping_off": {
      const job = findAssignedJob(detail, npc);
      depositCarriedItem(plot, npc, nowMs);

      if (
        job &&
        (job.kind === "HAUL_LOOSE_ITEM" ||
          job.kind === "HAUL_MANUFACTURING_OUTPUT")
      ) {
        job.status = "completed";
        job.assigned_npc_id = npc.id;
        job.blocked_reason = null;
        job.updated_at_ms = nowMs;
      }

      clearNpcCarrySlots(npc);
      clearNpcHaulTarget(npc);
      clearNpcJobAssignment(npc);

      beginTimedState(
        npc,
        "dropoff_recover",
        nowMs,
        DROP_RECOVER_MS,
        "Finishing dropoff"
      );
      syncActiveOrder(detail);
      return true;
    }

    case "dropoff_recover": {
      // After finishing a dropoff, immediately re-evaluate all work types.
      return assignNextAvailableWork(plot, npc, nowMs) || changed;
    }

    default: {
      return changed;
    }
  }
}

export function tickNpcSimulation(world: { plots: Plot[] }, nowMs: number): Plot[] {
  const changedPlots: Plot[] = [];

  for (const plot of world.plots) {
    if (plot.type !== "PLAYER" || !plot.claimed_by || !plot.detail || !plot.detail.npcs?.length) {
      continue;
    }

    let changed = false;

    if (syncLooseItemHaulJobs(plot, nowMs)) {
      changed = true;
    }

    for (const npc of plot.detail.npcs) {
      if (tickNpc(plot, npc, nowMs)) {
        changed = true;
      }
    }

    if (pruneStaleTerminalJobs(plot, nowMs)) {
      changed = true;
    }

    if (changed) {
      changedPlots.push(plot);
    }
  }

  return changedPlots;
}
