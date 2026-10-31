# The interview, and the answers file

One document, two uses. The interview's record **is** the program's input: `--answers <file>`
replays it, which is what makes the wizard evaluable, lets an adoption re-run in CI, and keeps
`.seam/config.json` the output of a program rather than of a judgment.

## The projection rule

```
.seam/config.json  =  the answers file
                      minus every prose key
                      plus defaults for the machine keys left unset
```

One key namespace, no translation step. A key sits at the same path in both files or it does not
exist.

**Prose keys** carry a human's words and never reach the config, because a script has no use for
a sentence it cannot check: `purpose`, `users`, `in_scope`, `out_of_scope`, `open_questions`, and
the sub-keys `docs[].owns`, `domains[].covers`, `milestones[].green`, `agents[].covers`.

Everything else is a machine key.

## The question set

Ordered so that each answer narrows the next. **Read the tree before asking**, and state what
you read — a question whose answer is in `package.json` wastes the one resource the interview
spends.

### What may be stated from the tree, never asked

Stack, package manager, test runner, lint and build commands, CI steps, directory layout,
services, which files look like layer-1 artifacts. **State these back and ask for a correction**,
rather than asking open questions about them.

### What must be asked, never inferred

| # | Question | Answers key | Notes |
|---|---|---|---|
| 1 | What is this project for, in your words? | `purpose` | Goes into the PRD verbatim. Never paraphrased into something more confident. |
| 2 | Who uses it? | `users` | "One person, me" is a complete answer and changes the doc set. |
| 3 | What is in scope for the current version, and what is deliberately out? | `in_scope`, `out_of_scope` | Out-of-scope is a statement about *this version*, not a refusal. |
| 4 | Which files carry weight — where a defect has consequences beyond the file? | `load_bearing` | The one question the review level, the follow-up qualifier and A11 all read. Shown **empty** by default. |
| 5 | Which of these existing files is a layer-1 artifact — the thing that cannot be wrong? | `artifacts[]` | Each needs a `parser`: `sql`, `ts`, or `none`. Every artifact must also be in `load_bearing`; layer 1 wins over every doc, so it carries weight by construction. |
| 6 | For each proposed doc: what does it own, and what happens when it is wrong? | `docs[].owns`, `docs[].layer` | The layer question is `layers.md` § Choosing a layer, in practice — beside this file. A track that writes several files (layers 3 and 4) gets one **glob** row — `docs/adr/*.md` — because A10 reads this cell to decide whether a file is covered. |
| 7 | For each proposed doc: what enforces it, if anything? | `docs[].enforces` | Empty is the default and the common answer. A value must be on `load_bearing`. |
| 8 | One file per decision, or one dated file? | `adr.format` | `madr` or `single`. `layers.md` has the trade, beside this file. Asked **once**. |
| 9 | Which paths, if any, are **prose-only** enough that a cheap review is adequate? | `low_review_paths` | **Defaults to empty, and empty is the right answer for most repos.** Take an empty answer without arguing. Ask for prose paths specifically: `low` is the sixth row of the level table and a path that also matches a `high` or `medium` row above takes the higher level, so a source file or a convention file on this list is a row that never fires. |
| 10 | What are the domains work gets labelled with? | `domains[]` | One per source-of-truth row is the usual mapping. |
| 11 | What is the build order? | `milestones[]` | From the infra or architecture doc if one exists. |
| 12 | Which agents does this repo want, and what does each cover? | `agents[]` | Optional. An empty list is fine; a generic agent is worse than none. |
| 13 | Checker language: Python 3 or Node? | `checker.language` | Both implement the same assertions with the same output. **Pick what the repo already runs in CI** — that is the whole rule, because a runner that has to install the other one is a check that can fail for a reason that is not drift. `checker.path` is optional and defaults to `scripts/check_docs.py` or `scripts/check_docs.mjs`; if you give it, the extension has to match the language. |
| 14 | Anything still undecided? | `open_questions[]` | Each goes in **as a question**. Never promoted to a confident sentence. |
| 15 | Which paths are implementation, and which are tests? | `assertions.A15.impl_globs`, `assertions.A15.test_globs` | **A15 is off until both are answered**, and one without the other is rejected. Read the tree first — a `tests/` directory, `*.test.ts` files — and state what it shows for correction. Globs are written as `plan_glob` is: `src/**/*.ts`, `**/*.test.ts`; a path matching both is a test. Write `"A15": { "enabled": true, "impl_globs": […], "test_globs": […] }`. "We do not write tests first" is a complete answer: leave A15 out and record nothing. |
| 16 | Should the plan-first rule be written down — a unit named before the work it covers, the test it names written first, and a finish line scoped to that unit? | `docs[]` — a layer-2 row, `docs/building.md` | **Proposed by default; ask it as a proposal, not an open question.** A yes writes `{ "path": "docs/building.md", "layer": 2, "owns": "…", "enforces": "", "create": true }`, and the wizard picks the build template from the file name. "No" is a complete answer: leave the row out and record nothing. The doc's contract names units, and units live in a layer-5 plan — so if the repo has no layer-5 row, propose one beside it rather than leaving the start contract nowhere to write a unit. |

### The discipline

- State what is readable from the tree. **Ask** everything else.
- An answer goes in **in the user's words**. Paraphrasing is where invented confidence enters.
- Anything undetermined goes in as an explicit open question, never as a confident sentence.
- `Enforces` is shown empty by default, and so is `low_review_paths`.
- One pass. If the user stops answering, write what you have and record the rest as open
  questions — a half-answered interview is a real state, and an invented answer is not.

## Schema

```jsonc
{
  "seam_version": "0.1.0",
  "repo":    { "name": "apiary", "default_branch": "main" },
  "table":   { "file": "CLAUDE.md" },            // which file hosts the sources-of-truth table
  "checker": { "language": "python" | "node",
               "path": "scripts/check_docs.py" },      // optional; defaults from the language
  "adr":     { "format": "madr", "dir": "docs/adr" },
  //         | { "format": "single", "file": "docs/decisions.md" }
  "prd":     { "dir": "docs/prd", "version": 1 },
  "artifacts": [ { "path": "db/schema.sql", "parser": "sql" } ],

  "docs": [
    // A row's path is a concrete file, or a glob when the layer is a whole track — the ADR and
    // PRD tracks write several files each, and A10 reads this cell to decide whether a file
    // under docs/ is covered. Use "docs/adr/*.md", "docs/prd/*.md".
    { "path": "docs/engineering.md",
      "layer": 2,                                 // 1..6
      "owns": "Stack, data access, API shape",     // prose — reaches the table, not the config
      "enforces": "",                              // "" means: owns documentation and nothing more
      "create": true }                             // false = the file is the user's; row only
  ],

  "load_bearing":     ["db/schema.sql"],
  "low_review_paths": [],
  "domains":    [ { "name": "hives", "covers": "Hive state and scheduling" } ],
  "milestones": [ { "n": 1, "title": "Queenless list", "green": "the list renders" } ],
  "agents":     [ { "name": "schema", "covers": "...", "model": "opus", "effort": "high" } ],

  "assertions": {                                  // overrides; every switch has a default
    "A3": { "enabled": true, "doc_sections": ["docs/checks.md § Checks"] }
  },
  "baseline": { "path": ".seam/baseline.json" },

  // prose — never reaches .seam/config.json
  "purpose": "...",
  "users": "...",
  "in_scope": ["..."],
  "out_of_scope": ["..."],
  "open_questions": ["..."]
}
```

### Defaults the program fills

| Key | Default | Why |
|---|---|---|
| `assertions.A1/A2/A10` | on | A citation a reader cannot open is a defect at every layer; a doc missing from the table is drift by definition. |
| `assertions.A3` | **off** | It compares two sides. With no workflow, or an unconfirmed one, the comparison is vacuous — and off is distinct from passing. |
| `assertions.A4` | on iff `artifacts` is non-empty | Nothing to resolve against otherwise. |
| `assertions.A5/A6/A7/A9` | off | Each needs a repo-specific list. An empty list that passes is worse than a switch that is off. |
| `assertions.A8/A14` | on iff a layer-5 doc exists | |
| `assertions.A15` | **off** | It compares two repo-specific lists — which paths are implementation, which are tests — and an empty list is not a sensible default. `default_branch` defaults from `repo.default_branch`. |
| `assertions.A12/A13` | on iff a layer-3 or layer-4 doc exists | |
| `docs/building.md` row | **proposed by default** | The method's ordering rule — the written unit comes before the work — only holds where the repo's own doc says so, and opting in would make plan-first the exception. The program never adds the row itself: the answers file is the source, so declining is leaving the row out. |
| `low_review_paths` | `[]` | `low` is hunk-local and cannot verify a claim a document makes about the tree. Absent means empty. |
| `load_bearing` | `[]` | Absent means empty, which is the honest answer for a repo where nothing enforces anything yet. |
| `checker.path` | from the language | `scripts/check_docs.py` or `scripts/check_docs.mjs`. |
| `assertions.A4.not_fields` | a built-in list of extensions and TLDs, **plus** whatever you add | So a repo cannot blind A4 by naming one exemption of its own. `not_fields_override` replaces the list outright, for the repo whose column really is called `html`. |
| `checker.language` | asked, no default | |

**There is no `priorities` key.** The three priorities are fixed by the method — `p0`, `p1`, `p2`,
by consequence — so there is nothing repo-specific to project. They live in the repo's
`docs/taxonomy.md`, which is where a reader looks for them.

### Rejections

The program validates before writing anything, and a rejected run writes **nothing** — a
half-written doc layer is worse than none, because the table would claim ownership of files that
are not there. Each failure names the key path:

- `table.file` missing
- `checker.language` not `python` or `node`
- `checker.path` given with an extension that does not match the language
- `adr.format` not `madr` or `single`, or the matching `dir`/`file` missing
- `docs` empty, or a row with no `path`, no `owns`, or a `layer` outside 1..6
- `load_bearing` or `low_review_paths` present and not a list (absent is fine — both mean empty)
- a glob row with `"create": true` outside layers 3 and 4 — a glob names a form, not a file
- `artifacts[N].path` absent from `load_bearing`
- `assertions.A15.impl_globs` or `assertions.A15.test_globs` given without the other, or not a list; `assertions.A15.default_branch` given and not a branch name
