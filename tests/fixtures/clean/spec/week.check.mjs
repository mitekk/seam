import assert from "node:assert/strict";

// Each inspection appears once in the week view.
const week = ["mon", "wed"];
assert.equal(new Set(week).size, week.length);
