// bin/seam-inventory.mjs — the adopt path's evidence gathering.
//
// The adopt path is the riskiest one, because a repo that already has docs already has an answer
// to most of the interview and it is written down somewhere — usually in two places that
// disagree. Classification is a judgment and stays with the model; collecting the evidence it
// judges on is procedural, so the probe rule says run it.
//
// Everything this program emits is traceable to the tree. It never states a layer as a fact: a
// guess arrives with the evidence for it, and the model shows it to the user as a proposal.
import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { readdirSync } from "node:fs";
import { gitRepo, rm, write, run } from "./helpers.mjs";

/** A repo with docs, committed, so the git-history evidence has something to read. */
function adoptRepo() {
  const { dir, git } = gitRepo();
  write(dir, "db/schema.sql", "create table hives (\n  id bigserial primary key\n);\n");
  write(dir, "docs/engineering.md",
    "# Engineering\n\n## Stack\n\nNode.\n\n## Build and tooling\n\nSee `docs/infra.md` § Deploy.\n");
  write(dir, "docs/infra.md", "# Infra\n\n## Deploy\n\nA box.\n");
  write(dir, "docs/adr/0001-pick-postgres.md",
    "# 0001. Pick Postgres\n\n**Date:** 2026-01-01\n**Status:** accepted\n\n## Context\n\nWe chose"
    + " Postgres over MongoDB because the data is relational.\n");
  write(dir, "docs/prd/PRD-v1.md", "# PRD v1\n\n## Purpose\n\nTrack hives.\n");
  write(dir, "docs/plans/first.md", "# First\n\n## The issues\n\n| # | Issue |\n|---|---|\n| 1 | #4 |\n");
  write(dir, "docs/findings-ledger.md", "# Findings ledger\n\n| Date | Observation |\n|---|---|\n");
  write(dir, "CLAUDE.md",
    "# Repo\n\n## Sources of truth\n\n| Doc | Owns |\n|---|---|\n"
    + "| `docs/engineering.md` | Stack, build and tooling |\n"
    + "| `docs/gone.md` | A doc that left the repo |\n");
  write(dir, ".github/workflows/ci.yml", "name: ci\non: [push]\njobs:\n  t:\n    steps:\n      - run: npm test\n");
  write(dir, ".claude/rules/testing.md", "# Testing\n\nTDD.\n");
  write(dir, ".claude/agents/app.md", "---\nname: app\n---\n\nApp work.\n");
  git("add", "-A");
  git("commit", "-m", "docs");
  return { dir, git };
}

function inventory(dir, extra = []) {
  const r = run("seam-inventory.mjs", ["--repo", dir, ...extra]);
  assert.equal(r.status, 0, r.stderr);
  return { inv: JSON.parse(r.stdout), r };
}

const byPath = (inv, p) => inv.docs.find((d) => d.path === p);

test("emits one entry per markdown doc it inventories, with size and headings", () => {
  const { dir } = adoptRepo();
  const { inv } = inventory(dir);
  const paths = inv.docs.map((d) => d.path).sort();
  assert.deepEqual(paths, [
    "CLAUDE.md",
    "docs/adr/0001-pick-postgres.md",
    "docs/engineering.md",
    "docs/findings-ledger.md",
    "docs/infra.md",
    "docs/plans/first.md",
    "docs/prd/PRD-v1.md",
  ]);
  const eng = byPath(inv, "docs/engineering.md");
  assert.deepEqual(eng.headings, ["Engineering", "Stack", "Build and tooling"]);
  assert.ok(eng.bytes > 0 && eng.lines > 0);
  rm(dir);
});

test("reports a dangling `*.md` citation and leaves a resolving one alone", () => {
  const { dir } = adoptRepo();
  const { inv } = inventory(dir);
  assert.deepEqual(byPath(inv, "CLAUDE.md").dangling.md, ["docs/gone.md"]);
  assert.deepEqual(byPath(inv, "docs/engineering.md").dangling.md, []);
  assert.ok(byPath(inv, "docs/engineering.md").cites.md.includes("docs/infra.md"));
  rm(dir);
});

test("resolves a `§` citation against the cited file's headings, and reports one that misses", () => {
  const { dir } = adoptRepo();
  write(dir, "docs/engineering.md",
    "# Engineering\n\n## Stack\n\nSee `docs/infra.md` § Deploy and `docs/infra.md` § Rollback.\n"
    // Its own paragraph: a bare § inherits the last file cited in the paragraph it sits in, so a
    // same-file citation has to stand clear of one that names another file.
    + "\nAnd § Stack of this very file, and § Nowhere of it.\n");
  const { inv } = inventory(dir);
  const dd = byPath(inv, "docs/engineering.md").dangling;
  const d = [...dd.sections, ...dd.bare_sections];
  assert.ok(d.some((s) => s.includes("docs/infra.md") && s.includes("Rollback")), JSON.stringify(d));
  assert.ok(d.some((s) => s.includes("Nowhere")), JSON.stringify(d));
  assert.ok(!d.some((s) => s.includes("Deploy")), "a resolving cross-file § was reported");
  assert.ok(!d.some((s) => s.includes("Stack")), "a resolving same-file § was reported");
  rm(dir);
});

test("a § citation matches a heading's first clause, not only its full text", () => {
  const { dir } = adoptRepo();
  write(dir, "docs/infra.md", "# Infra\n\n## Deploy — settled 2026-01-01, and narrow\n\nA box.\n");
  write(dir, "docs/engineering.md", "# Engineering\n\nSee `docs/infra.md` § Deploy for the box.\n");
  const { inv } = inventory(dir);
  assert.deepEqual(byPath(inv, "docs/engineering.md").dangling.sections, []);
  rm(dir);
});

test("guesses a layer for every doc, with the evidence, and never as a bare fact", () => {
  const { dir } = adoptRepo();
  const { inv } = inventory(dir);
  const expect = {
    "docs/adr/0001-pick-postgres.md": 3,
    "docs/prd/PRD-v1.md": 4,
    "docs/plans/first.md": 5,
    "docs/findings-ledger.md": 6,
    "docs/engineering.md": 2,
  };
  for (const [path, layer] of Object.entries(expect)) {
    const d = byPath(inv, path);
    assert.equal(d.layer_guess.layer, layer, `${path} guessed ${d.layer_guess.layer}`);
    assert.ok(d.layer_guess.why.length > 0, `${path} guessed a layer with no evidence`);
  }
  // Layer 1 is the code, so it is inventoried as an artifact rather than as a doc.
  assert.deepEqual(inv.artifacts, [{ path: "db/schema.sql", parser: "sql" }]);
  rm(dir);
});

test("reads the rows of an existing sources-of-truth table so the proposal can be diffed", () => {
  const { dir } = adoptRepo();
  const { inv } = inventory(dir);
  assert.equal(inv.table.file, "CLAUDE.md");
  assert.equal(inv.table.markers, false);
  assert.deepEqual(inv.table.rows, [
    { doc: "docs/engineering.md", cells: ["Stack, build and tooling"] },
    { doc: "docs/gone.md", cells: ["A doc that left the repo"] },
  ]);
  rm(dir);
});

test("flags an overlap when two docs claim the same heading", () => {
  const { dir } = adoptRepo();
  write(dir, "docs/architecture.md", "# Architecture\n\n## Stack\n\nAlso Node.\n");
  const { inv } = inventory(dir);
  const o = inv.overlaps.find((x) => x.heading === "Stack");
  assert.ok(o, `no overlap found: ${JSON.stringify(inv.overlaps)}`);
  assert.deepEqual(o.files.sort(), ["docs/architecture.md", "docs/engineering.md"]);
  rm(dir);
});

test("flags a layer violation when a Current doc carries a rationale", () => {
  const { dir } = adoptRepo();
  write(dir, "docs/engineering.md",
    "# Engineering\n\n## Queue\n\nWe chose a plain table over pg-boss because a library would"
    + " have to be configured.\n");
  const { inv } = inventory(dir);
  const v = inv.layer_violations.find((x) => x.path === "docs/engineering.md");
  assert.ok(v, `no violation found: ${JSON.stringify(inv.layer_violations)}`);
  assert.match(v.why, /rationale|layer 3/i);
  assert.ok(v.evidence.some((e) => /we chose/i.test(e)), JSON.stringify(v.evidence));
  rm(dir);
});

test("reads append-only-ness from git history, which is the layer's strongest signal", () => {
  const { dir, git } = adoptRepo();
  // One file only ever grows; the other is rewritten.
  write(dir, "docs/findings-ledger.md",
    "# Findings ledger\n\n| Date | Observation |\n|---|---|\n| 2026-01-02 | one |\n");
  write(dir, "docs/engineering.md", "# Engineering\n\n## Stack\n\nBun, actually.\n");
  git("add", "-A");
  git("commit", "-m", "second");
  const { inv } = inventory(dir);
  assert.equal(byPath(inv, "docs/findings-ledger.md").git.appends_only, true);
  assert.equal(byPath(inv, "docs/engineering.md").git.appends_only, false);
  assert.ok(byPath(inv, "docs/engineering.md").git.commits >= 2);
  rm(dir);
});

test("inventories the rest of the surface the interview needs", () => {
  const { dir } = adoptRepo();
  const { inv } = inventory(dir);
  assert.deepEqual(inv.ci.workflows, [".github/workflows/ci.yml"]);
  assert.deepEqual(inv.rules_dirs, [".claude/rules"]);
  assert.deepEqual(inv.agents, [".claude/agents/app.md"]);
  assert.equal(inv.repo.default_branch, "main");
  rm(dir);
});

test("counts the day-one drift the baseline will have to carry", () => {
  const { dir } = adoptRepo();
  const { inv } = inventory(dir);
  assert.equal(inv.summary.docs, 7);
  assert.equal(inv.summary.dangling_md, 1);
  assert.ok(inv.summary.dangling_sections >= 0);
  rm(dir);
});

test("is read-only", () => {
  const { dir } = adoptRepo();
  const before = readdirSync(dir).sort().join(",");
  inventory(dir);
  assert.equal(readdirSync(dir).sort().join(","), before);
  rm(dir);
});

test("emits valid JSON on a repo with no docs at all", () => {
  const { dir } = gitRepo();
  const { inv } = inventory(dir);
  assert.deepEqual(inv.docs, []);
  assert.deepEqual(inv.overlaps, []);
  assert.equal(inv.table.found, false);
  assert.equal(inv.summary.docs, 0);
  rm(dir);
});

test("--table names a different host file", () => {
  const { dir } = adoptRepo();
  write(dir, "docs/contributing.md", "# Contributing\n\n## Sources of truth\n\n| Doc | Owns |\n|---|---|\n| `docs/infra.md` | Deploy |\n");
  const { inv } = inventory(dir, ["--table", "docs/contributing.md"]);
  assert.equal(inv.table.file, "docs/contributing.md");
  assert.deepEqual(inv.table.rows, [{ doc: "docs/infra.md", cells: ["Deploy"] }]);
  rm(dir);
});

// ── Precision, measured against a real repo ──────────────────────────────────
//
// Every test below is a false positive or a miss found by running this program against a repo
// with 43 docs and reading the output. A classifier that is wrong nine times out of nine is
// noise, and noise in an adopt proposal is worse than no proposal.

test("a dated plan filename is layer 5, not a decision record", () => {
  const { dir, git } = adoptRepo();
  write(dir, "docs/superpowers/plans/2026-10-15-booking-gate.md", "# Booking gate\n\n## Steps\n\nOne.\n");
  git("add", "-A");
  git("commit", "-m", "plan");
  const { inv } = inventory(dir);
  const d = byPath(inv, "docs/superpowers/plans/2026-10-15-booking-gate.md");
  assert.equal(d.layer_guess.layer, 5, d.layer_guess.why.join("; "));
  rm(dir);
});

test("a four-digit MADR filename outside an adr directory is still layer 3", () => {
  const { dir } = adoptRepo();
  write(dir, "docs/0007-use-drizzle.md", "# 0007. Use Drizzle\n\n**Status:** accepted\n");
  const { inv } = inventory(dir);
  assert.equal(byPath(inv, "docs/0007-use-drizzle.md").layer_guess.layer, 3);
  rm(dir);
});

test("a § citation naming a heading's leading words resolves", () => {
  const { dir } = adoptRepo();
  write(dir, "docs/infra.md", "# Infra\n\n## Contact and identification\n\nA phone number.\n");
  write(dir, "docs/engineering.md",
    "# Engineering\n\nThe `docs/infra.md` § Contact rests the no-wrong-channel guarantee on"
    + " prerendering, so it holds.\n");
  const { inv } = inventory(dir);
  assert.deepEqual(byPath(inv, "docs/engineering.md").dangling.sections, []);
  rm(dir);
});

test("a § citation that names no heading at all is still reported", () => {
  const { dir } = adoptRepo();
  write(dir, "docs/engineering.md", "# Engineering\n\nThe `docs/infra.md` § Rollback plan says so.\n");
  const { inv } = inventory(dir);
  assert.deepEqual(byPath(inv, "docs/engineering.md").dangling.sections,
    ["docs/infra.md § Rollback plan says so"]);
  rm(dir);
});

test("a § preceded by a backticked non-markdown token is unresolvable, not dangling", () => {
  const { dir } = adoptRepo();
  write(dir, "docs/engineering.md",
    "# Engineering\n\nThe `some-skill` § The one gate owns the refusal.\n");
  const { inv } = inventory(dir);
  const d = byPath(inv, "docs/engineering.md");
  assert.deepEqual(d.dangling.sections, [],
    "a § naming something that is not a markdown file cannot be resolved, so it is not a defect");
  assert.ok(d.cites.unresolvable_sections.some((s) => s.includes("some-skill")),
    JSON.stringify(d.cites.unresolvable_sections));
  rm(dir);
});

test("a nested git worktree or repo is not walked", () => {
  const { dir } = adoptRepo();
  write(dir, ".claude/worktrees/123-thing/.git", "gitdir: /elsewhere\n");
  write(dir, ".claude/worktrees/123-thing/db/schema.sql", "create table copies (id int);\n");
  write(dir, ".claude/worktrees/123-thing/docs/engineering.md", "# Copy\n");
  const { inv } = inventory(dir);
  assert.deepEqual(inv.artifacts, [{ path: "db/schema.sql", parser: "sql" }],
    "a nested checkout's artifacts were inventoried as this repo's");
  assert.ok(!inv.docs.some((d) => d.path.includes("worktrees")), "a nested checkout's docs too");
  rm(dir);
});

test("root-level markdown is inventoried, and a product brief guesses layer 4", () => {
  const { dir } = adoptRepo();
  write(dir, "PRODUCT.md", "# Product\n\n## Purpose\n\nWhat this is for.\n");
  write(dir, "README.md", "# Repo\n\nHow to run it.\n");
  const { inv } = inventory(dir);
  assert.ok(byPath(inv, "PRODUCT.md"), "PRODUCT.md was not inventoried");
  assert.ok(byPath(inv, "README.md"), "README.md was not inventoried");
  assert.equal(byPath(inv, "PRODUCT.md").layer_guess.layer, 4);
  rm(dir);
});

test("the rationale scan ignores struck-through text and prose about other things", () => {
  const { dir } = adoptRepo();
  write(dir, "docs/engineering.md",
    "# Engineering\n\n## Draws\n\nAcross both draws nine companies were rejected for being too"
    + " large.\n\n~~We chose MongoDB because it was quicker to start.~~ Replaced below.\n");
  const { inv } = inventory(dir);
  assert.ok(!inv.layer_violations.some((v) => v.path === "docs/engineering.md"),
    JSON.stringify(inv.layer_violations));
  rm(dir);
});

test("a plan is flagged only for an explicit settling construction", () => {
  const { dir } = adoptRepo();
  write(dir, "docs/plans/first.md",
    "# First\n\nBoth halves are inherited rather than settled here, and `docs/decisions.md`"
    + " § Legal basis is **Locked**. Two open decisions were settled in #142.\n");
  write(dir, "docs/plans/second.md",
    "# Second\n\n**Settled:** the queue is a plain table.\n");
  const { inv } = inventory(dir);
  const flagged = inv.layer_violations.filter((v) => v.path.startsWith("docs/plans/")).map((v) => v.path);
  assert.deepEqual(flagged, ["docs/plans/second.md"], JSON.stringify(inv.layer_violations));
  rm(dir);
});

test("the table host is exempt from the rationale check", () => {
  const { dir } = adoptRepo();
  write(dir, "CLAUDE.md",
    "# Repo\n\n## Sources of truth\n\n| Doc | Owns |\n|---|---|\n| `docs/infra.md` | Deploy |\n\n"
    + "## Hard conventions\n\nA plain table, because pg-boss was considered and rejected.\n");
  const { inv } = inventory(dir);
  assert.ok(!inv.layer_violations.some((v) => v.path === "CLAUDE.md"),
    "the context file carries the authority rules on purpose");
  rm(dir);
});

test("an overlap names the layers involved, so a shared format is discountable", () => {
  const { dir } = adoptRepo();
  write(dir, "docs/plans/second.md", "# Second\n\n## The issues\n\n| # |\n|---|\n");
  const { inv } = inventory(dir);
  const o = inv.overlaps.find((x) => x.heading === "The issues");
  assert.ok(o, JSON.stringify(inv.overlaps.map((x) => x.heading)));
  assert.deepEqual(o.layers, [5]);
  rm(dir);
});

test("a bare § after a cited file in the same paragraph belongs to that file", () => {
  const { dir } = adoptRepo();
  write(dir, "docs/infra.md", "# Infra\n\n## Deploy\n\n## Rollback\n\nA box.\n");
  write(dir, "docs/engineering.md",
    "# Engineering\n\n## Stack\n\nThe box is described by `docs/infra.md` § Deploy and § Rollback,\n"
    + "which between them cover it.\n\nSeparately, § Stack is this file's own.\n");
  const { inv } = inventory(dir);
  assert.deepEqual(byPath(inv, "docs/engineering.md").dangling.sections, []);
  rm(dir);
});

test("a bare § in a paragraph that cites a file reports against that file when it misses", () => {
  const { dir } = adoptRepo();
  write(dir, "docs/engineering.md",
    "# Engineering\n\nSee `docs/infra.md` § Deploy and § Nowhere for the rest.\n");
  const { inv } = inventory(dir);
  assert.deepEqual(byPath(inv, "docs/engineering.md").dangling.sections,
    ["docs/infra.md § Nowhere for the rest"]);
  rm(dir);
});

test("a plan that disclaims settling is not flagged as settling", () => {
  const { dir } = adoptRepo();
  write(dir, "docs/plans/first.md",
    "# First\n\nWhat enqueues a row is inherited by this file rather than settled here: see\n"
    + "`docs/infra.md` § Deploy. Two open decisions were settled in #142, and one is not settled.\n");
  const { inv } = inventory(dir);
  assert.ok(!inv.layer_violations.some((v) => v.path === "docs/plans/first.md"),
    JSON.stringify(inv.layer_violations));
  rm(dir);
});

test("a plan that settles something mid-line is flagged, struck text aside", () => {
  const { dir } = adoptRepo();
  write(dir, "docs/plans/first.md",
    "# First\n\n~~Blocked on #9.~~ **Settled 2026-10-21:** the queue is a plain table.\n");
  const { inv } = inventory(dir);
  const v = inv.layer_violations.find((x) => x.path === "docs/plans/first.md");
  assert.ok(v, JSON.stringify(inv.layer_violations));
  rm(dir);
});

test("a backticked non-file token shadows only the § right after it", () => {
  const { dir } = adoptRepo();
  write(dir, "docs/infra.md", "# Infra\n\n## Deploy\n\nA box.\n");
  write(dir, "docs/engineering.md",
    "# Engineering\n\nThe level is `docs/infra.md` § Deploy, and `medium` is what § Deploy takes.\n"
    + "`some-skill` § Its Own Section. That owns the rest.\n");
  const { inv } = inventory(dir);
  const d = byPath(inv, "docs/engineering.md");
  assert.deepEqual(d.dangling.sections, [], JSON.stringify(d.dangling.sections));
  // "and `medium` is what § Deploy takes" lapses the target, so it falls back to this file and
  // misses. A bare miss is a guess, not a defect, which is why it has its own bucket.
  assert.deepEqual(d.dangling.bare_sections, ["docs/engineering.md § Deploy takes"]);
  assert.deepEqual(d.cites.unresolvable_sections, ["some-skill § Its Own Section"]);
  rm(dir);
});

test("an unbackticked *.md path before a § sets the target", () => {
  const { dir } = adoptRepo();
  write(dir, "docs/engineering.md", "# Engineering\n\nSee docs/infra.md § Nowhere for the box.\n");
  const { inv } = inventory(dir);
  assert.deepEqual(byPath(inv, "docs/engineering.md").dangling.sections,
    ["docs/infra.md § Nowhere for the box"]);
  rm(dir);
});

test("a heading's later dash-clause is citable, not only its first", () => {
  const { dir } = adoptRepo();
  write(dir, "docs/infra.md", "# Infra\n\n## D-012 — Geometry and spacing\n\nTokens.\n");
  write(dir, "docs/engineering.md",
    "# Engineering\n\nSee `docs/infra.md` § Geometry.\n\nAnd `docs/infra.md` § D-012.\n");
  const { inv } = inventory(dir);
  assert.deepEqual(byPath(inv, "docs/engineering.md").dangling.sections, []);
  rm(dir);
});

test("a run of §s separated by connectors all belong to the adjacent file", () => {
  const { dir } = adoptRepo();
  write(dir, "docs/infra.md", "# Infra\n\n## Deploy\n\n## Rollback\n\n## Ports\n\nA box.\n");
  write(dir, "docs/engineering.md",
    "# Engineering\n\n## Stack\n\nThe box: `docs/infra.md` § Deploy, § Rollback and § Ports.\n");
  const { inv } = inventory(dir);
  assert.deepEqual(byPath(inv, "docs/engineering.md").dangling.sections, []);
  rm(dir);
});

test("a § far from any citation is this file's own, not the paragraph's last target", () => {
  const { dir } = adoptRepo();
  write(dir, "docs/infra.md", "# Infra\n\n## Deploy\n\nA box.\n");
  write(dir, "docs/engineering.md",
    "# Engineering\n\n## Stack\n\nWhere `docs/infra.md` § Deploy puts the box is settled, and the\n"
    + "reason the stack is what it is belongs to § Stack rather than to anything else.\n");
  const { inv } = inventory(dir);
  const dd = byPath(inv, "docs/engineering.md").dangling;
  assert.deepEqual([...dd.sections, ...dd.bare_sections], [],
    "§ Stack resolves against this file; attributing it to infra.md would make it dangling");
  rm(dir);
});

test("a backticked label inside a markdown link is not a citation", () => {
  const { dir } = adoptRepo();
  write(dir, "docs/engineering.md",
    "# Engineering\n\n| Rule | Covers |\n|---|---|\n"
    + "| [`infra.md`](docs/infra.md) | the box |\n"
    + "| [`gone.md`](docs/gone.md) | nothing |\n");
  const { inv } = inventory(dir);
  const d = byPath(inv, "docs/engineering.md");
  assert.deepEqual(d.dangling.md, ["docs/gone.md"],
    "the label is not the citation; the link target is");
  assert.ok(d.cites.md.includes("docs/infra.md"));
  rm(dir);
});
