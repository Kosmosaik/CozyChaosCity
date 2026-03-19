import { z } from "zod";
import { CONFIG } from "../core/config";

export const EnvelopeSchema = z.object({
  v: z.number(),
  type: z.string(),
  req_id: z.string().optional(),
  payload: z.unknown().optional(),
});

export type Envelope = z.infer<typeof EnvelopeSchema>;

export type PlotType = "PLAYER" | "RESOURCE";
export type PlotShellKind = "EMPTY" | "RUINED" | "BASIC_CITY";
export type PlotDetailTerrain = "GROUND" | "RUBBLE";
export type PlotDetailStarterObjectKind = "SHACK" | "NPC_MARKER" | "RUBBLE_4X4";
export type PlotOrderKind = "SCAVENGING" | "SCAVENGING_SINGLE";
export type PlotOrderTargetScope = "ALL" | "SINGLE";
export type PlotNpcKind = "STARTER_WORKER";
export type PlotNpcJobType = "SCAVENGER" | "LABORER";

export type PlotNpcState =
  | "idle"
  | "moving_to_target"
  | "working"
  | "carrying_to_dropoff"
  | "dropping_off"
  | "returning";

export type PlotNpcCarryKind = "SCRAP";

export type PlotJobKind = "SCAVENGE_RUBBLE";
export type PlotJobStatus =
  | "queued"
  | "reserved"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "blocked";

export type PlotShell = {
  kind: PlotShellKind;
  variant: string;
  stage: number;
};

export type PlotDetailCell = {
  x: number;
  y: number;
  blocked: boolean;
  clearable: boolean;
  terrain: PlotDetailTerrain;
};

export type PlotDetailStarterObject = {
  id: string;
  kind: PlotDetailStarterObjectKind;
  x: number;
  y: number;
  footprint_w?: number;
  footprint_h?: number;
  clear_hits_remaining?: number;
};

export type PlotOrder = {
  kind: PlotOrderKind;
  target_scope: PlotOrderTargetScope;
  issued_at_ms: number;
};

export type PlotJob = {
  id: string;
  kind: PlotJobKind;
  source_order_kind: PlotOrderKind;
  source_target_scope: PlotOrderTargetScope;
  target_object_id: string;
  status: PlotJobStatus;
  assigned_npc_id: string | null;
  created_at_ms: number;
  updated_at_ms: number;
};

export type PlotDetailNpc = {
  id: string;
  kind: PlotNpcKind;
  name: string;
  job_type: PlotNpcJobType;
  current_activity: string;
  traits?: string[];
  allowed_order_kinds?: PlotOrderKind[];
  x: number;
  y: number;
  home_x: number;
  home_y: number;
  state: PlotNpcState;
  assigned_order?: PlotOrderKind | null;
  target_object_id?: string | null;
  move_to_x?: number | null;
  move_to_y?: number | null;
  state_started_at_ms?: number | null;
  state_ends_at_ms?: number | null;
  carrying_kind?: PlotNpcCarryKind | null;
};

export type PlotDetail = {
  width: number;
  height: number;
  cells: PlotDetailCell[];
  starter_objects: PlotDetailStarterObject[];
  npcs?: PlotDetailNpc[];
  jobs?: PlotJob[];
  active_order?: PlotOrder | null;
};

export type Plot = {
  id: string;
  type: PlotType;
  x: number;
  y: number;
  claimed_by: string | null;
  shell?: PlotShell;
  detail?: PlotDetail;
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

export type ClientPlotDetail = {
  width: number;
  height: number;
  cell_rows: string[];
  starter_objects: PlotDetailStarterObject[];
  npcs: PlotDetailNpc[];
  jobs: PlotJob[];
  active_order: PlotOrder | null;
};

export type ClientPlot = {
  id: string;
  type: PlotType;
  x: number;
  y: number;
  claimed_by: string | null;
  shell?: PlotShell;
  detail?: ClientPlotDetail;
  owner_display_name: string;
};

export type ClientWorldState = {
  version: number;
  plots: ClientPlot[];
};

export const HelloPayloadSchema = z
  .object({
    player_id: z.string().min(1).optional(),
    secret: z.string().min(1).optional(),
    display_name: z.string().min(1).max(32).optional(),
  })
  .superRefine((payload, ctx) => {
    const hasCreds =
      typeof payload.player_id === "string" &&
      typeof payload.secret === "string";
    const hasDisplayName = typeof payload.display_name === "string";

    if (!hasCreds && !hasDisplayName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "hello payload must include either {player_id, secret} or {display_name}",
      });
    }
  });

export const RequestWorldPayloadSchema = z.object({}).passthrough();

export const ClientPingPayloadSchema = z
  .object({
    client_ms: z.number().optional(),
  })
  .passthrough();

export const ClaimPlotPayloadSchema = z.object({
  plot_id: z.string().min(1),
});

export const ClearPlotObjectPayloadSchema = z.object({
  plot_id: z.string().min(1),
  object_id: z.string().min(1),
});

export const IssuePlotOrderPayloadSchema = z
  .object({
    plot_id: z.string().min(1),
    order_kind: z.enum(["SCAVENGING", "SCAVENGING_SINGLE"]),
    target_scope: z.enum(["ALL", "SINGLE"]),
  })
  .superRefine((payload, ctx) => {
    const isAllPair =
      payload.order_kind === "SCAVENGING" &&
      payload.target_scope === "ALL";

    const isSinglePair =
      payload.order_kind === "SCAVENGING_SINGLE" &&
      payload.target_scope === "SINGLE";

    if (!isAllPair && !isSinglePair) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "order_kind and target_scope do not form a valid order pair",
      });
    }
  });

export const CancelPlotOrderPayloadSchema = z.object({
  plot_id: z.string().min(1),
});

export const HelloMessageSchema = EnvelopeSchema.extend({
  type: z.literal("hello"),
  payload: HelloPayloadSchema,
});

export const RequestWorldMessageSchema = EnvelopeSchema.extend({
  type: z.literal("request_world"),
  payload: RequestWorldPayloadSchema.optional(),
});

export const ClientPingMessageSchema = EnvelopeSchema.extend({
  type: z.literal("client_ping"),
  payload: ClientPingPayloadSchema.optional(),
});

export const ClaimPlotMessageSchema = EnvelopeSchema.extend({
  type: z.literal("claim_plot"),
  payload: ClaimPlotPayloadSchema,
});

export const ClearPlotObjectMessageSchema = EnvelopeSchema.extend({
  type: z.literal("clear_plot_object"),
  payload: ClearPlotObjectPayloadSchema,
});

export const IssuePlotOrderMessageSchema = EnvelopeSchema.extend({
  type: z.literal("issue_plot_order"),
  payload: IssuePlotOrderPayloadSchema,
});

export const CancelPlotOrderMessageSchema = EnvelopeSchema.extend({
  type: z.literal("cancel_plot_order"),
  payload: CancelPlotOrderPayloadSchema,
});

export const ClientMessageSchema = z.discriminatedUnion("type", [
  HelloMessageSchema,
  RequestWorldMessageSchema,
  ClientPingMessageSchema,
  ClaimPlotMessageSchema,
  ClearPlotObjectMessageSchema,
  IssuePlotOrderMessageSchema,
  CancelPlotOrderMessageSchema,
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;

export function makeMsg<TPayload = unknown>(
  type: string,
  payload?: TPayload,
  req_id?: string
) {
  return JSON.stringify({ v: CONFIG.protocolVersion, type, req_id, payload });
}