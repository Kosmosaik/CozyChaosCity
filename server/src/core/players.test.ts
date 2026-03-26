import { describe, expect, it } from "vitest";
import {
  backfillLegacyPlayerDisplayName,
  createPlayer,
  resolveHelloPlayer,
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

  it("authenticates an existing player when stored credentials are valid", () => {
    const world = makeWorld();
    const player = createPlayer(world, "Delta");

    const result = resolveHelloPlayer(
      world,
      player.id,
      player.secret,
      "Delta"
    );

    expect(result).toEqual({
      ok: true,
      player,
      created: false,
      display_name_backfilled: false,
    });
  });

  it("rejects invalid stored credentials instead of silently creating a new player", () => {
    const world = makeWorld();
    const player = createPlayer(world, "Echo");

    const result = resolveHelloPlayer(
      world,
      player.id,
      "wrong_secret",
      "Echo"
    );

    expect(result).toEqual({
      ok: false,
      reason: "auth_failed_invalid_credentials",
    });
    expect(Object.keys(world.players)).toHaveLength(1);
  });

  it("creates a new player when no stored credentials exist yet", () => {
    const world = makeWorld();

    const result = resolveHelloPlayer(world, undefined, undefined, "Foxtrot");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected new player creation");
    }

    expect(result.created).toBe(true);
    expect(result.player.display_name).toBe("Foxtrot");
    expect(world.players[result.player.id]?.display_name).toBe("Foxtrot");
  });
});