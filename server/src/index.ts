import { WebSocketServer } from "ws";
import { CONFIG } from "./core/config";
import { EnvelopeSchema, makeMsg, WorldState } from "./net/protocol";
import { countFreePlayerPlots, expandWorld, newWorld } from "./core/world";
import { loadWorld, saveWorldAtomic } from "./storage/persist";

type ConnState = {
  player_token: string | null;
  lastSeen: number;
};

const wss = new WebSocketServer({ port: CONFIG.port });
let world: WorldState = loadWorld(CONFIG.persistPath) ?? newWorld();

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
  conns.set(ws, { player_token: null, lastSeen: Date.now() });

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
      const token = env.payload?.player_token;
      if (typeof token !== "string" || token.length < 8) {
        ws.send(makeMsg("error", { reason: "invalid_player_token" }, env.req_id));
        return;
      }
      st.player_token = token;
      ws.send(makeMsg("hello_ok", { server_time: Date.now() }, env.req_id));
      sendWorld(ws);
      return;
    }

    // Require hello first
    if (!st.player_token) {
      ws.send(makeMsg("error", { reason: "not_helloed" }, env.req_id));
      return;
    }

    if (env.type === "request_world") {
      sendWorld(ws);
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
      plot.claimed_by = st.player_token;
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