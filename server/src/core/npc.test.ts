import { describe, expect, it } from "vitest";
import {
  cancelActivePlotOrder,
  issueScavengingOrder,
  tickNpcSimulation,
  wakeIdleNpcsForAvailableWork,
} from "./npc";

import {
  ensureClaimedPlayerPlotInitialized,
  normalizeWorldForM0_5,
  releaseManufacturingInputBufferToGround,
  spawnLooseItemNearTile,
} from "./world";

import {
  clearManufacturingQueue,
  queueManufacturingRecipe,
} from "./manufacturing";

import { syncLooseItemHaulJobs } from "./hauling";
import type { Plot, PlotDetail, WorldState } from "../net/protocol";

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
  // This intentionally uses the pre-logistics owned-plot shape so the
  // normalization path proves that legacy saves migrate correctly.
  const legacyDetail = {
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
        carry_slots: [],
      },
    ],
    jobs: [],
    active_order: null,
  };

  return legacyDetail as unknown as PlotDetail;
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
    expect(npc?.carry_slots).toEqual([]);
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

    const cancel = cancelActivePlotOrder(plot);
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
    expect(scavenger?.state).toBe("idle");
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

    const workingEndsAtMs = scavenger.state_ends_at_ms;
    expect(typeof workingEndsAtMs).toBe("number");

    tickNpcSimulation({ plots: [plot] }, workingEndsAtMs as number);
    expect(scavenger.current_activity).toBe("Carrying item");
  });

  it("rolls a real carried item after work completes", () => {
    const plot = makeClaimedPlayerPlot();

    const issue = issueScavengingOrder(plot, 1000);
    expect(issue.ok).toBe(true);

    const scavenger = (plot.detail?.npcs ?? []).find(
      (npc) => npc.job_type === "SCAVENGER"
    );
    if (!scavenger) {
      throw new Error("expected scavenger npc");
    }

    // First transition: moving_to_target -> working
    const moveEndsAtMs = scavenger.state_ends_at_ms;
    expect(typeof moveEndsAtMs).toBe("number");
    tickNpcSimulation({ plots: [plot] }, moveEndsAtMs as number);

    // Second transition: working -> carrying_to_dropoff
    const workEndsAtMs = scavenger.state_ends_at_ms;
    expect(typeof workEndsAtMs).toBe("number");
    tickNpcSimulation({ plots: [plot] }, workEndsAtMs as number);

    expect(scavenger.state).toBe("carrying_to_dropoff");
    expect(scavenger.current_activity).toBe("Carrying item");
    expect(scavenger.carry_slots?.length).toBe(1);
    expect(["SCRAP_WOOD", "SCRAP_METAL", "TARP", "MIXED_SALVAGE"]).toContain(
      scavenger.carry_slots?.[0]?.item_id ?? ""
    );
  });

  it("routes fresh scavenger output through a haul job before dump-zone delivery", () => {
    const plot = makeClaimedPlayerPlot();

    const issue = issueScavengingOrder(plot, 1000);
    expect(issue.ok).toBe(true);

    const scavenger = (plot.detail?.npcs ?? []).find((npc) => npc.job_type === "SCAVENGER");
    const dumpZone = (plot.detail?.plot_objects ?? []).find(
      (obj) => obj.id === "starter_dump_zone"
    );
    if (!scavenger || !dumpZone?.storage) {
      throw new Error("expected starter scavenger and dump zone");
    }

    // moving_to_target -> working
    const moveEndsAtMs = scavenger.state_ends_at_ms;
    expect(typeof moveEndsAtMs).toBe("number");
    tickNpcSimulation({ plots: [plot] }, moveEndsAtMs as number);

    // working -> carrying_to_dropoff via an immediate haul job on the freshly
    // spawned loose item at the rubble edge.
    const workEndsAtMs = scavenger.state_ends_at_ms;
    expect(typeof workEndsAtMs).toBe("number");
    tickNpcSimulation({ plots: [plot] }, workEndsAtMs as number);

    const activeHaulJob = (plot.detail?.jobs ?? []).find(
      (job) =>
        job.kind === "HAUL_LOOSE_ITEM" &&
        job.assigned_npc_id === scavenger.id &&
        job.status === "in_progress"
    );
    expect(activeHaulJob).toBeTruthy();
    expect(scavenger.assigned_job_id).toBe(activeHaulJob?.id);
    expect((plot.detail?.loose_items ?? []).length).toBe(0);

    // carrying_to_dropoff -> dropping_off
    const carryEndsAtMs = scavenger.state_ends_at_ms;
    expect(typeof carryEndsAtMs).toBe("number");
    tickNpcSimulation({ plots: [plot] }, carryEndsAtMs as number);

    // dropping_off -> next state, item abstracted into dump zone
    const dropEndsAtMs = scavenger.state_ends_at_ms;
    expect(typeof dropEndsAtMs).toBe("number");
    tickNpcSimulation({ plots: [plot] }, dropEndsAtMs as number);

    const completedHaulJobs = (plot.detail?.jobs ?? []).filter(
      (job) => job.kind === "HAUL_LOOSE_ITEM" && job.status === "completed"
    );

    expect(scavenger.carry_slots).toEqual([]);
    expect(dumpZone.storage.capacity_used).toBeGreaterThan(0);
    expect(completedHaulJobs.length).toBeGreaterThan(0);
    expect((plot.detail?.loose_items ?? []).length).toBe(0);
  });

  it("drops the carried item as a loose item when the dump zone is full", () => {
    const plot = makeClaimedPlayerPlot();
    const dumpZone = (plot.detail?.plot_objects ?? []).find(
      (obj) => obj.id === "starter_dump_zone"
    );
    if (!dumpZone?.storage) {
      throw new Error("expected starter dump zone");
    }

    dumpZone.storage.capacity_used = dumpZone.storage.capacity_max;

    const issue = issueScavengingOrder(plot, 1000);
    expect(issue.ok).toBe(true);

    const scavenger = (plot.detail?.npcs ?? []).find((npc) => npc.job_type === "SCAVENGER");
    if (!scavenger) {
      throw new Error("expected scavenger npc");
    }

    // moving_to_target -> working
    const moveEndsAtMs = scavenger.state_ends_at_ms;
    expect(typeof moveEndsAtMs).toBe("number");
    tickNpcSimulation({ plots: [plot] }, moveEndsAtMs as number);

    // working -> carrying_to_dropoff
    const workEndsAtMs = scavenger.state_ends_at_ms;
    expect(typeof workEndsAtMs).toBe("number");
    tickNpcSimulation({ plots: [plot] }, workEndsAtMs as number);

    // carrying_to_dropoff -> dropping_off
    const carryEndsAtMs = scavenger.state_ends_at_ms;
    expect(typeof carryEndsAtMs).toBe("number");
    tickNpcSimulation({ plots: [plot] }, carryEndsAtMs as number);

    // dropping_off -> next state, item falls back to the ground
    const dropEndsAtMs = scavenger.state_ends_at_ms;
    expect(typeof dropEndsAtMs).toBe("number");
    tickNpcSimulation({ plots: [plot] }, dropEndsAtMs as number);

    expect(scavenger.carry_slots).toEqual([]);
    expect((plot.detail?.loose_items ?? []).length).toBeGreaterThan(0);
    expect(typeof dumpZone.storage.haul_blocked_until_ms).toBe("number");
  });

  it("starts a ground-only roam toward queued haul work outside the local claim radius", () => {
    const plot = makeClaimedPlayerPlot();

    if (!plot.detail?.npcs) {
      throw new Error("expected starter npcs");
    }

    for (const npc of plot.detail.npcs) {
      // Use a real walkable starter-ground tile outside immediate haul range.
      npc.x = 16;
      npc.y = 16;
      npc.state = "idle";
      npc.current_activity = "Idle";
      npc.state_started_at_ms = null;
      npc.state_ends_at_ms = null;
      npc.move_to_x = null;
      npc.move_to_y = null;
      npc.assigned_job_id = null;
    }

    // Spawn on another valid clear-ground tile that is >10 tiles away,
    // so the NPC must roam before the haul job becomes claimable.
    spawnLooseItemNearTile(plot, "SCRAP_WOOD", 23, 23, 1000);

    tickNpcSimulation({ plots: [plot] }, 1200);

    const haulJobs = (plot.detail?.jobs ?? []).filter(
      (job) => job.kind === "HAUL_LOOSE_ITEM"
    );
    expect(haulJobs.length).toBeGreaterThan(0);

    const roamingNpc = (plot.detail?.npcs ?? []).find(
      (npc) =>
        npc.state === "moving_to_target" &&
        npc.current_activity === "Roaming for haul work"
    );
    expect(roamingNpc).toBeTruthy();
    expect(roamingNpc?.assigned_job_id ?? null).toBeNull();

    const roamTargetX = roamingNpc?.move_to_x;
    const roamTargetY = roamingNpc?.move_to_y;
    expect(typeof roamTargetX).toBe("number");
    expect(typeof roamTargetY).toBe("number");

    const roamTargetCell = (plot.detail?.cells ?? []).find(
      (cell) => cell.x === roamTargetX && cell.y === roamTargetY
    );
    expect(roamTargetCell?.terrain).toBe("GROUND");
    expect(roamTargetCell?.blocked).toBe(false);

    const targetOccupiedByObject = (plot.detail?.plot_objects ?? []).some((obj) => {
      const footprintW = obj.footprint_w ?? 1;
      const footprintH = obj.footprint_h ?? 1;
      return (
        typeof roamTargetX === "number" &&
        typeof roamTargetY === "number" &&
        roamTargetX >= obj.x &&
        roamTargetX < obj.x + footprintW &&
        roamTargetY >= obj.y &&
        roamTargetY < obj.y + footprintH
      );
    });
    expect(targetOccupiedByObject).toBe(false);

    const reservations = plot.detail?.loose_items?.[0]?.reservations ?? [];
    expect(reservations).toEqual([]);
  });

  it("finds and completes a haul job after roaming into range", () => {
    const plot = makeClaimedPlayerPlot();
    const dumpZone = (plot.detail?.plot_objects ?? []).find(
      (obj) => obj.id === "starter_dump_zone"
    );

    if (!plot.detail?.npcs || !dumpZone?.storage) {
      throw new Error("expected starter npcs and dump zone");
    }

    for (const npc of plot.detail.npcs) {
      // Start on walkable clear ground but outside the local haul claim radius.
      npc.x = 16;
      npc.y = 16;
      npc.state = "idle";
      npc.current_activity = "Idle";
      npc.state_started_at_ms = null;
      npc.state_ends_at_ms = null;
      npc.move_to_x = null;
      npc.move_to_y = null;
      npc.assigned_job_id = null;
      npc.carry_slots = [];
    }

    // Place the loose item on a valid far clear-ground tile so the NPC
    // must roam first, then reserve/pick up, then dump-zone deliver.
    spawnLooseItemNearTile(plot, "SCRAP_WOOD", 23, 23, 1000);

    tickNpcSimulation({ plots: [plot] }, 1200);

    for (let step = 0; step < 20; step += 1) {
      const looseItemsRemaining = (plot.detail?.loose_items ?? []).length;

      const anyNpcStillBusy = (plot.detail?.npcs ?? []).some((npc) => {
        return npc.state !== "idle" || (npc.carry_slots?.length ?? 0) > 0;
      });

      const completedHaulJobs = (plot.detail?.jobs ?? []).filter(
        (job) => job.kind === "HAUL_LOOSE_ITEM" && job.status === "completed"
      ).length;

      // Full end-to-end completion means:
      // - no loose item remains on the ground
      // - no NPC is still mid-haul
      // - at least one haul job finished completely
      if (
        looseItemsRemaining === 0 &&
        !anyNpcStillBusy &&
        completedHaulJobs > 0
      ) {
        break;
      }

      const stateEndTimes = (plot.detail?.npcs ?? [])
        .map((npc) => npc.state_ends_at_ms)
        .filter((value): value is number => typeof value === "number")
        .sort((left, right) => left - right);

      if (stateEndTimes.length === 0) {
        break;
      }

      tickNpcSimulation({ plots: [plot] }, stateEndTimes[0]);
    }

    // Roam test verifies end-to-end haul completion, not per-item storage internals.
    expect((plot.detail?.loose_items ?? []).length).toBe(0);
    expect(dumpZone.storage.capacity_used).toBeGreaterThan(0);
  });

  it("hauls queued scrap wood into the workbench input buffer instead of the dump zone", () => {
    const plot = makeClaimedPlayerPlot();
    queueManufacturingRecipe(plot, "starter_workbench", "WOODEN_PALLET", 1, 1000);

    const scavenger = (plot.detail?.npcs ?? []).find(
      (npc) => npc.job_type === "SCAVENGER"
    );
    const laborer = (plot.detail?.npcs ?? []).find(
      (npc) => npc.job_type === "LABORER"
    );
    const dumpZone = (plot.detail?.plot_objects ?? []).find(
      (obj) => obj.id === "starter_dump_zone"
    );
    const workbench = (plot.detail?.plot_objects ?? []).find(
      (obj) => obj.id === "starter_workbench"
    );

    if (!scavenger || !laborer || !dumpZone?.storage || !workbench?.manufacturing) {
      throw new Error("expected starter workers, dump zone, and workbench");
    }

    // Make the laborer the obvious hauler for this test so the route is stable.
    scavenger.x = 0;
    scavenger.y = 0;
    laborer.x = 23;
    laborer.y = 23;
    laborer.home_x = 23;
    laborer.home_y = 23;

    spawnLooseItemNearTile(plot, "SCRAP_WOOD", 23, 23, 1000);

    tickNpcSimulation({ plots: [plot] }, 1200);
    expect(laborer.assigned_job_id).toBeTruthy();

    const moveEndsAtMs = laborer.state_ends_at_ms;
    expect(typeof moveEndsAtMs).toBe("number");
    tickNpcSimulation({ plots: [plot] }, moveEndsAtMs as number);

    const pickupEndsAtMs = laborer.state_ends_at_ms;
    expect(typeof pickupEndsAtMs).toBe("number");
    tickNpcSimulation({ plots: [plot] }, pickupEndsAtMs as number);

    expect(laborer.haul_target_mode).toBe("MANUFACTURING_INPUT");
    expect(laborer.haul_target_object_id).toBe("starter_workbench");

    const carryEndsAtMs = laborer.state_ends_at_ms;
    expect(typeof carryEndsAtMs).toBe("number");
    tickNpcSimulation({ plots: [plot] }, carryEndsAtMs as number);

    const dropEndsAtMs = laborer.state_ends_at_ms;
    expect(typeof dropEndsAtMs).toBe("number");
    tickNpcSimulation({ plots: [plot] }, dropEndsAtMs as number);

    expect((plot.detail?.loose_items ?? []).length).toBe(0);
    expect(workbench.manufacturing.input_buffer.item_counts.SCRAP_WOOD).toBe(1);
    expect(dumpZone.storage.capacity_used).toBe(0);
  });

  it("prioritizes scrap wood hauling to the workbench over nearby dump-zone hauling", () => {
    const plot = makeClaimedPlayerPlot();
    queueManufacturingRecipe(plot, "starter_workbench", "WOODEN_PALLET", 1, 1000);

    const scavenger = (plot.detail?.npcs ?? []).find(
      (npc) => npc.job_type === "SCAVENGER"
    );
    const laborer = (plot.detail?.npcs ?? []).find(
      (npc) => npc.job_type === "LABORER"
    );

    if (!scavenger || !laborer) {
      throw new Error("expected starter workers");
    }

    scavenger.x = 0;
    scavenger.y = 0;
    laborer.x = 23;
    laborer.y = 23;
    laborer.home_x = 23;
    laborer.home_y = 23;

    // Put a normal dump-zone item at the laborer's feet, and required workbench
    // input one tile farther away. Manufacturing input should still win.
    spawnLooseItemNearTile(plot, "SCRAP_METAL", 23, 23, 1000);
    spawnLooseItemNearTile(plot, "SCRAP_WOOD", 22, 23, 1100);

    tickNpcSimulation({ plots: [plot] }, 1200);

    const assignedJob = (plot.detail?.jobs ?? []).find(
      (job) => job.id === laborer.assigned_job_id
    );

    expect(assignedJob?.haul_item_id).toBe("SCRAP_WOOD");
    expect(assignedJob?.haul_destination_mode).toBe("MANUFACTURING_INPUT");
    expect(assignedJob?.haul_destination_object_id).toBe("starter_workbench");
  });

  it("wakes idle haulers immediately when queued workbench demand appears", () => {
    const plot = makeClaimedPlayerPlot();
    queueManufacturingRecipe(plot, "starter_workbench", "WOODEN_PALLET", 1, 1000);

    const scavenger = (plot.detail?.npcs ?? []).find(
      (npc) => npc.job_type === "SCAVENGER"
    );
    const laborer = (plot.detail?.npcs ?? []).find(
      (npc) => npc.job_type === "LABORER"
    );

    if (!scavenger || !laborer) {
      throw new Error("expected starter workers");
    }

    scavenger.x = 0;
    scavenger.y = 0;
    laborer.x = 23;
    laborer.y = 23;
    laborer.home_x = 23;
    laborer.home_y = 23;

    spawnLooseItemNearTile(plot, "SCRAP_METAL", 23, 23, 1000);
    spawnLooseItemNearTile(plot, "SCRAP_WOOD", 22, 23, 1100);

    syncLooseItemHaulJobs(plot, 1200);
    const woke = wakeIdleNpcsForAvailableWork(plot, 1200);

    const assignedJob = (plot.detail?.jobs ?? []).find(
      (job) => job.id === laborer.assigned_job_id
    );

    expect(woke).toBe(true);
    expect(assignedJob?.haul_item_id).toBe("SCRAP_WOOD");
    expect(assignedJob?.haul_destination_mode).toBe("MANUFACTURING_INPUT");
    expect(assignedJob?.haul_destination_object_id).toBe("starter_workbench");
  });

  it("wakes idle haulers for scrap wood released from a cleared workbench queue", () => {
    const plot = makeClaimedPlayerPlot();
    queueManufacturingRecipe(plot, "starter_workbench", "WOODEN_PALLET", 1, 1000);

    const scavenger = (plot.detail?.npcs ?? []).find(
      (npc) => npc.job_type === "SCAVENGER"
    );
    const laborer = (plot.detail?.npcs ?? []).find(
      (npc) => npc.job_type === "LABORER"
    );
    const workbench = (plot.detail?.plot_objects ?? []).find(
      (obj) => obj.id === "starter_workbench"
    );

    if (!scavenger || !laborer || !workbench?.manufacturing) {
      throw new Error("expected starter workers and workbench");
    }

    scavenger.x = 0;
    scavenger.y = 0;
    laborer.x = workbench.x + 2;
    laborer.y = workbench.y;
    laborer.home_x = laborer.x;
    laborer.home_y = laborer.y;

    workbench.manufacturing.input_buffer.item_counts.SCRAP_WOOD = 2;

    const clearResult = clearManufacturingQueue(plot, "starter_workbench");
    expect(clearResult.ok).toBe(true);

    const releaseResult = releaseManufacturingInputBufferToGround(
      plot,
      "starter_workbench",
      2000
    );
    expect(releaseResult).toEqual({ changed: true, released_quantity: 2 });

    syncLooseItemHaulJobs(plot, 2000);
    const woke = wakeIdleNpcsForAvailableWork(plot, 2000);

    const assignedJob = (plot.detail?.jobs ?? []).find(
      (job) => job.id === laborer.assigned_job_id
    );

    expect(woke).toBe(true);
    expect(assignedJob?.haul_item_id).toBe("SCRAP_WOOD");
    expect(assignedJob?.haul_destination_mode).toBe("DUMP_ZONE");
  });

  it("roaming prefers workbench ingredient demand over closer dump-zone cleanup", () => {
    const plot = makeClaimedPlayerPlot();
    queueManufacturingRecipe(plot, "starter_workbench", "WOODEN_PALLET", 1, 1000);

    if (!plot.detail?.npcs) {
      throw new Error("expected starter npcs");
    }

    for (const npc of plot.detail.npcs) {
      npc.x = 16;
      npc.y = 16;
      npc.state = "idle";
      npc.current_activity = "Idle";
      npc.state_started_at_ms = null;
      npc.state_ends_at_ms = null;
      npc.move_to_x = null;
      npc.move_to_y = null;
      npc.assigned_job_id = null;
      npc.carry_slots = [];
    }

    // Both targets stay on known walkable starter-ground tiles and both are
    // outside the local 10-tile claim radius from 16,16.
    // SCRAP_METAL is closer but lower priority.
    spawnLooseItemNearTile(plot, "SCRAP_METAL", 23, 20, 1000);

    // SCRAP_WOOD is slightly farther but should win because it feeds the workbench.
    spawnLooseItemNearTile(plot, "SCRAP_WOOD", 22, 23, 1100);

    tickNpcSimulation({ plots: [plot] }, 1200);

    const roamingNpc = (plot.detail?.npcs ?? []).find(
      (npc) =>
        npc.state === "moving_to_target" &&
        npc.current_activity === "Roaming for haul work"
    );

    expect(roamingNpc).toBeTruthy();

    // The chosen roam direction should head deeper into the clear-area/workbench side
    // rather than toward the closer lower-priority cleanup target.
    expect((roamingNpc?.move_to_x ?? 0)).toBeGreaterThanOrEqual(16);
    expect((roamingNpc?.move_to_y ?? 0)).toBeGreaterThanOrEqual(16);
  });

  it("idles in place after the last drop-off instead of entering returning", () => {
    const plot = makeClaimedPlayerPlot();

    const rubbleObjects = (plot.detail?.plot_objects ?? []).filter(
      (obj) => obj.kind === "RUBBLE_4X4"
    );
    expect(rubbleObjects.length).toBeGreaterThan(0);

    // Force every candidate rubble pile to represent its final output,
    // so whichever one SCAVENGING_SINGLE selects will truly finish.
    for (const rubble of rubbleObjects) {
      rubble.remaining_output_rolls = 1;
    }

    const issue = issueScavengingOrder(
      plot,
      1000,
      "SCAVENGING_SINGLE",
      "SINGLE"
    );
    expect(issue.ok).toBe(true);

    const scavenger = (plot.detail?.npcs ?? []).find(
      (npc) => npc.job_type === "SCAVENGER"
    );
    if (!scavenger) {
      throw new Error("expected scavenger npc");
    }

    const moveEndsAtMs = scavenger.state_ends_at_ms;
    expect(typeof moveEndsAtMs).toBe("number");
    tickNpcSimulation({ plots: [plot] }, moveEndsAtMs as number);

    const workEndsAtMs = scavenger.state_ends_at_ms;
    expect(typeof workEndsAtMs).toBe("number");
    tickNpcSimulation({ plots: [plot] }, workEndsAtMs as number);

    const carryEndsAtMs = scavenger.state_ends_at_ms;
    expect(typeof carryEndsAtMs).toBe("number");
    tickNpcSimulation({ plots: [plot] }, carryEndsAtMs as number);

    const dropX = scavenger.x;
    const dropY = scavenger.y;

    const dropEndsAtMs = scavenger.state_ends_at_ms;
    expect(typeof dropEndsAtMs).toBe("number");
    tickNpcSimulation({ plots: [plot] }, dropEndsAtMs as number);

    expect(scavenger.state).toBe("idle");
    expect(scavenger.current_activity).toBe("Idle");
    expect(scavenger.x).toBe(dropX);
    expect(scavenger.y).toBe(dropY);
    expect(scavenger.move_to_x).toBeNull();
    expect(scavenger.move_to_y).toBeNull();
  });
});