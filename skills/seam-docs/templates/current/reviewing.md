# Reviewing the diff

**Layer 2 — Current.** What is true now about how a change gets read before it is committed. When
this file is wrong, that is a **bug**, so the edit rule is **amend in place**.

Owns: the **level policy**, the **round bound**, the **third-round triggers**, and what a review
leaves outstanding. Nothing else may define them.

## It is a precondition on the commit

A local commit is ungated and has one precondition: **the diff has been read** by a review on the
tree being committed, with anything still outstanding named at the offer. That is not the same as a
round coming back clean — under a bound, folding in the last round's findings is the ordinary
ending.

**It is enforced procedurally because it cannot be enforced otherwise.** Every assertion in
`{{checker.path}}` is a local, offline, deterministic read; a review is none of the three, so no
script can assert that one happened. The refusal lives with the tracker conventions, not here —
this file owns the *level* and the *rounds*, and two copies of the refusal is how it drifts.

## The level, by what the diff touches — first match wins

| Touches | Level |
|---|---|
| Enforcement artifacts — the `load_bearing` globs in `.seam/config.json` | `high` |
| The measuring apparatus — `{{checker.path}}`, `.seam/`, CI config, the deploy path | `high` |
| Layer 3 or 4 — a decision record or an intent version, which cannot be corrected later | `high` |
| Convention files — `{{table.file}}`, `.claude/`, the doc layer's authority rules | `medium` |
| Ordinary implementation against a written pattern | `medium` |
| A path on this repo's `low_review_paths` list | `low` |
| Everything else | `medium` |

**Layer 3 and 4 writes take `high`, and the reason falls straight out of the edit rule:** they are
append-only, so a defect in one is permanent and the next round cannot fix it in place. Review is
the only gate they get.

**`low` is opt-in per path, and the list defaults to empty.** This repo's list is
`low_review_paths` in `.seam/config.json`; if it is empty, nothing takes `low` and that is the
expected state. `low` is hunk-local and is instructed not to look outside the hunk, so **it cannot
verify a claim a document makes about the tree** — which is what most documents are made of. The
paths that belong on the list are the ones where a wrong sentence is only a wrong sentence.

The measurement behind that, because a rule like this gets argued away without one: on the one
branch where both levels were run against the same tree, `low` returned **nothing** on a diff
carrying five real defects, and `medium` found all five.

**Always type the level explicitly**, even when it is the default. An invocation with no level
reuses the level typed last, which is state rather than a rule — so a `low` typed for a README fix
is still the level an hour later, with nothing saying so.

**Size is not the discriminator, which is why the rule is by path.** A one-word edit to a source of
truth is a wrong fact. A typo fix in a doc that owns something takes `medium` like anything else
there.

## The rounds

**Two rounds is the bound.** Round one reads the change; round two reads the fixes. **A clean first
round ends it there** — with nothing fixed there is no new tree for a second round to read, so the
bound is *at most* two rather than exactly two.

**Every round-one finding is folded into the branch in flight** — not filed, not deferred.

**A third round is recommended, never automatic**, and only on a named trigger:

1. **Round two found a defect in a file round one did not flag** — the fix moved the bug.
2. **A finding was fixed by changing code outside the diff under review.**
3. **A confirmed finding's fix added a branch of logic** rather than correcting a line.

When one fires, **state the trigger and the level the third round would run at, and let the human
decide.** Absent a trigger, whatever is outstanding is named at the commit offer instead.

**Escalation ratchets.** Once a diff has earned `high`, later rounds do not drop back.

### Why the bound exists

Measured rather than argued, because an unbounded rule sounds more rigorous and is not. On one
branch, **21 rounds without converging**, the finding count moving between 2 and 8 for fifteen
rounds and never reaching zero. On another, a docs-only change, **ten consecutive `medium` rounds
returning 6, 5, 5, 4, 6, 9, 5, 7, 4 and 4 findings and never once coming back clean** — most of the
later ones defects in the previous round's *fix prose* rather than in the change.

That is the loop feeding on its own output: each round of fixes is new text for the next round to
find fault with. Two rounds is a budget — one to read the change, one to read the fixes.

A re-run is also not deterministic: the same inputs have returned different counts. So a later
round can surface a finding on code nothing touched, which is another reason "run until clean" has
no stopping point.

## What a review leaves behind

**Nothing durable, and that limit is accepted rather than overlooked.** A round that found nothing
writes nothing, so a later session cannot tell a reviewed tree from an unreviewed one. The answer
there is to run the rounds again, not to trust a transcript nobody has.

What *is* written down is the exception: **a finding left unfixed is named when the commit is
offered**, with which of three reasons it is — **disputed**, **open**, or **outstanding**. The
tracker conventions own that list; this file points at it rather than repeating it.

**The checks run again after the last fixes**, whenever those fixes touched anything the check list
covers. A stale review is a refusal, so a stale check run cannot quietly not be: the fix rounds
change the tree the checks were green on, and the tree being committed is the one both have to be
true of.

Once the rounds are done, **summarise before offering anything** — what each round found, what was
fixed, and what was left with its reason.
