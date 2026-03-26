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
  assignSpecificLooseItemHaulJob,
  getHaulDestinationPriority,
  getHaulPickupDurationMs,
  HAUL_JOB_SEARCH_RADIUS_TILES,
  pickupLooseItemForHaulJob,
  releaseLooseItemHaulReservationForJob,
  syncLooseItemHaulJobs,
} from "./hauling";

import { tryDepositSingleItemIntoManufacturingInput } from "./manufacturing";

const MOVE_MS_PER_CELL = 430;
const MIN_MOVE_MS = 450;
const WORK_MS = 9000;
const DROP_MS = 800;
const TERMINAL_JOB_RETENTION_MS = 5_000;

const ACTIVITY_BY_STATE: Record<PlotDetailNpc["state"], string> = {
  idle: "Idle",
  moving_to_target: "Walking to rubble",
  working: "Clearing rubble",
  carrying_to_dropoff: "Carrying item",
  dropping_off: "Dropping off item",
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
      return getObjectEdgeWorkCell(targetObject, preferredX, preferredY);
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
  return getJobs(detail).some((job) => job.kind === "HAUL_LOOSE_ITEM" && job.status === "queued");
}

function isCancelableJobStatus(status: PlotJob["status"]): boolean {
  return status === "queued" || status === "reserved" || status === "in_progress" || status === "blocked";
}

function getObjectEdgeWorkCell(object: PlotObject, fromX: number, fromY: number): { x: number; y: number } {
  const w = object.footprint_w ?? 1;
  const h = object.footprint_h ?? 1;
  const minX = object.x;
  const maxX = object.x + w - 1;
  const minY = object.y;
  const maxY = object.y + h - 1;
  const clampedX = Math.max(minX, Math.min(fromX, maxX));
  const clampedY = Math.max(minY, Math.min(fromY, maxY));

  if (fromX < minX || fromX > maxX || fromY < minY || fromY > maxY) {
    return { x: clampedX, y: clampedY };
  }

  const distLeft = fromX - minX;
  const distRight = maxX - fromX;
  const distTop = fromY - minY;
  const distBottom = maxY - fromY;
  const minDist = Math.min(distLeft, distRight, distTop, distBottom);

  if (minDist === distLeft) return { x: minX, y: clampedY };
  if (minDist === distRight) return { x: maxX, y: clampedY };
  if (minDist === distTop) return { x: clampedX, y: minY };
  return { x: clampedX, y: maxY };
}

function doesAnyPlotObjectOccupyTile(detail: PlotDetail, x: number, y: number): boolean {
  for (const plotObject of detail.plot_objects) {
    const footprintW = plotObject.footprint_w ?? 1;
    const footprintH = plotObject.footprint_h ?? 1;

    if (
      x >= plotObject.x &&
      x < plotObject.x + footprintW &&
      y >= plotObject.y &&
      y < plotObject.y + footprintH
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

  // Roaming must stay on clear ground instead of cutting through object footprints.
  if (doesAnyPlotObjectOccupyTile(detail, x, y)) {
    return false;
  }

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
    if (
      job.kind !== "HAUL_LOOSE_ITEM" ||
      job.status !== "queued" ||
      job.assigned_npc_id !== null ||
      typeof job.target_loose_item_id !== "string"
    ) {
      continue;
    }

    const looseItem = getLooseItemById(plot, job.target_loose_item_id);
    if (!looseItem) {
      continue;
    }

    const distance = manhattanDistance(npc.x, npc.y, looseItem.x, looseItem.y);
    const destinationPriority = getHaulDestinationPriority(
      job.haul_destination_mode
    );

    // Roaming should head toward the most important outstanding source first,
    // not just the nearest random loose item. This keeps workbench demand from
    // losing to less important dump-zone cleanup during search.
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
      bestTarget = { x: looseItem.x, y: looseItem.y };
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

function getStraightRoamWaypoint(
  roamPath: Array<{ x: number; y: number }>
): { x: number; y: number } | null {
  if (roamPath.length < 2) {
    return null;
  }

  let waypoint = roamPath[1];
  let directionX = waypoint.x - roamPath[0].x;
  let directionY = waypoint.y - roamPath[0].y;

  for (let index = 2; index < roamPath.length; index += 1) {
    const nextDirectionX = roamPath[index].x - roamPath[index - 1].x;
    const nextDirectionY = roamPath[index].y - roamPath[index - 1].y;

    if (nextDirectionX !== directionX || nextDirectionY !== directionY) {
      break;
    }

    waypoint = roamPath[index];
    directionX = nextDirectionX;
    directionY = nextDirectionY;
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

  const roamPath = buildGroundRoamPath(detail, npc.x, npc.y, sourceTile.x, sourceTile.y);
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
  beginMove(npc, "moving_to_target", waypoint.x, waypoint.y, nowMs, "Roaming for haul work");
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
      const target = getObjectEdgeWorkCell(rubble, npc.x, npc.y);
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

  return getObjectEdgeWorkCell(rubble, fromX, fromY);
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

function assignNextAvailableWork(plot: Plot, npc: PlotDetailNpc, nowMs: number): boolean {
  const detail = getDetail(plot);
  if (!detail) return false;

  const wasIdle = npc.state === "idle";

  if (hasQueuedScavengeJobs(detail) && assignNextScavengeJob(plot, npc, nowMs)) {
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

  // If nothing is claimable and no roam path exists, stay idle in place.
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

  // Compatibility cleanup:
  // Older Branch 2 slices could leave NPCs in a synthetic "returning" state.
  // Collapse that state immediately so existing saves stop animating home and
  // snapping back to stale authoritative coordinates.
  if (npc.state === "returning") {
    clearNpcHaulTarget(npc);
    clearNpcJobAssignment(npc);
    setNpcIdle(npc);
    syncActiveOrder(detail);
    return true;
  }

  if (typeof npc.state_ends_at_ms === "number" && nowMs < npc.state_ends_at_ms) return false;

  switch (npc.state) {
    case "idle": {
      if (hasQueuedScavengeJobs(detail) || hasQueuedHaulJobs(detail)) {
        return assignNextAvailableWork(plot, npc, nowMs);
      }
      return false;
    }

    case "moving_to_target": {
      snapNpcToMoveTarget(npc);
      const job = findAssignedJob(detail, npc);
      if (!job) {
        clearNpcJobAssignment(npc);
        clearNpcHaulTarget(npc);
        return assignNextAvailableWork(plot, npc, nowMs);
      }

      if (job.kind === "HAUL_LOOSE_ITEM") {
        beginTimedState(npc, "working", nowMs, getHaulPickupDurationMs(), "Picking up item");
        return true;
      }

      job.status = "in_progress";
      job.updated_at_ms = nowMs;
      beginTimedState(npc, "working", nowMs, WORK_MS);
      return true;
    }

    case "working": {
      const job = findAssignedJob(detail, npc);
      if (!job) {
        clearNpcJobAssignment(npc);
        clearNpcHaulTarget(npc);
        setNpcIdle(npc);
        syncActiveOrder(detail);
        return true;
      }

      if (job.kind === "HAUL_LOOSE_ITEM") {
        const pickup = pickupLooseItemForHaulJob(plot, job, npc.id);
        if (!pickup.changed || !pickup.itemId) {
          releaseAssignedHaulReservation(plot, npc, job);
          job.status = "cancelled";
          job.assigned_npc_id = null;
          job.blocked_reason = "pickup_failed";
          job.updated_at_ms = nowMs;
          clearNpcJobAssignment(npc);
          clearNpcHaulTarget(npc);
          clearNpcCarrySlots(npc);
          return assignNextAvailableWork(plot, npc, nowMs);
        }

        job.status = "in_progress";
        job.assigned_npc_id = npc.id;
        job.haul_item_id = pickup.itemId;
        job.updated_at_ms = nowMs;

        npc.carry_slots = createCarrySlotsForSingleItem(pickup.itemId);
        const dropoff = getDropoffCell(plot, npc, nowMs);
        beginMove(npc, "carrying_to_dropoff", dropoff.x, dropoff.y, nowMs, "Carrying item");
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

      // Fresh scavenger output now tries to enter the shared hauling system
      // immediately so new output and old ground items converge on the same
      // reservation/job path.
      if (tryBeginImmediateHaulForFreshScavengeOutput(plot, npc, action.itemId, nowMs)) {
        return true;
      }

      // Keep the old direct-carry fallback for the blocked edge case so this
      // slice does not change visible behavior when a shared haul job can not
      // be created or reserved yet.
      npc.carry_slots = createCarrySlotsForSingleItem(action.itemId);
      const dropoff = getDropoffCell(plot, npc, nowMs);
      beginMove(npc, "carrying_to_dropoff", dropoff.x, dropoff.y, nowMs);
      syncActiveOrder(detail);
      return true;
    }

    case "carrying_to_dropoff": {
      snapNpcToMoveTarget(npc);
      beginTimedState(npc, "dropping_off", nowMs, DROP_MS);
      return true;
    }

    case "dropping_off": {
      const job = findAssignedJob(detail, npc);
      depositCarriedItem(plot, npc, nowMs);

      if (job && job.kind === "HAUL_LOOSE_ITEM") {
        job.status = "completed";
        job.assigned_npc_id = npc.id;
        job.blocked_reason = null;
        job.updated_at_ms = nowMs;
      }

      clearNpcCarrySlots(npc);
      clearNpcHaulTarget(npc);
      clearNpcJobAssignment(npc);

      if (hasQueuedScavengeJobs(detail) || hasQueuedHaulJobs(detail)) {
        return assignNextAvailableWork(plot, npc, nowMs);
      }

      // No immediate follow-up work: stay at the last real task location.
      setNpcIdle(npc);
      syncActiveOrder(detail);
      return true;
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
