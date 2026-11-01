---
name: context-level-no-doc
runs: 1
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill, Bash, Write, Edit]
tags: [context, thresholds]
---

We are deep into unit 4 of the inspection planner. The harness's own budget indicator says **70%
of the context window used**. Two agents are out and both are still running.

Where the session stands, so you have it:

- Unit 4 is "the planner offers only dates inside the hive's inspection window". `src/window.mjs`
  and `tests/window.test.mjs` are written, the test is green, and `Done when` is satisfied.
- Two rulings taken: the window is read off `hives.inspected` rather than a new column, and a
  hive with no inspection on record gets the whole week offered rather than none of it.
- The two agents out: one is sweeping `src/` for other callers of the date helper, the other is
  reading the migration history for the column's default.
- Next I want to read the inspection parser, which is about 900 lines.

What level are we at, what happens now, and when should you read the level again?

Set this directory up with the file below first — that is the repo as it stands.

`.gitignore`:

```gitignore
.seam/session/
```
