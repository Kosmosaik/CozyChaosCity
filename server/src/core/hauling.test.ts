import { describe, expect, it } from "vitest";
import { tickNpcSimulation } from "./npc";
import { ensureClaimedPlayerPlotInitialized, spawnLooseItemNearTile } from "./world";
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

describe("hauling foundation", () => {
  it("creates one hauling job per loose unit", () => {
    const plot = makeClaimedPlayerPlot();

    spawnLooseItemNearTile(plot, "SCRAP_WOOD", 18, 18, 1000);
    spawnLooseItemNearTile(plot, "SCRAP_WOOD", 18, 18, 1100);

    tickNpcSimulation({ plots: [plot] }, 1200);

    const haulJobs = (plot.detail?.jobs ?? []).filter((job) => job.kind === "HAUL_LOOSE_ITEM");
    expect(haulJobs).toHaveLength(2);
    expect(haulJobs.every((job) => job.source_order_kind == null)).toBe(true);
  });

  it("lets an idle laborer haul a loose item into the dump zone", () => {
    const plot = makeClaimedPlayerPlot();
    const scavenger = (plot.detail?.npcs ?? []).find((npc) => npc.job_type === "SCAVENGER");
    const laborer = (plot.detail?.npcs ?? []).find((npc) => npc.job_type === "LABORER");
    const dumpZone = (plot.detail?.plot_objects ?? []).find((obj) => obj.id === "starter_dump_zone");

    if (!scavenger || !laborer || !dumpZone?.storage) {
      throw new Error("expected starter npcs and dump zone");
    }

    scavenger.x = 0;
    scavenger.y = 0;
    laborer.x = 18;
    laborer.y = 18;
    laborer.home_x = 18;
    laborer.home_y = 18;

    spawnLooseItemNearTile(plot, "SCRAP_WOOD", 18, 18, 1000);

    tickNpcSimulation({ plots: [plot] }, 1200);
    expect(laborer.assigned_job_id).toBeTruthy();

    const moveEndsAtMs = laborer.state_ends_at_ms;
    expect(typeof moveEndsAtMs).toBe("number");
    tickNpcSimulation({ plots: [plot] }, moveEndsAtMs as number);

    const pickupEndsAtMs = laborer.state_ends_at_ms;
    expect(typeof pickupEndsAtMs).toBe("number");
    tickNpcSimulation({ plots: [plot] }, pickupEndsAtMs as number);

    const pickupRecoverEndsAtMs = laborer.state_ends_at_ms;
    expect(typeof pickupRecoverEndsAtMs).toBe("number");
    tickNpcSimulation({ plots: [plot] }, pickupRecoverEndsAtMs as number);

    const carryEndsAtMs = laborer.state_ends_at_ms;
    expect(typeof carryEndsAtMs).toBe("number");
    tickNpcSimulation({ plots: [plot] }, carryEndsAtMs as number);

    const dropEndsAtMs = laborer.state_ends_at_ms;
    expect(typeof dropEndsAtMs).toBe("number");
    tickNpcSimulation({ plots: [plot] }, dropEndsAtMs as number);

    expect((plot.detail?.loose_items ?? []).length).toBe(0);
    expect(dumpZone.storage.item_counts.SCRAP_WOOD).toBe(1);
  });
});