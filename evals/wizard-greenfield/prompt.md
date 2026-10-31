---
name: wizard-greenfield
runs: 1
max_turns: 25
allowed_tools: [Read, Glob, Grep, Skill, Bash, Write, Edit]
tags: [wizard, greenfield]
---

Set this directory up as a git repo with the two files below, written exactly as given, and then
install a documentation layer from the answers file. `seam-answers.json` is the record of an
interview that has already happened — **do not ask me anything**, and do not decide anything it
does not answer.

`db/schema.sql`:

```sql
create type hive_state as enum ('queenless', 'requeened', 'thriving');

create table hives (
  id          bigserial primary key,
  apiary_id   bigint not null,
  state       hive_state not null default 'queenless',
  inspected   timestamptz
);

create table apiaries (
  id    bigserial primary key,
  name  text not null unique
);
```

`seam-answers.json`:

```json
{
  "seam_version": "0.1.0",
  "purpose": "Tracks which beehives in an apiary are queenless, so one beekeeper can plan a week of inspections.",
  "users": "One beekeeper, managing between two and forty hives.",
  "in_scope": ["Recording a hive's state", "Listing the queenless hives"],
  "out_of_scope": ["Honey yield accounting", "More than one beekeeper per apiary"],
  "repo": { "name": "apiary", "default_branch": "main" },
  "table": { "file": "CLAUDE.md" },
  "checker": { "language": "python", "path": "scripts/check_docs.py" },
  "adr": { "format": "madr", "dir": "docs/adr" },
  "prd": { "dir": "docs/prd", "version": 1 },
  "artifacts": [{ "path": "db/schema.sql", "parser": "sql" }],
  "docs": [
    { "path": "docs/engineering.md", "layer": 2, "owns": "Stack, data access, and the test priority order", "enforces": "", "create": true },
    { "path": "docs/adr/*.md", "layer": 3, "owns": "What was chosen, the options rejected, and why", "enforces": "", "create": true },
    { "path": "docs/prd/*.md", "layer": 4, "owns": "What we are trying to build", "enforces": "", "create": true },
    { "path": "docs/plans/inspections.md", "layer": 5, "owns": "Nothing — which issues build the inspection planner, in what order", "enforces": "", "create": true },
    { "path": "docs/findings-ledger.md", "layer": 6, "owns": "Nothing — true observations that are not becoming work", "enforces": "", "create": true }
  ],
  "load_bearing": ["db/schema.sql"],
  "low_review_paths": [],
  "domains": [{ "name": "hives", "covers": "Hive state and inspection scheduling" }],
  "milestones": [{ "n": 1, "title": "Queenless list", "green": "the list renders from the database", "active": true }],
  "agents": [],
  "assertions": {},
  "open_questions": ["Whether inspections need to work offline, in a field with no signal."]
}
```

When you are done, list the files you wrote, one per line.
