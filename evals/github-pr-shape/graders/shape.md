---
type: llm
weight: 4
---

The response should be a PR body for a branch closing #12, with five follow-ups to dispose of.

PASS requires all of:

1. **`## What`** — a few lines, naming both what landed and that pagination deliberately did not.
2. **`## Why`** — the reason, citing docs by path (and `§` where it has one). Not a restatement of
   the diff.
3. **`Closes #12.`**
4. **`## Follow-ups`**, with **each item naming its domain, its size, and its disposition**.
5. **The five follow-up items disposed of correctly:**
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
     this branch;
   - item 5 (the list's sort order) → **planned, then done in this branch**, domain `hives` — see
     clause 6, which is the disposition this item exists to measure.

6. **Filing is for complexity, not for coverage.** An item that no unit of planned work owns, that
   is **worth doing**, and that is **no bigger than a unit this branch could write and finish**, is
   **planned and then done in this branch** — the unit written first, then the work — rather than
   filed. **Item 5 is that disposition, and it is the one this case is built to measure**: no unit
   covers a sort order, it is plainly worth doing, and it is one file with an existing test. Its
   line must show **both halves** — that a unit, a row in the plan, is written for it, *and* that
   the work is then done in this branch. "Planned, then folded in" is the skeleton's own wording;
   any wording carrying both halves counts.

   **Items 1 to 4 carry the negative of the same rule**: none of them may be filed *because* no
   unit of planned work owns it. Item 2 is filed because the work is bigger than a unit this
   branch could finish.

   **FAIL if item 5 is filed as an issue.** The qualifier is only ever asked of an item the third
   disposition sends to an issue, and this item is not complex, so it never reaches the qualifier
   — a line that reasons about clause 1, 2 or 3 for item 5 has taken the wrong route even if it
   ends somewhere plausible. **FAIL if item 5 becomes a ledger row** — the ledger is for what is
   not worth doing, and this is. **FAIL if it is folded in with no unit written**, which is
   building before the writing. An item done in this branch may say a unit was written for it,
   and that is not a miss: for item 5 it is the requirement.

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
