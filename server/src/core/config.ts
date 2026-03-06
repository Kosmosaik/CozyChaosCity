export const CONFIG = {
  port: 27015,           // typical game-ish port
  persistPath: "world_state.json",
  expandWhenFreePlotsBelow: 3,
  protocolVersion: 2,
  maxMessageBytes: 64 * 1024,
  pingIntervalMs: 10_000,
  clientTimeoutMs: 30_000,
};