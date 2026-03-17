import type {
  ClientPlot,
  ClientPlotDetail,
  ClientWorldState,
  Plot,
  PlotDetail,
  WorldState,
} from "../net/protocol";

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
    starter_objects: detail.starter_objects,
    npcs: detail.npcs ?? [],
    jobs: detail.jobs ?? [],
    active_order: detail.active_order ?? null,
  };
}

export function buildClientPlot(
  world: WorldState,
  plot: Plot,
  viewerPlayerId: string | null
): ClientPlot {
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
    detail: includeDetail && plot.detail
      ? encodePlotDetailForClient(plot.detail)
      : undefined,
    owner_display_name: ownerRec?.display_name ?? "",
  };
}

export function buildClientWorld(
  world: WorldState,
  viewerPlayerId: string | null
): ClientWorldState {
  return {
    version: world.version,
    plots: world.plots.map((plot) => buildClientPlot(world, plot, viewerPlayerId)),
  };
}