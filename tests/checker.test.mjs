// bin/generate-checker.mjs and the two emitted checkers.
//
// Written before the generator. One planted drift per assertion, each on a copy of
// tests/fixtures/clean — which is a complete, green repo, so a mutation changes exactly one
// thing and a finding can only have come from that change.
//
// Both languages run on every fixture and their findings are compared, because "a repo can
// switch languages without changing what is enforced" is only true if it is checked.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, readFileSync, writeFileSync, existsSync, rmSync, chmodSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { scratch, rm, run, REPO } from "./helpers.mjs";

const CLEAN = join(REPO, "tests", "fixtures", "clean");

/** Whether this process can open the file: false is what a mode-000 file looks like to a user. */
function canRead(p) {
  try { readFileSync(p); return true; } catch { return false; }
}

/** A copy of the clean fixture as a git repo with one commit, plus both checkers generated. */
function fixture({ mutate = null, commitAfter = false } = {}) {
  const dir = scratch("seam-checker-");
  cpSync(CLEAN, dir, { recursive: true });
  const git = (...args) => execFileSync("git", args, { cwd: dir, stdio: "pipe" });
  git("init", "-b", "main");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test");
  git("add", "-A");
  git("commit", "-m", "clean");

  if (mutate) {
    mutate({
      dir,
      edit(rel, from, to) {
        const p = join(dir, rel);
        const body = readFileSync(p, "utf8");
        assert.ok(body.includes(from), `fixture does not contain ${JSON.stringify(from)} in ${rel}`);
        writeFileSync(p, body.replace(from, to));
      },
      write(rel, body) {
        writeFileSync(join(dir, rel), body);
      },
    });
    if (commitAfter) {
      git("add", "-A");
      git("commit", "-m", "mutated");
    }
  }

  for (const [language, out] of [["python", "scripts/check_docs.py"], ["node", "scripts/check_docs.mjs"]]) {
    const g = run("generate-checker.mjs", ["--repo", dir, "--language", language, "--out", out]);
    assert.equal(g.status, 0, `generate (${language}): ${g.stderr}`);
  }
  return { dir, git };
}

function check(dir, language) {
  const script = language === "python" ? "scripts/check_docs.py" : "scripts/check_docs.mjs";
  const argv = language === "python" ? ["python3", "-I", script] : [process.execPath, script];
  try {
    const stdout = execFileSync(argv[0], argv.slice(1), {
      cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    });
    return { status: 0, stdout, stderr: "" };
  } catch (e) {
    return { status: e.status ?? 1, stdout: e.stdout?.toString() ?? "", stderr: e.stderr?.toString() ?? "" };
  }
}

/** Findings are the `path:line: ID message` lines, sorted — the comparable part of the output.
 *  The id is not always `A<n>`: a repo-invented assertion brings its own. */
const FINDING_RE = /^\S+:\d+: [A-Z]\w*\d+ /;

function findings(res) {
  return (res.stderr + res.stdout)
    .split("\n")
    .filter((l) => FINDING_RE.test(l))
    .sort();
}

/** Run both languages and assert they agree. Returns the shared findings and the exit status. */
function both(dir) {
  const py = check(dir, "python");
  const js = check(dir, "node");
  assert.deepEqual(findings(js), findings(py),
    "the two emitted checkers disagree:\n--- python ---\n" + py.stderr + py.stdout
    + "\n--- node ---\n" + js.stderr + js.stdout);
  assert.equal(js.status, py.status, "the two emitted checkers disagree on the exit status");
  return { status: py.status, findings: findings(py), py, js };
}

const ids = (f) => [...new Set(f.map((l) => l.match(/^\S+:\d+: ([A-Z]\w*\d+) /)[1]))].sort();

test("a clean tree exits 0 with no findings, in both languages", () => {
  const { dir } = fixture();
  const r = both(dir);
  assert.equal(r.status, 0, r.py.stderr + r.py.stdout);
  assert.deepEqual(r.findings, []);
  // Something is printed, because a check that says nothing cannot be told from one that did not run.
  assert.match(r.py.stdout, /14 assertions/);
  rm(dir);
});

// ── One planted drift per assertion ──────────────────────────────────────────

const DRIFTS = [
  ["A1", "a cited markdown path that does not exist", ({ edit }) =>
    edit("docs/engineering.md", "`docs/checks.md` § Checks", "`docs/gone.md` § Checks")],

  ["A2", "a § citation naming a heading that does not exist", ({ edit }) =>
    edit("docs/engineering.md", "`docs/checks.md` § Checks", "`docs/checks.md` § Rollback")],

  ["A3", "a documented check that CI does not run", ({ edit }) =>
    edit("docs/checks.md", "python3 scripts/check_docs.py", "python3 scripts/check_docs.py\nnpm run lint")],

  ["A4", "a table.column in prose that the schema does not define", ({ edit }) =>
    edit("docs/engineering.md", "`hives.state`", "`hives.condition`")],

  ["A5", "a vocabulary block missing a member the artifact defines", ({ edit }) =>
    edit("docs/engineering.md", "queenless\nrequeened\nthriving", "queenless\nrequeened")],

  ["A6", "a retired name back in the prose", ({ edit }) =>
    edit("docs/engineering.md", "A hive's current state", "The beehives table's current state")],

  ["A7", "a reversed decision prescribed again", ({ edit }) =>
    edit("docs/engineering.md", "A plain table. The rationale", "**Use a queue library**. The rationale")],

  ["A8", "one issue claimed by two plans", ({ edit }) =>
    edit("docs/plans/second.md", "| 1 | #5 render the week", "| 1 | #4 render the week")],

  ["A9", "a stated count that does not match the computed one", ({ edit }) =>
    edit("docs/plans/first.md", "There are **two** plan files", "There are **five** plan files")],

  ["A10", "a doc under docs/ with no row in the table", ({ write }) =>
    write("docs/orphan.md", "# Orphan\n\nA file nobody listed.\n")],

  ["A11", "an Enforces value that is not on load_bearing", ({ edit }) =>
    edit("CLAUDE.md", "| `docs/engineering.md` | 2 Current | Stack, data access, and the hive-state vocabulary |  |",
      "| `docs/engineering.md` | 2 Current | Stack, data access, and the hive-state vocabulary | `db/nope.sql` |")],

  ["A12", "a byte changed in a record already on the default branch", ({ edit }) =>
    edit("docs/adr/0001-use-a-plain-table-for-the-queue.md", "retries are hand-written",
      "retries are automatic")],

  ["A13", "a decision record with no Status", ({ edit }) =>
    edit("docs/adr/0001-use-a-plain-table-for-the-queue.md", "**Status:** accepted\n", "")],
];

for (const [id, what, mutate] of DRIFTS) {
  test(`${id} — ${what}`, () => {
    // A13's drift also changes a layer-3 file's bytes, which is A12's drift. Committing the
    // mutation makes it the default branch's own bytes, so only A13 can fire.
    const commitAfter = id === "A13";
    const { dir } = fixture({ mutate, commitAfter });
    const r = both(dir);
    assert.equal(r.status, 1, `expected exit 1\n${r.py.stdout}${r.py.stderr}`);
    assert.deepEqual(ids(r.findings), [id],
      `expected only ${id}:\n${r.findings.join("\n")}`);
    // Every finding names a file and a line, or it cannot be acted on.
    for (const line of r.findings) {
      assert.match(line, /^[\w./-]+:\d+: [A-Z]\w*\d+ \S/, line);
    }
    rm(dir);
  });
}

// ── The things that are not a planted drift ──────────────────────────────────

test("a configured section that is missing fails, saying the comparison was not made", () => {
  const { dir } = fixture({
    mutate: ({ edit }) => edit("docs/checks.md", "## Checks", "## The checks, renamed"),
  });
  const r = both(dir);
  assert.equal(r.status, 1);
  const out = r.py.stderr + r.py.stdout;
  assert.match(out, /A3/);
  assert.match(out, /not made|not compared|no section/i,
    "a missing section must say the comparison was not made, not go quiet");
  rm(dir);
});

test("a baselined violation passes; the same violation on a new line fails", () => {
  const { dir } = fixture({
    mutate: ({ edit }) => edit("docs/engineering.md", "`docs/checks.md` § Checks", "`docs/gone.md` § Checks"),
  });
  // Record the baseline, then both languages pass.
  const w = run("generate-checker.mjs", ["--repo", dir, "--language", "python", "--out", "scripts/check_docs.py", "--write-baseline"]);
  assert.equal(w.status, 0, w.stderr);
  const baseline = JSON.parse(readFileSync(join(dir, ".seam/baseline.json"), "utf8"));
  assert.ok(baseline.entries.length > 0, "the baseline is empty");
  assert.ok(baseline.entries.every((e) => e.id && e.file && e.line && "text" in e),
    JSON.stringify(baseline.entries[0]));

  const r = both(dir);
  assert.equal(r.status, 0, `a baselined violation should pass:\n${r.py.stderr}`);
  assert.match(r.py.stdout, /1 baselined/);

  // Move it down a line. A violation whose line no longer matches drops out of the baseline
  // rather than being carried forever, so it fails again.
  const p = join(dir, "docs/engineering.md");
  writeFileSync(p, "<!-- a line added at the top -->\n" + readFileSync(p, "utf8"));
  const moved = both(dir);
  assert.equal(moved.status, 1, "a moved violation is not the baselined one");
  assert.deepEqual(ids(moved.findings), ["A1"]);
  rm(dir);
});

test("an allow-list entry excuses a citation; the baseline is not the allow-list", () => {
  const { dir } = fixture({
    mutate: ({ edit }) => edit("docs/engineering.md", "`docs/checks.md` § Checks", "`AGENTS.md` and `docs/checks.md` § Checks"),
  });
  // `AGENTS.md` is on A1's allow-list in the fixture config, with a reason.
  const r = both(dir);
  assert.equal(r.status, 0, r.py.stderr);
  assert.ok(!existsSync(join(dir, ".seam/baseline.json")),
    "an allow-listed citation must not need a baseline entry");
  rm(dir);
});

test("the emitted checker carries a version stamp and reads the config at runtime", () => {
  const { dir } = fixture();
  const version = JSON.parse(readFileSync(join(REPO, ".claude-plugin/plugin.json"), "utf8")).version;
  for (const f of ["scripts/check_docs.py", "scripts/check_docs.mjs"]) {
    const body = readFileSync(join(dir, f), "utf8");
    assert.ok(body.includes(`seam ${version}`), `${f} has no version stamp`);
    assert.ok(body.includes(".seam/config.json"), `${f} does not read the config at runtime`);
    // The knobs live in the config, not in the script.
    assert.ok(!body.includes("beehives"), `${f} has a repo-specific knob baked into it`);
    assert.ok(!body.includes("hive_state"), `${f} has a repo-specific knob baked into it`);
  }
  rm(dir);
});

test("a repo-invented assertion is discovered and is never overwritten", () => {
  const { dir } = fixture();
  const py = "import os\n\n\ndef run(ctx):\n"
    + "    return [{'id': 'X1', 'file': 'CLAUDE.md', 'line': 1, 'text': 'x',\n"
    + "             'message': 'a repo-invented assertion ran'}]\n";
  const mjs = "export function run(ctx) {\n"
    + "  return [{ id: 'X1', file: 'CLAUDE.md', line: 1, text: 'x',\n"
    + "            message: 'a repo-invented assertion ran' }];\n}\n";
  execFileSync("mkdir", ["-p", join(dir, ".seam/assertions")]);
  writeFileSync(join(dir, ".seam/assertions/x1.py"), py);
  writeFileSync(join(dir, ".seam/assertions/x1.mjs"), mjs);

  const r = both(dir);
  assert.equal(r.status, 1, r.py.stdout);
  assert.deepEqual(r.findings, ["CLAUDE.md:1: X1 a repo-invented assertion ran"]);

  // Regenerating must not touch them.
  const before = readFileSync(join(dir, ".seam/assertions/x1.py"), "utf8");
  const g = run("generate-checker.mjs", ["--repo", dir, "--language", "python", "--out", "scripts/check_docs.py"]);
  assert.equal(g.status, 0, g.stderr);
  assert.equal(readFileSync(join(dir, ".seam/assertions/x1.py"), "utf8"), before);
  rm(dir);
});

test("an assertion switched off in the config does not run", () => {
  const { dir } = fixture({
    mutate: ({ dir: d, edit }) => {
      edit("docs/engineering.md", "`docs/checks.md` § Checks", "`docs/gone.md` § Checks");
      const cfg = JSON.parse(readFileSync(join(d, ".seam/config.json"), "utf8"));
      cfg.assertions.A1.enabled = false;
      writeFileSync(join(d, ".seam/config.json"), JSON.stringify(cfg, null, 2));
    },
  });
  const r = both(dir);
  assert.equal(r.status, 0, r.py.stderr);
  assert.match(r.py.stdout, /13 assertions/, "the count must say how many actually ran");
  rm(dir);
});

test("generate-checker refuses a repo with no config, naming the file", () => {
  const dir = scratch("seam-noconfig-");
  const g = run("generate-checker.mjs", ["--repo", dir]);
  assert.equal(g.status, 2);
  assert.match(g.stderr, /\.seam\/config\.json/);
  rmSync(dir, { recursive: true, force: true });
});

test("a backticked label inside a markdown link is not a citation, but a bad target is", () => {
  // Found on a repo nothing was tuned against: a README listing its rules as
  // [`api.md`](.claude/rules/api.md) reported eight dangling citations, because the backticked
  // label does not resolve beside the README while the link target resolves perfectly well.
  // The link is the citation; the text is a label.
  const { dir } = fixture({
    mutate: ({ edit }) => edit("docs/engineering.md", "[`checks.md`](docs/checks.md)",
      "[`checks.md`](docs/nope.md)"),
  });
  const r = both(dir);
  assert.equal(r.status, 1, r.py.stdout);
  assert.deepEqual(ids(r.findings), ["A1"]);
  assert.ok(r.findings.every((l) => l.includes("docs/nope.md")),
    `the finding should name the target, not the label: ${r.findings.join("\n")}`);
  rm(dir);
});

test("a PRD index that names a version by its label, not its filename, is still an index", () => {
  // Found on a repo nothing was tuned against: its index reads `| v0 | 2026-03-10 | … |`, which
  // makes the version perfectly findable. A13 exists so that an unindexed version cannot hide,
  // not so that the index has to spell a filename.
  const { dir } = fixture({
    mutate: ({ edit }) => edit("docs/prd/README.md", "| [v1](PRD-v1.md) | 2026-01-01 |",
      "| v1 | 2026-01-01 |"),
  });
  const r = both(dir);
  assert.equal(r.status, 0, `${r.py.stderr}${r.py.stdout}`);
  rm(dir);
});

test("a PRD version named nowhere in the index still fails", () => {
  const { dir } = fixture({
    mutate: ({ edit }) => edit("docs/prd/README.md", "| [v1](PRD-v1.md) | 2026-01-01 |",
      "| the first one | 2026-01-01 |"),
  });
  const r = both(dir);
  assert.equal(r.status, 1, r.py.stdout);
  assert.deepEqual(ids(r.findings), ["A13"]);
  rm(dir);
});

// A12 freezes RECORDS, not the files that index them. An index grows by design — adding a
// version means appending a row — and `PRD-current.md` is replaced wholesale when a new version
// lands. Freezing either makes the layer unusable, which is the opposite of enforcing its edit
// rule. Found by the two tests above, which could not pass without it.
for (const [rel, from, to, frozen] of [
  ["docs/prd/README.md", "| 2026-01-01 | First recorded intent", "| 2026-01-02 | First recorded intent", false],
  ["docs/prd/PRD-current.md", "one beekeeper can plan", "one beekeeper may plan", false],
  ["docs/adr/README.md", "| 2026-01-01 | accepted |", "| 2026-01-02 | accepted |", false],
  ["docs/prd/PRD-v1.md", "one beekeeper can plan", "one beekeeper may plan", true],
]) {
  test(`A12 ${frozen ? "freezes" : "does not freeze"} ${rel}`, () => {
    const { dir } = fixture({ mutate: ({ edit }) => edit(rel, from, to) });
    const r = both(dir);
    if (frozen) {
      assert.equal(r.status, 1, r.py.stdout);
      assert.ok(r.findings.some((l) => l.startsWith(`${rel}:1: A12 `)), r.findings.join("\n"));
    } else {
      assert.ok(!r.findings.some((l) => l.includes(" A12 ")),
        `${rel} is an index or the active text, not a record:\n${r.findings.join("\n")}`);
    }
    rm(dir);
  });
}

// ── Three defects found by running the emitted checker against a 45-doc repo ─────────────────

test("a heading's comma-separated first clause is citable", () => {
  // `docs/engineering.md` § API, cited of a heading "API, and what it refuses". Splitting clauses
  // on an em dash alone missed it, and that one shape accounted for several of the misses on a
  // 45-doc repo. The citing file's own H1 must not be what rescues it, so the section is cited
  // from another file and named nothing like that file's title.
  const { dir } = fixture({
    mutate: ({ edit }) => {
      edit("docs/engineering.md", "## Data access\n",
        "## Data access, and what it does not reach\n");
      edit("docs/checks.md", "Whether a doc is *true*.",
        "`docs/engineering.md` § Data access is where the columns are. Whether a doc is *true*.");
    },
  });
  const r = both(dir);
  assert.ok(!r.findings.some((l) => l.includes(" A2 ")), r.findings.join("\n"));
  rm(dir);
});

test("a § citation's name stops at a table cell boundary", () => {
  // A `|` is never part of a heading, and leaving it in put a stray cell separator into the
  // message — `§ The harvester runtime |` — which reads as though the heading were named that.
  const { dir } = fixture({
    mutate: ({ edit }) => edit("docs/engineering.md", "## Queue\n",
      "## Queue\n\n| Doc | Owns |\n|---|---|\n| `docs/checks.md` § Nowhere | why each check exists |\n"),
  });
  const r = both(dir);
  assert.equal(r.status, 1, r.py.stdout);
  assert.deepEqual(ids(r.findings), ["A2"]);
  assert.ok(r.findings.some((l) => /\u00a7 Nowhere,? which names no heading/.test(l)),
    `the name must stop at the cell boundary:\n${r.findings.join("\n")}`);
  rm(dir);
});

test("A4 does not read a file extension or a TLD as a field, with nothing configured", () => {
  const { dir } = fixture({
    mutate: ({ dir: d, edit }) => {
      edit("docs/engineering.md", "An apiary's name is\n`apiaries.name`.",
        // `.org` and not `.io`: `io` was trimmed out of the default on review, because a column
        // called `io` is entirely plausible and the default must not blind A4 to a rename of one.
        "An apiary's name is `apiaries.name`, the parser lives in `hives.py`, and the roster is at"
        + " `apiaries.org` — none of which is a column.");
      const cfg = JSON.parse(readFileSync(join(d, ".seam/config.json"), "utf8"));
      delete cfg.assertions.A4.not_fields;      // nothing configured at all
      writeFileSync(join(d, ".seam/config.json"), JSON.stringify(cfg, null, 2));
    },
  });
  const r = both(dir);
  assert.equal(r.status, 0, `${r.py.stderr}${r.py.stdout}`);
  rm(dir);
});

// ── Findings from the review of the measuring apparatus, and from the cold read ──────────────

test("a heading's tail clause does not contribute one-word anchors", () => {
  // Splitting on ", " fed TAIL clauses into the leading-word expansion, so a heading written
  // "Checks, and what each one does" contributed the anchor `and`, and `citesSection` accepts any
  // citation starting with an anchor on a word boundary. A2 then silently passed citations to
  // sections that do not exist — a check that stopped checking.
  const { dir } = fixture({
    mutate: ({ edit }) => {
      edit("docs/checks.md", "## Checks", "## Checks, and what each one does");
      edit("docs/engineering.md", "`docs/checks.md` § Checks, and the index",
        "`docs/checks.md` § And the review gate, and the index");
    },
  });
  const r = both(dir);
  assert.equal(r.status, 1, `\`§ And the review gate\` names no heading:\n${r.py.stdout}`);
  assert.ok(r.findings.some((l) => l.includes(" A2 ")), r.findings.join("\n"));
  rm(dir);
});

test("a heading's first clause is still citable after that", () => {
  const { dir } = fixture({
    mutate: ({ edit }) => edit("docs/checks.md", "## Checks", "## Checks, and what each one does"),
  });
  const r = both(dir);
  assert.equal(r.status, 0, `§ Checks still names that heading:\n${r.py.stderr}${r.py.stdout}`);
  rm(dir);
});

test("a prototype member name on the left of a dotted reference does not crash", () => {
  // `constructor.name` passed `left in tables` through the prototype chain and then dereferenced
  // a non-Set: a hard crash in the Node emission and a silent skip in Python — a divergence the
  // generator's own header says the two are compared to prevent.
  const { dir } = fixture({
    mutate: ({ edit }) => edit("docs/engineering.md", "`apiaries.name`",
      "`apiaries.name` (and `constructor.name`, `toString.length`, `valueOf.x`)"),
  });
  const r = both(dir);
  assert.equal(r.status, 0, `${r.py.stderr}${r.py.stdout}${r.js.stderr}`);
  assert.ok(!/TypeError|Traceback/.test(r.js.stderr + r.py.stderr), r.js.stderr + r.py.stderr);
  rm(dir);
});

test("a checker with no assertions enabled refuses to run", () => {
  // A hand-written config with no switches emitted a checker that enabled nothing and exited 0.
  // A check that measures nothing cannot be told from one that passed, which is the thing this
  // whole layer exists to prevent.
  const { dir } = fixture({
    mutate: ({ dir: d }) => {
      const cfg = JSON.parse(readFileSync(join(d, ".seam/config.json"), "utf8"));
      for (const k of Object.keys(cfg.assertions)) cfg.assertions[k].enabled = false;
      writeFileSync(join(d, ".seam/config.json"), JSON.stringify(cfg, null, 2));
    },
  });
  for (const lang of ["python", "node"]) {
    const res = check(dir, lang);
    assert.equal(res.status, 2, `${lang}: ${res.stdout}${res.stderr}`);
    assert.match(res.stderr, /no assertions/i);
  }
  rm(dir);
});

test("an allow-list entry with no reason is refused", () => {
  // The method says an allow-list entry requires a written reason — it means "this will never be
  // fixed". Nothing read the field, so the requirement was a sentence.
  const { dir } = fixture({
    mutate: ({ dir: d }) => {
      const cfg = JSON.parse(readFileSync(join(d, ".seam/config.json"), "utf8"));
      cfg.assertions.A1.allow = [{ path: "AGENTS.md" }];
      writeFileSync(join(d, ".seam/config.json"), JSON.stringify(cfg, null, 2));
    },
  });
  for (const lang of ["python", "node"]) {
    const res = check(dir, lang);
    assert.equal(res.status, 2, `${lang}: ${res.stdout}${res.stderr}`);
    assert.match(res.stderr, /reason/i);
    assert.match(res.stderr, /AGENTS\.md/);
  }
  rm(dir);
});

test("A11 checks the config's layer against the table's, and leaves a command alone", () => {
  // Two findings in one: the config carried `docs[].layer` that nothing read, so the layer
  // existed twice with nothing reconciling it; and A11 demanded every Enforces cell be on
  // `load_bearing`, which forced command strings onto a list the review policy reads as globs.
  const { dir } = fixture({
    mutate: ({ dir: d, edit }) => {
      const cfg = JSON.parse(readFileSync(join(d, ".seam/config.json"), "utf8"));
      cfg.docs.find((x) => x.path === "docs/checks.md").layer = 5;      // the table says 2
      writeFileSync(join(d, ".seam/config.json"), JSON.stringify(cfg, null, 2));
      edit("CLAUDE.md", "| `docs/engineering.md` | 2 Current | Stack, data access, and the hive-state vocabulary |  |",
        "| `docs/engineering.md` | 2 Current | Stack, data access, and the hive-state vocabulary | `pnpm run check:x` |");
    },
  });
  const r = both(dir);
  assert.equal(r.status, 1, r.py.stdout);
  assert.deepEqual(ids(r.findings), ["A11"]);
  assert.ok(r.findings.some((l) => /layer/.test(l) && /docs\/checks\.md/.test(l)),
    `the layer disagreement must be reported:\n${r.findings.join("\n")}`);
  assert.ok(!r.findings.some((l) => l.includes("check:x")),
    `a command in Enforces is not a path and is not held to load_bearing:\n${r.findings.join("\n")}`);
  rm(dir);
});

test("an explicit not_fields_override replaces the built-in default", () => {
  const { dir } = fixture({
    mutate: ({ dir: d, edit }) => {
      edit("docs/engineering.md", "`apiaries.name`", "`apiaries.name` and the body is `hives.html`");
      const cfg = JSON.parse(readFileSync(join(d, ".seam/config.json"), "utf8"));
      cfg.assertions.A4.not_fields_override = ["md"];
      writeFileSync(join(d, ".seam/config.json"), JSON.stringify(cfg, null, 2));
    },
  });
  const r = both(dir);
  assert.equal(r.status, 1, r.py.stdout);
  assert.ok(r.findings.some((l) => l.includes("hives.html")),
    `an override must let a repo check a column called html:\n${r.findings.join("\n")}`);
  rm(dir);
});

test("an enabled assertion whose glob matches nothing says the comparison was not made", () => {
  // The same rule A3 and A12 already follow: off is distinct from passing, and an assertion that
  // is ON but cannot make its comparison fails loudly rather than going quiet. Measured on seam
  // itself, where A8 was enabled against a directory that did not exist.
  const { dir } = fixture({
    mutate: ({ dir: d }) => {
      const cfg = JSON.parse(readFileSync(join(d, ".seam/config.json"), "utf8"));
      cfg.assertions.A8.plan_glob = "docs/nowhere/*.md";
      writeFileSync(join(d, ".seam/config.json"), JSON.stringify(cfg, null, 2));
    },
  });
  const r = both(dir);
  assert.equal(r.status, 1, r.py.stdout);
  assert.deepEqual(ids(r.findings), ["A8"]);
  assert.ok(r.findings.some((l) => /not made|matches no/i.test(l)), r.findings.join("\n"));
  rm(dir);
});

// ── A14: the units table has the shape it claims ─────────────────────────────

test("A14 says the comparison was not made when § The units has no unit in it", () => {
  // The heading is there and the table is there, and nothing is in it. Passing that would read as
  // "every unit has a test" about a plan that names no unit — the same case as a missing section.
  const { dir } = fixture({
    mutate: ({ edit }) => edit("docs/plans/first.md",
      "| 1 | seed the hive table | `spec/hives.check.mjs` | the seed rows load and the count is stated |\n",
      ""),
  });
  const r = both(dir);
  assert.equal(r.status, 1, r.py.stdout + r.py.stderr);
  assert.deepEqual(ids(r.findings), ["A14"], r.findings.join("\n"));
  assert.equal(r.findings.length, 1, r.findings.join("\n"));
  assert.match(r.findings[0], /^docs\/plans\/first\.md:\d+: A14 /, r.findings[0]);
  assert.match(r.findings[0], /not made/i, r.findings[0]);
  rm(dir);
});

test("A14 flags a unit row with no test path", () => {
  const { dir } = fixture({
    mutate: ({ edit }) => edit("docs/plans/first.md", "`spec/hives.check.mjs`", "to be decided"),
  });
  const r = both(dir);
  assert.equal(r.status, 1, r.py.stdout + r.py.stderr);
  assert.deepEqual(ids(r.findings), ["A14"], r.findings.join("\n"));
  assert.equal(r.findings.length, 1, r.findings.join("\n"));
  // The finding points at the row itself, not at the top of the table or the file.
  const row = readFileSync(join(dir, "docs/plans/first.md"), "utf8").split("\n")
    .findIndex((l) => l.includes("to be decided")) + 1;
  assert.match(r.findings[0], new RegExp(`^docs/plans/first\\.md:${row}: A14 `), r.findings[0]);
  rm(dir);
});

test("A14 flags a unit whose test file does not exist", () => {
  const { dir } = fixture({
    mutate: ({ edit }) => edit("docs/plans/first.md", "`spec/hives.check.mjs`", "`spec/gone.check.mjs`"),
  });
  const r = both(dir);
  assert.equal(r.status, 1, r.py.stdout + r.py.stderr);
  assert.deepEqual(ids(r.findings), ["A14"], r.findings.join("\n"));
  assert.match(r.findings[0], /spec\/gone\.check\.mjs/, r.findings[0]);
  rm(dir);
});

test("A14 flags a unit whose test file asserts nothing", () => {
  // The word "assertion" in a comment is not an assertion. A substring test would pass this file,
  // and a check that passes on the name of the thing is one that has stopped checking.
  const { dir } = fixture({
    mutate: ({ write }) => write("spec/hives.check.mjs",
      "// an assertion about the seed rows goes here, once somebody writes it, and the expectation\n"
      + "// is that it will\nexport {};\n"),
  });
  const r = both(dir);
  assert.equal(r.status, 1, r.py.stdout + r.py.stderr);
  assert.deepEqual(ids(r.findings), ["A14"], r.findings.join("\n"));
  assert.match(r.findings[0], /spec\/hives\.check\.mjs/, r.findings[0]);
  rm(dir);
});

test("A14 says the comparison was not made when a plan has no § The units", () => {
  // A plan with a § The issues and no § The units compared nothing. Silence there would read as
  // "every unit has a test", which is the sentence nothing checked.
  const { dir } = fixture({
    mutate: ({ edit }) => edit("docs/plans/first.md", "## The units", "## The pieces"),
  });
  const r = both(dir);
  assert.equal(r.status, 1, r.py.stdout + r.py.stderr);
  assert.deepEqual(ids(r.findings), ["A14"], r.findings.join("\n"));
  assert.match(r.findings[0], /^docs\/plans\/first\.md:\d+: A14 /, r.findings[0]);
  assert.match(r.findings[0], /not made/i, r.findings[0]);
  rm(dir);
});

test("A14 reads a row with a doubled leading pipe the same way in both checkers", () => {
  // Python's strip("|") takes every pipe and Node's replace takes one, so `|| 1 | …` was a unit in
  // one language and not in the other: Python exited 0 and Node said "no unit in it".
  const { dir } = fixture({
    mutate: ({ edit }) => edit("docs/plans/first.md",
      "| 1 | seed the hive table | `spec/hives.check.mjs` | the seed rows load and the count is stated |",
      "|| 1 | seed the hive table | `spec/hives.check.mjs` | the seed rows load and the count is stated |"),
  });
  const r = both(dir);
  assert.equal(r.status, 1, r.py.stdout + r.py.stderr);
  assert.deepEqual(ids(r.findings), ["A14"], r.findings.join("\n"));
  assert.match(r.findings[0], /not made/i, r.findings[0]);
  rm(dir);
});

test("A14 and A8 read hostile table syntax identically in both checkers", () => {
  // Every row below is built to be read one way by one language's strip and another way by the
  // other's. `both()` fails on any disagreement; the expectation pins which way is right: only
  // the last row is a unit, so it is the only finding, and the issues table gains no claim.
  const NEL = "\u0085", BOM = "\ufeff", NBSP = "\u00a0";
  const { dir } = fixture({
    mutate: ({ edit }) => {
      edit("docs/plans/first.md", "| 1 | seed the hive table |",
        [
          "|| 2 | doubled leading | `spec/gone.check.mjs` | never |",
          `| ${NEL}3 | next-line before the numeral | \`spec/gone.check.mjs\` | never |`,
          `| ${BOM}4 | byte-order mark before the numeral | \`spec/gone.check.mjs\` | never |`,
          `| ${NBSP}5 | no-break space before the numeral | \`spec/gone.check.mjs\` | never |`,
          "| 6 | doubled trailing | `spec/gone.check.mjs` | never ||",
          "| 1 | seed the hive table |",
        ].join("\n"));
      edit("docs/plans/second.md", "| 1 | #5 render the week | #4 | the week reads what the seed wrote |",
        "| 1 | #5 render the week | #4 | the week reads what the seed wrote |\n"
        + "|| 2 | #4 shifted | — | never |\n"
        + `| ${NEL}3 | #4 next-line | — | never |\n`
        + `| ${BOM}4 | #4 byte-order mark | — | never |`);
    },
  });
  const r = both(dir);
  assert.equal(r.status, 1, r.py.stdout + r.py.stderr);
  assert.deepEqual(ids(r.findings), ["A14"], r.findings.join("\n"));
  assert.equal(r.findings.length, 1, r.findings.join("\n"));
  assert.match(r.findings[0], /unit 6 names `spec\/gone\.check\.mjs`/, r.findings[0]);
  rm(dir);
});

test("A14 says a test file it cannot read could not be read, and the checker keeps going", (t) => {
  // chmod 000 on a file a Proves-it cell names. Python raised PermissionError and Node threw
  // EACCES, both exited 1 with a stack trace, and no assertion after A14 ran: a checker that
  // stops checking, with an exit status that looks like findings. A repo-invented assertion runs
  // after every built-in one, so its finding turning up is the proof that the run got that far.
  const target = "spec/hives.check.mjs";
  const { dir } = fixture({
    mutate: ({ dir: d }) => {
      chmodSync(join(d, target), 0);
      mkdirSync(join(d, ".seam/assertions"), { recursive: true });
      writeFileSync(join(d, ".seam/assertions/x1.py"), "def run(ctx):\n"
        + "    return [{'id': 'X1', 'file': 'CLAUDE.md', 'line': 1, 'text': 'x',\n"
        + "             'message': 'ran after A14'}]\n");
      writeFileSync(join(d, ".seam/assertions/x1.mjs"), "export function run(ctx) {\n"
        + "  return [{ id: 'X1', file: 'CLAUDE.md', line: 1, text: 'x', message: 'ran after A14' }];\n}\n");
    },
  });
  try {
    if (canRead(join(dir, target))) {
      t.skip("this process can read a mode-000 file (root, or a filesystem without modes)");
      return;
    }
    const r = both(dir);
    assert.equal(r.status, 1, r.py.stdout + r.py.stderr);
    assert.deepEqual(ids(r.findings), ["A14", "X1"], r.findings.join("\n"));
    assert.equal(r.findings.length, 2, r.findings.join("\n"));
    assert.match(r.findings.find((l) => l.includes(" A14 ")), /could not be read/);
    assert.doesNotMatch(r.py.stderr + r.js.stderr, /Traceback|EACCES|PermissionError/);
  } finally {
    chmodSync(join(dir, target), 0o644);
    rm(dir);
  }
});

/** Rewrite one key of assertions.A14 in a fixture's config. The checker reads it at run time. */
function setA14(dir, key, value) {
  const p = join(dir, ".seam/config.json");
  const cfg = JSON.parse(readFileSync(p, "utf8"));
  if (value === undefined) delete cfg.assertions.A14[key];
  else cfg.assertions.A14[key] = value;
  writeFileSync(p, JSON.stringify(cfg, null, 2));
}

test("A14's assertion_pattern lets a Go table test, which has no assertion word, pass", () => {
  // `t.Fatalf` is how a Go test fails, and a table test contains nothing else. No default pattern
  // can know that, so the vocabulary is the repo's to set — and the repo keeps the rest of A14.
  const go = "func TestHives(t *testing.T) {\n\tif got != want {\n"
    + "\t\tt.Fatalf(\"got %v want %v\", got, want)\n\t}\n}\n";
  const { dir } = fixture({
    mutate: ({ dir: d, edit, write }) => {
      edit("docs/plans/first.md", "`spec/hives.check.mjs`", "`spec/hives_test.go`");
      write("spec/hives_test.go", go);
      // One pattern is the repo's whole vocabulary, so it still has to admit the other plan's
      // `assert` file.
      setA14(d, "assertion_pattern", String.raw`t\.Fatal|t\.Error|\bassert\b`);
    },
  });
  const set = both(dir);
  assert.equal(set.status, 0, set.py.stdout + set.py.stderr);
  assert.deepEqual(set.findings, []);

  // The same file under the default pattern asserts nothing, which is the point of the key.
  setA14(dir, "assertion_pattern", undefined);
  const unset = both(dir);
  assert.equal(unset.status, 1, unset.py.stdout + unset.py.stderr);
  assert.deepEqual(ids(unset.findings), ["A14"], unset.findings.join("\n"));
  assert.match(unset.findings[0], /spec\/hives_test\.go.*asserts nothing/, unset.findings[0]);
  rm(dir);
});

test("A14 with a pattern it cannot compile says so, and the rest of A14 still runs", () => {
  const { dir } = fixture({
    mutate: ({ dir: d, edit }) => {
      // A second unit pointing at a file that is not there: it must still be found.
      edit("docs/plans/first.md", "| 1 | seed the hive table |",
        "| 2 | gone | `spec/gone.check.mjs` | never |\n| 1 | seed the hive table |");
      setA14(d, "assertion_pattern", "(unclosed");
    },
  });
  const r = both(dir);
  assert.equal(r.status, 1, r.py.stdout + r.py.stderr);
  assert.deepEqual(ids(r.findings), ["A14"], r.findings.join("\n"));
  assert.equal(r.findings.length, 2, r.findings.join("\n"));
  assert.ok(r.findings.some((l) => /^\.seam\/config\.json:1: A14 .*could not be compiled/.test(l)),
    r.findings.join("\n"));
  assert.ok(r.findings.some((l) => /spec\/gone\.check\.mjs.*no such file/.test(l)),
    r.findings.join("\n"));
  assert.doesNotMatch(r.py.stderr + r.js.stderr, /Traceback|SyntaxError|re\.error/);
  rm(dir);
});

test("A14 holds a pattern to the subset both languages read the same way", () => {
  // Each of these compiles in one language and not the other, or compiles in both and means
  // something different. A checker that ran whichever its own engine accepted would pass a repo
  // in Python and fail it in Node, so the pattern is held to a subset and these are refused
  // alike by both.
  const refused = [
    ["(?i)assert", "an inline flag: Python accepts it, Node does not"],
    ["(?<n>assert)", "a named group: Node's syntax, not Python's"],
    ["(?P<n>assert)", "a named group: Python's syntax, not Node's"],
    ["assert(?=\\()", "a lookahead"],
    ["[\\w-.]", "a range from a class escape: Node accepts it, Python refuses"],
    ["assert*+", "a possessive quantifier: Python 3.11 accepts it, nothing before does"],
    ["x{,3}", "an open lower bound: Python reads a quantifier, Node a literal"],
    ["\\p{L}", "a Unicode property: Node needs a flag, Python has none"],
    ["assert\\1", "a back-reference"],
    ["caf\u00e9", "a non-ASCII literal"],
    ["", "an empty pattern, which matches every file"],
    ["a]", "a bare closing bracket"],
    ["[]a]", "an empty class: Node reads it as matching nothing"],
  ];
  const { dir } = fixture();
  for (const [pattern, why] of refused) {
    setA14(dir, "assertion_pattern", pattern);
    const r = both(dir);
    assert.equal(r.status, 1, `${JSON.stringify(pattern)} (${why}) was accepted\n${r.py.stdout}`);
    assert.equal(r.findings.length, 1, `${JSON.stringify(pattern)}\n${r.findings.join("\n")}`);
    assert.match(r.findings[0], /could not be compiled/, `${JSON.stringify(pattern)} (${why})`);
  }
  for (const notAString of [5, ["assert"], { pattern: "assert" }]) {
    setA14(dir, "assertion_pattern", notAString);
    const r = both(dir);
    assert.equal(r.status, 1, JSON.stringify(notAString));
    assert.match(r.findings[0], /could not be compiled — it is not a string/, r.findings[0]);
  }
  rm(dir);
});

test("A14 matches a pattern against the same text in both languages", () => {
  // CRLF files, a U+2028 in a comment, a U+FEFF where Node's \s matches and Python's does not:
  // the file is read with line endings normalised and each run of non-ASCII characters made one
  // "~", so a pattern cannot tell the two engines apart. [pattern, file, passes]
  const cases = [
    [String.raw`^\s*check`, "\tcheck(x)\r\n", true],
    [String.raw`^check`, "\tcheck(x)\n", false],
    [String.raw`done$`, "run done\r\nnext\r\n", true],
    [String.raw`a.c`, "a\u2028c\n", true],
    [String.raw`a\sb`, "a\ufeffb\n", false],
    [String.raw`a\sb`, "a\u0085b\n", false],
    [String.raw`\w+`, "\u00e9\n", false],
    [String.raw`a.{2}b`, "a\u{1F41D}\u{1F41D}b\n", false],
    [String.raw`a.b`, "a\u{1F41D}b\n", true],
  ];
  const { dir } = fixture({
    // The second plan names the same file, so the pattern under test is the only judge of both.
    mutate: ({ edit }) => edit("docs/plans/second.md", "`spec/week.check.mjs`", "`spec/hives.check.mjs`"),
  });
  for (const [pattern, file, passes] of cases) {
    writeFileSync(join(dir, "spec/hives.check.mjs"), file);
    setA14(dir, "assertion_pattern", pattern);
    const r = both(dir);
    assert.equal(r.status, passes ? 0 : 1,
      `${pattern} against ${JSON.stringify(file)} should ${passes ? "pass" : "find nothing"}\n${r.findings.join("\n")}`);
  }
  rm(dir);
});

test("A14 accepts the assertion idioms of the common test frameworks", () => {
  // Rust, unittest, JUnit, minitest, googletest, a bare Python assert and jest. Each is one file,
  // so a rejected idiom names itself.
  const idioms = {
    "rust": "assert_eq!(a, b);",
    "unittest": "self.assertEqual(a, b)",
    "junit": "assertEquals(a, b);",
    "minitest": "assert_equal a, b",
    "gtest-assert": "ASSERT_EQ(a, b);",
    "gtest-expect": "EXPECT_TRUE(x);",
    "bare": "assert x == 1",
    "jest": "expect(x).toBe(1)",
  };
  const { dir } = fixture({
    mutate: ({ edit, write }) => {
      const rows = Object.keys(idioms).map((k, n) =>
        `| ${n + 2} | ${k} | \`spec/idiom-${k}.txt\` | it asserts |`);
      for (const [k, line] of Object.entries(idioms)) write(`spec/idiom-${k}.txt`, line + "\n");
      edit("docs/plans/first.md", "| 1 | seed the hive table |", rows.join("\n") + "\n| 1 | seed the hive table |");
    },
  });
  const r = both(dir);
  assert.equal(r.status, 0, r.py.stdout + r.py.stderr);
  assert.deepEqual(r.findings, []);
  rm(dir);
});

test("A14 skips a struck-through unit, which is no longer one", () => {
  const { dir } = fixture({
    mutate: ({ edit }) => edit("docs/plans/first.md",
      "| 1 | seed the hive table |",
      "| ~~2~~ | ~~dropped~~ | `spec/gone.check.mjs` | never |\n| 1 | seed the hive table |"),
  });
  const r = both(dir);
  assert.equal(r.status, 0, r.py.stdout + r.py.stderr);
  assert.deepEqual(r.findings, []);
  rm(dir);
});

test("A14 holds an absolute or .. path to be no test path, the same in both checkers", () => {
  // `/etc/hosts` exists on most machines, and Python's `ROOT / "/etc/hosts"` is `/etc/hosts`
  // where Node's join(ROOT, "/etc/hosts") is not. Neither is a path in the repo.
  const { dir } = fixture({
    mutate: ({ edit }) => edit("docs/plans/first.md",
      "| 1 | seed the hive table |",
      "| 2 | outside | `/etc/hosts` | never |\n| 3 | above | `../hives.check.mjs` | never |\n"
      + "| 1 | seed the hive table |"),
  });
  const r = both(dir);
  assert.equal(r.status, 1, r.py.stdout + r.py.stderr);
  assert.deepEqual(ids(r.findings), ["A14"], r.findings.join("\n"));
  assert.equal(r.findings.length, 2, r.findings.join("\n"));
  // The cell does hold a backticked path, so "no test path" would be the wrong thing to say.
  for (const f of r.findings) {
    assert.match(f, /not inside the repo/, f);
    assert.doesNotMatch(f, /no test path/, f);
  }
  rm(dir);
});

test("A14 with a glob that matches nothing says the comparison was not made", () => {
  const { dir } = fixture({
    mutate: ({ dir: d }) => {
      const cfg = JSON.parse(readFileSync(join(d, ".seam/config.json"), "utf8"));
      cfg.assertions.A14.plan_glob = "docs/nowhere/*.md";
      writeFileSync(join(d, ".seam/config.json"), JSON.stringify(cfg, null, 2));
    },
  });
  const r = both(dir);
  assert.equal(r.status, 1, r.py.stdout + r.py.stderr);
  assert.deepEqual(ids(r.findings), ["A14"], r.findings.join("\n"));
  assert.match(r.findings[0], /not made/i, r.findings[0]);
  rm(dir);
});

test("A1 treats a citation in an intent doc as an intention, not a claim", () => {
  // An implementation plan names the files it is about to create. By construction every one of
  // those citations is to a file that does not exist yet — measured at 23 on this repo's own
  // plan. They are not debt (a baseline means "not yet" and these evaporate on landing) and not
  // approvals (an allow-list means "never"), so neither existing mechanism fits. The doc itself
  // is the thing that is different: it describes work not yet done.
  const { dir } = fixture({
    mutate: ({ dir: d, write }) => {
      write("docs/plans/third.md",
        "# Third\n\n**Layer 5 — Seam.** Owns nothing.\n\n## The plan\n\n"
        + "- Create: `src/not-yet.md`\n- Create: `docs/also-not-yet.md`\n");
      const cfg = JSON.parse(readFileSync(join(d, ".seam/config.json"), "utf8"));
      cfg.assertions.A1.intent_globs = ["docs/plans/third.md"];
      cfg.assertions.A9.count_sites = [];     // the plan count changes; not this test's subject
      writeFileSync(join(d, ".seam/config.json"), JSON.stringify(cfg, null, 2));
    },
  });
  const r = both(dir);
  assert.ok(!r.findings.some((l) => l.includes(" A1 ")),
    `an intent doc's citations are intentions:\n${r.findings.join("\n")}`);
  rm(dir);
});

test("A1 still holds every other doc to the tree", () => {
  const { dir } = fixture({
    mutate: ({ dir: d, edit }) => {
      edit("docs/engineering.md", "`docs/checks.md` § Checks", "`docs/gone.md` § Checks");
      const cfg = JSON.parse(readFileSync(join(d, ".seam/config.json"), "utf8"));
      cfg.assertions.A1.intent_globs = ["docs/plans/*.md"];   // engineering.md is not one
      writeFileSync(join(d, ".seam/config.json"), JSON.stringify(cfg, null, 2));
    },
  });
  const r = both(dir);
  assert.equal(r.status, 1, r.py.stdout);
  assert.deepEqual(ids(r.findings), ["A1"]);
  rm(dir);
});
