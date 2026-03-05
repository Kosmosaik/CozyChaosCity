import { WebSocketServer } from "ws";
import { CONFIG } from "./core/config";
import { EnvelopeSchema, makeMsg, WorldState } from "./net/protocol";
import { countFreePlayerPlots, expandWorld, newWorld } from "./core/world";
import { loadWorld, saveWorldAtomic } from "./storage/persist";
import { toLowerCase } from "zod";
import { createPlayer, validatePlayer } from "./core/players";

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
if (!world.players) {
  world.players = {};
  saveWorldAtomic(CONFIG.persistPath, world);
}

const conns = new Map<any, ConnState>();

function broadcast(msg: string) {
  for (const ws of wss.clients) {
    if (ws.readyState === ws.OPEN) ws.send(msg);
  }
}

function sendWorld(ws: any) {
  ws.send(makeMsg("world_state", { world }));
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
    try { parsed = JSON.parse(raw); } catch { return; }

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
	  ws.send(makeMsg("welcome", {
		player_id: player.id,
		secret: player.secret,
		display_name: player.display_name,
	  }, env.req_id));

	  // Send world state snapshot
	  sendWorld(ws);
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

      const plot = world.plots.find(p => p.id === plotId);
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

      // Notify everyone (delta + optional full state)
      broadcast(makeMsg("plot_update", { plot }));
      ws.send(makeMsg("claim_result", { ok: true, plot_id: plotId }, env.req_id));

      // Expansion check
      if (countFreePlayerPlots(world) < CONFIG.expandWhenFreePlotsBelow) {
        const { added } = expandWorld(world);
        saveWorldAtomic(CONFIG.persistPath, world);
        broadcast(makeMsg("world_patch", { added, world_version: world.version }));
      }
      return;
    }
  });

  ws.on("close", () => {
    conns.delete(ws);
  });
});

setInterval(() => {
  const now = Date.now();
  for (const [ws, st] of conns.entries()) {
    if (now - st.lastSeen > CONFIG.clientTimeoutMs) {
      try { ws.terminate(); } catch {}
      conns.delete(ws);
    } else {
      try { ws.ping(); } catch {}
    }
  }
}, CONFIG.pingIntervalMs);

console.log(`Server listening on ws://localhost:${CONFIG.port}`);