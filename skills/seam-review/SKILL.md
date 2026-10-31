---
name: seam-review
description: >
  Picks the review level from what the diff touches and runs the bounded rounds. Use this
  before offering a commit, when someone asks for a code review, asks what level a change
  takes, asks whether another round is worth running, or when a review found something and
  the question is what to do with it. Also use it when a review has been run by someone
  else and the tree has moved on. Does NOT own the commit, push or merge gate (that is
  seam-github), and does not own the doc layer (seam-docs).
---

# Reviewing the diff

**Locate the repo's `docs/reviewing.md` and follow it.** It owns the level policy, the bound, the
triggers and the ratchet for this repo. This file is how to write that doc and how to run the
rounds; it never answers a question the doc answers.

If the repo has no `docs/reviewing.md`, say so and offer to write it from
`$CLAUDE_PLUGIN_ROOT/skills/seam-docs/templates/current/reviewing.md` rather than improvising a
level. A level improvised per
session is the thing the doc exists to replace.

## Pick the level from what the diff touches — first match wins

Read `.seam/config.json` for `load_bearing` and `low_review_paths`, and the table for the layers,
then walk the rows in order:

| Touches | Level |
|---|---|
| Enforcement artifacts — the `load_bearing` globs | `high` |
| The measuring apparatus — the checker, `.seam/`, CI config, the deploy path | `high` |
| Layer 3 or 4 — an ADR or a PRD version, which cannot be corrected later | `high` |
| Convention files — the table's host, `.claude/`, the doc layer's authority rules | `medium` |
| Ordinary implementation against a written pattern | `medium` |
| A path on the repo's `low_review_paths` list | `low` |
| Everything else | `medium` |

**Say which row decided it.** A level with no stated reason is a level nobody can argue with, and
the row is the argument.

**Read the order literally: `low` is the sixth row, and that is deliberate.** A path on
`low_review_paths` that also matches a `high` or `medium` row above takes the higher level — so
opting a convention file or a source file into `low` does not work, and should not. The list is
for **prose-only paths**, which match none of rows 1 to 5; that is what makes row 6 reachable at
all, and it is why the interview asks for prose paths specifically.

Three things to hold on to:

- **`low` is opt-in per path and the list defaults to empty.** An empty list means nothing takes
  `low`, and that is the expected state rather than a gap. `low` is hunk-local and cannot verify a
  claim a document makes about the tree, which is what most documents are made of.
- **Size is not the discriminator.** A one-word edit to a source of truth is a wrong fact. Do not
  argue a diff down a level because it is small; argue from what it touches.
- **Always type the level explicitly.** An invocation with no level reuses the last level typed,
  which is state rather than a rule.

**Layer 3 and 4 take `high` for a reason worth restating once, because it is the one row people
want to argue with**: those layers are append-only, so a defect in one is permanent and the next
round cannot fix it in place. Review is the only gate they get.

## Run the rounds

1. **Round one** reads the change. **Fold every finding into the branch in flight** — not filed,
   not deferred, and in the branch's own domain that needs no OK. **Folding in needs no new
   unit:** a round-one finding is about the output of the unit under review, so that unit owns the
   fix and the start contract — where the repo has a `docs/building.md` — is already met.
   `seam-build` carries the same rule from its side; without it the two mandates collide.
2. **A clean round one ends it there.** With nothing fixed there is no new tree for a second round
   to read.
3. **Round two** reads the fixes, because the fixes changed the tree round one read. **That is the
   last round**, whatever it says.
4. **Re-run the repo's checks** if the fixes touched anything the check list covers. The tree being
   committed is the one both the review and the checks have to be true of.
5. **Summarise**: what each round found, what was fixed, and what was left with its reason.

### A third round is recommended, never automatic

Only on a named trigger:

1. Round two found a defect in a file round one did not flag — **the fix moved the bug**.
2. A finding was fixed by **changing code outside the diff under review**.
3. A confirmed finding's fix **added a branch of logic** rather than correcting a line.

When one fires: **state the trigger and the level the third round would run at, and let the human
decide.** Do not run it. Absent a trigger, whatever is outstanding goes to the commit offer
instead.

**Escalation ratchets.** Once a diff has earned `high`, later rounds do not drop back.

### Why the bound, when someone pushes back

Because it is measured, and the measurement is the only thing that survives the argument that more
rounds are more rigorous:

- **21 rounds on one branch without converging**, the count moving between 2 and 8 for fifteen
  rounds and never reaching zero.
- **Ten consecutive `medium` rounds on a docs change returning 6, 5, 5, 4, 6, 9, 5, 7, 4 and 4
  findings, never once clean** — most of the later ones defects in the previous round's *fix
  prose* rather than in the change.

An unbounded loop feeds on its own output: each round of fixes is new text for the next round to
find fault with. A re-run is not deterministic either, so a later round can surface a finding on
code nothing touched.

## What reaches the commit offer

Two kinds of finding arrive unfixed, and both are **named at the offer** rather than written into
a PR body or a ledger:

- one that **will not be fixed at all** — re-running never clears it;
- one **still standing when the rounds are spent** — a third round might have cleared it, and the
  bound sends it here instead.

Say which of three reasons each is: **disputed** (argued with in writing, so a reader can
disagree), **open** (a judgement the repo reserves for its owner, raised rather than absorbed), or
**outstanding** (the rounds ran out).

**A ledger row is not the place for one.** The ledger records what the repo is not doing *because
it does not matter enough*; a finding left unfixed is the opposite claim — it matters and has not
been settled.

## A review leaves no durable trace

A round that found nothing writes nothing, so a later session cannot tell a reviewed tree from an
unreviewed one. **On a branch reviewed by someone else, run it again.** That limit is accepted: the
alternative is threading a required trailer through every commit path, which is a standing cost on
every commit to save a pair of rounds on the few where the record is missing.

## Writing the doc

When writing a repo's `docs/reviewing.md`, the template is the starting point and three things are
the repo's own:

- **`low_review_paths`** — ask, and take an empty answer without arguing.
- **What counts as the measuring apparatus here** — the checker and `.seam/` always; the deploy
  path and the CI config if the repo has them.
- **Whether the repo has layer 3 and 4 at all.** If it does not, drop that row rather than leaving
  a rule about files that do not exist.

**Carry the measurements into the generated doc.** A bound without its numbers gets argued away by
the first person who finds a third round appealing.
