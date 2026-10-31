---
name: seam-build
description: >
  Follows the repo's `docs/building.md` while work is being done: naming the unit that owns a
  change before touching it, writing that unit's test first, and finishing against the unit's
  own definition of done. Use this when implementing from a plan, starting a unit, finishing a
  unit, when someone asks what "done" means, when a plan does not cover what is about to be
  built, or when something turns up mid-task that nobody planned. Does NOT decide whether a
  follow-up becomes an issue, a unit or a ledger row, or gate the commit, push or merge (that
  is seam-github), does not pick the review level or run the rounds (seam-review), and does
  not own the doc layer (seam-docs).
---

# Building against the plan

**Locate the repo's `docs/building.md` and follow it.** It owns the start contract, the finish
contract, the test-first rule and the proportionality cut for this repo. This file is how to
follow it while working; it never answers a question the doc answers.

If the repo has no `docs/building.md`, say so once and offer to write it from
`$CLAUDE_PLUGIN_ROOT/skills/seam-docs/templates/current/building.md` with `seam-docs`, rather than
improvising a contract. A start and finish line invented per session is the thing the doc exists
to replace. The offer is one line and it is **not a stop** — nothing in this method waits for
permission, and the loop below still applies.

## The loop

1. **Name the owning unit.** Before touching anything, find the row in the plan's `§ The units`
   that owns this work and say which one. Naming it is the step: "it is obviously in scope" is
   how implementation gets ahead of the plan.
2. **Write its test.** The row's `Proves it` cell is the test, settled when the plan was written,
   so there is nothing to design — write it, and watch it fail for the reason you expected. Where
   the output is a model's, there is no failing test for "it got the right answer": write the
   deterministic contract around it, as the doc says.
3. **Make it pass.** Then the finish contract, below.

## When no unit owns it

**Write the unit and carry on. Never stop to ask, and never build first.** Write the row in the
plan whose seam this is — what it makes true, the test that proves it, what makes it done — and
then take it through the loop. The row is what the person reads *in place of a diff*, so write it
plainly enough that a wrong direction is visible in the sentence.

Two things look like a gap and are not. Read the doc for both before writing a row:

- a change the doc says is too small to carry one;
- a change a document owns rather than a unit.

## Something turns up mid-task

A defect, a corner the plan did not mention, a better way. It is the same question — does a unit
own it? If one does, it is that unit's work and no more paperwork is needed. If none does, it is a
disposition, and **`seam-github` § Follow-ups owns the order** — plan it and do it, file it, or
ledger it. Do not park it in a transcript and do not build it first; those are the two ways it is
lost.

## Review findings

A round-one finding is about the output of the unit under review, so that unit owns the fix and
the start contract is already met. **Fold it in without writing a new row.** `seam-review`
§ Run the rounds says the same from its side; the two mandates would collide without it.

## Finishing

Run the doc's finish contract clause by clause against the unit, and **read the real output
rather than recalling what it should have said**. Where the output and a stated expectation differ,
that is a deviation: write the ruling before moving on, and move on — a ruling is not a stop.

**A ruling is short.** One dated entry in the repo's layer-3 file: what was decided, what was
set aside, and what it costs if wrong. A ruling longer than the deviation it records is ceremony,
and the doc's proportionality rule is the reason to cut it.

The PR's gate is `seam-github`'s, not this file's.
