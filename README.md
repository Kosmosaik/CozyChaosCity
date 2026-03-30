# Cozy Chaos City

Server-authoritative city-building / simulation prototype with a Godot client and a TypeScript WebSocket server.

This repository is currently focused on the early durable foundation:
- owned-plot gameplay
- authoritative local plot state
- local NPC / order loop foundation
- client rendering + UI for the owned plot
- JSON persistence for early development

---

## Repository structure

- `client/` — Godot client project
- `server/` — TypeScript WebSocket server
- `docs/` — milestone docs, architecture notes, handoff summaries, and hardening plans

---

## Current development expectations

This project treats **clean foundations and reproducibility** as important.

When validating important changes on the server side, the target baseline is:

```bash
npm run typecheck
npm run lint
npm test
```

If those do not pass after a meaningful architectural/server change, the repo is not in a good handoff state yet.

---

## Clean local setup

### Server

From `server/`:

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run dev
```

Important:
- do **not** trust copied `node_modules` from old zip archives
- always prefer a fresh local install when validating reproducibility
- if tooling behaves strangely, remove `node_modules/` and install again

### Client

Open the `client/` project in Godot and run the main scene from there.

If the local Godot cache becomes noisy or stale, it is safe to remove:

```text
client/.godot/
```

Godot will regenerate it.

---

## Runtime / local generated data

These paths are local/generated and should not be treated as meaningful source content in handoff archives:

- `server/node_modules/`
- `server/dist/`
- `server/data/`
- `client/.godot/`
- temporary `*.tmp` files

---

## Handoff archive hygiene

When preparing a zip for review / handoff, do **not** include:

- `server/node_modules/`
- `server/dist/`
- `server/data/`
- `client/.godot/`
- temporary `*.tmp` files
- the repository `.git/` directory

A handoff archive should contain the real project source, docs, and config — not machine-local install/cache/output state.

---

## Current architectural direction

The project is currently building on the more durable M3 direction plus the early logistics/manufacturing foundation:

- server-authoritative gameplay
- explicit protocol boundaries
- stable owned-plot foundation
- extensible NPC / orders systems
- completed first hauling + manufacturing loop
- next gameplay priority: Construction / Basic Stockpile

See:
- `docs/GPT_Assistant_Rules.md` *(the only assistant-instruction document)*
- `docs/TECHNICAL_SUMMARY_FOR_GPT_ASSISTANT.md`
- `docs/foundation-hardening-benchmarking-and-scalability-plan/`

for the current project guidance and hardening direction.
