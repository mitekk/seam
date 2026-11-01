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
a sentence it cannot check: `purpose`, `users`, `in_scope`, `out_of_scope`, `open_questions`,
`field_reason`, and the sub-keys `docs[].owns`, `domains[].covers`, `milestones[].green`,
`agents[].covers`.

Everything else is a machine key.

## The question set

Ordered so that each answer narrows the next, and **question 1 gates the rest** — the field
determination is what the path, the proposal and the baseline all branch on, so it is established
before anything is proposed. The two per-doc questions come after the rows that propose the docs,
for the same reason: there is nothing to ask them about until something has been proposed.
**Read the tree before asking**, and state what you read — a question whose answer is in
`package.json` wastes the one resource the interview spends.

### What may be stated from the tree, never asked

Stack, package manager, test runner, lint and build commands, CI steps, directory layout,
services, which files look like layer-1 artifacts. **State these back and ask for a correction**,
rather than asking open questions about them.

### What must be asked, never inferred

| # | Question | Answers key | Notes |
|---|---|---|---|
| 1 | Is this repo **green or brown field** — a tree with no docs, or a tree that already has docs? | `field`, `field_reason` | **Asked first, because everything after it depends on it**: which path runs, what the proposal may claim, whether an existing doc's body is off limits, how big the baseline is, and which assertions can run at all. `greenfield` or `brownfield`, with the reason in one sentence — the wizard refuses either half missing. It is a judgement about the tree **as it stands**, not about its history: a repo whose every doc was written by this method is still a repo that has docs. State what the tree shows (does anything under `docs/` exist?) and ask for a correction; it is **milestone 1** in the repo's taxonomy, and the determination is recorded before anything is proposed. |
| 2 | What is this project for, in your words? | `purpose` | Goes into the PRD verbatim. Never paraphrased into something more confident. |
| 3 | Who uses it? | `users` | "One person, me" is a complete answer and changes the doc set. |
| 4 | What is in scope for the current version, and what is deliberately out? | `in_scope`, `out_of_scope` | Out-of-scope is a statement about *this version*, not a refusal. |
| 5 | Which files carry weight — where a defect has consequences beyond the file? | `load_bearing` | The one question the review level, the follow-up qualifier and A11 all read. Shown **empty** by default. |
| 6 | Which of these existing files is a layer-1 artifact — the thing that cannot be wrong? | `artifacts[]` | Each needs a `parser`: `sql`, `ts`, or `none`. Every artifact must also be in `load_bearing`; layer 1 wins over every doc, so it carries weight by construction. |
| 7 | What are the domains work gets labelled with? | `domains[]` | One per source-of-truth row is the usual mapping. |
| 8 | What is the build order, and which milestone is being built now? | `milestones[]`, `milestones[].active` | The order from the infra or architecture doc if one exists. **Exactly one milestone is `"active": true` and every other is `false`** — the follow-up qualifier's third clause, "blocks the active milestone", reads it, so the wizard refuses an answers file with none or two. Ask which — it is not readable from the tree. No milestones yet is a complete answer. **This list is the repo's own build order and it is numbered from 2**, because milestone 1 is the field determination from question 1 and the taxonomy template ships that row; it is green on arrival and never the active one, so it is not a row here. If the user lists milestones and never says which is active, record `milestones: []` and an open question: the wizard refuses an active-less list, and a guessed one is the invented answer the discipline below rules out. |
| 9 | Which agents does this repo want, and what does each cover? | `agents[]` | Optional. An empty list is fine; a generic agent is worse than none. |
| 10 | Which paths, if any, are **prose-only** enough that a cheap review is adequate? | `low_review_paths` | **Defaults to empty, and empty is the right answer for most repos.** Take an empty answer without arguing. Ask for prose paths specifically: `low` is the sixth row of the level table and a path that also matches a `high` or `medium` row above takes the higher level, so a source file or a convention file on this list is a row that never fires. |
| 11 | One file per decision, or one dated file? | `adr.format` | `madr` or `single`. `layers.md` has the trade, beside this file. Asked **once**. |
| 12 | Should the plan-first rule be written down — a unit named before the work it covers, the test it names written first, and a finish line scoped to that unit? | `docs[]` — a layer-2 row, `docs/building.md` | **Proposed by default; ask it as a proposal, not an open question.** A yes writes `{ "path": "docs/building.md", "layer": 2, "owns": "…", "enforces": "", "create": true }`, and the wizard picks the build template from the file name. "No" is a complete answer: leave the row out and record nothing. The doc's contract names units, and units live in a layer-5 plan — so if the repo has no layer-5 row, propose one beside it rather than leaving the start contract nowhere to write a unit. |
| 13 | Should the context budget be written down — a threshold on how much of a session's window a piece of work may spend, and the two reasons a subagent gets dispatched? | `docs[]` — a layer-2 row, `docs/context.md` | **Proposed by default; ask it as a proposal, not an open question.** A yes writes `{ "path": "docs/context.md", "layer": 2, "owns": "…", "enforces": "", "create": true }`, and the wizard picks the context template from the file name. "No" is a complete answer: leave the row out and record nothing. The doc keeps a session's own artifacts in a gitignored `.seam/session/`, so a yes also means that line in `.gitignore` — say so when the row goes in, because nothing adds it for the repo and without it the first handoff a session writes gets committed as though it were part of the work. |
| 14 | Should the review policy be written down — which level a diff takes from what it touches, how many rounds a review gets, and what it leaves outstanding? | `docs[]` — a layer-2 row, `docs/reviewing.md` | **Proposed by default; ask it as a proposal, not an open question.** A yes writes `{ "path": "docs/reviewing.md", "layer": 2, "owns": "…", "enforces": "", "create": true }`, and the wizard picks the review template from the file name. "No" is a complete answer: leave the row out and record nothing. The template's level table reads `load_bearing` (question 5) and `low_review_paths` (question 10), so those two answers are what make it a policy rather than one level for every diff. |
| 15 | Should model and effort be pinned per phase — which artifact owns each phase of the work, and what that artifact runs at? | `docs[]` — a layer-2 row, `docs/routing.md` | **Proposed by default; ask it as a proposal, not an open question.** A yes writes `{ "path": "docs/routing.md", "layer": 2, "owns": "…", "enforces": "", "create": true }`, and the wizard picks the routing template from the file name. "No" is a complete answer: leave the row out and record nothing. The rows are this repo's own phases, and an owning artifact may be a skill or plugin the repo installs rather than a file in the tree — so ask which phases run on something this repo does not own. The agents from question 9 arrive as rows already: the program writes one Implement row per agent, with the model and effort that agent is pinned to. |
| 16 | Should the domain labels, the three priorities and the build order live in one doc? | `docs[]` — a layer-2 row, `docs/taxonomy.md` | **Proposed by default; ask it as a proposal, not an open question.** A yes writes `{ "path": "docs/taxonomy.md", "layer": 2, "owns": "…", "enforces": "", "create": true }`, and the wizard picks the taxonomy template from the file name. "No" is a complete answer: leave the row out and record nothing. The answers still carry `domains[]` and `milestones[]` into `.seam/config.json`, and this is the only doc that renders either as a table — so a no is worth one more question: where is a reader meant to look a label up? |
| 17 | For each proposed doc: what does it own, and what happens when it is wrong? | `docs[].owns`, `docs[].layer` | The layer question is `layers.md` § Choosing a layer, in practice — beside this file. A track that writes several files (layers 3 and 4) gets one **glob** row — `docs/adr/*.md` — because A10 reads this cell to decide whether a file is covered. |
| 18 | For each proposed doc: what enforces it, if anything? | `docs[].enforces` | Empty is the default and the common answer. A value must be on `load_bearing`. |
| 19 | Checker language: Python 3 or Node? | `checker.language` | Both implement the same assertions with the same output. **Pick what the repo already runs in CI** — that is the whole rule, because a runner that has to install the other one is a check that can fail for a reason that is not drift. `checker.path` is optional and defaults to `scripts/check_docs.py` or `scripts/check_docs.mjs`; if you give it, the extension has to match the language. |
| 20 | Which paths are implementation, and which are tests? | `assertions.A15.impl_globs`, `assertions.A15.test_globs` | **A15 is off until both are answered**, and one without the other is rejected. Read the tree first — a `tests/` directory, `*.test.ts` files — and state what it shows for correction. Globs are written as `plan_glob` is: `src/**/*.ts`, `**/*.test.ts`; a path matching both is a test. Write `"A15": { "enabled": true, "impl_globs": […], "test_globs": […] }`. "We do not write tests first" is a complete answer: leave A15 out and record nothing. |
| 21 | Is there one command that tears a finished branch down once its PR has merged? | `teardown_command` | **Optional, and an empty answer is complete** — most repos have nothing to take down beyond the branch itself, which the tracker conventions delete without being told, so absent and `""` both mean exactly that. Read the tree first and state what it shows for correction: a script that removes a worktree, drops a per-branch database or stops a container is a **candidate**, never the answer — whether it is the teardown is the user's to say, and a script found and assumed is the invented answer the discipline below rules out. One shell command, **run from the main checkout** — not from the worktree the branch has, since that is usually the directory it removes — with the issue number written `<n>` where it takes one. So a command written to work only from a worktree root is the wrong answer: say so, and record what the user actually has. |
| 22 | Anything still undecided? | `open_questions[]` | Each goes in **as a question**. Never promoted to a confident sentence. |

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
  "field":   "greenfield" | "brownfield",        // asked first; no default
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
  "teardown_command": "",            // "" or absent: deleting the branch is the whole teardown
  "domains":    [ { "name": "hives", "covers": "Hive state and scheduling" } ],
  "milestones": [ { "n": 1, "title": "Queenless list", "green": "the list renders",
                    "active": true } ],            // exactly one true when any milestone exists
  "agents":     [ { "name": "schema", "covers": "...", "model": "opus", "effort": "high" } ],

  "assertions": {                                  // overrides; every switch has a default
    "A3": { "enabled": true, "doc_sections": ["docs/checks.md § Checks"] }
  },
  "baseline": { "path": ".seam/baseline.json" },

  // prose — never reaches .seam/config.json
  "purpose": "...",
  "field_reason": "...",                 // why that determination, about the tree as it stands
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
| `docs/context.md` row | **proposed by default** | A window degrades before it ends, so a session with no threshold meets its budget at the point where it can no longer act on one. Opting in would make spending the window unwatched the default. Declining is leaving the row out, as above. |
| `docs/reviewing.md` row | **proposed by default** | The level policy is read before every commit, so without the doc the level gets argued per diff on the day — which is the thing it replaces. Declining is leaving the row out, as above. |
| `docs/routing.md` row | **proposed by default** | Question 9 collects a model and an effort per agent, and the program writes both into this doc. Decline the row and the only readable copy of what the interview just pinned is each agent's own frontmatter, one file at a time. Declining is leaving the row out, as above. |
| `docs/taxonomy.md` row | **proposed by default** | Every other row here is a default because its rule needs a home. This one is a default because questions 7 and 8 are asked regardless: the interview collects a taxonomy whether or not anything renders it, and a collected answer with no document is what the default avoids. Declining is leaving the row out, as above. |
| `low_review_paths` | `[]` | `low` is hunk-local and cannot verify a claim a document makes about the tree. Absent means empty. |
| `load_bearing` | `[]` | Absent means empty, which is the honest answer for a repo where nothing enforces anything yet. |
| `teardown_command` | `""` | Absent means empty, and empty means deleting the branch is the whole teardown — the common case, because most repos have nothing else to take down. A value here is the repo's own command, and the tracker conventions run it as the last step of a merge rather than when someone notices later. |
| `checker.path` | from the language | `scripts/check_docs.py` or `scripts/check_docs.mjs`. |
| `assertions.A4.not_fields` | a built-in list of extensions and TLDs, **plus** whatever you add | So a repo cannot blind A4 by naming one exemption of its own. `not_fields_override` replaces the list outright, for the repo whose column really is called `html`. |
| `field` | **asked, no default** | Green or brown field is the one answer the rest of the interview branches on, and it is not readable off the tree with any confidence — a repo whose `docs/` holds one stale file is a judgement call. `field_reason` has no fallback either, unlike `domains[].covers`: a determination without its reason reads as an error to whoever finds it next. |
| `checker.language` | asked, no default | |

**There is no `priorities` key.** The three priorities are fixed by the method — `p0`, `p1`, `p2`,
by consequence — so there is nothing repo-specific to project. They live in the repo's
`docs/taxonomy.md`, which is where a reader looks for them.

### Rejections

The program validates before writing anything, and a rejected run writes **nothing** — a
half-written doc layer is worse than none, because the table would claim ownership of files that
are not there. Each failure names the key path:

- `field` absent, or not `greenfield` or `brownfield` — the taxonomy template renders it as
  milestone 1, so an unanswered field ships `{{field}}` into that row as itself
- `field_reason` absent or empty — the determination is a judgement about the tree as it stands,
  and the reason is the half that keeps it readable later
- `table.file` missing
- `checker.language` not `python` or `node`
- `checker.path` given with an extension that does not match the language
- `adr.format` not `madr` or `single`, or the matching `dir`/`file` missing
- `docs` empty, or a row with no `path`, no `owns`, or a `layer` outside 1..6
- `load_bearing` or `low_review_paths` present and not a list (absent is fine — both mean empty)
- `teardown_command` present and not a string, or carrying a newline, which is two commands (absent is fine, and so is `""` — both mean none)
- a glob row with `"create": true` outside layers 3 and 4 — a glob names a form, not a file
- `artifacts[N].path` absent from `load_bearing`
- `assertions.A15.impl_globs` or `assertions.A15.test_globs` given without the other, or not a list; `assertions.A15.default_branch` given and not a branch name
- `agents[N]` missing any of `name`, `covers`, `model` or `effort` — the agent template substitutes each per key, and an absent value ships as `{{agent.model}}` into the frontmatter the harness parses, which then does not parse at all
- `domains[N].name`, `milestones[N].n` or `milestones[N].title` absent — the taxonomy tables are built from their rows, so a row without its label renders the literal `undefined`

A row's **optional** keys are the ones with an honest fallback: `domains[N].covers` and
`milestones[N].green` render `_not recorded_`, which is the wizard saying what it was not told.
`agents[N].covers` is **not** one of them — it is that agent's `description:`, substituted per key.
