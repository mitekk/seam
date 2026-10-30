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
| Planning | the harness | — | session |
| Implement | `.claude/agents/<name>.md` | — | — |
| Code review | the review command | — | session |
| Commit / PR / merge | the tracker skill | — | — |

Fill the Model and Effort columns for this repo. A `—` means **not pinned here**, which is
different from "no model": planning and review run at whatever the session is set to, because the
artifacts that perform them are harness-owned and there is nowhere in this repo to pin them.

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

| Agent | Scope | Reads before changing |
|---|---|---|
| `<name>` | `<the paths and the subsystem>` | `<the source-of-truth row it is accountable to>` |

Each agent's own file states the layer rules it must follow — a lower layer cites a higher one and
never restates it; the artifact wins over every doc. That is in the agent template rather than
here, because an agent that has to look it up will not.

## What this does not own

- **Review depth.** The review level is review depth, not model effort — two dials that look like
  one. The review policy doc owns the level; this file owns effort. Settling one does not touch the
  other.
- **Which doc owns what.** That is the sources-of-truth table in `{{table.file}}`.
