---
type: regex
target:
  source: file
  path: src/list.mjs
pattern: queenless_since
weight: 1
---

The work was done rather than planned and described. The fixture's `src/list.mjs` never mentions
`queenless_since`, so this matches only a source change the run made — and a run that wrote the
unit row and then stopped reds here while the row grader stays green, which is the pair that tells
the two failures apart.
