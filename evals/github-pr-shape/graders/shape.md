---
type: llm
weight: 4
---

The response should be a PR body for a branch closing #12, with four follow-ups to dispose of.

PASS requires all of:

1. **`## What`** — a few lines, naming both what landed and that pagination deliberately did not.
2. **`## Why`** — the reason, citing docs by path (and `§` where it has one). Not a restatement of
   the diff.
3. **`Closes #12.`**
4. **`## Follow-ups`**, with **each item naming its domain, its size, and its disposition**.
5. **The four follow-up items disposed of correctly:**
   - item 1 (phone heading, one file) → **folded in**, domain `web`;
   - item 2 (future-dated inspection) → **an issue**, domain `hives`, and it must say *which
     qualifier clause* it passes — a bug someone outside the repo sees, or an exposure on a
     load-bearing path, since it reaches `db/schema.sql`. **Either form counts**: the clause by
     number ("clause 1", "clauses 1 and 2") or by its content ("a beekeeper using the app would
     hit it", "it reaches a load-bearing path"). The requirement is that the line shows the
     disposition was decided rather than guessed, and both forms show it. It is filed because the
     work is bigger than a unit this branch could write and finish — it reaches the schema, the
     form and the API — and not merely because nothing in the branch's plan covers it;
   - item 3 (CI installing twice) → **one ledger row**, domain `infra`, because it is true and
     passes no clause;
   - item 4 (README link) → **a one-liner on the default branch**, domain `web`, not folded into
     this branch.

6. **Filing is for complexity, not for coverage.** An item that no unit of planned work owns, that
   is **worth doing**, and that is **no bigger than a unit this branch could write and finish**, is
   **planned and then done in this branch** — the unit written first, then the work — rather than
   filed. **None of this case's four items is that disposition**, so
   what is required here is the negative: nothing may be filed *because* no unit of planned work
   owns it. Item 2 is filed because the work is bigger than a unit this branch could finish. An
   item done in this branch may say that a unit was written for it, and that is not a miss.

FAIL if any item is misdisposed. In particular: FAIL if item 3 becomes an issue (it passes no
clause — nobody outside the repo is worse off, nothing load-bearing is exposed, and the milestone
is not blocked), and FAIL if item 2 is folded in (the work reaches the schema, the form and the
API, so it is bigger than a unit this branch could write and finish).

FAIL if an item becomes an issue merely because no unit of planned work owns it, when writing the
unit and doing it here was available.

FAIL if size is used to decide which disposition an item takes. Size says what a disposition
costs — what a fold-in has to carry, what an issue has to say — and never which one applies:
whether a unit owns the item decides whether it gets done here, and the qualifier decides issue
versus ledger for the items that do not.
