import { Plot, PlotDetail, PlotDetailNpc, PlotJob, PlotLooseItem, PlotObject } from "../net/protocol";
import {
  getLooseItemById,
  getPlotObjectById,
  pickupReservedLooseItemQuantity,
  releaseLooseItemReservation,
  reserveLooseItemQuantity,
  resolveDirectHaulDestinationForSingleItem,
} from "./world";
import { pickupSingleManufacturingOutputItem } from "./manufacturing";

export const HAUL_JOB_SEARCH_RADIUS_TILES = 10;
const HAUL_PICKUP_MS = 750;

function getDetail(plot: Plot): PlotDetail | null {
  return plot.detail ?? null;
}

function getJobs(detail: PlotDetail): PlotJob[] {
  if (!Array.isArray(detail.jobs)) {
    detail.jobs = [];
  }

  return detail.jobs;
}

function manhattanDistance(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by);
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

function makeLooseItemHaulJobId(looseItemId: string, unitIndex: number): string {
  return `job_haul_loose_${looseItemId}_${unitIndex}`;
}

function makeManufacturingOutputHaulJobId(
  stationObjectId: string,
  itemId: string,
  unitIndex: number
): string {
  return `job_haul_output_${stationObjectId}_${itemId}_${unitIndex}`;
}

function isPendingHaulJobStatus(status: PlotJob["status"]): boolean {
  return status === "queued" || status === "reserved" || status === "blocked";
}

function getPendingHaulJobsForLooseItem(detail: PlotDetail, looseItemId: string): PlotJob[] {
  return getJobs(detail).filter(
    (job) =>
      job.kind === "HAUL_LOOSE_ITEM" &&
      job.target_loose_item_id === looseItemId &&
      isPendingHaulJobStatus(job.status)
  );
}

function getPendingManufacturingOutputHaulJobs(
  detail: PlotDetail,
  stationObjectId: string,
  itemId: string
): PlotJob[] {
  return getJobs(detail).filter(
    (job) =>
      job.kind === "HAUL_MANUFACTURING_OUTPUT" &&
      job.target_object_id === stationObjectId &&
      job.haul_item_id === itemId &&
      isPendingHaulJobStatus(job.status)
  );
}

function applyLooseItemHaulDestinationMetadata(
  plot: Plot,
  looseItem: PlotLooseItem,
  job: PlotJob,
  nowMs: number
): void {
  const destination = resolveDirectHaulDestinationForSingleItem(
    plot,
    looseItem.item_id,
    looseItem.x,
    looseItem.y,
    nowMs
  );

  if (
    destination.mode === "DUMP_ZONE" ||
    destination.mode === "MANUFACTURING_INPUT"
  ) {
    if (job.assigned_npc_id === null) {
      job.status = "queued";
    }

    job.haul_destination_mode = destination.mode;
    job.haul_destination_object_id = destination.object_id;
    job.blocked_reason = null;
    return;
  }

  if (job.assigned_npc_id === null) {
    job.status = "blocked";
  }

  job.haul_destination_mode = null;
  job.haul_destination_object_id = null;
  job.blocked_reason = "no_valid_destination";
}

function applyManufacturingOutputHaulDestinationMetadata(
  plot: Plot,
  stationObject: PlotObject,
  itemId: PlotLooseItem["item_id"],
  job: PlotJob,
  nowMs: number
): void {
  const destination = resolveDirectHaulDestinationForSingleItem(
    plot,
    itemId,
    stationObject.x,
    stationObject.y,
    nowMs
  );

  if (
    destination.mode === "DUMP_ZONE" ||
    destination.mode === "MANUFACTURING_INPUT"
  ) {
    if (job.assigned_npc_id === null) {
      job.status = "queued";
    }

    job.haul_destination_mode = destination.mode;
    job.haul_destination_object_id = destination.object_id;
    job.blocked_reason = null;
    return;
  }

  if (job.assigned_npc_id === null) {
    job.status = "blocked";
  }

  job.haul_destination_mode = null;
  job.haul_destination_object_id = null;
  job.blocked_reason = "no_valid_destination";
}

function makeStationItemKey(
  stationObjectId: string,
  itemId: PlotLooseItem["item_id"]
): string {
  return `${stationObjectId}::${itemId}`;
}

function retargetPendingLooseItemHaulJobs(plot: Plot, nowMs: number): boolean {
  const detail = getDetail(plot);
  if (!detail) {
    return false;
  }

  const plannedInboundByStationItemKey = new Map<string, number>();

  const pendingEntries = getJobs(detail)
    .filter(
      (job) =>
        job.kind === "HAUL_LOOSE_ITEM" &&
        isPendingHaulJobStatus(job.status) &&
        typeof job.target_loose_item_id === "string"
    )
    .map((job) => {
      const looseItem = getLooseItemById(plot, job.target_loose_item_id as string);
      return looseItem ? { job, looseItem } : null;
    })
    .filter(
      (entry): entry is { job: PlotJob; looseItem: PlotLooseItem } => entry !== null
    )
    .sort((left, right) => left.job.created_at_ms - right.job.created_at_ms);

  let changed = false;

  for (const entry of pendingEntries) {
    const previousStatus = entry.job.status;
    const previousDestinationMode = entry.job.haul_destination_mode;
    const previousDestinationObjectId = entry.job.haul_destination_object_id;
    const previousBlockedReason = entry.job.blocked_reason;

    const destination = resolveDirectHaulDestinationForSingleItem(
      plot,
      entry.looseItem.item_id,
      entry.looseItem.x,
      entry.looseItem.y,
      nowMs,
      {
        include_pending_manufacturing_jobs: false,
        planned_inbound_by_station_item_key: plannedInboundByStationItemKey,
      }
    );

    if (
      destination.mode === "DUMP_ZONE" ||
      destination.mode === "MANUFACTURING_INPUT"
    ) {
      if (entry.job.assigned_npc_id === null && entry.job.status === "blocked") {
        entry.job.status = "queued";
      }

      entry.job.haul_destination_mode = destination.mode;
      entry.job.haul_destination_object_id = destination.object_id;
      entry.job.blocked_reason = null;

      if (destination.mode === "MANUFACTURING_INPUT") {
        const stationItemKey = makeStationItemKey(
          destination.object_id,
          entry.looseItem.item_id
        );

        plannedInboundByStationItemKey.set(
          stationItemKey,
          (plannedInboundByStationItemKey.get(stationItemKey) ?? 0) +
            (entry.job.haul_quantity ?? 1)
        );
      }
    } else {
      if (entry.job.assigned_npc_id === null) {
        entry.job.status = "blocked";
      }

      entry.job.haul_destination_mode = null;
      entry.job.haul_destination_object_id = null;
      entry.job.blocked_reason = "no_valid_destination";
    }

    entry.job.haul_item_id = entry.looseItem.item_id;
    entry.job.haul_quantity = 1;
    entry.job.updated_at_ms = nowMs;

    if (
      entry.job.status !== previousStatus ||
      entry.job.haul_destination_mode !== previousDestinationMode ||
      entry.job.haul_destination_object_id !== previousDestinationObjectId ||
      entry.job.blocked_reason !== previousBlockedReason
    ) {
      changed = true;
    }
  }

  return changed;
}

function createLooseItemHaulJob(
  plot: Plot,
  looseItem: PlotLooseItem,
  unitIndex: number,
  nowMs: number
): PlotJob {
  const job: PlotJob = {
    id: makeLooseItemHaulJobId(looseItem.id, unitIndex),
    kind: "HAUL_LOOSE_ITEM",
    source_order_kind: null,
    source_target_scope: null,
    target_object_id: null,
    target_loose_item_id: looseItem.id,
    haul_item_id: looseItem.item_id,
    haul_quantity: 1,
    haul_destination_mode: null,
    haul_destination_object_id: null,
    blocked_reason: null,
    status: "queued",
    assigned_npc_id: null,
    created_at_ms: nowMs,
    updated_at_ms: nowMs,
  };

  applyLooseItemHaulDestinationMetadata(plot, looseItem, job, nowMs);
  return job;
}

function createManufacturingOutputHaulJob(
  plot: Plot,
  stationObject: PlotObject,
  itemId: PlotLooseItem["item_id"],
  unitIndex: number,
  nowMs: number
): PlotJob {
  const job: PlotJob = {
    id: makeManufacturingOutputHaulJobId(stationObject.id, itemId, unitIndex),
    kind: "HAUL_MANUFACTURING_OUTPUT",
    source_order_kind: null,
    source_target_scope: null,
    target_object_id: stationObject.id,
    target_loose_item_id: null,
    haul_item_id: itemId,
    haul_quantity: 1,
    haul_destination_mode: null,
    haul_destination_object_id: null,
    blocked_reason: null,
    status: "queued",
    assigned_npc_id: null,
    created_at_ms: nowMs,
    updated_at_ms: nowMs,
  };

  applyManufacturingOutputHaulDestinationMetadata(
    plot,
    stationObject,
    itemId,
    job,
    nowMs
  );
  return job;
}

function chooseSpecificLooseItemHaulJob(
  plot: Plot,
  npc: PlotDetailNpc,
  looseItemId: string
): { job: PlotJob; looseItem: PlotLooseItem } | null {
  const detail = getDetail(plot);
  if (!detail) {
    return null;
  }

  const looseItem = getLooseItemById(plot, looseItemId);
  if (!looseItem) {
    return null;
  }

  const distance = manhattanDistance(npc.x, npc.y, looseItem.x, looseItem.y);
  if (distance > HAUL_JOB_SEARCH_RADIUS_TILES) {
    return null;
  }

  const job = getJobs(detail).find(
    (candidateJob) =>
      candidateJob.kind === "HAUL_LOOSE_ITEM" &&
      candidateJob.status === "queued" &&
      candidateJob.assigned_npc_id === null &&
      candidateJob.target_loose_item_id === looseItemId
  );
  if (!job) {
    return null;
  }

  return { job, looseItem };
}

function reserveLooseItemHaulJobForNpc(
  plot: Plot,
  npc: PlotDetailNpc,
  match: { job: PlotJob; looseItem: PlotLooseItem },
  nowMs: number
): { ok: boolean; job: PlotJob | null; looseItem: PlotLooseItem | null } {
  const haulQuantity = match.job.haul_quantity ?? 1;
  const reserved = reserveLooseItemQuantity(
    plot,
    match.looseItem.id,
    npc.id,
    haulQuantity,
    nowMs
  );

  if (!reserved) {
    match.job.status = "cancelled";
    match.job.blocked_reason = "reservation_failed";
    match.job.updated_at_ms = nowMs;
    return { ok: false, job: null, looseItem: null };
  }

  match.job.status = "reserved";
  match.job.assigned_npc_id = npc.id;
  match.job.updated_at_ms = nowMs;
  match.job.blocked_reason = null;

  return { ok: true, job: match.job, looseItem: match.looseItem };
}

export function getHaulDestinationPriority(
  destinationMode: PlotJob["haul_destination_mode"] | null | undefined
): number {
  switch (destinationMode) {
    case "MANUFACTURING_INPUT":
      return 0;
    case "DUMP_ZONE":
      return 1;
    default:
      return 2;
  }
}

function chooseBestLooseItemHaulJob(
  plot: Plot,
  npc: PlotDetailNpc
): { job: PlotJob; looseItem: PlotLooseItem } | null {
  const detail = getDetail(plot);
  if (!detail) {
    return null;
  }

  let bestMatch: { job: PlotJob; looseItem: PlotLooseItem } | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestPriority = Number.POSITIVE_INFINITY;

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
    if (distance > HAUL_JOB_SEARCH_RADIUS_TILES) {
      continue;
    }

    const destinationPriority = getHaulDestinationPriority(job.haul_destination_mode);

    if (
      bestMatch === null ||
      destinationPriority < bestPriority ||
      (destinationPriority === bestPriority && distance < bestDistance) ||
      (
        destinationPriority === bestPriority &&
        distance === bestDistance &&
        job.created_at_ms < bestMatch.job.created_at_ms
      )
    ) {
      bestMatch = { job, looseItem };
      bestDistance = distance;
      bestPriority = destinationPriority;
    }
  }

  return bestMatch;
}

function chooseBestManufacturingOutputHaulJob(
  plot: Plot,
  npc: PlotDetailNpc
): { job: PlotJob; stationObject: PlotObject } | null {
  const detail = getDetail(plot);
  if (!detail) {
    return null;
  }

  let bestMatch: { job: PlotJob; stationObject: PlotObject } | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const job of getJobs(detail)) {
    if (
      job.kind !== "HAUL_MANUFACTURING_OUTPUT" ||
      job.status !== "queued" ||
      job.assigned_npc_id !== null ||
      typeof job.target_object_id !== "string"
    ) {
      continue;
    }

    const stationObject = getPlotObjectById(plot, job.target_object_id);
    if (!stationObject?.manufacturing) {
      continue;
    }

    const itemId = job.haul_item_id;
    if (!itemId) {
      continue;
    }

    const bufferedQuantity = Math.max(
      0,
      Math.floor(stationObject.manufacturing.output_buffer.item_counts[itemId] ?? 0)
    );
    if (bufferedQuantity <= 0) {
      continue;
    }

    const distance = getNearestObjectFootprintDistance(stationObject, npc.x, npc.y);
    if (distance > HAUL_JOB_SEARCH_RADIUS_TILES) {
      continue;
    }

    if (
      bestMatch === null ||
      distance < bestDistance ||
      (distance === bestDistance && job.created_at_ms < bestMatch.job.created_at_ms)
    ) {
      bestMatch = { job, stationObject };
      bestDistance = distance;
    }
  }

  return bestMatch;
}

function syncGroundLooseItemHaulJobs(plot: Plot, nowMs: number): boolean {
  const detail = getDetail(plot);
  if (!detail) {
    return false;
  }

  const jobs = getJobs(detail);
  let changed = false;

  for (const looseItem of detail.loose_items ?? []) {
    const pendingJobs = getPendingHaulJobsForLooseItem(detail, looseItem.id);
    const desiredPendingJobCount = looseItem.quantity;

    if (pendingJobs.length < desiredPendingJobCount) {
      for (
        let unitIndex = pendingJobs.length;
        unitIndex < desiredPendingJobCount;
        unitIndex += 1
      ) {
        jobs.push(createLooseItemHaulJob(plot, looseItem, unitIndex + 1, nowMs));
        changed = true;
      }
    }

    if (pendingJobs.length > desiredPendingJobCount) {
      let overflow = pendingJobs.length - desiredPendingJobCount;

      for (const job of pendingJobs) {
        if (overflow <= 0) {
          break;
        }

        if (job.assigned_npc_id !== null || job.status === "reserved") {
          continue;
        }

        job.status = "cancelled";
        job.blocked_reason = "source_quantity_reduced";
        job.updated_at_ms = nowMs;
        overflow -= 1;
        changed = true;
      }
    }
  }

  for (const job of jobs) {
    if (
      job.kind !== "HAUL_LOOSE_ITEM" ||
      !isPendingHaulJobStatus(job.status) ||
      typeof job.target_loose_item_id !== "string"
    ) {
      continue;
    }

    if (getLooseItemById(plot, job.target_loose_item_id)) {
      continue;
    }

    if (job.assigned_npc_id !== null) {
      continue;
    }

    job.status = "cancelled";
    job.blocked_reason = "source_missing";
    job.updated_at_ms = nowMs;
    changed = true;
  }

  // Retarget after counts are synced so manufacturing demand is allocated once, deterministically.
  if (retargetPendingLooseItemHaulJobs(plot, nowMs)) {
    changed = true;
  }

  return changed;
}

function syncManufacturingOutputHaulJobs(plot: Plot, nowMs: number): boolean {
  const detail = getDetail(plot);
  if (!detail) {
    return false;
  }

  const jobs = getJobs(detail);
  let changed = false;

  for (const plotObject of detail.plot_objects) {
    if (!plotObject.manufacturing) {
      continue;
    }

    const outputItemIds = new Set<string>([
      ...Object.keys(plotObject.manufacturing.output_buffer.item_counts ?? {}),
      ...jobs
        .filter(
          (job) =>
            job.kind === "HAUL_MANUFACTURING_OUTPUT" &&
            job.target_object_id === plotObject.id &&
            typeof job.haul_item_id === "string"
        )
        .map((job) => String(job.haul_item_id)),
    ]);

    for (const itemIdValue of outputItemIds) {
      const itemId = itemIdValue as PlotLooseItem["item_id"];
      const bufferedQuantity = Math.max(
        0,
        Math.floor(plotObject.manufacturing.output_buffer.item_counts[itemId] ?? 0)
      );
      const pendingJobs = getPendingManufacturingOutputHaulJobs(
        detail,
        plotObject.id,
        itemId
      );

      for (const job of pendingJobs) {
        applyManufacturingOutputHaulDestinationMetadata(
          plot,
          plotObject,
          itemId,
          job,
          nowMs
        );
        job.haul_item_id = itemId;
        job.haul_quantity = 1;
        job.updated_at_ms = nowMs;
        changed = true;
      }

      if (pendingJobs.length < bufferedQuantity) {
        for (
          let unitIndex = pendingJobs.length;
          unitIndex < bufferedQuantity;
          unitIndex += 1
        ) {
          jobs.push(
            createManufacturingOutputHaulJob(
              plot,
              plotObject,
              itemId,
              unitIndex + 1,
              nowMs
            )
          );
          changed = true;
        }
      }

      if (pendingJobs.length > bufferedQuantity) {
        let overflow = pendingJobs.length - bufferedQuantity;
        for (const job of pendingJobs) {
          if (overflow <= 0) {
            break;
          }

          if (job.assigned_npc_id !== null || job.status === "reserved") {
            continue;
          }

          job.status = "cancelled";
          job.blocked_reason = "source_quantity_reduced";
          job.updated_at_ms = nowMs;
          overflow -= 1;
          changed = true;
        }
      }
    }
  }

  for (const job of jobs) {
    if (
      job.kind !== "HAUL_MANUFACTURING_OUTPUT" ||
      !isPendingHaulJobStatus(job.status) ||
      typeof job.target_object_id !== "string"
    ) {
      continue;
    }

    const stationObject = getPlotObjectById(plot, job.target_object_id);
    if (!stationObject?.manufacturing || !job.haul_item_id) {
      if (job.assigned_npc_id === null) {
        job.status = "cancelled";
        job.blocked_reason = "source_missing";
        job.updated_at_ms = nowMs;
        changed = true;
      }
      continue;
    }

    const bufferedQuantity = Math.max(
      0,
      Math.floor(stationObject.manufacturing.output_buffer.item_counts[job.haul_item_id] ?? 0)
    );
    if (bufferedQuantity > 0) {
      continue;
    }

    if (job.assigned_npc_id !== null) {
      continue;
    }

    job.status = "cancelled";
    job.blocked_reason = "source_missing";
    job.updated_at_ms = nowMs;
    changed = true;
  }

  return changed;
}

export function syncLooseItemHaulJobs(plot: Plot, nowMs: number): boolean {
  let changed = false;

  if (syncGroundLooseItemHaulJobs(plot, nowMs)) {
    changed = true;
  }

  if (syncManufacturingOutputHaulJobs(plot, nowMs)) {
    changed = true;
  }

  return changed;
}

export function assignNextLooseItemHaulJob(
  plot: Plot,
  npc: PlotDetailNpc,
  nowMs: number
): { ok: boolean; job: PlotJob | null; looseItem: PlotLooseItem | null } {
  const bestMatch = chooseBestLooseItemHaulJob(plot, npc);
  if (!bestMatch) {
    return { ok: false, job: null, looseItem: null };
  }

  return reserveLooseItemHaulJobForNpc(plot, npc, bestMatch, nowMs);
}

export function assignNextManufacturingOutputHaulJob(
  plot: Plot,
  npc: PlotDetailNpc,
  nowMs: number
): { ok: boolean; job: PlotJob | null; stationObject: PlotObject | null } {
  const bestMatch = chooseBestManufacturingOutputHaulJob(plot, npc);
  if (!bestMatch) {
    return { ok: false, job: null, stationObject: null };
  }

  bestMatch.job.status = "reserved";
  bestMatch.job.assigned_npc_id = npc.id;
  bestMatch.job.updated_at_ms = nowMs;
  bestMatch.job.blocked_reason = null;

  return { ok: true, job: bestMatch.job, stationObject: bestMatch.stationObject };
}

export function assignSpecificLooseItemHaulJob(
  plot: Plot,
  npc: PlotDetailNpc,
  looseItemId: string,
  nowMs: number
): { ok: boolean; job: PlotJob | null; looseItem: PlotLooseItem | null } {
  const match = chooseSpecificLooseItemHaulJob(plot, npc, looseItemId);
  if (!match) {
    return { ok: false, job: null, looseItem: null };
  }

  return reserveLooseItemHaulJobForNpc(plot, npc, match, nowMs);
}

export function getHaulPickupDurationMs(): number {
  return HAUL_PICKUP_MS;
}

export function releaseLooseItemHaulReservationForJob(
  plot: Plot,
  job: PlotJob,
  npcId: string
): boolean {
  if (job.kind !== "HAUL_LOOSE_ITEM" || typeof job.target_loose_item_id !== "string") {
    return false;
  }

  return releaseLooseItemReservation(plot, job.target_loose_item_id, npcId);
}

export function pickupLooseItemForHaulJob(
  plot: Plot,
  job: PlotJob,
  npcId: string
): { changed: boolean; itemId: PlotLooseItem["item_id"] | null; quantityPicked: number } {
  if (job.kind !== "HAUL_LOOSE_ITEM" || typeof job.target_loose_item_id !== "string") {
    return { changed: false, itemId: null, quantityPicked: 0 };
  }

  return pickupReservedLooseItemQuantity(
    plot,
    job.target_loose_item_id,
    npcId,
    job.haul_quantity ?? 1
  );
}

export function pickupManufacturingOutputForHaulJob(
  plot: Plot,
  job: PlotJob
): { changed: boolean; itemId: PlotLooseItem["item_id"] | null; quantityPicked: number } {
  if (
    job.kind !== "HAUL_MANUFACTURING_OUTPUT" ||
    typeof job.target_object_id !== "string" ||
    !job.haul_item_id
  ) {
    return { changed: false, itemId: null, quantityPicked: 0 };
  }

  const pickup = pickupSingleManufacturingOutputItem(
    plot,
    job.target_object_id,
    job.haul_item_id
  );
  if (!pickup.picked_up || !pickup.item_id) {
    return { changed: pickup.changed, itemId: null, quantityPicked: 0 };
  }

  return { changed: true, itemId: pickup.item_id, quantityPicked: 1 };
}