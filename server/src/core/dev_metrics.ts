import { CONFIG } from "./config";

type MetricBucket = {
  count: number;
  totalMs: number;
  minMs: number;
  maxMs: number;
};

export type DevMetricSummary = {
  name: string;
  count: number;
  total_ms: number;
  avg_ms: number;
  min_ms: number;
  max_ms: number;
};

function formatMs(value: number): string {
  return `${value.toFixed(2)}ms`;
}

export class DevMetricsCollector {
  private readonly statsByName = new Map<string, MetricBucket>();
  private lastReportAtMs: number;

  constructor(
    private readonly enabled: boolean,
    private readonly reportIntervalMs: number,
    initialNowMs: number = Date.now()
  ) {
    this.lastReportAtMs = initialNowMs;
  }

  recordDuration(name: string, durationMs: number): void {
    if (!this.enabled) {
      return;
    }

    const safeDurationMs = Math.max(0, durationMs);
    const existing = this.statsByName.get(name);

    if (existing) {
      existing.count += 1;
      existing.totalMs += safeDurationMs;
      existing.minMs = Math.min(existing.minMs, safeDurationMs);
      existing.maxMs = Math.max(existing.maxMs, safeDurationMs);
      return;
    }

    this.statsByName.set(name, {
      count: 1,
      totalMs: safeDurationMs,
      minMs: safeDurationMs,
      maxMs: safeDurationMs,
    });
  }

  measure<T>(name: string, run: () => T): T {
    if (!this.enabled) {
      return run();
    }

    const startedAtMs = performance.now();

    try {
      return run();
    } finally {
      this.recordDuration(name, performance.now() - startedAtMs);
    }
  }

  async measureAsync<T>(name: string, run: () => Promise<T>): Promise<T> {
    if (!this.enabled) {
      return run();
    }

    const startedAtMs = performance.now();

    try {
      return await run();
    } finally {
      this.recordDuration(name, performance.now() - startedAtMs);
    }
  }

  buildSummaryAndReset(nowMs: number = Date.now()): DevMetricSummary[] {
    const summary: DevMetricSummary[] = Array.from(this.statsByName.entries())
      .map(([name, bucket]) => ({
        name,
        count: bucket.count,
        total_ms: bucket.totalMs,
        avg_ms: bucket.totalMs / bucket.count,
        min_ms: bucket.minMs,
        max_ms: bucket.maxMs,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    this.statsByName.clear();
    this.lastReportAtMs = nowMs;

    return summary;
  }

  maybeReport(
    nowMs: number = Date.now(),
    logger: (line: string) => void = (line: string) => console.log(line)
  ): void {
    if (!this.enabled) {
      return;
    }

    const reportWindowMs = nowMs - this.lastReportAtMs;
    if (reportWindowMs < this.reportIntervalMs) {
      return;
    }

    // If nothing was measured during this window, just advance the window.
    // That keeps later output readable instead of producing one giant "idle" span.
    if (this.statsByName.size === 0) {
      this.lastReportAtMs = nowMs;
      return;
    }

    const summary = this.buildSummaryAndReset(nowMs);
    const parts = summary.map(
      (entry) =>
        `${entry.name} count=${entry.count} avg=${formatMs(entry.avg_ms)} min=${formatMs(entry.min_ms)} max=${formatMs(entry.max_ms)}`
    );

    logger(`[perf] ${reportWindowMs}ms window | ${parts.join(" | ")}`);
  }
}

// Small shared singleton for the current dev server process.
// This keeps instrumentation easy to call from multiple modules without
// introducing a big logging framework too early.
export const DEV_METRICS = new DevMetricsCollector(
  CONFIG.enableDevMetrics,
  CONFIG.devMetricsReportIntervalMs
);