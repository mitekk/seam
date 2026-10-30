---
type: llm
weight: 4
---

Seven diffs were presented for a repo whose `load_bearing` is `db/schema.sql` and `src/auth/**`,
whose `low_review_paths` is `README.md` and `docs/glossary.md`, and whose checker is
`scripts/check_docs.py`.

PASS requires all seven levels, and `high`/`medium`/`low` exactly:

1. `db/schema.sql` → **high** — an enforcement artifact, on `load_bearing`.
2. the checker and `.seam/config.json` → **high** — the measuring apparatus.
3. a new ADR → **high** — layer 3, which is append-only, so a defect in it is permanent.
4. `CLAUDE.md` → **medium** — a convention file.
5. `src/list.mjs` → **medium** — ordinary implementation against a written pattern.
6. `README.md` → **low** — it is on this repo's `low_review_paths`.
7. `docs/engineering.md` → **medium** — "everything else", and it is **not** on
   `low_review_paths`.

PASS also requires that the response does **not** argue 7 down to `low` because the change is one
word. Size is not the discriminator: a one-word edit to a source of truth is a wrong fact. A
response that reasons from how small the diff is, rather than from what it touches, fails even if
it lands on `medium`.

FAIL on any wrong level, on a level outside those three, or if the response reviews the diffs
instead of naming the levels.
