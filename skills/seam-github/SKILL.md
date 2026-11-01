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

**Nothing mechanical holds the subject to 72, and it is the first line of this convention to
drift.** Assertions read files; no assertion reads a commit message, so the length is held by
whoever writes the commit — and a long subject is written at the moment the work is finishing,
which is the moment least likely to re-read a rule. The one branch that wrote this file broke it
on about a third of its own commits before anyone counted. Counting is one command, and it names
the offenders rather than a number that goes stale:

```bash
git log --format=%s <default-branch>..HEAD | awk 'length($0) > 72'
```

It prints nothing when the branch is clean. A subject already pushed is left alone — rewriting
landed history for a label costs more than the label is worth — so the check is worth running
**before** the commit, where the fix is free.

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
- <size · `domain` — folded in> a unit covered it, and it was done in this branch
- <size · `domain` — planned, then folded in> no unit covered it: the unit was written, then done
- <size · `domain` — issue #N> bigger than a unit this branch could write and finish, and it
  passes a qualifier clause — names which
- <size · `domain` — ledger> true, and either not worth doing or turned away by the qualifier:
  one findings-ledger row
- <one-liner · `domain` — on `main`> a one-line fix that belonged elsewhere
```

(or `- None`.)

**The size slot is a vocabulary, not free prose: `Small`, `Medium` or `Large`** — the three
`docs/building.md` defines — or `one-liner`, the marker the route in § A one-line fix in another
domain carries. The three names are here so a **required** slot does not depend on an **optional**
file read; what each one *means*, and which one a given change is, stay that file's and are read
there. Where a repo's own `docs/building.md` names a different set, **its table is the vocabulary
and this line is not**.

### Follow-ups — where scope discipline actually lives

Everything you noticed along the way and did not treat as part of the original scope. Each item
names its **domain**, its **size**, and its **disposition**.

**The order is two questions, and neither of them is the size.** Does a unit of planned work — or
a document that owns the change — cover the item? If nothing does, is it worth doing at all, and if
it is, is the work bigger than a unit you could write and finish in this branch? Four dispositions,
one per answer:

1. **A unit covers it → do it now**, in this branch. A document that owns the change stands in for
   the unit, so a change a document owns takes this disposition too.
2. **No unit covers it, and it is not worth doing at all → one row in the findings ledger.**
3. **Worth doing, and genuinely complex → file an issue**, if it passes the qualifier below.
   Complexity here is **reach, not size**: the test is whether the work is bigger than a unit you
   could write and finish in this branch. **Filing is for complexity, not for coverage** —
   covering the corners of the work in front of you *is* that work, and an issue filed to record a
   corner inflates the board without moving anything.
4. **Worth doing and not complex → write the unit, then do it**, in this branch. What that row
   carries, and the rule that writing it is not a gate, are `docs/building.md`'s.

The four are mutually exclusive, so there is no order to try them in — the two questions pick one.

**Two routes sit beside the tree rather than in it.** A one-line fix belonging to another domain is
not a disposition but a question of which branch carries it; § A one-line fix in another domain
below has it, and it is asked **first**, because it takes the item out of this branch altogether.
And the ledger has a second way in: an item the third disposition sends to an issue lands there
instead when the qualifier turns it away.

**`docs/building.md` is what this section reads for the things this file does not own**: what
counts as a unit covering a change, what a row written for one carries, the carve-out that lets a
document own a change instead of a unit, and the three sizes. Read them there rather than settling
any of them here. If the repo has no such doc, say so and offer to write it with `seam-docs`; until
it exists, read all four in the template it would be written from,
`$CLAUDE_PLUGIN_ROOT/skills/seam-docs/templates/current/building.md`, rather than inventing them
per session.

**Then the qualifier, asked only of an item the third disposition sends to an issue: does it
become one at all?** Three clauses, and it is one of them or it is not an issue:

1. **a bug someone outside the repo sees** — a user or an auditor is worse off;
2. **an exposure on anything in `load_bearing`** — the paths the repo named as carrying weight;
3. **it blocks the active milestone** — the one `milestones[].active` marks in `.seam/config.json`,
   not how important it feels.

**Clause 3 reads a field only the wizard enforces.** "Exactly one `true`" is a rule `/seam:init`
applies to the answers file; a hand-edited `.seam/config.json` can carry none, two, or no `active`
key at all. **Where it is not exactly one, clause 3 does not fire**: the item qualifies on clause 1
or 2, or it is a ledger row. Do not pick one of two, and do not infer the active milestone from the
board. Two states, and they are not the same thing. **`milestones: []`, no milestones at all, is
the ordinary undecided case**: nothing has been chosen because there is nothing to choose yet, and
clause 3 simply never fires. **A non-empty list that does not carry exactly one `true`** — two of
them, none of them, or no `active` key on the rows — is a config `/seam:init` refuses to write, so
it was hand-edited or is broken: say so, and do not repair it unasked. A repair goes into
`.seam/answers.json`, since the config is the projection.

**An item the qualifier turns away is one row in the findings ledger too**, committed in the same
PR. That file owns nothing and is not a plan, so a row there is a record rather than a commitment.
A row that later blocks the active milestone qualifies on clause 3 and becomes an issue then.

**Size decides how, never whether.** It says what a disposition costs — what the fold-in has to
carry, what the issue has to say — and it never moves an item from one disposition to another.
Which size a change is, and what each one costs, are `docs/building.md`'s as above; this file only
reports it. **The three values the slot takes are named once, with the skeleton in § Pull
requests**, and this paragraph deliberately does not repeat them — one enum, one place.

**A fold-in needs an OK only when it is cross-domain or widens the branch's scope** — either of
the two dispositions that land work in this branch, since writing the unit does not buy scope that
the OK would otherwise cost. A same-domain defect in work already inside this branch's scope is
the same class of edit the gate already grants for a review finding.

**An item that is done here gets no ledger row.** A row records something the repo is *not* doing,
and doing it — under a unit that covered it, or one written for it — is the repo doing it. The
qualifier is only asked of the items that are not being done.

**A review finding left unfixed is none of the four.** It is named **when the commit is offered**,
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

## Merging, and the steps it is

Merging is **squash by default**: the PR title becomes the default branch's history and the
branch's intermediate commits do not. **GitHub's default squash message is the branch's commit
messages**, so each *why* the branch wrote survives in the commit that lands — the other reason a
body that restated the diff is worth nothing. That is a default and not a property of squashing: a
repo set to `PR_BODY` or `BLANK` drops those bodies, a single-commit branch takes that commit's own
subject and body rather than the PR title, and `git merge --squash` locally composes them
newest-first. Read what the tool filled in rather than assuming it.

The title is that squash subject, and § Pull requests is where it is tied to the commit convention
— **with four characters plus the issue number's digits spent before it is written**, because the
tracker appends ` (#N)` to it. A 70-character title lands over the ≤ 72 chars § Branches and
commits sets.

It is a sequence rather than one command, and § Teardown below is the last step of it:

1. **Squash-merge, deleting the branch.** This is the gated action, and **the OK has to see the
   merge method and what the merge closes.** Neither is in the PR body, and both are what cannot
   be walked back once it lands.
2. **Check that the issue actually closed.** A `Closes` trailer that never matched is the exact
   failure this convention exists to prevent, and it fails quietly: the merge succeeds and the
   board is left wrong.
3. **Tear the branch down** — § Teardown below.
4. **Bring the default branch up to date** — the one `repo.default_branch` names in
   `.seam/config.json`, which is the fact this step needs and the one place it is written down, so
   do not guess `main` — fast-forward only, and on the branch § Teardown's step 3 has already
   switched to. The merge happens on the tracker's side, so the checkout the next branch is cut
   from still points at the commit before it, which is how that branch starts out missing the
   change that just shipped. A pull that cannot fast-forward is a divergence to look at rather
   than something to put a merge commit on.

   ```bash
   git pull --ff-only
   ```

Steps 2 to 4 are **not behind the gate**: they are local and touch nothing outward-facing. Not
running them is how a wrong board and a stale branch point get left behind, so they are part of
finishing the work rather than cleanup for later.

### Teardown, the last step and not an optional tidy-up

A merge takes the remote side down and leaves the local one, and whatever the repo built beside the
branch — a worktree, a per-branch database, a container — outlives both. **Some of this may already
be done**: `gh pr merge --delete-branch` deletes the local branch as well as the remote one, and a
command that removes a worktree takes its branch with it. **A step already done is skipped rather
than retried** — the sequence is idempotent, and `branch not found` here is that, not a failure.

**Each step below carries the command it is**, so the sequence can be run rather than paraphrased,
and seam's own `tests/teardown.test.mjs` performs these blocks — these five and § Merging's
step 4 — in document order against five real repositories. Prose here that stops working goes
red there instead of on somebody's merge, which is the whole reason the blocks are here. The
block is the step; the prose above it is what explains the step, and neither is a copy of the
other. Four values are filled in before the first block, and a session that cannot name all four
is not ready to start:

- `$SEAM_BRANCH` — the branch that just merged.
- `$SEAM_DEFAULT_BRANCH` — the one `repo.default_branch` names.
- `$SEAM_WORKTREE` — the branch's worktree path, **empty** if it has none.
- `$SEAM_TEARDOWN` — `teardown_command` with the issue number in place of `<n>`, **empty** if the
  key is empty or absent.

1. **Leave the worktree: run the rest from the main checkout**, which
   `git worktree list --porcelain` names on its first line, after `worktree `. Read it that way
   rather than splitting the line on whitespace: a repo path may contain spaces, and the split
   returns a truncated path the `cd` then fails on, leaving the session in the worktree. "The repo
   root" is not the instruction — in a worktree repo the worktree is one too, and it is the wrong
   one.

   ```bash
   cd "$(git worktree list --porcelain | sed -n '1s/^worktree //p')"
   ```
2. **Run the repo's own teardown command, if `.seam/config.json` names one** in
   `teardown_command`, with the issue number in place of `<n>`. It goes before the delete because
   it owns whatever the branch was given, and because it commonly deletes the branch too.

   ```bash
   # A session runs that command itself; `eval` is how a block takes it from the config.
   if [ -n "$SEAM_TEARDOWN" ]; then eval "$SEAM_TEARDOWN"; fi
   ```
3. **Switch to the default branch**, the one § Merging's step 4 names. This is the step that makes
   the next one possible: **`git branch -d` and `-D` both refuse a branch that is checked out**, in
   a worktree or in the repo root alike, and the error names the worktree rather than the flag, so
   it reads as a tooling fault rather than as the ordinary state it is.

   ```bash
   git switch "$SEAM_DEFAULT_BRANCH"
   ```
4. **Remove the branch's worktree, if it still has one** — `git worktree remove "<path>"`, quoted,
   and `git worktree list` is what says whether it does. **A branch checked out in a worktree
   cannot be deleted while that worktree exists**, with either flag, so without this step the next
   one cannot run in a worktree repo whose `teardown_command` is empty — which is the common case
   twice over. **If the removal refuses, the worktree has uncommitted or untracked work in it —
   look at what it is, and do not force past it unasked.** `--force` deletes files that exist
   nowhere else; gitignored contents do not trigger the refusal, so what it is reporting is real
   work, not the norm.

   ```bash
   # Skipped when step 2's command already took it — `git worktree list` is what says.
   if [ -n "$SEAM_WORKTREE" ] \
     && git worktree list --porcelain | grep -qxF "worktree $SEAM_WORKTREE"; then
     git worktree remove "$SEAM_WORKTREE"
   fi
   ```
5. **Delete the local branch, if it is still there, and expect `-D` rather than `-d`.** A squash
   gives the default branch a new commit, so the branch tip is never an ancestor of it and `-d`'s
   merged check cannot hold: while `refs/remotes/origin/<branch>` is still present it reports the
   branch merged **to its upstream**, which is not the comparison it looks like, and after a
   `fetch --prune` it refuses outright. `-D` loses nothing here, because the squash carries the
   content and the PR carries the history.

   ```bash
   # Skipped when the merge's --delete-branch or step 2's command already took it.
   if git show-ref --quiet "refs/heads/$SEAM_BRANCH"; then git branch -D "$SEAM_BRANCH"; fi
   ```

**Steps 1 and 4 are both measured, and skipping either ends somewhere undiagnosable.** Run step 2
from inside the worktree and a teardown command that removes it **deletes the directory the session
is standing in**: every git command after that — step 4 of § Merging included — answers
`fatal: Unable to read current working directory`, so the stale branch point that step exists to
prevent is exactly what is left, and nothing in the error mentions a branch or a worktree. With
`teardown_command` empty, step 3 fails instead with
`fatal: '<default>' is already used by worktree at …`, and step 5 with `cannot delete branch …
used by worktree` whichever flag it is given. **That last one has two causes and they are not the
same thing:** step 4 not taken, or step 4 taken and **refused** on a dirty worktree
(`contains modified or untracked files, use --force to delete it`). Check which before doing
anything, because the second is work someone has not saved. None of these is a tooling fault.

**Where that key is empty or absent, the steps after it are the whole teardown.** Most repos have
nothing else to take down, so an empty value is a complete answer rather than an unfilled one: do
not go looking for a script to run, and do not write one.

**Deliberately a convention and not automation.** A wrapper that merged and then tore down would
bury the merge gate — the one action that needs an explicit OK every time — inside a script, and a
sweep that reaped every merged branch at once would turn teardown back into periodic cleanup
instead of the last step of finishing one piece of work.

## Status reporting

Read it off the log and the board, not off memory. The squash subject's scope is the domain, so
`git log --oneline` groups by domain for free. Say what merged, what is in flight, and what is
blocked — and when a milestone's issues are all closed, say so rather than waiting to be asked.

### The owned-row invariant

**Every open issue is either an owned row in a plan, or names the document that owns it instead.**
An **owned row** is a unit in a layer-5 plan; what a unit is and what its row carries are
`docs/building.md`'s, which § Follow-ups reads for the same terms — and where the repo has no such
doc, read them in `$CLAUDE_PLUGIN_ROOT/skills/seam-docs/templates/current/building.md` rather than
settling them here. **Both owners are documents.** The second is the layer-2 or layer-3 doc that
owns the change, standing in for a row exactly as it does in § Follow-ups' first disposition, and
it is the stronger owner rather than the weaker one: an invariant reading "an owned row or nothing"
would force a plan to adopt work it had reasoned its way out of adopting. A plan that looked at an
issue and disclaimed it in writing has named itself that document.

**"No plan covers this milestone yet" is a state to report, and neither an owner nor a violation.**
Some milestones planned and some not is every repo mid-adoption, and an issue in an unplanned
milestone names nothing because there is nothing yet to name: say which milestone and how many,
rather than counting them against the invariant. The issue the invariant is **for** is one in a
**planned** milestone that no row owns and no document names — which is how a board re-spreads
across every milestone with every check still green.

**Which files are the plans is `assertions.A8.plan_glob` in `.seam/config.json`**, never the path
an example happened to show. Glob the configured one: on a repo whose plans sit under
`docs/superpowers/plans/`, a session that globbed `docs/plans/*.md` finds nothing, concludes every
milestone is unplanned, and reports every open issue as covered by no plan — the silent half of
the same mistake the paragraph above refuses in its noisy half.

**The active milestone is read, never inferred**: it is the one `milestones[].active` marks in
`.seam/config.json`, which is the field § Follow-ups' qualifier reads in its third clause — that is
where the two states it can be in are settled, and this section does not repeat them. **Not the
lowest-numbered milestone with open issues.** Work is correctly filed ahead of the front all the
time, so that rule returns the wrong milestone the first time someone does it.

**The milestone half is reporting, not a gate.** Filing an issue into a milestone ahead of the
front violates nothing — decomposing work before its milestone opens is how a plan gets written at
all. **Ownership** is what the invariant holds; *which* milestone an issue sits in is what this
section reports.
