import { describe, expect, it } from "vitest";
import {
  ensureClaimedPlayerPlotInitialized,
  extractRubbleOutputFromPlotObject,
  releaseManufacturingInputBufferToGround,
  resolveDirectHaulDestinationForSingleItem,
  spawnLooseItemNearTile,
  tryDepositSingleItemIntoDumpZone,
} from "./world";

import { queueManufacturingRecipe } from "./manufacturing";
import type { Plot } from "../net/protocol";

function makeClaimedPlayerPlot(): Plot {
  const plot: Plot = {
    id: "T_0_1",
    type: "PLAYER",
    x: 0,
    y: 1,
    claimed_by: "plr_test",
    shell: {
      kind: "EMPTY",
      variant: "player_plot_default",
      stage: 0,
    },
  };

  ensureClaimedPlayerPlotInitialized(plot);
  return plot;
}

describe("world logistics helpers", () => {
  it("initializes starter rubble with remaining output rolls", () => {
    const plot = makeClaimedPlayerPlot();
    const rubble = plot.detail?.plot_objects.find((obj) => obj.kind === "RUBBLE_4X4");

    expect(typeof rubble?.remaining_output_rolls).toBe("number");
    expect(rubble?.remaining_output_rolls ?? 0).toBeGreaterThanOrEqual(3);
    expect(rubble?.remaining_output_rolls ?? 0).toBeLessThanOrEqual(8);
  });

  it("merges the same loose item on the same tile", () => {
    const plot = makeClaimedPlayerPlot();

    const first = spawnLooseItemNearTile(plot, "SCRAP_WOOD", 18, 18, 1000);
    const second = spawnLooseItemNearTile(plot, "SCRAP_WOOD", 18, 18, 1100);

    expect(first.changed).toBe(true);
    expect(second.changed).toBe(true);
    expect(plot.detail?.loose_items).toHaveLength(1);
    expect(plot.detail?.loose_items?.[0]?.quantity).toBe(2);
  });

  it("moves to another tile when the preferred tile already has a different item", () => {
    const plot = makeClaimedPlayerPlot();

    spawnLooseItemNearTile(plot, "SCRAP_WOOD", 18, 18, 1000);
    spawnLooseItemNearTile(plot, "SCRAP_METAL", 18, 18, 1100);

    expect(plot.detail?.loose_items).toHaveLength(2);

    const positions = new Set(
      (plot.detail?.loose_items ?? []).map((item) => `${item.x},${item.y}`)
    );
    expect(positions.size).toBe(2);
  });

  it("creates the starter dump zone with abstract storage", () => {
    const plot = makeClaimedPlayerPlot();
    const dumpZone = plot.detail?.plot_objects.find((obj) => obj.kind === "DUMP_ZONE_8X8");

    expect(dumpZone?.id).toBe("starter_dump_zone");
    expect(dumpZone?.footprint_w).toBe(8);
    expect(dumpZone?.footprint_h).toBe(8);
    expect(dumpZone?.storage?.mode).toBe("ABSTRACT");
    expect(dumpZone?.storage?.capacity_max).toBe(200);
    expect(dumpZone?.storage?.capacity_used).toBe(0);
  });

    it("creates the starter workbench with reusable manufacturing state", () => {
    const plot = makeClaimedPlayerPlot();
    const workbench = plot.detail?.plot_objects.find(
      (obj) => obj.kind === "WORKBENCH_1X2"
    );

    expect(workbench?.id).toBe("starter_workbench");
    expect(workbench?.footprint_w).toBe(2);
    expect(workbench?.footprint_h).toBe(6);
    expect(workbench?.manufacturing?.station_kind).toBe("WORKBENCH");
    expect(workbench?.manufacturing?.allowed_recipe_ids).toEqual([
      "WOODEN_PALLET",
    ]);
    expect(workbench?.manufacturing?.queue).toEqual([]);
    expect(workbench?.manufacturing?.input_buffer.item_counts).toEqual({});
    expect(workbench?.manufacturing?.output_buffer.item_counts).toEqual({});
    expect(workbench?.manufacturing?.active_craft).toBeNull();
  });

  it("releases buffered workbench inputs back to loose items when the queue is cleared", () => {
    const plot = makeClaimedPlayerPlot();
    queueManufacturingRecipe(plot, "starter_workbench", "WOODEN_PALLET", 1, 1000);

    const workbench = plot.detail?.plot_objects.find(
      (obj) => obj.id === "starter_workbench"
    );
    if (!workbench?.manufacturing) {
      throw new Error("expected starter workbench");
    }

    workbench.manufacturing.input_buffer.item_counts.SCRAP_WOOD = 2;
    workbench.manufacturing.queue = [];

    const release = releaseManufacturingInputBufferToGround(
      plot,
      "starter_workbench",
      2000
    );

    const releasedScrapWoodQuantity = (plot.detail?.loose_items ?? [])
      .filter((looseItem) => looseItem.item_id === "SCRAP_WOOD")
      .reduce((total, looseItem) => total + looseItem.quantity, 0);

    expect(release).toEqual({ changed: true, released_quantity: 2 });
    expect(workbench.manufacturing.input_buffer.item_counts.SCRAP_WOOD).toBeUndefined();
    expect(releasedScrapWoodQuantity).toBe(2);
  });

  it("routes scrap wood to the workbench input when queued pallet work needs ingredients", () => {
    const plot = makeClaimedPlayerPlot();
    queueManufacturingRecipe(plot, "starter_workbench", "WOODEN_PALLET", 1, 1000);

    const destination = resolveDirectHaulDestinationForSingleItem(
      plot,
      "SCRAP_WOOD",
      23,
      23,
      1200
    );

    expect(destination).toEqual({
      mode: "MANUFACTURING_INPUT",
      object_id: "starter_workbench",
    });
  });

  it("routes to the dump zone when it is within the direct-haul range", () => {
    const plot = makeClaimedPlayerPlot();
    const destination = resolveDirectHaulDestinationForSingleItem(
      plot,
      "SCRAP_WOOD",
      23,
      18,
      1000
    );

    expect(destination).toEqual({
      mode: "DUMP_ZONE",
      object_id: "starter_dump_zone",
    });
  });

  it("deposits a single item into the dump zone and updates abstract totals", () => {
    const plot = makeClaimedPlayerPlot();
    const deposit = tryDepositSingleItemIntoDumpZone(
      plot,
      "starter_dump_zone",
      "SCRAP_WOOD",
      1000
    );

    const dumpZone = plot.detail?.plot_objects.find((obj) => obj.id === "starter_dump_zone");
    expect(deposit).toEqual({ changed: true, deposited: true });
    expect(dumpZone?.storage?.capacity_used).toBe(2);
    expect(dumpZone?.storage?.item_counts.SCRAP_WOOD).toBe(1);
  });

  it("falls back away from the dump zone when it is full and starts a retry cooldown", () => {
    const plot = makeClaimedPlayerPlot();
    const dumpZone = plot.detail?.plot_objects.find((obj) => obj.id === "starter_dump_zone");
    if (!dumpZone?.storage) {
      throw new Error("expected starter dump zone storage");
    }

    dumpZone.storage.capacity_used = dumpZone.storage.capacity_max;

    const destination = resolveDirectHaulDestinationForSingleItem(
      plot,
      "SCRAP_WOOD",
      23,
      18,
      2000
    );

    expect(destination).toEqual({ mode: "GROUND" });
    expect(dumpZone.storage.haul_blocked_until_ms).toBe(62_000);
  });

  it("extracts one real item and decrements rubble outputs", () => {
    const plot = makeClaimedPlayerPlot();
    const rubble = plot.detail?.plot_objects.find((obj) => obj.kind === "RUBBLE_4X4");
    if (!rubble || typeof rubble.remaining_output_rolls !== "number") {
      throw new Error("expected starter rubble object");
    }

    rubble.remaining_output_rolls = 2;
    const action = extractRubbleOutputFromPlotObject(plot, rubble.id);

    expect(action.changed).toBe(true);
    expect(action.cleared).toBe(false);
    expect(action.outputsRemaining).toBe(1);
    expect(["SCRAP_WOOD", "SCRAP_METAL", "TARP", "MIXED_SALVAGE"]).toContain(
      action.itemId
    );
  });
});