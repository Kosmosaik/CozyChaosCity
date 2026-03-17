import { WebSocketServer } from "ws";
import { CONFIG } from "./core/config";
import {
  ClientMessageSchema,
  makeMsg,
  WorldState,
} from "./net/protocol";
import {
  applyClearActionToPlotObject,
  countFreePlayerPlots,
  ensureClaimedPlayerPlotInitialized,
  expandWorld,
  newWorld,
  normalizeWorldForM0_5,
} from "./core/world";
import {
  backfillLegacyPlayerDisplayName,
  createPlayer,
  validatePlayer,
} from "./core/players";
import { getOnlinePlayers } from "./core/presence";
import { issueScavengingOrder, tickNpcSimulation } from "./core/npc";
import { JsonWorldRepository } from "./storage/persist";
import { buildClientPlot, buildClientWorld } from "./core/client_view";

type ConnState = {
  player_id: string | null;
  lastSeen: number;
};

const repo = new JsonWorldRepository(CONFIG.persistPath, CONFIG.saveDebounceMs);
const wss = new WebSocketServer({ port: CONFIG.port });
const world: WorldState = repo.load() ?? newWorld();

const norm = normalizeWorldForM0_5(world);
if (norm.changed) {
  console.log(`[world] normalized: ${norm.reason ?? "changed"}`);
  repo.queueSave(world);
}

const conns = new Map<any, ConnState>();

function queueSave() {
  repo.queueSave(world);
}

function broadcast(msg: string) {
  for (const ws of wss.clients) {
    if (ws.readyState === ws.OPEN) ws.send(msg);
  }
}

function sendWorld(ws: any) {
  const st = conns.get(ws);
  const viewerPlayerId = st?.player_id ?? null;
  ws.send(makeMsg("world_state", { world: buildClientWorld(world, viewerPlayerId) }));
}

function sendPresenceState(ws: any) {
  ws.send(makeMsg("presence_state", { online: getOnlinePlayers(conns, world) }));
}

function broadcastPresenceState() {
  broadcast(makeMsg("presence_state", { online: getOnlinePlayers(conns, world) }));
}

function broadcastPlotUpdate(plot: WorldState["plots"][number]) {
  for (const client of wss.clients) {
    if (client.readyState !== client.OPEN) continue;

    const clientState = conns.get(client);
    const plotForClient = buildClientPlot(world, plot, clientState?.player_id ?? null);

    client.send(
      makeMsg("plot_update", {
        plot: plotForClient,
        owner_display_name: plotForClient.owner_display_name,
      })
    );
  }
}

function handleHello(ws: any, st: ConnState, msg: any) {
  const pid = msg.payload?.player_id;
  const sec = msg.payload?.secret;
  const displayName = msg.payload?.display_name;

  let player = null;

  if (typeof pid === "string" && typeof sec === "string") {
    player = validatePlayer(world, pid, sec);

    if (
      player &&
      typeof displayName === "string" &&
      backfillLegacyPlayerDisplayName(player, displayName)
    ) {
      queueSave();
    }
  }

  if (!player) {
    player = createPlayer(world, typeof displayName === "string" ? displayName : undefined);
    queueSave();
  }

  st.player_id = player.id;

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

        client.send(
          makeMsg("world_patch", {
            added: added.map((plot) =>
              buildClientPlot(world, plot, clientState?.player_id ?? null)
            ),
            world_version: world.version,
          })
        );
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

  const action = applyClearActionToPlotObject(plot, objectId);
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
  const { plot_id: plotId } = msg.payload;
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

  const result = issueScavengingOrder(plot, Date.now());
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
        order_kind: "SCAVENGING",
        target_scope: "ALL",
      },
      msg.req_id
    )
  );
}

wss.on("connection", (ws) => {
  conns.set(ws, { player_id: null, lastSeen: Date.now() });

  ws.on("message", (data) => {
    const st = conns.get(ws);
    if (!st) return;

    st.lastSeen = Date.now();

    if (typeof data !== "string" && !(data instanceof Buffer)) return;

    const raw = data.toString("utf-8");
    if (raw.length > CONFIG.maxMessageBytes) {
      ws.close(1009, "Message too large");
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    const messageResult = ClientMessageSchema.safeParse(parsed);
    if (!messageResult.success) {
      return;
    }

    const msg = messageResult.data;

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

      case "client_ping":
        ws.send(makeMsg("server_pong", {}, msg.req_id));
        return;

      case "claim_plot":
        handleClaimPlot(ws, st, msg);
        return;

      case "clear_plot_object":
        handleClearPlotObject(ws, st, msg);
        return;

      case "issue_plot_order":
        handleIssuePlotOrder(ws, st, msg);
        return;
    }
  });

  ws.on("close", () => {
    conns.delete(ws);
    broadcastPresenceState();
  });
});

const NPC_TICK_INTERVAL_MS = 250;

setInterval(() => {
  const changedPlots = tickNpcSimulation(world, Date.now());
  if (changedPlots.length === 0) {
    return;
  }

  world.version += 1;
  queueSave();

  for (const plot of changedPlots) {
    broadcastPlotUpdate(plot);
  }
}, NPC_TICK_INTERVAL_MS);

setInterval(() => {
  const now = Date.now();
  for (const [ws, st] of conns.entries()) {
    if (now - st.lastSeen > CONFIG.clientTimeoutMs) {
      try {
        ws.terminate();
      } catch (err) {
        console.warn("[ws] terminate failed:", err);
      }
      conns.delete(ws);
    } else {
      try {
        ws.ping();
      } catch (err) {
        console.warn("[ws] ping failed:", err);
      }
    }
  }
}, CONFIG.pingIntervalMs);

console.log(`Server listening on ws://0.0.0.0:${CONFIG.port}`);