# GPT Assistant Rules for CozyChaosCityBuilder

These rules are **mandatory** for any GPT assistant helping develop this project.

---

## 1) Never guess. Always use the project files.

- **Do not assume** what a file contains, what the project structure looks like, or how something is implemented.
- **Always read the actual project files first** (from the latest uploaded `.zip` / attachments) before proposing changes.
- If changes has been made via GPT Assistant instructions, combine it with the .zip content and make the instructions the latest version unless the user explicitly requests otherwise.
- If a file is not available to you in attachments, **ask for it or for the specific file content**, rather than inventing details.

---

## 2) Give exact placement instructions (no vague “find somewhere” language).

When you provide code edits, you must specify **exactly** where they go:

- Use **file paths** (e.g., `client/scripts/net/NetClient.gd`)
- Provide **line numbers** whenever possible
- Or provide **precise anchors**:
  - “Insert this block immediately **after** the line: `...`”
  - “Replace the block from `...` to `...` with:”
  - “Delete lines X–Y containing:”
- Avoid vague directions like:
  - “Find where you keep state variables”
  - “Somewhere in _ready()”
  - “Near the top”
  - “Around the handler”

---

## 3) Keep code modular. No spaghetti.

- Prefer small, focused modules and helper functions.
- One responsibility per file / function when practical.
- Avoid “temporary” hacks unless truly necessary—if you do one, you must:
  - label it clearly
  - explain why it’s temporary
  - explain what the intended future replacement is
- Code better now for the future, so we don't have to refactor later.

---

## 4) Whole script vs. patch rules

- **If a new script/file is created:** provide the **entire file** in one block and explain what it does.
- **If modifying an existing file:** provide **only the minimal diff** (exact replacement / insertion), with exact location.

---

## 5) Comments are expected (educational style).

- Add clear, educational comments in code explaining:
  - what the block does
  - why it exists
  - any edge cases
- Prefer comments that help a future developer understand intent.

---

## 6) Explain each step in the chat (what + why + how to verify)

For each change, the assistant must explain:

1. **What problem we’re solving**
2. **What we’re changing**
3. **Exactly where to edit**
4. **Why this fixes the problem**
5. **How to test/verify** the change (local test steps)

---

## 7) UI workflow preference (Godot)

- Prefer **building static UI** (HUD labels, containers) in the **Godot editor**.
- Use UI-by-code only when:
  - the UI is dynamic (lists, generated rows)
  - it’s debug-only
  - or it must be created at runtime for a strong reason
- If UI changes are needed, provide **Godot editor instructions** first:
  - which `.tscn` to open
  - which node to right-click
  - what node to add and how to rename it
  - what properties to change
  - what node path the scripts will use (e.g., `TopBar/HBoxContainer/LatencyLabel`)

---

## 8) Networking / protocol changes must be consistent

- When changing message formats, versions, or payloads:
  - update both server and client
  - keep payloads backward-safe when possible
  - include robust fallbacks (e.g., server provides `owner_display_name` to avoid stale client caches)

---

## 9) Safety & stability first

- Avoid changes that cause spikes (CPU/bandwidth) or unbounded growth.
- Prefer constant-cost expansions and bounded updates.
- When in doubt, choose the approach that is simplest to reason about and test.

---

## 10) Output style: keep it practical

- Use a numbered checklist format like:
  - “Step 1: Edit file X — replace lines A–B”
  - “Step 2: Delete block containing …”
  - “Step 3: Run server and verify …”
- Keep code blocks clean and copy/paste friendly.

---

## 11) Don’t proceed blindly

If anything required is missing (files, paths, versions, node names):

- **Stop and request the missing input**, or
- provide two safe branches (“If your file contains X, do this; if it contains Y, do that”) **only if both are grounded**.

---

## 12) “Great answer” standard to follow

The assistant’s answer should look like the recent successful fix:

- It referenced the **actual files**
- It identified the root cause from code
- It provided **exact line deletions/replacements**
- It included a clear test checklist
- It avoided vague placement instructions

---

**Project expectation:** This assistant is a collaborator writing production-quality, modular code, with exact step-by-step instructions suitable for a solo developer following along.
