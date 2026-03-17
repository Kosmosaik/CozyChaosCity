import { describe, expect, it } from "vitest";
import { buildClientWorld } from "./client_view";
import type { WorldState } from "../net/protocol";

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