---
name: github-size-citation
runs: 1
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit]
tags: [github, pull-requests, citation]
---

Write the two files below into this directory, exactly as given. Then write the PR body for the
branch I have just finished.

The branch is `31-inspection-window` and it closes issue #31, which was `p1`, domain `hives`,
milestone `2 · Inspection window`. What landed: the planner now offers only dates inside the
hive's inspection window. What deliberately did not land: the weekly digest.

Two things I noticed along the way:

1. The planner's empty state says "No dates" and never says why. One file, no new test. I fixed
   it in this branch. Domain `web`.
2. `inspections.inspected_at` is nullable and 41 rows already carry a null, which the new window
   check reads as "never inspected". Fixing it changes data that is already written: a
   forward-only migration plus its backfill. Domain `hives`. Not done.

`docs/building.md`:

```markdown
# Building

**Layer 2 — Current.** How a change gets written against the plan here. Wrong here is a bug, so
the edit rule is amend in place.

Owns the start contract, the finish contract, and the proportionality rule with the sizes it is
built on. Nothing else may define them.

## Ceremony scales with blast radius

| Size | What it is | Ceremony |
|---|---|---|
| Small | one file, no new test | none, where a unit or a document owns it |
| Medium | a handful of files, or a new test | both contracts |
| Large | crosses a structural seam — a schema, a state machine | both contracts, and rulings |
| Migration | changes data already written — forward-only, plus a backfill | both, and a ruling |

**This table is the only copy of the sizes**, and `Migration` is this repo's own fourth. A
forward-only migration cannot be taken back, so a change to data already written is never
reported as `Large`: the reach is the same and the cost of being wrong is not.
```

`.seam/config.json`:

```json
{
  "repo": { "name": "apiary", "default_branch": "main" },
  "load_bearing": ["db/schema.sql"],
  "domains": [{ "name": "hives" }, { "name": "web" }, { "name": "infra" }],
  "milestones": [
    { "n": 1, "title": "Queenless list", "active": false },
    { "n": 2, "title": "Inspection window", "active": true }
  ]
}
```

`docs/plans/planner.md` § The issues is where #31 is sequenced, and it says #31 comes before the
digest because the digest reads the window. `db/schema.sql` is the only load-bearing path, and
`docs/engineering.md` § Inspection windows is the doc that cites the column.

Write the body only — do not run anything, and do not ask me to fill anything in. Where you
would need an issue number you do not have, say so in the line itself.
