---
name: seam-docs
description: >
  Installs or extends a repo's layered documentation spine — the sources-of-truth table,
  one doc per layer, and `.seam/config.json`. Use this when someone wants to set up docs,
  "add a CLAUDE.md", work out which doc owns what, decide where a new document belongs,
  classify existing docs into layers, or run `/seam:init`. Also use it when two docs
  disagree about who owns a question, when a doc explains *why* and should be citing a
  decision record instead, or when a new file under `docs/` needs a row in the table.
  Does NOT generate or run the drift checker (that is seam-checks), and does not own
  issue, PR or review conventions (seam-github, seam-review).
---

# The doc wizard

Read the repo, propose a layered doc set, write what the user approves. Never write a claim about
the repo that is not traceable to the tree or to an answer the user gave.

**The layers are `references/layers.md`.** Read it before classifying anything — the layer is not
a category, it is the answer to *what happens when this document turns out to be wrong*, and it
selects the edit rule and the assertions.

**The question set and the answers-file schema are `references/interview.md`.** Read it before
asking anything.

## What this writes, and what it must not

Writes:

- the sources-of-truth table, into the file the answers name (`table.file`, usually `CLAUDE.md`),
  **between its two markers and nowhere else**;
- `.seam/config.json`, the machine projection;
- one doc per approved row, from `templates/`;
- `.claude/agents/*.md`, if the answers name any agents.

Never:

- **rewrites an existing doc's body.** Not a tidy-up, not a reformat, not "while I was in there".
  Reshaping a file is a separate, per-file, opt-in step the user asks for by name.
- touches anything outside the markers in `table.file`.
- states *why* a decision was made, what is load-bearing, or what the project is for. Those are
  asked, and the answer goes in **in the user's words**.
- writes a CI workflow when one already exists. It prints the job to add and changes nothing.

## The two paths

### A tree with no docs

1. **Read the tree and say what you read.** Stack, package manager, test runner, lint/build
   commands, CI steps, directory layout, candidate layer-1 artifacts. State it back; ask for a
   correction rather than asking an open question about something `package.json` answers.
2. **Interview**, per `references/interview.md`. Every answer in the user's words.
3. **Propose the table** — one row per doc, with its layer, what it owns, and `Enforces` shown
   **empty**. Propose a row only where the tree gives evidence for the seam: a `docs/infra.md`
   for a repo with no deploy path is a file nobody will ever open.
4. **Write the answers file** to the repo root, then run the program:

   ```bash
   node "$CLAUDE_PLUGIN_ROOT/bin/seam-init.mjs" --answers seam-answers.json --repo . --dry-run
   node "$CLAUDE_PLUGIN_ROOT/bin/seam-init.mjs" --answers seam-answers.json --repo .
   ```

   `--dry-run` first, every time: it prints what would be written and writes nothing, and the
   user gets to see the list before it exists.
5. **Read the output.** `wrote`, `kept` (the file existed and was left alone), and `missing` (a
   row with no file — write it or drop the row). Report the `kept` and `missing` lines; they are
   the two places the proposal and the tree disagree.
6. **Hand off to `seam-checks`** to generate the checker and the baseline.

### A tree that already has docs

The riskier path, because the repo already has an answer to most of these questions and it is
written down somewhere — usually in two places that disagree. **Read `references/adopt.md` before
starting**; it owns this procedure and what the evidence does and does not reach.

1. **Inventory with the program, not by reading forty files:**

   ```bash
   node "$CLAUDE_PLUGIN_ROOT/bin/seam-inventory.mjs" --repo . > /tmp/seam-inventory.json
   ```

   Read-only, no dependencies, JSON out. Reading the files yourself is how a proposal acquires
   invented confidence; every claim the inventory makes is traceable to the tree.
2. **Propose** what each file currently owns and which layer it is — showing `layer_guess` *with
   its `why`*, as a proposal. The guess is a path-and-history heuristic; it cannot see semantics,
   and it will be wrong about a file whose directory name misleads.
3. **Flag** overlaps and layer violations, with the evidence lines rather than the verdict. An
   overlap whose `layers` are all one layer is usually a shared format, not a competing claim.
4. **Tell the user how big the baseline will be**, from the inventory's `summary`, *before* it is
   written. A number they agreed to is a ratchet; a number they discover later is a wall.
5. **Write** only the table, `.seam/config.json`, the baseline, and files the user adds. A row
   for a file that already exists takes `"create": false`.

## Why the program, and not you

`bin/seam-init.mjs` renders the templates and writes the config. Do not hand-write what it
writes: a config produced by a program is reproducible and re-runnable, and `--answers` is what
lets an adoption run in CI. Your half of the job is the interview and the proposal — the part
that needs judgment. Its half is the part that must be identical every time.

If the program rejects the answers file, it names the key path. Fix the answers file, not the
program.

## Adding one doc to a repo that already has the layer

The common case after `init`, and it is not a re-run of the wizard:

1. Ask the layer question — *what happens when this file turns out to be wrong?*
2. Check no existing row already owns that question. If one does, the answer is to amend that
   doc, not to add a file. Two files claiming one seam is the thing the table exists to prevent.
3. Add the row to the table **and** the entry to `.seam/config.json` `docs`, in the same change.
   A10 fails on a doc with no row; A11 fails on an `Enforces` value that is not on
   `load_bearing`.
4. Write the file from the layer's template in `templates/`.
5. Run the checker. A new doc that cites a section that does not exist is the most common way
   this goes red.

## When the layer is in doubt

Say so, and ask. A doc filed at the wrong layer gets the wrong edit rule, and the wrong edit rule
is how a decision record becomes editable — which silently voids A7 and A12.

The two frequent mistakes, both from `references/layers.md`:

- a layer-2 doc that explains **why** — the rationale belongs in layer 3, with a citation left
  behind;
- a layer-5 plan that **settles** something — a decision nobody can find. Move it to layer 3.

## Templates

`templates/` holds one per layer, and each template states what it owns, its layer, and its edit
rule. That is the contract; the prose below it is the repo's.

| Layer | Template |
|---|---|
| 2 Current | `templates/current/doc.md` |
| 3 Decisions | `templates/adr-madr/` (default) or `templates/adr-single/decisions.md` |
| 4 Intent | `templates/prd/` — `PRD-vN.md`, `PRD-current.md`, `README.md` |
| 5 Seam | `templates/plan/plan.md` |
| 6 Ledger | `templates/ledger/findings-ledger.md` |
| — | `templates/agent/agent.md` — the repo's agents, scoped to its seams |

Layer 1 has no template. It is the code.
