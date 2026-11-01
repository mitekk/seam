# Taxonomy

**Layer 2 — Current.** What is true now about seam's own tracker. Wrong here is a bug; amend in
place.

Owns: the domain labels, the three priorities, and the milestones. Nothing else may define them —
`.seam/config.json` carries the machine mirror. The two are kept in step by hand: no checker
assertion compares them, so a drift between them is not caught.

## Domains

One domain per source-of-truth row, which is the usual mapping and holds here exactly.

| Domain | Covers |
|---|---|
| `wizard` | `skills/seam-docs/` — the interview, the layer classification, the templates |
| `checker` | `bin/generate-checker.mjs`, `skills/seam-checks/`, the emitted checker templates |
| `github` | `skills/seam-github/` — issues, branches, commits, PRs, the gate |
| `review` | `skills/seam-review/` — the level table, the rounds, the triggers |
| `plugin` | `.claude-plugin/`, `commands/`, `README.md` — what a consumer installs and reads |
| `tests` | `tests/`, `evals/` — the probe rule's half and the skills' half |
| `docs` | `docs/` — seam's own doc layer, eating its own dog food |

Kind stays on GitHub's defaults: `bug`, `enhancement`, `documentation`.

If work needs a domain that is not in that list, propose it rather than inventing a label
silently. A taxonomy only pays for itself while it is small and stable.

## Priorities

Three values, by **consequence** rather than by feeling.

| Priority | Means |
|---|---|
| `p0` | A live defect someone outside this repo sees, or a blocker on the active milestone |
| `p1` | In the active milestone |
| `p2` | Later |

## Milestones

The build order. Each ends green before the next starts, and each produces a reviewable diff.

**"Green when" is a completion condition, not a level.** The word carries a second sense in this
method — a share of the session window a piece of work has spent, where Green is the lowest
band — and the two live in different files for different readers. Nothing here is a budget: a
milestone's cell is what has to be *true* before the next row starts. Where this repo also writes
a context budget down, that doc owns the other sense and this table never refers to it.

| # | Milestone | Green when | Active |
|---|---|---|---|
| 1 | Establish the field — seam is **brownfield** | the determination is recorded, with the reason it was made | no |
| 2 | Skeleton | `claude plugin validate --strict .` passes | no |
| 3 | The doc wizard, greenfield | the wizard runs end to end on a scratch repo from an answers file, emitting all six layers | no |
| 4 | The adopt path | a read-only run against a repo that already has a table reconstructs it, layers included | no |
| 5 | The drift checker | a clean fixture exits 0, each planted drift exits 1 naming its assertion, baselined violations pass while moved ones fail, and both emitted languages report identically | no |
| 6 | GitHub conventions | the eval suite scores issue shape, PR shape and the gate's refusal | no |
| 7 | The review policy | eval cases present diffs and the chosen level matches the table | no |
| 8 | First real adoption | the adopted repo carries no decision the plugin also carries, and its checker runs clean against its own baseline | yes |

**Milestone 1 is the method's, and it is green on arrival.** Every repo adopting seam has it:
establishing whether the repo is green or brown field is the first step to getting the rest
straight, and everything after it depends on it — the proposal, the baseline, the never-rewrite
rule, and which assertions can run at all. It is recorded in `.seam/answers.json` before any of
this file can be written, so it is never the active milestone, which is why seam's own build
order starts at 2.

**Why seam is brownfield:** as a tree it already has docs — this file, `docs/contributing.md`
with the sources-of-truth table in it, `docs/decisions.md`, three more layer-2 docs, and the
assertions `.seam/config.json` enables over them — `node scripts/check_docs.mjs` prints how
many. That is the adopt path. It is a judgement about the
tree **as it stands**, not about its history: every doc here was written by this method, from an
empty repo, and without that sentence "brownfield" reads as an error later.

**Row 8 is active, and it is derived rather than preferred.** Every row's *Green when* column is
checkable, and 8's is the only one that is false: nothing has adopted seam yet, so no adopted repo
exists to carry a decision or to run a checker against its own baseline. Rows 1 to 5 are met by
things this repo runs: the determination is recorded, `claude plugin validate --strict .`
passes, and `node --test tests/*.test.mjs` exercises the wizard end to end from an answers file,
the adopt path's inventory, and every assertion in both emitted languages. Rows 6 and
7 are met by the cases under `evals/` existing and scoring those things, not by a score read here:
**the eval suite costs a model run per case and nothing in § Checks runs it**, so a claim about
what it scored today would not be traceable. Row 8 is therefore the row the priority rule reads
for `p1`, and the row `p0`'s second clause blocks against.

The rows above are `milestones[]` in `.seam/answers.json`, projected into `.seam/config.json`,
with `"active": true` on 8 and `false` on the rest — kept in step with this column by hand, as
this file says above. Milestone 1 is not among them: it is the method's row, green on arrival, and
the paragraph above says why it is never the active one.

## What this does not own

- **Which issues build a subsystem, in what order.** That is layer 5, under
  `docs/superpowers/plans/`. This file says what the milestones *are*; a plan says what goes in
  one.
- **Why a domain exists.** If the reasoning matters it is a decision record, and this file cites
  `docs/decisions.md` rather than restating it.
- **The issue, commit and PR shapes.** Those are conventions rather than facts about this repo,
  and `skills/seam-github/SKILL.md` owns them.

## The tracker itself

There is no remote yet. Creating the GitHub repo, the labels and the milestones is outward-facing
and needs an explicit OK; until then this file is the taxonomy and `scripts/bootstrap-tracker.sh`
is what creates it.
