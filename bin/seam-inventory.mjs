#!/usr/bin/env node
// seam-inventory — the adopt path's evidence gathering.
//
// A repo that already has docs already has an answer to most of the interview, and it is written
// down somewhere — usually in two places that disagree. Working out which is which is a judgment
// and stays with the model. Collecting the evidence it judges on is procedural, so this is a
// program: it reads the tree and prints JSON, and it never writes anything.
//
// Nothing here is asserted. A layer arrives as `layer_guess`, with `why` — the evidence for it —
// so the model can show the user a proposal rather than a conclusion. The strongest evidence
// available is the edit history: a file amended in place for two years is layer 2; one only ever
// appended to is layer 3 or 6. That is a fact about the tree, which is the only kind of fact this
// program is allowed to produce.
//
// Usage: node bin/seam-inventory.mjs --repo <dir> [--table <file>]
//
// No dependencies, by the rule in docs/contributing.md § Hard conventions.

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, relative, dirname, basename, posix } from "node:path";
import { execFileSync } from "node:child_process";

function parseArgs(argv) {
  const out = { repo: process.cwd(), table: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--repo") out.repo = argv[++i];
    else if (argv[i] === "--table") out.table = argv[++i];
    else {
      process.stderr.write(`seam-inventory: unknown argument ${argv[i]}\n`);
      process.exit(2);
    }
  }
  return out;
}

const SKIP_DIRS = new Set([".git", "node_modules", "dist", "build", ".next", "vendor",
  "__pycache__", ".venv", "venv", "target", ".turbo", "coverage"]);

function walk(root, dir = root, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  // A nested checkout is another repo's tree: its docs are not this repo's docs and its schema is
  // not this repo's artifact. Measured on a repo with seven worktrees under .claude/worktrees/,
  // which contributed 67 of 75 "artifacts" before this. A worktree carries a `.git` FILE, a
  // vendored clone a `.git` directory, so the test is existence rather than type.
  if (dir !== root && entries.some((e) => e.name === ".git")) return out;
  for (const e of entries) {
    if (e.isSymbolicLink()) continue;
    const abs = join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(root, abs, out);
    } else if (e.isFile()) {
      out.push(relative(root, abs).split(/[\\/]/).join("/"));
    }
  }
  return out;
}

// ── Markdown reading ─────────────────────────────────────────────────────────

function headings(text) {
  const out = [];
  for (const m of text.matchAll(/^#{1,6}[ \t]+(.*)$/gm)) {
    const h = m[1].replace(/~~/g, "").replace(/\*\*/g, "").replace(/\*/g, "")
      .replace(/`/g, "").trim();
    if (h) out.push(h);
  }
  return out;
}

function headingLevels(text) {
  const out = [];
  for (const m of text.matchAll(/^(#{1,6})[ \t]+(.*)$/gm)) {
    const h = m[2].replace(/~~/g, "").replace(/\*\*/g, "").replace(/\*/g, "")
      .replace(/`/g, "").trim();
    if (h) out.push({ level: m[1].length, text: h });
  }
  return out;
}

/** Every name a section of this file can legitimately be cited by: the full heading, and its
 *  first clause — a citation names the section, not its dated suffix. */
/** Every name a section of this file can legitimately be cited by.
 *
 *  The full heading; its first clause, because a citation names the section and not its dated
 *  suffix; and every leading word-sequence of it, because people cite "§ Contact" when the
 *  heading is "Contact and identification". Measured: without the leading sequences, a real repo
 *  reported 934 dangling section citations, nearly all of them that one shape — and a baseline
 *  with 934 entries is not a ratchet. The cost is recall on a citation that names only a
 *  heading's first word, which nobody writes. */
function anchors(text) {
  const out = new Set();
  for (const h of headings(text)) {
    out.add(h.toLowerCase());
    const core = h.split(/ — |, /)[0].trim();
    if (core) out.add(core.toLowerCase());
    // Every dash-separated clause, not only the first: "D-012 — Geometry and spacing" is cited
    // as § Geometry as often as it is cited as § D-012.
    for (const clause of h.split(" — ")) {
      const c = clause.trim();
      if (!c) continue;
      out.add(c.toLowerCase());
      const words = c.toLowerCase().split(/\s+/).filter(Boolean);
      for (let k = 1; k <= words.length; k++) out.add(words.slice(0, k).join(" "));
    }
  }
  return out;
}

/** A citation carries the prose that follows it, so a match is the longest anchor it starts
 *  with, ending on a word boundary: "Seams" does not satisfy "Seam 9". */
function citesSection(set, cited) {
  const low = cited.split(/\s+/).join(" ").toLowerCase().replace(/\)+$/, "").trim();
  for (const a of [...set].sort((x, y) => y.length - x.length)) {
    if (low.startsWith(a) && (low.length === a.length || !/[a-z0-9]/i.test(low[a.length]))) {
      return true;
    }
  }
  return false;
}

const MD_CITE = /`([\w./-]+\.md)`/g;
// `path.md` § Name, where the name runs straight on into the sentence around it.
const PATH_SECTION = /`([\w./-]+\.md)`[\s,*]{0,4}§[ \t\n]*([A-Za-z][^.;:—(*`§\n]*)/g;
const BARE_SECTION = /§[ \t]*([A-Za-z][^.;:—(*`§\n]*)/g;
// `campaign-github` § The one gate names a skill, not a markdown file. Nothing in the tree can
// resolve that, so it is reported as unresolvable rather than as a defect: a check that reds on
// a citation it cannot evaluate is a check that gets switched off.
const OTHER_SECTION = /`([\w./@-]+)`[\s,*]{0,4}§[ \t\n]*([A-Za-z][^.;:—(*`§\n]*)/g;

/** Every `*.md` path a file claims exists, with its offset.
 *
 *  A backticked path that is the TEXT of a markdown link is a label, not a citation: in
 *  ``[`api.md`](.claude/rules/api.md)`` the link target is the claim and the label is how it
 *  reads. Measured on a repo nothing was tuned against — a README listing eight rules that way
 *  reported eight dangling citations, every one of them wrong, while the targets all resolved. */
function mdCitations(text) {
  const out = [];
  const linkedSpans = [];
  for (const m of text.matchAll(/\[([^\]\n]*)\]\(([^)\s]+)\)/g)) {
    const labelStart = m.index + 1;
    linkedSpans.push([labelStart, labelStart + m[1].length]);
    const target = m[2].split("#")[0];
    if (target.endsWith(".md")) out.push([target, m.index]);
  }
  for (const m of text.matchAll(MD_CITE)) {
    const s = m.index + 1;
    const e = s + m[1].length;
    if (linkedSpans.some(([a, b]) => a <= s && e <= b)) continue;
    out.push([m[1], m.index]);
  }
  return out;
}

/** Resolve a cited `*.md` path: against the repo root, or beside the citing file. */
function resolveMd(repo, from, cited) {
  const asRoot = cited;
  if (existsSync(join(repo, asRoot))) return asRoot;
  const beside = posix.join(dirname(from), cited);
  if (existsSync(join(repo, beside))) return beside;
  return null;
}

// ── Artifact detection ───────────────────────────────────────────────────────

function artifactParser(path) {
  const name = basename(path);
  if (path.endsWith(".sql")) return "sql";
  if (/^openapi\.(ya?ml|json)$/i.test(name) || /^swagger\.(ya?ml|json)$/i.test(name)) return "openapi";
  if (name === "schema.prisma") return "prisma";
  if (path.endsWith(".proto")) return "proto";
  return null;
}

// ── Layer guessing ───────────────────────────────────────────────────────────

/** Resolve every `§` citation in one file.
 *
 *  Scanned paragraph by paragraph, left to right, carrying the most recently cited target: in
 *  "`docs/infra.md` § Deploy and § Rollback" both sections belong to infra.md, and attributing
 *  the second to the citing file is the single largest false-positive class there is — measured
 *  at 128 of one real file's 128 reported misses. A paragraph is the bound because citations wrap
 *  across lines but never across a blank one.
 *
 *  A target that is not a markdown file — `` `campaign-github` § The one gate `` — is
 *  unresolvable rather than dangling. A check that reds on a citation it cannot evaluate is a
 *  check that gets switched off. */
function sectionCitations(repo, from, text, anchorsOf) {
  const citedSections = [];
  const danglingSections = [];
  const danglingBareSections = [];
  const unresolvableSections = [];

  const anchorsFor = (target) => {
    if (anchorsOf.has(target)) return anchorsOf.get(target);
    try {
      return anchors(readFileSync(join(repo, target), "utf8"));
    } catch {
      return null;
    }
  };

  // How far a cited file reaches. A target binds a § that is ADJACENT to it, and then a run of
  // further §s separated by nothing but a connector — "`docs/x.md` § A, § B and § C", which is
  // how these are actually written. Past that the target lapses and a § is read as naming a
  // section of the file it is written in.
  //
  // Measured, and the reason the rule is this narrow: with the target binding every § in the
  // paragraph, one real repo reported `docs/pipeline.md § A cluster plan re-reads the board` —
  // a section of a *skill*, named two sentences later — and 67 more of that shape in one file.
  const ADJACENT = /^[\s,*]{0,4}$/;
  const CONNECTOR = /^[\s,]*(?:and|or)?[\s,]*$/;

  // Backticked tokens, bare `*.md` paths, and `§ Name` runs, in source order, per paragraph.
  const TOKEN = /`([^`\n]+)`|(?<![`\w./-])([\w./-]+\.md)(?![\w.-])|§[ \t\n]*([A-Za-z][^.;:—(*`§\n]*)/g;
  for (const para of text.split(/\n[ \t]*\n/)) {
    let target = null;          // null = the file this paragraph is written in
    let targetEnd = -1;         // where the target's reach starts being measured from
    let shadow = null;          // a backticked non-file token, binding only an ADJACENT §
    let shadowEnd = -1;
    for (const m of para.matchAll(TOKEN)) {
      const backticked = m[1];
      const bare = m[2];
      if (backticked !== undefined || bare !== undefined) {
        const tok = (backticked ?? bare).trim();
        if (/^[\w./@-]+\.md$/.test(tok)) {
          target = resolveMd(repo, from, tok) ?? tok;
          targetEnd = m.index + m[0].length;
          shadow = null;
        } else if (backticked !== undefined && /^[\w./@-]+$/.test(tok)) {
          // `campaign-github` § The one gate names a skill, and binds only a § that is ADJACENT
          // to it. Binding every later § in the paragraph took one real repo from 266
          // unresolvable citations to 651, because an incidental `medium` or `low` three words
          // earlier shadowed a citation that resolved perfectly well.
          shadow = tok;
          shadowEnd = m.index + m[0].length;
        } else {
          shadow = null;        // a code fragment is not the subject of anything
        }
        continue;
      }
      const name = m[3].trim();
      const adjacent = shadow !== null
        && m.index - shadowEnd <= 4
        && /^[\s,*]*$/.test(para.slice(shadowEnd, m.index));
      if (adjacent) {
        unresolvableSections.push(`${shadow} § ${name}`);
        shadow = null;
        continue;
      }
      // Does the paragraph's target still reach this §?
      let file = from;
      if (target !== null) {
        const gap = para.slice(targetEnd, m.index);
        if (ADJACENT.test(gap) || CONNECTOR.test(gap)) {
          file = target;
        } else {
          target = null;             // lapsed: this § is about the file it is written in
        }
      }
      const targeted = file === target;
      citedSections.push(`${file} § ${name}`);
      if (targeted) targetEnd = m.index + m[0].length;   // keep the run alive
      const set = anchorsFor(file);
      if (set === null) continue;    // A1 owns a path that does not resolve
      if (citesSection(set, name)) continue;
      // Two buckets, because they are not equally trustworthy. A TARGETED citation names its
      // file, so a miss is a defect. A BARE one fell back to the file it is written in, which is
      // a guess — measured on a 45-doc repo, the targeted form reported 1 dangling `*.md` and
      // the bare form 400-odd, nearly all of them a § whose real subject was named in an earlier
      // sentence or is not a markdown file at all. The checker therefore has the bare form OFF
      // by default; it is reported here so an adopt proposal can say how big the baseline is.
      (targeted ? danglingSections : danglingBareSections).push(`${file} § ${name}`);
    }
  }
  return {
    citedSections: [...new Set(citedSections)],
    danglingSections: [...new Set(danglingSections)],
    danglingBareSections: [...new Set(danglingBareSections)],
    unresolvableSections: [...new Set(unresolvableSections)],
  };
}

function guessLayer(path, text, git) {
  const name = basename(path);
  const why = [];
  let layer = 2;

  // Ordered: a directory beats a filename, because a dated plan under plans/ is a plan however
  // it is named. `2026-10-15-booking-gate.md` matched MADR's four-digit numbering before this,
  // which put fifteen plans in the decision layer on a real repo.
  const MADR_NUMBER = /^\d{4}-(?!\d{2}-\d{2})/;
  if (/(^|\/)(adr|decisions?)(\/|$)/i.test(path)) {
    layer = 3;
    why.push("directory names a decision record track");
  } else if (/(^|\/)prd(\/|$)/i.test(path)) {
    layer = 4;
    why.push("directory names a PRD track");
  } else if (/(^|\/)plans?(\/|$)/i.test(path)) {
    layer = 5;
    why.push("directory names a plan track");
  } else if (/ledger|findings/i.test(name)) {
    layer = 6;
    why.push("filename names a ledger of observations");
  } else if (MADR_NUMBER.test(name) || /decision/i.test(name)) {
    layer = 3;
    why.push("filename is MADR-numbered or names a decision");
  } else if (/^(PRD|PRODUCT)\b/i.test(name) || /^PRD[-_.]/i.test(name)) {
    layer = 4;
    why.push("filename names a product brief or a PRD version");
  } else if (/\b(plan|roadmap)\b/i.test(name)) {
    layer = 5;
    why.push("filename names a plan");
  } else {
    why.push("nothing in the path or filename names another layer, so: what is true now");
  }

  // Shape evidence, which can corroborate but never overrides the path.
  if (/^\s*\*\*(Date|Status)\*\*:/m.test(text) || /^\s*[-*]\s*Status:/m.test(text)) {
    why.push("carries a Date/Status field, which is the layer-3 record shape");
  }
  if (git.appends_only === true) {
    why.push(`${git.commits} commits and no line ever removed — an append-only history`);
  } else if (git.appends_only === false) {
    why.push(`${git.commits} commits with lines removed — amended in place`);
  } else if (git.commits === 1) {
    why.push("one commit, so the history says nothing about the edit rule yet");
  }
  return { layer, why };
}

// A Current doc that explains *why* is a layer violation: the rationale belongs in layer 3, with
// a citation left behind. The giveaway is a sentence that would still be true if the current
// behaviour changed.
// Narrow on purpose. A bare `was rejected` fired on "nine companies were rejected for being too
// large" — prose about the subject matter, not about an option — so a rejection counts only with
// a reason attached or an explicit deliberation. Same for `decided`.
const RATIONALE = [
  /\bwe chose\b/i,
  /\bwe picked\b/i,
  /\bwe decided\b/i,
  /\bconsidered and rejected\b/i,
  /\bthe alternative (?:was|were) rejected\b/i,
  /\binstead of\b[^.\n]*\bbecause\b/i,
  /\brejected\b[^.\n]*\bbecause\b/i,
  /\bwas rejected\b[^.\n]*\bbecause\b/i,
];

// A settling construction, not the word. A plan saying "inherited rather than settled here" or
// "settled in #142" is the plan correctly disclaiming ownership, which is the opposite of the
// violation. Nine of nine matches on a real repo were that shape.
const SETTLES = [
  /\*\*Settled\b/i,
  /\bis settled here\b/i,
  /\bwe settle\b/i,
  /\bthis plan settles\b/i,
];

// A plan saying "inherited rather than settled here" or "settled in #142" is the plan correctly
// disclaiming ownership, which is the opposite of the violation. Nine of nine matches on a real
// repo were that shape before this guard.
const DISCLAIMS = [
  /\brather than settled\b/i,
  /\bnot settled\b/i,
  /\bnever settled\b/i,
  /\bsettled (?:in|by|elsewhere|at) \S/i,
  /\binherited\b/i,
];

// `~~struck~~` is where a FORMER truth legitimately lives — the convention that lets a reader see
// why a line changed. Blanked, keeping offsets so line numbers stay true.
const STRUCK = /~~(?:[^~\n]|\n(?!\n))*?~~/g;

function withoutStruck(text) {
  return text.replace(STRUCK, (m) => m.replace(/[^\n]/g, " "));
}

function matchingLines(text, patterns, exclude = []) {
  const out = [];
  const lines = withoutStruck(text).split("\n");
  const raw = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (exclude.some((rx) => rx.test(lines[i]))) continue;
    if (patterns.some((rx) => rx.test(lines[i]))) out.push(`${i + 1}: ${raw[i].trim()}`);
  }
  return out;
}

// ── git evidence ─────────────────────────────────────────────────────────────

function gitEvidence(repo, path) {
  const empty = { commits: 0, first: null, last: null, appends_only: null };
  let out;
  try {
    out = execFileSync("git", ["log", "--follow", "--numstat", "--format=%H%x09%cI", "--", path],
      { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return empty;
  }
  const commits = [];
  let current = null;
  for (const line of out.split("\n")) {
    const head = line.match(/^([0-9a-f]{40})\t(\S+)$/);
    if (head) {
      current = { sha: head[1], date: head[2], added: 0, removed: 0 };
      commits.push(current);
      continue;
    }
    const stat = line.match(/^(\d+|-)\t(\d+|-)\t/);
    if (stat && current) {
      current.added += stat[1] === "-" ? 0 : Number(stat[1]);
      current.removed += stat[2] === "-" ? 0 : Number(stat[2]);
    }
  }
  if (!commits.length) return empty;
  // `git log` is newest first; the oldest commit is the one that created the file.
  const oldest = commits[commits.length - 1];
  const newest = commits[0];
  const later = commits.slice(0, commits.length - 1);
  return {
    commits: commits.length,
    first: oldest.date,
    last: newest.date,
    // One commit says nothing about the edit rule, so it is not evidence either way.
    appends_only: commits.length < 2 ? null : later.every((c) => c.removed === 0),
  };
}

// ── The existing table ───────────────────────────────────────────────────────

/** The lines under the first heading matching `rx`, up to the next heading at any level. */
function sectionBody(text, rx) {
  const lines = text.split("\n");
  let start = -1;
  let startLevel = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})[ \t]+(.*)$/);
    if (!m) continue;
    if (start === -1) {
      if (rx.test(m[2])) { start = i + 1; startLevel = m[1].length; }
      continue;
    }
    if (m[1].length <= startLevel) return lines.slice(start, i).join("\n");
  }
  return start === -1 ? "" : lines.slice(start).join("\n");
}

function readTable(repo, file) {
  const abs = join(repo, file);
  if (!existsSync(abs)) return { file, found: false, markers: false, rows: [] };
  const text = readFileSync(abs, "utf8");
  const markers = text.includes("<!-- seam:sources-of-truth start -->");
  // Scope to the section that holds the table, so an unrelated table elsewhere is not read as
  // one. A missing section is reported as zero rows rather than guessed at.
  const body = sectionBody(text, /sources of truth/i);
  const rows = [];
  for (const line of body.split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
    const doc = cells[0]?.match(/^`([^`]+)`$/);
    if (!doc) continue;           // the header row and the |---| separator have no backticked path
    rows.push({ doc: doc[1], cells: cells.slice(1).filter((c) => c !== "") });
  }
  return { file, found: true, markers, rows };
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repo = args.repo;
  const files = walk(repo);

  let defaultBranch = "main";
  try {
    defaultBranch = execFileSync("git", ["branch", "--show-current"],
      { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || "main";
  } catch { /* not a git repo: the default stands, and A12 will be off */ }

  // Which file hosts the table: told, or the first candidate that exists, else the default.
  const hostCandidates = args.table ? [args.table] : ["CLAUDE.md", "AGENTS.md", "docs/contributing.md"];
  const host = hostCandidates.find((c) => existsSync(join(repo, c))) ?? hostCandidates[0];
  const table = readTable(repo, host);

  // Docs: everything under docs/, plus the table host when it is markdown. A `rules/`-style
  // directory is reported separately — it is a candidate for folding into layer 2, which is a
  // decision for the user rather than an inventory entry.
  // Everything under docs/, plus every markdown file at the repo root — which is where a
  // product brief and a README live, and campaign's table lists PRODUCT.md as a layer-4 row.
  const docPaths = files.filter((f) =>
    f.endsWith(".md") && (f.startsWith("docs/") || !f.includes("/") || f === host));

  const textOf = new Map();
  for (const p of docPaths) textOf.set(p, readFileSync(join(repo, p), "utf8"));
  const anchorsOf = new Map();
  for (const p of docPaths) anchorsOf.set(p, anchors(textOf.get(p)));

  const docs = [];
  for (const p of docPaths.sort()) {
    const text = textOf.get(p);
    const git = gitEvidence(repo, p);

    const citedMd = [...new Set(mdCitations(text).map((c) => c[0]))];
    const danglingMd = [];
    const resolvedMd = [];
    for (const c of citedMd) {
      const r = resolveMd(repo, p, c);
      (r ? resolvedMd : danglingMd).push(r ?? c);
    }

    const { citedSections, danglingSections, danglingBareSections, unresolvableSections } =
      sectionCitations(repo, p, text, anchorsOf);

    const guess = guessLayer(p, text, git);
    docs.push({
      path: p,
      bytes: statSync(join(repo, p)).size,
      lines: text.split("\n").length,
      headings: headings(text),
      git,
      cites: {
        md: resolvedMd,
        sections: [...new Set(citedSections)],
        unresolvable_sections: [...new Set(unresolvableSections)],
      },
      dangling: {
        md: danglingMd,
        sections: danglingSections,
        bare_sections: danglingBareSections,
      },
      in_table: table.rows.some((r) => r.doc === p),
      layer_guess: guess,
    });
  }

  // Overlaps: two docs claiming one heading. An H1 is a title, not a claim, so only sections
  // count. This is the shape the table exists to resolve, so it is reported, never resolved.
  const owners = new Map();
  for (const p of docPaths) {
    for (const h of headingLevels(textOf.get(p))) {
      if (h.level < 2) continue;
      const key = h.text;
      if (!owners.has(key)) owners.set(key, new Set());
      owners.get(key).add(p);
    }
  }
  // An overlap carries the layers involved, because files of one layer sharing a heading is
  // usually a shared *format* — every plan has a § The issues — rather than two files competing
  // for one question. Reported either way; the layers are what make it discountable.
  const layerOf = new Map(docs.map((d) => [d.path, d.layer_guess.layer]));
  const overlaps = [...owners.entries()]
    .filter(([, set]) => set.size > 1)
    .map(([heading, set]) => {
      const fileList = [...set].sort();
      return {
        heading,
        files: fileList,
        layers: [...new Set(fileList.map((f) => layerOf.get(f)))].sort(),
      };
    })
    .sort((a, b) => a.heading.localeCompare(b.heading));

  // Layer violations: a file that restates something a higher layer owns.
  const layerViolations = [];
  for (const d of docs) {
    // The table host carries the authority rules on purpose, so a rationale there is the
    // method working rather than a layer violation.
    if (d.layer_guess.layer === 2 && d.path !== host) {
      const evidence = matchingLines(textOf.get(d.path), RATIONALE);
      if (evidence.length) {
        layerViolations.push({
          path: d.path,
          why: "a Current doc carrying a rationale — the reasoning belongs in layer 3, with a"
            + " citation left behind",
          evidence,
        });
      }
    }
    if (d.layer_guess.layer === 5) {
      const settled = matchingLines(textOf.get(d.path), SETTLES, DISCLAIMS);
      if (settled.length) {
        layerViolations.push({
          path: d.path,
          why: "a Seam doc that settles something — layer 5 owns nothing, so a decision here is"
            + " a decision nobody can find. It belongs in layer 3.",
          evidence: settled,
        });
      }
    }
  }

  const artifacts = files
    .map((f) => ({ path: f, parser: artifactParser(f) }))
    .filter((a) => a.parser !== null)
    .sort((a, b) => a.path.localeCompare(b.path));

  const inv = {
    repo: { root: repo, name: basename(repo), default_branch: defaultBranch },
    table,
    docs,
    artifacts,
    overlaps,
    layer_violations: layerViolations,
    ci: { workflows: files.filter((f) => /^\.github\/workflows\/.*\.ya?ml$/.test(f)).sort() },
    rules_dirs: [".claude/rules", "rules", ".cursor/rules", ".agents/rules"]
      .filter((d) => existsSync(join(repo, d)) && statSync(join(repo, d)).isDirectory()),
    agents: files.filter((f) => /^\.claude\/agents\/.*\.md$/.test(f)).sort(),
    summary: {
      docs: docs.length,
      in_table: docs.filter((d) => d.in_table).length,
      not_in_table: docs.filter((d) => !d.in_table).length,
      dangling_md: docs.reduce((n, d) => n + d.dangling.md.length, 0),
      dangling_sections: docs.reduce((n, d) => n + d.dangling.sections.length, 0),
      dangling_bare_sections: docs.reduce((n, d) => n + d.dangling.bare_sections.length, 0),
      unresolvable_sections: docs.reduce((n, d) => n + d.cites.unresolvable_sections.length, 0),
      overlaps: overlaps.length,
      layer_violations: layerViolations.length,
    },
  };

  process.stdout.write(JSON.stringify(inv, null, 2) + "\n");
}

main();
