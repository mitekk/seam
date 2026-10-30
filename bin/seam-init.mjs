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

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
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
  need(typeof a.checker?.path === "string" && a.checker.path, "checker.path",
    "name the path the emitted checker is written to");
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
  });

  const lb = Array.isArray(a.load_bearing) ? a.load_bearing : [];
  need(Array.isArray(a.load_bearing), "load_bearing", "must be a list of globs (may be empty)");
  need(Array.isArray(a.low_review_paths), "low_review_paths",
    "must be a list of paths (empty is the default, and is the right answer for most repos)");

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

  if (bad.length) die(bad[0]);
}

// ── The config projection ─────────────────────────────────────────────────────
//
// config = answers minus the prose keys, plus defaults for the machine keys the answers leave
// unset. One key namespace, no translation step — which is what lets the interview's record and
// the script's input be the same document.

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

function defaultAssertions(a) {
  const layers = new Set((a.docs ?? []).map((d) => d.layer));
  const has = (n) => layers.has(n);
  const artifacts = a.artifacts ?? [];
  return {
    // A1, A2 and A10 run everywhere: a citation a reader cannot open is a defect whatever the
    // layer, and a doc missing from the table is drift by definition.
    A1: { enabled: true, allow: [] },
    A2: { enabled: true },
    // A3 compares two sides. Until a workflow exists and someone confirms it is wired, the
    // comparison would be vacuous — so it is off, and off is distinct from passing.
    A3: { enabled: false, doc_sections: [], workflow_glob: ".github/workflows/*.yml" },
    A4: { enabled: artifacts.length > 0, artifacts },
    A5: { enabled: false, vocabularies: [] },
    A6: { enabled: false, retired: [] },
    A7: { enabled: false, reversed: [] },
    A8: { enabled: has(5), plan_glob: "docs/plans/*.md" },
    A9: { enabled: false, count_sites: [] },
    A10: { enabled: true },
    A11: { enabled: true },
    A12: { enabled: has(3) || has(4), default_branch: a.repo?.default_branch ?? "main" },
    A13: { enabled: has(3) || has(4) },
  };
}

function project(a) {
  const assertions = { ...defaultAssertions(a) };
  for (const [id, override] of Object.entries(a.assertions ?? {})) {
    assertions[id] = { ...(assertions[id] ?? {}), ...override };
  }
  // Explicit key order, so two runs on one answers file produce one byte sequence.
  const cfg = {
    seam_version: a.seam_version ?? "0.1.0",
    repo: a.repo ?? { name: basename(process.cwd()), default_branch: "main" },
    table: a.table,
    checker: a.checker,
    adr: a.adr,
    prd: a.prd ?? { dir: "docs/prd", version: 1 },
    artifacts: a.artifacts ?? [],
    docs: stripProse(a.docs, PROSE_SUBKEYS.docs),
    load_bearing: a.load_bearing,
    low_review_paths: a.low_review_paths,
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
  const planRow = (a.docs ?? []).find((d) => d.layer === 5);
  const artifact = (a.artifacts ?? [])[0];
  return {
    date: a.date ?? new Date().toISOString().slice(0, 10),
    repo: cfg.repo,
    table: cfg.table,
    checker: { path: cfg.checker.path, language: cfg.checker.language },
    adr: { ...cfg.adr, citation: adrCitation },
    prd: { dir: prdDir, version, next_version: version + 1, current: `${prdDir}/PRD-current.md` },
    plans: { dir: planRow ? dirname(planRow.path) : "docs/plans" },
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

function writeDoc(w, a, vars, d) {
  const v = { ...vars, doc: { path: d.path, owns: d.owns, title: titleFor(d.path) } };
  switch (d.layer) {
    case 1:
      // Layer 1 is the code. Writing it would be writing the thing the docs are about.
      return;
    case 2:
      w.create(d.path, render(tmpl("current/doc.md"), v));
      return;
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
  try {
    answers = JSON.parse(readFileSync(args.answers, "utf8"));
  } catch (e) {
    die(`cannot read ${args.answers}: ${e.message}`);
  }
  validate(answers);

  const cfg = project(answers);
  const vars = templateVars(answers, cfg);
  const w = new Writer(args.repo, args.dryRun);

  w.put(".seam/config.json", JSON.stringify(cfg, null, 2) + "\n");

  for (const d of answers.docs) {
    if (d.create === false) {
      // The wizard was told this file is the user's. It still gets a table row — the table is
      // about ownership of a question, not about who typed the file.
      if (!existsSync(join(args.repo, d.path))) w.gap(d.path);
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
