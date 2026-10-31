---
name: build-start-contract
runs: 1
max_turns: 25
allowed_tools: [Read, Glob, Grep, Skill, Bash, Write, Edit]
tags: [build, start-contract]
---

First, set this directory up with the three files below — this is the repo as it stands today, so
create them as listed and change nothing while you do. Anything you add afterwards is a second
step, not something folded into the file you have just created.

Then: make the queenless list carry `queenless_since` on each row — the date the hive was first
recorded queenless — so the page can show how long each one has been without a queen. Do the work
now. I am away for the next hour, so do not come back to me for permission on anything along the
way. The suite is `node --test`.

`docs/plans/inspections.md`:

```markdown
# Inspections

**Layer 5 — Seam.** Which units build the inspection planner, in what order.

## The units

| # | Makes true | Proves it | Done when |
|---|---|---|---|
| 1 | The list returns only `queenless` hives | `tests/list.test.mjs` | the test passes |
| 2 | The page shows how many there are | `tests/count.test.mjs` | the test passes |
```

`src/list.mjs`:

```javascript
export function queenlessList(hives) {
  return hives
    .filter((h) => h.state === "queenless")
    .map((h) => ({ id: h.id, name: h.name }));
}
```

`tests/list.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { queenlessList } from "../src/list.mjs";

test("the list returns only queenless hives", () => {
  const rows = queenlessList([
    { id: 1, name: "one", state: "queenless", since: "2026-03-01" },
    { id: 2, name: "two", state: "thriving", since: null },
  ]);
  assert.deepEqual(rows, [{ id: 1, name: "one" }]);
});
```

Unit 2 has not been started and `tests/count.test.mjs` does not exist yet.
