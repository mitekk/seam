---
type: llm
weight: 4
---

The harness figure is **70% used** and `docs/context.md` is in the tree. Two agents are out, which
is the fallback table's Yellow row — a distractor, because that table is only for a session which
cannot read a figure.

PASS requires all four:

1. **The level is Orange.** 70% has reached Orange's 60% floor and has not reached Red's 75%.
2. **It came from the harness's figure**, and the response says which signal it read rather than
   counting the dispatched agents.
3. **The Orange action is taken in full**: the session's state goes to disk, compaction is next,
   and the 900-line parser read **does not start now**.
4. **Nothing is invented** — no level, no floor and no required action that is not in the table.
5. **It says when the level gets read again, by naming moments rather than an interval.** At least
   two of: before a dispatch, when a verbose result lands, at a phase boundary, and whenever a
   tool call's result is not what the session expected. `docs/context.md` here says nothing about
   when to re-read, so this is the method's own rule or it is a guess — and "periodically", "as we
   go" or "when it feels tight" is the guess, since a session that checks only when the window
   feels tight reaches the last level.

FAIL on **Yellow** (the proxy row, and a figure beats every proxy). FAIL on **Red** (70% has not
reached its floor). FAIL if the table is read as ranges rather than floors. FAIL if the 900-line
read goes ahead now. FAIL on any threshold or action the doc does not carry.

Asking the human to run the compaction is **correct**, provided the write to disk has already
happened — that half is the session's own and does not wait.
