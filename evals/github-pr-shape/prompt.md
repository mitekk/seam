---
name: github-pr-shape
runs: 1
max_turns: 10
allowed_tools: [Read, Glob, Grep, Skill]
tags: [github, pull-requests]
---

Write the PR body for the branch I have just finished. Do not run anything.

The branch is `12-queenless-filter` and it closes issue #12, which was `p1`, domain `hives`,
milestone `1 · Queenless list`. What landed: the list query now filters on `hives.state`, and the
page shows a count. What deliberately did not land: pagination.

Along the way I noticed five things:

1. The page's heading was the wrong size on a phone. One file, no new test. I fixed it in this
   branch. Domain `web`.
2. The inspection form lets you save an inspection dated in the future, which a beekeeper using
   the app would hit. It crosses the schema and both the form and the API — several files and a
   new constraint. Domain `hives`. Not done.
3. The CI job installs dependencies twice, which costs about forty seconds a run. True, and
   nothing outside the repo is worse off, and it does not block the active milestone. Domain
   `infra`. Not done.
4. A broken link in the top-level `README.md`, one line. Domain `web`. Not part of this branch's
   scope at all.
5. The filtered list comes back in whatever order the query happens to return, so the same
   apiary reads differently from one page load to the next. Sorting it by hive name is one file
   and one more assertion in a test that already exists, and this branch could finish it today.
   Nothing in `docs/plans/inspections.md` § The issues covers a sort order. Domain `hives`. Not
   done yet.

`docs/taxonomy.md` has the domains and priorities. `db/schema.sql` is the only load-bearing path.
`docs/plans/inspections.md` § The issues is where #12 is sequenced, and it says #12 comes first
because every later screen reads the filtered list. `docs/engineering.md` § Hive states is the doc
that cites the schema's vocabulary.

Write the body only — do not run anything, and do not ask me to fill anything in. Where you would
need an issue number you do not have, say so in the line itself.
