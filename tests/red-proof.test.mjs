// The mechanical half of `docs/decisions.md` D-003: an assertion is not done until its RED has
// been observed.
//
// What is checkable is the bookkeeping — every assertion this repo *enables* is named by at least
// one test that expects it in the checker's findings. What is not checkable is whether that test's
// proof **discriminates**: a check can fail for the wrong reason and still look healthy, and no
// scan of source text can tell a proof that pins the drift from one that pins its own shape. D-003
// says which half is which, and this file is the half that can be run.
//
// **Stated by direction, because one of the two matters more** (D-003's third sub-rule). This test
// can fail **open**: an id named inside a findings expectation satisfies it, so a test that names
// an id while actually measuring something else passes here. It cannot fail **closed** — a new
// assertion switched on with no test naming it has nowhere to hide, which is the direction a
// bookkeeping guard has to hold, because that is the one a reader would otherwise never see.
import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { readFileSync, readdirSync } from "node:fs";
import { REPO } from "./helpers.mjs";

/** Every assertion id this repo's config switches on. The config is a projection of
 *  `.seam/answers.json`; the checker refuses outright when its enabled set differs from the one
 *  `.seam/provenance.json` records, so this is the same set the checker runs. */
function enabledAssertions() {
  const cfg = JSON.parse(readFileSync(join(REPO, ".seam/config.json"), "utf8"));
  const ids = Object.entries(cfg.assertions ?? {})
    .filter(([, v]) => v?.enabled === true)
    .map(([id]) => id)
    .sort();
  assert.ok(ids.length >= 8, `read ${ids.length} enabled assertions from .seam/config.json,`
    + ` expected at least eight — the read broke, and an empty set would pass every assertion`
    + ` below without comparing anything`);
  return ids;
}

/** Assertion ids the test suite expects to see in the checker's findings. Two shapes, both of
 *  which are an id the checker is required to *report*: a row of the planted-drift table, and an
 *  `ids(r.findings)` expectation in a test of its own. A config patch naming an id, or a clean
 *  fixture expecting `[]`, matches neither — those are not failure paths. */
function idsWithAFailurePath() {
  const out = new Map();
  const files = readdirSync(join(REPO, "tests")).filter((f) => f.endsWith(".test.mjs")).sort();
  for (const f of files) {
    const src = readFileSync(join(REPO, "tests", f), "utf8");
    const add = (id) => out.set(id, `tests/${f}`);
    for (const m of src.matchAll(/^\s*\["([A-Z]\d+)",\s*"/gm)) add(m[1]);
    for (const m of src.matchAll(/ids\([^)]*\)\s*,\s*\[([^\]]*)\]/g)) {
      for (const q of m[1].matchAll(/"([A-Z]\d+)"/g)) add(q[1]);
    }
  }
  assert.ok(out.size >= 8, `found failure paths for ${out.size} assertions, expected at least`
    + ` eight — the scan broke, and nothing below would compare`);
  return out;
}

test("every assertion this repo enables has a test that watches it fail", () => {
  const proven = idsWithAFailurePath();
  const unproven = enabledAssertions().filter((id) => !proven.has(id));
  assert.deepEqual(unproven, [], `${unproven.join(", ")} ${unproven.length === 1 ? "is" : "are"}`
    + ` enabled in .seam/config.json and no test in tests/ expects ${unproven.length === 1
      ? "it" : "them"} in the checker's findings. An assertion is not done until its RED has been`
    + ` observed — docs/decisions.md D-003 — so switching one on means planting the drift it is`
    + ` meant to catch and watching the checker report it.`);
});
