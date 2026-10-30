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

Then, in the repo you want the method in:

```
/seam:init
```

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

| Command | Does |
|---|---|
| `/seam:init` | The wizard. Reads the repo, proposes the doc layers, writes what you approve. |
| `/seam:init --answers <file>` | The same interview from a recorded answers file — deterministic, re-runnable in CI. |
| `/seam:audit` | Runs the repo's generated checker, reports drift and the baseline count. |

## Skills

| Skill | Owns |
|---|---|
| `seam-docs` | The wizard: inventory, layer classification, the sources-of-truth table, the templates. |
| `seam-checks` | Generating and maintaining the drift checker. |
| `seam-github` | Issues, branches, commits, PRs, and the commit gate. |
| `seam-review` | How to pick a review level and run the rounds. |

Each skill's job at work time is: **locate the repo's doc, read it, follow it.** A skill never
answers a question the repo's doc answers — that is what keeps there from being two copies of a
decision.

## What `init` writes

- `CLAUDE.md` — the sources-of-truth table, between `<!-- seam:sources-of-truth start -->` and
  `<!-- seam:sources-of-truth end -->`. Nothing outside the markers is touched.
- `.seam/config.json` — the machine-readable projection: each doc's layer, load-bearing globs,
  `low`-review paths, domains, priorities, assertion switches, allow-lists, checker language.
- `.seam/baseline.json` — every violation that existed on day one, so the checker fails only on
  new ones.
- The docs you approved, one per layer, from `templates/`.
- The generated checker, and a CI job for it **only if no workflow exists yet**.

On a repo that already has docs it **never rewrites an existing doc's body.** It proposes what
each file currently owns and which layer it is; reshaping a file is a separate, opt-in step.

## The baseline

The first checker run writes every current violation to `.seam/baseline.json` — assertion id,
file, line, matched text — and the checker then fails only on violations not in it. `/seam:audit`
prints the count on every run, so it stays visible and is expected to shrink.

A baseline entry is **a debt with a number on it, not an approval.** An allow-list entry is the
other thing: it needs a written reason and means "this will never be fixed". They are separate
files for exactly that reason.

## Working on seam

`docs/contributing.md` is the full version — the sources-of-truth table, the conventions and
the checks. In short:

```bash
node --test                                   # the generator and the emitted checkers
claude plugin validate --strict .             # manifests and components
claude plugin eval . --allow-tools Write Edit Bash --scaffold   # the skills
```

`bin/generate-checker.mjs` is a real program, not a template a model copies: it reads
`.seam/config.json` and emits the checker in Python 3 (stdlib only) or Node `.mjs`, both
implementing the same assertions with the same output format. No dependencies either side.
