# Context

**Layer 2 — Current.** What is true now about how much of a session's context a piece of work may
spend, and when work goes to a subagent instead. When this file is wrong, that is a **bug**, so the
edit rule is **amend in place**.

Owns: the **threshold table** and its four levels, **what triggers a level**, the **dispatch rule**,
and **where a session's own artifacts live**. Nothing else may define them.

## The one principle

> **Prefer disk over context.**

A window degrades before it ends: output truncates, state gets confused, and work already done gets
done again. So every action below is one move — put the thing on disk and read it back when it is
needed, rather than carrying it in the window until there is no room to finish.

Where this repo writes its build contract down too, this is the same move as that doc's ordering
rule, and the two halves are better read together: both get the thread's state out of the window
before the window runs out. Neither file owns the other's half.

## Thresholds

| Level | Usage at or above | Required action |
|---|---|---|
| **Green** | 0% | Continue. |
| **Yellow** | 50% | Summarise finished work to disk. Compact before a large read or dispatch. |
| **Orange** | 60% | Compact now. Start no new large reads; work from what is on disk. |
| **Red** | 75% | Stop new work. Write the handoff, commit, then compact or end the session. |

**Take the highest level whose floor the figure has reached** — the same way the fallback table
below is read. Floors rather than ranges, because a range has to pick a side at each boundary and
picks it twice: 75% in both Orange and Red is the same disagreement as 74.6% in neither. Every
figure reaches exactly one highest floor, and Green's is 0%.

**Every action above Green is the same one at a different strength: write to disk, and prefer disk
over context.** None of them is "be careful", because that is not an action anyone can take.

**Where compaction is the human's command rather than the session's**, the session still owes the
half that is its own: write the state to disk, then ask. **The gated work waits** — at Yellow the
large read or the dispatch does not go ahead on the strength of having asked, or the gate is not
one. An action that waits on someone else is not a reason to skip the part that does not.

**The bands are not re-derived per session.** They arrive with the method, already in use
elsewhere, and a band argued down on the day it binds is a band that never triggers again.

## What triggers a level

**The harness's own budget indicator, where there is one.** A figure the session can read beats
every proxy, and it stays right as the window fills. Read it rather than estimating — and read it
in the direction this table is keyed. **Usage is the fraction of the window already consumed.**
Where the harness reports what is *left* instead, which is the common case, the level is read off
100% minus that figure: "23% remaining" is 77% consumed, which is Red and not Green.

**Where there is none, count instead of feeling.** The fallback is the kind of thing that fills a
window, counted:

| Signal | Level |
|---|---|
| A fresh session; at most one agent dispatched | Green |
| Two or more agents dispatched, or five or more large reads — 200 lines each and up | Yellow |
| Two or more agents returned with output still in the thread, or a long debugging cycle | Orange |
| Tool calls behaving oddly, or a decision taken earlier in this session already lost | Red |

**Take the highest level whose row matches. Where none matches, the level is Green.** The counts
are lower bounds and the rows overlap on purpose, so a session that matches two takes the worse of
them: acting a level early costs a file written sooner than it had to be, and acting a level late
is the degradation this table exists to catch.

**Rows 2 and 3 share their count deliberately.** What separates them is not how many agents but
whether the spend is anticipated or realised: two dispatched is context about to be paid, two
returned with their output in the thread is context already paid. Change the counts together or
not at all.

Tune these counts here. They are a proxy, and one calibrated to someone else's session is the one
that reads Green while the window fills.

**The fallback exists because a table keyed on a percentage cannot be entered by a session that
cannot read one, and an unreadable threshold is the same as no threshold.**

## When to dispatch a subagent

A subagent is for **parallel** work or **detached** work, and nothing else.

- **Parallel** — the work is genuinely independent. No shared state, no step waiting on another
  step. Several run at once and the wall clock pays for one.
- **Detached** — the work would otherwise spend context this thread needs: a wide search, a sweep
  across many files, a long log. The thread wants the conclusion, not the transcript.

**And nothing else.** A dispatch costs a brief going out and a summary coming back, both of which
drop detail, and the thread cannot watch the work in between. Where neither reason holds, that cost
buys nothing — so do the work here. "It feels like a job for an agent" is not one of the two
reasons, and neither is wanting a second opinion on work this session just did.

A subagent does not inherit this window, which is what makes a detached dispatch worth anything —
and also why its brief has to carry what it needs. Writing that brief is the dispatching session's
job, not this file's.

## Where a session's own artifacts live

**`.seam/session/`, gitignored.** A summary written at Yellow, a handoff written at Red, a progress
file a dispatched agent leaves behind: all of it is this session's working state, read once by
whoever picks the thread up and stale after that. A harness that provides a scratch directory of
its own is the same answer — what matters is that the files are not in git and not under `docs/`.

**One file per writer, wherever they write.** Where agents run in parallel — which the dispatch
rule above licenses — each writes a scoped file of its own, never a shared path, and the name
carries the unit *and* the agent: `progress-<unit>-<agent>.md`, so *progress-7-schema.md* rather
than *progress.md* or *progress-7.md*, because two agents on one unit collide on anything shorter.
Two handoffs at one name is one of them silently overwritten, and whoever picks the thread up reads
the surviving agent's state as though it were both. The three example names are in italics and not
in backticks on purpose: a backticked `*.md` path is a **citation**, and `scripts/check_docs.mjs`'s A1
holds every one of them to resolving. An example filename is a form, not a file.

Add the line when this file is adopted:

```gitignore
.seam/session/
```

**Never under `docs/`.** Everything there is a document that owns a question, carries a layer and
is answerable for being wrong; a per-session scratch file is none of those — it is written to be
discarded, and the next session's copy contradicts it by design. `scripts/check_docs.mjs`'s A10 is what
would notice, since it requires a row in `docs/contributing.md`'s table for every markdown file under
`docs/` and a scratch file cannot earn one. But the row is not the reason. The reason is that the
file is not a document.

## What this does not own

- **Which model and which effort a dispatched agent runs at.** Pinned per artifact, by the doc that
  owns routing where this repo has one. This file decides *whether* to dispatch; that one decides
  what fires.
- **What the dispatched work is.** A unit of work is a plan's row — layer 5, under `docs/superpowers/specs` and `docs/superpowers/plans`.
- **Whether what comes back is reviewed, and how deeply.** The review policy's, and it does not
  care that an agent wrote the diff.
- **Why any of this is the rule here.** That is layer 3, `docs/decisions.md`.
