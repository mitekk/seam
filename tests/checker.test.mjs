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
import { cpSync, readFileSync, writeFileSync, appendFileSync, existsSync, rmSync, chmodSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { scratch, rm, run, REPO } from "./helpers.mjs";

const CLEAN = join(REPO, "tests", "fixtures", "clean");

/** The sidecar the wizard writes, rebuilt from the files as they now stand. `patch` perturbs it
 *  for the tests that need it wrong. */
function writeProvenance(dir, patch = null) {
  const cfgPath = join(dir, ".seam", "config.json");
  const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
  const ansPath = join(dir, ".seam", "answers.json");
  const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
  const here = existsSync(ansPath);
  const prov = {
    seam_version: cfg.seam_version,
    answers: here ? ".seam/answers.json" : null,
    answers_sha256: here ? sha(ansPath) : null,
    config_sha256: sha(cfgPath),
    assertions_enabled: Object.keys(cfg.assertions ?? {})
      .filter((k) => cfg.assertions[k]?.enabled).sort(),
  };
  const body = { ...prov, ...(patch ?? {}) };
  for (const k of Object.keys(body)) if (body[k] === undefined) delete body[k];
  writeFileSync(join(dir, ".seam", "provenance.json"), JSON.stringify(body, null, 2) + "\n");
  return prov;
}

/** Whether this process can open the file: false is what a mode-000 file looks like to a user. */
function canRead(p) {
  try { readFileSync(p); return true; } catch { return false; }
}

/** A copy of the clean fixture as a git repo with one commit, plus both checkers generated. */
function fixture({ mutate = null, commitAfter = false, provenance = true } = {}) {
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
  }
  // Written AFTER the mutation and BEFORE the commit: the integrity precondition compares the
  // config's enabled set against this file and refuses to run on a mismatch, so a fixture that
  // switches an assertion off is a fixture whose record has to say so — the same thing a
  // regeneration does. `provenance: false` is for the tests that break it on purpose.
  if (provenance) writeProvenance(dir, typeof provenance === "object" ? provenance : null);
  if (mutate && commitAfter) {
    git("add", "-A");
    git("commit", "-m", "mutated");
  }

  for (const [language, out] of [["python", "scripts/check_docs.py"], ["node", "scripts/check_docs.mjs"]]) {
    const g = run("generate-checker.mjs", ["--repo", dir, "--language", language, "--out", out]);
    assert.equal(g.status, 0, `generate (${language}): ${g.stderr}`);
  }
  return { dir, git };
}

function check(dir, language, extra = []) {
  const script = language === "python" ? "scripts/check_docs.py" : "scripts/check_docs.mjs";
  const argv = language === "python" ? ["python3", "-I", script] : [process.execPath, script];
  try {
    const stdout = execFileSync(argv[0], [...argv.slice(1), ...extra], {
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

// ── A12 and an append-only file that has to be appended to ──────────────────────────────────
//
// A dated decisions file is ONE file that every new decision is added to. Byte-freezing the whole
// of it makes an append-only file impossible to append to: the checker would red the moment the
// next entry landed. So for `adr.format: single`, and for that one path only, what A12 asserts is
// that the text on the default branch is an unbroken PREFIX of the working copy.

const DECISIONS = "docs/decisions.md";
const DECISIONS_BODY = "# Decisions\n\n**Layer 3 — Decisions.** Append-only and dated.\n\n"
  + "## D-001 — Use a plain table for the queue\n\n*2026-01-01 · settled*\n\nRetries are hand-written.\n";
const APPENDED = "\n## D-002 — Name the worker\n\n*2026-01-02 · settled*\n\nIt is called the worker.\n";

/** The clean fixture with a dated decisions file beside its MADR records, `adr` pointed at it,
 *  and all of it committed to `main` — so there is something on the branch for A12 to compare. */
function singleFixture() {
  return fixture({
    commitAfter: true,
    mutate: ({ dir, edit, write }) => {
      write(DECISIONS, DECISIONS_BODY);
      edit("CLAUDE.md", "| `docs/prd/*.md` |",
        "| `docs/decisions.md` | 3 Decisions | What was chosen, and why |  |\n| `docs/prd/*.md` |");
      const p = join(dir, ".seam/config.json");
      const cfg = JSON.parse(readFileSync(p, "utf8"));
      cfg.adr = { format: "single", file: DECISIONS };
      cfg.docs.splice(3, 0, { path: DECISIONS, layer: 3, enforces: "", create: true });
      writeFileSync(p, JSON.stringify(cfg, null, 2));
    },
  });
}

test("A12 allows an append to a dated decisions file", () => {
  const { dir } = singleFixture();
  // The committed state is clean, so a finding below can only have come from the append.
  assert.deepEqual(both(dir).findings, []);
  appendFileSync(join(dir, DECISIONS), APPENDED);
  const r = both(dir);
  assert.equal(r.status, 0, `an append is what the file is for:\n${r.py.stdout}${r.py.stderr}`);
  assert.deepEqual(r.findings, []);
  rm(dir);
});

for (const [what, change] of [
  ["an entry edited in place", (body) => body.replace("hand-written", "automatic")],
  ["an entry edited and a new one appended", (body) => body.replace("hand-written", "automatic") + APPENDED],
  ["an entry deleted", (body) => body.slice(0, body.indexOf("## D-001"))],
]) {
  test(`A12 flags an edit to an existing entry in a dated file: ${what}`, () => {
    const { dir } = singleFixture();
    const p = join(dir, DECISIONS);
    writeFileSync(p, change(readFileSync(p, "utf8")));
    const r = both(dir);
    assert.equal(r.status, 1, r.py.stdout);
    assert.deepEqual(ids(r.findings), ["A12"], r.findings.join("\n"));
    assert.ok(r.findings.some((l) => l.startsWith(`${DECISIONS}:1: A12 `)), r.findings.join("\n"));
    const out = r.py.stdout + r.py.stderr;
    // The message is the guidance: it says what went wrong in THIS file's terms, not the record rule's.
    assert.match(out, /edited, not appended/);
    assert.match(out, /reversal is a new dated entry/);
    rm(dir);
  });
}

for (const [what, mk, rel, line] of [
  ["a MADR record", () => fixture(), "docs/adr/0001-use-a-plain-table-for-the-queue.md", "\nAn afterthought.\n"],
  // Under `single`, the prefix allowance is for `adr.file` and for nothing else in layers 3 and 4.
  ["a MADR record, when adr.format is single", singleFixture, "docs/adr/0001-use-a-plain-table-for-the-queue.md", "\nAn afterthought.\n"],
  ["a PRD version, when adr.format is single", singleFixture, "docs/prd/PRD-v1.md", "\nAn afterthought.\n"],
]) {
  test(`A12 still demands byte-equality for ${what}`, () => {
    const { dir } = mk();
    appendFileSync(join(dir, rel), line);
    const r = both(dir);
    assert.equal(r.status, 1, `even an append changes a record's bytes:\n${r.py.stdout}${r.py.stderr}`);
    assert.deepEqual(ids(r.findings), ["A12"], r.findings.join("\n"));
    assert.ok(r.findings.some((l) => l.startsWith(`${rel}:1: A12 `)), r.findings.join("\n"));
    assert.match(r.py.stdout + r.py.stderr, /bytes are final/);
    rm(dir);
  });
}

// ── A12 and the one field a MADR record is allowed to change ────────────────────────────────
//
// The method's own rule for a reversal is that the OLD record gains a `superseded by NNNN` status,
// and A13 requires a superseded record to name a successor that exists. Both are asked of the same
// bytes, so a byte-equality A12 made the two unsatisfiable the first time any repo reversed a
// decision. For a layer-3 MADR record every line must still match the default branch except a line
// that opens `**Status:**`: the record's substance stays frozen, and its status is metadata about
// supersession. Nothing wider — it is not a way to correct a record.

const OLD_RECORD = "docs/adr/0001-use-a-plain-table-for-the-queue.md";
const SUCCESSOR = "# 0002. Adopt a queue library\n\n**Date:** 2026-02-01\n**Status:** accepted\n"
  + "**Deciders:** apiary maintainers\n\n## Context\n\nRetries were hand-written and are now most "
  + "of the code.\n\n## Outcome\n\nA queue library replaces the table. This supersedes 0001.\n";

/** What the method prescribes for a reversal, all of it: the old record's Status becomes
 *  `superseded by 0002`, the successor is added, and the index says so. */
function supersede({ edit, write }) {
  edit(OLD_RECORD, "**Status:** accepted", "**Status:** superseded by 0002");
  write("docs/adr/0002-adopt-a-queue-library.md", SUCCESSOR);
  edit("docs/adr/README.md", "| 2026-01-01 | accepted |",
    "| 2026-01-01 | superseded by 0002 |\n"
    + "| [0002](0002-adopt-a-queue-library.md) | Adopt a queue library | 2026-02-01 | accepted |");
}

test("A12 allows a MADR record's Status to become `superseded by NNNN`, the prescribed reversal", () => {
  const { dir } = fixture({ mutate: supersede });
  const r = both(dir);
  assert.equal(r.status, 0, `the method's own reversal must not red its own checker:\n${r.py.stdout}${r.py.stderr}`);
  assert.deepEqual(r.findings, []);
  rm(dir);
});

for (const [what, extra] of [
  ["the Date line", ({ edit }) => edit(OLD_RECORD, "**Date:** 2026-01-01", "**Date:** 2026-01-02")],
  ["a body line", ({ edit }) => edit(OLD_RECORD, "retries are hand-written", "retries are automatic")],
  ["a line added", ({ edit }) => edit(OLD_RECORD, "The queue is a plain table.\n", "The queue is a plain table.\n\nAn afterthought.\n")],
  ["a line deleted", ({ edit }) => edit(OLD_RECORD, "**Deciders:** apiary maintainers\n", "")],
  // The exemption is for a line that IS a status line on the branch, not for any line that is
  // rewritten to look like one.
  ["a body line rewritten to open with **Status:**",
    ({ edit }) => edit(OLD_RECORD, "The queue is a plain table.", "**Status:** the queue is a plain table.")],
  // A line that IS a status line may still not carry arbitrary content. A lone CR is a line break
  // to a markdown renderer, so this reads as new paragraphs while the `\n` line count is equal.
  ["a carriage return injected into the Status line, which a renderer shows as new paragraphs",
    ({ edit }) => edit(OLD_RECORD, "**Status:** superseded by 0002",
      "**Status:** superseded by 0002\r\r## Context\r\rWe changed our minds.")],
  ["an absurdly long Status value",
    ({ edit }) => edit(OLD_RECORD, "**Status:** superseded by 0002",
      `**Status:** superseded by 0002 ${"a".repeat(5000)}`)],
]) {
  test(`A12 still fires on ${what}, even beside a legitimate Status flip in the same record`, () => {
    const { dir } = fixture({ mutate: (m) => { supersede(m); extra(m); } });
    const r = both(dir);
    assert.equal(r.status, 1, `the exemption must not become a wildcard:\n${r.py.stdout}${r.py.stderr}`);
    assert.deepEqual(ids(r.findings), ["A12"], r.findings.join("\n"));
    assert.ok(r.findings.some((l) => l.startsWith(`${OLD_RECORD}:1: A12 `)), r.findings.join("\n"));
    assert.match(r.py.stdout + r.py.stderr, /Only its \*\*Status:\*\* line may change/);
    rm(dir);
  });
}

// The bound on a Status value is one number, not a vocabulary: A13 already owns what a status may
// say. Pinned on both sides so it cannot drift, and with punctuation a real status carries.
/** A Status value (everything after `**Status:**`) of exactly `n` characters, still naming 0002. */
const statusValue = (n) => " superseded by 0002".padEnd(n, ".");

for (const [n, fires] of [[120, false], [121, true]]) {
  test(`A12 ${fires ? "fires on" : "allows"} a Status value of ${n} characters`, () => {
    const { dir } = fixture({
      mutate: (m) => {
        supersede(m);
        m.edit(OLD_RECORD, "**Status:** superseded by 0002", `**Status:**${statusValue(n)}`);
      },
    });
    const r = both(dir);
    if (fires) {
      assert.equal(r.status, 1, r.py.stdout + r.py.stderr);
      assert.deepEqual(ids(r.findings), ["A12"], r.findings.join("\n"));
    } else {
      assert.equal(r.status, 0, r.py.stdout + r.py.stderr);
      assert.deepEqual(r.findings, []);
    }
    rm(dir);
  });
}

test("A12 allows a Status value with light punctuation", () => {
  const { dir } = fixture({
    mutate: (m) => {
      supersede(m);
      m.edit(OLD_RECORD, "**Status:** superseded by 0002",
        "**Status:** superseded by 0002 (see 0002-adopt-a-queue-library.md; 2026-02-01)");
    },
  });
  const r = both(dir);
  assert.equal(r.status, 0, r.py.stdout + r.py.stderr);
  assert.deepEqual(r.findings, []);
  rm(dir);
});

test("A12 allows the prescribed reversal in a record committed with CRLF line endings", () => {
  // The \r ban is on a CR INSIDE the line. The one before the \n is the line terminator, and a
  // repo that commits CRLF would otherwise be refused the reversal the method prescribes.
  const { dir } = fixture({
    mutate: (m) => {
      const p = join(m.dir, OLD_RECORD);
      writeFileSync(p, readFileSync(p, "utf8").replace(/\n/g, "\r\n"));
      execFileSync("git", ["commit", "-qam", "crlf"], { cwd: m.dir, stdio: "pipe" });
      supersede(m);
      const q = join(m.dir, OLD_RECORD);
      assert.match(readFileSync(q, "utf8"), /\*\*Status:\*\* superseded by 0002\r\n/);
    },
  });
  const r = both(dir);
  assert.equal(r.status, 0, r.py.stdout + r.py.stderr);
  assert.deepEqual(r.findings, []);
  rm(dir);
});

test("A12 fires on a change to any line but Status, with no Status flip at all", () => {
  const { dir } = fixture({
    mutate: ({ edit }) => edit(OLD_RECORD, "**Date:** 2026-01-01", "**Date:** 2026-01-02"),
  });
  const r = both(dir);
  assert.equal(r.status, 1, r.py.stdout);
  assert.deepEqual(ids(r.findings), ["A12"], r.findings.join("\n"));
  rm(dir);
});

// ── A12 and a checkout that has no local branch ──────────────────────────────────────────────
//
// A pull request's CI checkout is a detached HEAD, and what it fetched of the default branch is
// `origin/<branch>`: `git rev-parse --verify main` is fatal there while `origin/main` resolves.
// A checker that needs a local ref to exist reds every adopting repo on its first pull request, so
// A12 tries `<branch>`, then `origin/<branch>`, and only when neither resolves says it did not
// compare.

/** Make the fixture look like a CI pull-request checkout: detached HEAD, and the default branch
 *  present only as the remote-tracking ref `origin/main`. */
function asCiCheckout(git, { keepOrigin = true } = {}) {
  if (keepOrigin) git("update-ref", "refs/remotes/origin/main", "HEAD");
  git("checkout", "--detach");
  git("branch", "-D", "main");
}

test("A12 compares against origin/<branch> when the CI checkout has no local branch", () => {
  const { dir, git } = fixture();
  asCiCheckout(git);
  const clean = both(dir);
  assert.equal(clean.status, 0, `a detached HEAD with origin/main is the standard CI shape:\n${clean.py.stdout}${clean.py.stderr}`);
  assert.deepEqual(clean.findings, []);
  rm(dir);
});

test("A12 still catches an edit to a record when the only default branch is origin/<branch>", () => {
  // Resolving the ref must mean the comparison is MADE, not merely that the "no branch" finding
  // went away: an edit has to be flagged against `origin/main`.
  const { dir, git } = fixture({ mutate: ({ edit }) => edit(OLD_RECORD, "retries are hand-written", "retries are automatic") });
  asCiCheckout(git);
  const r = both(dir);
  assert.equal(r.status, 1, r.py.stdout + r.py.stderr);
  assert.deepEqual(ids(r.findings), ["A12"], r.findings.join("\n"));
  assert.ok(r.findings.some((l) => l.startsWith(`${OLD_RECORD}:1: A12 `) && l.includes("`origin/main`")),
    r.findings.join("\n"));
  rm(dir);
});

test("A12 prefers the local branch over origin/<branch> when both exist", () => {
  // The local ref is committed WITH the edit, so it agrees with the working copy; origin/main is
  // the commit before it, which would not. No finding means the local ref was the one read.
  const { dir, git } = fixture({
    mutate: ({ edit }) => edit(OLD_RECORD, "retries are hand-written", "retries are automatic"),
    commitAfter: true,
  });
  git("update-ref", "refs/remotes/origin/main", "HEAD~1");
  const r = both(dir);
  assert.equal(r.status, 0, r.py.stdout + r.py.stderr);
  assert.deepEqual(r.findings, []);
  rm(dir);
});

test("A12 with neither <branch> nor origin/<branch> says the comparison was not made, naming both", () => {
  const { dir, git } = fixture();
  asCiCheckout(git, { keepOrigin: false });
  const r = both(dir);
  assert.equal(r.status, 1, r.py.stdout + r.py.stderr);
  assert.deepEqual(ids(r.findings), ["A12"], r.findings.join("\n"));
  assert.equal(r.findings.length, 1, r.findings.join("\n"));
  assert.match(r.findings[0], /^\.seam\/config\.json:1: A12 .*`main`.*`origin\/main`.*comparison was not made/,
    r.findings[0]);
  rm(dir);
});

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
    ["\\B", "`\\B`: matches an empty string in Node and nowhere in one in Python"],
    ["x\\B", "`\\B` again, after a literal"],
    ["[a-z-_]", "a hyphen after a range"],
    ["[a-z-]x[a-z-9]", "a hyphen in the middle of a class"],
    ["[|]", "a bare `|` in a class, which Python warns may change meaning"],
    ["[&]", "a bare `&` in a class, likewise"],
    ["[~]", "a bare `~` in a class, likewise"],
    ["[[]", "a bare `[` in a class"],
    ["\\q", "an unknown letter escape: Python refuses it, Node reads a literal"],
    ["\\Aassert", "`\\A`: Python anchors at the start of the text, Node reads a literal A — both accept it"],
    ["assert\\Z", "`\\Z`: Python anchors at the end of the text, Node reads a literal Z — both accept it"],
    ["[\\B]", "`\\B` inside a class: Node accepts it, Python raises"],
    ["[\\q]", "an unknown letter escape inside a class: Node accepts it, Python raises"],
    ["[a-\\w]", "a range ending in a class escape: Node accepts it, Python refuses"],
    // `[a-\w]` is also a descending range ('\\' sorts before 'a'), so the ordering check rejects it
    // on its own. With an endpoint that sorts below the backslash, only the endpoint check does.
    ["[A-\\w]", "the same range, ascending: only the endpoint check can refuse this one"],
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
    // A backslash before any non-alphanumeric ASCII is a plain literal in both engines.
    [String.raw`\#\[test\]`, "#[test]\nfn f() {}\n", true],
    [String.raw`assert_eq\!`, "assert_eq!(a, b)\n", true],
    [String.raw`\_\:\=\<\%\@\"\'`, "_:=<%@\"'\n", true],
    [String.raw`[\#\!]x`, "!x\n", true],
    [String.raw`[\#\!]x`, "-x\n", false],
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

test("the default assertion pattern is one constant, substituted into both checkers", () => {
  // Two hand-kept copies of it drifted undetected in review: a widening in one passed every test.
  for (const tmpl of ["checker.py.tmpl", "checker.mjs.tmpl"]) {
    const src = readFileSync(join(REPO, "skills/seam-checks/templates", tmpl), "utf8");
    assert.equal(src.split("{{DEFAULT_ASSERTION_PATTERN}}").length - 1, 1, `${tmpl} takes it once`);
    assert.ok(!src.includes("assert(?:"), `${tmpl} still carries a copy of the pattern`);
  }
  const { dir } = fixture();
  const py = readFileSync(join(dir, "scripts/check_docs.py"), "utf8")
    .match(/^DEFAULT_ASSERTION_PATTERN = r"(.+)"$/m);
  const js = readFileSync(join(dir, "scripts/check_docs.mjs"), "utf8")
    .match(/^const DEFAULT_ASSERTION_PATTERN =\s*String\.raw`(.+)`;$/m);
  assert.ok(py && js, "both emitted checkers define it");
  assert.equal(py[1], js[1]);
  assert.ok(py[1].includes("assert") && !py[1].includes("{{"));
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

test("A14 holds an absolute, .. or trailing-slash path to be no test file, the same in both", () => {
  // `/etc/hosts` exists on most machines, and Python's `ROOT / "/etc/hosts"` is `/etc/hosts`
  // where Node's join(ROOT, "/etc/hosts") is not. A trailing slash is the other way round:
  // pathlib drops it, so `spec/hives.check.mjs/` is the file in Python, while Node's stat of it
  // fails with ENOTDIR. Neither is a file path in the repo.
  const { dir } = fixture({
    mutate: ({ edit }) => edit("docs/plans/first.md",
      "| 1 | seed the hive table |",
      "| 2 | outside | `/etc/hosts` | never |\n| 3 | above | `../hives.check.mjs` | never |\n"
      + "| 4 | slash | `spec/hives.check.mjs/` | never |\n"
      + "| 1 | seed the hive table |"),
  });
  const r = both(dir);
  assert.equal(r.status, 1, r.py.stdout + r.py.stderr);
  assert.deepEqual(ids(r.findings), ["A14"], r.findings.join("\n"));
  assert.equal(r.findings.length, 3, r.findings.join("\n"));
  // The cell does hold a backticked path, so "no test path" would be the wrong thing to say.
  for (const f of r.findings) {
    assert.match(f, /not a file path inside the repo/, f);
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

// ── A15: a test arrives before the implementation it proves ──────────────────
//
// A15 reads git history, so these fixtures are repos with a branch and real commits: the clean
// tree is committed on `main` with A15 switched on, and each test then makes its own commits on
// `feat`. A15 is off in the clean fixture itself — it needs two repo-specific lists.

const A15 = {
  enabled: true, default_branch: "main",
  impl_globs: ["src/**/*.ts"], test_globs: ["tests/**/*.test.ts"],
};
const IMPL = "export const hive = 1;\n";
const TEST = "import assert from 'node:assert';\n";
const NOT_APPLICABLE =
  "A15: not applicable on main — a squash merge puts test and implementation in one commit";

/** Rewrite assertions.A15 in a fixture's config. A key set to `undefined` is left out. */
function setA15(dir, overrides = {}) {
  const p = join(dir, ".seam/config.json");
  const cfg = JSON.parse(readFileSync(p, "utf8"));
  cfg.assertions.A15 = { ...A15, ...overrides };
  writeFileSync(p, JSON.stringify(cfg, null, 2));
}

function put(dir, rel, body = IMPL) {
  mkdirSync(dirname(join(dir, rel)), { recursive: true });
  writeFileSync(join(dir, rel), body);
}

/** The clean fixture with A15 on, committed on `main`; then a branch `feat` off it. Each entry
 *  of `commits` is a map of path to body, added and committed together, or a function that does
 *  its own git work. `base` can add files to `main` first. */
function a15Repo(commits, { a15 = {}, base = null } = {}) {
  const { dir, git } = fixture({
    mutate: ({ dir: d }) => { setA15(d, a15); if (base) base(d); },
    commitAfter: true,
  });
  git("checkout", "-b", "feat");
  commits.forEach((c, i) => {
    if (typeof c === "function") { c({ dir, git }); return; }
    for (const [rel, body] of Object.entries(c)) put(dir, rel, body);
    git("add", "--", ...Object.keys(c));
    git("commit", "-m", `c${i + 1}`);
  });
  return { dir, git };
}

test("A15 flags an implementation file committed with no test in the range", () => {
  const { dir } = a15Repo([{ "src/hive.ts": IMPL }]);
  const r = both(dir);
  assert.equal(r.status, 1, r.py.stdout + r.py.stderr);
  assert.deepEqual(ids(r.findings), ["A15"], r.findings.join("\n"));
  assert.equal(r.findings.length, 1, r.findings.join("\n"));
  // Keyed on the implementation file's path and line 1. A sha in the finding would make it
  // unbaselinable, because every branch produces a fresh one.
  assert.match(r.findings[0], /^src\/hive\.ts:1: A15 /, r.findings[0]);
  assert.doesNotMatch(r.findings[0], /\b[0-9a-f]{7,40}\b/, "a finding that names a sha");
  rm(dir);
});

test("A15 passes when the test is in the same commit", () => {
  const { dir } = a15Repo([{ "tests/hive.test.ts": TEST, "src/hive.ts": IMPL }]);
  const r = both(dir);
  assert.equal(r.status, 0, r.py.stdout + r.py.stderr);
  assert.deepEqual(r.findings, []);
  rm(dir);
});

test("A15 passes when the test is in an earlier commit", () => {
  const { dir } = a15Repo([{ "tests/hive.test.ts": TEST }, { "src/hive.ts": IMPL }]);
  const r = both(dir);
  assert.equal(r.status, 0, r.py.stdout + r.py.stderr);
  assert.deepEqual(r.findings, []);
  rm(dir);
});

test("A15 flags an implementation whose test only arrives in a later commit", () => {
  // The order is the whole assertion: a test that exists at the tip of the branch proves nothing
  // about whether it was written first.
  const { dir } = a15Repo([{ "src/hive.ts": IMPL }, { "tests/hive.test.ts": TEST }]);
  const r = both(dir);
  assert.equal(r.status, 1, r.py.stdout + r.py.stderr);
  assert.deepEqual(r.findings.map((l) => l.split(" ")[0]), ["src/hive.ts:1:"], r.findings.join("\n"));
  assert.deepEqual(ids(r.findings), ["A15"]);
  rm(dir);
});

test("A15 reports not-applicable on the default branch rather than passing", () => {
  // After a squash merge the test and its implementation are always in one commit, so a silent
  // pass would be a check with no teeth pretending otherwise.
  const { dir, git } = a15Repo([{ "src/hive.ts": IMPL }]);
  git("checkout", "main");
  git("merge", "--ff-only", "feat");          // main now holds an implementation with no test
  const r = both(dir);
  assert.equal(r.status, 0, r.py.stdout + r.py.stderr);
  assert.deepEqual(r.findings, []);
  for (const [lang, res] of [["python", r.py], ["node", r.js]]) {
    assert.ok(res.stdout.split("\n").includes(NOT_APPLICABLE),
      `${lang} did not say A15 was not applicable:\n${res.stdout}`);
    // A15 reached a verdict, and the verdict was that comparing makes no sense here, so it is
    // counted: the 14 that always run, and A15.
    assert.match(res.stdout, /\b15 assertions\b/, lang);
  }
  rm(dir);
});

test("A15 enabled with a list missing or empty says the comparison was not made", () => {
  const cases = [
    ["impl_globs absent", { impl_globs: undefined }, "`impl_globs`"],
    ["test_globs empty", { test_globs: [] }, "`test_globs`"],
    ["both empty", { impl_globs: [], test_globs: [] }, "`impl_globs` and `test_globs`"],
  ];
  for (const [what, overrides, named] of cases) {
    const { dir } = a15Repo([{ "src/hive.ts": IMPL }], { a15: overrides });
    const r = both(dir);
    assert.equal(r.status, 1, `${what}: ${r.py.stdout}${r.py.stderr}`);
    assert.deepEqual(ids(r.findings), ["A15"], `${what}: ${r.findings.join("\n")}`);
    assert.equal(r.findings.length, 1, `${what}: ${r.findings.join("\n")}`);
    assert.match(r.findings[0], /^\.seam\/config\.json:1: A15 /, what);
    assert.match(r.findings[0], /comparison was not made/, what);
    assert.ok(r.findings[0].includes(named), `${what}: ${r.findings[0]}`);
    rm(dir);
  }
  // A config that cannot compare is wrong on every branch, so it does not hide behind
  // "not applicable" on the default branch.
  const { dir } = a15Repo([], { a15: { impl_globs: [] } });
  const r = both(dir);
  assert.deepEqual(ids(r.findings), ["A15"], r.findings.join("\n"));
  rm(dir);
});

test("A15 with a default branch git cannot find says the comparison was not made", () => {
  const { dir } = a15Repo([{ "src/hive.ts": IMPL }], { a15: { default_branch: "nonesuch" } });
  const r = both(dir);
  assert.equal(r.status, 1, r.py.stdout + r.py.stderr);
  assert.deepEqual(ids(r.findings), ["A15"], r.findings.join("\n"));
  assert.equal(r.findings.length, 1, r.findings.join("\n"));
  assert.match(r.findings[0], /^\.seam\/config\.json:1: A15 .*nonesuch.*comparison was not made/,
    r.findings[0]);
  // It names both forms it tried, and no longer tells the user to work around the checker by
  // hand-configuring `origin/<branch>`: resolving that is the checker's job.
  assert.match(r.findings[0], /`nonesuch` or `origin\/nonesuch`/, r.findings[0]);
  assert.doesNotMatch(r.findings[0], /CI often has only/, r.findings[0]);
  rm(dir);
});

// The same shape A12 is tested in below it: a pull request's CI checkout is a detached HEAD, and
// the only copy of the default branch it has is `origin/<branch>`.
for (const [what, commits, flagged] of [
  ["flags a late implementation", [{ "src/hive.ts": IMPL }], true],
  ["passes a test-first branch", [{ "tests/hive.test.ts": TEST }, { "src/hive.ts": IMPL }], false],
]) {
  test(`A15 ${what} when the only default branch is origin/<branch>`, () => {
    const { dir, git } = a15Repo(commits);
    git("update-ref", "refs/remotes/origin/main", "main");
    git("checkout", "--detach");
    git("branch", "-D", "main");
    const r = both(dir);
    if (flagged) {
      assert.equal(r.status, 1, r.py.stdout + r.py.stderr);
      assert.deepEqual(ids(r.findings), ["A15"], r.findings.join("\n"));
      assert.equal(r.findings.length, 1, r.findings.join("\n"));
      // The comparison was made, against the ref that exists, and the finding says which.
      assert.match(r.findings[0], /^src\/hive\.ts:1: A15 .*`origin\/main\.\.HEAD`/, r.findings[0]);
    } else {
      assert.equal(r.status, 0, r.py.stdout + r.py.stderr);
      assert.deepEqual(r.findings, []);
    }
    rm(dir);
  });
}

test("A15 on a shallow clone says the comparison was not made, not that the history is short", () => {
  // In a depth-1 clone the tip commit has no parent, so git shows every file in it as added and
  // the range looks like one enormous first commit. Comparing that would be comparing nothing.
  const { dir } = a15Repo([{ "tests/hive.test.ts": TEST }, { "src/hive.ts": IMPL }]);
  const clone = scratch("seam-shallow-");
  const g = (...args) => execFileSync("git", args, { cwd: clone, stdio: "pipe" });
  execFileSync("git", ["clone", "--quiet", "--depth", "1", "--branch", "feat", `file://${dir}`, clone],
    { stdio: "pipe" });
  g("fetch", "--quiet", "--depth", "1", "origin", "main:main");
  for (const [language, out] of [["python", "scripts/check_docs.py"], ["node", "scripts/check_docs.mjs"]]) {
    const gen = run("generate-checker.mjs", ["--repo", clone, "--language", language, "--out", out]);
    assert.equal(gen.status, 0, gen.stderr);
  }
  const r = both(clone);
  assert.equal(r.status, 1, r.py.stdout + r.py.stderr);
  assert.deepEqual(ids(r.findings), ["A15"], r.findings.join("\n"));
  assert.equal(r.findings.length, 1, r.findings.join("\n"));
  assert.match(r.findings[0], /^\.seam\/config\.json:1: A15 .*shallow.*comparison was not made/,
    r.findings[0]);
  rm(dir);
  rm(clone);
});

test("A15's finding survives the commit being rewritten, because it carries no sha", () => {
  const { dir, git } = a15Repo([{ "src/hive.ts": IMPL }]);
  const expected = [{ id: "A15", file: "src/hive.ts", line: 1, text: "src/hive.ts" }];
  for (const language of ["python", "node"]) {
    const w = check(dir, language, ["--write-baseline"]);
    assert.equal(w.status, 0, w.stderr);
    const entries = JSON.parse(readFileSync(join(dir, ".seam/baseline.json"), "utf8")).entries;
    assert.deepEqual(entries, expected, language);
  }
  const before = git("rev-parse", "HEAD").toString();
  git("commit", "--amend", "-m", "the same change under a different sha");
  assert.notEqual(git("rev-parse", "HEAD").toString(), before, "the amend did not change the sha");
  const r = both(dir);
  assert.equal(r.status, 0, r.py.stdout + r.py.stderr);
  assert.deepEqual(r.findings, []);
  assert.match(r.py.stdout, /\(1 baselined\)/);
  rm(dir);
});

test("A15 reads a detached HEAD the way it reads a branch", () => {
  const { dir, git } = a15Repo([{ "src/hive.ts": IMPL }]);
  git("checkout", "--quiet", "--detach");
  const flagged = both(dir);
  assert.deepEqual(flagged.findings.map((l) => l.split(" ")[0]), ["src/hive.ts:1:"]);
  git("checkout", "--quiet", "--detach", "main");
  const idle = both(dir);
  assert.deepEqual(idle.findings, []);
  assert.ok(idle.py.stdout.split("\n").includes(NOT_APPLICABLE), idle.py.stdout);
  assert.ok(idle.js.stdout.split("\n").includes(NOT_APPLICABLE), idle.js.stdout);
  rm(dir);
});

test("A15 does not count a rename as an implementation arriving", () => {
  const { dir } = a15Repo(
    [({ git }) => { git("mv", "src/old.ts", "src/new.ts"); git("commit", "-m", "move it"); }],
    { base: (d) => put(d, "src/old.ts", IMPL.repeat(20)) });
  const r = both(dir);
  assert.equal(r.status, 0, r.py.stdout + r.py.stderr);
  assert.deepEqual(r.findings, []);
  rm(dir);
});

test("A15 does not read what main brought into the branch as the branch's own work", () => {
  const { dir } = a15Repo([
    { "tests/hive.test.ts": TEST, "src/hive.ts": IMPL },
    ({ dir: d, git }) => {
      git("checkout", "--quiet", "main");
      put(d, "src/elsewhere.ts");
      git("add", "--", "src/elsewhere.ts");
      git("commit", "-m", "main moves on, with no test");
      git("checkout", "--quiet", "feat");
      git("merge", "--no-ff", "-m", "bring main in", "main");
    },
  ]);
  const r = both(dir);
  assert.equal(r.status, 0, r.py.stdout + r.py.stderr);
  assert.deepEqual(r.findings, []);
  rm(dir);
});

test("A15 reads a path with a space and a non-ASCII character as it is", () => {
  const { dir } = a15Repo([{ "src/hé llo.ts": IMPL }]);
  const py = check(dir, "python");
  const js = check(dir, "node");
  // `findings()` splits on non-space, so a path with a space is compared here by hand.
  const a15 = (res) => res.stderr.split("\n").filter((l) => l.includes(": A15 "));
  assert.deepEqual(a15(js), a15(py));
  assert.equal(a15(py).length, 1, py.stderr);
  assert.ok(a15(py)[0].startsWith("src/hé llo.ts:1: A15 "), a15(py)[0]);
  rm(dir);
});

test("A15 counts a file that matches both lists as a test", () => {
  const overlap = { impl_globs: ["src/**/*.ts"], test_globs: ["src/**/*.test.ts"] };
  // A test beside its implementation lives under the implementation glob too; read as an
  // implementation it would be its own missing test.
  const alone = a15Repo([{ "src/hive.test.ts": TEST }], { a15: overlap });
  const r = both(alone.dir);
  assert.equal(r.status, 0, r.py.stdout + r.py.stderr);
  assert.deepEqual(r.findings, []);
  rm(alone.dir);

  const late = a15Repo([{ "src/hive.ts": IMPL }, { "src/hive.test.ts": TEST }], { a15: overlap });
  const l = both(late.dir);
  assert.deepEqual(l.findings.map((x) => x.split(" ")[0]), ["src/hive.ts:1:"], l.findings.join("\n"));
  rm(late.dir);
});

test("A15 reports a file once, however many commits add it before a test arrives", () => {
  // Added, removed and added again: three commits touch the path, one finding is the answer.
  const { dir } = a15Repo([
    { "src/hive.ts": IMPL },
    ({ git }) => { git("rm", "--quiet", "src/hive.ts"); git("commit", "-m", "take it back out"); },
    { "src/hive.ts": IMPL },
  ]);
  const r = both(dir);
  assert.deepEqual(r.findings.map((l) => l.split(" ")[0]), ["src/hive.ts:1:"], r.findings.join("\n"));
  rm(dir);
});

test("A15 says the comparison was not made when git cannot read a commit it listed", () => {
  // A partial or damaged object store lists a commit and then cannot show what it changed.
  // Treating that as "nothing was added" would pass a branch that was never compared.
  const { dir, git } = a15Repo([{ "src/hive.ts": IMPL }]);
  const tree = git("rev-parse", "HEAD^{tree}").toString().trim();
  rmSync(join(dir, ".git", "objects", tree.slice(0, 2), tree.slice(2)));
  const r = both(dir);
  assert.equal(r.status, 1, r.py.stdout + r.py.stderr);
  assert.deepEqual(ids(r.findings), ["A15"], r.findings.join("\n"));
  assert.equal(r.findings.length, 1, r.findings.join("\n"));
  assert.match(r.findings[0], /^\.seam\/config\.json:1: A15 .*could not read.*comparison was not made/,
    r.findings[0]);
  rm(dir);
});

test("A15 is counted among the assertions that ran on the default branch and off it alike", () => {
  // The same config must print the same total on every branch, or the number says nothing about
  // the config. A15 ran on the default branch too: its verdict was "not applicable".
  const { dir, git } = a15Repo([{ "tests/hive.test.ts": TEST, "src/hive.ts": IMPL }]);
  const total = (res) => res.stdout.match(/: (\d+) assertions,/)[1];
  const onBranch = both(dir);
  git("checkout", "--quiet", "main");
  git("merge", "--ff-only", "feat");
  const onDefault = both(dir);
  assert.ok(onDefault.py.stdout.includes(NOT_APPLICABLE), onDefault.py.stdout);
  assert.equal(total(onBranch.py), "15");
  assert.equal(total(onDefault.py), total(onBranch.py));
  assert.equal(total(onDefault.js), total(onBranch.js));
  rm(dir);
});

test("A15 does not flag an implementation file the branch added and later removed", () => {
  // It is not in the tree at HEAD, so there is nothing to open and nothing to fix, and the only
  // way to clear the finding would be a baseline entry for a path that does not exist.
  const removeHive = ({ git }) => { git("rm", "--quiet", "src/hive.ts"); git("commit", "-m", "drop it"); };
  const some = a15Repo([{ "src/hive.ts": IMPL, "src/other.ts": IMPL }, removeHive]);
  const r = both(some.dir);
  assert.equal(r.status, 1, r.py.stdout + r.py.stderr);
  assert.deepEqual(r.findings.map((l) => l.split(" ")[0]), ["src/other.ts:1:"], r.findings.join("\n"));
  rm(some.dir);

  const all = a15Repo([{ "src/hive.ts": IMPL }, removeHive]);
  const a = both(all.dir);
  assert.equal(a.status, 0, a.py.stdout + a.py.stderr);
  assert.deepEqual(a.findings, []);
  // The range had commits and A15 compared them, so this is a pass and not "not applicable".
  assert.ok(!a.py.stdout.includes("not applicable"), a.py.stdout);
  rm(all.dir);
});

test("A15 reads whether a file is at HEAD from below the repo root as well", () => {
  // `--relative` makes the paths the checker sees relative to where it runs, so the presence
  // check has to be relative too.
  const { dir } = fixture({
    mutate: ({ dir: d }) => setA15(d, {}),
    commitAfter: true,
  });
  // Move the whole fixture one level down, as a project inside a larger repo.
  const outer = scratch("seam-outer-");
  const inner = join(outer, "proj");
  cpSync(dir, inner, { recursive: true });
  rmSync(join(inner, ".git"), { recursive: true, force: true });
  const og = (...args) => execFileSync("git", args, { cwd: outer, stdio: "pipe" });
  og("init", "-q", "-b", "main");
  og("config", "user.email", "test@example.com");
  og("config", "user.name", "Test");
  og("add", "-A", "--", ".");
  og("commit", "-q", "-m", "base");
  og("checkout", "-q", "-b", "feat");
  put(inner, "src/kept.ts");
  put(inner, "src/gone.ts");
  put(outer, "elsewhere/src/x.ts");
  og("add", "--", "proj/src", "elsewhere");
  og("commit", "-q", "-m", "c1");
  og("rm", "-q", "proj/src/gone.ts");
  og("commit", "-q", "-m", "c2");
  const r = both(inner);
  assert.deepEqual(r.findings.map((l) => l.split(" ")[0]), ["src/kept.ts:1:"], r.findings.join("\n"));
  rm(dir);
  rm(outer);
});

test("A15 follows an untested implementation file through a rename", () => {
  // A rename is not an arrival, but it is not a delete either: the implementation is still in the
  // tree under a new name, and a finding that named the old one would be dropped as gone.
  const body = IMPL.repeat(20);
  const rename = (from, to) => ({ dir: d, git }) => {
    mkdirSync(dirname(join(d, to)), { recursive: true });
    git("mv", from, to);
    git("commit", "-m", `${from} becomes ${to}`);
  };
  // Test last: the rename sits between the implementation and its test.
  const before = a15Repo([{ "src/a.ts": body }, rename("src/a.ts", "src/b.ts"),
    { "tests/a.test.ts": TEST }]);
  const r = both(before.dir);
  assert.deepEqual(r.findings.map((l) => l.split(" ")[0]), ["src/b.ts:1:"], r.findings.join("\n"));
  rm(before.dir);

  // The rename after the test: the walk has to keep going past the first test to see it.
  const after = a15Repo([{ "src/a.ts": body }, { "tests/a.test.ts": TEST },
    rename("src/a.ts", "src/b.ts")]);
  const a = both(after.dir);
  assert.deepEqual(a.findings.map((l) => l.split(" ")[0]), ["src/b.ts:1:"], a.findings.join("\n"));
  rm(after.dir);

  // A file renamed out of the implementation paths is no longer an implementation file.
  const out = a15Repo([{ "src/a.ts": body }, rename("src/a.ts", "lib/a.ts")]);
  const o = both(out.dir);
  assert.equal(o.status, 0, o.py.stdout + o.py.stderr);
  assert.deepEqual(o.findings, []);
  rm(out.dir);

  // Nor is one renamed into a path that matches both lists: a path matching both is a test, the
  // same rule the add path follows.
  const overlap = { impl_globs: ["src/**/*.ts"], test_globs: ["src/**/*.test.ts"] };
  const both_ = a15Repo([{ "src/a.ts": body }, rename("src/a.ts", "src/a.test.ts")], { a15: overlap });
  const b = both(both_.dir);
  assert.equal(b.status, 0, b.py.stdout + b.py.stderr);
  assert.deepEqual(b.findings, []);
  rm(both_.dir);
});

test("A15 does not flag a file that arrives after a test, however long the walk goes on", () => {
  // The walk continues past the first test while an earlier file is outstanding, so that it can
  // follow it through a rename. What arrives after the test must not be read as early.
  const { dir } = a15Repo([
    { "src/early.ts": IMPL },
    { "tests/a.test.ts": TEST },
    { "src/later.ts": IMPL },
  ]);
  const r = both(dir);
  assert.equal(r.status, 1, r.py.stdout + r.py.stderr);
  assert.deepEqual(r.findings.map((l) => l.split(" ")[0]), ["src/early.ts:1:"], r.findings.join("\n"));
  rm(dir);
});

test("A15 reads a commit's modify, rename and add entries without losing its place", () => {
  // A modification is not an arrival. And a rename entry carries two paths: a parser that took
  // it for one would read the new name as a status and drop whatever follows it in the commit.
  const { dir } = a15Repo(
    [({ dir: d, git }) => {
      put(d, "src/existing.ts", IMPL.repeat(20) + "export const more = 2;\n");
      git("mv", "src/old.ts", "src/new.ts");
      put(d, "src/zzz.ts");
      git("add", "--", "src/existing.ts", "src/zzz.ts");
      git("commit", "-m", "modify one, move one, add one");
    }],
    { base: (d) => { put(d, "src/existing.ts", IMPL.repeat(20)); put(d, "src/old.ts", IMPL.repeat(20)); } });
  const r = both(dir);
  assert.deepEqual(r.findings.map((l) => l.split(" ")[0]), ["src/zzz.ts:1:"], r.findings.join("\n"));
  rm(dir);
});

test("A15 tells a rename from a new file whatever diff.renameLimit says", () => {
  // With three inexact renames in one commit and a limit of 1, git skips rename detection and
  // reports three deletions and three additions. A repo's config must not change what A15 reads.
  const names = [1, 2, 3];
  const content = (n, extra = "") =>
    Array.from({ length: 30 }, (_, i) => `export const v${n}_${i} = ${i * n};\n`).join("") + extra;
  const { dir, git } = a15Repo(
    [({ dir: d, git: g }) => {
      for (const n of names) {
        g("mv", `src/x${n}.ts`, `src/y${n}.ts`);
        put(d, `src/y${n}.ts`, content(n, "export const extra = 1;\n"));
      }
      g("add", "--", ...names.map((n) => `src/y${n}.ts`));
      g("commit", "-m", "rename three, editing each a little");
    }],
    { base: (d) => names.forEach((n) => put(d, `src/x${n}.ts`, content(n))) });
  git("config", "diff.renameLimit", "1");
  const r = both(dir);
  assert.equal(r.status, 0, r.py.stdout + r.py.stderr);
  assert.deepEqual(r.findings, []);
  rm(dir);
});

test("A15 with a default_branch that is not a branch name says the comparison was not made", () => {
  // The text of the finding is part of its baseline key, so it must not carry the value: `null`
  // and `None` are one value printed two ways.
  for (const bad of [true, 5, "", ["main"], {}]) {
    const { dir } = a15Repo([{ "src/hive.ts": IMPL }], { a15: { default_branch: bad } });
    const r = both(dir);
    const what = JSON.stringify(bad);
    assert.equal(r.status, 1, `${what}: ${r.py.stdout}${r.py.stderr}`);
    assert.deepEqual(ids(r.findings), ["A15"], `${what}: ${r.findings.join("\n")}`);
    assert.equal(r.findings.length, 1, `${what}: ${r.findings.join("\n")}`);
    assert.match(r.findings[0], /^\.seam\/config\.json:1: A15 .*not a branch name.*comparison was not made/, what);
    const keys = [];
    for (const language of ["python", "node"]) {
      assert.equal(check(dir, language, ["--write-baseline"]).status, 0);
      keys.push(JSON.parse(readFileSync(join(dir, ".seam/baseline.json"), "utf8")).entries);
    }
    assert.deepEqual(keys[0], keys[1], `${what}: the two languages baseline it differently`);
    assert.equal(keys[0][0].text, "default_branch", what);
    rm(dir);
  }
  // `null` is unset, in both languages: the repo's own default branch is used.
  const { dir } = a15Repo([{ "src/hive.ts": IMPL }], { a15: { default_branch: null } });
  const r = both(dir);
  assert.deepEqual(r.findings.map((l) => l.split(" ")[0]), ["src/hive.ts:1:"], r.findings.join("\n"));
  rm(dir);
});

// ── A16. The config is the projection of the answers file. ───────────────────
//
// The answers file is the source and `.seam/config.json` is its projection. Editing the
// projection cost two silent reversions in one hour during this layer's design, one of which
// reached a pushed commit message as a false claim. Prose did not hold it.
//
// A16 compares **two whole-file hashes** the wizard records at projection time, rather than
// re-deriving the projection: the checker is a standalone, stdlib-only script emitted in two
// languages and cannot import `bin/seam-init.mjs`, so "re-run the projection and compare" means
// writing `project()` a second and a third time — the copies this whole layer exists to prevent.
//
// Two hashes, not one. An answers hash alone catches only the stale direction (the answers moved
// and nothing regenerated); the config's own hash is what catches the bug A16 is for, because
// hand-editing the config does not change the answers file at all.

/** Give a fixture an answers file and A16, then record the sidecar for both. */
function withProvenance(dir, { answers: ansText = null, enabled = true } = {}) {
  const cfgPath = join(dir, ".seam", "config.json");
  const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
  cfg.assertions.A16 = { enabled };
  writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + "\n");
  writeFileSync(join(dir, ".seam", "answers.json"), ansText ?? JSON.stringify({
    table: { file: "CLAUDE.md" },
    checker: { language: "python", path: "scripts/check_docs.py" },
  }, null, 2) + "\n");
  writeProvenance(dir);
}

/** Replace one top-level key of the config, as a hand-edit after emission would. */
function editConfig(dir, patch) {
  const p = join(dir, ".seam", "config.json");
  const cfg = JSON.parse(readFileSync(p, "utf8"));
  writeFileSync(p, JSON.stringify({ ...cfg, ...patch }, null, 2) + "\n");
}

test("A16 passes when the config and the answers file are the pair the provenance records", () => {
  const { dir } = fixture({ provenance: false, mutate: ({ dir }) => withProvenance(dir) });
  const r = both(dir);
  assert.equal(r.status, 0, r.py.stderr + r.py.stdout);
  assert.deepEqual(r.findings, []);
  // The apparatus has to be running, or every red case below proves nothing.
  assert.match(r.py.stdout, /15 assertions/);
  rm(dir);
});

test("A16 flags a config edited after it was emitted", () => {
  const { dir } = fixture({ provenance: false, mutate: ({ dir }) => {
    withProvenance(dir);
    editConfig(dir, { low_review_paths: ["docs/engineering.md"] });   // the hand-edit
  } });
  const r = both(dir);
  assert.equal(r.status, 1, r.py.stdout);
  assert.deepEqual(ids(r.findings), ["A16"], r.findings.join("\n"));
  assert.equal(r.findings.length, 1, r.findings.join("\n"));
  assert.match(r.findings[0], /^\.seam\/config\.json:1: A16 .*edited/);
  assert.match(r.findings[0], /answers file is the source/);
  rm(dir);
});

test("A16 flags an answers file that moved with no regeneration after it", () => {
  const { dir } = fixture({ provenance: false, mutate: ({ dir }) => {
    withProvenance(dir);
    appendFileSync(join(dir, ".seam", "answers.json"), "\n");
  } });
  const r = both(dir);
  assert.equal(r.status, 1, r.py.stdout);
  assert.deepEqual(ids(r.findings), ["A16"], r.findings.join("\n"));
  assert.match(r.findings[0], /^\.seam\/answers\.json:1: A16 .*changed since/);
  rm(dir);
});

test("A16 says the comparison was not made when no answers file is committed", () => {
  const { dir } = fixture({ provenance: false, mutate: ({ dir }) => {
    withProvenance(dir);
    rmSync(join(dir, ".seam", "answers.json"));
  } });
  const r = both(dir);
  assert.equal(r.status, 1, r.py.stdout);
  assert.deepEqual(ids(r.findings), ["A16"], r.findings.join("\n"));
  assert.match(r.findings[0], /not made/i);
  assert.match(r.findings[0], /off is distinct from passing/);
  rm(dir);
});

// ── The integrity precondition, which A16 cannot be ─────────────────────────
//
// A16's own switch lives in the file A16 protects. Measured: setting `assertions.A16.enabled` to
// false and hand-editing the config in the SAME write gave `9 assertions, 9 docs, 0 violations`
// and exit 0 — the only trace was the count falling by one. That is the cheapest defeat there is
// and the first thing a person tries when A16 reds them.
//
// The repair cannot be another assertion, because an assertion can be switched off. It is a
// precondition in the shape the allow-entry refusals already use: before the assertion loop,
// independent of every switch, exit **2** — "the comparison could not be trusted", not "a doc is
// wrong". The sidecar records the enabled set; the checker refuses to run when the live set is
// not that set.

test("the checker refuses to run when the enabled set is not the one recorded", () => {
  // The reviewer's exact measurement, as one write: A16 off and the config edited together.
  const { dir } = fixture({ provenance: false, mutate: ({ dir }) => {
    withProvenance(dir);
    const p = join(dir, ".seam", "config.json");
    const cfg = JSON.parse(readFileSync(p, "utf8"));
    cfg.assertions.A16.enabled = false;
    cfg.low_review_paths = ["docs/engineering.md"];
    writeFileSync(p, JSON.stringify(cfg, null, 2) + "\n");
  } });
  for (const lang of ["python", "node"]) {
    const res = check(dir, lang);
    assert.equal(res.status, 2, `${lang}: ${res.stdout}${res.stderr}`);
    assert.match(res.stderr, /A16/, `${lang}: the refusal does not name the switch that moved`);
    assert.match(res.stderr, /provenance\.json/, lang);
  }
  assert.equal(check(dir, "python").stderr, check(dir, "node").stderr,
    "the two checkers refuse differently");
  rm(dir);
});

test("the checker refuses to run with no record of what was enabled", () => {
  // The case a reader would skip: a config emitted before seam recorded its provenance has none,
  // and treating that as "nothing to compare" is the switch-off defeat with an extra step.
  const { dir } = fixture({ provenance: false });
  for (const lang of ["python", "node"]) {
    const res = check(dir, lang);
    assert.equal(res.status, 2, `${lang}: ${res.stdout}${res.stderr}`);
    assert.match(res.stderr, /provenance\.json/, lang);
    assert.match(res.stderr, /seam-init/, `${lang}: the refusal does not say what to run`);
  }
  rm(dir);
});

test("the precondition does not fire on a legitimate regeneration", () => {
  // Switching an assertion off is a change to the answers file, which rewrites both files — so
  // the record agrees and the run proceeds. A precondition that could not tell that apart from a
  // hand-edit would make every config change a refusal, and get switched off itself.
  const { dir } = fixture({ mutate: ({ dir: d }) => {
    const p = join(d, ".seam", "config.json");
    const cfg = JSON.parse(readFileSync(p, "utf8"));
    cfg.assertions.A4.enabled = false;
    writeFileSync(p, JSON.stringify(cfg, null, 2) + "\n");
  } });
  const r = both(dir);
  assert.equal(r.status, 0, r.py.stderr + r.py.stdout);
  assert.match(r.py.stdout, /13 assertions/);
  rm(dir);
});

test("a record that names no assertion set is refused, not read as none enabled", () => {
  for (const patch of [{ assertions_enabled: undefined }, { assertions_enabled: "A1" },
    { assertions_enabled: [1, 2] }]) {
    const { dir } = fixture({ provenance: patch });
    for (const lang of ["python", "node"]) {
      const res = check(dir, lang);
      assert.equal(res.status, 2, `${JSON.stringify(patch)} (${lang}): ${res.stdout}${res.stderr}`);
      assert.match(res.stderr, /assertions_enabled/, lang);
    }
    rm(dir);
  }
});

test("A16 flags a provenance file carrying no usable hash", () => {
  for (const patch of [{ config_sha256: "nope" }, { answers_sha256: null }, {}]) {
    const { dir } = fixture({ provenance: false, mutate: ({ dir }) => {
      withProvenance(dir);
      const p = join(dir, ".seam", "provenance.json");
      const prov = JSON.parse(readFileSync(p, "utf8"));
      for (const k of Object.keys(patch)) prov[k] = patch[k];
      if (!Object.keys(patch).length) delete prov.config_sha256;
      writeFileSync(p, JSON.stringify(prov, null, 2) + "\n");
    } });
    const r = both(dir);
    const what = JSON.stringify(patch);
    assert.equal(r.status, 1, `${what}: ${r.py.stdout}`);
    assert.deepEqual(ids(r.findings), ["A16"], `${what}: ${r.findings.join("\n")}`);
    assert.match(r.findings[0], /hash/, what);
    rm(dir);
  }
});

test("A16 off is off: a repo with no provenance and A16 disabled is green", () => {
  // An adopting repo that keeps its answers file outside the tree cannot make this comparison, so
  // the wizard leaves A16 off there. Off has to be a clean pass, or the switch is not one.
  const { dir } = fixture();
  const r = both(dir);
  assert.equal(r.status, 0, r.py.stderr + r.py.stdout);
  assert.deepEqual(r.findings, []);
  assert.match(r.py.stdout, /14 assertions/);
  rm(dir);
});

// ── A1's allow-list, and the entry that stopped doing work ───────────────────
//
// Both checkers refuse an allow entry with no reason (exit 2). Neither checked that the entry was
// still NEEDED, so the exemption machinery had the one property it exists to deny: it passed
// without making its comparison. An entry whose path now resolves exempts a path that needs no
// exemption, and if that path is later deleted the entry goes on skipping it, so A1 stays green
// over a real dangling citation.
//
// The test is "the entry suppressed nothing on this run", not "the path now resolves" — it
// subsumes it, and it gives the allow-list the property the baseline already has, where an entry
// whose line no longer matches drops out by itself.

/** Patch `assertions.A1` in a fixture's config. */
function patchA1(dir, patch) {
  const p = join(dir, ".seam", "config.json");
  const cfg = JSON.parse(readFileSync(p, "utf8"));
  cfg.assertions.A1 = { ...cfg.assertions.A1, ...patch };
  writeFileSync(p, JSON.stringify(cfg, null, 2) + "\n");
}

const CITES_AGENTS = "`AGENTS.md` is written by the build";

test("A1 flags an allow entry that suppressed nothing", () => {
  const { dir } = fixture({ mutate: ({ edit }) =>
    edit("docs/engineering.md", CITES_AGENTS, "`db/schema.sql` is written by hand") });
  const r = both(dir);
  assert.equal(r.status, 1, r.py.stdout);
  assert.deepEqual(ids(r.findings), ["A1"], r.findings.join("\n"));
  assert.equal(r.findings.length, 1, r.findings.join("\n"));
  assert.match(r.findings[0], /^\.seam\/config\.json:1: A1 .*exempts `AGENTS\.md`/);
  assert.match(r.findings[0], /cited nowhere A1 reads/);
  rm(dir);
});

test("A1 flags an allow entry whose path is now in the repo", () => {
  const { dir } = fixture({ mutate: ({ write }) => write("AGENTS.md", "# Agents\n") });
  const r = both(dir);
  assert.equal(r.status, 1, r.py.stdout);
  assert.deepEqual(ids(r.findings), ["A1"], r.findings.join("\n"));
  assert.match(r.findings[0], /^\.seam\/config\.json:1: A1 .*exempts `AGENTS\.md`, which is now in/);
  rm(dir);
});

test("A1 never consults a glob allow entry, and says so", () => {
  // A cited path containing `*` names a form and is skipped before the allow-list is read, so a
  // glob entry can exempt nothing by construction. Kept distinct from the two cases above,
  // because the fix is different: there was never anything for it to do.
  const { dir } = fixture({ mutate: ({ dir }) => patchA1(dir, { allow: [
    { path: "AGENTS.md", reason: "generated by the build, off on purpose" },
    { path: "docs/adr/*.md", reason: "a track, not a file" },
  ] }) });
  const r = both(dir);
  assert.equal(r.status, 1, r.py.stdout);
  assert.deepEqual(ids(r.findings), ["A1"], r.findings.join("\n"));
  assert.equal(r.findings.length, 1, r.findings.join("\n"));
  assert.match(r.findings[0], /exempts `docs\/adr\/\*\.md`, which is a glob/);
  rm(dir);
});

test("an empty allow list is not a finding", () => {
  // Off is not passing, and an empty list is not off: there is nothing exempted, so there is
  // nothing that could have stopped doing work. A repo with no exemptions is the normal case.
  const { dir } = fixture({ mutate: ({ dir, edit }) => {
    patchA1(dir, { allow: [] });
    edit("docs/engineering.md", CITES_AGENTS, "`db/schema.sql` is written by hand");
  } });
  const r = both(dir);
  assert.equal(r.status, 0, r.py.stderr + r.py.stdout);
  assert.deepEqual(r.findings, []);
  rm(dir);
});

test("a section heading inside a fenced block is not that section", () => {
  // A doc that QUOTES a section — a plan template shown inside a ```markdown fence, which is how
  // both of this repo's own layer-5 docs introduce `§ The units` — had its quoted heading read as
  // the real one, so A14 measured the placeholder row in the example instead of the units table
  // below it. Shared by A3, A5, A8 and A14, all of which find a section the same way.
  const quoted = [
    "```markdown",
    "## The units",
    "",
    "| # | Unit | Proves it | Done when |",
    "|---|---|---|---|",
    "| 1 | <what this unit makes true> | `<path to the test>` | <what makes it done> |",
    "```",
    "",
    "## The units",
  ].join("\n");
  const { dir } = fixture({ mutate: ({ edit }) =>
    edit("docs/plans/first.md", "## The units", quoted) });
  const r = both(dir);
  assert.equal(r.status, 0, `the quoted example was read as the section:\n${r.py.stdout}${r.py.stderr}`);
  assert.deepEqual(r.findings, []);
  rm(dir);
});

test("a table row inside a fenced block is not a row", () => {
  // The other half of the same defect. A14 and A8 read their rows off the section body, and a
  // quoted table — a plan showing the template it was written from — put a placeholder row in
  // that body. Measured on this repo's own plan: `§ The units` reported "unit 1 has no test path"
  // from a ```markdown example eighty lines below the real table.
  const units = [
    "| 1 | seed the hive table | `spec/hives.check.mjs` | the seed rows load and the count is stated |",
    "",
    "The template this came from:",
    "",
    "```markdown",
    "| # | Unit | Proves it | Done when |",
    "|---|---|---|---|",
    "| 1 | <what this unit makes true> | `<path to the test>` | <what makes it done> |",
    "```",
  ].join("\n");
  // A8's side of the same helper: a quoted issues row naming the issue the OTHER plan owns would
  // otherwise read as a second owner for #5.
  const issues = [
    "| 1 | #4 seed the database | — | nothing reads before something writes |",
    "",
    "```markdown",
    "| 1 | #5 render the week | #4 | the week reads what the seed wrote |",
    "```",
  ].join("\n");
  const { dir } = fixture({ mutate: ({ edit }) => {
    edit("docs/plans/first.md",
      "| 1 | seed the hive table | `spec/hives.check.mjs` | the seed rows load and the count is stated |",
      units);
    edit("docs/plans/first.md",
      "| 1 | #4 seed the database | — | nothing reads before something writes |", issues);
  } });
  const r = both(dir);
  assert.equal(r.status, 0, `a quoted row was read as a row:\n${r.py.stdout}${r.py.stderr}`);
  assert.deepEqual(r.findings, []);
  rm(dir);

  // And the same rows, unfenced, ARE read — so the pass above is the fence being honoured and
  // not the rows being invisible for some other reason.
  const { dir: bare } = fixture({ mutate: ({ dir: d, edit }) => {
    edit("docs/plans/first.md",
      "| 1 | seed the hive table | `spec/hives.check.mjs` | the seed rows load and the count is stated |",
      units.replaceAll("```markdown\n", "").replaceAll("\n```", ""));
    edit("docs/plans/first.md",
      "| 1 | #4 seed the database | — | nothing reads before something writes |",
      issues.replaceAll("```markdown\n", "").replaceAll("\n```", ""));
  } });
  const bareR = both(bare);
  assert.deepEqual(ids(bareR.findings), ["A14", "A8"].sort(), bareR.findings.join("\n"));
  rm(bare);
});

test("this repo's committed checker is what the template now emits", () => {
  // CI runs the COMMITTED `scripts/check_docs.mjs`, not a fresh emission, so a change to the
  // template with no regeneration after it leaves CI running the old checker — a check that
  // stopped checking the thing that was just added, with every test still green because the
  // tests generate their own. Found while bumping the version, which is the one change that makes
  // the drift visible in the file header.
  const cfg = readFileSync(join(REPO, ".seam", "config.json"), "utf8");
  const { checker } = JSON.parse(cfg);
  const dir = scratch("seam-emitted-");
  mkdirSync(join(dir, ".seam"), { recursive: true });
  writeFileSync(join(dir, ".seam", "config.json"), cfg);
  const g = run("generate-checker.mjs", ["--repo", dir, "--out", checker.path]);
  assert.equal(g.status, 0, g.stderr);
  assert.equal(readFileSync(join(dir, checker.path), "utf8"),
    readFileSync(join(REPO, checker.path), "utf8"),
    `${checker.path} is not what \`node bin/generate-checker.mjs --repo .\` emits today. The`
    + ` committed file is what CI runs, so regenerate it in the same commit as the template.`);
  rm(dir);
});

test("an allow-list entry with no usable path is refused, in both languages", () => {
  // The entry's path reached three places that read it differently: `allowed = {e["path"] …}`
  // raised KeyError in Python for a pathless entry where Node yielded `undefined`, and the
  // obsolescence arm stringified `null` to `"None"` in Python and `""` in Node — two findings
  // whose text differed, which `both()` compares. Refusing the entry outright kills all three:
  // an exemption that names nothing cannot exempt anything, and the no-reason refusal is the
  // same shape and the same exit.
  for (const [what, allow] of [
    ["no path key", [{ reason: "generated by the build" }]],
    ["a null path", [{ path: null, reason: "generated by the build" }]],
    ["an empty path", [{ path: "", reason: "generated by the build" }]],
    ["a non-string path", [{ path: 12, reason: "generated by the build" }]],
  ]) {
    const { dir } = fixture({ mutate: ({ dir: d }) => patchA1(d, { allow }) });
    for (const lang of ["python", "node"]) {
      const res = check(dir, lang);
      assert.equal(res.status, 2, `${what} (${lang}): ${res.stdout}${res.stderr}`);
      assert.match(res.stderr, /assertions\.A1\.allow\[0\]\.path/, `${what} (${lang})`);
    }
    // Identical message, not merely the same exit: the text is what a reader acts on.
    assert.equal(check(dir, "python").stderr, check(dir, "node").stderr, what);
    rm(dir);
  }
});
