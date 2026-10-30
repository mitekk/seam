# Plan-first implementation — design

*Written 2026-10-30. A design document, not a plan: it says what to build and why, and leaves the
sequencing to the plan that follows it.*

## Intent

seam currently makes a repo's **documentation** hold. It says nothing about how code gets written
against that documentation. The approach being driven to is **"plan first, implement accordingly"**,
and this design is the layer that makes that ordering real rather than advisory.

### The why, from measurement rather than preference

Two classes of error, with two different detectors today:

- **A wrong implementation of a right plan** is caught by the diff review — `seam-review`, two
  rounds, measured and already shipped.
- **A right implementation of a wrong direction** is caught by **a human watching the session in
  real time**, who then asks for a fix.

The second detector is the problem. It is cheap for the person in the moment and expensive in every
other way: it does not survive them stepping away, it does not survive the session, and the
correction lands in a transcript rather than in the repo. Next session knows nothing about it.

**And the tell is sequential, not semantic.** The owner's words: *"it usually happens when the
implementation is ahead of planning."* The direction goes wrong because no plan covers the part
being built — not because the plan said something false. That matters enormously, because sequence
is checkable in a way that "is this direction right" never will be.

## Goals

1. **Make the written unit precede the work**, so a wrong direction is visible as a sentence before
   it is visible as a diff.
2. **Make TDD the mechanism by which a plan unit becomes code**, rather than a discipline sitting
   beside the plan.
3. **Give a work unit a completion contract** — what "done" means for one unit, not for a PR.
4. **Reorder the follow-up dispositions** so that covering corners is planned and done, not filed.
5. **Make context economy explicit**: compact before quality degrades, and detach work that would
   otherwise cost context.

## Non-goals

- **A second package.** This lands in seam. See § Packaging.
- **Copying campaign's skills.** `campaign-github` is already generalised as `seam-github`;
  `state-machine-change` is campaign's content; the four agents are what seam's non-goal 2 refuses
  to ship.
- **Vendoring third-party skills.** superpowers, `/code-review` and similar are named by a repo's
  routing doc, never bundled.
- **Asserting the unassertable.** Subagent dispatch and context discipline get written rules and
  measurements, not CI assertions.

## Anti-goals

The owner's, verbatim: **"having the effort not worth it in the finish line."**

The ceremony must not cost more than it saves. Concretely, this design fails even if every piece
works when:

- a one-line fix needs a new plan unit, a DoD and a ruling;
- a threshold table makes a session stop and write state files more often than it does work;
- a written artifact is produced that nobody ever consults.

Two further failures, inherited from seam's own anti-goals: enforcement so strict that the first
real change goes red for the wrong reason, and a doc set so large nobody reads it.

## Constraints

- **The plugin holds method and templates, never decisions.** Every rule here needs a home: a
  repo-owned doc for the decision, plugin prose for how to write it.
- **Two artifacts per repo, and A11 keeps them honest** — `docs/**` and `.seam/config.json`.
- **Anything mechanical must be local, offline and deterministic**, like every existing assertion.
- **Nothing may require the person's presence.** The whole point is that the live detector stops
  being load-bearing.

## What was decided, and by whom

### Decided by the owner

| | |
|---|---|
| **The ordering rule is in-flight, not CI.** | Asked which half mattered; the answer was "in-flight". CI is a backstop at most. |
| **Plan and carry on.** | The session names the gap, writes the unit, and continues. It does **not** stop for permission. An earlier reading of mine — stop and show the gap — was corrected. |
| **TDD defines the implementation strategy according to the plan**, and settles with the plan in advance. | Their words. TDD is not a parallel discipline. |
| **DoD is the completion of the work unit.** | Their words. Scoped to a unit, not a PR and not a milestone. |
| **Fold in by default, to avoid inflating the issues to grasp.** | Their words. The board becoming unreadable is the cost being avoided. |
| **Prefer planned-and-implemented over a new issue.** | *"I'd rather it planned and implemented instead directly go with new issue just because we need to cover some corners."* Filing is for genuine complexity; covering corners is part of the work. |
| **Context: compact before it gets too large and dumb, saving tokens along the way.** | Their words. Degradation, not just cost. |
| **Sub-agents when it benefits — parallel working or detached work.** | Their words. Two legitimate reasons, no others named. |

### Decided by me, as my call

| | |
|---|---|
| **One package, not two.** | Asked for pros and cons and did not rule. Measured: seam's four skills cost ~450 words of description per session; three more adds ~500 tokens, so load cost is not a reason to split. A sibling package would re-derive the config, the layering and the method/decision split — seam's non-goal 3. The honest case for splitting is change cadence, and it loses. |
| **A plan unit names the test that proves it.** | My reading of "settles nicely with the plan in advance". It makes the plan-coverage check and the TDD check the same check. |
| **Ceremony scales with blast radius**, using seam's existing Small/Medium/Large. | Follows directly from the anti-goal. |
| **The finish-line test: a written artifact nobody consults is the failure.** | The anti-goal needs a detectable form or it is only a worry. |
| **Specs get a layer-5 row.** | This document trips A10 without one. A spec is superseded wholesale and owns nothing, which is layer 5 exactly. |

## The design

### One principle

> **The written unit comes before the work, and nothing stops for permission.**

A ruling gets written and work continues. A plan gap gets a written unit and work continues. The
only forbidden move is **building before the writing**.

This is why it improves the owner's real-time review rather than replacing it. They remain the
detector for a wrong *direction* — but they react to a written unit instead of inferring direction
from code that already exists. Smaller artifact, earlier, cheaper to reverse.

### Four faces of the plan

**1 · The plan carries the test.** A unit states the test that proves it, settled when the plan is
written. Naming the owning unit therefore hands you the test to write first, and TDD stops being
advice: the test predates the code in the *plan*, not merely in the commit. Campaign's existing
exemption carries over unchanged — for a non-deterministic output there is no failing test for "it
got the right answer", so what is written first is the deterministic contract around it.

**2 · Start contract.** Before touching anything: name the unit that owns it. If none exists, the
gap is written as a unit and work continues.

**3 · Finish contract.** A DoD scoped to the work unit: the named test ran and its output was read,
every stated expectation was compared against real output, and every deviation has a written
ruling. This is not a new invention — it is the completion contract that governed this build — but
it is currently a skill nobody's repo owns.

**4 · Dispositions, reordered.** Today `seam-github` leads with size. The new order:

| | Disposition |
|---|---|
| A unit already covers it | do it now |
| No unit covers it, worth the time | **plan the unit, then do it** |
| No unit covers it, genuinely complex | file an issue |
| True, not worth the time | one ledger row |

The second row is new, and it now outranks filing. **This reverses a shipped rule** —
`seam-github` § Follow-ups currently says Small or Medium folds in on size alone, and under the
ordering rule a small thing no unit owns is still implementation ahead of planning. A reversal is a
new dated decision record, not an edit to the old one.

### Context economy — the second spine

Two instruments for one concern, and neither is CI-assertable:

- **Compaction before degradation.** A threshold table by context usage, each level with a required
  action, and every action the same shape: write to disk, prefer disk over context. `agent_starter`
  already has one with Green/Yellow/Orange/Red levels; its thresholds are general and its
  per-agent heuristics are not.
- **Detached and parallel work.** A subagent is a token strategy with a parallelism bonus.
  Dispatch when the work is genuinely independent, or when it would otherwise spend context the
  main thread needs. Nothing can read back what level a running subagent got, which is why the
  routing table pins rather than asserts.

**The two spines meet at one artifact.** "Prefer disk over context" and "write the unit before the
work" are the same move. This build is the evidence: the plan went to disk inside the first twenty
minutes and a ledger carried 28 rulings, so compaction could not lose the thread.

### What is mechanical, and what is procedural

Deliberately split, because mixing them dilutes the claim that seam's assertions mean something.

| | Instrument |
|---|---|
| A commit whose issue reference no plan unit owns | **Mechanical** — invert A8, which already parses plans' issue tables. A backstop, not the primary detector. |
| A test's first commit precedes or accompanies its implementation's | **Mechanical, and novel** — readable from git history. Worth a planted-drift fixture. |
| The ordering rule, the DoD, the dispositions | **Procedural**, like the review precondition — their mechanical half is not buildable in-flight. |
| Context thresholds, subagent dispatch | **Procedural and measurable per session**, never asserted. |

### Repairs that belong with this work

Three sections were trimmed out of `campaign-github` during generalisation and were general:

- **no merge procedure** — `seam-github` gates the merge and then says nothing about performing it;
- **no post-merge teardown**;
- **no owned-row invariant** — how status reporting knows the active milestone, which the
  follow-up qualifier's third clause depends on.

## Left to the builder

- **The format by which a plan unit names its test.** The plan executed in this build used an
  `Expected:` line per step; whether that is the shape is open.
- **Where each rule lives** — which are new skills, which extend `seam-github` and `seam-review`,
  and which are new repo-doc templates. At least one new layer-2 doc is implied (a `docs/building.md`
  or equivalent) plus a deepened `docs/routing.md`.
- **The threshold table's numbers.** `agent_starter` uses 50 / 60 / 75 %. Reuse or re-derive.
- **How the start contract is honoured in-flight** without becoming a tax: what counts as "a unit
  covers this" for a two-line edit, and where the proportionality cut sits.
- **Whether the three repairs ride along or ship separately.**
- **Whether the `docs/routing.md` template should name third-party skills per phase**, which is how
  campaign actually routes work.
- **The finish-line measurement**: how a session reports whether what it wrote was consulted.

## Open questions

- Nothing in this design records a *direction correction* durably. When the owner says "not that
  way", that is a decision; today it lands in a transcript. Whether it should feed layer 3 is
  unresolved.
- The ruling ledger's value is unproven at scale: 28 entries in this build, consulted once. That is
  close to the anti-goal's line.
