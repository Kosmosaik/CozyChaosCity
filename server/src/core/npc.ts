import {
  Plot,
  PlotDetail,
  PlotDetailNpc,
  PlotNpcCarrySlot,
  PlotObject,
  PlotJob,
  PlotOrder,
  PlotOrderKind,
  PlotOrderTargetScope,
} from "../net/protocol";
import {
  extractRubbleOutputFromPlotObject,
  findLooseItemPlacementTileNear,
  getPlotObjectById,
  resolveDirectHaulDestinationForSingleItem,
  spawnLooseItemNearTile,
  tryDepositSingleItemIntoDumpZone,
} from "./world";

const MOVE_MS_PER_CELL = 310;
const MIN_MOVE_MS = 450;
const WORK_MS = 9000;
const DROP_MS = 800;

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

function updateNpcActivity(npc: PlotDetailNpc) {
  npc.current_activity = ACTIVITY_BY_STATE[npc.state];
}

function canNpcTakeOrder(npc: PlotDetailNpc, orderKind: PlotOrderKind): boolean {
  return (
    Array.isArray(npc.allowed_order_kinds) &&
    npc.allowed_order_kinds.includes(orderKind)
  );
}

function canNpcTakeScavengeJobs(npc: PlotDetailNpc): boolean {
  return (
    canNpcTakeOrder(npc, "SCAVENGING") ||
    canNpcTakeOrder(npc, "SCAVENGING_SINGLE")
  );
}

function getEligibleNpcsForOrder(
  detail: PlotDetail,
  orderKind: PlotOrderKind
): PlotDetailNpc[] {
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

  if (haulTarget.mode === "DUMP_ZONE") {
    const dumpZoneObject = getPlotObjectById(plot, haulTarget.object_id);
    if (dumpZoneObject) {
      npc.haul_target_mode = "DUMP_ZONE";
      npc.haul_target_object_id = dumpZoneObject.id;
      return getObjectEdgeWorkCell(dumpZoneObject, preferredX, preferredY);
    }
  }

  // Ground fallback stays explicit on the NPC snapshot so the later drop-off
  // step does not have to guess whether the NPC was meant to deposit or dump.
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

function createCarrySlotsForSingleItem(
  itemId: PlotNpcCarrySlot["item_id"]
): PlotNpcCarrySlot[] {
  // Branch 1A only needs one carried medium item at a time.
  // The carry-slot structure still leaves room for future two-hand or multi-slot
  // hauling without changing the DTO shape again.
  return [
    {
      slot: "LEFT_HAND",
      item_id: itemId,
      quantity: 1,
    },
  ];
}

function getFirstCarriedItemId(
  npc: PlotDetailNpc
): PlotNpcCarrySlot["item_id"] | null {
  const firstSlot = Array.isArray(npc.carry_slots) ? npc.carry_slots[0] : null;
  return firstSlot?.item_id ?? null;
}

function snapNpcToMoveTarget(npc: PlotDetailNpc) {
  if (typeof npc.move_to_x === "number") npc.x = npc.move_to_x;
  if (typeof npc.move_to_y === "number") npc.y = npc.move_to_y;
  clearMovementFields(npc);
}

function beginTimedState(
  npc: PlotDetailNpc,
  state: PlotDetailNpc["state"],
  nowMs: number,
  durationMs: number
) {
  npc.state = state;
  npc.state_started_at_ms = nowMs;
  npc.state_ends_at_ms = nowMs + durationMs;
  updateNpcActivity(npc);
}

function beginMove(
  npc: PlotDetailNpc,
  state: "moving_to_target" | "carrying_to_dropoff" | "returning",
  targetX: number,
  targetY: number,
  nowMs: number
) {
  const dist = manhattanDistance(npc.x, npc.y, targetX, targetY);
  const durationMs = Math.max(MIN_MOVE_MS, dist * MOVE_MS_PER_CELL);

  npc.move_to_x = targetX;
  npc.move_to_y = targetY;
  beginTimedState(npc, state, nowMs, durationMs);
}

function makeJobId(objectId: string): string {
  return `job_scavenge_${objectId}`;
}

function syncActiveOrder(detail: PlotDetail) {
  const jobs = getJobs(detail);
  const activeJobs = jobs.filter(
    (job) =>
      job.status === "queued" ||
      job.status === "reserved" ||
      job.status === "in_progress" ||
      job.status === "blocked"
  );

  if (activeJobs.length === 0) {
    detail.active_order = null;
    return;
  }

  const oldest = activeJobs.reduce((best, job) =>
    job.created_at_ms < best.created_at_ms ? job : best
  );

  const order: PlotOrder = {
    kind: oldest.source_order_kind ?? DEFAULT_SCAVENGE_ORDER_KIND,
    target_scope: oldest.source_target_scope ?? DEFAULT_SCAVENGE_TARGET_SCOPE,
    issued_at_ms: oldest.created_at_ms,
  };

  detail.active_order = order;
}

function hasActiveScavengeJobs(detail: PlotDetail): boolean {
  const jobs = getJobs(detail);
  return jobs.some((job) =>
    job.kind === "SCAVENGE_RUBBLE" &&
    (
      job.status === "queued" ||
      job.status === "reserved" ||
      job.status === "in_progress"
    )
  );
}

function isCancelableJobStatus(status: PlotJob["status"]): boolean {
  return (
    status === "queued" ||
    status === "reserved" ||
    status === "in_progress" ||
    status === "blocked"
  );
}

function getObjectEdgeWorkCell(
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

  // Clamp the approach point to the object's footprint first.
  // This gives us the closest point on or inside the rectangle.
  const clampedX = Math.max(minX, Math.min(fromX, maxX));
  const clampedY = Math.max(minY, Math.min(fromY, maxY));

  // If the NPC approaches from outside the footprint, the clamped point will
  // already land on the nearest edge cell, which is what we want.
  if (fromX < minX || fromX > maxX || fromY < minY || fromY > maxY) {
    return {
      x: clampedX,
      y: clampedY,
    };
  }

  // If the source point is already inside the footprint, pick the nearest edge
  // explicitly so we never send the NPC to the center.
  const distLeft = fromX - minX;
  const distRight = maxX - fromX;
  const distTop = fromY - minY;
  const distBottom = maxY - fromY;

  const minDist = Math.min(distLeft, distRight, distTop, distBottom);

  if (minDist === distLeft) {
    return { x: minX, y: clampedY };
  }
  if (minDist === distRight) {
    return { x: maxX, y: clampedY };
  }
  if (minDist === distTop) {
    return { x: clampedX, y: minY };
  }

  return { x: clampedX, y: maxY };
}

function createScavengeJob(
  rubble: PlotObject,
  nowMs: number,
  orderKind: PlotOrderKind,
  targetScope: PlotOrderTargetScope
): PlotJob {
  return {
    id: makeJobId(rubble.id),
    kind: "SCAVENGE_RUBBLE",
    source_order_kind: orderKind,
    source_target_scope: targetScope,
    target_object_id: rubble.id,
    status: "queued",
    assigned_npc_id: null,
    created_at_ms: nowMs,
    updated_at_ms: nowMs,
  };
}

function ensureScavengeJobsForAll(
  plot: Plot,
  nowMs: number,
  orderKind: PlotOrderKind,
  targetScope: PlotOrderTargetScope
): number {
  const detail = getDetail(plot);
  if (!detail) return 0;

  const jobs = getJobs(detail);
  const rubbleObjects = getRubbleObjects(plot);
  let created = 0;

  for (const rubble of rubbleObjects) {
    const jobId = makeJobId(rubble.id);
    const existing = jobs.find(
      (job) =>
        job.id === jobId &&
        job.status !== "completed" &&
        job.status !== "cancelled"
    );

    if (existing) {
      continue;
    }

    jobs.push(createScavengeJob(rubble, nowMs, orderKind, targetScope));
    created += 1;
  }

  syncActiveOrder(detail);
  return created;
}

function ensureScavengeJobForSingle(
  plot: Plot,
  nowMs: number,
  orderKind: PlotOrderKind,
  targetScope: PlotOrderTargetScope
): number {
  const detail = getDetail(plot);
  if (!detail) return 0;

  const jobs = getJobs(detail);
  const rubbleObjects = getRubbleObjects(plot);
  const eligibleNpcs = getEligibleNpcsForOrder(detail, orderKind);

  if (eligibleNpcs.length === 0 || rubbleObjects.length === 0) {
    return 0;
  }

  let bestRubble: PlotObject | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const rubble of rubbleObjects) {
    const jobId = makeJobId(rubble.id);
    const existing = jobs.find(
      (job) =>
        job.id === jobId &&
        job.status !== "completed" &&
        job.status !== "cancelled"
    );
    if (existing) {
      continue;
    }

    let nearestNpcDistance = Number.POSITIVE_INFINITY;
    for (const npc of eligibleNpcs) {
      const target = getObjectEdgeWorkCell(rubble, npc.x, npc.y);
      const dist = manhattanDistance(npc.x, npc.y, target.x, target.y);
      if (dist < nearestNpcDistance) {
        nearestNpcDistance = dist;
      }
    }

    if (
      bestRubble === null ||
      nearestNpcDistance < bestDistance ||
      (
        nearestNpcDistance === bestDistance &&
        rubble.id.localeCompare(bestRubble.id) < 0
      )
    ) {
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

function findJobTargetCell(
  plot: Plot,
  job: PlotJob,
  fromX: number,
  fromY: number
): { x: number; y: number } | null {
  const detail = getDetail(plot);
  if (!detail) return null;

  const rubble = detail.plot_objects.find(
    (obj) => obj.kind === "RUBBLE_4X4" && obj.id === job.target_object_id
  );
  if (!rubble) return null;

  return getObjectEdgeWorkCell(rubble, fromX, fromY);
}

function assignNextJob(plot: Plot, npc: PlotDetailNpc, nowMs: number): boolean {
  const detail = getDetail(plot);
  if (!detail) return false;

  const jobs = getJobs(detail);

  if (!canNpcTakeScavengeJobs(npc)) {
    npc.assigned_order = null;
    npc.target_object_id = null;

    if (npc.x === npc.home_x && npc.y === npc.home_y) {
      npc.state = "idle";
      npc.state_started_at_ms = null;
      npc.state_ends_at_ms = null;
      clearMovementFields(npc);
      updateNpcActivity(npc);
      return true;
    }

    beginMove(npc, "returning", npc.home_x, npc.home_y, nowMs);
    return true;
  }

  const queuedJobs = jobs.filter(
    (job) => job.status === "queued" && job.assigned_npc_id === null
  );

  let nextJob: PlotJob | null = null;
  let nextJobDistance = Number.POSITIVE_INFINITY;

  for (const candidateJob of queuedJobs) {
    const target = findJobTargetCell(plot, candidateJob, npc.x, npc.y);
    if (!target) {
      continue;
    }

    const dist = manhattanDistance(npc.x, npc.y, target.x, target.y);

    if (
      nextJob === null ||
      dist < nextJobDistance ||
      (dist === nextJobDistance && candidateJob.created_at_ms < nextJob.created_at_ms)
    ) {
      nextJob = candidateJob;
      nextJobDistance = dist;
    }
  }

  if (!nextJob) {
    syncActiveOrder(detail);

    npc.assigned_order = null;
    npc.target_object_id = null;

    if (npc.x === npc.home_x && npc.y === npc.home_y) {
      npc.state = "idle";
      npc.state_started_at_ms = null;
      npc.state_ends_at_ms = null;
      clearMovementFields(npc);
      updateNpcActivity(npc);
      return true;
    }

    beginMove(npc, "returning", npc.home_x, npc.home_y, nowMs);
    return true;
  }

  const target = findJobTargetCell(plot, nextJob, npc.x, npc.y);
  if (!target) {
    nextJob.status = "cancelled";
    nextJob.updated_at_ms = nowMs;
    nextJob.assigned_npc_id = null;
    syncActiveOrder(detail);
    return assignNextJob(plot, npc, nowMs);
  }

  nextJob.status = "reserved";
  nextJob.assigned_npc_id = npc.id;
  nextJob.updated_at_ms = nowMs;

  npc.assigned_order = nextJob.source_order_kind;
  npc.target_object_id = nextJob.target_object_id;
  clearNpcCarrySlots(npc);
  clearNpcHaulTarget(npc);

  beginMove(npc, "moving_to_target", target.x, target.y, nowMs);
  syncActiveOrder(detail);
  return true;
}

function findAssignedJob(detail: PlotDetail, npc: PlotDetailNpc): PlotJob | null {
  const jobs = getJobs(detail);
  return (
    jobs.find(
      (job) =>
        job.assigned_npc_id === npc.id &&
        job.target_object_id === npc.target_object_id &&
        (job.status === "reserved" || job.status === "in_progress")
    ) ?? null
  );
}

export function cancelActivePlotOrder(
  plot: Plot,
  nowMs: number
): {
  ok: boolean;
  reason?: string;
  cancelled_order_kind?: PlotOrderKind;
  cancelled_target_scope?: PlotOrderTargetScope;
} {
  const detail = getDetail(plot);
  if (!detail) {
    return { ok: false, reason: "plot_detail_missing" };
  }

  const activeOrder = detail.active_order;
  if (!activeOrder) {
    return { ok: false, reason: "no_active_order" };
  }

  const jobs = getJobs(detail);
  const cancelledTargetIds = new Set<string>();
  let cancelledAny = false;

  const remainingJobs: PlotJob[] = [];

  for (const job of jobs) {
    const matchesActiveOrder =
      job.source_order_kind === activeOrder.kind &&
      job.source_target_scope === activeOrder.target_scope;

    if (matchesActiveOrder && isCancelableJobStatus(job.status)) {
      cancelledAny = true;
      cancelledTargetIds.add(job.target_object_id);
      continue; // REMOVE job
    }

    remainingJobs.push(job);
  }

  // Replace jobs array in-place (important for references)
  jobs.length = 0;
  for (const job of remainingJobs) {
    jobs.push(job);
  }

  for (const npc of detail.npcs ?? []) {
    const job = findAssignedJob(detail, npc);

    const isAssignedToActiveOrder =
      job &&
      job.source_order_kind === activeOrder.kind &&
      job.source_target_scope === activeOrder.target_scope;

    const isAssignedToCancelledTarget =
      typeof npc.target_object_id === "string" &&
      cancelledTargetIds.has(npc.target_object_id);

    if (!isAssignedToActiveOrder && !isAssignedToCancelledTarget) {
      continue;
    }

    // Fully reset NPC assignment
    npc.assigned_order = null;
    npc.target_object_id = null;
    clearNpcCarrySlots(npc);
    clearNpcHaulTarget(npc);

    // Always safely transition NPC state
    if (npc.x === npc.home_x && npc.y === npc.home_y) {
      npc.state = "idle";
      npc.state_started_at_ms = null;
      npc.state_ends_at_ms = null;
      clearMovementFields(npc);
      updateNpcActivity(npc);
    } else {
      beginMove(npc, "returning", npc.home_x, npc.home_y, nowMs);
    }
  }

  syncActiveOrder(detail);

  return {
    ok: cancelledAny,
    reason: cancelledAny ? undefined : "no_active_order",
    cancelled_order_kind: activeOrder.kind,
    cancelled_target_scope: activeOrder.target_scope,
  };
}

export function issueScavengingOrder(
  plot: Plot,
  nowMs: number,
  orderKind: PlotOrderKind = "SCAVENGING",
  targetScope: PlotOrderTargetScope = "ALL"
): { ok: boolean; reason?: string } {
  const detail = getDetail(plot);
  if (!detail) {
    return { ok: false, reason: "plot_detail_missing" };
  }

  const isAllOrder =
    orderKind === "SCAVENGING" &&
    targetScope === "ALL";

  const isSingleOrder =
    orderKind === "SCAVENGING_SINGLE" &&
    targetScope === "SINGLE";

  if (!isAllOrder && !isSingleOrder) {
    return { ok: false, reason: "invalid_order" };
  }

  if (getEligibleNpcsForOrder(detail, orderKind).length === 0) {
    return { ok: false, reason: "no_eligible_npc" };
  }

  if (getRubbleObjects(plot).length === 0) {
    return { ok: false, reason: "nothing_to_scavenge" };
  }

  if (hasActiveScavengeJobs(detail)) {
    return { ok: false, reason: "order_already_active" };
  }

  const created = isSingleOrder
    ? ensureScavengeJobForSingle(plot, nowMs, orderKind, targetScope)
    : ensureScavengeJobsForAll(plot, nowMs, orderKind, targetScope);

  if (created === 0) {
    return { ok: false, reason: "nothing_to_scavenge" };
  }

  for (const npc of detail.npcs ?? []) {
    if (npc.state === "idle" && canNpcTakeScavengeJobs(npc)) {
      assignNextJob(plot, npc, nowMs);
    }
  }

  syncActiveOrder(detail);
  return { ok: true };
}

function tickNpc(plot: Plot, npc: PlotDetailNpc, nowMs: number): boolean {
  const detail = getDetail(plot);
  if (!detail) return false;

  if (typeof npc.state_ends_at_ms === "number" && nowMs < npc.state_ends_at_ms) {
    return false;
  }

  switch (npc.state) {
    case "idle": {
      if ((detail.jobs ?? []).some((job) => job.status === "queued")) {
        return assignNextJob(plot, npc, nowMs);
      }
      return false;
    }

    case "moving_to_target": {
      snapNpcToMoveTarget(npc);

      const job = findAssignedJob(detail, npc);
      if (job) {
        job.status = "in_progress";
        job.updated_at_ms = nowMs;
      }

      beginTimedState(npc, "working", nowMs, WORK_MS);
      return true;
    }

    case "working": {
      const job = findAssignedJob(detail, npc);

      if (!npc.target_object_id || !job) {
        npc.state = "idle";
        npc.state_started_at_ms = null;
        npc.state_ends_at_ms = null;
        npc.target_object_id = null;
        npc.assigned_order = null;
        clearNpcHaulTarget(npc);
        updateNpcActivity(npc);
        syncActiveOrder(detail);
        return true;
      }

      const action = extractRubbleOutputFromPlotObject(plot, npc.target_object_id);

      if (!action.changed || !action.itemId) {
        job.status = "cancelled";
        job.assigned_npc_id = null;
        job.updated_at_ms = nowMs;
        npc.state = "idle";
        npc.state_started_at_ms = null;
        npc.state_ends_at_ms = null;
        npc.target_object_id = null;
        npc.assigned_order = null;
        clearNpcHaulTarget(npc);
        updateNpcActivity(npc);
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

      // The found item now exists in the NPC's hands first. This branch adds
      // the first real direct-haul decision on top of that carry state:
      // nearby dump zone if valid, otherwise explicit ground fallback.
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
      const carriedItemId = getFirstCarriedItemId(npc);
      if (carriedItemId) {
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

          // Full or blocked dump zones must safely fall back to a nearby ground
          // drop instead of deleting items or leaving the NPC stuck carrying.
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
        } else {
          spawnLooseItemNearTile(
            plot,
            carriedItemId,
            npc.x,
            npc.y,
            nowMs,
            npc.target_object_id ?? null
          );
        }
      }

      clearNpcCarrySlots(npc);
      clearNpcHaulTarget(npc);
      npc.target_object_id = null;

      if ((detail.jobs ?? []).some((job) => job.status === "queued")) {
        return assignNextJob(plot, npc, nowMs);
      }

      beginMove(npc, "returning", npc.home_x, npc.home_y, nowMs);
      syncActiveOrder(detail);
      return true;
    }

    case "returning": {
      npc.state = "idle";
      npc.state_started_at_ms = null;
      npc.state_ends_at_ms = null;
      clearNpcHaulTarget(npc);
      updateNpcActivity(npc);
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

    for (const npc of plot.detail.npcs) {
      if (tickNpc(plot, npc, nowMs)) {
        changed = true;
      }
    }

    if (changed) {
      changedPlots.push(plot);
    }
  }

  return changedPlots;
}