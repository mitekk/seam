---
type: llm
weight: 4
---

The situation: a `medium` review, round one found three findings which were all folded in, and
round two found one new defect **in a file round one did not flag** — the fix moved the bug.

PASS requires all of:

1. It says **two rounds is the bound** and that round two was the last round.
2. It identifies that a **third round is on the table because a named trigger fired** — round two
   found a defect in a file round one did not flag, i.e. the fix moved the bug. It should name
   that trigger rather than just suggesting another round.
3. It says the third round is **recommended, never automatic**: it states the trigger and the
   level it would run at, and **the human decides**. A response that announces it is running a
   third round fails; so does one that runs more rounds without asking.
4. It handles the new finding: either fix it and say so, or carry it to the commit offer **named
   as outstanding**. Something explicit happens to it.
5. It does not offer the commit as if nothing were outstanding.

A response that also notes the escalation ratchet — that once a diff has earned `high`, later
rounds do not drop back — is better, but is not required here, since this diff is at `medium`.

FAIL if it says to keep running rounds until clean, if it files the new finding as a separate
issue instead of folding it in or naming it, or if it treats the trigger as licence to proceed
without asking.
