# GPT Assistant Rules for CozyChaosCityBuilder

These rules are **mandatory** for any GPT assistant helping develop this project.

The goal is not just to make the next feature work.  
The goal is to build new content in a way that stays stable, modular, and extensible so the project does **not** need constant refactoring/restructuring every milestone.

---

## 1) Never guess. Always use the real project files.

- **Do not assume** what a file contains, what the project structure looks like, or how something is implemented.
- **Always read the actual project files first** from the latest uploaded `.zip` / attachments before proposing changes.
- If changes were already made through GPT instructions in the same session, combine those changes with the latest uploaded project state unless the user explicitly says otherwise.
- If a file is not available, **ask for the file or its contents** instead of inventing details.

---

## 2) Every change must respect the long-term architecture.

When proposing a change, do not stop at “can this work right now?”

You must also ask:

- does this fit the current architecture?
- will this still be clean after 2–3 more related features?
- does this create a future bottleneck or god-file?
- does this mix responsibilities that should stay separate?
- does this keep server authority where it belongs?
- does this preserve private vs public data boundaries?

If the answer is weak, redesign the change before presenting it.

---

## 3) Stability first. No rushed slices that box the project in.

Do **not** add content in a way that forces later rewrites.

Avoid:
- feature slices that hardcode one current case in a way that blocks future expansion
- logic that only works for one NPC / one building / one order / one object type unless the abstraction clearly supports growth
- stuffing more responsibilities into already-heavy files
- mixing domain state, wire payloads, and presentation state
- client-side fake behavior for systems that should be authoritative on the server

Prefer:
- small but durable abstractions
- explicit data boundaries
- focused modules
- extensible enums/types/data models
- architecture that can support “more of the same kind” later

The rule is:

> Build a small real foundation, not a fast fake shortcut.

---

## 4) Give exact placement instructions. No vague patch guidance.

When providing code edits, you must specify **exactly** where they go:

- use **file paths**
- provide **line numbers** whenever possible
- or provide **precise anchors**
  - “Insert immediately after: `...`”
  - “Replace the whole function `...` with:”
  - “Delete this exact block:”
- avoid vague directions like:
  - “find where you store state”
  - “somewhere in `_ready()`”
  - “near the top”
  - “around the handler”

---

## 5) Whole-file vs patch rules

- **If creating a new file:** provide the **entire file**
- **If modifying an existing file:** provide the **smallest exact patch** that correctly performs the change
- Do not rewrite whole existing files unless a full replacement is truly the cleanest option

---

## 6) Keep code modular. No spaghetti.

- Prefer small, focused modules and helper functions
- One clear responsibility per file / function when practical
- Keep transport, domain logic, persistence, rendering, and UI responsibilities separated
- Avoid growing god-files further
- If a file is already becoming too central, propose a split before adding more to it

Examples of boundaries that should stay separate:
- server domain state vs client-facing DTOs
- world simulation vs websocket transport
- static local objects vs NPC actors
- client rendering vs gameplay authority
- UI flow vs world controller logic

---

## 7) Never use inferred local variable types in GDScript.

This rule is mandatory for this project.

Use:

```gdscript
var plot_id: String = str(plot.get("id", ""))
var tween: Tween = create_tween()
var result: Dictionary = space_state.intersect_ray(query)
```

Do **not** rely on:

```gdscript
var plot_id := ...
var tween := ...
var result := ...
```

Reason:
- this project treats warnings seriously
- Godot may infer `Variant`
- `Variant` inference causes avoidable warnings/errors
- explicit types are safer and easier to maintain

When in doubt, declare the type explicitly.

---

## 8) Comments are expected. Teach the future maintainer.

Add comments that explain:

- what the block does
- why it exists
- why the structure is futureproof
- any important edge case or ownership rule

Prefer comments that help a future developer continue the system correctly.

Avoid useless comments that only restate obvious syntax.

---

## 9) Respect server authority and data safety.

Do not leak internal/private server data to the client.

Important rules:
- never expose player secrets/tokens in world snapshots
- do not send raw server state if the client only needs a filtered DTO
- keep public, owner-only, and server-only data clearly separated
- protocol changes must be mirrored on both client and server intentionally

---

## 10) Keep the protocol explicit.

Do not mix:
- domain state
- persisted state
- wire payload shape
- client view model

When changing networking:
- update the protocol/types/schemas explicitly
- keep runtime validation in place
- update client decoding/adapters intentionally
- document the message/payload change when needed

---

## 11) Add tests/tooling when architecture changes.

If a change affects important foundations, include or update:
- `typecheck`
- tests
- lint

For server-side architectural changes, prefer to leave the project in a state where:

```bash
npm run typecheck
npm run test
npm run lint
```

all pass.

If the change is important enough to break the project if it regresses, it is important enough to deserve a test.

---

## 12) Explain tradeoffs honestly.

When suggesting a solution:
- say what is urgent
- say what is foundation work
- say what can wait
- say what is still temporary if anything remains temporary

Do not pretend a rushed workaround is “futureproof.”

If something is a compromise, label it clearly.

---

## 13) Match the active project direction.

Current direction:
- M2 owned-plot foundation exists
- neighborhood rendering is deferred
- the project is now building on the more stable M3 NPC/order foundation
- future work should continue from durable server-authoritative gameplay systems, not throwaway milestone hacks

Do not steer the project back toward an outdated milestone priority unless the user explicitly asks for that.

---

## 14) Preferred development mindset for this project

When adding anything new, think like this:

1. what is the smallest real version of this system?
2. how do I keep it modular?
3. how do I keep it extensible?
4. how do I avoid rewriting it in two milestones?
5. how do I keep client, server, data, and UI roles cleanly separated?

That is the standard expected for future assistants.
