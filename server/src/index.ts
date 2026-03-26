import { WebSocketServer } from "ws";
import { CONFIG } from "./core/config";
import { DEV_METRICS } from "./core/dev_metrics";

import {
  ClientMessageSchema,
  makeMsg,
  ServerPongPayload,
  TimedPlotUpdatePayload,
  TimedWorldPatchPayload,
  TimedWorldStatePayload,
  WorldState,
} from "./net/protocol";

import {
  applyClearActionToPlotObject,
  countFreePlayerPlots,
  ensureClaimedPlayerPlotInitialized,
  expandWorld,
  newWorld,
  normalizeWorldForM0_5,
  releaseManufacturingInputBufferToGround,
} from "./core/world";

import { resolveHelloPlayer } from "./core/players";

import { getOnlinePlayers } from "./core/presence";

import {
  cancelActivePlotOrder,
  issueScavengingOrder,
  pruneStaleTerminalJobs,
  tickNpcSimulation,
  wakeIdleNpcsForAvailableWork,
} from "./core/npc";

import { syncLooseItemHaulJobs } from "./core/hauling";

import {
  clearManufacturingQueue,
  queueManufacturingRecipe,
} from "./core/manufacturing";
import { JsonWorldRepository } from "./storage/persist";
import { buildClientPlot, buildClientWorld } from "./core/client_view";

type ConnState = {
  player_id: string | null;
  lastSeen: number;

  connection_id: string;
  hello_display_name: string;

  last_message_type: string;
  last_message_at_ms: number;
  last_inbound_bytes: number;

  last_outbound_message_type: string;
  last_outbound_bytes: number;
  last_outbound_at_ms: number;

  disconnect_reason: string | null;
  timeout_close_requested_at_ms: number | null;
};

const repo = new JsonWorldRepository(CONFIG.persistPath, CONFIG.saveDebounceMs);
const wss = new WebSocketServer({ port: CONFIG.port });
const world: WorldState = repo.load() ?? newWorld();

const norm = normalizeWorldForM0_5(world);
if (norm.changed) {
  console.log(`[world] normalized: ${norm.reason ?? "changed"}`);
  repo.queueSave(world);
}

const startupMaintenanceNowMs = Date.now();
let startupPrunedPlots = 0;

for (const plot of world.plots) {
  if (pruneStaleTerminalJobs(plot, startupMaintenanceNowMs)) {
    startupPrunedPlots += 1;
  }
}

if (startupPrunedPlots > 0) {
  console.log(
    `[world] pruned stale terminal jobs on ${startupPrunedPlots} claimed plot(s)`
  );
  repo.queueSave(world);
}

const conns = new Map<any, ConnState>();

const LARGE_OUTBOUND_MESSAGE_WARNING_BYTES = 48 * 1024;

let nextConnectionSerial = 1;

function makeConnectionId(): string {
  const serial = nextConnectionSerial;
  nextConnectionSerial += 1;
  return `conn_${serial}`;
}

function summarizeOwnedPlotForPlayer(playerId: string | null): string {
  if (!playerId) {
    return "no_player";
  }

  const ownedPlot = world.plots.find((plot) => plot.claimed_by === playerId);
  if (!ownedPlot?.detail) {
    return "no_owned_plot";
  }

  const detail = ownedPlot.detail;
  const totalJobs = Array.isArray(detail.jobs) ? detail.jobs.length : 0;
  const activeJobs = Array.isArray(detail.jobs)
    ? detail.jobs.filter((job) => {
        return (
          job.status === "queued" ||
          job.status === "reserved" ||
          job.status === "in_progress" ||
          job.status === "blocked"
        );
      }).length
    : 0;
  const looseItemCount = Array.isArray(detail.loose_items)
    ? detail.loose_items.length
    : 0;
  const npcCount = Array.isArray(detail.npcs) ? detail.npcs.length : 0;
  const plotObjectCount = Array.isArray(detail.plot_objects)
    ? detail.plot_objects.length
    : 0;

  return [
    `plot=${ownedPlot.id}`,
    `jobs=${totalJobs}`,
    `active_jobs=${activeJobs}`,
    `loose_items=${looseItemCount}`,
    `npcs=${npcCount}`,
    `objects=${plotObjectCount}`,
  ].join(" ");
}

function recordOutboundMessage(
  ws: any,
  messageType: string,
  payloadText: string
): void {
  const st = conns.get(ws);
  if (!st) {
    return;
  }

  st.last_outbound_message_type = messageType;
  st.last_outbound_bytes = Buffer.byteLength(payloadText, "utf-8");
  st.last_outbound_at_ms = Date.now();

  if (st.last_outbound_bytes >= LARGE_OUTBOUND_MESSAGE_WARNING_BYTES) {
    console.warn(
      "[ws] large outbound message",
      [
        `conn=${st.connection_id}`,
        `player=${st.player_id ?? "anonymous"}`,
        `type=${messageType}`,
        `bytes=${st.last_outbound_bytes}`,
        summarizeOwnedPlotForPlayer(st.player_id),
      ].join(" ")
    );
  }
}

process.on("uncaughtExceptionMonitor", (error, origin) => {
  console.error("[fatal] uncaughtException:", origin, error);
});

process.on("unhandledRejection", (reason) => {
  console.error("[fatal] unhandledRejection:", reason);
});

function queueSave() {
  repo.queueSave(world);
}

function broadcast(msg: string) {
  for (const ws of wss.clients) {
    if (ws.readyState === ws.OPEN) ws.send(msg);
  }
}

function warnIfLargeOutboundMessage(
  messageType: string,
  messageText: string,
  playerId: string | null,
  plotId: string | null = null
): void {
  const bytes = Buffer.byteLength(messageText, "utf-8");
  if (bytes < LARGE_OUTBOUND_MESSAGE_WARNING_BYTES) {
    return;
  }

  console.warn(
    "[ws] large outbound message",
    [
      `type=${messageType}`,
      `bytes=${bytes}`,
      `player=${playerId ?? "anonymous"}`,
      plotId != null ? `plot=${plotId}` : null,
    ]
      .filter((part) => part != null)
      .join(" ")
  );
}

function sendWorld(ws: any) {
  const st = conns.get(ws);
  const viewerPlayerId = st?.player_id ?? null;
  const payload: TimedWorldStatePayload = {
    world: buildClientWorld(world, viewerPlayerId),
    server_time_ms: Date.now(),
  };

  const message = makeMsg("world_state", payload);
  warnIfLargeOutboundMessage("world_state", message, viewerPlayerId);

  // Every world snapshot carries the server time it was authored at.
  // The client can then estimate current server time without trusting the
  // player's machine wall clock.
  ws.send(message);
}

function sendPresenceState(ws: any) {
  ws.send(makeMsg("presence_state", { online: getOnlinePlayers(conns, world) }));
}

function broadcastPresenceState() {
  broadcast(makeMsg("presence_state", { online: getOnlinePlayers(conns, world) }));
}

function broadcastPlotUpdate(plot: WorldState["plots"][number]) {
  const serverTimeMs = Date.now();

  for (const client of wss.clients) {
    if (client.readyState !== client.OPEN) continue;

    const clientState = conns.get(client);
    const plotForClient = buildClientPlot(world, plot, clientState?.player_id ?? null);

    const payload: TimedPlotUpdatePayload = {
      plot: plotForClient,
      owner_display_name: plotForClient.owner_display_name,
      server_time_ms: serverTimeMs,
    };

    // Reuse one timestamp for the whole broadcast so all clients receive the
    // same authoritative snapshot time for this update.
    const message = makeMsg("plot_update", payload);
    warnIfLargeOutboundMessage(
      "plot_update",
      message,
      clientState?.player_id ?? null,
      plot.id
    );

    client.send(message);
  }
}

function handleHello(ws: any, st: ConnState, msg: any) {
  const pid = msg.payload?.player_id;
  const sec = msg.payload?.secret;
  const displayName = msg.payload?.display_name;

  st.hello_display_name =
    typeof displayName === "string" ? displayName : "";

  const result = resolveHelloPlayer(
    world,
    typeof pid === "string" ? pid : undefined,
    typeof sec === "string" ? sec : undefined,
    typeof displayName === "string" ? displayName : undefined
  );

  if (!result.ok) {
    console.warn(
      "[auth] hello rejected",
      [
        `conn=${st.connection_id}`,
        `display=${st.hello_display_name || "unknown"}`,
        `player_id=${typeof pid === "string" ? pid : "none"}`,
        `reason=${result.reason}`,
      ].join(" ")
    );

    ws.send(
      makeMsg(
        "error",
        { reason: result.reason },
        msg.req_id
      )
    );

    try {
      ws.close(4001, "Authentication failed");
    } catch (error) {
      console.warn("[ws] close after auth failure failed:", error);
    }
    return;
  }

  const player = result.player;
  if (result.created || result.display_name_backfilled) {
    queueSave();
  }

  st.player_id = player.id;

  console.log(
    "[auth] hello accepted",
    [
      `conn=${st.connection_id}`,
      `player=${player.id}`,
      `display=${player.display_name}`,
      `created=${result.created}`,
      `backfilled=${result.display_name_backfilled}`,
    ].join(" ")
  );

  ws.send(
    makeMsg(
      "welcome",
      {
        player_id: player.id,
        secret: player.secret,
        display_name: player.display_name,
      },
      msg.req_id
    )
  );

  sendWorld(ws);
  sendPresenceState(ws);
  broadcastPresenceState();
}

function handleClaimPlot(ws: any, st: ConnState, msg: any) {
  const plotId = msg.payload.plot_id;
  const plot = world.plots.find((p) => p.id === plotId);

  if (!plot) {
    ws.send(makeMsg("claim_result", { ok: false, reason: "plot_not_found" }, msg.req_id));
    return;
  }

  if (plot.type !== "PLAYER") {
    ws.send(makeMsg("claim_result", { ok: false, reason: "not_claimable" }, msg.req_id));
    return;
  }

  if (plot.claimed_by) {
    ws.send(makeMsg("claim_result", { ok: false, reason: "already_claimed" }, msg.req_id));
    return;
  }

  plot.claimed_by = st.player_id;
  ensureClaimedPlayerPlotInitialized(plot);

  world.version += 1;
  queueSave();

  broadcastPlotUpdate(plot);
  ws.send(makeMsg("claim_result", { ok: true, plot_id: plotId }, msg.req_id));

  if (countFreePlayerPlots(world) < CONFIG.expandWhenFreePlotsBelow) {
    const { added } = expandWorld(world);
    if (added.length > 0) {
      queueSave();

      for (const client of wss.clients) {
        if (client.readyState !== client.OPEN) continue;
        const clientState = conns.get(client);

        const payload: TimedWorldPatchPayload = {
          added: added.map((plot) =>
            buildClientPlot(world, plot, clientState?.player_id ?? null)
          ),
          world_version: world.version,
          server_time_ms: Date.now(),
        };

        client.send(makeMsg("world_patch", payload));
      }
    }
  }
}

function handleClearPlotObject(ws: any, st: ConnState, msg: any) {
  const { plot_id: plotId, object_id: objectId } = msg.payload;
  const plot = world.plots.find((p) => p.id === plotId);

  if (!plot) {
    ws.send(
      makeMsg("clear_plot_object_result", { ok: false, reason: "plot_not_found" }, msg.req_id)
    );
    return;
  }

  if (plot.type !== "PLAYER") {
    ws.send(
      makeMsg("clear_plot_object_result", { ok: false, reason: "not_player_plot" }, msg.req_id)
    );
    return;
  }

  if (plot.claimed_by !== st.player_id) {
    ws.send(
      makeMsg("clear_plot_object_result", { ok: false, reason: "not_plot_owner" }, msg.req_id)
    );
    return;
  }

  const nowMs = Date.now();
  const action = applyClearActionToPlotObject(plot, objectId, nowMs);
  if (!action.changed) {
    ws.send(
      makeMsg(
        "clear_plot_object_result",
        { ok: false, reason: "object_not_clearable" },
        msg.req_id
      )
    );
    return;
  }

  // Manual clear creates real loose items, so refresh hauling immediately and
  // wake idle workers right away instead of waiting for a later unrelated tick.
  syncLooseItemHaulJobs(plot, nowMs);
  wakeIdleNpcsForAvailableWork(plot, nowMs);

  world.version += 1;
  queueSave();

  broadcastPlotUpdate(plot);

  ws.send(
    makeMsg(
      "clear_plot_object_result",
      {
        ok: true,
        plot_id: plotId,
        object_id: objectId,
        cleared: action.cleared,
        hits_remaining: action.hitsRemaining,
      },
      msg.req_id
    )
  );
}

function handleIssuePlotOrder(ws: any, st: ConnState, msg: any) {
  const {
    plot_id: plotId,
    order_kind: orderKind,
    target_scope: targetScope,
  } = msg.payload;
  const plot = world.plots.find((p) => p.id === plotId);

  if (!plot) {
    ws.send(
      makeMsg("issue_plot_order_result", { ok: false, reason: "plot_not_found" }, msg.req_id)
    );
    return;
  }

  if (plot.type !== "PLAYER") {
    ws.send(
      makeMsg("issue_plot_order_result", { ok: false, reason: "not_player_plot" }, msg.req_id)
    );
    return;
  }

  if (plot.claimed_by !== st.player_id) {
    ws.send(
      makeMsg("issue_plot_order_result", { ok: false, reason: "not_plot_owner" }, msg.req_id)
    );
    return;
  }

  const result = issueScavengingOrder(plot, Date.now(), orderKind, targetScope);
  if (!result.ok) {
    ws.send(
      makeMsg(
        "issue_plot_order_result",
        { ok: false, reason: result.reason ?? "order_rejected" },
        msg.req_id
      )
    );
    return;
  }

  world.version += 1;
  queueSave();

  broadcastPlotUpdate(plot);

  ws.send(
    makeMsg(
      "issue_plot_order_result",
      {
        ok: true,
        plot_id: plotId,
        order_kind: orderKind,
        target_scope: targetScope,
      },
      msg.req_id
    )
  );
}

function handleQueueManufacturingRecipe(ws: any, st: ConnState, msg: any) {
  const {
    plot_id: plotId,
    station_object_id: stationObjectId,
    recipe_id: recipeId,
    quantity,
  } = msg.payload;
  const plot = world.plots.find((p) => p.id === plotId);

  if (!plot) {
    ws.send(
      makeMsg(
        "queue_manufacturing_recipe_result",
        { ok: false, reason: "plot_not_found" },
        msg.req_id
      )
    );
    return;
  }

  if (plot.type !== "PLAYER") {
    ws.send(
      makeMsg(
        "queue_manufacturing_recipe_result",
        { ok: false, reason: "not_player_plot" },
        msg.req_id
      )
    );
    return;
  }

  if (plot.claimed_by !== st.player_id) {
    ws.send(
      makeMsg(
        "queue_manufacturing_recipe_result",
        { ok: false, reason: "not_plot_owner" },
        msg.req_id
      )
    );
    return;
  }

  const nowMs = Date.now();
  const result = queueManufacturingRecipe(
    plot,
    stationObjectId,
    recipeId,
    quantity,
    nowMs
  );
  if (!result.ok) {
    ws.send(
      makeMsg(
        "queue_manufacturing_recipe_result",
        { ok: false, reason: result.reason ?? "manufacturing_rejected" },
        msg.req_id
      )
    );
    return;
  }

  // Queueing new work can immediately create better haul destinations for
  // already-existing loose items, so refresh jobs and wake idle workers now.
  syncLooseItemHaulJobs(plot, nowMs);
  wakeIdleNpcsForAvailableWork(plot, nowMs);

  world.version += 1;
  queueSave();

  broadcastPlotUpdate(plot);

  ws.send(
    makeMsg(
      "queue_manufacturing_recipe_result",
      {
        ok: true,
        plot_id: plotId,
        station_object_id: stationObjectId,
        recipe_id: recipeId,
        queued_quantity: result.queued_quantity ?? quantity,
        queue_entry_count: result.queue_entry_count ?? 0,
      },
      msg.req_id
    )
  );
}

function handleClearManufacturingQueue(ws: any, st: ConnState, msg: any) {
  const { plot_id: plotId, station_object_id: stationObjectId } = msg.payload;
  const plot = world.plots.find((p) => p.id === plotId);

  if (!plot) {
    ws.send(
      makeMsg(
        "clear_manufacturing_queue_result",
        { ok: false, reason: "plot_not_found" },
        msg.req_id
      )
    );
    return;
  }

  if (plot.type !== "PLAYER") {
    ws.send(
      makeMsg(
        "clear_manufacturing_queue_result",
        { ok: false, reason: "not_player_plot" },
        msg.req_id
      )
    );
    return;
  }

  if (plot.claimed_by !== st.player_id) {
    ws.send(
      makeMsg(
        "clear_manufacturing_queue_result",
        { ok: false, reason: "not_plot_owner" },
        msg.req_id
      )
    );
    return;
  }

  const result = clearManufacturingQueue(plot, stationObjectId);
  if (!result.ok) {
    ws.send(
      makeMsg(
        "clear_manufacturing_queue_result",
        { ok: false, reason: result.reason ?? "manufacturing_rejected" },
        msg.req_id
      )
    );
    return;
  }

  const nowMs = Date.now();
  const releaseResult = releaseManufacturingInputBufferToGround(
    plot,
    stationObjectId,
    nowMs
  );

  // Clearing the queue can both:
  // - release buffered inputs back to the ground
  // - reroute any still-pending manufacturing haul jobs back to dump-zone flow
  // So always refresh jobs, then wake idle haulers immediately.
  syncLooseItemHaulJobs(plot, nowMs);
  wakeIdleNpcsForAvailableWork(plot, nowMs);

  world.version += 1;
  queueSave();

  broadcastPlotUpdate(plot);

  ws.send(
    makeMsg(
      "clear_manufacturing_queue_result",
      {
        ok: true,
        plot_id: plotId,
        station_object_id: stationObjectId,
        cleared_entry_count: result.cleared_entry_count ?? 0,
        cleared_quantity: result.cleared_quantity ?? 0,
        released_quantity: releaseResult.released_quantity,
      },
      msg.req_id
    )
  );
}

function handleCancelPlotOrder(ws: any, st: ConnState, msg: any) {
  const { plot_id: plotId } = msg.payload;
  const plot = world.plots.find((p) => p.id === plotId);

  if (!plot) {
    ws.send(
      makeMsg("cancel_plot_order_result", { ok: false, reason: "plot_not_found" }, msg.req_id)
    );
    return;
  }

  if (plot.type !== "PLAYER") {
    ws.send(
      makeMsg("cancel_plot_order_result", { ok: false, reason: "not_player_plot" }, msg.req_id)
    );
    return;
  }

  if (plot.claimed_by !== st.player_id) {
    ws.send(
      makeMsg("cancel_plot_order_result", { ok: false, reason: "not_plot_owner" }, msg.req_id)
    );
    return;
  }

  const result = cancelActivePlotOrder(plot);
  if (!result.ok) {
    ws.send(
      makeMsg(
        "cancel_plot_order_result",
        { ok: false, reason: result.reason ?? "order_rejected" },
        msg.req_id
      )
    );
    return;
  }

  world.version += 1;
  queueSave();

  broadcastPlotUpdate(plot);

  ws.send(
    makeMsg(
      "cancel_plot_order_result",
      {
        ok: true,
        plot_id: plotId,
        cancelled_order_kind: result.cancelled_order_kind,
        cancelled_target_scope: result.cancelled_target_scope,
      },
      msg.req_id
    )
  );
}

wss.on("connection", (ws) => {
  const connectionId = makeConnectionId();

  conns.set(ws, {
    player_id: null,
    lastSeen: Date.now(),

    connection_id: connectionId,
    hello_display_name: "",

    last_message_type: "none",
    last_message_at_ms: 0,
    last_inbound_bytes: 0,

    last_outbound_message_type: "none",
    last_outbound_bytes: 0,
    last_outbound_at_ms: 0,

    disconnect_reason: null,
    timeout_close_requested_at_ms: null,
  });

  console.log(`[ws] connection opened conn=${connectionId}`);

  ws.on("error", (error) => {
    const st = conns.get(ws);
    console.warn(
      "[ws] client socket error:",
      st?.connection_id ?? "unknown_conn",
      error
    );
  });

  ws.on("message", (data) => {
    const st = conns.get(ws);
    if (!st) return;

    const receivedAtMs = Date.now();
    st.lastSeen = receivedAtMs;
    st.timeout_close_requested_at_ms = null;
    st.disconnect_reason = null;

    if (typeof data !== "string" && !(data instanceof Buffer)) return;

    const raw = data.toString("utf-8");
    st.last_inbound_bytes = Buffer.byteLength(raw, "utf-8");
    st.last_message_at_ms = receivedAtMs;

    if (raw.length > CONFIG.maxMessageBytes) {
      console.warn(
        "[ws] inbound too large",
        [
          `conn=${st.connection_id}`,
          `bytes=${st.last_inbound_bytes}`,
        ].join(" ")
      );
      ws.close(1009, "Message too large");
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      console.warn(
        "[ws] json parse failed",
        [
          `conn=${st.connection_id}`,
          `bytes=${st.last_inbound_bytes}`,
        ].join(" "),
        error
      );
      return;
    }

    const messageResult = ClientMessageSchema.safeParse(parsed);
    if (!messageResult.success) {
      console.warn(
        "[ws] schema validation failed",
        [
          `conn=${st.connection_id}`,
          `bytes=${st.last_inbound_bytes}`,
        ].join(" ")
      );
      return;
    }

    const msg = messageResult.data;
    st.last_message_type = msg.type;

    if (msg.v !== CONFIG.protocolVersion) {
      ws.send(makeMsg("error", { reason: "protocol_version_mismatch" }, msg.req_id));
      return;
    }

    if (msg.type === "hello") {
      handleHello(ws, st, msg);
      return;
    }

    if (!st.player_id) {
      ws.send(makeMsg("error", { reason: "not_helloed" }, msg.req_id));
      return;
    }

    switch (msg.type) {
      case "request_world":
        sendWorld(ws);
        return;

      case "client_ping": {
        const payload: ServerPongPayload = {
          server_time_ms: Date.now(),
        };

        // We are not using this pong timestamp yet for global clock sync,
        // but sending it now keeps the protocol ready for that future step.
        const message = makeMsg("server_pong", payload, msg.req_id);
        recordOutboundMessage(ws, "server_pong", message);
        ws.send(message);
        return;
      }

      case "claim_plot":
        handleClaimPlot(ws, st, msg);
        return;

      case "clear_plot_object":
        handleClearPlotObject(ws, st, msg);
        return;

      case "issue_plot_order":
        handleIssuePlotOrder(ws, st, msg);
        return;

      case "cancel_plot_order":
        handleCancelPlotOrder(ws, st, msg);
        return;

      case "queue_manufacturing_recipe":
        handleQueueManufacturingRecipe(ws, st, msg);
        return;

      case "clear_manufacturing_queue":
        handleClearManufacturingQueue(ws, st, msg);
        return;
    }
  });

  ws.on("close", (code, reasonBuffer) => {
    const st = conns.get(ws);
    const reasonText =
      Buffer.isBuffer(reasonBuffer)
        ? reasonBuffer.toString("utf-8")
        : String(reasonBuffer ?? "");

    console.warn(
      "[ws] connection closed",
      [
        `conn=${st?.connection_id ?? connectionId}`,
        `player=${st?.player_id ?? "anonymous"}`,
        `display=${st?.hello_display_name || "unknown"}`,
        `code=${code}`,
        `reason=${reasonText || st?.disconnect_reason || "none"}`,
        `last_msg=${st?.last_message_type ?? "none"}`,
        `last_inbound_bytes=${st?.last_inbound_bytes ?? 0}`,
        `last_outbound=${st?.last_outbound_message_type ?? "none"}`,
        `last_outbound_bytes=${st?.last_outbound_bytes ?? 0}`,
        summarizeOwnedPlotForPlayer(st?.player_id ?? null),
      ].join(" ")
    );

    conns.delete(ws);
    broadcastPresenceState();
  });
});

const NPC_TICK_INTERVAL_MS = 250;

// Main authoritative NPC simulation loop.
// This advances worker movement/state on the server and broadcasts only the
// plots that actually changed during the tick.
setInterval(() => {
  const nowMs = Date.now();

  const changedPlots = DEV_METRICS.measure("npc_simulation_ms", () =>
    tickNpcSimulation(world, nowMs)
  );

  DEV_METRICS.measure("npc_tick_loop_ms", () => {
    if (changedPlots.length <= 0) {
      return;
    }

    world.version += 1;
    queueSave();

    for (const plot of changedPlots) {
      broadcastPlotUpdate(plot);
    }
  });

  DEV_METRICS.maybeReport(nowMs);
}, NPC_TICK_INTERVAL_MS);

// Connection timeout / heartbeat loop.
// This stays separate from NPC simulation so a websocket diagnostics change can
// never accidentally disable gameplay progression again.
setInterval(() => {
  const now = Date.now();

  for (const [ws, st] of conns.entries()) {
    const silenceMs = now - st.lastSeen;

    if (silenceMs > CONFIG.clientTimeoutMs) {
      if (st.timeout_close_requested_at_ms === null) {
        st.disconnect_reason = "heartbeat_timeout";
        st.timeout_close_requested_at_ms = now;

        console.warn(
          "[ws] heartbeat timeout",
          [
            `conn=${st.connection_id}`,
            `player=${st.player_id ?? "anonymous"}`,
            `display=${st.hello_display_name || "unknown"}`,
            `silence_ms=${silenceMs}`,
            `last_msg=${st.last_message_type}`,
            `last_inbound_bytes=${st.last_inbound_bytes}`,
            `last_outbound=${st.last_outbound_message_type}`,
            `last_outbound_bytes=${st.last_outbound_bytes}`,
            summarizeOwnedPlotForPlayer(st.player_id),
          ].join(" ")
        );

        try {
          ws.close(4000, "heartbeat_timeout");
        } catch (err) {
          console.warn("[ws] close after heartbeat timeout failed:", err);
          try {
            ws.terminate();
          } catch (terminateError) {
            console.warn("[ws] terminate after close failure failed:", terminateError);
          }
        }

        continue;
      }

      // If the close handshake itself gets stuck, finish the cleanup forcibly.
      if (now - st.timeout_close_requested_at_ms > 5_000) {
        console.warn(
          "[ws] timeout close handshake stuck, terminating",
          [
            `conn=${st.connection_id}`,
            `player=${st.player_id ?? "anonymous"}`,
            `silence_ms=${silenceMs}`,
          ].join(" ")
        );

        try {
          ws.terminate();
        } catch (err) {
          console.warn("[ws] terminate failed:", err);
        }

        conns.delete(ws);
        continue;
      }

      continue;
    }

    try {
      ws.ping();
    } catch (err) {
      console.warn("[ws] ping failed:", err);
    }
  }
}, CONFIG.pingIntervalMs);

console.log(`Server listening on ws://0.0.0.0:${CONFIG.port}`);