#!/usr/bin/env node
// seam-init — the wizard's deterministic half.
//
// The interview is a model's job: reading a repo, proposing what each file owns, asking what
// cannot be read off the tree. This program is the other half — it takes the *recorded* answers
// and writes exactly what they say, byte-for-byte reproducibly.
//
// That split is why `--answers` is a first-class mode rather than a test hook. It makes the
// wizard evaluable, it lets an adoption re-run in CI, and it means `.seam/config.json` is
// produced by a program with no judgment in it.
//
// Usage:
//   node bin/seam-init.mjs --answers <answers.json> --repo <dir> [--dry-run]
//
// Exit codes: 0 wrote (or would write), 2 the answers file is not valid.
//
// No dependencies, by the rule in docs/contributing.md § Hard conventions.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, basename, sep, relative, resolve, isAbsolute } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATES = join(HERE, "..", "skills", "seam-docs", "templates");

const LAYERS = {
  1: { name: "Artifact", rule: "changes with the code" },
  2: { name: "Current", rule: "amend in place" },
  3: { name: "Decisions", rule: "append-only, dated; a reversal is a new entry" },
  4: { name: "Intent", rule: "immutable versions; supersede with vN+1" },
  5: { name: "Seam", rule: "superseded wholesale" },
  6: { name: "Ledger", rule: "append-only rows" },
};

// Keys that carry a human's words. They reach the docs and never the machine config: a config is
// read by a script, and a script has no use for a sentence it cannot check.
const PROSE_KEYS = ["purpose", "open_questions", "users", "in_scope", "out_of_scope"];
const PROSE_SUBKEYS = { docs: ["owns"], domains: ["covers"], milestones: ["green"], agents: ["covers"] };

// Beside the config, written by the same run: the two hashes assertion A16 compares, so that a
// hand-edited config and a config whose answers file moved under it are both loud rather than
// silently reverted by the next regeneration. It is provenance ABOUT the projection and not part
// of it, which is why it is a sidecar: `project()` stays a pure function of the answers, and the
// config keeps the one-key-namespace property the interview's schema documents.
const PROVENANCE_PATH = ".seam/provenance.json";

const sha256 = (data) => createHash("sha256").update(data).digest("hex");

/** The answers file's path relative to the repo, or null when it is outside the tree. A16 can
 *  only compare what a later run can read back, so "outside" is what switches it off. */
function answersInRepo(repo, answersPath) {
  const rel = relative(resolve(repo), resolve(answersPath));
  if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) return null;
  return rel.split(sep).join("/");
}

const MARK_START = "<!-- seam:sources-of-truth start -->";
const MARK_END = "<!-- seam:sources-of-truth end -->";

function die(msg) {
  process.stderr.write(`seam-init: ${msg}\n`);
  process.exit(2);
}

function parseArgs(argv) {
  const out = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--answers") out.answers = argv[++i];
    else if (a === "--repo") out.repo = argv[++i];
    else if (a === "--dry-run") out.dryRun = true;
    else die(`unknown argument ${a}`);
  }
  if (!out.answers) die("--answers <file> is required");
  out.repo = out.repo ?? process.cwd();
  return out;
}

// ── The schema ────────────────────────────────────────────────────────────────
//
// Validated before anything is written, and a failure names the key path rather than the shape.
// A rejected run writes nothing at all: a half-written doc layer is worse than none, because the
// table would then claim ownership of files that are not there.

function validate(a) {
  const bad = [];
  const need = (cond, key, why) => { if (!cond) bad.push(`${key}: ${why}`); };

  need(a && typeof a === "object", "<root>", "the answers file must be a JSON object");
  if (bad.length) die(bad[0]);

  need(typeof a.table?.file === "string" && a.table.file, "table.file",
    "name the file that hosts the sources-of-truth table (usually CLAUDE.md)");
  need(["python", "node"].includes(a.checker?.language), "checker.language",
    `must be "python" or "node", not ${JSON.stringify(a.checker?.language)}`);
  // `checker.path` is optional and defaults from the language — the interview asks which
  // language, not which filename, and an answers file built from the documented question set
  // exited 2 on this key before. When it IS given, the extension has to match the language, or
  // the one that runs is whichever CI invokes.
  if (a.checker?.path !== undefined) {
    const ext = a.checker.language === "python" ? ".py" : ".mjs";
    need(typeof a.checker.path === "string" && a.checker.path.endsWith(ext), "checker.path",
      `${JSON.stringify(a.checker.path)} does not end in ${ext}, so the language and the`
      + ` filename disagree — and the one that runs is whichever CI invokes`);
  }
  need(["madr", "single"].includes(a.adr?.format), "adr.format",
    `must be "madr" or "single", not ${JSON.stringify(a.adr?.format)}`);
  if (a.adr?.format === "madr") {
    need(typeof a.adr.dir === "string" && a.adr.dir, "adr.dir", "the madr format needs a directory");
  } else if (a.adr?.format === "single") {
    need(typeof a.adr.file === "string" && a.adr.file, "adr.file", "the single format needs a file");
  }
  need(Array.isArray(a.docs) && a.docs.length > 0, "docs", "at least one doc row is required");

  (a.docs ?? []).forEach((d, i) => {
    need(typeof d.path === "string" && d.path, `docs[${i}].path`, "a doc row needs a path");
    need(Number.isInteger(d.layer) && d.layer >= 1 && d.layer <= 6, `docs[${i}].layer`,
      `layer must be 1..6, not ${JSON.stringify(d.layer)} — the interview question is "what`
      + ` happens when this file turns out to be wrong?"`);
    need(typeof d.owns === "string", `docs[${i}].owns`, "a doc row needs what it owns, in words");
    // A glob row names a FORM — the several files a track or a directory holds — so the wizard
    // cannot write one: the file would be called `*.md`. Layers 3 and 4 are exempt because their
    // row path is a label and the track's own directory drives the writes.
    if (d.create !== false && typeof d.path === "string" && d.path.includes("*")
        && d.layer !== 3 && d.layer !== 4) {
      bad.push(`docs[${i}].path: ${d.path} is a glob, and a glob cannot be created — it names a`
        + ` form, not a file. Name the file, or set "create": false and let the row cover what`
        + ` is already there`);
    }
  });

  // Both default to empty when absent. `low_review_paths` is documented as defaulting to `[]`,
  // and `load_bearing` is the question most repos answer with "nothing, yet".
  const lb = a.load_bearing ?? [];
  need(a.load_bearing === undefined || Array.isArray(a.load_bearing), "load_bearing",
    "must be a list of globs, or absent, which means empty");
  need(a.low_review_paths === undefined || Array.isArray(a.low_review_paths), "low_review_paths",
    "must be a list of paths, or absent, which means empty — and empty is the right answer for"
    + " most repos");

  // Optional by construction. Most repos have nothing to take down after a merge beyond the
  // branch itself, so absent and "" both mean "deleting the branch is the whole teardown", and an
  // empty answer is a complete one rather than a key nobody filled in. A non-string is the one
  // answer that can mean neither: a list would have to be sequenced by whoever ran it, and the
  // skill runs what this key names, as written.
  need(a.teardown_command === undefined || typeof a.teardown_command === "string",
    "teardown_command",
    `must be one shell command as a string, not ${JSON.stringify(a.teardown_command)} — or absent,`
    + ` which means the repo has no teardown step beyond deleting the branch`);
  // "One shell command" is what the interview asks for and what the skill runs, as written, so a
  // value carrying a newline is two commands whose order would be the caller's to guess. A repo
  // with two things to take down writes a script and names the script here.
  if (typeof a.teardown_command === "string" && /[\r\n]/.test(a.teardown_command)) {
    bad.push(`teardown_command: carries a newline, so it is more than one command — put the`
      + ` sequence in a script of the repo's own and name that script here`);
  }

  // A15 compares two lists, and one without the other is a comparison with one side empty: it
  // could only ever fail, or only ever pass. The checker reports an enabled A15 with an empty
  // list; this catches the half-answered interview before a config is written at all.
  const a15 = a.assertions?.A15;
  if (a15 && typeof a15 === "object") {
    const keys = ["impl_globs", "test_globs"];
    for (const k of keys) {
      need(a15[k] === undefined || Array.isArray(a15[k]), `assertions.A15.${k}`,
        "must be a list of path globs");
    }
    need(a15.default_branch === undefined || (typeof a15.default_branch === "string" && a15.default_branch),
      "assertions.A15.default_branch", "must be the name of a branch");
    for (const [k, other] of [keys, keys.slice().reverse()]) {
      need(a15[k] === undefined || a15[other] !== undefined, `assertions.A15.${other}`,
        `${k} is given and ${other} is not — A15 compares the two, so it needs both`);
    }
  }

  (a.artifacts ?? []).forEach((art, i) => {
    need(typeof art.path === "string" && art.path, `artifacts[${i}].path`, "an artifact needs a path");
    // Layer 1 wins over every doc on what is true now, so an artifact carries weight by
    // construction. One that is absent from load_bearing would be a layer-1 row whose Enforces
    // cell names something the config says is not load-bearing — A11's two sides, disagreeing on
    // the day they are written.
    need(lb.includes(art.path), `artifacts[${i}].path`,
      `${art.path} is a layer-1 artifact but is not in load_bearing — layer 1 wins over every`
      + ` doc, so it is load-bearing by construction`);
  });

  // The follow-up qualifier's third clause is "it blocks the active milestone", and a clause can
  // only be checked against one fact. So `active` is a boolean on every row — not truthy, not
  // absent-means-false, which would give a config whose key means different things on different
  // rows — and exactly one row is true. Zero milestones is fine: the build order is asked for,
  // and "none yet" is an answer.
  need(a.milestones === undefined || Array.isArray(a.milestones), "milestones",
    "must be a list, or absent, which means none yet");
  const ms = Array.isArray(a.milestones) ? a.milestones : [];
  ms.forEach((m, i) => {
    // `n` and `title` are the table's first two columns, built from the row rather than
    // substituted per key — so a row without them renders `| undefined | undefined |`.
    need(isLabel(m?.n), `milestones[${i}].n`,
      "a milestone needs its number — it is the first column of the table this row builds, and a"
      + " row without it renders as `| undefined |`");
    need(isLabel(m?.title), `milestones[${i}].title`,
      "a milestone needs its title, for the same reason as its number");
    const got = m?.active === undefined ? "missing" : JSON.stringify(m.active);
    need(typeof m?.active === "boolean", `milestones[${i}].active`,
      `must be true or false, not ${got} — exactly one milestone is active, and every row says`
      + ` whether it is. Mark the one being built now with "active": true and every other row`
      + ` "active": false`);
  });
  if (ms.length && ms.every((m) => typeof m?.active === "boolean")) {
    const on = ms.flatMap((m, i) => (m.active ? [i] : []));
    if (on.length === 0) {
      bad.push(`milestones[].active: none of the milestones is active — exactly one`
        + ` must be, because the follow-up qualifier's third clause ("blocks the active`
        + ` milestone") reads it. Mark the one being built now with "active": true`);
    } else if (on.length > 1) {
      bad.push(`milestones[${on[1]}].active: milestones[${on[0]}] is already active — exactly one`
        + ` milestone is active at a time, so the qualifier's third clause has one thing to check`
        + ` against`);
    }
  }

  // `agents[]` had no validation block at all, and neither did `domains[]`. Both reach a template,
  // and the two leak differently: `agent/agent.md` substitutes per key, and `render()` returns an
  // unresolved `{{key}}` as itself, so a row with no `model` writes `model: {{agent.model}}` into
  // the frontmatter the harness parses to choose that agent's model — and `{{` opens a YAML flow
  // mapping, so the block does not parse at all and the agent does not load. The taxonomy tables
  // are built from their rows instead, so a row with no label renders the literal `undefined`.
  // Both are this program writing a broken artifact into a repo and exiting 0.
  //
  // `covers` on a DOMAIN row and `green` on a milestone row are deliberately not here: each has an
  // honest `_not recorded_` fallback, which is the wizard saying what it was not told rather than
  // writing a value it does not have. `covers` on an AGENT row is required, because it is that
  // agent's `description:` and the template substitutes it per key.
  const AGENT_KEYS = {
    name: "the agent's filename and its `name:` frontmatter",
    covers: "the agent's `description:`, which is what a dispatch matches on",
    model: "the `model:` frontmatter the harness reads to choose the model",
    effort: "the `effort:` frontmatter the harness reads to choose the level",
  };
  need(a.agents === undefined || Array.isArray(a.agents), "agents",
    "must be a list, or absent, which means the repo named no agents — which is a complete answer");
  (Array.isArray(a.agents) ? a.agents : []).forEach((g, i) => {
    for (const [k, why] of Object.entries(AGENT_KEYS)) {
      need(typeof g?.[k] === "string" && g[k], `agents[${i}].${k}`,
        `${why}. The template substitutes it per key, so a row without it writes`
        + ` \`{{agent.${k}}}\` into the repo as itself`);
    }
  });

  need(a.domains === undefined || Array.isArray(a.domains), "domains",
    "must be a list, or absent, which means none yet");
  (Array.isArray(a.domains) ? a.domains : []).forEach((d, i) => {
    need(typeof d?.name === "string" && d.name, `domains[${i}].name`,
      "a domain row needs its label — the taxonomy table is built from the rows, so a row with no"
      + " name renders as `| `undefined` |` and the doc carries a label nobody can apply");
  });

  if (bad.length) die(bad[0]);
}

/** A table cell's value: a non-empty string, or a number. Anything else renders as `undefined`. */
function isLabel(v) {
  return (typeof v === "string" && v !== "") || (typeof v === "number" && Number.isFinite(v));
}

// ── The config projection ─────────────────────────────────────────────────────
//
// config = answers minus the prose keys, plus defaults for the machine keys the answers leave
// unset. One key namespace, no translation step — which is what lets the interview's record and
// the script's input be the same document.

/** A path glob as a regex. `**\/` crosses directories, `*` and `?` do not. */
function globRe(pattern) {
  let out = "";
  let i = 0;
  while (i < pattern.length) {
    if (pattern.startsWith("**/", i)) { out += "(?:.*/)?"; i += 3; }
    else if (pattern[i] === "*") { out += "[^/]*"; i += 1; }
    else if (pattern[i] === "?") { out += "[^/]"; i += 1; }
    else { out += pattern[i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); i += 1; }
  }
  return new RegExp("^" + out + "$");
}

/** Does anything in the repo satisfy this row? A glob row is satisfied by a match, not by a file
 *  literally named `docs/rules/*.md` — which is what `existsSync` on the pattern asked. */
function rowHasFiles(repo, rowPath) {
  if (!rowPath.includes("*")) return existsSync(join(repo, rowPath));
  const rx = globRe(rowPath);
  const skip = new Set([".git", "node_modules", "dist", "build", ".next", "vendor", ".venv"]);
  const walk = (dir) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return false; }
    if (dir !== repo && entries.some((e) => e.name === ".git")) return false;
    for (const e of entries) {
      if (e.isSymbolicLink()) continue;
      const abs = join(dir, e.name);
      if (e.isDirectory()) {
        if (skip.has(e.name)) continue;
        if (walk(abs)) return true;
      } else if (rx.test(relative(repo, abs).split(sep).join("/"))) {
        return true;
      }
    }
    return false;
  };
  return walk(repo);
}

function stripProse(value, subkeys) {
  if (Array.isArray(value)) return value.map((v) => stripProse(v, subkeys));
  if (value && typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value)) {
      if (subkeys?.includes(k)) continue;
      out[k] = value[k];
    }
    return out;
  }
  return value;
}

/** The layer-5 row paths: one string when there is one, the list when there are several. */
function layer5Globs(a) {
  const paths = (a.docs ?? []).filter((d) => d.layer === 5).map((d) => d.path);
  if (!paths.length) return "docs/plans/*.md";
  return paths.length === 1 ? paths[0] : paths;
}

function defaultAssertions(a, answersRel) {
  const layers = new Set((a.docs ?? []).map((d) => d.layer));
  const has = (n) => layers.has(n);
  const artifacts = a.artifacts ?? [];
  return {
    // A1, A2 and A10 run everywhere: a citation a reader cannot open is a defect whatever the
    // layer, and a doc missing from the table is drift by definition.
    // `intent_globs` names the docs whose citations are intentions rather than claims — an
    // implementation plan names the files it will create. Defaults to the plan directory a
    // writing-plans workflow uses, because that is the one place it is true by construction.
    A1: { enabled: true, allow: [], intent_globs: ["docs/superpowers/plans/*.md"] },
    A2: { enabled: true },
    // A3 compares two sides. Until a workflow exists and someone confirms it is wired, the
    // comparison would be vacuous — so it is off, and off is distinct from passing.
    A3: { enabled: false, doc_sections: [], workflow_glob: ".github/workflows/*.yml" },
    A4: { enabled: artifacts.length > 0, artifacts },
    A5: { enabled: false, vocabularies: [] },
    A6: { enabled: false, retired: [] },
    A7: { enabled: false, reversed: [] },
    // The glob comes from the layer-5 rows themselves. Hardcoding `docs/plans/*.md` switched A8
    // on against a directory that did not exist the moment a repo put its plans anywhere else —
    // enabled, and comparing nothing, which is the shape "off is not passing" objects to.
    A8: { enabled: has(5), plan_glob: layer5Globs(a) },
    A9: { enabled: false, count_sites: [] },
    A10: { enabled: true },
    A11: { enabled: true },
    A12: { enabled: has(3) || has(4), default_branch: a.repo?.default_branch ?? "main" },
    A13: { enabled: has(3) || has(4) },
    // A14 reads the same plans A8 does, so it takes the same glob for the same reason.
    A14: { enabled: has(5), plan_glob: layer5Globs(a) },
    // A15 compares two repo-specific lists — which paths are implementation and which are tests —
    // and an empty list is not a sensible default, so it is off until the interview has both.
    A15: {
      enabled: false,
      default_branch: a.repo?.default_branch ?? "main",
      impl_globs: [],
      test_globs: [],
    },
    // On iff the answers file is inside the repo, because that is the only case where a later
    // run can read it back and compare. A repo that keeps its answers file elsewhere gets A16
    // off rather than a permanent red — and pays for it by having its config's provenance
    // unchecked, which `references/assertions.md` § A16 states as the cost it is.
    A16: { enabled: answersRel !== null },
  };
}

function project(a, answersRel = null) {
  const assertions = { ...defaultAssertions(a, answersRel) };
  for (const [id, override] of Object.entries(a.assertions ?? {})) {
    assertions[id] = { ...(assertions[id] ?? {}), ...override };
  }
  // Explicit key order, so two runs on one answers file produce one byte sequence.
  const cfg = {
    seam_version: a.seam_version ?? "0.1.0",
    repo: a.repo ?? { name: basename(process.cwd()), default_branch: "main" },
    table: a.table,
    checker: {
      language: a.checker.language,
      path: a.checker.path
        ?? (a.checker.language === "python" ? "scripts/check_docs.py" : "scripts/check_docs.mjs"),
    },
    adr: a.adr,
    prd: a.prd ?? { dir: "docs/prd", version: 1 },
    artifacts: a.artifacts ?? [],
    docs: stripProse(a.docs, PROSE_SUBKEYS.docs),
    load_bearing: a.load_bearing ?? [],
    low_review_paths: a.low_review_paths ?? [],
    // Always present, so the skill's conditional has something to read either way: "" is the
    // repo saying the branch delete is the whole teardown, not a key the interview skipped.
    teardown_command: a.teardown_command ?? "",
    domains: stripProse(a.domains ?? [], PROSE_SUBKEYS.domains),
    milestones: stripProse(a.milestones ?? [], PROSE_SUBKEYS.milestones),
    agents: stripProse(a.agents ?? [], PROSE_SUBKEYS.agents),
    assertions,
    baseline: a.baseline ?? { path: ".seam/baseline.json" },
  };
  for (const k of PROSE_KEYS) delete cfg[k];
  return cfg;
}

// ── Rendering ─────────────────────────────────────────────────────────────────

function render(tmpl, vars) {
  return tmpl.replace(/\{\{([\w.]+)\}\}/g, (whole, path) => {
    const v = path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), vars);
    return v === undefined || v === null ? whole : String(v);
  });
}

function titleFor(path) {
  return basename(path, ".md")
    .replace(/^PRD-/, "PRD ")
    .replace(/[-_]/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

function bullets(list, empty) {
  const items = (list ?? []).filter(Boolean);
  if (!items.length) return empty;
  return items.map((x) => `- ${x}`).join("\n");
}

function templateVars(a, cfg) {
  const adrCitation = a.adr.format === "madr"
    ? `the records under \`${a.adr.dir}/\``
    : `\`${a.adr.file}\``;
  const prdDir = cfg.prd.dir;
  const version = cfg.prd.version ?? 1;
  // EVERY layer-5 directory, deduped, in row order — not the first row's. A repo with two layer-5
  // rows (a specs track and a plans track, which is this repo's own shape) got a doc naming
  // whichever came first and omitting the other, and A1 cannot see it: it is a directory, not a
  // `*.md` citation. `layer5Globs` above already reads all of them.
  const planDirs = [...new Set((a.docs ?? []).filter((d) => d.layer === 5)
    .map((d) => dirname(d.path)))];
  const artifact = (a.artifacts ?? [])[0];
  const agents = a.agents ?? [];
  // Every agent row carries both levels or the run was refused (`validate`), so there is no
  // unpinned state to render here. The `—` in this table is the literal cell on the rows the
  // template fixes — planning, review — and it means "not pinned by this repo".
  return {
    date: a.date ?? new Date().toISOString().slice(0, 10),
    repo: cfg.repo,
    table: cfg.table,
    checker: { path: cfg.checker.path, language: cfg.checker.language },
    adr: { ...cfg.adr, citation: adrCitation },
    // A citation, like `adr.citation` and `artifact.citation`: a repo with no layer-4 row has no
    // PRD file, so a backticked path to one is a citation A1 reds on the day the doc is written —
    // measured on a fresh two-layer adoption, two findings before anyone had typed anything.
    prd: {
      dir: prdDir,
      version,
      next_version: version + 1,
      current: `${prdDir}/PRD-current.md`,
      citation: (a.docs ?? []).some((d) => d.layer === 4)
        ? `\`${prdDir}/PRD-current.md\``
        : "wherever this repo writes it down",
    },
    // A phrase, not a path, for the same reason `adr.citation` is one: with several directories
    // there is nothing for a template's own pair of backticks to wrap, and with none there is no
    // directory to name at all.
    plans: {
      citation: planDirs.length
        ? "under " + planDirs.map((x) => `\`${x}\``).join(" and ")
        : "wherever this repo writes its plans down",
    },
    artifact: {
      citation: artifact ? `\`${artifact.path}\`` : "the code itself (layer 1)",
      path: artifact?.path ?? "",
    },
    purpose: a.purpose ?? "_Not recorded. `/seam:init` asks for this; it is never inferred._",
    purpose_short: (a.purpose ?? "not recorded").replace(/\s+/g, " ").slice(0, 80),
    users: a.users ?? "_Not recorded — an open question, not an assumption._",
    in_scope: bullets(a.in_scope, "_Not recorded yet._"),
    out_of_scope: bullets(a.out_of_scope, "_Not recorded yet._"),
    open_questions: bullets(
      (a.open_questions ?? []).map((q) => `**Open question:** ${q}`),
      "_None recorded._",
    ),
    first_domain: (a.domains ?? [])[0]?.name ?? "docs",
    domains_table: (a.domains ?? []).length
      ? (a.domains ?? []).map((d) => `| \`${d.name}\` | ${d.covers ?? "_not recorded_"} |`).join("\n")
      : "| _none recorded_ | `/seam:init` asks for these; they are never inferred |",
    milestones_table: (a.milestones ?? []).length
      ? (a.milestones ?? []).map((m) =>
          `| ${m.n} | ${m.title} | ${m.green ?? "_not recorded_"} | ${m.active ? "yes" : "no"} |`)
          .join("\n")
      : "| — | _none recorded_ | _the build order is asked for, not inferred_ | — |",
    // The levels the answers pin are written into the doc that claims to be their only copy, the
    // same way the taxonomy doc's tables are. The program knows them — it writes them into each
    // agent's frontmatter and into the config — so a hand-fill instruction would leave the
    // authoritative table as the one place they are missing.
    implement_rows: agents.length
      ? agents.map((g) => `| Implement — ${g.name} | \`.claude/agents/${g.name}.md\` `
          + `| \`${g.model}\` | \`${g.effort}\` |`).join("\n")
      : "| Implement | `.claude/agents/<name>.md` | — | — |",
    // A header over no rows reads as a table someone forgot to fill, and an empty list is a real
    // answer here, so the whole block is the variable rather than just its rows.
    agents_table: agents.length
      ? [
          "| Agent | Scope | Reads before changing |",
          "|---|---|---|",
          ...agents.map((g) => `| \`${g.name}\` | ${g.covers ?? "_not recorded_"} `
            + "| `<the source-of-truth row it is accountable to>` |"),
        ].join("\n")
      : "**This repo named no agents**, so there is no table here — an empty list is a complete\n"
        + "answer, for the reason above. The day one is written it gets a row, with the model and\n"
        + "the effort it is pinned to.",
  };
}

// ── The table ─────────────────────────────────────────────────────────────────
//
// Four columns, in this order: Doc | Layer | Owns | Enforces. A11 reads Enforces as column 4.
// The table's own host file may be a row in it, and usually should be.

// What a layer-1 row owns, read off the artifact's parser rather than invented. A generic
// "what the machine does" is true of every artifact and therefore tells a reader nothing.
const ARTIFACT_OWNS = {
  sql: "The schema, its constraints and its vocabularies — wins over every doc",
  ts: "The types and unions — wins over every doc",
  none: "What the machine does — wins over every doc",
};

function tableBlock(a, vars) {
  const rows = [];
  for (const art of a.artifacts ?? []) {
    rows.push([`\`${art.path}\``, "1 Artifact", ARTIFACT_OWNS[art.parser] ?? ARTIFACT_OWNS.none,
      `\`${art.path}\``]);
  }
  for (const d of a.docs) {
    rows.push([
      `\`${d.path}\``,
      `${d.layer} ${LAYERS[d.layer].name}`,
      d.owns.replace(/\|/g, "\\|"),
      d.enforces ? `\`${d.enforces}\`` : "",
    ]);
  }
  const body = rows.map((r) => `| ${r[0]} | ${r[1]} | ${r[2]} | ${r[3]} |`).join("\n");
  const ownNothing = [...new Set(a.docs.filter((d) => d.layer >= 5).map((d) => d.layer))]
    .sort()
    .map((n) => `${n} ${LAYERS[n].name}`);
  return `${MARK_START}

Every doc under \`docs/\` is in this table with a layer, or it is drift (assertion A10). A lower
layer **cites** a higher one and never restates it.

| Doc | Layer | Owns | Enforces |
|---|---|---|---|
${body}

**Layer** fixes the edit rule, because the question behind it is *what happens when this file
turns out to be wrong*:

| # | Layer | When it's wrong | Edit rule |
|---|---|---|---|
| 1 | Artifact | cannot be — it *is* the code | ${LAYERS[1].rule} |
| 2 | Current | a bug | ${LAYERS[2].rule} |
| 3 | Decisions | never — the record stands | ${LAYERS[3].rule} |
| 4 | Intent | expected | ${LAYERS[4].rule} |
| 5 | Seam | expected | ${LAYERS[5].rule} |
| 6 | Ledger | n/a | ${LAYERS[6].rule} |

**Enforces** names the artifact that holds a row to its word — a constraint, an index, a CI
assertion. An empty cell means the row owns documentation and nothing more. \`.seam/config.json\`
carries the same set as \`load_bearing\`, and assertion A11 compares the two.

Authority is not one chain, because the layers answer different questions:

- **On what is true now:** Artifact beats Current, and nothing else may answer at all.
- **On why it is this way:** Decisions beat Current. A Current doc that gives a rationale cites
  the record rather than restating it.
- **On what we intend:** Intent beats Seam.
- **Seam and Ledger own nothing** and lose to everything by construction. They are in this table
  so they are *findable*, not because they answer anything — here that is ${ownNothing.length ? ownNothing.join(" and ") : "layers 5 and 6"}.

<!-- seam:sources-of-truth end -->`;
}

function tableHost(existing, block, vars) {
  if (existing === null) {
    // A greenfield host file is the repo's context file, not a document called "Sources of
    // truth". Give it a title and one line saying what it is, then the section.
    return `# ${vars.repo.name}\n\n`
      + `Context for anyone — person or agent — working in this repo. The table below is the one\n`
      + `place that says which document answers which question; read the row before changing\n`
      + `anything it covers.\n\n`
      + `## Sources of truth — read before changing related code\n\n${block}\n`;
  }
  const s = existing.indexOf(MARK_START);
  const e = existing.indexOf(MARK_END);
  if (s !== -1 && e !== -1 && e > s) {
    return existing.slice(0, s) + block + existing.slice(e + MARK_END.length);
  }
  const sep = existing.endsWith("\n") ? "\n" : "\n\n";
  return `${existing}${sep}## Sources of truth — read before changing related code\n\n${block}\n`;
}

// ── The writer ────────────────────────────────────────────────────────────────

class Writer {
  constructor(repo, dryRun) {
    this.repo = repo;
    this.dryRun = dryRun;
    this.lines = [];
  }
  note(verb, rel) {
    this.lines.push(`${this.dryRun ? "would write" : verb}  ${rel}`);
  }
  /** Write a file that this program owns. Never clobbers: an existing file is the user's. */
  create(rel, body) {
    const p = join(this.repo, rel);
    if (existsSync(p)) {
      this.lines.push(`kept  ${rel}  (exists — the wizard never rewrites a doc's body)`);
      return false;
    }
    this.note("wrote", rel);
    if (!this.dryRun) {
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, body);
    }
    return true;
  }
  /** Replace a file this program owns outright (the config, and the table host's marked span). */
  put(rel, body) {
    this.note("wrote", rel);
    if (!this.dryRun) {
      const p = join(this.repo, rel);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, body);
    }
  }
  readIfExists(rel) {
    const p = join(this.repo, rel);
    return existsSync(p) ? readFileSync(p, "utf8") : null;
  }
  gap(rel) {
    this.lines.push(`missing  ${rel}  (a table row with no file — write it, or drop the row)`);
  }
  report() {
    return this.lines.join("\n") + "\n";
  }
}

function tmpl(rel) {
  return readFileSync(join(TEMPLATES, rel), "utf8");
}

function existsTemplate(rel) {
  return existsSync(join(TEMPLATES, rel));
}

function writeDoc(w, a, vars, d) {
  const v = { ...vars, doc: { path: d.path, owns: d.owns, title: titleFor(d.path) } };
  switch (d.layer) {
    case 1:
      // Layer 1 is the code. Writing it would be writing the thing the docs are about.
      return;
    case 2: {
      // A layer-2 doc whose name says what it owns gets the template for that, rather than the
      // generic one: a repo's taxonomy, its review policy and its build contract have a shape,
      // and a blank layer-2 doc asking the user to invent one is the wizard not doing its job.
      const named = {
        "taxonomy.md": "current/taxonomy.md",
        "reviewing.md": "current/reviewing.md",
        "routing.md": "current/routing.md",
        "building.md": "current/building.md",
        "context.md": "current/context.md",
      };
      const special = named[basename(d.path)];
      w.create(d.path, render(tmpl(special && existsTemplate(special) ? special : "current/doc.md"), v));
      return;
    }
    case 3:
      if (a.adr.format === "madr") {
        w.create(join(a.adr.dir, "README.md"), render(tmpl("adr-madr/README.md"), v));
        w.create(join(a.adr.dir, "template.md"), tmpl("adr-madr/template.md"));
        w.create(
          join(a.adr.dir, "0001-adopt-the-seam-doc-layers.md"),
          render(tmpl("adr-madr/0001-adopt-the-seam-doc-layers.md"), v),
        );
      } else {
        w.create(a.adr.file, render(tmpl("adr-single/decisions.md"), v));
      }
      return;
    case 4: {
      const dir = vars.prd.dir;
      const vn = `PRD-v${vars.prd.version}.md`;
      const body = render(tmpl("prd/PRD-vN.md"), v);
      w.create(join(dir, vn), body);
      // PRD-current carries the full active text rather than a pointer, so that one read answers
      // "what are we building".
      w.create(join(dir, "PRD-current.md"), render(tmpl("prd/PRD-current.md"), { ...v, prd_body: body }));
      w.create(join(dir, "README.md"), render(tmpl("prd/README.md"), v));
      return;
    }
    case 5:
      w.create(d.path, render(tmpl("plan/plan.md"), v));
      return;
    case 6:
      w.create(d.path, render(tmpl("ledger/findings-ledger.md"), v));
      return;
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  let answers;
  let answersBytes;
  try {
    answersBytes = readFileSync(args.answers);
    answers = JSON.parse(answersBytes.toString("utf8"));
  } catch (e) {
    die(`cannot read ${args.answers}: ${e.message}`);
  }
  validate(answers);

  const answersRel = answersInRepo(args.repo, args.answers);
  const cfg = project(answers, answersRel);
  const vars = templateVars(answers, cfg);
  const w = new Writer(args.repo, args.dryRun);

  const cfgBody = JSON.stringify(cfg, null, 2) + "\n";
  w.put(".seam/config.json", cfgBody);
  // Hashed as the bytes on disk, both of them, so the comparison A16 makes needs no knowledge of
  // how either file was serialised — the trap in asking a second language to re-derive it.
  w.put(PROVENANCE_PATH, JSON.stringify({
    seam_version: cfg.seam_version,
    answers: answersRel,
    answers_sha256: sha256(answersBytes),
    config_sha256: sha256(cfgBody),
    // The set the emitted checker refuses to run without agreeing with. A16's own switch lives in
    // the file A16 protects, so flipping it and editing the config in one write was silent — the
    // cheapest defeat there is. This is the record the checker's integrity precondition compares
    // against, and a precondition rather than an assertion precisely because an assertion can be
    // switched off.
    assertions_enabled: Object.keys(cfg.assertions)
      .filter((k) => cfg.assertions[k]?.enabled).sort(),
  }, null, 2) + "\n");

  for (const d of answers.docs) {
    if (d.create === false) {
      // The wizard was told this file is the user's. It still gets a table row — the table is
      // about ownership of a question, not about who typed the file.
      if (!rowHasFiles(args.repo, d.path)) w.gap(d.path);
      continue;
    }
    writeDoc(w, answers, vars, d);
  }

  for (const agent of answers.agents ?? []) {
    w.create(
      join(".claude", "agents", `${agent.name}.md`),
      render(tmpl("agent/agent.md"), { ...vars, agent }),
    );
  }

  const host = answers.table.file;
  const block = tableBlock(answers, vars);
  w.put(host, tableHost(w.readIfExists(host), block, vars));

  process.stdout.write(w.report());
}

main();
