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

Along the way I noticed four things:

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

`docs/taxonomy.md` has the domains and priorities. `db/schema.sql` is the only load-bearing path.
