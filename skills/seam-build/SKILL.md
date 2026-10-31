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

One thing looks like a gap and is not: a change a document owns rather than a unit. The doc says
what to do with it; read it before writing a row. Size sets how much ceremony the owner carries,
never whether there is one — the doc has the cut.

## Something turns up mid-task

A defect, a corner the plan did not mention, a better way. It is the same question — does a unit
own it? If one does, it is that unit's work and no more paperwork is needed. If none does, it is a
disposition, and **`seam-github` § Follow-ups owns the order** — plan it and do it, file it, or
ledger it. Do not park it in a transcript and do not build it first; those are the two ways it is
lost.

## Review findings

**Fold a round-one finding in without writing a new row**: it is about the output of the unit under
review, so that unit owns the fix. The doc says why, and `seam-review` § Run the rounds says the
same from its side; the two mandates would collide without it.

## Finishing

Run the doc's finish contract clause by clause against the unit, and **read the real output
rather than recalling what it should have said**. Where the output and a stated expectation differ,
that is a deviation: write the ruling before moving on, and move on — a ruling is not a stop.

**Write the ruling the doc's rulings section describes**, in the repo's layer-3 track and in the
shape that track defines — `adr.format` in `.seam/config.json` says whether that is a dated entry
in one file or a record of its own. **Keep it short.** A ruling longer than the deviation it
records is ceremony, and the doc's proportionality rule is the reason to cut it.

The PR's gate is `seam-github`'s, not this file's.
