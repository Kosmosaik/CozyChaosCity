import { z } from "zod";

export const EnvelopeSchema = z.object({
  v: z.number(),
  type: z.string(),
  req_id: z.string().optional(),
  payload: z.any().optional(),
});

export type Envelope = z.infer<typeof EnvelopeSchema>;

export type PlotType = "PLAYER" | "RES_SHARED";

export type Plot = {
  id: string;
  type: PlotType;
  claimed_by: string | null; // player_id
};

export type PlayerRecord = {
  /**
   * Server-issued stable player id.
   * Used for plot ownership and "MINE" checks.
   */
  id: string;

  /**
   * Secret auth key for this player id.
   * Client must present this to prove they are the same player.
   */
  secret: string;

  /**
   * Human-readable name (username/profile name).
   * This can change later without breaking ownership.
   */
  display_name: string;
};

export type WorldState = {
  version: number;
  plots: Plot[];

  /**
   * All known players (persisted in world_state.json).
   * Key = player_id
   */
  players: Record<string, PlayerRecord>;
};

export function makeMsg(type: string, payload?: any, req_id?: string) {
  return JSON.stringify({ v: 1, type, req_id, payload });
}