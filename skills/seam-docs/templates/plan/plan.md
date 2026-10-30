# {{doc.title}}

**Layer 5 — Seam.** Which units of work build this, in what order, and what joins them. Being
wrong here is **expected** — a plan is a bet on sequence — so a plan is **superseded wholesale**
rather than amended: when the shape changes, this file is rewritten or replaced.

**This file owns nothing.** It holds shape and sequence: the space between an issue, which is
one unit of work, and a milestone, which is build order. It **cites** the docs above it rather
than restating them, and where it disagrees with one of them, the doc wins and this plan is the
drift.

{{doc.owns}}

## The seams

A seam is what one unit of work hands the next. Name the handoff, not the task.

| # | Seam | From | To |
|---|---|---|---|
| 1 | <what is handed over> | <unit> | <unit> |

## The issues, in the order they can be built

| # | Issue | Depends on | Why this order |
|---|---|---|---|
| 1 | #N <title> | — | <the reason it is first> |

**One issue, one owning plan.** An issue appears in the table of exactly one plan, so that
"where is this tracked" has one answer. Assertion A8 checks it.

## Keeping this file true

When a seam turns out differently, strike the claim through rather than deleting it —
`~~the old claim~~` with a line saying what replaced it — so that a later reader can see why the
shape changed. When the whole sequence changes, supersede the file instead.
