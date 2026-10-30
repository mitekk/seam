# Contributing to seam

**Layer 2 — Current.** How work on seam itself is done. Wrong here is a bug; amend in place.

`README.md` is the one-page method a consumer reads. This file is seam's own instance of it, and
it hosts seam's sources-of-truth table.

**Why this is not `CLAUDE.md`.** This repo is simultaneously the plugin and the project, and
`claude plugin validate --strict .` refuses a `CLAUDE.md` at a plugin root — it is not loaded as
plugin context, so shipping one is a warning, and `--strict` makes a warning an error. The
method's default host for the table is still `CLAUDE.md`; which file hosts it is the
`table.file` key in `.seam/config.json`, which assertion A10 needs anyway. seam's own value is
this file.

seam uses its own conventions on its own tracker from day one. If they are wrong, they are wrong
where we feel it first.

## Sources of truth — read before changing related code

<!-- seam:sources-of-truth start -->

Every doc under `docs/` is in this table with a layer, or it is drift (assertion A10). A lower
layer **cites** a higher one and never restates it.

| Doc | Layer | Owns | Enforces |
|---|---|---|---|
| `docs/contributing.md` | 2 Current | How work on seam is done, and this table's host file | `claude plugin validate --strict .` |
| `docs/taxonomy.md` | 2 Current | The domain labels, the three priorities, and the milestones | `scripts/bootstrap-tracker.sh` |

Authority, by question asked:

- **What is true now:** Artifact (layer 1) beats Current (layer 2), and nothing else may answer.
- **Why it is this way:** Decisions (layer 3) beat Current. A Current doc that gives a rationale
  cites the ADR rather than restating it.
- **What we intend:** Intent (layer 4) beats Seam (layer 5).
- **Seam and Ledger own nothing** and lose to everything, by construction.

<!-- seam:sources-of-truth end -->

## Checks

```bash
node --test                                    # the generator and both emitted checkers
claude plugin validate --strict .              # manifests, skills, commands
```

`node --test` takes **no positional argument**. `node --test tests/` fails on Node 24 with
`Cannot find module .../tests` — a bare directory positional is resolved as a module rather than
scanned — so discovery is left to node, which finds `tests/**/*.test.mjs` and skips
`tests/helpers.mjs` because it is not named as a test.

`claude plugin validate --strict --profile directory .` additionally fails on a missing listing
icon. That is a submission asset and not a correctness check, so it is not in the list above.

The eval suite is a separate gate because it costs a model run per case:

```bash
claude plugin eval . --allow-tools Write Edit Bash --scaffold
```

## Test-first

TDD is the default. `bin/generate-checker.mjs` and the emitted checkers get real tests with
planted-drift fixtures, written first. The skills get eval cases — prompt and graders written
**before** the `SKILL.md` they grade.

**One exemption class: non-deterministic output.** For a model call there is no failing test for
"it got the right answer". What is written first is the deterministic contract — the schema the
response must parse into, its rejection cases, the failure path.

**The probe rule:** if the thing has procedural logic you can run, run it. "Hard to test" is not
an exemption; only "non-deterministic" is.

## Hard conventions

- **The plugin holds method and templates, never decisions.** A skill's job at work time is:
  locate the repo's doc, read it, follow it. Its prose covers how to write that doc and what to do
  when it is missing — it never answers a question the doc answers.
- **Two artifacts per adopting repo**, neither of them in the plugin: `docs/**` (the human copy)
  and `.seam/config.json` (the machine projection). A11 asserts they agree.
- **The generator is a program, not a prompt.** `bin/generate-checker.mjs` emits the checker;
  nobody hand-copies a template into a repo.
- **Repo-specific knobs live in `.seam/config.json`**, never edited into the emitted script, so
  regeneration is always safe.
- **No dependencies** in the generator or in either emitted checker. Node for the generator
  because Claude Code already runs on it; Python 3 stdlib only on the other side.
- **The two emitted checkers are one implementation written twice**, and the test suite runs both
  on every fixture and compares their findings. A change to one is a change to both, in the same
  commit, or the claim that a repo can switch languages without changing what is enforced stops
  being true.
- **The emitted checker reads `.seam/config.json` at run time**, rather than having the config
  baked in by the generator. That is what makes "every knob lives in the config, never edited into
  the script" true, and therefore what makes regeneration safe.
- **The wizard never rewrites an existing doc's body**, and touches `CLAUDE.md` only between its
  two markers.

## Process

- Issues, branches, commits and PRs follow `skills/seam-github/SKILL.md` — seam's own tracker is
  the first consumer of it.
- Review level comes from `skills/seam-review/SKILL.md`'s table, applied to seam's own diffs:
  `high` for `bin/` and the checker templates, which are the measuring apparatus; `medium` for
  the skills and for this file.
- Push and merge need an explicit OK, every time.
