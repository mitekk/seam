# seam

**Docs are the seam between work units.** `seam` installs a layered, mechanically-enforced
documentation method into a repo — greenfield, or one that already has docs it does not trust.

What a repo gets:

- A **sources-of-truth table** in `CLAUDE.md`, where every doc is listed by *what it owns* and
  which **layer** it belongs to.
- A **drift checker**, generated into the repo in its own language, that fails CI when prose and
  code disagree. Thirteen assertions; a baseline so day-one debt is a number rather than a wall.
- **Issue, commit and PR conventions** that make scope discipline visible — one priority, one
  milestone, one or two domains, and four dispositions for everything you noticed along the way.
- A **review policy** that picks its level from what the diff touches, not from habit, and stops
  after two rounds for a measured reason.

None of it is seam's content. Every decision lives in the repo's own `docs/`; the plugin holds
the method and the templates.

## Install

```bash
claude plugin marketplace add /path/to/seam
claude plugin install seam@seam
```

**Then restart Claude Code.** A plugin installed mid-session is not loaded into that session, so
`/seam:init` will not exist until you start a new one — both commands report success and the
command is still missing. Once restarted, in the repo you want the method in:

```
/seam:init
```

### If `/seam:init` is not there

You are in the session that installed it. Restart. If you would rather not, the wizard's
deterministic half is a plain program and works without the plugin being loaded:

```bash
# 1. Write an answers file. Its schema, and the question set behind it, are in
#    skills/seam-docs/references/interview.md — read that, not this README.
# 2. Then:
node /path/to/seam/bin/seam-init.mjs --answers answers.json --repo . --dry-run
node /path/to/seam/bin/seam-init.mjs --answers answers.json --repo .
node /path/to/seam/bin/generate-checker.mjs --repo . --write-baseline
```

**Do not hand-write `.seam/config.json`.** Every assertion is opt-in per id, and a config with no
`assertions` block emits a checker that enables **nothing** and exits 0 on everything — which the
checker itself now refuses rather than allowing. The wizard fills the defaults; that is most of
what it is for.

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

Authority is not one chain, because the layers answer different questions:

- **On what is true now:** Artifact beats Current, and nothing else may answer at all.
- **On why it is this way:** Decisions beat Current. A Current doc that gives a rationale *cites*
  the ADR rather than restating it.
- **On what we intend:** Intent beats Seam.
- **Seam and Ledger own nothing** and lose to everything, by construction.

**The rule that spans all six: a lower layer cites a higher one, never restates it.** That is the
rule the whole enforcement layer exists to protect.

## Commands

| Command | Does | Without the slash command |
|---|---|---|
| `/seam:init` | The wizard. Reads the repo, proposes the doc layers, writes what you approve. | — (it is an interview) |
| `/seam:init --answers <file>` | The same interview from a recorded answers file — deterministic, re-runnable in CI. | `node bin/seam-init.mjs --answers <file> --repo .` |
| `/seam:audit` | Runs the repo's generated checker, reports drift and the baseline count. | `python3 scripts/check_docs.py` or `node scripts/check_docs.mjs` |

## Skills

| Skill | Owns |
|---|---|
| `seam-docs` | The wizard: inventory, layer classification, the sources-of-truth table, the templates. |
| `seam-checks` | Generating and maintaining the drift checker. |
| `seam-github` | Issues, branches, commits, PRs, and the commit gate. |
| `seam-review` | How to pick a review level and run the rounds. |

Each skill's job at work time is: **locate the repo's doc, read it, follow it.** A skill never
answers a question the repo's doc answers — that is what keeps there from being two copies of a
decision. For the same reason **this README states no rule that a skill owns**: the four follow-up
dispositions, the review level table, the round bound and its measurements, and the shape every
layer's doc has to take live in exactly one place each, and these are the places:

| Looking for | Read |
|---|---|
| The six layers, their edit rules, and which assertions reach which layer | `skills/seam-docs/references/layers.md` |
| The question set, and `.seam/config.json`'s full schema with every key | `skills/seam-docs/references/interview.md` |
| Adopting a repo that already has docs, and what the evidence does not reach | `skills/seam-docs/references/adopt.md` |
| What each of the thirteen assertions reads, and what it deliberately does not | `skills/seam-checks/references/assertions.md` |
| Issues, commits, PRs, the four dispositions, the gate | `skills/seam-github/SKILL.md` and `skills/seam-github/references/templates.md` |
| The review level table, the bound, the three triggers | `skills/seam-review/SKILL.md` |

## What `init` writes

- `CLAUDE.md` — the sources-of-truth table, between `<!-- seam:sources-of-truth start -->` and
  `<!-- seam:sources-of-truth end -->`. Nothing outside the markers is touched.
- `.seam/config.json` — the machine-readable projection: each doc's path and layer, load-bearing
  globs, `low`-review paths, domains, milestones, artifacts, assertion switches and their
  allow-lists, and the checker's language and path. **`skills/seam-docs/references/interview.md`
  § Schema is the full key list**; the three priorities are not in it, because they are fixed by
  the method and live in the repo's `docs/taxonomy.md`.
- `.seam/baseline.json` — every violation that existed on day one, so the checker fails only on
  new ones. Written by `--write-baseline`, never by an ordinary run.
- The docs you approved, one per layer, from `templates/`.
- The generated checker, and a CI job for it **only if no workflow exists yet**. If a workflow
  already exists, `init` prints the job and changes nothing — **so you add it yourself**, or
  assertion A3 reds on the first run with "documented as a check but no CI step runs it". That
  failure is unfinished setup, not baseline material. A12 also needs the default branch's history,
  so the checkout step wants `fetch-depth: 0`.

On a repo that already has docs it **never rewrites an existing doc's body.** It proposes what
each file currently owns and which layer it is; reshaping a file is a separate, opt-in step.

## The baseline

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

## Working on seam

`docs/contributing.md` is the full version — the sources-of-truth table, the conventions and
the checks. In short:

```bash
node --test                                   # the generator and the emitted checkers
node scripts/check_docs.mjs                   # seam's own docs, by its own checker
claude plugin validate --strict .             # manifests and components
claude plugin eval . --allow-tools Write Edit Bash --trust-plugin   # the skills
```

`docs/contributing.md` § Checks is the authoritative list and `.github/workflows/ci.yml` runs it;
assertion A3 holds the two against each other. `--allow-tools` is not optional for the evals —
`Write`, `Edit` and `Bash` are gated by default, and a wizard that cannot write anything scores
zero for the wrong reason.

`bin/generate-checker.mjs` is a real program, not a template a model copies: it reads
`.seam/config.json` and emits the checker in Python 3 (stdlib only) or Node `.mjs`, both
implementing the same assertions with the same output format. No dependencies either side.
