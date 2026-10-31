<div align="center">

# 📐 seam

**Docs are the seam between work units** — _layer · enforce · review_

[![CI](https://github.com/mitekk/seam/actions/workflows/ci.yml/badge.svg)](https://github.com/mitekk/seam/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-8b5cf6)](LICENSE)
![Node](https://img.shields.io/badge/Node-7c3aed?logo=nodedotjs&logoColor=white)
![Python](https://img.shields.io/badge/Python-3-3776ab?logo=python&logoColor=white)
![Dependencies](https://img.shields.io/badge/dependencies-none-8b5cf6)

A Claude Code plugin that installs a layered, mechanically-enforced documentation method into any
repo. It ships the method and the templates, never a decision — every decision lives in the
adopting repo's own `docs/`, and a generated checker fails the build when prose and code disagree.

</div>

---

- **Explore** — [What it is](#what-it-is) · [Quick start](#quick-start) · [The six layers](#the-six-layers) · [The drift checker](#the-drift-checker) · [What init writes](#what-init-writes) · [Commands](#commands) · [Where the rules live](#where-the-rules-live) · [Tech stack](#tech-stack) · [Testing](#testing) · [CI](#continuous-integration) · [Docs](#docs--decisions)

---

## What it is

The layer that makes a repo's documentation hold: a table saying which document owns which
question, edit rules that follow from what happens when a document turns out to be wrong, and a
generated checker that fails the build when prose and code disagree.

It installs that layer into any repo — greenfield, or one that already has docs it does not trust.

| | |
|---|---|
| 📋 **A sources-of-truth table** | In the repo's context file, listing every doc by *what it owns* and which **layer** it belongs to. |
| 🔍 **A drift checker** | Generated into the repo in its own language — Python 3 or Node, no dependencies either side. Sixteen assertions, plus a baseline so day-one debt is a number rather than a wall. |
| 🏷️ **Tracker conventions** | Scope discipline made visible: one priority, one milestone, one or two domains, and four dispositions for everything you noticed along the way. |
| 🔬 **A review policy** | Picks its level from what the diff touches rather than from habit, and stops after two rounds for a measured reason. |

## Quick start

```bash
claude plugin marketplace add mitekk/seam
claude plugin install seam@seam
```

**Then restart Claude Code.** A plugin installed mid-session is not loaded into that session, so
`/seam:init` will not exist until you start a new one — both commands report success and the
command is still missing. Once restarted, in the repo you want the method in:

```
/seam:init
```

The wizard reads the repo, proposes the doc layers, and writes what you approve.

### If `/seam:init` is not there

You are in the session that installed it. Restart. If you would rather not, the wizard's
deterministic half is a plain program and runs without the plugin being loaded:

```bash
# 1. Write an answers file. Its schema, and the question set behind it, are in
#    skills/seam-docs/references/interview.md — read that, not this README.
# 2. Then, from the repo root:
node <seam>/bin/seam-init.mjs --answers answers.json --repo . --dry-run
node <seam>/bin/seam-init.mjs --answers answers.json --repo .
node <seam>/bin/generate-checker.mjs --repo . --write-baseline
```

**Do not hand-write `.seam/config.json`.** Every assertion is opt-in per id, and a config with no
`assertions` block would emit a checker that enables **nothing** and exits 0 on everything — which
the checker now refuses rather than allowing. The wizard fills the defaults; that is most of what
it is for.

## The six layers

The organising axis is *what happens when the document turns out to be wrong*. That one property
fixes the edit rule, the authority rank, and which assertions can run against the file.

| # | Layer | Answers | When it's wrong | Edit rule |
|---|---|---|---|---|
| 1 | **Artifact** | what the machine does | cannot be — it *is* the code | changes with the code |
| 2 | **Current** | what is true now | a bug | amend in place |
| 3 | **Decisions (ADR)** | what we chose, and why | never — the record stands | append-only, dated; a reversal is a new entry |
| 4 | **Intent (PRD)** | what we are trying to build | expected | immutable versions; supersede with vN+1 |
| 5 | **Seam (plans)** | which units, in what order, what joins them | expected | superseded wholesale |
| 6 | **Ledger** | what we noticed and will not do | n/a | append-only rows |

Authority is **not one chain**, because the layers answer different questions:

- **On what is true now:** Artifact beats Current, and nothing else may answer at all.
- **On why it is this way:** Decisions beat Current. A Current doc that gives a rationale *cites*
  the ADR rather than restating it.
- **On what we intend:** Intent beats Seam.
- **Seam and Ledger own nothing** and lose to everything, by construction.

**The rule that spans all six: a lower layer cites a higher one, never restates it.** That is the
rule the whole enforcement layer exists to protect — every assertion is downstream of it.

Why the layering is load-bearing rather than taxonomy: the edit rule is what makes a layer
*checkable*. A reversed decision can only be checked for never being prescribed again because
layer 3 is dated and never edited, and the byte-freeze applies to layers 3 and 4 and to nothing
else. So the wizard's interview question is one a human can answer in a sentence — *what happens
when this file turns out to be wrong?* — and it selects the assertions.

## The drift checker

[`bin/generate-checker.mjs`](bin/generate-checker.mjs) is a program, not a template a model copies.
It reads `.seam/config.json` and emits the checker in **Python 3 (stdlib only)** or **Node `.mjs`**,
both implementing the same assertions with the same output format, so a repo can switch languages
without changing what is enforced. The test suite runs both on every fixture and compares their
findings, because that claim is only true if it is checked.

The emitted checker **reads the config at run time**. That is what makes "every repo-specific knob
lives in the config, never edited into the script" true, and therefore what makes regenerating
always safe. A repo's own assertions live in `.seam/assertions/*`, which the checker discovers and
a regeneration never overwrites.

Three things make it refuse to run at all, because the alternative is a check that looks like a
pass: a config with no assertion enabled, an allow-list entry with no written reason or no path,
and an enabled set that is not the one `.seam/provenance.json` records — the last so that a switch
flipped by hand, A16's own included, cannot quietly change what is measured.

### The baseline

Run the checker once with `--write-baseline` and it records every current violation to
`.seam/baseline.json` — assertion id, file, line, matched text. After that it fails only on
violations not in it. **An ordinary run never writes the baseline**, so a repo with no baseline
file is a repo that reds on its day-one drift.

`/seam:audit` prints the count on every run, so it stays visible and is expected to shrink.
Matching is exact on all four fields, so a violation whose line no longer matches drops out rather
than being carried forever.

A baseline entry is **a debt with a number on it, not an approval.** An allow-list entry is the
other thing: it needs a **written reason** — the checker refuses one without it — and it means
"this will never be fixed". The baseline is its own file; an allow-list lives under the assertion
it exempts, in `.seam/config.json`. Two places, two rules, and the difference is the point.

## What init writes

- The repo's **context file** — the sources-of-truth table, between
  `<!-- seam:sources-of-truth start -->` and `<!-- seam:sources-of-truth end -->`. Nothing outside
  the markers is touched. The default host is `CLAUDE.md`; which file hosts it is a config key.
- `.seam/config.json` — the machine-readable projection: each doc's path and layer, load-bearing
  globs, `low`-review paths, domains, milestones, artifacts, assertion switches and their
  allow-lists, and the checker's language and path.
  [`skills/seam-docs/references/interview.md`](skills/seam-docs/references/interview.md) § Schema
  is the full key list; the three priorities are not in it, because they are fixed by the method
  and live in the repo's own `docs/taxonomy.md`.
- `.seam/provenance.json` — the answers file's path, two sha256 hashes (that file, and the config
  just written), and the set of assertions this run enabled. Assertion A16 compares the hashes on
  every run, because the answers file is the source and the config is its projection: a config
  edited by hand is reverted by the next regeneration without a word, which is measured rather
  than hypothetical. The enabled set is read by a **refusal** rather than an assertion, because
  A16's own switch lives in the file A16 protects — so flipping it and editing the config in one
  write would otherwise be silent.

  **Upgrading from 0.1.x:** this file did not exist before 0.2.0, so a repo that adopted earlier has
  no record. Its own 0.1.x checker carries no precondition and keeps passing; it is the **0.2.0
  checker that exits 2 until `seam-init` is re-run**. Regenerating the checker alone is not
  enough — the checker does not write the record, the wizard does. The refusal names the command.
  Skipping the check when the record is absent was the obvious alternative and was rejected: it is
  the same defeat with one extra step, since deleting the file would then buy silence.
- `.seam/baseline.json` — day-one drift, written by `--write-baseline`.
- The docs you approved, one per layer, from
  [`skills/seam-docs/templates/`](skills/seam-docs/templates).
- `.claude/agents/*.md`, if the answers name any — because a useful agent is scoped to a repo's
  seams and a generic one is worse than none.
- The generated checker, and a CI job for it **only if no workflow exists yet**. If a workflow
  already exists, `init` prints the job and changes nothing — **so you add it yourself**, or
  assertion A3 reds on the first run with "documented as a check but no CI step runs it". That
  failure is unfinished setup, not baseline material. The byte-freeze also needs the default
  branch's history, so the checkout step wants `fetch-depth: 0` — necessary, because a shallow
  clone has nothing to compare against, but not sufficient by itself: a pull request is checked out
  as a detached HEAD, where the default branch exists only as `origin/<branch>`. The checker tries
  `<branch>` and then `origin/<branch>`, so a checkout that fetched the branch in either form
  works; one that fetched neither reports the comparison as not made, and says so.

On a repo that already has docs it **never rewrites an existing doc's body.** It proposes what each
file currently owns and which layer it is; reshaping a file is a separate, opt-in step.

## Commands

| Command | Does | Without the slash command |
|---|---|---|
| `/seam:init` | The wizard. Reads the repo, proposes the doc layers, writes what you approve. | — (it is an interview) |
| `/seam:init --answers <file>` | The same interview from a recorded answers file — deterministic, re-runnable in CI. | `node bin/seam-init.mjs --answers <file> --repo .` |
| `/seam:audit` | Runs the repo's generated checker, reports drift and the baseline count. | `python3 scripts/check_docs.py` or `node scripts/check_docs.mjs` |

## Where the rules live

| Skill | Owns |
|---|---|
| `seam-docs` | The wizard: inventory, layer classification, the sources-of-truth table, the templates. |
| `seam-checks` | Generating and maintaining the drift checker. |
| `seam-build` | Working against the plan: naming the unit that owns a change, its test, and what done means. |
| `seam-context` | How much of a session's window a piece of work may spend, and when work goes to a subagent. |
| `seam-github` | Issues, branches, commits, PRs, and the commit gate. |
| `seam-review` | How to pick a review level and run the rounds. |

Each skill's job at work time is: **locate the repo's doc, read it, follow it.** A skill never
answers a question the repo's doc answers — that is what keeps there from being two copies of a
decision. For the same reason **this README states no rule that a skill owns**: the four follow-up
dispositions, the review level table, the round bound and its measurements, and the shape every
layer's doc has to take live in exactly one place each, and these are the places:

| Looking for | Read |
|---|---|
| The six layers, their edit rules, and which assertions reach which layer | [`skills/seam-docs/references/layers.md`](skills/seam-docs/references/layers.md) |
| The question set, and `.seam/config.json`'s full schema with every key | [`skills/seam-docs/references/interview.md`](skills/seam-docs/references/interview.md) |
| Adopting a repo that already has docs, and what the evidence does not reach | [`skills/seam-docs/references/adopt.md`](skills/seam-docs/references/adopt.md) |
| What each of the sixteen assertions reads, and what it deliberately does not | [`skills/seam-checks/references/assertions.md`](skills/seam-checks/references/assertions.md) |
| Issues, commits, PRs, the four dispositions, the gate | [`skills/seam-github/SKILL.md`](skills/seam-github/SKILL.md) · [`references/templates.md`](skills/seam-github/references/templates.md) |
| The review level table, the bound, the three triggers | [`skills/seam-review/SKILL.md`](skills/seam-review/SKILL.md) |
| The start and finish contracts, the test-first rule, and the three sizes | [`skills/seam-build/SKILL.md`](skills/seam-build/SKILL.md) · [`templates/current/building.md`](skills/seam-docs/templates/current/building.md) |
| The context thresholds, what triggers a level, and when to dispatch | [`skills/seam-context/SKILL.md`](skills/seam-context/SKILL.md) · [`templates/current/context.md`](skills/seam-docs/templates/current/context.md) |

## Tech stack

| Layer | Tech |
|---|---|
| Plugin host | Claude Code — skills, commands, `.claude-plugin/plugin.json` |
| Generator | Node, ES modules, **no dependencies** |
| Emitted checker | Python 3 (stdlib only) **or** Node `.mjs` — same assertions, same output format |
| Tests | `node:test` + `node:assert`, over a planted-drift fixture repo |
| Skill tests | `claude plugin eval` — graders on files written, tools used, and judged responses |
| CI | GitHub Actions |

## Testing

```bash
node --test                          # the generator and both emitted checkers
node scripts/check_docs.mjs          # seam's own docs, by its own checker
claude plugin validate --strict .    # manifests, skills, commands
```

`node --test` takes **no positional argument**: on Node 24 a bare directory positional is resolved
as a module, so discovery is left to node.

[`tests/fixtures/clean/`](tests/fixtures/clean) is a complete, green repo and every checker test is
**one mutation of it** — so a finding can only have come from that change. There is one planted
drift per assertion, and both emitted languages run on every fixture and are compared.

The skills are tested separately, because each case costs a model run:

```bash
claude plugin eval . --allow-tools Write Edit Bash --trust-plugin
```

`--allow-tools` is not optional — `Write`, `Edit` and `Bash` are gated by default, and a wizard
that cannot write anything scores zero for the wrong reason. The `with-without` ablation arm is the
number worth reading: it says whether the plugin changed the outcome or the model would have
managed anyway. [`evals/README.md`](evals/README.md) has what the grader schema can and cannot do,
as measured.

## Continuous integration

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs the test suite and seam's own generated
checker. Assertion A3 holds the documented check list in
[`docs/contributing.md`](docs/contributing.md) § Checks against that workflow, so the two cannot
drift apart — the method applied to itself rather than only described. It caught its own author
within a minute of being wired: the CI step existed and the list did not name it.

## Docs & decisions

seam carries a sources-of-truth table of its own, and its own checker runs over it.

| Doc | Layer | Owns |
|---|---|---|
| [`docs/contributing.md`](docs/contributing.md) | 2 Current | How work on seam is done, and the sources-of-truth table's host file |
| [`docs/taxonomy.md`](docs/taxonomy.md) | 2 Current | The domain labels, the three priorities, and the milestones |
| [`docs/decisions.md`](docs/decisions.md) | 3 Decisions | What was chosen, the options rejected, and why — plus in-flight rulings and direction corrections |

Layer 3 is settled: `docs/decisions.md` holds decisions, rulings taken in flight, and direction
corrections — the last because a live "not that way" otherwise dies in a session transcript. It is
append-only, and assertion A12 holds it to that by checking that what is on the default branch is an
unbroken prefix of the file, so an append passes and an edit does not.

One thing is open, and recorded as a question rather than guessed at: whether seam needs a layer-4
PRD, given that this README is the intent and is public.

**Why the table lives in `docs/contributing.md` and not `CLAUDE.md`:** this repo is simultaneously
the plugin and the project, and `claude plugin validate --strict` refuses a `CLAUDE.md` at a plugin
root. The method's default host is still `CLAUDE.md`; which file hosts the table is the
`table.file` key in `.seam/config.json`.

## License

[MIT](LICENSE) © Mitya Kurs
