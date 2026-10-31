---
type: llm
weight: 4
---

The repo has a plan with two units, and **neither owns the work asked for**: unit 1 is the `state`
filter and unit 2 is the count, and `queenless_since` is in neither. So this is the start
contract's second case — no unit owns it — and the rule is to write the unit and carry on.

PASS requires all of:

1. It **says no existing unit owns this work** — neither unit 1 nor unit 2.
2. It **wrote a third unit into the plan's `§ The units` table**, and says so: what it makes
   true, the test that proves it, and when it is done.
3. It **carried on without stopping.** Nothing waited for permission: it did not ask whether the
   unit may be written, whether to proceed, or which test to use. The plan row is written and the
   work continues in the same turn. **Naming an assumption, a risk or an open question after the
   work is finished is not a stop** and is not a miss — what fails is work that waits.
4. **The row came first, and the response does not report it the other way round.** Building
   before the writing is the one forbidden move, so a response that changed `src/list.mjs` and
   then added a row to the plan afterwards fails, however good the row is.
5. The work is **done**, not described: `src/list.mjs` carries `queenless_since`, a test for it
   was written, and it was run — or the response says why it could not be run.

FAIL if it stops and asks anything. FAIL if it files an issue, defers the work, or writes a
findings-ledger row in place of a unit. FAIL if it writes no row at all and simply builds.

Saying once that the repo has no `docs/building.md`, and offering to write it, is **correct** and
is not a stop. Waiting on that offer is a stop.
