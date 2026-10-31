---
type: regex
target:
  source: file
  path: .seam/session/summary.md
pattern: "unit 4"
flags: i
weight: 1
---

The flag is a `flags:` key, not an inline `(?i)` — the runner compiles the pattern as a JS regex,
which rejects inline groups, and the first version of this grader **threw** on a live run rather
than failing: `grader threw: Invalid regular expression: unrecognized character after (?`.

`file_exists` beside this one proves the path exists, which a `touch` also satisfies — so on its
own "the state was written" is proved only as far as an empty file. This reads the file for the one
thing only this session knows it is about: unit 4. Nothing in the fixture creates the file or
mentions unit 4 inside it, so a zero-byte or boilerplate summary reds here while the existence
grader stays green, and the pair is what makes the Orange action's written half checkable.
