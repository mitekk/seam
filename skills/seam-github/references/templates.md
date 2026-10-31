# Filled examples

One of each, filled in for a small repo whose domains are `hives`, `web` and `infra`, whose only
load-bearing path is `db/schema.sql`, and whose active milestone is `1 · Queenless list`.

These are examples, not forms. `SKILL.md` is the rule; this is what the rule looks like when it
has been followed.

---

## An issue

Written to a file first, then passed with `--body-file`. An inline body mangles on shell quoting,
and a mangled body has to be fixed by hand afterwards.

```bash
gh issue create -R mitekk/apiary \
  --title "Filter the queenless list on hive state" \
  --label hives --label p0 \
  --milestone "1 · Queenless list" \
  --body-file /tmp/issue-12.md
```

`/tmp/issue-12.md`:

```markdown
The queenless list renders every hive in the apiary rather than only the queenless ones, so the
one page the beekeeper opens before a visit tells them nothing. The query reads `hives` without
filtering on `hives.state`.

**Context** — `docs/plans/inspections.md` § The issues sequences the inspection work, and
`db/schema.sql` defines the `hive_state` vocabulary the filter has to use.

### Acceptance criteria
- [ ] The list shows only hives whose `state` is `queenless`
- [ ] The page states how many that is
- [ ] An apiary with no queenless hives shows an empty state rather than an empty table
- [ ] The list is unchanged for a hive whose state changes while the page is open — a reload
      shows the new state
```

**Why `p0`:** a live defect someone outside the repo sees — the beekeeper. That is clause one of
the priority rule, not a judgement about how annoying it is.

**Why those criteria:** each is something another person could check without asking the author.
"Refactor the query builder" would not be — that is a plan, and a plan is not a criterion.

---

## A commit

```
feat(hives): filter the queenless list on hive state

The list showed every hive in the apiary, so the one page the beekeeper
opens before a visit told them nothing. The filter reads the `hive_state`
vocabulary from the schema rather than a second copy in the query.

Pagination is deliberately not here: forty hives fit on one page and #19
owns the case that does not.

Closes #12.
```

The scope is `hives` because that is the branch's domain label. The body says **why**, and names
what was left undone — the *what* is in the diff, and restating it there is how a commit message
becomes something nobody reads.

---

## A pull request

```bash
gh pr create -R mitekk/apiary --base main \
  --title "feat(hives): filter the queenless list on hive state" \
  --body-file /tmp/pr-12.md
```

`/tmp/pr-12.md`:

```markdown
## What
The queenless list now filters on `hives.state` and the page states the count. An apiary with no
queenless hives gets an empty state rather than an empty table, and one with no hives at all says
so rather than reporting good news.

Pagination deliberately did not land — forty hives fit on one page, and #19 owns the case that
does not.

## Why
`docs/plans/inspections.md` § The issues sequences #12 first because every later screen reads the
filtered list. The vocabulary comes from `db/schema.sql`, which is authoritative, rather than from
a second copy in the query — `docs/engineering.md` § Hive states is the doc that cites it.

Closes #12.

## Follow-ups
- <S · `web` — folded in, OK given> the page heading was two sizes too large at 360px; one file,
  no new test. A defect in what this branch's unit built, so that unit owns it. Cross-domain, so
  it took an OK
- <M · `hives` — planned, then folded in> an apiary with no hives at all rendered the "no
  queenless hives" empty state, which reads as good news. No unit covered it — the plan's row
  covers an apiary with no queenless hives, not one with no hives — so the row went into
  `docs/plans/inspections.md` § The units first, and then the fix
- <L · `hives` — issue #18> the inspection form accepts a date in the future, which a beekeeper
  would hit and which reaches `db/schema.sql` — passes qualifier clauses 1 and 2. The work reaches
  the schema, the form and the API, so it is bigger than a unit this branch could write and finish
- <S · `infra` — ledger> CI installs dependencies twice, about forty seconds a run. True, and
  passes no clause: nobody outside the repo is worse off, nothing load-bearing is exposed, and the
  active milestone is not blocked
- <one-liner · `web` — on `main`> a broken link in `README.md`, which belongs to no branch
```

**Read each line against the rule:**

- The heading is a defect in the page this branch's unit built, so **a unit already covers it** and
  it is done here. Being **Small** says what carrying it cost, not why it happened. No ledger row
  either: a fold-in is the repo doing the thing, and a row would be a standing record of a defect
  that no longer exists. It is `web` inside a `hives` branch, so it is **cross-domain and took an
  OK**; a same-domain fix already inside this branch's scope would not have. The line says so,
  because the squash subject will file it under `hives` and the PR body is then the only place it is
  written down in the domain it belongs to.
- The empty apiary took the plan-it-and-do-it disposition: no unit covered it, it was worth doing,
  and it was no bigger than a unit this branch could write and finish — so the unit was written and
  then the work done here. **Filing it would have been the cheap move and the wrong one** — covering
  that corner *is* the work this branch was doing, and an issue for it inflates the board without
  moving anything. It is `hives` inside a `hives` branch, so it needed no OK.
- The future-dated inspection is **genuinely complex** by the only test that decides anything —
  **reach**. The fix is bigger than a unit this branch could write and finish: it reaches the
  schema, the form and the API. That is why it is filed rather than planned and done. It
  **passes the qualifier** (clauses 1 and 2), which is what makes it an issue rather than a ledger
  row, and the line **says which clauses**. It is also **Large**, and that is a separate fact that
  decides nothing here.
- The CI waste is **true, not worth doing, and passes no clause**, so it is one ledger row. It
  is Small, and that changes nothing: being small is not a clause either, and it is not a reason to
  do it. This is the disposition that stops a tracker filling up with true observations nobody will
  act on.
- The README link is a **one-liner in another domain**, so it lands on `main` on its own rather
  than taking this branch's `hives` scope.

---

## The gate, in a session

```
> commit this and push it

The push needs your OK, and the commit needs the diff read first. No review has been run on this
tree, so I'll run that now rather than offering the commit.

[review runs]

Round one found two things; both are folded in. Round two is clean.

Here's the commit I'd make:

  3 files changed, 41 insertions(+), 8 deletions(-)

  feat(hives): filter the queenless list on hive state
  ...
  Closes #12.

One thing is outstanding and I have not fixed it: the empty-state copy reads as an error rather
than as a normal state. That is **disputed** — I think it is wrong and the existing string was
chosen deliberately in #7, so it is your call rather than mine.

Say the word and I'll commit. Pushing is a separate OK, and I'll show you the diff stat and the
PR body before that one.
```

What that shows:

- the push and the commit are **different things** — one gated, one with a precondition;
- being told "push it" is not the OK for the push, because the user has not yet seen what lands;
- the review is **run**, not claimed;
- a round that found something is not a refusal; the findings were folded in and round two read
  the fixes;
- the one thing left unfixed is **named at the offer**, with which of the three reasons it is.

---

## A merge, in a session

The example repo's `.seam/config.json` names one teardown command, `scripts/rm-worktree.sh <n>`,
and its `repo.default_branch` is `main`.

```bash
gh pr merge 12 -R mitekk/apiary --squash --delete-branch   # gated — needs the OK
gh issue view 12 -R mitekk/apiary                          # did Closes fire?
cd "$(git worktree list | head -1 | awk '{print $1}')"     # the main checkout, not the worktree
scripts/rm-worktree.sh 12                                  # the repo's own teardown
git switch main                                            # -d and -D refuse a checked-out branch
git worktree remove .worktrees/12-queenless-filter         # if the teardown command left it
git branch -D 12-queenless-filter                          # and the branch that worktree held
git pull --ff-only                                         # the base the next branch is cut from
```

How the first of those is offered:

```
> #12 is approved — merge it

Here is what the merge would do:

  method:  squash — the PR title becomes `main`'s history
  title:   feat(hives): filter the queenless list on hive state
  closes:  #12

That one needs your OK. The rest follows it and does not: check that #12 actually closed, leave
the worktree for the main checkout, then `scripts/rm-worktree.sh 12`, which takes the worktree,
the per-branch database and the local branch with it — so the `git branch -D` after it is usually
a no-op — and `git pull --ff-only`, so the next branch is cut from the merge rather than from the
commit before it.
```

What that shows:

- the OK sees the **method** and **what it closes**, which is what the merge adds to what the PR
  body already said;
- the local steps are named **in the same breath**, because they are the rest of the sequence
  rather than cleanup to come back to;
- the `cd` is **first among them and not housekeeping**: run from inside the worktree, the next
  line deletes the directory the session is standing in, and every git command after it fails with
  `Unable to read current working directory` — including the `git pull` that keeps the next
  branch's base fresh;
- `--delete-branch` has already taken the local branch, and `rm-worktree.sh` takes it again, so
  both are **skipped if already done** — which is why the `git branch -D` sits behind an "if it is
  still there" rather than behind a check;
- **`-D`, not `-d`**: the squash leaves the branch tip no ancestor of `main`, so `-d` either
  refuses or reports the branch merged to its *upstream*, which is a different question;
- `rm-worktree.sh` is here only because this repo's config names it. A repo whose
  `teardown_command` is empty runs the two lines after it instead — **worktree first, then
  branch**, because a branch a worktree holds cannot be deleted with either flag — and that is
  the common case rather than a gap.
