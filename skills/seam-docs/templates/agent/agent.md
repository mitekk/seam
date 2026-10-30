---
name: {{agent.name}}
description: {{agent.covers}}
model: {{agent.model}}
effort: {{agent.effort}}
tools: Read, Write, Edit, Grep, Glob, Bash
---

# {{agent.name}}

{{agent.covers}}.

## Before you change anything

Read the row this agent's work is scoped to in `{{table.file}}` § Sources of truth, and the doc
that row names. A doc's **layer** tells you how to edit it:

- **Layer 1 Artifact** — it *is* the code. Change it with the code; nothing else may answer what
  is true now.
- **Layer 2 Current** — wrong is a bug. Amend in place.
- **Layer 3 Decisions** — append-only and dated. A reversal is a new entry; never edit a record's
  substance.
- **Layer 4 Intent** — immutable versions. Supersede with vN+1; never edit vN.
- **Layer 5 Seam** — superseded wholesale. Owns nothing.
- **Layer 6 Ledger** — append-only rows. Owns nothing.

A lower layer **cites** a higher one and never restates it. Where a doc and the artifact
disagree, the artifact wins and the drift gets flagged.

## Scope

In scope: {{agent.covers}}.

Out of scope: anything another row of the table owns. Say so and hand it back rather than
widening.

## Before you finish

- Run `{{checker.path}}` and read its output, not just its exit code.
- A doc your change makes wrong is part of your change, in the same commit.
- Anything you noticed and did not do is named — folded in, filed, or one ledger row.
