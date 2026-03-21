import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { DEV_METRICS } from "../core/dev_metrics";
import type { WorldState } from "../net/protocol";

function cloneWorld(world: WorldState): WorldState {
  return DEV_METRICS.measure("persist_clone_world_ms", () => {
    // JSON persistence currently snapshots the whole world.
    // Measuring the clone cost now will tell us when this approach starts
    // becoming a real bottleneck and needs a more advanced persistence layer.
    return JSON.parse(JSON.stringify(world)) as WorldState;
  });
}

export class JsonWorldRepository {
  private pendingSnapshot: WorldState | null = null;
  private saveTimer: NodeJS.Timeout | null = null;
  private isSaving = false;

  constructor(
    private readonly filePath: string,
    private readonly debounceMs: number
  ) {}

  load(): WorldState | null {
    if (!fs.existsSync(this.filePath)) {
      return null;
    }

    const raw = fs.readFileSync(this.filePath, "utf-8");
    return JSON.parse(raw) as WorldState;
  }

  queueSave(world: WorldState): void {
    this.pendingSnapshot = cloneWorld(world);

    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    this.saveTimer = setTimeout(() => {
      void this.flush();
    }, this.debounceMs);
  }

  async saveNow(world: WorldState): Promise<void> {
    this.pendingSnapshot = cloneWorld(world);
    await this.flush();
  }

  private async flush(): Promise<void> {
    if (this.isSaving) {
      return;
    }
    if (!this.pendingSnapshot) {
      return;
    }

    await DEV_METRICS.measureAsync("persist_flush_ms", async () => {
      this.isSaving = true;
      const snapshot = this.pendingSnapshot;
      this.pendingSnapshot = null;

      try {
        const dir = path.dirname(this.filePath);
        await fsp.mkdir(dir, { recursive: true });

        const tmp = `${this.filePath}.tmp`;

        await DEV_METRICS.measureAsync("persist_write_snapshot_ms", async () => {
          // Keep write timing separate from total flush timing so we can tell
          // whether cost is mostly cloning/queueing or the actual disk write.
          await fsp.writeFile(tmp, JSON.stringify(snapshot, null, 2), "utf-8");
          await fsp.rename(tmp, this.filePath);
        });
      } finally {
        this.isSaving = false;

        if (this.pendingSnapshot) {
          void this.flush();
        }
      }
    });
  }
}