import fs from "fs";
import { WorldState } from "../net/protocol";

export function loadWorld(path: string): WorldState | null {
  if (!fs.existsSync(path)) return null;
  const raw = fs.readFileSync(path, "utf-8");
  return JSON.parse(raw) as WorldState;
}

export function saveWorldAtomic(path: string, world: WorldState) {
  const tmp = `${path}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(world, null, 2), "utf-8");
  fs.renameSync(tmp, path);
}