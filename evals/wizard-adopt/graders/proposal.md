---
type: llm
weight: 3
---

The repo under adoption has six documents: `docs/engineering.md` (a Stack section and a Queue
section, the latter saying "We chose a plain table over a queue library because…"),
`docs/architecture.md` (a Stack section), `docs/adr/0001-pick-postgres.md` (Date, Status,
Context), `docs/plans/first.md` (a § The issues table), `docs/findings-ledger.md` (an empty
observations table), and `CLAUDE.md` (a sources-of-truth table listing `docs/engineering.md` and
`docs/gone.md`, which does not exist).

PASS requires all four:

1. **Layers assigned, and correctly**: `docs/adr/0001-pick-postgres.md` is layer 3 (Decisions),
   `docs/plans/first.md` is layer 5 (Seam), `docs/findings-ledger.md` is layer 6 (Ledger), and
   `docs/engineering.md` and `docs/architecture.md` are layer 2 (Current).
2. **The overlap is raised**: `docs/engineering.md` and `docs/architecture.md` both claim a
   `Stack` section, and the response says so rather than silently picking one.
3. **The layer violation is raised**: the Queue section's "we chose … because" is a *rationale* in
   a layer-2 doc, which belongs in layer 3 with a citation left behind.
4. **It is a proposal**: the response asks the user to confirm or correct, rather than declaring
   the classification settled.

FAIL if any of those four is missing, if the response invents a layer for a file not listed above,
or if it claims the dangling `docs/gone.md` row is fine.

Noticing `docs/gone.md` as day-one drift that the baseline will carry is a bonus, not a
requirement.
