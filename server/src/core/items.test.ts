import { describe, expect, it } from "vitest";
import {
  getItemDefinition,
  isKnownItemId,
  listItemDefinitions,
  rollStarterRubbleOutputGroup,
  rollStarterRubbleOutputItem,
  rollStarterRubbleOutputRollCount,
  STARTER_RUBBLE_OUTPUT_ROLLS_MAX,
  STARTER_RUBBLE_OUTPUT_ROLLS_MIN,
} from "./items";

/**
 * Small deterministic random helper for table-roll tests.
 * The production code uses Math.random by default, but tests should not depend
 * on real randomness.
 */
function makeSequenceRandom(values: number[]): () => number {
  let index = 0;

  return () => {
    if (index >= values.length) {
      throw new Error("Sequence random ran out of values.");
    }

    const value = values[index];
    index += 1;
    return value;
  };
}

describe("items foundation", () => {
  it("recognizes valid item ids", () => {
    expect(isKnownItemId("SCRAP_WOOD")).toBe(true);
    expect(isKnownItemId("SCRAP_METAL")).toBe(true);
    expect(isKnownItemId("TARP")).toBe(true);
    expect(isKnownItemId("MIXED_SALVAGE")).toBe(true);
    expect(isKnownItemId("WOODEN_PALLET")).toBe(true);
  });

  it("rejects unknown item ids", () => {
    expect(isKnownItemId("SCRAP")).toBe(false);
    expect(isKnownItemId("PALLET")).toBe(false);
    expect(isKnownItemId("")).toBe(false);
  });

  it("returns the authoritative wooden pallet definition", () => {
    const pallet = getItemDefinition("WOODEN_PALLET");

    expect(pallet.name).toBe("Wooden Pallet");
    expect(pallet.carry.class).toBe("LARGE");
    expect(pallet.carry.hand_slots_required).toBe(2);
    expect(pallet.routing.allow_direct_to_dump_zone).toBe(false);
  });

  it("lists all currently defined branch-1 foundation items", () => {
    const ids = listItemDefinitions().map((item) => item.id).sort();

    expect(ids).toEqual([
      "MIXED_SALVAGE",
      "SCRAP_METAL",
      "SCRAP_WOOD",
      "TARP",
      "WOODEN_PALLET",
    ]);
  });
});

describe("starter rubble output group rolling", () => {
  it("rolls CLEAN when the weighted roll lands in the first half", () => {
    const rng = makeSequenceRandom([0.10]);
    expect(rollStarterRubbleOutputGroup(rng)).toBe("CLEAN");
  });

  it("rolls MIXED when the weighted roll lands in the second half", () => {
    const rng = makeSequenceRandom([0.90]);
    expect(rollStarterRubbleOutputGroup(rng)).toBe("MIXED");
  });
});

describe("starter rubble output item rolling", () => {
  it("returns mixed salvage when the group roll selects MIXED", () => {
    const rng = makeSequenceRandom([0.75]);
    expect(rollStarterRubbleOutputItem(rng)).toBe("MIXED_SALVAGE");
  });

  it("can return scrap wood from the clean subtable", () => {
    const rng = makeSequenceRandom([
      0.10, // CLEAN group
      0.05, // first entry in clean item table
    ]);

    expect(rollStarterRubbleOutputItem(rng)).toBe("SCRAP_WOOD");
  });

  it("can return scrap metal from the clean subtable", () => {
    const rng = makeSequenceRandom([
      0.10, // CLEAN group
      0.50, // second entry in clean item table
    ]);

    expect(rollStarterRubbleOutputItem(rng)).toBe("SCRAP_METAL");
  });

  it("can return tarp from the clean subtable", () => {
    const rng = makeSequenceRandom([
      0.10, // CLEAN group
      0.95, // third entry in clean item table
    ]);

    expect(rollStarterRubbleOutputItem(rng)).toBe("TARP");
  });
});

describe("starter rubble output roll count", () => {
  it("returns the configured minimum when the roll is at the low end", () => {
    const rng = makeSequenceRandom([0.0]);
    expect(rollStarterRubbleOutputRollCount(rng)).toBe(
      STARTER_RUBBLE_OUTPUT_ROLLS_MIN
    );
  });

  it("returns the configured maximum when the roll is near the high end", () => {
    const rng = makeSequenceRandom([0.999999]);
    expect(rollStarterRubbleOutputRollCount(rng)).toBe(
      STARTER_RUBBLE_OUTPUT_ROLLS_MAX
    );
  });

  it("always returns a value inside the inclusive configured range", () => {
    const values = [0.0, 0.2, 0.4, 0.6, 0.8, 0.999999];

    for (const value of values) {
      const count = rollStarterRubbleOutputRollCount(() => value);
      expect(count).toBeGreaterThanOrEqual(STARTER_RUBBLE_OUTPUT_ROLLS_MIN);
      expect(count).toBeLessThanOrEqual(STARTER_RUBBLE_OUTPUT_ROLLS_MAX);
    }
  });
});