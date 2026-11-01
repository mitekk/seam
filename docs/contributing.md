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
| `docs/building.md` | 2 Current | The start contract, the finish contract, the test-first rule, and the proportionality rule with its three sizes |  |
| `docs/context.md` | 2 Current | The threshold table, what triggers a level, the dispatch rule, and where a session's own artifacts live |  |
| `docs/routing.md` | 2 Current | The model and effort pinned per artifact, and this repo's agent shape |  |
| `docs/decisions.md` | 3 Decisions | What was chosen, the options rejected, and why — plus in-flight rulings and direction corrections | `node --test tests/red-proof.test.mjs` |
| `docs/superpowers/specs/*.md` | 5 Seam | Nothing — dated design documents. Superseded wholesale; a design that changes is rewritten or replaced, never amended into agreement with what shipped |  |
| `docs/superpowers/plans/*.md` | 5 Seam | Nothing — implementation plans. Superseded wholesale; a plan whose shape changes is rewritten, never amended into agreement with what shipped |  |
| `docs/findings-ledger.md` | 6 Ledger | Nothing — true observations about this tree that are not becoming work |  |

**Layer** fixes the edit rule, because the question behind it is *what happens when this file
turns out to be wrong*:

| # | Layer | When it's wrong | Edit rule |
|---|---|---|---|
| 1 | Artifact | cannot be — it *is* the code | changes with the code |
| 2 | Current | a bug | amend in place |
| 3 | Decisions | never — the record stands | append-only, dated; a reversal is a new entry |
| 4 | Intent | expected | immutable versions; supersede with vN+1 |
| 5 | Seam | expected | superseded wholesale |
| 6 | Ledger | n/a | append-only rows |

**Enforces** names the artifact that holds a row to its word — a constraint, an index, a CI
assertion. An empty cell means the row owns documentation and nothing more. `.seam/config.json`
carries the same set as `load_bearing`, and assertion A11 compares the two.

Authority is not one chain, because the layers answer different questions:

- **On what is true now:** Artifact beats Current, and nothing else may answer at all.
- **On why it is this way:** Decisions beat Current. A Current doc that gives a rationale cites
  the record rather than restating it.
- **On what we intend:** Intent beats Seam.
- **Seam and Ledger own nothing** and lose to everything by construction. They are in this table
  so they are *findable*, not because they answer anything — here that is 5 Seam and 6 Ledger.

<!-- seam:sources-of-truth end -->

## Checks

```bash
node --test                                    # the generator and both emitted checkers
node scripts/check_docs.mjs                    # seam's own docs agree with each other
claude plugin validate --strict .              # manifests, skills, commands
```

**seam runs its own checker on itself**, and `.github/workflows/ci.yml` runs it too — assertion A3
compares this list against that workflow, so the two cannot drift apart. It caught its own author
within a minute of being wired: the CI step existed and this list did not name it.

`node --test` takes **no positional argument**. `node --test tests/` fails on Node 24 with
`Cannot find module .../tests` — a bare directory positional is resolved as a module rather than
scanned — so discovery is left to node, which finds `tests/**/*.test.mjs` and skips
`tests/helpers.mjs` because it is not named as a test.

`claude plugin validate --strict --profile directory .` additionally fails on a missing listing
icon. That is a submission asset and not a correctness check, so it is not in the list above.

The eval suite is a separate gate because it costs a model run per case:

```bash
claude plugin eval . --allow-tools Write Edit Bash --trust-plugin
```

`--allow-tools` is not optional: `Write`, `Edit` and `Bash` are gated by default, and a wizard that
cannot write anything scores zero for the wrong reason. There is deliberately no `--scaffold`:
**measured, no scaffold hook works on this build** — `scaffold_script` is rejected in `prompt.md`
frontmatter and silently does nothing in `case.yaml` — so each case carries its fixture inline in
the prompt instead. `evals/README.md` has the rest of the grader schema as it actually behaves.

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
- **Prose wraps at about 100 columns. It is a target, not an assertion, and it has exemptions.**
  The point is a diff that reads in one pane, so what is exempt is anything that **cannot** wrap
  without changing meaning: a **markdown table row**, which would become two rows; a line inside
  a **fenced block**, which is content; and a line held over the budget by **one unbreakable
  token**, a URL or a path longer than the budget itself. Everything else is prose, and prose is
  wrapped. This is written down because it was enforced on four tasks' worth of work while
  appearing nowhere in the repo, and enforced wrongly — the interview reference, which is almost
  entirely table, broke it 25 times, the longest row at 809 characters, and two of the longest
  were written under the rule.

  **`docs/superpowers/` is exempt as a tree**, and for a reason rather than for convenience: it is
  layer 5, superseded wholesale, so its files are **rewritten, never amended** — rewrapping one
  would be an edit its own edit rule does not have. Its long lines are therefore not offenders and
  the command below does not report them.

  **The tree does not hold to the target exactly**, which is why it is "about" and why nothing
  asserts it. What a new paragraph is held to is the number; what the tree is held to is nobody
  rewrapping a file to chase it. The overflow is one command, which implements the three
  exemptions above and names the lines rather than a count that goes stale:

  ```bash
  for f in $(git ls-files '*.md' | grep -v '^docs/superpowers/'); do
    awk -v F="$f" '
      BEGIN { fencepat = "^[ \t]*" sprintf("%c%c%c", 96, 96, 96) }
      $0 ~ fencepat { fence = !fence; next }
      fence || /^[ \t]*\|/ { next }
      length($0) <= 100 { next }
      { longest = 0; n = split($0, t, /[ \t]+/)
        for (i = 1; i <= n; i++) if (length(t[i]) > longest) longest = length(t[i])
        if (longest <= 100) print F":" NR " (" length($0) ")" }
    ' "$f"
  done
  ```

  The fence test is built with `sprintf` rather than written as a literal, because three backticks
  inside a fenced block would close the block this command lives in.

## Process

- Issues, branches, commits and PRs follow `skills/seam-github/SKILL.md` — seam's own tracker is
  the first consumer of it.
- Review level comes from `skills/seam-review/SKILL.md`'s table, applied to seam's own diffs:
  `high` for `bin/` and the checker templates, which are the measuring apparatus; `medium` for
  the skills and for this file.
- Push and merge need an explicit OK, every time.
