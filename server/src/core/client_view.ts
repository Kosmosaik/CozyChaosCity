import type {
  ClientPlot,
  ClientPlotDetail,
  ClientWorldState,
  Plot,
  PlotDetail,
  PlotJob,
  WorldState,
} from "../net/protocol";

import { DEV_METRICS } from "./dev_metrics";

function isClientVisibleJobStatus(status: PlotJob["status"]): boolean {
  return (
    status === "queued" ||
    status === "reserved" ||
    status === "in_progress" ||
    status === "blocked"
  );
}

function filterJobsForClient(jobs: PlotJob[]): PlotJob[] {
  // The client only needs active/relevant jobs for rendering and debug.
  // Completed/cancelled history can grow without bound during long sessions and
  // turns plot updates into large payloads for no gameplay value.
  return jobs.filter((job) => isClientVisibleJobStatus(job.status));
}

export function encodePlotDetailForClient(detail: PlotDetail): ClientPlotDetail {
  const cellByKey = new Map<string, PlotDetail["cells"][number]>();
  for (const cell of detail.cells) {
    cellByKey.set(`${cell.x},${cell.y}`, cell);
  }

  const cell_rows: string[] = [];
  for (let y = 0; y < detail.height; y++) {
    let row = "";
    for (let x = 0; x < detail.width; x++) {
      const cell = cellByKey.get(`${x},${y}`);
      row += cell?.terrain === "RUBBLE" ? "R" : "G";
    }
    cell_rows.push(row);
  }

  return {
    width: detail.width,
    height: detail.height,
    cell_rows,
    // Plot objects are the durable local-object DTO for logistics-era owned plots.
    plot_objects: detail.plot_objects,
    // The client should always receive an array here so UI/render code does not
    // need null/undefined branching once loose items start spawning.
    loose_items: detail.loose_items ?? [],
    npcs: detail.npcs ?? [],
    jobs: filterJobsForClient(detail.jobs ?? []),
    active_order: detail.active_order ?? null,
  };
}

export function buildClientPlot(
  world: WorldState,
  plot: Plot,
  viewerPlayerId: string | null
): ClientPlot {
  return DEV_METRICS.measure("build_client_plot_ms", () => {
    // Client plot DTO creation is on the hot path for both world snapshots and
    // incremental plot updates. Measuring it here tells us when filtering and
    // owned-detail encoding starts becoming expensive.
    const claimedBy = plot.claimed_by;
    const ownerRec = claimedBy ? world.players[claimedBy] : null;
    const includeDetail =
      viewerPlayerId !== null &&
      claimedBy === viewerPlayerId &&
      plot.detail !== undefined;

    return {
      id: plot.id,
      type: plot.type,
      x: plot.x,
      y: plot.y,
      claimed_by: plot.claimed_by,
      shell: plot.shell,
      detail:
        includeDetail && plot.detail
          ? encodePlotDetailForClient(plot.detail)
          : undefined,
      owner_display_name: ownerRec?.display_name ?? "",
    };
  });
}

export function buildClientWorld(
  world: WorldState,
  viewerPlayerId: string | null
): ClientWorldState {
  return DEV_METRICS.measure("build_client_world_ms", () => {
    // World snapshot building is broader than a single plot update, so we keep
    // a separate metric for the full snapshot cost as the world grows.
    return {
      version: world.version,
      plots: world.plots.map((plot) => buildClientPlot(world, plot, viewerPlayerId)),
    };
  });
}