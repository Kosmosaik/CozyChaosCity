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