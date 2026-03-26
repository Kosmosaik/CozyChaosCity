import type { ItemId } from "./items";
import type {
  Plot,
  PlotManufacturingRecipeId,
  PlotManufacturingStationKind,
  PlotObject,
  PlotObjectItemBufferState,
} from "../net/protocol";

export type ManufacturingRecipeIngredient = {
  item_id: ItemId;
  quantity: number;
};

export type ManufacturingRecipeDefinition = {
  id: PlotManufacturingRecipeId;
  station_kind: PlotManufacturingStationKind;
  display_name: string;
  input_items: ManufacturingRecipeIngredient[];
  output_item_id: ItemId;
  output_quantity: number;
  craft_time_ms: number;
};

const MANUFACTURING_RECIPE_DEFINITIONS: Record<
  PlotManufacturingRecipeId,
  ManufacturingRecipeDefinition
> = {
  WOODEN_PALLET: {
    id: "WOODEN_PALLET",
    station_kind: "WORKBENCH",
    display_name: "Wooden Pallet",
    input_items: [{ item_id: "SCRAP_WOOD", quantity: 4 }],
    output_item_id: "WOODEN_PALLET",
    output_quantity: 1,
    craft_time_ms: 10_000,
  },
};

const STATION_ALLOWED_RECIPE_IDS: Record<
  PlotManufacturingStationKind,
  PlotManufacturingRecipeId[]
> = {
  WORKBENCH: ["WOODEN_PALLET"],
};

export type QueueManufacturingRecipeResult = {
  ok: boolean;
  reason?:
    | "plot_detail_missing"
    | "station_not_found"
    | "station_not_manufacturing"
    | "recipe_not_allowed"
    | "invalid_quantity";
  station_object_id?: string;
  recipe_id?: PlotManufacturingRecipeId;
  queued_quantity?: number;
  queue_entry_count?: number;
};

export type ClearManufacturingQueueResult = {
  ok: boolean;
  reason?:
    | "plot_detail_missing"
    | "station_not_found"
    | "station_not_manufacturing"
    | "queue_empty";
  station_object_id?: string;
  cleared_entry_count?: number;
  cleared_quantity?: number;
};

export function getManufacturingRecipeDefinition(
  recipeId: PlotManufacturingRecipeId
): ManufacturingRecipeDefinition {
  return MANUFACTURING_RECIPE_DEFINITIONS[recipeId];
}

export function getAllowedManufacturingRecipeIdsForStation(
  stationKind: PlotManufacturingStationKind
): PlotManufacturingRecipeId[] {
  return [...STATION_ALLOWED_RECIPE_IDS[stationKind]];
}

function getManufacturingStationById(
  plot: Plot,
  stationObjectId: string
): PlotObject | null {
  const detail = plot.detail;
  if (!detail) {
    return null;
  }

  return (
    detail.plot_objects.find((plotObject) => plotObject.id === stationObjectId) ?? null
  );
}

function getBufferedItemCount(
  bufferState: PlotObjectItemBufferState | null | undefined,
  itemId: ItemId
): number {
  if (!bufferState) {
    return 0;
  }

  return Math.max(0, Math.floor(bufferState.item_counts[itemId] ?? 0));
}

function getQueuedRequiredItemCountForStation(
  stationObject: PlotObject,
  itemId: ItemId
): number {
  if (!stationObject.manufacturing) {
    return 0;
  }

  let requiredQuantity = 0;

  for (const queueEntry of stationObject.manufacturing.queue) {
    const recipeDefinition = getManufacturingRecipeDefinition(queueEntry.recipe_id);
    const matchingIngredient = recipeDefinition.input_items.find(
      (ingredient) => ingredient.item_id === itemId
    );
    if (!matchingIngredient) {
      continue;
    }

    requiredQuantity += matchingIngredient.quantity * queueEntry.quantity;
  }

  return requiredQuantity;
}

function getInboundManufacturingInputQuantity(
  plot: Plot,
  stationObjectId: string,
  itemId: ItemId
): number {
  const detail = plot.detail;
  if (!detail) {
    return 0;
  }

  let inboundQuantity = 0;

  for (const job of detail.jobs ?? []) {
    if (job.kind !== "HAUL_LOOSE_ITEM") {
      continue;
    }

    if (job.haul_destination_mode !== "MANUFACTURING_INPUT") {
      continue;
    }

    if (job.haul_destination_object_id !== stationObjectId) {
      continue;
    }

    if (job.haul_item_id !== itemId) {
      continue;
    }

    if (
      job.status !== "queued" &&
      job.status !== "reserved" &&
      job.status !== "in_progress"
    ) {
      continue;
    }

    inboundQuantity += job.haul_quantity ?? 1;
  }

  return inboundQuantity;
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

export function findManufacturingInputDestinationForSingleItem(
  plot: Plot,
  itemId: ItemId,
  sourceX: number,
  sourceY: number
): { object_id: string } | null {
  const detail = plot.detail;
  if (!detail) {
    return null;
  }

  let bestStation: PlotObject | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const plotObject of detail.plot_objects) {
    if (!plotObject.manufacturing) {
      continue;
    }

    const requiredQuantity = getQueuedRequiredItemCountForStation(plotObject, itemId);
    if (requiredQuantity <= 0) {
      continue;
    }

    const bufferedQuantity = getBufferedItemCount(
      plotObject.manufacturing.input_buffer,
      itemId
    );
    const inboundQuantity = getInboundManufacturingInputQuantity(
      plot,
      plotObject.id,
      itemId
    );
    const outstandingQuantity = requiredQuantity - bufferedQuantity - inboundQuantity;

    if (outstandingQuantity <= 0) {
      continue;
    }

    const distance = getNearestObjectFootprintDistance(plotObject, sourceX, sourceY);
    if (distance < bestDistance) {
      bestStation = plotObject;
      bestDistance = distance;
    }
  }

  if (!bestStation) {
    return null;
  }

  return { object_id: bestStation.id };
}

export function tryDepositSingleItemIntoManufacturingInput(
  plot: Plot,
  stationObjectId: string,
  itemId: ItemId
): { changed: boolean; deposited: boolean } {
  const stationObject = getManufacturingStationById(plot, stationObjectId);
  if (!stationObject?.manufacturing) {
    return { changed: false, deposited: false };
  }

  const requiredQuantity = getQueuedRequiredItemCountForStation(stationObject, itemId);
  if (requiredQuantity <= 0) {
    return { changed: false, deposited: false };
  }

  const bufferedQuantity = getBufferedItemCount(
    stationObject.manufacturing.input_buffer,
    itemId
  );
  if (bufferedQuantity >= requiredQuantity) {
    return { changed: false, deposited: false };
  }

  // Input buffer stays authoritative server-side. Visual stacks will be rendered
  // from this buffered count later instead of becoming loose world items.
  stationObject.manufacturing.input_buffer.item_counts[itemId] = bufferedQuantity + 1;

  return { changed: true, deposited: true };
}

export function queueManufacturingRecipe(
  plot: Plot,
  stationObjectId: string,
  recipeId: PlotManufacturingRecipeId,
  quantity: number,
  nowMs: number
): QueueManufacturingRecipeResult {
  const detail = plot.detail;
  if (!detail) {
    return { ok: false, reason: "plot_detail_missing" };
  }

  const stationObject = getManufacturingStationById(plot, stationObjectId);
  if (!stationObject) {
    return { ok: false, reason: "station_not_found" };
  }

  if (!stationObject.manufacturing) {
    return { ok: false, reason: "station_not_manufacturing" };
  }

  const wholeQuantity = Math.floor(quantity);
  if (wholeQuantity <= 0) {
    return { ok: false, reason: "invalid_quantity" };
  }

  if (!stationObject.manufacturing.allowed_recipe_ids.includes(recipeId)) {
    return { ok: false, reason: "recipe_not_allowed" };
  }

  // Queue entries stay explicit so later slices can consume them in-order and
  // lock inputs per craft without rewriting the queue shape again.
  stationObject.manufacturing.queue.push({
    recipe_id: recipeId,
    quantity: wholeQuantity,
    requested_at_ms: nowMs,
  });

  const queuedQuantity = stationObject.manufacturing.queue.reduce(
    (total, queueEntry) => total + queueEntry.quantity,
    0
  );

  return {
    ok: true,
    station_object_id: stationObject.id,
    recipe_id: recipeId,
    queued_quantity: queuedQuantity,
    queue_entry_count: stationObject.manufacturing.queue.length,
  };
}

export function clearManufacturingQueue(
  plot: Plot,
  stationObjectId: string
): ClearManufacturingQueueResult {
  const detail = plot.detail;
  if (!detail) {
    return { ok: false, reason: "plot_detail_missing" };
  }

  const stationObject = getManufacturingStationById(plot, stationObjectId);
  if (!stationObject) {
    return { ok: false, reason: "station_not_found" };
  }

  if (!stationObject.manufacturing) {
    return { ok: false, reason: "station_not_manufacturing" };
  }

  const clearedEntryCount = stationObject.manufacturing.queue.length;
  const clearedQuantity = stationObject.manufacturing.queue.reduce(
    (total, queueEntry) => total + queueEntry.quantity,
    0
  );

  if (clearedEntryCount <= 0) {
    return { ok: false, reason: "queue_empty" };
  }

  // Queue clearing is still limited to not-yet-crafted work.
  // Active craft cancellation/material release comes in the next branch steps.
  stationObject.manufacturing.queue = [];

  return {
    ok: true,
    station_object_id: stationObject.id,
    cleared_entry_count: clearedEntryCount,
    cleared_quantity: clearedQuantity,
  };
}