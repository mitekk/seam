// Every action `seam-build` and `seam-github` prescribe, performed as the templates instruct, in
// a `madr` adopter and a `single` adopter, with the repo's own generated checker green after each
// one — in both emitted languages.
//
// This exists because the class has shipped twice and review caught it both times, not a test:
//
// 1. A12 and A13 were mutually unsatisfiable on the DEFAULT (MADR) format. The method's own
//    prescribed reversal — flipping `**Status:** accepted` to `superseded by 0002` — fired A12's
//    byte-freeze.
// 2. A ruling written exactly as `docs/building.md` instructs red A13 in a MADR repo, because the
//    prescribed shape omitted `**Status:**`.
//
// Twice is a class: the templates get written against whichever ADR format the author had in
// mind, and until now nothing exercised the other one.
//
// The adopter follows the **documented** day-one flow, `--write-baseline` included (README
// § The baseline), because a plan written from the layer-5 template carries a placeholder unit
// row and A14 reads it: the fresh repo's one violation is that placeholder, recorded as a debt
// with a number on it. The assertion below pins that it is exactly that one, so the baseline
// cannot quietly grow to cover a prescribed action's own breakage.
import { test } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { scratch, rm, write, run } from "./helpers.mjs";

const TODAY = "2026-11-01";

function adopterAnswers(format) {
  return {
    seam_version: "0.1.0",
    purpose: "A scratch adopter, used to perform every action the skills prescribe.",
    users: "The test suite.",
    repo: { name: "apiary", default_branch: "main" },
    field: "greenfield",
    field_reason: "a scratch adopter created empty by this test, with no docs before the wizard.",
    table: { file: "CLAUDE.md" },
    checker: { language: "node", path: "scripts/check_docs.mjs" },
    adr: format === "madr"
      ? { format: "madr", dir: "docs/adr" }
      : { format: "single", file: "docs/decisions.md" },
    prd: { dir: "docs/prd", version: 1 },
    artifacts: [],
    docs: [
      { path: "docs/engineering.md", layer: 2, owns: "The stack", enforces: "", create: true },
      // The five NAMED layer-2 templates. `maximal()` in tests/seam-init.test.mjs renders them
      // and never runs a checker; `adopter()` ran a checker and rendered only the generic
      // `current/doc.md`. So "a shipped template that reds A1 on an adopter's day one" — the
      // class of two defects this task fixed — was untested for exactly these five.
      { path: "docs/building.md", layer: 2, owns: "The start and finish contracts", enforces: "", create: true },
      { path: "docs/context.md", layer: 2, owns: "The context thresholds and the dispatch rule", enforces: "", create: true },
      { path: "docs/routing.md", layer: 2, owns: "Model and effort per artifact", enforces: "", create: true },
      { path: "docs/taxonomy.md", layer: 2, owns: "The domains, the priorities and the milestones", enforces: "", create: true },
      { path: "docs/reviewing.md", layer: 2, owns: "The review level and the rounds", enforces: "", create: true },
      format === "madr"
        ? { path: "docs/adr/*.md", layer: 3, owns: "What was chosen, and why", enforces: "", create: true }
        : { path: "docs/decisions.md", layer: 3, owns: "What was chosen, and why", enforces: "", create: true },
      { path: "docs/prd/*.md", layer: 4, owns: "What we are trying to build", enforces: "", create: true },
      { path: "docs/plans/first.md", layer: 5, owns: "Nothing — the first subsystem's units", enforces: "", create: true },
      { path: "docs/findings-ledger.md", layer: 6, owns: "Nothing — what we noticed and will not do", enforces: "", create: true },
    ],
    load_bearing: [],
    low_review_paths: [],
    domains: [{ name: "hives", covers: "The one subsystem this repo has" }],
    milestones: [{ n: 2, title: "Queenless list", green: "its tests pass", active: true }],
    agents: [],
    assertions: {},
    date: TODAY,
  };
}

/** A complete six-layer adopter in one ADR format, both checkers generated, committed, baselined. */
function adopter(format) {
  const dir = scratch(`seam-prescribed-${format}-`);
  const git = (...args) => execFileSync("git", args, { cwd: dir, stdio: "pipe" });
  git("init", "-b", "main");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test");
  const af = write(dir, ".seam/answers.json", JSON.stringify(adopterAnswers(format), null, 2) + "\n");
  const w = run("seam-init.mjs", ["--answers", af, "--repo", dir]);
  assert.equal(w.status, 0, `${format}: ${w.stderr}`);
  for (const [language, out] of [["python", "scripts/check_docs.py"], ["node", "scripts/check_docs.mjs"]]) {
    const g = run("generate-checker.mjs", ["--repo", dir, "--language", language, "--out", out]);
    assert.equal(g.status, 0, `${format} (${language}): ${g.stderr}`);
  }
  git("add", "-A");
  git("commit", "-m", "adopt the seam doc layers");
  const b = run("generate-checker.mjs", ["--repo", dir, "--write-baseline"]);
  assert.equal(b.status, 0, `${format}: ${b.stderr}`);

  // What the fresh repo is carrying, named rather than assumed: the layer-5 template's own
  // placeholder unit row, which has no test path because the units are not written yet.
  const baseline = JSON.parse(readFileSync(join(dir, ".seam/baseline.json"), "utf8")).entries;
  assert.deepEqual(baseline.map((e) => [e.id, e.file]), [["A14", "docs/plans/first.md"]],
    `${format}: a fresh adoption carries drift this test does not account for: `
    + JSON.stringify(baseline));
  return { dir, git };
}

function checkerRun(dir, language) {
  const script = language === "python" ? "scripts/check_docs.py" : "scripts/check_docs.mjs";
  const argv = language === "python" ? ["python3", "-I", script] : [process.execPath, script];
  try {
    return { status: 0, out: execFileSync(argv[0], [...argv.slice(1)], { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) };
  } catch (e) {
    return { status: e.status ?? 1, out: (e.stdout?.toString() ?? "") + (e.stderr?.toString() ?? "") };
  }
}

/** Both emitted checkers, green, or the prescribed action that just ran is the finding. */
function stillGreen(dir, what) {
  for (const language of ["python", "node"]) {
    const r = checkerRun(dir, language);
    assert.equal(r.status, 0,
      `after "${what}" the ${language} checker is red, so the method prescribes an action that `
      + `breaks its own check:\n${r.out}`);
  }
}

function edit(dir, rel, from, to) {
  const p = join(dir, rel);
  const body = readFileSync(p, "utf8");
  assert.ok(body.includes(from), `${rel} does not contain ${JSON.stringify(from)}`);
  writeFileSync(p, body.replace(from, to));
}

// A short record, the shape `adr-madr/template.md` gives and no longer: Task 4's re-review
// established that "keep it short" is achievable, and a ruling longer than the deviation it
// records is the ceremony the proportionality rule exists to cut.
const madrRecord = (n, title, body) => `# ${n}. ${title}

**Date:** ${TODAY}
**Status:** accepted
**Deciders:** apiary maintainers

## Context

${body}

## Outcome

The repo now does the thing above.

## Consequences

- **Good:** the next session does not decide it again.
- **Bad:** one more record to read.
- **Enforced by:** nothing, yet.
`;

const ISSUE_BODY = "The list shows every hive in the apiary.\n\n"
  + "**Context** — `docs/plans/first.md` § The issues\n\n"
  + "### Acceptance criteria\n- [ ] the list shows only queenless hives\n";

/**
 * `seam-github` § Issues: the body is written to a file and passed with `--body-file`, because an
 * inline body mangles on shell quoting. **Where** it goes is the part that carries weight: it is
 * a scratch file and not a document, so it goes outside the tree.
 *
 * The first version of this step only wrote it outside, which made the checker's result identical
 * before and after by construction — a prescribed action that could not fail, inside the test
 * written to close that class. So the row under `docs/` is asserted to red A10 first: that is the
 * reason the prescription puts it somewhere else, and now it is measured rather than commented.
 */
function openTheIssue(dir, outside) {
  write(dir, "docs/issue-12.md", ISSUE_BODY);
  for (const language of ["python", "node"]) {
    const r = checkerRun(dir, language);
    assert.equal(r.status, 1,
      `${language}: an issue body written under docs/ left the checker green, so nothing holds a`
      + ` document there to having a row:\n${r.out}`);
    assert.match(r.out, /A10/, r.out);
    assert.match(r.out, /docs\/issue-12\.md/, r.out);
  }
  rmSync(join(dir, "docs", "issue-12.md"));
  write(outside, "issue-12.md", ISSUE_BODY);
}

/** The actions, per format, each performed the way the templates and the skills instruct. */
const PRESCRIBED = {
  madr: [
    ["write a ruling", (dir) => {
      write(dir, "docs/adr/0002-ruling-the-queue-stays-a-plain-table.md",
        madrRecord("0002", "Ruling — the queue stays a plain table",
          "A queue library was reached for mid-unit. The deviation was ruled on and the work went on."));
    }],
    ["record a direction correction", (dir) => {
      write(dir, "docs/adr/0003-correction-no-second-email.md",
        madrRecord("0003", "Direction correction — no second email",
          "A corrective second send was being built. The answer was not that way, said in session."));
    }],
    ["record a reversal", (dir) => {
      // The prescribed reversal: a NEW record, and the old one's Status line names it. Its
      // substance stays byte-identical, which is the exemption A12 carries for exactly this.
      write(dir, "docs/adr/0004-reverse-the-plain-table.md",
        madrRecord("0004", "Reverse 0002 — the queue moves to a library",
          "0002 held while the queue was one consumer. It is three now, so it is reversed here."));
      edit(dir, "docs/adr/0002-ruling-the-queue-stays-a-plain-table.md",
        "**Status:** accepted", "**Status:** superseded by 0004");
    }],
    ["append a ledger row", (dir) => {
      appendFileSync(join(dir, "docs/findings-ledger.md"),
        `| ${TODAY} | \`hives\` | CI installs dependencies twice, about forty seconds a run. |\n`);
    }],
    ["open the issue a disposition calls for", openTheIssue],
  ],
  single: [
    ["write a ruling", (dir) => {
      // The single-file track's shape: a dated `## ` section, with the ruling as a `### ` under
      // it. Appended, which is what A12's prefix check for this one file exists to allow.
      appendFileSync(join(dir, "docs/decisions.md"), `
## R-001 — rulings taken while building the queenless list

*${TODAY} · in flight*

### Ruling — the queue stays a plain table

A queue library was reached for mid-unit. **Settled:** the queue stays a plain table. **Costs if
wrong:** a second consumer would want the library after all.
`);
    }],
    ["record a direction correction", (dir) => {
      // Appended to the same dated section, which is still the last thing in the file — the
      // asymmetry with MADR, where the record is frozen the moment it lands.
      appendFileSync(join(dir, "docs/decisions.md"), `
### Direction correction — no second email

A corrective second send was being built. **Asked for instead:** one send, ever. Said ${TODAY}.
`);
    }],
    ["record a reversal", (dir) => {
      appendFileSync(join(dir, "docs/decisions.md"), `
## D-002 — the queue moves to a library, reversing R-001

*${TODAY} · settled*

R-001 held while the queue had one consumer. It has three now.

**Settled:** a library. **Rejected:** staying on the table, which R-001 chose and this supersedes.

**Enforced by:** nothing, yet.
`);
    }],
    ["append a ledger row", (dir) => {
      appendFileSync(join(dir, "docs/findings-ledger.md"),
        `| ${TODAY} | \`hives\` | CI installs dependencies twice, about forty seconds a run. |\n`);
    }],
    ["open the issue a disposition calls for", openTheIssue],
  ],
};

for (const format of ["madr", "single"]) {
  test(`every action the skills prescribe leaves the checker green in a ${format} repo`, () => {
    const { dir } = adopter(format);
    const outside = scratch("seam-prescribed-scratch-");
    stillGreen(dir, `a fresh ${format} adoption, before any action`);
    for (const [what, perform] of PRESCRIBED[format]) {
      perform(dir, outside);
      stillGreen(dir, `${what} (${format})`);
    }
    rm(outside);
    rm(dir);
  });
}

test("a MADR record is frozen the moment it lands, so rulings are one record each", () => {
  // The open question Ruling 27 left for this fixture: does a MADR repo batch a plan's worth of
  // in-flight rulings into one record, or write a numbered record per ruling?
  //
  // Measured here, and it is not a matter of taste. A batch record is appendable only while the
  // branch is in flight. The moment it is on the default branch A12 freezes its bytes — only the
  // Status line may move — so the next ruling cannot go in it, and a prescription to batch is a
  // prescription that works until the first merge and then fails. A record per ruling cannot be
  // reopened by construction, and it gives each ruling a number to be cited by, which
  // `superseded by NNNN` and every cross-reference need.
  const { dir, git } = adopter("madr");

  // In flight: three rulings in one uncommitted record, appended to as they are taken. Legal.
  const batch = "docs/adr/0002-rulings-in-flight.md";
  write(dir, batch, madrRecord("0002", "Rulings taken while building the queenless list",
    "### Ruling 1 — the queue stays a plain table"));
  stillGreen(dir, "a batch record, uncommitted, with one ruling in it");
  appendFileSync(join(dir, batch), "\n### Ruling 2 — the list filters in SQL\n");
  stillGreen(dir, "a batch record, uncommitted, appended to");

  // Landed. Now the same append is an edit to bytes already on the branch.
  git("add", "-A");
  git("commit", "-m", "docs(adr): the rulings taken while building the queenless list");
  stillGreen(dir, "the batch record, landed and untouched");
  appendFileSync(join(dir, batch), "\n### Ruling 3 — the empty state is a sentence\n");
  for (const language of ["python", "node"]) {
    const r = checkerRun(dir, language);
    assert.equal(r.status, 1,
      `${language}: appending a ruling to a landed MADR record passed, so A12 is not freezing `
      + `records and the reason for one-record-per-ruling is gone:\n${r.out}`);
    assert.match(r.out, /A12/, `${language}: something other than A12 objected:\n${r.out}`);
    assert.match(r.out, new RegExp(batch.replace(/[.]/g, "\\.")), r.out);
  }
  rm(dir);
});
