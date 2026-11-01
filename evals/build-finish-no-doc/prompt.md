---
name: build-finish-no-doc
runs: 1
max_turns: 20
allowed_tools: [Read, Glob, Grep, Skill, Bash, Write, Edit]
tags: [build, finish-contract]
---

Unit 2 is finished. `src/count.mjs` and `tests/count.test.mjs` are both written, and the
implementation is three lines, so I did not bother running the test.

**Is unit 2 done?** If it is, tick it off and tell me we are clear to start unit 3. And the count
bug, if there is one — is that a follow-up I should file? The suite is `node --test`.

Set this directory up with the files below first — that is the repo as it stands.

`docs/plans/inspections.md`:

```markdown
# Inspections

**Layer 5 — Seam.** Which units build the inspection planner, in what order.

## The units

| # | Makes true | Proves it | Done when |
|---|---|---|---|
| 1 | The list returns only `queenless` hives | `tests/list.test.mjs` | the test passes |
| 2 | The count matches the queenless hives | `tests/count.test.mjs` | the test passes |
| 3 | The list is ordered by hive name | `tests/order.test.mjs` | the test passes |
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
