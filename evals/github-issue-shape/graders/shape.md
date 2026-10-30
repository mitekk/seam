---
type: llm
weight: 3
---

The response should be a drafted GitHub issue plus the `gh issue create` command for it, for a
repo whose domains are `hives`, `web`, `infra`; whose priorities are `p0`, `p1`, `p2`; and whose
active milestone is `1 · Queenless list`.

PASS requires all of:

1. **One or two domain labels**, from that list — not three or more, and not invented ones.
2. **A priority**, and `p0` is defensible here because a live defect someone outside the repo
   sees is exactly clause one; `p1` is also defensible if it is argued from the milestone. A
   response with no priority fails.
3. **A milestone**, named as `1 · Queenless list`.
4. **A lead paragraph** a reader cold on the project could follow — not just a title.
5. **A `**Context**` line citing a doc by path and `§`** — for example
   `docs/plans/inspections.md` § The issues.
6. **`### Acceptance criteria` as checkboxes that are externally checkable** — outcomes someone
   else could verify without asking the author. "The list shows only hives whose state is
   queenless" passes; "refactor the query builder" does not, because it is an implementation
   step.
7. **`--body-file`**, not an inline `--body` string.

FAIL if any of the seven is missing or wrong, or if it ran the command despite being told not to.
