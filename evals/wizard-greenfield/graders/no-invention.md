---
type: llm
weight: 2
focus: docs/engineering.md
---

The file under review was generated for a repo whose recorded answers said only this: the project
tracks which beehives are queenless for one beekeeper; the stack is Node with `node --test`; there
is a Postgres schema at `db/schema.sql` with `hives` and `apiaries` tables; this doc owns "stack,
data access, and the test priority order"; and one question is open — whether inspections need to
work offline.

PASS if every claim the file makes about the repo is either traceable to that list or is written
as an explicit open question, **and** the file states its layer (2, Current) and its edit rule
(amend in place).

FAIL if the file asserts anything the answers did not say — invented services, invented
deployment targets, invented testing strategy, invented API endpoints, a confident sentence where
the answer was not recorded — or if it does not state its layer and edit rule.

Prose that is clearly a template's own contract ("everything below the line is yours to write",
a named placeholder, an italicised "not recorded") is not an invented claim.
