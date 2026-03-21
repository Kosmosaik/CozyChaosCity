import { describe, expect, it } from "vitest";
import { DevMetricsCollector } from "./dev_metrics";

describe("DevMetricsCollector", () => {
  it("aggregates samples and resets after building a summary", () => {
    const metrics = new DevMetricsCollector(true, 5000, 1000);

    metrics.recordDuration("build_client_plot_ms", 4);
    metrics.recordDuration("build_client_plot_ms", 6);
    metrics.recordDuration("persist_flush_ms", 10);

    const summary = metrics.buildSummaryAndReset(6000);

    expect(summary).toHaveLength(2);

    expect(summary[0].name).toBe("build_client_plot_ms");
    expect(summary[0].count).toBe(2);
    expect(summary[0].total_ms).toBe(10);
    expect(summary[0].avg_ms).toBe(5);
    expect(summary[0].min_ms).toBe(4);
    expect(summary[0].max_ms).toBe(6);

    expect(summary[1].name).toBe("persist_flush_ms");
    expect(summary[1].count).toBe(1);
    expect(summary[1].total_ms).toBe(10);
    expect(summary[1].avg_ms).toBe(10);
    expect(summary[1].min_ms).toBe(10);
    expect(summary[1].max_ms).toBe(10);

    expect(metrics.buildSummaryAndReset(11000)).toEqual([]);
  });

  it("does not accumulate samples when disabled", () => {
    const metrics = new DevMetricsCollector(false, 5000, 1000);

    metrics.recordDuration("npc_tick_loop_ms", 12);

    expect(metrics.buildSummaryAndReset(6000)).toEqual([]);
  });
});