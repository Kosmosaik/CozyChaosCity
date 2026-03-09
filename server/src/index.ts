import { WebSocketServer } from "ws";
import { CONFIG } from "./core/config";
import { EnvelopeSchema, makeMsg, WorldState } from "./net/protocol";
import { countFreePlayerPlots, expandWorld, newWorld, normalizeWorldForM0_5 } from "./core/world";
import { loadWorld, saveWorldAtomic } from "./storage/persist";
import { createPlayer, validatePlayer } from "./core/players";
import { getOnlinePlayers } from "./core/presence";

type ConnState = {
  /**
   * Server-issued player id for this connection (after hello).
   */
  player_id: string | null;

  lastSeen: number;
};

const wss = new WebSocketServer({ port: CONFIG.port });
let world: WorldState = loadWorld(CONFIG.persistPath) ?? newWorld();

/**
 * Migration/normalization:
 * Older saved worlds may not have the new fields we add over time.
 * Ensure they exist so the server doesn't crash.
 */
const norm = normalizeWorldForM0_5(world);
if (norm.changed) {
  console.log(`[world] normalized: ${norm.reason ?? "changed"}`);
  saveWorldAtomic(CONFIG.persistPath, world);
}

const conns = new Map<any, ConnState>();

/**
 * Convert one authoritative server plot into a client-friendly payload shape.
 *
 * Why this exists:
 * - The server stores only claimed_by on the plot itself.
 * - UI wants a human-readable owner name without having to do client-side joins.
 * - We keep the server as the single place that prepares presentation-ready plot payloads.
 */
function decoratePlotForClient(plot: WorldState["plots"][number]) {
  const claimedBy = plot.claimed_by;
  const ownerRec = claimedBy ? world.players[claimedBy] : null;

  return {
    ...plot,
    owner_display_name: ownerRec?.display_name ?? "",
  };
}

/**
 * Decorate a list of plots for client payloads.
 *
 * Keeping this as a helper avoids repeating the same map logic in world_state
 * and world_patch responses.
 */
function decoratePlotsForClient(plots: WorldState["plots"]) {
  return plots.map((plot) => decoratePlotForClient(plot));
}

/**
 * Build the world snapshot shape that clients should receive.
 *
 * Important:
 * - We do not mutate the authoritative server world here.
 * - We return a payload copy whose plots are enriched with owner_display_name.
 */
function makeWorldForClient() {
  return {
    ...world,
    plots: decoratePlotsForClient(world.plots),
  };
}

function broadcast(msg: string) {
  for (const ws of wss.clients) {
    if (ws.readyState === ws.OPEN) ws.send(msg);
  }
}

function sendWorld(ws: any) {
  ws.send(makeMsg("world_state", { world: makeWorldForClient() }));
}

function sendPresenceState(ws: any) {
  ws.send(makeMsg("presence_state", { online: getOnlinePlayers(conns, world) }));
}

function broadcastPresenceState() {
  broadcast(makeMsg("presence_state", { online: getOnlinePlayers(conns, world) }));
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

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    const envRes = EnvelopeSchema.safeParse(parsed);
    if (!envRes.success) return;
    const env = envRes.data;

    // Version check
    if (env.v !== CONFIG.protocolVersion) {
      ws.send(makeMsg("error", { reason: "protocol_version_mismatch" }, env.req_id));
      return;
    }

    if (env.type === "hello") {
      /**
       * Client can send:
       * - { player_id, secret } to authenticate (reconnect)
       * - OR { display_name } to register a new identity
       */
      const pid = env.payload?.player_id;
      const sec = env.payload?.secret;
      const displayName = env.payload?.display_name;

      let player = null;

      // Try to authenticate if credentials are provided
      if (typeof pid === "string" && typeof sec === "string") {
        player = validatePlayer(world, pid, sec);
      }

      // If no valid credentials, create a new player identity
      if (!player) {
        player = createPlayer(world, typeof displayName === "string" ? displayName : undefined);
        saveWorldAtomic(CONFIG.persistPath, world); // persist new identity immediately
      }

      st.player_id = player.id;

      // Tell the client who they are (and give them their secret)
      ws.send(
        makeMsg(
          "welcome",
          {
            player_id: player.id,
            secret: player.secret,
            display_name: player.display_name,
          },
          env.req_id
        )
      );

      // Send world state snapshot
      sendWorld(ws);

      // Send a presence snapshot to the newly joined player
      sendPresenceState(ws);

      // Notify everyone (including this client) that presence changed
      broadcastPresenceState();
      return;
    }

    // Require hello first
    if (!st.player_id) {
      ws.send(makeMsg("error", { reason: "not_helloed" }, env.req_id));
      return;
    }

    if (env.type === "request_world") {
      sendWorld(ws);
      return;
    }

    if (env.type === "client_ping") {
      ws.send(makeMsg("server_pong", {}, env.req_id));
      return;
    }

    if (env.type === "claim_plot") {
      const plotId = env.payload?.plot_id;
      if (typeof plotId !== "string") {
        ws.send(makeMsg("claim_result", { ok: false, reason: "invalid_plot_id" }, env.req_id));
        return;
      }

      const plot = world.plots.find((p) => p.id === plotId);
      if (!plot) {
        ws.send(makeMsg("claim_result", { ok: false, reason: "plot_not_found" }, env.req_id));
        return;
      }
      if (plot.type !== "PLAYER") {
        ws.send(makeMsg("claim_result", { ok: false, reason: "not_claimable" }, env.req_id));
        return;
      }
      if (plot.claimed_by) {
        ws.send(makeMsg("claim_result", { ok: false, reason: "already_claimed" }, env.req_id));
        return;
      }

      // Claim (atomic in one tick)
      plot.claimed_by = st.player_id;
      world.version += 1;
      saveWorldAtomic(CONFIG.persistPath, world);

      // Notify everyone using the same enriched plot shape we use everywhere else.
      // We keep owner_display_name at the top level too for backward safety.
      const plotForClient = decoratePlotForClient(plot);
      const ownerDisplayName = plotForClient.owner_display_name;

      broadcast(
        makeMsg("plot_update", {
          plot: plotForClient,
          owner_display_name: ownerDisplayName,
        })
      );
      ws.send(makeMsg("claim_result", { ok: true, plot_id: plotId }, env.req_id));

      // Expansion check
      if (countFreePlayerPlots(world) < CONFIG.expandWhenFreePlotsBelow) {
        const { added } = expandWorld(world);
        saveWorldAtomic(CONFIG.persistPath, world);

        // Keep patch payloads consistent with world_state and plot_update:
        // added plots are sent in enriched client-ready form.
        const addedForClient = decoratePlotsForClient(added);

        broadcast(makeMsg("world_patch", { added: addedForClient, world_version: world.version }));
      }
      return;
    }
  });

  ws.on("close", () => {
    conns.delete(ws);

    // Presence changed: broadcast a fresh snapshot.
    // (Snapshot approach keeps logic simple and robust.)
    broadcastPresenceState();
  });
}); // ✅ IMPORTANT: closes wss.on("connection", ...)

// Keepalive / timeout watchdog for all connections
setInterval(() => {
  const now = Date.now();
  for (const [ws, st] of conns.entries()) {
    if (now - st.lastSeen > CONFIG.clientTimeoutMs) {
      try {
        ws.terminate();
      } catch {}
      conns.delete(ws);
    } else {
      try {
        ws.ping();
      } catch {}
    }
  }
}, CONFIG.pingIntervalMs);

console.log(`Server listening on ws://0.0.0.0:${CONFIG.port} (LAN/Public via port-forward)`);