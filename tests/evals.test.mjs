// The eval suite's own shape, read deterministically.
//
// `claude plugin eval` costs a model run per case, so nothing in § Checks runs it and a case that
// no longer loads is invisible until someone spends the money. The plan's own step for this was
// "run it with `--case 'nope'` and look for no `failed to load` lines" — a manual read, and a
// measured-useless one: `--case 'nope'` validates nothing (`evals/README.md` § What the graders
// can and cannot do). This file is that check, made local and offline.
//
// It is held to the **measured** grader schema in `evals/README.md` § What the graders can and
// cannot do, not to a schema read off documentation: that section was written by running each
// shape against the runner, and a key this file demanded but the runner ignores would be a second
// opinion about someone else's program.
import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { REPO } from "./helpers.mjs";

const EVALS = join(REPO, "evals");

/** The frontmatter block, as `key: value` lines plus one level of nesting. Flow lists stay
 *  strings: nothing here reads inside one, and parsing YAML properly is a dependency. */
function frontmatter(text, where) {
  assert.match(text, /^---\n/, `${where} has no frontmatter block`);
  const end = text.indexOf("\n---", 3);
  assert.ok(end > 0, `${where}'s frontmatter block is never closed`);
  const out = {};
  let parent = null;
  for (const line of text.slice(4, end).split("\n")) {
    if (line.trim() === "") continue;
    const m = /^(\s*)([\w-]+):[ \t]*(.*)$/.exec(line);
    assert.ok(m, `${where}: frontmatter line is not \`key: value\`: ${JSON.stringify(line)}`);
    const [, indent, key, raw] = m;
    const value = raw.replace(/^"(.*)"$/, "$1");
    if (indent === "") {
      if (value === "") { out[key] = {}; parent = out[key]; } else { out[key] = value; parent = null; }
    } else {
      assert.ok(parent !== null, `${where}: \`${key}\` is indented under nothing`);
      parent[key] = value;
    }
  }
  return out;
}

/** Every case directory under evals/, by name. `results/` is run output, not a case. */
function cases() {
  const out = readdirSync(EVALS, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== "results")
    .map((e) => e.name)
    .sort();
  assert.ok(out.length >= 10, `found ${out.length} eval cases, expected at least ten — the walk`
    + ` broke, and every assertion below would pass on an empty set`);
  return out;
}

// The types the runner has, measured. `tool_order` and `baseline` are in the list because the
// runner takes them, not because a case here uses one.
const TYPES = new Set(["regex", "tool_order", "tool_used", "file_exists", "llm", "baseline"]);
const SOURCES = new Set(["trace", "last_message", "files", "mock_calls"]);

test("every eval case has a prompt with a name and a tool list", () => {
  for (const name of cases()) {
    const p = join(EVALS, name, "prompt.md");
    assert.ok(existsSync(p), `evals/${name}/ has no prompt.md, so the case does not load`);
    const fm = frontmatter(readFileSync(p, "utf8"), `evals/${name}/prompt.md`);
    assert.equal(fm.name, name,
      `evals/${name}/prompt.md calls itself \`${fm.name}\` — the name selects the case on the`
      + ` command line, so a mismatch is a case nobody can run by its directory`);
    assert.match(String(fm.allowed_tools ?? ""), /^\[.*\]$/,
      `evals/${name}/prompt.md names no allowed_tools, and the runner pre-flights graders against`
      + ` that list`);
    // There is no working scaffold hook on this build, so a case that names one has a fixture
    // nothing builds — it is rejected in prompt.md frontmatter and silent in case.yaml.
    assert.ok(!("scaffold_script" in fm),
      `evals/${name}/prompt.md names a scaffold_script, which does not work on this build`);
  }
});

test("every grader declares a type the runner has, with the keys that type needs", () => {
  let graded = 0;
  for (const name of cases()) {
    const dir = join(EVALS, name, "graders");
    assert.ok(existsSync(dir), `evals/${name}/ has no graders, so the case can only score 1.00`);
    const files = readdirSync(dir).filter((f) => f.endsWith(".md")).sort();
    assert.ok(files.length, `evals/${name}/graders/ is empty`);
    for (const f of files) {
      const where = `evals/${name}/graders/${f}`;
      const fm = frontmatter(readFileSync(join(dir, f), "utf8"), where);
      graded += 1;
      assert.ok(TYPES.has(fm.type), `${where} declares type \`${fm.type}\`, which the runner does`
        + ` not have — the types are ${[...TYPES].sort().join(", ")}, and there is no script grader`);
      if ("weight" in fm) {
        assert.match(String(fm.weight), /^\d+(?:\.\d+)?$/,
          `${where}'s weight is \`${fm.weight}\`, which is not a number`);
      }
      if (fm.type === "regex") {
        assert.ok(typeof fm.pattern === "string" && fm.pattern,
          `${where} is a regex grader with no pattern`);
      }
      if (fm.type === "tool_used") {
        assert.ok(typeof fm.tool === "string" && fm.tool,
          `${where} is a tool_used grader naming no tool`);
      }
      if (fm.type === "file_exists") {
        assert.ok(typeof fm.path === "string" && fm.path,
          `${where} is a file_exists grader naming no path`);
      }
      // A target or focus is either one of the four sources or `{source: file, path: …}`. A file
      // target that does not exist makes the grader THROW rather than pass quietly, so a
      // malformed one is a case that reds for the wrong reason.
      for (const key of ["target", "focus"]) {
        if (!(key in fm)) continue;
        const v = fm[key];
        if (typeof v === "string") {
          assert.ok(SOURCES.has(v), `${where}'s ${key} is \`${v}\`, which is not one of `
            + `${[...SOURCES].sort().join(", ")} and not a file form`);
        } else {
          assert.equal(v.source, "file",
            `${where}'s ${key} is a map whose source is \`${v.source}\`, and the only map form is`
            + ` {source: file, path: …}`);
          assert.ok(typeof v.path === "string" && v.path,
            `${where}'s ${key} names source: file with no path`);
        }
      }
    }
  }
  assert.ok(graded >= 25, `read ${graded} graders, expected at least twenty-five`);
});

test("every case that measures a skill asserts the skill fired", () => {
  // Without it, a run where the plugin never fired is indistinguishable from a wrong answer — and
  // that is the difference the whole suite exists to measure.
  for (const name of cases()) {
    const dir = join(EVALS, name, "graders");
    const fired = readdirSync(dir).filter((f) => f.endsWith(".md")).some((f) => {
      const fm = frontmatter(readFileSync(join(dir, f), "utf8"), `evals/${name}/graders/${f}`);
      return fm.type === "tool_used" && fm.tool === "Skill";
    });
    assert.ok(fired, `evals/${name}/ has no \`tool_used: Skill\` grader, so a run where the`
      + ` plugin never fired would score the same as one where it answered wrongly`);
  }
});
