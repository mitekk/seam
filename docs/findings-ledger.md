# Findings ledger

**Layer 6 — Ledger.** True observations about this repo that are **not becoming work**. Rows are
**append-only**: a row is a record, not a commitment, so it is not edited to soften it and not
deleted when it stops mattering — it is struck through with a line saying what changed.

**This file owns nothing, and that is the point.** A row here is not a plan, not a promise and
not a priority. It is the disposition for something noticed along the way that the repo is **not
going to do**: not done in the branch in flight, and not worth an issue either.

What belongs here: something **true**, that passes **no clause** of the follow-up qualifier — not
a bug someone outside the repo sees, not an exposure on anything load-bearing, and not a blocker
on the active milestone. Anything that passes a clause is an issue instead. Anything done in the
branch in flight, or filed, gets no row — a row is only for what is not being done — and an item
too big to do in the branch that still passes no clause **is** a row here, because the qualifier
turned it away and nothing else carries it.

What does **not** belong here: a review finding left unfixed. That is the opposite claim — it
matters and has not been settled — and filing it under a header that says it owns nothing is the
one thing it must not say. A finding left unfixed is named when the commit is offered, and
nowhere else.

A row that later blocks the active milestone qualifies on that clause and becomes an issue then.

---

## seam

| Date | Domain | Observation |
|---|---|---|
| 2026-11-01 | `checker` | **The config-shape refusal covers what A1, A10 and A11 index, and stops there.** Still able to traceback, with differing messages between the two languages: entries of `A3.doc_sections`, `A4.artifacts`, `A5.vocabularies`, `A6.retired`, `A7.reversed` and `A9.count_sites`; the types of `adr.format`, `prd.dir`, `baseline.path` and `checker.*`; and a repo-invented module that throws. Not becoming work: the shape pass closed the readers an adopter's day-one config actually exercises, and the rest is reachable only by hand-writing a malformed config, which the wizard does not produce. `skills/seam-checks/references/assertions.md` § The refusals scopes its own claim to configs shaped like the wizard's, and says so where a reader meets it. |
| 2026-11-01 | `checker` | **Three pattern keys are compiled raw.** `A7.reversed[i].pattern`, `A9.count_sites[i].pattern` and `A3.extra_tokens[i]` go to the regex engine without `portable_regex`, so `"("` is a `re.error` in Python against a `SyntaxError` in Node — one config, two endings. Not becoming work: scoping what a repo's own regex may contain is a policy decision rather than a shape check, and the value is reachable only from a hand-written config. `skills/seam-checks/references/assertions.md` § The refusals already carries the same three keys with the same reason, so the doc and this row agree. |
| 2026-11-01 | `checker` | **A2 is silent on a `§` beside a path padded with U+FEFF.** The trim set is ASCII on purpose — `trim()` and `strip()` disagree about U+FEFF and U+0085, and both emissions have to read one doc identically — so a backticked path carrying a BOM is not a path to either checker and the citation beside it goes unchecked. Not becoming work: parity holds, which is what the sweep was about, and the precedent that an exotic space is content rather than padding is settled. The one-line fix if an adopter ever hits it is an explicit ASCII + U+FEFF + U+0085 set in both languages, still identical because explicit. Written into `skills/seam-checks/references/assertions.md` § A2. |
| 2026-11-01 | `docs` | **Nothing compares `config.field` to the sentence `docs/taxonomy.md` writes from it.** Row 1 of that file's milestone table says seam is **brownfield** by hand; flip `field` in `.seam/answers.json` and no assertion reds, because this repo's `docs/taxonomy.md` is `create: false` and the wizard will not rewrite an existing doc's body. **The drift is one-way: the config is the source and the doc sentence is the copy.** Not becoming work: it is the same class as `milestones[]` already being kept in step with that column by hand, which that file states about itself two paragraphs down. |
| 2026-11-01 | `wizard` | **Nothing refuses an adopting repo's `milestones[].n: 1`.** `skills/seam-docs/references/interview.md` question 8 says the repo's own build order is numbered from 2, because milestone 1 is the field determination the taxonomy template ships — and calls starting at 2 “a known cost rather than a typo”. A repo that writes `n: 1` anyway renders a table with two rows numbered 1. seam's own fixtures were swept and an assertion compares the rendered `#` column against its own deduplication, so this is about an **adopter's** answers file, not this tree. Not becoming work: `validate()` refusing `n == 1` would hard-fail an adoption over a **label**, while the load-bearing column — which row is active — is unaffected, and the cleaner design was an unnumbered field row, which is a template change and a rule deletion rather than a guard. |
| 2026-11-01 | `github` | **Nothing enforces the `≤ 72` commit-subject rule, and seam's own first branch drifts from it.** No assertion reads a commit message — assertions read files — so the rule is held by whoever writes the commit. Measured on this branch with `git log --format=%s master..HEAD | awk 'length($0) > 72'`, which prints the offenders and whose count was a third of the branch when this row was written, the longest at 112. Not becoming work: the rule stands and `skills/seam-github/SKILL.md` § Branches and commits now says that nothing mechanical holds it; rewriting landed subjects would rewrite history for a label. |
