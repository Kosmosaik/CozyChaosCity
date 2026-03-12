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

export type PlotShellKind = "EMPTY" | "RUINED" | "BASIC_CITY";

export type PlotShell = {
  /**
   * High-level public-facing shell/exterior summary for this plot.
   * Intended for World Map mode and reduced-detail neighboring plot rendering.
   */
  kind: PlotShellKind;

  /**
   * Free-form variant token so we can swap placeholder shell looks later
   * without changing the overall data shape.
   */
  variant: string;

  /**
   * Simple progression/stage number for shell growth over time.
   * M2 starts at 0 and can expand this later.
   */
  stage: number;
};

export type PlotDetailTerrain = "GROUND" | "RUBBLE";

export type PlotDetailCell = {
  /**
   * Local coordinate inside the owned plot detail grid.
   */
  x: number;
  y: number;

  /**
   * Whether this cell is currently blocked for basic use/building.
   */
  blocked: boolean;

  /**
   * Whether this cell can be cleared through gameplay later.
   * For now this is mainly intended for rubble cells.
   */
  clearable: boolean;

  /**
   * Very early placeholder terrain classification for M2 starter-state data.
   */
  terrain: PlotDetailTerrain;
};

export type PlotDetailStarterObjectKind = "SHACK" | "NPC_MARKER" | "RUBBLE_4X4";

export type PlotDetailStarterObject = {
  /**
   * Stable local object id inside the plot detail model.
   */
  id: string;

  /**
   * Very early placeholder starter object kind.
   */
  kind: PlotDetailStarterObjectKind;

  /**
   * Local top-left coordinate inside the detail grid.
   *
   * Important:
   * - x/y are no longer treated as "center of one cell"
   * - x/y define the top-left anchor of the object's footprint
   */
  x: number;
  y: number;

  /**
   * Optional footprint size in local cells/meters.
   * Defaults to 1x1 when omitted.
   *
   * This lets us represent:
   * - a 4x4 shack
   * - later larger buildings
   * - while keeping NPC markers or tiny props at 1x1
   */
  footprint_w?: number;
  footprint_h?: number;
};

export type PlotDetail = {
  /**
   * Local owned-plot width in cells.
   */
  width: number;

  /**
   * Local owned-plot height in cells.
   */
  height: number;

  /**
   * Per-cell starter-state data for the owned plot.
   */
  cells: PlotDetailCell[];

  /**
   * Placeholder starter objects such as shack and starter NPC marker.
   */
  starter_objects: PlotDetailStarterObject[];
};

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

  /**
   * Public-facing shell/exterior summary.
   * Optional for backward compatibility with older saves until normalization runs.
   */
  shell?: PlotShell;

  /**
   * Richer owned-plot/local detail data used for Player Plot mode later.
   * Optional because not every plot needs detail loaded/generated immediately.
   */
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

export function makeMsg(type: string, payload?: any, req_id?: string) {
  // Server always responds using its protocol version.
  return JSON.stringify({ v: CONFIG.protocolVersion, type, req_id, payload });
}