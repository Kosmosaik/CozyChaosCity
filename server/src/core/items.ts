/**
 * Authoritative item and starter-output foundation for Logistics branch 1.
 *
 * Why this file exists:
 * - We need stable item ids before we refactor NPC carry state, loose items,
 *   dump-zone storage, and routing.
 * - Loot/output rules should not be buried inside npc.ts or world.ts.
 * - Carry, storage, and routing rules belong to server-authoritative gameplay
 *   data, not client presentation code.
 *
 * This file is intentionally small for now:
 * - only the first branch-1 item set is defined
 * - only starter-rubble output logic is included
 *
 * It is still structured so we can expand later without rewriting it into a
 * completely different system.
 */

export type ItemId =
  | "SCRAP_WOOD"
  | "SCRAP_METAL"
  | "TARP"
  | "MIXED_SALVAGE"
  | "WOODEN_PALLET";

export type ItemCategory =
  | "SALVAGE"
  | "RESOURCE"
  | "COMPONENT";

export type CarryClass =
  | "SMALL"
  | "MEDIUM"
  | "LARGE";

export type StorageTag =
  | "DUMP_ZONE"
  | "BASIC_STOCKPILE";

export type ItemDefinition = {
  /**
   * Stable authoritative item id used by the server/domain model.
   * This is the value future plot state, jobs, recipes, and transport payloads
   * should reference.
   */
  id: ItemId;

  /**
   * Human-readable name for debugging and future UI use.
   * The simulation should always key off `id`, not `name`.
   */
  name: string;

  /**
   * Broad item grouping for future routing/filtering/recipe logic.
   * Keep this coarse unless gameplay truly needs more detail.
   */
  category: ItemCategory;

  /**
   * Lightweight tags for future storage filters, recipes, and routing.
   * Tags are intentionally additive and should not replace stricter rules when
   * those rules matter.
   */
  tags: string[];

  /**
   * Carry rules represent how an item behaves in NPC hands.
   * This is separate from storage because "easy to carry" and "easy to store"
   * are different gameplay concerns.
   */
  carry: {
    class: CarryClass;
    hand_slots_required: 0 | 1 | 2;
    max_stack_carried: number;
  };

  /**
   * Storage rules are authoritative server-side logistics data.
   * `dump_zone_capacity_cost` is the unit consumed by abstract dump-zone
   * storage, while `max_stack_stored` is for future slotted storage.
   */
  storage: {
    can_exist_loose: boolean;
    max_stack_stored: number;
    dump_zone_capacity_cost: number;
    allowed_storage_tags: StorageTag[];
  };

  /**
   * Routing flags let later logistics helpers answer questions like
   * "is this item allowed to go straight into a dump zone?"
   * without hardcoding item ids in NPC logic.
   */
  routing: {
    allow_direct_to_dump_zone: boolean;
    allow_direct_to_basic_stockpile: boolean;
  };
};

const ITEM_DEFINITIONS: Record<ItemId, ItemDefinition> = {
  SCRAP_WOOD: {
    id: "SCRAP_WOOD",
    name: "Scrap Wood",
    category: "RESOURCE",
    tags: ["scavenge_clean", "burnable", "wood"],
    carry: {
      class: "MEDIUM",
      hand_slots_required: 1,
      max_stack_carried: 1,
    },
    storage: {
      can_exist_loose: true,
      max_stack_stored: 20,
      dump_zone_capacity_cost: 2,
      allowed_storage_tags: ["DUMP_ZONE", "BASIC_STOCKPILE"],
    },
    routing: {
      allow_direct_to_dump_zone: true,
      allow_direct_to_basic_stockpile: true,
    },
  },

  SCRAP_METAL: {
    id: "SCRAP_METAL",
    name: "Scrap Metal",
    category: "RESOURCE",
    tags: ["scavenge_clean", "metal"],
    carry: {
      class: "MEDIUM",
      hand_slots_required: 1,
      max_stack_carried: 1,
    },
    storage: {
      can_exist_loose: true,
      max_stack_stored: 20,
      dump_zone_capacity_cost: 2,
      allowed_storage_tags: ["DUMP_ZONE", "BASIC_STOCKPILE"],
    },
    routing: {
      allow_direct_to_dump_zone: true,
      allow_direct_to_basic_stockpile: true,
    },
  },

  TARP: {
    id: "TARP",
    name: "Tarp",
    category: "RESOURCE",
    tags: ["scavenge_clean", "fabric"],
    carry: {
      class: "MEDIUM",
      hand_slots_required: 1,
      max_stack_carried: 1,
    },
    storage: {
      can_exist_loose: true,
      max_stack_stored: 20,
      dump_zone_capacity_cost: 2,
      allowed_storage_tags: ["DUMP_ZONE", "BASIC_STOCKPILE"],
    },
    routing: {
      allow_direct_to_dump_zone: true,
      allow_direct_to_basic_stockpile: true,
    },
  },

  MIXED_SALVAGE: {
    id: "MIXED_SALVAGE",
    name: "Mixed Salvage",
    category: "SALVAGE",
    tags: ["scavenge_unsorted", "sorting_input"],
    carry: {
      class: "MEDIUM",
      hand_slots_required: 1,
      max_stack_carried: 1,
    },
    storage: {
      can_exist_loose: true,
      max_stack_stored: 20,
      dump_zone_capacity_cost: 2,
      allowed_storage_tags: ["DUMP_ZONE"],
    },
    routing: {
      allow_direct_to_dump_zone: true,
      allow_direct_to_basic_stockpile: false,
    },
  },

  WOODEN_PALLET: {
    id: "WOODEN_PALLET",
    name: "Wooden Pallet",
    category: "COMPONENT",
    tags: ["manufactured", "build_material"],
    carry: {
      class: "LARGE",
      hand_slots_required: 2,
      max_stack_carried: 1,
    },
    storage: {
      can_exist_loose: true,
      max_stack_stored: 4,
      dump_zone_capacity_cost: 4,
      // Branch 3 still has no Basic Stockpile, so finished pallets need a legal
      // temporary storage destination instead of poisoning the haul loop.
      allowed_storage_tags: ["DUMP_ZONE"],
    },
    routing: {
      allow_direct_to_dump_zone: true,
      allow_direct_to_basic_stockpile: false,
    },
  },
};

export type StarterRubbleOutputGroup =
  | "CLEAN"
  | "MIXED";

type WeightedEntry<TValue> = {
  value: TValue;
  weight: number;
};

const STARTER_RUBBLE_OUTPUT_GROUP_TABLE: WeightedEntry<StarterRubbleOutputGroup>[] = [
  { value: "CLEAN", weight: 80 },
  { value: "MIXED", weight: 20 },
];

const STARTER_RUBBLE_CLEAN_ITEM_TABLE: WeightedEntry<ItemId>[] = [
  { value: "SCRAP_WOOD", weight: 4 },
  { value: "SCRAP_METAL", weight: 1 },
  { value: "TARP", weight: 1 },
];

/**
 * Starter rubble should not always produce the same number of outputs.
 * Keeping this here centralizes the authoritative rule for branch 1 and avoids
 * magic numbers spreading across world/npc code.
 */
export const STARTER_RUBBLE_OUTPUT_ROLLS_MIN = 3;
export const STARTER_RUBBLE_OUTPUT_ROLLS_MAX = 8;

export type RandomFloatFn = () => number;

function assertValidRandomFloat(value: number): void {
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new Error("RandomFloatFn must return a finite number in [0, 1).");
  }
}

function rollWeightedValue<TValue>(
  entries: WeightedEntry<TValue>[],
  randomFloatFn: RandomFloatFn
): TValue {
  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);

  if (totalWeight <= 0) {
    throw new Error("Weighted table must have total weight > 0.");
  }

  const randomValue = randomFloatFn();
  assertValidRandomFloat(randomValue);

  let remaining = randomValue * totalWeight;

  for (const entry of entries) {
    remaining -= entry.weight;
    if (remaining < 0) {
      return entry.value;
    }
  }

  // Defensive fallback for floating-point edge cases.
  return entries[entries.length - 1].value;
}

function rollIntegerInclusive(
  min: number,
  max: number,
  randomFloatFn: RandomFloatFn
): number {
  if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
    throw new Error("rollIntegerInclusive requires integer bounds with max >= min.");
  }

  const randomValue = randomFloatFn();
  assertValidRandomFloat(randomValue);

  const span = max - min + 1;
  return min + Math.floor(randomValue * span);
}

export function isKnownItemId(value: string): value is ItemId {
  return Object.prototype.hasOwnProperty.call(ITEM_DEFINITIONS, value);
}

export function getItemDefinition(itemId: ItemId): ItemDefinition {
  return ITEM_DEFINITIONS[itemId];
}

export function listItemDefinitions(): ItemDefinition[] {
  return Object.values(ITEM_DEFINITIONS);
}

/**
 * The starter rubble node first rolls whether the result is a clean directly
 * usable resource or unsorted mixed salvage.
 *
 * This keeps the 50/50 split stable even if we later add more clean output
 * types. We do not want the clean-vs-mixed balance to accidentally drift just
 * because the clean subtable grows.
 */
export function rollStarterRubbleOutputGroup(
  randomFloatFn: RandomFloatFn = Math.random
): StarterRubbleOutputGroup {
  return rollWeightedValue(STARTER_RUBBLE_OUTPUT_GROUP_TABLE, randomFloatFn);
}

export function rollStarterRubbleOutputItem(
  randomFloatFn: RandomFloatFn = Math.random
): ItemId {
  const outputGroup = rollStarterRubbleOutputGroup(randomFloatFn);

  if (outputGroup === "MIXED") {
    return "MIXED_SALVAGE";
  }

  return rollWeightedValue(STARTER_RUBBLE_CLEAN_ITEM_TABLE, randomFloatFn);
}

export function rollStarterRubbleOutputRollCount(
  randomFloatFn: RandomFloatFn = Math.random
): number {
  return rollIntegerInclusive(
    STARTER_RUBBLE_OUTPUT_ROLLS_MIN,
    STARTER_RUBBLE_OUTPUT_ROLLS_MAX,
    randomFloatFn
  );
}