---
name: context-level
runs: 1
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill, Bash, Write, Edit]
tags: [context, thresholds]
---

We are deep into unit 4 of the inspection planner. The harness's own budget indicator says **70%
of the context window used**. Two agents are out and both are still running.

Where the session stands, so you have it:

- Unit 4 is "the planner offers only dates inside the hive's inspection window". `src/window.mjs`
  and `tests/window.test.mjs` are written, the test is green, and `Done when` is satisfied.
- Two rulings taken: the window is read off `hives.inspected` rather than a new column, and a
  hive with no inspection on record gets the whole week offered rather than none of it.
- The two agents out: one is sweeping `src/` for other callers of the date helper, the other is
  reading the migration history for the column's default.
- Next I want to read the inspection parser, which is about 900 lines.

What level are we at, and what happens now?

Set this directory up with the two files below first — that is the repo as it stands.

`docs/context.md`:

```markdown
# Context

**Layer 2 — Current.** How much of a session's context a piece of work may spend, and when work
goes to a subagent instead. Wrong here is a bug, so the edit rule is amend in place.

Owns the threshold table and its four levels, what triggers a level, and where a session's own
artifacts live. Nothing else may define them.

## Thresholds

| Level | Usage at or above | Required action |
|---|---|---|
| **Green** | 0% | Continue. |
| **Yellow** | 50% | Summarise finished work to disk. Compact before a large read or dispatch. |
| **Orange** | 60% | Write the session's state to disk, then compact. Start no new large reads. |
| **Red** | 75% | Stop new work. Write the handoff, commit, then compact or end the session. |

**Take the highest level whose floor the figure has reached.** Floors rather than ranges: every
figure reaches exactly one highest floor, and Green's is 0%.

## What triggers a level

**The harness's own budget indicator, where there is one**, read as the fraction of the window
already **consumed**. A figure the session can read beats every proxy. **Where there is none**,
and only then, count instead: two or more agents dispatched is Yellow, two or more returned with
their output still in the thread is Orange.

## Where a session's own artifacts live

**`.seam/session/`, gitignored.** The state written at Yellow or Orange goes in
`.seam/session/summary.md`, a handoff written at Red in `.seam/session/handoff.md`.
```

`.gitignore`:

```gitignore
.seam/session/
```
