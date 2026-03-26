import { describe, expect, it } from "vitest";
import {
  clearManufacturingQueue,
  findManufacturingInputDestinationForSingleItem,
  getAllowedManufacturingRecipeIdsForStation,
  getManufacturingRecipeDefinition,
  queueManufacturingRecipe,
  tryDepositSingleItemIntoManufacturingInput,
} from "./manufacturing";
import { ensureClaimedPlayerPlotInitialized } from "./world";
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

describe("manufacturing recipe foundation", () => {
  it("defines the starter wooden pallet recipe for the workbench", () => {
    const recipe = getManufacturingRecipeDefinition("WOODEN_PALLET");

    expect(recipe.station_kind).toBe("WORKBENCH");
    expect(recipe.output_item_id).toBe("WOODEN_PALLET");
    expect(recipe.output_quantity).toBe(1);
    expect(recipe.craft_time_ms).toBe(10_000);
    expect(recipe.input_items).toEqual([
      { item_id: "SCRAP_WOOD", quantity: 4 },
    ]);
  });

  it("maps the workbench to the wooden pallet recipe", () => {
    expect(getAllowedManufacturingRecipeIdsForStation("WORKBENCH")).toEqual([
      "WOODEN_PALLET",
    ]);
  });

  it("queues wooden pallet work on the starter workbench", () => {
    const plot = makeClaimedPlayerPlot();

    const result = queueManufacturingRecipe(
      plot,
      "starter_workbench",
      "WOODEN_PALLET",
      3,
      1000
    );

    expect(result.ok).toBe(true);
    expect(result.station_object_id).toBe("starter_workbench");
    expect(result.recipe_id).toBe("WOODEN_PALLET");
    expect(result.queued_quantity).toBe(3);
    expect(result.queue_entry_count).toBe(1);

    const workbench = plot.detail?.plot_objects.find(
      (plotObject) => plotObject.id === "starter_workbench"
    );
    expect(workbench?.manufacturing?.queue).toEqual([
      {
        recipe_id: "WOODEN_PALLET",
        quantity: 3,
        requested_at_ms: 1000,
      },
    ]);
  });

  it("clears queued workbench manufacturing without touching station foundation state", () => {
    const plot = makeClaimedPlayerPlot();

    queueManufacturingRecipe(plot, "starter_workbench", "WOODEN_PALLET", 2, 1000);
    queueManufacturingRecipe(plot, "starter_workbench", "WOODEN_PALLET", 1, 1100);

    const result = clearManufacturingQueue(plot, "starter_workbench");

    expect(result.ok).toBe(true);
    expect(result.station_object_id).toBe("starter_workbench");
    expect(result.cleared_entry_count).toBe(2);
    expect(result.cleared_quantity).toBe(3);

    const workbench = plot.detail?.plot_objects.find(
      (plotObject) => plotObject.id === "starter_workbench"
    );
    expect(workbench?.manufacturing?.queue).toEqual([]);
    expect(workbench?.manufacturing?.station_kind).toBe("WORKBENCH");
  });

  it("finds the starter workbench as an input destination when queued pallets need scrap wood", () => {
    const plot = makeClaimedPlayerPlot();
    queueManufacturingRecipe(plot, "starter_workbench", "WOODEN_PALLET", 1, 1000);

    const destination = findManufacturingInputDestinationForSingleItem(
      plot,
      "SCRAP_WOOD",
      23,
      23
    );

    expect(destination).toEqual({ object_id: "starter_workbench" });
  });

  it("deposits a single scrap wood into the workbench input buffer", () => {
    const plot = makeClaimedPlayerPlot();
    queueManufacturingRecipe(plot, "starter_workbench", "WOODEN_PALLET", 1, 1000);

    const deposit = tryDepositSingleItemIntoManufacturingInput(
      plot,
      "starter_workbench",
      "SCRAP_WOOD"
    );

    const workbench = plot.detail?.plot_objects.find(
      (plotObject) => plotObject.id === "starter_workbench"
    );

    expect(deposit).toEqual({ changed: true, deposited: true });
    expect(workbench?.manufacturing?.input_buffer.item_counts.SCRAP_WOOD).toBe(1);
  });
});