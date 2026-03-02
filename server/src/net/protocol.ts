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
  claimed_by: string | null; // player_token
};

export type WorldState = {
  version: number;
  plots: Plot[];
};

export function makeMsg(type: string, payload?: any, req_id?: string) {
  return JSON.stringify({ v: 1, type, req_id, payload });
}