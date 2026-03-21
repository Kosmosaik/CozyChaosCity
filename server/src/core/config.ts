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

  // This project is still in an active dev-hardening phase, so basic timing
  // metrics are enabled by default. Set CCC_ENABLE_DEV_METRICS=0 to silence
  // them, or change the reporting window below.
  enableDevMetrics: (process.env.CCC_ENABLE_DEV_METRICS?.trim() ?? "1") === "1",
  devMetricsReportIntervalMs: Number(
    process.env.CCC_DEV_METRICS_REPORT_INTERVAL_MS ?? 5000
  ),
};