import { describe, expect, it } from "vitest";
import { buildClientWorld, encodePlotDetailForClient } from "./client_view";
import type { PlotDetail, WorldState } from "../net/protocol";

describe("buildClientWorld", () => {
  it("does not expose players to the client payload", () => {
    const world: WorldState = {
      version: 1,
      players: {
        plr_1: {
          id: "plr_1",
          secret: "super-secret",
          display_name: "Alice",
        },
      },
      plots: [
        {
          id: "T_0_1",
          type: "PLAYER",
          x: 0,
          y: 1,
          claimed_by: "plr_1",
          shell: { kind: "EMPTY", variant: "player_plot_default", stage: 0 },
        },
      ],
    };

    const clientWorld = buildClientWorld(world, "plr_1") as Record<string, unknown>;

    expect(clientWorld.players).toBeUndefined();
    expect(clientWorld.version).toBe(1);
    expect(Array.isArray(clientWorld.plots)).toBe(true);
  });
});

describe("encodePlotDetailForClient", () => {
  it("uses plot_objects and loose_items in the owned-plot DTO", () => {
    const detail: PlotDetail = {
      width: 4,
      height: 4,
      cells: [
        { x: 0, y: 0, blocked: false, clearable: false, terrain: "GROUND" },
        { x: 1, y: 0, blocked: true, clearable: true, terrain: "RUBBLE" },
      ],
      plot_objects: [
        {
          id: "starter_shack",
          kind: "SHACK",
          x: 0,
          y: 0,
          footprint_w: 2,
          footprint_h: 2,
        },
      ],
      loose_items: [
        {
          id: "loose_1",
          item_id: "SCRAP_WOOD",
          quantity: 1,
          x: 2,
          y: 2,
          reserved_by_npc_id: null,
          created_at_ms: 1000,
        },
      ],
      npcs: [],
      jobs: [],
      active_order: null,
    };

    const encoded = encodePlotDetailForClient(detail);

    expect(encoded.plot_objects).toHaveLength(1);
    expect(encoded.plot_objects[0]?.id).toBe("starter_shack");
    expect(encoded.loose_items).toHaveLength(1);
    expect(encoded.loose_items[0]?.item_id).toBe("SCRAP_WOOD");
    expect(encoded.cell_rows[0]).toBe("GRGG");
  });

  it("filters completed and cancelled job history out of the client payload", () => {
    const detail: PlotDetail = {
      width: 4,
      height: 4,
      cells: [
        { x: 0, y: 0, blocked: false, clearable: false, terrain: "GROUND" },
      ],
      plot_objects: [],
      loose_items: [],
      npcs: [],
      jobs: [
        {
          id: "job_queued",
          kind: "HAUL_LOOSE_ITEM",
          status: "queued",
          assigned_npc_id: null,
          created_at_ms: 1000,
          updated_at_ms: 1000,
          target_loose_item_id: "loose_1",
          target_object_id: null,
          source_order_kind: null,
          source_target_scope: null,
          haul_item_id: "SCRAP_WOOD",
          haul_quantity: 1,
          haul_destination_mode: "DUMP_ZONE",
          haul_destination_object_id: "starter_dump_zone",
          blocked_reason: null,
        },
        {
          id: "job_completed",
          kind: "HAUL_LOOSE_ITEM",
          status: "completed",
          assigned_npc_id: "npc_1",
          created_at_ms: 1000,
          updated_at_ms: 2000,
          target_loose_item_id: "loose_2",
          target_object_id: null,
          source_order_kind: null,
          source_target_scope: null,
          haul_item_id: "SCRAP_WOOD",
          haul_quantity: 1,
          haul_destination_mode: "DUMP_ZONE",
          haul_destination_object_id: "starter_dump_zone",
          blocked_reason: null,
        },
        {
          id: "job_cancelled",
          kind: "SCAVENGE_RUBBLE",
          status: "cancelled",
          assigned_npc_id: null,
          created_at_ms: 1000,
          updated_at_ms: 3000,
          target_loose_item_id: null,
          target_object_id: "rubble_1",
          source_order_kind: "SCAVENGING",
          source_target_scope: "ALL",
          haul_item_id: null,
          haul_quantity: null,
          haul_destination_mode: null,
          haul_destination_object_id: null,
          blocked_reason: "source_missing",
        },
      ],
      active_order: null,
    };

    const encoded = encodePlotDetailForClient(detail);

    expect(encoded.jobs).toHaveLength(1);
    expect(encoded.jobs[0]?.id).toBe("job_queued");
  });
});