import { describe, expect, it } from "vitest";
import {
  cancelActivePlotOrder,
  issueScavengingOrder,
  tickNpcSimulation,
} from "./npc";
import { ensureClaimedPlayerPlotInitialized, normalizeWorldForM0_5 } from "./world";
import type { Plot, PlotDetail, PlotDetailNpc, WorldState } from "../net/protocol";

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

function makeClaimedPlayerPlotWithId(plotId: string, x: number, y: number): Plot {
  const plot: Plot = {
    id: plotId,
    type: "PLAYER",
    x,
    y,
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

function makeLegacyNpcDetail(): PlotDetail {
  return {
    width: 10,
    height: 10,
    cells: [],
    starter_objects: [
      {
        id: "starter_shack",
        kind: "SHACK",
        x: 2,
        y: 2,
        footprint_w: 4,
        footprint_h: 4,
      },
    ],
    npcs: [
      {
        id: "legacy_worker_1",
        kind: "STARTER_WORKER",
        x: 7,
        y: 5,
        home_x: 7,
        home_y: 5,
        state: "idle",
        assigned_order: null,
        target_object_id: null,
        move_to_x: null,
        move_to_y: null,
        state_started_at_ms: null,
        state_ends_at_ms: null,
        carrying_kind: null,
      } as PlotDetailNpc,
    ],
    jobs: [],
    active_order: null,
  };
}

describe("npc job system", () => {
  it("creates scavenging jobs and starts work for the scavenger role", () => {
    const plot = makeClaimedPlayerPlot();

    const issue = issueScavengingOrder(plot, 1000);
    expect(issue.ok).toBe(true);

    expect((plot.detail?.jobs ?? []).length).toBeGreaterThan(0);

    const scavenger = (plot.detail?.npcs ?? []).find((npc) => npc.job_type === "SCAVENGER");
    const laborer = (plot.detail?.npcs ?? []).find((npc) => npc.job_type === "LABORER");

    expect(scavenger?.assigned_order).toBe("SCAVENGING");
    expect(scavenger?.current_activity).toBe("Walking to rubble");
    expect(laborer?.state).toBe("idle");
    expect(laborer?.current_activity).toBe("Idle");

    const changed = tickNpcSimulation({ plots: [plot] }, 999999);
    expect(changed.length).toBeGreaterThanOrEqual(1);
  });

    it("gives different starter npc names to different plots while keeping names populated", () => {
    const firstPlot = makeClaimedPlayerPlotWithId("T_0_1", 0, 1);
    const secondPlot = makeClaimedPlayerPlotWithId("T_1_0", 1, 0);

    const firstNames = (firstPlot.detail?.npcs ?? []).map((npc) => npc.name);
    const secondNames = (secondPlot.detail?.npcs ?? []).map((npc) => npc.name);

    expect(firstNames.length).toBe(2);
    expect(secondNames.length).toBe(2);
    expect(firstNames.every((name) => name.length > 0)).toBe(true);
    expect(secondNames.every((name) => name.length > 0)).toBe(true);
    expect(firstNames).not.toEqual(secondNames);
  });

  it("rejects scavenging orders when no eligible scavenger exists", () => {
    const plot = makeClaimedPlayerPlot();

    if (!plot.detail?.npcs) {
      throw new Error("expected starter npcs");
    }

    for (const npc of plot.detail.npcs) {
      npc.job_type = "LABORER";
      npc.allowed_order_kinds = [];
    }

    const issue = issueScavengingOrder(plot, 1000);
    expect(issue.ok).toBe(false);
    expect(issue.reason).toBe("no_eligible_npc");
  });

  it("normalizes legacy npc records with names, roles, and activities", () => {
    const world: WorldState = {
      version: 1,
      players: {},
      plots: [
        {
          id: "T_0_1",
          type: "PLAYER",
          x: 0,
          y: 1,
          claimed_by: "plr_test",
          shell: {
            kind: "RUINED",
            variant: "player_plot_ruined",
            stage: 0,
          },
          detail: makeLegacyNpcDetail(),
        },
      ],
    };

    const result = normalizeWorldForM0_5(world);
    expect(result.changed).toBe(true);

    const npc = world.plots[0].detail?.npcs?.[0];
    expect(npc?.name).toBeTruthy();
    expect(npc?.job_type).toBe("SCAVENGER");
    expect(npc?.current_activity).toBe("Idle");
    expect(npc?.allowed_order_kinds).toEqual([
      "SCAVENGING",
      "SCAVENGING_SINGLE",
    ]);
  });

    it("creates one job for the single-target scavenging order", () => {
    const plot = makeClaimedPlayerPlot();

    const issue = issueScavengingOrder(
      plot,
      1000,
      "SCAVENGING_SINGLE",
      "SINGLE"
    );
    expect(issue.ok).toBe(true);

    const jobs = plot.detail?.jobs ?? [];
    expect(jobs.length).toBe(1);
    expect(jobs[0]?.source_order_kind).toBe("SCAVENGING_SINGLE");
    expect(jobs[0]?.source_target_scope).toBe("SINGLE");

    expect(plot.detail?.active_order).toEqual({
      kind: "SCAVENGING_SINGLE",
      target_scope: "SINGLE",
      issued_at_ms: 1000,
    });

    const scavenger = (plot.detail?.npcs ?? []).find(
      (npc) => npc.job_type === "SCAVENGER"
    );
    expect(scavenger?.assigned_order).toBe("SCAVENGING_SINGLE");
  });

  it("cancels the active scavenging order and releases assigned scavengers", () => {
    const plot = makeClaimedPlayerPlot();

    const issue = issueScavengingOrder(plot, 1000, "SCAVENGING", "ALL");
    expect(issue.ok).toBe(true);
    expect(plot.detail?.active_order).toEqual({
      kind: "SCAVENGING",
      target_scope: "ALL",
      issued_at_ms: 1000,
    });

    const cancel = cancelActivePlotOrder(plot, 1200);
    expect(cancel.ok).toBe(true);
    expect(cancel.cancelled_order_kind).toBe("SCAVENGING");
    expect(cancel.cancelled_target_scope).toBe("ALL");

    expect(plot.detail?.active_order).toBeNull();

    const jobs = plot.detail?.jobs ?? [];
    expect(
      jobs.every(
        (job) =>
          job.status === "cancelled" || job.status === "completed"
      )
    ).toBe(true);

    const scavenger = (plot.detail?.npcs ?? []).find(
      (npc) => npc.job_type === "SCAVENGER"
    );
    expect(scavenger?.assigned_order).toBeNull();
    expect(scavenger?.target_object_id).toBeNull();
    expect(["idle", "returning"]).toContain(scavenger?.state ?? "");
  });

  it("updates activity text as the scavenger progresses through states", () => {
    const plot = makeClaimedPlayerPlot();

    const issue = issueScavengingOrder(plot, 1000);
    expect(issue.ok).toBe(true);

    const scavenger = (plot.detail?.npcs ?? []).find((npc) => npc.job_type === "SCAVENGER");
    if (!scavenger) {
      throw new Error("expected scavenger npc");
    }

    expect(scavenger.current_activity).toBe("Walking to rubble");

    tickNpcSimulation({ plots: [plot] }, 5000);
    expect(scavenger.current_activity).toBe("Clearing rubble");

    tickNpcSimulation({ plots: [plot] }, 7000);
    expect(scavenger.current_activity).toBe("Carrying scrap");
  });
});