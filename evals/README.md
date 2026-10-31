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
| `context-level` | the level read off the figure not the agent count, the Orange action in full, and no invented threshold |

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

**The fallback is reliable for the start contract and measurably not for the finish contract.**
Removing `docs/building.md` from `build-finish-contract`'s fixture was tried, over three runs, and
the skill fired twice while reading the template **none** of the three: it offered to write the doc
and then fell back to the plan's `Done when` column alone — *"This repo has no `docs/building.md`,
so the only finish contract is the plan's 'Done when' column."* That is the same shape Ruling 100
fixed for the size vocabulary, in the other skill, so the fixture keeps its `docs/building.md` and
the finding is written up rather than papered over.

### Which cases the plugin actually changes

`--ablation with-without` is the number worth reading. **Six of the fifteen cases have been
measured both ways**, and over the runs stated those six sort into cases that earn their keep and
cases that are regression guards. The other nine carry no row here, which means unmeasured, not
zero:

| Case | with | without | Δ | runs |
|---|---|---|---|---|
| `github-merge` | 1.00 | 0.00 | **+1.00** | 2 |
| `build-start-contract` | 1.00 | 0.33 | **+0.67** | 2 |
| `context-level` | 1.00 | 0.56 | **+0.44** | 6 |
| `github-merge-no-command` | 1.00 | 1.00 | 0.00 | 2 |
| `github-merge-gate` | 0.27–0.47 | 0.20 | +0.07…+0.27 | 7 |
| `build-finish-contract` | 0.52 | 0.68 | −0.16 | 10 |

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
move its delta, which is why that case is documented as a guard and its cause routed rather than
patched. A Δ at or below zero is a case to re-read, not a case to delete: `build-finish-contract`
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
