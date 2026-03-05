import crypto from "crypto";
import type { WorldState, PlayerRecord } from "../net/protocol";

/**
 * Create random hex string of N bytes.
 * Example: 6 bytes -> 12 hex chars.
 */
function randHex(bytes: number): string {
  return crypto.randomBytes(bytes).toString("hex");
}

/**
 * Creates a new server-issued identity and stores it in the world state.
 * This is NOT a password account system; it's a simple persistent identity.
 */
export function createPlayer(world: WorldState, displayName?: string): PlayerRecord {
  const id = "plr_" + randHex(6);       // short-ish stable id
  const secret = randHex(24);           // longer secret (auth key)
  const rec: PlayerRecord = {
    id,
    secret,
    display_name: (displayName && displayName.trim().length > 0) ? displayName.trim() : id,
  };

  world.players[id] = rec;
  return rec;
}

/**
 * Validates credentials. Returns PlayerRecord if valid, else null.
 */
export function validatePlayer(world: WorldState, playerId: string, secret: string): PlayerRecord | null {
  const rec = world.players[playerId];
  if (!rec) return null;
  if (rec.secret !== secret) return null;
  return rec;
}