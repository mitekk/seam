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
import { cpSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { scratch, rm, run, REPO } from "./helpers.mjs";

const CLEAN = join(REPO, "tests", "fixtures", "clean");

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
  assert.match(r.py.stdout, /13 assertions/);
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
  assert.match(r.py.stdout, /12 assertions/, "the count must say how many actually ran");
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
