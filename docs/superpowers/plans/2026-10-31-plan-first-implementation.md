# Plan-first implementation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make "plan first, implement accordingly" an ordering rule seam installs and partly asserts, rather than advice.

**Architecture:** Two new skills (`seam-build`, `seam-context`) own the procedural half; two new assertions (A14, A15) own the mechanical half; three new layer-2 templates (`docs/building.md`, `docs/context.md`, a deepened `docs/routing.md`) own the decisions. The layer-5 plan template gains a `§ The units` table — the artifact everything keys on. seam adopts the result on itself, which is the last task.

**Tech Stack:** Node ES modules (generator, wizard, one emitted checker), Python 3 stdlib (the other emitted checker), `node:test`, `claude plugin eval`.

**Spec:** `docs/superpowers/specs/2026-10-30-plan-first-implementation-design.md`

## Global Constraints

- **The plugin holds method and templates, never decisions.** Every rule gets a repo-owned doc for the decision and plugin prose for how to write it.
- **Two artifacts per repo** — `docs/**` and `.seam/config.json`. A11 asserts they agree.
- **The answers file is the source; `.seam/config.json` is the projection.** Never edit the projection. This failed twice during the design and is the reason for Task 11's assertion.
- **Every assertion is a local, offline, deterministic read.** No network, no database.
- **No dependencies** in `bin/` or in either emitted checker.
- **The two emitted checkers are one implementation written twice.** Every change lands in both in the same commit; `tests/checker.test.mjs`'s `both()` compares their findings on every fixture.
- **The emitted checker reads `.seam/config.json` at run time.** Nothing is baked in by the generator.
- **Enabled-but-cannot-compare fails loudly.** Off is distinct from passing (A3, A8, A12 precedent).
- **An allow-list entry requires a written reason**; the checker exits 2 without one.
- **Ceremony scales with blast radius.** A Small change inside an existing unit gets no new unit, no DoD and no ruling.
- **A written artifact nobody consults is the failure.** (Spec § Anti-goals.)

## Review Focus

Five things the spec implies, that no task below would otherwise exercise, most likely to bite first:

1. **A12 cannot byte-freeze a single dated decisions file.** Appending an entry changes the bytes of a file already on the default branch, so A12 fires on the legitimate append. Task 3 fixes this with a prefix check and owns the test.
2. **A14 or A15 enabled with nothing configured to read.** `impl_globs` absent, or a plan with `§ The issues` and no `§ The units`, must say the comparison was not made — not pass. Tasks 1 and 2 own these tests.
3. **A regeneration dropping config keys the user added by hand.** Measured twice in one hour. Task 11 owns the assertion that catches it.
4. **A unit whose `Proves it` names a test file that exists but asserts nothing** — a shape check that passes on an empty test is a check with no teeth. Task 1 owns this test.
5. **A template no interview question proposes, so nothing ever writes it.** Measured on `docs/routing.md`, which has shipped in that state. Task 8 owns the test, and it asserts the **class** — every named layer-2 template has a question — not just the one instance.

---

### Task 1: `§ The units`, and A14 — the units table has the shape it claims

**Files:**
- Modify: `skills/seam-docs/templates/plan/plan.md`
- Modify: `bin/seam-init.mjs` (`defaultAssertions`)
- Modify: `skills/seam-checks/templates/checker.py.tmpl`, `skills/seam-checks/templates/checker.mjs.tmpl`
- Modify: `skills/seam-checks/references/assertions.md`
- Modify: `tests/fixtures/clean/docs/plans/first.md`
- Test: `tests/checker.test.mjs`, `tests/seam-init.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `§ The units` table shape — `| # | Unit | Proves it | Done when |`, where `#` is a bare numeral, `Proves it` holds a backticked path to a test file, and `Done when` is prose. `assertions.A14 = { enabled, plan_glob }`, `plan_glob` defaulting to `layer5Globs(a)` exactly as A8 does.

**A builder decision, recorded here:** A14 asserts the **shape** of `§ The units`, not file coverage. Units do not declare the paths they touch — an explicit path list per unit drifts within a day and is the ceremony the spec's anti-goal names. Coverage is the procedural half (Task 4), which is the half the owner said matters.

- [ ] **Step 1: Add `§ The units` to the plan template**

In `skills/seam-docs/templates/plan/plan.md`, above `## The issues, in the order they can be built`:

```markdown
## The units

A unit is the smallest piece of work that carries its own test. It is **not** an issue — planning
something is not filing it — so a unit needs no issue number.

| # | Unit | Proves it | Done when |
|---|---|---|---|
| 1 | <what this unit makes true> | `<path to the test that proves it>` | <what makes it done> |
```

- [ ] **Step 2: Write the failing tests**

In `tests/checker.test.mjs`, four tests, each a mutation of `tests/fixtures/clean`:

```javascript
test("A14 flags a unit row with no test path", ...)        // Proves it cell not a backticked path
test("A14 flags a unit whose test file does not exist", ...) // path present, file absent
test("A14 flags a unit whose test file asserts nothing", ...) // file exists, no assert/expect in it
test("A14 says the comparison was not made when a plan has no § The units", ...)
```

Each asserts `ids(r.findings)` is `["A14"]` and `r.status` is 1. The fourth asserts the message matches `/not made/i`.

- [ ] **Step 3: Run them to verify they fail**

Run: `node --test`
Expected: 4 failures, all because A14 is not an assertion yet.

- [ ] **Step 4: Add `§ The units` to the clean fixture so it stays green**

`tests/fixtures/clean/docs/plans/first.md` gains a `## The units` table with one row whose `Proves it` is `` `tests/hives.test.mjs` ``, and `tests/fixtures/clean/tests/hives.test.mjs` is created containing one `assert` call.

- [ ] **Step 5: Implement A14 in both checker templates**

After A13, mirroring A8's structure. Reads `§ The units` from every doc matching `plan_glob` via the existing `sectionBody`/`section_body`; for each row whose first cell is a bare numeral: the `Proves it` cell must match `` /^`([\w./-]+)`$/ ``, that path must exist, and its contents must contain `assert` or `expect`. A plan with `§ The issues` but no `§ The units` produces one finding naming the file and saying the comparison was not made.

- [ ] **Step 6: Default A14 on in the wizard**

In `defaultAssertions`: `A14: { enabled: has(5), plan_glob: layer5Globs(a) }`.

- [ ] **Step 7: Document A14 in `references/assertions.md`**

A row in the table (layers 5, default on iff a layer-5 doc exists) and a section saying what it reads and — the part that matters — that it does **not** assert file coverage, with the reason from this task's builder decision.

- [ ] **Step 8: Run the full suite**

Run: `node --test`
Expected: all pass. Then `node bin/generate-checker.mjs --repo . && node scripts/check_docs.mjs` → 0 violations.

- [ ] **Step 9: Commit**

```bash
git add skills/seam-docs/templates/plan/plan.md bin/seam-init.mjs skills/seam-checks tests
git commit -m "feat(checker): A14 — the units table has the shape it claims"
```

---

### Task 2: A15 — a test arrives before the implementation it proves

**Files:**
- Modify: both checker templates
- Modify: `bin/seam-init.mjs` (`defaultAssertions`, `validate`)
- Modify: `skills/seam-docs/references/interview.md`
- Modify: `skills/seam-checks/references/assertions.md`
- Test: `tests/checker.test.mjs`, `tests/seam-init.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `assertions.A15 = { enabled, default_branch, impl_globs, test_globs }`. Default **off** — it needs two repo-specific lists and an empty list is not a sensible default.

- [ ] **Step 1: Write the failing tests**

In `tests/checker.test.mjs`, using `fixture()`'s git repo and `commitAfter`:

```javascript
test("A15 flags an implementation file committed with no test in the range", ...)
test("A15 passes when the test is in the same commit", ...)
test("A15 passes when the test is in an earlier commit", ...)
test("A15 reports not-applicable on the default branch rather than passing", ...)
test("A15 enabled with no impl_globs says the comparison was not made", ...)
```

Findings key on the **implementation file's path, line 1** — assert that, because a sha-keyed finding cannot be baselined.

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test`
Expected: 5 failures.

- [ ] **Step 3: Implement A15 in both checker templates**

Walk `git rev-list --reverse <default_branch>..HEAD`. For each commit, `git show --name-status --format= <sha>` gives added paths. Track whether any `test_globs` match has been added at or before the current commit; an `impl_globs` match added while none has is a finding. When `git rev-list` returns nothing because HEAD **is** the default branch, emit one informational finding-free line to stdout: `A15: not applicable on <branch> — a squash merge puts test and implementation in one commit`. When `impl_globs` or `test_globs` is empty, one finding saying the comparison was not made.

- [ ] **Step 4: Add the interview question and the validation**

`references/interview.md` § The question set gains question 15 — *"Which paths are implementation, and which are tests?"* → `assertions.A15.impl_globs`, `test_globs`, noting A15 is off until both are answered. `validate` rejects one present without the other, naming `assertions.A15.test_globs`.

- [ ] **Step 5: Run the full suite and both languages**

Run: `node --test`
Expected: all pass, including `both()`'s cross-language comparison on every A15 fixture.

- [ ] **Step 6: Commit**

```bash
git add skills bin tests
git commit -m "feat(checker): A15 — a test arrives before the implementation it proves"
```

---

### Task 3: seam's layer-3 track, and A12's prefix check for a dated file

**Files:**
- Create: `docs/decisions.md`
- Modify: both checker templates (A12)
- Modify: `.seam/answers.json`
- Modify: `README.md`
- Modify: `skills/seam-checks/references/assertions.md`
- Test: `tests/checker.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `docs/decisions.md` as seam's layer-3 track; A12's `single` branch asserting prefix rather than equality.

**This task exists before Task 5 because Task 5's reversal needs somewhere to be recorded.**

- [ ] **Step 1: Write the failing tests**

A12 currently compares whole-file bytes, which makes an **append-only file impossible to append to**. In `tests/checker.test.mjs`, with a fixture whose `adr.format` is `single`:

```javascript
test("A12 allows an append to a dated decisions file", ...)       // old bytes are a prefix of new
test("A12 flags an edit to an existing entry in a dated file", ...) // old bytes are not a prefix
test("A12 still demands byte-equality for a MADR record", ...)      // unchanged behaviour
```

- [ ] **Step 2: Run them to verify the first fails**

Run: `node --test`
Expected: "A12 allows an append" fails — A12 fires on the legitimate append.

- [ ] **Step 3: Implement the prefix check**

In both templates' A12: when `cfg.adr.format === "single"` and the path is `adr.file`, the branch version must be a **prefix** of the working copy (`now.startsWith(was)` on the decoded text, byte-compared). Everything else keeps equality. The message for a prefix violation says an entry was edited rather than appended, and that a reversal is a new dated entry.

- [ ] **Step 4: Create `docs/decisions.md` from the template**

```bash
node bin/seam-init.mjs --answers .seam/answers.json --repo .
```

after adding the layer-3 row (`docs/decisions.md`, layer 3, owns "What was chosen, the options rejected, and why — plus in-flight rulings and direction corrections", `create: true`) to `.seam/answers.json`, and **removing** the `assertions.A1.allow` entry for `docs/decisions.md`: its absence has stopped being true, and an allow entry that is no longer true is deleted rather than carried.

- [ ] **Step 5: Extend the single-file template for rulings and corrections**

`skills/seam-docs/templates/adr-single/decisions.md` gains two entry kinds beside a decision — a **Ruling** (what was decided, why, what it costs if wrong) and a **Direction correction** (what was being built, what was asked for instead, dated) — each as a `### ` under a dated `## ` section, with one line saying both are append-only like everything else in the file.

- [ ] **Step 6: Switch A12 and A13 on for seam, and close the README's open question**

`.seam/answers.json`: `assertions.A12.enabled: true`, `A13.enabled: true`. `README.md` § Docs & decisions: the two-opens paragraph becomes one — the layer-4 PRD question stays open, the layer-3 one is settled, and the table gains the `docs/decisions.md` row.

- [ ] **Step 7: Verify**

Run: `node --test && node bin/generate-checker.mjs --repo . && node scripts/check_docs.mjs`
Expected: all tests pass; checker reports 8 assertions, 0 violations.

- [ ] **Step 8: Commit**

```bash
git add docs/decisions.md skills .seam README.md tests
git commit -m "feat(docs): seam's layer-3 track, and A12's prefix check for a dated file"
```

---

### Task 4: `docs/building.md` and the `seam-build` skill

**Files:**
- Create: `skills/seam-docs/templates/current/building.md`
- Create: `skills/seam-build/SKILL.md`
- Modify: `bin/seam-init.mjs` (the named-template map, `templateVars`)
- Modify: `skills/seam-docs/references/interview.md`
- Test: `tests/seam-init.test.mjs`

**Interfaces:**
- Consumes: `§ The units` (Task 1).
- Produces: `docs/building.md` as the layer-2 doc owning the start contract, the finish contract and the TDD rule; `seam-build` as the skill that follows it.

- [ ] **Step 1: Write the failing test**

```javascript
test("a layer-2 row named building.md gets the build template", ...)
```
Asserts the written file matches `/Layer 2/`, `/amend in place/i`, `/start contract/i`, `/finish contract/i`, and that the checker path substituted.

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test`
Expected: FAIL — no such template.

- [ ] **Step 3: Write the template**

`templates/current/building.md`, a layer-2 doc carrying: the one principle (*the written unit comes before the work, and nothing stops for permission*); the start contract; the finish contract's four clauses; the TDD rule with the non-deterministic exemption stated verbatim from the spec; and the proportionality rule — a Small change inside an existing unit gets no new unit, no DoD and no ruling.

- [ ] **Step 4: Wire it into the wizard and the interview**

Add `"building.md": "current/building.md"` to `writeDoc`'s named map. `references/interview.md` gains the question that proposes it, and § Defaults records that it is proposed by default.

- [ ] **Step 5: Write `skills/seam-build/SKILL.md`**

Frontmatter description triggering on: implementing from a plan, starting a unit, finishing a unit, what done means, noticing something mid-task. Body: locate `docs/building.md` and follow it; the three-step loop (name the owning unit → write its test → make it pass); what to do when no unit owns it (**write the unit, carry on — never stop for permission, never build first**); the finish contract; and a pointer to `seam-github` § Follow-ups for dispositions. It states no rule the repo's doc owns.

- [ ] **Step 6: State that a review-mandated fold-in is already covered**

The template and `seam-build` both say it, because the two shipped mandates collide without it: a
round-one review finding is **about the unit under review's output**, so that unit owns the fix and
the start contract is satisfied. Add the cross-reference in `skills/seam-review/SKILL.md` § Run the
rounds so the rule is findable from either side.

- [ ] **Step 7: Verify**

Run: `node --test && node scripts/check_docs.mjs && claude plugin validate --strict .`
Expected: all pass; 0 violations; validation passed.

- [ ] **Step 8: Commit**

```bash
git add skills bin tests
git commit -m "feat(build): docs/building.md and the seam-build skill"
```

---

### Task 5: Reorder the dispositions, and record the reversal

**Files:**
- Modify: `skills/seam-github/SKILL.md`
- Modify: `skills/seam-github/references/templates.md`
- Modify: `docs/decisions.md`
- Modify: `evals/github-pr-shape/graders/shape.md`

**Interfaces:**
- Consumes: `docs/decisions.md` (Task 3), `docs/building.md` (Task 4).
- Produces: the four-row disposition order.

- [ ] **Step 1: Reorder § Follow-ups**

The order becomes: a unit already covers it → do it now; no unit covers it and it is worth the time → **plan the unit, then do it**; no unit covers it and it is genuinely complex → file an issue; true and not worth the time → one ledger row. The paragraph that reads "Small or Medium → fold it into the current branch" is replaced: size still decides *how*, and the owning unit decides *whether*. One sentence states that filing is for complexity and that covering corners is part of the work.

- [ ] **Step 2: Add the carve-out**

A change with no owning unit may **name the document that owns it instead** — the generalisation of campaign's three carve-outs. Without it the procedural start contract blocks ops and decision work.

- [ ] **Step 3: Record the reversal in `docs/decisions.md`**

A dated entry: what the old rule was (size alone decided fold-in), what replaces it, and why — quoting the owner's reason, that filing an issue to cover corners inflates the board. A12's prefix check means this is an append.

- [ ] **Step 4: Update the filled example and the eval grader**

`references/templates.md`'s follow-up list gains a `planned` item. `evals/github-pr-shape/graders/shape.md` gains the requirement that an item with no owning unit is planned rather than filed, and keeps the existing requirement that the CI-waste item is a ledger row.

- [ ] **Step 5: Verify**

Run: `node scripts/check_docs.mjs && claude plugin validate --strict .`
Expected: 0 violations; validation passed. A12 must accept the appended entry — if it fires, Task 3 Step 3 is wrong.

- [ ] **Step 6: Commit**

```bash
git add skills docs/decisions.md evals
git commit -m "fix(github): planned-and-done outranks filing, and the reversal is recorded"
```

---

### Task 6: `milestones[].active`, and the qualifier's third clause

**Files:**
- Modify: `bin/seam-init.mjs` (`validate`, `project`)
- Modify: `skills/seam-docs/templates/current/taxonomy.md`
- Modify: `skills/seam-docs/references/interview.md`
- Modify: `skills/seam-github/SKILL.md`
- Test: `tests/seam-init.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `milestones[].active` — a boolean, exactly one `true` when any milestone exists.

- [ ] **Step 1: Write the failing tests**

```javascript
test("exactly one milestone may be active", ...)      // two active -> exit 2, names milestones
test("milestones with none active are rejected", ...) // -> exit 2
test("the active milestone reaches the taxonomy doc", ...)
```

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test`
Expected: 3 failures.

- [ ] **Step 3: Implement**

`validate` enforces the one-active rule when `milestones` is non-empty, naming `milestones[N].active`. The taxonomy template's milestone table gains an **Active** column. `seam-github` § Follow-ups' clause 3 cites `milestones[].active` instead of saying "which the milestone says".

- [ ] **Step 4: Verify and commit**

Run: `node --test`
Expected: all pass.

```bash
git add bin skills tests
git commit -m "feat(wizard): one active milestone, which the qualifier's third clause reads"
```

---

### Task 7: `docs/context.md` and the `seam-context` skill

**Files:**
- Create: `skills/seam-docs/templates/current/context.md`
- Create: `skills/seam-context/SKILL.md`
- Modify: `bin/seam-init.mjs`, `skills/seam-docs/references/interview.md`
- Modify: `.gitignore` (template guidance only — the adopting repo's own)
- Test: `tests/seam-init.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `docs/context.md` as the layer-2 doc owning the threshold table and the dispatch rule.

- [ ] **Step 1: Write the failing test**

```javascript
test("a layer-2 row named context.md gets the context template", ...)
```
Asserts `/Layer 2/`, `/amend in place/i`, a threshold table with four levels, and the two dispatch reasons.

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test`
Expected: FAIL — no such template.

- [ ] **Step 3: Write the template**

The threshold table reuses `agent_starter`'s levels (Green 0–50 %, Yellow 50–60 %, Orange 60–75 %, Red 75 %+) and its actions, every one of which is *write to disk, prefer disk over context*. Below it: **what triggers a level** — the harness's own budget indicator where one exists, and the fallback heuristics (agents dispatched, large reads taken) where it does not, with one line saying why the fallback exists. Then the dispatch rule: a subagent is for **parallel** work or **detached** work, and nothing else. Then where session artifacts live: `.seam/session/`, gitignored, **never under `docs/`** — A10 needs a table row for everything there and a per-session scratch file cannot earn one.

- [ ] **Step 4: Wire it in, write `seam-context/SKILL.md`**

Named map entry plus an interview question. The skill's description triggers on "context", "tokens", "compact", "running low", and on deciding whether to dispatch a subagent. Body: locate `docs/context.md`, read the level, take the action; the dispatch rule; and the brief-writing rule for a detached agent.

- [ ] **Step 5: Verify and commit**

Run: `node --test && claude plugin validate --strict .`

```bash
git add skills bin tests
git commit -m "feat(context): docs/context.md and the seam-context skill"
```

---

### Task 8: Repair `docs/routing.md`, and name the phases

**Files:**
- Modify: `skills/seam-docs/references/interview.md`
- Modify: `skills/seam-docs/templates/current/routing.md`
- Test: `tests/seam-init.test.mjs`

**Interfaces:**
- Consumes: Tasks 4, 7 (the phases to name).
- Produces: nothing downstream.

**Pre-existing defect:** `routing.md` has a template that no interview question proposes, so nothing ever writes it.

- [ ] **Step 1: Write the failing test**

```javascript
test("every named layer-2 template has an interview question that proposes it", ...)
```
Reads the `writeDoc` named map and asserts each basename appears in `references/interview.md`. This catches the class, not just this instance.

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test`
Expected: FAIL, naming `routing.md`.

- [ ] **Step 3: Add the question, and deepen the template**

The interview gains the routing question. The template's phase table gains an **Owning artifact** column that may name a third-party skill — which is how campaign actually routes work — and one line saying the plugin never bundles those, it only lets a repo name them.

- [ ] **Step 4: Verify and commit**

Run: `node --test`

```bash
git add skills tests
git commit -m "fix(wizard): routing.md had a template nothing proposed"
```

---

### Task 9: The three `campaign-github` repairs

**Files:**
- Modify: `skills/seam-github/SKILL.md`
- Modify: `skills/seam-github/references/templates.md`

**Interfaces:**
- Consumes: `milestones[].active` (Task 6).
- Produces: nothing downstream.

- [ ] **Step 1: Add § Merging, and the steps it is**

The merge procedure, generalised: squash by default, the title is the squash subject, what the OK has to show before it (method, what it closes), and that the branch's commit messages concatenate into the squash body.

- [ ] **Step 2: Add post-merge teardown**

The teardown is the last step of the merge sequence, not an optional tidy-up: delete the branch, and run the repo's own teardown command if its config names one.

- [ ] **Step 3: Add § The owned-row invariant**

How status reporting knows the active milestone: `milestones[].active`, not inference. One line tying it to the qualifier's third clause.

- [ ] **Step 4: Verify and commit**

Run: `node scripts/check_docs.mjs && claude plugin validate --strict .`

```bash
git add skills
git commit -m "feat(github): the merge procedure, the teardown, and the owned-row invariant"
```

---

### Task 10: Eval cases for the new procedural rules

**Files:**
- Create: `evals/build-start-contract/prompt.md` + `graders/*.md`
- Create: `evals/build-finish-contract/prompt.md` + `graders/*.md`
- Create: `evals/context-level/prompt.md` + `graders/*.md`
- Modify: `evals/README.md`

**Interfaces:**
- Consumes: Tasks 4, 5, 7.
- Produces: nothing downstream.

Each case carries its fixture **inline in the prompt** — there is no working scaffold hook on this build (`evals/README.md` § What the graders can and cannot do). Each gets a `tool_used: Skill` grader, without which a run where the plugin never fired is indistinguishable from a wrong answer.

- [ ] **Step 1: `build-start-contract`**

Prompt: a plan with two units inline, and a request to implement something **no unit covers**. Graders: an `llm` grader passing only if the response writes the missing unit and continues — failing if it stops to ask, and failing if it builds without writing the unit; plus `tool_used: Skill`.

- [ ] **Step 2: `build-finish-contract`**

Prompt: a unit whose test was never run, presented as finished. Graders: pass only if the response declines to call it done and names which of the four clauses is unmet.

- [ ] **Step 3: `context-level`**

Prompt: a session described at ~70 % usage with two agents dispatched. Graders: pass only if the response names Orange, takes the Orange action (compact now, write state to disk, no new large reads), and does **not** invent a threshold.

- [ ] **Step 4: Verify the cases load, and run them**

Run: `claude plugin eval . --trust-plugin --no-publish --case 'nope'`
Expected: no "failed to load" lines.
Run: `claude plugin eval . --allow-tools Write Edit Bash --trust-plugin --no-publish --case 'build-*'`
Expected: both score 1.00. **A single red run is re-run before it is treated as a finding** (`evals/README.md`).

- [ ] **Step 5: Commit**

```bash
git add evals
git commit -m "test(evals): the start contract, the finish contract, and the context level"
```

---

### Task 11: seam adopts it, and A16 catches the bug that bit twice

**Files:**
- Modify: `.seam/answers.json`
- Create: `docs/building.md`, `docs/context.md`, `docs/routing.md`
- Modify: both checker templates, `bin/seam-init.mjs`
- Modify: `.claude-plugin/plugin.json` (version), `README.md`, `docs/contributing.md`
- Test: `tests/checker.test.mjs`

**Interfaces:**
- Consumes: every task above.
- Produces: seam running its own new layer.

**A16 is the assertion this plan exists to earn.** The answers file is the source and `.seam/config.json` is the projection; editing the projection cost two silent reversions in one hour during the design, one of which reached a pushed commit message as a false claim. Prose did not hold it.

- [ ] **Step 1: Write the failing test**

```javascript
test("A16 flags a config that is not the projection of its answers file", ...)
test("A16 says the comparison was not made when no answers file is committed", ...)
```
The first mutates `.seam/config.json` directly in a fixture and asserts `ids` is `["A16"]`; the second removes the answers file.

- [ ] **Step 2: Run them to verify they fail, then implement A16**

Both checkers: when `.seam/answers.json` exists, re-derive the projection the way `project()` does — strip the prose keys, apply the defaults — and compare to `.seam/config.json`. Any difference is a finding naming the key path. Absent answers file → the comparison was not made.

**This requires the projection rule in one place both languages can read.** Emit the prose-key list and the default table into the checker templates from a single JSON file, `skills/seam-checks/templates/projection.json`, generated from `bin/seam-init.mjs`'s own constants by a test that fails when they diverge.

- [ ] **Step 3: Write seam's own three docs**

Add the layer-2 rows for `docs/building.md`, `docs/context.md` and `docs/routing.md` to `.seam/answers.json`, and a layer-5 row for `docs/superpowers/plans/*.md` — this plan is currently uncovered by A10. Then regenerate:

```bash
node bin/seam-init.mjs --answers .seam/answers.json --repo .
node bin/generate-checker.mjs --repo .
node scripts/check_docs.mjs
```
Expected: 0 violations across 9 assertions.

- [ ] **Step 4: Fill seam's own `§ The units` for this plan**

This plan's eleven tasks become unit rows in `docs/superpowers/plans/2026-10-31-plan-first-implementation.md`, each naming the test that proves it. A14 then asserts this plan against itself.

- [ ] **Step 5: Version and document**

`plugin.json` → `0.2.0`. `README.md` gains the two new skills in § Where the rules live and A14–A16 in the assertion count. `docs/contributing.md` § Checks is unchanged — the commands have not changed.

- [ ] **Step 6: Verify everything**

Run: `node --test && node scripts/check_docs.mjs && claude plugin validate --strict .`
Expected: all tests pass, 0 violations, validation passed.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: seam adopts the plan-first layer, and A16 asserts the projection"
```
