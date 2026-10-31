---
name: seam-context
description: >
  Follows the repo's `docs/context.md` while a session runs: reading the context level, taking
  the action that level requires, and deciding whether a piece of work is dispatched to a
  subagent or done here. Use this before dispatching an agent, when a verbose result lands,
  at a phase boundary, and on any mention of context, tokens, compacting, running low or
  running out of room — and whenever the question is whether to spawn a subagent at all.
  Does NOT name the unit a change belongs to or run the finish contract (that is seam-build),
  does not gate the commit, push or merge (seam-github), does not pick the review level or run
  the rounds (seam-review), and does not own the doc layer (seam-docs).
---

# Context economy

**Locate the repo's `docs/context.md` and follow it.** It owns the threshold table, what triggers
each level, the dispatch rule, and where a session's own artifacts live. This file is how to run
that doc during a session; it never answers a question the doc answers.

If the repo has no `docs/context.md`, say so once and offer to write it from
`$CLAUDE_PLUGIN_ROOT/skills/seam-docs/templates/current/context.md` with `seam-docs`, and read the
template meanwhile. A budget invented at the moment it is needed is the one that gets argued down,
which is what the doc exists to prevent. The offer is one line and it is **not a stop**.

## The loop

1. **Read the level off the doc's triggers.** The doc says what to read first and what to fall back
   to when it is not there. Do not substitute a feeling about how long the session has been.
2. **Say the level and the signal it came from**, in one line —
   `Context level: <level> — <the signal it was read from>`. A level assigned silently is one
   nothing can be held to, and the whole point of naming it is that the next action is chosen from
   it rather than from the mood of the session. Take both names from the doc; an example written
   here would be a copy of one of its rows.
3. **Take the level's action, now and in full.** The doc says what each level requires. Where that
   action is to write something, the written file is what makes it done; saying it will be written
   is not the action.
4. **Run the loop at the moments it pays** — before a dispatch, when a verbose result lands, at a
   phase boundary, and when a tool call behaves unexpectedly. A session that only checks once the
   window feels tight arrives with one level left, and that level's action is to stop.

## Dispatching

**The doc's dispatch rule decides, and it is a closed list.** Check the work against it *before*
dispatching; where the work matches none of the reasons the doc gives, do it in this session. The
reasons are not repeated here — a closed list kept in two places is how one copy grows a third
entry.

Once something is dispatched, wait for it rather than also doing it here, and never report a
pending agent's findings before they arrive.

## Briefing a detached agent

**The doc hands the brief to the dispatching session, so it is written here.** Write it as the
agent's whole context: the goal, the files and docs worth reading, what has already been ruled out,
and the scope, narrowly. Say what the report must contain, because the report is all that comes
back.

**If the brief would have to paste this thread's context into itself, the work is not detached.**
The dispatch then saves no context and loses the judgement built up here: do it in this session.
A brief you cannot write clearly is the same signal — the task is not understood well enough to
hand over yet.

The agent runs its own session against the same doc, and nothing here can read back what level it
reached.

**`level` is an overloaded word around here.** A context level is what this file and its doc
mean by it; a review level is `seam-review`'s, and it is review depth. Neither reads the other.
