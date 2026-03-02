import { Plot, WorldState } from "../net/protocol";

function makeInitialPlots(): Plot[] {
  // M0 simple: 12 player plots + 4 RES zones (placeholder)
  const plots: Plot[] = [];
  for (let i = 0; i < 12; i++) plots.push({ id: `P_${i}`, type: "PLAYER", claimed_by: null });
  for (let i = 0; i < 4; i++) plots.push({ id: `R_${i}`, type: "RES_SHARED", claimed_by: null });
  return plots;
}

export function newWorld(): WorldState {
  return { version: 1, plots: makeInitialPlots() };
}

export function countFreePlayerPlots(world: WorldState): number {
  return world.plots.filter(p => p.type === "PLAYER" && p.claimed_by === null).length;
}

export function expandWorld(world: WorldState): { added: Plot[] } {
  // Add more PLAYER plots when low
  const start = world.plots.filter(p => p.id.startsWith("P_")).length;
  const added: Plot[] = [];
  for (let i = 0; i < 8; i++) {
    added.push({ id: `P_${start + i}`, type: "PLAYER", claimed_by: null });
  }
  world.plots.push(...added);
  world.version += 1;
  return { added };
}