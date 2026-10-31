---
name: seam-github
description: >
  Owns this repo's tracker conventions — issue shape with domain, priority and milestone;
  branches; conventional commits; short precise PR bodies with the four follow-up
  dispositions; and the gate on pushing and merging. Use this whenever work needs
  committing, tracking or reviewing: "file an issue", "what's next", "open a PR",
  "commit this", "label these", "what shipped this week", "close #4", "start on #7", or a
  bare issue reference like "#12". Trigger it even when the request does not say GitHub.
  Does NOT decide the review level or run the rounds (that is seam-review), and does not
  own the doc layer (seam-docs).
---

# The tracker

Issues, branches, commits, PRs, and the one gate. `references/templates.md` has a filled example
of each; this file is the rules.

**Locate the repo's own docs first.** `docs/taxonomy.md` owns the domains, the three priorities and
the milestones; `.seam/config.json` carries the machine mirror and `load_bearing`. Read them. This
skill never answers a question those files answer — it says how to write them and what to do when
they are missing.

If `docs/taxonomy.md` is absent, say so and offer to write it with `seam-docs` rather than
inventing a label scheme. A taxonomy only pays for itself while it is small and stable, and one
invented per session is neither.

## The gate

**Two actions need an explicit OK, every time: `git push` and merging a PR.** Both are
outward-facing and awkward to walk back. Show what will land first — the diff stat, the commit
message, the PR body, or the merge method and what it closes — then wait. **Being asked to push is
not that OK**: the ask is for the specific thing that is about to land, which the user has not yet
seen. Approval of one push is not approval of the next.

**A local commit is ungated, and it has one precondition**: the diff has been **read** by a review
on the tree being committed, with anything still outstanding named at the offer. If no review has
been run, or the tree moved on to other work after it, **say so and run the review rather than
offering the commit**.

Two things are **not** refusals: a round that *found* something, and a tree carrying the last
round's findings folded in — under a bound, that is the ordinary ending rather than a stale review.

**This is a precondition, not a third gate.** A review does not license the commit; it only makes
the offer admissible. And "never commit unless asked" is untouched by any of it.

`seam-review` owns the level, the rounds and the bound. Do not restate them here — two copies of
that rule is how it drifts.

**It is enforced here because it cannot be enforced anywhere else.** Every assertion in the drift
checker is a local, offline, deterministic read; a review is none of the three, so no script can
assert that one happened. A rule whose mechanical half is not buildable gets a procedural owner
instead, and this is it.

Everything else just happens: creating issues, labels, milestones and branches, local commits,
draft PR bodies, re-labelling, closing an issue the user asked you to close. Don't ask permission
to file an issue; ask only if the issue contradicts a settled decision.

## Issues

Every issue carries **one or two domain labels, a priority, and a milestone**.

- **Domains** come from `docs/taxonomy.md`. One per source-of-truth row is the usual mapping. Kind
  stays on GitHub's defaults — `bug`, `enhancement`, `documentation`. If work needs a domain that
  is not on the list, **propose it** rather than inventing a label silently.
- **Priority**, three values, **by consequence rather than by feeling**:
  - `p0` — a live defect someone outside the repo sees, or a blocker on the active milestone;
  - `p1` — in the active milestone;
  - `p2` — later.
- **Milestone** is the build order, from the infra or architecture doc.

Body shape:

```markdown
<one or two sentences: what and why, in terms a reader cold on the project follows>

**Context** — <the doc section this comes from: `docs/plans/x.md` § The issues>

### Acceptance criteria
- [ ] <an outcome someone else could check without asking you>
- [ ] <…>
```

**Acceptance criteria are externally checkable: outcomes, not implementation steps.** "The list
shows only hives whose state is `queenless`" is a criterion. "Refactor the query builder" is a
plan. The difference matters most where "done" is contestable, which is most of the work worth
tracking.

Create it complete in one command, so the board is never briefly wrong, and **write the body to a
file and pass `--body-file`** — an inline body mangles on shell quoting, and a mangled body has to
be fixed by hand afterwards.

Titles are **imperative and specific**: `Filter the queenless list on hive state`, not
`Queenless list bug`.

## Branches and commits

One branch per issue, named from the issue number so the connection survives a `git log` read six
months from now:

```
<issue-number>-<short-slug>        e.g.  12-queenless-filter
```

Conventional-commit subjects, where **the scope is the domain label**, so the log reads as progress
against the docs rather than against files:

```
feat(hives): filter the queenless list on hive state

The list showed every hive in the apiary, so the one page the beekeeper
opens was useless. Pagination is deliberately not here — #19 owns it.

Closes #12.
```

- Types: `feat` · `fix` · `docs` · `refactor` · `test` · `chore` · `style`
- Subject: imperative, lowercase after the colon, no trailing period, ≤ 72 chars
- **Body says why, and names what was left undone.** The *what* is in the diff.
- `Closes #N.` for the issue the work finishes; `Part of #N.` when it advances but does not finish
  it — GitHub will not auto-close on that, which is the point.
- Stage deliberately. `git add` the specific paths, not `-A`: a checkout routinely has unrelated
  edits in flight.

## Pull requests

The title is the squash-merge subject, so it follows the commit convention exactly. The body's job
is to be readable in a year.

```markdown
## What
Three or four lines. What landed, and what deliberately did not.

## Why
The reason, citing docs by path and §. Not a restatement of the diff.

Closes #N.

## Follow-ups
- <S|M · `domain` — folded in> what was noticed and fixed in this branch
- <L · `domain` — issue #N> surfaced, not done, passes a qualifier clause — names which
- <any · `domain` — ledger> true, passes no clause, one row in the findings ledger
- <one-liner · `domain` — on `main`> a one-line fix that belonged elsewhere
```

(or `- None`.)

### Follow-ups — where scope discipline actually lives

Everything you noticed along the way and did not treat as part of the original scope. Each item
names its **domain**, its **size**, and its **disposition**.

**First the qualifier: does this become an issue at all?** Three clauses, and it is one of them or
it is not an issue:

1. **a bug someone outside the repo sees** — a user or an auditor is worse off;
2. **an exposure on anything in `load_bearing`** — the paths the repo named as carrying weight;
3. **it blocks the active milestone** — which the milestone says, not how important it feels.

**Everything else is one row in the findings ledger**, committed in the same PR. That file owns
nothing and is not a plan, so a row there is a record rather than a commitment. A row that later
blocks the active milestone qualifies on clause 3 and becomes an issue then.

**Then size, which decides fold-in versus not, and nothing else.** The three sizes — Small,
Medium, Large — and what puts a change in each are **the repo's `docs/building.md`'s to define**,
because the same sizes set how much ceremony a change carries; this file only uses them. There is
one test and it is **blast radius**, not felt effort.

If the repo has no `docs/building.md`, say so and offer to write it with `seam-docs`. Until it
exists, take the sizes from the template it would be written from,
`$CLAUDE_PLUGIN_ROOT/skills/seam-docs/templates/current/building.md`, rather than inventing a scale
per session.

**Small or Medium → fold it into the branch in flight** and note it as folded in. That needs an OK
only when the fold-in is **cross-domain or widens the branch's scope**; a same-domain defect in
work already inside this branch's scope is the same class of edit the gate already grants for a
review finding.

**An item that is folded in gets no ledger row.** A row records something the repo is *not* doing,
and a fold-in is the repo doing it. The three dispositions are exclusive — folded in, or filed, or
ledgered — and the qualifier is only asked about the items that are not folded in.

**A review finding left unfixed is none of the three.** It is named **when the commit is offered**,
and nowhere else. The ledger says "this does not matter enough", and a finding left unfixed on
purpose is the opposite claim: it matters and has not been settled. Say which of three reasons it
is — **disputed** (argued with in writing, so a reader can disagree), **open** (a judgement the
repo reserves for its owner, raised rather than absorbed), or **outstanding** (still standing when
the review's rounds are spent).

### A one-line fix in another domain

A one-line fix that belongs to a different domain lands on the default branch on its own, rather
than taking this branch's scope — the squash subject carries one domain, and a `web` fix inside a
`feat(hives)` branch is recorded in the log as `hives`. It still carries the commit precondition
like anything else, which is a real cost and the reason that path is kept narrow.

### Docs ship with the change that causes the drift

A change that makes a doc wrong includes the doc update **in the same PR**. A PR touching anything
in `load_bearing` includes its doc update in the same PR. This is not tidiness: the drift checker
will red on the next run either way, and the only question is whether the fix is in the commit that
caused it or in a later one nobody has written.

## Status reporting

Read it off the log and the board, not off memory. The squash subject's scope is the domain, so
`git log --oneline` groups by domain for free. Say what merged, what is in flight, and what is
blocked — and when a milestone's issues are all closed, say so rather than waiting to be asked.
