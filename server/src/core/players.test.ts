import { describe, expect, it } from "vitest";
import {
  backfillLegacyPlayerDisplayName,
  createPlayer,
} from "./players";
import type { PlayerRecord, WorldState } from "../net/protocol";

function makeWorld(): WorldState {
  return {
    version: 1,
    players: {},
    plots: [],
  };
}

describe("players", () => {
  it("backfills legacy generic display names with a real incoming name", () => {
    const player: PlayerRecord = {
      id: "plr_test",
      secret: "secret_test",
      display_name: "Player",
    };

    const changed = backfillLegacyPlayerDisplayName(player, "Alice");
    expect(changed).toBe(true);
    expect(player.display_name).toBe("Alice");
  });

  it("does not overwrite an already-real display name", () => {
    const player: PlayerRecord = {
      id: "plr_test",
      secret: "secret_test",
      display_name: "Bob",
    };

    const changed = backfillLegacyPlayerDisplayName(player, "Alice");
    expect(changed).toBe(false);
    expect(player.display_name).toBe("Bob");
  });

  it("creates new players with the provided display name", () => {
    const world = makeWorld();
    const player = createPlayer(world, "Charlie");

    expect(player.display_name).toBe("Charlie");
    expect(world.players[player.id].display_name).toBe("Charlie");
  });
});