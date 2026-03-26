import { Plot, PlotDetail, PlotDetailNpc, PlotJob, PlotLooseItem } from "../net/protocol";
import {
  getLooseItemById,
  pickupReservedLooseItemQuantity,
  releaseLooseItemReservation,
  reserveLooseItemQuantity,
  resolveDirectHaulDestinationForSingleItem,
} from "./world";

export const HAUL_JOB_SEARCH_RADIUS_TILES = 10;
const HAUL_PICKUP_MS = 800;

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

function makeLooseItemHaulJobId(looseItemId: string, unitIndex: number): string {
  return `job_haul_loose_${looseItemId}_${unitIndex}`;
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

function applyHaulDestinationMetadata(
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

  applyHaulDestinationMetadata(plot, looseItem, job, nowMs);
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

export function syncLooseItemHaulJobs(plot: Plot, nowMs: number): boolean {
  const detail = getDetail(plot);
  if (!detail) {
    return false;
  }

  const jobs = getJobs(detail);
  let changed = false;

  for (const looseItem of detail.loose_items ?? []) {
    const pendingJobs = getPendingHaulJobsForLooseItem(detail, looseItem.id);
    const desiredPendingJobCount = looseItem.quantity;

    for (const job of pendingJobs) {
      applyHaulDestinationMetadata(plot, looseItem, job, nowMs);
      job.haul_item_id = looseItem.item_id;
      job.haul_quantity = 1;
      job.updated_at_ms = nowMs;
      changed = true;
    }

    if (pendingJobs.length < desiredPendingJobCount) {
      for (let unitIndex = pendingJobs.length; unitIndex < desiredPendingJobCount; unitIndex += 1) {
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