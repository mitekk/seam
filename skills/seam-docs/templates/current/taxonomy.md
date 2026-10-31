# Taxonomy

**Layer 2 — Current.** What is true now about this repo's tracker. When it is wrong, that is a
**bug**, so the edit rule is **amend in place**.

Owns: the **domain labels**, the **three priorities**, and the **milestones**. Nothing else may
define them — `.seam/config.json` carries the machine mirror. The two are kept in step by hand:
no checker assertion compares them, so a drift between them is not caught.

## Domains

One domain per source-of-truth row is the usual mapping, and it is a good default: a label that
does not correspond to something that owns a question is a label nobody can apply consistently.

| Domain | Covers |
|---|---|
{{domains_table}}

Kind stays on GitHub's defaults: `bug`, `enhancement`, `documentation`.

**If work needs a domain that is not on this list, propose it rather than inventing a label
silently.** A taxonomy only pays for itself while it is small and stable, and one invented per
session is neither. Adding a row here is a real change: it goes in the same commit as the label.

An issue carries **one or two** domains. Three means the work has not been split yet.

## Priorities

Three values, **by consequence rather than by feeling**. The point of writing it this way is that
someone else can arrive at the same answer.

| Priority | Means |
|---|---|
| `p0` | A live defect someone outside this repo sees, or a blocker on the active milestone |
| `p1` | In the active milestone |
| `p2` | Later |

There is no `p3`, and there is no "high / medium / low" beside this. A fourth value is how a
priority scheme stops meaning anything: everything becomes `p1` and the board stops sorting.

## Milestones

The build order. Each ends green before the next starts, and each produces a reviewable diff.

| # | Milestone | Green when | Active |
|---|---|---|---|
{{milestones_table}}

**The active milestone is the one the priority rule reads**, so it has to be unambiguous: once
there are milestones, exactly one is active — the row marked `yes` above, `milestones[].active` in
`.seam/config.json` — and clause 3 of the follow-up qualifier, "blocks the active milestone", is
answered from it rather than from how important something feels.

**Advancing it is one edit, and the answers file is where it goes.** The `yes` moves when the row
carrying it is green by its own column and the next row is started — not when it feels finished,
and not as a tidy-up afterwards. Flip `active` in `.seam/answers.json`, regenerate, and change
this column in the same commit, because the two are kept in step by hand as this file says above.
Editing `.seam/config.json` instead is the one way that fails silently: the config is a projection
of the answers file, so the next regeneration reverts the edit without a word, and assertion A16
is what reports it.

## What this does not own

- **Which issues build a subsystem, in what order.** That is layer 5, under the plans directory.
  This file says what the milestones *are*; a plan says what goes in one.
- **Why a domain exists.** If the reasoning matters, it is a decision record and this file cites
  it.
- **The issue, commit and PR shapes.** Those are conventions rather than facts about this repo,
  and the `seam-github` skill owns them.

## The tracker itself

Creating labels and milestones on the remote is outward-facing and needs an explicit OK, so it is
not done automatically. This file is the list; the `gh` commands that create it are run by hand
once, and re-run when a row here changes.
