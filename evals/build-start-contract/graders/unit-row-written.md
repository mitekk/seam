---
type: regex
target:
  source: file
  path: docs/plans/inspections.md
pattern: "\\|[^\\n]*queenless_since[^\\n]*\\|"
weight: 1
---

The row is in the plan on disk, inside the table, rather than promised in the response. The
fixture's plan never mentions `queenless_since`, so this pattern matches only a row the run added.
