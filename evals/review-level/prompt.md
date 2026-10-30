---
name: review-level
runs: 1
max_turns: 10
allowed_tools: [Read, Glob, Grep, Skill]
tags: [review, level]
---

My repo's `docs/reviewing.md` sets the review level from what the diff touches.
`.seam/config.json` says `load_bearing` is `["db/schema.sql", "src/auth/**"]` and
`low_review_paths` is `["README.md", "docs/glossary.md"]`. The checker is at
`scripts/check_docs.py`.

For each of these seven diffs, tell me the level it takes and the row of the table that decides
it. Do not review anything — I only want the level.

1. `db/schema.sql` — adds a `not null` constraint to `hives.inspected`.
2. `scripts/check_docs.py` and `.seam/config.json` — switches assertion A5 on.
3. `docs/adr/0004-drop-the-queue-table.md` — a new decision record.
4. `CLAUDE.md` — adds a row to the sources-of-truth table.
5. `src/list.mjs` — adds a filter to the queenless query, following the pattern the three
   adjacent queries already use.
6. `README.md` — fixes a broken link.
7. `docs/engineering.md` — corrects one word in the § Hive states section.
