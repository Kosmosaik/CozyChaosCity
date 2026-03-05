import WebSocket from "ws";

const WS_URL = "ws://localhost:8080";
const player_token = "TEST_PLAYER_1";
let claimed = false;

function send(ws: WebSocket, type: string, payload: any = {}, req_id?: string) {
  ws.send(JSON.stringify({ v: 1, type, req_id, payload }));
}

const ws = new WebSocket(WS_URL);

ws.on("open", () => {
  console.log("Connected to server");
  send(ws, "hello", { display_name: "TestClient1" }, "req_hello");
  // Ask for world (in case server doesn't auto-send it)
  send(ws, "request_world", {}, "req_world");
});

ws.on("message", (data) => {
  const msg = JSON.parse(data.toString());
  // console.log("MSG:", msg);

  if (msg.type === "world_state") {
    const plots = msg.payload.world.plots;
    const free = plots.filter((p: any) => p.type === "PLAYER" && p.claimed_by === null);
    console.log(`Got world_state. Free PLAYER plots: ${free.length}`);

    if (!claimed && free.length > 0) {
      const plot_id = free[0].id;
      console.log("Attempting to claim:", plot_id);
      send(ws, "claim_plot", { plot_id }, "req_claim");
      claimed = true;
    }
  }

  if (msg.type === "claim_result") {
    console.log("Claim result:", msg.payload);
  }

  if (msg.type === "plot_update") {
    console.log("Plot update:", msg.payload.plot);
  }
});

ws.on("close", () => console.log("Disconnected"));
ws.on("error", (err) => console.error("WS error:", err));