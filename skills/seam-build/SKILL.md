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

## Step 0 — name where the contracts are being read from

**No `docs/building.md` in the repo does not mean no contract.** It means the contract for this
session is `$CLAUDE_PLUGIN_ROOT/skills/seam-docs/templates/current/building.md`, read now, and
the offer to write the repo its own from that template with `seam-docs` is one line alongside —
**not a stop**, because nothing in this method waits for permission.

So **say which of the two the contracts came from, in one line, before step 1** —
`Contracts: <the file> — <repo doc | plugin template standing in>` — and name that same file
again with the verdict in § Finishing. A source that cannot be named is a contract that was invented,
which is the thing the doc exists to replace, and naming it is the only way the difference is
visible from outside the session.

**If neither file is readable, this procedure cannot be completed, and that is where it stops.**
Say the finish contract is not reachable and that nothing can be called done against a contract
nobody read. **Do not put the plan's `Done when` cell in its place** — a plan is layer 5 and owns
which units exist, not what done means, so a verdict reached through that cell alone is a verdict
with no contract behind it. This is the one ending here that is a stop, and it stops because the
written procedure has run out, not because it is waiting on an answer.

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
disposition, and **`seam-github` § Follow-ups owns which of the four it takes** — read it there
rather than guessing. Do not park it in a transcript and do not build it first; those are the two
ways it is lost.

## Review findings

**Fold a round-one finding in without writing a new row**: it is about the output of the unit under
review, so that unit owns the fix. The doc says why, and `seam-review` § Run the rounds says the
same from its side; the two mandates would collide without it.

## Finishing

Run the finish contract clause by clause against the unit — or against the owning document,
where a document owns the change — **naming the file step 0 resolved it from** and **reading the
real output rather than recalling what it should have said**. Every clause gets a verdict; a
verdict on the unit that walks fewer clauses than the contract has is a verdict on part of it.
Where the output and a stated expectation differ, that is a deviation: write the ruling before
moving on, and move on — a ruling is not a stop.

**A clause that does not hold is not a question.** The unit is not done, and what that clause asks
for is the rest of its work: do it now, then run the contract again from the top. Offering the fix
and waiting is the shape this step fails in most often, because it reads as diligence —
`docs/building.md` § The one principle is why it is not.

**Write the ruling the doc's rulings section describes**, in the repo's layer-3 track and in the
shape that track defines — `adr.format` in `.seam/config.json` says whether that is a dated entry
in one file or a record of its own. **Keep it short.** A ruling longer than the deviation it
records is ceremony, and the doc's proportionality rule is the reason to cut it.

**In a `madr` repo that is one record per ruling, never one record collecting several.** A record
is byte-frozen the moment it is on the default branch, so a batch record cannot be appended to
after the branch it was opened on merges — the second ruling would be an edit to frozen bytes.
A `single` repo has no such constraint, because that file is held to a prefix check instead and a
dated section still at the end of it stays open.

The PR's gate is `seam-github`'s, not this file's.
