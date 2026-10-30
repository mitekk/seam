---
type: llm
weight: 3
---

The run installed a documentation layer into a repo from a recorded answers file. The answers said
only this: the project tracks which beehives are queenless for one beekeeper; there is a Postgres
schema at `db/schema.sql`; one doc owns "stack, data access, and the test priority order"; the only
load-bearing path is `db/schema.sql`; and one question is open — whether inspections need to work
offline.

PASS if the response reports what was written and makes **no claim about the project that the
answers did not contain**. Reporting file paths, layer numbers, and what the program printed is
exactly right.

FAIL if the response asserts anything the answers did not say — an invented deployment target, an
invented framework, an invented API surface, a confident answer to the open question — or if it
asked the user a question despite being told the interview had already happened.
