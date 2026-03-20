# Cozy Chaos City — Baseline Benchmark Spec (Latest Archive)

## Purpose

This document defines the **baseline benchmark suite** that should be run on the current version **before** major refactors, then rerun after each milestone.

The goal is to measure real bottlenecks in:
- server simulation
- broadcast fan-out
- snapshot persistence
- client local rendering
- overhead labels
- tweened NPC motion
- effect bursts
- mode transitions

---

## Rules

- Use the **same benchmark matrix** before and after changes.
- Save every run to:
  - JSON
  - CSV summary
- Record:
  - run id
  - commit/hash
  - scenario name
  - seed parameters
  - min / avg / p95 / p99 / max
- Compare **p95/p99**, not only average.

---

## Server Metrics to Capture

- tick duration
- changed plots per tick
- buildClientWorld duration
- buildClientPlot duration
- serialization duration
- broadcast duration
- message payload bytes
- save queue depth
- snapshot clone duration
- flush/write duration
- connection count
- NPC count
- job count

---

## Client Metrics to Capture

- FPS
- avg frame time
- max frame time
- stutter count
- RTT
- rendered NPC count
- rendered object count
- visible label count
- active tween count
- active one-shot effect count
- local mode enter duration
- local mode exit duration

---

## Scenario Matrix

## A. World / Network Baseline

### A1 — Single client idle world
- 1 client
- world view only
- no local plot entered

### A2 — 5 clients idle world
- 5 clients
- world view only

### A3 — 10 clients idle world
- 10 clients
- world view only

### A4 — 25 clients idle world
- 25 clients
- world view only

### A5 — Claim burst
- multiple clients attempt claims rapidly
- measure broadcast/update spikes

---

## B. Local Plot Static Baseline

### B1 — One detailed plot, 0 NPCs
- enter local plot
- no active jobs
- baseline local rendering cost

### B2 — One detailed plot, dense objects, 0 NPCs
- stress local object sync and draw cost

### B3 — Multiple detailed plots present, one active locally
- baseline memory/state overhead

---

## C. NPC Simulation / Motion Baseline

### C1 — 10 NPCs, labels off
### C2 — 10 NPCs, labels on
### C3 — 25 NPCs, labels off
### C4 — 25 NPCs, labels on
### C5 — 50 NPCs, labels off
### C6 — 50 NPCs, labels on
### C7 — 100 NPCs, labels off
### C8 — 100 NPCs, labels on

Measure:
- tick time
- label cost
- frame time
- tween count
- animation stability

---

## D. Order / Job Churn

### D1 — Repeated issue/cancel on one plot
### D2 — Multiple plots with active orders
### D3 — Long-running scavenging simulation
### D4 — high job count with many reserved/in-progress jobs

---

## E. Persistence Stress

### E1 — Repeated local mutation with save debounce
### E2 — High mutation burst
### E3 — Many changed plots from NPC ticks

Measure:
- queueSave clone cost
- flush latency
- save queue depth

---

## F. Effects / Presentation Stress

### F1 — Repeated rubble clear, one at a time
### F2 — Repeated rubble clear bursts
### F3 — Dense local view with active smoke/effects
### F4 — Enter/exit plot mode repeatedly with transitions enabled

Measure:
- frame spikes
- effect count
- cleanup cost
- transition timing

---

## Suggested Initial Bottleneck Order

Likely hotspots to validate first:
1. broadcast fan-out
2. snapshot clone/save
3. NPC tick scans
4. overhead label pipeline
5. local renderer NPC/object sync
6. effect bursts
7. transitions

---

## Output Format

Each run should produce:
- `benchmark_run_<id>.json`
- `benchmark_run_<id>_summary.csv`

Each run report should include:
- scenario
- seed parameters
- client count
- server metrics
- client metrics
- notes
- regressions/improvements vs previous reference run
