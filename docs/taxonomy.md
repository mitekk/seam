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
| `docs` | `docs/`, `CLAUDE.md` — seam's own doc layer, eating its own dog food |

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

| # | Milestone | Green when |
|---|---|---|
| 0 | Skeleton | `claude plugin validate --strict .` passes |
| 1 | The doc wizard, greenfield | the wizard runs end to end on a scratch repo from an answers file, emitting all six layers |
| 2 | The adopt path | a read-only run against a repo that already has a table reconstructs it, layers included |
| 3 | The drift checker | a clean fixture exits 0, each planted drift exits 1 naming its assertion, baselined violations pass while moved ones fail, and both emitted languages report identically |
| 4 | GitHub conventions | the eval suite scores issue shape, PR shape and the gate's refusal |
| 5 | The review policy | eval cases present diffs and the chosen level matches the table |
| 6 | First real adoption | the adopted repo carries no decision the plugin also carries, and its checker runs clean against its own baseline |

## The tracker itself

There is no remote yet. Creating the GitHub repo, the labels and the milestones is outward-facing
and needs an explicit OK; until then this file is the taxonomy and `scripts/bootstrap-tracker.sh`
is what creates it.
