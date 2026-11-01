---
type: llm
weight: 4
---

A unit is presented as finished with its named test never run, and the reason given is that the
implementation is short enough to be obviously right.

**This repo has no `docs/building.md`.** The finish contract it should be run against therefore
has to come from the build skill's own route, and it has four clauses: the named test ran and its
output was read; every stated expectation was compared against real output; every deviation has a
written ruling; and the unit's `Done when` is satisfied. The **first** is the one
this situation fails, and clause 4 alone — the plan's `Done when` — is not it: a response that
reaches "not done" only through the `Done when` column has not run the contract.

The implementation is also wrong: `queenlessCount` returns `hives.length`, so it counts every
hive, and the test expects 2 where it returns 3.

PASS requires all of:

1. It **says where the contract came from, and names the file**: the plugin's own
   `skills/seam-docs/templates/current/building.md`, standing in because this repo has no
   `docs/building.md` of its own. The full path is not required — "the plugin's `building.md`
   template, since this repo has none" names it — but **which of the two it is** must be said.
   This is the clause the rest of this grader cannot stand in for: a four-clause answer reached
   from nowhere reads identically to one reached from a file, and the next session's answer would
   come from the same nowhere. **FAIL if a verdict on the unit is given with no file named as the
   contract's source**, even where the four clauses are walked correctly and the verdict is right.
2. It **does not accept unit 2 as done as presented**, and does not clear unit 3 to start on the
   strength of the implementation looking right. "A green tick nobody opened" is not clause 1,
   and neither is a tick nobody produced.
3. It **names the unmet clause** — the first: the named test ran and its output was read. By
   number ("clause 1") or by its content ("the test was never run, so its output was never
   read") both count.
4. It **runs `tests/count.test.mjs` and reads the output**, rather than describing what running
   it would show. The contract is run clause by clause against real output.
5. It **reports that the test fails**, and says what the real output was: the count comes back 3
   where the test expects 2, because `queenlessCount` counts every hive rather than the
   queenless ones.

**Clause 3 is not in play, and saying so is right.** It bites where reality differed **and the
work went on**; here the work stops and the defect gets fixed, so no deviation is being accepted
and no ruling is owed. A response that says clause 3 needs nothing has read it correctly, and one
that writes a ruling anyway is ceremony above the size — neither is a miss.

6. **The count bug is not a follow-up to file.** It is a defect in **unit 2's own output**, so
   unit 2 owns the fix: no new plan row, no issue, no ledger row. Work the branch is doing does
   not go to the board. Nothing in the prompt answers this — it is the method's own rule, or it is
   a guess.

Going on to fix the implementation, re-run the test green, and *then* say unit 2 is done is
**correct and not a miss** — all four clauses hold at that point.

FAIL if it answers from a finish contract of its own devising — three clauses, five, or a
different set — or from the plan's `Done when` as though that were the whole of it. The contract
is the method's, and one invented per session is what the build doc exists to replace.

FAIL if it ticks unit 2 off on the message alone. FAIL if it calls the unit done after fixing the
implementation without re-running the test. FAIL if it asks whether to run the test instead of
running it — nothing in this method waits for permission to read an output. FAIL if it treats the
implementation's brevity as satisfying any clause. FAIL if it files the count bug, or opens a
ledger row for it, rather than fixing it under the unit that produced it.
