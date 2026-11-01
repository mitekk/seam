// bin/seam-init.mjs — the wizard's deterministic half.
//
// The probe rule (docs/contributing.md § Test-first): the interview is a model's job, but
// turning a recorded answers file into `.seam/config.json` and a doc set is procedural logic
// you can run, so it is run here. `--answers` is a first-class mode and not a test hook —
// it is what lets adoption re-run in CI.
import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { scratch, rm, write, read, has, run, answers, REPO } from "./helpers.mjs";

/** Write an answers file into a fresh scratch repo and run the wizard against it. */
function init(ans, extraArgs = [], seed = () => {}) {
  const dir = scratch();
  seed(dir);
  const af = write(dir, "answers.json", JSON.stringify(ans, null, 2));
  const r = run("seam-init.mjs", ["--answers", af, "--repo", dir, ...extraArgs]);
  return { dir, r };
}

/**
 * The interview's two tables and the answers schema, each sliced to its own section. **Both ends
 * of every slice are pinned**: a doc's name appears in more than one section, so a slice running
 * to EOF accepts a row moved into any later one — § Rejections included — and a renamed heading
 * fails loudly instead of widening the region to the rest of the file.
 */
function interviewTables() {
  const md = readFileSync(join(REPO, "skills/seam-docs/references/interview.md"), "utf8");
  const bounds = {
    questions: ["### What must be asked, never inferred", "### The discipline"],
    schema: ["## Schema", "### Defaults the program fills"],
    defaults: ["### Defaults the program fills", "### Rejections"],
  };
  const out = {};
  for (const [half, [from, to]] of Object.entries(bounds)) {
    const [i, j] = [md.indexOf(from), md.indexOf(to)];
    assert.ok(i !== -1 && j > i, `interview.md's ${from} .. ${to} slice moved; update this test`);
    out[half] = md.slice(i, j);
  }
  return out;
}

/**
 * Every question row's **answers-key cell** — the third column — with its row number. That cell is
 * the only place a row says which key it fills: a key in a Notes cell is a cross-reference, and
 * matching the whole section let the interview lose the question that fills `load_bearing` or
 * `milestones[].active` with the test still green.
 */
function questionKeyCells(questions) {
  return questions.split("\n").filter((l) => /^\|\s*\d+\s*\|/.test(l))
    .map((l) => l.split("|").map((c) => c.trim()))
    .map((cells) => ({ n: Number(cells[1]), key: cells[3] ?? "" }));
}

/**
 * Resolve a dotted answers-key path against a config object. `milestones[].active` resolves on the
 * first row, since every row carries the same shape. Returns `undefined` for a path the config
 * does not have — which is what a mistyped subkey is, and what substring-matching a doc missed.
 */
function resolveKeyPath(cfg, path) {
  let node = cfg;
  for (const seg of path.split(".")) {
    const isList = seg.endsWith("[]");
    const name = isList ? seg.slice(0, -2) : seg;
    if (node === null || typeof node !== "object" || !(name in node)) return undefined;
    node = node[name];
    if (isList) {
      if (!Array.isArray(node)) return undefined;
      node = node[0];
    }
  }
  return node;
}

/**
 * A layer-2 doc is proposed when a question **asks for it as a proposal** and carries the row it
 * writes, and when § Defaults records that default. Both halves match on the words the convention
 * uses rather than on the shape of a proposal: a row can carry the row it would write and still
 * say never to ask, and `**not proposed by default**` contains the word `proposed`.
 */
function assertProposed(tables, base) {
  const esc = (s) => s.replace(/\./g, "\\.");
  const asked = "\\*\\*Proposed by default; ask it as a proposal, not an open question\\.\\*\\*";
  const writes = `"path": "docs/${esc(base)}"[^\\n]*"create": true`;
  const row = `^\\|[^\\n]*${asked}[^\\n]*${writes}[^\\n]*\\|[ \\t]*$`;
  assert.match(tables.questions, new RegExp(row, "m"),
    `no question proposes docs/${base} by default and writes its row with "create": true`);
  const dflt = `^\\|[^|\\n]*${esc(base)}[^|\\n]*\\|\\s*\\*\\*proposed by default\\*\\*\\s*\\|`;
  assert.match(tables.defaults, new RegExp(dflt, "m"),
    `§ Defaults has no row recording docs/${base} as **proposed by default**`);
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
  // `active` is a machine key: the qualifier's third clause reads it from here, so a projection
  // that dropped it would leave the clause with no fact to check.
  assert.deepEqual(cfg.milestones, [{ n: 2, title: "First subsystem", active: true }]);
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
  ans.milestones = [{ n: 2, title: "Queenless list", green: "the list renders from the database", active: true }];
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
  // The doc is hard-wrapped, so a phrase can break across a line; match on the flattened text.
  const flat = t.replace(/\s+/g, " ");
  assert.match(t, /Layer 2/);
  assert.match(t, /This table is the only copy/);
  assert.match(t, /review depth, not model effort/i);
  // The two phases the other two layer-2 docs create. Neither has a row anywhere else, so an
  // unnamed phase runs at whatever the session happened to be set to.
  assert.match(flat, /\| Planning [^|]*writing the unit \|/);
  assert.match(flat, /\| Dispatched subagent \|/);
  assert.match(flat, /come from another layer-2 doc/i);
  // An owning artifact may be a skill the repo installed rather than a file in its tree — which
  // is how a real repo routes planning and review — and the method bundles none of them.
  assert.match(flat, /may be something this repo does not own/i);
  assert.match(flat, /Nothing third-party is bundled with this method/);
  assert.match(flat, /only lets a repo name what it already installed/);
  // The two seams with the docs that create those phases, each stated from this side too.
  assert.match(flat, /decides \*whether\* to dispatch/);
  assert.match(flat, /what done means/i);
  // Every bullet that hands a question to another layer-2 doc hedges, because all three of those
  // docs are proposals a repo may decline: an unhedged bullet assigns the question to an owner
  // that does not exist. The count is what keeps a fourth bullet from arriving unhedged.
  assert.match(flat, /The review policy doc owns the level, where this repo writes one down/);
  assert.equal((flat.match(/where this repo writes one down/g) ?? []).length, 3,
    "a cross-reference to a declinable doc is unhedged, or a fourth one arrived");
  assert.ok(!/\{\{[\w.]+\}\}/.test(t), "an unrendered placeholder is left in the doc");
  rm(dir);
});

// The doc says "this table is the only copy", so the levels a run pins have to be in it. The
// program already knows them: it writes `.claude/agents/<name>.md` with the model and the effort
// in frontmatter and the pair into `.seam/config.json`, so a hand-fill clause here would leave
// the one table that claims to be authoritative as the only place they are missing.
test("routing.md records the per-agent levels the run pinned, and the agents it wrote", () => {
  const ans = answers({
    agents: [
      { name: "schema", covers: "Postgres schema, migrations", model: "opus", effort: "high" },
      { name: "app", covers: "The Next.js app", model: "sonnet", effort: "medium" },
    ],
  });
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
  const flat = t.replace(/\s+/g, " ");

  // One Implement row per agent, carrying that agent's two levels, and no placeholder row left.
  const implement = (n, m, e) => {
    const path = `\`\\.claude/agents/${n}\\.md\``;
    const cells = [`Implement — ${n}`, path, `\`${m}\``, `\`${e}\``].join(" \\| ");
    return new RegExp(`\\| ${cells} \\|`);
  };
  assert.match(flat, implement("schema", "opus", "high"));
  assert.match(flat, implement("app", "sonnet", "medium"));
  assert.ok(!flat.includes("| Implement | `.claude/agents/<name>.md` |"),
    "the generic Implement row survived a run that named agents");

  // The Agents table is this repo's, in the words the answers used.
  assert.match(flat, /\| `schema` \| Postgres schema, migrations \|/);
  assert.match(flat, /\| `app` \| The Next.js app \|/);
  assert.ok(!flat.includes("`<the paths and the subsystem>`"),
    "the placeholder agent row survived a run that named agents");

  // One value per level, projected to the three places that carry it — doc, agent file, config.
  for (const [name, model, effort] of [["schema", "opus", "high"], ["app", "sonnet", "medium"]])
    assert.match(read(dir, `.claude/agents/${name}.md`),
      new RegExp(`model: ${model}\\neffort: ${effort}`), `${name}'s frontmatter disagrees`);
  const cfg = JSON.parse(read(dir, ".seam/config.json"));
  assert.deepEqual(cfg.agents.map((g) => [g.name, g.model, g.effort]),
    [["schema", "opus", "high"], ["app", "sonnet", "medium"]]);

  assert.ok(!/\{\{[\w.]+\}\}/.test(t), "an unrendered placeholder is left in the doc");
  rm(dir);
});

test("routing.md with no agents gets a sentence where the table would be", () => {
  const ans = answers();                            // answers() names no agents
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
  const flat = t.replace(/\s+/g, " ");
  // A header over no rows reads as a table someone forgot to fill; an empty list is an answer.
  assert.match(flat, /This repo named no agents/);
  assert.ok(!flat.includes("| Agent | Scope | Reads before changing |"),
    "a table header with no rows shipped for a repo that named no agents");
  // With no agent to pin, the Implement row stays the form it has always been.
  assert.match(flat, /\| Implement \| `\.claude\/agents\/<name>\.md` \| — \| — \|/);
  assert.ok(!/\{\{[\w.]+\}\}/.test(t), "an unrendered placeholder is left in the doc");
  rm(dir);
});

test("a layer-2 row named building.md gets the build template", () => {
  const ans = answers();
  ans.docs.push({
    path: "docs/building.md",
    layer: 2,
    owns: "How a unit of work is started, finished and proved",
    enforces: "",
    create: true,
  });
  const { dir, r } = init(ans);
  assert.equal(r.status, 0, r.stderr);
  const t = read(dir, "docs/building.md");
  // The doc is hard-wrapped, so a phrase can break across a line; match on the flattened text.
  const flat = t.replace(/\s+/g, " ");
  assert.match(t, /Layer 2/);
  assert.match(t, /amend in place/i);
  // The two contracts, by name, and the one principle they serve.
  assert.match(flat, /start contract/i);
  assert.match(flat, /finish contract/i);
  assert.match(flat, /The written unit comes before the work, and nothing stops for permission/);
  // The finish contract's four clauses: the named test, the expectations, the rulings, Done when.
  assert.match(flat, /named test ran and its output was read/i);
  assert.match(flat, /every stated expectation was compared against real output/i);
  assert.match(flat, /every deviation has a written ruling/i);
  assert.match(t, /`Done when`/);
  // TDD is how a unit becomes code, and a model call is the one exemption: what is written first
  // there is the deterministic contract around it.
  assert.match(flat, /no failing test for/i);
  assert.match(flat, /deterministic contract/i);
  // Ceremony scales: a Small change inside an existing unit pays nothing.
  assert.match(flat, /no new unit, no DoD and no ruling/i);
  // ...and so is a change a document owns: without the carve-out in the Small row a README typo
  // would earn a plan unit, which is the anti-goal verbatim.
  assert.match(flat, /\| Small \| one file, no new test \| a unit owns it, or a document does/);
  // The carve-out grants document-owned work no row, so the finish contract's two clauses that
  // read a row (the named test, `Done when`) must name what satisfies them instead. Without this
  // the path is granted and cannot be completed.
  assert.match(flat, /A document-owned change has no test: the document as it now stands is the output/);
  assert.match(flat, /A document-owned change has no row: what the change claimed to make true is true in the document as it now stands/);
  // Who owns the work is orthogonal to its size, so Medium and Large carry the carve-out too.
  assert.match(flat, /\| Medium \|[^|]*\| [^|]*if no unit or document owns it, write the row \|/);
  assert.match(flat, /\| Large \|[^|]*\| [^|]*if no unit or document owns it, write the row \|/);
  // A ruling is written in the layer-3 track's own shape, so the doc never fixes the fields — in a
  // one-file-per-decision repo a recipe written for the single file reds the checker's own A13.
  assert.match(flat, /in the shape that layer-3 track already defines/i);
  // A review finding is about the unit under review's output, so that unit already owns the fix.
  assert.match(flat, /unit under review/i);
  // The checker's path reached it from the config rather than being hardcoded.
  assert.ok(t.includes("scripts/check_docs.py"), "the checker path did not substitute");
  assert.ok(!/\{\{[\w.]+\}\}/.test(t), "an unrendered placeholder is left in the doc");
  rm(dir);
});

test("the interview has a question proposing building.md, and § Defaults records it as proposed", () => {
  assertProposed(interviewTables(), "building.md");
});

test("a layer-2 row named context.md gets the context template", () => {
  const ans = answers();
  ans.docs.push({
    path: "docs/context.md",
    layer: 2,
    owns: "The context budget, and when a subagent is dispatched",
    enforces: "",
    create: true,
  });
  const { dir, r } = init(ans);
  assert.equal(r.status, 0, r.stderr);
  const t = read(dir, "docs/context.md");
  // The doc is hard-wrapped, so a phrase can break across a line; match on the flattened text.
  const flat = t.replace(/\s+/g, " ");
  assert.match(t, /Layer 2/);
  assert.match(t, /amend in place/i);
  // The four levels, on the decision points the method arrived with — 50, 60, 75 — written as
  // floors, which is what leaves neither an overlap nor a gap at any of them: a range picks a side
  // at each boundary and picks it twice. The header is pinned with them, because a column of bare
  // floors means nothing without it.
  assert.match(flat, /\| Level \| Usage at or above \| Required action \|/);
  assert.match(flat, /\| \*\*Green\*\* \| 0% \|/);
  assert.match(flat, /\| \*\*Yellow\*\* \| 50% \|/);
  assert.match(flat, /\| \*\*Orange\*\* \| 60% \|/);
  assert.match(flat, /\| \*\*Red\*\* \| 75% \|/);
  assert.match(flat, /take the highest level whose floor the figure has reached/i);
  // Every action above Green is one move, which is what makes the table a policy and not a mood.
  assert.match(flat, /write to disk, and prefer disk over context/i);
  // An action the session cannot take alone is still an action, and the work the gate holds does
  // not proceed on the strength of having asked — or Yellow's gate is not a gate.
  assert.match(flat, /the gated work waits/i);
  // What triggers a level: the harness's own indicator first, heuristics only as the fallback,
  // and the reason the fallback exists — without it the table is unenterable where there is no
  // indicator to read.
  assert.match(flat, /budget indicator/i);
  assert.match(flat, /agents dispatched/i);
  assert.match(flat, /large reads/i);
  assert.match(flat, /an unreadable threshold is the same as no threshold/i);
  // The bands are keyed on what has been consumed, and the likeliest harness reports the inverse,
  // so the direction is stated where the reader meets the indicator. Without it a session reading
  // "23% left" lands on Green while it is in fact at Red — the degradation the table prevents,
  // reached by following the instruction correctly.
  assert.match(flat, /usage is the fraction of the window already consumed/i);
  assert.match(flat, /100% minus/);
  // The fallback rows overlap and are not exhaustive, so without a precedence rule and a default
  // the level is undecidable in ordinary states — a fresh session whose tool call misbehaves
  // matches Green and Red at once, and the skill forbids falling back to a feeling.
  assert.match(flat, /take the highest level whose row matches/i);
  assert.match(flat, /where none matches, the level is Green/i);
  // Rows 2 and 3 carry the same count on purpose — anticipated spend against realised spend — so
  // the equality reads as the rule it is rather than as a slip someone later corrects.
  assert.match(flat, /anticipated or realised/i);
  // The dispatch rule: two reasons, and the closed list is the rule.
  assert.match(flat, /\*\*parallel\*\*/);
  assert.match(flat, /\*\*detached\*\*/);
  assert.match(flat, /and nothing else/i);
  // Where session artifacts live, and the reason they are not under `docs/`.
  assert.match(flat, /`\.seam\/session\/`/);
  assert.match(flat, /gitignored/i);
  assert.match(flat, /never under `docs\/`/i);
  assert.match(flat, /cannot earn (a row|one)/i);
  // One directory plus a licence to dispatch in parallel is a collision the doc grants, so the
  // doc makes it safe: a scoped path per agent, or one handoff silently overwrites another.
  assert.match(flat, /a scoped file of its own/i);
  // The form, not just an instance: an example alone leaves which segment is the agent unsaid, and
  // two agents on one unit collide again.
  assert.match(flat, /progress-<unit>-<agent>\.md/);
  assert.match(flat, /\bnever a shared path\b/i);
  // The checker's path reached it from the config rather than being hardcoded.
  assert.ok(t.includes("scripts/check_docs.py"), "the checker path did not substitute");
  assert.ok(!/\{\{[\w.]+\}\}/.test(t), "an unrendered placeholder is left in the doc");
  rm(dir);
});

test("the interview has a question proposing context.md, and § Defaults records it as proposed", () => {
  assertProposed(interviewTables(), "context.md");
});

// The class behind the two tests above. A layer-2 template the wizard has but no question
// proposes is a template nothing ever writes, which is how `routing.md` shipped. The set is the
// templates, never the questions: a loop over the questions passes vacuously for the template
// nobody wrote one for, which is the only case this test exists to catch.
test("every named layer-2 template is proposed by a question, and § Defaults records it", () => {
  const src = readFileSync(join(REPO, "bin/seam-init.mjs"), "utf8");
  const dir = "skills/seam-docs/templates/current";

  // The map is parsed out of the wizard's source, because that is the one place a template
  // becomes selectable. The parse is pinned to `const named = {`, so a renamed map fails here
  // rather than returning nothing — an empty set would pass every assertion below at once.
  const map = src.match(/\bconst named = \{\n([\s\S]*?)\n\s*\};/);
  assert.ok(map, "bin/seam-init.mjs has no `const named = {` map — this test's parse is stale");
  const named = [...map[1].matchAll(/^\s*"([^"]+\.md)":\s*"(current\/[^"]+\.md)",?$/gm)]
    .map(([, base, rel]) => ({ base, rel }));

  // The generic template is selected by nothing being named, so it is in neither the map nor the
  // set. Pinning both halves keeps a map entry for it from shrinking the set without saying so.
  const onDisk = readdirSync(join(REPO, dir)).filter((f) => f.endsWith(".md")).sort();
  assert.ok(onDisk.includes("doc.md"), `${dir}/doc.md is gone, and it is the generic fallback`);
  assert.ok(!named.some((n) => n.base === "doc.md"),
    "the named map names doc.md, which is the fallback and not a named template");

  // The two sets name the same templates, asserted before the count so that a map this regex
  // cannot read fails as the mismatch it is rather than as a missing interview question.
  assert.deepEqual(named.map((n) => n.base).sort(), onDisk.filter((f) => f !== "doc.md"),
    `the map and ${dir} name different templates; one nothing names is never written`);
  // The count is the tripwire: it makes a sixth template touch this test, where the message says
  // what the template still owes. The deepEqual above is what catches a set that emptied.
  assert.equal(named.length, 5, "expected 5 named layer-2 templates — a new one needs its own "
    + "interview question, its § Defaults row, and this count raised");
  for (const { base, rel } of named)
    assert.ok(existsSync(join(REPO, "skills/seam-docs/templates", rel)),
      `the map sends ${base} to ${rel}, which is not there — writeDoc falls back to doc.md`);

  const tables = interviewTables();
  for (const { base } of named) assertProposed(tables, base);
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

test("A15's default_branch must be a branch name", () => {
  const { dir, r } = init(answers({
    assertions: { A15: { enabled: true, default_branch: 5, impl_globs: ["src/**"], test_globs: ["tests/**"] } },
  }));
  assert.equal(r.status, 2, r.stdout);
  assert.match(r.stderr, /assertions\.A15\.default_branch/);
  assert.ok(!has(dir, ".seam/config.json"), "a rejected run still wrote a config");
  rm(dir);
});

// ── milestones[].active ───────────────────────────────────────────────────────
//
// The follow-up qualifier's third clause is "it blocks the active milestone". It is answerable
// only if exactly one milestone is active, so the answers file is refused when that does not hold
// — a quietly wrong config would leave the clause pointing at nothing, or at two things.

const TWO_MILESTONES = (a0, a1) => [
  { n: 2, title: "Queenless list", green: "the list renders", active: a0 },
  { n: 3, title: "Inspection plan", green: "a week of inspections renders", active: a1 },
];

test("exactly one milestone may be active", () => {
  const { dir, r } = init(answers({ milestones: TWO_MILESTONES(true, true) }));
  assert.equal(r.status, 2, r.stdout);
  // It names the second one, which is the one that makes it two, and the one it collides with.
  assert.match(r.stderr, /milestones\[1\]\.active/, r.stderr);
  assert.match(r.stderr, /milestones\[0\]/, r.stderr);
  assert.ok(!has(dir, ".seam/config.json"), "a rejected run still wrote a config");
  rm(dir);
});

test("milestones with none active are rejected", () => {
  // Explicit `false` on every row, so this is the none-active rule and not the boolean rule.
  const { dir, r } = init(answers({ milestones: TWO_MILESTONES(false, false) }));
  assert.equal(r.status, 2, r.stdout);
  assert.match(r.stderr, /milestones\[\]\.active/, r.stderr);
  assert.match(r.stderr, /none/i, r.stderr);
  assert.ok(!has(dir, ".seam/config.json"), "a rejected run still wrote a config");
  rm(dir);
});

test("every milestone says whether it is active, as a boolean", () => {
  // A string "true" is truthy and a missing key is falsy; both would pass a loose check and give
  // a config whose `active` means different things on different rows.
  for (const [ms, at] of [
    [[{ n: 2, title: "A", active: true }, { n: 3, title: "B" }], 1],
    [[{ n: 2, title: "A", active: "true" }, { n: 3, title: "B", active: false }], 0],
  ]) {
    const { dir, r } = init(answers({ milestones: ms }));
    assert.equal(r.status, 2, `${JSON.stringify(ms)}: ${r.stdout}`);
    assert.match(r.stderr, new RegExp(`milestones\\[${at}\\]\\.active`), r.stderr);
    // The missing-key message is the one an adopter with a pre-`active` answers file hits first,
    // so it says what to write, as the none-active message does.
    assert.match(r.stderr, /"active": true.*"active": false/, r.stderr);
    assert.ok(!has(dir, ".seam/config.json"), "a rejected run still wrote a config");
    rm(dir);
  }
});

/** The cells of every row in a taxonomy doc's Milestones table, header and separator included. */
function milestoneRows(taxonomy) {
  const section = taxonomy.split(/^## Milestones$/m)[1].split(/^## /m)[0];
  return section.split("\n").filter((l) => l.startsWith("|"))
    .map((l) => l.split("|").slice(1, -1).map((c) => c.trim()));
}

const TAXONOMY_ROW = {
  path: "docs/taxonomy.md",
  layer: 2,
  owns: "The domain labels, the three priorities, and the milestones",
  enforces: "",
  create: true,
};

test("the active milestone reaches the taxonomy doc", () => {
  // The active one is the second row, so a table that marked the first would not pass.
  const ans = answers({ milestones: TWO_MILESTONES(false, true) });
  ans.docs.push(TAXONOMY_ROW);
  const { dir, r } = init(ans);
  assert.equal(r.status, 0, r.stderr);
  // Row 1 is the method's own — the field determination the template ships, which is never the
  // active one — so the repo's own rows are the ones after it.
  const [header, , field, ...rows] = milestoneRows(read(dir, "docs/taxonomy.md"));
  assert.equal(header.at(-1), "Active", `the table has no Active column: ${header}`);
  assert.deepEqual([field[0], field.at(-1)], ["1", "no"],
    `row 1 is not the field determination, inactive: ${field}`);
  assert.deepEqual(
    Object.fromEntries(rows.map((c) => [c[1], c.at(-1)])),
    { "Queenless list": "no", "Inspection plan": "yes" },
  );
  // And the config the checker and the skills read says the same thing.
  assert.deepEqual(
    JSON.parse(read(dir, ".seam/config.json")).milestones.map((m) => m.active),
    [false, true],
  );
  rm(dir);
});

test("no milestones is still valid, and the taxonomy table stays rectangular", () => {
  const ans = answers({ milestones: [] });
  ans.docs.push(TAXONOMY_ROW);
  const { dir, r } = init(ans);
  assert.equal(r.status, 0, r.stderr);
  const rows = milestoneRows(read(dir, "docs/taxonomy.md"));
  assert.ok(rows.length >= 3, "the empty-state row is missing");
  for (const cells of rows) assert.equal(cells.length, rows[0].length, `ragged row: ${cells}`);
  // The paragraph under the table points at the `yes` row, and in this state there is none, so
  // what it says has to be conditional on there being milestones.
  assert.ok(!rows.some((cells) => cells.at(-1) === "yes"), "the empty state has a yes row");
  assert.match(read(dir, "docs/taxonomy.md"), /once\s+there\s+are\s+milestones/i,
    "the paragraph points at a `yes` row the empty table does not have");
  rm(dir);
});

test("the interview says what to record when the user never names the active milestone", () => {
  // Found by its **answers-key cell**, not by its number: the question order is a live thing —
  // the field determination went in front of all of it — and a row number pinned here fails as a
  // missing question rather than as the renumbering it is.
  const { questions } = interviewTables();
  const n = questionKeyCells(questions).find((c) => /`milestones\[\]`/.test(c.key))?.n;
  assert.ok(n, "no question row's answers-key cell is `milestones[]`");
  const row = questions.split("\n").find((l) => new RegExp(`^\\|\\s*${n}\\s*\\|`).test(l));
  assert.ok(row, `the question table has no row ${n}`);
  // The wizard refuses an active-less list, so "listed but unanswered" has one consistent
  // outcome, and it is the same one the discipline section gives every undetermined fact.
  assert.match(row, /milestones: \[\]/, `row ${n} does not say to record an empty list`);
  assert.match(row, /open question/i, `row ${n} does not say to record an open question`);
});

test("the clean fixture's milestones are ones the wizard could have produced", () => {
  // It is the canonical post-wizard config, and every checker mutation starts from it. One whose
  // milestones break the invariant is a config no wizard run can write, and a test reading
  // `milestones[].active` from it would get `undefined` — falsy, so a negative test would pass
  // for the wrong reason.
  const cfg = JSON.parse(readFileSync(join(REPO, "tests/fixtures/clean/.seam/config.json"), "utf8"));
  assert.ok(cfg.milestones.length > 0, "the fixture no longer has a milestone to check");
  assert.ok(cfg.milestones.every((m) => typeof m.active === "boolean"), "a milestone has no boolean active");
  assert.equal(cfg.milestones.filter((m) => m.active).length, 1, "exactly one milestone is active");
});

// ── The field determination: milestone 1, for every repo ──────────────────────
//
// Ruling 123, an owner decision: milestone 1, for any repo adopting seam, is establishing whether
// it is **green or brown field**. It is the first step to get things straight, and it is true
// mechanically as well — the proposal, the baseline, the never-rewrite rule and which assertions
// can run at all branch on it. So the interview asks it first, the taxonomy template ships the row
// for every repo, and the determination carries the reason it was made.
//
// The gate is documentary and not a refusal: the owner was offered a wizard that refuses to
// propose anything until the field is recorded, and chose the method-rule form. What IS mechanical
// is the answers key, because a key that reaches a template and is validated by nothing ships
// `{{field}}` into an adopting repo with a zero exit — Ruling 111's class, measured once already.

test("the field determination is required, and only the two values are permitted", () => {
  const missing = answers();
  delete missing.field;
  const a = init(missing);
  assert.equal(a.r.status, 2, a.r.stdout);
  assert.match(a.r.stderr, /^seam-init: field:/, a.r.stderr);
  assert.ok(!has(a.dir, ".seam/config.json"), "a rejected run still wrote a config");
  rm(a.dir);

  for (const bad of ["brown", "green-field", "", "GREENFIELD", true, null]) {
    const { dir, r } = init(answers({ field: bad }));
    assert.equal(r.status, 2, `${JSON.stringify(bad)} was accepted as a field: ${r.stdout}`);
    // Anchored on the key the message names, not on the word anywhere in it: a rejection fired by
    // some other key whose message happens to say "field" would otherwise pass this.
    assert.match(r.stderr, /^seam-init: field:/, r.stderr);
    assert.ok(!has(dir, ".seam/config.json"), "a rejected run still wrote a config");
    rm(dir);
  }

  // And it reaches the config at the same key path: one namespace, no translation step.
  for (const good of ["greenfield", "brownfield"]) {
    const { dir, r } = init(answers({ field: good }));
    assert.equal(r.status, 0, r.stderr);
    assert.equal(JSON.parse(read(dir, ".seam/config.json")).field, good);
    rm(dir);
  }
});

test("the field's reason is required, and it is prose — it never reaches the config", () => {
  // Required rather than fallback-able, which `domains[].covers` and `milestones[].green` are:
  // the determination is a judgement about the tree **as it stands** and not about its history,
  // so without the reason beside it "brownfield" reads as an error to the next reader.
  for (const bad of [undefined, "", "   ", 7]) {
    const ans = answers();
    if (bad === undefined) delete ans.field_reason;
    else ans.field_reason = bad;
    const { dir, r } = init(ans);
    assert.equal(r.status, 2, `${JSON.stringify(bad)} was accepted as a reason: ${r.stdout}`);
    assert.match(r.stderr, /^seam-init: field_reason:/, r.stderr);
    assert.ok(!has(dir, ".seam/config.json"), "a rejected run still wrote a config");
    rm(dir);
  }
  const { dir, r } = init(answers());
  assert.equal(r.status, 0, r.stderr);
  const cfg = JSON.parse(read(dir, ".seam/config.json"));
  assert.ok(!("field_reason" in cfg), "field_reason is prose and must not reach the config");
  assert.equal(cfg.field, answers().field);
  rm(dir);
});

test("milestone 1 is the field determination, from the template, for every repo", () => {
  // Both shapes, because `milestones[]` is a live empty list and a live one: the row comes from
  // the TEMPLATE and not from `milestones[]`, so it is there either way — which is also what
  // keeps the one-active rule reading the repo's own build order and nothing else.
  for (const milestones of [[], TWO_MILESTONES(false, true)]) {
    const ans = answers({
      milestones,
      field: "brownfield",
      field_reason: "every doc here was written by this method, but as a tree it already has docs",
    });
    ans.docs.push(TAXONOMY_ROW);
    const { dir, r } = init(ans);
    assert.equal(r.status, 0, r.stderr);
    const doc = read(dir, "docs/taxonomy.md");
    const rows = milestoneRows(doc);
    const [header, , first] = rows;
    const where = `milestones=${JSON.stringify(milestones.length)}`;
    assert.equal(header.at(-1), "Active", `${where}: no Active column: ${header}`);
    assert.equal(first[0], "1", `${where}: the field determination is not row 1: ${first}`);
    assert.match(first[1], /brownfield/, `${where}: row 1 does not name the determination: ${first}`);
    // Green on arrival — the wizard cannot write this file without the answer — so marking it
    // active would park the priority rule on a milestone nobody can work on, and the repo's own
    // first milestone would be waiting behind it forever.
    assert.equal(first.at(-1), "no", `${where}: milestone 1 is marked active: ${first}`);
    for (const cells of rows) assert.equal(cells.length, rows[0].length, `ragged row: ${cells}`);
    // **No two rendered rows share a number.** "The repo's own build order is numbered from 2" is
    // a method rule, and the only thing that can hold a worked example to it is this assertion:
    // a repo whose own first milestone is `n: 1` renders a table with two rows numbered 1, which
    // is what every fixture in this tree did on the day the rule shipped. Checking row 1 alone
    // and matching the rest by title is how that went green.
    const numbers = rows.slice(2).map((cells) => cells[0]);
    assert.deepEqual([...new Set(numbers)], numbers,
      `${where}: two milestone rows share a number (${numbers.join(", ")}) — milestone 1 is the`
      + ` field determination, so the repo's own build order starts at 2`);
    assert.match(doc, /every doc here was written by this method/,
      `${where}: the reason the determination was made is not written beside it`);
    assert.equal(doc.indexOf("{{"), -1, `${where}: the rendered taxonomy carries a placeholder`);
    // The config's milestones are the repo's own, unchanged: the template's row is not one.
    assert.deepEqual(JSON.parse(read(dir, ".seam/config.json")).milestones,
      milestones.map(({ green, ...m }) => m));
    rm(dir);
  }
});

test("the interview asks the field first, and proposes every doc before asking what it owns", () => {
  const { questions, schema, defaults } = interviewTables();
  const cells = questionKeyCells(questions);
  assert.ok(cells.length >= 20, `parsed ${cells.length} question rows — the parse broke, and`
    + ` every assertion below would pass on an empty set`);
  assert.deepEqual(cells.map((c) => c.n), cells.map((_, i) => i + 1),
    "the question numbers are not 1..N in order — a reorder duplicated or skipped one");
  const at = (rx) => cells.find((c) => rx.test(c.key))?.n;
  assert.equal(at(/`field`/), 1, "the field determination is not the interview's first question");

  // The order defect this task owns: question 6 asked what each proposed doc owns, ten rows
  // before any row proposed one. Asserted as the class — every proposal, against the one row
  // that asks the per-doc question — rather than against the numbers it had on the day.
  const owns = at(/`docs\[\]\.owns`/);
  assert.ok(owns, "no question row's answers-key cell asks for `docs[].owns`");
  const proposals = cells.filter((c) => /layer-2 row/.test(c.key));
  assert.ok(proposals.length >= 5,
    `found ${proposals.length} doc-proposal rows, expected at least five`);
  for (const p of proposals)
    assert.ok(p.n < owns, `question ${p.n} proposes a doc AFTER question ${owns} asks what each`
      + ` proposed doc owns — so that question is asked before anything has been proposed`);

  assert.match(schema, /"field"\s*:/, "§ Schema carries no `field` key");
  assert.match(schema, /"field_reason"\s*:/, "§ Schema carries no `field_reason` key");
  assert.match(defaults, /^\|\s*`field`\s*\|/m, "§ Defaults has no row for `field`");

  const md = readFileSync(join(REPO, "skills/seam-docs/references/interview.md"), "utf8");
  const rej = md.slice(md.indexOf("### Rejections"));
  assert.match(rej, /`field`/, "§ Rejections does not say an unanswered field is refused");
  assert.match(rej, /`field_reason`/, "§ Rejections does not say a reasonless field is refused");
  const prose = md.slice(md.indexOf("**Prose keys**"));
  assert.match(prose.slice(0, prose.indexOf("\n\n")), /`field_reason`/,
    "the prose-key list does not carry `field_reason`, which never reaches the config");
});

test("the wizard's skill states the field determination comes first", () => {
  const md = readFileSync(join(REPO, "skills/seam-docs/SKILL.md"), "utf8");
  const i = md.search(/green or brown/i);
  assert.ok(i !== -1, "seam-docs/SKILL.md never names the green-or-brown-field determination");
  const paths = md.indexOf("## The two paths");
  assert.ok(paths !== -1 && i < paths,
    "the field determination is stated after the two paths it is what chooses between");
  const sec = md.slice(i, paths);
  assert.match(sec, /milestone 1/i, "the skill does not say the determination is milestone 1");
  // Documentary, not a refusal: the owner was offered a wizard that refuses to propose anything
  // until the field is recorded, and chose the method-rule form instead.
  assert.ok(!/\brefus/i.test(sec),
    "the skill turns the field determination into a refusal, which Ruling 123 did not choose");
});

// ── teardown_command ──────────────────────────────────────────────────────────
//
// `seam-github` § Teardown runs the repo's own teardown command as the last step of a merge, and
// a skill clause that reads a key no question fills is a clause nothing can satisfy — the defect
// this branch repaired one layer up, where a template shipped that no question proposed. The key
// is optional by construction: absent and `""` both mean the branch delete is the whole teardown,
// which is the common case.

test("teardown_command is optional, and absent means deleting the branch is all of it", () => {
  const bare = answers();
  delete bare.teardown_command;
  const a = init(bare);
  assert.equal(a.r.status, 0, a.r.stderr);
  assert.equal(JSON.parse(read(a.dir, ".seam/config.json")).teardown_command, "");
  rm(a.dir);

  // And a repo that has one gets it at the same key path — one namespace, no translation step.
  const b = init(answers({ teardown_command: "scripts/rm-worktree.sh <n>" }));
  assert.equal(b.r.status, 0, b.r.stderr);
  assert.equal(JSON.parse(read(b.dir, ".seam/config.json")).teardown_command,
    "scripts/rm-worktree.sh <n>");
  rm(b.dir);

  // And an explicit "" is a complete answer, not a rejected one — the interview says an empty
  // answer is complete, so the program has to accept the empty string the wizard would record.
  const c = init(answers({ teardown_command: "" }));
  assert.equal(c.r.status, 0, c.r.stderr);
  assert.equal(JSON.parse(read(c.dir, ".seam/config.json")).teardown_command, "");
  rm(c.dir);
});

test("a teardown_command that is not one command string is rejected", () => {
  // A list would have to be sequenced by whoever ran it, and the skill runs what the key names as
  // written. Absent and `""` are the two ways to say there is nothing to run.
  // The newline case is the one the name claimed and the program did not hold: a two-line value
  // is two commands, and whoever ran them would be guessing the order.
  for (const value of [["scripts/rm-worktree.sh <n>"], 5, "git worktree remove wt\ngit branch -D f"]) {
    const { dir, r } = init(answers({ teardown_command: value }));
    assert.equal(r.status, 2, r.stdout);
    assert.match(r.stderr, /teardown_command/, r.stderr);
    assert.ok(!has(dir, ".seam/config.json"), "a rejected run still wrote a config");
    rm(dir);
  }
});

test("the interview asks for teardown_command, and § Defaults records what empty means", () => {
  const tables = interviewTables();
  // By the row's **key cell**, not by the section: a Notes cell mentioning the key would have
  // satisfied this, which is N4's defect in the test written one round earlier.
  const n = questionKeyCells(tables.questions).find((c) => /`teardown_command`/.test(c.key))?.n;
  assert.ok(n, "no question row's answers-key cell is teardown_command");
  const row = tables.questions.split("\n").find((l) => new RegExp(`^\\|\\s*${n}\\s*\\|`).test(l));
  assert.ok(row, "the question table has no row naming teardown_command");
  // Optional by construction, so the row says so and says what an empty answer is. A question
  // that reads as a requirement gets an invented answer, which is what the discipline forbids.
  assert.match(row, /optional/i, "the teardown row does not say the key is optional");
  assert.match(row, /empty answer is complete/i,
    "the teardown row does not say an empty answer is a complete one");
  assert.match(tables.defaults, /^\|\s*`teardown_command`\s*\|\s*`""`\s*\|/m,
    "§ Defaults has no row giving teardown_command's default");
  // The answers file is the source and § Teardown is this fact's consumer, so the two cannot
  // disagree about where the command runs: a command written for a worktree root resolves its
  // relative paths somewhere else when the skill runs it from the main checkout.
  assert.match(row, /main checkout/,
    "the teardown row does not say where the command runs, or no longer says the main checkout");
  assert.ok(!/run from the repo root/.test(row),
    "the teardown row still says 'the repo root', which § Teardown says is the wrong directory");
});

test("every key path seam-github reads resolves, and the asked ones carry a question row", () => {
  // The scan is blind twice over: it reads every file the skill ships, and it matches a key name
  // **anywhere** — prose, a JSON fence, a bash pipeline — because the previous detector was the
  // backtick convention wearing the name "reads a key", and `jq -r .prd.dir` read green.
  const { dir, r } = init(answers());
  assert.equal(r.status, 0, r.stderr);
  const cfg = JSON.parse(read(dir, ".seam/config.json"));
  rm(dir);
  const sdir = join(REPO, "skills/seam-github");
  const skill = readdirSync(sdir, { recursive: true })
    .map(String).filter((f) => f.endsWith(".md"))
    .map((f) => readFileSync(join(sdir, f), "utf8")).join("\n");
  // Candidates are dotted paths **rooted in a real top-level key**, so the whole path is the unit
  // rather than its first segment: `repo.trunk_branch` is a key this repo does not have, and a
  // comparison on top-level keys alone called it accepted because `repo` is.
  const tops = Object.keys(cfg);
  const rx = new RegExp(`\\b(${tops.join("|")})((?:\\[\\])?(?:\\.[A-Za-z_]\\w*)*)(?!\\w)`, "g");
  const paths = [...new Set([...skill.matchAll(rx)].map((m) => m[1] + m[2]))].sort();
  const named = [...new Set(paths.map((k) => k.split(/[.[]/)[0]))].sort();
  // Pinned, so a new key reaches this test rather than arriving quietly. Four entries are prose
  // collisions rather than clauses — `docs` from the commit-type list, `checker` from "the drift
  // checker", `domains` from "owns the domains", `table` from "an empty table" — and the blind
  // match is kept anyway: a detector that demanded a marker is how a bash fence, a YAML fence and
  // an unquoted dotted path all read green, and every one of these resolves and is harmless.
  // `field` is the fifth prose collision — "reads a field", "which is the field" — and it arrived
  // the day green-or-brown-field became a config key, which is the cost of naming a key after an
  // ordinary English word.
  assert.deepEqual(named,
    ["assertions", "checker", "docs", "domains", "field", "load_bearing", "milestones", "repo",
      "table", "teardown_command"],
    "seam-github names a config key this test does not know about, or stopped naming one");
  // **The subject is the answers file**, walked path by path, with the config beside it for the
  // keys the program fills rather than the interview. The projection alone is the wrong subject:
  // `docs[].owns`, `milestones[].green`, `domains[].covers` and `agents[].covers` are real
  // answers keys it **deliberately strips** (PROSE_SUBKEYS), so a clause citing one red with a
  // message telling a maintainer to project a prose key — the one change this project is built on
  // not making. A path in neither is a key nothing fills, which is what a typo is.
  const ans = answers();
  for (const k of paths)
    assert.ok(resolveKeyPath(ans, k) !== undefined || resolveKeyPath(cfg, k) !== undefined,
      `seam-github reads ${k}, which is neither a path an answers file carries nor one the program`
      + ` fills — the key is misspelled, or the interview does not collect it`);
  const { questions, schema } = interviewTables();
  // § Schema is the documented half of the same claim: the key a clause reads is in the answers
  // schema a reader of the interview sees, not only in whatever the program happens to emit.
  const cells = questionKeyCells(questions);
  for (const k of named)
    assert.match(schema, new RegExp(`"${k}"\\s*:`),
      `seam-github reads ${k} and § Schema has no such key — add it to the answers schema, or stop`
      + ` reading it in the skill`);
  // Then the stricter test, for the keys the interview must **ask**: a row whose **answers-key
  // cell** is that key. Scoped to the cell because a key named in another row's Notes let the
  // interview lose question 5 (`load_bearing`) or question 8 (`milestones[].active`) green.
  // Per top-level key by design — which subkey a row asks for is the resolution check's business.
  const askedFor = (k) => cells.some((c) => new RegExp("`" + k + "(`|\\[|\\.)").test(c.key));
  assert.deepEqual(named.filter(askedFor),
    ["assertions", "checker", "docs", "domains", "field", "load_bearing", "milestones",
      "teardown_command"],
    "a key seam-github reads lost the question row that fills it, or gained one unexpectedly");
  // The teardown clause is a real conditional, and the else-branch is stated: a key most repos
  // leave empty needs one, or "if the config names one" is a requirement in conditional clothing.
  const flat = skill.replace(/\s+/g, " ");
  assert.match(flat, /if `\.seam\/config\.json` names one/);
  assert.ok(flat.includes("Where that key is empty or absent, the steps after it are the whole"
    + " teardown"), "the teardown clause states no else-branch for a config that names no command");
});

test("§ Teardown is a five-step list, and its prose names the flag and the refusal", () => {
  // **The order is not asserted here any more.** `tests/teardown.test.mjs` performs the steps
  // against five real repositories, so the order has an executable owner, and a label match here
  // would be a second copy of its claim — the restatement rule, applied to our own tests. It
  // would also red on every legitimate reorder in two places, one of which proves nothing: when
  // the command-first order was planted as a RED proof, these label matches went red beside the
  // fixture and said only that the labels had moved.
  //
  // What is left is what the fixture cannot reach: the **shape** the parse over there depends on
  // (five numbered steps), and the three prose facts that are advice rather than commands.
  const md = readFileSync(join(REPO, "skills/seam-github/SKILL.md"), "utf8");
  const from = md.indexOf("### Teardown,");
  const to = md.indexOf("## Status reporting");
  assert.ok(from !== -1 && to > from, "§ Teardown's heading moved, or § Status reporting did");
  const sec = md.slice(from, to);
  const steps = [...sec.matchAll(/^(\d+)\. \*\*(.+?)\*\*/gm)].map((m) => [Number(m[1]), m[2]]);
  assert.deepEqual(steps.map(([n]) => n), [1, 2, 3, 4, 5],
    `§ Teardown is not a five-step numbered list: ${JSON.stringify(steps.map(([n]) => n))}`);
  assert.match(sec, /expect `-D` rather than `-d`/,
    "§ Teardown does not say which flag a squashed branch needs, so -d's merged check reads as a"
    + " verification it is not");
  // Measured: `git worktree remove` refuses on an untracked or modified file (gitignored contents
  // do not count), and `--force` then deletes work that exists nowhere else. That is a human's
  // call, so the step says to look rather than to force.
  assert.match(sec, /do not force past it unasked/,
    "§ Teardown does not say what a refused removal is, so --force reads as the way past it");
  // And the diagnostic names both causes of the delete's error, not only the one this round added
  // a step for: step 4 skipped, or step 4 taken and refused.
  assert.match(sec, /step 4 not taken, or step 4 taken and \*\*refused\*\*/,
    "the diagnostic attributes `cannot delete branch … used by worktree` to one cause");
});

test("no command seam-github ships reads a path by splitting on whitespace", () => {
  // Measured in a repo under `My Project`: `git worktree list | head -1 | awk '{print $1}'`
  // returns `…/My`, the `cd` fails, and the session is still in the worktree — so the next line
  // runs there and deletes its own directory. A silent wrong directory, not a stop, and the
  // shipped example is the thing a model copies. `--porcelain` plus `cut -d' ' -f2-` is the idiom
  // that survives it; this asserts the class, so the same read cannot arrive in another command.
  const sdir = join(REPO, "skills/seam-github");
  const files = readdirSync(sdir, { recursive: true }).map(String).filter((f) => f.endsWith(".md"));
  // What the scan actually read, because this test's subject is a pattern it hopes never to find:
  // with nothing matched it passes, and its pass would mean "no fenced block ships a bad read"
  // when it meant "no fenced block was found at all". That is what the **indented** fence — a
  // block inside a numbered list item, which is where § Teardown's commands live — did to the
  // first version of this regex: it anchored on column zero, so every one of those blocks was
  // outside the scan while the test stayed green.
  let read = 0;
  let worktreeReads = 0;
  for (const f of files) {
    const text = readFileSync(join(sdir, f), "utf8");
    // Fenced blocks only: prose may well quote the broken idiom to say not to use it, as the
    // bullet under this example does. Indentation is allowed on both markers.
    const fenced = [...text.matchAll(/^[ \t]*```[a-z]*\n([\s\S]*?)^[ \t]*```[ \t]*$/gm)]
      .map((m) => m[1]).join("\n");
    for (const line of fenced.split("\n")) {
      if (line.trim()) read += 1;
      if (/git worktree list/.test(line)) worktreeReads += 1;
      assert.ok(!/awk\s+'\{\s*print\s+\$\d/.test(line),
        `${f} ships a command that splits a path on whitespace, which truncates at the first`
        + ` space and leaves the session where it was: ${line.trim()}`);
      if (/git worktree list/.test(line) && /\|/.test(line))
        assert.match(line, /--porcelain/,
          `${f} pipes \`git worktree list\` without --porcelain, so the path is read out of a`
          + ` column rather than after \`worktree \`: ${line.trim()}`);
    }
  }
  // The floor is a fraction of the measurement, not a guess: 121 non-blank command lines across
  // the skill's two files and 4 reads of `git worktree list`, counted when this was written. A
  // floor at the measurement would red on any edit; these red when the scan breaks.
  assert.ok(read >= 20, `the fence scan read ${read} command lines across`
    + ` ${files.length} files, which is too few to be the skill — the regex stopped matching and`
    + ` every assertion above passed on an empty subject`);
  assert.ok(worktreeReads >= 2, `the fence scan found ${worktreeReads} lines reading`
    + ` \`git worktree list\`, and § Teardown ships at least two — the one read this test exists`
    + ` to police is outside its own scan`);
});

test("the clean fixture carries every top-level key the wizard projects", () => {
  // Nothing tied the fixture to project(), so a key added to the projection left it a config no
  // wizard run could write. A16 — the config is the projection of the answers file — is built on
  // this fixture, so the gap would surface inside that work as A16 being broken.
  //
  // Top-level by design, and the name says so: the fixture is a different repo's answers, so its
  // nested values differ legitimately. The shape of the projection is the claim here.
  const { dir, r } = init(answers());
  assert.equal(r.status, 0, r.stderr);
  const projected = Object.keys(JSON.parse(read(dir, ".seam/config.json")));
  rm(dir);
  const fixture = JSON.parse(
    readFileSync(join(REPO, "tests/fixtures/clean/.seam/config.json"), "utf8"));
  for (const k of projected)
    assert.ok(k in fixture, `tests/fixtures/clean/.seam/config.json has no ${k} — the wizard`
      + ` projects it, so the fixture is a config no run could write`);
});

test("the size vocabulary is the same set in the template and in seam-github", () => {
  // The size slot in seam-github's PR skeleton names its three members, so a required slot does
  // not wait on an optional read of docs/building.md. That is A5's shape — members in both
  // places, definitions in one — and A5 itself cannot hold it: the repo's own assertions.A5 is
  // off with an empty `vocabularies`, and its implementation resolves only `sql` and `ts` artifact
  // parsers, so it could not read a markdown table even switched on. Nothing else compared the two
  // copies, so a fourth size added to either side drifted in silence.
  const tmpl = readFileSync(
    join(REPO, "skills/seam-docs/templates/current/building.md"), "utf8");
  const skill = readFileSync(join(REPO, "skills/seam-github/SKILL.md"), "utf8");

  // Template side: the first column of § Ceremony scales with blast radius' table.
  const table = tmpl.split(/^## /m).find((s) => /^Ceremony scales/.test(s));
  assert.ok(table, "the template has no § Ceremony scales with blast radius to read sizes from");
  const defined = new Set();
  for (const line of table.split("\n")) {
    const m = /^\|\s*([^|]+?)\s*\|/.exec(line);
    if (!m) continue;
    const cell = m[1];
    if (cell === "Size" || /^-+$/.test(cell)) continue;   // header and separator
    defined.add(cell);
  }

  // Skill side: the backticked capitalised members in the paragraph that names the slot's
  // vocabulary. Scoped to that paragraph so `one-liner` (a route marker, not a size) and
  // `docs/building.md` (a path) are not mistaken for members.
  const para = skill.split(/\n\n/).find((p) => /^\*\*The size slot is a vocabulary/.test(p));
  assert.ok(para, "seam-github names no size vocabulary — the slot is free prose again");
  const named = new Set(
    [...para.matchAll(/`([A-Z][a-z]+)`/g)].map((m) => m[1]));

  // Both parses have to have found something, or set equality passes on two empty sets — the
  // check that passes without making its comparison.
  assert.ok(defined.size >= 3,
    `parsed ${defined.size} sizes from the template's table, expected at least three`);
  assert.ok(named.size >= 3,
    `parsed ${named.size} members from seam-github's paragraph, expected at least three`);

  assert.deepEqual([...named].sort(), [...defined].sort(),
    `the size vocabulary has drifted. docs/building.md defines [${[...defined].sort()}] and`
    + ` skills/seam-github/SKILL.md names [${[...named].sort()}]. The template defines them and`
    + ` the skill names the members; a size added to one side belongs on both.`);
});

// ── Unresolved template output (Ruling 111) ───────────────────────────────────
//
// `render()` returns an unresolved `{{key}}` as itself, and a table builder renders a missing row
// key as the literal `undefined`. Both are this program — the one its own header calls "a program
// with no judgment in it" — writing a broken artifact into an adopting repo and exiting 0. The
// measured instance was `model: {{agent.model}}` in a `.claude/agents/*.md` frontmatter, which is
// worse than a bogus value: `{{` opens a YAML flow mapping, so PyYAML refuses the whole block
// (`found unhashable key`) and the agent does not load at all.
//
// The tests below are of the CLASS — every template, every key — because the sixteenth template
// is the one nobody will remember to check.

const TEMPLATES = join(REPO, "skills", "seam-docs", "templates");

/** Every template, with its `{{keys}}` and one line unique to it that carries no placeholder. */
function templateSet() {
  const out = [];
  for (const dir of readdirSync(TEMPLATES).sort()) {
    for (const f of readdirSync(join(TEMPLATES, dir)).sort()) {
      if (!f.endsWith(".md")) continue;
      const rel = `${dir}/${f}`;
      const body = readFileSync(join(TEMPLATES, rel), "utf8");
      const keys = [...new Set([...body.matchAll(/\{\{([\w.]+)\}\}/g)].map((m) => m[1]))].sort();
      const print = body.split("\n").find((l) =>
        l.length >= 30 && !l.includes("{{") && !l.trimStart().startsWith("|"));
      assert.ok(print, `${rel} has no placeholder-free line long enough to recognise it by`);
      out.push({ rel, keys, print });
    }
  }
  assert.ok(out.length >= 16, `found ${out.length} templates, expected at least 16 — the walk`
    + ` broke, and every assertion below would pass on an empty set`);
  return out;
}

/** Answers that reach every template the wizard can write, in one of the two ADR formats. */
function maximal(format) {
  const named = ["taxonomy", "reviewing", "routing", "building", "context"].map((n) => ({
    path: `docs/${n}.md`,
    layer: 2,
    owns: `What is true now about ${n}`,
    enforces: "",
    create: true,
  }));
  const ans = answers({
    adr: format === "madr" ? { format: "madr", dir: "docs/adr" } : { format: "single", file: "docs/decisions.md" },
    agents: [{ name: "core", covers: "the one subsystem", model: "opus", effort: "high" }],
  });
  ans.docs = [...ans.docs, ...named];
  if (format === "single") {
    ans.docs = ans.docs.map((d) =>
      d.path === "docs/adr/*.md" ? { ...d, path: "docs/decisions.md", create: true } : d);
  }
  return ans;
}

/** Every file the wizard wrote under `dir`, as `[rel, text]`, minus the answers file itself. */
function writtenFiles(dir, sub = "", out = []) {
  for (const e of readdirSync(join(dir, sub), { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1)) {
    const rel = sub ? `${sub}/${e.name}` : e.name;
    if (e.isDirectory()) writtenFiles(dir, rel, out);
    else if (rel !== "answers.json") out.push([rel, readFileSync(join(dir, rel), "utf8")]);
  }
  return out;
}

test("nothing the wizard writes carries an unresolved placeholder, in any template", () => {
  const tmpls = templateSet();
  const written = [];
  for (const format of ["madr", "single"]) {
    const { dir, r } = init(maximal(format));
    assert.equal(r.status, 0, `${format}: ${r.stderr}`);
    written.push(...writtenFiles(dir).map(([rel, text]) => [`${format}:${rel}`, text]));
    rm(dir);
  }

  // Coverage first, or the two assertions below pass on a template nothing rendered — which is
  // this branch's recurring class, and the state `routing.md` actually shipped in.
  const all = written.map(([, t]) => t).join("\n");
  const missed = tmpls.filter((t) => !all.includes(t.print)).map((t) => t.rel);
  assert.deepEqual(missed, [], `these templates were not reached by either run, so nothing below`
    + ` measured them: ${missed.join(", ")}`);

  for (const [where, text] of written) {
    const at = text.indexOf("{{");
    assert.equal(at, -1, `${where} carries an unresolved placeholder: `
      + `${JSON.stringify(text.slice(at, at + 40))}`);
    const und = text.match(/(?<![\w`])undefined(?![\w`])/);
    assert.equal(und, null, `${where} carries a literal \`undefined\` where a value belonged`);
  }
});

test("every template key a row supplies is one validate requires", () => {
  // The instance is `agent.model`. The class is "a template key no validation requires": a
  // `{{list.key}}` whose value comes from a row the answers carry, where nothing rejects a row
  // without it. A key the program DERIVES (`doc.title`) is not one — no row supplies it — and is
  // skipped by asking the maximal answers file rather than by a hand-kept list.
  const ROW_LISTS = { agent: "agents", doc: "docs", artifact: "artifacts" };
  const base = maximal("madr");
  const pairs = new Set();
  for (const t of templateSet()) {
    for (const k of t.keys) {
      const [head, leaf] = k.split(".");
      if (leaf === undefined || !(head in ROW_LISTS)) continue;
      pairs.add(`${head}.${leaf}`);
    }
  }
  assert.ok(pairs.size >= 5, `parsed ${pairs.size} row keys from the templates, expected at`
    + ` least five — the parse found nothing and the loop below would check nothing`);

  for (const pair of [...pairs].sort()) {
    const [head, leaf] = pair.split(".");
    const list = ROW_LISTS[head];
    if (!base[list].some((row) => leaf in row)) continue;      // derived, not supplied
    const ans = JSON.parse(JSON.stringify(base));
    for (const row of ans[list]) delete row[leaf];
    const { dir, r } = init(ans);
    assert.equal(r.status, 2, `an answers file whose ${list} rows carry no \`${leaf}\` was`
      + ` accepted, and \`{{${pair}}}\` ships into the adopting repo as itself: ${r.stdout}`);
    assert.match(r.stderr, new RegExp(`${list}\\[\\d+\\]\\.${leaf}\\b`),
      `the rejection does not name ${list}[N].${leaf}: ${r.stderr}`);
    assert.ok(!has(dir, ".seam/config.json"),
      `a rejected run wrote .seam/config.json anyway, for ${pair}`);
    rm(dir);
  }
});

test("a domain or milestone row with no label is refused, not rendered as `undefined`", () => {
  // Measured, not reasoned: `domains_table` and `milestones_table` are built from the rows rather
  // than substituted per key, so they leak differently — `| \`undefined\` | no name at all |` and
  // `| undefined | undefined | … |` reached a written docs/taxonomy.md with exit 0. `covers` and
  // `green` are NOT on this list: both have an honest `_not recorded_` fallback, which is the
  // wizard saying what it was not told rather than writing a value it does not have.
  for (const [key, patch] of [
    ["domains[0].name", { domains: [{ covers: "no name at all" }] }],
    ["milestones[0].n", { milestones: [{ title: "First", green: "tests pass", active: true }] }],
    ["milestones[0].title", { milestones: [{ n: 2, green: "tests pass", active: true }] }],
  ]) {
    const { dir, r } = init(answers(patch));
    assert.equal(r.status, 2, `${key} missing was accepted: ${r.stdout}`);
    assert.match(r.stderr, new RegExp(key.replace(/[[\].]/g, "\\$&").replace("\\[0\\]", "\\[\\d+\\]")),
      `the rejection does not name ${key}: ${r.stderr}`);
    rm(dir);
  }
});

test("a layer-2 doc cites the PRD only where the repo has a layer-4 row", () => {
  // Measured on a fresh two-layer adoption while building A16's fixture: `current/doc.md` cited
  // `docs/prd/PRD-current.md` unconditionally, so the generated checker red A1 twice on a repo
  // nobody had typed a word into. Same class as the unresolved placeholder above — the wizard
  // writing a claim about the tree that is false the moment it is written.
  const ans = answers();
  ans.docs = ans.docs.filter((d) => d.layer !== 4);
  const { dir, r } = init(ans);
  assert.equal(r.status, 0, r.stderr);
  const t = read(dir, "docs/engineering.md");
  assert.ok(!t.includes("PRD-current.md"),
    "a repo with no layer-4 row still has a layer-2 doc citing a PRD file that is not there");
  assert.match(t, /layer 4, wherever this repo writes it down/);
  rm(dir);

  // And where there IS a layer-4 row the pointer is still there, or the guard removed the
  // citation rather than conditioning it.
  const { dir: withPrd, r: r2 } = init(answers());
  assert.equal(r2.status, 0, r2.stderr);
  assert.match(read(withPrd, "docs/engineering.md"), /`docs\/prd\/PRD-current\.md`/);
  rm(withPrd);
});

test("an empty milestones list and a one-row active list are both accepted", () => {
  // Both shapes are live: a repo whose first milestone is not settled yet carries `[]`, and the
  // row lands later. The row keys `n` and `title` are required (above), so the one-row case has
  // to be checked with them present rather than only in the rejection tests.
  const empty = init(answers({ milestones: [] }));
  assert.equal(empty.r.status, 0, empty.r.stderr);
  assert.deepEqual(JSON.parse(read(empty.dir, ".seam/config.json")).milestones, []);
  rm(empty.dir);

  const one = init(answers({
    milestones: [{ n: 2, title: "Green or brown field", green: "the determination is recorded", active: true }],
  }));
  assert.equal(one.r.status, 0, one.r.stderr);
  assert.deepEqual(JSON.parse(read(one.dir, ".seam/config.json")).milestones,
    [{ n: 2, title: "Green or brown field", active: true }]);
  rm(one.dir);
});

test("a layer-2 doc names every layer-5 directory, not whichever row came first", () => {
  // `plans.dir` was `dirname` of the FIRST layer-5 row, so a repo with two of them — specs and
  // plans, which is this repo's own shape — got a doc naming one directory and omitting the
  // other. A1 is blind to it: it is a directory, not a `*.md` citation. `layer5Globs` in the same
  // file already returned all of them, so the wizard held both the right idea and the wrong one.
  //
  // Two rows, in the order that reproduces it: one row passes either way.
  const ans = answers();
  ans.docs = ans.docs.filter((d) => d.layer !== 5);
  ans.docs.push(
    { path: "docs/superpowers/specs/*.md", layer: 5, owns: "Nothing — dated designs", enforces: "", create: false },
    { path: "docs/superpowers/plans/*.md", layer: 5, owns: "Nothing — implementation plans", enforces: "", create: false },
  );
  const { dir, r } = init(ans, [], (d) => {
    write(d, "docs/superpowers/specs/a-design.md", "# A design\n");
    write(d, "docs/superpowers/plans/a-plan.md", "# A plan\n");
  });
  assert.equal(r.status, 0, r.stderr);
  const t = read(dir, "docs/engineering.md");
  assert.ok(t.includes("`docs/superpowers/specs`") && t.includes("`docs/superpowers/plans`"),
    `a layer-2 doc names only some of the layer-5 directories:\n`
    + t.split("\n").filter((l) => l.includes("layer 5")).join("\n"));
  rm(dir);

  // One layer-5 row still reads as one directory, with no list punctuation.
  const { dir: one, r: r1 } = init(answers());
  assert.equal(r1.status, 0, r1.stderr);
  assert.match(read(one, "docs/engineering.md"), /layer 5, under `docs\/plans`\./);
  rm(one);
});
