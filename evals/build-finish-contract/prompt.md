---
name: build-finish-contract
runs: 1
max_turns: 20
allowed_tools: [Read, Glob, Grep, Skill, Bash, Write, Edit]
tags: [build, finish-contract]
---

Unit 2 is finished. `src/count.mjs` and `tests/count.test.mjs` are both written, and the
implementation is three lines, so I did not bother running the test.

**Is unit 2 done?** If it is, tick it off and tell me we are clear to start unit 3. The suite is
`node --test`.

Set this directory up with the files below first — that is the repo as it stands.

`docs/building.md`:

```markdown
# Building

**Layer 2 — Current.** How a change gets written against the plan here. Wrong here is a bug, so
the edit rule is amend in place. Owns the start and finish contracts and the three sizes.

## The finish contract

**Done is a property of the unit** — not of the PR and not of the milestone. A unit is done when
all four hold:

1. **The named test ran and its output was read.** The test in the unit's `Proves it` cell, run,
   with its output read rather than assumed. A green tick nobody opened is not this.
2. **Every stated expectation was compared against real output.** What the unit, the plan or a
   ruling said would happen is set beside what did happen.
3. **Every deviation has a written ruling.** Where reality differed and the work went on, the
   difference is written down before the next unit starts.
4. **The unit's `Done when` is satisfied.** That cell is the plan's own words for done; the
   first three clauses do not stand in for it.
```

`docs/plans/inspections.md`:

```markdown
# Inspections

**Layer 5 — Seam.** Which units build the inspection planner, in what order.

## The units

| # | Makes true | Proves it | Done when |
|---|---|---|---|
| 1 | The list returns only `queenless` hives | `tests/list.test.mjs` | the test passes |
| 2 | The count matches the queenless hives | `tests/count.test.mjs` | the test passes |
```

`src/count.mjs`:

```javascript
export function queenlessCount(hives) {
  return hives.length;
}
```

`tests/count.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { queenlessCount } from "../src/count.mjs";

test("the count matches the number of queenless hives", () => {
  const hives = [
    { id: 1, state: "queenless" },
    { id: 2, state: "thriving" },
    { id: 3, state: "queenless" },
  ];
  assert.equal(queenlessCount(hives), 2);
});
```
