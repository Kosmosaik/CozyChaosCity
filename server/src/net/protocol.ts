import { z } from "zod";
import { CONFIG } from "../core/config";

export const EnvelopeSchema = z.object({
  v: z.number(),
  type: z.string(),
  req_id: z.string().optional(),
  payload: z.any().optional(),
});

export type Envelope = z.infer<typeof EnvelopeSchema>;

export type PlotType = "PLAYER" | "RESOURCE";

export type Plot = {
  /**
   * Stable unique id. For M0.5 we derive it from coordinates: T_<x>_<y>
   */
  id: string;

  type: PlotType;

  /**
   * Grid coordinate (integer)
   */
  x: number;
  y: number;

  /**
   * player_id of the owner, or null if unclaimed.
   * (RESOURCE plots should remain unclaimable; claimed_by should stay null.)
   */
  claimed_by: string | null;
};

export type PlayerRecord = {
  id: string;
  secret: string;
  display_name: string;
};

export type WorldState = {
  version: number;
  plots: Plot[];
  players: Record<string, PlayerRecord>;
};

export function makeMsg(type: string, payload?: any, req_id?: string) {
  // Server always responds using its protocol version.
  return JSON.stringify({ v: CONFIG.protocolVersion, type, req_id, payload });
}