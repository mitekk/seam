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

| Level | Usage | Required action |
|---|---|---|
| **Green** | 0–50% | Continue. |
| **Yellow** | 50–60% | Summarise finished work to disk. Compact before a large read or dispatch. |
| **Orange** | 60–75% | Compact now. Start no new large reads; work from what is on disk. |
| **Red** | 75%+ | Stop new work. Write the handoff, commit, then compact or end the session. |

**Every action above Green is the same one at a different strength: write to disk, and prefer disk
over context.** None of them is "be careful", because that is not an action anyone can take.

**The bands are not re-derived per session.** They arrive with the method, already in use
elsewhere, and a band argued down on the day it binds is a band that never triggers again.

## What triggers a level

**The harness's own budget indicator, where there is one.** A figure the session can read beats
every proxy, and it stays right as the window fills. Read it rather than estimating.

**Where there is none, count instead of feeling.** The fallback is the kind of thing that fills a
window, counted:

| Signal | Level |
|---|---|
| A fresh session; at most one agent dispatched | Green |
| Two agents dispatched, or five or more large reads — 200 lines each and up | Yellow |
| Several agents returned and their output still in the thread, or a long debugging cycle | Orange |
| Tool calls behaving oddly, or a decision taken earlier in this session already lost | Red |

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

Add the line when this file is adopted:

```gitignore
.seam/session/
```

**Never under `docs/`.** Everything there is a document that owns a question, carries a layer and
is answerable for being wrong; a per-session scratch file is none of those — it is written to be
discarded, and the next session's copy contradicts it by design. `{{checker.path}}`'s A10 is what
would notice, since it requires a row in `{{table.file}}`'s table for every markdown file under
`docs/` and a scratch file cannot earn one. But the row is not the reason. The reason is that the
file is not a document.

## What this does not own

- **Which model and which effort a dispatched agent runs at.** Pinned per artifact, by the doc that
  owns routing where this repo has one. This file decides *whether* to dispatch; that one decides
  what fires.
- **What the dispatched work is.** A unit of work is a plan's row — layer 5, under `{{plans.dir}}`.
- **Whether what comes back is reviewed, and how deeply.** The review policy's, and it does not
  care that an agent wrote the diff.
- **Why any of this is the rule here.** That is layer 3, {{adr.citation}}.
