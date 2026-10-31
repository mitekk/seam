# Building

**Layer 2 — Current.** What is true now about how a change gets written against the plan. When
this file is wrong, that is a **bug**, so the edit rule is **amend in place**.

Owns: the **start contract**, the **finish contract**, the **test-first rule**, and the
**proportionality rule** with the three sizes it is built on. Nothing else may define them. Which units exist is the plans' to say,
and the PR and the review have their own owners — see the end of this file.

## The one principle

> **The written unit comes before the work, and nothing stops for permission.**

A ruling gets written down and work continues. A plan gap gets a written unit and work continues.
The only forbidden move is **building before the writing**.

That makes it an *ordering* rule and not a gate: the session never stops to ask whether something
may be planned, and it never starts building ahead of the plan. It leaves the gates the tracker
conventions own — pushing and merging — exactly where they were.

## The start contract

**Before touching anything, name the unit that owns it.** A unit is a row in a plan's
`§ The units` table: what it makes true, the test that proves it, and when it is done. It is a step
inside a plan and **not an issue** — planning something is not filing it — so a unit needs no issue
number. A commit still cites issues with `Closes #N` and `Part of #N`; a unit with no issue is
cited by its row.

- **A unit owns it** → start. The row hands you the test to write first.
- **No unit owns it** → **write the unit, then carry on.** One row, in the plan whose seam this is:
  what it makes true, the test that will prove it, what makes it done. Do not stop to ask whether
  the unit may exist, and do not build until it is written. If no plan covers the area at all,
  ask for one with the `seam-docs` skill, which writes it from the layer-5 template; a plan is a
  doc, so it gets a row in `{{table.file}}`'s table like any other.
- **A document owns it** — an ops change, a decision, a doc fix → a change with no owning unit may
  **name the document that owns it** instead. Units are for building; without this the start
  contract would block work that has no test to write.

**Something noticed mid-task is the same question**, not a reason to stop and not a reason to
build. Does a unit own it? If so it is part of that unit's work. If not, it is a disposition — plan
it and do it, file it, or ledger it — and the tracker conventions own that order. This file does
not repeat it.

## Rulings and direction corrections

**A ruling is written the moment it is taken**, in {{adr.citation}}, in the shape that layer-3
track already defines for an entry. Work then continues; a ruling is never a reason to stop.

A **direction correction** is a decision too. When the person says "not that way", it lands in the
same place before the work goes on, so it outlives the session. A correction that lives only in a
transcript is the one the next session makes again.

## The finish contract

**Done is a property of the unit** — not of the PR, which has its own gate, and not of the
milestone. A unit is done when all four hold:

1. **The named test ran and its output was read.** The test in the unit's `Proves it` cell, run,
   with its output read rather than assumed. A green tick nobody opened is not this.
2. **Every stated expectation was compared against real output.** What the unit, the plan or a
   ruling said would happen is set beside what did happen.
3. **Every deviation has a written ruling.** Where reality differed and the work went on, the
   difference is written down before the next unit starts. A deviation with no ruling is a surprise
   left for whoever reads the diff.
4. **The unit's `Done when` is satisfied.** That cell is the plan's own words for done; the first
   three clauses do not stand in for it.

## Test first, because the plan carries the test

A unit names the test that proves it, **settled when the plan is written**. So naming the owning
unit hands you the test to write first, and TDD is not a discipline running beside the plan: it is
*how a unit becomes code*. The test predates the code in the plan, not merely in the commit.

Write the test, watch it fail — for the reason you expected, not a typo or a missing import —
then make it pass. A test that was never red has proved nothing about the code under it.

**The exemption is for non-deterministic output.** For a non-deterministic output there is no
failing test for "it got the right answer", so what is written first is the deterministic contract
around it: the schema the response must parse into, its rejection cases, and the failure path. Do
not fake a red-green cycle around the model call itself. The unit's `Proves it` names that
contract's test; how good the output is gets measured and read by a person, not asserted.

**What `{{checker.path}}` reads, and what it does not.** Two assertions read the mechanical half,
each only where this repo has it on. A14 reads the *shape* of a plan's `§ The units`: each unit
names a test that exists and asserts something. A15 reads from git history that a test arrived
before or with the implementation it proves. **Neither reads coverage** — whether a unit owns the
work being done. That is an in-flight judgment, and it is what the start contract is for.

## Ceremony scales with blast radius

Without this the ordering rule becomes a tax on one-line fixes, and a rule that taxes one-line
fixes gets switched off. **A Small change inside a unit that already exists gets no new unit, no
DoD and no ruling.** Run that unit's test and go on.

| Size | What it is | Ceremony |
|---|---|---|
| Small | one file, no new test | a unit owns it, or a document does: none. Neither does: one row, and still no DoD and no ruling |
| Medium | anything in between — a handful of files, or a test that does not exist yet | both contracts; if no unit owns it, write the row |
| Large | crosses a structural seam — a schema, a state machine, two runtimes | both contracts, and expect rulings: say what each costs if wrong |

**This table is the only copy of the sizes.** The tracker conventions sort follow-ups by the same
three, and they cite this file for them rather than defining their own. A size is **blast radius,
not felt effort**: a one-line fix to a sentence in a doc is Small, and so is a typo in a README —
and a document owns those, so they need no row.

**"A unit covers this" means you can point at the row.** The change sits inside what that row says
it makes true, or it is a defect in what that row built. A defect in a unit's output belongs to
that unit, so fixing one is not new work and needs no new row. A Small change that **no** row and
no document covers is a plan gap like any other, and the cheapest way to meet the start contract
is one row — a sentence and the existing test that would catch it.

**The failure to watch for in this rule itself** is effort that is not worth it at the finish line.
A unit, a DoD or a ruling that nothing later reads — not the work, not the finish contract — is
ceremony applied above its size, and the way to correct it is to stop writing it.

## A review finding belongs to the unit under review

The review policy has every round-one finding folded into the branch in flight, and the start
contract would otherwise want a unit for each. The two do not collide. **A round-one finding is
about the output of the unit under review**, so that unit owns the fix and the start contract is
already satisfied: fold it in, write no new row, carry on.

A finding whose fix has to change something **outside** the unit under review is a different case.
That change has its own owner, and the start contract applies to it as to anything else.

## What this does not own

- **Which units exist, and in what order.** That is layer 5, the plans in `{{table.file}}`'s table.
- **Whether something noticed becomes a unit, an issue or a ledger row.** The tracker conventions.
- **The PR's gate and the review.** The finish contract is one unit's; the check list, the review
  and the push belong to the tracker conventions and the review policy.
- **Why any of this is the rule here.** That is layer 3, {{adr.citation}}.
