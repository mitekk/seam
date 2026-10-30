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
5. **The four dispositions assigned correctly:**
   - item 1 (phone heading, one file) → **folded in**, domain `web`;
   - item 2 (future-dated inspection) → **an issue**, domain `hives`, and it must say *which
     qualifier clause* it passes — a bug someone outside the repo sees, or an exposure on a
     load-bearing path, since it reaches `db/schema.sql`;
   - item 3 (CI installing twice) → **one ledger row**, domain `infra`, because it is true and
     passes no clause;
   - item 4 (README link) → **a one-liner on the default branch**, domain `web`, not folded into
     this branch.

FAIL if any item is misdisposed. In particular: FAIL if item 3 becomes an issue (it passes no
clause — nobody outside the repo is worse off, nothing load-bearing is exposed, and the milestone
is not blocked), and FAIL if item 2 is folded in (it crosses a structural seam and is Large).

FAIL if size is used to decide issue-versus-ledger. Size decides fold-in versus not, and nothing
else; the qualifier decides issue versus ledger.
