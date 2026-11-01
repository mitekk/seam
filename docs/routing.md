# Routing

**Layer 2 — Current.** What is true now about which model and which effort level each piece of
work runs at. When it is wrong, that is a **bug**, so the edit rule is **amend in place**.

Owns: the **model and effort pinned per artifact**, and this repo's **agent shape**. Nothing else
may define them.

## Model and effort are pinned to the artifact that owns the phase

That is the whole idea: the level is chosen by **which artifact fires**, rather than by anyone
remembering to ask for it. **This table is the only copy** — each agent and skill carries just its
own frontmatter value, and this row is what explains it.

| Phase | Owning artifact | Model | Effort |
|---|---|---|---|
| Planning — writing the unit | the planning skill, or the harness | — | session |
| Implement | `.claude/agents/<name>.md` | — | — |
| Dispatched subagent | the agent file the dispatch names | — | — |
| Code review | the review command | — | session |
| Commit / PR / merge | the tracker skill | — | — |

**The Implement rows arrive filled** where the answers named agents: one row per agent, carrying
the same model and effort its own file's frontmatter carries. Everything else is for you to fill.

Fill the Model and Effort columns for this repo. A `—` means **not pinned here**, which is
different from "no model": planning and review run at whatever the session is set to, because the
artifacts that perform them are owned by the harness or by a plugin, and there is nowhere in this
repo to pin them.

**Two of these phases come from another layer-2 doc.** Where this repo writes its build contract
down, *writing the unit* is a phase of its own: it happens before the work and it is where the
thinking is, so it is the row most worth pinning. Where it writes its context budget down, a
**dispatched subagent** is another — that doc decides *whether* to dispatch, and this row is what
the dispatched run fires at. A phase with no row here runs at whatever the session happened to be
set to, which is what this table replaces.

**An owning artifact may be something this repo does not own.** A phase is often performed by a
third-party skill or plugin installed per machine — a planning skill, a review command — and
naming it in the cell is the only way that phase has an owner at all. **Nothing third-party is
bundled with this method: it only lets a repo name what it already installed.** So write the
artifact the way it is invoked and mark it per-machine, because a level pinned in a file outside
this tree cannot be read back from here, and a row like that goes stale with nothing failing.

**Pin a higher effort where the output is the enforcement mechanism for something.** Work against
a written pattern is ordinary work; work whose output is what holds a position is not, and the
difference should be visible in this table rather than in anyone's judgement on the day.

## What voids this table

**Two environment variables.** If the harness offers an effort override or a model override, it
beats every value above — in agent and skill frontmatter alike. Name them here once they are
known, and say whether they are set.

**There is no way to ask a running agent what level it got**, which is why the levels are pinned
rather than asserted. That is a real limit: a wrong value here fails silently.

## Agents

One per seam, scoped to what this repo actually has. **A generic agent is worse than none** — it
reads the whole tree, knows which row of the table it is accountable to only by accident, and
hands back work nobody can place.

**This repo named no agents**, so there is no table here — an empty list is a complete
answer, for the reason above. The day one is written it gets a row, with the model and
the effort it is pinned to.

Each agent's own file states the layer rules it must follow — a lower layer cites a higher one and
never restates it; the artifact wins over every doc. That is in the agent template rather than
here, because an agent that has to look it up will not.

## What this does not own

- **Review depth.** The review level is review depth, not model effort — two dials that look like
  one. The review policy doc owns the level, where this repo writes one down; this file owns
  effort. Settling one does not touch the other.
- **Whether work goes to a subagent at all.** The context budget's, where this repo writes one
  down. That doc decides *whether* to dispatch; this one says what the dispatched run fires at.
- **When a unit gets written, and what done means.** The build contract's, where this repo writes
  one down. This file pins only what the session that writes the unit runs at.
- **Which doc owns what.** That is the sources-of-truth table in `docs/contributing.md`.
