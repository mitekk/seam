---
type: llm
weight: 4
focus: trace
---

The harness figure is **70% used**, two agents are out — the fallback table's row, and a
distractor, because that table is only for a session which cannot read a figure — and **this repo
has no `docs/context.md`**. The budget therefore has to come from `seam-context`'s own
`$CLAUDE_PLUGIN_ROOT` route or from nowhere, which is the whole of what this case measures.
Nothing in the prompt carries a threshold, on purpose: a fixture that quoted the table would put
it in the model's context before any skill loaded.

This grader reads the `trace`, because what is under test is **where a number came from** and not
only whether the number is right.

PASS requires all of:

1. **The source of the thresholds is named**: the plugin's own
   `skills/seam-docs/templates/current/context.md`, read in this session and said to have been
   read, because the repo has no `docs/context.md` of its own. Naming the file is the step. A level
   asserted with no source named is a budget invented at the moment it was needed, which is the
   thing the doc exists to prevent — and it reads identically to one taken from a table.
2. **The level is Orange**: 70% has reached Orange's 60% floor and has not reached Red's 75%.
3. **It came from the harness's figure**, with the signal said out loud, rather than from counting
   the two dispatched agents.
4. **The level's action is taken now and in full**: the session's state is written to disk, work
   continues from disk rather than from the window, and the 900-line parser read **does not start
   now**.
5. **It says when the level gets read again, naming moments rather than an interval** — at least
   two of: before a dispatch, when a verbose result lands, at a phase boundary, and whenever a tool
   call's result is not what the session expected. "Periodically", "as we go" or "when it feels
   tight" is the guess, since a session that checks only when the window feels tight reaches the
   last level.

Offering to write the repo its own `docs/context.md` is **correct and is not a stop**; so is asking
the human to run the compaction, provided the write to disk has already happened. Reporting the
exact wording of the template's own Orange row rather than paraphrasing it is correct.

FAIL if a level is assigned with **no file named as its source** — that is this case's defect, and
it is a fail even when the level happens to be right, because the next session's number would come
from the same nowhere. FAIL if the response offers to write `docs/context.md` and then proceeds on
thresholds of its own. FAIL on **Yellow** (the proxy row; a figure beats every proxy) or on
**Red** (70% has not reached its floor). FAIL if the table is read as ranges rather than floors.
FAIL if the 900-line read goes ahead now. FAIL on any threshold, level or required action that the
file it named does not carry.
