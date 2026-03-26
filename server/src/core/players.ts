import crypto from "node:crypto";
import type { WorldState, PlayerRecord } from "../net/protocol";

function randHex(bytes: number): string {
  return crypto.randomBytes(bytes).toString("hex");
}

export function normalizeDisplayName(input?: string): string {
  const raw = (input ?? "").trim();
  if (raw.length === 0) {
    return "Player";
  }

  const collapsed = raw.replace(/\s+/g, " ");
  return collapsed.slice(0, 32);
}

export function isGenericDisplayName(input?: string): boolean {
  const normalized = normalizeDisplayName(input);
  return normalized === "Player";
}

export function backfillLegacyPlayerDisplayName(
  player: PlayerRecord,
  incomingDisplayName?: string
): boolean {
  const normalizedIncoming = normalizeDisplayName(incomingDisplayName);
  if (normalizedIncoming === "Player") {
    return false;
  }

  if (!isGenericDisplayName(player.display_name)) {
    return false;
  }

  player.display_name = normalizedIncoming;
  return true;
}

export function createPlayer(
  world: WorldState,
  displayName?: string
): PlayerRecord {
  const id = "plr_" + randHex(6);
  const secret = randHex(24);

  const rec: PlayerRecord = {
    id,
    secret,
    display_name: normalizeDisplayName(displayName) || id,
  };

  world.players[id] = rec;
  return rec;
}

export function validatePlayer(
  world: WorldState,
  playerId: string,
  secret: string
): PlayerRecord | null {
  const rec = world.players[playerId];
  if (!rec) return null;
  if (rec.secret !== secret) return null;
  return rec;
}

export type ResolveHelloPlayerResult =
  | {
      ok: true;
      player: PlayerRecord;
      created: boolean;
      display_name_backfilled: boolean;
    }
  | {
      ok: false;
      reason: "auth_failed_invalid_credentials";
    };

export function resolveHelloPlayer(
  world: WorldState,
  playerId?: string,
  secret?: string,
  displayName?: string
): ResolveHelloPlayerResult {
  const hasStoredCredentials =
    typeof playerId === "string" &&
    playerId.length > 0 &&
    typeof secret === "string" &&
    secret.length > 0;

  if (hasStoredCredentials) {
    const player = validatePlayer(world, playerId as string, secret as string);
    if (!player) {
      // Do not silently create a brand-new identity here.
      // That makes reconnect problems look like “my username stopped working”
      // while actually swapping the player onto a different id and orphaning
      // their claimed plots.
      return { ok: false, reason: "auth_failed_invalid_credentials" };
    }

    const displayNameBackfilled =
      typeof displayName === "string" &&
      backfillLegacyPlayerDisplayName(player, displayName);

    return {
      ok: true,
      player,
      created: false,
      display_name_backfilled: Boolean(displayNameBackfilled),
    };
  }

  return {
    ok: true,
    player: createPlayer(world, displayName),
    created: true,
    display_name_backfilled: false,
  };
}