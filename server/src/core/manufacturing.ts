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

export type ReserveManufacturingStationResult = {
  changed: boolean;
  reserved: boolean;
};

export type StartManufacturingCraftResult = {
  changed: boolean;
  started: boolean;
  recipe_id?: PlotManufacturingRecipeId;
  ends_at_ms?: number;
};

export type CompleteManufacturingCraftResult = {
  changed: boolean;
  completed: boolean;
  output_item_id?: ItemId;
  output_quantity?: number;
};

export type PickupManufacturingOutputResult = {
  changed: boolean;
  picked_up: boolean;
  item_id?: ItemId;
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

export function getManufacturingStationById(
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

function setBufferedItemCount(
  bufferState: PlotObjectItemBufferState,
  itemId: ItemId,
  quantity: number
): void {
  const normalizedQuantity = Math.max(0, Math.floor(quantity));

  if (normalizedQuantity <= 0) {
    delete bufferState.item_counts[itemId];
    return;
  }

  bufferState.item_counts[itemId] = normalizedQuantity;
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

type ManufacturingInboundQueryOptions = {
  include_pending_jobs?: boolean;
  additional_planned_quantity?: number;
};

function getInboundManufacturingInputQuantity(
  plot: Plot,
  stationObjectId: string,
  itemId: ItemId,
  options?: ManufacturingInboundQueryOptions
): number {
  const detail = plot.detail;
  if (!detail) {
    return options?.additional_planned_quantity ?? 0;
  }

  const includePendingJobs = options?.include_pending_jobs ?? true;
  let inboundQuantity = options?.additional_planned_quantity ?? 0;

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

    // In-progress jobs are already committed and must always count.
    if (job.status === "in_progress") {
      inboundQuantity += job.haul_quantity ?? 1;
      continue;
    }

    // Pending jobs are optional so the haul sync can retarget them deterministically.
    if (
      includePendingJobs &&
      (job.status === "queued" || job.status === "reserved")
    ) {
      inboundQuantity += job.haul_quantity ?? 1;
    }
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

function canStationStartNextQueuedCraft(stationObject: PlotObject): boolean {
  if (!stationObject.manufacturing) {
    return false;
  }

  const queueEntry = stationObject.manufacturing.queue[0];
  if (!queueEntry) {
    return false;
  }

  const recipeDefinition = getManufacturingRecipeDefinition(queueEntry.recipe_id);

  for (const ingredient of recipeDefinition.input_items) {
    const bufferedQuantity = getBufferedItemCount(
      stationObject.manufacturing.input_buffer,
      ingredient.item_id
    );
    if (bufferedQuantity < ingredient.quantity) {
      return false;
    }
  }

  return true;
}

export function findReadyManufacturingStationForNpc(
  plot: Plot,
  fromX: number,
  fromY: number
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

    if (plotObject.manufacturing.assigned_npc_id !== null) {
      continue;
    }

    if (plotObject.manufacturing.active_craft !== null) {
      continue;
    }

    if (!canStationStartNextQueuedCraft(plotObject)) {
      continue;
    }

    const distance = getNearestObjectFootprintDistance(plotObject, fromX, fromY);
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

export function findManufacturingStationAssignedToNpc(
  plot: Plot,
  npcId: string
): PlotObject | null {
  const detail = plot.detail;
  if (!detail) {
    return null;
  }

  return (
    detail.plot_objects.find(
      (plotObject) => plotObject.manufacturing?.assigned_npc_id === npcId
    ) ?? null
  );
}

export function findActiveManufacturingCraftByNpc(
  plot: Plot,
  npcId: string
): { stationObject: PlotObject } | null {
  const detail = plot.detail;
  if (!detail) {
    return null;
  }

  for (const plotObject of detail.plot_objects) {
    if (plotObject.manufacturing?.active_craft?.operator_npc_id !== npcId) {
      continue;
    }

    return { stationObject: plotObject };
  }

  return null;
}

export function reserveManufacturingStationForNpc(
  plot: Plot,
  stationObjectId: string,
  operatorNpcId: string
): ReserveManufacturingStationResult {
  const stationObject = getManufacturingStationById(plot, stationObjectId);
  if (!stationObject?.manufacturing) {
    return { changed: false, reserved: false };
  }

  if (stationObject.manufacturing.assigned_npc_id === operatorNpcId) {
    return { changed: false, reserved: true };
  }

  if (stationObject.manufacturing.assigned_npc_id !== null) {
    return { changed: false, reserved: false };
  }

  if (stationObject.manufacturing.active_craft !== null) {
    return { changed: false, reserved: false };
  }

  if (!canStationStartNextQueuedCraft(stationObject)) {
    return { changed: false, reserved: false };
  }

  // Reserve first so only one worker can claim this ready station.
  stationObject.manufacturing.assigned_npc_id = operatorNpcId;
  return { changed: true, reserved: true };
}

export function tryStartManufacturingCraft(
  plot: Plot,
  stationObjectId: string,
  operatorNpcId: string,
  nowMs: number
): StartManufacturingCraftResult {
  const stationObject = getManufacturingStationById(plot, stationObjectId);
  if (!stationObject?.manufacturing) {
    return { changed: false, started: false };
  }

  if (stationObject.manufacturing.assigned_npc_id !== operatorNpcId) {
    return { changed: false, started: false };
  }

  if (stationObject.manufacturing.active_craft !== null) {
    return { changed: false, started: false };
  }

  const queueEntry = stationObject.manufacturing.queue[0];
  if (!queueEntry) {
    stationObject.manufacturing.assigned_npc_id = null;
    return { changed: true, started: false };
  }

  const recipeDefinition = getManufacturingRecipeDefinition(queueEntry.recipe_id);

  for (const ingredient of recipeDefinition.input_items) {
    const bufferedQuantity = getBufferedItemCount(
      stationObject.manufacturing.input_buffer,
      ingredient.item_id
    );
    if (bufferedQuantity < ingredient.quantity) {
      stationObject.manufacturing.assigned_npc_id = null;
      return { changed: true, started: false };
    }
  }

  const lockedInputItemCounts: Partial<Record<ItemId, number>> = {};

  for (const ingredient of recipeDefinition.input_items) {
    const bufferedQuantity = getBufferedItemCount(
      stationObject.manufacturing.input_buffer,
      ingredient.item_id
    );

    // Move inputs out of the visible input buffer into locked craft state.
    setBufferedItemCount(
      stationObject.manufacturing.input_buffer,
      ingredient.item_id,
      bufferedQuantity - ingredient.quantity
    );
    lockedInputItemCounts[ingredient.item_id] = ingredient.quantity;
  }

  if (queueEntry.quantity <= 1) {
    stationObject.manufacturing.queue.shift();
  } else {
    queueEntry.quantity -= 1;
  }

  stationObject.manufacturing.active_craft = {
    recipe_id: recipeDefinition.id,
    operator_npc_id: operatorNpcId,
    started_at_ms: nowMs,
    ends_at_ms: nowMs + recipeDefinition.craft_time_ms,
    locked_input_item_counts: lockedInputItemCounts,
  };

  return {
    changed: true,
    started: true,
    recipe_id: recipeDefinition.id,
    ends_at_ms: nowMs + recipeDefinition.craft_time_ms,
  };
}

export function completeManufacturingCraft(
  plot: Plot,
  stationObjectId: string,
  operatorNpcId: string,
  nowMs: number
): CompleteManufacturingCraftResult {
  // Reserved for future craft-history / analytics timestamps.
  void nowMs;

  const stationObject = getManufacturingStationById(plot, stationObjectId);
  if (!stationObject?.manufacturing?.active_craft) {
    return { changed: false, completed: false };
  }

  const activeCraft = stationObject.manufacturing.active_craft;
  if (activeCraft.operator_npc_id !== operatorNpcId) {
    return { changed: false, completed: false };
  }

  const recipeDefinition = getManufacturingRecipeDefinition(activeCraft.recipe_id);
  const currentOutputQuantity = getBufferedItemCount(
    stationObject.manufacturing.output_buffer,
    recipeDefinition.output_item_id
  );

  stationObject.manufacturing.output_buffer.item_counts[recipeDefinition.output_item_id] =
    currentOutputQuantity + recipeDefinition.output_quantity;
  stationObject.manufacturing.active_craft = null;
  stationObject.manufacturing.assigned_npc_id = null;

  return {
    changed: true,
    completed: true,
    output_item_id: recipeDefinition.output_item_id,
    output_quantity: recipeDefinition.output_quantity,
  };
}

export function pickupSingleManufacturingOutputItem(
  plot: Plot,
  stationObjectId: string,
  itemId: ItemId
): PickupManufacturingOutputResult {
  const stationObject = getManufacturingStationById(plot, stationObjectId);
  if (!stationObject?.manufacturing) {
    return { changed: false, picked_up: false };
  }

  const bufferedQuantity = getBufferedItemCount(
    stationObject.manufacturing.output_buffer,
    itemId
  );
  if (bufferedQuantity <= 0) {
    return { changed: false, picked_up: false };
  }

  setBufferedItemCount(
    stationObject.manufacturing.output_buffer,
    itemId,
    bufferedQuantity - 1
  );

  return { changed: true, picked_up: true, item_id: itemId };
}

export function findManufacturingInputDestinationForSingleItem(
  plot: Plot,
  itemId: ItemId,
  sourceX: number,
  sourceY: number,
  options?: ManufacturingInboundQueryOptions & {
    planned_inbound_by_station_item_key?: Map<string, number>;
  }
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

    const plannedInboundQuantity =
      options?.planned_inbound_by_station_item_key?.get(
        `${plotObject.id}::${itemId}`
      ) ?? 0;

    const inboundQuantity = getInboundManufacturingInputQuantity(
      plot,
      plotObject.id,
      itemId,
      {
        include_pending_jobs: options?.include_pending_jobs,
        additional_planned_quantity: plannedInboundQuantity,
      }
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

  // Input buffer stays authoritative server-side.
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

  // Clearing removes only not-yet-started work.
  stationObject.manufacturing.queue = [];

  return {
    ok: true,
    station_object_id: stationObject.id,
    cleared_entry_count: clearedEntryCount,
    cleared_quantity: clearedQuantity,
  };
}