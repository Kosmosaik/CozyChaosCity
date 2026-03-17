import path from "node:path";

const SERVER_ROOT = path.resolve(__dirname, "..", "..");
const DATA_DIR =
  process.env.CCC_DATA_DIR?.trim() || path.join(SERVER_ROOT, "data");

export const CONFIG = {
  port: Number(process.env.CCC_PORT ?? 27015),
  persistPath:
    process.env.CCC_PERSIST_PATH?.trim() ||
    path.join(DATA_DIR, "world_state.json"),
  expandWhenFreePlotsBelow: 3,
  protocolVersion: 3,
  maxMessageBytes: 64 * 1024,
  pingIntervalMs: 10_000,
  clientTimeoutMs: 30_000,
  saveDebounceMs: 150,
};