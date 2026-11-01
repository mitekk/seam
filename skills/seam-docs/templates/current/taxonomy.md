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

**"Green when" is a completion condition, not a level.** The word carries a second sense in this
method — a share of the session window a piece of work has spent, where Green is the lowest
band — and the two live in different files for different readers. Nothing here is a budget: a
milestone's cell is what has to be *true* before the next row starts. Where this repo also writes
a context budget down, that doc owns the other sense and this table never refers to it.

| # | Milestone | Green when | Active |
|---|---|---|---|
| 1 | Establish the field — this repo is **{{field}}** | the determination is recorded, with the reason it was made | no |
{{milestones_table}}

**Milestone 1 is the method's, and it is green on arrival.** Establishing whether a repo is green
or brown field is the first step to getting anything else straight, and everything after it
depends on it: which path the wizard runs, what the proposal may claim, how big the baseline is,
and which assertions can run at all. It is recorded before this file can exist — the wizard cannot
write the row without the answer — so its Active cell is `no` rather than `yes`: marking it active
would park the priority rule on a milestone nobody can work on, and leave this repo's own first
milestone queued behind one that was already satisfied. **This repo's own build order is numbered
from 2**, below it.

**Why this repo is {{field}}:** {{field_reason}}

It is a judgement about the tree **as it stands**, not about its history. A repo whose every doc
was written by this method is still, as a tree, a repo that already has docs.

**The active milestone is the one the priority rule reads**, so it has to be unambiguous: once
there are milestones of this repo's own, exactly one is active — the row marked `yes` above,
`milestones[].active` in `.seam/config.json`, which carries those rows and not milestone 1 — and
clause 3 of the follow-up qualifier, "blocks the active milestone", is answered from it rather
than from how important something feels.

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
