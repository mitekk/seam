// bin/seam-init.mjs — the wizard's deterministic half.
//
// The probe rule (docs/contributing.md § Test-first): the interview is a model's job, but
// turning a recorded answers file into `.seam/config.json` and a doc set is procedural logic
// you can run, so it is run here. `--answers` is a first-class mode and not a test hook —
// it is what lets adoption re-run in CI.
import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { scratch, rm, write, read, has, run, answers } from "./helpers.mjs";

/** Write an answers file into a fresh scratch repo and run the wizard against it. */
function init(ans, extraArgs = [], seed = () => {}) {
  const dir = scratch();
  seed(dir);
  const af = write(dir, "answers.json", JSON.stringify(ans, null, 2));
  const r = run("seam-init.mjs", ["--answers", af, "--repo", dir, ...extraArgs]);
  return { dir, r };
}

test("writes .seam/config.json as the answers minus every prose key", () => {
  const { dir, r } = init(answers());
  assert.equal(r.status, 0, r.stderr);
  const cfg = JSON.parse(read(dir, ".seam/config.json"));

  // Prose keys belong to the interview and to the docs it writes, never to a machine config.
  assert.ok(!("purpose" in cfg), "purpose is prose");
  assert.ok(!("open_questions" in cfg), "open_questions is prose");
  assert.ok(cfg.docs.every((d) => !("owns" in d)), "docs[].owns is prose");
  assert.ok(cfg.domains.every((d) => !("covers" in d)), "domains[].covers is prose");
  assert.ok(cfg.milestones.every((m) => !("green" in m)), "milestones[].green is prose");

  // Every machine key survives at the same key path — one namespace, no translation step.
  assert.equal(cfg.table.file, "CLAUDE.md");
  assert.equal(cfg.checker.language, "python");
  assert.equal(cfg.adr.format, "madr");
  assert.deepEqual(cfg.load_bearing, ["db/schema.sql"]);
  assert.deepEqual(cfg.low_review_paths, []);
  assert.deepEqual(
    cfg.docs.map((d) => [d.path, d.layer]),
    [
      ["docs/engineering.md", 2],
      ["docs/adr/*.md", 3],
      ["docs/prd/*.md", 4],
      ["docs/plans/first-subsystem.md", 5],
      ["docs/findings-ledger.md", 6],
    ],
  );
  rm(dir);
});

test("the config is byte-identical across runs on the same answers", () => {
  const ans = answers();
  const a = init(ans);
  const b = init(ans);
  assert.equal(read(a.dir, ".seam/config.json"), read(b.dir, ".seam/config.json"));
  rm(a.dir);
  rm(b.dir);
});

test("emits one file per approved doc row, each stating its layer and edit rule", () => {
  const { dir, r } = init(answers());
  assert.equal(r.status, 0, r.stderr);
  const expected = {
    "docs/engineering.md": ["Layer 2", "amend in place"],
    "docs/adr/README.md": ["Layer 3", "append-only"],
    "docs/prd/README.md": ["Layer 4", "immutable"],
    "docs/plans/first-subsystem.md": ["Layer 5", "superseded wholesale"],
    "docs/findings-ledger.md": ["Layer 6", "append-only"],
  };
  for (const [path, [layer, rule]] of Object.entries(expected)) {
    assert.ok(has(dir, path), `${path} not written`);
    const body = read(dir, path);
    assert.match(body, new RegExp(layer), `${path} does not state its layer`);
    assert.match(body, new RegExp(rule, "i"), `${path} does not state its edit rule`);
  }
  rm(dir);
});

test("writes the sources-of-truth table between the markers, preserving what is outside", () => {
  const before = "# Scratch\n\nHand-written prose above.\n";
  const after = "\n## Hand-written section below\n\nAlso mine.\n";
  const { dir, r } = init(answers(), [], (d) => {
    write(
      d,
      "CLAUDE.md",
      `${before}<!-- seam:sources-of-truth start -->\nstale table\n<!-- seam:sources-of-truth end -->${after}`,
    );
  });
  assert.equal(r.status, 0, r.stderr);
  const body = read(dir, "CLAUDE.md");
  assert.ok(body.startsWith(before), "prose above the markers was touched");
  assert.ok(body.endsWith(after), "prose below the markers was touched");
  assert.ok(!body.includes("stale table"), "the old table survived");
  assert.match(body, /\| Doc \| Layer \| Owns \| Enforces \|/);
  assert.match(body, /\| `docs\/engineering\.md` \| 2 /);
  rm(dir);
});

test("appends the table when the markers are absent, leaving the rest alone", () => {
  const existing = "# Scratch\n\nEverything here is mine.\n";
  const { dir, r } = init(answers(), [], (d) => write(d, "CLAUDE.md", existing));
  assert.equal(r.status, 0, r.stderr);
  const body = read(dir, "CLAUDE.md");
  assert.ok(body.startsWith(existing), "existing content was not preserved verbatim");
  assert.match(body, /<!-- seam:sources-of-truth start -->/);
  assert.match(body, /<!-- seam:sources-of-truth end -->/);
  rm(dir);
});

test("never rewrites an existing doc's body", () => {
  const mine = "# Engineering\n\nI wrote this and it must survive untouched.\n";
  const ans = answers();
  ans.docs[0].create = false;
  const { dir, r } = init(ans, [], (d) => write(d, "docs/engineering.md", mine));
  assert.equal(r.status, 0, r.stderr);
  assert.equal(read(dir, "docs/engineering.md"), mine);
  // and it is still a row in the table, because the table is about ownership, not authorship
  assert.match(read(dir, "CLAUDE.md"), /\| `docs\/engineering\.md` \| 2 /);
  rm(dir);
});

test("a doc that exists is never overwritten even when the answers say create", () => {
  const mine = "# Engineering\n\nPre-existing.\n";
  const { dir, r } = init(answers(), [], (d) => write(d, "docs/engineering.md", mine));
  assert.equal(r.status, 0, r.stderr);
  assert.equal(read(dir, "docs/engineering.md"), mine);
  assert.match(r.stdout, /kept\s+docs\/engineering\.md/);
  rm(dir);
});

test("the table carries all six layers, and marks the two that own nothing", () => {
  const { dir } = init(answers());
  const body = read(dir, "CLAUDE.md");
  for (const n of [1, 2, 3, 4, 5, 6]) {
    assert.match(body, new RegExp(`\\b${n} (Artifact|Current|Decisions|Intent|Seam|Ledger)`),
      `layer ${n} missing from the table`);
  }
  assert.match(body, /`db\/schema\.sql`/, "the layer-1 artifact row is missing");
  assert.match(body, /own nothing/i, "the table does not say which layers own nothing");
  rm(dir);
});

test("--dry-run writes nothing and prints what it would do", () => {
  const { dir, r } = init(answers(), ["--dry-run"]);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!has(dir, ".seam/config.json"), "config was written under --dry-run");
  assert.ok(!has(dir, "docs/engineering.md"), "a doc was written under --dry-run");
  assert.ok(!has(dir, "CLAUDE.md"), "the table host was written under --dry-run");
  assert.match(r.stdout, /would write\s+\.seam\/config\.json/);
  assert.match(r.stdout, /would write\s+docs\/engineering\.md/);
  rm(dir);
});

test("adr format madr emits a numbered record and an index; single emits one dated file", () => {
  const m = init(answers());
  assert.ok(has(m.dir, "docs/adr/README.md"), "no madr index");
  const first = read(m.dir, "docs/adr/0001-adopt-the-seam-doc-layers.md");
  for (const h of ["Date", "Status", "Context", "Considered Options", "Outcome", "Consequences"]) {
    assert.match(first, new RegExp(`^#+ .*${h}|^\\*\\*${h}`, "m"), `madr record lacks ${h}`);
  }
  assert.match(read(m.dir, "docs/adr/README.md"), /0001-adopt-the-seam-doc-layers\.md/);
  rm(m.dir);

  const ans = answers({ adr: { format: "single", file: "docs/decisions.md" } });
  ans.docs = ans.docs.map((d) =>
    d.path === "docs/adr/*.md" ? { ...d, path: "docs/decisions.md" } : d,
  );
  const s = init(ans);
  assert.equal(s.r.status, 0, s.r.stderr);
  assert.ok(!has(s.dir, "docs/adr"), "madr tree written for the single-file format");
  const dec = read(s.dir, "docs/decisions.md");
  assert.match(dec, /append-only/i);
  assert.match(dec, /\*\*Locked\*\*/, "the single-file format needs its Locked marker");
  rm(s.dir);
});

test("prd emits an immutable v1, a current file carrying the full text, and an index", () => {
  const { dir } = init(answers());
  assert.ok(has(dir, "docs/prd/PRD-v1.md"), "no PRD-v1.md");
  assert.ok(has(dir, "docs/prd/PRD-current.md"), "no PRD-current.md");
  const current = read(dir, "docs/prd/PRD-current.md");
  // PRD-current carries the full active text, not a pointer at the version file.
  assert.ok(current.length > 400, "PRD-current.md looks like a pointer, not the full text");
  assert.ok(!/^see \[?PRD-v1/im.test(current), "PRD-current.md is a pointer");
  assert.match(read(dir, "docs/prd/README.md"), /PRD-v1\.md/);
  assert.match(read(dir, "docs/prd/PRD-v1.md"), /never by editing/i);
  rm(dir);
});

test("the user's own words reach the docs, and open questions arrive as questions", () => {
  const ans = answers({
    purpose: "Tracks which beehives in the apiary are queenless, for one beekeeper.",
    open_questions: ["Whether hive inspections need an offline mode."],
  });
  const { dir } = init(ans);
  const prd = read(dir, "docs/prd/PRD-v1.md");
  assert.ok(prd.includes("queenless"), "the purpose did not reach the PRD in the user's words");
  const all = ["docs/prd/PRD-v1.md", "docs/engineering.md"].map((p) => read(dir, p)).join("\n");
  assert.ok(all.includes("offline mode"), "the open question was dropped");
  assert.match(all, /open question/i, "the open question is not labelled as one");
  rm(dir);
});

test("the table's Enforces column and config load_bearing are written consistently", () => {
  const ans = answers();
  ans.docs[0].enforces = "db/schema.sql";
  const { dir } = init(ans);
  const cfg = JSON.parse(read(dir, ".seam/config.json"));
  const table = read(dir, "CLAUDE.md");
  // A11's two sides: every Enforces value names something on load_bearing.
  const enforces = [...table.matchAll(/^\| `[^`]+` \| \d[^|]*\|[^|]*\| ([^|]*)\|/gm)]
    .map((m) => m[1].trim().replace(/`/g, ""))
    .filter(Boolean);
  assert.ok(enforces.includes("db/schema.sql"), "the Enforces value did not reach the table");
  for (const e of enforces) {
    assert.ok(cfg.load_bearing.includes(e), `${e} is in Enforces but not in load_bearing`);
  }
  rm(dir);
});

test("rejects an answers file that fails the schema, naming the key", () => {
  const cases = [
    [{ table: undefined }, /table\.file/],
    [{ docs: [{ path: "docs/x.md", layer: 9, owns: "x", enforces: "", create: true }] }, /layer/],
    [{ checker: { language: "ruby", path: "x" } }, /checker\.language/],
    [{ adr: { format: "sticky-notes" } }, /adr\.format/],
    // A layer-1 artifact that is not load-bearing is a contradiction: layer 1 wins over every
    // doc on what is true now, so it carries weight by construction.
    [{ load_bearing: [] }, /artifacts\[0\]\.path/],
  ];
  for (const [override, rx] of cases) {
    const { dir, r } = init(answers(override));
    assert.equal(r.status, 2, `expected exit 2 for ${JSON.stringify(override)}`);
    assert.match(r.stderr, rx);
    assert.ok(!has(dir, ".seam/config.json"), "a rejected run still wrote a config");
    rm(dir);
  }
});

test("writes the repo's agents from the template when the answers name any", () => {
  const ans = answers({
    agents: [{ name: "schema", covers: "Postgres schema, migrations", model: "opus", effort: "high" }],
  });
  const { dir, r } = init(ans);
  assert.equal(r.status, 0, r.stderr);
  const agent = read(dir, ".claude/agents/schema.md");
  assert.match(agent, /^---/, "agent file has no frontmatter");
  assert.match(agent, /name: schema/);
  assert.match(agent, /model: opus/);
  assert.match(agent, /effort: high/);
  assert.ok(agent.includes("Postgres schema"), "the agent's scope did not reach the file");
  rm(dir);
});

test("names a layer-2 doc the answers do not create as an open gap, not as a fact", () => {
  const ans = answers();
  ans.docs.push({
    path: "docs/checks.md",
    layer: 2,
    owns: "Why each check exists and what it does not reach",
    enforces: "",
    create: false,
  });
  const { dir, r } = init(ans);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!has(dir, "docs/checks.md"), "a create:false row was written anyway");
  assert.match(read(dir, "CLAUDE.md"), /`docs\/checks\.md`/, "the row is missing from the table");
  assert.match(r.stdout, /missing\s+docs\/checks\.md/, "the gap was not reported");
  rm(dir);
});

test("a layer-2 row named taxonomy.md gets the taxonomy template, not the generic one", () => {
  const ans = answers();
  ans.docs.push({
    path: "docs/taxonomy.md",
    layer: 2,
    owns: "The domain labels, the three priorities, and the milestones",
    enforces: "",
    create: true,
  });
  ans.domains = [
    { name: "hives", covers: "Hive state and inspection scheduling" },
    { name: "web", covers: "The pages a beekeeper opens" },
  ];
  ans.milestones = [{ n: 1, title: "Queenless list", green: "the list renders from the database" }];
  const { dir, r } = init(ans);
  assert.equal(r.status, 0, r.stderr);
  const t = read(dir, "docs/taxonomy.md");
  assert.match(t, /Layer 2/);
  assert.match(t, /amend in place/i);
  // The repo's own domains and milestones, in the user's words.
  assert.ok(t.includes("hives"), "a domain is missing");
  assert.ok(t.includes("Hive state and inspection scheduling"), "a domain's words are missing");
  assert.ok(t.includes("web"), "the second domain is missing");
  assert.ok(t.includes("Queenless list"), "the milestone is missing");
  assert.ok(t.includes("the list renders from the database"), "the milestone's green is missing");
  // The three priorities, by consequence.
  for (const p of ["p0", "p1", "p2"]) assert.ok(t.includes(p), `priority ${p} is missing`);
  assert.match(t, /outside (?:this|the) repo sees|outside the repo/i,
    "p0 is not defined by consequence");
  rm(dir);
});

test("a layer-2 row named reviewing.md gets the review-policy template", () => {
  const ans = answers();
  ans.docs.push({
    path: "docs/reviewing.md",
    layer: 2,
    owns: "The level policy, the rounds, and what a review leaves outstanding",
    enforces: "",
    create: true,
  });
  const { dir, r } = init(ans);
  assert.equal(r.status, 0, r.stderr);
  const t = read(dir, "docs/reviewing.md");
  assert.match(t, /Layer 2/);
  assert.match(t, /amend in place/i);
  // The condition table, including the row that follows from the append-only edit rule.
  assert.match(t, /load_bearing/);
  assert.match(t, /Layer 3 or 4/);
  assert.match(t, /low_review_paths/);
  // The bound, the three triggers, and the ratchet.
  assert.match(t, /Two rounds is the bound/);
  assert.match(t, /recommended, never automatic/i);
  assert.match(t, /ratchet/i);
  // The measurement, because a bound without one gets argued away.
  assert.match(t, /21 rounds/);
  assert.match(t, /6, 5, 5, 4, 6, 9, 5, 7, 4 and 4/);
  // The checker's path reached it from the config rather than being hardcoded.
  assert.ok(t.includes("scripts/check_docs.py"), "the checker path did not substitute");
  rm(dir);
});

test("a layer-2 row named routing.md gets the routing template", () => {
  const ans = answers();
  ans.docs.push({
    path: "docs/routing.md",
    layer: 2,
    owns: "Model and effort pinned per artifact, and this repo's agent shape",
    enforces: "",
    create: true,
  });
  const { dir, r } = init(ans);
  assert.equal(r.status, 0, r.stderr);
  const t = read(dir, "docs/routing.md");
  assert.match(t, /Layer 2/);
  assert.match(t, /This table is the only copy/);
  assert.match(t, /review depth, not model effort/i);
  rm(dir);
});

test("a glob row with matching files is not reported missing; one with none is", () => {
  const ans = answers();
  ans.docs.push({ path: "docs/rules/*.md", layer: 2, owns: "The per-topic defaults",
    enforces: "", create: false });
  ans.docs.push({ path: "docs/guides/*.md", layer: 2, owns: "Guides nobody has written",
    enforces: "", create: false });
  const { dir, r } = init(ans, [], (d) => {
    write(d, "docs/rules/api.md", "# API Rules\n");
    write(d, "docs/rules/ci.md", "# CI Rules\n");
  });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!/missing\s+docs\/rules/.test(r.stdout),
    `a glob row with files behind it is not missing:\n${r.stdout}`);
  assert.match(r.stdout, /missing\s+docs\/guides\/\*\.md/);
  // Both are still rows: the table is about ownership of a question.
  const table = read(dir, "CLAUDE.md");
  assert.match(table, /`docs\/rules\/\*\.md`/);
  assert.match(table, /`docs\/guides\/\*\.md`/);
  rm(dir);
});

test("rejects a glob row the wizard would be asked to create", () => {
  const ans = answers();
  ans.docs.push({ path: "docs/rules/*.md", layer: 2, owns: "The per-topic defaults",
    enforces: "", create: true });
  const { dir, r } = init(ans);
  assert.equal(r.status, 2, r.stdout);
  assert.match(r.stderr, /docs\[5\]\.path/);
  assert.match(r.stderr, /glob/i);
  rm(dir);
});

test("load_bearing and low_review_paths are optional, and default to empty", () => {
  // references/interview.md documents low_review_paths as defaulting to [], and the program
  // rejected the absent key — its own rejection message naming the default it would not apply.
  const ans = answers();
  delete ans.load_bearing;
  delete ans.low_review_paths;
  ans.artifacts = [];                 // an artifact must be load-bearing, so drop it too
  const { dir, r } = init(ans);
  assert.equal(r.status, 0, r.stderr);
  const cfg = JSON.parse(read(dir, ".seam/config.json"));
  assert.deepEqual(cfg.load_bearing, []);
  assert.deepEqual(cfg.low_review_paths, []);
  rm(dir);
});

test("checker.path defaults from the language, and a mismatch is still refused", () => {
  // The interview never asked for checker.path and § Defaults never mentioned it, so an answers
  // file built from the documented question set exited 2.
  for (const [language, expected] of [["python", "scripts/check_docs.py"], ["node", "scripts/check_docs.mjs"]]) {
    const ans = answers({ checker: { language } });
    const { dir, r } = init(ans);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(JSON.parse(read(dir, ".seam/config.json")).checker.path, expected);
    rm(dir);
  }
  const { dir, r } = init(answers({ checker: { language: "node", path: "scripts/check.py" } }));
  assert.equal(r.status, 2, r.stdout);
  assert.match(r.stderr, /checker\.path/);
  rm(dir);
});

test("A8's plan glob comes from the layer-5 row, not a hardcoded path", () => {
  // Measured on seam itself: adding a layer-5 row at docs/superpowers/specs/*.md switched A8 on
  // with plan_glob hardcoded to docs/plans/*.md, a directory that does not exist — so A8 was
  // enabled and compared nothing, which is the shape "off is not passing" objects to.
  const ans = answers();
  // A glob row is never created — it names a form. The validator enforces that, so the row
  // covers what is already there.
  ans.docs = ans.docs.map((d) =>
    d.layer === 5 ? { ...d, path: "docs/superpowers/specs/*.md", create: false } : d);
  const { dir, r } = init(ans);
  assert.equal(r.status, 0, r.stderr);
  const cfg = JSON.parse(read(dir, ".seam/config.json"));
  assert.equal(cfg.assertions.A8.enabled, true);
  assert.equal(cfg.assertions.A8.plan_glob, "docs/superpowers/specs/*.md");
  rm(dir);
});

test("A14 reads the plans A8 reads: on iff a layer-5 doc exists, with the same glob", () => {
  const ans = answers();
  ans.docs = ans.docs.map((d) =>
    d.layer === 5 ? { ...d, path: "docs/superpowers/specs/*.md", create: false } : d);
  const { dir, r } = init(ans);
  assert.equal(r.status, 0, r.stderr);
  const cfg = JSON.parse(read(dir, ".seam/config.json"));
  assert.equal(cfg.assertions.A14.enabled, true);
  assert.equal(cfg.assertions.A14.plan_glob, cfg.assertions.A8.plan_glob);
  assert.equal(cfg.assertions.A14.plan_glob, "docs/superpowers/specs/*.md");
  rm(dir);

  // No layer-5 doc, nothing for it to read: off, which is not the same as passing.
  const bare = answers();
  bare.docs = bare.docs.filter((d) => d.layer !== 5);
  const second = init(bare);
  assert.equal(second.r.status, 0, second.r.stderr);
  assert.equal(JSON.parse(read(second.dir, ".seam/config.json")).assertions.A14.enabled, false);
  rm(second.dir);
});

test("several layer-5 rows give A8 every one of them", () => {
  const ans = answers();
  ans.docs.push({ path: "docs/plans/*.md", layer: 5, owns: "Nothing — the plans",
    enforces: "", create: false });
  const { dir } = init(ans);
  const cfg = JSON.parse(read(dir, ".seam/config.json"));
  assert.deepEqual(cfg.assertions.A8.plan_glob,
    ["docs/plans/first-subsystem.md", "docs/plans/*.md"]);
  rm(dir);
});

test("A15 is off by default, with empty lists and the repo's default branch", () => {
  // It needs two repo-specific lists, and an empty list that passes would read as evidence.
  const { dir, r } = init(answers({ repo: { name: "scratch", default_branch: "trunk" } }));
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(read(dir, ".seam/config.json")).assertions.A15,
    { enabled: false, default_branch: "trunk", impl_globs: [], test_globs: [] });
  rm(dir);
});

test("A15's answers reach the config, keeping the default branch the repo already named", () => {
  const { dir, r } = init(answers({
    assertions: { A15: { enabled: true, impl_globs: ["src/**/*.ts"], test_globs: ["**/*.test.ts"] } },
  }));
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(read(dir, ".seam/config.json")).assertions.A15,
    { enabled: true, default_branch: "main", impl_globs: ["src/**/*.ts"], test_globs: ["**/*.test.ts"] });
  rm(dir);
});

test("one of A15's two lists without the other is rejected, naming the one that is missing", () => {
  // Either list alone would enable a comparison with one side empty, which is a check that can
  // only fail or only pass.
  for (const [given, missing] of [["impl_globs", "test_globs"], ["test_globs", "impl_globs"]]) {
    const { dir, r } = init(answers({ assertions: { A15: { enabled: true, [given]: ["x/**"] } } }));
    assert.equal(r.status, 2, `${given} alone: ${r.stdout}`);
    assert.match(r.stderr, new RegExp(`assertions\\.A15\\.${missing}`), r.stderr);
    assert.ok(!has(dir, ".seam/config.json"), "a rejected run still wrote a config");
    rm(dir);
  }
});

test("A15's lists must be lists", () => {
  const { dir, r } = init(answers({
    assertions: { A15: { enabled: true, impl_globs: "src/**", test_globs: ["tests/**"] } },
  }));
  assert.equal(r.status, 2, r.stdout);
  assert.match(r.stderr, /assertions\.A15\.impl_globs/);
  assert.ok(!has(dir, ".seam/config.json"), "a rejected run still wrote a config");
  rm(dir);
});
