// Shared fixture helpers for the test suite. No dependencies: node:test and node:assert only.
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");

/** A scratch directory that the caller is responsible for removing. */
export function scratch(prefix = "seam-test-") {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function rm(dir) {
  rmSync(dir, { recursive: true, force: true });
}

export function write(dir, rel, body) {
  const p = join(dir, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, body);
  return p;
}

export function read(dir, rel) {
  return readFileSync(join(dir, rel), "utf8");
}

export function has(dir, rel) {
  return existsSync(join(dir, rel));
}

/** A git repo with one commit, so assertions that need a default branch have one. */
export function gitRepo(prefix = "seam-git-") {
  const dir = scratch(prefix);
  const git = (...args) => execFileSync("git", args, { cwd: dir, stdio: "pipe" });
  git("init", "-b", "main");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test");
  writeFileSync(join(dir, ".gitkeep"), "");
  git("add", "-A");
  git("commit", "-m", "init");
  return { dir, git };
}

/** Run a bin/ program. Returns { status, stdout, stderr } and never throws on a non-zero exit. */
export function run(script, args, opts = {}) {
  try {
    const stdout = execFileSync(process.execPath, [join(REPO, "bin", script), ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      ...opts,
    });
    return { status: 0, stdout, stderr: "" };
  } catch (e) {
    return {
      status: e.status ?? 1,
      stdout: e.stdout?.toString() ?? "",
      stderr: e.stderr?.toString() ?? "",
    };
  }
}

/** The minimal answers file every test starts from, with the six layers all present. */
export function answers(overrides = {}) {
  return {
    seam_version: "0.1.0",
    purpose: "A scratch repo used to prove the wizard writes what it says it writes.",
    repo: { name: "scratch", default_branch: "main" },
    field: "greenfield",
    field_reason: "a scratch repo with nothing in it but the two files this fixture seeds.",
    table: { file: "CLAUDE.md" },
    checker: { language: "python", path: "scripts/check_docs.py" },
    adr: { format: "madr", dir: "docs/adr" },
    prd: { dir: "docs/prd", version: 1 },
    artifacts: [{ path: "db/schema.sql", parser: "sql" }],
    docs: [
      {
        path: "docs/engineering.md",
        layer: 2,
        owns: "Stack, data access, API shape, test priority order, security",
        enforces: "",
        create: true,
      },
      {
        path: "docs/adr/*.md",
        layer: 3,
        owns: "What was chosen, the options rejected, and why",
        enforces: "",
        create: true,
      },
      {
        path: "docs/prd/*.md",
        layer: 4,
        owns: "What we are trying to build",
        enforces: "",
        create: true,
      },
      {
        path: "docs/plans/first-subsystem.md",
        layer: 5,
        owns: "Nothing — which units build the first subsystem, in what order",
        enforces: "",
        create: true,
      },
      {
        path: "docs/findings-ledger.md",
        layer: 6,
        owns: "Nothing — true observations that are not becoming work",
        enforces: "",
        create: true,
      },
    ],
    load_bearing: ["db/schema.sql"],
    low_review_paths: [],
    domains: [{ name: "core", covers: "The one subsystem this scratch repo has" }],
    milestones: [{ n: 2, title: "First subsystem", green: "its tests pass", active: true }],
    agents: [],
    assertions: {},
    open_questions: ["Whether this repo needs a second domain."],
    ...overrides,
  };
}
