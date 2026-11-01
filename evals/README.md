# The eval suite

One case per behaviour that must survive a rewrite of the skill that produces it. Cases are
`prompt.md` plus `graders/*.md`, in the shape `claude plugin eval init --bare <name>` writes.

```bash
claude plugin eval . --allow-tools Write Edit Bash --trust-plugin
```

`--allow-tools Write Edit Bash` matters: those are gated by default, and a wizard that cannot
write anything scores zero for the wrong reason. The `with-without` ablation arm is the number
worth reading — it says whether the plugin changed the outcome or the model would have managed
anyway.

| Case | Grades |
|---|---|
| `wizard-greenfield` | the **files written** from a recorded answers file, and that no claim was invented |
| `wizard-interview` | the **questions asked**, and that nothing was written before the interview finished |
| `wizard-adopt` | the **layer classification**, the overlap, the layer violation, and that it stayed a proposal |
| `wizard-field-first` | **indicative, 2 of 3 runs** — the *position* of one rule: that green-or-brown field is settled before any doc set is proposed |
| `github-issue-shape` | domain, priority, milestone, the Context citation, externally checkable criteria, `--body-file` |
| `github-pr-shape` | five follow-up items, on a case built so that size and the qualifier give different answers |
| `github-size-citation` | the repo's **own** `docs/building.md` winning as the size vocabulary — `Migration`, a size no template has |
| `github-gate` | the refusal: push and merge gated, the commit's review precondition, and the two kept apart |
| `github-merge` | the sequence: squash by default, an OK that has seen the method and what it closes, teardown as a step |
| `github-merge-no-command` | the same with `teardown_command` empty: the remaining steps are the whole of it, and none is invented |
| `github-merge-gate` | **indicative** — the gate alone, on a prompt that asks for no plan: no merge command is run, and the OK's contents are shown first |
| `review-level` | the level for seven diffs, against the condition table |
| `review-rounds` | the bound, the named third-round trigger, and that a third round is recommended rather than run |
| `build-start-contract` | no unit owns the work: the row written, written *before* the source changes, and nothing stopping to ask |
| `build-finish-contract` | a unit whose named test never ran: which of the four clauses is unmet, and the test actually run |
| `build-finish-no-doc` | the same unit with **no `docs/building.md` in the fixture**: that a four-clause contract is reached at all, rather than the plan's `Done when` standing in for one |
| `context-level` | the level read off the figure not the agent count, the Orange action in full, and no invented threshold |
| `context-level-no-doc` | the same with **no `docs/context.md` in the fixture**: that the thresholds are reached and the file they came from is named, rather than a level being assigned from nowhere |

## Authoring a case: two rules, both measured

Neither is a preference. Each is a property of this runner that decides whether a case's number
means anything, and both were learned by paying for runs that measured nothing.

**1. A fixture that quotes the doc answering the question measures nothing about the plugin.**
A fixture has to be inline here, so a quoted doc is in the model's context before any skill
loads — the skill is then redundant and may not fire at all. The two numbers that establish it:
Task 10's two **Δ 0.00** cases are both that shape, while `github-merge`, whose method exists only
in its `SKILL.md` and whose fixture is six lines of JSON, fired on every run and carries this
suite's only **Δ +1.00**. So a `with-without` delta is evidence about the plugin **only** for a
case whose fixture does not quote the answering doc. Quote the *situation* and withhold the
*rule*: `build-finish-no-doc` and `wizard-field-first` are both built that way, and the shape to
reach for when a fixture must carry a doc is to ask something that doc does not answer.

**2. `runs: 1` against a threshold of `1.0` is not a gate, so a claim about a case states the run
count it was made over.** Four of fourteen cases came back red on one run each on Task 10's
full-suite run, and two of the four had not been touched by it — `wizard-greenfield` at 0.79 and
`wizard-interview` at 0.63, whose `questions-asked` grader had passed on an earlier run with no
change to it since. Either a figure here carries its run count, or the case is marked
**indicative** the way `github-merge-gate` is. **Do not fix this by raising every case's `runs`:**
that multiplies a real dollar cost across eighteen cases, and the number is what was missing, not
the runs. The tables below carry the count in their own column, and a case with no row in them is
unmeasured rather than zero.

## What the graders can and cannot do

Measured against this build of the runner — `claude` 2.1.316 — so that the next person does not
re-derive it. **Three of the lines here replace an earlier reading of this same section**, and each
shape below was run rather than read off a schema.

- Grader types are `regex`, `tool_order`, `tool_used`, `file_exists`, `llm` and `baseline`.
  **There is no script grader.**
- `regex` and `llm` both take a target, and it **can be a file the run wrote** — `target:` on a
  `regex` grader, `focus:` on an `llm` one. Either takes one of `trace`, `last_message`, `files`
  or `mock_calls`, or `{source: file, path: <relative to the run's cwd>}`; the default is
  `last_message`. `build-start-contract/graders/unit-row-written.md` is the file form, and that
  case's `start-contract.md` grades the `trace`, which is the only way to judge what a run *did*,
  in what order. A file target that does not exist makes the grader **throw** rather than pass
  quietly.
- `tool_used` takes `input_match`, `min` and `max` beside `tool`, so it can assert *which* path a
  call carried — or that a call never happened at all, with `min: 0, max: 0`.
  `build-finish-contract/graders/test-was-run.md` is the `input_match` form.
- **`input_match` is a regex, not a substring, and it runs against the whole serialized tool
  input.** Measured and reproduced: `e.ho ready` matched a call whose command was `echo ready`
  (wildcard), so did `(zzz|echo) ready` (alternation) and `echo\b` (word boundary); `^echo` did
  **not**, because the serialized input begins `{"command":"`. The JSON keys are visible to the
  pattern — `"command":` matches, and so does `"command":"echo` — which is the only way to scope a
  matcher to one field, since `tool_used` has no `target:` of its own.
- `tool_order` takes `before` and `after`, each a tool name or `{tool, input_match}`, and needs
  **both** calls in the trace — so it reds when a run chose `Write` where the grader named `Edit`.
  That is a tool-choice red and not a behaviour one, which is why no case here uses it.
- `file_exists` takes one `path` and an optional `exists: false`.
- The runner **pre-flights** every grader against the case's `allowed_tools` and the run's grants,
  and says when one cannot pass — *"it checks a file the run creates, but no tool the run may use
  can create one"*. That warning costs nothing and is worth reading.
- **There is no working scaffold hook.** `scaffold_script` is rejected in `prompt.md` frontmatter
  and silently does nothing in `case.yaml`. So each case carries its fixture **inline in the
  prompt** and the run builds it.

**Both arms of the citation-plus-fallback route are covered, by different cases.**
`github-size-citation`'s fixture **has** a `docs/building.md`, and its fourth size `Migration`
is what proves the repo's doc won. `github-pr-shape` and `build-start-contract` have **none**, so
there the skill's `$CLAUDE_PLUGIN_ROOT` fallback is what supplies the sizes and the start
contract — a run of the latter said so in as many words: *"The repo has no `docs/building.md`, so
I used the build skill's default steps."*

**Which arm each build case is, and both are shipped.** `build-finish-contract`'s fixture
**has** a `docs/building.md`, quoted in full, so it is the **doc-present** arm; and because a
quoted doc is in the model's context before any skill loads, it cannot see anything about the
route the contract was reached by. `build-finish-no-doc` is the same unit, the same graders and
the same question with that fixture file **removed** — the **doc-absent** arm, and the only case
in the suite that can see whether the finish contract is reached through the skill's
`$CLAUDE_PLUGIN_ROOT` fallback or not reached at all. Earlier readings of this file and of Task
10's report had those two the other way round; the shipped tree is what is described here.

**The same pair exists for the context budget, and there the answer came out the other way.**
`context-level`'s fixture carries a `docs/context.md`; `context-level-no-doc` is the same session,
the same figure and the same question with that file removed, so the thresholds have to come
through `seam-context`'s `$CLAUDE_PLUGIN_ROOT` route or from nowhere. It passes **3 of 3**, score
1.00, and the mechanism is unanimous: every run named
`skills/seam-docs/templates/current/context.md` as where the table came from, two of the three
reading it with `cat` rather than `Read`.

**That case was built expecting the finish contract's defect and did not find it, and the
counterfactual says why.** `seam-context/SKILL.md:20-23` tells the session to *"read the template
meanwhile"*; `seam-build`'s equivalent paragraph said *"rather than improvising a contract"* and
never named a read at all. Rewriting the context skill's clause into that older shape — one
sentence, nothing else — takes the case from 3 of 3 to **0 of 3**, score 0.20, `FAIL FAIL FAIL`
unanimous on every run, and the runs say what went wrong in their own words: *"What level are we
at: I can't tell you… If I picked a level now, I'd be inventing the threshold on the spot."* They
still **name** the template, in the offer to write the repo its own, and never read it.

So the clause is load-bearing in the protective direction, the opposite of what an earlier reading
of it supposed, and the case is the regression guard for it. **It is also that case's RED proof**:
a case shipped green has not been watched failing, and that mutation is the command that fails it.

**Both `build-*` cases ship RED, and the reason is a measured defect rather than a grader asking
more than the method does.** Loosening either to green would be the thing this whole file argues
against.

Their rates, each `--ablation none`, measured either side of the `seam-build` § Step 0 change
that gave the finish contract a named source and an ending for the case where it has none:

| Case | Before | After | What moved |
|---|---|---|---|
| `build-finish-no-doc` | 0 of 3 · 0.28 | 1 of 3 · 0.56 | the contract was reached: **3 of 3** name the file they ran it from and walk four clauses, against **0 of 3** before, which answered from the plan's `Done when` and offered to write the doc |
| `build-finish-contract` | 2 of 5 · 0.53 | 1 of 5 · 0.47 | nothing the score can separate; `skill-fired` went 3 of 5 → **5 of 5** and the test was run twice — failed, fixed, re-run — in 5 of 5 against 0 of 5 |

**The weight-4 judge on the doc-present arm does not discriminate the two correct endings**, which
is why its score moved the wrong way on a change that fixed the thing it was written for. Its
criteria bless *"going on to fix the implementation, re-run the test green, and then say unit 2 is
done"*, and also require that the response "does not accept unit 2 as done as presented" — and a
response ending *"Unit 2 wasn't done when you asked. It is now"* satisfies the first while reading
like a breach of the second. Four runs of near-identical text split `PASS FAIL PASS` /
`FAIL FAIL FAIL`, the same boundary variance Ruling 103 measured on `github-pr-shape`.

**Three runs an arm is below this file's own five-run bar, and the no-doc row above says so by
being read for its mechanism rather than its score.** What 3 of 3 against 0 of 3 carries is not a
rate: it is that every run after the change named the file it ran the contract from and walked
four clauses, and no run before it did either. The score on that row is indicative; the mechanism
is what the claim rests on, and it is readable in the runs themselves.

**`wizard-field-first` is the other three-run number here: 2 of 3, score 0.75.** It grades a
**position** — that green-or-brown field is settled before any doc set is proposed — and a
position over prose is the one claim in this suite that no deterministic grader can make, which is
why its criteria read the `trace` and why it carries no `regex` arm. Its one failing run settles
the question correctly in its first section, in the method's own words, and lost 2 of 3 judge
votes; that is the variance § A single red run is not a finding measures, not a miss.

**Its criteria were sharpened once before it shipped, and that is worth copying.** The first
version went 1 of 3, and one of the two failures was a plan that settled the field first and
reasoned it from the tree without using the words *green* or *brown* field — so the grader was
reading for the method's **vocabulary** while the case exists to measure the **order**. Sharpening
it to accept the determination in the tree's own words took it to 2 of 3 over the same three runs'
worth of money. The run that failed before and still fails is the one the case is for: it fired a
skill, proposed a doc set and checker settings, and never settled the field at all — the word does
not appear in its trace.
**Stated by direction, because that decides what to do about it:** the error is a false FAIL on a
correct answer, which gets investigated, and not a silent pass on a wrong one — so writing it down
here is an acceptable ending, where for the other direction it would not be. The sharpening when
someone next pays for runs on this case is to require the verdict **on the state as presented** to
be "not done", separately from whatever the run then went on to do about it.

### Which cases the plugin actually changes

`--ablation with-without` is the number worth reading. **Six of the eighteen cases have been
measured both ways**, and over the runs stated those six sort into cases that earn their keep and
cases that are regression guards. The other twelve carry no row here, which means unmeasured, not
zero — `build-finish-no-doc` and `context-level-no-doc` among them, whose numbers above are a
plugin arm only:

| Case | with | without | Δ | runs |
|---|---|---|---|---|
| `github-merge` | 1.00 | 0.00 | **+1.00** | 2 |
| `build-start-contract` | 1.00 | 0.33 | **+0.67** | 2 |
| `context-level` | 1.00 | 0.56 | **+0.44** | 6 |
| `github-merge-no-command` | 1.00 | 1.00 | 0.00 | 2 |
| `github-merge-gate` | 0.27–0.47 | 0.20 | +0.07…+0.27 | 7 |
| `build-finish-contract` | 0.52 | 0.68 | −0.16 | 10 |

The last row is from **before** the § Step 0 change, and the paragraph above has that case's
numbers after it. Its `without` arm is unaffected by a change to a skill, so the delta is the one
figure there that a later run would have to re-measure rather than carry forward.

**What separates them is whether the prompt quotes the doc that answers the question.** A fixture
has to be inline here, and a quoted doc is in the model's context before any skill loads — so a
case whose answer is in its own fixture cannot show a delta, however good the grader.
`github-merge`, whose method is only in `SKILL.md`, carries the largest one.

### `github-merge-gate` is indicative, and why

**It passes 2 of 7 plugin runs, and it is kept at that rate rather than loosened.** Its `gate`
grader reds when a response leads with the sandbox's broken `git` and `gh` instead of with the
gate — on answers that hold the gate correctly, one of which said *"Merging needs your OK on the
method and on what it closes, so please confirm this plan"* and then gave squash-deleting-the-
branch, the 64-character subject and `Closes #31`. The grader was corrected once, to grade what a
response **states and shows** rather than its motive, and the rate did not move.

**No inline fixture can fix it**, because there is no scaffold hook on this build and so no way to
give a case a working remote: the sandbox always supplies a competing reason to hold off, and this
case cannot tell that reason from the gate. That is the inline-fixture limit for the third time in
this suite, so the case is read as **indicative** — its `not-merged` half is a real deterministic
assertion and its `gate` half is a signal, not a threshold.

**The gate itself is not unmeasured.** `github-merge` carries that signal at Δ +1.00, unanimous
both ways. And the lead worth following for a real pre-existing fixture — `context.add_dirs` in
the `case.yaml` schema, which might supply one without a scaffold hook — is routed onward rather
than explored here.

**The way out, where there is one, is to ask something the fixture cannot answer.**
`context-level` went from Δ 0.00 to Δ +0.44 on one added clause: its fixture `docs/context.md`
says nothing about *when* to read the level again, so the four moments — before a dispatch, when a
verbose result lands, at a phase boundary, and when a tool result is not what was expected — are
the skill's or they are a guess. The same technique applied to `build-finish-contract` did **not**
move its delta, which is why that case is documented as a guard rather than a discriminator — and
why the defect behind it was eventually measured on an arm that could see it,
`build-finish-no-doc`, rather than on this one. A Δ at or below zero is a case to re-read, not a
case to delete: `build-finish-contract`
reds when a response reaches "not done" through the plan's `Done when` alone, and that is worth
catching whether or not the base model would have managed the rest.

### Writing an `input_match`: command syntax only, never a word

**An `input_match` must be a string that only command syntax can contain** — a flag, a subcommand
together with its command, a plugin-qualified skill name — and **never a word that could appear in
a sentence. Because the model writes a sentence into the input beside the command.** `Bash`'s input
is `{"command": …, "description": …}`, and that second field is the model's own free text, so a
matcher scans prose whether its author meant it to or not.

**This is measured, and it cost a grader.** `github-merge-gate`'s `not-merged` first used
`" merge"` and fired on a run that merged nothing. Its one call was read-only throughout —
`git worktree list --porcelain; gh pr view 31 --json …; gh repo view --json squashMergeAllowed,…`
— and the match came from the sibling field:

```json
{"command":"git worktree list --porcelain | head -3; gh pr view 31 --json state,…,mergeable,…",
 "description":"Inspect PR #31 state and repo merge settings"}
```

`" merge"` appears nowhere in that command. It appears in `repo merge settings`. So the grader
fired on gathering state before presenting the gate — which is what `seam-github` § Merging
*requires* — while still firing on what it forbids, and a red a reader learns to rationalise away
is worse than a check that cannot fail.

**The reusable rule is to scope the matcher to where a command can actually appear, not merely to
a field.** A command sits at a **command position** — the start of the `command` field, or after a
shell separator. A command merely *mentioned* in prose, or quoted inside another command, does
not. That is one alternation and a character class:

```yaml
input_match: '("command":"|([;&|]|\\n)\s*)(gh pr merge|git merge)[^-\w]'
```

Field scoping alone is not enough, and the way it fails is the dangerous way. `"command":"[^"]*`
stops at the first embedded quote, so `git commit -m "wip" && gh pr merge 31` goes **silent** — a
real merge, missed. On a gate, a false negative passes the violation in silence while a false
positive merely gets investigated, so a matcher that fails open is the wrong trade even when its
caveat is written down. And crossing the quote properly, `(?:[^"\\]|\\.)*`, fails the other
way: it fires on `echo "then run gh pr merge 31 once approved"`, which is the prose bug again one
layer in. The command-position form is right on all ten of the cases those two split on, and it
needs less of the regex engine than either.

The second half is to **take the command form rather than a flag**: `"merge --"` misses
`gh pr merge 12 -R mitekk/apiary --squash --delete-branch`, the form `references/templates.md`
ships, and any flag requirement misses a bare `gh pr merge 31`, which merges just the same.

**Two refinements this matcher needed after it shipped, both found by running it rather than
reading it**, and both worth copying because each is a whole class:

- **Enumerate the separators, then check the list.** The first version carried `;`, `&` and `|`
  only, which missed a real merge on the second line of a multi-line command — a shape models
  write constantly, and a **fail-open** miss. The serialized newline `\n` is now in the class.
- **`\b` is not a word end when the next character is `-`.** `git merge\b` fires on
  `git merge-base` and `git merge-tree`, both **read-only** — a false positive on exactly the
  commands the gate expects a session to run. `[^-\w]` excludes them and still matches
  `git merge --squash`, a bare `gh pr merge` at the end of the field, and `git merge` before a
  newline.

**State what a matcher leaves out by direction, not as one list.** Measured over twenty-two command
shapes, this form has **no false positives**; it misses three fail-open shapes — a merge after
`then` or `do`, and one inside `( … )` or `$( … )`. Those stay missed deliberately: carrying `(`
would fire on `echo "(gh pr merge)"`, trading a fail-open for a fail-closed, and the frequency
argument that justifies closing the newline does not hold for a subshell merge. On a gate, prefer
the direction that fails closed — a false positive gets investigated, a false negative passes the
violation in silence — and that preference is why "it is documented" was **not** an acceptable
ending for the newline gap.

Audited across every `input_match` in the suite: `"seam:seam-"` is a plugin-qualified skill name,
`"--test"` is a flag, and the merge matcher is scoped to a command **position**. All command
syntax; none of them a word a sentence can carry.

**What the inline fixture costs, and it is not nothing.** A fixture the prompt quotes is in the
model's context before a single file is read, so **no grader here can prove a file was read rather
than remembered**. `tool_used` with `input_match` would prove it, but a run that answers from the
message is following the prompt rather than failing the skill, so that red would be the case's
fault. A case that needs the repo's own doc to have *won* therefore grades the **effect**:
`github-size-citation`'s fixture doc defines a fourth size, `Migration`, which exists in no
template and no skill, so a body reporting it can only have taken the repo's table as its
vocabulary.

Exhaustive deterministic assertions about *file contents* still live in `node --test`, because
they are offline, free and run on every push: the generator's own tests check the table's columns
and the config's prose-freedom there. A file-reading grader here is for the one fact a case turns
on — that the row reached the plan, that the state reached the disk. What the evals are for is the
part a test cannot reach: whether the skill asks rather than asserts, disposes of a follow-up
correctly, performs a sequence, and refuses what it should refuse.

### The load check is not `--case 'nope'`

**Measured:** `--case 'nope'` prints `No eval cases found matching` and exits **without loading or
validating anything**, so a grader with an invalid `type:` passes it. Cases are loaded *after* the
`--case` filter, so the cheap check is a filtered run with a cost ceiling:

```bash
claude plugin eval . --case '*' --trust-plugin --no-publish --ablation none \
  --max-cost-usd 0.0001 --allow-tools Write Edit Bash
```

Every matched case is loaded and pre-flighted before the first run launches, the ceiling stops it
after one, and a broken case prints `✗ <dir>: invalid case.yaml …` with a closing
`N case file(s) failed to load`. One run's cost is the price of the check.

## A single red run is not a finding

**Measured here:** `github-gate` scored 0.00 with three unanimous FAIL judge votes, and then 1.00
with three unanimous PASS votes on the next run, with **no change to the skill in between** — the
only edit was adding a `tool_used` grader to the same case.

So a red case is re-run before it is treated as a defect, and the first question is whether the
skill fired at all. That is what the `tool_used: Skill` grader is for: without it, a run where the
plugin never loaded is indistinguishable from one where it loaded and got the answer wrong. **Every
case carries one**, and it is the same four lines of frontmatter in each — one artifact, so one
proof that it reds covers all of them:

```bash
for f in evals/*/graders/skill-fired.md; do
  printf '%-46s %s\n' "$f" "$(sed -n '/^---$/,/^---$/p' "$f" | shasum | cut -c1-12)"
done
for d in evals/*/; do [ -d "$d/graders" ] || continue
  [ -f "$d/graders/skill-fired.md" ] || echo "MISSING: $d"
done
```

The second loop prints nothing. It printed `evals/wizard-interview/` until that case got one — and
that was the case whose other two graders both assert a file is **absent**, which is exactly what a
run with no plugin produces.

Cases run once each (`runs: 1`) to keep the suite affordable. With the default threshold of 1.0
that means one run has to pass, which is a real weakness and the reason for the paragraph above —
not a reason to loosen a grader.

**And a single green run is not proof of a fix.** Measured on `github-pr-shape` over five runs
either side of one change: 3 of 5 before, 5 of 5 after. Within the before set, runs 1 and 3
produced near-identical bodies — the same four dispositions, the same three size names — and
opposite verdicts, on judge votes of FAIL/PASS/PASS against FAIL/FAIL/PASS. So part of a case's
variance is the judge's majority vote near the boundary of a long criteria, and **the unit of
evidence for a claim about a case is a pass rate over at least five runs**, with the run count
stated. `--runs 5 --ablation none` is the shape; `--ablation with-without` doubles the bill and
answers a different question.
